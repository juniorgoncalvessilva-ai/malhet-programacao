---
name: spec-executar
description: Executar uma spec de specs/changes registrando evidências por tarefa e arquivando ao final. Use quando o pedido for "executar spec NNN" ou implementar uma feature planejada.
disable-model-invocation: true
---
Siga `specs/shared/como-executar.md`. Para cada tarefa use a skill indicada (`model-modulo-api`, `db-migracao`,
`integracao-simova`). Testes por sub-agente separado quando a spec for grande. Ao fim: pytest + tsc + build verdes,
mover para `specs/archive/<data>-<NNN>-<nome>/`.
