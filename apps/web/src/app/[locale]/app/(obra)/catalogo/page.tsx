'use client';

import { Download, Pencil, Plus } from 'lucide-react';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { Botao, Cabecalho, Campo, Erro, Painel, Pilula, Selecao, Tabela, td } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { k, useAcao, useCatalogo } from '@/hooks/programacao/planejamento';
import type { GrupoCatalogo, ItemCatalogo, TipoCatalogo } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';

type GrupoForm = { id?: number; descricao: string; numero: string; ativo: boolean };
type TipoForm = { id?: number; grupo_id: string; descricao: string; unidade: string; numero: string; itens_pq: string; ativo: boolean };
type ItemForm = { id?: number; tipo_id: number; complemento: string; item_pq: string; ativo: boolean };

const num = (v: string) => (v.trim() ? Number(v) : null);
const listaPq = (v: string) => v.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);

export default function CatalogoPage() {
  const cat = useCatalogo();
  const api = useApi();
  const { pode } = useObra();
  const inv = [[...k.catalogo], ['programacao']];
  const [grupo, setGrupo] = useState<GrupoForm | null>(null);
  const [tipo, setTipo] = useState<TipoForm | null>(null);
  const [item, setItem] = useState<ItemForm | null>(null);
  const editar = pode('planejador');

  const salvarGrupo = useAcao((a, d: GrupoForm) => {
    const corpo = { descricao: d.descricao, numero: num(d.numero), ativo: d.ativo };
    return d.id ? a.put(`/catalogo/grupos/${d.id}`, corpo) : a.post('/catalogo/grupos', corpo);
  }, inv);
  const salvarTipo = useAcao((a, d: TipoForm) => {
    const corpo = { grupo_id: Number(d.grupo_id), descricao: d.descricao, unidade: d.unidade || null, numero: num(d.numero), ativo: d.ativo, itens_pq: listaPq(d.itens_pq) };
    return d.id ? a.put(`/catalogo/tipos/${d.id}`, corpo) : a.post('/catalogo/tipos', corpo);
  }, inv);
  const salvarItem = useAcao((a, d: ItemForm) => {
    const corpo = { tipo_id: d.tipo_id, complemento: d.complemento, item_pq: d.item_pq || null, ativo: d.ativo };
    return d.id ? a.put(`/catalogo/itens/${d.id}`, corpo) : a.post<{ criado: boolean; aviso: string | null }>('/catalogo/itens', corpo);
  }, inv);

  const grupos = cat.data ?? [];
  const nTipos = grupos.reduce((s, g) => s + g.tipos.length, 0);
  const fechar = () => { setGrupo(null); setTipo(null); setItem(null); };
  const abrirGrupo = (g?: GrupoCatalogo) => { fechar(); setGrupo(g ? { id: g.id, descricao: g.descricao, numero: String(g.numero), ativo: g.ativo } : { descricao: '', numero: '', ativo: true }); };
  const abrirTipo = (t?: TipoCatalogo, grupoId?: number) => {
    fechar();
    setTipo(t
      ? { id: t.id, grupo_id: String(t.grupo_id), descricao: t.descricao, unidade: t.unidade ?? '', numero: String(t.numero), itens_pq: t.itens_pq.join(', '), ativo: t.ativo }
      : { grupo_id: String(grupoId ?? grupos[0]?.id ?? ''), descricao: '', unidade: '', numero: '', itens_pq: '', ativo: true });
  };
  const abrirItem = (t: TipoCatalogo, i?: ItemCatalogo) => { fechar(); setItem(i ? { id: i.id, tipo_id: t.id, complemento: i.complemento, item_pq: i.item_pq ?? '', ativo: i.ativo } : { tipo_id: t.id, complemento: '', item_pq: t.itens_pq[0] ?? '', ativo: true }); };
  const tipoDoItem = item && grupos.flatMap((g) => g.tipos).find((t) => t.id === item.tipo_id);

  return (
    <>
      <Cabecalho
        eyebrow="Cadastros · catálogo de atividades"
        cor="var(--m-proc-medir)"
        titulo={grupos.length ? `${grupos.length} grupos e ${nTipos} tipos de atividade` : 'Catálogo vazio'}
        descricao="O que o encarregado escolhe: Grupo (ex.: 2 Concreto) → Tipo (2.3 Concreto 20 MPa). O texto complementar cria um item com ID próprio no Simova (2.3.1 Concreto 20 MPa - (Fundo canaleta 2A)). Cada tipo aponta os itens de PQ que pode consumir, para rastrear a programação até o contrato."
        acoes={<Botao variante="secundario" onClick={() => api.download('/simova/cadastros.xlsx', 'cadastros-simova.xlsx').catch((e) => toast.error(e.message))}><Download size={16} /> Cadastros p/ Simova</Botao>}
      />

      {(grupo || tipo || item) && (
        <Painel titulo={grupo ? (grupo.id ? 'Editar grupo' : 'Novo grupo') : tipo ? (tipo.id ? 'Editar tipo' : 'Novo tipo') : item?.id ? 'Editar item complementar' : 'Novo item complementar'}>
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
            <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_90px_2fr_100px]" onSubmit={(e) => { e.preventDefault(); salvarTipo.mutate(tipo, { onSuccess: () => { toast.success('Tipo salvo'); fechar(); } }); }}>
              <Selecao rotulo="Grupo" required value={tipo.grupo_id} onChange={(e) => setTipo({ ...tipo, grupo_id: e.target.value })}>
                {grupos.map((g) => <option key={g.id} value={g.id}>{g.codigo} · {g.descricao}</option>)}
              </Selecao>
              <Campo rotulo="Número" placeholder="auto" inputMode="numeric" value={tipo.numero} onChange={(e) => setTipo({ ...tipo, numero: e.target.value })} />
              <Campo rotulo="Descrição" required placeholder="Concreto 20 MPa" value={tipo.descricao} onChange={(e) => setTipo({ ...tipo, descricao: e.target.value })} />
              <Campo rotulo="Unidade" placeholder="m³" value={tipo.unidade} onChange={(e) => setTipo({ ...tipo, unidade: e.target.value })} />
              <div className="md:col-span-2 xl:col-span-3">
                <Campo rotulo="Itens de PQ permitidos (separe por vírgula)" placeholder="3.2.1, 3.2.4" value={tipo.itens_pq} onChange={(e) => setTipo({ ...tipo, itens_pq: e.target.value })} />
              </div>
              <label className="flex items-end gap-2 pb-2.5 text-[13px] text-m-text-secondary"><input type="checkbox" checked={tipo.ativo} onChange={(e) => setTipo({ ...tipo, ativo: e.target.checked })} /> Ativo</label>
              <div className="flex items-center gap-2 md:col-span-2 xl:col-span-4"><Botao type="submit">Salvar</Botao><Botao type="button" variante="secundario" onClick={fechar}>Cancelar</Botao><Erro erro={salvarTipo.error} /></div>
            </form>
          )}
          {item && (
            <form className="grid gap-3 md:grid-cols-[2fr_1fr_auto]" onSubmit={(e) => {
              e.preventDefault();
              salvarItem.mutate(item, { onSuccess: (r) => {
                const resp = r as { criado?: boolean; aviso?: string | null } | undefined;
                if (resp?.aviso) toast.warning(resp.aviso); else toast.success(resp?.criado === false ? 'Item já existia' : 'Item salvo');
                fechar();
              } });
            }}>
              <Campo rotulo={`Texto complementar de ${tipoDoItem?.codigo} ${tipoDoItem?.descricao}`} required placeholder="Fundo canaleta 2A" value={item.complemento} onChange={(e) => setItem({ ...item, complemento: e.target.value })} />
              <Campo rotulo="Item de PQ" list="pq-tipo" placeholder="3.2.1" value={item.item_pq} onChange={(e) => setItem({ ...item, item_pq: e.target.value })} />
              <datalist id="pq-tipo">{tipoDoItem?.itens_pq.map((p) => <option key={p} value={p} />)}</datalist>
              <div className="flex items-end gap-2"><Botao type="submit">Salvar</Botao><Botao type="button" variante="secundario" onClick={fechar}>Cancelar</Botao></div>
              {item.complemento && <p className="text-[13px] text-m-text-secondary md:col-span-3">No Simova: <b className="text-m-text-primary">{tipoDoItem?.descricao} - ({item.complemento.trim()})</b></p>}
              <div className="md:col-span-3"><Erro erro={salvarItem.error} /></div>
            </form>
          )}
        </Painel>
      )}

      <Painel
        titulo="Quais atividades o encarregado pode escolher?"
        subtitulo="Renomear um tipo muda a descrição em todas as programações e na próxima exportação para o Simova; o ID (g.t.n) não muda."
        acoes={editar && <>
          <Botao variante="secundario" onClick={() => abrirGrupo()}><Plus size={16} /> Grupo</Botao>
          <Botao disabled={!grupos.length} onClick={() => abrirTipo()}><Plus size={16} /> Tipo</Botao>
        </>}
      >
        <Tabela cabecalho={['ID Simova', 'Atividade', 'Unid.', 'Itens de PQ', 'Situação', '']} vazio={!grupos.length && (cat.isLoading ? 'Carregando…' : 'Crie o primeiro grupo (ex.: Escavação, Concreto, Forma).')}>
          {grupos.map((g) => (
            <Fragment key={`g${g.id}`}>
              <tr>
                <td colSpan={6} className="bg-m-accent-strong px-3 py-1.5 text-xs font-bold uppercase tracking-[0.4px] text-m-on-accent">
                  {g.codigo} · {g.descricao}{!g.ativo && ' (inativo)'}
                  {editar && <>
                    <button type="button" aria-label={`Editar grupo ${g.codigo}`} className="ml-3 align-middle opacity-80 hover:opacity-100" onClick={() => abrirGrupo(g)}><Pencil size={13} /></button>
                    <button type="button" aria-label={`Novo tipo em ${g.codigo}`} className="ml-2 align-middle opacity-80 hover:opacity-100" onClick={() => abrirTipo(undefined, g.id)}><Plus size={14} /></button>
                  </>}
                </td>
              </tr>
              {g.tipos.map((t) => (
                <Fragment key={`t${t.id}`}>
                  <tr className={t.ativo ? '' : 'opacity-50'}>
                    <td className={td}><b className="text-m-text-primary">{t.codigo}</b></td>
                    <td className={td}><span className="font-semibold text-m-text-primary">{t.descricao}</span></td>
                    <td className={td}>{t.unidade ?? '—'}</td>
                    <td className={td}>{t.itens_pq.length ? t.itens_pq.join(', ') : <span className="text-m-text-muted">nenhum</span>}</td>
                    <td className={td}><Pilula tom={t.ativo ? 'sucesso' : 'neutro'}>{t.ativo ? 'Ativo' : 'Inativo'}</Pilula></td>
                    <td className={`${td} whitespace-nowrap text-right`}>
                      {editar && <>
                        <button type="button" aria-label={`Editar tipo ${t.codigo}`} className="p-1.5 text-m-text-muted hover:text-m-accent" onClick={() => abrirTipo(t)}><Pencil size={15} /></button>
                        <button type="button" aria-label={`Novo complemento em ${t.codigo}`} className="p-1.5 text-m-text-muted hover:text-m-accent" onClick={() => abrirItem(t)}><Plus size={15} /></button>
                      </>}
                    </td>
                  </tr>
                  {t.itens.map((i) => (
                    <tr key={`i${i.id}`} className={i.ativo ? '' : 'opacity-50'}>
                      <td className={`${td} pl-6`}>{i.codigo}</td>
                      <td className={`${td} pl-6`}>{i.descricao}</td>
                      <td className={td}>{t.unidade ?? '—'}</td>
                      <td className={td}>{i.item_pq ?? '—'}</td>
                      <td className={td}><Pilula tom={i.ativo ? 'sucesso' : 'neutro'}>{i.ativo ? 'Ativo' : 'Inativo'}</Pilula></td>
                      <td className={`${td} text-right`}>
                        {editar && <button type="button" aria-label={`Editar item ${i.codigo}`} className="p-1.5 text-m-text-muted hover:text-m-accent" onClick={() => abrirItem(t, i)}><Pencil size={15} /></button>}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </Fragment>
          ))}
        </Tabela>
      </Painel>
    </>
  );
}
