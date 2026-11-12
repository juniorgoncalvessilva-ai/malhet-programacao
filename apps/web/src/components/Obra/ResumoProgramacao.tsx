'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { Calculado, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { fmt } from '@/components/Obra/ui';
import type { LinhaVisao } from '@/lib/api/types';
import { nomeLinha, type ModoNomes } from '@/lib/programacao/nomes';

/**
 * Resumo da programação (spec 053): o programado por frente (local → área → linhas) e por responsável → encarregado,
 * com a quantidade somada por unidade de medida (previsto e realizado) e o HH previsto. Toda soma abre a conta.
 */
type Linha = LinhaVisao & { local: string; area: string };
type Visao = { titulo: string; locais: { codigo: string; descricao: string; areas: { codigo: string; descricao: string; linhas: LinhaVisao[] }[] }[] };
const SEM_UNID = 'sem unid.';
const un = (ln: LinhaVisao) => ln.unidade || SEM_UNID;

function memoriaSoma(chave: string, titulo: string, linhas: Linha[], campo: 'total_previsto' | 'total_realizado' | 'hh', unid: string, nomes: ModoNomes): MemoriaCalculo {
  const valor = (l: Linha) => (campo === 'hh' ? (l.calc?.total_hh_previsto ?? 0) : l[campo] ?? 0);
  const total = linhas.reduce((s, l) => s + valor(l), 0);
  const rot = campo === 'hh' ? 'HH previsto' : campo === 'total_previsto' ? 'previsto' : 'realizado';
  return {
    chave, titulo, valor: `${fmt(total)} ${unid}`,
    formula: `soma do ${rot} no período das linhas ${campo === 'hh' ? '' : `com unidade ${unid} `}deste grupo`,
    passos: [...linhas.map((l) => ({ descricao: `${l.codigo_simova} ${nomeLinha(l, nomes)}`, conta: `${l.area}${l.encarregado ? ` · ${l.encarregado}` : ''}`, resultado: `${fmt(valor(l))} ${unid}`, destaque: false })),
      { descricao: 'Total', conta: `${linhas.length} linha(s)`, resultado: `${fmt(total)} ${unid}`, destaque: true }],
    fontes: [{ dado: rot, valor: `${fmt(total)} ${unid}`, origem: 'Programação', local: campo === 'hh' ? 'HH previsto de cada linha (CPU da obra × previsto)' : `coluna Total (${rot}) de cada linha` }],
    notas: [],
  };
}

