"""ASOs e treinamentos (spec 088): validade, exigência por função, matriz pessoa × treinamento e indicadores.

Regras:
- Validade: VALIDO até `valido_ate`; VENCENDO quando faltam até `janela` dias (padrão 30); VENCIDO depois; FALTANDO
  quando o treinamento é exigido e a pessoa não tem registro. Treinamento com validade 0 meses não vence.
- ASO vigente = o mais recente (pela data do exame) que não seja demissional. A pessoa está APTA pelo ASO quando o
  vigente é APTO ou APTO_COM_RESTRICAO e está válido.
- Exigido de uma pessoa = treinamentos marcados "todos" + os da função dela (chave da função do efetivo).
- Impedida = ASO inválido (sem, inapto ou vencido) ou algum treinamento **impeditivo** exigido faltando ou vencido.
- Só o resultado do ASO é guardado (obrigação legal, NR-7) — nunca diagnóstico.
"""
from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date
from enum import StrEnum

from app.shared.errors import DomainError
from app.shared.memoria import Fonte, Memoria, Passo, num

JANELA_PADRAO = 30


class TipoAso(StrEnum):
    ADMISSIONAL = "ADMISSIONAL"
    PERIODICO = "PERIODICO"
    MUDANCA_FUNCAO = "MUDANCA_FUNCAO"
    RETORNO = "RETORNO"
    DEMISSIONAL = "DEMISSIONAL"

    @property
    def rotulo(self) -> str:
        return {"ADMISSIONAL": "Admissional", "PERIODICO": "Periódico", "MUDANCA_FUNCAO": "Mudança de função",
                "RETORNO": "Retorno ao trabalho", "DEMISSIONAL": "Demissional"}[self.value]


class ResultadoAso(StrEnum):
    APTO = "APTO"
    APTO_COM_RESTRICAO = "APTO_COM_RESTRICAO"
    INAPTO = "INAPTO"

    @property
    def rotulo(self) -> str:
        return {"APTO": "Apto", "APTO_COM_RESTRICAO": "Apto com restrição", "INAPTO": "Inapto"}[self.value]


class Validade(StrEnum):
    VALIDO = "VALIDO"
    VENCENDO = "VENCENDO"
    VENCIDO = "VENCIDO"
    FALTANDO = "FALTANDO"

    @property
    def rotulo(self) -> str:
        return {"VALIDO": "Válido", "VENCENDO": "Vencendo", "VENCIDO": "Vencido", "FALTANDO": "Faltando"}[self.value]


def somar_meses(d: date, meses: int) -> date:
    m = d.month - 1 + meses
    ano, mes = d.year + m // 12, m % 12 + 1
    return date(ano, mes, min(d.day, calendar.monthrange(ano, mes)[1]))


def valido_ate_padrao(realizado_em: date, validade_meses: int) -> date | None:
    """Fim da validade pelo catálogo; None = não vence."""
    return somar_meses(realizado_em, validade_meses) if validade_meses > 0 else None


def situacao_validade(valido_ate: date | None, hoje: date, janela: int = JANELA_PADRAO) -> Validade:
    if valido_ate is None:
        return Validade.VALIDO
    if valido_ate < hoje:
        return Validade.VENCIDO
    return Validade.VENCENDO if (valido_ate - hoje).days <= janela else Validade.VALIDO


@dataclass(frozen=True)
class Treinamento:
    id: int
    nome: str
    validade_meses: int = 12
    impeditivo: bool = False
    todos: bool = False  # exigido de todo o efetivo (ex.: integração)
    norma: str | None = None
    carga_horaria: float | None = None

    def __post_init__(self) -> None:
        if not self.nome.strip():
            raise DomainError("informe o nome do treinamento", "nome")
        if not 0 <= self.validade_meses <= 120:
            raise DomainError("validade entre 0 (não vence) e 120 meses", "validade_meses")
        if self.carga_horaria is not None and not 0 < self.carga_horaria <= 400:
            raise DomainError("carga horária entre 0 e 400 h", "carga_horaria")


