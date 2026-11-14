"""Armazenamento da obra (spec 082): conectar Google Drive / OneDrive / Dropbox, ver a fila e o disco, reenviar."""
from datetime import datetime, timezone
from urllib.parse import quote

from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, administrar
from app.core.config import get_settings
from app.core.db import get_session
from app.modules.arquivos.application.conexao import criar_state, ler_state, retorno_oauth
from app.modules.arquivos.domain import zettel
from app.modules.arquivos.domain.provedor import PROVEDORES, ErroProvedor
from app.modules.arquivos.infra import disco
from app.modules.arquivos.infra.models import ArmazenamentoObraModel, ArquivoModel
from app.modules.arquivos.infra.provedores import disponiveis, provedor
from app.modules.arquivos.infra.segredo import cifrar
from app.modules.obras.infra.models import ObraModel
from app.shared.errors import DomainError

router = APIRouter(prefix="/armazenamento", tags=["armazenamento (nuvem)"])


def _cfg(s: Session, obra_id: int) -> ArmazenamentoObraModel | None:
    return s.scalar(select(ArmazenamentoObraModel).where(ArmazenamentoObraModel.obra_id == obra_id))


@router.get("")
def situacao(s: Session = Depends(get_session), c: ContextoObra = Depends(administrar)):
    cfg = _cfg(s, c.obra_id)
    obra = s.get(ObraModel, c.obra_id)
    por = dict(s.execute(select(ArquivoModel.situacao, func.count()).where(ArquivoModel.obra_id == c.obra_id)
                         .group_by(ArquivoModel.situacao)).all())
    bytes_disco = s.scalar(select(func.coalesce(func.sum(ArquivoModel.tamanho), 0)).where(
        ArquivoModel.obra_id == c.obra_id, ArquivoModel.no_disco.is_(True))) or 0
    por_pasta = dict(s.execute(select(ArquivoModel.pasta, func.count()).where(ArquivoModel.obra_id == c.obra_id)
                               .group_by(ArquivoModel.pasta)).all())
    erros = [{"id": a.id, "nome": a.nome, "erro": a.erro, "tentativas": a.tentativas,
              "proxima": a.proxima_tentativa.isoformat() if a.proxima_tentativa else None}
             for a in s.scalars(select(ArquivoModel).where(ArquivoModel.obra_id == c.obra_id, ArquivoModel.situacao == "erro")
                                .order_by(ArquivoModel.id.desc()).limit(20))]
    return {
        "provedores": [{"id": p, "nome": n, "habilitado": h} for p, h in disponiveis().items() for n in [PROVEDORES[p]]],
        "conexao": None if cfg is None else {
            "provedor": cfg.provedor, "nome": PROVEDORES.get(cfg.provedor), "conta": cfg.conta, "ativo": cfg.ativo,
            "situacao": cfg.situacao, "mensagem": cfg.mensagem, "dias_no_disco": cfg.dias_no_disco,
            "conectado_em": cfg.conectado_em.isoformat() if cfg.conectado_em else None,
            "indice_em": cfg.indice_em.isoformat() if cfg.indice_em else None},
        "pasta_da_obra": "/".join([zettel.RAIZ, "obras", zettel.codigo_pasta_obra(obra.codigo, obra.nome)]),
        "pastas": [{"pasta": p, "descricao": d, "arquivos": por_pasta.get(p, 0)} for p, d in zettel.PASTAS.items()],
        "arquivos": {"total": sum(por.values()), "na_nuvem": por.get("enviado", 0), "aguardando": por.get("local", 0),
                     "com_erro": por.get("erro", 0), "so_no_servidor": por.get("sem_nuvem", 0)},
        "disco": {"da_obra": bytes_disco, **disco.uso(), "limite": int(get_settings().arquivos_limite_gb * 1024 ** 3)},
        "erros": erros,
    }


@router.post("/conectar/{prov}")
def conectar(prov: str, s: Session = Depends(get_session), c: ContextoObra = Depends(administrar)):
    """Devolve o endereço do login do provedor; a volta cai em /oauth/{prov}/retorno."""
    p = provedor(prov)
    return {"url": p.url_autorizacao(criar_state(c.obra_id, c.usuario.id, prov), retorno_oauth(prov))}


def _tela(ok: bool, msg: str) -> RedirectResponse:
    destino = f"{get_settings().app_url.rstrip('/')}/pt-BR/app/armazenamento?{'ok' if ok else 'erro'}={quote(msg)}"
    return RedirectResponse(destino, status_code=302)


