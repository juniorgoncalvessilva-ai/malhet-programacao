"""Leitura publicada de ASOs e treinamentos (spec 088): aptidão de cada pessoa para outros módulos (mobilização, ficha)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.treinamentos.domain.aptidao import (
    Aptidao,
    Aso,
    Registro,
    ResultadoAso,
    TipoAso,
    Treinamento,
    aptidao,
    descrever_impedimentos,
    exigidos,
)
from app.modules.treinamentos.infra.models import (
    AsoModel,
    ColaboradorTreinamentoModel,
    TreinamentoFuncaoModel,
    TreinamentoModel,
)


@dataclass(frozen=True)
class AptidaoInfo:
    colaborador_id: int
    aptidao: Aptidao
    exigidos: tuple[Treinamento, ...]
    funcao_tem_exigencia: bool
    nomes: dict[int, str]

    @property
    def aso_libera(self) -> bool:
        return self.aptidao.aso_libera

    @property
    def pendentes(self) -> list[str]:
        return [self.nomes.get(c.treinamento_id, str(c.treinamento_id)) for c in self.aptidao.pendencias]

    @property
    def impedimentos(self) -> list[str]:
        return descrever_impedimentos(self.aptidao, self.nomes)


class AptidaoGateway:
    def __init__(self, s: Session, obra_id: int) -> None:
        self.s, self.obra_id = s, obra_id
        self.treinamentos = [
            Treinamento(id=t.id, nome=t.nome, validade_meses=t.validade_meses, impeditivo=t.impeditivo, todos=t.todos,
                        norma=t.norma, carga_horaria=t.carga_horaria)
            for t in s.scalars(select(TreinamentoModel).where(TreinamentoModel.obra_id == obra_id,
                                                               TreinamentoModel.ativo.is_(True)).order_by(TreinamentoModel.nome))]
        self.nomes = {t.id: t.nome for t in self.treinamentos}
        self.por_funcao: dict[str, set[int]] = {}
        for x in s.scalars(select(TreinamentoFuncaoModel).where(TreinamentoFuncaoModel.obra_id == obra_id)):
            self.por_funcao.setdefault(x.funcao_chave, set()).add(x.treinamento_id)

    def de(self, pessoas: list[tuple[int, str | None]], hoje: date) -> dict[int, AptidaoInfo]:
        """pessoas = [(colaborador_id, funcao_chave)]."""
        ids = [p for p, _ in pessoas]
        asos: dict[int, list[Aso]] = {}
        regs: dict[int, list[Registro]] = {}
        if ids:
            for a in self.s.scalars(select(AsoModel).where(AsoModel.obra_id == self.obra_id, AsoModel.colaborador_id.in_(ids))):
                asos.setdefault(a.colaborador_id, []).append(
                    Aso(TipoAso(a.tipo), a.data_exame, a.valido_ate, ResultadoAso(a.resultado)))
            for r in self.s.scalars(select(ColaboradorTreinamentoModel).where(
                    ColaboradorTreinamentoModel.obra_id == self.obra_id, ColaboradorTreinamentoModel.colaborador_id.in_(ids))):
                regs.setdefault(r.colaborador_id, []).append(Registro(r.treinamento_id, r.realizado_em, r.valido_ate))
        out = {}
        for cid, fch in pessoas:
            ex = exigidos(self.treinamentos, self.por_funcao, fch)
            out[cid] = AptidaoInfo(cid, aptidao(asos.get(cid, []), regs.get(cid, []), ex, hoje), tuple(ex),
                                   bool(self.por_funcao.get(fch or "")), self.nomes)
        return out
