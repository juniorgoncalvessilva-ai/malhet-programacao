"""Estrutura Zettelkasten do acervo da obra (spec 082): a mesma no Google Drive, no OneDrive e no Dropbox.

Malhet/
  00-INDICE.md
  obras/<CODIGO-OBRA>/
    00-indice.md
    10-programacoes/ 20-campo-fotos/ 30-ocorrencias-restricoes/ 40-auditorias-acoes/ 50-ssma-anexos/
    60-referencias/ 70-relatorios/ 80-marca/ 90-arquivo-morto/

Cada arquivo: `AAAAMMDDhhmm-TIPO-curto.ext` + um `.md` irmão com YAML (id, tipo, obra, ligações, hash) — uma IA lê a pasta e
entende o que é cada coisa e a que se liga sem abrir o banco. Dado sensível (`sensivel: true`) nunca sai do servidor.
"""
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from app.shared.errors import DomainError

RAIZ = "Malhet"
FUSO = timezone(timedelta(hours=-3))  # nomes na hora da obra

PASTAS = {
    "10-programacoes": "Programações emitidas e concluídas",
    "20-campo-fotos": "Fotos das atividades no campo",
    "30-ocorrencias-restricoes": "Fotos de ocorrências (desvios) e restrições",
    "40-auditorias-acoes": "Auditorias, controles preventivos e evidências das ações 5W2H",
    "50-ssma-anexos": "Documentos de SSMA (RAC, PTS, ART, ATA, PTO)",
    "60-referencias": "Arquivos de referência importados (PQ, CPU, XER, critérios)",
    "70-relatorios": "Relatórios gerados",
    "80-marca": "Logos e identidade",
    "90-arquivo-morto": "Itens retirados do uso",
}

# tipo do arquivo → (pasta, rótulo curto no nome)
TIPOS = {
    "foto-linha": ("20-campo-fotos", "FOTO"),
    "foto-desvio": ("30-ocorrencias-restricoes", "OCORRENCIA"),
    "foto-restricao": ("30-ocorrencias-restricoes", "RESTRICAO"),
    "foto-auditoria": ("40-auditorias-acoes", "AUDITORIA"),
    "foto-acao": ("40-auditorias-acoes", "ACAO"),
    "foto-evento": ("40-auditorias-acoes", "PREVENTIVO"),
    "anexo-ssma": ("50-ssma-anexos", "SSMA"),
    "referencia": ("60-referencias", "REF"),
    "relatorio": ("70-relatorios", "RELATORIO"),
    "programacao": ("10-programacoes", "PROG"),
}

EXTENSOES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf",
             "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
             "application/vnd.ms-excel": "xls",
             "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
             "application/msword": "doc", "text/markdown": "md", "text/plain": "txt"}


def curto(texto: str | None, limite: int = 40) -> str:
    """Trecho legível e seguro para nome de arquivo em qualquer provedor: sem acento, minúsculo, com hífens."""
    t = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode()
    t = re.sub(r"[^a-zA-Z0-9]+", "-", t).strip("-").lower()
    return t[:limite].strip("-") or "arquivo"


def codigo_pasta_obra(codigo: str, nome: str | None = None) -> str:
    base = curto(codigo, 20).upper()
    return f"{base}-{curto(nome, 30)}" if nome else base


def pasta_do_tipo(tipo: str) -> str:
    if tipo not in TIPOS:
        raise DomainError(f"tipo de arquivo desconhecido: {tipo}", "tipo")
    return TIPOS[tipo][0]


def extensao(mime: str, nome_original: str | None = None) -> str:
    if mime in EXTENSOES:
        return EXTENSOES[mime]
    if nome_original and "." in nome_original:
        return curto(nome_original.rsplit(".", 1)[1], 6) or "bin"
    return "bin"


def nome_arquivo(tipo: str, quando: datetime, descricao: str | None, mime: str, uid: str, nome_original: str | None = None) -> str:
    """`AAAAMMDDhhmm-TIPO-curto-xxxx.ext`: ordena por data, diz o que é e não colide (4 letras do id)."""
    rotulo = TIPOS[tipo][1] if tipo in TIPOS else curto(tipo, 12).upper()
    q = quando.astimezone(FUSO) if quando.tzinfo else quando
    return f"{q:%Y%m%d%H%M}-{rotulo}-{curto(descricao, 40)}-{uid[:4]}.{extensao(mime, nome_original)}"


@dataclass(frozen=True)
class Ficha:
    """O `.md` irmão do arquivo (metadados para pessoas e IA)."""
    id: str
    tipo: str
    obra: str
    arquivo: str
    criado_em: datetime
    hash_sha256: str
    titulo: str | None = None
    origem: str | None = None
    ligacoes: dict = field(default_factory=dict)  # frente, area, cwp, atividade, programacao…
    sensivel: bool = False

    def __post_init__(self):
        if self.sensivel:
            raise DomainError("dado sensível não vai para o acervo na nuvem", "sensivel")


def _yaml(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int | float):
        return str(v)
    s = str(v).replace('"', "'")
    return f'"{s}"'


def ficha_md(f: Ficha) -> str:
    linhas = ["---", f"id: {_yaml(f.id)}", f"tipo: {_yaml(f.tipo)}", f"obra: {_yaml(f.obra)}", f"arquivo: {_yaml(f.arquivo)}",
              f"criado_em: {_yaml(f.criado_em.isoformat())}", f"hash_sha256: {_yaml(f.hash_sha256)}",
              f"origem: {_yaml(f.origem)}", "sensivel: false", "ligacoes:"]
    for k, v in sorted(f.ligacoes.items()):
        if v not in (None, "", []):
            linhas.append(f"  {k}: {_yaml(v)}")
    linhas += ["---", "", f"# {f.titulo or f.arquivo}", "", f"Arquivo: [[{f.arquivo}]]"]
    links = [f"[[{k}:{v}]]" for k, v in sorted(f.ligacoes.items()) if v not in (None, "", [])]
    if links:
        linhas += ["", "Ligações: " + " · ".join(links)]
    return "\n".join(linhas) + "\n"


def indice_obra_md(obra: str, nome: str, contagens: dict[str, int], recentes: list[tuple[str, str]], agora: datetime) -> str:
    """`00-indice.md` da obra: o mapa das pastas e o que entrou por último."""
    linhas = ["---", f"obra: {_yaml(obra)}", f"atualizado_em: {_yaml(agora.isoformat())}", "---", "",
              f"# {nome}", "", "Acervo da obra gerado pelo Malhet. Cada arquivo tem um `.md` irmão com o que é e a que se liga.", "",
              "| Pasta | O que tem | Arquivos |", "|---|---|---|"]
    linhas += [f"| [[{p}]] | {d} | {contagens.get(p, 0)} |" for p, d in PASTAS.items()]
    if recentes:
        linhas += ["", "## Últimos", ""] + [f"- [[{p}/{n}]]" for p, n in recentes]
    return "\n".join(linhas) + "\n"


def indice_raiz_md(obras: list[tuple[str, str]], agora: datetime) -> str:
    linhas = ["---", f"atualizado_em: {_yaml(agora.isoformat())}", "---", "", "# Malhet · acervo das obras", "",
              "Estrutura Zettelkasten: obras/<obra>/<NN-pasta>/AAAAMMDDhhmm-TIPO-curto.ext + .md com metadados.", ""]
    linhas += [f"- [[obras/{c}/00-indice|{n}]]" for c, n in obras]
    return "\n".join(linhas) + "\n"
