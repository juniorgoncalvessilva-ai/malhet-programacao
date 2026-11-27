"""Falta e empréstimo do dia (spec 152). Quem chama (rota do apontador ou o Planejamento) passa a obra e quem registrou."""
from datetime import date
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.modules.efetivo.infra.gateway import codigo_normal
from app.modules.efetivo.infra.models import ColaboradorModel
from app.modules.equipes.infra.models import EquipeModel
from app.modules.presenca.application import manual
from app.modules.presenca.domain.apontamento import MOTIVOS_FALTA, Emprestimo, Falta
from app.modules.presenca.infra.models import EmprestimoModel, FaltaModel, LeituraPresencaModel
from app.shared.errors import DomainError

FORA = ("DESMOBILIZADO", "DESISTENCIA")


def _pessoa(s: Session, obra_id: int, cid: int) -> ColaboradorModel:
    x = s.get(ColaboradorModel, cid)
    if x is None or x.obra_id != obra_id:
        raise DomainError("pessoa não está no efetivo desta obra", "colaborador_id")
    return x


def equipes_ativas(s: Session, obra_id: int) -> list[EquipeModel]:
    return list(s.scalars(select(EquipeModel).where(EquipeModel.obra_id == obra_id, EquipeModel.ativo.is_(True))
                          .order_by(EquipeModel.nome)))


def equipe_da_pessoa(equipes: list[EquipeModel], x: ColaboradorModel) -> EquipeModel | None:
    """A equipe em que a pessoa está (membro; senão, a que ela encarrega)."""
    cods = {codigo_normal(c) for c in (x.cracha, x.matricula)} - {""}
    membro = next((e for e in equipes if any(codigo_normal(m.cracha) in cods for m in e.membros)), None)
    return membro or next((e for e in equipes if codigo_normal(e.encarregado_cracha) in cods), None)


# ---- falta ---------------------------------------------------------------------------------------------------------
def marcar_falta(s: Session, obra_id: int, cid: int, dia: date, motivo: str, observacao: str | None, por: str) -> dict:
    x = _pessoa(s, obra_id, cid)
    f = Falta(motivo, observacao)
    lidas = [lt for lt in s.scalars(select(LeituraPresencaModel).where(
        LeituraPresencaModel.obra_id == obra_id, LeituraPresencaModel.colaborador_id == cid, LeituraPresencaModel.data == dia))
        if lt.meio != "manual" or not (lt.registrado_por or "").startswith(manual.PREFIXO)]
    if lidas:
        h = min(lt.hora for lt in lidas).astimezone(ZoneInfo("America/Sao_Paulo")).strftime("%H:%M")
        raise DomainError(f"{x.nome} teve a presença lida pelo {lidas[0].meio} às {h}: não é falta", "colaborador_id")
    manual.desmarcar(s, obra_id, cid, dia)  # a presença à mão do apontador sai: agora é falta
    eq = equipe_da_pessoa(equipes_ativas(s, obra_id), x)
    reg = s.scalar(select(FaltaModel).where(FaltaModel.obra_id == obra_id, FaltaModel.colaborador_id == cid, FaltaModel.data == dia))
    if reg is None:
        reg = FaltaModel(obra_id=obra_id, colaborador_id=cid, data=dia)
        s.add(reg)
    reg.motivo, reg.observacao, reg.equipe_id, reg.por = f.motivo, f.observacao, eq.id if eq else None, por[:80]
    s.flush()
    return falta_out(reg)


def tirar_falta(s: Session, obra_id: int, cid: int, dia: date) -> None:
    s.execute(delete(FaltaModel).where(FaltaModel.obra_id == obra_id, FaltaModel.colaborador_id == cid, FaltaModel.data == dia))
    s.flush()


def falta_out(f: FaltaModel) -> dict:
    rot, just = MOTIVOS_FALTA.get(f.motivo, (f.motivo, False))
    return {"motivo": f.motivo, "rotulo": rot, "justificada": just, "observacao": f.observacao, "por": f.por}


