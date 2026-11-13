"""Indicadores da presença num período (spec 071) — só a conta, sem banco.

- Dia apurado = dia com pelo menos uma leitura válida na obra (fim de semana/feriado sem apontamento não vira falta).
- Efetivo da equipe = composição atual (encarregado + membros ativos); a composição de dias passados não é guardada.
- Presença = primeira leitura válida da pessoa no dia. Falta = pessoa da equipe sem leitura num dia apurado.
- Taxa de presença = presenças ÷ (efetivo × dias apurados); absenteísmo = 1 − taxa.
- HH disponível do dia = Σ presentes da equipe × jornada da equipe.
- Horário de chegada no fuso de Brasília (UTC−3, sem horário de verão).
"""
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from app.shared.memoria import Fonte, Memoria, Passo, num

FUSO = timezone(timedelta(hours=-3))


@dataclass(frozen=True)
class EquipeInd:
    equipe_id: int
    nome: str
    setor: str | None
    jornada: float
    pessoas: frozenset[int]


def _pct(a: float, b: float) -> float | None:
    return round(a / b, 4) if b else None


def _p(v: float | None) -> str:
    return "—" if v is None else f"{num(v * 100, 1)}%"


def calcular(equipes: list[EquipeInd], presencas: dict[date, dict[int, tuple[datetime, str]]],
             nomes: dict[int, str]) -> dict:
    """presencas: dia → {colaborador: (hora da 1ª leitura válida, meio)}."""
    dias = sorted(d for d, p in presencas.items() if p)
    nas = set().union(*(e.pessoas for e in equipes)) if equipes else set()
    equipe_de = {cid: e for e in equipes for cid in e.pessoas}  # pessoa em duas equipes: conta na última (raro)

    por_dia = []
    for d in dias:
        p = presencas[d]
        pres_eq = len(nas & p.keys())
        hh = sum(len(e.pessoas & p.keys()) * e.jornada for e in equipes)
        por_dia.append({"data": d.isoformat(), "presentes": len(p), "efetivo": len(nas), "presentes_nas_equipes": pres_eq,
                        "sem_equipe": len(p.keys() - nas), "taxa": _pct(pres_eq, len(nas)), "hh": round(hh, 2)})

    por_equipe = []
    for e in equipes:
        if not e.pessoas:
            continue
        pres = sum(len(e.pessoas & presencas[d].keys()) for d in dias)
        poss = len(e.pessoas) * len(dias)
        taxa = _pct(pres, poss)
        por_equipe.append({"equipe_id": e.equipe_id, "nome": e.nome, "setor": e.setor, "efetivo": len(e.pessoas),
                           "dias": len(dias), "presencas": pres, "possiveis": poss, "faltas": poss - pres,
                           "taxa": taxa, "absenteismo": None if taxa is None else round(1 - taxa, 4),
                           "hh": round(pres * e.jornada, 2)})
    por_equipe.sort(key=lambda x: (x["taxa"] if x["taxa"] is not None else 2, x["nome"]))

    meios = Counter(m for d in dias for _, m in presencas[d].values())
    chegada = Counter(h.astimezone(FUSO).hour for d in dias for h, _ in presencas[d].values())

    faltas = Counter(cid for d in dias for cid in nas - presencas[d].keys())
    mais_faltas = [{"colaborador_id": cid, "nome": nomes.get(cid, "?"), "equipe": equipe_de[cid].nome if cid in equipe_de else None,
                    "faltas": n, "dias": len(dias)} for cid, n in sorted(faltas.items(), key=lambda x: (-x[1], nomes.get(x[0], "")))[:10]]

    presencas_eq = sum(x["presentes_nas_equipes"] for x in por_dia)
    possiveis = len(nas) * len(dias)
    taxa = _pct(presencas_eq, possiveis)
    hh = round(sum(x["hh"] for x in por_dia), 2)
    media = round(sum(x["presentes"] for x in por_dia) / len(dias), 1) if dias else None
    resumo = {"dias": len(dias), "efetivo": len(nas), "presencas": presencas_eq, "possiveis": possiveis, "taxa": taxa,
              "absenteismo": None if taxa is None else round(1 - taxa, 4), "media_presentes": media, "hh": hh,
              "pessoas_dia": sum(x["presentes"] for x in por_dia)}

    lista_dias = ", ".join(d.strftime("%d/%m") for d in dias) or "nenhum"
    fonte_leit = Fonte("Leituras de presença", f"{resumo['pessoas_dia']} pessoa(s)-dia", "Apropriação (app de campo)",
                       "1ª leitura válida de cada pessoa no dia")
    fonte_eq = Fonte("Efetivo das equipes", f"{len(nas)} pessoa(s)", "Cadastro de Equipes (composição atual)",
                     f"{len([e for e in equipes if e.pessoas])} equipe(s) ativas")
    memorias = {
        "taxa": Memoria("taxa", "Taxa de presença no período", _p(taxa), "presenças ÷ (efetivo das equipes × dias apurados)",
                        (Passo("Dias apurados", lista_dias, str(len(dias))),
                         Passo("Presenças possíveis", f"{len(nas)} × {len(dias)}", str(possiveis)),
                         Passo("Presenças registradas (nas equipes)", "soma dos presentes das equipes em cada dia", str(presencas_eq)),
                         Passo("Taxa", f"{presencas_eq} ÷ {possiveis}", _p(taxa), True)),
                        (fonte_leit, fonte_eq),
                        ("Dia apurado = dia com pelo menos uma leitura na obra.",
                         "A composição das equipes é a de hoje; quem entrou depois conta como falta nos dias anteriores.")),
        "absenteismo": Memoria("absenteismo", "Absenteísmo no período", _p(resumo["absenteismo"]), "1 − taxa de presença",
                               (Passo("Faltas", f"{possiveis} − {presencas_eq}", str(possiveis - presencas_eq)),
                                Passo("Absenteísmo", f"{possiveis - presencas_eq} ÷ {possiveis}", _p(resumo["absenteismo"]), True)),
                               (fonte_leit, fonte_eq), ("Falta = pessoa da equipe sem leitura num dia apurado.",)),
        "media": Memoria("media", "Média de presentes por dia", num(media, 1), "pessoas presentes no período ÷ dias apurados",
                         (Passo("Presentes somados", " + ".join(str(x["presentes"]) for x in por_dia) or "0", str(resumo["pessoas_dia"])),
                          Passo("Média", f"{resumo['pessoas_dia']} ÷ {len(dias)}", num(media, 1), True)),
                         (fonte_leit,), ("Inclui quem leu presença sem estar em equipe.",)),
        "hh": Memoria("hh", "HH disponível no período", f"{num(hh)} h", "Σ dias Σ equipes (presentes × jornada da equipe)",
                      tuple(Passo(f"Equipe {e['nome']}", f"{e['presencas']} presença(s) × jornada", f"{num(e['hh'])} h")
                            for e in sorted(por_equipe, key=lambda x: -x["hh"])[:12])
                      + (Passo("Total", "soma", f"{num(hh)} h", True),),
                      (fonte_leit, Fonte("Jornada", "h/dia", "Cadastro da equipe", "campo jornada")),
                      ("Presentes sem equipe não entram (não têm jornada).",)),
    }
    return {"dias": [d.isoformat() for d in dias], "resumo": resumo, "por_dia": por_dia, "por_equipe": por_equipe,
            "por_meio": dict(meios), "chegada": [{"hora": h, "pessoas": chegada[h]} for h in sorted(chegada)],
            "mais_faltas": mais_faltas, "memorias": {k: m.como_dict() for k, m in memorias.items()}}
