"""Casos de uso das partes da obra e dos responsáveis (spec 139)."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.efetivo.infra.gateway import pessoa
from app.modules.partes.domain import partes as dom
from app.modules.partes.infra.models import ParteObraModel, ResponsavelObraModel
from app.shared.errors import DomainError, NotFoundError


def _nomes_da_marca(s: Session, obra_id: int) -> dict[str, str]:
    """Contratada e contratante já escritas na Marca da obra viram o ponto de partida."""
    from app.modules.obras.infra.models import MarcaObraModel

    m = s.get(MarcaObraModel, obra_id)
    return {k: v for k, v in (("contratada", m.nome_contratada if m else None), ("contratante", m.nome_contratante if m else None)) if v}


def listar(s: Session, obra_id: int) -> dict:
    salvas = {p.papel: p.nome for p in s.scalars(select(ParteObraModel).where(ParteObraModel.obra_id == obra_id))}
    marca = _nomes_da_marca(s, obra_id)
    partes = []
    for papel, rot in dom.PAPEIS.items():
        nome = salvas.get(papel) or marca.get(papel)
        partes.append({"papel": papel, "rotulo": rot, "nome": nome, "gerencia": dom.gerencia(papel, nome),
                       "da_marca": papel not in salvas and papel in marca})
    resp = list(s.scalars(select(ResponsavelObraModel).where(ResponsavelObraModel.obra_id == obra_id)
                          .order_by(ResponsavelObraModel.papel, ResponsavelObraModel.nome)))
    ger = {p["papel"]: p["gerencia"] for p in partes}
    return {"partes": partes, "responsaveis": [
        {"id": r.id, "papel": r.papel, "nome": r.nome, "funcao": r.funcao, "colaborador_id": r.colaborador_id, "ativo": r.ativo,
         "gerencia": ger[r.papel]} for r in resp]}


def definir_parte(s: Session, obra_id: int, papel: str, nome: str | None) -> dict:
    dom.validar_papel(papel)
    p = s.scalar(select(ParteObraModel).where(ParteObraModel.obra_id == obra_id, ParteObraModel.papel == papel))
    if not (nome or "").strip():
        if p is not None:
            s.delete(p)
        s.flush()
        return {"papel": papel, "gerencia": dom.gerencia(papel, None)}
    n = dom.nome_limpo(nome).upper()
    if p is None:
        p = ParteObraModel(obra_id=obra_id, papel=papel, nome=n)
        s.add(p)
    p.nome = n
    s.flush()
    return {"papel": papel, "gerencia": dom.gerencia(papel, n)}


def _repetido(s: Session, obra_id: int, papel: str, nome: str, colaborador_id: int | None, menos: int | None = None) -> bool:
    for r in s.scalars(select(ResponsavelObraModel).where(ResponsavelObraModel.obra_id == obra_id, ResponsavelObraModel.papel == papel)):
        if r.id != menos and ((colaborador_id and r.colaborador_id == colaborador_id) or r.nome.upper() == nome.upper()):
            return True
    return False


def incluir(s: Session, obra_id: int, por: str, papel: str, nome: str | None, funcao: str | None,
            colaborador_id: int | None) -> dict:
    dom.validar_papel(papel)
    if colaborador_id is not None:
        if papel != "contratada":
            raise DomainError("só o responsável da contratada vem do efetivo", "colaborador_id")
        p = pessoa(s, obra_id, colaborador_id)
        if p is None:
            raise NotFoundError("Pessoa do efetivo", colaborador_id)
        nome, funcao = p.nome, funcao or p.funcao
    n = dom.nome_limpo(nome, maximo=150)
    if _repetido(s, obra_id, papel, n, colaborador_id):
        raise DomainError(f"{n} já é responsável da {dom.PAPEIS[papel].lower()}", "nome")
    r = ResponsavelObraModel(obra_id=obra_id, papel=papel, nome=n, funcao=" ".join((funcao or "").split())[:120] or None,
                             colaborador_id=colaborador_id, criado_por=por)
    s.add(r)
    s.flush()
    return {"id": r.id, "nome": r.nome}


def _resp(s: Session, obra_id: int, rid: int) -> ResponsavelObraModel:
    r = s.get(ResponsavelObraModel, rid)
    if r is None or r.obra_id != obra_id:
        raise NotFoundError("Responsável", rid)
    return r


def editar(s: Session, obra_id: int, rid: int, nome: str | None, funcao: str | None, ativo: bool) -> dict:
    r = _resp(s, obra_id, rid)
    if r.colaborador_id is None and nome is not None:
        n = dom.nome_limpo(nome, maximo=150)
        if _repetido(s, obra_id, r.papel, n, None, menos=r.id):
            raise DomainError(f"{n} já está na lista", "nome")
        r.nome = n
    r.funcao, r.ativo = (" ".join((funcao or "").split())[:120] or None), ativo
    s.flush()
    return {"id": r.id}


def excluir(s: Session, obra_id: int, rid: int) -> None:
    s.delete(_resp(s, obra_id, rid))
    s.flush()


def _fontes():
    from app.modules.indicadores.infra import gateway_partes as desvios
    from app.modules.restricoes.infra import gateway as restricoes

    return (("restrições (6WLA)", restricoes), ("desvios", desvios))


def padronizar(s: Session, obra_id: int, aplicar: bool) -> dict:
    """O que já foi registrado com texto livre: gerências antigas que casam com uma parte ("CARDAN" → "CONTRATADA - CARDAN")
    e responsáveis usados que não estão na lista (para incluir). `aplicar` troca as gerências; sem ele é só a prévia."""
    partes = [dom.Parte(p["papel"], p["nome"]) for p in listar(s, obra_id)["partes"]]
    cadastrados = {r.nome.upper() for r in s.scalars(select(ResponsavelObraModel).where(ResponsavelObraModel.obra_id == obra_id))}
    trocas: dict[str, dict] = {}
    soltos: dict[str, dict] = {}
    for rot, fonte in _fontes():
        for resp, ger, n in fonte.responsaveis_e_gerencias(s, obra_id):
            nova = dom.casar_gerencia(ger, partes)
            if ger and nova:
                t = trocas.setdefault(ger, {"de": ger, "para": nova, "registros": 0, "onde": []})
                t["registros"] += n
                if rot not in t["onde"]:
                    t["onde"].append(rot)
            nome = " ".join((resp or "").split())
            if nome and nome.upper() not in cadastrados:
                x = soltos.setdefault(nome.upper(), {"nome": nome, "registros": 0, "gerencia": None})
                x["registros"] += n
                x["gerencia"] = x["gerencia"] or nova or (ger if any(ger == p.gerencia for p in partes) else None)
    trocados = 0
    if aplicar:
        for t in trocas.values():
            for _, fonte in _fontes():
                trocados += fonte.trocar_gerencia(s, obra_id, t["de"], t["para"])
        s.flush()
    papel_de = {p.gerencia: p.papel for p in partes}
    cad = [r for r in s.scalars(select(ResponsavelObraModel).where(ResponsavelObraModel.obra_id == obra_id,
                                                                   ResponsavelObraModel.ativo.is_(True)))]
    return {"gerencias": sorted(trocas.values(), key=lambda t: -t["registros"]), "trocados": trocados,
            "responsaveis": [{**x, "papel": papel_de.get(x["gerencia"]), "sugestao_id": dom.sugerir_responsavel(x["nome"], [(r.id, r.nome) for r in cad])}
                             for x in sorted(soltos.values(), key=lambda x: -x["registros"])]}


def associar(s: Session, obra_id: int, de: str, responsavel_id: int) -> dict:
    """O nome escrito à mão nos registros antigos passa a ser o responsável cadastrado (nome e gerência do padrão)."""
    r = _resp(s, obra_id, responsavel_id)
    if len(" ".join((de or "").split())) < 2:
        raise DomainError("informe o nome antigo", "de")
    ger = next(p["gerencia"] for p in listar(s, obra_id)["partes"] if p["papel"] == r.papel)
    trocados = sum(fonte.trocar_responsavel(s, obra_id, de, r.nome, ger) for _, fonte in _fontes())
    s.flush()
    return {"trocados": trocados, "responsavel": r.nome, "gerencia": ger}
