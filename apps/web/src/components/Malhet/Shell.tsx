'use client';

import { Check, ChevronsUpDown, LayoutGrid, LogOut, Menu as MenuIcon, Moon, Sun, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { ehCelular, escolherInterface } from '@/lib/dispositivo/interface';
import { Link, usePathname } from '@/i18n/navigation';
import { useSessao } from '@/lib/auth/AuthProvider';
import { cn } from '@/lib/utils';
import { useObra } from '@/lib/obra/ObraProvider';
import { APP_NOME, MENU, type GrupoMenu } from './menu';

function Logo() {
  return (
    <>
      <img src="/brand/malhet.svg" alt="Malhet" className="h-[22px] w-auto dark:hidden" />
      <img src="/brand/malhet-escuro.svg" alt="Malhet" className="hidden h-[22px] w-auto dark:block" />
    </>
  );
}

const PAPEL: Record<string, string> = { admin: 'Admin da obra', planejador: 'Planejador', encarregado: 'Encarregado', leitor: 'Leitor', seguranca: 'Segurança (SSMA)' };

function SeletorObra() {
  const { obras, obra, escolher, superadmin } = useObra();
  const [aberto, setAberto] = useState(false);
  if (!obra) {
    return (
      <div className="rounded-m-md border border-dashed border-m-stroke px-3 py-2.5 text-xs text-m-text-muted">
        {superadmin ? 'Nenhuma obra ainda. Crie em Obras e usuários.' : 'Sem obra liberada para você.'}
      </div>
    );
  }
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        onClick={() => setAberto(!aberto)}
        className="flex w-full items-center gap-2.5 rounded-m-md border border-m-stroke-subtle px-3 py-2.5 text-left hover:bg-m-surface-hover"
      >
        <div className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-m-sm bg-m-accent-strong text-[10px] font-bold text-m-on-accent">
          {obra.codigo.slice(0, 4)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] font-semibold leading-[18px]">{obra.nome}</span>
          <span className="truncate text-[11px] leading-4 text-m-text-muted">{obra.contrato || PAPEL[obra.papel]}</span>
        </div>
        {obras.length > 1 && <ChevronsUpDown size={15} className="shrink-0 text-m-text-muted" aria-hidden="true" />}
      </button>
      {aberto && obras.length > 1 && (
        <ul role="listbox" aria-label="Obras" className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-80 overflow-auto rounded-m-lg border border-m-stroke-subtle bg-m-surface-raised p-1.5 shadow-m-md">
          {obras.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={o.id === obra.id}
                onClick={() => { escolher(o.id); setAberto(false); }}
                className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left hover:bg-m-surface-hover"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-m-sm bg-m-accent-subtle text-[10px] font-bold text-m-accent">{o.codigo.slice(0, 4)}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-semibold">{o.nome}</span>
                  <span className="text-[11px] text-m-text-muted">{PAPEL[o.papel]}</span>
                </span>
                {o.id === obra.id && <Check size={15} className="text-m-accent" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function useMenuVisivel(): GrupoMenu[] {
  const { pode, superadmin, editaSsma, podeVer } = useObra();
  return MENU.map((g) => ({ ...g, itens: g.itens.filter((i) => (i.superadmin ? superadmin : i.ssma ? editaSsma : !i.minimo || pode(i.minimo)) && podeVer(i.url)) }))
    .filter((g) => g.itens.length);
}

function Lateral({ onNavegar }: { onNavegar?: () => void }) {
  const pathname = usePathname();
  const menu = useMenuVisivel();
  return (
    <div className="flex h-full flex-col gap-[22px] py-5 pl-6 pr-3">
      <div className="flex h-8 items-center gap-2.5 px-2.5">
        <Logo />
        <span className="h-[18px] w-px bg-m-stroke" />
        <span className="text-sm font-medium text-m-text-secondary">{APP_NOME}</span>
      </div>
      <SeletorObra />
      <nav className="flex flex-col gap-[22px]" aria-label="Menu do app">
        {menu.map((g) => (
          <div key={g.etapa} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 px-2.5 pb-1.5 text-[11px] font-semibold uppercase leading-4 tracking-[0.48px] text-m-text-muted">
              <span className="h-1.5 w-1.5 rounded-[2px]" style={{ background: g.cor }} />
              {g.etapa}
            </div>
            {g.itens.map((i) => {
              const ativo = itemAtivo(pathname) === i.url;
              const Icone = i.icone;
              return (
                <Link
                  key={i.url}
                  href={i.url}
                  onClick={() => { if (i.url === '/m') escolherInterface('campo'); onNavegar?.(); }}
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
  const { superadmin, papel } = useObra();
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
              {superadmin ? 'Super Admin' : papel ? PAPEL[papel] : 'Sem obra'}{desabilitado ? ' · modo dev' : ''}
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
  const atual = MENU.flatMap((g) => g.itens).find((i) => i.url === itemAtivo(pathname));
  const { obra, carregando, superadmin } = useObra();
  const telaAdmin = pathname?.startsWith('/app/admin');
  return (
    <div className="min-h-screen bg-m-surface-base text-m-text-primary">
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] border-r border-m-stroke-subtle bg-m-surface-raised lg:block print:hidden">
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
      <div className="flex min-h-screen flex-col lg:ml-[248px] print:ml-0">
        <header className="sticky top-0 z-40 flex h-16 print:hidden items-center justify-between gap-3 border-b border-m-stroke-subtle bg-m-surface-raised px-4 sm:px-8">
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
        <AvisoCelular />
        <main className="flex flex-col gap-5 px-4 pb-10 pt-7 sm:px-8 print:p-0">
          {obra || telaAdmin || carregando ? children : <SemObra superadmin={superadmin} />}
        </main>
      </div>
    </div>
  );
}

function SemObra({ superadmin }: { superadmin: boolean }) {
  return (
    <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 rounded-m-xl border border-m-stroke-subtle bg-m-surface-raised p-10 text-center">
      <span className="text-[11px] font-semibold uppercase tracking-[0.48px] text-m-text-muted">Sem obra</span>
      <h1 className="text-[22px] font-semibold leading-7">
        {superadmin ? 'Crie a primeira obra para começar' : 'Você ainda não tem acesso a nenhuma obra'}
      </h1>
      <p className="text-sm text-m-text-tertiary">
        {superadmin
          ? 'Em Obras e usuários você cadastra a obra e libera quem vai programar.'
          : 'Peça ao administrador da obra para liberar o seu e-mail.'}
      </p>
      {superadmin && (
        <Link href="/app/admin/obras" className="mt-2 inline-flex h-10 items-center rounded-full bg-m-accent-strong px-4 text-sm font-semibold text-m-on-accent">
          Ir para Obras e usuários
        </Link>
      )}
    </div>
  );
}

/** Item do menu da rota atual: o de caminho mais específico (/app/ssma/cadastros não acende /app/ssma). */
export function itemAtivo(pathname: string | null): string | undefined {
  if (!pathname) return undefined;
  return MENU.flatMap((g) => g.itens).map((i) => i.url)
    .filter((u) => pathname === u || pathname.startsWith(`${u}/`) || pathname.endsWith(u) || pathname.includes(`${u}/`))
    .sort((a, b) => b.length - a.length)[0];
}

/** No celular, quem escolheu o app completo vê o atalho de volta para o app de campo. */
function AvisoCelular() {
  const [celular, setCelular] = useState(false);
  useEffect(() => { setCelular(ehCelular()); }, []);
  if (!celular) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-m-stroke-subtle bg-m-accent-subtle px-4 py-2 text-[13px] text-m-text-primary print:hidden">
      <span>Você está no app completo.</span>
      <Link href="/m" onClick={() => escolherInterface('campo')} className="font-semibold text-m-accent underline">Abrir o app de campo</Link>
    </div>
  );
}
