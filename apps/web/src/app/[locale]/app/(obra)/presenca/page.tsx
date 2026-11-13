'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Abas } from '@/components/Obra/Abas';
import { Calculado, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { IndicadoresPresenca } from '@/components/Obra/PresencaIndicadores';
import { Cabecalho, Campo, Chip, Indicador, Painel } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';

interface PessoaDia { id: number; nome: string; matricula: string | null; funcao: string | null; papel: string; presente: boolean; hora: string | null; meio: string | null; leituras?: number }
interface Setor { id: number; nome: string; cor: string | null }
interface EquipeDia {
  equipe_id: number; nome: string; encarregado: string | null; jornada: number; total: number; presentes: number; hh_disponivel: number;
  setor: Setor | null; por_funcao: { funcao: string; presentes: number; total: number }[]; pessoas: PessoaDia[];
}
interface Dia {
  data: string; programacao: { id: number; titulo: string } | null; presentes: number; nas_equipes: number; presentes_nas_equipes: number;
  hh_disponivel: number; equipes: EquipeDia[]; sem_equipe: PessoaDia[];
}

const n = (x: number | null | undefined, c = 2) => (x == null ? '—' : x.toLocaleString('pt-BR', { maximumFractionDigits: c }));
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const MEIO: Record<string, string> = { nfc: 'NFC', qr: 'QR', codigo: 'código', facial: 'rosto', manual: 'manual' };
const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
const semCracha = (s: string | null) => (s ?? '').replace(/^\s*\d+\s*::\s*/, '');
const SEM_SETOR = 'Sem setor';

const memHH = (e: EquipeDia): MemoriaCalculo => ({
  chave: 'hh', titulo: `HH disponível · ${e.nome}`, valor: `${n(e.hh_disponivel)} h`, formula: 'presentes × jornada da equipe',
  passos: [{ descricao: 'Presentes no dia', conta: `${e.presentes} pessoa(s) com leitura de presença`, resultado: String(e.presentes), destaque: false },
    { descricao: 'HH disponível', conta: `${e.presentes} × ${n(e.jornada)} h`, resultado: `${n(e.hh_disponivel)} h`, destaque: true }],
  fontes: [{ dado: 'Presença', valor: String(e.presentes), origem: 'Leituras de crachá/rosto/lista no app de campo', local: 'Apropriação' },
    { dado: 'Jornada', valor: `${n(e.jornada)} h`, origem: 'Cadastro da equipe', local: e.nome }],
  notas: ['Presente = pelo menos uma leitura da pessoa no dia.'],
});
const memGrupo = (nome: string, eqs: EquipeDia[], d: Dia | null): MemoriaCalculo => {
  const pres = eqs.reduce((a, e) => a + e.presentes, 0); const tot = eqs.reduce((a, e) => a + e.total, 0);
  const hh = eqs.reduce((a, e) => a + e.hh_disponivel, 0);
  return {
    chave: 'grupo', titulo: d ? 'Presentes nas equipes' : `Presentes · ${nome}`, valor: `${pres} de ${tot}`, formula: 'Σ presentes das equipes ÷ Σ efetivo das equipes',
    passos: [...eqs.map((e) => ({ descricao: e.nome, conta: `${e.presentes} de ${e.total} · ${n(e.hh_disponivel)} HH`, resultado: `${e.presentes}/${e.total}`, destaque: false })),
      { descricao: 'Total', conta: `${pres} de ${tot} · ${n(hh)} HH`, resultado: tot ? `${n((pres / tot) * 100, 1)}%` : '—', destaque: true }],
    fontes: [{ dado: 'Presença', valor: String(pres), origem: 'Apropriação (app de campo)', local: '1ª leitura de cada pessoa no dia' },
      { dado: 'Efetivo', valor: String(tot), origem: 'Cadastro de Equipes', local: 'encarregado + membros ativos' }],
    notas: d ? ['Pessoa que está em duas equipes conta uma vez no total da obra.'] : [],
  };
};

/** Presença do dia (specs 063 e 071): equipes agrupadas por setor em cartões compactos e a aba de indicadores. */
export default function PresencaDiaPage() {
  const [aba, setAba] = useState<'equipes' | 'indicadores'>('equipes');
  return (
    <>
      <Cabecalho eyebrow="Efetivo · apropriação" cor="var(--m-proc-executar)" titulo="Presença do dia"
        acoes={<Link href="/app/efetivo/identificacao" className="text-[13px] font-semibold text-m-accent underline">Crachá e rosto</Link>} />
      <Abas rotulo="Presença" ativa={aba} onTrocar={setAba} abas={[{ chave: 'equipes', titulo: 'Equipes' }, { chave: 'indicadores', titulo: 'Indicadores' }]} />
      {aba === 'equipes' ? <Equipes /> : <IndicadoresPresenca />}
    </>
  );
}

function Equipes() {
  const api = useApi();
  const [data, setData] = useState(hoje());
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todas' | 'faltas' | 'completas'>('todas');
  const [aberta, setAberta] = useState<Set<number>>(new Set());
  const q = useQuery({ queryKey: ['presenca', 'dia', data], queryFn: () => api.get<Dia>(`/presenca/dia?data=${data}`) });
  const d = q.data;
  const alternar = (id: number) => setAberta((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; });

  const grupos = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const eqs = (d?.equipes ?? []).filter((e) => e.total)
      .filter((e) => filtro === 'todas' || (filtro === 'faltas' ? e.presentes < e.total : e.presentes === e.total))
      .filter((e) => !t || [e.nome, e.encarregado, e.setor?.nome, ...e.pessoas.map((p) => p.nome)].some((x) => (x ?? '').toLowerCase().includes(t)));
    const m = new Map<string, { setor: Setor | null; equipes: EquipeDia[] }>();
    for (const e of eqs) {
      const k = e.setor?.nome ?? SEM_SETOR;
      if (!m.has(k)) m.set(k, { setor: e.setor, equipes: [] });
      m.get(k)!.equipes.push(e);
    }
    return [...m.entries()].sort(([a], [b]) => (a === SEM_SETOR ? 1 : b === SEM_SETOR ? -1 : a.localeCompare(b, 'pt-BR')));
  }, [d, busca, filtro]);
  const todasAbertas = grupos.length > 0 && grupos.every(([, g]) => g.equipes.every((e) => aberta.has(e.equipe_id)));

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <Campo rotulo="Dia" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        <label className="relative flex min-w-[220px] flex-1 flex-col gap-1.5 md:max-w-[320px]">
          <span className="text-[13px] font-medium text-m-text-secondary">Buscar equipe ou pessoa</span>
          <Search size={15} className="pointer-events-none absolute bottom-3 left-3 text-m-text-muted" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, encarregado, setor…"
            className="h-10 rounded-m-md border border-m-stroke bg-m-surface-field pl-9 pr-3 text-[14px] outline-none focus:border-m-accent" />
        </label>
        <div className="flex flex-wrap gap-1.5 pb-1">
          <Chip ativo={filtro === 'todas'} onClick={() => setFiltro('todas')}>Todas</Chip>
          <Chip ativo={filtro === 'faltas'} onClick={() => setFiltro('faltas')}>Com ausentes</Chip>
          <Chip ativo={filtro === 'completas'} onClick={() => setFiltro('completas')}>Completas</Chip>
          <Chip onClick={() => setAberta(todasAbertas ? new Set() : new Set(grupos.flatMap(([, g]) => g.equipes.map((e) => e.equipe_id))))}>
            {todasAbertas ? 'Recolher nomes' : 'Mostrar nomes'}</Chip>
        </div>
      </div>
      {d && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Indicador rotulo="Presentes" valor={d.presentes} detalhe="pessoas com leitura no dia" />
          <Indicador rotulo="Nas equipes" valor={<Calculado chave="grupo" memoria={() => memGrupo('obra', d.equipes.filter((e) => e.total), d)}>{`${d.presentes_nas_equipes} de ${d.nas_equipes}`}</Calculado>}
            detalhe={d.nas_equipes ? `${n((d.presentes_nas_equipes / d.nas_equipes) * 100, 1)}% do efetivo` : undefined} />
          <Indicador rotulo="HH disponível" valor={`${n(d.hh_disponivel)} h`} detalhe="presentes × jornada" />
          <Indicador rotulo="Presentes sem equipe" valor={d.sem_equipe.length} tom={d.sem_equipe.length ? 'atencao' : undefined} />
        </div>
      )}
      {q.isLoading && <p className="text-sm text-m-text-muted">Carregando…</p>}
      {d && !d.presentes && <Painel titulo="Ninguém registrado"><p className="text-[13px] text-m-text-muted">Nenhuma leitura de presença neste dia. As leituras entram pelo app de campo (botão Presença) e sobem quando o celular tem internet.</p></Painel>}
      {d && !grupos.length && d.presentes > 0 && <p className="text-[13px] text-m-text-muted">Nenhuma equipe com esse filtro.</p>}

      {grupos.map(([nome, g]) => {
        const pres = g.equipes.reduce((a, e) => a + e.presentes, 0); const tot = g.equipes.reduce((a, e) => a + e.total, 0);
        const hh = g.equipes.reduce((a, e) => a + e.hh_disponivel, 0);
        const cor = g.setor?.cor ?? 'var(--m-stroke)';
        return (
          <section key={nome} aria-label={`Setor ${nome}`} className="flex flex-col gap-2.5">
            <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-m-stroke-subtle pb-1.5">
              <span className="h-3 w-3 rounded-full" style={{ background: cor }} aria-hidden />
              <h2 className="text-[15px] font-semibold text-m-text-primary">{nome}</h2>
              <span className="text-[13px] text-m-text-muted">{g.equipes.length} equipe(s) ·{' '}
                <Calculado chave="grupo" memoria={() => memGrupo(nome, g.equipes, null)}>{`${pres} de ${tot} presentes`}</Calculado> · {n(hh)} HH</span>
            </header>
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
              {g.equipes.map((e) => <CartaoEquipe key={e.equipe_id} e={e} cor={cor} aberta={aberta.has(e.equipe_id)} onAlternar={() => alternar(e.equipe_id)} />)}
            </div>
          </section>
        );
      })}

      {d && d.sem_equipe.length > 0 && (
        <section aria-label="Presentes sem equipe" className="flex flex-col gap-2">
          <header className="flex items-center gap-3 border-b border-m-stroke-subtle pb-1.5">
            <h2 className="text-[15px] font-semibold text-m-warning">Presentes sem equipe</h2>
            <span className="text-[13px] text-m-text-muted">{d.sem_equipe.length} pessoa(s) — coloque numa equipe pelo organograma</span>
          </header>
          <ul className="grid gap-x-6 gap-y-0.5 text-[13px] md:grid-cols-2 xl:grid-cols-3">
            {d.sem_equipe.map((p) => <li key={p.id} className="truncate">{p.nome} <span className="text-m-text-muted">· {p.funcao ?? '—'} · {hora(p.hora)}</span></li>)}
          </ul>
        </section>
      )}
    </>
  );
}

