'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, FileSpreadsheet, FileUp, Plus, Search, Upload } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { DetalheDocumento } from '@/components/Documentos/DetalheDocumento';
import { GrafoDocumentos } from '@/components/Documentos/GrafoDocumentos';
import { Abas } from '@/components/Obra/Abas';
import { Carregando } from '@/components/Obra/Esqueleto';
import { MultiSelecao } from '@/components/Obra/MultiSelecao';
import { Botao, CARREGANDO, Cabecalho, Campo, Chip, Indicador, Painel, Pilula, Selecao, Tabela, td } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { type DocumentoResumo, type Grafo, type GrdResumo, type OpcoesDocumentos, type ResultadoLdo, SITUACAO } from '@/lib/documentos';
import { useObra } from '@/lib/obra/ObraProvider';

type Aba = 'lista' | 'grds' | 'conexoes' | 'importar';
const dataBR = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—');
const hoje = () => new Date().toISOString().slice(0, 10);

export default function DocumentosPage() {
  return <Suspense fallback={<Carregando />}><Documentos /></Suspense>;
}

/**
 * Documentos controlados (spec 123 · ISO 9001:2015, 7.5): a LDO da obra com a revisão que vale no campo, as GRDs de entrada
 * e saída, o mapa de conexões (Zettelkasten) e a importação da LDO. Revisão nova entra pelo arquivo: o DWG vira folha
 * (PDF/PNG) e o carimbo preenche código, revisão e finalidade. As quantidades do desenho ficam na tela Take-off do projeto (spec 127); Conexões só para o super admin por enquanto.
 */
