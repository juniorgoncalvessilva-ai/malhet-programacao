'use client';

import { FileText, Paperclip, Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Botao, Campo, Chip, Erro, Painel, Pilula, Tabela, dataBR, td } from '@/components/Obra/ui';
import { k, useAcao, useCadastrosSsma, useEfetivo } from '@/hooks/programacao/planejamento';
import { useEquipes } from '@/hooks/programacao/queries';
import { useApi } from '@/hooks/programacao/useApi';
import type { CadastroSsma, TipoCadastroSsma } from '@/lib/api/types';
import { useConfirmar } from '@/components/Obra/Confirmar';

export const ROTULO_SSMA: Record<TipoCadastroSsma, { curto: string; longo: string; campo: string; exemplo: string }> = {
  TECNICO: { curto: 'Técnicos', longo: 'Técnico de segurança responsável', campo: 'Nome do técnico', exemplo: 'Ana Lima' },
  RAC: { curto: 'RAC', longo: 'RAC', campo: 'Número / identificação', exemplo: 'RAC 03 - Trabalho em altura' },
  PTS: { curto: 'PTS', longo: 'PTS', campo: 'Número / identificação', exemplo: 'PTS-0158' },
  ART: { curto: 'ART', longo: 'ART', campo: 'Número da ART', exemplo: 'ART/11/53' },
  ATA: { curto: 'ATA', longo: 'ATA (Autorização de Trabalho Ambiental)', campo: 'Número da ATA', exemplo: 'ATA-2026-014' },
  PTO: { curto: 'PTO', longo: 'PTO (Plano de Trabalho de Obra)', campo: 'Número do PTO', exemplo: 'PTO-001' },
};

/** Situação da validade: vencido, vence em até 15 dias ou ok. */
export function validade(c: CadastroSsma): { tom: 'perigo' | 'atencao' | 'sucesso'; texto: string } | null {
  if (!c.validade) return null;
  const dias = Math.round((new Date(`${c.validade}T00:00:00`).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime()) / 86400000);
  if (dias < 0) return { tom: 'perigo', texto: `vencido em ${dataBR(c.validade)}` };
  if (dias <= 15) return { tom: 'atencao', texto: `vence em ${dias} dia(s)` };
  return { tom: 'sucesso', texto: `até ${dataBR(c.validade)}` };
}

type Form = { id?: number; tipo: TipoCadastroSsma; codigo: string; descricao: string; validade: string; ativo: boolean };

