"""Indicadores (spec 027): KPIs sobre o histórico da programação e o Pareto de desvios."""
from io import BytesIO
from datetime import datetime

import pytest
from openpyxl import Workbook

from app.modules.indicadores.domain import kpi
from app.modules.indicadores.domain.pareto import ler_detalhamento


def _f(linha, prev, cap, real, modo="manual", concl=True, semana=32, hh_un=1.0, hh_eq=None, enc="A"):
    return kpi.FatoDia(1, "S32", linha, linha, semana, concl, modo, prev, cap, real, hh_un, hh_eq, enc, "EQ", "x",
                       "1.1", "m³", "área", "1 · G")


def test_kpis_por_atividade():
    fatos = [
        _f(1, 10, 10, 10, "capacidade", hh_eq=9), _f(1, 10, 10, 10, "capacidade", hh_eq=9),  # cumprida, carga 100 %
        _f(2, 30, 10, 15, "manual"), _f(2, None, 10, None, "manual"),  # 30 programado × 20 capacidade = 150 %
        _f(3, 5, 10, 0, "manual", enc="B"),  # sub-programada (50 %) e não feita
    ]
    ats = kpi.atividades(fatos)
    assert len(ats) == 3
    assert kpi.ppc(ats).valor == pytest.approx(1 / 3)
    assert kpi.aderencia(ats).valor == pytest.approx((20 + 15 + 0) / (20 + 30 + 5))
    assert kpi.carga(ats).valor == pytest.approx((20 + 30 + 5) / (20 + 20 + 10))
    assert kpi.classes_carga(ats) == {"sobre": 1, "ok": 1, "sub": 1}
    assert kpi.erro_programacao(ats).valor == pytest.approx((0 + 0.5 + 0.5) / 3)
    assert kpi.erro_previsao(ats).valor == pytest.approx((0 + 0.5 + 1) / 3)
    assert kpi.realizado_capacidade(ats).valor == pytest.approx(35 / 50)
    assert kpi.eficiencia_hh(ats).valor == pytest.approx(20 / 18)  # 20 un × 1 HH/un ÷ 18 HH da equipe
    # emitida e ainda não concluída não entra no PPC
    assert kpi.ppc(kpi.atividades([_f(9, 10, 10, None, concl=False)])).valor is None
    p = kpi.pareto({"Chuva": 3, "Falta de material": 1})
    assert p[0]["causa"] == "Chuva" and p[0]["pct"] == 0.75 and p[1]["pct_acumulado"] == 1.0


def _pareto_xlsx() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Detalhamento"
    ws.append([None, None, None, None, None, None, "Pareto de Desvios | OBRA TESTE"])
    ws.append([None, "Detalhamento"])
    ws.append([])
    ws.append([None, "Dia", "Semana", "ID", "Classificação", "Desvio", "Frente de serviço", "Ação", "Responsabilidade",
               "Responsabilidade - Gerencia", "Status", None, "Atividade impactada"])
    ws.append([None, datetime(2026, 11, 9), 32, "-", "Condições Meteorológicas (Chuva, Raio)", "Chuva", "Área 1",
               "Reprogramar", "Encarregado X", "CONTRATADA", 3, None, "Concreto"])
    ws.append([None, datetime(2026, 11, 9), 32, "-", "Condições Meteorológicas (Chuva, Raio)", "Chuva", "Área 1",
               "Reprogramar", "Encarregado X", "CONTRATADA", 3, None, "Concreto"])  # repetida: conta duas vezes
    ws.append([None, datetime(2026, 11, 10), 32, "A1", "Causa nova da obra", "Algo novo", "Área 2", None, None, "CLIENTE", 2])
    ws.append([None, None, None, None, None, None])
    ws.append([None, "x", 32, None, None, "sem dia"])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_le_detalhamento_do_pareto():
    from openpyxl import load_workbook

    ws = load_workbook(BytesIO(_pareto_xlsx())).active
    linhas, avisos = ler_detalhamento([tuple(r) for r in ws.iter_rows(values_only=True)])
    assert [x.classificacao for x in linhas][1:] == ["Condições Meteorológicas (Chuva, Raio)", "Causa nova da obra"]
    assert linhas[0].status == 3 and linhas[0].referencia is None and linhas[2].gerencia == "CLIENTE"
    assert len(avisos) == 1 and "linha 9" in avisos[0]


def test_importa_pareto_sem_duplicar_e_exporta(client):
    arq = {"arquivo": ("pareto.xlsx", _pareto_xlsx())}
    r = client.post("/api/desvios/importar", files=arq).json()
    assert r["importados"] == 3 and r["causas_novas"] == 1 and r["repetidos"] == 0
    r = client.post("/api/desvios/importar", files={"arquivo": ("pareto.xlsx", _pareto_xlsx())}).json()
    assert r["importados"] == 0 and r["repetidos"] == 3
    lista = client.get("/api/desvios").json()
    assert {d["causa"] for d in lista} == {"Condições Meteorológicas (Chuva, Raio)", "Causa nova da obra"}
    assert lista[0]["semana"] == 32 and all(d["origem"] == "importado" for d in lista)
    ind = client.get("/api/indicadores").json()
    assert ind["kpis"]["desvios"] == 3 and ind["pareto"][0]["ocorrencias"] == 2 and "pareto" in ind["memorias"]
    from openpyxl import load_workbook

    wb = load_workbook(BytesIO(client.get("/api/desvios/excel").content))
    assert wb["Detalhamento"]["D1"].value == "Classificação" and wb["Dados"].max_row == 4
    assert client.post("/api/desvios/causas", json={"descricao": "causa nova da obra"}).status_code == 422
