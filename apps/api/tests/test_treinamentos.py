"""Spec 088: ASOs e treinamentos — validade, exigência por função, matriz, impedimentos, métricas e isolamento por obra."""
from datetime import date, timedelta

import pytest

from app.modules.treinamentos.domain.aptidao import (
    Aso,
    PessoaApta,
    Registro,
    ResultadoAso,
    TipoAso,
    Treinamento,
    Validade,
    aptidao,
    aso_vigente,
    exigidos,
    indicadores,
    situacao_validade,
    somar_meses,
    valido_ate_padrao,
)
from app.shared.errors import DomainError
from tests.test_presenca import _montar

HOJE = date(2026, 11, 15)


def test_validade_e_meses():
    assert somar_meses(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert somar_meses(date(2026, 11, 15), 24) == date(2028, 11, 15)
    assert valido_ate_padrao(HOJE, 0) is None  # não vence
    assert situacao_validade(None, HOJE) == Validade.VALIDO
    assert situacao_validade(HOJE + timedelta(days=31), HOJE) == Validade.VALIDO
    assert situacao_validade(HOJE + timedelta(days=30), HOJE) == Validade.VENCENDO
    assert situacao_validade(HOJE - timedelta(days=1), HOJE) == Validade.VENCIDO
    with pytest.raises(DomainError):
        Treinamento(1, "NR-35", validade_meses=200)
    with pytest.raises(DomainError):
        Aso(TipoAso.ADMISSIONAL, HOJE, HOJE - timedelta(days=1), ResultadoAso.APTO)


def test_aptidao_aso_vigente_exigidos_e_impeditivo():
    nr35 = Treinamento(1, "NR-35", 24, impeditivo=True)
    integ = Treinamento(2, "Integração", 12, todos=True)
    nr10 = Treinamento(3, "NR-10", 24)
    ex = exigidos([nr35, integ, nr10], {"PEDREIRO": {1}}, "PEDREIRO")
    assert [t.nome for t in ex] == ["NR-35", "Integração"]  # NR-10 não é da função
    asos = [Aso(TipoAso.ADMISSIONAL, date(2025, 1, 10), date(2026, 1, 10), ResultadoAso.APTO),
            Aso(TipoAso.PERIODICO, date(2026, 1, 5), date(2027, 1, 5), ResultadoAso.APTO_COM_RESTRICAO),
            Aso(TipoAso.DEMISSIONAL, date(2026, 6, 1), date(2026, 6, 1), ResultadoAso.APTO)]
    assert aso_vigente(asos).tipo == TipoAso.PERIODICO  # o demissional não conta
    a = aptidao(asos, [Registro(2, date(2026, 3, 1), date(2027, 3, 1))], ex, HOJE)
    assert a.aso_libera and a.impedida  # NR-35 impeditivo faltando
    assert [c.treinamento_id for c in a.pendencias] == [1]
    a = aptidao(asos, [Registro(1, date(2025, 11, 1), date(2027, 11, 1)), Registro(1, date(2023, 1, 1), date(2025, 1, 1)),
                       Registro(2, date(2026, 3, 1), date(2027, 3, 1))], ex, HOJE)
    assert not a.impedida and not a.pendencias  # vale o registro que vai mais longe
    inapto = aptidao([Aso(TipoAso.ADMISSIONAL, HOJE, HOJE + timedelta(days=365), ResultadoAso.INAPTO)], [], [], HOJE)
    assert not inapto.aso_libera and inapto.impedida and inapto.impedimentos == ["ASO inapto"]
    m = indicadores([PessoaApta("A", a), PessoaApta("B", inapto)], {1: "NR-35", 2: "Integração"}, HOJE)
    assert m["impedidas"].valor == "1" and m["conformidade"].valor == "50%" and m["aso_vencido"].valor == "1"
    assert m["impedidas"].fontes[0].dado == "B"


def test_api_catalogo_exigencia_asos_turma_matriz_e_metricas(client):
    enc, ped, srv, _ = _montar(client)
    r = client.post("/api/treinamentos/catalogo", json={"nome": "NR-35 Trabalho em altura", "norma": "NR-35",
                                                        "validade_meses": 24, "impeditivo": True})
    assert r.status_code == 201, r.text
    nr35 = r.json()["id"]
    integ = client.post("/api/treinamentos/catalogo", json={"nome": "Integração", "validade_meses": 12, "todos": True}).json()["id"]
    assert client.post("/api/treinamentos/catalogo", json={"nome": "integração"}).status_code == 422  # repetido

    funcoes = {f["funcao_chave"]: f for f in client.get("/api/treinamentos/exigencias").json()}
    assert funcoes["PEDREIRO"]["pessoas"] >= 1
    assert client.put("/api/treinamentos/exigencias", json={"funcao_chave": "PEDREIRO", "treinamentos": [nr35]}).status_code == 200
    assert client.put("/api/treinamentos/exigencias", json={"funcao_chave": "PEDREIRO", "treinamentos": [9999]}).status_code == 422

    hoje = date.today()
    r = client.post("/api/treinamentos/asos", json={"colaborador_id": ped, "tipo": "ADMISSIONAL",
                                                    "data_exame": str(hoje - timedelta(days=20)), "resultado": "APTO"})
    assert r.status_code == 201, r.text
    assert r.json()["valido_ate"] == str(date(hoje.year + 1, hoje.month, hoje.day) - timedelta(days=20)) or r.json()["situacao"] == "VALIDO"
    assert client.post("/api/treinamentos/asos", json={"colaborador_id": ped, "tipo": "ADMISSIONAL",
                                                       "data_exame": str(hoje + timedelta(days=2)), "resultado": "APTO"}).status_code == 422

    p = client.get(f"/api/treinamentos/pessoa/{ped}").json()
    assert p["aso_libera"] and p["impedida"] and set(p["pendentes"]) == {"NR-35 Trabalho em altura", "Integração"}

    r = client.post("/api/treinamentos/registros", json={"treinamento_id": integ, "colaboradores": [ped, srv, enc],
                                                         "realizado_em": str(hoje - timedelta(days=3)), "entidade": "SESMT"})
    assert r.status_code == 201 and len(r.json()) == 3
    r = client.post("/api/treinamentos/registros", json={"treinamento_id": nr35, "colaboradores": [ped],
                                                         "realizado_em": str(hoje - timedelta(days=3))})
    assert r.json()[0]["valido_ate"] is not None
    p = client.get(f"/api/treinamentos/pessoa/{ped}").json()
    assert not p["impedida"] and p["pendentes"] == []

    mz = client.get("/api/treinamentos/matriz").json()
    assert {t["id"] for t in mz["treinamentos"]} == {nr35, integ}
    linha = next(x for x in mz["pessoas"] if x["id"] == srv)
    assert linha["aso"] == "FALTANDO" and linha["impedida"] and linha["celulas"][str(integ)]["situacao"] == "VALIDO"

    mt = client.get("/api/treinamentos/indicadores").json()
    assert mt["memorias"]["aso_valido"]["valor"] == "1" and mt["memorias"]["aso_faltando"]["valor"] == str(mt["pessoas"] - 1)
    assert any(t["id"] == nr35 and t["VALIDO"] == 1 for t in mt["por_treinamento"])

    # excluir: treinamento com registros não sai (desativar); registro e ASO saem
    assert client.delete(f"/api/treinamentos/catalogo/{integ}").status_code == 422
    rid = client.get(f"/api/treinamentos/registros?colaborador_id={srv}").json()[0]["id"]
    assert client.delete(f"/api/treinamentos/registros/{rid}").status_code == 204
    aid = client.get(f"/api/treinamentos/asos?colaborador_id={ped}").json()[0]["id"]
    assert client.delete(f"/api/treinamentos/asos/{aid}").status_code == 204

    # isolamento por obra
    obra_a = client.headers["X-Obra-Id"]
    ob = client.post("/api/admin/obras", json={"codigo": "B2", "nome": "Obra B"}).json()["id"]
    hb = {"X-Obra-Id": str(ob)}
    assert client.get("/api/treinamentos/catalogo", headers=hb).json() == []
    assert client.delete(f"/api/treinamentos/catalogo/{nr35}", headers=hb).status_code == 404
    assert client.post("/api/treinamentos/asos", headers=hb, json={"colaborador_id": ped, "tipo": "PERIODICO",
                                                                   "data_exame": str(hoje), "resultado": "APTO"}).status_code == 404
    assert client.get("/api/treinamentos/catalogo", headers={"X-Obra-Id": obra_a}).json()
