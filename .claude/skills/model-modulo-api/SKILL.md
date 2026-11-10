---
name: model-modulo-api
description: Criar ou evoluir um módulo da API Python (domain/application/infra/api) seguindo a arquitetura do projeto — entidade imutável com validação, casos de uso com portas, repositório SQLAlchemy, router FastAPI fino e testes. Use ao adicionar agregado, caso de uso, endpoint ou regra de negócio em apps/api.
---
# Novo módulo / agregado na API

Referência viva: `app/modules/programacao/` (copie o padrão, não invente outro).

1. **domain/** — `@dataclass(frozen=True)`; validação em `__post_init__` levantando `DomainError(msg, campo)`;
   comportamento devolve clone com `dataclasses.replace`. Enums `StrEnum`. Portas em `domain/ports.py` (`Protocol`).
   Proibido importar SQLAlchemy/FastAPI aqui. Ordem para pôr uma regra: objeto de valor → entidade → serviço de domínio.
2. **application/** — um caso de uso por classe (`executar(dados, usuario)`), DTO de entrada `@dataclass(frozen=True)`.
   Recebe repositório/gateway pelo construtor. Lança `NotFoundError` quando falta algo.
3. **infra/** — `models.py` (SQLAlchemy 2, `Mapped`), `repository.py` com `_to_domain`; leitura de outro módulo só por
   gateway que devolve a linguagem publicada (dataclass), nunca o model do outro módulo para fora da infra.
4. **api/router.py** — Pydantic in/out, `Depends(get_session)` e `Depends(usuario_atual)`; consultas simples direto
   (CQRS leve); comandos chamam o caso de uso. Registre em `app/main.py` e importe os models em `app/models.py`.
5. **Migração** — siga a skill `db-migracao`.
6. **Testes** — domínio puro em `tests/test_dominio_*.py`; fluxo HTTP em `tests/test_api_*.py` (fixture `client`
   recria o schema). Rode `.venv/bin/pytest -q`.
7. **Front** — tipos em `apps/web/src/lib/api/types.ts`, hooks em `src/hooks/programacao/queries.ts`.
