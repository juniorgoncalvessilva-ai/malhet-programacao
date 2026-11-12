"""Classificação dos desvios — a lista do Pareto semanal de desvios da obra (aba Detalhamento / Dados).

Cada obra tem a sua lista (cadastro `causa_desvio`), que nasce com estas causas e pode ser editada.
"""
CAUSAS_PADRAO: tuple[str, ...] = (
    "Falta de material",
    "Falta de efetivo (Mobilização / absenteísmo)",
    "Erro de execução/Retrabalho",
    "Indefinição/Modificação de Projeto",
    "Manutenção/Falha (Equipamentos, Ferramentas)",
    "Inteferências Procedimentos do cliente",
    "Interferência com Operação/Terceiros",
    "Falha de logística (Entrega, transporte)",
    "Baixa produtividade",
    "Falha em programações",
    "Documentações / Planos",
    "Falta (Equipamentos, Ferramentas)",
    "Alocação de recursos",
    "Atraso na atividade predecessora",
    "Condições Meteorológicas (Chuva, Raio)",
    "Alteração Metodologia Executiva/Despriorização",
    "Saúde, Segurança e 5s",
    "Meio Ambiente",
    "Gerencial de Armazém",
    "Infração de Segurança",
    "Atraso na liberação da área",
    "Eventos adversos",
    "Interrupção por falhas na segurança",
    "Priorização de outras atividades",
    "Manutenção de bota fora / espera",
    "Interferências entre equipes",
    "Interferência / Modificação do cliente",
    "Equipe remanejada para atividades extras por solicitação do cliente",
    "Liberações de Qualidade",
    "Interferências com estruturas existentes",
)

# Status do tratamento do desvio (coluna Status do Pareto: 1, 2, 3)
STATUS = {1: "Pendente", 2: "Em andamento", 3: "Concluído"}


def normalizar(texto: str | None) -> str:
    import unicodedata

    t = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode().casefold()
    return " ".join(t.replace("inteferenc", "interferenc").split())
