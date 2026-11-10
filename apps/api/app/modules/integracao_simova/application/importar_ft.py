"""Importa uma FT_IMPORT_INTERMEDIARIA existente (programação já feita) como itens aprovados.

Cada coluna PE_<DIA>/HH_<DIA> é convertida para a data correspondente dentro do período.
"""
from dataclasses import dataclass, field
from datetime import timedelta
from typing import BinaryIO

from openpyxl import load_workbook
from sqlalchemy.orm import Session

from app.modules.programacao.domain.item_programacao import (
    DIAS_SEMANA,
    DiaPlano,
    ItemProgramacao,
    Origem,
    Status,
)
from app.modules.programacao.infra.repository import SqlProgramacaoRepository
from app.shared import simova
from app.shared.errors import DomainError


@dataclass
class RelatorioFT:
    importados: int = 0
    erros: list[str] = field(default_factory=list)


def importar_ft(session: Session, arquivo: BinaryIO, usuario: str) -> RelatorioFT:
    wb = load_workbook(arquivo, read_only=True, data_only=True)
    ws = wb["FT_IMPORT_INTERMEDIARIA"] if "FT_IMPORT_INTERMEDIARIA" in wb.sheetnames else wb.worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = [str(h).strip() if h else "" for h in next(rows)]
    repo = SqlProgramacaoRepository(session)
    rel = RelatorioFT()
    for n, raw in enumerate(rows, start=2):
        if raw is None or all(v is None for v in raw):
            continue
        r = dict(zip(header, raw))
        try:
            inicio, fim = simova.data_br(r["DATA_INICIO"]), simova.data_br(r["DATA_FIM"])
            if inicio is None or fim is None:
                raise ValueError("DATA_INICIO/DATA_FIM obrigatórias")
            dias = []
            d = inicio
            while d <= fim:
                nome = DIAS_SEMANA[d.weekday()]
                pe, hh = simova.numero(r.get(f"PE_{nome}")), simova.numero(r.get(f"HH_{nome}"))
                if pe or hh:
                    dias.append(DiaPlano(d, pe, hh))
                d += timedelta(days=1)
            tarefa = simova.codigo(r.get("CODIGO_TAREFA"))
            item = ItemProgramacao(
                encarregado_cracha=simova.codigo(r["CRACHA_ENCARREGADO"]) or "",
                encarregado_nome=simova.codigo(r["NOME_ENCARREGADO"]) or "",
                grupo_codigo=simova.codigo(r["CODIGO_GRUPO"]) or "",
                grupo_descricao=simova.codigo(r.get("DESCRICAO_GRUPO")) or "",
                oper_codigo=simova.codigo(r["CODIGO_OPER"]) or "",
                oper_descricao=(simova.codigo(r.get("DESCRICAO_OPER")) or "").strip(),
                frente_codigo=simova.codigo(r["CODIGO_FRENTE"]) or "",
                tarefa_codigo=tarefa,
                observacao=simova.codigo(r.get("OBSERVACAO")),
                data_inicio=inicio,
                data_fim=fim,
                origem=Origem.CRONOGRAMA if tarefa else Origem.PADRAO,
                status=Status.APROVADO,
                dias=tuple(dias),
            )
            repo.salvar(item, criado_por=usuario)
            rel.importados += 1
        except (DomainError, KeyError, ValueError) as exc:
            rel.erros.append(f"linha {n}: {exc}")
    return rel
