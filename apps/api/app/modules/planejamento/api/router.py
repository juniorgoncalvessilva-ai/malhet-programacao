from datetime import date

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, administrar, ler, planejar, programar
from app.core.db import get_session
from app.modules.catalogo.api.router import obter_ou_criar_item
from app.modules.catalogo.infra.models import TipoAtividadeModel
from app.modules.equipes.infra.models import EquipeModel
from app.modules.frentes.infra.models import AreaFrenteModel
from app.modules.planejamento.application import servico as sv
from app.modules.planejamento.domain.periodo import TipoProgramacao, periodo, titulo
from app.modules.planejamento.infra.models import EmissaoModel, LinhaProgramacaoModel, ProgramacaoModel
from app.modules.referencias.application.importar_takeoff import carregar_takeoff
from app.modules.referencias.application.importar_xer import carregar_xer
from app.modules.referencias.infra.models import AtividadeCronogramaModel, ItemPqModel, PqQuantidadeTagModel
from app.modules.referencias.infra.resolvedor import ResolvedorReferencias
from app.shared.errors import DomainError, NotFoundError

router = APIRouter(tags=["programação semanal/mensal"])
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


class NovaIn(BaseModel):
    tipo: TipoProgramacao
    referencia: date
    copiar_de: int | None = None  # copia as linhas (sem valores) de outra programação


class ResumoOut(BaseModel):
    id: int
    tipo: str
    titulo: str
    inicio: date
    fim: date
    status: str
    revisao: int
    linhas: int


class LinhaIn(BaseModel):
    area_id: int
    tipo_id: int
    complemento: str | None = None
    item_pq: str | None = None
    id_crono: str | None = None
    equipe_id: int | None = None
    qtd_projeto: float | None = None
    observacao: str | None = None


class ValorIn(BaseModel):
    data: date
    valor: float | None = None


class ValoresIn(BaseModel):
    campo: str = "previsto"  # previsto | realizado
    valores: list[ValorIn]


def _resumo(p: ProgramacaoModel) -> ResumoOut:
    return ResumoOut(id=p.id, tipo=p.tipo, titulo=p.titulo, inicio=p.inicio, fim=p.fim, status=p.status,
                     revisao=p.revisao, linhas=len(p.linhas))


