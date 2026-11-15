"""Funil de mobilização de um colaborador até o crachá (spec 087) — regras do Planning Control trazidas para a obra.

Etapas: Solicitação → Seleção → Exames → ASO → Contratação ⇄ Treinamento → Documentação ao cliente → Aprovação → Crachá.
- Só se conclui a etapa que está aberta; concluir abre a próxima ainda não concluída.
- Treinamento antes da contratação (`treinamento_antes`): depois do ASO vem o Treinamento e depois a Contratação.
- ASO só conclui com ASO apto e válido da pessoa (cadastro de ASOs da segurança, spec 088).
- Documentação ao cliente só depois da Contratação e com os treinamentos exigidos da função em dia; função sem
  exigência cadastrada pede a confirmação de quem conclui.
- A última etapa (Crachá) concluída = MOBILIZADO; enquanto o Crachá está aberto = AGUARDANDO_CRACHA.
- Desistência fecha a etapa aberta e encerra o processo (fica registrado em que etapa desistiu).
Duração de cada etapa = saída − entrada; metas da obra em dias por faixa (Seleção, Admissão/ASO, …).
"""
from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime
from enum import StrEnum

from app.shared.errors import DomainError


class Etapa(StrEnum):
    SOLICITACAO = "SOLICITACAO"
    SELECAO = "SELECAO"
    EXAMES = "EXAMES"
    ASO = "ASO"
    CONTRATACAO = "CONTRATACAO"
    TREINAMENTO = "TREINAMENTO"
    DOCUMENTACAO_CLIENTE = "DOCUMENTACAO_CLIENTE"
    APROVACAO = "APROVACAO"
    CRACHA = "CRACHA"

    @property
    def rotulo(self) -> str:
        return ROTULOS[self]


ETAPAS: tuple[Etapa, ...] = tuple(Etapa)
ROTULOS = {
    Etapa.SOLICITACAO: "Solicitação de contratação", Etapa.SELECAO: "Indicação / seleção",
    Etapa.EXAMES: "Encaminhado para exames", Etapa.ASO: "ASO liberado", Etapa.CONTRATACAO: "Contratação efetivada",
    Etapa.TREINAMENTO: "Treinamentos", Etapa.DOCUMENTACAO_CLIENTE: "Documentação enviada ao cliente",
    Etapa.APROVACAO: "Aprovação do cliente", Etapa.CRACHA: "Emissão do crachá",
}


class Meta(StrEnum):
    SELECAO = "SELECAO"
    ADMISSAO_ASO = "ADMISSAO_ASO"
    CONTRATACAO = "CONTRATACAO"
    TREINAMENTO = "TREINAMENTO"
    DOCUMENTACAO_CLIENTE = "DOCUMENTACAO_CLIENTE"
    APROVACAO = "APROVACAO"
    CRACHA = "CRACHA"


FAIXA: dict[Meta, tuple[Etapa, ...]] = {
    Meta.SELECAO: (Etapa.SOLICITACAO, Etapa.SELECAO), Meta.ADMISSAO_ASO: (Etapa.EXAMES, Etapa.ASO),
    Meta.CONTRATACAO: (Etapa.CONTRATACAO,), Meta.TREINAMENTO: (Etapa.TREINAMENTO,),
    Meta.DOCUMENTACAO_CLIENTE: (Etapa.DOCUMENTACAO_CLIENTE,), Meta.APROVACAO: (Etapa.APROVACAO,), Meta.CRACHA: (Etapa.CRACHA,),
}
ROTULO_META = {
    Meta.SELECAO: "Seleção", Meta.ADMISSAO_ASO: "Admissão / ASO", Meta.CONTRATACAO: "Contratação",
    Meta.TREINAMENTO: "Treinamentos", Meta.DOCUMENTACAO_CLIENTE: "Documentação ao cliente", Meta.APROVACAO: "Aprovação",
    Meta.CRACHA: "Crachá",
}
METAS_PADRAO = {Meta.SELECAO: 5, Meta.ADMISSAO_ASO: 3, Meta.CONTRATACAO: 2, Meta.TREINAMENTO: 3,
                Meta.DOCUMENTACAO_CLIENTE: 2, Meta.APROVACAO: 3, Meta.CRACHA: 2}


