'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Calculado, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { CARREGANDO, Chip, Indicador, Painel, Pilula, Tabela, td } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import type { Consolidado } from '@/lib/documentos';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const br = (s: string) => s.split('-').reverse().join('/');

/**
 * Consolidado de documentos (spec 129): a central de rastreio do que entrou e saiu na semana ou no mês — revisões (arquivo
 * recebido ou só listada na LDO) e GRDs (com ou sem ciência). Assinado = comprovado (arquivo guardado / ciência registrada).
 */
export function ConsolidadoDocumentos({ onAbrir }: { onAbrir: (id: number) => void }) {
  const api = useApi();
  const [periodo, setPeriodo] = useState<'semana' | 'mes'>('mes');
  const [ref, setRef] = useState(() => new Date());
  const [situacao, setSituacao] = useState<'' | 'assinado' | 'pendente'>('');
  const q = useQuery({
    queryKey: ['documentos', 'consolidado', periodo, iso(ref), situacao],
    queryFn: () => api.get<Consolidado>(`/documentos/consolidado?periodo=${periodo}&ref=${iso(ref)}${situacao ? `&situacao=${situacao}` : ''}`),
  });
  const mover = (n: number) => {
    const d = new Date(ref);
    if (periodo === 'semana') d.setDate(d.getDate() + 7 * n); else d.setMonth(d.getMonth() + n, 1);
    setRef(d);
  };
  const c = q.data;
  const t = c?.totais;
  const pct = t && t.itens ? Math.round((t.assinado / t.itens) * 100) : 0;
  const memoria = (): MemoriaCalculo => ({
    chave: 'assinado', titulo: 'Comprovado no período', valor: `${pct}%`, formula: 'itens assinados ÷ itens do período',
    passos: [{ descricao: 'assinados', conta: `${t?.assinado ?? 0} ÷ ${t?.itens ?? 0}`, resultado: `${pct}%`, destaque: true }],
    fontes: [{ dado: 'revisões com arquivo recebido', valor: String(c?.itens.filter((x) => x.tipo === 'revisao' && x.situacao === 'assinado').length ?? 0), origem: 'Documentos', local: `${c ? br(c.inicio) : ''} a ${c ? br(c.fim) : ''}` },
      { dado: 'GRDs com ciência', valor: String(c?.itens.filter((x) => x.tipo === 'grd' && x.situacao === 'assinado').length ?? 0), origem: 'GRDs', local: null }],
    notas: situacao ? ['Os totais contam o período inteiro; a lista abaixo está filtrada.'] : [],
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip ativo={periodo === 'mes'} onClick={() => setPeriodo('mes')}>Mensal</Chip>
        <Chip ativo={periodo === 'semana'} onClick={() => setPeriodo('semana')}>Semanal</Chip>
        <span className="mx-1 h-5 w-px bg-m-stroke-subtle" aria-hidden="true" />
        <button type="button" aria-label="Período anterior" onClick={() => mover(-1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-m-surface-hover"><ChevronLeft size={18} /></button>
        <span className="min-w-[170px] text-center text-[14px] font-semibold">{c ? `${br(c.inicio)} a ${br(c.fim)}` : '…'}</span>
        <button type="button" aria-label="Próximo período" onClick={() => mover(1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-m-surface-hover"><ChevronRight size={18} /></button>
        <span className="mx-1 h-5 w-px bg-m-stroke-subtle" aria-hidden="true" />
        <Chip ativo={!situacao} onClick={() => setSituacao('')}>Todos</Chip>
        <Chip ativo={situacao === 'assinado'} onClick={() => setSituacao('assinado')}>Assinado</Chip>
        <Chip ativo={situacao === 'pendente'} onClick={() => setSituacao('pendente')}>Pendente</Chip>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador rotulo="No período" valor={t?.itens ?? '—'} detalhe={t ? `${t.revisoes} revisões · ${t.grds} GRDs` : undefined} />
        <Indicador rotulo="Assinado" valor={t?.assinado ?? '—'} tom="sucesso" detalhe="arquivo recebido ou ciência" />
        <Indicador rotulo="Pendente" valor={t?.pendente ?? '—'} tom={t?.pendente ? 'atencao' : undefined} detalhe="sem arquivo ou sem ciência" />
        <Indicador rotulo="Comprovado" valor={t ? <Calculado chave="assinado" memoria={memoria}>{`${pct}%`}</Calculado> : '—'} />
      </div>
      <Painel titulo="O que entrou e saiu no período?" subtitulo="Revisões pela data em que o arquivo chegou (ou a data de envio da LDO, quando ainda não chegou) e GRDs pela data da guia.">
        <Tabela cabecalho={['Data', 'O quê', 'Código', 'Descrição', 'Situação', 'Rastro']} vazio={q.isLoading ? CARREGANDO : !c?.itens.length && 'Nada consolidado neste período.'}>
          {c?.itens.map((x) => (
            <tr key={`${x.tipo}-${x.id}`} className={x.documento_id ? 'cursor-pointer hover:bg-m-surface-hover' : undefined} onClick={() => x.documento_id && onAbrir(x.documento_id)}>
              <td className={`${td} whitespace-nowrap`}>{br(x.data)}</td>
              <td className={td}>{x.tipo === 'grd' ? <Pilula tom="info" ponto={false}>GRD</Pilula> : <Pilula ponto={false}>Rev. {x.revisao}</Pilula>}</td>
              <td className={td}><b className="text-m-text-primary">{x.codigo}</b>{x.pacote && <div className="text-[11px] text-m-text-muted">{x.pacote}</div>}</td>
              <td className={td}>{x.titulo}{x.finalidade && <div className="text-[11px] text-m-text-muted">{x.finalidade}</div>}</td>
              <td className={td}>{x.situacao === 'assinado' ? <Pilula tom="sucesso">Assinado</Pilula> : <Pilula tom="atencao">Pendente</Pilula>}</td>
              <td className={td}><span className="text-[12px]">{x.detalhe}</span><div className="text-[11px] text-m-text-muted">{x.quem}</div></td>
            </tr>
          ))}
        </Tabela>
      </Painel>
    </div>
  );
}
