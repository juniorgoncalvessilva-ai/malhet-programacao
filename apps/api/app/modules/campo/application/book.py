"""Book de fotos (spec 062): as fotos de campo com a frente, a atividade e a data de execução, e as das ocorrências e
restrições, prontas para agrupar por frente, atividade ou data. Lê a visão publicada da programação (planejamento)."""
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.campo.infra.models import FotoCampoModel
from app.modules.frentes.infra.models import AreaFrenteModel, LocalFrenteModel
from app.modules.indicadores.infra.models import CausaDesvioModel, DesvioModel
from app.modules.planejamento.application import servico as sv
from app.modules.planejamento.infra.models import LinhaProgramacaoModel, ProgramacaoModel
from app.modules.restricoes.infra.models import AcaoRestricaoModel

# atividade = linha da programação ou atividade registrada fora dela (spec 119)
TIPOS = {"atividade": ("linha", "registro"), "ocorrencia": ("desvio",), "restricao": ("restricao",), "auditoria": ("auditoria",),
         "acao": ("acao",)}


def _frentes(s: Session, obra_id: int) -> dict[int, dict]:
    locais = {lc.id: lc for lc in s.scalars(select(LocalFrenteModel).where(LocalFrenteModel.obra_id == obra_id))}
    out = {}
    for a in s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == obra_id)):
        lc = locais.get(a.local_id)
        out[a.id] = {"area_id": a.id, "area": f"{a.codigo} · {a.descricao}", "area_codigo": a.codigo,
                     "local": f"{lc.codigo} · {lc.descricao}" if lc else None}
    return out


