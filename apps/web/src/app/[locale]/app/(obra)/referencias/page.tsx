'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Botao, Cabecalho, Campo, Selecao, Erro, Pilula, Painel, Tabela, UploadForm, dataBR, fmt, td } from '@/components/Obra/ui';
import {
  chaves, useAtivarVersao, useBuscaAtividades, useBuscaPq, useExcluirVinculo, useIndices, useResolverVinculo,
  useSalvarVinculo, useUpload, useVersoes, useVinculos,
} from '@/hooks/programacao/queries';
import { useObra } from '@/lib/obra/ObraProvider';
import type { TipoReferencia, VinculoIn } from '@/lib/api/types';
import { useConfirmar } from '@/components/Obra/Confirmar';

const TIPOS: TipoReferencia[] = ['CRONOGRAMA', 'PQ', 'CPU', 'INDICES', 'SIMOVA'];
const vazio: VinculoIn = { simova_grupo_codigo: '', simova_oper_codigo: '', id_crono: '', item_pq: '', indice_codigo: '', frente_codigo: '' };

export default function ReferenciasPage() {
  const confirmar = useConfirmar();
  const { pode } = useObra();
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
      <Cabecalho eyebrow="Referências · versão vigente" cor="var(--m-proc-medir)" titulo="Cronograma, PQ, CPU e Simova que valem para a programação" />
      <div className="flex flex-col gap-4">
        <Painel titulo="Versões vigentes (cronograma × PQ × CPU × índices × Simova)">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {TIPOS.map((t) => {
              const vig = porTipo[t]?.find((v) => v.vigente);
              return (
                <div key={t} className="rounded-m-lg border border-m-stroke-subtle p-3 ">
                  <div className="mb-1 text-xs font-semibold text-m-text-muted">{t}</div>
                  {vig ? (
                    <>
                      <div className="text-sm font-medium text-m-accent">{vig.rotulo}</div>
                      <div className="text-xs text-m-text-muted">{fmt(vig.qtd_itens, 0)} itens · {dataBR(vig.carregado_em)}</div>
                    </>
                  ) : (
                    <Pilula tom="atencao">sem versão vigente</Pilula>
                  )}
                  {pode('admin') && (porTipo[t]?.length ?? 0) > 1 && (
                    <select
                      className="mt-2 w-full rounded-m-md border border-m-stroke-subtle bg-m-surface-field px-2 py-1 text-xs "
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
          {pode('admin') && <div className="mt-6 border-t border-m-stroke-subtle pt-4 ">
            <p className="mb-3 text-sm text-m-text-muted">
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
          </div>}
        </Painel>

        {pode('planejador') && <Painel titulo={editando ? `Editar vínculo #${editando}` : 'Novo vínculo'}>
          <p className="mb-4 text-sm text-m-text-muted">
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
                <ul className="mt-1 max-h-40 overflow-auto rounded-m-md border border-m-stroke-subtle text-xs ">
                  {atividades.data.map((a) => (
                    <li key={a.id_crono}>
                      <button type="button" className="w-full px-2 py-1 text-left hover:bg-m-surface-hover "
                        onClick={() => { setForm({ ...form, id_crono: a.id_crono, item_pq: a.item_pq ?? '' }); setBuscaAtv(''); }}>
                        <strong>{a.id_crono}</strong> {a.atividade} <span className="text-m-text-muted">({a.area})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="md:col-span-2">
              <Campo rotulo="Item da PQ (fora do cronograma)" value={buscaPq} onChange={(e) => setBuscaPq(e.target.value)} placeholder="1.8.2.1.2 ou descrição…" />
              {pq.data && buscaPq.length >= 2 && (
                <ul className="mt-1 max-h-40 overflow-auto rounded-m-md border border-m-stroke-subtle text-xs ">
                  {pq.data.map((p) => (
                    <li key={p.item}>
                      <button type="button" className="w-full px-2 py-1 text-left hover:bg-m-surface-hover "
                        onClick={() => { setForm({ ...form, item_pq: p.item }); setBuscaPq(''); }}>
                        <strong>{p.item}</strong> {p.descricao} <span className="text-m-text-muted">({p.composicao ?? 'sem CPU'})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Campo rotulo="ID cronograma" value={form.id_crono ?? ''} onChange={set('id_crono')} />
            <Campo rotulo="Item PQ" value={form.item_pq ?? ''} onChange={set('item_pq')} />
            <Campo rotulo="Composição (CPU) — opcional" value={form.composicao ?? ''} onChange={set('composicao')} />
            <Selecao rotulo="Índice específico — opcional" value={form.indice_codigo ?? ''} onChange={set('indice_codigo')}>
              <option value="">(usar CPU)</option>
              {indices.data?.map((i) => <option key={i.codigo} value={i.codigo}>{i.codigo} — {fmt(i.indice_un_dia)} {i.unid}/dia</option>)}
            </Selecao>
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
        </Painel>}

        <Painel titulo={`Vínculos (${vinculos.data?.length ?? 0})`}>
          {resolver.data && (
            <div className="mb-4 rounded-m-lg border border-m-accent bg-m-accent-subtle p-3 text-sm">
              <strong>Vínculo #{resolver.data.vinculo_id} resolvido nas versões vigentes:</strong>{' '}
              {resolver.data.atividade ?? resolver.data.descricao_pq} · PQ {resolver.data.item_pq ?? '—'} · CPU {resolver.data.composicao ?? '—'} ·
              governa <strong>{resolver.data.recurso_governa ?? '—'}</strong> · índice orçado {fmt(resolver.data.indice_orcado_un_dia)} {resolver.data.unid}/dia ·
              HH/un <strong>{fmt(resolver.data.hh_por_unidade, 4)}</strong>
              {resolver.data.pendencias.map((p) => <div key={p} className="text-m-danger">⚠ {p}</div>)}
            </div>
          )}
          <Tabela cabecalho={['#', 'Cronograma', 'PQ', 'CPU / índice', 'Simova (grupo/OPER)', 'TAREFA', '']} vazio={!vinculos.data?.length}>
            {vinculos.data?.map((v) => (
              <tr key={v.id}>
                <td className={td}>{v.id}</td>
                <td className={td}>{v.id_crono ?? '—'}</td>
                <td className={td}>{v.item_pq ?? '—'}</td>
                <td className={td}>{v.indice_codigo ?? v.composicao ?? <span className="text-m-text-muted">da referência</span>}</td>
                <td className={td}>{v.simova_grupo_codigo} / {v.simova_oper_codigo}</td>
                <td className={td}>{v.simova_tarefa_codigo ?? '—'}</td>
                <td className={`${td} whitespace-nowrap`}>
                  <button className="mr-3 text-m-accent" onClick={() => resolver.mutate(v.id)}>Resolver</button>
                  <button className="mr-3 text-m-accent" onClick={() => { setEditando(v.id); setForm({ ...v }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Editar</button>
                  <button className="text-m-danger" onClick={async () => (await confirmar({ titulo: 'Excluir este vínculo?' })) && excluir.mutate(v.id)}>Excluir</button>
                </td>
              </tr>
            ))}
          </Tabela>
        </Painel>
      </div>
    </>
  );
}
