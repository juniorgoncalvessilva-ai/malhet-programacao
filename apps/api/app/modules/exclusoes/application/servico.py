"""Casos de uso da exclusão com autoridade (spec 112). Cada exclusão grava a cópia do que saiu antes de apagar."""
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.exclusoes.domain.exclusao import exigir, resumo_auditoria, resumo_foto, validar_motivo
from app.modules.exclusoes.infra.models import PermissaoExclusaoModel, RegistroExclusaoModel
from app.shared.errors import DomainError, NotFoundError


def _json(v):
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    if isinstance(v, dict):
        return {k: _json(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_json(x) for x in v]
    return v


def habilitado(s: Session, obra_id: int, usuario_id: str) -> bool:
    return bool(s.scalar(select(PermissaoExclusaoModel.id).where(
        PermissaoExclusaoModel.obra_id == obra_id, PermissaoExclusaoModel.usuario_id == usuario_id,
        PermissaoExclusaoModel.ativo.is_(True))))


def registrar(s: Session, obra_id: int, tipo: str, referencia: str | None, resumo: str, dados: dict | None,
              motivo: str | None, por: str, por_email: str | None) -> RegistroExclusaoModel:
    r = RegistroExclusaoModel(obra_id=obra_id, tipo=tipo, referencia=referencia, resumo=resumo[:300], dados=_json(dados),
                              motivo=motivo, por=por, por_email=por_email)
    s.add(r)
    return r


def _foto_dados(f) -> dict:
    return {"id": f.id, "alvo": f.alvo, "alvo_id": f.alvo_id, "data": f.data, "legenda": f.legenda,
            "content_type": f.content_type, "tamanho": f.tamanho, "enviado_por": f.enviado_por, "enviado_em": f.enviado_em,
            "arquivo_id": f.arquivo_id}


def _apagar_foto(s: Session, f) -> None:
    from app.modules.arquivos.application.servico import apagar
    from app.modules.arquivos.infra.models import ArquivoModel

    a = s.get(ArquivoModel, f.arquivo_id) if f.arquivo_id else None
    s.delete(f)
    s.flush()
    if a is not None:
        apagar(s, a)


def excluir_foto(s: Session, obra_id: int, fid: int, motivo: str | None, usuario_id: str, email: str | None, superadmin: bool) -> None:
    from app.modules.campo.infra.models import FotoCampoModel

    exigir(superadmin, habilitado(s, obra_id, usuario_id))
    m = validar_motivo(motivo)
    f = s.get(FotoCampoModel, fid)
    if f is None or f.obra_id != obra_id:
        raise NotFoundError("foto", fid)
    registrar(s, obra_id, "foto", str(f.id), resumo_foto(f.alvo, f.legenda, f.data.strftime("%d/%m/%Y") if f.data else None),
              _foto_dados(f), m, usuario_id, email)
    _apagar_foto(s, f)


def excluir_auditoria(s: Session, obra_id: int, rid: int, motivo: str | None, usuario_id: str, email: str | None,
                      superadmin: bool) -> dict:
    """Sai o registro e as fotos dele (antes/depois). A ação 5W2H aberta por ele continua (é trabalho em andamento):
    perde o vínculo e ganha a nota "auditoria excluída"."""
    from app.modules.acoes.infra.models import AcaoModel
    from app.modules.auditorias.application import como_dict
    from app.modules.auditorias.infra.models import ModeloAuditoriaModel, RegistroAuditoriaModel
    from app.modules.campo.infra.models import FotoCampoModel

    exigir(superadmin, habilitado(s, obra_id, usuario_id))
    m = validar_motivo(motivo)
    r = s.get(RegistroAuditoriaModel, rid)
    if r is None or r.obra_id != obra_id:
        raise NotFoundError("auditoria", rid)
    modelo = s.get(ModeloAuditoriaModel, r.modelo_id)
    fotos = list(s.scalars(select(FotoCampoModel).where(FotoCampoModel.obra_id == obra_id, FotoCampoModel.alvo == "auditoria",
                                                        FotoCampoModel.alvo_id == r.id)))
    acoes = list(s.scalars(select(AcaoModel).where(AcaoModel.obra_id == obra_id, AcaoModel.origem == "auditoria",
                                                   AcaoModel.origem_id == r.id)))
    if r.acao_id and all(a.id != r.acao_id for a in acoes):
        a = s.get(AcaoModel, r.acao_id)
        if a is not None:
            acoes.append(a)
    dados = {**como_dict(r), "modelo": modelo.nome if modelo else None, "auditor_id": r.auditor_id, "criado_em": r.criado_em,
             "enviado_em": r.enviado_em, "fotos": [_foto_dados(f) for f in fotos],
             "acoes_mantidas": [{"id": a.id, "numero": a.numero} for a in acoes]}
    registrar(s, obra_id, "auditoria", str(r.id),
              resumo_auditoria(r.numero, modelo.nome if modelo else None, r.data.strftime("%d/%m/%Y") if r.data else None,
                               r.local or r.area_texto), dados, m, usuario_id, email)
    for a in acoes:
        a.origem_id = None
        a.origem_texto = f"{(a.origem_texto or f'Auditoria Nº {r.numero}')[:150]} — auditoria excluída"[:200]
    r.acao_id = None
    s.flush()
    for f in fotos:
        _apagar_foto(s, f)
    s.delete(r)
    s.flush()
    return {"fotos": len(fotos), "acoes_mantidas": len(acoes)}


def permissoes(s: Session, obra_id: int) -> list[dict]:
    from app.modules.obras.infra.models import AcessoObraModel

    hab = {p.usuario_id: p for p in s.scalars(select(PermissaoExclusaoModel).where(PermissaoExclusaoModel.obra_id == obra_id))}
    out = []
    for a in s.scalars(select(AcessoObraModel).where(AcessoObraModel.obra_id == obra_id).order_by(AcessoObraModel.email)):
        p = hab.get(a.usuario_id)
        out.append({"usuario_id": a.usuario_id, "email": a.email, "papel": a.papel, "habilitado": bool(p and p.ativo),
                    "desde": p.concedido_em.isoformat() if p and p.ativo else None, "por": p.concedido_por if p and p.ativo else None})
    return out


def definir_permissao(s: Session, obra_id: int, usuario_id: str, habilitar: bool, por: str, por_email: str | None,
                      superadmin: bool) -> None:
    from app.modules.obras.infra.models import AcessoObraModel

    if not superadmin:
        raise DomainError("só o super admin habilita quem pode excluir")
    acesso = s.scalar(select(AcessoObraModel).where(AcessoObraModel.obra_id == obra_id, AcessoObraModel.usuario_id == usuario_id))
    if acesso is None:
        raise NotFoundError("usuário da obra", usuario_id)
    p = s.scalar(select(PermissaoExclusaoModel).where(PermissaoExclusaoModel.obra_id == obra_id,
                                                      PermissaoExclusaoModel.usuario_id == usuario_id))
    if habilitar == bool(p and p.ativo):
        return
    if p is None:
        p = PermissaoExclusaoModel(obra_id=obra_id, usuario_id=usuario_id, email=acesso.email, concedido_por=por_email or por)
        s.add(p)
    p.ativo, p.email, p.concedido_por, p.concedido_em = habilitar, acesso.email, por_email or por, datetime.now().astimezone()
    registrar(s, obra_id, "permissao", usuario_id,
              f"{'Habilitou' if habilitar else 'Desabilitou'} {acesso.email} para excluir auditorias e fotos do book",
              {"usuario_id": usuario_id, "email": acesso.email, "papel": acesso.papel, "habilitado": habilitar}, None, por, por_email)
    s.flush()


def historico(s: Session, obra_id: int, tipo: str | None, limite: int = 300) -> list[dict]:
    q = select(RegistroExclusaoModel).where(RegistroExclusaoModel.obra_id == obra_id)
    if tipo:
        q = q.where(RegistroExclusaoModel.tipo == tipo)
    return [{"id": r.id, "tipo": r.tipo, "referencia": r.referencia, "resumo": r.resumo, "motivo": r.motivo,
             "por": r.por_email or r.por, "em": r.em.isoformat(), "dados": r.dados}
            for r in s.scalars(q.order_by(RegistroExclusaoModel.id.desc()).limit(max(1, min(limite, 2000))))]
