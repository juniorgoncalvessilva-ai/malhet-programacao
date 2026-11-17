'use client';

import { ScanFace, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { type PessoaBase, rostoLiberado } from '@/lib/presenca/offline';

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/**
 * Rosto não cadastrado (spec 103): a câmera achou um rosto que não bate com ninguém. Escolhe quem é, confirma o
 * consentimento da pessoa (LGPD — só o descritor é guardado, nunca a foto) e a presença já entra. Sem internet, vai na fila.
 */
export function CadastroRosto({ pessoas, online, onFechar, onSalvar }: {
  pessoas: PessoaBase[]; online: boolean; onFechar: () => void; onSalvar: (p: PessoaBase) => Promise<void>;
}) {
  const [busca, setBusca] = useState('');
  const [escolhida, setEscolhida] = useState<PessoaBase | null>(null);
  const [consentiu, setConsentiu] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const achados = useMemo(() => {
    const t = semAcento(busca.trim());
    if (t.length < 2) return [];
    return pessoas.filter((p) => semAcento(p.nome).includes(t) || (p.matricula ?? '').includes(t) || p.codigos.some((c) => c.includes(t))).slice(0, 30);
  }, [busca, pessoas]);
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 font-[Figtree,system-ui,sans-serif]" role="dialog" aria-modal="true" aria-labelledby="rosto-titulo">
      <div className="flex max-h-[90dvh] w-full max-w-[480px] flex-col gap-3 overflow-y-auto rounded-t-[24px] bg-m-surface-raised p-4 pb-[max(env(safe-area-inset-bottom),16px)] text-m-text-primary">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-m-warning-subtle text-m-warning"><ScanFace size={20} aria-hidden="true" /></span>
          <div className="flex-1">
            <h2 id="rosto-titulo" className="text-[18px] font-semibold leading-6">Rosto não cadastrado</h2>
            <p className="text-[13px] text-m-text-tertiary">Quem é? Cadastre o rosto agora e a presença já entra.</p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-full border border-m-stroke"><X size={18} /></button>
        </div>
        {!escolhida ? (
          <>
            <label className="flex items-center gap-2 rounded-[14px] border-2 border-m-accent-strong px-3">
              <Search size={18} className="text-m-text-muted" aria-hidden="true" />
              <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou matrícula" aria-label="Buscar a pessoa"
                className="h-12 min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] outline-none focus:ring-0" />
            </label>
            <ul className="flex flex-col">
              {achados.map((p) => {
                const pode = rostoLiberado(p);
                return (
                  <li key={p.id}>
                    <button type="button" disabled={!pode} onClick={() => { setEscolhida(p); setConsentiu(false); }}
                      className="flex min-h-[56px] w-full flex-col items-start justify-center border-b border-m-stroke-subtle px-1 text-left disabled:opacity-50">
                      <span className="text-[15px] font-medium">{p.nome}</span>
                      <span className="text-[12px] text-m-text-muted">{[p.matricula, p.funcao].filter(Boolean).join(' · ')}{p.face ? ' · já tem rosto' : ''}{!pode ? ' · não autorizou o rosto no termo LGPD' : ''}</span>
                    </button>
                  </li>
                );
              })}
              {busca.trim().length >= 2 && !achados.length && <li className="py-3 text-[13px] text-m-text-muted">Ninguém com esse nome no efetivo baixado. Use o crachá (Código) para o cadastro rápido.</li>}
            </ul>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-[14px] border border-m-stroke-subtle p-3">
              <b className="text-[16px]">{escolhida.nome}</b>
              <span className="block text-[12.5px] text-m-text-muted">{[escolhida.matricula, escolhida.funcao].filter(Boolean).join(' · ')}</span>
              {escolhida.face && <span className="mt-1 block text-[12.5px] text-m-warning">Já tem rosto cadastrado: o novo substitui o anterior.</span>}
            </div>
            <label className="flex items-start gap-3 rounded-[14px] bg-m-accent-subtle p-3 text-[14px] leading-5">
              <input type="checkbox" checked={consentiu} onChange={(e) => setConsentiu(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
              <span><b>{escolhida.nome.split(' ')[0]}</b> autoriza usar o rosto para registrar a presença (LGPD). Guardamos só os números do rosto, nunca a foto; pode revogar quando quiser.</span>
            </label>
            <button type="button" disabled={!consentiu || salvando} onClick={async () => { setSalvando(true); try { await onSalvar(escolhida); } finally { setSalvando(false); } }}
              className="h-14 rounded-full bg-m-accent-strong text-[16px] font-semibold text-m-on-accent disabled:opacity-40">
              {salvando ? 'Salvando…' : 'Cadastrar rosto e registrar presença'}
            </button>
            <button type="button" onClick={() => setEscolhida(null)} className="h-11 rounded-full border border-m-stroke text-[14px] font-semibold text-m-text-secondary">Escolher outra pessoa</button>
            {!online && <span className="text-center text-[12px] text-m-text-muted">Sem internet: fica guardado no celular e sobe quando o sinal voltar.</span>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
