"""Memória de cálculo: todo número calculado mostrado na tela vem com a conta feita e a origem de cada dado.

    Memoria(chave="indice", titulo="Índice (un/dia por oficial)", valor="6,92 m³/dia",
            formula="índice = jornada ÷ h/un do recurso que governa",
            passos=[Passo("Pedreiro", "9 h ÷ 1,3 HH/m³", "6,92 m³/dia")],
            fontes=[Fonte("Jornada", "9 h", "Equipe EQUIPE.14_FORMA", "cadastro de Equipes")])

A tela abre a memória ao clicar no número (componente <Calculado>). Novos números calculados devem nascer com a
memória deles (regra do CLAUDE.md).
"""
from dataclasses import asdict, dataclass, field


def num(v: float | int | None, casas: int = 2) -> str:
    """Número no padrão brasileiro, sem zeros à direita: 4.658,3 · 6,92 · 1.234."""
    if v is None:
        return "—"
    t = f"{float(v):,.{casas}f}".replace(",", "§").replace(".", ",").replace("§", ".")
    if "," in t:
        t = t.rstrip("0").rstrip(",")
    return t


@dataclass(frozen=True)
class Fonte:
    """De onde veio um dado: o valor, o documento/cadastro e o lugar exato nele (linha, aba, campo)."""
    dado: str
    valor: str
    origem: str
    local: str | None = None


@dataclass(frozen=True)
class Passo:
    descricao: str
    conta: str
    resultado: str
    destaque: bool = False


@dataclass(frozen=True)
class Memoria:
    chave: str
    titulo: str
    valor: str
    formula: str
    passos: tuple[Passo, ...] = ()
    fontes: tuple[Fonte, ...] = ()
    notas: tuple[str, ...] = field(default_factory=tuple)

    def como_dict(self) -> dict:
        return asdict(self)


def pacote(*memorias: Memoria | None) -> dict:
    """{"memorias": {chave: memória}} — formato único das rotas de memória de cálculo."""
    return {"memorias": {m.chave: m.como_dict() for m in memorias if m is not None}}
