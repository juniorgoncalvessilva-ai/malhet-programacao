'use client';

import { Check, ChevronDown, ChevronRight, RotateCcw, Trash2, UserX } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Calculado } from '@/components/Obra/Calculado';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Botao, Campo, Erro, Pilula, dataBR, fmt } from '@/components/Obra/ui';
import { FormAso } from '@/components/Treinamentos/Formularios';
import { useApi } from '@/hooks/programacao/useApi';
import type { EtapaMobilizacao, ProcessoMobilizacao } from '@/lib/api/types';
import { cn } from '@/lib/utils';

export const ETAPAS: { v: EtapaMobilizacao; curto: string }[] = [
  { v: 'SOLICITACAO', curto: 'Solicitação' }, { v: 'SELECAO', curto: 'Seleção' }, { v: 'EXAMES', curto: 'Exames' },
  { v: 'ASO', curto: 'ASO' }, { v: 'CONTRATACAO', curto: 'Contratação' }, { v: 'TREINAMENTO', curto: 'Treinamento' },
  { v: 'DOCUMENTACAO_CLIENTE', curto: 'Doc. cliente' }, { v: 'APROVACAO', curto: 'Aprovação' }, { v: 'CRACHA', curto: 'Crachá' },
];
export const TOM_STATUS = { EM_ANDAMENTO: 'info', AGUARDANDO_CRACHA: 'atencao', MOBILIZADO: 'sucesso', DESISTENCIA: 'neutro' } as const;

const agoraLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

