"""Leitura e imagem do desenho em DXF (ezdxf, MIT): atributos do carimbo, textos (para as TAGs) e a folha em PDF
(vetorial, zoom sem perder) e PNG (leve, abre em qualquer celular e sem internet). Usa a API de objetos do matplotlib
(sem pyplot), que pode rodar em várias requisições ao mesmo tempo."""
import io
from dataclasses import dataclass, field

import ezdxf
from ezdxf import recover
from ezdxf.addons.drawing import Frontend, RenderContext, config
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
from matplotlib.backends.backend_agg import FigureCanvasAgg
from matplotlib.figure import Figure

from app.modules.documentos.domain.documento import parece_carimbo
from app.shared.errors import DomainError

PNG_DPI = 220  # folha A1 em 16×11 pol → ~3500×2400 px: dá para ler a tabela de ferros com zoom


@dataclass
class Desenho:
    carimbo: dict[str, str] = field(default_factory=dict)
    textos: list[str] = field(default_factory=list)
    folha: str | None = None
    pdf: bytes | None = None
    png: bytes | None = None
    avisos: list[str] = field(default_factory=list)


def _abrir(dxf: bytes):
    try:
        doc, auditor = recover.read(io.BytesIO(dxf))
    except (ezdxf.DXFStructureError, OSError, UnicodeDecodeError) as e:
        raise DomainError("DXF ilegível", "arquivo") from e
    return doc


def _texto(e) -> str:
    try:
        if e.dxftype() == "MTEXT":
            return e.plain_text()
        return e.dxf.text or ""
    except Exception:  # noqa: BLE001 — texto estranho não derruba a leitura
        return ""


def ler(dxf: bytes, imagens: bool = True) -> Desenho:
    doc = _abrir(dxf)
    d = Desenho()
    folhas = [lay for lay in doc.layouts if lay.name != "Model" and len(lay) > 0]
    alvo = folhas[0] if folhas else doc.modelspace()
    d.folha = alvo.name
    # carimbo: o bloco com mais atributos que tenha cara de carimbo (folha primeiro, depois o modelo)
    candidatos = []
    for lay in [*folhas, doc.modelspace()]:
        for ins in lay.query("INSERT"):
            at: dict[str, str] = {}
            for a in ins.attribs:  # campos repetidos (linhas da tabela de revisões) em branco não apagam o preenchido
                if (a.dxf.text or "").strip() or a.dxf.tag not in at:
                    at[a.dxf.tag] = a.dxf.text or ""
            if parece_carimbo(at):
                candidatos.append(at)
    if candidatos:
        d.carimbo = max(candidatos, key=lambda x: sum(1 for v in x.values() if (v or "").strip()))
    for lay in [doc.modelspace(), *folhas]:
        for e in lay.query("TEXT MTEXT"):
            t = _texto(e).strip()
            if t:
                d.textos.append(t)
        for ins in lay.query("INSERT"):
            d.textos += [a.dxf.text for a in ins.attribs if (a.dxf.text or "").strip()]
    if imagens:
        d.pdf, d.png = _imagens(doc, alvo, d.avisos)
    return d


def _imagens(doc, layout, avisos: list[str]) -> tuple[bytes | None, bytes | None]:
    fig = Figure(figsize=(16.54, 11.69))  # proporção A1/A3 (paisagem)
    ax = fig.add_axes((0, 0, 1, 1))
    cfg = config.Configuration(background_policy=config.BackgroundPolicy.WHITE, color_policy=config.ColorPolicy.BLACK)
    try:
        Frontend(RenderContext(doc), MatplotlibBackend(ax), config=cfg).draw_layout(layout, finalize=True)
    except Exception as e:  # noqa: BLE001 — sem imagem, o original e o DXF continuam disponíveis
        avisos.append(f"não foi possível desenhar a folha: {type(e).__name__}")
        return None, None
    pdf, png = io.BytesIO(), io.BytesIO()
    FigureCanvasAgg(fig)  # Figure sem pyplot: o savefig usa o canvas ligado à figura
    fig.savefig(pdf, format="pdf", facecolor="white")
    fig.savefig(png, format="png", dpi=PNG_DPI, facecolor="white")
    return pdf.getvalue(), png.getvalue()
