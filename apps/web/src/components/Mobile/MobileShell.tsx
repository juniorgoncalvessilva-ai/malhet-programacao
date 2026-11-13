'use client';

import { TituloAba } from '@/components/Obra/LogosObra';
import { SincronizarDados } from '@/lib/tempo-real';

import { SincronizarPresenca } from '@/lib/presenca/SincronizarPresenca';
import { useEffect, type ReactNode } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { OfertaInstalar } from '@/components/Mobile/OfertaInstalar';
import { MENU_MOBILE, itemMobileDe } from '@/components/Mobile/menu';
import { useObra } from '@/lib/obra/ObraProvider';

/** Casca do app de campo: coluna de celular (até 480 px), conteúdo rolando e barra inferior fixa com alvos de 44 px+. */
export function MobileShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { obra, carregando, podeVerMobile } = useObra();
  const router = useRouter();
  // telas liberadas para a pessoa (Acessos › Celular, spec 066); tela fora da lista volta para o Início
  const nav = MENU_MOBILE.filter((i) => i.barra && podeVerMobile(i.url));
  const dona = itemMobileDe(pathname);
  const bloqueada = !!obra && !!dona && !podeVerMobile(dona.url);
  useEffect(() => { if (bloqueada) router.replace('/m'); }, [bloqueada, router]);
  return (
    <div className="flex min-h-[100dvh] justify-center bg-m-surface-base font-[Figtree,system-ui,sans-serif] text-m-text-primary">
      <div className="relative flex w-full max-w-[480px] flex-col">
        <main className="flex flex-1 flex-col gap-3.5 px-4 pb-28 pt-[max(env(safe-area-inset-top),16px)]">
          <OfertaInstalar />
          <TituloAba />
          <SincronizarDados />
          {obra && <SincronizarPresenca />}
          {obra ? (bloqueada ? <p className="pt-10 text-center text-sm text-m-text-muted">Tela não liberada para você nesta obra.</p> : children) : <p className="pt-10 text-center text-sm text-m-text-muted">{carregando ? 'Carregando obra…' : 'Sem acesso a nenhuma obra.'}</p>}
        </main>
        <nav aria-label="Navegação do campo" className="fixed bottom-0 left-1/2 z-20 grid w-full max-w-[480px] -translate-x-1/2 border-t border-m-stroke-subtle bg-m-surface-raised pb-[max(env(safe-area-inset-bottom),10px)] pt-2" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
          {nav.map(({ url: href, titulo: rotulo, icone: Icone, destaque }) => {
            const ativo = href === '/m' ? pathname === '/m' : pathname.startsWith(href);
            if (destaque) return (
              <Link key={href} href={href} aria-current={ativo ? 'page' : undefined} aria-label="Presença: ler crachá ou rosto"
                className="-mt-6 flex flex-col items-center gap-1 text-[10.5px] font-semibold text-m-accent">
                <span className={`grid h-14 w-14 place-items-center rounded-full bg-m-accent-strong text-m-on-accent shadow-lg ring-4 ring-m-surface-raised ${ativo ? 'scale-105' : ''}`}><Icone size={28} strokeWidth={2} aria-hidden="true" /></span>
                {rotulo}
              </Link>
            );
            return (
              <Link key={href} href={href} aria-current={ativo ? 'page' : undefined} 
                className={`flex min-h-[48px] flex-col items-center justify-center gap-1 text-[10.5px] ${ativo ? 'font-semibold text-m-accent' : 'font-medium text-m-text-muted'}`}>
                <Icone size={24} strokeWidth={2} aria-hidden="true" />{rotulo}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
