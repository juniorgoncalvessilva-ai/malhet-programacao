from datetime import date

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, administrar, ler, negar, planejar, programar, ssma
from app.modules.obras.domain.obra import PapelObra
from app.core.db import get_session
from app.modules.catalogo.api.router import obter_ou_criar_item
from app.modules.catalogo.infra.models import TipoAtividadeModel
from app.modules.equipes.infra.models import EquipeModel
from app.modules.frentes.infra.models import AreaFrenteModel
from app.modules.planejamento.application import servico as sv
from app.modules.planejamento.domain.periodo import TipoProgramacao, periodo, titulo
from app.modules.planejamento.infra.models import EmissaoModel, LinhaProgramacaoModel, ProgramacaoModel
from app.modules.referencias.application.importar_cpu import carregar_cpu_obra
from app.modules.referencias.application.importar_takeoff import carregar_takeoff
from app.modules.referencias.application.importar_xer import carregar_xer, status_pt
from app.modules.referencias.infra.models import AtividadeCronogramaModel, ItemPqModel, PqQuantidadeTagModel
from app.modules.referencias.infra.cpu_gateway import CpuGateway
from app.modules.referencias.infra.resolvedor import JORNADA_REFERENCIA, ResolvedorReferencias
from app.modules.ssma.domain.cadastro import CAMPOS_PLANEJAMENTO, CAMPOS_SEGURANCA
from app.modules.ssma.infra.gateway import CadastroSsmaGateway
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
    qtd_periodo: float | None = None
    natureza: str = "P"  # P programada | O oportunidade | E emergencial
    responsavel: str | None = None
    pto: list[str] | str | None = None  # Planos de Trabalho de Obra (cadastro do Planejamento), um ou mais
    observacao: str | None = None


class ValorIn(BaseModel):
    data: date
    valor: float | None = None


class ValoresIn(BaseModel):
    campo: str = "previsto"  # previsto | realizado
    valores: list[ValorIn]


class LinhaSalvarIn(BaseModel):
    id: int
    qtd_periodo: float | None = None
    mudar_qtd_periodo: bool = False
    previsto: list[ValorIn] = []
    realizado: list[ValorIn] = []


class SalvarIn(BaseModel):
    linhas: list[LinhaSalvarIn]


class SsmaLinhaIn(BaseModel):
    id: int
    tecnico: str | None = None
    # vários itens por atividade (aceita texto, de telas antigas)
    rac: list[str] | str | None = None
    pts: list[str] | str | None = None
    art: list[str] | str | None = None
    ata: list[str] | str | None = None  # PTO é do Planejamento: vai na linha (montar), não aqui


class SsmaIn(BaseModel):
    linhas: list[SsmaLinhaIn]


SSMA_CAMPOS = (*CAMPOS_SEGURANCA, *CAMPOS_PLANEJAMENTO)  # copiados ao copiar a programação


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
                                          qtd_projeto=x.qtd_projeto, observacao=x.observacao, ordem=x.ordem,
                                          natureza=x.natureza, responsavel=x.responsavel,
                                          **{f"ssma_{k}": getattr(x, f"ssma_{k}") for k in SSMA_CAMPOS})
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
        if not (d.responsavel or "").strip() and e.responsavel:
            d.responsavel = e.responsavel
    if t.item_pq:  # o tipo é um item da PQ: a linha mede nele
        d.item_pq = t.item_pq
    if d.natureza not in ("P", "O", "E"):
        raise DomainError("natureza: P (programada), O (oportunidade) ou E (emergencial)", "natureza")
    if d.qtd_periodo is not None and d.qtd_periodo < 0:
        raise DomainError("quantidade do período não pode ser negativa", "qtd_periodo")
    item_id, aviso = None, None
    if d.complemento and d.complemento.strip(" ()"):
        item, _, aviso = obter_ou_criar_item(s, c.obra_id, t, d.complemento, d.item_pq)
        item_id = item.id
    return t, item_id, aviso


def _pto(s: Session, c: ContextoObra, valor, atual) -> list[str] | None:
    """PTOs da linha: do cadastro do Planejamento; só o planejador muda."""
    novo = CadastroSsmaGateway(s, c.obra_id).conferir_lista("pto", valor, atual)
    if novo != atual and not c.papel.pode(PapelObra.PLANEJADOR):
        raise negar("o PTO é escolhido pelo Planejamento")
    return novo


