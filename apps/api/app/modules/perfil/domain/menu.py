"""Menu do celular (spec 075): barra de baixo com até 4 atalhos + 1 botão central em destaque; o resto fica em "Mais".
Ordem de quem manda: o ajuste da própria pessoa → o padrão do perfil (papel) definido pelo admin da obra → o padrão do
sistema. A permissão continua valendo: tela não liberada para a pessoa nunca aparece, mesmo se estiver na barra."""
from app.shared.errors import DomainError

# telas do app de campo (as mesmas urls de src/components/Mobile/menu.ts)
TELAS = ("/m", "/m/vigente", "/m/lancar", "/m/presenca", "/m/ocorrencias", "/m/restricoes", "/m/pendencias", "/m/auditorias",
         "/m/acoes", "/m/preventivos", "/m/lgpd", "/m/notificacoes", "/m/perfil")
MAX_BARRA = 4

PADRAO = {
    "encarregado": {"barra": ["/m", "/m/vigente", "/m/lancar", "/m/ocorrencias"], "destaque": "/m/presenca"},
    "planejador": {"barra": ["/m", "/m/vigente", "/m/restricoes", "/m/ocorrencias"], "destaque": "/m/presenca"},
    "admin": {"barra": ["/m", "/m/vigente", "/m/restricoes", "/m/ocorrencias"], "destaque": "/m/presenca"},
    "seguranca": {"barra": ["/m", "/m/auditorias", "/m/acoes", "/m/lgpd"], "destaque": "/m/preventivos"},
    "leitor": {"barra": ["/m", "/m/vigente", "/m/ocorrencias", "/m/restricoes"], "destaque": None},
}


def validar_menu(barra: list[str] | None, destaque: str | None) -> dict:
    barra = list(barra or [])
    if len(barra) > MAX_BARRA:
        raise DomainError(f"a barra tem até {MAX_BARRA} atalhos (os outros ficam em Mais)", "barra")
    for u in barra + ([destaque] if destaque else []):
        if u not in TELAS:
            raise DomainError(f"tela desconhecida: {u}", "barra")
    if len(set(barra)) != len(barra) or (destaque and destaque in barra):
        raise DomainError("cada tela aparece uma vez só na barra", "barra")
    return {"barra": barra, "destaque": destaque or None}
