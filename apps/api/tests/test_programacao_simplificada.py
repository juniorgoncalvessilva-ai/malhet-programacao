"""Spec 008: frentes (Local → Área com sufixo), catálogo com ID Simova, programação semanal/mensal, FT."""
from datetime import date
from io import BytesIO

import pytest
from openpyxl import Workbook, load_workbook

from app.modules.catalogo.domain import catalogo as cat
from app.modules.frentes.domain.frentes import interpretar_lista, normalizar_tag
from app.modules.integracao_simova.domain import layout
from app.modules.planejamento.domain.periodo import TipoProgramacao, janelas_ft, periodo, titulo

LISTA = """CODIGO\tDESCRICAO
1\tOBRA GERAL
004.00\tCMD – GERAL
2\tCANTEIRO PRINCIPAL
024.00\tCA-1600AA-01 – Canteiro Central Vale
020.01\tYY-1600AA-07 – Drenagem Pluvial – Oficinas
011.02\tED-1600AA-02 – Galpão do Armazém de Preparação de Materiais
004.03\tEW-1800AA-01 – Biodigestor com Sumidouro – CMD
019.00\tESTACIONAMENTO DE VEÍCULOS LEVES
020.01\tIF-1600AA-01 – OFICINA – INTERFERÊNCIAS
004.05\tED-1800AA-01 – Galpão de Resíduos Classe II – CMD
004.04\tED-1800AA-02 – Galpão de Resíduos Classe I – CMD
S2\tPLATÔ S2
020.01\tYY-1600AA-06 – Pavimento Sem Trilho
004.00\tYY-1800AA-01 – Drenagem do Novo CMD
3\tATIVIDADES DIVERSAS – CMD
004.12\tED-1800AA-06 – Casa de Bombas / Skid de Bombas (SPCI)
004.12\tTQ-1800AA-01 – Base para Tanque de Água para Combate a Incêndio
"""


# ---- domínio ------------------------------------------------------------------------------------------
def test_tag_normalizada_no_formato_do_takeoff():
    assert normalizar_tag("ED-1800AA-01 – Galpão de Resíduos") == "1800AA-ED-01"
    assert normalizar_tag("1800AA-ED-01") == "1800AA-ED-01"
    assert normalizar_tag("ED-1600AA-110 – Restaurante") == "1600AA-ED-110"
    assert normalizar_tag("CMD – GERAL") is None


def test_lista_de_frentes_dois_niveis_e_sufixo_nos_repetidos():
    locais = interpretar_lista(LISTA)
    assert [x.codigo for x in locais] == ["1", "2", "S2", "3"]
    cods = {a.descricao.split(" –")[0]: a.codigo for loc in locais for a in loc.areas}
    assert cods["CMD"] == "004.00.1" and cods["YY-1800AA-01"] == "004.00.2"  # 004.00 aparece 2x
    assert cods["YY-1600AA-07"] == "020.01.1" and cods["IF-1600AA-01"] == "020.01.2" and cods["YY-1600AA-06"] == "020.01.3"
    assert cods["CA-1600AA-01"] == "024.00"  # único: fica sem sufixo
    assert locais[1].areas[0].tag == "1600AA-CA-01"


def test_ids_do_catalogo():
    assert cat.codigo_tipo(2, 3) == "2.3" and cat.codigo_item(2, 3, 1) == "2.3.1" and cat.codigo_item(2, 3, None) == "2.3"
    assert cat.descricao_item("Concreto 20 MPa", "(Fundo canaleta 2A)") == "Concreto 20 MPa - (Fundo canaleta 2A)"
    assert cat.chave_complemento(" (Fundo  Canaleta 2A) ") == cat.chave_complemento("fundo canaleta 2a")


def test_semana_de_sexta_a_sabado_e_janelas_da_ft():
    ini, fim = periodo(TipoProgramacao.SEMANAL, date(2026, 11, 10))  # terça → sexta anterior
    assert (ini, fim) == (date(2026, 11, 6), date(2026, 11, 14)) and ini.weekday() == 4 and fim.weekday() == 5
    assert "S32" in titulo(TipoProgramacao.SEMANAL, ini, fim)
    assert periodo(TipoProgramacao.MENSAL, date(2026, 11, 17)) == (date(2026, 11, 1), date(2026, 11, 30))
    datas = [date(2026, 11, d) for d in range(6, 15)]
    jan = janelas_ft(datas)
    assert [len(j) for j in jan] == [7, 2] and jan[1] == [date(2026, 11, 13), date(2026, 11, 14)]


