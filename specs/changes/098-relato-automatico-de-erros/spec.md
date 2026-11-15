# 098 — Relato automático de erros

## Pedido
"Uma forma de receber erros que o usuário tiver e não conseguir nos passar: quando a aplicação tentar fazer algo que
não conseguir, ela aciona outra função que envia o erro e de qual local partiu."

## Como funciona
- **No aparelho** (`lib/erros/relatar.ts`, `components/Erros/Relatos.tsx` › `CapturaErros` na raiz do app):
  - chamada à API com 5xx (`lib/api/client.ts`), tela que quebrou (`error.tsx` de `/app` e `/m`, `global-error.tsx`),
    erro de script e promessa sem tratamento → `relatarErro` com tela (`location.pathname`), ação ("POST /programacoes/5/emitir"),
    status, pilha, versão do build e origem (computador, celular, app das lojas);
  - fila no localStorage (sem internet guarda e manda depois, `id_local` idempotente); repetido em 30 s vira um; ruído do
    navegador (extensões, ResizeObserver, abort) é ignorado;
  - falha que a pessoa percebe mostra o aviso "A equipe Malhet já recebeu o aviso. Código E-XXXXXX" com
    **Contar o que eu estava fazendo** (`POST /erros/comentario`); erro solto de script vai calado;
  - **Relatar um problema** no menu da conta e em Mais (celular): relato escrito pela pessoa, com a tela.
- **No servidor** (`erros/`): exceção não tratada vira relato sozinha (handler de `Exception` em `main.py`) e a resposta
  500 traz `erro_id` (código) e `erro_ref` (para o comentário); a tela não duplica o relato.
- **Privacidade** (`erros/domain/relato.py::limpar`): e-mail, CPF, telefone, token e números de 5+ dígitos (matrícula,
  crachá) são mascarados; endereço sem `?…`; números no caminho viram `{id}`; nada do que é digitado em formulários vai.
  A conta (e-mail) é guardada para a equipe poder responder. Política de privacidade e Data safety atualizadas.
- **Freio**: até 40 relatos por conta/IP por minuto e 1.500 por hora no total; até 20 por envio.
- **Tabelas**: `erro_relato` (sistema, `obra_id` opcional — o erro pode ser no login) e `erro_grupo` (resolvido por quem).
  `/api/erros` não conta como mudança da obra (tempo real).
- **Tela do super admin** `/app/admin/erros` (menu da conta › Erros relatados, com contador): grupos de erros iguais
  (`assinatura`: tipo + mensagem sem números + ação/tela + função da pilha), vezes, pessoas, último, filtros por
  situação/origem/busca; detalhe com cada ocorrência, obra, conta, versão, aparelho, pilha e o que a pessoa contou;
  Marcar resolvido (com nota) / Reabrir; erro igual depois de resolvido = "Voltou".

## Aceite
- `tests/test_erros.py`: limpeza, agrupamento, idempotência, comentário, resolver/voltou, limite, 500 da API, só super admin lê.
- e2e: 500 simulado mostra o aviso com código e aceita o comentário; erro de script entra calado; relato manual; tela do
  super admin lista, detalha e resolve.
