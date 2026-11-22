"""Pastas de documentos e o consolidado do período (spec 129).

Pastas: a obra recebe a cópia da pasta-modelo na primeira vez que abre Documentos; cada pasta é uma regra e mostra quantos
documentos cumpre, quantos têm revisão vigente e quando chegou a última revisão. O que não cabe em pasta nenhuma aparece em
"Sem pasta", com a pasta sugerida. O armazenamento mostra o que os documentos ocupam no acervo da obra.

Consolidado: tudo o que entrou ou saiu no período (semana ou mês) — revisões (arquivo recebido ou só listada na LDO) e GRDs
(com ou sem ciência) —, com a situação "assinado" (comprovado: arquivo guardado / ciência registrada) ou "pendente".
"""
from datetime import date, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.modules.arquivos.infra.models import ArquivoModel
from app.modules.documentos.domain import documento as dom
from app.modules.documentos.domain import pastas as pd
from app.modules.documentos.infra.models import (
    DocumentoModel,
    DocumentoPastaModel,
    DocumentoRevisaoModel,
    GrdItemModel,
    GrdModel,
)
from app.shared.errors import DomainError, NotFoundError


def garantir_modelo(s: Session, obra_id: int, por: str) -> list[DocumentoPastaModel]:
    pastas = list(s.scalars(select(DocumentoPastaModel).where(DocumentoPastaModel.obra_id == obra_id).order_by(DocumentoPastaModel.codigo)))
    if pastas:
        return pastas
    for m in pd.MODELO:
        s.add(DocumentoPastaModel(obra_id=obra_id, codigo=m.codigo, nome=m.nome, descricao=m.descricao, tipos=list(m.regra.tipos),
                                  disciplinas=list(m.regra.disciplinas) or None, pacotes=list(m.regra.pacotes) or None,
                                  do_modelo=True, criado_por=por))
    s.flush()
    return list(s.scalars(select(DocumentoPastaModel).where(DocumentoPastaModel.obra_id == obra_id).order_by(DocumentoPastaModel.codigo)))


def _regra(p: DocumentoPastaModel) -> pd.Regra:
    return pd.Regra(tuple(p.tipos or ()), tuple(p.disciplinas or ()), tuple(p.pacotes or ()))


def _info(d: DocumentoModel) -> pd.DocInfo:
    return pd.DocInfo(d.tipo, d.disciplina, d.disciplina_sigla, d.pacote)


def _docs_e_revs(s: Session, obra_id: int):
    docs = list(s.scalars(select(DocumentoModel).where(DocumentoModel.obra_id == obra_id)))
    revs: dict[int, list[DocumentoRevisaoModel]] = {}
    for r in s.scalars(select(DocumentoRevisaoModel).where(DocumentoRevisaoModel.obra_id == obra_id)):
        revs.setdefault(r.documento_id, []).append(r)
    return docs, revs


