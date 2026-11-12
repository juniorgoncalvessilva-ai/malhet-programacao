# 033 — Telas sem descrições, acessos unificados com páginas por pessoa, programação vigente e técnicos do SSMA

- **Espaço**: o `Cabecalho` não tem mais descrição (removida das 24 telas) e os subtítulos fixos dos painéis saíram
  (ficam só os que mostram dados: período, contagens).
- **Acessos e usuários** (`/app/acessos`, papel admin): acessos da obra + (Super Admin) obras e contas na mesma tela
  (`components/Obra/AdminObras.tsx`; `/app/admin/obras` continua para criar a primeira obra).
- **Páginas por pessoa**: `acesso_obra.paginas` (urls do menu; vazio = todas as do papel),
  `PUT /obras/{id}/acessos/{acesso}/paginas`, `MinhaObra.paginas`. `useObra().podeVer(url)` filtra o menu e o layout da
  obra manda página não liberada para a Programação vigente. A vigente fica sempre aberta; o admin nunca perde Acessos.
  O controle é de navegação: as permissões de escrita continuam pelo papel no backend.
- **Programação vigente** (`/app/vigente`, `GET /programacoes/vigente`): a semanal emitida/concluída que cobre hoje
  (senão a semanal emitida mais recente; senão a mensal), na tela de impressão
  (`components/Obra/ImpressaoProgramacao.tsx` em modo `vigente`: sem "Voltar para montar", sem rascunho, botão "Excel").
- **Técnicos do SSMA**: `POST /ssma/tecnicos/importar {colaboradores | equipe_id}` — pessoas do efetivo (busca já filtra
  "segur") ou a equipe de segurança inteira (encarregado + membros) entram na lista de técnicos; quem já está fica.
