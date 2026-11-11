'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, History, Plus, Upload, UserMinus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Botao, Cabecalho, Campo, Chip, Erro, Indicador, Painel, Pilula, Selecao, UploadForm, dataBR } from '@/components/Obra/ui';
import { chaves, useEquipes } from '@/hooks/programacao/queries';
import { k, useEfetivo, useMovimentosEfetivo, useResumoEfetivo } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';
import type { Colaborador, SituacaoEfetivo } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';

const SITUACOES: { v: SituacaoEfetivo; rotulo: string; tom: 'sucesso' | 'info' | 'atencao' | 'neutro' | 'perigo' }[] = [
  { v: 'MOBILIZADO', rotulo: 'Mobilizado', tom: 'sucesso' },
  { v: 'AGUARDANDO_CRACHA', rotulo: 'Aguardando crachá', tom: 'info' },
  { v: 'EM_PROCESSO', rotulo: 'Em processo', tom: 'info' },
  { v: 'PREVISTO', rotulo: 'Mobilização prevista', tom: 'info' },
  { v: 'AFASTADO', rotulo: 'Afastado', tom: 'atencao' },
  { v: 'DESMOBILIZADO', rotulo: 'Desmobilizado', tom: 'neutro' },
  { v: 'DESISTENCIA', rotulo: 'Desistência', tom: 'neutro' },
];
const TOM = Object.fromEntries(SITUACOES.map((x) => [x.v, x.tom])) as Record<SituacaoEfetivo, (typeof SITUACOES)[number]['tom']>;
const LIMITE = 300;
type NovaEquipe = { nome: string; encarregado_id: string; turno: string; jornada_horas: string; responsavel: string };

