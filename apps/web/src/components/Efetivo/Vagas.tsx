'use client';

import { Ban, Pencil, Plus, RotateCcw, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Calculado } from '@/components/Obra/Calculado';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Carregando, LinhasCarregando } from '@/components/Obra/Esqueleto';
import { Botao, Campo, Chip, Erro, Indicador, Painel, Pilula, dataBR, fmt } from '@/components/Obra/ui';
import { SeletorFuncao } from '@/components/Efetivo/SeletorFuncao';
import { ETAPAS } from '@/components/Efetivo/Mobilizacao';
import { useTreinamentoPrevisto, useVagas } from '@/hooks/programacao/treinamentos';
import { useApi } from '@/hooks/programacao/useApi';
import type { SituacaoVaga, VagaContratacao } from '@/lib/api/types';
import { cn } from '@/lib/utils';

const TOM: Record<SituacaoVaga, 'info' | 'atencao' | 'sucesso' | 'neutro'> = { ABERTA: 'atencao', EM_ATENDIMENTO: 'info', PREENCHIDA: 'sucesso', CANCELADA: 'neutro' };
const SITS: { v: SituacaoVaga; rotulo: string }[] = [
  { v: 'ABERTA', rotulo: 'Abertas' }, { v: 'EM_ATENDIMENTO', rotulo: 'Em atendimento' }, { v: 'PREENCHIDA', rotulo: 'Preenchidas' }, { v: 'CANCELADA', rotulo: 'Canceladas' },
];
type FormVaga = { funcao: string; quantidade: string; empresa: string; necessario_em: string; destino: string; solicitante: string; justificativa: string };
const VAZIA: FormVaga = { funcao: '', quantidade: '1', empresa: 'Própria', necessario_em: '', destino: '', solicitante: '', justificativa: '' };

/**
 * Vagas (spec 089): o Planejamento abre a janela de contratação (função padronizada, quantidade, quando a obra precisa);
 * o RH vê a função necessária e inicia o ciclo de mobilização pela vaga ("Iniciar contratação").
 */
