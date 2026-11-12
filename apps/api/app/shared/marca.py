"""Marca da obra nos documentos: logos (contratada e contratante, ou a do Malhet) e a cor do cliente.

Os exportadores recebem uma `Marca` (sem I/O dentro deles): `marca_da_obra` lê do banco; `inserir_logos` põe as
imagens numa planilha (openpyxl + Pillow); `cor_excel` dá a cor no formato do Excel com a cor padrão de cada documento.
"""
import re
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from app.shared.errors import DomainError

MALHET_PNG = (Path(__file__).parent / "assets" / "malhet.png").read_bytes()
LIMITE_LOGO = 2 * 1024 * 1024


@dataclass(frozen=True)
class Marca:
    cor: str | None = None  # #RRGGBB (None = cores padrão do documento)
    logo_contratada: bytes | None = None
    logo_contratante: bytes | None = None

    @property
    def logos(self) -> list[bytes]:
        """Logos para o cabeçalho, na ordem contratante (cliente), contratada; sem nenhuma, a do Malhet."""
        out = [x for x in (self.logo_contratante, self.logo_contratada) if x]
        return out or [MALHET_PNG]


def validar_cor(cor: str | None) -> str | None:
    c = (cor or "").strip()
    if not c:
        return None
    if not re.fullmatch(r"#[0-9A-Fa-f]{6}", c):
        raise DomainError("cor no formato #RRGGBB", "cor")
    return c.upper()


def validar_logo(conteudo: bytes) -> str:
    """PNG ou JPEG de verdade, até 2 MB (o Excel não aceita SVG). Devolve o content-type."""
    if not conteudo:
        raise DomainError("arquivo vazio", "arquivo")
    if len(conteudo) > LIMITE_LOGO:
        raise DomainError("logo maior que 2 MB", "arquivo")
    if conteudo.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if conteudo.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    raise DomainError("envie a logo em PNG ou JPG", "arquivo")


def cor_excel(marca: Marca | None, padrao: str) -> str:
    """Cor do cliente para preenchimentos do Excel (RRGGBB); sem cor, a padrão do documento."""
    return marca.cor.lstrip("#").upper() if marca and marca.cor else padrao


def inserir_logos(ws, marca: Marca | None, ancoras: list[str], altura_px: int = 60) -> None:
    """Põe as logos (contratante, contratada; ou Malhet) nas células indicadas, com a altura dada e proporção mantida."""
    from openpyxl.drawing.image import Image as XlImage
    from PIL import Image

    for conteudo, ancora in zip((marca or Marca()).logos, ancoras):
        with Image.open(BytesIO(conteudo)) as im:
            w, h = im.size
        img = XlImage(BytesIO(conteudo))
        img.height = altura_px
        img.width = round(w * altura_px / h)
        ws.add_image(img, ancora)


def marca_da_obra(s, obra_id: int) -> Marca:
    from app.modules.obras.infra.models import MarcaObraModel

    m = s.get(MarcaObraModel, obra_id)
    if m is None:
        return Marca()
    return Marca(m.cor, m.logo_contratada, m.logo_contratante)
