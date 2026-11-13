'use client';

import { useQuery } from '@tanstack/react-query';
import { Printer, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Abas } from '@/components/Obra/Abas';
import { LogosObra } from '@/components/Obra/LogosObra';
import { Botao, Cabecalho, Campo, Painel, Selecao } from '@/components/Obra/ui';
import { useFrentes2 } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';

type Tipo = 'atividade' | 'ocorrencia' | 'restricao';
type Agrupar = 'frente' | 'atividade' | 'data';
interface FotoBook {
  id: number; tipo: Tipo; data: string; area_id: number | null; area: string; local: string | null; atividade: string | null;
  cwp: string | null; equipe: string | null; titulo: string | null; causa: string | null; acao?: string | null; status?: string;
  legenda: string | null; enviado_em: string | null;
}

const dataBR = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
const menos = (dias: number) => { const d = new Date(Date.now() - dias * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function useFoto(id: number) {
  const api = useApi();
  return useQuery({ queryKey: ['foto', id], queryFn: async () => URL.createObjectURL(await api.blob(`/fotos/${id}/arquivo`)), staleTime: Infinity });
}

function Cartao({ f, onAbrir }: { f: FotoBook; onAbrir: () => void }) {
  const url = useFoto(f.id).data;
  return (
    <figure className="flex break-inside-avoid flex-col overflow-hidden rounded-m-md border border-m-stroke-subtle bg-m-surface-raised">
      <button type="button" onClick={onAbrir} aria-label="Ver a foto ampliada" className="aspect-[4/3] w-full bg-m-surface-active">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt={f.titulo ?? f.atividade ?? 'Foto de campo'} className="h-full w-full object-cover" /> : <span className="block h-full w-full animate-pulse" />}
      </button>
      <figcaption className="flex flex-col gap-0.5 p-2.5 text-[12px] leading-4">
        <span className="font-semibold text-m-text-primary">{dataBR(f.data)}{f.enviado_em ? ` · ${hora(f.enviado_em)}` : ''}</span>
        {f.causa && <span className="font-semibold uppercase tracking-[0.3px] text-m-warning">{f.causa}</span>}
        {f.titulo && <span className="text-m-text-primary">{f.titulo}</span>}
        {f.atividade && <span className="text-m-text-secondary">{f.atividade}</span>}
        {f.cwp && <span className="text-m-info">CWP {f.cwp}</span>}
        <span className="text-m-text-muted">{f.area}{f.equipe ? ` · ${f.equipe}` : ''}</span>
        {f.acao && <span className="text-m-text-secondary">Ação: {f.acao}</span>}
        {f.legenda && <span className="italic text-m-text-secondary">{f.legenda}</span>}
      </figcaption>
    </figure>
  );
}

function Ampliada({ f, onFechar }: { f: FotoBook; onFechar: () => void }) {
  const url = useFoto(f.id).data;
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc); }, [onFechar]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Foto ampliada" className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-black/85 p-4 print:hidden" onClick={onFechar}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt={f.titulo ?? f.atividade ?? 'Foto'} className="max-h-[80vh] max-w-full rounded-m-md" />}
      <p className="max-w-3xl text-center text-[13px] text-white">{dataBR(f.data)} · {f.area}{f.atividade ? ` · ${f.atividade}` : ''}{f.titulo ? ` · ${f.titulo}` : ''}</p>
      <button type="button" aria-label="Fechar" className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white"><X size={22} /></button>
    </div>
  );
}

/**
 * Book de fotos (spec 062): fotos das atividades (frente, atividade, dia de execução), das ocorrências e das restrições,
 * agrupadas por frente, atividade ou data, com filtros e impressão com as logos da obra.
 */
