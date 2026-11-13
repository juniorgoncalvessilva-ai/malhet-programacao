'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Calculado, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { Campo, Chip, Indicador, Painel, Tabela, td, tdNum } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';

interface PorDia { data: string; presentes: number; efetivo: number; presentes_nas_equipes: number; sem_equipe: number; taxa: number | null; hh: number }
interface PorEquipe { equipe_id: number; nome: string; setor: string | null; efetivo: number; dias: number; presencas: number; possiveis: number; faltas: number; taxa: number | null; absenteismo: number | null; hh: number }
interface Indicadores {
  de: string; ate: string; dias: string[];
  resumo: { dias: number; efetivo: number; presencas: number; possiveis: number; taxa: number | null; absenteismo: number | null; media_presentes: number | null; hh: number; pessoas_dia: number };
  por_dia: PorDia[]; por_equipe: PorEquipe[]; por_meio: Record<string, number>; chegada: { hora: number; pessoas: number }[];
  mais_faltas: { colaborador_id: number; nome: string; equipe: string | null; faltas: number; dias: number }[];
  memorias: Record<string, MemoriaCalculo>;
}

const n = (x: number | null | undefined, c = 1) => (x == null ? '—' : x.toLocaleString('pt-BR', { maximumFractionDigits: c }));
const pct = (x: number | null | undefined) => (x == null ? '—' : `${n(x * 100)}%`);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const menos = (dias: number) => { const d = new Date(); d.setDate(d.getDate() - dias); return iso(d); };
const ddmm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MEIO: Record<string, string> = { nfc: 'Crachá NFC', qr: 'QR / link', codigo: 'Código de barras', facial: 'Rosto', manual: 'Lista (manual)' };

