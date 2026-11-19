"""Spec 109: atividades longas do P6 (administração local, verbas: ~500 dias) entram no plano; a que não passa não
derruba o lote (antes: 422 em tudo)."""
from tests.test_plano_90 import LISTA, _xer_com_recursos


def _xer_com_longas() -> bytes:
    t = _xer_com_recursos().decode("cp1252")
    longas = ("%R\t6\t1\t23\tC-50\tAdministração Local\tTT_Task\tTK_Active\t2026-07-08 07:00\t2027-11-28 17:00\t2026-07-08 07:00\t\r\n"
              "%R\t7\t1\t23\tC-99\tVerba contratual\tTT_Task\tTK_Active\t2025-01-01 07:00\t2028-12-31 17:00\t2025-01-01 07:00\t\r\n")
    return t.replace("%T\tTASKRSRC", longas + "%T\tTASKRSRC").encode("cp1252")


def test_puxar_atividade_longa_e_recusar_so_a_que_nao_passa(client):
    client.post("/api/frentes/importar", json={"texto": LISTA})
    assert client.post("/api/importar/xer", data={"rotulo": "S48"}, files={"arquivo": ("c.xer", _xer_com_longas())}).status_code == 200
    periodo = {"inicio": "2026-12-01", "fim": "2026-12-31"}
    ids = [a["id_crono"] for a in client.post("/api/planos/cronograma/previa", json=periodo).json()["atividades"]]
    assert {"C-1", "C-2", "C-50", "C-99"} <= set(ids)
    r = client.post("/api/planos/itens/do-cronograma", json=periodo)
    assert r.status_code == 201, r.text
    j = r.json()
    assert j["novos"] == 3 and len(j["recusadas"]) == 1 and j["recusadas"][0].startswith("C-99: janela de até")
    itens = {i["id_crono"]: i for i in client.get("/api/planos", params={"inicio": "2026-12-01"}).json()["itens"]}
    assert (itens["C-50"]["inicio"], itens["C-50"]["fim"]) == ("2026-07-08", "2027-11-28")  # 508 dias, como no P6
    # puxar de novo atualiza sem duplicar; a recusada continua só avisando
    j = client.post("/api/planos/itens/do-cronograma", json=periodo).json()
    assert (j["novos"], j["atualizados"], len(j["recusadas"])) == (0, 3, 1)
    # erro do formulário (equipe de outra obra) vale para todas: 422 antes de gravar
    assert client.post("/api/planos/itens/do-cronograma", json={**periodo, "equipe_id": 999999}).status_code == 422
