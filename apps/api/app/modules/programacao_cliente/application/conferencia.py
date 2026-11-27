"""Conferência da programação semanal do cliente (spec 146): a planilha entra numa área própria da obra, cada linha é
ligada ao Malhet (frente, cronograma, item da PQ, tipo, IWP, equipe) e quem confere confirma, troca ou ignora. Nenhuma
programação muda aqui. Cada decisão fica lembrada pela chave da linha: na semana seguinte a mesma atividade entra ligada."""
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.programacao_cliente.domain import planilha as pl
from app.modules.programacao_cliente.domain import vinculo as vc
from app.modules.programacao_cliente.infra import gateway as gw
from app.modules.programacao_cliente.infra.models import DecisaoClienteModel, ImportacaoClienteModel, LinhaClienteModel
from app.shared.errors import DomainError, NotFoundError
from app.shared.memoria import Fonte, Memoria, Passo, num

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
CAMPOS = ("area", "item", "wbs", "equipe")
JORNADA = 9.0


def obter(s: Session, obra_id: int, iid: int) -> ImportacaoClienteModel:
    imp = s.get(ImportacaoClienteModel, iid)
    if imp is None or imp.obra_id != obra_id:
        raise NotFoundError("Importação", iid)
    return imp


def _linha(imp: ImportacaoClienteModel, lid: int) -> LinhaClienteModel:
    ln = next((x for x in imp.linhas if x.id == lid), None)
    if ln is None:
        raise NotFoundError("Linha", lid)
    return ln


def _frente(d: dict) -> str | None:
    return d.get("cwa") or d.get("grupo_cwa") or d.get("local") or d.get("grupo")


def importar(s: Session, obra_id: int, dados: bytes, nome: str, aba: str | None, por: str) -> ImportacaoClienteModel:
    p = pl.ler(dados, aba)
    from app.modules.arquivos.application.servico import guardar

    arq = guardar(s, obra_id, dados, XLSX, "programacao", titulo=f"programação do cliente {p.aba}", nome_original=nome,
                  origem="programacao_cliente")
    imp = ImportacaoClienteModel(obra_id=obra_id, nome_arquivo=nome[:200], arquivo_id=arq.id, aba=p.aba[:120], abas=list(p.abas),
                                 titulo=(p.titulo or "")[:300] or None, inicio=p.inicio, fim=p.fim, avisos=list(p.avisos),
                                 situacao="conferindo", criado_por=por[:80])
    s.add(imp)
    for i, x in enumerate(p.linhas, start=1):
        d = x.como_dict()
        imp.linhas.append(LinhaClienteModel(obra_id=obra_id, ordem=i, linha=x.linha, dados=d,
                                            chave=vc.chave_decisao(x.descricao, _frente(d), x.unidade)))
    s.flush()
    vincular(s, obra_id, imp)
    return imp


def _decisoes(s: Session, obra_id: int) -> dict[str, DecisaoClienteModel]:
    return {d.chave: d for d in s.scalars(select(DecisaoClienteModel).where(DecisaoClienteModel.obra_id == obra_id))}


def vincular(s: Session, obra_id: int, imp: ImportacaoClienteModel, so: set[int] | None = None) -> None:
    """Liga as linhas ainda não conferidas (ou só `so`). O que alguém já conferiu não é refeito."""
    ref = gw.carregar(s, obra_id)
    decs = _decisoes(s, obra_id)
    for ln in imp.linhas:
        if (so is not None and ln.id not in so) or (so is None and ln.conferida) or ln.levada_linha_id:
            continue
        _ligar(s, obra_id, ref, ln, decs)
    s.flush()


def _limpar(ln: LinhaClienteModel) -> None:
    for c in ("area_id", "area_sit", "area_motivo", "area_opcoes", "id_crono", "crono_sit", "crono_motivo", "item_pq", "item_sit",
              "item_motivo", "item_opcoes", "tipo_id", "grupo_id", "wbs_no_id", "wbs_sit", "wbs_motivo", "equipe_id", "equipe_sit",
              "equipe_motivo", "equipe_opcoes"):
        setattr(ln, c, None)
    ln.lembrada = ln.ignorar = False


