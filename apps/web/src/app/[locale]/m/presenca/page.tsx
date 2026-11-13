'use client';

import { CheckCircle2, CloudOff, Keyboard, List, Nfc, RefreshCw, ScanFace, ScanLine, SwitchCamera, UserCheck, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TopoM, cartaoM } from '@/components/Mobile/ui';
import { carregarFace, lerRosto, maisProximo } from '@/lib/presenca/face';
import { abrirCamera, avisar, ehIos, escutarCodigos, escutarNfc, temCamera, temNfc } from '@/lib/presenca/leitores';
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
                    <span className="min-w-0 flex-1 truncate text-[14px]">{l.nome}</span>
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
              {r.tipo === 'ok' ? `Presente ${hora(r.hora)}` : `Já registrado às ${hora(r.hora)}`}
              {r.pessoa.equipe_id ? ` · ${equipes.get(r.pessoa.equipe_id)?.nome ?? ''}` : ' · sem equipe'}{r.pessoa.funcao ? ` · ${r.pessoa.funcao}` : ''}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function LeitorNfc({ onLer }: { onLer: (serial: string | null, textos: string[]) => void }) {
  const [estado, setEstado] = useState<'parado' | 'lendo' | 'erro'>('parado');
  const [msg, setMsg] = useState('');
  const parar = useRef<(() => void) | null>(null);
  useEffect(() => () => parar.current?.(), []);
  if (!temNfc()) return ehIos() ? (
    <section className={`${cartaoM} text-[14px] text-m-text-secondary`}>
      <b className="text-m-text-primary">No iPhone o navegador não lê NFC</b> (a Apple não libera o NFC para sites, nem no Chrome nem no Safari). Funciona assim:
      <ul className="list-disc pl-5">
        <li><b>Crachá com link gravado</b>: aproxime o crachá da parte de cima do iPhone, toque na notificação e a presença entra aqui sozinha. O link é gravado uma vez por um Android em Efetivo › Crachá e rosto.</li>
        <li><b>Código</b>: lê o QR ou o código de barras do crachá pela câmera, um atrás do outro — o mais rápido no iPhone.</li>
        <li><b>Rosto</b>: reconhecimento pela câmera.</li>
      </ul>
    </section>
  ) : <p className={`${cartaoM} text-[14px] text-m-text-secondary`}>Este navegador não lê NFC. A leitura NFC funciona no Chrome do Android, com o site em HTTPS. Use <b>Código</b> ou <b>Rosto</b>.</p>;
  const comecar = async () => {
    try {
      parar.current = await escutarNfc((s, t) => onLer(s, t), (m) => { setMsg(m); avisar('erro'); });
      setEstado('lendo'); setMsg('');
    } catch (e) { setEstado('erro'); setMsg((e as Error).message || 'Permita o NFC para este site.'); }
  };
  return (
    <section className="flex flex-col items-center gap-3 rounded-[20px] bg-m-accent-strong p-6 text-m-on-accent">
      <span className={`grid h-28 w-28 place-items-center rounded-full border-2 border-white/35 ${estado === 'lendo' ? 'animate-pulse shadow-[0_0_0_14px_rgba(255,255,255,0.08),0_0_0_28px_rgba(255,255,255,0.04)]' : ''}`}><Nfc size={44} /></span>
      {estado === 'lendo' ? (
        <><span className="text-[17px] font-semibold">Aproxime o crachá do celular</span><span className="text-[13px] opacity-80">Pode passar um atrás do outro</span></>
      ) : (
        <button type="button" onClick={comecar} className="h-[52px] rounded-full bg-white px-6 text-[15px] font-semibold text-m-accent-strong">Começar a ler crachás</button>
      )}
      {msg && <span className="text-center text-[13px] opacity-90">{msg}</span>}
    </section>
  );
}

