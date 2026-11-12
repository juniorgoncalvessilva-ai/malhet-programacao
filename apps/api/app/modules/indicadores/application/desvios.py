"""Desvios (Pareto): causas da obra, registro por item não cumprido e importação da planilha do Pareto."""
from io import BytesIO

from openpyxl import load_workbook
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.indicadores.domain import causas as dom
from app.modules.indicadores.domain.pareto import ler_detalhamento, nao_cumpridas
from app.modules.indicadores.infra.models import CausaDesvioModel, DesvioModel
from app.shared.errors import DomainError


def causas(s: Session, obra_id: int) -> list[CausaDesvioModel]:
    """Lista de causas da obra; na primeira vez nasce com a do Pareto."""
    lista = list(s.scalars(select(CausaDesvioModel).where(CausaDesvioModel.obra_id == obra_id)
                           .order_by(CausaDesvioModel.numero)))
    if not lista:  # duas telas podem pedir ao mesmo tempo: insere ignorando o que outra requisição já criou
        from sqlalchemy.dialects.postgresql import insert

        s.execute(insert(CausaDesvioModel).values([
            {"obra_id": obra_id, "numero": i, "descricao": d, "ativo": True} for i, d in enumerate(dom.CAUSAS_PADRAO, start=1)
        ]).on_conflict_do_nothing(constraint="uq_causa_desvio_obra"))
        s.flush()
        lista = list(s.scalars(select(CausaDesvioModel).where(CausaDesvioModel.obra_id == obra_id)
                               .order_by(CausaDesvioModel.numero)))
    return lista


def causa_por_texto(s: Session, obra_id: int, texto: str, criar: bool) -> CausaDesvioModel | None:
    lista = causas(s, obra_id)
    alvo = dom.normalizar(texto)
    achada = next((c for c in lista if dom.normalizar(c.descricao) == alvo), None)
    if achada is None and criar:
        achada = CausaDesvioModel(obra_id=obra_id, numero=max((c.numero for c in lista), default=0) + 1,
                                  descricao=" ".join(texto.split())[:150], ativo=True)
        s.add(achada)
        s.flush()
    return achada


def sem_causa(s: Session, obra_id: int, programacao_id: int, foto: dict) -> list:
    """Itens não cumpridos da programação que ainda não têm desvio registrado."""
    com = set(s.scalars(select(DesvioModel.linha_id).where(DesvioModel.obra_id == obra_id,
                                                          DesvioModel.programacao_id == programacao_id,
                                                          DesvioModel.linha_id.is_not(None))))
    return [x for x in nao_cumpridas(foto) if x.linha_id not in com]


def exigir_causas(s: Session, obra_id: int, programacao_id: int, foto: dict) -> None:
    falta = sem_causa(s, obra_id, programacao_id, foto)
    if falta:
        lista = "; ".join(f"linha {x.n} {x.codigo_simova} (fez {x.realizado:g} de {x.previsto:g})" for x in falta[:8])
        mais = f" e mais {len(falta) - 8}" if len(falta) > 8 else ""
        raise DomainError(f"{len(falta)} item(ns) não cumprido(s) sem causa no Pareto: {lista}{mais}. "
                          "Registre o desvio de cada um antes de concluir.", "desvios")


def importar_pareto(s: Session, obra_id: int, conteudo: bytes, usuario: str) -> dict:
    """Importa a aba Detalhamento do Pareto semanal. Reimportar não duplica (mesmo dia + classificação + desvio +
    frente); causa que não está na lista entra nela."""
    from app.modules.planejamento.domain.periodo import numero_semana

    try:
        wb = load_workbook(BytesIO(conteudo), read_only=True, data_only=True)
    except Exception as e:  # noqa: BLE001
        raise DomainError(f"arquivo não é uma planilha .xlsx válida ({e.__class__.__name__})", "arquivo") from e
    aba = next((w for w in wb.worksheets if w.title.strip().casefold() == "detalhamento"), None)
    if aba is None:
        raise DomainError("a planilha não tem a aba Detalhamento", "arquivo")
    linhas, avisos = ler_detalhamento([tuple(r) for r in aba.iter_rows(values_only=True)])
    from collections import Counter

    # a mesma ocorrência pode aparecer mais de uma vez no Pareto (conta na recorrência): reimportar só traz o que
    # passa da quantidade que já está no app para cada (dia, classificação, desvio, frente)
    existentes = Counter((d.data, d.causa_id, (d.descricao or "").casefold(), (d.frente or "").casefold())
                         for d in s.scalars(select(DesvioModel).where(DesvioModel.obra_id == obra_id)))
    no_arquivo: Counter = Counter()
    novas_causas_antes = len(causas(s, obra_id))
    n = rep = 0
    for x in linhas:
        c = causa_por_texto(s, obra_id, x.classificacao, criar=True)
        chave = (x.data, c.id, x.desvio.casefold(), (x.frente or "").casefold())
        no_arquivo[chave] += 1
        if no_arquivo[chave] <= existentes[chave]:
            rep += 1
            continue
        s.add(DesvioModel(obra_id=obra_id, data=x.data, semana=numero_semana(x.data), causa_id=c.id,
                          referencia=(x.referencia or None) and x.referencia[:80], descricao=x.desvio[:500],
                          frente=x.frente and x.frente[:200], acao=x.acao and x.acao[:500],
                          responsavel=x.responsavel and x.responsavel[:150], gerencia=x.gerencia and x.gerencia[:80],
                          status=x.status, atividade_impactada=x.atividade_impactada and x.atividade_impactada[:300],
                          origem="importado", criado_por=usuario))
        n += 1
    s.flush()
    return {"importados": n, "repetidos": rep, "lidos": len(linhas),
            "causas_novas": len(causas(s, obra_id)) - novas_causas_antes, "avisos": avisos[:50]}


def exportar_pareto(s: Session, obra_id: int, desvios: list[DesvioModel], titulo_obra: str = "") -> bytes:
    """Pareto de Desvios no layout da planilha da obra: Gráfico, Detalhamento (status com ícones) e Dados."""
    from datetime import date

    from app.modules.indicadores.application.excel_pareto import exportar

    lista = causas(s, obra_id)
    nomes = {c.id: c.descricao for c in lista}
    linhas = [{"id": d.id, "data": d.data, "semana": d.semana, "referencia": d.referencia, "causa": nomes.get(d.causa_id, "?"),
               "descricao": d.descricao, "frente": d.frente, "acao": d.acao, "responsavel": d.responsavel,
               "gerencia": d.gerencia, "status": d.status, "atividade_impactada": d.atividade_impactada} for d in desvios]
    return exportar(linhas, [c.descricao for c in lista if c.ativo], titulo_obra or "Obra", date.today())


def contar(s: Session, obra_id: int) -> int:
    return s.scalar(select(func.count()).select_from(DesvioModel).where(DesvioModel.obra_id == obra_id)) or 0