@router.get("/oauth/{prov}/retorno", include_in_schema=False)
def retorno(prov: str, code: str | None = None, state: str | None = None, error: str | None = None,
            error_description: str | None = None, s: Session = Depends(get_session)):
    """Volta do login (redirecionamento do navegador, sem o token do Malhet): quem e qual obra vêm no `state` assinado."""
    if error or not code or not state:
        return _tela(False, error_description or error or "login cancelado")
    try:
        d = ler_state(state, prov)
        con = provedor(prov).conectar(code, retorno_oauth(prov))
    except (DomainError, ErroProvedor) as e:
        return _tela(False, str(e))
    cfg = _cfg(s, d["o"])
    if cfg is None:
        cfg = ArmazenamentoObraModel(obra_id=d["o"], provedor=prov, token_cifrado="", conectado_por=d["u"])
        s.add(cfg)
    trocou = cfg.provedor != prov or (cfg.conta or "") != (con.conta or "")
    if trocou and cfg.token_cifrado:
        so_na_nuvem = s.scalar(select(func.count()).select_from(ArquivoModel).where(
            ArquivoModel.obra_id == d["o"], ArquivoModel.no_disco.is_(False)))
        if so_na_nuvem:
            return _tela(False, f"{so_na_nuvem} arquivo(s) estão só em {PROVEDORES.get(cfg.provedor)} ({cfg.conta}): "
                                "reconecte a mesma conta ou aumente os dias no disco antes de trocar")
    cfg.provedor, cfg.conta, cfg.token_cifrado = prov, con.conta, cifrar(con.refresh_token)
    cfg.ativo, cfg.situacao, cfg.mensagem = True, "ok", None
    cfg.conectado_por, cfg.conectado_em = d["u"], datetime.now(timezone.utc)
    if trocou:  # outro provedor/conta: pastas novas e tudo sobe de novo para lá
        cfg.pastas, cfg.indice_em = {}, None
        s.execute(ArquivoModel.__table__.update().where(ArquivoModel.obra_id == d["o"], ArquivoModel.sensivel.is_(False),
                                                        ArquivoModel.situacao.in_(("enviado", "erro")))
                  .values(situacao="local", tentativas=0, proxima_tentativa=None, erro=None))
    s.flush()
    return _tela(True, f"{PROVEDORES[prov]} conectado{f' ({con.conta})' if con.conta else ''}")


class ConfigIn(BaseModel):
    ativo: bool = True
    dias_no_disco: int = 30


@router.put("")
def configurar(d: ConfigIn, s: Session = Depends(get_session), c: ContextoObra = Depends(administrar)):
    cfg = _cfg(s, c.obra_id)
    if cfg is None:
        raise DomainError("conecte um provedor antes", "provedor")
    if not 0 <= d.dias_no_disco <= 3650:
        raise DomainError("dias no disco entre 0 e 3650", "dias_no_disco")
    cfg.ativo, cfg.dias_no_disco = d.ativo, d.dias_no_disco
    return {"ativo": cfg.ativo, "dias_no_disco": cfg.dias_no_disco}


@router.delete("", status_code=204)
def desconectar(s: Session = Depends(get_session), c: ContextoObra = Depends(administrar)):
    """Esquece a conexão (o acervo na nuvem fica lá). Só se nenhum original estiver apenas na nuvem — senão o app
    deixaria de abri-los."""
    cfg = _cfg(s, c.obra_id)
    if cfg is None:
        return
    so_na_nuvem = s.scalar(select(func.count()).select_from(ArquivoModel).where(
        ArquivoModel.obra_id == c.obra_id, ArquivoModel.no_disco.is_(False)))
    if so_na_nuvem:
        raise DomainError(f"{so_na_nuvem} arquivo(s) estão só na nuvem: desconectar deixaria de abri-los. Aumente os dias no "
                          "disco e espere eles voltarem, ou conecte outra conta do mesmo provedor", "provedor")
    s.delete(cfg)
    s.execute(ArquivoModel.__table__.update().where(ArquivoModel.obra_id == c.obra_id, ArquivoModel.situacao == "erro")
              .values(situacao="local", tentativas=0, proxima_tentativa=None))


@router.post("/reenviar")
def reenviar(s: Session = Depends(get_session), c: ContextoObra = Depends(administrar)):
    n = s.execute(ArquivoModel.__table__.update().where(ArquivoModel.obra_id == c.obra_id, ArquivoModel.situacao == "erro")
                  .values(tentativas=0, proxima_tentativa=None)).rowcount
    cfg = _cfg(s, c.obra_id)
    if cfg is not None and cfg.situacao == "erro":
        cfg.situacao = "ok"
    return {"arquivos": n}
