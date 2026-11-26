'use client';

import { Check, ChevronDown, Search, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Calculado, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { Esqueleto } from '@/components/Obra/Esqueleto';
import { Folha } from '@/components/PortalLider/Folha';
import { FotosAtividade } from '@/components/PortalLider/FotosAtividade';
import { type Achado, type DadosApontador, type EquipamentoDia, type EquipamentosApontador, type EquipeApontador, type PessoaApontador,
  type Producao, portal } from '@/lib/portal/api';

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const campo = 'h-12 w-full rounded-[14px] border border-m-stroke bg-m-surface-field px-3 text-[16px] text-m-text-primary outline-none focus:border-m-accent-strong focus:ring-2 focus:ring-m-accent/30';
const primario = 'h-12 w-full rounded-full bg-m-accent-strong text-[16px] font-semibold text-m-on-accent disabled:opacity-40';
const secundario = 'h-11 rounded-full border border-m-stroke px-4 text-[14px] font-semibold text-m-text-secondary disabled:opacity-40';
const cartao = 'flex flex-col rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised';
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const num = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
export const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export type TelaApontador = 'presenca' | 'equipes' | 'equipamentos' | 'fotos' | 'producao';

/** Os últimos 7 dias (o apontador corrige a semana; mais para trás é com o Planejamento). */
function useDias() {
  return useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    return { iso: isoLocal(d), rotulo: i === 0 ? 'Hoje' : i === 1 ? 'Ontem' : d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }) };
  }), []);
}

function Dias({ dia, setDia }: { dia: string; setDia: (d: string) => void }) {
  const dias = useDias();
  return (
    <div role="tablist" aria-label="Dia" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {dias.map((d) => (
        <button key={d.iso} type="button" role="tab" aria-selected={d.iso === dia} onClick={() => setDia(d.iso)}
          className={`h-10 shrink-0 rounded-full px-4 text-[13.5px] font-semibold ${d.iso === dia ? 'bg-m-accent-strong text-m-on-accent' : 'border border-m-stroke text-m-text-secondary'}`}>{d.rotulo}</button>
      ))}
    </div>
  );
}

/** Presença e equipes de toda a obra, no dia escolhido (o painel do apontador carrega uma vez e as telas usam). */
export function useDadosApontador(ativo = true) {
  const [dia, setDia] = useState(() => isoLocal(new Date()));
  const [dados, setDados] = useState<DadosApontador | null>(null);
  const carregar = useCallback(async () => {
    if (!ativo) return;
    try { setDados(await portal<DadosApontador>(`/apontador/equipes?data=${dia}`)); } catch (e) { toast.error((e as Error).message); }
  }, [dia, ativo]);
  useEffect(() => { void carregar(); }, [carregar]);
  return { dia, setDia, dados, setDados, carregar };
}

const TITULOS: Record<TelaApontador, string> = { presenca: 'Presença', equipes: 'Equipes', equipamentos: 'Equipamentos', fotos: 'Fotos da atividade', producao: 'Produção' };

/**
 * Rota do apontador (spec 147): a obra inteira no celular — presença de todo o efetivo, equipes (cria e remaneja), o dia de
 * cada equipamento, fotos das atividades e a produção da programação vigente. Spec 149: uma tela por vez, aberta pela barra
 * de baixo ou pelo Início (no layout do app de campo).
 */
export function TelaDoApontador({ tela, obra, estado, criarAoAbrir }: {
  tela: TelaApontador; obra: string | null; estado: ReturnType<typeof useDadosApontador>; criarAoAbrir?: boolean;
}) {
  const { dia, setDia, dados, setDados, carregar } = estado;
  return (
    <>
      <h1 className="text-[22px] font-semibold leading-7">{TITULOS[tela]}</h1>
      {(tela === 'presenca' || tela === 'equipamentos') && <Dias dia={dia} setDia={setDia} />}
      {tela === 'presenca' ? (dados ? <Presenca dados={dados} dia={dia} onMudou={setDados} /> : <Esqueleto className="h-60 w-full" />)
        : tela === 'equipes' ? (dados ? <Equipes dados={dados} recarregar={carregar} criarAoAbrir={criarAoAbrir} /> : <Esqueleto className="h-60 w-full" />)
          : tela === 'equipamentos' ? <Equipamentos dia={dia} />
            : tela === 'fotos' ? <FotosAtividade obra={obra} /> : <ProducaoAba />}
    </>
  );
}

