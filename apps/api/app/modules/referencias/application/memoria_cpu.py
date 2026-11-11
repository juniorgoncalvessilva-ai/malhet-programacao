"""Memória de cálculo da CPU: item da PQ → composição → auxiliares → linha de cada insumo no relatório.

Linguagem publicada para outros módulos (programação, equipes, importações): `origem_cpu` + `memorias_cpu`.
"""
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.referencias.domain import cpu_obra
from app.modules.referencias.domain.cpu_obra import Contribuicao
from app.modules.referencias.infra.cpu_gateway import CpuGateway
from app.modules.referencias.infra.models import (
    CpuComposicaoModel,
    CpuLinhaModel,
    CpuServicoModel,
    ItemPqModel,
    VersaoReferenciaModel,
)
from app.shared.memoria import Fonte, Memoria, Passo, num


@dataclass(frozen=True)
class OrigemCpu:
    item: str
    descricao_pq: str | None
    unid: str | None
    pq_rotulo: str | None
    cpu_rotulo: str | None
    cpu_arquivo: str | None
    cpu_carregado_em: datetime | None
    servico_original: str | None
    servico_linha: int | None
    composicao: str | None
    descricao_composicao: str | None
    composicao_linha: int | None
    composicao_vem_da: str  # "CPU" | "PQ" (take-off) | "—"
    contribuicoes: tuple[Contribuicao, ...]
    recursos: tuple[tuple[str, str, float], ...]  # (recurso, tipo, h/un) achatado
    recurso_governa: str | None
    coef_governa: float | None
    hh_un: float | None

    @property
    def sem_detalhe(self) -> bool:
        return bool(self.recursos) and not self.contribuicoes

    @property
    def origem(self) -> str:
        partes = ["CPU da obra", self.cpu_rotulo, self.cpu_arquivo]
        return " · ".join(p for p in partes if p)


def _versao(s: Session, vid: int | None) -> VersaoReferenciaModel | None:
    return s.get(VersaoReferenciaModel, vid) if vid else None


def _composicoes(s: Session, versao_id: int, raiz: str) -> dict[str, cpu_obra.Composicao]:
    """Remonta do banco as composições necessárias (raiz e auxiliares), com a linha do arquivo de cada insumo."""
    cabecalhos = {c.codigo: c for c in s.scalars(select(CpuComposicaoModel).where(CpuComposicaoModel.versao_id == versao_id))}
    out: dict[str, cpu_obra.Composicao] = {}
    fila = [raiz]
    while fila:
        lote = [c for c in dict.fromkeys(fila) if c not in out and c in cabecalhos]
        fila = []
        if not lote:
            break
        linhas: dict[str, list[CpuLinhaModel]] = {}
        for ln in s.scalars(select(CpuLinhaModel).where(CpuLinhaModel.versao_id == versao_id,
                                                        CpuLinhaModel.composicao.in_(lote)).order_by(CpuLinhaModel.ordem)):
            linhas.setdefault(ln.composicao, []).append(ln)
        for cod in lote:
            cab = cabecalhos[cod]
            lns = tuple(cpu_obra.LinhaCpu(x.codigo, x.descricao, x.unid, x.quantidade, x.preco, x.linha_arquivo)
                        for x in linhas.get(cod, []))
            out[cod] = cpu_obra.Composicao(cod, cab.descricao, lns, cab.custo, cab.linha_arquivo)
            fila.extend(x.codigo for x in lns if x.codigo in cabecalhos)
    return out


def origem_cpu(s: Session, obra_id: int, item: str, vigentes: dict[str, int]) -> OrigemCpu:
    par = CpuGateway(s, obra_id, vigentes).por_itens({item}).get(item)
    pq = s.scalar(select(ItemPqModel).where(ItemPqModel.versao_id == vigentes["PQ"], ItemPqModel.item == item)) \
        if "PQ" in vigentes else None
    vcpu, vpq = _versao(s, vigentes.get("CPU")), _versao(s, vigentes.get("PQ"))
    sv = s.scalar(select(CpuServicoModel).where(CpuServicoModel.versao_id == vcpu.id, CpuServicoModel.item == item)) \
        if vcpu else None
    comp = par.composicao if par else None
    cab = s.scalar(select(CpuComposicaoModel).where(CpuComposicaoModel.versao_id == vcpu.id,
                                                    CpuComposicaoModel.codigo == comp)) if vcpu and comp else None
    contrib: tuple[Contribuicao, ...] = ()
    if vcpu and comp and cab is not None:
        comps = _composicoes(s, vcpu.id, comp)
        if comps.get(comp) and comps[comp].linhas:
            contrib = tuple(cpu_obra.rastrear(comps, comp))
    return OrigemCpu(
        item=item, descricao_pq=pq.descricao if pq else None, unid=(pq.unid if pq else None) or (sv.unid if sv else None),
        pq_rotulo=vpq.rotulo if vpq else None, cpu_rotulo=vcpu.rotulo if vcpu else None,
        cpu_arquivo=vcpu.arquivo_origem if vcpu else None, cpu_carregado_em=vcpu.carregado_em if vcpu else None,
        servico_original=sv.item_original if sv else None, servico_linha=sv.linha_arquivo if sv else None,
        composicao=comp, descricao_composicao=par.descricao_composicao if par else None,
        composicao_linha=cab.linha_arquivo if cab else None,
        composicao_vem_da="CPU" if sv else ("PQ" if comp else "—"),
        contribuicoes=contrib,
        recursos=tuple((r.recurso, r.tipo, r.coef_por_unidade) for r in (par.recursos if par else ())),
        recurso_governa=par.recurso_governa if par else None, coef_governa=par.coef_governa if par else None,
        hh_un=par.hh_por_unidade if par else None)