export default function EfetivoPage() {
  const { pode } = useObra();
  const planejar = pode('planejador');
  const api = useApi();
  const qc = useQueryClient();
  const confirmar = useConfirmar();
  const lista = useEfetivo();
  const resumo = useResumoEfetivo();
  const movimentos = useMovimentosEfetivo();
  const equipes = useEquipes();
  const [fSit, setFSit] = useState<Set<SituacaoEfetivo>>(new Set(['MOBILIZADO', 'AGUARDANDO_CRACHA', 'EM_PROCESSO', 'PREVISTO', 'AFASTADO']));
  const [empresa, setEmpresa] = useState('');
  const [q, setQ] = useState('');
  const [soSemEquipe, setSoSemEquipe] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [nova, setNova] = useState<NovaEquipe | null>(null);
  const [destino, setDestino] = useState('');
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const atualizar = () => { qc.invalidateQueries({ queryKey: k.efetivo }); qc.invalidateQueries({ queryKey: chaves.equipes }); qc.invalidateQueries({ queryKey: ['programacao'] }); };

  const todos = lista.data ?? [];
  const empresas = useMemo(() => [...new Set(todos.map((c) => c.empresa))].sort(), [todos]);
  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return todos.filter((c) => (!fSit.size || fSit.has(c.situacao)) && (!empresa || c.empresa === empresa)
      && (!soSemEquipe || !c.equipe_id)
      && (!t || c.nome.toLowerCase().includes(t) || (c.matricula ?? '').includes(t) || (c.funcao ?? '').toLowerCase().includes(t) || (c.equipe ?? '').toLowerCase().includes(t)));
  }, [todos, fSit, empresa, q, soSemEquipe]);
  const selecionados = todos.filter((c) => sel.has(c.id));
  const r = resumo.data;

  const importar = async (fd: FormData) => {
    const arq = fd.get('arquivo');
    if (!(arq instanceof File) || !arq.size) { toast.error('Escolha a planilha de efetivo.'); return; }
    setImportando(true);
    try {
      const x = await api.post<{ novos: number; atualizados: number; fora_do_arquivo: number; sem_matricula: number }>('/efetivo/importar', fd);
      toast.success(`${x.novos} novo(s), ${x.atualizados} atualizado(s), ${x.fora_do_arquivo} fora do arquivo`);
      atualizar();
    } catch (e) { toast.error((e as Error).message); } finally { setImportando(false); }
  };
  const criarEquipe = async () => {
    if (!nova) return;
    try {
      const e = await api.post<{ nome: string; codigo_simova: string }>('/efetivo/equipes', {
        nome: nova.nome, encarregado_id: Number(nova.encarregado_id), colaboradores: [...sel],
        turno: nova.turno, jornada_horas: Number(nova.jornada_horas) || 9, responsavel: nova.responsavel || null,
      });
      toast.success(`Equipe ${e.nome} criada (código Simova ${e.codigo_simova})`);
      setNova(null); setSel(new Set()); setErro(null); atualizar();
    } catch (e) { setErro(e); }
  };
  const mover = async (equipeId: number | null) => {
    const nomeEq = equipes.data?.find((e) => e.id === equipeId)?.nome;
    const ok = await confirmar({
      titulo: equipeId ? `Colocar ${sel.size} pessoa(s) em ${nomeEq}?` : `Tirar ${sel.size} pessoa(s) da equipe?`,
      mensagem: equipeId ? 'Quem estiver em outra equipe sai dela (cada pessoa fica em uma equipe só).' : 'As pessoas continuam no efetivo, sem equipe.',
      acao: equipeId ? 'Mover' : 'Tirar da equipe', perigo: !equipeId,
      executar: () => api.put('/efetivo/equipe', { colaboradores: [...sel], equipe_id: equipeId }),
    });
    if (ok) { toast.success('Equipes atualizadas'); setSel(new Set()); setDestino(''); atualizar(); }
  };
  const [crachaEd, setCrachaEd] = useState<{ id: number; valor: string } | null>(null);
  const salvarCracha = async (c: Colaborador) => {
    if (!crachaEd) return;
    try { await api.put(`/efetivo/colaboradores/${c.id}/cracha`, { cracha: crachaEd.valor }); toast.success('Crachá salvo'); setCrachaEd(null); atualizar(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const marcarTodos = () => setSel(sel.size ? new Set() : new Set(filtrados.slice(0, LIMITE).map((c) => c.id)));

  return (
    <>
      <Cabecalho
        eyebrow="Efetivo · mobilização"
        titulo={r ? `${r.ativos} pessoas no efetivo ativo, ${r.em_mobilizacao} em mobilização` : 'Efetivo da obra'}
        descricao={<>Importe toda semana a planilha de efetivo do DP: a <b>matrícula</b> é a chave, então nomes, funções e situação se atualizam sem perder as equipes. CPF, PIS, endereço, telefone e dados pessoais da planilha <b>não</b> são guardados. {r?.ultima_importacao && <>Última importação: {r.ultima_importacao.arquivo} em {new Date(r.ultima_importacao.em).toLocaleString('pt-BR')}.</>}</>}
        acoes={<Link href="/app/efetivo/organograma"><Botao variante="secundario"><Users size={16} /> Organograma</Botao></Link>}
      />

      {planejar && (
        <Painel titulo={<span className="inline-flex items-center gap-2"><Upload size={18} className="text-m-accent" />Importar a planilha de efetivo</span>}
          subtitulo="Aba principal = efetivo próprio (matrícula 115.011 = crachá 115011 no Simova); demais abas = terceiros, cada uma é uma empresa. Quem não vier no arquivo não é apagado: fica marcado como fora do último arquivo.">
          <UploadForm campos={[{ nome: 'arquivo', rotulo: 'Planilha de efetivo (.xls ou .xlsx)' }]} accept=".xls,.xlsx,.xlsm" rotulo="Importar" pendente={importando} onEnviar={importar} />
        </Painel>
      )}

      {r && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Indicador rotulo="Efetivo ativo" valor={r.ativos} detalhe="mobilizados e afastados" />
          <Indicador rotulo="Em mobilização" valor={r.em_mobilizacao} detalhe="crachá, exame ou previsto" />
          <Indicador rotulo="Ativos sem equipe" valor={r.sem_equipe} detalhe="não entram na programação" />
          <Indicador rotulo="Desmobilizados em equipe" valor={r.desmobilizados_em_equipe.length} detalhe="tire da equipe" />
          <Indicador rotulo="Fora do último arquivo" valor={r.fora_do_ultimo_arquivo} detalhe="confira com o DP" />
          <Indicador rotulo="Funções sem de-para" valor={r.funcoes_sem_depara} detalhe={<Link href="/app/efetivo/funcoes" className="font-semibold text-m-accent">associar</Link>} />
        </div>
      )}
      {!!r?.desmobilizados_em_equipe.length && (
        <p className="rounded-m-md border border-m-warning/40 bg-m-warning-subtle px-4 py-2 text-[13px] text-m-text-primary">
          <b>Desmobilizados ainda em equipe:</b> {r.desmobilizados_em_equipe.slice(0, 12).join(', ')}{r.desmobilizados_em_equipe.length > 12 ? '…' : ''}. Filtre &quot;Desmobilizado&quot; e use &quot;Tirar da equipe&quot;.
        </p>
      )}

      <Painel
        titulo="Quem está na obra e em que equipe?"
        subtitulo={`${filtrados.length} de ${todos.length} pessoas${sel.size ? ` · ${sel.size} selecionada(s)` : ''}`}
        acoes={planejar && <div className="flex flex-wrap items-end gap-2">
          <Botao disabled={!sel.size} onClick={() => setNova({ nome: '', encarregado_id: '', turno: 'Diurno', jornada_horas: '9', responsavel: '' })}><Plus size={16} /> Criar equipe com selecionados</Botao>
          <Selecao rotulo="Mover para" value={destino} onChange={(e) => setDestino(e.target.value)} className="w-[230px]">
            <option value="">Escolha a equipe…</option>
            {equipes.data?.filter((e) => e.ativo).map((e) => <option key={e.id} value={e.id}>{e.codigo_simova ? `${e.codigo_simova} · ` : ''}{e.nome}</option>)}
          </Selecao>
          <Botao variante="secundario" disabled={!sel.size || !destino} onClick={() => mover(Number(destino))}><ArrowRightLeft size={16} /> Mover</Botao>
          <Botao variante="perigo" disabled={!sel.size} onClick={() => mover(null)}><UserMinus size={16} /> Tirar da equipe</Botao>
        </div>}
      >
        {nova && (
          <div className="grid gap-3 rounded-m-lg border border-m-accent/40 bg-m-accent-subtle/40 p-4 md:grid-cols-5">
            <Campo rotulo="Nome da equipe" required placeholder="EQUIPE.22_CONCRETO" value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} />
            <Selecao rotulo="Encarregado" required value={nova.encarregado_id} onChange={(e) => setNova({ ...nova, encarregado_id: e.target.value })}>
              <option value="">Escolha entre os selecionados…</option>
              {selecionados.map((c) => <option key={c.id} value={c.id}>{c.nome} · {c.funcao ?? ''}</option>)}
            </Selecao>
            <Selecao rotulo="Turno" value={nova.turno} onChange={(e) => setNova({ ...nova, turno: e.target.value })}>
              {['Diurno', 'Noturno', 'Administrativo', 'Turno A', 'Turno B', 'Turno C'].map((t) => <option key={t}>{t}</option>)}
            </Selecao>
            <Campo rotulo="Jornada (h/dia)" type="number" step="0.25" value={nova.jornada_horas} onChange={(e) => setNova({ ...nova, jornada_horas: e.target.value })} />
            <Campo rotulo="Responsável" value={nova.responsavel} onChange={(e) => setNova({ ...nova, responsavel: e.target.value })} />
            <div className="flex items-center gap-2 md:col-span-5">
              <Botao disabled={!nova.nome.trim() || !nova.encarregado_id} onClick={criarEquipe}>Criar equipe com {sel.size} pessoa(s)</Botao>
              <Botao variante="secundario" onClick={() => setNova(null)}>Cancelar</Botao>
              <span className="text-[12px] text-m-text-muted">O código Simova é o próximo livre; quem estiver em outra equipe muda para esta.</span>
              {selecionados.some((c) => !c.cracha) && <span className="text-[12px] font-semibold text-m-warning">Sem crachá (defina antes ou tire da seleção): {selecionados.filter((c) => !c.cracha).map((c) => c.nome).join(', ')}</span>}
              <Erro erro={erro} />
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {SITUACOES.map((s) => (
            <Chip key={s.v} ativo={fSit.has(s.v)} onClick={() => setFSit((x) => { const n = new Set(x); if (n.has(s.v)) n.delete(s.v); else n.add(s.v); return n; })}>
              {s.rotulo} · {r?.por_situacao[s.v] ?? 0}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Campo rotulo="Buscar" placeholder="nome, matrícula, função ou equipe" value={q} onChange={(e) => setQ(e.target.value)} className="w-[300px]" />
          <Selecao rotulo="Empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} className="w-[200px]">
            <option value="">Todas</option>
            {empresas.map((e) => <option key={e}>{e}</option>)}
          </Selecao>
          <label className="flex items-center gap-2 pb-2.5 text-[13px] text-m-text-secondary"><input type="checkbox" checked={soSemEquipe} onChange={(e) => setSoSemEquipe(e.target.checked)} /> Só sem equipe</label>
        </div>
        <div className="-mx-1 max-h-[65vh] overflow-auto px-1">
          <table className="w-full border-separate border-spacing-0 text-[13px]">
            <thead className="sticky top-0 z-10 bg-m-surface">
              <tr className="text-left text-[10.5px] font-semibold uppercase tracking-[0.3px] text-m-text-muted">
                <th className="w-8 px-2 py-2">{planejar && <input type="checkbox" aria-label="Selecionar todos os filtrados" checked={!!sel.size} onChange={marcarTodos} />}</th>
                <th className="px-2 py-2">Matrícula · crachá</th><th className="px-2 py-2">Nome</th><th className="px-2 py-2">Função (efetivo → composição)</th>
                <th className="px-2 py-2">Empresa · DP</th><th className="px-2 py-2">Situação</th><th className="px-2 py-2">Equipe</th>
              </tr>
            </thead>
            <tbody>
              {lista.isLoading && <tr><td colSpan={7} className="py-8 text-center text-m-text-muted">Carregando…</td></tr>}
              {!lista.isLoading && !filtrados.length && <tr><td colSpan={7} className="py-8 text-center text-m-text-muted">{todos.length ? 'Ninguém com esses filtros.' : 'Importe a planilha de efetivo.'}</td></tr>}
              {filtrados.slice(0, LIMITE).map((c) => (
                <tr key={c.id} className={`${sel.has(c.id) ? 'bg-m-accent-subtle' : 'hover:bg-m-surface-hover'} ${c.no_ultimo_arquivo ? '' : 'opacity-60'}`}>
                  <td className="border-b border-m-row px-2 py-1.5">{planejar && <input type="checkbox" aria-label={`Selecionar ${c.nome}`} checked={sel.has(c.id)} onChange={() => setSel((x) => { const n = new Set(x); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })} />}</td>
                  <td className="whitespace-nowrap border-b border-m-row px-2 py-1.5 tabular-nums">
                    {c.matricula ?? <span className="text-m-text-muted">sem matrícula</span>}
                    {c.cracha && c.cracha !== c.matricula && <div className="text-[11px] text-m-text-muted">crachá {c.cracha}</div>}
                    {!c.cracha && planejar && (crachaEd?.id === c.id
                      ? <form className="mt-1 flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); salvarCracha(c); }}>
                          <input autoFocus aria-label={`Crachá do Simova de ${c.nome}`} value={crachaEd.valor} onChange={(e) => setCrachaEd({ id: c.id, valor: e.target.value })} onKeyDown={(e) => e.key === 'Escape' && setCrachaEd(null)}
                            className="h-7 w-[90px] rounded-[6px] border border-m-accent bg-m-surface-field px-1.5 text-[12px]" placeholder="crachá" />
                          <button type="submit" className="text-[11px] font-semibold text-m-accent">salvar</button>
                        </form>
                      : <div><button type="button" className="text-[11px] font-semibold text-m-accent underline" onClick={() => setCrachaEd({ id: c.id, valor: '' })}>definir crachá</button></div>)}
                  </td>
                  <td className="border-b border-m-row px-2 py-1.5"><b className="text-m-text-primary">{c.nome}</b>{!c.no_ultimo_arquivo && <div className="text-[11px] text-m-warning">fora do último arquivo</div>}</td>
                  <td className="border-b border-m-row px-2 py-1.5">{c.funcao ?? '—'}<div className="text-[11px] text-m-text-muted">{c.funcao_composicao ? `→ ${c.funcao_composicao}` : 'sem de-para'}</div></td>
                  <td className="border-b border-m-row px-2 py-1.5">{c.empresa}<div className="text-[11px] text-m-text-muted">{[c.dp, c.tipo_mo].filter(Boolean).join(' · ')}</div></td>
                  <td className="whitespace-nowrap border-b border-m-row px-2 py-1.5">
                    <Pilula tom={TOM[c.situacao]}>{c.situacao_rotulo}</Pilula>
                    <div className="mt-0.5 text-[11px] text-m-text-muted">{c.mobilizacao_prevista ? `prevista ${dataBR(c.mobilizacao_prevista)}` : c.status_original && !['V', 'DEM'].includes(c.status_original) ? `planilha: ${c.status_original}` : c.demissao ? `demissão ${dataBR(c.demissao)}` : ''}</div>
                  </td>
                  <td className="border-b border-m-row px-2 py-1.5">
                    {c.encarregado_de ? <><b className="text-m-text-primary">{c.encarregado_de}</b><div className="text-[11px] text-m-text-muted">encarregado</div></>
                      : c.equipe ?? <span className="text-m-text-muted">—</span>}
                    {c.equipe && !['MOBILIZADO', 'AFASTADO'].includes(c.situacao) && <div className="text-[11px] font-semibold text-m-warning">desmobilizado na equipe</div>}
                  </td>
                </tr>
              ))}
              {filtrados.length > LIMITE && <tr><td colSpan={7} className="py-3 text-center text-[12px] text-m-text-muted">Mostrando {LIMITE} de {filtrados.length}: refine a busca.</td></tr>}
            </tbody>
          </table>
        </div>
      </Painel>

      <Painel titulo={<span className="inline-flex items-center gap-2"><History size={18} className="text-m-accent" />O que mudou no efetivo?</span>} subtitulo="Entradas, mudanças de situação e de função vindas da planilha, e movimentações de equipe.">
        <div className="max-h-[320px] overflow-auto text-[13px]">
          {(movimentos.data ?? []).map((m) => (
            <div key={m.id} className="flex flex-wrap gap-x-2 border-b border-m-row py-1.5">
              <span className="w-[130px] shrink-0 text-m-text-muted">{new Date(m.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              <b className="text-m-text-primary">{m.nome}</b>
              <span className="text-m-text-secondary">{({ ENTRADA: 'entrou no efetivo', SITUACAO: 'situação', FUNCAO: 'função', EQUIPE: 'equipe', FORA_DO_ARQUIVO: 'não veio no arquivo' } as Record<string, string>)[m.tipo] ?? m.tipo}</span>
              {(m.de || m.para) && m.tipo !== 'FORA_DO_ARQUIVO' && <span>{m.de ?? '—'} → <b>{m.para ?? 'sem equipe'}</b></span>}
            </div>
          ))}
          {!movimentos.data?.length && <p className="text-m-text-muted">Nada ainda.</p>}
        </div>
      </Painel>
    </>
  );
}
