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


# ---- take-off pelo projeto (spec 124) -------------------------------------------------------------------------------

_LARG = 0.6  # largura média de um caractere em relação à altura do texto (fontes do AutoCAD)


def _centro_texto(e) -> tuple[float, float, float, str] | None:
    """Centro x, base y, altura e texto — o alinhamento do TEXT/MTEXT resolvido para montar os quadros pela posição."""
    t = _texto(e).strip()
    if not t:
        return None
    try:
        if e.dxftype() == "TEXT":
            h = float(e.dxf.height or 1)
            w = len(t) * h * _LARG * float(e.dxf.get("width", 1) or 1)
            ins = e.dxf.insert
            ha, va = int(e.dxf.get("halign", 0) or 0), int(e.dxf.get("valign", 0) or 0)
            al = e.dxf.get("align_point", None)
            if (ha == 0 and va == 0) or al is None:
                x = ins.x + w / 2
            elif ha in (1, 4):
                x = al.x
            elif ha == 2:
                x = al.x - w / 2
            else:  # alinhado/ajustado entre o ponto de inserção e o de alinhamento
                x = (ins.x + al.x) / 2
            return x, float(ins.y if (ha == 0 and va == 0) or al is None else al.y), h, t
        h = float(e.dxf.char_height or 1)
        w = max(len(x) for x in t.splitlines()) * h * _LARG
        ins, ap = e.dxf.insert, int(e.dxf.get("attachment_point", 1) or 1)
        col, lin = (ap - 1) % 3, (ap - 1) // 3
        x = ins.x + w / 2 if col == 0 else (ins.x if col == 1 else ins.x - w / 2)
        y = ins.y - h if lin == 0 else (ins.y - h / 2 if lin == 1 else ins.y)
        return x, float(y), h, t
    except Exception:  # noqa: BLE001
        return None


def levantar(dxf: bytes):
    """Textos com posição, medidas por camada e contagem de blocos do espaço do modelo — a matéria-prima do take-off."""
    from ezdxf import path as ezpath
    from ezdxf.math import area as area_poligono

    from app.modules.documentos.domain.takeoff import Medida, Texto

    doc = _abrir(dxf)
    msp = doc.modelspace()
    textos: list[Texto] = []
    for e in msp.query("TEXT MTEXT"):
        c = _centro_texto(e)
        if c:
            textos.append(Texto(x=c[0], y=c[1], h=c[2], texto=c[3], camada=e.dxf.layer))
    comp: dict[str, float] = {}
    area: dict[str, float] = {}
    n: dict[str, int] = {}
    blocos: dict[str, int] = {}
    for e in msp:
        tipo, camada = e.dxftype(), e.dxf.layer
        try:
            if tipo == "INSERT":
                nome = e.dxf.name
                if not nome.startswith("*") and not parece_carimbo({a.dxf.tag: a.dxf.text for a in e.attribs}):
                    blocos[nome] = blocos.get(nome, 0) + 1
                continue
            if tipo not in ("LINE", "LWPOLYLINE", "POLYLINE", "ARC", "CIRCLE", "ELLIPSE", "SPLINE", "HATCH"):
                continue
            n[camada] = n.get(camada, 0) + 1
            if tipo == "HATCH":
                partes = [abs(area_poligono(list(p.flattening(0.01)))) for p in ezpath.from_hatch(e)]
                if partes:
                    partes.sort(reverse=True)
                    area[camada] = area.get(camada, 0.0) + max(partes[0] - sum(partes[1:]), 0.0)
                continue
            p = ezpath.make_path(e)
            pts = list(p.flattening(0.01))
            comp[camada] = comp.get(camada, 0.0) + sum(pts[i].distance(pts[i + 1]) for i in range(len(pts) - 1))
            fechada = (tipo in ("LWPOLYLINE", "POLYLINE") and e.closed) or tipo in ("CIRCLE",)
            if fechada and len(pts) > 2:
                area[camada] = area.get(camada, 0.0) + abs(area_poligono(pts))
        except Exception:  # noqa: BLE001 — entidade estranha não derruba o levantamento
            continue
    medidas = [Medida(camada=c, comprimento=comp.get(c, 0.0), area=area.get(c, 0.0), entidades=k) for c, k in n.items()]
    try:
        insunits = int(doc.header.get("$INSUNITS", 0) or 0)
    except (TypeError, ValueError):
        insunits = 0
    return textos, medidas, blocos, insunits
