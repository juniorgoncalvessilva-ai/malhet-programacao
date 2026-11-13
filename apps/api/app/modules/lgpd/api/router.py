"""LGPD (spec 074): termo de consentimento do colaborador, aceites (colhidos no celular, também sem internet), revogação,
evidências das assinaturas (foto facial só com aceite, localização, hash) e o relatório para auditoria com o registro de
quem abriu cada foto."""
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile
from pydantic import BaseModel, ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, administrar, ler, negar
from app.core.db import get_session
from app.modules.campo.domain.foto import LIMITE, tipo_da_imagem
from app.modules.efetivo.infra.models import ColaboradorModel
from app.modules.lgpd.domain.termo import (FINALIDADES, consentimento, hash_evidencia, hash_texto, normalizar_escolhas,
                                           texto_padrao, validar_geo, validar_termo)
from app.modules.lgpd.infra.models import AceiteLgpdModel, AcessoEvidenciaModel, EvidenciaAssinaturaModel, TermoLgpdModel
from app.modules.obras.domain.obra import PapelObra
from app.shared.errors import DomainError, NotFoundError
from app.shared.offline import validar_id_local

router = APIRouter(prefix="/lgpd", tags=["LGPD: consentimento e evidências"])
FORA = ("DESMOBILIZADO", "DESISTENCIA")
ORIGENS = ("etilometro_teste", "etilometro_inicio", "etilometro_fim", "lgpd_aceite")
MEIOS = ("facial", "nfc", "qr", "codigo", "desenho", "manual")


async def colher(c: ContextoObra = Depends(ler)) -> ContextoObra:
    """Colher aceite e assinaturas no campo: a segurança e do encarregado para cima."""
    if not (c.papel.pode(PapelObra.ENCARREGADO) or c.papel == PapelObra.SEGURANCA):
        raise negar("seu papel não colhe assinaturas")
    return c


async def auditar_lgpd(c: ContextoObra = Depends(ler)) -> ContextoObra:
    """Ver aceites, fotos das assinaturas e o relatório: segurança, planejamento e administração da obra."""
    if not (c.papel.pode(PapelObra.PLANEJADOR) or c.papel == PapelObra.SEGURANCA):
        raise negar("só a segurança, o planejamento e a administração veem os dados de LGPD")
    return c


# ---- termo ----
def termo_vigente(s: Session, obra_id: int) -> TermoLgpdModel:
    t = s.scalar(select(TermoLgpdModel).where(TermoLgpdModel.obra_id == obra_id, TermoLgpdModel.vigente.is_(True))
                 .order_by(TermoLgpdModel.versao.desc()))
    if t is not None:
        return t
    from app.modules.obras.infra.models import MarcaObraModel, ObraModel

    obra = s.get(ObraModel, obra_id)
    marca = s.get(MarcaObraModel, obra_id)
    controlador = (marca.nome_contratada if marca and marca.nome_contratada else None) or "a empresa contratada"
    texto = texto_padrao(controlador, f"{obra.codigo} · {obra.nome}" if obra else "", None, None)
    fins = [dict(f) for f in FINALIDADES]
    t = TermoLgpdModel(obra_id=obra_id, versao=1, titulo="Termo de ciência e consentimento — LGPD", texto=texto,
                       finalidades=fins, hash=hash_texto(texto, fins), vigente=True, criado_por="padrão do sistema")
    s.add(t)
    s.flush()
    return t


def _termo_out(t: TermoLgpdModel) -> dict:
    return {"id": t.id, "versao": t.versao, "titulo": t.titulo, "texto": t.texto, "finalidades": t.finalidades, "hash": t.hash,
            "vigente": t.vigente, "criado_por": t.criado_por, "criado_em": t.criado_em.isoformat() if t.criado_em else None}


