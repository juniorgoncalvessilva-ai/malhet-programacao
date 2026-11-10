"""Composição de Custo Unitário da obra (relatório "COMPOSIÇÃO DE PREÇOS UNITÁRIOS" do orçamento).

O relatório é hierárquico e só detalha cada composição auxiliar na PRIMEIRA vez em que ela aparece:

    Serviço da Planilha: 1.08.03.01.02 - Concreto ... fck = 30 MPa   M3  4412,45      ← item da PQ
      154 - Composição: ESP.48.155 - Concreto ...                                    ← composição principal
        25.CONC.BOMB.30MP.001  Concreto bombeável 30 Mpa   M3  0,97  714,82  693,38 ← insumo
        ESP.48.330             Lançamento do concreto      M3  1,00  246,11  246,11 ← composição auxiliar
      Total do item: ... 1002,68
      88.5.1 - Composição: ESP.48.330 - Lançamento do concreto                       ← detalhe da auxiliar
        MOD.01.009  Pedreiro  HH  1,30 ...
      Total da Composição Auxiliar: 246,11

Daqui sai, para cada composição, o coeficiente "achatado" (h por unidade do serviço) de cada função de mão de
obra (insumo em HH) e de cada equipamento (insumo em H), multiplicando os coeficientes pela árvore de auxiliares.
É a mesma grandeza da CPU da planilha auxiliar, então índice, HH, recurso que governa e gargalo continuam iguais.
"""
import re
from dataclasses import dataclass, field

from app.shared.errors import DomainError

UNID_MOD = {"HH"}
UNID_EQU = {"H", "HM", "HP", "HI", "CHP", "CHI"}
# Não governam o ritmo (são apoio do oficial): ficam no HH, mas fora da escolha do recurso que governa.
_APOIO = re.compile(r"^(servente|ajudante|auxiliar|meio[- ]oficial|encarregad|apontador|vigia|feitor)", re.I)
_CODIGO = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/-]*$")


@dataclass(frozen=True)
class LinhaCpu:
    codigo: str
    descricao: str
    unid: str | None
    quantidade: float
    preco: float | None = None


@dataclass(frozen=True)
class Composicao:
    codigo: str
    descricao: str
    linhas: tuple[LinhaCpu, ...]
    custo: float | None = None


@dataclass(frozen=True)
class ServicoPq:
    item: str  # já normalizado (1.8.3.1.2)
    item_original: str  # como está no relatório (1.08.03.01.02)
    descricao: str
    unid: str | None
    quantidade: float | None
    composicao: str | None
    custo_unitario: float | None


@dataclass(frozen=True)
class RecursoAchatado:
    recurso: str
    tipo: str  # MOD | EQU
    unid: str
    coef_por_unidade: float  # h/un do serviço


@dataclass
class Relatorio:
    composicoes: dict[str, Composicao] = field(default_factory=dict)
    servicos: list[ServicoPq] = field(default_factory=list)
    avisos: list[str] = field(default_factory=list)


def normalizar_item(cod: str) -> str:
    """1.08.03.01.02 → 1.8.3.1.2 (como a PQ do take-off escreve)."""
    partes = [p for p in str(cod).strip().split(".") if p != ""]
    if not partes:
        raise DomainError("item de PQ vazio")
    return ".".join(str(int(p)) if p.isdigit() else p for p in partes)


def tipo_do_insumo(unid: str | None) -> str | None:
    u = (unid or "").strip().upper()
    if u in UNID_MOD:
        return "MOD"
    if u in UNID_EQU:
        return "EQU"
    return None


def nome_recurso(descricao: str) -> str:
    """'* Encarregado de pedreiro' → 'Encarregado de pedreiro' (o * marca insumo sem custo no orçamento)."""
    t = re.sub(r"\s+", " ", descricao.lstrip("* ").strip())
    t = re.sub(r"^(salário hora|hora normal)\s*-\s*", "", t, flags=re.I)
    return t[:1].upper() + t[1:].lower() if t.isupper() else t


def eh_apoio(recurso: str) -> bool:
    return bool(_APOIO.match(recurso.strip()))


# ---- leitura do relatório (linhas da planilha já como listas de células) ----------------------------------
def _vazio(v) -> bool:
    return v is None or (isinstance(v, str) and not v.strip())


def _num(v) -> float | None:
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str) and v.strip():
        t = v.strip().replace(".", "").replace(",", ".") if "," in v else v.strip()
        try:
            return float(t)
        except ValueError:
            return None
    return None


def _celulas(linha: list) -> list:
    return [c.strip() if isinstance(c, str) else c for c in linha if not _vazio(c) and c != "-" and str(c).strip() != "-"]


def _depois(cels: list, marcador: str) -> list:
    for i, c in enumerate(cels):
        if isinstance(c, str) and marcador in c:
            return cels[i + 1:]
    return []


