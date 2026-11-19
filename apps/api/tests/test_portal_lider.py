"""Spec 111: link dos líderes — o encarregado entra com matrícula + 123456, cria a senha, vê a equipe, informa quem foi
transferido para outro encarregado e traz gente pela matrícula/nome; o Planejamento cadastra líderes sem a função de
encarregado e controla o acesso."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.lideres.application.portal import TENTATIVAS
from app.modules.lideres.domain.portal import EquipeDoLider, Tentativas, equipes_do_lider, validar_nova_senha
from app.shared.errors import DomainError
from tests.test_efetivo import efetivo


@pytest.fixture(autouse=True)
def _zerar():
    TENTATIVAS.zerar()


def test_regras():
    assert validar_nova_senha("obra2026", "obra2026") == "obra2026"
    for ruim in ("123456", "111111", "12345", "x" * 21):
        with pytest.raises(DomainError):
            validar_nova_senha(ruim)
    with pytest.raises(DomainError):
        validar_nova_senha("obra2026", "obra2027")
    eqs = [EquipeDoLider(1, "90", None, None), EquipeDoLider(2, "91", 7, None), EquipeDoLider(3, "92", None, 7),
           EquipeDoLider(4, "93", None, None), EquipeDoLider(5, "90", None, None, ativo=False)]
    assert equipes_do_lider({"90"}, 1, set(), eqs) == [1]
    assert equipes_do_lider({"x"}, 7, {4}, eqs) == [2, 3, 4]
    t = Tentativas(maximo=2, janela=10)
    t.errou("a", 0)
    t.errou("a", 1)
    assert t.bloqueado("a", 2) and not t.bloqueado("a", 12)


def _publico() -> TestClient:
    return TestClient(app)  # sem conta do Malhet e sem X-Obra-Id: como o celular do encarregado


def test_portal_do_encarregado(client):
    client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
    cs = {c["nome"]: c for c in client.get("/api/efetivo/colaboradores").json()}
    enc, ped, srv, cand = (cs[n] for n in ("ENCARREGADO TESTE UM", "PEDREIRO TESTE DOIS", "SERVENTE TESTE TRES", "CANDIDATO TESTE"))
    a = client.post("/api/efetivo/equipes", json={"nome": "EQUIPE.1_FORMA", "encarregado_id": enc["id"], "colaboradores": [ped["id"]]}).json()
    client.put(f"/api/efetivo/colaboradores/{cand['id']}/cracha", json={"cracha": "T77"})
    b = client.post("/api/efetivo/equipes", json={"nome": "EQUIPE.2_CONCRETO", "encarregado_id": cand["id"], "colaboradores": []}).json()

    g = client.get("/api/lideres").json()
    cod = g["link"]["codigo"]
    assert len(cod) == 12 and {x["nome"] for x in g["lideres"]} >= {"ENCARREGADO TESTE UM", "CANDIDATO TESTE"}
    assert next(x for x in g["lideres"] if x["nome"] == "ENCARREGADO TESTE UM")["situacao"] == "nunca_entrou"

    w = _publico()
    assert w.get(f"/api/portal/{cod}").json()["obra"]
    assert w.get("/api/portal/naoexiste").status_code == 404
    # quem não é líder não entra, nem com 123456; senha errada também não
    assert w.post(f"/api/portal/{cod}/entrar", json={"matricula": "115013", "senha": "123456"}).status_code == 422
    assert w.post(f"/api/portal/{cod}/entrar", json={"matricula": "115011", "senha": "000000"}).status_code == 422
    r = w.post(f"/api/portal/{cod}/entrar", json={"matricula": "115.011", "senha": "123456"}).json()
    assert r["trocar_senha"] and r["nome"] == "ENCARREGADO TESTE UM"
    h = {"X-Portal-Token": r["token"]}
    assert w.get(f"/api/portal/{cod}/equipes", headers=h).status_code == 422  # antes, criar a senha
    assert w.post(f"/api/portal/{cod}/senha", headers=h, json={"nova": "123456", "repetida": "123456"}).status_code == 422
    r = w.post(f"/api/portal/{cod}/senha", headers=h, json={"nova": "forma2026", "repetida": "forma2026"}).json()
    h = {"X-Portal-Token": r["token"]}
    assert w.post(f"/api/portal/{cod}/entrar", json={"matricula": "115011", "senha": "123456"}).status_code == 422  # a inicial não vale mais

    eq = w.get(f"/api/portal/{cod}/equipes", headers=h).json()
    assert [e["nome"] for e in eq["equipes"]] == ["EQUIPE.1_FORMA"]
    assert [m["nome"] for m in eq["equipes"][0]["membros"]] == ["PEDREIRO TESTE DOIS"]
    assert [d["encarregado"] for d in eq["destinos"]] == ["CANDIDATO TESTE"]

    # traz o servente pelo nome
    achados = w.get(f"/api/portal/{cod}/buscar", headers=h, params={"q": "servente"}).json()
    assert achados[0]["nome"] == "SERVENTE TESTE TRES" and achados[0]["equipe"] is None
    assert w.post(f"/api/portal/{cod}/incluir", headers=h, json={"equipe_id": a["id"], "cracha": achados[0]["cracha"]}).status_code == 200
    assert w.post(f"/api/portal/{cod}/incluir", headers=h, json={"equipe_id": b["id"], "cracha": "115014"}).status_code == 422  # não é dele
    # o pedreiro foi transferido para o outro encarregado; o servente "não sei para onde foi"
    assert w.post(f"/api/portal/{cod}/transferir", headers=h, json={"equipe_id": a["id"], "cracha": "115013",
                                                                     "para_equipe_id": b["id"]}).status_code == 200
    assert w.post(f"/api/portal/{cod}/transferir", headers=h, json={"equipe_id": a["id"], "cracha": "115014"}).status_code == 200
    eqs = {e["id"]: e for e in client.get("/api/equipes").json()}
    assert not eqs[a["id"]]["membros"] and [m["nome"] for m in eqs[b["id"]]["membros"]] == ["PEDREIRO TESTE DOIS"]
    hist = client.get("/api/equipes/movimentacoes").json()["itens"]
    assert ("PEDREIRO TESTE DOIS", "EQUIPE.1_FORMA", "EQUIPE.2_CONCRETO") in [(i["nome"], i["de"], i["para"]) for i in hist]
    assert all(i["por"].startswith("líder") for i in hist if i["nome"] == "SERVENTE TESTE TRES")

    # Planejamento: líder sem a função de encarregado, com a equipe A; bloquear derruba a sessão; redefinir volta a 123456
    mot = cs["MOTORISTA TERCEIRO"]
    client.put(f"/api/efetivo/colaboradores/{mot['id']}/cracha", json={"cracha": "M10"})
    assert client.post("/api/lideres", json={"colaborador_id": mot["id"], "equipes": [a["id"]]}).status_code == 201
    r = w.post(f"/api/portal/{cod}/entrar", json={"matricula": "M10", "senha": "123456"}).json()
    hm = {"X-Portal-Token": w.post(f"/api/portal/{cod}/senha", headers={"X-Portal-Token": r["token"]},
                                   json={"nova": "lider2026", "repetida": "lider2026"}).json()["token"]}
    assert [e["nome"] for e in w.get(f"/api/portal/{cod}/equipes", headers=hm).json()["equipes"]] == ["EQUIPE.1_FORMA"]
    client.put(f"/api/lideres/{mot['id']}", json={"ativo": False})
    assert w.get(f"/api/portal/{cod}/equipes", headers=hm).status_code == 422
    assert w.post(f"/api/portal/{cod}/entrar", json={"matricula": "M10", "senha": "lider2026"}).status_code == 422
    client.put(f"/api/lideres/{mot['id']}", json={"ativo": True})
    client.post(f"/api/lideres/{enc['id']}/redefinir")
    assert w.get(f"/api/portal/{cod}/equipes", headers=h).status_code == 422  # sessão antiga caiu
    assert w.post(f"/api/portal/{cod}/entrar", json={"matricula": "115011", "senha": "123456"}).json()["trocar_senha"]
    lst = {x["nome"]: x for x in client.get("/api/lideres").json()["lideres"]}
    assert lst["MOTORISTA TERCEIRO"]["papeis"] == ["cadastrado"] and lst["ENCARREGADO TESTE UM"]["situacao"] == "senha_inicial"
    # link novo: o antigo para de funcionar
    novo = client.post("/api/lideres/link/novo").json()["codigo"]
    assert novo != cod and w.get(f"/api/portal/{cod}").status_code == 404 and w.get(f"/api/portal/{novo}").status_code == 200
    client.delete(f"/api/lideres/{mot['id']}")
    assert "MOTORISTA TERCEIRO" not in {x["nome"] for x in client.get("/api/lideres").json()["lideres"]}


def test_muitas_tentativas_bloqueiam(client):
    client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
    cs = {c["nome"]: c for c in client.get("/api/efetivo/colaboradores").json()}
    client.post("/api/efetivo/equipes", json={"nome": "EQ", "encarregado_id": cs["ENCARREGADO TESTE UM"]["id"]})
    cod = client.get("/api/lideres").json()["link"]["codigo"]
    w = _publico()
    for _ in range(5):
        w.post(f"/api/portal/{cod}/entrar", json={"matricula": "115011", "senha": "errada1"})
    r = w.post(f"/api/portal/{cod}/entrar", json={"matricula": "115011", "senha": "123456"})
    assert r.status_code == 422 and "muitas tentativas" in r.json()["detail"]
