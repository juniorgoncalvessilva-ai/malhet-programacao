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


def importar_equipes(session: Session, arquivo: BinaryIO, jornada: float = 9.0) -> int:
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
        eq = session.scalar(select(EquipeModel).where(EquipeModel.nome == nome)) or EquipeModel(nome=nome)
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
