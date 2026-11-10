"""Linguagem publicada do cadastro de SSMA (a programação confere os valores das listas suspensas)."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.ssma.domain.cadastro import TIPO_DO_CAMPO, valor_da_linha
from app.modules.ssma.infra.models import CadastroSsmaModel


class CadastroSsmaGateway:
    def __init__(self, s: Session, obra_id: int):
        self.s, self.obra_id = s, obra_id
        self._cache: dict[str, set[str]] = {}

    def validos(self, tipo: str) -> set[str]:
        if tipo not in self._cache:
            self._cache[tipo] = set(self.s.scalars(select(CadastroSsmaModel.codigo).where(
                CadastroSsmaModel.obra_id == self.obra_id, CadastroSsmaModel.tipo == tipo,
                CadastroSsmaModel.ativo.is_(True))))
        return self._cache[tipo]

    def conferir(self, campo: str, valor: str | None, atual: str | None = None) -> str | None:
        """Valor aceito para o campo da linha. O valor que a linha já tem continua valendo (item inativado depois)."""
        tipo = TIPO_DO_CAMPO[campo]
        v = " ".join((valor or "").split()) or None
        if v is not None and v == atual:
            return v
        return valor_da_linha(v, self.validos(tipo.value), tipo)
