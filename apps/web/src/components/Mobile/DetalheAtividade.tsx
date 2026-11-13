'use client';

import { AlertTriangle, Plus, Users, X } from 'lucide-react';
import { useEffect } from 'react';
import { dataLonga, num } from '@/components/Mobile/campo';
import { useEquipes } from '@/hooks/programacao/queries';
import { Link } from '@/i18n/navigation';
import { useObra } from '@/lib/obra/ObraProvider';
import { nomeLinha, type ModoNomes } from '@/lib/programacao/nomes';
import type { LinhaVisao, SituacaoEfetivo } from '@/lib/api/types';

const SITUACAO: Partial<Record<SituacaoEfetivo, string>> = {
  MOBILIZADO: 'mobilizado', AGUARDANDO_CRACHA: 'aguardando crachá', EM_PROCESSO: 'em processo', PREVISTO: 'previsto',
  AFASTADO: 'afastado', DESMOBILIZADO: 'desmobilizado', DESISTENCIA: 'desistência',
};

/**
 * Detalhe da atividade na aba Programação do celular (spec 061): frente em destaque, o quantitativo (dia, período e
 * projeto), o efetivo da equipe e os atalhos para lançar a produção ou abrir uma ocorrência já com a atividade e o dia.
 */
export function DetalheAtividade({ ln, local, area, data, k, nomes, onFechar }: {
  ln: LinhaVisao; local: string; area: string; data: string; k: number; nomes: ModoNomes; onFechar: () => void;
}) {
  const { pode, podeVerMobile: ver } = useObra();
  const equipes = useEquipes();
  const eq = equipes.data?.find((e) => e.id === ln.equipe_id);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);

  const p = ln.previsto[k];
  const r = ln.realizado[k];
  const un = ln.unidade ?? '';
  const encarregado = eq?.encarregado_efetivo?.nome ?? ln.encarregado ?? eq?.encarregado_nome?.replace(/^\s*\d+\s*::\s*/, '') ?? null;
  const membros = (eq?.membros ?? []).filter((m) => m.efetivo?.situacao !== 'DESMOBILIZADO' && m.efetivo?.situacao !== 'DESISTENCIA');
  const mobilizados = membros.filter((m) => m.efetivo?.situacao === 'MOBILIZADO').length + (eq?.encarregado_efetivo?.situacao === 'MOBILIZADO' ? 1 : 0);
  const porFuncao = membros.reduce<Record<string, number>>((a, m) => { const f = m.efetivo?.funcao ?? m.funcao ?? 'Sem função'; a[f] = (a[f] ?? 0) + 1; return a; }, {});
  const q = `?data=${data}&linha=${ln.id}`;
  const dado = (rotulo: string, valor: string, destaque = false) => (
    <div className="flex flex-col rounded-[12px] bg-m-surface-base px-3 py-2">
      <span className="text-[11px] font-medium uppercase tracking-[0.4px] text-m-text-muted">{rotulo}</span>
      <span className={`text-[16px] tabular-nums ${destaque ? 'font-bold' : 'font-semibold'}`}>{valor}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45" onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div role="dialog" aria-modal="true" aria-label={`Atividade ${ln.codigo_simova}`}
        className="flex max-h-[88dvh] w-full max-w-[480px] flex-col overflow-y-auto rounded-t-[24px] bg-m-surface-raised pb-[max(env(safe-area-inset-bottom),16px)]">
        <div className="sticky top-0 z-10 flex flex-col gap-0.5 rounded-t-[24px] bg-m-accent-strong px-[18px] pb-3 pt-4 text-m-on-accent">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.5px] opacity-80">Frente · {local}</span>
            <button type="button" aria-label="Fechar" onClick={onFechar} className="-mr-2 -mt-2 grid h-10 w-10 place-items-center rounded-full"><X size={20} /></button>
          </div>
          <span className="text-[19px] font-bold leading-6">{area}</span>
          {ln.cwp && <span className="text-[12.5px] font-medium opacity-90">CWP {ln.cwp.texto}</span>}
        </div>

        <div className="flex flex-col gap-4 px-[18px] pt-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[12px] font-medium uppercase leading-4 tracking-[0.48px] text-m-success">{ln.grupo.descricao} · {ln.codigo_simova}</span>
            <span className="text-[17px] font-semibold leading-[22px]">{nomeLinha(ln, nomes)}</span>
            <span className="text-[12.5px] capitalize text-m-text-muted">{dataLonga(data)}</span>
          </div>

          {pode('encarregado') && (ver('/m/lancar') || ver('/m/ocorrencias')) && (
            <div className="grid grid-cols-2 gap-2.5">
              {ver('/m/lancar') && <Link href={`/m/lancar${q}`} className="flex h-[52px] items-center justify-center gap-1.5 rounded-full bg-m-accent-strong text-[15px] font-semibold text-m-on-accent"><Plus size={18} /> Lançar produção</Link>}
              {ver('/m/ocorrencias') && <Link href={`/m/ocorrencias/nova${q}`} className="flex h-[52px] items-center justify-center gap-1.5 rounded-full border-2 border-m-warning text-[15px] font-semibold text-m-warning"><AlertTriangle size={18} /> Ocorrência</Link>}
            </div>
          )}

          <section className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold text-m-text-secondary">Quantitativo</h3>
            <div className="grid grid-cols-2 gap-2">
              {dado('Previsto no dia', `${num(p)} ${un}`, true)}
              {dado('Realizado no dia', r == null ? 'não lançado' : `${num(r)} ${un}`, true)}
              {dado('Previsto no período', `${num(ln.total_previsto)} ${un}`)}
              {dado('Realizado no período', `${num(ln.total_realizado)} ${un}`)}
              {ln.qtd_periodo != null && dado('Meta do período', `${num(ln.qtd_periodo)} ${un}`)}
              {ln.qtd_projeto != null && dado('Quantidade de projeto', `${num(ln.qtd_projeto)} ${un}`)}
              {ln.restante != null && dado('Resta no projeto', `${num(ln.restante)} ${un}`)}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-m-text-secondary"><Users size={15} /> Efetivo da equipe</h3>
            {!ln.equipe_id && <p className="text-[13px] text-m-text-muted">Atividade sem equipe.</p>}
            {ln.equipe_id && (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[15px] font-semibold">{eq?.nome ?? ln.equipe}</span>
                  <span className="text-[12.5px] text-m-text-muted">{mobilizados} mobilizado(s) de {membros.length + (encarregado ? 1 : 0)}</span>
                </div>
                {encarregado && <span className="text-[13px]">Encarregado: <b>{encarregado}</b></span>}
                {Object.keys(porFuncao).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(porFuncao).sort((a, b) => b[1] - a[1]).map(([f, n]) => (
                      <span key={f} className="rounded-full bg-m-accent-subtle px-2.5 py-1 text-[12px] font-medium text-m-accent">{n} {f}</span>
                    ))}
                  </div>
                )}
                <ul className="flex flex-col">
                  {membros.map((m) => (
                    <li key={m.cracha} className="flex items-start justify-between gap-2 border-t border-m-stroke-subtle py-2 text-[13px]">
                      <span className="min-w-0"><span className="block font-medium">{m.efetivo?.nome ?? m.nome}</span><span className="block text-[12px] text-m-text-muted">{[m.cracha, m.efetivo?.funcao ?? m.funcao].filter(Boolean).join(' · ')}</span></span>
                      {m.efetivo && <span className={`shrink-0 text-[11.5px] font-semibold ${m.efetivo.situacao === 'MOBILIZADO' ? 'text-m-success' : 'text-m-warning'}`}>{SITUACAO[m.efetivo.situacao] ?? m.efetivo.situacao}</span>}
                    </li>
                  ))}
                  {!membros.length && <li className="text-[13px] text-m-text-muted">{equipes.isLoading ? 'Carregando…' : 'Nenhum membro cadastrado na equipe.'}</li>}
                </ul>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