@router.get("/termo")
def ver_termo(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return _termo_out(termo_vigente(s, c.obra_id))


@router.get("/termos")
def termos(s: Session = Depends(get_session), c: ContextoObra = Depends(auditar_lgpd)):
    termo_vigente(s, c.obra_id)
    return [_termo_out(t) for t in s.scalars(select(TermoLgpdModel).where(TermoLgpdModel.obra_id == c.obra_id)
                                             .order_by(TermoLgpdModel.versao.desc()))]


class TermoIn(BaseModel):
    titulo: str
    texto: str
    finalidades: list[dict] | None = None


@router.post("/termos", status_code=201)
def nova_versao(d: TermoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(administrar)):
    """Nova versão do termo: as anteriores ficam no histórico (o aceite guarda a versão e o hash do texto aceito)."""
    titulo, texto, fins = validar_termo(d.titulo, d.texto, d.finalidades)
    atual = termo_vigente(s, c.obra_id)
    h = hash_texto(texto, fins)
    if h == atual.hash and titulo == atual.titulo:
        raise DomainError("o texto é igual ao da versão vigente")
    atual.vigente = False
    t = TermoLgpdModel(obra_id=c.obra_id, versao=atual.versao + 1, titulo=titulo, texto=texto, finalidades=fins, hash=h,
                       vigente=True, criado_por=c.usuario.email or c.usuario.id)
    s.add(t)
    s.flush()
    return _termo_out(t)


# ---- consentimento por pessoa ----
def consentimentos(s: Session, obra_id: int) -> dict[int, dict]:
    """colaborador → o que vale hoje (biometria, foto da assinatura, localização, situação). Usado pela base do celular."""
    vig = s.scalar(select(func.max(TermoLgpdModel.versao)).where(TermoLgpdModel.obra_id == obra_id, TermoLgpdModel.vigente.is_(True)))
    por: dict[int, list[dict]] = {}
    for a in s.scalars(select(AceiteLgpdModel).where(AceiteLgpdModel.obra_id == obra_id).order_by(AceiteLgpdModel.hora, AceiteLgpdModel.id)):
        por.setdefault(a.colaborador_id, []).append({"versao": a.versao, "escolhas": a.escolhas, "revogado": a.revogado_em is not None})
    return {cid: consentimento(lst, vig).como_dict() for cid, lst in por.items()}


def consentimento_de(s: Session, obra_id: int, colaborador_id: int) -> dict:
    return consentimentos(s, obra_id).get(colaborador_id) or consentimento([], None).como_dict()


class Geo(BaseModel):
    lat: float | None = None
    lng: float | None = None
    precisao: float | None = None


class AceiteIn(BaseModel):
    id_local: str
    colaborador_id: int
    versao: int
    escolhas: dict
    assinatura: dict | None = None
    hora: datetime
    geo: Geo | None = None
    dispositivo: str | None = None


def _aceite_out(a: AceiteLgpdModel) -> dict:
    return {"id": a.id, "id_local": a.id_local, "colaborador_id": a.colaborador_id, "nome": a.nome, "matricula": a.matricula,
            "versao": a.versao, "termo_hash": a.termo_hash, "escolhas": a.escolhas, "hora": a.hora.isoformat(),
            "assinatura": {k: v for k, v in (a.assinatura or {}).items() if k != "desenho"} if a.assinatura else None,
            "tem_desenho": bool((a.assinatura or {}).get("desenho")), "latitude": a.latitude, "longitude": a.longitude,
            "precisao": a.precisao, "dispositivo": a.dispositivo, "coletado_por": a.coletado_por_email, "hash": a.hash,
            "revogado_em": a.revogado_em.isoformat() if a.revogado_em else None, "revogado_por": a.revogado_por,
            "motivo_revogacao": a.motivo_revogacao}


def _assinatura(a: dict | None) -> dict | None:
    if not a:
        return None
    if a.get("meio") not in MEIOS:
        raise DomainError("assinatura: meio inválido", "assinatura")
    out = {"meio": a["meio"], "hora": str(a.get("hora") or "")[:40] or None}
    if a.get("codigo"):
        out["codigo"] = str(a["codigo"])[:60]
    if a["meio"] == "desenho":
        d = str(a.get("desenho") or "")
        if not d.startswith("data:image/") or len(d) > 80_000:
            raise DomainError("assinatura desenhada inválida", "assinatura")
        out["desenho"] = d
    return out


@router.post("/aceites", status_code=201)
def registrar_aceite(d: AceiteIn, s: Session = Depends(get_session), c: ContextoObra = Depends(colher)):
    """Aceite (ou recusa) do termo colhido no aparelho. Repetir o mesmo id_local devolve o já gravado."""
    validar_id_local(d.id_local)
    ja = s.scalar(select(AceiteLgpdModel).where(AceiteLgpdModel.obra_id == c.obra_id, AceiteLgpdModel.id_local == d.id_local))
    if ja is not None:
        return {**_aceite_out(ja), "consentimento": consentimento_de(s, c.obra_id, ja.colaborador_id), "repetido": True}
    p = s.get(ColaboradorModel, d.colaborador_id)
    if p is None or p.obra_id != c.obra_id:
        raise NotFoundError("Colaborador", d.colaborador_id)
    termo_vigente(s, c.obra_id)
    t = s.scalar(select(TermoLgpdModel).where(TermoLgpdModel.obra_id == c.obra_id, TermoLgpdModel.versao == d.versao))
    if t is None:
        raise NotFoundError("Versão do termo", d.versao)
    escolhas = normalizar_escolhas(d.escolhas, t.finalidades)
    ass = _assinatura(d.assinatura)
    if ass is None:
        raise DomainError("o colaborador assina o termo (crachá ou na tela) — também para recusar", "assinatura")
    # localização do aceite só fica se a pessoa autorizou localização
    lat, lng, pr = validar_geo(d.geo.lat, d.geo.lng, d.geo.precisao) if (d.geo and escolhas.get("localizacao")) else (None, None, None)
    meta = {"obra": c.obra_id, "colaborador": p.id, "termo": t.hash, "versao": t.versao, "escolhas": escolhas,
            "assinatura": ass, "hora": d.hora.astimezone(timezone.utc).isoformat(), "geo": [lat, lng, pr], "id_local": d.id_local}
    a = AceiteLgpdModel(obra_id=c.obra_id, id_local=d.id_local, colaborador_id=p.id, nome=p.nome, matricula=p.matricula,
                        termo_id=t.id, versao=t.versao, termo_hash=t.hash, escolhas=escolhas, assinatura=ass, hora=d.hora,
                        latitude=lat, longitude=lng, precisao=pr, dispositivo=(d.dispositivo or "")[:200] or None,
                        coletado_por=c.usuario.id, coletado_por_email=c.usuario.email, hash=hash_evidencia(meta, None))
    s.add(a)
    s.flush()
    # a assinatura do termo também entra no relatório de assinaturas
    ev = EvidenciaAssinaturaModel(
        obra_id=c.obra_id, id_local=f"lgpd-{d.id_local}"[:64], origem="lgpd_aceite", origem_id_local=d.id_local,
        documento=f"Termo LGPD v{t.versao} — {'aceite' if any(escolhas.values()) else 'recusa'}", colaborador_id=p.id, nome=p.nome,
        matricula=p.matricula, meio=ass["meio"], hora=d.hora, latitude=lat, longitude=lng, precisao=pr,
        dispositivo=a.dispositivo, desenho=ass.get("desenho"), hash="", registrado_por=c.usuario.id)
    ev.hash = hash_evidencia(_evid_meta(ev), None)
    s.add(ev)
    if escolhas.get("biometria") is False:
        _apagar_rosto(s, c.obra_id, p.id)
    s.flush()
    if not any(escolhas.values()):
        from app.modules.notificacoes.application import notificar

        notificar(s, c.obra_id, tipo="lgpd", gravidade="atencao", titulo=f"LGPD: {p.nome} recusou o termo v{t.versao}",
                  texto="Segue com crachá ou assinatura na tela, sem foto nem localização.", papeis=["seguranca", "admin"],
                  url="/app/lgpd", autor_id=c.usuario.id, chave=f"lgpd-recusa-{a.id}")
    return {**_aceite_out(a), "consentimento": consentimento_de(s, c.obra_id, p.id), "repetido": False}


def _apagar_rosto(s: Session, obra_id: int, colaborador_id: int) -> bool:
    from app.modules.presenca.infra.models import IdentificacaoModel

    i = s.scalar(select(IdentificacaoModel).where(IdentificacaoModel.obra_id == obra_id, IdentificacaoModel.colaborador_id == colaborador_id))
    if i is not None and i.face_descritor is not None:
        i.face_descritor, i.face_em = None, None
        return True
    return False


class RevogarIn(BaseModel):
    motivo: str | None = None


@router.post("/aceites/{aid}/revogar")
def revogar(aid: int, d: RevogarIn, s: Session = Depends(get_session), c: ContextoObra = Depends(auditar_lgpd)):
    """Revogação a pedido do titular (art. 8º, §5º): vale dali para frente — o rosto cadastrado é apagado e não se colhe
    mais foto nem localização. O que já foi registrado fica como prova, conforme o termo."""
    a = s.get(AceiteLgpdModel, aid)
    if a is None or a.obra_id != c.obra_id:
        raise NotFoundError("Aceite", aid)
    if a.revogado_em:
        raise DomainError("aceite já revogado")
    a.revogado_em, a.revogado_por = datetime.now(timezone.utc), c.usuario.email or c.usuario.id
    a.motivo_revogacao = " ".join((d.motivo or "").split())[:300] or "a pedido do colaborador"
    rosto = _apagar_rosto(s, c.obra_id, a.colaborador_id)
    s.flush()
    from app.modules.notificacoes.application import notificar

    notificar(s, c.obra_id, tipo="lgpd", gravidade="atencao", titulo=f"LGPD: consentimento de {a.nome} revogado",
              texto=a.motivo_revogacao, papeis=["seguranca", "admin"], url="/app/lgpd", autor_id=c.usuario.id, chave=f"lgpd-revoga-{a.id}")
    return {**_aceite_out(a), "rosto_apagado": rosto, "consentimento": consentimento_de(s, c.obra_id, a.colaborador_id)}


@router.get("/colaboradores")
def colaboradores(s: Session = Depends(get_session), c: ContextoObra = Depends(auditar_lgpd)):
    """Situação do consentimento de cada pessoa do efetivo (pendente, aceito, recusado, revogado, desatualizado)."""
    cons = consentimentos(s, c.obra_id)
    ult: dict[int, AceiteLgpdModel] = {}
    for a in s.scalars(select(AceiteLgpdModel).where(AceiteLgpdModel.obra_id == c.obra_id).order_by(AceiteLgpdModel.hora, AceiteLgpdModel.id)):
        ult[a.colaborador_id] = a
    vazio = consentimento([], None).como_dict()
    return [{"id": p.id, "nome": p.nome, "matricula": p.matricula, "funcao": p.funcao, "situacao_efetivo": p.situacao,
             "consentimento": cons.get(p.id, vazio), "ultimo": _aceite_out(ult[p.id]) if p.id in ult else None}
            for p in s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == c.obra_id, ColaboradorModel.situacao.not_in(FORA))
                               .order_by(ColaboradorModel.nome))]