@dataclass(frozen=True)
class Aso:
    tipo: TipoAso
    data_exame: date
    valido_ate: date
    resultado: ResultadoAso

    def __post_init__(self) -> None:
        if self.valido_ate < self.data_exame:
            raise DomainError("a validade do ASO não pode ser antes do exame", "valido_ate")


def aso_vigente(asos: list[Aso]) -> Aso | None:
    validos = [a for a in asos if a.tipo != TipoAso.DEMISSIONAL]
    return max(validos, key=lambda a: a.data_exame) if validos else None


def situacao_aso(asos: list[Aso], hoje: date, janela: int = JANELA_PADRAO) -> tuple[Validade, Aso | None]:
    """FALTANDO sem ASO; VENCIDO também quando o vigente é INAPTO (não libera)."""
    v = aso_vigente(asos)
    if v is None:
        return Validade.FALTANDO, None
    if v.resultado == ResultadoAso.INAPTO:
        return Validade.VENCIDO, v
    return situacao_validade(v.valido_ate, hoje, janela), v


@dataclass(frozen=True)
class Registro:
    """Pessoa fez o treinamento em `realizado_em`; vale até `valido_ate` (None = não vence)."""
    treinamento_id: int
    realizado_em: date
    valido_ate: date | None


def exigidos(treinamentos: list[Treinamento], por_funcao: dict[str, set[int]], funcao_chave: str | None) -> list[Treinamento]:
    ids = por_funcao.get(funcao_chave or "", set())
    return [t for t in treinamentos if t.todos or t.id in ids]


def melhor_registro(registros: list[Registro], treinamento_id: int) -> Registro | None:
    """O que vale mais longe (None = não vence ganha)."""
    rs = [r for r in registros if r.treinamento_id == treinamento_id]
    if not rs:
        return None
    return max(rs, key=lambda r: (r.valido_ate is None, r.valido_ate or date.min, r.realizado_em))


@dataclass(frozen=True)
class Celula:
    treinamento_id: int
    situacao: Validade
    valido_ate: date | None
    realizado_em: date | None
    impeditivo: bool


@dataclass(frozen=True)
class Aptidao:
    aso: Validade
    aso_vigente: Aso | None
    celulas: tuple[Celula, ...]

    @property
    def pendencias(self) -> list[Celula]:
        return [c for c in self.celulas if c.situacao in (Validade.FALTANDO, Validade.VENCIDO)]

    @property
    def impedimentos(self) -> list[str]:
        out = []
        if self.aso in (Validade.FALTANDO, Validade.VENCIDO):
            out.append("ASO " + ("inapto" if self.aso_vigente and self.aso_vigente.resultado == ResultadoAso.INAPTO
                                 else self.aso.rotulo.lower()))
        out += [f"{c.treinamento_id}" for c in self.pendencias if c.impeditivo]
        return out

    @property
    def impedida(self) -> bool:
        return bool(self.impedimentos)

    @property
    def aso_libera(self) -> bool:
        return self.aso in (Validade.VALIDO, Validade.VENCENDO)


def aptidao(asos: list[Aso], registros: list[Registro], exigidos_: list[Treinamento], hoje: date,
            janela: int = JANELA_PADRAO) -> Aptidao:
    sa, vig = situacao_aso(asos, hoje, janela)
    cel = []
    for t in exigidos_:
        r = melhor_registro(registros, t.id)
        sit = Validade.FALTANDO if r is None else situacao_validade(r.valido_ate, hoje, janela)
        cel.append(Celula(t.id, sit, r.valido_ate if r else None, r.realizado_em if r else None, t.impeditivo))
    return Aptidao(sa, vig, tuple(cel))


@dataclass(frozen=True)
class PessoaApta:
    nome: str
    aptidao: Aptidao


def _pct(a: int, b: int) -> str:
    return f"{num(100 * a / b, 1)}%" if b else "—"


