"""Gestão do acesso dos líderes (spec 111): o link da obra e quem pode entrar — encarregados e responsáveis/supervisores
das equipes (automático) e líderes cadastrados à mão (sem a função de encarregado), com as equipes que controlam."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.efetivo.infra.models import ColaboradorModel
from app.modules.equipes.infra.models import EquipeModel
from app.modules.lideres.application.portal import equipes_lideradas
from app.modules.lideres.domain.portal import funcao_de_apontador, normalizar_codigo
from app.modules.lideres.infra import sessao
from app.modules.lideres.infra.models import LiderAcessoModel, LiderPedidoEquipeModel, LiderPortalModel
from app.shared.errors import DomainError, NotFoundError


def garantir_portal(s: Session, obra_id: int) -> LiderPortalModel:
    p = s.get(LiderPortalModel, obra_id)
    if p is None:
        p = LiderPortalModel(obra_id=obra_id, codigo=sessao.novo_codigo(), ativo=True)
        s.add(p)
        s.flush()
    return p


def novo_link(s: Session, obra_id: int) -> LiderPortalModel:
    p = garantir_portal(s, obra_id)
    p.codigo = sessao.novo_codigo()
    s.flush()
    return p


def _situacao(a: LiderAcessoModel | None) -> str:
    if a is None:
        return "nunca_entrou"
    if not a.ativo:
        return "bloqueado"
    return "ativo" if a.senha_hash else "senha_inicial"


def listar(s: Session, obra_id: int) -> list[dict]:
    equipes = list(s.scalars(select(EquipeModel).where(EquipeModel.obra_id == obra_id).order_by(EquipeModel.nome)))
    acessos = {a.colaborador_id: a for a in s.scalars(select(LiderAcessoModel).where(LiderAcessoModel.obra_id == obra_id))}
    C = ColaboradorModel
    pessoas = list(s.scalars(select(C).where(C.obra_id == obra_id)))
    por_cod: dict[str, ColaboradorModel] = {}
    for p in pessoas:
        for k in (p.cracha, p.matricula):
            if normalizar_codigo(k):  # o mesmo número do login (spec 118): zero à esquerda, ponto e ".0" não separam
                por_cod.setdefault(normalizar_codigo(k), p)
    por_id = {p.id: p for p in pessoas}
    origem: dict[int, set[str]] = {}
    fora: list[dict] = []
    for e in equipes:
        if not e.ativo:
            continue
        if e.encarregado_cracha:
            p = por_cod.get(normalizar_codigo(e.encarregado_cracha))
            if p:
                origem.setdefault(p.id, set()).add("encarregado")
            else:
                fora.append({"nome": e.encarregado_nome or e.encarregado_cracha, "matricula": e.encarregado_cracha, "equipe": e.nome})
        for pid, papel in ((e.responsavel_id, "responsável"), (e.supervisor_id, "supervisor")):
            if pid and pid in por_id:
                origem.setdefault(pid, set()).add(papel)
    for a in acessos.values():
        if a.cadastrado:
            origem.setdefault(a.colaborador_id, set()).add("apontador" if a.perfil == "apontador" else "cadastrado")
    for p in pessoas:  # spec 147: quem tem a função de apontador entra pela rota do apontador
        if funcao_de_apontador(p.funcao) and p.situacao not in ("DESMOBILIZADO", "DESISTENCIA"):
            origem.setdefault(p.id, set()).add("apontador")
    out = []
    for pid, papeis in origem.items():
        p, a = por_id.get(pid), acessos.get(pid)
        if p is None:
            continue
        lidera = equipes_lideradas(s, obra_id, p, a, equipes)
        out.append({"colaborador_id": p.id, "nome": p.nome, "matricula": p.matricula, "funcao": p.funcao,
                    "papeis": sorted(papeis), "cadastrado": bool(a and a.cadastrado),
                    "perfil": "apontador" if "apontador" in papeis else "lider",
                    "equipes": [{"id": e.id, "nome": e.nome} for e in lidera],
                    "equipes_extras": [int(x) for x in ((a.equipes if a else None) or [])],
                    "situacao": _situacao(a), "ultimo_acesso": a.ultimo_acesso.isoformat() if a and a.ultimo_acesso else None})
    out.sort(key=lambda x: x["nome"])
    return [*out, *({**f, "fora_do_efetivo": True} for f in fora)]


def _acesso(s: Session, obra_id: int, colaborador_id: int, criar: bool = False, por: str | None = None) -> LiderAcessoModel:
    c = s.get(ColaboradorModel, colaborador_id)
    if c is None or c.obra_id != obra_id:
        raise NotFoundError("pessoa do efetivo", colaborador_id)
    a = s.scalar(select(LiderAcessoModel).where(LiderAcessoModel.obra_id == obra_id, LiderAcessoModel.colaborador_id == colaborador_id))
    if a is None:
        if not criar:
            raise NotFoundError("acesso do líder", colaborador_id)
        a = LiderAcessoModel(obra_id=obra_id, colaborador_id=colaborador_id, ativo=True, cadastrado=False, equipes=[],
                             versao=0, criado_por=por)
        s.add(a)
    return a


def _validar_equipes(s: Session, obra_id: int, ids: list[int]) -> list[int]:
    ok = set(s.scalars(select(EquipeModel.id).where(EquipeModel.obra_id == obra_id, EquipeModel.id.in_(ids or [0]))))
    if set(ids) - ok:
        raise DomainError("equipe inválida", "equipes")
    return sorted(set(ids))


def cadastrar(s: Session, obra_id: int, colaborador_id: int, equipes: list[int], por: str, perfil: str = "lider") -> None:
    c = s.get(ColaboradorModel, colaborador_id)
    if c is not None and not (c.matricula or c.cracha):
        raise DomainError(f"{c.nome} não tem matrícula/crachá: defina antes, é com ela que ele entra", "colaborador_id")
    a = _acesso(s, obra_id, colaborador_id, criar=True, por=por)
    a.cadastrado, a.ativo = True, True
    a.perfil = "apontador" if perfil == "apontador" else "lider"
    a.equipes = _validar_equipes(s, obra_id, equipes) if a.perfil == "lider" else []
    s.flush()


def editar(s: Session, obra_id: int, colaborador_id: int, equipes: list[int] | None, ativo: bool | None) -> None:
    a = _acesso(s, obra_id, colaborador_id, criar=True)
    if equipes is not None:
        a.equipes = _validar_equipes(s, obra_id, equipes)
    if ativo is not None and ativo != a.ativo:
        a.ativo = ativo
        a.versao += 1  # bloquear derruba a sessão aberta
    s.flush()


def redefinir(s: Session, obra_id: int, colaborador_id: int) -> None:
    """Volta para a senha inicial 123456 (ele cria outra no próximo acesso)."""
    a = _acesso(s, obra_id, colaborador_id, criar=True)
    a.senha_hash = None
    a.versao += 1
    s.flush()


def remover(s: Session, obra_id: int, colaborador_id: int) -> None:
    """Tira o líder cadastrado à mão. Quem é encarregado/responsável de equipe continua podendo entrar (bloqueie)."""
    a = _acesso(s, obra_id, colaborador_id)
    s.delete(a)
    s.flush()


# ---- pedidos de equipe (spec 114) -----------------------------------------------------------------------------
def pedidos(s: Session, obra_id: int, situacao: str | None = "pendente") -> list[dict]:
    from app.modules.equipes.application.nome import nome_da_nova_equipe
    from app.modules.lideres.application.portal import _pedido_out, onde_esta

    q = select(LiderPedidoEquipeModel).where(LiderPedidoEquipeModel.obra_id == obra_id)
    if situacao:
        q = q.where(LiderPedidoEquipeModel.situacao == situacao)
    onde = onde_esta(s, obra_id)
    out = []
    for x in s.scalars(q.order_by(LiderPedidoEquipeModel.id.desc()).limit(100)):
        lider = s.get(ColaboradorModel, x.colaborador_id)
        try:
            sugerido = nome_da_nova_equipe(s, obra_id, x.disciplina)
        except DomainError:
            sugerido = None
        out.append({**_pedido_out(x), "nome_sugerido": sugerido, "decidido_por": x.decidido_por,
                    "lider": {"id": lider.id, "nome": lider.nome, "matricula": lider.matricula, "funcao": lider.funcao} if lider else None,
                    # onde cada um está agora (pode ter mudado desde o pedido)
                    "membros": [{**m, "equipe_agora": onde.get(m.get("cracha"))} for m in (x.membros or [])]})
    return out


def _pedido(s: Session, obra_id: int, pid: int) -> LiderPedidoEquipeModel:
    x = s.get(LiderPedidoEquipeModel, pid)
    if x is None or x.obra_id != obra_id:
        raise NotFoundError("pedido de equipe", pid)
    if x.situacao != "pendente":
        raise DomainError(f"esse pedido já foi {x.situacao}", "pedido")
    return x


def criar_equipe(s: Session, obra_id: int, disciplina: str | None, lider: ColaboradorModel, membros: list[tuple[str, str]],
                 por: str, observacao: str, nome: str | None = None) -> tuple[EquipeModel, int]:
    """Equipe nova no padrão de nome da obra (spec 107), o líder como encarregado e as pessoas pelo Alocador (saem da outra
    equipe; a troca vai para o histórico). Usada pela aprovação do pedido (spec 114) e pelo apontador (spec 147)."""
    from app.modules.equipes.application.alocacao import Alocador
    from app.modules.equipes.application.nome import nome_da_nova_equipe

    if not (lider.cracha or lider.matricula):
        raise DomainError(f"{lider.nome} não tem matrícula/crachá no efetivo", "encarregado")
    nome_final = " ".join((nome or "").split())[:120] or nome_da_nova_equipe(s, obra_id, disciplina)
    if s.scalar(select(EquipeModel.id).where(EquipeModel.obra_id == obra_id, EquipeModel.nome == nome_final)):
        raise DomainError(f"já existe a equipe {nome_final}", "nome")
    usados = [int(v) for v in s.scalars(select(EquipeModel.codigo_simova).where(EquipeModel.obra_id == obra_id)) if v and str(v).isdigit()]
    cod_lider = lider.cracha or lider.matricula
    nova = EquipeModel(obra_id=obra_id, nome=nome_final, encarregado_cracha=cod_lider, encarregado_nome=lider.nome,
                       jornada_horas=9.0, turno="Diurno", codigo_simova=str(max(usados, default=0) + 1), ativo=True,
                       observacao=observacao[:300])
    s.add(nova)
    s.flush()
    al = Alocador(s, obra_id, por[:80])
    for e in s.scalars(select(EquipeModel).where(EquipeModel.obra_id == obra_id, EquipeModel.id != nova.id)):
        for mb in [m for m in e.membros if m.cracha in {lider.cracha, lider.matricula}]:
            e.membros.remove(mb)  # o líder vira o encarregado da equipe nova
            al.registrar(mb.cracha, e, nova)
    entraram = 0
    for cod, nome_m in membros:
        if not cod or cod in {lider.cracha, lider.matricula} or any(mb.cracha == cod for mb in nova.membros):
            continue
        al.incluir(nova, cod, nome_m or cod)
        entraram += 1
    s.flush()
    return nova, entraram


def aprovar_pedido(s: Session, obra_id: int, pid: int, nome: str | None, por: str, por_email: str | None) -> dict:
    """Cria a equipe (nome no padrão da obra, o líder como encarregado) e traz as pessoas pelo Alocador: saem da outra
    equipe e a troca vai para o histórico."""
    from datetime import datetime, timezone

    x = _pedido(s, obra_id, pid)
    lider = s.get(ColaboradorModel, x.colaborador_id)
    if lider is None or not (lider.cracha or lider.matricula):
        raise DomainError("o líder do pedido não está mais no efetivo", "pedido")
    nova, entraram = criar_equipe(s, obra_id, x.disciplina, lider, [(m.get("cracha"), m.get("nome")) for m in x.membros or []],
                                  f"aprovado por {por_email or por}", f"Formada pelo pedido do líder (Nº {x.id})", nome)
    x.situacao, x.equipe_id = "aprovado", nova.id
    x.decidido_por, x.decidido_em = por_email or por, datetime.now(timezone.utc)
    s.flush()
    return {"equipe_id": nova.id, "nome": nova.nome, "membros": entraram}


def recusar_pedido(s: Session, obra_id: int, pid: int, motivo: str, por: str, por_email: str | None) -> None:
    from datetime import datetime, timezone

    x = _pedido(s, obra_id, pid)
    m = " ".join((motivo or "").split())
    if len(m) < 5:
        raise DomainError("diga ao líder por que o pedido foi recusado (mín. 5 caracteres)", "motivo")
    x.situacao, x.motivo = "recusado", m[:500]
    x.decidido_por, x.decidido_em = por_email or por, datetime.now(timezone.utc)
    s.flush()
