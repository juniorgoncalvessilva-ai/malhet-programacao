"""Menu do computador por perfil (spec 090): a barra lateral mostra só as telas atreladas ao perfil (papel) na obra.

Ordem de quem manda: o menu do perfil definido pelo admin da obra → o padrão do sistema (abaixo). Por cima disso:
- a permissão do papel continua valendo (tela de planejador não entra no menu do encarregado, nem pelo admin);
- a lista de páginas da pessoa (Acessos e usuários) ainda pode restringir mais;
- a Programação vigente fica sempre; o admin nunca perde Acessos e Menus por perfil.
As urls são as de `apps/web/src/components/Malhet/menu.ts` (um teste confere que as duas listas batem).
"""
from app.shared.errors import DomainError

PLANEJADOR, ADMIN, SSMA = "planejador", "admin", "ssma"

# url → exigência do papel (None = qualquer papel; "ssma" = segurança, planejador e admin)
TELAS_WEB: dict[str, str | None] = {
    # Projeto e escopo (spec 125: grupos pelo ciclo da obra; a ordem daqui é a do padrão do admin e do planejador)
    "/app/documentos": None, "/app/takeoff": None, "/app/wbs": None, "/app/criterios": None,
    # Planejar
    "/app/cronograma": None, "/app/plano": None, "/app/restricoes": None, "/app/lookahead": None, "/app/programacoes": None,
    "/app/pto": PLANEJADOR,
    # Executar
    "/app/vigente": None, "/app/presenca": None, "/app/resumo-dia": None, "/app/fotos": None, "/app/auditorias": None,
    # Medir e melhorar
    "/app/indicadores": None, "/app/desvios": None, "/app/aderencia": None, "/app/acoes": None,
    # Pessoas e equipes
    "/app/efetivo": None, "/app/efetivo/mobilizacao": None, "/app/equipes": None, "/app/efetivo/organograma": None,
    "/app/lideres": PLANEJADOR,
    # Segurança (SSMA)
    "/app/ssma/cadastros": SSMA, "/app/ssma": SSMA, "/app/preventivos": None, "/app/lgpd": SSMA,
    # Configurar
    "/app/importacoes": None, "/app/frentes": None, "/app/catalogo": None, "/app/efetivo/setores": None,
    "/app/efetivo/funcoes": None, "/app/efetivo/identificacao": PLANEJADOR,
    "/app/acessos": ADMIN, "/app/menu-celular": ADMIN, "/app/marca": ADMIN, "/app/partes": PLANEJADOR, "/app/armazenamento": ADMIN, "/app/exclusoes": ADMIN,
}
SEMPRE = ("/app/vigente",)
SEMPRE_ADMIN = ("/app/acessos", "/app/menu-celular")
NIVEL = {"leitor": 0, "seguranca": 0, "encarregado": 1, "planejador": 2, "admin": 3}


def permitida(papel: str, url: str) -> bool:
    req = TELAS_WEB.get(url, "?")
    if req == "?":
        return False
    if req is None:
        return True
    if req == SSMA:
        return papel in ("seguranca", "planejador", "admin")
    return NIVEL.get(papel, -1) >= NIVEL[req]


_TODAS = list(TELAS_WEB)
PADRAO_WEB: dict[str, list[str]] = {
    "admin": _TODAS,
    "planejador": [u for u in _TODAS if TELAS_WEB[u] != ADMIN],
    "encarregado": ["/app/vigente", "/app/documentos", "/app/programacoes", "/app/lookahead", "/app/restricoes", "/app/desvios",
                    "/app/resumo-dia", "/app/fotos", "/app/auditorias", "/app/acoes", "/app/preventivos",
                    "/app/presenca", "/app/equipes", "/app/efetivo/organograma"],
    "seguranca": ["/app/ssma/cadastros", "/app/ssma", "/app/documentos", "/app/preventivos", "/app/lgpd",
                  "/app/auditorias", "/app/acoes", "/app/resumo-dia", "/app/fotos", "/app/vigente", "/app/lookahead",
                  "/app/presenca", "/app/efetivo", "/app/efetivo/organograma"],
    "leitor": ["/app/vigente", "/app/documentos", "/app/cronograma", "/app/plano", "/app/programacoes", "/app/lookahead", "/app/restricoes",
               "/app/desvios", "/app/indicadores", "/app/aderencia", "/app/resumo-dia", "/app/fotos", "/app/efetivo/organograma"],
}


def validar_menu_web(papel: str, paginas: list[str]) -> list[str]:
    """Lista ordenada e sem repetição; só telas conhecidas e permitidas ao papel; obrigatórias entram sozinhas."""
    if papel not in NIVEL:
        raise DomainError("perfil desconhecido", "papel")
    out: list[str] = []
    for u in paginas:
        if u not in TELAS_WEB:
            raise DomainError(f"tela desconhecida: {u}", "paginas")
        if not permitida(papel, u):
            raise DomainError(f"o perfil {papel} não tem permissão para {u}", "paginas")
        if u not in out:
            out.append(u)
    for u in SEMPRE + (SEMPRE_ADMIN if papel == "admin" else ()):
        if u not in out:
            out.append(u)
    return out
