"""GRD no modelo do contrato (spec 130) — Guia de Remessa de Documentos como a GRD-MIL-0272:

cabeçalho FOLHA x de y · DATA · PARA / DE / GRDT Nº · ATENÇÃO / EMITENTE / REFERÊNCIA (+ ÁREA/CARGO de cada um);
itens Item · Nº Documento · Título · Rev. · Nº folha · Status · Finalidade · Tipo · Formato · Nº vias; Observações; as legendas e
os blocos REMETENTE / RECEBIDO (identificação, assinatura e data). O Plano de Arquivamento (PR-17321-002) manda: toda
distribuição externa vai com GRD; cópia controlada carimbada; obsoleto identificado.
"""
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime

from app.modules.documentos.domain.documento import TIPO_EMISSAO, normalizar_codigo, normalizar_finalidade, normalizar_revisao

STATUS = {**TIPO_EMISSAO, "OB": "OBSOLETO"}  # letra do TE + OB
FINALIDADES = {1: "Para informação", 2: "Para análise/liberação", 3: "Para aplicação/construção", 4: "Para arquivo",
               5: "Para cancelar", 6: "Para análise As Built/Redline", 7: "Para compra"}
VIAS = {"OR": "Original", "CC": "Cópia controlada", "CO": "Cópia", "CH": "Cópia heliográfica", "AD": "Arquivo digital", "OT": "Outros"}
FORMATOS = ("A0", "A1", "A2", "A3", "A4", "CARTA", "OFICIO")
_LETRA = {v: k for k, v in TIPO_EMISSAO.items()}


def status_da_finalidade(finalidade: str | None) -> str | None:
    """PARA CONSTRUÇÃO → E (a letra do TE que vai na coluna Status)."""
    return _LETRA.get(normalizar_finalidade(finalidade)) if finalidade else None


def finalidade_da_remessa(finalidade: str | None) -> int:
    """O que se espera de quem recebe, pela finalidade da revisão: construção → 3, aprovação → 2, as built → 6…"""
    f = normalizar_finalidade(finalidade) if finalidade else ""
    return {"PARA CONSTRUÇÃO": 3, "LIBERADO": 3, "LIBERADO PARA EXECUÇÃO": 3, "APROVADO": 3, "PARA APROVAÇÃO": 2,
            "PARA COMENTÁRIOS": 2, "CONFORME CONSTRUÍDO": 6, "COMO CONSTRUÍDO": 6, "CANCELADO": 5, "PARA COTAÇÃO": 7,
            "CONFORME COMPRADO": 4}.get(f, 1)


def validar_item(via: str | None, formato: str | None, finalidade: int | None, vias: int | None, folhas: int | None):
    from app.shared.errors import DomainError

    v = (via or "").strip().upper() or None
    if v and v not in VIAS:
        raise DomainError(f"tipo de via: {', '.join(VIAS)}", "via")
    fo = _n(formato).replace(" ", "") or None
    if fo and fo not in FORMATOS:
        raise DomainError(f"formato: {', '.join(FORMATOS)}", "formato")
    if finalidade is not None and finalidade not in FINALIDADES:
        raise DomainError("finalidade da remessa: 1 a 7", "finalidade")
    for nome, x in (("vias", vias), ("folhas", folhas)):
        if x is not None and x < 0:
            raise DomainError(f"{nome} não pode ser negativo", nome)
    return v, fo


def _n(t) -> str:
    s = unicodedata.normalize("NFKD", str(t or "").replace("º", "").replace("°", "")).encode("ascii", "ignore").decode().upper()
    return " ".join(re.sub(r"[^A-Z0-9]+", " ", s).split())


def _txt(v) -> str | None:
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    t = " ".join(str(v).split())
    return None if t in ("", "-", "0") else t


def _data(v) -> date | None:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{2,4})", str(v or ""))
    if m:
        d, mes, a = (int(x) for x in m.groups())
        try:
            return date(a + 2000 if a < 100 else a, mes, d)
        except ValueError:
            return None
    return None


def _int(v) -> int | None:
    t = _txt(v)
    return int(float(t.replace(",", "."))) if t and re.fullmatch(r"\d+([.,]0+)?", t) else None


@dataclass(frozen=True)
class ItemGrd:
    linha: int
    codigo: str
    titulo: str
    revisao: str | None
    folhas: int | None
    status: str | None
    finalidade: int | None
    via: str | None
    formato: str | None
    vias: int | None


