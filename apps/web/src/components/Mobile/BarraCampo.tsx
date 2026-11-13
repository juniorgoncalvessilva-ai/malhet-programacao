'use client';

import { Bell, FlaskConical, LayoutGrid, LogOut, Settings2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ItemMobile } from '@/components/Mobile/menu';
import { Avatar } from '@/components/Perfil/Avatar';
import { Link } from '@/i18n/navigation';
import type { PapelObra } from '@/lib/api/types';
import { useSessao } from '@/lib/auth/AuthProvider';
import { useObra } from '@/lib/obra/ObraProvider';
import { useContagemNotificacoes } from '@/lib/notificacoes';
import { nomeDe, useBarraMobile, usePerfil } from '@/lib/perfil';

export const PAPEL_ROTULO: Record<PapelObra, string> = { admin: 'Administrador', planejador: 'Planejador', encarregado: 'Encarregado', seguranca: 'Segurança', leitor: 'Leitor' };
const ativoEm = (href: string, pathname: string) => (href === '/m' ? pathname === '/m' : pathname === href || pathname.startsWith(`${href}/`));

/**
 * Barra de baixo do app de campo (spec 075): até 4 atalhos + o botão central em destaque + "Mais" com todas as outras
 * telas liberadas, o perfil e as configurações. O que vai na barra vem do ajuste da pessoa ou do padrão do perfil.
 */
export function BarraCampo({ pathname }: { pathname: string }) {
  const { barra, destaque, mais } = useBarraMobile();
  const [aberto, setAberto] = useState(false);
  useEffect(() => setAberto(false), [pathname]);
  const esq = destaque ? barra.slice(0, 2) : barra;
  const dir = destaque ? barra.slice(2) : [];
  const n = esq.length + dir.length + (destaque ? 1 : 0) + 1;
  const alertas = useContagemNotificacoes();
  const comum = (i: ItemMobile) => {
    const Icone = i.icone; const at = ativoEm(i.url, pathname);
    return (
      <Link key={i.url} href={i.url} aria-current={at ? 'page' : undefined}
        className={`flex min-h-[48px] min-w-0 flex-col items-center justify-center gap-1 text-[10.5px] ${at ? 'font-semibold text-m-accent' : 'font-medium text-m-text-muted'}`}>
        <Icone size={24} strokeWidth={2} aria-hidden="true" /><span className="max-w-full truncate px-0.5">{i.curto ?? i.titulo}</span>
      </Link>
    );
  };
  return (
    <>
      <nav aria-label="Navegação do campo" className="fixed bottom-0 left-1/2 z-20 grid w-full max-w-[480px] -translate-x-1/2 border-t border-m-stroke-subtle bg-m-surface-raised pb-[max(env(safe-area-inset-bottom),10px)] pt-2"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {esq.map(comum)}
        {destaque && (() => {
          const Icone = destaque.icone; const at = ativoEm(destaque.url, pathname);
          return (
            <Link href={destaque.url} aria-current={at ? 'page' : undefined} aria-label={destaque.titulo}
              className="-mt-6 flex min-w-0 flex-col items-center gap-1 text-[10.5px] font-semibold text-m-accent">
              <span className={`grid h-14 w-14 place-items-center rounded-full bg-m-accent-strong text-m-on-accent shadow-lg ring-4 ring-m-surface-raised ${at ? 'scale-105' : ''}`}><Icone size={28} strokeWidth={2} aria-hidden="true" /></span>
              <span className="max-w-full truncate">{destaque.curto ?? destaque.titulo}</span>
            </Link>
          );
        })()}
        {dir.map(comum)}
        <button type="button" onClick={() => setAberto(true)} aria-haspopup="dialog" aria-expanded={aberto}
          className={`relative flex min-h-[48px] flex-col items-center justify-center gap-1 text-[10.5px] ${aberto ? 'font-semibold text-m-accent' : 'font-medium text-m-text-muted'}`}>
          <LayoutGrid size={24} strokeWidth={2} aria-hidden="true" />Mais
          {alertas > 0 && <span className="absolute right-[22%] top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-m-danger px-1 text-[10px] font-bold text-white" aria-label={`${alertas} alertas`}>{alertas > 99 ? '99+' : alertas}</span>}
        </button>
      </nav>
      {aberto && createPortal(<Mais itens={mais} alertas={alertas} onFechar={() => setAberto(false)} />, document.body)}
    </>
  );
}