def montar_book(s: Session, obra_id: int, de: date | None, ate: date | None, tipo: str | None, area_id: int | None) -> list[dict]:
    alvos = list(TIPOS[tipo]) if tipo in TIPOS else [a for v in TIPOS.values() for a in v]
    fotos = list(s.execute(select(FotoCampoModel.id, FotoCampoModel.alvo, FotoCampoModel.alvo_id, FotoCampoModel.data,
                                  FotoCampoModel.legenda, FotoCampoModel.enviado_em, FotoCampoModel.enviado_por)
                           .where(FotoCampoModel.obra_id == obra_id, FotoCampoModel.alvo.in_(alvos))
                           .order_by(FotoCampoModel.id.desc())))
    frentes = _frentes(s, obra_id)
    sem_frente = {"area_id": None, "area": "Sem frente", "area_codigo": None, "local": None}

    # atividades: a linha da programação pela visão (código, nome, CWP, área), uma visão por programação
    ids_linha = {f.alvo_id for f in fotos if f.alvo == "linha"}
    linhas: dict[int, dict] = {}
    if ids_linha:
        progs = {pid for (pid,) in s.execute(select(LinhaProgramacaoModel.programacao_id).where(LinhaProgramacaoModel.id.in_(ids_linha)))}
        for p in s.scalars(select(ProgramacaoModel).where(ProgramacaoModel.id.in_(progs), ProgramacaoModel.obra_id == obra_id)):
            for loc in sv.visao(s, p)["locais"]:
                for a in loc["areas"]:
                    for ln in a["linhas"]:
                        if ln["id"] in ids_linha:
                            linhas[ln["id"]] = {"area_id": a["id"], "programacao": p.titulo, "codigo": ln["codigo_simova"],
                                                "atividade": ln.get("descricao_reduzida") or ln["descricao"],
                                                "cwp": (ln.get("cwp") or {}).get("texto"), "equipe": ln.get("equipe")}
    ids_desvio = {f.alvo_id for f in fotos if f.alvo == "desvio"}
    desvios = {d.id: d for d in s.scalars(select(DesvioModel).where(DesvioModel.id.in_(ids_desvio), DesvioModel.obra_id == obra_id))} if ids_desvio else {}
    causas = {c.id: c.descricao for c in s.scalars(select(CausaDesvioModel).where(CausaDesvioModel.obra_id == obra_id))} if desvios else {}
    if desvios:  # frente da ocorrência: a área da atividade impactada
        faltam = {d.linha_id for d in desvios.values() if d.linha_id and d.linha_id not in linhas}
        for lid, aid in s.execute(select(LinhaProgramacaoModel.id, LinhaProgramacaoModel.area_id).where(LinhaProgramacaoModel.id.in_(faltam))):
            linhas.setdefault(lid, {"area_id": aid})
    # auditorias (antes/depois) e evidências das ações 5W2H — spec 070
    from app.modules.acoes.infra.models import AcaoModel
    from app.modules.auditorias.infra.models import RegistroAuditoriaModel

    ids_aud = {f.alvo_id for f in fotos if f.alvo == "auditoria"}
    auditorias = {r.id: r for r in s.scalars(select(RegistroAuditoriaModel).where(RegistroAuditoriaModel.id.in_(ids_aud), RegistroAuditoriaModel.obra_id == obra_id))} if ids_aud else {}
    ids_acao = {f.alvo_id for f in fotos if f.alvo == "acao"}
    acoes = {a.id: a for a in s.scalars(select(AcaoModel).where(AcaoModel.id.in_(ids_acao), AcaoModel.obra_id == obra_id))} if ids_acao else {}
    from app.modules.campo.infra.models import RegistroAtividadeModel

    ids_reg = {f.alvo_id for f in fotos if f.alvo == "registro"}
    registros = {r.id: r for r in s.scalars(select(RegistroAtividadeModel).where(
        RegistroAtividadeModel.id.in_(ids_reg), RegistroAtividadeModel.obra_id == obra_id))} if ids_reg else {}
    ids_restr = {f.alvo_id for f in fotos if f.alvo == "restricao"}
    restricoes = {r.id: r for r in s.scalars(select(AcaoRestricaoModel).where(AcaoRestricaoModel.id.in_(ids_restr), AcaoRestricaoModel.obra_id == obra_id))} if ids_restr else {}

    out = []
    for f in fotos:
        base = {"id": f.id, "legenda": f.legenda, "enviado_em": f.enviado_em.isoformat() if f.enviado_em else None,
                "enviado_por": f.enviado_por, "alvo_id": f.alvo_id}
        if f.alvo == "linha":
            ln = linhas.get(f.alvo_id)
            if ln is None:
                continue
            fr = frentes.get(ln["area_id"], sem_frente)
            item = {**base, **fr, "tipo": "atividade", "data": (f.data or f.enviado_em.date()).isoformat(),
                    "atividade": f"{ln['codigo']} · {ln['atividade']}", "cwp": ln["cwp"], "equipe": ln["equipe"],
                    "programacao": ln["programacao"], "titulo": None, "causa": None}
        elif f.alvo == "registro":
            r = registros.get(f.alvo_id)
            if r is None:
                continue
            fr = frentes.get(r.area_id, sem_frente)
            item = {**base, **fr, "tipo": "atividade", "data": r.data.isoformat(),
                    "atividade": r.descricao_item or "Atividade fora da programação", "cwp": None, "equipe": None,
                    "programacao": "Fora da programação", "titulo": r.descricao, "causa": None, "registro": True}
        elif f.alvo == "desvio":
            d = desvios.get(f.alvo_id)
            if d is None:
                continue
            aid = d.area_id or (linhas.get(d.linha_id) or {}).get("area_id")
            fr = frentes.get(aid) if aid else None
            fr = fr or {**sem_frente, "area": d.frente or "Sem frente"}
            item = {**base, **fr, "tipo": "ocorrencia", "data": d.data.isoformat(),
                    "atividade": " · ".join(x for x in (d.referencia, d.atividade_impactada) if x) or None, "cwp": None, "equipe": None,
                    "programacao": None, "titulo": d.descricao, "causa": causas.get(d.causa_id), "acao": d.acao}
        elif f.alvo == "auditoria":
            r = auditorias.get(f.alvo_id)
            if r is None or r.status == "rascunho":
                continue
            fr = frentes.get(r.area_id) if r.area_id else None
            fr = fr or {**sem_frente, "area": r.area_texto or "Sem frente", "local": r.local}
            momento = "DEPOIS" if (f.legenda or "").startswith("depois") else "ANTES"
            item = {**base, **fr, "tipo": "auditoria", "data": r.data.isoformat(), "atividade": r.tipo_registro, "cwp": None,
                    "equipe": r.encarregado, "programacao": None, "titulo": f"{r.tipo} Nº {r.numero} · {momento} · {r.nao_conformidade or ''}"[:300],
                    "causa": r.tipo, "acao": r.medida_corretiva, "momento": momento.lower()}
        elif f.alvo == "acao":
            a = acoes.get(f.alvo_id)
            if a is None:
                continue
            fr = frentes.get(a.area_id) if a.area_id else None
            fr = fr or {**sem_frente, "area": a.onde or "Sem frente"}
            item = {**base, **fr, "tipo": "acao", "data": (a.concluida_em or f.enviado_em).date().isoformat(),
                    "atividade": a.origem_texto, "cwp": None, "equipe": a.quem, "programacao": None,
                    "titulo": f"Ação A-{a.numero} · evidência · {a.o_que}"[:300], "causa": None, "acao": a.conclusao_texto}
        else:
            r = restricoes.get(f.alvo_id)
            if r is None:
                continue
            fr = frentes.get(r.area_id) if r.area_id else None
            fr = fr or {**sem_frente, "area": r.area_texto or "Sem frente"}
            item = {**base, **fr, "tipo": "restricao", "data": (f.data or f.enviado_em.date()).isoformat(),
                    "atividade": r.atividade, "cwp": None, "equipe": None, "programacao": None,
                    "titulo": f"Restrição Nº {r.numero} · {r.acao}", "causa": None, "status": r.status1}
        d0 = date.fromisoformat(item["data"])
        if (de and d0 < de) or (ate and d0 > ate) or (area_id and item["area_id"] != area_id):
            continue
        out.append(item)
    out.sort(key=lambda x: (x["data"], x["id"]), reverse=True)
    return out