// ---- presença -----------------------------------------------------------------------------------------------------
function memoriaPresenca(dados: DadosApontador): MemoriaCalculo {
  const todos = [...dados.equipes.flatMap((e) => e.pessoas), ...dados.sem_equipe];
  const presentes = todos.filter((p) => p.presenca).length;
  return {
    chave: 'presentes', titulo: 'Presentes no dia', valor: `${presentes} de ${todos.length}`, formula: 'presentes = pessoas com presença válida no dia (crachá, rosto ou apontada)',
    passos: [...dados.equipes.map((e) => ({ descricao: e.nome, conta: `${e.pessoas.filter((p) => p.presenca).length} de ${e.pessoas.length}`, resultado: String(e.pessoas.filter((p) => p.presenca).length), destaque: false })),
      { descricao: 'Sem equipe', conta: `${dados.sem_equipe.filter((p) => p.presenca).length} de ${dados.sem_equipe.length}`, resultado: String(dados.sem_equipe.filter((p) => p.presenca).length), destaque: false }],
    fontes: [{ dado: 'Leituras de presença', valor: `${presentes}`, origem: 'Apropriação de presença', local: dados.data }], notas: [],
  };
}

function Presenca({ dados, dia, onMudou }: { dados: DadosApontador; dia: string; onMudou: (d: DadosApontador) => void }) {
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<number | 'sem' | null>(dados.equipes[0]?.id ?? null);
  const [enviando, setEnviando] = useState<number | null>(null);
  const t = semAcento(busca.trim());
  const filtra = (ps: PessoaApontador[]) => (t ? ps.filter((p) => semAcento(`${p.nome} ${p.matricula ?? ''} ${p.cracha}`).includes(t)) : ps);
  const marcar = async (p: PessoaApontador, presente: boolean) => {
    if (!p.colaborador_id) { toast.error(`${p.nome} não está no efetivo: peça ao Planejamento para cadastrar`); return; }
    setEnviando(p.colaborador_id);
    try {
      const r = await portal<{ presenca: PessoaApontador['presenca'] }>('/apontador/presenca', { method: 'POST', body: { data: dia, colaborador_id: p.colaborador_id, presente } });
      const troca = (x: PessoaApontador) => (x.colaborador_id === p.colaborador_id ? { ...x, presenca: r.presenca } : x);
      const equipes = dados.equipes.map((e) => { const pessoas = e.pessoas.map(troca); return { ...e, pessoas, presentes: pessoas.filter((x) => x.presenca).length }; });
      const sem_equipe = dados.sem_equipe.map(troca);
      onMudou({ ...dados, equipes, sem_equipe, presentes: [...equipes.flatMap((e) => e.pessoas), ...sem_equipe].filter((x) => x.presenca).length });
    } catch (e) { toast.error((e as Error).message); } finally { setEnviando(null); }
  };
  const marcarTodos = async (e: EquipeApontador) => {
    for (const p of e.pessoas.filter((x) => !x.presenca && x.colaborador_id)) await marcar(p, true); // eslint-disable-line no-await-in-loop
  };
  const total = dados.equipes.reduce((s, e) => s + e.pessoas.length, 0) + dados.sem_equipe.length;
  const grupo = (chave: number | 'sem', titulo: string, sub: string, pessoas: PessoaApontador[], equipe?: EquipeApontador) => {
    const lista = filtra(pessoas);
    if (t && !lista.length) return null;
    const aberto = !!t || aberta === chave;
    const pres = pessoas.filter((p) => p.presenca).length;
    return (
      <section key={String(chave)} className={cartao}>
        <button type="button" onClick={() => setAberta(aberto && !t ? null : chave)} aria-expanded={aberto} className="flex items-center gap-3 px-4 py-3 text-left">
          <div className="min-w-0 flex-1"><b className="block truncate text-[15.5px]">{titulo}</b><span className="block truncate text-[12.5px] text-m-text-muted">{sub}</span></div>
          <span className={`rounded-full px-2.5 py-1 text-[12.5px] font-semibold tabular-nums ${pres === pessoas.length && pessoas.length ? 'bg-m-success-subtle text-m-success' : 'bg-m-surface-active text-m-text-secondary'}`}>{pres}/{pessoas.length}</span>
          <ChevronDown size={18} className={`text-m-text-muted transition-transform ${aberto ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {aberto && (
          <>
            {equipe && pres < pessoas.length && !t && (
              <button type="button" onClick={() => void marcarTodos(equipe)} className="mx-4 mb-2 h-10 rounded-full border border-m-accent-strong text-[13.5px] font-semibold text-m-accent">Marcar todos presentes</button>
            )}
            <ul className="flex flex-col border-t border-m-stroke-subtle">
              {lista.map((p) => {
                const lida = p.presenca && !p.presenca.por.startsWith('apontador');
                return (
                  <li key={p.cracha} className="flex items-center gap-3 border-b border-m-stroke-subtle px-4 py-2.5 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{p.nome}{p.papel === 'encarregado' && <span className="ml-1.5 text-[11.5px] font-semibold uppercase text-m-accent">enc.</span>}</span>
                      <span className="block truncate text-[12.5px] text-m-text-muted">{[p.matricula ?? p.cracha, p.funcao].filter(Boolean).join(' · ')}
                        {p.presenca ? ` · ${lida ? `${p.presenca.meio} ${hora(p.presenca.hora)}` : `apontado ${hora(p.presenca.hora)}`}` : ''}</span>
                    </div>
                    <button type="button" disabled={enviando === p.colaborador_id || !!lida} onClick={() => void marcar(p, !p.presenca)}
                      aria-pressed={!!p.presenca} aria-label={`${p.presenca ? 'Tirar a presença de' : 'Marcar presente'} ${p.nome}`}
                      title={lida ? 'Presença lida no crachá/rosto: não sai pelo apontador' : undefined}
                      className={`flex h-11 w-[112px] shrink-0 items-center justify-center gap-1.5 rounded-full text-[13.5px] font-semibold disabled:opacity-60 ${p.presenca ? 'bg-m-success text-white' : 'border border-m-stroke text-m-text-secondary'}`}>
                      {p.presenca ? <><Check size={16} aria-hidden="true" /> Presente</> : 'Marcar'}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    );
  };
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[14px] text-m-text-secondary">Presentes:{' '}
          <Calculado chave="presentes" memoria={() => memoriaPresenca(dados)} className="text-[16px] font-semibold text-m-text-primary">{`${dados.presentes} de ${total}`}</Calculado></span>
      </div>
      <label className="flex items-center gap-2 rounded-[14px] border-2 border-m-accent-strong px-3">
        <Search size={18} className="text-m-text-muted" aria-hidden="true" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou matrícula" aria-label="Buscar pessoa"
          className="h-12 min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] outline-none focus:ring-0" />
        {busca && <button type="button" aria-label="Limpar a busca" onClick={() => setBusca('')}><X size={18} /></button>}
      </label>
      {dados.equipes.map((e) => grupo(e.id, e.nome, `Enc. ${e.encarregado ?? '—'}`, e.pessoas, e))}
      {dados.sem_equipe.length > 0 && grupo('sem', 'Sem equipe', 'efetivo ativo fora das equipes', dados.sem_equipe)}
    </>
  );
}

// ---- equipes ------------------------------------------------------------------------------------------------------
function useBusca(q: string) {
  const [achados, setAchados] = useState<Achado[] | null>(null);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setAchados(null); return; }
    const h = setTimeout(() => { portal<Achado[]>(`/buscar?q=${encodeURIComponent(t)}`).then(setAchados).catch((e) => toast.error((e as Error).message)); }, 300);
    return () => clearTimeout(h);
  }, [q]);
  return achados;
}

function Equipes({ dados, recarregar, criarAoAbrir }: { dados: DadosApontador; recarregar: () => Promise<void>; criarAoAbrir?: boolean }) {
  const [aberta, setAberta] = useState<number | null>(null);
  const [trazendo, setTrazendo] = useState<EquipeApontador | null>(null);
  const [criando, setCriando] = useState(!!criarAoAbrir);
  const tirar = async (e: EquipeApontador, p: PessoaApontador) => {
    try { await portal('/apontador/tirar', { method: 'POST', body: { equipe_id: e.id, cracha: p.cracha } }); toast.success(`${p.nome.split(' ')[0]} saiu da ${e.nome}`); await recarregar(); }
    catch (er) { toast.error((er as Error).message); }
  };
  return (
    <>
      <button type="button" onClick={() => setCriando(true)} className={`${primario} flex items-center justify-center gap-2`}><Users size={18} aria-hidden="true" /> Criar equipe</button>
      {dados.equipes.map((e) => (
        <section key={e.id} className={cartao}>
          <button type="button" onClick={() => setAberta(aberta === e.id ? null : e.id)} aria-expanded={aberta === e.id} className="flex items-center gap-3 px-4 py-3 text-left">
            <div className="min-w-0 flex-1"><b className="block truncate text-[15.5px]">{e.nome}</b><span className="block truncate text-[12.5px] text-m-text-muted">Enc. {e.encarregado ?? '—'} · {e.total} pessoa(s)</span></div>
            <ChevronDown size={18} className={`text-m-text-muted transition-transform ${aberta === e.id ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {aberta === e.id && (
            <ul className="flex flex-col border-t border-m-stroke-subtle">
              {e.pessoas.map((p) => (
                <li key={p.cracha} className="flex items-center gap-3 border-b border-m-stroke-subtle px-4 py-2.5">
                  <div className="min-w-0 flex-1"><span className="block truncate text-[15px] font-medium">{p.nome}</span>
                    <span className="block truncate text-[12.5px] text-m-text-muted">{p.papel === 'encarregado' ? 'Encarregado' : [p.matricula ?? p.cracha, p.funcao].filter(Boolean).join(' · ')}</span></div>
                  {p.papel !== 'encarregado' && (
                    <button type="button" onClick={() => void tirar(e, p)} aria-label={`Tirar ${p.nome} da equipe`} className="flex h-10 items-center gap-1 rounded-full border border-m-stroke px-3 text-[13px] font-semibold text-m-text-secondary"><UserMinus size={15} /> Tirar</button>
                  )}
                </li>
              ))}
              <li className="p-3"><button type="button" onClick={() => setTrazendo(e)} className={`${secundario} flex w-full items-center justify-center gap-2`}><UserPlus size={16} /> Trazer alguém</button></li>
            </ul>
          )}
        </section>
      ))}
      {!dados.equipes.length && <p className={`${cartao} p-4 text-[14px] text-m-text-muted`}>Nenhuma equipe ativa ainda. Crie a primeira.</p>}
      {trazendo && <Trazer equipe={trazendo} onFechar={() => setTrazendo(null)} onFeito={recarregar} />}
      {criando && <CriarEquipe onFechar={() => setCriando(false)} onCriada={async () => { setCriando(false); await recarregar(); }} />}
    </>
  );
}

