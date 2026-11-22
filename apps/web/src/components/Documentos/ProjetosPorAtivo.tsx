'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronRight, Link2, Upload } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { LinhasCarregando } from '@/components/Obra/Esqueleto';
import { Botao, Chip, Indicador, Painel, Pilula, td } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { TOM_STATUS, type StatusAtivo } from '@/lib/documentos/ativos';
import { useObra } from '@/lib/obra/ObraProvider';

type SitProjeto = 'vigente' | 'sem_vigente' | 'fora_ldo' | 'cancelado' | 'sem_projeto';
interface Ref { indice: number; texto: string; cwa: string | null; tag: string | null; descricao: string; area_id: number | null; area: string | null; confirmada: boolean; como: string | null }
interface Projeto { id: number; codigo: string | null; revisao_citada: string | null; disciplina: string | null; obs: string | null; nota: string | null; cancelado: boolean; documento_id: number | null; titulo: string | null; vigente: string | null; situacao: SitProjeto; parecidos: string[] }
interface Ativo { id: number; grupo: string | null; texto: string; status: StatusAtivo; status_texto: string | null; linha: number | null; refs: Ref[]; projetos: Projeto[] }
interface Resposta {
  importado_em: string | null; importado_por: string | null; ativos: Ativo[]; status: Record<StatusAtivo, string>; areas: { id: number; rotulo: string }[];
  totais: { ativos: number; projetos: number; vigentes: number; sem_vigente: number; fora_ldo: number; cancelados: number; sem_frente: number; a_confirmar: number; desenhos_sem_frente: number };
}
interface Previa { ativos: number; por_status: Record<string, number>; frentes_confirmadas: number; frentes_sugeridas: number; sem_frente: string[]; projetos: number; cancelados: number; na_ldo: number; fora_ldo: string[]; avisos: string[]; ligacoes_novas?: number; ligacoes_confirmadas?: number; sugestoes_removidas?: number }

const SIT: Record<SitProjeto, { rotulo: string; tom: 'sucesso' | 'atencao' | 'neutro' | 'perigo' | 'info' }> = {
  vigente: { rotulo: 'vigente', tom: 'sucesso' }, sem_vigente: { rotulo: 'sem revisão vigente', tom: 'atencao' }, fora_ldo: { rotulo: 'fora da LDO', tom: 'perigo' },
  cancelado: { rotulo: 'cancelado no ativo', tom: 'neutro' }, sem_projeto: { rotulo: 'sem projeto', tom: 'neutro' },
};
const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Projetos por ativo (spec 133): a planilha "Controle de projetos por ativo" liga cada projeto ao ativo/CWA. Ao importar, TAG ou
 * CWA único confirmam a frente e os projetos passam a valer para ela (campo, WBS, plano); o que só casou pelo nome fica para
 * confirmar e o ativo sem frente é relacionado aqui. Cancelado no ativo não liga; fora da LDO aparece para cobrar.
 */
