"""Uma pessoa, uma equipe (spec 107).

Funcionário entra numa equipe → sai sozinho da outra em que estava, e a troca vira movimento no histórico. Líder
(encarregado, responsável ou supervisor de alguma equipe) pode estar em mais de uma: não é tirado de lugar nenhum.

Também aqui: o nome padrão da equipe ("EQUIPE.{n}_{disciplina}", número automático) e a contagem das movimentações
por equipe e por semana, com a memória de cálculo.
"""
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from app.shared.errors import DomainError
from app.shared.memoria import Fonte, Memoria, Passo, num


@dataclass(frozen=True)
class EquipeResumo:
    id: int
    nome: str
    membros: frozenset[str]
    encarregado: str | None = None
    responsavel_id: int | None = None
    supervisor_id: int | None = None


def e_lider(cracha: str, colaborador_id: int | None, equipes: list[EquipeResumo]) -> bool:
    """Encarregado (pelo crachá), responsável ou supervisor (pela pessoa do efetivo) de alguma equipe."""
    for e in equipes:
        if cracha and e.encarregado == cracha:
            return True
        if colaborador_id is not None and colaborador_id in (e.responsavel_id, e.supervisor_id):
            return True
    return False


def equipes_de_saida(cracha: str, colaborador_id: int | None, destino_id: int,
                     equipes: list[EquipeResumo]) -> list[EquipeResumo]:
    """De quais equipes a pessoa sai ao entrar na equipe `destino_id` (nenhuma, se for líder)."""
    if not cracha or e_lider(cracha, colaborador_id, equipes):
        return []
    return [e for e in equipes if e.id != destino_id and cracha in e.membros]


# ---- nome padrão --------------------------------------------------------------------------------------------
MODELO_PADRAO = "EQUIPE.{n}_{disciplina}"


def validar_modelo(modelo: str) -> str:
    m = (modelo or "").strip()
    if m.count("{n}") != 1:
        raise DomainError("o padrão precisa ter {n} (o número automático) uma vez", "modelo")
    if m.count("{disciplina}") > 1:
        raise DomainError("{disciplina} só pode aparecer uma vez", "modelo")
    if len(m) > 60:
        raise DomainError("padrão longo demais (até 60 caracteres)", "modelo")
    if re.search(r"\{(?!n\}|disciplina\})", m):
        raise DomainError("use só {n} e {disciplina} entre chaves", "modelo")
    return m


def _flexivel(texto: str) -> str:
    """Prefixo do padrão como expressão: letras iguais (sem caixa), pontuação qualquer ("EQUIPE." casa "EQUIPE_")."""
    return "".join(r"[^0-9A-Za-z]?" if not ch.isalnum() else re.escape(ch) for ch in texto)


def numero_do_nome(modelo: str, nome: str) -> int | None:
    antes = modelo.split("{n}")[0]
    m = re.match(_flexivel(antes) + r"\s*(\d+)", (nome or "").strip(), re.IGNORECASE)
    return int(m.group(1)) if m else None


def proximo_numero(modelo: str, nomes: list[str]) -> int:
    """Maior número já usado no padrão + 1 (as equipes fora do padrão não contam)."""
    usados = [n for n in (numero_do_nome(modelo, x) for x in nomes) if n is not None]
    return max(usados, default=0) + 1


def disciplina_do_nome(modelo: str, nome: str) -> str | None:
    """O que vem no lugar de {disciplina} num nome que segue o padrão ("EQUIPE.10_FORMA" → "FORMA")."""
    if "{disciplina}" not in modelo:
        return None
    antes, depois_n = modelo.split("{n}")
    if "{disciplina}" not in depois_n:
        return None
    meio, fim = depois_n.split("{disciplina}")
    m = re.fullmatch(_flexivel(antes) + r"\s*\d+" + _flexivel(meio) + r"(.+?)" + _flexivel(fim), (nome or "").strip(), re.IGNORECASE)
    return limpar_disciplina(m.group(1)) if m else None


def limpar_disciplina(texto: str | None) -> str:
    t = re.sub(r"\s+", " ", (texto or "").strip()).upper()
    return t[:60]


def nome_padrao(modelo: str, numero: int, disciplina: str | None, digitos: int = 1) -> str:
    disc = limpar_disciplina(disciplina)
    if "{disciplina}" in modelo and not disc:
        raise DomainError("digite a disciplina da equipe (ex.: FORMA)", "disciplina")
    nome = modelo.replace("{n}", str(numero).zfill(max(1, min(digitos, 4)))).replace("{disciplina}", disc)
    return nome[:120]


