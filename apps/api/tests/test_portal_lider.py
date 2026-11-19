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
    obra = int(client.headers["X-Obra-Id"])
    assert g["endereco"] == "/encarregado" and {x["nome"] for x in g["lideres"]} >= {"ENCARREGADO TESTE UM", "CANDIDATO TESTE"}
    assert next(x for x in g["lideres"] if x["nome"] == "ENCARREGADO TESTE UM")["situacao"] == "nunca_entrou"

    w = _publico()
    assert w.get(f"/api/portal/marca/{obra}").json()["obra"]
    assert w.get("/api/portal/marca/99999").status_code == 404
    # quem não é líder não entra, nem com 123456; senha errada também não
    assert w.post("/api/portal/entrar", json={"matricula": "115013", "senha": "123456"}).status_code == 422
    assert w.post("/api/portal/entrar", json={"matricula": "115011", "senha": "000000"}).status_code == 422
    r = w.post("/api/portal/entrar", json={"matricula": "115.011", "senha": "123456"}).json()
    assert r["trocar_senha"] and r["nome"] == "ENCARREGADO TESTE UM"
    h = {"X-Portal-Token": r["token"]}
    assert w.get("/api/portal/equipes", headers=h).status_code == 422  # antes, criar a senha
    assert w.post("/api/portal/senha", headers=h, json={"nova": "123456", "repetida": "123456"}).status_code == 422
    r = w.post("/api/portal/senha", headers=h, json={"nova": "forma2026", "repetida": "forma2026"}).json()
    h = {"X-Portal-Token": r["token"]}
    assert w.post("/api/portal/entrar", json={"matricula": "115011", "senha": "123456"}).status_code == 422  # a inicial não vale mais

    eq = w.get("/api/portal/equipes", headers=h).json()
    assert [e["nome"] for e in eq["equipes"]] == ["EQUIPE.1_FORMA"]
    assert [m["nome"] for m in eq["equipes"][0]["membros"]] == ["PEDREIRO TESTE DOIS"]
    assert [d["encarregado"] for d in eq["destinos"]] == ["CANDIDATO TESTE"]

    # traz o servente pelo nome
    achados = w.get("/api/portal/buscar", headers=h, params={"q": "servente"}).json()
    assert achados[0]["nome"] == "SERVENTE TESTE TRES" and achados[0]["equipe"] is None
    assert w.post("/api/portal/incluir", headers=h, json={"equipe_id": a["id"], "cracha": achados[0]["cracha"]}).status_code == 200
    assert w.post("/api/portal/incluir", headers=h, json={"equipe_id": b["id"], "cracha": "115014"}).status_code == 422  # não é dele
    # o pedreiro foi transferido para o outro encarregado; o servente "não sei para onde foi"
    assert w.post("/api/portal/transferir", headers=h, json={"equipe_id": a["id"], "cracha": "115013",
                                                                     "para_equipe_id": b["id"]}).status_code == 200
    assert w.post("/api/portal/transferir", headers=h, json={"equipe_id": a["id"], "cracha": "115014"}).status_code == 200
    eqs = {e["id"]: e for e in client.get("/api/equipes").json()}
    assert not eqs[a["id"]]["membros"] and [m["nome"] for m in eqs[b["id"]]["membros"]] == ["PEDREIRO TESTE DOIS"]
    hist = client.get("/api/equipes/movimentacoes").json()["itens"]
    assert ("PEDREIRO TESTE DOIS", "EQUIPE.1_FORMA", "EQUIPE.2_CONCRETO") in [(i["nome"], i["de"], i["para"]) for i in hist]
    assert all(i["por"].startswith("líder") for i in hist if i["nome"] == "SERVENTE TESTE TRES")

    # Planejamento: líder sem a função de encarregado, com a equipe A; bloquear derruba a sessão; redefinir volta a 123456
    mot = cs["MOTORISTA TERCEIRO"]
    client.put(f"/api/efetivo/colaboradores/{mot['id']}/cracha", json={"cracha": "M10"})
    assert client.post("/api/lideres", json={"colaborador_id": mot["id"], "equipes": [a["id"]]}).status_code == 201
    r = w.post("/api/portal/entrar", json={"matricula": "M10", "senha": "123456"}).json()
    hm = {"X-Portal-Token": w.post("/api/portal/senha", headers={"X-Portal-Token": r["token"]},
                                   json={"nova": "lider2026", "repetida": "lider2026"}).json()["token"]}
    assert [e["nome"] for e in w.get("/api/portal/equipes", headers=hm).json()["equipes"]] == ["EQUIPE.1_FORMA"]
    client.put(f"/api/lideres/{mot['id']}", json={"ativo": False})
    assert w.get("/api/portal/equipes", headers=hm).status_code == 422
    assert w.post("/api/portal/entrar", json={"matricula": "M10", "senha": "lider2026"}).status_code == 422
    client.put(f"/api/lideres/{mot['id']}", json={"ativo": True})
    client.post(f"/api/lideres/{enc['id']}/redefinir")
    assert w.get("/api/portal/equipes", headers=h).status_code == 422  # sessão antiga caiu
    assert w.post("/api/portal/entrar", json={"matricula": "115011", "senha": "123456"}).json()["trocar_senha"]
    lst = {x["nome"]: x for x in client.get("/api/lideres").json()["lideres"]}
    assert lst["MOTORISTA TERCEIRO"]["papeis"] == ["cadastrado"] and lst["ENCARREGADO TESTE UM"]["situacao"] == "senha_inicial"
    # links por obra enviados antes do endereço fixo levam à obra (para abrir com a marca dela)
    from app.core.db import SessionLocal
    from app.modules.lideres.application.gestao import garantir_portal

    with SessionLocal() as ss:
        cod = garantir_portal(ss, obra).codigo
        ss.commit()
    assert w.get(f"/api/portal/link/{cod}").json() == {"obra_id": obra} and w.get("/api/portal/link/naoexiste").status_code == 404
    client.delete(f"/api/lideres/{mot['id']}")
    assert "MOTORISTA TERCEIRO" not in {x["nome"] for x in client.get("/api/lideres").json()["lideres"]}


