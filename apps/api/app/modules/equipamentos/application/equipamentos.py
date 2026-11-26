"""Casos de uso dos equipamentos (spec 147): importar a planilha da obra (prévia antes de gravar), cadastro, operador do
efetivo, mobilização/desmobilização com histórico e o apontamento do dia."""
from datetime import date
from io import BytesIO

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.efetivo.infra.gateway import pessoa as pessoa_do_efetivo
from app.modules.efetivo.infra.gateway import pessoas_da_obra
from app.modules.equipamentos.domain import equipamento as dom
from app.modules.equipamentos.infra.models import EquipamentoApontamentoModel, EquipamentoModel, EquipamentoMovimentoModel
from app.shared.errors import DomainError, NotFoundError
from app.shared.memoria import Fonte, Memoria, num
from app.shared.tempo import hoje_local


def _linhas(conteudo: bytes) -> list[tuple]:
    from openpyxl import load_workbook

    try:
        wb = load_workbook(BytesIO(conteudo), data_only=True, read_only=True)
    except Exception as e:  # noqa: BLE001
        raise DomainError("envie a planilha de equipamentos em Excel (.xlsx)", "arquivo") from e
    melhor: list[tuple] = []
    for ws in wb.worksheets:  # a aba que tem o cabeçalho
        linhas = [tuple(r) for r in ws.iter_rows(values_only=True)]
        if dom.ler(linhas).itens:
            return linhas
        melhor = melhor or linhas
    return melhor


def _pessoas(s: Session, obra_id: int) -> list[dom.PessoaRef]:
    return [dom.PessoaRef(p.id, p.nome, p.funcao, p.matricula) for p in pessoas_da_obra(s, obra_id)]


def _ref(p: dom.PessoaRef) -> dict:
    return {"id": p.id, "nome": p.nome, "funcao": p.funcao, "matricula": p.matricula}


def _existentes(s: Session, obra_id: int) -> dict[str, EquipamentoModel]:
    return {e.chave: e for e in s.scalars(select(EquipamentoModel).where(EquipamentoModel.obra_id == obra_id))}


def previa(s: Session, obra_id: int, conteudo: bytes) -> dict:
    """O que a planilha traria, sem gravar: novos, atualizados, mudanças de situação e operadores ligados/pendentes."""
    lt = dom.ler(_linhas(conteudo))
    if not lt.itens:
        raise DomainError(lt.avisos[0] if lt.avisos else "nenhum equipamento na planilha", "arquivo")
    ja, pessoas = _existentes(s, obra_id), _pessoas(s, obra_id)
    itens = []
    for x in lt.itens:
        e = ja.get(x.chave)
        oid, sugestoes = dom.casar_operador(x.operador, pessoas)
        itens.append({"linha": x.linha, "nome": x.nome, "tag": x.tag, "placa": x.placa, "tipo": x.tipo, "operador": x.operador,
                      "situacao": x.situacao, "mobilizado_em": x.mobilizado_em.isoformat() if x.mobilizado_em else None,
                      "acao": "novo" if e is None else ("situacao" if e.situacao != x.situacao else "atualiza"),
                      "operador_ligado": next((_ref(p) for p in sugestoes if p.id == oid), None) if oid else None,
                      "sugestoes": [_ref(p) for p in sugestoes] if not oid else []})
    return {"itens": itens, "avisos": lt.avisos, "novos": sum(i["acao"] == "novo" for i in itens),
            "atualizados": sum(i["acao"] != "novo" for i in itens), "mudam_situacao": sum(i["acao"] == "situacao" for i in itens),
            "operadores_ligados": sum(bool(i["operador_ligado"]) for i in itens),
            "operadores_pendentes": sum(bool(i["operador"]) and not i["operador_ligado"] for i in itens),
            "fora_da_planilha": sorted(e.tag or e.placa or e.chave for k, e in ja.items() if k not in {x.chave for x in lt.itens})}


def _mov(s: Session, e: EquipamentoModel, tipo: str, data: date, texto: str | None, por: str) -> None:
    s.add(EquipamentoMovimentoModel(obra_id=e.obra_id, equipamento_id=e.id, tipo=tipo, data=data, texto=(texto or "")[:300] or None,
                                    por=por[:150]))


