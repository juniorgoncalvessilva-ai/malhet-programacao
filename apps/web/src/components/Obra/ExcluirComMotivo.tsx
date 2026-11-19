'use client';

import { Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Confirmação de exclusão com motivo (spec 112): o motivo é obrigatório e vai para o histórico de exclusões junto com a
 * cópia do que saiu, quem e quando.
 */
export function ExcluirComMotivo({ titulo, descricao, onConfirmar, onFechar }: {
  titulo: string; descricao: string; onConfirmar: (motivo: string) => Promise<void>; onFechar: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const ok = motivo.trim().length >= 5;
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 p-0 font-[Figtree,system-ui,sans-serif] sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="excluir-titulo"
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className="flex w-full max-w-[480px] flex-col gap-3 rounded-t-[24px] bg-m-surface-raised p-5 pb-[max(env(safe-area-inset-bottom),20px)] text-m-text-primary sm:rounded-[20px]">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-m-danger-subtle text-m-danger"><Trash2 size={18} aria-hidden="true" /></span>
          <div className="flex-1"><h2 id="excluir-titulo" className="text-[18px] font-semibold leading-6">{titulo}</h2>
            <p className="text-[13.5px] text-m-text-tertiary">{descricao}</p></div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-full border border-m-stroke"><X size={18} /></button>
        </div>
        <label className="flex flex-col gap-1 text-[12px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Por que está excluindo?
          <textarea autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={500}
            className="rounded-[14px] border border-m-stroke bg-m-surface-field p-3 text-[15px] normal-case tracking-normal text-m-text-primary outline-none focus:border-m-accent-strong"
            placeholder="ex.: registrada na frente errada, foto duplicada" />
        </label>
        <p className="text-[12.5px] text-m-text-muted">Não dá para desfazer. Fica no histórico de exclusões: o que saiu, quem excluiu, quando e o motivo.</p>
        {erro && <p role="alert" className="text-[13.5px] text-m-danger">{erro}</p>}
        <button type="button" disabled={!ok || enviando} onClick={async () => { setEnviando(true); setErro(''); try { await onConfirmar(motivo.trim()); } catch (e) { setErro((e as Error).message); } finally { setEnviando(false); } }}
          className="h-12 rounded-full bg-m-danger text-[15px] font-semibold text-white disabled:opacity-40">{enviando ? 'Excluindo…' : 'Excluir'}</button>
      </div>
    </div>,
    document.body,
  );
}
