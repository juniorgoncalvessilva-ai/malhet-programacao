"""Spec 090: menu do computador por perfil — telas do perfil (admin da obra → padrão do sistema), permissão do papel e
conferência com o menu do front."""
import re
from pathlib import Path

import pytest

from app.modules.perfil.domain.menu_web import PADRAO_WEB, TELAS_WEB, permitida, validar_menu_web
from app.shared.errors import DomainError

MENU_TS = Path(__file__).resolve().parents[2] / "web" / "src" / "components" / "Malhet" / "menu.ts"


@pytest.mark.skipif(not MENU_TS.exists(), reason="sem o front ao lado (imagem só da API)")
def test_telas_do_front_batem_com_o_backend():
    urls = re.findall(r"url: '(/app/[^']+)'", MENU_TS.read_text(encoding="utf-8"))
    assert len(urls) == len(set(urls))
    assert set(urls) == set(TELAS_WEB)


def test_padrao_por_perfil_e_permissao():
    for papel, paginas in PADRAO_WEB.items():
        assert validar_menu_web(papel, paginas)[0] == paginas[0]  # padrão válido (ordem mantida)
        assert "/app/vigente" in validar_menu_web(papel, paginas)
    assert "/app/acessos" not in PADRAO_WEB["planejador"] and "/app/pto" not in PADRAO_WEB["encarregado"]
    assert PADRAO_WEB["seguranca"][0] == "/app/ssma/cadastros"  # segurança abre pelo que é dela
    assert not permitida("encarregado", "/app/pto") and permitida("seguranca", "/app/lgpd") and not permitida("leitor", "/app/lgpd")
    with pytest.raises(DomainError, match="permissão"):
        validar_menu_web("encarregado", ["/app/acessos"])
    with pytest.raises(DomainError, match="desconhecida"):
        validar_menu_web("leitor", ["/app/nada"])
    assert validar_menu_web("admin", ["/app/marca"]) == ["/app/marca", "/app/vigente", "/app/acessos", "/app/menu-celular"]


def test_api_menu_web(client):
    r = client.get("/api/menu-web").json()
    assert r["perfis"]["encarregado"]["paginas"] == PADRAO_WEB["encarregado"] and not r["perfis"]["encarregado"]["personalizado"]
    assert "/app/pto" not in r["perfis"]["encarregado"]["permitidas"]
    assert client.put("/api/menu-web/perfis/encarregado", json={"paginas": ["/app/pto"]}).status_code == 422
    assert client.put("/api/menu-web/perfis/chefe", json={"paginas": []}).status_code == 422
    r = client.put("/api/menu-web/perfis/encarregado", json={"paginas": ["/app/lookahead", "/app/fotos"]})
    assert r.status_code == 200 and r.json()["encarregado"]["paginas"] == ["/app/lookahead", "/app/fotos", "/app/vigente"]
    assert client.get("/api/menu-web").json()["perfis"]["encarregado"]["personalizado"]
    # outra obra continua no padrão
    ob = client.post("/api/admin/obras", json={"codigo": "B9", "nome": "Obra B"}).json()["id"]
    assert not client.get("/api/menu-web", headers={"X-Obra-Id": str(ob)}).json()["perfis"]["encarregado"]["personalizado"]
    r = client.delete("/api/menu-web/perfis/encarregado")
    assert r.json()["encarregado"]["paginas"] == PADRAO_WEB["encarregado"]