# ---- fluxo HTTP -----------------------------------------------------------------------------------------
def takeoff() -> bytes:
    wb = Workbook()
    pq = wb.active
    pq.title = "PQ CONTRATO"
    for _ in range(7):
        pq.append([None])
    pq.append(["1.5.3.1.2", "ESP.48.461", None, None, "C", "45", "12", "005", "010", "Concreto estrutural 20 MPa",
               "m³", "CMS", None, None, None, None, 300, 750.5])
    pq.append(["1.5.3.1.3", "ESP.48.462", None, None, "C", "45", "12", "005", "015", "Concreto 30 MPa",
               "m³", "CMS", None, None, None, None, 100, 900])
    mc = wb.create_sheet("MC FRENTES")
    for _ in range(9):
        mc.append([None])
    mc.append(["ESP.48.461", 1, "18", "00AA", "ED-01", "C", "45", "12", "005", "010", "Concreto", None, "m³", 42.5])
    mc.append(["ESP.48.461", 2, "18", "00AA", "ED-01", "C", "45", "12", "005", "010", "Concreto", None, "m³", 7.5])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_fluxo_frentes_catalogo_programacao_ft(client):
    # frentes coladas + edição propagando
    arv = client.post("/api/frentes/importar", json={"texto": LISTA}).json()
    areas = {a["descricao"].split(" –")[0]: a for loc in arv for a in loc["areas"]}
    galpao = areas["ED-1800AA-01"]
    assert galpao["codigo"] == "004.05" and galpao["tag"] == "1800AA-ED-01"
    assert len(client.post("/api/frentes/importar", json={"texto": LISTA}).json()[1]["areas"]) == 8  # idempotente: reimportar não duplica

    # take-off: PQ + quantidade por TAG
    r = client.post("/api/importar/takeoff", data={"rotulo": "5º take-off"}, files={"arquivo": ("t.xlsx", takeoff())})
    assert r.status_code == 200, r.text
    assert r.json()["contagem"] == {"PQ": 2, "QTD_TAG": 1}
    busca = client.get("/api/pq/itens", params={"q": "1.5.3", "tag": "1800AA-ED-01"}).json()
    assert busca[0]["qtd_tag"] == 50.0

    # catálogo: 2 Concreto → 2.3 Concreto 20 MPa (com item de PQ permitido)
    g1 = client.post("/api/catalogo/grupos", json={"descricao": "Escavação"}).json()
    g = client.post("/api/catalogo/grupos", json={"descricao": "Concreto"}).json()
    assert (g1["numero"], g["numero"]) == (1, 2)
    for desc in ("Concreto magro", "Concreto 10 MPa"):
        client.post("/api/catalogo/tipos", json={"grupo_id": g["id"], "descricao": desc, "unidade": "m³"})
    t = client.post("/api/catalogo/tipos", json={"grupo_id": g["id"], "descricao": "Concreto 20 MPa", "unidade": "m³",
                                                  "itens_pq": ["1.5.3.1.2"]}).json()
    assert t["codigo"] == "2.3"

    # programação semanal (sex 06/11 → sáb 14/11) com linha "Concreto 20 MPa - (Fundo canaleta 2A)"
    p = client.post("/api/programacoes", json={"tipo": "SEMANAL", "referencia": "2026-11-10"}).json()
    assert (p["inicio"], p["fim"]) == ("2026-11-06", "2026-11-14")
    eq = client.post("/api/equipes", json={"nome": "EQ-CONCRETO", "encarregado_cracha": "115095",
                                           "encarregado_nome": "Clayton", "composicao": []}).json()
    linha = {"area_id": galpao["id"], "tipo_id": t["id"], "complemento": "Fundo canaleta 2A",
             "item_pq": "1.5.3.1.2", "equipe_id": eq["id"]}
    r = client.post(f"/api/programacoes/{p['id']}/linhas", json=linha)
    assert r.status_code == 201 and r.json()["aviso"] is None
    lid = r.json()["id"]
    r2 = client.post(f"/api/programacoes/{p['id']}/linhas", json={**linha, "complemento": "(fundo  canaleta 2a)",
                                                                   "item_pq": "1.5.3.1.3"})
    assert "1.5.3.1.2" in r2.json()["aviso"]  # mesmo complemento reaproveita 2.3.1, mas avisa do item de PQ
    client.delete(f"/api/programacoes/{p['id']}/linhas/{r2.json()['id']}")
    vals = [{"data": f"2026-11-{d:02d}", "valor": v} for d, v in ((6, 5), (9, 10), (10, 10), (13, 8), (14, 4))]
    assert client.put(f"/api/programacoes/{p['id']}/linhas/{lid}/valores",
                      json={"campo": "previsto", "valores": vals}).status_code == 204

    v = client.get(f"/api/programacoes/{p['id']}").json()
    assert [d["dia"] for d in v["dias"]][:3] == ["SEX", "SÁB", "DOM"] and len(v["dias"]) == 9
    loc = v["locais"][0]
    ln = loc["areas"][0]["linhas"][0]
    assert (loc["codigo"], loc["areas"][0]["codigo"]) == ("2", "004.05")
    assert ln["codigo_simova"] == "2.3.1" and ln["descricao"] == "Concreto 20 MPa - (Fundo canaleta 2A)"
    assert ln["qtd_takeoff"] == 50.0 and ln["total_previsto"] == 37 and ln["unidade"] == "m³"

    # editar frente e catálogo propaga para a programação
    client.put(f"/api/frentes/areas/{galpao['id']}", json={"local_id": galpao["local_id"], "cwa": "004.05",
                                                           "codigo": "004.05.9", "descricao": galpao["descricao"]})
    client.put(f"/api/catalogo/grupos/{g['id']}", json={"descricao": "Concretagem", "numero": 7})
    v = client.get(f"/api/programacoes/{p['id']}").json()
    ln = v["locais"][0]["areas"][0]["linhas"][0]
    assert v["locais"][0]["areas"][0]["codigo"] == "004.05.9" and ln["codigo_simova"] == "7.3.1"
    assert ln["grupo"]["descricao"] == "Concretagem"

    # emitir congela; previsto travado, realizado liberado; reabrir gera nova revisão
    assert client.post(f"/api/programacoes/{p['id']}/emitir").json() == {"revisao": 0}
    assert client.put(f"/api/programacoes/{p['id']}/linhas/{lid}/valores",
                      json={"campo": "previsto", "valores": vals}).status_code == 422
    assert client.put(f"/api/programacoes/{p['id']}/linhas/{lid}/valores",
                      json={"campo": "realizado", "valores": [{"data": "2026-11-06", "valor": 4}]}).status_code == 204
    client.put(f"/api/frentes/areas/{galpao['id']}", json={"local_id": galpao["local_id"], "cwa": "004.05",
                                                           "codigo": "004.05", "descricao": galpao["descricao"]})
    foto = client.get(f"/api/programacoes/{p['id']}/emissoes/0").json()
    assert foto["locais"][0]["areas"][0]["codigo"] == "004.05.9"  # emitida não muda
    assert client.post(f"/api/programacoes/{p['id']}/reabrir").status_code == 204
    assert client.post(f"/api/programacoes/{p['id']}/emitir").json() == {"revisao": 1}

    # FT: 9 dias → 2 linhas (sex…qui + sex, sáb), ID 7.3.1 e frente 004.05
    r = client.get(f"/api/programacoes/{p['id']}/ft")
    assert r.status_code == 200 and r.headers["x-itens"] == "2"
    ws = load_workbook(BytesIO(r.content)).active
    rows = [dict(zip(layout.FT_IMPORT_INTERMEDIARIA, x)) for x in list(ws.iter_rows(values_only=True))[1:]]
    assert {x["CODIGO_OPER"] for x in rows} == {"7.3.1"} and {x["CODIGO_FRENTE"] for x in rows} == {"004.05"}
    assert (rows[0]["DATA_INICIO"], rows[0]["DATA_FIM"], rows[0]["PE_SEXTA"]) == ("06/11/2026", "12/11/2026", "5")
    assert (rows[1]["DATA_INICIO"], rows[1]["PE_SEXTA"], rows[1]["PE_SABADO"]) == ("13/11/2026", "8", "4")
    assert rows[0]["CRACHA_ENCARREGADO"] == "115095" and "PQ 1.5.3.1.2" in rows[0]["OBSERVACAO"]

    # cadastros para o Simova: FRENTE (locais+áreas), OPER_GRUPO, OPER com 7.3 e 7.3.1
    wb = load_workbook(BytesIO(client.get("/api/simova/cadastros.xlsx").content))
    opers = {r[0]: r[1] for r in list(wb["OPER"].iter_rows(values_only=True))[1:]}
    assert opers["7.3"] == "Concreto 20 MPa" and opers["7.3.1"] == "Concreto 20 MPa - (Fundo canaleta 2A)"
    frentes = [r[0] for r in list(wb["FRENTE"].iter_rows(values_only=True))[1:]]
    assert frentes[:3] == ["1", "004.00.1", "2"] and "S2" in frentes

    # área usada em programação não pode ser excluída
    assert client.delete(f"/api/frentes/areas/{galpao['id']}").status_code == 422


@pytest.mark.parametrize("arquivo", ["608486db-Cronograma_Corrente_-_RSA_S31.xer"])
def test_xer_real_quando_disponivel(client, arquivo):
    from pathlib import Path
    p = Path("/root/.claude/uploads/011bc413-02b1-5ac2-8ac9-328b64323d85") / arquivo
    if not p.exists():
        pytest.skip("XER real não está nesta máquina")
    r = client.post("/api/importar/xer", data={"rotulo": "S31"}, files={"arquivo": (arquivo, p.read_bytes())})
    assert r.status_code == 200, r.text
    assert r.json()["contagem"]["CRONOGRAMA"] > 4000
    client.post("/api/frentes/importar", json={"texto": LISTA})
    arv = client.get("/api/frentes").json()
    casa = next(a for loc in arv for a in loc["areas"] if a["descricao"].startswith("ED-1800AA-06"))
    ativ = client.get("/api/cronograma/atividades", params={"area_id": casa["id"]}).json()
    assert ativ and all(x["id_crono"] for x in ativ)
