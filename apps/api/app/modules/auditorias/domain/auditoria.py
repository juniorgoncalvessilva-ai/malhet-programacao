"""Auditorias e inspeções por modelo (spec 064). O modelo diz os tipos de auditoria, os tipos de registro de cada tipo,
os campos (rótulo, emoji, obrigatório) e o texto do envio. O modelo de Segurança do Trabalho vem pronto e é o padrão.

Regras do registro (não conformidade):
- sempre a foto da não conformidade ("antes");
- VER E AGIR = SIM: corrigido na hora → foto do depois (adequação) obrigatória;
- VER E AGIR = NÃO: plano de ação (responsável = encarregado e prazo) → vira ação 5W2H; a auditoria fecha quando a
  ação é concluída e verificada.
"""
from datetime import date

from app.shared.errors import DomainError

TIPOS_DE_CAMPO = ("tipo_auditoria", "frente", "data", "engenheiro", "encarregado", "rac", "tipo_registro",
                  "nao_conformidade", "medida_corretiva", "ver_agir", "plano_acao", "acompanhamento", "texto")
FIXOS = TIPOS_DE_CAMPO[:-1]  # todo modelo tem estes (o "texto" é campo livre, quantos quiser)
STATUS = ("rascunho", "adequada", "plano", "concluida")
ROTULO_STATUS = {"rascunho": "Rascunho", "adequada": "Adequada na hora", "plano": "Em plano de ação", "concluida": "Concluída"}


def _c(chave, rotulo, emoji, tipo=None, obrigatorio=True):
    return {"chave": chave, "rotulo": rotulo, "emoji": emoji, "tipo": tipo or chave, "obrigatorio": obrigatorio, "ativo": True}


MODELO_SEGURANCA = {
    "nome": "Inspeção de Segurança do Trabalho",
    "setor": "Segurança",
    "cabecalho": "INSPEÇÃO DE SEGURANÇA DO TRABALHO",
    "rodape": "Sem Segurança, não há obra!",
    "tipos": [
        {"nome": "Notificação", "registros": ["Descumprimento de procedimento", "Falta ou uso incorreto de EPI",
                                              "Documentação de SSMA irregular (PT/ART/APR)", "Organização e limpeza (5S)",
                                              "Sinalização e isolamento"]},
        {"nome": "Interdição", "registros": ["Risco grave e iminente", "Equipamento ou ferramenta sem condição de uso",
                                             "Trabalho em altura sem proteção", "Área sem isolamento", "Escavação sem escoramento"]},
        {"nome": "Inspeção", "registros": ["Condição insegura", "Ato inseguro", "Caminho seguro", "Áreas de vivência",
                                           "Boa prática"]},
        {"nome": "N3", "registros": ["Desvio de alto potencial (N3)", "Quase acidente", "Reincidência"]},
    ],
    "campos": [
        _c("tipo_auditoria", "Tipo de auditoria", "📋"),
        _c("frente", "Local / Frente", "📍"),
        _c("data", "Data", "📅"),
        _c("engenheiro", "Eng.º Responsável", "👷"),
        _c("encarregado", "Encarregado Responsável", "👷"),
        _c("rac", "RAC", "🪪", obrigatorio=False),
        _c("tipo_registro", "Tipo de Registro", "🔎"),
        _c("nao_conformidade", "Não conformidades", "⚠️"),
        _c("medida_corretiva", "Medida Corretiva", "🛠️"),
        _c("ver_agir", "VER E AGIR", "👀"),
        _c("plano_acao", "Plano de Ação", "📌"),
        _c("acompanhamento", "Responsável pelo acompanhamento", "👷"),
    ],
}


def validar_config(cfg: dict) -> dict:
    """Confere e normaliza o modelo (tipos e registros sem repetir, campos fixos presentes uma vez cada)."""
    if not isinstance(cfg, dict):
        raise DomainError("modelo inválido")
    nome = " ".join(str(cfg.get("nome") or "").split())
    if len(nome) < 3:
        raise DomainError("dê um nome ao modelo", "nome")
    tipos = []
    for t in cfg.get("tipos") or []:
        n = " ".join(str(t.get("nome") or "").split())
        regs = [r for r in dict.fromkeys(" ".join(str(x).split()) for x in (t.get("registros") or [])) if r]
        if n:
            if any(x["nome"].casefold() == n.casefold() for x in tipos):
                raise DomainError(f"tipo de auditoria repetido: {n}", "tipos")
            if not regs:
                raise DomainError(f"o tipo {n} precisa de pelo menos um tipo de registro", "tipos")
            tipos.append({"nome": n[:60], "registros": [r[:120] for r in regs]})
    if not tipos:
        raise DomainError("o modelo precisa de pelo menos um tipo de auditoria", "tipos")
    campos, vistos = [], set()
    for i, c in enumerate(cfg.get("campos") or []):
        tipo = c.get("tipo")
        if tipo not in TIPOS_DE_CAMPO:
            raise DomainError(f"campo de tipo desconhecido: {tipo}", "campos")
        chave = c.get("chave") if tipo != "texto" else (c.get("chave") or f"texto_{i}")
        if tipo != "texto":
            chave = tipo
        if chave in vistos:
            raise DomainError(f"campo repetido: {c.get('rotulo') or chave}", "campos")
        vistos.add(chave)
        rotulo = " ".join(str(c.get("rotulo") or "").split())[:80] or chave
        campos.append({"chave": chave, "rotulo": rotulo, "emoji": str(c.get("emoji") or "")[:8], "tipo": tipo,
                       "obrigatorio": bool(c.get("obrigatorio")), "ativo": bool(c.get("ativo", True))})
    faltam = [t for t in FIXOS if t not in vistos]
    if faltam:
        raise DomainError(f"faltam campos do modelo: {', '.join(faltam)}", "campos")
    for c in campos:  # campos que a regra exige não podem ficar desligados
        if c["tipo"] in ("tipo_auditoria", "frente", "data", "nao_conformidade", "ver_agir"):
            c["ativo"] = c["obrigatorio"] = True
    return {"nome": nome[:120], "setor": " ".join(str(cfg.get("setor") or "").split())[:60] or None,
            "cabecalho": str(cfg.get("cabecalho") or "")[:150], "rodape": str(cfg.get("rodape") or "")[:200],
            "tipos": tipos, "campos": campos}


