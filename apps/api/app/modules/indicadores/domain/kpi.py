"""Indicadores da programação × realizado × capacidade produtiva (sem I/O).

Unidade de medida = atividade programada: uma linha de uma programação (semana/mês), somando os dias.
- PPC                    = atividades cumpridas (realizado ≥ previsto) ÷ atividades programadas (previsto > 0)
- Aderência              = Σ realizado ÷ Σ previsto
- Carga × capacidade     = Σ previsto ÷ Σ capacidade (no período, na base da programação)
                           > 110 % sobre-programada · < 70 % sub-programada · entre os dois: na capacidade
- Erro de programação    = média de |previsto − capacidade| ÷ capacidade, por atividade
- Erro de previsão       = média de |realizado − previsto| ÷ previsto, por atividade (por modo: capacidade × manual)
- Realizado ÷ capacidade = Σ realizado ÷ Σ capacidade (produtividade real × a da CPU com a equipe programada)
- Eficiência de HH       = Σ (realizado × HH/un da CPU) ÷ Σ HH da equipe programada (pessoas × jornada × fator do dia)
Indicadores com realizado só usam programações concluídas.
"""
from dataclasses import dataclass, field

SOBRE, SUB = 1.10, 0.70
TOL = 0.005


@dataclass(frozen=True)
class FatoDia:
    programacao_id: int
    titulo: str
    linha_id: int | None
    n_linha: int
    semana: int
    concluida: bool
    modo: str
    previsto: float | None
    capacidade: float | None
    realizado: float | None
    hh_un: float | None
    hh_equipe: float | None
    encarregado: str | None
    equipe: str | None
    descricao: str
    codigo_simova: str | None
    unidade: str | None
    area: str | None
    grupo: str | None


@dataclass
class Atividade:
    chave: tuple
    programacao_id: int
    titulo: str
    n_linha: int
    semana: int
    concluida: bool
    modo: str
    encarregado: str | None
    equipe: str | None
    descricao: str
    codigo_simova: str | None
    unidade: str | None
    area: str | None
    grupo: str | None
    previsto: float = 0.0
    capacidade: float = 0.0
    realizado: float = 0.0
    hh_cpu: float = 0.0
    hh_equipe: float = 0.0
    tem_capacidade: bool = False

    @property
    def programada(self) -> bool:
        return self.previsto > TOL

    @property
    def cumprida(self) -> bool:
        return self.programada and self.realizado >= self.previsto - TOL

    @property
    def carga(self) -> float | None:
        return self.previsto / self.capacidade if self.tem_capacidade and self.capacidade > TOL else None

    @property
    def classe_carga(self) -> str | None:
        c = self.carga
        if c is None or not self.programada:
            return None
        return "sobre" if c > SOBRE else "sub" if c < SUB else "ok"


def atividades(fatos: list[FatoDia]) -> list[Atividade]:
    por: dict[tuple, Atividade] = {}
    for f in fatos:
        k = (f.programacao_id, f.linha_id if f.linha_id is not None else f"n{f.n_linha}")
        a = por.get(k)
        if a is None:
            a = por[k] = Atividade(k, f.programacao_id, f.titulo, f.n_linha, f.semana, f.concluida, f.modo, f.encarregado,
                                   f.equipe, f.descricao, f.codigo_simova, f.unidade, f.area, f.grupo)
        a.semana = max(a.semana, f.semana)  # semana da programação (a do fim: sex/sáb anteriores contam na seguinte)
        a.previsto += f.previsto or 0
        a.realizado += f.realizado or 0
        if f.capacidade is not None:
            a.capacidade += f.capacidade
            a.tem_capacidade = True
        if f.realizado and f.hh_un:
            a.hh_cpu += f.realizado * f.hh_un
        a.hh_equipe += f.hh_equipe or 0
    return list(por.values())


