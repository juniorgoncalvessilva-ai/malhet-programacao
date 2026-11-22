# 134 — Explorador de documentos no jeito dos GEDs (árvore, trilha, lista, prévia)

## Pedido (usuário, 22/11/2026)
"Eu não consigo ver uma estruturação de pasta e navegar por elas como fazemos em outros softwares de controle de documentação"
(referências: e-doc do Questor NovoZen, GED da Scoreplan — os sites não abriram deste ambiente). Esperado: 1) organização e
padronização; 2) agilidade no acesso; 3) segurança e conformidade; 4) rotinas mais eficientes; 5) ler/visualizar o documento de
forma prática.

## O que muda
- **Aba "Explorar pastas"** (padrão de Documentos, `ExploradorDocumentos`), em três colunas como um GED:
  - **Árvore** à esquerda: Todos os documentos · Recentes (15 dias) · as pastas da obra (pasta-modelo 10–60 e as criadas) ·
    Sem pasta; cada pasta abre sozinha em **subpastas** pelos níveis dela, com contagem; "Gerenciar pastas e subpastas".
  - **Trilha** (Início › 20 · Projetos › 1870CC - CMD › 004.12 · Skid…) clicável, **busca** em todas as pastas (código, título,
    disciplina, pacote, local), ordem por código ou recentes e **Enviar aqui** (ou arrastar para a lista): o arquivo entra com o
    tipo da pasta e casa sozinho com a LDO (spec 132); o que não casar avisa e leva a "Enviar e relacionar".
  - **Lista**: subpastas (ícone de pasta, nº de documentos) e documentos (ícone do tipo, código, título, revisão vigente, última
    revisão com a situação, atualizado). Clique = prévia; duplo clique / Enter = ficha com histórico.
  - **Prévia** à direita (gaveta no celular e em telas menores): a folha da revisão que vale (PNG; PDF no leitor embutido) com o
    carimbo CÓPIA CONTROLADA / DOCUMENTO OBSOLETO / NÃO LIBERADA, Tela cheia (zoom), PDF, Baixar com o nome padrão, Ficha e
    histórico, Copiar link (`?doc=`); dados (tipo, disciplina, pacote, frentes confirmadas, vigente com TE e emissão, última,
    revisões, quem enviou). Cada abertura fica registrada como leitura (ISO 9001 7.5, já existente).
- **Subpastas padronizadas** (`documento_pasta.subpastas`, `domain/pastas.py::NIVEIS|subpastas_padrao|validar_subpastas`): níveis
  pacote, frente (CWA, pelas ligações confirmadas — spec 133), disciplina, tipo, ano; até 3, na ordem. Padrão: projetos =
  pacote → frente → disciplina; o resto = pacote → disciplina. Editável no formulário da pasta. Nada é movido: pasta é regra.
- API: `/documentos/pastas` devolve `membros` de cada pasta, `subpastas`, `sem_pasta_ids` e `niveis`; o documento traz `frentes`
  (confirmadas) e `atualizado_em`. Migração `0067_pasta_subpastas`.

## Verificação
`tests/test_explorador_documentos.py`: subpastas padrão/validação; membros = contagem; todo documento numa pasta ou em "sem
pasta"; frentes só confirmadas; editar subpastas, recusar nível inválido, manter quando não informado. E2E (LDO, CWAs e controle
por ativo reais): árvore 20 · Projetos → 3 pacotes → 1870CC - CMD → 004.12 → Arquitetura/Civil/Tubulação; DWG enviado pelo
"Enviar aqui" da pasta casou pelo carimbo; busca "51890" → prévia com a folha, carimbo de cópia controlada e a frente; 390 px
sem rolagem lateral, árvore em gaveta.
