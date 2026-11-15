'use client';

import { ArrowDown, ArrowUpRight, Gavel } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { PedraCubica } from '@/components/Marca/PedraCubica';
import { Link } from '@/i18n/navigation';
import { useSessao } from '@/lib/auth/AuthProvider';

/**
 * Página principal do Malhet (specs 092 e 094): a história da marca em seis atos, conduzida pela rolagem — frases que
 * acendem palavra por palavra, a cena que avança linha a linha, a linha em foco no centro da tela, o nome que desliza e o
 * golpe que sela "O que foi decidido, fica." Fio visual: a pedra bruta (pontos soltos) que vira pedra cúbica.
 * Voz da marca: direta, do canteiro, sem número não confirmado e sem a IA como manchete.
 */
const VERDE = '#284E4F', AGUA = '#6FB3B1', TINTA = '#070911', PEDRA = '#F6F8F8', FUNDO_ESCURO = '#0D1A1B', TERRA = '#B36449';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const limitar = (v: number) => Math.min(1, Math.max(0, v));

// ---- rolagem: um único ouvinte para a página toda --------------------------------------------------------
const ouvintes = new Set<() => void>();
let ligado = false;
function ouvirRolagem(f: () => void) {
  ouvintes.add(f);
  if (!ligado && typeof window !== 'undefined') {
    ligado = true;
    let raf = 0;
    const tudo = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => ouvintes.forEach((g) => g())); };
    window.addEventListener('scroll', tudo, { passive: true });
    window.addEventListener('resize', tudo);
  }
  f();
  return () => { ouvintes.delete(f); };
}
/** Tela em pé (celular, dobrável aberto, tablet em retrato) ou estreita: layout empilhado, cubo acima do texto. */
const empilhado = () => typeof window !== 'undefined' && (window.innerWidth < 900 || window.innerHeight > window.innerWidth * 1.05);
const semMovimento = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 0→1 enquanto o elemento atravessa a tela (`fixo`: enquanto a seção alta rola por baixo do quadro preso). */
function useProgresso(ref: RefObject<HTMLElement | null>, modo: 'passagem' | 'fixo' | 'entrada' = 'passagem') {
  const [p, setP] = useState(0);
  useEffect(() => {
    if (semMovimento()) { setP(1); return; }
    return ouvirRolagem(() => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect(), vh = window.innerHeight;
      const v = modo === 'fixo' ? -r.top / Math.max(1, r.height - vh)
        : modo === 'entrada' ? (vh - r.top) / (vh * 0.75)
        : (vh - r.top) / (r.height + vh);
      setP(limitar(v));
    });
  }, [ref, modo]);
  return p;
}

/** 1 quando o elemento está no centro da tela, caindo para 0 longe dele: a linha em foco. */
function useFoco(ref: RefObject<HTMLElement | null>) {
  const [f, setF] = useState(1);
  useEffect(() => {
    if (semMovimento()) return;
    return ouvirRolagem(() => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect(), vh = window.innerHeight;
      setF(limitar(1 - Math.abs(r.top + r.height / 2 - vh * 0.5) / (vh * 0.38)));
    });
  }, [ref]);
  return f;
}

