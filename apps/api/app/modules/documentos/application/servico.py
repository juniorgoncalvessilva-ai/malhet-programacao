"""Casos de uso dos documentos controlados (spec 123, ISO 9001:2015 7.5).

Revisão entra pelo arquivo (DWG, DXF, PDF, imagem): o DWG vira DXF no conversor separado, o DXF dá o carimbo, os textos
(TAGs) e a folha em PDF/PNG; tudo vai para o acervo Zettelkasten da obra (`arquivos.guardar`, pasta 05-documentos) com as
ligações no `.md`. A vigente é calculada pelas regras do domínio — nunca gravada à mão — e a anterior vira superada.
"""
import re
from datetime import date, datetime, timezone
from io import BytesIO

from openpyxl import load_workbook
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.arquivos.application import servico as arquivos
from app.modules.arquivos.application.registro import Usuario, registrar
from app.modules.arquivos.infra.models import ArquivoModel
from app.modules.documentos.domain import documento as dom
from app.modules.documentos.domain import grd as grd_dom
from app.modules.documentos.domain import ldo as ldo_dom
from app.modules.documentos.infra import desenho, dwg
from app.modules.documentos.infra.models import (
    DocumentoLeituraModel,
    DocumentoModel,
    DocumentoRevisaoModel,
    DocumentoVinculoModel,
    GrdItemModel,
    GrdModel,
)
from app.modules.frentes.infra.models import AreaFrenteModel, LocalFrenteModel
from app.shared.errors import DomainError, NotFoundError

LIMITE = 60 * 1024 * 1024
MIME_ORIGINAL = {"dwg": "image/vnd.dwg", "dxf": "image/vnd.dxf", "pdf": "application/pdf", "png": "image/png",
                 "jpg": "image/jpeg", "jpeg": "image/jpeg"}


# ---- leitura -------------------------------------------------------------------------------------------------------

def obter(s: Session, obra_id: int, doc_id: int) -> DocumentoModel:
    d = s.get(DocumentoModel, doc_id)
    if d is None or d.obra_id != obra_id:
        raise NotFoundError("Documento", doc_id)
    return d


def _revisoes(s: Session, ids: list[int]) -> dict[int, list[DocumentoRevisaoModel]]:
    out: dict[int, list[DocumentoRevisaoModel]] = {}
    for r in s.scalars(select(DocumentoRevisaoModel).where(DocumentoRevisaoModel.documento_id.in_(ids or [0]))):
        out.setdefault(r.documento_id, []).append(r)
    for v in out.values():
        v.sort(key=lambda r: dom.chave_revisao(r.revisao))
    return out


def _info(revs: list[DocumentoRevisaoModel]) -> list[dom.RevisaoInfo]:
    return [dom.RevisaoInfo(r.id, r.revisao, r.finalidade) for r in revs]


def _rev_dict(r: DocumentoRevisaoModel, revs: list[DocumentoRevisaoModel]) -> dict:
    return {"id": r.id, "revisao": r.revisao, "finalidade": r.finalidade, "situacao": dom.situacao(dom.RevisaoInfo(r.id, r.revisao, r.finalidade), _info(revs)),
            "data_emissao": r.data_emissao.isoformat() if r.data_emissao else None, "nome_original": r.nome_original,
            "formatos": [f for f, a in (("png", r.png_arquivo_id), ("pdf", r.pdf_arquivo_id), ("original", r.arquivo_id), ("dxf", r.dxf_arquivo_id)) if a],
            "tags": r.tags or [], "avisos": r.avisos or [], "carimbo": r.carimbo or {}, "grd_id": r.grd_id,
            "enviado_por": r.enviado_por, "enviado_em": r.enviado_em.isoformat() if r.enviado_em else None,
            "motivo": r.motivo, "ldo_enviada_em": r.ldo_enviada_em.isoformat() if r.ldo_enviada_em else None,
            "apresentado": r.apresentado, "apresentado_para": r.apresentado_para, "ldo": r.ldo}


def _doc_dict(d: DocumentoModel, revs: list[DocumentoRevisaoModel], vinc: list[DocumentoVinculoModel] | None = None) -> dict:
    vid = dom.vigente(_info(revs))
    vig = next((r for r in revs if r.id == vid), None)
    ultima = revs[-1] if revs else None
    return {"id": d.id, "codigo": d.codigo, "codigo_contratada": d.codigo_contratada, "titulo": d.titulo, "tipo": d.tipo,
            "tipo_nome": dom.TIPOS.get(d.tipo, d.tipo), "disciplina": d.disciplina, "projeto": d.projeto, "origem": d.origem,
            "observacao": d.observacao, "pacote": d.pacote, "local_texto": d.local_texto, "disciplina_sigla": d.disciplina_sigla,
            "vigente": _rev_dict(vig, revs) if vig else None,
            "ultima": _rev_dict(ultima, revs) if ultima else None, "revisoes": len(revs),
            "sugestoes": sum(1 for v in (vinc or []) if v.sugerido), "ligacoes": sum(1 for v in (vinc or []) if not v.sugerido)}


def listar(s: Session, obra_id: int, busca: str | None = None, area_id: int | None = None) -> list[dict]:
    """Lista de documentos (LDO) com a revisão vigente e a última; filtra por texto ou pela frente ligada."""
    docs = list(s.scalars(select(DocumentoModel).where(DocumentoModel.obra_id == obra_id).order_by(DocumentoModel.codigo)))
    if busca:
        b = busca.strip().upper()
        docs = [d for d in docs if b in f"{d.codigo} {d.codigo_contratada or ''} {d.titulo}".upper()]
    vinc: dict[int, list[DocumentoVinculoModel]] = {}
    for v in s.scalars(select(DocumentoVinculoModel).where(DocumentoVinculoModel.obra_id == obra_id)):
        vinc.setdefault(v.documento_id, []).append(v)
    if area_id:
        docs = [d for d in docs if any(v.alvo_tipo == "area" and v.alvo_id == area_id for v in vinc.get(d.id, []))]
    revs = _revisoes(s, [d.id for d in docs])
    return [_doc_dict(d, revs.get(d.id, []), vinc.get(d.id, [])) for d in docs]


