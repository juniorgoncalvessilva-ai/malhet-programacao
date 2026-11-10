'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Botao, Cabecalho, Campo, Erro, Pilula, Painel, Selecao, Tabela, fmt, td } from '@/components/Obra/ui';
import { chaves, useEquipes } from '@/hooks/programacao/queries';
import { useApi } from '@/hooks/programacao/useApi';
import type { ComposicaoEquipe, Equipe } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';

type Form = Omit<Equipe, 'id' | 'hh_disponivel_dia'> & { id?: number };
const NOVA: Form = { nome: '', frente_codigo: null, encarregado_cracha: null, encarregado_nome: null, jornada_horas: 9, observacao: null, ativo: true, composicao: [] };

export default function EquipesPage() {
  const { pode } = useObra();
  const equipes = useEquipes();
  const api = useApi();
  const qc = useQueryClient();
  const recursos = useQuery({ queryKey: ['cpu-recursos'], queryFn: () => api.get<{ recurso: string; tipo: 'MOD' | 'EQU'; composicoes: number }[]>('/cpu/recursos') });
  const [form, setForm] = useState<Form | null>(null);
  const [nova, setNova] = useState<ComposicaoEquipe>({ recurso: '', tipo: 'MOD', quantidade: 1 });
  const [erro, setErro] = useState<unknown>(null);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    try {
      if (form.id) await api.put(`/equipes/${form.id}`, form); else await api.post('/equipes', form);
      toast.success('Equipe salva');
      setForm(null);
      setErro(null);
      qc.invalidateQueries({ queryKey: chaves.equipes });
      qc.invalidateQueries({ queryKey: ['programacao'] });
    } catch (er) { setErro(er); }
  };
  const tipoDe = (nome: string) => recursos.data?.find((r) => r.recurso.toLowerCase() === nome.trim().toLowerCase())?.tipo;
  const addFuncao = () => {
    if (!form || !nova.recurso.trim()) return;
    const recurso = recursos.data?.find((r) => r.recurso.toLowerCase() === nova.recurso.trim().toLowerCase())?.recurso ?? nova.recurso.trim();
    setForm({ ...form, composicao: [...form.composicao.filter((c) => c.recurso !== recurso), { ...nova, recurso, tipo: tipoDe(recurso) ?? nova.tipo }] });
    setNova({ recurso: '', tipo: 'MOD', quantidade: 1 });
  };
  const naCpu = new Set(recursos.data?.map((r) => r.recurso.toLowerCase()));

  return (
    <>
      <Cabecalho
        eyebrow="Equipes · frentes de trabalho"
        titulo="Quem trabalha em cada frente e quanto a equipe produz"
        descricao="Cada equipe tem um encarregado (crachá do Simova) e a composição por função. Use os mesmos nomes da CPU da obra (Pedreiro, Servente, Escavadeira…): é com eles que a programação calcula a capacidade da equipe e o gargalo."
        acoes={pode('planejador') && <Botao onClick={() => { setErro(null); setForm({ ...NOVA, composicao: [] }); }}><Plus size={16} /> Nova equipe</Botao>}
      />
      <div className="flex flex-col gap-4">
        {form && (
          <Painel titulo={form.id ? `Editar ${form.nome}` : 'Nova equipe'}>
            <form onSubmit={salvar} className="grid gap-3 md:grid-cols-5">
              <Campo rotulo="Nome da equipe" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              <Campo rotulo="Crachá do encarregado (Simova)" value={form.encarregado_cracha ?? ''} onChange={(e) => setForm({ ...form, encarregado_cracha: e.target.value || null })} />
              <Campo rotulo="Nome do encarregado" value={form.encarregado_nome ?? ''} onChange={(e) => setForm({ ...form, encarregado_nome: e.target.value || null })} />
              <Campo rotulo="Frente" value={form.frente_codigo ?? ''} onChange={(e) => setForm({ ...form, frente_codigo: e.target.value || null })} />
              <Campo rotulo="Jornada (h/dia)" type="number" step="0.1" min="1" value={form.jornada_horas} onChange={(e) => setForm({ ...form, jornada_horas: Number(e.target.value) })} />

              <div className="md:col-span-5">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Composição</div>
                <div className="flex flex-wrap gap-2">
                  {form.composicao.map((c, i) => (
                    <div key={c.recurso} className="flex items-center gap-1.5 rounded-m-md border border-m-stroke px-2 py-1">
                      <input aria-label={`Quantidade de ${c.recurso}`} type="number" min="0" step="1" value={c.quantidade}
                        onChange={(e) => { const comp = [...form.composicao]; comp[i] = { ...c, quantidade: Number(e.target.value) }; setForm({ ...form, composicao: comp }); }}
                        className="h-8 w-14 rounded-[8px] border border-m-stroke bg-m-surface-field px-1.5 text-right text-[13px]" />
                      <span className="text-[13px] text-m-text-primary">{c.recurso}</span>
                      <Pilula ponto={false} tom={c.tipo === 'MOD' ? 'acento' : 'neutro'}>{c.tipo}</Pilula>
                      {recursos.data?.length ? !naCpu.has(c.recurso.toLowerCase()) && <Pilula tom="atencao">fora da CPU</Pilula> : null}
                      <button type="button" aria-label={`Remover ${c.recurso}`} className="p-1 text-m-text-muted hover:text-m-danger" onClick={() => setForm({ ...form, composicao: form.composicao.filter((x) => x !== c) })}><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {!form.composicao.length && <span className="text-[13px] text-m-text-muted">Nenhuma função ainda.</span>}
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-2 md:col-span-5">
                <Campo rotulo="Função ou equipamento" list="recursos-cpu" placeholder="Pedreiro" value={nova.recurso} className="w-[280px]"
                  onChange={(e) => setNova({ ...nova, recurso: e.target.value, tipo: tipoDe(e.target.value) ?? nova.tipo })} />
                <datalist id="recursos-cpu">{recursos.data?.map((r) => <option key={`${r.recurso}${r.tipo}`} value={r.recurso}>{r.tipo} · em {r.composicoes} composições</option>)}</datalist>
                <Selecao rotulo="Tipo" value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value as 'MOD' | 'EQU' })} className="w-[110px]">
                  <option value="MOD">MOD</option><option value="EQU">EQU</option>
                </Selecao>
                <Campo rotulo="Qtd." type="number" min="0" step="1" value={nova.quantidade} className="w-[90px]" onChange={(e) => setNova({ ...nova, quantidade: Number(e.target.value) })} />
                <Botao type="button" variante="secundario" onClick={addFuncao}><Plus size={16} /> Função</Botao>
              </div>
              <div className="flex items-center gap-2 md:col-span-5"><Botao type="submit">Salvar</Botao><Botao type="button" variante="secundario" onClick={() => setForm(null)}>Cancelar</Botao><Erro erro={erro} /></div>
            </form>
          </Painel>
        )}
        <Painel titulo={`Equipes (${equipes.data?.length ?? 0})`}>
          <Tabela cabecalho={['Equipe', 'Encarregado', 'Crachá', 'Composição', 'HH/dia (MOD)', '']} vazio={!equipes.data?.length && 'Crie a primeira equipe.'}>
            {equipes.data?.map((e) => (
              <tr key={e.id}>
                <td className={td}>{e.nome}<div className="text-xs text-m-text-muted">{e.observacao}</div></td>
                <td className={td}>{e.encarregado_nome ?? '—'}</td>
                <td className={td}>{e.encarregado_cracha ?? <Pilula tom="atencao">informe</Pilula>}</td>
                <td className={td}><div className="flex flex-wrap gap-1">{e.composicao.map((c) => <Pilula key={c.recurso} ponto={false} tom={c.tipo === 'MOD' ? 'acento' : 'neutro'}>{fmt(c.quantidade, 0)} {c.recurso}</Pilula>)}</div></td>
                <td className={td}>{fmt(e.hh_disponivel_dia)}</td>
                <td className={td}>{pode('planejador') && <button type="button" className="font-semibold text-m-accent" onClick={() => { setErro(null); setForm({ ...e }); }}>Editar</button>}</td>
              </tr>
            ))}
          </Tabela>
        </Painel>
      </div>
    </>
  );
}
