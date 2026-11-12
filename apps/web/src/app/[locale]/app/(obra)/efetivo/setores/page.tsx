'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Crown, GitFork, Layers, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { SeletorCor } from '@/components/Obra/SeletorCor';
import { SeletorPessoa } from '@/components/Obra/SeletorPessoa';
import { Botao, Cabecalho, Campo, Erro, Painel } from '@/components/Obra/ui';
import { chaves } from '@/hooks/programacao/queries';
import { k, useSetores } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';
import type { CoresOrganograma, DisciplinaObra, NivelCor, PessoaRef, SetorObra } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';

type FormSetor = { tipo: 'setor' | 'disciplina'; id?: number; setorId?: number; nome: string; cor: string | null; ordem: number; responsavel: PessoaRef | null; equipes: number[] };
const NIVEIS: { v: NivelCor; rotulo: string }[] = [
  { v: 'obra', rotulo: 'Obra' }, { v: 'setor', rotulo: 'Setores' }, { v: 'disciplina', rotulo: 'Disciplinas' }, { v: 'frente', rotulo: 'Frentes' }, { v: 'area', rotulo: 'Áreas' }, { v: 'equipe', rotulo: 'Equipes' }, { v: 'funcao', rotulo: 'Funções' },
];

export default function SetoresPage() {
  const { pode, obra } = useObra();
  const editar = pode('planejador');
  const dados = useSetores();
  const api = useApi();
  const qc = useQueryClient();
  const confirmar = useConfirmar();
  const [form, setForm] = useState<FormSetor | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [geral, setGeral] = useState<PessoaRef | null>(null);
  const [cores, setCores] = useState<Partial<CoresOrganograma>>({});
  const [salvandoCfg, setSalvandoCfg] = useState(false);
  const [master, setMaster] = useState(false);
  const d = dados.data;
  useEffect(() => {
    if (!d) return;
    setGeral(d.responsavel_geral);
    setCores(Object.fromEntries(NIVEIS.filter((n) => d.cores[n.v] !== d.cores_padrao[n.v]).map((n) => [n.v, d.cores[n.v]])));
  }, [d]);
  const atualizar = () => { qc.invalidateQueries({ queryKey: k.efetivo }); qc.invalidateQueries({ queryKey: chaves.equipes }); };

  const salvarConfig = async () => {
    if (!geral && d?.responsavel_geral) { toast.error('O setor master não fica sem dono: escolha o novo responsável geral.'); return; }
    setSalvandoCfg(true);
    try {
      await api.put('/efetivo/organograma/config', { responsavel_id: geral?.id ?? null, cores });
      toast.success('Setor master salvo (responsável geral e cores)');
      setMaster(false);
      atualizar();
    } catch (e) { toast.error((e as Error).message); } finally { setSalvandoCfg(false); }
  };
  const salvarSetor = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form) return;
    const corpo = { nome: form.nome, cor: form.cor, ordem: form.ordem, responsavel_id: form.responsavel?.id ?? null, equipes: form.equipes };
    try {
      if (form.tipo === 'disciplina') {
        if (form.id) await api.put(`/efetivo/disciplinas/${form.id}`, corpo); else await api.post(`/efetivo/setores/${form.setorId}/disciplinas`, corpo);
      } else if (form.id) await api.put(`/efetivo/setores/${form.id}`, corpo); else await api.post('/efetivo/setores', corpo);
      toast.success(`${form.tipo === 'disciplina' ? 'Disciplina' : 'Setor'} ${form.nome} salvo`);
      setForm(null); setErro(null); atualizar();
    } catch (e) { setErro(e); }
  };
  const excluir = async (st: SetorObra) => {
    if (!(await confirmar({ titulo: `Excluir o setor ${st.nome}?`, mensagem: st.equipes.length ? `${st.equipes.length} equipe(s) ficam sem setor. As equipes e as pessoas não são apagadas.` : 'As equipes e as pessoas não são apagadas.' }))) return;
    try { await api.del(`/efetivo/setores/${st.id}`); toast.success('Setor excluído'); if (form?.id === st.id) setForm(null); atualizar(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const excluirDisciplina = async (dc: DisciplinaObra) => {
    if (!(await confirmar({ titulo: `Excluir a disciplina ${dc.nome}?`, mensagem: dc.equipes.length ? `${dc.equipes.length} equipe(s) continuam no setor, sem disciplina.` : 'Nenhuma equipe é apagada.' }))) return;
    try { await api.del(`/efetivo/disciplinas/${dc.id}`); toast.success('Disciplina excluída'); if (form?.tipo === 'disciplina' && form.id === dc.id) setForm(null); atualizar(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const abrir = (f: FormSetor) => { setErro(null); setMaster(false); setForm(f); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const novo = () => abrir({ tipo: 'setor', nome: '', cor: null, ordem: (d?.setores.length ?? 0) + 1, responsavel: null, equipes: [] });
  const novaDisciplina = (st: SetorObra) => abrir({ tipo: 'disciplina', setorId: st.id, nome: '', cor: null, ordem: st.disciplinas.length + 1, responsavel: null, equipes: [] });
  const nomeSetor = new Map(d?.setores.map((st) => [st.id, st.nome]) ?? []);
  const nomeDisciplina = new Map(d?.setores.flatMap((st) => st.disciplinas.map((x) => [x.id, x.nome] as const)) ?? []);
  const ondeEsta = (e: { setor_id: number | null; subsetor_id: number | null }) =>
    [e.setor_id ? nomeSetor.get(e.setor_id) : null, e.subsetor_id ? nomeDisciplina.get(e.subsetor_id) : null].filter(Boolean).join(' / ');
  const setorDoForm = form?.tipo === 'disciplina' ? d?.setores.find((x) => x.id === form.setorId) : undefined;
  
  return (
    <>
      <Cabecalho
        eyebrow="Efetivo · setores da obra"
        titulo="Setores, disciplinas, responsáveis e cores do organograma"
        acoes={<div className="flex gap-2">
          <Link href="/app/efetivo/organograma"><Botao variante="secundario"><GitFork size={16} /> Ver organograma</Botao></Link>
          {editar && <Botao variante="secundario" onClick={novo}><Plus size={16} /> Novo setor</Botao>}
        </div>}
      />
      <div className="flex flex-col gap-4">
        {master && editar && (
          <Painel titulo={<span className="inline-flex items-center gap-2"><Crown size={17} className="text-m-accent" />Setor master · {obra?.nome ?? 'Obra'}</span>}
            acoes={<Botao variante="fantasma" onClick={() => { setMaster(false); if (d) { setGeral(d.responsavel_geral); } }}>Cancelar</Botao>}>
            <div className="grid gap-4 lg:grid-cols-[minmax(280px,420px)_1fr]">
              <SeletorPessoa rotulo="Responsável geral da obra (dono do setor master)" valor={geral} onChange={setGeral} />
              <div className="grid gap-3 sm:grid-cols-2">
                {NIVEIS.map((n) => (
                  <SeletorCor key={n.v} rotulo={`Cor · ${n.rotulo}`} valor={cores[n.v] ?? null} padrao={d?.cores_padrao[n.v]}
                    onChange={(c) => setCores((x) => { const y = { ...x }; if (c) y[n.v] = c; else delete y[n.v]; return y; })} />
                ))}
              </div>
            </div>
            <div><Botao disabled={salvandoCfg || !d} onClick={salvarConfig}><Save size={16} /> {salvandoCfg ? 'Salvando…' : 'Salvar setor master'}</Botao></div>
          </Painel>
        )}

        {form && (
          <Painel titulo={form.tipo === 'disciplina' ? `${form.id ? `Editar disciplina ${form.nome}` : 'Nova disciplina'} · setor ${setorDoForm?.nome ?? ''}` : form.id ? `Editar setor ${form.nome}` : 'Novo setor'}
            subtitulo={form.tipo === 'disciplina' ? 'Subsetor do setor (ex.: Formas, Armação, Concreto). Sem cor própria, usa a cor do setor.' : undefined}>
            <form onSubmit={salvarSetor} className="grid gap-4 lg:grid-cols-2">
              <div className="grid grid-cols-[1fr_96px] gap-3">
                <Campo rotulo={form.tipo === 'disciplina' ? 'Nome da disciplina' : 'Nome do setor'} required maxLength={80} placeholder={form.tipo === 'disciplina' ? 'Formas, Armação, Concreto…' : 'Civil, Montagem, Elétrica…'} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                <Campo rotulo="Ordem" type="number" min={0} value={form.ordem} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })} />
              </div>
              <SeletorPessoa rotulo={form.tipo === 'disciplina' ? 'Responsável da disciplina' : 'Responsável do setor'} valor={form.responsavel} onChange={(p) => setForm({ ...form, responsavel: p })} />
              <SeletorCor rotulo={form.tipo === 'disciplina' ? 'Cor da disciplina' : 'Cor do setor'} valor={form.cor} padrao={form.tipo === 'disciplina' ? (setorDoForm?.cor ?? d?.cores.disciplina) : d?.cores.setor} onChange={(c) => setForm({ ...form, cor: c })} />
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Equipes {form.tipo === 'disciplina' ? 'da disciplina' : 'do setor'} ({form.equipes.length})</span>
                <div className="grid max-h-56 gap-1 overflow-auto rounded-[10px] border border-m-stroke-subtle p-2 sm:grid-cols-2">
                  {d?.equipes.map((e) => {
                    const outro = ondeEsta(e);
                    const marcada = form.equipes.includes(e.id);
                    return (
                      <label key={e.id} className={`flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] ${e.ativo ? '' : 'opacity-60'}`}>
                        <input type="checkbox" checked={marcada} onChange={() => setForm({ ...form, equipes: marcada ? form.equipes.filter((x) => x !== e.id) : [...form.equipes, e.id] })} />
                        <span className="min-w-0 flex-1 truncate text-m-text-primary" title={e.nome}>{e.nome}</span>
                        {outro && !marcada && <span className="max-w-[45%] shrink-0 truncate text-[11px] text-m-text-muted" title={outro}>em {outro}</span>}
                      </label>
                    );
                  })}
                  {!d?.equipes.length && <span className="text-[13px] text-m-text-muted">Nenhuma equipe cadastrada.</span>}
                </div>
                <span className="text-[11.5px] text-m-text-muted">{form.tipo === 'disciplina' ? 'Marcar uma equipe a coloca nesta disciplina e no setor dela.' : 'Marcar uma equipe que está em outro setor a move para este (sai da disciplina antiga).'}</span>
              </div>
              <div className="flex items-center gap-2 lg:col-span-2"><Botao type="submit">{form.tipo === 'disciplina' ? 'Salvar disciplina' : 'Salvar setor'}</Botao><Botao type="button" variante="secundario" onClick={() => setForm(null)}>Cancelar</Botao><Erro erro={erro} /></div>
            </form>
          </Painel>
        )}

        <Painel titulo={`Setores (${d?.setores.length ?? 0})`} subtitulo={d && d.equipes.length ? `${d.equipes.filter((e) => !e.setor_id).length} de ${d.equipes.length} equipe(s) sem setor` : undefined}>
          {!d?.setores.length && <p className="text-[13px] text-m-text-muted">{dados.isLoading ? 'Carregando…' : 'Nenhum setor ainda. Enquanto não houver setores, o organograma agrupa as equipes pela frente ou pelo DP do encarregado.'}</p>}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {d && (
              <div className="flex flex-col gap-2 rounded-[14px] border border-m-stroke bg-m-surface-raised p-4" style={{ borderTop: `4px solid ${d.cores.obra}` }}>
                <div className="flex items-start gap-2">
                  <Crown size={16} className="mt-0.5 shrink-0" style={{ color: d.cores.obra }} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-m-text-primary">{obra?.nome ?? 'Obra'}<span className="rounded-full bg-m-accent-subtle px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-m-accent">Setor master</span></div>
                    <div className="text-[12.5px] text-m-text-secondary">{d.responsavel_geral ? <>Responsável geral: <b className="font-medium text-m-text-primary">{d.responsavel_geral.nome}</b>{d.responsavel_geral.funcao && ` · ${d.responsavel_geral.funcao}`}</> : <span className="text-m-warning">sem responsável geral</span>}</div>
                  </div>
                  {editar && <button type="button" aria-label="Trocar o responsável geral e as cores" title="Trocar o dono e as cores (o setor master não é excluído)" className="p-1 text-m-text-muted hover:text-m-accent" onClick={() => { setForm(null); setMaster(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Pencil size={15} /></button>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-m-text-muted">
                  Cores do organograma:
                  {NIVEIS.map((n) => <span key={n.v} title={n.rotulo} className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: d.cores[n.v] }} />{n.rotulo}</span>)}
                </div>
                <div className="text-[11.5px] text-m-text-muted">{d.setores.length} setor(es) abaixo · não pode ser excluído, só trocar o dono.</div>
              </div>
            )}
            {d?.setores.map((st) => {
              const cor = st.cor ?? d.cores.setor;
              return (
                <div key={st.id} className="flex flex-col gap-2 rounded-[14px] border border-m-stroke bg-m-surface-raised p-4" style={{ borderTop: `4px solid ${cor}` }}>
                  <div className="flex items-start gap-2">
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: cor }} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-semibold text-m-text-primary">{st.nome}</div>
                      <div className="text-[12.5px] text-m-text-secondary">{st.responsavel ? <>Resp.: <b className="font-medium text-m-text-primary">{st.responsavel.nome}</b>{st.responsavel.funcao && ` · ${st.responsavel.funcao}`}</> : <span className="text-m-warning">sem responsável</span>}</div>
                    </div>
                    {editar && <div className="flex shrink-0 gap-1">
                      <button type="button" aria-label={`Editar ${st.nome}`} className="p-1 text-m-text-muted hover:text-m-accent" onClick={() => abrir({ tipo: 'setor', id: st.id, nome: st.nome, cor: st.cor, ordem: st.ordem, responsavel: st.responsavel, equipes: st.equipes.map((e) => e.id) })}><Pencil size={15} /></button>
                      <button type="button" aria-label={`Excluir ${st.nome}`} className="p-1 text-m-text-muted hover:text-m-danger" onClick={() => excluir(st)}><Trash2 size={15} /></button>
                    </div>}
                  </div>
                  {st.disciplinas.map((dc) => {
                    const cd = dc.cor ?? cor;
                    return (
                      <div key={dc.id} className="rounded-[10px] border border-m-stroke-subtle p-2" style={{ borderLeft: `4px solid ${cd}` }}>
                        <div className="flex items-start gap-2">
                          <Layers size={14} className="mt-0.5 shrink-0" style={{ color: cd }} aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-semibold text-m-text-primary">{dc.nome}</div>
                            <div className="text-[12px] text-m-text-secondary">{dc.responsavel ? <>Resp.: {dc.responsavel.nome}</> : <span className="text-m-text-muted">sem responsável</span>}</div>
                          </div>
                          {editar && <div className="flex shrink-0 gap-0.5">
                            <button type="button" aria-label={`Editar disciplina ${dc.nome}`} className="p-1 text-m-text-muted hover:text-m-accent" onClick={() => abrir({ tipo: 'disciplina', id: dc.id, setorId: st.id, nome: dc.nome, cor: dc.cor, ordem: dc.ordem, responsavel: dc.responsavel, equipes: dc.equipes.map((e) => e.id) })}><Pencil size={13} /></button>
                            <button type="button" aria-label={`Excluir disciplina ${dc.nome}`} className="p-1 text-m-text-muted hover:text-m-danger" onClick={() => excluirDisciplina(dc)}><Trash2 size={13} /></button>
                          </div>}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {dc.equipes.map((e) => <span key={e.id} className="rounded-full px-2 py-0.5 text-[11px] font-medium text-m-text-primary" style={{ background: `color-mix(in srgb, ${cd} 14%, transparent)` }}>{e.nome}</span>)}
                          {!dc.equipes.length && <span className="text-[11.5px] text-m-text-muted">Sem equipes.</span>}
                        </div>
                      </div>
                    );
                  })}
                  {(() => {
                    const soltas = st.equipes.filter((e) => !st.disciplinas.some((dc) => dc.equipes.some((x) => x.id === e.id)));
                    return (soltas.length > 0 || !st.disciplinas.length) && (
                      <div className="flex flex-wrap items-center gap-1">
                        {st.disciplinas.length > 0 && <span className="text-[11.5px] text-m-text-muted">Sem disciplina:</span>}
                        {soltas.map((e) => <span key={e.id} className="rounded-full px-2 py-0.5 text-[11.5px] font-medium text-m-text-primary" style={{ background: `color-mix(in srgb, ${cor} 14%, transparent)` }}>{e.nome}</span>)}
                        {!st.equipes.length && <span className="text-[12px] text-m-text-muted">Sem equipes.</span>}
                      </div>
                    );
                  })()}
                  {editar && <button type="button" className="inline-flex items-center gap-1 self-start text-[12.5px] font-semibold text-m-accent" onClick={() => novaDisciplina(st)}><Plus size={14} /> Disciplina</button>}
                </div>
              );
            })}
          </div>
        </Painel>
      </div>
    </>
  );
}