def _rotulos(s: Session, obra_id: int, vinc: list[DocumentoVinculoModel]) -> dict[tuple[str, int], str]:
    ids = {t: {v.alvo_id for v in vinc if v.alvo_tipo == t} for t in dom.ALVOS}
    out: dict[tuple[str, int], str] = {}
    for a in s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.id.in_(ids["area"] or {0}))):
        out[("area", a.id)] = f"{a.codigo} · {a.descricao}"
    if ids["grupo"]:
        from app.modules.catalogo.infra.models import GrupoAtividadeModel

        for g in s.scalars(select(GrupoAtividadeModel).where(GrupoAtividadeModel.id.in_(ids["grupo"]))):
            out[("grupo", g.id)] = f"Grupo {g.numero} · {g.descricao}"
    if ids["wbs"]:
        from app.modules.wbs.infra.gateway import codigos

        cods = codigos(s, obra_id)
        for i in ids["wbs"]:
            if i in cods:
                out[("wbs", i)] = f"{cods[i].codigo} · {cods[i].caminho.split(' › ')[-1]}"
    for d in s.scalars(select(DocumentoModel).where(DocumentoModel.id.in_(ids["documento"] or {0}))):
        out[("documento", d.id)] = f"{d.codigo} · {d.titulo}"
    return out


def detalhe(s: Session, obra_id: int, doc_id: int) -> dict:
    d = obter(s, obra_id, doc_id)
    revs = _revisoes(s, [d.id]).get(d.id, [])
    vinc = list(s.scalars(select(DocumentoVinculoModel).where(DocumentoVinculoModel.documento_id == d.id)))
    # citações reversas (Zettelkasten): outros documentos que apontam para este
    reversas = list(s.scalars(select(DocumentoVinculoModel).where(DocumentoVinculoModel.obra_id == obra_id,
                                                                  DocumentoVinculoModel.alvo_tipo == "documento",
                                                                  DocumentoVinculoModel.alvo_id == d.id)))
    origem = {x.id: x for x in s.scalars(select(DocumentoModel).where(DocumentoModel.id.in_({v.documento_id for v in reversas} or {0})))}
    rot = _rotulos(s, obra_id, vinc)
    grds = s.execute(select(GrdModel, GrdItemModel).join(GrdItemModel, GrdItemModel.grd_id == GrdModel.id)
                     .where(GrdItemModel.documento_id == d.id).order_by(GrdModel.data.desc(), GrdModel.id.desc())).all()
    leituras = list(s.scalars(select(DocumentoLeituraModel).where(DocumentoLeituraModel.revisao_id.in_([r.id for r in revs] or [0]))
                              .order_by(DocumentoLeituraModel.id.desc()).limit(40)))
    rev_de = {r.id: r.revisao for r in revs}
    return {**_doc_dict(d, revs, vinc), "historico": [_rev_dict(r, revs) for r in reversed(revs)],
            "vinculos": [{"id": v.id, "relacao": v.relacao, "relacao_nome": dom.RELACOES.get(v.relacao, v.relacao),
                          "alvo_tipo": v.alvo_tipo, "alvo_id": v.alvo_id, "alvo": rot.get((v.alvo_tipo, v.alvo_id), "(removido)"),
                          "sugerido": v.sugerido} for v in vinc],
            "citado_por": [{"documento_id": v.documento_id, "relacao_nome": dom.RELACOES.get(v.relacao, v.relacao),
                            "documento": f"{origem[v.documento_id].codigo} · {origem[v.documento_id].titulo}"} for v in reversas if v.documento_id in origem],
            "grds": [{"id": g.id, "numero": g.numero, "sentido": g.sentido, "data": g.data.isoformat(), "revisao": i.revisao,
                      "finalidade": i.finalidade} for g, i in grds],
            "leituras": [{"revisao": rev_de.get(x.revisao_id), "quem": x.quem, "via": x.via, "formato": x.formato,
                          "em": x.em.isoformat() if x.em else None} for x in leituras]}


# ---- revisão pelo arquivo --------------------------------------------------------------------------------------------

def _extensao(nome: str | None, dados: bytes) -> str:
    if dados.startswith(b"AC10"):
        return "dwg"
    if dados.startswith(b"%PDF"):
        return "pdf"
    if dados.startswith(b"\x89PNG"):
        return "png"
    if dados.startswith(b"\xff\xd8"):
        return "jpg"
    ext = (nome or "").rsplit(".", 1)[-1].lower() if "." in (nome or "") else ""
    if ext == "dxf" or b"SECTION" in dados[:2000]:
        return "dxf"
    raise DomainError("envie DWG, DXF, PDF ou imagem (PNG/JPG)", "arquivo")


def ler_arquivo(nome: str | None, dados: bytes) -> tuple[bytes | None, "desenho.Desenho", list[str]]:
    """DWG → DXF (conversor separado) e DXF → carimbo, textos e folha; o resto passa direto. Usado no envio (spec 132) para
    casar com a LDO antes de registrar, sem converter duas vezes."""
    ext = _extensao(nome, dados)
    avisos: list[str] = []
    dxf: bytes | None = None
    vis = desenho.Desenho()
    if ext == "dwg":
        try:
            dxf = dwg.dwg_para_dxf(dados)
        except DomainError as e:
            avisos.append(f"{e.mensagem}: o DWG ficou guardado, sem a folha para ver no campo")
    elif ext == "dxf":
        dxf = dados
    if dxf:
        vis = desenho.ler(dxf)
        avisos += vis.avisos
    return dxf, vis, avisos


