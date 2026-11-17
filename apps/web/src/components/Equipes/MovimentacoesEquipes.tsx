'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Calculado, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { Carregando } from '@/components/Obra/Esqueleto';
import { Campo, Chip, Indicador, Painel, Tabela, td, tdNum } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';

interface Resumo {
  inicio: string; fim: string; total: number; trocas: number; pessoas: number;
  por_equipe: { equipe: string; entradas: number; saidas: number; total: number }[];
  por_semana: { semana: string; total: number }[];
  itens: { em: string; nome: string; matricula: string | null; de: string | null; para: string | null; por: string }[];
  memorias: Record<string, MemoriaCalculo>;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dias = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n + 1); return iso(d); };
const br = (s: string) => s.slice(0, 10).split('-').reverse().join('/');
const PERIODOS = [{ dias: 7, rotulo: '7 dias' }, { dias: 30, rotulo: '30 dias' }, { dias: 90, rotulo: '90 dias' }];

/**
 * Spec 107: quantas vezes as equipes mudaram — cada pessoa que entrou, saiu ou trocou de equipe (cadastro, organograma
 * ou efetivo) é uma movimentação no histórico. Por equipe, por semana e a lista, no período escolhido.
 */
export function MovimentacoesEquipes() {
  const api = useApi();
  const [inicio, setInicio] = useState(() => dias(30));
  const [fim, setFim] = useState(() => iso(new Date()));
  const q = useQuery({
    queryKey: ['equipes-movimentacoes', inicio, fim],
    queryFn: () => api.get<Resumo>(`/equipes/movimentacoes?inicio=${inicio}&fim=${fim}`),
    enabled: !!inicio && !!fim && inicio <= fim,
  });
  const r = q.data;
  const mem = (k: string) => () => r!.memorias[k];
  const maxSemana = Math.max(1, ...(r?.por_semana.map((s) => s.total) ?? [1]));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        {PERIODOS.map((p) => (
          <Chip key={p.dias} ativo={inicio === dias(p.dias) && fim === iso(new Date())} onClick={() => { setInicio(dias(p.dias)); setFim(iso(new Date())); }}>{p.rotulo}</Chip>
        ))}
        <Campo rotulo="De" type="date" value={inicio} max={fim} onChange={(e) => setInicio(e.target.value)} className="w-[160px]" />
        <Campo rotulo="Até" type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} className="w-[160px]" />
      </div>
      {!r ? <Carregando /> : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Indicador rotulo="Movimentações" valor={<Calculado chave="total" memoria={mem('total')}>{r.total}</Calculado>} detalhe={`${br(r.inicio)} a ${br(r.fim)}`} />
            <Indicador rotulo="Trocas de equipe" valor={<Calculado chave="total" memoria={mem('total')}>{r.trocas}</Calculado>} detalhe="saiu de uma e entrou em outra" />
            <Indicador rotulo="Pessoas movimentadas" valor={<Calculado chave="pessoas" memoria={mem('pessoas')}>{r.pessoas}</Calculado>} detalhe="pessoas diferentes" />
          </div>
          <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
            <Painel titulo="Quais equipes mais mudaram?" subtitulo="Entrada = veio de outra equipe ou de sem equipe · saída = foi para outra ou ficou sem equipe">
              <Tabela cabecalho={['Equipe', 'Entradas', 'Saídas', 'Alterações']} direita={[1, 2, 3]} vazio={!r.por_equipe.length && 'Nenhuma movimentação no período.'}>
                {r.por_equipe.map((x) => (
                  <tr key={x.equipe}>
                    <td className={`${td} font-medium text-m-text-primary`}>{x.equipe}</td>
                    <td className={tdNum}>{x.entradas}</td>
                    <td className={tdNum}>{x.saidas}</td>
                    <td className={`${tdNum} font-semibold text-m-text-primary`}><Calculado chave={`equipe:${x.equipe}`} memoria={mem(`equipe:${x.equipe}`)}>{x.total}</Calculado></td>
                  </tr>
                ))}
              </Tabela>
            </Painel>
            <Painel titulo="Em que semana mudou mais?" subtitulo="Semanas começando na segunda-feira">
              <ul className="flex flex-col gap-2">
                {r.por_semana.map((s) => (
                  <li key={s.semana} className="grid grid-cols-[88px_1fr_32px] items-center gap-2 text-[13px]">
                    <span className="tabular-nums text-m-text-tertiary">{br(s.semana)}</span>
                    <span className="h-3 rounded-full bg-m-surface-active" aria-hidden="true">
                      <span className="block h-3 rounded-full bg-m-accent" style={{ width: `${(s.total / maxSemana) * 100}%` }} />
                    </span>
                    <span className="text-right tabular-nums font-semibold text-m-text-primary">{s.total}</span>
                  </li>
                ))}
              </ul>
            </Painel>
          </div>
          <Painel titulo="Quem mudou de equipe?" subtitulo="Do mais recente para o mais antigo">
            <Tabela cabecalho={['Quando', 'Pessoa', 'De', '', 'Para']} vazio={!r.itens.length && 'Nenhuma movimentação no período.'}>
              {r.itens.map((i, k) => (
                <tr key={`${i.em}-${k}`}>
                  <td className={`${td} whitespace-nowrap tabular-nums`}>{new Date(i.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className={`${td} text-m-text-primary`}>{i.nome}{i.matricula && <span className="block text-[11px] text-m-text-muted">{i.matricula}</span>}</td>
                  <td className={td}>{i.de ?? <span className="text-m-text-muted">sem equipe</span>}</td>
                  <td className={`${td} w-6 px-0 text-m-text-muted`}><ArrowRight size={14} aria-label="para" /></td>
                  <td className={td}>{i.para ?? <span className="text-m-text-muted">sem equipe</span>}</td>
                </tr>
              ))}
            </Tabela>
          </Painel>
        </>
      )}
    </div>
  );
}