def _ligar(s: Session, obra_id: int, ref: gw.Referencias, ln: LinhaClienteModel, decs: dict[str, DecisaoClienteModel]) -> None:
    d = ln.dados
    _limpar(ln)
    dec = decs.get(ln.chave)
    so_item = decs.get(vc.chave_item(d["descricao"], d.get("unidade")))
    quando = lambda x: f"conferida em {x.em:%d/%m} por {x.por}"  # noqa: E731
    if dec is not None:
        ln.lembrada = True
        ln.ignorar = dec.ignorar
        if dec.area_id in ref.area_por_id:
            ln.area_id, ln.area_sit, ln.area_motivo = dec.area_id, vc.OK, f"decisão lembrada ({quando(dec)})"
        if dec.item_pq and dec.item_pq in ref.pq:
            ln.item_pq, ln.item_sit, ln.item_motivo = dec.item_pq, vc.OK, f"decisão lembrada ({quando(dec)})"
            ln.grupo_id = dec.grupo_id
        if dec.equipe_id in ref.equipe_por_id:
            ln.equipe_id, ln.equipe_sit, ln.equipe_motivo = dec.equipe_id, vc.OK, f"decisão lembrada ({quando(dec)})"
        if dec.wbs_no_id:
            ln.wbs_no_id, ln.wbs_sit, ln.wbs_motivo = dec.wbs_no_id, vc.OK, f"decisão lembrada ({quando(dec)})"
    elif so_item is not None and so_item.item_pq in ref.pq:
        ln.item_pq, ln.item_sit, ln.grupo_id = so_item.item_pq, vc.OK, so_item.grupo_id
        ln.item_motivo = f"mesmo serviço conferido antes ({quando(so_item)})"
        ln.lembrada = True

    # frente
    if ln.area_id is None:
        aid, sit, motivo, opc = vc.casar_area(ref.areas, cwa=d.get("cwa"), grupo_cwa=d.get("grupo_cwa"), grupo_tag=d.get("grupo_tag"),
                                              local=d.get("local"), cwp_codigo=d.get("cwp_codigo"), grupo=d.get("grupo"))
        ln.area_id, ln.area_sit, ln.area_motivo, ln.area_opcoes = aid, sit, motivo[:300], opc or None

    # cronograma
    idc = d.get("id_crono")
    if idc and idc in ref.cronograma:
        ln.id_crono, ln.crono_sit, ln.crono_motivo = idc, vc.OK, ref.cronograma[idc][:300]
    elif idc:
        ln.crono_motivo = f"{idc} não está no cronograma vigente"

    # item da PQ → tipo
    if ln.item_pq is None:
        item = d.get("item_pq")
        info = ref.pq.get(item) if item else None
        if info is not None and info.folha:
            comp = vc.unidade_compativel(d.get("unidade"), info.unid)
            ln.item_pq = item
            ln.item_sit = vc.SUGERIDO if comp is False else vc.OK
            ln.item_motivo = (f"unidade da planilha ({d.get('unidade')}) diferente da PQ ({info.unid}): confirme" if comp is False
                              else "ITEM PQ da planilha")
        else:
            nota = f"{item} não está na PQ vigente; " if item else ""
            cod = d.get("codigo_simova")
            t = ref.tipo_por_codigo.get(".".join(cod.split(".")[:2])) if cod else None
            if t is not None and t.item_pq and t.item_pq in ref.pq:
                ln.item_pq, ln.item_sit, ln.item_motivo, ln.tipo_id = t.item_pq, vc.OK, f"{nota}código do Catálogo {cod}", t.id
            else:
                sug = vc.sugerir_itens(d["descricao"], d.get("unidade"), ref.pq_folhas)
                ln.item_opcoes = [x.como_dict() for x in sug] or None
                if sug:
                    ln.item_pq, ln.item_sit = sug[0].item, vc.SUGERIDO
                    ln.item_motivo = (f"{nota}parecida com a descrição ({round(sug[0].parecenca * 100)}% · "
                                      f"{', '.join(sug[0].comuns[:5])}): confirme")[:300]
                else:
                    ln.item_motivo = f"{nota}escolha o item da PQ"[:300]
    if ln.item_pq and ln.item_pq in ref.tipo_por_item:
        ln.tipo_id = ref.tipo_por_item[ln.item_pq].id

    # IWP da WBS (frente + item)
    if ln.wbs_no_id is None and ln.area_id and ln.item_pq:
        lista = gw.iwps(s, obra_id, ref, ln.area_id, ln.item_pq)
        cwp = pl.norm(d.get("cwp"))
        mesmo_cwp = [x for x in lista if cwp and x.get("cwp") and (cwp in pl.norm(x["cwp"]) or pl.norm(x["cwp"]) in cwp)]
        base_ok = ln.area_sit == vc.OK and ln.item_sit == vc.OK
        if len(mesmo_cwp) == 1:
            ln.wbs_no_id, ln.wbs_sit, ln.wbs_motivo = mesmo_cwp[0]["wbs_no_id"], vc.OK if base_ok else vc.SUGERIDO, \
                f"IWP {mesmo_cwp[0]['codigo']} no CWP {mesmo_cwp[0]['cwp']}"
        elif len(lista) == 1:
            ln.wbs_no_id, ln.wbs_sit, ln.wbs_motivo = lista[0]["wbs_no_id"], vc.OK if base_ok else vc.SUGERIDO, \
                f"único IWP do item na frente ({lista[0]['codigo']})"
        elif lista:
            ln.wbs_no_id, ln.wbs_sit = (mesmo_cwp or lista)[0]["wbs_no_id"], vc.SUGERIDO
            ln.wbs_motivo = f"{len(lista)} IWPs do item na frente: confirme"
        else:
            ln.wbs_motivo = "sem IWP na WBS: vai pela frente + item da PQ"

    # equipe
    if ln.equipe_id is None:
        eid, sit, motivo, opc = vc.casar_equipe(ref.equipes, tuple(d.get("encarregados") or ()))
        ln.equipe_id, ln.equipe_sit, ln.equipe_motivo, ln.equipe_opcoes = eid, sit, motivo[:300], opc or None


