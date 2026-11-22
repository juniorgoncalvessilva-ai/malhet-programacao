'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCheck, FileSpreadsheet, Plus, Search, Upload } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { DetalheDocumento } from '@/components/Documentos/DetalheDocumento';
import { ConsolidadoDocumentos } from '@/components/Documentos/ConsolidadoDocumentos';
import { EnviarDocumentos } from '@/components/Documentos/EnviarDocumentos';
import { ExploradorDocumentos } from '@/components/Documentos/ExploradorDocumentos';
import { GrafoDocumentos } from '@/components/Documentos/GrafoDocumentos';
import { ProjetosPorAtivo } from '@/components/Documentos/ProjetosPorAtivo';
import { PastasDocumentos } from '@/components/Documentos/PastasDocumentos';
import { Abas } from '@/components/Obra/Abas';
import { Carregando } from '@/components/Obra/Esqueleto';
import { MultiSelecao } from '@/components/Obra/MultiSelecao';
import { Botao, CARREGANDO, Cabecalho, Campo, Chip, Indicador, Painel, Pilula, Selecao, Tabela, td } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { type DocumentoResumo, type Grafo, type GrdResumo, type OpcoesDocumentos, type ResultadoLdo, SITUACAO } from '@/lib/documentos';
import { useObra } from '@/lib/obra/ObraProvider';

type Aba = 'pastas' | 'enviar' | 'lista' | 'consolidado' | 'grds' | 'conexoes' | 'importar';
const dataBR = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—');
const hoje = () => new Date().toISOString().slice(0, 10);

export default function DocumentosPage() {
  return <Suspense fallback={<Carregando />}><Documentos /></Suspense>;
}

/**
 * Documentos controlados (spec 123 · ISO 9001:2015, 7.5; pastas e consolidado — spec 129): a LDO da obra com a revisão que vale no campo, as GRDs de entrada
 * e saída, o mapa de conexões (Zettelkasten) e a importação da LDO. Revisão nova entra pelo arquivo: o DWG vira folha
 * (PDF/PNG) e o carimbo preenche código, revisão e finalidade. As quantidades do desenho ficam na tela Take-off do projeto (spec 127); Conexões só para o super admin por enquanto.
 */
