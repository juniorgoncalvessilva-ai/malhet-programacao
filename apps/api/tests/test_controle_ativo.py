"""Spec 133: controle de projetos por ativo — a planilha da obra liga cada projeto ao ativo/CWA (frente). TAG/CWA confirmam a
frente, o nome só sugere; cancelado não liga (e tira a sugestão antiga); fora da LDO só é listado; ativo sem frente é relacionado
à mão. A situação por frente vai para a WBS e o plano. O arquivo real do cliente fica fora do git (ATIVO_REAL)."""
import io
import os

import pytest
from openpyxl import Workbook, load_workbook

from app.modules.documentos.domain import controle_ativo as ca
from tests.test_ldo_contrato import _cwa, _ldo


def _controle() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Planilha1"
    linhas = [
        [None],
        ["STATUS", "Ativo", "Projeto", "Disciplina", "OBS:"],
        ["CMD"],
        ["OK (Ressalva de ajuste)", "CWA 004.05 - ED-1800AA-01 - Galpão de resíduos classe II", "1800AA-C-52640", "Forma", None],
        [None, None, "1800AA-E-51286", "Aterramento", "N/A"],
        ["Pendente", "CWA 004.09 - ED-1800AA-07 - DIR\nCWA 004.04 - ED-1800AA-02 - Galpão de resíduos classe I", "1800AA-C-52641", "Aço", "Cancelado"],
        [None, None, "9999AA-C-00001", "Forma", None, "projeto do fornecedor"],
        ["OFICINA"],
        ["Sem projeto (Demolição)", "Piso de concreto - Área X", "SEM PROJETOS"],
        ["Parc. Ok", "Galpão de resíduos classe I", "1800AA-A-52642.REV.A_APR", "Cerca"],
        [None, None, "1800AA-A-52640", "Cerca"],
    ]
    for l in linhas:
        ws.append(l)
    ws.merge_cells("A3:E3")
    ws.merge_cells("A4:A5")
    ws.merge_cells("B4:B5")
    ws.merge_cells("A6:A7")
    ws.merge_cells("B6:B7")
    ws.merge_cells("A8:E8")
    b = io.BytesIO()
    wb.save(b)
    return b.getvalue()


def test_leitura_do_controle():
    assert ca.status_chave("OK\n(Ressalva de atividades extra-escopo)") == "ok"
    assert ca.status_chave("Parc. Ok") == "parcial" and ca.status_chave("Pendência de informações críticas") == "critico"
    assert ca.status_chave("Sem projeto (Demolição)") == "sem_projeto" and ca.status_chave("Pendente") == "pendente"
    r = ca.ler_ref("CWA 011.05 -SE-1600AA-03 - Subestação")
    assert (r.cwa, r.tag, r.descricao) == ("011.05", "SE-1600AA-03", "Subestação")
    r = ca.ler_ref("CWA 014.01 - ED-1670AA-FILT-LUB - Galpão de Regeneração")
    assert (r.cwa, r.tag) == ("014.01", "ED-1670AA-FILT-LUB")
    assert ca.ler_ref("CWA 020 e 019 - IF-1600AA-01 - Infraestrutura").cwa == "020"
    assert ca.ler_ref("Piso de concreto - Área X").tag is None
    p = ca.ler_projeto("1720AA-C-52931.REV.A_APR", "Planta", "Revisão A", 9)
    assert (p.codigo, p.revisao, p.cancelado) == ("1720AA-C-52931", "A", False)
    assert ca.ler_projeto("SEM PROJETOS", None, None, 1).codigo is None
    assert ca.ler_projeto("LM-1870AA-E-51853", "SPDA", "Cancelado", 1).cancelado
    wb = load_workbook(io.BytesIO(_controle()), data_only=True)
    lt = ca.ler([tuple(x) for x in wb.active.iter_rows(values_only=True)])
    assert [(a.grupo, a.status, len(a.refs), len(a.projetos)) for a in lt.ativos] == [
        ("CMD", "ok", 1, 2), ("CMD", "pendente", 2, 2), ("OFICINA", "sem_projeto", 1, 1), ("OFICINA", "parcial", 1, 2)]
    assert lt.ativos[1].projetos[1].obs == "projeto do fornecedor"  # coluna sem nome depois de OBS vira observação


