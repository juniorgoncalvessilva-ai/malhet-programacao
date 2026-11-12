"""WBS de execução ↔ Primavera (spec 040): áreas das Frentes entram na WBS; o que foi criado aqui vai para o .xer
(o resto do arquivo sai igual, byte a byte) e volta casado pelo código WBS / Activity ID, sem duplicar."""
import json
from urllib.parse import unquote

from app.modules.referencias.application.importar_xer import ler_xer
from app.modules.wbs.domain.xer import EstruturaP6, Xer, nome_area
from tests.test_pq_contrato import pq_contrato

LISTA = ("CWA\tAtivo\tDESCRICAO CWA\tLocal\n"
         "004.05\tED-1800AA-01\tGalpão de resíduos classe II\tNovo CMD\n"
         "004.07\tED-1800AA-04\tCasa de bombas\tNovo CMD\n"
         "012.04\tED-1630AA-05\tBaia de insuflamento\tOficina")


def xer(desc_pq: str) -> bytes:
    linhas = [
        "ERMHDR\t24.12",
        "%T\tPROJECT", "%F\tproj_id\tproj_short_name\tlast_recalc_date", "%R\t1\tTAM\t2026-11-01 00:00",
        "%T\tPROJWBS", "%F\twbs_id\tproj_id\tproj_node_flag\tseq_num\twbs_short_name\twbs_name\tparent_wbs_id\tguid",
        "%R\t10\t1\tY\t0\tTAM\tProjeto Tamanduá\t\tg0",
        "%R\t20\t1\tN\t1\t5\tO.S. 1\t10\tg1",
        "%R\t21\t1\tN\t2\t4\tCWP - CONSTRUÇÃO\t20\tg2",
        "%R\t22\t1\tN\t1\t3\tCWA 004 - Novo CMD\t21\tg3",
        "%R\t23\t1\tN\t1\t4\tCWA 004.05 - ED-1800AA-01 - Galpão\t22\tg4",
        "%R\t24\t1\tN\t1\t1\tSapatas\t23\tg5",
        "%R\t25\t1\tN\t2\t5\tCWA 011 a CWA 020 - Platô da Oficina\t21\tg6",
        "%T\tTASK", "%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\ttask_type\tstatus_code\tphys_complete_pct\t"
                    "act_start_date\tguid",
        f"%R\t1\t1\t24\tC-100\t{desc_pq}\tTT_Task\tTK_Active\t30\t2026-11-03 07:00\tt1",
        "%T\tTASKPRED", "%F\ttask_pred_id\ttask_id", "%R\t1\t1",
        "%E",
    ]
    return "\r\n".join(linhas).encode("cp1252")


def test_estrutura_do_xer_e_codigos():
    e = EstruturaP6(Xer.ler(xer("Concreto")))
    assert e.projeto == "TAM" and e.achar_area("004.05", "ED-1800AA-01") == "5.4.3.4"
    assert e.pai_da_area("004.07") == "5.4.3" and e.pai_da_area("012.04") == "5.4.5"  # faixa 011 a 020
    assert e.pai_da_area("030.01") == "5.4" and e.proximo_codigo("5.4.3") == "5"
    assert nome_area("004.07", "ED-1800AA-04", "Casa  de bombas") == "CWA 004.07 - ED-1800AA-04 - Casa de bombas"


