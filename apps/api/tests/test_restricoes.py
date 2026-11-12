"""Spec 030: restrições do look-ahead (Plano de Ação 6WLA), Ishikawa e Excel."""
from datetime import date, datetime, timedelta
from io import BytesIO

from openpyxl import Workbook, load_workbook


def _plano() -> bytes:
    wb = Workbook()
    wb.active.title = "Instruções"
    ws = wb.create_sheet("Ações")
    ws["V1"] = "Atualização: 28/10/2026"
    ws["G2"], ws["M2"] = "SEMANA", "PRAZO"
    ws.append([])
    ws.append([None, None, "Nº", "ATIVIDADE", "IMPETITIVO", "AÇÕES ", "INÍCIO", "ÁREA", "ID ", "REUNIÃO", "RESPONSÁVEL",
               "GERÊNCIA", "INÍCIO", "TÉRMINO", "DATA", "nº", "DATA", "STATUS 1", "FAROL", "STATUS 2", "6M ", "OBSERVAÇÕES"])
    ws.delete_rows(3)
    ws.append([None, None, 1, "Planejamento", "SIM", "Liberar a área do radier", "S32", "CMD", None, "6WLA", "Fulano",
               "CONTRATADA", datetime(2026, 11, 2), datetime(2026, 11, 6), None, None, None, "Pendente", 1, "Atrasado", None, None])
    ws.append([None, None, 2, "Implantação", "NÃO", "Energia provisória", "S30", "CMD", None, "6WLA", "Beltrano", "CLIENTE",
               datetime(2026, 10, 20), datetime(2026, 10, 25), None, None, datetime(2026, 10, 24), "Concluído", 4, "Concluído", "MAT", None])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_plano_de_acao_importa_ishikawa_e_exporta(client):
    r = client.post("/api/restricoes/importar", files={"arquivo": ("plano.xlsm", _plano())}).json()
    assert r == {"novas": 2, "atualizadas": 0, "avisos": []}
    assert client.post("/api/restricoes/importar", files={"arquivo": ("plano.xlsm", _plano())}).json()["atualizadas"] == 2
    lista = {a["numero"]: a for a in client.get("/api/restricoes").json()}
    a1 = lista[1]
    assert a1["impeditivo"] is True and a1["semana"] == 31 and a1["status2"] == "Atrasado" and a1["farol"] == 1
    assert lista[2]["status2"] == "Concluído" and lista[2]["seis_m"] == "MAT"
    # reprogramar: nova data e nº + 1 → "Reprogramado" enquanto hoje ≤ data
    nova = (date.today() + timedelta(days=5)).isoformat()
    r = client.post(f"/api/restricoes/{a1['id']}/reprogramar", json={"data": nova, "observacao": "aguardando topografia"}).json()
    assert (r["reprogramacoes"], r["status2"], r["semana"] is not None) == (1, "Reprogramado", True)
    assert "aguardando topografia" in r["observacoes"] and r["observacoes"].startswith(f"{date.today():%d/%m}: reprogramada para")
    corpo = {"acao": "Treinar armadores", "seis_m": "MDO", "prazo_inicio": "2026-11-10", "prazo_termino": "2026-11-05"}
    assert client.post("/api/restricoes", json=corpo).status_code == 422  # término antes do início
    n3 = client.post("/api/restricoes", json={**corpo, "prazo_termino": nova}).json()
    assert n3["numero"] == 3 and n3["status2"] == "No Prazo"
    assert client.post("/api/restricoes", json={**corpo, "seis_m": "XYZ", "prazo_termino": nova}).status_code == 422
    # observação nova entra no topo com a data de hoje; sem nova_observacao o histórico fica
    r = client.put(f"/api/restricoes/{n3['id']}", json={**corpo, "prazo_termino": nova, "nova_observacao": "Turma escalada"}).json()
    assert r["observacoes"] == f"{date.today():%d/%m}: Turma escalada"
    r = client.put(f"/api/restricoes/{n3['id']}", json={**corpo, "prazo_termino": nova, "status1": "Pendente"}).json()
    assert r["observacoes"] == f"{date.today():%d/%m}: Turma escalada"
    ish = client.get("/api/restricoes/ishikawa").json()
    g = ish["graficos"]
    assert {x["rotulo"] for x in g["status"]} >= {"Concluído", "No Prazo"} and g["seis_m"][0]["valores"]["total"]["n"] >= 1
    chave = g["areas"][0]["valores"]["Pendente"]["chave"]
    assert chave in ish["memorias"] and ish["memorias"][chave]["valor"] == str(g["areas"][0]["valores"]["Pendente"]["n"])
    esp = {e["codigo"]: e for e in ish["espinhas"]}
    assert ish["pendentes"] == 2 and esp["MDO"]["pendentes"] == 1 and esp[None]["pendentes"] == 1
    assert ish["memorias"]["6m:MDO"]["valor"] == "1" and "status:Concluído" in ish["memorias"]
    ws = load_workbook(BytesIO(client.get("/api/restricoes/excel").content))["Ações"]
    assert ws["F3"].value == "AÇÕES" and ws["C4"].value == 1 and ws["E4"].value == "SIM"
    assert str(ws["S4"].value).startswith("=IF(") and ws["G4"].value.startswith("S")
    wb = load_workbook(BytesIO(client.get("/api/restricoes/excel").content))
    assert wb.sheetnames == ["Ações", "PAINEL AÇÃO"] and len(wb["PAINEL AÇÃO"]._charts) == 6
    ws = wb["Ações"]
    assert ws["O2"].value == "REPROGRAMADO" and ws["O2"].fill.fgColor.rgb.endswith("FFC000") and ws["Q3"].fill.fgColor.rgb.endswith("C00000")
    regra = ws.conditional_formatting._cf_rules[next(iter(ws.conditional_formatting._cf_rules))][0]
    assert regra.iconSet.iconSet == "4TrafficLights" and regra.iconSet.showValue is False
    assert client.delete(f"/api/restricoes/{n3['id']}").status_code == 204