function Trazer({ equipe, onFechar, onFeito }: { equipe: EquipeApontador; onFechar: () => void; onFeito: () => Promise<void> }) {
  const [q, setQ] = useState('');
  const achados = useBusca(q);
  const [enviando, setEnviando] = useState<string | null>(null);
  const naEquipe = new Set(equipe.pessoas.map((p) => p.cracha));
  const trazer = async (a: Achado) => {
    setEnviando(a.cracha);
    try {
      const r = await portal<{ saiu_de: string[] }>('/apontador/incluir', { method: 'POST', body: { equipe_id: equipe.id, cracha: a.cracha } });
      toast.success(`${a.nome.split(' ')[0]} está na ${equipe.nome}${r.saiu_de.length ? ` (saiu da ${r.saiu_de.join(', ')})` : ''}`);
      setQ('');
      await onFeito();
    } catch (e) { toast.error((e as Error).message); } finally { setEnviando(null); }
  };
  return (
    <Folha titulo={`Trazer para a ${equipe.nome}`} onFechar={onFechar}>
      <label className="flex items-center gap-2 rounded-[14px] border-2 border-m-accent-strong px-3">
        <Search size={18} className="text-m-text-muted" aria-hidden="true" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Matrícula ou nome" aria-label="Matrícula ou nome do colaborador"
          className="h-12 min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] outline-none focus:ring-0" />
      </label>
      <ul className="flex flex-col">
        {achados?.map((a) => (
          <li key={a.cracha} className="flex items-center gap-3 border-b border-m-stroke-subtle py-2.5">
            <div className="min-w-0 flex-1"><span className="block truncate text-[15px] font-medium">{a.nome}</span>
              <span className="block text-[12.5px] text-m-text-muted">{[a.matricula, a.funcao].filter(Boolean).join(' · ')}{a.equipe ? ` · hoje na ${a.equipe}` : ' · sem equipe'}</span></div>
            {naEquipe.has(a.cracha) ? <span className="text-[13px] text-m-text-muted">já está</span>
              : <button type="button" className={secundario} disabled={enviando === a.cracha} onClick={() => void trazer(a)}>{enviando === a.cracha ? '…' : 'Trazer'}</button>}
          </li>
        ))}
        {achados && !achados.length && <li className="py-3 text-[14px] text-m-text-muted">Ninguém no efetivo com esse nome ou matrícula.</li>}
      </ul>
    </Folha>
  );
}

