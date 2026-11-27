'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, ChevronDown, FileUp, RefreshCw, Send, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Calculado, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { LinhasCarregando } from '@/components/Obra/Esqueleto';
import { Botao, CARREGANDO, Cabecalho, Chip, Erro, Indicador, Painel, Pilula, Selecao, Tabela, dataBR, fmt, td } from '@/components/Obra/ui';
import { buscaPq, k } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';
import { useObra } from '@/lib/obra/ObraProvider';

type Sit = 'ok' | 'sugerido' | null;
type Situacao = 'pronta' | 'a_confirmar' | 'sem_vinculo' | 'ignorada' | 'levada';
interface Opcao { id: number; rotulo: string }
interface Planilha {
  descricao: string; unidade: string | null; natureza: string; secao: string | null; grupo: string | null; cwp: string | null; cwp_codigo: string | null;
  encarregados: string[]; responsavel: string | null; id_crono: string | null; item_pq: string | null; local: string | null; cwa: string | null;
  previsto: Record<string, number>; realizado: Record<string, number>; total_previsto: number; total_realizado: number;
  recursos: { oficiais: number | null; servente: number | null; equipamentos: Record<string, number> };
  ssma: { tecnico: string | null; rac: string[]; pts: string[]; art: string[]; pto: string[]; ata: string[] }; qtd_projeto: number | null;
}
interface SugestaoItem { item: string; descricao: string; unidade: string | null; parecenca: number; comuns: string[] }
interface Linha {
  id: number; linha: number; situacao: Situacao; faltando: string[]; lembrada: boolean; conferida: boolean; levada_linha_id: number | null;
  planilha: Planilha;
  area: { valor: Opcao | null; sit: Sit; motivo: string | null; opcoes: Opcao[] };
  crono: { valor: string | null; sit: Sit; motivo: string | null };
  item: { valor: { item: string; descricao: string; unidade: string | null } | null; sit: Sit; motivo: string | null; opcoes: SugestaoItem[] };
  tipo: Opcao | null; grupo: Opcao | null;
  wbs: { valor: { id: number; codigo: string } | null; sit: Sit; motivo: string | null };
  equipe: { valor: Opcao | null; sit: Sit; motivo: string | null; opcoes: Opcao[] };
  cpu: { hh_por_unidade: number | null; indice: number | null; governa: string | null; composicao: string | null } | null;
  capacidade: MemoriaCalculo | null;
}
interface Conferencia {
  id: number; nome_arquivo: string; aba: string; titulo: string | null; inicio: string; fim: string; situacao: string; avisos: string[];
  programacao_id: number | null; placar: Record<Situacao, number>; memoria_placar: MemoriaCalculo; linhas: Linha[];
}
interface Resumo { id: number; nome_arquivo: string; aba: string; inicio: string; fim: string; situacao: string; linhas: number;
  placar: Partial<Record<Situacao, number>>; programacao_id: number | null; criado_por: string; criado_em: string | null }
interface Previa { aba: string; abas: { nome: string; visivel: boolean }[]; titulo: string | null; inicio: string; fim: string; atividades: number; grupos: number; avisos: string[] }
interface Destinos {
  existentes: { id: number; titulo: string; tipo: string; status: string; revisao: number; inicio: string; fim: string; linhas: number }[];
  nova: { inicio: string; fim: string; titulo: string } | null;
}
interface Comparacao { contagem: Record<string, number>; so_no_malhet: number; programacao: { status: string } }
interface Resultado { programacao: { id: number; titulo: string }; criadas: number; atualizadas: number; ja_estavam: number;
  puladas: { linha: number; motivo: string }[]; realizado_dias: number; realizado_mantido_do_campo: number; avisos: string[] }

const SIT: Record<Situacao, { rotulo: string; tom: 'sucesso' | 'atencao' | 'perigo' | 'neutro' | 'acento' }> = {
  pronta: { rotulo: 'Pronta', tom: 'sucesso' }, a_confirmar: { rotulo: 'A confirmar', tom: 'atencao' },
  sem_vinculo: { rotulo: 'Sem vínculo', tom: 'perigo' }, ignorada: { rotulo: 'Não vai', tom: 'neutro' }, levada: { rotulo: 'Levada', tom: 'acento' },
};
const tomSit = (s: Sit, tem: boolean) => (!tem ? 'perigo' : s === 'ok' ? 'sucesso' : 'atencao') as 'sucesso' | 'atencao' | 'perigo';

