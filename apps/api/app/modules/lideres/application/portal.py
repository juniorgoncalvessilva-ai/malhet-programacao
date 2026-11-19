"""Casos de uso do portal do líder (spec 111). Toda mudança de equipe passa pelo `Alocador` (spec 107): sai da outra
equipe, vira movimento no histórico ("líder 115532") e o Planejamento é avisado."""
import time
from dataclasses import dataclass
import unicodedata
from datetime import datetime, timezone

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.modules.efetivo.infra.models import ColaboradorModel
from app.modules.equipes.application.alocacao import Alocador
from app.modules.equipes.infra.models import EquipeModel
from app.modules.lideres.domain.portal import (
    SENHA_INICIAL,
    EquipeDoLider,
    Tentativas,
    equipes_do_lider,
    funcao_de_lider,
    normalizar_codigo,
    validar_nova_senha,
    validar_pedido,
)
from app.modules.lideres.infra import sessao
from app.modules.lideres.infra.models import LiderAcessoModel, LiderPedidoEquipeModel, LiderPortalModel
from app.shared.errors import DomainError, NotFoundError

HASHER = PasswordHasher()
TENTATIVAS = Tentativas()
FORA = ("DESMOBILIZADO", "DESISTENCIA")


def _sem_acento(t: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", t or "") if unicodedata.category(c) != "Mn").upper()


def portal(s: Session, codigo: str) -> LiderPortalModel:
    p = s.scalar(select(LiderPortalModel).where(LiderPortalModel.codigo == (codigo or "").strip().lower()))
    if p is None:  # spec 115: só serve para levar os links antigos ao endereço fixo
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


def _norm_sql(col):
    """normalizar_codigo no banco: tira ".0" do fim, o que não é letra/número, maiúsculas e zeros à esquerda."""
    t = func.regexp_replace(func.regexp_replace(func.coalesce(col, ""), r"\.0+$", ""), "[^0-9A-Za-z]", "", "g")
    return func.ltrim(func.upper(t), "0")


def _pelo_codigo(cod: str):
    """Filtro de colaborador pela matrícula ou crachá, do jeito que for digitado (spec 118)."""
    C = ColaboradorModel
    alvo = cod.lstrip("0")
    return or_(_norm_sql(C.matricula) == alvo, _norm_sql(C.cracha) == alvo)


def _pessoa(s: Session, obra_id: int, codigo: str) -> ColaboradorModel | None:
    cod = normalizar_codigo(codigo)
    if not cod:
        return None
    C = ColaboradorModel
    return s.scalar(select(C).where(C.obra_id == obra_id, _pelo_codigo(cod)).order_by(C.id))


@dataclass(frozen=True)
class _Obra:
    obra_id: int


def _senha_confere(acesso: LiderAcessoModel | None, senha: str) -> bool:
    if acesso is None or not acesso.senha_hash:
        return (senha or "").strip() == SENHA_INICIAL
    try:
        return HASHER.verify(acesso.senha_hash, (senha or "").strip())
    except (VerifyMismatchError, InvalidHashError):
        return False


def _nome_obra(s: Session, obra_id: int) -> dict:
    from app.modules.obras.infra.models import MarcaObraModel, ObraModel

    o, m = s.get(ObraModel, obra_id), s.get(MarcaObraModel, obra_id)
    return {"obra_id": obra_id, "obra": o.nome if o else "", "empresa": m.nome_contratada if m else None}


def _encarregado_fora_do_efetivo(s: Session, cod: str, obras: set[int] | None, ja_tem: set[int]) -> list[ColaboradorModel]:
    """Encarregado de equipe ativa cujo crachá não está no efetivo (aparece em Acesso dos líderes como "fora do
    efetivo"): no primeiro acesso entra no efetivo como cadastro pendente, para o Planejamento conferir (spec 118)."""
    from app.modules.efetivo.domain.efetivo import EMPRESA_PROPRIA, Situacao

    q = select(EquipeModel).where(EquipeModel.ativo.is_(True), _norm_sql(EquipeModel.encarregado_cracha) == cod.lstrip("0"))
    novos: list[ColaboradorModel] = []
    for e in s.scalars(q.order_by(EquipeModel.obra_id, EquipeModel.id)):
        if (obras is not None and e.obra_id not in obras) or e.obra_id in ja_tem or any(n.obra_id == e.obra_id for n in novos):
            continue
        if s.scalar(select(ColaboradorModel.id).where(ColaboradorModel.obra_id == e.obra_id, ColaboradorModel.chave == cod)):
            continue
        c = ColaboradorModel(obra_id=e.obra_id, chave=cod, empresa=EMPRESA_PROPRIA, matricula=cod, cracha=cod,
                             nome=(e.encarregado_nome or f"ENCARREGADO {cod}").upper()[:150], funcao="ENCARREGADO",
                             situacao=Situacao.MOBILIZADO.value, origem="simova", no_ultimo_arquivo=False,
                             cadastro_pendente=True, cadastrado_por="portal do encarregado",
                             cadastrado_em=datetime.now(timezone.utc))
        s.add(c)
        novos.append(c)
    s.flush()
    return novos


def entrar(s: Session, matricula: str, senha: str, aparelho: str, obra_id: int | None = None,
           obras: list[int] | None = None) -> dict:
    """Endereço dos encarregados (specs 115, 117 e 118): a obra vem da matrícula (ou do endereço). Matrícula em mais de
    uma obra (e a senha confere nas duas) → devolve as obras para ele escolher e entrar de novo com `obra_id`.
    Entra quem aparece em Acesso dos líderes: encarregado/responsável/supervisor de equipe ativa, líder cadastrado,
    função de liderança no efetivo e o encarregado de equipe que ainda não está no efetivo."""
    cod = normalizar_codigo(matricula)
    chave = f"{cod}:{aparelho}"
    agora = time.monotonic()
    if TENTATIVAS.bloqueado(chave, agora):
        raise DomainError("muitas tentativas: espere 15 minutos ou peça ao Planejamento para redefinir a senha", "senha")
    if not cod:
        raise DomainError("digite a sua matrícula", "matricula")
    permitidas = {obra_id} if obra_id is not None else (set(obras) if obras is not None else None)
    C = ColaboradorModel
    todos = list(s.scalars(select(C).where(_pelo_codigo(cod)).order_by(C.obra_id, C.id)))
    candidatos = [c for c in todos if permitidas is None or c.obra_id in permitidas]
    # uma pessoa por obra (a mesma matrícula de outra empresa terceira não duplica a tentativa)
    vistos: set[int] = set()
    candidatos = [c for c in candidatos if not (c.obra_id in vistos or vistos.add(c.obra_id))]
    lideres, nao_lider, bloqueado = [], [], False
    for c in candidatos:
        acesso = s.scalar(select(LiderAcessoModel).where(LiderAcessoModel.obra_id == c.obra_id, LiderAcessoModel.colaborador_id == c.id))
        lidera = equipes_lideradas(s, c.obra_id, c, acesso)
        # spec 114: função de liderança no efetivo também entra (sem equipe ainda, para pedir a dele)
        if lidera or (acesso and acesso.cadastrado) or funcao_de_lider(c.funcao):
            lideres.append((c, acesso))
        else:
            nao_lider.append(c)
    if (senha or "").strip() == SENHA_INICIAL:  # encarregado de equipe que não está no efetivo: entra no 1º acesso
        lideres += [(c, None) for c in _encarregado_fora_do_efetivo(s, cod, permitidas, {c.obra_id for c in todos})]
    validos = []
    for c, acesso in lideres:
        if not _senha_confere(acesso, senha):
            continue
        if acesso is not None and not acesso.ativo:
            bloqueado = True
            continue
        validos.append((c, acesso))
    if not validos:
        if bloqueado:
            raise DomainError("seu acesso está bloqueado: fale com o Planejamento", "matricula")
        if lideres:  # é líder: a senha é que não confere
            TENTATIVAS.errou(chave, agora)
            ja_criou = any(a is not None and a.senha_hash for _c, a in lideres)
            raise DomainError("senha não confere. " + ("Esqueceu a sua? Peça ao Planejamento para redefinir (volta a 123456)."
                                                        if ja_criou else "No primeiro acesso a senha é 123456."), "senha")
        TENTATIVAS.errou(chave, agora)
        if nao_lider:
            raise DomainError(f"{nao_lider[0].nome}: não está como líder de equipe. O Planejamento inclui em Acesso dos líderes.",
                              "matricula")
        if permitidas is not None and any(c.obra_id not in permitidas for c in todos):
            raise DomainError("sua matrícula não é desta obra: entre pelo endereço da sua obra (peça ao Planejamento)", "matricula")
        raise DomainError(f"matrícula {cod} não encontrada entre os líderes. Confira o número com o Planejamento.", "matricula")
    TENTATIVAS.acertou(chave)
    if len(validos) > 1:
        return {"escolher": [_nome_obra(s, c.obra_id) for c, _a in validos]}
    c, acesso = validos[0]
    if acesso is None:
        acesso = LiderAcessoModel(obra_id=c.obra_id, colaborador_id=c.id, ativo=True, cadastrado=False, equipes=[], versao=0)
        s.add(acesso)
    acesso.ultimo_acesso = datetime.now(timezone.utc)
    s.flush()
    trocar = not acesso.senha_hash
    from app.modules.lideres.application.rotas import rota_da_obra

    return {"token": sessao.emitir(acesso.id, c.obra_id, acesso.versao, trocar), "trocar_senha": trocar, "nome": c.nome,
            "obra_id": c.obra_id, "rota": rota_da_obra(s, c.obra_id)}


def obra_do_token(token: str | None) -> int:
    return int(sessao.ler(token)["obra"])


def _sessao(s: Session, token: str | None, aceita_trocar: bool = False) -> tuple[_Obra, LiderAcessoModel, ColaboradorModel]:
    d = sessao.ler(token)
    acesso = s.get(LiderAcessoModel, int(d["sub"]))
    if acesso is None or acesso.obra_id != d.get("obra") or acesso.versao != d.get("v") or not acesso.ativo:
        raise DomainError("sessão encerrada: entre de novo com a matrícula e a senha", "sessao")
    if d.get("trocar") and not aceita_trocar:
        raise DomainError("crie a sua senha antes de continuar", "sessao")
    c = s.get(ColaboradorModel, acesso.colaborador_id)
    return _Obra(acesso.obra_id), acesso, c


def trocar_senha(s: Session, token: str | None, nova: str, repetida: str) -> dict:
    p, acesso, c = _sessao(s, token, aceita_trocar=True)
    acesso.senha_hash = HASHER.hash(validar_nova_senha(nova, repetida))
    acesso.versao += 1
    s.flush()
    return {"token": sessao.emitir(acesso.id, p.obra_id, acesso.versao, False), "trocar_senha": False, "nome": c.nome}


def _membro_out(m, pessoas: dict[str, ColaboradorModel]) -> dict:
    p = pessoas.get(m.cracha)
    return {"cracha": m.cracha, "nome": m.nome, "funcao": (p.funcao if p else None) or m.funcao,
            "matricula": p.matricula if p else None}


def minhas_equipes(s: Session, token: str | None) -> dict:
    p, acesso, c = _sessao(s, token)
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
        "pedidos": [_pedido_out(x) for x in s.scalars(select(LiderPedidoEquipeModel).where(
            LiderPedidoEquipeModel.obra_id == p.obra_id, LiderPedidoEquipeModel.colaborador_id == c.id)
            .order_by(LiderPedidoEquipeModel.id.desc()).limit(5))],
        # para onde transferir: as outras equipes ativas, pelo encarregado
        "destinos": sorted(({"id": e.id, "nome": e.nome, "encarregado": e.encarregado_nome or "sem encarregado"}
                            for e in todas if e.ativo and e.id not in ids), key=lambda x: (x["encarregado"], x["nome"])),
    }


