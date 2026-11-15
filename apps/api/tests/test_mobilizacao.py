"""Spec 087: ficha do colaborador (CRUD) e mobilização — funil até o crachá, travas de ASO/treinamentos e métricas."""
from datetime import date, datetime, timedelta, timezone

import pytest

from app.modules.mobilizacao.domain.metricas import ProcessoNomeado, calcular, esforco, gargalo
from app.modules.mobilizacao.domain.pipeline import Etapa, Liberacoes, Meta, Processo, Status
from app.shared.errors import DomainError
from tests.test_presenca import _montar

T0 = datetime(2026, 11, 1, 8, tzinfo=timezone.utc)
OK = Liberacoes(aso_apto=True)


def _d(n: float) -> datetime:
    return T0 + timedelta(days=n)


def _ate(p: Processo, etapa: Etapa, dia: float, lib=OK) -> Processo:
    while p.etapa_atual != etapa:
        p = p.concluir(p.etapa_atual, _d(dia), lib)
    return p


def test_funil_ordem_travas_e_status():
    p = Processo.iniciar(T0)
    with pytest.raises(DomainError):
        p.concluir(Etapa.SELECAO, _d(1))  # só a aberta
    assert p.concluir(Etapa.SOLICITACAO, T0 - timedelta(seconds=40)).passagens[0].saiu_em == T0  # mesmo minuto
    with pytest.raises(DomainError, match="antes da entrada"):
        p.concluir(Etapa.SOLICITACAO, T0 - timedelta(minutes=5))
    p = p.concluir(Etapa.SOLICITACAO, _d(1)).concluir(Etapa.SELECAO, _d(3)).concluir(Etapa.EXAMES, _d(4))
    with pytest.raises(DomainError, match="ASO"):
        p.concluir(Etapa.ASO, _d(5))  # sem ASO apto
    p = p.concluir(Etapa.ASO, _d(5), OK)
    assert p.etapa_atual == Etapa.CONTRATACAO
    p = p.concluir(Etapa.CONTRATACAO, _d(6), OK)
    assert p.etapa_atual == Etapa.TREINAMENTO
    p = p.concluir(Etapa.TREINAMENTO, _d(8), OK)
    with pytest.raises(DomainError, match="treinamentos em aberto"):
        p.concluir(Etapa.DOCUMENTACAO_CLIENTE, _d(9), Liberacoes(treinamentos_pendentes=("NR-35",)))
    with pytest.raises(DomainError, match="confirme"):
        p.concluir(Etapa.DOCUMENTACAO_CLIENTE, _d(9), Liberacoes(funcao_tem_exigencia=False))
    p = p.concluir(Etapa.DOCUMENTACAO_CLIENTE, _d(9), Liberacoes(funcao_tem_exigencia=False, confirmar_treinamentos=True))
    p = p.concluir(Etapa.APROVACAO, _d(11))
    assert p.status == Status.AGUARDANDO_CRACHA and p.etapa_atual == Etapa.CRACHA
    p = p.concluir(Etapa.CRACHA, _d(12))
    assert p.status == Status.MOBILIZADO and p.aberta is None
    assert round(p.dias_total(_d(30)), 1) == 12.0  # encerrado: não conta mais
    with pytest.raises(DomainError):
        p.concluir(Etapa.CRACHA, _d(13))
    v = p.voltar()
    assert v.status == Status.AGUARDANDO_CRACHA and v.aberta.etapa == Etapa.CRACHA


def test_treinamento_antes_da_contratacao_e_documentacao_exige_contratacao():
    p = _ate(Processo.iniciar(T0, treinamento_antes=True), Etapa.ASO, 1).concluir(Etapa.ASO, _d(2), OK)
    assert p.etapa_atual == Etapa.TREINAMENTO
    p = p.concluir(Etapa.TREINAMENTO, _d(4))
    assert p.etapa_atual == Etapa.CONTRATACAO
    p = p.concluir(Etapa.CONTRATACAO, _d(5))
    assert p.etapa_atual == Etapa.DOCUMENTACAO_CLIENTE


