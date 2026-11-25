"""Spec 062: book de fotos por frente, atividade e data (atividades, ocorrências e restrições)."""
from io import BytesIO

from PIL import Image

from tests.test_excluir_revisao import _programacao


def _jpeg() -> bytes:
    b = BytesIO()
    Image.new("RGB", (40, 30), (120, 90, 60)).save(b, "JPEG")
    return b.getvalue()


def _foto(client, alvo, alvo_id, data=None):
    dados = {"alvo": alvo, "alvo_id": str(alvo_id)}
    if data:
        dados["data"] = data
    r = client.post("/api/fotos", data=dados, files={"arquivo": ("f.jpg", _jpeg(), "image/jpeg")})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_book_de_fotos(client):
    pid = _programacao(client)
    client.post(f"/api/programacoes/{pid}/emitir")
    v = client.get(f"/api/programacoes/{pid}").json()
    area = v["locais"][0]["areas"][0]
    ln = area["linhas"][0]
    f1 = _foto(client, "linha", ln["id"], "2026-11-09")
    causa = client.get("/api/desvios/causas").json()[0]
    d = client.post("/api/desvios", json={"data": "2026-11-10", "causa_id": causa["id"], "descricao": "Faltou concreto",
                                          "programacao_id": pid, "linha_id": ln["id"]}).json()
    f2 = _foto(client, "desvio", d["id"])
    r = client.post("/api/restricoes", json={"acao": "Liberar acesso", "area_id": area["id"]}).json()
    f3 = _foto(client, "restricao", r["id"])

    book = client.get("/api/fotos/book").json()
    por_id = {x["id"]: x for x in book}
    assert set(por_id) == {f1, f2, f3}
    a = por_id[f1]
    assert (a["tipo"], a["data"], a["area_id"]) == ("atividade", "2026-11-09", area["id"])
    assert a["atividade"].startswith(ln["codigo_simova"]) and a["local"]
    o = por_id[f2]
    assert (o["tipo"], o["causa"], o["titulo"], o["area_id"]) == ("ocorrencia", causa["descricao"], "Faltou concreto", area["id"])
    assert por_id[f3]["tipo"] == "restricao" and por_id[f3]["titulo"].startswith("Restrição Nº")

    assert [x["id"] for x in client.get("/api/fotos/book", params={"tipo": "atividade"}).json()] == [f1]
    assert [x["id"] for x in client.get("/api/fotos/book", params={"tipo": "ocorrencia", "de": "2026-11-10", "ate": "2026-11-10"}).json()] == [f2]
    assert client.get("/api/fotos/book", params={"tipo": "ocorrencia", "de": "2026-11-11"}).json() == []
    assert client.get("/api/fotos/book", params={"area_id": 999999}).json() == []


def test_book_com_auditorias_e_acoes(client):
    """Spec 070: fotos das auditorias (antes/depois) e evidências das ações 5W2H entram no book."""
    from tests.test_auditorias import LISTA, _foto_leg

    client.post("/api/frentes/importar", json={"texto": LISTA})
    area = client.get("/api/frentes").json()[0]["areas"][0]
    base = {"data": "2026-11-12", "tipo": "Inspeção", "tipo_registro": "Condição insegura", "area_id": area["id"], "engenheiro": "Eng",
            "encarregado": "Enc", "nao_conformidade": "Guarda-corpo solto", "medida_corretiva": "Fixar", "acompanhamento": "X"}
    r = client.post("/api/auditorias/registros", json={**base, "ver_agir": False, "plano_responsavel": "Enc", "plano_prazo": "2026-11-14"}).json()
    _foto_leg(client, "auditoria", r["id"], "antes")
    rascunho = client.post("/api/auditorias/registros", json={**base, "ver_agir": True}).json()
    _foto_leg(client, "auditoria", rascunho["id"], "antes")  # rascunho não entra no book
    fim = client.post(f"/api/auditorias/registros/{r['id']}/finalizar").json()
    _foto_leg(client, "acao", fim["acao"]["id"], "evidencia")
    aud = client.get("/api/fotos/book", params={"tipo": "auditoria"}).json()
    assert len(aud) == 1 and aud[0]["area_id"] == area["id"] and aud[0]["titulo"].startswith("Inspeção Nº 1 · ANTES")
    assert aud[0]["causa"] == "Inspeção" and aud[0]["atividade"] == "Condição insegura" and aud[0]["momento"] == "antes"
    ac = client.get("/api/fotos/book", params={"tipo": "acao"}).json()
    assert len(ac) == 1 and ac[0]["titulo"].startswith("Ação A-1 · evidência") and ac[0]["atividade"] == "Inspeção Nº 1"
    assert {x["tipo"] for x in client.get("/api/fotos/book").json()} == {"auditoria", "acao"}


