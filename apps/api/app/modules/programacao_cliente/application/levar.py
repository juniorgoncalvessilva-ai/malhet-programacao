"""Levar a planilha conferida à programação (spec 146).

Quem leva escolhe o destino a cada vez: somar à programação da semana que já existe (a emitida é reaberta e as linhas saem
na próxima revisão) ou criar uma programação nova para o período da planilha. Vão só as linhas prontas (vínculos
confirmados), com o previsto de cada dia, a equipe, o responsável, o SSMA que está no cadastro e o realizado (linhas R):
o realizado da planilha só entra no dia em que o campo ainda não lançou nada — nunca soma em dobro — e o que passaria do
total do projeto fica de fora, com aviso. Cada linha levada guarda a origem (arquivo, aba e linha da planilha)."""
from collections.abc import Callable
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.planejamento.application import servico as sv
from app.modules.planejamento.domain.periodo import TipoProgramacao, periodo, titulo
from app.modules.planejamento.infra.models import LinhaProgramacaoModel, ProgramacaoModel
from app.modules.programacao_cliente.application import conferencia as cf
from app.modules.programacao_cliente.infra.models import ImportacaoClienteModel
from app.shared.errors import DomainError, NotFoundError

TOL = 1e-6


def destinos(s: Session, obra_id: int, imp: ImportacaoClienteModel) -> dict:
    """As programações semanais que cruzam o período da planilha (a que começa no mesmo dia vem primeiro) e a nova."""
    ini, fim = periodo(TipoProgramacao.SEMANAL, imp.inicio)
    lista = list(s.scalars(select(ProgramacaoModel).where(ProgramacaoModel.obra_id == obra_id, ProgramacaoModel.inicio <= imp.fim,
                                                          ProgramacaoModel.fim >= imp.inicio).order_by(ProgramacaoModel.inicio)))
    lista.sort(key=lambda p: (p.inicio != imp.inicio, p.tipo != "SEMANAL", p.inicio))
    ja_tem_nova = any(p.tipo == "SEMANAL" and p.inicio == ini for p in lista)
    return {"existentes": [{"id": p.id, "titulo": p.titulo, "tipo": p.tipo, "status": p.status, "revisao": p.revisao,
                            "inicio": p.inicio.isoformat(), "fim": p.fim.isoformat(), "linhas": len(p.linhas)} for p in lista],
            "nova": None if ja_tem_nova else {"inicio": ini.isoformat(), "fim": fim.isoformat(),
                                               "titulo": titulo(TipoProgramacao.SEMANAL, ini, fim)}}


def _chaves(ln) -> set[tuple]:
    out = set()
    if ln.wbs_no_id:
        out.add(("wbs", ln.wbs_no_id))
    if ln.area_id and ln.item_pq:
        out.add(("item", ln.area_id, ln.item_pq))
    return out


def _total(d: dict, p: ProgramacaoModel, campo: str) -> float:
    return round(sum(q for k, q in (d.get(campo) or {}).items() if p.inicio <= date.fromisoformat(k) <= p.fim), 6)


def comparar(s: Session, obra_id: int, imp: ImportacaoClienteModel, p: ProgramacaoModel) -> dict:
    """Antes de levar: o que é novo, o que já está na programação (mesmo IWP, ou frente + item, e mesma equipe), o que tem
    quantidade diferente e o que está só no Malhet."""
    existentes = {}
    for x in p.linhas:
        for k in _chaves(x):
            existentes.setdefault(k, []).append(x)
    usadas: set[int] = set()
    linhas = []
    for ln in imp.linhas:
        sit = cf.situacao(ln)
        if sit in ("ignorada", "levada"):
            continue
        d = ln.dados
        prev_planilha = _total(d, p, "previsto")
        cand = [x for k in _chaves(ln) for x in existentes.get(k, []) if x.id not in usadas]  # cada linha do Malhet casa uma vez

        def prev_de(x) -> float:
            return round(sum(v.previsto or 0 for v in x.valores), 6)
        mesma = (next((x for x in cand if x.equipe_id == ln.equipe_id and abs(prev_de(x) - prev_planilha) <= TOL), None)
                 or next((x for x in cand if x.equipe_id == ln.equipe_id), None) or (cand[0] if cand else None))
        fora = round(d.get("total_previsto", 0) - prev_planilha, 6)
        if mesma is not None:
            usadas.add(mesma.id)
            prev_malhet = round(sum(v.previsto or 0 for v in mesma.valores), 6)
            comp = "ja_existe" if abs(prev_malhet - prev_planilha) <= TOL else "quantidade_diferente"
        else:
            prev_malhet, comp = None, "nova"
        linhas.append({"id": ln.id, "linha": ln.linha, "descricao": d["descricao"], "situacao": sit, "comparacao": comp,
                       "linha_malhet": mesma.id if mesma else None, "previsto_planilha": prev_planilha, "previsto_malhet": prev_malhet,
                       "fora_do_periodo": fora if fora > TOL else 0, "realizado_planilha": _total(d, p, "realizado"),
                       "origem": f"{imp.aba} · linha {ln.linha}"})
    so_malhet = [{"id": x.id, "item_pq": x.item_pq, "area_id": x.area_id, "previsto": round(sum(v.previsto or 0 for v in x.valores), 6)}
                 for x in p.linhas if x.id not in usadas]
    cont: dict[str, int] = {}
    for x in linhas:
        cont[x["comparacao"]] = cont.get(x["comparacao"], 0) + 1
    return {"programacao": {"id": p.id, "titulo": p.titulo, "status": p.status, "revisao": p.revisao,
                            "inicio": p.inicio.isoformat(), "fim": p.fim.isoformat()},
            "contagem": cont, "so_no_malhet": len(so_malhet), "linhas": linhas, "so_malhet": so_malhet[:200]}