def interpretar(linhas: list[list]) -> Relatorio:
    """Lê o relatório linha a linha (sem depender da coluna exata de cada campo)."""
    rel = Relatorio()
    atual: dict | None = None  # composição sendo lida
    servico: dict | None = None  # item da PQ aguardando a composição principal / total

    def fechar(custo: float | None = None) -> None:
        nonlocal atual
        if atual is None:
            return
        cod = atual["codigo"]
        if cod not in rel.composicoes or not rel.composicoes[cod].linhas:
            rel.composicoes[cod] = Composicao(cod, atual["descricao"], tuple(atual["linhas"]), custo)
        atual = None

    for n, linha in enumerate(linhas, start=1):
        cels = _celulas(linha)
        if not cels:
            continue
        textos = [c for c in cels if isinstance(c, str)]
        if any("Serviço da Planilha" in t for t in textos):
            fechar()
            resto = _depois(cels, "Serviço da Planilha")
            if not resto:
                rel.avisos.append(f"linha {n}: item da PQ sem código")
                continue
            nums = [x for x in resto[1:] if isinstance(x, (int, float))]
            txt = [x for x in resto[1:] if isinstance(x, str)]
            servico = {"item": str(resto[0]), "descricao": txt[0] if txt else "", "unid": txt[1] if len(txt) > 1 else None,
                       "quantidade": nums[-1] if nums else None, "composicao": None}
            continue
        if any("Composição:" in t and "Auxiliar" not in t for t in textos):
            fechar()
            resto = [x for x in _depois(cels, "Composição:") if isinstance(x, str)]
            if not resto:
                rel.avisos.append(f"linha {n}: composição sem código")
                continue
            atual = {"codigo": resto[0], "descricao": resto[1] if len(resto) > 1 else "", "linhas": []}
            if servico is not None and servico["composicao"] is None:
                servico["composicao"] = resto[0]
            continue
        if any(t.startswith("Total do item") for t in textos):
            nums = [x for x in cels if isinstance(x, (int, float))]
            custo = nums[-1] if nums else None
            fechar(custo)
            if servico is not None:
                try:
                    item = normalizar_item(servico["item"])
                except DomainError:
                    item = servico["item"]
                rel.servicos.append(ServicoPq(item, servico["item"], servico["descricao"], servico["unid"],
                                              servico["quantidade"], servico["composicao"], custo))
                servico = None
            continue
        if any(t.startswith("Total da Composição Auxiliar") for t in textos):
            nums = [x for x in cels if isinstance(x, (int, float))]
            fechar(nums[-1] if nums else None)
            continue
        if atual is None:
            continue
        cod = cels[0]
        if not isinstance(cod, str) or cod.endswith(":") or cod in ("Código",) or not _CODIGO.match(cod):
            continue
        if len(cels) < 4 or not isinstance(cels[1], str):
            continue
        unid = cels[2] if isinstance(cels[2], str) else None
        nums = [_num(x) for x in cels[2:] if _num(x) is not None]
        if not nums:
            continue
        atual["linhas"].append(LinhaCpu(cod, cels[1], unid, nums[0], nums[1] if len(nums) > 1 else None))
    fechar()
    if not rel.composicoes:
        raise DomainError("não encontrei composições: o arquivo é o relatório 'Composição de Preços Unitários'?")
    return rel


# ---- achatamento ------------------------------------------------------------------------------------------
def achatar(composicoes: dict[str, Composicao], codigo: str) -> list[RecursoAchatado]:
    """h/un de cada função (HH) e equipamento (H) da composição, descendo pelas auxiliares."""
    memo: dict[str, dict[tuple[str, str, str], float]] = {}

    def desce(cod: str, pilha: tuple[str, ...]) -> dict[tuple[str, str, str], float]:
        if cod in memo:
            return memo[cod]
        if cod in pilha:
            raise DomainError(f"composição {cod} referencia a si mesma ({' → '.join(pilha + (cod,))})")
        out: dict[tuple[str, str, str], float] = {}
        for ln in composicoes[cod].linhas:
            tipo = tipo_do_insumo(ln.unid)
            # linha em HH/H é a função/equipamento (mesmo que o código também seja composição: o "Servente" se
            # abre em hora normal, improdutiva, abono… — custo, não horas de programação)
            if tipo is None and ln.codigo in composicoes and ln.codigo != cod:
                for k, v in desce(ln.codigo, pilha + (cod,)).items():
                    out[k] = out.get(k, 0.0) + v * ln.quantidade
                continue
            if tipo is None or not ln.quantidade:
                continue
            k = (nome_recurso(ln.descricao), tipo, (ln.unid or "").upper())
            out[k] = out.get(k, 0.0) + ln.quantidade
        memo[cod] = out
        return out

    if codigo not in composicoes:
        raise DomainError(f"composição {codigo} não está no relatório")
    return sorted((RecursoAchatado(r, t, u, round(c, 6)) for (r, t, u), c in desce(codigo, ()).items() if c > 0),
                  key=lambda x: (x.tipo != "MOD", -x.coef_por_unidade))


def recurso_que_governa(recursos: list[RecursoAchatado]) -> RecursoAchatado | None:
    """Oficial de maior h/un (servente, ajudante, encarregado são apoio); sem oficial, maior MOD; sem MOD, EQU."""
    mod = [r for r in recursos if r.tipo == "MOD" and r.coef_por_unidade > 0]
    oficiais = [r for r in mod if not eh_apoio(r.recurso)]
    pool = oficiais or mod or [r for r in recursos if r.coef_por_unidade > 0]
    return max(pool, key=lambda r: r.coef_por_unidade) if pool else None
