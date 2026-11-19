"""Casos de uso do portal do líder (spec 111). Toda mudança de equipe passa pelo `Alocador` (spec 107): sai da outra
equipe, vira movimento no histórico ("líder 115532") e o Planejamento é avisado."""
import time
import unicodedata
from datetime import datetime, timezone

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.modules.efetivo.infra.models import ColaboradorModel
from app.modules.equipes.application.alocacao import Alocador
from app.modules.equipes.infra.models import EquipeModel
from app.modules.lideres.domain.portal import SENHA_INICIAL, EquipeDoLider, Tentativas, equipes_do_lider, validar_nova_senha
from app.modules.lideres.infra import sessao
from app.modules.lideres.infra.models import LiderAcessoModel, LiderPortalModel
from app.shared.errors import DomainError, NotFoundError

HASHER = PasswordHasher()
TENTATIVAS = Tentativas()
FORA = ("DESMOBILIZADO", "DESISTENCIA")


def _sem_acento(t: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", t or "") if unicodedata.category(c) != "Mn").upper()


def portal(s: Session, codigo: str) -> LiderPortalModel:
    p = s.scalar(select(LiderPortalModel).where(LiderPortalModel.codigo == (codigo or "").strip().lower()))
    if p is None or not p.ativo:
        raise NotFoundError("link", codigo)
    return p


def _equipes(s: Session, obra_id: int) -> list[EquipeModel]:
    return list(s.scalars(select(EquipeModel).where(EquipeModel.obra_id == obra_id).order_by(EquipeModel.nome)))


def _codigos(c: ColaboradorModel) -> set[str]:
    return {x for x in (c.cracha, c.matricula) if x}


def equipes_lideradas(s: Session, obra_id: int, c: ColaboradorModel, acesso: LiderAcessoModel | None,
                      todas: list[EquipeModel] | None = None) -> list[EquipeModel]:
    todas = todas if todas is not None else _equipes(s, obra_id)
    extras = {int(x) for x in ((acesso.equipes if acesso else None) or [])}
    ids = set(equipes_do_lider(_codigos(c), c.id, extras, [
        EquipeDoLider(e.id, e.encarregado_cracha, e.responsavel_id, e.supervisor_id, e.ativo) for e in todas]))
    return [e for e in todas if e.id in ids]


def _pessoa(s: Session, obra_id: int, codigo: str) -> ColaboradorModel | None:
    cod = "".join(ch for ch in (codigo or "") if ch.isalnum())
    if not cod:
        return None
    C = ColaboradorModel
    return s.scalar(select(C).where(C.obra_id == obra_id, or_(C.matricula == cod, C.cracha == cod)).order_by(C.id))


def entrar(s: Session, codigo: str, matricula: str, senha: str, aparelho: str) -> dict:
    p = portal(s, codigo)
    chave = f"{p.obra_id}:{(matricula or '').strip()}:{aparelho}"
    agora = time.monotonic()
    if TENTATIVAS.bloqueado(chave, agora):
        raise DomainError("muitas tentativas: espere 15 minutos ou peça ao Planejamento para redefinir a senha", "senha")
    c = _pessoa(s, p.obra_id, matricula)
    acesso = s.scalar(select(LiderAcessoModel).where(LiderAcessoModel.obra_id == p.obra_id,
                                                     LiderAcessoModel.colaborador_id == c.id)) if c else None
    lidera = equipes_lideradas(s, p.obra_id, c, acesso) if c else []
    ok_senha = False
    if c is not None and (lidera or (acesso and acesso.cadastrado)):
        if acesso is None or not acesso.senha_hash:
            ok_senha = (senha or "").strip() == SENHA_INICIAL
        else:
            try:
                ok_senha = HASHER.verify(acesso.senha_hash, (senha or "").strip())
            except (VerifyMismatchError, InvalidHashError):
                ok_senha = False
    if not ok_senha:
        TENTATIVAS.errou(chave, agora)
        raise DomainError("matrícula ou senha não conferem (só entram encarregados e líderes cadastrados)", "senha")
    if acesso is not None and not acesso.ativo:
        raise DomainError("seu acesso está bloqueado: fale com o Planejamento", "matricula")
    TENTATIVAS.acertou(chave)
    if acesso is None:
        acesso = LiderAcessoModel(obra_id=p.obra_id, colaborador_id=c.id, ativo=True, cadastrado=False, equipes=[], versao=0)
        s.add(acesso)
    acesso.ultimo_acesso = datetime.now(timezone.utc)
    s.flush()
    trocar = not acesso.senha_hash
    return {"token": sessao.emitir(acesso.id, p.obra_id, acesso.versao, trocar), "trocar_senha": trocar, "nome": c.nome}


def _sessao(s: Session, codigo: str, token: str | None, aceita_trocar: bool = False) -> tuple[LiderPortalModel, LiderAcessoModel, ColaboradorModel]:
    p = portal(s, codigo)
    d = sessao.ler(token)
    acesso = s.get(LiderAcessoModel, int(d["sub"]))
    if acesso is None or acesso.obra_id != p.obra_id or d.get("obra") != p.obra_id or acesso.versao != d.get("v") or not acesso.ativo:
        raise DomainError("sessão encerrada: entre de novo com a matrícula e a senha", "sessao")
    if d.get("trocar") and not aceita_trocar:
        raise DomainError("crie a sua senha antes de continuar", "sessao")
    c = s.get(ColaboradorModel, acesso.colaborador_id)
    return p, acesso, c


def trocar_senha(s: Session, codigo: str, token: str | None, nova: str, repetida: str) -> dict:
    p, acesso, c = _sessao(s, codigo, token, aceita_trocar=True)
    acesso.senha_hash = HASHER.hash(validar_nova_senha(nova, repetida))
    acesso.versao += 1
    s.flush()
    return {"token": sessao.emitir(acesso.id, p.obra_id, acesso.versao, False), "trocar_senha": False, "nome": c.nome}


def _membro_out(m, pessoas: dict[str, ColaboradorModel]) -> dict:
    p = pessoas.get(m.cracha)
    return {"cracha": m.cracha, "nome": m.nome, "funcao": (p.funcao if p else None) or m.funcao,
            "matricula": p.matricula if p else None}


def minhas_equipes(s: Session, codigo: str, token: str | None) -> dict:
    p, acesso, c = _sessao(s, codigo, token)
    todas = _equipes(s, p.obra_id)
    minhas = equipes_lideradas(s, p.obra_id, c, acesso, todas)
    cods = {m.cracha for e in minhas for m in e.membros}
    C = ColaboradorModel
    pessoas = {}
    for x in s.scalars(select(C).where(C.obra_id == p.obra_id, or_(C.cracha.in_(cods or {""}), C.matricula.in_(cods or {""})))):
        for k in _codigos(x):
            pessoas.setdefault(k, x)
    ids = {e.id for e in minhas}
    return {
        "nome": c.nome, "matricula": c.matricula, "funcao": c.funcao,
        "equipes": [{"id": e.id, "nome": e.nome, "encarregado": e.encarregado_nome,
                     "membros": [_membro_out(m, pessoas) for m in sorted(e.membros, key=lambda m: m.nome)]} for e in minhas],
        # para onde transferir: as outras equipes ativas, pelo encarregado
        "destinos": sorted(({"id": e.id, "nome": e.nome, "encarregado": e.encarregado_nome or "sem encarregado"}
                            for e in todas if e.ativo and e.id not in ids), key=lambda x: (x["encarregado"], x["nome"])),
    }


def buscar(s: Session, codigo: str, token: str | None, termo: str) -> list[dict]:
    p, _acesso, _c = _sessao(s, codigo, token)
    t = _sem_acento((termo or "").strip())
    if len(t) < 2:
        return []
    onde: dict[str, str] = {}
    for e in _equipes(s, p.obra_id):
        for m in e.membros:
            onde.setdefault(m.cracha, e.nome)
    out = []
    for x in s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == p.obra_id).order_by(ColaboradorModel.nome)):
        if x.situacao in FORA or not (x.cracha or x.matricula):
            continue
        if t in _sem_acento(x.nome) or (t.isdigit() and t in {x.matricula, x.cracha}) or (t.isdigit() and len(t) >= 4 and t in (x.matricula or "")):
            cod = x.cracha or x.matricula
            out.append({"cracha": cod, "nome": x.nome, "matricula": x.matricula, "funcao": x.funcao,
                        "equipe": onde.get(cod) or onde.get(x.matricula or "")})
            if len(out) >= 20:
                break
    return out


