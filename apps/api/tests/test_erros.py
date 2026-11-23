"""Spec 098: relato automático de erros — limpeza de dado pessoal, agrupamento, idempotência, limite e o 500 da API."""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.erros.api.router import GERAL, POR_PESSOA
from app.modules.erros.domain.relato import Limite, Relato, acao_segura, codigo_de, limpar, local_seguro
from app.shared.errors import DomainError


@pytest.fixture(autouse=True)
def _zerar_limites():
    POR_PESSOA.zerar()
    GERAL.zerar()


def _id() -> str:
    return uuid.uuid4().hex


def test_limpeza_tira_dado_pessoal():
    t = limpar("Falhou para joao.silva@obra.com.br, CPF 123.456.789-09, tel (31) 99876-5432, crachá 115532", 500)
    assert "joao" not in t and "123.456" not in t and "99876" not in t and "115532" not in t
    assert "<e-mail>" in t and "<documento>" in t and "<telefone>" in t and "<número>" in t
    assert limpar("Authorization: Bearer abc.def.ghi", 100) == "Authorization: Bearer ***"
    assert limpar("linha 42 coluna 7", 100) == "linha 42 coluna 7"  # números curtos ficam (pilha, linha)
    assert limpar("x" * 900, 500) == "x" * 500


def test_local_e_acao_sem_consulta_e_com_id():
    assert local_seguro("https://app.malhet.com/pt-BR/m/presenca?c=115532&m=JOSE#x") == "/m/presenca"
    assert local_seguro("/app/programacoes/123/editar") == "/app/programacoes/{id}/editar"
    assert acao_segura("post /programacoes/77/emitir?x=1") == "POST /programacoes/{id}/emitir"
    assert local_seguro(None) == "/"


def test_relato_valida_e_agrupa():
    a = Relato.de_entrada(id_local=_id(), origem="web", tipo="js", mensagem="Cannot read 'x' of undefined (linha 12)",
                          local="/app/plano", pilha="TypeError\n    at abrir (https://x/_next/chunk-a1.js:1:200)")
    b = Relato.de_entrada(id_local=_id(), origem="web", tipo="js", mensagem="Cannot read 'x' of undefined (linha 99)",
                          local="/app/plano", pilha="TypeError\n    at abrir (https://x/_next/chunk-b2.js:1:900)")
    assert a.grupo == b.grupo  # mesmo erro em outro build/linha = mesmo grupo
    c = Relato.de_entrada(id_local=_id(), origem="web", tipo="js", mensagem="outro", local="/app/plano", versao="1763251234 <x>")
    assert c.versao == "1763251234x"  # versão do build não é dado pessoal: não mascara
    assert c.grupo != a.grupo
    assert codigo_de("3f9a2cdeadbeef00") == "E-3F9A2C"
    with pytest.raises(DomainError):
        Relato.de_entrada(id_local="curto", origem="web", tipo="js", mensagem="x", local="/")
    with pytest.raises(DomainError):
        Relato.de_entrada(id_local=_id(), origem="marte", tipo="js", mensagem="x", local="/")
    with pytest.raises(DomainError):
        Relato.de_entrada(id_local=_id(), origem="web", tipo="js", mensagem="", local="/")
    assert Relato.de_entrada(id_local=_id(), origem="web", tipo="js", mensagem="x", local="/",
                             navegador="Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36").navegador == "Android Chrome"


def test_limite():
    lim = Limite(2, 60)
    assert lim.permite("a", 0) and lim.permite("a", 1) and not lim.permite("a", 2)
    assert lim.permite("b", 2) and lim.permite("a", 61.5)


