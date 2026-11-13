'use client';

import { CloudOff, Wind } from 'lucide-react';
import { useEffect, useState } from 'react';
import { TopoM, cartaoM } from '@/components/Mobile/ui';
import { Link } from '@/i18n/navigation';
import { useObra } from '@/lib/obra/ObraProvider';
import { useFila } from '@/lib/offline/fila';
import { type SessaoEtilometro, lerSessao, useEventosEtilometro } from '@/lib/preventivos';

const dBR = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

/** Controle preventivo no campo (spec 073): etilômetro (iniciar ou continuar o evento) e os últimos eventos. */
export default function PreventivosCampo() {
  const obraId = useObra().obra?.id ?? 0;
  const [sessao, setSessao] = useState<SessaoEtilometro | null>(null);
  useEffect(() => { if (obraId) lerSessao(obraId).then(setSessao).catch(() => undefined); }, [obraId]);
  const fila = useFila(obraId, 'etilometro').filter((x) => x.estado !== 'enviado');
  const recusados = fila.filter((x) => x.estado === 'recusado');
  const de = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const ev = useEventosEtilometro(`?de=${de}`);
  return (
    <>
      <TopoM titulo="Controle preventivo" sub="etilômetro e outros controles" />
      <Link href="/m/preventivos/etilometro" className="flex items-center gap-4 rounded-[20px] bg-m-accent-strong p-5 text-m-on-accent">
        <Wind size={34} aria-hidden="true" />
        <span className="flex flex-col"><span className="text-[18px] font-semibold">{sessao ? 'Continuar o etilômetro' : 'Iniciar etilômetro'}</span>
          <span className="text-[13px] opacity-85">{sessao ? `${sessao.testes.length} teste(s) · desde ${new Date(sessao.iniciado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Ler crachá → resultado → assinatura'}</span></span>
      </Link>
      {fila.length > 0 && (
        <p className="flex items-start gap-2 rounded-[14px] bg-m-warning-subtle p-3 text-[13px] text-m-warning"><CloudOff size={16} className="mt-0.5 shrink-0" />
          {fila.length - recusados.length} registro(s) guardado(s) neste aparelho esperando internet{recusados.length ? `; ${recusados.length} recusado(s): ${recusados.map((x) => `${x.rotulo} — ${x.erro}`).join('; ')}` : ''}. Não apague os dados do navegador.</p>
      )}
      <section className={cartaoM}>
        <span className="text-[13px] font-medium text-m-text-secondary">Últimos 30 dias</span>
        {(ev.data ?? []).map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-2 border-b border-m-stroke-subtle py-2 last:border-0">
            <span className="min-w-0"><b className="block text-[14px]">Etilômetro Nº {e.numero} · {dBR(e.data)}</b>
              <span className="text-[12px] text-m-text-muted">{e.responsavel} · {e.aparelho.marca} {e.aparelho.modelo}{e.status === 'aberto' ? ' · aberto' : ''}</span></span>
            <span className="shrink-0 text-right text-[12px]"><b className="text-m-success">{e.resumo.aprovados}</b> / <b className="text-m-danger">{e.resumo.reprovados}</b><span className="block text-m-text-muted">{e.resumo.pessoas} pessoas</span></span>
          </div>
        ))}
        {ev.data && !ev.data.length && <span className="text-[13px] text-m-text-muted">Nenhum evento nos últimos 30 dias.</span>}
      </section>
    </>
  );
}
