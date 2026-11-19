"""Conferência do realizado acumulado (spec 116).

Ao lançar o realizado do dia, o acumulado da atividade (feito antes deste período + realizado no período) é comparado
com o total de execução do projeto (quantidade de projeto da linha, senão o take-off da TAG) e o realizado do período
com o total programado no período (quantidade do período, senão a soma do previsto dos dias).

- passar do total do projeto trava o lançamento até a pessoa confirmar (quantidade errada, unidade trocada ou
  aditivo de quantidade ainda não lançado no projeto);
- passar do programado no período só avisa (fazer mais do que o programado é possível);
- chegar ao total do projeto avisa que a atividade terminou.
"""
from dataclasses import dataclass

TOLERANCIA = 0.005  # arredondamento das planilhas


def _n(v: float | None) -> float:
    return float(v or 0)


def _fmt(v: float) -> str:
    return f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".").rstrip("0").rstrip(",")


@dataclass(frozen=True)
class Conferencia:
    situacao: str  # sem_projeto | em_andamento | concluiu | acima_do_projeto
    acumulado: float  # feito antes + realizado no período
    feito_antes: float
    realizado_periodo: float
    qtd_projeto: float | None
    saldo_projeto: float | None  # projeto − acumulado (negativo = passou)
    programado_periodo: float | None
    acima_do_programado: bool
    percentual_projeto: float | None  # 0..1+

    @property
    def excede_projeto(self) -> bool:
        return self.situacao == "acima_do_projeto"

    def mensagem(self, unidade: str | None = None) -> str:
        un = f" {unidade}" if unidade else ""
        partes = []
        if self.qtd_projeto is not None:
            partes.append(f"acumulado {_fmt(self.acumulado)} de {_fmt(self.qtd_projeto)}{un} do projeto")
            if self.excede_projeto:
                partes.append(f"passa {_fmt(-(self.saldo_projeto or 0))}{un} do total do projeto")
            elif self.situacao == "concluiu":
                partes.append("atividade concluída no projeto")
        if self.acima_do_programado and self.programado_periodo is not None:
            partes.append(f"período {_fmt(self.realizado_periodo)} de {_fmt(self.programado_periodo)}{un} programados")
        return " · ".join(partes)

    def como_dict(self) -> dict:
        return {"situacao": self.situacao, "acumulado": round(self.acumulado, 4), "feito_antes": round(self.feito_antes, 4),
                "realizado_periodo": round(self.realizado_periodo, 4), "qtd_projeto": self.qtd_projeto,
                "saldo_projeto": None if self.saldo_projeto is None else round(self.saldo_projeto, 4),
                "programado_periodo": self.programado_periodo, "acima_do_programado": self.acima_do_programado,
                "percentual_projeto": None if self.percentual_projeto is None else round(self.percentual_projeto, 4)}


def conferir(qtd_projeto: float | None, feito_antes: float | None, realizado_periodo: float | None,
             programado_periodo: float | None) -> Conferencia:
    antes, periodo = _n(feito_antes), _n(realizado_periodo)
    acum = antes + periodo
    prog = programado_periodo if programado_periodo and programado_periodo > 0 else None
    acima_prog = prog is not None and periodo > prog + TOLERANCIA
    if qtd_projeto is None or qtd_projeto <= 0:
        return Conferencia("sem_projeto", acum, antes, periodo, None, None, prog, acima_prog, None)
    saldo = qtd_projeto - acum
    if saldo < -TOLERANCIA:
        sit = "acima_do_projeto"
    elif saldo <= TOLERANCIA:
        sit = "concluiu"
    else:
        sit = "em_andamento"
    return Conferencia(sit, acum, antes, periodo, float(qtd_projeto), saldo, prog, acima_prog, acum / qtd_projeto)


def exigir_dentro_do_projeto(confs: list[tuple[str, Conferencia, str | None]], aceitar_excesso: bool) -> None:
    """Trava o lançamento que leva o acumulado além do total do projeto, até a pessoa confirmar."""
    from app.shared.errors import DomainError

    passou = [(nome, c, un) for nome, c, un in confs if c.excede_projeto]
    if passou and not aceitar_excesso:
        nome, c, un = passou[0]
        mais = f" (e mais {len(passou) - 1})" if len(passou) > 1 else ""
        raise DomainError(f"{nome}: {c.mensagem(un)}{mais}. Confira a quantidade ou confirme o lançamento.",
                          "excesso_projeto")
