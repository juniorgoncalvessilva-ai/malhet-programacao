# Spec 089 — Funções de contratação, vagas e treinamento previsto em contrato

## Pedido
1. No De-para de funções, criar uma nova função de contratação (padronização); o de-para pode ser feito depois; essas
   funções alimentam os formulários que pedem função (ex.: nova aquisição na mobilização).
2. Requisição/vaga: uma janela de contratação em que o Planejamento abre a vaga e alimenta a mobilização; o RH vê a função
   necessária e inicia o ciclo de contratação.
3. Mobilização contabiliza o tempo de treinamento; aba de Configurações onde o planejador/gestor de contratos informa o que
   o contrato prevê para treinamentos.

## 1. Função de contratação
- `depara_funcao.criada_na_obra`: a função existe mesmo sem recurso da CPU; "limpar" o de-para não a apaga; `definido` =
  tem recurso ou está ignorada (o resumo do efetivo conta "sem de-para" assim).
- `POST /efetivo/funcoes/nova` (nome em maiúsculas, chave sem acento; repetida → 422), `DELETE /efetivo/funcoes/{chave}`
  (só criada na obra e sem pessoas/vagas/processos), `GET /efetivo/funcoes/lista` (de-para + funções do efetivo).
- `funcao_padronizada`: vaga e nova aquisição só aceitam função da lista (422 "crie em De-para de funções").
- Front: `SeletorFuncao` (lista da obra + "+ Nova função de contratação…" para o planejamento) na vaga, na nova aquisição
  e na ficha do colaborador; botão "Nova função de contratação" e selo "criada na obra" no De-para.

## 2. Vagas
- `mobilizacao_vaga` (código RQ-0001 sequencial por obra, função, quantidade, empresa, obra precisa em, destino,
  solicitante, justificativa, aberta por/em, cancelada em + motivo). `mobilizacao_processo.vaga_id` e `funcao_chave`.
- Domínio `domain/vaga.py`: ocupação (mobilizados, em processo, desistências, saldo = quantidade − mobilizados − em
  processo), situação derivada (Aberta → Em atendimento → Preenchida; Cancelada), nova aquisição só com saldo e vaga ativa;
  quantidade não fica abaixo do já ocupado; função só muda antes de iniciar processos. Resumo com memória: vagas abertas,
  posições sem processo, data da obra vencida, tempo médio para preencher (abertura → crachá do último que completou).
- Abrir vaga notifica a gestão (sino). Processo pela vaga herda função, código (requisição), data da obra, empresa, e a
  Solicitação conta desde a abertura da vaga.
- API `/mobilizacao/vagas` (GET, POST, PUT, `/cancelar`, `/reabrir`, DELETE só sem processos).
- Tela: aba Vagas (cartões com barra mobilizados/em processo, "Iniciar contratação" abre a nova aquisição já com a vaga).

## 3. Treinamento previsto em contrato
- `mobilizacao_treinamento_previsto` (função → dias, horas, item do contrato). `GET/PUT /mobilizacao/config/treinamentos`
  com sugestão de horas = soma da carga horária dos treinamentos exigidos da função (spec 088).
- Gasto: dias na etapa Treinamentos; horas = carga horária dos treinamentos registrados da pessoa entre o início do
  processo e a saída do Treinamento. Os dias previstos viram a meta de Treinamentos daquela função.
- Métricas (memória): "Dias gastos / previstos", "Horas realizadas × contrato" e tabela por função (média, previsto,
  desvio, acima do previsto, horas). Cartão do processo mostra "treinamento X d / Y d contrato · h".
- Tela: aba Configurações = metas das faixas + treinamento previsto em contrato.

## Testes
`tests/test_vagas.py` (domínio da vaga, treinamento × contrato, ponta a ponta) e e2e no navegador.