def test_baixar_fotos_do_dia_e_da_frente_em_zip(client):
    """Spec 145: todas as fotos de uma vez, por dia e por frente — .zip com pastas Dia/Frente, nome que diz dia, frente,
    tipo e id, e o índice em Excel; os mesmos filtros do book, só as escolhidas com `ids`, por obra."""
    import zipfile

    from openpyxl import load_workbook

    pid = _programacao(client)
    client.post(f"/api/programacoes/{pid}/emitir")
    v = client.get(f"/api/programacoes/{pid}").json()
    area = v["locais"][0]["areas"][0]
    ln = area["linhas"][0]
    f1 = _foto(client, "linha", ln["id"], "2026-11-09")
    f2 = _foto(client, "linha", ln["id"], "2026-11-09")
    f3 = _foto(client, "linha", ln["id"], "2026-11-10")
    r = client.post("/api/restricoes", json={"acao": "Liberar acesso"}).json()  # sem frente
    f4 = _foto(client, "restricao", r["id"])

    resp = client.get("/api/fotos/book/zip", params={"de": "2026-11-09", "ate": "2026-11-09", "area_id": area["id"]})
    assert resp.status_code == 200 and resp.headers["content-type"] == "application/zip"
    assert f'fotos-20261109-{area["codigo"]}' in resp.headers["content-disposition"]
    z = zipfile.ZipFile(BytesIO(resp.content))
    fotos = sorted(n for n in z.namelist() if n.endswith(".jpg"))
    assert len(fotos) == 2 and all(n.startswith(f"2026-11-09/{area['codigo']}") for n in fotos)
    assert fotos[0].split("/")[-1].startswith("20261109-") and fotos[0].endswith((f"-atividade-{f1}.jpg", f"-atividade-{f2}.jpg"))
    assert z.read(fotos[0])[:3] == b"\xff\xd8\xff"  # o original, não a miniatura
    ws = load_workbook(BytesIO(z.read("indice.xlsx"))).active
    linhas = list(ws.iter_rows(min_row=2, values_only=True))
    assert len(linhas) == 2 and linhas[0][1] == "2026-11-09" and linhas[0][5] == "atividade" and linhas[0][6].startswith(ln["codigo_simova"])

    tudo = zipfile.ZipFile(BytesIO(client.get("/api/fotos/book/zip").content)).namelist()
    assert {n.split("/")[0] for n in tudo if n.endswith(".jpg")} >= {"2026-11-09", "2026-11-10"}
    assert any(n.endswith(f"-restricao-{f4}.jpg") and "/Sem frente/" in n for n in tudo)
    so = zipfile.ZipFile(BytesIO(client.get("/api/fotos/book/zip", params={"ids": f"{f3},{f4}"}).content)).namelist()
    assert sorted(n.rsplit("-", 1)[-1] for n in so if n.endswith(".jpg")) == sorted([f"{f3}.jpg", f"{f4}.jpg"])

    assert client.get("/api/fotos/book/zip", params={"de": "2030-01-01"}).status_code == 422
    outra = client.post("/api/admin/obras", json={"codigo": "OUT-ZIP", "nome": "Outra"}).json()["id"]
    assert client.get("/api/fotos/book/zip", headers={"X-Obra-Id": str(outra)}).status_code == 422  # nada da outra obra
