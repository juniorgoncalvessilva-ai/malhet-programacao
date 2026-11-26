"""Endereço do encarregado por empresa e obra (spec 117): `/encarregado/<empresa>/<obra>`.

Os pedaços saem sozinhos do cadastro, sem nada para configurar: a empresa é o nome da contratada na Marca da obra e a
obra é o código dela (único). Obra sem contratada cadastrada fica sob "malhet". Trocar o nome da contratada muda o
endereço; o antigo continua abrindo pela obra (o código não muda) e a tela passa para o endereço novo.
"""
import re
import unicodedata

SEM_EMPRESA = "malhet"


def slug(texto: str | None) -> str:
    """'Construtora Ação & Cia.' → 'construtora-acao-cia'."""
    t = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")[:60]


def empresa_da_obra(nome_contratada: str | None) -> str:
    return slug(nome_contratada) or SEM_EMPRESA


def rota(nome_contratada: str | None, codigo_obra: str) -> dict:
    empresa, obra = empresa_da_obra(nome_contratada), slug(codigo_obra)
    return {"empresa": empresa, "obra": obra, "endereco": f"/encarregado/{empresa}/{obra}",
            "endereco_empresa": f"/encarregado/{empresa}",
            # spec 147: a mesma regra, para o apontador
            "endereco_apontador": f"/apontador/{empresa}/{obra}", "endereco_apontador_empresa": f"/apontador/{empresa}"}