function Documentos() {
  const api = useApi();
  const qc = useQueryClient();
  const params = useSearchParams();
  const { pode, superadmin } = useObra();
  const planejador = pode('planejador');
  const [aba, setAba] = useState<Aba>('lista');
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');
  const [pacote, setPacote] = useState('');
  const [aberto, setAberto] = useState<number | null>(Number(params.get('doc')) || null);
  const lista = useQuery({ queryKey: ['documentos', 'lista'], queryFn: () => api.get<DocumentoResumo[]>('/documentos') });
  const opcoes = useQuery({ queryKey: ['documentos', 'opcoes'], queryFn: () => api.get<OpcoesDocumentos>('/documentos/opcoes'), staleTime: Infinity });
  const docs = lista.data ?? [];
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
        abas={[{ chave: 'lista', titulo: 'Lista de documentos (LDO)' }, { chave: 'grds', titulo: 'GRDs' }, { chave: 'conexoes', titulo: 'Conexões', visivel: superadmin },
          { chave: 'importar', titulo: 'Importar LDO', visivel: planejador }]} />

      {aba === 'lista' && (
        <>
          {planejador && <EnviarRevisao opcoes={opcoes.data} onEnviado={(id) => { atualizar(); setAberto(id); }} />}
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
      {aba === 'grds' && <Grds docs={docs} planejador={planejador} />}
      {aba === 'conexoes' && superadmin && <Conexoes onAbrir={setAberto} />}
      {aba === 'importar' && planejador && <ImportarLdo onPronto={atualizar} onAbrir={setAberto} />}
      {aberto && <DetalheDocumento id={aberto} opcoes={opcoes.data} documentos={docs} onFechar={() => setAberto(null)} onAbrir={setAberto} />}
    </>
  );
}

function EnviarRevisao({ opcoes, onEnviado }: { opcoes?: OpcoesDocumentos; onEnviado: (docId: number) => void }) {
  const api = useApi();
  const grds = useQuery({ queryKey: ['documentos', 'grds'], queryFn: () => api.get<GrdResumo[]>('/documentos/grds') });
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [f, setF] = useState({ codigo: '', revisao: '', finalidade: '', tipo: '', grd_id: '' });
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string[]>([]);
  const enviar = async () => {
    setEnviando(true); setResultado([]);
    const saida: string[] = [];
    let ultimo = 0;
    for (const a of arquivos) {
      const fd = new FormData();
      fd.append('arquivo', a, a.name);
      if (arquivos.length === 1 && f.codigo) fd.append('codigo', f.codigo);
      if (arquivos.length === 1 && f.revisao) fd.append('revisao', f.revisao);
      for (const k of ['finalidade', 'tipo', 'grd_id'] as const) if (f[k]) fd.append(k, f[k]);
      try {
        const r = await api.post<{ documento: { id: number; codigo: string }; revisao: { revisao: string; situacao: string; finalidade: string }; sugeridas: string[]; avisos: string[] }>('/documentos/revisoes', fd);
        ultimo = r.documento.id;
        saida.push(`✓ ${r.documento.codigo} rev. ${r.revisao.revisao} · ${r.revisao.finalidade} · ${SITUACAO[r.revisao.situacao as keyof typeof SITUACAO]?.rotulo ?? r.revisao.situacao}`
          + (r.sugeridas.length ? ` · frente sugerida: ${r.sugeridas.join(', ')}` : '') + (r.avisos.length ? ` · ${r.avisos.join(' · ')}` : ''));
      } catch (e) { saida.push(`✗ ${a.name}: ${(e as Error).message}`); }
    }
    setResultado(saida); setEnviando(false); setArquivos([]);
    if (ultimo && arquivos.length === 1) onEnviado(ultimo); else onEnviado(0);
  };
  return (
    <Painel titulo="Chegou revisão nova?" subtitulo="Envie o DWG, DXF ou PDF. Do DWG sai a folha para o campo, e o carimbo preenche código, revisão e finalidade; o que você digitar aqui tem prioridade.">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex h-11 cursor-pointer items-center gap-2 rounded-full border border-dashed border-m-stroke-strong px-4 text-[13px] font-semibold text-m-accent">
          <Upload size={16} /> {arquivos.length ? `${arquivos.length} arquivo(s)` : 'Escolher arquivos'}
          <input type="file" multiple accept=".dwg,.dxf,.pdf,.png,.jpg,.jpeg" className="sr-only" aria-label="Arquivos da revisão" onChange={(e) => setArquivos(Array.from(e.target.files ?? []))} />
        </label>
        {arquivos.length === 1 && <>
          <Campo rotulo="Código (se não tiver carimbo)" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} className="w-[200px]" />
          <Campo rotulo="Revisão" value={f.revisao} onChange={(e) => setF({ ...f, revisao: e.target.value })} className="w-[90px]" />
        </>}
        <Selecao rotulo="Finalidade" value={f.finalidade} onChange={(e) => setF({ ...f, finalidade: e.target.value })}>
          <option value="">a do carimbo</option>{(opcoes?.finalidades ?? []).map((x) => <option key={x}>{x}</option>)}
        </Selecao>
        <Selecao rotulo="Tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}><option value="">pelo arquivo</option>{Object.entries(opcoes?.tipos ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Selecao>
        <Selecao rotulo="Chegou na GRD" value={f.grd_id} onChange={(e) => setF({ ...f, grd_id: e.target.value })}><option value="">—</option>{(grds.data ?? []).filter((g) => g.sentido === 'recebida').map((g) => <option key={g.id} value={g.id}>{g.numero}{g.numero_externo ? ` (${g.numero_externo})` : ''}</option>)}</Selecao>
        <Botao disabled={!arquivos.length || enviando} onClick={enviar}><FileUp size={16} /> {enviando ? 'Convertendo…' : 'Enviar revisão'}</Botao>
      </div>
      {opcoes && !opcoes.conversor_dwg && <p className="mt-2 text-[12px] text-m-warning">O conversor de DWG não está ativo neste servidor: o DWG fica guardado, sem a folha para o campo.</p>}
      {resultado.length > 0 && <ul className="mt-3 flex flex-col gap-1 text-[13px]">{resultado.map((r, i) => <li key={i} className={r.startsWith('✗') ? 'text-m-danger' : 'text-m-text-secondary'}>{r}</li>)}</ul>}
    </Painel>
  );
}

