"""Gera as planilhas que retroalimentam o Simova."""
from io import BytesIO

from openpyxl import Workbook
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.cadastros.infra.models import OperModel
from app.modules.integracao_simova.domain import layout
from app.modules.programacao.domain.item_programacao import DIAS_SEMANA, ItemProgramacao
from app.shared import simova


def linha_ft(item: ItemProgramacao) -> list:
    por_dia = {d.dia_semana: d for d in item.dias}
    valores: dict[str, object] = {
        "CRACHA_ENCARREGADO": item.encarregado_cracha,
        "NOME_ENCARREGADO": item.encarregado_nome,
        "CODIGO_GRUPO": item.grupo_codigo,
        "CODIGO_OPER": item.oper_codigo,
        "DESCRICAO_GRUPO": item.grupo_descricao,
        "DESCRICAO_OPER": item.oper_descricao,
        "CODIGO_TAREFA": item.tarefa_codigo,
        "CODIGO_FRENTE": item.frente_codigo,
        "OBSERVACAO": item.observacao,
        "DATA_INICIO": simova.fmt_data_br(item.data_inicio),
        "DATA_FIM": simova.fmt_data_br(item.data_fim),
    }
    for nome in DIAS_SEMANA:
        d = por_dia.get(nome)
        valores[f"PE_{nome}"] = _num(d.pe) if d else None
        valores[f"HH_{nome}"] = _num(d.hh) if d else None
    return [valores.get(c) for c in layout.FT_IMPORT_INTERMEDIARIA]


def _num(v: float | None) -> str | None:
    if v is None:
        return None
    return str(int(v)) if float(v).is_integer() else str(v)


def gerar_ft_xlsx(itens: list[ItemProgramacao]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "FT_IMPORT_INTERMEDIARIA"
    ws.append(layout.FT_IMPORT_INTERMEDIARIA)
    for item in itens:
        ws.append(linha_ft(item))
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def gerar_oper_pendentes_xlsx(session: Session, obra_id: int) -> tuple[bytes, int]:
    """OPERs criadas/alteradas na aplicação e ainda não enviadas ao Simova (aba OPER)."""
    opers = list(session.scalars(select(OperModel).where(OperModel.obra_id == obra_id, OperModel.pendente_envio_simova.is_(True))))
    wb = Workbook()
    ws = wb.active
    ws.title = "OPER"
    ws.append(layout.OPER)
    for o in opers:
        ws.append([o.codigo, o.descricao, ";".join(o.materiais) or None, o.grupo_codigo,
                   o.hh_prev, o.unidade_medida, o.insumo, "1", None, o.tarefa_codigo, "1" if o.ativo else "0"])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue(), len(opers)