function CriarEquipe({ onFechar, onCriada }: { onFechar: () => void; onCriada: () => Promise<void> }) {
  const [disciplina, setDisciplina] = useState('');
  const [encarregado, setEncarregado] = useState<Achado | null>(null);
  const [membros, setMembros] = useState<Achado[]>([]);
  const [q, setQ] = useState('');
  const achados = useBusca(q);
  const [enviando, setEnviando] = useState(false);
  const escolher = (a: Achado) => {
    if (!encarregado) setEncarregado(a); else if (a.cracha !== encarregado.cracha && !membros.some((m) => m.cracha === a.cracha)) setMembros([...membros, a]);
    setQ('');
  };
  const criar = async () => {
    if (!encarregado) return;
    setEnviando(true);
    try {
      const r = await portal<{ nome: string; membros: number }>('/apontador/equipes', { method: 'POST',
        body: { disciplina, encarregado: encarregado.cracha, membros: membros.map((m) => m.cracha) } });
      toast.success(`${r.nome} criada com ${r.membros} pessoa(s) além do encarregado`);
      await onCriada();
    } catch (e) { toast.error((e as Error).message); } finally { setEnviando(false); }
  };
  const Pessoa = ({ a, onTirar, rotulo }: { a: Achado; onTirar: () => void; rotulo?: string }) => (
    <div className="flex items-center gap-3 border-b border-m-stroke-subtle py-2 last:border-b-0">
      <div className="min-w-0 flex-1"><span className="block truncate text-[15px]">{a.nome}</span><span className="text-[12.5px] text-m-text-muted">{rotulo ?? a.matricula ?? a.cracha}{a.equipe ? ` · sai da ${a.equipe}` : ''}</span></div>
      <button type="button" aria-label={`Tirar ${a.nome}`} onClick={onTirar} className="grid h-10 w-10 place-items-center rounded-full border border-m-stroke"><X size={16} /></button>
    </div>
  );
  return (
    <Folha titulo="Criar equipe" onFechar={onFechar}>
      <p className="text-[14px] text-m-text-tertiary">A equipe vale na hora, com o nome no padrão da obra. Quem estava em outra equipe sai de lá, e o Planejamento é avisado.</p>
      <label className="flex flex-col gap-1 text-[12px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Disciplina
        <input className={campo} value={disciplina} onChange={(e) => setDisciplina(e.target.value)} placeholder="FORMA, CONCRETO, ARMAÇÃO…" />
      </label>
      <label className="flex items-center gap-2 rounded-[14px] border-2 border-m-accent-strong px-3">
        <Search size={18} className="text-m-text-muted" aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={encarregado ? 'Buscar quem entra na equipe' : 'Primeiro, o encarregado (nome ou matrícula)'}
          aria-label="Buscar no efetivo" className="h-12 min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] outline-none focus:ring-0" />
      </label>
      {achados && (
        <ul className="flex max-h-[34dvh] flex-col overflow-y-auto">
          {achados.map((a) => (
            <li key={a.cracha}><button type="button" onClick={() => escolher(a)} className="flex min-h-[52px] w-full flex-col items-start justify-center border-b border-m-stroke-subtle text-left">
              <span className="text-[15px]">{a.nome}</span><span className="text-[12.5px] text-m-text-muted">{[a.matricula, a.funcao].filter(Boolean).join(' · ')}{a.equipe ? ` · hoje na ${a.equipe}` : ' · sem equipe'}</span>
            </button></li>
          ))}
          {!achados.length && <li className="py-2 text-[14px] text-m-text-muted">Ninguém no efetivo com esse nome ou matrícula.</li>}
        </ul>
      )}
      <div className="flex flex-col">
        <span className="text-[12px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Encarregado</span>
        {encarregado ? <Pessoa a={encarregado} rotulo={`encarregado · ${encarregado.matricula ?? encarregado.cracha}`} onTirar={() => setEncarregado(null)} /> : <span className="py-2 text-[14px] text-m-text-muted">Busque acima e escolha.</span>}
        <span className="mt-2 text-[12px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Na equipe ({membros.length})</span>
        {membros.map((m) => <Pessoa key={m.cracha} a={m} onTirar={() => setMembros(membros.filter((x) => x.cracha !== m.cracha))} />)}
      </div>
      <button type="button" className={primario} disabled={enviando || !encarregado || disciplina.trim().length < 2} onClick={() => void criar()}>{enviando ? 'Criando…' : 'Criar equipe'}</button>
    </Folha>
  );
}