function Documentos() {
  const api = useApi();
  const qc = useQueryClient();
  const params = useSearchParams();
  const { pode, superadmin } = useObra();
  const planejador = pode('planejador');
  const [aba, setAba] = useState<Aba>('pastas');
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');
  const [pacote, setPacote] = useState('');
  const [aberto, setAberto] = useState<number | null>(Number(params.get('doc')) || null);
  const [gerenciar, setGerenciar] = useState(false);
  const lista = useQuery({ queryKey: ['documentos', 'lista'], queryFn: () => api.get<DocumentoResumo[]>('/documentos') });
  const opcoes = useQuery({ queryKey: ['documentos', 'opcoes'], queryFn: () => api.get<OpcoesDocumentos>('/documentos/opcoes'), staleTime: Infinity });
  const docs = lista.data ?? [];
  const recebidos = useQuery({ queryKey: ['documentos', 'recebidos'], queryFn: () => api.get<unknown[]>('/documentos/recebidos'), enabled: planejador });
  const pendentes = recebidos.data?.length ?? 0;
  const termos = busca.trim().toUpperCase();
  const pacotes = [...new Set(docs.map((d) => d.pacote).filter((x): x is string => !!x))];
  const visiveis = docs.filter((d) => (!tipo || d.tipo === tipo) && (!pacote || d.pacote === pacote)
    && (!termos || `${d.codigo} ${d.codigo_contratada ?? ''} ${d.titulo} ${d.local_texto ?? ''}`.toUpperCase().includes(termos)));
  const vigentes = docs.filter((d) => d.vigente).length;
  const sugestoes = docs.reduce((s, d) => s + d.sugestoes, 0);
  const atualizar = () => qc.invalidateQueries({ queryKey: ['documentos'] });

  return (
    <>
      <Cabecalho eyebrow="Documentos · LDO, revisões e GRD" titulo={docs.length ? `${docs.length} documentos, ${vigentes} com revisão vigente no campo` : 'Nenhum documento controlado ainda'}
        acoes={<>
          <Botao variante="secundario" onClick={() => api.download('/documentos/ldo.xlsx', 'LDO.xlsx')}><FileSpreadsheet size={16} /> LDO em Excel</Botao>
        </>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador rotulo="Documentos" valor={docs.length} />
        <Indicador rotulo="Vigentes no campo" valor={vigentes} tom="sucesso" />
        <Indicador rotulo="Sem revisão liberada" valor={docs.length - vigentes} tom={docs.length - vigentes ? 'atencao' : undefined} />
        <Indicador rotulo="Ligações a confirmar" valor={sugestoes} tom={sugestoes ? 'atencao' : undefined} detalhe="sugeridas pela TAG do desenho" />
      </div>
      <Abas rotulo="Documentos" ativa={aba} onTrocar={setAba}
        abas={[{ chave: 'pastas', titulo: 'Explorar pastas' }, { chave: 'enviar', titulo: `Enviar e relacionar${pendentes ? ` (${pendentes})` : ''}`, visivel: planejador }, { chave: 'lista', titulo: 'Lista de documentos (LDO)' }, { chave: 'consolidado', titulo: 'Consolidado' }, { chave: 'grds', titulo: 'GRDs' }, { chave: 'conexoes', titulo: 'Conexões', visivel: superadmin },
          { chave: 'importar', titulo: 'Importar LDO', visivel: planejador }]} />

      {aba === 'lista' && (
        <>
          <Painel titulo="Qual revisão vale em cada documento?" acoes={
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex h-10 items-center gap-2 rounded-full border border-m-stroke bg-m-surface-field px-3"><Search size={15} className="text-m-text-muted" />
                <input aria-label="Buscar documento" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="código ou título" className="w-[200px] border-0 bg-transparent p-0 text-[13px] outline-none focus:ring-0" /></label>
              <Chip ativo={!tipo} onClick={() => setTipo('')}>Todos</Chip>
              {Object.entries(opcoes.data?.tipos ?? {}).filter(([k]) => docs.some((d) => d.tipo === k)).map(([k, v]) => <Chip key={k} ativo={tipo === k} onClick={() => setTipo(k)}>{v}</Chip>)}
              {pacotes.length > 1 && (
                <select aria-label="Pacote" value={pacote} onChange={(e) => setPacote(e.target.value)} className="h-10 rounded-full border border-m-stroke bg-m-surface-field px-3 text-[13px]">
                  <option value="">Todos os pacotes</option>{pacotes.map((p) => <option key={p}>{p}</option>)}
                </select>
              )}
            </div>}>
            <Tabela cabecalho={['Código', 'Título', 'Tipo', 'Vigente no campo', 'Última revisão', 'Ligações']} vazio={lista.isLoading ? CARREGANDO : !visiveis.length && 'Nenhum documento. Envie uma revisão ou importe a LDO.'}>
              {visiveis.map((d) => (
                <tr key={d.id} className="cursor-pointer hover:bg-m-surface-hover" onClick={() => setAberto(d.id)}>
                  <td className={td}><b className="text-m-text-primary">{d.codigo}</b>{d.codigo_contratada && <div className="text-[11px] text-m-text-muted">{d.codigo_contratada}</div>}</td>
                  <td className={td}>{d.titulo}{(d.local_texto || d.pacote) && <div className="text-[11px] text-m-text-muted">{[d.local_texto, d.pacote].filter(Boolean).join(' · ')}</div>}</td>
                  <td className={td}>{d.tipo_nome}</td>
                  <td className={td}>{d.vigente ? <Pilula tom="sucesso">Rev. {d.vigente.revisao} · {d.vigente.finalidade}</Pilula> : <Pilula tom="atencao">Sem revisão liberada</Pilula>}</td>
                  <td className={td}>{d.ultima ? <>Rev. {d.ultima.revisao} <Pilula tom={SITUACAO[d.ultima.situacao].tom}>{SITUACAO[d.ultima.situacao].rotulo}</Pilula></> : '—'}</td>
                  <td className={td}>{d.ligacoes}{d.sugestoes > 0 && <span className="ml-1 text-m-warning">+{d.sugestoes} a confirmar</span>}</td>
                </tr>
              ))}
            </Tabela>
          </Painel>
        </>
      )}
      {aba === 'pastas' && (gerenciar
        ? <div className="flex flex-col gap-3">
            <Botao variante="secundario" className="w-fit" onClick={() => setGerenciar(false)}><ArrowLeft size={16} /> Voltar ao explorador</Botao>
            <PastasDocumentos opcoes={opcoes.data} docs={docs} onAbrir={setAberto} onAcao={(a) => setAba(a === 'enviar' ? 'enviar' : a === 'ldo' ? 'importar' : 'grds')} />
          </div>
        : <ExploradorDocumentos docs={docs} opcoes={opcoes.data} onAbrir={setAberto} onGerenciar={() => setGerenciar(true)}
            onAcao={(a) => setAba(a === 'enviar' ? 'enviar' : a === 'ldo' ? 'importar' : 'grds')} />)}
      {aba === 'enviar' && planejador && <EnviarDocumentos opcoes={opcoes.data} docs={docs} onAbrir={setAberto} />}
      {aba === 'consolidado' && <ConsolidadoDocumentos onAbrir={setAberto} />}
      {aba === 'grds' && <Grds docs={docs} planejador={planejador} />}
      {aba === 'conexoes' && superadmin && <Conexoes onAbrir={setAberto} />}
      {aba === 'importar' && planejador && <ImportarLdo onPronto={atualizar} onAbrir={setAberto} />}
      {aberto && <DetalheDocumento id={aberto} opcoes={opcoes.data} documentos={docs} onFechar={() => setAberto(null)} onAbrir={setAberto} />}
    </>
  );
}

function Grds({ docs, planejador }: { docs: DocumentoResumo[]; planejador: boolean }) {
  const api = useApi();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['documentos', 'grds'], queryFn: () => api.get<GrdResumo[]>('/documentos/grds') });
  const op = useQuery({ queryKey: ['documentos', 'grds', 'opcoes'], staleTime: Infinity,
    queryFn: () => api.get<{ vias: Record<string, string>; formatos: string[]; finalidades: Record<string, string> }>('/documentos/grds/opcoes') });
  const [nova, setNova] = useState(false);
  const vazio = { sentido: 'emitida', data: hoje(), remetente: '', destinatario: '', numero_externo: '', observacao: '', atencao: '', atencao_cargo: '',
    emitente: '', emitente_cargo: '', referencia: '', via: 'CC', formato: '', vias: '1' };
  const [f, setF] = useState(vazio);
  const [itens, setItens] = useState<string[]>([]);
  const [importando, setImportando] = useState(false);
  const atualizar = () => qc.invalidateQueries({ queryKey: ['documentos'] });
  const criar = async () => {
    try {
      const { via, formato, vias, ...cab } = f;
      const g = await api.post<{ numero: string }>('/documentos/grds', { ...Object.fromEntries(Object.entries(cab).map(([k, v]) => [k, v || null])),
        sentido: f.sentido, data: f.data, remetente: f.remetente, destinatario: f.destinatario,
        itens: itens.map((x) => ({ documento_id: Number(x), via: via || null, formato: formato || null, vias: Number(vias) || 1 })) });
      toast.success(`${g.numero} registrada`); setNova(false); setItens([]); setF(vazio); atualizar();
    } catch (e) { toast.error((e as Error).message); }
  };
  const importar = async (a: File) => {
    const fd = new FormData(); fd.append('arquivo', a, a.name);
    setImportando(true);
    try {
      const g = await api.post<{ numero: string; numero_externo: string | null; itens: unknown[]; documentos_novos: number; revisoes_novas: number }>('/documentos/grds/importar', fd);
      toast.success(`${g.numero_externo ?? g.numero}: ${g.itens.length} documentos (${g.documentos_novos} novos, ${g.revisoes_novas} revisões registradas)`);
      atualizar();
    } catch (e) { toast.error((e as Error).message); } finally { setImportando(false); }
  };
  const c = (k: keyof typeof f, rotulo: string, extra: { placeholder?: string; className?: string; type?: string } = {}) => (
    <Campo rotulo={rotulo} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} />
  );
  return (
    <Painel titulo="O que chegou e o que saiu?" subtitulo="Guia de Remessa no modelo do contrato: toda distribuição externa sai com GRD (Plano de Arquivamento). Importe a GRD recebida em Excel — as revisões listadas ficam registradas e o arquivo chega depois — ou emita a GRD com as revisões vigentes."
      acoes={planejador && <div className="flex flex-wrap gap-2">
        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-m-stroke px-4 text-[13px] font-semibold text-m-accent">
          <Upload size={15} /> {importando ? 'Lendo a GRD…' : 'Importar GRD (Excel)'}
          <input type="file" accept=".xlsx,.xlsm" className="sr-only" aria-label="Planilha da GRD" disabled={importando} onChange={(e) => { const a = e.target.files?.[0]; e.target.value = ''; if (a) importar(a); }} />
        </label>
        <Botao onClick={() => setNova(!nova)}><Plus size={16} /> Nova GRD</Botao>
      </div>}>
      {nova && (
        <div className="mb-4 flex flex-col gap-3 rounded-[16px] border border-m-stroke-subtle p-4">
          <div className="flex flex-wrap gap-2">
            <Chip ativo={f.sentido === 'emitida'} onClick={() => setF({ ...f, sentido: 'emitida' })}>Emitida</Chip>
            <Chip ativo={f.sentido === 'recebida'} onClick={() => setF({ ...f, sentido: 'recebida' })}>Recebida</Chip>
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            {c('data', 'Data', { type: 'date' })}
            {c('destinatario', 'Para', { placeholder: 'Cliente, campo, fornecedor…' })}
            {c('remetente', 'De', { placeholder: 'Contratada, projetista…' })}
            {c('numero_externo', 'Nº da GRD de origem')}
            {c('atencao', 'Atenção')}
            {c('atencao_cargo', 'Área/cargo')}
            {c('emitente', 'Emitente')}
            {c('emitente_cargo', 'Área/cargo')}
            {c('referencia', 'Referência', { placeholder: 'Book Qualidade, pacote…' })}
          </div>
          {f.sentido === 'emitida' && <>
            <MultiSelecao rotulo="Documentos (vai a revisão vigente)" largura="w-full" comNa={false} valor={itens}
              opcoes={docs.filter((d) => d.vigente).map((d) => ({ valor: String(d.id), rotulo: `${d.codigo} · rev ${d.vigente!.revisao} · ${d.titulo}` }))} onChange={setItens} />
            <div className="flex flex-wrap gap-2">
              <Selecao rotulo="Tipo de via" value={f.via} onChange={(e) => setF({ ...f, via: e.target.value })}>
                {Object.entries(op.data?.vias ?? { CC: 'Cópia controlada' }).map(([k, v]) => <option key={k} value={k}>{k} - {v}</option>)}
              </Selecao>
              <Selecao rotulo="Formato" value={f.formato} onChange={(e) => setF({ ...f, formato: e.target.value })}>
                <option value="">—</option>{(op.data?.formatos ?? []).map((x) => <option key={x}>{x}</option>)}
              </Selecao>
              {c('vias', 'Nº de vias', { type: 'number', className: 'w-[110px]' })}
            </div>
            <p className="text-[12px] text-m-text-muted">Status (letra do TE) e finalidade da remessa saem da revisão: para construção → E e 3 - Para aplicação/construção.</p>
          </>}
          {c('observacao', 'Observações')}
          <div><Botao onClick={criar}>Registrar GRD</Botao></div>
        </div>
      )}
      <Tabela cabecalho={['GRD', 'Data', 'De → Para', 'Itens', 'Ciência', '']} vazio={q.isLoading ? CARREGANDO : !q.data?.length && 'Nenhuma GRD ainda.'}>
        {(q.data ?? []).map((g) => (
          <tr key={g.id}>
            <td className={td}><b className="text-m-text-primary">{g.numero}</b> <Pilula tom={g.sentido === 'recebida' ? 'info' : 'acento'}>{g.sentido}</Pilula>
              {g.numero_externo && <div className="text-[11px] text-m-text-muted">origem {g.numero_externo}</div>}
              {(g.atencao || g.referencia) && <div className="text-[11px] text-m-text-muted">{[g.atencao && `at. ${g.atencao}`, g.referencia].filter(Boolean).join(' · ')}</div>}</td>
            <td className={td}>{dataBR(g.data)}</td>
            <td className={td}>{g.remetente} → {g.destinatario}</td>
            <td className={td}>{g.itens}</td>
            <td className={td}>{g.ciente_por ? <span className="text-m-success">{g.ciente_por} · {dataBR(g.ciente_em)}</span>
              : <button type="button" className="flex items-center gap-1 font-semibold text-m-accent" onClick={async () => { await api.post(`/documentos/grds/${g.id}/ciencia`); qc.invalidateQueries({ queryKey: ['documentos', 'grds'] }); }}><CheckCheck size={15} /> dar ciência</button>}</td>
            <td className={`${td} whitespace-nowrap text-right`}>
              {g.tem_arquivo && <button type="button" className="mr-3 font-semibold text-m-accent" onClick={() => api.download(`/documentos/grds/${g.id}/arquivo`, `${g.numero_externo ?? g.numero}.xlsx`)}>Original</button>}
              <button type="button" className="font-semibold text-m-accent" onClick={() => api.download(`/documentos/grds/${g.id}/xlsx`, `${g.numero}.xlsx`)}>Excel no modelo</button>
            </td>
          </tr>
        ))}
      </Tabela>
    </Painel>
  );
}

