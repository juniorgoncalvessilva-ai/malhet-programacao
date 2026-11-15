"""Métricas da mobilização (spec 087): esforço de cada aquisição em dias por etapa, onde o tempo se concentra,
funil, prazo × meta e desistências. Cada número sai com a memória (quais processos e quantos dias)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from statistics import mean, median

from app.modules.mobilizacao.domain.pipeline import ETAPAS, ROTULO_META, Etapa, Meta, Processo, Status
from app.shared.memoria import Fonte, Memoria, Passo, num


@dataclass(frozen=True)
class ProcessoNomeado:
    id: int
    nome: str
    funcao: str | None
    processo: Processo
    previsto_dias: float | None = None  # treinamento previsto no contrato para a função (spec 089)
    previsto_horas: float | None = None
    horas: float | None = None  # carga horária dos treinamentos registrados da pessoa durante o processo

    def metas(self, metas: dict[Meta, float]) -> dict[Meta, float]:
        """A meta de Treinamentos é a do contrato para a função, quando configurada."""
        return {**metas, Meta.TREINAMENTO: self.previsto_dias} if self.previsto_dias else metas

    def dias_treinamento(self, agora: datetime) -> float | None:
        ps = [p for p in self.processo.passagens if p.etapa == Etapa.TREINAMENTO]
        return sum(p.dias(agora) for p in ps) if ps else None


def _d(v: float | None) -> str:
    return "—" if v is None else f"{num(v, 1)} d"


def esforco(p: Processo, agora: datetime) -> dict[str, float]:
    """Dias gastos em cada etapa (somando passagens repetidas)."""
    out: dict[str, float] = {}
    for ps in p.passagens:
        out[ps.etapa.value] = out.get(ps.etapa.value, 0.0) + ps.dias(agora)
    return out


def gargalo(p: Processo, agora: datetime) -> Etapa | None:
    e = esforco(p, agora)
    return Etapa(max(e, key=e.get)) if e else None


def calcular(processos: list[ProcessoNomeado], metas: dict[Meta, float], agora: datetime) -> dict:
    """{"cards": {...memórias}, "etapas": [...], "funcoes": [...], "metas": [...]}"""
    ativos = [x for x in processos if x.processo.status.aberto]
    mobil = [x for x in processos if x.processo.status == Status.MOBILIZADO]
    desist = [x for x in processos if x.processo.status == Status.DESISTENCIA]

    lead = [(x, x.processo.dias_total(agora)) for x in mobil]
    m_lead = Memoria(
        chave="lead_time", titulo="Lead time médio (solicitação → crachá)",
        valor=_d(mean(d for _, d in lead)) if lead else "—",
        formula="média dos dias entre a entrada na Solicitação e a saída do Crachá dos processos mobilizados",
        passos=(Passo("Processos mobilizados", "", str(len(lead))),
                Passo("Soma", " + ".join(num(d, 1) for _, d in lead[:12]) + (" …" if len(lead) > 12 else ""),
                      _d(sum(d for _, d in lead)) if lead else "—"),
                Passo("Média", f"soma ÷ {len(lead)}", _d(mean(d for _, d in lead)) if lead else "—", True),
                Passo("Mediana", "", _d(median(d for _, d in lead)) if lead else "—")),
        fontes=tuple(Fonte(x.nome, _d(d), "processo de mobilização", f"#{x.id}") for x, d in lead[:60]))

    atras = [(x, x.processo.atrasos(x.metas(metas), agora)) for x in processos if x.processo.status != Status.DESISTENCIA]
    atrasados = [(x, a) for x, a in atras if a and x.processo.status.aberto]
    m_atr = Memoria(
        chave="atrasados", titulo="Em andamento fora da meta", valor=str(len(atrasados)),
        formula="processos abertos com alguma faixa (Seleção, Admissão/ASO, …) acima da meta em dias",
        passos=(Passo("Em andamento", "", str(len(ativos))), Passo("Fora da meta", "contagem", str(len(atrasados)), True)),
        fontes=tuple(Fonte(x.nome, ", ".join(ROTULO_META[m] for m in a), "metas da obra") for x, a in atrasados[:60]))

    no_prazo = [x for x, a in atras if x.processo.status == Status.MOBILIZADO and not a]
    pct = f"{num(100 * len(no_prazo) / len(mobil), 1)}%" if mobil else "—"
    m_prazo = Memoria(
        chave="no_prazo", titulo="Mobilizados dentro das metas", valor=pct,
        formula="mobilizados sem nenhuma faixa acima da meta ÷ mobilizados",
        passos=(Passo("Dentro das metas", "", str(len(no_prazo))), Passo("Mobilizados", "", str(len(mobil))),
                Passo("Percentual", f"{len(no_prazo)} ÷ {len(mobil)}", pct, True)))

    fim = len(mobil) + len(desist)
    taxa = f"{num(100 * len(desist) / fim, 1)}%" if fim else "—"
    m_des = Memoria(
        chave="desistencias", titulo="Desistências", valor=f"{len(desist)} ({taxa})",
        formula="processos encerrados por desistência ÷ processos encerrados (mobilizados + desistências)",
        passos=(Passo("Desistências", "", str(len(desist))), Passo("Encerrados", f"{len(mobil)} + {len(desist)}", str(fim)),
                Passo("Taxa", f"{len(desist)} ÷ {fim}", taxa, True)),
        fontes=tuple(Fonte(x.nome, x.processo.etapa_atual.rotulo, "desistiu na etapa") for x in desist[:60]))

    m_and = Memoria(chave="em_andamento", titulo="Em andamento", valor=str(len(ativos)),
                    formula="processos abertos (inclui aguardando crachá)",
                    passos=(Passo("Aguardando crachá", "", str(sum(x.processo.status == Status.AGUARDANDO_CRACHA for x in ativos))),
                            Passo("Em andamento", "contagem", str(len(ativos)), True)),
                    fontes=tuple(Fonte(x.nome, x.processo.etapa_atual.rotulo, "etapa atual") for x in ativos[:60]))

    # por etapa: esforço (dias) das passagens concluídas, quantos estão nela agora, funil
    etapas = []
    total_geral = sum(sum(esforco(x.processo, agora).values()) for x in processos if x.processo.status != Status.DESISTENCIA)
    for e in ETAPAS:
        fechadas = [(x, ps.dias(agora)) for x in processos for ps in x.processo.passagens if ps.etapa == e and ps.saiu_em]
        agora_nela = [x for x in ativos if x.processo.etapa_atual == e]
        alcancou = [x for x in processos if any(ps.etapa == e for ps in x.processo.passagens)]
        soma = sum(esforco(x.processo, agora).get(e.value, 0.0) for x in processos if x.processo.status != Status.DESISTENCIA)
        media = mean(d for _, d in fechadas) if fechadas else None
        part = f"{num(100 * soma / total_geral, 1)}%" if total_geral else "—"
        etapas.append({
            "etapa": e.value, "rotulo": e.rotulo, "agora": len(agora_nela), "alcancaram": len(alcancou),
            "media_dias": round(media, 2) if media is not None else None, "participacao": part,
            "memoria": Memoria(
                chave=f"etapa_{e.value.lower()}", titulo=f"Esforço em {e.rotulo}", valor=_d(media),
                formula="média dos dias das passagens concluídas; participação = dias na etapa ÷ dias de todas as etapas",
                passos=(Passo("Passagens concluídas", "", str(len(fechadas))),
                        Passo("Média", f"{num(sum(d for _, d in fechadas), 1)} d ÷ {len(fechadas)}" if fechadas else "—", _d(media), True),
                        Passo("Participação no esforço", f"{num(soma, 1)} d ÷ {num(total_geral, 1)} d", part)),
                fontes=tuple(Fonte(x.nome, _d(d), "passagem pela etapa", f"#{x.id}") for x, d in fechadas[:60])).como_dict(),
        })

    # por meta: média da faixa e quantos acima
    metas_out = []
    for m in Meta:
        ds = [(x, d) for x in processos if x.processo.status != Status.DESISTENCIA and (d := x.processo.dias_faixa(m, agora)) is not None]
        acima = [(x, d) for x, d in ds if x.metas(metas).get(m) is not None and d > x.metas(metas)[m]]
        metas_out.append({"meta": m.value, "rotulo": ROTULO_META[m], "dias_meta": metas.get(m),
                          "media_dias": round(mean(d for _, d in ds), 2) if ds else None, "medidos": len(ds), "acima": len(acima)})

    # por função: quantos, lead time médio dos mobilizados, gargalo mais comum
    funcoes: dict[str, dict] = {}
    for x in processos:
        f = funcoes.setdefault(x.funcao or "Sem função", {"funcao": x.funcao or "Sem função", "processos": 0, "mobilizados": 0,
                                                         "desistencias": 0, "_lead": [], "_garg": {}})
        f["processos"] += 1
        if x.processo.status == Status.MOBILIZADO:
            f["mobilizados"] += 1
            f["_lead"].append(x.processo.dias_total(agora))
        if x.processo.status == Status.DESISTENCIA:
            f["desistencias"] += 1
        g = gargalo(x.processo, agora)
        if g:
            f["_garg"][g.rotulo] = f["_garg"].get(g.rotulo, 0) + 1
    por_funcao = [{"funcao": f["funcao"], "processos": f["processos"], "mobilizados": f["mobilizados"],
                   "desistencias": f["desistencias"],
                   "lead_medio": round(mean(f["_lead"]), 2) if f["_lead"] else None,
                   "gargalo": max(f["_garg"], key=f["_garg"].get) if f["_garg"] else None}
                  for f in sorted(funcoes.values(), key=lambda f: -f["processos"])]

    tre = treinamento(processos, agora)
    cards = [m_and, m_lead, m_prazo, m_atr, m_des, *tre["cards"]]
    return {"cards": {m.chave: m.como_dict() for m in cards}, "etapas": etapas, "metas": metas_out, "funcoes": por_funcao,
            "treinamento": tre["por_funcao"]}


def treinamento(processos: list[ProcessoNomeado], agora: datetime) -> dict:
    """Tempo gasto em treinamento × o que o contrato prevê para a função (dias da etapa e horas registradas)."""
    medidos = [(x, d) for x in processos if x.processo.status != Status.DESISTENCIA and (d := x.dias_treinamento(agora)) is not None]
    com_prev = [(x, d) for x, d in medidos if x.previsto_dias]
    acima = [(x, d) for x, d in com_prev if d > x.previsto_dias]
    real = mean(d for _, d in com_prev) if com_prev else None
    prev = mean(x.previsto_dias for x, _ in com_prev) if com_prev else None
    m_dias = Memoria(
        chave="treino_dias", titulo="Treinamento: dias gastos × contrato", valor=f"{_d(real)} / {_d(prev)}",
        formula="média dos dias na etapa Treinamentos ÷ média dos dias previstos no contrato para a função",
        passos=(Passo("Processos com treinamento e previsão", "", str(len(com_prev))),
                Passo("Média real", " + ".join(num(d, 1) for _, d in com_prev[:10]) + (" …" if len(com_prev) > 10 else ""), _d(real), True),
                Passo("Média prevista", "", _d(prev)),
                Passo("Acima do previsto", "contagem", str(len(acima)))),
        fontes=tuple(Fonte(x.nome, f"{_d(d)} de {_d(x.previsto_dias)}", x.funcao or "sem função", f"#{x.id}") for x, d in com_prev[:60]),
        notas=(f"{len(medidos) - len(com_prev)} processo(s) sem previsão no contrato para a função (Configurações).",)
        if len(medidos) > len(com_prev) else ())
    com_h = [x for x, _ in medidos if x.previsto_horas]
    h_real = sum(x.horas or 0 for x in com_h)
    h_prev = sum(x.previsto_horas for x in com_h)
    pct = f"{num(100 * h_real / h_prev, 1)}%" if h_prev else "—"
    m_horas = Memoria(
        chave="treino_horas", titulo="Horas de treinamento realizadas × contrato", valor=pct,
        formula="soma da carga horária dos treinamentos registrados no período do processo ÷ horas previstas no contrato",
        passos=(Passo("Processos com horas previstas", "", str(len(com_h))),
                Passo("Horas realizadas", "Σ carga horária dos registros", f"{num(h_real, 1)} h"),
                Passo("Horas previstas", "Σ previsto por função", f"{num(h_prev, 1)} h"),
                Passo("Cumprido", f"{num(h_real, 1)} ÷ {num(h_prev, 1)}", pct, True)),
        fontes=tuple(Fonte(x.nome, f"{num(x.horas or 0, 1)} h de {num(x.previsto_horas, 1)} h", x.funcao or "sem função", f"#{x.id}")
                     for x in com_h[:60]))
    grupos: dict[str, dict] = {}
    for x, d in medidos:
        g = grupos.setdefault(x.funcao or "Sem função", {"funcao": x.funcao or "Sem função", "_d": [], "_h": [],
                                                         "previsto_dias": x.previsto_dias, "previsto_horas": x.previsto_horas})
        g["_d"].append(d)
        g["_h"].append(x.horas or 0)
    por_funcao = []
    for g in sorted(grupos.values(), key=lambda g: g["funcao"]):
        md = mean(g["_d"])
        por_funcao.append({"funcao": g["funcao"], "processos": len(g["_d"]), "media_dias": round(md, 2),
                           "previsto_dias": g["previsto_dias"], "media_horas": round(mean(g["_h"]), 2),
                           "previsto_horas": g["previsto_horas"],
                           "desvio_dias": round(md - g["previsto_dias"], 2) if g["previsto_dias"] else None,
                           "acima": sum(1 for d in g["_d"] if g["previsto_dias"] and d > g["previsto_dias"])})
    return {"cards": [m_dias, m_horas], "por_funcao": por_funcao}