def situacao(ln: LinhaClienteModel) -> str:
    if ln.levada_linha_id:
        return "levada"
    if ln.ignorar:
        return "ignorada"
    tipo = ln.wbs_no_id or ln.tipo_id or (ln.item_pq and ln.grupo_id)
    if not ln.area_id or not tipo:
        return "sem_vinculo"
    if any(getattr(ln, f"{c}_sit") == vc.SUGERIDO and getattr(ln, {"area": "area_id", "item": "item_pq", "wbs": "wbs_no_id",
                                                                    "equipe": "equipe_id"}[c]) for c in CAMPOS):
        return "a_confirmar"
    return "pronta"


def faltando(ln: LinhaClienteModel) -> list[str]:
    out = []
    if not ln.area_id:
        out.append("frente")
    if not (ln.wbs_no_id or ln.tipo_id):
        out.append("item da PQ" if not ln.item_pq else "grupo do Catálogo (item fora do Catálogo)")
    return out


# ---- visão ---------------------------------------------------------------------------------------------------------
def _memoria_capacidade(ln: LinhaClienteModel, par, d: dict) -> Memoria | None:
    of = (d.get("recursos") or {}).get("oficiais")
    if par is None or not of:
        return None
    ind = par.indice_un_dia(JORNADA)
    if not ind:
        return None
    cap = of * ind
    pico = max((d.get("previsto") or {}).values(), default=0)
    return Memoria(
        chave=f"capacidade-{ln.id}", titulo="A equipe da planilha dá conta do dia mais carregado?", valor=f"{num(cap)} {d.get('unidade') or ''}/dia",
        formula="capacidade = oficiais da planilha × índice orçado da CPU (un/dia por oficial do recurso que governa)",
        passos=(Passo("Oficiais (planilha)", num(of), num(of)),
                Passo("Índice orçado", f"{num(JORNADA)} h ÷ {num(par.coef_governa, 4)} h/un ({par.recurso_governa})", num(ind, 3)),
                Passo("Capacidade por dia", f"{num(of)} × {num(ind, 3)}", num(cap), True),
                Passo("Maior previsto num dia", "planilha", num(pico)),
                Passo("Folga", f"{num(cap)} − {num(pico)}", num(cap - pico), True)),
        fontes=(Fonte("Oficiais e previsto", num(of), "Planilha do cliente", f"linha {ln.linha}"),
                Fonte("Composição", par.composicao or "—", "CPU vigente", par.item_pq)),
        notas=(("Acima da capacidade calculada" if pico > cap else "Dentro da capacidade calculada"),))