function Mais({ itens, alertas, onFechar }: { itens: ItemMobile[]; alertas: number; onFechar: () => void }) {
  const { usuario, sair } = useSessao();
  const { obra, obras, escolher, superadminReal, simulando, simular } = useObra();
  const perfil = usePerfil();
  const telas = itens.filter((i) => i.url !== '/m/perfil' && i.url !== '/m/notificacoes');
  return (
    <div className="fixed inset-0 z-50 flex justify-center" role="dialog" aria-modal="true" aria-label="Mais opções">
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/40" onClick={onFechar} />
      <div className="absolute bottom-0 flex max-h-[88dvh] w-full max-w-[480px] flex-col gap-3 overflow-y-auto rounded-t-[24px] bg-m-surface-base px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 font-[Figtree,system-ui,sans-serif] text-m-text-primary">
        <span className="mx-auto h-1.5 w-10 rounded-full bg-m-stroke" aria-hidden="true" />
        <div className="flex items-center gap-3">
          <Avatar tamanho={48} />
          <Link href="/m/perfil" className="flex min-w-0 flex-1 flex-col">
            <b className="truncate text-[16px]">{nomeDe(perfil.data, usuario?.email)}</b>
            <span className="truncate text-[12.5px] text-m-text-muted">{superadminReal && !simulando ? 'Super Admin' : obra ? PAPEL_ROTULO[obra.papel] : ''} · {obra?.nome}</span>
          </Link>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-full border border-m-stroke"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/m/notificacoes" className="relative flex min-h-[52px] items-center gap-2 rounded-[14px] border border-m-stroke-subtle bg-m-surface-raised px-3 text-[14px] font-semibold">
            <Bell size={19} className="text-m-accent" /> Notificações
            {alertas > 0 && <span className="ml-auto rounded-full bg-m-danger px-2 py-0.5 text-[11px] font-bold text-white">{alertas}</span>}
          </Link>
          <Link href="/m/perfil#menu" className="flex min-h-[52px] items-center gap-2 rounded-[14px] border border-m-stroke-subtle bg-m-surface-raised px-3 text-[14px] font-semibold">
            <Settings2 size={19} className="text-m-accent" /> Meu menu
          </Link>
        </div>
        {telas.length > 0 && (
          <section aria-label="Todas as telas" className="grid grid-cols-3 gap-2">
            {telas.map((i) => {
              const Icone = i.icone;
              return (
                <Link key={i.url} href={i.url} className="flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-[16px] border border-m-stroke-subtle bg-m-surface-raised p-2 text-center text-[12.5px] font-medium leading-4">
                  <Icone size={24} className="text-m-accent" aria-hidden="true" />{i.titulo}
                </Link>
              );
            })}
          </section>
        )}
        {obras.length > 1 && (
          <label className="flex flex-col gap-1 text-[13px] font-medium text-m-text-secondary">Obra
            <select value={obra?.id ?? ''} onChange={(e) => escolher(Number(e.target.value))} className="h-12 rounded-[14px] border border-m-stroke bg-m-surface-field px-3 text-[15px] text-m-text-primary">
              {obras.map((o) => <option key={o.id} value={o.id}>{o.codigo} · {o.nome}</option>)}
            </select>
          </label>
        )}
        {superadminReal && (
          <section aria-label="Testar como perfil" className="flex flex-col gap-2 rounded-[16px] border border-dashed border-m-accent/50 p-3">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-m-accent"><FlaskConical size={16} /> Testar como perfil (super admin)</span>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => simular(null)} className={`h-9 rounded-full px-3 text-[13px] ${!simulando ? 'bg-m-accent-strong font-semibold text-m-on-accent' : 'border border-m-stroke'}`}>Super admin (tudo)</button>
              {(['admin', 'planejador', 'encarregado', 'seguranca', 'leitor'] as PapelObra[]).map((p) => (
                <button key={p} type="button" onClick={() => simular(p)} className={`h-9 rounded-full px-3 text-[13px] ${simulando === p ? 'bg-m-accent-strong font-semibold text-m-on-accent' : 'border border-m-stroke'}`}>{PAPEL_ROTULO[p]}</button>
              ))}
            </div>
            <span className="text-[11.5px] text-m-text-muted">Mostra as telas e o menu como esse perfil vê. O servidor continua te tratando como super admin.</span>
          </section>
        )}
        <button type="button" onClick={() => sair()} className="flex h-12 items-center justify-center gap-2 rounded-full border border-m-stroke text-[14px] font-semibold text-m-text-secondary"><LogOut size={16} /> Sair</button>
      </div>
    </div>
  );
}

/** Faixa no topo enquanto o super admin testa como outro perfil (spec 077). */
export function AvisoTeste() {
  const { simulando, simular } = useObra();
  if (!simulando) return null;
  return (
    <div role="status" className="flex items-center justify-between gap-2 rounded-[14px] bg-m-warning-subtle px-3 py-2 text-[13px] text-m-warning">
      <span className="flex items-center gap-1.5"><FlaskConical size={15} /> Testando como <b>{PAPEL_ROTULO[simulando]}</b></span>
      <button type="button" onClick={() => simular(null)} className="font-semibold underline">sair do teste</button>
    </div>
  );
}
