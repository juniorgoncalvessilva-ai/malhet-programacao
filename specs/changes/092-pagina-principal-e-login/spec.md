# Spec 092 — Página principal e tela de login com a história da marca

## Pedido
"Vamos trabalhar na página principal e melhorar a tela de login, está com muita cara de IA. Veja a história criada para
a marca. Se inspire em designs disruptivos (Clarix, Auralis). Conte da melhor forma a história, mantenha nossa identidade."

## Fonte
Documento "Malhet — a história da marca" (origem, nome/malhete, manifesto, posicionamento, pilares, públicos, voz e tom,
assinaturas). Regras de voz respeitadas: direta, do canteiro, sem número não confirmado, IA nunca como manchete, a origem
do nome contada uma vez com leveza e sem termos de rito.

## O que muda
- `/` deixa de redirecionar para o app e passa a ser a **página principal pública** (`components/Marca/Landing.tsx`),
  em seis atos numerados `( 01 ) … [ 006 ]`:
  1. **A obra** — "Toda obra é feita / de decisões."; a pedra bruta (pontos soltos) vira pedra cúbica conforme rola
     (seção fixa, "Entra bruto → Sai lapidado").
  2. **A cena** — o registro de uma segunda-feira (guindaste) em fonte de RDO até "O pleito se perde".
  3. **O espaço** — cronograma × ERP × planilhas/WhatsApp × Malhet; os quatro pilares com as frases de campanha; um
     cérebro com vários apps; os quatro compromissos (inclui o modo sem IA).
  4. **O nome** — o malhete abre os trabalhos, concede a palavra e bate para selar; ocorrência de exemplo com
     "Bater o malhete" que carimba **VALIDADO · data · hora**.
  5. **Para quem** — os seis públicos, a dor e a frase de cada um.
  6. **Manifesto** — em fundo escuro, fechando em "O que foi decidido, fica."
- **Login** (`TelaAuth`, vale para entrar/cadastro/verificar): lado da marca escuro com a pedra se formando, a assinatura
  e um registro de obra passando (07:00 → 07:40 validado); lado do formulário limpo, título grande e leve. No app das
  lojas não há link para o site.
- Visual: só as cores da marca (#284E4F, #6FB3B1, #070911, #F6F8F8, fundo escuro #0D1A1B), Figtree em contraste
  300/800, marcadores e registros em fonte monoespaçada, linhas finas; sem gradientes, vidro ou grade de ícones.
- `components/Marca/PedraCubica.tsx`: canvas 2D sem biblioteca (cubo isométrico de pontos; `progresso` pela rolagem ou
  montagem automática; respeita "reduzir movimento"; reage de leve ao cursor).

## Verificação
tsc + build; navegador em 1440 px e iPhone 14 (sem rolagem lateral, carimbo, links), sem erros no console.