def test_frentes_na_wbs_e_ida_e_volta_com_o_p6(client):
    client.post("/api/importar/takeoff", data={"rotulo": "PQ"}, files={"arquivo": ("pq.xlsx", pq_contrato())})
    # áreas importadas nas Frentes já aparecem na WBS; criada uma a uma também
    client.post("/api/frentes/importar", json={"texto": LISTA})
    arv = client.get("/api/wbs").json()["arvore"]
    assert [a["codigo"] for a in arv] == ["004.05", "004.07", "012.04"]
    loc = client.get("/api/frentes").json()[0]
    nova = client.post("/api/frentes/areas", json={"local_id": loc["id"], "cwa": "004.09", "descricao": "Subestação"}).json()
    assert len(client.get("/api/wbs").json()["arvore"]) == 4
    assert client.delete(f"/api/frentes/areas/{nova['id']}").status_code == 204  # vazia na WBS: sai junto
    assert len(client.get("/api/wbs").json()["arvore"]) == 3

    desc = next(x for x in client.get("/api/pq/estrutura").json()["linhas"] if x["item"] == "1.8.3.1.2")["descricao"]
    g = client.post("/api/catalogo/grupos", json={"descricao": "Concreto"}).json()
    client.post(f"/api/catalogo/grupos/{g['id']}/itens-pq", json={"itens": ["1.8.3.1.2"]})
    tipo = client.get("/api/catalogo").json()[0]["tipos"][0]
    a7 = next(a for a in client.get("/api/wbs").json()["arvore"] if a["codigo"] == "004.07")
    no = lambda **k: client.post("/api/wbs/nos", json=k).json()  # noqa: E731
    cwp = no(tipo="cwp", pai_id=a7["id"], elemento="Radier", complemento="Eixo A–B")
    gr = no(tipo="grupo", pai_id=cwp["id"], grupo_id=g["id"])
    iwp = no(tipo="iwp", pai_id=gr["id"], tipo_id=tipo["id"])
    # área com CWP na WBS não sai pelas Frentes
    assert client.delete(f"/api/frentes/areas/{a7['area_id']}").status_code == 422

    original = xer(desc)
    r = client.post("/api/wbs/exportar-p6", files={"arquivo": ("S31.xer", original)})
    assert r.status_code == 200, r.text
    resumo = json.loads(unquote(r.headers["X-Resumo"]))
    assert resumo["projeto"] == "TAM" and resumo["areas_no_p6"] == 1
    assert resumo["areas_novas"] == ["5.4.3.5", "5.4.5.1"] and resumo["cwps_novos"] == ["5.4.3.5.1"]
    assert resumo["atividades_novas"] == [f"EXE-{iwp['id']:05d}"]
    novo = r.content
    # tudo o que veio do P6 continua igual; as linhas novas entram no fim de PROJWBS e TASK
    assert set(original.split(b"\r\n")) <= set(novo.split(b"\r\n")) and novo.endswith(b"%E")
    t = ler_xer(novo)
    wbs = {w["wbs_id"]: w for w in t["PROJWBS"]}
    assert len(t["PROJWBS"]) == 10 and len(t["TASK"]) == 2 and len(t["TASKPRED"]) == 1
    assert wbs["20"]["wbs_name"] == "O.S. 1" and wbs["26"]["parent_wbs_id"] == "22"  # 004.07 abaixo do CWA 004
    nomes = {w["wbs_name"] for w in t["PROJWBS"]}
    assert {"CWA 004.07 - ED-1800AA-04 - Casa de bombas", "CWA 012.04 - ED-1630AA-05 - Baia de insuflamento",
            "Radier - Eixo A–B"} <= nomes
    nova_at = t["TASK"][1]
    assert (nova_at["task_code"], nova_at["status_code"], nova_at["phys_complete_pct"], nova_at["act_start_date"],
            nova_at["guid"]) == (f"EXE-{iwp['id']:05d}", "TK_NotStart", "0", "", "")
    assert nova_at["task_name"] == desc[:120]
    # a WBS de execução guarda os códigos
    a7 = next(a for a in client.get("/api/wbs").json()["arvore"] if a["codigo"] == "004.07")
    assert a7["codigo_p6"] == "5.4.3.5" and a7["filhos"][0]["codigo_p6"] == "5.4.3.5.1"

    # volta: o .xer com a WBS acrescentada vira o cronograma vigente → casa tudo, nada duplica
    antes = list(_todos(client.get("/api/wbs").json()["arvore"]))
    imp = client.post("/api/importar/xer", data={"rotulo": "S32"}, files={"arquivo": ("S32.xer", novo)})
    assert imp.status_code == 200
    s = imp.json()["wbs"]  # a importação do .xer já sincroniza a WBS
    depois = list(_todos(client.get("/api/wbs").json()["arvore"]))
    assert len(depois) == len(antes) + 3  # só o que é do P6: CWP Sapatas, grupo e IWP C-100
    assert s["iwps_novos"] == 1 and s["areas_novas"] == 0  # C-100; o EXE-… casou pelo Activity ID
    s2 = client.post("/api/wbs/sincronizar-cronograma").json()  # de novo: nada muda
    assert (s2["areas_novas"], s2["cwps_novos"], s2["grupos_novos"], s2["iwps_novos"]) == (0, 0, 0, 0)
    meu = next(n for n in depois if n["id"] == iwp["id"])
    assert meu["origem"] == "manual" and meu["fora_cronograma"] is False and meu["atividade_p6"] == desc[:120]
    # exportar de novo não acrescenta nada
    r2 = json.loads(unquote(client.post("/api/wbs/exportar-p6", files={"arquivo": ("S32.xer", novo)}).headers["X-Resumo"]))
    assert (r2["areas_novas"], r2["cwps_novos"], r2["atividades_novas"]) == ([], [], [])
    assert client.post("/api/wbs/exportar-p6", files={"arquivo": ("x.xer", b"nada")}).status_code == 422


def _todos(arv):
    for n in arv:
        yield n
        yield from _todos(n["filhos"])
