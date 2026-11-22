"""Controle de projetos por ativo (spec 133): a planilha da obra que liga cada projeto ao ativo/CWA a que ele se aplica.

Modelo de referência ("Controle de projetos por ativo"): cabeçalho STATUS | Ativo | Projeto | Disciplina | OBS, achado pelos
nomes; linhas só com texto na 1ª coluna são grupos (CMD, OFICINA, CANTEIRO VALE, RETIRADO DE ESCOPO ou EXTRA…); STATUS e Ativo
vêm mesclados sobre os projetos do ativo (vazio = o de cima); uma célula de Ativo pode trazer vários ("CWA 004.12 - ED-1800AA-06 -
Skid…" em linhas). Projeto = número do documento (pode vir com ".REV.A_APR"); "SEM PROJETOS"/"EM ADEQUAÇÃO" = ativo sem projeto.
Disciplina = o que o projeto é naquele ativo ("Forma / Chumbador"); OBS "Cancelado" tira o projeto do ativo.

O ativo casa com a frente (área das Frentes) pela TAG (BL-1870AA-01) e pelo código do CWA — o controle é informação controlada,
então TAG ou CWA único confirmam; só o nome sugere.
"""
import re
from dataclasses import dataclass, field

from app.modules.documentos.domain.ldo import AreaRef, casar_local, norm

COLUNAS = {"status": ("STATUS", "SITUACAO"), "ativo": ("ATIVO", "CWA", "ATIVO CWA"), "projeto": ("PROJETO", "DOCUMENTO", "NUMERO"),
           "disciplina": ("DISCIPLINA", "DESCRICAO"), "obs": ("OBS", "OBSERVACAO", "OBSERVACOES")}

# situação do projeto no ativo (a coluna STATUS é texto livre: "OK (Ressalva…)", "Parc. Ok", "Pendência de informações críticas")
STATUS = {"ok": "Projetos OK", "parcial": "Parcialmente OK", "pendente": "Pendente", "critico": "Pendência crítica",
          "sem_projeto": "Sem projeto", "revisao": "Em revisão", "outro": "Outro"}
LIBERA = {"ok", "parcial"}  # o que deixa planejar sem restrição de projeto


def status_chave(texto: str | None) -> str:
    t = norm(texto)
    if not t:
        return "outro"
    if t.startswith("SEM PROJETO"):
        return "sem_projeto"
    if "CRITIC" in t:
        return "critico"
    if t.startswith("PARC"):
        return "parcial"
    if t.startswith("PENDEN"):
        return "pendente"
    if t.startswith("OK"):
        return "ok"
    if t.startswith("REVIS") or t.startswith("EM REVIS") or t.startswith("EM ADEQ"):
        return "revisao"
    return "outro"


@dataclass(frozen=True)
class RefAtivo:
    texto: str
    cwa: str | None
    tag: str | None
    descricao: str


@dataclass(frozen=True)
class ProjetoAtivo:
    codigo: str | None  # None = sem projeto (o texto fica em nota)
    revisao: str | None
    disciplina: str | None
    obs: str | None
    cancelado: bool
    linha: int
    nota: str | None = None


@dataclass
class Ativo:
    grupo: str | None
    status_texto: str | None
    texto: str
    refs: list[RefAtivo]
    linha: int
    projetos: list[ProjetoAtivo] = field(default_factory=list)

    @property
    def status(self) -> str:
        return status_chave(self.status_texto)


@dataclass
class Leitura:
    ativos: list[Ativo]
    avisos: list[str]


_CWA = re.compile(r"^\s*CWA\s*([0-9][0-9.]*(?:\s*E\s*[0-9.]+)?)\s*-?\s*", re.I)
_TAG = re.compile(r"\b([A-Z]{2,4})-(\d{4}[A-Z]{2})-([A-Z0-9-]+?)(?=\s*[-–]\s|\s*$|\s)", re.I)
_COD = re.compile(r"^([A-Z]{0,3}-?\d{4}[A-Z]{2}-[A-Z]-\d{3,6})(?:[._\s-]*REV[._\s-]*([A-Z0-9]{1,3}))?", re.I)


def ler_ref(linha: str) -> RefAtivo:
    """ "CWA 004.11 - BL-1870AA-01 - Balança" → CWA 004.11, TAG BL-1870AA-01, descrição Balança (tudo opcional)."""
    t = " ".join(linha.split())
    cwa = None
    m = _CWA.match(t)
    resto = t
    if m:
        cwa = m.group(1).split()[0].rstrip(".")
        resto = t[m.end():]
    tag = None
    mt = _TAG.search(resto)
    if mt:
        tag = f"{mt.group(1)}-{mt.group(2)}-{mt.group(3)}".upper()
        resto = (resto[:mt.start()] + resto[mt.end():])
    desc = re.sub(r"^[\s\-–]+|[\s\-–]+$", "", resto).strip() or t
    return RefAtivo(t, cwa, tag, desc)


def prefixo_area(codigo: str) -> str | None:
    """A área do número do documento ("1600AA" em 1600AA-C-51274 ou LM-1600AA-E-20237)."""
    m = re.search(r"(\d{4}[A-Z]{2})-", (codigo or "").upper())
    return m.group(1) if m else None


