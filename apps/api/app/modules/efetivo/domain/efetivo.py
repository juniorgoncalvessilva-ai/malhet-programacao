"""Efetivo da obra e mobilização (planilha "EFETIVO GERAL" do DP).

A **matrícula** é a chave: reimportar toda semana atualiza nome, função e situação sem perder a equipe de cada um.
- Aba principal (efetivo próprio): matrícula "115.011" → 115011, que é também o crachá do Simova.
- Abas de terceiros (Automade, Geotrha…): a matrícula é da empresa → chave "EMPRESA:matrícula".
- Sem matrícula (candidato em processo): chave provisória pelo nome; quando a matrícula chega, o registro é o mesmo.

Só guardamos o necessário para efetivo e equipes. CPF, PIS, endereço, telefone, nascimento e nome da mãe NÃO entram.
"""
import re
import unicodedata
from dataclasses import dataclass
from datetime import date, timedelta
from enum import StrEnum

from app.shared.errors import DomainError

EMPRESA_PROPRIA = "Própria"


class Situacao(StrEnum):
    MOBILIZADO = "MOBILIZADO"
    AGUARDANDO_CRACHA = "AGUARDANDO_CRACHA"
    EM_PROCESSO = "EM_PROCESSO"  # exame admissional, documentação
    PREVISTO = "PREVISTO"  # data prevista de mobilização na coluna STATUS
    AFASTADO = "AFASTADO"
    DESMOBILIZADO = "DESMOBILIZADO"  # demitido / desligado
    DESISTENCIA = "DESISTENCIA"

    @property
    def rotulo(self) -> str:
        return {"MOBILIZADO": "Mobilizado", "AGUARDANDO_CRACHA": "Aguardando crachá", "EM_PROCESSO": "Em processo",
                "PREVISTO": "Mobilização prevista", "AFASTADO": "Afastado", "DESMOBILIZADO": "Desmobilizado",
                "DESISTENCIA": "Desistência"}[self.value]

    @property
    def em_mobilizacao(self) -> bool:
        return self in (Situacao.AGUARDANDO_CRACHA, Situacao.EM_PROCESSO, Situacao.PREVISTO)

    @property
    def ativo(self) -> bool:
        """Conta no efetivo da obra (mobilizado ou afastado temporariamente)."""
        return self in (Situacao.MOBILIZADO, Situacao.AFASTADO)