def importar(s: Session, obra_id: int, conteudo: bytes, por: str) -> dict:
    """Grava a planilha: a TAG é a chave (reimportar atualiza, não duplica, não apaga). Operador só liga quando o casamento
    é único e o equipamento ainda não tem operador. Mudança de situação vira movimento "pela planilha"."""
    lt = dom.ler(_linhas(conteudo))
    if not lt.itens:
        raise DomainError(lt.avisos[0] if lt.avisos else "nenhum equipamento na planilha", "arquivo")
    ja, pessoas, hoje = _existentes(s, obra_id), _pessoas(s, obra_id), hoje_local()
    for e in ja.values():
        e.na_ultima_planilha = False
    novos = atualizados = ligados = 0
    for x in lt.itens:
        e = ja.get(x.chave)
        if e is None:
            e = EquipamentoModel(obra_id=obra_id, chave=x.chave, nome=x.nome, situacao=x.situacao,
                                 mobilizado_em=x.mobilizado_em, desmobilizado_em=x.desmobilizado_em)
            s.add(e)
            s.flush()
            _mov(s, e, "cadastro", hoje, f"pela planilha (linha {x.linha})", por)
            if x.situacao != "nao_mobilizado" and x.mobilizado_em:
                _mov(s, e, "mobilizacao", x.mobilizado_em, "pela planilha", por)
            if x.situacao == "desmobilizado":
                _mov(s, e, "desmobilizacao", x.desmobilizado_em or hoje, "pela planilha (Mobilizado = NÃO)", por)
            novos += 1
        else:
            if e.situacao != x.situacao:
                if x.situacao == "mobilizado":
                    e.mobilizado_em, e.desmobilizado_em = x.mobilizado_em or hoje, None
                    _mov(s, e, "mobilizacao", e.mobilizado_em, "pela planilha", por)
                elif x.situacao == "desmobilizado":
                    e.desmobilizado_em = x.desmobilizado_em or hoje
                    _mov(s, e, "desmobilizacao", e.desmobilizado_em, "pela planilha (Mobilizado = NÃO)", por)
                e.situacao = x.situacao
            elif x.mobilizado_em and not e.mobilizado_em:
                e.mobilizado_em = x.mobilizado_em
            atualizados += 1
        e.nome, e.tipo, e.placa, e.tag, e.chassi = x.nome, x.tipo, x.placa, x.tag, x.chassi
        e.operador_texto, e.na_ultima_planilha = x.operador, True
        if e.operador_id is None and x.operador:
            oid, _ = dom.casar_operador(x.operador, pessoas)
            if oid:
                e.operador_id = oid
                _mov(s, e, "operador", hoje, f"{x.operador} → ligado ao efetivo pela planilha", por)
                ligados += 1
    s.flush()
    return {"novos": novos, "atualizados": atualizados, "operadores_ligados": ligados, "avisos": lt.avisos}


def _obter(s: Session, obra_id: int, eid: int) -> EquipamentoModel:
    e = s.get(EquipamentoModel, eid)
    if e is None or e.obra_id != obra_id:
        raise NotFoundError("Equipamento", eid)
    return e


def memoria_dias(e: EquipamentoModel, hoje: date) -> dict | None:
    dias = dom.dias_mobilizado(e.mobilizado_em, hoje, e.desmobilizado_em if e.situacao == "desmobilizado" else None)
    if dias is None:
        return None
    fim = e.desmobilizado_em if e.situacao == "desmobilizado" and e.desmobilizado_em else hoje
    return Memoria("dias", "Dias na obra", f"{num(dias, 0)} dia(s)", "dias = fim − mobilização + 1",
                   fontes=(Fonte("Mobilização", e.mobilizado_em.strftime("%d/%m/%Y"), "cadastro do equipamento", "Data mobilização"),
                           Fonte("Fim", fim.strftime("%d/%m/%Y"), "desmobilização" if fim != hoje else "hoje"))).como_dict()


def como_dict(s: Session, e: EquipamentoModel, hoje: date, apont: EquipamentoApontamentoModel | None = None,
              pessoas: dict[int, object] | None = None) -> dict:
    op = (pessoas or {}).get(e.operador_id) if e.operador_id else None
    if e.operador_id and op is None:
        op = pessoa_do_efetivo(s, e.obra_id, e.operador_id)
    mem = memoria_dias(e, hoje)
    return {"id": e.id, "nome": e.nome, "tipo": e.tipo, "placa": e.placa, "tag": e.tag, "chassi": e.chassi,
            "operador": {"id": op.id, "nome": op.nome, "matricula": op.matricula, "funcao": op.funcao} if op else None,
            "operador_texto": e.operador_texto, "situacao": e.situacao, "situacao_nome": dom.SITUACOES.get(e.situacao, e.situacao),
            "mobilizado_em": e.mobilizado_em.isoformat() if e.mobilizado_em else None,
            "desmobilizado_em": e.desmobilizado_em.isoformat() if e.desmobilizado_em else None,
            "dias": dom.dias_mobilizado(e.mobilizado_em, hoje, e.desmobilizado_em if e.situacao == "desmobilizado" else None),
            "memoria": mem, "observacao": e.observacao, "na_ultima_planilha": e.na_ultima_planilha,
            "dia": {"situacao": apont.situacao, "situacao_nome": dom.DIA[apont.situacao], "horas": apont.horas,
                    "equipe_id": apont.equipe_id, "observacao": apont.observacao, "por": apont.por} if apont else None}


