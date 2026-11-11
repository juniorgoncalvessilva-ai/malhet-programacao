from app.modules.wbs.domain.cronograma import escolher_area, ler_caminho, normalizar_descricao


def test_caminho_do_p6():
    c = ler_caminho(["O.S. 1", "CWP - CONSTRUÇÃO", "CWA 004 - Novo CMD", "CWA 004.05 - ED-1800AA-01 - Galpão", "Sapatas", "Fustes"])
    assert (c.cwa, c.elemento, c.complemento) == ("004.05", "Sapatas", "Fustes")
    assert ler_caminho(["O.S. 1", "PWP - SUPRIMENTOS", "CWA 004 - Novo CMD", "CWA 004.05 - Galpão"]) is None  # suprimentos
    assert ler_caminho(["O.S. 1", "CWP - CONSTRUÇÃO", "CWA 004 - Novo CMD"]) is None  # sem CWA com área
    g = ler_caminho(["O.S. 1", "CWP - CONSTRUÇÃO", "CWA 004.05 - Galpão"])
    assert (g.elemento, g.complemento) == ("Geral", None)
    # CWA dentro de CWA: vale o mais fundo
    assert ler_caminho(["CWP", "CWA 020.00 - Canteiro", "CWA 020.01 -- Acesso", "Área da oficina"]).cwa == "020.01"


def test_area_e_descricao():
    areas = [(1, "004.09", "ED-1800AA-03"), (2, "004.09", "ED-1800AA-07"), (3, "004.05", "ED-1800AA-01")]
    assert escolher_area("004.09", "CWA 004.09 - ED-1800AA-07 - DIR", areas) == 2
    assert escolher_area("004.05", "CWA 004.05 - qualquer", areas) == 3
    assert escolher_area("009.99", "CWA 009.99", areas) is None
    assert normalizar_descricao("Escavação  mecanizada de cavas.") == normalizar_descricao("ESCAVACAO mecanizada de cavas")
