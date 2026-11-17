from datetime import date, timedelta

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
from app.modules.equipes.application.alocacao import Alocador
from app.modules.equipes.application.nome import config_da_obra, nome_da_nova_equipe, nomes_da_obra
from app.modules.equipes.application.vincular_efetivo import vincular_equipe, vincular_equipes
from app.modules.equipes.domain.alocacao import (
    MODELO_PADRAO,
    Movimento,
    disciplina_do_nome,
    nome_padrao,
    proximo_numero,
    resumo_movimentos,
    validar_modelo,
)
from app.modules.equipes.domain.simova_equipe import separar_cracha
from app.modules.equipes.infra.models import EquipeComposicaoModel, EquipeConfigModel, EquipeModel
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
    supervisor_id: int | None = None  # líder intermediário (une equipes abaixo do responsável)
    equipamentos: str | None = None
    observacao: str | None = None
    ativo: bool = True
    composicao: list[ComposicaoIO] = []
    membros: list[MembroIO] = []
    # equipe nova no padrão da obra (spec 107): o nome sai do padrão com o próximo número e esta disciplina
    disciplina_padrao: str | None = None


class EquipeOut(EquipeIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    hh_disponivel_dia: float = 0
    composicao_efetiva: list[ComposicaoIO] = []
    membros: list[MembroOut] = []
    encarregado_efetivo: PessoaEfetivoIO | None = None
    responsavel_efetivo: dict | None = None  # {id, nome, matricula, funcao, situacao} de quem lidera a equipe
    supervisor_efetivo: dict | None = None
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


def _supervisor(s: Session, obra_id: int, e: EquipeModel) -> None:
    from app.modules.efetivo.infra.models import ColaboradorModel

    if e.supervisor_id is None:
        e.supervisor = None
        return
    p = s.get(ColaboradorModel, e.supervisor_id)
    if p is None or p.obra_id != obra_id:
        raise DomainError("escolha o supervisor no efetivo desta obra", "supervisor_id")
    e.supervisor = p


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
    if e.supervisor_id and e.supervisor is not None:
        o.supervisor_efetivo = {"id": e.supervisor.id, "nome": e.supervisor.nome, "matricula": e.supervisor.matricula,
                                "funcao": e.supervisor.funcao, "situacao": e.supervisor.situacao}
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


# ---- padrão de nome (spec 107) ------------------------------------------------------------------------------
_config, _nomes = config_da_obra, nomes_da_obra


class ConfigIn(BaseModel):
    modelo_nome: str = MODELO_PADRAO
    digitos: int = Field(1, ge=1, le=4)


def _config_out(s: Session, obra_id: int) -> dict:
    cf, nomes = _config(s, obra_id), _nomes(s, obra_id)
    n = proximo_numero(cf.modelo_nome, nomes)
    disciplinas = sorted({x for x in (disciplina_do_nome(cf.modelo_nome, nm) for nm in nomes) if x})
    return {"modelo_nome": cf.modelo_nome, "digitos": cf.digitos, "proximo_numero": n,
            "exemplo": nome_padrao(cf.modelo_nome, n, disciplinas[0] if disciplinas else "FORMA", cf.digitos),
            "disciplinas": disciplinas,
            "fora_do_padrao": sorted(nm for nm in nomes if disciplina_do_nome(cf.modelo_nome, nm) is None
                                     and "{disciplina}" in cf.modelo_nome)}


@router.get("/config")
def ler_config(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Padrão de nome da obra, o próximo número e as disciplinas já usadas (para sugerir)."""
    return _config_out(s, c.obra_id)


@router.put("/config")
def salvar_config(d: ConfigIn, s: Session = Depends(get_session), c: ContextoObra = Depends(administrar)):
    modelo = validar_modelo(d.modelo_nome)
    cf = s.get(EquipeConfigModel, c.obra_id)
    if cf is None:
        cf = EquipeConfigModel(obra_id=c.obra_id)
        s.add(cf)
    cf.modelo_nome, cf.digitos = modelo, d.digitos
    s.flush()
    return _config_out(s, c.obra_id)


# ---- movimentações (spec 107) ---------------------------------------------------------------------------------
@router.get("/movimentacoes")
def movimentacoes(inicio: date | None = None, fim: date | None = None, limite: int = 300,
                  s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Quantas vezes as equipes mudaram no período: entradas e saídas por equipe, por semana e a lista."""
    from app.modules.efetivo.infra.models import ColaboradorModel, MovimentoEfetivoModel as Mv

    fim = fim or date.today()
    inicio = inicio or fim - timedelta(days=29)
    linhas = s.execute(select(Mv, ColaboradorModel.nome, ColaboradorModel.matricula)
                       .join(ColaboradorModel, ColaboradorModel.id == Mv.colaborador_id)
                       .where(Mv.obra_id == c.obra_id, Mv.tipo == "EQUIPE").order_by(Mv.em.desc())).all()
    nomes = dict(s.execute(select(EquipeModel.id, EquipeModel.nome).where(EquipeModel.obra_id == c.obra_id)).all())
    movs = [Movimento(em=m.em, pessoa=nome, de_id=m.de_equipe_id, de=m.de, para_id=m.para_equipe_id, para=m.para)
            for m, nome, _ in linhas]
    out = resumo_movimentos(movs, inicio, fim, nomes)
    out["itens"] = [{"em": m.em.isoformat(), "nome": nome, "matricula": mat,
                     "de": nomes.get(m.de_equipe_id, m.de) if m.de_equipe_id else m.de,
                     "para": nomes.get(m.para_equipe_id, m.para) if m.para_equipe_id else m.para, "por": m.por}
                    for m, nome, mat in linhas if inicio <= m.em.date() <= fim][:max(1, min(limite, 2000))]
    return out


def _entradas_e_saidas(al: Alocador, e: EquipeModel, antes: set[str]) -> None:
    """Depois de salvar a equipe pelo cadastro: quem entrou sai da outra equipe; quem saiu vai para o histórico."""
    agora = {m.cracha for m in e.membros}
    for cracha in sorted(agora - antes):
        al.entrou(e, cracha)
    for cracha in sorted(antes - agora):
        al.saiu(e, cracha)


@router.post("", response_model=EquipeOut, status_code=201)
def criar(d: EquipeIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    if d.disciplina_padrao is not None:
        d.nome = nome_da_nova_equipe(s, c.obra_id, d.disciplina_padrao)
    if not d.nome.strip():
        raise DomainError("dê um nome à equipe", "nome")
    if s.scalar(select(EquipeModel.id).where(EquipeModel.obra_id == c.obra_id, EquipeModel.nome == d.nome.strip())):
        raise DomainError(f"já existe a equipe {d.nome.strip()}", "nome")
    e = EquipeModel(**d.model_dump(exclude={"composicao", "membros", "disciplina_padrao"}), obra_id=c.obra_id,
                    composicao=[EquipeComposicaoModel(**c.model_dump()) for c in d.composicao])
    sincronizar_membros(e, _membros(d))
    _setor_e_disciplina(s, c.obra_id, e)
    _responsavel(s, c.obra_id, e)
    _supervisor(s, c.obra_id, e)
    s.add(e)
    vincular_equipe(e, LocalizadorEfetivo(s, c.obra_id))
    s.flush()
    _entradas_e_saidas(Alocador(s, c.obra_id, c.usuario.id), e, set())
    s.flush()
    return _out(e, funcoes_por_cracha(s, c.obra_id), pessoas_por_cracha(s, c.obra_id))


@router.put("/{equipe_id}", response_model=EquipeOut)
def atualizar(equipe_id: int, d: EquipeIn, s: Session = Depends(get_session),
              c: ContextoObra = Depends(planejar)):
    e = s.get(EquipeModel, equipe_id)
    if e is None or e.obra_id != c.obra_id:
        raise NotFoundError("Equipe", equipe_id)
    antes = {m.cracha for m in e.membros}
    for k, v in d.model_dump(exclude={"composicao", "membros", "disciplina_padrao"}).items():
        setattr(e, k, v)
    e.composicao = [EquipeComposicaoModel(**c.model_dump()) for c in d.composicao]
    sincronizar_membros(e, _membros(d))
    _setor_e_disciplina(s, c.obra_id, e)
    _responsavel(s, c.obra_id, e)
    _supervisor(s, c.obra_id, e)
    s.flush()
    vincular_equipe(e, LocalizadorEfetivo(s, c.obra_id))
    s.flush()
    _entradas_e_saidas(Alocador(s, c.obra_id, c.usuario.id), e, antes)
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


# ---- pessoas da equipe pelo organograma (spec 049) ------------------------------------------------------------
class MembroAcaoIn(BaseModel):
    cracha: str  # crachá ou matrícula
    nome: str | None = None  # sem efetivo: o nome digitado
    de_equipe_id: int | None = None  # mover: sai desta equipe


def _equipe(s: Session, obra_id: int, eid: int) -> EquipeModel:
    e = s.get(EquipeModel, eid)
    if e is None or e.obra_id != obra_id:
        raise NotFoundError("Equipe", eid)
    return e


def _tirar(e: EquipeModel, cracha: str) -> None:
    if e.encarregado_cracha and e.encarregado_cracha == cracha:
        raise DomainError(f"{cracha} é o encarregado de {e.nome}: troque o encarregado no cadastro da equipe")
    m = next((x for x in e.membros if x.cracha == cracha), None)
    if m is None:
        raise DomainError(f"{cracha} não está na equipe {e.nome}")
    e.membros.remove(m)


def _incluir(s: Session, obra_id: int, e: EquipeModel, cod: str, nome_digitado: str | None, de_equipe_id: int | None,
             al: Alocador) -> str:
    """Inclui a pessoa na equipe; devolve o nome. Nome vem do efetivo. Sai sozinha da outra equipe (spec 107; líder
    não) e, com `de_equipe_id` (mover pelo organograma), sai dessa equipe mesmo sendo líder."""
    from app.modules.efetivo.infra.models import ColaboradorModel

    cod = (cod or "").strip()
    if not cod:
        raise DomainError("informe o crachá ou a matrícula", "cracha")
    pessoa = s.scalar(select(ColaboradorModel).where(ColaboradorModel.obra_id == obra_id, ColaboradorModel.cracha == cod)) or \
        s.scalar(select(ColaboradorModel).where(ColaboradorModel.obra_id == obra_id, ColaboradorModel.matricula == cod))
    cracha = (pessoa.cracha or pessoa.matricula or cod) if pessoa else cod
    nome = pessoa.nome if pessoa else (nome_digitado or "").strip()
    if not nome:
        raise DomainError("pessoa fora do efetivo: informe o nome", "nome")
    if any(m.cracha == cracha for m in e.membros) or e.encarregado_cracha == cracha:
        raise DomainError(f"{nome} já está na equipe {e.nome}")
    origem = None
    if de_equipe_id is not None and de_equipe_id != e.id:
        origem = _equipe(s, obra_id, de_equipe_id)
        if origem.encarregado_cracha and origem.encarregado_cracha == cracha:
            raise DomainError(f"{cracha} é o encarregado de {origem.nome}: troque o encarregado no cadastro da equipe")
    al.incluir(e, cracha, nome, forcar_de=origem)
    return nome


@router.post("/{equipe_id}/membros", response_model=EquipeOut)
def incluir_membro(equipe_id: int, d: MembroAcaoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Inclui a pessoa na equipe (com `de_equipe_id`, move: sai da outra). Nome e função vêm do efetivo."""
    e = _equipe(s, c.obra_id, equipe_id)
    _incluir(s, c.obra_id, e, d.cracha, d.nome, d.de_equipe_id, Alocador(s, c.obra_id, c.usuario.id))
    s.flush()
    vincular_equipe(e, LocalizadorEfetivo(s, c.obra_id))
    s.flush()
    return _out(e, funcoes_por_cracha(s, c.obra_id), pessoas_por_cracha(s, c.obra_id))


class ItemLoteIn(BaseModel):
    cracha: str
    de_equipe_id: int | None = None


class LoteIn(BaseModel):
    itens: list[ItemLoteIn]
    para_equipe_id: int | None = None  # vazio = tirar das equipes de origem


@router.post("/membros/lote")
def mover_lote(d: LoteIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Arrastar e soltar no organograma (spec 052): várias pessoas de uma vez para uma equipe (incluir/mover) ou para
    fora (tirar). Quem não dá (encarregado, já na equipe) volta em `erros`; o resto é feito."""
    para = _equipe(s, c.obra_id, d.para_equipe_id) if d.para_equipe_id is not None else None
    al = Alocador(s, c.obra_id, c.usuario.id)
    feitos, erros = 0, []
    for it in d.itens:
        try:
            with s.begin_nested():
                if para is None:
                    if it.de_equipe_id is None:
                        continue
                    origem = _equipe(s, c.obra_id, it.de_equipe_id)
                    _tirar(origem, it.cracha)
                    al.saiu(origem, it.cracha)
                else:
                    if it.de_equipe_id == para.id:
                        continue
                    _incluir(s, c.obra_id, para, it.cracha, None, it.de_equipe_id, al)
                s.flush()
            feitos += 1
        except DomainError as er:
            erros.append(er.mensagem)
    if para is not None:
        vincular_equipe(para, LocalizadorEfetivo(s, c.obra_id))
    s.flush()
    return {"feitos": feitos, "erros": erros[:30]}


class LiderancaIn(BaseModel):
    equipes: list[int]
    papel: str  # responsavel | supervisor
    colaborador_id: int | None = None  # vazio = tira


@router.put("/lideranca/definir")
def definir_lideranca(d: LiderancaIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Responsável ou supervisor (líder intermediário) de várias equipes de uma vez, escolhido no efetivo."""
    if d.papel not in ("responsavel", "supervisor"):
        raise DomainError("papel: responsavel ou supervisor", "papel")
    for eid in d.equipes:
        e = _equipe(s, c.obra_id, eid)
        if d.papel == "responsavel":
            e.responsavel_id = d.colaborador_id
            _responsavel(s, c.obra_id, e)
        else:
            e.supervisor_id = d.colaborador_id
            _supervisor(s, c.obra_id, e)
    s.flush()
    return {"equipes": len(d.equipes)}


@router.delete("/{equipe_id}/membros/{cracha}", status_code=204)
def tirar_membro(equipe_id: int, cracha: str, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Tira a pessoa da equipe (ela continua no efetivo, em "Sem equipe" se não estiver em outra)."""
    e = _equipe(s, c.obra_id, equipe_id)
    _tirar(e, cracha)
    Alocador(s, c.obra_id, c.usuario.id).saiu(e, cracha)
    s.flush()
