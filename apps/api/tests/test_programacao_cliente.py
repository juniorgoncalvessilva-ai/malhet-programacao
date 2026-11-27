"""Spec 146: programação semanal do cliente importada para conferir — liga ao Malhet (frente, PQ, tipo, IWP, equipe), não
mexe na programação até "Levar", lembra as decisões e, ao levar, pergunta o destino e traz o realizado sem dobrar o do campo."""
from datetime import date, datetime
from io import BytesIO

from openpyxl import Workbook
from openpyxl.utils import column_index_from_string as ci

from app.modules.planejamento.application.exportar_cliente import FIXAS
from app.modules.programacao_cliente.domain import planilha as pl
from app.modules.programacao_cliente.domain import vinculo as vc
from tests.test_efetivo import efetivo
from tests.test_pq_contrato import pq_contrato

LISTA = "CWA\tAtivo\tDESCRICAO CWA\tLocal\n004.05\tED-1800AA-01\tGalpão de resíduos classe II\tNovo CMD"
DIAS = [date(2026, 11, 20 + i) for i in range(9)]  # sexta 20/11 a sábado 28/11 (S34)
AK, AL = ci("AK"), ci("AL")


def planilha_cliente(atividades: list[dict] | None = None) -> bytes:
    """Aba no layout da obra (o mesmo do Excel que o Malhet exporta): cabeçalho nas linhas 7–11, P/R em AK, dias em AL…"""
    wb = Workbook()
    ws = wb.active
    ws.title = "Apoio"
    ws = wb.create_sheet("Programação Semanal - S34")
    ws["F4"] = "OBRA TESTE - OBRAS CIVIS"
    for letra, txt, _ in FIXAS:
        ws[f"{letra}7"] = "SSMA" if letra == "N" else (None if letra in "OPQRS" else txt)
    ws["N8"] = "TÉCNICO DE SEGURANÇA RESPONSÁVEL"
    for letra in "OPQRS":
        ws[f"{letra}9"] = next(t for x, t, _ in FIXAS if x == letra)
    ws.cell(7, AK, "Chuva (mm)")
    ws.cell(9, AK, "(P)rev.\n(R)eal")
    for i, d in enumerate(DIAS):
        ws.cell(9, AL + i, "S34")
        ws.cell(10, AL + i, datetime(d.year, d.month, d.day))
    ws.cell(11, AL + 9, "Total Sem.")
    ws.cell(10, AL + 11 + 8, "ITEM PQ")
    ws.cell(10, AL + 11 + 9, "PU")
    r = 12
    ws[f"J{r}"] = "NOVO CMD"
    r += 1
    ws[f"G{r}"], ws[f"J{r}"] = 1, "CWA 004.05 - ED-1800AA-01 - Galpão de resíduos classe II"
    r += 1
    ws[f"J{r}"] = "CWP 004.05-01 · Fundo canaleta"
    r += 1
    for n, a in enumerate(atividades or ATIVIDADES, start=1):
        ws[f"G{r}"], ws[f"H{r}"], ws[f"I{r}"], ws[f"J{r}"] = f"1.{n}", a.get("id", "-"), a.get("nat", "P"), a["desc"]
        ws[f"L{r}"], ws[f"M{r}"], ws[f"U{r}"], ws[f"V{r}"] = "Galpão", "004.05", a.get("enc"), a["un"]
        ws[f"N{r}"], ws[f"O{r}"], ws[f"Q{r}"], ws[f"T{r}"] = "Técnico Fulano", "RAC 03/07", "N/A", "Engenheiro Teste"
        ws[f"AC{r}"], ws[f"AD{r}"] = a.get("oficiais"), a.get("serventes")
        ws.cell(r, AK, "P")
        ws.cell(r + 1, AK, "R")
        for dia, q in a.get("prev", {}).items():
            ws.cell(r, AL + DIAS.index(dia), q)
        for dia, q in a.get("real", {}).items():
            ws.cell(r + 1, AL + DIAS.index(dia), q)
        ws.cell(r, AL + 11 + 8, a.get("item"))
        r += 2
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


SEG, TER, QUA = DIAS[3], DIAS[4], DIAS[5]
ATIVIDADES = [
    {"desc": "Concreto bombeado fck 30 MPa - (Fundo canaleta)", "un": "m³", "item": "1.8.3.1.2", "enc": "Encarregado Teste Um",
     "prev": {SEG: 4, TER: 6}, "real": {SEG: 3}, "oficiais": 3, "serventes": 1},
    {"desc": "Concretagem bombeada fck 40 MPa da fundação", "un": "m3", "enc": "Encarregado Teste Um", "prev": {QUA: 5}},
    {"desc": "Limpeza da área de concretagem", "un": "m2", "enc": "Fulano Desconhecido / Ciclano", "prev": {SEG: 60}, "nat": "O"},
    {"desc": "Concreto bombeado fck 40 MPa - (Fundo da caixa)", "un": "m³", "item": "1.8.3.1.3", "enc": "Encarregado Teste Um",
     "prev": {QUA: 2}},
]


