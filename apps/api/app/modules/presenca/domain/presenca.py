"""Apropriação de presença (spec 063): leitura do crachá (NFC, QR/código de barras), do rosto ou marcação manual no
celular, guardada no aparelho e sincronizada depois. Aqui só as regras, sem banco.

- Uma pessoa está presente no dia se houve pelo menos uma leitura dela na data (vale a primeira, com o meio usado).
- A leitura tem um id gerado no celular (`id_local`): reenviar a fila não duplica.
- Rosto: guardamos só o descritor (128 números) que o modelo de reconhecimento gera, nunca a foto; exige consentimento.
"""
import math
import re
from dataclasses import dataclass
from datetime import date, datetime

from app.shared.errors import DomainError

MEIOS = ("nfc", "qr", "codigo", "facial", "manual")
TAM_DESCRITOR = 128
DISTANCIA_MAX = 0.5  # o celular só aceita o rosto mais próximo abaixo disto (distância euclidiana do descritor)
_ID = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def normalizar_codigo(v: str | None) -> str | None:
    """Código do crachá (QR/barras) ou número de série do NFC: sem espaços, ':' ou '-', em maiúsculas."""
    if v is None:
        return None
    x = re.sub(r"[\s:\-]", "", str(v)).upper()
    if not x:
        return None
    if len(x) > 60:
        raise DomainError("código do crachá com mais de 60 caracteres", "codigo")
    return x


def validar_descritor(v: list | None) -> list[float] | None:
    if v is None:
        return None
    if not isinstance(v, list) or len(v) != TAM_DESCRITOR:
        raise DomainError(f"descritor facial deve ter {TAM_DESCRITOR} números", "face")
    try:
        nums = [float(x) for x in v]
    except (TypeError, ValueError):
        raise DomainError("descritor facial inválido", "face") from None
    if not all(math.isfinite(x) and -5 <= x <= 5 for x in nums):
        raise DomainError("descritor facial inválido", "face")
    return [round(x, 6) for x in nums]


@dataclass(frozen=True)
class Leitura:
    id_local: str
    colaborador_id: int
    data: date
    hora: datetime
    meio: str

    def __post_init__(self):
        if not _ID.match(self.id_local or ""):
            raise DomainError("id da leitura inválido", "id_local")
        if self.meio not in MEIOS:
            raise DomainError(f"meio de leitura inválido: {self.meio}", "meio")
        if abs((self.hora.date() - self.data).days) > 1:
            raise DomainError("hora da leitura fora do dia informado", "hora")


def primeiras_do_dia(leituras: list[tuple[int, datetime, str]]) -> dict[int, tuple[datetime, str, int]]:
    """colaborador → (primeira hora, meio dela, nº de leituras) — presença do dia."""
    out: dict[int, tuple[datetime, str, int]] = {}
    for cid, hora, meio in sorted(leituras, key=lambda x: x[1]):
        if cid in out:
            h, m, n = out[cid]
            out[cid] = (h, m, n + 1)
        else:
            out[cid] = (hora, meio, 1)
    return out
