'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { STATUS_DESVIO, useCausas } from '@/components/Obra/DesviosProgramacao';
import { Botao, Cabecalho, Campo, Erro, Painel, Pilula, Selecao, Tabela, UploadForm, dataBR, td, tdNum } from '@/components/Obra/ui';
import { useAcao } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';
import { qs } from '@/lib/api/client';
import type { Desvio } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';

interface Form { id: number | null; data: string; causa_id: string; descricao: string; referencia: string; frente: string; acao: string; responsavel: string; gerencia: string; status: string; atividade_impactada: string }
const VAZIO: Form = { id: null, data: '', causa_id: '', descricao: '', referencia: '', frente: '', acao: '', responsavel: '', gerencia: '', status: '1', atividade_impactada: '' };
const TOM = { 1: 'atencao', 2: 'acento', 3: 'sucesso' } as const;

export default function DesviosPage() {
  const api = useApi();
  const confirmar = useConfirmar();
  const { pode } = useObra();
  const causas = useCausas();
  const [filtro, setFiltro] = useState({ de: '', ate: '', causa_id: '' });
  const lista = useQuery({
    queryKey: ['desvios', 'lista', filtro],
    queryFn: () => api.get<Desvio[]>(`/desvios${qs(Object.fromEntries(Object.entries(filtro).filter(([, v]) => v)))}`),
  });
  const chave = [['desvios'], ['indicadores']];
  const importar = useAcao((a, fd: FormData) => a.post<{ importados: number; repetidos: number; causas_novas: number; avisos: string[] }>('/desvios/importar', fd), chave);
  const salvar = useAcao((a, f: Form) => {
    const original = lista.data?.find((x) => x.id === f.id);
    const corpo = { data: f.data, causa_id: Number(f.causa_id), descricao: f.descricao, referencia: f.referencia || null, frente: f.frente || null,
      acao: f.acao || null, responsavel: f.responsavel || null, gerencia: f.gerencia || null, status: Number(f.status), atividade_impactada: f.atividade_impactada || null,
      programacao_id: original?.programacao_id ?? null, linha_id: original?.linha_id ?? null, area_id: original?.area_id ?? null, qtd_nao_cumprida: original?.qtd_nao_cumprida ?? null };
    return f.id ? a.put(`/desvios/${f.id}`, corpo) : a.post('/desvios', corpo);
  }, chave);
  const excluir = useAcao((a, id: number) => a.del(`/desvios/${id}`), chave);
  const novaCausa = useAcao((a, descricao: string) => a.post('/desvios/causas', { descricao }), [['desvios']]);
  const editarCausa = useAcao((a, c: { id: number; descricao: string; ativo: boolean }) => a.put(`/desvios/causas/${c.id}`, c), [['desvios']]);
  const [form, setForm] = useState<Form | null>(null);
  const [causa, setCausa] = useState('');
  const [renomear, setRenomear] = useState<{ id: number; texto: string; ativo: boolean } | null>(null);
  const editar = (d: Desvio) => setForm({ id: d.id, data: d.data, causa_id: String(d.causa_id), descricao: d.descricao, referencia: d.referencia ?? '', frente: d.frente ?? '',
    acao: d.acao ?? '', responsavel: d.responsavel ?? '', gerencia: d.gerencia ?? '', status: String(d.status), atividade_impactada: d.atividade_impactada ?? '' });

  return (
    <>
      <Cabecalho eyebrow="Programar · desvios" titulo={`Desvios (Pareto): ${lista.data?.length ?? 0}`}
        descricao={<>O motivo de cada item não cumprido, no layout do Pareto semanal (Dia · Semana · ID · Classificação · Desvio · Frente · Ação · Responsabilidade · Gerência · Status · Atividade impactada). Os itens das programações são registrados na própria programação, antes de concluir; desvio de programação concluída só muda por revisão. Veja o Pareto em <Link href="/app/indicadores" className="font-semibold text-m-accent underline">Indicadores</Link>.</>}
        acoes={<>
          <Botao variante="secundario" onClick={() => api.download(`/desvios/excel${qs({ de: filtro.de || undefined, ate: filtro.ate || undefined })}`, 'Pareto_desvios.xlsx').catch((e) => toast.error(e.message))}><Download size={16} /> Exportar Pareto</Botao>
          {pode('encarregado') && <Botao onClick={() => setForm({ ...VAZIO, data: new Date().toISOString().slice(0, 10) })}><Plus size={16} /> Novo desvio</Botao>}
        </>} />

      {pode('planejador') && (
        <Painel titulo="Importar o Pareto semanal" subtitulo="Planilha .xlsx com a aba Detalhamento. Reimportar não duplica; classificação que não está na lista entra nela.">
          <UploadForm campos={[{ nome: 'arquivo', rotulo: 'PARETO SEMANAL.xlsx' }]} rotulo="Importar" pendente={importar.isPending}
            onEnviar={(fd) => importar.mutate(fd, {
              onSuccess: (r) => { toast.success(`${r.importados} desvio(s) importado(s)${r.repetidos ? ` · ${r.repetidos} já existiam` : ''}${r.causas_novas ? ` · ${r.causas_novas} causa(s) nova(s)` : ''}`); r.avisos.slice(0, 5).forEach((a) => toast.warning(a)); },
              onError: (e) => toast.error(e.message),
            })} />
        </Painel>
      )}

      {form && (
        <Painel titulo={form.id ? 'Editar desvio' : 'Novo desvio'} acoes={<Botao variante="fantasma" onClick={() => setForm(null)}><X size={16} /> Fechar</Botao>}>
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-6" onSubmit={(e) => { e.preventDefault(); salvar.mutate(form, { onSuccess: () => { toast.success('Desvio salvo'); setForm(null); } }); }}>
            <Campo rotulo="Dia" type="date" required value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            <Selecao rotulo="Classificação" required value={form.causa_id} onChange={(e) => setForm({ ...form, causa_id: e.target.value })} className="md:col-span-2">
              <option value="">Escolha…</option>
              {causas.data?.filter((c) => c.ativo || String(c.id) === form.causa_id).map((c) => <option key={c.id} value={c.id}>{c.descricao}</option>)}
            </Selecao>
            <Campo rotulo="ID (atividade/documento)" value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} />
            <Campo rotulo="Frente de serviço" value={form.frente} onChange={(e) => setForm({ ...form, frente: e.target.value })} className="md:col-span-2" />
            <Campo rotulo="Desvio" required minLength={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="md:col-span-3" />
            <Campo rotulo="Ação" value={form.acao} onChange={(e) => setForm({ ...form, acao: e.target.value })} className="md:col-span-3" />
            <Campo rotulo="Responsabilidade" value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
            <Campo rotulo="Gerência (contratada/cliente)" value={form.gerencia} onChange={(e) => setForm({ ...form, gerencia: e.target.value })} />
            <Selecao rotulo="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS_DESVIO).map(([n, r]) => <option key={n} value={n}>{n} · {r}</option>)}
            </Selecao>
            <Campo rotulo="Atividade impactada" value={form.atividade_impactada} onChange={(e) => setForm({ ...form, atividade_impactada: e.target.value })} className="md:col-span-3" />
            <div className="flex items-end gap-2 md:col-span-3 xl:col-span-6"><Botao type="submit" disabled={salvar.isPending}>Salvar</Botao><Erro erro={salvar.error} /></div>
          </form>
        </Painel>
      )}

      <Painel titulo="Ocorrências" acoes={<div className="flex flex-wrap items-end gap-2">
        <Campo rotulo="De" type="date" value={filtro.de} onChange={(e) => setFiltro({ ...filtro, de: e.target.value })} />
        <Campo rotulo="Até" type="date" value={filtro.ate} onChange={(e) => setFiltro({ ...filtro, ate: e.target.value })} />
        <Selecao rotulo="Classificação" value={filtro.causa_id} onChange={(e) => setFiltro({ ...filtro, causa_id: e.target.value })}>
          <option value="">Todas</option>{causas.data?.map((c) => <option key={c.id} value={c.id}>{c.descricao}</option>)}
        </Selecao>
      </div>}>
        <Tabela cabecalho={['Dia', 'Sem.', 'ID', 'Classificação', 'Desvio', 'Frente', 'Ação', 'Responsabilidade', 'Status', '']} direita={[1]} vazio={!lista.data?.length && (lista.isLoading ? 'Carregando…' : 'Nenhum desvio.')}>
          {lista.data?.map((d) => (
            <tr key={d.id}>
              <td className={td}>{dataBR(d.data)}</td>
              <td className={tdNum}>{d.semana}</td>
              <td className={td}>{d.referencia ?? '—'}{d.programacao_id && <div><Link href={`/app/programacoes/${d.programacao_id}`} className="text-[11px] text-m-accent underline">programação</Link></div>}</td>
              <td className={td}><b className="text-m-text-primary">{d.causa}</b></td>
              <td className={`${td} min-w-[220px]`}>{d.descricao}{d.atividade_impactada && <div className="text-[11px] text-m-text-muted">impacta: {d.atividade_impactada}</div>}</td>
              <td className={td}>{d.frente ?? '—'}</td>
              <td className={`${td} min-w-[180px]`}>{d.acao ?? '—'}</td>
              <td className={td}>{d.responsavel ?? '—'}{d.gerencia && <div className="text-[11px] text-m-text-muted">{d.gerencia}</div>}</td>
              <td className={td}><Pilula tom={TOM[d.status]}>{d.status_nome}</Pilula></td>
              <td className={`${td} whitespace-nowrap`}>
                {pode('encarregado') && <>
                  <button type="button" aria-label="Editar desvio" className="p-1.5 text-m-text-muted hover:text-m-accent" onClick={() => editar(d)}><Pencil size={15} /></button>
                  <button type="button" aria-label="Excluir desvio" className="p-1.5 text-m-text-muted hover:text-m-danger" onClick={async () => (await confirmar({ titulo: 'Excluir este desvio?', mensagem: `${dataBR(d.data)} · ${d.causa} — ${d.descricao}` })) && excluir.mutate(d.id, { onError: (e) => toast.error(e.message) })}><Trash2 size={15} /></button>
                </>}
              </td>
            </tr>
          ))}
        </Tabela>
      </Painel>

      <Painel titulo={`Classificações da obra (${causas.data?.length ?? 0})`} subtitulo="A lista nasce com as causas do Pareto semanal; renomeie, inative ou inclua as da obra.">
        {pode('planejador') && (
          <form className="mb-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); novaCausa.mutate(causa, { onSuccess: () => { setCausa(''); toast.success('Classificação incluída'); }, onError: (er) => toast.error(er.message) }); }}>
            <Campo rotulo="Nova classificação" required minLength={3} value={causa} onChange={(e) => setCausa(e.target.value)} className="w-[360px] max-w-full" />
            <Botao type="submit" disabled={novaCausa.isPending}><Plus size={16} /> Incluir</Botao>
          </form>
        )}
        <ul className="grid gap-1 text-[13px] sm:grid-cols-2 xl:grid-cols-3">
          {causas.data?.map((c) => (
            <li key={c.id} className={`flex items-center justify-between gap-2 rounded-m-md border border-m-stroke-subtle px-2.5 py-1.5 ${c.ativo ? 'text-m-text-primary' : 'text-m-text-tertiary line-through'}`}>
              {renomear?.id === c.id ? (
                <form className="flex flex-1 items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); editarCausa.mutate({ id: c.id, descricao: renomear.texto, ativo: renomear.ativo }, { onSuccess: () => setRenomear(null), onError: (er) => toast.error(er.message) }); }}>
                  <input aria-label="Nome da classificação" autoFocus required minLength={3} value={renomear.texto} onChange={(e) => setRenomear({ ...renomear, texto: e.target.value })}
                    className="h-8 flex-1 rounded-[8px] border border-m-stroke bg-m-surface-field px-2 text-[13px] outline-none focus:border-m-accent" />
                  <button type="submit" className="text-[11.5px] font-semibold text-m-accent underline">salvar</button>
                  <button type="button" aria-label="Cancelar" className="text-m-text-muted" onClick={() => setRenomear(null)}><X size={14} /></button>
                </form>
              ) : <span>{c.numero}. {c.descricao}</span>}
              {pode('planejador') && renomear?.id !== c.id && <span className="flex gap-2 whitespace-nowrap text-[11.5px]">
                <button type="button" className="font-semibold text-m-accent underline" onClick={() => setRenomear({ id: c.id, texto: c.descricao, ativo: c.ativo })}>renomear</button>
                <button type="button" className="font-semibold text-m-text-secondary underline" onClick={() => editarCausa.mutate({ id: c.id, descricao: c.descricao, ativo: !c.ativo })}>{c.ativo ? 'inativar' : 'ativar'}</button>
              </span>}
            </li>
          ))}
        </ul>
      </Painel>
    </>
  );
}