def _ssma(s: Session, obra_id: int, nova: LinhaProgramacaoModel, ss: dict) -> list[str]:
    """SSMA da planilha: entra o que está no cadastro da obra (ou N/A); o resto vira aviso — não se cadastra pela planilha."""
    from app.modules.ssma.domain.cadastro import NAO_SE_APLICA
    from app.modules.ssma.infra.gateway import CadastroSsmaGateway

    g = CadastroSsmaGateway(s, obra_id)
    fora = []
    tec = ss.get("tecnico")
    if tec:
        try:
            nova.ssma_tecnico = g.conferir("tecnico", tec)
        except DomainError:
            fora.append(f"técnico {tec}")
    for k in ("rac", "pts", "art", "ata", "pto"):
        ok = []
        for item in ss.get(k) or []:
            try:
                v = g.conferir_lista(k, [item])
                ok += [x for x in (v or []) if x not in ok]
            except DomainError:
                fora.append(item)
        if len(ok) > 1 and NAO_SE_APLICA in ok:
            ok.remove(NAO_SE_APLICA)
        setattr(nova, f"ssma_{k}", ok or None)
    return fora


def levar(s: Session, obra_id: int, imp: ImportacaoClienteModel, *, destino: str, programacao_id: int | None, ids: list[int] | None,
          trazer_realizado: bool, atualizar_existentes: bool, reabrir: bool, por: str,
          criar_linha: Callable[[ProgramacaoModel, dict], int], criar_tipo: Callable[[int, str], int]) -> dict:
    """criar_linha(programação, campos) → id da linha (a regra da programação: IWP, área, tipo, equipe, item Simova);
    criar_tipo(grupo_id, item_pq) → tipo novo no Catálogo para item fora dele."""
    if destino == "nova":
        ini, fim = periodo(TipoProgramacao.SEMANAL, imp.inicio)
        if s.scalar(select(ProgramacaoModel).where(ProgramacaoModel.obra_id == obra_id, ProgramacaoModel.tipo == "SEMANAL",
                                                   ProgramacaoModel.inicio == ini)):
            raise DomainError(f"já existe a programação semanal que começa em {ini:%d/%m/%Y}: escolha levar a ela", "destino")
        p = ProgramacaoModel(obra_id=obra_id, tipo="SEMANAL", inicio=ini, fim=fim, titulo=titulo(TipoProgramacao.SEMANAL, ini, fim),
                             status="rascunho", revisao=0, criado_por=por[:80])
        s.add(p)
        s.flush()
    elif destino == "existente":
        p = s.get(ProgramacaoModel, programacao_id or 0)
        if p is None or p.obra_id != obra_id:
            raise NotFoundError("Programação", programacao_id or 0)
        sv.exigir_aberta(p)
        if p.status == "emitida":
            if not reabrir:
                raise DomainError(f"{p.titulo} está emitida: confirme reabrir — a revisão emitida não muda e as linhas saem na próxima",
                                  "reabrir")
            sv.reabrir(p)
    else:
        raise DomainError("destino: existente ou nova", "destino")

    comp = {x["id"]: x for x in comparar(s, obra_id, imp, p)["linhas"]}
    escolhidas = [ln for ln in imp.linhas if (ids is None or ln.id in set(ids))]
    criadas = atualizadas = ja = 0
    pulo: list[dict] = []
    avisos: list[str] = []
    realizado_dias = realizado_mantido = 0
    tocadas: list[int] = []
    criados: dict[str, int] = {}  # item da PQ → tipo criado agora (o mesmo item em várias linhas)
    for ln in escolhidas:
        sit = cf.situacao(ln)
        if sit != "pronta":
            if sit not in ("levada", "ignorada"):
                pulo.append({"id": ln.id, "linha": ln.linha, "motivo": "confirme os vínculos" if sit == "a_confirmar" else
                             f"falta {', '.join(cf.faltando(ln))}"})
            continue
        d = ln.dados
        c = comp.get(ln.id, {})
        alvo_id = None
        if c.get("comparacao") in ("ja_existe", "quantidade_diferente"):
            if not atualizar_existentes:
                ja += 1
                continue
            alvo_id = c["linha_malhet"]
            atualizadas += 1
        else:
            tipo_id = ln.tipo_id or criados.get(ln.item_pq)
            if not ln.wbs_no_id and not tipo_id:
                tipo_id = criar_tipo(ln.grupo_id, ln.item_pq)
                criados[ln.item_pq] = tipo_id
            ln.tipo_id = tipo_id or ln.tipo_id
            origem = f"Planilha do cliente {imp.nome_arquivo} · {imp.aba} · linha {ln.linha}: {d['descricao']}"
            alvo_id = criar_linha(p, {
                "wbs_no_id": ln.wbs_no_id, "area_id": ln.area_id, "tipo_id": tipo_id, "item_pq": ln.item_pq, "id_crono": ln.id_crono,
                "equipe_id": ln.equipe_id, "natureza": d.get("natureza") or "P", "responsavel": d.get("responsavel"),
                "qtd_projeto": None if ln.wbs_no_id else d.get("qtd_projeto"), "qtd_periodo": _total(d, p, "previsto") or None,
                "complemento": None if ln.wbs_no_id else d.get("cwp"), "observacao": origem[:300]})
            criadas += 1
        nova = next(x for x in p.linhas if x.id == alvo_id)
        fora = _ssma(s, obra_id, nova, d.get("ssma") or {})
        if fora:
            avisos.append(f"linha {ln.linha}: SSMA fora do cadastro não entrou ({', '.join(fora[:4])})")
        prev = [{"data": k, "valor": q} for k, q in (d.get("previsto") or {}).items() if p.inicio <= date.fromisoformat(k) <= p.fim]
        if alvo_id and atualizar_existentes and c.get("comparacao") in ("ja_existe", "quantidade_diferente"):
            # previsto da planilha substitui o da linha nos dias do período
            for v in nova.valores:
                v.previsto = None
        if prev:
            sv.salvar_valores(s, p, alvo_id, prev, "previsto")
        if trazer_realizado:
            atuais = {v.data: v for v in nova.valores}
            real = []
            for k, q in (d.get("realizado") or {}).items():
                dia = date.fromisoformat(k)
                if not (p.inicio <= dia <= p.fim) or not q:
                    continue
                v = atuais.get(dia)
                if v is not None and v.realizado is not None:
                    realizado_mantido += 1  # o campo já lançou: vale o do campo
                    continue
                real.append({"data": k, "valor": q})
            if real:
                antes = {v.data: v.realizado for v in nova.valores}
                sv.salvar_valores(s, p, alvo_id, real, "realizado")
                try:
                    sv.conferir_realizado(s, p, [alvo_id], aceitar_excesso=False)
                    realizado_dias += len(real)
                except DomainError as e:  # passaria do total do projeto: o realizado da planilha não entra
                    for v in nova.valores:
                        if v.data in {date.fromisoformat(x["data"]) for x in real}:
                            v.realizado = antes.get(v.data)
                    avisos.append(f"linha {ln.linha}: realizado não entrou — {e.mensagem}")
        ln.levada_linha_id = alvo_id
        tocadas.append(alvo_id)
    if criadas or atualizadas:
        imp.situacao, imp.programacao_id = "levada", p.id
        imp.levada_em, imp.levada_por = datetime.now(timezone.utc), por[:80]
    s.flush()
    return {"programacao": {"id": p.id, "titulo": p.titulo, "status": p.status}, "criadas": criadas, "atualizadas": atualizadas,
            "ja_estavam": ja, "puladas": pulo, "realizado_dias": realizado_dias, "realizado_mantido_do_campo": realizado_mantido,
            "avisos": avisos[:50]}
