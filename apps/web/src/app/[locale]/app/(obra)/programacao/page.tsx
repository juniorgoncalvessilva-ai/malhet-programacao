'use client';

import { Download, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Botao, Cabecalho, Campo, Chip, Erro, Indicador, Painel, Pilula, Selecao, Tabela, dataBR, fmt, td, tdNum,
} from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { useAcaoItem, useCriarItem, useEquipes, useFrentes, useGrupos, useItens, useOpers } from '@/hooks/programacao/queries';
import { qs } from '@/lib/api/client';
import { useObra } from '@/lib/obra/ObraProvider';
import type { CriarItemOut, DiaPlano, ItemProgramacao } from '@/lib/api/types';
import { useConfirmar } from '@/components/Obra/Confirmar';

const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const somar = (s: string, n: number) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };
const intervalo = (a: string, b: string) => { const out: string[] = []; for (let d = a; d <= b; d = somar(d, 1)) out.push(d); return out.slice(0, 7); };
const proximaSegunda = () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return iso(d); };
const diaSemana = (d: string) => DIAS[new Date(`${d}T12:00`).getDay()];

const STATUS: Record<ItemProgramacao['status'], { rotulo: string; tom: 'neutro' | 'acento' | 'info' }> = {
  rascunho: { rotulo: 'Rascunho', tom: 'neutro' },
  aprovado: { rotulo: 'Aprovado', tom: 'acento' },
  exportado: { rotulo: 'No Simova', tom: 'info' },
};
const ORIGEM: Record<ItemProgramacao['origem'], string> = { cronograma: 'Cronograma', pq: 'Só PQ', padrao: 'OPER padrão' };

