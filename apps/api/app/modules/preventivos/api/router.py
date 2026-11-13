"""Controle preventivo — etilômetro (spec 073): configuração (faixas, contraprova), aparelhos, eventos (sessões de teste
com fotos do aparelho/calibração e o responsável que assina no início e no fim) e testes assinados pelo colaborador.
Tudo é feito no tablet/celular sem internet e sobe pela fila do aparelho: cada envio tem `id_local` e repetir não duplica."""
import json
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel, ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, negar, ssma
from app.core.db import get_session
from app.modules.campo.domain.foto import LIMITE, tipo_da_imagem
from app.modules.campo.infra.models import FotoCampoModel
from app.modules.efetivo.infra.models import ColaboradorModel
from app.modules.obras.domain.obra import PapelObra
from app.modules.preventivos.domain.etilometro import (CONFIG_PADRAO, classificar, conferir_aparelho, pede_contraprova,
                                                       situacao_final, validar_assinatura, validar_config)
from app.modules.preventivos.infra.models import (AparelhoModel, ConfigPreventivoModel, EventoPreventivoModel,
                                                  TestePreventivoModel)
from app.shared.errors import DomainError, NotFoundError
from app.shared.offline import validar_id_local

router = APIRouter(prefix="/preventivos", tags=["controle preventivo (etilômetro)"])


async def aplicar(c: ContextoObra = Depends(ler)) -> ContextoObra:
    """Aplicar o teste: a segurança (enfermagem/técnico) e do encarregado para cima."""
    if not (c.papel.pode(PapelObra.ENCARREGADO) or c.papel == PapelObra.SEGURANCA):
        raise negar("seu papel só consulta o controle preventivo")
    return c


def _config(s: Session, obra_id: int) -> dict:
    m = s.scalar(select(ConfigPreventivoModel).where(ConfigPreventivoModel.obra_id == obra_id, ConfigPreventivoModel.tipo == "etilometro"))
    return m.config if m else validar_config(CONFIG_PADRAO)


