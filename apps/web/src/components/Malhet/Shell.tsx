'use client';

import { TituloAba, useLogo, useMarcaObra } from '@/components/Obra/LogosObra';
import { SincronizarDados } from '@/lib/tempo-real';
import { SincronizarFila } from '@/lib/offline/SincronizarFila';

import { Bug, Check, ChevronDown, ChevronsUpDown, FlaskConical, GraduationCap, LayoutGrid, LifeBuoy, LogOut, Menu as MenuIcon, Moon, Sun, UserRound, X } from 'lucide-react';
import { RelatarProblema } from '@/components/Erros/Relatos';
import { TutorialComputador, abrirTutorial } from '@/components/Tutorial/Tutoriais';
import { useErrosAbertos } from '@/lib/erros/consultas';
import { Avatar } from '@/components/Perfil/Avatar';
import { Sino } from '@/components/Notificacoes/Sino';
import { nomeDe, usePerfil } from '@/lib/perfil';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { useSessao } from '@/lib/auth/AuthProvider';
import { cn } from '@/lib/utils';
import { useObra } from '@/lib/obra/ObraProvider';
import { BuscaTelas } from './BuscaTelas';
import { MENU, menuDoPerfil, type GrupoMenu } from './menu';

function Logo({ altura = 22 }: { altura?: number }) {
  return (
    <>
      <img src="/brand/malhet.svg" alt="Malhet" style={{ height: altura }} className="w-auto dark:hidden" />
      <img src="/brand/malhet-escuro.svg" alt="Malhet" style={{ height: altura }} className="hidden w-auto dark:block" />
    </>
  );
}

const iniciais = (nome: string) => nome.split(/\s+/).filter((p) => p.length > 2 || /^[A-Z]{2,}$/.test(p)).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || nome.slice(0, 2).toUpperCase();

/**
 * Topo do menu (spec 093): a empresa contratada da obra em destaque — a logo dela (Marca da obra) e o nome —, para a
 * equipe sentir que o sistema é dela. Sem marca cadastrada: as iniciais na cor da obra; sem obra: a logo do Malhet.
 */
