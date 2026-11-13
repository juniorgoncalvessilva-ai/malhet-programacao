'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Camera, Check, ChevronRight, ListChecks, Plus, ShieldAlert } from 'lucide-react';
import { dataLonga, hojeIso, num, useDiaCampo } from '@/components/Mobile/campo';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';
import { usePendentesCadastro } from '@/components/Obra/CadastrosPendentes';
import type { AcaoRestricao } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';
import { useSessao } from '@/lib/auth/AuthProvider';

/** Início do encarregado: meta do dia (atividades programadas), quanto já foi lançado e o que fazer agora. */
export default function CampoInicio() {
  const hoje = hojeIso();
  const dia = useDiaCampo(hoje);
  const api = useApi();
  const { obra, podeVerMobile: ver } = useObra();
  const { usuario } = useSessao();
  const restr = useQuery({ queryKey: ['restricoes'], queryFn: () => api.get<AcaoRestricao[]>('/restricoes') });
  const meusPend = usePendentesCadastro(true);
  const d = dia.data;
  const linhas = d?.linhas ?? [];
  const lancadas = linhas.filter((l) => l.realizado != null).length;
  const pct = linhas.length ? lancadas / linhas.length : 0;
  const pendRestr = (restr.data ?? []).filter((a) => a.status1 === 'Pendente').length;
  const nome = (usuario?.email ?? '').split('@')[0].split(/[._]/)[0];
  const iniciais = (usuario?.email ?? '?').slice(0, 2).toUpperCase();

  return (
    <>
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[13px] leading-[18px] text-m-text-muted">{dataLonga(hoje)} · {obra?.nome}</span>
          <h1 className="text-[24px] font-semibold leading-[30px]">Bom dia{nome ? `, ${nome.charAt(0).toUpperCase()}${nome.slice(1)}` : ''}</h1>
        </div>
        <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-m-accent-strong text-[15px] font-semibold text-m-on-accent">{iniciais}</span>
      </header>

      {!!meusPend.data?.length && (
        <section className="flex flex-col gap-1 rounded-[16px] border border-m-warning/40 bg-m-warning-subtle p-3.5">
          <span className="flex items-center gap-1.5 text-[14px] font-semibold text-m-warning"><AlertTriangle size={16} /> {meusPend.data.length} cadastro(s) seu(s) para completar</span>
          <span className="text-[12.5px] text-m-text-secondary">Pessoas que você cadastrou pelo crachá, só com nome e função. Avise o DP/RH para incluir a matrícula: {meusPend.data.slice(0, 3).map((p) => p.nome).join(', ')}{meusPend.data.length > 3 ? '…' : ''}.</span>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-[20px] bg-m-accent-strong p-5 text-m-on-accent">
        <span className="text-[12px] font-medium uppercase leading-4 tracking-[0.48px] opacity-80">Meta de hoje</span>
        {dia.isLoading ? <span className="text-[15px] opacity-80">Carregando…</span> : !d?.programacao ? (
          <span className="text-[15px]">Nenhuma programação emitida cobre hoje.</span>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-[56px] font-semibold leading-[56px] tabular-nums">{linhas.length}</span>
              <span className="text-[16px] opacity-90">atividade{linhas.length === 1 ? '' : 's'} programada{linhas.length === 1 ? '' : 's'}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuemin={0} aria-valuemax={linhas.length} aria-valuenow={lancadas} aria-label="Atividades lançadas hoje">
              <div className="h-full rounded-full bg-[#6FB3B1]" style={{ width: `${pct * 100}%` }} />
            </div>
            <span className="text-[13px] leading-[18px] opacity-90">{lancadas} de {linhas.length} lançada{lancadas === 1 ? '' : 's'} · {d.programacao.titulo.split(' · ')[0]}{d.so_minha_equipe ? ' · só a sua equipe' : ''}</span>
          </>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2.5">
        {ver('/m/pendencias') && (
        <Link href="/m/pendencias" className="flex flex-col gap-1 rounded-[14px] border border-m-stroke-subtle bg-m-surface-raised p-3.5">
          <span className="text-[12px] leading-4 text-m-text-muted">Dias sem lançar</span>
          <span className="text-[26px] font-semibold leading-8 tabular-nums">{d ? d.pendentes.length : '—'}</span>
        </Link>
        )}
        {ver('/m/restricoes') && (
        <Link href="/m/restricoes" className="flex flex-col gap-1 rounded-[14px] border border-m-warning/30 bg-m-warning-subtle p-3.5">
          <span className="text-[12px] leading-4 text-m-warning">Restrições abertas</span>
          <span className="text-[26px] font-semibold leading-8 tabular-nums">{restr.data ? pendRestr : '—'}</span>
        </Link>
        )}
      </div>

      <h2 className="mt-0.5 text-[13px] font-semibold leading-[18px] text-m-text-secondary">O que fazer agora</h2>
      <div className="flex flex-col gap-2">
        {d?.programacao && ver('/m/lancar') && (
          <Link href="/m/lancar" className={`flex min-h-[60px] items-center gap-3 rounded-[14px] bg-m-surface-raised px-3.5 ${lancadas < linhas.length ? 'border-2 border-m-accent-strong' : 'border border-m-stroke-subtle'}`}>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${lancadas < linhas.length ? 'bg-m-accent-strong text-m-on-accent' : 'bg-m-success-subtle text-m-success'}`}>{lancadas < linhas.length ? <Plus size={18} /> : <Check size={18} />}</span>
            <span className="flex flex-1 flex-col"><span className="text-[15px] font-semibold leading-5">{lancadas < linhas.length ? 'Lançar o dia' : 'Dia lançado'}</span>
              <span className="text-[12px] leading-4 text-m-text-muted">{linhas.length - lancadas} de {linhas.length} atividade(s) sem realizado</span></span>
            <ChevronRight size={18} className="text-m-accent" aria-hidden="true" />
          </Link>
        )}
        {!!d?.pendentes.length && ver('/m/pendencias') && (
          <Link href="/m/pendencias" className="flex min-h-[60px] items-center gap-3 rounded-[14px] border border-m-stroke-subtle bg-m-surface-raised px-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-m-warning-subtle text-m-warning"><AlertTriangle size={18} /></span>
            <span className="flex flex-1 flex-col"><span className="text-[15px] font-medium leading-5">Dias anteriores sem realizado</span>
              <span className="text-[12px] leading-4 text-m-text-muted">{d.pendentes.length} lançamento(s) atrasado(s)</span></span>
            <ChevronRight size={18} className="text-m-text-muted" aria-hidden="true" />
          </Link>
        )}
        {ver('/m/auditorias') && (
        <Link href="/m/auditorias/nova" className="flex min-h-[60px] items-center gap-3 rounded-[14px] border border-m-stroke-subtle bg-m-surface-raised px-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-m-danger-subtle text-m-danger"><ShieldAlert size={18} /></span>
          <span className="flex flex-1 flex-col"><span className="text-[15px] font-medium leading-5">Auditoria de segurança</span>
            <span className="text-[12px] leading-4 text-m-text-muted">Notificação, interdição, inspeção, N3 · envia no WhatsApp</span></span>
          <ChevronRight size={18} className="text-m-text-muted" aria-hidden="true" />
        </Link>
        )}
        {ver('/m/acoes') && (
        <Link href="/m/acoes" className="flex min-h-[60px] items-center gap-3 rounded-[14px] border border-m-stroke-subtle bg-m-surface-raised px-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-m-info-subtle text-m-info"><ListChecks size={18} /></span>
          <span className="flex flex-1 flex-col"><span className="text-[15px] font-medium leading-5">Ações 5W2H</span>
            <span className="text-[12px] leading-4 text-m-text-muted">Concluir com foto e verificar a eficácia</span></span>
          <ChevronRight size={18} className="text-m-text-muted" aria-hidden="true" />
        </Link>
        )}
        {ver('/m/ocorrencias') && (
        <Link href="/m/ocorrencias/nova" className="flex min-h-[60px] items-center gap-3 rounded-[14px] border border-m-stroke-subtle bg-m-surface-raised px-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-m-warning-subtle text-m-warning"><Camera size={18} /></span>
          <span className="flex flex-1 flex-col"><span className="text-[15px] font-medium leading-5">Registrar ocorrência</span>
            <span className="text-[12px] leading-4 text-m-text-muted">Foto, local e causa</span></span>
          <ChevronRight size={18} className="text-m-text-muted" aria-hidden="true" />
        </Link>
        )}
        {linhas.map((l) => (
          <Link key={l.id} href={ver('/m/lancar') ? `/m/lancar?linha=${l.id}` : '/m/vigente'} className="flex min-h-[56px] items-center gap-3 rounded-[14px] border border-m-stroke-subtle bg-m-surface-raised px-3.5 py-2">
            <span className="flex flex-1 flex-col"><span className="line-clamp-1 text-[14px] font-medium leading-5">{l.codigo_simova} · {l.descricao}</span>
              <span className="text-[12px] leading-4 text-m-text-muted">{l.area.split(' · ')[0]} · previsto {num(l.previsto)} {l.unidade ?? ''}</span></span>
            <span className={`text-[13px] font-semibold tabular-nums ${l.realizado == null ? 'text-m-text-muted' : (l.realizado ?? 0) >= (l.previsto ?? 0) ? 'text-m-success' : 'text-m-warning'}`}>{l.realizado == null ? '—' : num(l.realizado)}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