@router.get("/etilometro/config")
def ver_config(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return _config(s, c.obra_id)


@router.put("/etilometro/config")
def salvar_config(cfg: dict, s: Session = Depends(get_session), c: ContextoObra = Depends(ssma)):
    v = validar_config(cfg)
    m = s.scalar(select(ConfigPreventivoModel).where(ConfigPreventivoModel.obra_id == c.obra_id, ConfigPreventivoModel.tipo == "etilometro"))
    if m is None:
        m = ConfigPreventivoModel(obra_id=c.obra_id, tipo="etilometro", config=v)
        s.add(m)
    m.config, m.atualizado_por = v, c.usuario.id
    s.flush()
    return v


# ---- aparelhos ----
class AparelhoIn(BaseModel):
    marca: str
    modelo: str
    numero_serie: str | None = None
    calibracao_em: date | None = None
    validade: date | None = None
    ativo: bool = True


def _aparelho_out(a: AparelhoModel) -> dict:
    hoje = date.today()
    return {"id": a.id, "marca": a.marca, "modelo": a.modelo, "numero_serie": a.numero_serie,
            "calibracao_em": a.calibracao_em.isoformat() if a.calibracao_em else None,
            "validade": a.validade.isoformat() if a.validade else None, "ativo": a.ativo,
            "vencido": a.validade is None or a.validade < hoje}


def _validar_aparelho(d: AparelhoIn) -> None:
    if not d.marca.strip() or not d.modelo.strip():
        raise DomainError("informe marca e modelo do aparelho", "marca")
    if d.validade is None:
        raise DomainError("informe a validade da calibração", "validade")
    if d.calibracao_em and d.validade < d.calibracao_em:
        raise DomainError("validade antes da data de calibração", "validade")


@router.get("/etilometro/aparelhos")
def aparelhos(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return [_aparelho_out(a) for a in s.scalars(select(AparelhoModel).where(AparelhoModel.obra_id == c.obra_id)
                                                .order_by(AparelhoModel.ativo.desc(), AparelhoModel.marca, AparelhoModel.modelo))]


@router.post("/etilometro/aparelhos", status_code=201)
def criar_aparelho(d: AparelhoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(ssma)):
    _validar_aparelho(d)
    a = AparelhoModel(obra_id=c.obra_id, **{**d.model_dump(), "marca": d.marca.strip(), "modelo": d.modelo.strip()})
    s.add(a)
    s.flush()
    return _aparelho_out(a)


def _aparelho(s: Session, obra_id: int, aid: int) -> AparelhoModel:
    a = s.get(AparelhoModel, aid)
    if a is None or a.obra_id != obra_id:
        raise NotFoundError("Aparelho", aid)
    return a


@router.put("/etilometro/aparelhos/{aid}")
def editar_aparelho(aid: int, d: AparelhoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(ssma)):
    _validar_aparelho(d)
    a = _aparelho(s, c.obra_id, aid)
    for k, v in d.model_dump().items():
        setattr(a, k, v.strip() if isinstance(v, str) else v)
    s.flush()
    return _aparelho_out(a)


@router.delete("/etilometro/aparelhos/{aid}", status_code=204)
def excluir_aparelho(aid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ssma)):
    a = _aparelho(s, c.obra_id, aid)
    if s.scalar(select(func.count()).select_from(EventoPreventivoModel).where(EventoPreventivoModel.aparelho_id == aid)):
        raise DomainError("aparelho já usado em eventos: desative em vez de excluir (o histórico guarda os dados dele)")
    s.delete(a)


# ---- eventos e testes (vindos da fila do aparelho) ----
class AssinaturaIn(BaseModel):
    meio: str
    hora: str | None = None
    distancia: float | None = None
    desenho: str | None = None
    codigo: str | None = None


class EventoIn(BaseModel):
    id_local: str
    data: date
    aparelho_id: int
    responsavel_id: int
    assinatura: AssinaturaIn
    iniciado_em: datetime
    local: str | None = None


def _evento_out(s: Session, e: EventoPreventivoModel, testes: list[TestePreventivoModel] | None = None, detalhe: bool = False) -> dict:
    if testes is None:
        testes = list(s.scalars(select(TestePreventivoModel).where(TestePreventivoModel.evento_id == e.id)
                                .order_by(TestePreventivoModel.hora)))
    por: dict[int | str, list[dict]] = {}
    lista = []
    for t in testes:
        d = {"id": t.id, "id_local": t.id_local, "colaborador_id": t.colaborador_id, "nome": t.nome, "matricula": t.matricula,
             "funcao": t.funcao, "tentativa": t.tentativa, "valor": float(t.valor) if t.valor is not None else None, "recusa": t.recusa,
             "resultado": t.resultado, "faixa": t.faixa, "penalidade": t.penalidade, "hora": t.hora.isoformat(), "leitura": t.leitura,
             "assinatura": ({k: v for k, v in (t.assinatura or {}).items() if k != "desenho" or detalhe} if t.assinatura else None)}
        lista.append(d)
        por.setdefault(t.colaborador_id or t.nome, []).append(d)
    finais = {k: situacao_final(v) for k, v in por.items()}
    out = {"id": e.id, "numero": e.numero, "id_local": e.id_local, "data": e.data.isoformat(), "local": e.local, "status": e.status,
           "aparelho": e.aparelho, "responsavel_id": e.responsavel_id, "responsavel": e.responsavel_nome,
           "iniciado_em": e.iniciado_em.isoformat(), "encerrado_em": e.encerrado_em.isoformat() if e.encerrado_em else None,
           "assinatura_inicio": {k: v for k, v in e.assinatura_inicio.items() if k != "desenho" or detalhe},
           "assinatura_fim": ({k: v for k, v in e.assinatura_fim.items() if k != "desenho" or detalhe} if e.assinatura_fim else None),
           "criado_por": e.criado_por_email, "observacao": e.observacao,
           "resumo": {"pessoas": len(finais), "testes": len(lista),
                      "aprovados": sum(1 for f in finais.values() if f["resultado"] == "aprovado" and not f["contraprova_pendente"]),
                      "reprovados": sum(1 for f in finais.values() if f["resultado"] == "reprovado" and not f["contraprova_pendente"]),
                      "recusas": sum(1 for v in por.values() if v[-1]["recusa"]),
                      "contraprovas": sum(1 for t in lista if t["tentativa"] == 2),
                      "contraprova_pendente": sum(1 for f in finais.values() if f["contraprova_pendente"])}}
    if detalhe:
        out["config"] = e.config
        out["testes"] = lista
        out["pessoas"] = [{"chave": str(k), "nome": v[0]["nome"], "matricula": v[0]["matricula"], "funcao": v[0]["funcao"], **finais[k]}
                          for k, v in por.items()]
        out["fotos"] = [{"id": f.id, "momento": f.legenda} for f in s.execute(
            select(FotoCampoModel.id, FotoCampoModel.legenda).where(FotoCampoModel.obra_id == e.obra_id, FotoCampoModel.alvo == "evento",
                                                                    FotoCampoModel.alvo_id == e.id).order_by(FotoCampoModel.id))]
    return out


def _evento_por_local(s: Session, obra_id: int, id_local: str) -> EventoPreventivoModel | None:
    return s.scalar(select(EventoPreventivoModel).where(EventoPreventivoModel.obra_id == obra_id, EventoPreventivoModel.id_local == id_local))


@router.post("/etilometro/eventos", status_code=201)
async def abrir_evento(dados: str = Form(...), momentos: str = Form("[]"), fotos: list[UploadFile] = File(default=[]),
                       s: Session = Depends(get_session), c: ContextoObra = Depends(aplicar)):
    """Início do evento: aparelho com calibração válida, fotos do aparelho e da calibração (com carimbo) e o responsável
    identificado pelo crachá. Tudo ou nada; repetir o mesmo id_local devolve o evento já aberto."""
    try:
        d = EventoIn.model_validate_json(dados)
        ms = json.loads(momentos)
    except (ValidationError, ValueError):
        raise DomainError("dados do evento inválidos", "dados") from None
    validar_id_local(d.id_local)
    ja = _evento_por_local(s, c.obra_id, d.id_local)
    if ja is not None:
        return {**_evento_out(s, ja), "repetido": True}
    if not isinstance(ms, list) or len(ms) != len(fotos) or any(x not in ("aparelho", "calibracao") for x in ms):
        raise DomainError("cada foto diz se é do aparelho ou da calibração", "momentos")
    if "aparelho" not in ms or "calibracao" not in ms:
        raise DomainError("tire a foto do aparelho e a da etiqueta/data de calibração", "fotos")
    a = _aparelho(s, c.obra_id, d.aparelho_id)
    conferir_aparelho(a.calibracao_em, a.validade, d.data)
    resp = s.get(ColaboradorModel, d.responsavel_id)
    if resp is None or resp.obra_id != c.obra_id:
        raise NotFoundError("Responsável", d.responsavel_id)
    numero = (s.scalar(select(func.max(EventoPreventivoModel.numero)).where(EventoPreventivoModel.obra_id == c.obra_id)) or 0) + 1
    e = EventoPreventivoModel(
        obra_id=c.obra_id, tipo="etilometro", numero=numero, id_local=d.id_local, data=d.data, local=(d.local or "").strip()[:200] or None,
        aparelho_id=a.id, aparelho=_aparelho_out(a) | {"vencido": False}, config=_config(s, c.obra_id),
        responsavel_id=resp.id, responsavel_nome=resp.nome, assinatura_inicio=validar_assinatura(d.assinatura.model_dump(), "assinatura do responsável"),
        iniciado_em=d.iniciado_em, status="aberto", criado_por=c.usuario.id, criado_por_email=c.usuario.email)
    s.add(e)
    s.flush()
    for arq, momento in zip(fotos, ms):
        conteudo = await arq.read(LIMITE + 1)
        s.add(FotoCampoModel(obra_id=c.obra_id, alvo="evento", alvo_id=e.id, data=d.data, legenda=momento,
                             content_type=tipo_da_imagem(conteudo), tamanho=len(conteudo), conteudo=conteudo, enviado_por=c.usuario.id))
    s.flush()
    return {**_evento_out(s, e, []), "repetido": False}


class TesteIn(BaseModel):
    id_local: str
    evento_id_local: str
    colaborador_id: int
    tentativa: int = 1
    valor: float | None = None
    recusa: bool = False
    hora: datetime
    leitura: str | None = None
    assinatura: AssinaturaIn | None = None


@router.post("/etilometro/testes", status_code=201)
def registrar_teste(d: TesteIn, s: Session = Depends(get_session), c: ContextoObra = Depends(aplicar)):
    """Um teste (ou a contraprova) de um colaborador. A classificação vale pela configuração do evento; o colaborador
    assina (rosto, crachá ou na tela) — só a recusa pode ficar sem assinatura dele."""
    validar_id_local(d.id_local)
    ja = s.scalar(select(TestePreventivoModel).where(TestePreventivoModel.obra_id == c.obra_id, TestePreventivoModel.id_local == d.id_local))
    e = _evento_por_local(s, c.obra_id, d.evento_id_local)
    if e is None:
        raise NotFoundError("Evento", d.evento_id_local)
    if ja is not None:
        return {"teste": _evento_out(s, e, [ja], detalhe=True)["testes"][0],
                "contraprova": pede_contraprova(ja.tentativa, ja.resultado, ja.recusa), "repetido": True}
    if d.tentativa not in (1, 2):
        raise DomainError("tentativa: 1 (teste) ou 2 (contraprova)", "tentativa")
    p = s.get(ColaboradorModel, d.colaborador_id)
    if p is None or p.obra_id != c.obra_id:
        raise NotFoundError("Colaborador", d.colaborador_id)
    anteriores = list(s.scalars(select(TestePreventivoModel).where(TestePreventivoModel.evento_id == e.id,
                                                                    TestePreventivoModel.colaborador_id == p.id)))
    if d.tentativa == 2 and not any(pede_contraprova(t.tentativa, t.resultado, t.recusa) for t in anteriores):
        raise DomainError("contraprova só depois de um teste reprovado", "tentativa")
    if d.tentativa == 1 and any(t.tentativa == 1 for t in anteriores):
        raise DomainError(f"{p.nome} já fez o teste neste evento", "colaborador_id")
    cls = classificar(e.config, d.valor, d.recusa)
    if d.assinatura is None and not d.recusa:
        raise DomainError("o colaborador assina o resultado (rosto, crachá ou na tela)", "assinatura")
    t = TestePreventivoModel(
        obra_id=c.obra_id, evento_id=e.id, id_local=d.id_local, colaborador_id=p.id, nome=p.nome, matricula=p.matricula, funcao=p.funcao,
        tentativa=d.tentativa, valor=cls["valor"], recusa=d.recusa, resultado=cls["resultado"], faixa=cls["faixa"],
        penalidade=cls["penalidade"] or None, hora=d.hora, leitura=(d.leitura or "")[:10] or None,
        assinatura=validar_assinatura(d.assinatura.model_dump()) if d.assinatura else None, registrado_por=c.usuario.id)
    s.add(t)
    s.flush()
    if t.recusa or (t.tentativa == 2 and t.resultado == "reprovado"):
        from app.modules.notificacoes.application import SEGURANCA, notificar

        notificar(s, c.obra_id, tipo="etilometro", gravidade="critico",
                  titulo=f"Etilômetro: {t.nome} — {'recusou o teste' if t.recusa else 'reprovado na contraprova'}",
                  texto=f"{t.faixa}{f' · {float(t.valor):.2f} mg/L'.replace('.', ',') if t.valor is not None else ''} · evento Nº {e.numero}"
                        f"{f' · {t.penalidade}' if t.penalidade else ''}",
                  papeis=SEGURANCA, url="/app/preventivos", url_mobile="/m/preventivos", autor_id=c.usuario.id, chave=f"etil-{t.id}")
    return {"teste": _evento_out(s, e, [t], detalhe=True)["testes"][0],
            "contraprova": pede_contraprova(t.tentativa, t.resultado, t.recusa), "repetido": False}


class EncerrarIn(BaseModel):
    assinatura: AssinaturaIn
    encerrado_em: datetime
    observacao: str | None = None


@router.post("/etilometro/eventos/{id_local}/encerrar")
def encerrar(id_local: str, d: EncerrarIn, s: Session = Depends(get_session), c: ContextoObra = Depends(aplicar)):
    e = _evento_por_local(s, c.obra_id, id_local)
    if e is None:
        raise NotFoundError("Evento", id_local)
    if e.status == "encerrado":
        return {**_evento_out(s, e), "repetido": True}
    e.assinatura_fim = validar_assinatura(d.assinatura.model_dump(), "assinatura de encerramento")
    e.encerrado_em, e.status = d.encerrado_em, "encerrado"
    e.observacao = (d.observacao or "").strip()[:2000] or None
    s.flush()
    return {**_evento_out(s, e), "repetido": False}


@router.get("/etilometro/eventos")
def eventos(de: date | None = None, ate: date | None = None, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    q = select(EventoPreventivoModel).where(EventoPreventivoModel.obra_id == c.obra_id)
    if de:
        q = q.where(EventoPreventivoModel.data >= de)
    if ate:
        q = q.where(EventoPreventivoModel.data <= ate)
    evs = list(s.scalars(q.order_by(EventoPreventivoModel.data.desc(), EventoPreventivoModel.numero.desc())))
    testes: dict[int, list[TestePreventivoModel]] = {}
    if evs:
        for t in s.scalars(select(TestePreventivoModel).where(TestePreventivoModel.evento_id.in_([e.id for e in evs]))
                           .order_by(TestePreventivoModel.hora)):
            testes.setdefault(t.evento_id, []).append(t)
    return [_evento_out(s, e, testes.get(e.id, [])) for e in evs]


@router.get("/etilometro/eventos/{eid}")
def evento(eid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    e = s.get(EventoPreventivoModel, eid)
    if e is None or e.obra_id != c.obra_id:
        raise NotFoundError("Evento", eid)
    return _evento_out(s, e, detalhe=True)
