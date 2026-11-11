"""Importação semanal do efetivo (planilha do DP, .xls ou .xlsx).

Pela chave (matrícula): novo → cria; existente → atualiza nome, função e situação e registra o que mudou.
Quem estava cadastrado e não veio no arquivo NÃO é apagado nem sai da equipe: fica marcado "fora do último arquivo".
Registro provisório (sem matrícula) ganha a matrícula quando ela aparece, pelo nome.
"""
from io import BytesIO
from typing import BinaryIO

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.efetivo.domain.efetivo import (
    ColaboradorLido,
    chave_provisoria,
    chave_texto,
    interpretar_planilha,
)
from app.modules.efetivo.infra.models import ColaboradorModel, ImportacaoEfetivoModel, MovimentoEfetivoModel
from app.shared.errors import DomainError


def ler_abas(arquivo: BinaryIO, nome_arquivo: str) -> list[tuple[str, list[list]]]:
    dados = arquivo.read()
    if dados[:4] == b"\xd0\xcf\x11\xe0" or nome_arquivo.lower().endswith(".xls"):
        import xlrd

        try:
            wb = xlrd.open_workbook(file_contents=dados)
        except xlrd.XLRDError as e:
            raise DomainError(f"não consegui abrir o .xls: {e}") from e
        return [(sh.name, [sh.row_values(r) for r in range(sh.nrows)]) for sh in wb.sheets()]
    from openpyxl import load_workbook

    try:
        wb = load_workbook(BytesIO(dados), read_only=True, data_only=True)
    except Exception as e:  # noqa: BLE001
        raise DomainError(f"não consegui abrir a planilha: {e}") from e
    return [(ws.title, [list(r) for r in ws.iter_rows(values_only=True)]) for ws in wb.worksheets]


_CAMPOS = ("empresa", "matricula", "nome", "funcao", "dp", "tipo_mo", "status_original", "situacao",
           "mobilizacao_prevista", "admissao", "demissao", "cracha_vale", "rac2", "paebm")


def _aplicar(m: ColaboradorModel, c: ColaboradorLido) -> None:
    for k in _CAMPOS:
        v = getattr(c, k)
        setattr(m, k, v.value if k == "situacao" else v)
    m.funcao_chave = chave_texto(c.funcao) or None
    if c.cracha and not m.cracha:
        m.cracha = c.cracha
    m.no_ultimo_arquivo = True


def importar_efetivo(s: Session, obra_id: int, arquivo: BinaryIO, *, nome_arquivo: str, usuario: str) -> dict:
    lidos = interpretar_planilha(ler_abas(arquivo, nome_arquivo))
    imp = ImportacaoEfetivoModel(obra_id=obra_id, arquivo=nome_arquivo[:255], importado_por=usuario, resumo={})
    s.add(imp)
    s.flush()
    existentes = {m.chave: m for m in s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == obra_id))}
    provisorios = {k: m for k, m in existentes.items() if ":NOME:" in k}
    novos = atualizados = 0
    mudancas: dict[str, int] = {}
    vistos: set[int] = set()

    def mov(m: ColaboradorModel, tipo: str, de, para) -> None:
        s.add(MovimentoEfetivoModel(obra_id=obra_id, colaborador_id=m.id, tipo=tipo, de=(str(de)[:150] if de else None),
                                    para=(str(para)[:150] if para else None), importacao_id=imp.id, por=usuario))

    for c in lidos:
        m = existentes.get(c.chave)
        if m is None and ":NOME:" not in c.chave:  # ganhou matrícula: era provisório?
            m = provisorios.get(chave_provisoria(c.empresa, c.nome))
            if m is not None:
                del existentes[m.chave]
                m.chave = c.chave
                existentes[c.chave] = m
        if m is None:
            m = ColaboradorModel(obra_id=obra_id, chave=c.chave, origem="efetivo", situacao=c.situacao.value,
                                 empresa=c.empresa, nome=c.nome)
            _aplicar(m, c)
            s.add(m)
            s.flush()
            existentes[c.chave] = m
            mov(m, "ENTRADA", None, c.situacao.rotulo)
            novos += 1
        else:
            if m.situacao != c.situacao.value:
                from app.modules.efetivo.domain.efetivo import Situacao

                mov(m, "SITUACAO", Situacao(m.situacao).rotulo if m.situacao in Situacao._value2member_map_ else m.situacao,
                    c.situacao.rotulo)
                chave = f"{m.situacao}→{c.situacao.value}"
                mudancas[chave] = mudancas.get(chave, 0) + 1
            if chave_texto(m.funcao) != chave_texto(c.funcao):
                mov(m, "FUNCAO", m.funcao, c.funcao)
            if not m.no_ultimo_arquivo:
                mov(m, "SITUACAO", "Fora do arquivo", "Voltou ao arquivo")
            _aplicar(m, c)
            atualizados += 1
        vistos.add(m.id)
    # limpa linhas do quadro de totais que versões antigas da leitura gravaram como pessoa
    from app.modules.efetivo.domain.efetivo import e_quadro_de_totais

    removidos = 0
    for k, m in list(existentes.items()):
        if m.id not in vistos and m.origem == "efetivo" and (e_quadro_de_totais(m.funcao, m.matricula) or
                                                            not (m.matricula or m.funcao or m.cracha)):
            s.delete(m)
            del existentes[k]
            removidos += 1
    fora = 0
    for m in existentes.values():
        if m.id not in vistos and m.origem == "efetivo" and m.no_ultimo_arquivo:
            m.no_ultimo_arquivo = False
            mov(m, "FORA_DO_ARQUIVO", None, nome_arquivo[:150])
            fora += 1
    imp.resumo = {"lidos": len(lidos), "novos": novos, "atualizados": atualizados, "fora_do_arquivo": fora, "linhas_de_total_removidas": removidos,
                  "sem_matricula": sum(1 for c in lidos if not c.matricula), "mudancas_situacao": mudancas}
    s.flush()
    return {"importacao_id": imp.id, **imp.resumo}