def _linha(n: int | None) -> str:
    return f"linha {num(n, 0)}" if n else "linha não registrada"


def _caminho(c: Contribuicao) -> str:
    return " × ".join(f"{num(p.quantidade, 4)} ({p.codigo}, {_linha(p.linha)})" for p in c.caminho)


def fontes_base(o: OrigemCpu) -> list[Fonte]:
    f = [Fonte("Item da PQ", f"{o.item} – {o.descricao_pq or ''}".strip(" –"), f"PQ vigente · {o.pq_rotulo or '—'}",
               f"item {o.item}" + (f" ({o.unid})" if o.unid else ""))]
    if o.composicao_vem_da == "CPU":
        f.append(Fonte("Composição do item", f"{o.composicao} – {o.descricao_composicao or ''}".strip(" –"), o.origem,
                       f"{_linha(o.servico_linha)}: Serviço da Planilha {o.servico_original}"))
        if o.composicao_linha:
            f.append(Fonte("Detalhe da composição", o.composicao or "—", o.origem,
                           f"{_linha(o.composicao_linha)}: Composição: {o.composicao}"))
    elif o.composicao_vem_da == "PQ":
        f.append(Fonte("Composição do item", o.composicao or "—", f"PQ vigente · {o.pq_rotulo or '—'}",
                       "coluna composição do take-off (o item não está na CPU da obra)"))
    return f


def _nota_detalhe(o: OrigemCpu) -> tuple[str, ...]:
    if o.sem_detalhe:
        return ("Esta CPU foi importada antes da memória de cálculo: os coeficientes estão certos, mas a linha de cada "
                "insumo não foi guardada. Reimporte a CPU da obra em Importações para ver as linhas.",)
    return ()


def memorias_cpu(o: OrigemCpu, jornada: float, fonte_jornada: Fonte, unid: str | None = None) -> list[Memoria]:
    """HH/un, recurso que governa e índice do item, com a conta e a linha de cada insumo."""
    un = unid or o.unid or "un"
    mod = [c for c in o.contribuicoes if c.tipo == "MOD"]
    out: list[Memoria] = []
    # HH por unidade
    if o.contribuicoes:
        passos = [Passo(f"{c.recurso} ({c.codigo_insumo} em {c.composicao}, {_linha(c.linha_insumo)})",
                        f"{_caminho(c)} × {num(c.coef_insumo, 4)}" if c.caminho else num(c.coef_insumo, 4),
                        f"{num(c.contribuicao, 4)} HH/{un}") for c in mod]
    else:
        passos = [Passo(r, "coeficiente achatado da CPU", f"{num(cf, 4)} HH/{un}") for r, t, cf in o.recursos if t == "MOD"]
    passos.append(Passo("Total (soma da mão de obra)", " + ".join(p.resultado.split(" ")[0] for p in passos) or "—",
                        f"{num(o.hh_un, 4)} HH/{un}", True))
    fontes = fontes_base(o) + [Fonte(c.recurso, f"{num(c.coef_insumo, 4)} {c.unid}", o.origem,
                                     f"{_linha(c.linha_insumo)} · composição {c.composicao}"
                                     + (f" (via {', '.join(p.codigo for p in c.caminho)})" if c.caminho else ""))
                               for c in mod]
    out.append(Memoria("hh_un", "HH por unidade", f"{num(o.hh_un, 3)} HH/{un}",
                       "HH/un = Σ (HH de cada função de mão de obra por unidade; auxiliar × quantidade usada)",
                       tuple(passos), tuple(fontes),
                       _nota_detalhe(o) + (("Equipamentos (h de máquina) não entram no HH.",)
                                           if any(c.tipo == "EQU" for c in o.contribuicoes) else ())))
    # recurso que governa
    agreg: dict[str, float] = {}
    for r, t, cf in o.recursos:
        if t == "MOD":
            agreg[r] = agreg.get(r, 0.0) + cf
    if agreg:
        passos = [Passo(f"{r} · {'apoio (não governa)' if cpu_obra.eh_apoio(r) else 'oficial'}", "h/un na composição",
                        f"{num(cf, 4)} HH/{un}", r == o.recurso_governa)
                  for r, cf in sorted(agreg.items(), key=lambda kv: -kv[1])]
        out.append(Memoria("governa", "Recurso que governa", o.recurso_governa or "—",
                           "governa = oficial com maior h/un; servente, ajudante, auxiliar, meio-oficial, encarregado, "
                           "apontador, vigia e feitor são apoio (entram no HH, não no ritmo)",
                           tuple(passos), tuple(fontes_base(o)),
                           ("Sem oficial na composição, governa a função de mão de obra de maior h/un; sem mão de obra, "
                            "o equipamento de maior h/un.",)))
    # índice
    if o.coef_governa:
        ind = jornada / o.coef_governa
        linhas_gov = [c for c in o.contribuicoes if c.recurso == o.recurso_governa]
        fontes = [fonte_jornada, Fonte(f"h/un de {o.recurso_governa}", f"{num(o.coef_governa, 4)} HH/{un}", o.origem,
                                       "; ".join(f"{_linha(c.linha_insumo)} ({c.composicao})" for c in linhas_gov)
                                       or "coeficiente achatado da CPU")] + fontes_base(o)
        out.append(Memoria("indice", f"Índice ({un}/dia por {o.recurso_governa})", f"{num(ind, 2)} {un}/dia",
                           "índice = jornada ÷ h/un do recurso que governa",
                           (Passo(f"{o.recurso_governa}", f"{num(jornada, 2)} h ÷ {num(o.coef_governa, 4)} HH/{un}",
                                  f"{num(ind, 2)} {un}/dia por pessoa", True),),
                           tuple(fontes), _nota_detalhe(o)))
    return out
