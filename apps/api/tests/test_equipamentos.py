"""Spec 147: equipamentos da obra — planilha (TAG chave; reimportar atualiza, não duplica), operador do efetivo (liga só
quando único operador/motorista), mobilização/desmobilização com histórico e o apontamento do dia. Arquivo real do
cliente fora do git (EQUIP_REAL)."""
import io
import os
from datetime import date, datetime, timedelta

import pytest
from openpyxl import Workbook, load_workbook

from app.modules.equipamentos.domain import equipamento as dom
from app.shared.errors import DomainError
from tests.test_efetivo import efetivo


def _planilha(extra: list | None = None, mob_bt: str = "SIM") -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Manutenção Preventiva"
    ws.append([0])
    ws.append([])
    ws.append(["Nome do Equipamento", "Operadores", "Tipo", "Placa", "TAG", "Chassi", "Mobilizado", "Data mobilização"])
    for l in [["CAMINHÃO BASCULANTE VE-218", "MOTORISTA", "Maquinário", "SIO-0A99", "CAR-0A99", "93KKZ60D2PE193311", mob_bt, datetime(2026, 5, 28)],
              ["ESCAVADEIRA HIDRAULICA ME-30", "PEDREIRO", "Maquinário", "CAR-EH-001", "CAR-EH-001", "HBZN215CESAA06923", "SIM", datetime(2026, 5, 26)],
              ["HB20", "FULANO", "Veículo Leve", "TYT-3C19", "TYT-3C19", "9BHCP51E8VP843269", "NÃO", None],
              ["CAMINHÃO MUNCK", None, "Maquinário", "RVG-5B21", "CAR-5B21", "9BM958174NB282482", "NÃO", datetime(2026, 6, 10)],
              ["SEM TAG", "X", "Maquinário", None, None, None, "SIM", None],
              *(extra or [])]:
        ws.append(l)
    b = io.BytesIO()
    wb.save(b)
    return b.getvalue()


def test_leitura_e_regras():
    lt = dom.ler([tuple(r) for r in load_workbook(io.BytesIO(_planilha())).active.iter_rows(values_only=True)])
    assert [(x.tag, x.situacao) for x in lt.itens] == [("CAR-0A99", "mobilizado"), ("CAR-EH-001", "mobilizado"),
                                                       ("TYT-3C19", "nao_mobilizado"), ("CAR-5B21", "desmobilizado")]
    assert lt.itens[0].chave == "CAR0A99" and lt.itens[0].mobilizado_em == date(2026, 5, 28)
    assert "sem TAG" in lt.avisos[0]
    assert dom.LinhaEquipamento(1, "M", None, None, "T", None, "GLAUBER/PEDRO", "mobilizado", None, None).operadores == ["GLAUBER", "PEDRO"]
    pessoas = [dom.PessoaRef(1, "JOAO SILVA", "OPERADOR DE ESCAVADEIRA"), dom.PessoaRef(2, "JOAO SOUZA", "PEDREIRO"),
               dom.PessoaRef(3, "MARIA LIMA", "SERVENTE"), dom.PessoaRef(4, "ANA PAULA COSTA", "ARMADOR")]
    assert dom.casar_operador("JOÃO", pessoas)[0] == 1  # um só operador chamado João
    assert dom.casar_operador("MARIA", pessoas) == (None, [pessoas[2]])  # não é operador: só sugere
    assert dom.casar_operador("ANA PAULA", pessoas)[0] == 4  # nome composto e único
    assert dom.casar_operador(None, pessoas) == (None, [])
    assert dom.dias_mobilizado(date(2026, 11, 1), date(2026, 11, 10)) == 10
    with pytest.raises(DomainError):
        dom.validar_apontamento("parado", None, "")  # parado pede o motivo
    with pytest.raises(DomainError):
        dom.validar_movimento("desmobilizado", "desmobilizado", date(2026, 1, 1), None)


