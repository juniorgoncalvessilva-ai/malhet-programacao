# 101 — Resumo do dia (check out) para os setores, com envio pelo WhatsApp

## Pedido
"Página de resumo de envios por dia, com detalhamento dos ocorridos nas frentes/atividades para envio aos setores, de forma
prática para copiar e colar, com opção de enviar por WhatsApp." Hoje o "Check Out dd/mm/aaaa" é uma lista solta de
atividades. Quadrantes, nesta ordem: atividades, ocorrências, restrições, auditorias, equipes (e equipe por atividade) e
fotos — tudo por frente, no padrão de hierarquia da programação; enviar o conjunto pelo WhatsApp.

## Como funciona
- `GET /campo/resumo-dia?data=&qtd=` (`campo/application/resumo_dia.py`), a partir do que já está registrado:
  - **atividades**: linhas da programação do dia (`programacao_do_dia`) com realizado lançado ou foto no dia, na ordem da
    programação, Local → Área → CWP (da WBS), com realizado/previsto, equipe e nº de fotos;
  - **ocorrências**: desvios do dia, na frente da atividade impactada (causa, descrição, ação, responsável, status);
  - **restrições**: abertas no dia (nova), concluídas no dia e as pendentes das frentes/atividades do dia (atrasada se o
    prazo passou);
  - **auditorias**: enviadas no dia (não conformidade, medida, ver e agir / ação aberta A-n);
  - **equipes**: presença do dia (presentes/total, funções presentes) e as atividades executadas de cada equipe;
  - **fotos**: book do dia agrupado por frente e por atividade/ocorrência/auditoria.
- Texto de cada parte no formato do WhatsApp (`campo/domain/resumo_dia.py`: `*Local*`, `_Área_`, `•` itens), cabeçalho
  "*Check Out dd/mm/aaaa*" + obra · contratada; `juntar` monta o conjunto.
- Tela `/app/resumo-dia` (Campo e qualidade) e `/m/resumo` no celular (`components/Resumo/ResumoDia.tsx`):
  dia com ‹ ›; escolher as partes que vão; "com quantidades"; texto editável antes de enviar; **Copiar texto**,
  **Enviar no WhatsApp** (link wa.me) e, no celular, **Compartilhar com N foto(s)** (texto + fotos marcadas pelo
  compartilhamento do aparelho; no computador, Baixar fotos); cada quadrante tem Copiar e WhatsApp só daquela parte.
  Hierarquia nas cores da programação (local vermelho, área azul, linhas alternadas).
- Menus: `TELAS_WEB` (+ padrão de encarregado, segurança e leitor) e `/m/resumo` nas telas do celular.

## Aceite
- `tests/test_resumo_dia.py`: cenário com realizado, foto, ocorrência e restrição; dia vazio; texto (números pt-BR,
  Sem frente, ação aberta, equipes) e `juntar` só com as partes escolhidas.
- e2e: computador (09/11 e 13/11 do banco local) e iPhone 14; copiado = texto da tela; link do WhatsApp decodifica igual.