def visao(s: Session, obra_id: int, imp: ImportacaoClienteModel) -> dict:
    ref = gw.carregar(s, obra_id)
    from app.modules.wbs.infra.gateway import codigos, nos

    todos = nos(s, obra_id)
    cods = codigos(s, obra_id, todos)
    itens = {ln.item_pq for ln in imp.linhas if ln.item_pq}
    cpu = gw.cpu(s, obra_id, ref, itens) if itens else {}

    def area(i):
        a = ref.area_por_id.get(i)
        return {"id": a.id, "rotulo": f"{a.codigo} · {a.descricao}"} if a else None

    def equipe(i):
        e = ref.equipe_por_id.get(i)
        return {"id": e.id, "rotulo": f"{e.nome}" + (f" — {e.encarregado.split('::')[-1].strip()}" if e.encarregado else "")} if e else None

    linhas, placar = [], {"pronta": 0, "a_confirmar": 0, "sem_vinculo": 0, "ignorada": 0, "levada": 0}
    for ln in imp.linhas:
        d = ln.dados
        sit = situacao(ln)
        placar[sit] += 1
        info = ref.pq.get(ln.item_pq) if ln.item_pq else None
        t = next((x for x in ref.tipo_por_item.values() if x.id == ln.tipo_id), None) if ln.tipo_id else None
        par = cpu.get(ln.item_pq) if ln.item_pq else None
        mem = _memoria_capacidade(ln, par, d)
        g = ref.grupos.get(ln.grupo_id) if ln.grupo_id else None
        no = todos.get(ln.wbs_no_id) if ln.wbs_no_id else None
        linhas.append({
            "id": ln.id, "linha": ln.linha, "ordem": ln.ordem, "situacao": sit, "faltando": faltando(ln), "lembrada": ln.lembrada,
            "conferida": ln.conferida, "levada_linha_id": ln.levada_linha_id, "planilha": d,
            "area": {"valor": area(ln.area_id), "sit": ln.area_sit, "motivo": ln.area_motivo,
                     "opcoes": [x for x in (area(i) for i in (ln.area_opcoes or [])) if x]},
            "crono": {"valor": ln.id_crono, "sit": ln.crono_sit, "motivo": ln.crono_motivo},
            "item": {"valor": {"item": info.item, "descricao": info.descricao, "unidade": info.unid} if info else None,
                     "sit": ln.item_sit, "motivo": ln.item_motivo, "opcoes": ln.item_opcoes or []},
            "tipo": {"id": t.id, "rotulo": t.descricao} if t else None,
            "grupo": {"id": g.id, "rotulo": f"{g.numero} · {g.descricao}"} if g else None,
            "wbs": {"valor": {"id": no.id, "codigo": cods[no.id].codigo if no.id in cods else str(no.id)} if no is not None else None,
                    "sit": ln.wbs_sit, "motivo": ln.wbs_motivo},
            "equipe": {"valor": equipe(ln.equipe_id), "sit": ln.equipe_sit, "motivo": ln.equipe_motivo,
                       "opcoes": [x for x in (equipe(i) for i in (ln.equipe_opcoes or [])) if x]},
            "cpu": {"hh_por_unidade": par.hh_por_unidade, "indice": par.indice_un_dia(JORNADA), "governa": par.recurso_governa,
                    "composicao": par.composicao} if par else None,
            "capacidade": mem.como_dict() if mem else None,
        })
    total = len(imp.linhas)
    m_placar = Memoria(chave="placar", titulo="Linhas da planilha", valor=str(total), formula="total = prontas + a confirmar + sem vínculo + ignoradas + levadas",
                       passos=tuple(Passo(k.replace("_", " "), str(v), str(v)) for k, v in placar.items()),
                       fontes=(Fonte("Atividades (linhas P)", str(total), imp.nome_arquivo, f"aba {imp.aba}"),))
    return {"id": imp.id, "nome_arquivo": imp.nome_arquivo, "aba": imp.aba, "abas": imp.abas, "titulo": imp.titulo,
            "inicio": imp.inicio.isoformat(), "fim": imp.fim.isoformat(), "situacao": imp.situacao, "avisos": imp.avisos,
            "programacao_id": imp.programacao_id, "criado_por": imp.criado_por, "criado_em": imp.criado_em.isoformat() if imp.criado_em else None,
            "placar": placar, "memoria_placar": m_placar.como_dict(), "linhas": linhas}


def resumo(imp: ImportacaoClienteModel) -> dict:
    placar: dict[str, int] = {}
    for ln in imp.linhas:
        k = situacao(ln)
        placar[k] = placar.get(k, 0) + 1
    return {"id": imp.id, "nome_arquivo": imp.nome_arquivo, "aba": imp.aba, "inicio": imp.inicio.isoformat(), "fim": imp.fim.isoformat(),
            "situacao": imp.situacao, "linhas": len(imp.linhas), "placar": placar, "programacao_id": imp.programacao_id,
            "criado_por": imp.criado_por, "criado_em": imp.criado_em.isoformat() if imp.criado_em else None}


