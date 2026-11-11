"""Linguagem publicada das equipes: composição efetiva por função/equipamento."""
from collections import Counter

from app.modules.equipes.infra.models import EquipeModel


def composicao_efetiva(eq: EquipeModel, funcao_de: dict[str, str] | None = None) -> list[tuple[str, str, float]]:
    """(recurso, tipo, quantidade). Mão de obra: conta os funcionários pela função da composição — a informada no
    membro ou, sem ela, a do de-para da função do efetivo (`funcao_de`: crachá → função da CPU). Sem nenhuma das
    duas, vale a composição digitada. Equipamentos: sempre a composição digitada."""
    funcao_de = funcao_de or {}

    def funcao(m) -> str | None:
        f = (m.funcao or "").strip() or funcao_de.get(m.cracha)
        return f or None

    por_funcao = Counter(f for f in (funcao(m) for m in eq.membros) if f)
    equ = [(c.recurso, "EQU", float(c.quantidade)) for c in eq.composicao if c.tipo == "EQU"]
    if por_funcao:
        return [(f, "MOD", float(n)) for f, n in sorted(por_funcao.items())] + equ
    return [(c.recurso, c.tipo, float(c.quantidade)) for c in eq.composicao]


def sincronizar_membros(eq: EquipeModel, membros: list[tuple[str, str, str | None]], *, manter_funcao: bool = False) -> None:
    """Atualiza a lista por crachá (sem apagar e reinserir: a chave equipe+crachá é única)."""
    from app.modules.equipes.infra.models import EquipeMembroModel

    atuais = {m.cracha: m for m in eq.membros}
    novos = {}
    for cracha, nome, funcao in membros:
        novos[cracha] = (nome, funcao)
    for cracha, m in list(atuais.items()):
        if cracha not in novos:
            eq.membros.remove(m)
    for cracha, (nome, funcao) in novos.items():
        m = atuais.get(cracha)
        if m is None:
            eq.membros.append(EquipeMembroModel(cracha=cracha, nome=nome[:150], funcao=funcao))
        else:
            m.nome = nome[:150]
            if funcao or not manter_funcao:  # importação do Simova não traz função: mantém a do app
                m.funcao = funcao
