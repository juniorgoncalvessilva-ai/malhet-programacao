"""Entrar e sair de equipe com histórico (spec 107). Todo caminho que coloca ou tira alguém de uma equipe passa por
aqui: cadastro da equipe, organograma (um a um e em lote) e a tela do efetivo.

- Entrar: a pessoa sai sozinha da outra equipe em que era funcionária (líder não: `domain/alocacao.py`).
- Cada troca vira UM movimento `EQUIPE` no histórico do efetivo (de → para, com os ids das equipes).
- Pessoa fora do efetivo (sem cadastro) muda de equipe igual, só não tem histórico.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.equipes.domain.alocacao import EquipeResumo, equipes_de_saida
from app.modules.equipes.infra.models import EquipeMembroModel, EquipeModel


class Alocador:
    def __init__(self, s: Session, obra_id: int, por: str):
        self.s, self.obra_id, self.por = s, obra_id, por
        self._colab: dict[str, object | None] = {}

    def _equipes(self) -> list[EquipeModel]:
        return list(self.s.scalars(select(EquipeModel).where(EquipeModel.obra_id == self.obra_id)))

    @staticmethod
    def _resumo(e: EquipeModel) -> EquipeResumo:
        return EquipeResumo(id=e.id, nome=e.nome, membros=frozenset(m.cracha for m in e.membros),
                            encarregado=e.encarregado_cracha, responsavel_id=e.responsavel_id, supervisor_id=e.supervisor_id)

    def colaborador(self, cracha: str):
        from app.modules.efetivo.infra.models import ColaboradorModel

        if cracha not in self._colab:
            C = ColaboradorModel
            self._colab[cracha] = None if not cracha or cracha.startswith("?") else (
                self.s.scalar(select(C).where(C.obra_id == self.obra_id, C.cracha == cracha)) or
                self.s.scalar(select(C).where(C.obra_id == self.obra_id, C.matricula == cracha)))
        return self._colab[cracha]

    def registrar(self, cracha: str, de: EquipeModel | None, para: EquipeModel | None) -> None:
        from app.modules.efetivo.infra.models import MovimentoEfetivoModel

        p = self.colaborador(cracha)
        if p is None or (de is None and para is None) or (de is not None and para is not None and de.id == para.id):
            return
        self.s.add(MovimentoEfetivoModel(
            obra_id=self.obra_id, colaborador_id=p.id, tipo="EQUIPE", de=de.nome if de else None,
            para=para.nome if para else None, de_equipe_id=de.id if de else None,
            para_equipe_id=para.id if para else None, por=self.por))

    def entrou(self, destino: EquipeModel, cracha: str, forcar_de: EquipeModel | None = None) -> list[str]:
        """A pessoa já foi posta em `destino`: tira das outras equipes (se não for líder) e registra. Devolve de onde saiu.
        `forcar_de` = mover explícito (organograma): sai dessa equipe mesmo sendo líder."""
        self.s.flush()  # destino precisa de id (equipe nova)
        equipes = self._equipes()
        p = self.colaborador(cracha)
        por_id = {e.id: e for e in equipes}
        saidas = equipes_de_saida(cracha, getattr(p, "id", None), destino.id, [self._resumo(e) for e in equipes])
        if forcar_de is not None and forcar_de.id != destino.id and all(r.id != forcar_de.id for r in saidas) \
                and any(m.cracha == cracha for m in forcar_de.membros):
            saidas = [self._resumo(forcar_de), *saidas]
        for r in saidas:
            e = por_id[r.id]
            for m in [m for m in e.membros if m.cracha == cracha]:
                e.membros.remove(m)
        self.registrar(cracha, por_id[saidas[0].id] if saidas else None, destino)
        for r in saidas[1:]:  # estava (por erro antigo) em mais de uma: cada saída extra também conta
            self.registrar(cracha, por_id[r.id], None)
        return [r.nome for r in saidas]

    def incluir(self, destino: EquipeModel, cracha: str, nome: str, funcao: str | None = None,
                forcar_de: EquipeModel | None = None) -> list[str]:
        destino.membros.append(EquipeMembroModel(cracha=cracha[:20], nome=nome[:150], funcao=funcao))
        return self.entrou(destino, cracha[:20], forcar_de)

    def saiu(self, origem: EquipeModel, cracha: str) -> None:
        """A pessoa já foi tirada de `origem` (ficou sem equipe, a não ser que esteja em outra)."""
        self.registrar(cracha, origem, None)
