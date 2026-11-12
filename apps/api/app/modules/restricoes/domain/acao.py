"""Restrição / ação do look-ahead (6WLA) — a linha da aba "Ações" do Plano de Ação da obra.

Fórmulas portadas da planilha (colunas G, S e T):
  semana  = semana da data reprogramada; sem ela, a do término do prazo          (G)
  farol   = 4 concluído · 2 reprogramado (hoje entre o término e a reprogramação) ·
            1 atrasado (hoje ≥ término e ≥ reprogramação) · 3 no prazo            (S)
  status2 = o texto do farol; cancelado fica cancelado                            (T)
6M (Ishikawa): MDO mão de obra · MET método · MAT material · MAQ máquina · MAB meio ambiente · MED medida.
"""
from dataclasses import dataclass
from datetime import date

from app.shared.errors import DomainError

STATUS1 = ("Pendente", "Concluído", "Cancelado")
SEIS_M = {"MDO": "Mão de Obra", "MET": "Método", "MAT": "Material", "MAQ": "Máquina", "MAB": "Meio Ambiente",
          "MED": "Medida"}
FAROL = {1: "Atrasado", 2: "Reprogramado", 3: "No Prazo", 4: "Concluído"}


@dataclass(frozen=True)
class Situacao:
    farol: int | None  # 1..4 (None = cancelado)
    status2: str


def situacao(status1: str, termino: date | None, reprogramado: date | None, hoje: date) -> Situacao:
    if status1 == "Concluído":
        return Situacao(4, "Concluído")
    if status1 == "Cancelado":
        return Situacao(None, "Cancelado")
    if termino is None:
        return Situacao(3, "No Prazo")
    if hoje >= termino and reprogramado is not None and hoje <= reprogramado:
        return Situacao(2, "Reprogramado")
    if hoje >= termino:
        return Situacao(1, "Atrasado")
    return Situacao(3, "No Prazo")


def data_da_semana(termino: date | None, reprogramado: date | None) -> date | None:
    return reprogramado or termino


def validar_status1(v: str | None) -> str:
    t = (v or "Pendente").strip()
    for s in STATUS1:
        if t.casefold() == s.casefold() or t.casefold().replace("í", "i") == s.casefold().replace("í", "i"):
            return s
    raise DomainError("status: Pendente, Concluído ou Cancelado", "status1")


def validar_6m(v: str | None) -> str | None:
    t = (v or "").strip().upper()
    if not t:
        return None
    if t in SEIS_M:
        return t
    for k, nome in SEIS_M.items():
        if nome.upper() == t or nome.upper().replace("Ã", "A").replace("É", "E") == t:
            return k
    raise DomainError(f"6M inválido: {v} (MDO, MET, MAT, MAQ, MAB ou MED)", "seis_m")


def validar_prazo(inicio: date | None, termino: date | None) -> None:
    if inicio and termino and termino < inicio:
        raise DomainError("o término do prazo é antes do início", "prazo_termino")


def ler_sim_nao(v) -> bool | None:
    t = str(v or "").strip().casefold()
    if t in ("sim", "s", "x", "true", "1"):
        return True
    if t in ("não", "nao", "n", "false", "0"):
        return False
    return None