class Status(StrEnum):
    EM_ANDAMENTO = "EM_ANDAMENTO"
    AGUARDANDO_CRACHA = "AGUARDANDO_CRACHA"
    MOBILIZADO = "MOBILIZADO"
    DESISTENCIA = "DESISTENCIA"

    @property
    def rotulo(self) -> str:
        return {"EM_ANDAMENTO": "Em andamento", "AGUARDANDO_CRACHA": "Aguardando crachá", "MOBILIZADO": "Mobilizado",
                "DESISTENCIA": "Desistência"}[self.value]

    @property
    def aberto(self) -> bool:
        return self in (Status.EM_ANDAMENTO, Status.AGUARDANDO_CRACHA)


@dataclass(frozen=True)
class Passagem:
    """Uma passagem por uma etapa: entrou em, saiu em (None = aberta)."""
    etapa: Etapa
    entrou_em: datetime
    saiu_em: datetime | None = None

    def dias(self, agora: datetime) -> float:
        return max(0.0, ((self.saiu_em or agora) - self.entrou_em).total_seconds() / 86400)


@dataclass(frozen=True)
class Liberacoes:
    """O que vem de fora do funil para destravar as etapas (cadastro de ASOs e treinamentos)."""
    aso_apto: bool = False
    treinamentos_pendentes: tuple[str, ...] = ()
    funcao_tem_exigencia: bool = True
    confirmar_treinamentos: bool = False