@router.get("/aceites")
def aceites(colaborador_id: int | None = None, s: Session = Depends(get_session), c: ContextoObra = Depends(auditar_lgpd)):
    q = select(AceiteLgpdModel).where(AceiteLgpdModel.obra_id == c.obra_id)
    if colaborador_id:
        q = q.where(AceiteLgpdModel.colaborador_id == colaborador_id)
    return [_aceite_out(a) for a in s.scalars(q.order_by(AceiteLgpdModel.hora.desc()))]


# ---- evidências de assinatura ----
class EvidenciaIn(BaseModel):
    id_local: str
    origem: str
    origem_id_local: str
    colaborador_id: int
    meio: str
    hora: datetime
    distancia: float | None = None
    geo: Geo | None = None
    dispositivo: str | None = None
    documento: str | None = None
    desenho: str | None = None


def _documento(s: Session, obra_id: int, origem: str, origem_id_local: str) -> str | None:
    from app.modules.preventivos.infra.models import EventoPreventivoModel, TestePreventivoModel

    if origem == "etilometro_teste":
        t = s.scalar(select(TestePreventivoModel).where(TestePreventivoModel.obra_id == obra_id, TestePreventivoModel.id_local == origem_id_local))
        e = s.get(EventoPreventivoModel, t.evento_id) if t else None
        return f"Etilômetro Nº {e.numero} · {'contraprova' if t.tentativa == 2 else '1º teste'}" if e else None
    if origem in ("etilometro_inicio", "etilometro_fim"):
        e = s.scalar(select(EventoPreventivoModel).where(EventoPreventivoModel.obra_id == obra_id, EventoPreventivoModel.id_local == origem_id_local))
        return f"Etilômetro Nº {e.numero} · {'início' if origem.endswith('inicio') else 'encerramento'} (responsável)" if e else None
    return None


