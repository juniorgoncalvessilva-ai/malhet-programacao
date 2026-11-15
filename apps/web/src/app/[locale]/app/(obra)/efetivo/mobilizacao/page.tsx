'use client';

import { Plus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Abas } from '@/components/Obra/Abas';
import { BuscaEfetivo } from '@/components/Obra/BuscaEfetivo';
import { Calculado } from '@/components/Obra/Calculado';
import { Carregando } from '@/components/Obra/Esqueleto';
import { Botao, Cabecalho, Campo, Chip, Erro, Indicador, Painel, Selecao, Tabela, fmt, td, tdNum } from '@/components/Obra/ui';
import { FichaColaborador } from '@/components/Efetivo/FichaColaborador';
import { Barra, ETAPAS, LinhaProcesso } from '@/components/Efetivo/Mobilizacao';
import { useEfetivo } from '@/hooks/programacao/planejamento';
import { useEtapasMobilizacao, useMetricasMobilizacao, useProcessos } from '@/hooks/programacao/treinamentos';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';
import type { Colaborador, StatusMobilizacao } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';

const STATUS: { v: StatusMobilizacao; rotulo: string }[] = [
  { v: 'EM_ANDAMENTO', rotulo: 'Em andamento' }, { v: 'AGUARDANDO_CRACHA', rotulo: 'Aguardando crachá' },
  { v: 'MOBILIZADO', rotulo: 'Mobilizados' }, { v: 'DESISTENCIA', rotulo: 'Desistências' },
];

export default function MobilizacaoPage() {
  const { pode } = useObra();
  const planejar = pode('planejador');
  const [aba, setAba] = useState<'processos' | 'metricas' | 'metas'>('processos');
  const [ficha, setFicha] = useState<number | null>(null);
  const processos = useProcessos();
  const ativos = (processos.data ?? []).filter((p) => p.status === 'EM_ANDAMENTO' || p.status === 'AGUARDANDO_CRACHA');
  return (
    <>
      <Cabecalho eyebrow="Efetivo · mobilização" titulo={processos.data ? `${ativos.length} pessoa(s) em mobilização` : 'Mobilização do colaborador'}
        acoes={<Link href="/app/efetivo"><Botao variante="secundario"><Users size={16} /> Efetivo</Botao></Link>} />
      <Abas rotulo="Seções da mobilização" ativa={aba} onTrocar={setAba}
        abas={[{ chave: 'processos', titulo: 'Processos' }, { chave: 'metricas', titulo: 'Métricas do esforço' }, { chave: 'metas', titulo: 'Metas da obra' }]} />
      {aba === 'processos' && <Processos planejar={planejar} onFicha={setFicha} />}
      {aba === 'metricas' && <Metricas />}
      {aba === 'metas' && <Metas planejar={planejar} />}
      {ficha && <FichaColaborador id={ficha} onFechar={() => setFicha(null)} />}
    </>
  );
}