def registrar_revisao(s: Session, obra_id: int, dados: bytes, nome: str | None, por: str, *, codigo: str | None = None,
                      revisao: str | None = None, finalidade: str | None = None, titulo: str | None = None,
                      tipo: str | None = None, disciplina: str | None = None, data_emissao: date | None = None,
                      grd_id: int | None = None, leitura: tuple | None = None) -> dict:
    """Uma revisão nova de um documento. O que não vier no formulário sai do carimbo do desenho; o código, se não houver
    nem no carimbo, vem do nome do arquivo. Revisão que já existe não é sobrescrita (ISO 7.5.3: controle de versão)."""
    if not dados:
        raise DomainError("arquivo vazio", "arquivo")
    if len(dados) > LIMITE:
        raise DomainError("arquivo maior que 60 MB", "arquivo")
    ext = _extensao(nome, dados)
    dxf, vis, avisos = leitura if leitura is not None else ler_arquivo(nome, dados)
    car = dom.ler_carimbo(vis.carimbo) if vis.carimbo else dom.Carimbo()
    base = (nome or "").rsplit("/", 1)[-1].rsplit(".", 1)[0]
    cod = dom.normalizar_codigo(codigo or car.codigo or base)
    rev = dom.normalizar_revisao(revisao or car.revisao or "")
    fin = dom.normalizar_finalidade(finalidade or car.finalidade)
    if grd_id:
        g = s.get(GrdModel, grd_id)
        if g is None or g.obra_id != obra_id:
            raise NotFoundError("GRD", grd_id)
    d = s.scalar(select(DocumentoModel).where(DocumentoModel.obra_id == obra_id, DocumentoModel.codigo == cod))
    if d is None:
        d = DocumentoModel(obra_id=obra_id, codigo=cod, titulo=(titulo or car.titulo or base or cod)[:300],
                           codigo_contratada=car.codigo_contratada, tipo=_tipo(tipo, ext), disciplina=disciplina,
                           projeto=car.projeto, origem="carimbo" if car.codigo else "manual", criado_por=por)
        s.add(d)
        s.flush()
    else:  # a LDO manda no que já tem; o carimbo só completa o que está em branco
        d.codigo_contratada = d.codigo_contratada or car.codigo_contratada
        d.projeto = d.projeto or car.projeto
        if titulo:
            d.titulo = titulo[:300]
        elif car.titulo and d.titulo in (d.codigo, ""):
            d.titulo = car.titulo[:300]
        if disciplina:
            d.disciplina = disciplina
    existente = s.scalar(select(DocumentoRevisaoModel).where(DocumentoRevisaoModel.documento_id == d.id, DocumentoRevisaoModel.revisao == rev))
    if existente is not None and existente.arquivo_id:
        raise DomainError(f"{cod} revisão {rev} já está guardada: uma correção é uma revisão nova", "revisao")
    ligacoes = {"documento": cod, "revisao": rev, "finalidade": fin, "codigo_contratada": d.codigo_contratada}
    rotulo = f"{cod} rev {rev}"
    orig = arquivos.guardar(s, obra_id, dados, MIME_ORIGINAL[ext], "documento", titulo=rotulo, ligacoes=ligacoes,
                            origem="documento", nome_original=nome)
    pdf = arquivos.guardar(s, obra_id, vis.pdf, "application/pdf", "documento-visual", titulo=f"{rotulo} folha",
                           ligacoes=ligacoes, origem="documento") if vis.pdf else None
    png = arquivos.guardar(s, obra_id, vis.png, "image/png", "documento-visual", titulo=f"{rotulo} folha",
                           ligacoes=ligacoes, origem="documento") if vis.png else None
    dxf_a = arquivos.guardar(s, obra_id, dxf, "image/vnd.dxf", "documento-visual", titulo=f"{rotulo} dxf", ligacoes=ligacoes,
                             origem="documento") if dxf and ext == "dwg" else None
    r = existente or DocumentoRevisaoModel(obra_id=obra_id, documento_id=d.id, revisao=rev, enviado_por=por)
    r.finalidade, r.data_emissao, r.nome_original = fin, data_emissao or car.data, (nome or "")[:200] or None
    r.arquivo_id, r.pdf_arquivo_id = orig.id, (pdf.id if pdf else (orig.id if ext == "pdf" else None))
    r.png_arquivo_id = png.id if png else (orig.id if ext in ("png", "jpg") else None)
    r.dxf_arquivo_id = dxf_a.id if dxf_a else (orig.id if ext == "dxf" else None)
    r.carimbo, r.tags, r.avisos, r.grd_id = vis.carimbo or None, dom.tags_no_texto(vis.textos) or None, avisos or None, grd_id
    if existente is None:
        s.add(r)
    s.flush()
    if grd_id and not s.scalar(select(GrdItemModel.id).where(GrdItemModel.grd_id == grd_id, GrdItemModel.revisao_id == r.id)):
        s.add(GrdItemModel(grd_id=grd_id, documento_id=d.id, revisao_id=r.id, revisao=rev, finalidade=fin))
    sugeridas = _sugerir_frentes(s, obra_id, d, r.tags or [], por)
    quantidades = 0
    if dxf or ext == "pdf":  # take-off pelo projeto (spec 124; PDF com texto, spec 131): falha na leitura não impede guardar
        from app.modules.documentos.application import takeoff
        try:
            with s.begin_nested():
                quantidades = takeoff.extrair(s, obra_id, r.id, dxf) if dxf else takeoff.extrair(s, obra_id, r.id)
        except Exception as e:  # noqa: BLE001
            avisos.append(f"não foi possível levantar as quantidades do desenho ({type(e).__name__})")
            r.avisos = avisos
    revs = _revisoes(s, [d.id]).get(d.id, [])
    vigente_agora = dom.vigente(_info(revs)) == r.id
    if vigente_agora:
        _avisar_vigente(s, obra_id, d, r)
    s.flush()
    return {"documento": _doc_dict(d, revs), "revisao": _rev_dict(r, revs), "sugeridas": sugeridas, "avisos": avisos,
            "nova_vigente": vigente_agora, "quantidades": quantidades}


