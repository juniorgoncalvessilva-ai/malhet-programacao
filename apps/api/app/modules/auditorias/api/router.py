"""Auditorias e inspeções (spec 064): modelos (templates), opções do formulário, registros, envio e texto do WhatsApp.
Spec 072: o celular grava a auditoria inteira sem internet e envia de uma vez (`/registros/completo`, idempotente)."""
import json
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, negar, ssma
from app.core.db import get_session
from app.modules.auditorias import application as ap
from app.modules.auditorias.domain.auditoria import MODELO_SEGURANCA, ROTULO_STATUS, pendencias, texto_envio, validar_config
from app.modules.auditorias.infra.models import ModeloAuditoriaModel, RegistroAuditoriaModel
from app.modules.campo.domain.foto import LIMITE, tipo_da_imagem
from app.modules.campo.infra.models import FotoCampoModel
from app.modules.equipes.infra.models import EquipeModel
from app.modules.frentes.infra.models import AreaFrenteModel, LocalFrenteModel
from app.modules.obras.domain.obra import PapelObra
from app.shared.errors import DomainError, NotFoundError
from app.shared.offline import validar_id_local

router = APIRouter(prefix="/auditorias", tags=["auditorias e inspeções"])


async def auditar(c: ContextoObra = Depends(ler)) -> ContextoObra:
    """Registrar auditoria: a segurança e do encarregado para cima."""
    if not (c.papel.pode(PapelObra.ENCARREGADO) or c.papel == PapelObra.SEGURANCA):
        raise negar("seu papel só consulta as auditorias")
    return c


# ---------- modelos (templates) ----------
def _modelo_out(m: ModeloAuditoriaModel, n_registros: int = 0) -> dict:
    return {"id": m.id, "nome": m.nome, "setor": m.setor, "padrao": m.padrao, "ativo": m.ativo, "config": m.config, "registros": n_registros}


@router.get("/modelos")
def modelos(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    ap.garantir_padrao(s, c.obra_id)
    usos: dict[int, int] = {}
    for (mid,) in s.execute(select(RegistroAuditoriaModel.modelo_id).where(RegistroAuditoriaModel.obra_id == c.obra_id)):
        usos[mid] = usos.get(mid, 0) + 1
    return [_modelo_out(m, usos.get(m.id, 0)) for m in s.scalars(select(ModeloAuditoriaModel).where(ModeloAuditoriaModel.obra_id == c.obra_id)
                                                                .order_by(ModeloAuditoriaModel.padrao.desc(), ModeloAuditoriaModel.nome))]


@router.get("/modelos/base")
def modelo_base(c: ContextoObra = Depends(ler)):
    """Modelo de Segurança do Trabalho de fábrica (para começar um novo ou restaurar)."""
    return validar_config(MODELO_SEGURANCA)


class ModeloIn(BaseModel):
    config: dict
    padrao: bool = False
    ativo: bool = True


def _salvar_modelo(s: Session, m: ModeloAuditoriaModel, d: ModeloIn) -> None:
    cfg = validar_config(d.config)
    m.config, m.nome, m.setor, m.ativo = cfg, cfg["nome"], cfg["setor"], d.ativo or d.padrao
    if d.padrao:
        for o in s.scalars(select(ModeloAuditoriaModel).where(ModeloAuditoriaModel.obra_id == m.obra_id, ModeloAuditoriaModel.id != (m.id or 0))):
            o.padrao = False
        m.padrao = True


@router.post("/modelos", status_code=201)
def criar_modelo(d: ModeloIn, s: Session = Depends(get_session), c: ContextoObra = Depends(ssma)):
    m = ModeloAuditoriaModel(obra_id=c.obra_id, nome="", padrao=False, config={})
    _salvar_modelo(s, m, d)
    s.add(m)
    s.flush()
    return _modelo_out(m)


def _modelo(s: Session, c: ContextoObra, mid: int) -> ModeloAuditoriaModel:
    m = s.get(ModeloAuditoriaModel, mid)
    if m is None or m.obra_id != c.obra_id:
        raise NotFoundError("Modelo", mid)
    return m


@router.put("/modelos/{mid}")
def editar_modelo(mid: int, d: ModeloIn, s: Session = Depends(get_session), c: ContextoObra = Depends(ssma)):
    m = _modelo(s, c, mid)
    if m.padrao and not d.padrao:
        raise DomainError("para tirar o padrão, marque outro modelo como padrão")
    _salvar_modelo(s, m, d)
    s.flush()
    return _modelo_out(m)


@router.delete("/modelos/{mid}", status_code=204)
def excluir_modelo(mid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ssma)):
    m = _modelo(s, c, mid)
    if m.padrao:
        raise DomainError("o modelo padrão não pode ser excluído")
    if s.scalar(select(RegistroAuditoriaModel.id).where(RegistroAuditoriaModel.modelo_id == mid)):
        raise DomainError("modelo com registros: desative em vez de excluir")
    s.delete(m)


