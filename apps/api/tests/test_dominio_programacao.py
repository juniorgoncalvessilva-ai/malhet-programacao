from datetime import date

import pytest

from app.modules.programacao.domain import capacidade
from app.modules.programacao.domain.capacidade import MembroEquipe
from app.modules.programacao.domain.item_programacao import DiaPlano, ItemProgramacao, Origem, Status
from app.shared.errors import DomainError


def item(**kw):
    base = dict(encarregado_cracha="113321", encarregado_nome="Wilson", grupo_codigo="4", grupo_descricao="FORMA",
                oper_codigo="1.1", oper_descricao="Forma externa", frente_codigo="30",
                data_inicio=date(2026, 11, 9), data_fim=date(2026, 11, 13), origem=Origem.PADRAO,
                dias=(DiaPlano(date(2026, 11, 9), pe=10),))
    base.update(kw)
    return ItemProgramacao(**base)


def test_periodo_maior_que_7_dias_e_rejeitado():
    with pytest.raises(DomainError, match="7 dias"):
        item(data_fim=date(2026, 11, 20))


def test_dia_fora_do_periodo_e_rejeitado():
    with pytest.raises(DomainError, match="fora do período"):
        item(dias=(DiaPlano(date(2026, 11, 20), pe=1),))


def test_precisa_de_pe_ou_hh():
    with pytest.raises(DomainError, match="PE ou HH"):
        item(dias=(DiaPlano(date(2026, 11, 9)),))


def test_origem_cronograma_exige_id_crono_e_pq_exige_item():
    with pytest.raises(DomainError, match="id_crono"):
        item(origem=Origem.CRONOGRAMA)
    with pytest.raises(DomainError, match="PQ"):
        item(origem=Origem.PQ)
    assert Origem.deduzir("C-1", None) == Origem.CRONOGRAMA
    assert Origem.deduzir(None, "1.2.3") == Origem.PQ
    assert Origem.deduzir(None, None) == Origem.PADRAO


def test_hh_derivado_do_pe_pelo_indice_e_imutabilidade():
    i = item(indice_hh_por_unidade=0.5, dias=(DiaPlano(date(2026, 11, 9), pe=10), DiaPlano(date(2026, 11, 10), pe=4, hh=9)))
    j = i.com_hh_calculado()
    assert [d.hh for d in j.dias] == [5.0, 9]
    assert i.dias[0].hh is None  # original intacto


def test_fluxo_de_status():
    i = item()
    a = i.aprovar()
    assert a.status == Status.APROVADO
    assert a.marcar_exportado().status == Status.EXPORTADO
    with pytest.raises(DomainError):
        a.aprovar()
    with pytest.raises(DomainError):
        i.marcar_exportado()


def test_capacidade_soma_so_mod_e_aponta_excesso():
    equipe = [MembroEquipe("Carpinteiro", "MOD", 2, 9), MembroEquipe("Servente", "MOD", 1, 9),
              MembroEquipe("Munck", "EQU", 1, 9)]
    hh = capacidade.hh_disponivel(equipe)
    assert hh == 27
    i1 = item(dias=(DiaPlano(date(2026, 11, 9), hh=20),))
    i2 = item(oper_codigo="1.2", dias=(DiaPlano(date(2026, 11, 9), hh=10), DiaPlano(date(2026, 11, 10), hh=5)))
    exc = capacidade.excessos([i1, i2], hh)
    assert [(e.data, e.hh_programado, e.saldo) for e in exc] == [(date(2026, 11, 9), 30, -3)]
    assert capacidade.producao_maxima(27, 0.5) == 54
