"""Spec 111 — `/lideres` (Planejamento: link e acesso dos líderes) e `/portal/{codigo}` (o link aberto no celular do
encarregado; sem conta do Malhet: sessão própria pela matrícula e senha, cabeçalho X-Portal-Token)."""
from datetime import date

from fastapi import APIRouter, Depends, File, Form, Header, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core import mudancas
from app.core.auth import ContextoObra, ler, planejar
from app.core.db import get_session
from app.modules.lideres.application import gestao, portal as pt

router = APIRouter(prefix="/lideres", tags=["Líderes (portal do encarregado)"])
publico = APIRouter(prefix="/portal", tags=["Portal do encarregado"])


@router.get("")
def listar(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Quem entra e por onde: o endereço da obra e o da empresa saem do cadastro (spec 117)."""
    from app.modules.lideres.application.rotas import rota_da_obra

    r = rota_da_obra(s, c.obra_id)
    return {"endereco": r["endereco"], "endereco_empresa": r["endereco_empresa"], "endereco_apontador": r["endereco_apontador"],
            "endereco_apontador_empresa": r["endereco_apontador_empresa"], "lideres": gestao.listar(s, c.obra_id)}


class LiderIn(BaseModel):
    colaborador_id: int
    equipes: list[int] = []
    perfil: str = Field("lider", max_length=10)  # spec 147: "apontador"


@router.post("", status_code=201)
def cadastrar(d: LiderIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    gestao.cadastrar(s, c.obra_id, d.colaborador_id, d.equipes, c.usuario.id, d.perfil)
    return {"ok": True}


class EditarIn(BaseModel):
    equipes: list[int] | None = None
    ativo: bool | None = None


@router.put("/{colaborador_id}")
def editar(colaborador_id: int, d: EditarIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    gestao.editar(s, c.obra_id, colaborador_id, d.equipes, d.ativo)
    return {"ok": True}


@router.post("/{colaborador_id}/redefinir")
def redefinir(colaborador_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    gestao.redefinir(s, c.obra_id, colaborador_id)
    return {"ok": True, "senha": "123456"}


@router.get("/apontador/funcoes")
def funcoes_apontador(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Spec 148: as funções do efetivo que entram pela rota do apontador (a obra escolhe; sem escolha, APONTADOR)."""
    return gestao.config_apontador(s, c.obra_id)


class FuncoesApontadorIn(BaseModel):
    funcoes: list[str] | None = Field(None, max_length=50)  # None = voltar ao padrão


@router.put("/apontador/funcoes")
def definir_funcoes_apontador(d: FuncoesApontadorIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return gestao.definir_funcoes_apontador(s, c.obra_id, d.funcoes, c.usuario.email or c.usuario.id)


@router.get("/pedidos")
def pedidos(situacao: str | None = "pendente", s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Pedidos de equipe dos líderes (spec 114): `situacao` vazia = todos."""
    return gestao.pedidos(s, c.obra_id, situacao or None)


class AprovarIn(BaseModel):
    nome: str | None = Field(None, max_length=120)  # vazio = o nome no padrão da obra


@router.post("/pedidos/{pid}/aprovar")
def aprovar(pid: int, d: AprovarIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return gestao.aprovar_pedido(s, c.obra_id, pid, d.nome, c.usuario.id, c.usuario.email)


class RecusarIn(BaseModel):
    motivo: str = Field(max_length=500)


@router.post("/pedidos/{pid}/recusar")
def recusar(pid: int, d: RecusarIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    gestao.recusar_pedido(s, c.obra_id, pid, d.motivo, c.usuario.id, c.usuario.email)
    return {"ok": True}


@router.delete("/{colaborador_id}", status_code=204)
def remover(colaborador_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    gestao.remover(s, c.obra_id, colaborador_id)


# ---- portal (público): endereço fixo dos encarregados (spec 115) ------------------------------------------------
def _ip(request: Request) -> str:
    return (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "") or "?").split(",")[0].strip()


def _mudou(token: str | None) -> None:
    mudancas.registrar(str(pt.obra_do_token(token)))  # as telas do Planejamento da obra se atualizam


@publico.get("/link/{codigo}")
def link_antigo(codigo: str, s: Session = Depends(get_session)):
    """Links por obra enviados antes do endereço fixo: devolvem a obra, para abrir já com a marca dela."""
    return {"obra_id": pt.portal(s, codigo).obra_id}


@publico.get("/marca/{obra_id}")
def marca(obra_id: int, s: Session = Depends(get_session)):
    """Nome da obra e a marca da empresa (spec 113): a tela abre com a cor e a logo da contratada, não do Malhet."""
    from app.modules.lideres.application.rotas import marca_publica, rota_da_obra
    from app.modules.obras.infra.models import MarcaObraModel, ObraModel

    r = rota_da_obra(s, obra_id)
    return {"obra": s.get(ObraModel, obra_id).nome, "marca": marca_publica(s.get(MarcaObraModel, obra_id)), "rota": r}


@publico.get("/rota/{empresa}")
def rota_empresa(empresa: str, s: Session = Depends(get_session)):
    """`/encarregado/<empresa>` (spec 117): a marca da empresa antes do login; só entram matrículas das obras dela."""
    from app.modules.lideres.application.rotas import resolver

    return resolver(s, empresa)


@publico.get("/rota/{empresa}/{obra}")
def rota_obra(empresa: str, obra: str, s: Session = Depends(get_session)):
    """`/encarregado/<empresa>/<obra>` (spec 117): a obra e a marca dela antes do login."""
    from app.modules.lideres.application.rotas import resolver

    return resolver(s, empresa, obra)


@publico.get("/marca/{obra_id}/logo/{qual}")
def logo(obra_id: int, qual: str, s: Session = Depends(get_session)):
    from fastapi import Response

    from app.modules.obras.infra.models import MarcaObraModel
    from app.shared.errors import NotFoundError

    m = s.get(MarcaObraModel, obra_id) if qual in ("contratada", "contratante") else None
    tipo = getattr(m, f"tipo_{qual}") if m else None
    if not tipo:
        raise NotFoundError("logo", qual)
    return Response(getattr(m, f"logo_{qual}"), media_type=tipo, headers={"Cache-Control": "public, max-age=3600"})


class EntrarIn(BaseModel):
    matricula: str = Field(max_length=30)
    senha: str = Field(max_length=60)
    obra_id: int | None = None  # a matrícula está em mais de uma obra: a escolhida (ou a obra do endereço)
    empresa: str | None = Field(None, max_length=60)  # endereço da empresa: só as obras dela (spec 117)
    perfil: str = Field("lider", max_length=10)  # spec 147: "apontador" pela rota /apontador


@publico.post("/entrar")
def entrar(d: EntrarIn, request: Request, s: Session = Depends(get_session)):
    obras = None
    if d.empresa:
        from app.modules.lideres.application.rotas import obras_da_empresa

        obras = obras_da_empresa(s, d.empresa)
    return pt.entrar(s, d.matricula, d.senha, _ip(request), d.obra_id, obras, d.perfil)


class SenhaIn(BaseModel):
    nova: str = Field(max_length=60)
    repetida: str = Field(max_length=60)


@publico.post("/senha")
def senha(d: SenhaIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    return pt.trocar_senha(s, x_portal_token, d.nova, d.repetida)


@publico.get("/equipes")
def equipes(s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    return {**pt.minhas_equipes(s, x_portal_token), "obra_id": pt.obra_do_token(x_portal_token)}


@publico.get("/buscar")
def buscar(q: str = "", s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    return pt.buscar(s, x_portal_token, q)


class IncluirIn(BaseModel):
    equipe_id: int
    cracha: str = Field(max_length=30)


@publico.post("/incluir")
def incluir(d: IncluirIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    r = pt.incluir(s, x_portal_token, d.equipe_id, d.cracha)
    _mudou(x_portal_token)
    return r


class TransferirIn(BaseModel):
    equipe_id: int
    cracha: str = Field(max_length=30)
    para_equipe_id: int | None = None  # vazio = não sabe para onde foi (fica sem equipe)


@publico.post("/transferir")
def transferir(d: TransferirIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    r = pt.transferir(s, x_portal_token, d.equipe_id, d.cracha, d.para_equipe_id)
    _mudou(x_portal_token)
    return r


class PedidoIn(BaseModel):
    disciplina: str = Field(max_length=60)
    membros: list[str] = Field(max_length=200)  # matrículas/crachás
    observacao: str | None = Field(None, max_length=500)


@publico.post("/pedidos")
def pedir(d: PedidoIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    """Reivindicar equipe (spec 114): fica pendente até o Planejamento/administrador aprovar."""
    r = pt.pedir_equipe(s, x_portal_token, d.disciplina, d.membros, d.observacao)
    _mudou(x_portal_token)
    return r


@publico.delete("/pedidos/{pid}", status_code=204)
def cancelar(pid: int, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    pt.cancelar_pedido(s, x_portal_token, pid)



# ---- fotos de atividade pelo endereço do encarregado (spec 121) ---------------------------------------------------
class RegistroPortalIn(BaseModel):
    data: date | None = None
    area_id: int
    wbs_no_id: int | None = None
    item_pq: str | None = Field(None, max_length=40)
    descricao: str = Field(max_length=500)


@publico.get("/frentes")
def frentes(s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    from app.modules.campo.application import registros as rg

    obra, _c, _por = pt.quem(s, x_portal_token)
    return rg.frentes(s, obra)


@publico.get("/registros/opcoes")
def opcoes_registro(area_id: int, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    from app.modules.campo.application import registros as rg

    obra, _c, _por = pt.quem(s, x_portal_token)
    return {"itens": rg.opcoes(s, obra, area_id)}


@publico.get("/pq")
def pq(q: str = "", s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    from app.modules.campo.application import registros as rg

    obra, _c, _por = pt.quem(s, x_portal_token)
    return rg.buscar_pq(s, obra, q)


@publico.get("/registros")
def registros_do_dia(data: date | None = None, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    """Os registros que o próprio líder fez no dia (padrão: hoje), com as fotos."""
    from app.modules.campo.application import registros as rg
    from app.shared.tempo import hoje_local

    obra, _c, por = pt.quem(s, x_portal_token)
    return rg.do_dia(s, obra, data or hoje_local(), por)


@publico.post("/registros", status_code=201)
def registrar(d: RegistroPortalIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    """Atividade feita (na programação ou fora dela) com foto: frente, item da WBS ou da PQ e o que foi feito."""
    from app.modules.campo.application import registros as rg
    from app.modules.frentes.infra.models import AreaFrenteModel

    obra, _c, por = pt.quem(s, x_portal_token)
    r = rg.registrar(s, obra, d.area_id, d.wbs_no_id, d.item_pq, d.descricao, d.data, por)
    _mudou(x_portal_token)
    return rg.como_dict(r, s.get(AreaFrenteModel, r.area_id), [])


def _registro_do_lider(s: Session, obra: int, por: str, rid: int):
    from app.modules.campo.infra.models import RegistroAtividadeModel
    from app.shared.errors import NotFoundError

    r = s.get(RegistroAtividadeModel, rid)
    if r is None or r.obra_id != obra or r.criado_por != por:
        raise NotFoundError("Registro", rid)
    return r


@publico.post("/registros/{rid}/fotos", status_code=201)
def foto_do_registro(rid: int, arquivo: UploadFile = File(...), data: date | None = Form(None),
                     s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    from app.modules.campo.application.arquivos import nova_foto
    from app.modules.campo.domain.foto import LIMITE

    obra, _c, por = pt.quem(s, x_portal_token)
    r = _registro_do_lider(s, obra, por, rid)
    f = nova_foto(s, obra, "registro", r.id, data or r.data, None, arquivo.file.read(LIMITE + 1), por)
    s.flush()
    _mudou(x_portal_token)
    return {"id": f.id}


@publico.get("/fotos/{fid}")
def ver_foto(fid: int, mini: bool = False, baixar: bool = False, s: Session = Depends(get_session),
             x_portal_token: str | None = Header(None)):
    """Só as fotos que o próprio líder registrou."""
    from fastapi import Response

    from app.modules.campo.api.fotos import nome_para_baixar
    from app.modules.campo.application.arquivos import conteudo
    from app.modules.campo.infra.models import FotoCampoModel
    from app.shared.errors import NotFoundError

    obra, _c, por = pt.quem(s, x_portal_token)
    f = s.get(FotoCampoModel, fid)
    if f is None or f.obra_id != obra or f.alvo != "registro" or f.enviado_por != por:
        raise NotFoundError("Foto", fid)
    mini = mini and not baixar
    tipo = "image/jpeg" if mini else f.content_type
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[tipo]
    disp = f'attachment; filename="{nome_para_baixar(s, f, ext)}"' if baixar else "inline"
    return Response(conteudo(s, f, mini=mini), media_type=tipo, headers={"Content-Disposition": disp, "Cache-Control": "private, max-age=86400"})


# ---- projetos e procedimentos vigentes pelo endereço do encarregado (spec 123) ---------------------------------------
@publico.get("/documentos")
def documentos_vigentes(area_id: int | None = None, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    """Só o que vale no campo: documentos com revisão vigente — da frente escolhida, ou todos."""
    from app.modules.documentos.application import servico as dsv

    obra, _c, _por = pt.quem(s, x_portal_token)
    if area_id:
        return dsv.para_atividade(s, obra, area_id)
    return [d for d in dsv.listar(s, obra) if d["vigente"]]


@publico.get("/documentos/revisoes/{rid}/arquivo")
def documento_arquivo(rid: int, formato: str = "png", s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    from fastapi import Response

    from app.modules.documentos.application import servico as dsv
    from app.modules.documentos.domain import documento as ddom
    from app.modules.documentos.infra.models import DocumentoRevisaoModel
    from app.shared.errors import NotFoundError

    obra, _c, por = pt.quem(s, x_portal_token)
    r = s.get(DocumentoRevisaoModel, rid)
    if r is None or r.obra_id != obra:
        raise NotFoundError("Revisão", rid)
    revs = dsv._revisoes(s, [r.documento_id]).get(r.documento_id, [])
    if ddom.vigente(dsv._info(revs)) != r.id:  # o encarregado nunca abre revisão superada
        raise NotFoundError("Revisão vigente", rid)
    dados, mime, nome = dsv.arquivo_da_revisao(s, obra, rid, formato if formato in ("png", "pdf") else "png", por, "portal")
    return Response(dados, media_type=mime, headers={"Content-Disposition": f'inline; filename="{nome}"', "Cache-Control": "private, max-age=3600"})


# ---- rota do apontador (spec 147): mesma sessão do portal, perfil "apontador" -----------------------------------------
from app.modules.lideres.application import apontador as ap  # noqa: E402


@publico.get("/apontador/equipes")
def ap_equipes(data: date | None = None, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    return ap.equipes(s, x_portal_token, data)


class EquipeNovaIn(BaseModel):
    disciplina: str = Field(max_length=60)
    encarregado: str = Field(max_length=30)  # matrícula/crachá
    membros: list[str] = Field(default_factory=list, max_length=200)
    nome: str | None = Field(None, max_length=120)


@publico.post("/apontador/equipes", status_code=201)
def ap_criar_equipe(d: EquipeNovaIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    r = ap.criar_equipe(s, x_portal_token, d.disciplina, d.encarregado, d.membros, d.nome)
    _mudou(x_portal_token)
    return r


@publico.post("/apontador/incluir")
def ap_incluir(d: IncluirIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    r = ap.incluir(s, x_portal_token, d.equipe_id, d.cracha)
    _mudou(x_portal_token)
    return r


@publico.post("/apontador/tirar")
def ap_tirar(d: IncluirIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    r = ap.tirar(s, x_portal_token, d.equipe_id, d.cracha)
    _mudou(x_portal_token)
    return r


class PresencaIn(BaseModel):
    data: date | None = None
    colaborador_id: int
    presente: bool


@publico.post("/apontador/presenca")
def ap_presenca(d: PresencaIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    r = ap.presenca(s, x_portal_token, d.data, d.colaborador_id, d.presente)
    _mudou(x_portal_token)
    return r


class FaltaIn(BaseModel):
    data: date | None = None
    colaborador_id: int
    motivo: str | None = Field(None, max_length=20)  # vazio = tirar a falta
    observacao: str | None = Field(None, max_length=300)


@publico.post("/apontador/falta")
def ap_falta(d: FaltaIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    r = ap.falta(s, x_portal_token, d.data, d.colaborador_id, d.motivo, d.observacao)
    _mudou(x_portal_token)
    return r


class FaltasRestantesIn(BaseModel):
    data: date | None = None
    equipe_id: int
    motivo: str = Field(max_length=20)
    observacao: str | None = Field(None, max_length=300)


@publico.post("/apontador/faltas/restantes")
def ap_faltas_restantes(d: FaltasRestantesIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    r = ap.faltas_restantes(s, x_portal_token, d.data, d.equipe_id, d.motivo, d.observacao)
    _mudou(x_portal_token)
    return r


class EmprestimoIn(BaseModel):
    data: date | None = None
    colaborador_id: int
    para_equipe_id: int
    justificativa: str = Field(max_length=300)
    presente: bool = True


@publico.post("/apontador/emprestimo")
def ap_emprestimo(d: EmprestimoIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    r = ap.emprestimo(s, x_portal_token, d.data, d.colaborador_id, d.para_equipe_id, d.justificativa, d.presente)
    _mudou(x_portal_token)
    return r


class DevolverIn(BaseModel):
    data: date | None = None
    colaborador_id: int


@publico.post("/apontador/emprestimo/devolver")
def ap_devolver(d: DevolverIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    r = ap.devolver(s, x_portal_token, d.data, d.colaborador_id)
    _mudou(x_portal_token)
    return r


@publico.get("/apontador/equipamentos")
def ap_equipamentos(data: date | None = None, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    return ap.equipamentos(s, x_portal_token, data)


class DiaEquipamentoIn(BaseModel):
    data: date | None = None
    situacao: str = Field(max_length=12)
    horas: float | None = None
    equipe_id: int | None = None
    observacao: str | None = Field(None, max_length=300)


@publico.put("/apontador/equipamentos/{eid}")
def ap_apontar_equipamento(eid: int, d: DiaEquipamentoIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    r = ap.apontar_equipamento(s, x_portal_token, eid, d.data, d.situacao, d.horas, d.equipe_id, d.observacao)
    _mudou(x_portal_token)
    return r


@publico.get("/apontador/producao")
def ap_producao(s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    return ap.producao(s, x_portal_token)


# ---- leitura de presença no celular do apontador (spec 150): os mesmos casos de uso do /m/presenca ---------------------
from app.modules.presenca.api import router as pres  # noqa: E402


@publico.get("/apontador/presenca/base")
def ap_presenca_base(s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    return pres.base(s, ap.contexto_presenca(s, x_portal_token))


@publico.post("/apontador/presenca/leituras")
def ap_presenca_leituras(d: pres.LeiturasIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    r = pres.sincronizar(d, s, ap.contexto_presenca(s, x_portal_token))
    _mudou(x_portal_token)
    return r


@publico.get("/apontador/presenca/hoje")
def ap_presenca_hoje(data: date | None = None, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    return pres.hoje(data, s, ap.contexto_presenca(s, x_portal_token))


@publico.post("/apontador/presenca/vincular")
def ap_presenca_vincular(d: pres.VincularIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    r = pres.vincular(d, s, ap.contexto_presenca(s, x_portal_token))
    _mudou(x_portal_token)
    return r


@publico.post("/apontador/presenca/pessoa-simplificada", status_code=201)
def ap_presenca_pessoa(d: pres.PessoaSimplesIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    r = pres.pessoa_simplificada(d, s, ap.contexto_presenca(s, x_portal_token))
    _mudou(x_portal_token)
    return r
