'use client';

import { Palette } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { OrganogramaArvore } from '@/components/Obra/OrganogramaArvore';
import { Cabecalho, Campo, Indicador, Painel } from '@/components/Obra/ui';
import { useOrganograma } from '@/hooks/programacao/planejamento';
import type { NoOrganograma } from '@/lib/api/types';

const contar = (n: NoOrganograma | null | undefined, titulo: string): number =>
  !n ? 0 : (n.titulo === titulo ? n.qtd : 0) + n.filhos.reduce((s, f) => s + contar(f, titulo), 0);

export default function OrganogramaPage() {
  const [busca, setBusca] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => { const t = setTimeout(() => setQ(busca.trim()), 300); return () => clearTimeout(t); }, [busca]);
  const org = useOrganograma(q);
  const raiz = org.data?.raiz;
  const setores = raiz?.filhos.filter((f) => !['Sem equipe', 'Em mobilização', 'Sem setor'].includes(f.titulo)).length ?? 0;
  return (
    <>
      <Cabecalho
        eyebrow="Efetivo · organograma"
        titulo="Organograma da obra"
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador rotulo="Efetivo no organograma" valor={org.data?.total ?? '—'} />
        <Indicador rotulo="Setores" valor={setores} />
        <Indicador rotulo="Sem equipe" valor={contar(raiz, 'Sem equipe')} />
        <Indicador rotulo="Em mobilização" valor={contar(raiz, 'Em mobilização')} />
      </div>
      <Painel titulo="Quem responde a quem?">
        <Campo rotulo="Buscar no organograma" placeholder="Setor, supervisor, equipe, função, nome ou matrícula" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-md" />
        {org.isLoading && <p className="text-sm text-m-text-muted">Carregando…</p>}
        {!org.isLoading && !raiz && <p className="text-sm text-m-text-muted">Ninguém no organograma para essa busca.</p>}
        {raiz && <OrganogramaArvore raiz={raiz} ariaLabel="Organograma da obra" expandirTudo={!!q} cores={org.data?.cores}
          acoes={<Link href="/app/efetivo/setores" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-m-stroke bg-m-surface-raised px-3 text-[12.5px] font-medium text-m-text-primary hover:bg-m-surface-hover"><Palette size={14} /> Setores e cores</Link>} />}
      </Painel>
    </>
  );
}
