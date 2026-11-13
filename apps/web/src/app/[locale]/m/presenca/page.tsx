'use client';

import { CheckCircle2, CloudOff, List, Nfc, RefreshCw, ScanFace, ScanLine, XCircle } from 'lucide-react';
import { LeitorCodigo, LeitorFacial, LeitorNfc } from '@/components/Mobile/Leitores';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TopoM, cartaoM } from '@/components/Mobile/ui';
import { avisar, temNfc } from '@/lib/presenca/leitores';
import type { PessoaBase } from '@/lib/presenca/offline';
import { type Resultado, usePresenca } from '@/lib/presenca/usePresenca';

type Modo = 'nfc' | 'codigo' | 'facial' | 'lista';
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const iniciais = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
const MEIO = { nfc: 'NFC', qr: 'QR', codigo: 'Código', facial: 'Facial', manual: 'Manual' } as const;

/**
 * Apropriação de presença no campo (spec 063): crachá NFC, código de barras/QR, rosto ou lista. Funciona sem internet —
 * a leitura fica no celular e sobe sozinha quando a rede voltar. Pensada para a fila andar: lê, vibra, próximo.
 */
export default function PresencaPage() {
  const pr = usePresenca();
  const [modo, setModo] = useState<Modo>(() => (temNfc() ? 'nfc' : 'codigo')); // iPhone abre em Código (câmera)
  const [ultimo, setUltimo] = useState<Resultado | null>(null);
  const [equipe, setEquipe] = useState<string>('');
  const [novo, setNovo] = useState<Extract<Resultado, { tipo: 'desconhecido' }> | null>(null);
  const limpar = useRef<ReturnType<typeof setTimeout> | null>(null);
  const equipes = useMemo(() => new Map((pr.base?.equipes ?? []).map((e) => [e.id, e])), [pr.base]);


  const mostrar = useCallback((r: Resultado) => {
    setUltimo(r);
    avisar(r.tipo === 'ok' ? 'ok' : r.tipo === 'repetido' ? 'repetido' : 'erro');
    if (limpar.current) clearTimeout(limpar.current);
    limpar.current = setTimeout(() => setUltimo(null), 4000);
    if (r.tipo === 'desconhecido') setNovo(r); // crachá sem cadastro: já abre o cadastro rápido (spec 065)
  }, []);

  // crachá gravado com o link (NFC no iPhone, QR pela câmera do celular): /m/presenca?c=CODIGO&m=nfc|qr (spec 067)
  const doLink = useRef(false);
  useEffect(() => {
    if (!pr.base || doLink.current || typeof window === 'undefined') return;
    const u = new URL(window.location.href);
    const c = u.searchParams.get('c');
    if (!c) return;
    doLink.current = true;
    const meio = u.searchParams.get('m') === 'qr' ? 'qr' : 'nfc';
    u.searchParams.delete('c'); u.searchParams.delete('m');
    window.history.replaceState(null, '', u.pathname + (u.search || ''));
    (meio === 'nfc' ? pr.porNfc(null, [c]) : pr.porCodigo(c, 'qr')).then((r) => mostrar(r));
  }, [pr.base]); // eslint-disable-line react-hooks/exhaustive-deps

  const pessoasEquipe = useMemo(() => {
    const todas = (pr.base?.pessoas ?? []).filter((p) => p.equipe_id != null);
    return equipe ? todas.filter((p) => String(p.equipe_id) === equipe) : todas;
  }, [pr.base, equipe]);
  const presentesEquipe = pessoasEquipe.filter((p) => pr.presentes.has(p.id)).length;

  return (
    <>
      <TopoM titulo="Presença" sub={`Hoje ${new Date().toLocaleDateString('pt-BR')} · ${pr.presentes.size} presente(s)`}
        acao={<span className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold ${pr.online ? (pr.fila ? 'bg-m-warning-subtle text-m-warning' : 'bg-m-success-subtle text-m-success') : 'bg-m-warning-subtle text-m-warning'}`}>
          {pr.online ? null : <CloudOff size={14} />}{pr.online ? (pr.fila ? `${pr.fila} na fila` : 'em dia') : `sem rede · ${pr.fila} na fila`}
        </span>} />

      {!pr.base && (
        <p className={`${cartaoM} text-[14px] text-m-text-secondary`}>
          {pr.baixando ? 'Baixando o efetivo para ler sem internet…' : pr.erroBase ? `Não consegui baixar o efetivo: ${pr.erroBase}. Abra esta tela uma vez com internet.` : 'Carregando…'}
        </p>
      )}

      {pr.base && (
        <>
          <div role="tablist" aria-label="Como ler" className="grid grid-cols-4 gap-1.5 rounded-[16px] border border-m-stroke bg-m-surface-raised p-1">
            {([['nfc', 'Crachá', Nfc], ['codigo', 'Código', ScanLine], ['facial', 'Rosto', ScanFace], ['lista', 'Lista', List]] as const).map(([m, r, I]) => (
              <button key={m} type="button" role="tab" aria-selected={modo === m} onClick={() => setModo(m)}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-[12px] text-[12px] font-semibold ${modo === m ? 'bg-m-accent-strong text-m-on-accent' : 'text-m-text-secondary'}`}>
                <I size={20} aria-hidden="true" />{r}
              </button>
            ))}
          </div>

          <Retorno r={ultimo} equipes={equipes} />
          {novo && <CadastroRapido r={novo} pessoas={pr.base.pessoas} funcoes={pr.base.funcoes ?? []} online={pr.online} equipes={equipes}
            onFechar={() => setNovo(null)}
            onVincular={async (p) => { const res = await pr.vincular(p, novo); setNovo(null); mostrar(res); }}
            onCadastrar={async (nome, f) => { const res = await pr.cadastrar(nome, f, novo); setNovo(null); mostrar(res); }} />}

          {modo === 'nfc' && <LeitorNfc onLer={async (s, t) => mostrar(await pr.porNfc(s, t))} />}
          {modo === 'codigo' && <LeitorCodigo onLer={async (c, meio) => mostrar(await pr.porCodigo(c, meio))} />}
          {modo === 'facial' && <LeitorFacial pessoas={pr.base.pessoas} limite={pr.base.distancia_max} onLer={async (p) => mostrar(await pr.registrar(p, 'facial'))} />}

          <section className={cartaoM}>
            <div className="flex items-center justify-between gap-2">
              <select aria-label="Equipe" value={equipe} onChange={(e) => setEquipe(e.target.value)}
                className="h-11 min-w-0 flex-1 rounded-[12px] border border-m-stroke bg-m-surface-field px-3 text-[14px]">
                <option value="">Todas as equipes</option>
                {(pr.base.equipes ?? []).map((e) => <option key={e.id} value={e.id}>{e.nome}{e.encarregado ? ` — ${e.encarregado.replace(/^\s*\d+\s*::\s*/, '')}` : ''}</option>)}
              </select>
              <span className="shrink-0 text-[22px] font-semibold tabular-nums">{presentesEquipe} <span className="text-[14px] font-medium text-m-text-muted">de {pessoasEquipe.length}</span></span>
            </div>
            {modo === 'lista' || equipe ? (
              <ListaEquipe pessoas={pessoasEquipe} presentes={pr.presentes} onMarcar={async (p) => mostrar(await pr.registrar(p, 'manual'))} />
            ) : (
              <ul className="flex flex-col">
                {pr.hoje.slice(0, 30).map((l) => (
                  <li key={l.id_local} className="flex min-h-[48px] items-center gap-3 border-b border-m-stroke-subtle last:border-0">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-m-accent-strong text-[11px] font-semibold text-m-on-accent">{iniciais(l.nome)}</span>
                    <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-[14px]">{l.nome}</span>
                      {l.valida === false && <span className="truncate text-[11.5px] font-semibold text-m-warning">duplicada · vale a de {l.hora_valida ? hora(l.hora_valida) : '—'}{l.outro_celular ? ' (outro celular)' : ''}</span>}</span>
                    <span className="text-[11.5px] text-m-text-muted">{MEIO[l.meio]}</span>
                    <span className={`text-[13px] font-semibold tabular-nums ${l.erro ? 'text-m-danger' : l.enviada ? 'text-m-accent' : 'text-m-warning'}`} title={l.erro ?? (l.enviada ? 'enviada' : 'na fila')}>{hora(l.hora)}{l.enviada ? '' : ' ·'}</span>
                  </li>
                ))}
                {!pr.hoje.length && <li className="py-2 text-[13px] text-m-text-muted">Nenhuma leitura hoje neste celular.</li>}
              </ul>
            )}
          </section>

          <div className="flex items-center justify-between gap-2 px-1 text-[12px] text-m-text-muted">
            <span>Efetivo baixado {new Date(pr.base.gerado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {pr.base.pessoas.length} pessoas · {pr.base.pessoas.filter((p) => p.face).length} com rosto</span>
            <button type="button" disabled={pr.baixando || !pr.online} onClick={() => { pr.baixarBase(); pr.enviar(); }} className="inline-flex h-9 items-center gap-1 rounded-full border border-m-stroke px-3 font-semibold text-m-accent disabled:opacity-40">
              <RefreshCw size={14} className={pr.baixando ? 'animate-spin' : ''} /> Atualizar
            </button>
          </div>
        </>
      )}
    </>
  );
}

