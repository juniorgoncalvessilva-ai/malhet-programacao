"""Fluxo ponta a ponta: cadastros Simova → versões de referência → vínculo → equipe →
programação com capacidade → aprovação → FT_IMPORT_INTERMEDIARIA."""
from io import BytesIO
from pathlib import Path

from openpyxl import Workbook, load_workbook

from app.modules.integracao_simova.domain import layout

DADOS = Path(__file__).resolve().parents[1] / "data" / "simova"


def planilha_auxiliar() -> bytes:
    wb = Workbook()
    a = wb.active
    a.title = "ATIVIDADES"
    a.append(["rotulo", "area", "tag", "id_crono", "atividade", "wbs", "status", "inicio", "fim", "os", "unid",
              "qtd_takeoff", "fonte_qtd", "realizado_crono", "item_pq", "cod_atividade", "pu", "profis", "composicao"])
    a.append(["C-1 | Forma", "CWA 004.00", None, "C-1", "Forma da canaleta", "Drenagem", "Not Started",
              "2026-11-09 09:00:00", "2026-11-20 18:00:00", "OS1", "m²", 120, "IWP", 0, "1.2.3", None, 100, 5, "ESP.1"])
    p = wb.create_sheet("PQ")
    p.append(["item", "descricao", "unid", "quantidade", "pu", "peso_profis", "grupo", "subgrupo", "composicao",
              "recurso_governa", "coef_governa", "atividades_no_cronograma"])
    p.append(["1.2.3", "Forma de madeira", "m²", 500, 100, 5, "FORMAS", "FORMA", "ESP.1", "Carpinteiro", 3, 1])
    r = wb.create_sheet("RECURSOS")
    r.append(["composicao", "recurso", "tipo", "unid_recurso", "coef_por_unidade"])
    r.append(["ESP.1", "Carpinteiro", "MOD", "HH", 3.0])
    r.append(["ESP.1", "Servente", "MOD", "HH", 1.0])
    r.append(["ESP.1", "Munck", "EQU", "H", 0.2])
    i = wb.create_sheet("ÍNDICES")
    for _ in range(3):
        i.append([None])
    i.append(["Código", "Função", "Unid", "Índice", "Ajudante", "Ajud/oficial", "Fonte"])
    i.append(["Carpinteiro - forma", "Carpinteiro", "m²", 2.84, "Servente", 0.38, "Resumo"])
    e = wb.create_sheet("EQUIPES")
    e.append(["EQUIPES"])
    e.append([None, None, None, None, "MOD", "MOD", "EQU"])
    e.append([None])
    e.append(["Equipe", "Local", "Encarregado", "Obs", "Carpinteiro", "Servente", "Munck"])
    e.append(["EQ-FORMA", "NOVO CMD", "Wilson", "Carpintaria", 2, 1, 1])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_fluxo_completo(client):
    # 1) cadastros Simova (arquivos reais do Simova)
    with open(DADOS / "OPER.xlsx", "rb") as fo, open(DADOS / "FRENTE.xlsx", "rb") as ff:
        r = client.post("/api/simova/importar/cadastros", files={"oper": fo, "frente": ff})
    assert r.status_code == 200, r.text
    rel = r.json()
    assert rel["contagem"]["oper"] == 33 and rel["contagem"]["frente"] == 41
    assert any("repetidos" in a for a in rel["avisos"])
    assert len(client.get("/api/cadastros/opers", params={"grupo": "4"}).json()) >= 4

    # 2) versões de referência a partir da planilha auxiliar
    aux = planilha_auxiliar()
    r = client.post("/api/referencias/versoes/carregar", data={"rotulo": "P6 rev 12"},
                    files={"arquivo": ("aux.xlsx", aux)})
    assert r.status_code == 200, r.text
    assert r.json()["contagem"] == {"CRONOGRAMA": 1, "PQ": 1, "CPU": 3, "INDICES": 1}
    vig = client.get("/api/referencias/vigentes").json()
    assert set(vig) == {"CRONOGRAMA", "PQ", "CPU", "INDICES", "SIMOVA"}

    # nova versão do cronograma vira a vigente; a anterior deixa de ser
    client.post("/api/referencias/versoes/carregar", data={"rotulo": "P6 rev 13", "tipos": "CRONOGRAMA"},
                files={"arquivo": ("aux.xlsx", aux)})
    crono = client.get("/api/referencias/versoes", params={"tipo": "CRONOGRAMA"}).json()
    assert [v["vigente"] for v in crono] == [True, False] and crono[0]["rotulo"] == "P6 rev 13"

    # 3) vínculo: atividade C-1 ↔ OPER 4/1.1 do Simova
    r = client.post("/api/referencias/vinculos", json={"id_crono": "C-1", "simova_grupo_codigo": "4",
                                                       "simova_oper_codigo": "1.1", "frente_codigo": "30"})
    assert r.status_code == 201, r.text
    vid = r.json()["id"]
    res = client.get(f"/api/referencias/vinculos/{vid}/resolver").json()
    assert res["item_pq"] == "1.2.3" and res["composicao"] == "ESP.1"
    assert res["recurso_governa"] == "Carpinteiro" and res["hh_por_unidade"] == 4.0  # 3 + 1 (só MOD)
    assert res["indice_orcado_un_dia"] == 3.0 and res["pendencias"] == []
    assert client.post("/api/referencias/vinculos", json={"simova_grupo_codigo": "4",
                                                          "simova_oper_codigo": "1.1"}).status_code == 422

    # 4) equipe do encarregado (importada da aba EQUIPES e ligada ao crachá)
    assert client.post("/api/equipes/importar", files={"arquivo": ("aux.xlsx", aux)}).json()["equipes"] == 1
    eq = client.get("/api/equipes").json()[0]
    assert eq["hh_disponivel_dia"] == 27.0  # (2 + 1) MOD × 9 h
    client.put(f"/api/equipes/{eq['id']}", json={**eq, "encarregado_cracha": "113321"})

    # 5) programação: PE 5 m² → HH = 5 × 4 = 20 (cabe em 27); depois excesso bloqueado
    item = {"encarregado_cracha": "113321", "encarregado_nome": "Wilson Porcino da Silva", "grupo_codigo": "4",
            "oper_codigo": "1.1", "frente_codigo": "30", "data_inicio": "2026-11-09", "data_fim": "2026-11-13",
            "dias": [{"data": "2026-11-09", "pe": 5}, {"data": "2026-11-10", "pe": 6}]}
    r = client.post("/api/programacao/itens", json=item)
    assert r.status_code == 201, r.text
    out = r.json()
    assert out["item"]["origem"] == "cronograma" and out["item"]["id_crono"] == "C-1"
    assert [d["hh"] for d in out["item"]["dias"]] == [20.0, 24.0]
    assert set(out["item"]["versoes"]) >= {"CRONOGRAMA", "PQ", "CPU", "SIMOVA"}
    item_id = out["item"]["id"]

    r = client.post("/api/programacao/itens", json={**item, "oper_codigo": "1.3",
                                                    "dias": [{"data": "2026-11-09", "hh": 10}]})
    assert r.status_code == 422 and "Capacidade da equipe excedida" in r.json()["detail"]
    r = client.post("/api/programacao/itens", json={**item, "oper_codigo": "1.3", "permitir_excesso": True,
                                                    "dias": [{"data": "2026-11-09", "hh": 10}]})
    assert r.status_code == 201 and r.json()["avisos"]

    cap = client.get("/api/programacao/capacidade", params={"encarregado": "113321", "inicio": "2026-11-09",
                                                             "fim": "2026-11-13"}).json()
    assert cap[0] == {"data": "2026-11-09", "hh_disponivel": 27.0, "hh_programado": 30.0, "saldo": -3.0,
                      "excedido": True}

    # 6) aprovar e exportar a FT no layout do Simova
    assert client.post(f"/api/programacao/itens/{item_id}/aprovar").json()["status"] == "aprovado"
    r = client.get("/api/simova/exportar/ft", params={"inicio": "2026-11-09", "fim": "2026-11-15"})
    assert r.status_code == 200 and r.headers["x-itens"] == "1"
    ws = load_workbook(BytesIO(r.content)).active
    linhas = list(ws.iter_rows(values_only=True))
    assert list(linhas[0]) == layout.FT_IMPORT_INTERMEDIARIA
    row = dict(zip(linhas[0], linhas[1]))
    assert row["CRACHA_ENCARREGADO"] == "113321" and row["CODIGO_OPER"] == "1.1" and row["CODIGO_FRENTE"] == "30"
    assert row["DATA_INICIO"] == "09/11/2026" and row["PE_SEGUNDA"] == "5" and row["HH_TERCA"] == "24"
    assert client.get("/api/programacao/itens", params={"inicio": "2026-11-09", "fim": "2026-11-15",
                                                        "status": "exportado"}).json()[0]["id"] == item_id
    assert client.delete(f"/api/programacao/itens/{item_id}").status_code == 422  # exportado não se exclui

    # 7) OPER criada na aplicação → pendente para retroalimentar o Simova
    r = client.post("/api/cadastros/opers", json={"codigo": "10.1", "descricao": "Forma de bloco", "grupo_codigo": "4"})
    assert r.status_code == 201 and r.json()["pendente_envio_simova"]
    r = client.get("/api/simova/exportar/opers-pendentes")
    assert r.headers["x-itens"] == "1"