function Grds({ docs, planejador }: { docs: DocumentoResumo[]; planejador: boolean }) {
  const api = useApi();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['documentos', 'grds'], queryFn: () => api.get<GrdResumo[]>('/documentos/grds') });
  const [nova, setNova] = useState(false);
  const [f, setF] = useState({ sentido: 'recebida', data: hoje(), remetente: '', destinatario: '', numero_externo: '', observacao: '' });
  const [itens, setItens] = useState<string[]>([]);
  const criar = async () => {
    try {
      const g = await api.post<{ numero: string }>('/documentos/grds', { ...f, numero_externo: f.numero_externo || null, observacao: f.observacao || null,
        itens: itens.map((x) => ({ documento_id: Number(x) })) });
      toast.success(`${g.numero} registrada`); setNova(false); setItens([]); qc.invalidateQueries({ queryKey: ['documentos'] });
    } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <Painel titulo="O que chegou e o que saiu?" subtitulo="GRD recebida: depois envie as revisões escolhendo a GRD. GRD emitida: as revisões vigentes que estão saindo, com a ciência de quem recebeu."
      acoes={planejador && <Botao onClick={() => setNova(!nova)}><Plus size={16} /> Nova GRD</Botao>}>
      {nova && (
        <div className="mb-4 flex flex-col gap-2 rounded-[16px] border border-m-stroke-subtle p-4">
          <div className="flex flex-wrap gap-2">
            <Chip ativo={f.sentido === 'recebida'} onClick={() => setF({ ...f, sentido: 'recebida' })}>Recebida</Chip>
            <Chip ativo={f.sentido === 'emitida'} onClick={() => setF({ ...f, sentido: 'emitida' })}>Emitida</Chip>
          </div>
          <div className="flex flex-wrap gap-2">
            <Campo rotulo="Data" type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
            <Campo rotulo="De" value={f.remetente} onChange={(e) => setF({ ...f, remetente: e.target.value })} placeholder="Projetista, cliente…" />
            <Campo rotulo="Para" value={f.destinatario} onChange={(e) => setF({ ...f, destinatario: e.target.value })} placeholder="Contratada, campo, fornecedor…" />
            <Campo rotulo="Nº da GRD de origem" value={f.numero_externo} onChange={(e) => setF({ ...f, numero_externo: e.target.value })} />
          </div>
          {f.sentido === 'emitida' && <MultiSelecao rotulo="Documentos (vai a revisão vigente)" largura="w-full" comNa={false} valor={itens}
            opcoes={docs.filter((d) => d.vigente).map((d) => ({ valor: String(d.id), rotulo: `${d.codigo} · rev ${d.vigente!.revisao} · ${d.titulo}` }))} onChange={setItens} />}
          <Campo rotulo="Observação" value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} />
          <div><Botao onClick={criar}>Registrar GRD</Botao></div>
        </div>
      )}
      <Tabela cabecalho={['GRD', 'Data', 'De → Para', 'Itens', 'Ciência', '']} vazio={q.isLoading ? CARREGANDO : !q.data?.length && 'Nenhuma GRD ainda.'}>
        {(q.data ?? []).map((g) => (
          <tr key={g.id}>
            <td className={td}><b className="text-m-text-primary">{g.numero}</b> <Pilula tom={g.sentido === 'recebida' ? 'info' : 'acento'}>{g.sentido}</Pilula>{g.numero_externo && <div className="text-[11px] text-m-text-muted">origem {g.numero_externo}</div>}</td>
            <td className={td}>{dataBR(g.data)}</td>
            <td className={td}>{g.remetente} → {g.destinatario}</td>
            <td className={td}>{g.itens}</td>
            <td className={td}>{g.ciente_por ? <span className="text-m-success">{g.ciente_por} · {dataBR(g.ciente_em)}</span>
              : <button type="button" className="flex items-center gap-1 font-semibold text-m-accent" onClick={async () => { await api.post(`/documentos/grds/${g.id}/ciencia`); qc.invalidateQueries({ queryKey: ['documentos', 'grds'] }); }}><CheckCheck size={15} /> dar ciência</button>}</td>
            <td className={`${td} text-right`}><button type="button" className="font-semibold text-m-accent" onClick={() => api.download(`/documentos/grds/${g.id}/xlsx`, `${g.numero}.xlsx`)}>Excel</button></td>
          </tr>
        ))}
      </Tabela>
    </Painel>
  );
}

function Conexoes({ onAbrir }: { onAbrir: (id: number) => void }) {
  const api = useApi();
  const q = useQuery({ queryKey: ['documentos', 'grafo'], queryFn: () => api.get<Grafo>('/documentos/grafo') });
  return (
    <Painel titulo="Como os documentos se ligam?" subtitulo="Cada documento com as frentes, os grupos de atividade e os documentos que ele referencia. As mesmas ligações vão nas notas .md do acervo da obra (abrem no graphify ou no Obsidian).">
      {q.data ? <GrafoDocumentos g={q.data} onAbrir={onAbrir} /> : <Carregando />}
    </Painel>
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
