"""Spec 076: notificações geradas pelos módulos, endereçadas por papel/pessoa, contagem e leitura; quem causou não recebe."""
from sqlalchemy import select

from app.modules.notificacoes.application import notificar
from app.modules.notificacoes.infra.models import NotificacaoModel


def test_central_de_notificacoes(client):
    from app.core.db import SessionLocal

    obra = int(client.headers["X-Obra-Id"])
    s = SessionLocal()
    try:
        notificar(s, obra, tipo="teste", titulo="Para encarregados", papeis=["encarregado"], chave="t-1")
        notificar(s, obra, tipo="teste", titulo="Repetido não duplica", papeis=["admin"], chave="t-2")
        notificar(s, obra, tipo="teste", titulo="Repetido não duplica", papeis=["admin"], chave="t-2")
        notificar(s, obra, tipo="teste", titulo="Eu mesmo causei", papeis=["admin"], autor_id="dev")
        s.commit()
        assert s.scalar(select(NotificacaoModel.id).where(NotificacaoModel.chave == "t-2")) is not None
    finally:
        s.close()
    lista = client.get("/api/notificacoes").json()
    titulos = [n["titulo"] for n in lista]
    # super admin vê todas da obra (inclusive as de encarregado), menos as que ele mesmo causou
    assert "Para encarregados" in titulos and titulos.count("Repetido não duplica") == 1 and "Eu mesmo causei" not in titulos
    c = client.get("/api/notificacoes/contagem").json()
    assert c["nao_lidas"] == len(lista) >= 2
    r = client.post(f"/api/notificacoes/{lista[0]['id']}/lida").json()
    assert r["nao_lidas"] == c["nao_lidas"] - 1
    assert client.post("/api/notificacoes/lidas").json()["nao_lidas"] == 0
    assert client.get("/api/notificacoes", params={"so_nao_lidas": True}).json() == []


def test_eventos_geram_notificacao(client):
    from tests.test_presenca import _montar

    enc, ped, srv, eq = _montar(client)
    # ação 5W2H criada → gestão e segurança
    r = client.post("/api/acoes", json={"o_que": "Trocar extintor do galpão", "quem": "Damião", "quando": "2026-11-20"})
    assert r.status_code == 201, r.text
    # recusa LGPD
    client.post("/api/lgpd/aceites", json={"id_local": "cel1-lgpd-n0001", "colaborador_id": srv, "versao": 1,
                                            "escolhas": {"biometria": False, "foto_assinatura": False, "localizacao": False},
                                            "assinatura": {"meio": "codigo", "codigo": "1"}, "hora": "2026-11-13T07:00:00-03:00"})
    tipos = {n["tipo"] for n in client.get("/api/notificacoes").json()}
    # o super admin de teste é o autor — não recebe o próprio aviso; confere no banco que foram gerados
    from app.core.db import SessionLocal

    s = SessionLocal()
    try:
        gerados = {n.tipo: n for n in s.scalars(select(NotificacaoModel))}
    finally:
        s.close()
    assert {"acao", "lgpd"} <= set(gerados) and "seguranca" in gerados["acao"].papeis and not tipos & {"acao", "lgpd"}
