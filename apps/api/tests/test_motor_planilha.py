"""Regras portadas da Programacao_auxiliar_v5 / programacao_v5.py / macros."""
from datetime import date

import pytest

from app.modules.programacao.domain.calendario import Calendario, TipoProgramacao
from app.modules.programacao.domain.gargalo import (
    capacidade_da_equipe,
    distribuir_no_periodo,
    equipe_para_prazo,
)
from app.modules.programacao.domain.sequenciador import (
    AtividadeSeq,
    Predecessora,
    TipoLigacao,
    producao_com_sequencia,
    sequenciar,
)
from app.modules.referencias.domain import indice as ind


def test_calendario_semanal_9_dias_com_sexta_e_sabado_zerados():
    cal = Calendario(TipoProgramacao.SEMANAL, date(2026, 11, 6), jornada=9)
    dias = cal.dias()
    assert len(dias) == 9 and dias[0].data == date(2026, 11, 6) and dias[-1].data == date(2026, 11, 14)
    assert [d.horas for d in dias] == [0, 0, 0, 9, 9, 9, 9, 8, 0]
    assert dias[3].semana == "S32"
    assert cal.dias_de_referencia() == pytest.approx(4 + 8 / 9)


def test_calendario_mensal_com_hora_digitada():
    cal = Calendario(TipoProgramacao.MENSAL, date(2026, 11, 17), jornada=9, horas_digitadas={date(2026, 11, 3): 6})
    dias = cal.dias()
    assert len(dias) == 30 and dias[0].data == date(2026, 11, 1)
    assert dias[2].fator == pytest.approx(6 / 9)


def test_indices_orcado_usado_e_especifico():
    rec = [ind.RecursoCpu("Pedreiro", "MOD", 1.113), ind.RecursoCpu("Servente", "MOD", 0.428),
           ind.RecursoCpu("Betoneira", "EQU", 0.3)]
    gov = ind.recurso_que_governa(rec)
    assert gov.recurso == "Pedreiro"
    orc = ind.indice_orcado(9, gov.coef_por_unidade)
    assert orc == pytest.approx(8.0863, rel=1e-3)  # 'indice_orcado' da aba ATIVIDADES (C-23440)
    usado = ind.indice_usado(orcado=orc, seletor=ind.Seletor.AJUSTADO, fator_familia=0.8)
    assert usado == pytest.approx(orc * 0.8)
    f = ind.fator_indice(orc, usado)
    coefs = ind.coeficientes_usados(rec, jornada=9, fator=f)
    assert coefs["Pedreiro"] == pytest.approx(1.113 / 0.8)
    assert ind.hh_por_unidade_mod(rec, coefs) == pytest.approx((1.113 + 0.428) / 0.8)

    esp = ind.IndiceEspecifico("Armador - armadura", "Armador", 155.25, "Servente", 0.49)
    assert ind.indice_usado(orcado=orc, especifico=esp) == 155.25
    c2 = ind.coeficientes_usados(rec, jornada=9, especifico=esp)
    assert c2 == {"Armador": pytest.approx(9 / 155.25), "Servente": pytest.approx(0.49 * 9 / 155.25)}


def test_gargalo_da_equipe():
    coefs = {"Carpinteiro": 3.0, "Servente": 1.2, "Munck": 0.1}
    r = capacidade_da_equipe(coefs, {"Carpinteiro": 11, "Servente": 3}, jornada=9, recurso_governa="Carpinteiro")
    # razões: carpinteiro 3/11=0.2727, servente 1.2/3=0.4 → gargalo servente
    assert r.gargalo == "Servente" and r.capacidade_un_dia == pytest.approx(9 / 0.4)
    assert r.apoio_externo == ("Munck",)
    sem = capacidade_da_equipe(coefs, {"Servente": 3}, jornada=9, recurso_governa="Carpinteiro")
    assert sem.capacidade_un_dia == 0 and sem.falta_governante


def test_equipe_para_prazo_e_distribuicao():
    assert equipe_para_prazo(185.25, 60, 2) == 2
    assert equipe_para_prazo(0, 60, 2) is None
    assert distribuir_no_periodo(10, 4, [0, 1, 1, 1, 0.5]) == [0, 4, 4, 2, 0]


