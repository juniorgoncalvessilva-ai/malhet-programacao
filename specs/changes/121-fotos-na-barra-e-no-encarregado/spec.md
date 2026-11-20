# 121 — Fotos da atividade na barra do encarregado e no /encarregado

## App de campo
- Tela `/m/fotos` ("Fotos da atividade", curto "Fotos", ícone câmera) = o registro de fotos da spec 119 (`/m/lancar/registrar`
  continua abrindo a mesma tela). Vale para atividade da programação ou fora dela.
- Barra padrão do encarregado: Início · Lançar · **Fotos** · Ocorrências, com Presença no meio (Programação vai para Mais).
- Menus de encarregado já salvos por obra (Menu do celular) também recebem Fotos: migração `0057_fotos_na_barra` com
  `perfil/domain/menu.py::incluir_na_barra` — entra depois de Lançar; passando de 4, sai o último atalho (vai para Mais).
  O ajuste pessoal de cada um não é mexido; o admin pode mudar de novo em Menu do celular.

## Endereço do encarregado (`/encarregado`, sem conta do Malhet)
- Depois de entrar: abas **Minha equipe | Fotos da atividade**.
- Fotos da atividade: frente (busca) → item da WBS da frente (CWP, grupo; filtro) ou item da PQ → o que foi feito → fotos
  carimbadas (data/hora, ATIVIDADE, frente, item, texto, obra e a logo da empresa) → Registrar. Lista "Registradas hoje" com
  miniatura, foto grande e **Baixar** (nome AAAAMMDD-HHMM-frente-tipo-id; no celular abre o compartilhar).
- Rotas com `X-Portal-Token`: `GET /portal/frentes`, `GET /portal/registros/opcoes`, `GET /portal/pq`, `GET|POST /portal/registros`,
  `POST /portal/registros/{id}/fotos`, `GET /portal/fotos/{id}` (`mini`, `baixar`). O registro sai assinado como
  "líder <matrícula> · <nome>"; o líder vê, envia foto e abre só os registros dele. As fotos entram no book como as do app.
- Caso de uso único em `campo/application/registros.py` (app e portal).

## Testes
`tests/test_registro_atividade.py::test_fotos_de_atividade_pelo_endereco_do_encarregado`,
`tests/test_perfil_menu.py::test_fotos_entra_na_barra_salva_do_encarregado`. E2E: barra simulando encarregado com Fotos;
`/encarregado` com a marca de teste registrando pela WBS e baixando a foto carimbada com a logo.
