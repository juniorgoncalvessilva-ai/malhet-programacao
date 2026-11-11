"""Linguagem publicada do efetivo para equipes e programação."""
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.efetivo.infra.models import ColaboradorModel, DeParaFuncaoModel


@dataclass(frozen=True)
class PessoaEfetivo:
    id: int
    cracha: str | None
    nome: str
    funcao: str | None
    situacao: str
    empresa: str
    dp: str | None
    no_ultimo_arquivo: bool
    matricula: str | None = None


def depara(s: Session, obra_id: int) -> dict[str, DeParaFuncaoModel]:
    return {d.funcao_chave: d for d in s.scalars(select(DeParaFuncaoModel).where(DeParaFuncaoModel.obra_id == obra_id))}


def pessoas_por_cracha(s: Session, obra_id: int) -> dict[str, PessoaEfetivo]:
    return {m.cracha: _pessoa(m)
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


def _pessoa(m: ColaboradorModel) -> PessoaEfetivo:
    return PessoaEfetivo(m.id, m.cracha, m.nome, m.funcao, m.situacao, m.empresa, m.dp, m.no_ultimo_arquivo, m.matricula)


class LocalizadorEfetivo:
    """Acha a pessoa do efetivo pelo número que vem na equipe (crachá do Simova = matrícula do DP).

    Ordem: crachá já definido → matrícula do efetivo próprio → matrícula de terceiro (só se for única). Quem é achado
    pela matrícula e ainda não tem crachá passa a ter (`confirmar`)."""

    def __init__(self, s: Session, obra_id: int):
        self._s = s
        cs = list(s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == obra_id)))
        self._por_cracha = {m.cracha: m for m in cs if m.cracha}
        self._proprio: dict[str, ColaboradorModel] = {}
        terceiros: dict[str, list[ColaboradorModel]] = {}
        for m in cs:
            if not m.matricula:
                continue
            if ":" not in m.chave:
                self._proprio[m.matricula] = m
            else:
                terceiros.setdefault(m.matricula, []).append(m)
        self._terceiro = {k: v[0] for k, v in terceiros.items() if len(v) == 1}

    def achar(self, numero: str | None) -> PessoaEfetivo | None:
        if not numero:
            return None
        m = self._por_cracha.get(numero) or self._proprio.get(numero) or self._terceiro.get(numero)
        if m is None:
            return None
        if not m.cracha and numero not in self._por_cracha:
            m.cracha = numero  # o número que o Simova usa para a pessoa vira o crachá dela no efetivo
            self._por_cracha[numero] = m
        return _pessoa(m)


def setor_da_disciplina(s: Session, obra_id: int, disciplina_id: int | None) -> int | None:
    """Setor a que a disciplina (subsetor) pertence; None se não existir nesta obra."""
    from app.modules.efetivo.infra.models import SubsetorObraModel

    if not disciplina_id:
        return None
    d = s.get(SubsetorObraModel, disciplina_id)
    return d.setor_id if d is not None and d.obra_id == obra_id else None