def test_sequenciador_serial_por_equipe_com_ti_ii_e_lag():
    ativ = [
        AtividadeSeq(1, 2, "EQ-FORMA"),
        AtividadeSeq(2, 1, "EQ-FORMA"),
        AtividadeSeq(3, 3, "EQ-ARMACAO", (Predecessora(1, TipoLigacao.TI, 0.5),)),
        AtividadeSeq(4, 1, None, (Predecessora(3, TipoLigacao.II, 1),)),
    ]
    r = sequenciar(ativ)
    assert (r.inicio[1], r.fim[1]) == (0, 2)
    assert (r.inicio[2], r.fim[2]) == (2, 3)  # mesma equipe espera a anterior
    assert r.inicio[3] == 2.5  # TI + lag
    assert r.inicio[4] == 3.5  # II + lag
    assert r.sequencia_na_equipe == {1: 1, 2: 2, 3: 1}


def test_sequenciador_detecta_ciclo():
    r = sequenciar([AtividadeSeq(1, 1, None, (Predecessora(2),)), AtividadeSeq(2, 1, None, (Predecessora(1),))])
    assert r.em_ciclo == (1, 2)


def test_producao_com_sequencia_respeita_janela():
    # capacidade 10/dia de ref.; atividade ocupa [1.5, 3.0] em dias de referência
    assert producao_com_sequencia(10, 1.5, 3.0, [1, 2, 3, 4]) == [0, 5, 10, 0]


def test_recurso_que_governa_ignora_apoio():
    """CPU da obra: no lançamento de concreto o servente tem mais h/un, mas quem dita o ritmo é o pedreiro."""
    rec = [ind.RecursoCpu("Servente", "MOD", 2.8), ind.RecursoCpu("Pedreiro", "MOD", 1.3),
           ind.RecursoCpu("Encarregado de pedreiro", "MOD", 0.3583), ind.RecursoCpu("Vibrador", "EQU", 3.0)]
    assert ind.recurso_que_governa(rec).recurso == "Pedreiro"
    assert ind.indice_orcado(9, 1.3) == pytest.approx(6.923, rel=1e-3)
    so_apoio = [ind.RecursoCpu("Servente", "MOD", 2.0)]
    assert ind.recurso_que_governa(so_apoio).recurso == "Servente"
    so_equip = [ind.RecursoCpu("Escavadeira Hidráulica CAT 320", "EQU", 0.0222)]
    assert ind.recurso_que_governa(so_equip).recurso == "Escavadeira Hidráulica CAT 320"


def test_capacidade_pela_equipe_e_pelo_recurso_que_governa():
    """Equipe 6 pedreiros + 2 serventes + 1 marteleteiro; CPU 1,3 / 2,8 / 0,2 h/m³; 9 h.
    Por função: pessoas × jornada ÷ h/un. Equipe completa = a menor (gargalo); pelo governa = só o Pedreiro."""
    from app.modules.programacao.domain.gargalo import capacidade_da_equipe, capacidade_por_funcao, capacidade_pelo_governa

    coefs = {"Pedreiro": 1.3, "Servente": 2.8, "Marteleteiro": 0.2, "Encarregado de pedreiro": 0.3583}
    comp = {"Pedreiro": 6, "Servente": 2, "Marteleteiro": 1}
    por = capacidade_por_funcao(coefs, comp, 9)
    assert por["Servente"] == pytest.approx(2 * 9 / 2.8) and por["Pedreiro"] == pytest.approx(6 * 9 / 1.3)
    assert "Encarregado de pedreiro" not in por  # a equipe não tem: apoio externo
    assert capacidade_da_equipe(coefs, comp, 9, "Pedreiro").capacidade_un_dia == pytest.approx(min(por.values()))
    assert capacidade_pelo_governa(coefs, comp, 9, "Pedreiro") == pytest.approx(6 * 9 / 1.3)
    assert capacidade_pelo_governa(coefs, {"Servente": 2}, 9, "Pedreiro") == 0.0  # sem quem governa


def test_previsto_pela_capacidade_usa_fator_do_dia_e_para_no_limite():
    from app.modules.programacao.domain.previsto import capacidade_por_dia, fatores_do_periodo, previsto_pela_capacidade

    datas = [date(2026, 11, 6 + i) for i in range(9)]  # sex 06 → sáb 14
    f = fatores_do_periodo(datas, semanal=True)
    assert [x.horas for x in f] == [0, 0, 0, 9, 9, 9, 9, 8, 0]  # sex/sáb anteriores zerados, domingo 0
    assert capacidade_por_dia(10.0, f)[7] == pytest.approx(10 * 8 / 9, abs=1e-4)
    assert previsto_pela_capacidade(10.0, f) == [None, None, None, 10.0, 10.0, 10.0, 10.0, 8.89, None]
    # limite (qtd do período) 25: 10 + 10 + 5 e para
    assert previsto_pela_capacidade(10.0, f, limite=25) == [None, None, None, 10.0, 10.0, 5.0, None, None, None]
    assert previsto_pela_capacidade(None, f) == [None] * 9
    assert previsto_pela_capacidade(0.0, f, limite=10) == [None] * 9


