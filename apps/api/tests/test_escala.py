"""Spec 082: a API não pode congelar com o pool do banco cheio.

Uma função `async` (rota ou dependência) que usa a Session síncrona espera a conexão do pool *dentro do loop*: com o
pool cheio, o servidor inteiro para (inclusive o login) e não se recupera. Aqui: (1) nenhuma rota/dependência async usa
a Session, e (2) mais requisições simultâneas que conexões no pool terminam todas, rápido.
"""
import asyncio
import inspect
import threading
import time

import httpx
from fastapi.routing import APIRoute

from app.core.db import engine, get_session
from app.main import app

# Exceções conscientes: rota rara de administrador que chama o auth-kit (async) e o banco.
EXCECOES = {"app.modules.obras.api.router.conceder"}


def _rotas(rotas) -> list[APIRoute]:
    """Todas as rotas, inclusive as dos routers incluídos (o FastAPI novo os guarda como `_IncludedRouter`)."""
    out = []
    for r in rotas:
        if isinstance(r, APIRoute):
            out.append(r)
        elif getattr(r, "original_router", None) is not None:
            out += _rotas(r.original_router.routes)
    return out


def _async_com_sessao(dep, caminho=()) -> list[str]:
    achados = []
    usa_sessao = any(d.call is get_session for d in dep.dependencies)
    if dep.call is not None and inspect.iscoroutinefunction(dep.call) and usa_sessao:
        achados.append(" → ".join([*caminho, getattr(dep.call, "__qualname__", str(dep.call))]))
    for d in dep.dependencies:
        achados += _async_com_sessao(d, (*caminho, getattr(dep.call, "__qualname__", "?")))
    return achados


def test_nenhuma_funcao_async_usa_a_sessao_do_banco():
    erros = []
    rotas = _rotas(app.routes)
    assert len(rotas) > 200  # a varredura enxerga os routers dos módulos
    for r in rotas:
        if f"{r.endpoint.__module__}.{r.endpoint.__qualname__}" in EXCECOES:
            continue
        erros += [f"{sorted(r.methods)} {r.path}: {x}" for x in _async_com_sessao(r.dependant)]
    assert not erros, "async + Session congela a API com o pool cheio (use def):\n" + "\n".join(erros)


def test_mais_requisicoes_que_conexoes_no_pool_nao_congela(client):
    obra = client.headers["X-Obra-Id"]
    n = engine.pool.size() + engine.pool._max_overflow + 20  # passa do pool de propósito

    async def rodar():
        transporte = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transporte, base_url="http://t", headers={"X-Obra-Id": obra}) as c:
            return await asyncio.wait_for(asyncio.gather(*[c.get("/api/notificacoes/contagem") for _ in range(n)]), 25)

    # numa thread com prazo: se o loop congelar, nem o wait_for dispara — o teste falha em vez de travar a suíte
    saida: list = []
    th = threading.Thread(target=lambda: saida.append(asyncio.run(rodar())), daemon=True)
    t = time.monotonic()
    th.start()
    th.join(30)
    assert saida, "a API congelou com o pool cheio"
    assert [x.status_code for x in saida[0]] == [200] * n
    assert time.monotonic() - t < 15


def test_json_grande_vai_comprimido_e_imagem_nao(client):
    r = client.get("/openapi.json", headers={"Accept-Encoding": "gzip"})
    assert r.status_code == 200 and r.headers.get("content-encoding") == "gzip"
    assert r.json()["paths"]  # o cliente descomprime normalmente
    pequeno = client.get("/health", headers={"Accept-Encoding": "gzip"})
    assert pequeno.headers.get("content-encoding") is None  # abaixo de 1000 bytes não compensa


def test_visao_calculada_uma_vez_por_mudanca_e_304(client):
    from app.shared import cache_leitura
    from tests.test_excluir_revisao import _programacao

    pid = _programacao(client)
    antes = cache_leitura.estatistica["calculos"]
    r1 = client.get(f"/api/programacoes/{pid}")
    r2 = client.get(f"/api/programacoes/{pid}")
    assert r1.json() == r2.json() and cache_leitura.estatistica["calculos"] == antes + 1  # a segunda veio pronta
    etag = r1.headers["etag"]
    assert client.get(f"/api/programacoes/{pid}", headers={"If-None-Match": etag}).status_code == 304
    # gravação na obra muda a marca: a próxima leitura recalcula e já traz o dado novo
    lid = r1.json()["locais"][0]["areas"][0]["linhas"][0]["id"]
    client.put(f"/api/programacoes/{pid}/linhas/{lid}/valores", json={"campo": "previsto", "valores": [{"data": "2026-11-10", "valor": 7}]})
    r3 = client.get(f"/api/programacoes/{pid}", headers={"If-None-Match": etag})
    assert r3.status_code == 200 and r3.headers["etag"] != etag and cache_leitura.estatistica["calculos"] == antes + 2
    ln = r3.json()["locais"][0]["areas"][0]["linhas"][0]
    assert 7 in ln["previsto"]
    # o dia do campo usa a mesma conta guardada, sem recalcular
    client.get("/api/campo/dia", params={"data": "2026-11-10"})
    assert cache_leitura.estatistica["calculos"] == antes + 2


def test_muitos_ao_mesmo_tempo_fazem_um_calculo(client):
    from app.shared import cache_leitura
    from tests.test_excluir_revisao import _programacao

    pid = _programacao(client)
    obra = client.headers["X-Obra-Id"]
    antes = cache_leitura.estatistica["calculos"]

    async def rodar():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t", headers={"X-Obra-Id": obra}) as c:
            return await asyncio.gather(*[c.get(f"/api/programacoes/{pid}") for _ in range(25)])

    rs = asyncio.run(rodar())
    assert {x.status_code for x in rs} == {200} and len({x.content for x in rs}) == 1
    assert cache_leitura.estatistica["calculos"] == antes + 1
