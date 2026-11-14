"""Spec 079: critério de avanço (planilha CMS), etapas com peso financeiro e etapa sem avanço (só esforço/HH) como
subnível do IWP na WBS, e a linha da programação por etapa: valor = PU × peso; sem avanço = 0."""
from io import BytesIO

import openpyxl
import pytest

from app.modules.criterios.domain.criterio import COLUNAS, Etapa, criterio_do_item, ler_planilha, pu_da_etapa, separar_item
from app.shared.errors import DomainError
from tests.test_pq_contrato import pq_contrato
from tests.test_wbs import LISTA


def _planilha(linhas) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "CRITÉRIO DE MEDIÇÃO"
    ws.append(list(COLUNAS))
    for r in linhas:
        ws.append(list(r))
    b = BytesIO()
    wb.save(b)
    return b.getvalue()


def test_dominio_do_criterio():
    assert separar_item("23.1\tESTRUTURA METÁLICA – FABRICAÇÃO") == ("23.1", "ESTRUTURA METÁLICA – FABRICAÇÃO")
    assert separar_item("7.1PROJETO DETALHADO") == ("7.1", "PROJETO DETALHADO")
    crits, avisos = ler_planilha([
        ("CMS M.75.15.000", "23.2 COBERTURA", 1, "Fabricação", "doc", 0.4), ("CMS M.75.15.000", "23.2 COBERTURA", 2, "Pré-Montagem", None, 0.2),
        ("CMS M.75.15.000", "23.2 COBERTURA", 3, "Montagem", None, 0.3), ("CMS C.65.45.000", "6.1 GRAUTE", None, None, None, None),
        ("CMS C.01.05.005", "8.2 DESMOBILIZAÇÃO", 1, "Desmobilização", None, 0.6), ("CMS C.01.05.005", "9.1 CANTEIRO", 1, "Documentação", None, 1),
    ])
    assert len(crits) == 4 and any("90%" in a for a in avisos)  # mesmo código CMS em itens diferentes = critérios diferentes
    assert criterio_do_item("23.2.1.4", ["23.2", "23", "2"]) == "23.2" and criterio_do_item("232.1", ["23.2"]) is None
    assert pu_da_etapa(100, 0.4, False) == 40 and pu_da_etapa(100, 0, True) == 0
    with pytest.raises(DomainError):
        Etapa(1, "Pré-armação", 0.1, sem_avanco=True)