def test_desistencia_metas_esforco_e_metricas():
    a = _ate(Processo.iniciar(T0), Etapa.CRACHA, 0)
    a = Processo(tuple(a.passagens), a.status)
    a = a.concluir(Etapa.CRACHA, _d(2))  # tudo no dia 0 e o crachá levou 2 dias
    b = Processo.iniciar(T0).concluir(Etapa.SOLICITACAO, _d(1)).concluir(Etapa.SELECAO, _d(9))  # seleção de 9 dias
    c = Processo.iniciar(T0).concluir(Etapa.SOLICITACAO, _d(1)).desistir(_d(4))
    assert c.status == Status.DESISTENCIA and c.etapa_atual == Etapa.SELECAO and c.aberta is None
    with pytest.raises(DomainError):
        c.desistir(_d(5))
    metas = {Meta.SELECAO: 5, Meta.CRACHA: 3}
    agora = _d(10)
    assert b.atrasos(metas, agora) == [Meta.SELECAO] and a.atrasos(metas, agora) == []
    assert esforco(b, agora)["SELECAO"] == 8 and gargalo(b, agora) == Etapa.SELECAO
    r = calcular([ProcessoNomeado(1, "A", "PEDREIRO", a), ProcessoNomeado(2, "B", "PEDREIRO", b),
                  ProcessoNomeado(3, "C", "SERVENTE", c)], metas, agora)
    assert r["cards"]["lead_time"]["valor"] == "2 d"
    assert r["cards"]["no_prazo"]["valor"] == "100%"
    assert r["cards"]["atrasados"]["valor"] == "1"  # b segue aberto com a seleção acima da meta
    sel = next(e for e in r["etapas"] if e["etapa"] == "SELECAO")
    assert sel["alcancaram"] == 3 and sel["agora"] == 0
    assert r["cards"]["desistencias"]["valor"].startswith("1 (50%")
    assert next(f for f in r["funcoes"] if f["funcao"] == "PEDREIRO")["processos"] == 2


def test_ficha_crud_e_exclusao(client):
    enc, ped, srv, eq = _montar(client)
    r = client.post("/api/efetivo/colaboradores", json={"nome": "joão  novo da silva", "funcao": "Carpinteiro",
                                                        "situacao": "EM_PROCESSO",
                                                         "tipo_contrato": "CLT", "horas_dia": 9, "brigadista": True})
    assert r.status_code == 201, r.text
    novo = r.json()
    assert novo["nome"] == "JOÃO NOVO DA SILVA" and novo["chave"].startswith("PROPRIA:NOME:") or ":NOME:" in novo["chave"]
    assert novo["brigadista"] and novo["origem"] == "manual"
    assert client.post("/api/efetivo/colaboradores", json={"nome": "JOÃO NOVO DA SILVA"}).status_code == 422  # repetido
    assert client.post("/api/efetivo/colaboradores", json={"nome": "FULANO TAL", "horas_dia": 30}).status_code == 422
    assert client.post("/api/efetivo/colaboradores", json={"nome": "FULANO TAL", "email_corporativo": "x@"}).status_code == 422
    assert client.post("/api/efetivo/colaboradores", json={"nome": "FULANO TAL", "matricula": "115013"}).status_code == 422

    corpo = {**{k: novo[k] for k in ("nome", "empresa", "funcao", "situacao", "tipo_contrato", "horas_dia")},
             "matricula": "200300", "brigadista": False, "cnh_categoria": "AB"}
    r = client.put(f"/api/efetivo/colaboradores/{novo['id']}", json={**corpo, "situacao": "MOBILIZADO", "funcao": "Armador"})
    assert r.status_code == 200, r.text
    f = r.json()
    assert f["chave"] == "200300" and f["cracha"] == "200300" and f["cnh_categoria"] == "AB" and not f["brigadista"]
    movs = [m["tipo"] for m in client.get(f"/api/efetivo/movimentos?colaborador_id={novo['id']}").json()]
    assert set(movs) >= {"ENTRADA", "SITUACAO", "FUNCAO"}

    # crachá novo vai para a equipe; encarregado não se exclui; sem histórico sai
    corpo_ped = client.get(f"/api/efetivo/colaboradores/{ped}").json()
    r = client.put(f"/api/efetivo/colaboradores/{ped}", json={**{k: corpo_ped[k] for k in ("nome", "empresa", "matricula", "funcao", "situacao")},
                                                              "cracha": "C-77"})
    assert r.status_code == 200 and r.json()["equipe_id"] == eq
    assert client.delete(f"/api/efetivo/colaboradores/{enc}").status_code == 422
    assert client.delete(f"/api/efetivo/colaboradores/{novo['id']}").status_code == 204
    assert client.get(f"/api/efetivo/colaboradores/{novo['id']}").status_code == 404


