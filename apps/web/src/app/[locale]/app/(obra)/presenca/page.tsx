'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Calculado, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { Cabecalho, Campo, Indicador, Painel, Pilula } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';

interface PessoaDia { id: number; nome: string; matricula: string | null; funcao: string | null; papel: string; presente: boolean; hora: string | null; meio: string | null; leituras?: number }
interface LinhaDia {
  id: number; codigo: string; atividade: string; area: string; unidade: string | null; previsto: number;
  capacidade_programada: number | null; capacidade_presentes: number | null; capacidade_un_dia_presentes: number | null; fator_dia: number; gargalo: string | null;
}
interface EquipeDia {
  equipe_id: number; nome: string; encarregado: string | null; jornada: number; total: number; presentes: number; hh_disponivel: number;
  por_funcao: { funcao: string; presentes: number; total: number }[]; pessoas: PessoaDia[]; linhas: LinhaDia[];
}
interface Dia {
  data: string; programacao: { id: number; titulo: string } | null; presentes: number; nas_equipes: number; presentes_nas_equipes: number;
  hh_disponivel: number; equipes: EquipeDia[]; sem_equipe: PessoaDia[];
}

const n = (x: number | null | undefined, c = 2) => (x == null ? '—' : x.toLocaleString('pt-BR', { maximumFractionDigits: c }));
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const MEIO: Record<string, string> = { nfc: 'NFC', qr: 'QR', codigo: 'código', facial: 'rosto', manual: 'manual' };

const memHH = (e: EquipeDia): MemoriaCalculo => ({
  chave: 'hh', titulo: `HH disponível · ${e.nome}`, valor: `${n(e.hh_disponivel)} h`, formula: 'presentes × jornada da equipe',
  passos: [{ descricao: 'Presentes no dia', conta: `${e.presentes} pessoa(s) com leitura de presença`, resultado: String(e.presentes), destaque: false },
    { descricao: 'HH disponível', conta: `${e.presentes} × ${n(e.jornada)} h`, resultado: `${n(e.hh_disponivel)} h`, destaque: true }],
  fontes: [{ dado: 'Presença', valor: String(e.presentes), origem: 'Leituras de crachá/rosto/lista no app de campo', local: 'Apropriação' },
    { dado: 'Jornada', valor: `${n(e.jornada)} h`, origem: 'Cadastro da equipe', local: e.nome }],
  notas: ['Presente = pelo menos uma leitura da pessoa no dia.'],
});
const memCap = (e: EquipeDia, l: LinhaDia): MemoriaCalculo => ({
  chave: 'cap', titulo: `Capacidade com os presentes · ${l.codigo}`, valor: `${n(l.capacidade_presentes)} ${l.unidade ?? ''}`,
  formula: 'capacidade da equipe (mesma conta da programação) só com os membros presentes × fator do dia',
  passos: [
    { descricao: 'Membros presentes por função', conta: e.por_funcao.map((f) => `${f.presentes}/${f.total} ${f.funcao}`).join(' · ') || '—', resultado: `${e.presentes} de ${e.total}`, destaque: false },
    { descricao: 'Capacidade por dia (presentes)', conta: 'jornada ÷ maior (h/un da função ÷ presentes da função) — gargalo', resultado: `${n(l.capacidade_un_dia_presentes)} ${l.unidade ?? ''}/dia`, destaque: false },
    { descricao: 'No dia', conta: `${n(l.capacidade_un_dia_presentes)} × fator ${n(l.fator_dia)}`, resultado: `${n(l.capacidade_presentes)} ${l.unidade ?? ''}`, destaque: true },
    { descricao: 'Programado (equipe completa)', conta: 'capacidade do dia na programação', resultado: `${n(l.capacidade_programada)} ${l.unidade ?? ''}`, destaque: false },
  ],
  fontes: [{ dado: 'Presentes', valor: String(e.presentes), origem: 'Apropriação de presença', local: e.nome },
    { dado: 'CPU / composição', valor: l.gargalo ?? '—', origem: 'CPU vigente da obra', local: l.codigo }],
  notas: ['Sem membros cadastrados na equipe não dá para calcular (—). Ninguém presente = 0.'],
});

