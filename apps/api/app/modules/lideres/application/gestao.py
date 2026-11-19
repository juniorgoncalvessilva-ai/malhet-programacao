"""Gestão do acesso dos líderes (spec 111): o link da obra e quem pode entrar — encarregados e responsáveis/supervisores
das equipes (automático) e líderes cadastrados à mão (sem a função de encarregado), com as equipes que controlam."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.efetivo.infra.models import ColaboradorModel
from app.modules.equipes.infra.models import EquipeModel
from app.modules.lideres.application.portal import equipes_lideradas
from app.modules.lideres.infra import sessao
from app.modules.lideres.infra.models import LiderAcessoModel, LiderPortalModel
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
            if k:
                por_cod.setdefault(k, p)
    por_id = {p.id: p for p in pessoas}
    origem: dict[int, set[str]] = {}
    fora: list[dict] = []
    for e in equipes:
        if not e.ativo:
            continue
        if e.encarregado_cracha:
            p = por_cod.get(e.encarregado_cracha)
            if p:
                origem.setdefault(p.id, set()).add("encarregado")
            else:
                fora.append({"nome": e.encarregado_nome or e.encarregado_cracha, "matricula": e.encarregado_cracha, "equipe": e.nome})
        for pid, papel in ((e.responsavel_id, "responsável"), (e.supervisor_id, "supervisor")):
            if pid and pid in por_id:
                origem.setdefault(pid, set()).add(papel)
    for a in acessos.values():
        if a.cadastrado:
            origem.setdefault(a.colaborador_id, set()).add("cadastrado")
    out = []
    for pid, papeis in origem.items():
        p, a = por_id.get(pid), acessos.get(pid)
        if p is None:
            continue
        lidera = equipes_lideradas(s, obra_id, p, a, equipes)
        out.append({"colaborador_id": p.id, "nome": p.nome, "matricula": p.matricula, "funcao": p.funcao,
                    "papeis": sorted(papeis), "cadastrado": bool(a and a.cadastrado),
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


def cadastrar(s: Session, obra_id: int, colaborador_id: int, equipes: list[int], por: str) -> None:
    c = s.get(ColaboradorModel, colaborador_id)
    if c is not None and not (c.matricula or c.cracha):
        raise DomainError(f"{c.nome} não tem matrícula/crachá: defina antes, é com ela que ele entra", "colaborador_id")
    a = _acesso(s, obra_id, colaborador_id, criar=True, por=por)
    a.cadastrado, a.ativo = True, True
    a.equipes = _validar_equipes(s, obra_id, equipes)
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
