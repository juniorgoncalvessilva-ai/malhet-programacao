"""Spec 104: aderência física e financeira semanal — histórico lido da apresentação anterior, semanas do sistema
(previsto/realizado × PU), ranking, semana anterior, meta da semana com marcos e a apresentação no modelo da contratada."""
from io import BytesIO

from pptx import Presentation
from pptx.util import Cm

from app.modules.aderencia.domain.aderencia import (Atividade, Registro, brl, chave_nome, dinheiro, ler_historico, marcos,
                                                   meta_da_semana, montar_painel, pct)
from app.modules.aderencia.application.importar import textos_dos_slides
from tests.test_excluir_revisao import _programacao


def _caixa(slide, x, y, texto):
    tb = slide.shapes.add_textbox(Cm(x), Cm(y), Cm(4), Cm(0.5))
    tb.text_frame.text = texto


def apresentacao_ficticia() -> bytes:
    """Mesma estrutura da apresentação de referência, com nomes e valores inventados."""
    prs = Presentation()
    prs.slide_width, prs.slide_height = Cm(33.867), Cm(19.05)
    lay = prs.slide_layouts[6]
    capa = prs.slides.add_slide(lay)
    _caixa(capa, 3, 7, "OBRA 999 - TESTE")
    capa.shapes[0].text_frame.add_paragraph().text = "ANÁLISE DE ADERÊNCIA FÍSICA E FINANCEIRA DA PROGRAMAÇÃO SEMANAL - SEMANA 12"
    div = prs.slides.add_slide(prs.slide_layouts[5])
    _caixa(div, 1, 15, "Planejamento")
    s = prs.slides.add_slide(lay)  # blocos por responsável, lado a lado
    _caixa(s, 1.0, 4.7, "1º  ANA PAULA SOUZA")
    _caixa(s, 17.8, 4.7, "2º  BRUNO LIMA")
    for i, (sem, a, b) in enumerate([(9, ("R$ 100.000,00", "R$ 80.000,00"), ("R$ 50.000,00", "R$ 10.000,00")),
                                     (10, ("R$ 200.000,00", "R$ 150.000,00"), ("R$ 40.000,00", "R$ 30.000,00"))]):
        y = 6.4 + i * 0.72
        for x, v in ((0.7, f"S{sem}"), (2.9, a[0]), (7.0, a[1]), (11.0, "- R$ 1,00"), (17.45, f"S{sem}"), (19.6, b[0]), (23.7, b[1])):
            _caixa(s, x, y, v)
    s = prs.slides.add_slide(lay)  # semana anterior
    _caixa(s, 1.6, 3.5, "Semana 11  •  Obra 999 — Teste  •  Análise financeira")
    for x, v in ((1.65, "RESPONSÁVEL"), (13.08, "PLANEJADO"), (19.68, "REALIZADO"), (26.92, "ADERÊNCIA")):
        _caixa(s, x, 9.58, v)
    _caixa(s, 1.7, 10.8, "Ana Paula Souza"); _caixa(s, 13.2, 10.9, "R$ 300.000,00"); _caixa(s, 19.4, 10.85, "R$ 240.000,00"); _caixa(s, 26.9, 10.55, "80,00%")
    _caixa(s, 1.7, 12.4, "Bruno Lima"); _caixa(s, 13.2, 12.45, "R$ 60.000,00"); _caixa(s, 19.4, 12.4, "R$ 30.000,00"); _caixa(s, 26.9, 12.2, "50,00%")
    fim = prs.slides.add_slide(lay)
    _caixa(fim, 2, 6, "OBRIGADO!")
    _caixa(fim, 2, 13, "OBRA 999 • TESTE")
    out = BytesIO()
    prs.save(out)
    return out.getvalue()


def test_formatos_e_leitura():
    assert (brl(1234.5), brl(-10), brl(-10, sinal=True), brl(5, sinal=True), pct(0.6902), pct(0.010718, 4)) == \
        ("R$ 1.234,50", "-R$ 10,00", "- R$ 10,00", "+ R$ 5,00", "69,02%", "1,0718%")
    assert dinheiro("- R$ 156.012,16") == -156012.16 and dinheiro("R$ 1.094.172,20") == 1094172.20 and dinheiro("69,02%") is None
    assert chave_nome("José da Silva") == chave_nome("JOSE DA SILVA")
    regs = ler_historico(textos_dos_slides(Presentation(BytesIO(apresentacao_ficticia()))))
    por = {(r.semana, chave_nome(r.responsavel)): r for r in regs}
    assert por[(9, "BRUNO LIMA")].programado == 50000 and por[(9, "BRUNO LIMA")].realizado == 10000  # bloco da direita
    assert por[(10, "ANA PAULA SOUZA")].realizado == 150000
    assert por[(11, "ANA PAULA SOUZA")].programado == 300000 and por[(11, "BRUNO LIMA")].realizado == 30000
    assert len(regs) == 6


def test_painel_e_marcos():
    regs = [Registro(9, "Ana", 100, 80), Registro(10, "Ana", 200, 150), Registro(9, "Bruno", 50, 10),
            Registro(11, "Ana", 300, 240, atividades=4, cumpridas=3), Registro(11, "Bruno", 60, 30)]
    p = montar_painel(regs, 12)
    assert [b["responsavel"] for b in p.anteriores["blocos"]] == ["Ana", "Bruno"]  # ranking pelo programado acumulado
    assert p.anteriores["geral"] == {"programado": 350, "realizado": 240, "saldo": -110, "aderencia": 240 / 350,
                                     "atividades": 0, "cumpridas": 0, "fisica": None}
    assert p.anterior["semana"] == 11 and p.anterior["programado"] == 360 and p.anterior["desvio"] == -90
    assert p.anterior["itens"][0]["fisica"] == 0.75
    m = marcos([Atividade("Ana", "S2", "A", 50), Atividade("Ana", "S2", "B", 30), Atividade("Ana", "S1", "C", 15), Atividade("Ana", "S1", "D", 5)], 100)
    assert [x["descricao"] for x in m["itens"]] == ["A", "B"] and m["total"] == 80 and m["representatividade"] == 0.8  # 80% da meta
    meta = meta_da_semana([Atividade("Ana", "S2", "A", 75), Atividade("Bruno", "L1", "B", 25)], 10_000)
    assert meta["meta"] == 100 and meta["avanco"] == 0.01 and meta["itens"][0]["participacao"] == 0.75


