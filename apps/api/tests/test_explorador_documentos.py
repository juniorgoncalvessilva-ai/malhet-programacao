"""Spec 134: explorador de documentos (GED) — cada pasta diz os documentos que tem (`membros`) e como se abre em subpastas
(pacote → frente → disciplina nos projetos; pacote → disciplina no resto), editável; o documento traz as frentes confirmadas e
a data da última revisão para "Recentes"."""
import pytest

from app.modules.documentos.domain import pastas as pd
from app.shared.errors import DomainError
from tests.test_ldo_contrato import _cwa, _ldo


def test_subpastas_padrao_e_validacao():
    assert pd.subpastas_padrao(["DES"]) == ["pacote", "frente", "disciplina"]
    assert pd.subpastas_padrao(["PRO", "IT"]) == ["pacote", "disciplina"]
    assert pd.validar_subpastas(["frente", "frente", "ano"]) == ["frente", "ano"]
    with pytest.raises(DomainError):
        pd.validar_subpastas(["cor"])
    with pytest.raises(DomainError):
        pd.validar_subpastas(["pacote", "frente", "disciplina", "ano"])


def test_explorador_pela_api(client):
    client.post("/api/frentes/planilha", data={"aba": "CWAs Cardan", "empresas": "CARDAN"}, files={"arquivo": ("cwa.xlsx", _cwa())})
    client.post("/api/documentos/ldo", files={"arquivo": ("ldo.xlsx", _ldo())})
    docs = {d["codigo"]: d for d in client.get("/api/documentos").json()}
    areas = {a["codigo"]: a["id"] for l in client.get("/api/frentes").json() for a in l["areas"]}
    assert docs["1800AA-E-51286"]["frentes"] == [areas["004.05"]]  # Observações "004.05" confirmou a frente
    assert docs["1800AA-C-52640"]["frentes"] == []  # só sugerida pelo nome: não vira subpasta
    p = client.get("/api/documentos/pastas").json()
    projetos = next(x for x in p["pastas"] if x["codigo"] == "20")
    assert projetos["subpastas"] == ["pacote", "frente", "disciplina"] and "frente" in p["niveis"]
    assert {docs[c]["id"] for c in ("1800AA-C-52640", "1800AA-E-51286")} <= set(projetos["membros"])
    assert len(projetos["membros"]) == projetos["documentos"]
    todos = {i for x in p["pastas"] for i in x["membros"]} | set(p["sem_pasta_ids"])
    assert todos == {d["id"] for d in docs.values()}
    # a pasta escolhe como se abre
    corpo = {"nome": projetos["nome"], "tipos": ["DES"], "subpastas": ["disciplina", "ano"]}
    assert client.put(f"/api/documentos/pastas/{projetos['id']}", json=corpo).status_code == 200
    assert next(x for x in client.get("/api/documentos/pastas").json()["pastas"] if x["codigo"] == "20")["subpastas"] == ["disciplina", "ano"]
    assert client.put(f"/api/documentos/pastas/{projetos['id']}", json={**corpo, "subpastas": ["cor"]}).status_code == 422
    # sem dizer subpastas, o que estava fica
    assert client.put(f"/api/documentos/pastas/{projetos['id']}", json={"nome": projetos["nome"], "tipos": ["DES"]}).status_code == 200
    assert next(x for x in client.get("/api/documentos/pastas").json()["pastas"] if x["codigo"] == "20")["subpastas"] == ["disciplina", "ano"]
