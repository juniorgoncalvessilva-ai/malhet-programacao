"""Catálogo de atividades para o encarregado: Grupo → Tipo → Item Simova.

ID único Simova (só números): `g.t` (tipo) ou `g.t.n` (tipo + texto complementar).
  2      Concreto                                  (grupo)
  2.3    Concreto 20 MPa                           (tipo)
  2.3.1  Concreto 20 MPa - (Fundo canaleta 2A)     (item com complemento)
O ID é calculado dos números, então renumerar/renomear um grupo ou tipo vale para o app inteiro.
"""
import re

from app.shared.errors import DomainError


def codigo_tipo(grupo: int, tipo: int) -> str:
    return f"{grupo}.{tipo}"


def codigo_item(grupo: int, tipo: int, item: int | None) -> str:
    return f"{grupo}.{tipo}.{item}" if item else codigo_tipo(grupo, tipo)


def limpar_texto(texto: str | None) -> str:
    return " ".join((texto or "").split())


def chave_complemento(texto: str | None) -> str:
    """Igualdade de complemento ignora caixa, espaços e parênteses externos."""
    t = limpar_texto(texto).strip("() ").lower()
    return re.sub(r"\s+", " ", t)


def descricao_item(tipo: str, complemento: str | None) -> str:
    c = limpar_texto(complemento).strip("() ")
    return f"{limpar_texto(tipo)} - ({c})" if c else limpar_texto(tipo)


def validar_numero(n: int, campo: str) -> int:
    if not isinstance(n, int) or n < 1 or n > 9999:
        raise DomainError(f"{campo}: número inteiro de 1 a 9999", campo)
    return n


def validar_descricao(texto: str, campo: str = "descricao", maximo: int = 120) -> str:
    t = limpar_texto(texto)
    if len(t) < 2 or len(t) > maximo:
        raise DomainError(f"{campo}: de 2 a {maximo} caracteres", campo)
    return t


def proximo_numero(existentes: list[int]) -> int:
    return (max(existentes) if existentes else 0) + 1
