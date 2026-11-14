"""Spec 084: o plano de 90 dias puxa da programação corrente (e a linha fica ligada ao item — o ciclo fecha), a WBS
manda atividades para o plano e o look-ahead mostra o caminhar das equipes pelo plano."""
from datetime import date

from app.modules.lookahead.api.router import dias_do_plano
from tests.test_excluir_revisao import _programacao


def test_puxa_da_programacao_sem_duplicar_e_liga_a_linha(client):
    pid = _programacao(client)
    prev = client.get("/api/planos/programacao/previa", params={"pid": pid}).json()
    assert prev["programacao"]["id"] == pid and len(prev["linhas"]) == 1
    ln = prev["linhas"][0]
    assert ln["no_plano"] is None and ln["inicio"] == "2026-11-09" == ln["fim"]  # janela = dias com previsto
    r = client.post("/api/planos/itens/da-programacao", json={"programacao_id": pid}).json()
    assert (r["novos"], r["ligados"], r["ja_estavam"]) == (1, 0, 0)
    itens = client.get("/api/planos").json()["itens"]
    assert len(itens) == 1 and itens[0]["descricao"] == ln["descricao"] and itens[0]["situacao"] == "programado"
    assert itens[0]["programacoes"][0]["id"] == pid  # a linha ficou ligada ao item
    r = client.post("/api/planos/itens/da-programacao", json={"programacao_id": pid}).json()
    assert (r["novos"], r["ja_estavam"]) == (0, 1)
    assert client.get("/api/planos/programacao/previa", params={"pid": pid}).json()["linhas"][0]["no_plano"] == itens[0]["id"]


def test_lookahead_pelo_plano(client):
    pid = _programacao(client)
    client.post("/api/planos/itens/da-programacao", json={"programacao_id": pid})
    it = client.get("/api/planos").json()["itens"][0]
    eq = client.get("/api/equipes").json()
    if eq:
        client.put(f"/api/planos/itens/{it['id']}", json={"descricao": it["descricao"], "area_id": it["area_id"], "tipo_id": it["tipo_id"],
                                                        "equipe_id": eq[0]["id"], "inicio": "2026-11-09", "fim": "2026-11-20", "quantidade": 20})
    r = client.get("/api/lookahead", params={"origem": "plano", "de": "2026-11-09", "ate": "2026-12-31"}).json()
    assert r["origem"] == "plano" and len(r["blocos"]) == 1
    b = r["blocos"][0]
    assert b["plano_item_id"] == it["id"] and b["programacao"].startswith("P90") and b["status"] == "plano"
    if eq:
        assert (b["inicio"], b["fim"]) == ("2026-11-09", "2026-11-20") and len(b["dias"]) == 10  # dias úteis
    assert client.get("/api/lookahead", params={"origem": "outra"}).status_code == 422
    assert len(client.get("/api/lookahead", params={"de": "2026-11-09", "ate": "2026-11-20"}).json()["blocos"]) == 1  # programação segue


def test_dias_do_plano_reparte_e_pula_marco():
    class It:
        def __init__(self, **k):
            self.__dict__.update(dict(id=1, marco=False, area_id=5, equipe_id=2, tipo_id=None, quantidade=10.0, numero=1) | k)
    ds = dias_do_plano([It(inicio=date(2026, 11, 13), fim=date(2026, 11, 17)), It(id=2, marco=True, inicio=date(2026, 11, 13), fim=date(2026, 11, 13))],
                       date(2026, 11, 1), date(2026, 11, 30))
    assert [d.data.day for d in ds] == [13, 16, 17] and ds[0].previsto == round(10 / 3, 4)  # sexta, segunda, terça
    # atividade livre (sem tipo do catálogo) junto com outra com tipo: os blocos se ordenam sem erro
    from app.modules.lookahead.domain.blocos import blocos
    mix = dias_do_plano([It(id=3, tipo_id=None, inicio=date(2026, 11, 16), fim=date(2026, 11, 16)),
                         It(id=4, tipo_id=7, inicio=date(2026, 11, 16), fim=date(2026, 11, 16))], date(2026, 11, 1), date(2026, 11, 30))
    assert len(blocos(mix)) == 2
