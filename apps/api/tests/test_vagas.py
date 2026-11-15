"""Spec 089: funções de contratação criadas no de-para, vagas abertas pelo Planejamento alimentando a mobilização e o
treinamento previsto em contrato × o tempo gasto."""
from datetime import date, datetime, timedelta, timezone

import pytest

from app.modules.mobilizacao.domain.metricas import ProcessoNomeado, treinamento
from app.modules.mobilizacao.domain.pipeline import Etapa, Liberacoes, Meta, Processo
from app.modules.mobilizacao.domain.vaga import Ocupacao, SituacaoVaga, Vaga, VagaResumo, proximo_codigo, resumo
from app.shared.errors import DomainError
from tests.test_presenca import _montar

T0 = datetime(2026, 11, 1, 8, tzinfo=timezone.utc)


def test_vaga_ocupacao_codigo_e_resumo():
    assert proximo_codigo([]) == "RQ-0001" and proximo_codigo(["RQ-0009", "X", "RQ-0002"]) == "RQ-0010"
    with pytest.raises(DomainError):
        Vaga("PEDREIRO", 0)
    o = Ocupacao(3, mobilizados=1, em_processo=1, desistencias=2)
    assert o.saldo == 1 and o.situacao == SituacaoVaga.EM_ATENDIMENTO
    o.aceita_processo()
    with pytest.raises(DomainError, match="aumente a quantidade"):
        Ocupacao(2, 1, 1).aceita_processo()
    assert Ocupacao(2, 2, 0).situacao == SituacaoVaga.PREENCHIDA and Ocupacao(2, 0, 0).situacao == SituacaoVaga.ABERTA
    with pytest.raises(DomainError, match="cancelada"):
        Ocupacao(2, 0, 0, cancelada=True).aceita_processo()
    r = resumo([VagaResumo("RQ-0001", "PEDREIRO", Ocupacao(2, 2, 0), T0, None, T0 + timedelta(days=10)),
                VagaResumo("RQ-0002", "SERVENTE", Ocupacao(3, 1, 1), T0, date(2026, 11, 5), None)], date(2026, 11, 15))
    assert r["vagas_abertas"].valor == "1" and r["vagas_saldo"].valor == "1"
    assert r["vagas_atrasadas"].valor == "1" and r["vagas_tempo"].valor == "10 d"


def test_treinamento_real_x_contrato():
    ok = Liberacoes(aso_apto=True)
    p = Processo.iniciar(T0)
    for i, e in enumerate([Etapa.SOLICITACAO, Etapa.SELECAO, Etapa.EXAMES, Etapa.ASO, Etapa.CONTRATACAO]):
        p = p.concluir(e, T0 + timedelta(days=i), ok)
    p = p.concluir(Etapa.TREINAMENTO, T0 + timedelta(days=9))  # 5 dias de treinamento
    a = ProcessoNomeado(1, "A", "ARMADOR", p, previsto_dias=3, previsto_horas=24, horas=16)
    assert a.dias_treinamento(T0 + timedelta(days=20)) == 5
    assert a.metas({Meta.TREINAMENTO: 10})[Meta.TREINAMENTO] == 3  # a meta vira o previsto no contrato
    assert Meta.TREINAMENTO in p.atrasos(a.metas({}), T0 + timedelta(days=20))
    r = treinamento([a, ProcessoNomeado(2, "B", "SERVENTE", p)], T0 + timedelta(days=20))
    cards = {m.chave: m for m in r["cards"]}
    assert cards["treino_dias"].valor == "5 d / 3 d" and "1 processo(s) sem previsão" in cards["treino_dias"].notas[0]
    assert cards["treino_horas"].valor == "66,7%"
    arm = next(x for x in r["por_funcao"] if x["funcao"] == "ARMADOR")
    assert arm["desvio_dias"] == 2 and arm["acima"] == 1


