"""Foto de campo (prova da frente): JPEG, PNG ou WebP de verdade (assinatura), até 8 MB; o celular já reduz antes."""
from app.shared.errors import DomainError

ALVOS = ("desvio", "restricao", "linha", "auditoria", "acao", "evento", "registro")
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


def nome_seguro(texto: str, limite: int = 60) -> str:
    """Texto que serve de nome de arquivo/pasta em qualquer sistema (sem acento, sem barra, sem caractere estranho)."""
    import re
    import unicodedata

    t = re.sub(r"[·–—›/\\]", "-", texto or "")
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()
    t = re.sub(r"[^A-Za-z0-9._ -]+", "-", t)
    t = re.sub(r"\s*-[\s-]*", " - ", t)  # "004.00 · CMD – GERAL" → "004.00 - CMD - GERAL"
    return re.sub(r"\s+", " ", t).strip(" .-")[:limite].strip(" .-")


def nome_arquivo(dia: str, hora: str, area: str, tipo: str, fid: int, ext: str) -> str:
    """AAAAMMDD-HHMM-<frente>-<tipo>-<id>.jpg — quem baixa vê quando e onde sem abrir a foto (spec 119)."""
    limpa = lambda t: nome_seguro(t, 40).replace(" - ", "-").replace(" ", "-")  # noqa: E731
    partes = [dia + (f"-{hora}" if hora else ""), limpa(area), limpa(tipo), str(fid)]
    return "-".join(x for x in partes if x) + f".{ext}"
