"""Spec 064: auditorias por modelo (Segurança padrão), VER E AGIR × plano de ação 5W2H, texto do WhatsApp e ações."""
from tests.test_book_fotos import _jpeg

LISTA = "CWA\tAtivo\tDESCRICAO CWA\tLocal\n004.05\tED-1800AA-01\tGalpão de resíduos classe II\tNovo CMD"


def _foto_leg(client, alvo, alvo_id, legenda):
    r = client.post("/api/fotos", data={"alvo": alvo, "alvo_id": str(alvo_id), "legenda": legenda},
                    files={"arquivo": ("f.jpg", _jpeg(), "image/jpeg")})
    assert r.status_code == 201, r.text


def test_modelo_padrao_de_seguranca(client):
    ms = client.get("/api/auditorias/modelos").json()
    assert len(ms) == 1 and ms[0]["padrao"] and ms[0]["nome"] == "Inspeção de Segurança do Trabalho"
    cfg = ms[0]["config"]
    assert [t["nome"] for t in cfg["tipos"]] == ["Notificação", "Interdição", "Inspeção", "N3"]
    assert [c["tipo"] for c in cfg["campos"]][:3] == ["tipo_auditoria", "frente", "data"]
    # editar: tipo de registro novo, campo livre, e não dá para tirar campo fixo nem duplicar tipo
    cfg["tipos"][2]["registros"].append("Ferramentas manuais")
    cfg["campos"].append({"tipo": "texto", "rotulo": "Equipamento usado na medição", "emoji": "📏", "obrigatorio": False, "ativo": True})
    r = client.put(f"/api/auditorias/modelos/{ms[0]['id']}", json={"config": cfg, "padrao": True})
    assert r.status_code == 200 and "Ferramentas manuais" in r.json()["config"]["tipos"][2]["registros"]
    ruim = {**cfg, "campos": [c for c in cfg["campos"] if c["tipo"] != "rac"]}
    assert client.put(f"/api/auditorias/modelos/{ms[0]['id']}", json={"config": ruim, "padrao": True}).status_code == 422
    dup = {**cfg, "tipos": cfg["tipos"] + [{"nome": "inspeção", "registros": ["x"]}]}
    assert client.put(f"/api/auditorias/modelos/{ms[0]['id']}", json={"config": dup, "padrao": True}).status_code == 422
    assert client.delete(f"/api/auditorias/modelos/{ms[0]['id']}").status_code == 422  # padrão não sai
    novo = client.post("/api/auditorias/modelos", json={"config": {**client.get("/api/auditorias/modelos/base").json(), "nome": "Meio ambiente"}}).json()
    assert not novo["padrao"] and client.delete(f"/api/auditorias/modelos/{novo['id']}").status_code == 204


