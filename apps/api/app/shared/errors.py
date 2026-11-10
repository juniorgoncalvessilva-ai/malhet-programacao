class DomainError(Exception):
    """Violação de regra de negócio. A API converte em HTTP 422."""

    def __init__(self, mensagem: str, campo: str | None = None):
        super().__init__(mensagem)
        self.mensagem = mensagem
        self.campo = campo


class NotFoundError(Exception):
    def __init__(self, recurso: str, chave: object):
        super().__init__(f"{recurso} '{chave}' não encontrado")
        self.recurso = recurso
        self.chave = chave
