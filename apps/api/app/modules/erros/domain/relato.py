"""Relato de erro (spec 098): quando o app tenta algo e não consegue, ele mesmo avisa a equipe Malhet — de onde partiu
(tela e ação), o que aconteceu e em que versão. A pessoa não precisa saber explicar o erro.

Nada de dado pessoal: o texto passa por `limpar` (e-mail, CPF, telefone e números longos — matrícula/crachá — viram
máscara), o endereço vai sem a parte depois do "?" e números no caminho viram {id}. O comentário é da própria pessoa
(ela é avisada para não escrever dado pessoal) e também passa pela limpeza.
"""
import hashlib
import re
from dataclasses import dataclass, replace

from app.shared.errors import DomainError

ORIGENS = ("web", "campo", "nativo", "api")
TIPOS = ("js", "promessa", "tela", "api", "servidor", "manual")
MAX_MENSAGEM, MAX_PILHA, MAX_COMENTARIO, MAX_LOCAL = 500, 6000, 1000, 200

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")
_CPF = re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b")
_TELEFONE = re.compile(r"\(?\b\d{2}\)?\s?9?\d{4}-\d{4}\b")
_NUMERO_LONGO = re.compile(r"(?<![\w.#-])\d{5,}(?![\w.-])")  # matrícula, crachá, documento
_BEARER = re.compile(r"(?i)(bearer\s+)[\w.~+/=-]+")
_ID_NO_CAMINHO = re.compile(r"/\d+(?=/|$)")


def limpar(texto: str | None, limite: int) -> str:
    """Tira o que pode identificar alguém e corta no limite."""
    if not texto:
        return ""
    t = _BEARER.sub(r"\1***", str(texto))
    t = _EMAIL.sub("<e-mail>", t)
    t = _CPF.sub("<documento>", t)
    t = _TELEFONE.sub("<telefone>", t)
    t = _NUMERO_LONGO.sub("<número>", t)
    t = t.replace("\x00", "").strip()
    return t[:limite]


def local_seguro(caminho: str | None) -> str:
    """Tela de onde partiu, sem consulta (?c=…&m=…) nem âncora e com os números trocados por {id}."""
    c = (caminho or "").split("?")[0].split("#")[0].strip()
    c = re.sub(r"^https?://[^/]+", "", c)
    c = re.sub(r"^/(pt-BR|en|es)(?=/)", "", c)  # o idioma não muda o erro
    c = _ID_NO_CAMINHO.sub("/{id}", c)
    return limpar(c, MAX_LOCAL) or "/"


def acao_segura(acao: str | None) -> str:
    """Chamada que falhou, ex.: "POST /programacoes/{id}/emitir"."""
    if not acao:
        return ""
    partes = acao.strip().split(" ", 1)
    if len(partes) == 2 and partes[0].isalpha():
        return f"{partes[0].upper()[:7]} {local_seguro(partes[1])}"[:MAX_LOCAL]
    return local_seguro(acao)


def _primeira_linha_util(pilha: str) -> str:
    for linha in pilha.splitlines()[1:4]:
        # o nome do arquivo do build muda a cada deploy: só a função conta
        funcao = re.sub(r"\(?(https?://|/)\S+", "", linha).strip(" at()")
        if funcao:
            return funcao[:80]
    return ""


def assinatura(tipo: str, mensagem: str, local: str, acao: str, pilha: str = "") -> str:
    """Erros iguais (mesma mensagem, mesma tela/ação) caem no mesmo grupo, mesmo em versões diferentes."""
    msg = re.sub(r"\d+", "#", mensagem)[:200]
    base = "|".join((tipo, msg, acao or local, _primeira_linha_util(pilha)))
    return hashlib.sha1(base.encode()).hexdigest()[:16]


def codigo_de(id_local: str) -> str:
    """Código curto para a pessoa citar: E-3F9A2C."""
    limpo = re.sub(r"[^0-9a-fA-F]", "", id_local) or hashlib.sha1(id_local.encode()).hexdigest()
    return f"E-{limpo[:6].upper()}"


# spec 141: mensagens do navegador quando a rede cai (Safari, Chrome, Firefox)
SEM_REDE = re.compile(r"^(TypeError: )?network error$|Failed to fetch$|^(TypeError: )?Load failed$|NetworkError when attempting|"
                      r"net::ERR_|network connection was lost|Internet connection appears to be offline", re.I)

