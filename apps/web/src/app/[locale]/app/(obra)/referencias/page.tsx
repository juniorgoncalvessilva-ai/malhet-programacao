'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb';
import { Botao, Campo, Erro, Etiqueta, Painel, Tabela, UploadForm, dataBR, fmt, td } from '@/components/Obra/ui';
import {
  chaves, useAtivarVersao, useBuscaAtividades, useBuscaPq, useExcluirVinculo, useIndices, useResolverVinculo,
  useSalvarVinculo, useUpload, useVersoes, useVinculos,
} from '@/hooks/programacao/queries';
import type { TipoReferencia, VinculoIn } from '@/lib/api/types';

const TIPOS: TipoReferencia[] = ['CRONOGRAMA', 'PQ', 'CPU', 'INDICES', 'SIMOVA'];
const vazio: VinculoIn = { simova_grupo_codigo: '', simova_oper_codigo: '', id_crono: '', item_pq: '', indice_codigo: '', frente_codigo: '' };

export default function ReferenciasPage() {
  const versoes = useVersoes();
  const ativar = useAtivarVersao();
  const carregar = useUpload('/referencias/versoes/carregar', [[...chaves.versoes]]);
  const vinculos = useVinculos();
  const salvar = useSalvarVinculo();
  const excluir = useExcluirVinculo();
  const resolver = useResolverVinculo();
  const indices = useIndices();
  const [form, setForm] = useState<VinculoIn>(vazio);
  const [editando, setEditando] = useState<number | undefined>();
  const [buscaAtv, setBuscaAtv] = useState('');
  const [buscaPq, setBuscaPq] = useState('');
  const atividades = useBuscaAtividades(buscaAtv);
  const pq = useBuscaPq(buscaPq);

  const porTipo = useMemo(() => {
    const m: Record<string, typeof versoes.data> = {};
    (versoes.data ?? []).forEach((v) => (m[v.tipo] ??= []).push(v));
    return m;
  }, [versoes.data]);

  const set = (k: keyof VinculoIn) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <Breadcrumb pageName="Referências — versão vigente" />
      <div className="space-y-6">
        <Painel titulo="Versões vigentes (cronograma × PQ × CPU × índices × Simova)">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {TIPOS.map((t) => {
              const vig = porTipo[t]?.find((v) => v.vigente);
              return (
                <div key={t} className="rounded-lg border border-stroke p-3 dark:border-dark-3">
                  <div className="mb-1 text-xs font-semibold text-dark-5">{t}</div>
                  {vig ? (
                    <>
                      <div className="text-sm font-medium text-dark dark:text-white">{vig.rotulo}</div>
                      <div className="text-xs text-dark-5">{fmt(vig.qtd_itens, 0)} itens · {dataBR(vig.carregado_em)}</div>
                    </>
                  ) : (
                    <Etiqueta cor="amarelo">sem versão vigente</Etiqueta>
                  )}
                  {(porTipo[t]?.length ?? 0) > 1 && (
                    <select
                      className="mt-2 w-full rounded border border-stroke bg-transparent px-2 py-1 text-xs dark:border-dark-3"
                      value={vig?.id ?? ''}
                      onChange={(e) => ativar.mutate(Number(e.target.value), { onSuccess: () => toast.success('Versão vigente alterada') })}
                    >
                      {porTipo[t]!.map((v) => (
                        <option key={v.id} value={v.id}>#{v.id} {v.rotulo}</option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-6 border-t border-stroke pt-4 dark:border-dark-3">
            <p className="mb-3 text-sm text-dark-5">
              Carregue a <strong>planilha auxiliar</strong> (Programacao_auxiliar_vN.xlsx). As abas ATIVIDADES, PQ, RECURSOS e ÍNDICES
              viram novas versões e passam a ser as vigentes. As anteriores continuam guardadas para consulta.
            </p>
            <UploadForm
              campos={[{ nome: 'arquivo', rotulo: 'Planilha auxiliar' }]}
              rotulo="Carregar nova versão"
              pendente={carregar.isPending}
              onEnviar={(fd) =>
                carregar.mutate(fd, {
                  onSuccess: (r) => toast.success(`Versões carregadas: ${JSON.stringify(r.contagem)}`),
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              <Campo rotulo="Rótulo da versão" name="rotulo" required placeholder="P6 rev 12 — 02/11/2026" />
              <Campo rotulo="Data-base" name="data_base" type="date" />
            </UploadForm>
          </div>
        </Painel>

        <Painel titulo={editando ? `Editar vínculo #${editando}` : 'Novo vínculo'}>
          <p className="mb-4 text-sm text-dark-5">
            Liga a atividade do cronograma (ou o item da PQ, para atividades fora do cronograma) à OPER do Simova. A CPU e o índice
            vêm da PQ/cronograma vigentes. Preencha a composição ou o índice específico só para trocar o que veio da referência.
          </p>
          <form
            className="grid gap-3 md:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              const dados = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v])) as unknown as VinculoIn;
              salvar.mutate(
                { id: editando, dados },
                { onSuccess: () => { toast.success('Vínculo salvo'); setForm(vazio); setEditando(undefined); } },
              );
            }}
          >
            <div className="md:col-span-2">
              <Campo rotulo="Atividade do cronograma (busque por ID ou nome)" value={buscaAtv} onChange={(e) => setBuscaAtv(e.target.value)} placeholder="C-13870 ou escavação…" />
              {atividades.data && buscaAtv.length >= 2 && (
                <ul className="mt-1 max-h-40 overflow-auto rounded border border-stroke text-xs dark:border-dark-3">
                  {atividades.data.map((a) => (
                    <li key={a.id_crono}>
                      <button type="button" className="w-full px-2 py-1 text-left hover:bg-gray-2 dark:hover:bg-dark-2"
                        onClick={() => { setForm({ ...form, id_crono: a.id_crono, item_pq: a.item_pq ?? '' }); setBuscaAtv(''); }}>
                        <strong>{a.id_crono}</strong> {a.atividade} <span className="text-dark-5">({a.area})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="md:col-span-2">
              <Campo rotulo="Item da PQ (fora do cronograma)" value={buscaPq} onChange={(e) => setBuscaPq(e.target.value)} placeholder="1.8.2.1.2 ou descrição…" />
              {pq.data && buscaPq.length >= 2 && (
                <ul className="mt-1 max-h-40 overflow-auto rounded border border-stroke text-xs dark:border-dark-3">
                  {pq.data.map((p) => (
                    <li key={p.item}>
                      <button type="button" className="w-full px-2 py-1 text-left hover:bg-gray-2 dark:hover:bg-dark-2"
                        onClick={() => { setForm({ ...form, item_pq: p.item }); setBuscaPq(''); }}>
                        <strong>{p.item}</strong> {p.descricao} <span className="text-dark-5">({p.composicao ?? 'sem CPU'})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Campo rotulo="ID cronograma" value={form.id_crono ?? ''} onChange={set('id_crono')} />
            <Campo rotulo="Item PQ" value={form.item_pq ?? ''} onChange={set('item_pq')} />
            <Campo rotulo="Composição (CPU) — opcional" value={form.composicao ?? ''} onChange={set('composicao')} />
            <label className="flex flex-col gap-1 text-xs font-medium text-dark-5">
              Índice específico — opcional
              <select value={form.indice_codigo ?? ''} onChange={set('indice_codigo')} className="rounded-[7px] border border-stroke bg-transparent px-3 py-2 text-sm dark:border-dark-3">
                <option value="">(usar CPU)</option>
                {indices.data?.map((i) => <option key={i.codigo} value={i.codigo}>{i.codigo} — {fmt(i.indice_un_dia)} {i.unid}/dia</option>)}
              </select>
            </label>
            <Campo rotulo="Simova: código do grupo" required value={form.simova_grupo_codigo} onChange={set('simova_grupo_codigo')} />
            <Campo rotulo="Simova: código da OPER" required value={form.simova_oper_codigo} onChange={set('simova_oper_codigo')} />
            <Campo rotulo="Simova: TAREFA (IWP) — opcional" value={form.simova_tarefa_codigo ?? ''} onChange={set('simova_tarefa_codigo')} />
            <Campo rotulo="Frente" value={form.frente_codigo ?? ''} onChange={set('frente_codigo')} />
            <div className="flex items-end gap-2 md:col-span-4">
              <Botao type="submit" disabled={salvar.isPending}>Salvar vínculo</Botao>
              {editando && <Botao type="button" variante="secundario" onClick={() => { setEditando(undefined); setForm(vazio); }}>Cancelar</Botao>}
            </div>
            <div className="md:col-span-4"><Erro erro={salvar.error} /></div>
          </form>
        </Painel>

        <Painel titulo={`Vínculos (${vinculos.data?.length ?? 0})`}>
          {resolver.data && (
            <div className="mb-4 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
              <strong>Vínculo #{resolver.data.vinculo_id} resolvido nas versões vigentes:</strong>{' '}
              {resolver.data.atividade ?? resolver.data.descricao_pq} · PQ {resolver.data.item_pq ?? '—'} · CPU {resolver.data.composicao ?? '—'} ·
              governa <strong>{resolver.data.recurso_governa ?? '—'}</strong> · índice orçado {fmt(resolver.data.indice_orcado_un_dia)} {resolver.data.unid}/dia ·
              HH/un <strong>{fmt(resolver.data.hh_por_unidade, 4)}</strong>
              {resolver.data.pendencias.map((p) => <div key={p} className="text-red-dark">⚠ {p}</div>)}
            </div>
          )}
          <Tabela cabecalho={['#', 'Cronograma', 'PQ', 'CPU / índice', 'Simova (grupo/OPER)', 'TAREFA', '']} vazio={!vinculos.data?.length}>
            {vinculos.data?.map((v) => (
              <tr key={v.id}>
                <td className={td}>{v.id}</td>
                <td className={td}>{v.id_crono ?? '—'}</td>
                <td className={td}>{v.item_pq ?? '—'}</td>
                <td className={td}>{v.indice_codigo ?? v.composicao ?? <span className="text-dark-5">da referência</span>}</td>
                <td className={td}>{v.simova_grupo_codigo} / {v.simova_oper_codigo}</td>
                <td className={td}>{v.simova_tarefa_codigo ?? '—'}</td>
                <td className={`${td} whitespace-nowrap`}>
                  <button className="mr-3 text-primary" onClick={() => resolver.mutate(v.id)}>Resolver</button>
                  <button className="mr-3 text-primary" onClick={() => { setEditando(v.id); setForm({ ...v }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Editar</button>
                  <button className="text-red" onClick={() => excluir.mutate(v.id)}>Excluir</button>
                </td>
              </tr>
            ))}
          </Tabela>
        </Painel>
      </div>
    </>
  );
}