function Processos({ planejar, onFicha }: { planejar: boolean; onFicha: (id: number) => void }) {
  const processos = useProcessos();
  const [fSt, setFSt] = useState<Set<StatusMobilizacao>>(new Set(['EM_ANDAMENTO', 'AGUARDANDO_CRACHA']));
  const [fEtapa, setFEtapa] = useState('');
  const [q, setQ] = useState('');
  const [novo, setNovo] = useState(false);
  const todos = processos.data ?? [];
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    return todos.filter((p) => (!fSt.size || fSt.has(p.status)) && (!fEtapa || p.etapa_atual === fEtapa)
      && (!t || `${p.nome} ${p.funcao ?? ''} ${p.requisicao ?? ''}`.toLowerCase().includes(t)));
  }, [todos, fSt, fEtapa, q]);
  const conta = (s: StatusMobilizacao) => todos.filter((p) => p.status === s).length;
  const porEtapa = ETAPAS.map((e) => ({ ...e, n: todos.filter((p) => (p.status === 'EM_ANDAMENTO' || p.status === 'AGUARDANDO_CRACHA') && p.etapa_atual === e.v).length }));
  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 xl:grid-cols-9" aria-label="Pessoas em cada etapa">
        {porEtapa.map((e) => (
          <button key={e.v} type="button" onClick={() => setFEtapa(fEtapa === e.v ? '' : e.v)}
            className={`rounded-m-md border px-2 py-2 text-left ${fEtapa === e.v ? 'border-m-accent bg-m-accent-subtle' : 'border-m-stroke-subtle bg-m-surface-raised hover:bg-m-surface-hover'}`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.3px] text-m-text-muted">{e.curto}</div>
            <div className="text-[22px] font-semibold tabular-nums text-m-text-primary">{e.n}</div>
          </button>
        ))}
      </div>
      <Painel titulo="Quem está sendo mobilizado e em que etapa?" subtitulo={`${lista.length} de ${todos.length} processo(s)`}
        acoes={planejar && <Botao onClick={() => setNovo(!novo)}><Plus size={16} /> Nova aquisição</Botao>}>
        {novo && <NovoProcesso onFeito={() => setNovo(false)} />}
        <div className="flex flex-wrap items-end gap-2">
          {STATUS.map((s) => (
            <Chip key={s.v} ativo={fSt.has(s.v)} onClick={() => setFSt((x) => { const n = new Set(x); if (n.has(s.v)) n.delete(s.v); else n.add(s.v); return n; })}>{s.rotulo} · {conta(s.v)}</Chip>
          ))}
          <Campo rotulo="Buscar" placeholder="nome, função ou requisição" value={q} onChange={(e) => setQ(e.target.value)} className="w-[260px]" />
        </div>
        {processos.isLoading && <Carregando />}
        {!processos.isLoading && !lista.length && <p className="py-6 text-center text-[13px] text-m-text-muted">{todos.length ? 'Nenhum processo com esses filtros.' : 'Nenhuma aquisição lançada. Use “Nova aquisição”.'}</p>}
        <div className="flex flex-col gap-2">
          {lista.map((p) => <LinhaProcesso key={p.id} p={p} podeEditar={planejar} onAbrirFicha={onFicha} />)}
        </div>
      </Painel>
    </>
  );
}

