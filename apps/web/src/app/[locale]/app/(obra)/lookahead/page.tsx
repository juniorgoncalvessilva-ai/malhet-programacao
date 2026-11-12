'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Cabecalho, Chip, Painel, dataBR, fmt } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';
import { qs } from '@/lib/api/client';
import type { BlocoLookahead, Lookahead } from '@/lib/api/types';

const DIA_PX = 52;
const FAIXA_PX = 54;
const ROTULO_PX = 230;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const segunda = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const somar = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export default function LookaheadPage() {
  const api = useApi();
  const [inicio, setInicio] = useState(() => segunda(new Date()));
  const [semanas, setSemanas] = useState(6);
  const [visao, setVisao] = useState<'equipe' | 'frente'>('equipe');
  const [sel, setSel] = useState<number | null>(null);
  const de = iso(inicio);
  const ate = iso(somar(inicio, semanas * 7 - 1));
  const q = useQuery({ queryKey: ['lookahead', de, ate], queryFn: () => api.get<Lookahead>(`/lookahead${qs({ de, ate })}`) });
  const d = q.data;
  const hoje = iso(new Date());
  const idx = useMemo(() => Object.fromEntries((d?.dias ?? []).map((x, i) => [x.data, i])), [d]);
  const corEq = useMemo(() => Object.fromEntries((d?.equipes ?? []).map((e) => [String(e.id), e])), [d]);
  const area = useMemo(() => Object.fromEntries((d?.areas ?? []).map((a) => [a.id, a])), [d]);
  const semanasCab = useMemo(() => {
    const out: { semana: number; n: number }[] = [];
    for (const x of d?.dias ?? []) { const u = out[out.length - 1]; if (u && u.semana === x.semana) u.n += 1; else out.push({ semana: x.semana, n: 1 }); }
    return out;
  }, [d]);
  const raias = visao === 'equipe'
    ? (d?.equipes ?? []).map((e) => ({ chave: `e${e.id}`, titulo: e.nome, sub: e.encarregado ?? '', cor: e.cor, faixas: e.faixas, blocos: d!.blocos.filter((b) => b.equipe_id === e.id) }))
    : (d?.areas ?? []).map((a) => ({ chave: `a${a.id}`, titulo: `${a.codigo} · ${a.descricao}`, sub: a.local ?? '', cor: null as string | null, faixas: a.faixas, blocos: d!.blocos.filter((b) => b.area_id === a.id) }));
  const largura = (d?.dias.length ?? 0) * DIA_PX;
  const selecionado = d?.blocos.find((b) => b.id === sel) ?? null;

  const cartao = (b: BlocoLookahead) => {
    const e = corEq[String(b.equipe_id)];
    const cor = e?.cor ?? '#8C8C8C';
    const i0 = idx[b.inicio] ?? 0;
    const i1 = idx[b.fim] ?? i0;
    const a = area[b.area_id];
    const faixa = visao === 'equipe' ? b.faixa_equipe : b.faixa_area;
    const restr = b.restricoes?.pendentes ?? 0;
    return (
      <button key={b.id} type="button" onClick={() => setSel(b.id === sel ? null : b.id)}
        title={`${e?.nome ?? 'Sem equipe'} · ${a?.codigo ?? ''} ${a?.descricao ?? ''}\n${b.codigo_simova ?? ''} ${b.descricao}\n${dataBR(b.inicio)} a ${dataBR(b.fim)} · previsto ${fmt(b.total_previsto)} ${b.unidade ?? ''}${b.total_realizado != null ? ` · realizado ${fmt(b.total_realizado)}` : ''}\n${b.programacao} (${b.status})`}
        className={`absolute flex flex-col overflow-hidden rounded-[6px] border px-1.5 py-1 text-left text-[11px] leading-[14px] text-m-text-primary hover:z-10 hover:shadow-md ${sel === b.id ? 'ring-2 ring-m-accent' : ''} ${restr ? 'border-m-warning' : 'border-m-stroke-subtle'}`}
        style={{ left: i0 * DIA_PX + 2, width: (i1 - i0 + 1) * DIA_PX - 4, top: faixa * FAIXA_PX + 4, height: FAIXA_PX - 8,
          background: `color-mix(in srgb, ${cor} 16%, var(--m-surface-raised))`, borderLeft: `4px solid ${cor}` }}>
        {i1 === i0 ? (<>
          <span className="break-all text-[10px] font-semibold leading-[12px]">{visao === 'equipe' ? (a?.codigo ?? '') : (e?.nome ?? 'Sem equipe').slice(0, 10)}</span>
          <span className="break-all text-[10px] leading-[12px] text-m-text-secondary">{b.codigo_simova}</span>
        </>) : (<>
          <span className="truncate font-semibold">{visao === 'equipe' ? `${a?.codigo ?? ''} · ${a?.descricao ?? ''}` : (e?.nome ?? 'Sem equipe')}</span>
          <span className="truncate text-m-text-secondary">{b.codigo_simova} {b.descricao}</span>
        </>)}
        {restr > 0 && <span className="absolute bottom-0.5 right-1 rounded-[4px] bg-m-warning-subtle px-1 text-[10px] font-semibold text-m-warning">{restr} restr.</span>}
      </button>
    );
  };

  return (
    <>
      <Cabecalho eyebrow="Programar · look-ahead" titulo="Andar das equipes no tempo e pelas frentes"
        descricao={<>Cada cartão é uma equipe numa atividade e numa área, nos dias seguidos em que está programada (fim de semana sem nada não quebra o cartão). Vem das programações (previsto e realizado); a cor é a da disciplina ou do setor da equipe no organograma. Troque para <b>Por frente</b> para ver as equipes passando pelas áreas.</>}
        acoes={<>
          <Chip ativo={visao === 'equipe'} onClick={() => setVisao('equipe')}>Por equipe</Chip>
          <Chip ativo={visao === 'frente'} onClick={() => setVisao('frente')}>Por frente</Chip>
        </>} />

      <Painel titulo={d ? `${dataBR(d.de)} a ${dataBR(d.ate)} · ${d.blocos.length} cartão(ões)` : 'Carregando…'}
        subtitulo={d && !d.programacoes.length ? 'Nenhuma programação cobre esta janela.' : d ? `Programações na janela: ${d.programacoes.map((p) => p.titulo.split(' · ')[0]).join(', ')}` : undefined}
        acoes={<div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-label="Semana anterior" className="rounded-full border border-m-stroke p-2 text-m-text-secondary hover:text-m-accent" onClick={() => setInicio(somar(inicio, -7))}><ChevronLeft size={16} /></button>
          <button type="button" className="rounded-full border border-m-stroke px-3 py-1.5 text-[12.5px] font-semibold text-m-text-secondary hover:text-m-accent" onClick={() => setInicio(segunda(new Date()))}>Hoje</button>
          <button type="button" aria-label="Próxima semana" className="rounded-full border border-m-stroke p-2 text-m-text-secondary hover:text-m-accent" onClick={() => setInicio(somar(inicio, 7))}><ChevronRight size={16} /></button>
          {[2, 4, 6].map((n) => <Chip key={n} ativo={semanas === n} onClick={() => setSemanas(n)}>{n} semanas</Chip>)}
        </div>}>
        {d && (
          <>
            {d.equipes.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-m-text-secondary" aria-label="Legenda das equipes">
                {d.equipes.map((e) => <span key={String(e.id)} className="flex items-center gap-1.5" title={e.origem_cor}><span className="inline-block h-3 w-3 rounded-[3px]" style={{ background: e.cor }} />{e.nome}</span>)}
              </div>
            )}
            <div className="-mx-1 overflow-x-auto px-1">
              <div style={{ width: ROTULO_PX + largura }}>
                <div className="flex text-[11px] font-semibold text-m-text-muted">
                  <div className="sticky left-0 z-20 shrink-0 bg-m-surface-raised" style={{ width: ROTULO_PX }} />
                  {semanasCab.map((s, i) => <div key={i} className="border-l border-m-stroke-subtle px-1 py-1 uppercase tracking-[0.4px]" style={{ width: s.n * DIA_PX }}>S{s.semana}</div>)}
                </div>
                <div className="flex border-b border-m-stroke-subtle text-[10.5px] text-m-text-muted">
                  <div className="sticky left-0 z-20 shrink-0 bg-m-surface-raised px-2 py-1 font-semibold uppercase" style={{ width: ROTULO_PX }}>{visao === 'equipe' ? 'Equipe' : 'Frente (área)'}</div>
                  {d.dias.map((x) => (
                    <div key={x.data} className={`shrink-0 py-1 text-center ${x.data === hoje ? 'font-bold text-m-accent' : ['SÁB', 'DOM'].includes(x.dia) ? 'text-m-text-tertiary' : ''}`} style={{ width: DIA_PX }}>
                      {x.dia}<div>{x.data.slice(8)}/{x.data.slice(5, 7)}</div>
                    </div>
                  ))}
                </div>
                {!raias.length && <p className="py-10 text-center text-[13px] text-m-text-muted">Nenhuma equipe programada nesta janela.</p>}
                {raias.map((r) => (
                  <div key={r.chave} className="flex border-b border-m-row">
                    <div className="sticky left-0 z-10 flex shrink-0 items-start gap-2 bg-m-surface-raised px-2 py-2" style={{ width: ROTULO_PX }}>
                      {r.cor && <span className="mt-1 inline-block h-3 w-3 shrink-0 rounded-[3px]" style={{ background: r.cor }} />}
                      <span className="min-w-0"><span className="block truncate text-[12.5px] font-semibold text-m-text-primary">{r.titulo}</span><span className="block truncate text-[11px] text-m-text-muted">{r.sub}</span></span>
                    </div>
                    <div className="relative shrink-0" style={{ width: largura, height: r.faixas * FAIXA_PX }}>
                      {d.dias.map((x, i) => ['SÁB', 'DOM'].includes(x.dia) || x.data === hoje
                        ? <div key={x.data} className={`absolute top-0 h-full ${x.data === hoje ? 'bg-m-accent-subtle' : 'bg-m-surface-hover'}`} style={{ left: i * DIA_PX, width: DIA_PX }} /> : null)}
                      {r.blocos.map(cartao)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </Painel>

      {selecionado && (
        <Painel titulo={`${corEq[String(selecionado.equipe_id)]?.nome ?? 'Sem equipe'} · ${area[selecionado.area_id]?.codigo} ${area[selecionado.area_id]?.descricao}`}
          subtitulo={`${selecionado.codigo_simova ?? ''} ${selecionado.descricao} · ${dataBR(selecionado.inicio)} a ${dataBR(selecionado.fim)}`}
          acoes={<div className="flex flex-wrap gap-3">
            <Link href={`/app/restricoes?area_id=${selecionado.area_id}&linha_id=${selecionado.linha_id}${selecionado.equipe_id ? `&equipe_id=${selecionado.equipe_id}` : ''}&ref=${encodeURIComponent(selecionado.codigo_simova ?? '')}&ate=${selecionado.inicio}`} className="text-[13px] font-semibold text-m-accent underline">+ Restrição para este cartão</Link>
            <Link href={`/app/programacoes/${selecionado.programacao_id}`} className="text-[13px] font-semibold text-m-accent underline">Abrir {selecionado.programacao}</Link>
          </div>}>
          {(selecionado.restricoes?.pendentes ?? 0) > 0 && <p className="mb-2 text-[12.5px] text-m-warning">{selecionado.restricoes!.pendentes} restrição(ões) pendente(s){selecionado.restricoes!.vencidas ? `, ${selecionado.restricoes!.vencidas} atrasada(s)` : ''} nesta área/atividade até o fim do cartão — veja em <Link href="/app/restricoes" className="font-semibold underline">Restrições (6WLA)</Link>.</p>}
          <div className="flex flex-wrap gap-2 text-[12.5px]">
            {selecionado.dias.map((x) => (
              <span key={x.data} className="rounded-m-md border border-m-stroke-subtle px-2.5 py-1.5 text-m-text-secondary">
                <b className="text-m-text-primary">{dataBR(x.data).slice(0, 5)}</b> · P {fmt(x.previsto)}{x.realizado != null ? ` · R ${fmt(x.realizado)}` : ''} {selecionado.unidade ?? ''}
              </span>
            ))}
          </div>
        </Painel>
      )}
    </>
  );
}