def listar(s: Session, obra_id: int, data: date | None = None, situacao: str | None = None) -> dict:
    hoje = hoje_local()
    dia = data or hoje
    q = select(EquipamentoModel).where(EquipamentoModel.obra_id == obra_id)
    if situacao:
        q = q.where(EquipamentoModel.situacao == situacao)
    eqs = list(s.scalars(q.order_by(EquipamentoModel.tipo, EquipamentoModel.nome, EquipamentoModel.tag)))
    aps = {a.equipamento_id: a for a in s.scalars(select(EquipamentoApontamentoModel).where(
        EquipamentoApontamentoModel.obra_id == obra_id, EquipamentoApontamentoModel.data == dia))}
    pessoas = {p.id: p for p in pessoas_da_obra(s, obra_id, so_ativas=False)}
    itens = [como_dict(s, e, hoje, aps.get(e.id), pessoas) for e in eqs]
    tot = {k: sum(i["situacao"] == k for i in itens) for k in dom.SITUACOES}
    mob = [i for i in itens if i["situacao"] == "mobilizado"]
    return {"data": dia.isoformat(), "itens": itens, "totais": {**tot, "total": len(itens),
            "apontados": sum(bool(i["dia"]) for i in mob), "sem_apontamento": sum(not i["dia"] for i in mob),
            "sem_operador": sum(not i["operador"] for i in mob)}}


def criar(s: Session, obra_id: int, d: dict, por: str) -> dict:
    k = dom.chave(d.get("tag"), d.get("placa"), d.get("chassi"))
    if not k:
        raise DomainError("informe a TAG, a placa ou o chassi", "tag")
    nome = " ".join((d.get("nome") or "").split())[:120]
    if len(nome) < 2:
        raise DomainError("dê o nome do equipamento", "nome")
    if s.scalar(select(EquipamentoModel.id).where(EquipamentoModel.obra_id == obra_id, EquipamentoModel.chave == k)):
        raise DomainError(f"já existe equipamento com a TAG/placa {d.get('tag') or d.get('placa')}", "tag")
    e = EquipamentoModel(obra_id=obra_id, chave=k, nome=nome, tipo=(d.get("tipo") or None), placa=d.get("placa") or None,
                         tag=d.get("tag") or None, chassi=d.get("chassi") or None, situacao="nao_mobilizado",
                         observacao=d.get("observacao") or None)
    s.add(e)
    s.flush()
    _mov(s, e, "cadastro", hoje_local(), "cadastrado à mão", por)
    if d.get("operador_id"):
        definir_operador(s, obra_id, e.id, d["operador_id"], por)
    s.flush()
    return como_dict(s, e, hoje_local())


def editar(s: Session, obra_id: int, eid: int, d: dict) -> dict:
    e = _obter(s, obra_id, eid)
    for campo in ("nome", "tipo", "placa", "tag", "chassi", "observacao"):
        if campo in d and d[campo] is not None:
            setattr(e, campo, " ".join(str(d[campo]).split()) or None)
    k = dom.chave(e.tag, e.placa, e.chassi)
    if not k or not e.nome:
        raise DomainError("o equipamento precisa de nome e TAG, placa ou chassi", "tag")
    if k != e.chave and s.scalar(select(EquipamentoModel.id).where(EquipamentoModel.obra_id == obra_id, EquipamentoModel.chave == k)):
        raise DomainError("já existe outro equipamento com essa TAG/placa", "tag")
    e.chave = k
    s.flush()
    return como_dict(s, e, hoje_local())


def excluir(s: Session, obra_id: int, eid: int) -> None:
    e = _obter(s, obra_id, eid)
    if s.scalar(select(EquipamentoApontamentoModel.id).where(EquipamentoApontamentoModel.equipamento_id == e.id).limit(1)):
        raise DomainError("o equipamento já tem dias apontados: desmobilize em vez de excluir", "equipamento")
    s.delete(e)
    s.flush()


def _ultima_data(s: Session, e: EquipamentoModel) -> date | None:
    return s.scalar(select(EquipamentoMovimentoModel.data).where(
        EquipamentoMovimentoModel.equipamento_id == e.id, EquipamentoMovimentoModel.tipo.in_(("mobilizacao", "desmobilizacao")))
        .order_by(EquipamentoMovimentoModel.data.desc()).limit(1))


