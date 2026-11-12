'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { TirarFotos, useEnviarFoto } from '@/components/Mobile/Fotos';
import { SEIS_M } from '@/components/Mobile/restricoes';
import { CampoM, ChipsM, RodapeM, TextoM, TopoM, botaoPrimarioM, botaoSecundarioM, cartaoM } from '@/components/Mobile/ui';
import { useFrentes2 } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import { useRouter } from '@/i18n/navigation';

/** Nova restrição pelo celular: a ação, a área, quem resolve, até quando, se trava a atividade, 6M e foto. */
export default function NovaRestricao() {
  const api = useApi();
  const qc = useQueryClient();
  const router = useRouter();
  const frentes = useFrentes2();
  const enviarFoto = useEnviarFoto();
  const areas = useMemo(() => (frentes.data ?? []).flatMap((l) => l.areas.filter((a) => a.ativo)), [frentes.data]);
  const [f, setF] = useState({ acao: '', area_id: '', responsavel: '', prazo_termino: '', impeditivo: 'sim' as 'sim' | 'nao', seis_m: null as string | null });
  const [busca, setBusca] = useState('');
  const [fotos, setFotos] = useState<Blob[]>([]);
  const [salvando, setSalvando] = useState(false);
  const achadas = busca.trim() ? areas.filter((a) => `${a.codigo} ${a.descricao}`.toLowerCase().includes(busca.toLowerCase())).slice(0, 8) : [];
  const area = areas.find((a) => String(a.id) === f.area_id);

  const salvar = async () => {
    if (f.acao.trim().length < 3) { toast.error('Descreva a ação'); return; }
    setSalvando(true);
    try {
      const r = await api.post<{ id: number; numero: number }>('/restricoes', {
        acao: f.acao, area_id: f.area_id ? Number(f.area_id) : null, responsavel: f.responsavel || null,
        prazo_termino: f.prazo_termino || null, impeditivo: f.impeditivo === 'sim', seis_m: f.seis_m, status1: 'Pendente', reuniao: '6WLA',
      });
      for (const x of fotos) await enviarFoto('restricao', r.id, x);
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
          <>
            <CampoM rotulo="Área (frente)" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Busque pelo código ou nome" />
            {achadas.map((a) => (
              <button key={a.id} type="button" onClick={() => { setF({ ...f, area_id: String(a.id) }); setBusca(''); }} className="min-h-[44px] rounded-[12px] border border-m-stroke-subtle px-3 text-left text-[14px]"><b>{a.codigo}</b> · {a.descricao}</button>
            ))}
          </>
        )}
        <CampoM rotulo="Quem resolve" value={f.responsavel} onChange={(e) => setF({ ...f, responsavel: e.target.value })} />
        <CampoM rotulo="Até quando" type="date" value={f.prazo_termino} onChange={(e) => setF({ ...f, prazo_termino: e.target.value })} />
        <ChipsM rotulo="6M (Ishikawa)" valor={f.seis_m} onChange={(v) => setF({ ...f, seis_m: v })} opcoes={Object.entries(SEIS_M).map(([v, r]) => ({ valor: v, rotulo: r }))} />
      </section>
      <section className={cartaoM}><TirarFotos fotos={fotos} onChange={setFotos} rotulo="Foto da restrição" dica="Mostra o que está travando" /></section>
      <RodapeM>
        <button type="button" className={botaoSecundarioM} onClick={() => router.push('/m/restricoes')}>Cancelar</button>
        <button type="button" className={botaoPrimarioM} disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Registrar'}</button>
      </RodapeM>
    </>
  );
}