def test_muitas_tentativas_bloqueiam(client):
    client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
    cs = {c["nome"]: c for c in client.get("/api/efetivo/colaboradores").json()}
    client.post("/api/efetivo/equipes", json={"nome": "EQ", "encarregado_id": cs["ENCARREGADO TESTE UM"]["id"]})
    w = _publico()
    for _ in range(5):
        w.post("/api/portal/entrar", json={"matricula": "115011", "senha": "errada1"})
    r = w.post("/api/portal/entrar", json={"matricula": "115011", "senha": "123456"})
    assert r.status_code == 422 and "muitas tentativas" in r.json()["detail"]


def test_link_com_a_marca_da_empresa(client):
    """Spec 113: o link abre com a cor, o nome e a logo da contratada — sem login."""
    from io import BytesIO

    from PIL import Image

    b = BytesIO()
    Image.new("RGB", (60, 20), (200, 30, 30)).save(b, "PNG")
    png = b.getvalue()
    obra = int(client.headers["X-Obra-Id"])
    w = _publico()
    sem = w.get(f"/api/portal/marca/{obra}").json()["marca"]
    assert (sem["cor"], sem["logos"]) == (None, [])
    client.put("/api/obra/marca/cor", json={"cor": "#C8102E"})
    client.put("/api/obra/marca/nomes", json={"nome_contratada": "Cardan", "nome_contratante": "Vale"})
    client.post("/api/obra/marca/logo/contratada", files={"arquivo": ("l.png", png, "image/png")})
    m = w.get(f"/api/portal/marca/{obra}").json()["marca"]
    assert (m["cor"], m["contratada"], m["contratante"], m["logos"]) == ("#C8102E", "Cardan", "Vale", ["contratada"]) and m["versao"]
    r = w.get(f"/api/portal/marca/{obra}/logo/contratada")
    assert r.status_code == 200 and r.content == png and r.headers["content-type"] == "image/png"
    assert w.get(f"/api/portal/marca/{obra}/logo/contratante").status_code == 404
    assert w.get(f"/api/portal/marca/{obra}/logo/outra").status_code == 404
    assert w.get("/api/portal/marca/99999/logo/contratada").status_code == 404