function CartaoEquipe({ e, cor, aberta, onAlternar }: { e: EquipeDia; cor: string; aberta: boolean; onAlternar: () => void }) {
  const pct = e.total ? e.presentes / e.total : 0;
  const tom = e.presentes === e.total ? 'text-m-success' : e.presentes ? 'text-m-warning' : 'text-m-danger';
  const barra = e.presentes === e.total ? 'var(--m-success)' : e.presentes ? 'var(--m-warning)' : 'var(--m-danger)';
  const ausentes = e.pessoas.filter((p) => !p.presente);
  return (
    <article className="flex flex-col gap-2 rounded-m-carimbo border border-m-stroke-subtle border-l-4 bg-m-surface-raised px-3.5 py-3" style={{ borderLeftColor: cor }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-semibold text-m-text-primary" title={e.nome}>{e.nome}</h3>
          {e.encarregado && <p className="truncate text-[12px] text-m-text-muted">Enc. {semCracha(e.encarregado)}</p>}
        </div>
        <div className="shrink-0 text-right">
          <span className={`text-[18px] font-semibold tabular-nums leading-6 ${tom}`}>{e.presentes}<span className="text-[13px] font-normal text-m-text-muted">/{e.total}</span></span>
          <span className="block text-[12px] text-m-text-muted"><Calculado chave="hh" memoria={() => memHH(e)}>{`${n(e.hh_disponivel)} HH`}</Calculado></span>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-m-row" role="progressbar" aria-valuemin={0} aria-valuemax={e.total} aria-valuenow={e.presentes} aria-label={`${e.presentes} de ${e.total} presentes`}>
        <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: barra }} />
      </div>
      <div className="flex flex-wrap gap-1">
        {e.por_funcao.map((f) => (
          <span key={f.funcao} className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${f.presentes === f.total ? 'bg-m-success-subtle text-m-success' : 'bg-m-warning-subtle text-m-warning'}`}>{f.presentes}/{f.total} {f.funcao}</span>
        ))}
      </div>
      {!aberta && ausentes.length > 0 && ausentes.length <= 3 && (
        <p className="truncate text-[12px] text-m-danger" title={ausentes.map((p) => p.nome).join(', ')}>Ausente: {ausentes.map((p) => p.nome.split(' ')[0]).join(', ')}</p>
      )}
      <button type="button" onClick={onAlternar} aria-expanded={aberta} className="flex items-center gap-1 self-start text-[12.5px] font-semibold text-m-accent">
        {aberta ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{aberta ? 'Esconder nomes' : `Ver ${e.total} nome(s)`}
      </button>
      {aberta && (
        <ul className="flex flex-col text-[12.5px]">
          {e.pessoas.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 border-t border-m-stroke-subtle py-1">
              <span className="min-w-0 truncate"><b className={p.presente ? 'font-semibold text-m-text-primary' : 'font-normal text-m-text-muted'}>{p.nome}</b>{' '}
                <span className="text-[11.5px] text-m-text-muted">{[p.funcao, p.papel === 'encarregado' && 'enc.'].filter(Boolean).join(' · ')}</span></span>
              <span className={`shrink-0 text-[11.5px] font-semibold ${p.presente ? 'text-m-success' : 'text-m-danger'}`}
                title={(p.leituras ?? 1) > 1 ? `${p.leituras} leituras — vale a 1ª` : undefined}>
                {p.presente ? `${hora(p.hora)} · ${MEIO[p.meio ?? ''] ?? p.meio}${(p.leituras ?? 1) > 1 ? ` ×${p.leituras}` : ''}` : 'ausente'}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