# ---- decisões de quem confere --------------------------------------------------------------------------------------
def _lembrar(s: Session, obra_id: int, ln: LinhaClienteModel, por: str) -> None:
    def gravar(chave: str, **campos):
        dec = s.scalar(select(DecisaoClienteModel).where(DecisaoClienteModel.obra_id == obra_id, DecisaoClienteModel.chave == chave))
        if dec is None:
            dec = DecisaoClienteModel(obra_id=obra_id, chave=chave, por=por[:80])
            s.add(dec)
        for k, v in campos.items():
            setattr(dec, k, v)
        dec.por = por[:80]

    gravar(ln.chave, area_id=ln.area_id if ln.area_sit == vc.OK else None, item_pq=ln.item_pq if ln.item_sit == vc.OK else None,
           grupo_id=ln.grupo_id, wbs_no_id=ln.wbs_no_id if ln.wbs_sit == vc.OK else None,
           equipe_id=ln.equipe_id if ln.equipe_sit == vc.OK else None, ignorar=ln.ignorar)
    if ln.item_pq and ln.item_sit == vc.OK:
        d = ln.dados
        gravar(vc.chave_item(d["descricao"], d.get("unidade")), item_pq=ln.item_pq, grupo_id=ln.grupo_id)
    s.flush()


def editar(s: Session, obra_id: int, imp: ImportacaoClienteModel, lid: int, mudancas: dict, por: str) -> dict:
    """Quem confere escolhe: frente, item da PQ, grupo (item fora do Catálogo), IWP, equipe, ID do cronograma ou ignorar."""
    _aberta(imp)
    ln = _linha(imp, lid)
    if ln.levada_linha_id:
        raise DomainError("linha já levada à programação: mude lá", "linha")
    ref = gw.carregar(s, obra_id)
    refazer_wbs = False
    if "area_id" in mudancas:
        a = mudancas["area_id"]
        if a is not None and a not in ref.area_por_id:
            raise NotFoundError("Frente", a)
        ln.area_id, ln.area_sit, ln.area_motivo = a, (vc.OK if a else None), "escolhida na conferência"
        refazer_wbs = True
    if "item_pq" in mudancas:
        it = (mudancas["item_pq"] or "").strip() or None
        if it is not None:
            info = ref.pq.get(it)
            if info is None or not info.folha:
                raise DomainError(f"{it} não é um item (com unidade) da PQ vigente", "item_pq")
        ln.item_pq, ln.item_sit, ln.item_motivo = it, (vc.OK if it else None), "escolhido na conferência"
        t = ref.tipo_por_item.get(it) if it else None
        ln.tipo_id = t.id if t else None
        refazer_wbs = True
    if "grupo_id" in mudancas:
        g = mudancas["grupo_id"]
        if g is not None and g not in ref.grupos:
            raise NotFoundError("Grupo", g)
        ln.grupo_id = g
    if "equipe_id" in mudancas:
        e = mudancas["equipe_id"]
        if e is not None and e not in ref.equipe_por_id:
            raise NotFoundError("Equipe", e)
        ln.equipe_id, ln.equipe_sit, ln.equipe_motivo = e, (vc.OK if e else None), "escolhida na conferência"
    if "id_crono" in mudancas:
        c = (mudancas["id_crono"] or "").strip() or None
        if c is not None and c not in ref.cronograma:
            raise DomainError(f"{c} não está no cronograma vigente", "id_crono")
        ln.id_crono, ln.crono_sit, ln.crono_motivo = c, (vc.OK if c else None), ref.cronograma.get(c, "")[:300] if c else None
    if "wbs_no_id" in mudancas:
        w = mudancas["wbs_no_id"]
        if w is not None:
            from app.modules.wbs.infra.gateway import iwp_para_linha

            iwp = iwp_para_linha(s, obra_id, w)  # confere que é IWP da obra
            ln.area_id, ln.area_sit = iwp.area_id, vc.OK
            from app.modules.catalogo.infra.models import TipoAtividadeModel

            t = s.get(TipoAtividadeModel, iwp.tipo_id)
            ln.tipo_id = iwp.tipo_id
            if t is not None and t.item_pq:
                ln.item_pq, ln.item_sit = t.item_pq, vc.OK
        ln.wbs_no_id, ln.wbs_sit, ln.wbs_motivo = w, (vc.OK if w else None), "escolhido na conferência" if w else "sem IWP: vai pela frente + item"
        refazer_wbs = False
    if "ignorar" in mudancas:
        ln.ignorar = bool(mudancas["ignorar"])
    if refazer_wbs:
        ln.wbs_no_id = ln.wbs_sit = ln.wbs_motivo = None
        if ln.area_id and ln.item_pq:
            lista = gw.iwps(s, obra_id, ref, ln.area_id, ln.item_pq)
            if len(lista) == 1:
                ln.wbs_no_id, ln.wbs_sit, ln.wbs_motivo = lista[0]["wbs_no_id"], vc.OK, f"único IWP do item na frente ({lista[0]['codigo']})"
            elif lista:
                ln.wbs_no_id, ln.wbs_sit, ln.wbs_motivo = lista[0]["wbs_no_id"], vc.SUGERIDO, f"{len(lista)} IWPs do item na frente: confirme"
    ln.conferida = True
    _lembrar(s, obra_id, ln, por)
    iguais = 0
    if mudancas.get("aplicar_iguais", True):
        iguais = _aplicar_iguais(s, obra_id, imp, ln)
    return {"situacao": situacao(ln), "iguais": iguais}


