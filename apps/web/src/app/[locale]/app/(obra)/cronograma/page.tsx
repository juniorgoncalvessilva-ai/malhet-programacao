'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Send, X } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Botao, Cabecalho, Campo, Chip, Erro, Painel, Pilula, Selecao, dataBR, fmt } from '@/components/Obra/ui';
import { useEquipes } from '@/hooks/programacao/queries';
import { k, useAcao, useCatalogo, useFrentes2, useProgramacoes } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';
import type { AtividadeArvore } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';

interface No { nome: string; chave: string; filhos: Map<string, No>; atividades: AtividadeArvore[]; total: number }
const STATUS = ['Todas', 'Não iniciada', 'Em andamento', 'Concluída'] as const;
const LIMITE_LISTA = 400;

function montarArvore(ativ: AtividadeArvore[]): No {
  const raiz: No = { nome: '', chave: '', filhos: new Map(), atividades: [], total: 0 };
  for (const a of ativ) {
    let no = raiz;
    no.total++;
    for (const parte of a.caminho) {
      let f = no.filhos.get(parte);
      if (!f) { f = { nome: parte, chave: `${no.chave}/${parte}`, filhos: new Map(), atividades: [], total: 0 }; no.filhos.set(parte, f); }
      f.total++;
      no = f;
    }
    no.atividades.push(a);
  }
  return raiz;
}
const cwaDe = (a: AtividadeArvore) => a.caminho.join(' ').match(/CWA\s*([0-9]{3}\.[0-9]{2})/i)?.[1] ?? null;
const statusCor = (s: string | null) => (s === 'Concluída' ? 'sucesso' : s === 'Em andamento' ? 'info' : 'neutro') as 'sucesso' | 'info' | 'neutro';