# ---- movimentações ------------------------------------------------------------------------------------------
@dataclass(frozen=True)
class Movimento:
    em: datetime
    pessoa: str
    de_id: int | None
    de: str | None
    para_id: int | None
    para: str | None


def _semana(d: date) -> date:
    return d - timedelta(days=d.weekday())


def resumo_movimentos(movs: list[Movimento], inicio: date, fim: date, nomes: dict[int, str]) -> dict:
    """Entradas e saídas por equipe e movimentações por semana (segunda-feira), cada número com a memória.

    Uma troca A → B é UMA movimentação: saída de A e entrada em B. Entrada sem origem = pessoa que estava sem equipe;
    saída sem destino = pessoa tirada da equipe."""
    if fim < inicio:
        raise DomainError("o fim do período vem antes do início", "fim")
    no_periodo = [m for m in movs if inicio <= m.em.date() <= fim]
    entradas: dict[str, int] = defaultdict(int)
    saidas: dict[str, int] = defaultdict(int)
    por_semana: dict[date, int] = defaultdict(int)
    pessoas = set()

    def chave(eid: int | None, nome: str | None) -> str | None:
        if eid is not None:
            return nomes.get(eid, nome or f"equipe #{eid}")
        return nome

    for m in no_periodo:
        if (k := chave(m.para_id, m.para)):
            entradas[k] += 1
        if (k := chave(m.de_id, m.de)):
            saidas[k] += 1
        por_semana[_semana(m.em.date())] += 1
        pessoas.add(m.pessoa)

    periodo = f"{inicio:%d/%m/%Y} a {fim:%d/%m/%Y}"
    fonte = Fonte("Movimentos de equipe", f"{len(no_periodo)} no período", "Histórico de movimentações do efetivo",
                  f"tipo EQUIPE, {periodo}")
    linhas = []
    memorias = {}
    for k in sorted(set(entradas) | set(saidas), key=lambda x: (-(entradas[x] + saidas[x]), x)):
        e, s = entradas[k], saidas[k]
        linhas.append({"equipe": k, "entradas": e, "saidas": s, "total": e + s})
        memorias[f"equipe:{k}"] = Memoria(
            chave=f"equipe:{k}", titulo=f"Alterações em {k}", valor=num(e + s),
            formula="alterações = entradas + saídas da equipe no período",
            passos=(Passo("Entradas (vieram de outra equipe ou de sem equipe)", num(e), num(e)),
                    Passo("Saídas (foram para outra equipe ou ficaram sem equipe)", num(s), num(s)),
                    Passo("Total", f"{num(e)} + {num(s)}", num(e + s), True)),
            fontes=(fonte,)).como_dict()
    semanas = []
    d = _semana(inicio)
    while d <= fim:
        semanas.append({"semana": d.isoformat(), "total": por_semana.get(d, 0)})
        d += timedelta(days=7)
    total = len(no_periodo)
    trocas = sum(1 for m in no_periodo if m.de is not None and m.para is not None)
    sem_origem = sum(1 for m in no_periodo if m.de is None)
    sem_destino = sum(1 for m in no_periodo if m.para is None)
    memorias["total"] = Memoria(
        chave="total", titulo="Movimentações no período", valor=num(total),
        formula="cada pessoa que entrou, saiu ou trocou de equipe conta 1",
        passos=(Passo("Trocas de equipe (saiu de uma e entrou em outra)", num(trocas), num(trocas)),
                Passo("Entradas de quem estava sem equipe", num(sem_origem), num(sem_origem)),
                Passo("Saídas para sem equipe", num(sem_destino), num(sem_destino)),
                Passo("Total", "soma", num(total), True)),
        fontes=(fonte,)).como_dict()
    memorias["pessoas"] = Memoria(
        chave="pessoas", titulo="Pessoas movimentadas", valor=num(len(pessoas)),
        formula="pessoas diferentes com ao menos uma movimentação no período",
        passos=(Passo("Movimentações", num(total), num(total)), Passo("Pessoas distintas", "sem repetir", num(len(pessoas)), True)),
        fontes=(fonte,)).como_dict()
    return {"inicio": inicio.isoformat(), "fim": fim.isoformat(), "total": total, "trocas": trocas,
            "pessoas": len(pessoas), "por_equipe": linhas, "por_semana": semanas, "memorias": memorias}
