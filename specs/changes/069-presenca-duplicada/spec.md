# 069 — Mesma pessoa lida em dois celulares: vale a leitura mais cedo

## Pedido
Duas pessoas, em celulares diferentes, leem o crachá do mesmo colaborador: reconhecer a duplicidade e validar a leitura
feita mais cedo.

## Solução
- `presenca_leitura.valida` (migração 0038; as antigas recalculadas: vale a mais cedo de cada pessoa no dia).
- Ao sincronizar (`POST /presenca/leituras`), para cada pessoa e dia tocados: a leitura válida é a de **hora mais cedo**
  (empate: a que chegou primeiro, `domain.validas`); as outras ficam `valida = false`. Vale também quando o celular
  que leu antes estava sem internet e sobe depois — a dele passa a valer e a outra vira duplicada.
  A resposta traz `resultados` por leitura (`valida`, `hora_valida`, `outro_celular`).
- `GET /presenca/hoje`: presenças válidas do dia já no servidor (de todos os celulares). O celular baixa junto com a
  sincronização e guarda no aparelho: ler alguém já registrado por outro celular avisa "Já registrado às 07:01 por outro
  celular" e não grava outra leitura.
- Na lista do celular, a leitura que ficou duplicada mostra "duplicada · vale a de 07:01 (outro celular)"; o contador
  de presentes junta servidor + aparelho sem duplicar.
- Presença do dia (web): "N leituras (vale a 1ª)" quando a pessoa foi lida mais de uma vez.
- Teste: `tests/test_presenca.py::test_duas_leituras_da_mesma_pessoa_vale_a_mais_cedo`.
