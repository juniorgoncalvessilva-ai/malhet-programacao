"""WBS do cronograma (P6) → WBS de execução.

Caminho do P6:  O.S. 1 › CWP - CONSTRUÇÃO › CWA 004 - Novo CMD › CWA 004.05 - ED-1800AA-01 - Galpão… › Sapatas › Fustes
                                                                    └ área (CWA 004.05)              └ CWP: elemento "Sapatas", complemento "Fustes"
A atividade (C-12360 "Escavação mecanizada…") vira IWP quando a descrição dela é a de um item da PQ (desempate pela
área da TAG, como no take-off) e o item está num grupo do Catálogo.
Só os ramos de construção (nível que começa com "CWP") entram; EWP/PWP (engenharia, suprimentos) ficam de fora.
"""
import re
import unicodedata
from dataclasses import dataclass

_CWA = re.compile(r"\bCWA\s*([0-9]{3}\.[0-9]{2})\b", re.I)
GERAL = "Geral"


def _sem_acento(t: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn")


def normalizar_descricao(t: str | None) -> str:
    """Igualdade de descrição: sem caixa, acento, espaços repetidos e pontuação final."""
    return re.sub(r"\s+", " ", _sem_acento(t or "")).strip(" .;,").lower()


def chave(partes: list[str]) -> str:
    return " / ".join(normalizar_descricao(p) for p in partes)[:400]


@dataclass(frozen=True)
class CaminhoP6:
    cwa: str  # 004.05
    nome_cwa: str  # CWA 004.05 - ED-1800AA-01 - Galpão de Resíduos Classe II
    elemento: str
    complemento: str | None
    chave: str  # chave do CWP: cwa + níveis abaixo dele


def ler_caminho(nomes: list[str]) -> CaminhoP6 | None:
    """None quando o ramo não é de construção (sem nível "CWP…") ou não tem CWA com área (004.05)."""
    if not any(n.strip().upper().startswith("CWP") for n in nomes):
        return None
    idx = None
    for i, n in enumerate(nomes):
        if _CWA.search(n):
            idx = i
    if idx is None:
        return None
    cwa = _CWA.search(nomes[idx]).group(1)
    resto = [" ".join(n.split()) for n in nomes[idx + 1:] if n and n.strip()]
    elemento = (resto[0] if resto else GERAL)[:80]
    complemento = (" / ".join(resto[1:])[:120] or None) if len(resto) > 1 else None
    return CaminhoP6(cwa, nomes[idx], elemento, complemento, chave([cwa, *resto]))


def escolher_area(cwa: str, nome_cwa: str, areas: list[tuple[int, str, str | None]]) -> int | None:
    """areas = (id, cwa, ativo). CWA repetido na obra: vale a área cujo Ativo aparece no nome do nível do P6."""
    cands = [a for a in areas if a[1] == cwa]
    if len(cands) <= 1:
        return cands[0][0] if cands else None
    nome = re.sub(r"\s+", "", nome_cwa.upper())
    com_ativo = [a for a in cands if a[2] and re.sub(r"\s+", "", a[2].upper()) in nome]
    return (com_ativo or cands)[0][0]