@dataclass
class GrdLida:
    numero: str | None = None
    data: date | None = None
    para: str | None = None
    de: str | None = None
    atencao: str | None = None
    atencao_cargo: str | None = None
    emitente: str | None = None
    emitente_cargo: str | None = None
    referencia: str | None = None
    observacao: str | None = None
    itens: list[ItemGrd] = field(default_factory=list)
    avisos: list[str] = field(default_factory=list)


_ROTULOS = {"PARA": "para", "DE": "de", "GRDT N": "numero", "GRD N": "numero", "N GRD": "numero", "ATENCAO": "atencao",
            "EMITENTE": "emitente", "REFERENCIA": "referencia"}


def ler(linhas: list[tuple]) -> GrdLida:
    """Lê a GRD pela posição dos rótulos (o valor fica na linha de baixo, mesma coluna)."""
    g = GrdLida()

    def abaixo(i: int, j: int, saltos: int = 2):
        for k in range(i + 1, min(i + 1 + saltos, len(linhas))):
            v = linhas[k][j] if j < len(linhas[k]) else None
            if _txt(v):
                return _txt(v)
        return None

    cab = None
    for i, lin in enumerate(linhas[:60]):
        nomes = [_n(c) for c in lin]
        if "TITULO" in nomes and any(x.startswith("N DOCUMENTO") or x == "DOCUMENTO" or x == "CODIGO" for x in nomes):
            cab = i
            break
        for j, n in enumerate(nomes):
            if n == "DATA" and g.data is None:
                g.data = next((_data(x) for x in lin[j + 1:] if _data(x)), None)
            elif n in _ROTULOS and getattr(g, _ROTULOS[n]) is None:
                setattr(g, _ROTULOS[n], abaixo(i, j))
            elif n == "AREA CARGO":
                alvo = "atencao_cargo" if g.atencao_cargo is None else "emitente_cargo"
                setattr(g, alvo, abaixo(i, j))
    if cab is None:
        g.avisos.append("não achei a tabela de itens (Nº Documento | Título)")
        return g
    nomes = [_n(c) for c in linhas[cab]]
    col = {}
    for j, n in enumerate(nomes):
        for chave, ops in (("codigo", ("N DOCUMENTO", "DOCUMENTO", "CODIGO")), ("titulo", ("TITULO",)), ("revisao", ("REV", "REVISAO")),
                           ("folhas", ("N FOLHA", "FOLHAS", "N FOLHAS")), ("status", ("STATUS",)), ("finalidade", ("FINALIDADE",)),
                           ("via", ("TIPO", "TIPO DE VIA", "VIA")), ("formato", ("FORMATO",)), ("vias", ("N VIAS", "VIAS"))):
            if n in ops and chave not in col:
                col[chave] = j
    for k in range(cab + 1, len(linhas)):
        lin = linhas[k]
        primeiro = _n(next((c for c in lin if _txt(c)), ""))
        if primeiro.startswith("OBSERVAC"):
            obs = [_txt(c) for c in (linhas[k + 1] if k + 1 < len(linhas) else ()) if _txt(c)]
            g.observacao = " ".join(obs) or None
            break
        val = lambda c: lin[col[c]] if c in col and col[c] < len(lin) else None  # noqa: E731
        cod = _txt(val("codigo"))
        if not cod or len(cod) < 3:
            continue
        bruto = val("revisao")
        rev = None if bruto is None or str(bruto).strip() in ("", "-") else str(int(bruto) if isinstance(bruto, float) and bruto.is_integer() else bruto).strip()
        try:
            rev = normalizar_revisao(rev) if rev is not None else None
        except Exception:  # noqa: BLE001
            g.avisos.append(f"{cod}: revisão {rev!r} não reconhecida")
            rev = None
        st = (_txt(val("status")) or "").upper() or None
        fin_txt = _txt(val("finalidade"))
        fin = _int(fin_txt)
        if fin is None and fin_txt and fin_txt.upper() in STATUS:  # modelo que repete a letra do status na finalidade
            fin = finalidade_da_remessa(STATUS[fin_txt.upper()])
        g.itens.append(ItemGrd(linha=k + 1, codigo=normalizar_codigo(cod), titulo=(_txt(val("titulo")) or cod)[:300], revisao=rev,
                               folhas=_int(val("folhas")), status=st if st in STATUS else None, finalidade=fin if fin in FINALIDADES else None,
                               via=(_txt(val("via")) or "").upper() or None, formato=_n(val("formato")).replace(" ", "") or None,
                               vias=_int(val("vias"))))
    return g
