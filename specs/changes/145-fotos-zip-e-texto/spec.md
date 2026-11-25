# Spec 145 — Baixar todas as fotos por dia e por frente · editar o texto da foto

## 1. Baixar todas de uma vez
**Problema:** o book (`/app/fotos`) só baixava uma foto por vez (spec 119).

**Regra**
- `GET /fotos/book/zip` com os mesmos filtros do book (`de`, `ate`, `tipo`, `area_id`) e, opcionalmente, `ids=1,2,3` para só as
  escolhidas. Devolve um .zip (`campo/application/book.py::montar_zip`):
  - pastas `AAAA-MM-DD/<frente>/` com as fotos **originais**; o nome diz dia, hora, frente, tipo e id
    (`domain/foto.py::nome_arquivo`, o mesmo de "baixar foto");
  - `indice.xlsx` com arquivo, dia, hora, local, frente, tipo, atividade, CWP, descrição e legenda;
  - nome do .zip: `fotos-AAAAMMDD[-AAAAMMDD][-FRENTE].zip`.
- Até 3000 fotos por vez (acima disso, pede um dia ou uma frente). Foto que sumiu do armazenamento não derruba o lote: fica no
  índice como "(não encontrado)". Por obra; rota síncrona (spec 082), arquivo temporário apagado depois do envio.
- Tela: "Baixar todas (N)" no topo (filtros da tela; com busca digitada, só as que aparecem) e "Baixar N" em cada grupo (dia,
  frente, atividade — 1º e 2º nível). O grupo vai pelo filtro (dia/frente) quando ele dá exatamente aquelas fotos; senão, pelos ids.

## 2. Editar o texto da foto (data e hora travadas)
**Problema:** o carimbo saía só com o texto que a tela montava.

**Regra**
- Botão "Aa" em cada foto ainda não enviada (`TirarFotos` em todas as telas do celular e "Fotos da atividade" do `/encarregado`):
  abre "Texto da foto" com a **data e hora travadas** (cadeado, "não dá para mudar") e as linhas editáveis (até 6, 90 caracteres;
  incluir, tirar, voltar ao padrão). Foto com texto editado fica com o "Aa" em amarelo.
- `textoDaFoto` (WeakMap por foto) + `aplicarTexto`: no carimbo, só as linhas que a tela mostrava são trocadas pelo texto da
  pessoa; as que a tela acrescenta ao salvar ("Restrição Nº 12", "OCORRÊNCIA", "DEPOIS · evidência") continuam. A obra entra no
  texto editável. Marcar na foto (spec 122) leva o texto junto.
- Foto já enviada não muda (o carimbo está na imagem).