// ---- equipamentos -------------------------------------------------------------------------------------------------
const SITUACOES_DIA: [string, string][] = [['operando', 'Operando'], ['disposicao', 'À disposição'], ['parado', 'Parado'], ['manutencao', 'Manutenção']];

function Equipamentos({ dia }: { dia: string }) {
  const [dados, setDados] = useState<EquipamentosApontador | null>(null);
  const [busca, setBusca] = useState('');
  const [abrir, setAbrir] = useState<EquipamentoDia | null>(null);
  const carregar = useCallback(async () => {
    try { setDados(await portal<EquipamentosApontador>(`/apontador/equipamentos?data=${dia}`)); } catch (e) { toast.error((e as Error).message); }
  }, [dia]);
  useEffect(() => { setDados(null); void carregar(); }, [carregar]);
  if (!dados) return <Esqueleto className="h-60 w-full" />;
  const t = semAcento(busca.trim());
  const lista = t ? dados.itens.filter((i) => semAcento(`${i.tag ?? ''} ${i.placa ?? ''} ${i.nome} ${i.operador?.nome ?? i.operador_texto ?? ''}`).includes(t)) : dados.itens;
  const apontados = dados.itens.filter((i) => i.dia).length;
  return (
    <>
      <span className="text-[14px] text-m-text-secondary">Apontados:{' '}
        <Calculado chave="apontados" className="text-[16px] font-semibold text-m-text-primary" memoria={() => ({
          chave: 'apontados', titulo: 'Equipamentos apontados no dia', valor: `${apontados} de ${dados.itens.length}`,
          formula: 'apontados = equipamentos mobilizados com o dia marcado', notas: [],
          passos: SITUACOES_DIA.map(([k, r]) => ({ descricao: r, conta: '', resultado: String(dados.itens.filter((i) => i.dia?.situacao === k).length), destaque: false })),
          fontes: [{ dado: 'Equipamentos mobilizados', valor: String(dados.itens.length), origem: 'Cadastro de equipamentos', local: dados.data }],
        })}>{`${apontados} de ${dados.itens.length}`}</Calculado></span>
      <label className="flex items-center gap-2 rounded-[14px] border-2 border-m-accent-strong px-3">
        <Search size={18} className="text-m-text-muted" aria-hidden="true" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="TAG, placa, equipamento ou operador" aria-label="Buscar equipamento"
          className="h-12 min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] outline-none focus:ring-0" />
      </label>
      <ul className={cartao}>
        {lista.map((i) => (
          <li key={i.id} className="border-b border-m-stroke-subtle last:border-b-0">
            <button type="button" onClick={() => setAbrir(i)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{i.tag ?? i.placa} · <span className="font-medium">{i.nome}</span></span>
                <span className="block truncate text-[12.5px] text-m-text-muted">{i.operador?.nome ?? (i.operador_texto ? `${i.operador_texto} (não ligado ao efetivo)` : 'sem operador')}</span>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${!i.dia ? 'border border-m-stroke text-m-text-muted' : i.dia.situacao === 'operando' ? 'bg-m-success-subtle text-m-success' : i.dia.situacao === 'disposicao' ? 'bg-m-info-subtle text-m-info' : 'bg-m-warning-subtle text-m-warning'}`}>
                {i.dia ? `${i.dia.situacao_nome}${i.dia.horas != null ? ` · ${num(i.dia.horas)} h` : ''}` : 'Apontar'}</span>
            </button>
          </li>
        ))}
        {!lista.length && <li className="px-4 py-4 text-[14px] text-m-text-muted">{dados.itens.length ? 'Nenhum equipamento com esse nome.' : 'Nenhum equipamento mobilizado. O Planejamento cadastra em Equipamentos.'}</li>}
      </ul>
      {abrir && <ApontarEquipamento e={abrir} dia={dia} equipes={dados.equipes} onFechar={() => setAbrir(null)} onFeito={async () => { setAbrir(null); await carregar(); }} />}
    </>
  );
}

function ApontarEquipamento({ e, dia, equipes, onFechar, onFeito }: {
  e: EquipamentoDia; dia: string; equipes: EquipamentosApontador['equipes']; onFechar: () => void; onFeito: () => Promise<void>;
}) {
  const [situacao, setSituacao] = useState(e.dia?.situacao ?? 'operando');
  const [horas, setHoras] = useState(e.dia?.horas != null ? String(e.dia.horas) : '');
  const [equipe, setEquipe] = useState(e.dia?.equipe_id ? String(e.dia.equipe_id) : '');
  const [obs, setObs] = useState(e.dia?.observacao ?? '');
  const [enviando, setEnviando] = useState(false);
  const precisaMotivo = situacao === 'parado' || situacao === 'manutencao';
  const salvar = async () => {
    setEnviando(true);
    try {
      await portal(`/apontador/equipamentos/${e.id}`, { method: 'PUT', body: { data: dia, situacao, horas: horas ? Number(horas.replace(',', '.')) : null,
        equipe_id: equipe ? Number(equipe) : null, observacao: obs || null } });
      toast.success(`${e.tag ?? e.nome}: ${SITUACOES_DIA.find(([k]) => k === situacao)?.[1]}`);
      await onFeito();
    } catch (er) { toast.error((er as Error).message); } finally { setEnviando(false); }
  };
  return (
    <Folha titulo={`${e.tag ?? e.placa} · ${e.nome}`} onFechar={onFechar}>
      <p className="text-[13.5px] text-m-text-tertiary">{e.operador?.nome ?? e.operador_texto ?? 'Sem operador'}
        {e.dias != null && e.memoria && <> · na obra há <Calculado chave="dias" memoria={() => e.memoria as unknown as MemoriaCalculo}>{`${e.dias} dia(s)`}</Calculado></>}</p>
      <div role="radiogroup" aria-label="Como está o equipamento" className="grid grid-cols-2 gap-2">
        {SITUACOES_DIA.map(([k, r]) => (
          <button key={k} type="button" role="radio" aria-checked={situacao === k} onClick={() => setSituacao(k)}
            className={`h-12 rounded-[14px] text-[14.5px] font-semibold ${situacao === k ? 'bg-m-accent-strong text-m-on-accent' : 'border border-m-stroke text-m-text-secondary'}`}>{r}</button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-[12px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Horas no dia (opcional)
        <input className={campo} inputMode="decimal" value={horas} onChange={(ev) => setHoras(ev.target.value)} placeholder="ex.: 8,5" />
      </label>
      <label className="flex flex-col gap-1 text-[12px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Trabalhou com a equipe (opcional)
        <select className={campo} value={equipe} onChange={(ev) => setEquipe(ev.target.value)}>
          <option value="">—</option>
          {equipes.map((x) => <option key={x.id} value={x.id}>{x.nome}{x.encarregado ? ` — Enc. ${x.encarregado}` : ''}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[12px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">{precisaMotivo ? 'Motivo (obrigatório)' : 'Observação (opcional)'}
        <textarea rows={2} maxLength={300} value={obs} onChange={(ev) => setObs(ev.target.value)} placeholder={precisaMotivo ? 'ex.: chuva, pneu furado, aguardando peça' : ''}
          className="rounded-[14px] border border-m-stroke bg-m-surface-field p-3 text-[15px] outline-none focus:border-m-accent-strong" />
      </label>
      <button type="button" className={primario} disabled={enviando || (precisaMotivo && obs.trim().length < 2)} onClick={() => void salvar()}>{enviando ? 'Salvando…' : 'Salvar o dia'}</button>
    </Folha>
  );
}

// ---- produção -----------------------------------------------------------------------------------------------------
function ProducaoAba() {
  const [p, setP] = useState<Producao | null>(null);
  const [k, setK] = useState<number | null>(null);
  useEffect(() => { portal<Producao>('/apontador/producao').then(setP).catch((e) => toast.error((e as Error).message)); }, []);
  useEffect(() => {
    if (!p?.dias || k != null) return;
    const i = p.dias.findIndex((d) => d.data === isoLocal(new Date()));
    setK(i >= 0 ? i : 0);
  }, [p, k]);
  if (!p) return <Esqueleto className="h-60 w-full" />;
  if (!p.programacao || !p.dias || !p.areas) return <p className={`${cartao} p-4 text-[14px] text-m-text-muted`}>Nenhuma programação emitida ainda.</p>;
  const d = k ?? 0;
  return (
    <>
      <p className="text-[13.5px] text-m-text-tertiary">{p.programacao.titulo}</p>
      <div role="tablist" aria-label="Dia" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {p.dias.map((x, i) => (
          <button key={x.data} type="button" role="tab" aria-selected={i === d} onClick={() => setK(i)}
            className={`flex min-h-[52px] min-w-[52px] shrink-0 flex-col items-center justify-center rounded-[14px] px-2 text-[12px] ${i === d ? 'bg-m-accent-strong font-semibold text-m-on-accent' : 'border border-m-stroke text-m-text-secondary'}`}>
            <span>{x.dia}</span><span className="text-[15px] font-semibold">{x.data.slice(8)}/{x.data.slice(5, 7)}</span>
          </button>
        ))}
      </div>
      {p.areas.map((a) => {
        const linhas = a.linhas.filter((ln) => ln.previsto[d] || ln.realizado[d]);
        if (!linhas.length) return null;
        return (
          <section key={`${a.local}-${a.area}`} className={`${cartao} gap-3 p-4`}>
            <div><div className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">{a.local}</div><h2 className="text-[16px] font-semibold leading-5">{a.area}</h2></div>
            {linhas.map((ln) => {
              const pv = ln.previsto[d] ?? 0;
              const r = ln.realizado[d];
              return (
                <div key={ln.id} className="flex items-start justify-between gap-3 border-t border-m-stroke-subtle pt-3">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium leading-5">{ln.descricao}</div>
                    {ln.cwp && <div className="text-[11.5px] font-semibold text-m-info">CWP {ln.cwp}</div>}
                    <div className="text-[12px] text-m-text-muted">{ln.codigo}{ln.encarregado || ln.equipe ? ` · ${ln.encarregado ?? ln.equipe}` : ''}</div>
                    <div className="text-[12px] text-m-text-secondary">Semana: <Calculado chave="semana" memoria={() => ln.memoria as unknown as MemoriaCalculo}>{`${num(ln.total_realizado)} de ${num(ln.total_previsto)} ${ln.unidade ?? ''}`}</Calculado>{ln.percentual != null ? ` (${ln.percentual}%)` : ''}</div>
                  </div>
                  <div className="shrink-0 text-right text-[13px]">
                    <div>P <b>{num(pv)}</b> {ln.unidade ?? ''}</div>
                    <div className={r == null ? 'text-m-text-muted' : r + 0.005 < pv ? 'text-m-warning' : 'text-m-success'}>R <b>{num(r)}</b></div>
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
      {!p.areas.some((a) => a.linhas.some((ln) => ln.previsto[d] || ln.realizado[d])) && <p className={`${cartao} p-4 text-center text-[14px] text-m-text-muted`}>Nada programado neste dia.</p>}
    </>
  );
}
