'use client';

import { CloudOff, RefreshCw, Send, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { useApi } from '@/hooks/programacao/useApi';
import { compartilharWhatsapp, useModelosAuditoria } from '@/lib/auditorias';
import { type DadosAuditoria, textoEnvio } from '@/lib/auditorias/fila';
import { useSessao } from '@/lib/auth/AuthProvider';
import { useObra } from '@/lib/obra/ObraProvider';
import { blobDaFoto, processarFila, removerDaFila, tentarDeNovo, useFila } from '@/lib/offline/fila';

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/**
 * Auditorias guardadas neste aparelho que ainda não chegaram ao servidor (spec 072): esperando internet ou recusadas.
 * Nada some daqui sem confirmação do servidor ou da pessoa.
 */
export function FilaAuditorias({ compacto = false }: { compacto?: boolean }) {
  const { obra } = useObra();
  const { usuario } = useSessao();
  const api = useApi();
  const confirmar = useConfirmar();
  const modelos = useModelosAuditoria();
  const itens = useFila(obra?.id, 'auditoria').filter((x) => x.estado !== 'enviado');
  const [enviando, setEnviando] = useState(false);
  if (!itens.length) return null;
  const pend = itens.filter((x) => x.estado === 'pendente').length;

  const agora = async () => {
    if (!obra) return;
    if (navigator.onLine === false) { toast.info('Ainda sem internet. Sobe sozinho quando a rede voltar.'); return; }
    setEnviando(true);
    try {
      const n = await processarFila(api.post as <T>(p: string, b: unknown) => Promise<T>, obra.id);
      toast[n ? 'success' : 'info'](n ? `${n} auditoria(s) enviada(s)` : 'Não consegui enviar agora; tento de novo sozinho.');
    } finally { setEnviando(false); }
  };

  return (
    <section aria-label="Auditorias guardadas no aparelho" className={`flex flex-col gap-2 rounded-[14px] border border-m-warning/40 bg-m-warning-subtle ${compacto ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[14px] font-semibold text-m-warning"><CloudOff size={18} />
          {pend ? `${pend} auditoria(s) esperando internet` : 'Auditoria(s) recusada(s) pelo servidor'}</span>
        {pend > 0 && <button type="button" onClick={agora} disabled={enviando} className="flex h-9 items-center gap-1.5 rounded-full border border-m-warning/50 px-3 text-[13px] font-semibold text-m-warning disabled:opacity-50">
          <RefreshCw size={14} className={enviando ? 'animate-spin' : ''} /> Enviar agora</button>}
      </div>
      <p className="text-[12.5px] text-m-text-secondary">Guardadas neste aparelho com as fotos. Não apague os dados do navegador até subirem.</p>
      <ul className="flex flex-col gap-1.5">
        {itens.map((x) => {
          const d = x.dados as unknown as DadosAuditoria;
          const m = (modelos.data ?? []).find((y) => y.id === d.modelo_id);
          return (
            <li key={x.id_local} className="flex flex-col gap-1 rounded-[10px] bg-m-surface-raised px-3 py-2 text-[13px]">
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0"><b>{d.tipo}</b>{d.tipo_registro ? ` · ${d.tipo_registro}` : ''}<span className="block truncate text-[12px] text-m-text-muted">{quando(x.criado_em)} · {d.area_texto ?? '—'} · {x.fotos.length} foto(s)</span></span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${x.estado === 'recusado' ? 'bg-m-danger-subtle text-m-danger' : 'bg-m-surface-active text-m-text-secondary'}`}>{x.estado === 'recusado' ? 'Recusada' : 'Na fila'}</span>
              </span>
              <span className="truncate text-[12.5px] text-m-text-secondary">{d.nao_conformidade}</span>
              {x.estado === 'recusado' && <span className="flex items-start gap-1 text-[12px] text-m-danger"><TriangleAlert size={13} className="mt-0.5 shrink-0" />{x.erro}</span>}
              <span className="flex flex-wrap gap-3 pt-0.5 text-[12.5px] font-semibold">
                {m && <button type="button" className="flex items-center gap-1 text-[#1F8F4E]" onClick={() => compartilharWhatsapp(
                  textoEnvio(m.config, { ...d, auditor: usuario?.email ?? null }, obra ? `${obra.codigo} · ${obra.nome}` : null), x.fotos.map(blobDaFoto)).catch(() => undefined)}>
                  <Send size={13} /> WhatsApp</button>}
                {x.estado === 'recusado' && <>
                  <button type="button" className="text-m-accent" onClick={async () => { await tentarDeNovo(x.id_local); agora(); }}>Tentar de novo</button>
                  <button type="button" className="text-m-danger" onClick={async () => {
                    if (await confirmar({ titulo: 'Descartar esta auditoria?', mensagem: 'O registro e as fotos saem deste aparelho e não vão para o servidor. Não dá para desfazer.', perigo: true, acao: 'Descartar' })) await removerDaFila(x.id_local);
                  }}>Descartar</button>
                </>}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
