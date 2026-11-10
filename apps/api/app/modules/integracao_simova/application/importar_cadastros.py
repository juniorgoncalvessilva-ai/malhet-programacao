"""Importa os cadastros do Simova (OPER.xlsx + FRENTE.xlsx) — idempotente (upsert).

Vínculos criados na aplicação (tarefa_codigo, cpu_codigo, funcao_equipe) nunca são sobrescritos.
"""
from collections import Counter
from dataclasses import dataclass, field
from typing import BinaryIO

from openpyxl import load_workbook
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.modules.cadastros.infra.models import (
    FrenteModel,
    FuncaoModel,
    MaterialModel,
    OperGrupoModel,
    OperModel,
    TarefaModel,
)
from app.shared import simova


@dataclass
class RelatorioImportacao:
    contagem: dict[str, int] = field(default_factory=dict)
    avisos: list[str] = field(default_factory=list)


def _linhas(wb, aba: str) -> list[dict]:
    if aba not in wb.sheetnames:
        return []
    rows = wb[aba].iter_rows(values_only=True)
    header = [str(h).strip() if h else "" for h in next(rows, [])]
    out = []
    for r in rows:
        if r is None or all(v is None for v in r):
            continue
        out.append(dict(zip(header, r)))
    return out


def _upsert(session: Session, obra_id: int, modelo, registros: list[dict], nome: str, rel: RelatorioImportacao) -> None:
    """merge por código; códigos repetidos na mesma planilha → vale a última linha (com aviso)."""
    por_codigo: dict[str, dict] = {}
    repetidos: set[str] = set()
    for r in registros:
        if r["codigo"] in por_codigo:
            repetidos.add(r["codigo"])
        por_codigo[r["codigo"]] = r
    for r in por_codigo.values():
        session.merge(modelo(obra_id=obra_id, **r))
    if repetidos:
        amostra = ", ".join(sorted(repetidos)[:10])
        rel.avisos.append(f"{nome}: {len(repetidos)} código(s) repetido(s) no Simova (vale a última linha): {amostra}")
    rel.contagem[nome.lower()] = len(por_codigo)


def importar_frentes(session: Session, obra_id: int, arquivo: BinaryIO, rel: RelatorioImportacao) -> None:
    wb = load_workbook(arquivo, read_only=True, data_only=True)
    regs = []
    for r in _linhas(wb, "FRENTE"):
        cod = simova.codigo(r.get("CODIGO"))
        if cod:
            ativo = r.get("ATIVO")
            regs.append(dict(codigo=cod, descricao=simova.codigo(r.get("DESCRICAO")) or "",
                             ativo=True if ativo is None else simova.flag(ativo)))
    _upsert(session, obra_id, FrenteModel, regs, "FRENTE", rel)


def importar_oper(session: Session, obra_id: int, arquivo: BinaryIO, rel: RelatorioImportacao) -> None:
    wb = load_workbook(arquivo, read_only=True, data_only=True)

    # OPER_GRUPO — códigos podem repetir no Simova; recarrega tudo e marca duplicados.
    grupos = _linhas(wb, "OPER_GRUPO")
    cont = Counter(simova.codigo(g.get("CODIGO")) for g in grupos)
    session.execute(delete(OperGrupoModel).where(OperGrupoModel.obra_id == obra_id))
    for g in grupos:
        cod = simova.codigo(g.get("CODIGO"))
        if not cod:
            continue
        session.add(OperGrupoModel(
            obra_id=obra_id,
            codigo=cod,
            descricao=simova.codigo(g.get("DESCRICAO")) or "",
            unidade_medida=simova.codigo(g.get("UNIDADE_MEDIDA")),
            materiais=simova.lista(g.get("MATERIAL")),
            ativo=simova.flag(g.get("ATIVO")),
            codigo_duplicado=cont[cod] > 1,
        ))
    dups = sorted((c for c, k in cont.items() if c and k > 1), key=lambda c: int(c) if c.isdigit() else 0)
    if dups:
        rel.avisos.append(f"OPER_GRUPO com códigos repetidos no Simova: {', '.join(dups)}")
    rel.contagem["oper_grupo"] = len(grupos)

    # OPER — chave (grupo, código)
    existentes = {(o.grupo_codigo, o.codigo): o for o in session.scalars(select(OperModel).where(OperModel.obra_id == obra_id))}
    n = 0
    for r in _linhas(wb, "OPER"):
        cod, grp = simova.codigo(r.get("CODIGO")), simova.codigo(r.get("OPER_GRUPO"))
        if not cod or not grp:
            continue
        o = existentes.get((grp, cod)) or OperModel(obra_id=obra_id, codigo=cod, grupo_codigo=grp, origem="simova")
        o.descricao = (simova.codigo(r.get("DESCRICAO")) or "").strip()
        o.materiais = simova.lista(r.get("MATERIAL"))
        o.unidade_medida = simova.codigo(r.get("UNIDADE_MEDIDA"))
        o.hh_prev = simova.numero(r.get("HH_PREV"))
        o.insumo = simova.codigo(r.get("INSUMO"))
        o.ativo = simova.flag(r.get("ATIVO"))
        o.tarefa_codigo = o.tarefa_codigo or simova.codigo(r.get("TAREFA"))
        o.pendente_envio_simova = False
        session.add(o)
        existentes[(grp, cod)] = o
        n += 1
    rel.contagem["oper"] = n

    _upsert(session, obra_id, MaterialModel, [
        dict(codigo=c, descricao=simova.codigo(r.get("DESCRICAO")) or "",
             unidade_medida=simova.codigo(r.get("UNIDADE_MEDIDA")), ativo=simova.flag(r.get("ATIVO")))
        for r in _linhas(wb, "MATERIAL") if (c := simova.codigo(r.get("CODIGO")))
    ], "MATERIAL", rel)
    _upsert(session, obra_id, TarefaModel, [
        dict(codigo=c, descricao=simova.codigo(r.get("DESCRICAO")) or "",
             unidade_medida=simova.codigo(r.get("UNIDADE_MEDIDA")), grupos=simova.lista(r.get("OPER_GRUPO")),
             tipos=simova.lista(r.get("TIPO_TAREFA")), ativo=simova.flag(r.get("ATIVO")))
        for r in _linhas(wb, "TAREFA") if (c := simova.codigo(r.get("CODIGO")))
    ], "TAREFA", rel)
    _upsert(session, obra_id, FuncaoModel, [
        dict(codigo=c, descricao=(simova.codigo(r.get("DESCRICAO")) or "").strip(),
             tipo_funcao=simova.codigo(r.get("TIPO_FUNCAO")), operador=simova.flag(r.get("FLAG_OPERADOR")),
             ativo=simova.flag(r.get("ATIVO")))
        for r in _linhas(wb, "EFETIVO_FUNCAO") if (c := simova.codigo(r.get("CODIGO")))
    ], "FUNCAO", rel)
    session.flush()