/** Lista editável dos cadastros de SSMA/PTO (uma aba por tipo). */
export function CadastrosSsma({ tipos, podeEditar, titulo }: { tipos: TipoCadastroSsma[]; podeEditar: boolean; titulo: string }) {
  const confirmar = useConfirmar();
  const lista = useCadastrosSsma();
  const [tipo, setTipo] = useState<TipoCadastroSsma>(tipos[0]);
  const [form, setForm] = useState<Form | null>(null);
  const inv = [[...k.cadastrosSsma], ['programacao']];
  const salvar = useAcao((a, d: Form) => {
    const corpo = { tipo: d.tipo, codigo: d.codigo, descricao: d.descricao || null, validade: d.validade || null, ativo: d.ativo };
    return d.id ? a.put(`/ssma/cadastros/${d.id}`, corpo) : a.post('/ssma/cadastros', corpo);
  }, inv);
  const excluir = useAcao((a, id: number) => a.del(`/ssma/cadastros/${id}`), inv);
  const api = useApi();
  const qc = useQueryClient();
  const [enviando, setEnviando] = useState<number | null>(null);
  const anexar = async (c: CadastroSsma, arquivos: FileList | null) => {
    if (!arquivos?.length) return;
    setEnviando(c.id);
    let ok = 0;
    for (const f of Array.from(arquivos)) {
      const fd = new FormData();
      fd.append('arquivo', f);
      try { await api.post(`/ssma/cadastros/${c.id}/anexos`, fd); ok++; } catch (e) { toast.error(`${f.name}: ${(e as Error).message}`); }
    }
    setEnviando(null);
    if (ok) toast.success(`${ok} arquivo(s) anexado(s) a ${c.codigo}`);
    qc.invalidateQueries({ queryKey: k.cadastrosSsma });
  };
  const tiraAnexo = async (c: CadastroSsma, a: { id: number; nome: string }) => {
    await confirmar({
      titulo: `Excluir o arquivo ${a.nome}?`, mensagem: `Sai de ${ROTULO_SSMA[c.tipo].longo} ${c.codigo}. O item continua cadastrado.`,
      executar: async () => { await api.del(`/ssma/anexos/${a.id}`); toast.success('Arquivo excluído'); qc.invalidateQueries({ queryKey: k.cadastrosSsma }); },
    });
  };
  const tamanho = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
  const itens = (lista.data ?? []).filter((c) => c.tipo === tipo);
  const r = ROTULO_SSMA[tipo];
  const novo = () => setForm({ tipo, codigo: '', descricao: '', validade: '', ativo: true });
  const [time, setTime] = useState(false);

  return (
    <Painel titulo={titulo}
      acoes={podeEditar && <>
        {tipo === 'TECNICO' && <Botao variante="secundario" onClick={() => setTime(!time)}><Users size={16} /> Do time de segurança</Botao>}
        <Botao onClick={novo}><Plus size={16} /> {tipo === 'TECNICO' ? 'Técnico' : r.curto}</Botao>
      </>}>
      {tipo === 'TECNICO' && time && podeEditar && <TimeSeguranca aoFechar={() => setTime(false)} />}
      {tipos.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {tipos.map((t) => <Chip key={t} ativo={tipo === t} onClick={() => { setTipo(t); setForm(null); }}>{ROTULO_SSMA[t].curto} · {(lista.data ?? []).filter((c) => c.tipo === t && c.ativo).length}</Chip>)}
        </div>
      )}
      {form && (
        <form className="grid gap-3 rounded-m-lg border border-m-stroke-subtle p-3 md:grid-cols-[1.2fr_2fr_160px_auto_auto]" onSubmit={(e) => {
          e.preventDefault();
          salvar.mutate(form, { onSuccess: () => { toast.success(form.id ? 'Atualizado (as programações em rascunho acompanham)' : 'Cadastrado'); setForm(null); } });
        }}>
          <Campo rotulo={ROTULO_SSMA[form.tipo].campo} required placeholder={ROTULO_SSMA[form.tipo].exemplo} value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
          <Campo rotulo={form.tipo === 'TECNICO' ? 'Observação (registro, contato…)' : 'O que cobre (frente, atividade, empresa)'} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          <Campo rotulo="Validade" type="date" value={form.validade} onChange={(e) => setForm({ ...form, validade: e.target.value })} />
          <label className="flex items-end gap-2 pb-2.5 text-[13px] text-m-text-secondary"><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativo</label>
          <div className="flex items-end gap-2"><Botao type="submit" disabled={salvar.isPending}>Salvar</Botao><Botao type="button" variante="secundario" onClick={() => setForm(null)}>Cancelar</Botao></div>
          <div className="md:col-span-5"><Erro erro={salvar.error} /></div>
        </form>
      )}
      <Tabela cabecalho={[r.campo, 'Descrição', 'Validade', ...(tipo === 'TECNICO' ? [] : ['Arquivos (Excel, Word, PDF)']), 'Em uso', 'Situação', '']} vazio={!itens.length && (lista.isLoading ? 'Carregando…' : `Nenhum ${r.longo} cadastrado. "N/A" já está em toda lista.`)}>
        {itens.map((c) => {
          const v = validade(c);
          return (
            <tr key={c.id} className={c.ativo ? '' : 'opacity-50'}>
              <td className={td}><b className="text-m-text-primary">{c.codigo}</b></td>
              <td className={td}>{c.descricao ?? '—'}</td>
              <td className={td}>{v ? <Pilula tom={v.tom}>{v.texto}</Pilula> : '—'}</td>
              {c.aceita_anexo && (
                <td className={`${td} min-w-[220px]`}>
                  <div className="flex flex-col gap-1">
                    {c.anexos.map((a) => (
                      <span key={a.id} className="inline-flex items-center gap-1.5 text-[12.5px]">
                        <FileText size={14} className="shrink-0 text-m-text-muted" />
                        <button type="button" className="truncate text-left font-medium text-m-accent hover:underline" title={`Baixar ${a.nome}`}
                          onClick={() => api.download(`/ssma/anexos/${a.id}`, a.nome).catch((e) => toast.error(e.message))}>{a.nome}</button>
                        <span className="shrink-0 text-[11px] text-m-text-muted">{tamanho(a.tamanho)}</span>
                        {podeEditar && <button type="button" aria-label={`Excluir o arquivo ${a.nome}`} className="shrink-0 p-0.5 text-m-text-muted hover:text-m-danger" onClick={() => tiraAnexo(c, a)}><X size={13} /></button>}
                      </span>
                    ))}
                    {podeEditar && (
                      <label className={`inline-flex w-fit cursor-pointer items-center gap-1 text-[12px] font-semibold text-m-accent hover:underline ${enviando === c.id ? 'pointer-events-none opacity-60' : ''}`}>
                        <Paperclip size={13} />{enviando === c.id ? 'Enviando…' : c.anexos.length ? 'Anexar mais' : 'Anexar arquivo'}
                        <input type="file" multiple className="sr-only" accept=".pdf,.xls,.xlsx,.xlsm,.doc,.docx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          onChange={(e) => { anexar(c, e.target.files); e.target.value = ''; }} />
                      </label>
                    )}
                    {!podeEditar && !c.anexos.length && <span className="text-m-text-muted">—</span>}
                  </div>
                </td>
              )}
              <td className={td}>{c.em_uso ? `${c.em_uso} linha(s)` : '—'}</td>
              <td className={td}><Pilula tom={c.ativo ? 'sucesso' : 'neutro'}>{c.ativo ? 'Ativo' : 'Inativo'}</Pilula></td>
              <td className={`${td} whitespace-nowrap text-right`}>
                {podeEditar && <>
                  <button type="button" aria-label={`Editar ${c.codigo}`} className="p-1.5 text-m-text-muted hover:text-m-accent" onClick={() => setForm({ id: c.id, tipo: c.tipo, codigo: c.codigo, descricao: c.descricao ?? '', validade: c.validade ?? '', ativo: c.ativo })}><Pencil size={15} /></button>
                  <button type="button" aria-label={`Excluir ${c.codigo}`} title={c.em_uso ? 'Em uso: inative em vez de excluir' : 'Excluir'} className="p-1.5 text-m-text-muted hover:text-m-danger disabled:opacity-40" disabled={!!c.em_uso}
                    onClick={async () => (await confirmar({ titulo: `Excluir ${ROTULO_SSMA[c.tipo].longo} ${c.codigo}?`, mensagem: c.anexos?.length ? `Os ${c.anexos.length} arquivo(s) anexado(s) também serão excluídos.` : undefined })) && excluir.mutate(c.id, { onSuccess: () => toast.success('Excluído'), onError: (e) => toast.error(e.message) })}><Trash2 size={15} /></button>
                </>}
              </td>
            </tr>
          );
        })}
      </Tabela>
    </Painel>
  );
}

