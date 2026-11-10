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


async def conceder_acesso(s: Session, contas: ContasGateway, obra_id: int, d: ConcederIn, por: str) -> ConcederOut:
    if s.get(ObraModel, obra_id) is None:
        raise NotFoundError("Obra", obra_id)
    if d.papel == PapelObra.ENCARREGADO and not (d.cracha or "").strip():
        raise DomainError("encarregado precisa do crachá do Simova (é o que vai na FT)", "cracha")
    conta = await contas.por_email(d.email)
    criada = False
    if conta is None:
        if not d.senha_inicial:
            raise DomainError("usuário novo: informe a senha inicial (10+ caracteres, letra e número)", "senha_inicial")
        conta = await contas.criar_verificada(d.email, d.senha_inicial)
        criada = True
    acesso = s.scalar(select(AcessoObraModel).where(
        AcessoObraModel.obra_id == obra_id, AcessoObraModel.usuario_id == conta.id))
    if acesso is None:
        acesso = AcessoObraModel(obra_id=obra_id, usuario_id=conta.id, email=conta.email, concedido_por=por)
        s.add(acesso)
    acesso.papel = d.papel.value
    acesso.cracha = (d.cracha or "").strip() or None
    s.flush()
    return ConcederOut(acesso, criada)


async def garantir_superadmin(contas: ContasGateway, email: str, senha: str) -> None:
    """Seed do Super Admin (SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD). Idempotente."""
    if not email or not senha:
        return
    conta = await contas.por_email(email)
    if conta is None:
        await contas.criar_verificada(email, senha, roles=("superadmin",))
    elif "superadmin" not in conta.roles:
        await contas.definir_roles(conta.id, tuple({*conta.roles, "superadmin"}))