export default function CronogramaPage() {
  const api = useApi();
  const { pode } = useObra();
  const dados = useQuery({ queryKey: ['cronograma-arvore'], queryFn: () => api.get<{ versao: { rotulo: string; carregado_em: string } | null; atividades: AtividadeArvore[] }>('/cronograma/arvore'), staleTime: 60_000 });
  const programacoes = useProgramacoes();
  const frentes = useFrentes2();
  const catalogo = useCatalogo();
  const equipes = useEquipes();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<(typeof STATUS)[number]>('Todas');
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [destino, setDestino] = useState('');
  const [soPeriodo, setSoPeriodo] = useState(false);
  const [envio, setEnvio] = useState<{ grupo_id: string; tipo_id: string; equipe_id: string; natureza: string; usarNome: boolean; areas: Record<string, string>; qtd: Record<string, string> } | null>(null);

  const prog = programacoes.data?.find((p) => String(p.id) === destino);
  const todas = dados.data?.atividades ?? [];
  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return todas.filter((a) => (status === 'Todas' || a.status === status)
      && (!t || a.id_crono.toLowerCase().includes(t) || a.atividade.toLowerCase().includes(t) || a.caminho.some((c) => c.toLowerCase().includes(t)))
      && (!soPeriodo || !prog || ((a.inicio ?? '9999') <= prog.fim && (a.fim ?? '0000') >= prog.inicio)));
  }, [todas, q, status, soPeriodo, prog]);
  const plano = q.trim().length >= 2 || soPeriodo;
  const arvore = useMemo(() => montarArvore(filtradas), [filtradas]);
  const porId = useMemo(() => new Map(todas.map((a) => [a.id_crono, a])), [todas]);
  const areas = frentes.data?.flatMap((l) => l.areas.filter((a) => a.ativo).map((a) => ({ ...a, local: l }))) ?? [];
  const grupo = catalogo.data?.find((g) => String(g.id) === envio?.grupo_id);

  const alternar = (chave: string) => setAbertos((s) => { const n = new Set(s); if (n.has(chave)) n.delete(chave); else n.add(chave); return n; });
  const marcar = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const abrirEnvio = () => {
    const ar: Record<string, string> = {};
    sel.forEach((id) => { const a = porId.get(id); const cwa = a ? cwaDe(a) : null; const m = areas.find((x) => x.cwa === cwa); ar[id] = m ? String(m.id) : ''; });
    setEnvio({ grupo_id: '', tipo_id: '', equipe_id: '', natureza: 'P', usarNome: false, areas: ar, qtd: {} });
  };
  const enviar = useAcao(async (a, _: void) => {
    if (!envio || !prog) return 0;
    let n = 0;
    for (const id of sel) {
      const at = porId.get(id);
      await a.post(`/programacoes/${prog.id}/linhas`, {
        area_id: Number(envio.areas[id]), tipo_id: Number(envio.tipo_id), id_crono: id,
        complemento: envio.usarNome && at ? at.atividade.slice(0, 120) : null,
        equipe_id: envio.equipe_id ? Number(envio.equipe_id) : null, natureza: envio.natureza,
        qtd_periodo: envio.qtd[id] ? Number(envio.qtd[id]) : null,
      });
      n++;
    }
    return n;
  }, [[...k.programacoes], ['programacao'], ['cronograma-arvore']]);
  const faltaArea = envio && [...sel].some((id) => !envio.areas[id]);

  const linhaAtividade = (a: AtividadeArvore, nivel: number, comCaminho = false) => (
    <tr key={a.id_crono} className={`border-b border-m-row ${sel.has(a.id_crono) ? 'bg-m-accent-subtle' : ''}`}>
      <td className="px-2 py-1.5"><input type="checkbox" aria-label={`Selecionar ${a.id_crono}`} checked={sel.has(a.id_crono)} onChange={() => marcar(a.id_crono)} disabled={!pode('encarregado')} /></td>
      <td className="whitespace-nowrap px-2 py-1.5 font-semibold text-m-text-primary">{a.id_crono}</td>
      <td className="px-2 py-1.5" style={{ paddingLeft: comCaminho ? 8 : 8 + nivel * 16 }}>
        {a.atividade}
        {comCaminho && <div className="text-[11px] text-m-text-muted">{a.caminho.slice(-3).join(' › ')}</div>}
      </td>
      <td className="whitespace-nowrap px-2 py-1.5">{dataBR(a.inicio)}</td>
      <td className="whitespace-nowrap px-2 py-1.5">{dataBR(a.fim)}</td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right">{a.duracao_h != null ? fmt(a.duracao_h / 8, 1) : '—'}</td>
      <td className="whitespace-nowrap px-2 py-1.5">{a.status ? <Pilula tom={statusCor(a.status)}>{a.status}</Pilula> : '—'}</td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right">{a.pct != null ? `${fmt(a.pct, 0)}%` : '—'}</td>
      <td className="px-2 py-1.5 text-xs">{a.programada_em.map((p) => <Link key={p.id} href={`/app/programacoes/${p.id}`} className="mr-2 font-semibold text-m-accent">{p.titulo.replace('Programação ', '')}</Link>)}</td>
    </tr>
  );
  const renderNo = (no: No, nivel: number): React.ReactNode => [...no.filhos.values()].map((f) => {
    const aberto = abertos.has(f.chave);
    return (
      <Fragment key={f.chave}>
        <tr className="border-b border-m-stroke-subtle bg-m-surface-active/60">
          <td />
          <td colSpan={8} className="px-2 py-1.5" style={{ paddingLeft: 8 + nivel * 16 }}>
            <button type="button" className="inline-flex items-center gap-1 text-left text-[13px] font-semibold text-m-text-primary" onClick={() => alternar(f.chave)}>
              {aberto ? <ChevronDown size={15} /> : <ChevronRight size={15} />}{f.nome}
              <span className="ml-1 font-normal text-m-text-muted">({f.total})</span>
            </button>
          </td>
        </tr>
        {aberto && <>{renderNo(f, nivel + 1)}{f.atividades.map((a) => linhaAtividade(a, nivel + 1))}</>}
      </Fragment>
    );
  });

  return (
    <>
      <Cabecalho
        eyebrow="Programar · cronograma"
        titulo={dados.data?.versao ? `Cronograma vigente: ${dados.data.versao.rotulo}` : 'Nenhum cronograma importado'}
        descricao={<>Estrutura do P6 (WBS → atividades) com datas, duração (dias de 8 h), status e % físico. Marque as tarefas e envie para a programação da semana ou do mês. {!dados.data?.versao && <Link href="/app/importacoes" className="font-semibold text-m-accent">Importar o .xer</Link>}</>}
      />
      <Painel
        titulo="Quais tarefas entram na programação?"
        subtitulo={`${fmt(filtradas.length, 0)} de ${fmt(todas.length, 0)} atividades${sel.size ? ` · ${sel.size} selecionada(s)` : ''}`}
        acoes={<div className="flex flex-wrap items-end gap-2">
          <Selecao rotulo="Enviar para" value={destino} onChange={(e) => setDestino(e.target.value)} className="min-w-[280px]">
            <option value="">Escolha a programação…</option>
            {programacoes.data?.filter((p) => p.status === 'rascunho').map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
          </Selecao>
          <Botao disabled={!sel.size || !prog || !pode('encarregado')} onClick={abrirEnvio}><Send size={16} /> Enviar {sel.size || ''}</Botao>
        </div>}
      >
        <div className="flex flex-wrap items-end gap-2">
          <Campo rotulo="Buscar" placeholder="ID, atividade, CWA, TAG…" value={q} onChange={(e) => setQ(e.target.value)} className="w-[300px]" />
          <div className="flex flex-wrap gap-1.5">{STATUS.map((s) => <Chip key={s} ativo={status === s} onClick={() => setStatus(s)}>{s}</Chip>)}</div>
          <label className="ml-2 flex items-center gap-2 pb-2 text-[13px] text-m-text-secondary"><input type="checkbox" checked={soPeriodo} disabled={!prog} onChange={(e) => setSoPeriodo(e.target.checked)} /> Só o que acontece no período da programação</label>
          {!plano && <Botao variante="fantasma" onClick={() => setAbertos(abertos.size ? new Set() : new Set([...arvore.filhos.values()].map((f) => f.chave)))}>{abertos.size ? 'Recolher tudo' : 'Abrir 1º nível'}</Botao>}
          {sel.size > 0 && <Botao variante="fantasma" onClick={() => setSel(new Set())}><X size={16} /> Limpar seleção</Botao>}
        </div>

        {envio && prog && (
          <div className="rounded-m-lg border border-m-accent/40 bg-m-accent-subtle/40 p-4">
            <div className="mb-3 text-sm font-semibold text-m-text-primary">Enviar {sel.size} tarefa(s) para {prog.titulo}</div>
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
              <Selecao rotulo="Grupo" required value={envio.grupo_id} onChange={(e) => setEnvio({ ...envio, grupo_id: e.target.value, tipo_id: '' })}>
                <option value="">Escolha…</option>
                {catalogo.data?.filter((g) => g.ativo).map((g) => <option key={g.id} value={g.id}>{g.codigo} · {g.descricao}</option>)}
              </Selecao>
              <Selecao rotulo="Atividade (tipo)" required value={envio.tipo_id} onChange={(e) => setEnvio({ ...envio, tipo_id: e.target.value })}>
                <option value="">{grupo ? 'Escolha…' : 'Escolha o grupo'}</option>
                {grupo?.tipos.filter((t) => t.ativo).map((t) => <option key={t.id} value={t.id}>{t.codigo} · {t.descricao}</option>)}
              </Selecao>
              <Selecao rotulo="Equipe" value={envio.equipe_id} onChange={(e) => setEnvio({ ...envio, equipe_id: e.target.value })}>
                <option value="">—</option>
                {equipes.data?.filter((e) => e.ativo).map((e) => <option key={e.id} value={e.id}>{e.codigo_simova ? `${e.codigo_simova} · ` : ''}{e.nome} · {e.encarregado_nome ?? ''} · {e.turno ?? 'Diurno'}</option>)}
              </Selecao>
              <Selecao rotulo="Natureza" value={envio.natureza} onChange={(e) => setEnvio({ ...envio, natureza: e.target.value })}>
                <option value="P">P · Programada</option><option value="O">O · Oportunidade</option><option value="E">E · Emergencial</option>
              </Selecao>
              <label className="flex items-end gap-2 pb-2.5 text-[13px] text-m-text-secondary"><input type="checkbox" checked={envio.usarNome} onChange={(e) => setEnvio({ ...envio, usarNome: e.target.checked })} /> Nome da tarefa como texto complementar (novo ID Simova)</label>
            </div>
            <table className="mt-3 w-full text-[13px]">
              <thead><tr className="text-[11px] uppercase text-m-text-muted"><th className="px-2 py-1 text-left">Tarefa</th><th className="px-2 py-1 text-left">Área (pelo CWA)</th><th className="px-2 py-1 text-right">Prev. no período</th></tr></thead>
              <tbody>
                {[...sel].map((id) => {
                  const a = porId.get(id);
                  return (
                    <tr key={id} className="border-t border-m-stroke-subtle">
                      <td className="px-2 py-1.5"><b>{id}</b> · {a?.atividade}</td>
                      <td className="px-2 py-1.5">
                        <select aria-label={`Área de ${id}`} value={envio.areas[id] ?? ''} onChange={(e) => setEnvio({ ...envio, areas: { ...envio.areas, [id]: e.target.value } })}
                          className={`h-9 w-full rounded-m-md border bg-m-surface-field px-2 text-[13px] ${envio.areas[id] ? 'border-m-stroke' : 'border-m-warning'}`}>
                          <option value="">{a && cwaDe(a) ? `CWA ${cwaDe(a)} não cadastrado — escolha` : 'Escolha a área…'}</option>
                          {areas.map((x) => <option key={x.id} value={x.id}>{x.codigo} · {x.descricao}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input aria-label={`Previsto no período de ${id}`} type="number" min="0" step="any" value={envio.qtd[id] ?? ''} onChange={(e) => setEnvio({ ...envio, qtd: { ...envio.qtd, [id]: e.target.value } })}
                          className="h-9 w-[100px] rounded-m-md border border-m-stroke bg-m-surface-field px-2 text-right" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-3 flex items-center gap-2">
              <Botao disabled={!envio.tipo_id || !!faltaArea || enviar.isPending} onClick={() => enviar.mutate(undefined, {
                onSuccess: (n) => { toast.success(`${n} tarefa(s) enviada(s) para ${prog.titulo}`); setEnvio(null); setSel(new Set()); },
              })}><Send size={16} /> Confirmar envio</Botao>
              <Botao variante="secundario" onClick={() => setEnvio(null)}>Cancelar</Botao>
              <Link href={`/app/programacoes/${prog.id}`} className="text-sm font-semibold text-m-accent">Abrir a programação</Link>
              <Erro erro={enviar.error} />
            </div>
          </div>
        )}

        <div className="-mx-1 max-h-[70vh] overflow-auto px-1">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10 bg-m-surface">
              <tr className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">
                <th className="w-8 px-2 py-2" />
                <th className="px-2 py-2 text-left">ID</th>
                <th className="px-2 py-2 text-left">Atividade</th>
                <th className="px-2 py-2 text-left">Início</th>
                <th className="px-2 py-2 text-left">Fim</th>
                <th className="px-2 py-2 text-right">Dur. (d)</th>
                <th className="px-2 py-2 text-left">Status</th>
                <th className="px-2 py-2 text-right">% físico</th>
                <th className="px-2 py-2 text-left">Programada em</th>
              </tr>
            </thead>
            <tbody>
              {dados.isLoading && <tr><td colSpan={9} className="py-8 text-center text-m-text-muted">Carregando o cronograma…</td></tr>}
              {plano
                ? filtradas.slice(0, LIMITE_LISTA).map((a) => linhaAtividade(a, 0, true))
                : <>{renderNo(arvore, 0)}{arvore.atividades.map((a) => linhaAtividade(a, 0))}</>}
              {plano && filtradas.length > LIMITE_LISTA && <tr><td colSpan={9} className="py-3 text-center text-xs text-m-text-muted">Mostrando {LIMITE_LISTA} de {fmt(filtradas.length, 0)}: refine a busca.</td></tr>}
              {!dados.isLoading && !filtradas.length && <tr><td colSpan={9} className="py-8 text-center text-m-text-muted">Nenhuma atividade.</td></tr>}
            </tbody>
          </table>
        </div>
      </Painel>
    </>
  );
}