@router.post("/programacoes/{pid}/linhas", status_code=201)
def nova_linha(pid: int, d: LinhaIn, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    p = sv.obter(s, c.obra_id, pid)
    sv.exigir_rascunho(p)
    _, item_id, aviso = _validar_linha(s, c, d)
    ln = LinhaProgramacaoModel(area_id=d.area_id, tipo_id=d.tipo_id, item_simova_id=item_id, item_pq=d.item_pq or None,
                               id_crono=d.id_crono or None, equipe_id=d.equipe_id, qtd_projeto=d.qtd_projeto,
                               qtd_periodo=d.qtd_periodo, natureza=d.natureza, responsavel=(d.responsavel or None),
                               ssma_pto=_pto(s, c, d.pto, None),
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
    ln.qtd_periodo, ln.natureza, ln.responsavel = d.qtd_periodo, d.natureza, (d.responsavel or None)
    ln.ssma_pto = _pto(s, c, d.pto, ln.ssma_pto)
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
    stmt = select(ItemPqModel).where(ItemPqModel.versao_id == vig, ItemPqModel.folha.is_(True))
    if q:
        stmt = stmt.where(or_(ItemPqModel.item.ilike(f"{q}%"), ItemPqModel.descricao.ilike(f"%{q}%")))
    itens = list(s.scalars(stmt.order_by(ItemPqModel.ordem, ItemPqModel.id).limit(min(limite, 200))))
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
             "wbs": x.wbs} for x in s.scalars(stmt.order_by(AtividadeCronogramaModel.ordem_p6.nulls_last(), AtividadeCronogramaModel.inicio).limit(min(limite, 200)))]


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


@router.post("/importar/cpu")
def importar_cpu(arquivo: UploadFile = File(...), rotulo: str = Form(...), s: Session = Depends(get_session),
                 c: ContextoObra = Depends(administrar)):
    """Composição de Custo Unitário da obra (.xls do orçamento) → versão CPU vigente."""
    r = carregar_cpu_obra(s, c.obra_id, arquivo.file, nome_arquivo=arquivo.filename or "", rotulo=rotulo,
                          usuario=c.usuario.id)
    return {"versoes": r.versoes, "contagem": r.contagem, "avisos": r.avisos[:50]}


@router.get("/cpu/item")
def cpu_do_item(item: str, jornada: float = JORNADA_REFERENCIA, s: Session = Depends(get_session),
                c: ContextoObra = Depends(ler)):
    """Rastreio: item da PQ → composição → funções/equipamentos (h/un), recurso que governa, índice e HH/un."""
    vig = ResolvedorReferencias(s, c.obra_id).versoes_vigentes()
    par = CpuGateway(s, c.obra_id, vig).por_itens({item.strip()}).get(item.strip())
    pq = s.scalar(select(ItemPqModel).where(ItemPqModel.versao_id == vig["PQ"], ItemPqModel.item == item.strip())) \
        if "PQ" in vig else None
    if par is None or (not par.composicao and pq is None):
        raise NotFoundError("Item de PQ", item)
    return {
        "item": item, "descricao": pq.descricao if pq else None, "unid": pq.unid if pq else None,
        "pu": pq.pu if pq else None, "composicao": par.composicao, "descricao_composicao": par.descricao_composicao,
        "custo_unitario": par.custo_unitario, "hh_un": par.hh_por_unidade, "recurso_governa": par.recurso_governa,
        "coef_governa": par.coef_governa, "jornada": jornada, "indice_un_dia": par.indice_un_dia(jornada),
        "recursos": [{"recurso": r.recurso, "tipo": r.tipo, "coef": r.coef_por_unidade,
                      "un_dia_por_pessoa": round(jornada / r.coef_por_unidade, 4) if r.coef_por_unidade else None}
                     for r in sorted(par.recursos, key=lambda r: (r.tipo != "MOD", -r.coef_por_unidade))],
    }


