'use client';

import { AlertTriangle, CheckCircle2, CloudOff, Timer, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { carimbarFoto, TirarFotos } from '@/components/Mobile/Fotos';
import { CampoM, TopoM, botaoPrimarioM, botaoSecundarioM, cartaoM } from '@/components/Mobile/ui';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Assinar, IdentificarPessoa } from '@/components/Preventivos/Assinar';
import { useApi } from '@/hooks/programacao/useApi';
import { useRouter } from '@/i18n/navigation';
import { useObra } from '@/lib/obra/ObraProvider';
import { idLocal } from '@/lib/offline/db';
import { enfileirar, fotoParaFila, processarFila, useFila } from '@/lib/offline/fila';
import { avisar } from '@/lib/presenca/leitores';
import { hojeLocal, type PessoaBase } from '@/lib/presenca/offline';
import { useBasePessoas } from '@/lib/presenca/useBase';
import {
  type Aparelho, type Assinatura, type SessaoEtilometro, type TesteLocal, aguardandoContraprova, classificar, lerSessao, mgL, pedeContraprova,
  salvarSessao, useAparelhos, useConfigEtilometro,
} from '@/lib/preventivos';

const hora = (d: string | Date) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dBR = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

type Etapa =
  | { e: 'fila' }
  | { e: 'valor'; pessoa: PessoaBase; tentativa: 1 | 2; leitura: string }
  | { e: 'resultado'; pessoa: PessoaBase; tentativa: 1 | 2; leitura: string; valor: number | null; recusa: boolean }
  | { e: 'encerrar' };

/**
 * Etilômetro no campo (spec 073), pensado para dar vazão: lê o crachá → digita o resultado → o colaborador vê e assina →
 * próximo. Quem reprova entra na fila da contraprova com cronômetro, e o aparelho segue livre para os outros.
 * Tudo fica no aparelho e sobe pela fila quando houver internet.
 */
