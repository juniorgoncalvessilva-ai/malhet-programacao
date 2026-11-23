# 138 — Envio de documentos sem erro 500

## Relato (painel de erros, 22–23/11/2026)
- `500 em POST /documentos/revisoes` (E-0756D3, 11 vezes em 22/11) e `500 em POST /documentos/48/arquivo` (E-3253B2, 23/11):
  os dois passam por `servico.ler_arquivo` → `desenho.ler` (DWG → DXF → carimbo, textos e folha) e `registrar_revisao`.
- `500 em GET /documentos/pastas` (uma vez, 22/11 13:28, durante um deploy), `Loading chunk … failed` (aba aberta durante deploy,
  já tratado na spec 109) e `network error` no celular (sem internet): sem correção de código.

## Causas que derrubavam o envio (a pilha não estava no relato copiado)
1. Texto do desenho com NUL (`\x00`) ou outro caractere de controle — comum no DWG convertido pelo LibreDWG — ia para o carimbo
   (JSONB), para as TAGs e para o título do documento: o PostgreSQL recusa e a gravação estourava.
2. Exceção que o leitor não previa: `recover.read` com erro fora de `DXFStructureError/OSError/UnicodeDecodeError`, e o
   `savefig` do Agg em desenho muito carregado ("Exceeded cell block limit") — o `savefig` ficava fora do `try`.

## O que muda
- `infra/desenho.py`: `limpo()` tira NUL e caracteres de controle de todo texto lido (TEXT/MTEXT, atributos e tags do carimbo);
  `_abrir` transforma qualquer erro de leitura em "DXF ilegível"; PDF e PNG da folha com `try` próprio, PNG tenta de novo com a
  metade do DPI e, se não der, só avisa.
- `application/servico.py::ler_arquivo`: erro inesperado na leitura do desenho vira aviso ("não consegui ler o desenho (Tipo): o
  arquivo ficou guardado, sem carimbo nem folha") — o arquivo é guardado e a revisão registrada, como já acontecia com o
  take-off (spec 124).

## Verificação
`tests/test_atualizar_arquivo.py::test_desenho_que_nao_le_nao_derruba_o_envio`: `limpo` tira NUL/controle; DXF quebrado e
leitor que estoura (`OverflowError`) não dão 500 — guardam com aviso, nos dois caminhos (`/documentos/{id}/arquivo` e
`/documentos/revisoes`). DWG real (C-51890) continua gerando PNG, PDF e carimbo.