function NovoProcesso({ onFeito }: { onFeito: () => void }) {
  const api = useApi();
  const efetivo = useEfetivo();
  const [pessoa, setPessoa] = useState<Colaborador | null>(null);
  const [f, setF] = useState({ nome: '', funcao: '', empresa: 'Própria', requisicao: '', necessario_em: '', iniciado_em: '', treinamento_antes: false, observacao: '' });
  const [erro, setErro] = useState<unknown>(null);
  const [salvando, setSalvando] = useState(false);
  const candidatos = (efetivo.data ?? []).filter((c) => ['PREVISTO', 'EM_PROCESSO', 'AGUARDANDO_CRACHA', 'DESMOBILIZADO', 'DESISTENCIA'].includes(c.situacao));
  const salvar = async () => {
    setSalvando(true);
    try {
      const r = await api.post<{ nome: string }>('/mobilizacao/processos', {
        colaborador_id: pessoa?.id ?? null, nome: pessoa ? null : f.nome, funcao: f.funcao || pessoa?.funcao || null, empresa: f.empresa,
        requisicao: f.requisicao || null, necessario_em: f.necessario_em || null, treinamento_antes: f.treinamento_antes,
        observacao: f.observacao || null, iniciado_em: f.iniciado_em ? new Date(f.iniciado_em).toISOString() : null,
      });
      toast.success(`Aquisição de ${r.nome} aberta na Solicitação`);
      onFeito();
    } catch (e) { setErro(e); } finally { setSalvando(false); }
  };
  return (
    <div className="grid gap-3 rounded-m-lg border border-m-accent/40 bg-m-accent-subtle/40 p-4 md:grid-cols-4" aria-label="Nova aquisição">
      <div className="md:col-span-4">
        {pessoa ? <p className="text-[13px]">Pessoa do efetivo: <b>{pessoa.nome}</b> · {pessoa.funcao ?? 'sem função'} · {pessoa.situacao_rotulo}
          <button type="button" className="ml-2 text-[12px] font-semibold text-m-accent underline" onClick={() => setPessoa(null)}>trocar</button></p>
          : <BuscaEfetivo rotulo="Pessoa já no efetivo (prevista, em processo…) — ou preencha o nome abaixo" pessoas={candidatos} onEscolher={setPessoa} placeholder="buscar no efetivo" />}
      </div>
      {!pessoa && <>
        <Campo rotulo="Nome completo" className="md:col-span-2" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
        <Campo rotulo="Empresa" value={f.empresa} onChange={(e) => setF({ ...f, empresa: e.target.value })} />
      </>}
      <Campo rotulo="Função" value={f.funcao} placeholder={pessoa?.funcao ?? ''} onChange={(e) => setF({ ...f, funcao: e.target.value })} />
      <Campo rotulo="Requisição / vaga" value={f.requisicao} onChange={(e) => setF({ ...f, requisicao: e.target.value })} />
      <Campo rotulo="Obra precisa em" type="date" value={f.necessario_em} onChange={(e) => setF({ ...f, necessario_em: e.target.value })} />
      <Campo rotulo="Solicitação feita em (vazio = agora)" type="datetime-local" value={f.iniciado_em} onChange={(e) => setF({ ...f, iniciado_em: e.target.value })} />
      <Campo rotulo="Observação" value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} />
      <label className="flex items-center gap-2 text-[13px] text-m-text-secondary md:col-span-4">
        <input type="checkbox" checked={f.treinamento_antes} onChange={(e) => setF({ ...f, treinamento_antes: e.target.checked })} /> Treinamento antes da contratação
      </label>
      <div className="flex flex-wrap items-center gap-2 md:col-span-4">
        <Botao disabled={salvando || (!pessoa && f.nome.trim().split(/\s+/).length < 2)} onClick={salvar}>{salvando ? 'Abrindo…' : 'Abrir aquisição'}</Botao>
        <Botao variante="secundario" onClick={onFeito}>Cancelar</Botao>
        <span className="text-[12px] text-m-text-muted">Pessoa nova entra no efetivo como “Em processo”; a matrícula chega na Contratação.</span>
        <Erro erro={erro} />
      </div>
    </div>
  );
}