def buscar(s: Session, token: str | None, termo: str) -> list[dict]:
    p, _acesso, _c = _sessao(s, token)
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


def _avisar(s: Session, obra_id: int, titulo: str, texto: str, url: str = "/app/equipes") -> None:
    from app.modules.notificacoes.application import notificar

    notificar(s, obra_id, tipo="equipe", titulo=titulo, texto=texto, papeis=["planejador", "admin"], url=url, gravidade="info")


def _minha(s: Session, p, acesso, c, equipe_id: int) -> EquipeModel:
    e = next((x for x in equipes_lideradas(s, p.obra_id, c, acesso) if x.id == equipe_id), None)
    if e is None:
        raise DomainError("essa equipe não é sua", "equipe_id")
    return e


def incluir(s: Session, token: str | None, equipe_id: int, cracha: str) -> dict:
    p, acesso, c = _sessao(s, token)
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


def transferir(s: Session, token: str | None, equipe_id: int, cracha: str, para_equipe_id: int | None) -> dict:
    p, acesso, c = _sessao(s, token)
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


# ---- pedido de equipe (spec 114) ------------------------------------------------------------------------------
def _pedido_out(x: LiderPedidoEquipeModel) -> dict:
    return {"id": x.id, "disciplina": x.disciplina, "membros": x.membros or [], "observacao": x.observacao, "situacao": x.situacao,
            "motivo": x.motivo, "equipe_id": x.equipe_id, "criado_em": x.criado_em.isoformat() if x.criado_em else None,
            "decidido_em": x.decidido_em.isoformat() if x.decidido_em else None}


