# 128 — LDO no modelo do contrato e Frentes pela planilha de CWAs

## Contexto (usuário, 22/11/2026)
As LDOs do contrato chegam em Excel e cada contratante/contratada tem o seu modelo, mas os campos são os mesmos em contexto.
Referência: LD-0000AA-G-54938 rev. 5 — folha de rosto + uma aba por pacote ("1870CC - CMD", "16XXCC - OFICINA",
"16XXCC - INTERFERÊNCIAS"), cabeçalho na linha 12:
Número VALE (nº do documento) · Descrição (descritivo) · Revisão · Tipo de Emissão (TE em letra) · Observações (CWA ou local a que
o projeto pertence) · Disciplina (sigla) · Motivo Revisão · Disciplina (nome) · Enviado em (quando a LDO foi enviada) · Projeto
Apresentado (Sim/Não) · Para quem.
A lista de CWAs representa as áreas do empreendimento; a contratada não responde por todas — a aba dela ("CWAs Cardan", com a
coluna Empresa) é a WBS de execução.

## LDO (`documentos/domain/ldo.py`, `servico.importar_ldo`)
- Cabeçalho achado em **cada aba** pelos nomes (sinônimos, o mais longo ganha; TIPO/TE/OBS/REV só por nome exato); aba sem
  cabeçalho é lida como folha de rosto (Nº VALE, REVISÃO e o quadro Rev. | TE | Descrição | Data). O modelo simples antigo
  (Código | Título | Rev. | Finalidade | Disciplina | Frente) continua valendo.
- **TE em letra** → finalidade (`TIPO_EMISSAO`): A preliminar · B para aprovação · C para conhecimento · D para cotação ·
  E para construção · F conforme comprado · G conforme construído · H cancelado. E e G liberam o uso no campo.
- Duas colunas "Disciplina": a de valores curtos é a sigla (`documento.disciplina_sigla`), a outra o nome; sigla sem nome é
  completada pelo par que a própria LDO usa (C → Civil).
- Documento ganha `pacote` (a aba) e `local_texto` (Observações); a revisão ganha `motivo`, `ldo_enviada_em`, `apresentado`,
  `apresentado_para` e `ldo` ("LD-0000AA-G-54938 rev. 5"). Revisão já com arquivo não tem a finalidade trocada pela LDO.
- **Observações → frente** (`casar_local`): código/CWA exato **confirma**; TAG do ativo ou o nome da área (palavras inteiras — "Classe
  I" não casa com "Classe II") **sugere** (o Planejamento confirma, spec 123); sem observação, a área do número do documento
  (1600AA-…) sugere quando só uma frente tem aquele ativo. Observação que não casa vai para "locais não achados" (outra contratada
  ou nome diferente do cadastro).
- **A própria LDO** vira documento controlado (tipo Lista) com o histórico da folha de rosto e o .xlsx no acervo na revisão atual.
- Reimportar atualiza sem duplicar.

## Frentes pela planilha de CWAs (`frentes/domain/planilha_cwa.py`)
- `POST /frentes/planilha/previa`: abas com CWA/CONCATENADO + descrição + ATIVO/EMPRESA, empresas de cada uma, inativas;
  sugere a aba da contratada (nome em Marca da obra) e a empresa dela.
- `POST /frentes/planilha` (aba, empresas): linha só com a descrição é o Local ("Novo CMD", "Nova Oficina"); Situação ≠ Ativa fica
  de fora; converte para a lista `CWA | Ativo | DESCRICAO CWA | Local` e usa a mesma importação das Frentes (merge, CWA repetido
  com sufixo, áreas novas entram na WBS).
- Tela Frentes: "Quais áreas são da contratada?" (arquivo → aba → empresas → importar).

## Verificação
`tests/test_ldo_contrato.py` (TE, leitura com folha de rosto e duas Disciplinas, casar local, planilha de CWAs pela API com
empresa e inativa, LDO pela API com pacote/motivo/apresentado/vínculo sugerido/LDO como documento, reimportar) + teste com os
arquivos reais (`LDO_REAL`, `CWA_REAL`, fora do git) — passou. E2E com os arquivos reais: CARDAN sugerida (64 áreas), 400
documentos em 3 pacotes, 112 frentes sugeridas, LDO rev. 5 com 6 revisões e o arquivo.
