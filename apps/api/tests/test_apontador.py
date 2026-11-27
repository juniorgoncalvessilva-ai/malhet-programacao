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


def test_leitura_de_presenca_no_celular_do_apontador(client):
    """Spec 150: crachá NFC, código/QR, rosto e lista no celular do apontador — os mesmos casos de uso do /m/presenca,
    com o token dele; marcação à mão sai, leitura de crachá/rosto fica (é prova)."""
    from datetime import date, datetime, timezone

    client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
    client.post("/api/efetivo/colaboradores", json={"nome": "APONTADOR TESTE", "matricula": "115900", "funcao": "APONTADOR",
                                                    "situacao": "MOBILIZADO"})
    client.put("/api/efetivo/funcoes", json={"itens": [{"funcao": "PEDREIRO", "recurso": "Pedreiro"}]})
    cs = {c["nome"]: c for c in client.get("/api/efetivo/colaboradores").json()}
    w = TestClient(app)
    h = _entrar(w, "115900")
    he = _entrar(w, "115011", "lider")
    assert w.get("/api/portal/apontador/presenca/base", headers=he).status_code == 422  # encarregado não lê pela rota
    assert w.get("/api/portal/apontador/presenca/base").status_code in (401, 422)

    b = w.get("/api/portal/apontador/presenca/base", headers=h).json()
    nomes = {p["nome"] for p in b["pessoas"]}
    assert "SERVENTE TESTE TRES" in nomes and "DEMITIDO TESTE" not in nomes and "termo_lgpd" in b

    serv, enc = cs["SERVENTE TESTE TRES"]["id"], cs["ENCARREGADO TESTE UM"]["id"]
    hoje, agora = date.today().isoformat(), datetime.now(timezone.utc).isoformat()
    lt = {"leituras": [{"id_local": "apont-cel-0001", "colaborador_id": serv, "data": hoje, "hora": agora, "meio": "nfc"},
                       {"id_local": "apont-cel-0002", "colaborador_id": enc, "data": hoje, "hora": agora, "meio": "manual"}]}
    r = w.post("/api/portal/apontador/presenca/leituras", headers=h, json=lt).json()
    assert r["aceitas"] == 2 and not r["erros"], r
    assert w.post("/api/portal/apontador/presenca/leituras", headers=h, json=lt).json()["repetidas"] == 2  # idempotente
    assert {x["colaborador_id"] for x in w.get(f"/api/portal/apontador/presenca/hoje?data={hoje}", headers=h).json()} == {serv, enc}
    eq = w.get("/api/portal/apontador/equipes", headers=h).json()
    assert eq["presentes"] == 2

    # o crachá lido pelo apontador é prova; a lista (manual) dele sai
    assert "não dá para tirar" in w.post("/api/portal/apontador/presenca", headers=h, json={"colaborador_id": serv, "presente": False}).json()["detail"]
    assert w.post("/api/portal/apontador/presenca", headers=h, json={"colaborador_id": enc, "presente": False}).json()["presenca"] is None

    # crachá não cadastrado: liga à pessoa do efetivo ou cadastra simplificado, assinado pelo apontador
    v = w.post("/api/portal/apontador/presenca/vincular", headers=h, json={"colaborador_id": serv, "codigo": "QR-778899"})
    assert v.status_code == 200 and "QR778899" in "".join(v.json()["codigos"]).replace("-", ""), v.text
    funcoes = b["funcoes"]
    assert funcoes, "a base traz as funções do de-para para o cadastro rápido"
    n = w.post("/api/portal/apontador/presenca/pessoa-simplificada", headers=h,
               json={"nome": "Fulano Campo Novo", "funcao_chave": funcoes[0]["funcao_chave"], "codigo": "QR-1234"})
    assert n.status_code == 201 and n.json()["cadastro_pendente"], n.text
    from app.core.db import SessionLocal
    from app.modules.efetivo.infra.models import ColaboradorModel

    with SessionLocal() as db:
        assert db.get(ColaboradorModel, n.json()["id"]).cadastrado_por.startswith("apontador 115900")


