'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb';
import { Botao, Campo, Erro, Etiqueta, Painel, Selecao, Tabela, dataBR, fmt, td } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { useAcaoItem, useCriarItem, useEquipes, useFrentes, useGrupos, useItens, useOpers } from '@/hooks/programacao/queries';
import { qs } from '@/lib/api/client';
import type { CriarItemOut, DiaPlano } from '@/lib/api/types';

const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const somar = (s: string, n: number) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };
const intervalo = (a: string, b: string) => { const out: string[] = []; for (let d = a; d <= b; d = somar(d, 1)) out.push(d); return out.slice(0, 7); };
const proximaSegunda = () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return iso(d); };

export default function ProgramacaoPage() {
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

  const equipe = equipes.data?.find((e) => String(e.id) === equipeId);
  const gruposUnicos = useMemo(() => {
    const m = new Map<string, string>();
    grupos.data?.forEach((g) => !m.has(g.codigo) && m.set(g.codigo, g.descricao));
    return [...m.entries()];
  }, [grupos.data]);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipe?.encarregado_cracha) return toast.error('A equipe precisa ter o crachá do encarregado (aba Equipes).');
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
      toast.success(`${n} item(ns) aprovado(s) exportado(s) para o Simova`);
      itens.refetch();
    } catch (er) { toast.error((er as Error).message); }
  };

  return (
    <>
      <Breadcrumb pageName="Programação diária" />
      <div className="space-y-6">
        <Painel
          titulo="Semana"
          acoes={<>
            <Botao variante="secundario" onClick={() => setInicio(somar(inicio, -7))}>◀</Botao>
            <Campo rotulo="" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            <Botao variante="secundario" onClick={() => setInicio(somar(inicio, 7))}>▶</Botao>
            <Botao onClick={exportar}>Exportar FT p/ Simova</Botao>
          </>}
        >
          <Tabela cabecalho={['Encarregado', 'Grupo / OPER', 'Frente', 'Origem', ...dias.map((d) => `${DIAS[new Date(`${d}T12:00`).getDay()]} ${dataBR(d).slice(0, 5)}`), 'Status', '']} vazio={!itens.data?.length}>
            {itens.data?.map((i) => (
              <tr key={i.id}>
                <td className={td}>{i.encarregado_nome}<div className="text-xs text-dark-5">{i.encarregado_cracha}</div></td>
                <td className={td}>{i.grupo_codigo}/{i.oper_codigo} — {i.oper_descricao}
                  {i.id_crono && <div className="text-xs text-dark-5">crono {i.id_crono} · PQ {i.item_pq}</div>}</td>
                <td className={td}>{i.frente_codigo}</td>
                <td className={td}><Etiqueta cor={i.origem === 'cronograma' ? 'azul' : i.origem === 'pq' ? 'amarelo' : 'cinza'}>{i.origem}</Etiqueta></td>
                {dias.map((d) => {
                  const x = i.dias.find((y) => y.data === d);
                  return <td key={d} className={`${td} text-center text-xs`}>{x ? <>{fmt(x.pe)}<div className="text-dark-5">{fmt(x.hh)} HH</div></> : ''}</td>;
                })}
                <td className={td}><Etiqueta cor={i.status === 'aprovado' ? 'verde' : i.status === 'exportado' ? 'azul' : 'cinza'}>{i.status}</Etiqueta></td>
                <td className={`${td} whitespace-nowrap`}>
                  {i.status === 'rascunho' && <button className="mr-3 text-primary" onClick={() => acao.mutate({ id: i.id, acao: 'aprovar' })}>Aprovar</button>}
                  {i.status !== 'exportado' && <button className="text-red" onClick={() => acao.mutate({ id: i.id, acao: 'excluir' })}>Excluir</button>}
                </td>
              </tr>
            ))}
          </Tabela>
          <Erro erro={acao.error} />
        </Painel>

        <Painel titulo="Programar atividade">
          <form onSubmit={enviar} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Selecao rotulo="Equipe / encarregado" value={equipeId} onChange={(e) => setEquipeId(e.target.value)} required>
                <option value="">—</option>
                {equipes.data?.map((e) => <option key={e.id} value={e.id}>{e.nome} · {e.encarregado_nome ?? 's/ encarregado'} · {fmt(e.hh_disponivel_dia)} HH/dia</option>)}
              </Selecao>
              <Selecao rotulo="Grupo (Simova)" value={grupo} onChange={(e) => { setGrupo(e.target.value); setOper(''); }} required>
                <option value="">—</option>
                {gruposUnicos.map(([c, d]) => <option key={c} value={c}>{c} — {d}</option>)}
              </Selecao>
              <Selecao rotulo="OPER (atividade padrão)" value={oper} onChange={(e) => setOper(e.target.value)} required>
                <option value="">—</option>
                {opers.data?.map((o) => <option key={o.id} value={o.codigo}>{o.codigo} — {o.descricao}</option>)}
              </Selecao>
              <Selecao rotulo="Frente" value={frente} onChange={(e) => setFrente(e.target.value)} required>
                <option value="">—</option>
                {frentes.data?.map((f) => <option key={f.codigo} value={f.codigo}>{f.codigo} — {f.descricao}</option>)}
              </Selecao>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {dias.map((d) => (
                <div key={d} className="rounded border border-stroke p-2 dark:border-dark-3">
                  <div className="mb-1 text-xs font-semibold">{DIAS[new Date(`${d}T12:00`).getDay()]} {dataBR(d).slice(0, 5)}</div>
                  <Campo rotulo="PE" type="number" min="0" step="any" value={pe[d] ?? ''} onChange={(e) => setPe({ ...pe, [d]: e.target.value })} />
                  <Campo rotulo="HH (vazio = PE × índice)" type="number" min="0" step="any" value={hh[d] ?? ''} onChange={(e) => setHh({ ...hh, [d]: e.target.value })} />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <Campo rotulo="Observação" value={obs} onChange={(e) => setObs(e.target.value)} className="min-w-[280px] flex-1" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={excesso} onChange={(e) => setExcesso(e.target.checked)} /> permitir acima da capacidade</label>
              <Botao type="submit" disabled={criar.isPending}>Programar</Botao>
            </div>
            <Erro erro={criar.error} />
          </form>

          {resultado && (
            <div className="mt-6 rounded-lg border border-stroke p-4 text-sm dark:border-dark-3">
              <div className="mb-2 font-medium">Capacidade da equipe: {fmt(resultado.hh_disponivel_dia)} HH/dia · índice {fmt(resultado.item.indice_hh_por_unidade, 4)} HH/un</div>
              {resultado.avisos.map((a) => <div key={a} className="text-yellow-dark-2">⚠ {a}</div>)}
              <div className="mt-2 flex flex-wrap gap-2">
                {resultado.ocupacao.map((o) => (
                  <Etiqueta key={o.data} cor={o.excedido ? 'vermelho' : 'verde'}>{dataBR(o.data).slice(0, 5)}: {fmt(o.hh_programado)}/{fmt(o.hh_disponivel)} HH</Etiqueta>
                ))}
              </div>
            </div>
          )}
        </Painel>
      </div>
    </>
  );
}
