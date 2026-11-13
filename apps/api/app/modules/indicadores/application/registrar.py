"""Grava o histórico da programação (fato linha × dia) a partir da foto da emissão e da conclusão.

Recebe a visão congelada da programação (linguagem publicada do planejamento), não os modelos dela.
- na emissão: as linhas da revisão anterior deixam de ser vigentes e entram as desta revisão (o que foi programado,
  como, e o que a capacidade dava em cada dia);
- na conclusão: a revisão vigente é regravada com o realizado (o previsto não muda depois de emitido).
"""
from datetime import date

from sqlalchemy import delete, update
from sqlalchemy.orm import Session

from app.modules.indicadores.infra.models import FatoProgramacaoModel
from app.modules.planejamento.domain.periodo import numero_semana


def _i(lista, i):
    return lista[i] if lista and i < len(lista) else None


def linhas_do_fato(foto: dict, obra_id: int, programacao_id: int, revisao: int, concluida: bool,
                   conclusao: int | None) -> list[FatoProgramacaoModel]:
    out = []
    datas = [date.fromisoformat(d["data"]) for d in foto["dias"]]
    for loc in foto["locais"]:
        for a in loc["areas"]:
            for ln in a["linhas"]:
                c = ln.get("calc") or {}
                for i, d in enumerate(datas):
                    prev, real = _i(ln["previsto"], i), _i(ln["realizado"], i)
                    cap, sug = _i(c.get("capacidade_dia"), i), _i(c.get("previsto_sugerido"), i)
                    if not (prev or real or sug or cap):  # capacidade conta em todo dia útil do período
                        continue
                    fator = _i(c.get("fator_dia"), i)
                    pessoas, jornada = ln.get("pessoas"), c.get("jornada")
                    trabalhou = bool(prev or real)
                    out.append(FatoProgramacaoModel(
                        obra_id=obra_id, programacao_id=programacao_id, linha_id=ln["id"], revisao=revisao, vigente=True,
                        concluida=concluida, conclusao=conclusao, tipo_programacao=foto["tipo"], titulo=foto["titulo"][:120],
                        data=d, semana=numero_semana(d), n_linha=ln["n"], natureza=ln.get("natureza") or "P",
                        modo_previsto=ln.get("modo_previsto") or "manual", base_capacidade=foto.get("base_capacidade") or "equipe",
                        previsto=prev, qtd_periodo=ln.get("qtd_periodo"), capacidade=cap,
                        capacidade_equipe=_i(c.get("capacidade_equipe_dia"), i),
                        capacidade_governa=_i(c.get("capacidade_governa_dia"), i), sugerido=sug,
                        horas_dia=_i(c.get("horas_dia"), i), hh_un=c.get("hh_un"), hh_previsto=_i(c.get("hh_previsto"), i),
                        realizado=real if concluida else None,
                        hh_realizado_cpu=round(real * c["hh_un"], 4) if concluida and real and c.get("hh_un") else None,
                        hh_equipe=round(pessoas * jornada * fator, 4) if concluida and trabalhou and pessoas and jornada and fator else None,
                        pessoas=pessoas, jornada=jornada, equipe_id=ln.get("equipe_id"), equipe=ln.get("equipe"),
                        encarregado=ln.get("encarregado"), cracha=ln.get("cracha"),
                        grupo=f"{ln['grupo']['codigo']} · {ln['grupo']['descricao']}"[:200], codigo_simova=ln.get("codigo_simova"),
                        descricao=(ln.get("descricao") or "")[:400], item_pq=ln.get("item_pq"), unidade=ln.get("unidade"),
                        area_id=a["id"], area=f"{a['codigo']} · {a['descricao']}"[:200], local=f"{loc['codigo']} · {loc['descricao']}"[:200],
                        wbs_codigo=ln.get("wbs_codigo"), id_crono=ln.get("id_crono")))
    return out


def na_emissao(s: Session, obra_id: int, programacao_id: int, revisao: int, foto: dict) -> int:
    s.execute(update(FatoProgramacaoModel).where(FatoProgramacaoModel.programacao_id == programacao_id)
              .values(vigente=False))
    novas = linhas_do_fato(foto, obra_id, programacao_id, revisao, False, None)
    s.add_all(novas)
    s.flush()
    return len(novas)


def ao_excluir_emissao(s: Session, programacao_id: int, revisao: int, reativar: int | None) -> None:
    """Revisão emitida excluída (spec 060): some o histórico dela; se era a vigente, a anterior volta a valer."""
    s.execute(delete(FatoProgramacaoModel).where(FatoProgramacaoModel.programacao_id == programacao_id,
                                                 FatoProgramacaoModel.revisao == revisao))
    if reativar is not None:
        s.execute(update(FatoProgramacaoModel).where(FatoProgramacaoModel.programacao_id == programacao_id,
                                                     FatoProgramacaoModel.revisao == reativar).values(vigente=True))
    s.flush()


def na_conclusao(s: Session, obra_id: int, programacao_id: int, revisao: int, numero: int, foto: dict) -> int:
    s.execute(delete(FatoProgramacaoModel).where(FatoProgramacaoModel.programacao_id == programacao_id,
                                                 FatoProgramacaoModel.vigente.is_(True)))
    s.execute(update(FatoProgramacaoModel).where(FatoProgramacaoModel.programacao_id == programacao_id)
              .values(vigente=False))
    novas = linhas_do_fato(foto, obra_id, programacao_id, revisao, True, numero)
    s.add_all(novas)
    s.flush()
    return len(novas)
