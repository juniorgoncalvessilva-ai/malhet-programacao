'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Download, Link2, Pencil, Plus, Save, Trash2, Unlink } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Botao, Cabecalho, Campo, Chip, Erro, Painel, Pilula, Selecao, fmt } from '@/components/Obra/ui';
import { k, useAcao, useCatalogo } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';
import type { GrupoCatalogo, ItemCatalogo, LinhaPq, TipoCatalogo } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Calculado, nbr } from '@/components/Obra/Calculado';

type GrupoForm = { id?: number; descricao: string; numero: string; ativo: boolean };
type TipoForm = { id: number; grupo_id: string; numero: string; ativo: boolean; codigo: string };
type ItemForm = { id?: number; tipo_id: number; complemento: string; ativo: boolean };

const num = (v: string) => (v.trim() ? Number(v) : null);
const th = 'px-2 py-2 text-[10.5px] font-semibold uppercase tracking-[0.3px] text-m-text-muted whitespace-nowrap';
const tdc = 'px-2 py-2 text-[12.5px] align-top tabular-nums border-b border-m-row';
// níveis da aba PQ (como na planilha: 1 laranja, 2 amarelo… aqui nos tons do design)
const NIVEL: Record<number, string> = {
  1: 'bg-m-accent-strong text-m-on-accent font-bold uppercase',
  2: 'bg-m-surface-active font-bold text-m-text-primary',
  3: 'bg-m-surface-active/60 font-semibold text-m-text-primary',
  4: 'font-semibold text-m-text-secondary',
};

