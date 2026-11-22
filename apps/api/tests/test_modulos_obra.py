"""Spec 125: menu pelo ciclo da obra (grupos com no máximo 6 telas, Configurar recolhido) e módulos contratados por obra."""
import re
from pathlib import Path

import pytest

from app.modules.obras.domain import modulos as mods
from app.modules.perfil.domain.menu_web import TELAS_WEB
from app.shared.errors import DomainError

WEB = Path(__file__).resolve().parents[2] / "web" / "src" / "components"
MENU_TS, MOBILE_TS = WEB / "Malhet" / "menu.ts", WEB / "Mobile" / "menu.ts"


@pytest.mark.skipif(not MENU_TS.exists(), reason="sem o front ao lado (imagem só da API)")
def test_grupos_pelo_ciclo_da_obra():
    texto = MENU_TS.read_text(encoding="utf-8")
    corpo = texto[texto.index("export const MENU"):texto.index("export function menuDoPerfil")]
    grupos = re.split(r"etapa: '", corpo)[1:]
    nomes = [g.split("'", 1)[0] for g in grupos]
    assert nomes == ["Projeto e escopo", "Planejar", "Executar", "Medir e melhorar", "Pessoas e equipes", "Segurança (SSMA)", "Configurar"]
    for nome, g in zip(nomes, grupos):
        n = len(re.findall(r"url: '/app/", g))
        assert nome == "Configurar" or n <= 6, f"{nome} com {n} telas"
    assert "recolhido: true" in grupos[-1]


@pytest.mark.skipif(not MOBILE_TS.exists(), reason="sem o front ao lado (imagem só da API)")
def test_telas_dos_modulos_existem():
    mobile = set(re.findall(r"url: '(/m[^']*)'", MOBILE_TS.read_text(encoding="utf-8")))
    for m in mods.MODULOS.values():
        assert set(m.web) <= set(TELAS_WEB), m.chave
        assert set(m.celular) <= mobile, m.chave
    assert "/app/takeoff" in mods.MODULOS["documentos"].web  # spec 127: take-off tem tela própria, no mesmo módulo
    nucleo = {"/app/vigente", "/app/programacoes", "/app/cronograma", "/app/wbs", "/app/acessos", "/app/menu-celular"}
    assert not nucleo & set(mods.telas_desligadas(list(mods.MODULOS)))  # o núcleo não desliga


def test_validar_modulos():
    assert mods.validar(["ssma", "ssma", "documentos"]) == ["ssma", "documentos"]
    with pytest.raises(DomainError, match="desconhecido"):
        mods.validar(["financeiro"])


def test_super_admin_desliga_e_religa(client):
    obra = client.get("/api/obras/minhas").json()[0]
    assert obra["telas_desligadas"] == [] and obra["modulos_desligados"] == []
    assert {m["chave"] for m in client.get("/api/admin/modulos").json()} == set(mods.MODULOS)
    corpo = {k: obra[k] for k in ("codigo", "nome", "contrato", "cliente", "ativa")}
    r = client.put(f"/api/admin/obras/{obra['id']}", json={**corpo, "modulos_desligados": ["documentos", "ssma"]})
    assert r.status_code == 200 and r.json()["modulos_desligados"] == ["documentos", "ssma"]
    o = next(x for x in client.get("/api/obras/minhas").json() if x["id"] == obra["id"])
    assert {"/app/documentos", "/m/documentos", "/app/ssma", "/app/lgpd"} <= set(o["telas_desligadas"])
    # editar sem mandar a lista não mexe nos módulos; lista inválida não passa; lista vazia religa
    assert client.put(f"/api/admin/obras/{obra['id']}", json=corpo).json()["modulos_desligados"] == ["documentos", "ssma"]
    assert client.put(f"/api/admin/obras/{obra['id']}", json={**corpo, "modulos_desligados": ["x"]}).status_code == 422
    assert client.put(f"/api/admin/obras/{obra['id']}", json={**corpo, "modulos_desligados": []}).json()["modulos_desligados"] == []
