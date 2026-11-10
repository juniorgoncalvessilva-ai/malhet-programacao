"""PQ do contrato e take-off → versão PQ (estrutura completa + quantidade por TAG).

Aceita os dois arquivos da obra:
- PQ do contrato (ex.: "C.01 - PQ-1485AA-C-00019 Rev.11"): abas **PQ** e **MC**.
- Take-off (ex.: "5º TAKE OFF CONTRATO"): abas **PQ CONTRATO** e **MC FRENTES**.

Aba PQ (mesmo layout nos dois): A ITEM | B EAP (no take-off = CPU ESP.48.xxx) | C SubÁrea | D Nº do Ativo |
E–I CÓD. ATIVIDADE (K TT UU VVV WWW) | J DESCRIÇÃO | K UNID. | L–P CRITÉRIO DE MEDIÇÃO (CMS K TT UU Seq) |
Q QUANTIDADE | R PREÇO UNITÁRIO | S TOTAL. Linhas sem unidade são títulos da estrutura (níveis 1 a 4); com
unidade são os itens medidos (folhas).

Quantidade por TAG:
- MC (PQ do contrato): E–I código da atividade, L unid., M quantidade, P TAG (AR-1600AA-01) → casa pelo código.
  O mesmo código aparece em mais de um bloco da PQ quando o título de nível 1 se repete (ex.: seções 1–5 e 6–9,
  a segunda só da área 1485AA): o bloco cuja descrição cita a área da TAG ganha; senão, o bloco sem área.
- MC FRENTES (take-off): A CPU, C área, D subárea, E ativo, F–J código, M unid., N quantidade → casa por (CPU, código).
"""
import re
from collections import defaultdict
from typing import BinaryIO

from openpyxl import load_workbook
from sqlalchemy.orm import Session

from app.modules.frentes.domain.frentes import normalizar_tag
from app.modules.referencias.application.versoes import ResultadoCarga, ativar_versao, nova_versao
from app.modules.referencias.infra.models import ItemPqModel, PqQuantidadeTagModel
from app.shared import simova

_ITEM = re.compile(r"^\d+(\.\d+)*$")
_AREA = re.compile(r"(\d{4}[A-Z]{2})")
_CPU = re.compile(r"^[A-Z]{2,}\.\d+\.\d+", re.I)


def _txt(v) -> str | None:
    return simova.codigo(v)


def _num(v) -> float | None:
    try:
        return simova.numero(v)
    except ValueError:
        return None


def _cod(partes) -> str:
    return ".".join(str(simova.codigo(p) or "") for p in partes)


def _cel(r, i):
    return r[i] if r is not None and i < len(r) else None


def _criterio(r) -> str | None:
    cms = _txt(_cel(r, 11))
    partes = [_txt(_cel(r, i)) for i in range(12, 16)]
    if not cms and not any(partes):
        return None
    return " ".join(x for x in (cms, ".".join(p for p in partes if p)) if x)


def linhas_pq(ws):
    """Todas as linhas com ITEM (títulos e itens), na ordem da planilha."""
    ordem = 0
    for r in ws.iter_rows(min_row=8, values_only=True):
        item = _txt(_cel(r, 0))
        if not item or not _ITEM.match(item):
            continue
        ordem += 1
        unid = _txt(_cel(r, 10))
        eap = _txt(_cel(r, 1))
        yield {"item": item, "nivel": item.count(".") + 1, "folha": bool(unid), "ordem": ordem,
               "cpu": eap if eap and _CPU.match(eap) else None, "cod": _cod(r[4:9]),
               "descricao": _txt(_cel(r, 9)) or "", "unid": unid, "criterio": _criterio(r) if unid else None,
               "quantidade": _num(_cel(r, 16)), "pu": _num(_cel(r, 17)), "total": _num(_cel(r, 18))}


def _linhas_mc_frentes(ws):
    for r in ws.iter_rows(min_row=10, values_only=True):
        if not r or not _txt(r[0]) or _num(_cel(r, 13)) is None:
            continue
        area, sub, ativo = _txt(r[2]), _txt(r[3]), _txt(r[4])
        tag = f"{area}{sub}-{ativo}" if area and sub and ativo and ativo.upper() != "GERAL" else (ativo or "GERAL").upper()
        yield {"cpu": _txt(r[0]), "cod": _cod(r[5:10]), "tag": tag, "unid": _txt(_cel(r, 12)), "quantidade": _num(r[13])}


def _linhas_mc(ws):
    for r in ws.iter_rows(min_row=12, values_only=True):
        q = _num(_cel(r, 12))
        unid = _txt(_cel(r, 11))
        if q is None or not unid:
            continue
        bruto = _txt(_cel(r, 15)) or _txt(_cel(r, 3)) or "GERAL"
        tag = normalizar_tag(bruto) or bruto.upper()
        yield {"cpu": None, "cod": _cod(r[4:9]), "tag": tag, "unid": unid, "quantidade": q}


