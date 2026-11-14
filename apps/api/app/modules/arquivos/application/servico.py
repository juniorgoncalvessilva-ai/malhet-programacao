"""Guardar e abrir arquivos da obra (spec 082) — linguagem publicada para os outros módulos.

guardar(): grava no disco (e a miniatura, se for imagem) e cria a ficha; a fila sobe para a nuvem depois.
abrir(): do disco; se o original já saiu do disco, busca no provedor da obra e guarda de novo.
"""
import hashlib
import io
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.modules.arquivos.domain import zettel
from app.modules.arquivos.domain.provedor import ErroProvedor
from app.modules.arquivos.infra import disco
from app.modules.arquivos.infra.models import ArmazenamentoObraModel, ArquivoModel
from app.shared.errors import DomainError

LADO_MINI = 480


def miniatura(dados: bytes) -> bytes | None:
    """JPEG de até 480 px (≈30 KB), na orientação certa (EXIF) — para listas e o book."""
    try:
        from PIL import Image, ImageOps

        with Image.open(io.BytesIO(dados)) as im:
            im = ImageOps.exif_transpose(im)
            im.thumbnail((LADO_MINI, LADO_MINI))
            if im.mode not in ("RGB", "L"):
                im = im.convert("RGB")
            out = io.BytesIO()
            im.save(out, "JPEG", quality=72, optimize=True)
            return out.getvalue()
    except Exception:  # noqa: BLE001  (não é imagem legível: sem miniatura)
        return None


def guardar(s: Session, obra_id: int, dados: bytes, mime: str, tipo: str, *, titulo: str | None = None,
            ligacoes: dict | None = None, origem: str | None = None, nome_original: str | None = None,
            sensivel: bool = False, quando: datetime | None = None) -> ArquivoModel:
    if not dados:
        raise DomainError("arquivo vazio", "arquivo")
    uid = uuid.uuid4().hex
    quando = quando or datetime.now(timezone.utc)
    disco.gravar(obra_id, uid, dados)
    mini = miniatura(dados) if mime.startswith("image/") else None
    if mini:
        disco.gravar(obra_id, uid, mini, mini=True)
    a = ArquivoModel(obra_id=obra_id, uid=uid, tipo=tipo, pasta=zettel.pasta_do_tipo(tipo),
                     nome=zettel.nome_arquivo(tipo, quando, titulo or nome_original, mime, uid, nome_original),
                     nome_original=(nome_original or "")[:200] or None, titulo=(titulo or "")[:300] or None, mime=mime,
                     tamanho=len(dados), sha256=hashlib.sha256(dados).hexdigest(), sensivel=sensivel,
                     ligacoes={k: v for k, v in (ligacoes or {}).items() if v not in (None, "")}, origem=origem,
                     criado_em=quando, no_disco=True, tem_miniatura=bool(mini),
                     situacao="sem_nuvem" if sensivel else "local")
    s.add(a)
    s.flush()
    return a


def abrir(s: Session, a: ArquivoModel, mini: bool = False) -> bytes:
    if mini:
        m = disco.ler(a.obra_id, a.uid, mini=True)
        if m is not None:
            return m
    dados = disco.ler(a.obra_id, a.uid)
    if dados is None:
        dados = _da_nuvem(s, a)
    if mini and a.mime.startswith("image/"):
        m = miniatura(dados)
        if m:
            disco.gravar(a.obra_id, a.uid, m, mini=True)
            a.tem_miniatura = True
            return m
    return dados


def _da_nuvem(s: Session, a: ArquivoModel) -> bytes:
    from app.modules.arquivos.application.conexao import credencial, salvar_credencial
    from app.modules.arquivos.infra.provedores import provedor

    cfg = s.query(ArmazenamentoObraModel).filter_by(obra_id=a.obra_id).one_or_none()
    if not a.ref_remota or cfg is None or cfg.provedor != a.provedor:
        raise DomainError("o arquivo não está mais no servidor nem no provedor de nuvem da obra", "arquivo")
    cred = credencial(cfg)
    try:
        dados = provedor(cfg.provedor).baixar(cred, a.ref_remota)
    except ErroProvedor as e:
        raise DomainError(f"não foi possível buscar o arquivo em {cfg.provedor}: {e}", "arquivo") from e
    finally:
        salvar_credencial(cfg, cred)
    if hashlib.sha256(dados).hexdigest() != a.sha256:
        raise DomainError("o arquivo da nuvem não confere com o original (hash diferente)", "arquivo")
    disco.gravar(a.obra_id, a.uid, dados)  # volta para o cache quente
    a.no_disco = True
    return dados


def apagar(s: Session, a: ArquivoModel) -> None:
    """Tira do servidor (disco + ficha). No acervo da nuvem fica: é histórico da obra."""
    disco.apagar(a.obra_id, a.uid)
    disco.apagar(a.obra_id, a.uid, mini=True)
    s.delete(a)