def _tipo(tipo: str | None, ext: str) -> str:
    t = (tipo or "").strip().upper()
    if t:
        if t not in dom.TIPOS:
            raise DomainError(f"tipo: {', '.join(dom.TIPOS)}", "tipo")
        return t
    return "DES" if ext in ("dwg", "dxf") else "OUT"


def _sugerir_frentes(s: Session, obra_id: int, d: DocumentoModel, tags: list[str], por: str) -> list[str]:
    """TAG citada no desenho → frente com aquele ativo/TAG: entra como sugestão (o Planejamento confirma)."""
    if not tags:
        return []
    areas = list(s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == obra_id)))
    ja = {(v.alvo_tipo, v.alvo_id) for v in s.scalars(select(DocumentoVinculoModel).where(DocumentoVinculoModel.documento_id == d.id))}
    out = []
    for t in tags:
        for a in areas:
            if ("area", a.id) not in ja and dom.casa_tag(t, a.ativo_codigo, a.tag, a.descricao):
                s.add(DocumentoVinculoModel(obra_id=obra_id, documento_id=d.id, relacao="aplica_a", alvo_tipo="area",
                                            alvo_id=a.id, sugerido=True, criado_por=por))
                ja.add(("area", a.id))
                out.append(f"{a.codigo} · {a.descricao}")
    return out


def _avisar_vigente(s: Session, obra_id: int, d: DocumentoModel, r: DocumentoRevisaoModel) -> None:
    from app.modules.notificacoes.application import notificar

    notificar(s, obra_id, tipo="documento_vigente", titulo=f"{d.codigo} rev {r.revisao} é a vigente",
              texto=f"{d.titulo} · {r.finalidade}. A revisão anterior não vale mais no campo.",
              papeis=["admin", "planejador", "encarregado"], url=f"/app/documentos?doc={d.id}", url_mobile="/m/documentos",
              chave=f"documento-vigente-{r.id}")


# ---- lista de documentos (LDO) por planilha -------------------------------------------------------------------------

def _norm(t) -> str:
    return ldo_dom.norm(t)


def importar_ldo(s: Session, obra_id: int, xlsx: bytes, por: str, nome: str | None = None) -> dict:
    """LDO do contrato (spec 128): todas as abas de pacote, cada uma com o cabeçalho achado pelos nomes. Cria ou atualiza
    cada documento pelo número; a revisão listada fica esperando o arquivo (com finalidade do TE, motivo, data de envio e a
    quem foi apresentado). "Observações" (CWA/local) liga à frente: código exato confirma, nome/TAG só sugere. A folha de
    rosto vira o próprio documento da LDO, com o histórico, e o arquivo vai para o acervo. Reimportar não duplica."""
    try:
        wb = load_workbook(BytesIO(xlsx), read_only=True, data_only=True)
        abas = [(ws.title, list(ws.iter_rows(values_only=True))) for ws in wb.worksheets]
    except Exception as e:  # noqa: BLE001
        raise DomainError("envie a LDO em Excel (.xlsx)", "arquivo") from e
    leitura = ldo_dom.ler(abas)
    if not leitura.linhas:
        raise DomainError("não achei a lista de documentos: precisa de uma aba com o número do documento e a descrição "
                          "(ex.: Número VALE | Descrição ou Código | Título)", "arquivo")
    locais = {lf.id: lf.descricao for lf in s.scalars(select(LocalFrenteModel).where(LocalFrenteModel.obra_id == obra_id))}
    refs = [ldo_dom.AreaRef(a.id, a.codigo, a.cwa or a.codigo, a.descricao, a.ativo_codigo, locais.get(a.local_id, ""))
            for a in s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == obra_id, AreaFrenteModel.ativo.is_(True)))]
    rotulo_ldo = f"{leitura.codigo} rev. {leitura.revisao}" if leitura.codigo and leitura.revisao else leitura.codigo
    existentes = {d.codigo: d for d in s.scalars(select(DocumentoModel).where(DocumentoModel.obra_id == obra_id,
                                                                              DocumentoModel.codigo.in_([x.codigo for x in leitura.linhas])))}
    revs_de: dict[int, dict[str, DocumentoRevisaoModel]] = {}
    for r in s.scalars(select(DocumentoRevisaoModel).where(DocumentoRevisaoModel.documento_id.in_([d.id for d in existentes.values()] or [0]))):
        revs_de.setdefault(r.documento_id, {})[r.revisao] = r
    vinc = {(v.documento_id, v.alvo_id) for v in s.scalars(select(DocumentoVinculoModel).where(
        DocumentoVinculoModel.obra_id == obra_id, DocumentoVinculoModel.alvo_tipo == "area"))}
    criados = atualizados = revisoes = ligados = sugeridos = 0
    sem_frente: list[str] = []
    locais_sem: dict[str, int] = {}
    for x in leitura.linhas:
        d = existentes.get(x.codigo)
        if d is None:
            d = DocumentoModel(obra_id=obra_id, codigo=x.codigo, titulo=x.titulo, tipo="DES", origem="ldo", criado_por=por)
            s.add(d)
            existentes[x.codigo] = d
            criados += 1
        else:
            d.titulo = x.titulo
            atualizados += 1
        d.pacote = x.aba[:80] if len(leitura.abas) > 1 or d.pacote else d.pacote
        if x.local:
            d.local_texto = x.local[:200]
        if x.codigo_contratada:
            d.codigo_contratada = x.codigo_contratada[:80]
        if x.tipo:
            tp = _norm(x.tipo)
            d.tipo = tp if tp in dom.TIPOS else next((k for k, v in dom.TIPOS.items() if _norm(v).startswith(tp[:5])), d.tipo)
        if x.disciplina:
            d.disciplina = x.disciplina.upper()[:40]
        if x.disciplina_sigla:
            d.disciplina_sigla = x.disciplina_sigla.upper()[:6]
        s.flush()
        if x.revisao:
            r = revs_de.get(d.id, {}).get(x.revisao)
            if r is None:
                r = DocumentoRevisaoModel(obra_id=obra_id, documento_id=d.id, revisao=x.revisao,
                                          finalidade=x.finalidade or dom.normalizar_finalidade(None), enviado_por=por)
                s.add(r)
                revs_de.setdefault(d.id, {})[x.revisao] = r
                revisoes += 1
            elif x.finalidade and not r.arquivo_id:
                r.finalidade = x.finalidade  # sem arquivo, a LDO manda; com arquivo, o carimbo já disse
            r.motivo = x.motivo[:300] if x.motivo else r.motivo
            r.ldo_enviada_em = x.enviado_em or r.ldo_enviada_em
            r.apresentado = x.apresentado if x.apresentado is not None else r.apresentado
            r.apresentado_para = x.para_quem[:150] if x.para_quem else r.apresentado_para
            r.ldo = rotulo_ldo[:100] if rotulo_ldo else r.ldo
            if r.data_emissao is None and x.enviado_em:
                r.data_emissao = x.enviado_em
        area_id, confirmada, _como = ldo_dom.casar_local(x.local, x.codigo, refs)
        if area_id is None:
            if x.local:
                sem_frente.append(f"{x.codigo}: {x.local}")
                locais_sem[x.local] = locais_sem.get(x.local, 0) + 1
        elif (d.id, area_id) not in vinc:
            s.add(DocumentoVinculoModel(obra_id=obra_id, documento_id=d.id, relacao="aplica_a", alvo_tipo="area", alvo_id=area_id,
                                        sugerido=not confirmada, criado_por=por))
            vinc.add((d.id, area_id))
            ligados += confirmada
            sugeridos += not confirmada
    ldo_info = _registrar_a_propria_ldo(s, obra_id, leitura, xlsx, nome, por) if leitura.codigo else None
    s.flush()
    return {"criados": criados, "atualizados": atualizados, "revisoes": revisoes, "ligados": ligados, "sugeridos": sugeridos,
            "frentes_nao_achadas": sem_frente[:200],
            "locais_nao_achados": [{"local": k, "documentos": v} for k, v in sorted(locais_sem.items(), key=lambda kv: -kv[1])],
            "abas": [{"aba": a, "documentos": n} for a, n in leitura.abas], "ignoradas": leitura.ignoradas,
            "avisos": leitura.avisos[:50], "ldo": ldo_info}


