'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Printer, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Abas } from '@/components/Obra/Abas';
import { AcaoDetalhe } from '@/components/Auditoria/AcaoDetalhe';
import { LogosObra } from '@/components/Obra/LogosObra';
import { Botao, Cabecalho, Indicador, Painel } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';
import { type Acao5W2H, FAROL_ACAO, ROTULO_ORIGEM, ROTULO_STATUS_ACAO, dataBR, useAcoes } from '@/lib/auditorias';

type Aba = 'quadro' | 'reuniao' | 'programacao' | 'gerar';
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const COLUNAS: Acao5W2H['status'][] = ['aberta', 'andamento', 'verificacao', 'concluida'];

function Cartao({ a, onAbrir }: { a: Acao5W2H; onAbrir: () => void }) {
  const f = FAROL_ACAO[a.farol] ?? FAROL_ACAO[a.status];
  return (
    <button type="button" onClick={onAbrir} className="flex w-full flex-col gap-1 rounded-m-md border border-m-stroke-subtle bg-m-surface-raised p-2.5 text-left text-[12.5px] hover:border-m-accent">
      <span className="flex items-center justify-between gap-2"><span className="font-semibold text-m-text-muted">A-{a.numero} · {ROTULO_ORIGEM[a.origem]}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${f.cls}`}>{f.rotulo}</span></span>
      <span className="text-[13.5px] font-medium leading-5 text-m-text-primary">{a.o_que}</span>
      <span className="text-m-text-muted">{a.quem ?? '—'} · {dataBR(a.quando)}{a.onde ? ` · ${a.onde}` : ''}</span>
    </button>
  );
}

/**
 * Plano de ação 5W2H (spec 064): quadro por situação, reunião de ações por frente (pauta impressa), programação das ações
 * (dia de execução) e geração das ações a partir das ocorrências e restrições ainda abertas.
 */
export default function AcoesPage() {
  const api = useApi();
  const { pode, papel, obra } = useObra();
  const [aba, setAba] = useState<Aba>('quadro');
  const [aberta, setAberta] = useState<Acao5W2H | null>(null);
  const [nova, setNova] = useState(false);
  const [semana, setSemana] = useState(() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 1) % 7)); return iso(d); }); // começa no sábado
  const q = useAcoes();
  const acoes = q.data ?? [];
  const age = pode('encarregado') || papel === 'seguranca';
  const abertas = acoes.filter((a) => ['aberta', 'andamento'].includes(a.status));

  const porFrente = useMemo(() => {
    const m = new Map<string, Acao5W2H[]>();
    for (const a of acoes.filter((x) => x.status !== 'cancelada' && x.status !== 'concluida')) m.set(a.onde || 'Sem frente', [...(m.get(a.onde || 'Sem frente') ?? []), a]);
    return [...m.entries()].sort((x, y) => x[0].localeCompare(y[0], 'pt-BR', { numeric: true }));
  }, [acoes]);
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(`${semana}T12:00:00`); d.setDate(d.getDate() + i); return iso(d); }), [semana]);
  const doDia = (d: string) => acoes.filter((a) => (a.data_execucao ?? a.quando) === d && a.status !== 'cancelada');
  const andar = (n: number) => { const d = new Date(`${semana}T12:00:00`); d.setDate(d.getDate() + 7 * n); setSemana(iso(d)); };

  const atualizar = () => { q.refetch().then((r) => { const x = r.data?.find((y) => y.id === aberta?.id); if (x) setAberta(x); }); };

  return (
    <>
      <div className="print:hidden">
        <Cabecalho eyebrow="Governança · ações 5W2H" titulo="Plano de ação"
          acoes={<>
            <Botao variante="secundario" onClick={() => window.print()}><Printer size={16} /> Imprimir</Botao>
            {age && <Botao onClick={() => setNova(true)}><Plus size={16} /> Nova ação</Botao>}
          </>} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 print:hidden">
        <Indicador rotulo="Abertas" valor={abertas.length} />
        <Indicador rotulo="Vencidas" valor={abertas.filter((a) => a.farol === 'vencida').length} tom={abertas.some((a) => a.farol === 'vencida') ? 'perigo' : undefined} />
        <Indicador rotulo="Aguardando verificação" valor={acoes.filter((a) => a.status === 'verificacao').length} />
        <Indicador rotulo="Concluídas" valor={acoes.filter((a) => a.status === 'concluida').length} />
      </div>
      <div className="print:hidden">
        <Abas rotulo="Visão" ativa={aba} onTrocar={setAba} abas={[{ chave: 'quadro', titulo: 'Quadro' }, { chave: 'reuniao', titulo: 'Reunião por frente' },
          { chave: 'programacao', titulo: 'Programação das ações' }, { chave: 'gerar', titulo: 'Gerar de ocorrências e restrições', visivel: age }]} />
      </div>
      {nova && <NovaAcao onFechar={() => setNova(false)} />}
      {aberta && (
        <Painel titulo={`A-${aberta.numero} · ${aberta.o_que}`} acoes={<Botao variante="fantasma" onClick={() => setAberta(null)}><X size={16} /> Fechar</Botao>} className="print:hidden">
          <AcaoDetalhe key={`${aberta.id}-${aberta.status}-${aberta.fotos.length}`} a={aberta} onMudou={atualizar} />
        </Painel>
      )}

      {aba === 'quadro' && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLUNAS.map((s) => {
            const lista = acoes.filter((a) => a.status === s);
            return (
              <section key={s} className="flex flex-col gap-2 rounded-m-lg border border-m-stroke-subtle bg-m-surface-base p-3">
                <h2 className="flex justify-between text-[13px] font-semibold">{ROTULO_STATUS_ACAO[s]}<span className="text-m-text-muted">{lista.length}</span></h2>
                {lista.map((a) => <Cartao key={a.id} a={a} onAbrir={() => setAberta(a)} />)}
              </section>
            );
          })}
        </div>
      )}

      {aba === 'reuniao' && (
        <>
          <header className="hidden items-center justify-between gap-4 border-b-2 border-m-accent pb-3 print:flex">
            <LogosObra altura={40} />
            <div className="text-right"><h1 className="text-[18px] font-bold">Reunião de ações das frentes</h1><p className="text-[12px]">{obra?.nome} · {new Date().toLocaleDateString('pt-BR')}</p></div>
          </header>
          {porFrente.map(([frente, lista]) => (
            <Painel key={frente} titulo={`${frente} · ${lista.length} ação(ões)`} acoes={<span className="text-[12.5px] text-m-danger">{lista.filter((a) => a.farol === 'vencida').length || ''}{lista.some((a) => a.farol === 'vencida') ? ' vencida(s)' : ''}</span>}>
              <table className="w-full text-[13px]">
                <thead className="text-left text-[11px] uppercase tracking-[0.4px] text-m-text-muted"><tr><th className="py-1.5">Nº</th><th>O quê</th><th>Por quê</th><th>Quem</th><th>Quando</th><th>Situação</th></tr></thead>
                <tbody>
                  {lista.map((a) => {
                    const f = FAROL_ACAO[a.farol] ?? FAROL_ACAO[a.status];
                    return (
                      <tr key={a.id} onClick={() => setAberta(a)} className="cursor-pointer border-t border-m-stroke-subtle align-top hover:bg-m-surface-hover">
                        <td className="py-1.5 font-semibold">A-{a.numero}</td><td className="pr-3">{a.o_que}<span className="block text-[11.5px] text-m-text-muted">{a.origem_texto ?? ROTULO_ORIGEM[a.origem]}</span></td>
                        <td className="max-w-[260px] pr-3 text-m-text-secondary">{a.por_que}</td><td>{a.quem}</td><td>{dataBR(a.quando)}</td>
                        <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${f.cls}`}>{f.rotulo}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Painel>
          ))}
          {!porFrente.length && <Painel titulo="Sem ações pendentes"><p className="text-[13px] text-m-text-muted">Nenhuma ação aberta ou aguardando verificação.</p></Painel>}
        </>
      )}

      {aba === 'programacao' && (
        <Painel titulo="Programação das ações (dia de execução; sem ele, o prazo)" acoes={<div className="flex items-center gap-2 print:hidden">
          <button type="button" aria-label="Semana anterior" onClick={() => andar(-1)} className="grid h-9 w-9 place-items-center rounded-full border border-m-stroke"><ChevronLeft size={16} /></button>
          <span className="text-[13px] font-semibold">{dataBR(dias[0])} a {dataBR(dias[6])}</span>
          <button type="button" aria-label="Semana seguinte" onClick={() => andar(1)} className="grid h-9 w-9 place-items-center rounded-full border border-m-stroke"><ChevronRight size={16} /></button>
        </div>}>
          <div className="grid gap-2 md:grid-cols-7">
            {dias.map((d) => (
              <section key={d} className="flex min-h-[120px] flex-col gap-2 rounded-m-md border border-m-stroke-subtle bg-m-surface-base p-2">
                <h3 className="text-[12px] font-semibold capitalize text-m-text-secondary">{new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</h3>
                {doDia(d).map((a) => <Cartao key={a.id} a={a} onAbrir={() => setAberta(a)} />)}
              </section>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-m-text-muted">Para programar, abra a ação e escolha o dia de execução. Ações vencidas e sem dia continuam no quadro.</p>
        </Painel>
      )}

      {aba === 'gerar' && <Candidatas />}
    </>
  );
}

function Candidatas() {
  const api = useApi();
  const q = useQuery({ queryKey: ['acoes', 'candidatas'], queryFn: () => api.get<{ origem: 'ocorrencia' | 'restricao'; id: number; data: string; titulo: string; causa: string | null; frente: string | null; atividade: string | null; acao: string | null; responsavel: string | null }[]>('/acoes/candidatas') });
  const gerar = async (origem: string, id: number) => {
    try { const a = await api.post<Acao5W2H>('/acoes/de-origem', { origem, origem_id: id }); toast.success(`Ação A-${a.numero} criada`); } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <Painel titulo="Ocorrências e restrições abertas sem ação">
      <table className="w-full text-[13px]">
        <thead className="text-left text-[11px] uppercase tracking-[0.4px] text-m-text-muted"><tr><th className="py-1.5">Origem</th><th>Data</th><th>O que aconteceu</th><th>Frente</th><th>Responsável</th><th /></tr></thead>
        <tbody>
          {(q.data ?? []).map((c) => (
            <tr key={`${c.origem}-${c.id}`} className="border-t border-m-stroke-subtle align-top">
              <td className="py-1.5">{c.origem === 'ocorrencia' ? 'Ocorrência' : 'Restrição'}{c.causa && <span className="block text-[11.5px] text-m-warning">{c.causa}</span>}</td>
              <td>{dataBR(c.data)}</td><td className="max-w-[360px] pr-3">{c.titulo}{c.acao && <span className="block text-[12px] text-m-text-muted">Ação sugerida: {c.acao}</span>}</td>
              <td>{c.frente ?? '—'}</td><td>{c.responsavel ?? '—'}</td>
              <td><Botao variante="secundario" onClick={() => gerar(c.origem, c.id)}>Gerar ação 5W2H</Botao></td>
            </tr>
          ))}
        </tbody>
      </table>
      {q.data && !q.data.length && <p className="py-3 text-[13px] text-m-text-muted">Nada pendente: toda ocorrência e restrição aberta já tem ação.</p>}
    </Painel>
  );
}

function NovaAcao({ onFechar }: { onFechar: () => void }) {
  const api = useApi();
  const [f, setF] = useState({ o_que: '', por_que: '', onde: '', quando: '', quem: '', como: '', quanto: '', data_execucao: '', acompanhamento: '' });
  const cls = 'w-full rounded-[10px] border border-m-stroke bg-m-surface-field px-3 py-2 text-[14px]';
  const salvar = async () => {
    try { const a = await api.post<Acao5W2H>('/acoes', { ...f, quando: f.quando || null, data_execucao: f.data_execucao || null }); toast.success(`Ação A-${a.numero} criada`); onFechar(); } catch (e) { toast.error((e as Error).message); }
  };
  const campo = (k: keyof typeof f, r: string, tipo = 'text') => (
    <label className="flex flex-col gap-1 text-[12px] font-medium text-m-text-secondary">{r}<input type={tipo} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={cls} /></label>
  );
  return (
    <Painel titulo="Nova ação 5W2H" acoes={<Botao variante="fantasma" onClick={onFechar}><X size={16} /> Fechar</Botao>}>
      <div className="grid gap-3 md:grid-cols-2">
        {campo('o_que', 'O quê *')}{campo('por_que', 'Por quê')}{campo('onde', 'Onde (frente)')}{campo('quando', 'Quando (prazo) *', 'date')}
        {campo('quem', 'Quem *')}{campo('como', 'Como')}{campo('quanto', 'Quanto (R$ / HH)')}{campo('data_execucao', 'Dia de execução', 'date')}
        {campo('acompanhamento', 'Acompanhamento (verifica a eficácia)')}
      </div>
      <div className="mt-3"><Botao onClick={salvar}>Criar ação</Botao></div>
    </Painel>
  );
}