def ler_projeto(valor, disciplina, obs, linha: int) -> ProjetoAtivo:
    t = " ".join(str(valor or "").split())
    o = " ".join(str(obs or "").split()) or None
    cancelado = bool(o) and norm(o).startswith("CANCELAD")
    d = " ".join(str(disciplina or "").split()) or None
    m = _COD.match(t.upper())
    if not m:
        return ProjetoAtivo(None, None, d, o, cancelado, linha, nota=t or None)
    return ProjetoAtivo(m.group(1).upper(), (m.group(2) or "").upper() or None, d, None if o and norm(o) in ("NA", "N A") else o,
                        cancelado, linha)


def _cabecalho(linhas: list[tuple]) -> tuple[int, dict[str, int]] | None:
    for i, row in enumerate(linhas[:30]):
        nomes = [norm(c) for c in row]
        col: dict[str, int] = {}
        for campo, sins in COLUNAS.items():
            for j, n in enumerate(nomes):
                if n and n in sins and campo not in col and j not in col.values():
                    col[campo] = j
        if "ativo" in col and "projeto" in col:
            return i, col
    return None


def ler(linhas: list[tuple]) -> Leitura:
    """Linhas da planilha (valores; célula mesclada só tem o valor na primeira) → ativos com os projetos."""
    cab = _cabecalho(linhas)
    if cab is None:
        return Leitura([], ["não achei o cabeçalho com as colunas Ativo e Projeto"])
    h, col = cab
    pega = lambda row, k: row[col[k]] if k in col and col[k] < len(row) else None  # noqa: E731
    ultima = max(col.values())
    ativos: list[Ativo] = []
    avisos: list[str] = []
    grupo: str | None = None
    atual: Ativo | None = None
    status_atual: str | None = None
    for i, row in enumerate(linhas[h + 1:], start=h + 2):
        row = tuple(row) + (None,) * 8
        vals = [(j, c) for j, c in enumerate(row) if c is not None and str(c).strip()]
        if not vals:
            continue
        st, at, pj = pega(row, "status"), pega(row, "ativo"), pega(row, "projeto")
        if len(vals) == 1 and at is None and pj is None:  # linha de grupo (CMD, OFICINA…)
            grupo = " ".join(str(vals[0][1]).split())[:80]
            atual, status_atual = None, None
            continue
        if st is not None and str(st).strip():
            status_atual = " ".join(str(st).split())[:120]
        if at is not None and str(at).strip():
            partes = [p for p in str(at).splitlines() if p.strip()]
            atual = Ativo(grupo, status_atual, " ".join(str(at).split())[:300], [ler_ref(p) for p in partes], i)
            ativos.append(atual)
        elif st is not None and str(st).strip() and atual is not None:
            atual.status_texto = status_atual
        if pj is None or not str(pj).strip():
            continue
        if atual is None:
            avisos.append(f"linha {i}: projeto {pj} sem ativo acima")
            continue
        obs_extra = [" ".join(str(c).split()) for c in row[ultima + 1:] if c is not None and str(c).strip()]
        obs = " · ".join([x for x in [str(pega(row, "obs") or "").strip(), *obs_extra] if x]) or None
        atual.projetos.append(ler_projeto(pj, pega(row, "disciplina"), obs, i))
    return Leitura(ativos, avisos)


def _tag(t: str | None) -> str:
    return re.sub(r"[^A-Z0-9]", "", (t or "").upper())


def _cwa(t: str | None) -> str:
    return (t or "").strip().upper().lstrip("0") or "0"


def casar_ativo(ref: RefAtivo, areas: list[AreaRef]) -> tuple[int | None, bool, str]:
    """Frente do ativo: (área, confirmada?, como). TAG única ou CWA único confirmam; CWA com várias áreas desempata pela TAG
    ou pelo nome; só o nome sugere."""
    if ref.tag:
        por_tag = [a for a in areas if a.ativo and _tag(a.ativo) == _tag(ref.tag)]
        if len(por_tag) > 1 and ref.cwa:
            por_tag = [a for a in por_tag if _cwa(a.cwa) == _cwa(ref.cwa)] or por_tag
        if len(por_tag) == 1:
            return por_tag[0].id, True, f"TAG {por_tag[0].ativo}"
    if ref.cwa:
        por_cwa = [a for a in areas if _cwa(a.cwa) == _cwa(ref.cwa) or _cwa(a.codigo) == _cwa(ref.cwa)]
        if len(por_cwa) == 1:
            return por_cwa[0].id, True, f"CWA {por_cwa[0].codigo}"
        if len(por_cwa) > 1:
            n = norm(ref.descricao)
            iguais = [a for a in por_cwa if norm(a.descricao) == n or (len(n) >= 5 and (n in norm(a.descricao) or norm(a.descricao) in n))]
            if len(iguais) == 1:
                return iguais[0].id, True, f"CWA {iguais[0].codigo} + nome"
    area, _confirmada, como = casar_local(ref.descricao, "", areas)
    return area, False, como