@dataclass(frozen=True)
class Relato:
    id_local: str
    origem: str
    tipo: str
    mensagem: str
    local: str
    acao: str = ""
    status: int | None = None
    pilha: str = ""
    comentario: str = ""
    versao: str = ""
    navegador: str = ""

    def __post_init__(self):
        if not re.fullmatch(r"[\w-]{8,64}", self.id_local or ""):
            raise DomainError("identificador do relato inválido", "id_local")
        if self.origem not in ORIGENS:
            raise DomainError(f"origem desconhecida: {self.origem}", "origem")
        if self.tipo not in TIPOS:
            raise DomainError(f"tipo desconhecido: {self.tipo}", "tipo")
        if not self.mensagem and not self.comentario:
            raise DomainError("diga o que aconteceu", "mensagem")
        if self.status is not None and not 0 <= self.status <= 599:
            raise DomainError("status HTTP inválido", "status")

    @classmethod
    def de_entrada(cls, *, id_local: str, origem: str, tipo: str, mensagem: str | None, local: str | None,
                   acao: str | None = None, status: int | None = None, pilha: str | None = None,
                   comentario: str | None = None, versao: str | None = None, navegador: str | None = None) -> "Relato":
        return cls(
            id_local=(id_local or "").strip(), origem=origem, tipo=tipo,
            mensagem=limpar(mensagem, MAX_MENSAGEM), local=local_seguro(local), acao=acao_segura(acao), status=status,
            pilha=limpar(pilha, MAX_PILHA), comentario=limpar(comentario, MAX_COMENTARIO),
            versao=re.sub(r"[^\w.+-]", "", versao or "")[:40], navegador=_navegador(navegador),
        )

    @property
    def codigo(self) -> str:
        return codigo_de(self.id_local)

    @property
    def grupo(self) -> str:
        return assinatura(self.tipo, self.mensagem or self.comentario, self.local, self.acao, self.pilha)

    @property
    def transitorio(self) -> bool:
        """Consulta (GET) que deu 502/503: é a janela de deploy (a API reiniciando). Não vira relato (spec 106);
        se a API ficar fora do ar de verdade, o app manda um único "API indisponível", que não começa por GET.
        504 (tempo esgotado com a API no ar) continua sendo relato: é rota lenta, não deploy."""
        if self.tipo in ("js", "promessa", "tela") and SEM_REDE.search(self.mensagem.strip()):
            return True  # spec 141: a conexão do aparelho caiu ("network error" do Safari) — não é defeito
        return self.tipo == "api" and self.status in (502, 503) and self.acao.startswith("GET ")

    def comentar(self, texto: str) -> "Relato":
        return replace(self, comentario=limpar(texto, MAX_COMENTARIO))


def _navegador(ua: str | None) -> str:
    """Só o essencial do aparelho (sistema + navegador), não a string inteira."""
    if not ua:
        return ""
    so = next((n for n, p in (("Android", "Android"), ("iPhone", "iPhone"), ("iPad", "iPad"), ("Windows", "Windows"),
                               ("macOS", "Mac OS"), ("Linux", "Linux")) if p in ua), "")
    nav = next((n for n, p in (("Edge", "Edg/"), ("Chrome", "Chrome/"), ("Firefox", "Firefox/"), ("Safari", "Safari/")) if p in ua), "")
    app = " · app" if "MalhetApp" in ua or "Capacitor" in ua else ""
    return " ".join(x for x in (so, nav) if x)[:60] + app


class Limite:
    """Freio contra enxurrada: no máximo `n` relatos por chave (conta ou IP) a cada `janela` segundos."""

    def __init__(self, n: int, janela: float):
        self.n, self.janela, self._marcas = n, janela, {}

    def permite(self, chave: str, agora: float) -> bool:
        marcas = [t for t in self._marcas.get(chave, []) if agora - t < self.janela]
        if len(marcas) >= self.n:
            self._marcas[chave] = marcas
            return False
        marcas.append(agora)
        self._marcas[chave] = marcas
        if len(self._marcas) > 5000:  # não cresce sem fim
            self._marcas = {k: v for k, v in self._marcas.items() if v and agora - v[-1] < self.janela}
        return True

    def zerar(self):
        self._marcas = {}
