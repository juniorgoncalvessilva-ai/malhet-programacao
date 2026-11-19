"""Spec 108: 6WLA em Excel no layout da obra — janela de 6 semanas, WBS do P6, linha de base e restrições 6M."""
from datetime import date
from io import BytesIO

from openpyxl import load_workbook

from app.modules.planos.domain.seis_semanas import (
    GRUPO_PLANO,
    Atividade,
    codigo_wbs,
    janela,
    montar,
    semanas_da_atividade,
)


def test_janela_semana_corrente_mais_seis():
    j = janela(date(2026, 11, 19), date(2026, 11, 4))  # quinta da S33; data de status na S31
    assert (j.inicio, j.fim, j.corrente, j.data_date) == (date(2026, 11, 15), date(2027, 1, 2), 33, 31)
    assert j.numeros == [33, 34, 35, 36, 37, 38, 39]
    assert janela(date(2026, 11, 15), None).corrente == 33 and janela(date(2026, 11, 14), None).corrente == 32  # domingo vira


def test_linhas_pela_wbs_do_p6():
    j = janela(date(2026, 11, 10), None)  # S32: 08/11 a 26/12
    os1 = ("1", "5", "O.S. 1")
    cwa = ("1/2", "5.2", "CWA 004")
    mob = ("1/1", "5.1", "Mobilização")
    ats = [
        Atividade("C-9", "Concreto 9", (os1, cwa), date(2026, 11, 10), date(2026, 11, 11), ordem=2, pct=0.1),
        Atividade("C-10", "Concreto 10", (os1, cwa), date(2026, 11, 20), date(2026, 11, 29), ordem=3, pct=0.0),
        Atividade("M-1", "Mobilizar", (os1, mob), date(2026, 11, 1), date(2026, 11, 2), ordem=1, pct=1.0),  # fora da janela
        Atividade("M-2", "Desmobilizar", (os1, mob), date(2026, 12, 20), date(2027, 1, 5), ordem=4),
        Atividade("P90-0003", "Andaime", (GRUPO_PLANO,), date(2026, 11, 9), date(2026, 11, 9), ordem=3),
    ]
    ls = montar(ats, j)
    assert [(x.tipo, x.nivel, x.codigo) for x in ls] == [
        ("wbs", 0, "5  O.S. 1"), ("wbs", 1, "5.1  Mobilização"), ("atividade", 2, "M-2"),
        ("wbs", 1, "5.2  CWA 004"), ("atividade", 2, "C-9"), ("atividade", 2, "C-10"),
        ("wbs", 0, "P90  PLANO DE 90 DIAS — NO PLANO, FORA DO CRONOGRAMA NESTAS SEMANAS"), ("atividade", 1, "P90-0003")]
    cwa_l = ls[3]
    assert (cwa_l.inicio, cwa_l.fim) == (date(2026, 11, 10), date(2026, 11, 29))
    assert round(cwa_l.pct, 4) == round(0.1 * 2 / 12, 4)  # média pela duração: 2 dias a 10% + 10 dias a 0%
    assert semanas_da_atividade(ats[1], j) == [False, True, True, True, False, False, False]  # S33 a S35 (20/11 sex a 29/11 dom)
    assert semanas_da_atividade(ats[3], j)[-2:] == [False, True]  # 20/12 é domingo: já a S38


def test_linha_de_base_e_6m():
    a = Atividade("C-9", "x", (), date(2026, 11, 10), date(2026, 11, 13), bl_fim=date(2026, 11, 11),
                  restricoes={"MAT": (2, 1), "MET": (1, 0)})
    assert a.variacao == -2  # terminou 2 dias depois da linha de base
    assert (a.seis_m("MAT"), a.seis_m("MET"), a.seis_m("MDO")) == (1, 0, None)
    assert codigo_wbs([{"nome": "O.S. 1", "codigo": "5", "ordem": "a"}, {"nome": "CWA", "codigo": "2", "ordem": "a/b"}]) == \
        (("a", "5", "O.S. 1"), ("a/b", "5.2", "CWA"))


def _xer(fim_c9: str) -> bytes:
    linhas = [
        "ERMHDR\t21.12",
        "%T\tPROJECT", "%F\tproj_id\tproj_short_name\tlast_recalc_date", "%R\t1\tTAM\t2026-11-04 00:00",
        "%T\tPROJWBS", "%F\twbs_id\tproj_node_flag\tseq_num\twbs_short_name\twbs_name\tparent_wbs_id",
        "%R\t10\tY\t0\tTAM\tProjeto\t", "%R\t20\tN\t1\t5\tO.S. 1\t10", "%R\t22\tN\t200\t2\tCWA 004 - Novo CMD\t20",
        "%R\t21\tN\t100\t1\tMobilização\t20",
        "%T\tTASK", "%F\ttask_id\twbs_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_drtn_hr_cnt\t"
                    "early_start_date\tearly_end_date\tphys_complete_pct",
        "%R\t2\t22\tC-10\tConcreto 10\tTT_Task\tTK_NotStart\t8\t2026-11-20 07:00\t2026-11-29 17:00\t0",
        f"%R\t3\t22\tC-9\tConcreto 9\tTT_Task\tTK_Active\t8\t2026-11-10 07:00\t{fim_c9} 17:00\t10",
        "%R\t4\t21\tM-1\tMobilizar\tTT_Task\tTK_Complete\t8\t2026-11-01 07:00\t2026-11-02 17:00\t100",
        "%E",
    ]
    return "\r\n".join(linhas).encode("cp1252")


