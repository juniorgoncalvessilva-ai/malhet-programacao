"""Spec 131: o take-off parte dos projetos da obra — situação de cada um (lido, a ler, sem quantidade, sem desenho, sem
arquivo), levantamento em lote dos que não foram lidos (inclusive os que chegaram antes do take-off existir) e PDF com texto."""
import io

from app.modules.documentos.domain import takeoff as to
from app.modules.documentos.infra.pdf import textos
from tests.test_takeoff_projeto import _dxf, _enviar, _quadros_reais


def _pdf_com_quadro() -> bytes:
    import matplotlib
    from matplotlib.backends.backend_agg import FigureCanvasAgg
    from matplotlib.figure import Figure

    matplotlib.rcParams["pdf.fonttype"] = 42  # texto como texto (o que um PDF plotado com TrueType tem)
    fig = Figure(figsize=(16, 11))
    FigureCanvasAgg(fig)
    ax = fig.add_axes((0, 0, 1, 1))
    ax.set_xlim(6700, 7400)
    ax.set_ylim(1050, 1500)
    ax.axis("off")
    for t in _quadros_reais():
        ax.text(t.x - len(to.limpar(t.texto)) * t.h * 0.3, t.y, to.limpar(t.texto), fontsize=t.h * 0.95, ha="left", va="baseline")
    ax.text(6710, 1060, "1800AA-C-0300 rev 0", fontsize=6)
    b = io.BytesIO()
    fig.savefig(b, format="pdf")
    return b.getvalue()


def test_pdf_com_texto_da_o_mesmo_resumo_de_aco():
    aco = [e for e in to.extrair(textos(_pdf_com_quadro())) if e.chave.startswith("aço")]
    assert [(e.chave, e.quantidade, e.confere) for e in aco] == [("aço CA50 Ø6,3", 84, True), ("aço CA50 Ø8", 119, True),
                                                                  ("aço CA50 Ø10", 127, True), ("aço CA50 Ø12,5", 49, True)]


def test_projetos_e_levantar_em_lote(client):
    from app.core.db import SessionLocal
    from app.modules.documentos.infra.models import DocumentoRevisaoModel, TakeoffProjetoModel

    r = _enviar(client, _dxf("0"))
    rid = r.json()["revisao"]["id"]
    p = client.post("/api/documentos/revisoes", data={"codigo": "1800AA-C-0300", "revisao": "0", "finalidade": "para construção"},
                    files={"arquivo": ("armacao.pdf", _pdf_com_quadro(), "application/pdf")})
    assert p.status_code == 201, p.text
    assert p.json()["quantidades"] >= 4  # PDF com texto já é lido na chegada
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 64
    client.post("/api/documentos/revisoes", data={"codigo": "1800AA-F-0400", "revisao": "0"}, files={"arquivo": ("foto.png", png, "image/png")})
    client.post("/api/documentos/ldo", files={"arquivo": ("ldo.xlsx", __import__("tests.test_ldo_contrato", fromlist=["_ldo"])._ldo())})
    j = client.get("/api/documentos/takeoff/projetos").json()
    sit = {x["codigo"]: x for x in j["projetos"]}
    assert sit["1800AA-C-0100"]["situacao"] == "lido" and sit["1800AA-C-0100"]["arquivo"] == "DWG/DXF"
    assert sit["1800AA-C-0300"]["situacao"] == "lido" and sit["1800AA-C-0300"]["arquivo"] == "PDF"
    assert sit["1800AA-F-0400"]["situacao"] == "sem_desenho" and sit["1800AA-C-52640"]["situacao"] == "sem_arquivo"
    # revisão que chegou antes do take-off existir: fica "a ler" e o lote lê
    with SessionLocal() as s:
        s.query(TakeoffProjetoModel).filter(TakeoffProjetoModel.revisao_id == rid).delete()
        x = s.get(DocumentoRevisaoModel, rid)
        x.takeoff_em = x.takeoff_qtd = None
        s.commit()
    assert {x["codigo"]: x for x in client.get("/api/documentos/takeoff/projetos").json()["projetos"]}["1800AA-C-0100"]["situacao"] == "a_ler"
    lote = client.post("/api/documentos/takeoff/levantar").json()
    assert lote["lidos"] == 1 and lote["quantidades"] >= 5 and lote["restantes"] == 0
    assert client.post("/api/documentos/takeoff/levantar").json()["lidos"] == 0  # nada mais a ler
    assert client.post("/api/documentos/takeoff/levantar", params={"refazer": True}).json()["lidos"] == 2
    totais = client.get("/api/documentos/takeoff/projetos").json()["totais"]
    assert totais["lido"] == 2 and totais["sem_desenho"] == 2 and totais["a_ler"] == 0  # foto + a planilha da própria LDO
