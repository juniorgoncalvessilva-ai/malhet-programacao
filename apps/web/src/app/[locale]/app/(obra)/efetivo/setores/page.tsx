'use client';

import { useQueryClient } from '@tanstack/react-query';
import { GitFork, Pencil, Plus, Save, Trash2 } from 'lucide-react';
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
import type { CoresOrganograma, NivelCor, PessoaRef, SetorObra } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';

type FormSetor = { id?: number; nome: string; cor: string | null; ordem: number; responsavel: PessoaRef | null; equipes: number[] };
const NIVEIS: { v: NivelCor; rotulo: string }[] = [
  { v: 'obra', rotulo: 'Obra' }, { v: 'setor', rotulo: 'Setores' }, { v: 'equipe', rotulo: 'Equipes' }, { v: 'funcao', rotulo: 'Funções' },
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
  const d = dados.data;
  useEffect(() => {
    if (!d) return;
    setGeral(d.responsavel_geral);
    setCores(Object.fromEntries(NIVEIS.filter((n) => d.cores[n.v] !== d.cores_padrao[n.v]).map((n) => [n.v, d.cores[n.v]])));
  }, [d]);
  const atualizar = () => { qc.invalidateQueries({ queryKey: k.efetivo }); qc.invalidateQueries({ queryKey: chaves.equipes }); };

  const salvarConfig = async () => {
    setSalvandoCfg(true);
    try {
      await api.put('/efetivo/organograma/config', { responsavel_id: geral?.id ?? null, cores });
      toast.success('Responsável geral e cores salvos');
      atualizar();
    } catch (e) { toast.error((e as Error).message); } finally { setSalvandoCfg(false); }
  };
  const salvarSetor = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form) return;
    const corpo = { nome: form.nome, cor: form.cor, ordem: form.ordem, responsavel_id: form.responsavel?.id ?? null, equipes: form.equipes };
    try {
      if (form.id) await api.put(`/efetivo/setores/${form.id}`, corpo); else await api.post('/efetivo/setores', corpo);
      toast.success(`Setor ${form.nome} salvo`);
      setForm(null); setErro(null); atualizar();
    } catch (e) { setErro(e); }
  };
  const excluir = async (st: SetorObra) => {
    if (!(await confirmar({ titulo: `Excluir o setor ${st.nome}?`, mensagem: st.equipes.length ? `${st.equipes.length} equipe(s) ficam sem setor. As equipes e as pessoas não são apagadas.` : 'As equipes e as pessoas não são apagadas.' }))) return;
    try { await api.del(`/efetivo/setores/${st.id}`); toast.success('Setor excluído'); if (form?.id === st.id) setForm(null); atualizar(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const novo = () => { setErro(null); setForm({ nome: '', cor: null, ordem: (d?.setores.length ?? 0) + 1, responsavel: null, equipes: [] }); };
  const setorDaEquipe = new Map(d?.setores.flatMap((st) => st.equipes.map((e) => [e.id, st.nome] as const)) ?? []);

  return (
    <>
      <Cabecalho
        eyebrow="Efetivo · setores da obra"
        titulo="Setores, responsáveis e cores do organograma"
        descricao={<>A obra tem um responsável geral e cada setor tem um responsável, escolhidos no efetivo. As equipes ficam no setor escolhido aqui e o <Link href="/app/efetivo/organograma" className="font-semibold text-m-accent">organograma</Link> passa a ser Obra → Setor → Equipe → Função. Cada setor pode ter uma cor, herdada pelas equipes dele.</>}
        acoes={<div className="flex gap-2">
          <Link href="/app/efetivo/organograma"><Botao variante="secundario"><GitFork size={16} /> Ver organograma</Botao></Link>
          {editar && <Botao variante="secundario" onClick={novo}><Plus size={16} /> Novo setor</Botao>}
        </div>}
      />
      <div className="flex flex-col gap-4">
        <Painel titulo={`Obra ${obra?.nome ?? ''}`} subtitulo="Responsável geral (topo do organograma) e cor de cada nível. Setores com cor própria usam a deles.">
          <div className="grid gap-4 lg:grid-cols-[minmax(280px,420px)_1fr]">
            <SeletorPessoa rotulo="Responsável geral da obra" valor={geral} onChange={setGeral} disabled={!editar} />
            <div className="grid gap-3 sm:grid-cols-2">
              {NIVEIS.map((n) => (
                <SeletorCor key={n.v} rotulo={`Cor · ${n.rotulo}`} valor={cores[n.v] ?? null} padrao={d?.cores_padrao[n.v]} disabled={!editar}
                  onChange={(c) => setCores((x) => { const y = { ...x }; if (c) y[n.v] = c; else delete y[n.v]; return y; })} />
              ))}
            </div>
          </div>
          {editar && <div><Botao disabled={salvandoCfg || !d} onClick={salvarConfig}><Save size={16} /> {salvandoCfg ? 'Salvando…' : 'Salvar responsável e cores'}</Botao></div>}
        </Painel>

        {form && (
          <Painel titulo={form.id ? `Editar setor ${form.nome}` : 'Novo setor'}>
            <form onSubmit={salvarSetor} className="grid gap-4 lg:grid-cols-2">
              <div className="grid grid-cols-[1fr_96px] gap-3">
                <Campo rotulo="Nome do setor" required maxLength={80} placeholder="Civil, Montagem, Elétrica…" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                <Campo rotulo="Ordem" type="number" min={0} value={form.ordem} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })} />
              </div>
              <SeletorPessoa rotulo="Responsável do setor" valor={form.responsavel} onChange={(p) => setForm({ ...form, responsavel: p })} />
              <SeletorCor rotulo="Cor do setor" valor={form.cor} padrao={d?.cores.setor} onChange={(c) => setForm({ ...form, cor: c })} />
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Equipes do setor ({form.equipes.length})</span>
                <div className="grid max-h-56 gap-1 overflow-auto rounded-[10px] border border-m-stroke-subtle p-2 sm:grid-cols-2">
                  {d?.equipes.map((e) => {
                    const outro = setorDaEquipe.get(e.id);
                    const marcada = form.equipes.includes(e.id);
                    return (
                      <label key={e.id} className={`flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] ${e.ativo ? '' : 'opacity-60'}`}>
                        <input type="checkbox" checked={marcada} onChange={() => setForm({ ...form, equipes: marcada ? form.equipes.filter((x) => x !== e.id) : [...form.equipes, e.id] })} />
                        <span className="min-w-0 flex-1 truncate text-m-text-primary" title={e.nome}>{e.nome}</span>
                        {outro && outro !== form.nome && !marcada && <span className="shrink-0 text-[11px] text-m-text-muted">em {outro}</span>}
                      </label>
                    );
                  })}
                  {!d?.equipes.length && <span className="text-[13px] text-m-text-muted">Nenhuma equipe cadastrada.</span>}
                </div>
                <span className="text-[11.5px] text-m-text-muted">Marcar uma equipe que está em outro setor a move para este.</span>
              </div>
              <div className="flex items-center gap-2 lg:col-span-2"><Botao type="submit">Salvar setor</Botao><Botao type="button" variante="secundario" onClick={() => setForm(null)}>Cancelar</Botao><Erro erro={erro} /></div>
            </form>
          </Painel>
        )}

        <Painel titulo={`Setores (${d?.setores.length ?? 0})`} subtitulo={d && d.equipes.length ? `${d.equipes.filter((e) => !e.setor_id).length} de ${d.equipes.length} equipe(s) sem setor` : undefined}>
          {!d?.setores.length && <p className="text-[13px] text-m-text-muted">{dados.isLoading ? 'Carregando…' : 'Nenhum setor ainda. Enquanto não houver setores, o organograma agrupa as equipes pela frente ou pelo DP do encarregado.'}</p>}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                      <button type="button" aria-label={`Editar ${st.nome}`} className="p-1 text-m-text-muted hover:text-m-accent" onClick={() => { setErro(null); setForm({ id: st.id, nome: st.nome, cor: st.cor, ordem: st.ordem, responsavel: st.responsavel, equipes: st.equipes.map((e) => e.id) }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Pencil size={15} /></button>
                      <button type="button" aria-label={`Excluir ${st.nome}`} className="p-1 text-m-text-muted hover:text-m-danger" onClick={() => excluir(st)}><Trash2 size={15} /></button>
                    </div>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {st.equipes.map((e) => <span key={e.id} className="rounded-full px-2 py-0.5 text-[11.5px] font-medium" style={{ background: `color-mix(in srgb, ${cor} 14%, transparent)`, color: 'var(--m-text-primary)' }}>{e.nome}</span>)}
                    {!st.equipes.length && <span className="text-[12px] text-m-text-muted">Sem equipes.</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </Painel>
      </div>
    </>
  );
}