/** Trilho das 9 etapas: concluídas com os dias gastos, a aberta destacada com os dias até agora. */
export function EtapasProcesso({ p }: { p: ProcessoMobilizacao }) {
  const ordem = p.treinamento_antes
    ? ETAPAS.filter((e) => e.v !== 'CONTRATACAO').flatMap((e) => (e.v === 'TREINAMENTO' ? [e, ETAPAS[4]] : [e]))
    : ETAPAS;
  return (
    <ol className="flex flex-wrap items-stretch gap-1" aria-label={`Etapas de ${p.nome}`}>
      {ordem.map((e) => {
        const pas = p.passagens.filter((x) => x.etapa === e.v);
        const feita = pas.some((x) => x.saiu_em);
        const aberta = pas.some((x) => !x.saiu_em) && p.status !== 'DESISTENCIA';
        const parou = p.status === 'DESISTENCIA' && p.etapa_atual === e.v;
        const dias = p.esforco[e.v];
        const gargalo = p.gargalo === e.v && (p.passagens.length > 1);
        return (
          <li key={e.v} title={pas.map((x) => `${x.rotulo}: ${new Date(x.entrou_em).toLocaleString('pt-BR')} → ${x.saiu_em ? new Date(x.saiu_em).toLocaleString('pt-BR') : 'aberta'}${x.concluido_por ? ` (${x.concluido_por})` : ''}`).join('\n') || e.curto}
            className={cn('flex min-w-[78px] flex-1 flex-col rounded-[8px] border px-2 py-1 text-[11px] leading-4',
              feita ? 'border-m-success/40 bg-m-success-subtle text-m-text-primary' : aberta ? 'border-m-accent bg-m-accent-subtle font-semibold text-m-text-primary'
                : parou ? 'border-m-danger/40 bg-m-danger-subtle text-m-text-primary' : 'border-m-stroke-subtle text-m-text-muted')}>
            <span className="flex items-center gap-1">{feita && <Check size={11} />}{e.curto}</span>
            <span className={cn('tabular-nums', gargalo && 'font-bold text-m-warning')}>{dias != null ? `${fmt(dias, 1)} d` : '—'}{gargalo ? ' ▲' : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Linha de um processo com as ações: concluir a etapa aberta, voltar, desistir, excluir. */
export function LinhaProcesso({ p, podeEditar, onAbrirFicha }: { p: ProcessoMobilizacao; podeEditar: boolean; onAbrirFicha: (id: number) => void }) {
  const api = useApi();
  const confirmar = useConfirmar();
  const [aberto, setAberto] = useState(false);
  const [acao, setAcao] = useState<'concluir' | 'desistir' | 'aso' | null>(null);
  const [emEditado, setEmEditado] = useState(false);
  const [f, setF] = useState({ em: agoraLocal(), observacao: '', matricula: '', admissao: '', cracha: '', motivo: '', confirmar: false });
  const [erro, setErro] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);
  const aberta = p.status === 'EM_ANDAMENTO' || p.status === 'AGUARDANDO_CRACHA';
  const e = p.etapa_atual;
  const ap = p.aptidao;

  const enviar = async (fn: () => Promise<unknown>, msg: string) => {
    setEnviando(true);
    try { await fn(); toast.success(msg); setAcao(null); setErro(null); setEmEditado(false); setF((x) => ({ ...x, em: agoraLocal(), observacao: '', motivo: '' })); }
    catch (err) { setErro(err); } finally { setEnviando(false); }
  };
  const concluir = () => enviar(() => api.post(`/mobilizacao/processos/${p.id}/concluir`, {
    etapa: e, em: emEditado ? new Date(f.em).toISOString() : null, observacao: f.observacao || null, confirmar_treinamentos: f.confirmar,
    matricula: f.matricula || null, admissao: f.admissao || null, cracha: f.cracha || null,
  }), `${p.nome}: ${p.etapa_rotulo} concluída`);

  return (
    <div className={cn('rounded-m-lg border p-3', p.atrasos.length && aberta ? 'border-m-warning/50' : 'border-m-stroke-subtle')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button type="button" className="flex items-start gap-2 text-left" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
          {aberto ? <ChevronDown size={16} className="mt-0.5" /> : <ChevronRight size={16} className="mt-0.5" />}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-[14px] text-m-text-primary">{p.nome}</b>
              <Pilula tom={TOM_STATUS[p.status]}>{p.status_rotulo}</Pilula>
              {aberta && <span className="text-[12px] text-m-text-secondary">em <b>{p.etapa_rotulo}</b> há {fmt(p.dias_etapa_atual ?? 0, 1)} d</span>}
              {p.atrasos.length > 0 && aberta && <Pilula tom="atencao">fora da meta</Pilula>}
              {p.atrasado_para_obra && <Pilula tom="perigo">obra precisava em {dataBR(p.necessario_em)}</Pilula>}
            </div>
            <div className="text-[12px] text-m-text-muted">
              {[p.funcao, p.empresa, p.requisicao && `req. ${p.requisicao}`, `${fmt(p.dias_total, 1)} d no total`, p.necessario_em && !p.atrasado_para_obra && `precisa em ${dataBR(p.necessario_em)}`]
                .filter(Boolean).join(' · ')}
              {p.status === 'DESISTENCIA' && p.motivo_desistencia && ` · desistiu: ${p.motivo_desistencia}`}
            </div>
          </div>
        </button>
        <div className="flex flex-wrap items-center gap-1.5">
          {p.colaborador_id && <Botao variante="secundario" className="h-8 px-3 text-[12px]" onClick={() => onAbrirFicha(p.colaborador_id!)}>Ficha</Botao>}
          {podeEditar && aberta && <Botao className="h-8 px-3 text-[12px]" onClick={() => { setAcao(acao === 'concluir' ? null : 'concluir'); setAberto(true); if (!emEditado) setF((x) => ({ ...x, em: agoraLocal() })); }}><Check size={14} /> Concluir {ETAPAS.find((x) => x.v === e)?.curto}</Botao>}
          {podeEditar && aberta && <Botao variante="secundario" className="h-8 px-3 text-[12px]" onClick={() => { setAcao(acao === 'desistir' ? null : 'desistir'); setAberto(true); }}><UserX size={14} /> Desistência</Botao>}
          {podeEditar && p.passagens.length > 1 && (
            <button type="button" title="Desfazer a última conclusão" aria-label="Voltar etapa" className="rounded-full p-1.5 text-m-text-muted hover:bg-m-surface-hover"
              onClick={() => confirmar({ titulo: `Voltar ${p.nome} uma etapa?`, mensagem: 'Desfaz a última conclusão (ou a desistência) lançada por engano.', acao: 'Voltar', perigo: false, executar: () => api.post(`/mobilizacao/processos/${p.id}/voltar`) })}>
              <RotateCcw size={15} /></button>
          )}
          {podeEditar && (
            <button type="button" title="Excluir o processo" aria-label="Excluir processo" className="rounded-full p-1.5 text-m-text-muted hover:bg-m-surface-hover hover:text-m-danger"
              onClick={() => confirmar({ titulo: `Excluir o processo de ${p.nome}?`, mensagem: 'O histórico das etapas é apagado. A pessoa continua no efetivo.', executar: () => api.del(`/mobilizacao/processos/${p.id}`) })}>
              <Trash2 size={15} /></button>
          )}
        </div>
      </div>

      {(aberto || acao) && <div className="mt-3 flex flex-col gap-3">
        <EtapasProcesso p={p} />
        {ap && aberta && (ap.impedimentos.length > 0 || ap.pendentes.length > 0) && (
          <p className="text-[12px] text-m-text-secondary">
            {!ap.aso_libera && <>ASO: <b className="text-m-danger">{ap.aso === 'FALTANDO' ? 'sem ASO' : 'inapto/vencido'}</b> · </>}
            {ap.pendentes.length > 0 && <>Treinamentos pendentes: <b>{ap.pendentes.join(', ')}</b></>}
          </p>
        )}
        {acao === 'concluir' && (
          <div className="grid gap-3 rounded-m-lg border border-m-accent/40 bg-m-accent-subtle/40 p-4 md:grid-cols-4">
            <Campo rotulo="Concluída em" type="datetime-local" max={agoraLocal()} value={f.em} onChange={(x) => { setEmEditado(true); setF({ ...f, em: x.target.value }); }} />
            {e === 'CONTRATACAO' && <>
              <Campo rotulo="Matrícula" value={f.matricula} onChange={(x) => setF({ ...f, matricula: x.target.value })} />
              <Campo rotulo="Admissão (vazio = data acima)" type="date" value={f.admissao} onChange={(x) => setF({ ...f, admissao: x.target.value })} />
            </>}
            {e === 'CRACHA' && <Campo rotulo="Número do crachá" placeholder="vazio = matrícula" value={f.cracha} onChange={(x) => setF({ ...f, cracha: x.target.value })} />}
            <Campo rotulo="Observação" className={e === 'CONTRATACAO' ? '' : e === 'CRACHA' ? 'md:col-span-2' : 'md:col-span-3'} value={f.observacao} onChange={(x) => setF({ ...f, observacao: x.target.value })} />
            {e === 'ASO' && ap && !ap.aso_libera && (
              <p className="text-[12.5px] text-m-text-secondary md:col-span-4">O ASO só é liberado com o exame <b>apto e válido</b> registrado.
                {' '}<button type="button" className="font-semibold text-m-accent underline" onClick={() => setAcao('aso')}>Registrar o ASO agora</button></p>
            )}
            {e === 'DOCUMENTACAO_CLIENTE' && ap && !ap.funcao_tem_exigencia && (
              <label className="flex items-center gap-2 text-[13px] text-m-text-secondary md:col-span-4">
                <input type="checkbox" checked={f.confirmar} onChange={(x) => setF({ ...f, confirmar: x.target.checked })} />
                A função não tem treinamentos exigidos cadastrados — confirmo que a matriz de treinamentos foi conferida
              </label>
            )}
            <div className="flex flex-wrap items-center gap-2 md:col-span-4">
              <Botao disabled={enviando} onClick={concluir}>{enviando ? 'Salvando…' : `Concluir ${p.etapa_rotulo}`}</Botao>
              <Botao variante="secundario" onClick={() => setAcao(null)}>Cancelar</Botao>
              <Erro erro={erro} />
            </div>
          </div>
        )}
        {acao === 'aso' && p.colaborador_id && <FormAso colaboradorId={p.colaborador_id} onFeito={() => setAcao('concluir')} onCancelar={() => setAcao('concluir')} />}
        {acao === 'desistir' && (
          <div className="grid gap-3 rounded-m-lg border border-m-danger/30 bg-m-danger-subtle/40 p-4 md:grid-cols-4">
            <Campo rotulo="Motivo da desistência" required className="md:col-span-3" value={f.motivo} onChange={(x) => setF({ ...f, motivo: x.target.value })} />
            <Campo rotulo="Em" type="datetime-local" max={agoraLocal()} value={f.em} onChange={(x) => { setEmEditado(true); setF({ ...f, em: x.target.value }); }} />
            <div className="flex flex-wrap items-center gap-2 md:col-span-4">
              <Botao variante="perigo" disabled={enviando || f.motivo.trim().length < 3}
                onClick={() => enviar(() => api.post(`/mobilizacao/processos/${p.id}/desistir`, { motivo: f.motivo, em: emEditado ? new Date(f.em).toISOString() : null }), `${p.nome}: desistência registrada`)}>Registrar desistência</Botao>
              <Botao variante="secundario" onClick={() => setAcao(null)}>Cancelar</Botao>
              <Erro erro={erro} />
            </div>
          </div>
        )}
        {aberto && p.passagens.some((x) => x.observacao) && (
          <ul className="text-[12px] text-m-text-muted">
            {p.passagens.filter((x) => x.observacao).map((x, i) => <li key={i}><b>{x.rotulo}:</b> {x.observacao}</li>)}
          </ul>
        )}
      </div>}
    </div>
  );
}

/** Barra horizontal simples (sem biblioteca) para as métricas. */
export function Barra({ rotulo, valor, max, texto, tom = 'var(--m-accent)', memoria }: {
  rotulo: string; valor: number; max: number; texto: string; tom?: string; memoria?: import('@/components/Obra/Calculado').MemoriaCalculo;
}) {
  const pct = max > 0 ? Math.max(2, (100 * valor) / max) : 0;
  return (
    <div className="grid grid-cols-[150px_1fr_90px] items-center gap-2 text-[12.5px]">
      <span className="truncate text-m-text-secondary" title={rotulo}>{rotulo}</span>
      <span className="h-3 rounded-full bg-m-surface-hover"><span className="block h-3 rounded-full" style={{ width: `${pct}%`, background: tom }} /></span>
      <span className="text-right tabular-nums text-m-text-primary">
        {memoria ? <Calculado chave={memoria.chave} memoria={() => memoria}>{texto}</Calculado> : texto}
      </span>
    </div>
  );
}
