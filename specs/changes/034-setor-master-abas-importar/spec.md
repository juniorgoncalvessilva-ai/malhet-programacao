# 034 — Setor master (responsável geral) junto dos setores e abas de importar

- **Setor master**: o responsável geral da obra (e as cores dos níveis do organograma) deixa de ser um painel próprio e
  vira o primeiro cartão da grade de Setores, marcado "Setor master". Não tem excluir: o lápis abre a troca do dono e
  das cores; salvar sem responsável é recusado quando já havia um (o master não fica sem dono). Mesmo endpoint
  `PUT /efetivo/organograma/config`.
- **Abas** (`components/Obra/Abas.tsx`, o mesmo visual de Restrições):
  - Equipes: Equipes | Importar (Equipe.xlsx do Simova).
  - Efetivo: Efetivo | Importar e histórico (planilha do DP + "O que mudou no efetivo").
  - Desvios (Pareto): Ocorrências | Classificações | Importar.
