"""Controle de projetos por ativo (spec 133): importar a planilha que liga os projetos aos ativos/CWAs, ligar cada projeto à
frente (aplica_a → área) e publicar a situação de projeto por frente para a WBS, o plano e a programação.

- TAG ou CWA único confirmam a frente; só o nome sugere (ligação `sugerido` até alguém confirmar).
- Projeto cancelado no ativo não liga (e a sugestão antiga daquele par sai); projeto fora da LDO fica listado, sem criar documento.
- Ativo sem frente fica para relacionar à mão (`definir_frente`), e aí os projetos dele são ligados.
"""
from io import BytesIO

from openpyxl import load_workbook
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.modules.documentos.application import servico as sv
from app.modules.documentos.domain import controle_ativo as ca
from app.modules.documentos.domain import documento as dom
from app.modules.documentos.domain.ldo import AreaRef
from app.modules.documentos.infra.models import (ControleAtivoModel, ControleAtivoProjetoModel, DocumentoModel,
                                                 DocumentoVinculoModel)
from app.modules.frentes.infra.models import AreaFrenteModel, LocalFrenteModel
from app.shared.errors import DomainError, NotFoundError
from app.shared.memoria import Fonte, Memoria, Passo

# do mais grave ao mais tranquilo: a frente mostra o pior ativo que cai nela
GRAVIDADE = ["critico", "pendente", "sem_projeto", "revisao", "outro", "parcial", "ok"]


def _areas(s: Session, obra_id: int) -> list[AreaRef]:
    locais = {lf.id: lf.descricao for lf in s.scalars(select(LocalFrenteModel).where(LocalFrenteModel.obra_id == obra_id))}
    return [AreaRef(a.id, a.codigo, a.cwa or a.codigo, a.descricao, a.ativo_codigo, locais.get(a.local_id, ""))
            for a in s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == obra_id, AreaFrenteModel.ativo.is_(True))
                               .order_by(AreaFrenteModel.ordem, AreaFrenteModel.codigo))]


def _ler(xlsx: bytes) -> ca.Leitura:
    try:
        wb = load_workbook(BytesIO(xlsx), read_only=True, data_only=True)
        abas = [list(ws.iter_rows(values_only=True)) for ws in wb.worksheets]
    except Exception as e:  # noqa: BLE001
        raise DomainError("envie o controle de projetos por ativo em Excel (.xlsx)", "arquivo") from e
    for linhas in abas:
        leitura = ca.ler([tuple(r) for r in linhas])
        if leitura.ativos:
            return leitura
    raise DomainError("não achei o controle: precisa de uma aba com as colunas Ativo e Projeto (STATUS | Ativo | Projeto | "
                      "Disciplina | OBS)", "arquivo")


def _docs(s: Session, obra_id: int, codigos: set[str]) -> dict[str, DocumentoModel]:
    if not codigos:
        return {}
    return {d.codigo: d for d in s.scalars(select(DocumentoModel).where(DocumentoModel.obra_id == obra_id,
                                                                         DocumentoModel.codigo.in_(codigos)))}


def _resumo(leitura: ca.Leitura, areas: list[AreaRef], docs: dict[str, DocumentoModel]) -> dict:
    por_status: dict[str, int] = {}
    confirmadas = sugeridas = 0
    sem_frente: list[str] = []
    projetos = cancelados = na_ldo = 0
    fora: list[str] = []
    for a in leitura.ativos:
        por_status[a.status] = por_status.get(a.status, 0) + 1
        for r in a.refs:
            area, ok, _ = ca.casar_ativo(r, areas)
            if area and ok:
                confirmadas += 1
            elif area:
                sugeridas += 1
            else:
                sem_frente.append(r.texto)
        for p in a.projetos:
            if not p.codigo:
                continue
            if p.cancelado:
                cancelados += 1
                continue
            projetos += 1
            if p.codigo in docs:
                na_ldo += 1
            elif p.codigo not in fora:
                fora.append(p.codigo)
    return {"ativos": len(leitura.ativos), "por_status": por_status, "frentes_confirmadas": confirmadas, "frentes_sugeridas": sugeridas,
            "sem_frente": sem_frente, "projetos": projetos, "cancelados": cancelados, "na_ldo": na_ldo, "fora_ldo": fora,
            "avisos": leitura.avisos}


