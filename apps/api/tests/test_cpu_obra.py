"""CPU da obra (relatório de Composição de Preços Unitários) → HH, índice, recurso que governa, capacidade, FT."""
from io import BytesIO
from pathlib import Path

import pytest
from openpyxl import Workbook, load_workbook

from app.modules.referencias.domain import cpu_obra as c
from app.shared.errors import DomainError


def _l(**cols) -> list:
    """Linha com as células nas mesmas colunas do relatório real (0-based)."""
    row = [""] * 57
    for k, v in cols.items():
        row[int(k[1:])] = v
    return row


def relatorio() -> list[list]:
    """Concreto (ESP.1) usa Lançamento (ESP.9) — detalhado só uma vez — e o insumo MOD Servente (que também é composição)."""
    return [
        _l(c4="COMPOSIÇÃO DE PREÇOS UNITÁRIOS"),
        _l(c1="Item", c13="Serviço da Planilha:", c28="1.08.03.01.02", c34=" - ", c36="Concreto fck 30", c48="M3", c52=100.0),
        _l(c1=154.0, c9=" - Composição:", c26="ESP.1", c32=" - ", c33="Concreto fck 30"),
        _l(c4="Código", c25="Descrição", c39="Und.", c41="Quant.", c46="Vl. Unitário", c55="Vl. Parcial"),
        _l(c4="25.CONC.30", c25="Concreto bombeável 30 Mpa", c40="M3", c42=0.97, c47=714.82, c55=693.37),
        _l(c4="ESP.9", c25="Lançamento do concreto", c40="M3", c42=1.0, c47=246.11, c55=246.11),
        _l(c4="EQU.01.1", c25="Vibrador de imersão", c40="H", c42=0.5, c47=10.0, c55=5.0),
        _l(c4="Total do item:", c19=154.0, c46=1002.68),
        _l(c3="Mão de Obra:", c46=120.41),
        _l(c0=88.0, c4=".5.1", c17="- Composição:", c30="ESP.9", c35=" - ", c37="Lançamento do concreto"),
        _l(c4="21.CONT.ENCA", c25="* Encarregado de pedreiro", c39="HH", c42=0.3583, c46=0.0, c56=0.0),
        _l(c4="MOD.01.011", c25="Servente", c39="HH", c42=2.8, c46=50.26, c56=140.73),
        _l(c4="MOD.01.009", c25="Pedreiro", c39="HH", c42=1.3, c46=69.24, c56=90.01),
        _l(c38="Total da Composição Auxiliar:", c56=246.11),
        _l(c38="Mão de Obra (Sem Leis):", c56=120.41),
        _l(c0=88.0, c4=".5.2", c17="- Composição:", c30="MOD.01.011", c35=" - ", c37="Servente"),
        _l(c4="SAL.01", c25="Hora Normal - Servente", c39="HH", c42=1.0, c46=40.0, c56=40.0),
        _l(c4="SAL.02", c25="Hora improdutiva (chuva) - Servente", c39="HH", c42=0.08, c46=40.0, c56=3.2),
        _l(c38="Total da Composição Auxiliar:", c56=50.26),
        _l(c1="Item", c13="Serviço da Planilha:", c28="1.08.03.01.03", c34=" - ", c36="Concreto fck 40", c48="M3", c52=10.0),
        _l(c1=155.0, c9=" - Composição:", c26="ESP.2", c32=" - ", c33="Concreto fck 40"),
        _l(c4="ESP.9", c25="Lançamento do concreto", c40="M3", c42=2.0, c47=246.11, c55=492.22),
        _l(c4="Total do item:", c19=155.0, c46=1300.0),
    ]


def test_le_hierarquia_e_normaliza_item():
    rel = c.interpretar(relatorio())
    assert set(rel.composicoes) >= {"ESP.1", "ESP.9", "ESP.2", "MOD.01.011"}
    assert [(s.item, s.composicao, s.custo_unitario) for s in rel.servicos] == [
        ("1.8.3.1.2", "ESP.1", 1002.68), ("1.8.3.1.3", "ESP.2", 1300.0)]
    assert c.normalizar_item("1.08.03.01.02") == "1.8.3.1.2"


