"""Linguagem publicada do efetivo para equipes e programação."""
import re
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


def codigo_normal(valor: object) -> str:
    """Crachá/matrícula escritos de jeitos diferentes, iguais: "099800" = "99800" (o Excel do DP tira o zero), "115.532",
    "115532.0" e espaços. Letras ficam (crachá de terceiro "T77")."""
    t = re.sub(r"\.0+$", "", str(valor or "").strip())
    t = "".join(ch for ch in t if ch.isalnum()).upper()
    return (t.lstrip("0") or "0") if t else ""


class PorCodigo(dict):
    """crachá exato → valor; sem o exato, o mesmo número escrito de outro jeito (crachá ou matrícula da pessoa), desde que
    seja de uma pessoa só. Quem está numa equipe pelo número do Simova acha a função dele no efetivo mesmo sem crachá
    gravado ou com zero à esquerda."""

    def __init__(self, exatos: dict, por_numero: dict[str, dict[int, object]]):
        super().__init__(exatos)
        self._alt = {k: next(iter(v.values())) for k, v in por_numero.items() if len(v) == 1}

    def _outro(self, k):
        n = codigo_normal(k) if k else ""
        return self._alt.get(n, _NADA) if n else _NADA

    def __missing__(self, k):
        v = self._outro(k)
        if v is _NADA:
            raise KeyError(k)
        return v

    def get(self, k, default=None):
        if dict.__contains__(self, k):
            return dict.__getitem__(self, k)
        v = self._outro(k)
        return default if v is _NADA else v

    def __contains__(self, k) -> bool:
        return dict.__contains__(self, k) or self._outro(k) is not _NADA


_NADA = object()


def _por_codigo(pessoas: list[ColaboradorModel], valor) -> PorCodigo:
    exatos, por_numero = {}, {}
    for m in pessoas:
        v = valor(m)
        if v is None:
            continue
        if m.cracha:
            exatos[m.cracha] = v
        for numero in {codigo_normal(m.cracha), codigo_normal(m.matricula)} - {""}:
            por_numero.setdefault(numero, {})[m.id] = v
    return PorCodigo(exatos, por_numero)


def _colaboradores(s: Session, obra_id: int) -> list[ColaboradorModel]:
    return list(s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == obra_id)))


def pessoas_por_cracha(s: Session, obra_id: int) -> dict[str, PessoaEfetivo]:
    return _por_codigo(_colaboradores(s, obra_id), _pessoa)


def funcoes_por_cracha(s: Session, obra_id: int) -> dict[str, str]:
    """crachá → função da composição (CPU) pelo de-para da função do efetivo. Ignoradas/sem de-para ficam de fora."""
    dp = depara(s, obra_id)

    def recurso(m: ColaboradorModel) -> str | None:
        d = dp.get(m.funcao_chave or "")
        return d.recurso if d is not None and d.recurso and not d.ignorar else None
    return _por_codigo(_colaboradores(s, obra_id), recurso)


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
        normais: dict[str, dict[int, ColaboradorModel]] = {}
        for m in cs:
            for numero in {codigo_normal(m.cracha), codigo_normal(m.matricula)} - {""}:
                normais.setdefault(numero, {})[m.id] = m
        self._normal = {k: next(iter(v.values())) for k, v in normais.items() if len(v) == 1}

    def achar(self, numero: str | None) -> PessoaEfetivo | None:
        if not numero:
            return None
        m = self._por_cracha.get(numero) or self._proprio.get(numero) or self._terceiro.get(numero)
        if m is None:  # o mesmo número escrito de outro jeito ("099800" = "99800"), se for de uma pessoa só
            m = self._normal.get(codigo_normal(numero))
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


@dataclass(frozen=True)
class FuncaoContratacao:
    """Função de contratação padronizada da obra (spec 089): de-para (criada na obra ou vinda do DP) + funções do efetivo."""
    funcao_chave: str
    funcao: str
    recurso: str | None
    pessoas: int
    criada_na_obra: bool


def funcoes_de_contratacao(s: Session, obra_id: int) -> dict[str, FuncaoContratacao]:
    from sqlalchemy import func as sqlfunc

    out: dict[str, FuncaoContratacao] = {}
    contagem = dict(s.execute(select(ColaboradorModel.funcao_chave, sqlfunc.count()).where(
        ColaboradorModel.obra_id == obra_id, ColaboradorModel.funcao_chave.is_not(None)).group_by(ColaboradorModel.funcao_chave)).all())
    nomes = dict(s.execute(select(ColaboradorModel.funcao_chave, sqlfunc.min(ColaboradorModel.funcao)).where(
        ColaboradorModel.obra_id == obra_id, ColaboradorModel.funcao_chave.is_not(None)).group_by(ColaboradorModel.funcao_chave)).all())
    for k, nome in nomes.items():
        out[k] = FuncaoContratacao(k, nome, None, contagem.get(k, 0), False)
    for d in depara(s, obra_id).values():
        out[d.funcao_chave] = FuncaoContratacao(d.funcao_chave, d.funcao, None if d.ignorar else d.recurso,
                                                contagem.get(d.funcao_chave, 0), d.criada_na_obra)
    return dict(sorted(out.items(), key=lambda kv: kv[1].funcao))


def funcao_padronizada(s: Session, obra_id: int, funcao: str | None) -> FuncaoContratacao | None:
    """A função escrita precisa estar na lista da obra; devolve o nome padronizado (None se vazio)."""
    from app.modules.efetivo.domain.efetivo import chave_texto
    from app.shared.errors import DomainError

    if not (funcao or "").strip():
        return None
    f = funcoes_de_contratacao(s, obra_id).get(chave_texto(funcao))
    if f is None:
        raise DomainError(f"a função “{funcao.strip()}” não está cadastrada: crie em De-para de funções", "funcao")
    return f


def pessoa(s: Session, obra_id: int, colaborador_id: int) -> PessoaEfetivo | None:
    """A pessoa do efetivo pelo id (spec 139: responsável da contratada vem do efetivo)."""
    m = s.get(ColaboradorModel, colaborador_id)
    return _pessoa(m) if m is not None and m.obra_id == obra_id else None


def pessoas_da_obra(s: Session, obra_id: int, so_ativas: bool = True) -> list[PessoaEfetivo]:
    """Pessoas do efetivo (spec 147: operador de equipamento); `so_ativas` tira desmobilizado e desistência."""
    q = select(ColaboradorModel).where(ColaboradorModel.obra_id == obra_id)
    if so_ativas:
        q = q.where(ColaboradorModel.situacao.not_in(("DESMOBILIZADO", "DESISTENCIA")))
    return [_pessoa(m) for m in s.scalars(q.order_by(ColaboradorModel.nome))]
