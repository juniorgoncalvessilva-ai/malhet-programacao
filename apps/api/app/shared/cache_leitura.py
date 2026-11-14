"""Calcular uma vez, servir a todos (spec 082, fase 3).

Leituras caras (a visão da programação) ficam guardadas como JSON pronto, com a chave (nome, obra, id, marca de
mudanças da obra). Qualquer gravação na obra muda a marca → a próxima leitura recalcula; nada fica velho. Regras:
- Só em rotas de LEITURA. Dentro de uma gravação a marca ainda não mudou mas os dados da sessão já — não use aqui.
- Guarda bytes: cada leitura recebe um dict novo (`json.loads`), ninguém altera o guardado por engano.
- Uma trava por chave: 100 pessoas abrindo ao mesmo tempo fazem 1 cálculo; as outras esperam e recebem o mesmo.
- Limite de memória (LRU) e validade máxima (rede de segurança para escrita que não passe pelo HTTP).
- A API roda em 1 processo (ver `app/core/mudancas.py`); com mais processos cada um tem o seu cache, ainda correto.
"""
import hashlib
import json
import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from typing import Any

from fastapi import Request, Response
from fastapi.encoders import jsonable_encoder

from app.core.mudancas import marca

LIMITE_BYTES = 48 * 1024 * 1024
VALIDADE_S = 600

_guardado: "OrderedDict[tuple, tuple[float, bytes]]" = OrderedDict()
_total = 0
_trava_geral = threading.Lock()
_travas: dict[tuple, threading.Lock] = {}
estatistica = {"acertos": 0, "calculos": 0}


def _chave(nome: str, obra_id: int, ident: Any) -> tuple:
    return (nome, obra_id, ident, marca(obra_id))


def _ler(k: tuple) -> bytes | None:
    with _trava_geral:
        x = _guardado.get(k)
        if x is None:
            return None
        if time.monotonic() - x[0] > VALIDADE_S:
            _tirar(k)
            return None
        _guardado.move_to_end(k)
        return x[1]


def _tirar(k: tuple) -> None:
    global _total
    x = _guardado.pop(k, None)
    if x is not None:
        _total -= len(x[1])


def _gravar(k: tuple, dados: bytes) -> None:
    global _total
    with _trava_geral:
        # versões antigas da mesma leitura (marca anterior) não servem mais
        for velho in [x for x in _guardado if x[:3] == k[:3] and x != k]:
            _tirar(velho)
        _tirar(k)
        _guardado[k] = (time.monotonic(), dados)
        _total += len(dados)
        while _total > LIMITE_BYTES and _guardado:
            _tirar(next(iter(_guardado)))


def json_em_cache(nome: str, obra_id: int, ident: Any, calcular: Callable[[], Any]) -> tuple[bytes, str]:
    """(JSON, etag) da leitura; calcula só se a marca da obra mudou desde a última vez."""
    k = _chave(nome, obra_id, ident)
    etag = '"' + hashlib.sha1(repr(k).encode()).hexdigest()[:20] + '"'
    dados = _ler(k)
    if dados is not None:
        estatistica["acertos"] += 1
        return dados, etag
    with _trava_geral:
        trava = _travas.setdefault(k[:3], threading.Lock())
    with trava:
        dados = _ler(k)  # outro pedido pode ter calculado enquanto este esperava
        if dados is not None:
            estatistica["acertos"] += 1
            return dados, etag
        dados = json.dumps(jsonable_encoder(calcular()), ensure_ascii=False, separators=(",", ":")).encode()
        estatistica["calculos"] += 1
        _gravar(k, dados)
        return dados, etag


def dict_em_cache(nome: str, obra_id: int, ident: Any, calcular: Callable[[], Any]) -> Any:
    """Cópia nova (dict) da leitura guardada — para rotas de leitura que montam outra resposta a partir dela."""
    return json.loads(json_em_cache(nome, obra_id, ident, calcular)[0])


def resposta_em_cache(request: Request, nome: str, obra_id: int, ident: Any, calcular: Callable[[], Any]) -> Response:
    """Resposta HTTP com ETag: o navegador que já tem a mesma versão recebe 304 sem corpo."""
    dados, etag = json_em_cache(nome, obra_id, ident, calcular)
    cab = {"ETag": etag, "Cache-Control": "private, no-cache"}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=cab)
    return Response(content=dados, media_type="application/json", headers=cab)


def limpar() -> None:
    global _total
    with _trava_geral:
        _guardado.clear()
        _travas.clear()
        _total = 0
