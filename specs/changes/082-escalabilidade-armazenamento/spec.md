# 082 — Escalabilidade na KVM1 e armazenamento em nuvem (Google Drive, OneDrive, Dropbox)

**Status:** PROPOSTA — só planejamento. Nada construído; cada fase precisa de liberação.

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

## Fase 1 — não travar (risco baixo, cerca de 1 dia)
- `contexto_obra.dep` passa a ser síncrona: o FastAPI a roda numa thread, fora do loop.
- Rotas de upload: ler o arquivo e fazer o trabalho do banco em `run_in_threadpool` (ou rota síncrona com `arquivo.file`).
- `create_engine(pool_size=10, max_overflow=10, pool_timeout=10)`. Postgres com `max_connections` folgado e
  `idle_in_transaction_session_timeout=60s`.
- Teste de carga automatizado (`tests/test_carga_pool.py` com 30 requisições simultâneas) para o defeito não voltar.

## Fase 2 — menos chamadas (risco baixo)
- Consulta de mudanças a cada **15 s**, **pausada com a aba escondida** (`document.visibilityState`) e imediata ao voltar
  para a aba. As notificações vão junto na mesma resposta, sem consulta própria a cada 30 s.
- Recarregar só as consultas da área que mudou: a marca passa a indicar o módulo, por exemplo `programacao:12`.
- Compressão gzip/brotli no proxy do Coolify, cache longo dos estáticos do Next.

## Fase 3 — calcular uma vez, servir a todos (risco médio)
- Cache da visão da programação na memória da API, com chave (programação, marca de mudança): 100 pessoas abrindo dão
  1 cálculo e 99 leituras.
- `ETag`/`304 Not Modified` nas visões grandes, para o navegador não baixar o que já tem.
- Revisão emitida servida da foto gravada, nunca recalculada.

## Fase 4 — arquivos fora do banco (porta de armazenamento)
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
Um script move os `LargeBinary` atuais para o disco e a fila, e só depois uma migração Alembic remove as colunas.

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

Liberado: **fases 1 e 2**, de risco baixo e com o maior ganho medido. Fases 3 e 4: liberar depois de medir em produção
(ver abaixo), quando Verificação chegar a 70.

### Medir em produção (terminal do Postgres no Coolify, só leitura)
```sql
select pg_size_pretty(pg_database_size(current_database()));
select relname, pg_size_pretty(pg_total_relation_size(relid)) from pg_statio_user_tables
 order by pg_total_relation_size(relid) desc limit 10;
select count(*), pg_size_pretty(sum(length(conteudo))::bigint) from foto_campo;
```