def _evid_meta(e: EvidenciaAssinaturaModel) -> dict:
    return {"obra": e.obra_id, "id_local": e.id_local, "origem": e.origem, "origem_id_local": e.origem_id_local,
            "colaborador": e.colaborador_id, "meio": e.meio, "hora": e.hora.astimezone(timezone.utc).isoformat() if e.hora else None,
            "distancia": e.distancia, "geo": [e.latitude, e.longitude, e.precisao], "desenho": e.desenho}


@router.post("/evidencias", status_code=201)
async def registrar_evidencia(dados: str = Form(...), foto: UploadFile | None = File(None), s: Session = Depends(get_session),
                              c: ContextoObra = Depends(colher)):
    """Prova de uma assinatura feita no aparelho. A foto só é guardada com o aceite "foto da assinatura" e as coordenadas
    só com o aceite "localização" — sem eles o servidor descarta e anota o motivo. Idempotente pelo id_local."""
    try:
        d = EvidenciaIn.model_validate_json(dados)
    except ValidationError:
        raise DomainError("dados da evidência inválidos", "dados") from None
    validar_id_local(d.id_local)
    ja = s.scalar(select(EvidenciaAssinaturaModel).where(EvidenciaAssinaturaModel.obra_id == c.obra_id, EvidenciaAssinaturaModel.id_local == d.id_local))
    if ja is not None:
        return {**_evid_out(ja), "repetido": True}
    if d.origem not in ORIGENS or d.meio not in MEIOS:
        raise DomainError("origem ou meio da assinatura inválido", "origem")
    p = s.get(ColaboradorModel, d.colaborador_id)
    if p is None or p.obra_id != c.obra_id:
        raise NotFoundError("Colaborador", d.colaborador_id)
    cons = consentimento_de(s, c.obra_id, p.id)
    obs = []
    conteudo, tipo = None, None
    if foto is not None:
        if cons["foto_assinatura"] and d.meio == "facial":
            conteudo = await foto.read(LIMITE + 1)
            tipo = tipo_da_imagem(conteudo)
        else:
            obs.append("foto descartada: sem aceite para foto da assinatura")
    lat = lng = pr = None
    if d.geo and d.geo.lat is not None:
        if cons["localizacao"]:
            lat, lng, pr = validar_geo(d.geo.lat, d.geo.lng, d.geo.precisao)
        else:
            obs.append("localização descartada: sem aceite")
    desenho = d.desenho if d.meio == "desenho" and d.desenho and d.desenho.startswith("data:image/") and len(d.desenho) <= 80_000 else None
    e = EvidenciaAssinaturaModel(
        obra_id=c.obra_id, id_local=d.id_local, origem=d.origem, origem_id_local=d.origem_id_local[:64],
        documento=_documento(s, c.obra_id, d.origem, d.origem_id_local) or (d.documento or "")[:200] or None,
        colaborador_id=p.id, nome=p.nome, matricula=p.matricula, meio=d.meio, hora=d.hora,
        distancia=round(d.distancia, 4) if d.distancia is not None else None, latitude=lat, longitude=lng, precisao=pr,
        dispositivo=(d.dispositivo or "")[:200] or None, desenho=desenho, foto=conteudo, foto_tipo=tipo,
        observacao="; ".join(obs) or None, hash="", registrado_por=c.usuario.id)
    e.hash = hash_evidencia(_evid_meta(e), conteudo)
    s.add(e)
    s.flush()
    return {**_evid_out(e), "repetido": False}