/**
 * Programação semanal do cliente (spec 146): a planilha entra numa área de conferência — nada muda na programação —, o
 * Malhet liga cada linha à frente, ao item da PQ, à WBS, à equipe e ao cronograma; quem confere confirma ou troca (a decisão
 * fica lembrada para a semana seguinte) e só depois leva à programação, escolhendo o destino a cada vez.
 */
export default function ProgramacaoClientePage() {
  const api = useApi();
  const { pode } = useObra();
  const planejador = pode('planejador');
  const confirmar = useConfirmar();
  const qc = useQueryClient();
  const [aberta, setAberta] = useState<number | null>(null);
  const lista = useQuery({ queryKey: ['programacao-cliente'], queryFn: () => api.get<Resumo[]>('/programacao-cliente') });

  if (aberta != null) return <Conferir id={aberta} voltar={() => setAberta(null)} planejador={planejador} />;
  const n = lista.data?.length ?? 0;
  return (
    <>
      <Cabecalho eyebrow="Programação · planilha do cliente"
        titulo={n ? `${n} planilha${n > 1 ? 's' : ''} do cliente em conferência` : 'Nenhuma planilha do cliente importada ainda'}
        acoes={<Link href="/app/programacoes" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-m-stroke px-4 text-[13px] font-semibold text-m-text-secondary"><ArrowLeft size={15} /> Programações</Link>} />
      {planejador && <Importar onPronto={(id) => { void qc.invalidateQueries({ queryKey: ['programacao-cliente'] }); setAberta(id); }} />}
      <Painel titulo="Quais planilhas já entraram?" subtitulo="Ficam separadas da programação até você levar.">
        <Tabela cabecalho={['Planilha', 'Período', 'Atividades', 'Situação', '']} vazio={lista.isLoading ? CARREGANDO : !n && 'Nenhuma ainda.'}>
          {(lista.data ?? []).map((r) => (
            <tr key={r.id}>
              <td className={td}><button type="button" onClick={() => setAberta(r.id)} className="text-left font-semibold text-m-text-primary hover:text-m-accent">{r.nome_arquivo}</button>
                <span className="block text-[12px] text-m-text-muted">{r.aba} · por {r.criado_por}</span></td>
              <td className={td}>{dataBR(r.inicio)} a {dataBR(r.fim)}</td>
              <td className={td}>{r.linhas} · <span className="text-m-success">{r.placar.pronta ?? 0} prontas</span>{r.placar.levada ? ` · ${r.placar.levada} levadas` : ''}</td>
              <td className={td}><Pilula tom={r.situacao === 'levada' ? 'acento' : 'atencao'}>{r.situacao === 'levada' ? 'Levada' : 'Em conferência'}</Pilula></td>
              <td className={`${td} whitespace-nowrap text-right`}>
                <button type="button" onClick={() => setAberta(r.id)} className="mr-3 font-semibold text-m-accent">Conferir</button>
                {planejador && <button type="button" aria-label={`Tirar ${r.nome_arquivo} da conferência`} className="text-m-text-muted hover:text-m-danger"
                  onClick={async () => {
                    if (!(await confirmar({ titulo: `Tirar ${r.nome_arquivo} da conferência?`, mensagem: 'O que já foi levado continua na programação e as decisões ficam lembradas.', perigo: true }))) return;
                    await api.del(`/programacao-cliente/${r.id}`);
                    void qc.invalidateQueries({ queryKey: ['programacao-cliente'] });
                  }}><Trash2 size={15} /></button>}
              </td>
            </tr>
          ))}
        </Tabela>
      </Painel>
    </>
  );
}

function Importar({ onPronto }: { onPronto: (id: number) => void }) {
  const api = useApi();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [aba, setAba] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const ler = async (f: File, a?: string) => {
    setEnviando(true); setErro(null);
    try {
      const fd = new FormData(); fd.append('arquivo', f); if (a) fd.append('aba', a);
      const p = await api.post<Previa>('/programacao-cliente/previa', fd);
      setPrevia(p); setAba(p.aba);
    } catch (e) { setErro(e); setPrevia(null); } finally { setEnviando(false); }
  };
  const importar = async () => {
    if (!arquivo) return;
    setEnviando(true); setErro(null);
    try {
      const fd = new FormData(); fd.append('arquivo', arquivo); fd.append('aba', aba);
      const v = await api.post<Conferencia>('/programacao-cliente', fd);
      toast.success(`${v.linhas.length} atividades em conferência`);
      setArquivo(null); setPrevia(null);
      onPronto(v.id);
    } catch (e) { setErro(e); } finally { setEnviando(false); }
  };
  return (
    <Painel titulo="Qual planilha conferir?" subtitulo="A planilha semanal no layout da obra (P/R por dia). Nada muda na programação ao importar.">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.48px] text-m-text-muted">
          Arquivo (.xlsx)
          <input type="file" accept=".xlsx,.xlsm" aria-label="Planilha do cliente"
            onChange={(e) => { const f = e.target.files?.[0] ?? null; setArquivo(f); setPrevia(null); if (f) void ler(f); }}
            className="h-10 rounded-m-md border border-dashed border-m-stroke-strong bg-m-surface-field px-2 py-2 text-[13px] font-normal normal-case tracking-normal text-m-text-secondary file:mr-3 file:rounded-full file:border-0 file:bg-m-accent-subtle file:px-3 file:py-1 file:text-xs file:font-semibold file:text-m-accent" />
        </label>
        {previa && previa.abas.length > 1 && (
          <Selecao rotulo="Aba" value={aba} onChange={(e) => { setAba(e.target.value); if (arquivo) void ler(arquivo, e.target.value); }} className="min-w-[240px]">
            {previa.abas.map((a) => <option key={a.nome} value={a.nome}>{a.nome}{a.visivel ? '' : ' (oculta)'}</option>)}
          </Selecao>
        )}
        <Botao disabled={!previa || enviando} onClick={() => void importar()}><FileUp size={16} /> {enviando ? 'Lendo…' : 'Importar para conferir'}</Botao>
      </div>
      {previa && (
        <p className="mt-3 text-[13px] text-m-text-secondary">
          <b className="text-m-text-primary">{previa.aba}</b>: {previa.atividades} atividades em {previa.grupos} grupos, de {dataBR(previa.inicio)} a {dataBR(previa.fim)}
          {previa.titulo ? ` · ${previa.titulo}` : ''}{previa.avisos.length ? ` · ${previa.avisos.length} aviso(s)` : ''}
        </p>
      )}
      <Erro erro={erro} />
    </Painel>
  );
}

