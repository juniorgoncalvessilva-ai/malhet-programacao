'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownAZ, BookOpen, ChevronDown, ChevronRight, ClipboardList, Clock, Download, ExternalLink, FileSpreadsheet, FileText, Folder,
  Copy, FileX2, FolderCog, FolderOpen, RefreshCw, Home, Inbox, Link2, type LucideIcon, Maximize2, Paperclip, Ruler, ScrollText, Search, ShieldCheck, Upload, X } from 'lucide-react';
import { type DragEvent, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { VerRevisao } from '@/components/Documentos/VerRevisao';
import { Carregando } from '@/components/Obra/Esqueleto';
import { Botao, Chip, Pilula } from '@/components/Obra/ui';
import { useFrentes2 } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import { type DocumentoResumo, type NivelPasta, nomeArquivo, type OpcoesDocumentos, type PastaDoc, type Pastas, type RevisaoDoc, SITUACAO } from '@/lib/documentos';
import { useObra } from '@/lib/obra/ObraProvider';

const ICONE: Record<string, LucideIcon> = { LIS: FileSpreadsheet, DES: Ruler, ESP: ScrollText, MEM: ScrollText, PRO: ClipboardList, IT: ClipboardList, NOR: BookOpen, OUT: Paperclip };
const SEM: Record<NivelPasta, string> = { pacote: 'Sem pacote', frente: 'Sem frente', disciplina: 'Sem disciplina', tipo: 'Sem tipo', ano: 'Sem data' };
const DIAS_RECENTES = 15;
const quando = (iso?: string | null) => {
  if (!iso) return '—';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : dias < 30 ? `há ${dias} dias` : new Date(iso).toLocaleDateString('pt-BR');
};
/** O documento tem arquivo guardado (na vigente ou na última revisão)? Sem arquivo = só listado na LDO, esperando chegar. */
export const temArquivo = (d: DocumentoResumo) => !!(d.vigente?.formatos.includes('original') || d.ultima?.formatos.includes('original'));
const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/** Onde o explorador está: uma raiz (todos, recentes, sem pasta ou uma pasta) e os valores escolhidos em cada nível de subpasta. */
type Raiz = 'todos' | 'recentes' | 'sem' | 'sem_arquivo' | number;
interface Caminho { raiz: Raiz; partes: string[] }

/**
 * Explorador de documentos (spec 134) — o jeito dos softwares de GED: árvore de pastas à esquerda (a pasta-modelo da obra e as
 * subpastas que se abrem sozinhas por pacote, frente/CWA, disciplina, tipo ou ano), trilha e busca no topo, lista no meio e a
 * prévia da revisão que vale à direita (cópia controlada, tela cheia, PDF, baixar com o nome padrão, ficha). Arrastar arquivos
 * para a pasta aberta envia e casa com a LDO (spec 132). Nada é movido: pasta continua sendo regra (spec 129).
 */
export function ExploradorDocumentos({ docs, opcoes, onAbrir, onAcao, onGerenciar }: {
  docs: DocumentoResumo[]; opcoes?: OpcoesDocumentos; onAbrir: (id: number) => void; onAcao: (a: 'enviar' | 'ldo' | 'grd') => void; onGerenciar: () => void;
}) {
  const api = useApi();
  const qc = useQueryClient();
  const { pode } = useObra();
  const planejador = pode('planejador');
  const q = useQuery({ queryKey: ['documentos', 'pastas'], queryFn: () => api.get<Pastas>('/documentos/pastas') });
  const frentes = useFrentes2();
  const [cam, setCam] = useState<Caminho>({ raiz: 'todos', partes: [] });
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<number | null>(null);
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<'codigo' | 'recentes'>('codigo');
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [arvoreMovel, setArvoreMovel] = useState(false);

  const porId = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs]);
  const rotFrente = useMemo(() => {
    const m = new Map<number, string>();
    (frentes.data ?? []).forEach((l) => l.areas.forEach((a) => m.set(a.id, `${a.codigo} · ${a.descricao}`)));
    return m;
  }, [frentes.data]);
  const pastas = q.data?.pastas ?? [];
  const pastaDe = (r: Raiz) => (typeof r === 'number' ? pastas.find((p) => p.id === r) : undefined);
  const niveisDe = (r: Raiz): NivelPasta[] => pastaDe(r)?.subpastas ?? [];

  const valores = (d: DocumentoResumo, n: NivelPasta): string[] => {
    if (n === 'frente') return d.frentes?.length ? d.frentes.map((id) => rotFrente.get(id) ?? `Frente ${id}`) : [SEM.frente];
    if (n === 'pacote') return [d.pacote || SEM.pacote];
    if (n === 'disciplina') return [d.disciplina || d.disciplina_sigla || SEM.disciplina];
    if (n === 'tipo') return [d.tipo_nome || SEM.tipo];
    const data = d.vigente?.data_emissao ?? d.ultima?.data_emissao ?? d.atualizado_em;
    return [data ? data.slice(0, 4) : SEM.ano];
  };
  const daRaiz = (r: Raiz): DocumentoResumo[] => {
    if (r === 'todos') return docs;
    if (r === 'sem_arquivo') return docs.filter((d) => !temArquivo(d));
    if (r === 'recentes') return docs.filter((d) => d.atualizado_em && Date.now() - new Date(d.atualizado_em).getTime() < DIAS_RECENTES * 86_400_000);
    const ids = r === 'sem' ? q.data?.sem_pasta_ids ?? [] : pastaDe(r)?.membros ?? [];
    return ids.map((i) => porId.get(i)).filter((x): x is DocumentoResumo => !!x);
  };
  const filtrar = (c: Caminho) => {
    const nv = niveisDe(c.raiz);
    return daRaiz(c.raiz).filter((d) => c.partes.every((v, i) => valores(d, nv[i]).includes(v)));
  };
  const subpastas = (c: Caminho, lista: DocumentoResumo[]) => {
    const nv = niveisDe(c.raiz)[c.partes.length];
    if (!nv) return [];
    const m = new Map<string, number>();
    lista.forEach((d) => valores(d, nv).forEach((v) => m.set(v, (m.get(v) ?? 0) + 1)));
    return [...m.entries()].sort(([a], [b]) => (a.startsWith('Sem ') ? 1 : b.startsWith('Sem ') ? -1 : a.localeCompare(b, 'pt-BR', { numeric: true })));
  };

  const atual = filtrar(cam);
  const filhos = subpastas(cam, atual);
  const termos = norm(busca.trim());
  const lista = useMemo(() => {
    const base = termos ? docs.filter((d) => norm(`${d.codigo} ${d.codigo_contratada ?? ''} ${d.titulo} ${d.disciplina ?? ''} ${d.pacote ?? ''} ${d.local_texto ?? ''}`).includes(termos)) : atual;
    return [...base].sort((a, b) => (ordem === 'recentes' ? (b.atualizado_em ?? '').localeCompare(a.atualizado_em ?? '') : a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true })));
  }, [termos, docs, atual, ordem]);
  const selecionado = sel ? porId.get(sel) ?? null : null;
  const mostrarDocs = !!termos || !filhos.length;

  useEffect(() => { setSel(null); }, [cam]);
  const ir = (c: Caminho) => { setCam(c); setBusca(''); setArvoreMovel(false); };
  const chave = (c: Caminho) => `${c.raiz}|${c.partes.join('|')}`;
  const alternar = (k: string) => setAbertos((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const nomeRaiz = (r: Raiz) => (r === 'todos' ? 'Todos os documentos' : r === 'sem_arquivo' ? 'Sem arquivo (a receber)' : r === 'recentes' ? `Recentes (${DIAS_RECENTES} dias)` : r === 'sem' ? 'Sem pasta' : (() => { const p = pastaDe(r); return p ? `${p.codigo} · ${p.nome}` : 'Pasta'; })());
  const pastaAtual = pastaDe(cam.raiz);

  const enviar = async (arquivos: File[]) => {
    if (!arquivos.length) return;
    const tipo = pastaAtual && pastaAtual.tipos.length === 1 ? pastaAtual.tipos[0] : '';
    let ok = 0, relacionar = 0;
    for (const a of arquivos) {
      setEnviando(a.name);
      const fd = new FormData(); fd.append('arquivo', a, a.name); if (tipo) fd.append('tipo', tipo);
      try {
        const r = await api.post<{ resultado: 'associado' | 'a_relacionar' }>('/documentos/enviar', fd);
        if (r.resultado === 'associado') ok += 1; else relacionar += 1;
      } catch (e) { toast.error(`${a.name}: ${(e as Error).message}`); }
    }
    setEnviando(null);
    qc.invalidateQueries({ queryKey: ['documentos'] });
    if (ok) toast.success(`${ok} arquivo(s) guardado(s) e ligado(s) à lista`);
    if (relacionar) toast.warning(`${relacionar} arquivo(s) não casaram com a LDO`, { action: { label: 'Relacionar', onClick: () => onAcao('enviar') } });
  };
  const soltar = (e: DragEvent) => { e.preventDefault(); setArrastando(false); if (planejador) void enviar([...e.dataTransfer.files]); };

  if (!q.data) return <Carregando />;

  /** Um nó da árvore e, se aberto, os filhos (subpastas calculadas pelos níveis da pasta). */
  const No = ({ c, rotulo, icone: I, total, nivel }: { c: Caminho; rotulo: string; icone: LucideIcon; total: number; nivel: number }) => {
    const k = chave(c);
    const temFilhos = niveisDe(c.raiz).length > c.partes.length;
    const aberto = abertos.has(k);
    const ativo = chave(cam) === k;
    return (
      <li>
        <div className={`group flex items-center rounded-[8px] pr-2 ${ativo ? 'bg-m-accent-subtle text-m-accent' : 'text-m-text-secondary hover:bg-m-surface-hover'}`} style={{ paddingLeft: 4 + nivel * 14 }}>
          {temFilhos
            ? <button type="button" aria-label={`${aberto ? 'Recolher' : 'Abrir'} ${rotulo}`} aria-expanded={aberto} onClick={() => alternar(k)} className="grid h-7 w-6 shrink-0 place-items-center text-m-text-muted hover:text-m-accent">
                {aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
            : <span className="w-6 shrink-0" />}
          <button type="button" onClick={() => { ir(c); if (temFilhos && !aberto) alternar(k); }} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-[13px]" aria-current={ativo ? 'true' : undefined}>
            {ativo && temFilhos ? <FolderOpen size={15} strokeWidth={1.75} className="shrink-0 text-m-accent" /> : <I size={15} strokeWidth={1.75} className="shrink-0 text-m-accent" />}
            <span className={`min-w-0 flex-1 truncate ${ativo ? 'font-semibold' : ''}`} title={rotulo}>{rotulo}</span>
            <span className="shrink-0 text-[11px] tabular-nums text-m-text-muted">{total}</span>
          </button>
        </div>
        {temFilhos && aberto && (
          <ul>{subpastas(c, filtrar(c)).map(([v, n]) => <No key={v} c={{ raiz: c.raiz, partes: [...c.partes, v] }} rotulo={v} icone={Folder} total={n} nivel={nivel + 1} />)}</ul>
        )}
      </li>
    );
  };

  const recentes = daRaiz('recentes').length;
  const arvore = (
    <nav aria-label="Pastas de documentos" className="flex h-full flex-col gap-1 overflow-y-auto p-2">
      <ul className="flex flex-col">
        <No c={{ raiz: 'todos', partes: [] }} rotulo="Todos os documentos" icone={Home} total={docs.length} nivel={0} />
        <No c={{ raiz: 'recentes', partes: [] }} rotulo={`Recentes (${DIAS_RECENTES} dias)`} icone={Clock} total={recentes} nivel={0} />
        <No c={{ raiz: 'sem_arquivo', partes: [] }} rotulo="Sem arquivo (a receber)" icone={FileX2} total={docs.filter((d) => !temArquivo(d)).length} nivel={0} />
      </ul>
      <div className="mt-2 px-2 text-[11px] font-semibold uppercase tracking-[0.48px] text-m-text-muted">Pastas da obra</div>
      <ul className="flex flex-col">
        {pastas.map((p) => <No key={p.id} c={{ raiz: p.id, partes: [] }} rotulo={`${p.codigo} · ${p.nome}`} icone={ICONE[p.tipos[0]] ?? Folder} total={p.documentos} nivel={0} />)}
        {q.data.sem_pasta > 0 && <No c={{ raiz: 'sem', partes: [] }} rotulo="Sem pasta" icone={Inbox} total={q.data.sem_pasta} nivel={0} />}
      </ul>
      {planejador && <button type="button" onClick={onGerenciar} className="mt-auto flex items-center gap-2 rounded-[8px] px-2 py-2 text-[12.5px] font-semibold text-m-accent hover:bg-m-surface-hover">
        <FolderCog size={15} strokeWidth={1.75} /> Gerenciar pastas e subpastas</button>}
    </nav>
  );

  const trilha = [{ rotulo: nomeRaiz(cam.raiz), c: { raiz: cam.raiz, partes: [] as string[] } },
    ...cam.partes.map((v, i) => ({ rotulo: v, c: { raiz: cam.raiz, partes: cam.partes.slice(0, i + 1) } }))];

  return (
    <div className="flex flex-col gap-3">
      {/* barra: trilha, busca, ordem e enviar */}
      <div className="flex flex-wrap items-center gap-2 rounded-m-lg border border-m-stroke-subtle bg-m-surface-raised px-3 py-2">
        <button type="button" className="rounded-full border border-m-stroke px-3 py-1.5 text-[12.5px] font-semibold text-m-text-secondary lg:hidden" onClick={() => setArvoreMovel(true)}>
          <Folder size={14} className="mr-1 inline" /> Pastas</button>
        <nav aria-label="Trilha da pasta" className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-[13px]">
          <button type="button" onClick={() => ir({ raiz: 'todos', partes: [] })} className="text-m-text-muted hover:text-m-accent" aria-label="Início"><Home size={14} /></button>
          {(cam.raiz !== 'todos' || cam.partes.length > 0) && trilha.map((t, i) => (
            <span key={i} className="flex min-w-0 items-center gap-1">
              <ChevronRight size={13} className="text-m-text-muted" />
              {i === trilha.length - 1 ? <span className="truncate font-semibold text-m-text-primary">{t.rotulo}</span>
                : <button type="button" onClick={() => ir(t.c)} className="truncate text-m-text-secondary hover:text-m-accent">{t.rotulo}</button>}
            </span>
          ))}
          {cam.raiz === 'todos' && !cam.partes.length && <span className="font-semibold text-m-text-primary">Todos os documentos</span>}
        </nav>
        <label className="flex h-9 w-full items-center gap-2 rounded-full border border-m-stroke bg-m-surface-field px-3 sm:w-[280px]">
          <Search size={15} className="text-m-text-muted" />
          <input aria-label="Buscar em todos os documentos" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar código, título, disciplina…" className="w-full border-0 bg-transparent p-0 text-[13px] outline-none focus:ring-0" />
          {busca && <button type="button" aria-label="Limpar busca" onClick={() => setBusca('')}><X size={14} className="text-m-text-muted" /></button>}
        </label>
        <Chip ativo={ordem === 'codigo'} onClick={() => setOrdem('codigo')}><ArrowDownAZ size={13} className="mr-1 inline" />Código</Chip>
        <Chip ativo={ordem === 'recentes'} onClick={() => setOrdem('recentes')}><Clock size={13} className="mr-1 inline" />Recentes</Chip>
        {planejador && (
          <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-m-accent-strong px-4 text-[13px] font-semibold text-m-on-accent">
            <Upload size={15} /> {enviando ? 'Enviando…' : 'Enviar aqui'}
            <input type="file" multiple className="sr-only" aria-label="Enviar arquivos para esta pasta" disabled={!!enviando}
              onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ''; void enviar(f); }} />
          </label>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)_400px]">
        {/* árvore */}
        <aside className="hidden h-[calc(100vh-300px)] min-h-[520px] rounded-m-lg border border-m-stroke-subtle bg-m-surface-raised lg:block">{arvore}</aside>
        {arvoreMovel && (
          <div className="fixed inset-0 z-[120] flex lg:hidden" role="dialog" aria-label="Pastas">
            <div className="h-full w-[85%] max-w-[340px] bg-m-surface-raised shadow-xl">{arvore}</div>
            <button type="button" aria-label="Fechar pastas" className="flex-1 bg-black/40" onClick={() => setArvoreMovel(false)} />
          </div>
        )}

        {/* lista */}
        <section onDragOver={(e) => { if (planejador) { e.preventDefault(); setArrastando(true); } }} onDragLeave={() => setArrastando(false)} onDrop={soltar}
          className={`relative flex h-[calc(100vh-300px)] min-h-[520px] flex-col overflow-hidden rounded-m-lg border bg-m-surface-raised ${arrastando ? 'border-2 border-dashed border-m-accent' : 'border-m-stroke-subtle'}`}>
          <div className="flex items-center justify-between gap-2 border-b border-m-stroke-subtle px-4 py-2.5">
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold text-m-text-primary">{termos ? `Busca: "${busca.trim()}"` : trilha[trilha.length - 1].rotulo}</div>
              <div className="text-[11.5px] text-m-text-muted">
                {termos ? `${lista.length} documento(s) em todas as pastas` : `${filhos.length ? `${filhos.length} subpasta(s) · ` : ''}${atual.length} documento(s)`}
                {pastaAtual && !termos && ` · ${pastaAtual.natureza === 'registro' ? 'Registro' : 'Documento'} · guarda: ${pastaAtual.responsavel ?? '—'}`}
              </div>
            </div>
            {pastaAtual && !termos && pastaAtual.subpastas.length > 0 && <span className="hidden shrink-0 text-[11px] text-m-text-muted md:block">abre por {pastaAtual.subpastas.map((n) => q.data.niveis[n]?.split(' (')[0].toLowerCase()).join(' → ')}</span>}
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead className="sticky top-0 z-[1] bg-m-surface-raised">
                <tr className="border-b border-m-stroke-subtle text-left text-[11px] uppercase tracking-[0.48px] text-m-text-muted">
                  <th className="px-4 py-2 font-semibold">Nome</th><th className="px-2 py-2 font-semibold">Vale no campo</th>
                  <th className="hidden px-2 py-2 font-semibold md:table-cell">Última revisão</th><th className="hidden px-2 py-2 font-semibold xl:table-cell">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {!termos && filhos.map(([v, n]) => (
                  <tr key={`p:${v}`} className="cursor-pointer border-b border-m-row hover:bg-m-surface-hover" onDoubleClick={() => ir({ raiz: cam.raiz, partes: [...cam.partes, v] })}
                    onClick={() => ir({ raiz: cam.raiz, partes: [...cam.partes, v] })}>
                    <td className="px-4 py-2" colSpan={4}><span className="flex items-center gap-2.5"><Folder size={18} strokeWidth={1.75} className="text-m-warning" fill="currentColor" fillOpacity={0.18} />
                      <span className="font-medium text-m-text-primary">{v}</span><span className="text-[11.5px] text-m-text-muted">{n} doc.</span></span></td>
                  </tr>
                ))}
                {mostrarDocs && lista.map((d) => {
                  const I = ICONE[d.tipo] ?? FileText;
                  return (
                    <tr key={d.id} tabIndex={0} aria-selected={sel === d.id} onClick={() => setSel(d.id)} onDoubleClick={() => onAbrir(d.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') onAbrir(d.id); if (e.key === ' ') { e.preventDefault(); setSel(d.id); } }}
                      className={`cursor-pointer border-b border-m-row outline-none focus-visible:bg-m-surface-hover ${sel === d.id ? 'bg-m-accent-subtle' : 'hover:bg-m-surface-hover'}`}>
                      <td className="px-4 py-2"><span className="flex items-start gap-2.5"><I size={17} strokeWidth={1.75} className="mt-0.5 shrink-0 text-m-accent" />
                        <span className="min-w-0"><span className="font-semibold text-m-text-primary">{d.codigo}</span>
                          <span className="block max-w-[520px] truncate text-[12px] text-m-text-tertiary" title={d.titulo}>{d.titulo}</span>
                          {!temArquivo(d) && <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-m-warning"><FileX2 size={12} /> sem arquivo</span>}</span></span></td>
                      <td className="whitespace-nowrap px-2 py-2">{d.vigente ? <Pilula tom="sucesso">Rev. {d.vigente.revisao}</Pilula> : <Pilula tom="atencao">Sem liberada</Pilula>}</td>
                      <td className="hidden whitespace-nowrap px-2 py-2 md:table-cell">{d.ultima ? <>Rev. {d.ultima.revisao} <Pilula tom={SITUACAO[d.ultima.situacao].tom}>{SITUACAO[d.ultima.situacao].rotulo}</Pilula></> : '—'}</td>
                      <td className="hidden whitespace-nowrap px-2 py-2 text-[12px] text-m-text-muted xl:table-cell">{quando(d.atualizado_em)}</td>
                    </tr>
                  );
                })}
                {!termos && filhos.length > 0 && (
                  <tr><td colSpan={4} className="px-4 py-2 text-[12px] text-m-text-muted">Os {atual.length} documentos estão nas subpastas acima. Use a busca para achar em todas as pastas.</td></tr>
                )}
              </tbody>
            </table>
            {mostrarDocs && !lista.length && (
              <div className="grid place-items-center gap-2 p-10 text-center text-[13px] text-m-text-muted">
                <FolderOpen size={28} strokeWidth={1.5} />{termos ? 'Nada encontrado.' : 'Pasta vazia.'}{planejador && !termos && ' Arraste arquivos para cá para guardar.'}
              </div>
            )}
          </div>
          {arrastando && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-m-accent-subtle/80 text-[14px] font-semibold text-m-accent">Solte para guardar em {trilha[0].rotulo}</div>}
          {enviando && <div className="border-t border-m-stroke-subtle px-4 py-2 text-[12px] text-m-text-muted">Enviando {enviando}…</div>}
        </section>

        {/* prévia */}
        {selecionado
          ? <Previa d={selecionado} rotFrente={rotFrente} finalidades={opcoes?.finalidades ?? []} onFechar={() => setSel(null)} onAbrir={onAbrir} />
          : <aside className="hidden h-[calc(100vh-300px)] min-h-[520px] flex-col items-center justify-center gap-2 rounded-m-lg border border-dashed border-m-stroke p-6 text-center text-[13px] text-m-text-muted 2xl:flex">
              <FileText size={28} strokeWidth={1.5} />Clique num documento para ver a folha e os dados aqui.<span className="text-[12px]">Duplo clique abre a ficha com o histórico.</span>
            </aside>}
      </div>
    </div>
  );
}

/** Prévia ao lado da lista: a folha da revisão que vale (cada abertura fica registrada como leitura), carimbo e os dados. */
function Previa({ d, rotFrente, finalidades, onFechar, onAbrir }: {
  d: DocumentoResumo; rotFrente: Map<number, string>; finalidades: string[]; onFechar: () => void; onAbrir: (id: number) => void;
}) {
  const api = useApi();
  const { obra } = useObra();
  const r: RevisaoDoc | null = d.vigente ?? d.ultima;
  const [url, setUrl] = useState<string | null>(null);
  const [tipoUrl, setTipoUrl] = useState<'png' | 'pdf' | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [cheia, setCheia] = useState(false);
  useEffect(() => {
    let u: string | null = null;
    let vivo = true;
    setUrl(null); setTipoUrl(null);
    const formato = r?.formatos.includes('png') ? 'png' : r?.formatos.includes('pdf') ? 'pdf' : null;
    if (r && formato) {
      setCarregando(true);
      api.blob(`/documentos/revisoes/${r.id}/arquivo?formato=${formato}`)
        .then((b) => { if (!vivo) return; u = URL.createObjectURL(b); setUrl(u); setTipoUrl(formato); })
        .catch(() => undefined).finally(() => vivo && setCarregando(false));
    }
    return () => { vivo = false; if (u) URL.revokeObjectURL(u); };
  }, [r?.id, r?.formatos.join(','), r?.enviado_em]); // eslint-disable-line react-hooks/exhaustive-deps
  const arquivo = (formato: string) => () => api.blob(`/documentos/revisoes/${r!.id}/arquivo?formato=${formato}`);
  const baixar = () => r && api.download(`/documentos/revisoes/${r.id}/arquivo?formato=original&baixar=true`,
    nomeArquivo(obra?.codigo, d.codigo, r.revisao, r.finalidade, (r.nome_original ?? '').split('.').pop() || 'pdf'));
  const abrirPdf = async () => { try { const b = await arquivo('pdf')(); window.open(URL.createObjectURL(b), '_blank'); } catch (e) { toast.error((e as Error).message); } };
  const copiar = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?doc=${d.id}`); toast.success('Link do documento copiado'); }
    catch { toast.error('Não deu para copiar'); }
  };
  const comArquivo = !!r?.formatos.includes('original');
  const controlada = comArquivo && r && d.vigente && r.id === d.vigente.id;
  const dados: [string, React.ReactNode][] = [
    ['Tipo', d.tipo_nome], ['Disciplina', d.disciplina ?? d.disciplina_sigla ?? '—'], ['Pacote', d.pacote ?? '—'],
    ['Frentes', d.frentes?.length ? d.frentes.map((id) => rotFrente.get(id) ?? id).join(' · ') : <span className="text-m-text-muted">nenhuma confirmada</span>],
    ['Vigente', d.vigente ? `Rev. ${d.vigente.revisao} · ${d.vigente.finalidade}${d.vigente.data_emissao ? ` · ${new Date(d.vigente.data_emissao).toLocaleDateString('pt-BR')}` : ''}` : <span className="text-m-warning">sem revisão liberada</span>],
    ['Última', d.ultima ? <>Rev. {d.ultima.revisao} <Pilula tom={SITUACAO[d.ultima.situacao].tom}>{SITUACAO[d.ultima.situacao].rotulo}</Pilula></> : '—'],
    ['Revisões', d.revisoes], ['Enviada', r?.enviado_em ? `${quando(r.enviado_em)} · ${r.enviado_por}` : '—'],
    ...(d.codigo_contratada ? [['Cód. contratada', d.codigo_contratada] as [string, React.ReactNode]] : []),
    ...(d.local_texto ? [['Local (LDO)', d.local_texto] as [string, React.ReactNode]] : []),
  ];
  return (
    <aside aria-label={`Prévia de ${d.codigo}`} className="fixed inset-y-0 right-0 z-[110] flex w-full max-w-[420px] flex-col overflow-hidden border-l border-m-stroke-subtle bg-m-surface-raised shadow-xl 2xl:static 2xl:z-auto 2xl:h-[calc(100vh-300px)] 2xl:min-h-[520px] 2xl:max-w-none 2xl:rounded-m-lg 2xl:border 2xl:shadow-none">
      <div className="flex items-start gap-2 border-b border-m-stroke-subtle px-4 py-3">
        <div className="min-w-0 flex-1"><div className="font-semibold text-m-text-primary">{d.codigo}</div><div className="text-[12px] text-m-text-tertiary">{d.titulo}</div></div>
        <button type="button" aria-label="Fechar prévia" onClick={onFechar} className="grid h-8 w-8 place-items-center rounded-full text-m-text-muted hover:bg-m-surface-hover"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="relative m-3 grid min-h-[220px] place-items-center overflow-hidden rounded-m-md border border-m-stroke-subtle bg-white">
          {url && tipoUrl === 'png' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`Folha ${d.codigo}`} className="max-h-[360px] w-full cursor-zoom-in object-contain" onClick={() => setCheia(true)} />
          )}
          {url && tipoUrl === 'pdf' && <iframe src={url} title={`PDF ${d.codigo}`} className="h-[360px] w-full" />}
          {!url && <span className="p-6 text-center text-[12.5px] text-m-text-muted">{carregando ? 'Abrindo a folha…' : comArquivo ? 'Sem visualização desta revisão: baixe o original.'
            : r ? `Ainda sem arquivo: a revisão ${r.revisao} está na LDO esperando o arquivo.` : 'Ainda sem arquivo (só na LDO).'}</span>}
          {r && comArquivo && (url || !carregando) && (
            <span className={`pointer-events-none absolute left-2 top-2 rotate-[-3deg] rounded-[4px] border-2 px-2 py-0.5 font-mono text-[10.5px] font-extrabold uppercase tracking-[0.14em] ${controlada ? 'border-m-danger/80 bg-white/85 text-m-danger' : 'border-m-warning bg-white/85 text-m-warning'}`}>
              {controlada ? 'Cópia controlada' : r.situacao === 'superada' || r.situacao === 'cancelada' ? 'Documento obsoleto' : 'Não liberada'}
            </span>
          )}
        </div>
        <ArquivoDoDocumento d={d} r={r} comArquivo={comArquivo} finalidades={finalidades} />
        <div className="flex flex-wrap gap-2 px-3">
          {r?.formatos.includes('png') && <Botao variante="secundario" className="h-8 px-3" onClick={() => setCheia(true)}><Maximize2 size={14} /> Tela cheia</Botao>}
          {r?.formatos.includes('pdf') && <Botao variante="secundario" className="h-8 px-3" onClick={abrirPdf}><ExternalLink size={14} /> PDF</Botao>}
          {r?.formatos.includes('original') && <Botao variante="secundario" className="h-8 px-3" onClick={() => void baixar()}><Download size={14} /> Baixar</Botao>}
          <Botao variante="secundario" className="h-8 px-3" onClick={() => onAbrir(d.id)}><ScrollText size={14} /> Ficha e histórico</Botao>
          <Botao variante="fantasma" className="h-8 px-3" onClick={copiar}><Link2 size={14} /> Copiar link</Botao>
        </div>
        <dl className="m-3 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
          {dados.map(([k, v]) => <div key={k} className="contents"><dt className="text-m-text-muted">{k}</dt><dd className="min-w-0 break-words text-m-text-primary">{v}</dd></div>)}
        </dl>
        <p className="mx-3 mb-3 flex items-start gap-1.5 rounded-m-md bg-m-surface-base p-2.5 text-[11.5px] text-m-text-muted">
          <ShieldCheck size={14} className="mt-px shrink-0 text-m-success" />
          {controlada ? 'Esta é a revisão que vale no campo. Cada abertura fica registrada (quem, quando, por onde) — ISO 9001 7.5.' : 'Esta revisão não libera o uso: no campo só aparece a revisão vigente.'}
        </p>
      </div>
      {cheia && r && <VerRevisao carimbo={controlada ? 'controlada' : r.situacao === 'superada' || r.situacao === 'cancelada' ? 'obsoleto' : undefined}
        titulo={`${d.codigo} · rev. ${r.revisao}`} sub={d.titulo} onFechar={() => setCheia(false)}
        png={r.formatos.includes('png') ? arquivo('png') : undefined} pdf={r.formatos.includes('pdf') ? arquivo('pdf') : undefined}
        original={r.formatos.includes('original') ? () => baixar()!.then(() => undefined) : undefined} />}
    </aside>
  );
}


/** A revisão que vem depois: 0 → 1, A → B, Z → AA (igual a `domain/documento.py::proxima_revisao`). */
export function proximaRevisao(rev?: string | null): string {
  if (!rev) return '0';
  const r = rev.trim().toUpperCase().replace(/^(REV\.?|R)\s*/, '');
  if (/^\d+$/.test(r)) return String(Number(r) + 1);
  if (/^[A-Z]+$/.test(r)) {
    const l = r.split('');
    let i = l.length - 1;
    while (i >= 0 && l[i] === 'Z') { l[i] = 'A'; i -= 1; }
    if (i < 0) return 'A'.repeat(r.length + 1);
    l[i] = String.fromCharCode(l[i].charCodeAt(0) + 1);
    return l.join('');
  }
  return `${r}1`;
}

/**
 * Enviar ou atualizar o arquivo do documento (spec 135). Sem arquivo: "Enviar arquivo" põe o arquivo na revisão que a LDO
 * listou. Com arquivo: "Atualizar arquivo" sobe a revisão (a seguinte já vem sugerida) ou corrige o arquivo da mesma revisão —
 * com motivo, e o anterior fica guardado no histórico. "Copiar código" ajuda a procurar o arquivo na rede.
 */
function ArquivoDoDocumento({ d, r, comArquivo, finalidades }: { d: DocumentoResumo; r: RevisaoDoc | null; comArquivo: boolean; finalidades: string[] }) {
  const api = useApi();
  const qc = useQueryClient();
  const { pode } = useObra();
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<'nova' | 'mesma'>('nova');
  const mais = d.ultima?.revisao ?? r?.revisao ?? null;
  const [rev, setRev] = useState(proximaRevisao(mais));
  const [finalidade, setFinalidade] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  // outro documento, ou depois de enviar: volta ao começo com a revisão seguinte já sugerida
  useEffect(() => { setAberto(false); setModo('nova'); setRev(proximaRevisao(d.ultima?.revisao ?? r?.revisao)); setMotivo(''); setFinalidade(''); },
    [d.id, d.ultima?.revisao, d.ultima?.enviado_em]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pode('planejador')) return null;
  const copiarCodigo = async () => {
    try { await navigator.clipboard.writeText(d.codigo); toast.success(`${d.codigo} copiado: cole na busca da pasta da rede`); } catch { toast.error('Não deu para copiar'); }
  };
  const enviar = async (f: File | undefined, m: 'nova' | 'mesma') => {
    if (!f) return;
    const fd = new FormData();
    fd.append('arquivo', f, f.name); fd.append('modo', m);
    if (m === 'mesma' && r) fd.append('revisao', r.revisao);
    if (m === 'nova') { fd.append('revisao', rev); if (finalidade) fd.append('finalidade', finalidade); }
    if (motivo.trim()) fd.append('motivo', motivo.trim());
    setEnviando(true);
    try {
      const x = await api.post<{ revisao: RevisaoDoc; avisos: string[]; substituido: boolean }>(`/documentos/${d.id}/arquivo`, fd);
      toast.success(x.substituido ? `Arquivo da rev. ${x.revisao.revisao} corrigido (o anterior ficou no histórico)` : `Rev. ${x.revisao.revisao} guardada com o arquivo`);
      x.avisos.forEach((a) => toast.warning(a));
      setAberto(false); setMotivo(''); setModo('nova');
      qc.invalidateQueries({ queryKey: ['documentos'] });
    } catch (e) { toast.error((e as Error).message); } finally { setEnviando(false); }
  };
  const botaoArquivo = (rotulo: string, m: 'nova' | 'mesma', desabilitado = false) => (
    <label className={`flex h-9 w-fit items-center gap-1.5 rounded-full bg-m-accent-strong px-4 text-[13px] font-semibold text-m-on-accent ${desabilitado || enviando ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
      <Upload size={15} /> {enviando ? 'Enviando…' : rotulo}
      <input type="file" className="sr-only" aria-label={rotulo} disabled={desabilitado || enviando}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void enviar(f, m); }} />
    </label>
  );

  if (!comArquivo) {
    return (
      <div className="mx-3 mb-3 flex flex-col gap-2 rounded-m-md border border-dashed border-m-warning bg-m-warning-subtle p-3">
        <div className="text-[12.5px] text-m-text-primary">Ainda não tem arquivo. Procure na rede por <b className="font-mono">{d.codigo}</b>{d.codigo_contratada ? <> ou <b className="font-mono">{d.codigo_contratada}</b></> : null} e envie aqui.</div>
        <div className="flex flex-wrap items-center gap-2">
          {botaoArquivo(r ? `Enviar arquivo da rev. ${r.revisao}` : 'Enviar arquivo', r ? 'mesma' : 'nova')}
          <Botao variante="fantasma" className="h-9 px-3" onClick={copiarCodigo}><Copy size={14} /> Copiar código</Botao>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-3 mb-3 flex flex-col gap-2">
      {!aberto
        ? <div className="flex flex-wrap items-center gap-2">
            <Botao className="h-9 px-4" onClick={() => setAberto(true)}><RefreshCw size={14} /> Atualizar arquivo</Botao>
            <Botao variante="fantasma" className="h-9 px-3" onClick={copiarCodigo}><Copy size={14} /> Copiar código</Botao>
          </div>
        : <div className="flex flex-col gap-2.5 rounded-m-md border border-m-stroke-subtle bg-m-surface-base p-3 text-[12.5px]">
            <div className="flex items-center justify-between"><b className="text-m-text-primary">Atualizar o arquivo de {d.codigo}</b>
              <button type="button" aria-label="Fechar atualizar" onClick={() => setAberto(false)} className="text-m-text-muted"><X size={15} /></button></div>
            <label className="flex items-start gap-2"><input type="radio" name={`modo-${d.id}`} checked={modo === 'nova'} onChange={() => setModo('nova')} className="mt-0.5" />
              <span><b>Nova revisão</b> — o projeto mudou; a anterior vira superada quando esta liberar o uso.</span></label>
            {modo === 'nova' && (
              <div className="ml-6 flex flex-wrap gap-2">
                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.48px] text-m-text-muted">Revisão
                  <input value={rev} onChange={(e) => setRev(e.target.value.toUpperCase())} aria-label="Revisão nova" className="h-8 w-20 rounded-[8px] border border-m-stroke bg-m-surface-field px-2 text-[13px] font-normal normal-case text-m-text-primary" /></label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.48px] text-m-text-muted">Finalidade
                  <select value={finalidade} onChange={(e) => setFinalidade(e.target.value)} aria-label="Finalidade da revisão nova" className="h-8 rounded-[8px] border border-m-stroke bg-m-surface-field px-2 text-[13px] font-normal normal-case text-m-text-primary">
                    <option value="">a do carimbo</option>{finalidades.map((f) => <option key={f}>{f}</option>)}
                  </select></label>
              </div>
            )}
            {r && <label className="flex items-start gap-2"><input type="radio" name={`modo-${d.id}`} checked={modo === 'mesma'} onChange={() => setModo('mesma')} className="mt-0.5" />
              <span><b>Corrigir o arquivo da rev. {r.revisao}</b> — mesma revisão (arquivo errado ou incompleto); o anterior fica guardado no histórico.</span></label>}
            {modo === 'mesma' && (
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por que está trocando? (ex.: folha errada)" aria-label="Motivo da correção"
                className="ml-6 h-8 rounded-[8px] border border-m-stroke bg-m-surface-field px-2 text-[13px]" />
            )}
            <div className="ml-6">{botaoArquivo(modo === 'nova' ? `Escolher arquivo da rev. ${rev || '?'}` : `Escolher arquivo corrigido`, modo,
              modo === 'nova' ? !rev.trim() : motivo.trim().length < 5)}</div>
          </div>}
    </div>
  );
}