/** Frase que acende palavra por palavra conforme a leitura avança; palavras com *asterisco* acendem em destaque. */
function Acende({ texto, className, style, cor = TINTA, apagado = 'rgba(7,9,17,.14)', destaque = VERDE }: {
  texto: string; className?: string; style?: React.CSSProperties; cor?: string; apagado?: string; destaque?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const p = useProgresso(ref, 'entrada');
  const palavras = texto.split(' ');
  const n = palavras.length;
  return (
    <p ref={ref} className={className} style={style}>
      {palavras.map((w, i) => {
        const forte = w.startsWith('*');
        const t = limitar(p * (n + 6) * 0.9 - i);
        return (
          <span key={i} style={{ color: t > 0.5 ? (forte ? destaque : cor) : apagado, fontWeight: forte ? 800 : undefined, transition: 'color .35s ease' }}>
            {w.replace(/\*/g, '')}{i < n - 1 ? ' ' : ''}
          </span>
        );
      })}
    </p>
  );
}

/** Linha que ganha foco no centro da tela (as outras recuam). */
function EmFoco({ children, className = '' }: { children: (foco: number) => ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const f = useFoco(ref);
  return <div ref={ref} className={className}>{children(f)}</div>;
}

/** Entra subindo (uma vez). */
function Revela({ children, atraso = 0, className = '' }: { children: ReactNode; atraso?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visto, setVisto] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (semMovimento()) { setVisto(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisto(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}
      style={{ opacity: visto ? 1 : 0, transform: visto ? 'none' : 'translateY(36px)', transition: `opacity 1s ease ${atraso}ms, transform 1s cubic-bezier(.2,.7,.2,1) ${atraso}ms` }}>
      {children}
    </div>
  );
}

function Marcador({ n, titulo, claro = false }: { n: string; titulo: string; claro?: boolean }) {
  return (
    <div className={`flex items-center justify-between border-t pt-4 text-[11px] uppercase tracking-[0.18em] ${claro ? 'border-white/15 text-white/55' : 'border-black/10 text-black/45'}`}
      style={{ fontFamily: MONO }}>
      <span>( {n} )&nbsp;&nbsp;{titulo}</span>
      <span>[ 00{n} / 006 ]</span>
    </div>
  );
}

const ATOS = [['topo', 'A obra'], ['historia', 'A cena'], ['metodo', 'O espaço'], ['nome', 'O nome'], ['para-quem', 'Para quem'], ['manifesto', 'Manifesto']] as const;

/** Barra fina de leitura: em que ato da história a pessoa está. */
function Leitura() {
  const [p, setP] = useState(0);
  const [ato, setAto] = useState(0);
  useEffect(() => ouvirRolagem(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    setP(max > 0 ? window.scrollY / max : 0);
    let a = 0;
    ATOS.forEach(([id], i) => { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top < window.innerHeight * 0.45) a = i; });
    setAto(a);
  }), []);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0">
      <div className="h-[2px] bg-black/5" role="progressbar" aria-label={`Leitura: ${ATOS[ato][1]}`} aria-valuenow={Math.round(p * 100)}><div className="h-[2px]" style={{ width: `${p * 100}%`, background: VERDE }} /></div>
    </div>
  );
}

const NAV = [['#historia', 'A história'], ['#metodo', 'O método'], ['#nome', 'O nome'], ['#para-quem', 'Para quem']] as const;

