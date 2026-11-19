"""Spec 101: resumo do dia (check out) — atividades executadas, ocorrências, restrições, auditorias, equipes e fotos por
frente, com o texto de cada parte pronto para o WhatsApp."""
from app.modules.campo.domain.resumo_dia import juntar, num, textos
from tests.test_book_fotos import _jpeg
from tests.test_excluir_revisao import _programacao

DIA = "2026-11-10"


def _cenario(client):
    pid = _programacao(client)  # linha "Concreto bombeado … (Fundo canaleta)" na 004.05, previsto em 09/11
    ln = client.get(f"/api/programacoes/{pid}").json()["locais"][0]["areas"][0]["linhas"][0]
    client.put(f"/api/programacoes/{pid}/linhas/{ln['id']}/valores", json={"campo": "previsto", "valores": [{"data": DIA, "valor": 5}]})
    assert client.post(f"/api/programacoes/{pid}/emitir").status_code == 200
    client.put(f"/api/programacoes/{pid}/linhas/{ln['id']}/valores", json={"campo": "realizado", "valores": [{"data": DIA, "valor": 4.5}]})
    r = client.post("/api/fotos", data={"alvo": "linha", "alvo_id": str(ln["id"]), "data": DIA, "legenda": "Concretagem"},
                    files={"arquivo": ("f.jpg", _jpeg(), "image/jpeg")})
    assert r.status_code == 201, r.text
    causa = client.get("/api/desvios/causas").json()[0]
    r = client.post("/api/desvios", json={"data": DIA, "causa_id": causa["id"], "descricao": "Bomba de concreto atrasou 2 h",
                                          "programacao_id": pid, "linha_id": ln["id"], "acao": "Reprogramar o restante",
                                          "responsavel": "Planejamento"})
    assert r.status_code == 201, r.text
    area = client.get("/api/frentes").json()[0]["areas"][0]
    r = client.post("/api/restricoes", json={"acao": "Liberar desenho rev. C", "seis_m": "MET", "area_id": area["id"],
                                             "prazo_inicio": "2026-11-01", "prazo_termino": "2026-11-05"})
    assert r.status_code in (200, 201), r.text
    return pid, ln, causa


def test_resumo_do_dia(client):
    pid, ln, causa = _cenario(client)
    r = client.get("/api/campo/resumo-dia", params={"data": DIA})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["programacao"]["id"] == pid
    # atividades: Local → Área, com o realizado e a foto
    at = j["atividades"]
    assert at["total"] == 1
    g = at["grupos"][0]
    assert g["local"].startswith("L1") and g["area"].startswith("004.05")
    it = g["cwps"][0]["itens"][0]
    assert it["realizado"] == 4.5 and it["fotos"] == 1 and "Fundo canaleta" in it["atividade"]
    # ocorrência na frente da atividade impactada
    oc = j["ocorrencias"]
    assert oc["total"] == 1 and oc["grupos"][0]["area"].startswith("004.05")
    assert oc["grupos"][0]["itens"][0]["causa"] == causa["descricao"]
    # spec 102: sem equipe na linha, a ocorrência conta como "sem equipe"; com equipe, a equipe aparece impactada
    assert j["impactadas"] == {"itens": [], "total": 0, "ocorrencias": 0, "sem_equipe": 1}
    assert "1 ocorrência(s) sem equipe" in j["textos"]["impactadas"]
    # restrição nova (criada hoje) não entra num dia passado; a pendente da frente do dia entra como atrasada? só se já existia
    assert j["restricoes"]["total"] == 0
    # fotos agrupadas pela atividade
    assert j["fotos"]["total"] == 1 and j["fotos"]["grupos"][0]["itens"][0]["n"] == 1
    # texto pronto para o WhatsApp
    t = j["textos"]
    assert t["cabecalho"].startswith("*Check Out 10/11/2026*")
    assert "*ATIVIDADES EXECUTADAS (1)*" in t["atividades"] and "4,5 m³" in t["atividades"] and "*L1 · " in t["atividades"]
    assert "Bomba de concreto atrasou 2 h" in t["ocorrencias"] and "Ação: Reprogramar o restante (Planejamento)" in t["ocorrencias"]
    assert t["restricoes"] == "" and t["auditorias"] == ""
    assert "(1 foto)" in t["fotos"]
    assert j["texto"].count("\n\n*") >= 3  # partes com conteúdo separadas por linha em branco
    sem_qtd = client.get("/api/campo/resumo-dia", params={"data": DIA, "qtd": False}).json()["textos"]["atividades"]
    assert "4,5" not in sem_qtd

    # hoje: a restrição criada hoje aparece como nova
    from app.shared.tempo import hoje_local

    hoje = client.get("/api/campo/resumo-dia").json()
    assert hoje["data"] == hoje_local().isoformat()  # dia da obra (Brasília), não o do servidor em UTC
    assert hoje["restricoes"]["total"] == 1 and hoje["restricoes"]["grupos"][0]["itens"][0]["marcador"] == "nova"
    assert "_(nova)_" in hoje["textos"]["restricoes"]


