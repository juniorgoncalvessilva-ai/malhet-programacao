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
    # cadastros das listas suspensas: segurança cadastra técnico/RAC/PTS/ART/ATA; PTO é do Planejamento
    cad = lambda h, tipo, cod, **kw: client.post("/api/ssma/cadastros", headers=h, json={"tipo": tipo, "codigo": cod, **kw})  # noqa: E731
    assert cad(seg, "TECNICO", "Técnica Beltrana").status_code == 201
    assert cad(seg, "ART", "ART/11/53", descricao="Concreto CMD", validade="2026-12-31").status_code == 201
    assert cad(seg, "ART", " art/11/53 ").status_code == 422  # já cadastrado
    assert cad(seg, "RAC", "N/A").status_code == 422  # N/A já existe em toda lista
    assert cad(seg, "PTO", "PTO-001").status_code == 403  # PTO é do Planejamento
    hsa = {**sa, "X-Obra-Id": obra}
    assert cad(hsa, "PTO", "PTO-001", descricao="Galpão de resíduos").status_code == 201
    r = client.put(f"/api/programacoes/{p['id']}/ssma", headers=seg, json={"linhas": [
        {"id": lid, "tecnico": "Técnico Inventado", "rac": "N/A"}]})
    assert r.status_code == 422 and "não está no cadastro" in r.text
    r = client.put(f"/api/programacoes/{p['id']}/ssma", headers=seg, json={"linhas": [
        {"id": lid, "tecnico": "Técnica Beltrana", "rac": "N/A", "pts": "na", "art": "ART/11/53", "pto": "PTO-001",
         "ata": "N/A"}]})
    assert r.status_code == 200, r.text
    ln = client.get(f"/api/programacoes/{p['id']}", headers=seg).json()["locais"][0]["areas"][0]["linhas"][0]
    assert ln["ssma"] == {"tecnico": "Técnica Beltrana", "rac": ["N/A"], "pts": ["N/A"], "art": ["ART/11/53"], "pto": None,
                          "ata": ["N/A"]}  # PTO não vem pela tela de SSMA; texto vira lista
    # vários itens por atividade: duas ARTs; N/A junto com item sai; repetido não duplica
    assert cad(seg, "ART", "ART/12/07").status_code == 201
    r = client.put(f"/api/programacoes/{p['id']}/ssma", headers=seg, json={"linhas": [
        {"id": lid, "tecnico": "Técnica Beltrana", "art": ["ART/11/53", "N/A", "ART/12/07", "ART/11/53"], "rac": ["N/A"]}]})
    assert r.status_code == 200, r.text
    ln = client.get(f"/api/programacoes/{p['id']}", headers=seg).json()["locais"][0]["areas"][0]["linhas"][0]
    assert ln["ssma"]["art"] == ["ART/11/53", "ART/12/07"] and ln["ssma"]["rac"] == ["N/A"]
    # anexos (Excel, Word, PDF) no item do cadastro; opcional e mais de um
    art = next(x for x in client.get("/api/ssma/cadastros", headers=seg, params={"tipo": "ART"}).json() if x["codigo"] == "ART/11/53")
    assert art["aceita_anexo"] and art["anexos"] == [] and art["em_uso"] == 1
    pdf = b"%PDF-1.4 teste"
    r = client.post(f"/api/ssma/cadastros/{art['id']}/anexos", headers=seg, files={"arquivo": ("ART 11-53 ção.pdf", pdf)})
    assert r.status_code == 201, r.text
    aid = r.json()["id"]
    assert client.post(f"/api/ssma/cadastros/{art['id']}/anexos", headers=seg,
                       files={"arquivo": ("planilha.xlsx", b"PK\x03\x04xx")}).status_code == 201
    assert client.post(f"/api/ssma/cadastros/{art['id']}/anexos", headers=seg,
                       files={"arquivo": ("falso.pdf", b"nao sou pdf")}).status_code == 422
    assert client.post(f"/api/ssma/cadastros/{art['id']}/anexos", headers=seg,
                       files={"arquivo": ("foto.png", b"\x89PNG")}).status_code == 422
    tec = next(x for x in client.get("/api/ssma/cadastros", headers=seg, params={"tipo": "TECNICO"}).json())
    assert not tec["aceita_anexo"] and client.post(f"/api/ssma/cadastros/{tec['id']}/anexos", headers=seg,
                                                   files={"arquivo": ("a.pdf", pdf)}).status_code == 422
    d = client.get(f"/api/ssma/anexos/{aid}", headers=seg)
    assert d.status_code == 200 and d.content == pdf and d.headers["content-type"] == "application/pdf"
    assert "filename*=UTF-8''ART%2011-53%20%C3%A7%C3%A3o.pdf" in d.headers["content-disposition"]
    assert len(client.get("/api/ssma/cadastros", headers=seg, params={"tipo": "ART"}).json()[0]["anexos"]) == 2
    assert client.delete(f"/api/ssma/anexos/{aid}", headers=seg).status_code == 204
    # PTO na linha (planejamento) e renomear no cadastro propaga para o rascunho
    lid2 = client.get(f"/api/programacoes/{p2['id']}", headers=hsa).json()["locais"][0]["areas"][0]["linhas"][0]["id"]
    linha2 = {"area_id": area["id"], "tipo_id": t["id"], "equipe_id": eq2["id"], "pto": "PTO-001"}
    assert client.put(f"/api/programacoes/{p2['id']}/linhas/{lid2}", headers=hsa, json=linha2).status_code == 200
    assert client.put(f"/api/programacoes/{p2['id']}/linhas/{lid2}", headers=hsa, json={**linha2, "pto": "PTO-999"}).status_code == 422
    pto = next(x for x in client.get("/api/ssma/cadastros", headers=hsa, params={"tipo": "PTO"}).json())
    assert pto["em_uso"] == 1 and client.delete(f"/api/ssma/cadastros/{pto['id']}", headers=hsa).status_code == 422
    client.put(f"/api/ssma/cadastros/{pto['id']}", headers=hsa, json={"tipo": "PTO", "codigo": "PTO-001/R1"})
    ln2 = client.get(f"/api/programacoes/{p2['id']}", headers=hsa).json()["locais"][0]["areas"][0]["linhas"][0]
    assert ln2["ssma"]["pto"] == ["PTO-001/R1"]
    # PTO: mais de um por atividade, só pelo planejamento
    assert cad(hsa, "PTO", "PTO-002").status_code == 201
    r = client.put(f"/api/programacoes/{p2['id']}/linhas/{lid2}", headers=hsa, json={**linha2, "pto": ["PTO-001/R1", "PTO-002"]})
    assert r.status_code == 200, r.text
    ln2 = client.get(f"/api/programacoes/{p2['id']}", headers=hsa).json()["locais"][0]["areas"][0]["linhas"][0]
    assert ln2["ssma"]["pto"] == ["PTO-001/R1", "PTO-002"]
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
    assert (atual["N14"].value, atual["Q14"].value, atual["T14"].value) == ("Técnica Beltrana", "ART/11/53 / ART/12/07", "Eng. Fulano")  # vários itens: " / "
    assert atual["BE10"].value == "ITEM PQ" and atual["BN10"].value == "% REAL"


