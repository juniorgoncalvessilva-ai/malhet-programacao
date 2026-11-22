"""Spec 123 — documentos controlados (ISO 9001:2015, 7.5): LDO, revisões pelo arquivo, ligações, GRD, campo e grafo."""
from datetime import date

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, planejar, programar
from app.core.db import get_session
from app.modules.documentos.application import planilhas, servico as sv
from app.modules.documentos.application import pastas as pst
from app.modules.documentos.application import takeoff as to
from app.modules.documentos.domain import documento as dom
from app.modules.documentos.infra import dwg
from app.shared.errors import DomainError

router = APIRouter(prefix="/documentos", tags=["documentos controlados"])
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _quem(c: ContextoObra) -> str:
    return c.usuario.email or c.usuario.id


@router.get("")
def listar(busca: str | None = None, area_id: int | None = None, pasta_id: int | None = None,
           s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    docs = sv.listar(s, c.obra_id, busca, area_id)
    if pasta_id is not None:  # spec 129: 0 = sem pasta
        ids = pst.ids_da_pasta(s, c.obra_id, pasta_id)
        docs = [d for d in docs if d["id"] in ids]
    return docs


# ---- enviar e relacionar (spec 132) ----
class AssociarIn(BaseModel):
    documento_id: int
    revisao: str = Field(min_length=1, max_length=6)
    finalidade: str | None = None
    relacionar_a: list[int] = []
    relacao: str = "referencia"


class CriarDocIn(BaseModel):
    codigo: str = Field(min_length=3, max_length=80)
    titulo: str = Field(min_length=3, max_length=300)
    revisao: str = Field(min_length=1, max_length=6)
    tipo: str | None = None
    finalidade: str | None = None
    relacionar_a: list[int] = []
    relacao: str = "referencia"


@router.post("/enviar", status_code=201)
def enviar(arquivo: UploadFile = File(...), tipo: str | None = Form(None), grd_id: int | None = Form(None),
           s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Envia um arquivo: casa sozinho com a LDO (carimbo, nome, texto do PDF) ou vai para "A relacionar"."""
    from app.modules.documentos.application import envio

    return envio.enviar(s, c.obra_id, arquivo.file.read(sv.LIMITE + 1), arquivo.filename, _quem(c), tipo=tipo or None, grd_id=grd_id)


@router.get("/recebidos")
def recebidos(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    from app.modules.documentos.application import envio

    return envio.listar(s, c.obra_id)


@router.get("/recebidos/{rid}/arquivo")
def recebido_arquivo(rid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    from urllib.parse import quote

    from app.modules.documentos.application import envio

    dados, mime, nome = envio.arquivo(s, c.obra_id, rid)
    return Response(dados, media_type=mime, headers={"Content-Disposition": f"inline; filename*=UTF-8''{quote(nome)}"})


@router.post("/recebidos/{rid}/associar")
def recebido_associar(rid: int, d: AssociarIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    from app.modules.documentos.application import envio

    return envio.associar(s, c.obra_id, rid, _quem(c), documento_id=d.documento_id, revisao=d.revisao, finalidade=d.finalidade,
                          relacionar_a=d.relacionar_a, relacao=d.relacao)


@router.post("/recebidos/{rid}/novo")
def recebido_novo(rid: int, d: CriarDocIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    from app.modules.documentos.application import envio

    return envio.criar(s, c.obra_id, rid, _quem(c), codigo=d.codigo, titulo=d.titulo, revisao=d.revisao, tipo=d.tipo,
                       finalidade=d.finalidade, relacionar_a=d.relacionar_a, relacao=d.relacao)


@router.delete("/recebidos/{rid}", status_code=204)
def recebido_descartar(rid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    from app.modules.documentos.application import envio

    envio.descartar(s, c.obra_id, rid, _quem(c))


# ---- controle de projetos por ativo (spec 133) ----
@router.post("/ativos/previa")
def ativos_previa(arquivo: UploadFile = File(...), s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    from app.modules.documentos.application import controle_ativo as cta

    return cta.previa(s, c.obra_id, arquivo.file.read(sv.LIMITE + 1))


@router.post("/ativos")
def ativos_importar(arquivo: UploadFile = File(...), s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    from app.modules.documentos.application import controle_ativo as cta

    return cta.importar(s, c.obra_id, arquivo.file.read(sv.LIMITE + 1), _quem(c))


@router.get("/ativos")
def ativos_listar(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    from app.modules.documentos.application import controle_ativo as cta

    return cta.listar(s, c.obra_id)


@router.get("/ativos/situacao")
def ativos_situacao(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Situação de projeto por frente (área): o pior status dos ativos dela e projetos com revisão vigente, com memória."""
    from app.modules.documentos.application import controle_ativo as cta

    return {str(k): v for k, v in cta.situacao_por_frente(s, c.obra_id).items()}


class FrenteAtivoIn(BaseModel):
    indice: int = 0
    area_id: int | None = None


@router.put("/ativos/{cid}/frente")
def ativos_frente(cid: int, d: FrenteAtivoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    from app.modules.documentos.application import controle_ativo as cta

    return cta.definir_frente(s, c.obra_id, cid, d.indice, d.area_id, _quem(c))


# ---- pastas e consolidado (spec 129) ----
class PastaIn(BaseModel):
    nome: str = Field(min_length=3, max_length=80)
    descricao: str | None = Field(None, max_length=200)
    tipos: list[str] = []
    disciplinas: list[str] = []
    pacotes: list[str] = []
    natureza: str | None = None
    responsavel: str | None = Field(None, max_length=80)
    meio: str | None = Field(None, max_length=80)
    local: str | None = Field(None, max_length=120)
    retencao: str | None = Field(None, max_length=160)
    subpastas: list[str] | None = None


@router.get("/pastas")
def pastas(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Pastas da obra (cópia da pasta-modelo), com contagens, "sem pasta", a sugestão e o armazenamento."""
    return pst.listar(s, c.obra_id, _quem(c))


@router.post("/pastas", status_code=201)
def nova_pasta(d: PastaIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return pst.salvar(s, c.obra_id, _quem(c), d.nome, d.descricao, d.tipos, d.disciplinas, d.pacotes, natureza=d.natureza,
                      responsavel=d.responsavel, meio=d.meio, local=d.local, retencao=d.retencao, subpastas=d.subpastas)


@router.get("/plano-arquivamento.xlsx")
def plano_arquivamento(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Plano de arquivamento da obra a partir das pastas: o que é documento e o que é registro, quem guarda, onde e por quanto tempo."""
    dados = planilhas.plano_arquivamento_xlsx(s, c.obra_id, _quem(c))
    return Response(dados, media_type=XLSX, headers={"Content-Disposition": 'attachment; filename="Plano de arquivamento.xlsx"'})


@router.post("/pastas/restaurar")
def restaurar_pastas(s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return {"restauradas": pst.restaurar_modelo(s, c.obra_id, _quem(c))}


@router.put("/pastas/{pid}")
def editar_pasta(pid: int, d: PastaIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return pst.salvar(s, c.obra_id, _quem(c), d.nome, d.descricao, d.tipos, d.disciplinas, d.pacotes, pasta_id=pid,
                      natureza=d.natureza, responsavel=d.responsavel, meio=d.meio, local=d.local, retencao=d.retencao, subpastas=d.subpastas)


@router.delete("/pastas/{pid}", status_code=204)
def excluir_pasta(pid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    pst.excluir(s, c.obra_id, pid)


@router.get("/consolidado")
def consolidado(periodo: str = "mes", ref: date | None = None, situacao: str | None = None,
                s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Tudo o que entrou ou saiu na semana/mês: revisões e GRDs, assinado (comprovado) ou pendente."""
    from app.shared.tempo import hoje_local

    if situacao not in (None, "", "assinado", "pendente"):
        raise DomainError("situação: assinado ou pendente", "situacao")
    return pst.consolidado(s, c.obra_id, periodo, ref or hoje_local(), situacao or None)


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
    folhas: int | None = None
    finalidade_remessa: int | None = None
    via: str | None = None
    formato: str | None = None
    vias: int | None = None


class GrdIn(BaseModel):
    sentido: str
    data: date
    remetente: str = Field(max_length=150)
    destinatario: str = Field(max_length=150)
    numero_externo: str | None = Field(None, max_length=80)
    observacao: str | None = Field(None, max_length=2000)
    atencao: str | None = Field(None, max_length=150)
    atencao_cargo: str | None = Field(None, max_length=120)
    emitente: str | None = Field(None, max_length=150)
    emitente_cargo: str | None = Field(None, max_length=120)
    referencia: str | None = Field(None, max_length=150)
    itens: list[ItemGrdIn] = []


@router.get("/grds")
def grds(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return sv.listar_grds(s, c.obra_id)


@router.post("/grds", status_code=201)
def nova_grd(d: GrdIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return sv.criar_grd(s, c.obra_id, d.sentido, d.data, d.remetente, d.destinatario, _quem(c), numero_externo=d.numero_externo,
                        observacao=d.observacao, itens=[i.model_dump() for i in d.itens], atencao=d.atencao,
                        atencao_cargo=d.atencao_cargo, emitente=d.emitente, emitente_cargo=d.emitente_cargo, referencia=d.referencia)


@router.get("/grds/opcoes")
def grd_opcoes(_c: ContextoObra = Depends(ler)):
    from app.modules.documentos.domain import grd as g

    return {"status": g.STATUS, "finalidades": g.FINALIDADES, "vias": g.VIAS, "formatos": list(g.FORMATOS)}


@router.post("/grds/importar", status_code=201)
def importar_grd(arquivo: UploadFile = File(...), s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """GRD recebida no modelo do contrato (.xlsx): cria a GRD, registra as revisões listadas e guarda a planilha."""
    return sv.importar_grd(s, c.obra_id, arquivo.file.read(sv.LIMITE + 1), _quem(c), arquivo.filename)


@router.get("/grds/{gid}/arquivo")
def grd_arquivo(gid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """A planilha da GRD como chegou (importada)."""
    from app.modules.arquivos.application import servico as arq
    from app.modules.arquivos.infra.models import ArquivoModel

    g = sv._grd(s, c.obra_id, gid)
    a = s.get(ArquivoModel, g.arquivo_id) if g.arquivo_id else None
    if a is None:
        from app.shared.errors import NotFoundError
        raise NotFoundError("arquivo da GRD", gid)
    return Response(arq.abrir(s, a), media_type=a.mime,
                    headers={"Content-Disposition": f'attachment; filename="{(g.numero_externo or g.numero)}.xlsx"'})


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


@router.get("/takeoff/projetos")
def takeoff_projetos(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Os projetos da obra e a situação do levantamento de cada um (lido, a ler, sem quantidade, sem desenho, sem arquivo)."""
    return to.projetos(s, c.obra_id)


@router.post("/takeoff/levantar")
def takeoff_levantar(refazer: bool = False, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Lê as quantidades de todos os projetos ainda não lidos (em lotes de 25; `restantes` diz quantos faltam)."""
    return to.levantar(s, c.obra_id, refazer=refazer)


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
