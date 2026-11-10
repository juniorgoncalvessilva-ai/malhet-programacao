"""Carga e ativação de versões de referência (CRONOGRAMA, PQ, CPU, ÍNDICES).

A fonte é a planilha auxiliar da obra (Programacao_auxiliar_vN.xlsx), abas ATIVIDADES, PQ,
RECURSOS e ÍNDICES — as mesmas que o gerador programacao_v5.py produz a partir do P6/IWP/PQ/CPU.
"""
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import BinaryIO

from openpyxl import load_workbook
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.modules.referencias.infra.models import (
    TIPOS_REFERENCIA,
    AtividadeCronogramaModel,
    CpuRecursoModel,
    IndiceEspecificoModel,
    ItemPqModel,
    VersaoReferenciaModel,
)
from app.shared import simova
from app.shared.errors import DomainError, NotFoundError

ABA_POR_TIPO = {"CRONOGRAMA": "ATIVIDADES", "PQ": "PQ", "CPU": "RECURSOS", "INDICES": "ÍNDICES"}


@dataclass
class ResultadoCarga:
    versoes: dict[str, int] = field(default_factory=dict)
    contagem: dict[str, int] = field(default_factory=dict)
    avisos: list[str] = field(default_factory=list)


def _tabela(ws, linha_cabecalho: int = 1) -> list[dict]:
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) < linha_cabecalho:
        return []
    header = [str(h).strip() if h is not None else "" for h in rows[linha_cabecalho - 1]]
    out = []
    for r in rows[linha_cabecalho:]:
        if r and any(v is not None and v != "" for v in r):
            out.append(dict(zip(header, r)))
    return out


def _dt(v) -> datetime | None:
    if isinstance(v, datetime):
        return v
    if isinstance(v, date):
        return datetime(v.year, v.month, v.day)
    if isinstance(v, str) and v.strip():
        return datetime.fromisoformat(v.strip())
    return None


def _txt(v) -> str | None:
    return simova.codigo(v)


def _num(v) -> float | None:
    try:
        return simova.numero(v)
    except ValueError:
        return None


def nova_versao(session: Session, tipo: str, rotulo: str, usuario: str, data_base: date | None,
                arquivo: str | None, observacao: str | None) -> VersaoReferenciaModel:
    if tipo not in TIPOS_REFERENCIA:
        raise DomainError(f"tipo inválido: {tipo}", "tipo")
    if not rotulo.strip():
        raise DomainError("informe o rótulo da versão (ex.: 'P6 rev 12 - 02/11/2026')", "rotulo")
    v = VersaoReferenciaModel(tipo=tipo, rotulo=rotulo.strip(), data_base=data_base, arquivo_origem=arquivo,
                              observacao=observacao, carregado_por=usuario, vigente=False)
    session.add(v)
    session.flush()
    return v


def ativar_versao(session: Session, versao_id: int) -> VersaoReferenciaModel:
    v = session.get(VersaoReferenciaModel, versao_id)
    if v is None:
        raise NotFoundError("Versão", versao_id)
    session.execute(update(VersaoReferenciaModel).where(
        VersaoReferenciaModel.tipo == v.tipo, VersaoReferenciaModel.id != v.id).values(vigente=False))
    session.flush()
    v.vigente = True
    session.flush()
    return v


def carregar_planilha_auxiliar(
    session: Session, arquivo: BinaryIO, *, nome_arquivo: str, rotulo: str, usuario: str,
    tipos: list[str] | None = None, data_base: date | None = None, ativar: bool = True,
) -> ResultadoCarga:
    wb = load_workbook(arquivo, read_only=True, data_only=True)
    res = ResultadoCarga()
    for tipo in tipos or list(ABA_POR_TIPO):
        aba = ABA_POR_TIPO[tipo]
        if aba not in wb.sheetnames:
            res.avisos.append(f"aba {aba} não encontrada — {tipo} não carregado")
            continue
        v = nova_versao(session, tipo, rotulo, usuario, data_base, nome_arquivo, None)
        n = _CARGAS[tipo](session, wb[aba], v.id, res)
        v.qtd_itens = n
        res.versoes[tipo] = v.id
        res.contagem[tipo] = n
        if ativar:
            ativar_versao(session, v.id)
    return res


