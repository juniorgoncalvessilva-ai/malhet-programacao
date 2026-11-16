"""Numeração das revisões emitidas (spec 100): o super admin arruma os números para o documento impresso não sair com
"rev. 7" depois de várias emissões de teste. A ordem nunca muda — a revisão emitida depois continua com número maior
(é ela que vale como vigente) — e nenhum número se repete."""
from datetime import datetime

from app.shared.errors import DomainError

MAX_REVISAO = 999


def _cronologica(emissoes: list[tuple[int, datetime]]) -> list[int]:
    return [r for r, _ in sorted(emissoes, key=lambda x: (x[1], x[0]))]


def nova_numeracao(emissoes: list[tuple[int, datetime]], mapa: dict[int, int]) -> dict[int, int]:
    """emissoes = (revisão atual, emitida em); mapa = revisão atual → número novo (só as que mudam).
    Devolve o de-para completo (atual → final) ou levanta DomainError explicando o problema."""
    atuais = {r for r, _ in emissoes}
    for r, n in mapa.items():
        if r not in atuais:
            raise DomainError(f"a revisão {r} não existe nesta programação", "mapa")
        if not isinstance(n, int) or n < 0 or n > MAX_REVISAO:
            raise DomainError(f"número de revisão inválido: {n} (de 0 a {MAX_REVISAO})", "mapa")
    final = {r: mapa.get(r, r) for r in atuais}
    if len(set(final.values())) != len(final):
        repetido = next(n for n in final.values() if list(final.values()).count(n) > 1)
        raise DomainError(f"o número {repetido} ficaria em duas revisões", "mapa")
    ordem = _cronologica(emissoes)
    for antes, depois in zip(ordem, ordem[1:]):
        if final[depois] <= final[antes]:
            raise DomainError(f"a revisão emitida depois precisa ter número maior: rev. {antes} → {final[antes]} "
                              f"e rev. {depois} → {final[depois]}", "mapa")
    return final


def sequencial(emissoes: list[tuple[int, datetime]]) -> dict[int, int]:
    """0, 1, 2… na ordem em que foram emitidas (tira os buracos de revisões excluídas)."""
    return {r: i for i, r in enumerate(_cronologica(emissoes))}