def test_achata_auxiliar_detalhada_uma_vez_e_para_na_funcao():
    rel = c.interpretar(relatorio())
    r1 = {r.recurso: (r.tipo, r.coef_por_unidade) for r in c.achatar(rel.composicoes, "ESP.1")}
    # Servente é insumo HH: não abre em hora normal/improdutiva; encarregado perde o "*"
    assert r1 == {"Servente": ("MOD", 2.8), "Pedreiro": ("MOD", 1.3), "Encarregado de pedreiro": ("MOD", 0.3583),
                  "Vibrador de imersão": ("EQU", 0.5)}
    r2 = {r.recurso: r.coef_por_unidade for r in c.achatar(rel.composicoes, "ESP.2")}
    assert r2["Pedreiro"] == pytest.approx(2.6)  # auxiliar com quantidade 2 multiplica
    gov = c.recurso_que_governa(c.achatar(rel.composicoes, "ESP.1"))
    assert (gov.recurso, gov.coef_por_unidade) == ("Pedreiro", 1.3)  # servente/encarregado são apoio


def test_referencia_circular_e_arquivo_errado():
    comp = {"A": c.Composicao("A", "a", (c.LinhaCpu("B", "b", "M3", 1),)),
            "B": c.Composicao("B", "b", (c.LinhaCpu("A", "a", "M3", 1),))}
    with pytest.raises(DomainError, match="referencia a si mesma"):
        c.achatar(comp, "A")
    with pytest.raises(DomainError, match="não encontrei composições"):
        c.interpretar([["qualquer", "coisa"]])