def test_le_a_planilha_no_layout_da_obra():
    p = pl.ler(planilha_cliente())
    assert p.aba == "Programação Semanal - S34" and (p.inicio, p.fim) == (DIAS[0], DIAS[-1]) and len(p.linhas) == 4
    a, b, c, _d = p.linhas
    assert (a.grupo_cwa, a.grupo_tag, a.cwp_codigo, a.cwp, a.secao) == ("004.05", "ED-1800AA-01", "004.05-01", "Fundo canaleta", "NOVO CMD")
    assert a.item_pq == "1.8.3.1.2" and a.previsto == {"2026-11-23": 4, "2026-11-24": 6} and a.realizado == {"2026-11-23": 3}
    assert a.ssma["rac"] == ["RAC 03/07"] and a.recursos["oficiais"] == 3 and a.total_previsto == 10
    assert c.natureza == "O" and c.encarregados == ("Fulano Desconhecido", "Ciclano") and b.item_pq is None
    assert p.titulo == "OBRA TESTE - OBRAS CIVIS"
    assert pl.separar_codigo("9.1.1 - Escavação mecanizada") == ("9.1.1", "Escavação mecanizada")


def test_sugestao_pelo_texto_nunca_confirma():
    itens = [vc.ItemPq("1.8.3.1.2", "Concreto bombeado fck 30 MPa", "m³"), vc.ItemPq("9.9", "Escavação de vala", "m³")]
    s = vc.sugerir_itens("Concretagem com concreto bombeado fck 30", "m3", itens)
    assert [x.item for x in s] == ["1.8.3.1.2"] and "bombeado" in s[0].comuns
    assert vc.sugerir_itens("Concreto bombeado fck 30", "kg", itens) == []  # unidade incompatível não sugere
    assert vc.unidade_compativel("t", "kg") is True and vc.unidade_compativel("m2", None) is None
    assert vc.chave_decisao("Concreto (Plano C)", "004.05", "m3") == vc.chave_decisao("Concreto  (Plano D)", "004.05", "m³")


def _base(client):
    client.post("/api/importar/takeoff", data={"rotulo": "PQ"}, files={"arquivo": ("pq.xlsx", pq_contrato())})
    client.post("/api/frentes/importar", json={"texto": LISTA})
    g = client.post("/api/catalogo/grupos", json={"descricao": "Concreto"}).json()
    client.post(f"/api/catalogo/grupos/{g['id']}/itens-pq", json={"itens": ["1.8.3.1.2"]})
    client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
    cs = {c["nome"]: c for c in client.get("/api/efetivo/colaboradores").json()}
    client.post("/api/efetivo/equipes", json={"nome": "EQUIPE.1_CONCRETO", "encarregado_id": cs["ENCARREGADO TESTE UM"]["id"],
                                              "colaboradores": [cs["PEDREIRO TESTE DOIS"]["id"]]})
    return g["id"]


def _importar(client, dados=None):
    r = client.post("/api/programacao-cliente", files={"arquivo": ("Programação Semanal S34.xlsx", dados or planilha_cliente())})
    assert r.status_code == 201, r.text
    return r.json()


