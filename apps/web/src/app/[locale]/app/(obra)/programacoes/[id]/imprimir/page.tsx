'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { useParams } from 'next/navigation';
import { Fragment, useState } from 'react';
import { Botao, Selecao, dataBR, fmt } from '@/components/Obra/ui';
import { useProgramacao } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';
import { useObra } from '@/lib/obra/ObraProvider';

/** Formato da obra (Programacao_auxiliar_v5): LOCAL (faixa vermelha) → ÁREA (faixa azul) → linhas P e R por dia. */
export default function ImprimirPage() {
  const id = Number(useParams<{ id: string }>().id);
  const api = useApi();
  const { obra } = useObra();
  const emissoes = useQuery({
    queryKey: ['emissoes', id],
    queryFn: () => api.get<{ revisao: number; emitida_em: string; emitida_por: string }[]>(`/programacoes/${id}/emissoes`),
  });
  const [escolha, setEscolha] = useState<string>('ultima');
  const rev = escolha === 'viva' ? null : escolha === 'ultima' ? (emissoes.data?.[0]?.revisao ?? null) : Number(escolha);
  const prog = useProgramacao(id, emissoes.isLoading ? undefined : rev);
  const v = prog.data;
  if (!v) return <p className="text-sm text-m-text-muted">{prog.isLoading || emissoes.isLoading ? 'Carregando…' : 'Programação não encontrada.'}</p>;

  const rascunho = rev == null;
  const semanal = v.tipo === 'SEMANAL';
  const cel = 'border border-[#8EA9C1] px-1 py-0.5';
  const totalValor = v.locais.flatMap((l) => l.areas.flatMap((a) => a.linhas)).reduce((s, ln) => s + (ln.pu ?? 0) * ln.total_previsto, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <Link href={`/app/programacoes/${id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-m-accent"><ArrowLeft size={16} /> Voltar para montar</Link>
        <div className="flex flex-wrap items-end gap-2">
          <Selecao rotulo="Versão" value={escolha} onChange={(e) => setEscolha(e.target.value)} className="w-[260px]">
            <option value="ultima">Última emissão{emissoes.data?.[0] ? ` (rev. ${emissoes.data[0].revisao})` : ' (nenhuma: rascunho)'}</option>
            {emissoes.data?.map((e) => <option key={e.revisao} value={e.revisao}>Rev. {e.revisao} · {new Date(e.emitida_em).toLocaleString('pt-BR')}</option>)}
            <option value="viva">Rascunho atual (não emitido)</option>
          </Selecao>
          <Botao onClick={() => window.print()}><Printer size={16} /> Imprimir / PDF</Botao>
        </div>
      </div>

      <div className={`relative overflow-x-auto bg-white p-4 text-black ${semanal ? '' : 'text-[10px]'} print:overflow-visible print:p-0`}>
        {rascunho && <div className="pointer-events-none absolute inset-0 grid place-items-center text-[90px] font-bold text-black/5 print:text-black/10" aria-hidden="true">RASCUNHO</div>}
        <table className="w-full border-collapse text-[11px] leading-tight [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
          <thead>
            <tr>
              <td colSpan={11 + v.dias.length} className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[13px] font-bold uppercase">{obra?.nome}{obra?.contrato ? ` · ${obra.contrato}` : ''}</div>
                    <div className="text-[15px] font-bold">{v.titulo.toUpperCase()}</div>
                    <div>Período {dataBR(v.inicio)} a {dataBR(v.fim)} · {rascunho ? 'RASCUNHO (não emitido)' : `Revisão ${rev}${v.emitida_em ? ` · emitida em ${new Date(v.emitida_em).toLocaleString('pt-BR')}` : ''}`}</div>
                  </div>
                  <img src="/brand/malhet.svg" alt="Malhet" className="h-6 w-auto" />
                </div>
              </td>
            </tr>
            <tr className="bg-[#284E4F] text-white">
              {['Item', 'ID Simova', 'Atividade', 'Item PQ', 'Unid.', 'Qtd projeto', 'Encarregado', 'P/R'].map((h) => <th key={h} className={`${cel} text-left font-semibold`}>{h}</th>)}
              {v.dias.map((d) => <th key={d.data} className={`${cel} min-w-[38px] text-center font-semibold ${['SÁB', 'DOM'].includes(d.dia) ? 'bg-[#1F3D3E]' : ''}`}>{d.dia}<br />{d.data.slice(8)}/{d.data.slice(5, 7)}</th>)}
              <th className={`${cel} text-right font-semibold`}>Total</th>
              <th className={`${cel} text-right font-semibold`}>HH prev.</th>
              <th className={`${cel} text-right font-semibold`}>R$ previsto</th>
            </tr>
          </thead>
          <tbody>
            {v.locais.map((l, li) => (
              <Fragment key={`l${l.id}`}>
                <tr className="break-inside-avoid"><td colSpan={11 + v.dias.length} className={`${cel} bg-[#FF0000] font-bold text-white`}>{l.codigo} · {l.descricao}</td></tr>
                {l.areas.map((a, ai) => (
                  <Fragment key={`a${a.id}`}>
                    <tr className="break-inside-avoid"><td colSpan={11 + v.dias.length} className={`${cel} bg-[#173761] font-semibold text-white`}>{a.codigo} · {a.descricao}</td></tr>
                    {a.linhas.map((ln, i) => (
                      <Fragment key={ln.id}>
                        <tr className="break-inside-avoid">
                          <td rowSpan={2} className={`${cel} align-middle`}>{li + 1}.{ai + 1}.{i + 1}</td>
                          <td rowSpan={2} className={`${cel} align-middle font-semibold`}>{ln.codigo_simova}</td>
                          <td rowSpan={2} className={`${cel} align-middle`}>{ln.descricao}{ln.id_crono && <div className="text-[9px] text-black/60">{ln.id_crono}</div>}</td>
                          <td rowSpan={2} className={`${cel} align-middle`}>{ln.item_pq ?? '—'}</td>
                          <td rowSpan={2} className={`${cel} text-center align-middle`}>{ln.unidade ?? ''}</td>
                          <td rowSpan={2} className={`${cel} text-right align-middle`}>{ln.qtd_projeto != null ? fmt(ln.qtd_projeto) : ''}</td>
                          <td rowSpan={2} className={`${cel} align-middle`}>{ln.encarregado ?? ln.equipe ?? ''}</td>
                          <td className={`${cel} bg-[#FFFF00] text-center font-bold`}>P</td>
                          {ln.previsto.map((q, di) => <td key={di} className={`${cel} bg-[#FFFF00] text-right`}>{q ? fmt(q) : ''}</td>)}
                          <td className={`${cel} bg-[#FFFF00] text-right font-semibold`}>{ln.total_previsto ? fmt(ln.total_previsto) : ''}</td>
                          <td rowSpan={2} className={`${cel} text-right align-middle`}>{ln.calc?.total_hh_previsto ? fmt(ln.calc.total_hh_previsto, 1) : ''}</td>
                          <td rowSpan={2} className={`${cel} text-right align-middle`}>{ln.pu ? fmt(ln.pu * ln.total_previsto) : ''}</td>
                        </tr>
                        <tr className="break-inside-avoid">
                          <td className={`${cel} text-center font-bold`}>R</td>
                          {ln.realizado.map((q, di) => <td key={di} className={`${cel} text-right`}>{q ? fmt(q) : ''}</td>)}
                          <td className={`${cel} text-right font-semibold`}>{ln.total_realizado ? fmt(ln.total_realizado) : ''}</td>
                        </tr>
                      </Fragment>
                    ))}
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={9 + v.dias.length} className={`${cel} text-right font-bold`}>HH previsto (CPU da obra) · Faturamento previsto no período</td>
              <td className={`${cel} text-right font-bold`}>{v.total_hh_previsto ? fmt(v.total_hh_previsto, 1) : ''}</td>
              <td className={`${cel} text-right font-bold`}>{fmt(totalValor)}</td>
            </tr>
            <tr><td colSpan={11 + v.dias.length} className="pt-6">
              <div className="grid grid-cols-3 gap-8 text-center text-[10px]">
                {['Planejamento', 'Produção', 'Cliente / fiscalização'].map((x) => <div key={x} className="border-t border-black pt-1">{x}</div>)}
              </div>
            </td></tr>
          </tfoot>
        </table>
      </div>
      <style>{`@page { size: A3 landscape; margin: 8mm; }`}</style>
    </div>
  );
}