def _avisar(s: Session, obra_id: int, titulo: str, texto: str) -> None:
    from app.modules.notificacoes.application import notificar

    notificar(s, obra_id, tipo="equipe", titulo=titulo, texto=texto, papeis=["planejador", "admin"], url="/app/equipes",
              gravidade="info")


def _minha(s: Session, p, acesso, c, equipe_id: int) -> EquipeModel:
    e = next((x for x in equipes_lideradas(s, p.obra_id, c, acesso) if x.id == equipe_id), None)
    if e is None:
        raise DomainError("essa equipe não é sua", "equipe_id")
    return e


def incluir(s: Session, codigo: str, token: str | None, equipe_id: int, cracha: str) -> dict:
    p, acesso, c = _sessao(s, codigo, token)
    e = _minha(s, p, acesso, c, equipe_id)
    x = _pessoa(s, p.obra_id, cracha)
    if x is None or not (x.cracha or x.matricula):
        raise DomainError("matrícula não encontrada no efetivo da obra", "cracha")
    cod = x.cracha or x.matricula
    if any(m.cracha in _codigos(x) for m in e.membros) or e.encarregado_cracha in _codigos(x):
        raise DomainError(f"{x.nome} já está na {e.nome}", "cracha")
    saiu = Alocador(s, p.obra_id, f"líder {c.matricula or c.nome}"[:80]).incluir(e, cod, x.nome)
    _avisar(s, p.obra_id, f"{c.nome} trouxe {x.nome} para a {e.nome}",
            f"Pelo link dos líderes. {'Saiu de ' + ', '.join(saiu) + '.' if saiu else 'Estava sem equipe.'}")
    s.flush()
    return {"ok": True, "saiu_de": saiu}