def _aplicar_iguais(s: Session, obra_id: int, imp: ImportacaoClienteModel, ln: LinhaClienteModel) -> int:
    """As outras linhas com a mesma chave (mesma atividade, frente e unidade) e ainda não conferidas recebem a decisão."""
    outras = {x.id for x in imp.linhas if x.id != ln.id and x.chave == ln.chave and not x.conferida and not x.levada_linha_id}
    if outras:
        vincular(s, obra_id, imp, outras)
    return len(outras)


def confirmar(s: Session, obra_id: int, imp: ImportacaoClienteModel, ids: list[int] | None, campos: list[str] | None, por: str) -> int:
    """Aceita as sugestões (em lote): sugerido → confirmado, e lembra a decisão."""
    _aberta(imp)
    campos = [c for c in (campos or CAMPOS) if c in CAMPOS]
    n = 0
    for ln in imp.linhas:
        if (ids is not None and ln.id not in ids) or ln.levada_linha_id or ln.ignorar:
            continue
        mudou = False
        for c in campos:
            valor = getattr(ln, {"area": "area_id", "item": "item_pq", "wbs": "wbs_no_id", "equipe": "equipe_id"}[c])
            if valor and getattr(ln, f"{c}_sit") == vc.SUGERIDO:
                setattr(ln, f"{c}_sit", vc.OK)
                mudou = True
        if mudou:
            ln.conferida = True
            _lembrar(s, obra_id, ln, por)
            n += 1
    s.flush()
    return n


def grupo_em_lote(s: Session, obra_id: int, imp: ImportacaoClienteModel, grupo_id: int, ids: list[int] | None, por: str) -> int:
    """Itens da PQ que ainda não estão no Catálogo: o grupo onde o tipo será criado ao levar (as linhas escolhidas)."""
    _aberta(imp)
    ref = gw.carregar(s, obra_id)
    if grupo_id not in ref.grupos:
        raise NotFoundError("Grupo", grupo_id)
    n = 0
    for ln in imp.linhas:
        if (ids is not None and ln.id not in ids) or ln.levada_linha_id or ln.tipo_id or ln.wbs_no_id or not ln.item_pq:
            continue
        ln.grupo_id = grupo_id
        ln.conferida = True
        _lembrar(s, obra_id, ln, por)
        n += 1
    s.flush()
    return n


def _aberta(imp: ImportacaoClienteModel) -> None:
    if imp.situacao == "arquivada":
        raise DomainError("importação arquivada", "importacao")


def periodo_texto(inicio: date, fim: date) -> str:
    return f"{inicio:%d/%m} a {fim:%d/%m/%Y}"


# o arquivo da planilha fica no acervo enquanto a importação existir (spec 082: quem usa arquivo se registra)
def _em_uso():
    return select(ImportacaoClienteModel.arquivo_id).where(ImportacaoClienteModel.arquivo_id.is_not(None))


from app.modules.arquivos.application.registro import Usuario, registrar  # noqa: E402

registrar(Usuario("programação do cliente", ("programacao",), lambda s, limite: 0, _em_uso))