function Conferir({ id, voltar, planejador }: { id: number; voltar: () => void; planejador: boolean }) {
  const api = useApi();
  const qc = useQueryClient();
  const chave = ['programacao-cliente', id];
  const q = useQuery({ queryKey: chave, queryFn: () => api.get<Conferencia>(`/programacao-cliente/${id}`) });
  const opcoes = useQuery({ queryKey: ['programacao-cliente', 'opcoes'], queryFn: () => api.get<{ areas: Opcao[]; equipes: Opcao[]; grupos: Opcao[] }>('/programacao-cliente/opcoes') });
  const [filtro, setFiltro] = useState<Situacao | 'todas'>('todas');
  const [aberto, setAberto] = useState<number | null>(null);
  const [levar, setLevar] = useState(false);
  const [grupoLote, setGrupoLote] = useState('');
  const atualizar = (v: Conferencia) => qc.setQueryData(chave, v);
  const acao = async (fn: () => Promise<{ conferencia?: Conferencia } & Record<string, unknown>>, ok?: string) => {
    try {
      const r = await fn();
      if (r.conferencia) atualizar(r.conferencia);
      else if ((r as unknown as Conferencia).linhas) atualizar(r as unknown as Conferencia);
      if (ok) toast.success(ok);
    } catch (e) { toast.error((e as Error).message); }
  };
  const v = q.data;
  const grupos = useMemo(() => {
    const out: { chave: string; secao: string | null; grupo: string | null; cwp: string | null; linhas: Linha[] }[] = [];
    for (const ln of v?.linhas ?? []) {
      if (filtro !== 'todas' && ln.situacao !== filtro) continue;
      const kk = `${ln.planilha.secao}|${ln.planilha.grupo}|${ln.planilha.cwp}`;
      const ult = out[out.length - 1];
      if (ult && ult.chave === kk) ult.linhas.push(ln);
      else out.push({ chave: kk, secao: ln.planilha.secao, grupo: ln.planilha.grupo, cwp: ln.planilha.cwp, linhas: [ln] });
    }
    return out;
  }, [v, filtro]);
  if (!v) return <><Cabecalho eyebrow="Programação · planilha do cliente" titulo="Abrindo a conferência…" /><LinhasCarregando colunas={1} /></>;
  const p = v.placar;
  const semTipo = v.linhas.filter((l) => l.situacao === 'sem_vinculo' && l.item.valor && !l.tipo && !l.grupo && !l.wbs.valor).length;
  const titulo = p.pronta === v.linhas.length - (p.ignorada ?? 0) - (p.levada ?? 0) && p.pronta
    ? `${v.aba}: ${p.pronta} linhas prontas para levar`
    : `${v.aba}: ${p.pronta} prontas, ${p.a_confirmar} a confirmar e ${p.sem_vinculo} sem vínculo`;
  return (
    <>
      <Cabecalho eyebrow="Programação · planilha do cliente" titulo={titulo}
        acoes={<div className="flex flex-wrap gap-2">
          <Botao variante="secundario" onClick={voltar}><ArrowLeft size={15} /> Planilhas</Botao>
          {planejador && <Botao variante="secundario" onClick={() => void acao(() => api.post(`/programacao-cliente/${id}/revincular`, {}), 'Ligado de novo')}><RefreshCw size={15} /> Ligar de novo</Botao>}
          {planejador && <Botao disabled={!p.pronta} onClick={() => setLevar(true)}><Send size={15} /> Levar à programação</Botao>}
        </div>} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Indicador rotulo="Atividades" valor={<Calculado chave="placar" memoria={() => v.memoria_placar}>{v.linhas.length}</Calculado>}
          detalhe={`${dataBR(v.inicio)} a ${dataBR(v.fim)}`} />
        <Indicador rotulo="Prontas" valor={p.pronta} tom="sucesso" detalhe="vínculos confirmados" />
        <Indicador rotulo="A confirmar" valor={p.a_confirmar} tom="atencao" detalhe="sugestões do Malhet" />
        <Indicador rotulo="Sem vínculo" valor={p.sem_vinculo} tom="perigo" detalhe="falta frente ou item" />
        <Indicador rotulo="Levadas" valor={p.levada} tom="acento" detalhe={v.programacao_id ? <Link href={`/app/programacoes/${v.programacao_id}`} className="text-m-accent">abrir a programação</Link> : '—'} />
      </div>
      {v.avisos.length > 0 && <p className="text-[12.5px] text-m-warning">{v.avisos.join(' · ')}</p>}

      <Painel titulo="Cada linha liga em quê?" subtitulo={`${v.nome_arquivo} · ${v.aba}. Código confirma; nome e descrição só sugerem. O que você conferir fica lembrado para a próxima semana.`}
        acoes={planejador && (
          <div className="flex flex-wrap items-end gap-2">
            {p.a_confirmar > 0 && <Botao variante="secundario" onClick={() => void acao(() => api.post(`/programacao-cliente/${id}/confirmar`, {}), 'Sugestões confirmadas')}><Check size={15} /> Confirmar todas as sugestões</Botao>}
            {semTipo > 0 && (
              <div className="flex items-end gap-2">
                <Selecao rotulo={`Grupo do Catálogo (${semTipo} itens fora dele)`} value={grupoLote} onChange={(e) => setGrupoLote(e.target.value)} className="min-w-[220px]">
                  <option value="">— escolha —</option>
                  {(opcoes.data?.grupos ?? []).map((g) => <option key={g.id} value={g.id}>{g.rotulo}</option>)}
                </Selecao>
                <Botao variante="secundario" disabled={!grupoLote} onClick={() => void acao(() => api.post(`/programacao-cliente/${id}/grupo`, { grupo_id: Number(grupoLote) }), 'Grupo aplicado')}>Aplicar</Botao>
              </div>
            )}
          </div>
        )}>
        <div className="mb-3 flex flex-wrap gap-2">
          {(['todas', 'pronta', 'a_confirmar', 'sem_vinculo', 'ignorada', 'levada'] as const).map((f) => (
            <Chip key={f} ativo={filtro === f} onClick={() => setFiltro(f)}>{f === 'todas' ? `Todas (${v.linhas.length})` : `${SIT[f].rotulo} (${p[f] ?? 0})`}</Chip>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          {grupos.map((g) => (
            <section key={g.chave + g.linhas[0].id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline gap-x-2 text-[12px] font-semibold uppercase tracking-[0.48px] text-m-text-muted">
                {g.secao && <span>{g.secao}</span>}{g.grupo && <span className="text-m-text-secondary">› {g.grupo}</span>}{g.cwp && <span className="normal-case text-m-accent">› CWP {g.cwp}</span>}
              </div>
              {g.linhas.map((ln) => (
                <LinhaConferencia key={ln.id} ln={ln} aberto={aberto === ln.id} alternar={() => setAberto(aberto === ln.id ? null : ln.id)}
                  opcoes={opcoes.data} planejador={planejador}
                  editar={(d) => acao(() => api.put(`/programacao-cliente/${id}/linhas/${ln.id}`, d))}
                  confirmarLinha={() => acao(() => api.post(`/programacao-cliente/${id}/confirmar`, { ids: [ln.id] }))} />
              ))}
            </section>
          ))}
          {!grupos.length && <p className="text-[13px] text-m-text-muted">Nenhuma linha neste filtro.</p>}
        </div>
      </Painel>
      {levar && <Levar id={id} conf={v} fechar={() => setLevar(false)} onLevado={(c) => { atualizar(c); void qc.invalidateQueries({ queryKey: [...k.programacoes] }); }} />}
    </>
  );
}

function Vinculo({ rotulo, texto, sit, tem, motivo }: { rotulo: string; texto: string; sit: Sit; tem: boolean; motivo: string | null }) {
  return (
    <span title={motivo ?? undefined} className="inline-flex max-w-full items-center gap-1 text-[12px]">
      <span className="text-m-text-muted">{rotulo}</span>
      <Pilula tom={tomSit(sit, tem)}>{tem ? <span className="max-w-[220px] truncate">{texto}</span> : 'falta'}</Pilula>
    </span>
  );
}

function LinhaConferencia({ ln, aberto, alternar, opcoes, planejador, editar, confirmarLinha }: {
  ln: Linha; aberto: boolean; alternar: () => void; opcoes?: { areas: Opcao[]; equipes: Opcao[]; grupos: Opcao[] }; planejador: boolean;
  editar: (d: Record<string, unknown>) => Promise<void>; confirmarLinha: () => Promise<void>;
}) {
  const d = ln.planilha;
  const s = SIT[ln.situacao];
  const travada = !!ln.levada_linha_id || !planejador;
  return (
    <div className="rounded-m-md border border-m-stroke-subtle bg-m-surface-raised">
      <button type="button" onClick={alternar} aria-expanded={aberto} className="flex w-full flex-wrap items-start gap-x-3 gap-y-1.5 px-3 py-2.5 text-left">
        <span className="w-12 shrink-0 text-[11.5px] tabular-nums text-m-text-muted">L{ln.linha}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-medium text-m-text-primary">{d.descricao}</span>
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            <Vinculo rotulo="Frente" texto={ln.area.valor?.rotulo ?? ''} sit={ln.area.sit} tem={!!ln.area.valor} motivo={ln.area.motivo} />
            <Vinculo rotulo="PQ" texto={ln.item.valor ? `${ln.item.valor.item} · ${ln.item.valor.descricao}` : ''} sit={ln.item.sit} tem={!!ln.item.valor} motivo={ln.item.motivo} />
            {ln.wbs.valor && <Vinculo rotulo="IWP" texto={ln.wbs.valor.codigo} sit={ln.wbs.sit} tem motivo={ln.wbs.motivo} />}
            <Vinculo rotulo="Equipe" texto={ln.equipe.valor?.rotulo ?? ''} sit={ln.equipe.sit} tem={!!ln.equipe.valor} motivo={ln.equipe.motivo} />
            {d.id_crono && <Vinculo rotulo="Cronograma" texto={ln.crono.valor ?? d.id_crono} sit={ln.crono.sit} tem={!!ln.crono.valor} motivo={ln.crono.motivo} />}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-[12.5px] tabular-nums text-m-text-secondary">{fmt(d.total_previsto)} {d.unidade ?? ''}{d.total_realizado ? ` · R ${fmt(d.total_realizado)}` : ''}</span>
          {ln.lembrada && <Pilula tom="info" ponto={false}>lembrada</Pilula>}
          <Pilula tom={s.tom}>{s.rotulo}</Pilula>
          <ChevronDown size={16} className={`text-m-text-muted transition-transform ${aberto ? 'rotate-180' : ''}`} aria-hidden="true" />
        </span>
      </button>
      {aberto && (
        <div className="grid gap-3 border-t border-m-stroke-subtle px-3 py-3 md:grid-cols-2">
          <div className="flex flex-col gap-1 text-[12.5px] text-m-text-secondary">
            <span><b>Planilha</b> · linha {ln.linha} · {d.natureza === 'O' ? 'Oportunidade' : d.natureza === 'E' ? 'Emergencial' : 'Programada'}</span>
            <span>Local {d.local ?? '—'} · CWA {d.cwa ?? '—'} · ID cronograma {d.id_crono ?? '—'} · ITEM PQ {d.item_pq ?? '—'}</span>
            <span>Encarregado {d.encarregados.join(' / ') || '—'} · Responsável {d.responsavel ?? '—'}</span>
            <span>Dias: {Object.entries(d.previsto).map(([dia, q]) => `${dia.slice(8, 10)}/${dia.slice(5, 7)} ${fmt(q)}${d.realizado[dia] ? ` (R ${fmt(d.realizado[dia])})` : ''}`).join(' · ') || '—'}</span>
            <span>Recursos: {d.recursos.oficiais ?? 0} oficiais, {d.recursos.servente ?? 0} serventes{Object.keys(d.recursos.equipamentos).length ? `, ${Object.entries(d.recursos.equipamentos).map(([n, q]) => `${q} ${n}`).join(', ')}` : ''}</span>
            <span>SSMA: {[d.ssma.tecnico, ...d.ssma.rac, ...d.ssma.pts, ...d.ssma.art].filter(Boolean).join(' · ') || '—'}</span>
            {ln.cpu && <span>CPU: {ln.cpu.composicao ?? '—'} · HH/un {fmt(ln.cpu.hh_por_unidade, 4)} · governa {ln.cpu.governa ?? '—'}
              {ln.capacidade && <> · capacidade <Calculado chave={ln.capacidade.chave} memoria={() => ln.capacidade!}>{ln.capacidade.valor}</Calculado></>}</span>}
            {ln.faltando.length > 0 && <span className="font-semibold text-m-danger">Falta: {ln.faltando.join(', ')}</span>}
            {([['Frente', ln.area], ['Item da PQ', ln.item], ['IWP', ln.wbs], ['Equipe', ln.equipe], ['Cronograma', ln.crono]] as const)
              .map(([r, x]) => x.motivo && <span key={r} className="text-m-text-muted">· {r}: {x.motivo}</span>)}
          </div>
          {!travada ? (
            <Editor ln={ln} opcoes={opcoes} editar={editar} confirmarLinha={confirmarLinha} />
          ) : ln.levada_linha_id ? <p className="text-[12.5px] text-m-text-muted">Já levada à programação: mude por lá.</p> : null}
        </div>
      )}
    </div>
  );
}

function Editor({ ln, opcoes, editar, confirmarLinha }: {
  ln: Linha; opcoes?: { areas: Opcao[]; equipes: Opcao[]; grupos: Opcao[] }; editar: (d: Record<string, unknown>) => Promise<void>; confirmarLinha: () => Promise<void>;
}) {
  const api = useApi();
  const [busca, setBusca] = useState('');
  const [achados, setAchados] = useState<{ item: string; descricao: string; unid: string | null }[]>([]);
  useEffect(() => {
    const t = busca.trim();
    if (t.length < 2) { setAchados([]); return undefined; }
    const h = setTimeout(() => { void api.get<typeof achados>(buscaPq(t)).then(setAchados).catch(() => setAchados([])); }, 250);
    return () => clearTimeout(h);
  }, [busca, api]);
  const temSugestao = [ln.area, ln.item, ln.wbs, ln.equipe].some((x) => x.sit === 'sugerido');
  return (
    <div className="flex flex-col gap-2">
      <Selecao rotulo="Frente" value={ln.area.valor?.id ?? ''} onChange={(e) => void editar({ area_id: e.target.value ? Number(e.target.value) : null })}>
        <option value="">— escolha a frente —</option>
        {ln.area.opcoes.length > 0 && <optgroup label="Sugeridas">{ln.area.opcoes.map((a) => <option key={`s${a.id}`} value={a.id}>{a.rotulo}</option>)}</optgroup>}
        <optgroup label="Todas">{(opcoes?.areas ?? []).map((a) => <option key={a.id} value={a.id}>{a.rotulo}</option>)}</optgroup>
      </Selecao>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.48px] text-m-text-muted">Item da PQ</span>
        {ln.item.opcoes.map((o) => (
          <button key={o.item} type="button" onClick={() => void editar({ item_pq: o.item })}
            className={`rounded-m-md border px-2.5 py-1.5 text-left text-[12.5px] ${ln.item.valor?.item === o.item ? 'border-m-accent bg-m-accent-subtle' : 'border-m-stroke-subtle'}`}>
            <b>{o.item}</b> · {o.descricao} <span className="text-m-text-muted">({o.unidade ?? '—'} · {Math.round(o.parecenca * 100)}% · {o.comuns.join(', ')})</span>
          </button>
        ))}
        <input aria-label="Buscar item da PQ" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar item da PQ (código ou descrição)"
          className="h-9 rounded-m-md border border-m-stroke bg-m-surface-field px-2.5 text-[13px]" />
        {achados.slice(0, 8).map((o) => (
          <button key={o.item} type="button" onClick={() => { setBusca(''); void editar({ item_pq: o.item }); }} className="rounded-m-md px-2 py-1 text-left text-[12.5px] hover:bg-m-surface-active">
            <b>{o.item}</b> · {o.descricao} <span className="text-m-text-muted">({o.unid ?? '—'})</span>
          </button>
        ))}
      </div>
      {ln.item.valor && !ln.tipo && !ln.wbs.valor && (
        <Selecao rotulo="Grupo do Catálogo (o tipo é criado ao levar)" value={ln.grupo?.id ?? ''} onChange={(e) => void editar({ grupo_id: e.target.value ? Number(e.target.value) : null })}>
          <option value="">— escolha o grupo —</option>
          {(opcoes?.grupos ?? []).map((g) => <option key={g.id} value={g.id}>{g.rotulo}</option>)}
        </Selecao>
      )}
      <Selecao rotulo="Equipe" value={ln.equipe.valor?.id ?? ''} onChange={(e) => void editar({ equipe_id: e.target.value ? Number(e.target.value) : null })}>
        <option value="">— sem equipe —</option>
        {ln.equipe.opcoes.length > 0 && <optgroup label="Sugeridas">{ln.equipe.opcoes.map((a) => <option key={`s${a.id}`} value={a.id}>{a.rotulo}</option>)}</optgroup>}
        <optgroup label="Todas">{(opcoes?.equipes ?? []).map((a) => <option key={a.id} value={a.id}>{a.rotulo}</option>)}</optgroup>
      </Selecao>
      <div className="flex flex-wrap gap-2 pt-1">
        {temSugestao && <Botao onClick={() => void confirmarLinha()}><Check size={15} /> Confirmar sugestões</Botao>}
        <Botao variante="secundario" onClick={() => void editar({ ignorar: ln.situacao !== 'ignorada' })}>
          {ln.situacao === 'ignorada' ? 'Voltar a levar' : <><X size={15} /> Não levar</>}
        </Botao>
      </div>
    </div>
  );
}

function Levar({ id, conf, fechar, onLevado }: { id: number; conf: Conferencia; fechar: () => void; onLevado: (c: Conferencia) => void }) {
  const api = useApi();
  const dst = useQuery({ queryKey: ['programacao-cliente', id, 'destinos'], queryFn: () => api.get<Destinos>(`/programacao-cliente/${id}/destinos`) });
  const [escolha, setEscolha] = useState<string>('');
  const [realizado, setRealizado] = useState(true);
  const [atualizar, setAtualizar] = useState(false);
  const [reabrir, setReabrir] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const pid = escolha && escolha !== 'nova' ? Number(escolha) : null;
  const cmp = useQuery({ queryKey: ['programacao-cliente', id, 'comparar', pid], enabled: pid != null,
    queryFn: () => api.get<Comparacao>(`/programacao-cliente/${id}/comparar/${pid}`) });
  const alvo = dst.data?.existentes.find((x) => x.id === pid);
  const emitida = alvo?.status === 'emitida';
  const [prontas] = useState(conf.placar.pronta); // o número de quando abriu (depois de levar, a conferência já mostra 0)
  const ir = async () => {
    setEnviando(true); setErro(null);
    try {
      const r = await api.post<Resultado & { conferencia: Conferencia }>(`/programacao-cliente/${id}/levar`, {
        destino: escolha === 'nova' ? 'nova' : 'existente', programacao_id: pid, trazer_realizado: realizado, atualizar_existentes: atualizar, reabrir,
      });
      setRes(r); onLevado(r.conferencia);
    } catch (e) { setErro(e); } finally { setEnviando(false); }
  };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="levar-titulo" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="flex max-h-[92dvh] w-full max-w-[560px] flex-col gap-4 overflow-y-auto rounded-t-[20px] bg-m-surface p-5 sm:rounded-[20px]">
        <h2 id="levar-titulo" className="text-[18px] font-semibold text-m-text-primary">Para onde levar as {prontas} linhas prontas?</h2>
        {res ? (
          <>
            <p className="text-[14px] text-m-text-secondary">
              <b className="text-m-text-primary">{res.programacao.titulo}</b>: {res.criadas} linha(s) nova(s){res.atualizadas ? `, ${res.atualizadas} atualizada(s)` : ''}
              {res.ja_estavam ? `, ${res.ja_estavam} já estavam (não duplicaram)` : ''}. Realizado: {res.realizado_dias} dia(s) trazido(s)
              {res.realizado_mantido_do_campo ? `, ${res.realizado_mantido_do_campo} dia(s) mantido(s) como o campo lançou` : ''}.
            </p>
            {res.puladas.length > 0 && <p className="text-[12.5px] text-m-warning">Ficaram de fora: {res.puladas.map((x) => `L${x.linha} (${x.motivo})`).join(' · ')}</p>}
            {res.avisos.length > 0 && <ul className="list-disc pl-5 text-[12.5px] text-m-text-muted">{res.avisos.map((a) => <li key={a}>{a}</li>)}</ul>}
            <div className="flex justify-end gap-2">
              <Botao variante="secundario" onClick={fechar}>Fechar</Botao>
              <Link href={`/app/programacoes/${res.programacao.id}`} className="inline-flex h-10 items-center rounded-full bg-m-accent-strong px-4 text-[14px] font-semibold text-m-on-accent">Abrir a programação</Link>
            </div>
          </>
        ) : (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-[13px] text-m-text-secondary">Escolha o destino (é perguntado a cada vez):</legend>
              {dst.isLoading && <LinhasCarregando colunas={1} />}
              {dst.data?.existentes.map((x) => (
                <label key={x.id} className={`flex cursor-pointer items-start gap-2 rounded-m-md border px-3 py-2 text-[13.5px] ${escolha === String(x.id) ? 'border-m-accent bg-m-accent-subtle' : 'border-m-stroke-subtle'}`}>
                  <input type="radio" name="destino" value={x.id} checked={escolha === String(x.id)} onChange={() => { setEscolha(String(x.id)); setReabrir(false); }} className="mt-1" />
                  <span><b>Somar a {x.titulo}</b><span className="block text-[12px] text-m-text-muted">{x.linhas} linhas · {x.status === 'emitida' ? `emitida (rev. ${x.revisao - 1})` : x.status === 'concluida' ? 'concluída — não recebe' : 'rascunho'}</span></span>
                </label>
              ))}
              {dst.data?.nova && (
                <label className={`flex cursor-pointer items-start gap-2 rounded-m-md border px-3 py-2 text-[13.5px] ${escolha === 'nova' ? 'border-m-accent bg-m-accent-subtle' : 'border-m-stroke-subtle'}`}>
                  <input type="radio" name="destino" value="nova" checked={escolha === 'nova'} onChange={() => setEscolha('nova')} className="mt-1" />
                  <span><b>Criar a {dst.data.nova.titulo}</b><span className="block text-[12px] text-m-text-muted">programação nova, em rascunho, só com estas linhas</span></span>
                </label>
              )}
            </fieldset>
            {pid != null && cmp.data && (
              <p className="text-[12.5px] text-m-text-secondary">
                Comparando: {cmp.data.contagem.nova ?? 0} nova(s) · {cmp.data.contagem.ja_existe ?? 0} já existe(m) · {cmp.data.contagem.quantidade_diferente ?? 0} com quantidade diferente · {cmp.data.so_no_malhet} só no Malhet.
              </p>
            )}
            <label className="flex items-start gap-2 text-[13.5px]"><input type="checkbox" checked={realizado} onChange={(e) => setRealizado(e.target.checked)} className="mt-1" />
              <span>Trazer o realizado (linhas R)<span className="block text-[12px] text-m-text-muted">Só nos dias em que o campo ainda não lançou; o que passar do total do projeto fica de fora.</span></span></label>
            {pid != null && <label className="flex items-start gap-2 text-[13.5px]"><input type="checkbox" checked={atualizar} onChange={(e) => setAtualizar(e.target.checked)} className="mt-1" />
              <span>Atualizar as que já existem<span className="block text-[12px] text-m-text-muted">O previsto da planilha substitui o da linha; sem marcar, elas não mudam.</span></span></label>}
            {emitida && <label className="flex items-start gap-2 text-[13.5px]"><input type="checkbox" checked={reabrir} onChange={(e) => setReabrir(e.target.checked)} className="mt-1" />
              <span>Reabrir a programação emitida<span className="block text-[12px] text-m-text-muted">A revisão emitida não muda; as linhas saem na próxima emissão.</span></span></label>}
            <Erro erro={erro} />
            <div className="flex justify-end gap-2">
              <Botao variante="secundario" onClick={fechar}>Cancelar</Botao>
              <Botao disabled={!escolha || enviando || (emitida && !reabrir) || alvo?.status === 'concluida'} onClick={() => void ir()}>
                <Send size={15} /> {enviando ? 'Levando…' : `Levar ${prontas} linha${prontas === 1 ? '' : 's'}`}
              </Botao>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