function Metricas() {
  const [f, setF] = useState({ desde: '', ate: '', funcao: '' });
  const m = useMetricasMobilizacao(f);
  if (!m.data) return <Carregando />;
  const d = m.data;
  const card = (k: string, rotulo: string, detalhe?: string) => (
    <Indicador rotulo={rotulo} valor={<Calculado chave={k} memoria={() => d.cards[k]}>{d.cards[k].valor}</Calculado>} detalhe={detalhe} />
  );
  const maxMedia = Math.max(0, ...d.etapas.map((e) => e.media_dias ?? 0));
  const maxAlc = Math.max(0, ...d.etapas.map((e) => e.alcancaram));
  return (
    <>
      <div className="flex flex-wrap items-end gap-2">
        <Campo rotulo="Abertos desde" type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} />
        <Campo rotulo="até" type="date" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} />
        <Selecao rotulo="Função" value={f.funcao} onChange={(e) => setF({ ...f, funcao: e.target.value })} className="w-[220px]">
          <option value="">Todas</option>{d.funcoes_disponiveis.map((x) => <option key={x}>{x}</option>)}
        </Selecao>
        <span className="pb-2.5 text-[12px] text-m-text-muted">{d.processos} processo(s) no filtro</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {card('em_andamento', 'Em andamento')}
        {card('lead_time', 'Lead time médio', 'solicitação → crachá')}
        {card('no_prazo', 'Dentro das metas', 'dos mobilizados')}
        {card('atrasados', 'Fora da meta agora')}
        {card('desistencias', 'Desistências')}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Painel titulo="Onde vai o esforço de cada aquisição?" subtitulo="Média de dias por etapa (passagens concluídas) e a participação no total de dias">
          <div className="flex flex-col gap-2">
            {d.etapas.map((e) => <Barra key={e.etapa} rotulo={e.rotulo} valor={e.media_dias ?? 0} max={maxMedia}
              texto={e.media_dias == null ? '—' : `${fmt(e.media_dias, 1)} d · ${e.participacao}`} memoria={e.memoria} />)}
          </div>
        </Painel>
        <Painel titulo="Funil: quantos chegaram a cada etapa?" subtitulo="Processos que passaram pela etapa (inclui desistências) e quantos estão nela agora">
          <div className="flex flex-col gap-2">
            {d.etapas.map((e) => <Barra key={e.etapa} rotulo={e.rotulo} valor={e.alcancaram} max={maxAlc} tom="var(--m-proc-planejar)"
              texto={`${e.alcancaram}${e.agora ? ` · ${e.agora} agora` : ''}`} />)}
          </div>
        </Painel>
      </div>
      <Painel titulo="As faixas estão dentro da meta da obra?">
        <Tabela cabecalho={['Faixa', 'Meta', 'Média', 'Medidos', 'Acima da meta']} direita={[1, 2, 3, 4]}>
          {d.metas.map((x) => (
            <tr key={x.meta}>
              <td className={td}><b className="text-m-text-primary">{x.rotulo}</b></td>
              <td className={tdNum}>{x.dias_meta != null ? `${fmt(x.dias_meta, 1)} d` : '—'}</td>
              <td className={tdNum}><span className={x.media_dias != null && x.dias_meta != null && x.media_dias > x.dias_meta ? 'font-semibold text-m-warning' : ''}>{x.media_dias != null ? `${fmt(x.media_dias, 1)} d` : '—'}</span></td>
              <td className={tdNum}>{x.medidos}</td>
              <td className={tdNum}>{x.acima}</td>
            </tr>
          ))}
        </Tabela>
      </Painel>
      <Painel titulo="Por função">
        <Tabela cabecalho={['Função', 'Processos', 'Mobilizados', 'Desistências', 'Lead time médio', 'Gargalo mais comum']} direita={[1, 2, 3, 4]}>
          {d.funcoes.map((x) => (
            <tr key={x.funcao}>
              <td className={td}><b className="text-m-text-primary">{x.funcao}</b></td>
              <td className={tdNum}>{x.processos}</td><td className={tdNum}>{x.mobilizados}</td><td className={tdNum}>{x.desistencias}</td>
              <td className={tdNum}>{x.lead_medio != null ? `${fmt(x.lead_medio, 1)} d` : '—'}</td>
              <td className={td}>{x.gargalo ?? '—'}</td>
            </tr>
          ))}
        </Tabela>
      </Painel>
    </>
  );
}

function Metas({ planejar }: { planejar: boolean }) {
  const api = useApi();
  const et = useEtapasMobilizacao();
  const [v, setV] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<unknown>(null);
  if (!et.data) return <Carregando />;
  const rot = Object.fromEntries(et.data.etapas.map((e) => [e.etapa, e.rotulo]));
  const salvar = async () => {
    try {
      await api.put('/mobilizacao/metas', { metas: Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '').map(([k, x]) => [k, Number(x.replace(',', '.'))])) });
      toast.success('Metas salvas'); setV({}); setErro(null);
    } catch (e) { setErro(e); }
  };
  return (
    <Painel titulo="Quantos dias cada faixa pode levar nesta obra?" subtitulo="A faixa conta da entrada na primeira etapa até a saída da última (ex.: Seleção = Solicitação + Seleção)">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {et.data.metas.map((m) => (
          <div key={m.meta} className="flex flex-col gap-1">
            <Campo rotulo={`${m.rotulo} (dias)`} type="number" step="0.5" min={0.5} disabled={!planejar} value={v[m.meta] ?? String(m.dias)}
              onChange={(e) => setV({ ...v, [m.meta]: e.target.value })} />
            <span className="text-[11.5px] text-m-text-muted">{m.etapas.map((e) => rot[e]).join(' + ')}</span>
          </div>
        ))}
      </div>
      {planejar && <div className="flex items-center gap-2"><Botao disabled={!Object.keys(v).length} onClick={salvar}>Salvar metas</Botao><Erro erro={erro} /></div>}
    </Painel>
  );
}
