'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Calculado, nbr, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Botao, Cabecalho, Campo, Erro, Painel, Pilula, Selecao, fmt } from '@/components/Obra/ui';
import { useCatalogo, useFrentes2, useWbs } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';
import type { NoWbs, TipoNoWbs } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';

const FILHO: Record<TipoNoWbs, TipoNoWbs | null> = { area: 'cwp', cwp: 'grupo', grupo: 'iwp', iwp: null };
const ROTULO: Record<TipoNoWbs, string> = { area: 'Área', cwp: 'CWP', grupo: 'Grupo', iwp: 'IWP' };
const ESTILO: Record<TipoNoWbs, string> = {
  area: 'bg-m-accent-strong text-m-on-accent font-bold',
  cwp: 'bg-m-surface-active font-semibold text-m-text-primary',
  grupo: 'bg-m-surface-active/50 font-semibold text-m-text-primary',
  iwp: 'text-m-text-primary',
};
type Form = { modo: 'novo' | 'editar'; tipo: TipoNoWbs; pai?: NoWbs; no?: NoWbs; area_id: string; elemento: string; complemento: string; grupo_id: string; tipo_id: string; quantidade: string; observacao: string; ativo: boolean };
const vazio = (tipo: TipoNoWbs, pai?: NoWbs): Form => ({ modo: 'novo', tipo, pai, area_id: '', elemento: '', complemento: '', grupo_id: '', tipo_id: '', quantidade: '', observacao: '', ativo: true });

function memQtd(n: NoWbs): MemoriaCalculo {
  const un = n.unid ?? 'un';
  return n.origem_qtd === 'digitada'
    ? { chave: 'qtd', titulo: `Quantidade do IWP ${n.codigo}`, valor: `${nbr(n.quantidade)} ${un}`, formula: 'digitada no IWP (substitui o take-off)',
      passos: [{ descricao: 'Quantidade digitada', conta: '—', resultado: `${nbr(n.quantidade)} ${un}`, destaque: true }],
      fontes: [{ dado: 'Quantidade', valor: `${nbr(n.quantidade)} ${un}`, origem: 'WBS de execução', local: `IWP ${n.codigo} · campo Quantidade` },
        ...(n.qtd_takeoff != null ? [{ dado: 'Take-off (não usado)', valor: `${nbr(n.qtd_takeoff)} ${un}`, origem: 'PQ vigente · aba MC', local: `item ${n.item_pq}` }] : [])],
      notas: [] }
    : { chave: 'qtd', titulo: `Quantidade do IWP ${n.codigo}`, valor: `${nbr(n.qtd_takeoff)} ${un}`, formula: 'quantidade do item da PQ na TAG da área (aba MC do take-off)',
      passos: [{ descricao: `Item ${n.item_pq} × TAG da área`, conta: 'soma das quantidades da TAG', resultado: `${nbr(n.qtd_takeoff)} ${un}`, destaque: true }],
      fontes: [{ dado: 'Quantidade', valor: `${nbr(n.qtd_takeoff)} ${un}`, origem: 'PQ vigente · aba MC (take-off)', local: `item ${n.item_pq} · TAG do Ativo da área` }],
      notas: [] };
}