def test_fotos_de_campo_na_restricao(client):
    jpg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00" + b"\x00" * 64 + b"\xff\xd9"
    a = client.post("/api/restricoes", json={"acao": "Liberar a frente do radier"}).json()
    r = client.post("/api/fotos", data={"alvo": "restricao", "alvo_id": str(a["id"]), "legenda": "frente travada"},
                    files={"arquivo": ("f.jpg", jpg, "image/jpeg")})
    assert r.status_code == 201, r.text
    f = r.json()
    assert f["legenda"] == "frente travada" and f["tamanho"] == len(jpg)
    assert client.post("/api/fotos", data={"alvo": "restricao", "alvo_id": str(a["id"])},
                       files={"arquivo": ("x.jpg", b"nao e foto", "image/jpeg")}).status_code == 422
    assert client.post("/api/fotos", data={"alvo": "restricao", "alvo_id": "999999"},
                       files={"arquivo": ("f.jpg", jpg, "image/jpeg")}).status_code == 404
    assert client.post("/api/fotos", data={"alvo": "xpto", "alvo_id": "1"}, files={"arquivo": ("f.jpg", jpg, "image/jpeg")}).status_code == 422
    lista = {x["id"]: x for x in client.get("/api/restricoes").json()}
    assert lista[a["id"]]["fotos"] == [f["id"]]
    img = client.get(f"/api/fotos/{f['id']}/arquivo")
    assert img.status_code == 200 and img.headers["content-type"] == "image/jpeg" and img.content == jpg
    assert client.delete(f"/api/fotos/{f['id']}").status_code == 204
    assert client.get("/api/fotos", params={"alvo": "restricao", "alvo_id": a["id"]}).json() == []
