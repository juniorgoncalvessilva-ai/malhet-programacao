"""Spec 135: enviar e atualizar o arquivo de um documento da lista — a revisão da LDO recebe o arquivo; com arquivo, atualizar
sobe a revisão ou corrige a mesma (com motivo, o anterior fica guardado e fora da limpeza do acervo)."""
from app.modules.documentos.domain import documento as dom
from tests.test_documentos import _dxf
from tests.test_ldo_contrato import _ldo
from tests.test_takeoff_lote import _pdf_com_quadro

PDF = _pdf_com_quadro()


def _envia(client, doc_id, nome="arq.pdf", dados=PDF, **campos):
    return client.post(f"/api/documentos/{doc_id}/arquivo", data={k: str(v) for k, v in campos.items()},
                       files={"arquivo": (nome, dados, "application/octet-stream")})


def test_proxima_revisao():
    assert [dom.proxima_revisao(x) for x in (None, "0", "9", "A", "Z", "AZ", "rev 3")] == ["0", "1", "10", "B", "AA", "BA", "4"]


def test_enviar_e_atualizar_arquivo(client):
    client.post("/api/documentos/ldo", files={"arquivo": ("ldo.xlsx", _ldo())})
    docs = {d["codigo"]: d for d in client.get("/api/documentos").json()}
    d = docs["1800AA-C-52641"]  # LDO: revisão 0 esperando arquivo
    assert d["vigente"]["formatos"] == []
    # enviar: o arquivo entra na revisão da LDO, com a finalidade da LDO
    r = _envia(client, d["id"], modo="mesma", revisao="0")
    assert r.status_code == 200, r.text
    assert r.json()["revisao"]["revisao"] == "0" and "original" in r.json()["revisao"]["formatos"] and r.json()["substituido"] is False
    # corrigir a mesma revisão: exige motivo; o anterior fica no histórico
    assert _envia(client, d["id"], modo="mesma", revisao="0").status_code == 422
    r = _envia(client, d["id"], nome="corrigido.pdf", modo="mesma", revisao="0", motivo="folha errada enviada")
    assert r.status_code == 200 and r.json()["substituido"] is True
    det = client.get(f"/api/documentos/{d['id']}").json()
    h0 = next(h for h in det["historico"] if h["revisao"] == "0")
    assert h0["nome_original"] == "corrigido.pdf" and h0["anteriores"][0]["nome_original"] == "arq.pdf"
    assert h0["anteriores"][0]["motivo"] == "folha errada enviada" and len(det["historico"]) == 1
    # nova revisão: a seguinte sozinha; não pode voltar atrás
    r = _envia(client, d["id"], modo="nova", finalidade="para construção")
    assert r.status_code == 200 and r.json()["revisao"]["revisao"] == "1"
    assert client.get(f"/api/documentos/{d['id']}").json()["vigente"]["revisao"] == "1"
    assert _envia(client, d["id"], modo="nova", revisao="0").status_code == 422
    assert _envia(client, d["id"], modo="mesma", revisao="7").status_code == 422
    # carimbo de outro documento: guarda como pedido, mas avisa
    r = _envia(client, d["id"], nome="x.dxf", dados=_dxf("1800AA-C-0900", "5", "PARA CONSTRUÇÃO"), modo="nova").json()
    assert r["revisao"]["revisao"] == "2" and any("carimbo do desenho diz 1800AA-C-0900" in a for a in r["avisos"])
    assert any("carimbo diz revisão 5" in a for a in r["avisos"])
    # o arquivo anterior continua em uso (a limpeza do acervo não apaga)
    from app.core.db import SessionLocal
    from app.modules.documentos.application.servico import _em_uso
    from app.modules.documentos.infra.models import DocumentoArquivoAnteriorModel
    with SessionLocal() as s:
        a = s.query(DocumentoArquivoAnteriorModel).first()
        assert a.arquivo_id in set(s.execute(_em_uso()).scalars())
    # por obra
    outra = client.post("/api/admin/obras", json={"codigo": "OUT-ARQ", "nome": "Outra"}).json()["id"]
    assert client.post(f"/api/documentos/{d['id']}/arquivo", data={"modo": "nova"}, files={"arquivo": ("a.pdf", PDF)},
                       headers={"X-Obra-Id": str(outra)}).status_code == 404


def test_desenho_que_nao_le_nao_derruba_o_envio(client, monkeypatch):
    """Spec 138: DWG/DXF que o leitor não entende (ou com NUL/controle nos textos) fica guardado com aviso — antes era 500."""
    from app.modules.documentos.infra import desenho

    assert desenho.limpo("CÓD\x00IGO\x07 1\n") == "CÓDIGO 1\n"
    client.post("/api/documentos/ldo", files={"arquivo": ("ldo.xlsx", _ldo())})
    d = {x["codigo"]: x for x in client.get("/api/documentos").json()}["1800AA-C-52641"]
    # DXF quebrado
    r = _envia(client, d["id"], nome="quebrado.dxf", dados=b"0\nSECTION\n2\nENTITIES\n0\nLIXO", modo="mesma", revisao="0")
    assert r.status_code == 200, r.text  # o recover do ezdxf aguenta muita coisa; o que não aguentar vira aviso
    # erro inesperado no leitor (ex.: Agg estourando, atributo esquisito)
    monkeypatch.setattr(desenho, "ler", lambda *a, **k: (_ for _ in ()).throw(OverflowError("Exceeded cell block limit")))
    r = _envia(client, d["id"], nome="x.dxf", dados=_dxf("1800AA-C-52641", "1", "PARA CONSTRUÇÃO"), modo="nova")
    assert r.status_code == 200 and any("OverflowError" in a for a in r.json()["avisos"])
    r = client.post("/api/documentos/revisoes", data={"revisao": "0"}, files={"arquivo": ("1800AA-C-0901.dxf", _dxf("1800AA-C-0901", "0", "PARA CONSTRUÇÃO"))})
    assert r.status_code == 201, r.text
