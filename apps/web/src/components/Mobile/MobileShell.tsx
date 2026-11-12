'use client';

import { AlertTriangle, ClipboardCheck, Fish, House, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { OfertaInstalar } from '@/components/Mobile/OfertaInstalar';
import { useObra } from '@/lib/obra/ObraProvider';

const NAV = [
  { href: '/m', rotulo: 'Início', icone: House },
  { href: '/m/lancar', rotulo: 'Lançar', icone: Plus },
  { href: '/m/ocorrencias', rotulo: 'Ocorrências', icone: AlertTriangle },
  { href: '/m/restricoes', rotulo: 'Restrições', icone: Fish },
  { href: '/m/pendencias', rotulo: 'Pendências', icone: ClipboardCheck },
] as const;

/** Casca do app de campo: coluna de celular (até 480 px), conteúdo rolando e barra inferior fixa com alvos de 44 px+. */
export function MobileShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { obra, carregando } = useObra();
  return (
    <div className="flex min-h-[100dvh] justify-center bg-m-surface-base font-[Figtree,system-ui,sans-serif] text-m-text-primary">
      <div className="relative flex w-full max-w-[480px] flex-col">
        <main className="flex flex-1 flex-col gap-3.5 px-4 pb-28 pt-[max(env(safe-area-inset-top),16px)]">
          <OfertaInstalar />
          {obra ? children : <p className="pt-10 text-center text-sm text-m-text-muted">{carregando ? 'Carregando obra…' : 'Sem acesso a nenhuma obra.'}</p>}
        </main>
        <nav aria-label="Navegação do campo" className="fixed bottom-0 left-1/2 z-20 grid w-full max-w-[480px] -translate-x-1/2 grid-cols-5 border-t border-m-stroke-subtle bg-m-surface-raised pb-[max(env(safe-area-inset-bottom),10px)] pt-2">
          {NAV.map(({ href, rotulo, icone: Icone }) => {
            const ativo = href === '/m' ? pathname === '/m' : pathname.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={ativo ? 'page' : undefined} 
                className={`flex min-h-[48px] flex-col items-center justify-center gap-1 text-[11px] ${ativo ? 'font-semibold text-m-accent' : 'font-medium text-m-text-muted'}`}>
                <Icone size={24} strokeWidth={2} aria-hidden="true" />{rotulo}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