def _registrar_a_propria_ldo(s: Session, obra_id: int, leitura, xlsx: bytes, nome: str | None, por: str) -> dict:
    """A LDO também é documento controlado: tipo Lista, com o histórico da folha de rosto e o arquivo na revisão atual."""
    d = s.scalar(select(DocumentoModel).where(DocumentoModel.obra_id == obra_id, DocumentoModel.codigo == leitura.codigo))
    if d is None:
        d = DocumentoModel(obra_id=obra_id, codigo=leitura.codigo, titulo="Lista de documentos (LDO)", tipo="LIS", origem="ldo",
                           criado_por=por)
        s.add(d)
        s.flush()
    revs = {r.revisao: r for r in s.scalars(select(DocumentoRevisaoModel).where(DocumentoRevisaoModel.documento_id == d.id))}
    for h in leitura.historico:
        if h.revisao not in revs:
            revs[h.revisao] = DocumentoRevisaoModel(obra_id=obra_id, documento_id=d.id, revisao=h.revisao, finalidade=h.finalidade,
                                                    data_emissao=h.data, motivo=(h.descricao or "")[:300] or None, enviado_por=por)
            s.add(revs[h.revisao])
    atual = leitura.revisao or (leitura.historico[-1].revisao if leitura.historico else None)
    guardado = False
    if atual:
        r = revs.get(atual)
        if r is None:
            r = revs[atual] = DocumentoRevisaoModel(obra_id=obra_id, documento_id=d.id, revisao=atual,
                                                    finalidade="PARA CONHECIMENTO", enviado_por=por)
            s.add(r)
        if not r.arquivo_id:
            a = arquivos.guardar(s, obra_id, xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "documento",
                                 titulo=f"{leitura.codigo} rev {atual}", ligacoes={"documento": leitura.codigo, "revisao": atual},
                                 origem="documento", nome_original=nome)
            r.arquivo_id, r.nome_original, guardado = a.id, (nome or "")[:200] or None, True
    s.flush()
    return {"id": d.id, "codigo": d.codigo, "revisao": atual, "arquivo_guardado": guardado, "historico": len(leitura.historico)}


def _alvo_existe(s: Session, obra_id: int, tipo: str, alvo_id: int) -> None:
    if tipo == "area":
        m = s.get(AreaFrenteModel, alvo_id)
    elif tipo == "grupo":
        from app.modules.catalogo.infra.models import GrupoAtividadeModel

        m = s.get(GrupoAtividadeModel, alvo_id)
    elif tipo == "wbs":
        from app.modules.wbs.infra.models import WbsNoModel

        m = s.get(WbsNoModel, alvo_id)
    elif tipo == "documento":
        m = s.get(DocumentoModel, alvo_id)
    else:
        raise DomainError(f"ligue a: {', '.join(dom.ALVOS)}", "alvo_tipo")
    if m is None or m.obra_id != obra_id:
        raise NotFoundError("Destino da ligação", alvo_id)


