'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { TirarFotos, carimbarFoto, useEnviarFoto } from '@/components/Mobile/Fotos';
import { SEIS_M } from '@/components/Mobile/restricoes';
import { CampoM, ChipsM, RodapeM, TextoM, TopoM, botaoPrimarioM, botaoSecundarioM, cartaoM } from '@/components/Mobile/ui';
import { useFrentes2 } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import { useRouter } from '@/i18n/navigation';
import { useObra } from '@/lib/obra/ObraProvider';

/** Nova restrição pelo celular: a ação, a área, quem resolve, até quando, se trava a atividade, 6M e foto. */
export default function NovaRestricao() {
  const api = useApi();
  const qc = useQueryClient();
  const router = useRouter();
  const frentes = useFrentes2();
  const enviarFoto = useEnviarFoto();
  const { obra } = useObra();
  const areas = useMemo(() => (frentes.data ?? []).flatMap((l) => l.areas.filter((a) => a.ativo).map((a) => ({ ...a, local: `${l.codigo} · ${l.descricao}` }))), [frentes.data]);
  const [listaAberta, setListaAberta] = useState(false);
  const [f, setF] = useState({ acao: '', area_id: '', responsavel: '', prazo_termino: '', impeditivo: 'sim' as 'sim' | 'nao', seis_m: null as string | null });
  const [busca, setBusca] = useState('');
  const [fotos, setFotos] = useState<Blob[]>([]);
  const [salvando, setSalvando] = useState(false);
  // ao tocar no campo abre a lista inteira das áreas; digitar continua filtrando (código, nome ou local)
  const termos = busca.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(Boolean);
  const achadas = areas.filter((a) => {
    const t = `${a.codigo} ${a.descricao} ${a.local}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return termos.every((x) => t.includes(x));
  });
  const area = areas.find((a) => String(a.id) === f.area_id);

  const salvar = async () => {
    if (f.acao.trim().length < 3) { toast.error('Descreva a ação'); return; }
    setSalvando(true);
    try {
      const r = await api.post<{ id: number; numero: number }>('/restricoes', {
        acao: f.acao, area_id: f.area_id ? Number(f.area_id) : null, responsavel: f.responsavel || null,
        prazo_termino: f.prazo_termino || null, impeditivo: f.impeditivo === 'sim', seis_m: f.seis_m, status1: 'Pendente', reuniao: '6WLA',
      });
      const frente = area ? `Frente: ${area.codigo} · ${area.descricao}` : '';
      for (const x of fotos) await enviarFoto('restricao', r.id, await carimbarFoto(x, [frente, `Restrição Nº ${r.numero}`, obra?.nome ?? '']));
      qc.invalidateQueries({ queryKey: ['restricoes'] }); qc.invalidateQueries({ queryKey: ['lookahead'] });
      toast.success(`Restrição Nº ${r.numero} registrada`);
      router.push(`/m/restricoes/${r.id}`);
    } catch (e) { toast.error((e as Error).message); } finally { setSalvando(false); }
  };

  return (
    <>
      <TopoM titulo="Nova restrição" sub="entra no Plano de Ação 6WLA" voltar="/m/restricoes" />
      <section className={cartaoM}>
        <TextoM rotulo="O que precisa ser resolvido" value={f.acao} onChange={(e) => setF({ ...f, acao: e.target.value })} placeholder="Ex.: liberar o acesso da área para o caminhão betoneira" />
        <ChipsM rotulo="Trava a atividade?" valor={f.impeditivo} onChange={(v) => setF({ ...f, impeditivo: v ?? 'sim' })} opcoes={[{ valor: 'sim', rotulo: 'Sim, impeditiva' }, { valor: 'nao', rotulo: 'Não' }]} />
      </section>
      <section className={cartaoM}>
        {area ? (
          <div className="flex items-center justify-between gap-2 rounded-[14px] border border-m-accent-strong px-3.5 py-3 text-[14px]">
            <span><b>{area.codigo}</b> · {area.descricao}</span>
            <button type="button" className="text-[13px] font-semibold text-m-accent underline" onClick={() => setF({ ...f, area_id: '' })}>trocar</button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <CampoM rotulo="Área (frente)" value={busca} role="combobox" aria-expanded={listaAberta} aria-controls="lista-areas" autoComplete="off"
              onFocus={() => setListaAberta(true)} onChange={(e) => { setBusca(e.target.value); setListaAberta(true); }}
              placeholder="Toque para ver as áreas ou digite para filtrar" />
            {listaAberta && (
              <div id="lista-areas" role="listbox" aria-label="Áreas" className="flex max-h-[45vh] flex-col overflow-y-auto rounded-[14px] border border-m-stroke bg-m-surface-raised">
                <div className="sticky top-0 flex items-center justify-between border-b border-m-stroke-subtle bg-m-surface-raised px-3 py-2 text-[12px] text-m-text-muted">
                  <span>{achadas.length} de {areas.length} áreas</span>
                  <button type="button" className="font-semibold text-m-accent" onClick={() => setListaAberta(false)}>fechar</button>
                </div>
                {achadas.map((a) => (
                  <button key={a.id} type="button" role="option" aria-selected={false} onClick={() => { setF({ ...f, area_id: String(a.id) }); setBusca(''); setListaAberta(false); }}
                    className="flex min-h-[48px] flex-col justify-center border-b border-m-stroke-subtle px-3 py-1.5 text-left last:border-0">
                    <span className="text-[14px]"><b>{a.codigo}</b> · {a.descricao}</span>
                    <span className="text-[11.5px] text-m-text-muted">{a.local}</span>
                  </button>
                ))}
                {!achadas.length && <span className="px-3 py-3 text-[13px] text-m-text-muted">Nenhuma área com “{busca}”. Continue digitando ou apague para ver todas.</span>}
              </div>
            )}
          </div>
        )}
        <CampoM rotulo="Quem resolve" value={f.responsavel} onChange={(e) => setF({ ...f, responsavel: e.target.value })} />
        <CampoM rotulo="Até quando" type="date" value={f.prazo_termino} onChange={(e) => setF({ ...f, prazo_termino: e.target.value })} />
        <ChipsM rotulo="6M (Ishikawa)" valor={f.seis_m} onChange={(v) => setF({ ...f, seis_m: v })} opcoes={Object.entries(SEIS_M).map(([v, r]) => ({ valor: v, rotulo: r }))} />
      </section>
      <section className={cartaoM}><TirarFotos fotos={fotos} onChange={setFotos} rotulo="Foto da restrição" dica="Mostra o que está travando" carimbo={[area ? `${area.codigo} · ${area.descricao}` : 'frente escolhida', obra?.nome ?? '']} /></section>
      <RodapeM>
        <button type="button" className={botaoSecundarioM} onClick={() => router.push('/m/restricoes')}>Cancelar</button>
        <button type="button" className={botaoPrimarioM} disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Registrar'}</button>
      </RodapeM>
    </>
  );
}
