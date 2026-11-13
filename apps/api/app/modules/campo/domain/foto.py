"""Foto de campo (prova da frente): JPEG, PNG ou WebP de verdade (assinatura), até 8 MB; o celular já reduz antes."""
from app.shared.errors import DomainError

ALVOS = ("desvio", "restricao", "linha", "auditoria", "acao")
LIMITE = 8 * 1024 * 1024
_ASSINATURAS = ((b"\xff\xd8\xff", "image/jpeg"), (b"\x89PNG\r\n\x1a\n", "image/png"))


def tipo_da_imagem(conteudo: bytes) -> str:
    if not conteudo:
        raise DomainError("foto vazia", "arquivo")
    if len(conteudo) > LIMITE:
        raise DomainError("foto maior que 8 MB", "arquivo")
    for sig, ctype in _ASSINATURAS:
        if conteudo.startswith(sig):
            return ctype
    if conteudo[:4] == b"RIFF" and conteudo[8:12] == b"WEBP":
        return "image/webp"
    raise DomainError("envie uma foto (JPEG, PNG ou WebP)", "arquivo")


def validar_alvo(alvo: str) -> str:
    if alvo not in ALVOS:
        raise DomainError(f"a foto vai em: {', '.join(ALVOS)}", "alvo")
    return alvo