def test_importar_ft_existente(client):
    with open(DADOS / "OPER.xlsx", "rb") as fo, open(DADOS / "FRENTE.xlsx", "rb") as ff:
        client.post("/api/simova/importar/cadastros", files={"oper": fo, "frente": ff})
    wb = Workbook()
    ws = wb.active
    ws.title = "FT_IMPORT_INTERMEDIARIA"
    ws.append(layout.FT_IMPORT_INTERMEDIARIA)
    linha = dict.fromkeys(layout.FT_IMPORT_INTERMEDIARIA)
    linha.update({"CRACHA_ENCARREGADO": "1", "NOME_ENCARREGADO": "Fulano", "CODIGO_GRUPO": "1", "CODIGO_OPER": "1.4",
                  "DESCRICAO_GRUPO": "Concreto", "DESCRICAO_OPER": "Concreto magro", "CODIGO_FRENTE": "30",
                  "DATA_INICIO": "06/11/2026", "DATA_FIM": "07/11/2026", "PE_SABADO": "2"})
    ws.append([linha[c] for c in layout.FT_IMPORT_INTERMEDIARIA])
    ws.append(["x"] + [None] * 27)  # linha inválida
    buf = BytesIO()
    wb.save(buf)
    r = client.post("/api/simova/importar/ft", files={"arquivo": ("ft.xlsx", buf.getvalue())}).json()
    assert r["importados"] == 1 and len(r["erros"]) == 1
    itens = client.get("/api/programacao/itens", params={"inicio": "2026-11-06", "fim": "2026-11-07"}).json()
    assert itens[0]["status"] == "aprovado" and itens[0]["dias"] == [{"data": "2026-11-07", "pe": 2.0, "hh": None}]
