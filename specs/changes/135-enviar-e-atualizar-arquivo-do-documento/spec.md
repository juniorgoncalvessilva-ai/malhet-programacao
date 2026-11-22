# 135 — Enviar e atualizar o arquivo do documento pela prévia do explorador

## Pedido (usuário, 22/11/2026)
"Precisamos criar a opção de fazer o upload do arquivo, porque eu ainda não sei se tenho ou não o arquivo na rede e
principalmente como navegar para achar ele. Sugiro um botão Enviar arquivo e, caso haja, o botão é Atualizar arquivo.
Atualizar pode subir ou não a versão dele."

## O que muda
- **Saber o que falta**: nó "Sem arquivo (a receber)" na árvore do explorador e "sem arquivo" na lista (`temArquivo`: nem a
  vigente nem a última revisão têm o arquivo — só listadas na LDO). A prévia diz "a revisão X está na LDO esperando o arquivo"
  e não põe o carimbo de cópia controlada sem arquivo.
- **Enviar arquivo** (sem arquivo): "Enviar arquivo da rev. X" põe o arquivo na revisão que a LDO listou, com a finalidade da
  LDO; "Copiar código" (e o código da contratada) para procurar na pasta da rede.
- **Atualizar arquivo** (com arquivo): escolher
  - **Nova revisão** — a seguinte já vem sugerida (`proxima_revisao`/`proximaRevisao`: 0 → 1, A → B, Z → AA) com a finalidade
    (ou a do carimbo); revisão igual ou anterior à mais nova é recusada;
  - **Corrigir o arquivo da mesma revisão** — exige o motivo; o arquivo anterior fica guardado em `documento_arquivo_anterior`
    (quem enviou, quando, quem trocou, quando e por quê; fora da limpeza do acervo — `_em_uso`) e aparece no histórico da ficha
    ("Arquivo corrigido … por …: motivo (antes: nome)"); o take-off da revisão volta a "a ler".
- `POST /documentos/{doc_id}/arquivo` (`modo` mesma|nova, `revisao`, `finalidade`, `motivo`) → `servico.atualizar_arquivo`; o
  carimbo do DWG/DXF que diz outro código ou outra revisão gera aviso (o arquivo fica como pedido). `registrar_revisao` ganhou
  `substituir`/`motivo_substituicao`. Migração `0068_arquivo_anterior`.

## Verificação
`tests/test_atualizar_arquivo.py`: próxima revisão; enviar na revisão da LDO; corrigir sem motivo = 422, com motivo guarda o
anterior; nova revisão sugerida vira vigente; revisão para trás e revisão inexistente = 422; carimbo de outro documento avisa;
anterior em uso no acervo; por obra. E2E: "Sem arquivo (a receber)" 400 → 399 depois de enviar a rev. 0 de 1870AA-A-52637;
corrigir com motivo; nova revisão sugerida 1 com PARA CONSTRUÇÃO; ficha mostra a correção no histórico.
