"""Spec 097: tutorial do primeiro acesso — pendente para conta nova, some depois de visto, versão nova abre de novo."""
import pytest

from app.modules.perfil.domain import tutorial
from app.shared.errors import DomainError


def test_dominio(monkeypatch):
    assert tutorial.pendentes({}) == ["computador", "celular"]
    v = tutorial.marcar({}, "computador", True, "2026-11-15")
    assert tutorial.pendentes(v) == ["celular"] and v["computador"]["concluido"] is True
    with pytest.raises(DomainError):
        tutorial.marcar({}, "outro", False, "x")
    monkeypatch.setitem(tutorial.TUTORIAIS, "computador", 2)  # tutorial mudou: quem viu a v1 vê de novo
    assert tutorial.pendentes(v) == ["computador", "celular"]


def test_api(client):
    assert client.get("/api/perfil").json()["tutoriais_pendentes"] == ["computador", "celular"]
    r = client.put("/api/perfil/tutoriais/computador", json={"concluido": False})
    assert r.status_code == 200 and r.json()["tutoriais_pendentes"] == ["celular"]
    client.put("/api/perfil/tutoriais/celular", json={"concluido": True})
    assert client.get("/api/perfil").json()["tutoriais_pendentes"] == []
    assert client.put("/api/perfil/tutoriais/tv", json={}).status_code == 422
