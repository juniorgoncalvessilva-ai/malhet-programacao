'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Calculado } from '@/components/Obra/Calculado';
import { Botao, CARREGANDO, Chip, Painel, Pilula, Selecao, Tabela, fmt, td, tdNum } from '@/components/Obra/ui';
import { k, useAcao } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import type { LinhaImportacao, ProgramacaoResumo } from '@/lib/api/types';

type Quantidade = 'vazia' | 'saldo';
const SITUACAO = {
  entra: { rotulo: 'Entra', tom: 'acento' },
  ja_esta: { rotulo: 'Já está nesta', tom: 'neutro' },
  concluida: { rotulo: 'Concluída no projeto', tom: 'sucesso' },
} as const;

/**
 * Spec 116: reaproveitar os itens de outra programação (a anterior vem sugerida). Vem a linha (frente, item, WBS,
 * cronograma, equipe, responsável, SSMA/PTO), sem os valores do dia; a quantidade do período começa vazia ou com o
 * que faltou na origem. Atividade já concluída no projeto fica de fora, salvo se marcada.
 */
export function ImportarProgramacao({ pid, onFechar }: { pid: number; onFechar: () => void }) {
  const api = useApi();
  const origens = useQuery({ queryKey: ['programacao', pid, 'importar', 'origens'],
    queryFn: () => api.get<{ sugerida: number | null; origens: ProgramacaoResumo[] }>(`/programacoes/${pid}/importar/origens`) });
  const [de, setDe] = useState<number | null>(null);
  useEffect(() => { if (de == null && origens.data?.origens.length) setDe(origens.data.sugerida ?? origens.data.origens[0].id); }, [origens.data, de]);
  const previa = useQuery({ queryKey: ['programacao', pid, 'importar', de], enabled: de != null,
    queryFn: () => api.get<{ linhas: LinhaImportacao[] }>(`/programacoes/${pid}/importar/${de}`) });
  const [quantidade, setQuantidade] = useState<Quantidade>('saldo');
  const [comConcluidas, setComConcluidas] = useState(false);
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const linhas = useMemo(() => previa.data?.linhas ?? [], [previa.data]);
  const podeEntrar = (l: LinhaImportacao) => l.situacao === 'entra' || (l.situacao === 'concluida' && comConcluidas);
  // marca de saída tudo o que entra; trocar a origem ou as concluídas refaz a seleção
  useEffect(() => { setMarcadas(new Set(linhas.filter(podeEntrar).map((l) => l.id))); }, [linhas, comConcluidas]); // eslint-disable-line react-hooks/exhaustive-deps
  const importar = useAcao((a, d: { de: number; linhas: number[]; quantidade: Quantidade; incluir_concluidas: boolean }) =>
    a.post<{ importadas: number; ja_estavam: number; concluidas_fora: number }>(`/programacoes/${pid}/importar`, d),
  [[...k.programacao(pid)], [...k.programacoes]]);

  const elegiveis = linhas.filter(podeEntrar);
  const todas = elegiveis.length > 0 && elegiveis.every((l) => marcadas.has(l.id));
  const n = { entra: 0, ja_esta: 0, concluida: 0 } as Record<LinhaImportacao['situacao'], number>;
  linhas.forEach((l) => { n[l.situacao] += 1; });
  const origem = origens.data?.origens.find((o) => o.id === de);
  const memoria = (l: LinhaImportacao) => `/programacoes/${de}/linhas/${l.id}/memoria`;

  const aplicar = () => {
    if (de == null || !marcadas.size) return;
    importar.mutate({ de, linhas: [...marcadas], quantidade, incluir_concluidas: comConcluidas }, {
      onSuccess: (r) => {
        toast.success(`${r.importadas} ite${r.importadas === 1 ? 'm importado' : 'ns importados'} de ${origem?.titulo ?? 'outra programação'}`
          + (r.ja_estavam ? ` · ${r.ja_estavam} já estava${r.ja_estavam === 1 ? '' : 'm'}` : ''));
        onFechar();
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <Painel
      titulo="Quais itens reaproveitar de outra programação?"
      subtitulo="Vem a linha (frente, item, WBS, cronograma, equipe, responsável, SSMA/PTO), sem os valores do dia."
      acoes={<button type="button" aria-label="Fechar importação" onClick={onFechar} className="grid h-9 w-9 place-items-center rounded-full text-m-text-muted hover:bg-m-surface-hover"><X size={18} /></button>}
    >
      <div className="flex flex-wrap items-end gap-3">
        <Selecao rotulo="Importar de" value={de ?? ''} onChange={(e) => setDe(Number(e.target.value))} className="min-w-[280px]">
          {(origens.data?.origens ?? []).map((o) => (
            <option key={o.id} value={o.id}>{o.titulo}{o.id === origens.data?.sugerida ? ' · anterior' : ''} ({o.linhas} linha{o.linhas === 1 ? '' : 's'})</option>
          ))}
        </Selecao>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Quantidade do período</span>
          <div className="flex gap-2">
            <Chip ativo={quantidade === 'saldo'} onClick={() => setQuantidade('saldo')} title="Leva o que faltou fazer no período da origem (sem passar do que resta do projeto)">O que faltou</Chip>
            <Chip ativo={quantidade === 'vazia'} onClick={() => setQuantidade('vazia')} title="A quantidade do período começa em branco">Em branco</Chip>
          </div>
        </div>
        <label className="flex h-10 items-center gap-2 text-[13px] text-m-text-secondary">
          <input type="checkbox" checked={comConcluidas} onChange={(e) => setComConcluidas(e.target.checked)} className="h-4 w-4 accent-[var(--m-accent-strong)]" />
          Trazer também as concluídas no projeto
        </label>
      </div>
      {origens.data && !origens.data.origens.length && <p className="mt-3 text-[13px] text-m-text-muted">Não há outra programação nesta obra para importar.</p>}
      {linhas.length > 0 && (
        <p className="mt-3 text-[13px] text-m-text-secondary">
          {n.entra} entra{n.entra === 1 ? '' : 'm'}{n.ja_esta ? ` · ${n.ja_esta} já ${n.ja_esta === 1 ? 'está' : 'estão'} nesta programação` : ''}{n.concluida ? ` · ${n.concluida} concluída${n.concluida === 1 ? '' : 's'} no projeto` : ''}
        </p>
      )}
      <div className="mt-2 max-h-[420px] overflow-y-auto">
        <Tabela cabecalho={['', 'Frente', 'Atividade', 'Encarregado', 'Projeto', 'Resta', 'Faltou no período', 'Situação']} direita={[4, 5, 6]}
          vazio={de != null && (previa.isLoading ? CARREGANDO : !linhas.length && 'A programação escolhida não tem linhas.')}>
          {linhas.map((l) => {
            const pode = podeEntrar(l);
            return (
              <tr key={l.id} className={pode ? '' : 'opacity-55'}>
                <td className={td}>
                  <input type="checkbox" aria-label={`Importar ${l.codigo_simova} ${l.descricao}`} disabled={!pode} checked={pode && marcadas.has(l.id)}
                    onChange={(e) => { const s = new Set(marcadas); if (e.target.checked) s.add(l.id); else s.delete(l.id); setMarcadas(s); }}
                    className="h-4 w-4 accent-[var(--m-accent-strong)]" />
                </td>
                <td className={td}>{l.area}</td>
                <td className={td}><b className="text-m-text-primary">{l.codigo_simova}</b> {l.descricao}{l.cwp ? <div className="text-[11px] text-m-text-muted">CWP {l.cwp}</div> : null}</td>
                <td className={td}>{l.encarregado ?? '—'}</td>
                <td className={tdNum}>{l.qtd_projeto != null ? `${fmt(l.qtd_projeto)} ${l.unidade ?? ''}` : '—'}</td>
                <td className={tdNum}>{l.restante != null ? <Calculado rota={memoria(l)} chave="restante">{fmt(l.restante)}</Calculado> : '—'}</td>
                <td className={tdNum}>{l.saldo_periodo != null ? <Calculado rota={memoria(l)} chave="saldo_periodo">{fmt(l.saldo_periodo)}</Calculado> : '—'}</td>
                <td className={td}><Pilula tom={SITUACAO[l.situacao].tom}>{SITUACAO[l.situacao].rotulo}</Pilula></td>
              </tr>
            );
          })}
        </Tabela>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {elegiveis.length > 0 && (
          <Chip ativo={todas} onClick={() => setMarcadas(todas ? new Set() : new Set(elegiveis.map((l) => l.id)))}>{todas ? 'Desmarcar todas' : 'Marcar todas'}</Chip>
        )}
        <Botao onClick={aplicar} disabled={!marcadas.size || importar.isPending}><Download size={16} /> Importar {marcadas.size} ite{marcadas.size === 1 ? 'm' : 'ns'}</Botao>
        <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
      </div>
    </Painel>
  );
}
