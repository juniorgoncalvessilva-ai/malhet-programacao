"""Organograma da obra (modelo do Malhet): Obra (responsável geral) → Setor (responsável) → Disciplina (subsetor,
responsável) → Equipe → Função → pessoas. Equipe sem disciplina fica direto no setor.

Os setores são cadastrados na obra, cada um com responsável e cor; a equipe aponta para o seu setor. Sem nenhum
setor cadastrado, o setor da equipe é a frente ou o DP do encarregado (como antes). Quem está mobilizado e sem equipe
vai para o ramo "Sem equipe"; quem ainda está em mobilização (crachá, exame, previsto), para "Em mobilização".
Desmobilizados e desistências não entram.

Vista por frente (spec 042): Obra (gerente) → Setor (dono) → Frente (local) → Área → Equipe → Função. A frente da
equipe é a escolhida no cadastro da equipe ou, sem ela, a área onde a equipe está na programação mais recente. Responsáveis (obra, setor, disciplina) aparecem só na própria caixa: não
entram nas listas de funções nem na contagem.
"""
import re
from dataclasses import dataclass, field

from app.shared.errors import DomainError

SEM_SETOR, SEM_EQUIPE, EM_MOBILIZACAO, SEM_FUNCAO = ("Sem setor", "Sem equipe", "Em mobilização", "Sem função")
SEM_FRENTE = "Sem frente"
NIVEIS_COR = ("obra", "setor", "responsavel", "disciplina", "frente", "area", "equipe", "funcao")
CORES_PADRAO = {"obra": "#1F3A3A", "setor": "#0F766E", "responsavel": "#4F46E5", "disciplina": "#0891B2", "frente": "#B45309", "area": "#D97706",
                "equipe": "#2563EB", "funcao": "#64748B"}
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
    disciplina: str | None = None
    equipe_id: int | None = None  # para mexer na equipe pelo organograma (spec 049)
    lider: str | None = None  # responsável (engenheiro) da equipe: caixa abaixo do dono do setor (spec 050)
    lider_funcao: str | None = None
    papel: str | None = None  # membro | encarregado
    frente: str | None = None  # "L4 · Novo CMD"
    area: str | None = None  # "004.05 · Galpão"


@dataclass(frozen=True)
class DisciplinaOrg:
    nome: str
    responsavel: str | None = None
    cor: str | None = None
    ordem: int = 0


@dataclass(frozen=True)
class SetorOrg:
    nome: str
    responsavel: str | None = None
    cor: str | None = None
    ordem: int = 0
    disciplinas: tuple[DisciplinaOrg, ...] = ()