def listar(s: Session, obra_id: int, por: str) -> dict:
    pastas = garantir_modelo(s, obra_id, por)
    docs, revs = _docs_e_revs(s, obra_id)
    conta = {p.id: pd.Contagem() for p in pastas}
    sem: list[pd.DocInfo] = []
    for d in docs:
        info = _info(d)
        rs = revs.get(d.id, [])
        vig = dom.vigente([dom.RevisaoInfo(r.id, r.revisao, r.finalidade) for r in rs])
        ultima = max((r.enviado_em for r in rs if r.enviado_em), default=None)
        achou = False
        for p in pastas:
            if pd.pertence(info, _regra(p)):
                achou = True
                c = conta[p.id]
                c.documentos += 1
                c.vigentes += bool(vig)
                if ultima and (c.ultima is None or ultima.isoformat() > c.ultima):
                    c.ultima = ultima.isoformat()
                if d.pacote:
                    c.pacotes[d.pacote] = c.pacotes.get(d.pacote, 0) + 1
                if d.disciplina:
                    c.disciplinas[d.disciplina] = c.disciplinas.get(d.disciplina, 0) + 1
        if not achou:
            sem.append(info)
    docs_bytes = s.scalar(select(func.coalesce(func.sum(ArquivoModel.tamanho), 0)).where(
        ArquivoModel.obra_id == obra_id, ArquivoModel.pasta == "05-documentos")) or 0
    obra_bytes = s.scalar(select(func.coalesce(func.sum(ArquivoModel.tamanho), 0)).where(ArquivoModel.obra_id == obra_id)) or 0
    modelo = {m.codigo for m in pd.MODELO}
    return {
        "pastas": [{"id": p.id, "codigo": p.codigo, "nome": p.nome, "descricao": p.descricao, "do_modelo": p.do_modelo,
                    "tipos": p.tipos or [], "disciplinas": p.disciplinas or [], "pacotes": p.pacotes or [],
                    "documentos": conta[p.id].documentos, "vigentes": conta[p.id].vigentes, "ultima": conta[p.id].ultima,
                    "por_pacote": conta[p.id].pacotes, "por_disciplina": conta[p.id].disciplinas} for p in pastas],
        "sem_pasta": len(sem), "sugestao": pd.sugestao_para(sem), "documentos": len(docs),
        "faltam_do_modelo": [m.nome for m in pd.MODELO if m.codigo not in {p.codigo for p in pastas if p.do_modelo} and m.codigo in modelo],
        "armazenamento": {"documentos": int(docs_bytes), "obra": int(obra_bytes),
                          "limite": int(get_settings().arquivos_limite_gb * 1024 ** 3)},
    }


def ids_da_pasta(s: Session, obra_id: int, pasta_id: int) -> set[int] | None:
    """Documentos de uma pasta (pasta_id = 0: os que não estão em pasta nenhuma)."""
    pastas = list(s.scalars(select(DocumentoPastaModel).where(DocumentoPastaModel.obra_id == obra_id)))
    docs = list(s.scalars(select(DocumentoModel).where(DocumentoModel.obra_id == obra_id)))
    if pasta_id == 0:
        return {d.id for d in docs if not any(pd.pertence(_info(d), _regra(p)) for p in pastas)}
    p = next((x for x in pastas if x.id == pasta_id), None)
    if p is None:
        raise NotFoundError("pasta", pasta_id)
    return {d.id for d in docs if pd.pertence(_info(d), _regra(p))}


def _lista(v: list[str] | None, maiusc: bool = True) -> list[str] | None:
    out = [" ".join(x.split())[:40] for x in (v or []) if x and x.strip()]
    out = [x.upper() for x in out] if maiusc else out
    return list(dict.fromkeys(out)) or None


def salvar(s: Session, obra_id: int, por: str, nome: str, descricao: str | None, tipos: list[str] | None,
           disciplinas: list[str] | None, pacotes: list[str] | None, pasta_id: int | None = None) -> dict:
    garantir_modelo(s, obra_id, por)
    regra = pd.Regra(tuple(_lista(tipos) or ()), tuple(_lista(disciplinas) or ()), tuple(_lista(pacotes, False) or ()))
    if pasta_id:
        p = s.get(DocumentoPastaModel, pasta_id)
        if p is None or p.obra_id != obra_id:
            raise NotFoundError("pasta", pasta_id)
    else:
        usados = list(s.scalars(select(DocumentoPastaModel.codigo).where(DocumentoPastaModel.obra_id == obra_id)))
        p = DocumentoPastaModel(obra_id=obra_id, codigo=pd.proximo_codigo(usados), criado_por=por)
        s.add(p)
    p.nome, p.descricao = pd.validar_nome(nome), (descricao or "").strip()[:200] or None
    p.tipos, p.disciplinas, p.pacotes = list(regra.tipos) or None, list(regra.disciplinas) or None, list(regra.pacotes) or None
    s.flush()
    return {"id": p.id, "codigo": p.codigo, "nome": p.nome}


def excluir(s: Session, obra_id: int, pasta_id: int) -> None:
    p = s.get(DocumentoPastaModel, pasta_id)
    if p is None or p.obra_id != obra_id:
        raise NotFoundError("pasta", pasta_id)
    s.delete(p)  # pasta é regra: os documentos continuam onde estão (em outra pasta ou em "Sem pasta")