def test_ver_e_agir_e_plano_de_acao(client):
    client.post("/api/frentes/importar", json={"texto": LISTA})
    area = client.get("/api/frentes").json()[0]["areas"][0]
    base = {"data": "2026-11-12", "tipo": "Inspeção", "tipo_registro": "Condição insegura", "area_id": area["id"],
            "engenheiro": "Thiago Aleixo", "encarregado": "Damião Feliz", "nao_conformidade": "Guarda-corpo solto na escada",
            "medida_corretiva": "Fixar o guarda-corpo", "acompanhamento": "Damião Feliz / Ermelindo"}
    # VER E AGIR = SIM: precisa da foto da não conformidade e do depois
    r = client.post("/api/auditorias/registros", json={**base, "ver_agir": True}).json()
    assert r["status"] == "rascunho" and r["numero"] == 1 and r["local"].startswith("L") and r["area_texto"].startswith(area["codigo"])
    x = client.post(f"/api/auditorias/registros/{r['id']}/finalizar")
    assert x.status_code == 422 and "foto da não conformidade" in x.text and "foto do depois" in x.text
    _foto_leg(client, "auditoria", r["id"], "antes")
    _foto_leg(client, "auditoria", r["id"], "depois")
    x = client.post(f"/api/auditorias/registros/{r['id']}/finalizar").json()
    assert x["status"] == "adequada" and x["acao"] is None
    t = x["texto"]
    assert "*INSPEÇÃO DE SEGURANÇA DO TRABALHO*" in t and "📋 *Inspeção* · Nº 1" in t and "📍 *Local / Frente:*" in t
    assert "👀 *VER E AGIR:* SIM" in t and "📌" not in t and "12/11/2026" in t and '"Sem Segurança, não há obra!"' in t
    assert client.put(f"/api/auditorias/registros/{r['id']}", json={**base, "ver_agir": True}).status_code == 422  # já enviado

    # VER E AGIR = NÃO: plano de ação (responsável + prazo) vira ação 5W2H
    r2 = client.post("/api/auditorias/registros", json={**base, "ver_agir": False, "tipo": "Notificação",
                                                         "tipo_registro": "Falta ou uso incorreto de EPI"}).json()
    _foto_leg(client, "auditoria", r2["id"], "antes")
    x = client.post(f"/api/auditorias/registros/{r2['id']}/finalizar")
    assert x.status_code == 422 and "responsável do plano" in x.text
    client.put(f"/api/auditorias/registros/{r2['id']}", json={**base, "ver_agir": False, "tipo": "Notificação",
                                                              "tipo_registro": "Falta ou uso incorreto de EPI",
                                                              "plano_responsavel": "Damião Feliz", "plano_prazo": "2026-11-14"})
    x = client.post(f"/api/auditorias/registros/{r2['id']}/finalizar").json()
    assert x["status"] == "plano" and x["acao"]["status"] == "aberta"
    assert "📌 *Plano de Ação:*\n• Responsável: Damião Feliz\n• Prazo: 14/11/2026" in x["texto"]
    a = next(y for y in client.get("/api/acoes").json() if y["id"] == x["acao"]["id"])
    assert (a["origem"], a["quem"], a["quando"], a["o_que"], a["area_id"]) == ("auditoria", "Damião Feliz", "2026-11-14", "Fixar o guarda-corpo", area["id"])
    assert a["origem_texto"] == "Notificação Nº 2"

    # a ação só conclui com evidência; a eficácia fecha a auditoria
    ev = client.post(f"/api/acoes/{a['id']}/evento", json={"evento": "concluir", "texto": "EPI entregue e treinado"})
    assert ev.status_code == 422 and "evidência" in ev.text
    _foto_leg(client, "acao", a["id"], "evidencia")
    assert client.post(f"/api/acoes/{a['id']}/evento", json={"evento": "concluir", "texto": "EPI entregue e treinado"}).json()["status"] == "verificacao"
    assert client.post(f"/api/acoes/{a['id']}/evento", json={"evento": "verificar"}).status_code == 422
    assert client.post(f"/api/acoes/{a['id']}/evento", json={"evento": "verificar", "eficaz": True}).json()["status"] == "concluida"
    regs = {y["id"]: y for y in client.get("/api/auditorias/registros").json()}
    assert regs[r2["id"]]["status"] == "concluida" and regs[r["id"]]["status"] == "adequada"
    assert len(regs[r["id"]]["fotos"]) == 2 and {f["momento"] for f in regs[r["id"]]["fotos"]} == {"antes", "depois"}


