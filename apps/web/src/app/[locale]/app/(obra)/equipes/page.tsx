'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Download, Link2, Plus, Trash2, UserPlus } from 'lucide-react';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { Botao, Cabecalho, Campo, Erro, Pilula, Painel, Selecao, Tabela, UploadForm, fmt, td } from '@/components/Obra/ui';
import { chaves, useEquipes } from '@/hooks/programacao/queries';
import { k as kEfetivo, useSetores } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import type { ComposicaoEquipe, Equipe, PessoaEfetivoEquipe } from '@/lib/api/types';
import { ROTULO_SITUACAO, TOM_SITUACAO } from '@/lib/efetivo/situacoes';
import { Link } from '@/i18n/navigation';
import { useObra } from '@/lib/obra/ObraProvider';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Calculado } from '@/components/Obra/Calculado';

type Form = Omit<Equipe, 'id' | 'hh_disponivel_dia' | 'composicao_efetiva' | 'encarregado_efetivo' | 'fora_do_efetivo'> & { id?: number };
type Vinculo = { equipes: number; vinculados: number; nao_encontrados: string[]; sem_numero: string[] };
/** Crachá provisório ("?nome") = pessoa ainda sem número. */
const semNumero = (c: string | null | undefined) => !c || c.startsWith('?');
const NOVA: Form = {
  nome: '', frente_codigo: null, setor_id: null, subsetor_id: null, encarregado_cracha: null, encarregado_nome: null, jornada_horas: 9, turno: 'Diurno',
  codigo_simova: null, responsavel: null, equipamentos: null, observacao: null, ativo: true, composicao: [], membros: [],
};
const TURNOS = ['Diurno', 'Noturno', 'Administrativo', 'Turno A', 'Turno B', 'Turno C'];

