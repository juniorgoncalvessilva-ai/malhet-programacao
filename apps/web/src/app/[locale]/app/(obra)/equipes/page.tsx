'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { Botao, Cabecalho, Campo, Erro, Pilula, Painel, Selecao, Tabela, UploadForm, fmt, td } from '@/components/Obra/ui';
import { chaves, useEquipes } from '@/hooks/programacao/queries';
import { useApi } from '@/hooks/programacao/useApi';
import type { ComposicaoEquipe, Equipe } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';

type Form = Omit<Equipe, 'id' | 'hh_disponivel_dia' | 'composicao_efetiva'> & { id?: number };
const NOVA: Form = {
  nome: '', frente_codigo: null, encarregado_cracha: null, encarregado_nome: null, jornada_horas: 9, turno: 'Diurno',
  codigo_simova: null, responsavel: null, equipamentos: null, observacao: null, ativo: true, composicao: [], membros: [],
};
const TURNOS = ['Diurno', 'Noturno', 'Administrativo', 'Turno A', 'Turno B', 'Turno C'];

export default function EquipesPage() {
  const { pode } = useObra();
  const equipes = useEquipes();
  const api = useApi();
  const qc = useQueryClient();
  const recursos = useQuery({ queryKey: ['cpu-recursos'], queryFn: () => api.get<{ recurso: string; tipo: 'MOD' | 'EQU'; composicoes: number }[]>('/cpu/recursos') });
  const [form, setForm] = useState<Form | null>(null);
  const [nova, setNova] = useState<ComposicaoEquipe>({ recurso: '', tipo: 'EQU', quantidade: 1 });
  const [erro, setErro] = useState<unknown>(null);
  const [aberta, setAberta] = useState<number | null>(null);
  const [importando, setImportando] = useState(false);
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const excluir = async (ids: number[]) => {
    const nomes = equipes.data?.filter((e) => ids.includes(e.id)).map((e) => e.nome) ?? [];
    if (!ids.length || !window.confirm(`Excluir ${ids.length === 1 ? `a equipe ${nomes[0]}` : `${ids.length} equipes`}? As linhas de programação que usam a equipe ficam sem equipe (as emissões não mudam).`)) return;
    let ok = 0;
    for (const id of ids) {
      try { await api.del(`/equipes/${id}`); ok++; } catch (er) { toast.error((er as Error).message); }
    }
    if (ok) toast.success(`${ok} equipe(s) excluída(s)`);
    setMarcadas(new Set());
    if (form?.id && ids.includes(form.id)) setForm(null);
    atualizar();
  };
  const atualizar = () => { qc.invalidateQueries({ queryKey: chaves.equipes }); qc.invalidateQueries({ queryKey: ['programacao'] }); };

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
      const r = await api.post<{ criadas: number; atualizadas: number }>('/equipes/importar-simova', fd);
      toast.success(`${r.criadas} equipe(s) nova(s), ${r.atualizadas} atualizada(s)`);
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
  const usaFuncoes = !!form?.membros.some((m) => m.funcao);

  return (
    <>
      <Cabecalho
        eyebrow="Equipes · frentes de trabalho"
        titulo="Quem trabalha em cada frente, em que turno e quanto produz"
        descricao="As equipes vêm do cadastro do Simova (encarregado e funcionários pelo crachá). Aqui você completa turno, jornada, responsável e a função de cada pessoa: a programação usa isso para calcular a capacidade e o gargalo pela CPU."
        acoes={pode('planejador') && <Botao variante="secundario" onClick={() => { setErro(null); setForm({ ...NOVA, composicao: [], membros: [] }); }}><Plus size={16} /> Nova equipe</Botao>}
      />
      <div className="flex flex-col gap-4">
        {pode('planejador') && (
          <Painel titulo="Importar equipes do Simova" subtitulo="Exportação do cadastro de equipes (Código, Descrição, Encarregado, Funcionário, Equipamento, Ativo). Reimportar atualiza pelo código e mantém turno, jornada, responsável e funções.">
            <UploadForm campos={[{ nome: 'arquivo', rotulo: 'Equipe.xlsx' }]} rotulo="Importar" pendente={importando} onEnviar={importarSimova} />
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
              <Campo rotulo="Crachá do encarregado" value={form.encarregado_cracha ?? ''} onChange={(e) => setForm({ ...form, encarregado_cracha: e.target.value || null })} />
              <div className="md:col-span-2"><Campo rotulo="Encarregado" value={form.encarregado_nome ?? ''} onChange={(e) => setForm({ ...form, encarregado_nome: e.target.value || null })} /></div>
              <div className="md:col-span-2"><Campo rotulo="Responsável (supervisor/engenheiro)" value={form.responsavel ?? ''} onChange={(e) => setForm({ ...form, responsavel: e.target.value || null })} /></div>
              <Campo rotulo="Frente" value={form.frente_codigo ?? ''} onChange={(e) => setForm({ ...form, frente_codigo: e.target.value || null })} />

              <div className="md:col-span-6">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Funcionários ({form.membros.length}) · informe a função para a capacidade sair pela CPU</div>
                <datalist id="funcoes-cpu">{mod.map((r) => <option key={r.recurso} value={r.recurso} />)}</datalist>
                <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
                  {form.membros.map((m, i) => (
                    <div key={m.cracha} className="flex items-center gap-2 rounded-m-md border border-m-stroke-subtle px-2 py-1">
                      <span className="w-[64px] shrink-0 text-xs text-m-text-muted">{m.cracha}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-m-text-primary" title={m.nome}>{m.nome}</span>
                      <input aria-label={`Função de ${m.nome}`} list="funcoes-cpu" placeholder="função" value={m.funcao ?? ''}
                        onChange={(e) => { const ms = [...form.membros]; ms[i] = { ...m, funcao: e.target.value || null }; setForm({ ...form, membros: ms }); }}
                        className="h-8 w-[130px] rounded-[8px] border border-m-stroke bg-m-surface-field px-2 text-[13px]" />
                    </div>
                  ))}
                  {!form.membros.length && <span className="text-[13px] text-m-text-muted">Sem funcionários (importe do Simova).</span>}
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
                  <td className={td}><b className="text-m-text-primary">{e.nome}</b>{e.responsavel && <div className="text-xs text-m-text-muted">resp. {e.responsavel}</div>}</td>
                  <td className={td}>{e.encarregado_nome ?? '—'}<div className="text-xs text-m-text-muted">{e.encarregado_cracha ?? <Pilula tom="atencao">sem crachá</Pilula>}</div></td>
                  <td className={td}>{e.turno ?? 'Diurno'} · {fmt(e.jornada_horas, 2)} h</td>
                  <td className={td}><div className="flex flex-wrap gap-1">
                    {e.composicao_efetiva.map((c) => <Pilula key={c.recurso + c.tipo} ponto={false} tom={c.tipo === 'MOD' ? 'acento' : 'neutro'}>{fmt(c.quantidade, 0)} {c.recurso}</Pilula>)}
                    {!e.composicao_efetiva.length && <span className="text-xs text-m-text-muted">{e.membros.length} funcionário(s), funções não informadas</span>}
                  </div></td>
                  <td className={td}>{fmt(e.hh_disponivel_dia)}</td>
                  <td className={`${td} whitespace-nowrap`}>{pode('planejador') && <>
                    <button type="button" className="font-semibold text-m-accent" onClick={() => { setErro(null); setForm({ ...e }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Editar</button>
                    <button type="button" aria-label={`Excluir ${e.nome}`} className="ml-3 p-1 align-middle text-m-text-muted hover:text-m-danger" onClick={() => excluir([e.id])}><Trash2 size={15} /></button>
                  </>}</td>
                </tr>
                {aberta === e.id && (
                  <tr><td colSpan={8} className="bg-m-surface-active px-4 py-3">
                    <div className="grid gap-x-6 gap-y-1 text-[13px] md:grid-cols-2 xl:grid-cols-3">
                      {e.membros.map((m) => <div key={m.cracha}><span className="text-m-text-muted">{m.cracha}</span> · {m.nome}{m.funcao ? <b className="text-m-text-primary"> · {m.funcao}</b> : ''}</div>)}
                      {!e.membros.length && <span className="text-m-text-muted">Sem funcionários cadastrados.</span>}
                    </div>
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
