"""Leitura da planilha "Pareto semanal de desvios" (aba Detalhamento) e linhas não cumpridas de uma programação."""
from dataclasses import dataclass
from datetime import date, datetime

from app.shared.errors import DomainError

COLUNAS = ("Dia", "Semana", "ID", "Classificação", "Desvio", "Frente de serviço", "Ação", "Responsabilidade",
           "Responsabilidade - Gerencia", "Status", "Atividade impactada")


@dataclass(frozen=True)
class LinhaPareto:
    linha_arquivo: int
    data: date
    semana: int | None
    referencia: str | None
    classificacao: str
    desvio: str
    frente: str | None
    acao: str | None
    responsavel: str | None
    gerencia: str | None
    status: int
    atividade_impactada: str | None


def _txt(v) -> str | None:
    if v is None:
        return None
    t = " ".join(str(v).split())
    return None if t in ("", "-", "—") else t


def _data(v) -> date | None:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    t = _txt(v)
    if not t:
        return None
    for f in ("%d/%m/%Y", "%Y-%m-%d", "%d/%m/%y"):
        try:
            return datetime.strptime(t, f).date()
        except ValueError:
            pass
    return None


def ler_detalhamento(linhas: list[tuple]) -> tuple[list[LinhaPareto], list[str]]:
    """Acha o cabeçalho (Dia | Semana | ID | Classificação | Desvio …) e lê as ocorrências abaixo dele."""
    cab = None
    for i, r in enumerate(linhas[:30]):
        nomes = [(_txt(c) or "").casefold() for c in r]
        if "classificação" in nomes and "desvio" in nomes and "dia" in nomes:
            cab = i, {n: j for j, n in enumerate(nomes) if n}
            break
    if cab is None:
        raise DomainError("não achei o cabeçalho do Pareto (Dia | Semana | ID | Classificação | Desvio …) na aba Detalhamento")
    i0, col = cab

    def v(r, nome):
        j = col.get(nome.casefold())
        return r[j] if j is not None and j < len(r) else None

    out, avisos = [], []
    for k, r in enumerate(linhas[i0 + 1:], start=i0 + 2):
        if not any(_txt(c) for c in r):
            continue
        d, cls, desv = _data(v(r, "Dia")), _txt(v(r, "Classificação")), _txt(v(r, "Desvio"))
        if not (d and cls):
            avisos.append(f"linha {k}: sem dia ou classificação — ignorada")
            continue
        try:
            st = int(float(v(r, "Status") or 1))
        except (TypeError, ValueError):
            st = 1
        try:
            sem = int(float(v(r, "Semana"))) if v(r, "Semana") not in (None, "") else None
        except (TypeError, ValueError):
            sem = None
        out.append(LinhaPareto(k, d, sem, _txt(v(r, "ID")), cls, desv or cls, _txt(v(r, "Frente de serviço")),
                               _txt(v(r, "Ação")), _txt(v(r, "Responsabilidade")),
                               _txt(v(r, "Responsabilidade - Gerencia")), st if st in (1, 2, 3) else 1,
                               _txt(v(r, "Atividade impactada"))))
    return out, avisos


@dataclass(frozen=True)
class NaoCumprida:
    linha_id: int
    n: int
    codigo_simova: str
    descricao: str
    area: str
    previsto: float
    realizado: float

    @property
    def falta(self) -> float:
        return round(self.previsto - self.realizado, 4)


def nao_cumpridas(foto: dict, tolerancia: float = 0.005) -> list[NaoCumprida]:
    """Linhas com previsto no período e realizado abaixo dele (o item "não cumprido" do PPC)."""
    out = []
    for loc in foto["locais"]:
        for a in loc["areas"]:
            for ln in a["linhas"]:
                prev = float(ln.get("total_previsto") or 0)
                real = float(ln.get("total_realizado") or 0)
                if prev > 0 and real < prev - tolerancia:
                    out.append(NaoCumprida(ln["id"], ln["n"], ln["codigo_simova"], ln["descricao"],
                                           f"{a['codigo']} · {a['descricao']}", prev, real))
    return out
