"""Lista de CWAs em Excel (spec 128): a planilha do empreendimento tem todas as áreas (abas CWA, SUB-CWA, CWP…), mas a
contratada só tem obrigação sobre parte delas — essas ficam numa aba própria (ex.: "CWAs Cardan"), com a coluna Empresa.
As áreas da contratada são a WBS de execução: viram as Frentes (Local → Área) e entram sozinhas na WBS.

Layout lido pelos nomes do cabeçalho (posição livre): ÁREA | CWA | SUBCWA | CONCATENADO | ATIVO | CWA Atualizada (descrição) |
Lado | Situação | Empresa. Linha só com a descrição (sem CWA) é o Local que agrupa as linhas seguintes ("Novo CMD",
"Nova Oficina"); área antes de qualquer Local fica no Local "Geral". Linha com Situação diferente de "Ativa" fica de fora.
"""
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass, field


def _norm(t) -> str:
    s = unicodedata.normalize("NFKD", str(t or "")).encode("ascii", "ignore").decode().upper()
    return " ".join(re.sub(r"[^A-Z0-9]+", " ", s).split())


def _txt(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return " ".join(str(v).split())


@dataclass(frozen=True)
class LinhaCwa:
    cwa: str
    ativo: str | None
    descricao: str
    local: str
    empresa: str
    linha: int


@dataclass
class AbaCwa:
    nome: str
    linhas: list[LinhaCwa] = field(default_factory=list)
    inativas: int = 0

    @property
    def empresas(self) -> dict[str, int]:
        return dict(Counter(x.empresa for x in self.linhas).most_common())


_SEM = {"", "-", "–", "—", "N/A", "NA"}


def _cabecalho(linhas: list[tuple]) -> tuple[int, dict[str, int]] | None:
    for n, lin in enumerate(linhas[:20]):
        nomes = [_norm(c) for c in lin]
        idx: dict[str, int] = {}
        for j, x in enumerate(nomes):
            if x == "CONCATENADO":
                idx["concatenado"] = j
            elif x in ("CWA", "CWA SUB CWA") and "cwa" not in idx:
                idx["cwa"] = j
            elif x in ("SUBCWA", "SUB CWA"):
                idx["sub"] = j
            elif x == "ATIVO":
                idx["ativo"] = j
            elif x in ("CWA ATUALIZADA", "DESCRITIVO", "DESCRICAO", "DESCRICAO CWA") and "descricao" not in idx:
                idx["descricao"] = j
            elif x == "SITUACAO":
                idx["situacao"] = j
            elif x in ("EMPRESA", "CONTRATADA", "EXECUTANTE"):
                idx["empresa"] = j
        if "descricao" in idx and ("concatenado" in idx or "cwa" in idx) and ("ativo" in idx or "empresa" in idx):
            return n, idx
    return None


def ler_aba(nome: str, linhas: list[tuple]) -> AbaCwa | None:
    cab = _cabecalho(linhas)
    if cab is None:
        return None
    n0, idx = cab
    aba = AbaCwa(nome=nome)
    local = "Geral"
    for k, lin in enumerate(linhas[n0 + 1:], start=n0 + 2):
        val = lambda c: _txt(lin[idx[c]]) if c in idx and idx[c] < len(lin) else ""  # noqa: E731
        desc = val("descricao")
        cwa = val("concatenado")
        if not cwa and val("cwa") and re.fullmatch(r"\d{1,3}", val("cwa")):
            cwa = f"{int(val('cwa')):03d}" + (f".{int(val('sub')):02d}" if re.fullmatch(r"\d{1,2}", val("sub")) else "")
        if not cwa or cwa in _SEM:
            if desc and desc not in _SEM:
                local = desc  # linha de agrupamento: o Local
            continue
        if "situacao" in idx and val("situacao") and _norm(val("situacao")) not in ("ATIVA", "ATIVO"):
            aba.inativas += 1
            continue
        ativo = val("ativo").replace(" ", "").upper()
        aba.linhas.append(LinhaCwa(cwa=cwa, ativo=None if ativo in _SEM else ativo, descricao=desc or ativo or cwa, local=local,
                                   empresa=val("empresa") or "-", linha=k))
    return aba


def ler(abas: list[tuple[str, list[tuple]]]) -> list[AbaCwa]:
    return [a for nome, linhas in abas if (a := ler_aba(nome, linhas)) is not None and a.linhas]


def sugerir_aba(lidas: list[AbaCwa], contratada: str | None) -> tuple[AbaCwa | None, list[str]]:
    """A aba da contratada (nome da contratada no título ou na coluna Empresa) e as empresas a importar."""
    alvo = _norm(contratada)
    if not lidas:
        return None, []
    def nota(a: AbaCwa) -> tuple:
        return (bool(alvo) and alvo.split()[0] in _norm(a.nome), bool(alvo) and any(alvo.split()[0] in _norm(e) for e in a.empresas),
                len(a.empresas) > 1, len(a.linhas))
    aba = max(lidas, key=nota)
    empresas = [e for e in aba.empresas if alvo and alvo.split()[0] in _norm(e)] or [next(iter(aba.empresas))]
    return aba, empresas


def para_texto(aba: AbaCwa, empresas: list[str]) -> str:
    """No formato da lista colada (CWA | Ativo | DESCRICAO CWA | Local) — a mesma importação das Frentes."""
    linhas = ["CWA\tAtivo\tDESCRICAO CWA\tLocal"]
    for x in aba.linhas:
        if x.empresa in empresas:
            linhas.append("\t".join((x.cwa, x.ativo or "-", x.descricao, x.local)))
    return "\n".join(linhas)
