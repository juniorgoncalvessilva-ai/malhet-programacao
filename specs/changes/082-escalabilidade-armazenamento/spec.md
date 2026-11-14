# 082 — Escalabilidade na KVM1 e armazenamento em nuvem (Google Drive, OneDrive, Dropbox)

**Status:** fases 1 a 4 FEITAS (14/11/2026). Fase 5 só se a medição pedir. As 3 consultas de produção (fim) seguem
pendentes: os limites ficaram configuráveis (`ARQUIVOS_LIMITE_GB`, dias no disco por obra, `DB_POOL_*`).

## Restrições
- Mesma VPS: KVM1 com 1 vCPU, 4 GB de RAM e 50 GB de disco, Coolify, Postgres, API e web no mesmo lugar. A arquitetura também
  não muda: continua um processo da API e um Postgres.
- Meta: **50 a 200 pessoas usando ao mesmo tempo**.
- Armazenamento: começa no **Google Drive**. **OneDrive** (o da empresa) e **Dropbox** entram como opções do mesmo conector.

## Fase 0 — medição (feita em 14/11/2026, local, API presa a 1 núcleo)
| Teste | Resultado |
|---|---|
| 20–30 chamadas simultâneas a rotas com banco (`/notificacoes/contagem`) | **API congelou por inteiro**, até o login: 30 s de espera e não volta sozinha |
| Mesmo teste com a dependência `contexto_obra` síncrona | 193 req/s, p95 298 ms, 0 erros |
| `/mudancas` (consulta automática) | ~600 req/s no máximo, barato |
| Visão da programação (`GET /programacoes/{id}`) com 5 linhas | ~93 ms de CPU por chamada (teto ≈ 11/s) |
| Visão da programação com 200 linhas | ~125 ms de CPU por chamada (teto ≈ 8/s) |
| 200 pessoas com consulta a cada 3 s, que é o comportamento de hoje | 75 req/s, p95 abaixo de 300 ms |
| 200 pessoas com consulta a cada 15 s | 21 req/s, 72% menos chamadas |

Os números locais vêm de um núcleo mais rápido que a vCPU da KVM1, sem o Next e o Coolify ao lado. Considerar de 2 a 3 vezes
mais lento na VPS.

### Causa do congelamento (defeito latente em produção)
O pool do SQLAlchemy tem 15 conexões. A dependência `contexto_obra` (`ler`, `programar`, `planejar`, `administrar`)
é `async def`, mas faz consulta síncrona. Quando as 15 conexões estão ocupadas, a 16ª requisição espera uma conexão
**dentro do loop do servidor**. As 15 que estão com conexão só a devolvem quando o loop roda, então nada anda até estourar
o tempo de 30 s, e as novas requisições repetem o ciclo. Doze rotas de upload `async def` que gravam no banco têm o mesmo
risco.

### Riscos em ordem
1. **Congelamento do pool:** basta ter mais de 15 requisições simultâneas ao banco, o que é provável com 50 a 200 pessoas.
2. **Tempestade de recarga:** cada edição faz *todas* as telas abertas recarregarem. Uma edição com 100 pessoas na
   programação de 200 linhas dá 100 × 125 ms = **cerca de 12 s de CPU**, e todo mundo espera.
3. **Consulta automática a cada 3 s**, inclusive em aba escondida.
4. **Arquivos dentro do Postgres** (`LargeBinary`: fotos do campo, anexos SSMA, logos, avatar, evidências): o banco e o
   backup crescem, e todo arquivo passa pela API e pela RAM.

## Fase 1 — não travar ✅ feita
- `contexto_obra.dep` passa a ser síncrona: o FastAPI a roda numa thread, fora do loop.
- Rotas de upload: ler o arquivo e fazer o trabalho do banco em `run_in_threadpool` (ou rota síncrona com `arquivo.file`).
- `create_engine(pool_size=10, max_overflow=10, pool_timeout=10)` (`DB_POOL_SIZE`, `DB_POOL_OVERFLOW`, `DB_POOL_TIMEOUT`).
  `idle_in_transaction_session_timeout` ficou de fora: importações longas (XER) poderiam ser cortadas.
- `tests/test_escala.py`: (1) varre todas as rotas — nenhuma função `async` (rota ou dependência) pode usar a Session
  (exceção consciente: `POST /obras/{id}/acessos`, rara, de admin, chama o auth-kit async); (2) pool + 20 requisições
  simultâneas terminam todas em menos de 15 s (com o código antigo a API congela e o teste falha em 30 s).