@pytest.mark.parametrize("tipo,colunas_dia", [("MENSAL", 30)])
def test_excel_mensal_desloca_colunas(client, tipo, colunas_dia):
    p = client.post("/api/programacoes", json={"tipo": tipo, "referencia": "2026-11-17"}).json()
    ws = load_workbook(BytesIO(client.get(f"/api/programacoes/{p['id']}/excel").content)).active
    from openpyxl.utils import get_column_letter as L
    assert ws[f"{L(38 + colunas_dia)}11"].value == "Total Mês"
    assert ws.title.startswith("Programação Mensal")


def test_dominio_do_cadastro_ssma():
    from app.modules.ssma.domain.cadastro import ItemCadastro, TipoCadastro, valor_da_linha
    from app.shared.errors import DomainError

    assert ItemCadastro(TipoCadastro.TECNICO, "  Ana   Lima ").codigo == "Ana Lima"
    with pytest.raises(DomainError):
        ItemCadastro(TipoCadastro.ART, "")
    assert valor_da_linha("na", set(), TipoCadastro.RAC) == "N/A" and valor_da_linha("", set(), TipoCadastro.RAC) is None
    assert valor_da_linha("RAC 10", {"RAC 10"}, TipoCadastro.RAC) == "RAC 10"
    with pytest.raises(DomainError):
        valor_da_linha("RAC 11", {"RAC 10"}, TipoCadastro.RAC)
    assert TipoCadastro.PTO.do_planejamento and not TipoCadastro.ATA.do_planejamento


def test_dominio_varios_itens_e_anexo():
    from app.modules.ssma.domain.cadastro import TipoCadastro, lista_da_linha, texto_da_lista, validar_anexo
    from app.shared.errors import DomainError

    v = {"A", "B"}
    assert lista_da_linha(["A", "N/A", "B", "A"], v, TipoCadastro.RAC) == ["A", "B"]
    assert lista_da_linha("na", v, TipoCadastro.RAC) == ["N/A"] and lista_da_linha([], v, TipoCadastro.RAC) is None
    assert lista_da_linha(["Antigo"], v, TipoCadastro.RAC, atuais="Antigo") == ["Antigo"]  # valor já gravado vale
    with pytest.raises(DomainError):
        lista_da_linha(["C"], v, TipoCadastro.RAC)
    assert texto_da_lista(["A", "B"]) == "A / B" and texto_da_lista("A") == "A" and texto_da_lista(None) is None
    assert validar_anexo(TipoCadastro.PTO, "C:\\docs\\PTO 1.docx", b"PK\x03\x04..")[0] == "PTO 1.docx"
    assert validar_anexo(TipoCadastro.RAC, "r.xls", b"\xd0\xcf\x11\xe0..")[1] == "application/vnd.ms-excel"
    with pytest.raises(DomainError):
        validar_anexo(TipoCadastro.TECNICO, "a.pdf", b"%PDF")