def pendencias(cfg: dict, r: dict, fotos_antes: int, fotos_depois: int) -> list[str]:
    """O que falta para enviar o registro (vazio = pode finalizar)."""
    falta = []
    ativos = {c["tipo"]: c for c in cfg["campos"] if c["ativo"]}
    tipo = next((t for t in cfg["tipos"] if t["nome"] == r.get("tipo")), None)
    if tipo is None:
        falta.append("tipo de auditoria")
    elif "tipo_registro" in ativos and ativos["tipo_registro"]["obrigatorio"] and r.get("tipo_registro") not in tipo["registros"]:
        falta.append("tipo de registro")
    if not r.get("area_id") and not r.get("area_texto"):
        falta.append("local / frente")
    if not r.get("data"):
        falta.append("data")
    for k, rot in (("engenheiro", "Eng.º responsável"), ("encarregado", "encarregado responsável"), ("rac", "RAC"),
                   ("medida_corretiva", "medida corretiva"), ("acompanhamento", "responsável pelo acompanhamento")):
        if k in ativos and ativos[k]["obrigatorio"] and not (r.get(k) or "").strip():
            falta.append(rot)
    if len((r.get("nao_conformidade") or "").strip()) < 3:
        falta.append("descrição da não conformidade")
    for c in cfg["campos"]:
        if c["tipo"] == "texto" and c["ativo"] and c["obrigatorio"] and not str((r.get("respostas") or {}).get(c["chave"]) or "").strip():
            falta.append(c["rotulo"])
    if r.get("ver_agir") is None:
        falta.append("VER E AGIR (sim ou não)")
    if fotos_antes < 1:
        falta.append("foto da não conformidade")
    if r.get("ver_agir") is True and fotos_depois < 1:
        falta.append("foto do depois (adequação)")
    if r.get("ver_agir") is False:
        if not (r.get("plano_responsavel") or "").strip():
            falta.append("responsável do plano de ação")
        if not r.get("plano_prazo"):
            falta.append("prazo do plano de ação")
    return falta


def _d(v) -> str:
    return v.strftime("%d/%m/%Y") if isinstance(v, date) else (date.fromisoformat(v).strftime("%d/%m/%Y") if v else "—")


def texto_envio(cfg: dict, r: dict, obra: str | None = None, contratada: str | None = None) -> str:
    """Texto do registro para o WhatsApp, na ordem e com os rótulos/emojis do modelo (negrito do WhatsApp com *)."""
    linhas = []
    if cfg.get("cabecalho"):
        linhas.append(f"*{cfg['cabecalho']}*")
    if contratada:
        linhas.append(f"*Empresa:* {contratada}")
    if obra:
        linhas.append(f"*Obra:* {obra}")
    if linhas:
        linhas.append("")
    for c in cfg["campos"]:
        if not c["ativo"]:
            continue
        e = f"{c['emoji']} " if c["emoji"] else ""
        rot = f"{e}*{c['rotulo']}:*"
        t = c["tipo"]
        if t == "tipo_auditoria":
            num = f" · Nº {r['numero']}" if r.get("numero") else ""
            linhas.append(f"{e}*{r.get('tipo') or '—'}*{num}")
        elif t == "frente":
            linhas.append(f"{rot} {' / '.join(x for x in (r.get('local'), r.get('area_texto')) if x) or '—'}")
        elif t == "data":
            linhas.append(f"{rot} {_d(r.get('data'))}")
        elif t in ("engenheiro", "encarregado", "rac", "tipo_registro", "acompanhamento"):
            if t == "rac" and not r.get("rac"):
                continue
            linhas.append(f"{rot} {r.get(t) or '—'}")
        elif t in ("nao_conformidade", "medida_corretiva"):
            linhas.append(f"{rot} {r.get(t) or '—'}")
        elif t == "ver_agir":
            v = r.get("ver_agir")
            linhas.append(f"{rot} {'SIM — corrigido na hora (fotos de antes e depois)' if v else 'NÃO — segue plano de ação' if v is False else '—'}")
        elif t == "plano_acao":
            if r.get("ver_agir") is False:
                linhas += [rot, f"• Responsável: {r.get('plano_responsavel') or '—'}", f"• Prazo: {_d(r.get('plano_prazo'))}"]
        elif t == "texto":
            v = (r.get("respostas") or {}).get(c["chave"])
            if v:
                linhas.append(f"{rot} {v}")
        linhas.append("")
    while linhas and not linhas[-1]:
        linhas.pop()
    if r.get("auditor"):
        linhas += ["", f"_Registrado por {r['auditor']}_"]
    if cfg.get("rodape"):
        linhas += ["", f'"{cfg["rodape"]}"']
    return "\n".join(linhas)