/** Uma série em colunas: barra fina com ponta arredondada, rótulo só nas extremidades e dica ao passar o mouse/tocar. */
function Colunas({ itens, max, rotulo }: { itens: { chave: string; eixo: string; valor: number; texto: string; dica: string }[]; max: number; rotulo: string }) {
  const [foco, setFoco] = useState<string | null>(null);
  if (!itens.length) return <p className="py-6 text-center text-[13px] text-m-text-muted">Sem dados no período.</p>;
  const maior = itens.reduce((a, b) => (b.valor > a.valor ? b : a));
  const menor = itens.reduce((a, b) => (b.valor < a.valor ? b : a));
  return (
    <figure aria-label={rotulo} className="flex flex-col gap-1">
      <div className="flex h-40 items-end gap-[2px] border-b border-m-stroke-subtle">
        {itens.map((i) => {
          const h = max ? (i.valor / max) * 100 : 0;
          const marcar = i.chave === maior.chave || (itens.length > 2 && i.chave === menor.chave) || foco === i.chave;
          return (
            <button key={i.chave} type="button" aria-label={i.dica} onMouseEnter={() => setFoco(i.chave)} onMouseLeave={() => setFoco(null)}
              onFocus={() => setFoco(i.chave)} onBlur={() => setFoco(null)}
              className="group relative flex h-full min-w-0 flex-1 flex-col justify-end outline-none">
              {marcar && <span className="mb-0.5 truncate text-center text-[10.5px] font-semibold tabular-nums text-m-text-secondary">{i.texto}</span>}
              <span className="mx-auto w-full max-w-[28px] rounded-t-[4px] bg-m-accent transition-opacity group-hover:opacity-80 group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-m-accent"
                style={{ height: `${Math.max(h, i.valor ? 2 : 0)}%` }} />
              {foco === i.chave && (
                <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-[220px] -translate-x-1/2 rounded-m-md border border-m-stroke bg-m-surface-raised px-2.5 py-1.5 text-left text-[12px] text-m-text-primary shadow-lg">{i.dica}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex gap-[2px]">
        {itens.map((i, k) => (
          <span key={i.chave} className="min-w-0 flex-1 truncate text-center text-[10.5px] text-m-text-muted">
            {itens.length <= 16 || k % Math.ceil(itens.length / 12) === 0 ? i.eixo : ''}</span>
        ))}
      </div>
    </figure>
  );
}

/** Barra horizontal de uma linha (meio de leitura, taxa da equipe). */
function BarraH({ valor, max, cor = 'var(--m-accent)' }: { valor: number; max: number; cor?: string }) {
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full bg-m-row">
      <span className="block h-full rounded-full" style={{ width: `${max ? Math.min(100, (valor / max) * 100) : 0}%`, background: cor }} />
    </span>
  );
}

const corTaxa = (t: number | null) => (t == null ? 'var(--m-stroke)' : t >= 0.95 ? 'var(--m-success)' : t >= 0.85 ? 'var(--m-warning)' : 'var(--m-danger)');
const textoTaxa = (t: number | null) => (t == null ? '' : t >= 0.95 ? 'text-m-success' : t >= 0.85 ? 'text-m-warning' : 'text-m-danger');

/** Indicadores da presença no período (spec 071): presença × efetivo, absenteísmo por equipe, chegada e meio de leitura. */
export function IndicadoresPresenca() {
  const api = useApi();
  const [de, setDe] = useState(menos(29));
  const [ate, setAte] = useState(iso(new Date()));
  const q = useQuery({ queryKey: ['presenca', 'indicadores', de, ate], queryFn: () => api.get<Indicadores>(`/presenca/indicadores?de=${de}&ate=${ate}`) });
  const r = q.data;
  const preset = (dias: number) => { setDe(menos(dias - 1)); setAte(iso(new Date())); };
  const meios = r ? Object.entries(r.por_meio).sort((a, b) => b[1] - a[1]) : [];
  const totalMeios = meios.reduce((a, [, v]) => a + v, 0);
  const totalChegada = r?.chegada.reduce((a, c) => a + c.pessoas, 0) ?? 0;

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <Campo rotulo="De" type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} />
        <Campo rotulo="Até" type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} />
        <div className="flex gap-1.5 pb-1">
          {[7, 15, 30, 90].map((x) => <Chip key={x} ativo={de === menos(x - 1) && ate === iso(new Date())} onClick={() => preset(x)}>{x} dias</Chip>)}
        </div>
      </div>
      {q.isLoading && <p className="text-sm text-m-text-muted">Carregando…</p>}
      {q.error && <p className="text-[13px] text-m-danger">{(q.error as Error).message}</p>}
      {r && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Indicador rotulo="Taxa de presença" tom={r.resumo.taxa == null ? undefined : r.resumo.taxa >= 0.95 ? 'sucesso' : r.resumo.taxa >= 0.85 ? 'atencao' : 'perigo'}
              valor={<Calculado chave="taxa" memoria={() => r.memorias.taxa}>{pct(r.resumo.taxa)}</Calculado>} detalhe={`${r.resumo.presencas} de ${r.resumo.possiveis} presenças`} />
            <Indicador rotulo="Absenteísmo" valor={<Calculado chave="absenteismo" memoria={() => r.memorias.absenteismo}>{pct(r.resumo.absenteismo)}</Calculado>}
              detalhe={`${r.resumo.possiveis - r.resumo.presencas} falta(s)`} />
            <Indicador rotulo="Média de presentes" valor={<Calculado chave="media" memoria={() => r.memorias.media}>{n(r.resumo.media_presentes)}</Calculado>} detalhe="por dia apurado" />
            <Indicador rotulo="HH disponível" valor={<Calculado chave="hh" memoria={() => r.memorias.hh}>{`${n(r.resumo.hh, 0)} h`}</Calculado>} detalhe="presentes × jornada" />
            <Indicador rotulo="Dias apurados" valor={r.resumo.dias} detalhe={`efetivo das equipes: ${r.resumo.efetivo}`} />
          </div>
          {!r.resumo.dias && <Painel titulo="Sem leituras no período"><p className="text-[13px] text-m-text-muted">Nenhum dia com presença registrada entre {ddmm(r.de)} e {ddmm(r.ate)}.</p></Painel>}
          {r.resumo.dias > 0 && (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Painel titulo="Presença por dia" subtitulo="presentes nas equipes ÷ efetivo das equipes">
                  <Colunas rotulo="Taxa de presença por dia" max={1} itens={r.por_dia.map((x) => {
                    const dt = new Date(`${x.data}T12:00:00`);
                    return { chave: x.data, eixo: ddmm(x.data), valor: x.taxa ?? 0, texto: pct(x.taxa),
                      dica: `${SEMANA[dt.getDay()]} ${ddmm(x.data)}: ${pct(x.taxa)} — ${x.presentes_nas_equipes} de ${x.efetivo} nas equipes${x.sem_equipe ? `, +${x.sem_equipe} sem equipe` : ''} · ${n(x.hh, 0)} HH` };
                  })} />
                </Painel>
                <Painel titulo="Horário de chegada" subtitulo="primeira leitura de cada pessoa, por hora (Brasília)">
                  <Colunas rotulo="Chegada por hora" max={Math.max(...r.chegada.map((c) => c.pessoas))} itens={r.chegada.map((c) => ({
                    chave: String(c.hora), eixo: `${c.hora}h`, valor: c.pessoas, texto: String(c.pessoas),
                    dica: `${String(c.hora).padStart(2, '0')}:00–${String(c.hora).padStart(2, '0')}:59 · ${c.pessoas} chegada(s) · ${n((c.pessoas / totalChegada) * 100)}%` }))} />
                </Painel>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Painel titulo="Presença por equipe" subtitulo="piores primeiro · composição atual da equipe">
                  <Tabela cabecalho={['Equipe', 'Efetivo', 'Presenças', 'Faltas', 'Taxa', 'HH']} direita={[1, 2, 3, 4, 5]} vazio={!r.por_equipe.length && 'Nenhuma equipe com pessoas.'}>
                    {r.por_equipe.map((e) => (
                      <tr key={e.equipe_id}>
                        <td className={td}><b className="font-semibold text-m-text-primary">{e.nome}</b>
                          {e.setor && <span className="block text-[12px] text-m-text-muted">{e.setor}</span>}</td>
                        <td className={tdNum}>{e.efetivo}</td>
                        <td className={tdNum}>{e.presencas} / {e.possiveis}</td>
                        <td className={tdNum}>{e.faltas}</td>
                        <td className={tdNum}>
                          <span className="flex items-center justify-end gap-2"><span className="w-16 shrink-0"><BarraH valor={e.taxa ?? 0} max={1} cor={corTaxa(e.taxa)} /></span>
                            <b className={`w-12 tabular-nums ${textoTaxa(e.taxa)}`}>{pct(e.taxa)}</b></span>
                        </td>
                        <td className={tdNum}>{n(e.hh, 0)}</td>
                      </tr>
                    ))}
                  </Tabela>
                  <p className="mt-2 text-[12px] text-m-text-muted">Verde ≥ 95% · amarelo 85–95% · vermelho abaixo de 85%.</p>
                </Painel>
                <div className="flex min-w-0 flex-col gap-4">
                  <Painel titulo="Como a presença foi lida">
                    <ul className="flex flex-col gap-2.5">
                      {meios.map(([m, v]) => (
                        <li key={m} className="flex flex-col gap-1 text-[13px]">
                          <span className="flex justify-between"><span>{MEIO[m] ?? m}</span><span className="tabular-nums text-m-text-secondary">{v} · {n((v / totalMeios) * 100)}%</span></span>
                          <BarraH valor={v} max={totalMeios} />
                        </li>
                      ))}
                    </ul>
                  </Painel>
                  <Painel titulo="Quem mais faltou" subtitulo="nos dias apurados">
                    {!r.mais_faltas.length ? <p className="text-[13px] text-m-success">Ninguém faltou no período.</p> : (
                      <ol className="flex flex-col text-[13px]">
                        {r.mais_faltas.map((p) => (
                          <li key={p.colaborador_id} className="flex justify-between gap-2 border-b border-m-stroke-subtle py-1.5">
                            <span className="min-w-0 truncate">{p.nome} <span className="text-[12px] text-m-text-muted">· {p.equipe ?? '—'}</span></span>
                            <span className="shrink-0 font-semibold tabular-nums text-m-danger">{p.faltas} de {p.dias}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </Painel>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