def _evid_out(e: EvidenciaAssinaturaModel, integra: bool | None = None) -> dict:
    return {"id": e.id, "id_local": e.id_local, "origem": e.origem, "origem_id_local": e.origem_id_local, "documento": e.documento,
            "colaborador_id": e.colaborador_id, "nome": e.nome, "matricula": e.matricula, "meio": e.meio, "hora": e.hora.isoformat(),
            "distancia": e.distancia, "latitude": e.latitude, "longitude": e.longitude, "precisao": e.precisao,
            "dispositivo": e.dispositivo, "tem_foto": bool(e.foto_tipo), "desenho": e.desenho, "observacao": e.observacao,
            "hash": e.hash, "integra": integra, "recebido_em": e.recebido_em.isoformat() if e.recebido_em else None}


@router.get("/evidencias")
def evidencias(de: date | None = None, ate: date | None = None, origem: str | None = None, colaborador_id: int | None = None,
               s: Session = Depends(get_session), c: ContextoObra = Depends(auditar_lgpd)):
    """Relatório de assinaturas: cada uma com a conferência do hash (íntegra = nada mudou desde que chegou)."""
    q = select(EvidenciaAssinaturaModel).where(EvidenciaAssinaturaModel.obra_id == c.obra_id)
    if de:
        q = q.where(EvidenciaAssinaturaModel.hora >= datetime.combine(de, time.min, timezone(timedelta(hours=-3))))
    if ate:
        q = q.where(EvidenciaAssinaturaModel.hora < datetime.combine(ate + timedelta(days=1), time.min, timezone(timedelta(hours=-3))))
    if origem:
        q = q.where(EvidenciaAssinaturaModel.origem.in_(origem.split(",")))
    if colaborador_id:
        q = q.where(EvidenciaAssinaturaModel.colaborador_id == colaborador_id)
    out = []
    for e in s.scalars(q.order_by(EvidenciaAssinaturaModel.hora.desc()).limit(2000)):
        foto = e.foto if e.foto_tipo else None
        out.append(_evid_out(e, hash_evidencia(_evid_meta(e), foto) == e.hash))
    return out


