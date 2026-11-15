'use client';

import { ArrowDown, ArrowUpRight, Gavel } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PedraCubica } from '@/components/Marca/PedraCubica';
import { Link } from '@/i18n/navigation';
import { useSessao } from '@/lib/auth/AuthProvider';

/**
 * Página principal do Malhet (spec 092): a história da marca contada em seis atos — a cena, o espaço entre o
 * cronograma e o financeiro, o nome (o malhete que sela a decisão), para quem, e o manifesto. Fio visual: a pedra
 * bruta (pontos soltos) que vira pedra cúbica conforme a página rola. Voz da marca: direta, do canteiro, sem número
 * que não esteja confirmado e sem a IA como manchete.
 */
const VERDE = '#284E4F', AGUA = '#6FB3B1', TINTA = '#070911', PEDRA = '#F6F8F8', FUNDO_ESCURO = '#0D1A1B';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

function useRolagem() {
  const [y, setY] = useState(0);
  useEffect(() => {
    let raf = 0;
    const f = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setY(window.scrollY)); };
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => { window.removeEventListener('scroll', f); cancelAnimationFrame(raf); };
  }, []);
  return y;
}

/** Entra na tela subindo devagar (uma vez). */
function Revela({ children, atraso = 0, className = '' }: { children: ReactNode; atraso?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visto, setVisto] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVisto(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisto(true); io.disconnect(); } }, { threshold: 0.18 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}
      style={{ opacity: visto ? 1 : 0, transform: visto ? 'none' : 'translateY(28px)', transition: `opacity .9s ease ${atraso}ms, transform .9s cubic-bezier(.2,.7,.2,1) ${atraso}ms` }}>
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

const NAV = [['#historia', 'A história'], ['#metodo', 'O método'], ['#nome', 'O nome'], ['#para-quem', 'Para quem']] as const;