@dataclass(frozen=True)
class Razao:
    """Um indicador como razão: o que foi somado em cima e embaixo, e de quantas atividades."""
    numerador: float
    denominador: float
    n: int
    partes: tuple = field(default_factory=tuple)  # (rótulo, numerador, denominador)

    @property
    def valor(self) -> float | None:
        return self.numerador / self.denominador if self.denominador > TOL else None


def _por_semana(ats: list[Atividade], num, den) -> tuple:
    sem: dict[int, list[float]] = {}
    for a in ats:
        x = sem.setdefault(a.semana, [0.0, 0.0])
        x[0] += num(a)
        x[1] += den(a)
    return tuple((f"S{k}", v[0], v[1]) for k, v in sorted(sem.items()))


def ppc(ats: list[Atividade]) -> Razao:
    base = [a for a in ats if a.concluida and a.programada]
    return Razao(sum(a.cumprida for a in base), len(base), len(base),
                 _por_semana(base, lambda a: float(a.cumprida), lambda a: 1.0))


def aderencia(ats: list[Atividade]) -> Razao:
    base = [a for a in ats if a.concluida and a.programada]
    return Razao(sum(a.realizado for a in base), sum(a.previsto for a in base), len(base),
                 _por_semana(base, lambda a: a.realizado, lambda a: a.previsto))


def carga(ats: list[Atividade]) -> Razao:
    base = [a for a in ats if a.programada and a.carga is not None]
    return Razao(sum(a.previsto for a in base), sum(a.capacidade for a in base), len(base),
                 _por_semana(base, lambda a: a.previsto, lambda a: a.capacidade))


def realizado_capacidade(ats: list[Atividade]) -> Razao:
    base = [a for a in ats if a.concluida and a.tem_capacidade and a.capacidade > TOL and (a.programada or a.realizado)]
    return Razao(sum(a.realizado for a in base), sum(a.capacidade for a in base), len(base),
                 _por_semana(base, lambda a: a.realizado, lambda a: a.capacidade))


def eficiencia_hh(ats: list[Atividade]) -> Razao:
    base = [a for a in ats if a.concluida and a.hh_equipe > TOL and a.hh_cpu > 0]
    return Razao(sum(a.hh_cpu for a in base), sum(a.hh_equipe for a in base), len(base),
                 _por_semana(base, lambda a: a.hh_cpu, lambda a: a.hh_equipe))


def erro_programacao(ats: list[Atividade]) -> Razao:
    """Média do erro absoluto da carga: Σ |previsto − capacidade| ÷ capacidade ÷ n."""
    base = [a for a in ats if a.programada and a.carga is not None]
    erros = [abs(a.previsto - a.capacidade) / a.capacidade for a in base]
    return Razao(sum(erros), len(base), len(base),
                 tuple((f"linha {a.n_linha} · {a.titulo[:40]}", e, 1.0) for a, e in zip(base, erros)))


def erro_previsao(ats: list[Atividade]) -> Razao:
    base = [a for a in ats if a.concluida and a.programada]
    erros = [abs(a.realizado - a.previsto) / a.previsto for a in base]
    return Razao(sum(erros), len(base), len(base),
                 tuple((f"linha {a.n_linha} · {a.titulo[:40]}", e, 1.0) for a, e in zip(base, erros)))


def classes_carga(ats: list[Atividade]) -> dict[str, int]:
    out = {"sobre": 0, "ok": 0, "sub": 0}
    for a in ats:
        c = a.classe_carga
        if c:
            out[c] += 1
    return out


def pareto(contagem: dict[str, int]) -> list[dict]:
    """Causas em ordem de recorrência, com % e % acumulado (curva do Pareto)."""
    total = sum(contagem.values())
    out, acc = [], 0
    for causa, q in sorted(contagem.items(), key=lambda kv: (-kv[1], kv[0])):
        acc += q
        out.append({"causa": causa, "ocorrencias": q, "pct": q / total if total else 0.0,
                    "pct_acumulado": acc / total if total else 0.0})
    return out