def _evidencia(s: Session, c: ContextoObra, eid: int) -> EvidenciaAssinaturaModel:
    e = s.get(EvidenciaAssinaturaModel, eid)
    if e is None or e.obra_id != c.obra_id:
        raise NotFoundError("Assinatura", eid)
    return e


@router.get("/evidencias/{eid}/foto")
def foto(eid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(auditar_lgpd)):
    """A foto do reconhecimento facial no momento da assinatura. Cada abertura fica registrada."""
    e = _evidencia(s, c, eid)
    if not e.foto_tipo:
        raise NotFoundError("Foto da assinatura", eid)
    s.add(AcessoEvidenciaModel(obra_id=c.obra_id, evidencia_id=e.id, acao="ver_foto", usuario_id=c.usuario.id, email=c.usuario.email))
    return Response(e.foto, media_type=e.foto_tipo, headers={"Cache-Control": "private, no-store"})


class RelatorioIn(BaseModel):
    filtro: str | None = None


@router.post("/evidencias/relatorio")
def registrar_relatorio(d: RelatorioIn, s: Session = Depends(get_session), c: ContextoObra = Depends(auditar_lgpd)):
    """Quem imprimiu/gerou o relatório de assinaturas (e com qual filtro) fica no registro de acessos."""
    s.add(AcessoEvidenciaModel(obra_id=c.obra_id, evidencia_id=None, acao="relatorio", usuario_id=c.usuario.id,
                               email=(c.usuario.email or "")[:120] + (f" · {d.filtro[:20]}" if d.filtro else "")))
    return {"ok": True}


@router.get("/acessos")
def acessos(s: Session = Depends(get_session), c: ContextoObra = Depends(auditar_lgpd)):
    rows = s.execute(select(AcessoEvidenciaModel, EvidenciaAssinaturaModel.nome, EvidenciaAssinaturaModel.documento)
                     .outerjoin(EvidenciaAssinaturaModel, EvidenciaAssinaturaModel.id == AcessoEvidenciaModel.evidencia_id)
                     .where(AcessoEvidenciaModel.obra_id == c.obra_id).order_by(AcessoEvidenciaModel.em.desc()).limit(500))
    return [{"id": a.id, "acao": a.acao, "email": a.email, "em": a.em.isoformat(), "evidencia_id": a.evidencia_id,
             "colaborador": nome, "documento": doc} for a, nome, doc in rows]


@router.get("/minhas-coletas")
def minhas(s: Session = Depends(get_session), c: ContextoObra = Depends(colher)):
    """Para o celular: quantos aceites/recusas o aparelho já enviou hoje (conferência rápida)."""
    hoje = datetime.now(timezone(timedelta(hours=-3))).date()
    q = select(func.count()).select_from(AceiteLgpdModel).where(
        AceiteLgpdModel.obra_id == c.obra_id, AceiteLgpdModel.coletado_por == c.usuario.id,
        AceiteLgpdModel.hora >= datetime.combine(hoje, time.min, timezone(timedelta(hours=-3))))
    return {"hoje": s.scalar(q) or 0}