def test_lookahead_blocos_da_equipe_no_tempo():
    from datetime import date as D

    from app.modules.lookahead.domain.blocos import DiaEquipe, blocos, faixas

    def dia(d, area=1, at=("forma",), prog=1, ini=D(2026, 11, 6), eq=7):
        return DiaEquipe(eq, area, at, d, 5.0, None, prog, 10 + area, ini)

    dias = [dia(D(2026, 11, 9)), dia(D(2026, 11, 10)), dia(D(2026, 11, 11)),  # seg–qua na área 1
            dia(D(2026, 11, 11), area=2), dia(D(2026, 11, 12), area=2), dia(D(2026, 11, 13), area=2),  # qua–sex na área 2
            dia(D(2026, 11, 16), area=2),  # segunda seguinte: o fim de semana não quebra o bloco
            dia(D(2026, 11, 13), area=2, prog=2, ini=D(2026, 11, 13))]  # sexta repetida na semana seguinte: vale a mais nova
    bs = blocos(dias)
    assert [(b.area_id, b.inicio.day, b.fim.day, len(b.dias)) for b in bs] == [(1, 9, 11, 3), (2, 11, 16, 4)]
    assert [d.programacao_id for d in bs[1].dias if d.data.day == 13] == [2]
    assert faixas(bs) == {0: 0, 1: 1}  # quarta nas duas áreas: os cartões não se sobrepõem


def test_farol_e_status_da_acao_como_na_planilha_6wla():
    from datetime import date as D

    from app.modules.restricoes.domain.acao import situacao

    hoje = D(2026, 11, 12)
    assert situacao("Concluído", D(2026, 11, 1), None, hoje).farol == 4
    assert situacao("Cancelado", D(2026, 11, 1), None, hoje).status2 == "Cancelado"
    assert situacao("Pendente", D(2026, 11, 20), None, hoje).status2 == "No Prazo"
    assert situacao("Pendente", D(2026, 11, 12), None, hoje).status2 == "Atrasado"  # planilha: hoje ≥ término
    assert situacao("Pendente", D(2026, 11, 5), D(2026, 11, 19), hoje).status2 == "Reprogramado"
    assert situacao("Pendente", D(2026, 11, 5), D(2026, 11, 10), hoje).farol == 1


def test_observacao_da_restricao_entra_com_a_data_no_topo():
    from datetime import date as D

    from app.modules.restricoes.domain.acao import anotar

    o = anotar(None, "  Vale informa  entrega ", D(2026, 10, 28))
    assert o == "28/10: Vale informa entrega"
    assert anotar(o, "Material chegou", D(2026, 11, 12)) == "12/11: Material chegou\n28/10: Vale informa entrega"
    assert anotar(o, "   ", D(2026, 11, 12)) == o


def test_painel_das_restricoes_conta_como_o_painel_acao():
    from app.modules.restricoes.domain.painel import LinhaPainel, painel

    L = [LinhaPainel(1, "Pendente", "Atrasado", "Ana", "CMD", "CLIENTE", "MAT", 32),
         LinhaPainel(2, "Pendente", "No Prazo", "Ana", "CMD", "CONTRATADA", None, 33),
         LinhaPainel(3, "Concluído", "Concluído", "Bia", "CMD", "CLIENTE", "MDO", 30),
         LinhaPainel(4, "Pendente", "Reprogramado", "Bia", "Oficina", "CLIENTE", "MAT", 32)]
    p = painel(L)
    assert [(g.rotulo, g.n("total")) for g in p["status"]] == [("Concluído", 1), ("No Prazo", 1), ("Reprogramado", 1), ("Atrasado", 1)]
    ana = p["responsavel"][0]
    assert ana.rotulo == "Ana" and (ana.n("Atrasado"), ana.n("No Prazo"), ana.n("Reprogramado")) == (1, 1, 0)
    assert [(g.rotulo, g.n("total")) for g in p["semana"]] == [("S32", 2), ("S33", 1)]
    cmd = p["areas"][0]
    assert cmd.rotulo == "CMD" and (cmd.n("Pendente"), cmd.n("Concluído")) == (2, 1)
    assert [(g.rotulo, g.n("total")) for g in p["seis_m"]] == [("MAT", 2), ("", 1)]  # só pendentes
    assert [(g.rotulo, g.n("total")) for g in p["gerencia"]] == [("CLIENTE", 3), ("CONTRATADA", 1)]
