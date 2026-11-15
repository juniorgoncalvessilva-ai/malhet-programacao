'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Selecao } from '@/components/Obra/ui';
import { useFuncoesContratacao } from '@/hooks/programacao/treinamentos';
import { useApi } from '@/hooks/programacao/useApi';
import type { FuncaoContratacao } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';

/**
 * Função de contratação padronizada (spec 089): escolhe da lista da obra (de-para + funções do efetivo). O planejamento
 * cria uma função nova ali mesmo; o de-para com a CPU pode ser feito depois em De-para de funções.
 */
export function SeletorFuncao({ rotulo = 'Função', valor, onTrocar, disabled, className }: {
  rotulo?: string; valor: string; onTrocar: (funcao: string) => void; disabled?: boolean; className?: string;
}) {
  const { pode } = useObra();
  const api = useApi();
  const lista = useFuncoesContratacao();
  const [nova, setNova] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const fs = lista.data ?? [];
  const atual = valor && !fs.some((f) => f.funcao === valor) ? valor : null;
  const criar = async () => {
    if (!nova?.trim()) return;
    setSalvando(true);
    try {
      const f = await api.post<FuncaoContratacao>('/efetivo/funcoes/nova', { funcao: nova });
      toast.success(`Função ${f.funcao} criada (faça o de-para depois)`);
      onTrocar(f.funcao); setNova(null);
    } catch (e) { toast.error((e as Error).message); } finally { setSalvando(false); }
  };
  if (nova !== null) {
    return (
      <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
        <span className="text-[11px] font-semibold uppercase leading-4 tracking-[0.48px] text-m-text-muted">Nova função de contratação</span>
        <div className="flex gap-1.5">
          <input autoFocus aria-label="Nome da nova função" value={nova} onChange={(e) => setNova(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); criar(); } if (e.key === 'Escape') setNova(null); }}
            className="h-10 min-w-0 flex-1 rounded-m-md border border-m-accent bg-m-surface-field px-3 text-sm text-m-text-primary outline-none" placeholder="ex.: MONTADOR DE ANDAIME" />
          <button type="button" disabled={salvando || nova.trim().length < 3} onClick={criar} className="h-10 rounded-m-md bg-m-accent px-3 text-[13px] font-semibold text-white disabled:opacity-50">Criar</button>
          <button type="button" onClick={() => setNova(null)} className="h-10 rounded-m-md border border-m-stroke px-3 text-[13px] text-m-text-secondary">✕</button>
        </div>
      </div>
    );
  }
  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      <Selecao rotulo={rotulo} value={valor} disabled={disabled} onChange={(e) => (e.target.value === '__nova' ? setNova('') : onTrocar(e.target.value))}>
        <option value="">{lista.isLoading ? 'Carregando funções…' : 'Escolha a função…'}</option>
        {atual && <option value={atual}>{atual} (fora do cadastro)</option>}
        {fs.map((f) => <option key={f.funcao_chave} value={f.funcao}>{f.funcao}{f.pessoas ? ` · ${f.pessoas}` : ''}{f.criada_na_obra && !f.recurso ? ' · sem de-para' : ''}</option>)}
        {pode('planejador') && <option value="__nova">+ Nova função de contratação…</option>}
      </Selecao>
    </div>
  );
}
