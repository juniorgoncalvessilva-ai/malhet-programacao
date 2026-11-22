"""Leitura da LDO do contrato (spec 128). Cada contratante e cada contratada têm o seu modelo, mas os campos são os mesmos em
contexto; o leitor acha o cabeçalho em cada aba pelos nomes (sinônimos) e não pela posição.

Modelo de referência (LD-0000AA-G-54938): uma aba "F. Rosto" com o número da própria LDO, a revisão e o histórico de
revisões; uma aba por pacote ("1870CC - CMD", "16XXCC - OFICINA"…) com o cabeçalho na linha 12:
Número VALE | Descrição | Revisão | Tipo de Emissão | Observações | Disciplina | Motivo Revisão | Disciplina | Enviado em |
Projeto Apresentado | Para quem.
- Número VALE = número do documento; Descrição = descritivo; Tipo de Emissão = letra do TE (A–H → finalidade);
- Observações = CWA ou local a que o projeto pertence (vira a frente sugerida);
- a primeira "Disciplina" é a sigla (A, C, E) e a segunda o nome completo (Arquitetura, Civil, Elétrica);
- Enviado em = quando a LDO foi enviada; Projeto Apresentado (Sim/Não) e Para quem.
O modelo simples antigo (Código | Título | Rev. | Finalidade | Disciplina | Frente) continua valendo.
"""
import re
import unicodedata
from dataclasses import dataclass, field, replace
from datetime import date, datetime

from app.modules.documentos.domain.documento import normalizar_codigo, normalizar_finalidade, normalizar_revisao

# campo → sinônimos do cabeçalho (normalizados: sem acento, só letras e números)
COLUNAS: dict[str, tuple[str, ...]] = {
    "codigo": ("NUMERO VALE", "N VALE", "NUMERO DO DOCUMENTO", "NUMERO DOCUMENTO", "N DOCUMENTO", "CODIGO CLIENTE", "CODIGO",
               "DOCUMENTO"),
    "codigo_contratada": ("N CONTRATADA", "NUMERO CONTRATADA", "CODIGO CONTRATADA", "N DA CONTRATADA"),
    "titulo": ("DESCRICAO", "TITULO", "DESCRITIVO"),
    "revisao": ("REVISAO", "REV"),
    "finalidade": ("TIPO DE EMISSAO", "TIPO EMISSAO", "TE", "FINALIDADE", "EMISSAO", "SITUACAO", "STATUS"),
    "tipo": ("TIPO DOCUMENTO", "TIPO",),
    "local": ("OBSERVACOES", "OBSERVACAO", "OBS", "FRENTE", "LOCAL", "CWA", "AREA"),
    "disciplina": ("DISCIPLINA",),
    "motivo": ("MOTIVO REVISAO", "MOTIVO DA REVISAO", "MOTIVO"),
    "enviado": ("ENVIADO EM", "DATA DE ENVIO", "DATA ENVIO", "DATA EMISSAO", "DATA"),
    "apresentado": ("PROJETO APRESENTADO", "APRESENTADO"),
    "para_quem": ("PARA QUEM", "APRESENTADO PARA"),
}
# os que só valem com o nome exato (TIPO não pode pegar "TIPO DE EMISSÃO"; TE, OBS e REV são curtos demais para prefixo)
_EXATOS = {"TIPO", "TE", "OBS", "REV", "AREA", "CWA", "DATA", "DOCUMENTO"}


def norm(t) -> str:
    s = unicodedata.normalize("NFKD", str(t or "").replace("º", "").replace("°", "")).encode("ascii", "ignore").decode().upper()
    return " ".join(re.sub(r"[^A-Z0-9]+", " ", s).split())


@dataclass(frozen=True)
class LinhaLdo:
    aba: str
    linha: int
    codigo: str
    titulo: str
    revisao: str | None = None
    finalidade: str | None = None
    tipo: str | None = None
    local: str | None = None
    disciplina: str | None = None
    disciplina_sigla: str | None = None
    motivo: str | None = None
    enviado_em: date | None = None
    apresentado: bool | None = None
    para_quem: str | None = None
    codigo_contratada: str | None = None


@dataclass(frozen=True)
class RevisaoDaLdo:
    revisao: str
    finalidade: str
    descricao: str | None
    data: date | None


@dataclass
class LeituraLdo:
    linhas: list[LinhaLdo] = field(default_factory=list)
    abas: list[tuple[str, int]] = field(default_factory=list)  # aba lida → documentos
    ignoradas: list[str] = field(default_factory=list)
    codigo: str | None = None  # número da própria LDO (folha de rosto)
    revisao: str | None = None
    historico: list[RevisaoDaLdo] = field(default_factory=list)
    avisos: list[str] = field(default_factory=list)


