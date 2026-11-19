"""Spec 117: resolve `/encarregado/<empresa>[/<obra>]` para a obra e a marca, antes do login."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.lideres.domain.rota import empresa_da_obra, rota, slug
from app.modules.obras.infra.models import MarcaObraModel, ObraModel
from app.shared.errors import NotFoundError


def _obras(s: Session) -> list[tuple[ObraModel, MarcaObraModel | None]]:
    marcas = {m.obra_id: m for m in s.scalars(select(MarcaObraModel))}
    return [(o, marcas.get(o.id)) for o in s.scalars(select(ObraModel).where(ObraModel.ativa.is_(True)).order_by(ObraModel.id))]


def marca_publica(m: MarcaObraModel | None) -> dict:
    logos = [q for q in ("contratada", "contratante") if m is not None and getattr(m, f"tipo_{q}")]
    return {"cor": m.cor if m else None, "contratada": m.nome_contratada if m else None,
            "contratante": m.nome_contratante if m else None, "logos": logos,
            "versao": int(m.atualizado_em.timestamp()) if m and m.atualizado_em else 0}


def rota_da_obra(s: Session, obra_id: int) -> dict:
    o = s.get(ObraModel, obra_id)
    if o is None:
        raise NotFoundError("obra", obra_id)
    m = s.get(MarcaObraModel, obra_id)
    return rota(m.nome_contratada if m else None, o.codigo)


def obras_da_empresa(s: Session, empresa: str) -> list[int]:
    alvo = slug(empresa)
    return [o.id for o, m in _obras(s) if empresa_da_obra(m.nome_contratada if m else None) == alvo]


def resolver(s: Session, empresa: str, obra: str | None = None) -> dict:
    """Empresa e obra → marca para a abertura. Com a obra: a marca dela (o código manda; empresa trocada só corrige o
    endereço). Só a empresa: a marca mais completa entre as obras dela (com logo, a mais recente), sem listar as obras."""
    todas = _obras(s)
    if obra:
        achada = next(((o, m) for o, m in todas if slug(o.codigo) == slug(obra)), None)
        if achada is None:
            raise NotFoundError("obra", obra)
        o, m = achada
        r = rota(m.nome_contratada if m else None, o.codigo)
        return {"obra_id": o.id, "obra": o.nome, "marca_obra_id": o.id, "marca": marca_publica(m), "rota": r}
    alvo = slug(empresa)
    da_empresa = [(o, m) for o, m in todas if empresa_da_obra(m.nome_contratada if m else None) == alvo]
    if not da_empresa:
        raise NotFoundError("empresa", empresa)
    o, m = max(da_empresa, key=lambda x: (bool(x[1] and x[1].tipo_contratada), bool(x[1] and x[1].cor),
                                         x[1].atualizado_em.timestamp() if x[1] and x[1].atualizado_em else 0))
    r = rota(m.nome_contratada if m else None, o.codigo)
    return {"obra_id": None, "obra": None, "marca_obra_id": o.id, "marca": marca_publica(m),
            "rota": {"empresa": r["empresa"], "obra": None, "endereco": r["endereco_empresa"], "endereco_empresa": r["endereco_empresa"]}}
