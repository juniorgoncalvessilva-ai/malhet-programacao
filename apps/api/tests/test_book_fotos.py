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