def _cabecalho(linhas: list[tuple]) -> tuple[int, dict[str, int], list[int]] | None:
    """Linha do cabeçalho e coluna de cada campo (o sinônimo mais longo ganha; exatos só por igualdade)."""
    for n, lin in enumerate(linhas[:40]):
        nomes = [norm(c) for c in lin]
        idx: dict[str, int] = {}
        disciplinas: list[int] = []
        for j, nome in enumerate(nomes):
            if not nome:
                continue
            if nome == "DISCIPLINA" or nome.startswith("DISCIPLINA "):
                disciplinas.append(j)
                continue
            melhor, tam = None, -1
            for campo, opcoes in COLUNAS.items():
                for o in opcoes:
                    ok = nome == o if o in _EXATOS else (nome == o or nome.startswith(o + " "))
                    if ok and len(o) > tam and campo not in idx:
                        melhor, tam = campo, len(o)
            if melhor:
                idx[melhor] = j
        if "codigo" in idx and "titulo" in idx:
            return n, idx, disciplinas
    return None


def _texto(v) -> str | None:
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    t = " ".join(str(v).split())
    return t or None


def _data(v) -> date | None:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    t = _texto(v)
    if t:
        m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", t)
        if m:
            d, mes, a = (int(x) for x in m.groups())
            try:
                return date(a + 2000 if a < 100 else a, mes, d)
            except ValueError:
                return None
    return None


def _sim(v) -> bool | None:
    t = norm(v)
    if not t:
        return None
    if t.startswith("S") or t in ("X", "OK", "1"):
        return True
    if t.startswith("N") or t == "0":
        return False
    return None


def _folha_de_rosto(linhas: list[tuple], leitura: LeituraLdo) -> None:
    """Número da LDO (célula abaixo de "Nº VALE"), revisão (abaixo de "REVISÃO" ou "REV.") e o quadro de revisões."""
    def abaixo(i: int, j: int):
        for k in range(i + 1, min(i + 4, len(linhas))):
            v = linhas[k][j] if j < len(linhas[k]) else None
            if _texto(v):
                return v
        return None

    for i, lin in enumerate(linhas[:30]):
        for j, c in enumerate(lin):
            n = norm(c)
            if leitura.codigo is None and n in ("N VALE", "NUMERO VALE", "N DOCUMENTO", "NUMERO DO DOCUMENTO"):
                v = _texto(abaixo(i, j))
                if v and re.search(r"[A-Z0-9]{2,}-", v.upper()):
                    leitura.codigo = normalizar_codigo(v)
            elif leitura.revisao is None and n in ("REVISAO", "REV"):
                v = _texto(abaixo(i, j))
                if v and len(v) <= 3:
                    leitura.revisao = normalizar_revisao(v)
    cab = next((i for i, lin in enumerate(linhas[:40]) if {"REV", "TE"} <= {norm(c) for c in lin}), None)
    if cab is None:
        return
    nomes = [norm(c) for c in linhas[cab]]
    jr, jt = nomes.index("REV"), nomes.index("TE")
    jd = next((j for j, n in enumerate(nomes) if n.startswith("DESCRI")), None)
    jdata = next((j for j, n in enumerate(nomes) if n == "DATA"), None)
    for lin in linhas[cab + 1:cab + 40]:
        rev = _texto(lin[jr] if jr < len(lin) else None)
        if not rev or len(rev) > 3:
            continue
        leitura.historico.append(RevisaoDaLdo(
            revisao=normalizar_revisao(rev), finalidade=normalizar_finalidade(_texto(lin[jt] if jt < len(lin) else None)),
            descricao=_texto(lin[jd]) if jd is not None and jd < len(lin) else None,
            data=_data(lin[jdata]) if jdata is not None and jdata < len(lin) else None))


