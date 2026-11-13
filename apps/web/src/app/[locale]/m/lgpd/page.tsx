'use client';

import { useMemo, useState } from 'react';
import { TopoM, cartaoM } from '@/components/Mobile/ui';
import { ColetaTermo } from '@/components/Lgpd/ColetaTermo';
import { IdentificarPessoa } from '@/components/Preventivos/Assinar';
import { SITUACAO, precisaColher, useLocalizacao } from '@/lib/lgpd';
import { useObra } from '@/lib/obra/ObraProvider';
import { useFila } from '@/lib/offline/fila';
import type { PessoaBase } from '@/lib/presenca/offline';
import { useBasePessoas } from '@/lib/presenca/useBase';

/** Colher o termo LGPD no campo (spec 074): identifica o colaborador, apresenta o termo, ele responde e assina. Sem internet. */
export default function LgpdCampo() {
  const obraId = useObra().obra?.id ?? 0;
  const pb = useBasePessoas();
  const local = useLocalizacao();
  const [pessoa, setPessoa] = useState<PessoaBase | null>(null);
  const [equipe, setEquipe] = useState('');
  const fila = useFila(obraId, 'lgpd').filter((x) => x.estado !== 'enviado').length;
  const pendentes = useMemo(() => (pb.base?.pessoas ?? []).filter((p) => p.equipe_id != null && precisaColher(p) && (!equipe || String(p.equipe_id) === equipe)), [pb.base, equipe]);
  const termo = pb.base?.termo_lgpd;

  if (!pb.base || !termo) return (
    <>
      <TopoM titulo="Termo LGPD" voltar="/m" />
      <p className={`${cartaoM} text-[14px] text-m-text-secondary`}>{pb.erro ? `Não consegui baixar o efetivo: ${pb.erro}. Abra uma vez com internet.` : 'Baixando o efetivo e o termo…'}</p>
    </>
  );
  if (pessoa) return (
    <>
      <TopoM titulo="Termo LGPD" sub={pessoa.nome} />
      <ColetaTermo obraId={obraId} pessoa={pessoa} termo={termo} limite={pb.base.distancia_max} busca={pb} local={local}
        onConcluir={(p) => { pb.trocarPessoa(p); setPessoa(null); }} onCancelar={() => setPessoa(null)} />
    </>
  );
  return (
    <>
      <TopoM titulo="Termo LGPD" sub={`versão ${termo.versao}${fila ? ` · ${fila} na fila` : ''}`} voltar="/m" />
      <IdentificarPessoa pessoas={pb.base.pessoas} limite={pb.base.distancia_max} busca={pb} rosto={false} onPessoa={(p) => setPessoa(p)} />
      <section className={cartaoM}>
        <div className="flex items-center justify-between gap-2">
          <select aria-label="Equipe" value={equipe} onChange={(e) => setEquipe(e.target.value)} className="h-11 min-w-0 flex-1 rounded-[12px] border border-m-stroke bg-m-surface-field px-3 text-[14px]">
            <option value="">Todas as equipes</option>
            {(pb.base.equipes ?? []).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          <span className="shrink-0 text-[13px] font-semibold text-m-warning">{pendentes.length} a colher</span>
        </div>
        <ul className="flex flex-col">
          {pendentes.slice(0, 80).map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setPessoa(p)} className="flex min-h-[52px] w-full items-center justify-between gap-2 border-b border-m-stroke-subtle text-left">
                <span className="min-w-0"><span className="block truncate text-[14px]">{p.nome}</span><span className="text-[12px] text-m-text-muted">{[p.matricula, p.funcao].filter(Boolean).join(' · ')}</span></span>
                <span className="shrink-0 text-[12px] font-semibold text-m-warning">{SITUACAO[p.lgpd?.situacao ?? 'pendente'].rotulo}</span>
              </button>
            </li>
          ))}
          {!pendentes.length && <li className="py-2 text-[13px] text-m-success">Todos desta equipe já responderam o termo vigente.</li>}
        </ul>
      </section>
    </>
  );
}
