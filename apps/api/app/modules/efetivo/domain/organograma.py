"""Organograma da obra (modelo do Malhet): Obra → Setor → Supervisor → Encarregado → Função → pessoas.

Quem está mobilizado e sem equipe vai para o ramo "Sem equipe"; quem ainda está em mobilização (crachá, exame,
previsto), para "Em mobilização". Desmobilizados e desistências não entram.
"""
from dataclasses import dataclass, field

SEM_SETOR, SEM_SUPERVISOR, SEM_EQUIPE, EM_MOBILIZACAO, SEM_FUNCAO = (
    "Sem setor", "Sem supervisor", "Sem equipe", "Em mobilização", "Sem função")


@dataclass(frozen=True)
class PessoaOrg:
    matricula: str
    nome: str
    funcao: str
    situacao: str  # equipe | sem-equipe | mobilizacao
    turno: str = ""
    equipe: str | None = None
    encarregado: str | None = None
    supervisor: str | None = None
    setor: str | None = None


@dataclass
class No:
    id: str
    tipo: str  # obra | setor | supervisor | encarregado | funcao
    titulo: str
    detalhe: str
    qtd: int = 0
    pessoas: list[PessoaOrg] = field(default_factory=list)
    filhos: list["No"] = field(default_factory=list)

    def como_dict(self) -> dict:
        return {"id": self.id, "tipo": self.tipo, "titulo": self.titulo, "detalhe": self.detalhe, "qtd": self.qtd,
                "pessoas": [p.__dict__ for p in self.pessoas], "filhos": [f.como_dict() for f in self.filhos]}


def _filho(pai: No, tipo: str, titulo: str, detalhe: str) -> No:
    for f in pai.filhos:
        if f.tipo == tipo and f.titulo == titulo:
            return f
    f = No(f"{pai.id}/{tipo}:{titulo}", tipo, titulo, detalhe)
    pai.filhos.append(f)
    return f


def _por_funcao(pai: No, p: PessoaOrg) -> None:
    fn = _filho(pai, "funcao", p.funcao or SEM_FUNCAO, "Função")
    fn.pessoas.append(p)


def _contar(n: No) -> int:
    n.qtd = len(n.pessoas) + sum(_contar(f) for f in n.filhos)
    return n.qtd


def _ordenar(n: No) -> None:
    fim = {SEM_SETOR: 1, SEM_SUPERVISOR: 1, SEM_EQUIPE: 2, EM_MOBILIZACAO: 3}
    n.filhos.sort(key=lambda f: (fim.get(f.titulo, 0), f.titulo))
    n.pessoas.sort(key=lambda p: p.nome)
    for f in n.filhos:
        _ordenar(f)


def montar_organograma(obra: str, pessoas: list[PessoaOrg]) -> No:
    raiz = No("obra", "obra", obra, "Obra")
    for p in pessoas:
        if p.situacao == "equipe":
            setor = _filho(raiz, "setor", p.setor or SEM_SETOR, "Setor")
            sup = _filho(setor, "supervisor", p.supervisor or SEM_SUPERVISOR, "Supervisor / responsável")
            enc = _filho(sup, "encarregado", p.equipe or SEM_EQUIPE, f"Encarregado: {p.encarregado or '—'}")
            _por_funcao(enc, p)
        elif p.situacao == "sem-equipe":
            _por_funcao(_filho(raiz, "setor", SEM_EQUIPE, "Mobilizados sem equipe"), p)
        else:
            _por_funcao(_filho(raiz, "setor", EM_MOBILIZACAO, "Crachá, exame ou previsto"), p)
    _contar(raiz)
    _ordenar(raiz)
    return raiz


def filtrar(no: No, termo: str) -> No | None:
    """Mantém os ramos cujo título ou pessoas casam com o termo."""
    t = termo.strip().lower()
    if not t:
        return no
    if t in no.titulo.lower():
        return no
    pessoas = [p for p in no.pessoas if t in p.nome.lower() or t in p.matricula or t in (p.funcao or "").lower()]
    filhos = [f for f in (filtrar(x, termo) for x in no.filhos) if f is not None]
    if not pessoas and not filhos:
        return None
    novo = No(no.id, no.tipo, no.titulo, no.detalhe, pessoas=pessoas, filhos=filhos)
    _contar(novo)
    return novo
