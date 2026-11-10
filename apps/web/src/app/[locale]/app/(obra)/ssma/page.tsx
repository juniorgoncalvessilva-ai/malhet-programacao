'use client';

import { HardHat, Save } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Botao, Cabecalho, Erro, Painel, Pilula, Selecao, dataBR } from '@/components/Obra/ui';
import { k, useAcao, useProgramacao, useProgramacoes } from '@/hooks/programacao/planejamento';
import type { LinhaVisao, Ssma } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';

const CAMPOS: { k: keyof Ssma; rotulo: string; dica: string; largura: string }[] = [
  { k: 'tecnico', rotulo: 'Técnico de segurança responsável', dica: 'nome', largura: 'w-[200px]' },
  { k: 'rac', rotulo: 'RAC', dica: 'nº ou N/A', largura: 'w-[90px]' },
  { k: 'pts', rotulo: 'PTS', dica: 'nº ou N/A', largura: 'w-[90px]' },
  { k: 'art', rotulo: 'ART', dica: 'ex.: ART/11/53', largura: 'w-[120px]' },
  { k: 'pto', rotulo: 'PTO (Plano de Trabalho de Obra)', dica: 'nº ou N/A', largura: 'w-[110px]' },
  { k: 'ata', rotulo: 'ATA (Autorização de Trabalho Ambiental)', dica: 'nº ou N/A', largura: 'w-[110px]' },
];
type Edicao = Record<number, Partial<Ssma>>;

