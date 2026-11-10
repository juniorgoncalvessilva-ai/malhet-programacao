"""Importa a aba EQUIPES da planilha auxiliar: linha 2 = tipo (MOD/EQU), linha 4 = recurso, linhas 5+ = equipes."""
from typing import BinaryIO

from openpyxl import load_workbook
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.equipes.infra.models import EquipeComposicaoModel, EquipeModel
from app.shared import simova

COL_INICIAL_RECURSOS = 5  # coluna E
N_FUNCOES = 40  # NF do gerador programacao_v5.py
N_EQUIPES = 40  # NE


def importar_equipes(session: Session, obra_id: int, arquivo: BinaryIO, jornada: float = 9.0) -> int:
    wb = load_workbook(arquivo, read_only=True, data_only=True)
    if "EQUIPES" not in wb.sheetnames:
        return 0
    rows = list(wb["EQUIPES"].iter_rows(values_only=True))
    tipos, recursos = rows[1], rows[3]
    n = 0
    for r in rows[4:4 + N_EQUIPES]:
        nome = simova.codigo(r[0]) if r else None
        if not nome:
            continue
        eq = session.scalar(select(EquipeModel).where(EquipeModel.obra_id == obra_id, EquipeModel.nome == nome)) \
            or EquipeModel(obra_id=obra_id, nome=nome)
        eq.frente_codigo = None
        eq.encarregado_nome = simova.codigo(r[2])
        eq.observacao = simova.codigo(r[3])
        eq.jornada_horas = eq.jornada_horas or jornada
        eq.composicao = []
        for c in range(COL_INICIAL_RECURSOS - 1, min(len(r), COL_INICIAL_RECURSOS - 1 + N_FUNCOES)):
            rec = simova.codigo(recursos[c]) if c < len(recursos) else None
            q = r[c]
            if rec and isinstance(q, (int, float)) and q > 0:
                tipo = (simova.codigo(tipos[c]) or "MOD").upper() if c < len(tipos) else "MOD"
                eq.composicao.append(EquipeComposicaoModel(recurso=rec, tipo=tipo, quantidade=float(q)))
        session.add(eq)
        n += 1
    session.flush()
    return n


def importar_equipes_simova(session: Session, obra_id: int, arquivo: BinaryIO) -> dict:
    """Cadastro de equipes do Simova (Código, Descrição, Encarregado, Funcionário, Equipamento, Ativo).

    Casa pelo código Simova (ou pelo nome); atualiza encarregado, funcionários, equipamentos e ativo.
    Jornada, turno, responsável e composição por função ficam como estão (são do planejamento).
    """
    from app.modules.equipes.domain.simova_equipe import interpretar
    from app.modules.equipes.infra.composicao import sincronizar_membros

    wb = load_workbook(arquivo, read_only=True, data_only=True)
    linhas = [list(r) for r in wb.worksheets[0].iter_rows(values_only=True)]
    criadas = atualizadas = 0
    for eqs in interpretar(linhas):
        eq = session.scalar(select(EquipeModel).where(EquipeModel.obra_id == obra_id,
                                                      EquipeModel.codigo_simova == eqs.codigo)) \
            or session.scalar(select(EquipeModel).where(EquipeModel.obra_id == obra_id, EquipeModel.nome == eqs.descricao))
        if eq is None:
            eq = EquipeModel(obra_id=obra_id, nome=eqs.descricao[:120], jornada_horas=9.0, turno="Diurno")
            session.add(eq)
            criadas += 1
        else:
            atualizadas += 1
        eq.codigo_simova, eq.nome, eq.ativo = eqs.codigo, eqs.descricao[:120], eqs.ativo
        eq.equipamentos = (eqs.equipamentos or None) and eqs.equipamentos[:500]
        if eqs.encarregado:
            eq.encarregado_cracha, eq.encarregado_nome = eqs.encarregado.cracha, eqs.encarregado.nome
        # preserva a função já informada no app
        sincronizar_membros(eq, [(p.cracha, p.nome, None) for p in eqs.funcionarios], manter_funcao=True)
        session.flush()
    return {"criadas": criadas, "atualizadas": atualizadas}
