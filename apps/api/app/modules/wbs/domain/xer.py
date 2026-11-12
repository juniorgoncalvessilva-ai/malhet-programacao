"""Acrescentar WBS e atividades num .xer do Primavera sem mexer no que já está nele.

O arquivo é tratado em bytes, linha a linha: tudo o que veio do P6 sai igual (inclusive acentos em cp1252), e as
linhas novas entram no fim da tabela PROJWBS/TASK. O código WBS (wbs_short_name de cada nível, unido por ponto e
sem o nó do projeto) é a chave da ida e volta com a WBS de execução.
"""
import re
from dataclasses import dataclass, field

from app.shared.errors import DomainError

ENC = "cp1252"
_CWA = re.compile(r"\bCWA\s*([0-9]{3})(?:\.([0-9]{2}))?\b", re.I)
_FAIXA = re.compile(r"\bCWA\s*([0-9]{3})\s*(?:a|até|-)\s*(?:CWA\s*)?([0-9]{3})\b", re.I)


def _cobre(nome: str, cwa3: str) -> bool:
    """Nível 'CWA 004 - …' ou 'CWA 011 a CWA 020 - …' que agrupa as áreas do CWA 004 / 011…020."""
    if (f := _FAIXA.search(nome)) is not None:
        return f.group(1) <= cwa3 <= f.group(2)
    m = _CWA.search(nome)
    return bool(m and not m.group(2) and m.group(1) == cwa3)


@dataclass
class Tabela:
    nome: str
    campos: list[str]
    linhas: list[dict[str, str]] = field(default_factory=list)
    fim: int = 0  # índice da última linha da tabela no arquivo (onde entram as novas)


@dataclass
class Xer:
    """O .xer em linhas de bytes + as tabelas lidas (só para consulta)."""
    linhas: list[bytes]
    tabelas: dict[str, Tabela]
    quebra: bytes = b"\r\n"
    novas: dict[str, list[dict[str, str]]] = field(default_factory=dict)

    @classmethod
    def ler(cls, conteudo: bytes) -> "Xer":
        if not conteudo.startswith(b"ERMHDR"):
            raise DomainError("o arquivo não é um .xer do Primavera (falta o cabeçalho ERMHDR)", "arquivo")
        quebra = b"\r\n" if b"\r\n" in conteudo[:4000] else b"\n"
        linhas = conteudo.split(quebra)
        tabelas: dict[str, Tabela] = {}
        atual: Tabela | None = None
        for i, ln in enumerate(linhas):
            if ln.startswith(b"%T\t"):
                atual = Tabela(ln[3:].decode(ENC, "replace").strip(), [], [], i)
                tabelas[atual.nome] = atual
            elif ln.startswith(b"%F\t") and atual:
                atual.campos = ln.decode(ENC, "replace").split("\t")[1:]
                atual.fim = i
            elif ln.startswith(b"%R\t") and atual:
                atual.linhas.append(dict(zip(atual.campos, ln.decode(ENC, "replace").split("\t")[1:])))
                atual.fim = i
        for t in ("PROJWBS", "TASK"):
            if t not in tabelas:
                raise DomainError(f"o .xer não tem a tabela {t}", "arquivo")
        return cls(linhas, tabelas, quebra)

    def acrescentar(self, tabela: str, linha: dict[str, str]) -> None:
        self.novas.setdefault(tabela, []).append(linha)

    def gerar(self) -> bytes:
        saida = list(self.linhas)
        # de baixo para cima, para os índices das tabelas de cima continuarem valendo
        for nome in sorted(self.novas, key=lambda n: self.tabelas[n].fim, reverse=True):
            t = self.tabelas[nome]
            novas = [("%R\t" + "\t".join(_limpo(r.get(c, "")) for c in t.campos)).encode(ENC, "replace")
                     for r in self.novas[nome]]
            saida[t.fim + 1:t.fim + 1] = novas
        return self.quebra.join(saida)


def _limpo(v: str) -> str:
    return " ".join(str(v or "").replace("\t", " ").split()) if v else ""


