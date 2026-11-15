'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Calculado } from '@/components/Obra/Calculado';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Carregando, LinhasCarregando } from '@/components/Obra/Esqueleto';
import { Botao, CARREGANDO, Campo, Chip, Erro, Indicador, Painel, Pilula, Selecao, Tabela, dataBR, td, tdNum } from '@/components/Obra/ui';
import { FormAso, FormTurma } from '@/components/Treinamentos/Formularios';
import { useEfetivo } from '@/hooks/programacao/planejamento';
import {
  useAsos, useExigencias, useIndicadoresTreinamentos, useMatrizTreinamentos, useRegistrosTreinamento, useTreinamentos,
} from '@/hooks/programacao/treinamentos';
import { useApi } from '@/hooks/programacao/useApi';
import type { Treinamento, Validade } from '@/lib/api/types';
import { VALIDADE } from '@/lib/treinamentos/validade';
import { cn } from '@/lib/utils';

const SIT_ASO: Validade[] = ['VALIDO', 'VENCENDO', 'VENCIDO'];

/** Aba ASOs: lista com filtro por situação e registro de exame (spec 088). */
export function AbaAsos({ podeEditar, onFicha }: { podeEditar: boolean; onFicha?: (id: number) => void }) {
  const asos = useAsos();
  const efetivo = useEfetivo();
  const api = useApi();
  const confirmar = useConfirmar();
  const [novo, setNovo] = useState(false);
  const [q, setQ] = useState('');
  const [fSit, setFSit] = useState<Set<Validade>>(new Set());
  const [soVigente, setSoVigente] = useState(true);
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    let xs = asos.data ?? [];
    if (soVigente) { // o mais recente de cada pessoa (não demissional)
      const vistos = new Set<number>();
      xs = xs.filter((a) => a.tipo !== 'DEMISSIONAL' && !vistos.has(a.colaborador_id) && vistos.add(a.colaborador_id));
    }
    return xs.filter((a) => (!fSit.size || fSit.has(a.situacao)) && (!t || (a.nome ?? '').toLowerCase().includes(t)));
  }, [asos.data, q, fSit, soVigente]);
  return (
    <Painel titulo="Quem está com o ASO em dia?" subtitulo={`${lista.length} exame(s)`} acoes={podeEditar && <Botao onClick={() => setNovo(!novo)}><Plus size={16} /> Registrar ASO</Botao>}>
      {novo && <FormAso pessoas={efetivo.data ?? []} onFeito={() => setNovo(false)} onCancelar={() => setNovo(false)} />}
      <div className="flex flex-wrap items-end gap-2">
        {SIT_ASO.map((s) => <Chip key={s} ativo={fSit.has(s)} onClick={() => setFSit((x) => { const n = new Set(x); if (n.has(s)) n.delete(s); else n.add(s); return n; })}>{VALIDADE[s].rotulo}</Chip>)}
        <Campo rotulo="Buscar" placeholder="nome" value={q} onChange={(e) => setQ(e.target.value)} className="w-[240px]" />
        <label className="flex items-center gap-2 pb-2.5 text-[13px] text-m-text-secondary"><input type="checkbox" checked={soVigente} onChange={(e) => setSoVigente(e.target.checked)} /> Só o vigente de cada pessoa</label>
      </div>
      <Tabela cabecalho={['Pessoa', 'Tipo', 'Exame', 'Válido até', 'Resultado', 'Situação', '']} vazio={asos.isLoading ? CARREGANDO : !lista.length && 'Nenhum ASO com esses filtros.'}>
        {lista.map((a) => (
          <tr key={a.id}>
            <td className={td}>{onFicha ? <button type="button" className="font-semibold text-m-text-primary hover:text-m-accent hover:underline" onClick={() => onFicha(a.colaborador_id)}>{a.nome}</button> : <b>{a.nome}</b>}</td>
            <td className={td}>{a.tipo_rotulo}{a.clinica && <div className="text-[11px] text-m-text-muted">{a.clinica}</div>}</td>
            <td className={tdNum}>{dataBR(a.data_exame)}</td>
            <td className={tdNum}>{dataBR(a.valido_ate)}<div className="text-[11px] text-m-text-muted">{a.dias_para_vencer >= 0 ? `faltam ${a.dias_para_vencer} d` : `venceu há ${-a.dias_para_vencer} d`}</div></td>
            <td className={td}>{a.resultado_rotulo}</td>
            <td className={td}><Pilula tom={VALIDADE[a.situacao].tom}>{a.resultado === 'INAPTO' ? 'Inapto' : VALIDADE[a.situacao].rotulo}</Pilula></td>
            <td className={td}>{podeEditar && <button type="button" aria-label={`Excluir ASO de ${a.nome}`} className="text-m-text-muted hover:text-m-danger"
              onClick={() => confirmar({ titulo: `Excluir o ASO de ${a.nome} (${dataBR(a.data_exame)})?`, executar: () => api.del(`/treinamentos/asos/${a.id}`) })}><Trash2 size={15} /></button>}</td>
          </tr>
        ))}
      </Tabela>
    </Painel>
  );
}