export default function EquipesPage() {
  const confirmar = useConfirmar();
  const { pode } = useObra();
  const equipes = useEquipes();
  const setores = useSetores();
  const api = useApi();
  const qc = useQueryClient();
  const recursos = useQuery({ queryKey: ['cpu-recursos'], queryFn: () => api.get<{ recurso: string; tipo: 'MOD' | 'EQU'; composicoes: number }[]>('/cpu/recursos') });
  const [form, setForm] = useState<Form | null>(null);
  const [nova, setNova] = useState<ComposicaoEquipe>({ recurso: '', tipo: 'EQU', quantidade: 1 });
  const [erro, setErro] = useState<unknown>(null);
  const [aberta, setAberta] = useState<number | null>(null);
  const [importando, setImportando] = useState(false);
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const [novoMembro, setNovoMembro] = useState('');
  const [vinculo, setVinculo] = useState<Vinculo | null>(null);
  const [vinculando, setVinculando] = useState(false);
  const vincular = async () => {
    setVinculando(true);
    try {
      const r = await api.post<Vinculo>('/equipes/vincular-efetivo');
      setVinculo(r);
      toast.success(`${r.vinculados} pessoa(s) ligada(s) ao efetivo pela matrícula`);
      atualizar();
    } catch (er) { toast.error((er as Error).message); } finally { setVinculando(false); }
  };
  const addMembro = () => {
    const t = novoMembro.trim();
    if (!form || !t) return;
    const num = t.match(/^\s*(\d[\d.]{2,})/)?.[1]?.replace(/\./g, '') ?? '';
    if (num && form.membros.some((m) => m.cracha === num)) { toast.error(`Matrícula ${num} já está na equipe`); return; }
    setForm({ ...form, membros: [...form.membros, { cracha: num, nome: t, funcao: null }] });
    setNovoMembro('');
  };
  const excluir = async (ids: number[]) => {
    const nomes = equipes.data?.filter((e) => ids.includes(e.id)).map((e) => e.nome) ?? [];
    if (!ids.length || !(await confirmar({
      titulo: ids.length === 1 ? `Excluir a equipe ${nomes[0]}?` : `Excluir ${ids.length} equipes?`,
      mensagem: <>As linhas de programação que usam {ids.length === 1 ? 'a equipe' : 'estas equipes'} ficam sem equipe. As programações já emitidas não mudam.{ids.length > 1 && <><br /><span className="text-m-text-muted">{nomes.slice(0, 6).join(', ')}{nomes.length > 6 ? '…' : ''}</span></>}</>,
    }))) return;
    let ok = 0;
    for (const id of ids) {
      try { await api.del(`/equipes/${id}`); ok++; } catch (er) { toast.error((er as Error).message); }
    }
    if (ok) toast.success(`${ok} equipe(s) excluída(s)`);
    setMarcadas(new Set());
    if (form?.id && ids.includes(form.id)) setForm(null);
    atualizar();
  };
  const atualizar = () => { qc.invalidateQueries({ queryKey: chaves.equipes }); qc.invalidateQueries({ queryKey: ['programacao'] }); qc.invalidateQueries({ queryKey: kEfetivo.efetivo }); };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    try {
      if (form.id) await api.put(`/equipes/${form.id}`, form); else await api.post('/equipes', form);
      toast.success('Equipe salva');
      setForm(null);
      setErro(null);
      atualizar();
    } catch (er) { setErro(er); }
  };
  const importarSimova = async (fd: FormData) => {
    setImportando(true);
    try {
      const r = await api.post<{ criadas: number; atualizadas: number; vinculo: Vinculo }>('/equipes/importar-simova', fd);
      toast.success(`${r.criadas} equipe(s) nova(s), ${r.atualizadas} atualizada(s) · ${r.vinculo.vinculados} pessoa(s) ligada(s) ao efetivo`);
      setVinculo(r.vinculo);
      atualizar();
    } catch (er) { toast.error((er as Error).message); } finally { setImportando(false); }
  };
  const addEquip = () => {
    if (!form || !nova.recurso.trim()) return;
    const recurso = recursos.data?.find((r) => r.recurso.toLowerCase() === nova.recurso.trim().toLowerCase())?.recurso ?? nova.recurso.trim();
    setForm({ ...form, composicao: [...form.composicao.filter((c) => c.recurso !== recurso), { ...nova, recurso }] });
    setNova({ recurso: '', tipo: 'EQU', quantidade: 1 });
  };
  const mod = recursos.data?.filter((r) => r.tipo === 'MOD') ?? [];
  const equ = recursos.data?.filter((r) => r.tipo === 'EQU') ?? [];
  const usaFuncoes = !!form?.membros.some((m) => m.funcao || m.efetivo?.funcao_cpu);

  return (
    <>
      <Cabecalho
        eyebrow="Equipes · frentes de trabalho"
        titulo="Quem trabalha em cada frente, em que turno e quanto produz"
        acoes={<div className="flex flex-wrap gap-2">
          {pode('planejador') && <Botao variante="secundario" disabled={vinculando} onClick={vincular}><Link2 size={16} /> {vinculando ? 'Vinculando…' : 'Vincular ao efetivo'}</Botao>}
          <Botao variante="secundario" onClick={() => api.download('/equipes/simova.xlsx', 'Equipe_Simova.xlsx').then(() => toast.success('Arquivo no padrão do Simova gerado (equipes ativas)')).catch((e) => toast.error(e.message))}><Download size={16} /> Exportar para o Simova</Botao>
          {pode('planejador') && <Botao variante="secundario" onClick={() => { setErro(null); setForm({ ...NOVA, composicao: [], membros: [] }); }}><Plus size={16} /> Nova equipe</Botao>}
        </div>}
      />
      <div className="flex flex-col gap-4">
        {pode('planejador') && (
          <Painel titulo="Importar equipes do Simova">
            <UploadForm campos={[{ nome: 'arquivo', rotulo: 'Equipe.xlsx' }]} rotulo="Importar" pendente={importando} onEnviar={importarSimova} />
          </Painel>
        )}
        {vinculo && (
          <Painel titulo={`Vínculo com o efetivo: ${vinculo.vinculados} pessoa(s) ligada(s) pela matrícula`}
            subtitulo={vinculo.nao_encontrados.length || vinculo.sem_numero.length ? 'Confira abaixo quem não foi achado. Importe o efetivo atualizado ou corrija o número na equipe.' : 'Todas as pessoas das equipes estão no efetivo.'}
            acoes={<Botao variante="secundario" onClick={() => setVinculo(null)}>Fechar</Botao>}>
            <div className="grid gap-4 text-[13px] md:grid-cols-2">
              {!!vinculo.nao_encontrados.length && <div><div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.4px] text-m-warning">Matrícula não encontrada no efetivo ({vinculo.nao_encontrados.length})</div>
                <ul className="max-h-48 overflow-auto text-m-text-secondary">{vinculo.nao_encontrados.map((t) => <li key={t}>{t}</li>)}</ul></div>}
              {!!vinculo.sem_numero.length && <div><div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.4px] text-m-warning">Sem número antes do nome ({vinculo.sem_numero.length})</div>
                <ul className="max-h-48 overflow-auto text-m-text-secondary">{vinculo.sem_numero.map((t) => <li key={t}>{t}</li>)}</ul></div>}
            </div>
          </Painel>
        )}
        {form && (
          <Painel titulo={form.id ? `Editar ${form.nome}` : 'Nova equipe'}>
            <form onSubmit={salvar} className="grid gap-3 md:grid-cols-6">
              <Campo rotulo="Código Simova" value={form.codigo_simova ?? ''} onChange={(e) => setForm({ ...form, codigo_simova: e.target.value || null })} />
              <div className="md:col-span-2"><Campo rotulo="Nome da equipe" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <Selecao rotulo="Turno" value={form.turno ?? ''} onChange={(e) => setForm({ ...form, turno: e.target.value || null })}>
                {TURNOS.map((t) => <option key={t} value={t}>{t}</option>)}
                {form.turno && !TURNOS.includes(form.turno) && <option value={form.turno}>{form.turno}</option>}
              </Selecao>
              <Campo rotulo="Jornada (h/dia)" type="number" step="0.25" min="1" max="24" value={form.jornada_horas} onChange={(e) => setForm({ ...form, jornada_horas: Number(e.target.value) })} />
              <label className="flex items-end gap-2 pb-2.5 text-[13px] text-m-text-secondary"><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativa</label>
              <Campo rotulo="Matrícula / crachá do encarregado" value={form.encarregado_cracha ?? ''} onChange={(e) => setForm({ ...form, encarregado_cracha: e.target.value || null })} />
              <div className="md:col-span-2"><Campo rotulo="Encarregado" placeholder="nome, ou 115532 - nome" value={form.encarregado_nome ?? ''} onChange={(e) => setForm({ ...form, encarregado_nome: e.target.value || null })} /></div>
              <div className="md:col-span-2"><Campo rotulo="Responsável (supervisor/engenheiro)" value={form.responsavel ?? ''} onChange={(e) => setForm({ ...form, responsavel: e.target.value || null })} /></div>
              <Selecao rotulo="Setor da obra" value={form.setor_id ?? ''} onChange={(e) => {
                const sid = e.target.value ? Number(e.target.value) : null;
                const manter = setores.data?.setores.find((x) => x.id === sid)?.disciplinas.some((x) => x.id === form.subsetor_id);
                setForm({ ...form, setor_id: sid, subsetor_id: manter ? form.subsetor_id : null });
              }}>
                <option value="">{setores.data?.setores.length ? '— sem setor —' : 'cadastre em Setores da obra'}</option>
                {setores.data?.setores.map((st) => <option key={st.id} value={st.id}>{st.nome}</option>)}
              </Selecao>
              <Selecao rotulo="Disciplina" value={form.subsetor_id ?? ''} disabled={!form.setor_id}
                onChange={(e) => setForm({ ...form, subsetor_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">{form.setor_id ? '— sem disciplina —' : 'escolha o setor'}</option>
                {setores.data?.setores.find((x) => x.id === form.setor_id)?.disciplinas.map((dc) => <option key={dc.id} value={dc.id}>{dc.nome}</option>)}
              </Selecao>
              <Campo rotulo="Frente" value={form.frente_codigo ?? ''} onChange={(e) => setForm({ ...form, frente_codigo: e.target.value || null })} />

              <div className="md:col-span-6">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Funcionários ({form.membros.length}) · a função da composição vem do <Link href="/app/efetivo/funcoes" className="text-m-accent underline">de-para de funções</Link>; troque só se a pessoa trabalha em outra função nesta equipe</div>
                <div className="grid gap-1.5 lg:grid-cols-2">
                  {form.membros.map((m, i) => (
                    <div key={`${m.cracha}-${i}`} className="flex items-center gap-2 rounded-m-md border border-m-stroke-subtle px-2 py-1">
                      <span className="w-[64px] shrink-0 text-xs text-m-text-muted">{semNumero(m.cracha) ? '—' : m.cracha}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-m-text-primary" title={[m.nome, m.efetivo?.funcao].filter(Boolean).join(' · ')}>{m.nome}{m.efetivo?.funcao && <span className="block truncate text-[11px] text-m-text-muted">{m.efetivo.funcao}</span>}</span>
                      <select aria-label={`Função de ${m.nome} na composição`} value={m.funcao ?? ''}
                        title={m.funcao ? 'Função escolhida nesta equipe (no lugar do de-para)' : m.efetivo?.funcao_cpu ? 'Função do de-para' : 'Função do efetivo sem de-para'}
                        onChange={(e) => { const v = e.target.value || null; const ms = [...form.membros]; ms[i] = { ...m, funcao: v === m.efetivo?.funcao_cpu ? null : v }; setForm({ ...form, membros: ms }); }}
                        className={`h-8 w-[170px] rounded-[8px] border bg-m-surface-field px-1.5 text-[13px] ${m.funcao ? 'border-m-accent font-semibold text-m-text-primary' : m.efetivo?.funcao_cpu ? 'border-m-stroke text-m-text-primary' : 'border-m-warning text-m-text-muted'}`}>
                        <option value="">{m.efetivo?.funcao_cpu ? `${m.efetivo.funcao_cpu} (de-para)` : m.efetivo?.funcao ? 'sem de-para' : 'escolha a função'}</option>
                        {m.funcao && !mod.some((r) => r.recurso === m.funcao) && <option value={m.funcao}>{m.funcao}</option>}
                        {mod.map((r) => <option key={r.recurso} value={r.recurso}>{r.recurso}</option>)}
                      </select>
                      <button type="button" aria-label={`Tirar ${m.nome} da equipe`} className="p-1 text-m-text-muted hover:text-m-danger" onClick={() => setForm({ ...form, membros: form.membros.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {!form.membros.length && <span className="text-[13px] text-m-text-muted">Sem funcionários (importe do Simova ou inclua pela matrícula).</span>}
                </div>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <Campo rotulo="Incluir pela matrícula" placeholder="115532 ou 115532 - José da Silva" value={novoMembro} className="w-[300px]"
                    onChange={(e) => setNovoMembro(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMembro(); } }} />
                  <Botao type="button" variante="secundario" onClick={addMembro}><UserPlus size={16} /> Incluir</Botao>
                  <span className="pb-2.5 text-[12px] text-m-text-muted">Ao salvar, nome e função vêm do efetivo pela matrícula.</span>
                </div>
              </div>

              <div className="md:col-span-6">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">
                  {usaFuncoes ? 'Equipamentos da equipe (a mão de obra sai das funções acima)' : 'Composição (mão de obra e equipamentos) — usada enquanto as funções não forem informadas'}
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.composicao.filter((c) => !usaFuncoes || c.tipo === 'EQU').map((c) => (
                    <div key={c.recurso} className="flex items-center gap-1.5 rounded-m-md border border-m-stroke px-2 py-1">
                      <input aria-label={`Quantidade de ${c.recurso}`} type="number" min="0" step="1" value={c.quantidade}
                        onChange={(e) => setForm({ ...form, composicao: form.composicao.map((x) => (x === c ? { ...c, quantidade: Number(e.target.value) } : x)) })}
                        className="h-8 w-14 rounded-[8px] border border-m-stroke bg-m-surface-field px-1.5 text-right text-[13px]" />
                      <span className="text-[13px] text-m-text-primary">{c.recurso}</span>
                      <Pilula ponto={false} tom={c.tipo === 'MOD' ? 'acento' : 'neutro'}>{c.tipo}</Pilula>
                      <button type="button" aria-label={`Remover ${c.recurso}`} className="p-1 text-m-text-muted hover:text-m-danger" onClick={() => setForm({ ...form, composicao: form.composicao.filter((x) => x !== c) })}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <Campo rotulo="Equipamento ou função" list="recursos-cpu" placeholder="Escavadeira Hidráulica CAT 320" value={nova.recurso} className="w-[300px]"
                    onChange={(e) => setNova({ ...nova, recurso: e.target.value, tipo: recursos.data?.find((r) => r.recurso === e.target.value)?.tipo ?? nova.tipo })} />
                  <datalist id="recursos-cpu">{[...equ, ...mod].map((r) => <option key={`${r.recurso}${r.tipo}`} value={r.recurso}>{r.tipo}</option>)}</datalist>
                  <Selecao rotulo="Tipo" value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value as 'MOD' | 'EQU' })} className="w-[100px]">
                    <option value="EQU">EQU</option><option value="MOD">MOD</option>
                  </Selecao>
                  <Campo rotulo="Qtd." type="number" min="0" step="1" value={nova.quantidade} className="w-[80px]" onChange={(e) => setNova({ ...nova, quantidade: Number(e.target.value) })} />
                  <Botao type="button" variante="secundario" onClick={addEquip}><Plus size={16} /> Incluir</Botao>
                </div>
              </div>
              <div className="flex items-center gap-2 md:col-span-6"><Botao type="submit">Salvar</Botao><Botao type="button" variante="secundario" onClick={() => setForm(null)}>Cancelar</Botao><Erro erro={erro} /></div>
            </form>
          </Painel>
        )}
        <Painel titulo={`Equipes (${equipes.data?.length ?? 0})`}
          acoes={pode('planejador') && <div className="flex items-center gap-2">
            {!!equipes.data?.length && <label className="flex items-center gap-2 text-[13px] text-m-text-secondary"><input type="checkbox" aria-label="Selecionar todas"
              checked={!!equipes.data?.length && marcadas.size === equipes.data.length}
              onChange={(e) => setMarcadas(e.target.checked ? new Set(equipes.data?.map((x) => x.id)) : new Set())} /> Todas</label>}
            <Botao variante="secundario" disabled={!marcadas.size} onClick={() => excluir([...marcadas])}><Trash2 size={16} /> Excluir selecionadas{marcadas.size ? ` (${marcadas.size})` : ''}</Botao>
          </div>}>
          <Tabela cabecalho={['', 'Cód.', 'Equipe', 'Encarregado', 'Turno · jornada', 'Composição', 'HH/dia', '']} vazio={!equipes.data?.length && 'Importe o cadastro do Simova ou crie a primeira equipe.'}>
            {equipes.data?.map((e) => (
              <Fragment key={e.id}>
                <tr className={e.ativo ? '' : 'opacity-50'}>
                  <td className={`${td} whitespace-nowrap`}>{pode('planejador') && <input type="checkbox" className="mr-2 align-middle" aria-label={`Selecionar ${e.nome}`} checked={marcadas.has(e.id)} onChange={() => setMarcadas((m) => { const n = new Set(m); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n; })} />}<button type="button" aria-label={`Ver funcionários de ${e.nome}`} className="text-m-text-muted" onClick={() => setAberta(aberta === e.id ? null : e.id)}>{aberta === e.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button></td>
                  <td className={td}>{e.codigo_simova ?? '—'}</td>
                  <td className={td}><b className="text-m-text-primary">{e.nome}</b>
                    {(() => {
                      const st = setores.data?.setores.find((x) => x.id === e.setor_id);
                      const dc = st?.disciplinas.find((x) => x.id === e.subsetor_id);
                      return st && <div className="mt-0.5 flex items-center gap-1 text-xs text-m-text-secondary"><span className="h-2 w-2 rounded-full" style={{ background: dc?.cor ?? st.cor ?? setores.data?.cores.setor }} aria-hidden="true" />{st.nome}{dc && ` / ${dc.nome}`}</div>;
                    })()}
                    {e.responsavel && <div className="text-xs text-m-text-muted">resp. {e.responsavel}</div>}</td>
                  <td className={td}>{e.encarregado_nome ?? '—'}
                    <div className="text-xs text-m-text-muted">{e.encarregado_cracha
                      ? <>{e.encarregado_cracha}{e.encarregado_efetivo?.funcao && ` · ${e.encarregado_efetivo.funcao}`}</>
                      : <Pilula tom="atencao">sem matrícula</Pilula>}</div>
                    {e.encarregado_cracha && !e.encarregado_efetivo && <Pilula tom="atencao">fora do efetivo</Pilula>}
                    {e.encarregado_efetivo && e.encarregado_efetivo.situacao !== 'MOBILIZADO' && <Pilula tom={TOM_SITUACAO[e.encarregado_efetivo.situacao]}>{ROTULO_SITUACAO[e.encarregado_efetivo.situacao]}</Pilula>}
                  </td>
                  <td className={td}>{e.turno ?? 'Diurno'} · {fmt(e.jornada_horas, 2)} h</td>
                  <td className={td}><div className="flex flex-wrap gap-1">
                    {e.composicao_efetiva.map((c) => <Calculado key={c.recurso + c.tipo} rota={`/equipes/${e.id}/memoria`} chave="composicao_equipe" titulo="Ver quem conta em cada função e de onde vem a função" className="no-underline"><Pilula ponto={false} tom={c.tipo === 'MOD' ? 'acento' : 'neutro'}>{fmt(c.quantidade, 0)} {c.recurso}</Pilula></Calculado>)}
                    {!e.composicao_efetiva.length && <span className="text-xs text-m-text-muted">{e.membros.length} funcionário(s), funções não informadas</span>}
                  </div>
                  {!!e.fora_do_efetivo && <div className="mt-1"><Pilula tom="atencao">{e.fora_do_efetivo} fora do efetivo</Pilula></div>}</td>
                  <td className={td}><Calculado rota={`/equipes/${e.id}/memoria`} chave="hh_disponivel">{fmt(e.hh_disponivel_dia)}</Calculado></td>
                  <td className={`${td} whitespace-nowrap`}>{pode('planejador') && <>
                    <button type="button" className="font-semibold text-m-accent" onClick={() => { setErro(null); setForm({ ...e }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Editar</button>
                    <button type="button" aria-label={`Excluir ${e.nome}`} className="ml-3 p-1 align-middle text-m-text-muted hover:text-m-danger" onClick={() => excluir([e.id])}><Trash2 size={15} /></button>
                  </>}</td>
                </tr>
                {aberta === e.id && (
                  <tr><td colSpan={8} className="bg-m-surface-active px-4 py-3">
                    {e.membros.length ? <PessoasDaEquipe membros={e.membros} /> : <span className="text-[13px] text-m-text-muted">Sem funcionários cadastrados.</span>}
                    {e.equipamentos && <div className="mt-2 text-[13px] text-m-text-secondary">Equipamentos (Simova): {e.equipamentos}</div>}
                  </td></tr>
                )}
              </Fragment>
            ))}
          </Tabela>
        </Painel>
      </div>
    </>
  );
}

function PessoasDaEquipe({ membros }: { membros: Equipe['membros'] }) {
  const th = 'px-2 py-1.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.3px] text-m-text-muted';
  const c = 'border-t border-m-stroke-subtle px-2 py-1.5 align-top';
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead><tr><th className={th}>Matrícula</th><th className={th}>Nome</th><th className={th}>Função no efetivo</th><th className={th}>Função na composição</th><th className={th}>Situação</th></tr></thead>
      <tbody>
        {membros.map((m, i) => {
          const p: PessoaEfetivoEquipe | null | undefined = m.efetivo;
          return (
            <tr key={`${m.cracha}-${i}`}>
              <td className={`${c} tabular-nums text-m-text-secondary`}>{semNumero(m.cracha) ? <Pilula tom="atencao">sem matrícula</Pilula> : m.cracha}</td>
              <td className={`${c} font-medium text-m-text-primary`}>{m.nome}{p && p.empresa && p.matricula !== m.cracha && <span className="block text-[11px] font-normal text-m-text-muted">{p.empresa} · mat. {p.matricula}</span>}</td>
              <td className={c}>{p?.funcao ?? <span className="text-m-text-muted">—</span>}</td>
              <td className={c}>{m.funcao ?? p?.funcao_cpu ?? <span className="text-m-text-muted">{p?.funcao ? 'sem de-para' : '—'}</span>}</td>
              <td className={c}>{p
                ? <><Pilula tom={TOM_SITUACAO[p.situacao]}>{ROTULO_SITUACAO[p.situacao]}</Pilula>{!p.no_ultimo_arquivo && <span className="ml-1 text-[11px] text-m-text-muted">fora do último arquivo</span>}</>
                : <Pilula tom="atencao">fora do efetivo</Pilula>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
