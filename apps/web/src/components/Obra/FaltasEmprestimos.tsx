'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Calculado, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { Campo, CARREGANDO, Indicador, Painel, Pilula, Tabela, dataBR, td, tdNum } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';

interface Apontamentos {
  de: string; ate: string; faltas: MemoriaCalculo; emprestimos: MemoriaCalculo; taxa_falta: number | null; justificadas: number;
  por_motivo: { motivo: string; rotulo: string; qtd: number }[]; recebidos: { equipe: string; qtd: number }[]; cedidos: { equipe: string; qtd: number }[];
  lista_faltas: { data: string; nome: string; matricula: string | null; equipe: string | null; rotulo: string; justificada: boolean; observacao: string | null; por: string }[];
  lista_emprestimos: { data: string; nome: string; de_equipe: string | null; para_equipe: string; justificativa: string; por: string }[];
}

const iso = (d: Date) => d.toLocaleDateString('sv-SE');

/**
 * Faltas e empréstimos entre equipes (spec 152): o que o apontador registrou no campo, no período — faltas por motivo
 * (justificadas ou não), taxa de falta e quem cedeu/recebeu gente, com a justificativa de cada empréstimo.
 */
export function FaltasEmprestimos() {
  const api = useApi();
  const [ate, setAte] = useState(iso(new Date()));
  const [de, setDe] = useState(iso(new Date(Date.now() - 6 * 86400000)));
  const q = useQuery({ queryKey: ['presenca', 'apontamentos', de, ate], queryFn: () => api.get<Apontamentos>(`/presenca/apontamentos?de=${de}&ate=${ate}`) });
  const a = q.data;
  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <Campo rotulo="De" type="date" value={de} onChange={(e) => setDe(e.target.value)} className="w-[170px]" />
        <Campo rotulo="Até" type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-[170px]" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador rotulo="Faltas" tom="atencao" valor={a ? <Calculado chave="faltas" memoria={() => a.faltas}>{a.faltas.valor}</Calculado> : '—'}
          detalhe={a ? `${a.justificadas} justificada(s)` : undefined} />
        <Indicador rotulo="Taxa de falta" valor={a?.taxa_falta != null ? <Calculado chave="faltas" memoria={() => a.faltas}>{`${a.taxa_falta.toLocaleString('pt-BR')}%`}</Calculado> : '—'}
          detalhe="faltas ÷ pessoas esperadas" />
        <Indicador rotulo="Empréstimos" tom="info" valor={a ? <Calculado chave="emprestimos" memoria={() => a.emprestimos}>{a.emprestimos.valor}</Calculado> : '—'}
          detalhe="pessoa-dia em outra equipe" />
        <Indicador rotulo="Mais recebeu" valor={a?.recebidos[0]?.qtd ?? '—'} detalhe={a?.recebidos[0]?.equipe ?? '—'} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Painel titulo="Por que faltaram?">
          <Tabela cabecalho={['Motivo', 'Faltas']} direita={[1]} vazio={q.isLoading ? CARREGANDO : !a?.por_motivo.length && 'Nenhuma falta no período.'}>
            {(a?.por_motivo ?? []).map((m) => <tr key={m.motivo}><td className={td}>{m.rotulo}</td><td className={tdNum}>{m.qtd}</td></tr>)}
          </Tabela>
        </Painel>
        <Painel titulo="Quem cedeu e quem recebeu gente?">
          <Tabela cabecalho={['Equipe', 'Recebeu', 'Cedeu']} direita={[1, 2]} vazio={q.isLoading ? CARREGANDO : !a?.recebidos.length && 'Nenhum empréstimo no período.'}>
            {[...new Set([...(a?.recebidos ?? []).map((x) => x.equipe), ...(a?.cedidos ?? []).map((x) => x.equipe)])].map((nome) => (
              <tr key={nome}><td className={td}>{nome}</td>
                <td className={tdNum}>{a?.recebidos.find((x) => x.equipe === nome)?.qtd ?? 0}</td>
                <td className={tdNum}>{a?.cedidos.find((x) => x.equipe === nome)?.qtd ?? 0}</td></tr>
            ))}
          </Tabela>
        </Painel>
      </div>
      <Painel titulo="Quem faltou?">
        <Tabela cabecalho={['Dia', 'Pessoa', 'Equipe', 'Motivo', 'Apontado por']} vazio={q.isLoading ? CARREGANDO : !a?.lista_faltas.length && 'Nenhuma falta no período.'}>
          {(a?.lista_faltas ?? []).map((f, i) => (
            <tr key={i}><td className={td}>{dataBR(f.data)}</td><td className={td}>{f.nome}<span className="block text-[11.5px] text-m-text-muted">{f.matricula ?? ''}</span></td>
              <td className={td}>{f.equipe ?? '—'}</td>
              <td className={td}><Pilula tom={f.justificada ? 'neutro' : 'atencao'}>{f.rotulo}</Pilula>{f.observacao && <span className="block text-[11.5px] text-m-text-muted">{f.observacao}</span>}</td>
              <td className={td}>{f.por}</td></tr>
          ))}
        </Tabela>
      </Painel>
      <Painel titulo="Quem foi emprestado, para onde e por quê?">
        <Tabela cabecalho={['Dia', 'Pessoa', 'De', 'Para', 'Justificativa', 'Apontado por']} vazio={q.isLoading ? CARREGANDO : !a?.lista_emprestimos.length && 'Nenhum empréstimo no período.'}>
          {(a?.lista_emprestimos ?? []).map((e, i) => (
            <tr key={i}><td className={td}>{dataBR(e.data)}</td><td className={td}>{e.nome}</td><td className={td}>{e.de_equipe ?? 'sem equipe'}</td>
              <td className={td}>{e.para_equipe}</td><td className={td}>{e.justificativa}</td><td className={td}>{e.por}</td></tr>
          ))}
        </Tabela>
      </Painel>
    </>
  );
}
