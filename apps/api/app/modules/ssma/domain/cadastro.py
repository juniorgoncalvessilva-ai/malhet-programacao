"""Cadastros de SSMA da programação: listas que alimentam as listas suspensas de cada linha.

Segurança mantém Técnico de segurança responsável, RAC, PTS, ART e ATA (Autorização de Trabalho Ambiental).
O PTO (Plano de Trabalho de Obra) é do Planejamento: cadastro e escolha ficam com o planejador, na programação.
"""
from dataclasses import dataclass
from datetime import date
from enum import StrEnum

from app.shared.errors import DomainError

NAO_SE_APLICA = "N/A"


class TipoCadastro(StrEnum):
    TECNICO = "TECNICO"
    RAC = "RAC"
    PTS = "PTS"
    ART = "ART"
    ATA = "ATA"
    PTO = "PTO"

    @property
    def rotulo(self) -> str:
        return {"TECNICO": "Técnico de segurança responsável", "RAC": "RAC", "PTS": "PTS", "ART": "ART",
                "ATA": "ATA (Autorização de Trabalho Ambiental)", "PTO": "PTO (Plano de Trabalho de Obra)"}[self.value]

    @property
    def do_planejamento(self) -> bool:
        return self is TipoCadastro.PTO

    @property
    def campo_linha(self) -> str:
        return f"ssma_{self.value.lower() if self is not TipoCadastro.TECNICO else 'tecnico'}"


# campos da linha preenchidos pela segurança (tela SSMA) e pelo planejamento (montar)
CAMPOS_SEGURANCA = ("tecnico", "rac", "pts", "art", "ata")
CAMPOS_PLANEJAMENTO = ("pto",)
TIPO_DO_CAMPO = {"tecnico": TipoCadastro.TECNICO, "rac": TipoCadastro.RAC, "pts": TipoCadastro.PTS,
                 "art": TipoCadastro.ART, "ata": TipoCadastro.ATA, "pto": TipoCadastro.PTO}


@dataclass(frozen=True)
class ItemCadastro:
    tipo: TipoCadastro
    codigo: str
    descricao: str | None = None
    validade: date | None = None

    def __post_init__(self) -> None:
        cod = " ".join((self.codigo or "").split())
        if not cod:
            raise DomainError("informe o nome ou número", "codigo")
        if cod.upper() == NAO_SE_APLICA:
            raise DomainError("N/A já existe em toda lista; não precisa cadastrar", "codigo")
        limite = 150 if self.tipo is TipoCadastro.TECNICO else 60
        if len(cod) > limite:
            raise DomainError(f"máximo {limite} caracteres", "codigo")
        object.__setattr__(self, "codigo", cod)
        object.__setattr__(self, "descricao", (" ".join((self.descricao or "").split()) or None))


def valor_da_linha(valor: str | None, validos: set[str], tipo: TipoCadastro) -> str | None:
    """Vazio, N/A ou um item ativo do cadastro (a lista suspensa garante; a API confere)."""
    v = " ".join((valor or "").split())
    if not v:
        return None
    if v.upper() in (NAO_SE_APLICA, "NA"):
        return NAO_SE_APLICA
    if v not in validos:
        raise DomainError(f"{tipo.rotulo}: '{v}' não está no cadastro (cadastre antes ou use N/A)", tipo.value.lower())
    return v


# ---- vários itens por atividade -------------------------------------------------------------------------
CAMPOS_MULTIPLOS = ("rac", "pts", "art", "ata", "pto")  # técnico responsável continua um só


def como_lista(valor) -> list[str]:
    """Aceita lista ou texto (programações/fotos antigas guardavam um valor só)."""
    if valor is None:
        return []
    itens = valor if isinstance(valor, (list, tuple)) else [valor]
    return [" ".join(str(x).split()) for x in itens if x is not None and str(x).strip()]


def lista_da_linha(valores, validos: set[str], tipo: TipoCadastro, atuais=None) -> list[str] | None:
    """Itens da linha: cada um N/A ou do cadastro ativo (o que a linha já tinha continua aceito).

    Sem repetição, na ordem escolhida; N/A só vale sozinho (com outro item escolhido, sai).
    """
    ja = set(como_lista(atuais))
    out: list[str] = []
    for v in como_lista(valores):
        item = v if v in ja else valor_da_linha(v, validos, tipo)
        if item and item not in out:
            out.append(item)
    if len(out) > 1 and NAO_SE_APLICA in out:
        out.remove(NAO_SE_APLICA)
    return out or None


def texto_da_lista(valor) -> str | None:
    """Para o Excel do cliente: itens separados por ' / '."""
    itens = como_lista(valor)
    return " / ".join(itens) if itens else None


# ---- anexos dos documentos (RAC, PTS, ART, ATA, PTO) ------------------------------------------------------
TIPOS_COM_ANEXO = {TipoCadastro.RAC, TipoCadastro.PTS, TipoCadastro.ART, TipoCadastro.ATA, TipoCadastro.PTO}
LIMITE_ANEXO = 20 * 1024 * 1024
_FORMATOS = {  # extensão → (content-type, assinatura do arquivo)
    ".pdf": ("application/pdf", (b"%PDF",)),
    ".xlsx": ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", (b"PK\x03\x04",)),
    ".xlsm": ("application/vnd.ms-excel.sheet.macroEnabled.12", (b"PK\x03\x04",)),
    ".xls": ("application/vnd.ms-excel", (b"\xd0\xcf\x11\xe0",)),
    ".docx": ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", (b"PK\x03\x04",)),
    ".doc": ("application/msword", (b"\xd0\xcf\x11\xe0",)),
}


def validar_anexo(tipo: TipoCadastro, nome: str, conteudo: bytes) -> tuple[str, str]:
    """Só Excel, Word ou PDF de verdade (confere a assinatura), até 20 MB. Devolve (nome limpo, content-type)."""
    if tipo not in TIPOS_COM_ANEXO:
        raise DomainError(f"{tipo.rotulo} não recebe arquivo", "arquivo")
    nome = " ".join((nome or "").replace("\\", "/").split("/")[-1].split())[:200]
    ext = ("." + nome.rsplit(".", 1)[-1].lower()) if "." in nome else ""
    if ext not in _FORMATOS:
        raise DomainError("envie Excel (.xlsx, .xls), Word (.docx, .doc) ou PDF", "arquivo")
    if not conteudo:
        raise DomainError("arquivo vazio", "arquivo")
    if len(conteudo) > LIMITE_ANEXO:
        raise DomainError("arquivo maior que 20 MB", "arquivo")
    ctype, assinaturas = _FORMATOS[ext]
    if not any(conteudo.startswith(a) for a in assinaturas):
        raise DomainError(f"o conteúdo não é um arquivo {ext} válido", "arquivo")
    return nome, ctype