export function ProjetosPorAtivo({ onAbrir }: { onAbrir: (id: number) => void }) {
  const api = useApi();
  const qc = useQueryClient();
  const { pode } = useObra();
  const planejador = pode('planejador');
  const q = useQuery({ queryKey: ['documentos', 'ativos'], queryFn: () => api.get<Resposta>('/documentos/ativos') });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [lendo, setLendo] = useState(false);
  const [filtro, setFiltro] = useState<StatusAtivo | 'sem_frente' | 'fora' | ''>('');
  const [busca, setBusca] = useState('');
  const [abertos, setAbertos] = useState<Set<number>>(new Set());
  const d = q.data;
  const t = d?.totais;

  const enviar = async (f: File, gravar: boolean) => {
    const fd = new FormData(); fd.append('arquivo', f, f.name);
    setLendo(true);
    try {
      const r = await api.post<Previa>(gravar ? '/documentos/ativos' : '/documentos/ativos/previa', fd);
      if (gravar) {
        toast.success(`Controle importado: ${r.ativos} ativos · ${r.ligacoes_novas ?? 0} ligações novas, ${r.ligacoes_confirmadas ?? 0} confirmadas`);
        setPrevia(null); setArquivo(null);
        qc.invalidateQueries({ queryKey: ['documentos'] });
      } else { setPrevia(r); setArquivo(f); }
    } catch (e) { toast.error((e as Error).message); } finally { setLendo(false); }
  };
  const relacionar = async (a: Ativo, r: Ref, areaId: number | null) => {
    try {
      const x = await api.put<{ ligados: number }>(`/documentos/ativos/${a.id}/frente`, { indice: r.indice, area_id: areaId });
      toast.success(areaId ? `Frente definida${x.ligados ? ` · ${x.ligados} projeto(s) ligados` : ''}` : 'Frente tirada do ativo');
      qc.invalidateQueries({ queryKey: ['documentos'] });
    } catch (e) { toast.error((e as Error).message); }
  };

  const lista = useMemo(() => (d?.ativos ?? []).filter((a) => {
    if (filtro === 'sem_frente' && !a.refs.some((r) => !r.area_id || !r.confirmada)) return false;
    if (filtro === 'fora' && !a.projetos.some((p) => p.situacao === 'fora_ldo' || p.situacao === 'sem_vigente')) return false;
    if (filtro && filtro !== 'sem_frente' && filtro !== 'fora' && a.status !== filtro) return false;
    if (busca.trim()) {
      const b = norm(busca.trim());
      return norm(a.texto).includes(b) || a.projetos.some((p) => norm(`${p.codigo ?? ''} ${p.disciplina ?? ''} ${p.titulo ?? ''}`).includes(b));
    }
    return true;
  }), [d, filtro, busca]);
  const porStatus = useMemo(() => {
    const m: Partial<Record<StatusAtivo, number>> = {};
    (d?.ativos ?? []).forEach((a) => { m[a.status] = (m[a.status] ?? 0) + 1; });
    return m;
  }, [d]);
  const alternar = (id: number) => setAbertos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const botaoArquivo = planejador && (
    <label className="flex h-10 w-fit cursor-pointer items-center gap-2 rounded-full bg-m-accent-strong px-4 text-[13px] font-semibold text-m-on-accent">
      <Upload size={16} strokeWidth={1.75} /> {lendo ? 'Lendo…' : d?.ativos.length ? 'Importar de novo' : 'Importar o controle'}
      <input type="file" accept=".xlsx,.xlsm" className="sr-only" aria-label="Controle de projetos por ativo" disabled={lendo}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void enviar(f, false); }} />
    </label>
  );

  return (
    <Painel titulo="Cada projeto está no ativo certo?"
      subtitulo={<>O controle de projetos por ativo (STATUS | Ativo | Projeto | Disciplina | OBS) liga cada projeto ao CWA. TAG ou CWA confirmam a frente e o projeto passa a valer para ela no campo, na WBS e no plano; só o nome sugere. Cancelado no ativo não liga.{d?.importado_em && <> Importado por {d.importado_por} em {new Date(d.importado_em).toLocaleString('pt-BR')}.</>}</>}
      acoes={botaoArquivo}>
      {previa && arquivo && (
        <div className="rounded-m-lg border border-m-accent bg-m-accent-subtle p-4 text-[13px]">
          <div className="mb-2 font-semibold text-m-text-primary">Prévia de {arquivo.name}</div>
          <p className="text-m-text-secondary">{previa.ativos} ativos · {previa.frentes_confirmadas} com a frente confirmada (TAG/CWA), {previa.frentes_sugeridas} só sugerida(s), {previa.sem_frente.length} sem frente ·
            {' '}{previa.projetos} projetos ({previa.na_ldo} na LDO, {previa.fora_ldo.length} fora) · {previa.cancelados} cancelado(s) no ativo.</p>
          {previa.sem_frente.length > 0 && <p className="mt-1 text-[12px] text-m-warning">Sem frente: {previa.sem_frente.slice(0, 8).join(' · ')}{previa.sem_frente.length > 8 ? '…' : ''} — relacione depois, aqui mesmo.</p>}
          {previa.fora_ldo.length > 0 && <p className="mt-1 text-[12px] text-m-text-muted">Fora da LDO: {previa.fora_ldo.slice(0, 12).join(', ')}{previa.fora_ldo.length > 12 ? '…' : ''}</p>}
          <div className="mt-3 flex gap-2">
            <Botao disabled={lendo} onClick={() => enviar(arquivo, true)}><Check size={15} /> Importar e ligar os projetos</Botao>
            <Botao variante="secundario" onClick={() => { setPrevia(null); setArquivo(null); }}>Cancelar</Botao>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Indicador rotulo="Ativos" valor={t?.ativos ?? '—'} detalhe="no controle" />
        <Indicador rotulo="Projetos vigentes" valor={t ? `${t.vigentes}/${t.projetos}` : '—'} tom={t && t.vigentes === t.projetos ? 'sucesso' : undefined} detalhe="revisão que libera o uso" />
        <Indicador rotulo="Sem revisão vigente" valor={t?.sem_vigente ?? '—'} tom={t?.sem_vigente ? 'atencao' : undefined} detalhe="na LDO, esperando" />
        <Indicador rotulo="Fora da LDO" valor={t?.fora_ldo ?? '—'} tom={t?.fora_ldo ? 'perigo' : undefined} detalhe="citados no controle" />
        <Indicador rotulo="Ativos sem frente" valor={t ? t.sem_frente + t.a_confirmar : '—'} tom={t && t.sem_frente + t.a_confirmar ? 'atencao' : undefined} detalhe={t ? `${t.a_confirmar} a confirmar` : 'relacionar'} />
        <Indicador rotulo="Desenhos sem frente" valor={t?.desenhos_sem_frente ?? '—'} detalhe="LDO sem ativo" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip ativo={!filtro} onClick={() => setFiltro('')}>Todos</Chip>
        {(Object.keys(TOM_STATUS) as StatusAtivo[]).map((k) => porStatus[k] ? <Chip key={k} ativo={filtro === k} onClick={() => setFiltro(k)}>{d?.status[k] ?? k} ({porStatus[k]})</Chip> : null)}
        {!!t && t.sem_frente + t.a_confirmar > 0 && <Chip ativo={filtro === 'sem_frente'} onClick={() => setFiltro('sem_frente')}>Sem frente / a confirmar</Chip>}
        {!!t && t.fora_ldo + t.sem_vigente > 0 && <Chip ativo={filtro === 'fora'} onClick={() => setFiltro('fora')}>Projeto a cobrar</Chip>}
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar ativo, projeto ou disciplina" aria-label="Buscar no controle"
          className="ml-auto h-9 w-full rounded-full border border-m-stroke bg-m-surface-field px-4 text-[13px] outline-none focus:border-m-accent sm:w-[300px]" />
      </div>
      {q.isLoading ? <LinhasCarregando colunas={4} /> : !d?.ativos.length ? (
        <p className="rounded-m-lg border border-dashed border-m-stroke p-6 text-center text-[13px] text-m-text-muted">Nenhum controle importado. Envie a planilha de projetos por ativo: cada projeto vai para a frente do seu CWA.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[13px]">
            <tbody>
              {lista.map((a, i) => {
                const aberto = abertos.has(a.id) || !!busca.trim();
                const validos = a.projetos.filter((p) => p.codigo && !p.cancelado);
                const vig = validos.filter((p) => p.situacao === 'vigente').length;
                return (
                  <Fragment key={a.id}>
                    {(i === 0 || lista[i - 1].grupo !== a.grupo) && (
                      <tr><td colSpan={4} className="bg-m-surface-active px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.48px] text-m-text-tertiary">{a.grupo ?? 'Sem grupo'}</td></tr>
                    )}
                    <tr className="border-b border-m-row align-top">
                      <td className={`${td} w-8`}>
                        <button type="button" aria-label={`${aberto ? 'Recolher' : 'Abrir'} ${a.texto}`} onClick={() => alternar(a.id)} className="text-m-text-tertiary hover:text-m-accent">
                          {aberto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td className={`${td} min-w-[300px]`}>
                        {a.refs.map((r) => (
                          <div key={r.indice} className="mb-1 last:mb-0">
                            <span className="font-semibold text-m-text-primary">{r.cwa ? `CWA ${r.cwa} · ` : ''}{r.tag ? `${r.tag} · ` : ''}{r.descricao}</span>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px]">
                              {r.area_id && r.confirmada && <span className="inline-flex items-center gap-1 text-m-success"><Link2 size={12} /> {r.area}<span className="text-m-text-muted">· {r.como}</span></span>}
                              {r.area_id && !r.confirmada && <span className="text-m-warning">sugerida: {r.area} ({r.como})</span>}
                              {r.area_id && !r.confirmada && planejador && <button type="button" className="font-semibold text-m-accent" onClick={() => relacionar(a, r, r.area_id)}>confirmar</button>}
                              {!r.area_id && <span className="text-m-warning">sem frente</span>}
                              {planejador && (!r.area_id || !r.confirmada) && (
                                <select aria-label={`Frente de ${r.descricao}`} value="" onChange={(e) => e.target.value && relacionar(a, r, Number(e.target.value))}
                                  className="h-7 max-w-[300px] rounded-[8px] border border-m-stroke bg-m-surface-field px-1.5 text-[12px] text-m-text-secondary outline-none focus:border-m-accent">
                                  <option value="">relacionar à frente…</option>
                                  {d.areas.map((x) => <option key={x.id} value={x.id}>{x.rotulo}</option>)}
                                </select>
                              )}
                            </div>
                          </div>
                        ))}
                      </td>
                      <td className={`${td} whitespace-nowrap`}><Pilula tom={TOM_STATUS[a.status]}>{d.status[a.status]}</Pilula>
                        {a.status_texto && a.status_texto.length > 12 && norm(a.status_texto) !== norm(d.status[a.status]) && <div className="mt-1 max-w-[220px] whitespace-normal text-[11px] text-m-text-muted">{a.status_texto}</div>}</td>
                      <td className={`${td} whitespace-nowrap text-right text-[12px] text-m-text-secondary`}>
                        {validos.length ? <>{validos.length} projeto(s) · <span className={vig === validos.length ? 'text-m-success' : 'text-m-warning'}>{vig} vigente(s)</span></> : <span className="text-m-text-muted">sem projeto</span>}
                        {a.linha && <div className="text-[11px] text-m-text-muted">linha {a.linha}</div>}
                      </td>
                    </tr>
                    {aberto && (
                      <tr className="border-b border-m-row bg-m-row">
                        <td />
                        <td colSpan={3} className="px-3 pb-3 pt-1">
                          <table className="w-full text-[12.5px]">
                            <thead><tr className="text-left text-[11px] uppercase tracking-[0.48px] text-m-text-muted">
                              <th className="py-1 pr-3 font-semibold">Projeto</th><th className="py-1 pr-3 font-semibold">No ativo</th><th className="py-1 pr-3 font-semibold">Vigente</th><th className="py-1 pr-3 font-semibold">Situação</th><th className="py-1 font-semibold">Obs.</th>
                            </tr></thead>
                            <tbody>
                              {a.projetos.map((p) => (
                                <tr key={p.id} className={p.cancelado ? 'text-m-text-muted line-through decoration-m-text-muted/50' : ''}>
                                  <td className="py-1 pr-3">{p.documento_id ? <button type="button" className="font-semibold text-m-accent hover:underline" onClick={() => onAbrir(p.documento_id!)}>{p.codigo}</button> : <span className="font-semibold">{p.codigo ?? p.nota ?? '—'}</span>}
                                    {p.titulo && <div className="max-w-[360px] truncate text-[11px] text-m-text-muted no-underline">{p.titulo}</div>}</td>
                                  <td className="py-1 pr-3">{p.disciplina ?? '—'}</td>
                                  <td className="py-1 pr-3">{p.vigente ? `rev. ${p.vigente}` : '—'}{p.revisao_citada && p.revisao_citada !== p.vigente && <div className="text-[11px] text-m-text-muted">citada: {p.revisao_citada}</div>}</td>
                                  <td className="py-1 pr-3"><Pilula tom={SIT[p.situacao].tom}>{SIT[p.situacao].rotulo}</Pilula>
                                    {p.parecidos.length > 0 && <div className="mt-0.5 text-[11px] text-m-warning no-underline">na LDO como {p.parecidos.join(' ou ')}?</div>}</td>
                                  <td className="max-w-[260px] py-1 text-[11.5px] text-m-text-muted">{p.obs ?? ''}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {!lista.length && <p className="p-4 text-center text-[13px] text-m-text-muted">Nada com esse filtro.</p>}
        </div>
      )}
    </Painel>
  );
}