def test_acoes_manuais_e_de_ocorrencia(client):
    from tests.test_excluir_revisao import _programacao

    pid = _programacao(client)
    client.post(f"/api/programacoes/{pid}/emitir")
    causa = client.get("/api/desvios/causas").json()[0]
    d = client.post("/api/desvios", json={"data": "2026-11-10", "causa_id": causa["id"], "descricao": "Faltou concreto",
                                          "acao": "Reprogramar a usina", "responsavel": "Suprimentos"}).json()
    cand = client.get("/api/acoes/candidatas").json()
    assert any(x["origem"] == "ocorrencia" and x["id"] == d["id"] for x in cand)
    a = client.post("/api/acoes/de-origem", json={"origem": "ocorrencia", "origem_id": d["id"]}).json()
    assert (a["o_que"], a["quem"], a["quando"], a["origem"]) == ("Reprogramar a usina", "Suprimentos", "2026-11-17", "ocorrencia")
    assert client.post("/api/acoes/de-origem", json={"origem": "ocorrencia", "origem_id": d["id"]}).status_code == 422
    assert not any(x["origem"] == "ocorrencia" and x["id"] == d["id"] for x in client.get("/api/acoes/candidatas").json())
    assert client.post("/api/acoes", json={"o_que": "x"}).status_code == 422  # 5W2H mínimo: o quê, quem, quando
    m = client.post("/api/acoes", json={"o_que": "Limpar a área de vivência", "quem": "Encarregado", "quando": "2026-11-20",
                                        "data_execucao": "2026-11-18"}).json()
    assert m["numero"] == 2 and m["preenchidos"] == 3
    m = client.put(f"/api/acoes/{m['id']}", json={"o_que": "Limpar a área de vivência", "quem": "Encarregado", "quando": "2026-11-21",
                                                   "como": "Mutirão às 7 h", "data_execucao": "2026-11-18"}).json()
    assert m["historico"][0]["texto"].startswith("Prazo de 20/11/2026 para 21/11/2026")
    sem = [x["id"] for x in client.get("/api/acoes", params={"de": "2026-11-18", "ate": "2026-11-18"}).json()]
    assert sem == [m["id"]]  # programação das ações: pelo dia de execução
    assert client.post(f"/api/acoes/{m['id']}/evento", json={"evento": "cancelar"}).status_code == 422  # motivo
    assert client.post(f"/api/acoes/{m['id']}/evento", json={"evento": "cancelar", "texto": "duplicada"}).json()["status"] == "cancelada"


def test_auditoria_feita_sem_internet_envia_de_uma_vez(client):
    """Spec 072: o celular guarda registro + fotos e envia tudo junto; reenviar a fila não duplica; erro não grava metade."""
    import json

    client.post("/api/frentes/importar", json={"texto": LISTA})
    area = client.get("/api/frentes").json()[0]["areas"][0]
    dados = {"id_local": "cel1-aud-000001", "registrado_em": "2026-11-12T09:10:00-03:00", "data": "2026-11-12",
             "tipo": "Inspeção", "tipo_registro": "Condição insegura", "area_id": area["id"], "nao_conformidade": "Extintor vencido",
             "medida_corretiva": "Trocar o extintor", "ver_agir": False, "engenheiro": "Thiago Aleixo",
             "encarregado": "Damião Feliz", "acompanhamento": "Ermelindo", "plano_responsavel": "Damião Feliz", "plano_prazo": "2026-11-14"}
    envio = lambda d, momentos, n: client.post("/api/auditorias/registros/completo",
                                                data={"dados": json.dumps(d), "momentos": json.dumps(momentos)},
                                                files=[("fotos", (f"f{i}.jpg", _jpeg(), "image/jpeg")) for i in range(n)])
    # sem a foto do antes o modelo não aceita — e nada fica gravado pela metade
    r = envio(dados, [], 0)
    assert r.status_code == 422 and "foto" in r.text.lower()
    assert client.get("/api/auditorias/registros").json() == []
    assert envio(dados, ["antes"], 2).status_code == 422  # cada foto diz se é antes ou depois
    assert envio({**dados, "id_local": "x"}, ["antes"], 1).status_code == 422

    r = envio(dados, ["antes"], 1)
    assert r.status_code == 201, r.text
    a = r.json()
    assert a["status"] == "plano" and a["acao"] and a["repetido"] is False and a["fotos"] == [{"id": a["fotos"][0]["id"], "momento": "antes"}]
    assert f"Nº {a['numero']}" in a["texto"]
    # a fila subiu de novo (a resposta se perdeu no caminho): devolve o mesmo, sem duplicar registro, foto ou ação
    b = envio(dados, ["antes"], 1).json()
    assert b["repetido"] is True and b["id"] == a["id"] and b["numero"] == a["numero"]
    assert len(client.get("/api/auditorias/registros").json()) == 1 and len(client.get("/api/acoes").json()) == 1

    sim = {**dados, "id_local": "cel1-aud-000002", "ver_agir": True, "plano_responsavel": None, "plano_prazo": None}
    assert envio(sim, ["antes"], 1).status_code == 422  # SIM sem a foto do depois
    c = envio(sim, ["antes", "depois"], 2).json()
    assert c["status"] == "adequada" and sorted(x["momento"] for x in c["fotos"]) == ["antes", "depois"]