def restaurar_modelo(s: Session, obra_id: int, por: str) -> int:
    """Devolve as pastas do modelo que a obra apagou (sem mexer nas que ela criou ou renomeou)."""
    tem = {p.codigo for p in s.scalars(select(DocumentoPastaModel).where(DocumentoPastaModel.obra_id == obra_id))}
    novas = 0
    for m in pd.MODELO:
        if m.codigo not in tem:
            s.add(DocumentoPastaModel(obra_id=obra_id, codigo=m.codigo, nome=m.nome, descricao=m.descricao, tipos=list(m.regra.tipos),
                                      do_modelo=True, criado_por=por))
            novas += 1
    s.flush()
    return novas


# ---- consolidado do período --------------------------------------------------------------------------------------------

def periodo(tipo: str, ref: date) -> tuple[date, date]:
    if tipo == "semana":
        ini = ref - timedelta(days=ref.weekday())  # segunda a domingo
        return ini, ini + timedelta(days=6)
    if tipo == "mes":
        ini = ref.replace(day=1)
        prox = (ini + timedelta(days=32)).replace(day=1)
        return ini, prox - timedelta(days=1)
    raise DomainError("período: semana ou mes", "periodo")


def consolidado(s: Session, obra_id: int, tipo: str, ref: date, situacao: str | None = None) -> dict:
    ini, fim = periodo(tipo, ref)
    fuso = timezone(timedelta(hours=-3))
    docs = {d.id: d for d in s.scalars(select(DocumentoModel).where(DocumentoModel.obra_id == obra_id))}
    grd_de: dict[int, GrdModel] = {g.id: g for g in s.scalars(select(GrdModel).where(GrdModel.obra_id == obra_id))}
    itens: list[dict] = []
    for r in s.scalars(select(DocumentoRevisaoModel).where(DocumentoRevisaoModel.obra_id == obra_id)):
        quando = r.enviado_em.astimezone(fuso).date() if r.arquivo_id and r.enviado_em else (r.ldo_enviada_em or r.data_emissao)
        if quando is None or not (ini <= quando <= fim):
            continue
        d = docs.get(r.documento_id)
        if d is None:
            continue
        g = grd_de.get(r.grd_id) if r.grd_id else None
        assinado = bool(r.arquivo_id)
        itens.append({"tipo": "revisao", "id": r.id, "documento_id": d.id, "codigo": d.codigo, "titulo": d.titulo, "revisao": r.revisao,
                      "finalidade": r.finalidade, "data": quando.isoformat(), "pacote": d.pacote,
                      "situacao": "assinado" if assinado else "pendente",
                      "detalhe": ("arquivo recebido" + (f" na {g.numero}" if g else "")) if assinado
                      else (f"listada na {r.ldo}, sem arquivo" if r.ldo else "sem arquivo"),
                      "quem": r.enviado_por})
    qtd: dict[int, int] = {}
    for (gid,) in s.execute(select(GrdItemModel.grd_id)):
        qtd[gid] = qtd.get(gid, 0) + 1
    for g in grd_de.values():
        if not (ini <= g.data <= fim):
            continue
        itens.append({"tipo": "grd", "id": g.id, "documento_id": None, "codigo": g.numero, "titulo": f"GRD {g.sentido} · {g.remetente} → {g.destinatario}",
                      "revisao": None, "finalidade": None, "data": g.data.isoformat(), "pacote": None,
                      "situacao": "assinado" if g.ciente_em else "pendente",
                      "detalhe": (f"ciência de {g.ciente_por}" if g.ciente_em else "sem ciência") + f" · {qtd.get(g.id, 0)} documento(s)",
                      "quem": g.criado_por})
    totais = {"itens": len(itens), "assinado": sum(1 for x in itens if x["situacao"] == "assinado"),
              "pendente": sum(1 for x in itens if x["situacao"] == "pendente"),
              "revisoes": sum(1 for x in itens if x["tipo"] == "revisao"), "grds": sum(1 for x in itens if x["tipo"] == "grd")}
    if situacao:
        itens = [x for x in itens if x["situacao"] == situacao]
    itens.sort(key=lambda x: (x["data"], x["tipo"], x["codigo"]), reverse=True)
    return {"inicio": ini.isoformat(), "fim": fim.isoformat(), "periodo": tipo, "totais": totais, "itens": itens}

