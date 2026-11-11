"""Spec 015: efetivo (chave = matrícula), mobilização, equipes pelo efetivo, exportação Simova, de-para e organograma.
Dados fictícios: planilhas com nomes/crachás reais não vão para o git."""
from io import BytesIO

from openpyxl import Workbook, load_workbook

from app.modules.efetivo.domain.efetivo import Situacao, normalizar_matricula, situacao_da_linha
from app.modules.efetivo.infra.models import ColaboradorModel

CAB = ["Nº", "DP", "Tipo de MO", "STATUS", "VALE", "RAC 2", "PAEBM", "MATRICULA", "NOME", "FUNÇAO", "ADMISSÃO",
       "EXP. 45", "EXP. 90", "DEMISSÃO", "DATA DE NASCIMENTO", "CPF", "PIS", "NATURALIDADE", "RUA"]
CAB_TERC = ["VALE", "RAC 2", "PAEBM", "MATRICULA", "NOME", "FUNÇAO", "ADMISSÃO", "DEMISSÃO", "DATA DE NASCIMENTO", "CPF"]


def _l(dp, mo, st, mat, nome, funcao, dem=None):
    return [1, dp, mo, st, 1065702999, "NÃO", "SIM", mat, nome, funcao, 46136, None, None, dem, 30974, "000.000.000-00",
            "123", "CIDADE/MG", "RUA X"]


def efetivo(semana: int) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "EFETIVO 310"
    ws.append(CAB)
    linhas = [
        _l("DP 14", "MOI", "V", "115.011", "ENCARREGADO TESTE UM", "ENCARREGADO DE FORMAS"),
        _l("DP 14", "MOD", "V", "115.013", "PEDREIRO TESTE DOIS", "PEDREIRO"),
        _l("DP 14", "MOD", "V", "115.014", "SERVENTE TESTE TRES", "SERVENTE"),
        _l("DP 20", "DEM", "DEM", "115.012", "DEMITIDO TESTE", "CARPINTEIRO", dem=46150),
        _l("", "", "CRACHÁ", "", "CANDIDATO TESTE", "ARMADOR "),
        _l("", "", "", "DESISTIU 09/11", "DESISTENTE TESTE", "SERVENTE"),
        _l("DP 12", "MOD", 46339, "115.015", "PREVISTO TESTE", "PEDREIRO"),
    ]
    if semana == 2:
        linhas[1] = _l("DP 14", "MOD", "V", "115.013", "PEDREIRO TESTE DOIS", "PEDREIRO DE ACABAMENTO")
        linhas[2] = _l("DP 14", "DEM", "DEM", "115.014", "SERVENTE TESTE TRES", "SERVENTE", dem=46200)
        linhas[4] = _l("DP 13", "MOD", "V", "115.020", "CANDIDATO TESTE", "ARMADOR ")  # ganhou matrícula
        linhas.pop(6)  # previsto saiu da planilha
    for ln in linhas:
        ws.append(ln)
    t = wb.create_sheet("Locmaster")
    t.append(CAB_TERC)
    t.append([995758794, "SIM", "SIM", 14, "MOTORISTA TERCEIRO", "MOTORISTA DE CAMINHÃO", 45769, None, 34719, "1"])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_regras_da_planilha():
    assert normalizar_matricula("115.011") == "115011" and normalizar_matricula(1441.0) == "1441"
    assert normalizar_matricula("DESISTIU 09/11") is None and normalizar_matricula("") is None
    assert situacao_da_linha("V", "MOD", None, "115.011")[0] is Situacao.MOBILIZADO
    assert situacao_da_linha("DEM", "DEM", 46150, "1")[0] is Situacao.DESMOBILIZADO
    assert situacao_da_linha("CRACHÁ", "", None, "")[0] is Situacao.AGUARDANDO_CRACHA
    sit, data = situacao_da_linha(46339.0, "MOD", None, "1")
    assert sit is Situacao.PREVISTO and data.isoformat() == "2026-11-13"
    assert situacao_da_linha("", "", None, "DESISTIU 09/11")[0] is Situacao.DESISTENCIA
    assert situacao_da_linha(None, None, None, "14", tem_status=False)[0] is Situacao.MOBILIZADO