def vincular(s: Session, obra_id: int, doc_id: int, relacao: str, alvo_tipo: str, alvo_id: int, por: str) -> dict:
    d = obter(s, obra_id, doc_id)
    if relacao not in dom.RELACOES:
        raise DomainError(f"relação: {', '.join(dom.RELACOES)}", "relacao")
    _alvo_existe(s, obra_id, alvo_tipo, alvo_id)
    if alvo_tipo == "documento" and alvo_id == d.id:
        raise DomainError("o documento não se liga a ele mesmo", "alvo_id")
    v = s.scalar(select(DocumentoVinculoModel).where(DocumentoVinculoModel.documento_id == d.id, DocumentoVinculoModel.relacao == relacao,
                                                     DocumentoVinculoModel.alvo_tipo == alvo_tipo, DocumentoVinculoModel.alvo_id == alvo_id))
    if v is None:
        v = DocumentoVinculoModel(obra_id=obra_id, documento_id=d.id, relacao=relacao, alvo_tipo=alvo_tipo, alvo_id=alvo_id, criado_por=por)
        s.add(v)
    v.sugerido = False  # ligar à mão confirma a sugestão da TAG
    s.flush()
    return {"id": v.id}


def remover_vinculo(s: Session, obra_id: int, vinculo_id: int) -> None:
    v = s.get(DocumentoVinculoModel, vinculo_id)
    if v is None or v.obra_id != obra_id:
        raise NotFoundError("Ligação", vinculo_id)
    s.delete(v)


def confirmar_vinculo(s: Session, obra_id: int, vinculo_id: int) -> None:
    v = s.get(DocumentoVinculoModel, vinculo_id)
    if v is None or v.obra_id != obra_id:
        raise NotFoundError("Ligação", vinculo_id)
    v.sugerido = False


def para_atividade(s: Session, obra_id: int, area_id: int | None = None, grupo_id: int | None = None,
                   wbs_no_id: int | None = None) -> list[dict]:
    """Documentos para o campo: só as revisões vigentes, ligados (confirmados) à frente, ao IWP/CWP da atividade ou ao
    grupo (procedimentos e normas do serviço)."""
    alvos: set[tuple[str, int]] = set()
    if area_id:
        alvos.add(("area", area_id))
    if grupo_id:
        alvos.add(("grupo", grupo_id))
    if wbs_no_id:
        from app.modules.wbs.infra.gateway import nos

        todos = nos(s, obra_id)
        n = todos.get(wbs_no_id)
        while n is not None:  # o IWP e os nós acima dele (grupo, CWP, área)
            alvos.add(("wbs", n.id))
            if n.tipo == "area" and n.area_id:
                alvos.add(("area", n.area_id))
            n = todos.get(n.pai_id) if n.pai_id else None
    if not alvos:
        return []
    vinc = [v for v in s.scalars(select(DocumentoVinculoModel).where(DocumentoVinculoModel.obra_id == obra_id,
                                                                     DocumentoVinculoModel.sugerido.is_(False)))
            if (v.alvo_tipo, v.alvo_id) in alvos and v.relacao == "aplica_a"]
    ids = sorted({v.documento_id for v in vinc})
    docs = {d.id: d for d in s.scalars(select(DocumentoModel).where(DocumentoModel.id.in_(ids or [0])))}
    revs = _revisoes(s, ids)
    out = []
    for i in ids:
        dd = _doc_dict(docs[i], revs.get(i, []))
        if dd["vigente"]:
            out.append(dd)
    return out


# ---- arquivos e leituras ---------------------------------------------------------------------------------------------

def arquivo_da_revisao(s: Session, obra_id: int, rev_id: int, formato: str, quem: str, via: str) -> tuple[bytes, str, str]:
    r = s.get(DocumentoRevisaoModel, rev_id)
    if r is None or r.obra_id != obra_id:
        raise NotFoundError("Revisão", rev_id)
    aid = {"png": r.png_arquivo_id, "pdf": r.pdf_arquivo_id, "original": r.arquivo_id, "dxf": r.dxf_arquivo_id}.get(formato)
    if formato not in ("png", "pdf", "original", "dxf"):
        raise DomainError("formato: png, pdf, original ou dxf", "formato")
    a = s.get(ArquivoModel, aid) if aid else None
    if a is None:
        raise NotFoundError("Arquivo da revisão", formato)
    d = s.get(DocumentoModel, r.documento_id)
    s.add(DocumentoLeituraModel(obra_id=obra_id, revisao_id=r.id, quem=quem[:150], via=via, formato=formato))
    s.flush()
    ext = {"png": "png", "pdf": "pdf", "dxf": "dxf"}.get(formato) or (a.nome.rsplit(".", 1)[-1] if "." in a.nome else "bin")
    return arquivos.abrir(s, a), a.mime, f"{d.codigo}-rev{r.revisao}.{ext}"


# ---- GRD -------------------------------------------------------------------------------------------------------------

def criar_grd(s: Session, obra_id: int, sentido: str, data: date, remetente: str, destinatario: str, por: str, *,
              numero_externo: str | None = None, observacao: str | None = None, itens: list[dict] | None = None,
              atencao: str | None = None, atencao_cargo: str | None = None, emitente: str | None = None,
              emitente_cargo: str | None = None, referencia: str | None = None) -> dict:
    """GRD recebida (os arquivos das revisões chegam depois, apontando para ela) ou emitida (lista as revisões vigentes
    que estão saindo). O número é sequencial por sentido e ano. Cada item leva as colunas da GRD do contrato (spec 130):
    folhas, status (letra do TE), finalidade da remessa (1–7), tipo de via, formato e nº de vias."""
    if len((remetente or "").strip()) < 2 or len((destinatario or "").strip()) < 2:
        raise DomainError("informe remetente e destinatário", "remetente")
    seq = len(list(s.scalars(select(GrdModel.id).where(GrdModel.obra_id == obra_id, GrdModel.sentido == sentido)))) + 1
    limpo = lambda x, n: (x or "").strip()[:n] or None  # noqa: E731
    g = GrdModel(obra_id=obra_id, numero=dom.numero_grd(sentido, seq, data.year), sentido=sentido, data=data,
                 remetente=remetente.strip()[:150], destinatario=destinatario.strip()[:150],
                 numero_externo=limpo(numero_externo, 80), observacao=(observacao or "").strip() or None,
                 atencao=limpo(atencao, 150), atencao_cargo=limpo(atencao_cargo, 120), emitente=limpo(emitente, 150),
                 emitente_cargo=limpo(emitente_cargo, 120), referencia=limpo(referencia, 150), criado_por=por)
    s.add(g)
    s.flush()
    for n, it in enumerate(itens or []):
        d = obter(s, obra_id, int(it["documento_id"]))
        revs = _revisoes(s, [d.id]).get(d.id, [])
        rid = it.get("revisao_id") or dom.vigente(_info(revs)) or (revs[-1].id if revs else None)
        r = next((x for x in revs if x.id == rid), None)
        if r is None:
            raise DomainError(f"{d.codigo} não tem revisão para a GRD", "itens")
        s.add(_item_grd(g, d, r, n, it, padrao_via="CC" if sentido == "emitida" else None))
    s.flush()
    return grd_detalhe(s, obra_id, g.id)


