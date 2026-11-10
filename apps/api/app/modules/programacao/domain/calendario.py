"""Calendário da programação — portado de PARAMETROS (linhas 20–33) da planilha auxiliar.

- SEMANAL: 9 dias, da sexta de emissão ao sábado da semana programada (os 2 primeiros dias
  ficam com 0 h, a não ser que programar_sexta_sabado_anterior=True ou haja horas digitadas).
- MENSAL : do dia 1 ao último dia do mês.
- fator do dia = horas usadas ÷ jornada de referência; fator acumulado = dias de referência.
"""
from calendar import monthrange
from dataclasses import dataclass, field
from datetime import date, timedelta
from enum import StrEnum

DIAS_PT = ("SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM")  # date.weekday()
HORAS_PADRAO = {"DOM": 0, "SEG": 9, "TER": 9, "QUA": 9, "QUI": 9, "SEX": 8, "SÁB": 0}


class TipoProgramacao(StrEnum):
    SEMANAL = "SEMANAL"
    MENSAL = "MENSAL"


@dataclass(frozen=True)
class DiaCalendario:
    data: date
    horas: float
    fator: float
    fator_acumulado: float
    semana: str

    @property
    def dia(self) -> str:
        return DIAS_PT[self.data.weekday()]


@dataclass(frozen=True)
class Calendario:
    tipo: TipoProgramacao
    referencia: date
    jornada: float = 9.0
    horas_padrao: dict[str, float] = field(default_factory=lambda: dict(HORAS_PADRAO))
    horas_digitadas: dict[date, float] = field(default_factory=dict)
    domingo_ref: date = date(2026, 11, 1)
    semana_ref: int = 31
    programar_sexta_sabado_anterior: bool = False

    @property
    def inicio(self) -> date:
        if self.tipo == TipoProgramacao.MENSAL:
            return self.referencia.replace(day=1)
        return self.referencia

    @property
    def fim(self) -> date:
        if self.tipo == TipoProgramacao.MENSAL:
            return self.referencia.replace(day=monthrange(self.referencia.year, self.referencia.month)[1])
        return self.referencia + timedelta(days=8)

    def numero_semana(self, d: date) -> str:
        return f"S{self.semana_ref + (d - self.domingo_ref).days // 7}"

    def dias(self) -> list[DiaCalendario]:
        out, acc = [], 0.0
        d, j = self.inicio, 0
        while d <= self.fim:
            if d in self.horas_digitadas:
                h = self.horas_digitadas[d]
            elif self.tipo == TipoProgramacao.SEMANAL and j < 2 and not self.programar_sexta_sabado_anterior:
                h = 0.0
            else:
                h = float(self.horas_padrao.get(DIAS_PT[d.weekday()], 0))
            f = h / self.jornada if self.jornada else 0.0
            acc += f
            out.append(DiaCalendario(d, h, f, acc, self.numero_semana(d)))
            d += timedelta(days=1)
            j += 1
        return out

    def dias_de_referencia(self) -> float:
        return sum(x.fator for x in self.dias())

    def fator_medio_dia_util(self) -> float:
        uteis = [x.fator for x in self.dias() if x.horas > 0]
        return sum(uteis) / max(1, len(uteis))
