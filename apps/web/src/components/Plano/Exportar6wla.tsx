'use client';

import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Calculado, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { Esqueleto } from '@/components/Obra/Esqueleto';
import { Botao, Campo, Painel, Selecao, dataBR } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';

interface Versao { id: number; rotulo: string; data_base: string | null; vigente: boolean; carregado_em: string }
interface Previa {
  cronograma: string | null; linha_base: string | null; linha_base_id: number | null; semana_corrente: number; semana_dd: number;
  inicio: string; fim: string; atividades: number; do_cronograma: number; so_plano: number; com_restricao: number;
  memorias: Record<string, MemoriaCalculo>;
}

// data local (não UTC: às 22h de sábado o UTC já é a semana seguinte)
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/**
 * Spec 108: Sessão de Look Ahead (6WLA) em Excel no layout da obra — semana corrente + 1ª a 6ª semana, atividades do
 * cronograma (P6) na estrutura da WBS e as do plano fora do cronograma, linha de base escolhida e restrições 6M.
 */
export function Exportar6wla() {
  const api = useApi();
  const [referencia, setReferencia] = useState(hoje);
  const [base, setBase] = useState<string>('');
  const [baixando, setBaixando] = useState(false);
  const versoes = useQuery({ queryKey: ['6wla-versoes'], queryFn: () => api.get<Versao[]>('/planos/seis-semanas/versoes') });
  const qs = `referencia=${referencia}${base ? `&base_id=${base}` : ''}`;
  const previa = useQuery({ queryKey: ['6wla-previa', qs], queryFn: () => api.get<Previa>(`/planos/seis-semanas/previa?${qs}`), enabled: !!referencia });
  const p = previa.data;
  const mem = (k: string) => () => p!.memorias[k];
  const baixar = async () => {
    setBaixando(true);
    try {
      const n = await api.download(`/planos/seis-semanas.xlsx?${qs}`, `6WLA_S${p?.semana_corrente ?? ''}.xlsx`);
      toast.success(`6WLA gerado com ${n} atividade(s)`);
    } catch (e) { toast.error((e as Error).message); } finally { setBaixando(false); }
  };
  return (
    <Painel titulo="Quer levar o 6WLA para a reunião?" subtitulo="Excel no layout da Sessão de Look Ahead: semana corrente + 6 semanas, na estrutura do cronograma (P6), com as restrições por 6M.">
      <div className="flex flex-wrap items-end gap-3">
        <Campo rotulo="Semana corrente (qualquer dia dela)" type="date" value={referencia} onChange={(e) => setReferencia(e.target.value)} className="w-[200px]" />
        <Selecao rotulo="Linha de base (BL)" value={base || String(p?.linha_base_id ?? '')} onChange={(e) => setBase(e.target.value)} className="w-[280px]">
          {versoes.data?.map((v) => <option key={v.id} value={v.id}>{v.rotulo}{v.data_base ? ` · DD ${dataBR(v.data_base)}` : ''}{v.vigente ? ' · vigente' : ''}</option>)}
          {!versoes.data?.length && <option value="">importe o cronograma (.xer)</option>}
        </Selecao>
        <Botao onClick={baixar} disabled={baixando || !p}><FileSpreadsheet size={16} /> {baixando ? 'Gerando…' : 'Exportar 6WLA (Excel)'}</Botao>
      </div>
      <div className="mt-3 text-[13px] text-m-text-secondary">
        {!p ? <Esqueleto className="h-4 w-[420px] max-w-full" /> : (
          <>Semanas <b className="text-m-text-primary">S{p.semana_corrente} a S{p.semana_corrente + 6}</b> ({dataBR(p.inicio)} a {dataBR(p.fim)}) ·{' '}
            <Calculado chave="atividades" memoria={mem('atividades')}>{p.atividades}</Calculado> atividade(s) ({p.do_cronograma} do cronograma, {p.so_plano} só do plano nestas semanas) ·{' '}
            <Calculado chave="com_restricao" memoria={mem('com_restricao')}>{p.com_restricao}</Calculado> com restrição 6M · semana DD do cronograma S{p.semana_dd}
            {p.cronograma && <span className="text-m-text-muted"> · cronograma vigente {p.cronograma}</span>}</>
        )}
      </div>
    </Painel>
  );
}