def previa(s: Session, obra_id: int, xlsx: bytes) -> dict:
    leitura = _ler(xlsx)
    codigos = {p.codigo for a in leitura.ativos for p in a.projetos if p.codigo}
    return _resumo(leitura, _areas(s, obra_id), _docs(s, obra_id, codigos))


def _ligar(s: Session, obra_id: int, doc_id: int, area_id: int, confirmada: bool, por: str,
           existentes: dict[tuple[int, int], DocumentoVinculoModel]) -> str | None:
    v = existentes.get((doc_id, area_id))
    if v is None:
        v = DocumentoVinculoModel(obra_id=obra_id, documento_id=doc_id, relacao="aplica_a", alvo_tipo="area", alvo_id=area_id,
                                  sugerido=not confirmada, criado_por=por)
        s.add(v)
        existentes[(doc_id, area_id)] = v
        return "nova"
    if confirmada and v.sugerido:
        v.sugerido = False
        return "confirmada"
    return None


def _vinculos(s: Session, obra_id: int) -> dict[tuple[int, int], DocumentoVinculoModel]:
    return {(v.documento_id, v.alvo_id): v for v in s.scalars(select(DocumentoVinculoModel).where(
        DocumentoVinculoModel.obra_id == obra_id, DocumentoVinculoModel.relacao == "aplica_a", DocumentoVinculoModel.alvo_tipo == "area"))}


def importar(s: Session, obra_id: int, xlsx: bytes, por: str) -> dict:
    leitura = _ler(xlsx)
    areas = _areas(s, obra_id)
    codigos = {p.codigo for a in leitura.ativos for p in a.projetos if p.codigo}
    docs = _docs(s, obra_id, codigos)
    resumo = _resumo(leitura, areas, docs)
    s.execute(delete(ControleAtivoModel).where(ControleAtivoModel.obra_id == obra_id))
    existentes = _vinculos(s, obra_id)
    novas = confirmadas = removidas = 0
    for ordem, a in enumerate(leitura.ativos):
        refs = []
        for r in a.refs:
            area, ok, como = ca.casar_ativo(r, areas)
            refs.append({"texto": r.texto, "cwa": r.cwa, "tag": r.tag, "descricao": r.descricao, "area_id": area,
                         "confirmada": bool(area and ok), "como": como or None})
        c = ControleAtivoModel(obra_id=obra_id, grupo=a.grupo, texto=a.texto, status=a.status, status_texto=a.status_texto,
                               refs=refs, ordem=ordem, linha=a.linha, importado_por=por)
        s.add(c)
        s.flush()
        for i, p in enumerate(a.projetos):
            d = docs.get(p.codigo) if p.codigo else None
            s.add(ControleAtivoProjetoModel(obra_id=obra_id, controle_id=c.id, codigo=p.codigo, revisao=p.revisao,
                                            disciplina=(p.disciplina or "")[:200] or None, obs=(p.obs or "")[:300] or None,
                                            nota=(p.nota or "")[:120] or None, cancelado=p.cancelado,
                                            documento_id=d.id if d else None, ordem=i, linha=p.linha))
            if d is None:
                continue
            for r in refs:
                if not r["area_id"]:
                    continue
                if p.cancelado:
                    v = existentes.get((d.id, r["area_id"]))
                    if v is not None and v.sugerido:
                        s.delete(v)
                        existentes.pop((d.id, r["area_id"]))
                        removidas += 1
                    continue
                feito = _ligar(s, obra_id, d.id, r["area_id"], r["confirmada"], por, existentes)
                novas += feito == "nova"
                confirmadas += feito == "confirmada"
    s.flush()
    return {**resumo, "ligacoes_novas": novas, "ligacoes_confirmadas": confirmadas, "sugestoes_removidas": removidas}


def _revisao_vigente(s: Session, doc_ids: list[int]) -> dict[int, str | None]:
    revs = sv._revisoes(s, doc_ids)
    saida: dict[int, str | None] = {}
    for did in doc_ids:
        rs = revs.get(did, [])
        v = dom.vigente(sv._info(rs))
        saida[did] = next((r.revisao for r in rs if r.id == v), None)
    return saida


