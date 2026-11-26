# Spec 150 — Leitura de presença no celular do apontador

## Pedido
"Traga junto com a visão por equipe nossos modelos de presenças com leitura facial, leitura de crachá, lista enfim todos os
tipos de leitura e mantenha o modo por equipe como está agora."

## O que muda
- Tela **Presença** da rota do apontador ganha a chave **Por equipe | Ler presença**.
  - *Por equipe*: exatamente como na spec 147/149 (dias da semana, equipes recolhíveis, marcar/tirar à mão).
  - *Ler presença*: o mesmo painel do `/m/presenca` (spec 063/065/067/069/103/106): Crachá (NFC), Código (matrícula,
    leitor Bluetooth/USB, QR pela câmera), Rosto e Lista, com a fila offline do aparelho, cadastro rápido de crachá
    desconhecido e de rosto (consentimento LGPD). Sempre o dia de hoje; ao voltar para *Por equipe* a tela recarrega.
- O painel saiu de `app/[locale]/m/presenca/page.tsx` para `components/Presenca/PainelLeitura.tsx` (`pr`, `topo`); o `/m` não muda.
- `usePresenca()` = `usePresencaCom(transporte)` com a conta do Malhet; o apontador usa `usePresencaCom` com o token do portal
  (`/presenca/*` → `/portal/apontador/presenca/*`).

## API
- `GET /portal/apontador/presenca/base`, `POST …/leituras`, `GET …/hoje`, `POST …/vincular`, `POST …/pessoa-simplificada`:
  chamam os mesmos casos de uso de `presenca/api/router.py` com `apontador.contexto_presenca` (obra do token, autor
  "apontador MATRÍCULA · NOME", papel de quem lê crachás). Token de encarregado não abre.
- `presenca/application/manual.py::desmarcar`: só sai a marcação **manual** do apontador; crachá/código/rosto lidos — inclusive
  no celular dele — são prova e ficam. Na tela, `lida` = meio diferente de `manual`.

## Testes
- `tests/test_apontador.py::test_leitura_de_presenca_no_celular_do_apontador`.
- e2e iPhone 13: Presença → Ler presença → Código (matrícula) → Lista (Presente) → Por equipe mostra os 2 presentes.
