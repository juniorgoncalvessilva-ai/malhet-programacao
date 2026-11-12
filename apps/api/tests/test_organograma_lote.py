"""Spec 052: arrastar pessoas em lote, migrar/tirar função inteira e líder intermediário (supervisor)."""
from tests.test_efetivo import efetivo
from tests.test_organograma_edicao import _pessoas


def _arvore(client, vista="setor"):
    return client.get(f"/api/efetivo/organograma?vista={vista}").json()["raiz"]


def test_lote_lideranca_e_supervisor(client):
    client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
    cs = {c["nome"]: c for c in client.get("/api/efetivo/colaboradores").json()}
    enc, ped, srv = cs["ENCARREGADO TESTE UM"]["id"], cs["PEDREIRO TESTE DOIS"]["id"], cs["SERVENTE TESTE TRES"]["id"]
    a = client.post("/api/efetivo/equipes", json={"nome": "EQ.A", "encarregado_id": enc, "colaboradores": [ped, srv]}).json()
    b = client.post("/api/equipes", json={"nome": "EQ.B"}).json()
    ps = {p["nome"]: p for p in _pessoas(_arvore(client))}
    itens = [{"cracha": ps[n]["matricula"], "de_equipe_id": a["id"]} for n in ("PEDREIRO TESTE DOIS", "SERVENTE TESTE TRES", "ENCARREGADO TESTE UM")]
    # arrastar 3 de A para B: o encarregado não sai por aqui (erro), os outros 2 vão
    r = client.post("/api/equipes/membros/lote", json={"itens": itens, "para_equipe_id": b["id"]}).json()
    assert r["feitos"] == 2 and len(r["erros"]) == 1 and "encarregado" in r["erros"][0]
    eqs = {e["nome"]: e for e in client.get("/api/equipes").json()}
    assert {m["nome"] for m in eqs["EQ.B"]["membros"]} == {"PEDREIRO TESTE DOIS", "SERVENTE TESTE TRES"} and not eqs["EQ.A"]["membros"]
    # tirar em lote (soltar em "Sem equipe")
    r = client.post("/api/equipes/membros/lote", json={"itens": [{"cracha": m["cracha"], "de_equipe_id": b["id"]} for m in eqs["EQ.B"]["membros"]]}).json()
    assert r["feitos"] == 2
    assert not next(e for e in client.get("/api/equipes").json() if e["id"] == b["id"])["membros"]
    # volta: incluir em lote quem está sem equipe
    sem = [p for p in _pessoas(_arvore(client)) if p["situacao"] == "sem-equipe" and p["nome"] in ("PEDREIRO TESTE DOIS", "SERVENTE TESTE TRES")]
    assert client.post("/api/equipes/membros/lote", json={"itens": [{"cracha": p["matricula"]} for p in sem], "para_equipe_id": a["id"]}).json()["feitos"] == 2

    # responsável e supervisor (líder intermediário) para as duas equipes de uma vez, qualquer pessoa do efetivo
    resp, sup = cs["MOTORISTA TERCEIRO"], cs["CANDIDATO TESTE"]
    assert client.put("/api/equipes/lideranca/definir", json={"equipes": [a["id"], b["id"]], "papel": "responsavel", "colaborador_id": resp["id"]}).status_code == 200
    assert client.put("/api/equipes/lideranca/definir", json={"equipes": [a["id"], b["id"]], "papel": "supervisor", "colaborador_id": sup["id"]}).status_code == 200
    assert client.put("/api/equipes/lideranca/definir", json={"equipes": [a["id"]], "papel": "chefe"}).status_code == 422
    e = next(x for x in client.get("/api/equipes").json() if x["id"] == a["id"])
    assert (e["responsavel"], e["supervisor_id"], e["supervisor_efetivo"]["nome"]) == (resp["nome"], sup["id"], sup["nome"])
    for vista in ("setor", "frente"):
        raiz = _arvore(client, vista)
        def achar(n, tipo):
            if n["tipo"] == tipo:
                return n
            return next((x for x in (achar(f, tipo) for f in n["filhos"]) if x), None)
        r_no = achar(raiz, "responsavel")
        s_no = r_no["filhos"][0]
        assert (s_no["tipo"], s_no["titulo"]) == ("supervisor", sup["nome"])
        assert {"EQ.A"} <= {x["titulo"] for x in _todos(s_no) if x["tipo"] == "equipe"}
        assert sup["nome"] not in {p["nome"] for p in _pessoas(raiz)}  # só na própria caixa
    # tirar o supervisor: as equipes voltam para baixo do responsável
    client.put("/api/equipes/lideranca/definir", json={"equipes": [a["id"], b["id"]], "papel": "supervisor", "colaborador_id": None})
    assert all(f["tipo"] != "supervisor" for f in _todos(_arvore(client)))


def _todos(n):
    yield n
    for f in n["filhos"]:
        yield from _todos(f)
