'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Calculado } from '@/components/Obra/Calculado';
import { Cabecalho, Campo, Indicador, Painel, Selecao, Tabela, fmt, td, tdNum } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';
import { qs } from '@/lib/api/client';
import type { PainelIndicadores } from '@/lib/api/types';

const pct = (v: number | null | undefined) => (v == null ? '—' : `${fmt(v * 100, 1)} %`);
const FILTROS = { de: '', ate: '', encarregado: '', equipe_id: '', grupo: '', item_pq: '', area_id: '', modo: '' };
const CLASSE = { sobre: { rotulo: 'sobre-programada', cor: 'text-m-danger' }, sub: { rotulo: 'sub-programada', cor: 'text-m-warning' } } as const;

export default function IndicadoresPage() {
  const api = useApi();
  const [f, setF] = useState(FILTROS);
  const q = useQuery({
    queryKey: ['indicadores', f],
    queryFn: () => api.get<PainelIndicadores>(`/indicadores${qs(Object.fromEntries(Object.entries(f).filter(([, v]) => v)))}`),
  });
  const d = q.data;
  const conta = (chave: string, texto: ReactNode) => (d?.memorias[chave]
    ? <Calculado chave={chave} memoria={() => d.memorias[chave]}>{texto}</Calculado> : texto);
  const k = d?.kpis;
  const maxPareto = Math.max(1, ...(d?.pareto.map((p) => p.ocorrencias) ?? [1]));
  const paretoPainel = d && (
    <Painel titulo="Pareto de desvios">
      {!d.pareto.length ? <p className="py-6 text-center text-[13px] text-m-text-muted">Nenhum desvio no período.</p> : (
        <ul className="flex flex-col gap-1.5">
          {d.pareto.map((p) => (
            <li key={p.causa} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] items-center gap-2 text-[12.5px]" title={`${p.causa}: ${p.ocorrencias} · ${pct(p.pct)} · acumulado ${pct(p.pct_acumulado)}`}>
              <span className="truncate text-m-text-secondary">{p.causa}</span>
              <span className="h-3 rounded-r-[4px] bg-m-accent" style={{ width: `${(p.ocorrencias / maxPareto) * 100}%`, minWidth: 3 }} />
              <span className="whitespace-nowrap text-right text-m-text-primary"><b>{p.ocorrencias}</b> <span className="text-m-text-muted">· {pct(p.pct)} · acum. {pct(p.pct_acumulado)}</span></span>
            </li>
          ))}
        </ul>
      )}
    </Painel>
  );

  return (
    <>
      <Cabecalho eyebrow="Programar · indicadores" titulo="Programado × realizado × capacidade" />

      <Painel titulo="Filtros">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <Campo rotulo="De" type="date" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} />
          <Campo rotulo="Até" type="date" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} />
          <Selecao rotulo="Encarregado" value={f.encarregado} onChange={(e) => setF({ ...f, encarregado: e.target.value })}>
            <option value="">Todos</option>{d?.opcoes.encarregados.map((x) => <option key={x}>{x}</option>)}
          </Selecao>
          <Selecao rotulo="Equipe" value={f.equipe_id} onChange={(e) => setF({ ...f, equipe_id: e.target.value })}>
            <option value="">Todas</option>{d?.opcoes.equipes.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </Selecao>
          <Selecao rotulo="Grupo" value={f.grupo} onChange={(e) => setF({ ...f, grupo: e.target.value })}>
            <option value="">Todos</option>{d?.opcoes.grupos.map((x) => <option key={x}>{x}</option>)}
          </Selecao>
          <Selecao rotulo="Item da PQ" value={f.item_pq} onChange={(e) => setF({ ...f, item_pq: e.target.value })}>
            <option value="">Todos</option>{d?.opcoes.itens.map((x) => <option key={x}>{x}</option>)}
          </Selecao>
          <Selecao rotulo="Área" value={f.area_id} onChange={(e) => setF({ ...f, area_id: e.target.value })}>
            <option value="">Todas</option>{d?.opcoes.areas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </Selecao>
          <Selecao rotulo="Modo do previsto" value={f.modo} onChange={(e) => setF({ ...f, modo: e.target.value })}>
            <option value="">Todos</option><option value="capacidade">Pela capacidade</option><option value="manual">Manual (encarregado)</option><option value="ajustado">Capacidade ajustada</option>
          </Selecao>
        </div>
      </Painel>

      {q.isLoading && <p className="text-sm text-m-text-muted">Carregando…</p>}
      {k && !k.atividades && <Painel titulo="Sem histórico ainda"><p className="text-[13px] text-m-text-secondary">O histórico começa quando uma programação é emitida (previsto e capacidade) e fica completo quando ela é concluída (realizado). {k.desvios ? `Já há ${k.desvios} desvio(s) registrado(s): o Pareto está abaixo.` : ''}</p></Painel>}
      {k && !k.atividades && paretoPainel}
      {k && k.atividades > 0 && <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Indicador rotulo="PPC (atividades cumpridas)" valor={conta('ppc', pct(k.ppc))} detalhe={`${k.concluidas} de ${k.atividades} atividade(s) em programação concluída`} />
          <Indicador rotulo="Aderência da quantidade" valor={conta('aderencia', pct(k.aderencia))} detalhe="Σ realizado ÷ Σ previsto" />
          <Indicador rotulo="Programado × capacidade" valor={conta('carga', pct(k.carga))} detalhe={`${k.classes_carga.sobre} sobre · ${k.classes_carga.ok} na capacidade · ${k.classes_carga.sub} sub`} />
          <Indicador rotulo="Erro de programação" valor={conta('erro_programacao', pct(k.erro_programacao))} detalhe="média |previsto − capacidade| ÷ capacidade" />
          <Indicador rotulo="Erro de previsão" valor={conta('erro_previsao', pct(k.erro_previsao))} detalhe="média |realizado − previsto| ÷ previsto" />
          <Indicador rotulo="Realizado ÷ capacidade" valor={conta('realizado_capacidade', pct(k.realizado_capacidade))} detalhe="produtividade real × CPU" />
          <Indicador rotulo="Eficiência de HH" valor={conta('eficiencia_hh', pct(k.eficiencia_hh))} detalhe="HH da CPU ÷ HH da equipe programada" />
          <Indicador rotulo="Desvios no período" valor={conta('pareto', fmt(k.desvios, 0))} detalhe="registrados no Pareto" />
        </div>

        <Painel titulo="Pela capacidade × manual (encarregado)">
          <Tabela cabecalho={['Modo do previsto', 'Atividades', 'PPC', 'Aderência', 'Programado × capacidade', 'Erro de previsão']} direita={[1, 2, 3, 4, 5]} vazio={!d.por_modo.length}>
            {d.por_modo.map((m) => (
              <tr key={m.modo}>
                <td className={td}><b className="text-m-text-primary">{m.rotulo}</b></td>
                <td className={tdNum}>{m.atividades}</td>
                <td className={tdNum}>{pct(m.ppc)}</td>
                <td className={tdNum}>{conta(`modo_aderencia:${m.modo}`, pct(m.aderencia))}</td>
                <td className={tdNum}>{conta(`modo_carga:${m.modo}`, pct(m.carga))}</td>
                <td className={tdNum}>{conta(`modo_erro:${m.modo}`, pct(m.erro_previsao))}</td>
              </tr>
            ))}
          </Tabela>
        </Painel>

        <div className="grid gap-6 xl:grid-cols-2">
          <Painel titulo="PPC por semana">
            <div className="flex h-44 items-end gap-2 border-b border-m-stroke-subtle pb-1" role="img" aria-label="PPC por semana">
              {d.semanas.map((w) => (
                <div key={w.semana} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`S${w.semana}: PPC ${pct(w.ppc)} · aderência ${pct(w.aderencia)} · carga ${pct(w.carga)} · ${w.atividades} atividade(s)`}>
                  <span className="text-[11px] text-m-text-secondary">{pct(w.ppc)}</span>
                  <div className="w-full max-w-[36px] rounded-t-[4px] bg-m-accent" style={{ height: `${Math.max(2, (w.ppc ?? 0) * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-2">{d.semanas.map((w) => <span key={w.semana} className="flex-1 text-center text-[11px] text-m-text-muted">S{w.semana}</span>)}</div>
            <Tabela cabecalho={['Semana', 'Atividades', 'PPC', 'Aderência', 'Carga']} direita={[1, 2, 3, 4]}>
              {d.semanas.map((w) => <tr key={w.semana}><td className={td}>S{w.semana}</td><td className={tdNum}>{w.atividades}</td><td className={tdNum}>{pct(w.ppc)}</td><td className={tdNum}>{pct(w.aderencia)}</td><td className={tdNum}>{pct(w.carga)}</td></tr>)}
            </Tabela>
          </Painel>

          {paretoPainel}
        </div>

        <Painel titulo="Por encarregado">
          <Tabela cabecalho={['Encarregado', 'Atividades', 'PPC', 'Aderência', 'Programado × capacidade', 'Erro de programação']} direita={[1, 2, 3, 4, 5]}>
            {d.por_encarregado.map((e) => (
              <tr key={e.encarregado}>
                <td className={td}><b className="text-m-text-primary">{e.encarregado}</b></td>
                <td className={tdNum}>{e.atividades}</td>
                <td className={tdNum}>{conta(`enc_ppc:${e.chave}`, pct(e.ppc))}</td>
                <td className={tdNum}>{conta(`enc_aderencia:${e.chave}`, pct(e.aderencia))}</td>
                <td className={tdNum}>{conta(`enc_carga:${e.chave}`, pct(e.carga))}</td>
                <td className={tdNum}>{pct(e.erro_programacao)}</td>
              </tr>
            ))}
          </Tabela>
        </Painel>

        <Painel titulo="Fora da capacidade">
          <Tabela cabecalho={['Programação', 'Atividade', 'Encarregado', 'Modo', 'Previsto', 'Capacidade', 'Carga']} direita={[4, 5, 6]} vazio={!d.fora_da_capacidade.length && 'Nenhuma atividade fora da faixa.'}>
            {d.fora_da_capacidade.map((a) => (
              <tr key={`${a.programacao_id}-${a.n_linha}`}>
                <td className={td}><Link href={`/app/programacoes/${a.programacao_id}`} className="text-m-accent underline">{a.titulo.split(' · ')[0]}</Link> · linha {a.n_linha}</td>
                <td className={td}><b className="text-m-text-primary">{a.codigo_simova}</b> {a.descricao.slice(0, 70)}</td>
                <td className={td}>{a.encarregado ?? '—'}</td>
                <td className={td}>{a.modo}</td>
                <td className={tdNum}>{fmt(a.previsto)} {a.unidade ?? ''}</td>
                <td className={tdNum}>{fmt(a.capacidade)} {a.unidade ?? ''}</td>
                <td className={`${tdNum} font-semibold ${CLASSE[a.classe].cor}`}>{pct(a.carga)} · {CLASSE[a.classe].rotulo}</td>
              </tr>
            ))}
          </Tabela>
        </Painel>
      </>}
    </>
  );
}
