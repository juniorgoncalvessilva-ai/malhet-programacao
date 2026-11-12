'use client';

import { Download, Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';

/** Evento do Chrome/Android que permite abrir o "instalar app" na hora certa. */
interface PedidoInstalar extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const CHAVE = 'malhet.instalar.dispensado';
const DIAS = 7;

const instalado = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true);
const ios = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);

/** Oferece instalar o app no celular quando ele ainda não está instalado. Android: botão que abre o "instalar"; iPhone:
 * o caminho no Safari (Compartilhar → Adicionar à Tela de Início). "Agora não" esconde por 7 dias. */
export function OfertaInstalar() {
  const [pedido, setPedido] = useState<PedidoInstalar | null>(null);
  const [mostrar, setMostrar] = useState<'android' | 'ios' | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { /* sem SW: só não instala */ });
    if (instalado()) return;
    try {
      const em = Number(localStorage.getItem(CHAVE) || 0);
      if (em && Date.now() - em < DIAS * 86400000) return;
    } catch { /* sem storage */ }
    const ouvir = (e: Event) => { e.preventDefault(); setPedido(e as PedidoInstalar); setMostrar('android'); };
    window.addEventListener('beforeinstallprompt', ouvir);
    if (ios()) setMostrar('ios');
    const instalou = () => setMostrar(null);
    window.addEventListener('appinstalled', instalou);
    return () => { window.removeEventListener('beforeinstallprompt', ouvir); window.removeEventListener('appinstalled', instalou); };
  }, []);

  const dispensar = () => { setMostrar(null); try { localStorage.setItem(CHAVE, String(Date.now())); } catch { /* sem storage */ } };
  if (!mostrar) return null;
  return (
    <aside aria-label="Instalar o app" className="flex items-start gap-3 rounded-[20px] border border-m-accent-strong/30 bg-m-accent-subtle p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/icone-192.png" alt="" className="h-11 w-11 shrink-0 rounded-[12px]" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-[15px] font-semibold leading-5">Instale o app Malhet no celular</span>
        {mostrar === 'android' ? (
          <>
            <span className="text-[13px] leading-[18px] text-m-text-secondary">Abre direto na tela de início, em tela cheia, como um aplicativo.</span>
            <button type="button" onClick={async () => { await pedido?.prompt(); const r = await pedido?.userChoice; if (r?.outcome === 'accepted') setMostrar(null); else dispensar(); }}
              className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-full bg-m-accent-strong px-5 text-[14px] font-semibold text-m-on-accent"><Download size={16} /> Instalar</button>
          </>
        ) : (
          <span className="text-[13px] leading-[18px] text-m-text-secondary">No Safari, toque em <Share size={14} className="inline align-[-2px]" aria-label="Compartilhar" /> <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.</span>
        )}
      </div>
      <button type="button" onClick={dispensar} aria-label="Agora não" className="-mr-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center text-m-text-muted"><X size={18} /></button>
    </aside>
  );
}