def _item_grd(g: GrdModel, d: DocumentoModel, r: DocumentoRevisaoModel, ordem: int, it: dict, padrao_via: str | None) -> GrdItemModel:
    via, formato = grd_dom.validar_item(it.get("via") or padrao_via, it.get("formato"), it.get("finalidade_remessa"), it.get("vias"), it.get("folhas"))
    return GrdItemModel(grd_id=g.id, documento_id=d.id, revisao_id=r.id, revisao=r.revisao, finalidade=r.finalidade, ordem=ordem,
                        folhas=it.get("folhas"), status=(it.get("status") or grd_dom.status_da_finalidade(r.finalidade)),
                        finalidade_remessa=it.get("finalidade_remessa") or grd_dom.finalidade_da_remessa(r.finalidade),
                        via=via, formato=formato, vias=it.get("vias") if it.get("vias") is not None else 1)


def _tipo_pelo_codigo(codigo: str) -> str:
    """Tipo do documento pelo código, quando a GRD não diz: …IT-001 → IT, …PO-01/PR- → PRO, NR/NBR → NOR, MD/MC → MEM."""
    c = codigo.upper()
    for padrao, tipo in ((r"(^|[.\-_])IT[-_.]?\d", "IT"), (r"(^|[.\-_])(PO|PR|PG|PE)[-_.]?\d", "PRO"), (r"(^|[.\-_])(NR|NBR|NORMA)", "NOR"),
                         (r"(^|[.\-_])(ET|ES|ESP)[-_.]?\d", "ESP"), (r"(^|[.\-_])(MD|MC|MEM)[-_.]?\d", "MEM"), (r"(^|[.\-_])(LD|LM|LS|LISTA)", "LIS")):
        if re.search(padrao, c):
            return tipo
    return "DES"


def importar_grd(s: Session, obra_id: int, xlsx: bytes, por: str, nome: str | None = None) -> dict:
    """GRD recebida no modelo do contrato (spec 130): cria a GRD (o número de quem mandou fica como origem), registra cada
    documento e a revisão listada apontando para ela (o arquivo chega depois e completa a mesma revisão) e guarda a planilha
    da GRD no acervo. A mesma GRD de origem não entra duas vezes."""
    try:
        wb = load_workbook(BytesIO(xlsx), read_only=True, data_only=True)
        linhas = list(wb.worksheets[0].iter_rows(values_only=True))
    except Exception as e:  # noqa: BLE001
        raise DomainError("envie a GRD em Excel (.xlsx)", "arquivo") from e
    lida = grd_dom.ler(linhas)
    if not lida.itens:
        raise DomainError("; ".join(lida.avisos) or "a GRD não tem documentos", "arquivo")
    if lida.numero and s.scalar(select(GrdModel.id).where(GrdModel.obra_id == obra_id, GrdModel.numero_externo == lida.numero)):
        raise DomainError(f"a GRD {lida.numero} já foi importada", "arquivo")
    g = criar_grd(s, obra_id, "recebida", lida.data or date.today(), lida.de or "remetente não informado", lida.para or "contratada", por,
                  numero_externo=lida.numero, observacao=lida.observacao, atencao=lida.atencao, atencao_cargo=lida.atencao_cargo,
                  emitente=lida.emitente, emitente_cargo=lida.emitente_cargo, referencia=lida.referencia)
    gm = s.get(GrdModel, g["id"])
    criados = revisoes = 0
    for n, it in enumerate(lida.itens):
        d = s.scalar(select(DocumentoModel).where(DocumentoModel.obra_id == obra_id, DocumentoModel.codigo == it.codigo))
        if d is None:
            d = DocumentoModel(obra_id=obra_id, codigo=it.codigo, titulo=it.titulo, tipo=_tipo_pelo_codigo(it.codigo), origem="grd",
                               criado_por=por)
            s.add(d)
            s.flush()
            criados += 1
        rev = it.revisao or "0"
        r = s.scalar(select(DocumentoRevisaoModel).where(DocumentoRevisaoModel.documento_id == d.id, DocumentoRevisaoModel.revisao == rev))
        if r is None:
            fin = grd_dom.STATUS.get(it.status or "", None)
            r = DocumentoRevisaoModel(obra_id=obra_id, documento_id=d.id, revisao=rev, grd_id=gm.id, enviado_por=por,
                                      finalidade=dom.normalizar_finalidade(fin if fin and fin != "OBSOLETO" else None),
                                      data_emissao=lida.data)
            s.add(r)
            s.flush()
            revisoes += 1
        elif r.grd_id is None:
            r.grd_id = gm.id
        s.add(_item_grd(gm, d, r, n, {"folhas": it.folhas, "status": it.status, "finalidade_remessa": it.finalidade, "via": it.via,
                                      "formato": it.formato, "vias": it.vias}, padrao_via=None))
    a = arquivos.guardar(s, obra_id, xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "documento",
                         titulo=f"GRD {lida.numero or gm.numero}", ligacoes={"grd": gm.numero, "origem": lida.numero},
                         origem="documento", nome_original=nome)
    gm.arquivo_id = a.id
    s.flush()
    return {**grd_detalhe(s, obra_id, gm.id), "documentos_novos": criados, "revisoes_novas": revisoes, "avisos": lida.avisos}


