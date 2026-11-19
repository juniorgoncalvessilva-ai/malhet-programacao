"""Exclusão com autoridade (spec 112): auditorias já feitas e itens do book de fotos só saem pelo super admin ou por um
profissional que ele habilitou na obra — sempre com motivo, e cada passo vai para o histórico (o que saiu, quem, quando
e por quê; também quem habilitou ou desabilitou quem)."""
from app.shared.errors import DomainError

TIPOS = {"auditoria": "Auditoria", "foto": "Foto do book", "permissao": "Permissão de exclusão"}


def pode_excluir(superadmin: bool, habilitado: bool) -> bool:
    return superadmin or habilitado


def exigir(superadmin: bool, habilitado: bool) -> None:
    if not pode_excluir(superadmin, habilitado):
        raise DomainError("só o super admin ou quem ele habilitou exclui auditorias e fotos do book")


def validar_motivo(motivo: str | None) -> str:
    m = " ".join((motivo or "").split())
    if len(m) < 5:
        raise DomainError("diga por que está excluindo (mín. 5 caracteres) — fica no histórico", "motivo")
    return m[:500]


def resumo_auditoria(numero: int, modelo: str | None, data: str | None, local: str | None) -> str:
    return " · ".join(x for x in (f"Auditoria Nº {numero}", modelo, data, local) if x)[:300]


def resumo_foto(alvo: str, legenda: str | None, data: str | None) -> str:
    nomes = {"linha": "atividade", "desvio": "ocorrência", "restricao": "restrição", "auditoria": "auditoria", "acao": "ação 5W2H",
             "evento": "controle preventivo"}
    return " · ".join(x for x in (f"Foto de {nomes.get(alvo, alvo)}", legenda, data) if x)[:300]
