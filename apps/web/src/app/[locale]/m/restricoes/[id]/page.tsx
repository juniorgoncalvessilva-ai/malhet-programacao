'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { dataLonga } from '@/components/Mobile/campo';
import { Miniatura, TirarFotos, useEnviarFoto } from '@/components/Mobile/Fotos';
import { FAROL, SEIS_M, corpoRestricao, useRestricoes } from '@/components/Mobile/restricoes';
import { CampoM, ChipsM, RodapeM, TextoM, TopoM, botaoPrimarioM, botaoSecundarioM, cartaoM } from '@/components/Mobile/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';

/** Uma restrição no celular: dados, histórico de observações e as ações do dia (anotar, reprogramar, concluir, foto, 6M). */
export default function RestricaoCampo() {
  const id = Number(useParams<{ id: string }>().id);
  const api = useApi();
  const qc = useQueryClient();
  const { pode } = useObra();
  const q = useRestricoes();
  const a = q.data?.find((x) => x.id === id);
  const enviarFoto = useEnviarFoto();
  const [nota, setNota] = useState('');
  const [repro, setRepro] = useState<{ data: string; motivo: string } | null>(null);
  const [fotos, setFotos] = useState<Blob[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const editar = pode('encarregado') && a?.status1 === 'Pendente';
  const atualizar = () => { qc.invalidateQueries({ queryKey: ['restricoes'] }); qc.invalidateQueries({ queryKey: ['lookahead'] }); };
  const fazer = async (msg: string, f: () => Promise<unknown>) => {
    setOcupado(true);
    try { await f(); toast.success(msg); atualizar(); } catch (e) { toast.error((e as Error).message); } finally { setOcupado(false); }
  };

  if (!a) return <><TopoM titulo="Restrição" voltar="/m/restricoes" /><p className="text-sm text-m-text-muted">{q.isLoading ? 'Carregando…' : 'Restrição não encontrada.'}</p></>;
  return (
    <>
      <TopoM titulo={`Restrição Nº ${a.numero}`} sub={a.area_texto ?? a.atividade ?? undefined} voltar="/m/restricoes" />
      <section className={cartaoM}>
        <span className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${FAROL[a.status2]}`}>{a.status2}</span>{a.impeditivo && <span className="text-[12px] font-semibold text-m-warning">Impeditiva</span>}</span>
        <span className="text-[17px] font-semibold leading-[22px]">{a.acao}</span>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
          {([['Responsável', a.responsavel], ['Gerência', a.gerencia], ['Prazo', a.prazo_termino ? dataLonga(a.prazo_termino) : null],
            ['Reprogramado', a.reprogramado ? `${dataLonga(a.reprogramado)} (${a.reprogramacoes}×)` : null], ['Semana', a.semana ? `S${a.semana}` : null],
            ['6M', a.seis_m ? SEIS_M[a.seis_m] : 'não classificado']] as [string, string | null][]).map(([k, v]) => (
            <div key={k}><dt className="text-[11.5px] uppercase tracking-[0.4px] text-m-text-muted">{k}</dt><dd className="text-m-text-primary">{v ?? '—'}</dd></div>
          ))}
        </dl>
        {!!a.fotos?.length && <div className="flex flex-wrap gap-2">{a.fotos.map((f) => <Miniatura key={f} id={f} />)}</div>}
      </section>

      {editar && (
        <>
          <section className={cartaoM}>
            <ChipsM rotulo="6M (Ishikawa)" valor={a.seis_m} opcoes={Object.entries(SEIS_M).map(([v, r]) => ({ valor: v, rotulo: r }))}
              onChange={(v) => fazer('6M salvo', () => api.put(`/restricoes/${a.id}`, corpoRestricao(a, { seis_m: v })))} />
          </section>
          <section className={cartaoM}>
            <TextoM rotulo={`Anotar (entra com a data de hoje)`} rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: material chegou, falta liberar a área" />
            <button type="button" disabled={!nota.trim() || ocupado} onClick={() => fazer('Anotado', async () => { await api.put(`/restricoes/${a.id}`, corpoRestricao(a, { nova_observacao: nota })); setNota(''); })}
              className="h-12 rounded-full border border-m-stroke text-[15px] font-semibold text-m-accent disabled:opacity-40">Salvar anotação</button>
            <TirarFotos fotos={fotos} onChange={setFotos} rotulo="Foto da restrição" dica="Mostra como está a frente hoje" />
            {fotos.length > 0 && <button type="button" disabled={ocupado} onClick={() => fazer('Foto(s) enviada(s)', async () => { for (const f of fotos) await enviarFoto('restricao', a.id, f); setFotos([]); })}
              className="h-12 rounded-full bg-m-accent-strong text-[15px] font-semibold text-m-on-accent disabled:opacity-40">Enviar {fotos.length} foto(s)</button>}
          </section>
          {repro && (
            <section className={cartaoM}>
              <CampoM rotulo="Nova data" type="date" min={a.prazo_termino ?? undefined} value={repro.data} onChange={(e) => setRepro({ ...repro, data: e.target.value })} />
              <TextoM rotulo="Motivo (vai para as observações)" rows={2} value={repro.motivo} onChange={(e) => setRepro({ ...repro, motivo: e.target.value })} />
              <button type="button" disabled={!repro.data || ocupado} onClick={() => fazer('Reprogramada', async () => { await api.post(`/restricoes/${a.id}/reprogramar`, { data: repro.data, observacao: repro.motivo || null }); setRepro(null); })}
                className="h-12 rounded-full bg-m-accent-strong text-[15px] font-semibold text-m-on-accent disabled:opacity-40">Reprogramar</button>
            </section>
          )}
        </>
      )}

      <section className={cartaoM}>
        <span className="text-[13px] font-semibold text-m-text-secondary">Observações</span>
        <p className="whitespace-pre-line text-[13.5px] leading-5 text-m-text-primary">{a.observacoes ?? 'Nenhuma ainda.'}</p>
      </section>

      {editar && (
        <RodapeM>
          <button type="button" className={botaoSecundarioM} onClick={() => setRepro(repro ? null : { data: '', motivo: '' })}>Reprogramar</button>
          <button type="button" className={botaoPrimarioM} disabled={ocupado} onClick={() => fazer(`Nº ${a.numero} concluída`, () => api.put(`/restricoes/${a.id}`, corpoRestricao(a, { status1: 'Concluído' })))}>Concluir</button>
        </RodapeM>
      )}
    </>
  );
}