export default function WbsPage() {
  const { pode } = useObra();
  const editar = pode('planejador');
  const wbs = useWbs();
  const frentes = useFrentes2();
  const cat = useCatalogo();
  const api = useApi();
  const qc = useQueryClient();
  const confirmar = useConfirmar();
  const [fechados, setFechados] = useState<Set<number>>(new Set());
  const [form, setForm] = useState<Form | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const arvore = useMemo(() => wbs.data?.arvore ?? [], [wbs.data]);
  const areas = (frentes.data ?? []).flatMap((l) => l.areas.map((a) => ({ ...a, local: l.descricao })));
  const naWbs = new Set(arvore.map((n) => n.area_id));
  const grupos = cat.data ?? [];
  const atualizar = () => { qc.invalidateQueries({ queryKey: ['wbs'] }); qc.invalidateQueries({ queryKey: ['programacao'] }); };
  const conta = useMemo(() => {
    const c = { cwp: 0, grupo: 0, iwp: 0 } as Record<string, number>;
    const ir = (n: NoWbs) => { if (n.tipo !== 'area') c[n.tipo]++; n.filhos.forEach(ir); };
    arvore.forEach(ir);
    return c;
  }, [arvore]);

  const salvar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form) return;
    const q = form.quantidade.trim() === '' ? null : Number(form.quantidade.replace(',', '.'));
    try {
      if (form.modo === 'editar' && form.no) {
        await api.put(`/wbs/nos/${form.no.id}`, { tipo: form.tipo, elemento: form.elemento, complemento: form.complemento, quantidade: q, observacao: form.observacao, ativo: form.ativo });
        toast.success('Nó atualizado');
      } else {
        const r = await api.post<{ codigo: string }>('/wbs/nos', {
          tipo: form.tipo, pai_id: form.pai?.id ?? null, area_id: form.area_id ? Number(form.area_id) : null, elemento: form.elemento,
          complemento: form.complemento, grupo_id: form.grupo_id ? Number(form.grupo_id) : null, tipo_id: form.tipo_id ? Number(form.tipo_id) : null,
          quantidade: q, observacao: form.observacao,
        });
        toast.success(`${ROTULO[form.tipo]} ${r.codigo} criado`);
        if (form.pai) setFechados((f) => { const n = new Set(f); n.delete(form.pai!.id); return n; });
      }
      setForm(null); setErro(null); atualizar();
    } catch (e) { setErro(e); }
  };
  const excluir = async (n: NoWbs) => {
    if (!(await confirmar({ titulo: `Excluir ${ROTULO[n.tipo]} ${n.codigo}?`, mensagem: <>{n.titulo}<br />Só sai nó sem itens abaixo e sem programação (IWP em programação: inative).</> }))) return;
    try { await api.del(`/wbs/nos/${n.id}`); toast.success('Excluído'); atualizar(); } catch (e) { toast.error((e as Error).message); }
  };
  const alternar = (id: number) => setFechados((f) => { const n = new Set(f); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const formInline = (f: Form) => {
    const grupoPai = f.tipo === 'iwp' && f.pai ? grupos.find((g) => g.id === f.pai!.grupo_id) : undefined;
    const usados = new Set((f.pai?.filhos ?? []).map((x) => (f.tipo === 'grupo' ? x.grupo_id : x.tipo_id)));
    return (
      <form onSubmit={salvar} className="flex flex-wrap items-end gap-2 rounded-[12px] border border-m-accent bg-m-accent-subtle/40 p-3">
        {f.tipo === 'area' && f.modo === 'novo' && (
          <Selecao rotulo="Área (CWA) das Frentes" required value={f.area_id} onChange={(e) => setForm({ ...f, area_id: e.target.value })} className="min-w-[420px]">
            <option value="">Escolha a área…</option>
            {areas.filter((a) => !naWbs.has(a.id)).map((a) => <option key={a.id} value={a.id}>{a.cwa} · {a.descricao}{a.ativo_codigo ? ` · ${a.ativo_codigo}` : ''} ({a.local})</option>)}
          </Selecao>
        )}
        {f.tipo === 'cwp' && <>
          <Campo rotulo="Elemento" required placeholder="Radier" maxLength={80} value={f.elemento} onChange={(e) => setForm({ ...f, elemento: e.target.value })} className="w-[220px]" />
          <Campo rotulo="Texto complementar" placeholder="Eixo A–B" maxLength={120} value={f.complemento} onChange={(e) => setForm({ ...f, complemento: e.target.value })} className="w-[300px]" />
        </>}
        {f.tipo === 'grupo' && f.modo === 'novo' && (
          <Selecao rotulo="Grupo do catálogo" required value={f.grupo_id} onChange={(e) => setForm({ ...f, grupo_id: e.target.value })} className="min-w-[280px]">
            <option value="">Escolha o grupo…</option>
            {grupos.filter((g) => !usados.has(g.id)).map((g) => <option key={g.id} value={g.id}>{g.codigo} · {g.descricao} ({g.tipos.length} itens da PQ)</option>)}
          </Selecao>
        )}
        {f.tipo === 'iwp' && f.modo === 'novo' && (
          <Selecao rotulo={`Item da PQ do grupo ${grupoPai?.descricao ?? ''}`} required value={f.tipo_id} onChange={(e) => setForm({ ...f, tipo_id: e.target.value })} className="min-w-[460px]">
            <option value="">{grupoPai?.tipos.length ? 'Escolha o item…' : 'O grupo não tem itens da PQ: vincule no Catálogo'}</option>
            {grupoPai?.tipos.filter((t) => t.item_pq && !usados.has(t.id)).map((t) => <option key={t.id} value={t.id}>{t.item_pq} · {t.descricao}{t.unidade ? ` (${t.unidade})` : ''}</option>)}
          </Selecao>
        )}
        {f.tipo === 'iwp' && <Campo rotulo="Quantidade (vazio = take-off)" type="number" step="any" min="0" value={f.quantidade} onChange={(e) => setForm({ ...f, quantidade: e.target.value })} className="w-[170px]" />}
        <Campo rotulo="Observação" maxLength={300} value={f.observacao} onChange={(e) => setForm({ ...f, observacao: e.target.value })} className="w-[220px]" />
        {f.modo === 'editar' && <label className="flex items-center gap-2 pb-2.5 text-[13px] text-m-text-secondary"><input type="checkbox" checked={f.ativo} onChange={(e) => setForm({ ...f, ativo: e.target.checked })} /> Ativo</label>}
        <Botao type="submit">Salvar</Botao>
        <Botao type="button" variante="secundario" onClick={() => { setForm(null); setErro(null); }}>Cancelar</Botao>
        <Erro erro={erro} />
      </form>
    );
  };

  const td = 'border-b border-m-row px-2 py-1.5 align-top';
  const linhas = (n: NoWbs, nivel: number): React.ReactNode => {
    const aberto = !fechados.has(n.id);
    const filho = FILHO[n.tipo];
    const editandoAqui = form && ((form.modo === 'editar' && form.no?.id === n.id) || (form.modo === 'novo' && form.pai?.id === n.id));
    return (
      <Fragment key={n.id}>
        <tr className={`text-[12.5px] ${ESTILO[n.tipo]} ${n.ativo ? '' : 'opacity-50'}`}>
          <td className={`${td} whitespace-nowrap`} style={{ paddingLeft: 8 + nivel * 16 }}>
            {n.filhos.length > 0
              ? <button type="button" className="mr-1 inline-flex align-middle" aria-label={`${aberto ? 'Recolher' : 'Abrir'} ${n.codigo}`} onClick={() => alternar(n.id)}>{aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
              : <span className="mr-1 inline-block w-[14px]" />}
            {n.codigo}
          </td>
          <td className={td}><span className="text-[10.5px] uppercase tracking-[0.3px] opacity-80">{ROTULO[n.tipo]}</span></td>
          <td className={`${td} min-w-[360px]`}>{n.titulo}{n.detalhe && <span className={`ml-2 text-[11px] font-normal ${n.tipo === 'area' ? 'opacity-80' : 'text-m-text-muted'}`}>{n.detalhe}</span>}
            {n.observacao && <div className="text-[11px] font-normal opacity-80">{n.observacao}</div>}
            {n.tipo === 'iwp' && n.na_pq_vigente === false && <div className="text-[11px] text-m-warning">item fora da PQ vigente</div>}</td>
          <td className={td}>{n.unid ?? ''}</td>
          <td className={`${td} whitespace-nowrap text-right`}>{n.tipo === 'iwp' ? (n.quantidade_efetiva != null
            ? <><Calculado chave="qtd" memoria={() => memQtd(n)}>{fmt(n.quantidade_efetiva)}</Calculado>{' '}<Pilula ponto={false} tom={n.origem_qtd === 'digitada' ? 'acento' : 'info'}>{n.origem_qtd}</Pilula></>
            : <span className="text-[11px] text-m-warning">sem quantidade</span>) : ''}</td>
          <td className={`${td} text-right`}>{n.linhas ? `${n.linhas} linha(s)` : ''}</td>
          <td className={`${td} whitespace-nowrap text-right`}>
            {editar && <>
              {filho && <button type="button" className="mr-2 text-[12px] font-semibold underline-offset-2 hover:underline" onClick={() => { setErro(null); setForm(vazio(filho, n)); }}><Plus size={12} className="mr-0.5 inline" />{ROTULO[filho]}</button>}
              {<button type="button" aria-label={`Editar ${n.codigo}`} className="p-1 opacity-80 hover:opacity-100" onClick={() => { setErro(null); setForm({ ...vazio(n.tipo), modo: 'editar', no: n, elemento: n.elemento ?? '', complemento: n.complemento ?? '', quantidade: n.quantidade != null ? String(n.quantidade) : '', observacao: n.observacao ?? '', ativo: n.ativo }); }}><Pencil size={13} /></button>}
              {!n.filhos.length && !n.linhas && <button type="button" aria-label={`Excluir ${n.codigo}`} className="p-1 opacity-80 hover:text-m-danger hover:opacity-100" onClick={() => excluir(n)}><Trash2 size={13} /></button>}
            </>}
          </td>
        </tr>
        {editandoAqui && form && <tr><td colSpan={7} className="px-2 py-2" style={{ paddingLeft: 8 + (nivel + 1) * 16 }}>{formInline(form)}</td></tr>}
        {aberto && n.filhos.map((f) => linhas(f, nivel + 1))}
      </Fragment>
    );
  };

  return (
    <>
      <Cabecalho
        eyebrow="Programar · WBS de execução"
        titulo={arvore.length ? `${arvore.length} área(s) · ${conta.cwp} CWP · ${conta.iwp} IWP` : 'WBS de execução vazia'}
        descricao={<>Detalhe aqui o que a programação precisa e o cronograma não tem: <b>Área</b> (CWA das Frentes) → <b>CWP</b> (elemento + texto complementar, ex.: Radier · Eixo A–B) → <b>Grupo</b> (Concreto, Forma, Aço… do <Link href="/app/catalogo" className="font-semibold text-m-accent">Catálogo</Link>) → <b>IWP</b> (item da PQ do grupo, com a quantidade digitada ou a do take-off pela TAG da área). Na programação, &quot;Nova linha&quot; pode partir do IWP: área, item, quantidade e o texto complementar do Simova (o CWP) vêm daqui.</>}
        acoes={editar && <Botao onClick={() => { setErro(null); setForm(vazio('area')); }}><Plus size={16} /> Área</Botao>}
      />
      {form && form.tipo === 'area' && form.modo === 'novo' && <Painel titulo="Nova área na WBS">{formInline(form)}</Painel>}
      <Painel titulo="Estrutura" subtitulo="Clique em + para descer um nível. Nó usado em programação não pode ser excluído (inative).">
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full border-collapse">
            <thead><tr className="text-left text-[10.5px] font-semibold uppercase tracking-[0.3px] text-m-text-muted">
              <th className="px-2 py-2">Código</th><th className="px-2 py-2">Nível</th><th className="px-2 py-2">Descrição</th><th className="px-2 py-2">Un.</th>
              <th className="px-2 py-2 text-right">Quantidade</th><th className="px-2 py-2 text-right">Programação</th><th className="px-2 py-2" />
            </tr></thead>
            <tbody>
              {!arvore.length && <tr><td colSpan={7} className="py-8 text-center text-sm text-m-text-muted">{wbs.isLoading ? 'Carregando…' : 'Comece pela área: + Área.'}</td></tr>}
              {arvore.map((n) => linhas(n, 0))}
            </tbody>
          </table>
        </div>
      </Painel>
    </>
  );
}