def _carga_cronograma(session: Session, ws, versao_id: int, res: ResultadoCarga) -> int:
    vistos, n = set(), 0
    for r in _tabela(ws):
        idc = _txt(r.get("id_crono"))
        if not idc or idc in vistos:
            continue
        vistos.add(idc)
        session.add(AtividadeCronogramaModel(
            versao_id=versao_id, id_crono=idc, atividade=_txt(r.get("atividade")) or "",
            area=_txt(r.get("area")), tag=_txt(r.get("tag")), wbs=_txt(r.get("wbs")),
            detalhe_wbs=_txt(r.get("detalhe_wbs")), status=_txt(r.get("status")),
            inicio=_dt(r.get("inicio")), fim=_dt(r.get("fim")), os=_txt(r.get("os")), unid=_txt(r.get("unid")),
            qtd_takeoff=_num(r.get("qtd_takeoff")), fonte_qtd=_txt(r.get("fonte_qtd")),
            realizado=_num(r.get("realizado_crono")), item_pq=_txt(r.get("item_pq")),
            composicao=_txt(r.get("composicao")), recurso_governa=_txt(r.get("recurso_governa")),
            coef_governa=_num(r.get("coef_governa")), horas_crono=_num(r.get("horas_crono")),
        ))
        n += 1
    return n


def _carga_pq(session: Session, ws, versao_id: int, res: ResultadoCarga) -> int:
    vistos, n = set(), 0
    for r in _tabela(ws):
        item = _txt(r.get("item"))
        if not item or item in vistos:
            continue
        vistos.add(item)
        session.add(ItemPqModel(
            versao_id=versao_id, item=item, descricao=_txt(r.get("descricao")) or "", unid=_txt(r.get("unid")),
            quantidade=_num(r.get("quantidade")), pu=_num(r.get("pu")), peso_profis=_num(r.get("peso_profis")),
            grupo=_txt(r.get("grupo")), subgrupo=_txt(r.get("subgrupo")), composicao=_txt(r.get("composicao")),
            recurso_governa=_txt(r.get("recurso_governa")), coef_governa=_num(r.get("coef_governa")),
        ))
        n += 1
    return n


def _carga_cpu(session: Session, ws, versao_id: int, res: ResultadoCarga) -> int:
    n = 0
    for r in _tabela(ws):
        comp, rec, coef = _txt(r.get("composicao")), _txt(r.get("recurso")), _num(r.get("coef_por_unidade"))
        if not comp or not rec or coef is None:
            continue
        session.add(CpuRecursoModel(versao_id=versao_id, composicao=comp, recurso=rec,
                                    tipo=(_txt(r.get("tipo")) or "MOD").upper(),
                                    unid_recurso=_txt(r.get("unid_recurso")), coef_por_unidade=coef))
        n += 1
    return n


def _carga_indices(session: Session, ws, versao_id: int, res: ResultadoCarga) -> int:
    # cabeçalho na linha 4: Código | Função que governa ▼ | Unid | Índice (un/dia por pessoa) | Ajudante ▼ | Ajudantes por oficial | Fonte
    n = 0
    for row in list(ws.iter_rows(min_row=5, values_only=True)):
        if not row or not row[0]:
            continue
        idx = _num(row[3]) if len(row) > 3 else None
        if not idx:
            res.avisos.append(f"índice '{row[0]}' sem valor — ignorado")
            continue
        session.add(IndiceEspecificoModel(
            versao_id=versao_id, codigo=_txt(row[0]), funcao_governa=_txt(row[1]) or "", unid=_txt(row[2]),
            indice_un_dia=idx, ajudante=_txt(row[4]) if len(row) > 4 else None,
            ajudantes_por_oficial=_num(row[5]) if len(row) > 5 else None, fonte=_txt(row[6]) if len(row) > 6 else None,
        ))
        n += 1
    return n


_CARGAS = {"CRONOGRAMA": _carga_cronograma, "PQ": _carga_pq, "CPU": _carga_cpu, "INDICES": _carga_indices}
