"""Take-off da obra (ex.: 5º TAKE OFF CONTRATO): abas PQ CONTRATO e MC FRENTES → versão PQ.

PQ CONTRATO: ITEM (1.5.3.1.2) | EAP (= CPU ESP.48.xxx) | Nº do Ativo | CÓD. ATIVIDADE (5 colunas) | DESCRIÇÃO |
             UNID. | CRITÉRIO … | QUANTIDADE | PREÇO
MC FRENTES:  CPU | ITEM | Área | SubÁrea | Nº do Ativo | CÓD. ATIVIDADE (5) | DESCRIÇÃO | DESCR. CONTRATAÇÃO |
             UNID. | QUANTIDADE | PREÇO UNIT. | TOTAL
A quantidade por TAG casa com o item da PQ pela dupla (CPU, código da atividade).
"""
import re
from collections import defaultdict
from typing import BinaryIO

from openpyxl import load_workbook
from sqlalchemy.orm import Session

from app.modules.referencias.application.versoes import ResultadoCarga, ativar_versao, nova_versao
from app.modules.referencias.infra.models import ItemPqModel, PqQuantidadeTagModel
from app.shared import simova

_ITEM = re.compile(r"^\d+(\.\d+)+$")


def _txt(v) -> str | None:
    return simova.codigo(v)


def _num(v) -> float | None:
    try:
        return simova.numero(v)
    except ValueError:
        return None


def _cod(partes) -> str:
    return ".".join(str(simova.codigo(p) or "") for p in partes)


def _linhas_pq(ws):
    for r in ws.iter_rows(min_row=8, values_only=True):
        item = _txt(r[0]) if r else None
        if item and _ITEM.match(item) and _txt(r[10]):  # folha: tem unidade
            yield {"item": item, "cpu": _txt(r[1]), "cod": _cod(r[4:9]), "descricao": _txt(r[9]) or "",
                   "unid": _txt(r[10]), "quantidade": _num(r[16]), "pu": _num(r[17])}


def _linhas_mc(ws):
    for r in ws.iter_rows(min_row=10, values_only=True):
        if not r or not _txt(r[0]) or _num(r[13]) is None:
            continue
        area, sub, ativo = _txt(r[2]), _txt(r[3]), _txt(r[4])
        tag = f"{area}{sub}-{ativo}" if area and sub and ativo and ativo.upper() != "GERAL" else (ativo or "GERAL").upper()
        yield {"cpu": _txt(r[0]), "cod": _cod(r[5:10]), "tag": tag, "unid": _txt(r[12]), "quantidade": _num(r[13])}


def carregar_takeoff(session: Session, obra_id: int, arquivo: BinaryIO, *, nome_arquivo: str, rotulo: str,
                     usuario: str, ativar: bool = True) -> ResultadoCarga:
    wb = load_workbook(arquivo, read_only=True, data_only=True)
    res = ResultadoCarga()
    if "PQ CONTRATO" not in wb.sheetnames:
        res.avisos.append("aba PQ CONTRATO não encontrada")
        return res
    v = nova_versao(session, obra_id, "PQ", rotulo, usuario, None, nome_arquivo, "take-off")
    por_chave: dict[tuple[str | None, str], str] = {}
    por_cpu: dict[str | None, list[str]] = defaultdict(list)
    vistos = set()
    for p in _linhas_pq(wb["PQ CONTRATO"]):
        if p["item"] in vistos:
            continue
        vistos.add(p["item"])
        session.add(ItemPqModel(versao_id=v.id, item=p["item"], descricao=p["descricao"], unid=p["unid"],
                                quantidade=p["quantidade"], pu=p["pu"], composicao=p["cpu"]))
        por_chave[(p["cpu"], p["cod"])] = p["item"]
        por_cpu[p["cpu"]].append(p["item"])
    res.contagem["PQ"] = len(vistos)
    somas: dict[tuple[str, str], list] = {}
    sem_item = 0
    if "MC FRENTES" in wb.sheetnames:
        for m in _linhas_mc(wb["MC FRENTES"]):
            item = por_chave.get((m["cpu"], m["cod"])) or (por_cpu[m["cpu"]][0] if len(por_cpu[m["cpu"]]) == 1 else None)
            if not item:
                sem_item += 1
                continue
            k = (item, m["tag"])
            if k in somas:
                somas[k][0] += m["quantidade"] or 0
            else:
                somas[k] = [m["quantidade"] or 0, m["unid"]]
        for (item, tag), (q, unid) in somas.items():
            session.add(PqQuantidadeTagModel(versao_id=v.id, item=item, tag=tag, quantidade=round(q, 4), unid=unid))
    else:
        res.avisos.append("aba MC FRENTES não encontrada: sem quantidade por TAG")
    if sem_item:
        res.avisos.append(f"{sem_item} linha(s) da MC FRENTES sem item de PQ correspondente (CPU/código)")
    res.contagem["QTD_TAG"] = len(somas)
    v.qtd_itens = len(vistos)
    res.versoes["PQ"] = v.id
    if ativar:
        ativar_versao(session, v.id, obra_id)
    session.flush()
    return res