def test_receber_agrupar_comentar_e_resolver(client):
    obra = int(client.headers["X-Obra-Id"])
    i1, i2, i3 = _id(), _id(), _id()
    base = {"origem": "web", "tipo": "api", "mensagem": "Falha 500 ao emitir", "local": "/pt-BR/app/programacoes/5",
            "acao": "POST /programacoes/5/emitir", "status": 500}
    r = client.post("/api/erros", json={"relatos": [{**base, "id_local": i1}, {**base, "id_local": i2},
                                                     {"id_local": i3, "origem": "campo", "tipo": "js", "mensagem": "boom",
                                                      "local": "/m/lancar?data=2026-11-15"}]})
    assert r.status_code == 200 and len(r.json()["codigos"]) == 3 and r.json()["codigos"][0] == codigo_de(i1)
    # reenvio da fila não duplica
    client.post("/api/erros", json={"relatos": [{**base, "id_local": i1}]})
    # lixo é recusado sem derrubar o lote
    r = client.post("/api/erros", json={"relatos": [{"id_local": "x", "mensagem": "a"}, {**base, "id_local": _id(), "origem": "?"}]})
    assert r.json() == {"codigos": [], "recusados": 2}

    assert client.post("/api/erros/comentario", json={"id_local": i2, "comentario": "Cliquei em emitir. Meu e-mail ana@x.com"}).status_code == 200
    assert client.post("/api/erros/comentario", json={"id_local": _id(), "comentario": "x"}).status_code == 404

    g = client.get("/api/erros").json()
    assert g["resumo"]["abertos"] == 2
    emitir = next(x for x in g["grupos"] if x["acao"] == "POST /programacoes/{id}/emitir")
    assert emitir["ocorrencias"] == 2 and emitir["comentarios"] == 1 and emitir["situacao"] == "aberto"
    assert emitir["local"] == "/app/programacoes/{id}"
    d = client.get(f"/api/erros/grupos/{emitir['grupo']}").json()
    assert any("<e-mail>" in o["comentario"] for o in d["ocorrencias"])
    assert all(o["obra"] and o["obra"].startswith("310") for o in d["ocorrencias"])
    assert client.get("/api/erros", params={"origem": "campo"}).json()["grupos"][0]["local"] == "/m/lancar"
    assert client.get("/api/erros", params={"busca": "emitir"}).json()["resumo"]["grupos"] == 1

    assert client.put(f"/api/erros/grupos/{emitir['grupo']}/resolver", json={"nota": "corrigido no deploy"}).status_code == 200
    assert client.get("/api/erros/resumo").json()["abertos"] == 1
    assert client.get("/api/erros", params={"situacao": "resolvidos"}).json()["grupos"][0]["nota"] == "corrigido no deploy"
    # o mesmo erro depois de resolvido: o grupo "voltou"
    client.post("/api/erros", json={"relatos": [{**base, "id_local": _id()}]})
    assert next(x for x in client.get("/api/erros").json()["grupos"] if x["grupo"] == emitir["grupo"])["situacao"] == "voltou"
    client.delete(f"/api/erros/grupos/{emitir['grupo']}/resolver")
    assert client.put("/api/erros/grupos/naoexiste/resolver", json={}).status_code == 404
    # obra inexistente no cabeçalho não quebra (fica sem obra)
    assert client.post("/api/erros", headers={"X-Obra-Id": "99999"}, json={"relatos": [{**base, "id_local": _id()}]}).status_code == 200
    assert obra


def test_limite_por_pessoa(client):
    lote = [{"id_local": _id(), "mensagem": f"erro {k}", "local": "/"} for k in range(20)]
    client.post("/api/erros", json={"relatos": lote})
    lote2 = [{"id_local": _id(), "mensagem": f"erro {k}", "local": "/"} for k in range(30)][:20]
    r = client.post("/api/erros", json={"relatos": lote2}).json()
    lote3 = [{"id_local": _id(), "mensagem": "mais", "local": "/"} for _ in range(5)]
    r3 = client.post("/api/erros", json={"relatos": lote3}).json()
    assert len(r["codigos"]) + len(r3["codigos"]) == 20 and r3["recusados"] == 5  # 40 por minuto
    assert client.post("/api/erros", json={"relatos": lote * 2}).status_code == 422  # mais de 20 por vez