def faltas_do_dia(s: Session, obra_id: int, dia: date) -> dict[int, dict]:
    return {f.colaborador_id: falta_out(f) for f in s.scalars(select(FaltaModel).where(FaltaModel.obra_id == obra_id, FaltaModel.data == dia))}


# ---- empréstimo ----------------------------------------------------------------------------------------------------
def emprestar(s: Session, obra_id: int, cid: int, dia: date, para_equipe_id: int, justificativa: str, por: str) -> dict:
    x = _pessoa(s, obra_id, cid)
    if x.situacao in FORA:
        raise DomainError(f"{x.nome} está {x.situacao.lower()} no efetivo", "colaborador_id")
    equipes = equipes_ativas(s, obra_id)
    para = next((e for e in equipes if e.id == para_equipe_id), None)
    if para is None:
        raise DomainError("equipe inválida", "para_equipe_id")
    de = equipe_da_pessoa(equipes, x)
    emp = Emprestimo(de.id if de else None, para.id, justificativa)
    reg = s.scalar(select(EmprestimoModel).where(EmprestimoModel.obra_id == obra_id, EmprestimoModel.colaborador_id == cid,
                                                 EmprestimoModel.data == dia))
    if reg is None:
        reg = EmprestimoModel(obra_id=obra_id, colaborador_id=cid, data=dia)
        s.add(reg)
    reg.de_equipe_id, reg.de_equipe_nome = emp.de_equipe_id, (de.nome if de else None)
    reg.para_equipe_id, reg.para_equipe_nome = para.id, para.nome
    reg.justificativa, reg.por = emp.justificativa, por[:80]
    tirar_falta(s, obra_id, cid, dia)
    _equipe_das_leituras(s, obra_id, cid, dia, para.id)
    s.flush()
    return emprestimo_out(reg)


def devolver(s: Session, obra_id: int, cid: int, dia: date) -> None:
    x = _pessoa(s, obra_id, cid)
    s.execute(delete(EmprestimoModel).where(EmprestimoModel.obra_id == obra_id, EmprestimoModel.colaborador_id == cid,
                                            EmprestimoModel.data == dia))
    de = equipe_da_pessoa(equipes_ativas(s, obra_id), x)
    _equipe_das_leituras(s, obra_id, cid, dia, de.id if de else None)
    s.flush()


def _equipe_das_leituras(s: Session, obra_id: int, cid: int, dia: date, equipe_id: int | None) -> None:
    for lt in s.scalars(select(LeituraPresencaModel).where(LeituraPresencaModel.obra_id == obra_id, LeituraPresencaModel.colaborador_id == cid,
                                                           LeituraPresencaModel.data == dia)):
        lt.equipe_id = equipe_id


def emprestimo_out(e: EmprestimoModel) -> dict:
    return {"de_equipe_id": e.de_equipe_id, "de_equipe": e.de_equipe_nome, "para_equipe_id": e.para_equipe_id,
            "para_equipe": e.para_equipe_nome, "justificativa": e.justificativa, "por": e.por}


def emprestimos_do_dia(s: Session, obra_id: int, dia: date) -> dict[int, dict]:
    return {e.colaborador_id: emprestimo_out(e) for e in s.scalars(select(EmprestimoModel).where(
        EmprestimoModel.obra_id == obra_id, EmprestimoModel.data == dia))}


def equipe_do_dia(s: Session, obra_id: int, cid: int, dia: date) -> int | None:
    """A equipe em que a pessoa trabalhou no dia: a que recebeu o empréstimo, senão None (vale a dela)."""
    return s.scalar(select(EmprestimoModel.para_equipe_id).where(EmprestimoModel.obra_id == obra_id, EmprestimoModel.colaborador_id == cid,
                                                                 EmprestimoModel.data == dia))