export default function EtilometroPage() {
  const { obra } = useObra();
  const obraId = obra?.id ?? 0;
  const api = useApi();
  const pb = useBasePessoas();
  const [sessao, setSessao] = useState<SessaoEtilometro | null | undefined>(undefined);
  const [etapa, setEtapa] = useState<Etapa>({ e: 'fila' });
  const fila = useFila(obraId, 'etilometro').filter((x) => x.estado !== 'enviado');
  const post = api.post as <T>(p: string, b: unknown) => Promise<T>;

  useEffect(() => { if (obraId) lerSessao(obraId).then((s) => setSessao(s)).catch(() => setSessao(null)); }, [obraId]);
  const gravar = useCallback(async (s: SessaoEtilometro | null) => { setSessao(s); await salvarSessao(obraId, s); }, [obraId]);
  const subir = useCallback(() => { if (navigator.onLine !== false) processarFila(post, obraId).catch(() => undefined); }, [post, obraId]);

  const limite = pb.base?.distancia_max ?? 0.5;
  const pessoas = pb.base?.pessoas ?? [];

  if (sessao === undefined) return <p className="text-sm text-m-text-muted">Carregando…</p>;
  const selo = (
    <span className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold ${fila.length ? 'bg-m-warning-subtle text-m-warning' : 'bg-m-success-subtle text-m-success'}`}>
      {fila.length ? <><CloudOff size={14} />{fila.length} na fila</> : 'em dia'}
    </span>
  );
  if (!pb.base) return (
    <>
      <TopoM titulo="Etilômetro" voltar="/m/preventivos" />
      <p className={`${cartaoM} text-[14px] text-m-text-secondary`}>{pb.erro ? `Não consegui baixar o efetivo: ${pb.erro}. Abra esta tela uma vez com internet.` : 'Baixando o efetivo para ler crachás sem internet…'}</p>
    </>
  );

  if (!sessao) return <Inicio obraId={obraId} pessoas={pessoas} limite={limite} busca={pb} selo={selo}
    onIniciar={async (s, item) => { await enfileirar(item); await gravar(s); subir(); toast.success('Evento iniciado — pode chamar o primeiro'); }} />;

  const registrar = async (et: Extract<Etapa, { e: 'resultado' }>, ass: Assinatura | null) => {
    const cls = classificar(sessao.config, et.valor, et.recusa);
    const t: TesteLocal = {
      id_local: idLocal(), colaborador_id: et.pessoa.id, nome: et.pessoa.nome, matricula: et.pessoa.matricula, funcao: et.pessoa.funcao,
      tentativa: et.tentativa, valor: cls.valor, recusa: et.recusa, resultado: cls.resultado, faixa: cls.faixa, penalidade: cls.penalidade,
      hora: new Date().toISOString(), leitura: et.leitura, assinatura: ass?.meio ?? null,
    };
    await enfileirar({
      id_local: t.id_local, obra_id: obraId, tipo: 'etilometro', rotulo: `${t.tentativa === 2 ? 'Contraprova' : 'Teste'} · ${t.nome}`, criado_em: t.hora,
      dados: { acao: 'teste', id_local: t.id_local, evento_id_local: sessao.id_local, colaborador_id: t.colaborador_id, tentativa: t.tentativa,
        valor: t.valor, recusa: t.recusa, hora: t.hora, leitura: t.leitura, assinatura: ass }, fotos: [], estado: 'pendente', tentativas: 0,
    });
    await gravar({ ...sessao, testes: [...sessao.testes, t] });
    subir();
    setEtapa({ e: 'fila' });
    toast.success(pedeContraprova(t.tentativa, t.resultado, t.recusa) ? `${t.nome.split(' ')[0]}: contraprova às ${hora(new Date(Date.now() + sessao.config.contraprova_minutos * 60000))}` : `${t.nome.split(' ')[0]}: registrado`);
  };

  // quem chega: 1º teste, contraprova liberada, ou avisa se ainda não deu o tempo / já testou
  const chegou = (p: PessoaBase, leitura: string) => {
    const meus = sessao.testes.filter((t) => t.colaborador_id === p.id);
    if (!meus.length) { setEtapa({ e: 'valor', pessoa: p, tentativa: 1, leitura }); return; }
    const espera = aguardandoContraprova(sessao).find((x) => x.teste.colaborador_id === p.id);
    if (espera) {
      if (espera.libera.getTime() > Date.now()) { avisar('repetido'); toast.warning(`${p.nome.split(' ')[0]}: contraprova liberada às ${hora(espera.libera)} (faltam ${mmss(espera.libera.getTime() - Date.now())})`); return; }
      setEtapa({ e: 'valor', pessoa: p, tentativa: 2, leitura }); return;
    }
    avisar('repetido'); toast.info(`${p.nome} já fez o teste neste evento (${meus.at(-1)!.faixa})`);
  };

  if (etapa.e === 'valor') return <Valor et={etapa} onVoltar={() => setEtapa({ e: 'fila' })} onAvancar={(valor, recusa) => setEtapa({ ...etapa, e: 'resultado', valor, recusa })} />;
  if (etapa.e === 'resultado') return <Resultado sessao={sessao} et={etapa} limite={limite} busca={pb} onVoltar={() => setEtapa({ ...etapa, e: 'valor' })} onAssinar={(a) => registrar(etapa, a)} />;
  if (etapa.e === 'encerrar') return <Encerrar sessao={sessao} pessoas={pessoas} limite={limite} busca={pb} onVoltar={() => setEtapa({ e: 'fila' })}
    onEncerrar={async (a, obs) => {
      const agora = new Date().toISOString();
      await enfileirar({ id_local: idLocal(), obra_id: obraId, tipo: 'etilometro', rotulo: 'Encerramento do evento', criado_em: agora,
        dados: { acao: 'encerrar', id_local_evento: sessao.id_local, assinatura: a, encerrado_em: agora, observacao: obs || null }, fotos: [], estado: 'pendente', tentativas: 0 });
      await gravar(null); subir(); setEtapa({ e: 'fila' });
      toast.success('Evento encerrado. O histórico sobe sozinho para o sistema.');
    }} />;

  return <Fila sessao={sessao} pessoas={pessoas} limite={limite} busca={pb} selo={selo} onPessoa={chegou} onEncerrar={() => setEtapa({ e: 'encerrar' })} />;
}

// ---------------------------------------------------------------------------------------------------------------------
function Inicio({ obraId, pessoas, limite, busca, selo, onIniciar }: {
  obraId: number; pessoas: PessoaBase[]; limite: number; busca: ReturnType<typeof useBasePessoas>; selo: React.ReactNode;
  onIniciar: (s: SessaoEtilometro, item: Parameters<typeof enfileirar>[0]) => Promise<void>;
}) {
  const { obra } = useObra();
  const aparelhos = useAparelhos();
  const config = useConfigEtilometro();
  const hoje = hojeLocal();
  const ativos = (aparelhos.data ?? []).filter((a) => a.ativo);
  const [apId, setApId] = useState<number | null>(null);
  const ap: Aparelho | undefined = ativos.find((a) => a.id === apId) ?? (ativos.length === 1 ? ativos[0] : undefined);
  const vencido = !!ap && (!ap.validade || ap.validade < hoje);
  const [local, setLocal] = useState('');
  const [fotosAp, setFotosAp] = useState<Blob[]>([]);
  const [fotosCal, setFotosCal] = useState<Blob[]>([]);
  const [resp, setResp] = useState<PessoaBase | null>(null);
  const [busca2, setBusca2] = useState('');
  const [assinando, setAssinando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const t = busca2.trim().toLowerCase();
  const achados = t.length < 2 ? [] : pessoas.filter((p) => p.nome.toLowerCase().includes(t) || (p.matricula ?? '').includes(t)).slice(0, 20);
  const falta = !ap ? 'Escolha o aparelho' : vencido ? 'Calibração vencida' : !fotosAp.length ? 'Foto do aparelho' : !fotosCal.length ? 'Foto da calibração' : !resp ? 'Escolha o responsável' : !config.data ? 'Configuração não baixada' : null;

  const iniciar = async (a: Assinatura) => {
    if (!ap || !resp || !config.data) return;
    setSalvando(true);
    try {
      const id = idLocal(); const agora = new Date().toISOString();
      const linhas = [`${ap.marca} ${ap.modelo}${ap.numero_serie ? ` · nº ${ap.numero_serie}` : ''}`, `Calibração ${dBR(ap.calibracao_em)} · validade ${dBR(ap.validade)}`, obra?.nome ?? ''];
      const fotos = [
        ...(await Promise.all(fotosAp.map(async (b) => fotoParaFila(await carimbarFoto(b, ['ETILÔMETRO · aparelho', ...linhas]), 'aparelho')))),
        ...(await Promise.all(fotosCal.map(async (b) => fotoParaFila(await carimbarFoto(b, ['ETILÔMETRO · calibração', ...linhas]), 'calibracao')))),
      ];
      const s: SessaoEtilometro = { id_local: id, obra_id: obraId, data: hoje, local: local.trim() || null, aparelho: ap,
        responsavel: { id: resp.id, nome: resp.nome, matricula: resp.matricula }, iniciado_em: agora, config: config.data, testes: [] };
      await onIniciar(s, { id_local: id, obra_id: obraId, tipo: 'etilometro', rotulo: `Início · ${ap.marca} ${ap.modelo}`, criado_em: agora,
        dados: { acao: 'abrir', id_local: id, data: hoje, aparelho_id: ap.id, responsavel_id: resp.id, assinatura: a, iniciado_em: agora, local: s.local },
        fotos, estado: 'pendente', tentativas: 0 });
    } catch (e) { toast.error((e as Error).message); } finally { setSalvando(false); }
  };

  return (
    <>
      <TopoM titulo="Iniciar etilômetro" sub="aparelho, fotos e responsável" voltar="/m/preventivos" acao={selo} />
      <section className={cartaoM}>
        <span className="text-[13px] font-medium text-m-text-secondary">Aparelho</span>
        {!ativos.length && <p className="text-[14px] text-m-text-muted">{aparelhos.isLoading ? 'Carregando…' : 'Nenhum aparelho cadastrado. A segurança cadastra em Controle preventivo › Configuração (web).'}</p>}
        {ativos.map((a) => {
          const v = !a.validade || a.validade < hoje;
          return (
            <button key={a.id} type="button" onClick={() => setApId(a.id)} aria-pressed={ap?.id === a.id}
              className={`flex flex-col rounded-[14px] border-2 px-3.5 py-2.5 text-left ${ap?.id === a.id ? 'border-m-accent-strong' : 'border-m-stroke-subtle'}`}>
              <span className="text-[15px] font-semibold">{a.marca} {a.modelo}{a.numero_serie ? <span className="font-normal text-m-text-muted"> · nº {a.numero_serie}</span> : null}</span>
              <span className={`text-[12.5px] ${v ? 'font-semibold text-m-danger' : 'text-m-text-muted'}`}>Calibração {dBR(a.calibracao_em)} · validade {dBR(a.validade)}{v ? ' — VENCIDA, não pode usar' : ''}</span>
            </button>
          );
        })}
        <CampoM rotulo="Local (opcional)" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: Portaria 1, canteiro central" />
      </section>
      {ap && !vencido && (
        <section className={cartaoM}>
          <TirarFotos fotos={fotosAp} onChange={setFotosAp} rotulo="Foto do aparelho" dica="Obrigatória · sai com data, hora e o aparelho" carimbo={[`${ap.marca} ${ap.modelo}`, obra?.nome ?? '']} />
          <TirarFotos fotos={fotosCal} onChange={setFotosCal} rotulo="Foto da data de calibração" dica="Etiqueta ou certificado de calibração" carimbo={[`Calibração ${dBR(ap.calibracao_em)}`, obra?.nome ?? '']} />
        </section>
      )}
      <section className={cartaoM}>
        <span className="text-[13px] font-medium text-m-text-secondary">Responsável pelo teste</span>
        {resp ? (
          <div className="flex items-center justify-between gap-2 rounded-[14px] border border-m-accent-strong px-3.5 py-2.5">
            <span className="min-w-0"><b className="block truncate">{resp.nome}</b><span className="text-[12px] text-m-text-muted">{[resp.matricula, resp.funcao].filter(Boolean).join(' · ')}</span></span>
            <button type="button" className="text-[13px] font-semibold text-m-accent underline" onClick={() => { setResp(null); setAssinando(false); }}>trocar</button>
          </div>
        ) : (
          <>
            <input aria-label="Buscar responsável" value={busca2} onChange={(e) => setBusca2(e.target.value)} placeholder="Nome ou matrícula (enfermeira, técnico…)"
              className="h-12 rounded-[14px] border border-m-stroke bg-m-surface-field px-3.5 text-[15px]" />
            {achados.map((p) => (
              <button key={p.id} type="button" onClick={() => { setResp(p); setBusca2(''); }} className="flex min-h-[48px] flex-col justify-center border-b border-m-stroke-subtle text-left last:border-0">
                <span className="text-[15px]">{p.nome}</span><span className="text-[12px] text-m-text-muted">{[p.matricula, p.funcao].filter(Boolean).join(' · ')}</span>
              </button>
            ))}
          </>
        )}
      </section>
      {assinando && resp && !falta ? (
        <section className={cartaoM}>
          <span className="text-[15px] font-semibold">{resp.nome.split(' ')[0]}, passe o seu crachá para iniciar</span>
          <Assinar pessoa={resp} limite={limite} busca={busca} meios={['nfc', 'codigo']} onAssinar={iniciar} />
          {salvando && <span className="text-[13px] text-m-text-muted">Guardando…</span>}
        </section>
      ) : (
        <button type="button" disabled={!!falta} onClick={() => setAssinando(true)} className="mb-4 h-[52px] rounded-full bg-m-accent-strong text-[15px] font-semibold text-m-on-accent disabled:opacity-50">
          {falta ?? 'Assinar com o crachá e iniciar'}
        </button>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
function Fila({ sessao, pessoas, limite, busca, selo, onPessoa, onEncerrar }: {
  sessao: SessaoEtilometro; pessoas: PessoaBase[]; limite: number; busca: ReturnType<typeof useBasePessoas>; selo: React.ReactNode;
  onPessoa: (p: PessoaBase, leitura: string) => void; onEncerrar: () => void;
}) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t); }, []);
  const espera = aguardandoContraprova(sessao);
  // quando o tempo de alguém acaba: vibra/apita uma vez
  const [avisados, setAvisados] = useState<Set<string>>(new Set());
  useEffect(() => {
    const prontos = espera.filter((x) => x.libera.getTime() <= agora && !avisados.has(x.teste.id_local));
    if (prontos.length) { avisar('ok'); setAvisados((s) => new Set([...s, ...prontos.map((x) => x.teste.id_local)])); }
  }, [agora]); // eslint-disable-line react-hooks/exhaustive-deps
  const por = useMemo(() => { const m = new Map<number, TesteLocal>(); for (const t of sessao.testes) m.set(t.colaborador_id, t); return [...m.values()]; }, [sessao.testes]);
  const aprov = por.filter((t) => t.resultado === 'aprovado').length;
  const reprov = por.filter((t) => t.resultado === 'reprovado' && !pedeContraprova(t.tentativa, t.resultado, t.recusa)).length;
  const byId = new Map(pessoas.map((p) => [p.id, p]));

  return (
    <>
      <TopoM titulo="Etilômetro" sub={`${sessao.aparelho.marca} ${sessao.aparelho.modelo} · resp. ${sessao.responsavel.nome.split(' ')[0]}`} acao={selo} />
      <div className="grid grid-cols-3 gap-2 text-center">
        <span className="rounded-[14px] bg-m-surface-raised py-2"><b className="block text-[22px] tabular-nums">{por.length}</b><span className="text-[11.5px] text-m-text-muted">testados</span></span>
        <span className="rounded-[14px] bg-m-success-subtle py-2 text-m-success"><b className="block text-[22px] tabular-nums">{aprov}</b><span className="text-[11.5px]">aprovados</span></span>
        <span className="rounded-[14px] bg-m-danger-subtle py-2 text-m-danger"><b className="block text-[22px] tabular-nums">{reprov}</b><span className="text-[11.5px]">reprovados</span></span>
      </div>
      {espera.length > 0 && (
        <section aria-label="Aguardando contraprova" className="flex flex-col gap-1.5 rounded-[16px] border border-m-warning/50 bg-m-warning-subtle p-3">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-m-warning"><Timer size={16} /> Contraprova ({sessao.config.contraprova_minutos} min)</span>
          {espera.map(({ teste, libera }) => {
            const falta = libera.getTime() - agora;
            const p = byId.get(teste.colaborador_id);
            return (
              <div key={teste.id_local} className="flex items-center justify-between gap-2 rounded-[12px] bg-m-surface-raised px-3 py-2">
                <span className="min-w-0"><b className="block truncate text-[14px]">{teste.nome}</b><span className="text-[12px] text-m-text-muted">1º teste {mgL(teste.valor)} · {hora(teste.hora)}</span></span>
                {falta > 0 ? <span className="shrink-0 text-[20px] font-semibold tabular-nums text-m-warning">{mmss(falta)}</span>
                  : <button type="button" disabled={!p} onClick={() => p && onPessoa(p, 'manual')} className="h-11 shrink-0 animate-pulse rounded-full bg-m-accent-strong px-4 text-[14px] font-semibold text-m-on-accent">Fazer contraprova</button>}
              </div>
            );
          })}
        </section>
      )}
      <IdentificarPessoa pessoas={pessoas} limite={limite} busca={busca} onPessoa={onPessoa} />
      {sessao.testes.length > 0 && (
        <section className={cartaoM}>
          <span className="text-[13px] font-medium text-m-text-secondary">Últimos testes</span>
          <ul className="flex flex-col">
            {[...sessao.testes].reverse().slice(0, 12).map((t) => (
              <li key={t.id_local} className="flex min-h-[44px] items-center justify-between gap-2 border-b border-m-stroke-subtle last:border-0">
                <span className="min-w-0"><span className="block truncate text-[14px]">{t.nome}</span><span className="text-[11.5px] text-m-text-muted">{hora(t.hora)}{t.tentativa === 2 ? ' · contraprova' : ''} · {t.assinatura ? `assinou (${t.assinatura === 'facial' ? 'rosto' : t.assinatura === 'desenho' ? 'tela' : 'crachá'})` : 'sem assinatura'}</span></span>
                <span className={`shrink-0 text-[13px] font-semibold ${t.resultado === 'aprovado' ? 'text-m-success' : 'text-m-danger'}`}>{t.recusa ? 'Recusa' : mgL(t.valor)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <button type="button" onClick={onEncerrar} className="mb-4 h-[52px] rounded-full border-2 border-m-stroke text-[15px] font-semibold">Encerrar o evento</button>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
function Valor({ et, onVoltar, onAvancar }: { et: Extract<Etapa, { e: 'valor' }>; onVoltar: () => void; onAvancar: (v: number | null, recusa: boolean) => void }) {
  const [txt, setTxt] = useState('');
  const confirmar = useConfirmar();
  const v = Number(txt.replace(',', '.'));
  const ok = txt.trim() !== '' && Number.isFinite(v) && v >= 0 && v <= 5;
  return (
    <>
      <TopoM titulo={et.tentativa === 2 ? 'Contraprova' : 'Resultado do teste'} sub={et.pessoa.nome} voltar={undefined} />
      <section className={`${cartaoM} items-center text-center`}>
        <span className="text-[13px] text-m-text-muted">{[et.pessoa.matricula, et.pessoa.funcao].filter(Boolean).join(' · ')}</span>
        <label className="flex w-full flex-col gap-2 text-[14px] font-medium text-m-text-secondary">Valor lido no etilômetro
          <span className="flex items-center justify-center gap-2">
            <input autoFocus inputMode="decimal" value={txt} onChange={(e) => setTxt(e.target.value.replace(/[^0-9.,]/g, ''))} aria-label="Valor em mg/L" placeholder="0,00"
              className="h-20 w-48 rounded-[16px] border-2 border-m-accent-strong bg-m-surface-field text-center text-[40px] font-semibold tabular-nums outline-none" />
            <span className="text-[20px] font-semibold text-m-text-secondary">mg/L</span>
          </span>
        </label>
        {txt && !ok && <span className="text-[13px] text-m-danger">Valor entre 0 e 5 mg/L</span>}
        <div className="flex flex-wrap justify-center gap-2">
          {['0,00', '0,01', '0,02'].map((x) => <button key={x} type="button" onClick={() => setTxt(x)} className="h-11 rounded-full border border-m-stroke px-4 text-[15px] font-semibold tabular-nums">{x}</button>)}
        </div>
      </section>
      <button type="button" disabled={!ok} onClick={() => onAvancar(v, false)} className="h-[56px] rounded-full bg-m-accent-strong text-[17px] font-semibold text-m-on-accent disabled:opacity-40">Avançar</button>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={onVoltar} className={botaoSecundarioM}>Cancelar</button>
        <button type="button" onClick={async () => { if (await confirmar({ titulo: `${et.pessoa.nome.split(' ')[0]} recusou o teste?`, mensagem: 'A recusa tem as penalidades configuradas para a obra e fica registrada no histórico.', acao: 'Registrar recusa' })) onAvancar(null, true); }}
          className="h-[52px] rounded-full border border-m-danger/50 text-[15px] font-semibold text-m-danger">Recusou o teste</button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
function Resultado({ sessao, et, limite, busca, onVoltar, onAssinar }: {
  sessao: SessaoEtilometro; et: Extract<Etapa, { e: 'resultado' }>; limite: number; busca: ReturnType<typeof useBasePessoas>;
  onVoltar: () => void; onAssinar: (a: Assinatura | null) => void;
}) {
  const cls = classificar(sessao.config, et.valor, et.recusa);
  const aprovado = cls.resultado === 'aprovado';
  const contra = pedeContraprova(et.tentativa, cls.resultado, et.recusa);
  const [salvando, setSalvando] = useState(false);
  const fim = async (a: Assinatura | null) => { if (salvando) return; setSalvando(true); try { await onAssinar(a); } finally { setSalvando(false); } };
  return (
    <>
      <section className={`flex flex-col items-center gap-2 rounded-[22px] p-6 text-center ${aprovado ? 'bg-m-success-subtle text-m-success' : 'bg-m-danger-subtle text-m-danger'}`}>
        {aprovado ? <CheckCircle2 size={56} /> : <XCircle size={56} />}
        <span className="text-[15px] font-semibold text-m-text-primary">{et.pessoa.nome}</span>
        <span className="text-[44px] font-bold leading-none tabular-nums">{et.recusa ? 'Recusa' : mgL(cls.valor)}</span>
        <span className="text-[19px] font-semibold">{cls.faixa}</span>
        {cls.penalidade && <span className="text-[14px] text-m-text-secondary">{cls.penalidade}</span>}
        {et.tentativa === 2 && <span className="text-[13px] font-semibold text-m-text-secondary">Contraprova — este é o resultado que vale</span>}
        {contra && <span className="mt-1 flex items-center gap-1.5 rounded-full bg-m-surface-raised px-3 py-1.5 text-[13px] font-semibold text-m-warning"><AlertTriangle size={15} /> Contraprova em {sessao.config.contraprova_minutos} min</span>}
      </section>
      <section className={cartaoM}>
        <span className="text-[15px] font-semibold">{et.pessoa.nome.split(' ')[0]}, confira e assine</span>
        <Assinar pessoa={et.pessoa} limite={limite} busca={busca} onAssinar={(a) => fim(a)} />
        {et.recusa && <button type="button" disabled={salvando} onClick={() => fim(null)} className="h-12 rounded-full border border-m-stroke text-[14px] font-semibold">Recusou assinar — registrar pelo responsável</button>}
      </section>
      <button type="button" onClick={onVoltar} className={`${botaoSecundarioM} mb-4 flex-none`}>Corrigir o valor</button>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
function Encerrar({ sessao, pessoas, limite, busca, onVoltar, onEncerrar }: {
  sessao: SessaoEtilometro; pessoas: PessoaBase[]; limite: number; busca: ReturnType<typeof useBasePessoas>;
  onVoltar: () => void; onEncerrar: (a: Assinatura, obs: string) => Promise<void>;
}) {
  const resp = pessoas.find((p) => p.id === sessao.responsavel.id);
  const pend = aguardandoContraprova(sessao);
  const [obs, setObs] = useState('');
  return (
    <>
      <TopoM titulo="Encerrar o evento" sub={`${new Set(sessao.testes.map((t) => t.colaborador_id)).size} pessoa(s) testada(s)`} />
      {pend.length > 0 && (
        <p className="rounded-[14px] bg-m-warning-subtle p-3 text-[13.5px] text-m-warning">
          <b>{pend.length} contraprova(s) não feita(s):</b> {pend.map((x) => x.teste.nome.split(' ')[0]).join(', ')}. Ficam registradas como pendentes no histórico.
        </p>
      )}
      <section className={cartaoM}>
        <CampoM rotulo="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ocorrências do evento" />
        <span className="text-[15px] font-semibold">{sessao.responsavel.nome.split(' ')[0]}, passe o seu crachá para encerrar</span>
        {resp ? <Assinar pessoa={resp} limite={limite} busca={busca} meios={['nfc', 'codigo']} onAssinar={(a) => onEncerrar(a, obs)} />
          : <p className="text-[13px] text-m-danger">Responsável não encontrado no efetivo deste aparelho. Atualize o efetivo com internet.</p>}
      </section>
      <button type="button" onClick={onVoltar} className={`${botaoPrimarioM} mb-4 flex-none`}>Voltar aos testes</button>
    </>
  );
}