def test_etapas_na_wbs_e_na_programacao(client):
    client.post("/api/importar/takeoff", data={"rotulo": "PQ"}, files={"arquivo": ("pq.xlsx", pq_contrato())})
    client.post("/api/frentes/importar", json={"texto": LISTA})
    g = client.post("/api/catalogo/grupos", json={"descricao": "Concreto"}).json()
    client.post(f"/api/catalogo/grupos/{g['id']}/itens-pq", json={"itens": ["1.8.3.1.2"]})
    tipo = client.get("/api/catalogo").json()[0]["tipos"][0]

    # critério da planilha do grupo CMS C.45.12.000 (o item 1.8.3.1.2 da PQ tem o código CMS C.45.12.001 → casa pelo
    # grupo; o "1.8.3.1" do catálogo não é o número da PQ — spec 083) + etapa sem avanço criada à mão
    r = client.post("/api/criterios/importar", files={"arquivo": ("crit.xlsx", _planilha([
        ("CMS C.45.12.000", "1.8.3.1 CONCRETO ESTRUTURAL", 1, "Montagem de forma e armação", "Após a montagem", 0.7),
        ("CMS C.45.12.000", "1.8.3.1 CONCRETO ESTRUTURAL", 2, "Concretagem", "Após a concretagem", 0.3)]))})
    assert r.status_code == 200, r.text
    assert (r.json()["novos"], r.json()["etapas"]) == (1, 2)
    cr = client.get("/api/criterios").json()["criterios"][0]
    assert cr["item_pq"] == "1.8.3.1" and cr["soma"] == 1 and cr["itens_pq"] >= 1
    etapas = [{"numero": e["numero"], "nome": e["nome"], "percentual": e["percentual"]} for e in cr["etapas"]]
    r = client.put(f"/api/criterios/{cr['id']}", json={"codigo": cr["codigo"], "item_pq": cr["item_pq"], "descricao": cr["descricao"],
                                                        "etapas": [{"numero": 0, "nome": "Pré-armação (fora do local)", "sem_avanco": True}, *etapas]})
    assert r.status_code == 200 and r.json()["etapas"][0]["sem_avanco"] is True and r.json()["soma"] == 1
    assert client.get("/api/criterios/do-item", params={"item": "1.8.3.1.2"}).json()["codigo"] == "CMS C.45.12.000"

    no = lambda **k: client.post("/api/wbs/nos", json=k)  # noqa: E731
    a = client.get("/api/wbs").json()["arvore"][0]
    cwp = no(tipo="cwp", pai_id=a["id"], elemento="Radier").json()
    gr = no(tipo="grupo", pai_id=cwp["id"], grupo_id=g["id"]).json()
    iwp = no(tipo="iwp", pai_id=gr["id"], tipo_id=tipo["id"], quantidade=100).json()
    assert no(tipo="etapa", pai_id=gr["id"], elemento="X").status_code == 422  # etapa fica abaixo do IWP
    r = client.post(f"/api/wbs/nos/{iwp['id']}/aplicar-criterio").json()
    assert (r["criadas"], r["ja_existiam"]) == (3, 0)
    assert client.post(f"/api/wbs/nos/{iwp['id']}/aplicar-criterio").json()["criadas"] == 0  # não duplica
    ets = client.get("/api/wbs").json()["arvore"][0]["filhos"][0]["filhos"][0]["filhos"][0]["filhos"]
    assert [e["codigo"][-2:] for e in ets] == ["E1", "E2", "E3"] and ets[0]["sem_avanco"] and "só esforço" in ets[0]["detalhe"]
    assert no(tipo="etapa", pai_id=iwp["id"], elemento="Cura", percentual=150).status_code == 422

    # enviar o IWP para a programação leva as etapas: cada uma vira uma linha
    p = client.post("/api/programacoes", json={"tipo": "SEMANAL", "referencia": "2026-11-10"}).json()
    r = client.post(f"/api/programacoes/{p['id']}/linhas/da-wbs", json={"nos": [iwp["id"]]}).json()
    assert r["criadas"] == 3
    linhas = client.get(f"/api/programacoes/{p['id']}").json()["locais"][0]["areas"][0]["linhas"]
    por = {ln["etapa"]["nome"]: ln for ln in linhas}
    pre, mont = por["Pré-armação (fora do local)"], por["Montagem de forma e armação"]
    assert pre["etapa"]["sem_avanco"] and pre["pu"] == 0 and pre["pu_item"] and pre["qtd_projeto"] == 100
    assert mont["pu"] == pytest.approx(mont["pu_item"] * 0.7) and mont["descricao_reduzida"].endswith("— Montagem de forma e armação")
    assert pre["calc"]  # o esforço continua calculado (capacidade/HH) mesmo sem avanço
    # critério com etapa na WBS não sai
    assert client.delete(f"/api/criterios/{cr['id']}").status_code == 422
    # spec 081: no plano de 90 dias o IWP sem atividade no cronograma entra pela WBS, com as etapas e o CWP
    r = client.post("/api/planos/itens/da-wbs", json={"nos": [iwp["id"]], "inicio": "2026-11-16", "fim": "2026-12-11"}).json()
    assert r["criados"] == 3
    itens = [i for i in client.get("/api/planos", params={"inicio": "2026-11-16"}).json()["itens"] if i["wbs_no_id"]]
    pre_p = next(i for i in itens if i["etapa"] and i["etapa"]["sem_avanco"])
    assert pre_p["cwp"]["texto"] == "Radier" and pre_p["item_pq"] == "1.8.3.1.2" and pre_p["descricao"].endswith("— Pré-armação (fora do local)")
    assert pre_p["wbs_codigo"].endswith("-E1") and pre_p["id_crono"] is None