def ler(abas: list[tuple[str, list[tuple]]]) -> LeituraLdo:
    """`abas` = [(nome da aba, linhas como tuplas)]. Aba sem cabeçalho de documentos é lida como folha de rosto."""
    leitura = LeituraLdo()
    vistos: set[str] = set()
    for nome, linhas in abas:
        cab = _cabecalho(linhas)
        if cab is None:
            _folha_de_rosto(linhas, leitura)
            leitura.ignoradas.append(nome)
            continue
        n0, idx, disc = cab
        corpo = linhas[n0 + 1:]
        # duas colunas "Disciplina": a de valores curtos é a sigla, a outra o nome completo
        def media(j: int) -> float:
            vals = [len(_texto(l[j]) or "") for l in corpo[:200] if j < len(l) and _texto(l[j])]
            return sum(vals) / len(vals) if vals else 0
        sigla = next((j for j in disc if 0 < media(j) <= 3), None)
        nome_disc = next((j for j in disc if j != sigla), None)
        conta = 0
        for k, lin in enumerate(corpo, start=n0 + 2):
            val = lambda c: lin[idx[c]] if c in idx and idx[c] < len(lin) else None  # noqa: E731
            bruto = _texto(val("codigo"))
            if not bruto or len(bruto) < 5 or not re.search(r"\d", bruto) or " " in bruto.strip():
                continue  # linha vazia, título de grupo ou nota
            cod = normalizar_codigo(bruto)
            if cod in vistos:
                leitura.avisos.append(f"{cod} aparece de novo na aba {nome} (linha {k}): ficou a primeira")
                continue
            vistos.add(cod)
            rev = _texto(val("revisao"))
            try:
                rev = normalizar_revisao(rev) if rev else None
            except Exception:  # noqa: BLE001 — revisão ilegível não derruba a linha
                leitura.avisos.append(f"{cod}: revisão {rev!r} não reconhecida")
                rev = None
            fin = _texto(val("finalidade"))
            leitura.linhas.append(LinhaLdo(
                aba=nome, linha=k, codigo=cod, titulo=(_texto(val("titulo")) or cod)[:300], revisao=rev,
                finalidade=normalizar_finalidade(fin) if fin else None, tipo=_texto(val("tipo")),
                local=(_texto(val("local")) or None), motivo=_texto(val("motivo")), enviado_em=_data(val("enviado")),
                apresentado=_sim(val("apresentado")), para_quem=_texto(val("para_quem")),
                codigo_contratada=_texto(val("codigo_contratada")),
                disciplina=_texto(lin[nome_disc]) if nome_disc is not None and nome_disc < len(lin) else None,
                disciplina_sigla=_texto(lin[sigla]) if sigla is not None and sigla < len(lin) else None))
            conta += 1
        leitura.abas.append((nome, conta))
    # sigla sem o nome completo: completa pelo par que a própria LDO usa (C → Civil, A → Arquitetura)
    pares: dict[str, str] = {}
    for x in leitura.linhas:
        if x.disciplina_sigla and x.disciplina:
            pares.setdefault(x.disciplina_sigla.upper(), x.disciplina)
    leitura.linhas = [replace(x, disciplina=pares.get((x.disciplina_sigla or "").upper())) if x.disciplina is None and x.disciplina_sigla else x
                      for x in leitura.linhas]
    return leitura


# ---- observação (CWA / local) → frente ---------------------------------------------------------------------------------

@dataclass(frozen=True)
class AreaRef:
    id: int
    codigo: str
    cwa: str
    descricao: str
    ativo: str | None
    local: str


_TAG = re.compile(r"\b([A-Z]{2,4})-?(\d{4}[A-Z]{2})-(\d{1,3})\b")
_PREFIXO = re.compile(r"^(\d{4}[A-Z]{2})-")


def casar_local(texto: str | None, codigo_doc: str, areas: list[AreaRef]) -> tuple[int | None, bool, str]:
    """Frente do documento: (área, confirmada?, como casou). Código/CWA exato confirma; TAG, nome da área ou a área do número
    do documento só sugerem (o Planejamento confirma, como na spec 123)."""
    t = norm(texto)
    if t:
        exato = [a for a in areas if t in (norm(a.codigo), norm(a.cwa))]
        if len(exato) == 1:
            return exato[0].id, True, f"código {exato[0].codigo}"
        tags = {f"{m.group(1)}-{m.group(2)}-{int(m.group(3)):02d}" for m in _TAG.finditer((texto or "").upper())}
        por_tag = [a for a in areas if a.ativo and _ativo(a.ativo) in tags]
        if len(por_tag) == 1:
            return por_tag[0].id, False, f"TAG {por_tag[0].ativo}"
        iguais = [a for a in areas if norm(a.descricao) == t]
        if len(iguais) == 1:
            return iguais[0].id, False, f"nome da área \"{iguais[0].descricao}\""
        contem = [a for a in areas if len(norm(a.descricao)) >= 6 and (_dentro(norm(a.descricao), t) or (len(t) >= 6 and _dentro(t, norm(a.descricao))))]
        if len(contem) == 1:
            return contem[0].id, False, f"nome da área \"{contem[0].descricao}\""
    m = _PREFIXO.match(codigo_doc.upper()) if not t else None  # só sem local escrito: o que a LDO diz manda
    if m:
        mesma = [a for a in areas if a.ativo and m.group(1) in a.ativo.upper()]
        if len(mesma) == 1:
            return mesma[0].id, False, f"área {m.group(1)} do número do documento"
    return None, False, ""


def _dentro(parte: str, todo: str) -> bool:
    """Palavras inteiras: "CLASSE I" está em "GALPAO CLASSE I", não em "GALPAO CLASSE II"."""
    return f" {parte} " in f" {todo} "


def _ativo(a: str) -> str:
    m = _TAG.search(a.upper().replace(" ", ""))
    return f"{m.group(1)}-{m.group(2)}-{int(m.group(3)):02d}" if m else a.upper().strip()