export default function CatalogoPage() {
  const confirmar = useConfirmar();
  const cat = useCatalogo();
  const api = useApi();
  const { pode } = useObra();
  const editar = pode('planejador');
  const inv = [[...k.catalogo], ['programacao'], ['pq-estrutura']];
  const pq = useQuery({ queryKey: ['pq-estrutura'], queryFn: () => api.get<{ versao: { rotulo: string; arquivo: string | null } | null; linhas: LinhaPq[] }>('/pq/estrutura') });
  const [grupo, setGrupo] = useState<GrupoForm | null>(null);
  const [tipo, setTipo] = useState<TipoForm | null>(null);
  const [item, setItem] = useState<ItemForm | null>(null);
  const [destino, setDestino] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [soLivres, setSoLivres] = useState(false);
  const [fechados, setFechados] = useState<Set<string>>(new Set());
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const salvarNomes = useAcao((a, d: Record<string, string>) => a.put<{ salvos: number }>('/catalogo/nomes-simplificados', {
    itens: Object.entries(d).map(([item, nome]) => ({ item, nome })),
  }), inv);
  const grupoDoItem = useAcao((a, d: { item: string; grupo_id: number | null }) => a.put<{ codigo: string | null }>(`/catalogo/itens-pq/${encodeURIComponent(d.item)}/grupo`, { grupo_id: d.grupo_id }), inv);
  const mudarGrupo = async (l: LinhaPq, valor: string) => {
    const gid = valor ? Number(valor) : null;
    if (gid === null && l.tipo && !(await confirmar({ titulo: `Desvincular o item ${l.item} do grupo?`, mensagem: <>{l.descricao}<br />Os itens complementares do tipo {l.tipo.codigo} também saem. Tipo usado em programação não pode ser desvinculado: inative-o no catálogo.</>, acao: 'Desvincular' }))) return;
    grupoDoItem.mutate({ item: l.item, grupo_id: gid }, {
      onSuccess: (r) => toast.success(r.codigo ? `${l.item} é o tipo ${r.codigo}` : `${l.item} desvinculado`),
      onError: (e) => toast.error(e.message),
    });
  };
  const nNomes = Object.keys(nomes).length;

  const salvarGrupo = useAcao((a, d: GrupoForm) => {
    const corpo = { descricao: d.descricao, numero: num(d.numero), ativo: d.ativo };
    return d.id ? a.put(`/catalogo/grupos/${d.id}`, corpo) : a.post('/catalogo/grupos', corpo);
  }, inv);
  const excluirGrupo = useAcao((a, id: number) => a.del(`/catalogo/grupos/${id}`), inv);
  const salvarTipo = useAcao((a, d: TipoForm) => a.put(`/catalogo/tipos/${d.id}`, { grupo_id: Number(d.grupo_id), numero: num(d.numero), ativo: d.ativo }), inv);
  const desvincular = useAcao((a, id: number) => a.del(`/catalogo/tipos/${id}`), inv);
  const vincular = useAcao((a, d: { gid: number; itens: string[] }) => a.post<{ criados: string[]; avisos: string[] }>(`/catalogo/grupos/${d.gid}/itens-pq`, { itens: d.itens }), inv);
  const salvarItem = useAcao((a, d: ItemForm) => {
    const corpo = { tipo_id: d.tipo_id, complemento: d.complemento, ativo: d.ativo };
    return d.id ? a.put(`/catalogo/itens/${d.id}`, corpo) : a.post<{ criado: boolean; aviso: string | null }>('/catalogo/itens', corpo);
  }, inv);

  const grupos = cat.data ?? [];
  const nTipos = grupos.reduce((s, g) => s + g.tipos.length, 0);
  const fechar = () => { setGrupo(null); setTipo(null); setItem(null); };
  const abrirGrupo = (g?: GrupoCatalogo) => { fechar(); setGrupo(g ? { id: g.id, descricao: g.descricao, numero: String(g.numero), ativo: g.ativo } : { descricao: '', numero: '', ativo: true }); };
  const abrirTipo = (t: TipoCatalogo) => { fechar(); setTipo({ id: t.id, grupo_id: String(t.grupo_id), numero: String(t.numero), ativo: t.ativo, codigo: t.codigo }); };
  const abrirItem = (t: TipoCatalogo, i?: ItemCatalogo) => { fechar(); setItem(i ? { id: i.id, tipo_id: t.id, complemento: i.complemento, ativo: i.ativo } : { tipo_id: t.id, complemento: '', ativo: true }); };
  const tipoDoItem = item && grupos.flatMap((g) => g.tipos).find((t) => t.id === item.tipo_id);
  const grupoDestino = grupos.find((g) => String(g.id) === destino);

  // aba PQ: filtro mantém os títulos acima dos itens que casam
  const linhas = pq.data?.linhas ?? [];
  const visiveis = useMemo(() => {
    const t = q.trim().toLowerCase();
    const casa = (l: LinhaPq) => l.folha && (!soLivres || !l.tipo) && (!t || l.item.startsWith(t) || l.descricao.toLowerCase().includes(t) || (l.codigo_atividade ?? '').toLowerCase().includes(t));
    if (!t && !soLivres) return linhas;
    const manter = new Set<string>();
    for (const l of linhas) if (casa(l)) { const p = l.item.split('.'); for (let i = 1; i <= p.length; i++) manter.add(p.slice(0, i).join('.')); }
    return linhas.filter((l) => manter.has(l.item));
  }, [linhas, q, soLivres]);
  const escondido = (l: LinhaPq) => { const p = l.item.split('.'); for (let i = 1; i < p.length; i++) if (fechados.has(p.slice(0, i).join('.'))) return true; return false; };
  const alternar = (it: string) => setFechados((s) => { const n = new Set(s); if (n.has(it)) n.delete(it); else n.add(it); return n; });
  const marcar = (it: string) => setSel((s) => { const n = new Set(s); if (n.has(it)) n.delete(it); else n.add(it); return n; });

  return (
    <>
      <Cabecalho
        eyebrow="Cadastros · catálogo de atividades"
        cor="var(--m-proc-medir)"
        titulo={grupos.length ? `${grupos.length} grupos e ${nTipos} itens da PQ no catálogo` : 'Catálogo vazio'}
        descricao="O encarregado escolhe o Grupo (ex.: 2 Concreto) e o item da PQ, que é o tipo da atividade (2.3 = item 1.8.3.1.2). Um grupo reúne um ou vários itens da PQ. O texto complementar cria um item com ID próprio no Simova (2.3.1 Nome simplificado - (Fundo canaleta 2A)). No Simova vai o nome simplificado do item da PQ (coluna na aba PQ abaixo); sem ele, a descrição da PQ."
        acoes={<Botao variante="secundario" onClick={() => api.download('/simova/cadastros.xlsx', 'cadastros-simova.xlsx').catch((e) => toast.error(e.message))}><Download size={16} /> Cadastros p/ Simova</Botao>}
      />

      {(grupo || tipo || item) && (
        <Painel titulo={grupo ? (grupo.id ? 'Editar grupo' : 'Novo grupo') : tipo ? `Mover ou renumerar ${tipo.codigo}` : item?.id ? 'Editar item complementar' : 'Novo item complementar'}>
          {grupo && (
            <form className="grid gap-3 md:grid-cols-[110px_1fr_auto_auto]" onSubmit={(e) => { e.preventDefault(); salvarGrupo.mutate(grupo, { onSuccess: () => { toast.success('Grupo salvo'); fechar(); } }); }}>
              <Campo rotulo="Número" placeholder="auto" inputMode="numeric" value={grupo.numero} onChange={(e) => setGrupo({ ...grupo, numero: e.target.value })} />
              <Campo rotulo="Descrição" required placeholder="Concreto" value={grupo.descricao} onChange={(e) => setGrupo({ ...grupo, descricao: e.target.value })} />
              <label className="flex items-end gap-2 pb-2.5 text-[13px] text-m-text-secondary"><input type="checkbox" checked={grupo.ativo} onChange={(e) => setGrupo({ ...grupo, ativo: e.target.checked })} /> Ativo</label>
              <div className="flex items-end gap-2"><Botao type="submit">Salvar</Botao><Botao type="button" variante="secundario" onClick={fechar}>Cancelar</Botao></div>
              <div className="md:col-span-4"><Erro erro={salvarGrupo.error} /></div>
            </form>
          )}
          {tipo && (
            <form className="grid gap-3 md:grid-cols-[1fr_110px_auto_auto]" onSubmit={(e) => { e.preventDefault(); salvarTipo.mutate(tipo, { onSuccess: () => { toast.success('Atualizado: o ID Simova segue o grupo e o número'); fechar(); } }); }}>
              <Selecao rotulo="Grupo" value={tipo.grupo_id} onChange={(e) => setTipo({ ...tipo, grupo_id: e.target.value, numero: '' })}>
                {grupos.map((g) => <option key={g.id} value={g.id}>{g.codigo} · {g.descricao}</option>)}
              </Selecao>
              <Campo rotulo="Número" placeholder="mantém" inputMode="numeric" value={tipo.numero} onChange={(e) => setTipo({ ...tipo, numero: e.target.value })} />
              <label className="flex items-end gap-2 pb-2.5 text-[13px] text-m-text-secondary"><input type="checkbox" checked={tipo.ativo} onChange={(e) => setTipo({ ...tipo, ativo: e.target.checked })} /> Ativo</label>
              <div className="flex items-end gap-2"><Botao type="submit">Salvar</Botao><Botao type="button" variante="secundario" onClick={fechar}>Cancelar</Botao></div>
              <div className="md:col-span-4"><Erro erro={salvarTipo.error} /></div>
            </form>
          )}
          {item && (
            <form className="grid gap-3 md:grid-cols-[2fr_auto]" onSubmit={(e) => {
              e.preventDefault();
              salvarItem.mutate(item, { onSuccess: (r) => {
                const resp = r as { criado?: boolean; aviso?: string | null } | undefined;
                if (resp?.aviso) toast.warning(resp.aviso); else toast.success(resp?.criado === false ? 'Item já existia' : 'Item salvo');
                fechar();
              } });
            }}>
              <Campo rotulo={`Texto complementar de ${tipoDoItem?.codigo} (${tipoDoItem?.item_pq ?? ''})`} required placeholder="Fundo canaleta 2A" value={item.complemento} onChange={(e) => setItem({ ...item, complemento: e.target.value })} />
              <div className="flex items-end gap-2"><Botao type="submit">Salvar</Botao><Botao type="button" variante="secundario" onClick={fechar}>Cancelar</Botao></div>
              {item.complemento && <p className="text-[13px] text-m-text-secondary md:col-span-2">No Simova: <b className="text-m-text-primary">{tipoDoItem?.descricao} - ({item.complemento.trim()})</b></p>}
              <div className="md:col-span-2"><Erro erro={salvarItem.error} /></div>
            </form>
          )}
        </Painel>
      )}

      <Painel
        titulo="Quais atividades o encarregado pode escolher?"
        subtitulo="Cada grupo reúne itens da PQ. Mover de grupo ou renumerar muda o ID Simova em todas as programações abertas."
        acoes={editar && <Botao variante="secundario" onClick={() => abrirGrupo()}><Plus size={16} /> Grupo</Botao>}
      >
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full border-collapse">
            <thead><tr className="text-left">
              <th className={th}>ID Simova</th><th className={th}>Item PQ</th><th className={th}>Descrição no Simova</th><th className={th}>Un.</th>
              <th className={`${th} text-right`}>Qtd. contrato</th><th className={`${th} text-right`}>P. unit.</th><th className={th}>Situação</th><th className={th} />
            </tr></thead>
            <tbody>
              {!grupos.length && <tr><td colSpan={8} className="py-8 text-center text-sm text-m-text-muted">{cat.isLoading ? 'Carregando…' : 'Crie o primeiro grupo (ex.: Escavação, Concreto, Forma) e vincule os itens da PQ.'}</td></tr>}
              {grupos.map((g) => (
                <Fragment key={`g${g.id}`}>
                  <tr>
                    <td colSpan={8} className="bg-m-surface-active px-3 py-2.5 text-xs font-bold uppercase tracking-[0.3px] text-m-text-primary">
                      {g.codigo} · {g.descricao}{!g.ativo && ' (inativo)'} <span className="ml-1 font-medium normal-case text-m-text-muted">{g.tipos.length} item(ns)</span>
                      {editar && <span className="ml-3 inline-flex items-center gap-1 align-middle">
                        <button type="button" aria-label={`Editar grupo ${g.codigo}`} className="rounded p-1 text-m-text-muted hover:text-m-accent" onClick={() => abrirGrupo(g)}><Pencil size={13} /></button>
                        <button type="button" className="rounded px-1.5 py-0.5 text-[11px] font-semibold normal-case text-m-accent hover:underline" onClick={() => { setDestino(String(g.id)); document.getElementById('aba-pq')?.scrollIntoView({ behavior: 'smooth' }); }}><Link2 size={12} className="mr-1 inline" />vincular itens da PQ</button>
                        {!g.tipos.length && <button type="button" aria-label={`Excluir grupo ${g.codigo}`} className="rounded p-1 text-m-text-muted hover:text-m-danger" onClick={async () => (await confirmar({ titulo: `Excluir o grupo ${g.codigo} · ${g.descricao}?`, mensagem: 'O grupo está vazio (sem itens da PQ).' })) && excluirGrupo.mutate(g.id, { onSuccess: () => toast.success('Grupo excluído'), onError: (e) => toast.error(e.message) })}><Trash2 size={13} /></button>}
                      </span>}
                    </td>
                  </tr>
                  {g.tipos.map((t) => (
                    <Fragment key={`t${t.id}`}>
                      <tr className={t.ativo ? '' : 'opacity-50'}>
                        <td className={`${tdc} font-semibold text-m-text-primary`}>{t.codigo}</td>
                        <td className={tdc}>{t.item_pq ? <span className="rounded-[6px] bg-m-info-subtle px-2 py-0.5 text-[11px] font-semibold text-m-info">{t.item_pq}</span> : <Pilula tom="atencao">sem PQ</Pilula>}</td>
                        <td className={`${tdc} min-w-[320px] whitespace-normal`}>{t.nome_simplificado ? <><b className="text-m-text-primary">{t.nome_simplificado}</b><div className="text-[11px] text-m-text-muted">PQ: {t.descricao_pq}</div></> : t.descricao}{!t.na_pq_vigente && <div className="text-[11px] text-m-warning">não está na PQ vigente</div>}</td>
                        <td className={tdc}>{t.unidade ?? '—'}</td>
                        <td className={`${tdc} text-right`}>{t.quantidade_pq != null ? fmt(t.quantidade_pq) : '—'}</td>
                        <td className={`${tdc} text-right`}>{t.pu != null ? fmt(t.pu) : '—'}</td>
                        <td className={tdc}><Pilula tom={t.ativo ? 'sucesso' : 'neutro'}>{t.ativo ? 'Ativo' : 'Inativo'}</Pilula></td>
                        <td className={`${tdc} whitespace-nowrap text-right`}>
                          {editar && <>
                            <button type="button" aria-label={`Novo complemento em ${t.codigo}`} title="Texto complementar (novo ID)" className="p-1.5 text-m-text-muted hover:text-m-accent" onClick={() => abrirItem(t)}><Plus size={15} /></button>
                            <button type="button" aria-label={`Mover ${t.codigo}`} title="Mover de grupo / renumerar / inativar" className="p-1.5 text-m-text-muted hover:text-m-accent" onClick={() => abrirTipo(t)}><Pencil size={15} /></button>
                            <button type="button" aria-label={`Desvincular ${t.codigo}`} title="Desvincular do grupo" className="p-1.5 text-m-text-muted hover:text-m-danger" onClick={async () => (await confirmar({ titulo: `Desvincular ${t.codigo} (${t.item_pq ?? ''}) do grupo?`, mensagem: <>{t.descricao}<br />Os itens complementares deste tipo também saem. Tipo usado em programação não pode ser desvinculado: inative-o.</>, acao: 'Desvincular' })) && desvincular.mutate(t.id, { onSuccess: () => toast.success(`${t.codigo} desvinculado`), onError: (e) => toast.error(e.message) })}><Unlink size={15} /></button>
                          </>}
                        </td>
                      </tr>
                      {t.itens.map((i) => (
                        <tr key={`i${i.id}`} className={i.ativo ? '' : 'opacity-50'}>
                          <td className={`${tdc} pl-6 text-m-text-secondary`}>{i.codigo}</td>
                          <td className={tdc} />
                          <td className={`${tdc} whitespace-normal pl-6 text-m-text-secondary`}>… - ({i.complemento})</td>
                          <td className={tdc} colSpan={3} />
                          <td className={tdc}><Pilula tom={i.ativo ? 'sucesso' : 'neutro'}>{i.ativo ? 'Ativo' : 'Inativo'}</Pilula></td>
                          <td className={`${tdc} text-right`}>{editar && <button type="button" aria-label={`Editar item ${i.codigo}`} className="p-1.5 text-m-text-muted hover:text-m-accent" onClick={() => abrirItem(t, i)}><Pencil size={15} /></button>}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <Erro erro={desvincular.error ?? excluirGrupo.error} />
      </Painel>

      <div id="aba-pq" />
      <Painel
        titulo="Aba PQ do contrato"
        subtitulo={pq.data?.versao ? `${pq.data.versao.rotulo}${pq.data.versao.arquivo ? ` · ${pq.data.versao.arquivo}` : ''} · ${linhas.filter((l) => l.folha).length} itens em ${linhas.filter((l) => !l.folha).length} títulos` : 'Nenhuma PQ importada'}
        acoes={editar && <div className="flex flex-wrap items-end gap-2">
          <Botao variante={nNomes ? 'primario' : 'secundario'} disabled={!nNomes || salvarNomes.isPending} onClick={() => salvarNomes.mutate(nomes, { onSuccess: (r) => { toast.success(`${r.salvos} nome(s) simplificado(s) salvo(s)`); setNomes({}); } })}><Save size={16} /> Salvar nomes{nNomes ? ` (${nNomes})` : ''}</Botao>
          <Selecao rotulo="Vincular selecionados ao grupo" value={destino} onChange={(e) => setDestino(e.target.value)} className="min-w-[220px]">
            <option value="">Escolha o grupo…</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.codigo} · {g.descricao}</option>)}
          </Selecao>
          <Botao disabled={!sel.size || !grupoDestino || vincular.isPending} onClick={() => grupoDestino && vincular.mutate({ gid: grupoDestino.id, itens: [...sel] }, {
            onSuccess: (r) => { if (r.criados.length) toast.success(`${r.criados.length} item(ns) vinculado(s): ${r.criados.join(', ')}`); r.avisos.slice(0, 4).forEach((a) => toast.warning(a)); setSel(new Set()); },
          })}><Link2 size={16} /> Vincular {sel.size || ''}</Botao>
        </div>}
      >
        {!pq.data?.versao && !pq.isLoading && <p className="text-sm text-m-text-secondary">Importe a PQ do contrato (abas PQ e MC) em <Link href="/app/importacoes" className="font-semibold text-m-accent">Importações</Link>.</p>}
        {!!linhas.length && <>
          <div className="flex flex-wrap items-end gap-2">
            <Campo rotulo="Buscar na PQ" placeholder="item, descrição ou código da atividade" value={q} onChange={(e) => setQ(e.target.value)} className="w-[320px]" />
            <Chip ativo={soLivres} onClick={() => setSoLivres(!soLivres)}>Só itens sem grupo</Chip>
            <Chip ativo={false} onClick={() => setFechados(fechados.size ? new Set() : new Set(linhas.filter((l) => l.nivel === 1).map((l) => l.item)))}>{fechados.size ? 'Abrir tudo' : 'Recolher no nível 1'}</Chip>
            {sel.size > 0 && <Chip ativo={false} onClick={() => setSel(new Set())}>Limpar seleção ({sel.size})</Chip>}
          </div>
          <div className="-mx-1 max-h-[70vh] overflow-auto px-1">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-m-surface-raised">
                <tr>
                  <th colSpan={4} />
                  <th colSpan={2} className="rounded-t-[8px] bg-m-surface-active px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-secondary">Medição</th>
                  <th colSpan={3} className="rounded-t-[8px] bg-m-accent-subtle px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.4px] text-m-accent">Contratado</th>
                  <th />
                </tr>
                <tr className="text-left">
                  <th className={th} /><th className={th}>Item</th><th className={th}>Descrição das atividades</th>
                  <th className={th}>Nome simplificado (Simova)</th>
                  <th className={th}>Un.</th><th className={th}>CMS · cód. atividade</th>
                  <th className={`${th} text-right`}>Qtd.</th><th className={`${th} text-right`}>P. unit. (R$)</th><th className={`${th} text-right`}>Total (R$)</th>
                  <th className={th}>Grupo (catálogo)</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.filter((l) => !escondido(l)).map((l) => l.folha ? (
                  <tr key={l.item} className={sel.has(l.item) ? 'bg-m-accent-subtle' : ''}>
                    <td className={`${tdc} w-8`}>{editar && !l.tipo && <input type="checkbox" aria-label={`Selecionar ${l.item}`} checked={sel.has(l.item)} onChange={() => marcar(l.item)} />}</td>
                    <td className={`${tdc} whitespace-nowrap font-semibold text-m-text-primary`}>{l.item}</td>
                    <td className={`${tdc} min-w-[300px] whitespace-normal`}>{l.descricao}</td>
                    <td className={`${tdc} min-w-[220px]`}>
                      {editar ? (() => {
                        const v = nomes[l.item] ?? l.nome_simplificado ?? '';
                        const mudou = l.item in nomes;
                        return <input aria-label={`Nome simplificado de ${l.item}`} maxLength={120} value={v} placeholder="escreva o nome curto"
                          onChange={(e) => setNomes((n) => { const x = { ...n }; if (e.target.value === (l.nome_simplificado ?? '')) delete x[l.item]; else x[l.item] = e.target.value; return x; })}
                          className={`h-8 w-full rounded-[8px] border bg-m-surface-field px-2 text-[12.5px] outline-none focus:border-m-accent ${mudou ? 'border-m-accent bg-m-accent-subtle/40' : 'border-m-stroke'}`} />;
                      })() : (l.nome_simplificado ?? <span className="text-m-text-muted">—</span>)}
                    </td>
                    <td className={tdc}>{l.unid}</td>
                    <td className={`${tdc} whitespace-nowrap`}>{l.criterio && <span className="rounded-[6px] bg-m-info-subtle px-2 py-0.5 text-[11px] font-semibold text-m-info">{l.criterio}</span>}<div className="mt-0.5 text-[11px] text-m-text-muted">{l.codigo_atividade}</div></td>
                    <td className={`${tdc} text-right`}>{fmt(l.quantidade)}</td>
                    <td className={`${tdc} text-right`}>{fmt(l.pu)}</td>
                    <td className={`${tdc} text-right font-semibold`}>{l.total != null ? <Calculado chave="total" memoria={() => {
                      const conta = l.quantidade != null && l.pu != null ? l.quantidade * l.pu : null;
                      const daColuna = conta == null || Math.abs(conta - (l.total ?? 0)) > 0.01;
                      return { chave: 'total', titulo: `Total contratado do item ${l.item}`, valor: `R$ ${nbr(l.total)}`,
                        formula: 'total = quantidade × preço unitário',
                        passos: conta != null ? [{ descricao: l.descricao, conta: `${nbr(l.quantidade, 4)} ${l.unid ?? ''} × R$ ${nbr(l.pu, 4)}`, resultado: `R$ ${nbr(conta)}`, destaque: true }] : [],
                        fontes: [{ dado: 'Quantidade', valor: `${nbr(l.quantidade, 4)} ${l.unid ?? ''}`, origem: `PQ vigente · ${pq.data?.versao?.rotulo ?? ''}`, local: `aba PQ · item ${l.item} · coluna Qtd.` },
                          { dado: 'Preço unitário', valor: `R$ ${nbr(l.pu, 4)}`, origem: `PQ vigente · ${pq.data?.versao?.arquivo ?? ''}`, local: `aba PQ · item ${l.item} · coluna P. unit.` },
                          { dado: 'Total', valor: `R$ ${nbr(l.total)}`, origem: 'PQ vigente', local: `aba PQ · item ${l.item} · coluna Total` }],
                        notas: daColuna && conta != null ? [`A coluna Total da PQ (R$ ${nbr(l.total)}) difere de quantidade × preço (R$ ${nbr(conta)}): vale a da planilha.`] : [],
                      };
                    }}>{fmt(l.total)}</Calculado> : '—'}</td>
                    <td className={`${tdc} whitespace-nowrap`}>
                      {l.tipo && <span title={l.tipo.grupo} className="mr-1.5 rounded-[6px] bg-m-accent-subtle px-2 py-0.5 text-[11px] font-semibold text-m-accent">{l.tipo.codigo}</span>}
                      {editar ? (
                        <select aria-label={`Grupo do item ${l.item}`} value={l.tipo?.grupo_id ?? ''} disabled={grupoDoItem.isPending} onChange={(e) => mudarGrupo(l, e.target.value)}
                          className="h-8 max-w-[170px] rounded-[8px] border border-m-stroke bg-m-surface-field px-1.5 text-[12px]">
                          <option value="">{l.tipo ? '— desvincular —' : 'sem grupo'}</option>
                          {grupos.map((g) => <option key={g.id} value={g.id}>{g.codigo} · {g.descricao}</option>)}
                        </select>
                      ) : !l.tipo && <span className="text-[11px] text-m-text-muted">—</span>}
                    </td>
                  </tr>
                ) : (
                  <tr key={l.item}>
                    <td colSpan={10} className={`border-b border-m-row px-2 py-2 text-[12px] ${NIVEL[l.nivel] ?? ''}`} style={{ paddingLeft: 8 + (l.nivel - 1) * 14 }}>
                      <button type="button" className="inline-flex items-center gap-1 text-left" onClick={() => alternar(l.item)} aria-label={`${fechados.has(l.item) ? 'Abrir' : 'Recolher'} ${l.item}`}>
                        {fechados.has(l.item) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}{l.item} · {l.descricao}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}
        <Erro erro={vincular.error ?? salvarNomes.error} />
      </Painel>
    </>
  );
}