export default function SsmaPage() {
  const { editaSsma } = useObra();
  const lista = useProgramacoes();
  const [pid, setPid] = useState<number | null>(null);
  useEffect(() => { if (pid == null && lista.data?.length) setPid(lista.data[0].id); }, [lista.data, pid]);
  const prog = useProgramacao(pid ?? 0);
  const [ed, setEd] = useState<Edicao>({});
  useEffect(() => setEd({}), [pid]);
  const v = prog.data;
  const linhas = useMemo(() => v?.locais.flatMap((l) => l.areas.flatMap((a) => a.linhas)) ?? [], [v]);
  const tecnicos = useMemo(() => [...new Set(linhas.map((l) => l.ssma?.tecnico).filter(Boolean))] as string[], [linhas]);
  const n = Object.keys(ed).length;

  const salvar = useAcao((api, e: Edicao) => api.put<{ linhas: number }>(`/programacoes/${pid}/ssma`, {
    linhas: Object.entries(e).map(([id, x]) => {
      const ln = linhas.find((l) => l.id === Number(id));
      return { id: Number(id), ...ln?.ssma, ...x };
    }),
  }), [[...k.programacoes], ['programacao']]);
  const val = (ln: LinhaVisao, c: keyof Ssma) => (ed[ln.id]?.[c] ?? ln.ssma?.[c] ?? '') as string;
  const set = (ln: LinhaVisao, c: keyof Ssma, x: string) => setEd((e) => ({ ...e, [ln.id]: { ...e[ln.id], [c]: x } }));
  const completo = (ln: LinhaVisao) => CAMPOS.every((c) => val(ln, c.k).trim());
  const pendentes = linhas.filter((l) => !completo(l)).length;

  return (
    <>
      <Cabecalho
        eyebrow="Segurança · SSMA da programação"
        cor="var(--m-proc-administrar)"
        titulo={v ? `${v.titulo}: ${pendentes ? `${pendentes} linha(s) sem SSMA completo` : 'SSMA completo'}` : 'SSMA da programação'}
        descricao="Para cada atividade programada: técnico de segurança responsável, RAC, PTS, ART, Plano de Trabalho de Obra (PTO) e Autorização de Trabalho Ambiental (ATA). Use N/A quando não se aplica. Vale também depois de emitida; vai para a coluna SSMA do Excel do cliente."
        acoes={<div className="flex items-end gap-2">
          <Selecao rotulo="Programação" value={pid ?? ''} onChange={(e) => setPid(Number(e.target.value))} className="min-w-[300px]">
            {lista.data?.map((p) => <option key={p.id} value={p.id}>{p.titulo} · {p.status === 'emitida' ? 'emitida' : 'rascunho'}</option>)}
          </Selecao>
          {editaSsma && <Botao disabled={!n || salvar.isPending} onClick={() => salvar.mutate(ed, { onSuccess: (r) => { toast.success(`SSMA salvo em ${r.linhas} linha(s)`); setEd({}); } })}><Save size={16} /> Salvar SSMA{n ? ` (${n})` : ''}</Botao>}
        </div>}
      />
      <Painel titulo={<span className="inline-flex items-center gap-2"><HardHat size={18} className="text-m-accent" />Itens de SSMA por atividade</span>}
        subtitulo={v ? `Período ${dataBR(v.inicio)} a ${dataBR(v.fim)}` : undefined}>
        <datalist id="tecnicos">{tecnicos.map((t) => <option key={t} value={t} />)}</datalist>
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">
                <th className="px-2 pb-2 text-left">Atividade</th>
                <th className="px-2 pb-2 text-left">Encarregado</th>
                {CAMPOS.map((c) => <th key={c.k} className="px-1 pb-2 text-left">{c.rotulo}</th>)}
                <th className="px-2 pb-2" />
              </tr>
            </thead>
            <tbody>
              {!linhas.length && <tr><td colSpan={9} className="py-8 text-center text-m-text-muted">{prog.isLoading ? 'Carregando…' : 'Programação sem linhas.'}</td></tr>}
              {v?.locais.map((l) => (
                <Fragment key={l.id}>
                  <tr><td colSpan={9} className="bg-m-accent-strong px-3 py-1.5 text-xs font-bold uppercase text-m-on-accent">{l.codigo} · {l.descricao}</td></tr>
                  {l.areas.map((a) => (
                    <Fragment key={a.id}>
                      <tr><td colSpan={9} className="bg-m-surface-active px-3 py-1.5 text-xs font-semibold text-m-accent">
                        CWA {a.cwa} · {a.descricao}
                        {editaSsma && a.linhas.length > 1 && <button type="button" className="ml-3 underline" onClick={() => {
                          const t = val(a.linhas[0], 'tecnico');
                          if (t) a.linhas.slice(1).forEach((ln) => set(ln, 'tecnico', t));
                        }}>repetir o técnico da 1ª linha na área</button>}
                      </td></tr>
                      {a.linhas.map((ln) => (
                        <tr key={ln.id} className="border-b border-m-row align-top">
                          <td className="min-w-[240px] px-2 py-2"><b className="text-m-text-primary">{ln.codigo_simova}</b> {ln.descricao}
                            <div className="text-[11px] text-m-text-muted">{ln.id_crono ?? ''}{ln.total_previsto ? ` · prev. ${ln.total_previsto} ${ln.unidade ?? ''}` : ''}</div></td>
                          <td className="px-2 py-2">{ln.encarregado ?? ln.equipe ?? '—'}</td>
                          {CAMPOS.map((c) => (
                            <td key={c.k} className="px-1 py-1.5">
                              <input aria-label={`${c.rotulo} · ${ln.codigo_simova}`} list={c.k === 'tecnico' ? 'tecnicos' : undefined} placeholder={c.dica}
                                disabled={!editaSsma} value={val(ln, c.k)} onChange={(e) => set(ln, c.k, e.target.value)}
                                className={`h-8 ${c.largura} rounded-[8px] border bg-m-surface-field px-2 text-[13px] outline-none focus:border-m-accent disabled:border-transparent disabled:bg-transparent ${ed[ln.id]?.[c.k] !== undefined ? 'border-m-accent bg-m-accent-subtle' : 'border-m-stroke'}`} />
                            </td>
                          ))}
                          <td className="whitespace-nowrap px-2 py-2">
                            {completo(ln) ? <Pilula tom="sucesso">ok</Pilula> : editaSsma
                              ? <button type="button" className="text-xs font-semibold text-m-accent underline" onClick={() => CAMPOS.slice(1).forEach((c) => !val(ln, c.k) && set(ln, c.k, 'N/A'))}>N/A no vazio</button>
                              : <Pilula tom="atencao">pendente</Pilula>}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <Erro erro={salvar.error} />
      </Painel>
    </>
  );
}