def test_erro_inesperado_da_api_vira_relato(client):
    def explode():
        raise RuntimeError("falhou com o crachá 115532")

    app.add_api_route("/api/_teste/explode", explode, methods=["GET"])
    try:
        with TestClient(app, raise_server_exceptions=False) as c2:
            r = c2.get("/api/_teste/explode", headers={"X-Obra-Id": client.headers["X-Obra-Id"]})
        assert r.status_code == 500
        codigo = r.json()["erro_id"]
        assert codigo.startswith("E-") and codigo in r.json()["detail"]
        ref = r.json()["erro_ref"]
    finally:
        app.router.routes.pop()
    g = client.get("/api/erros", params={"origem": "api"}).json()["grupos"][0]
    assert g["codigo"] == codigo and g["tipo"] == "servidor" and g["acao"] == "GET /api/_teste/explode"
    assert "115532" not in g["mensagem"] and "RuntimeError" in g["mensagem"]
    assert client.post("/api/erros/comentario", json={"id_local": ref, "comentario": "salvei a equipe"}).status_code == 200


def test_so_super_admin_le(client, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "auth_disabled", False)
    # sem conta: pode relatar (erro na tela de acesso), mas não pode ler
    r = client.post("/api/erros", headers={"X-Obra-Id": ""}, json={"relatos": [{"id_local": _id(), "mensagem": "na tela de login", "local": "/auth/sign-in"}]})
    assert r.status_code == 200 and len(r.json()["codigos"]) == 1
    assert client.get("/api/erros").status_code == 401
    assert client.get("/api/erros/resumo").status_code == 401


def test_janela_de_deploy_nao_vira_relato(client):
    """Spec 106: consulta (GET) que pegou 502/503 é a API reiniciando no deploy — aceita e descarta; 504 é rota lenta."""
    base = {"origem": "web", "tipo": "api", "local": "/pt-BR/app/vigente"}
    deploy = [{**base, "id_local": _id(), "mensagem": f"{st} em GET /mudancas: Bad Gateway", "acao": "GET /mudancas", "status": st}
              for st in (502, 503)]
    lento = {**base, "id_local": _id(), "mensagem": "504 em GET /book", "acao": "GET /fotos/book", "status": 504}
    fora = {**base, "id_local": _id(), "mensagem": "API indisponível há mais de 90 s", "acao": "API indisponível", "status": 503}
    salvar = {**base, "id_local": _id(), "mensagem": "503 em POST /programacoes/5/emitir", "acao": "POST /programacoes/5/emitir", "status": 503}
    r = client.post("/api/erros", json={"relatos": [*deploy, fora, salvar, lento]}).json()
    assert r == {"codigos": [codigo_de(x["id_local"]) for x in (fora, salvar, lento)], "recusados": 0}
    assert Relato.de_entrada(**deploy[0]).transitorio is True
    assert Relato.de_entrada(**{**deploy[0], "status": 500}).transitorio is False


def test_rede_que_caiu_nao_vira_relato(client):
    """Spec 141: "network error" (Safari), "Failed to fetch" e afins são a conexão do aparelho caindo — aceita e descarta;
    o resto continua sendo relato (inclusive o "[object Event]" já descrito pelo app)."""
    base = {"origem": "campo", "local": "/m"}
    rede = [{**base, "id_local": _id(), "tipo": t, "mensagem": m} for t, m in
            (("tela", "network error"), ("tela", "TypeError: Load failed"), ("promessa", "Failed to fetch"),
             ("js", "NetworkError when attempting to fetch resource."))]
    evento = {**base, "id_local": _id(), "tipo": "promessa", "mensagem": 'Evento "error" em <img> (imagem em memória)'}
    manual = {**base, "id_local": _id(), "tipo": "manual", "mensagem": "network error", "comentario": "não abriu"}
    r = client.post("/api/erros", json={"relatos": [*rede, evento, manual]}).json()
    assert r == {"codigos": [codigo_de(x["id_local"]) for x in (evento, manual)], "recusados": 0}
    assert Relato.de_entrada(**{**rede[0], "mensagem": "network error ao salvar o lançamento"}).transitorio is False
