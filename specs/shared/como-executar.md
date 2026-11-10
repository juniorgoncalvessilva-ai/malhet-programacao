# Como executar uma spec
1. Sessão nova. `Executar specs/changes/<NNN>/spec.md e registrar as evidências`.
2. Antes de codar: leia CLAUDE.md, `docs/dominio.md` e as skills citadas na spec. Peça crítica da spec se algo estiver ambíguo.
3. Cada tarefa `- [ ]` vira `- [x]` com evidência logo abaixo: `> AAAA-MM-DD HH:MM — o que foi feito · decisão · desvio`.
4. Nunca apague tarefa; se não deu, registre o motivo.
5. Feche com `pytest -q` e `npx tsc --noEmit` verdes; mova a pasta para `specs/archive/AAAA-MM-DD-NNN-nome/`.