@dataclass
class No:
    id: str
    tipo: str  # obra | setor | responsavel | disciplina | frente | area | equipe | funcao
    titulo: str
    detalhe: str
    qtd: int = 0
    ref: int | None = None  # equipe: id da equipe (spec 049)
    cor: str | None = None  # cor própria (setor); os filhos herdam na tela
    responsavel: str | None = None
    ordem: int = 0
    pessoas: list[PessoaOrg] = field(default_factory=list)
    filhos: list["No"] = field(default_factory=list)

    def como_dict(self) -> dict:
        return {"id": self.id, "tipo": self.tipo, "titulo": self.titulo, "detalhe": self.detalhe, "qtd": self.qtd,
                "cor": self.cor, "responsavel": self.responsavel, "ref": self.ref,
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
    fim = {SEM_SETOR: 1, SEM_EQUIPE: 2, EM_MOBILIZACAO: 3, SEM_FRENTE: 1}
    tipo = {"responsavel": 0, "disciplina": 0, "frente": 0, "area": 0, "equipe": 1}
    n.filhos.sort(key=lambda f: (fim.get(f.titulo, 0) if f.tipo in ("setor", "frente") else 0, tipo.get(f.tipo, 0), f.ordem,
                                 [int(x) if x.isdigit() else x for x in re.split(r"(\d+)", f.titulo)]))
    n.pessoas.sort(key=lambda p: p.nome)
    for f in n.filhos:
        _ordenar(f)


def montar_organograma(obra: str, pessoas: list[PessoaOrg], setores: list[SetorOrg] | tuple = (),
                       responsavel_geral: str | None = None, por_frente: bool = False) -> No:
    raiz = No("obra", "obra", obra, f"Resp.: {responsavel_geral}" if responsavel_geral else "Obra",
              responsavel=responsavel_geral)
    for st in setores:  # setores cadastrados aparecem mesmo vazios, na ordem escolhida
        n = _filho(raiz, "setor", st.nome, f"Resp.: {st.responsavel}" if st.responsavel else "Setor")
        n.cor, n.responsavel, n.ordem = st.cor, st.responsavel, st.ordem
        for dc in (() if por_frente else st.disciplinas):
            d = _filho(n, "disciplina", dc.nome, f"Resp.: {dc.responsavel}" if dc.responsavel else "Disciplina")
            d.cor, d.responsavel, d.ordem = dc.cor, dc.responsavel, dc.ordem
    for p in pessoas:
        if p.situacao == "equipe":
            setor = _filho(raiz, "setor", p.setor or SEM_SETOR, "Setor")
            if p.lider:  # dono do setor → responsável (engenheiro) → … → equipe
                setor = _filho(setor, "responsavel", p.lider, p.lider_funcao or "Responsável")
                setor.responsavel = p.lider
            if por_frente:  # setor (dono) → frente → área → equipe
                pai = _filho(setor, "frente", p.frente or SEM_FRENTE, "Frente de trabalho" if p.frente else "Equipe sem frente")
                if p.area:
                    pai = _filho(pai, "area", p.area, "Área")
            else:
                pai = _filho(setor, "disciplina", p.disciplina, "Disciplina") if p.disciplina and p.setor else setor
                if pai.tipo == "disciplina" and setor.tipo == "responsavel":
                    _herdar_disciplina(raiz, p.setor, pai)
            equipe = _filho(pai, "equipe", p.equipe or SEM_EQUIPE, f"Enc.: {p.encarregado or '—'}")
            equipe.ref = equipe.ref or p.equipe_id
            _por_funcao(equipe, p)
        elif p.situacao == "sem-equipe":
            _por_funcao(_filho(raiz, "setor", SEM_EQUIPE, "Mobilizados sem equipe"), p)
        else:
            _por_funcao(_filho(raiz, "setor", EM_MOBILIZACAO, "Crachá, exame ou previsto"), p)
    _contar(raiz)
    _podar_disciplinas(raiz)
    _ordenar(raiz)
    return raiz


def _herdar_disciplina(raiz: No, setor: str | None, d: No) -> None:
    """Disciplina repetida abaixo do responsável leva a cor/responsável da cadastrada no setor."""
    st = next((f for f in raiz.filhos if f.tipo == "setor" and f.titulo == setor), None)
    orig = next((f for f in st.filhos if f.tipo == "disciplina" and f.titulo == d.titulo), None) if st else None
    if orig and d.cor is None:
        d.cor, d.responsavel, d.ordem, d.detalhe = orig.cor, orig.responsavel, orig.ordem, orig.detalhe


def _podar_disciplinas(raiz: No) -> None:
    """Disciplina cadastrada que ficou vazia no setor porque as equipes dela estão abaixo de um responsável sai."""
    for st in raiz.filhos:
        abaixo = {d.titulo for r in st.filhos if r.tipo == "responsavel" for d in r.filhos if d.tipo == "disciplina"}
        st.filhos = [f for f in st.filhos if not (f.tipo == "disciplina" and f.qtd == 0 and f.titulo in abaixo)]


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
    novo = No(no.id, no.tipo, no.titulo, no.detalhe, cor=no.cor, responsavel=no.responsavel, ordem=no.ordem, ref=no.ref,
              pessoas=pessoas, filhos=filhos)
    _contar(novo)
    return novo