function Conexoes({ onAbrir }: { onAbrir: (id: number) => void }) {
  const api = useApi();
  const [vista, setVista] = useState<'ativos' | 'mapa'>('ativos');
  const q = useQuery({ queryKey: ['documentos', 'grafo'], enabled: vista === 'mapa', queryFn: () => api.get<Grafo>('/documentos/grafo') });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Chip ativo={vista === 'ativos'} onClick={() => setVista('ativos')}>Projetos por ativo</Chip>
        <Chip ativo={vista === 'mapa'} onClick={() => setVista('mapa')}>Mapa das ligações</Chip>
      </div>
      {vista === 'ativos' ? <ProjetosPorAtivo onAbrir={onAbrir} /> : (
        <Painel titulo="Como os documentos se ligam?" subtitulo="Cada documento com as frentes, os grupos de atividade e os documentos que ele referencia. As mesmas ligações vão nas notas .md do acervo da obra (abrem no graphify ou no Obsidian).">
          {q.data ? <GrafoDocumentos g={q.data} onAbrir={onAbrir} /> : <Carregando />}
        </Painel>
      )}
    </div>
  );
}

function ImportarLdo({ onPronto, onAbrir }: { onPronto: () => void; onAbrir: (id: number) => void }) {
  const api = useApi();
  const [res, setRes] = useState<ResultadoLdo | null>(null);
  const [enviando, setEnviando] = useState(false);
  return (
    <Painel titulo="Importar a lista de documentos (LDO)" subtitulo="A LDO do contrato em .xlsx, no modelo do cliente: o cabeçalho é achado pelos nomes em cada aba (Número VALE ou Código, Descrição, Revisão, Tipo de Emissão, Observações = CWA/local, Disciplina, Motivo, Enviado em, Apresentado, Para quem). Cada aba é um pacote; a folha de rosto vira a própria LDO com o histórico. Reimportar atualiza sem duplicar.">
      <label className="flex h-11 w-fit cursor-pointer items-center gap-2 rounded-full bg-m-accent-strong px-5 text-[13px] font-semibold text-m-on-accent">
        <Upload size={16} /> {enviando ? 'Lendo a LDO…' : 'Escolher a planilha da LDO'}
        <input type="file" accept=".xlsx,.xlsm" className="sr-only" aria-label="Planilha da LDO" disabled={enviando} onChange={async (e) => {
          const a = e.target.files?.[0]; e.target.value = '';
          if (!a) return;
          const fd = new FormData(); fd.append('arquivo', a, a.name);
          setEnviando(true);
          try { const r = await api.post<ResultadoLdo>('/documentos/ldo', fd); setRes(r); toast.success('LDO importada'); onPronto(); } catch (er) { toast.error((er as Error).message); } finally { setEnviando(false); }
        }} />
      </label>
      {res && (
        <div className="mt-4 flex flex-col gap-3 text-[13px] text-m-text-secondary">
          {res.ldo && (
            <p><b className="text-m-text-primary">{res.ldo.codigo}</b> rev. {res.ldo.revisao} registrada como documento (Lista){res.ldo.historico ? `, com ${res.ldo.historico} revisões do histórico` : ''}{res.ldo.arquivo_guardado ? ' e o arquivo no acervo' : ''}.{' '}
              <button type="button" className="font-semibold text-m-accent" onClick={() => onAbrir(res.ldo!.id)}>Abrir</button></p>
          )}
          <div className="flex flex-wrap gap-2">
            {res.abas.map((x) => <Pilula key={x.aba} tom="neutro" ponto={false}>{x.aba} · {x.documentos}</Pilula>)}
          </div>
          <p>{res.criados} novos · {res.atualizados} atualizados · {res.revisoes} revisões novas · {res.ligados} ligados à frente pelo código
            {res.sugeridos ? <> · <b className="text-m-warning">{res.sugeridos} frentes sugeridas pela observação, a confirmar</b></> : null}</p>
          {res.locais_nao_achados.length > 0 && (
            <div>
              <div className="mb-1 font-semibold text-m-text-primary">Observações (CWA/local) que não casaram com uma frente da contratada</div>
              <ul className="grid gap-x-6 sm:grid-cols-2">
                {res.locais_nao_achados.slice(0, 16).map((x) => <li key={x.local}>{x.local} <span className="text-m-text-muted">({x.documentos})</span></li>)}
              </ul>
              <p className="mt-1 text-[12px] text-m-text-muted">Pode ser área de outra contratada ou um nome diferente do cadastro de Frentes: ligue no detalhe do documento ou ajuste a frente.</p>
            </div>
          )}
          {res.avisos.length > 0 && <p className="text-[12px] text-m-warning">{res.avisos.slice(0, 5).join(' · ')}</p>}
        </div>
      )}
    </Painel>
  );
}
