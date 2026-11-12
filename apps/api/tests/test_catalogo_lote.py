"""Spec 028: grupos em massa (OPER_GRUPO), unidades de medida do Simova e excluir item do grupo."""
from io import BytesIO

import pytest
from openpyxl import load_workbook

from app.modules.catalogo.domain.unidades import UNIDADES_PADRAO, codigo_unidade, interpretar_grupos
from app.shared.errors import DomainError

LOTE = "CODIGO\tDESCRICAO\tUNIDADE_MEDIDA\n1\tCONCRETO\t007\n2\tARMADURA\t008\n29\tMATERIAS ELETRICOS\t\n19\tCIVIL EM GERAL\t11\n"


def test_interpreta_lote_e_casa_unidade_da_pq():
    assert interpretar_grupos(LOTE) == [(1, "CONCRETO", "007"), (2, "ARMADURA", "008"), (29, "MATERIAS ELETRICOS", None),
                                        (19, "CIVIL EM GERAL", "011")]
    with pytest.raises(DomainError):
        interpretar_grupos("1\tA\n1\tB")
    tab = dict(UNIDADES_PADRAO)
    assert [codigo_unidade(u, tab) for u in ("m3", "M³", "m2", "UN", "kg", "mês", "pc", "Verba", "xyz")] == \
        ["007", "007", "006", "001", "008", "015", "002", "004", None]


def test_lote_de_grupos_unidades_e_exportacao(client):
    r = client.post("/api/catalogo/grupos/lote", json={"texto": LOTE}).json()
    assert r == {"criados": 4, "atualizados": 0}
    r = client.post("/api/catalogo/grupos/lote", json={"texto": "1\tCONCRETO ESTRUTURAL\t007"}).json()
    assert r == {"criados": 0, "atualizados": 1}
    gs = {g["numero"]: g for g in client.get("/api/catalogo").json()}
    assert gs[1]["descricao"] == "CONCRETO ESTRUTURAL" and gs[1]["unidade"] == "007" and gs[29]["unidade"] is None
    un = client.get("/api/catalogo/unidades").json()
    assert un[6] == {"codigo": "007", "descricao": "m³"} and len(un) == 19
    assert client.post("/api/catalogo/unidades/lote", json={"texto": "020\tsc"}).json() == {"salvas": 1}
    assert client.post("/api/catalogo/grupos/lote", json={"texto": "5\tX\t999"}).status_code == 422  # unidade fora da tabela
    wb = load_workbook(BytesIO(client.get("/api/simova/cadastros.xlsx").content))
    assert [c.value for c in wb["UNIDADE_MEDIDA"][1]] == ["CODIGO", "DESCRICAO"] and wb["UNIDADE_MEDIDA"].max_row == 21
    og = {r[0]: r for r in wb["OPER_GRUPO"].iter_rows(min_row=2, values_only=True)}
    assert og["1"][2] == "007" and og["29"][2] is None
