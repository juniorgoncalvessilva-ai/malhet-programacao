"""Equipamentos da obra (spec 147): cadastro pela planilha da obra, operador do efetivo, mobilização/desmobilização e o
apontamento do dia (feito pelo apontador no campo).

Planilha modelo ("PLANILHA DE EQUIPAMENTOS"): cabeçalho achado pelos nomes — Nome do Equipamento | Operadores | Tipo |
Placa | TAG | Chassi | Mobilizado | Data mobilização. A chave do equipamento é a TAG (sem ela, a placa; sem as duas, o
chassi): reimportar atualiza, nunca duplica nem apaga. Operador vem só pelo primeiro nome ("SANDRO", "GLAUBER/PEDRO"):
liga sozinho ao efetivo só quando um único operador/motorista ativo tem aquele nome; senão fica o texto e as sugestões.
"""
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime

from app.shared.errors import DomainError

COLUNAS = {
    "nome": ("NOME DO EQUIPAMENTO", "EQUIPAMENTO", "DESCRICAO", "NOME"),
    "operador": ("OPERADORES", "OPERADOR", "MOTORISTA", "MOTORISTAS"),
    "tipo": ("TIPO", "CATEGORIA", "CLASSE"),
    "placa": ("PLACA",),
    "tag": ("TAG", "PREFIXO", "CODIGO"),
    "chassi": ("CHASSI", "SERIE", "NUMERO DE SERIE", "N DE SERIE"),
    "mobilizado": ("MOBILIZADO", "SITUACAO", "STATUS"),
    "mobilizado_em": ("DATA MOBILIZACAO", "DATA DE MOBILIZACAO", "MOBILIZACAO", "DATA MOB"),
    "desmobilizado_em": ("DATA DESMOBILIZACAO", "DATA DE DESMOBILIZACAO", "DESMOBILIZACAO", "DATA DESMOB"),
}

SITUACOES = {"mobilizado": "Mobilizado", "desmobilizado": "Desmobilizado", "nao_mobilizado": "Ainda não mobilizado"}
# o que o apontador marca no dia para cada equipamento
DIA = {"operando": "Operando", "disposicao": "À disposição", "parado": "Parado", "manutencao": "Em manutenção"}
OPERA = re.compile(r"OPERADOR|MOTORISTA|TRATORISTA|MAQUINISTA|OPER\.", re.I)


def norm(t: object) -> str:
    s = unicodedata.normalize("NFKD", str(t or "")).encode("ascii", "ignore").decode().upper()
    return " ".join(re.sub(r"[^A-Z0-9 ]+", " ", s).split())


def chave(tag: str | None, placa: str | None, chassi: str | None) -> str:
    for v in (tag, placa, chassi):
        k = re.sub(r"[^A-Z0-9]", "", (v or "").upper())
        if k:
            return k[:60]
    return ""


def _texto(v: object, limite: int = 120) -> str | None:
    t = " ".join(str(v or "").split())
    return t[:limite] or None


def _data(v: object) -> date | None:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    t = str(v or "").strip()
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", t)
    if m:
        d, mes, a = (int(x) for x in m.groups())
        try:
            return date(a + 2000 if a < 100 else a, mes, d)
        except ValueError:
            return None
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", t)
    if m:
        try:
            return date(*(int(x) for x in m.groups()))
        except ValueError:
            return None
    return None


def situacao_da_planilha(mobilizado: object, data_mob: date | None, data_desmob: date | None) -> str:
    """SIM → mobilizado; NÃO com data (ou com data de desmobilização) → desmobilizado (já esteve na obra); NÃO sem data →
    ainda não mobilizado. Coluna vazia: a data decide."""
    t = norm(mobilizado)
    if data_desmob:
        return "desmobilizado"
    if t.startswith("S") or t.startswith("MOBILIZ"):
        return "mobilizado"
    if t.startswith("N") or t.startswith("DESMOB"):
        return "desmobilizado" if data_mob else "nao_mobilizado"
    return "mobilizado" if data_mob else "nao_mobilizado"


@dataclass(frozen=True)
class LinhaEquipamento:
    linha: int
    nome: str
    tipo: str | None
    placa: str | None
    tag: str | None
    chassi: str | None
    operador: str | None  # como veio ("GLAUBER/PEDRO")
    situacao: str
    mobilizado_em: date | None
    desmobilizado_em: date | None

    @property
    def chave(self) -> str:
        return chave(self.tag, self.placa, self.chassi)

    @property
    def operadores(self) -> list[str]:
        return [x for x in (" ".join(p.split()) for p in re.split(r"[/,;]| E ", (self.operador or "").upper())) if x]


@dataclass
class Leitura:
    itens: list[LinhaEquipamento]
    avisos: list[str] = field(default_factory=list)