export default function BookFotosPage() {
  const api = useApi();
  const { obra } = useObra();
  const frentes = useFrentes2();
  const [tipo, setTipo] = useState<Tipo>('atividade');
  const [agrupar, setAgrupar] = useState<Agrupar>('frente');
  const [de, setDe] = useState(menos(30));
  const [ate, setAte] = useState(menos(0));
  const [area, setArea] = useState('');
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<FotoBook | null>(null);
  const q = useQuery({
    queryKey: ['fotos', 'book', tipo, de, ate, area],
    queryFn: () => api.get<FotoBook[]>(`/fotos/book?tipo=${tipo}${de ? `&de=${de}` : ''}${ate ? `&ate=${ate}` : ''}${area ? `&area_id=${area}` : ''}`),
  });
  const fotos = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (q.data ?? []).filter((f) => !t || [f.area, f.local, f.atividade, f.titulo, f.causa, f.cwp, f.equipe, f.legenda].some((x) => x?.toLowerCase().includes(t)));
  }, [q.data, busca]);

  // grupos de 1º e 2º nível conforme o agrupamento (sempre mais novo primeiro dentro de cada um)
  const grupos = useMemo(() => {
    const chave1 = (f: FotoBook) => (agrupar === 'frente' ? `${f.local ? `${f.local} › ` : ''}${f.area}` : agrupar === 'atividade' ? (f.atividade ?? f.causa ?? 'Sem atividade') : f.data);
    const chave2 = (f: FotoBook) => (agrupar === 'data' ? `${f.local ? `${f.local} › ` : ''}${f.area}` : agrupar === 'frente' ? (tipo === 'ocorrencia' ? (f.causa ?? 'Sem causa') : (f.atividade ?? 'Sem atividade')) : f.data);
    const m = new Map<string, Map<string, FotoBook[]>>();
    for (const f of fotos) {
      const a = m.get(chave1(f)) ?? new Map<string, FotoBook[]>();
      a.set(chave2(f), [...(a.get(chave2(f)) ?? []), f]);
      m.set(chave1(f), a);
    }
    const ord = (x: string, y: string) => (agrupar === 'data' ? y.localeCompare(x) : x.localeCompare(y, 'pt-BR', { numeric: true }));
    return [...m.entries()].sort((x, y) => ord(x[0], y[0]))
      .map(([k, sub]) => [k, [...sub.entries()].sort((x, y) => (agrupar === 'data' ? x[0].localeCompare(y[0], 'pt-BR', { numeric: true }) : y[0].localeCompare(x[0])))] as const);
  }, [fotos, agrupar, tipo]);
  const rot = (k: string, nivel: 1 | 2) => ((agrupar === 'data' && nivel === 1) || (agrupar !== 'data' && nivel === 2 && /^\d{4}-\d\d-\d\d$/.test(k)) ? dataBR(k) : k);
  const areas = (frentes.data ?? []).flatMap((l) => l.areas.map((a) => ({ id: a.id, rotulo: `${l.codigo} › ${a.codigo} · ${a.descricao}` })));
  const nomeTipo = { atividade: 'atividades', ocorrencia: 'ocorrências', restricao: 'restrições' }[tipo];

  return (
    <>
      <div className="print:hidden">
        <Cabecalho eyebrow="Campo · evidências" titulo="Book de fotos"
          acoes={<Botao variante="secundario" onClick={() => window.print()} disabled={!fotos.length}><Printer size={16} /> Imprimir book</Botao>} />
      </div>
      <div className="print:hidden">
        <Abas rotulo="Tipo de foto" ativa={tipo} onTrocar={setTipo}
          abas={[{ chave: 'atividade', titulo: 'Atividades' }, { chave: 'ocorrencia', titulo: 'Ocorrências' }, { chave: 'restricao', titulo: 'Restrições' }]} />
      </div>
      <Painel titulo={<span className="print:hidden">Filtros</span>} className="print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <Campo rotulo="De" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          <Campo rotulo="Até" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          <Selecao rotulo="Frente" value={area} onChange={(e) => setArea(e.target.value)} className="min-w-[260px]">
            <option value="">Todas as frentes</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.rotulo}</option>)}
          </Selecao>
          <Campo rotulo="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="atividade, causa, CWP, equipe…" className="min-w-[220px]" />
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-m-text-secondary">Agrupar por</span>
            <div className="inline-flex rounded-full border border-m-stroke p-0.5" role="group" aria-label="Agrupar por">
              {([['frente', 'Frente'], ['atividade', 'Atividade'], ['data', 'Data']] as const).map(([v, r]) => (
                <button key={v} type="button" aria-pressed={agrupar === v} onClick={() => setAgrupar(v)}
                  className={`h-8 rounded-full px-3 text-[12.5px] font-semibold ${agrupar === v ? 'bg-m-accent text-white' : 'text-m-text-secondary hover:bg-m-surface-hover'}`}>{r}</button>
              ))}
            </div>
          </div>
          <span className="ml-auto text-[12.5px] text-m-text-muted">{fotos.length} foto(s)</span>
        </div>
      </Painel>

      {/* cabeçalho só na impressão */}
      <header className="hidden items-center justify-between gap-4 border-b-2 border-m-accent pb-3 print:flex">
        <LogosObra altura={40} />
        <div className="text-right">
          <h1 className="text-[18px] font-bold">Book de fotos · {nomeTipo}</h1>
          <p className="text-[12px]">{obra?.nome} · {de ? dataBR(de) : 'início'} a {ate ? dataBR(ate) : 'hoje'} · {fotos.length} foto(s)</p>
        </div>
      </header>

      {q.isLoading && <p className="text-sm text-m-text-muted">Carregando…</p>}
      {q.data && !fotos.length && <Painel titulo="Nenhuma foto"><p className="text-[13px] text-m-text-muted">Nenhuma foto de {nomeTipo} no período e filtros escolhidos. As fotos entram pelo app de campo (Lançar, Ocorrências e Restrições).</p></Painel>}
      {grupos.map(([k1, sub]) => (
        <section key={k1} className="flex flex-col gap-3 rounded-m-lg border border-m-stroke-subtle bg-m-surface-raised p-4 print:break-inside-auto print:border-0 print:p-0">
          <h2 className="text-[16px] font-semibold text-m-text-primary">{rot(k1, 1)} <span className="text-[12.5px] font-normal text-m-text-muted">· {sub.reduce((s, [, l]) => s + l.length, 0)} foto(s)</span></h2>
          {sub.map(([k2, lista]) => (
            <div key={k2} className="flex flex-col gap-2">
              <h3 className="text-[13px] font-semibold text-m-text-secondary">{rot(k2, 2)}</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 print:grid-cols-3">
                {lista.map((f) => <Cartao key={f.id} f={f} onAbrir={() => setAberta(f)} />)}
              </div>
            </div>
          ))}
        </section>
      ))}
      {aberta && <Ampliada f={aberta} onFechar={() => setAberta(null)} />}
    </>
  );
}