@router.get("/cpu/recursos")
def recursos_da_cpu(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Funções e equipamentos da CPU vigente (para montar a composição das equipes com os mesmos nomes)."""
    from sqlalchemy import func

    from app.modules.referencias.infra.models import CpuRecursoModel

    vig = ResolvedorReferencias(s, c.obra_id).versoes_vigentes()
    if "CPU" not in vig:
        return []
    q = (select(CpuRecursoModel.recurso, CpuRecursoModel.tipo, func.count().label("n"))
         .where(CpuRecursoModel.versao_id == vig["CPU"])
         .group_by(CpuRecursoModel.recurso, CpuRecursoModel.tipo).order_by(func.count().desc()))
    return [{"recurso": r, "tipo": t, "composicoes": n} for r, t, n in s.execute(q)]


@router.put("/programacoes/{pid}/salvar")
def salvar(pid: int, d: SalvarIn, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    """Salva de uma vez as alterações da tela: quantidade do período e valores do dia (previsto/realizado)."""
    p = sv.obter(s, c.obra_id, pid)
    n = 0
    for ln_in in d.linhas:
        ln = next((x for x in p.linhas if x.id == ln_in.id), None)
        if ln is None:
            raise NotFoundError("Linha", ln_in.id)
        if ln_in.mudar_qtd_periodo:
            sv.exigir_rascunho(p)
            if ln_in.qtd_periodo is not None and ln_in.qtd_periodo < 0:
                raise DomainError("quantidade do período não pode ser negativa", "qtd_periodo")
            ln.qtd_periodo = ln_in.qtd_periodo
            n += 1
        if ln_in.previsto:
            sv.salvar_valores(s, p, ln.id, [v.model_dump() for v in ln_in.previsto], "previsto")
            n += len(ln_in.previsto)
        if ln_in.realizado:
            sv.salvar_valores(s, p, ln.id, [v.model_dump() for v in ln_in.realizado], "realizado")
            n += len(ln_in.realizado)
    s.flush()
    return {"alteracoes": n}


@router.put("/programacoes/{pid}/ssma")
def salvar_ssma(pid: int, d: SsmaIn, s: Session = Depends(get_session), c: ContextoObra = Depends(ssma)):
    """Itens de SSMA por linha (técnico, RAC, PTS, ART, ATA), escolhidos nos cadastros. Vale com a programação emitida."""
    p = sv.obter(s, c.obra_id, pid)
    gw = CadastroSsmaGateway(s, c.obra_id)
    for x in d.linhas:
        ln = next((y for y in p.linhas if y.id == x.id), None)
        if ln is None:
            raise NotFoundError("Linha", x.id)
        ln.ssma_tecnico = gw.conferir("tecnico", x.tecnico, ln.ssma_tecnico)
        for k in CAMPOS_SEGURANCA:
            if k != "tecnico":
                setattr(ln, f"ssma_{k}", gw.conferir_lista(k, getattr(x, k), getattr(ln, f"ssma_{k}")))
    s.flush()
    return {"linhas": len(d.linhas)}


@router.get("/cronograma/arvore")
def cronograma_arvore(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Cronograma vigente (P6) com o caminho da WBS de cada atividade e onde ela já está programada."""
    vig = ResolvedorReferencias(s, c.obra_id).versoes_vigentes()
    if "CRONOGRAMA" not in vig:
        return {"versao": None, "atividades": []}
    from app.modules.referencias.infra.models import VersaoReferenciaModel

    v = s.get(VersaoReferenciaModel, vig["CRONOGRAMA"])
    usos: dict[str, list[dict]] = {}
    q = (select(LinhaProgramacaoModel.id_crono, ProgramacaoModel.id, ProgramacaoModel.titulo)
         .join(ProgramacaoModel, ProgramacaoModel.id == LinhaProgramacaoModel.programacao_id)
         .where(ProgramacaoModel.obra_id == c.obra_id, LinhaProgramacaoModel.id_crono.is_not(None)))
    for idc, pid, tit in s.execute(q):
        if not any(u["id"] == pid for u in usos.setdefault(idc, [])):
            usos[idc].append({"id": pid, "titulo": tit})
    ativ = []
    for a in s.scalars(select(AtividadeCronogramaModel).where(AtividadeCronogramaModel.versao_id == v.id)
                       .order_by(AtividadeCronogramaModel.ordem_p6.nulls_last(), AtividadeCronogramaModel.id)):
        niv = a.wbs_niveis or []
        caminho = [x["nome"] for x in niv] if niv else (
            [x for x in (a.area or "").split(" / ") if x] + ([a.wbs] if a.wbs else []))  # importação antiga
        ativ.append({"id_crono": a.id_crono, "atividade": a.atividade, "caminho": caminho,
                     "wbs_codigos": [x["codigo"] for x in niv] if niv else None,
                     "wbs_ordem": [x["ordem"] for x in niv] if niv else None,
                     "ordem_p6": a.ordem_p6,
                     "inicio": a.inicio.date().isoformat() if a.inicio else None,
                     "fim": a.fim.date().isoformat() if a.fim else None,
                     "duracao_h": a.horas_crono, "status": status_pt(a.status), "pct": a.realizado,
                     "programada_em": usos.get(a.id_crono, [])})
    return {"versao": {"id": v.id, "rotulo": v.rotulo, "carregado_em": v.carregado_em.isoformat(),
                       "ordem_p6": any(x["ordem_p6"] is not None for x in ativ)}, "atividades": ativ}


@router.get("/programacoes/{pid}/excel")
def exportar_excel(pid: int, revisao: int | None = None, s: Session = Depends(get_session),
                   c: ContextoObra = Depends(ler)):
    """Programação no Excel do cliente (layout da aba "Programação Semanal - S32"). Sem revisão = rascunho atual."""
    from app.modules.equipes.infra.composicao import composicao_efetiva
    from app.modules.obras.infra.models import ObraModel
    from app.modules.planejamento.application.exportar_cliente import gerar

    p = sv.obter(s, c.obra_id, pid)
    if revisao is not None:
        e = s.scalar(select(EmissaoModel).where(EmissaoModel.programacao_id == pid, EmissaoModel.revisao == revisao))
        if e is None:
            raise NotFoundError("Emissão", revisao)
        v = {**e.foto, "emitida_em": e.emitida_em.isoformat()}
    else:
        v = sv.visao(s, p)
    obra = s.get(ObraModel, c.obra_id)
    nome = " - ".join(x for x in (obra.codigo, obra.nome, obra.contrato) if x)
    comps = {eq.id: composicao_efetiva(eq) for eq in s.scalars(select(EquipeModel).where(EquipeModel.obra_id == c.obra_id))}
    dados = gerar(v, nome, comps)
    import unicodedata

    base = unicodedata.normalize("NFKD", p.titulo.split(" · ")[0]).encode("ascii", "ignore").decode().replace(" ", "_")
    arq = f"{base}_{p.inicio:%Y%m%d}{'' if revisao is None else f'_rev{revisao}'}.xlsx"
    return Response(dados, media_type=XLSX, headers={"Content-Disposition": f'attachment; filename="{arq}"'})


@router.get("/pq/estrutura")
def pq_estrutura(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Aba PQ da versão vigente com a estrutura (títulos e itens) e o tipo do catálogo de cada item."""
    from app.modules.catalogo.domain.catalogo import codigo_tipo
    from app.modules.catalogo.infra.models import GrupoAtividadeModel, TipoAtividadeModel
    from app.modules.referencias.infra.models import VersaoReferenciaModel

    vig = ResolvedorReferencias(s, c.obra_id).versoes_vigentes().get("PQ")
    if not vig:
        return {"versao": None, "linhas": []}
    v = s.get(VersaoReferenciaModel, vig)
    grupos = {g.id: g for g in s.scalars(select(GrupoAtividadeModel).where(GrupoAtividadeModel.obra_id == c.obra_id))}
    tipo_de = {t.item_pq: {"id": t.id, "codigo": codigo_tipo(grupos[t.grupo_id].numero, t.numero),
                           "grupo": grupos[t.grupo_id].descricao}
               for t in s.scalars(select(TipoAtividadeModel).where(TipoAtividadeModel.obra_id == c.obra_id,
                                                                   TipoAtividadeModel.item_pq.is_not(None)))}
    linhas = [{"item": x.item, "nivel": x.nivel, "folha": x.folha, "descricao": x.descricao, "unid": x.unid,
               "codigo_atividade": x.codigo_atividade, "criterio": x.criterio, "quantidade": x.quantidade,
               "pu": x.pu, "total": x.total if x.total is not None else (
                   round(x.quantidade * x.pu, 2) if x.quantidade is not None and x.pu is not None else None),
               "tipo": tipo_de.get(x.item)}
              for x in s.scalars(select(ItemPqModel).where(ItemPqModel.versao_id == vig)
                                 .order_by(ItemPqModel.ordem, ItemPqModel.id))]
    return {"versao": {"id": v.id, "rotulo": v.rotulo, "arquivo": v.arquivo_origem}, "linhas": linhas}