def test_excel_6wla_no_layout_da_obra(client):
    assert client.post("/api/importar/xer", data={"rotulo": "Linha de base"}, files={"arquivo": ("a.xer", _xer("2026-11-11"))}).status_code == 200
    assert client.post("/api/importar/xer", data={"rotulo": "S32"}, files={"arquivo": ("b.xer", _xer("2026-11-13"))}).status_code == 200
    versoes = client.get("/api/planos/seis-semanas/versoes").json()
    assert [v["rotulo"] for v in versoes] == ["Linha de base", "S32"] and versoes[1]["vigente"]
    it = client.post("/api/planos/itens", json={"descricao": "Montar andaime fachada", "inicio": "2026-11-12", "fim": "2026-11-14"}).json()
    client.post(f"/api/planos/itens/{it['id']}/restricoes", json={"acao": "Comprar tubos", "seis_m": "MAT"})

    p = client.get("/api/planos/seis-semanas/previa", params={"referencia": "2026-11-10"}).json()
    assert (p["semana_corrente"], p["semana_dd"], p["atividades"], p["do_cronograma"], p["so_plano"], p["com_restricao"]) == (32, 31, 3, 2, 1, 1)
    assert p["linha_base"] == "Linha de base" and p["memorias"]["atividades"]["valor"] == "3"
    assert client.get("/api/planos/seis-semanas/previa", params={"base_id": 99999}).status_code == 422

    r = client.get("/api/planos/seis-semanas.xlsx", params={"referencia": "2026-11-10"})
    assert r.status_code == 200 and "6WLA_S32_a_S38" in r.headers["content-disposition"]
    wb = load_workbook(BytesIO(r.content))
    assert wb.sheetnames == ["CRONOGRAMA 6WLA", "Dados - Semanas"]
    ws = wb["CRONOGRAMA 6WLA"]
    cab = {ws.cell(3, c).value for c in range(2, 33)}
    assert {"Activity ID", "Activity Name", "Start", "Finish", "Semana Início", "Semana fim", "MÉTODO", "MEIO AMBIENTE"} <= cab
    assert (ws["S3"].value, ws["T3"].value, ws["U3"].value, ws["Z3"].value) == (31, 32, "=T3+1", "=Y3+1")
    assert (ws["T2"].value, ws["Z2"].value) == ("Semana Corrente", "6ª Semana")
    linhas = {str(ws[f"C{r}"].value).strip(): r for r in range(4, ws.max_row + 1) if ws[f"C{r}"].value}
    assert list(linhas) == ["5  O.S. 1", "5.2  CWA 004 - Novo CMD", "C-9", "C-10",
                            "P90  PLANO DE 90 DIAS — NO PLANO, FORA DO CRONOGRAMA NESTAS SEMANAS", "P90-0001"]  # M-1 fora da janela
    c9 = linhas["C-9"]
    assert (ws[f"D{c9}"].value, ws[f"G{c9}"].value.date(), ws[f"J{c9}"].value.date(), ws[f"K{c9}"].value) == \
        ("Concreto 9", date(2026, 11, 10), date(2026, 11, 11), -2)
    assert ws[f"F{c9}"].value == 0.1 and ws[f"F{c9}"].number_format == "0.00%"
    assert ws[f"T{c9}"].value == f'=IF(AND(T$3>=$Q{c9},T$3<=$R{c9}),"1","")'
    assert "Dados - Semanas" in ws[f"Q{c9}"].value
    pl = linhas["P90-0001"]
    assert (ws[f"D{pl}"].value, ws[f"AC{pl}"].value, ws[f"AA{pl}"].value) == ("Montar andaime fachada", 1, None)  # 1 de Material
    assert ws[f"C{linhas['5  O.S. 1']}"].fill.fgColor.rgb.endswith("FFFF00")  # nível 1 amarelo, como na obra
    sem = {c.value.date(): n.value for c, n in wb["Dados - Semanas"].iter_rows(max_col=2) if c.value}
    assert sem[date(2026, 11, 8)] == 32 and sem[date(2026, 11, 14)] == 32 and sem[date(2026, 11, 15)] == 33
    assert ws.freeze_panes == "E4" and ws.column_dimensions["E"].hidden
