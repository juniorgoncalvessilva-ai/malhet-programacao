'use client';

import { useQuery } from '@tanstack/react-query';
import { ListOrdered, ShieldAlert, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Botao, Painel, Pilula } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';
import { Esqueleto } from '@/components/Obra/Esqueleto';

type Emissao = { revisao: number; emitida_em: string; emitida_por: string; revisao_original: number | null };

/**
 * Revisões emitidas da programação — só aparece para o super admin (a API confere). Excluir (spec 060): a última volta a
 * programação a rascunho e a anterior passa a valer nos indicadores. Numeração (spec 100): muda o número que sai no
 * documento impresso (ex.: emissões de teste deixaram a rev. 7), sem mudar o conteúdo nem a ordem.
 */
export function RevisoesProgramacao({ pid, concluida, emitida }: { pid: number; concluida: boolean; emitida: boolean }) {
  const { superadmin } = useObra();
  const api = useApi();
  const confirmar = useConfirmar();
  const [numeros, setNumeros] = useState<Record<number, string>>({});
  const emissoes = useQuery({ queryKey: ['emissoes', pid], enabled: superadmin, queryFn: () => api.get<Emissao[]>(`/programacoes/${pid}/emissoes`) });
  if (!superadmin) return null;
  const lista = emissoes.data ?? [];
  const ultima = lista[0]?.revisao;
  const mudou = Object.entries(numeros).filter(([rev, n]) => n !== '' && Number(n) !== Number(rev));
  const temBuraco = lista.some((e, i) => e.revisao !== lista.length - 1 - i);

  const renumerar = async (corpo: { mapa?: Record<string, number>; sequencial?: boolean }) => {
    try {
      const r = await api.put<{ alteradas: number; proxima_revisao: number; numeracao: { de: number; para: number }[] }>(`/programacoes/${pid}/emissoes/numeracao`, corpo);
      setNumeros({});
      toast.success(r.alteradas
        ? `Numeração salva: ${r.numeracao.filter((x) => x.de !== x.para).map((x) => `rev. ${x.de} → ${x.para}`).join(', ')} · próxima emissão: rev. ${r.proxima_revisao}`
        : 'A numeração já estava assim');
    } catch (er) { toast.error((er as Error).message, { duration: 9000 }); }
  };

  const excluir = async (e: Emissao) => {
    const eUltima = e.revisao === ultima;
    if (!(await confirmar({
      titulo: `Excluir a revisão ${e.revisao}?`,
      mensagem: `A foto emitida em ${new Date(e.emitida_em).toLocaleString('pt-BR')} e o histórico dela nos indicadores serão apagados. `
        + (eUltima
          ? `É a última: ${emitida ? 'a programação volta a rascunho, ' : ''}a revisão anterior passa a valer nos indicadores e a próxima emissão reaproveita o número ${e.revisao}.`
          : 'As outras revisões não mudam.') + ' Não dá para desfazer.',
      acao: 'Excluir revisão',
    }))) return;
    try {
      const r = await api.del<{ excluida: number; status: string }>(`/programacoes/${pid}/emissoes/${e.revisao}`);
      toast.success(`Revisão ${r.excluida} excluída${r.status === 'rascunho' && eUltima ? ' · programação em rascunho' : ''}`);
    } catch (er) { toast.error((er as Error).message, { duration: 9000 }); }
  };

  return (
    <Painel titulo="Revisões emitidas" acoes={<Pilula tom="atencao"><ShieldAlert size={13} className="mr-1 inline" />só super admin</Pilula>}>
      {!lista.length
        ? <p className="text-[13px] text-m-text-muted">{emissoes.isLoading ? <Esqueleto className="h-3.5 w-40 align-middle" /> : 'Nenhuma revisão emitida.'}</p>
        : (
          <ul className="flex flex-col divide-y divide-m-stroke-subtle text-[13px]">
            {lista.map((e) => {
              const travada = concluida && e.revisao === ultima;
              return (
                <li key={e.revisao} className="flex flex-wrap items-center gap-3 py-2">
                  <b className="w-16 text-m-text-primary">Rev. {e.revisao}</b>
                  <label className="flex items-center gap-1.5 text-[12px] text-m-text-muted" title="Número que sai no documento impresso">
                    nº no documento
                    <input type="number" min={0} max={999} aria-label={`Novo número da revisão ${e.revisao}`}
                      value={numeros[e.revisao] ?? String(e.revisao)} onChange={(x) => setNumeros({ ...numeros, [e.revisao]: x.target.value })}
                      className="h-8 w-16 rounded-[8px] border border-m-stroke bg-m-surface-field px-2 text-right text-[13px] text-m-text-primary" />
                  </label>
                  <span className="text-m-text-secondary">emitida em {new Date(e.emitida_em).toLocaleString('pt-BR')}</span>
                  {e.revisao_original != null && e.revisao_original !== e.revisao && <span className="text-[12px] text-m-text-muted">(emitida como rev. {e.revisao_original})</span>}
                  {e.revisao === ultima && <Pilula tom="acento">última</Pilula>}
                  <span className="ml-auto">
                    <Botao variante="secundario" disabled={travada} onClick={() => excluir(e)}
                      title={travada ? 'Programação concluída: a última revisão sustenta a conclusão — abra uma revisão antes' : undefined}>
                      <Trash2 size={15} /> Excluir
                    </Botao>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      {lista.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-m-stroke-subtle pt-3 text-[12.5px] text-m-text-muted">
          <Botao disabled={!mudou.length} onClick={() => renumerar({ mapa: Object.fromEntries(mudou.map(([r, n]) => [r, Number(n)])) })}>
            <ListOrdered size={15} /> Salvar numeração{mudou.length ? ` (${mudou.length})` : ''}
          </Botao>
          {temBuraco && <Botao variante="secundario" onClick={() => renumerar({ sequencial: true })}>Numerar em sequência (0, 1, 2…)</Botao>}
          <span>Muda só o número impresso; o conteúdo e a ordem das revisões não mudam. A próxima emissão continua do maior número.</span>
        </div>
      )}
    </Painel>
  );
}