def test_cadastro_mobilizacao_e_dia(client):
    client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
    p = client.post("/api/equipamentos/planilha/previa", files={"arquivo": ("eq.xlsx", _planilha())}).json()
    assert (p["novos"], p["atualizados"], p["operadores_ligados"], p["operadores_pendentes"]) == (4, 0, 1, 2)
    assert next(i for i in p["itens"] if i["tag"] == "CAR-EH-001")["sugestoes"][0]["nome"] == "PEDREIRO TESTE DOIS"
    assert client.get("/api/equipamentos").json()["itens"] == []  # a prévia não grava

    r = client.post("/api/equipamentos/planilha", files={"arquivo": ("eq.xlsx", _planilha())}).json()
    assert (r["novos"], r["operadores_ligados"]) == (4, 1)
    lst = client.get("/api/equipamentos").json()
    por = {i["tag"]: i for i in lst["itens"]}
    assert por["CAR-0A99"]["operador"]["nome"] == "MOTORISTA TERCEIRO" and por["CAR-0A99"]["situacao"] == "mobilizado"
    assert por["CAR-0A99"]["memoria"]["valor"].endswith("dia(s)") and por["CAR-0A99"]["dias"] > 100
    assert por["CAR-EH-001"]["operador"] is None and por["CAR-EH-001"]["operador_texto"] == "PEDREIRO"
    assert (por["TYT-3C19"]["situacao"], por["CAR-5B21"]["situacao"]) == ("nao_mobilizado", "desmobilizado")
    assert (lst["totais"]["mobilizado"], lst["totais"]["sem_apontamento"], lst["totais"]["sem_operador"]) == (2, 2, 1)

    # reimportar: não duplica; o basculante desmobilizou pela planilha (movimento "pela planilha")
    r = client.post("/api/equipamentos/planilha", files={"arquivo": ("eq.xlsx", _planilha(mob_bt="NÃO"))}).json()
    assert (r["novos"], r["atualizados"]) == (0, 4)
    bt = next(i for i in client.get("/api/equipamentos").json()["itens"] if i["tag"] == "CAR-0A99")
    assert bt["situacao"] == "desmobilizado"
    movs = client.get(f"/api/equipamentos/{bt['id']}/movimentos").json()
    assert [m["tipo"] for m in movs][:1] == ["desmobilizacao"] and {"cadastro", "mobilizacao", "operador"} <= {m["tipo"] for m in movs}

    # operador escolhido no efetivo; mobilizar de novo e apontar o dia
    cs = {c["nome"]: c for c in client.get("/api/efetivo/colaboradores").json()}
    ex = por["CAR-EH-001"]
    assert client.put(f"/api/equipamentos/{ex['id']}/operador", json={"colaborador_id": cs["PEDREIRO TESTE DOIS"]["id"]}).json()["operador"]["nome"] == "PEDREIRO TESTE DOIS"
    assert client.get("/api/equipamentos/por-operador").json()[str(cs["PEDREIRO TESTE DOIS"]["id"])][0]["tag"] == "CAR-EH-001"
    assert client.post(f"/api/equipamentos/{bt['id']}/mobilizar", json={"data": "2026-01-01"}).status_code == 422  # antes da última
    hoje = date.today().isoformat()
    assert client.post(f"/api/equipamentos/{bt['id']}/mobilizar", json={"data": hoje}).json()["situacao"] == "mobilizado"
    assert client.post(f"/api/equipamentos/{bt['id']}/mobilizar", json={}).status_code == 422  # já mobilizado
    d = client.put(f"/api/equipamentos/{ex['id']}/dia", json={"situacao": "operando", "horas": 8.5}).json()
    assert d["dia"]["situacao_nome"] == "Operando" and d["dia"]["horas"] == 8.5
    assert client.put(f"/api/equipamentos/{ex['id']}/dia", json={"situacao": "parado"}).status_code == 422  # sem motivo
    assert client.put(f"/api/equipamentos/{ex['id']}/dia", json={"situacao": "parado", "observacao": "chuva"}).json()["dia"]["situacao"] == "parado"
    amanha = (date.today() + timedelta(days=1)).isoformat()
    assert client.put(f"/api/equipamentos/{ex['id']}/dia", json={"data": amanha, "situacao": "operando"}).status_code == 422
    hb = por["TYT-3C19"]
    assert client.put(f"/api/equipamentos/{hb['id']}/dia", json={"situacao": "operando"}).status_code == 422  # não mobilizado
    assert client.delete(f"/api/equipamentos/{ex['id']}").status_code == 422  # tem dia apontado
    assert client.delete(f"/api/equipamentos/{hb['id']}").status_code == 204

    # cadastro à mão e por obra
    n = client.post("/api/equipamentos", json={"nome": "Gerador", "tag": "CAR-GE-009"})
    assert n.status_code == 201 and client.post("/api/equipamentos", json={"nome": "Outro", "tag": "car ge 009"}).status_code == 422
    outra = client.post("/api/admin/obras", json={"codigo": "OUT-EQ", "nome": "Outra"}).json()["id"]
    h = {"X-Obra-Id": str(outra)}
    assert client.get("/api/equipamentos", headers=h).json()["itens"] == []
    assert client.put(f"/api/equipamentos/{ex['id']}/dia", headers=h, json={"situacao": "operando"}).status_code == 404
    assert client.post("/api/equipamentos/planilha/previa", files={"arquivo": ("x.xlsx", b"nada")}).status_code == 422


@pytest.mark.skipif(not os.environ.get("EQUIP_REAL"), reason="arquivo real do cliente fora do git (EQUIP_REAL=caminho)")
def test_planilha_real():
    with open(os.environ["EQUIP_REAL"], "rb") as f:
        lt = dom.ler([tuple(r) for r in load_workbook(f, data_only=True).active.iter_rows(values_only=True)])
    assert len(lt.itens) == 58 and sum(x.situacao == "mobilizado" for x in lt.itens) == 54