def test_vinculo_pelo_codigo_cms_e_nao_pelo_numero_do_catalogo():
    """Spec 083: o número do item na planilha de critérios é do catálogo (8.1 MOBILIZAÇÃO) e não casa com a PQ da obra
    (8.1.1.1.1 Montagem de cabo); o que liga é o código CMS, com vínculo à mão por cima."""
    from app.modules.criterios.domain.criterio import CriterioRef, cms_chave, cms_grupos, resolver_criterio

    assert cms_chave("CMS C.05.05.001") == cms_chave("CMS.C05.05.001") == ("C", 5, 5, 1)
    assert cms_chave("CMS. E.00.00.015") == ("E", 0, 0, 15) and cms_chave("sem código") is None
    assert cms_grupos(("C", 45, 12, 1)) == [("C", 45, 12, 0), ("C", 45, 0, 0)]
    cs = [CriterioRef(1, "CMS C.01.05.000", "8.1", "planilha"), CriterioRef(2, "CMS M.70.70.20", "16.9", "planilha"),
          CriterioRef(3, "CMS C.65.15.000", "6.3", "planilha"), CriterioRef(4, "CMS C.65.15.000", "6.4", "planilha"),
          CriterioRef(5, "CMS X.99.99.999", "1.8.3", "manual")]
    assert resolver_criterio("8.1.1.1.1", "CMS.M70.70.20", cs) == (2, "cms", 1)  # não pega o 8.1 do catálogo
    assert resolver_criterio("8.1.1.1.9", None, cs) == (None, None, 0)
    assert resolver_criterio("1.8.3.1.5", "CMS.C65.15.000", cs) == (3, "cms", 2)  # dois com o mesmo código: avisa
    assert resolver_criterio("1.8.3.1.5", "CMS.C65.15.000", cs, vinculo=4) == (4, "vinculo", 1)
    assert resolver_criterio("1.8.3.2.1", "CMS C.99.00.001", cs) == (5, "item", 1)  # cadastrado à mão para o item
    assert resolver_criterio("2.1.1.1", "CMS C.01.05.007", cs) == (1, "cms_grupo", 1)


def test_tela_pela_pq_e_vinculo_na_linha(client):
    client.post("/api/importar/takeoff", data={"rotulo": "PQ"}, files={"arquivo": ("pq.xlsx", pq_contrato())})
    client.post("/api/criterios/importar", files={"arquivo": ("crit.xlsx", _planilha([
        ("CMS C.45.12.001", "9.9 CONCRETO BOMBEADO", 1, "Concretagem", None, 1),
        ("CMS C.45.12.000", "9.8 CONCRETOS", 1, "Lançamento", None, 1)]))})
    linhas = client.get("/api/criterios/pq").json()["linhas"]
    titulo = next(x for x in linhas if x["item"] == "1.8.3.1")
    assert titulo["folha"] is False and "criterio_id" not in titulo
    a, b = next(x for x in linhas if x["item"] == "1.8.3.1.2"), next(x for x in linhas if x["item"] == "1.8.3.1.3")
    assert a["como"] == "cms" and a["unid"] == "m³" and a["cms"]
    assert b["como"] == "cms_grupo"  # C.45.12.002 → grupo C.45.12.000
    exato = a["criterio_id"]
    assert client.put("/api/criterios/pq/1.8.3.1.3/vinculo", json={"criterio_id": exato}).status_code == 200
    b = next(x for x in client.get("/api/criterios/pq").json()["linhas"] if x["item"] == "1.8.3.1.3")
    assert (b["criterio_id"], b["como"], b["vinculado"]) == (exato, "vinculo", True)
    assert {c["codigo"]: c["itens_pq"] for c in client.get("/api/criterios").json()["criterios"]}["CMS C.45.12.001"] == 2
    assert client.put("/api/criterios/pq/1.8.3.1.3/vinculo", json={"criterio_id": None}).status_code == 200
    assert client.put("/api/criterios/pq/1.8/vinculo", json={"criterio_id": exato}).status_code == 422  # título não


def test_sugestao_pela_descricao_nao_vincula_sozinha():
    from app.modules.criterios.domain.criterio import sugerir_por_descricao

    cs = [(1, "MOBILIZAÇÃO DE PESSOAL E EQUIPAMENTOS"), (2, "DESMOBILIZAÇÃO DE PESSOAL E EQUIPAMENTOS"), (3, "CONSTRUÇÃO DE CANTEIRO DE OBRAS")]
    assert sugerir_por_descricao("Mobilização de pessoal e equipamentos", [], cs) == 1
    assert sugerir_por_descricao("Construção de canteiro de obras - 1485AA", [], cs) == 3
    assert sugerir_por_descricao("Item qualquer", ["CANTEIRO DE OBRAS", "CONSTRUÇÃO DE CANTEIRO DE OBRAS"], cs) == 3  # pelo título acima
    assert sugerir_por_descricao("Pintura de ligação", [], cs) is None