def indicadores(pessoas: list[PessoaApta], nomes_trein: dict[int, str], hoje: date, janela: int = JANELA_PADRAO) -> dict:
    """Números da aba Métricas, cada um com a memória (quem entrou na conta)."""
    n = len(pessoas)
    cont = {v: [p.nome for p in pessoas if p.aptidao.aso == v] for v in Validade}
    cel = [(p.nome, c) for p in pessoas for c in p.aptidao.celulas]
    ccont = {v: [(nm, c) for nm, c in cel if c.situacao == v] for v in Validade}
    impedidas = [p for p in pessoas if p.aptidao.impedida]
    conformes = [p for p in pessoas if p.aptidao.aso_libera and not p.aptidao.pendencias]

    def lista(nomes: list[str]) -> tuple[Fonte, ...]:
        return tuple(Fonte(nm, "", "efetivo ativo e em mobilização") for nm in nomes[:60])

    def m_aso(v: Validade, titulo: str) -> Memoria:
        return Memoria(chave=f"aso_{v.value.lower()}", titulo=titulo, valor=str(len(cont[v])),
                       formula=f"pessoas cujo ASO vigente está {v.rotulo.lower()} (janela de {janela} dias, hoje {hoje:%d/%m/%Y})",
                       passos=(Passo("Pessoas consideradas", "ativos + em mobilização", str(n)),
                               Passo(v.rotulo, "contagem", str(len(cont[v])), True)), fontes=lista(cont[v]))

    def m_tr(v: Validade, titulo: str) -> Memoria:
        itens = ccont[v]
        return Memoria(chave=f"tr_{v.value.lower()}", titulo=titulo, valor=str(len(itens)),
                       formula="pares pessoa × treinamento exigido nessa situação (exigido = 'todos' + os da função)",
                       passos=(Passo("Exigências avaliadas", "pessoas × treinamentos exigidos", str(len(cel))),
                               Passo(v.rotulo, "contagem", str(len(itens)), True)),
                       fontes=tuple(Fonte(nm, nomes_trein.get(c.treinamento_id, str(c.treinamento_id)),
                                          "registro de treinamento", f"vale até {c.valido_ate:%d/%m/%Y}" if c.valido_ate else None)
                                    for nm, c in itens[:60]))

    mem = [
        m_aso(Validade.VALIDO, "ASOs válidos"), m_aso(Validade.VENCENDO, f"ASOs vencendo em {janela} dias"),
        m_aso(Validade.VENCIDO, "ASOs vencidos ou inaptos"), m_aso(Validade.FALTANDO, "Pessoas sem ASO"),
        m_tr(Validade.VALIDO, "Treinamentos válidos"), m_tr(Validade.VENCENDO, f"Treinamentos vencendo em {janela} dias"),
        m_tr(Validade.VENCIDO, "Treinamentos vencidos"), m_tr(Validade.FALTANDO, "Treinamentos faltando"),
        Memoria(chave="impedidas", titulo="Pessoas impedidas", valor=str(len(impedidas)),
                formula="ASO sem/inapto/vencido ou treinamento impeditivo faltando/vencido",
                passos=(Passo("Pessoas consideradas", "", str(n)), Passo("Impedidas", "contagem", str(len(impedidas)), True)),
                fontes=tuple(Fonte(p.nome, ", ".join(_nomes(p.aptidao, nomes_trein)), "aptidão") for p in impedidas[:60])),
        Memoria(chave="conformidade", titulo="Conformidade", valor=_pct(len(conformes), n),
                formula="pessoas com ASO liberado e todos os treinamentos exigidos em dia ÷ pessoas consideradas",
                passos=(Passo("Em dia", "ASO válido/vencendo e nenhum treinamento faltando/vencido", str(len(conformes))),
                        Passo("Conformidade", f"{len(conformes)} ÷ {n}", _pct(len(conformes), n), True))),
    ]
    return {m.chave: m for m in mem}


def _nomes(a: Aptidao, nomes_trein: dict[int, str]) -> list[str]:
    out = [i for i in a.impedimentos if i.startswith("ASO")]
    out += [nomes_trein.get(c.treinamento_id, str(c.treinamento_id)) for c in a.pendencias if c.impeditivo]
    return out


def descrever_impedimentos(a: Aptidao, nomes_trein: dict[int, str]) -> list[str]:
    return _nomes(a, nomes_trein)
