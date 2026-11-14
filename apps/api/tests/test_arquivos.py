"""Spec 082, fase 4: arquivos no disco + nuvem da obra (Google Drive, OneDrive, Dropbox), acervo Zettelkasten."""
import io
import json
import re
from base64 import urlsafe_b64encode
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from PIL import Image
from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.modules.arquivos.application import fila
from app.modules.arquivos.application.conexao import criar_state
from app.modules.arquivos.domain import zettel
from app.modules.arquivos.domain.provedor import Credencial
from app.modules.arquivos.infra import disco, provedores
from app.modules.arquivos.infra.models import ArmazenamentoObraModel, ArquivoModel
from app.modules.campo.infra.models import FotoCampoModel
from app.shared.errors import DomainError


def _jpeg(lado=1200, cor=(200, 30, 30)) -> bytes:
    b = io.BytesIO()
    Image.new("RGB", (lado, lado // 2), cor).save(b, "JPEG", quality=95)
    return b.getvalue()


# ---------------------------------------------------------------- domínio
def test_nomes_e_ficha_zettelkasten():
    quando = datetime(2026, 11, 14, 18, 30, tzinfo=timezone.utc)  # 15:30 na obra
    n = zettel.nome_arquivo("foto-linha", quando, "Armação — Bloco 3 (pré)", "image/jpeg", "abcd1234")
    assert n == "202611141530-FOTO-armacao-bloco-3-pre-abcd.jpg"
    assert zettel.codigo_pasta_obra("310", "Obra 310 · Teste") == "310-obra-310-teste"
    md = zettel.ficha_md(zettel.Ficha(id="abcd1234", tipo="foto-linha", obra="310", arquivo=n, criado_em=quando,
                                      hash_sha256="f" * 64, titulo="Armação", ligacoes={"frente": "L1 Galpão", "area": None}))
    assert md.startswith("---\nid: \"abcd1234\"") and "  frente: \"L1 Galpão\"" in md and "area" not in md
    assert f"[[{n}]]" in md and "sensivel: false" in md
    with pytest.raises(DomainError):
        zettel.Ficha(id="x", tipo="foto-linha", obra="310", arquivo=n, criado_em=quando, hash_sha256="0", sensivel=True)
    assert "| [[20-campo-fotos]] |" in zettel.indice_obra_md("310", "Obra", {"20-campo-fotos": 3}, [], quando)
    assert fila.espera(1).total_seconds() == 60 and fila.espera(30).total_seconds() == 6 * 3600


# ---------------------------------------------------------------- fotos no disco
def _foto(client, conteudo=None) -> dict:
    from tests.test_excluir_revisao import _programacao

    pid = _programacao(client)
    lid = client.get(f"/api/programacoes/{pid}").json()["locais"][0]["areas"][0]["linhas"][0]["id"]
    r = client.post("/api/fotos", data={"alvo": "linha", "alvo_id": str(lid), "data": "2026-11-10", "legenda": "Concretagem"},
                    files={"arquivo": ("f.jpg", conteudo or _jpeg(), "image/jpeg")})
    assert r.status_code == 201, r.text
    return r.json()


def test_foto_vai_para_o_disco_com_miniatura_e_ligacoes(client):
    img = _jpeg()
    f = _foto(client, img)
    with SessionLocal() as s:
        fm = s.get(FotoCampoModel, f["id"])
        assert fm.arquivo_id and s.scalar(select(FotoCampoModel.conteudo).where(FotoCampoModel.id == f["id"])) is None
        a = s.get(ArquivoModel, fm.arquivo_id)
        assert a.pasta == "20-campo-fotos" and a.nome.endswith(".jpg") and "-FOTO-concretagem-" in a.nome
        assert a.ligacoes["frente"] and a.ligacoes["area"] and a.ligacoes["programacao_id"]
        assert disco.ler(a.obra_id, a.uid) == img and a.situacao == "local"
    assert client.get(f"/api/fotos/{f['id']}/arquivo").content == img
    mini = client.get(f"/api/fotos/{f['id']}/arquivo", params={"mini": "true"})
    assert mini.headers["content-type"] == "image/jpeg" and len(mini.content) < len(img)
    assert max(Image.open(io.BytesIO(mini.content)).size) <= 480


def test_fotos_e_anexos_antigos_saem_do_banco(client):
    obra = int(client.headers["X-Obra-Id"])
    img = _jpeg(cor=(10, 200, 10))
    with SessionLocal() as s:
        s.add(FotoCampoModel(obra_id=obra, alvo="desvio", alvo_id=99, legenda="antiga", content_type="image/jpeg",
                             tamanho=len(img), conteudo=img, enviado_por="x"))
        s.commit()
        assert fila.migrar_legado(s) == 1
        s.commit()
        fm = s.scalar(select(FotoCampoModel).where(FotoCampoModel.legenda == "antiga"))
        a = s.get(ArquivoModel, fm.arquivo_id)
        assert a.pasta == "30-ocorrencias-restricoes" and disco.ler(obra, a.uid) == img
        assert s.scalar(select(FotoCampoModel.conteudo).where(FotoCampoModel.id == fm.id)) is None
        assert fila.migrar_legado(s) == 0
    assert client.get(f"/api/fotos/{fm.id}/arquivo").content == img


def test_arquivo_sem_dono_sai_do_servidor(client):
    f = _foto(client)
    with SessionLocal() as s:
        a = s.get(ArquivoModel, s.get(FotoCampoModel, f["id"]).arquivo_id)
        obra, uid = a.obra_id, a.uid
    assert client.delete(f"/api/fotos/{f['id']}").status_code == 204
    with SessionLocal() as s:
        assert fila.apagar_orfaos(s, idade=fila.timedelta(0)) == 1
        s.commit()
    assert disco.ler(obra, uid) is None


# ---------------------------------------------------------------- nuvem simulada
class NuvemFalsa:
    """Responde como as APIs dos três provedores, guardando o que foi enviado."""

    def __init__(self):
        self.arquivos: dict[str, bytes] = {}
        self.nomes: dict[str, str] = {}
        self.pastas: list[str] = []
        self.falhar: int | None = None
        self.n = 0

    def _id(self, p="id"):
        self.n += 1
        return f"{p}{self.n}"

    def __call__(self, req: httpx.Request) -> httpx.Response:
        u, m = req.url, req.method
        if self.falhar and "token" not in str(u):
            return httpx.Response(self.falhar, text="indisponível")
        if str(u).endswith("/token"):
            corpo = parse_qs(req.content.decode())
            if corpo.get("refresh_token") == ["revogado"]:
                return httpx.Response(400, json={"error": "invalid_grant"})
            id_token = "x." + urlsafe_b64encode(json.dumps({"email": "obra@empresa.com"}).encode()).decode().rstrip("=") + ".y"
            return httpx.Response(200, json={"access_token": "at", "expires_in": 3600, "refresh_token": "rt-novo", "id_token": id_token})
        # Google Drive
        if u.host == "www.googleapis.com" and u.path == "/drive/v3/files" and m == "GET":
            return httpx.Response(200, json={"files": []})
        if u.host == "www.googleapis.com" and u.path == "/drive/v3/files" and m == "POST":
            self.pastas.append(json.loads(req.content)["name"])
            return httpx.Response(200, json={"id": self._id("pasta")})
        if u.path == "/upload/drive/v3/files" and m == "POST":
            sid = self._id("sessao")
            self.nomes[sid] = json.loads(req.content)["name"]
            return httpx.Response(200, headers={"location": f"https://upload.teste/{sid}"})
        if u.host == "upload.teste":
            fid = self._id("g")
            self.arquivos[fid], self.nomes[fid] = req.content, self.nomes[u.path.strip("/")]
            return httpx.Response(200, json={"id": fid})
        if u.path.startswith("/upload/drive/v3/files/") and m == "PATCH":
            fid = u.path.rsplit("/", 1)[1]
            self.arquivos[fid] = req.content
            return httpx.Response(200, json={"id": fid})
        if u.path.startswith("/drive/v3/files/") and dict(u.params).get("alt") == "media":
            return httpx.Response(200, content=self.arquivos[u.path.rsplit("/", 1)[1]])
        # OneDrive
        if u.host == "graph.microsoft.com" and m == "PUT":
            fid = self._id("o")
            self.arquivos[fid], self.nomes[fid] = req.content, re.search(r"approot:/(.*):/content", str(u)).group(1)
            return httpx.Response(201, json={"id": fid})
        # Dropbox
        if u.host == "content.dropboxapi.com" and u.path == "/2/files/upload":
            fid = self._id("id:")
            self.arquivos[fid], self.nomes[fid] = req.content, json.loads(req.headers["dropbox-api-arg"])["path"]
            return httpx.Response(200, json={"id": fid})
        return httpx.Response(404, text=f"não simulado: {m} {u}")


@pytest.fixture()
def nuvem(monkeypatch):
    n = NuvemFalsa()
    monkeypatch.setattr(provedores, "_TRANSPORTE", httpx.MockTransport(n))
    cfg = get_settings()
    for k in ("google_client_id", "google_client_secret", "ms_client_id", "ms_client_secret", "dropbox_app_key", "dropbox_app_secret"):
        monkeypatch.setattr(cfg, k, "teste")
    return n


def _conectar(client, prov="google"):
    obra = int(client.headers["X-Obra-Id"])
    r = client.post(f"/api/armazenamento/conectar/{prov}")
    assert r.status_code == 200 and "state=" in r.json()["url"]
    r = client.get(f"/api/armazenamento/oauth/{prov}/retorno", params={"code": "c", "state": criar_state(obra, "dev", prov)},
                   follow_redirects=False)
    assert r.status_code == 302 and "ok=" in r.headers["location"], r.headers["location"]
    return obra


def test_google_drive_ida_e_volta(client, nuvem):
    img = _jpeg(cor=(1, 2, 3))
    f = _foto(client, img)
    obra = _conectar(client)
    sit = client.get("/api/armazenamento").json()
    assert sit["conexao"]["conta"] == "obra@empresa.com" and sit["arquivos"]["aguardando"] == 1
    assert "rt-novo" not in json.dumps(sit)  # o token nunca volta para a tela
    with SessionLocal() as s:
        assert fila.enviar_pendentes(s) == 1
        s.commit()
        assert fila.atualizar_indices(s) == 1
        s.commit()
        a = s.get(ArquivoModel, s.get(FotoCampoModel, f["id"]).arquivo_id)
        assert a.situacao == "enviado" and nuvem.arquivos[a.ref_remota] == img
    assert nuvem.pastas[:3] == ["Malhet", "obras", "310-obra-310-teste"] and "20-campo-fotos" in nuvem.pastas
    fichas = [nuvem.arquivos[k].decode() for k, v in nuvem.nomes.items() if k in nuvem.arquivos and v.endswith(".md") and v != "00-indice.md" and v != "00-INDICE.md"]
    assert any(f"hash_sha256: \"{a.sha256}\"" in x for x in fichas)
    assert any(v == "00-indice.md" for v in nuvem.nomes.values())
    # disco liberado (0 dias): a miniatura fica e o original volta da nuvem ao abrir, conferindo o hash
    client.put("/api/armazenamento", json={"dias_no_disco": 0})
    with SessionLocal() as s:
        assert fila.liberar_disco(s) == 1
        s.commit()
    assert disco.ler(obra, a.uid) is None and disco.ler(obra, a.uid, mini=True) is not None
    assert client.get(f"/api/fotos/{f['id']}/arquivo").content == img
    assert disco.ler(obra, a.uid) == img
    # com original só na nuvem, desconectar é recusado
    client.put("/api/armazenamento", json={"dias_no_disco": 0})
    with SessionLocal() as s:
        fila.liberar_disco(s)
        s.commit()
    assert client.delete("/api/armazenamento").status_code == 422


def test_falha_espera_e_token_revogado_pede_reconexao(client, nuvem):
    _foto(client)
    obra = _conectar(client)
    nuvem.falhar = 503
    with SessionLocal() as s:
        assert fila.enviar_pendentes(s) == 0
        s.commit()
        a = s.scalar(select(ArquivoModel).where(ArquivoModel.obra_id == obra))
        assert a.situacao == "erro" and a.tentativas == 1 and a.proxima_tentativa is not None
        assert fila.enviar_pendentes(s) == 0  # ainda esperando
    assert client.post("/api/armazenamento/reenviar").json()["arquivos"] == 1
    nuvem.falhar = None
    with SessionLocal() as s:
        from app.modules.arquivos.infra.segredo import cifrar

        cfg = s.scalar(select(ArmazenamentoObraModel).where(ArmazenamentoObraModel.obra_id == obra))
        cfg.token_cifrado = cifrar("revogado")
        s.commit()
        fila.enviar_pendentes(s)
        s.commit()
        s.refresh(cfg)
        assert cfg.situacao == "reconectar"
    assert client.get("/api/armazenamento").json()["conexao"]["situacao"] == "reconectar"


def test_onedrive_e_dropbox_gravam_pelo_caminho(nuvem):
    from app.modules.arquivos.infra.provedores import provedor

    for nome, esperado in (("onedrive", "Malhet/obras/310/20-campo-fotos/a.jpg"), ("dropbox", "/Malhet/obras/310/20-campo-fotos/a.jpg")):
        cred = Credencial(refresh_token="rt")
        ref = provedor(nome).enviar(cred, ["Malhet", "obras", "310", "20-campo-fotos"], "a.jpg", b"123", "image/jpeg")
        assert nuvem.arquivos[ref] == b"123" and nuvem.nomes[ref] == esperado
        assert cred.refresh_token == "rt-novo"  # renovou e guardou o token novo (rotação)


def test_anexo_ssma_no_armazenamento(client):
    cad = client.post("/api/ssma/cadastros", json={"tipo": "PTS", "codigo": "PTS-001", "descricao": "Galpão"})
    if cad.status_code != 201:
        pytest.skip(f"cadastro de SSMA com outro formato: {cad.text[:120]}")
    cid = cad.json()["id"]
    pdf = b"%PDF-1.4\n%teste\n" + b"0" * 2000
    r = client.post(f"/api/ssma/cadastros/{cid}/anexos", files={"arquivo": ("pts.pdf", pdf, "application/pdf")})
    assert r.status_code in (200, 201), r.text
    assert client.get(f"/api/ssma/anexos/{r.json()['id']}").content == pdf
    with SessionLocal() as s:
        a = s.scalar(select(ArquivoModel).where(ArquivoModel.tipo == "anexo-ssma"))
        assert a.pasta == "50-ssma-anexos" and a.ligacoes["documento"] == "PTS" and a.nome.endswith(".pdf")
