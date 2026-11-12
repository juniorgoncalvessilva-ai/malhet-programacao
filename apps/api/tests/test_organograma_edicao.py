"""Spec 049: incluir, mover e tirar pessoas das equipes pelo organograma."""
from tests.test_efetivo import efetivo


def _pessoas(no, out=None):
    out = [] if out is None else out
    out.extend({**p, "no": no["titulo"]} for p in no["pessoas"])
    for f in no["filhos"]:
        _pessoas(f, out)
    return out


def _equipes(no, out=None):
    out = {} if out is None else out
    if no["tipo"] == "equipe":
        out[no["titulo"]] = no["ref"]
    for f in no["filhos"]:
        _equipes(f, out)
    return out


def test_mexer_nas_equipes_pelo_organograma(client):
    client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
    cs = {c["nome"]: c for c in client.get("/api/efetivo/colaboradores").json()}
    enc, ped, srv = cs["ENCARREGADO TESTE UM"]["id"], cs["PEDREIRO TESTE DOIS"]["id"], cs["SERVENTE TESTE TRES"]["id"]
    a = client.post("/api/efetivo/equipes", json={"nome": "EQ.A", "encarregado_id": enc, "colaboradores": [ped, srv]}).json()
    b = client.post("/api/equipes", json={"nome": "EQ.B"}).json()
    raiz = client.get("/api/efetivo/organograma").json()["raiz"]
    assert _equipes(raiz)["EQ.A"] == a["id"]
    pessoas = {p["nome"]: p for p in _pessoas(raiz)}
    pd = pessoas["PEDREIRO TESTE DOIS"]
    assert (pd["equipe_id"], pd["papel"]) == (a["id"], "membro") and pessoas["ENCARREGADO TESTE UM"]["papel"] == "encarregado"

    # mover o pedreiro de A para B
    r = client.post(f"/api/equipes/{b['id']}/membros", json={"cracha": pd["matricula"], "de_equipe_id": a["id"]})
    assert r.status_code == 200, r.text and [m["nome"] for m in r.json()["membros"]] == ["PEDREIRO TESTE DOIS"]
    eqs = {e["nome"]: e for e in client.get("/api/equipes").json()}
    assert [m["nome"] for m in eqs["EQ.A"]["membros"]] == ["SERVENTE TESTE TRES"]
    # repetido não entra; encarregado não sai por aqui
    assert client.post(f"/api/equipes/{b['id']}/membros", json={"cracha": pd["matricula"]}).status_code == 422
    assert client.delete(f"/api/equipes/{a['id']}/membros/{eqs['EQ.A']['encarregado_cracha']}").status_code == 422
    # tirar o servente: vai para "Sem equipe" no organograma
    srv_cr = eqs["EQ.A"]["membros"][0]["cracha"]
    assert client.delete(f"/api/equipes/{a['id']}/membros/{srv_cr}").status_code == 204
    sem = {p["nome"]: p for p in _pessoas(client.get("/api/efetivo/organograma").json()["raiz"]) if p["situacao"] == "sem-equipe"}
    assert "SERVENTE TESTE TRES" in sem
    # e volta para a equipe pelo "Sem equipe" (crachá vem do efetivo)
    assert client.post(f"/api/equipes/{a['id']}/membros", json={"cracha": sem["SERVENTE TESTE TRES"]["matricula"]}).status_code == 200
    # fora do efetivo precisa do nome
    assert client.post(f"/api/equipes/{a['id']}/membros", json={"cracha": "999999"}).status_code == 422
    assert client.post(f"/api/equipes/{a['id']}/membros", json={"cracha": "999999", "nome": "VISITANTE"}).status_code == 200