## Fase 2 — menos chamadas ✅ feita
- Consulta de mudanças a cada **15 s** (antes 3 s), só com a aba visível, e na hora ao voltar para a aba ou à rede
  (`src/lib/tempo-real`). A recarga depois de uma edição se espalha nos 15 s em vez de chegar toda junta.
- Contagem de notificações sem consulta própria a cada 30 s: o alerta nasce de uma gravação, que muda a marca e recarrega
  a contagem; fica uma garantia a cada 2 min.
- Já era assim: a recarga só refaz as consultas da tela aberta (TanStack `invalidateQueries` = ativas). Recarregar "só o
  módulo" ficou de fora: as telas cruzam módulos (equipe muda a programação) e daria dado velho na tela.
- `GZipMiddleware` na API (nível 5, acima de 1000 bytes, sem imagens/PDF/xlsx/docx), por dentro do `MudancasMiddleware`.
  Programação de teste: 14,8 KB → 2,9 KB pelo proxy do Next.
- Verificado no navegador: 2 consultas em 31 s (antes ~10); mudança de outra pessoa aparece sozinha em ~11 s; 0 consultas
  com a aba escondida.

## Fase 3 — calcular uma vez, servir a todos ✅ feita
- Cache da visão da programação na memória da API, com chave (programação, marca de mudança): 100 pessoas abrindo dão
  1 cálculo e 99 leituras.
- `ETag`/`304 Not Modified` nas visões grandes, para o navegador não baixar o que já tem.
- Revisão emitida servida da foto gravada, nunca recalculada.

Feito: `app/shared/cache_leitura.py` guarda o JSON pronto com a chave (nome, obra, id, marca de mudanças); trava por
chave (25 pedidos simultâneos = 1 cálculo), LRU de 48 MB e validade de 10 min. Usado em `GET /programacoes/{pid}` (com
ETag/304), no dia do campo (`/campo/dia`) e na presença; **nunca** dentro de gravações. Medido (1 núcleo, 200 linhas,
30 simultâneos): ~8 → **100 req/s**, p95 442 ms, 0 erros.

## Fase 4 — arquivos fora do banco ✅ feita
### Porta
`app/shared/armazenamento.py`:
- `Armazenamento(Protocol)`: `guardar(chave, bytes, tipo, meta) -> Ref`, `abrir(ref) -> bytes|stream`,
  `apagar(ref)`, `existe(ref)`.
- Adaptadores: `Disco` (padrão e cache quente), `GoogleDrive`, `OneDrive` (Microsoft Graph, pessoal ou empresa) e
  `Dropbox`.
- Configuração por obra em `armazenamento_obra` (`obra_id`, provedor, pasta raiz, token OAuth **criptografado**, conta).

### Fluxo (gravar local primeiro, subir depois)
1. Upload: o arquivo vai para o **disco** da VPS e a tabela guarda só a referência. Uma miniatura de cerca de 30 KB é
   gerada e fica sempre no disco.
2. A fila `envio_arquivo` (com tentativas e `id_local` idempotente) sobe o original ao provedor da obra.
3. O disco funciona como cache quente: os originais com mais de N dias saem do disco e ficam só na nuvem; as miniaturas
   ficam no disco.
4. Abrir o original busca no disco ou, se já saiu de lá, na nuvem e guarda de novo.

Motivo: Drive, OneDrive e Dropbox são arquivos, não servidores de imagem. Têm limite de chamadas e 200 a 800 ms por
arquivo, então as telas nunca leem direto deles.

### Permissão mínima em cada provedor (evita a verificação pesada do Google)
- Google: escopo `drive.file`, que dá acesso só ao que o app criou. Funciona em Drive compartilhado.
- Microsoft: `Files.ReadWrite.AppFolder`, com pasta própria do app no OneDrive. A empresa pode precisar de consentimento do
  admin do Entra.
- Dropbox: app do tipo *App folder*.

### O que nunca vai para a nuvem
O rosto na assinatura, as evidências LGPD, o descritor facial e as coordenadas (`sensivel: true`). Ficam no servidor e no
backup criptografado. Para auditoria, o que sai é o relatório gerado, que registra acesso.

