'use client';

import { LayoutGrid, LogOut, Menu as MenuIcon, Moon, Sun, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { useSessao } from '@/lib/auth/AuthProvider';
import { cn } from '@/lib/utils';
import { APP_NOME, MENU, OBRA } from './menu';

function Logo() {
  return (
    <>
      <img src="/brand/malhet.svg" alt="Malhet" className="h-[22px] w-auto dark:hidden" />
      <img src="/brand/malhet-escuro.svg" alt="Malhet" className="hidden h-[22px] w-auto dark:block" />
    </>
  );
}

function Lateral({ onNavegar }: { onNavegar?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col gap-[22px] py-5 pl-6 pr-3">
      <div className="flex h-8 items-center gap-2.5 px-2.5">
        <Logo />
        <span className="h-[18px] w-px bg-m-stroke" />
        <span className="text-sm font-medium text-m-text-secondary">{APP_NOME}</span>
      </div>
      <div className="flex items-center gap-2.5 rounded-m-md border border-m-stroke-subtle px-3 py-2.5">
        <div className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-m-sm bg-m-accent-strong text-[10px] font-bold text-m-on-accent">
          {OBRA.sigla}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[13px] font-semibold leading-[18px]">{OBRA.nome}</span>
          <span className="truncate text-[11px] leading-4 text-m-text-muted">{OBRA.contrato}</span>
        </div>
      </div>
      <nav className="flex flex-col gap-[22px]" aria-label="Menu do app">
        {MENU.map((g) => (
          <div key={g.etapa} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 px-2.5 pb-1.5 text-[11px] font-semibold uppercase leading-4 tracking-[0.48px] text-m-text-muted">
              <span className="h-1.5 w-1.5 rounded-[2px]" style={{ background: g.cor }} />
              {g.etapa}
            </div>
            {g.itens.map((i) => {
              const ativo = pathname?.startsWith(i.url);
              const Icone = i.icone;
              return (
                <Link
                  key={i.url}
                  href={i.url}
                  onClick={onNavegar}
                  aria-current={ativo ? 'page' : undefined}
                  className={cn(
                    'relative flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-sm transition-colors',
                    ativo ? 'bg-m-surface-active font-semibold text-m-accent' : 'text-m-text-secondary hover:bg-m-surface-hover',
                  )}
                >
                  {ativo && <span className="absolute -left-3 top-2 h-5 w-[3px] rounded-sm" style={{ background: g.cor }} />}
                  <Icone size={18} strokeWidth={1.75} aria-hidden="true" />
                  <span>{i.titulo}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <span className="mt-auto flex h-9 items-center gap-2.5 px-2.5 text-sm text-m-text-secondary">
        <LayoutGrid size={18} strokeWidth={1.75} aria-hidden="true" />
        Todos os apps Malhet
      </span>
    </div>
  );
}

function Tema() {
  const { resolvedTheme, setTheme } = useTheme();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const escuro = montado && resolvedTheme === 'dark';
  return (
    <button
      type="button"
      aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
      onClick={() => setTheme(escuro ? 'light' : 'dark')}
      className="grid h-9 w-9 place-items-center rounded-full border border-m-stroke-subtle text-m-text-secondary hover:bg-m-surface-hover"
    >
      {escuro ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

function Usuario() {
  const { usuario, sair, desabilitado } = useSessao();
  const [aberto, setAberto] = useState(false);
  const iniciais = (usuario?.email ?? '?').slice(0, 2).toUpperCase();
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Conta"
        aria-expanded={aberto}
        onClick={() => setAberto(!aberto)}
        className="grid h-9 w-9 place-items-center rounded-full bg-m-accent-strong text-[13px] font-semibold text-m-on-accent"
      >
        {iniciais}
      </button>
      {aberto && (
        <div className="absolute right-0 top-11 z-50 w-64 rounded-m-lg border border-m-stroke-subtle bg-m-surface-raised p-2 shadow-m-md">
          <div className="px-3 py-2">
            <div className="truncate text-sm font-semibold">{usuario?.email}</div>
            <div className="text-xs text-m-text-muted">
              {usuario?.admin ? 'Administrador' : 'Usuário'}{desabilitado ? ' · modo dev' : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setAberto(false); sair(); }}
            className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-sm text-m-text-secondary hover:bg-m-surface-hover"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      )}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [gaveta, setGaveta] = useState(false);
  const atual = MENU.flatMap((g) => g.itens).find((i) => pathname?.startsWith(i.url));
  return (
    <div className="min-h-screen bg-m-surface-base text-m-text-primary">
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] border-r border-m-stroke-subtle bg-m-surface-raised lg:block">
        <Lateral />
      </aside>
      {gaveta && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Fechar menu" className="absolute inset-0 bg-black/30" onClick={() => setGaveta(false)} />
          <aside className="absolute inset-y-0 left-0 w-[264px] bg-m-surface-raised">
            <button type="button" aria-label="Fechar menu" onClick={() => setGaveta(false)} className="absolute right-3 top-5 p-1 text-m-text-muted"><X size={18} /></button>
            <Lateral onNavegar={() => setGaveta(false)} />
          </aside>
        </div>
      )}
      <div className="flex min-h-screen flex-col lg:ml-[248px]">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-m-stroke-subtle bg-m-surface-raised px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" aria-label="Abrir menu" onClick={() => setGaveta(true)} className="-ml-1 p-1 text-m-text-secondary lg:hidden"><MenuIcon size={20} /></button>
            <nav aria-label="Trilha" className="truncate text-[13px] text-m-text-muted">
              Malhet <span className="text-m-stroke-strong">/</span> {APP_NOME}
              {atual && <> <span className="text-m-stroke-strong">/</span> <b className="font-semibold text-m-text-primary">{atual.titulo}</b></>}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Tema />
            <Usuario />
          </div>
        </header>
        <main className="flex flex-col gap-5 px-4 pb-10 pt-7 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