def test_falta_e_emprestimo_entre_equipes(client):
    """Spec 152: falta com motivo (lida no crachá não é falta; presente tira a falta; fechar a equipe), empréstimo com
    justificativa (a pessoa fica na equipe dela e conta na que recebeu) e os números no computador."""
    from datetime import datetime, timezone

    from app.shared.tempo import hoje_local

    client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
    client.post("/api/efetivo/colaboradores", json={"nome": "APONTADOR TESTE", "matricula": "115900", "funcao": "APONTADOR",
                                                    "situacao": "MOBILIZADO"})
    cs = {c["nome"]: c for c in client.get("/api/efetivo/colaboradores").json()}
    enc, ped = cs["ENCARREGADO TESTE UM"]["id"], cs["PEDREIRO TESTE DOIS"]["id"]
    client.post("/api/efetivo/equipes", json={"nome": "EQUIPE.1_FORMA", "encarregado_id": enc, "colaboradores": [ped]})
    w = TestClient(app)
    h = _entrar(w, "115900")
    eq2 = w.post("/api/portal/apontador/equipes", headers=h, json={"disciplina": "concreto", "encarregado": "115014"}).json()
    hoje = hoje_local().isoformat()

    def dados():
        r = w.get("/api/portal/apontador/equipes", headers=h).json()
        return r, {e["nome"]: e for e in r["equipes"]}

    # falta com motivo; "outro" pede a descrição
    r = w.post("/api/portal/apontador/falta", headers=h, json={"colaborador_id": ped, "motivo": "atestado"}).json()
    assert r["falta"]["rotulo"] == "Atestado médico" and r["falta"]["justificada"]
    assert w.post("/api/portal/apontador/falta", headers=h, json={"colaborador_id": ped, "motivo": "outro"}).status_code == 422
    todos, eqs = dados()
    um = eqs["EQUIPE.1_FORMA"]
    assert um["faltas"] == 1 and todos["faltas"] == 1 and len(todos["motivos_falta"]) == 7
    assert next(p for p in um["pessoas"] if p["colaborador_id"] == ped)["falta"]["motivo"] == "atestado"
    # apontou presente: a falta sai
    w.post("/api/portal/apontador/presenca", headers=h, json={"colaborador_id": ped, "presente": True})
    assert dados()[1]["EQUIPE.1_FORMA"]["faltas"] == 0
    # presença lida no crachá é prova: não vira falta
    client.post("/api/presenca/leituras", json={"leituras": [{"id_local": "cel1-falta-0001", "colaborador_id": enc, "data": hoje,
                                                             "hora": datetime.now(timezone.utc).isoformat(), "meio": "nfc"}]})
    assert "não é falta" in w.post("/api/portal/apontador/falta", headers=h, json={"colaborador_id": enc, "motivo": "nao_compareceu"}).json()["detail"]
    # fechar a equipe: só quem não veio leva a falta
    w.post("/api/portal/apontador/presenca", headers=h, json={"colaborador_id": ped, "presente": False})
    assert w.post("/api/portal/apontador/faltas/restantes", headers=h,
                  json={"equipe_id": um["id"], "motivo": "nao_compareceu"}).json() == {"faltas": 1}

    # empréstimo: o pedreiro trabalha hoje na equipe nova, com justificativa; continua na EQUIPE.1
    assert w.post("/api/portal/apontador/emprestimo", headers=h, json={"colaborador_id": ped, "para_equipe_id": um["id"],
                                                                       "justificativa": "ajuda na concretagem"}).status_code == 422
    assert w.post("/api/portal/apontador/emprestimo", headers=h, json={"colaborador_id": ped, "para_equipe_id": eq2["equipe_id"],
                                                                       "justificativa": "ok"}).status_code == 422
    r = w.post("/api/portal/apontador/emprestimo", headers=h, json={"colaborador_id": ped, "para_equipe_id": eq2["equipe_id"],
                                                                    "justificativa": "Ajuda na concretagem da laje"})
    assert r.status_code == 200 and r.json()["emprestimo"]["de_equipe"] == "EQUIPE.1_FORMA", r.text
    todos, eqs = dados()
    nova = next(e for e in eqs.values() if e["id"] == eq2["equipe_id"])
    assert [p["nome"] for p in nova["recebidos"]] == ["PEDREIRO TESTE DOIS"] and nova["recebidos"][0]["presenca"]
    p1 = next(p for p in eqs["EQUIPE.1_FORMA"]["pessoas"] if p["colaborador_id"] == ped)
    assert p1["emprestimo"]["para_equipe_id"] == eq2["equipe_id"] and p1["falta"] is None and eqs["EQUIPE.1_FORMA"]["cedidos"] == 1
    assert todos["emprestimos"] == 1

    # no computador: os números da semana
    ap = client.get(f"/api/presenca/apontamentos?de={hoje}&ate={hoje}").json()
    assert ap["faltas"]["valor"] == "0" and ap["emprestimos"]["valor"] == "1"
    assert ap["recebidos"][0]["qtd"] == 1 and ap["lista_emprestimos"][0]["justificativa"] == "Ajuda na concretagem da laje"

    # devolver desfaz o empréstimo
    w.post("/api/portal/apontador/emprestimo/devolver", headers=h, json={"colaborador_id": ped})
    _todos, eqs = dados()
    assert next(e for e in eqs.values() if e["id"] == eq2["equipe_id"])["recebidos"] == []