def _xlsx(linhas: list[list]) -> bytes:
    wb = Workbook()
    for ln in linhas:
        wb.active.append([None if x == "" else x for x in ln])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_fluxo_cpu_calcula_hh_indice_capacidade_e_ft(client):
    from tests.test_programacao_simplificada import LISTA

    r = client.post("/api/importar/cpu", data={"rotulo": "CPU obra"}, files={"arquivo": ("cpu.xlsx", _xlsx(relatorio()))})
    assert r.status_code == 200, r.text
    assert r.json()["contagem"]["ITENS_PQ"] == 2
    d = client.get("/api/cpu/item", params={"item": "1.8.3.1.2"}).json()
    assert d["composicao"] == "ESP.1" and d["recurso_governa"] == "Pedreiro"
    assert d["hh_un"] == pytest.approx(2.8 + 1.3 + 0.3583)
    assert d["indice_un_dia"] == pytest.approx(9 / 1.3)

    arv = client.post("/api/frentes/importar", json={"texto": LISTA}).json()
    area = arv[0]["areas"][0]
    g = client.post("/api/catalogo/grupos", json={"descricao": "Concreto"}).json()
    t = client.post("/api/catalogo/tipos", json={"grupo_id": g["id"], "descricao": "Concreto 30 MPa", "unidade": "m³"}).json()
    eq = client.post("/api/equipes", json={"nome": "EQ", "encarregado_cracha": "1", "encarregado_nome": "Fulano",
                                           "jornada_horas": 9, "composicao": [
                                               {"recurso": "PEDREIRO", "tipo": "MOD", "quantidade": 2},
                                               {"recurso": "Servente", "tipo": "MOD", "quantidade": 3}]}).json()
    p = client.post("/api/programacoes", json={"tipo": "SEMANAL", "referencia": "2026-11-10"}).json()
    lid = client.post(f"/api/programacoes/{p['id']}/linhas", json={
        "area_id": area["id"], "tipo_id": t["id"], "item_pq": "1.8.3.1.2", "equipe_id": eq["id"]}).json()["id"]
    client.put(f"/api/programacoes/{p['id']}/linhas/{lid}/valores", json={"campo": "previsto", "valores": [
        {"data": "2026-11-09", "valor": 10}, {"data": "2026-11-10", "valor": 5}]})
    v = client.get(f"/api/programacoes/{p['id']}").json()
    calc = v["locais"][0]["areas"][0]["linhas"][0]["calc"]
    hh_un = 2.8 + 1.3 + 0.3583
    assert calc["hh_previsto"][3] == pytest.approx(round(10 * hh_un, 2))
    # equipe 2 pedreiros + 3 serventes: servente 2,8/3 = 0,933 h/un > pedreiro 1,3/2 = 0,65 → gargalo Servente
    assert calc["gargalo"] == "Servente" and calc["capacidade_un_dia"] == pytest.approx(9 / (2.8 / 3), rel=1e-3)
    assert calc["acima_capacidade"][3] is True and calc["acima_capacidade"][4] is False  # 10 > 9,64; 5 ok
    assert "Encarregado de pedreiro" in calc["apoio_externo"] and "Vibrador de imersão" in calc["apoio_externo"]
    assert v["total_hh_previsto"] == pytest.approx(round(15 * hh_un, 2), abs=0.02)

    # memória de cálculo: cada número com a conta e a linha do arquivo de onde veio
    m = client.get(f"/api/programacoes/{p['id']}/linhas/{lid}/memoria").json()["memorias"]
    assert {"hh_un", "governa", "indice", "capacidade", "composicao_equipe", "hh_dia:3", "oficiais:3",
            "total_hh_previsto"} <= set(m)
    ped = next(x for x in m["hh_un"]["passos"] if x["descricao"].startswith("Pedreiro"))
    assert "linha 13" in ped["descricao"] and "ESP.9" in ped["descricao"] and "(ESP.9, linha 6)" in ped["conta"]
    locais = " | ".join(f["local"] or "" for f in m["hh_un"]["fontes"])
    assert "linha 2: Serviço da Planilha 1.08.03.01.02" in locais and "linha 3: Composição: ESP.1" in locais
    assert m["indice"]["passos"][0]["conta"] == "9 h ÷ 1,3 HH/m³" and m["indice"]["valor"] == "6,92 m³/dia"
    assert m["indice"]["fontes"][0]["origem"] == "Equipe EQ" and "linha 13 (ESP.9)" in m["indice"]["fontes"][1]["local"]
    # produção por função = pessoas × jornada ÷ h/un; equipe completa = a menor (Servente 3 × 9 ÷ 2,8 = 9,64)
    cap = {x["descricao"].split(":")[0]: x for x in m["capacidade"]["passos"]}
    assert cap["Servente"]["conta"] == "3 × 9 h ÷ 2,8" and cap["Servente"]["destaque"]
    assert cap["Pedreiro (governa)"]["conta"] == "2 × 9 h ÷ 1,3" and cap["Pedreiro (governa)"]["resultado"] == "13,85 m³/dia"
    assert m["capacidade"]["valor"] == "9,64 m³/dia"
    assert calc["capacidade_equipe"] == pytest.approx(9 / (2.8 / 3), rel=1e-3)
    assert calc["capacidade_governa"] == pytest.approx(2 * 9 / 1.3, rel=1e-3) and calc["base_capacidade"] == "equipe"
    # base "recurso que governa": capacidade = 13,85; Servente vira aviso; acima da capacidade muda junto
    assert client.put(f"/api/programacoes/{p['id']}/base-capacidade", json={"base": "governa"}).json() == {"base": "governa"}
    assert client.put(f"/api/programacoes/{p['id']}/base-capacidade", json={"base": "x"}).status_code == 422
    c2 = client.get(f"/api/programacoes/{p['id']}").json()["locais"][0]["areas"][0]["linhas"][0]["calc"]
    assert c2["capacidade_un_dia"] == pytest.approx(2 * 9 / 1.3, rel=1e-3) and c2["acima_capacidade"][3] is False
    assert any(a.startswith("com 3 Servente a equipe faz 9,64/dia") for a in c2["alertas"])
    m2 = client.get(f"/api/programacoes/{p['id']}/linhas/{lid}/memoria").json()["memorias"]
    assert m2["capacidade"]["valor"] == "13,85 m³/dia" and "recurso que governa" in m2["capacidade"]["notas"][0]
    client.put(f"/api/programacoes/{p['id']}/base-capacidade", json={"base": "equipe"})
    assert m["hh_dia:3"]["passos"][0]["conta"] == "10 m³ × 4,4583 HH/m³"
    assert m["governa"]["valor"] == "Pedreiro" and "apoio" in m["governa"]["passos"][0]["descricao"]
    tot = client.get(f"/api/programacoes/{p['id']}/memoria").json()["memorias"]
    assert tot["total_hh_previsto"]["valor"] == f"{round(15 * hh_un, 1):.1f} HH".replace(".", ",")
    me = client.get(f"/api/equipes/{eq['id']}/memoria").json()["memorias"]
    assert me["hh_disponivel"]["valor"] == "45 HH/dia" and "composição digitada" in me["composicao_equipe"]["fontes"][0]["local"]
    mi = client.get("/api/cpu/item/memoria", params={"item": "1.8.3.1.2"}).json()["memorias"]
    assert mi["hh_un"]["valor"].startswith("4,458 HH/")

    ws = load_workbook(BytesIO(client.get(f"/api/programacoes/{p['id']}/ft").content)).active
    cab = [x.value for x in ws[1]]
    ln = dict(zip(cab, [x.value for x in ws[2]]))
    assert ln["PE_SEGUNDA"] == "10" and float(ln["HH_SEGUNDA"]) == pytest.approx(round(10 * hh_un, 2))

    # botões "Pela capacidade" × "Manual (encarregado)": capacidade 9,64/dia × fator do dia até a qtd do período (20)
    pid = p["id"]
    client.put(f"/api/programacoes/{pid}/salvar", json={"linhas": [{"id": lid, "qtd_periodo": 20, "mudar_qtd_periodo": True}]})
    r = client.put(f"/api/programacoes/{pid}/modo-previsto", json={"modo": "capacidade"}).json()
    assert r == {"aplicadas": 1, "puladas": []}
    ln = client.get(f"/api/programacoes/{pid}").json()["locais"][0]["areas"][0]["linhas"][0]
    assert ln["modo_previsto"] == "capacidade"
    assert ln["previsto"] == [None, None, None, 9.64, 9.64, 0.72, None, None, None]
    assert ln["calc"]["capacidade_dia"][7] == pytest.approx(9 / (2.8 / 3) * 8 / 9, abs=1e-3)  # sexta 8 h
    m = client.get(f"/api/programacoes/{pid}/linhas/{lid}/memoria").json()["memorias"]
    assert m["previsto_sugerido"]["valor"] == "20 m³" and m["capacidade_dia:7"]["passos"][0]["conta"] == "8 h ÷ 9 h"
    # o encarregado mexeu num dia: vira "ajustado"; a sugestão continua guardada para os indicadores
    client.put(f"/api/programacoes/{pid}/linhas/{lid}/valores", json={"campo": "previsto", "valores": [{"data": "2026-11-11", "valor": 3}]})
    ln = client.get(f"/api/programacoes/{pid}").json()["locais"][0]["areas"][0]["linhas"][0]
    assert ln["modo_previsto"] == "ajustado" and ln["calc"]["previsto_sugerido"][5] == 0.72
    assert client.put(f"/api/programacoes/{pid}/modo-previsto", json={"modo": "manual", "linhas": [lid]}).json()["aplicadas"] == 1
    assert client.put(f"/api/programacoes/{pid}/modo-previsto", json={"modo": "x"}).status_code == 422
    assert client.put(f"/api/programacoes/{pid}/modo-previsto", json={"modo": "manual", "linhas": [999999]}).status_code == 404


@pytest.mark.parametrize("arquivo", ["5b7583e5-Composi__o_de_Custo_Unit_rio_VERS_O_OBRA.xls"])
def test_cpu_real_quando_disponivel(arquivo):
    from app.modules.referencias.application.importar_cpu import ler_linhas

    p = Path("/root/.claude/uploads/011bc413-02b1-5ac2-8ac9-328b64323d85") / arquivo
    if not p.exists():
        pytest.skip("relatório real fora do repositório")
    with p.open("rb") as f:
        rel = c.interpretar(ler_linhas(f, p.name))
    assert len(rel.servicos) > 400 and len(rel.composicoes) > 1000
    s = next(x for x in rel.servicos if x.item == "1.8.3.1.2")
    gov = c.recurso_que_governa(c.achatar(rel.composicoes, s.composicao))
    assert s.composicao == "ESP.48.155" and gov.recurso == "Pedreiro" and gov.coef_por_unidade == pytest.approx(1.3)
