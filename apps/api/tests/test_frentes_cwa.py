"""Lista de frentes no padrão da obra: CWA | Ativo | DESCRICAO CWA | Local."""
from pathlib import Path

from app.modules.frentes.domain.frentes import eh_formato_cwa, interpretar_lista

LISTA = (Path(__file__).parent / "dados" / "frentes_cwa.txt").read_text(encoding="utf-8")


def test_interpretar_lista_cwa():
    assert eh_formato_cwa(LISTA) and not eh_formato_cwa("CODIGO\tDESCRICAO\n1\tOBRA GERAL\n004.00\tCMD")
    locais = interpretar_lista(LISTA)
    nomes = [loc.descricao for loc in locais]
    assert nomes[:4] == ["Geral", "S2", "MIRANTE DA MINA AUTÔNOMA", "Novo CMD"]
    assert "TR/ Pilha Feijão" in nomes and "Comum/Geral" in nomes and len(nomes) == 10
    geral = locais[0]
    assert [(a.cwa, a.descricao, a.ativo) for a in geral.areas] == [
        ("1", "OBRA GERAL", None), ("6", "MANUTENÇÃO E ADEQUAÇÕES DE ACESSOS", None)]
    cmd = {a.descricao: a for a in locais[3].areas}
    assert (cmd["Prédio administrativo"].ativo, cmd["Prédio administrativo"].tag) == ("ED-1800AA-04", "1800AA-ED-04")
    # CWA repetido (004.09 três vezes) ganha sufixo para o Simova
    assert sorted(a.codigo for a in locais[3].areas if a.cwa == "004.09") == ["004.09.1", "004.09.2", "004.09.3"]
    oficina = next(loc for loc in locais if loc.descricao == "Nova Oficina")
    quimicos = next(a for a in oficina.areas if a.descricao.startswith("Galpão de Produtos"))
    assert quimicos.ativo == "ED-1600AA-104"  # espaço antes do ativo é ignorado
    assert next(a for a in oficina.areas if a.cwa == "016.04").tag is None  # ST-1640AA (sem número) não vira TAG


def test_importar_lista_cwa_e_reimportar(client):
    r = client.post("/api/frentes/importar", json={"texto": LISTA})
    assert r.status_code == 200, r.text
    arv = r.json()
    assert len(arv) == 10 and sum(len(loc["areas"]) for loc in arv) == 68
    codigos_locais = [loc["codigo"] for loc in arv]
    assert codigos_locais[:3] == ["L1", "L2", "L3"]  # locais pelo nome ganham código que não colide com os CWAs
    cmd = next(loc for loc in arv if loc["descricao"] == "Novo CMD")
    pa = next(a for a in cmd["areas"] if a["descricao"] == "Prédio administrativo")
    assert (pa["cwa"], pa["codigo"], pa["ativo_codigo"], pa["tag"]) == ("004.02", "004.02", "ED-1800AA-04", "1800AA-ED-04")
    # reimportar não duplica; mudar a descrição atualiza a área (casa pelo CWA + Ativo)
    texto2 = LISTA.replace("Prédio administrativo\tNovo CMD", "Prédio administrativo do CMD\tNovo CMD")
    arv2 = client.post("/api/frentes/importar", json={"texto": texto2}).json()
    assert len(arv2) == 10 and sum(len(loc["areas"]) for loc in arv2) == 68
    pa2 = next(a for loc in arv2 for a in loc["areas"] if a["ativo_codigo"] == "ED-1800AA-04")
    assert pa2["id"] == pa["id"] and pa2["descricao"] == "Prédio administrativo do CMD"
    # área avulsa com Ativo: a TAG sai do Ativo
    r = client.post("/api/frentes/areas", json={"local_id": cmd["id"], "cwa": "004.13", "descricao": "Guarita",
                                                "ativo_codigo": "ed-1800aa-09"})
    assert r.status_code == 201 and (r.json()["ativo_codigo"], r.json()["tag"]) == ("ED-1800AA-09", "1800AA-ED-09")


def test_lista_cwa_substitui_locais_antigos(client):
    """Obra que usava o formato antigo (Local 1, S2…): as áreas vão para os locais novos, os locais antigos vazios
    saem e a área de CWA "1" fica com o código 1 (sem sufixo)."""
    antigo = "CODIGO\tDESCRICAO\n1\tOBRA GERAL\n004.02\tED-1800AA-04 – Prédio administrativo\nS2\tPLATÔ S2\n004.99\tÁrea fora da lista"
    client.post("/api/frentes/importar", json={"texto": antigo})
    arv = client.post("/api/frentes/importar", json={"texto": LISTA}).json()
    por_desc = {loc["descricao"]: loc for loc in arv}
    assert "OBRA GERAL" not in por_desc  # local antigo "1" ficou vazio e saiu
    assert "PLATÔ S2" in por_desc  # local antigo S2 ainda tem área fora da lista: fica
    geral = por_desc["Geral"]
    assert [a["codigo"] for a in geral["areas"]][0] == "1"
    pa = next(a for a in por_desc["Novo CMD"]["areas"] if a["cwa"] == "004.02")
    assert pa["ativo_codigo"] == "ED-1800AA-04" and pa["descricao"] == "Prédio administrativo"  # mesma área, casada pela TAG
    assert sum(1 for loc in arv for a in loc["areas"] if a["cwa"] == "004.02") == 1


def test_cwa_e_o_codigo_tag_so_com_takeoff_e_excluir_todas(client):
    arv = client.post("/api/frentes/importar", json={"texto": LISTA}).json()
    cmd = next(loc for loc in arv if loc["descricao"] == "Novo CMD")
    pa = next(a for a in cmd["areas"] if a["cwa"] == "004.02")
    assert pa["codigo"] == "004.02" and pa["no_takeoff"] is False  # sem take-off importado: só o Ativo
    # código pedido é ignorado: o código é o CWA
    r = client.post("/api/frentes/areas", json={"local_id": cmd["id"], "cwa": "004.20", "codigo": "XYZ",
                                                "descricao": "Guarita", "ativo_codigo": "ED-1800AA-20"})
    assert r.json()["codigo"] == "004.20"
    r = client.put(f"/api/frentes/areas/{r.json()['id']}", json={"local_id": cmd["id"], "cwa": "004.21", "descricao": "Guarita"})
    assert r.json()["codigo"] == "004.21"
    # excluir todas
    r = client.delete("/api/frentes").json()
    assert r["areas_excluidas"] == 69 and r["areas_mantidas"] == 0 and r["locais_excluidos"] == 10
    assert client.get("/api/frentes").json() == []