@router.get("/programacoes", response_model=list[ResumoOut])
def listar(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    q = select(ProgramacaoModel).where(ProgramacaoModel.obra_id == c.obra_id).order_by(ProgramacaoModel.inicio.desc())
    return [_resumo(p) for p in s.scalars(q)]


@router.post("/programacoes", response_model=ResumoOut, status_code=201)
def nova(d: NovaIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    ini, fim = periodo(d.tipo, d.referencia)
    if s.scalar(select(ProgramacaoModel).where(ProgramacaoModel.obra_id == c.obra_id, ProgramacaoModel.tipo == d.tipo.value,
                                              ProgramacaoModel.inicio == ini)):
        raise DomainError(f"já existe programação {d.tipo.value.lower()} começando em {ini:%d/%m/%Y}")
    p = ProgramacaoModel(obra_id=c.obra_id, tipo=d.tipo.value, inicio=ini, fim=fim, titulo=titulo(d.tipo, ini, fim),
                         status="rascunho", revisao=0, criado_por=c.usuario.id)
    if d.copiar_de:
        origem = sv.obter(s, c.obra_id, d.copiar_de)
        p.linhas = [LinhaProgramacaoModel(area_id=x.area_id, tipo_id=x.tipo_id, item_simova_id=x.item_simova_id,
                                          item_pq=x.item_pq, id_crono=x.id_crono, equipe_id=x.equipe_id,
                                          qtd_projeto=x.qtd_projeto, observacao=x.observacao, ordem=x.ordem)
                    for x in origem.linhas]
    s.add(p)
    s.flush()
    return _resumo(p)


@router.get("/programacoes/{pid}")
def ver(pid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return sv.visao(s, sv.obter(s, c.obra_id, pid))


@router.delete("/programacoes/{pid}", status_code=204)
def excluir(pid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    p = sv.obter(s, c.obra_id, pid)
    if p.revisao > 0:
        raise DomainError("programação já emitida não pode ser excluída")
    s.delete(p)


def _validar_linha(s: Session, c: ContextoObra, d: LinhaIn) -> tuple[TipoAtividadeModel, int | None, str | None]:
    a = s.get(AreaFrenteModel, d.area_id)
    if a is None or a.obra_id != c.obra_id:
        raise NotFoundError("Área", d.area_id)
    t = s.get(TipoAtividadeModel, d.tipo_id)
    if t is None or t.obra_id != c.obra_id:
        raise NotFoundError("Tipo", d.tipo_id)
    if d.equipe_id:
        e = s.get(EquipeModel, d.equipe_id)
        if e is None or e.obra_id != c.obra_id:
            raise NotFoundError("Equipe", d.equipe_id)
    item_id, aviso = None, None
    if d.complemento and d.complemento.strip(" ()"):
        item, _, aviso = obter_ou_criar_item(s, c.obra_id, t, d.complemento, d.item_pq)
        item_id = item.id
    return t, item_id, aviso


@router.post("/programacoes/{pid}/linhas", status_code=201)
def nova_linha(pid: int, d: LinhaIn, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    p = sv.obter(s, c.obra_id, pid)
    sv.exigir_rascunho(p)
    _, item_id, aviso = _validar_linha(s, c, d)
    ln = LinhaProgramacaoModel(area_id=d.area_id, tipo_id=d.tipo_id, item_simova_id=item_id, item_pq=d.item_pq or None,
                               id_crono=d.id_crono or None, equipe_id=d.equipe_id, qtd_projeto=d.qtd_projeto,
                               observacao=d.observacao, ordem=(max([x.ordem for x in p.linhas], default=0) + 1))
    p.linhas.append(ln)
    s.flush()
    return {"id": ln.id, "aviso": aviso}


@router.put("/programacoes/{pid}/linhas/{lid}")
def editar_linha(pid: int, lid: int, d: LinhaIn, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    p = sv.obter(s, c.obra_id, pid)
    sv.exigir_rascunho(p)
    ln = next((x for x in p.linhas if x.id == lid), None)
    if ln is None:
        raise NotFoundError("Linha", lid)
    _, item_id, aviso = _validar_linha(s, c, d)
    ln.area_id, ln.tipo_id, ln.item_simova_id = d.area_id, d.tipo_id, item_id
    ln.item_pq, ln.id_crono, ln.equipe_id = d.item_pq or None, d.id_crono or None, d.equipe_id
    ln.qtd_projeto, ln.observacao = d.qtd_projeto, d.observacao
    s.flush()
    return {"id": ln.id, "aviso": aviso}


@router.delete("/programacoes/{pid}/linhas/{lid}", status_code=204)
def excluir_linha(pid: int, lid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    p = sv.obter(s, c.obra_id, pid)
    sv.exigir_rascunho(p)
    ln = next((x for x in p.linhas if x.id == lid), None)
    if ln is None:
        raise NotFoundError("Linha", lid)
    p.linhas.remove(ln)
    s.flush()


@router.put("/programacoes/{pid}/linhas/{lid}/valores", status_code=204)
def valores(pid: int, lid: int, d: ValoresIn, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    if d.campo not in ("previsto", "realizado"):
        raise DomainError("campo deve ser previsto ou realizado", "campo")
    p = sv.obter(s, c.obra_id, pid)
    sv.salvar_valores(s, p, lid, [v.model_dump() for v in d.valores], d.campo)


@router.post("/programacoes/{pid}/emitir")
def emitir(pid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    e = sv.emitir(s, sv.obter(s, c.obra_id, pid), c.usuario.id)
    return {"revisao": e.revisao}


@router.post("/programacoes/{pid}/reabrir", status_code=204)
def reabrir(pid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    sv.reabrir(sv.obter(s, c.obra_id, pid))


@router.get("/programacoes/{pid}/emissoes")
def emissoes(pid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    sv.obter(s, c.obra_id, pid)
    q = select(EmissaoModel).where(EmissaoModel.programacao_id == pid).order_by(EmissaoModel.revisao.desc())
    return [{"revisao": e.revisao, "emitida_em": e.emitida_em, "emitida_por": e.emitida_por} for e in s.scalars(q)]


@router.get("/programacoes/{pid}/emissoes/{rev}")
def emissao(pid: int, rev: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    sv.obter(s, c.obra_id, pid)
    e = s.scalar(select(EmissaoModel).where(EmissaoModel.programacao_id == pid, EmissaoModel.revisao == rev))
    if e is None:
        raise NotFoundError("Emissão", rev)
    return {**e.foto, "emitida_em": e.emitida_em.isoformat(), "emitida_por": e.emitida_por}


@router.get("/programacoes/{pid}/ft")
def ft(pid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(administrar)):
    p = sv.obter(s, c.obra_id, pid)
    conteudo, n, pend = sv.ft_xlsx(s, p)
    nome = f"FT_IMPORT_INTERMEDIARIA_{p.inicio:%Y%m%d}_{p.fim:%Y%m%d}.xlsx"
    return Response(conteudo, media_type=XLSX, headers={
        "Content-Disposition": f'attachment; filename="{nome}"', "X-Itens": str(n), "X-Pendencias": str(len(pend))})


@router.get("/simova/cadastros.xlsx")
def cadastros(s: Session = Depends(get_session), c: ContextoObra = Depends(administrar)):
    return Response(sv.cadastros_simova_xlsx(s, c.obra_id), media_type=XLSX,
                    headers={"Content-Disposition": 'attachment; filename="SIMOVA_FRENTE_OPER.xlsx"'})


# ---- apoio à montagem ------------------------------------------------------------------------------
@router.get("/pq/itens")
def itens_pq(q: str | None = None, tag: str | None = None, limite: int = 40, s: Session = Depends(get_session),
             c: ContextoObra = Depends(ler)):
    """Busca na PQ vigente; com tag, traz a quantidade do take-off daquela TAG."""
    vig = ResolvedorReferencias(s, c.obra_id).versoes_vigentes().get("PQ")
    if not vig:
        return []
    stmt = select(ItemPqModel).where(ItemPqModel.versao_id == vig)
    if q:
        stmt = stmt.where(or_(ItemPqModel.item.ilike(f"{q}%"), ItemPqModel.descricao.ilike(f"%{q}%")))
    itens = list(s.scalars(stmt.order_by(ItemPqModel.id).limit(min(limite, 200))))
    qtd = {}
    if tag and itens:
        qtd = {x.item: x.quantidade for x in s.scalars(select(PqQuantidadeTagModel).where(
            PqQuantidadeTagModel.versao_id == vig, PqQuantidadeTagModel.tag == tag,
            PqQuantidadeTagModel.item.in_([i.item for i in itens])))}
    return [{"item": i.item, "descricao": i.descricao, "unid": i.unid, "quantidade": i.quantidade,
             "cpu": i.composicao, "qtd_tag": qtd.get(i.item)} for i in itens]


@router.get("/cronograma/atividades")
def atividades(q: str | None = None, area_id: int | None = None, limite: int = 40, s: Session = Depends(get_session),
               c: ContextoObra = Depends(ler)):
    """Atividades do cronograma vigente; com área, filtra pelo CWA ou TAG no caminho da EAP."""
    vig = ResolvedorReferencias(s, c.obra_id).versoes_vigentes().get("CRONOGRAMA")
    if not vig:
        return []
    stmt = select(AtividadeCronogramaModel).where(AtividadeCronogramaModel.versao_id == vig)
    if area_id:
        a = s.get(AreaFrenteModel, area_id)
        if a and a.obra_id == c.obra_id:
            filtros = [AtividadeCronogramaModel.area.ilike(f"%CWA {a.cwa}%")]
            if a.tag:
                t1, t2, t3 = a.tag.split("-", 2) if a.tag.count("-") >= 2 else (a.tag, "", "")
                filtros.append(AtividadeCronogramaModel.area.ilike(f"%{t2}-{t1}-{t3}%"))
            stmt = stmt.where(or_(*filtros))
    if q:
        stmt = stmt.where(or_(AtividadeCronogramaModel.id_crono.ilike(f"%{q}%"),
                              AtividadeCronogramaModel.atividade.ilike(f"%{q}%")))
    return [{"id_crono": x.id_crono, "atividade": x.atividade, "inicio": x.inicio, "fim": x.fim, "status": x.status,
             "wbs": x.wbs} for x in s.scalars(stmt.order_by(AtividadeCronogramaModel.inicio).limit(min(limite, 200)))]


@router.post("/importar/takeoff")
def importar_takeoff(arquivo: UploadFile = File(...), rotulo: str = Form(...), s: Session = Depends(get_session),
                     c: ContextoObra = Depends(administrar)):
    r = carregar_takeoff(s, c.obra_id, arquivo.file, nome_arquivo=arquivo.filename or "", rotulo=rotulo,
                         usuario=c.usuario.id)
    return {"versoes": r.versoes, "contagem": r.contagem, "avisos": r.avisos}


@router.post("/importar/xer")
def importar_xer(arquivo: UploadFile = File(...), rotulo: str = Form(...), s: Session = Depends(get_session),
                 c: ContextoObra = Depends(administrar)):
    r = carregar_xer(s, c.obra_id, arquivo.file, nome_arquivo=arquivo.filename or "", rotulo=rotulo,
                     usuario=c.usuario.id)
    return {"versoes": r.versoes, "contagem": r.contagem, "avisos": r.avisos}
