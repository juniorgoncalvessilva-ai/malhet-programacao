# 118 — Todos de Acesso dos líderes entram

## Problema
Em produção, líderes que aparecem em Acesso dos líderes recebiam "matrícula ou senha não conferem (só entram encarregados
e líderes)". Causas:
1. O login comparava a matrícula digitada com a gravada letra a letra; planilhas gravam "0115532", "115.532" ou "115532.0"
   (número do Excel), então a pessoa aparecia na lista e não entrava.
2. Encarregado de equipe cujo crachá não está no efetivo aparece na lista ("fora do efetivo"), mas não tinha como entrar.
3. A mensagem era a mesma para qualquer motivo: ninguém sabia o que corrigir.

## Decisão
- `lideres/domain/portal.py::normalizar_codigo`: tira ".0" do fim, o que não é letra/número, maiúsculas e zeros à esquerda.
  Vale na lista (`gestao.listar`), em `equipes_do_lider` e no login (no banco por `_norm_sql`), e na busca de pessoas do portal.
- Encarregado de equipe ativa que não está no efetivo: com 123456 entra no primeiro acesso e é criado no efetivo como cadastro
  pendente (nome da equipe, matrícula = crachá, função ENCARREGADO, origem simova), para o Planejamento conferir. Sem 123456
  nada é criado; nunca duplica.
- Mensagens: "senha não confere" (com "peça ao Planejamento para redefinir" quando ele já criou a dele, ou "no primeiro acesso
  é 123456"); "<nome>: não está como líder de equipe"; "sua matrícula não é desta obra: entre pelo endereço da sua obra";
  "matrícula N não encontrada entre os líderes". Toda tentativa errada conta para o bloqueio (5 em 15 min por matrícula e
  aparelho), para a tela não virar consulta de matrículas sem limite.

## Testes
`tests/test_portal_lider.py::test_quem_esta_em_acesso_dos_lideres_entra`. E2E: matrícula com zero à esquerda no banco entra;
mensagens de senha errada e de matrícula não encontrada.