def blocos_por_area(linhas: list[dict]) -> tuple[dict[str, int], dict[int, str | None]]:
    """Seção de nível 1 → bloco (novo bloco quando o título de nível 1 se repete); bloco → área citada (≥3 itens)."""
    bloco_da_secao: dict[str, int] = {}
    titulos_vistos: set[str] = set()
    bloco = 0
    citacoes: dict[int, dict[str, int]] = {}
    for p in linhas:
        sec = p["item"].split(".")[0]
        if p["nivel"] == 1:
            t = " ".join(p["descricao"].upper().split())
            if t in titulos_vistos:
                bloco += 1
                titulos_vistos = set()
            titulos_vistos.add(t)
            bloco_da_secao[sec] = bloco
        elif p["folha"]:
            m = _AREA.search(p["descricao"] or "")
            if m:
                c = citacoes.setdefault(bloco_da_secao.get(sec, 0), {})
                c[m.group(1)] = c.get(m.group(1), 0) + 1
    area = {b: max(c.items(), key=lambda kv: kv[1])[0] if c and max(c.values()) >= 3 else None
            for b, c in citacoes.items()}
    return bloco_da_secao, area


def escolher_item(cands: list[str], tag: str, bloco_da_secao: dict[str, int], area_do_bloco: dict[int, str | None]):
    if len(cands) <= 1:
        return cands[0] if cands else None
    m = _AREA.search(tag or "")
    area = m.group(1) if m else None

    def area_de(item):
        return area_do_bloco.get(bloco_da_secao.get(item.split(".")[0], 0))
    for criterio in (lambda it: area and area_de(it) == area, lambda it: area_de(it) is None):
        alvo = [it for it in cands if criterio(it)]
        if len(alvo) == 1:
            return alvo[0]
    return None


def _aba(wb, *nomes):
    por_nome = {n.strip().upper(): n for n in wb.sheetnames}
    return next((wb[por_nome[n]] for n in nomes if n in por_nome), None)


def carregar_takeoff(session: Session, obra_id: int, arquivo: BinaryIO, *, nome_arquivo: str, rotulo: str,
                     usuario: str, ativar: bool = True) -> ResultadoCarga:
    wb = load_workbook(arquivo, read_only=True, data_only=True)
    res = ResultadoCarga()
    aba_pq = _aba(wb, "PQ CONTRATO", "PQ")
    if aba_pq is None:
        res.avisos.append("aba PQ (ou PQ CONTRATO) não encontrada")
        return res
    v = nova_versao(session, obra_id, "PQ", rotulo, usuario, None, nome_arquivo,
                    "PQ do contrato" if aba_pq.title.strip().upper() == "PQ" else "take-off")
    por_chave: dict[tuple[str | None, str], str] = {}
    por_cod: dict[str, list[str]] = defaultdict(list)
    por_cpu: dict[str | None, list[str]] = defaultdict(list)
    vistos, folhas = set(), 0
    titulos: list[str] = ["", "", "", "", ""]
    todas = list(linhas_pq(aba_pq))
    bloco_da_secao, area_do_bloco = blocos_por_area(todas)
    for p in todas:
        if p["item"] in vistos:
            continue
        vistos.add(p["item"])
        if not p["folha"]:
            titulos[min(p["nivel"], 5) - 1] = p["descricao"]
        session.add(ItemPqModel(
            versao_id=v.id, item=p["item"], descricao=p["descricao"][:500], unid=p["unid"], quantidade=p["quantidade"],
            pu=p["pu"], total=p["total"], composicao=p["cpu"], nivel=p["nivel"], folha=p["folha"], ordem=p["ordem"],
            codigo_atividade=p["cod"][:20] if p["cod"].strip(".") else None, criterio=(p["criterio"] or None),
            grupo=(titulos[0] or None) and titulos[0][:200], subgrupo=(titulos[1] or None) and titulos[1][:200]))
        if p["folha"]:
            folhas += 1
            por_chave[(p["cpu"], p["cod"])] = p["item"]
            por_cod[p["cod"]].append(p["item"])
            por_cpu[p["cpu"]].append(p["item"])
    res.contagem["PQ"] = folhas
    res.contagem["ESTRUTURA"] = len(vistos) - folhas

    somas: dict[tuple[str, str], list] = {}
    sem_item = 0
    aba_mc = _aba(wb, "MC FRENTES", "MC")
    if aba_mc is not None:
        frentes = aba_mc.title.strip().upper() == "MC FRENTES"
        for m in (_linhas_mc_frentes(aba_mc) if frentes else _linhas_mc(aba_mc)):
            if frentes:
                item = por_chave.get((m["cpu"], m["cod"])) or (
                    por_cpu[m["cpu"]][0] if len(por_cpu[m["cpu"]]) == 1 else None)
            else:
                item = escolher_item(por_cod.get(m["cod"], []), m["tag"], bloco_da_secao, area_do_bloco)
            if not item:
                sem_item += 1
                continue
            k = (item, m["tag"])
            if k in somas:
                somas[k][0] += m["quantidade"] or 0
            else:
                somas[k] = [m["quantidade"] or 0, m["unid"]]
        for (item, tag), (q, unid) in somas.items():
            session.add(PqQuantidadeTagModel(versao_id=v.id, item=item, tag=tag[:40], quantidade=round(q, 4), unid=unid))
        if sem_item:
            res.avisos.append(f"{sem_item} linha(s) da {aba_mc.title.strip()} sem item de PQ correspondente")
    else:
        res.avisos.append("aba MC (memória de cálculo) não encontrada: sem quantidade por TAG")
    res.contagem["QTD_TAG"] = len(somas)
    v.qtd_itens = folhas
    res.versoes["PQ"] = v.id
    if ativar:
        ativar_versao(session, v.id, obra_id)
    session.flush()
    return res
