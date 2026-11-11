"""Carga da Composição de Custo Unitário da obra (.xls/.xlsx) como versão CPU vigente.

Substitui as abas RECURSOS/ÍNDICES da planilha auxiliar: para cada composição grava o h/un de cada função e
equipamento (auxiliares já multiplicadas) em `cpu_recurso`, o resumo (recurso que governa, HH/un, custo) em
`cpu_composicao`, e o vínculo item da PQ → composição em `cpu_servico`.
"""
from typing import BinaryIO

from sqlalchemy.orm import Session

from app.modules.referencias.application.versoes import ResultadoCarga, ativar_versao, nova_versao
from app.modules.referencias.domain import cpu_obra
from app.modules.referencias.infra.models import CpuComposicaoModel, CpuLinhaModel, CpuRecursoModel, CpuServicoModel
from app.shared.errors import DomainError


def ler_linhas(arquivo: BinaryIO, nome_arquivo: str) -> list[list]:
    """Planilha → lista de linhas (células cruas). .xls (Excel 97-2003, como o orçamento exporta) ou .xlsx."""
    dados = arquivo.read()
    if dados[:4] == b"\xd0\xcf\x11\xe0" or nome_arquivo.lower().endswith(".xls"):
        import xlrd

        try:
            wb = xlrd.open_workbook(file_contents=dados)
        except xlrd.XLRDError as e:
            raise DomainError(f"não consegui abrir o .xls: {e}") from e
        linhas: list[list] = []
        for sh in wb.sheets():
            linhas.extend(sh.row_values(r) for r in range(sh.nrows))
        return linhas
    from io import BytesIO

    from openpyxl import load_workbook

    try:
        wb = load_workbook(BytesIO(dados), read_only=True, data_only=True)
    except Exception as e:  # noqa: BLE001 — arquivo corrompido / não é planilha
        raise DomainError(f"não consegui abrir a planilha: {e}") from e
    return [list(r) for ws in wb.worksheets for r in ws.iter_rows(values_only=True)]


def carregar_cpu_obra(session: Session, obra_id: int, arquivo: BinaryIO, *, nome_arquivo: str, rotulo: str,
                      usuario: str, ativar: bool = True) -> ResultadoCarga:
    rel = cpu_obra.interpretar(ler_linhas(arquivo, nome_arquivo))
    res = ResultadoCarga(avisos=list(rel.avisos))
    v = nova_versao(session, obra_id, "CPU", rotulo, usuario, None, nome_arquivo,
                    "Composição de Custo Unitário da obra")
    n_rec = 0
    for cod, comp in rel.composicoes.items():
        try:
            recursos = cpu_obra.achatar(rel.composicoes, cod)
        except DomainError as e:
            res.avisos.append(str(e))
            recursos = []
        gov = cpu_obra.recurso_que_governa(recursos)
        session.add(CpuComposicaoModel(
            versao_id=v.id, codigo=cod, descricao=comp.descricao[:500], custo=comp.custo,
            recurso_governa=gov.recurso[:120] if gov else None, coef_governa=gov.coef_por_unidade if gov else None,
            hh_por_unidade=round(sum(r.coef_por_unidade for r in recursos if r.tipo == "MOD"), 6) or None,
            linha_arquivo=comp.linha))
        # linhas como estão no relatório: base da memória de cálculo (de onde sai cada h/un)
        for i, ln in enumerate(comp.linhas, start=1):
            session.add(CpuLinhaModel(versao_id=v.id, composicao=cod, ordem=i, codigo=ln.codigo[:60],
                                      descricao=ln.descricao[:300], unid=(ln.unid or None) and ln.unid[:10],
                                      quantidade=ln.quantidade, preco=ln.preco, linha_arquivo=ln.linha))
        for r in recursos:
            session.add(CpuRecursoModel(versao_id=v.id, composicao=cod, recurso=r.recurso[:120], tipo=r.tipo,
                                        unid_recurso=r.unid[:10], coef_por_unidade=r.coef_por_unidade))
            n_rec += 1
    vistos: set[str] = set()
    for sv in rel.servicos:
        if sv.item in vistos:
            res.avisos.append(f"item {sv.item_original} aparece mais de uma vez; ficou a primeira composição")
            continue
        vistos.add(sv.item)
        if not sv.composicao:
            res.avisos.append(f"item {sv.item_original} sem composição")
            continue
        session.add(CpuServicoModel(versao_id=v.id, item=sv.item, item_original=sv.item_original,
                                    descricao=sv.descricao[:500], unid=sv.unid, quantidade=sv.quantidade,
                                    composicao=sv.composicao, custo_unitario=sv.custo_unitario,
                                    linha_arquivo=sv.linha))
    sem_mo = sum(1 for sv in rel.servicos
                 if sv.composicao and not any(True for _ in cpu_obra.achatar(rel.composicoes, sv.composicao)))
    if sem_mo:
        res.avisos.append(f"{sem_mo} itens da PQ sem mão de obra nem equipamento na CPU (subempreitados/verbas): "
                          "sem HH e sem índice")
    v.qtd_itens = len(vistos)
    session.flush()
    if ativar:
        ativar_versao(session, v.id, obra_id)
    res.versoes["CPU"] = v.id
    res.contagem.update({"ITENS_PQ": len(vistos), "COMPOSICOES": len(rel.composicoes), "RECURSOS": n_rec})
    return res
