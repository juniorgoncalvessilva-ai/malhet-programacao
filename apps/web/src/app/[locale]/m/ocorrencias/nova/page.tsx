'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCausas } from '@/components/Obra/DesviosProgramacao';
import { hojeIso, useDiaCampo } from '@/components/Mobile/campo';
import { TirarFotos, useEnviarFoto } from '@/components/Mobile/Fotos';
import { CampoM, ChipsM, RodapeM, TextoM, TopoM, botaoPrimarioM, botaoSecundarioM, cartaoM } from '@/components/Mobile/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { useRouter } from '@/i18n/navigation';

/** Registrar ocorrência: dia, atividade (opcional, do dia), causa do Pareto, o que aconteceu, ação e fotos. */
export default function NovaOcorrencia() {
  const api = useApi();
  const qc = useQueryClient();
  const router = useRouter();
  const causas = useCausas();
  const [data, setData] = useState(hojeIso());
  const dia = useDiaCampo(data);
  const [linha, setLinha] = useState<number | null>(null);
  const [causa, setCausa] = useState<number | null>(null);
  const [texto, setTexto] = useState('');
  const [acao, setAcao] = useState('');
  const [fotos, setFotos] = useState<Blob[]>([]);
  const [todas, setTodas] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const enviarFoto = useEnviarFoto();
  const ativas = (causas.data ?? []).filter((c) => c.ativo);
  const ln = dia.data?.linhas.find((l) => l.id === linha);

  const salvar = async () => {
    if (!causa) { toast.error('Escolha a causa'); return; }
    if (texto.trim().length < 3) { toast.error('Conte o que aconteceu'); return; }
    setSalvando(true);
    try {
      const prog = ln && dia.data?.programacao?.editavel ? dia.data.programacao.id : null;
      const d = await api.post<{ id: number }>('/desvios', {
        data, causa_id: causa, descricao: texto, acao: acao || null, status: 1,
        programacao_id: prog, linha_id: prog ? ln!.id : null,
        referencia: ln?.codigo_simova ?? null, frente: ln?.area ?? null, atividade_impactada: ln?.descricao ?? null,
      });
      for (const f of fotos) await enviarFoto('desvio', d.id, f);
      qc.invalidateQueries({ queryKey: ['desvios'] }); qc.invalidateQueries({ queryKey: ['campo'] });
      toast.success('Ocorrência registrada');
      router.push('/m/ocorrencias');
    } catch (e) { toast.error((e as Error).message); } finally { setSalvando(false); }
  };

  return (
    <>
      <TopoM titulo="Registrar ocorrência" sub="vai para o Pareto de desvios" voltar="/m/ocorrencias" />
      <section className={cartaoM}>
        <CampoM rotulo="Dia" type="date" value={data} max={hojeIso()} onChange={(e) => { setData(e.target.value); setLinha(null); }} />
        {!!dia.data?.linhas.length && (
          <ChipsM rotulo="Atividade impactada (opcional)" valor={linha} onChange={setLinha}
            opcoes={dia.data.linhas.map((l) => ({ valor: l.id, rotulo: `${l.codigo_simova} · ${l.descricao.slice(0, 40)}` }))} />
        )}
      </section>
      <section className={cartaoM}>
        <ChipsM rotulo="Causa" valor={causa} onChange={setCausa} opcoes={(todas ? ativas : ativas.slice(0, 8)).map((c) => ({ valor: c.id, rotulo: c.descricao }))} />
        {ativas.length > 8 && <button type="button" onClick={() => setTodas(!todas)} className="self-start text-[14px] font-semibold text-m-accent underline">{todas ? 'menos causas' : `mais ${ativas.length - 8} causas`}</button>}
        <TextoM rotulo="O que aconteceu" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: chuva forte parou a concretagem às 14 h" />
        <TextoM rotulo="Ação (opcional)" rows={2} value={acao} onChange={(e) => setAcao(e.target.value)} placeholder="Ex.: reprogramar para amanhã" />
      </section>
      <section className={cartaoM}><TirarFotos fotos={fotos} onChange={setFotos} /></section>
      <RodapeM>
        <button type="button" className={botaoSecundarioM} onClick={() => router.push('/m/ocorrencias')}>Cancelar</button>
        <button type="button" className={botaoPrimarioM} disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Registrar'}</button>
      </RodapeM>
    </>
  );
}
