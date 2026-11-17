"""Juntar o cadastro feito no campo à pessoa do efetivo (spec 103).

O cadastro simplificado (crachá lido sem cadastro, spec 065) nasce com nome + função e sem matrícula. Quando o DP/RH
informa a matrícula e ela já é de alguém do efetivo, é a mesma pessoa: tudo o que foi registrado no cadastro provisório
(presenças, crachá/NFC/rosto, termo LGPD, assinaturas, testes, ASO, treinamentos, mobilização, liderança) passa para a
pessoa do efetivo e o provisório sai. Os dados do DP (nome, função, situação) valem — são a fonte oficial.
"""
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.db import Base
from app.modules.efetivo.infra.models import ColaboradorModel
from app.modules.presenca.infra.models import IdentificacaoModel
from app.shared.errors import DomainError

_IDENTIFICACAO = ("codigo", "nfc_serial", "face_descritor", "face_em", "consentimento_em", "consentimento_por")


def _juntar_identificacao(s: Session, obra_id: int, de: int, para: int) -> None:
    """Uma identificação por pessoa: a do efetivo fica; o que ela não tem vem do cadastro do campo."""
    q = lambda cid: s.scalar(select(IdentificacaoModel).where(IdentificacaoModel.obra_id == obra_id,  # noqa: E731
                                                               IdentificacaoModel.colaborador_id == cid))
    origem, destino = q(de), q(para)
    if origem is None:
        return
    if destino is None:
        origem.colaborador_id = para
        return
    valores = {k: getattr(origem, k) for k in _IDENTIFICACAO}
    s.delete(origem)
    s.flush()  # código e NFC são únicos na obra: o provisório sai antes de passar os dele
    rosto = destino.face_descritor is None and valores["face_descritor"] is not None
    for k in ("codigo", "nfc_serial"):
        if getattr(destino, k) is None and valores[k]:
            setattr(destino, k, valores[k])
    if rosto:  # o rosto vai com o consentimento que o autorizou
        for k in ("face_descritor", "face_em", "consentimento_em", "consentimento_por"):
            setattr(destino, k, valores[k])


def unificar(s: Session, obra_id: int, de: ColaboradorModel, para: ColaboradorModel) -> dict:
    if de.id == para.id or de.obra_id != obra_id or para.obra_id != obra_id:
        raise DomainError("escolha duas pessoas diferentes da obra")
    if not de.cadastro_pendente:
        raise DomainError(f"{de.nome} não é um cadastro do campo para completar")
    movidos: dict[str, int] = {}
    _juntar_identificacao(s, obra_id, de.id, para.id)
    # toda tabela que aponta para o colaborador passa a apontar para a pessoa do efetivo
    for t in Base.metadata.sorted_tables:
        if t.name == "identificacao_pessoa":
            continue
        for fk in t.foreign_keys:
            if fk.column.table.name != "colaborador":
                continue
            col = t.c[fk.parent.name]
            r = s.execute(update(t).where(col == de.id).values({col.name: para.id}))
            if r.rowcount:
                movidos[f"{t.name}.{col.name}"] = r.rowcount
    # equipes guardam o crachá (texto): o do provisório vira o da pessoa do efetivo
    if de.cracha and para.cracha and de.cracha != para.cracha:
        from app.modules.equipes.infra.models import EquipeMembroModel, EquipeModel

        for m in s.scalars(select(EquipeMembroModel).where(EquipeMembroModel.cracha == de.cracha)):
            ja = s.scalar(select(EquipeMembroModel.id).where(EquipeMembroModel.equipe_id == m.equipe_id,
                                                             EquipeMembroModel.cracha == para.cracha))
            if ja:
                s.delete(m)
            else:
                m.cracha, m.nome = para.cracha, para.nome
        s.execute(update(EquipeModel).where(EquipeModel.obra_id == obra_id, EquipeModel.encarregado_cracha == de.cracha)
                  .values(encarregado_cracha=para.cracha, encarregado_nome=para.nome))
    nome_campo, funcao_campo = de.nome, de.funcao
    s.delete(de)
    para.cadastro_pendente = False
    s.flush()
    return {"id": para.id, "nome": para.nome, "matricula": para.matricula, "funcao": para.funcao,
            "cadastro_pendente": False, "unificado": True, "do_campo": {"nome": nome_campo, "funcao": funcao_campo},
            "registros_movidos": sum(movidos.values())}