def listar(s: Session, obra_id: int) -> dict:
    cs = list(s.scalars(select(ControleAtivoModel).where(ControleAtivoModel.obra_id == obra_id).order_by(ControleAtivoModel.ordem)))
    ps = list(s.scalars(select(ControleAtivoProjetoModel).where(ControleAtivoProjetoModel.obra_id == obra_id)
                        .order_by(ControleAtivoProjetoModel.controle_id, ControleAtivoProjetoModel.ordem)))
    doc_ids = sorted({p.documento_id for p in ps if p.documento_id})
    docs = {d.id: d for d in s.scalars(select(DocumentoModel).where(DocumentoModel.id.in_(doc_ids or [0])))}
    vig = _revisao_vigente(s, doc_ids)
    areas = _areas(s, obra_id)
    rot = {a.id: f"{a.codigo} — {a.descricao}" for a in areas}
    parecidos = _parecidos(s, obra_id, {p.codigo for p in ps if p.codigo and not p.documento_id and not p.cancelado})
    por_c: dict[int, list[dict]] = {}
    tot = {"projetos": 0, "vigentes": 0, "sem_vigente": 0, "fora_ldo": 0, "cancelados": 0}
    for p in ps:
        if p.cancelado:
            sit = "cancelado"
        elif not p.codigo:
            sit = "sem_projeto"
        elif not p.documento_id:
            sit = "fora_ldo"
        elif vig.get(p.documento_id):
            sit = "vigente"
        else:
            sit = "sem_vigente"
        if sit in ("vigente", "sem_vigente", "fora_ldo"):
            tot["projetos"] += 1
        chave = {"vigente": "vigentes", "sem_vigente": "sem_vigente", "fora_ldo": "fora_ldo", "cancelado": "cancelados"}.get(sit)
        if chave:
            tot[chave] += 1
        d = docs.get(p.documento_id) if p.documento_id else None
        por_c.setdefault(p.controle_id, []).append({
            "id": p.id, "codigo": p.codigo, "revisao_citada": p.revisao, "disciplina": p.disciplina, "obs": p.obs, "nota": p.nota,
            "cancelado": p.cancelado, "documento_id": p.documento_id, "titulo": d.titulo if d else None,
            "vigente": vig.get(p.documento_id) if p.documento_id else None, "situacao": sit,
            "parecidos": parecidos.get(p.codigo, []) if sit == "fora_ldo" else []})
    ligados = {v.documento_id for v in _vinculos(s, obra_id).values()}
    ldo_sem_frente = sum(1 for did in s.scalars(select(DocumentoModel.id).where(DocumentoModel.obra_id == obra_id,
                                                                                  DocumentoModel.tipo == "DES")) if did not in ligados)
    ativos = [{"id": c.id, "grupo": c.grupo, "texto": c.texto, "status": c.status, "status_texto": c.status_texto, "linha": c.linha,
               "refs": [{**r, "indice": i, "area": rot.get(r.get("area_id"))} for i, r in enumerate(c.refs or [])],
               "projetos": por_c.get(c.id, [])} for c in cs]
    return {"importado_em": cs[0].importado_em.isoformat() if cs else None, "importado_por": cs[0].importado_por if cs else None,
            "ativos": ativos, "totais": {**tot, "ativos": len(cs), "sem_frente": sum(1 for c in cs for r in (c.refs or []) if not r.get("area_id")),
                                         "a_confirmar": sum(1 for c in cs for r in (c.refs or []) if r.get("area_id") and not r.get("confirmada")),
                                         "desenhos_sem_frente": ldo_sem_frente},
            "status": ca.STATUS, "areas": [{"id": a.id, "rotulo": rot[a.id]} for a in areas]}


def _parecidos(s: Session, obra_id: int, fora: set[str]) -> dict[str, list[str]]:
    """Projeto fora da LDO com o mesmo número em outro código da LDO (ex.: 1600AA-A-51274 × 1600AA-C-51274): só a dica para
    conferir — nunca liga sozinho."""
    if not fora:
        return {}
    por_numero: dict[str, list[str]] = {}
    for (cod,) in s.execute(select(DocumentoModel.codigo).where(DocumentoModel.obra_id == obra_id)):
        por_numero.setdefault(cod.rsplit("-", 1)[-1], []).append(cod)
    saida = {}
    for c in fora:
        prefixo = ca.prefixo_area(c)
        cands = [x for x in por_numero.get(c.rsplit("-", 1)[-1], []) if prefixo and ca.prefixo_area(x) == prefixo]
        if cands:
            saida[c] = sorted(cands)[:3]
    return saida


