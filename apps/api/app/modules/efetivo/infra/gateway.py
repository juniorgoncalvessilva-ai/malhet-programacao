"""Linguagem publicada do efetivo para equipes e programação."""
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.efetivo.infra.models import ColaboradorModel, DeParaFuncaoModel


@dataclass(frozen=True)
class PessoaEfetivo:
    id: int
    cracha: str
    nome: str
    funcao: str | None
    situacao: str
    empresa: str
    dp: str | None
    no_ultimo_arquivo: bool


def depara(s: Session, obra_id: int) -> dict[str, DeParaFuncaoModel]:
    return {d.funcao_chave: d for d in s.scalars(select(DeParaFuncaoModel).where(DeParaFuncaoModel.obra_id == obra_id))}


def pessoas_por_cracha(s: Session, obra_id: int) -> dict[str, PessoaEfetivo]:
    return {m.cracha: PessoaEfetivo(m.id, m.cracha, m.nome, m.funcao, m.situacao, m.empresa, m.dp, m.no_ultimo_arquivo)
            for m in s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == obra_id,
                                                              ColaboradorModel.cracha.is_not(None)))}


def funcoes_por_cracha(s: Session, obra_id: int) -> dict[str, str]:
    """crachá → função da composição (CPU) pelo de-para da função do efetivo. Ignoradas/sem de-para ficam de fora."""
    dp = depara(s, obra_id)
    out = {}
    for m in s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == obra_id,
                                                      ColaboradorModel.cracha.is_not(None))):
        d = dp.get(m.funcao_chave or "")
        if d is not None and d.recurso and not d.ignorar:
            out[m.cracha] = d.recurso
    return out