def test_mobilizacao_api_ponta_a_ponta(client):
    _montar(client)
    nr = client.post("/api/treinamentos/catalogo", json={"nome": "NR-18", "validade_meses": 24}).json()["id"]
    assert client.post("/api/mobilizacao/processos", json={"nome": "Maria Nova Silva", "funcao": "Soldador"}).status_code == 422  # fora do cadastro (spec 089)
    client.put("/api/treinamentos/exigencias", json={"funcao_chave": "ARMADOR", "treinamentos": [nr]})
    r = client.post("/api/mobilizacao/processos", json={"nome": "Maria Nova Silva", "funcao": "Armador", "requisicao": "RQ-12",
                                                        "necessario_em": str(date.today() + timedelta(days=20)),
                                                        "iniciado_em": (datetime.now(timezone.utc) - timedelta(days=6)).isoformat()})
    assert r.status_code == 201, r.text
    p = r.json()
    cid = p["colaborador_id"]
    assert p["etapa_atual"] == "SOLICITACAO" and p["dias_total"] >= 5.9
    col = client.get(f"/api/efetivo/colaboradores/{cid}").json()
    assert col["situacao"] == "EM_PROCESSO"
    assert client.post("/api/mobilizacao/processos", json={"colaborador_id": cid}).status_code == 422  # já aberto

    pid = p["id"]
    for e in ("SOLICITACAO", "SELECAO", "EXAMES"):
        assert client.post(f"/api/mobilizacao/processos/{pid}/concluir", json={"etapa": e}).status_code == 200
    r = client.post(f"/api/mobilizacao/processos/{pid}/concluir", json={"etapa": "ASO"})
    assert r.status_code == 422 and "ASO" in r.json()["detail"]
    client.post("/api/treinamentos/asos", json={"colaborador_id": cid, "tipo": "ADMISSIONAL", "data_exame": str(date.today()),
                                                "resultado": "APTO"})
    assert client.post(f"/api/mobilizacao/processos/{pid}/concluir", json={"etapa": "ASO"}).status_code == 200
    r = client.post(f"/api/mobilizacao/processos/{pid}/concluir", json={"etapa": "CONTRATACAO", "matricula": "300400"})
    assert r.status_code == 200
    col = client.get(f"/api/efetivo/colaboradores/{cid}").json()
    assert col["matricula"] == "300400" and col["chave"] == "300400" and col["admissao"] == str(date.today())
    client.post(f"/api/mobilizacao/processos/{pid}/concluir", json={"etapa": "TREINAMENTO"})
    r = client.post(f"/api/mobilizacao/processos/{pid}/concluir", json={"etapa": "DOCUMENTACAO_CLIENTE"})
    assert r.status_code == 422 and "NR-18" in r.json()["detail"]
    client.post("/api/treinamentos/registros", json={"treinamento_id": nr, "colaboradores": [cid], "realizado_em": str(date.today())})
    assert client.post(f"/api/mobilizacao/processos/{pid}/concluir", json={"etapa": "DOCUMENTACAO_CLIENTE"}).status_code == 200
    r = client.post(f"/api/mobilizacao/processos/{pid}/concluir", json={"etapa": "APROVACAO"})
    assert r.json()["status"] == "AGUARDANDO_CRACHA"
    assert client.get(f"/api/efetivo/colaboradores/{cid}").json()["situacao"] == "AGUARDANDO_CRACHA"
    r = client.post(f"/api/mobilizacao/processos/{pid}/concluir", json={"etapa": "CRACHA", "cracha": "115013"})
    assert r.status_code == 422  # crachá de outra pessoa
    r = client.post(f"/api/mobilizacao/processos/{pid}/concluir", json={"etapa": "CRACHA"})  # usa a matrícula
    assert r.status_code == 200 and r.json()["status"] == "MOBILIZADO"
    assert client.get(f"/api/efetivo/colaboradores/{cid}").json()["situacao"] == "MOBILIZADO"
    r = client.post(f"/api/mobilizacao/processos/{pid}/voltar")
    assert r.json()["status"] == "AGUARDANDO_CRACHA"
    client.post(f"/api/mobilizacao/processos/{pid}/concluir", json={"etapa": "CRACHA"})

    # outra aquisição: desistência
    q = client.post("/api/mobilizacao/processos", json={"nome": "Pedro Desiste Souza", "funcao": "Servente"}).json()
    assert client.post(f"/api/mobilizacao/processos/{q['id']}/desistir", json={"motivo": "x"}).status_code == 422
    r = client.post(f"/api/mobilizacao/processos/{q['id']}/desistir", json={"motivo": "Outra proposta"})
    assert r.json()["status"] == "DESISTENCIA"
    assert client.get(f"/api/efetivo/colaboradores/{q['colaborador_id']}").json()["situacao"] == "DESISTENCIA"

    assert client.put("/api/mobilizacao/metas", json={"metas": {"SELECAO": 0}}).status_code == 422
    assert client.put("/api/mobilizacao/metas", json={"metas": {"SELECAO": 1}}).json()["SELECAO"] == 1
    m = client.get("/api/mobilizacao/metricas").json()
    assert m["processos"] == 2 and m["cards"]["desistencias"]["valor"].startswith("1 (50%")
    assert next(x for x in m["metas"] if x["meta"] == "SELECAO")["acima"] == 1  # 6 dias na solicitação > 1
    assert m["cards"]["lead_time"]["valor"] != "—"
    lista = client.get("/api/mobilizacao/processos?status=MOBILIZADO").json()
    assert [x["id"] for x in lista] == [pid] and lista[0]["gargalo"] == "SOLICITACAO"
    assert client.delete(f"/api/mobilizacao/processos/{q['id']}").status_code == 204
    assert client.get(f"/api/efetivo/colaboradores/{q['colaborador_id']}").status_code == 200  # a pessoa fica
