"""Spec 107: uma pessoa, uma equipe (líder pode estar em várias), histórico das trocas e nome padrão das equipes."""
from datetime import date, datetime

import pytest

from app.modules.equipes.domain.alocacao import (
    EquipeResumo,
    Movimento,
    disciplina_do_nome,
    equipes_de_saida,
    nome_padrao,
    numero_do_nome,
    proximo_numero,
    resumo_movimentos,
    validar_modelo,
)
from app.shared.errors import DomainError
from tests.test_efetivo import efetivo

M = "EQUIPE.{n}_{disciplina}"


def test_sai_da_outra_equipe_menos_lider():
    a = EquipeResumo(1, "A", frozenset({"10", "11"}), encarregado="90")
    b = EquipeResumo(2, "B", frozenset({"12"}), encarregado="91", responsavel_id=7, supervisor_id=8)
    c = EquipeResumo(3, "C", frozenset())
    assert [e.id for e in equipes_de_saida("10", None, 3, [a, b, c])] == [1]
    assert equipes_de_saida("10", None, 1, [a, b, c]) == []  # já é a própria equipe
    assert equipes_de_saida("90", None, 3, [a, b, c]) == []  # encarregado de A
    assert equipes_de_saida("12", 7, 3, [a, b, c]) == []  # responsável de B
    assert equipes_de_saida("12", 8, 3, [a, b, c]) == []  # supervisor de B
    assert [e.id for e in equipes_de_saida("12", 5, 3, [a, b, c])] == [2]
    assert equipes_de_saida("", None, 3, [a, b, c]) == []


def test_nome_padrao_e_proximo_numero():
    nomes = ["EQUIPE.10_FORMA", "EQUIPE.1_MONTAGEM DE ANDAIME", "EQUIPE_20_ARMAÇÃO", "EQ CONCRETO 01", "equipe.7_forma"]
    assert [numero_do_nome(M, x) for x in nomes] == [10, 1, 20, None, 7]
    assert proximo_numero(M, nomes) == 21
    assert proximo_numero(M, []) == 1
    assert nome_padrao(M, 21, "  forma  de  pilar ") == "EQUIPE.21_FORMA DE PILAR"
    assert nome_padrao(M, 7, "forma", digitos=2) == "EQUIPE.07_FORMA"
    assert nome_padrao("EQ-{n}", 3, None) == "EQ-3"
    with pytest.raises(DomainError):
        nome_padrao(M, 1, " ")
    assert [disciplina_do_nome(M, x) for x in nomes] == ["FORMA", "MONTAGEM DE ANDAIME", "ARMAÇÃO", None, "FORMA"]
    assert validar_modelo(" EQ-{n}-{disciplina} ") == "EQ-{n}-{disciplina}"
    for ruim in ("EQUIPE_{disciplina}", "EQ{n}{n}", "EQ{n}_{nome}", "EQ{n}" + "x" * 60):
        with pytest.raises(DomainError):
            validar_modelo(ruim)


def test_resumo_das_movimentacoes():
    t = lambda d: datetime(2026, 11, d, 10)  # noqa: E731
    movs = [Movimento(t(2), "ANA", 1, "A", 2, "B"), Movimento(t(3), "ANA", 2, "B", None, None),
            Movimento(t(10), "JOSÉ", None, None, 1, "A"), Movimento(t(30), "FORA", 1, "A", 2, "B")]
    r = resumo_movimentos(movs, date(2026, 11, 1), date(2026, 11, 15), {1: "EQUIPE.1_FORMA", 2: "EQUIPE.2_CONCRETO"})
    assert (r["total"], r["trocas"], r["pessoas"]) == (3, 1, 2)
    por = {x["equipe"]: x for x in r["por_equipe"]}
    assert (por["EQUIPE.1_FORMA"]["entradas"], por["EQUIPE.1_FORMA"]["saidas"]) == (1, 1)  # renomeada: vale o nome atual
    assert (por["EQUIPE.2_CONCRETO"]["entradas"], por["EQUIPE.2_CONCRETO"]["saidas"]) == (1, 1)
    assert [s["total"] for s in r["por_semana"]] == [0, 2, 1]  # semanas de 26/10 (1º/11 é domingo), 02/11 e 09/11
    assert r["memorias"]["total"]["valor"] == "3" and "equipe:EQUIPE.1_FORMA" in r["memorias"]
    with pytest.raises(DomainError):
        resumo_movimentos(movs, date(2026, 11, 15), date(2026, 11, 1), {})


