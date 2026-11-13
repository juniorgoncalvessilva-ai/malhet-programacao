"""Casos de uso de obras e acessos."""
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.obras.domain.obra import DadosObra, PapelObra
from app.modules.obras.domain.ports import ContasGateway
from app.modules.obras.infra.models import AcessoObraModel, ObraModel
from app.shared.errors import DomainError, NotFoundError


def criar_obra(s: Session, dados: DadosObra, usuario: str) -> ObraModel:
    codigo = dados.codigo.strip().upper()
    if s.scalar(select(ObraModel).where(ObraModel.codigo == codigo)):
        raise DomainError(f"já existe obra com o código {codigo}", "codigo")
    o = ObraModel(codigo=codigo, nome=dados.nome.strip(), contrato=dados.contrato, cliente=dados.cliente,
                  ativa=True, criado_por=usuario)
    s.add(o)
    s.flush()
    return o


@dataclass(frozen=True)
class ConcederIn:
    email: str
    papel: PapelObra
    cracha: str | None = None
    senha_inicial: str | None = None


@dataclass
class ConcederOut:
    acesso: AcessoObraModel
    conta_criada: bool
    senha_redefinida: bool = False


def _pode_redefinir(s: Session, conta, por: str, superadmin: bool, obra_id: int) -> bool:
    """Super admin redefine qualquer senha; o admin da obra só a de quem não é super admin e só tem acesso a obras que
    ele também administra (não pega a conta de outra obra)."""
    if superadmin:
        return True
    if "superadmin" in conta.roles:
        return False
    obras_conta = set(s.scalars(select(AcessoObraModel.obra_id).where(AcessoObraModel.usuario_id == conta.id)))
    minhas = set(s.scalars(select(AcessoObraModel.obra_id).where(AcessoObraModel.usuario_id == por, AcessoObraModel.papel == PapelObra.ADMIN.value)))
    return obras_conta <= (minhas | {obra_id})


async def conceder_acesso(s: Session, contas: ContasGateway, obra_id: int, d: ConcederIn, por: str,
                          superadmin: bool = False) -> ConcederOut:
    if s.get(ObraModel, obra_id) is None:
        raise NotFoundError("Obra", obra_id)
    if d.papel == PapelObra.ENCARREGADO and not (d.cracha or "").strip():
        raise DomainError("encarregado precisa do crachá do Simova (é o que vai na FT)", "cracha")
    conta = await contas.por_email(d.email)
    criada = redefinida = False
    if conta is None:
        if not d.senha_inicial:
            raise DomainError("usuário novo: informe a senha inicial (10+ caracteres, letra e número)", "senha_inicial")
        conta = await contas.criar_verificada(d.email, d.senha_inicial)
        criada = True
    elif d.senha_inicial:
        # conta que já existia: a senha digitada passa a valer (antes era ignorada e a pessoa não entrava) — spec 068
        if not _pode_redefinir(s, conta, por, superadmin, obra_id):
            raise DomainError("esta conta tem acesso a outras obras: só o super admin redefine a senha dela "
                              "(ou a pessoa usa \"Esqueci a senha\")", "senha_inicial")
        await contas.redefinir_senha(conta.id, d.senha_inicial)
        redefinida = True
    elif not conta.verificada:
        raise DomainError("a conta existe mas não confirmou o e-mail: informe uma senha inicial para liberar a entrada",
                          "senha_inicial")
    acesso = s.scalar(select(AcessoObraModel).where(
        AcessoObraModel.obra_id == obra_id, AcessoObraModel.usuario_id == conta.id))
    if acesso is None:
        acesso = AcessoObraModel(obra_id=obra_id, usuario_id=conta.id, email=conta.email, concedido_por=por)
        s.add(acesso)
    acesso.papel = d.papel.value
    acesso.cracha = (d.cracha or "").strip() or None
    s.flush()
    return ConcederOut(acesso, criada, redefinida)


async def garantir_superadmin(contas: ContasGateway, email: str, senha: str) -> None:
    """Seed do Super Admin. Idempotente: cria a conta (confirmada) ou só promove a superadmin.

    Não troca a senha de conta que já existe.
    """
    email = (email or "").strip().lower()
    if not email:
        return
    conta = await contas.por_email(email)
    if conta is None and not senha:
        return
    if conta is None:
        await contas.criar_verificada(email, senha, roles=("superadmin",))
    elif "superadmin" not in conta.roles:
        await contas.definir_roles(conta.id, tuple({*conta.roles, "superadmin"}))
