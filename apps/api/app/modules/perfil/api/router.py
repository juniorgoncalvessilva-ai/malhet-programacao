"""Perfil do usuário (nome de exibição, telefone, avatar) e menu do celular por perfil/pessoa (spec 075)."""
from io import BytesIO

from fastapi import APIRouter, Depends, File, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, UsuarioAtual, administrar, ler, usuario_atual
from app.core.db import get_session
from app.modules.obras.domain.obra import PapelObra
from app.modules.perfil.domain.menu import MAX_BARRA, PADRAO, TELAS, validar_menu
from app.modules.perfil.infra.models import MenuPerfilModel, MenuPessoalModel, PerfilUsuarioModel
from app.shared.errors import DomainError, NotFoundError

router = APIRouter(tags=["perfil e menu do celular"])
AVATAR_MAX = 6 * 1024 * 1024


def _perfil(s: Session, uid: str) -> PerfilUsuarioModel:
    p = s.get(PerfilUsuarioModel, uid)
    if p is None:
        p = PerfilUsuarioModel(usuario_id=uid, avatar_versao=0)
        s.add(p)
        s.flush()
    return p


def _out(p: PerfilUsuarioModel, u: UsuarioAtual) -> dict:
    return {"usuario_id": u.id, "email": u.email, "superadmin": u.superadmin, "nome_exibicao": p.nome_exibicao,
            "telefone": p.telefone, "tem_avatar": bool(p.avatar_tipo), "avatar_versao": p.avatar_versao}


@router.get("/perfil")
def ver(s: Session = Depends(get_session), u: UsuarioAtual = Depends(usuario_atual)):
    return _out(_perfil(s, u.id), u)


class PerfilIn(BaseModel):
    nome_exibicao: str | None = None
    telefone: str | None = None


@router.put("/perfil")
def salvar(d: PerfilIn, s: Session = Depends(get_session), u: UsuarioAtual = Depends(usuario_atual)):
    p = _perfil(s, u.id)
    nome = " ".join((d.nome_exibicao or "").split())
    if len(nome) > 80:
        raise DomainError("nome de exibição: até 80 caracteres", "nome_exibicao")
    tel = "".join(ch for ch in (d.telefone or "") if ch.isdigit() or ch in "+() -").strip()
    if len(tel) > 30:
        raise DomainError("telefone inválido", "telefone")
    p.nome_exibicao, p.telefone = nome or None, tel or None
    s.flush()
    return _out(p, u)


@router.put("/perfil/avatar")
async def avatar(arquivo: UploadFile = File(...), s: Session = Depends(get_session), u: UsuarioAtual = Depends(usuario_atual)):
    """Foto do perfil: recortada quadrada no centro e reduzida para 256 px (JPEG) — leve para o celular."""
    from PIL import Image, ImageOps, UnidentifiedImageError

    bruto = await arquivo.read(AVATAR_MAX + 1)
    if len(bruto) > AVATAR_MAX:
        raise DomainError("foto maior que 6 MB", "arquivo")
    try:
        im = ImageOps.exif_transpose(Image.open(BytesIO(bruto))).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise DomainError("envie uma foto (JPEG, PNG ou WebP)", "arquivo") from None
    im = ImageOps.fit(im, (256, 256))
    out = BytesIO()
    im.save(out, "JPEG", quality=86)
    p = _perfil(s, u.id)
    p.avatar, p.avatar_tipo, p.avatar_versao = out.getvalue(), "image/jpeg", (p.avatar_versao or 0) + 1
    s.flush()
    return _out(p, u)


@router.delete("/perfil/avatar")
def tirar_avatar(s: Session = Depends(get_session), u: UsuarioAtual = Depends(usuario_atual)):
    p = _perfil(s, u.id)
    p.avatar, p.avatar_tipo, p.avatar_versao = None, None, (p.avatar_versao or 0) + 1
    s.flush()
    return _out(p, u)