/** Apropriação do dia (spec 063): quem está presente em cada equipe e a capacidade produtiva com os presentes. */
export default function PresencaDiaPage() {
  const api = useApi();
  const [data, setData] = useState(hoje());
  const [aberta, setAberta] = useState<Set<number>>(new Set());
  const q = useQuery({ queryKey: ['presenca', 'dia', data], queryFn: () => api.get<Dia>(`/presenca/dia?data=${data}`) });
  const d = q.data;
  const alternar = (id: number) => setAberta((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; });

  return (
    <>
      <Cabecalho eyebrow="Efetivo · apropriação" cor="var(--m-proc-executar)" titulo="Presença do dia"
        acoes={<Link href="/app/efetivo/identificacao" className="text-[13px] font-semibold text-m-accent underline">Crachá e rosto</Link>} />
      <div className="flex flex-wrap items-end gap-3">
        <Campo rotulo="Dia" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        {d?.programacao && <span className="pb-2 text-[13px] text-m-text-muted">Programação do dia: {d.programacao.titulo}</span>}
      </div>
      {d && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Indicador rotulo="Presentes" valor={d.presentes} />
          <Indicador rotulo="Nas equipes" valor={`${d.presentes_nas_equipes} de ${d.nas_equipes}`} />
          <Indicador rotulo="HH disponível" valor={`${n(d.hh_disponivel)} h`} />
          <Indicador rotulo="Presentes sem equipe" valor={d.sem_equipe.length} />
        </div>
      )}
      {q.isLoading && <p className="text-sm text-m-text-muted">Carregando…</p>}
      {d && !d.presentes && <Painel titulo="Ninguém registrado"><p className="text-[13px] text-m-text-muted">Nenhuma leitura de presença neste dia. As leituras entram pelo app de campo (botão Presença) e sobem quando o celular tem internet.</p></Painel>}
      {d?.equipes.filter((e) => e.total).map((e) => {
        const falta = e.linhas.filter((l) => l.capacidade_presentes != null && l.previsto > l.capacidade_presentes + 1e-9);
        return (
          <Painel key={e.equipe_id} titulo={
            <button type="button" onClick={() => alternar(e.equipe_id)} aria-expanded={aberta.has(e.equipe_id)} className="flex items-center gap-2 text-left">
              {aberta.has(e.equipe_id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span>{e.nome}</span>
              <span className="text-[13px] font-normal text-m-text-muted">{e.encarregado ? `· ${e.encarregado.replace(/^\s*\d+\s*::\s*/, '')}` : ''}</span>
            </button>}
            acoes={<span className="flex flex-wrap items-center gap-2 text-[13px]">
              <Pilula tom={e.presentes === e.total ? 'sucesso' : e.presentes ? 'atencao' : 'perigo'}>{e.presentes} de {e.total} presentes</Pilula>
              <Calculado chave="hh" memoria={() => memHH(e)}>{n(e.hh_disponivel)} HH</Calculado>
              {falta.length > 0 && <Pilula tom="perigo"><AlertTriangle size={13} className="mr-1 inline" />{falta.length} atividade(s) acima do que os presentes fazem</Pilula>}
            </span>}>
            <div className="flex flex-wrap gap-1.5">
              {e.por_funcao.map((f) => <span key={f.funcao} className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${f.presentes === f.total ? 'bg-m-success-subtle text-m-success' : 'bg-m-warning-subtle text-m-warning'}`}>{f.presentes}/{f.total} {f.funcao}</span>)}
            </div>
            {e.linhas.length > 0 && (
              <table className="mt-3 w-full text-[13px]">
                <thead className="text-left text-[11px] uppercase tracking-[0.4px] text-m-text-muted">
                  <tr><th className="py-1.5">Atividade do dia</th><th className="text-right">Previsto</th><th className="text-right">Capacidade programada</th><th className="text-right">Com os presentes</th></tr>
                </thead>
                <tbody>
                  {e.linhas.map((l) => {
                    const acima = l.capacidade_presentes != null && l.previsto > l.capacidade_presentes + 1e-9;
                    return (
                      <tr key={l.id} className="border-t border-m-stroke-subtle">
                        <td className="py-1.5 pr-3"><b>{l.codigo}</b> · {l.atividade}<span className="block text-[12px] text-m-text-muted">{l.area}</span></td>
                        <td className="text-right tabular-nums">{n(l.previsto)} {l.unidade}</td>
                        <td className="text-right tabular-nums">{n(l.capacidade_programada)}</td>
                        <td className={`text-right font-semibold tabular-nums ${acima ? 'text-m-danger' : 'text-m-success'}`}>
                          {l.capacidade_presentes == null ? '—' : <Calculado chave="cap" memoria={() => memCap(e, l)}>{n(l.capacidade_presentes)}</Calculado>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {aberta.has(e.equipe_id) && (
              <ul className="mt-3 grid gap-x-6 gap-y-1 text-[13px] md:grid-cols-2">
                {e.pessoas.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 border-b border-m-stroke-subtle py-1">
                    <span className="min-w-0 truncate"><b className={p.presente ? 'text-m-text-primary' : 'text-m-text-muted'}>{p.nome}</b> <span className="text-[12px] text-m-text-muted">{[p.funcao, p.papel === 'encarregado' && 'encarregado'].filter(Boolean).join(' · ')}</span></span>
                    <span className={`shrink-0 text-[12px] font-semibold ${p.presente ? 'text-m-success' : 'text-m-danger'}`}>{p.presente ? `${new Date(p.hora!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ${MEIO[p.meio ?? ''] ?? p.meio}${(p.leituras ?? 1) > 1 ? ` · ${p.leituras} leituras (vale a 1ª)` : ''}` : 'ausente'}</span>
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        );
      })}
      {d && d.sem_equipe.length > 0 && (
        <Painel titulo="Presentes sem equipe">
          <ul className="grid gap-1 text-[13px] md:grid-cols-2">
            {d.sem_equipe.map((p) => <li key={p.id}>{p.nome} <span className="text-m-text-muted">· {p.funcao ?? '—'} · {p.hora ? new Date(p.hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</span></li>)}
          </ul>
        </Painel>
      )}
    </>
  );
}