type FormT = { nome: string; norma: string; validade_meses: string; carga_horaria: string; impeditivo: boolean; todos: boolean; ativo: boolean };
const NOVO_T: FormT = { nome: '', norma: '', validade_meses: '12', carga_horaria: '', impeditivo: false, todos: false, ativo: true };

/** Aba Treinamentos: catálogo (validade, impeditivo, exigido de todos) e as turmas registradas. */
export function AbaTreinamentos({ podeEditar }: { podeEditar: boolean }) {
  const cat = useTreinamentos();
  const efetivo = useEfetivo();
  const api = useApi();
  const confirmar = useConfirmar();
  const [ed, setEd] = useState<{ id: number | null; f: FormT } | null>(null);
  const [turma, setTurma] = useState<number | null | 'nova'>(null);
  const [verRegs, setVerRegs] = useState<number | null>(null);
  const regs = useRegistrosTreinamento(verRegs);
  const [erro, setErro] = useState<unknown>(null);
  const salvar = async () => {
    if (!ed) return;
    const corpo = { ...ed.f, validade_meses: Number(ed.f.validade_meses) || 0, carga_horaria: ed.f.carga_horaria ? Number(ed.f.carga_horaria) : null, norma: ed.f.norma || null };
    try {
      if (ed.id) await api.put(`/treinamentos/catalogo/${ed.id}`, corpo); else await api.post('/treinamentos/catalogo', corpo);
      toast.success('Treinamento salvo'); setEd(null); setErro(null);
    } catch (e) { setErro(e); }
  };
  const editar = (t: Treinamento) => setEd({ id: t.id, f: { nome: t.nome, norma: t.norma ?? '', validade_meses: String(t.validade_meses), carga_horaria: t.carga_horaria != null ? String(t.carga_horaria) : '', impeditivo: t.impeditivo, todos: t.todos, ativo: t.ativo } });
  return (
    <>
      <Painel titulo="Quais treinamentos a obra controla?" subtitulo="Validade em meses (0 = não vence). Impeditivo: sem ele válido a pessoa não trabalha. Todos: exigido de todo o efetivo."
        acoes={podeEditar && <>
          <Botao variante="secundario" onClick={() => setTurma(turma === 'nova' ? null : 'nova')}><Plus size={16} /> Registrar turma</Botao>
          <Botao onClick={() => setEd({ id: null, f: NOVO_T })}><Plus size={16} /> Novo treinamento</Botao>
        </>}>
        {turma != null && <FormTurma treinamentos={cat.data ?? []} pessoas={efetivo.data ?? []} treinamentoId={turma === 'nova' ? undefined : turma} onFeito={() => setTurma(null)} onCancelar={() => setTurma(null)} />}
        {ed && (
          <div className="grid gap-3 rounded-m-lg border border-m-accent/40 bg-m-accent-subtle/40 p-4 md:grid-cols-4">
            <Campo rotulo="Nome" required className="md:col-span-2" value={ed.f.nome} onChange={(e) => setEd({ ...ed, f: { ...ed.f, nome: e.target.value } })} />
            <Campo rotulo="Norma" placeholder="NR-35" value={ed.f.norma} onChange={(e) => setEd({ ...ed, f: { ...ed.f, norma: e.target.value } })} />
            <Campo rotulo="Validade (meses)" type="number" min={0} max={120} value={ed.f.validade_meses} onChange={(e) => setEd({ ...ed, f: { ...ed.f, validade_meses: e.target.value } })} />
            <Campo rotulo="Carga horária (h)" type="number" step="0.5" value={ed.f.carga_horaria} onChange={(e) => setEd({ ...ed, f: { ...ed.f, carga_horaria: e.target.value } })} />
            <div className="flex flex-wrap items-center gap-4 pt-5 text-[13px] text-m-text-secondary md:col-span-3">
              <label className="flex items-center gap-2"><input type="checkbox" checked={ed.f.impeditivo} onChange={(e) => setEd({ ...ed, f: { ...ed.f, impeditivo: e.target.checked } })} /> Impeditivo</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={ed.f.todos} onChange={(e) => setEd({ ...ed, f: { ...ed.f, todos: e.target.checked } })} /> Exigido de todos</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={ed.f.ativo} onChange={(e) => setEd({ ...ed, f: { ...ed.f, ativo: e.target.checked } })} /> Ativo</label>
            </div>
            <div className="flex items-center gap-2 md:col-span-4">
              <Botao disabled={ed.f.nome.trim().length < 2} onClick={salvar}>Salvar</Botao>
              <Botao variante="secundario" onClick={() => setEd(null)}>Cancelar</Botao>
              <Erro erro={erro} />
            </div>
          </div>
        )}
        <Tabela cabecalho={['Treinamento', 'Validade', 'Carga', 'Regra', 'Funções', 'Registros', '']} direita={[4, 5]} vazio={cat.isLoading ? CARREGANDO : !cat.data?.length && 'Cadastre os treinamentos da obra.'}>
          {(cat.data ?? []).map((t) => (
            <tr key={t.id} className={t.ativo ? '' : 'opacity-60'}>
              <td className={td}><b className="text-m-text-primary">{t.nome}</b>{t.norma && <div className="text-[11px] text-m-text-muted">{t.norma}</div>}</td>
              <td className={td}>{t.validade_meses ? `${t.validade_meses} meses` : 'não vence'}</td>
              <td className={td}>{t.carga_horaria ? `${t.carga_horaria} h` : '—'}</td>
              <td className={td}><div className="flex flex-wrap gap-1">{t.impeditivo && <Pilula tom="perigo">impeditivo</Pilula>}{t.todos && <Pilula tom="info">todos</Pilula>}{!t.ativo && <Pilula>inativo</Pilula>}</div></td>
              <td className={tdNum}>{t.funcoes}</td>
              <td className={tdNum}><button type="button" className="font-semibold text-m-accent underline" onClick={() => setVerRegs(verRegs === t.id ? null : t.id)}>{t.registros}</button></td>
              <td className={td}>{podeEditar && <div className="flex items-center gap-2">
                <button type="button" title="Registrar turma" className="text-[12px] font-semibold text-m-accent" onClick={() => setTurma(t.id)}>+ turma</button>
                <button type="button" aria-label={`Editar ${t.nome}`} className="text-m-text-muted hover:text-m-accent" onClick={() => editar(t)}><Pencil size={14} /></button>
                <button type="button" aria-label={`Excluir ${t.nome}`} className="text-m-text-muted hover:text-m-danger"
                  onClick={() => confirmar({ titulo: `Excluir o treinamento ${t.nome}?`, mensagem: 'Só sai sem registros de pessoas; com registros, desative.', executar: () => api.del(`/treinamentos/catalogo/${t.id}`) })}><Trash2 size={14} /></button>
              </div>}</td>
            </tr>
          ))}
        </Tabela>
      </Painel>
      {verRegs && (
        <Painel titulo={`Quem fez ${cat.data?.find((t) => t.id === verRegs)?.nome ?? ''}?`} acoes={<Botao variante="secundario" onClick={() => setVerRegs(null)}>Fechar</Botao>}>
          <Tabela cabecalho={['Pessoa', 'Realizado', 'Válido até', 'Quem ministrou', 'Situação', '']} vazio={regs.isLoading ? CARREGANDO : !regs.data?.length && 'Ninguém registrado.'}>
            {(regs.data ?? []).map((r) => (
              <tr key={r.id}>
                <td className={td}><b className="text-m-text-primary">{r.nome}</b></td>
                <td className={tdNum}>{dataBR(r.realizado_em)}</td>
                <td className={tdNum}>{r.valido_ate ? dataBR(r.valido_ate) : 'não vence'}</td>
                <td className={td}>{r.entidade ?? '—'}</td>
                <td className={td}><Pilula tom={VALIDADE[r.situacao].tom}>{VALIDADE[r.situacao].rotulo}</Pilula></td>
                <td className={td}>{podeEditar && <button type="button" aria-label={`Excluir registro de ${r.nome}`} className="text-m-text-muted hover:text-m-danger"
                  onClick={() => confirmar({ titulo: `Excluir o registro de ${r.nome}?`, executar: () => api.del(`/treinamentos/registros/${r.id}`) })}><Trash2 size={14} /></button>}</td>
              </tr>
            ))}
          </Tabela>
        </Painel>
      )}
    </>
  );
}

