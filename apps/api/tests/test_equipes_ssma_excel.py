"""Spec 010: equipes do Simova (turno/jornada), salvar programação em lote, SSMA pela segurança, Excel do cliente."""
import asyncio
from io import BytesIO

import pytest
from openpyxl import Workbook, load_workbook

from app.core.config import get_settings
from app.main import app
from app.modules.equipes.domain.simova_equipe import interpretar, nome_proprio, pessoas
from app.modules.obras.application.acessos import garantir_superadmin
from app.modules.obras.infra.contas_authkit import ContasAuthKit
from tests.test_programacao_simplificada import LISTA

# dados fictícios no formato do Simova (nomes reais nunca vão para o git)
CAB = [None, "Código", "Descrição", "Encarregado", "Funcionário", "Equipamento", "Ativo"]
LINHAS = [
    [None, 1, "EQUIPE.1_ANDAIME", "900001 :: JOAO DA SILVA", "900011 :: ANA PEREIRA900012 :: CARLOS DE SOUZA", None, 1],
    [None, 2, "EQUIPE.2_CONCRETO", "900002 :: MARIA DOS SANTOS",
     "900021 :: PEDRO ALVES\n900022 :: LUCAS LIMA900023 :: RAFAEL COSTA900024 :: BRUNO DIAS", "Betoneira", 1],
    [None, 3, "EQUIPE.3_DESMOBILIZADA", "900003 :: JOSE NUNES", "", None, 0],
]


def test_le_cadastro_de_equipes_do_simova():
    eqs = interpretar([[None] * 7, CAB, *LINHAS])
    assert [e.codigo for e in eqs] == ["1", "2", "3"]
    assert eqs[0].encarregado.cracha == "900001" and eqs[0].encarregado.nome == "Joao da Silva"
    assert [p.cracha for p in eqs[1].funcionarios] == ["900021", "900022", "900023", "900024"]
    assert eqs[1].equipamentos == "Betoneira" and eqs[2].ativo is False
    assert nome_proprio("CARLOS DE SOUZA") == "Carlos de Souza"
    assert pessoas(None) == ()


def _xlsx(linhas) -> bytes:
    wb = Workbook()
    for ln in linhas:
        wb.active.append(ln)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _login(client, email, senha) -> dict:
    r = client.post("/api/auth/login", json={"email": email, "password": senha})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}


