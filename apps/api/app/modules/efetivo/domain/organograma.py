"""Organograma da obra (modelo do Malhet): Obra (responsável geral) → Setor (responsável) → Equipe → Função → pessoas.

Os setores são cadastrados na obra, cada um com responsável e cor; a equipe aponta para o seu setor. Sem nenhum
setor cadastrado, o setor da equipe é a frente ou o DP do encarregado (como antes). Quem está mobilizado e sem equipe
vai para o ramo "Sem equipe"; quem ainda está em mobilização (crachá, exame, previsto), para "Em mobilização".
Desmobilizados e desistências não entram. Responsáveis da obra e dos setores aparecem na própria caixa, não como
"sem equipe".
"""
import re
from dataclasses import dataclass, field

from app.shared.errors import DomainError

SEM_SETOR, SEM_EQUIPE, EM_MOBILIZACAO, SEM_FUNCAO = ("Sem setor", "Sem equipe", "Em mobilização", "Sem função")
NIVEIS_COR = ("obra", "setor", "equipe", "funcao")
CORES_PADRAO = {"obra": "#1F3A3A", "setor": "#0F766E", "equipe": "#2563EB", "funcao": "#64748B"}
_COR = re.compile(r"^#[0-9A-Fa-f]{6}$")


def validar_cor(cor: str | None) -> str | None:
    if cor in (None, ""):
        return None
    if not _COR.match(cor):
        raise DomainError(f"cor inválida: {cor} (use #RRGGBB)")
    return cor.upper()


def validar_cores(cores: dict | None) -> dict:
    out = {}
    for k, v in (cores or {}).items():
        if k not in NIVEIS_COR:
            raise DomainError(f"nível sem cor configurável: {k}")
        c = validar_cor(v)
        if c:
            out[k] = c
    return out


@dataclass(frozen=True)
class PessoaOrg:
    matricula: str
    nome: str
    funcao: str
    situacao: str  # equipe | sem-equipe | mobilizacao
    turno: str = ""
    equipe: str | None = None
    encarregado: str | None = None
    setor: str | None = None


@dataclass(frozen=True)
class SetorOrg:
    nome: str
    responsavel: str | None = None
    cor: str | None = None
    ordem: int = 0


@dataclass
class No:
    id: str
    tipo: str  # obra | setor | equipe | funcao
    titulo: str
    detalhe: str
    qtd: int = 0
    cor: str | None = None  # cor própria (setor); os filhos herdam na tela
    responsavel: str | None = None
    ordem: int = 0
    pessoas: list[PessoaOrg] = field(default_factory=list)
    filhos: list["No"] = field(default_factory=list)

    def como_dict(self) -> dict:
        return {"id": self.id, "tipo": self.tipo, "titulo": self.titulo, "detalhe": self.detalhe, "qtd": self.qtd,
                "cor": self.cor, "responsavel": self.responsavel,
                "pessoas": [p.__dict__ for p in self.pessoas], "filhos": [f.como_dict() for f in self.filhos]}


def _filho(pai: No, tipo: str, titulo: str, detalhe: str) -> No:
    for f in pai.filhos:
        if f.tipo == tipo and f.titulo == titulo:
            return f
    f = No(f"{pai.id}/{tipo}:{titulo}", tipo, titulo, detalhe)
    pai.filhos.append(f)
    return f


def _por_funcao(pai: No, p: PessoaOrg) -> None:
    _filho(pai, "funcao", p.funcao or SEM_FUNCAO, "Função").pessoas.append(p)


def _contar(n: No) -> int:
    n.qtd = len(n.pessoas) + sum(_contar(f) for f in n.filhos)
    return n.qtd


def _ordenar(n: No) -> None:
    fim = {SEM_SETOR: 1, SEM_EQUIPE: 2, EM_MOBILIZACAO: 3}
    n.filhos.sort(key=lambda f: (fim.get(f.titulo, 0) if f.tipo == "setor" else 0, f.ordem, f.titulo))
    n.pessoas.sort(key=lambda p: p.nome)
    for f in n.filhos:
        _ordenar(f)


def montar_organograma(obra: str, pessoas: list[PessoaOrg], setores: list[SetorOrg] | tuple = (),
                       responsavel_geral: str | None = None) -> No:
    raiz = No("obra", "obra", obra, f"Resp.: {responsavel_geral}" if responsavel_geral else "Obra",
              responsavel=responsavel_geral)
    for st in setores:  # setores cadastrados aparecem mesmo vazios, na ordem escolhida
        n = _filho(raiz, "setor", st.nome, f"Resp.: {st.responsavel}" if st.responsavel else "Setor")
        n.cor, n.responsavel, n.ordem = st.cor, st.responsavel, st.ordem
    for p in pessoas:
        if p.situacao == "equipe":
            setor = _filho(raiz, "setor", p.setor or SEM_SETOR, "Setor")
            equipe = _filho(setor, "equipe", p.equipe or SEM_EQUIPE, f"Enc.: {p.encarregado or '—'}")
            _por_funcao(equipe, p)
        elif p.situacao == "sem-equipe":
            _por_funcao(_filho(raiz, "setor", SEM_EQUIPE, "Mobilizados sem equipe"), p)
        else:
            _por_funcao(_filho(raiz, "setor", EM_MOBILIZACAO, "Crachá, exame ou previsto"), p)
    _contar(raiz)
    _ordenar(raiz)
    return raiz


def filtrar(no: No, termo: str) -> No | None:
    """Mantém os ramos cujo título, responsável ou pessoas casam com o termo."""
    t = termo.strip().lower()
    if not t:
        return no
    if t in no.titulo.lower() or t in (no.responsavel or "").lower():
        return no
    pessoas = [p for p in no.pessoas if t in p.nome.lower() or t in p.matricula or t in (p.funcao or "").lower()]
    filhos = [f for f in (filtrar(x, termo) for x in no.filhos) if f is not None]
    if not pessoas and not filhos:
        return None
    novo = No(no.id, no.tipo, no.titulo, no.detalhe, cor=no.cor, responsavel=no.responsavel, ordem=no.ordem,
              pessoas=pessoas, filhos=filhos)
    _contar(novo)
    return novo
