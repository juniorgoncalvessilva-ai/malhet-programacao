"""Cadastro de equipes exportado pelo Simova.

Colunas: Código | Descrição | Encarregado | Funcionário | Equipamento | Ativo
- Encarregado: "115095 :: CLAYTON ANGELO GONCALVES"
- Funcionário: vários "crachá :: NOME" colados na mesma célula (às vezes com quebra de linha)
"""
import re
import unicodedata
from dataclasses import dataclass

from app.shared.errors import DomainError

_PESSOA = re.compile(r"(\d{3,})\s*::\s*(.*?)(?=\s*\d{3,}\s*::|$)", re.S)
_COLUNAS = {"codigo": "codigo", "descricao": "descricao", "encarregado": "encarregado", "funcionario": "funcionario",
            "funcionarios": "funcionario", "equipamento": "equipamento", "equipamentos": "equipamento", "ativo": "ativo"}


@dataclass(frozen=True)
class Pessoa:
    cracha: str
    nome: str


@dataclass(frozen=True)
class EquipeSimova:
    codigo: str
    descricao: str
    encarregado: Pessoa | None
    funcionarios: tuple[Pessoa, ...]
    equipamentos: str | None
    ativo: bool


def _sem_acento(t: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn").lower().strip()


def nome_proprio(nome: str) -> str:
    """CLAYTON ANGELO GONCALVES → Clayton Angelo Goncalves (preposições em minúscula)."""
    partes = re.sub(r"\s+", " ", nome.strip()).split(" ")
    return " ".join(p.lower() if p.lower() in {"da", "de", "do", "das", "dos", "e"} and i else p.capitalize()
                    for i, p in enumerate(partes))


def pessoas(texto) -> tuple[Pessoa, ...]:
    if texto is None:
        return ()
    vistos, out = set(), []
    for cracha, nome in _PESSOA.findall(str(texto)):
        nome = re.sub(r"\s+", " ", nome).strip()
        if cracha in vistos or not nome:
            continue
        vistos.add(cracha)
        out.append(Pessoa(cracha, nome_proprio(nome)))
    return tuple(out)


def _texto(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def interpretar(linhas: list[list]) -> list[EquipeSimova]:
    cab_idx, cols = None, {}
    for i, ln in enumerate(linhas[:20]):
        achados = {_COLUNAS[_sem_acento(_texto(c))]: j for j, c in enumerate(ln) if _sem_acento(_texto(c)) in _COLUNAS}
        if {"codigo", "descricao", "encarregado"} <= set(achados):
            cab_idx, cols = i, achados
            break
    if cab_idx is None:
        raise DomainError("cabeçalho do Simova não encontrado (Código, Descrição, Encarregado, Funcionário…)")
    out = []
    for ln in linhas[cab_idx + 1:]:
        def cel(k):
            j = cols.get(k)
            return ln[j] if j is not None and j < len(ln) else None
        cod, desc = _texto(cel("codigo")), _texto(cel("descricao"))
        if not cod or not desc:
            continue
        enc = pessoas(cel("encarregado"))
        ativo = _texto(cel("ativo")).lower() not in ("0", "n", "nao", "não", "false", "inativo")
        out.append(EquipeSimova(cod, desc, enc[0] if enc else None, pessoas(cel("funcionario")),
                                _texto(cel("equipamento")) or None, ativo))
    return out


# ---- exportação no padrão do Simova (mesmo layout do cadastro de equipes que o Simova exporta) ------------
CABECALHO_SIMOVA = [None, "Código", "Descrição", "Encarregado", "Funcionário", "Equipamento", "Ativo", None]


def pessoa_simova(cracha: str, nome: str) -> str:
    return f"{cracha} :: {' '.join(nome.upper().split())}"


def linha_simova(codigo: str, descricao: str, encarregado: tuple[str, str] | None,
                 funcionarios: list[tuple[str, str]], equipamentos: str | None, ativo: bool) -> list:
    """Funcionários um atrás do outro na mesma célula, sem separador — como o Simova grava."""
    if not descricao.strip():
        raise DomainError("equipe sem descrição")
    cod = int(codigo) if str(codigo).isdigit() else codigo
    return [None, cod, descricao.strip(), pessoa_simova(*encarregado) if encarregado else "",
            "".join(pessoa_simova(c, n) for c, n in funcionarios), equipamentos or None, 1 if ativo else 0, ""]