def chave_texto(t: str | None) -> str:
    s = unicodedata.normalize("NFD", t or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " ".join(s.upper().split())


def normalizar_matricula(v) -> str | None:
    """'115.011' → '115011'; 1441.0 → '1441'; texto (DESISTIU 09/11, não atende) → None."""
    if v is None:
        return None
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() and v > 0 else None
    if isinstance(v, int):
        return str(v) if v > 0 else None
    t = str(v).strip().replace(".", "").replace(" ", "")
    if t.endswith(",0"):
        t = t[:-2]
    return t if t.isdigit() and int(t) > 0 else None


def _data(v) -> date | None:
    if v in (None, ""):
        return None
    if isinstance(v, date):
        return v
    if isinstance(v, (int, float)) and 20000 < float(v) < 80000:  # data serial do Excel
        return date(1899, 12, 30) + timedelta(days=int(v))
    t = str(v).strip()
    for fmt in ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d"):
        try:
            from datetime import datetime

            return datetime.strptime(t[:10], fmt).date()
        except ValueError:
            continue
    return None


def _sim(v) -> bool | None:
    t = chave_texto(str(v) if v is not None else "")
    return True if t == "SIM" else False if t in ("NAO", "N") else None


def situacao_da_linha(status, tipo_mo: str | None, demissao, matricula_bruta,
                      tem_status: bool = True) -> tuple["Situacao", date | None]:
    """Situação de mobilização a partir das colunas STATUS, Tipo de MO, DEMISSÃO e MATRÍCULA da planilha."""
    st = chave_texto(str(status) if status not in (None, "") and not isinstance(status, float) else "")
    if "DESIST" in chave_texto(str(matricula_bruta or "")) or "DESIST" in st:
        return Situacao.DESISTENCIA, None
    dem_txt = chave_texto(str(demissao)) if isinstance(demissao, str) else ""
    if st == "DEM" or chave_texto(tipo_mo) == "DEM" or _data(demissao) or dem_txt.startswith("DESLIG"):
        return Situacao.DESMOBILIZADO, None
    if isinstance(status, (int, float)) and status not in ("",):
        prevista = _data(status)
        if prevista:
            return Situacao.PREVISTO, prevista
    if st in ("V", "ATIVO", "MOBILIZADO"):
        return Situacao.MOBILIZADO, None
    if st.startswith("CRACHA"):
        return Situacao.AGUARDANDO_CRACHA, None
    if st == "AF" or st.startswith("AFAST"):
        return Situacao.AFASTADO, None
    if st or tem_status:
        # EXAME, BC, EC, G… (o código original fica guardado); STATUS em branco na aba própria = candidato
        return Situacao.EM_PROCESSO, None
    return Situacao.MOBILIZADO, None  # abas de terceiros não têm STATUS: na lista e sem demissão = mobilizado


@dataclass(frozen=True)
class ColaboradorLido:
    chave: str
    empresa: str
    matricula: str | None
    cracha: str | None  # crachá do Simova (efetivo próprio = matrícula)
    nome: str
    funcao: str | None
    dp: str | None
    tipo_mo: str | None
    status_original: str | None
    situacao: Situacao
    mobilizacao_prevista: date | None
    admissao: date | None
    demissao: date | None
    cracha_vale: str | None
    rac2: bool | None
    paebm: bool | None

    def __post_init__(self) -> None:
        if not self.nome.strip():
            raise DomainError("colaborador sem nome")


_COLUNAS = {
    "MATRICULA": "matricula", "NOME": "nome", "FUNCAO": "funcao", "DP": "dp", "TIPO DE MO": "tipo_mo",
    "STATUS": "status", "ADMISSAO": "admissao", "DEMISSAO": "demissao", "VALE": "vale", "RAC 2": "rac2",
    "PAEBM": "paebm",
}


def chave_provisoria(empresa: str, nome: str) -> str:
    return f"{chave_texto(empresa)}:NOME:{chave_texto(nome)}"[:120]


def interpretar_aba(nome_aba: str, linhas: list[list], principal: bool) -> list[ColaboradorLido]:
    """Uma aba da planilha de efetivo. Cabeçalho na 1ª linha que tiver NOME e FUNÇÃO."""
    cab, cols = None, {}
    for i, ln in enumerate(linhas[:10]):
        achados = {}
        for j, c in enumerate(ln):
            k = chave_texto(str(c)) if c is not None else ""
            if k in _COLUNAS and _COLUNAS[k] not in achados:
                achados[_COLUNAS[k]] = j
        if {"nome", "funcao"} <= set(achados):
            cab, cols = i, achados
            break
    if cab is None:
        return []
    empresa = EMPRESA_PROPRIA if principal else " ".join(nome_aba.split()).title()
    out: list[ColaboradorLido] = []
    for ln in linhas[cab + 1:]:
        def cel(k):
            j = cols.get(k)
            return ln[j] if j is not None and j < len(ln) else None
        nome = " ".join(str(cel("nome") or "").split())
        if not nome or nome.replace(".", "").isdigit():
            continue
        mat_bruta = cel("matricula")
        mat = normalizar_matricula(mat_bruta)
        situacao, prevista = situacao_da_linha(cel("status"), cel("tipo_mo"), cel("demissao"), mat_bruta,
                                               tem_status="status" in cols)
        if principal:
            chave = mat or chave_provisoria(empresa, nome)
        else:
            chave = f"{chave_texto(empresa)}:{mat}" if mat else chave_provisoria(empresa, nome)
        vale = cel("vale")
        vale_txt = normalizar_matricula(vale) if isinstance(vale, (int, float)) else None
        status = cel("status")
        out.append(ColaboradorLido(
            chave=chave, empresa=empresa, matricula=mat, cracha=mat if principal else None, nome=nome[:150],
            funcao=(" ".join(str(cel("funcao") or "").split()) or None),
            dp=(re.sub(r"^DP\s*", "DP ", " ".join(str(cel("dp") or "").split()).upper()) or None),
            tipo_mo=(" ".join(str(cel("tipo_mo") or "").split()).upper() or None),
            status_original=(None if status in (None, "") else (_data(status).strftime("%d/%m/%Y") if isinstance(status, float) and _data(status) else str(status).strip()[:30])),
            situacao=situacao, mobilizacao_prevista=prevista, admissao=_data(cel("admissao")),
            demissao=_data(cel("demissao")), cracha_vale=vale_txt, rac2=_sim(cel("rac2")), paebm=_sim(cel("paebm"))))
    return out


def interpretar_planilha(abas: list[tuple[str, list[list]]]) -> list[ColaboradorLido]:
    """1ª aba = efetivo próprio; as demais = terceiros (nome da aba = empresa). Chave repetida: fica a 1ª."""
    if not abas:
        raise DomainError("planilha vazia")
    vistos: dict[str, ColaboradorLido] = {}
    for i, (nome, linhas) in enumerate(abas):
        for c in interpretar_aba(nome, linhas, principal=(i == 0)):
            vistos.setdefault(c.chave, c)
    if not vistos:
        raise DomainError("não achei colaboradores (cabeçalho com MATRÍCULA, NOME e FUNÇÃO)")
    return list(vistos.values())


# ---- de-para de funções --------------------------------------------------------------------------------
def sugerir_recurso(funcao: str, recursos: list[str]) -> str | None:
    """Função do efetivo → função da composição (CPU): igual, ou a da CPU com complemento ("CARPINTEIRO DE FORMAS"
    → Carpinteiro; "ARMADOR " → Armador). Ajudante/auxiliar só casam com nome igual."""
    def singular(t: str) -> str:  # FORMAS → FORMA (o DP e a CPU nem sempre concordam no plural)
        return " ".join(w[:-1] if len(w) > 3 and w.endswith("S") else w for w in chave_texto(t).split())

    f = singular(funcao)
    if not f:
        return None
    por_chave = {singular(r): r for r in recursos}
    if f in por_chave:
        return por_chave[f]
    candidatos = [(k, r) for k, r in por_chave.items() if f.startswith(k + " ")]
    if candidatos:
        return max(candidatos, key=lambda kr: len(kr[0]))[1]
    return None