LIMITE_ZIP = 3000  # fotos por arquivo: acima disso, filtrar por dia ou frente
_ROTULO_ZIP = {"atividade": "atividade", "ocorrencia": "ocorrencia", "restricao": "restricao", "auditoria": "auditoria", "acao": "acao-5w2h"}


def montar_zip(s: Session, obra_id: int, de: date | None, ate: date | None, tipo: str | None, area_id: int | None,
               ids: set[int] | None = None) -> tuple[str, str]:
    """Book em .zip (spec 145): pastas AAAA-MM-DD/<frente>/ com as fotos originais (o nome diz dia, hora, frente, tipo e id)
    e `indice.xlsx` com o que cada foto é. Devolve (caminho do arquivo temporário, nome para baixar)."""
    import tempfile
    import zipfile
    from io import BytesIO
    from zoneinfo import ZoneInfo

    from openpyxl import Workbook

    from app.modules.campo.application.arquivos import conteudo
    from app.modules.campo.domain.foto import nome_arquivo, nome_seguro
    from app.shared.errors import DomainError

    itens = [x for x in montar_book(s, obra_id, de, ate, tipo, area_id) if ids is None or x["id"] in ids]
    if not itens:
        raise DomainError("nenhuma foto com esses filtros", "filtro")
    if len(itens) > LIMITE_ZIP:
        raise DomainError(f"{len(itens)} fotos: escolha um dia, um período menor ou uma frente (até {LIMITE_ZIP} por vez)", "filtro")
    fotos = {f.id: f for f in s.scalars(select(FotoCampoModel).where(FotoCampoModel.obra_id == obra_id,
                                                                     FotoCampoModel.id.in_([x["id"] for x in itens])))}
    wb = Workbook()
    ws = wb.active
    ws.title = "Fotos"
    ws.append(["Arquivo", "Dia", "Hora", "Local", "Frente", "Tipo", "Atividade / item", "CWP", "Descrição", "Legenda"])
    tmp = tempfile.NamedTemporaryFile(prefix="book-", suffix=".zip", delete=False)
    usados: set[str] = set()
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_STORED) as z:  # foto já é comprimida: guardar é mais rápido
        for x in sorted(itens, key=lambda i: (i["data"], i.get("area") or "", i["id"])):
            f = fotos.get(x["id"])
            if f is None:
                continue
            quando = f.enviado_em.astimezone(ZoneInfo("America/Sao_Paulo")) if f.enviado_em else None
            hora = quando.strftime("%H%M") if quando else ""
            ext = {"image/png": "png", "image/webp": "webp"}.get(f.content_type, "jpg")
            pasta = f"{x['data']}/{nome_seguro(x.get('area') or 'Sem frente') or 'Sem frente'}"
            nome = nome_arquivo(x["data"].replace("-", ""), hora, x.get("area_codigo") or "", _ROTULO_ZIP.get(x["tipo"], x["tipo"]), f.id, ext)
            caminho = f"{pasta}/{nome}"
            if caminho in usados:
                continue
            usados.add(caminho)
            try:
                z.writestr(caminho, conteudo(s, f))
            except Exception:  # noqa: BLE001 — arquivo que sumiu do armazenamento não derruba o lote; fica no índice
                caminho = f"(não encontrado) {caminho}"
            ws.append([caminho, x["data"], f"{hora[:2]}:{hora[2:]}" if hora else "", x.get("local") or "", x.get("area") or "",
                       x["tipo"], x.get("atividade") or "", x.get("cwp") or "", x.get("titulo") or "", x.get("legenda") or ""])
        for col, larg in zip("ABCDEFGHIJ", (60, 11, 7, 28, 32, 12, 40, 28, 40, 24)):
            ws.column_dimensions[col].width = larg
        ws.freeze_panes = "A2"
        b = BytesIO()
        wb.save(b)
        z.writestr("indice.xlsx", b.getvalue(), compress_type=zipfile.ZIP_DEFLATED)
    tmp.close()
    dias = sorted({x["data"] for x in itens})
    periodo = dias[0].replace("-", "") + ("" if len(dias) == 1 else "-" + dias[-1].replace("-", ""))
    areas = {x.get("area_codigo") for x in itens}
    sufixo = f"-{nome_seguro(next(iter(areas)) or 'sem-frente', 30)}" if len(areas) == 1 else ""
    return tmp.name, f"fotos-{periodo}{sufixo}.zip".replace(" ", "-")
