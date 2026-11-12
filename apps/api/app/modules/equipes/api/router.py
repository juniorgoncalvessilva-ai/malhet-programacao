from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, administrar, ler, planejar
from app.core.db import get_session
from app.modules.equipes.application.importar_equipes import importar_equipes, importar_equipes_simova
from app.modules.equipes.infra.composicao import composicao_efetiva, sincronizar_membros
from app.modules.efetivo.infra.gateway import (
    LocalizadorEfetivo,
    PessoaEfetivo,
    funcoes_por_cracha,
    pessoas_por_cracha,
    setor_da_disciplina,
)
from app.modules.equipes.application.vincular_efetivo import vincular_equipe, vincular_equipes
from app.modules.equipes.domain.simova_equipe import separar_cracha
from app.modules.equipes.infra.models import EquipeComposicaoModel, EquipeModel
from app.shared.errors import DomainError, NotFoundError

router = APIRouter(prefix="/equipes", tags=["equipes"])


class ComposicaoIO(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    recurso: str
    tipo: str = "MOD"
    quantidade: float


class MembroIO(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    cracha: str
    nome: str
    funcao: str | None = None


class PessoaEfetivoIO(BaseModel):
    """A pessoa como está no efetivo e mobilização (ligada pela matrícula/crachá)."""
    matricula: str | None = None
    nome: str
    funcao: str | None = None  # função no efetivo (DP)
    funcao_cpu: str | None = None  # função da composição pelo de-para
    situacao: str
    empresa: str
    no_ultimo_arquivo: bool = True


class MembroOut(MembroIO):
    efetivo: PessoaEfetivoIO | None = None


class EquipeIn(BaseModel):
    nome: str
    frente_codigo: str | None = None
    setor_id: int | None = None
    subsetor_id: int | None = None  # disciplina; define o setor
    encarregado_cracha: str | None = None
    encarregado_nome: str | None = None
    jornada_horas: float = Field(9.0, gt=0, le=24)
    turno: str | None = "Diurno"
    codigo_simova: str | None = None
    responsavel: str | None = None
    responsavel_id: int | None = None  # engenheiro/supervisor do efetivo (preenche o responsável)
    equipamentos: str | None = None
    observacao: str | None = None
    ativo: bool = True
    composicao: list[ComposicaoIO] = []
    membros: list[MembroIO] = []


class EquipeOut(EquipeIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    hh_disponivel_dia: float = 0
    composicao_efetiva: list[ComposicaoIO] = []
    membros: list[MembroOut] = []
    encarregado_efetivo: PessoaEfetivoIO | None = None
    responsavel_efetivo: dict | None = None  # {id, nome, matricula, funcao, situacao} de quem lidera a equipe
    fora_do_efetivo: int = 0  # pessoas da equipe que não foram achadas no efetivo


def _pessoa_io(p: PessoaEfetivo | None, funcao_de: dict[str, str]) -> PessoaEfetivoIO | None:
    if p is None:
        return None
    return PessoaEfetivoIO(matricula=p.matricula, nome=p.nome, funcao=p.funcao, funcao_cpu=funcao_de.get(p.cracha or ""),
                           situacao=p.situacao, empresa=p.empresa, no_ultimo_arquivo=p.no_ultimo_arquivo)


def _setor_e_disciplina(s: Session, obra_id: int, e: EquipeModel) -> None:
    """Disciplina manda no setor; disciplina de outro setor (ou inexistente) é descartada."""
    if e.subsetor_id:
        setor = setor_da_disciplina(s, obra_id, e.subsetor_id)
        if setor is None:
            e.subsetor_id = None
        else:
            e.setor_id = setor


def _responsavel(s: Session, obra_id: int, e: EquipeModel) -> None:
    """Líder escolhido no efetivo: o nome dele vira o Responsável da equipe (e da programação)."""
    from app.modules.efetivo.infra.models import ColaboradorModel

    if e.responsavel_id is None:
        e.lider = None
        return
    p = s.get(ColaboradorModel, e.responsavel_id)
    if p is None or p.obra_id != obra_id:
        raise DomainError("escolha o engenheiro/supervisor no efetivo desta obra", "responsavel_id")
    e.lider, e.responsavel = p, p.nome[:150]


def _membros(d: "EquipeIn") -> list[tuple[str, str, str | None]]:
    """Crachá vazio → número antes do nome ("115532 - José"); sem número, o próprio nome segura a vaga."""
    out = []
    for m in d.membros:
        cracha = (m.cracha or "").strip()
        if not cracha:
            num, _ = separar_cracha(m.nome)
            cracha = num or f"?{m.nome.strip()[:18]}"
        out.append((cracha[:20], m.nome, (m.funcao or "").strip() or None))
    return out


def _out(e: EquipeModel, funcao_de: dict[str, str] | None = None,
         pessoas: dict[str, PessoaEfetivo] | None = None) -> EquipeOut:
    funcao_de, pessoas = funcao_de or {}, pessoas or {}
    o = EquipeOut.model_validate(e)
    o.membros = [MembroOut(cracha=m.cracha, nome=m.nome, funcao=m.funcao, efetivo=_pessoa_io(pessoas.get(m.cracha), funcao_de))
                 for m in sorted(e.membros, key=lambda m: m.nome)]
    o.encarregado_efetivo = _pessoa_io(pessoas.get(e.encarregado_cracha or ""), funcao_de)
    if e.responsavel_id and e.lider is not None:
        o.responsavel_efetivo = {"id": e.lider.id, "nome": e.lider.nome, "matricula": e.lider.matricula,
                                 "funcao": e.lider.funcao, "situacao": e.lider.situacao}
    if pessoas:
        o.fora_do_efetivo = sum(1 for m in o.membros if m.efetivo is None) + \
            (1 if (e.encarregado_cracha or e.encarregado_nome) and o.encarregado_efetivo is None else 0)
    ef = composicao_efetiva(e, funcao_de)
    o.composicao_efetiva = [ComposicaoIO(recurso=r, tipo=t, quantidade=q) for r, t, q in ef]
    mod = sum(q for _, t, q in ef if t == "MOD") or len(e.membros)
    o.hh_disponivel_dia = round(mod * e.jornada_horas, 2)
    return o


@router.get("", response_model=list[EquipeOut])
def listar(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    fd, pe = funcoes_por_cracha(s, c.obra_id), pessoas_por_cracha(s, c.obra_id)
    return [_out(e, fd, pe) for e in s.scalars(select(EquipeModel).where(EquipeModel.obra_id == c.obra_id).order_by(EquipeModel.nome))]


@router.post("", response_model=EquipeOut, status_code=201)
def criar(d: EquipeIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    e = EquipeModel(**d.model_dump(exclude={"composicao", "membros"}), obra_id=c.obra_id,
                    composicao=[EquipeComposicaoModel(**c.model_dump()) for c in d.composicao])
    sincronizar_membros(e, _membros(d))
    _setor_e_disciplina(s, c.obra_id, e)
    _responsavel(s, c.obra_id, e)
    s.add(e)
    vincular_equipe(e, LocalizadorEfetivo(s, c.obra_id))
    s.flush()
    return _out(e, funcoes_por_cracha(s, c.obra_id), pessoas_por_cracha(s, c.obra_id))


@router.put("/{equipe_id}", response_model=EquipeOut)
def atualizar(equipe_id: int, d: EquipeIn, s: Session = Depends(get_session),
              c: ContextoObra = Depends(planejar)):
    e = s.get(EquipeModel, equipe_id)
    if e is None or e.obra_id != c.obra_id:
        raise NotFoundError("Equipe", equipe_id)
    for k, v in d.model_dump(exclude={"composicao", "membros"}).items():
        setattr(e, k, v)
    e.composicao = [EquipeComposicaoModel(**c.model_dump()) for c in d.composicao]
    sincronizar_membros(e, _membros(d))
    _setor_e_disciplina(s, c.obra_id, e)
    _responsavel(s, c.obra_id, e)
    s.flush()
    vincular_equipe(e, LocalizadorEfetivo(s, c.obra_id))
    s.flush()
    return _out(e, funcoes_por_cracha(s, c.obra_id), pessoas_por_cracha(s, c.obra_id))


@router.delete("/{equipe_id}", status_code=204)
def excluir(equipe_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    e = s.get(EquipeModel, equipe_id)
    if e is None or e.obra_id != c.obra_id:
        raise NotFoundError("Equipe", equipe_id)
    s.delete(e)


@router.get("/{equipe_id}/memoria")
def memoria_equipe(equipe_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Memória de cálculo da equipe: composição por função (de onde veio cada função) e HH disponível por dia."""
    from app.modules.planejamento.application.memoria import memoria_composicao_equipe, memoria_hh_disponivel
    from app.shared.memoria import pacote

    e = s.get(EquipeModel, equipe_id)
    if e is None or e.obra_id != c.obra_id:
        raise NotFoundError("Equipe", equipe_id)
    return pacote(memoria_composicao_equipe(s, c.obra_id, e), memoria_hh_disponivel(s, c.obra_id, e))


@router.post("/importar")
def importar(arquivo: UploadFile = File(...), s: Session = Depends(get_session),
             c: ContextoObra = Depends(administrar)):
    """Importa a aba EQUIPES da planilha auxiliar."""
    n = importar_equipes(s, c.obra_id, arquivo.file)
    return {"equipes": n, "vinculo": vincular_equipes(s, c.obra_id)}


@router.post("/importar-simova")
def importar_simova(arquivo: UploadFile = File(...), s: Session = Depends(get_session),
                    c: ContextoObra = Depends(planejar)):
    """Cadastro de equipes exportado do Simova (Código, Descrição, Encarregado, Funcionário, Equipamento, Ativo)."""
    r = importar_equipes_simova(s, c.obra_id, arquivo.file)
    return {**r, "vinculo": vincular_equipes(s, c.obra_id)}


@router.post("/vincular-efetivo")
def vincular_efetivo(s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Separa o número antes do nome (crachá/matrícula) de encarregados e funcionários e liga ao efetivo."""
    return vincular_equipes(s, c.obra_id)


@router.get("/simova.xlsx")
def exportar_simova(ativas: bool = True, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Cadastro de equipes no padrão do Simova (Código, Descrição, Encarregado, Funcionário, Equipamento, Ativo),
    para importar no Simova. Nomes vêm do efetivo quando a pessoa está lá (crachá = matrícula)."""
    from io import BytesIO

    from fastapi.responses import Response
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font

    from app.modules.efetivo.infra.gateway import pessoas_por_cracha
    from app.modules.equipes.domain.simova_equipe import CABECALHO_SIMOVA, linha_simova

    pessoas = pessoas_por_cracha(s, c.obra_id)
    nome = lambda cracha, padrao: pessoas[cracha].nome if cracha in pessoas else padrao  # noqa: E731
    wb = Workbook()
    ws = wb.active
    ws.title = "Sheet1"
    ws.append(CABECALHO_SIMOVA)
    for cel in ws[1]:
        cel.font = Font(bold=True)
    q = select(EquipeModel).where(EquipeModel.obra_id == c.obra_id)
    if ativas:
        q = q.where(EquipeModel.ativo.is_(True))
    equipes = sorted(s.scalars(q), key=lambda e: (int(e.codigo_simova) if (e.codigo_simova or "").isdigit() else 10**6, e.nome))
    proximo = max([int(e.codigo_simova) for e in equipes if (e.codigo_simova or "").isdigit()], default=0)
    for e in equipes:
        codigo = e.codigo_simova
        if not codigo:
            proximo += 1
            codigo = str(proximo)
        enc = (e.encarregado_cracha, nome(e.encarregado_cracha, e.encarregado_nome or "")) if e.encarregado_cracha else None
        # quem está sem crachá ("?nome") não vai para o Simova
        func = [(m.cracha, nome(m.cracha, m.nome)) for m in sorted(e.membros, key=lambda m: m.nome) if not m.cracha.startswith("?")]
        ws.append(linha_simova(codigo, e.nome, enc, func, e.equipamentos, e.ativo))
    for col, w in {"A": 6, "B": 7.8, "C": 44, "D": 54, "E": 263, "F": 14, "G": 6.4, "H": 6}.items():
        ws.column_dimensions[col].width = w
    for row in ws.iter_rows(min_row=2):
        for cel in row:
            cel.alignment = Alignment(vertical="top")
    buf = BytesIO()
    wb.save(buf)
    return Response(buf.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": 'attachment; filename="Equipe_Simova.xlsx"'})
