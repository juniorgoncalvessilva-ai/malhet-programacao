"""Spec 147: rota do apontador — entra como o encarregado (matrícula + 123456, cria a senha; endereço da empresa/obra),
mas só quem é apontador (função no efetivo ou cadastrado em Acesso dos líderes). Cria equipes, aponta a presença de todo
o efetivo, o dia dos equipamentos, registra fotos e confere a produção da programação vigente."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.lideres.application.portal import TENTATIVAS
from tests.test_efetivo import efetivo
from tests.test_equipamentos import _planilha
from tests.test_excluir_revisao import _programacao


@pytest.fixture(autouse=True)
def _zerar():
    TENTATIVAS.zerar()


def _entrar(w: TestClient, mat: str, perfil: str = "apontador") -> dict:
    r = w.post("/api/portal/entrar", json={"matricula": mat, "senha": "123456", "perfil": perfil})
    assert r.status_code == 200, r.text
    t = w.post("/api/portal/senha", headers={"X-Portal-Token": r.json()["token"]}, json={"nova": "aponta26", "repetida": "aponta26"}).json()
    return {"X-Portal-Token": t["token"]}


def test_rota_do_apontador(client):
    client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
    ap = client.post("/api/efetivo/colaboradores", json={"nome": "APONTADOR TESTE", "matricula": "115900", "funcao": "APONTADOR",
                                                         "situacao": "MOBILIZADO"})
    assert ap.status_code in (200, 201), ap.text
    cs = {c["nome"]: c for c in client.get("/api/efetivo/colaboradores").json()}
    enc = cs["ENCARREGADO TESTE UM"]
    client.post("/api/efetivo/equipes", json={"nome": "EQUIPE.1_FORMA", "encarregado_id": enc["id"], "colaboradores": [cs["PEDREIRO TESTE DOIS"]["id"]]})
    client.post("/api/equipamentos/planilha", files={"arquivo": ("eq.xlsx", _planilha())})
    pid = _programacao(client)
    client.post(f"/api/programacoes/{pid}/emitir")

    g = client.get("/api/lideres").json()
    assert g["endereco_apontador"].startswith("/apontador/malhet/") and g["endereco_apontador_empresa"] == "/apontador/malhet"
    assert next(x for x in g["lideres"] if x["nome"] == "APONTADOR TESTE")["perfil"] == "apontador"

    w = TestClient(app)
    # encarregado não entra pela rota do apontador, nem o apontador pela do encarregado
    assert "não está como apontador" in w.post("/api/portal/entrar", json={"matricula": "115011", "senha": "123456", "perfil": "apontador"}).json()["detail"]
    assert w.post("/api/portal/entrar", json={"matricula": "115900", "senha": "123456"}).status_code == 422
    h = _entrar(w, "115900")
    he = _entrar(w, "115011", "lider")
    assert w.get("/api/portal/apontador/equipes", headers=he).status_code == 422  # token de encarregado não abre

    eq = w.get("/api/portal/apontador/equipes", headers=h).json()
    assert eq["nome"] == "APONTADOR TESTE" and [e["nome"] for e in eq["equipes"]] == ["EQUIPE.1_FORMA"]
    assert [p["papel"] for p in eq["equipes"][0]["pessoas"]] == ["encarregado", None]
    sem = {p["nome"] for p in eq["sem_equipe"]}
    assert "SERVENTE TESTE TRES" in sem and "DEMITIDO TESTE" not in sem

    # cria equipe direto (sem aprovação): o servente vem da sem-equipe, o pedreiro sai da EQUIPE.1
    r = w.post("/api/portal/apontador/equipes", headers=h, json={"disciplina": "concreto", "encarregado": "115013", "membros": ["115014"]})
    assert r.status_code == 201, r.text
    nova = r.json()
    eq = w.get("/api/portal/apontador/equipes", headers=h).json()
    um = next(e for e in eq["equipes"] if e["nome"] == "EQUIPE.1_FORMA")
    assert [p["nome"] for p in um["pessoas"]] == ["ENCARREGADO TESTE UM"]  # o pedreiro virou encarregado da nova
    assert w.post("/api/portal/apontador/incluir", headers=h, json={"equipe_id": um["id"], "cracha": "115014"}).json()["saiu_de"] == [nova["nome"]]
    assert w.post("/api/portal/apontador/tirar", headers=h, json={"equipe_id": um["id"], "cracha": "115014"}).status_code == 200

    # presença à mão em qualquer equipe; desmarcar só o que foi apontado (crachá é prova)
    serv = cs["SERVENTE TESTE TRES"]["id"]
    r = w.post("/api/portal/apontador/presenca", headers=h, json={"colaborador_id": serv, "presente": True}).json()
    assert r["presenca"]["meio"] == "manual" and r["presenca"]["por"].startswith("apontador 115900")
    assert w.get("/api/portal/apontador/equipes", headers=h).json()["presentes"] == 1
    assert w.post("/api/portal/apontador/presenca", headers=h, json={"colaborador_id": serv, "presente": True}).status_code == 200  # idempotente
    assert w.post("/api/portal/apontador/presenca", headers=h, json={"colaborador_id": serv, "presente": False}).json()["presenca"] is None
    from datetime import date, datetime, timezone
    hoje = date.today().isoformat()
    lt = client.post("/api/presenca/leituras", json={"leituras": [{"id_local": "cel1-leitura-0001", "colaborador_id": enc["id"], "data": hoje,
                                                                    "hora": datetime.now(timezone.utc).isoformat(), "meio": "nfc"}]}).json()
    assert lt["aceitas"] == 1, lt
    assert "não dá para tirar" in w.post("/api/portal/apontador/presenca", headers=h, json={"colaborador_id": enc["id"], "presente": False}).json()["detail"]
    assert w.post("/api/portal/apontador/presenca", headers=h, json={"colaborador_id": serv, "presente": True, "data": "2020-01-01"}).status_code == 422
    assert w.post("/api/portal/apontador/presenca", headers=h, json={"colaborador_id": cs["DEMITIDO TESTE"]["id"], "presente": True}).status_code == 422

    # equipamentos mobilizados e o dia de cada um
    eqs = w.get("/api/portal/apontador/equipamentos", headers=h).json()
    assert {i["tag"] for i in eqs["itens"]} == {"CAR-0A99", "CAR-EH-001"} and eqs["equipes"]
    bt = next(i for i in eqs["itens"] if i["tag"] == "CAR-0A99")
    d = w.put(f"/api/portal/apontador/equipamentos/{bt['id']}", headers=h, json={"situacao": "operando", "horas": 9, "equipe_id": nova["equipe_id"]}).json()
    assert d["dia"]["por"].startswith("apontador 115900") and d["dia"]["equipe_id"] == nova["equipe_id"]
    assert client.get("/api/equipamentos").json()["totais"]["apontados"] == 1

    # produção da programação vigente, com a memória do acumulado
    pr = w.get("/api/portal/apontador/producao", headers=h).json()
    assert pr["programacao"]["id"] == pid and pr["areas"][0]["linhas"][0]["total_previsto"] == 3
    assert pr["areas"][0]["linhas"][0]["memoria"]["chave"] == "semana"

    # fotos: o registro de atividade do portal também vale para o apontador
    area = client.get("/api/frentes").json()[0]["areas"][0]
    assert w.post("/api/portal/registros", headers=h, json={"area_id": area["id"], "descricao": "Concretagem do fundo"}).status_code == 201

    # Planejamento cadastra um apontador sem a função (o candidato, pelo crachá)
    cand = cs["CANDIDATO TESTE"]
    client.put(f"/api/efetivo/colaboradores/{cand['id']}/cracha", json={"cracha": "T77"})
    assert client.post("/api/lideres", json={"colaborador_id": cand["id"], "perfil": "apontador"}).status_code == 201
    hc = _entrar(w, "T77")
    assert w.get("/api/portal/apontador/equipes", headers=hc).status_code == 200
    assert w.post("/api/portal/entrar", json={"matricula": "T77", "senha": "aponta26"}).status_code == 422  # não é líder de equipe


def test_funcoes_que_entram_como_apontador(client):
    """Spec 148: a obra escolhe qualquer função do efetivo para entrar como apontador (sem escolha, APONTADOR); tirar a
    função da lista tira o acesso; quem foi cadastrado como apontador continua."""
    client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
    client.post("/api/efetivo/colaboradores", json={"nome": "APONTADOR TESTE", "matricula": "115900", "funcao": "APONTADOR", "situacao": "MOBILIZADO"})
    cf = client.get("/api/lideres/apontador/funcoes").json()
    assert cf["padrao"] and cf["funcoes"] == ["APONTADOR"]
    assert {d["funcao"] for d in cf["disponiveis"]} >= {"PEDREIRO", "SERVENTE", "APONTADOR"}

    w = TestClient(app)
    entra = lambda m: w.post("/api/portal/entrar", json={"matricula": m, "senha": "123456", "perfil": "apontador"}).status_code  # noqa: E731
    assert (entra("115013"), entra("115900")) == (422, 200)  # pedreiro ainda não; o apontador sim

    # a obra escolhe: pedreiro (escrito de outro jeito) entra; a função APONTADOR saiu da lista
    cf = client.put("/api/lideres/apontador/funcoes", json={"funcoes": ["Pedreiro ", "pedreiro"]}).json()
    assert not cf["padrao"] and cf["funcoes"] == ["PEDREIRO"]
    assert next(d for d in cf["disponiveis"] if d["funcao"] == "PEDREIRO")["apontador"] is True
    assert (entra("115013"), entra("115900")) == (200, 422)
    nomes = {x["nome"]: x for x in client.get("/api/lideres").json()["lideres"]}
    assert nomes["PEDREIRO TESTE DOIS"]["perfil"] == "apontador" and "APONTADOR TESTE" not in nomes
    # cadastrado como apontador continua, qualquer que seja a função
    serv = next(c for c in client.get("/api/efetivo/colaboradores").json() if c["nome"] == "SERVENTE TESTE TRES")
    client.post("/api/lideres", json={"colaborador_id": serv["id"], "perfil": "apontador"})
    assert entra("115014") == 200
    # voltar ao padrão e por obra
    assert client.put("/api/lideres/apontador/funcoes", json={"funcoes": None}).json()["padrao"] is True
    assert entra("115900") == 200
    outra = client.post("/api/admin/obras", json={"codigo": "OUT-APF", "nome": "Outra"}).json()["id"]
    assert client.get("/api/lideres/apontador/funcoes", headers={"X-Obra-Id": str(outra)}).json()["disponiveis"] == []
