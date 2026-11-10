"""Cadastros de SSMA da programação: listas que alimentam as listas suspensas de cada linha.

Segurança mantém Técnico de segurança responsável, RAC, PTS, ART e ATA (Autorização de Trabalho Ambiental).
O PTO (Plano de Trabalho de Obra) é do Planejamento: cadastro e escolha ficam com o planejador, na programação.
"""
from dataclasses import dataclass
from datetime import date
from enum import StrEnum

from app.shared.errors import DomainError

NAO_SE_APLICA = "N/A"


class TipoCadastro(StrEnum):
    TECNICO = "TECNICO"
    RAC = "RAC"
    PTS = "PTS"
    ART = "ART"
    ATA = "ATA"
    PTO = "PTO"

    @property
    def rotulo(self) -> str:
        return {"TECNICO": "Técnico de segurança responsável", "RAC": "RAC", "PTS": "PTS", "ART": "ART",
                "ATA": "ATA (Autorização de Trabalho Ambiental)", "PTO": "PTO (Plano de Trabalho de Obra)"}[self.value]

    @property
    def do_planejamento(self) -> bool:
        return self is TipoCadastro.PTO

    @property
    def campo_linha(self) -> str:
        return f"ssma_{self.value.lower() if self is not TipoCadastro.TECNICO else 'tecnico'}"


# campos da linha preenchidos pela segurança (tela SSMA) e pelo planejamento (montar)
CAMPOS_SEGURANCA = ("tecnico", "rac", "pts", "art", "ata")
CAMPOS_PLANEJAMENTO = ("pto",)
TIPO_DO_CAMPO = {"tecnico": TipoCadastro.TECNICO, "rac": TipoCadastro.RAC, "pts": TipoCadastro.PTS,
                 "art": TipoCadastro.ART, "ata": TipoCadastro.ATA, "pto": TipoCadastro.PTO}


@dataclass(frozen=True)
class ItemCadastro:
    tipo: TipoCadastro
    codigo: str
    descricao: str | None = None
    validade: date | None = None

    def __post_init__(self) -> None:
        cod = " ".join((self.codigo or "").split())
        if not cod:
            raise DomainError("informe o nome ou número", "codigo")
        if cod.upper() == NAO_SE_APLICA:
            raise DomainError("N/A já existe em toda lista; não precisa cadastrar", "codigo")
        limite = 150 if self.tipo is TipoCadastro.TECNICO else 60
        if len(cod) > limite:
            raise DomainError(f"máximo {limite} caracteres", "codigo")
        object.__setattr__(self, "codigo", cod)
        object.__setattr__(self, "descricao", (" ".join((self.descricao or "").split()) or None))


def valor_da_linha(valor: str | None, validos: set[str], tipo: TipoCadastro) -> str | None:
    """Vazio, N/A ou um item ativo do cadastro (a lista suspensa garante; a API confere)."""
    v = " ".join((valor or "").split())
    if not v:
        return None
    if v.upper() in (NAO_SE_APLICA, "NA"):
        return NAO_SE_APLICA
    if v not in validos:
        raise DomainError(f"{tipo.rotulo}: '{v}' não está no cadastro (cadastre antes ou use N/A)", tipo.value.lower())
    return v
