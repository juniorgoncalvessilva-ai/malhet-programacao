"""Controle preventivo — etilômetro (spec 073). Só regras, sem banco.

- Faixas configuráveis por obra (padrão da lei de trânsito): até 0,04 mg/L sem penalidade; de 0,05 a 0,33 infração
  gravíssima; a partir de 0,34 crime; recusa = mesmas penalidades da gravíssima. Cada faixa começa em `de` (mg/L).
- Reprovado no 1º teste → contraprova depois de `contraprova_minutos`; o resultado que vale é o da contraprova.
- O evento (sessão de testes) só começa com aparelho de calibração válida na data, fotos do aparelho e da calibração e o
  responsável identificado pelo crachá; ele assina de novo ao encerrar. Cada colaborador assina o próprio resultado.
"""
import math
from datetime import date

from app.shared.errors import DomainError

RESULTADOS = ("aprovado", "reprovado")
MEIOS_ASSINATURA = ("facial", "nfc", "qr", "codigo", "desenho", "manual")
VALOR_MAX = 5.0  # mg/L — acima disso é erro de digitação
DESENHO_MAX = 80_000  # caracteres do data URL da assinatura desenhada

CONFIG_PADRAO = {
    "unidade": "mg/L",
    "contraprova_minutos": 15,
    "faixas": [
        {"de": 0.0, "rotulo": "Sem penalidade administrativa", "resultado": "aprovado", "penalidade": ""},
        {"de": 0.05, "rotulo": "Infração gravíssima", "resultado": "reprovado",
         "penalidade": "Multa de R$ 2.934,70 e suspensão da CNH por 12 meses"},
        {"de": 0.34, "rotulo": "Crime de trânsito", "resultado": "reprovado", "penalidade": "Detenção de 6 meses a 3 anos"},
    ],
    "recusa": {"rotulo": "Recusa ao teste", "resultado": "reprovado",
               "penalidade": "Mesmas penalidades da infração gravíssima (multa e suspensão da CNH)"},
}


def _txt(v, campo: str, maximo: int, obrigatorio: bool = True) -> str:
    t = " ".join(str(v or "").split())
    if obrigatorio and not t:
        raise DomainError(f"{campo}: preencha", campo)
    if len(t) > maximo:
        raise DomainError(f"{campo}: até {maximo} caracteres", campo)
    return t


def validar_config(cfg: dict) -> dict:
    """Confere e normaliza a configuração: faixas em ordem crescente começando em 0, resultado aprovado/reprovado."""
    if not isinstance(cfg, dict):
        raise DomainError("configuração inválida")
    try:
        minutos = int(cfg.get("contraprova_minutos", 15))
    except (TypeError, ValueError):
        raise DomainError("tempo da contraprova inválido", "contraprova_minutos") from None
    if not 1 <= minutos <= 120:
        raise DomainError("tempo da contraprova: de 1 a 120 minutos", "contraprova_minutos")
    faixas = []
    for i, f in enumerate(cfg.get("faixas") or []):
        try:
            de = round(float(f.get("de")), 3)
        except (TypeError, ValueError):
            raise DomainError(f"faixa {i + 1}: valor inicial inválido", "faixas") from None
        if f.get("resultado") not in RESULTADOS:
            raise DomainError(f"faixa {i + 1}: resultado deve ser aprovado ou reprovado", "faixas")
        faixas.append({"de": de, "rotulo": _txt(f.get("rotulo"), f"faixa {i + 1}: nome", 80),
                       "resultado": f["resultado"], "penalidade": _txt(f.get("penalidade"), "penalidade", 200, False)})
    if not faixas:
        raise DomainError("cadastre pelo menos uma faixa", "faixas")
    if faixas[0]["de"] != 0:
        raise DomainError("a primeira faixa começa em 0", "faixas")
    if any(b["de"] <= a["de"] for a, b in zip(faixas, faixas[1:])):
        raise DomainError("as faixas devem estar em ordem crescente, sem repetir o valor inicial", "faixas")
    r = cfg.get("recusa") or {}
    if r.get("resultado", "reprovado") not in RESULTADOS:
        raise DomainError("recusa: resultado deve ser aprovado ou reprovado", "recusa")
    recusa = {"rotulo": _txt(r.get("rotulo") or "Recusa ao teste", "recusa", 80), "resultado": r.get("resultado", "reprovado"),
              "penalidade": _txt(r.get("penalidade"), "penalidade da recusa", 200, False)}
    return {"unidade": "mg/L", "contraprova_minutos": minutos, "faixas": faixas, "recusa": recusa}


def validar_valor(v: float | None) -> float:
    try:
        x = float(v)
    except (TypeError, ValueError):
        raise DomainError("informe o resultado em mg/L", "valor") from None
    if not math.isfinite(x) or x < 0 or x > VALOR_MAX:
        raise DomainError(f"resultado fora do possível (0 a {VALOR_MAX} mg/L) — confira a digitação", "valor")
    return round(x, 3)


def classificar(cfg: dict, valor: float | None, recusa: bool) -> dict:
    """Resultado do teste pela faixa em que o valor cai (ou a regra da recusa)."""
    if recusa:
        r = cfg["recusa"]
        return {"resultado": r["resultado"], "faixa": r["rotulo"], "penalidade": r["penalidade"], "valor": None}
    v = validar_valor(valor)
    f = [x for x in cfg["faixas"] if x["de"] <= v + 1e-9][-1]
    return {"resultado": f["resultado"], "faixa": f["rotulo"], "penalidade": f["penalidade"], "valor": v}


def pede_contraprova(tentativa: int, resultado: str, recusa: bool) -> bool:
    return tentativa == 1 and resultado == "reprovado" and not recusa


def conferir_aparelho(calibracao: date | None, validade: date | None, no_dia: date) -> None:
    if validade is None:
        raise DomainError("aparelho sem validade da calibração cadastrada", "aparelho")
    if validade < no_dia:
        raise DomainError(f"calibração do aparelho vencida em {validade.strftime('%d/%m/%Y')}", "aparelho")
    if calibracao and calibracao > no_dia:
        raise DomainError("data de calibração no futuro — confira o cadastro do aparelho", "aparelho")


def validar_assinatura(a: dict | None, campo: str = "assinatura") -> dict:
    if not isinstance(a, dict) or a.get("meio") not in MEIOS_ASSINATURA:
        raise DomainError(f"{campo}: assine com rosto, crachá ou na tela", campo)
    out = {"meio": a["meio"], "hora": str(a.get("hora") or "")[:40] or None}
    if a.get("distancia") is not None:
        out["distancia"] = round(float(a["distancia"]), 4)
    if a["meio"] == "desenho":
        d = str(a.get("desenho") or "")
        if not d.startswith("data:image/") or len(d) > DESENHO_MAX:
            raise DomainError(f"{campo}: assinatura desenhada inválida", campo)
        out["desenho"] = d
    if a.get("codigo"):
        out["codigo"] = str(a["codigo"])[:60]
    return out


def situacao_final(testes: list[dict]) -> dict:
    """Por pessoa: o último teste vale (contraprova). Reprovado no 1º sem contraprova = contraprova pendente."""
    ult = max(testes, key=lambda t: (t["tentativa"], t["hora"] or ""))
    pend = ult["tentativa"] == 1 and pede_contraprova(1, ult["resultado"], ult["recusa"])
    return {"resultado": ult["resultado"], "faixa": ult["faixa"], "valor": ult["valor"], "contraprova_pendente": pend,
            "tentativas": len(testes)}