def mobilizar(s: Session, obra_id: int, eid: int, data: date, texto: str | None, por: str) -> dict:
    e = _obter(s, obra_id, eid)
    dom.validar_movimento(e.situacao, "mobilizado", data, _ultima_data(s, e))
    e.situacao, e.mobilizado_em, e.desmobilizado_em = "mobilizado", data, None
    _mov(s, e, "mobilizacao", data, texto, por)
    s.flush()
    return como_dict(s, e, hoje_local())


def desmobilizar(s: Session, obra_id: int, eid: int, data: date, texto: str | None, por: str) -> dict:
    e = _obter(s, obra_id, eid)
    dom.validar_movimento(e.situacao, "desmobilizado", data, _ultima_data(s, e))
    e.situacao, e.desmobilizado_em = "desmobilizado", data
    _mov(s, e, "desmobilizacao", data, texto, por)
    s.flush()
    return como_dict(s, e, hoje_local())


def definir_operador(s: Session, obra_id: int, eid: int, colaborador_id: int | None, por: str) -> dict:
    e = _obter(s, obra_id, eid)
    novo = pessoa_do_efetivo(s, obra_id, colaborador_id) if colaborador_id else None
    if colaborador_id and novo is None:
        raise NotFoundError("pessoa do efetivo", colaborador_id)
    antes = pessoa_do_efetivo(s, obra_id, e.operador_id) if e.operador_id else None
    if (antes.id if antes else None) == (novo.id if novo else None):
        return como_dict(s, e, hoje_local())
    e.operador_id = novo.id if novo else None
    _mov(s, e, "operador", hoje_local(), f"{antes.nome if antes else e.operador_texto or 'sem operador'} → {novo.nome if novo else 'sem operador'}", por)
    s.flush()
    return como_dict(s, e, hoje_local())


def movimentos(s: Session, obra_id: int, eid: int) -> list[dict]:
    e = _obter(s, obra_id, eid)
    return [{"id": m.id, "tipo": m.tipo, "data": m.data.isoformat(), "texto": m.texto, "por": m.por,
             "criado_em": m.criado_em.isoformat() if m.criado_em else None}
            for m in s.scalars(select(EquipamentoMovimentoModel).where(EquipamentoMovimentoModel.equipamento_id == e.id)
                               .order_by(EquipamentoMovimentoModel.data.desc(), EquipamentoMovimentoModel.id.desc()))]


def apontar(s: Session, obra_id: int, eid: int, data: date, situacao: str, horas: float | None, equipe_id: int | None,
            observacao: str | None, por: str) -> dict:
    """O dia do equipamento (um por dia; apontar de novo corrige). Só equipamento mobilizado naquele dia."""
    from app.modules.equipes.infra.models import EquipeModel

    e = _obter(s, obra_id, eid)
    situacao, horas, obs = dom.validar_apontamento(situacao, horas, observacao)
    if e.situacao == "nao_mobilizado" or (e.mobilizado_em and data < e.mobilizado_em) or (
            e.situacao == "desmobilizado" and e.desmobilizado_em and data > e.desmobilizado_em):
        raise DomainError(f"{e.tag or e.nome} não estava mobilizado em {data.strftime('%d/%m/%Y')}", "data")
    if data > hoje_local():
        raise DomainError("não dá para apontar dia que ainda não chegou", "data")
    if equipe_id:
        eq = s.get(EquipeModel, equipe_id)
        if eq is None or eq.obra_id != obra_id:
            raise DomainError("equipe inválida", "equipe_id")
    a = s.scalar(select(EquipamentoApontamentoModel).where(EquipamentoApontamentoModel.obra_id == obra_id,
                                                         EquipamentoApontamentoModel.equipamento_id == e.id,
                                                         EquipamentoApontamentoModel.data == data))
    if a is None:
        a = EquipamentoApontamentoModel(obra_id=obra_id, equipamento_id=e.id, data=data)
        s.add(a)
    a.situacao, a.horas, a.equipe_id, a.observacao, a.por = situacao, horas, equipe_id, obs, por[:150]
    a.operador_id = e.operador_id
    s.flush()
    return como_dict(s, e, hoje_local(), a)


def por_operador(s: Session, obra_id: int) -> dict[int, list[dict]]:
    """Equipamentos de cada operador (o efetivo mostra ao lado da pessoa)."""
    out: dict[int, list[dict]] = {}
    for e in s.scalars(select(EquipamentoModel).where(EquipamentoModel.obra_id == obra_id, EquipamentoModel.operador_id.is_not(None))):
        out.setdefault(e.operador_id, []).append({"id": e.id, "nome": e.nome, "tag": e.tag or e.placa, "situacao": e.situacao})
    return out
