'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Botao, Cabecalho, Campo, Chip, Erro, Painel, Pilula } from '@/components/Obra/ui';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { chaves } from '@/hooks/programacao/queries';
import { k, useAcao, useFuncoesEfetivo } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';
import { useObra } from '@/lib/obra/ObraProvider';
import { LinhasCarregando } from '@/components/Obra/Esqueleto';

type Edicao = Record<string, { recurso: string; ignorar: boolean }>;

export default function DeParaFuncoesPage() {
  const { pode } = useObra();
  const editar = pode('planejador');
  const dados = useFuncoesEfetivo();
  const api = useApi();
  const qc = useQueryClient();
  const [ed, setEd] = useState<Edicao>({});
  const confirmar = useConfirmar();
  const [nova, setNova] = useState<{ funcao: string; recurso: string } | null>(null);
  const [erroNova, setErroNova] = useState<unknown>(null);
  const criarFuncao = async () => {
    if (!nova) return;
    try {
      const f = await api.post<{ funcao: string }>('/efetivo/funcoes/nova', { funcao: nova.funcao, recurso: nova.recurso || null });
      toast.success(`Função ${f.funcao} criada`); setNova(null); setErroNova(null); setFiltro('todas'); atualizar();
    } catch (e) { setErroNova(e); }
  };
  const [filtro, setFiltro] = useState<'todas' | 'pendentes' | 'definidas'>('pendentes');
  const funcoes = dados.data?.funcoes ?? [];
  const recursos = dados.data?.recursos_cpu ?? [];
  const atualizar = () => { qc.invalidateQueries({ queryKey: k.efetivo }); qc.invalidateQueries({ queryKey: chaves.equipes }); qc.invalidateQueries({ queryKey: ['programacao'] }); };
  const valor = (f: (typeof funcoes)[number]) => ed[f.funcao_chave] ?? { recurso: f.recurso ?? '', ignorar: f.ignorar };
  const visiveis = useMemo(() => funcoes.filter((f) => filtro === 'todas' || (filtro === 'pendentes' ? !f.definido : f.definido)), [funcoes, filtro]);
  const pendentes = funcoes.filter((f) => !f.definido).length;
  const comSugestao = funcoes.filter((f) => !f.definido && f.sugestao).length;

  const salvar = useAcao((a, e: Edicao) => a.put<{ salvos: number }>('/efetivo/funcoes', {
    itens: Object.entries(e).map(([chave, v]) => ({ funcao: funcoes.find((f) => f.funcao_chave === chave)?.funcao ?? chave, recurso: v.recurso || null, ignorar: v.ignorar })),
  }), [[...k.efetivo], [...chaves.equipes], ['programacao']]);
  const sugerir = async () => {
    try { const r = await api.post<{ aplicadas: number }>('/efetivo/funcoes/sugeridas'); toast.success(`${r.aplicadas} sugestão(ões) aplicada(s)`); atualizar(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const n = Object.keys(ed).length;

  return (
    <>
      <Cabecalho
        eyebrow="Efetivo · de-para de funções"
        titulo={pendentes ? `${pendentes} função(ões) do efetivo sem correspondência na composição` : 'Todas as funções associadas'}
        acoes={editar && <div className="flex gap-2">
          <Botao variante="secundario" onClick={() => setNova({ funcao: '', recurso: '' })}><Plus size={16} /> Nova função de contratação</Botao>
          <Botao variante="secundario" disabled={!comSugestao} onClick={sugerir}><Wand2 size={16} /> Aplicar sugestões ({comSugestao})</Botao>
          <Botao disabled={!n || salvar.isPending} onClick={() => salvar.mutate(ed, { onSuccess: (r) => { toast.success(`${r.salvos} função(ões) salvas`); setEd({}); } })}><Save size={16} /> Salvar{n ? ` (${n})` : ''}</Botao>
        </div>}
      />
      <Painel titulo="Qual função da composição corresponde a cada função do efetivo?" subtitulo={`${funcoes.length} funções no efetivo · ${recursos.length} funções de mão de obra na CPU`}>
        <datalist id="recursos-cpu-mod">{recursos.map((r) => <option key={r} value={r} />)}</datalist>
        {nova && (
          <div className="grid gap-3 rounded-m-lg border border-m-accent/40 bg-m-accent-subtle/40 p-4 md:grid-cols-3" aria-label="Nova função de contratação">
            <Campo rotulo="Função de contratação" required placeholder="ex.: MONTADOR DE ANDAIME" value={nova.funcao} onChange={(e) => setNova({ ...nova, funcao: e.target.value })} />
            <Campo rotulo="Função na composição (opcional)" list="recursos-cpu-mod" placeholder="pode ficar para depois" value={nova.recurso} onChange={(e) => setNova({ ...nova, recurso: e.target.value })} />
            <div className="flex items-end gap-2">
              <Botao disabled={nova.funcao.trim().length < 3} onClick={criarFuncao}>Criar função</Botao>
              <Botao variante="secundario" onClick={() => setNova(null)}>Cancelar</Botao>
            </div>
            <p className="text-[12px] text-m-text-muted md:col-span-3">Padroniza o nome usado em vagas, nova aquisição e cadastro do colaborador. O de-para com a CPU pode ser feito depois.</p>
            <div className="md:col-span-3"><Erro erro={erroNova} /></div>
          </div>
        )}
        <div className="flex gap-2">
          {(['pendentes', 'definidas', 'todas'] as const).map((f) => <Chip key={f} ativo={filtro === f} onClick={() => setFiltro(f)}>{f === 'pendentes' ? `Sem de-para · ${pendentes}` : f === 'definidas' ? `Associadas · ${funcoes.length - pendentes}` : 'Todas'}</Chip>)}
        </div>
        <div className="-mx-1 max-h-[68vh] overflow-auto px-1">
          <table className="w-full border-separate border-spacing-0 text-[13px]">
            <thead className="sticky top-0 z-10 bg-m-surface-raised">
              <tr className="text-left text-[10.5px] font-semibold uppercase tracking-[0.3px] text-m-text-muted">
                <th className="px-2 py-2">Função no efetivo</th><th className="px-2 py-2 text-right">Ativos · total</th>
                <th className="px-2 py-2">Função na composição (CPU)</th><th className="px-2 py-2">Ignorar</th><th className="px-2 py-2">Sugestão</th>
              </tr>
            </thead>
            <tbody>
              {!visiveis.length && (dados.isLoading ? <LinhasCarregando colunas={5} /> : <tr><td colSpan={5} className="py-8 text-center text-m-text-muted">{'Nada aqui.'}</td></tr>)}
              {visiveis.map((f) => {
                const v = valor(f);
                const mudou = !!ed[f.funcao_chave];
                return (
                  <tr key={f.funcao_chave} className={mudou ? 'bg-m-accent-subtle/50' : ''}>
                    <td className="border-b border-m-row px-2 py-1.5"><b className="text-m-text-primary">{f.funcao}</b>
                      {f.criada_na_obra && <span className="ml-2 inline-flex items-center gap-1"><Pilula tom="info">criada na obra</Pilula>
                        {editar && !f.total && <button type="button" aria-label={`Excluir a função ${f.funcao}`} className="text-m-text-muted hover:text-m-danger"
                          onClick={async () => { if (await confirmar({ titulo: `Excluir a função ${f.funcao}?`, mensagem: 'Só sai se nenhuma pessoa, vaga ou processo usar a função.', executar: () => api.del(`/efetivo/funcoes/${encodeURIComponent(f.funcao_chave)}`) })) atualizar(); }}><Trash2 size={13} /></button>}</span>}
                    </td>
                    <td className="border-b border-m-row px-2 py-1.5 text-right tabular-nums">{f.ativos} · {f.total}</td>
                    <td className="border-b border-m-row px-2 py-1.5">
                      <input list="recursos-cpu-mod" aria-label={`Função da composição para ${f.funcao}`} disabled={!editar || v.ignorar} value={v.recurso}
                        placeholder={v.ignorar ? 'ignorada' : 'escolha ou digite'}
                        onChange={(e) => setEd({ ...ed, [f.funcao_chave]: { ...v, recurso: e.target.value } })}
                        className={`h-8 w-[280px] rounded-[8px] border bg-m-surface-field px-2 text-[13px] outline-none focus:border-m-accent disabled:opacity-60 ${v.recurso && recursos.length && !recursos.includes(v.recurso) ? 'border-m-warning' : 'border-m-stroke'}`} />
                      {v.recurso && recursos.length > 0 && !recursos.includes(v.recurso) && <div className="text-[11px] text-m-warning">não está na CPU vigente</div>}
                    </td>
                    <td className="border-b border-m-row px-2 py-1.5"><input type="checkbox" aria-label={`Ignorar ${f.funcao}`} disabled={!editar} checked={v.ignorar} onChange={(e) => setEd({ ...ed, [f.funcao_chave]: { recurso: e.target.checked ? '' : v.recurso, ignorar: e.target.checked } })} /></td>
                    <td className="border-b border-m-row px-2 py-1.5">
                      {f.sugestao && f.sugestao !== v.recurso
                        ? <button type="button" disabled={!editar} className="text-[12px] font-semibold text-m-accent underline disabled:no-underline disabled:opacity-60" onClick={() => setEd({ ...ed, [f.funcao_chave]: { recurso: f.sugestao ?? '', ignorar: false } })}>usar {f.sugestao}</button>
                        : f.definido ? <Pilula tom="sucesso">associada</Pilula> : <span className="text-m-text-muted">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Erro erro={salvar.error} />
      </Painel>
    </>
  );
}
