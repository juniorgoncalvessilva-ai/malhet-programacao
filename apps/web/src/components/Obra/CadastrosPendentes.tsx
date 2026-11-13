'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';

interface Pendente { id: number; nome: string; funcao: string | null; empresa: string; cadastrado_por: string | null; cadastrado_em: string | null }

export function usePendentesCadastro(meus = false) {
  const api = useApi();
  return useQuery({ queryKey: ['presenca', 'pendentes', meus], queryFn: () => api.get<Pendente[]>(`/presenca/cadastros-pendentes${meus ? '?meus=true' : ''}`) });
}

/**
 * Alerta do DP/RH (spec 065): pessoas cadastradas de forma simplificada no campo (nome + função) esperando a matrícula.
 * O planejamento/admin completa aqui; se a planilha do DP trouxer a pessoa com o mesmo nome, completa sozinho.
 */
export function CadastrosPendentes() {
  const api = useApi();
  const { pode } = useObra();
  const q = usePendentesCadastro();
  const [mat, setMat] = useState<Record<number, string>>({});
  const lista = q.data ?? [];
  if (!lista.length) return null;
  const completar = async (p: Pendente, concluido = true) => {
    try { await api.put(`/presenca/cadastros-pendentes/${p.id}`, { matricula: mat[p.id] || null, concluido }); toast.success(`Cadastro de ${p.nome} completo`); } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <section className="flex flex-col gap-2 rounded-m-lg border border-m-warning/50 bg-m-warning-subtle p-4">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-m-warning"><AlertTriangle size={18} /> {lista.length} cadastro(s) feito(s) no campo para completar</h2>
      <p className="text-[12.5px] text-m-text-secondary">Crachá lido sem cadastro e pessoa fora do efetivo: entrou com nome e função do de-para. Informe a matrícula (ou importe a planilha do DP com a pessoa).</p>
      <ul className="flex flex-col gap-1.5">
        {lista.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-m-md bg-m-surface-raised px-3 py-2 text-[13px]">
            <span className="min-w-0 flex-1"><b>{p.nome}</b> · {p.funcao ?? '—'}<span className="block text-[11.5px] text-m-text-muted">por {p.cadastrado_por ?? '—'}{p.cadastrado_em ? ` em ${new Date(p.cadastrado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}</span></span>
            {pode('planejador') && (
              <>
                <input aria-label={`Matrícula de ${p.nome}`} placeholder="matrícula" value={mat[p.id] ?? ''} onChange={(e) => setMat({ ...mat, [p.id]: e.target.value })} className="h-9 w-32 rounded-[8px] border border-m-stroke bg-m-surface-field px-2" />
                <button type="button" disabled={!mat[p.id]} onClick={() => completar(p)} className="h-9 rounded-full bg-m-accent px-3 text-[12.5px] font-semibold text-white disabled:opacity-40">Completar</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
