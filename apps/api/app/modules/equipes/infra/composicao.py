"""Linguagem publicada das equipes: composição efetiva por função/equipamento."""
from collections import Counter

from app.modules.equipes.infra.models import EquipeModel


def composicao_efetiva(eq: EquipeModel) -> list[tuple[str, str, float]]:
    """(recurso, tipo, quantidade). Mão de obra: conta os funcionários pela função quando ela foi informada;
    senão vale a composição digitada. Equipamentos: sempre a composição digitada."""
    por_funcao = Counter(m.funcao.strip() for m in eq.membros if m.funcao and m.funcao.strip())
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