def test_importar_sistema_e_apresentacao(client):
    pid = _programacao(client)  # semana 32 (06/11 a 14/11/2026): Concreto 30 MPa, PU 1.295,53
    ln = client.get(f"/api/programacoes/{pid}").json()["locais"][0]["areas"][0]["linhas"][0]
    client.put(f"/api/programacoes/{pid}/linhas/{ln['id']}", json={"area_id": ln["area_id"], "tipo_id": ln["tipo_id"],
               "complemento": "Fundo canaleta", "responsavel": "Ana Paula Souza", "natureza": "P"})
    assert client.post(f"/api/programacoes/{pid}/emitir").status_code == 200
    client.put(f"/api/programacoes/{pid}/linhas/{ln['id']}/valores", json={"campo": "realizado", "valores": [{"data": "2026-11-09", "valor": 2}]})

    r = client.post("/api/aderencia/importar", files={"arquivo": ("S12.pptx", apresentacao_ficticia())})
    assert r.status_code == 200, r.text
    assert r.json()["registros"] == 6 and r.json()["semanas"] == [9, 10, 11] and r.json()["modelo"]
    assert client.post("/api/aderencia/importar", files={"arquivo": ("x.pptx", b"nao e pptx")}).status_code == 422

    p = client.get("/api/aderencia", params={"semana": 32}).json()
    assert p["modelo"]["nome"] == "S12.pptx" and not p["modelo"]["herdado"]
    at = p["atual"]
    assert at["origem"] == "sistema" and at["meta"] == round(3 * 1295.53, 2) and at["itens"][0]["responsavel"] == "Ana Paula Souza"
    assert at["avanco"] and at["itens"][0]["marcos"]["itens"]
    assert p["semanas"][-1]["semana"] == 32 and p["semanas"][-1]["origem"] == "sistema"
    assert round(p["semanas"][-1]["realizado"], 2) == round(2 * 1295.53, 2)
    assert {s["semana"] for s in p["semanas"]} == {9, 10, 11, 32}

    # a semana anterior (11) e as anteriores (9 e 10) vêm do histórico
    p12 = client.get("/api/aderencia", params={"semana": 12}).json()
    assert p12["anterior"]["semana"] == 11 and p12["anterior"]["programado"] == 360000
    assert p12["ranking"]["itens"][0]["responsavel"].upper() == "ANA PAULA SOUZA"

    # corrigir uma semana à mão
    assert client.put("/api/aderencia/historico/11", json={"itens": [{"responsavel": "Ana Paula Souza", "programado": 1000, "realizado": 900}]}).status_code == 200
    assert client.get("/api/aderencia", params={"semana": 12}).json()["anterior"]["programado"] == 1000
    assert client.put("/api/aderencia/historico/11", json={"itens": [{"responsavel": "A B", "programado": 1}, {"responsavel": "a b", "programado": 2}]}).status_code == 422

    # apresentação no modelo: capa e encerramento do modelo com a semana/obra novas, folhas de dados no meio
    r = client.get("/api/aderencia/apresentacao", params={"semana": 12})
    assert r.status_code == 200 and r.headers["content-disposition"].endswith('S12.pptx"')
    prs = Presentation(BytesIO(r.content))
    textos = [" ".join(sh.text_frame.text for sh in sl.shapes if sh.has_text_frame) for sl in prs.slides]
    assert "SEMANA 12" in textos[0] and "OBRA 310" in textos[0].upper()
    assert textos[1].strip() == "Planejamento"
    assert "OBRIGADO" in textos[-1] and "OBRA 310" in textos[-1].upper()
    assert any("SEMANAS ANTERIORES" in t for t in textos) and any("Ranking Financeiro" in t for t in textos)
    assert any("Planejado x Realizado" in t and "R$ 1.000,00" in t for t in textos)
    r32 = client.get("/api/aderencia/apresentacao", params={"semana": 32})
    t32 = [" ".join(sh.text_frame.text for sh in sl.shapes if sh.has_text_frame) for sl in Presentation(BytesIO(r32.content)).slides]
    assert any("Panorama Financeiro" in t for t in t32) and any("Marcos Prioritários — Semana 32" in t for t in t32)


def test_modelo_herdado_da_contratada(client):
    from app.core.db import SessionLocal
    from app.modules.obras.infra.models import MarcaObraModel

    obra_a = int(client.headers["X-Obra-Id"])
    obra_b = client.post("/api/admin/obras", json={"codigo": "311", "nome": "Obra 311"}).json()["id"]
    with SessionLocal() as s:
        for o in (obra_a, obra_b):
            s.merge(MarcaObraModel(obra_id=o, nome_contratada="Construtora Teste"))
        s.commit()
    client.post("/api/aderencia/importar", files={"arquivo": ("Padrao.pptx", apresentacao_ficticia())})
    m = client.get("/api/aderencia/modelo", headers={"X-Obra-Id": str(obra_b)}).json()
    assert m["nome"] == "Padrao.pptx" and m["herdado"]  # padrão da empresa vale nas outras obras dela