/** Alimenta a lista de técnicos com pessoas do efetivo (time da segurança) ou com uma equipe cadastrada inteira. */
function TimeSeguranca({ aoFechar }: { aoFechar: () => void }) {
  const efetivo = useEfetivo();
  const equipes = useEquipes();
  const [q, setQ] = useState('segur');
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [equipe, setEquipe] = useState('');
  const importar = useAcao((a, d: { colaboradores?: number[]; equipe_id?: number }) => a.post<{ incluidos: number; ja_existiam: number }>('/ssma/tecnicos/importar', d), [[...k.cadastrosSsma], ['programacao']]);
  const ok = (r: { incluidos: number; ja_existiam: number }) => { toast.success(`${r.incluidos} técnico(s) incluído(s)${r.ja_existiam ? ` · ${r.ja_existiam} já estavam na lista` : ''}`); setSel(new Set()); };
  const termo = q.trim().toLowerCase();
  const pessoas = (efetivo.data ?? []).filter((p) => !['DESMOBILIZADO', 'DESISTENCIA'].includes(p.situacao) && (!termo || `${p.nome} ${p.funcao ?? ''} ${p.matricula ?? ''}`.toLowerCase().includes(termo))).slice(0, 80);
  return (
    <div className="grid gap-4 rounded-m-lg border border-m-stroke-subtle p-3 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <Campo rotulo="Pessoas do efetivo (nome, função ou matrícula)" value={q} onChange={(e) => setQ(e.target.value)} className="w-[340px] max-w-full" />
          <Botao disabled={!sel.size || importar.isPending} onClick={() => importar.mutate({ colaboradores: [...sel] }, { onSuccess: ok, onError: (e) => toast.error(e.message) })}>Incluir {sel.size || ''} selecionado(s)</Botao>
        </div>
        <ul className="max-h-60 overflow-y-auto rounded-m-md border border-m-stroke-subtle">
          {!pessoas.length && <li className="px-3 py-4 text-[13px] text-m-text-muted">{efetivo.isLoading ? 'Carregando…' : 'Ninguém com esse filtro no efetivo.'}</li>}
          {pessoas.map((p) => (
            <li key={p.id} className="border-b border-m-row last:border-0">
              <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-m-surface-hover">
                <input type="checkbox" checked={sel.has(p.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} />
                <b className="text-m-text-primary">{p.nome}</b><span className="text-m-text-muted">{p.funcao ?? ''}{p.matricula ? ` · ${p.matricula}` : ''}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Ou a equipe de segurança inteira
          <select value={equipe} onChange={(e) => setEquipe(e.target.value)} className="h-10 rounded-m-md border border-m-stroke bg-m-surface-field px-2 text-[13px] font-normal normal-case tracking-normal text-m-text-primary">
            <option value="">Escolha a equipe…</option>
            {equipes.data?.map((e) => <option key={e.id} value={e.id}>{e.nome} · {e.encarregado_nome ?? 'sem encarregado'}</option>)}
          </select>
        </label>
        <Botao variante="secundario" disabled={!equipe || importar.isPending} onClick={() => importar.mutate({ equipe_id: Number(equipe) }, { onSuccess: ok, onError: (e) => toast.error(e.message) })}>Incluir encarregado e membros</Botao>
        <Botao variante="fantasma" onClick={aoFechar}><X size={14} /> Fechar</Botao>
      </div>
    </div>
  );
}
