'use client';

import { TituloAba } from '@/components/Obra/LogosObra';
import { SincronizarDados } from '@/lib/tempo-real';

import { SincronizarPresenca } from '@/lib/presenca/SincronizarPresenca';
import { SincronizarFila } from '@/lib/offline/SincronizarFila';
import { useEffect, type ReactNode } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { OfertaInstalar } from '@/components/Mobile/OfertaInstalar';
import { itemMobileDe } from '@/components/Mobile/menu';
import { BarraCampo, AvisoTeste } from '@/components/Mobile/BarraCampo';
import { useObra } from '@/lib/obra/ObraProvider';

/** Casca do app de campo: coluna de celular (até 480 px), conteúdo rolando e barra inferior fixa com alvos de 44 px+. */
export function MobileShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { obra, carregando, podeVerMobile } = useObra();
  const router = useRouter();
  // telas liberadas para a pessoa (Acessos › Celular, spec 066); tela fora da lista volta para o Início
  const dona = itemMobileDe(pathname);
  const bloqueada = !!obra && !!dona && !podeVerMobile(dona.url);
  useEffect(() => { if (bloqueada) router.replace('/m'); }, [bloqueada, router]);
  return (
    <div className="flex min-h-[100dvh] justify-center bg-m-surface-base font-[Figtree,system-ui,sans-serif] text-m-text-primary">
      <div className="relative flex w-full max-w-[480px] flex-col">
        <main className="flex flex-1 flex-col gap-3.5 px-4 pb-28 pt-[max(env(safe-area-inset-top),16px)]">
          <AvisoTeste />
          <OfertaInstalar />
          <TituloAba />
          <SincronizarDados />
          {obra && <SincronizarPresenca />}
          {obra && <SincronizarFila />}
          {obra ? (bloqueada ? <p className="pt-10 text-center text-sm text-m-text-muted">Tela não liberada para você nesta obra.</p> : children) : <p className="pt-10 text-center text-sm text-m-text-muted">{carregando ? 'Carregando obra…' : 'Sem acesso a nenhuma obra.'}</p>}
        </main>
        <BarraCampo pathname={pathname} />
      </div>
    </div>
  );
}
