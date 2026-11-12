"""Plano de 90 dias (look-ahead da obra), 6 semanas (make-ready) e pull planning.

O plano guarda as atividades *pensadas* para os próximos 90 dias (13 semanas): área, IWP da WBS (ou área + tipo do
catálogo), equipe, janela (início/fim), quantidade e o marco que a puxa. Antes de ir para a programação mensal/semanal
a atividade passa pela análise de restrições (6WLA): cada restrição levantada vira uma ação no Plano de Ação; a
atividade só fica *liberada* quando a análise foi feita e não há restrição pendente.

Situação do item (derivada, nunca gravada):
    programado   → já foi migrado para alguma programação
    restricao    → tem restrição pendente
    liberado     → analisado e sem restrição pendente
    analisar     → ainda não passou pela análise de restrições
"""
from dataclasses import dataclass
from datetime import date, timedelta

from app.shared.errors import DomainError
from app.shared.memoria import Fonte, Memoria, Passo, num

SEMANAS_90 = 13
SEMANAS_6 = 6
MAX_DIAS = 400


def segunda(d: date) -> date:
    return d - timedelta(days=d.weekday())


def semanas(inicio: date, n: int = SEMANAS_90) -> list[tuple[date, date]]:
    """n semanas (segunda a domingo) a partir da semana de `inicio`."""
    s0 = segunda(inicio)
    return [(s0 + timedelta(weeks=i), s0 + timedelta(weeks=i, days=6)) for i in range(n)]


def validar_janela(inicio: date | None, fim: date | None) -> tuple[date, date]:
    if inicio is None or fim is None:
        raise DomainError("informe o início e o fim da atividade no plano", "inicio")
    if fim < inicio:
        raise DomainError("o fim vem depois do início", "fim")
    if (fim - inicio).days > MAX_DIAS:
        raise DomainError(f"janela de até {MAX_DIAS} dias", "fim")
    return inicio, fim


def validar_quantidade(q: float | None) -> float | None:
    if q is not None and q < 0:
        raise DomainError("quantidade não pode ser negativa", "quantidade")
    return q


def validar_descricao(t: str | None) -> str:
    d = " ".join((t or "").split())
    if len(d) < 3:
        raise DomainError("descreva a atividade (mín. 3 caracteres)", "descricao")
    return d[:300]


def situacao(analisado: bool, pendentes: int, migrado: bool) -> str:
    if migrado:
        return "programado"
    if pendentes:
        return "restricao"
    return "liberado" if analisado else "analisar"


ROTULO = {"analisar": "A analisar", "restricao": "Com restrição", "liberado": "Liberado", "programado": "Programado"}


def sobrepoe(a_ini: date, a_fim: date, b_ini: date, b_fim: date) -> bool:
    return a_ini <= b_fim and b_ini <= a_fim


@dataclass(frozen=True)
class Proporcao:
    dias_item: int
    dias_no_periodo: int
    quantidade: float | None
    sugerida: float | None


def qtd_no_periodo(inicio: date, fim: date, quantidade: float | None, p_ini: date, p_fim: date) -> Proporcao:
    """Quantidade do item que cai no período da programação, proporcional aos dias corridos da janela."""
    dias = (fim - inicio).days + 1
    ini, fi = max(inicio, p_ini), min(fim, p_fim)
    dentro = max(0, (fi - ini).days + 1)
    sug = None if quantidade is None else round(quantidade * dentro / dias, 4)
    return Proporcao(dias, dentro, quantidade, sug)


def memoria_qtd(codigo: str, unid: str | None, inicio: date, fim: date, pr: Proporcao, p_titulo: str,
                p_ini: date, p_fim: date) -> Memoria:
    u = f" {unid}" if unid else ""
    return Memoria(
        chave=f"qtd-{codigo}", titulo=f"Quantidade sugerida de {codigo} em {p_titulo}", valor=f"{num(pr.sugerida)}{u}",
        formula="quantidade do plano × dias da janela dentro do período ÷ dias da janela (dias corridos)",
        passos=(Passo("Dias da janela", f"{inicio:%d/%m} a {fim:%d/%m}", f"{pr.dias_item} dias"),
                Passo("Dias dentro do período", f"{max(inicio, p_ini):%d/%m} a {min(fim, p_fim):%d/%m}", f"{pr.dias_no_periodo} dias"),
                Passo("Quantidade no período", f"{num(pr.quantidade)} × {pr.dias_no_periodo} ÷ {pr.dias_item}", f"{num(pr.sugerida)}{u}", True)),
        fontes=(Fonte("Quantidade", f"{num(pr.quantidade)}{u}", "Plano de 90 dias", f"item {codigo} · campo Quantidade"),
                Fonte("Janela", f"{inicio:%d/%m/%Y} a {fim:%d/%m/%Y}", "Plano de 90 dias", f"item {codigo} · início/fim"),
                Fonte("Período", f"{p_ini:%d/%m/%Y} a {p_fim:%d/%m/%Y}", "Programação", p_titulo)))


def codigo_item(numero: int) -> str:
    return f"P90-{numero:04d}"