def definir_frente(s: Session, obra_id: int, controle_id: int, indice: int, area_id: int | None, por: str) -> dict:
    """Relacionar à mão o ativo à frente (ou confirmar a sugestão): os projetos dele passam a valer para a frente."""
    c = s.get(ControleAtivoModel, controle_id)
    if c is None or c.obra_id != obra_id:
        raise NotFoundError("Ativo do controle", controle_id)
    refs = [dict(r) for r in (c.refs or [])]
    if not 0 <= indice < len(refs):
        raise DomainError("referência do ativo inexistente", "indice")
    if area_id is not None:
        a = s.get(AreaFrenteModel, area_id)
        if a is None or a.obra_id != obra_id:
            raise NotFoundError("Frente", area_id)
    refs[indice].update({"area_id": area_id, "confirmada": area_id is not None, "como": "relacionado à mão" if area_id else None})
    c.refs = refs
    ligados = 0
    if area_id is not None:
        existentes = _vinculos(s, obra_id)
        for p in s.scalars(select(ControleAtivoProjetoModel).where(ControleAtivoProjetoModel.controle_id == c.id)):
            if p.documento_id and not p.cancelado:
                ligados += _ligar(s, obra_id, p.documento_id, area_id, True, por, existentes) is not None
    s.flush()
    return {"ligados": ligados}


def situacao_por_frente(s: Session, obra_id: int) -> dict[int, dict]:
    """Por frente (área): a situação dos projetos dos ativos que caem nela (o pior), quantos projetos, quantos com revisão vigente
    — com a memória do número. Usado na WBS, no plano e na programação."""
    cs = list(s.scalars(select(ControleAtivoModel).where(ControleAtivoModel.obra_id == obra_id)))
    if not cs:
        return {}
    ps = list(s.scalars(select(ControleAtivoProjetoModel).where(ControleAtivoProjetoModel.obra_id == obra_id,
                                                                 ControleAtivoProjetoModel.cancelado.is_(False))))
    vig = _revisao_vigente(s, sorted({p.documento_id for p in ps if p.documento_id}))
    por_c: dict[int, list[ControleAtivoProjetoModel]] = {}
    for p in ps:
        por_c.setdefault(p.controle_id, []).append(p)
    saida: dict[int, dict] = {}
    for c in cs:
        for r in c.refs or []:
            aid = r.get("area_id")
            if not aid:
                continue
            x = saida.setdefault(aid, {"status": "ok", "ativos": [], "projetos": [], "confirmada": True})
            if GRAVIDADE.index(c.status) < GRAVIDADE.index(x["status"]):
                x["status"] = c.status
            x["ativos"].append({"texto": c.texto, "status": c.status, "status_texto": c.status_texto, "linha": c.linha})
            x["confirmada"] = x["confirmada"] and bool(r.get("confirmada"))
            for p in por_c.get(c.id, []):
                if p.codigo and p.codigo not in {q["codigo"] for q in x["projetos"]}:
                    x["projetos"].append({"codigo": p.codigo, "documento_id": p.documento_id,
                                          "vigente": vig.get(p.documento_id) if p.documento_id else None, "linha": p.linha})
    for aid, x in saida.items():
        total = len(x["projetos"])
        vigentes = sum(1 for p in x["projetos"] if p["vigente"])
        x.update({"rotulo": ca.STATUS.get(x["status"], x["status"]), "libera": x["status"] in ca.LIBERA, "total": total,
                  "vigentes": vigentes, "memoria": Memoria(
                      chave="projetos", titulo="Projetos da frente com revisão vigente", valor=f"{vigentes}/{total}",
                      formula="projetos do controle por ativo (não cancelados) com revisão vigente na LDO ÷ projetos listados",
                      passos=(Passo("Projetos listados nos ativos da frente", "contagem", str(total)),
                              Passo("Com revisão vigente (libera o uso)", "contagem", str(vigentes), True)),
                      fontes=tuple(Fonte(p["codigo"], f"rev. {p['vigente']}" if p["vigente"] else ("sem vigente" if p["documento_id"] else "fora da LDO"),
                                         "Controle de projetos por ativo", f"linha {p['linha']}") for p in x["projetos"][:40])
                      + tuple(Fonte("Situação do ativo", a["status_texto"] or ca.STATUS.get(a["status"], ""), "Controle de projetos por ativo",
                                    f"linha {a['linha']} · {a['texto'][:60]}") for a in x["ativos"]),
                      notas=(("a frente foi só sugerida pelo nome: confirme em Documentos › Conexões",) if not x["confirmada"] else ())).como_dict()})
        del x["projetos"]
    return saida