function LeitorCodigo({ onLer }: { onLer: (codigo: string, meio: 'qr' | 'codigo') => void }) {
  const [txt, setTxt] = useState('');
  const [camera, setCamera] = useState(false);
  const [erro, setErro] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => { campo.current?.focus(); }, []);
  useEffect(() => {
    if (!camera || !video.current) return;
    let fechar: (() => void) | null = null; let parar: (() => void) | null = null;
    abrirCamera(video.current, 'environment')
      .then((f) => { fechar = f; parar = escutarCodigos(video.current!, (c) => onLer(c, 'qr')); })
      .catch((e) => { setErro((e as Error).message || 'Sem acesso à câmera'); setCamera(false); });
    return () => { parar?.(); fechar?.(); };
  }, [camera]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className={cartaoM}>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (txt.trim()) { onLer(txt.trim(), 'codigo'); setTxt(''); } campo.current?.focus(); }}>
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-[14px] border-2 border-m-accent-strong px-3">
          <Keyboard size={18} className="shrink-0 text-m-text-muted" aria-hidden="true" />
          <input ref={campo} value={txt} onChange={(e) => setTxt(e.target.value)} inputMode="text" autoComplete="off" aria-label="Matrícula ou código do crachá"
            placeholder="Matrícula ou leitor de código" className="h-12 min-w-0 flex-1 border-0 bg-transparent p-0 text-[17px] outline-none focus:ring-0" />
        </label>
        <button type="submit" className="h-12 rounded-full bg-m-accent-strong px-4 text-[15px] font-semibold text-m-on-accent">OK</button>
      </form>
      <span className="text-[12px] text-m-text-muted">Leitor de código de barras Bluetooth/USB também funciona aqui: cada leitura entra sozinha.</span>
      {temCamera() ? (
        camera ? (
          <div className="relative overflow-hidden rounded-[14px] bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={video} className="aspect-[4/3] w-full object-cover" />
            <span className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80" aria-hidden="true" />
            <button type="button" onClick={() => setCamera(false)} className="absolute bottom-2 right-2 h-10 rounded-full bg-white/90 px-4 text-[13px] font-semibold">Fechar câmera</button>
          </div>
        ) : (
          <button type="button" onClick={() => { setErro(''); setCamera(true); }} className="flex h-[52px] items-center justify-center gap-2 rounded-full border border-m-stroke text-[15px] font-semibold text-m-accent"><ScanLine size={18} /> Ler QR / código pela câmera</button>
        )
      ) : <span className="text-[12px] text-m-text-muted">Sem acesso à câmera neste navegador (precisa do site em HTTPS) — digite ou use um leitor.</span>}
      {erro && <span className="text-[13px] text-m-danger">{erro}</span>}
    </section>
  );
}

function LeitorFacial({ pessoas, limite, onLer }: { pessoas: PessoaBase[]; limite: number; onLer: (p: PessoaBase) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [frente, setFrente] = useState<'environment' | 'user'>('environment');
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando');
  const [msg, setMsg] = useState('Carregando o reconhecimento facial…');
  const [caixa, setCaixa] = useState<{ x: number; y: number; w: number; h: number; nome?: string } | null>(null);
  const comRosto = useMemo(() => pessoas.filter((p) => p.face), [pessoas]);
  const ler = useRef(onLer); ler.current = onLer;

  useEffect(() => {
    if (!temCamera()) { setEstado('erro'); setMsg('Sem acesso à câmera neste navegador (precisa de HTTPS).'); return; }
    if (!comRosto.length) { setEstado('erro'); setMsg('Ninguém com rosto cadastrado. Cadastre em Efetivo › Crachá e rosto.'); return; }
    let vivo = true; let fechar: (() => void) | null = null;
    const ultimo = new Map<number, number>();
    let anterior: number | null = null;
    (async () => {
      try {
        await carregarFace();
        fechar = await abrirCamera(video.current!, frente);
        setEstado('pronto'); setMsg('Enquadre um rosto por vez');
        while (vivo) {
          const v = video.current;
          const r = v && v.readyState >= 2 ? await lerRosto(v, 224) : null;
          if (!vivo) break;
          if (r && v) {
            const k = v.clientWidth / (v.videoWidth || 1);
            const m = maisProximo(r.descritor, comRosto, limite);
            setCaixa({ x: r.caixa.x * k, y: r.caixa.y * k, w: r.caixa.w * k, h: r.caixa.h * k, nome: m?.pessoa.nome });
            // duas leituras seguidas da mesma pessoa = confirmada; a mesma pessoa só de novo depois de 5 s
            if (m && anterior === m.pessoa.id && (ultimo.get(m.pessoa.id) ?? 0) + 5000 < Date.now()) {
              ultimo.set(m.pessoa.id, Date.now()); ler.current(m.pessoa);
            }
            anterior = m?.pessoa.id ?? null;
          } else { setCaixa(null); anterior = null; await new Promise((x) => setTimeout(x, 120)); }
        }
      } catch (e) { if (vivo) { setEstado('erro'); setMsg((e as Error).message || 'Não consegui abrir a câmera'); } }
    })();
    return () => { vivo = false; fechar?.(); };
  }, [frente, comRosto, limite]);

  return (
    <section className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-[20px] bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={video} className={`aspect-[3/4] w-full object-cover ${frente === 'user' ? '-scale-x-100' : ''}`} />
        {caixa && (
          <span className={`absolute rounded-[10px] border-[3px] ${caixa.nome ? 'border-green-400' : 'border-yellow-300'} ${frente === 'user' ? '-scale-x-100' : ''}`}
            style={{ left: caixa.x, top: caixa.y, width: caixa.w, height: caixa.h }} aria-hidden="true" />
        )}
        <span className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2 text-center text-[13px] font-semibold text-white">{caixa?.nome ?? msg}</span>
        <button type="button" aria-label="Trocar câmera" onClick={() => setFrente((f) => (f === 'user' ? 'environment' : 'user'))}
          className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full bg-white/85 text-m-accent-strong"><SwitchCamera size={20} /></button>
      </div>
      {estado === 'carregando' && <span className="text-center text-[12px] text-m-text-muted">Na primeira vez baixa ~6 MB; depois funciona sem internet.</span>}
      {estado === 'pronto' && <span className="flex items-center justify-center gap-1 text-[12px] text-m-text-muted"><UserCheck size={14} /> {comRosto.length} pessoas com rosto cadastrado</span>}
    </section>
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
