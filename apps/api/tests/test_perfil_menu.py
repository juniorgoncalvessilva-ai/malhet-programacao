"""Spec 075/077: perfil (avatar, nome), menu do celular por perfil da obra e ajuste pessoal; super admin testa outro perfil."""
from tests.test_book_fotos import _jpeg


def test_perfil_e_avatar(client):
    p = client.get("/api/perfil").json()
    assert p["tem_avatar"] is False and p["avatar_versao"] == 0
    r = client.put("/api/perfil", json={"nome_exibicao": "  Júnior   Gonçalves ", "telefone": "(27) 99999-0000"}).json()
    assert r["nome_exibicao"] == "Júnior Gonçalves" and r["telefone"] == "(27) 99999-0000"
    assert client.put("/api/perfil/avatar", files={"arquivo": ("a.txt", b"nada", "text/plain")}).status_code == 422
    r = client.put("/api/perfil/avatar", files={"arquivo": ("eu.jpg", _jpeg(), "image/jpeg")}).json()
    assert r["tem_avatar"] and r["avatar_versao"] == 1
    a = client.get("/api/perfil/avatar")
    assert a.status_code == 200 and a.headers["content-type"] == "image/jpeg"
    from io import BytesIO

    from PIL import Image
    assert Image.open(BytesIO(a.content)).size == (256, 256)  # recortada quadrada e reduzida
    assert client.delete("/api/perfil/avatar").json()["tem_avatar"] is False
    assert client.get("/api/perfil/avatar").status_code == 404


def test_menu_do_celular_por_perfil_e_pessoal(client):
    m = client.get("/api/menu-mobile").json()
    assert m["meu"]["origem"] == "padrao" and m["meu"]["destaque"] == "/m/presenca"  # super admin = admin
    assert m["perfis"]["seguranca"]["destaque"] == "/m/preventivos"
    # admin define o padrão do perfil "admin" da obra
    r = client.put("/api/menu-mobile/perfis/admin", json={"barra": ["/m", "/m/auditorias"], "destaque": "/m/lgpd"})
    assert r.status_code == 200 and r.json()["admin"]["personalizado"] is True
    assert client.get("/api/menu-mobile").json()["meu"] == {"barra": ["/m", "/m/auditorias"], "destaque": "/m/lgpd", "origem": "perfil"}
    # ajuste pessoal ganha do perfil; inválidos não passam
    assert client.put("/api/menu-mobile/meu", json={"barra": ["/m", "/m/x"]}).status_code == 422
    assert client.put("/api/menu-mobile/meu", json={"barra": ["/m", "/m/vigente", "/m/lancar", "/m/acoes", "/m/lgpd"]}).status_code == 422
    assert client.put("/api/menu-mobile/meu", json={"barra": ["/m", "/m/presenca"], "destaque": "/m/presenca"}).status_code == 422
    r = client.put("/api/menu-mobile/meu", json={"barra": ["/m/vigente", "/m"], "destaque": None}).json()
    assert r["meu"] == {"barra": ["/m/vigente", "/m"], "destaque": None, "origem": "pessoal"}
    assert client.delete("/api/menu-mobile/meu").json()["meu"]["origem"] == "perfil"
    # super admin testa o menu de outro perfil
    assert client.get("/api/menu-mobile", params={"papel": "seguranca"}).json()["meu"]["destaque"] == "/m/preventivos"
    assert client.delete("/api/menu-mobile/perfis/admin").json()["admin"]["personalizado"] is False
