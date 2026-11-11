"""A aplicação respeita a estrutura do Primavera: WBS pelo seq_num (O.S. 1 antes da O.S. 2), códigos da WBS do P6."""
from pathlib import Path

import pytest


def xer() -> bytes:
    linhas = [
        "ERMHDR\t21.12",
        "%T\tPROJECT", "%F\tproj_id\tproj_short_name\tlast_recalc_date", "%R\t1\tTAM\t2026-11-01 00:00",
        "%T\tPROJWBS", "%F\twbs_id\tproj_node_flag\tseq_num\twbs_short_name\twbs_name\tparent_wbs_id",
        "%R\t10\tY\t0\tTAM\tProjeto\t",
        # no arquivo a O.S. 2 vem primeiro, mas o seq_num manda: O.S. 1 (1) antes da O.S. 2 (101)
        "%R\t30\tN\t101\t7\tO.S. 2\t10",
        "%R\t20\tN\t1\t5\tO.S. 1\t10",
        "%R\t22\tN\t200\t2\tCWA 004 - Novo CMD\t20",
        "%R\t21\tN\t100\t1\tMobilização / Marcos / Canteiro\t20",
        "%T\tTASK", "%F\ttask_id\twbs_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_drtn_hr_cnt\t"
                    "early_start_date\tearly_end_date\tphys_complete_pct",
        "%R\t1\t30\tB-2\tAtividade da OS 2\tTT_Task\tTK_NotStart\t8\t2026-11-10 07:00\t2026-11-11 17:00\t0",
        "%R\t2\t22\tC-10\tConcreto 10\tTT_Task\tTK_NotStart\t8\t2026-11-10 07:00\t2026-11-11 17:00\t0",
        "%R\t3\t22\tC-9\tConcreto 9\tTT_Task\tTK_Active\t8\t2026-11-10 07:00\t2026-11-11 17:00\t10",
        "%R\t4\t21\tM-1\tMobilizar\tTT_Task\tTK_Complete\t8\t2026-11-01 07:00\t2026-11-02 17:00\t100",
        "%E",
    ]
    return "\r\n".join(linhas).encode("cp1252")


def test_estrutura_e_ordem_do_primavera(client):
    r = client.post("/api/importar/xer", data={"rotulo": "S31"}, files={"arquivo": ("c.xer", xer())})
    assert r.status_code == 200, r.text
    arv = client.get("/api/cronograma/arvore").json()
    assert arv["versao"]["ordem_p6"] is True
    ordem = [a["id_crono"] for a in arv["atividades"]]
    # O.S. 1 (Mobilização seq 100, depois CWA 004 seq 200, IDs em ordem natural C-9 < C-10) e só então O.S. 2
    assert ordem == ["M-1", "C-9", "C-10", "B-2"]
    c9 = next(a for a in arv["atividades"] if a["id_crono"] == "C-9")
    assert c9["caminho"] == ["O.S. 1", "CWA 004 - Novo CMD"] and c9["wbs_codigos"] == ["5", "2"]
    assert c9["wbs_ordem"][0] < next(a for a in arv["atividades"] if a["id_crono"] == "B-2")["wbs_ordem"][0]
    assert [a["ordem_p6"] for a in arv["atividades"]] == [1, 2, 3, 4]
    m1 = arv["atividades"][0]  # nome de WBS com " / " continua sendo UM nível
    assert m1["caminho"] == ["O.S. 1", "Mobilização / Marcos / Canteiro"] and m1["wbs_codigos"] == ["5", "1"]
    busca = client.get("/api/cronograma/atividades").json()
    assert [a["id_crono"] for a in busca] == ordem


def test_xer_real_os1_antes_da_os2():
    from app.modules.referencias.application.importar_xer import estrutura_wbs, ler_xer

    p = Path("/root/.claude/uploads/011bc413-02b1-5ac2-8ac9-328b64323d85/608486db-Cronograma_Corrente_-_RSA_S31.xer")
    if not p.exists():
        pytest.skip("XER real fora do repositório")
    est = estrutura_wbs(ler_xer(p.read_bytes())["PROJWBS"])
    topo = sorted({tuple(n[:3]) for niv in est.values() if niv for n in niv[:1]}, key=lambda x: x[2])
    assert [n for n, _c, _k in topo][:2] == ["O.S. 1", "O.S. 2"] and [c for _n, c, _k in topo][:2] == ["5", "7"]


def test_linhas_da_programacao_seguem_o_p6(client):
    from tests.test_programacao_simplificada import LISTA

    client.post("/api/importar/xer", data={"rotulo": "S31"}, files={"arquivo": ("c.xer", xer())})
    area = client.post("/api/frentes/importar", json={"texto": LISTA}).json()[0]["areas"][0]
    g = client.post("/api/catalogo/grupos", json={"descricao": "Geral"}).json()
    t = client.post("/api/catalogo/tipos", json={"grupo_id": g["id"], "descricao": "Serviço", "unidade": "un"}).json()
    p = client.post("/api/programacoes", json={"tipo": "SEMANAL", "referencia": "2026-11-10"}).json()
    for idc in ("B-2", None, "C-10", "M-1"):  # incluídas fora de ordem; a sem atividade vai para o fim
        client.post(f"/api/programacoes/{p['id']}/linhas", json={"area_id": area["id"], "tipo_id": t["id"], "id_crono": idc})
    linhas = client.get(f"/api/programacoes/{p['id']}").json()["locais"][0]["areas"][0]["linhas"]
    assert [ln["id_crono"] for ln in linhas] == ["M-1", "C-10", "B-2", None]