def test_conferir_e_levar_a_programacao(client):
    grupo = _base(client)
    prev = client.post("/api/programacao-cliente/previa", files={"arquivo": ("s34.xlsx", planilha_cliente())}).json()
    assert prev["atividades"] == 4 and prev["inicio"] == "2026-11-20" and [a["nome"] for a in prev["abas"]] == ["Programação Semanal - S34"]
    assert client.get("/api/programacao-cliente").json() == []  # a prévia não grava nada

    v = _importar(client)
    a, b, c, d = v["linhas"]
    assert a["situacao"] == "pronta", a
    assert (a["area"]["sit"], a["item"]["sit"], a["equipe"]["sit"]) == ("ok", "ok", "ok") and a["tipo"]
    assert b["item"]["valor"]["item"] == "1.8.3.1.3" and b["item"]["sit"] == "sugerido" and b["situacao"] == "sem_vinculo"
    assert "grupo do Catálogo" in b["faltando"][0]
    assert c["item"]["valor"] is None and c["situacao"] == "sem_vinculo" and c["equipe"]["valor"] is None
    assert d["item"]["sit"] == "ok" and d["situacao"] == "sem_vinculo"  # item da planilha, mas fora do Catálogo
    assert v["placar"]["pronta"] == 1 and v["memoria_placar"]["valor"] == "4"
    assert client.get("/api/programacoes").json() == []  # nada vai para a programação ao importar

    # quem confere: item sugerido confirmado + grupo para criar o tipo; a limpeza não vai
    r = client.put(f"/api/programacao-cliente/{v['id']}/linhas/{b['id']}", json={"item_pq": "1.8.3.1.3"})
    assert r.status_code == 200 and r.json()["situacao"] == "sem_vinculo", r.text
    r = client.post(f"/api/programacao-cliente/{v['id']}/grupo", json={"grupo_id": grupo}).json()
    assert r["linhas"] == 2 and r["conferencia"]["linhas"][1]["situacao"] == "pronta"  # B e D: o mesmo item, um tipo só
    assert client.put(f"/api/programacao-cliente/{v['id']}/linhas/{c['id']}", json={"ignorar": True}).json()["situacao"] == "ignorada"
    assert client.put(f"/api/programacao-cliente/{v['id']}/linhas/{c['id']}", json={"item_pq": "9.9.9"}).status_code == 422

    # destino perguntado: não há programação da semana → oferece a nova
    dst = client.get(f"/api/programacao-cliente/{v['id']}/destinos").json()
    assert dst["existentes"] == [] and dst["nova"]["inicio"] == "2026-11-20"
    assert client.post(f"/api/programacao-cliente/{v['id']}/levar", json={"destino": "existente"}).status_code == 404
    r = client.post(f"/api/programacao-cliente/{v['id']}/levar", json={"destino": "nova"})
    assert r.status_code == 200, r.text
    lv = r.json()
    assert (lv["criadas"], lv["realizado_dias"]) == (3, 1) and lv["conferencia"]["situacao"] == "levada"
    pid = lv["programacao"]["id"]
    prog = client.get(f"/api/programacoes/{pid}").json()
    linhas = [ln for loc in prog["locais"] for ar in loc["areas"] for ln in ar["linhas"]]
    la = next(ln for ln in linhas if ln["item_pq"] == "1.8.3.1.2")
    assert la["total_previsto"] == 10 and la["total_realizado"] == 3 and la["equipe"] == "EQUIPE.1_CONCRETO"
    assert "linha 15" in (la.get("observacao") or "") and la["natureza"] == "P"
    assert client.post(f"/api/programacao-cliente/{v['id']}/levar", json={"destino": "nova"}).status_code == 422  # já existe

    # semana seguinte (mesma planilha de novo): entra ligada pelas decisões; a programação foi emitida → pede reabrir
    client.post(f"/api/programacoes/{pid}/emitir")
    lid = la["id"]
    client.put(f"/api/programacoes/{pid}/linhas/{lid}/valores", json={"campo": "realizado", "valores": [{"data": "2026-11-24", "valor": 2}]})
    atividades = [dict(ATIVIDADES[0], real={SEG: 3, TER: 5}), *ATIVIDADES[1:]]
    v2 = _importar(client, planilha_cliente(atividades))
    a2, b2, c2, _d2 = v2["linhas"]
    assert b2["lembrada"] and b2["situacao"] == "pronta" and c2["situacao"] == "ignorada"
    cmp_ = client.get(f"/api/programacao-cliente/{v2['id']}/comparar/{pid}").json()
    assert cmp_["contagem"] == {"ja_existe": 3}
    r = client.post(f"/api/programacao-cliente/{v2['id']}/levar", json={"destino": "existente", "programacao_id": pid})
    assert r.status_code == 422 and "reabrir" in r.text
    r = client.post(f"/api/programacao-cliente/{v2['id']}/levar", json={"destino": "existente", "programacao_id": pid, "reabrir": True}).json()
    assert (r["criadas"], r["ja_estavam"]) == (0, 3)
    r = client.post(f"/api/programacao-cliente/{v2['id']}/levar",
                    json={"destino": "existente", "programacao_id": pid, "atualizar_existentes": True}).json()
    assert r["atualizadas"] == 3 and r["realizado_mantido_do_campo"] == 2, r  # 23/11 e 24/11 já tinham realizado: vale o do campo
    prog = client.get(f"/api/programacoes/{pid}").json()
    la = next(ln for loc in prog["locais"] for ar in loc["areas"] for ln in ar["linhas"] if ln["id"] == lid)
    assert la["total_realizado"] == 5  # 3 (planilha, 1ª vez) + 2 (campo) — não somou em dobro