@dataclass(frozen=True)
class NoP6:
    wbs_id: str
    codigo: str  # 5.4.3.4 (sem o projeto)
    nome: str


class EstruturaP6:
    """A EAP de um projeto do .xer: código WBS ↔ wbs_id, nomes e códigos já usados por pai."""

    def __init__(self, xer: Xer):
        wbs = xer.tabelas["PROJWBS"].linhas
        tasks = xer.tabelas["TASK"].linhas
        por_proj: dict[str, int] = {}
        for t in tasks:
            por_proj[t.get("proj_id", "")] = por_proj.get(t.get("proj_id", ""), 0) + 1
        raizes = [w for w in wbs if w.get("proj_node_flag") == "Y"]
        if not raizes:
            raise DomainError("o .xer não tem o nó do projeto na EAP (PROJWBS)", "arquivo")
        raiz = max(raizes, key=lambda w: por_proj.get(w.get("proj_id", ""), 0))
        self.proj_id = raiz["proj_id"]
        self.raiz_id = raiz["wbs_id"]
        self.projeto = raiz.get("wbs_short_name", "")
        self.por_id = {w["wbs_id"]: w for w in wbs if w.get("proj_id") == self.proj_id}
        self.filhos: dict[str, list[dict[str, str]]] = {}
        for w in self.por_id.values():
            self.filhos.setdefault(w.get("parent_wbs_id", ""), []).append(w)
        self.por_codigo: dict[str, NoP6] = {}
        self._codigo_de: dict[str, str] = {self.raiz_id: ""}

        def descer(wid: str, prefixo: str) -> None:
            for w in self.filhos.get(wid, []):
                cod = f"{prefixo}.{w['wbs_short_name'].strip()}" if prefixo else w["wbs_short_name"].strip()
                self._codigo_de[w["wbs_id"]] = cod
                self.por_codigo[cod] = NoP6(w["wbs_id"], cod, w.get("wbs_name", ""))
                descer(w["wbs_id"], cod)

        descer(self.raiz_id, "")
        self.atividades = {t.get("task_code", "").strip() for t in tasks if t.get("proj_id") == self.proj_id}
        self.modelo_tarefa = next((t for t in tasks if t.get("proj_id") == self.proj_id and t.get("task_type") == "TT_Task"),
                                  next((t for t in tasks if t.get("proj_id") == self.proj_id), None))
        self.modelo_wbs = next((w for w in self.por_id.values() if w.get("proj_node_flag") != "Y"), raiz)
        self.prox_wbs = max([int(w["wbs_id"]) for w in wbs if w["wbs_id"].isdigit()], default=0) + 1
        self.prox_task = max([int(t["task_id"]) for t in tasks if t.get("task_id", "").isdigit()], default=0) + 1

    def wbs_id(self, codigo: str) -> str:
        return self.raiz_id if not codigo else self.por_codigo[codigo].wbs_id

    def proximo_codigo(self, pai: str) -> str:
        """Próximo código curto livre abaixo do pai (número seguinte ao maior numérico)."""
        usados = {w["wbs_short_name"].strip() for w in self.filhos.get(self.wbs_id(pai), [])}
        n = max([int(u) for u in usados if u.isdigit()], default=0) + 1
        while str(n) in usados:
            n += 1
        return str(n)

    def na_construcao(self, codigo: str) -> bool:
        """O nível está abaixo de algum ramo 'CWP…' (construção)? Sem ramo nenhum no arquivo, vale tudo."""
        ramos = [c for c, n in self.por_codigo.items() if n.nome.strip().upper().startswith("CWP")]
        return not ramos or any(codigo.startswith(r + ".") for r in ramos)

    def ramo_de_construcao(self) -> str:
        """Código do primeiro nível 'CWP…' (ramo de construção); '' (raiz do projeto) se não houver."""
        cands = [c for c, n in self.por_codigo.items() if n.nome.strip().upper().startswith("CWP")]
        return min(cands, key=lambda c: (c.count("."), c)) if cands else ""

    def achar_area(self, cwa: str, ativo: str | None) -> str | None:
        """Nível do CWA (004.05) no ramo de construção; CWA repetido: o que tem o Ativo no nome."""
        cands = [n for c, n in self.por_codigo.items() if self.na_construcao(c)
                 and (m := _CWA.search(n.nome)) and m.group(2) and f"{m.group(1)}.{m.group(2)}" == cwa]
        if ativo:
            sem = re.sub(r"\s+", "", ativo.upper())
            cands = [n for n in cands if sem in re.sub(r"\s+", "", n.nome.upper())] or cands
        return cands[0].codigo if cands else None

    def pai_da_area(self, cwa: str) -> str:
        """Onde uma área nova entra: no nível 'CWA 004 - …' do ramo de construção, senão no próprio ramo."""
        cands = [c for c, n in self.por_codigo.items() if self.na_construcao(c)
                 and _cobre(n.nome, cwa[:3])]
        return min(cands, key=lambda c: (c.count("."), c)) if cands else self.ramo_de_construcao()

    def nova_wbs(self, xer: Xer, pai: str, nome: str, codigo_curto: str | None = None) -> str:
        """Acrescenta o nível na EAP e devolve o código WBS completo."""
        curto = codigo_curto or self.proximo_codigo(pai)
        pai_id = self.wbs_id(pai)
        irmaos = self.filhos.get(pai_id, [])
        seq = max([int(w.get("seq_num") or 0) for w in irmaos if (w.get("seq_num") or "0").lstrip("-").isdigit()], default=0) + 1
        wid = str(self.prox_wbs)
        self.prox_wbs += 1
        linha = dict(self.modelo_wbs)
        linha.update({"wbs_id": wid, "proj_id": self.proj_id, "parent_wbs_id": pai_id, "seq_num": str(seq),
                      "proj_node_flag": "N", "wbs_short_name": curto, "wbs_name": nome[:100], "guid": "", "tmpl_guid": "",
                      "anticip_start_date": "", "anticip_end_date": "", "orig_cost": "0.0000",
                      "indep_remain_total_cost": "0.0000", "indep_remain_work_qty": "0"})
        xer.acrescentar("PROJWBS", linha)
        self.filhos.setdefault(pai_id, []).append(linha)
        self.por_id[wid] = linha
        cod = f"{pai}.{curto}" if pai else curto
        self.por_codigo[cod] = NoP6(wid, cod, nome)
        return cod

    def nova_atividade(self, xer: Xer, wbs: str, codigo: str, nome: str) -> None:
        if self.modelo_tarefa is None:
            raise DomainError("o .xer não tem atividades para servir de modelo", "arquivo")
        t = dict(self.modelo_tarefa)
        vazios = ("act_start_date", "act_end_date", "cstr_date", "cstr_type", "cstr_date2", "cstr_type2", "suspend_date",
                  "resume_date", "restart_date", "reend_date", "expect_end_date", "external_early_start_date",
                  "external_late_end_date", "float_path", "float_path_order", "guid", "tmpl_guid", "rsrc_id",
                  "create_date", "update_date", "location_id")
        t.update({k: "" for k in vazios if k in t})
        t.update({"task_id": str(self.prox_task), "proj_id": self.proj_id, "wbs_id": self.wbs_id(wbs),
                  "task_code": codigo, "task_name": nome[:120], "task_type": "TT_Task", "status_code": "TK_NotStart",
                  "phys_complete_pct": "0", "act_work_qty": "0", "act_equip_qty": "0", "act_this_per_work_qty": "0",
                  "act_this_per_equip_qty": "0", "driving_path_flag": "N"})
        self.prox_task += 1
        xer.acrescentar("TASK", t)
        self.atividades.add(codigo)


def nome_area(cwa: str, ativo: str | None, descricao: str) -> str:
    """Nome do nível da área no P6, no padrão que a leitura reconhece: 'CWA 004.07 - ED-1800AA-04 - Galpão'."""
    return " - ".join(p for p in (f"CWA {cwa}", (ativo or "").strip(), " ".join(descricao.split())) if p)[:100]