def _grd(s: Session, obra_id: int, gid: int) -> GrdModel:
    g = s.get(GrdModel, gid)
    if g is None or g.obra_id != obra_id:
        raise NotFoundError("GRD", gid)
    return g


def grd_detalhe(s: Session, obra_id: int, gid: int) -> dict:
    g = _grd(s, obra_id, gid)
    itens = list(s.scalars(select(GrdItemModel).where(GrdItemModel.grd_id == g.id).order_by(GrdItemModel.ordem, GrdItemModel.id)))
    docs = {d.id: d for d in s.scalars(select(DocumentoModel).where(DocumentoModel.id.in_({i.documento_id for i in itens} or {0})))}
    return {"id": g.id, "numero": g.numero, "numero_externo": g.numero_externo, "sentido": g.sentido, "data": g.data.isoformat(),
            "remetente": g.remetente, "destinatario": g.destinatario, "observacao": g.observacao,
            "atencao": g.atencao, "atencao_cargo": g.atencao_cargo, "emitente": g.emitente, "emitente_cargo": g.emitente_cargo,
            "referencia": g.referencia, "tem_arquivo": bool(g.arquivo_id),
            "ciente_por": g.ciente_por, "ciente_em": g.ciente_em.isoformat() if g.ciente_em else None,
            "itens": [{"documento_id": i.documento_id, "codigo": docs[i.documento_id].codigo, "titulo": docs[i.documento_id].titulo,
                       "revisao": i.revisao, "finalidade": i.finalidade, "revisao_id": i.revisao_id, "folhas": i.folhas,
                       "status": i.status, "finalidade_remessa": i.finalidade_remessa, "via": i.via, "formato": i.formato,
                       "vias": i.vias} for i in itens if i.documento_id in docs]}


def listar_grds(s: Session, obra_id: int) -> list[dict]:
    gs = list(s.scalars(select(GrdModel).where(GrdModel.obra_id == obra_id).order_by(GrdModel.data.desc(), GrdModel.id.desc())))
    qtd: dict[int, int] = {}
    for (gid,) in s.execute(select(GrdItemModel.grd_id).where(GrdItemModel.grd_id.in_([g.id for g in gs] or [0]))):
        qtd[gid] = qtd.get(gid, 0) + 1
    return [{"id": g.id, "numero": g.numero, "numero_externo": g.numero_externo, "sentido": g.sentido, "data": g.data.isoformat(),
             "remetente": g.remetente, "destinatario": g.destinatario, "itens": qtd.get(g.id, 0),
             "ciente_por": g.ciente_por, "ciente_em": g.ciente_em.isoformat() if g.ciente_em else None,
             "atencao": g.atencao, "emitente": g.emitente, "referencia": g.referencia, "tem_arquivo": bool(g.arquivo_id)} for g in gs]


def ciencia_grd(s: Session, obra_id: int, gid: int, por: str) -> None:
    g = _grd(s, obra_id, gid)
    if g.ciente_em is None:
        g.ciente_por, g.ciente_em = por[:150], datetime.now(timezone.utc)


# ---- grafo (Zettelkasten → mapa de conexões) ---------------------------------------------------------------------------

def grafo(s: Session, obra_id: int) -> dict:
    """Nós (documentos, frentes, grupos, nós da WBS) e arestas (ligações) para o mapa de conexões — o mesmo que o
    graphify/Obsidian monta a partir das notas `.md` do acervo."""
    docs = list(s.scalars(select(DocumentoModel).where(DocumentoModel.obra_id == obra_id)))
    vinc = list(s.scalars(select(DocumentoVinculoModel).where(DocumentoVinculoModel.obra_id == obra_id)))
    revs = _revisoes(s, [d.id for d in docs])
    rot = _rotulos(s, obra_id, vinc)
    nos = [{"id": f"documento:{d.id}", "tipo": "documento", "rotulo": d.codigo, "titulo": d.titulo, "doc_tipo": d.tipo,
            "vigente": (lambda v: next((r.revisao for r in revs.get(d.id, []) if r.id == v), None))(dom.vigente(_info(revs.get(d.id, []))))}
           for d in docs]
    vistos = {n["id"] for n in nos}
    arestas = []
    for v in vinc:
        alvo = f"{v.alvo_tipo}:{v.alvo_id}"
        if alvo not in vistos:
            vistos.add(alvo)
            nos.append({"id": alvo, "tipo": v.alvo_tipo, "rotulo": rot.get((v.alvo_tipo, v.alvo_id), alvo)})
        arestas.append({"de": f"documento:{v.documento_id}", "para": alvo, "relacao": v.relacao, "sugerido": v.sugerido})
    return {"nos": nos, "arestas": arestas}


# ---- acervo ----------------------------------------------------------------------------------------------------------

def _em_uso():
    from sqlalchemy import union_all

    from app.modules.documentos.infra.models import DocumentoRecebidoModel

    R = DocumentoRevisaoModel
    colunas = (R.arquivo_id, R.pdf_arquivo_id, R.png_arquivo_id, R.dxf_arquivo_id, GrdModel.arquivo_id,  # GRD como chegou (spec 130)
               DocumentoRecebidoModel.arquivo_id)  # esperando relacionar (spec 132)
    return union_all(*(select(c).where(c.is_not(None)) for c in colunas))


registrar(Usuario("documentos controlados", ("documento", "documento-visual"), lambda s, limite: 0, _em_uso))
