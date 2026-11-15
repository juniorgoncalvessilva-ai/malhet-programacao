"""Tutorial do primeiro acesso (spec 097): um passeio guiado por superfície (computador e celular), uma vez por conta.

A versão sobe quando o tutorial muda de verdade — quem viu a versão antiga vê o novo uma vez. Rever é sempre possível
pelo menu da conta (não depende do servidor).
"""
from app.shared.errors import DomainError

TUTORIAIS: dict[str, int] = {"computador": 1, "celular": 1}


def pendentes(vistos: dict | None) -> list[str]:
    """Tutoriais que a pessoa ainda não viu na versão atual."""
    v = vistos or {}
    return [k for k, versao in TUTORIAIS.items() if int((v.get(k) or {}).get("versao", 0)) < versao]


def marcar(vistos: dict | None, chave: str, concluido: bool, quando: str) -> dict:
    """Visto (concluído até o fim ou pulado) na versão atual; devolve um dicionário novo."""
    if chave not in TUTORIAIS:
        raise DomainError(f"tutorial desconhecido: {chave}", "chave")
    return {**(vistos or {}), chave: {"versao": TUTORIAIS[chave], "concluido": bool(concluido), "em": quando}}