@router.get("/perfil/avatar")
def ver_avatar(s: Session = Depends(get_session), u: UsuarioAtual = Depends(usuario_atual)):
    p = s.get(PerfilUsuarioModel, u.id)
    if p is None or not p.avatar_tipo:
        raise NotFoundError("Avatar", u.id)
    return Response(p.avatar, media_type=p.avatar_tipo, headers={"Cache-Control": "private, max-age=86400"})


# ---- menu do celular ----
def _perfis(s: Session, obra_id: int) -> dict[str, dict]:
    salvos = {m.papel: m.menu for m in s.scalars(select(MenuPerfilModel).where(MenuPerfilModel.obra_id == obra_id))}
    return {p.value: {**(salvos.get(p.value) or PADRAO[p.value]), "personalizado": p.value in salvos} for p in PapelObra}


@router.get("/menu-mobile")
def menu(papel: str | None = None, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """O menu que vale para mim nesta obra (pessoal → perfil → padrão) e o padrão de cada perfil.
    `papel` (só o super admin) mostra o menu de outro perfil para testar (spec 077)."""
    perfis = _perfis(s, c.obra_id)
    if papel and c.usuario.superadmin and papel in perfis:
        return {"meu": {**perfis[papel], "origem": "perfil"}, "perfis": perfis, "telas": list(TELAS), "max_barra": MAX_BARRA}
    pessoal = s.scalar(select(MenuPessoalModel).where(MenuPessoalModel.obra_id == c.obra_id, MenuPessoalModel.usuario_id == c.usuario.id))
    meu = {**pessoal.menu, "origem": "pessoal"} if pessoal else {**perfis[c.papel.value], "origem": "perfil" if perfis[c.papel.value]["personalizado"] else "padrao"}
    meu.pop("personalizado", None)
    return {"meu": meu, "perfis": perfis, "telas": list(TELAS), "max_barra": MAX_BARRA}


class MenuIn(BaseModel):
    barra: list[str] = []
    destaque: str | None = None


@router.put("/menu-mobile/meu")
def salvar_meu(d: MenuIn, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    v = validar_menu(d.barra, d.destaque)
    m = s.scalar(select(MenuPessoalModel).where(MenuPessoalModel.obra_id == c.obra_id, MenuPessoalModel.usuario_id == c.usuario.id))
    if m is None:
        m = MenuPessoalModel(obra_id=c.obra_id, usuario_id=c.usuario.id, menu=v)
        s.add(m)
    m.menu = v
    s.flush()
    return menu(None, s, c)


@router.delete("/menu-mobile/meu")
def voltar_ao_perfil(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    m = s.scalar(select(MenuPessoalModel).where(MenuPessoalModel.obra_id == c.obra_id, MenuPessoalModel.usuario_id == c.usuario.id))
    if m is not None:
        s.delete(m)
        s.flush()
    return menu(None, s, c)


@router.put("/menu-mobile/perfis/{papel}")
def salvar_perfil(papel: str, d: MenuIn, s: Session = Depends(get_session), c: ContextoObra = Depends(administrar)):
    if papel not in {p.value for p in PapelObra}:
        raise DomainError("perfil desconhecido", "papel")
    v = validar_menu(d.barra, d.destaque)
    m = s.scalar(select(MenuPerfilModel).where(MenuPerfilModel.obra_id == c.obra_id, MenuPerfilModel.papel == papel))
    if m is None:
        m = MenuPerfilModel(obra_id=c.obra_id, papel=papel, menu=v)
        s.add(m)
    m.menu, m.atualizado_por = v, c.usuario.email
    s.flush()
    return _perfis(s, c.obra_id)


@router.delete("/menu-mobile/perfis/{papel}")
def padrao_do_sistema(papel: str, s: Session = Depends(get_session), c: ContextoObra = Depends(administrar)):
    m = s.scalar(select(MenuPerfilModel).where(MenuPerfilModel.obra_id == c.obra_id, MenuPerfilModel.papel == papel))
    if m is not None:
        s.delete(m)
        s.flush()
    return _perfis(s, c.obra_id)