/** Aba Exigência por função: cada função do efetivo marca os treinamentos exigidos. */
export function AbaExigencias({ podeEditar }: { podeEditar: boolean }) {
  const ex = useExigencias();
  const cat = useTreinamentos();
  const api = useApi();
  const ts = (cat.data ?? []).filter((t) => t.ativo && !t.todos);
  const todos = (cat.data ?? []).filter((t) => t.ativo && t.todos);
  const [q, setQ] = useState('');
  const alternar = async (fch: string, atuais: number[], tid: number) => {
    const novos = atuais.includes(tid) ? atuais.filter((x) => x !== tid) : [...atuais, tid];
    try { await api.put('/treinamentos/exigencias', { funcao_chave: fch, treinamentos: novos }); } catch (e) { toast.error((e as Error).message); }
  };
  const lista = (ex.data ?? []).filter((f) => !q || f.funcao.toLowerCase().includes(q.toLowerCase()));
  return (
    <Painel titulo="Que treinamentos cada função precisa ter?" subtitulo={todos.length ? `Exigidos de todos: ${todos.map((t) => t.nome).join(', ')}` : 'Funções do efetivo ativo e em mobilização'}>
      <Campo rotulo="Buscar função" value={q} onChange={(e) => setQ(e.target.value)} className="w-[260px]" />
      {!ts.length && !cat.isLoading && <p className="text-[13px] text-m-text-muted">Cadastre os treinamentos na aba Treinamentos (os marcados “todos” valem para qualquer função).</p>}
      <div className="-mx-1 max-h-[65vh] overflow-auto px-1">
        <table className="w-full border-separate border-spacing-0 text-[12.5px]">
          <thead className="sticky top-0 z-10 bg-m-surface-raised">
            <tr className="text-left text-[10.5px] font-semibold uppercase tracking-[0.3px] text-m-text-muted">
              <th className="px-2 py-2">Função</th><th className="px-2 py-2 text-right">Pessoas</th>
              {ts.map((t) => <th key={t.id} className="px-2 py-2 text-center" title={t.nome}><span className="inline-block max-w-[110px] truncate align-bottom">{t.nome}</span></th>)}
            </tr>
          </thead>
          <tbody>
            {ex.isLoading && <LinhasCarregando colunas={2 + ts.length} />}
            {lista.map((f) => (
              <tr key={f.funcao_chave} className="hover:bg-m-surface-hover">
                <td className="border-b border-m-row px-2 py-1.5 font-semibold text-m-text-primary">{f.funcao}</td>
                <td className="border-b border-m-row px-2 py-1.5 text-right tabular-nums">{f.pessoas}</td>
                {ts.map((t) => (
                  <td key={t.id} className="border-b border-m-row px-2 py-1.5 text-center">
                    <input type="checkbox" aria-label={`${f.funcao} exige ${t.nome}`} disabled={!podeEditar} checked={f.treinamentos.includes(t.id)} onChange={() => alternar(f.funcao_chave, f.treinamentos, t.id)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Painel>
  );
}

const CEL: Record<Validade, string> = { VALIDO: 'bg-m-success-subtle text-m-success', VENCENDO: 'bg-m-warning-subtle text-m-warning', VENCIDO: 'bg-m-danger-subtle text-m-danger', FALTANDO: 'bg-m-danger-subtle/60 text-m-danger' };
const SIMBOLO: Record<Validade, string> = { VALIDO: '✔', VENCENDO: '!', VENCIDO: '✖', FALTANDO: '—' };

/** Aba Matriz: pessoa × treinamento exigido, com o ASO e quem está impedido. */
export function AbaMatriz({ onFicha }: { onFicha?: (id: number) => void }) {
  const mz = useMatrizTreinamentos();
  const [q, setQ] = useState('');
  const [soImpedidos, setSoImpedidos] = useState(false);
  if (!mz.data) return <Carregando />;
  const t = q.trim().toLowerCase();
  const pessoas = mz.data.pessoas.filter((p) => (!soImpedidos || p.impedida) && (!t || `${p.nome} ${p.funcao ?? ''}`.toLowerCase().includes(t)));
  return (
    <Painel titulo="Quem está com tudo em dia?" subtitulo={`${pessoas.length} pessoa(s) · ✔ válido · ! vencendo · ✖ vencido · — faltando · vazio = não exigido`}>
      <div className="flex flex-wrap items-end gap-2">
        <Campo rotulo="Buscar" placeholder="nome ou função" value={q} onChange={(e) => setQ(e.target.value)} className="w-[260px]" />
        <label className="flex items-center gap-2 pb-2.5 text-[13px] text-m-text-secondary"><input type="checkbox" checked={soImpedidos} onChange={(e) => setSoImpedidos(e.target.checked)} /> Só impedidos</label>
      </div>
      <div className="-mx-1 max-h-[65vh] overflow-auto px-1">
        <table className="w-full border-separate border-spacing-0 text-[12px]">
          <thead className="sticky top-0 z-10 bg-m-surface-raised">
            <tr className="text-left text-[10.5px] font-semibold uppercase tracking-[0.3px] text-m-text-muted">
              <th className="sticky left-0 bg-m-surface-raised px-2 py-2">Pessoa</th><th className="px-2 py-2 text-center">ASO</th>
              {mz.data.treinamentos.map((x) => <th key={x.id} className="px-1 py-2 text-center" title={x.nome}><span className="inline-block max-w-[90px] truncate align-bottom">{x.nome}</span>{x.impeditivo && <span className="text-m-danger"> *</span>}</th>)}
            </tr>
          </thead>
          <tbody>
            {pessoas.slice(0, 400).map((p) => (
              <tr key={p.id}>
                <td className="sticky left-0 border-b border-m-row bg-m-surface-raised px-2 py-1">
                  {onFicha ? <button type="button" className="text-left font-semibold text-m-text-primary hover:text-m-accent hover:underline" onClick={() => onFicha(p.id)}>{p.nome}</button> : <b>{p.nome}</b>}
                  <div className="text-[10.5px] text-m-text-muted">{p.funcao ?? '—'}{p.impedida && <span className="font-semibold text-m-danger"> · impedido</span>}</div>
                </td>
                <td className="border-b border-m-row px-1 py-1 text-center"><span title={p.aso_valido_ate ? `até ${dataBR(p.aso_valido_ate)}` : 'sem ASO'} className={cn('inline-block min-w-[26px] rounded px-1 py-0.5 font-bold', CEL[p.aso])}>{SIMBOLO[p.aso]}</span></td>
                {mz.data!.treinamentos.map((x) => {
                  const c = p.celulas[String(x.id)];
                  return <td key={x.id} className="border-b border-m-row px-1 py-1 text-center">
                    {c && <span title={c.valido_ate ? `até ${dataBR(c.valido_ate)}` : c.situacao === 'FALTANDO' ? 'faltando' : 'não vence'} className={cn('inline-block min-w-[26px] rounded px-1 py-0.5 font-bold', CEL[c.situacao])}>{SIMBOLO[c.situacao]}</span>}
                  </td>;
                })}
              </tr>
            ))}
            {!pessoas.length && <tr><td colSpan={2 + mz.data.treinamentos.length} className="py-6 text-center text-m-text-muted">Ninguém com esses filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      {pessoas.length > 400 && <p className="text-[12px] text-m-text-muted">Mostrando 400 de {pessoas.length}: refine a busca.</p>}
    </Painel>
  );
}

/** Aba Métricas: ASOs e treinamentos válidos/vencendo/vencidos, impedidos, conformidade e vencimentos próximos. */
export function AbaMetricas({ onFicha }: { onFicha?: (id: number) => void }) {
  const [janela, setJanela] = useState(30);
  const m = useIndicadoresTreinamentos(janela);
  if (!m.data) return <Carregando />;
  const d = m.data;
  const c = (k: string, rotulo: string, tom?: 'sucesso' | 'atencao' | 'perigo') => (
    <Indicador rotulo={rotulo} tom={tom} valor={<Calculado chave={k} memoria={() => d.memorias[k]}>{d.memorias[k].valor}</Calculado>} />
  );
  return (
    <>
      <div className="flex flex-wrap items-end gap-2">
        <Selecao rotulo="Vencendo em" value={String(janela)} onChange={(e) => setJanela(Number(e.target.value))} className="w-[160px]">
          {[15, 30, 45, 60, 90].map((x) => <option key={x} value={x}>{x} dias</option>)}
        </Selecao>
        <span className="pb-2.5 text-[12px] text-m-text-muted">{d.pessoas} pessoa(s): efetivo ativo e em mobilização</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        {c('conformidade', 'Conformidade')}
        {c('impedidas', 'Pessoas impedidas', 'perigo')}
        {c('aso_valido', 'ASOs válidos', 'sucesso')}
        {c('aso_vencendo', `ASOs vencendo (${janela} d)`, 'atencao')}
        {c('aso_vencido', 'ASOs vencidos/inaptos', 'perigo')}
        {c('aso_faltando', 'Sem ASO')}
        {c('tr_valido', 'Treinamentos válidos', 'sucesso')}
        {c('tr_vencendo', `Treinamentos vencendo (${janela} d)`, 'atencao')}
        {c('tr_vencido', 'Treinamentos vencidos', 'perigo')}
        {c('tr_faltando', 'Treinamentos faltando')}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Painel titulo="Como está cada treinamento?">
          <Tabela cabecalho={['Treinamento', 'Exigidos', 'Válidos', 'Vencendo', 'Vencidos', 'Faltando']} direita={[1, 2, 3, 4, 5]} vazio={!d.por_treinamento.length && 'Nenhum treinamento exigido.'}>
            {d.por_treinamento.map((t) => (
              <tr key={t.id}>
                <td className={td}><b className="text-m-text-primary">{t.nome}</b>{t.impeditivo && <span className="ml-1 text-[11px] font-semibold text-m-danger">impeditivo</span>}</td>
                <td className={tdNum}>{t.exigidos}</td><td className={tdNum}>{t.VALIDO}</td><td className={tdNum}>{t.VENCENDO}</td>
                <td className={tdNum}>{t.VENCIDO}</td><td className={tdNum}>{t.FALTANDO}</td>
              </tr>
            ))}
          </Tabela>
        </Painel>
        <Painel titulo="O que vence nos próximos 60 dias?">
          <Tabela cabecalho={['Pessoa', 'Item', 'Vence em', 'Faltam']} direita={[3]} vazio={!d.vencimentos.length && 'Nada vence nos próximos 60 dias.'}>
            {d.vencimentos.map((v, i) => (
              <tr key={i}>
                <td className={td}>{onFicha ? <button type="button" className="font-semibold text-m-text-primary hover:text-m-accent hover:underline" onClick={() => onFicha(v.colaborador_id)}>{v.nome}</button> : v.nome}</td>
                <td className={td}>{v.item}</td><td className={tdNum}>{dataBR(v.valido_ate)}</td>
                <td className={tdNum}><span className={v.dias <= 15 ? 'font-semibold text-m-danger' : v.dias <= 30 ? 'font-semibold text-m-warning' : ''}>{v.dias} d</span></td>
              </tr>
            ))}
          </Tabela>
        </Painel>
      </div>
    </>
  );
}
