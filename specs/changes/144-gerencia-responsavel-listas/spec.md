# Spec 144 — Responsabilidade e Gerência em lista nos formulários que faltavam

## Problema
A spec 139 criou Partes e responsáveis e trocou os campos de texto por listas nos desvios da programação, nas restrições 6WLA e nas
restrições do plano. Ficaram de fora o formulário **Ocorrências** (`/app/desvios`: "Responsabilidade" e "Gerência (contratada/cliente)"
ainda digitados) e o **"Quem resolve"** da nova restrição no celular (`/m/restricoes/nova`, que nem mandava a gerência).

## Regra
- `/app/desvios` usa `GerenciaResponsavel`: Gerência = uma das partes ("CONTRATADA - CARDAN"), Responsável = lista da parte; escolher
  o responsável preenche a gerência; valor antigo digitado aparece como "(antigo)".
- Celular: `SelecaoM` (lista suspensa de 48 px em `components/Mobile/ui.tsx`); "Quem resolve" agrupado por gerência e a gerência vai
  junto no `POST /restricoes`. Sem responsáveis cadastrados na obra, o campo continua de texto (a restrição não fica travada).
- Nada muda na API: `GET /partes` já é leitura para todos os papéis.