def test_equipe_impactada(client):
    pid, ln, causa = _cenario(client)
    eq = client.post("/api/equipes", json={"nome": "EQ CONCRETO 01", "encarregado_cracha": "115095", "encarregado_nome": "Damião"})
    assert eq.status_code in (200, 201), eq.text
    from app.core.db import SessionLocal
    from app.modules.planejamento.infra.models import LinhaProgramacaoModel

    with SessionLocal() as s:  # a equipe da linha (a programação emitida não deixa editar a linha pela tela)
        s.get(LinhaProgramacaoModel, ln["id"]).equipe_id = eq.json()["id"]
        s.commit()
    j = client.get("/api/campo/resumo-dia", params={"data": DIA}).json()
    im = j["impactadas"]
    assert (im["total"], im["ocorrencias"], im["sem_equipe"]) == (1, 1, 0)
    e = im["itens"][0]
    assert e["nome"] == "EQ CONCRETO 01" and e["ocorrencias"][0]["area"] == "004.05"
    t = j["textos"]["impactadas"]
    assert t.startswith("*EQUIPES IMPACTADAS (1)*") and "• *EQ CONCRETO 01*" in t
    assert f"▸ {causa['descricao']}: Bomba de concreto atrasou 2 h" in t
    assert j["texto"].index("*OCORRÊNCIAS") < j["texto"].index("*EQUIPES IMPACTADAS")


def test_dia_vazio(client):
    j = client.get("/api/campo/resumo-dia", params={"data": "2020-01-01"}).json()
    assert j["programacao"] is None and all(j[k]["total"] == 0 for k in ("atividades", "ocorrencias", "impactadas", "restricoes", "auditorias", "fotos"))
    assert j["texto"] == j["textos"]["cabecalho"]


def test_texto_dominio():
    assert (num(12), num(12.5), num(1234.5), num(None)) == ("12", "12,5", "1.234,5", "")
    r = {"data": "2026-11-07", "obra": "Obra RSA",
         "atividades": {"total": 2, "grupos": [
             {"local": "L1 · Novo CMD", "area": "004.05 · Galpão", "cwps": [{"texto": None, "itens": [
                 {"atividade": "Escavação para embutidos", "realizado": 12, "unidade": "m³", "equipe": "EQ 01"}]}]},
             {"local": None, "area": None, "cwps": [{"texto": None, "itens": [{"atividade": "Organização e limpeza - Geral"}]}]}]},
         "ocorrencias": {"total": 0, "grupos": []}, "restricoes": {"total": 0, "grupos": []},
         "auditorias": {"total": 1, "grupos": [{"local": "L1 · Novo CMD", "area": "004.05 · Galpão", "itens": [
             {"tipo": "Inspeção", "numero": 3, "tipo_registro": "Condição insegura", "nao_conformidade": "Guarda-corpo solto",
              "medida_corretiva": "Fixar", "ver_agir": False, "acao_numero": 7}]}]},
         "equipes": {"itens": [{"nome": "EQ 01", "encarregado": "Damião", "presentes": 8, "total": 9, "funcoes": ["6 Pedreiro"],
                                "atividades": ["1.1.1 Escavação (004.05)"]}], "presentes": 8},
         "fotos": {"total": 0, "grupos": []}}
    t = textos(r)
    assert t["atividades"].splitlines()[:4] == ["*ATIVIDADES EXECUTADAS (2)*", "", "*L1 · Novo CMD*", "_004.05 · Galpão_"]
    assert "• Escavação para embutidos — 12 m³ · EQ 01" in t["atividades"] and "*Sem frente*" in t["atividades"]
    assert "Ver e agir: ação aberta (A-7)" in t["auditorias"]
    assert "• *EQ 01* (Enc. Damião) — 8/9 presentes" in t["equipes"] and "   ▸ 1.1.1 Escavação (004.05)" in t["equipes"]
    tudo = juntar(t, ["atividades", "equipes"])
    assert tudo.startswith("*Check Out 07/11/2026*\nObra RSA\n\n*ATIVIDADES") and "AUDITORIAS" not in tudo
