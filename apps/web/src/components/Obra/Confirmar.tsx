'use client';

import { AlertTriangle, Info } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Botao } from '@/components/Obra/ui';

/** Confirmação padrão dos CRUDs (no lugar do window.confirm do navegador). */
export interface PedidoConfirmacao {
  titulo: string;
  mensagem?: ReactNode;
  /** Texto do botão de ação. Padrão: "Excluir" (perigo) ou "Confirmar". */
  acao?: string;
  /** Ação destrutiva (excluir, remover, desvincular): botão vermelho. Padrão: true. */
  perigo?: boolean;
  /** Se informado, roda ao confirmar; o diálogo mostra "aguarde" e só fecha quando terminar. */
  executar?: () => Promise<unknown>;
}

type Pendente = PedidoConfirmacao & { resolver: (ok: boolean) => void };
const Ctx = createContext<((p: PedidoConfirmacao) => Promise<boolean>) | null>(null);

export function ConfirmarProvider({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<Pendente | null>(null);
  const [rodando, setRodando] = useState(false);
  const confirmar = useCallback((p: PedidoConfirmacao) => new Promise<boolean>((resolver) => setPedido({ ...p, resolver })), []);
  const fechar = useCallback((ok: boolean) => { setPedido((p) => { p?.resolver(ok); return null; }); setRodando(false); }, []);

  useEffect(() => {
    if (!pedido) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && !rodando) fechar(false); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [pedido, rodando, fechar]);

  const perigo = pedido?.perigo ?? true;
  const ok = async () => {
    if (!pedido) return;
    if (!pedido.executar) { fechar(true); return; }
    setRodando(true);
    try { await pedido.executar(); fechar(true); } catch { setRodando(false); fechar(false); }
  };

  return (
    <Ctx.Provider value={confirmar}>
      {children}
      {pedido && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4 print:hidden" onMouseDown={(e) => { if (e.target === e.currentTarget && !rodando) fechar(false); }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirmar-titulo" aria-describedby="confirmar-mensagem"
            className="w-full max-w-[460px] rounded-[20px] border border-m-stroke bg-m-surface-raised p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${perigo ? 'bg-m-danger-subtle text-m-danger' : 'bg-m-accent-subtle text-m-accent'}`} aria-hidden="true">
                {perigo ? <AlertTriangle size={20} /> : <Info size={20} />}
              </span>
              <div className="flex min-w-0 flex-col gap-1.5">
                <h2 id="confirmar-titulo" className="text-[17px] font-semibold leading-6 text-m-text-primary">{pedido.titulo}</h2>
                {pedido.mensagem && <div id="confirmar-mensagem" className="text-[14px] leading-5 text-m-text-secondary">{pedido.mensagem}</div>}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Botao autoFocus variante="secundario" disabled={rodando} onClick={() => fechar(false)}>Cancelar</Botao>
              <Botao disabled={rodando} onClick={ok} variante={perigo ? 'excluir' : 'primario'}>
                {rodando ? 'Aguarde…' : pedido.acao ?? (perigo ? 'Excluir' : 'Confirmar')}
              </Botao>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

/** `const confirmar = useConfirmar(); if (await confirmar({ titulo: 'Excluir a equipe X?' })) …` */
export function useConfirmar() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useConfirmar fora do ConfirmarProvider');
  return c;
}
