"""WBS de execução da obra: Área (CWA) → CWP (elemento + complemento) → Grupo (catálogo) → IWP (item da PQ).

É a estrutura onde a programação detalha o que o cronograma não detalha (ou não tem). Código do nó:
    004.05 › 01 › 2 › 03   (CWA, nº do CWP na área, nº do grupo no catálogo, nº do IWP no grupo)
O CWP vira o texto complementar do Simova: "Concreto fck 30 - (Radier - Eixo A–B)".
"""
from dataclasses import dataclass

from app.shared.errors import DomainError

TIPOS = ("area", "cwp", "grupo", "iwp")
PAI_DE = {"area": None, "cwp": "area", "grupo": "cwp", "iwp": "grupo"}
ROTULO = {"area": "Área", "cwp": "CWP", "grupo": "Grupo", "iwp": "IWP"}


def validar_tipo(tipo: str, tipo_pai: str | None) -> None:
    if tipo not in TIPOS:
        raise DomainError(f"tipo de nó inválido: {tipo}", "tipo")
    esperado = PAI_DE[tipo]
    if esperado != tipo_pai:
        if esperado is None:
            raise DomainError("a área é o primeiro nível (não tem pai)", "pai_id")
        raise DomainError(f"{ROTULO[tipo]} fica abaixo de {ROTULO[esperado]}", "pai_id")


def _texto(v: str | None) -> str:
    return " ".join((v or "").split())


def validar_cwp(elemento: str | None, complemento: str | None) -> tuple[str, str | None]:
    e, c = _texto(elemento), _texto(complemento)
    if len(e) < 2 or len(e) > 80:
        raise DomainError("CWP: escreva o elemento (ex.: Radier), de 2 a 80 caracteres", "elemento")
    if len(c) > 120:
        raise DomainError("complemento do CWP: até 120 caracteres", "complemento")
    return e, c or None


def texto_cwp(elemento: str | None, complemento: str | None) -> str:
    """'Radier' + 'Eixo A–B' → 'Radier - Eixo A–B' (texto complementar do Simova)."""
    e, c = _texto(elemento), _texto(complemento)
    return f"{e} - {c}" if c else e


def validar_quantidade(q: float | None) -> float | None:
    if q is not None and q < 0:
        raise DomainError("quantidade não pode ser negativa", "quantidade")
    return q


def seq_texto(tipo: str, seq: int) -> str:
    return f"{seq:02d}" if tipo in ("cwp", "iwp") else str(seq)


@dataclass(frozen=True)
class CodigoNo:
    codigo: str  # 004.05-01-2-03
    caminho: str  # 004.05 Galpão › Radier - Eixo A–B › Concreto › 1.8.3.1.2


def juntar(partes: list[str]) -> str:
    return "-".join(partes)
