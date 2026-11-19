"""6WLA — Sessão de Look Ahead em Excel, no layout da obra (planilha "CRONOGRAMA 6WLA") — spec 108.

Linhas: as atividades do cronograma vigente (P6) que cruzam a janela (semana corrente + 1ª a 6ª semana), na estrutura
da WBS do P6 (cada nível vira uma linha-título com início/fim/avanço dos filhos), mais as atividades do Plano de 90
dias que não vêm do cronograma (num grupo próprio). Semanas contadas a partir do domingo (`numero_semana`, a mesma
numeração da aba "Dados - Semanas").

Colunas 6M (Ishikawa): restrições do 6WLA da atividade por categoria — número de pendentes; 0 = havia restrição e já
foi resolvida; vazio = nenhuma restrição levantada.
"""
from dataclasses import dataclass, field
from datetime import date, timedelta

from app.modules.planejamento.domain.periodo import numero_semana

SEMANAS = 6  # 1ª a 6ª semana, além da corrente
SEIS_M = ("MET", "MDO", "MAT", "MAQ", "MED", "MAB")  # ordem das colunas: Método, Mão de obra, Material, Máquina, Medida, Meio ambiente
GRUPO_PLANO = ("~plano", "P90", "PLANO DE 90 DIAS — NO PLANO, FORA DO CRONOGRAMA NESTAS SEMANAS")


def domingo(d: date) -> date:
    return d - timedelta(days=(d.weekday() + 1) % 7)


@dataclass(frozen=True)
class Janela:
    inicio: date  # domingo da semana corrente
    fim: date  # sábado da 6ª semana
    corrente: int  # nº da semana corrente
    data_date: int  # nº da semana da data de status do cronograma (DD)

    @property
    def numeros(self) -> list[int]:
        return [self.corrente + i for i in range(SEMANAS + 1)]


def janela(referencia: date, data_status: date | None) -> Janela:
    ini = domingo(referencia)
    return Janela(ini, ini + timedelta(days=7 * (SEMANAS + 1) - 1), numero_semana(ini),
                  numero_semana(data_status) if data_status else numero_semana(ini))


@dataclass(frozen=True)
class Atividade:
    chave: str  # Activity ID (ou P90-0001 para o que só está no plano)
    nome: str
    niveis: tuple[tuple[str, str, str], ...]  # WBS do P6: (ordem, código, nome) da raiz até o pai
    inicio: date | None
    fim: date | None
    ordem: int = 0  # posição no P6
    pct: float | None = None  # avanço 0–1
    status: str | None = None
    bl_inicio: date | None = None
    bl_fim: date | None = None
    local: str | None = None
    restricoes: dict[str, tuple[int, int]] = field(default_factory=dict)  # 6M → (levantadas, pendentes)

    def cruza(self, j: Janela) -> bool:
        return bool(self.inicio and self.fim and self.inicio <= j.fim and self.fim >= j.inicio)

    @property
    def variacao(self) -> int | None:
        """Variance - BL Project Finish Date (dias), como no P6: término da linha de base − término atual (negativo = atraso)."""
        return (self.bl_fim - self.fim).days if self.bl_fim and self.fim else None

    def seis_m(self, cod: str) -> int | None:
        lev, pend = self.restricoes.get(cod, (0, 0))
        return pend if lev else None


@dataclass(frozen=True)
class Linha:
    tipo: str  # wbs | atividade
    nivel: int  # profundidade (0 = raiz da WBS)
    codigo: str  # coluna Activity ID (WBS: "código  nome", como no export do P6)
    nome: str  # coluna Activity Name
    inicio: date | None
    fim: date | None
    pct: float | None
    atividade: Atividade | None = None


def semanas_da_atividade(a: Atividade, j: Janela) -> list[bool]:
    """Para cada coluna de semana (corrente … 6ª): a atividade acontece nela? (a fórmula do Excel faz a mesma conta)."""
    if not (a.inicio and a.fim):
        return [False] * (SEMANAS + 1)
    si, sf = numero_semana(a.inicio), numero_semana(a.fim)
    return [si <= n <= sf for n in j.numeros]


def _media(ats: list[Atividade]) -> float | None:
    """Avanço da linha-título: média dos filhos ponderada pela duração (como o resumo do P6 por duração)."""
    pesos = [(max(1, (a.fim - a.inicio).days + 1) if a.inicio and a.fim else 1, a.pct) for a in ats if a.pct is not None]
    total = sum(p for p, _ in pesos)
    return sum(p * v for p, v in pesos) / total if total else None


def montar(atividades: list[Atividade], j: Janela) -> list[Linha]:
    """Linhas do 6WLA: só o que cruza a janela, agrupado pela WBS (títulos com início/fim/avanço dos filhos)."""
    dentro = sorted((a for a in atividades if a.cruza(j)),
                    key=lambda a: (tuple(n[0] for n in a.niveis), a.ordem, a.inicio or date.min, a.chave))
    out: list[Linha] = []
    abertos: tuple[str, ...] = ()
    for a in dentro:
        caminho = tuple(n[0] for n in a.niveis)
        comum = 0
        while comum < min(len(abertos), len(caminho)) and abertos[comum] == caminho[comum]:
            comum += 1
        for k in range(comum, len(a.niveis)):
            filhos = [x for x in dentro if tuple(n[0] for n in x.niveis)[:k + 1] == caminho[:k + 1]]
            _ordem, cod, nome = a.niveis[k]
            out.append(Linha("wbs", k, f"{cod}  {nome}".strip(), "",
                             min((x.inicio for x in filhos if x.inicio), default=None),
                             max((x.fim for x in filhos if x.fim), default=None), _media(filhos)))
        abertos = caminho
        out.append(Linha("atividade", len(a.niveis), a.chave, a.nome, a.inicio, a.fim, a.pct, a))
    return out


def codigo_wbs(niveis: list[dict] | None) -> tuple[tuple[str, str, str], ...]:
    """wbs_niveis do XER → (ordem, código acumulado "5.1.11", nome) por nível."""
    out, acc = [], []
    for n in niveis or []:
        acc.append(str(n.get("codigo") or "").strip())
        out.append((str(n.get("ordem") or ""), ".".join(x for x in acc if x), str(n.get("nome") or "").strip()))
    return tuple(out)
