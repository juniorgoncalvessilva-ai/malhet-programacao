'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { BuscaEfetivo } from '@/components/Obra/BuscaEfetivo';
import { Botao, Campo, Erro, Selecao } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import type { Colaborador, Treinamento } from '@/lib/api/types';
import { RESULTADOS_ASO, TIPOS_ASO, hojeISO } from '@/lib/treinamentos/validade';

/** Registrar um ASO (spec 088). Com `colaboradorId` a pessoa já vem escolhida (ficha, mobilização). */
export function FormAso({ colaboradorId, pessoas, onFeito, onCancelar }: {
  colaboradorId?: number; pessoas?: Colaborador[]; onFeito?: () => void; onCancelar?: () => void;
}) {
  const api = useApi();
  const [pessoa, setPessoa] = useState<Colaborador | null>(null);
  const [f, setF] = useState({ tipo: 'ADMISSIONAL', data_exame: hojeISO(), valido_ate: '', resultado: 'APTO', clinica: '', observacao: '' });
  const [erro, setErro] = useState<unknown>(null);
  const [salvando, setSalvando] = useState(false);
  const cid = colaboradorId ?? pessoa?.id;
  const salvar = async () => {
    if (!cid) return;
    setSalvando(true);
    try {
      await api.post('/treinamentos/asos', { ...f, colaborador_id: cid, valido_ate: f.valido_ate || null });
      toast.success('ASO registrado');
      setErro(null); setPessoa(null); onFeito?.();
    } catch (e) { setErro(e); } finally { setSalvando(false); }
  };
  return (
    <div className="grid gap-3 rounded-m-lg border border-m-accent/40 bg-m-accent-subtle/40 p-4 md:grid-cols-4" aria-label="Registrar ASO">
      {!colaboradorId && pessoas && (
        <div className="md:col-span-4">
          {pessoa ? <p className="text-[13px]">Pessoa: <b>{pessoa.nome}</b> <button type="button" className="ml-2 text-[12px] font-semibold text-m-accent underline" onClick={() => setPessoa(null)}>trocar</button></p>
            : <BuscaEfetivo rotulo="Pessoa" pessoas={pessoas} onEscolher={setPessoa} placeholder="nome, matrícula ou função" />}
        </div>
      )}
      <Selecao rotulo="Tipo do exame" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
        {TIPOS_ASO.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
      </Selecao>
      <Campo rotulo="Data do exame" type="date" max={hojeISO()} value={f.data_exame} onChange={(e) => setF({ ...f, data_exame: e.target.value })} />
      <Campo rotulo="Válido até (vazio = 12 meses)" type="date" value={f.valido_ate} onChange={(e) => setF({ ...f, valido_ate: e.target.value })} />
      <Selecao rotulo="Resultado" value={f.resultado} onChange={(e) => setF({ ...f, resultado: e.target.value })}>
        {RESULTADOS_ASO.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
      </Selecao>
      <Campo rotulo="Clínica" value={f.clinica} onChange={(e) => setF({ ...f, clinica: e.target.value })} />
      <Campo rotulo="Observação (sem diagnóstico)" className="md:col-span-3" value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} />
      <div className="flex flex-wrap items-center gap-2 md:col-span-4">
        <Botao disabled={!cid || salvando || !f.data_exame} onClick={salvar}>{salvando ? 'Salvando…' : 'Registrar ASO'}</Botao>
        {onCancelar && <Botao variante="secundario" onClick={onCancelar}>Cancelar</Botao>}
        <span className="text-[12px] text-m-text-muted">Só o resultado e as datas (NR-7). Diagnóstico e CID não entram.</span>
        <Erro erro={erro} />
      </div>
    </div>
  );
}

/** Registrar uma turma: o mesmo treinamento, na mesma data, para várias pessoas. */
export function FormTurma({ treinamentos, pessoas, colaboradorId, treinamentoId, onFeito, onCancelar }: {
  treinamentos: Treinamento[]; pessoas?: Colaborador[]; colaboradorId?: number; treinamentoId?: number;
  onFeito?: () => void; onCancelar?: () => void;
}) {
  const api = useApi();
  const [sel, setSel] = useState<Colaborador[]>([]);
  const [f, setF] = useState({ treinamento_id: treinamentoId ? String(treinamentoId) : '', realizado_em: hojeISO(), valido_ate: '', entidade: '' });
  const [erro, setErro] = useState<unknown>(null);
  const [salvando, setSalvando] = useState(false);
  const ids = colaboradorId ? [colaboradorId] : sel.map((p) => p.id);
  const t = treinamentos.find((x) => String(x.id) === f.treinamento_id);
  const salvar = async () => {
    setSalvando(true);
    try {
      await api.post('/treinamentos/registros', { treinamento_id: Number(f.treinamento_id), colaboradores: ids,
        realizado_em: f.realizado_em, valido_ate: f.valido_ate || null, entidade: f.entidade || null });
      toast.success(`${t?.nome}: ${ids.length} pessoa(s) registrada(s)`);
      setSel([]); setErro(null); onFeito?.();
    } catch (e) { setErro(e); } finally { setSalvando(false); }
  };
  return (
    <div className="grid gap-3 rounded-m-lg border border-m-accent/40 bg-m-accent-subtle/40 p-4 md:grid-cols-4" aria-label="Registrar treinamento">
      <Selecao rotulo="Treinamento" value={f.treinamento_id} onChange={(e) => setF({ ...f, treinamento_id: e.target.value })}>
        <option value="">Escolha…</option>
        {treinamentos.filter((x) => x.ativo).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
      </Selecao>
      <Campo rotulo="Realizado em" type="date" max={hojeISO()} value={f.realizado_em} onChange={(e) => setF({ ...f, realizado_em: e.target.value })} />
      <Campo rotulo={t ? (t.validade_meses ? `Válido até (vazio = ${t.validade_meses} meses)` : 'Válido até (não vence)') : 'Válido até'} type="date" value={f.valido_ate} onChange={(e) => setF({ ...f, valido_ate: e.target.value })} />
      <Campo rotulo="Quem ministrou" value={f.entidade} onChange={(e) => setF({ ...f, entidade: e.target.value })} />
      {!colaboradorId && pessoas && (
        <div className="flex flex-col gap-2 md:col-span-4">
          <BuscaEfetivo rotulo={`Participantes (${sel.length})`} pessoas={pessoas} manterAberto excluir={sel.map((p) => p.cracha ?? p.matricula ?? '')}
            onEscolher={(p) => setSel((x) => (x.some((y) => y.id === p.id) ? x : [...x, p]))} placeholder="adicione as pessoas da turma" />
          <div className="flex flex-wrap gap-1.5">
            {sel.map((p) => (
              <button key={p.id} type="button" onClick={() => setSel((x) => x.filter((y) => y.id !== p.id))}
                className="rounded-full border border-m-stroke bg-m-surface-raised px-2.5 py-1 text-[12px] text-m-text-primary hover:border-m-danger" title="Tirar da turma">{p.nome} ✕</button>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 md:col-span-4">
        <Botao disabled={!f.treinamento_id || !ids.length || salvando} onClick={salvar}>{salvando ? 'Salvando…' : `Registrar ${ids.length > 1 ? `turma (${ids.length})` : 'treinamento'}`}</Botao>
        {onCancelar && <Botao variante="secundario" onClick={onCancelar}>Cancelar</Botao>}
        <Erro erro={erro} />
      </div>
    </div>
  );
}
