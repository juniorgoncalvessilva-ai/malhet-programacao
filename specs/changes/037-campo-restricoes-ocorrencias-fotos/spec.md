# 037 — Campo (mobile) parte 2: restrições, ocorrências e foto da frente

## Fotos (`campo/`): `foto_campo` (obra, alvo desvio|restricao|linha, alvo_id, data, legenda, bytes no banco)
- `POST /fotos` (multipart, papel encarregado+): JPEG/PNG/WebP de verdade (assinatura), até 8 MB; o celular reduz antes
  (lado maior 1600 px, JPEG 0,8). `GET /fotos?alvo&alvo_id`, `GET /fotos/{id}/arquivo`, `DELETE /fotos/{id}` (quem
  enviou ou o planejamento). Listas de desvios, restrições e o dia de campo trazem `fotos` (ids).
- Lançar: "Foto da frente" vai para o desvio criado; sem desvio, para a linha naquele dia.

## Telas (`/m`)
- **Ocorrências**: últimos 7 dias por dia (causa, o que aconteceu, frente, status, fotos) e **Registrar ocorrência**
  (dia, atividade do dia opcional, causa do Pareto, o que aconteceu, ação, fotos) → `POST /desvios` + fotos.
- **Restrições**: pendentes com filtro (Atrasado, Reprogramado, No Prazo), atrasadas primeiro; **detalhe** com farol,
  dados, fotos, 6M em chips, anotar (observação datada), foto, reprogramar e concluir; **nova restrição** (ação,
  impeditiva, área por busca, quem resolve, até quando, 6M, foto).
- Barra inferior: Início · Lançar · Ocorrências · Restrições · Completo (Pendências pelo Início).
