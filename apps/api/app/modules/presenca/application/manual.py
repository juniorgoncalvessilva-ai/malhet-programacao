"""Presença apontada à mão (spec 147): o apontador marca quem está no dia, em qualquer equipe, sem crachá. Vira uma
leitura `manual` como as do celular (idempotente pelo id_local; a mais cedo do dia vale, spec 069)."""
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.modules.presenca.domain.presenca import validas
from app.modules.presenca.infra.models import LeituraPresencaModel
from app.shared.errors import DomainError

PREFIXO = "apontador"


def _revalidar(s: Session, obra_id: int, colaborador_id: int, dia: date) -> None:
    todas = list(s.scalars(select(LeituraPresencaModel).where(LeituraPresencaModel.obra_id == obra_id,
                                                              LeituraPresencaModel.colaborador_id == colaborador_id,
                                                              LeituraPresencaModel.data == dia)))
    if not todas:
        return
    vid = validas([(x.id, x.hora) for x in todas])
    for x in todas:
        x.valida = x.id == vid


def presentes(s: Session, obra_id: int, dia: date) -> dict[int, dict]:
    """colaborador → a leitura válida do dia (hora, meio, quem apontou)."""
    return {x.colaborador_id: {"hora": x.hora.isoformat(), "meio": x.meio, "por": x.registrado_por}
            for x in s.scalars(select(LeituraPresencaModel).where(LeituraPresencaModel.obra_id == obra_id,
                                                                  LeituraPresencaModel.data == dia,
                                                                  LeituraPresencaModel.valida.is_(True)))}


def marcar(s: Session, obra_id: int, colaborador_id: int, dia: date, equipe_id: int | None, por: str,
           agora: datetime | None = None) -> None:
    agora = agora or datetime.now(timezone.utc)
    s.execute(insert(LeituraPresencaModel).values(
        obra_id=obra_id, id_local=f"apont-{dia.isoformat()}-{colaborador_id}", colaborador_id=colaborador_id, data=dia,
        hora=agora, meio="manual", equipe_id=equipe_id, dispositivo="apontador", registrado_por=(por if por.startswith(PREFIXO) else f"{PREFIXO} {por}")[:80],
    ).on_conflict_do_nothing(constraint="uq_presenca_id_local"))
    s.flush()
    _revalidar(s, obra_id, colaborador_id, dia)
    s.flush()


def desmarcar(s: Session, obra_id: int, colaborador_id: int, dia: date) -> None:
    """Tira só o que foi apontado à mão; presença lida pelo crachá/rosto fica (é prova)."""
    todas = list(s.scalars(select(LeituraPresencaModel).where(LeituraPresencaModel.obra_id == obra_id,
                                                              LeituraPresencaModel.colaborador_id == colaborador_id,
                                                              LeituraPresencaModel.data == dia)))
    lidas = [x for x in todas if not x.registrado_por.startswith(PREFIXO)]
    if lidas:
        from zoneinfo import ZoneInfo

        h = min(x.hora for x in lidas).astimezone(ZoneInfo("America/Sao_Paulo")).strftime("%H:%M")
        raise DomainError(f"presença lida pelo {lidas[0].meio} às {h}: não dá para tirar pelo apontador", "presenca")
    for x in todas:
        s.delete(x)
    s.flush()
