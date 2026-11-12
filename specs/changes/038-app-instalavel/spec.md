# 038 — Interface só pelo aparelho e app instalável no celular

- Sem item "App de campo" no menu e sem botão "Completo" no celular: a interface é escolhida só pelo aparelho
  (`lib/dispositivo/interface.tsx`; escolhas antigas guardadas são apagadas). Barra do campo: Início · Lançar ·
  Ocorrências · Restrições · Pendências.
- PWA: `public/manifest.webmanifest` (início em `/pt-BR/m`, tela cheia, cor #284E4F), ícones gerados do "M" Malhet
  (`/brand/icone-192|512|maskable-512.png`, `apple-touch-icon.png`), `public/sw.js` mínimo (sem cache: cada deploy
  chega na hora) e metadados (`manifest`, `appleWebApp`, `themeColor`).
- `components/Mobile/OfertaInstalar.tsx`: no app de campo, se o app não está instalado, oferece instalar — Android
  pelo botão "Instalar" (`beforeinstallprompt`), iPhone com o caminho no Safari; "Agora não" esconde por 7 dias.
