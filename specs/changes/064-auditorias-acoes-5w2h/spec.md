# 064 — Auditorias por modelo (Segurança padrão) e plano de ação 5W2H

## Pedido
Controle de inspeção e plano de ações 5W2H (modelo VisualPlan): auditorias, ocorrências e pendências geram ações para a
reunião de ações das frentes e, depois, a programação das ações de execução. Lugar para criar os modelos (templates) de
auditoria; o primeiro e padrão é o de Segurança. Enviar o registro pelo WhatsApp no formato da obra.

## Modelo de Segurança (padrão, editável em `/app/auditorias/modelos`)
📋 Tipo de auditoria (Notificação, Interdição, Inspeção, N3) · 📍 Local / Frente (lista das Frentes) · 📅 Data ·
👷 Eng.º Responsável (responsável da equipe) · 👷 Encarregado Responsável (equipes) · RAC (cadastro de SSMA) ·
🔎 Tipo de Registro (lista do tipo escolhido) · ⚠️ Não conformidades · 🛠️ Medida Corretiva · 👀 VER E AGIR ·
📌 Plano de Ação (responsável = encarregado, prazo) · 👷 Responsável pelo acompanhamento (líder do encarregado + quem
auditou). Cabeçalho "INSPEÇÃO DE SEGURANÇA DO TRABALHO" e rodapé "Sem Segurança, não há obra!".
O modelo define tipos e tipos de registro, rótulos, emojis, obrigatoriedade, ordem e campos livres. Tipo, frente, data,
não conformidade e VER E AGIR são sempre obrigatórios.

## Regras
- Foto da não conformidade (antes) sempre obrigatória; **VER E AGIR = SIM** → foto do depois (adequação) obrigatória,
  registro "adequada na hora"; **NÃO** → plano de ação (responsável + prazo) obrigatório e vira **ação 5W2H**; a auditoria
  conclui quando a ação é concluída e verificada como eficaz.
- Fotos com carimbo (data/hora, ANTES/DEPOIS, frente, nº, obra).
- Ação 5W2H: O quê, Quem e Quando obrigatórios; dia de execução (programação das ações); concluir exige evidência (foto) e
  o que foi feito; quem acompanha verifica a eficácia (não eficaz = reaberta); cancelar exige motivo; histórico.
- Ocorrências (desvios abertos) e restrições pendentes sem ação aparecem em "Gerar de ocorrências e restrições" e viram
  ação já preenchida (`POST /acoes/de-origem`).

## Implementação
- API: `acoes/` (`acao_5w2h`; `/acoes`, `/acoes/{id}/evento`, `/acoes/candidatas`, `/acoes/de-origem`) e `auditorias/`
  (`auditoria_modelo`, `auditoria_registro`; `/auditorias/modelos`, `/opcoes`, `/registros`, `/registros/{id}/finalizar`,
  `/registros/{id}/texto`); fotos `alvo` `auditoria` (legenda antes/depois) e `acao`. Migração 0035.
- Web: `/app/auditorias` (registros, nova, detalhe, reenviar), `/app/auditorias/modelos` (editor), `/app/acoes`
  (Quadro | Reunião por frente com pauta impressa | Programação das ações por semana | Gerar de ocorrências e restrições).
- Celular: `/m/auditorias` e `/m/auditorias/nova` (formulário do modelo, envio pelo WhatsApp com as fotos pelo
  compartilhamento do celular; sem ele, abre o WhatsApp com o texto), `/m/acoes` (concluir com foto, verificar).
- Testes: `tests/test_auditorias.py`.