# ---------- opções do formulário ----------
@router.get("/opcoes")
def opcoes(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Equipes com encarregado, engenheiro e líder (para o acompanhamento) e a lista de RAC do cadastro de SSMA."""
    from app.modules.ssma.infra.models import CadastroSsmaModel

    eqs = []
    for e in s.scalars(select(EquipeModel).where(EquipeModel.obra_id == c.obra_id, EquipeModel.ativo.is_(True)).order_by(EquipeModel.nome)):
        eng = (e.lider.nome if e.lider else None) or e.responsavel
        lider = (e.supervisor.nome if e.supervisor else None) or eng
        enc = " ".join((e.encarregado_nome or "").split("::")[-1].split()) or None
        eqs.append({"id": e.id, "nome": e.nome, "encarregado": enc, "engenheiro": eng, "lider": lider, "frente": e.frente_codigo})
    racs = [{"codigo": x.codigo, "descricao": x.descricao} for x in s.scalars(select(CadastroSsmaModel).where(
        CadastroSsmaModel.obra_id == c.obra_id, CadastroSsmaModel.tipo == "RAC").order_by(CadastroSsmaModel.codigo))]
    return {"equipes": eqs, "engenheiros": sorted({e["engenheiro"] for e in eqs if e["engenheiro"]}), "racs": racs}


# ---------- registros ----------
class RegistroIn(BaseModel):
    modelo_id: int | None = None
    tipo: str | None = None
    tipo_registro: str | None = None
    data: date
    area_id: int | None = None
    area_texto: str | None = None
    equipe_id: int | None = None
    engenheiro: str | None = None
    encarregado: str | None = None
    rac: str | None = None
    nao_conformidade: str | None = None
    medida_corretiva: str | None = None
    ver_agir: bool | None = None
    plano_responsavel: str | None = None
    plano_prazo: date | None = None
    acompanhamento: str | None = None
    respostas: dict | None = None


def _frente(s: Session, obra_id: int, area_id: int | None) -> tuple[str | None, str | None]:
    a = s.get(AreaFrenteModel, area_id) if area_id else None
    if a is None or a.obra_id != obra_id:
        return None, None
    lc = s.get(LocalFrenteModel, a.local_id)
    return (f"{lc.codigo} · {lc.descricao}" if lc else None), f"{a.codigo} · {a.descricao}"


def _aplicar(s: Session, r: RegistroAuditoriaModel, d: RegistroIn, obra_id: int) -> None:
    for k in ("tipo", "tipo_registro", "data", "equipe_id", "engenheiro", "encarregado", "rac", "nao_conformidade", "medida_corretiva",
              "ver_agir", "plano_responsavel", "plano_prazo", "acompanhamento", "respostas"):
        v = getattr(d, k)
        setattr(r, k, " ".join(v.split()) if isinstance(v, str) and k not in ("nao_conformidade", "medida_corretiva") else v)
    if d.area_id:
        r.area_id = d.area_id
        r.local, r.area_texto = _frente(s, obra_id, d.area_id)
        if r.area_texto is None:
            raise DomainError("área não encontrada nas Frentes", "area_id")
    else:
        r.area_id, r.local, r.area_texto = None, None, d.area_texto


def _fotos(s: Session, obra_id: int, ids: list[int]) -> dict[int, list[dict]]:
    out: dict[int, list[dict]] = {}
    if ids:
        for f in s.execute(select(FotoCampoModel.id, FotoCampoModel.alvo_id, FotoCampoModel.legenda).where(
                FotoCampoModel.obra_id == obra_id, FotoCampoModel.alvo == "auditoria", FotoCampoModel.alvo_id.in_(ids)).order_by(FotoCampoModel.id)):
            out.setdefault(f.alvo_id, []).append({"id": f.id, "momento": "depois" if (f.legenda or "").startswith("depois") else "antes"})
    return out


def _saida(s: Session, obra_id: int, regs: list[RegistroAuditoriaModel]) -> list[dict]:
    fotos = _fotos(s, obra_id, [r.id for r in regs])
    from app.modules.acoes.infra.models import AcaoModel

    acoes = {a.id: a for a in s.scalars(select(AcaoModel).where(AcaoModel.id.in_({r.acao_id for r in regs if r.acao_id})))} if any(r.acao_id for r in regs) else {}
    out = []
    for r in regs:
        d = ap.como_dict(r)
        d["data"] = r.data.isoformat()
        d["plano_prazo"] = r.plano_prazo.isoformat() if r.plano_prazo else None
        d["status_rotulo"] = ROTULO_STATUS.get(r.status, r.status)
        d["criado_em"] = r.criado_em.isoformat() if r.criado_em else None
        d["fotos"] = fotos.get(r.id, [])
        a = acoes.get(r.acao_id)
        d["acao"] = {"id": a.id, "numero": a.numero, "status": a.status} if a else None
        out.append(d)
    return out


@router.get("/registros")
def registros(de: date | None = None, ate: date | None = None, status: str | None = None, tipo: str | None = None,
              area_id: int | None = None, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    q = select(RegistroAuditoriaModel).where(RegistroAuditoriaModel.obra_id == c.obra_id)
    if de:
        q = q.where(RegistroAuditoriaModel.data >= de)
    if ate:
        q = q.where(RegistroAuditoriaModel.data <= ate)
    if status:
        q = q.where(RegistroAuditoriaModel.status.in_(status.split(",")))
    if tipo:
        q = q.where(RegistroAuditoriaModel.tipo == tipo)
    if area_id:
        q = q.where(RegistroAuditoriaModel.area_id == area_id)
    return _saida(s, c.obra_id, list(s.scalars(q.order_by(RegistroAuditoriaModel.data.desc(), RegistroAuditoriaModel.numero.desc()))))


def _registro(s: Session, c: ContextoObra, rid: int) -> RegistroAuditoriaModel:
    r = s.get(RegistroAuditoriaModel, rid)
    if r is None or r.obra_id != c.obra_id:
        raise NotFoundError("Registro de auditoria", rid)
    return r


def _novo(s: Session, c: ContextoObra, d: RegistroIn) -> tuple[RegistroAuditoriaModel, ModeloAuditoriaModel]:
    ap.garantir_padrao(s, c.obra_id)
    mid = d.modelo_id or s.scalar(select(ModeloAuditoriaModel.id).where(ModeloAuditoriaModel.obra_id == c.obra_id, ModeloAuditoriaModel.padrao.is_(True)))
    m = s.get(ModeloAuditoriaModel, mid) if mid else None
    if m is None or m.obra_id != c.obra_id:
        raise NotFoundError("Modelo", d.modelo_id)
    r = RegistroAuditoriaModel(obra_id=c.obra_id, modelo_id=m.id, numero=ap.proximo_numero(s, c.obra_id), data=d.data, status="rascunho",
                               auditor_id=c.usuario.id, auditor=c.usuario.email)
    _aplicar(s, r, d, c.obra_id)
    s.add(r)
    s.flush()
    return r, m


@router.post("/registros", status_code=201)
def criar_registro(d: RegistroIn, s: Session = Depends(get_session), c: ContextoObra = Depends(auditar)):
    r, _ = _novo(s, c, d)
    return _saida(s, c.obra_id, [r])[0]


class RegistroCompletoIn(RegistroIn):
    id_local: str
    registrado_em: datetime | None = None


@router.post("/registros/completo", status_code=201)
async def registro_completo(dados: str = Form(...), momentos: str = Form("[]"), fotos: list[UploadFile] = File(default=[]),
                            s: Session = Depends(get_session), c: ContextoObra = Depends(auditar)):
    """Auditoria feita no celular (com ou sem internet), enviada de uma vez: registro + fotos (antes/depois) + finalizar,
    tudo ou nada. Reenviar o mesmo `id_local` devolve o registro já gravado (`repetido`), sem duplicar."""
    try:
        d = RegistroCompletoIn.model_validate_json(dados)
        ms = json.loads(momentos)
    except (ValidationError, ValueError):
        raise DomainError("dados da auditoria inválidos", "dados") from None
    validar_id_local(d.id_local)
    ja = s.scalar(select(RegistroAuditoriaModel).where(RegistroAuditoriaModel.obra_id == c.obra_id,
                                                       RegistroAuditoriaModel.id_local == d.id_local))
    if ja is not None:
        return {**_saida(s, c.obra_id, [ja])[0], "texto": _texto(s, c, ja, s.get(ModeloAuditoriaModel, ja.modelo_id)), "repetido": True}
    if not isinstance(ms, list) or len(ms) != len(fotos) or any(x not in ("antes", "depois") for x in ms):
        raise DomainError("cada foto precisa dizer se é do antes ou do depois", "momentos")
    r, m = _novo(s, c, d)
    r.id_local, r.registrado_em = d.id_local, d.registrado_em
    for arq, momento in zip(fotos, ms):
        conteudo = await arq.read(LIMITE + 1)
        s.add(FotoCampoModel(obra_id=c.obra_id, alvo="auditoria", alvo_id=r.id, data=r.data, legenda=momento,
                             content_type=tipo_da_imagem(conteudo), tamanho=len(conteudo), conteudo=conteudo,
                             enviado_por=c.usuario.id))
    s.flush()
    ap.finalizar(s, r, m.config, c.usuario.id)
    return {**_saida(s, c.obra_id, [r])[0], "texto": _texto(s, c, r, m), "repetido": False}


@router.put("/registros/{rid}")
def editar_registro(rid: int, d: RegistroIn, s: Session = Depends(get_session), c: ContextoObra = Depends(auditar)):
    r = _registro(s, c, rid)
    if r.status != "rascunho":
        raise DomainError("registro já enviado: o acompanhamento segue pela ação")
    _aplicar(s, r, d, c.obra_id)
    s.flush()
    return _saida(s, c.obra_id, [r])[0]


@router.delete("/registros/{rid}", status_code=204)
def excluir_registro(rid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(auditar)):
    r = _registro(s, c, rid)
    if r.status != "rascunho" and not c.papel.edita_ssma:
        raise DomainError("só a segurança exclui registro já enviado")
    if r.acao_id:
        raise DomainError("o registro tem ação 5W2H: cancele a ação antes")
    s.delete(r)


@router.get("/registros/{rid}/pendencias")
def ver_pendencias(rid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    r = _registro(s, c, rid)
    m = s.get(ModeloAuditoriaModel, r.modelo_id)
    return {"falta": pendencias(m.config, ap.como_dict(r), *ap.contar_fotos(s, c.obra_id, r.id))}


@router.post("/registros/{rid}/finalizar")
def finalizar(rid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(auditar)):
    r = _registro(s, c, rid)
    m = s.get(ModeloAuditoriaModel, r.modelo_id)
    ap.finalizar(s, r, m.config, c.usuario.id)
    return {**_saida(s, c.obra_id, [r])[0], "texto": _texto(s, c, r, m)}


def _texto(s: Session, c: ContextoObra, r: RegistroAuditoriaModel, m: ModeloAuditoriaModel) -> str:
    from app.modules.obras.infra.models import MarcaObraModel, ObraModel

    obra = s.get(ObraModel, c.obra_id)
    marca = s.get(MarcaObraModel, c.obra_id)
    contratada = marca.nome_contratada if marca else None
    d = ap.como_dict(r)
    return texto_envio(m.config, d, f"{obra.codigo} · {obra.nome}" if obra else None, contratada)


@router.get("/registros/{rid}/texto")
def texto(rid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Texto pronto para o WhatsApp (rótulos e emojis do modelo)."""
    r = _registro(s, c, rid)
    return {"texto": _texto(s, c, r, s.get(ModeloAuditoriaModel, r.modelo_id))}