@dataclass(frozen=True)
class Processo:
    passagens: tuple[Passagem, ...]
    status: Status = Status.EM_ANDAMENTO
    treinamento_antes: bool = False

    def __post_init__(self) -> None:
        if not self.passagens:
            raise DomainError("processo sem etapas")
        abertas = [p for p in self.passagens if p.saiu_em is None]
        if len(abertas) > 1:
            raise DomainError("só uma etapa pode estar aberta")

    @staticmethod
    def iniciar(agora: datetime, treinamento_antes: bool = False) -> Processo:
        return Processo((Passagem(Etapa.SOLICITACAO, agora),), Status.EM_ANDAMENTO, treinamento_antes)

    @property
    def aberta(self) -> Passagem | None:
        return next((p for p in self.passagens if p.saiu_em is None), None)

    @property
    def etapa_atual(self) -> Etapa:
        a = self.aberta
        return a.etapa if a else self.passagens[-1].etapa

    def concluida(self, e: Etapa) -> bool:
        return any(p.etapa == e and p.saiu_em is not None for p in self.passagens)

    def _proxima(self, e: Etapa) -> Etapa | None:
        if e == Etapa.ASO and self.treinamento_antes and not self.concluida(Etapa.TREINAMENTO):
            return Etapa.TREINAMENTO
        if e == Etapa.TREINAMENTO and not self.concluida(Etapa.CONTRATACAO):
            return Etapa.CONTRATACAO
        if e == Etapa.CONTRATACAO and not self.concluida(Etapa.TREINAMENTO):
            return Etapa.TREINAMENTO
        for c in ETAPAS[ETAPAS.index(e) + 1:]:
            if not self.concluida(c):
                return c
        return None

    def concluir(self, etapa: Etapa, agora: datetime, lib: Liberacoes = Liberacoes()) -> Processo:
        if not self.status.aberto:
            raise DomainError(f"processo encerrado ({self.status.rotulo.lower()})")
        a = self.aberta
        if a is None or a.etapa != etapa:
            raise DomainError(f"conclua a etapa aberta ({a.etapa.rotulo if a else '—'})", "etapa")
        if agora < a.entrou_em:
            if (a.entrou_em - agora).total_seconds() > 60:
                raise DomainError("a conclusão não pode ser antes da entrada na etapa", "em")
            agora = a.entrou_em  # hora digitada sem os segundos, no mesmo minuto da entrada
        if etapa == Etapa.ASO and not lib.aso_apto:
            raise DomainError("registre o ASO apto e válido da pessoa antes de liberar (aba ASOs da Segurança)", "etapa")
        if etapa == Etapa.DOCUMENTACAO_CLIENTE:
            if not self.concluida(Etapa.CONTRATACAO):
                raise DomainError("a contratação precisa estar efetivada antes do envio ao cliente", "etapa")
            if lib.treinamentos_pendentes:
                raise DomainError(f"treinamentos em aberto: {', '.join(lib.treinamentos_pendentes)}", "etapa")
            if not lib.funcao_tem_exigencia and not lib.confirmar_treinamentos:
                raise DomainError("a função não tem treinamentos exigidos cadastrados: confirme a matriz para enviar",
                                  "confirmar_treinamentos")
        ps = tuple(replace(p, saiu_em=agora) if p is a else p for p in self.passagens)
        fechado = replace(self, passagens=ps)
        prox = fechado._proxima(etapa)
        if prox is None:
            return replace(fechado, status=Status.MOBILIZADO)
        st = Status.AGUARDANDO_CRACHA if prox == Etapa.CRACHA else Status.EM_ANDAMENTO
        return replace(fechado, passagens=ps + (Passagem(prox, agora),), status=st)

    def desistir(self, agora: datetime) -> Processo:
        if not self.status.aberto:
            raise DomainError(f"processo já encerrado ({self.status.rotulo.lower()})")
        ps = tuple(replace(p, saiu_em=max(agora, p.entrou_em)) if p.saiu_em is None else p for p in self.passagens)
        return replace(self, passagens=ps, status=Status.DESISTENCIA)

    def voltar(self) -> Processo:
        """Desfaz a última conclusão (lançamento errado): apaga a etapa aberta e reabre a anterior."""
        if self.status == Status.DESISTENCIA:
            return replace(self, passagens=tuple(replace(p, saiu_em=None) if p is self.passagens[-1] else p
                                                 for p in self.passagens), status=Status.EM_ANDAMENTO)
        if len(self.passagens) < 2 and self.aberta is not None:
            raise DomainError("nada para voltar: o processo está na primeira etapa")
        ps = list(self.passagens)
        if self.aberta is not None:
            ps.pop()
        ps[-1] = replace(ps[-1], saiu_em=None)
        st = Status.AGUARDANDO_CRACHA if ps[-1].etapa == Etapa.CRACHA else Status.EM_ANDAMENTO
        return replace(self, passagens=tuple(ps), status=st)

    def dias_faixa(self, meta: Meta, agora: datetime) -> float | None:
        """Tempo da faixa da meta: da entrada na 1ª etapa até a saída da última (ou agora). None = ainda não começou."""
        faixa = FAIXA[meta]
        ini = next((p for p in self.passagens if p.etapa == faixa[0]), None)
        if ini is None:
            return None
        fim = next((p for p in self.passagens if p.etapa == faixa[-1]), None)
        ate = fim.saiu_em if fim and fim.saiu_em else (agora if self.status.aberto else (self.passagens[-1].saiu_em or agora))
        return max(0.0, (ate - ini.entrou_em).total_seconds() / 86400)

    def dias_total(self, agora: datetime) -> float:
        fim = agora if self.status.aberto else (self.passagens[-1].saiu_em or agora)
        return max(0.0, (fim - self.passagens[0].entrou_em).total_seconds() / 86400)

    def atrasos(self, metas: dict[Meta, float], agora: datetime) -> list[Meta]:
        return [m for m in Meta if (d := self.dias_faixa(m, agora)) is not None and metas.get(m) is not None
                and d > metas[m]]
