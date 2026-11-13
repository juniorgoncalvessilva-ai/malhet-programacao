'use client';

import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useCausas } from '@/components/Obra/DesviosProgramacao';
import { hojeIso, useDiaCampo } from '@/components/Mobile/campo';
import { TirarFotos, useEnviarFoto } from '@/components/Mobile/Fotos';
import { CampoM, ChipsM, RodapeM, TextoM, TopoM, botaoPrimarioM, botaoSecundarioM, cartaoM } from '@/components/Mobile/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { useRouter } from '@/i18n/navigation';

export default function NovaOcorrenciaPage() {
  return <Suspense fallback={<p className="text-sm text-m-text-muted">Carregando…</p>}><NovaOcorrencia /></Suspense>;
}

/** O que foi registrado para cada causa: cada causa vira um item separado no Pareto, com o seu relato, ação e fotos. */
type ItemCausa = { causa: number; texto: string; acao: string; fotos: Blob[] };

/**
 * Registrar ocorrência (spec 061): dia, atividade (opcional, do dia; já vem marcada quando aberta pela Programação),
 * uma ou mais causas do Pareto e, para cada causa, o que aconteceu, a ação e as fotos — um desvio por causa.
 */
function NovaOcorrencia() {
  const params = useSearchParams();
  const api = useApi();
  const qc = useQueryClient();
  const router = useRouter();
  const causas = useCausas();
  const [data, setData] = useState(params.get('data') ?? hojeIso());
  const dia = useDiaCampo(data);
  const [linha, setLinha] = useState<number | null>(Number(params.get('linha')) || null);
  const [itens, setItens] = useState<ItemCausa[]>([]);
  const [todas, setTodas] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const enviarFoto = useEnviarFoto();
  const ativas = (causas.data ?? []).filter((c) => c.ativo);
  const nomeCausa = (id: number) => ativas.find((c) => c.id === id)?.descricao ?? 'Causa';
  const ln = dia.data?.linhas.find((l) => l.id === linha);
  // atividade pedida que não está no dia escolhido (outro dia/equipe): não fica marcada à toa
  useEffect(() => { if (dia.data && linha && !dia.data.linhas.some((l) => l.id === linha)) setLinha(null); }, [dia.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const marcada = (id: number) => itens.some((x) => x.causa === id);
  const alternar = (id: number) => setItens((l) => (l.some((x) => x.causa === id) ? l.filter((x) => x.causa !== id) : [...l, { causa: id, texto: '', acao: '', fotos: [] }]));
  const mudar = (id: number, m: Partial<ItemCausa>) => setItens((l) => l.map((x) => (x.causa === id ? { ...x, ...m } : x)));

  const salvar = async () => {
    if (!itens.length) { toast.error('Escolha pelo menos uma causa'); return; }
    const semTexto = itens.find((x) => x.texto.trim().length < 3);
    if (semTexto) { toast.error(`Conte o que aconteceu em “${nomeCausa(semTexto.causa)}”`); return; }
    setSalvando(true);
    let feitos = 0;
    try {
      const prog = ln && dia.data?.programacao?.editavel ? dia.data.programacao.id : null;
      for (const it of itens) {
        const d = await api.post<{ id: number }>('/desvios', {
          data, causa_id: it.causa, descricao: it.texto.trim(), acao: it.acao.trim() || null, status: 1,
          programacao_id: prog, linha_id: prog ? ln!.id : null,
          referencia: ln?.codigo_simova ?? null, frente: ln?.area ?? null, atividade_impactada: ln?.descricao ?? null,
        });
        for (const f of it.fotos) await enviarFoto('desvio', d.id, f);
        feitos++;
      }
      qc.invalidateQueries({ queryKey: ['desvios'] }); qc.invalidateQueries({ queryKey: ['campo'] });
      toast.success(feitos === 1 ? 'Ocorrência registrada' : `${feitos} ocorrências registradas (uma por causa)`);
      router.push('/m/ocorrencias');
    } catch (e) {
      toast.error(`${feitos ? `${feitos} de ${itens.length} registradas. ` : ''}${(e as Error).message}`);
      if (feitos) setItens((l) => l.slice(feitos)); // não repete as que já foram
    } finally { setSalvando(false); }
  };

  return (
    <>
      <TopoM titulo="Registrar ocorrência" sub="vai para o Pareto de desvios" voltar="/m/ocorrencias" />
      <section className={cartaoM}>
        <CampoM rotulo="Dia" type="date" value={data} max={hojeIso()} onChange={(e) => { setData(e.target.value); setLinha(null); }} />
        {ln && (
          <div className="flex flex-col gap-0.5 rounded-[14px] bg-m-accent-strong px-3.5 py-2.5 text-m-on-accent">
            <span className="text-[11px] font-semibold uppercase tracking-[0.5px] opacity-80">Frente{ln.local ? ` · ${ln.local}` : ''}</span>
            <span className="text-[16px] font-bold leading-5">{ln.area}</span>
            <span className="text-[13px] opacity-90">{ln.codigo_simova} · {ln.descricao}</span>
          </div>
        )}
        {!!dia.data?.linhas.length && (
          <ChipsM rotulo={ln ? 'Trocar a atividade' : 'Atividade impactada (opcional)'} valor={linha} onChange={setLinha}
            opcoes={dia.data.linhas.map((l) => ({ valor: l.id, rotulo: `${l.codigo_simova} · ${l.descricao.slice(0, 40)}` }))} />
        )}
      </section>
      <section className={cartaoM}>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-m-text-secondary">Causas <span className="font-normal text-m-text-muted">· pode marcar mais de uma</span></span>
          <div role="group" aria-label="Causas" className="flex flex-wrap gap-2">
            {(todas ? ativas : ativas.slice(0, 8)).map((c) => (
              <button key={c.id} type="button" role="checkbox" aria-checked={marcada(c.id)} onClick={() => alternar(c.id)}
                className={`min-h-[40px] rounded-full px-3.5 text-left text-[14px] ${marcada(c.id) ? 'bg-m-accent-strong font-semibold text-m-on-accent' : 'border border-m-stroke'}`}>{marcada(c.id) ? '✓ ' : ''}{c.descricao}</button>
            ))}
          </div>
          {ativas.length > 8 && <button type="button" onClick={() => setTodas(!todas)} className="self-start text-[14px] font-semibold text-m-accent underline">{todas ? 'menos causas' : `mais ${ativas.length - 8} causas`}</button>}
        </div>
      </section>
      {itens.map((it, n) => (
        <section key={it.causa} className={cartaoM} aria-label={`Causa ${n + 1}: ${nomeCausa(it.causa)}`}>
          <div className="flex items-start justify-between gap-2">
            <span className="flex flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Item {n + 1} de {itens.length}</span>
              <span className="text-[15px] font-semibold text-m-warning">{nomeCausa(it.causa)}</span>
            </span>
            <button type="button" aria-label={`Tirar a causa ${nomeCausa(it.causa)}`} onClick={() => alternar(it.causa)} className="grid h-10 w-10 place-items-center rounded-full border border-m-stroke text-m-text-muted"><X size={18} /></button>
          </div>
          <TextoM rotulo="O que aconteceu" value={it.texto} onChange={(e) => mudar(it.causa, { texto: e.target.value })} placeholder="Ex.: chuva forte parou a concretagem às 14 h" />
          <TextoM rotulo="Ação (opcional)" rows={2} value={it.acao} onChange={(e) => mudar(it.causa, { acao: e.target.value })} placeholder="Ex.: reprogramar para amanhã" />
          <TirarFotos fotos={it.fotos} onChange={(f) => mudar(it.causa, { fotos: f })} rotulo="Fotos desta causa" />
        </section>
      ))}
      <RodapeM>
        <button type="button" className={botaoSecundarioM} onClick={() => router.push('/m/ocorrencias')}>Cancelar</button>
        <button type="button" className={botaoPrimarioM} disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : itens.length > 1 ? `Registrar ${itens.length}` : 'Registrar'}</button>
      </RodapeM>
    </>
  );
}
