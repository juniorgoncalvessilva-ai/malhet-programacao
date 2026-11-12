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
  const [vista, setVista] = useState<'setor' | 'frente'>(() => {
    try { return localStorage.getItem('malhet.organograma.vista') === 'frente' ? 'frente' : 'setor'; } catch { return 'setor'; }
  });
  const trocar = (v: 'setor' | 'frente') => { setVista(v); try { localStorage.setItem('malhet.organograma.vista', v); } catch { /* sem armazenamento */ } };
  const org = useOrganograma(q, vista);
  const raiz = org.data?.raiz;
  const setores = raiz?.filhos.filter((f) => !['Sem equipe', 'Em mobilização', 'Sem setor'].includes(f.titulo)).length ?? 0;
  const frentes = new Set<string>();
  const juntar = (n?: NoOrganograma | null) => { if (!n) return; if (n.tipo === 'frente' && n.titulo !== 'Sem frente') frentes.add(n.titulo); n.filhos.forEach(juntar); };
  juntar(raiz);
  return (
    <>
      <Cabecalho
        eyebrow="Efetivo · organograma"
        titulo="Organograma da obra"
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador rotulo="Efetivo no organograma" valor={org.data?.total ?? '—'} />
        <Indicador rotulo={vista === 'frente' ? 'Frentes de trabalho' : 'Setores'} valor={vista === 'frente' ? frentes.size : setores} />
        <Indicador rotulo="Sem equipe" valor={contar(raiz, 'Sem equipe')} />
        <Indicador rotulo="Em mobilização" valor={contar(raiz, 'Em mobilização')} />
      </div>
      <Painel titulo="Quem responde a quem?">
        <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1 rounded-full border border-m-stroke bg-m-surface-raised p-0.5" role="group" aria-label="Organizar o organograma">
          {([['setor', 'Por setor'], ['frente', 'Por frente de trabalho']] as const).map(([v, r]) => (
            <button key={v} type="button" aria-pressed={vista === v} onClick={() => trocar(v)}
              className={`h-9 rounded-full px-4 text-[13px] font-semibold ${vista === v ? 'bg-m-accent text-white' : 'text-m-text-secondary hover:bg-m-surface-hover'}`}>{r}</button>
          ))}
        </div>
        <Campo rotulo="Buscar no organograma" placeholder="Setor, supervisor, equipe, função, nome ou matrícula" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-md" />
        </div>
        {vista === 'frente' && <p className="text-[12.5px] text-m-text-muted">Gerente → dono do setor → frente de trabalho → área → equipes. A frente da equipe vem do cadastro em <Link href="/app/equipes" className="font-semibold text-m-accent underline">Equipes</Link>; sem ela, da área onde a equipe está na programação mais recente.</p>}
        {org.isLoading && <p className="text-sm text-m-text-muted">Carregando…</p>}
        {!org.isLoading && !raiz && <p className="text-sm text-m-text-muted">Ninguém no organograma para essa busca.</p>}
        {raiz && <OrganogramaArvore key={vista} porFrente={vista === 'frente'} raiz={raiz} ariaLabel="Organograma da obra" expandirTudo={!!q} cores={org.data?.cores}
          acoes={<Link href="/app/efetivo/setores" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-m-stroke bg-m-surface-raised px-3 text-[12.5px] font-medium text-m-text-primary hover:bg-m-surface-hover"><Palette size={14} /> Setores e cores</Link>} />}
      </Painel>
    </>
  );
}