export default function ProgramacaoPage() {
  const confirmar = useConfirmar();
  const { pode } = useObra();
  const [inicio, setInicio] = useState(proximaSegunda());
  const fim = somar(inicio, 6);
  const dias = useMemo(() => intervalo(inicio, fim), [inicio, fim]);
  const itens = useItens(inicio, fim);
  const equipes = useEquipes();
  const frentes = useFrentes();
  const grupos = useGrupos();
  const [grupo, setGrupo] = useState('');
  const opers = useOpers(grupo || undefined);
  const criar = useCriarItem();
  const acao = useAcaoItem();
  const api = useApi();

  const [equipeId, setEquipeId] = useState('');
  const [oper, setOper] = useState('');
  const [frente, setFrente] = useState('');
  const [obs, setObs] = useState('');
  const [excesso, setExcesso] = useState(false);
  const [pe, setPe] = useState<Record<string, string>>({});
  const [hh, setHh] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState<CriarItemOut | null>(null);
  const [filtro, setFiltro] = useState<'todos' | ItemProgramacao['status']>('todos');

  const lista = itens.data ?? [];
  const visiveis = filtro === 'todos' ? lista : lista.filter((i) => i.status === filtro);
  const conta = (s: ItemProgramacao['status']) => lista.filter((i) => i.status === s).length;
  const hhTotal = lista.reduce((a, i) => a + i.dias.reduce((b, d) => b + (d.hh ?? 0), 0), 0);

  // A equipe dá conta? pior dia de cada encarregado: Σ HH do dia ÷ HH disponível da equipe
  const ocupacao = useMemo(() => {
    const porEnc = new Map<string, { nome: string; dias: Map<string, number> }>();
    for (const i of lista) {
      const e = porEnc.get(i.encarregado_cracha) ?? { nome: i.encarregado_nome, dias: new Map() };
      i.dias.forEach((d) => e.dias.set(d.data, (e.dias.get(d.data) ?? 0) + (d.hh ?? 0)));
      porEnc.set(i.encarregado_cracha, e);
    }
    return [...porEnc.entries()].map(([cracha, e]) => {
      const disp = equipes.data?.filter((q) => q.encarregado_cracha === cracha).reduce((a, q) => a + q.hh_disponivel_dia, 0) ?? 0;
      const pico = Math.max(0, ...e.dias.values());
      return { cracha, nome: e.nome, pct: disp ? pico / disp : null, pico, disp };
    }).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  }, [lista, equipes.data]);
  const acima = ocupacao.filter((o) => (o.pct ?? 0) > 1);

  const equipe = equipes.data?.find((e) => String(e.id) === equipeId);
  const gruposUnicos = useMemo(() => {
    const m = new Map<string, string>();
    grupos.data?.forEach((g) => !m.has(g.codigo) && m.set(g.codigo, g.descricao));
    return [...m.entries()];
  }, [grupos.data]);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipe?.encarregado_cracha) return toast.error('A equipe precisa do crachá do encarregado (tela Equipes).');
    const ds: DiaPlano[] = dias
      .map((d) => ({ data: d, pe: pe[d] ? Number(pe[d]) : null, hh: hh[d] ? Number(hh[d]) : null }))
      .filter((d) => d.pe || d.hh);
    const usados = ds.map((d) => d.data);
    criar.mutate(
      {
        encarregado_cracha: equipe.encarregado_cracha, encarregado_nome: equipe.encarregado_nome ?? equipe.nome,
        grupo_codigo: grupo, oper_codigo: oper, frente_codigo: frente, observacao: obs || null,
        data_inicio: usados[0] ?? inicio, data_fim: usados[usados.length - 1] ?? inicio, dias: ds, permitir_excesso: excesso,
      },
      {
        onSuccess: (r) => { setResultado(r); setPe({}); setHh({}); toast.success('Atividade programada'); },
        onError: (er) => toast.error(er.message),
      },
    );
  };

  const exportar = async () => {
    try {
      const n = await api.download(`/simova/exportar/ft${qs({ inicio, fim })}`, 'FT_IMPORT_INTERMEDIARIA.xlsx');
      toast.success(`${n} item(ns) aprovado(s) enviados para a FT do Simova`);
      itens.refetch();
    } catch (er) { toast.error((er as Error).message); }
  };

  const titulo = lista.length
    ? `Semana de ${dataBR(inicio).slice(0, 5)}: ${lista.length} atividade${lista.length > 1 ? 's' : ''}` +
      (acima.length ? `; ${acima.length} equipe${acima.length > 1 ? 's' : ''} acima da capacidade` : ', todas dentro da capacidade')
    : `Semana de ${dataBR(inicio).slice(0, 5)}: nada programado ainda`;

  return (
    <>
      <Cabecalho
        eyebrow="Programação semanal · montar"
        titulo={titulo}
        descricao="O encarregado escolhe a atividade (do cronograma vigente ou uma OPER padrão), a frente e a produção por dia. O HH sai do índice da CPU e é checado contra a capacidade da equipe. Aprovado, vai para a FT do Simova."
        acoes={<>
          <Botao variante="secundario" aria-label="Semana anterior" onClick={() => setInicio(somar(inicio, -7))}>‹</Botao>
          <Campo type="date" aria-label="Início da semana" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-[160px]" />
          <Botao variante="secundario" aria-label="Próxima semana" onClick={() => setInicio(somar(inicio, 7))}>›</Botao>
          {pode('admin') && <Botao onClick={exportar}><Download size={16} /> Enviar FT ao Simova</Botao>}
        </>}
      >
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <Indicador rotulo="Atividades" valor={lista.length} detalhe={`${dataBR(inicio).slice(0, 5)} a ${dataBR(fim).slice(0, 5)}`} />
          <Indicador rotulo="HH programado" valor={fmt(hhTotal, 0)} detalhe="soma dos dias" />
          <Indicador rotulo="Aprovadas" valor={conta('aprovado')} detalhe={`${conta('rascunho')} em rascunho`} tom="sucesso" />
          <Indicador rotulo="Acima da capacidade" valor={acima.length} detalhe={acima[0] ? `${acima[0].nome.split(' ')[0]} em ${fmt((acima[0].pct ?? 0) * 100, 0)}%` : 'nenhuma equipe'} tom={acima.length ? 'perigo' : undefined} />
        </div>
      </Cabecalho>

      <div className="grid gap-4 2xl:grid-cols-[1fr_340px]">
        <Painel
          titulo="O que a obra faz nesta semana?"
          subtitulo="PE por dia (unidade do grupo) e HH abaixo. Rascunho → aprovado → no Simova."
          acoes={<div className="flex flex-wrap gap-2">
            {(['todos', 'rascunho', 'aprovado', 'exportado'] as const).map((s) => (
              <Chip key={s} ativo={filtro === s} onClick={() => setFiltro(s)}>
                {s === 'todos' ? `Todas · ${lista.length}` : `${STATUS[s].rotulo} · ${conta(s)}`}
              </Chip>
            ))}
          </div>}
        >
          <Tabela
            cabecalho={['Encarregado', 'Atividade (grupo/OPER)', 'Frente', ...dias.map((d) => `${diaSemana(d)} ${d.slice(8)}`), 'Situação', '']}
            direita={dias.map((_, i) => i + 3)}
            vazio={!visiveis.length && (itens.isLoading ? 'Carregando…' : 'Nenhuma atividade nesta semana.')}
          >
            {visiveis.map((i) => (
              <tr key={i.id}>
                <td className={td}><b className="font-semibold text-m-text-primary">{i.encarregado_nome.split(' ').slice(0, 2).join(' ')}</b><div className="text-xs text-m-text-muted">{i.encarregado_cracha}</div></td>
                <td className={`${td} min-w-[240px]`}>
                  <b className="whitespace-nowrap font-semibold text-m-text-primary">{i.grupo_codigo}/{i.oper_codigo}</b> {i.oper_descricao}
                  <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-m-text-muted">
                    <span>{ORIGEM[i.origem]}</span>
                    {i.id_crono && <span>· {i.id_crono}</span>}
                    {i.item_pq && <span>· PQ {i.item_pq}</span>}
                  </div>
                </td>
                <td className={td}>{i.frente_codigo}</td>
                {dias.map((d) => {
                  const x = i.dias.find((y) => y.data === d);
                  return (
                    <td key={d} className={tdNum}>
                      {x ? <><span className="font-medium text-m-text-primary">{fmt(x.pe)}</span><div className="text-xs text-m-text-muted">{fmt(x.hh, 1)} HH</div></> : <span className="text-m-stroke-strong">·</span>}
                    </td>
                  );
                })}
                <td className={td}><Pilula tom={STATUS[i.status].tom}>{STATUS[i.status].rotulo}</Pilula></td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  {i.status === 'rascunho' && pode('planejador') && <Botao variante="fantasma" className="h-8 px-3" onClick={() => acao.mutate({ id: i.id, acao: 'aprovar' })}>Aprovar</Botao>}
                  {i.status !== 'exportado' && pode('encarregado') && <Botao variante="fantasma" className="h-8 px-3 text-m-danger hover:bg-m-danger-subtle" onClick={async () => (await confirmar({ titulo: 'Excluir este item da programação?' })) && acao.mutate({ id: i.id, acao: 'excluir' })}>Excluir</Botao>}
                </td>
              </tr>
            ))}
          </Tabela>
          <Erro erro={acao.error} />
        </Painel>

        <Painel titulo="A equipe dá conta?" subtitulo="Pior dia da semana: HH programado ÷ HH disponível da equipe do encarregado.">
          {!ocupacao.length && <p className="text-[13px] text-m-text-muted">Programe uma atividade para ver a ocupação.</p>}
          <div className="flex flex-col gap-3.5">
            {ocupacao.map((o) => {
              const p = o.pct ?? 0;
              const cor = o.pct === null ? 'var(--m-stroke-strong)' : p > 1 ? 'var(--m-danger)' : p > 0.9 ? 'var(--m-warning)' : 'var(--m-accent)';
              return (
                <div key={o.cracha} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="truncate font-medium">{o.nome.split(' ').slice(0, 2).join(' ')}</span>
                    <span className="font-semibold" style={{ color: cor }}>{o.pct === null ? 'sem equipe' : `${fmt(p * 100, 0)}%`}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-m-surface-field" role="img" aria-label={`${o.nome}: ${fmt(p * 100, 0)}%`}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, p * 100)}%`, background: cor }} />
                  </div>
                  <span className="text-xs text-m-text-muted">{fmt(o.pico, 1)} de {fmt(o.disp, 0)} HH no dia mais cheio</span>
                </div>
              );
            })}
          </div>
        </Painel>
      </div>

      {pode('encarregado') && <Painel titulo="Programar atividade" subtitulo="Escolha a equipe, a OPER e a frente. Deixe o HH vazio para calcular pelo índice da CPU vigente.">
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Selecao rotulo="Equipe / encarregado" value={equipeId} onChange={(e) => setEquipeId(e.target.value)} required>
              <option value="">Escolha…</option>
              {equipes.data?.map((e) => <option key={e.id} value={e.id}>{e.nome} · {e.encarregado_nome ?? 'sem encarregado'} · {fmt(e.hh_disponivel_dia)} HH/dia</option>)}
            </Selecao>
            <Selecao rotulo="Grupo (Simova)" value={grupo} onChange={(e) => { setGrupo(e.target.value); setOper(''); }} required>
              <option value="">Escolha…</option>
              {gruposUnicos.map(([c, d]) => <option key={c} value={c}>{c} · {d}</option>)}
            </Selecao>
            <Selecao rotulo="OPER (atividade padrão)" value={oper} onChange={(e) => setOper(e.target.value)} required>
              <option value="">{grupo ? 'Escolha…' : 'Escolha o grupo antes'}</option>
              {opers.data?.map((o) => <option key={o.id} value={o.codigo}>{o.codigo} · {o.descricao}</option>)}
            </Selecao>
            <Selecao rotulo="Frente" value={frente} onChange={(e) => setFrente(e.target.value)} required>
              <option value="">Escolha…</option>
              {frentes.data?.map((f) => <option key={f.codigo} value={f.codigo}>{f.codigo} · {f.descricao}</option>)}
            </Selecao>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
            {dias.map((d) => (
              <fieldset key={d} className="flex flex-col gap-2 rounded-m-lg border border-m-stroke-subtle p-3">
                <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.48px] text-m-text-muted">{diaSemana(d)} {d.slice(8)}/{d.slice(5, 7)}</legend>
                <Campo rotulo="PE" type="number" min="0" step="any" value={pe[d] ?? ''} onChange={(e) => setPe({ ...pe, [d]: e.target.value })} />
                <Campo rotulo="HH" placeholder="auto" type="number" min="0" step="any" value={hh[d] ?? ''} onChange={(e) => setHh({ ...hh, [d]: e.target.value })} />
              </fieldset>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <Campo rotulo="Observação" value={obs} onChange={(e) => setObs(e.target.value)} className="min-w-[260px] flex-1" />
            <label className="flex h-10 items-center gap-2 text-[13px] text-m-text-secondary">
              <input type="checkbox" checked={excesso} onChange={(e) => setExcesso(e.target.checked)} className="h-4 w-4 accent-[var(--m-accent-strong)]" />
              Permitir acima da capacidade
            </label>
            <Botao type="submit" disabled={criar.isPending}><Plus size={16} /> Programar</Botao>
          </div>
          <Erro erro={criar.error} />
        </form>

        {resultado && (
          <div className="flex flex-col gap-2 rounded-m-lg bg-m-surface-base p-4 text-[13px]">
            <div className="font-semibold">
              Equipe com {fmt(resultado.hh_disponivel_dia)} HH/dia · índice {fmt(resultado.item.indice_hh_por_unidade, 4)} HH/un
              {resultado.item.id_crono && <span className="font-normal text-m-text-muted"> · {resultado.item.id_crono} · PQ {resultado.item.item_pq}</span>}
            </div>
            {resultado.avisos.map((a) => <div key={a} className="text-m-warning">{a}</div>)}
            <div className="flex flex-wrap gap-2">
              {resultado.ocupacao.map((o) => (
                <Pilula key={o.data} tom={o.excedido ? 'perigo' : 'sucesso'}>{dataBR(o.data).slice(0, 5)} · {fmt(o.hh_programado)}/{fmt(o.hh_disponivel)} HH</Pilula>
              ))}
            </div>
          </div>
        )}
      </Painel>}
    </>
  );
}