function MarcaContratada() {
  const { obra } = useObra();
  const m = useMarcaObra();
  const logo = useLogo('contratada', m.data?.contratada, m.data?.versao);
  const nome = m.data?.nome_contratada?.trim();
  if (!obra || (!nome && !m.data?.contratada)) return <div className="flex h-10 items-center px-2.5"><Logo /></div>;
  return (
    <div className="flex flex-col gap-2 px-2.5">
      {logo.data
        ? <img src={logo.data} alt={nome ? `Logo da ${nome}` : 'Logo da contratada'} className="max-h-14 w-auto max-w-[196px] self-start object-contain" />
        : <>
            <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-m-accent-strong text-[15px] font-extrabold tracking-[0.02em] text-m-on-accent" aria-hidden="true">{iniciais(nome ?? 'Obra')}</span>
            {nome && <span className="text-[17px] font-bold leading-[21px] tracking-[-0.2px] text-m-text-primary">{nome}</span>}
          </>}
    </div>
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
    <div className="relative" data-tour="obra">
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
  const { pode, superadmin, editaSsma, podeVer, menuWeb } = useObra();
  return menuDoPerfil(MENU, menuWeb).map((g) => ({ ...g, itens: g.itens.filter((i) => (i.superadmin ? superadmin : i.ssma ? editaSsma : !i.minimo || pode(i.minimo)) && podeVer(i.url)) }))
    .filter((g) => g.itens.length);
}

/** Grupo do menu em sanfona (spec 131): só um aberto por vez — o da tela atual —, para o menu caber sem barra de rolagem. */
function GrupoLateral({ g, aberto, onAlternar, children }: { g: GrupoMenu; aberto: boolean; onAlternar: () => void; children: React.ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-0.5', g.recolhido && 'mt-1 border-t border-m-stroke-subtle pt-3')}>
      <button type="button" aria-expanded={aberto} onClick={onAlternar}
        className="flex items-center gap-2 rounded-[8px] px-2.5 py-1 text-left text-[11px] font-semibold uppercase leading-4 tracking-[0.48px] text-m-text-muted hover:bg-m-surface-hover hover:text-m-text-secondary">
        <span className="h-1.5 w-1.5 rounded-[2px]" style={{ background: g.cor }} />
        {g.etapa}
        {!aberto && <span className="ml-auto rounded-full bg-m-surface-base px-1.5 text-[10px] font-medium normal-case tracking-normal">{g.itens.length}</span>}
        <ChevronDown size={14} className={cn('transition-transform', aberto ? 'ml-auto' : '-rotate-90', !aberto && 'ml-1')} aria-hidden="true" />
      </button>
      {aberto && <div className="flex flex-col gap-0.5 pt-0.5">{children}</div>}
    </div>
  );
}

function Lateral({ onNavegar }: { onNavegar?: () => void }) {
  const pathname = usePathname();
  const menu = useMenuVisivel();
  const atual = menu.find((g) => g.itens.some((i) => itemAtivo(pathname) === i.url))?.etapa ?? null;
  const [aberto, setAberto] = useState<string | null>(atual ?? menu[0]?.etapa ?? null);
  useEffect(() => { if (atual) setAberto(atual); }, [atual]);
  return (
    <div className="flex h-full flex-col gap-[18px] overflow-y-auto overscroll-contain py-5 pl-6 pr-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <MarcaContratada />
      <SeletorObra />
      <nav className="flex flex-col gap-1.5" aria-label="Menu do app" data-tour="menu">
        {menu.map((g) => (
          <GrupoLateral key={g.etapa} g={g} aberto={aberto === g.etapa} onAlternar={() => setAberto(aberto === g.etapa ? null : g.etapa)}>
            {g.itens.map((i) => {
              const ativo = itemAtivo(pathname) === i.url;
              const Icone = i.icone;
              return (
                <Link
                  key={i.url}
                  href={i.url}
                  data-tour={`menu:${i.url}`}
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
          </GrupoLateral>
        ))}
      </nav>
      <span className="mt-auto flex items-center gap-2 px-2.5 pt-2 text-[11px] text-m-text-muted">
        <LayoutGrid size={14} strokeWidth={1.75} aria-hidden="true" />
        com <span className="opacity-80"><Logo altura={13} /></span>
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
  const { superadmin, superadminReal, simulando, simular, papel } = useObra();
  const perfil = usePerfil();
  const [aberto, setAberto] = useState(false);
  const [relatar, setRelatar] = useState(false);
  const erros = useErrosAbertos().data?.abertos ?? 0;
  return (
    <div className="relative" data-tour="conta">
      {relatar && <RelatarProblema onFechar={() => setRelatar(false)} />}
      <button type="button" aria-label="Conta" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-m-accent">
        <Avatar tamanho={36} />
        {erros > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-m-danger ring-2 ring-m-surface-raised" aria-label={`${erros} erros em aberto`} />}
      </button>
      {aberto && (
        <div className="absolute right-0 top-11 z-50 w-72 rounded-m-lg border border-m-stroke-subtle bg-m-surface-raised p-2 shadow-m-md">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar tamanho={40} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{nomeDe(perfil.data, usuario?.email)}</div>
              <div className="truncate text-xs text-m-text-muted">{usuario?.email}</div>
              <div className="text-xs text-m-text-muted">{superadmin ? 'Super Admin' : papel ? PAPEL[papel] : 'Sem obra'}{desabilitado ? ' · modo dev' : ''}</div>
            </div>
          </div>
          <Link href="/app/perfil" onClick={() => setAberto(false)} className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-sm text-m-text-secondary hover:bg-m-surface-hover">
            <UserRound size={16} /> Meu perfil
          </Link>
          <button type="button" onClick={() => { setAberto(false); abrirTutorial(); }}
            className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-sm text-m-text-secondary hover:bg-m-surface-hover">
            <GraduationCap size={16} /> Ver o tutorial
          </button>
          <button type="button" onClick={() => { setAberto(false); setRelatar(true); }}
            className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-sm text-m-text-secondary hover:bg-m-surface-hover">
            <LifeBuoy size={16} /> Relatar um problema
          </button>
          {superadminReal && (
            <Link href="/app/admin/erros" onClick={() => setAberto(false)} className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-sm text-m-text-secondary hover:bg-m-surface-hover">
              <Bug size={16} /> Erros relatados
              {erros > 0 && <span className="ml-auto rounded-full bg-m-danger px-2 py-0.5 text-[11px] font-bold text-white">{erros}</span>}
            </Link>
          )}
          {superadminReal && (
            <label className="flex flex-col gap-1 px-3 py-2 text-xs font-semibold text-m-accent">
              <span className="flex items-center gap-1.5"><FlaskConical size={14} /> Testar como perfil</span>
              <select value={simulando ?? ''} onChange={(e) => { simular((e.target.value || null) as never); setAberto(false); }}
                className="h-9 rounded-[10px] border border-m-stroke bg-m-surface-field px-2 text-sm font-normal text-m-text-primary">
                <option value="">Super admin (vê tudo)</option>
                {(['admin', 'planejador', 'encarregado', 'seguranca', 'leitor'] as const).map((p) => <option key={p} value={p}>{PAPEL[p]}</option>)}
              </select>
            </label>
          )}
          <button type="button" onClick={() => { setAberto(false); sair(); }}
            className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-sm text-m-text-secondary hover:bg-m-surface-hover">
            <LogOut size={16} /> Sair
          </button>
        </div>
      )}
    </div>
  );
}

function FaixaTeste() {
  const { simulando, simular } = useObra();
  if (!simulando) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-3 bg-m-warning-subtle px-4 py-1.5 text-[13px] text-m-warning print:hidden">
      <FlaskConical size={15} /> Testando como <b>{PAPEL[simulando]}</b> — menu e telas desse perfil; o servidor continua te tratando como super admin.
      <button type="button" onClick={() => simular(null)} className="font-semibold underline">sair do teste</button>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [gaveta, setGaveta] = useState(false);
  const atual = MENU.flatMap((g) => g.itens).find((i) => i.url === itemAtivo(pathname));
  const menuBusca = useMenuVisivel();
  const { obra, carregando, superadmin } = useObra();
  const marca = useMarcaObra();
  const nomeEmpresa = obra ? marca.data?.nome_contratada?.trim() : null;
  const telaAdmin = pathname?.startsWith('/app/admin');
  return (
    <div className="min-h-screen bg-m-surface-base text-m-text-primary">
      <TituloAba />
      <SincronizarDados />
      {obra && <SincronizarFila />}
      {obra && !telaAdmin && <TutorialComputador />}
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
            <button type="button" aria-label="Abrir menu" data-tour="abrir-menu" onClick={() => setGaveta(true)} className="-ml-1 p-1 text-m-text-secondary lg:hidden"><MenuIcon size={20} /></button>
            <nav aria-label="Trilha" className="truncate text-[13px] text-m-text-muted">
              {nomeEmpresa || 'Malhet'}
              {atual && <> <span className="text-m-stroke-strong">/</span> <b className="font-semibold text-m-text-primary">{atual.titulo}</b></>}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {obra && <BuscaTelas grupos={menuBusca} />}
            <Tema />
            {obra && <span data-tour="sino" className="inline-flex"><Sino /></span>}
            <Usuario />
          </div>
        </header>
        <FaixaTeste />
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