function Retorno({ r, equipes }: { r: Resultado | null; equipes: Map<number, { nome: string }> }) {
  if (!r) return <div className="flex h-[76px] items-center justify-center rounded-[18px] border border-dashed border-m-stroke text-[13px] text-m-text-muted">A última leitura aparece aqui</div>;
  const cor = r.tipo === 'ok' ? 'bg-m-success text-white' : r.tipo === 'repetido' ? 'bg-m-warning-subtle text-m-warning' : 'bg-m-danger text-white';
  return (
    <div role="status" aria-live="assertive" className={`flex h-[76px] items-center gap-3 rounded-[18px] px-4 ${cor}`}>
      {r.tipo === 'desconhecido' ? <XCircle size={30} /> : <CheckCircle2 size={30} />}
      <div className="flex min-w-0 flex-col">
        {r.tipo === 'desconhecido' ? (
          <><span className="text-[16px] font-bold">Não cadastrado</span><span className="truncate text-[13px] opacity-90">{r.codigo} · abrindo o cadastro rápido</span></>
        ) : (
          <>
            <span className="truncate text-[17px] font-bold">{r.pessoa.nome}</span>
            <span className="truncate text-[13px] opacity-90">
              {r.tipo === 'ok' ? `Presente ${hora(r.hora)}` : `Já registrado às ${hora(r.hora)}${r.outro ? ' por outro celular' : ''}`}
              {r.pessoa.equipe_id ? ` · ${equipes.get(r.pessoa.equipe_id)?.nome ?? ''}` : ' · sem equipe'}{r.pessoa.funcao ? ` · ${r.pessoa.funcao}` : ''}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function ListaEquipe({ pessoas, presentes, onMarcar }: { pessoas: PessoaBase[]; presentes: Map<number, { hora: string; meio: string }>; onMarcar: (p: PessoaBase) => void }) {
  const [busca, setBusca] = useState('');
  const t = busca.trim().toLowerCase();
  const lista = pessoas.filter((p) => !t || p.nome.toLowerCase().includes(t) || (p.matricula ?? '').includes(t))
    .sort((a, b) => Number(presentes.has(a.id)) - Number(presentes.has(b.id)) || a.nome.localeCompare(b.nome));
  return (
    <div className="flex flex-col">
      <input aria-label="Buscar pessoa" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome ou matrícula"
        className="mb-1 h-11 rounded-[12px] border border-m-stroke bg-m-surface-field px-3 text-[14px]" />
      {lista.slice(0, 200).map((p) => {
        const l = presentes.get(p.id);
        return (
          <div key={p.id} className="flex min-h-[52px] items-center gap-3 border-b border-m-stroke-subtle last:border-0">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white ${l ? 'bg-m-accent-strong' : 'bg-m-text-muted'}`}>{iniciais(p.nome)}</span>
            <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-[14px]">{p.nome}</span><span className="truncate text-[11.5px] text-m-text-muted">{[p.matricula, p.funcao].filter(Boolean).join(' · ')}</span></span>
            {l ? <span className="text-[13px] font-semibold text-m-accent">{hora(l.hora)}</span>
              : <button type="button" onClick={() => onMarcar(p)} className="h-10 rounded-full border border-m-stroke px-3 text-[13px] font-semibold text-m-accent">Presente</button>}
          </div>
        );
      })}
      {!lista.length && <span className="py-2 text-[13px] text-m-text-muted">Ninguém nesta equipe.</span>}
    </div>
  );
}

/** Crachá lido sem cadastro (spec 065): liga a uma pessoa do efetivo (vale sem internet) ou cadastra a pessoa de forma
 * simplificada (nome + função do de-para) — o DP/RH recebe o alerta para completar o cadastro. */
function CadastroRapido({ r, pessoas, funcoes, online, equipes, onFechar, onVincular, onCadastrar }: {
  r: Extract<Resultado, { tipo: 'desconhecido' }>; pessoas: PessoaBase[]; funcoes: { funcao_chave: string; funcao: string; recurso: string | null }[];
  online: boolean; equipes: Map<number, { nome: string }>; onFechar: () => void; onVincular: (p: PessoaBase) => Promise<void>; onCadastrar: (nome: string, funcaoChave: string) => Promise<void>;
}) {
  const [aba, setAba] = useState<'efetivo' | 'novo'>('efetivo');
  const [busca, setBusca] = useState('');
  const [nome, setNome] = useState('');
  const [funcao, setFuncao] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const sem = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const termos = sem(busca).split(/\s+/).filter(Boolean);
  const achadas = termos.length ? pessoas.filter((p) => termos.every((x) => sem(`${p.nome} ${p.matricula ?? ''} ${p.funcao ?? ''}`).includes(x))).slice(0, 30) : [];
  const fazer = async (fn: () => Promise<void>) => { setOcupado(true); setErro(''); try { await fn(); } catch (e) { setErro((e as Error).message); } finally { setOcupado(false); } };
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45" onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Cadastrar crachá" className="flex max-h-[90dvh] w-full max-w-[480px] flex-col gap-3 overflow-y-auto rounded-t-[24px] bg-m-surface-raised p-4 pb-[max(env(safe-area-inset-bottom),16px)]">
        <div className="flex items-start justify-between gap-2">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-danger">Crachá não cadastrado</p>
            <h2 className="text-[17px] font-semibold">{r.meio === 'nfc' ? 'NFC' : 'Código'} {r.codigo}</h2></div>
          <button type="button" onClick={onFechar} className="h-10 rounded-full border border-m-stroke px-3 text-[13px] font-semibold">Agora não</button>
        </div>
        <div role="tablist" aria-label="Quem é" className="grid grid-cols-2 gap-1 rounded-full border border-m-stroke p-1">
          {([['efetivo', 'Pessoa do efetivo'], ['novo', 'Não está no efetivo']] as const).map(([v, t]) => (
            <button key={v} type="button" role="tab" aria-selected={aba === v} onClick={() => setAba(v)} className={`h-10 rounded-full text-[13.5px] font-semibold ${aba === v ? 'bg-m-accent-strong text-m-on-accent' : 'text-m-text-secondary'}`}>{t}</button>
          ))}
        </div>
        {aba === 'efetivo' ? (
          <>
            <input autoFocus aria-label="Buscar no efetivo" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou matrícula"
              className="h-12 rounded-[14px] border-2 border-m-accent-strong bg-m-surface-field px-3.5 text-[16px] outline-none" />
            <div className="flex flex-col">
              {achadas.map((p) => (
                <button key={p.id} type="button" disabled={ocupado} onClick={() => fazer(() => onVincular(p))} className="flex min-h-[54px] items-center justify-between gap-2 border-b border-m-stroke-subtle text-left last:border-0">
                  <span className="min-w-0"><span className="block truncate text-[15px] font-medium">{p.nome}</span>
                    <span className="block truncate text-[12px] text-m-text-muted">{[p.matricula, p.funcao, p.equipe_id ? equipes.get(p.equipe_id)?.nome : 'sem equipe'].filter(Boolean).join(' · ')}</span></span>
                  <span className="shrink-0 rounded-full bg-m-accent-strong px-3 py-1.5 text-[12.5px] font-semibold text-m-on-accent">É esta</span>
                </button>
              ))}
              {termos.length > 0 && !achadas.length && <button type="button" onClick={() => { setAba('novo'); setNome(busca); }} className="py-3 text-left text-[13.5px] text-m-accent underline">Ninguém com “{busca}” no efetivo: cadastrar como nova pessoa</button>}
              {!termos.length && <span className="py-2 text-[13px] text-m-text-muted">Digite o nome ou a matrícula; o crachá fica ligado à pessoa e a presença já entra{online ? '' : ' (sem internet: sobe depois)'}.</span>}
            </div>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-m-text-secondary">Nome completo
              <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} className="h-12 rounded-[14px] border border-m-stroke bg-m-surface-field px-3.5 text-[16px]" /></label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-m-text-secondary">Função de contratação (de-para de funções)
              <select value={funcao} onChange={(e) => setFuncao(e.target.value)} className="h-12 rounded-[14px] border border-m-stroke bg-m-surface-field px-3 text-[15px]">
                <option value="">— escolha —</option>
                {funcoes.map((f) => <option key={f.funcao_chave} value={f.funcao_chave}>{f.funcao}{f.recurso ? ` → ${f.recurso}` : ''}</option>)}
              </select></label>
            {!funcoes.length && <span className="text-[12.5px] text-m-warning">Nenhuma função no de-para ainda: o planejamento cadastra em Efetivo › De-para de funções.</span>}
            <span className="text-[12.5px] text-m-text-muted">A pessoa entra no efetivo como cadastro simplificado e o DP/RH recebe o alerta para completar (matrícula). Quando a planilha do DP trouxer a matrícula, o cadastro se completa sozinho.</span>
            <button type="button" disabled={ocupado || !online || nome.trim().split(/\s+/).length < 2 || !funcao} onClick={() => fazer(() => onCadastrar(nome, funcao))}
              className="h-[52px] rounded-full bg-m-accent-strong text-[15px] font-semibold text-m-on-accent disabled:opacity-40">{online ? 'Cadastrar e registrar presença' : 'Precisa de internet para cadastrar'}</button>
          </>
        )}
        {erro && <span className="text-[13px] text-m-danger">{erro}</span>}
      </div>
    </div>
  );
}
