"""WBS do cronograma (P6) entra na WBS de execução a cada importação, sem duplicar nem apagar."""
from app.modules.referencias.infra.models import AtividadeCronogramaModel, VersaoReferenciaModel
from tests.test_pq_contrato import pq_contrato

LISTA = "CWA\tAtivo\tDESCRICAO CWA\tLocal\n004.05\tED-1800AA-01\tGalpão de resíduos classe II\tNovo CMD"


def _niveis(*nomes):
    return [{"nome": n, "codigo": str(i), "ordem": str(i)} for i, n in enumerate(nomes, start=1)]


def _cronograma(obra_id: int, rotulo: str, atividades: list[tuple[str, str, list]]):
    from app.core.db import SessionLocal

    with SessionLocal() as s:
        for v in s.query(VersaoReferenciaModel).filter_by(obra_id=obra_id, tipo="CRONOGRAMA"):
            v.vigente = False
        v = VersaoReferenciaModel(obra_id=obra_id, tipo="CRONOGRAMA", rotulo=rotulo, vigente=True, carregado_por="t")
        s.add(v)
        s.flush()
        for i, (idc, nome, niveis) in enumerate(atividades):
            s.add(AtividadeCronogramaModel(versao_id=v.id, id_crono=idc, atividade=nome, wbs_niveis=niveis, ordem_p6=i))
        s.commit()


def test_wbs_do_cronograma(client):
    obra = int(client.headers["X-Obra-Id"])
    client.post("/api/importar/takeoff", data={"rotulo": "PQ"}, files={"arquivo": ("pq.xlsx", pq_contrato())})
    client.post("/api/frentes/importar", json={"texto": LISTA})
    desc = next(x for x in client.get("/api/pq/estrutura").json()["linhas"] if x["item"] == "1.8.3.1.2")["descricao"]
    g = client.post("/api/catalogo/grupos", json={"descricao": "Concreto"}).json()
    client.post(f"/api/catalogo/grupos/{g['id']}/itens-pq", json={"itens": ["1.8.3.1.2"]})
    base = ("O.S. 1", "CWP - CONSTRUÇÃO", "CWA 004 - Novo CMD", "CWA 004.05 - ED-1800AA-01 - Galpão")
    _cronograma(obra, "Rev.1", [
        ("C-100", desc.upper() + ".", _niveis(*base, "Sapatas", "Fustes")),       # vira IWP (descrição = PQ)
        ("C-101", "Serviço que não está na PQ", _niveis(*base, "Sapatas", "Fustes")),
        ("C-200", desc, _niveis("O.S. 1", "PWP - SUPRIMENTOS", "CWA 004.05 - Galpão")),  # suprimentos: fora
    ])
    r = client.post("/api/wbs/sincronizar-cronograma").json()
    assert (r["areas_novas"], r["cwps_novos"], r["grupos_novos"], r["iwps_novos"]) == (1, 1, 1, 1)
    assert (r["sem_item_pq"], r["fora_do_ramo_de_construcao"]) == (1, 1)
    area = client.get("/api/wbs").json()["arvore"][0]
    cwp = area["filhos"][0]
    iwp = cwp["filhos"][0]["filhos"][0]
    assert (cwp["titulo"], cwp["origem"], iwp["id_crono"], iwp["item_pq"]) == ("Sapatas - Fustes", "p6", "C-100", "1.8.3.1.2")
    # nó manual ao lado não é tocado
    man = client.post("/api/wbs/nos", json={"tipo": "cwp", "pai_id": area["id"], "elemento": "Radier"}).json()
    # linha da programação a partir do IWP do P6 já fica ligada à atividade do cronograma
    p = client.post("/api/programacoes", json={"tipo": "SEMANAL", "referencia": "2026-11-10"}).json()
    client.post(f"/api/programacoes/{p['id']}/linhas", json={"wbs_no_id": iwp["id"]})
    ln = client.get(f"/api/programacoes/{p['id']}").json()["locais"][0]["areas"][0]["linhas"][0]
    assert ln["id_crono"] == "C-100" and ln["complemento"] == "Sapatas - Fustes"

    # nova revisão do P6: a atividade saiu → IWP e CWP ficam marcados (não apagados); o manual segue igual
    _cronograma(obra, "Rev.2", [("C-300", "Outra coisa", _niveis(*base, "Pilares"))])
    r = client.post("/api/wbs/sincronizar-cronograma").json()
    assert r["cwps_novos"] == 1 and r["fora_do_cronograma"] >= 3  # CWP Sapatas, grupo e IWP C-100
    nos = {n["id"]: n for n in _todos(client.get("/api/wbs").json()["arvore"])}
    assert nos[iwp["id"]]["fora_cronograma"] is True and nos[man["id"]]["fora_cronograma"] is False
    assert client.get(f"/api/programacoes/{p['id']}").json()["locais"][0]["areas"][0]["linhas"][0]["wbs_codigo"]
    # volta na Rev.3: deixa de estar fora
    _cronograma(obra, "Rev.3", [("C-100", desc, _niveis(*base, "Sapatas", "Fustes"))])
    client.post("/api/wbs/sincronizar-cronograma")
    nos = {n["id"]: n for n in _todos(client.get("/api/wbs").json()["arvore"])}
    assert nos[iwp["id"]]["fora_cronograma"] is False and len([n for n in nos.values() if n["tipo"] == "iwp"]) == 1


def _todos(arv):
    for n in arv:
        yield n
        yield from _todos(n["filhos"])