export function Landing() {
  const { usuario, carregado } = useSessao();
  const [y, setY] = useState(0);
  const [estreito, setEstreito] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const progresso = useProgresso(heroRef, 'fixo');
  useEffect(() => ouvirRolagem(() => { setY(window.scrollY); setEstreito(empilhado()); }), []);
  const lapidado = progresso > 0.5;
  const entrar = carregado && usuario ? { href: '/app/vigente', texto: 'Abrir o Malhet' } : { href: '/auth/entrar', texto: 'Entrar' };
  const saida = limitar((progresso - 0.8) / 0.2); // o título sobe um pouco quando a pedra fica pronta (sem sumir)

  return (
    <div className="min-h-screen overflow-x-clip" style={{ background: PEDRA, color: TINTA }}>
      <header className="fixed inset-x-0 top-0 z-50 px-5 py-4 sm:px-10"
        style={{ background: y > 40 ? 'rgba(246,248,248,.88)' : 'transparent', backdropFilter: y > 40 ? 'blur(10px)' : 'none', transition: 'background .3s' }}>
        <div className="mx-auto flex max-w-[1680px] items-center justify-between">
          <a href="#topo" aria-label="Malhet — início"><img src="/brand/malhet.svg" alt="Malhet" className="h-[22px] w-auto" /></a>
          <nav aria-label="Seções" className="flex items-center gap-5 text-[11px] font-medium uppercase tracking-[0.16em]">
            {NAV.map(([h, t]) => <a key={h} href={h} className="hidden hover:text-[color:var(--verde)] lg:inline" style={{ ['--verde' as string]: VERDE }}>{t}</a>)}
            <Link href={entrar.href} className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-white" style={{ background: VERDE }}>
              {entrar.texto} <ArrowUpRight size={13} strokeWidth={2} />
            </Link>
          </nav>
        </div>
        {y > 40 && <Leitura />}
      </header>

      {/* 01 · a obra — a pedra se lapida conforme rola */}
      <section id="topo" ref={heroRef} className="relative" style={{ height: estreito ? '150vh' : '165vh' }}>
        <div className="sticky top-0 h-[100svh] overflow-hidden">
          <PedraCubica progresso={progresso} escala={estreito ? 0.26 : 0.34} deslocX={estreito ? 0 : 0.23} deslocY={estreito ? -0.2 : 0}
            className="absolute inset-0 h-full w-full" />
          <div className="relative mx-auto flex h-full max-w-[1680px] flex-col px-5 pb-10 pt-24 sm:px-10">
            <div className="flex justify-between text-[11px] uppercase tracking-[0.18em] text-black/45" style={{ fontFamily: MONO }}>
              <span>( 01 )&nbsp;&nbsp;Gestão da execução de obras</span>
              <span className="hidden sm:inline">[ 001 / 006 ]</span>
            </div>
            <div className={`flex flex-1 flex-col ${estreito ? 'justify-end' : 'justify-center'}`}
              style={{ transform: `translateY(${-saida * 24}px)` }}>
              <h1 className="leading-[0.9] tracking-[-0.045em]" style={{ fontSize: 'clamp(46px, 7.2vw, 128px)' }}>
                <span className="block font-light lg:whitespace-nowrap">Toda obra é feita</span>
                <span className="block font-extrabold" style={{ color: VERDE }}>de decisões.</span>
              </h1>
              <p className="mt-7 max-w-[600px] text-[17px] leading-7 text-black/70 sm:text-[20px] sm:leading-8">
                O Malhet registra o que acontece na obra, <b className="font-semibold text-black">quem decidiu</b> e <b className="font-semibold text-black">quanto custou</b> — para que nenhuma decisão se perca.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href={entrar.href} className="inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold text-white" style={{ background: VERDE }}>
                  {entrar.texto} <ArrowUpRight size={16} />
                </Link>
                <a href="#historia" className="inline-flex h-12 items-center gap-2 rounded-full border border-black/15 px-6 text-[15px] font-semibold hover:bg-black/5">
                  Conhecer a história <ArrowDown size={16} />
                </a>
              </div>
            </div>
            <div className="flex items-end justify-between gap-6">
              <span className={`text-[11px] uppercase tracking-[0.18em] text-black/40 transition-opacity ${progresso > 0.05 ? 'opacity-0' : 'opacity-100'}`} style={{ fontFamily: MONO }}>
                Role para lapidar ↓
              </span>
              <div className="max-w-[340px] text-right" aria-live="polite">
                <p className="text-[11px] uppercase tracking-[0.18em]" style={{ fontFamily: MONO, color: lapidado ? VERDE : 'rgba(0,0,0,.45)' }}>{lapidado ? 'Sai lapidado' : 'Entra bruto'}</p>
                <p className="mt-2 text-[16px] leading-6 sm:text-[17px]">
                  {lapidado ? 'Dado confiável, decisão tomada, responsável conhecido.' : 'No rádio, no WhatsApp, num papel. O ocorrido chega solto.'}
                </p>
                <div className="mt-3 h-[2px] w-full bg-black/10"><div className="h-[2px]" style={{ width: `${progresso * 100}%`, background: VERDE }} /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Cena />
      <Espaco />
      <Nome />
      <ParaQuem />
      <Manifesto entrar={entrar} />

      <footer className="flex flex-wrap items-center justify-between gap-4 px-5 py-8 text-[12px] text-white/45 sm:px-10" style={{ background: FUNDO_ESCURO, borderTop: '1px solid rgba(255,255,255,.08)' }}>
        <img src="/brand/malhet-escuro.svg" alt="Malhet" className="h-[18px] w-auto opacity-80" />
        <span style={{ fontFamily: MONO }}>GESTÃO DA EXECUÇÃO DE OBRAS</span>
        <Link href="/privacidade" className="underline hover:text-white/80">Política de privacidade</Link>
      </footer>
    </div>
  );
}

