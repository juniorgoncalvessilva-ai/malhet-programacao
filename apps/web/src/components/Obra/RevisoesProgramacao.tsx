'use client';

import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Botao, Painel, Pilula } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';

type Emissao = { revisao: number; emitida_em: string; emitida_por: string };

/**
 * Revisões emitidas da programação com a opção de excluir — só aparece para o super admin (spec 060; a API confere).
 * Excluir a última volta a programação a rascunho e a revisão anterior passa a valer nos indicadores.
 */
export function RevisoesProgramacao({ pid, concluida, emitida }: { pid: number; concluida: boolean; emitida: boolean }) {
  const { superadmin } = useObra();
  const api = useApi();
  const confirmar = useConfirmar();
  const emissoes = useQuery({ queryKey: ['emissoes', pid], enabled: superadmin, queryFn: () => api.get<Emissao[]>(`/programacoes/${pid}/emissoes`) });
  if (!superadmin) return null;
  const lista = emissoes.data ?? [];
  const ultima = lista[0]?.revisao;

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
        ? <p className="text-[13px] text-m-text-muted">{emissoes.isLoading ? 'Carregando…' : 'Nenhuma revisão emitida.'}</p>
        : (
          <ul className="flex flex-col divide-y divide-m-stroke-subtle text-[13px]">
            {lista.map((e) => {
              const travada = concluida && e.revisao === ultima;
              return (
                <li key={e.revisao} className="flex flex-wrap items-center gap-3 py-2">
                  <b className="w-16 text-m-text-primary">Rev. {e.revisao}</b>
                  <span className="text-m-text-secondary">emitida em {new Date(e.emitida_em).toLocaleString('pt-BR')}</span>
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
    </Painel>
  );
}