def _cabecalho(linhas: list[tuple]) -> tuple[int, dict[str, int]] | None:
    for i, row in enumerate(linhas[:30]):
        nomes = [norm(c) for c in row]
        col: dict[str, int] = {}
        for campo, sins in COLUNAS.items():
            for j, n in enumerate(nomes):
                if n and n in sins and campo not in col and j not in col.values():
                    col[campo] = j
        if "nome" in col and ("tag" in col or "placa" in col):
            return i, col
    return None


def ler(linhas: list[tuple]) -> Leitura:
    cab = _cabecalho(linhas)
    if cab is None:
        return Leitura([], ["não achei o cabeçalho (Nome do Equipamento e TAG ou Placa)"])
    h, col = cab
    pega = lambda row, k: row[col[k]] if k in col and col[k] < len(row) else None  # noqa: E731
    itens: list[LinhaEquipamento] = []
    avisos: list[str] = []
    vistos: dict[str, int] = {}
    for i, row in enumerate(linhas[h + 1:], start=h + 2):
        row = tuple(row)
        if not any(c is not None and str(c).strip() for c in row):
            continue
        nome = _texto(pega(row, "nome"))
        tag, placa, chassi = _texto(pega(row, "tag"), 40), _texto(pega(row, "placa"), 20), _texto(pega(row, "chassi"), 40)
        if not nome and not (tag or placa):
            continue
        if not chave(tag, placa, chassi):
            avisos.append(f"linha {i}: {nome or 'equipamento'} sem TAG, placa ou chassi — não entrou")
            continue
        mob, desmob = _data(pega(row, "mobilizado_em")), _data(pega(row, "desmobilizado_em"))
        x = LinhaEquipamento(i, nome or (tag or placa or ""), _texto(pega(row, "tipo"), 40), placa, tag, chassi,
                             _texto(pega(row, "operador")), situacao_da_planilha(pega(row, "mobilizado"), mob, desmob),
                             mob, desmob)
        if x.chave in vistos:
            avisos.append(f"linha {i}: TAG {tag or placa} repetida (linha {vistos[x.chave]}) — vale a primeira")
            continue
        vistos[x.chave] = i
        itens.append(x)
    return Leitura(itens, avisos)


@dataclass(frozen=True)
class PessoaRef:
    id: int
    nome: str
    funcao: str | None
    matricula: str | None = None


def casar_operador(texto: str | None, pessoas: list[PessoaRef]) -> tuple[int | None, list[PessoaRef]]:
    """Operador da planilha → pessoa do efetivo. Liga (id) só quando um único operador/motorista tem esse nome (primeiro
    nome ou o nome todo); senão devolve as sugestões (operadores primeiro) para a pessoa escolher."""
    nomes = [n for n in (norm(x) for x in re.split(r"[/,;]", texto or "")) if n]
    if not nomes:
        return None, []
    alvo = nomes[0]
    partes = alvo.split()

    def bate(p: PessoaRef) -> bool:
        n = norm(p.nome).split()
        return bool(n) and (n[:len(partes)] == partes if len(partes) > 1 else n[0] == alvo)

    achados = [p for p in pessoas if bate(p)]
    operadores = [p for p in achados if OPERA.search(p.funcao or "")]
    if len(operadores) == 1:
        return operadores[0].id, operadores
    if not operadores and len(achados) == 1 and len(partes) > 1:  # nome completo e único: liga
        return achados[0].id, achados
    return None, (operadores + [p for p in achados if p not in operadores])[:6]


def validar_movimento(situacao_atual: str, para: str, data: date, ultima: date | None) -> None:
    if para == "mobilizado" and situacao_atual == "mobilizado":
        raise DomainError("o equipamento já está mobilizado", "situacao")
    if para == "desmobilizado" and situacao_atual != "mobilizado":
        raise DomainError("só desmobiliza equipamento mobilizado", "situacao")
    if ultima and data < ultima:
        raise DomainError(f"a data não pode ser antes da última movimentação ({ultima.strftime('%d/%m/%Y')})", "data")


def validar_apontamento(situacao: str, horas: float | None, observacao: str | None) -> tuple[str, float | None, str | None]:
    if situacao not in DIA:
        raise DomainError(f"situação do dia: {', '.join(DIA.values())}", "situacao")
    if horas is not None and not 0 <= horas <= 24:
        raise DomainError("horas entre 0 e 24", "horas")
    obs = " ".join((observacao or "").split())[:300] or None
    if situacao in ("parado", "manutencao") and not obs:
        raise DomainError("diga o motivo (parado ou em manutenção)", "observacao")
    return situacao, horas, obs


def dias_mobilizado(mobilizado_em: date | None, ate: date, desmobilizado_em: date | None = None) -> int | None:
    """Dias na obra: da mobilização até hoje (ou até a desmobilização), contando os dois dias."""
    if mobilizado_em is None:
        return None
    fim = desmobilizado_em or ate
    return max(0, (fim - mobilizado_em).days + 1)
