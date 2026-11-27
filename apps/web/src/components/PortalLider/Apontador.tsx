'use client';

import { Check, ChevronDown, Search, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Calculado, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { Esqueleto } from '@/components/Obra/Esqueleto';
import { Folha } from '@/components/PortalLider/Folha';
import { PainelLeitura } from '@/components/Presenca/PainelLeitura';
import { type Resultado, type TransportePresenca, usePresencaCom } from '@/lib/presenca/usePresenca';
import { FotosAtividade } from '@/components/PortalLider/FotosAtividade';
import { type Achado, type DadosApontador, type EquipamentoDia, type EquipamentosApontador, type EquipeApontador, type MotivoFalta, type PessoaApontador,
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
  const [modo, setModo] = useState<'equipe' | 'ler'>('equipe');
  const [equipeSel, setEquipeSelEstado] = useState<number | null>(() => {
    try { const v = localStorage.getItem('malhet.apontador.equipe'); return v ? Number(v) : null; } catch { return null; }
  });
  const setEquipeSel = (id: number | null) => {
    setEquipeSelEstado(id);
    try { if (id == null) localStorage.removeItem('malhet.apontador.equipe'); else localStorage.setItem('malhet.apontador.equipe', String(id)); } catch { /* sem armazenamento */ }
  };
  const equipeValida = equipeSel != null && dados?.equipes.some((e) => e.id === equipeSel) ? equipeSel : null;
  const lendo = tela === 'presenca' && modo === 'ler';
  const hoje = isoLocal(new Date());
  const trocarModo = (m: 'equipe' | 'ler') => {
    setModo(m);
    if (m === 'ler' && dia !== hoje) setDia(hoje); // leitura de crachá/rosto é sempre do dia de hoje
    if (m === 'equipe') void carregar(); // o que foi lido aparece nas equipes
  };
  return (
    <>
      <h1 className="text-[22px] font-semibold leading-7">{TITULOS[tela]}</h1>
      {tela === 'presenca' && (
        <div role="tablist" aria-label="Como apontar a presença" className="grid grid-cols-2 gap-1 rounded-full bg-m-surface-active p-1">
          {([['equipe', 'Por equipe'], ['ler', 'Ler presença']] as const).map(([k, r]) => (
            <button key={k} type="button" role="tab" aria-selected={modo === k} onClick={() => trocarModo(k)}
              className={`h-10 rounded-full text-[14px] font-semibold ${modo === k ? 'bg-m-surface text-m-text-primary shadow-sm' : 'text-m-text-secondary'}`}>{r}</button>
          ))}
        </div>
      )}
      {tela === 'presenca' && dados && <SeletorEquipe dados={dados} valor={equipeValida} onEscolher={setEquipeSel} />}
      {((tela === 'presenca' && !lendo) || tela === 'equipamentos') && <Dias dia={dia} setDia={setDia} />}
      {lendo ? (dados ? <LerPresenca dados={dados} equipeSel={equipeValida} recarregar={carregar} /> : <Esqueleto className="h-60 w-full" />)
        : tela === 'presenca' ? (dados ? <Presenca dados={dados} dia={dia} onMudou={setDados} recarregar={carregar} equipeSel={equipeValida} /> : <Esqueleto className="h-60 w-full" />)
        : tela === 'equipes' ? (dados ? <Equipes dados={dados} recarregar={carregar} criarAoAbrir={criarAoAbrir} /> : <Esqueleto className="h-60 w-full" />)
          : tela === 'equipamentos' ? <Equipamentos dia={dia} />
            : tela === 'fotos' ? <FotosAtividade obra={obra} /> : <ProducaoAba />}
    </>
  );
}

// ---- presença -----------------------------------------------------------------------------------------------------
/** Spec 150: troca `/presenca/*` (conta do Malhet) por `/portal/apontador/presenca/*` (token do apontador). */
const caminhoPortal = (p: string) => p.replace(/^\/presenca\//, '/apontador/presenca/');

/**
 * Leitura de presença no celular do apontador (spec 150): o mesmo painel do `/m/presenca` — crachá NFC, código/QR, rosto e
 * lista — com a fila offline do aparelho; as leituras sobem pelo token do apontador e entram nas equipes.
 */
function LerPresenca({ dados, equipeSel, recarregar }: { dados: DadosApontador; equipeSel: number | null; recarregar: () => Promise<void> }) {
  const obraId = dados.obra_id;
  const transporte = useMemo<TransportePresenca>(() => ({
    obraId,
    get: <T,>(p: string) => portal<T>(caminhoPortal(p)),
    post: <T,>(p: string, corpo: unknown) => portal<T>(caminhoPortal(p), { method: 'POST', body: corpo }),
  }), [obraId]);
  const [deFora, setDeFora] = useState<{ p: PessoaApontador; origem: EquipeApontador | null } | null>(null);
  const sel = equipeSel != null ? dados.equipes.find((e) => e.id === equipeSel) ?? null : null;
  // spec 152: leu alguém que não é da equipe escolhida → trazer ou empréstimo (com justificativa)
  const onLeu = useCallback((r: Resultado) => {
    if (r.tipo === 'desconhecido' || !sel) return;
    const o = ondeEsta(dados, r.pessoa.id);
    if (!o || o.equipe?.id === sel.id || o.pessoa.emprestimo?.para_equipe_id === sel.id) return;
    setDeFora({ p: { ...o.pessoa, presenca: o.pessoa.presenca ?? { hora: r.hora, meio: 'lida', por: '' } }, origem: o.equipe });
  }, [dados, sel]);
  return (
    <>
      {sel && <p className="text-[13px] text-m-text-secondary">Lendo para a <b>{sel.nome}</b>: quem for de outra equipe abre a escolha entre trazer ou emprestar.</p>}
      <PainelLeitura pr={usePresencaCom(transporte)} topo={false} onLeu={onLeu} />
      {deFora && sel && <FolhaDeFora p={deFora.p} origem={deFora.origem} equipe={sel} dia={isoLocal(new Date())} jaPresente
        onFechar={() => setDeFora(null)} onFeito={async () => { setDeFora(null); await recarregar(); }} />}
    </>
  );
}

function memoriaPresenca(dados: DadosApontador): MemoriaCalculo {
  const todos = [...dados.equipes.flatMap((e) => e.pessoas), ...dados.sem_equipe];
  const presentes = todos.filter((p) => p.presenca).length;
  const faltas = todos.filter((p) => p.falta).length;
  return {
    chave: 'presentes', titulo: 'Presentes no dia', valor: `${presentes} de ${todos.length}`,
    formula: 'presentes = pessoas com presença válida no dia (crachá, rosto ou apontada); faltas = apontadas com motivo; empréstimo conta na equipe que recebeu',
    passos: [...dados.equipes.map((e) => ({ descricao: e.nome, conta: `${e.presentes} presentes · ${e.faltas ?? 0} falta(s) · ${e.cedidos ?? 0} cedido(s) · ${(e.recebidos ?? []).length} recebido(s) de ${e.total}`, resultado: String(e.presentes), destaque: false })),
      { descricao: 'Sem equipe', conta: `${dados.sem_equipe.filter((p) => p.presenca).length} de ${dados.sem_equipe.length}`, resultado: String(dados.sem_equipe.filter((p) => p.presenca).length), destaque: false },
      { descricao: 'Faltas no dia', conta: `${faltas} apontada(s)`, resultado: String(faltas), destaque: true },
      { descricao: 'Empréstimos no dia', conta: `${dados.emprestimos ?? 0} pessoa(s) em outra equipe`, resultado: String(dados.emprestimos ?? 0), destaque: false }],
    fontes: [{ dado: 'Leituras de presença', valor: `${presentes}`, origem: 'Apropriação de presença', local: dados.data },
      { dado: 'Faltas e empréstimos', valor: `${faltas} / ${dados.emprestimos ?? 0}`, origem: 'Apontador', local: dados.data }], notas: [],
  };
}

const rotuloEquipe = (e: EquipeApontador) => `${e.nome}${e.encarregado ? ` — Enc. ${e.encarregado.split('::').pop()?.trim()}` : ''}`;

/** De quem é a pessoa (equipe dela) e onde trabalha hoje (empréstimo). */
function ondeEsta(dados: DadosApontador, cid: number) {
  for (const e of dados.equipes) {
    const p = e.pessoas.find((x) => x.colaborador_id === cid);
    if (p) return { pessoa: p, equipe: e as EquipeApontador | null };
  }
  const p = dados.sem_equipe.find((x) => x.colaborador_id === cid);
  return p ? { pessoa: p, equipe: null } : null;
}

/** A equipe que o apontador está apontando (escolhida pelo encarregado). Vale para "Por equipe" e "Ler presença". */
function SeletorEquipe({ dados, valor, onEscolher }: { dados: DadosApontador; valor: number | null; onEscolher: (id: number | null) => void }) {
  return (
    <label className="flex flex-col gap-1 text-[12px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Equipe que estou apontando
      <select value={valor ?? ''} onChange={(e) => onEscolher(e.target.value ? Number(e.target.value) : null)} aria-label="Equipe que estou apontando"
        className="h-12 w-full rounded-[14px] border border-m-stroke bg-m-surface-field px-3 text-[15px] font-normal normal-case tracking-normal text-m-text-primary">
        <option value="">Todas as equipes</option>
        {dados.equipes.map((e) => <option key={e.id} value={e.id}>{rotuloEquipe(e)}</option>)}
      </select>
    </label>
  );
}

function Presenca({ dados, dia, onMudou, recarregar, equipeSel }: {
  dados: DadosApontador; dia: string; onMudou: (d: DadosApontador) => void; recarregar: () => Promise<void>; equipeSel: number | null;
}) {
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<number | 'sem' | null>(dados.equipes[0]?.id ?? null);
  const [enviando, setEnviando] = useState<number | null>(null);
  const [faltaDe, setFaltaDe] = useState<PessoaApontador | null>(null);
  const [fechar, setFechar] = useState<EquipeApontador | null>(null);
  const [deFora, setDeFora] = useState<PessoaApontador | null>(null);
  const [fora, setFora] = useState('');
  const sel = equipeSel != null ? dados.equipes.find((e) => e.id === equipeSel) ?? null : null;
  const t = semAcento(busca.trim());
  const filtra = (ps: PessoaApontador[]) => (t ? ps.filter((p) => semAcento(`${p.nome} ${p.matricula ?? ''} ${p.cracha}`).includes(t)) : ps);
  const marcar = async (p: PessoaApontador, presente: boolean) => {
    if (!p.colaborador_id) { toast.error(`${p.nome} não está no efetivo: peça ao Planejamento para cadastrar`); return; }
    setEnviando(p.colaborador_id);
    try {
      const r = await portal<{ presenca: PessoaApontador['presenca'] }>('/apontador/presenca', { method: 'POST', body: { data: dia, colaborador_id: p.colaborador_id, presente } });
      const troca = (x: PessoaApontador) => (x.colaborador_id === p.colaborador_id ? { ...x, presenca: r.presenca, falta: r.presenca ? null : x.falta } : x);
      const equipes = dados.equipes.map((e) => {
        const pessoas = e.pessoas.map(troca);
        const recebidos = (e.recebidos ?? []).map(troca);
        const aqui = [...pessoas.filter((x) => !(x.emprestimo && x.emprestimo.para_equipe_id !== e.id)), ...recebidos];
        return { ...e, pessoas, recebidos, presentes: aqui.filter((x) => x.presenca).length, faltas: pessoas.filter((x) => x.falta).length };
      });
      const sem_equipe = dados.sem_equipe.map(troca);
      const todos = [...equipes.flatMap((e) => e.pessoas), ...sem_equipe];
      onMudou({ ...dados, equipes, sem_equipe, presentes: todos.filter((x) => x.presenca).length, faltas: todos.filter((x) => x.falta).length });
    } catch (e) { toast.error((e as Error).message); } finally { setEnviando(null); }
  };
  const devolver = async (p: PessoaApontador) => {
    try { await portal('/apontador/emprestimo/devolver', { method: 'POST', body: { data: dia, colaborador_id: p.colaborador_id } }); toast.success(`${p.nome.split(' ')[0]} voltou para a equipe dela`); await recarregar(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const marcarTodos = async (e: EquipeApontador) => {
    for (const p of e.pessoas.filter((x) => !x.presenca && !x.falta && !x.emprestimo && x.colaborador_id)) await marcar(p, true); // eslint-disable-line no-await-in-loop
  };
  const total = dados.equipes.reduce((s, e) => s + e.pessoas.length, 0) + dados.sem_equipe.length;

  const linha = (p: PessoaApontador, e: EquipeApontador | null, recebido = false) => {
    const lida = p.presenca && (p.presenca.meio !== 'manual' || !p.presenca.por.startsWith('apontador'));
    const cedido = !recebido && p.emprestimo && (!e || p.emprestimo.para_equipe_id !== e.id);
    return (
      <li key={`${recebido ? 'r' : 'm'}-${p.cracha}`} className="flex flex-col gap-2 border-b border-m-stroke-subtle px-4 py-3 last:border-b-0">
        <div className="min-w-0">
          <span className="block text-[15px] font-medium leading-5">{p.nome}{p.papel === 'encarregado' && <span className="ml-1.5 text-[11.5px] font-semibold uppercase text-m-accent">enc.</span>}</span>
          <span className="block text-[12.5px] text-m-text-muted">{[p.matricula ?? p.cracha, p.funcao].filter(Boolean).join(' · ')}
            {p.presenca ? ` · ${lida ? `${p.presenca.meio} ${hora(p.presenca.hora)}` : `apontado ${hora(p.presenca.hora)}`}` : ''}</span>
          {p.falta && <span className="block text-[12.5px] font-semibold text-m-warning">Falta · {p.falta.rotulo}{p.falta.observacao ? ` — ${p.falta.observacao}` : ''}</span>}
          {cedido && <span className="block text-[12.5px] font-semibold text-m-accent">Emprestado hoje à {p.emprestimo!.para_equipe}</span>}
          {recebido && p.emprestimo && <span className="block text-[12.5px] font-semibold text-m-accent">Emprestado da {p.emprestimo.de_equipe ?? 'sem equipe'} · {p.emprestimo.justificativa}</span>}
        </div>
        <div className="flex gap-2">
          {!cedido && (
            <button type="button" disabled={enviando === p.colaborador_id || !!lida} onClick={() => void marcar(p, !p.presenca)}
              aria-pressed={!!p.presenca} aria-label={`${p.presenca ? 'Tirar a presença de' : 'Marcar presente'} ${p.nome}`}
              title={lida ? 'Presença lida no crachá/rosto: não sai pelo apontador' : undefined}
              className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[14px] font-semibold disabled:opacity-60 ${p.presenca ? 'bg-m-success text-white' : 'border border-m-stroke text-m-text-secondary'}`}>
              {p.presenca && <Check size={16} aria-hidden="true" />} Presente
            </button>
          )}
          {!cedido && !p.presenca && p.colaborador_id && (
            <button type="button" onClick={() => setFaltaDe(p)} aria-label={`${p.falta ? 'Mudar a falta de' : 'Marcar falta de'} ${p.nome}`}
              className={`h-11 flex-1 rounded-full text-[14px] font-semibold ${p.falta ? 'bg-m-warning text-white' : 'border border-m-stroke text-m-text-secondary'}`}>Falta</button>
          )}
          {(cedido || recebido) && (
            <button type="button" onClick={() => void devolver(p)} className="h-11 flex-1 rounded-full border border-m-stroke text-[14px] font-semibold text-m-text-secondary">Devolver</button>
          )}
        </div>
      </li>
    );
  };

  const grupo = (chave: number | 'sem', titulo: string, sub: string, pessoas: PessoaApontador[], equipe?: EquipeApontador, sempreAberto = false) => {
    const lista = filtra(pessoas);
    const recebidos = filtra(equipe?.recebidos ?? []);
    if (t && !lista.length && !recebidos.length) return null;
    const aberto = sempreAberto || !!t || aberta === chave;
    const pres = equipe ? equipe.presentes : pessoas.filter((p) => p.presenca).length;
    const tot = equipe ? pessoas.length - (equipe.cedidos ?? 0) + (equipe.recebidos ?? []).length : pessoas.length;
    const semApontar = pessoas.filter((p) => !p.presenca && !p.falta && !p.emprestimo).length;
    return (
      <section key={String(chave)} className={cartao}>
        <button type="button" onClick={() => !sempreAberto && setAberta(aberto && !t ? null : chave)} aria-expanded={aberto} className="flex items-center gap-3 px-4 py-3 text-left">
          <div className="min-w-0 flex-1"><b className="block truncate text-[15.5px]">{titulo}</b><span className="block truncate text-[12.5px] text-m-text-muted">{sub}
            {equipe?.faltas ? ` · ${equipe.faltas} falta(s)` : ''}{equipe?.cedidos ? ` · ${equipe.cedidos} cedido(s)` : ''}{equipe?.recebidos?.length ? ` · ${equipe.recebidos.length} recebido(s)` : ''}</span></div>
          <span className={`rounded-full px-2.5 py-1 text-[12.5px] font-semibold tabular-nums ${pres === tot && tot ? 'bg-m-success-subtle text-m-success' : 'bg-m-surface-active text-m-text-secondary'}`}>{pres}/{tot}</span>
          {!sempreAberto && <ChevronDown size={18} className={`text-m-text-muted transition-transform ${aberto ? 'rotate-180' : ''}`} aria-hidden="true" />}
        </button>
        {aberto && (
          <>
            {equipe && semApontar > 0 && !t && (
              <div className="mx-4 mb-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void marcarTodos(equipe)} className="h-10 rounded-full border border-m-accent-strong text-[13px] font-semibold text-m-accent">Todos presentes</button>
                <button type="button" onClick={() => setFechar(equipe)} className="h-10 rounded-full border border-m-warning text-[13px] font-semibold text-m-warning">Falta p/ quem não veio</button>
              </div>
            )}
            <ul className="flex flex-col border-t border-m-stroke-subtle">
              {lista.map((p) => linha(p, equipe ?? null))}
              {recebidos.map((p) => linha(p, equipe ?? null, true))}
            </ul>
          </>
        )}
      </section>
    );
  };

  // apontar alguém de fora da equipe escolhida (empréstimo ou trazer)
  const tf = semAcento(fora.trim());
  const candidatos = sel && tf.length >= 2
    ? [...dados.equipes.filter((e) => e.id !== sel.id).flatMap((e) => e.pessoas), ...dados.sem_equipe]
      .filter((p) => p.colaborador_id && !(sel.recebidos ?? []).some((r) => r.colaborador_id === p.colaborador_id)
        && semAcento(`${p.nome} ${p.matricula ?? ''} ${p.cracha}`).includes(tf)).slice(0, 12)
    : [];

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[14px] text-m-text-secondary">Presentes:{' '}
          <Calculado chave="presentes" memoria={() => memoriaPresenca(dados)} className="text-[16px] font-semibold text-m-text-primary">{`${dados.presentes} de ${total}`}</Calculado></span>
        <span className="text-[13px] text-m-text-muted">{dados.faltas ?? 0} falta(s) · {dados.emprestimos ?? 0} empréstimo(s)</span>
      </div>
      <label className="flex items-center gap-2 rounded-[14px] border-2 border-m-accent-strong px-3">
        <Search size={18} className="text-m-text-muted" aria-hidden="true" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={sel ? `Buscar na ${sel.nome}` : 'Nome ou matrícula'} aria-label="Buscar pessoa"
          className="h-12 min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] outline-none focus:ring-0" />
        {busca && <button type="button" aria-label="Limpar a busca" onClick={() => setBusca('')}><X size={18} /></button>}
      </label>
      {sel ? (
        <>
          {grupo(sel.id, sel.nome, `Enc. ${sel.encarregado ?? '—'}`, sel.pessoas, sel, true)}
          <section className={`${cartao} gap-2 p-4`}>
            <b className="text-[15px]">Apontar alguém de fora da {sel.nome}</b>
            <span className="text-[12.5px] text-m-text-muted">Quem é de outra equipe: traga para esta equipe ou registre o empréstimo de hoje, com a justificativa.</span>
            <input value={fora} onChange={(e) => setFora(e.target.value)} placeholder="Nome ou matrícula" aria-label="Buscar pessoa de outra equipe" className={campo} />
            <ul className="flex flex-col">
              {candidatos.map((p) => {
                const o = ondeEsta(dados, p.colaborador_id!);
                return (
                  <li key={p.cracha} className="flex items-center gap-3 border-b border-m-stroke-subtle py-2.5 last:border-b-0">
                    <div className="min-w-0 flex-1"><span className="block truncate text-[15px] font-medium">{p.nome}</span>
                      <span className="block truncate text-[12.5px] text-m-text-muted">{[p.matricula ?? p.cracha, p.funcao].filter(Boolean).join(' · ')} · {o?.equipe ? o.equipe.nome : 'sem equipe'}
                        {p.emprestimo ? ` · hoje na ${p.emprestimo.para_equipe}` : ''}</span></div>
                    <button type="button" className={secundario} onClick={() => { setDeFora(p); setFora(''); }}>Apontar</button>
                  </li>
                );
              })}
              {tf.length >= 2 && !candidatos.length && <li className="py-2 text-[13px] text-m-text-muted">Ninguém de outra equipe com esse nome ou matrícula.</li>}
            </ul>
          </section>
        </>
      ) : (
        <>
          {dados.equipes.map((e) => grupo(e.id, e.nome, `Enc. ${e.encarregado ?? '—'}`, e.pessoas, e))}
          {dados.sem_equipe.length > 0 && grupo('sem', 'Sem equipe', 'efetivo ativo fora das equipes', dados.sem_equipe)}
        </>
      )}
      {faltaDe && <FolhaFalta p={faltaDe} dia={dia} motivos={dados.motivos_falta ?? []} onFechar={() => setFaltaDe(null)} onFeito={async () => { setFaltaDe(null); await recarregar(); }} />}
      {fechar && <FolhaFalta equipe={fechar} dia={dia} motivos={dados.motivos_falta ?? []} onFechar={() => setFechar(null)} onFeito={async () => { setFechar(null); await recarregar(); }} />}
      {deFora && sel && <FolhaDeFora p={deFora} origem={ondeEsta(dados, deFora.colaborador_id!)?.equipe ?? null} equipe={sel} dia={dia} jaPresente={!!deFora.presenca}
        onFechar={() => setDeFora(null)} onFeito={async () => { setDeFora(null); await recarregar(); }} />}
    </>
  );
}

/** Falta de uma pessoa (motivo + observação) ou de todos que não vieram na equipe. */
function FolhaFalta({ p, equipe, dia, motivos, onFechar, onFeito }: {
  p?: PessoaApontador; equipe?: EquipeApontador; dia: string; motivos: MotivoFalta[]; onFechar: () => void; onFeito: () => Promise<void>;
}) {
  const [motivo, setMotivo] = useState(p?.falta?.motivo ?? (equipe ? 'nao_compareceu' : ''));
  const [obs, setObs] = useState(p?.falta?.observacao ?? '');
  const [enviando, setEnviando] = useState(false);
  const quem = equipe ? equipe.pessoas.filter((x) => !x.presenca && !x.falta && !x.emprestimo && x.colaborador_id) : [];
  const enviar = async (tirar = false) => {
    setEnviando(true);
    try {
      if (equipe) {
        const r = await portal<{ faltas: number }>('/apontador/faltas/restantes', { method: 'POST', body: { data: dia, equipe_id: equipe.id, motivo, observacao: obs || null } });
        toast.success(`${r.faltas} falta(s) na ${equipe.nome}`);
      } else if (p) {
        await portal('/apontador/falta', { method: 'POST', body: { data: dia, colaborador_id: p.colaborador_id, motivo: tirar ? null : motivo, observacao: obs || null } });
        toast.success(tirar ? `A falta de ${p.nome.split(' ')[0]} saiu` : `Falta de ${p.nome.split(' ')[0]}: ${motivos.find((m) => m.motivo === motivo)?.rotulo ?? motivo}`);
      }
      await onFeito();
    } catch (e) { toast.error((e as Error).message); } finally { setEnviando(false); }
  };
  return (
    <Folha titulo={equipe ? `Falta para quem não veio · ${equipe.nome}` : `Falta de ${p?.nome ?? ''}`} onFechar={onFechar}>
      {equipe && <p className="text-[14px] text-m-text-tertiary">{quem.length} pessoa(s) sem presença, sem falta e sem empréstimo: {quem.map((x) => x.nome.split(' ')[0]).join(', ') || '—'}.</p>}
      <div role="radiogroup" aria-label="Motivo da falta" className="grid grid-cols-2 gap-2">
        {motivos.map((m) => (
          <button key={m.motivo} type="button" role="radio" aria-checked={motivo === m.motivo} onClick={() => setMotivo(m.motivo)}
            className={`min-h-11 rounded-[14px] border px-3 py-2 text-left text-[13.5px] font-semibold ${motivo === m.motivo ? 'border-m-accent-strong bg-m-accent-subtle text-m-text-primary' : 'border-m-stroke text-m-text-secondary'}`}>
            {m.rotulo}<span className="block text-[11.5px] font-normal text-m-text-muted">{m.justificada ? 'justificada' : 'sem justificativa'}</span>
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-[12px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Observação{motivo === 'outro' ? ' (obrigatória)' : ''}
        <input className={campo} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="ex.: atestado de 2 dias, entregue ao DP" />
      </label>
      <button type="button" className={primario} disabled={enviando || !motivo || (equipe && !quem.length)} onClick={() => void enviar()}>
        {enviando ? 'Gravando…' : equipe ? `Marcar falta em ${quem.length}` : 'Marcar falta'}</button>
      {p?.falta && <button type="button" className={secundario} disabled={enviando} onClick={() => void enviar(true)}>Tirar a falta</button>}
    </Folha>
  );
}

/** Apontou alguém de outra equipe: trazer para esta (sai da outra) ou empréstimo de hoje com a justificativa. */
function FolhaDeFora({ p, origem, equipe, dia, jaPresente, onFechar, onFeito }: {
  p: PessoaApontador; origem: EquipeApontador | null; equipe: EquipeApontador; dia: string; jaPresente: boolean; onFechar: () => void; onFeito: () => Promise<void>;
}) {
  const [justificativa, setJustificativa] = useState('');
  const [enviando, setEnviando] = useState(false);
  const trazer = async () => {
    setEnviando(true);
    try {
      const r = await portal<{ saiu_de: string[] }>('/apontador/incluir', { method: 'POST', body: { equipe_id: equipe.id, cracha: p.cracha } });
      if (!jaPresente) await portal('/apontador/presenca', { method: 'POST', body: { data: dia, colaborador_id: p.colaborador_id, presente: true } });
      toast.success(`${p.nome.split(' ')[0]} agora é da ${equipe.nome}${r.saiu_de.length ? ` (saiu da ${r.saiu_de.join(', ')})` : ''}`);
      await onFeito();
    } catch (e) { toast.error((e as Error).message); } finally { setEnviando(false); }
  };
  const emprestar = async () => {
    setEnviando(true);
    try {
      await portal('/apontador/emprestimo', { method: 'POST', body: { data: dia, colaborador_id: p.colaborador_id, para_equipe_id: equipe.id, justificativa, presente: !jaPresente } });
      toast.success(`${p.nome.split(' ')[0]} emprestado hoje à ${equipe.nome}`);
      await onFeito();
    } catch (e) { toast.error((e as Error).message); } finally { setEnviando(false); }
  };
  return (
    <Folha titulo={`${p.nome} não é da ${equipe.nome}`} onFechar={onFechar}>
      <p className="text-[14px] text-m-text-secondary">{origem ? <>É da <b>{rotuloEquipe(origem)}</b>.</> : 'Está sem equipe.'}{p.emprestimo ? ` Hoje já está emprestado à ${p.emprestimo.para_equipe}.` : ''}</p>
      <section className="flex flex-col gap-2 rounded-[16px] border border-m-stroke-subtle p-3">
        <b className="text-[15px]">Emprestado hoje</b>
        <span className="text-[12.5px] text-m-text-muted">Continua na {origem?.nome ?? 'situação atual'}; o dia de hoje conta na {equipe.nome}.</span>
        <textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={2} aria-label="Justificativa do empréstimo"
          placeholder="Por que veio para esta equipe hoje? (ex.: reforço na concretagem da laje)"
          className="w-full rounded-[14px] border border-m-stroke bg-m-surface-field px-3 py-2 text-[16px] text-m-text-primary outline-none focus:border-m-accent-strong" />
        <button type="button" className={primario} disabled={enviando || justificativa.trim().length < 5} onClick={() => void emprestar()}>Registrar empréstimo</button>
      </section>
      <button type="button" className={secundario} disabled={enviando} onClick={() => void trazer()}>
        Trazer para a {equipe.nome}{origem ? ` (sai da ${origem.nome})` : ''}</button>
    </Folha>
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
  const [busca, setBusca] = useState('');
  const t = semAcento(busca.trim());
  // spec 152: a pesquisa acha a equipe pelo nome/encarregado e a pessoa por nome, matrícula ou função (abre a equipe dela)
  const visiveis = dados.equipes.map((e) => {
    if (!t) return { e, pessoas: e.pessoas, abre: aberta === e.id };
    const daEquipe = semAcento(`${e.nome} ${e.encarregado ?? ''}`).includes(t);
    const pessoas = daEquipe ? e.pessoas : e.pessoas.filter((p) => semAcento(`${p.nome} ${p.matricula ?? ''} ${p.cracha} ${p.funcao ?? ''}`).includes(t));
    return { e, pessoas, abre: !daEquipe || aberta === e.id, some: !daEquipe && !pessoas.length };
  }).filter((x) => !('some' in x && x.some));
  const semEquipe = t ? dados.sem_equipe.filter((p) => semAcento(`${p.nome} ${p.matricula ?? ''} ${p.cracha} ${p.funcao ?? ''}`).includes(t)) : [];
  const tirar = async (e: EquipeApontador, p: PessoaApontador) => {
    try { await portal('/apontador/tirar', { method: 'POST', body: { equipe_id: e.id, cracha: p.cracha } }); toast.success(`${p.nome.split(' ')[0]} saiu da ${e.nome}`); await recarregar(); }
    catch (er) { toast.error((er as Error).message); }
  };
  return (
    <>
      <button type="button" onClick={() => setCriando(true)} className={`${primario} flex items-center justify-center gap-2`}><Users size={18} aria-hidden="true" /> Criar equipe</button>
      <label className="flex items-center gap-2 rounded-[14px] border-2 border-m-accent-strong px-3">
        <Search size={18} className="text-m-text-muted" aria-hidden="true" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Equipe, encarregado, nome, matrícula ou função" aria-label="Pesquisar nas equipes"
          className="h-12 min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] outline-none focus:ring-0" />
        {busca && <button type="button" aria-label="Limpar a pesquisa" onClick={() => setBusca('')}><X size={18} /></button>}
      </label>
      {t && <p className="text-[13px] text-m-text-muted">{visiveis.length} equipe(s){semEquipe.length ? ` · ${semEquipe.length} sem equipe` : ''}</p>}
      {visiveis.map(({ e, pessoas, abre }) => (
        <section key={e.id} className={cartao}>
          <button type="button" onClick={() => setAberta(aberta === e.id ? null : e.id)} aria-expanded={abre} className="flex items-center gap-3 px-4 py-3 text-left">
            <div className="min-w-0 flex-1"><b className="block truncate text-[15.5px]">{e.nome}</b><span className="block truncate text-[12.5px] text-m-text-muted">Enc. {e.encarregado ?? '—'} · {e.total} pessoa(s)</span></div>
            <ChevronDown size={18} className={`text-m-text-muted transition-transform ${abre ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {abre && (
            <ul className="flex flex-col border-t border-m-stroke-subtle">
              {pessoas.map((p) => (
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
      {semEquipe.length > 0 && (
        <section className={cartao}>
          <div className="px-4 py-3"><b className="block text-[15.5px]">Sem equipe</b><span className="text-[12.5px] text-m-text-muted">use &ldquo;Trazer alguém&rdquo; na equipe para incluir</span></div>
          <ul className="flex flex-col border-t border-m-stroke-subtle">
            {semEquipe.slice(0, 30).map((p) => (
              <li key={p.cracha} className="border-b border-m-stroke-subtle px-4 py-2.5 last:border-b-0"><span className="block truncate text-[15px] font-medium">{p.nome}</span>
                <span className="block truncate text-[12.5px] text-m-text-muted">{[p.matricula ?? p.cracha, p.funcao].filter(Boolean).join(' · ')}</span></li>
            ))}
          </ul>
        </section>
      )}
      {t && !visiveis.length && !semEquipe.length && <p className={`${cartao} p-4 text-[14px] text-m-text-muted`}>Nada encontrado com “{busca}”.</p>}
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