export function ResumoProgramacao({ v, nomes }: { v: Visao; nomes: ModoNomes }) {
  const linhas: Linha[] = useMemo(() => v.locais.flatMap((l) => l.areas.flatMap((a) => a.linhas.map((ln) => ({
    ...ln, local: `${l.codigo} · ${l.descricao}`, area: `${a.codigo} · ${a.descricao}`,
  })))), [v]);
  const unidades = useMemo(() => [...new Set(linhas.map(un))].sort((a, b) => (a === SEM_UNID ? 1 : b === SEM_UNID ? -1 : a.localeCompare(b, 'pt-BR'))), [linhas]);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const alternar = (k: string) => setAbertos((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const [ver, setVer] = useState<'ambos' | 'previsto' | 'realizado'>('ambos');

  if (!linhas.length) return <p className="rounded-m-lg border border-dashed border-m-stroke p-8 text-center text-sm text-m-text-secondary">Nenhuma linha programada ainda.</p>;

  const celulas = (chave: string, titulo: string, ls: Linha[], forte = false): ReactNode => (
    <>
      <td className="px-2 py-1.5 text-right text-m-text-muted">{ls.length}</td>
      {unidades.map((u) => {
        const doU = ls.filter((l) => un(l) === u);
        if (!doU.length) return <td key={u} className="px-2 py-1.5 text-right text-m-text-tertiary">—</td>;
        const p = doU.reduce((s, l) => s + (l.total_previsto ?? 0), 0);
        const r = doU.reduce((s, l) => s + (l.total_realizado ?? 0), 0);
        return (
          <td key={u} className={`whitespace-nowrap px-2 py-1.5 text-right ${forte ? 'font-semibold text-m-text-primary' : ''}`}>
            {ver !== 'realizado' && <div><Calculado chave={`${chave}:${u}:p`} memoria={() => memoriaSoma(`${chave}:${u}:p`, `${titulo} · previsto (${u})`, doU, 'total_previsto', u, nomes)}>{fmt(p)}</Calculado></div>}
            {ver !== 'previsto' && <div className={ver === 'ambos' ? 'text-[11.5px] font-normal text-m-text-muted' : ''}>{ver === 'ambos' ? 'R ' : ''}<Calculado chave={`${chave}:${u}:r`} memoria={() => memoriaSoma(`${chave}:${u}:r`, `${titulo} · realizado (${u})`, doU, 'total_realizado', u, nomes)}>{fmt(r)}</Calculado></div>}
          </td>
        );
      })}
      <td className="whitespace-nowrap px-2 py-1.5 text-right">
        <Calculado chave={`${chave}:hh`} memoria={() => memoriaSoma(`${chave}:hh`, `${titulo} · HH previsto`, ls, 'hh', 'HH', nomes)}>{fmt(ls.reduce((s, l) => s + (l.calc?.total_hh_previsto ?? 0), 0), 1)}</Calculado>
      </td>
    </>
  );
  const cabecalho = (primeira: string) => (
    <thead>
      <tr className="text-left text-[11px] uppercase tracking-[0.3px] text-m-text-muted">
        <th className="px-2 py-2">{primeira}</th><th className="px-2 py-2 text-right">Linhas</th>
        {unidades.map((u) => <th key={u} className="px-2 py-2 text-right normal-case">{u}{ver === 'ambos' ? <span className="block text-[10px] font-normal">prev. / R</span> : null}</th>)}
        <th className="px-2 py-2 text-right">HH prev.</th>
      </tr>
    </thead>
  );
  const seta = (k: string) => (abertos.has(k) ? <ChevronDown size={14} /> : <ChevronRight size={14} />);
  const linhaItem = (l: Linha, recuo: string, k: string) => (
    <tr key={`${k}:${l.id}`} className="border-b border-m-row text-[12.5px]">
      <td className={`${recuo} py-1.5 pr-2`}><b className="text-m-text-primary">{l.codigo_simova}</b> {nomeLinha(l, nomes)}
        <div className="text-[11px] text-m-text-muted">{[l.cwp?.texto && `CWP ${l.cwp.texto}`, l.encarregado ?? l.equipe, l.responsavel && `resp. ${l.responsavel}`].filter(Boolean).join(' · ')}</div></td>
      {celulas(`${k}:${l.id}`, `${l.codigo_simova} ${nomeLinha(l, nomes)}`, [l])}
    </tr>
  );
  const grupos = <T extends string>(ls: Linha[], chaveDe: (l: Linha) => T) => {
    const m = new Map<T, Linha[]>();
    for (const l of ls) { const k = chaveDe(l); m.set(k, [...(m.get(k) ?? []), l]); }
    return [...m.entries()];
  };
  const porLocal = grupos(linhas, (l) => l.local);
  const porResp = grupos(linhas, (l) => l.responsavel || 'Sem responsável').sort(([a], [b]) => (a === 'Sem responsável' ? 1 : b === 'Sem responsável' ? -1 : a.localeCompare(b, 'pt-BR')));
  const total = celulas('total', 'Total da programação', linhas, true);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-full border border-m-stroke bg-m-surface-raised p-0.5" role="group" aria-label="Quantidades">
          {([['ambos', 'Previsto e realizado'], ['previsto', 'Previsto'], ['realizado', 'Realizado']] as const).map(([k, r]) => (
            <button key={k} type="button" aria-pressed={ver === k} onClick={() => setVer(k)}
              className={`h-8 rounded-full px-3 text-[12.5px] font-semibold ${ver === k ? 'bg-m-accent text-white' : 'text-m-text-secondary hover:bg-m-surface-hover'}`}>{r}</button>
          ))}
        </div>
        <button type="button" className="text-[12.5px] font-semibold text-m-accent underline" onClick={() => setAbertos(new Set([
          ...porLocal.flatMap(([k, ls]) => [`f:${k}`, ...grupos(ls, (l) => l.area).map(([a]) => `f:${k}:${a}`)]),
          ...porResp.flatMap(([k, ls]) => [`r:${k}`, ...grupos(ls, (l) => l.encarregado || l.equipe || 'Sem encarregado').map(([e]) => `r:${k}:${e}`)]),
        ]))}>expandir tudo</button>
        <button type="button" className="text-[12.5px] font-semibold text-m-accent underline" onClick={() => setAbertos(new Set())}>recolher tudo</button>
        <span className="text-[12px] text-m-text-muted">Quantidade somada por unidade de medida (não se somam unidades diferentes).</span>
      </div>

      <section className="flex flex-col gap-2 rounded-m-carimbo border border-m-stroke-subtle bg-m-surface-raised p-4">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.4px] text-m-text-primary">Por frente</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            {cabecalho('Frente → área → atividade')}
            <tbody>
              {porLocal.map(([loc, ls]) => (
                <Fragment key={loc}>
                  <tr className="border-b border-m-row bg-m-surface-hover">
                    <td className="px-2 py-1.5"><button type="button" aria-expanded={abertos.has(`f:${loc}`)} onClick={() => alternar(`f:${loc}`)} className="inline-flex items-center gap-1 font-semibold text-m-text-primary">{seta(`f:${loc}`)}{loc}</button></td>
                    {celulas(`f:${loc}`, loc, ls, true)}
                  </tr>
                  {abertos.has(`f:${loc}`) && grupos(ls, (l) => l.area).map(([area, la]) => (
                    <Fragment key={area}>
                      <tr className="border-b border-m-row">
                        <td className="py-1.5 pl-6 pr-2"><button type="button" aria-expanded={abertos.has(`f:${loc}:${area}`)} onClick={() => alternar(`f:${loc}:${area}`)} className="inline-flex items-center gap-1 font-medium text-m-text-primary">{seta(`f:${loc}:${area}`)}{area}</button></td>
                        {celulas(`f:${loc}:${area}`, area, la)}
                      </tr>
                      {abertos.has(`f:${loc}:${area}`) && la.map((l) => linhaItem(l, 'pl-12', `f:${loc}:${area}`))}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
              <tr className="border-t-2 border-m-stroke"><td className="px-2 py-2 font-semibold text-m-text-primary">Total</td>{total}</tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-m-carimbo border border-m-stroke-subtle bg-m-surface-raised p-4">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.4px] text-m-text-primary">Por responsável e encarregado</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            {cabecalho('Responsável → encarregado → atividade')}
            <tbody>
              {porResp.map(([resp, ls]) => (
                <Fragment key={resp}>
                  <tr className="border-b border-m-row bg-m-surface-hover">
                    <td className="px-2 py-1.5"><button type="button" aria-expanded={abertos.has(`r:${resp}`)} onClick={() => alternar(`r:${resp}`)} className="inline-flex items-center gap-1 font-semibold text-m-text-primary">{seta(`r:${resp}`)}{resp}</button></td>
                    {celulas(`r:${resp}`, resp, ls, true)}
                  </tr>
                  {abertos.has(`r:${resp}`) && grupos(ls, (l) => l.encarregado || l.equipe || 'Sem encarregado').map(([enc, le]) => (
                    <Fragment key={enc}>
                      <tr className="border-b border-m-row">
                        <td className="py-1.5 pl-6 pr-2"><button type="button" aria-expanded={abertos.has(`r:${resp}:${enc}`)} onClick={() => alternar(`r:${resp}:${enc}`)} className="inline-flex items-center gap-1 font-medium text-m-text-primary">{seta(`r:${resp}:${enc}`)}{enc}</button></td>
                        {celulas(`r:${resp}:${enc}`, enc, le)}
                      </tr>
                      {abertos.has(`r:${resp}:${enc}`) && le.map((l) => linhaItem(l, 'pl-12', `r:${resp}:${enc}`))}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
              <tr className="border-t-2 border-m-stroke"><td className="px-2 py-2 font-semibold text-m-text-primary">Total</td>{celulas('total2', 'Total da programação', linhas, true)}</tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
