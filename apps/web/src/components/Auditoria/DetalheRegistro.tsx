'use client';

import { Copy, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Miniatura } from '@/components/Mobile/Fotos';
import { useApi } from '@/hooks/programacao/useApi';
import { type RegistroAuditoria, compartilharWhatsapp, dataBR } from '@/lib/auditorias';

const COR: Record<RegistroAuditoria['status'], string> = {
  rascunho: 'bg-m-surface-active text-m-text-secondary', adequada: 'bg-m-success-subtle text-m-success',
  plano: 'bg-m-warning-subtle text-m-warning', concluida: 'bg-m-info-subtle text-m-info',
};
export const corStatusRegistro = (s: RegistroAuditoria['status']) => COR[s];

/** Um registro de auditoria: dados, fotos (antes/depois), ação gerada e reenvio pelo WhatsApp. */
export function DetalheRegistro({ r }: { r: RegistroAuditoria }) {
  const api = useApi();
  const enviar = async () => {
    try {
      const { texto } = await api.get<{ texto: string }>(`/auditorias/registros/${r.id}/texto`);
      const fotos = await Promise.all(r.fotos.map((f) => api.blob(`/fotos/${f.id}/arquivo`)));
      if ((await compartilharWhatsapp(texto, fotos)) === 'link') toast.info('WhatsApp aberto com o texto; anexe as fotos na conversa.', { duration: 8000 });
    } catch (e) { if ((e as Error).name !== 'AbortError') toast.error((e as Error).message); }
  };
  const copiar = async () => { const { texto } = await api.get<{ texto: string }>(`/auditorias/registros/${r.id}/texto`); await navigator.clipboard?.writeText(texto); toast.success('Texto copiado'); };
  const linha = (rot: string, v: string | null | undefined) => (v ? <div className="flex gap-2 text-[13px]"><span className="w-40 shrink-0 text-m-text-muted">{rot}</span><span className="text-m-text-primary">{v}</span></div> : null);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${COR[r.status]}`}>{r.status_rotulo}</span>
        {r.acao && <span className="text-[12.5px] text-m-text-secondary">Ação Nº {r.acao.numero} · {r.acao.status}</span>}
      </div>
      {linha('Tipo de registro', r.tipo_registro)}
      {linha('Local / Frente', [r.local, r.area_texto].filter(Boolean).join(' / '))}
      {linha('Data', dataBR(r.data))}
      {linha('Eng.º responsável', r.engenheiro)}
      {linha('Encarregado', r.encarregado)}
      {linha('RAC', r.rac)}
      {linha('Não conformidade', r.nao_conformidade)}
      {linha('Medida corretiva', r.medida_corretiva)}
      {linha('VER E AGIR', r.ver_agir == null ? null : r.ver_agir ? 'SIM' : 'NÃO')}
      {r.ver_agir === false && linha('Plano de ação', `${r.plano_responsavel ?? '—'} · prazo ${dataBR(r.plano_prazo)}`)}
      {linha('Acompanhamento', r.acompanhamento)}
      {linha('Registrado por', r.auditor)}
      {r.fotos.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {(['antes', 'depois'] as const).map((m) => r.fotos.some((f) => f.momento === m) && (
            <div key={m} className="flex flex-wrap items-center gap-2"><span className="w-16 text-[12px] font-semibold uppercase text-m-text-muted">{m}</span>
              {r.fotos.filter((f) => f.momento === m).map((f) => <Miniatura key={f.id} id={f.id} tamanho={72} />)}</div>
          ))}
        </div>
      )}
      {r.status !== 'rascunho' && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={enviar} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#1F8F4E] px-4 text-[14px] font-semibold text-white"><Send size={16} /> Enviar no WhatsApp</button>
          <button type="button" onClick={copiar} className="inline-flex h-11 items-center gap-2 rounded-full border border-m-stroke px-4 text-[14px] font-semibold"><Copy size={16} /> Copiar texto</button>
        </div>
      )}
    </div>
  );
}
