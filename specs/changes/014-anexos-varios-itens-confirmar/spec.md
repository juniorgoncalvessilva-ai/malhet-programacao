# 014 · Arquivos nos documentos de SSMA/PTO, vários itens por atividade e confirmação padrão

## 1. Arquivos dos documentos (opcional)
- RAC, PTS, ART, PTO (e ATA) aceitam arquivos Excel (.xlsx, .xlsm, .xls), Word (.docx, .doc) e PDF, vários por item.
  Técnico não recebe arquivo.
- `anexo_ssma` (obra, item do cadastro, nome, tipo, tamanho, conteúdo no banco — entra no backup do Postgres).
  Limite 20 MB; confere a assinatura do arquivo (não basta a extensão).
- `POST /api/ssma/cadastros/{id}/anexos`, `GET /api/ssma/anexos/{id}` (download, qualquer papel da obra),
  `DELETE /api/ssma/anexos/{id}`. Mesmas permissões do cadastro (PTO só planejamento).
- Telas: coluna "Arquivos" nos cadastros (anexar mais de um, baixar, excluir); clipe no item escolhido na programação
  baixa o arquivo.

## 2. Vários itens por atividade
- `programacao_linha.ssma_rac|pts|art|ata|pto` viram listas (JSONB); migração transforma o valor atual em lista de um.
- Técnico de segurança continua um só. N/A vale sozinho (escolher outro item tira o N/A); sem repetição.
- API aceita lista ou texto (compatível); renomear no cadastro troca dentro das listas; "em uso" conta as listas.
- Excel do cliente: itens separados por " / " na coluna correspondente. Telas: chips + "adicionar" (SSMA e PTO).

## 3. Confirmação padronizada
- `ConfirmarProvider` + `useConfirmar()` (`components/Obra/Confirmar.tsx`): diálogo do design system no lugar do
  `window.confirm` do navegador, em todas as exclusões/remoções: equipes, frentes (local e área), catálogo (grupo e
  desvincular), cadastros de SSMA e arquivos, linha da programação, acessos da obra, vínculos e itens antigos.
- Ação destrutiva em vermelho, "Cancelar" com foco, Esc e clique fora fecham, "Aguarde…" enquanto executa.

## Evidência (11/11/2026)
- `pytest -q`: 43 passed (anexos: PDF/xlsx válidos, PDF falso e PNG recusados, técnico sem anexo, download com nome
  UTF-8; listas: duas ARTs, N/A sai, sem repetição, PTO múltiplo só pelo planejamento; Excel " / ").
- Navegador: anexar e baixar PDF na ART; diálogo de confirmação ao excluir arquivo e equipe (Cancelar e Esc fecham,
  nenhum diálogo nativo); SSMA com chips e clipe; salvar SSMA.
