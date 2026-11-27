"""O número da pessoa na equipe escrito de outro jeito ("0115013" no Simova, "115.013"/115013 no DP) acha a pessoa do
efetivo: função, de-para (composição/capacidade), a equipe na lista do efetivo e na presença."""
from tests.test_efetivo import efetivo


def test_equipe_acha_a_pessoa_com_zero_a_esquerda(client):
    client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
    client.put("/api/efetivo/funcoes", json={"itens": [{"funcao": "PEDREIRO", "recurso": "Pedreiro"}]})
    cs = {c["nome"]: c for c in client.get("/api/efetivo/colaboradores").json()}
    ped = cs["PEDREIRO TESTE DOIS"]
    assert client.put(f"/api/efetivo/colaboradores/{ped['id']}/cracha", json={"cracha": "115013"}).status_code == 200
    r = client.post("/api/equipes", json={"nome": "EQUIPE ZERO", "membros": [
        {"cracha": "0115013", "nome": "PEDREIRO TESTE DOIS"},   # crachá gravado sem o zero
        {"cracha": "115.014", "nome": "SERVENTE TESTE TRES"},  # só a matrícula, escrita com ponto
        {"cracha": "999999", "nome": "NINGUEM"}]})
    assert r.status_code == 201, r.text
    eq = next(e for e in client.get("/api/equipes").json() if e["nome"] == "EQUIPE ZERO")
    m = {x["nome"]: x for x in eq["membros"]}
    assert m["PEDREIRO TESTE DOIS"]["efetivo"]["funcao"] == "PEDREIRO" and m["PEDREIRO TESTE DOIS"]["efetivo"]["funcao_cpu"] == "Pedreiro"
    assert m["SERVENTE TESTE TRES"]["efetivo"]["funcao"] == "SERVENTE" and m["SERVENTE TESTE TRES"]["efetivo"]["funcao_cpu"] is None
    assert m["NINGUEM"]["efetivo"] is None and eq["fora_do_efetivo"] == 1
    assert any(c["recurso"] == "Pedreiro" for c in eq["composicao_efetiva"])  # entra na composição (capacidade)

    lista = {c["nome"]: c for c in client.get("/api/efetivo/colaboradores").json()}
    assert lista["PEDREIRO TESTE DOIS"]["equipe"] == "EQUIPE ZERO" and lista["SERVENTE TESTE TRES"]["equipe"] == "EQUIPE ZERO"
    base = {p["nome"]: p for p in client.get("/api/presenca/base").json()["pessoas"]}
    assert base["PEDREIRO TESTE DOIS"]["equipe_id"] == eq["id"]


def test_pessoa_so_com_matricula_com_zero_entra_pelo_organograma(client):
    """O caso da obra: matrícula "099800" no DP (sem crachá) e a pessoa incluída pelo organograma/apontador — a equipe
    mostra a função dela e o de-para entra na composição."""
    r = client.post("/api/efetivo/colaboradores", json={"nome": "ADRIANO TESTE NAPOLES", "matricula": "099800",
                                                        "funcao": "SUPERVISOR DE SEGURANCA DO TRABALHO", "situacao": "MOBILIZADO"})
    assert r.status_code in (200, 201), r.text
    client.put("/api/efetivo/funcoes", json={"itens": [{"funcao": "SUPERVISOR DE SEGURANCA DO TRABALHO", "recurso": "Supervisor"}]})
    eq = client.post("/api/equipes", json={"nome": "EQUIPE SSMA"}).json()
    r = client.post(f"/api/equipes/{eq['id']}/membros", json={"cracha": "099800"})
    assert r.status_code == 200, r.text
    m = r.json()["membros"][0]
    assert m["efetivo"] is not None and m["efetivo"]["funcao"] == "SUPERVISOR DE SEGURANCA DO TRABALHO", m
    assert m["efetivo"]["funcao_cpu"] == "Supervisor" and r.json()["fora_do_efetivo"] == 0
    lista = {c["nome"]: c for c in client.get("/api/efetivo/colaboradores").json()}
    assert lista["ADRIANO TESTE NAPOLES"]["equipe"] == "EQUIPE SSMA"


def test_codigo_normal():
    from app.modules.efetivo.infra.gateway import PorCodigo, codigo_normal

    assert codigo_normal("099800") == codigo_normal(99800) == codigo_normal("99800.0") == codigo_normal(" 99.800 ") == "99800"
    assert codigo_normal("T77") == "T77" and codigo_normal(None) == ""
    d = PorCodigo({"115013": "a"}, {"115013": {1: "a"}, "77": {2: "b", 3: "c"}})
    assert d.get("0115013") == "a" and d["0115013"] == "a" and "0115013" in d
    assert d.get("077") is None and "077" not in d  # duas pessoas com o mesmo número: não chuta