def transferir(s: Session, codigo: str, token: str | None, equipe_id: int, cracha: str, para_equipe_id: int | None) -> dict:
    p, acesso, c = _sessao(s, codigo, token)
    origem = _minha(s, p, acesso, c, equipe_id)
    m = next((x for x in origem.membros if x.cracha == cracha), None)
    if m is None:
        raise DomainError("essa pessoa não está na sua equipe", "cracha")
    al = Alocador(s, p.obra_id, f"líder {c.matricula or c.nome}"[:80])
    if para_equipe_id:
        destino = s.get(EquipeModel, para_equipe_id)
        if destino is None or destino.obra_id != p.obra_id or not destino.ativo or destino.id == origem.id:
            raise DomainError("escolha a equipe do outro encarregado", "para_equipe_id")
        if any(x.cracha == cracha for x in destino.membros):
            origem.membros.remove(m)
            al.saiu(origem, cracha)
        else:
            al.incluir(destino, cracha, m.nome, forcar_de=origem)
        para = f"para a {destino.nome} ({destino.encarregado_nome or 'sem encarregado'})"
    else:
        origem.membros.remove(m)
        al.saiu(origem, cracha)
        para = "sem equipe (o encarregado não sabe para onde foi)"
    _avisar(s, p.obra_id, f"{c.nome}: {m.nome} saiu da {origem.nome}", f"Informado pelo link dos líderes: foi {para}.")
    s.flush()
    return {"ok": True}
