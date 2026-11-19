"""Spec 112: o super admin (ou quem ele habilitou) exclui auditorias feitas e fotos do book, com motivo e histórico."""
import pytest

from app.core.db import SessionLocal
from app.modules.exclusoes.application import servico as sv
from app.modules.exclusoes.domain.exclusao import exigir, pode_excluir, validar_motivo
from app.shared.errors import DomainError
from tests.test_auditorias import LISTA, _foto_leg


def test_regras():
    assert pode_excluir(True, False) and pode_excluir(False, True) and not pode_excluir(False, False)
    with pytest.raises(DomainError):
        exigir(False, False)
    assert validar_motivo("  foto   errada da frente ") == "foto errada da frente"
    with pytest.raises(DomainError):
        validar_motivo("ok")


def _auditoria_com_acao(client) -> tuple[dict, int]:
    client.post("/api/frentes/importar", json={"texto": LISTA})
    area = client.get("/api/frentes").json()[0]["areas"][0]
    base = {"data": "2026-11-12", "tipo": "Notificação", "tipo_registro": "Falta ou uso incorreto de EPI", "area_id": area["id"],
            "engenheiro": "Eng", "encarregado": "Enc", "nao_conformidade": "Sem luva", "medida_corretiva": "Entregar luva",
            "acompanhamento": "Enc", "ver_agir": False, "plano_responsavel": "Enc", "plano_prazo": "2026-11-14"}
    r = client.post("/api/auditorias/registros", json=base).json()
    _foto_leg(client, "auditoria", r["id"], "antes")
    x = client.post(f"/api/auditorias/registros/{r['id']}/finalizar").json()
    return r, x["acao"]["id"]


def test_super_admin_exclui_auditoria_feita_e_foto_do_book(client):
    r, acao_id = _auditoria_com_acao(client)
    assert client.get("/api/exclusoes/eu").json()["pode_excluir"]  # super admin
    # pelo caminho comum não sai (enviada e com ação 5W2H)
    assert client.delete(f"/api/auditorias/registros/{r['id']}").status_code == 422
    assert client.post(f"/api/exclusoes/auditorias/{r['id']}", json={"motivo": "x"}).status_code == 422  # sem motivo
    j = client.post(f"/api/exclusoes/auditorias/{r['id']}", json={"motivo": "Registrada na obra errada"}).json()
    assert j == {"fotos": 1, "acoes_mantidas": 1}
    assert all(x["id"] != r["id"] for x in client.get("/api/auditorias/registros").json())
    acao = next(a for a in client.get("/api/acoes").json() if a["id"] == acao_id)  # a ação 5W2H continua
    assert acao["origem_texto"].endswith("auditoria excluída")
    assert not [f for f in client.get("/api/fotos/book").json() if f.get("tipo") == "auditoria"]

    # foto do book (de uma ação), com motivo
    _foto_leg(client, "acao", acao_id, "evidencia")
    fid = client.get("/api/fotos", params={"alvo": "acao", "alvo_id": acao_id}).json()[0]["id"]
    assert client.post(f"/api/exclusoes/fotos/{fid}", json={"motivo": "Foto de outra obra"}).status_code == 200
    assert client.get(f"/api/fotos/{fid}/arquivo").status_code == 404

    h = client.get("/api/exclusoes/historico").json()
    assert [(x["tipo"], x["motivo"]) for x in h] == [("foto", "Foto de outra obra"), ("auditoria", "Registrada na obra errada")]
    aud = h[1]
    assert aud["resumo"].startswith("Auditoria Nº 1") and aud["dados"]["nao_conformidade"] == "Sem luva"
    assert len(aud["dados"]["fotos"]) == 1 and aud["dados"]["acoes_mantidas"][0]["id"] == acao_id and aud["por"] == "dev@local"


def test_profissional_habilitado_pelo_super_admin(client):
    from app.modules.obras.infra.models import AcessoObraModel

    r, _ = _auditoria_com_acao(client)
    obra = int(client.headers["X-Obra-Id"])
    with SessionLocal() as s:
        s.add(AcessoObraModel(obra_id=obra, usuario_id="u-tecnico", email="tecnico@empresa.com", papel="seguranca", concedido_por="dev"))
        s.commit()
        # sem habilitação, não exclui
        with pytest.raises(DomainError):
            sv.excluir_auditoria(s, obra, r["id"], "motivo qualquer", "u-tecnico", "tecnico@empresa.com", superadmin=False)
        # só o super admin habilita
        with pytest.raises(DomainError):
            sv.definir_permissao(s, obra, "u-tecnico", True, "u-tecnico", "tecnico@empresa.com", superadmin=False)
    assert client.put("/api/exclusoes/permissoes/u-tecnico", json={"habilitado": True}).status_code == 200
    ps = {p["email"]: p for p in client.get("/api/exclusoes/permissoes").json()}
    assert ps["tecnico@empresa.com"]["habilitado"] and ps["tecnico@empresa.com"]["por"] == "dev@local"
    with SessionLocal() as s:
        assert sv.excluir_auditoria(s, obra, r["id"], "Duplicada no celular", "u-tecnico", "tecnico@empresa.com", superadmin=False)["fotos"] == 1
        s.commit()
    client.put("/api/exclusoes/permissoes/u-tecnico", json={"habilitado": False})
    h = client.get("/api/exclusoes/historico").json()
    assert [x["tipo"] for x in h] == ["permissao", "auditoria", "permissao"]
    assert h[1]["por"] == "tecnico@empresa.com" and "Desabilitou tecnico@empresa.com" in h[0]["resumo"]
    assert client.put("/api/exclusoes/permissoes/naoexiste", json={"habilitado": True}).status_code == 404


def test_exclusao_comum_tambem_vai_ao_historico(client):
    client.post("/api/frentes/importar", json={"texto": LISTA})
    area = client.get("/api/frentes").json()[0]["areas"][0]
    r = client.post("/api/auditorias/registros", json={"data": "2026-11-12", "tipo": "Inspeção", "area_id": area["id"]}).json()
    _foto_leg(client, "auditoria", r["id"], "antes")
    fid = client.get("/api/fotos", params={"alvo": "auditoria", "alvo_id": r["id"]}).json()[0]["id"]
    assert client.delete(f"/api/fotos/{fid}").status_code == 204
    assert client.delete(f"/api/auditorias/registros/{r['id']}").status_code == 204  # rascunho
    assert [x["tipo"] for x in client.get("/api/exclusoes/historico").json()] == ["auditoria", "foto"]
