'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Miniatura, TirarFotos, carimbarFoto, useEnviarFoto } from '@/components/Mobile/Fotos';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';
import { type Acao5W2H, FAROL_ACAO, ROTULO_ORIGEM, ROTULO_STATUS_ACAO, dataBR } from '@/lib/auditorias';

const CAMPOS: [keyof Acao5W2H, string, string][] = [
  ['o_que', 'O quê', 'What'], ['por_que', 'Por quê', 'Why'], ['onde', 'Onde', 'Where'], ['quando', 'Quando (prazo)', 'When'],
  ['quem', 'Quem', 'Who'], ['como', 'Como', 'How'], ['quanto', 'Quanto', 'How much'],
];

/** A ação 5W2H: os 7 campos (editáveis enquanto aberta), dia de execução, evidência, conclusão e verificação de eficácia. */
export function AcaoDetalhe({ a, onMudou }: { a: Acao5W2H; onMudou?: () => void }) {
  const api = useApi();
  const { obra, pode, papel } = useObra();
  const enviarFoto = useEnviarFoto();
  const editavel = (pode('encarregado') || papel === 'seguranca') && ['aberta', 'andamento'].includes(a.status);
  const [f, setF] = useState({ o_que: a.o_que, por_que: a.por_que ?? '', onde: a.onde ?? '', quando: a.quando ?? '', quem: a.quem ?? '',
    como: a.como ?? '', quanto: a.quanto ?? '', data_execucao: a.data_execucao ?? '', acompanhamento: a.acompanhamento ?? '' });
  const [texto, setTexto] = useState('');
  const [fotos, setFotos] = useState<Blob[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  const fazer = async (msg: string, fn: () => Promise<unknown>) => {
    setOcupado(true);
    try { await fn(); toast.success(msg); onMudou?.(); } catch (e) { toast.error((e as Error).message, { duration: 8000 }); } finally { setOcupado(false); }
  };
  const salvar = () => fazer('Ação salva', () => api.put(`/acoes/${a.id}`, { ...f, area_id: a.area_id, quando: f.quando || null, data_execucao: f.data_execucao || null }));
  const evento = (evento: string, extra: Record<string, unknown> = {}) => api.post(`/acoes/${a.id}/evento`, { evento, ...extra });
  const concluir = () => fazer('Ação concluída: aguardando a verificação de eficácia', async () => {
    for (const b of fotos) await enviarFoto('acao', a.id, await carimbarFoto(b, ['DEPOIS · evidência', a.onde ? `Frente: ${a.onde}` : '', `Ação Nº ${a.numero}`, obra?.nome ?? '']), { legenda: 'evidencia' });
    setFotos([]);
    await evento('concluir', { texto });
  });
  const cls = 'w-full rounded-[10px] border border-m-stroke bg-m-surface-field px-3 py-2 text-[14px] disabled:opacity-80';
  const far = FAROL_ACAO[a.farol] ?? FAROL_ACAO[a.status];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className={`rounded-full px-2.5 py-1 font-semibold ${far.cls}`}>{far.rotulo}</span>
        <span className="text-m-text-secondary">{ROTULO_STATUS_ACAO[a.status]} · origem: {a.origem_texto ?? ROTULO_ORIGEM[a.origem]} · 5W2H {a.preenchidos}/7</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {CAMPOS.map(([k, r, en]) => (
          <label key={k} className={`flex flex-col gap-1 text-[12px] font-medium text-m-text-secondary ${k === 'o_que' || k === 'por_que' || k === 'como' ? 'sm:col-span-2' : ''}`}>
            <span>{r} <span className="font-normal text-m-text-muted">· {en}</span></span>
            {k === 'quando' ? <input type="date" disabled={!editavel} value={f.quando} onChange={(e) => setF({ ...f, quando: e.target.value })} className={cls} />
              : k === 'o_que' || k === 'por_que' || k === 'como'
                ? <textarea rows={2} disabled={!editavel} value={String(f[k as keyof typeof f] ?? '')} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={cls} />
                : <input disabled={!editavel} value={String(f[k as keyof typeof f] ?? '')} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={cls} />}
          </label>
        ))}
        <label className="flex flex-col gap-1 text-[12px] font-medium text-m-text-secondary">Dia de execução (programação das ações)
          <input type="date" disabled={!editavel} value={f.data_execucao} onChange={(e) => setF({ ...f, data_execucao: e.target.value })} className={cls} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-medium text-m-text-secondary">Acompanhamento (verifica a eficácia)
          <input disabled={!editavel} value={f.acompanhamento} onChange={(e) => setF({ ...f, acompanhamento: e.target.value })} className={cls} />
        </label>
      </div>
      {editavel && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={ocupado} onClick={salvar} className="h-10 rounded-full border border-m-stroke px-4 text-[13px] font-semibold">Salvar 5W2H</button>
          {a.status === 'aberta' && <button type="button" disabled={ocupado} onClick={() => fazer('Em andamento', () => evento('andamento'))} className="h-10 rounded-full border border-m-stroke px-4 text-[13px] font-semibold">Iniciar</button>}
        </div>
      )}
      {a.fotos.length > 0 && <div className="flex flex-wrap items-center gap-2"><span className="text-[12px] font-semibold uppercase text-m-text-muted">Evidência</span>{a.fotos.map((id) => <Miniatura key={id} id={id} tamanho={72} />)}</div>}
      {a.conclusao_texto && <p className="text-[13px]"><b>Feito:</b> {a.conclusao_texto}</p>}
      {editavel && (
        <div className="flex flex-col gap-2 rounded-[14px] border border-m-stroke-subtle p-3">
          <span className="text-[13px] font-semibold">Concluir com evidência</span>
          <TirarFotos fotos={fotos} onChange={setFotos} rotulo="Foto da adequação" dica="Obrigatória para concluir" carimbo={[a.onde ?? '', obra?.nome ?? '']} />
          <textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="O que foi feito" className={cls} />
          <button type="button" disabled={ocupado || (!fotos.length && !a.fotos.length) || texto.trim().length < 3} onClick={concluir}
            className="h-11 rounded-full bg-m-accent-strong text-[14px] font-semibold text-m-on-accent disabled:opacity-40">Concluir ação</button>
        </div>
      )}
      {a.status === 'verificacao' && (pode('encarregado') || papel === 'seguranca') && (
        <div className="flex flex-col gap-2 rounded-[14px] border border-m-info/40 bg-m-info-subtle p-3">
          <span className="text-[13px] font-semibold text-m-info">Verificar a eficácia{a.acompanhamento ? ` · ${a.acompanhamento}` : ''}</span>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Observação (opcional)" className={cls} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={ocupado} onClick={() => fazer('Eficaz: ação encerrada', () => evento('verificar', { eficaz: true, texto }))} className="h-11 rounded-full bg-m-success text-[14px] font-semibold text-white">Eficaz</button>
            <button type="button" disabled={ocupado} onClick={() => fazer('Não eficaz: ação reaberta', () => evento('verificar', { eficaz: false, texto }))} className="h-11 rounded-full border border-m-danger text-[14px] font-semibold text-m-danger">Não eficaz</button>
          </div>
        </div>
      )}
      {editavel && (motivo == null
        ? <button type="button" onClick={() => setMotivo('')} className="self-start text-[12.5px] font-semibold text-m-danger underline">Cancelar ação</button>
        : (
          <div className="flex flex-wrap items-center gap-2">
            <input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo do cancelamento" className={`${cls} max-w-sm`} />
            <button type="button" disabled={ocupado || motivo.trim().length < 3} onClick={() => fazer('Ação cancelada', () => evento('cancelar', { texto: motivo }))} className="h-10 rounded-full border border-m-danger px-4 text-[13px] font-semibold text-m-danger disabled:opacity-40">Confirmar cancelamento</button>
            <button type="button" onClick={() => setMotivo(null)} className="text-[12.5px] text-m-text-muted underline">voltar</button>
          </div>
        ))}
      {!!a.historico?.length && (
        <details className="text-[12.5px]"><summary className="cursor-pointer font-semibold text-m-text-secondary">Histórico ({a.historico.length})</summary>
          <ul className="mt-1 flex flex-col gap-1">{a.historico.map((h, i) => <li key={i}><span className="text-m-text-muted">{new Date(h.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span> · {h.texto}</li>)}</ul>
        </details>
      )}
      {a.quando && <span className="text-[12px] text-m-text-muted">Prazo {dataBR(a.quando)}{a.data_execucao ? ` · executar em ${dataBR(a.data_execucao)}` : ''}</span>}
    </div>
  );
}