def test_troca_de_equipe_pelo_cadastro_organograma_e_efetivo(client):
    client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
    cs = {c["nome"]: c for c in client.get("/api/efetivo/colaboradores").json()}
    enc, ped, srv, mot = (cs[n] for n in ("ENCARREGADO TESTE UM", "PEDREIRO TESTE DOIS", "SERVENTE TESTE TRES", "MOTORISTA TERCEIRO"))
    a = client.post("/api/efetivo/equipes", json={"nome": "EQUIPE.1_FORMA", "encarregado_id": enc["id"],
                                                  "colaboradores": [ped["id"], srv["id"]]}).json()
    # pelo cadastro: o pedreiro entra em B e sai sozinho de A
    b = client.post("/api/equipes", json={"nome": "EQUIPE.2_CONCRETO", "membros": [{"cracha": "115013", "nome": "PEDREIRO"}]})
    assert b.status_code == 201, b.text
    b = b.json()
    eqs = {e["id"]: e for e in client.get("/api/equipes").json()}
    assert [m["nome"] for m in eqs[a["id"]]["membros"]] == ["SERVENTE TESTE TRES"]
    assert [m["nome"] for m in eqs[b["id"]]["membros"]] == ["PEDREIRO TESTE DOIS"]

    # líder (responsável de A) que também é funcionário de A entra em B e continua em A
    assert client.put(f"/api/efetivo/colaboradores/{mot['id']}/cracha", json={"cracha": "T900"}).status_code == 200
    mot = {**mot, "cracha": "T900"}
    client.put("/api/equipes/lideranca/definir", json={"equipes": [a["id"]], "papel": "responsavel", "colaborador_id": mot["id"]})
    r = client.put("/api/efetivo/equipe", json={"colaboradores": [mot["id"]], "equipe_id": a["id"]})
    assert r.status_code == 200, r.text
    r = client.post(f"/api/equipes/{b['id']}/membros", json={"cracha": mot["cracha"] or mot["matricula"]})
    assert r.status_code == 200, r.text
    eqs = {e["id"]: e for e in client.get("/api/equipes").json()}
    assert "MOTORISTA TERCEIRO" in {m["nome"] for m in eqs[a["id"]]["membros"]} & {m["nome"] for m in eqs[b["id"]]["membros"]}

    # pelo organograma (sem dizer de onde vem): o servente vai para B e sai de A
    client.post(f"/api/equipes/{b['id']}/membros", json={"cracha": "115014"})
    # pela tela do efetivo: o pedreiro volta para A
    client.put("/api/efetivo/equipe", json={"colaboradores": [ped["id"]], "equipe_id": a["id"]})
    # tirar o servente de B: fica sem equipe
    assert client.delete(f"/api/equipes/{b['id']}/membros/115014").status_code == 204
    eqs = {e["id"]: e for e in client.get("/api/equipes").json()}
    assert {m["nome"] for m in eqs[a["id"]]["membros"]} == {"PEDREIRO TESTE DOIS", "MOTORISTA TERCEIRO"}
    assert {m["nome"] for m in eqs[b["id"]]["membros"]} == {"MOTORISTA TERCEIRO"}

    # renomear B não perde a contagem (os movimentos guardam o id)
    eb = eqs[b["id"]]
    client.put(f"/api/equipes/{b['id']}", json={**eb, "nome": "EQUIPE.2_CONCRETO ARMADO"})
    hoje = date.today().isoformat()
    m = client.get("/api/equipes/movimentacoes", params={"inicio": hoje, "fim": hoje}).json()
    por = {x["equipe"]: (x["entradas"], x["saidas"]) for x in m["por_equipe"]}
    # A: entram ped+srv (criação), ped sai p/ B, mot entra, srv sai p/ B, ped volta
    assert por["EQUIPE.1_FORMA"] == (4, 2)
    assert por["EQUIPE.2_CONCRETO ARMADO"] == (3, 2)  # ped, mot, srv entram; ped volta p/ A, srv tirado
    trocas = [(i["nome"], i["de"], i["para"]) for i in m["itens"]]
    assert ("PEDREIRO TESTE DOIS", "EQUIPE.1_FORMA", "EQUIPE.2_CONCRETO ARMADO") in trocas
    assert ("SERVENTE TESTE TRES", "EQUIPE.2_CONCRETO ARMADO", None) in trocas
    assert m["total"] == len(m["itens"]) == 8 and m["pessoas"] == 3 and m["trocas"] == 3
    hist = client.get("/api/efetivo/movimentos", params={"colaborador_id": ped["id"]}).json()
    assert [x["tipo"] for x in hist].count("EQUIPE") == 3


def test_nome_automatico_pela_configuracao(client):
    client.post("/api/equipes", json={"nome": "EQUIPE.10_FORMA"})
    client.post("/api/equipes", json={"nome": "EQUIPE_20_ARMAÇÃO"})
    cf = client.get("/api/equipes/config").json()
    assert (cf["modelo_nome"], cf["proximo_numero"], cf["disciplinas"]) == (M, 21, ["ARMAÇÃO", "FORMA"])
    r = client.post("/api/equipes", json={"nome": "", "disciplina_padrao": "concreto"})
    assert r.status_code == 201 and r.json()["nome"] == "EQUIPE.21_CONCRETO"
    assert client.post("/api/equipes", json={"nome": "", "disciplina_padrao": ""}).status_code == 422
    assert client.post("/api/equipes", json={"nome": "EQUIPE.21_CONCRETO"}).status_code == 422  # já existe
    # padrão da empresa trocado (com dois dígitos)
    assert client.put("/api/equipes/config", json={"modelo_nome": "EQ-{n}-{disciplina}", "digitos": 2}).status_code == 200
    assert client.put("/api/equipes/config", json={"modelo_nome": "EQUIPE"}).status_code == 422
    r = client.post("/api/equipes", json={"nome": "", "disciplina_padrao": "forma"}).json()
    assert r["nome"] == "EQ-01-FORMA"
    assert client.get("/api/equipes/config").json()["proximo_numero"] == 2


def test_criar_pelo_efetivo_no_padrao(client):
    client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
    cs = {c["nome"]: c for c in client.get("/api/efetivo/colaboradores").json()}
    client.post("/api/equipes", json={"nome": "EQUIPE.4_FORMA"})
    r = client.post("/api/efetivo/equipes", json={"disciplina_padrao": "armação", "encarregado_id": cs["ENCARREGADO TESTE UM"]["id"],
                                                  "colaboradores": [cs["PEDREIRO TESTE DOIS"]["id"]]})
    assert r.status_code == 201 and r.json()["nome"] == "EQUIPE.5_ARMAÇÃO"
    assert client.post("/api/efetivo/equipes", json={"encarregado_id": cs["SERVENTE TESTE TRES"]["id"]}).status_code == 422