def onde_esta(s: Session, obra_id: int) -> dict[str, str]:
    onde: dict[str, str] = {}
    for e in _equipes(s, obra_id):
        for m in e.membros:
            onde.setdefault(m.cracha, e.nome)
    return onde


def pedir_equipe(s: Session, token: str | None, disciplina: str, crachas: list[str], observacao: str | None) -> dict:
    """O líder aponta quem está com ele; nada muda nas equipes até o Planejamento aprovar. Pedido pendente é substituído."""
    p, acesso, c = _sessao(s, token)
    disc, cods = validar_pedido(disciplina, crachas)
    onde = onde_esta(s, p.obra_id)
    membros, nao_achou = [], []
    for cod in cods:
        x = _pessoa(s, p.obra_id, cod)
        if x is None or not (x.cracha or x.matricula):
            nao_achou.append(cod)
            continue
        if x.id == c.id:
            continue  # o próprio líder vira o encarregado da equipe
        k = x.cracha or x.matricula
        membros.append({"cracha": k, "nome": x.nome, "matricula": x.matricula, "funcao": x.funcao, "equipe": onde.get(k)})
    if nao_achou:
        raise DomainError(f"não achei no efetivo: {', '.join(nao_achou[:5])}", "membros")
    if not membros:
        raise DomainError("aponte ao menos uma pessoa além de você", "membros")
    ped = s.scalar(select(LiderPedidoEquipeModel).where(LiderPedidoEquipeModel.obra_id == p.obra_id,
                                                        LiderPedidoEquipeModel.colaborador_id == c.id,
                                                        LiderPedidoEquipeModel.situacao == "pendente"))
    if ped is None:
        ped = LiderPedidoEquipeModel(obra_id=p.obra_id, colaborador_id=c.id, situacao="pendente")
        s.add(ped)
    ped.disciplina, ped.membros, ped.observacao = disc, membros, ((observacao or "").strip()[:500] or None)
    s.flush()
    _avisar(s, p.obra_id, f"{c.nome} pediu a formação de uma equipe ({disc})",
            f"{len(membros)} pessoa(s) apontada(s) pelo link dos líderes. Aprove ou recuse em Acesso dos líderes.", url="/app/lideres")
    return _pedido_out(ped)


def cancelar_pedido(s: Session, token: str | None, pid: int) -> None:
    p, _acesso, c = _sessao(s, token)
    ped = s.get(LiderPedidoEquipeModel, pid)
    if ped is None or ped.obra_id != p.obra_id or ped.colaborador_id != c.id or ped.situacao != "pendente":
        raise DomainError("esse pedido não está mais pendente", "pedido")
    s.delete(ped)
    s.flush()
