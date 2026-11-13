"""Spec 073: controle preventivo — etilômetro (faixas, aparelho com calibração, evento com fotos e responsável,
testes assinados, contraprova e envio idempotente pela fila do aparelho)."""
import json
from datetime import date

import pytest

from app.modules.preventivos.domain.etilometro import CONFIG_PADRAO, classificar, validar_config
from app.shared.errors import DomainError
from tests.test_book_fotos import _jpeg
from tests.test_presenca import _montar

ASS = {"meio": "nfc", "hora": "2026-11-13T07:00:00-03:00", "codigo": "04A1"}


def test_faixas_da_lei_e_configuracao():
    cfg = validar_config(CONFIG_PADRAO)
    assert classificar(cfg, 0.0, False)["resultado"] == "aprovado"
    assert classificar(cfg, 0.04, False)["faixa"] == "Sem penalidade administrativa"
    r = classificar(cfg, 0.05, False)
    assert (r["resultado"], r["faixa"]) == ("reprovado", "Infração gravíssima") and "2.934,70" in r["penalidade"]
    assert classificar(cfg, 0.33, False)["faixa"] == "Infração gravíssima"
    assert classificar(cfg, 0.34, False)["faixa"] == "Crime de trânsito"
    assert classificar(cfg, None, True)["faixa"] == "Recusa ao teste" and classificar(cfg, None, True)["resultado"] == "reprovado"
    for ruim in (-0.1, 9, None, "abc"):
        with pytest.raises(DomainError):
            classificar(cfg, ruim, False)
    with pytest.raises(DomainError):  # fora de ordem
        validar_config({**cfg, "faixas": [cfg["faixas"][0], cfg["faixas"][2], cfg["faixas"][1]]})
    with pytest.raises(DomainError):
        validar_config({**cfg, "faixas": cfg["faixas"][1:]})  # não começa em 0
    with pytest.raises(DomainError):
        validar_config({**cfg, "contraprova_minutos": 0})


def _aparelho(client, validade="2027-06-30"):
    r = client.post("/api/preventivos/etilometro/aparelhos", json={"marca": "Alcolizer", "modelo": "LE5", "numero_serie": "AZ-991",
                                                                   "calibracao_em": "2026-06-30", "validade": validade})
    assert r.status_code == 201, r.text
    return r.json()


def _abrir(client, ap, resp, id_local="tab1-evento-0001", momentos=("aparelho", "calibracao"), data="2026-11-13"):
    dados = {"id_local": id_local, "data": data, "aparelho_id": ap, "responsavel_id": resp, "assinatura": ASS,
             "iniciado_em": f"{data}T06:55:00-03:00", "local": "Portaria 1"}
    return client.post("/api/preventivos/etilometro/eventos", data={"dados": json.dumps(dados), "momentos": json.dumps(list(momentos))},
                       files=[("fotos", (f"{m}.jpg", _jpeg(), "image/jpeg")) for m in momentos])


