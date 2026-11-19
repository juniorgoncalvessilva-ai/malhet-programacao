'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Botao, Campo, Painel, Pilula } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';

interface Pedido {
  id: number; disciplina: string | null; observacao: string | null; criado_em: string | null; nome_sugerido: string | null;
  lider: { id: number; nome: string; matricula: string | null; funcao: string | null } | null;
  membros: { cracha: string; nome: string; matricula: string | null; funcao: string | null; equipe: string | null; equipe_agora: string | null }[];
}

/**
 * Pedidos de equipe dos líderes (spec 114): o líder sem equipe apontou quem está com ele; aqui o Planejamento/
 * administrador confere e aprova (cria a equipe no padrão de nome e move as pessoas) ou recusa com o motivo.
 */
export function PedidosEquipe({ podeDecidir }: { podeDecidir: boolean }) {
  const api = useApi();
  const q = useQuery({ queryKey: ['lideres-pedidos'], queryFn: () => api.get<Pedido[]>('/lideres/pedidos') });
  const [nomes, setNomes] = useState<Record<number, string>>({});
  const [recusando, setRecusando] = useState<number | null>(null);
  const [motivo, setMotivo] = useState('');
  if (!q.data?.length) return null;
  const aprovar = async (p: Pedido) => {
    try {
      const r = await api.post<{ nome: string; membros: number }>(`/lideres/pedidos/${p.id}/aprovar`, { nome: nomes[p.id]?.trim() || null });
      toast.success(`${r.nome} criada com ${r.membros} pessoa(s); o líder já vê a equipe no link`);
    } catch (e) { toast.error((e as Error).message); }
  };
  const recusar = async (p: Pedido) => {
    try { await api.post(`/lideres/pedidos/${p.id}/recusar`, { motivo }); toast.success('Pedido recusado; o líder vê o motivo no link'); setRecusando(null); setMotivo(''); } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <Painel titulo={`Quem está pedindo equipe? (${q.data.length})`} subtitulo="Líderes sem equipe apontaram quem está com eles. Ao aprovar, a equipe é criada com o líder como encarregado e as pessoas saem da equipe em que estão hoje.">
      <div className="flex flex-col gap-3">
        {q.data.map((p) => (
          <div key={p.id} className="flex flex-col gap-2 rounded-m-md border border-m-stroke-subtle p-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <b className="text-[15px] text-m-text-primary">{p.lider?.nome}</b>
              <span className="text-[12.5px] text-m-text-muted">{[p.lider?.matricula, p.lider?.funcao].filter(Boolean).join(' · ')}</span>
              <Pilula tom="atencao">{p.disciplina}</Pilula>
              {p.criado_em && <span className="text-[12px] text-m-text-muted">pedido em {new Date(p.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>}
            </div>
            <ul className="grid gap-1 text-[13px] sm:grid-cols-2">
              {p.membros.map((m) => (
                <li key={m.cracha} className="text-m-text-secondary"><span className="text-m-text-primary">{m.nome}</span> · {m.matricula ?? m.cracha}{m.funcao ? ` · ${m.funcao}` : ''}
                  <span className={m.equipe_agora ? ' text-m-warning' : ' text-m-text-muted'}>{m.equipe_agora ? ` · sai da ${m.equipe_agora}` : ' · sem equipe'}</span></li>
              ))}
            </ul>
            {p.observacao && <p className="text-[13px] italic text-m-text-secondary">“{p.observacao}”</p>}
            {podeDecidir && (recusando === p.id ? (
              <div className="flex flex-wrap items-end gap-2">
                <Campo rotulo="Motivo da recusa (o líder vê)" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full max-w-[420px]" />
                <Botao variante="secundario" onClick={() => recusar(p)} disabled={motivo.trim().length < 5}><X size={16} /> Recusar</Botao>
                <Botao variante="secundario" onClick={() => setRecusando(null)}>Voltar</Botao>
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <Campo rotulo="Nome da equipe" value={nomes[p.id] ?? p.nome_sugerido ?? ''} onChange={(e) => setNomes({ ...nomes, [p.id]: e.target.value })} className="w-[280px]" />
                <Botao onClick={() => aprovar(p)}><Check size={16} /> Aprovar e criar a equipe</Botao>
                <Botao variante="secundario" onClick={() => { setRecusando(p.id); setMotivo(''); }}><X size={16} /> Recusar</Botao>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Painel>
  );
}
