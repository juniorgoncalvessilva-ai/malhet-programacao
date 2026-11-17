"""Resumo do dia — "check out" (spec 101): o que aconteceu na obra num dia, por frente, pronto para copiar e colar ou
mandar no WhatsApp aos setores. Seis partes, nesta ordem: atividades executadas, ocorrências, restrições, auditorias,
equipes e fotos; todas na hierarquia da programação (Local → Área → CWP).

Só texto aqui (sem banco): recebe o resumo já montado e devolve o texto de cada parte no formato do WhatsApp
(*negrito*, _itálico_, • para itens). As partes são independentes: a tela junta só as escolhidas.
"""
from datetime import date

SECOES = ("atividades", "ocorrencias", "restricoes", "auditorias", "equipes", "fotos")
TITULO = {"atividades": "ATIVIDADES EXECUTADAS", "ocorrencias": "OCORRÊNCIAS", "restricoes": "RESTRIÇÕES",
          "auditorias": "AUDITORIAS", "equipes": "EQUIPES", "fotos": "FOTOS"}
SEM_FRENTE = "Sem frente"


def num(v: float | None) -> str:
    """12 → "12"; 12.5 → "12,5"; 1234.5 → "1.234,5" (padrão brasileiro, sem zeros à toa)."""
    if v is None:
        return ""
    s = f"{v:,.2f}".rstrip("0").rstrip(".")
    return s.replace(",", "§").replace(".", ",").replace("§", ".")


def _frentes(grupos: list[dict], linha) -> list[str]:
    """Local em negrito, área em itálico, itens com •. `linha(item)` devolve o texto do item (ou lista de linhas)."""
    out: list[str] = []
    local_atual = None
    for g in grupos:
        if g.get("local") != local_atual:
            local_atual = g.get("local")
            out.append("")
            out.append(f"*{local_atual}*" if local_atual else f"*{SEM_FRENTE}*")
        if g.get("area"):
            out.append(f"_{g['area']}_")
        for cwp in g.get("cwps") or [{"texto": None, "itens": g.get("itens", [])}]:
            if cwp.get("texto"):
                out.append(f"  CWP {cwp['texto']}")
            for it in cwp["itens"]:
                linhas = linha(it)
                out.extend([linhas] if isinstance(linhas, str) else linhas)
    return out


def _atividade(qtd: bool):
    def f(it: dict) -> str:
        extra = []
        if qtd and it.get("realizado"):
            extra.append(f"{num(it['realizado'])} {it.get('unidade') or ''}".strip())
        if it.get("equipe"):
            extra.append(it["equipe"])
        return f"• {it['atividade']}" + (f" — {' · '.join(extra)}" if extra else "")
    return f


def _ocorrencia(it: dict) -> list[str]:
    cab = f"• *{it['causa']}*: {it['descricao']}" if it.get("causa") else f"• {it['descricao']}"
    out = [cab]
    if it.get("atividade"):
        out.append(f"   Atividade: {it['atividade']}")
    if it.get("acao"):
        out.append(f"   Ação: {it['acao']}" + (f" ({it['responsavel']})" if it.get("responsavel") else ""))
    return out


def _restricao(it: dict) -> list[str]:
    marca = {"nova": " _(nova)_", "concluida": " _(concluída hoje)_", "atrasada": " _(atrasada)_"}.get(it.get("marcador"), "")
    out = [f"• Nº {it['numero']} · {it['acao']}{marca}"]
    det = [x for x in (it.get("atividade"), it.get("responsavel"),
                       f"prazo {it['prazo_br']}" if it.get("prazo_br") else None, it.get("status")) if x]
    if det:
        out.append(f"   {' · '.join(det)}")
    return out


def _auditoria(it: dict) -> list[str]:
    out = [f"• {it['tipo'] or 'Auditoria'} Nº {it['numero']}" + (f" · {it['tipo_registro']}" if it.get("tipo_registro") else "")]
    if it.get("nao_conformidade"):
        out.append(f"   Não conformidade: {it['nao_conformidade']}")
    if it.get("medida_corretiva"):
        out.append(f"   Medida: {it['medida_corretiva']}")
    if it.get("ver_agir") is True:
        out.append("   Ver e agir: resolvido na hora")
    elif it.get("ver_agir") is False:
        out.append("   Ver e agir: ação aberta" + (f" (A-{it['acao_numero']})" if it.get("acao_numero") else ""))
    return out


def _equipe(it: dict) -> list[str]:
    pres = f" — {it['presentes']}/{it['total']} presentes" if it.get("total") else ""
    out = [f"• *{it['nome']}*" + (f" (Enc. {it['encarregado']})" if it.get("encarregado") else "") + pres]
    if it.get("funcoes"):
        out.append(f"   {', '.join(it['funcoes'])}")
    for a in it.get("atividades", []):
        out.append(f"   ▸ {a}")
    return out


def _foto(it: dict) -> str:
    return f"• {it['descricao']} ({it['n']} foto{'s' if it['n'] > 1 else ''})"


def textos(r: dict, qtd: bool = True) -> dict[str, str]:
    """Texto do cabeçalho e de cada parte do resumo (parte vazia = texto vazio, a tela não junta)."""
    d = date.fromisoformat(r["data"])
    cab = [f"*Check Out {d:%d/%m/%Y}*"]
    if r.get("obra"):
        cab.append(r["obra"])
    out = {"cabecalho": "\n".join(cab)}
    fmt = {"atividades": _atividade(qtd), "ocorrencias": _ocorrencia, "restricoes": _restricao, "auditorias": _auditoria}
    for sec in ("atividades", "ocorrencias", "restricoes", "auditorias"):
        grupos = r[sec]["grupos"]
        n = r[sec]["total"]
        out[sec] = "\n".join([f"*{TITULO[sec]} ({n})*", *_frentes(grupos, fmt[sec])]).strip() if n else ""
    eq = r["equipes"]
    if eq["itens"]:
        topo = f"*{TITULO['equipes']} ({len(eq['itens'])})*" + (f" — {eq['presentes']} presentes" if eq.get("presentes") else "")
        out["equipes"] = "\n".join([topo, ""] + [x for it in eq["itens"] for x in _equipe(it)])
    else:
        out["equipes"] = ""
    ft = r["fotos"]
    out["fotos"] = "\n".join([f"*{TITULO['fotos']} ({ft['total']})*", *_frentes(ft["grupos"], _foto)]).strip() if ft["total"] else ""
    return out


def juntar(t: dict[str, str], secoes: list[str] | tuple[str, ...] = SECOES) -> str:
    """O texto completo: cabeçalho + as partes escolhidas que têm conteúdo, separadas por uma linha em branco."""
    partes = [t["cabecalho"]] + [t[s] for s in SECOES if s in secoes and t.get(s)]
    return "\n\n".join(partes)
