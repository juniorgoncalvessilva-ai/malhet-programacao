'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { Calculado, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { BarrasH, Cartao, Colunas, Rosca } from '@/components/Obra/GraficosRestricoes';
import { Campo, Indicador, Selecao } from '@/components/Obra/ui';
import type { Colaborador } from '@/lib/api/types';
import {
  COR_SITUACAO, COR_TIPO_MO, ESCOPOS, SERIES_SITUACAO, agrupar, noEscopo, porDp, porEmpresa, porEquipe, porFuncao, porFuncaoCpu,
  porMesAdmissao, porSituacao, porTipoMo, type Escopo,
} from '@/lib/efetivo/resumo';
import { ROTULO_SITUACAO } from '@/lib/efetivo/situacoes';

const COR_EQUIPE: Record<string, string> = { 'Em equipe': '#008282', Encarregado: '#4F46E5', 'Sem equipe': '#FF4747' };
const num = (mem: Record<string, MemoriaCalculo>, chave: string, n: number) =>
  mem[chave] ? <Calculado chave={chave} memoria={() => mem[chave]}>{n}</Calculado> : n;

/** Aba "Resumo por função" do Efetivo e mobilização (spec 051): o efetivo agrupado em números e gráficos. */
export function ResumoEfetivo({ efetivo }: { efetivo: Colaborador[] }) {
  const [escopo, setEscopo] = useState<Escopo>('ativos');
  const [empresa, setEmpresa] = useState('');
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<string | null>(null);
  const empresas = useMemo(() => [...new Set(efetivo.map((c) => c.empresa).filter(Boolean))].sort(), [efetivo]);
  const rotEscopo = ESCOPOS.find((e) => e.v === escopo)!.rotulo.toLowerCase() + (empresa ? ` · ${empresa}` : '');
  const lista = useMemo(() => noEscopo(efetivo, escopo, empresa), [efetivo, escopo, empresa]);
  const g = useMemo(() => {
    const funcoes = agrupar(lista, 'funcao', porFuncao, rotEscopo, 'FUNÇÃO', { porSituacao: true });
    return {
      funcoes,
      situacao: agrupar(lista, 'situacao', porSituacao, rotEscopo, 'STATUS'),
      tipo: agrupar(lista, 'tipo', porTipoMo, rotEscopo, 'TIPO DE MO'),
      dp: agrupar(lista, 'dp', porDp, rotEscopo, 'DP'),
      empresa: agrupar(lista, 'empresa', porEmpresa, rotEscopo, 'EMPRESA'),
      equipe: agrupar(lista, 'equipe', porEquipe, rotEscopo, 'EQUIPE'),
      cpu: agrupar(lista, 'cpu', porFuncaoCpu, rotEscopo, 'FUNÇÃO DA COMPOSIÇÃO (de-para)', { limite: 15 }),
      admissao: agrupar(lista.filter((c) => c.admissao), 'admissao', porMesAdmissao, rotEscopo, 'ADMISSÃO', { ordem: 'rotulo' }),
      total: agrupar(lista, 'total', () => 'Pessoas', rotEscopo, 'STATUS'),
      nFuncoes: agrupar(lista, 'nfuncoes', () => 'Funções', rotEscopo, 'FUNÇÃO'),
    };
  }, [lista, rotEscopo]);
  const mem = { ...g.funcoes.mem, ...g.situacao.mem, ...g.tipo.mem, ...g.dp.mem, ...g.empresa.mem, ...g.equipe.mem, ...g.cpu.mem, ...g.admissao.mem, ...g.total.mem };
  const tot = (a: typeof g.tipo, k: string) => { const x = a.grupos.find((y) => y.rotulo === k); return x ? num(mem, x.valores.total.chave, x.valores.total.n) : 0; };
  const admissoes = { ...g.admissao, grupos: g.admissao.grupos.filter((x) => x.rotulo !== 'Sem data').slice(-12)
    .map((x) => ({ ...x, rotulo: `${x.rotulo.slice(5, 7)}/${x.rotulo.slice(2, 4)}` })) };
  const termo = busca.trim().toLowerCase();
  const tabela = g.funcoes.grupos.filter((x) => !termo || x.rotulo.toLowerCase().includes(termo));

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-full border border-m-stroke bg-m-surface-raised p-0.5" role="group" aria-label="Quem entra no resumo">
          {ESCOPOS.map((e) => (
            <button key={e.v} type="button" aria-pressed={escopo === e.v} onClick={() => setEscopo(e.v)}
              className={`h-9 rounded-full px-4 text-[13px] font-semibold ${escopo === e.v ? 'bg-m-accent text-white' : 'text-m-text-secondary hover:bg-m-surface-hover'}`}>{e.rotulo}</button>
          ))}
        </div>
        {empresas.length > 1 && <Selecao rotulo="Empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
          <option value="">Todas</option>{empresas.map((x) => <option key={x} value={x}>{x}</option>)}
        </Selecao>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Indicador rotulo="Pessoas" valor={tot(g.total, 'Pessoas')} detalhe={ESCOPOS.find((e) => e.v === escopo)!.rotulo} />
        <Indicador rotulo="Funções" detalhe="funções diferentes" valor={<Calculado chave="nfuncoes" memoria={() => ({
          chave: 'nfuncoes', titulo: 'Funções diferentes', valor: String(g.funcoes.grupos.length), formula: `funções distintas entre as pessoas do efetivo (${rotEscopo})`,
          passos: g.funcoes.grupos.map((x) => ({ descricao: x.rotulo, conta: `${x.valores.total.n} pessoa(s)`, resultado: '1', destaque: false })),
          fontes: [{ dado: 'FUNÇÃO', valor: `${g.funcoes.grupos.length} funções`, origem: 'Efetivo (planilha do DP importada)', local: 'coluna FUNÇÃO de cada pessoa' }], notas: [] })}>{g.funcoes.grupos.length}</Calculado>} />
        <Indicador rotulo="MOD" valor={tot(g.tipo, 'MOD')} detalhe="mão de obra direta" />
        <Indicador rotulo="MOI" valor={tot(g.tipo, 'MOI')} detalhe="mão de obra indireta" />
        <Indicador rotulo="Em equipe" valor={tot(g.equipe, 'Em equipe')} detalhe="membros de equipe" />
        <Indicador rotulo="Sem equipe" valor={tot(g.equipe, 'Sem equipe')} detalhe="fora da programação" tom={g.equipe.grupos.some((x) => x.rotulo === 'Sem equipe') ? 'atencao' : undefined} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Cartao titulo="Pessoas por função (20 maiores)" legenda={escopo === 'ativos' ? undefined : Object.fromEntries(SERIES_SITUACAO.filter((s) => lista.some((c) => ROTULO_SITUACAO[c.situacao] === s)).map((s) => [s, COR_SITUACAO[s]]))}>
          <BarrasH grupos={g.funcoes.grupos.slice(0, 20)} mem={mem} series={escopo === 'ativos' ? undefined : SERIES_SITUACAO} cores={COR_SITUACAO} />
        </Cartao>
        <div className="flex flex-col gap-4">
          <Cartao titulo="Situação"><Rosca grupos={g.situacao.grupos} mem={mem} cores={COR_SITUACAO} rotulo="pessoas" /></Cartao>
          <Cartao titulo="Tipo de mão de obra"><Rosca grupos={g.tipo.grupos} mem={mem} cores={COR_TIPO_MO} rotulo="pessoas" /></Cartao>
          <Cartao titulo="Equipes"><Rosca grupos={g.equipe.grupos} mem={mem} cores={COR_EQUIPE} rotulo="pessoas" /></Cartao>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Cartao titulo="Por DP"><BarrasH grupos={g.dp.grupos} mem={mem} cor="#4F46E5" /></Cartao>
        <Cartao titulo="Por empresa"><BarrasH grupos={g.empresa.grupos} mem={mem} cor="#0891B2" /></Cartao>
        <Cartao titulo="Função da composição (de-para, 15 maiores)"><BarrasH grupos={g.cpu.grupos} mem={mem} cor="#D97706" /></Cartao>
      </div>
      <Cartao titulo="Admissões por mês (últimos 12 meses com admissão)"><Colunas grupos={admissoes.grupos} mem={mem} cor="#008282" /></Cartao>

      <section className="flex flex-col gap-3 rounded-m-carimbo border border-m-stroke-subtle bg-m-surface-raised p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.4px] text-m-text-primary">Resumo por função · {tabela.length} função(ões)</h3>
          <Campo rotulo="Buscar função" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-[260px]" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.3px] text-m-text-muted">
                <th className="px-2 py-2">Função</th><th className="px-2 py-2 text-right">Total</th>
                {SERIES_SITUACAO.map((s) => <th key={s} className="px-2 py-2 text-right">{s}</th>)}
                <th className="px-2 py-2 text-right">Em equipe</th><th className="px-2 py-2 text-right">Sem equipe</th><th className="px-2 py-2">Tipo de MO</th>
              </tr>
            </thead>
            <tbody>
              {tabela.map((x) => {
                const ps = g.funcoes.pessoas[x.rotulo] ?? [];
                const emEq = ps.filter((p) => p.equipe || p.encarregado_de);
                const semEq = ps.filter((p) => !p.equipe && !p.encarregado_de);
                const tipos = [...new Set(ps.map(porTipoMo))].join(', ');
                const chEq = `tab:${x.rotulo}:eq`, chSem = `tab:${x.rotulo}:sem`;
                const memLinha: Record<string, MemoriaCalculo> = {
                  [chEq]: { ...mem[x.valores.total.chave], chave: chEq, titulo: `${x.rotulo} · em equipe`, valor: `${emEq.length} pessoa(s)`, formula: `pessoas da função ${x.rotulo} (${rotEscopo}) que estão em alguma equipe (membro ou encarregado)`, passos: emEq.map((p) => ({ descricao: p.nome, conta: p.equipe ?? p.encarregado_de ?? '', resultado: 'em equipe', destaque: false })) },
                  [chSem]: { ...mem[x.valores.total.chave], chave: chSem, titulo: `${x.rotulo} · sem equipe`, valor: `${semEq.length} pessoa(s)`, formula: `pessoas da função ${x.rotulo} (${rotEscopo}) fora de qualquer equipe`, passos: semEq.map((p) => ({ descricao: p.nome, conta: p.matricula ?? '', resultado: 'sem equipe', destaque: false })) },
                };
                const ab = aberta === x.rotulo;
                return (
                  <Fragment key={x.rotulo}>
                    <tr className="border-b border-m-row">
                      <td className="px-2 py-1.5">
                        <button type="button" className="inline-flex items-center gap-1 text-left font-medium text-m-text-primary" aria-expanded={ab} onClick={() => setAberta(ab ? null : x.rotulo)}>
                          {ab ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{x.rotulo}
                        </button>
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold">{num(mem, x.valores.total.chave, x.valores.total.n)}</td>
                      {SERIES_SITUACAO.map((s) => <td key={s} className="px-2 py-1.5 text-right">{x.valores[s] ? num(mem, x.valores[s].chave, x.valores[s].n) : ''}</td>)}
                      <td className="px-2 py-1.5 text-right">{num(memLinha, chEq, emEq.length)}</td>
                      <td className={`px-2 py-1.5 text-right ${semEq.length ? 'text-m-warning' : ''}`}>{num(memLinha, chSem, semEq.length)}</td>
                      <td className="px-2 py-1.5 text-[12px] text-m-text-muted">{tipos}</td>
                    </tr>
                    {ab && (
                      <tr className="border-b border-m-row bg-m-surface-hover">
                        <td colSpan={SERIES_SITUACAO.length + 5} className="px-4 py-2">
                          <ul className="grid gap-x-6 gap-y-0.5 text-[12px] sm:grid-cols-2 lg:grid-cols-3">
                            {ps.map((p) => <li key={p.id} className="truncate"><b className="text-m-text-primary">{p.nome}</b> <span className="text-m-text-muted">{[p.matricula, ROTULO_SITUACAO[p.situacao], p.equipe ?? (p.encarregado_de ? `enc. ${p.encarregado_de}` : 'sem equipe')].filter(Boolean).join(' · ')}</span></li>)}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!tabela.length && <tr><td colSpan={SERIES_SITUACAO.length + 5} className="py-6 text-center text-m-text-muted">Ninguém no efetivo com esse filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