def test_efetivo_equipes_simova_depara_organograma(client):
    from app.core.db import SessionLocal
    from tests.test_cpu_obra import _xlsx, relatorio

    r = client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
    assert r.status_code == 200, r.text
    assert (r.json()["lidos"], r.json()["novos"], r.json()["sem_matricula"]) == (8, 8, 2)
    cs = {c["nome"]: c for c in client.get("/api/efetivo/colaboradores").json()}
    assert cs["PEDREIRO TESTE DOIS"]["cracha"] == "115013" and cs["PEDREIRO TESTE DOIS"]["situacao"] == "MOBILIZADO"
    assert cs["DEMITIDO TESTE"]["situacao"] == "DESMOBILIZADO" and cs["CANDIDATO TESTE"]["situacao"] == "AGUARDANDO_CRACHA"
    assert cs["PREVISTO TESTE"]["mobilizacao_prevista"] == "2026-11-13"
    terc = cs["MOTORISTA TERCEIRO"]
    assert (terc["empresa"], terc["chave"], terc["cracha"]) == ("Locmaster", "LOCMASTER:14", None)
    # dados sensíveis não entram
    assert not any(hasattr(ColaboradorModel, k) for k in ("cpf", "pis", "endereco", "nascimento", "telefone"))

    # equipe criada pelo efetivo (encarregado + membros); terceiro sem crachá não entra até definir o crachá
    enc, ped, srv = cs["ENCARREGADO TESTE UM"]["id"], cs["PEDREIRO TESTE DOIS"]["id"], cs["SERVENTE TESTE TRES"]["id"]
    r = client.post("/api/efetivo/equipes", json={"nome": "EQUIPE.1_FORMA", "encarregado_id": enc,
                                                 "colaboradores": [ped, srv], "turno": "Diurno", "responsavel": "Eng. A"})
    assert r.status_code == 201, r.text and r.json()["codigo_simova"] == "1"
    eq = r.json()["id"]
    assert client.put("/api/efetivo/equipe", json={"colaboradores": [terc["id"]], "equipe_id": eq}).status_code == 422
    assert client.put(f"/api/efetivo/colaboradores/{terc['id']}/cracha", json={"cracha": "900014"}).status_code == 200
    assert client.put("/api/efetivo/equipe", json={"colaboradores": [terc["id"]], "equipe_id": eq}).status_code == 200

    # exportação no padrão do Simova
    ws = load_workbook(BytesIO(client.get("/api/equipes/simova.xlsx").content)).active
    assert [c.value for c in ws[1]][1:7] == ["Código", "Descrição", "Encarregado", "Funcionário", "Equipamento", "Ativo"]
    ln = [c.value for c in ws[2]]
    assert (ln[1], ln[2], ln[3], ln[6]) == (1, "EQUIPE.1_FORMA", "115011 :: ENCARREGADO TESTE UM", 1)
    assert ln[4] == "900014 :: MOTORISTA TERCEIRO115013 :: PEDREIRO TESTE DOIS115014 :: SERVENTE TESTE TRES"

    # reimportação da semana seguinte: equipe preservada, mudanças registradas
    r = client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(2))})
    assert (r.json()["novos"], r.json()["fora_do_arquivo"]) == (0, 1), r.json()
    cs = {c["nome"]: c for c in client.get("/api/efetivo/colaboradores").json()}
    assert cs["CANDIDATO TESTE"]["matricula"] == "115020" and cs["CANDIDATO TESTE"]["situacao"] == "MOBILIZADO"
    assert cs["PEDREIRO TESTE DOIS"]["equipe"] == "EQUIPE.1_FORMA" and cs["PEDREIRO TESTE DOIS"]["funcao"] == "PEDREIRO DE ACABAMENTO"
    assert cs["PREVISTO TESTE"]["no_ultimo_arquivo"] is False
    assert cs["ENCARREGADO TESTE UM"]["encarregado_de"] == "EQUIPE.1_FORMA"
    res = client.get("/api/efetivo/resumo").json()
    assert "SERVENTE TESTE TRES" in res["desmobilizados_em_equipe"] and res["fora_do_ultimo_arquivo"] == 1
    tipos = {(m["nome"], m["tipo"]) for m in client.get("/api/efetivo/movimentos").json()}
    assert {("SERVENTE TESTE TRES", "SITUACAO"), ("PEDREIRO TESTE DOIS", "FUNCAO"), ("PEDREIRO TESTE DOIS", "EQUIPE"),
            ("PREVISTO TESTE", "FORA_DO_ARQUIVO")} <= tipos

    # de-para: sugestão pela CPU (Pedreiro, Servente) e composição da equipe pelas funções do efetivo
    assert client.post("/api/importar/cpu", data={"rotulo": "CPU"}, files={"arquivo": ("c.xlsx", _xlsx(relatorio()))}).status_code == 200
    fs = {f["funcao"]: f for f in client.get("/api/efetivo/funcoes").json()["funcoes"]}
    assert fs["PEDREIRO DE ACABAMENTO"]["sugestao"] == "Pedreiro" and fs["SERVENTE"]["sugestao"] == "Servente"
    assert client.post("/api/efetivo/funcoes/sugeridas").json()["aplicadas"] >= 2
    client.put("/api/efetivo/funcoes", json={"itens": [{"funcao": "MOTORISTA DE CAMINHÃO", "ignorar": True}]})
    e1 = next(e for e in client.get("/api/equipes").json() if e["nome"] == "EQUIPE.1_FORMA")
    assert {(c["recurso"], c["quantidade"]) for c in e1["composicao_efetiva"]} == {("Pedreiro", 1), ("Servente", 1)}

    # organograma: obra → setor (DP do encarregado) → supervisor → equipe → função; sem equipe e em mobilização
    org = client.get("/api/efetivo/organograma").json()["raiz"]
    setores = {f["titulo"]: f for f in org["filhos"]}
    assert "DP 14" in setores and "Sem equipe" in setores
    equipe = setores["DP 14"]["filhos"][0]["filhos"][0]
    assert setores["DP 14"]["filhos"][0]["titulo"] == "Eng. A" and equipe["titulo"] == "EQUIPE.1_FORMA"
    assert {f["titulo"] for f in equipe["filhos"]} >= {"PEDREIRO DE ACABAMENTO", "ENCARREGADO DE FORMAS"}
    assert client.get("/api/efetivo/organograma", params={"q": "candidato"}).json()["raiz"]["qtd"] == 1
    with SessionLocal() as s:  # colaborador desmobilizado continua na equipe até o planejamento tirar
        assert s.query(ColaboradorModel).count() == 8
