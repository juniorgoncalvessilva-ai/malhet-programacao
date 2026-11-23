"""Partes da obra e responsáveis (spec 139): a gerência de uma ação, desvio ou restrição é sempre uma das quatro partes —
CONTRATADA, CONTRATANTE, FISCALIZAÇÃO, PROJETOS — com o nome da empresa ("CONTRATADA - CARDAN"); o responsável é uma pessoa
cadastrada numa delas (da contratada, uma pessoa do efetivo; das outras, digitada). Assim os gráficos por gerência e por
responsável não se dividem em grafias diferentes da mesma coisa."""
import re
import unicodedata
from dataclasses import dataclass

from app.shared.errors import DomainError

PAPEIS: dict[str, str] = {"contratada": "CONTRATADA", "contratante": "CONTRATANTE", "fiscalizacao": "FISCALIZAÇÃO",
                          "projetos": "PROJETOS"}


def validar_papel(papel: str) -> str:
    if papel not in PAPEIS:
        raise DomainError(f"parte: {', '.join(PAPEIS)}", "papel")
    return papel


def nome_limpo(nome: str | None, campo: str = "nome", maximo: int = 80) -> str:
    n = " ".join((nome or "").split())
    if len(n) < 2:
        raise DomainError("escreva o nome", campo)
    return n[:maximo]


def gerencia(papel: str, nome: str | None) -> str:
    """O texto padronizado da gerência: "CONTRATADA - CARDAN" (sem nome: só a parte)."""
    rot = PAPEIS[validar_papel(papel)]
    return f"{rot} - {nome.strip().upper()}" if nome and nome.strip() else rot


@dataclass(frozen=True)
class Parte:
    papel: str
    nome: str | None

    def __post_init__(self):
        validar_papel(self.papel)

    @property
    def rotulo(self) -> str:
        return PAPEIS[self.papel]

    @property
    def gerencia(self) -> str:
        return gerencia(self.papel, self.nome)


SINONIMOS = {"contratada": ("CONTRATADA",), "contratante": ("CONTRATANTE", "CLIENTE"),
             "fiscalizacao": ("FISCALIZACAO", "FISCAL", "GERENCIADORA"), "projetos": ("PROJETOS", "PROJETO", "PROJETISTA")}


def _n(t: str | None) -> str:
    s = unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().upper()
    return " ".join(re.sub(r"[^A-Z0-9]+", " ", s).split())


def casar_gerencia(texto: str | None, partes: list[Parte]) -> str | None:
    """A gerência padronizada para um texto antigo ("CARDAN", "Cliente", "vale ") — só quando uma parte casa sozinha: pelo
    nome da empresa (palavra inteira) ou pelo papel. Já padronizado ou ambíguo = None (fica como está)."""
    t = _n(texto)
    if not t or any(t == _n(p.gerencia) for p in partes):
        return None
    achadas = [p for p in partes if p.nome and f" {_n(p.nome)} " in f" {t} "]
    if not achadas:
        achadas = [p for p in partes if any(f" {x} " in f" {t} " for x in SINONIMOS[p.papel])]
    return achadas[0].gerencia if len(achadas) == 1 else None