export function AbaVagas({ planejar, onIniciar }: { planejar: boolean; onIniciar: (vagaId: number) => void }) {
  const vagas = useVagas();
  const api = useApi();
  const confirmar = useConfirmar();
  const [ed, setEd] = useState<{ id: number | null; f: FormVaga } | null>(null);
  const [fSit, setFSit] = useState<Set<SituacaoVaga>>(new Set(['ABERTA', 'EM_ATENDIMENTO']));
  const [cancelar, setCancelar] = useState<{ id: number; motivo: string } | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  if (!vagas.data) return <Carregando />;
  const d = vagas.data;
  const lista = d.vagas.filter((v) => !fSit.size || fSit.has(v.situacao));
  const salvar = async () => {
    if (!ed) return;
    const corpo = { ...ed.f, quantidade: Number(ed.f.quantidade) || 1, necessario_em: ed.f.necessario_em || null,
      destino: ed.f.destino || null, solicitante: ed.f.solicitante || null, justificativa: ed.f.justificativa || null };
    try {
      if (ed.id) { await api.put(`/mobilizacao/vagas/${ed.id}`, corpo); toast.success('Vaga atualizada'); }
      else { const v = await api.post<VagaContratacao>('/mobilizacao/vagas', corpo); toast.success(`Vaga ${v.codigo} aberta: o RH foi avisado`); }
      setEd(null); setErro(null);
    } catch (e) { setErro(e); }
  };
  const editar = (v: VagaContratacao) => setEd({ id: v.id, f: { funcao: v.funcao, quantidade: String(v.quantidade), empresa: v.empresa,
    necessario_em: v.necessario_em ?? '', destino: v.destino ?? '', solicitante: v.solicitante ?? '', justificativa: v.justificativa ?? '' } });
  const card = (k: string, rotulo: string) => <Indicador rotulo={rotulo} valor={<Calculado chave={k} memoria={() => d.memorias[k]}>{d.memorias[k].valor}</Calculado>} />;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {card('vagas_abertas', 'Vagas abertas')}
        {card('vagas_saldo', 'Posições sem processo')}
        {card('vagas_atrasadas', 'Data da obra vencida')}
        {card('vagas_tempo', 'Tempo médio para preencher')}
      </div>
      <Painel titulo="Que vagas a obra precisa preencher?" subtitulo="O Planejamento abre a vaga; o RH inicia a contratação a partir dela"
        acoes={planejar && <Botao onClick={() => setEd({ id: null, f: VAZIA })}><Plus size={16} /> Abrir vaga</Botao>}>
        {ed && (
          <div className="grid gap-3 rounded-m-lg border border-m-accent/40 bg-m-accent-subtle/40 p-4 md:grid-cols-4" aria-label={ed.id ? 'Editar vaga' : 'Abrir vaga'}>
            <SeletorFuncao className="md:col-span-2" valor={ed.f.funcao} onTrocar={(v) => setEd({ ...ed, f: { ...ed.f, funcao: v } })} />
            <Campo rotulo="Quantidade" type="number" min={1} max={500} value={ed.f.quantidade} onChange={(e) => setEd({ ...ed, f: { ...ed.f, quantidade: e.target.value } })} />
            <Campo rotulo="Obra precisa em" type="date" value={ed.f.necessario_em} onChange={(e) => setEd({ ...ed, f: { ...ed.f, necessario_em: e.target.value } })} />
            <Campo rotulo="Destino (frente, equipe ou setor)" value={ed.f.destino} onChange={(e) => setEd({ ...ed, f: { ...ed.f, destino: e.target.value } })} />
            <Campo rotulo="Solicitante" value={ed.f.solicitante} onChange={(e) => setEd({ ...ed, f: { ...ed.f, solicitante: e.target.value } })} />
            <Campo rotulo="Empresa" value={ed.f.empresa} onChange={(e) => setEd({ ...ed, f: { ...ed.f, empresa: e.target.value } })} />
            <Campo rotulo="Justificativa" className="md:col-span-4" value={ed.f.justificativa} onChange={(e) => setEd({ ...ed, f: { ...ed.f, justificativa: e.target.value } })} />
            <div className="flex flex-wrap items-center gap-2 md:col-span-4">
              <Botao disabled={!ed.f.funcao} onClick={salvar}>{ed.id ? 'Salvar vaga' : 'Abrir vaga'}</Botao>
              <Botao variante="secundario" onClick={() => setEd(null)}>Cancelar</Botao>
              <Erro erro={erro} />
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {SITS.map((s) => <Chip key={s.v} ativo={fSit.has(s.v)} onClick={() => setFSit((x) => { const n = new Set(x); if (n.has(s.v)) n.delete(s.v); else n.add(s.v); return n; })}>
            {s.rotulo} · {d.vagas.filter((v) => v.situacao === s.v).length}</Chip>)}
        </div>
        {!lista.length && <p className="py-6 text-center text-[13px] text-m-text-muted">{d.vagas.length ? 'Nenhuma vaga com esses filtros.' : 'Nenhuma vaga aberta. Use “Abrir vaga”.'}</p>}
        <div className="flex flex-col gap-2">
          {lista.map((v) => {
            const pct = Math.min(100, (100 * v.mobilizados) / v.quantidade);
            const proc = Math.min(100 - pct, (100 * v.em_processo) / v.quantidade);
            const ativa = v.situacao === 'ABERTA' || v.situacao === 'EM_ATENDIMENTO';
            return (
              <div key={v.id} className={cn('rounded-m-lg border p-3', v.atrasada ? 'border-m-warning/50' : 'border-m-stroke-subtle')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="tabular-nums text-m-text-primary">{v.codigo}</b>
                      <b className="text-[14px] text-m-text-primary">{v.quantidade} × {v.funcao}</b>
                      <Pilula tom={TOM[v.situacao]}>{v.situacao_rotulo}</Pilula>
                      {v.atrasada && <Pilula tom="perigo">obra precisava em {dataBR(v.necessario_em)}</Pilula>}
                    </div>
                    <div className="text-[12px] text-m-text-muted">
                      {[v.destino, v.solicitante && `pedido por ${v.solicitante}`, `aberta em ${dataBR(v.aberta_em)} por ${v.aberta_por}`, `${fmt(v.dias_aberta, 1)} d`,
                        v.necessario_em && !v.atrasada && `precisa em ${dataBR(v.necessario_em)}`, v.empresa !== 'Própria' && v.empresa].filter(Boolean).join(' · ')}
                      {v.cancelada_em && ` · cancelada: ${v.motivo_cancelamento}`}
                    </div>
                    {v.justificativa && <div className="text-[12px] text-m-text-secondary">{v.justificativa}</div>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {planejar && ativa && v.saldo > 0 && <Botao className="h-8 px-3 text-[12px]" onClick={() => onIniciar(v.id)}><UserPlus size={14} /> Iniciar contratação</Botao>}
                    {planejar && ativa && <button type="button" aria-label={`Editar ${v.codigo}`} className="rounded-full p-1.5 text-m-text-muted hover:bg-m-surface-hover" onClick={() => editar(v)}><Pencil size={15} /></button>}
                    {planejar && ativa && <button type="button" aria-label={`Cancelar ${v.codigo}`} title="Cancelar a vaga" className="rounded-full p-1.5 text-m-text-muted hover:bg-m-surface-hover hover:text-m-danger" onClick={() => setCancelar({ id: v.id, motivo: '' })}><Ban size={15} /></button>}
                    {planejar && v.situacao === 'CANCELADA' && <button type="button" aria-label={`Reabrir ${v.codigo}`} title="Reabrir" className="rounded-full p-1.5 text-m-text-muted hover:bg-m-surface-hover"
                      onClick={() => api.post(`/mobilizacao/vagas/${v.id}/reabrir`).then(() => toast.success(`${v.codigo} reaberta`), (e) => toast.error(e.message))}><RotateCcw size={15} /></button>}
                    {planejar && !v.processos.length && <button type="button" aria-label={`Excluir ${v.codigo}`} className="rounded-full p-1.5 text-m-text-muted hover:bg-m-surface-hover hover:text-m-danger"
                      onClick={() => confirmar({ titulo: `Excluir a vaga ${v.codigo}?`, mensagem: 'Só vaga sem processos sai; com processos, cancele.', executar: () => api.del(`/mobilizacao/vagas/${v.id}`) })}><Trash2 size={15} /></button>}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-m-surface-hover" title={`${v.mobilizados} mobilizado(s), ${v.em_processo} em processo de ${v.quantidade}`}>
                    <span className="h-full bg-m-success" style={{ width: `${pct}%`, background: 'var(--m-success)' }} />
                    <span className="h-full" style={{ width: `${proc}%`, background: 'var(--m-accent)' }} />
                  </div>
                  <span className="whitespace-nowrap text-[12px] tabular-nums text-m-text-secondary">{v.mobilizados} mobilizado(s) · {v.em_processo} em processo · faltam {v.saldo}{v.desistencias ? ` · ${v.desistencias} desistência(s)` : ''}</span>
                </div>
                {!!v.processos.length && <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11.5px]">
                  {v.processos.map((p) => <span key={p.id} className="rounded-full border border-m-stroke-subtle px-2 py-0.5 text-m-text-secondary">{p.nome} · {p.status === 'MOBILIZADO' ? 'mobilizado' : p.status === 'DESISTENCIA' ? 'desistiu' : (ETAPAS.find((e) => e.v === p.etapa_atual)?.curto ?? p.etapa_atual).toLowerCase()}</span>)}
                </div>}
                {cancelar?.id === v.id && (
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <Campo rotulo="Motivo do cancelamento" className="w-[360px]" value={cancelar.motivo} onChange={(e) => setCancelar({ ...cancelar, motivo: e.target.value })} />
                    <Botao variante="perigo" disabled={cancelar.motivo.trim().length < 3}
                      onClick={() => api.post(`/mobilizacao/vagas/${v.id}/cancelar`, { motivo: cancelar.motivo }).then(() => { toast.success(`${v.codigo} cancelada`); setCancelar(null); }, (e) => toast.error(e.message))}>Cancelar vaga</Botao>
                    <Botao variante="secundario" onClick={() => setCancelar(null)}>Voltar</Botao>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Painel>
    </>
  );
}

type Ed = Record<string, { dias: string; horas: string; clausula: string }>;

/** Configurações (spec 089): o que o contrato prevê de treinamento por função — base para medir o tempo gasto. */
export function TreinamentoPrevistoPainel({ planejar }: { planejar: boolean }) {
  const cfg = useTreinamentoPrevisto();
  const api = useApi();
  const [ed, setEd] = useState<Ed>({});
  const [q, setQ] = useState('');
  const [soMob, setSoMob] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const linhas = (cfg.data ?? []).filter((x) => (!soMob || x.em_mobilizacao || x.dias || x.horas) && (!q || x.funcao.toLowerCase().includes(q.toLowerCase())));
  const valor = (x: (typeof linhas)[number]) => ed[x.funcao_chave] ?? { dias: x.dias != null ? String(x.dias) : '', horas: x.horas != null ? String(x.horas) : '', clausula: x.clausula ?? '' };
  const n = Object.keys(ed).length;
  const num = (v: string) => (v.trim() ? Number(v.replace(',', '.')) : null);
  const salvar = async () => {
    try {
      await api.put('/mobilizacao/config/treinamentos', { itens: Object.entries(ed).map(([k, v]) => ({ funcao_chave: k, dias: num(v.dias), horas: num(v.horas), clausula: v.clausula || null })) });
      toast.success(`${n} função(ões) salvas`); setEd({}); setErro(null);
    } catch (e) { setErro(e); }
  };
  return (
    <Painel titulo="O que o contrato prevê de treinamento para cada função?"
      subtitulo="Dias e horas previstos no contrato. A mobilização compara com o tempo gasto na etapa Treinamentos e com as horas registradas; os dias viram a meta de Treinamentos da função."
      acoes={planejar && <Botao disabled={!n} onClick={salvar}>Salvar{n ? ` (${n})` : ''}</Botao>}>
      <div className="flex flex-wrap items-end gap-3">
        <Campo rotulo="Buscar função" value={q} onChange={(e) => setQ(e.target.value)} className="w-[260px]" />
        <label className="flex items-center gap-2 pb-2.5 text-[13px] text-m-text-secondary"><input type="checkbox" checked={soMob} onChange={(e) => setSoMob(e.target.checked)} /> Só funções em vagas/mobilização ou já configuradas</label>
      </div>
      <div className="-mx-1 max-h-[60vh] overflow-auto px-1">
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead className="sticky top-0 z-10 bg-m-surface-raised">
            <tr className="text-left text-[10.5px] font-semibold uppercase tracking-[0.3px] text-m-text-muted">
              <th className="px-2 py-2">Função</th><th className="px-2 py-2">Dias previstos</th><th className="px-2 py-2">Horas previstas</th>
              <th className="px-2 py-2">Sugestão (exigência)</th><th className="px-2 py-2">Item do contrato</th>
            </tr>
          </thead>
          <tbody>
            {cfg.isLoading && <LinhasCarregando colunas={5} />}
            {linhas.map((x) => {
              const v = valor(x);
              const set = (k: 'dias' | 'horas' | 'clausula', val: string) => setEd({ ...ed, [x.funcao_chave]: { ...v, [k]: val } });
              return (
                <tr key={x.funcao_chave} className={ed[x.funcao_chave] ? 'bg-m-accent-subtle/50' : ''}>
                  <td className="border-b border-m-row px-2 py-1.5"><b className="text-m-text-primary">{x.funcao}</b>
                    <div className="text-[11px] text-m-text-muted">{x.pessoas} pessoa(s){x.em_mobilizacao ? ' · em vaga/mobilização' : ''}</div></td>
                  <td className="border-b border-m-row px-2 py-1.5"><input aria-label={`Dias previstos para ${x.funcao}`} disabled={!planejar} type="number" step="0.5" min={0} value={v.dias} onChange={(e) => set('dias', e.target.value)} className="h-8 w-[90px] rounded-[8px] border border-m-stroke bg-m-surface-field px-2" /></td>
                  <td className="border-b border-m-row px-2 py-1.5"><input aria-label={`Horas previstas para ${x.funcao}`} disabled={!planejar} type="number" step="1" min={0} value={v.horas} onChange={(e) => set('horas', e.target.value)} className="h-8 w-[90px] rounded-[8px] border border-m-stroke bg-m-surface-field px-2" /></td>
                  <td className="border-b border-m-row px-2 py-1.5">{x.horas_sugeridas
                    ? <button type="button" disabled={!planejar} className="text-[12px] font-semibold text-m-accent underline disabled:no-underline" title="Soma da carga horária dos treinamentos exigidos da função (Cadastros de SSMA)" onClick={() => set('horas', String(x.horas_sugeridas))}>{fmt(x.horas_sugeridas, 1)} h</button>
                    : <span className="text-m-text-muted">—</span>}</td>
                  <td className="border-b border-m-row px-2 py-1.5"><input aria-label={`Item do contrato para ${x.funcao}`} disabled={!planejar} value={v.clausula} placeholder="ex.: Anexo IV, 3.2" onChange={(e) => set('clausula', e.target.value)} className="h-8 w-[200px] rounded-[8px] border border-m-stroke bg-m-surface-field px-2" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Erro erro={erro} />
    </Painel>
  );
}
