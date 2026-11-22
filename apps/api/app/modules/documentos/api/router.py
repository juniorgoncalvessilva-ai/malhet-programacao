"""Spec 123 — documentos controlados (ISO 9001:2015, 7.5): LDO, revisões pelo arquivo, ligações, GRD, campo e grafo."""
from datetime import date

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, planejar, programar
from app.core.db import get_session
from app.modules.documentos.application import planilhas, servico as sv
from app.modules.documentos.application import takeoff as to
from app.modules.documentos.domain import documento as dom
from app.modules.documentos.infra import dwg

router = APIRouter(prefix="/documentos", tags=["documentos controlados"])
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _quem(c: ContextoObra) -> str:
    return c.usuario.email or c.usuario.id


@router.get("")
def listar(busca: str | None = None, area_id: int | None = None, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return sv.listar(s, c.obra_id, busca, area_id)


@router.get("/opcoes")
def opcoes(_c: ContextoObra = Depends(ler)):
    return {"tipos": dom.TIPOS, "finalidades": list(dom.FINALIDADES), "libera_uso": [k for k, v in dom.FINALIDADES.items() if v],
            "relacoes": dom.RELACOES, "disciplinas": list(dom.DISCIPLINAS), "conversor_dwg": dwg.disponivel()}


@router.post("/revisoes", status_code=201)
def nova_revisao(arquivo: UploadFile = File(...), codigo: str | None = Form(None), revisao: str | None = Form(None),
                 finalidade: str | None = Form(None), titulo: str | None = Form(None), tipo: str | None = Form(None),
                 disciplina: str | None = Form(None), data_emissao: date | None = Form(None), grd_id: int | None = Form(None),
                 s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Revisão nova pelo arquivo: o DWG vira PDF/PNG e o carimbo preenche o que faltar."""
    return sv.registrar_revisao(s, c.obra_id, arquivo.file.read(sv.LIMITE + 1), arquivo.filename, _quem(c), codigo=codigo,
                                revisao=revisao, finalidade=finalidade, titulo=titulo, tipo=tipo, disciplina=disciplina,
                                data_emissao=data_emissao, grd_id=grd_id)


@router.post("/ldo")
def importar_ldo(arquivo: UploadFile = File(...), s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return sv.importar_ldo(s, c.obra_id, arquivo.file.read(sv.LIMITE + 1), _quem(c), arquivo.filename)


@router.get("/ldo.xlsx")
def ldo_excel(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return Response(planilhas.ldo_xlsx(s, c.obra_id), media_type=XLSX, headers={"Content-Disposition": 'attachment; filename="LDO.xlsx"'})


@router.get("/campo")
def para_campo(area_id: int | None = None, grupo_id: int | None = None, wbs_no_id: int | None = None, linha_id: int | None = None,
               s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Documentos vigentes da atividade (frente, IWP/CWP e grupo do serviço) — o que o encarregado deve seguir."""
    if linha_id:
        from app.modules.catalogo.infra.models import TipoAtividadeModel
        from app.modules.planejamento.infra.models import LinhaProgramacaoModel, ProgramacaoModel

        ln = s.get(LinhaProgramacaoModel, linha_id)
        p = s.get(ProgramacaoModel, ln.programacao_id) if ln else None
        if p is None or p.obra_id != c.obra_id:
            return []
        t = s.get(TipoAtividadeModel, ln.tipo_id)
        area_id, wbs_no_id, grupo_id = ln.area_id, ln.wbs_no_id, (t.grupo_id if t else None)
    return sv.para_atividade(s, c.obra_id, area_id, grupo_id, wbs_no_id)


@router.get("/revisoes/{rid}/arquivo")
def arquivo(rid: int, formato: str = "png", via: str = "web", baixar: bool = False, s: Session = Depends(get_session),
            c: ContextoObra = Depends(ler)):
    dados, mime, nome = sv.arquivo_da_revisao(s, c.obra_id, rid, formato, _quem(c), via if via in ("web", "campo") else "web")
    return Response(dados, media_type=mime, headers={"Content-Disposition": f'{"attachment" if baixar else "inline"}; filename="{nome}"',
                                                     "Cache-Control": "private, max-age=86400"})


@router.get("/grafo")
def grafo(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return sv.grafo(s, c.obra_id)


# ---- GRD ----
class ItemGrdIn(BaseModel):
    documento_id: int
    revisao_id: int | None = None


class GrdIn(BaseModel):
    sentido: str
    data: date
    remetente: str = Field(max_length=150)
    destinatario: str = Field(max_length=150)
    numero_externo: str | None = Field(None, max_length=80)
    observacao: str | None = Field(None, max_length=2000)
    itens: list[ItemGrdIn] = []


@router.get("/grds")
def grds(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return sv.listar_grds(s, c.obra_id)


@router.post("/grds", status_code=201)
def nova_grd(d: GrdIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return sv.criar_grd(s, c.obra_id, d.sentido, d.data, d.remetente, d.destinatario, _quem(c), numero_externo=d.numero_externo,
                        observacao=d.observacao, itens=[i.model_dump() for i in d.itens])


@router.get("/grds/{gid}")
def grd(gid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return sv.grd_detalhe(s, c.obra_id, gid)


@router.post("/grds/{gid}/ciencia", status_code=204)
def ciencia(gid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    sv.ciencia_grd(s, c.obra_id, gid, _quem(c))


@router.get("/grds/{gid}/xlsx")
def grd_excel(gid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    dados, numero = planilhas.grd_xlsx(s, c.obra_id, gid)
    return Response(dados, media_type=XLSX, headers={"Content-Disposition": f'attachment; filename="{numero}.xlsx"'})


# ---- ligações ----
class VinculoIn(BaseModel):
    relacao: str = "aplica_a"
    alvo_tipo: str
    alvo_id: int


@router.post("/vinculos/{vid}/confirmar", status_code=204)
def confirmar(vid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    sv.confirmar_vinculo(s, c.obra_id, vid)


@router.delete("/vinculos/{vid}", status_code=204)
def remover(vid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    sv.remover_vinculo(s, c.obra_id, vid)


# ---- take-off pelo projeto (spec 124) ----
class DecisaoIn(BaseModel):
    situacao: str | None = None
    item_pq: str | None = Field(None, max_length=40)
    area_id: int | None = None
    fator: float | None = None


class UsarIwpIn(BaseModel):
    item_pq: str = Field(min_length=1, max_length=40)
    area_id: int
    iwp_id: int | None = None


@router.get("/takeoff")
def takeoff(documento_id: int | None = None, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Quantidades lidas dos desenhos (com Δ da revisão anterior) e a comparação projeto × planilha × IWP."""
    return to.listar(s, c.obra_id, documento_id)


@router.get("/takeoff/itens-pq")
def takeoff_itens(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    from app.modules.referencias.infra.pq_gateway import itens_pq
    return [{"item": i.item, "descricao": i.descricao, "unid": i.unid} for i in itens_pq(s, c.obra_id).values() if i.folha]


@router.post("/revisoes/{rid}/takeoff")
def takeoff_extrair(rid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Lê de novo o desenho da revisão (mantém as decisões já tomadas)."""
    return {"quantidades": to.extrair(s, c.obra_id, rid)}


@router.put("/takeoff/{tid}", status_code=204)
def takeoff_decidir(tid: int, d: DecisaoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    to.decidir(s, c.obra_id, tid, _quem(c), situacao=d.situacao, item_pq=d.item_pq, area_id=d.area_id, fator=d.fator,
               campos=set(d.model_fields_set) - {"situacao"})


@router.post("/takeoff/iwp")
def takeoff_iwp(d: UsarIwpIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Leva o total do projeto (aceitas das revisões vigentes) para a quantidade do IWP, com a origem anotada."""
    return to.usar_no_iwp(s, c.obra_id, d.item_pq, d.area_id, _quem(c), d.iwp_id)


# ---- documento ----
class DocumentoIn(BaseModel):
    titulo: str = Field(min_length=3, max_length=300)
    tipo: str = "DES"
    disciplina: str | None = Field(None, max_length=40)
    codigo_contratada: str | None = Field(None, max_length=80)
    observacao: str | None = Field(None, max_length=500)


@router.get("/{doc_id}")
def detalhe(doc_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return sv.detalhe(s, c.obra_id, doc_id)


@router.put("/{doc_id}")
def editar(doc_id: int, d: DocumentoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    doc = sv.obter(s, c.obra_id, doc_id)
    if d.tipo not in dom.TIPOS:
        from app.shared.errors import DomainError

        raise DomainError(f"tipo: {', '.join(dom.TIPOS)}", "tipo")
    doc.titulo, doc.tipo, doc.disciplina = d.titulo.strip(), d.tipo, (d.disciplina or None)
    doc.codigo_contratada, doc.observacao = (d.codigo_contratada or None), (d.observacao or None)
    s.flush()
    return sv.detalhe(s, c.obra_id, doc_id)


@router.post("/{doc_id}/vinculos", status_code=201)
def vincular(doc_id: int, d: VinculoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return sv.vincular(s, c.obra_id, doc_id, d.relacao, d.alvo_tipo, d.alvo_id, _quem(c))
