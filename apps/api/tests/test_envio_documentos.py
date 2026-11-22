"""Spec 132: enviar documentos por tipo — casa sozinho com a LDO (carimbo, nome do arquivo, revisão no nome ou única esperando
arquivo) e o que não casa vai para "A relacionar" (associar à LDO, criar documento, relacionar a outros, descartar)."""
from tests.test_documentos import _dxf
from tests.test_ldo_contrato import _ldo
from tests.test_takeoff_lote import _pdf_com_quadro

PDF = _pdf_com_quadro()


def _envia(client, nome: str, dados: bytes = PDF, **campos):
    return client.post("/api/documentos/enviar", data={k: str(v) for k, v in campos.items()}, files={"arquivo": (nome, dados, "application/octet-stream")})


def test_enviar_casa_com_a_ldo_e_relaciona_o_resto(client):
    client.post("/api/documentos/ldo", files={"arquivo": ("ldo.xlsx", _ldo())})
    docs = {d["codigo"]: d for d in client.get("/api/documentos").json()}
    # código + revisão no nome do arquivo
    r = _envia(client, "1800AA-C-52640_R2.pdf").json()
    assert r["resultado"] == "associado" and r["revisao"]["revisao"] == "2" and "nome do arquivo" in r["como"]
    # sem revisão no nome: a única revisão esperando arquivo na LDO
    r = _envia(client, "1800AA-C-52641 - classe I.pdf").json()
    assert r["resultado"] == "associado" and r["revisao"]["revisao"] == "0" and "esperando arquivo" in r["como"]
    # desenho com carimbo e código fora da LDO: o carimbo é informação controlada, entra como documento novo
    r = _envia(client, "qualquer.dxf", _dxf("1800AA-C-0900", "0", "PARA CONSTRUÇÃO"), tipo="DES").json()
    assert r["resultado"] == "associado" and r["documento"]["codigo"] == "1800AA-C-0900"
    # mesma revisão de novo: não sobrescreve, vai para relacionar com o motivo
    r = _envia(client, "1800AA-C-52640_R2.pdf").json()
    assert r["resultado"] == "a_relacionar" and "já está guardada" in r["motivo"]
    # sem código: sugestões pelo título
    s1 = _envia(client, "planta cercamento ampliacao.pdf", tipo="DES").json()
    assert s1["resultado"] == "a_relacionar" and s1["sugestoes"][0]["codigo"] == "1800AA-A-52642"
    s2 = _envia(client, "PR-17321-204-00.pdf", tipo="PRO").json()
    assert "não está na lista" in s2["motivo"]
    s3 = _envia(client, "rascunho.pdf").json()
    pend = client.get("/api/documentos/recebidos").json()
    assert {p["id"] for p in pend} >= {s1["id"], s2["id"], s3["id"]} and client.get(f"/api/documentos/recebidos/{s1['id']}/arquivo").content[:4] == b"%PDF"
    # associar à LDO e relacionar a outro documento
    a = client.post(f"/api/documentos/recebidos/{s1['id']}/associar", json={"documento_id": docs["1800AA-A-52642"]["id"], "revisao": "A",
                                                                             "relacionar_a": [docs["1800AA-C-52640"]["id"]]}).json()
    assert a["revisao"]["revisao"] == "A" and a["relacionados"] == 1
    det = client.get(f"/api/documentos/{docs['1800AA-A-52642']['id']}").json()
    assert "pdf" in det["historico"][0]["formatos"] or "original" in det["historico"][0]["formatos"]
    assert any(v["alvo_tipo"] == "documento" and v["relacao"] == "referencia" for v in det["vinculos"])
    # criar o documento que não estava na lista
    n = client.post(f"/api/documentos/recebidos/{s2['id']}/novo", json={"codigo": "PR-17321-204", "titulo": "Procedimento de concretagem",
                                                                         "revisao": "0", "tipo": "PRO", "finalidade": "para construção"}).json()
    assert n["documento"]["codigo"] == "PR-17321-204" and n["documento"]["tipo"] == "PRO"
    assert client.post(f"/api/documentos/recebidos/{s3['id']}/novo", json={"codigo": "PR-17321-204", "titulo": "x y z", "revisao": "1"}).status_code == 422
    # descartar
    outra = client.post("/api/admin/obras", json={"codigo": "OUT-ENV", "nome": "Outra"}).json()["id"]
    assert client.delete(f"/api/documentos/recebidos/{s3['id']}", headers={"X-Obra-Id": str(outra)}).status_code == 404
    assert client.delete(f"/api/documentos/recebidos/{s3['id']}").status_code == 204
    assert {p["id"] for p in client.get("/api/documentos/recebidos").json()} == {p["id"] for p in pend} - {s1["id"], s2["id"], s3["id"]}