def test_controle_liga_projetos_as_frentes(client):
    client.post("/api/frentes/planilha", data={"aba": "CWAs Cardan", "empresas": "CARDAN"}, files={"arquivo": ("cwa.xlsx", _cwa())})
    client.post("/api/documentos/ldo", files={"arquivo": ("ldo.xlsx", _ldo())})
    areas = {a["codigo"]: a["id"] for l in client.get("/api/frentes").json() for a in l["areas"]}
    docs = {d["codigo"]: d["id"] for d in client.get("/api/documentos").json()}

    def ligacoes(codigo):
        det = client.get(f"/api/documentos/{docs[codigo]}").json()
        return {(v["alvo_id"], v["sugerido"]) for v in det["vinculos"] if v["relacao"] == "aplica_a" and v["alvo_tipo"] == "area"}

    assert ligacoes("1800AA-C-52641") == {(areas["004.04"], True)}  # a LDO sugeriu pelo nome "Classe I"
    p = client.post("/api/documentos/ativos/previa", files={"arquivo": ("controle.xlsx", _controle())}).json()
    assert (p["ativos"], p["frentes_confirmadas"], p["frentes_sugeridas"], p["sem_frente"]) == (4, 3, 1, ["Piso de concreto - Área X"])
    assert (p["projetos"], p["cancelados"], p["na_ldo"], p["fora_ldo"]) == (5, 1, 3, ["9999AA-C-00001", "1800AA-A-52640"])
    assert client.get("/api/documentos/ativos").json()["ativos"] == []  # a prévia não grava

    r = client.post("/api/documentos/ativos", files={"arquivo": ("controle.xlsx", _controle())}).json()
    assert r["sugestoes_removidas"] == 1  # 52641 cancelado no ativo: a sugestão da LDO para a 004.04 sai
    assert ligacoes("1800AA-C-52640") == {(areas["004.05"], False)}  # TAG confirmou a sugestão da LDO
    assert ligacoes("1800AA-E-51286") == {(areas["004.05"], False)}
    assert ligacoes("1800AA-C-52641") == set()
    assert ligacoes("1800AA-A-52642") == {(areas["004.04"], True)}  # só o nome: fica sugerida

    lst = client.get("/api/documentos/ativos").json()
    assert (lst["totais"]["ativos"], lst["totais"]["sem_frente"], lst["totais"]["a_confirmar"], lst["totais"]["fora_ldo"]) == (4, 1, 1, 2)
    sit = {p["codigo"]: p["situacao"] for a in lst["ativos"] for p in a["projetos"] if p["codigo"]}
    assert sit == {"1800AA-C-52640": "vigente", "1800AA-E-51286": "vigente", "1800AA-C-52641": "cancelado",
                   "9999AA-C-00001": "fora_ldo", "1800AA-A-52642": "sem_vigente", "1800AA-A-52640": "fora_ldo"}
    dica = {p["codigo"]: p["parecidos"] for a in lst["ativos"] for p in a["projetos"] if p["codigo"]}
    assert dica["1800AA-A-52640"] == ["1800AA-C-52640"] and dica["9999AA-C-00001"] == []  # mesma área e número: só a dica
    assert lst["ativos"][1]["refs"][0]["area"].startswith("004.09.2")

    st = client.get("/api/documentos/ativos/situacao").json()
    a05, dir_, a04 = st[str(areas["004.05"])], st[str(areas["004.09.2"])], st[str(areas["004.04"])]
    assert (a05["status"], a05["libera"], a05["vigentes"], a05["total"]) == ("ok", True, 2, 2)
    assert a05["memoria"]["valor"] == "2/2" and a05["memoria"]["fontes"][0]["local"] == "linha 4"
    assert (dir_["status"], dir_["libera"], dir_["total"]) == ("pendente", False, 1)
    assert (a04["status"], a04["confirmada"]) == ("pendente", False)  # o pior dos dois ativos; um deles só sugerido
    assert str(areas["004.09.1"]) not in st

    # relacionar à mão: o ativo sem frente e a sugestão
    piso = lst["ativos"][2]
    assert client.put(f"/api/documentos/ativos/{piso['id']}/frente", json={"indice": 0, "area_id": areas["004.09.1"]}).json() == {"ligados": 0}
    cerca = lst["ativos"][3]
    assert client.put(f"/api/documentos/ativos/{cerca['id']}/frente", json={"indice": 0, "area_id": areas["004.04"]}).json() == {"ligados": 1}
    assert ligacoes("1800AA-A-52642") == {(areas["004.04"], False)}
    assert ligacoes("1800AA-C-52640") == {(areas["004.05"], False)}  # a dica não ligou o 52640 à 004.04
    st = client.get("/api/documentos/ativos/situacao").json()
    assert st[str(areas["004.09.1"])]["status"] == "sem_projeto" and st[str(areas["004.04"])]["confirmada"] is True
    assert client.put(f"/api/documentos/ativos/{cerca['id']}/frente", json={"indice": 3, "area_id": None}).status_code == 422

    # reimportar substitui o controle e não duplica ligações
    client.post("/api/documentos/ativos", files={"arquivo": ("controle.xlsx", _controle())})
    assert client.get("/api/documentos/ativos").json()["totais"]["ativos"] == 4
    assert ligacoes("1800AA-C-52640") == {(areas["004.05"], False)}

    # por obra
    outra = client.post("/api/admin/obras", json={"codigo": "OUT-ATV", "nome": "Outra"}).json()["id"]
    h = {"X-Obra-Id": str(outra)}
    assert client.get("/api/documentos/ativos", headers=h).json()["ativos"] == []
    assert client.get("/api/documentos/ativos/situacao", headers=h).json() == {}
    assert client.put(f"/api/documentos/ativos/{cerca['id']}/frente", json={"indice": 0, "area_id": None}, headers=h).status_code == 404
    assert client.post("/api/documentos/ativos/previa", files={"arquivo": ("x.xlsx", b"nada")}).status_code == 422


@pytest.mark.skipif(not os.environ.get("ATIVO_REAL"), reason="arquivo real do cliente fora do git (ATIVO_REAL=caminho)")
def test_controle_real():
    with open(os.environ["ATIVO_REAL"], "rb") as f:
        wb = load_workbook(f, data_only=True)
    lt = ca.ler([tuple(x) for x in wb.worksheets[0].iter_rows(values_only=True)])
    assert len(lt.ativos) > 50 and sum(len(a.projetos) for a in lt.ativos) > 400