def test_equipes_programacao_ssma_e_excel(client, monkeypatch):
    # equipes do Simova: cria, depois reimporta sem duplicar e preserva turno/jornada/funções
    r = client.post("/api/equipes/importar-simova", files={"arquivo": ("Equipe.xlsx", _xlsx([CAB, *LINHAS]))})
    assert r.status_code == 200, r.text and r.json() == {"criadas": 3, "atualizadas": 0}
    eqs = {e["codigo_simova"]: e for e in client.get("/api/equipes").json()}
    concreto = eqs["2"]
    assert concreto["turno"] == "Diurno" and len(concreto["membros"]) == 4 and concreto["hh_disponivel_dia"] == 36
    membros = [{**m, "funcao": "Pedreiro" if i < 2 else "Servente"} for i, m in enumerate(concreto["membros"])]
    r = client.put(f"/api/equipes/{concreto['id']}", json={**concreto, "turno": "Noturno", "jornada_horas": 8,
                                                          "responsavel": "Eng. Fulano", "membros": membros})
    assert r.status_code == 200
    assert {(c["recurso"], c["quantidade"]) for c in r.json()["composicao_efetiva"]} == {("Pedreiro", 2), ("Servente", 2)}
    client.post("/api/equipes/importar-simova", files={"arquivo": ("Equipe.xlsx", _xlsx([CAB, *LINHAS]))})
    eq2 = next(e for e in client.get("/api/equipes").json() if e["codigo_simova"] == "2")
    assert eq2["turno"] == "Noturno" and eq2["jornada_horas"] == 8 and eq2["membros"][0]["funcao"]
    assert len(client.get("/api/equipes").json()) == 3
    desm = next(e for e in client.get("/api/equipes").json() if e["codigo_simova"] == "3")
    assert client.delete(f"/api/equipes/{desm['id']}").status_code == 204  # excluir equipe (com membros)
    assert len(client.get("/api/equipes").json()) == 2

    # programação: linha herda o responsável da equipe; salvar em lote (qtd do período + dias)
    area = client.post("/api/frentes/importar", json={"texto": LISTA}).json()[0]["areas"][0]
    g = client.post("/api/catalogo/grupos", json={"descricao": "Concreto"}).json()
    t = client.post("/api/catalogo/tipos", json={"grupo_id": g["id"], "descricao": "Concreto 20 MPa", "unidade": "m³"}).json()
    p = client.post("/api/programacoes", json={"tipo": "SEMANAL", "referencia": "2026-11-10"}).json()
    r = client.post(f"/api/programacoes/{p['id']}/linhas", json={
        "area_id": area["id"], "tipo_id": t["id"], "equipe_id": eq2["id"], "natureza": "O", "qtd_projeto": 100,
        "id_crono": "CMD-1010"})
    lid = r.json()["id"]
    r = client.put(f"/api/programacoes/{p['id']}/salvar", json={"linhas": [{
        "id": lid, "qtd_periodo": 30, "mudar_qtd_periodo": True,
        "previsto": [{"data": "2026-11-09", "valor": 10}, {"data": "2026-11-10", "valor": 20}],
        "realizado": [{"data": "2026-11-09", "valor": 8}]}]})
    assert r.status_code == 200 and r.json()["alteracoes"] == 4
    ln = client.get(f"/api/programacoes/{p['id']}").json()["locais"][0]["areas"][0]["linhas"][0]
    assert (ln["qtd_periodo"], ln["natureza"], ln["responsavel"], ln["turno"]) == (30, "O", "Eng. Fulano", "Noturno")
    assert ln["total_previsto"] == 30 and ln["restante"] == 92

    # semana seguinte: realizado acumulado conta o dia uma vez só
    p2 = client.post("/api/programacoes", json={"tipo": "SEMANAL", "referencia": "2026-11-17", "copiar_de": p["id"]}).json()
    ln2 = client.get(f"/api/programacoes/{p2['id']}").json()["locais"][0]["areas"][0]["linhas"][0]
    assert ln2["realizado_anterior"] == 8 and ln2["natureza"] == "O"

    # segurança: só SSMA (inclusive com a programação emitida)
    obra = client.headers["X-Obra-Id"]
    monkeypatch.setattr(get_settings(), "auth_disabled", False)
    asyncio.run(garantir_superadmin(ContasAuthKit(app.state.auth), "sa@obra.com", "SuperSenha123"))
    sa = _login(client, "sa@obra.com", "SuperSenha123")
    r = client.post(f"/api/obras/{obra}/acessos", headers=sa,
                    json={"email": "tst@obra.com", "papel": "seguranca", "senha_inicial": "SenhaForte789"})
    assert r.status_code == 201, r.text
    seg = {**_login(client, "tst@obra.com", "SenhaForte789"), "X-Obra-Id": obra}
    assert client.post(f"/api/programacoes/{p['id']}/emitir", headers={**sa, "X-Obra-Id": obra}).status_code == 200
    r = client.put(f"/api/programacoes/{p['id']}/ssma", headers=seg, json={"linhas": [
        {"id": lid, "tecnico": "Técnica Beltrana", "rac": "N/A", "pts": "N/A", "art": "ART/11/53", "pto": "N/A",
         "ata": "N/A"}]})
    assert r.status_code == 200, r.text
    assert client.post(f"/api/programacoes/{p2['id']}/linhas", headers=seg, json={
        "area_id": area["id"], "tipo_id": t["id"]}).status_code == 403
    assert client.put(f"/api/programacoes/{p['id']}/salvar", headers=seg, json={"linhas": []}).status_code == 403

    # Excel do cliente (rascunho e revisão emitida)
    h = {**sa, "X-Obra-Id": obra}
    r = client.get(f"/api/programacoes/{p['id']}/excel", headers=h, params={"revisao": 0})
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/vnd.openxml")
    ws = load_workbook(BytesIO(r.content)).active
    assert ws.title == "Programação Semanal - S32"
    assert (ws["G7"].value, ws["N7"].value, ws["T7"].value, ws["U7"].value, ws["AK9"].value) == (
        "Item", "SSMA", "Responsável", "Encarregado", "(P)rev.\n(R)eal")
    assert (ws["AL9"].value, ws["AN9"].value, ws["AU11"].value) == ("S31", "S32", "Total Sem.")
    assert ws["J12"].value == "OBRA GERAL" and ws["J12"].fill.fgColor.rgb == "FFFF0000"  # faixa do local
    assert ws["J13"].value.startswith("CWA ")
    assert (ws["G14"].value, ws["H14"].value, ws["I14"].value, ws["AK14"].value, ws["AK15"].value) == (
        "1.1", "CMD-1010", "O", "P", "R")
    assert ws["Q14"].value is None  # emissão foi antes do SSMA; o rascunho atual já tem
    assert ws["AU14"].value == "=SUM(AL14:AT14)" and (ws["AO14"].value, ws["AP14"].value, ws["AO15"].value) == (10, 20, 8)
    assert (ws["AC14"].value, ws["AD14"].value) == (2, 2)  # oficiais e serventes pelas funções dos membros
    atual = load_workbook(BytesIO(client.get(f"/api/programacoes/{p['id']}/excel", headers=h).content)).active
    assert (atual["N14"].value, atual["Q14"].value, atual["T14"].value) == ("Técnica Beltrana", "ART/11/53", "Eng. Fulano")
    assert atual["BE10"].value == "ITEM PQ" and atual["BN10"].value == "% REAL"


@pytest.mark.parametrize("tipo,colunas_dia", [("MENSAL", 30)])
def test_excel_mensal_desloca_colunas(client, tipo, colunas_dia):
    p = client.post("/api/programacoes", json={"tipo": tipo, "referencia": "2026-11-17"}).json()
    ws = load_workbook(BytesIO(client.get(f"/api/programacoes/{p['id']}/excel").content)).active
    from openpyxl.utils import get_column_letter as L
    assert ws[f"{L(38 + colunas_dia)}11"].value == "Total Mês"
    assert ws.title.startswith("Programação Mensal")