export function Landing() {
  const { usuario, carregado } = useSessao();
  const y = useRolagem();
  const heroRef = useRef<HTMLElement>(null);
  const [vh, setVh] = useState(900);
  const [estreito, setEstreito] = useState(false);
  useEffect(() => {
    const f = () => { setVh(window.innerHeight); setEstreito(window.innerWidth < 900); };
    f(); window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  const progresso = Math.min(1, Math.max(0, y / (vh * 0.95)));
  const lapidado = progresso > 0.5;
  const entrar = carregado && usuario ? { href: '/app/vigente', texto: 'Abrir o Malhet' } : { href: '/auth/entrar', texto: 'Entrar' };

  return (
    <div className="min-h-screen overflow-x-clip" style={{ background: PEDRA, color: TINTA }}>
      {/* barra */}
      <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 py-4 sm:px-10"
        style={{ background: y > 40 ? 'rgba(246,248,248,.86)' : 'transparent', backdropFilter: y > 40 ? 'blur(10px)' : 'none', transition: 'background .3s' }}>
        <a href="#topo" aria-label="Malhet — início"><img src="/brand/malhet.svg" alt="Malhet" className="h-[22px] w-auto" /></a>
        <nav aria-label="Seções" className="flex items-center gap-5 text-[11px] font-medium uppercase tracking-[0.16em]">
          {NAV.map(([h, t]) => <a key={h} href={h} className="hidden hover:text-[color:var(--verde)] lg:inline" style={{ ['--verde' as string]: VERDE }}>{t}</a>)}
          <Link href={entrar.href} className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-white" style={{ background: VERDE }}>
            {entrar.texto} <ArrowUpRight size={13} strokeWidth={2} />
          </Link>
        </nav>
      </header>

      {/* 01 · a obra (a pedra se lapida conforme rola) */}
      <section id="topo" ref={heroRef} className="relative" style={{ height: estreito ? '170vh' : '190vh' }}>
        <div className="sticky top-0 h-[100svh] overflow-hidden">
          <PedraCubica progresso={progresso} escala={estreito ? 0.2 : 0.3} deslocX={estreito ? 0 : 0.22} deslocY={estreito ? -0.2 : -0.04}
            className={`absolute inset-0 h-full w-full ${estreito ? 'opacity-90' : ''}`} />
          <div className="relative flex h-full flex-col justify-end px-5 pb-10 pt-24 sm:px-10 sm:pb-14">
            <div className="mb-auto mt-4 flex justify-between text-[11px] uppercase tracking-[0.18em] text-black/45" style={{ fontFamily: MONO }}>
              <span>( 01 )&nbsp;&nbsp;Gestão da execução de obras</span>
              <span className="hidden sm:inline">[ 001 / 006 ]</span>
            </div>
            <div className="grid items-end gap-8 lg:grid-cols-[1.75fr_1fr]">
              <div>
                <h1 className="leading-[0.92] tracking-[-0.04em]" style={{ fontSize: 'clamp(44px, 7.1vw, 116px)' }}>
                  <span className="block font-light lg:whitespace-nowrap">Toda obra é feita</span>
                  <span className="block font-extrabold" style={{ color: VERDE }}>de decisões.</span>
                </h1>
                <p className="mt-6 max-w-[560px] text-[17px] leading-7 text-black/70 sm:text-[19px]">
                  O Malhet registra o que acontece na obra, quem decidiu e quanto custou — para que nenhuma decisão se perca.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Link href={entrar.href} className="inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold text-white" style={{ background: VERDE }}>
                    {entrar.texto} <ArrowUpRight size={16} />
                  </Link>
                  <a href="#historia" className="inline-flex h-12 items-center gap-2 rounded-full border border-black/15 px-6 text-[15px] font-semibold hover:bg-black/5">
                    Conhecer a história <ArrowDown size={16} />
                  </a>
                </div>
              </div>
              <div className="hidden max-w-[340px] justify-self-end lg:block" aria-live="polite">
                <p className="text-[11px] uppercase tracking-[0.18em] text-black/45" style={{ fontFamily: MONO }}>{lapidado ? 'Sai lapidado' : 'Entra bruto'}</p>
                <p className="mt-2 text-[17px] leading-7">
                  {lapidado ? 'Dado confiável, decisão tomada, responsável conhecido.' : 'No rádio, no WhatsApp, num papel. O ocorrido da obra chega solto.'}
                </p>
                <div className="mt-4 h-px w-full bg-black/10"><div className="h-px" style={{ width: `${progresso * 100}%`, background: VERDE }} /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 02 · a cena */}
      <section id="historia" className="px-5 py-24 sm:px-10 sm:py-32">
        <Marcador n="2" titulo="A cena" />
        <div className="mt-12 grid gap-14 lg:grid-cols-[1fr_1.1fr]">
          <Revela>
            <h2 className="font-light leading-[1.02] tracking-[-0.03em]" style={{ fontSize: 'clamp(36px, 5.2vw, 76px)' }}>
              O fato aconteceu.<br /><span className="font-extrabold">Não virou registro.</span>
            </h2>
            <p className="mt-8 max-w-[520px] text-[17px] leading-7 text-black/70">
              O Malhet nasceu no canteiro, não num escritório de software. Vem de mais de 14 anos de planejamento, medição e
              controle de contratos em obras EPC de mineração, siderurgia e energia — onde a mesma cena se repetiu em toda obra.
            </p>
          </Revela>
          <Revela atraso={150}>
            <ol className="overflow-hidden rounded-[18px] border border-black/10 bg-white text-[14.5px] sm:text-[15.5px]" style={{ fontFamily: MONO }} aria-label="Uma segunda-feira na obra">
              {[
                ['SEG 07:00', 'O guindaste previsto não chega.', ''],
                ['SEG 07:12', 'O engenheiro remaneja a equipe e avisa no grupo.', 'Decisão correta.'],
                ['SEG 07:13', 'A obra segue.', ''],
                ['+21 DIAS', 'Na medição, o cliente questiona o atraso.', ''],
                ['+21 DIAS', 'Ninguém acha o registro.', 'Sem nome, sem data, sem valor.'],
              ].map(([h, t, n], i) => (
                <Revela key={i} atraso={250 + i * 140}>
                  <li className="grid grid-cols-[96px_1fr] gap-4 border-b border-black/5 px-5 py-4 sm:grid-cols-[120px_1fr]">
                    <span className="text-black/40">{h}</span>
                    <span>{t}{n && <span className="block text-black/45">{n}</span>}</span>
                  </li>
                </Revela>
              ))}
              <Revela atraso={1050}>
                <li className="grid grid-cols-[96px_1fr] gap-4 px-5 py-5 sm:grid-cols-[120px_1fr]" style={{ background: '#FBF1EE' }}>
                  <span style={{ color: '#B36449' }}>RESULTADO</span>
                  <span className="font-semibold" style={{ color: '#B36449' }}>O pleito se perde. A informação morreu no caminho.</span>
                </li>
              </Revela>
            </ol>
          </Revela>
        </div>
      </section>

      {/* 03 · o espaço entre o cronograma e o financeiro */}
      <section id="metodo" className="px-5 py-24 sm:px-10 sm:py-32" style={{ background: '#EDF1F1' }}>
        <Marcador n="3" titulo="O espaço" />
        <Revela className="mt-12">
          <h2 className="max-w-[1100px] font-light leading-[1.04] tracking-[-0.03em]" style={{ fontSize: 'clamp(32px, 4.6vw, 68px)' }}>
            O cronograma diz o que deveria acontecer. O ERP diz quanto foi pago.
            <span className="font-extrabold"> Entre os dois fica o que de fato aconteceu — e é ali que se ganha ou se perde dinheiro.</span>
          </h2>
        </Revela>
        <Revela atraso={120} className="mt-14">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-[15px]">
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
                  ['ERP', 'Quanto foi pago', 'Por que o custo mudou'],
                  ['Planilhas e WhatsApp', 'O que está acontecendo agora', 'Quem decidiu, e o histórico'],
                ].map(([f, r, d]) => (
                  <tr key={f}>
                    <td className="border-b border-black/10 py-5 pr-6 font-semibold">{f}</td>
                    <td className="border-b border-black/10 py-5 pr-6 text-black/70">{r}</td>
                    <td className="border-b border-black/10 py-5 text-black/45 line-through decoration-black/25">{d}</td>
                  </tr>
                ))}
                <tr style={{ background: VERDE, color: '#fff' }}>
                  <td className="py-6 pl-4 pr-6 text-[17px] font-extrabold">Malhet</td>
                  <td className="py-6 pr-6 text-[16px]" colSpan={2}>O que aconteceu, quem decidiu, quem validou e quanto custou.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Revela>

        <div className="mt-24 grid gap-0">
          {[
            ['Registro', 'O guindaste atrasou às 7h. Às 7h05, já estava registrado.', 'O ocorrido é registrado em campo, no momento em que acontece.'],
            ['Responsabilidade', 'Validado é com nome, data e hora.', 'Toda atividade tem dono; cada etapa validada tem responsável, setor e hora.'],
            ['Conexão', 'O campo resolve. O planejamento fica sabendo. O cliente vê.', 'A atividade chega ao setor certo, com prazo e o porquê.'],
            ['Resultado', 'Pare de descobrir o prejuízo na medição.', 'Perdas e ganhos contabilizados por ocorrência validada.'],
          ].map(([p, frase, prova], i) => (
            <Revela key={p} atraso={i * 90}>
              <div className="group grid gap-3 border-t border-black/10 py-9 lg:grid-cols-[220px_1fr_340px] lg:items-baseline lg:gap-10">
                <span className="text-[11px] uppercase tracking-[0.18em] text-black/45" style={{ fontFamily: MONO }}>0{i + 1} · {p}</span>
                <p className="font-semibold leading-[1.1] tracking-[-0.02em] transition-colors group-hover:text-[color:var(--v)]" style={{ fontSize: 'clamp(24px, 3vw, 42px)', ['--v' as string]: VERDE }}>{frase}</p>
                <p className="text-[15px] leading-6 text-black/60">{prova}</p>
              </div>
            </Revela>
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
                <li key={a} className="bg-[#F6F8F8] p-4"><b className="font-semibold">{a}</b><span className="block text-[13px] text-black/50">{d}</span></li>
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
      </section>

      {/* 04 · o nome */}
      <Nome />

      {/* 05 · para quem */}
      <section id="para-quem" className="px-5 py-24 sm:px-10 sm:py-32">
        <Marcador n="5" titulo="Para quem" />
        <Revela className="mt-12">
          <h2 className="max-w-[900px] font-light leading-[1.04] tracking-[-0.03em]" style={{ fontSize: 'clamp(32px, 4.6vw, 68px)' }}>
            A mesma história, <span className="font-extrabold">por portas diferentes.</span>
          </h2>
        </Revela>
        <div className="mt-14">
          {[
            ['Diretor de obras', 'Descobre o prejuízo tarde demais, na medição.', 'Você vê perdas e ganhos de cada obra enquanto ainda dá para agir.'],
            ['Gerente de contrato', 'Perde pleitos por falta de registro e de prova.', 'Cada ocorrido tem data, responsável e impacto. A prova já está pronta.'],
            ['Planejamento e controle', 'Cronograma bonito que não conversa com o campo.', 'O que aconteceu na obra alimenta o planejamento, sem retrabalho.'],
            ['Engenheiro e encarregado', 'Mais um sistema para preencher.', 'Registre em segundos. Quem resolve fica com o crédito.'],
            ['Suprimentos, qualidade e SMS', 'Recebem a demanda tarde e sem contexto.', 'A atividade chega com dono, prazo e o porquê.'],
            ['Cliente da obra', 'Não confia no que a contratada reporta.', 'Cada etapa validada mostra quem assinou e quando.'],
          ].map(([q, dor, frase], i) => (
            <Revela key={q} atraso={i * 70}>
              <div className="group grid gap-2 border-t border-black/10 py-7 transition-colors hover:bg-white lg:grid-cols-[260px_1fr_1.3fr] lg:gap-10 lg:px-4">
                <span className="text-[15px] font-semibold">{q}</span>
                <span className="text-[15px] text-black/50">{dor}</span>
                <span className="text-[19px] leading-7 transition-colors group-hover:text-[color:var(--v)] sm:text-[21px]" style={{ ['--v' as string]: VERDE }}>“{frase}”</span>
              </div>
            </Revela>
          ))}
        </div>
      </section>

      {/* 06 · manifesto */}
      <section id="manifesto" className="relative overflow-hidden px-5 py-24 text-white sm:px-10 sm:py-32" style={{ background: FUNDO_ESCURO }}>
        <Marcador n="6" titulo="Manifesto" claro />
        <div className="relative mt-12 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col gap-6 text-[19px] leading-8 text-white/75 sm:text-[22px] sm:leading-9">
            <Revela><p className="font-light text-white" style={{ fontSize: 'clamp(30px, 4vw, 56px)', lineHeight: 1.05 }}>Toda obra é feita de decisões.</p></Revela>
            <Revela atraso={80}><p>A maioria delas acontece longe da mesa. No meio da frente de serviço, no rádio, na conversa rápida entre o encarregado e o engenheiro. São decisões boas, tomadas por quem sabe o que faz.</p></Revela>
            <Revela atraso={80}><p className="text-white">O problema nunca foi decidir. O problema é que a decisão se perde.</p></Revela>
            <Revela atraso={80}><p>Nós acreditamos que o que acontece na obra merece registro. Que cada atividade precisa de um dono. Que nenhuma etapa está validada sem um nome e uma data. Que perda sem registro é perda duas vezes.</p></Revela>
            <Revela atraso={80}><p>Não viemos substituir o engenheiro, o planejador ou o encarregado. Viemos dar a eles o que sempre faltou: <span className="text-white">memória.</span></p></Revela>
          </div>
          <div className="relative min-h-[320px] lg:min-h-0">
            <PedraCubica tema="escuro" escala={0.3} className="absolute inset-0 h-full w-full" />
          </div>
        </div>
        <Revela className="relative mt-20 border-t border-white/15 pt-12">
          <p className="leading-[0.95] tracking-[-0.04em]" style={{ fontSize: 'clamp(44px, 8.4vw, 136px)' }}>
            <span className="font-light">O que foi decidido,</span> <span className="font-extrabold" style={{ color: AGUA }}>fica.</span>
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href={entrar.href} className="inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold" style={{ background: AGUA, color: FUNDO_ESCURO }}>
              {entrar.texto} <ArrowUpRight size={16} />
            </Link>
            <span className="text-[14px] text-white/50">Em piloto numa obra real, desenhado por quem viveu a dor.</span>
          </div>
        </Revela>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 px-5 py-8 text-[12px] text-white/45 sm:px-10" style={{ background: FUNDO_ESCURO, borderTop: '1px solid rgba(255,255,255,.08)' }}>
        <img src="/brand/malhet-escuro.svg" alt="Malhet" className="h-[18px] w-auto opacity-80" />
        <span style={{ fontFamily: MONO }}>GESTÃO DA EXECUÇÃO DE OBRAS</span>
        <Link href="/privacidade" className="underline hover:text-white/80">Política de privacidade</Link>
      </footer>
    </div>
  );
}

/** 04 · o nome: o malhete abre os trabalhos, concede a palavra e bate para selar — e a ocorrência ganha o carimbo. */
function Nome() {
  const [batido, setBatido] = useState<string | null>(null);
  const [golpe, setGolpe] = useState(0);
  const bater = () => {
    const agora = new Date();
    setGolpe((g) => g + 1);
    setTimeout(() => setBatido(`${agora.toLocaleDateString('pt-BR')} · ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`), 260);
  };
  return (
    <section id="nome" className="px-5 py-24 sm:px-10 sm:py-32">
      <Marcador n="4" titulo="O nome" />
      <div className="mt-12 grid gap-16 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <Revela>
            <p className="font-extrabold leading-[0.85] tracking-[-0.05em]" style={{ fontSize: 'clamp(72px, 15vw, 230px)', color: VERDE }}>Malhet</p>
            <p className="mt-6 max-w-[560px] text-[19px] leading-8 text-black/75">
              Vem de <i>malhete</i>, o pequeno martelo de madeira da tradição dos construtores. Com ele, quem conduzia o trabalho
              abria a sessão, dava a palavra a cada um e, ao final, batia para confirmar o que tinha sido decidido.
            </p>
          </Revela>
          <div className="mt-10">
            {[
              ['Abria os trabalhos', 'Captura cada ocorrido da obra e põe em ordem.'],
              ['Concedia a palavra', 'Entrega a atividade a quem resolve, entre setores e com prazo.'],
              ['Batia para selar', 'Registra quem validou cada etapa, quando e com qual impacto.'],
            ].map(([a, b], i) => (
              <Revela key={a} atraso={i * 100}>
                <div className="grid grid-cols-[48px_1fr] gap-4 border-t border-black/10 py-5 sm:grid-cols-[48px_220px_1fr]">
                  <span className="text-black/35" style={{ fontFamily: MONO }}>0{i + 1}</span>
                  <span className="font-semibold">{a}</span>
                  <span className="col-start-2 text-black/65 sm:col-start-auto">{b}</span>
                </div>
              </Revela>
            ))}
          </div>
          <Revela className="mt-8">
            <p className="max-w-[560px] text-[15px] leading-6 text-black/55">
              Há uma segunda imagem, do ofício de pedreiro: o maço e o cinzel desbastam a pedra bruta até ela virar pedra cúbica,
              pronta para entrar na obra. No Malhet, o ocorrido entra bruto e sai lapidado.
            </p>
          </Revela>
        </div>

        {/* a ocorrência e o golpe */}
        <Revela atraso={150} className="lg:pt-6">
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
                className="group inline-flex h-12 items-center gap-3 rounded-full px-6 text-[15px] font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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