### Estrutura Zettelkasten, igual nos três provedores
```
Malhet/
  00-INDICE.md
  obras/<CODIGO-OBRA>/
    00-indice.md
    10-programacoes/   20-campo-fotos/   30-ocorrencias-restricoes/   40-auditorias-acoes/
    50-ssma-anexos/    60-referencias(PQ,CPU,XER)/   70-relatorios/   80-marca/   90-arquivo-morto/
```
- Nome do arquivo: `AAAAMMDDhhmm-TIPO-curto.ext`, por exemplo `202611141530-FOTO-L1-armadura-bloco3.jpg`.
- Cada arquivo tem um `.md` irmão com YAML (`id`, `tipo`, `obra`, `frente`, `area`, `cwp`, `links: [ids]`,
  `hash_sha256`, `origem`, `sensivel`), para que uma IA leia a pasta e entenda as ligações sem abrir o banco.
- O `00-indice.md` de cada pasta é regerado pela fila.

### Migração
A própria fila move os `LargeBinary` de `foto_campo` e `anexo_ssma` para o disco, 20 por ciclo (verificado na base
local: 7 fotos + 1 anexo, com miniaturas). As colunas antigas ficam (nulas) até uma próxima spec removê-las.

### Como ficou (código)
- Módulo `arquivos/`: `domain/zettel.py` (pastas, nomes, `.md`, índices), `domain/provedor.py` (porta + `Credencial`
  mutável — o OneDrive troca o refresh token), `infra/provedores/{google,onedrive,dropbox}.py`, `infra/disco.py`,
  `infra/segredo.py` (Fernet), `application/servico.py` (`guardar`, `abrir`, `miniatura`), `application/fila.py`
  (tarefa em thread no lifespan; `ARQUIVOS_FILA=false` desliga), `application/registro.py` (cada módulo dono registra o
  migrador e a subconsulta dos arquivos em uso — a fila não lê tabela de outro módulo), `api/router.py` (`/armazenamento`,
  OAuth com `state` assinado, retorno em `/backend/api/armazenamento/oauth/{prov}/retorno`).
- Fotos (`campo/application/arquivos.py::nova_foto`, usada por campo, auditorias e etilômetro) e anexos de SSMA
  (`ssma/application/arquivos.py::novo_anexo`). `GET /fotos/{id}/arquivo?mini=true` = miniatura (≈10 KB contra ≈55 KB);
  book e app de campo usam a miniatura na lista e o original só ao ampliar.
- Logos, avatar e evidências LGPD continuam no banco (pequenos; evidência é sensível).
- Tela `/app/armazenamento` (admin). Volume `malhet-prog-arquivos:/data/arquivos` no compose. Cadastro dos apps:
  `docs/deploy-coolify.md`.
- `tests/test_arquivos.py`: nomes/fichas, foto no disco com miniatura, migração, órfãos, ida e volta com o Google Drive
  simulado (pastas, `.md`, índice, disco liberado e original baixado de volta conferindo o hash), falha com espera, token
  revogado → reconectar, OneDrive/Dropbox pelo caminho, anexo de SSMA.

## Fase 5 — só se a medição pedir
- Mais de um processo da API: trocar o contador de `/mudancas` por LISTEN/NOTIFY do Postgres.
- Build das imagens no GitHub Actions em vez da VPS, para o deploy não disputar CPU com os usuários.

## MVE (pontuação na KVM1, faixa de risco média)
| Camada | Antes | Agora | Por quê |
|---|---|---|---|
| Intenção | 75 | 85 | Meta de 50 a 200 pessoas e os provedores definidos |
| Estrutura | 60 | 75 | Porta única com 3 adaptadores, fases independentes |
| Equilíbrio | 60 | 70 | Sem custo de VPS. Custo: tempo e o OAuth de 3 provedores |
| Verificação | 35 | 65 | Medido localmente. Falta medir na VPS e o tamanho real do banco e das fotos |

Liberado e feito: **fases 1 e 2**. Fases 3 e 4: liberar depois de medir em produção
(ver abaixo), quando Verificação chegar a 70.

### Medir em produção (terminal do Postgres no Coolify, só leitura)
```sql
select pg_size_pretty(pg_database_size(current_database()));
select relname, pg_size_pretty(pg_total_relation_size(relid)) from pg_statio_user_tables
 order by pg_total_relation_size(relid) desc limit 10;
select count(*), pg_size_pretty(sum(length(conteudo))::bigint) from foto_campo;
```