def test_funcao_vaga_mobilizacao_e_config(client):
    _montar(client)
    # 1) função de contratação criada na obra, sem de-para
    r = client.post("/api/efetivo/funcoes/nova", json={"funcao": "Montador de andaime"})
    assert r.status_code == 201 and r.json()["funcao"] == "MONTADOR DE ANDAIME"
    assert client.post("/api/efetivo/funcoes/nova", json={"funcao": "montador de  andaime"}).status_code == 422
    assert client.post("/api/efetivo/funcoes/nova", json={"funcao": "pedreiro"}).status_code == 422  # já vem do efetivo
    lista = {f["funcao_chave"]: f for f in client.get("/api/efetivo/funcoes/lista").json()}
    assert lista["MONTADOR DE ANDAIME"]["criada_na_obra"] and "PEDREIRO" in lista
    fun = {f["funcao_chave"]: f for f in client.get("/api/efetivo/funcoes").json()["funcoes"]}
    assert not fun["MONTADOR DE ANDAIME"]["definido"]  # o de-para fica para depois
    client.put("/api/efetivo/funcoes", json={"itens": [{"funcao": "MONTADOR DE ANDAIME", "recurso": None}]})
    assert "MONTADOR DE ANDAIME" in {f["funcao_chave"] for f in client.get("/api/efetivo/funcoes/lista").json()}  # limpar não apaga

    # 2) vaga aberta pelo planejamento
    assert client.post("/api/mobilizacao/vagas", json={"funcao": "Soldador X", "quantidade": 1}).status_code == 422
    r = client.post("/api/mobilizacao/vagas", json={"funcao": "montador de andaime", "quantidade": 2, "destino": "Área 3",
                                                    "necessario_em": str(date.today() + timedelta(days=10))})
    assert r.status_code == 201, r.text
    v = r.json()
    assert v["codigo"] == "RQ-0001" and v["situacao"] == "ABERTA" and v["saldo"] == 2

    p1 = client.post("/api/mobilizacao/processos", json={"vaga_id": v["id"], "nome": "Joao Andaime Um"}).json()
    assert p1["vaga_codigo"] == "RQ-0001" and p1["funcao"] == "MONTADOR DE ANDAIME"
    col = client.get(f"/api/efetivo/colaboradores/{p1['colaborador_id']}").json()
    assert col["funcao"] == "MONTADOR DE ANDAIME"
    p2 = client.post("/api/mobilizacao/processos", json={"vaga_id": v["id"], "nome": "Jose Andaime Dois"}).json()
    r = client.post("/api/mobilizacao/processos", json={"vaga_id": v["id"], "nome": "Terceiro Andaime Tres"})
    assert r.status_code == 422 and "aumente a quantidade" in r.json()["detail"]
    assert client.put(f"/api/mobilizacao/vagas/{v['id']}", json={"funcao": "MONTADOR DE ANDAIME", "quantidade": 1}).status_code == 422
    client.post(f"/api/mobilizacao/processos/{p2['id']}/desistir", json={"motivo": "Não compareceu"})
    vs = client.get("/api/mobilizacao/vagas").json()
    vv = vs["vagas"][0]
    assert (vv["situacao"], vv["em_processo"], vv["desistencias"], vv["saldo"]) == ("EM_ATENDIMENTO", 1, 1, 1)
    assert vs["memorias"]["vagas_abertas"]["valor"] == "1"
    assert client.delete(f"/api/mobilizacao/vagas/{v['id']}").status_code == 422  # tem processos
    assert client.delete("/api/efetivo/funcoes/MONTADOR%20DE%20ANDAIME").status_code == 422  # em uso

    # 3) treinamento previsto em contrato × gasto
    cfg = {x["funcao_chave"]: x for x in client.get("/api/mobilizacao/config/treinamentos").json()}
    assert cfg["MONTADOR DE ANDAIME"]["em_mobilizacao"] and cfg["MONTADOR DE ANDAIME"]["dias"] is None
    assert client.put("/api/mobilizacao/config/treinamentos", json={"itens": [{"funcao_chave": "MONTADOR DE ANDAIME", "dias": 0}]}).status_code == 422
    r = client.put("/api/mobilizacao/config/treinamentos", json={"itens": [{"funcao_chave": "MONTADOR DE ANDAIME", "dias": 2, "horas": 16,
                                                                            "clausula": "Anexo IV item 3.2"}]})
    assert r.status_code == 200
    t = client.post("/api/treinamentos/catalogo", json={"nome": "NR-35", "validade_meses": 24, "carga_horaria": 8}).json()["id"]
    hoje = date.today()
    pid = p1["id"]
    for e in ("SOLICITACAO", "SELECAO", "EXAMES"):
        client.post(f"/api/mobilizacao/processos/{pid}/concluir", json={"etapa": e})
    client.post("/api/treinamentos/asos", json={"colaborador_id": p1["colaborador_id"], "tipo": "ADMISSIONAL", "data_exame": str(hoje), "resultado": "APTO"})
    client.post(f"/api/mobilizacao/processos/{pid}/concluir", json={"etapa": "ASO"})
    client.post(f"/api/mobilizacao/processos/{pid}/concluir", json={"etapa": "CONTRATACAO"})
    client.post("/api/treinamentos/registros", json={"treinamento_id": t, "colaboradores": [p1["colaborador_id"]], "realizado_em": str(hoje)})
    proc = next(x for x in client.get("/api/mobilizacao/processos").json() if x["id"] == pid)
    assert proc["etapa_atual"] == "TREINAMENTO" and proc["treino"]["previsto_dias"] == 2 and proc["treino"]["horas"] == 8
    m = client.get("/api/mobilizacao/metricas").json()
    assert m["cards"]["treino_horas"]["valor"] == "50%"
    assert next(x for x in m["treinamento"] if x["funcao"] == "MONTADOR DE ANDAIME")["previsto_horas"] == 16
    assert client.put("/api/mobilizacao/config/treinamentos", json={"itens": [{"funcao_chave": "MONTADOR DE ANDAIME"}]}).status_code == 200
    assert next(x for x in client.get("/api/mobilizacao/config/treinamentos").json() if x["funcao_chave"] == "MONTADOR DE ANDAIME")["dias"] is None

    # cancelar e reabrir a vaga
    assert client.post(f"/api/mobilizacao/vagas/{v['id']}/cancelar", json={"motivo": "Escopo reduzido"}).json()["situacao"] == "CANCELADA"
    assert client.post("/api/mobilizacao/processos", json={"vaga_id": v["id"], "nome": "Outro Andaime Quatro"}).status_code == 422
    assert client.post(f"/api/mobilizacao/vagas/{v['id']}/reabrir").json()["situacao"] == "EM_ATENDIMENTO"
    # função criada e sem uso sai
    client.post("/api/efetivo/funcoes/nova", json={"funcao": "Rigger"})
    assert client.delete("/api/efetivo/funcoes/RIGGER").status_code == 204
