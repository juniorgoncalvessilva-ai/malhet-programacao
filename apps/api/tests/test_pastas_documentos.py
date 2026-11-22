"""Spec 129: pastas de documentos (cópia da pasta-modelo por obra, pasta = regra, sem pasta + sugestão, armazenamento),
nome padrão OBRA_CÓDIGO_Rrev_TE e o consolidado do período (assinado/pendente)."""
from datetime import date

import pytest

from app.modules.documentos.domain import pastas as pd
from app.shared.errors import DomainError
from tests.test_ldo_contrato import _ldo


def test_regras_e_nome_padrao():
    civil = pd.Regra(tipos=("DES",), disciplinas=("C",))
    assert pd.pertence(pd.DocInfo("DES", "CIVIL", "C"), civil) and pd.pertence(pd.DocInfo("DES", "Civil", None), pd.Regra(("DES",), ("civil",)))
    assert not pd.pertence(pd.DocInfo("DES", "ELÉTRICA", "E"), civil) and not pd.pertence(pd.DocInfo("PRO", "CIVIL", "C"), civil)
    assert pd.pertence(pd.DocInfo("DES", pacote="16XXCC - INTERFERÊNCIAS"), pd.Regra(pacotes=("interferencias",)))
    with pytest.raises(DomainError):
        pd.Regra()
    with pytest.raises(DomainError):
        pd.Regra(tipos=("XYZ",))
    assert pd.proximo_codigo(["10", "20", "60"]) == "70"
    assert pd.nome_padrao("CT-001", "1870AA-C-51890", "4", "E") == "CT-001_1870AA-C-51890_R4_E"
    assert pd.nome_padrao("Obra Á", "LD 0000", None) == "Obra-A_LD-0000"
    assert pd.sugestao_para([pd.DocInfo("NOR"), pd.DocInfo("NOR"), pd.DocInfo("OUT")]) == {"nome": "Normas", "tipos": ["NOR"], "documentos": 2}


def test_pastas_pela_api(client):
    r = client.get("/api/documentos/pastas").json()
    assert [p["codigo"] for p in r["pastas"]] == ["10", "20", "30", "40", "50", "60"] and all(p["do_modelo"] for p in r["pastas"])
    assert r["documentos"] == 0 and r["armazenamento"]["limite"] > 0
    client.post("/api/documentos/ldo", files={"arquivo": ("ldo.xlsx", _ldo())})
    r = client.get("/api/documentos/pastas").json()
    p = {x["codigo"]: x for x in r["pastas"]}
    assert p["20"]["documentos"] == 5 and p["20"]["vigentes"] == 3 and p["10"]["documentos"] == 1  # projetos e a própria LDO
    assert p["20"]["por_pacote"] == {"1870CC - CMD": 3, "16XXCC - OFICINA": 2} and r["armazenamento"]["documentos"] > 0
    # pasta nova por regra: o documento aparece também nela; apagar a pasta não apaga documento
    nova = client.post("/api/documentos/pastas", json={"nome": "Projetos civis", "tipos": ["DES"], "disciplinas": ["c"]}).json()
    assert nova["codigo"] == "70"
    civis = client.get("/api/documentos", params={"pasta_id": nova["id"]}).json()
    assert {d["codigo"] for d in civis} == {"1800AA-C-52640", "1800AA-C-52641", "0000AA-C-00015"}
    assert client.post("/api/documentos/pastas", json={"nome": "Vazia"}).status_code == 422  # sem regra
    # apagar a pasta "Projetos": os projetos que não estão em outra pasta vão para "Sem pasta" com a sugestão de volta
    assert client.delete(f"/api/documentos/pastas/{p['20']['id']}").status_code == 204
    r = client.get("/api/documentos/pastas").json()
    assert r["sem_pasta"] == 2 and r["sugestao"] == {"nome": "Projetos", "tipos": ["DES"], "documentos": 2}
    assert len(client.get("/api/documentos", params={"pasta_id": 0}).json()) == 2
    assert client.post("/api/documentos/pastas/restaurar").json() == {"restauradas": 1}
    assert client.get("/api/documentos/pastas").json()["sem_pasta"] == 0
    outra = client.post("/api/admin/obras", json={"codigo": "OUT-PST", "nome": "Outra"}).json()["id"]
    assert client.delete(f"/api/documentos/pastas/{nova['id']}", headers={"X-Obra-Id": str(outra)}).status_code == 404


def test_consolidado_do_periodo(client):
    client.post("/api/documentos/ldo", files={"arquivo": ("ldo.xlsx", _ldo())})
    g = client.post("/api/documentos/grds", json={"sentido": "recebida", "data": "2026-06-16", "remetente": "Projetista",
                                                  "destinatario": "Contratada"}).json()
    r = client.get("/api/documentos/consolidado", params={"periodo": "mes", "ref": "2026-06-10"}).json()
    assert (r["inicio"], r["fim"]) == ("2026-06-01", "2026-06-30")
    assert r["totais"] == {"itens": 3, "assinado": 0, "pendente": 3, "revisoes": 2, "grds": 1}  # 2 revisões de 15/06 sem arquivo + GRD
    client.post(f"/api/documentos/grds/{g['id']}/ciencia")
    r = client.get("/api/documentos/consolidado", params={"periodo": "mes", "ref": "2026-06-10", "situacao": "assinado"}).json()
    assert [x["codigo"] for x in r["itens"]] == [g["numero"]] and "ciência" in r["itens"][0]["detalhe"]
    s = client.get("/api/documentos/consolidado", params={"periodo": "semana", "ref": "2026-06-17"}).json()
    assert (s["inicio"], s["fim"]) == ("2026-06-15", "2026-06-21") and s["totais"]["itens"] == 3
    assert client.get("/api/documentos/consolidado", params={"periodo": "ano"}).status_code == 422
    assert pd.nome_padrao("X", "Y", "0") == "X_Y_R0" and date(2026, 6, 1)
