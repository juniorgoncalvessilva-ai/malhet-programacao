'use client';

/** Qual interface usar neste aparelho: "campo" (celular, /m) ou "completo" (computador/tablet, /app).
 * Automático pelo aparelho; a pessoa pode trocar (botão "Completo" no celular, "App de campo" no menu) e a escolha
 * fica guardada neste navegador. */
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';

export type Interface = 'campo' | 'completo';
const CHAVE = 'malhet.interface';

/** Celular: navegador móvel (Android "Mobile", iPhone, iPod…) ou tela estreita com toque. Tablet fica no completo. */
export function ehCelular(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPod|Android.+Mobile|Windows Phone|BlackBerry|Opera Mini|IEMobile/i.test(ua)) return true;
  const toque = window.matchMedia?.('(pointer: coarse)').matches;
  return !!toque && window.innerWidth < 768;
}

export function preferencia(): Interface | null {
  try { const v = localStorage.getItem(CHAVE); return v === 'campo' || v === 'completo' ? v : null; } catch { return null; }
}

/** Guarda a escolha; com `null` volta ao automático. */
export function escolherInterface(v: Interface | null): void {
  try { if (v) localStorage.setItem(CHAVE, v); else localStorage.removeItem(CHAVE); } catch { /* sem storage */ }
}

export function interfaceDoAparelho(): Interface {
  return preferencia() ?? (ehCelular() ? 'campo' : 'completo');
}

/** Tela do completo → equivalente no campo (o resto cai no Início do campo). */
export function rotaDoCampo(pathname: string): string {
  if (pathname.startsWith('/app/restricoes')) return '/m/restricoes';
  if (pathname.startsWith('/app/desvios')) return '/m/ocorrencias';
  if (pathname.startsWith('/app/programacoes') || pathname.startsWith('/app/vigente')) return '/m/lancar';
  return '/m';
}

/** Tela do campo → equivalente no completo. */
export function rotaDoCompleto(pathname: string): string {
  if (pathname.startsWith('/m/restricoes')) return '/app/restricoes';
  if (pathname.startsWith('/m/ocorrencias')) return '/app/desvios';
  if (pathname.startsWith('/m/lancar') || pathname.startsWith('/m/pendencias')) return '/app/programacoes';
  return '/app/vigente';
}

/** Leva para a interface do aparelho. `pronto` = já pode desenhar (evita piscar a tela errada). */
export function useAdequarInterface(estou: Interface): { pronto: boolean; celular: boolean } {
  const router = useRouter();
  const pathname = usePathname();
  const [estado, setEstado] = useState({ pronto: false, celular: false });
  useEffect(() => {
    const alvo = interfaceDoAparelho();
    const celular = ehCelular();
    if (alvo !== estou) {
      router.replace(alvo === 'campo' ? rotaDoCampo(pathname) : rotaDoCompleto(pathname));
      return;
    }
    setEstado({ pronto: true, celular });
  }, [estou, pathname, router]);
  return estado;
}

/** Envolve a interface: redireciona se o aparelho pede a outra e só desenha quando é a certa. */
export function AdequarInterface({ estou, children }: { estou: Interface; children: React.ReactNode }) {
  const { pronto } = useAdequarInterface(estou);
  if (!pronto) {
    return (
      <div className="grid min-h-screen place-items-center bg-m-surface-base">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-m-accent border-t-transparent" />
      </div>
    );
  }
  return <>{children}</>;
}