def test_evento_de_etilometro_do_inicio_ao_fim(client):
    enc, ped, srv, eq = _montar(client)
    # configuração: contraprova em 10 min
    cfg = client.get("/api/preventivos/etilometro/config").json()
    assert cfg["contraprova_minutos"] == 15 and len(cfg["faixas"]) == 3
    assert client.put("/api/preventivos/etilometro/config", json={**cfg, "contraprova_minutos": 10}).json()["contraprova_minutos"] == 10
    vencido = _aparelho(client, validade="2026-10-01")
    assert vencido["vencido"] is True
    ap = _aparelho(client)
    assert client.post("/api/preventivos/etilometro/aparelhos", json={"marca": "X", "modelo": "Y"}).status_code == 422  # sem validade

    # início: aparelho vencido não; sem a foto da calibração não; tudo certo abre (e repetir não duplica)
    r = _abrir(client, vencido["id"], enc)
    assert r.status_code == 422 and "vencida" in r.text
    assert _abrir(client, ap["id"], enc, momentos=("aparelho",)).status_code == 422
    r = _abrir(client, ap["id"], enc)
    assert r.status_code == 201, r.text
    ev = r.json()
    assert ev["numero"] == 1 and ev["responsavel"] == "ENCARREGADO TESTE UM" and ev["aparelho"]["modelo"] == "LE5" and not ev["repetido"]
    assert _abrir(client, ap["id"], enc).json()["repetido"] is True
    assert len(client.get("/api/preventivos/etilometro/eventos").json()) == 1

    T = lambda i, cid, **k: {"id_local": f"tab1-teste-{i:04d}", "evento_id_local": "tab1-evento-0001", "colaborador_id": cid,
                             "hora": "2026-11-13T07:05:00-03:00", "leitura": "nfc", "assinatura": {"meio": "facial", "distancia": 0.31}, **k}
    # pedreiro passa; servente reprova (0,12) → contraprova; a contraprova (0,03) aprova
    a = client.post("/api/preventivos/etilometro/testes", json=T(1, ped, valor=0.0)).json()
    assert a["teste"]["resultado"] == "aprovado" and a["contraprova"] is False
    b = client.post("/api/preventivos/etilometro/testes", json=T(2, srv, valor=0.12)).json()
    assert b["teste"]["faixa"] == "Infração gravíssima" and b["contraprova"] is True
    assert client.post("/api/preventivos/etilometro/testes", json=T(2, srv, valor=0.12)).json()["repetido"] is True
    assert client.post("/api/preventivos/etilometro/testes", json=T(3, srv, valor=0.0)).status_code == 422  # já fez o teste
    assert client.post("/api/preventivos/etilometro/testes", json=T(4, ped, valor=0.0, tentativa=2)).status_code == 422  # não reprovou
    assert client.post("/api/preventivos/etilometro/testes", json=T(5, enc, valor=0.0, assinatura=None)).status_code == 422  # sem assinar
    assert client.post("/api/preventivos/etilometro/testes", json=T(6, enc, valor=7)).status_code == 422  # digitação
    lista = client.get("/api/preventivos/etilometro/eventos").json()[0]["resumo"]
    assert (lista["pessoas"], lista["contraprova_pendente"], lista["aprovados"]) == (2, 1, 1)
    c = client.post("/api/preventivos/etilometro/testes", json=T(7, srv, valor=0.03, tentativa=2)).json()
    assert c["teste"]["resultado"] == "aprovado" and c["teste"]["tentativa"] == 2
    # encarregado recusa: sem assinatura dele vale (a recusa é registrada pelo responsável)
    d = client.post("/api/preventivos/etilometro/testes", json=T(8, enc, recusa=True, assinatura=None)).json()
    assert d["teste"]["faixa"] == "Recusa ao teste" and d["teste"]["valor"] is None and d["contraprova"] is False

    r = client.post("/api/preventivos/etilometro/eventos/tab1-evento-0001/encerrar",
                    json={"assinatura": {**ASS, "hora": "2026-11-13T08:00:00-03:00"}, "encerrado_em": "2026-11-13T08:00:00-03:00"})
    assert r.json()["status"] == "encerrado"
    assert client.post("/api/preventivos/etilometro/eventos/tab1-evento-0001/encerrar",
                       json={"assinatura": ASS, "encerrado_em": "2026-11-13T09:00:00-03:00"}).json()["repetido"] is True
    det = client.get(f"/api/preventivos/etilometro/eventos/{ev['id']}").json()
    res = det["resumo"]
    assert (res["pessoas"], res["testes"], res["aprovados"], res["reprovados"], res["recusas"], res["contraprovas"]) == (3, 4, 2, 1, 1, 1)
    srv_final = next(p for p in det["pessoas"] if p["nome"] == "SERVENTE TESTE TRES")
    assert srv_final["resultado"] == "aprovado" and srv_final["tentativas"] == 2 and not srv_final["contraprova_pendente"]
    assert sorted(f["momento"] for f in det["fotos"]) == ["aparelho", "calibracao"]
    # aparelho usado não sai do cadastro (fica desativado)
    assert client.delete(f"/api/preventivos/etilometro/aparelhos/{ap['id']}").status_code == 422
    assert client.delete(f"/api/preventivos/etilometro/aparelhos/{vencido['id']}").status_code == 204