// ---- 02 · a cena: presa na tela, o registro avança linha a linha com a rolagem ----------------------------
const CENA = [
  ['SEG 07:00', 'O guindaste previsto não chega.', ''],
  ['SEG 07:12', 'O engenheiro remaneja a equipe e avisa no grupo.', 'Decisão correta.'],
  ['SEG 07:13', 'A obra segue.', ''],
  ['+21 DIAS', 'Na medição, o cliente questiona o atraso.', ''],
  ['+21 DIAS', 'Ninguém acha o registro.', 'Sem nome, sem data, sem valor.'],
] as const;

function Cena() {
  const ref = useRef<HTMLElement>(null);
  // no computador a cena fica presa na tela; no celular (conteúdo maior que a tela) rola e acende conforme a leitura
  const [preso, setPreso] = useState(true);
  useEffect(() => ouvirRolagem(() => setPreso(!empilhado() && window.innerHeight >= 640)), []);
  const pFixo = useProgresso(ref, 'fixo');
  const pPassa = useProgresso(ref, 'passagem');
  const p = preso ? pFixo : limitar((pPassa - 0.2) / 0.45);
  const atual = Math.min(CENA.length, Math.floor(p * (CENA.length + 1.4)));
  const perdeu = atual >= CENA.length;
  return (
    <section id="historia" ref={ref} className="relative" style={{ height: preso ? '200vh' : 'auto' }}>
      <div className={`${preso ? 'sticky top-0 h-[100svh] justify-center' : 'py-16'} flex flex-col px-5 sm:px-10`}>
        <div className="mx-auto w-full max-w-[1680px]">
          <Marcador n="2" titulo="A cena" />
          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
            <div>
              <h2 className="font-light leading-[1.02] tracking-[-0.03em]" style={{ fontSize: 'clamp(34px, 5vw, 80px)' }}>
                O fato aconteceu.<br />
                <span className="font-extrabold transition-colors duration-700" style={{ color: perdeu ? TERRA : TINTA }}>Não virou registro.</span>
              </h2>
              <p className="mt-7 max-w-[540px] text-[16px] leading-7 text-black/65 sm:text-[17px]">
                O Malhet nasceu no canteiro, não num escritório de software. Vem de mais de 14 anos de planejamento, medição e
                controle de contratos em obras EPC de mineração, siderurgia e energia — onde essa cena se repetiu em toda obra.
              </p>
            </div>
            <ol className="flex flex-col gap-1.5 text-[14px] sm:text-[17px]" style={{ fontFamily: MONO }} aria-label="Uma segunda-feira na obra">
              {CENA.map(([h, t, n], i) => {
                const estado = i < atual ? 'passou' : i === atual ? 'agora' : 'vem';
                return (
                  <li key={i} className="grid grid-cols-[92px_1fr] gap-4 rounded-[12px] px-4 py-3.5 sm:grid-cols-[124px_1fr]"
                    style={{
                      opacity: estado === 'vem' ? 0.12 : estado === 'passou' ? 0.4 : 1,
                      background: estado === 'agora' ? '#fff' : 'transparent',
                      boxShadow: estado === 'agora' ? '0 1px 0 rgba(0,0,0,.04), 0 12px 30px -18px rgba(40,78,79,.45)' : 'none',
                      transform: estado === 'agora' ? 'translateX(6px)' : 'none',
                      transition: 'all .5s cubic-bezier(.2,.7,.2,1)',
                    }}>
                    <span style={{ color: estado === 'agora' ? VERDE : 'rgba(0,0,0,.45)' }}>{h}</span>
                    <span>{t}{n && <span className="block text-black/45">{n}</span>}</span>
                  </li>
                );
              })}
              <li className="mt-2 grid grid-cols-[92px_1fr] gap-4 rounded-[12px] px-4 py-4 sm:grid-cols-[124px_1fr]"
                style={{ opacity: perdeu ? 1 : 0, transform: perdeu ? 'none' : 'translateY(14px)', background: '#FBF1EE', transition: 'all .6s ease' }}>
                <span style={{ color: TERRA }}>RESULTADO</span>
                <span className="font-semibold" style={{ color: TERRA }}>O pleito se perde. A informação morreu no caminho.</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---- 03 · o espaço entre o cronograma e o BMM ------------------------------------------------------------
function Espaco() {
  return (
    <section id="metodo" className="px-5 py-16 sm:px-10 sm:py-24" style={{ background: '#EDF1F1' }}>
      <div className="mx-auto max-w-[1680px]">
        <Marcador n="3" titulo="O espaço" />
        <Acende className="mt-10 max-w-[1240px] font-light leading-[1.06] tracking-[-0.03em]" style={{ fontSize: 'clamp(32px, 4.8vw, 76px)' }}
          texto="O cronograma diz o que deveria acontecer. O BMM diz o que foi medido. Entre os dois fica *o *que *de *fato *aconteceu — e é ali que se *ganha ou se *perde dinheiro." />

        <Revela className="mt-20">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-[15px] sm:text-[16px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.16em] text-black/45" style={{ fontFamily: MONO }}>
                  <th className="border-b border-black/15 py-3 pr-6 font-normal">Ferramenta</th>
                  <th className="border-b border-black/15 py-3 pr-6 font-normal">Responde a</th>
                  <th className="border-b border-black/15 py-3 font-normal">Deixa sem resposta</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Cronograma (P6, MS Project)', 'O que deveria acontecer e quando', 'O que de fato aconteceu'],
                  ['BMM (boletim de medição)', 'O que foi medido e quanto vai ser pago', 'Por que o custo mudou'],
                  ['Planilhas e WhatsApp', 'O que está acontecendo agora', 'Quem decidiu, e o histórico'],
                ].map(([f, r, d]) => (
                  <tr key={f}>
                    <td className="border-b border-black/10 py-5 pr-6 font-semibold">{f}</td>
                    <td className="border-b border-black/10 py-5 pr-6 text-black/70">{r}</td>
                    <td className="border-b border-black/10 py-5 text-black/45 line-through decoration-black/25">{d}</td>
                  </tr>
                ))}
                <tr style={{ background: VERDE, color: '#fff' }}>
                  <td className="py-6 pl-4 pr-6 text-[18px] font-extrabold">Malhet</td>
                  <td className="py-6 pr-6 text-[17px]" colSpan={2}>O que aconteceu, quem decidiu, quem validou e quanto custou.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Revela>

        <div className="mt-20">
          {[
            ['Registro', 'O guindaste atrasou às 7h. Às 7h05, já estava registrado.', 'O ocorrido é registrado em campo, no momento em que acontece.'],
            ['Responsabilidade', 'Validado é com nome, data e hora.', 'Toda atividade tem dono; cada etapa validada tem responsável, setor e hora.'],
            ['Conexão', 'O campo resolve. O planejamento fica sabendo. O cliente vê.', 'A atividade chega ao setor certo, com prazo e o porquê.'],
            ['Resultado', 'Pare de descobrir o prejuízo na medição.', 'Perdas e ganhos contabilizados por ocorrência validada.'],
          ].map(([pilar, frase, prova], i) => (
            <EmFoco key={pilar}>
              {(f) => (
                <div className="grid gap-3 border-t border-black/10 py-10 lg:grid-cols-[220px_1fr_340px] lg:items-baseline lg:gap-10"
                  style={{ opacity: 0.22 + f * 0.78, transition: 'opacity .2s linear' }}>
                  <span className="text-[11px] uppercase tracking-[0.18em]" style={{ fontFamily: MONO, color: f > 0.6 ? VERDE : 'rgba(0,0,0,.45)' }}>0{i + 1} · {pilar}</span>
                  <p className="font-semibold leading-[1.08] tracking-[-0.02em]"
                    style={{ fontSize: 'clamp(26px, 3.4vw, 52px)', transform: `translateX(${(1 - f) * -18}px)`, color: f > 0.6 ? TINTA : 'rgba(7,9,17,.75)' }}>{frase}</p>
                  <p className="text-[15px] leading-6 text-black/60">{prova}</p>
                </div>
              )}
            </EmFoco>
          ))}
        </div>

        <Revela className="mt-20 grid gap-10 border-t border-black/10 pt-10 lg:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-black/45" style={{ fontFamily: MONO }}>Um cérebro, vários apps</p>
            <p className="mt-3 max-w-[520px] text-[17px] leading-7 text-black/70">
              Uma memória única da obra que os apps de cada área compartilham. A empresa assina os que precisa, e todos conversam entre si.
            </p>
            <ul className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-black/10 bg-black/10 text-[15px]">
              {[['VisualPlan', 'cronograma e governança'], ['PlanningControl', 'execução e avanço'], ['ADC Digital', 'administração contratual'], ['Painel de Indicadores', 'PPC, restrições, desvios']].map(([a, d]) => (
                <li key={a} className="bg-[#F6F8F8] p-4 transition-colors hover:bg-white"><b className="font-semibold">{a}</b><span className="block text-[13px] text-black/50">{d}</span></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-black/45" style={{ fontFamily: MONO }}>Quatro compromissos</p>
            <ol className="mt-4 text-[17px]">
              {['Várias empresas na mesma conta.', 'Custo baixo.', 'Conformidade com a LGPD.', 'Um modo que funciona sem inteligência artificial, para quem não aceita IA no processo.'].map((c, i) => (
                <li key={c} className="flex gap-4 border-b border-black/10 py-3"><span className="text-black/35" style={{ fontFamily: MONO }}>0{i + 1}</span>{c}</li>
              ))}
            </ol>
          </div>
        </Revela>
      </div>
    </section>
  );
}

// ---- 04 · o nome: o malhete abre os trabalhos, concede a palavra e bate para selar ---------------------
function Nome() {
  const ref = useRef<HTMLElement>(null);
  const p = useProgresso(ref, 'passagem');
  const [batido, setBatido] = useState<string | null>(null);
  const [golpe, setGolpe] = useState(0);
  const bater = () => {
    const agora = new Date();
    setGolpe((g) => g + 1);
    setTimeout(() => setBatido(`${agora.toLocaleDateString('pt-BR')} · ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`), 260);
  };
  return (
    <section id="nome" ref={ref} className="overflow-hidden px-5 py-16 sm:px-10 sm:py-24">
      <div className="mx-auto max-w-[1680px]">
        <Marcador n="4" titulo="O nome" />
      </div>
      <p aria-hidden="true" className="mt-10 whitespace-nowrap font-extrabold leading-[0.82] tracking-[-0.05em]"
        style={{ fontSize: 'clamp(110px, 21vw, 360px)', color: VERDE, transform: `translateX(${(0.5 - p) * 28}vw)` }}>
        Malhet <span style={{ color: 'transparent', WebkitTextStroke: `2px ${VERDE}` }}>malhete</span>
      </p>
      <div className="mx-auto mt-12 grid max-w-[1680px] gap-16 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <Acende className="max-w-[620px] text-[20px] leading-8 sm:text-[24px] sm:leading-9" cor="rgba(7,9,17,.85)"
            texto="Vem de *malhete, o pequeno martelo de madeira da tradição dos construtores. Com ele, quem conduzia o trabalho abria a sessão, dava a palavra a cada um e, ao final, *batia *para *confirmar o que tinha sido decidido." />
          <div className="mt-10">
            {[
              ['Abria os trabalhos', 'Captura cada ocorrido da obra e põe em ordem.'],
              ['Concedia a palavra', 'Entrega a atividade a quem resolve, entre setores e com prazo.'],
              ['Batia para selar', 'Registra quem validou cada etapa, quando e com qual impacto.'],
            ].map(([a, b], i) => (
              <EmFoco key={a}>
                {(f) => (
                  <div className="grid grid-cols-[48px_1fr] gap-4 border-t border-black/10 py-5 sm:grid-cols-[48px_220px_1fr]" style={{ opacity: 0.3 + f * 0.7 }}>
                    <span style={{ fontFamily: MONO, color: f > 0.6 ? VERDE : 'rgba(0,0,0,.35)' }}>0{i + 1}</span>
                    <span className="font-semibold">{a}</span>
                    <span className="col-start-2 text-black/65 sm:col-start-auto">{b}</span>
                  </div>
                )}
              </EmFoco>
            ))}
          </div>
          <Revela className="mt-8">
            <p className="max-w-[560px] text-[15px] leading-6 text-black/55">
              Há uma segunda imagem, do ofício de pedreiro: o maço e o cinzel desbastam a pedra bruta até ela virar pedra cúbica,
              pronta para entrar na obra. No Malhet, o ocorrido entra bruto e sai lapidado.
            </p>
          </Revela>
        </div>

        <Revela atraso={150} className="lg:pt-2">
          <div className="relative rounded-[20px] border border-black/10 bg-white p-6 sm:p-8">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-black/45" style={{ fontFamily: MONO }}>
              <span>Ocorrência OC-0142</span><span>Frente de serviço · Área 3</span>
            </div>
            <p className="mt-5 text-[26px] font-semibold leading-tight tracking-[-0.01em]">Guindaste previsto não chegou</p>
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-[14px]">
              {[['Registrado', 'SEG 07:05, em campo'], ['Responsável', 'Engenheiro de produção'], ['Atividade', 'Remanejar equipe de montagem'], ['Impacto', 'Equipe parada até 07:40']].map(([k, v]) => (
                <div key={k}><dt className="text-[11px] uppercase tracking-[0.14em] text-black/40" style={{ fontFamily: MONO }}>{k}</dt><dd className="mt-1">{v}</dd></div>
              ))}
            </dl>
            <div className="mt-8 flex items-center gap-4">
              <button type="button" onClick={bater}
                className="inline-flex h-12 items-center gap-3 rounded-full px-6 text-[15px] font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ background: VERDE, outlineColor: VERDE }}>
                <span key={golpe} className={golpe ? 'm-golpe inline-block origin-bottom-right' : 'inline-block'}><Gavel size={18} strokeWidth={1.9} /></span>
                {batido ? 'Bater de novo' : 'Bater o malhete'}
              </button>
              {!batido && <span className="text-[13px] text-black/45">Sele a decisão.</span>}
            </div>
            {batido && (
              <div key={batido + golpe} className="m-carimbo pointer-events-none absolute bottom-6 right-5 rounded-[10px] border-[3px] px-4 py-3 text-right sm:right-8"
                style={{ borderColor: VERDE, color: VERDE, background: 'rgba(255,255,255,.92)' }} role="status">
                <span className="block text-[22px] font-extrabold tracking-[0.12em]">VALIDADO</span>
                <span className="block text-[11px] uppercase tracking-[0.14em]" style={{ fontFamily: MONO }}>Planejamento · {batido}</span>
              </div>
            )}
          </div>
          <p className="mt-4 text-[13px] text-black/45">Exemplo ilustrativo. Validar é com nome, data e hora.</p>
        </Revela>
      </div>
    </section>
  );
}

// ---- 05 · para quem: a linha no centro da tela em foco -------------------------------------------------
function ParaQuem() {
  return (
    <section id="para-quem" className="px-5 py-16 sm:px-10 sm:py-24">
      <div className="mx-auto max-w-[1680px]">
        <Marcador n="5" titulo="Para quem" />
        <Acende className="mt-14 max-w-[1000px] font-light leading-[1.05] tracking-[-0.03em]" style={{ fontSize: 'clamp(32px, 4.8vw, 76px)' }}
          texto="A mesma história, por *portas *diferentes." />
        <div className="mt-16">
          {[
            ['Diretor de obras', 'Descobre o prejuízo tarde demais, na medição.', 'Você vê perdas e ganhos de cada obra enquanto ainda dá para agir.'],
            ['Gerente de contrato', 'Perde pleitos por falta de registro e de prova.', 'Cada ocorrido tem data, responsável e impacto. A prova já está pronta.'],
            ['Planejamento e controle', 'Cronograma bonito que não conversa com o campo.', 'O que aconteceu na obra alimenta o planejamento, sem retrabalho.'],
            ['Engenheiro e encarregado', 'Mais um sistema para preencher.', 'Registre em segundos. Quem resolve fica com o crédito.'],
            ['Suprimentos, qualidade e SMS', 'Recebem a demanda tarde e sem contexto.', 'A atividade chega com dono, prazo e o porquê.'],
            ['Cliente da obra', 'Não confia no que a contratada reporta.', 'Cada etapa validada mostra quem assinou e quando.'],
          ].map(([q, dor, frase]) => (
            <EmFoco key={q}>
              {(f) => (
                <div className="grid gap-2 border-t border-black/10 py-8 lg:grid-cols-[260px_1fr_1.4fr] lg:gap-10 lg:px-4"
                  style={{ opacity: 0.2 + f * 0.8, background: f > 0.75 ? '#fff' : 'transparent', transition: 'background .3s' }}>
                  <span className="text-[15px] font-semibold" style={{ color: f > 0.6 ? VERDE : undefined }}>{q}</span>
                  <span className="text-[15px] text-black/50">{dor}</span>
                  <span className="leading-[1.3]" style={{ fontSize: 'clamp(20px, 1.9vw, 28px)' }}>“{frase}”</span>
                </div>
              )}
            </EmFoco>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---- 06 · manifesto: as frases acendem; o golpe sela a assinatura ---------------------------------------
function Manifesto({ entrar }: { entrar: { href: string; texto: string } }) {
  const ref = useRef<HTMLDivElement>(null);
  const p = useProgresso(ref, 'entrada');
  const selado = p > 0.55;
  return (
    <section id="manifesto" className="relative overflow-hidden px-5 py-16 text-white sm:px-10 sm:py-24" style={{ background: FUNDO_ESCURO }}>
      <div className="mx-auto max-w-[1680px]">
        <Marcador n="6" titulo="Manifesto" claro />
        <div className="relative mt-14 grid gap-10 lg:grid-cols-[1.25fr_1fr]">
          <div className="flex flex-col gap-8">
            {[
              'Toda obra é feita de decisões.',
              'A maioria delas acontece longe da mesa. No meio da frente de serviço, no rádio, na conversa rápida entre o encarregado e o engenheiro.',
              '*O *problema *nunca *foi *decidir. O problema é que *a *decisão *se *perde.',
              'Nós acreditamos que o que acontece na obra merece registro. Que cada atividade precisa de um dono. Que nenhuma etapa está validada sem um nome e uma data.',
              'Não viemos substituir o engenheiro, o planejador ou o encarregado. Viemos dar a eles o que sempre faltou: *memória.',
            ].map((t, i) => (
              <Acende key={i} texto={t} cor="#fff" apagado="rgba(255,255,255,.16)" destaque={AGUA}
                className={i === 0 ? 'font-light leading-[1.05]' : 'leading-[1.5]'}
                style={{ fontSize: i === 0 ? 'clamp(30px, 4vw, 60px)' : 'clamp(19px, 1.7vw, 26px)' }} />
            ))}
          </div>
          <div className="relative min-h-[340px] lg:min-h-0">
            <PedraCubica tema="escuro" escala={0.34} className="absolute inset-0 h-full w-full" />
          </div>
        </div>
        <div ref={ref} className="relative mt-24 border-t border-white/15 pt-14">
          <p className={`leading-[0.93] tracking-[-0.045em] ${selado ? 'm-selo' : ''}`} style={{ fontSize: 'clamp(46px, 8.6vw, 150px)', opacity: selado ? 1 : 0.15, transition: 'opacity .4s' }}>
            <span className="font-light">O que foi decidido,</span> <span className="font-extrabold" style={{ color: AGUA }}>fica.</span>
          </p>
          <div className="mt-12 flex flex-wrap items-center gap-3">
            <Link href={entrar.href} className="inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold" style={{ background: AGUA, color: FUNDO_ESCURO }}>
              {entrar.texto} <ArrowUpRight size={16} />
            </Link>
            <span className="text-[14px] text-white/50">Em piloto numa obra real, desenhado por quem viveu a dor.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