def test_reivindicar_equipe_com_aprovacao(client):
    """Spec 114: líder sem equipe aponta quem está com ele; a equipe só nasce quando o Planejamento aprova."""
    client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
    x = client.post("/api/equipes", json={"nome": "EQ.X", "membros": [{"cracha": "115014", "nome": "SERVENTE"}]}).json()
    w = _publico()
    # quem não tem função de liderança e não lidera equipe não entra
    assert w.post("/api/portal/entrar", json={"matricula": "115013", "senha": "123456"}).status_code == 422
    r = w.post("/api/portal/entrar", json={"matricula": "115011", "senha": "123456"}).json()  # ENCARREGADO DE FORMAS, sem equipe
    h = {"X-Portal-Token": w.post("/api/portal/senha", headers={"X-Portal-Token": r["token"]},
                                  json={"nova": "forma2026", "repetida": "forma2026"}).json()["token"]}
    eq = w.get("/api/portal/equipes", headers=h).json()
    assert eq["equipes"] == [] and eq["pedidos"] == []
    assert w.post("/api/portal/pedidos", headers=h, json={"disciplina": "", "membros": ["115013"]}).status_code == 422
    assert w.post("/api/portal/pedidos", headers=h, json={"disciplina": "forma", "membros": ["999999"]}).status_code == 422
    p1 = w.post("/api/portal/pedidos", headers=h, json={"disciplina": "forma", "membros": ["115013"]}).json()
    # reenviar substitui o pendente (não duplica); o próprio líder não entra como membro
    p2 = w.post("/api/portal/pedidos", headers=h, json={"disciplina": "forma", "membros": ["115013", "115014", "115011"],
                                                                "observacao": "turma do galpão"}).json()
    assert p2["id"] == p1["id"] and [m["cracha"] for m in p2["membros"]] == ["115013", "115014"]
    assert p2["membros"][1]["equipe"] == "EQ.X" and p2["situacao"] == "pendente"
    # nada mudou nas equipes ainda
    assert [m["cracha"] for m in next(e for e in client.get("/api/equipes").json() if e["id"] == x["id"])["membros"]] == ["115014"]

    pend = client.get("/api/lideres/pedidos").json()
    assert len(pend) == 1 and pend[0]["lider"]["nome"] == "ENCARREGADO TESTE UM" and pend[0]["nome_sugerido"] == "EQUIPE.1_FORMA"
    assert client.post(f"/api/lideres/pedidos/{p1['id']}/recusar", json={"motivo": "x"}).status_code == 422
    a = client.post(f"/api/lideres/pedidos/{p1['id']}/aprovar", json={}).json()
    assert (a["nome"], a["membros"]) == ("EQUIPE.1_FORMA", 2)
    assert client.post(f"/api/lideres/pedidos/{p1['id']}/aprovar", json={}).status_code == 422  # já aprovado
    eqs = {e["nome"]: e for e in client.get("/api/equipes").json()}
    nova = eqs["EQUIPE.1_FORMA"]
    assert nova["encarregado_cracha"] == "115011" and {m["cracha"] for m in nova["membros"]} == {"115013", "115014"}
    assert not eqs["EQ.X"]["membros"]  # o servente saiu da outra equipe
    hist = client.get("/api/equipes/movimentacoes").json()["itens"]
    assert ("SERVENTE TESTE TRES", "EQ.X", "EQUIPE.1_FORMA") in [(i["nome"], i["de"], i["para"]) for i in hist]
    # o líder agora vê a equipe e o pedido aprovado
    eq = w.get("/api/portal/equipes", headers=h).json()
    assert [e["nome"] for e in eq["equipes"]] == ["EQUIPE.1_FORMA"] and eq["pedidos"][0]["situacao"] == "aprovado"

    # recusa com motivo e cancelamento do pendente
    p3 = w.post("/api/portal/pedidos", headers=h, json={"disciplina": "concreto", "membros": ["115013"]}).json()
    assert client.post(f"/api/lideres/pedidos/{p3['id']}/recusar", json={"motivo": "Esse pedreiro já está na forma"}).status_code == 200
    assert w.get("/api/portal/equipes", headers=h).json()["pedidos"][0]["motivo"] == "Esse pedreiro já está na forma"
    p4 = w.post("/api/portal/pedidos", headers=h, json={"disciplina": "concreto", "membros": ["115013"]}).json()
    assert w.delete(f"/api/portal/pedidos/{p4['id']}", headers=h).status_code == 204
    assert client.get("/api/lideres/pedidos").json() == []
    assert len(client.get("/api/lideres/pedidos", params={"situacao": ""}).json()) == 2


def test_endereco_fixo_matricula_em_duas_obras(client):
    """Spec 115: endereço fixo — a obra vem da matrícula; em duas obras, ele escolhe depois de acertar a senha."""
    o1 = int(client.headers["X-Obra-Id"])
    o2 = client.post("/api/admin/obras", json={"codigo": "311", "nome": "Obra 311 · teste"}).json()["id"]
    for o in (o1, o2):
        h = {"X-Obra-Id": str(o)}
        client.post("/api/efetivo/importar", headers=h, files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
        enc = next(c for c in client.get("/api/efetivo/colaboradores", headers=h).json() if c["nome"] == "ENCARREGADO TESTE UM")
        client.post("/api/efetivo/equipes", headers=h, json={"nome": f"EQ.{o}", "encarregado_id": enc["id"]})
    w = _publico()
    r = w.post("/api/portal/entrar", json={"matricula": "115011", "senha": "123456"}).json()
    assert "token" not in r and sorted(x["obra_id"] for x in r["escolher"]) == sorted([o1, o2])
    r = w.post("/api/portal/entrar", json={"matricula": "115011", "senha": "123456", "obra_id": o2}).json()
    assert r["obra_id"] == o2 and r["trocar_senha"]
    h = {"X-Portal-Token": w.post("/api/portal/senha", headers={"X-Portal-Token": r["token"]}, json={"nova": "obra3112026", "repetida": "obra3112026"}).json()["token"]}
    eq = w.get("/api/portal/equipes", headers=h).json()
    assert eq["obra_id"] == o2 and [e["nome"] for e in eq["equipes"]] == [f"EQ.{o2}"]
    # com a senha nova, só a obra 311 confere: entra direto nela
    assert w.post("/api/portal/entrar", json={"matricula": "115011", "senha": "obra3112026"}).json()["obra_id"] == o2
