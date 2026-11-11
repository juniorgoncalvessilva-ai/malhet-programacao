"""Liga encarregado e funcionários das equipes ao efetivo pelo número antes do nome (crachá do Simova = matrícula).

Equipes digitadas ou vindas de planilha às vezes trazem o número dentro do nome ("115532 - JOSE DA SILVA") e o
crachá vazio. Aqui o número é separado, procurado na matrícula do efetivo e a pessoa passa a ter crachá, nome e função
do efetivo. A função digitada no membro (função da CPU) é preservada; sem ela vale o de-para da função do efetivo.
"""
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.efetivo.infra.gateway import LocalizadorEfetivo
from app.modules.equipes.domain.simova_equipe import separar_cracha
from app.modules.equipes.infra.models import EquipeModel


@dataclass
class ResultadoVinculo:
    vinculados: int = 0
    nao_encontrados: list[str] = field(default_factory=list)
    sem_numero: list[str] = field(default_factory=list)

    def como_dict(self) -> dict:
        return {"vinculados": self.vinculados, "nao_encontrados": self.nao_encontrados[:100],
                "sem_numero": self.sem_numero[:100]}


def _numero_e_nome(cracha: str | None, nome: str | None) -> tuple[str | None, str]:
    num_nome, nome_limpo = separar_cracha(nome)
    c = (cracha or "").strip().replace(".", "")
    if c.isdigit():
        return c.lstrip("0") or "0", (nome_limpo if num_nome == c.lstrip("0") else (nome or "").strip())
    return num_nome, nome_limpo


def vincular_equipe(eq: EquipeModel, loc: LocalizadorEfetivo, r: ResultadoVinculo | None = None) -> ResultadoVinculo:
    r = r or ResultadoVinculo()
    rotulo = lambda num, nome: f"{eq.nome}: {num + ' · ' if num else ''}{nome}"  # noqa: E731
    # encarregado
    if eq.encarregado_cracha or eq.encarregado_nome:
        num, nome = _numero_e_nome(eq.encarregado_cracha, eq.encarregado_nome)
        p = loc.achar(num)
        if p:
            eq.encarregado_cracha, eq.encarregado_nome = p.cracha or num, p.nome[:150]
            r.vinculados += 1
        elif num:
            eq.encarregado_cracha, eq.encarregado_nome = num, (nome or eq.encarregado_nome or "")[:150] or None
            r.nao_encontrados.append(rotulo(num, nome))
        else:
            r.sem_numero.append(rotulo(None, nome))
    # funcionários (a chave equipe+crachá é única: se dois viram o mesmo número, fica um)
    # quem já tem crachá numérico vem primeiro: em duplicidade ele fica e o outro sai (evita colisão no flush)
    vistos: set[str] = set()
    for m in sorted(eq.membros, key=lambda m: not (m.cracha or "").replace(".", "").isdigit()):
        num, nome = _numero_e_nome(m.cracha, m.nome)
        p = loc.achar(num)
        novo = (p.cracha if p and p.cracha else num) or m.cracha
        if novo in vistos:
            eq.membros.remove(m)
            continue
        vistos.add(novo)
        m.cracha = novo[:20]
        m.nome = (p.nome if p else (nome or m.nome))[:150]
        if p:
            r.vinculados += 1
        elif num:
            r.nao_encontrados.append(rotulo(num, m.nome))
        else:
            r.sem_numero.append(rotulo(None, m.nome))
    return r


def vincular_equipes(s: Session, obra_id: int) -> dict:
    loc = LocalizadorEfetivo(s, obra_id)
    r = ResultadoVinculo()
    equipes = list(s.scalars(select(EquipeModel).where(EquipeModel.obra_id == obra_id).order_by(EquipeModel.nome)))
    for eq in equipes:
        vincular_equipe(eq, loc, r)
    s.flush()
    return {"equipes": len(equipes), **r.como_dict()}
