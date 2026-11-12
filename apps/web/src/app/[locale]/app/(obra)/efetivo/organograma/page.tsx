'use client';

import { Eye, Palette, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BuscaEfetivo } from '@/components/Obra/BuscaEfetivo';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { MultiSelecao } from '@/components/Obra/MultiSelecao';
import { OrganogramaArvore, chavePessoa, type EdicaoOrganograma, type PessoaRef } from '@/components/Obra/OrganogramaArvore';
import { Botao, Cabecalho, Campo, Indicador, Painel } from '@/components/Obra/ui';
import { useEfetivo, useOrganograma } from '@/hooks/programacao/planejamento';
import { useEquipes } from '@/hooks/programacao/queries';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';
import { useObra } from '@/lib/obra/ObraProvider';
import type { NoOrganograma } from '@/lib/api/types';
import { filtrarOrganograma, opcoesDoOrganograma, type FiltroOrganograma, FILTRO_VAZIO } from '@/lib/efetivo/visibilidade';

const contar = (n: NoOrganograma | null | undefined, titulo: string): number =>
  !n ? 0 : (n.titulo === titulo ? n.qtd : 0) + n.filhos.reduce((s, f) => s + contar(f, titulo), 0);

export default function OrganogramaPage() {
  const [busca, setBusca] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => { const t = setTimeout(() => setQ(busca.trim()), 300); return () => clearTimeout(t); }, [busca]);
  const [vista, setVista] = useState<'setor' | 'frente'>(() => {
    try { return localStorage.getItem('malhet.organograma.vista') === 'frente' ? 'frente' : 'setor'; } catch { return 'setor'; }
  });
  const trocar = (v: 'setor' | 'frente') => { setVista(v); try { localStorage.setItem('malhet.organograma.vista', v); } catch { /* sem armazenamento */ } };
  const org = useOrganograma(q, vista);
  const api = useApi();
  const confirmar = useConfirmar();
  const { pode } = useObra();
  const equipes = useEquipes();
  const efetivo = useEfetivo();
  const [editar, setEditar] = useState(false);
  const [sel, setSel] = useState<Map<string, PessoaRef>>(new Map());
  const [eqSel, setEqSel] = useState<Set<number>>(new Set());
  const [destino, setDestino] = useState('');
  const [filtro, setFiltro] = useState<FiltroOrganograma>(FILTRO_VAZIO);
  const [verFiltros, setVerFiltros] = useState(false);
  const nomeEquipe = (id: number) => equipes.data?.find((e) => e.id === id)?.nome ?? 'a equipe';

  const mover = async (itens: PessoaRef[], para: number | null) => {
    if (!itens.length) return;
    if (para === null && !(await confirmar({
      titulo: `Tirar ${itens.length === 1 ? itens[0].nome : `${itens.length} pessoas`} da equipe?`,
      mensagem: 'Continuam no efetivo (ficam em "Sem equipe" se não estiverem em outra).',
    }))) return;
    try {
      const r = await api.post<{ feitos: number; erros: string[] }>('/equipes/membros/lote', {
        itens: itens.map((i) => ({ cracha: i.cracha, de_equipe_id: i.de })), para_equipe_id: para,
      });
      if (r.feitos) toast.success(para === null ? `${r.feitos} pessoa(s) fora da equipe` : `${r.feitos} pessoa(s) em ${nomeEquipe(para)}`);
      r.erros.slice(0, 4).forEach((x) => toast.warning(x));
      setSel(new Map());
    } catch (e) { toast.error((e as Error).message); }
  };
  const lideranca = async (papel: 'responsavel' | 'supervisor', colaborador_id: number | null, nome?: string) => {
    try {
      await api.put('/equipes/lideranca/definir', { equipes: [...eqSel], papel, colaborador_id });
      toast.success(colaborador_id ? `${nome} é ${papel === 'responsavel' ? 'responsável' : 'supervisor'} de ${eqSel.size} equipe(s)` : `Supervisor tirado de ${eqSel.size} equipe(s)`);
      setEqSel(new Set());
    } catch (e) { toast.error((e as Error).message); }
  };
  const edicao: EdicaoOrganograma | undefined = editar && pode('planejador') ? {
    equipes: (equipes.data ?? []).filter((e) => e.ativo).map((e) => ({ id: e.id, nome: e.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })),
    efetivo: efetivo.data ?? [],
    selecionadas: sel,
    alternar: (ps, marcar) => setSel((m) => {
      const n = new Map(m);
      for (const p of ps) { const k = chavePessoa(p); if (marcar ?? !n.has(k)) n.set(k, p); else n.delete(k); }
      return n;
    }),
    mover,
    equipesSel: eqSel,
    alternarEquipe: (id) => setEqSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
  } : undefined;

  const bruta = org.data?.raiz ?? null;
  const opcoes = useMemo(() => opcoesDoOrganograma(bruta), [bruta]);
  const raiz = useMemo(() => (bruta ? filtrarOrganograma(bruta, filtro) : null), [bruta, filtro]);
  const nFiltros = Object.values(filtro.por).reduce((s, v) => s + v.length, 0) + filtro.ocultar.length + (filtro.semRamosSoltos ? 1 : 0);
  const setores = raiz?.filhos.filter((f) => !['Sem equipe', 'Em mobilização', 'Sem setor'].includes(f.titulo)).length ?? 0;
  const frentes = new Set<string>();
  const juntar = (n?: NoOrganograma | null) => { if (!n) return; if (n.tipo === 'frente' && n.titulo !== 'Sem frente') frentes.add(n.titulo); n.filhos.forEach(juntar); };
  juntar(raiz);
  const POR: { k: keyof FiltroOrganograma['por']; rotulo: string; so?: 'setor' | 'frente' }[] = [
    { k: 'setor', rotulo: 'Setores' }, { k: 'responsavel', rotulo: 'Responsáveis (engenheiros)' }, { k: 'supervisor', rotulo: 'Supervisores (líderes)' },
    { k: 'disciplina', rotulo: 'Disciplinas', so: 'setor' }, { k: 'frente', rotulo: 'Frentes de serviço', so: 'frente' }, { k: 'area', rotulo: 'Áreas', so: 'frente' },
    { k: 'equipe', rotulo: 'Equipes' }, { k: 'encarregado', rotulo: 'Encarregados' }, { k: 'funcao', rotulo: 'Funções' },
  ];
  const NIVEIS_OCULTAVEIS: { t: FiltroOrganograma['ocultar'][number]; rotulo: string }[] = [
    { t: 'responsavel', rotulo: 'Responsáveis' }, { t: 'supervisor', rotulo: 'Supervisores' }, { t: 'disciplina', rotulo: 'Disciplinas' },
    { t: 'frente', rotulo: 'Frentes' }, { t: 'area', rotulo: 'Áreas' }, { t: 'funcao', rotulo: 'Funções (pessoas direto na equipe)' },
  ];

  return (
    <>
      <Cabecalho eyebrow="Efetivo · organograma" titulo="Organograma da obra" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador rotulo="Efetivo no organograma" valor={raiz?.qtd ?? org.data?.total ?? '—'} detalhe={nFiltros ? 'com os filtros de visibilidade' : undefined} />
        <Indicador rotulo={vista === 'frente' ? 'Frentes de trabalho' : 'Setores'} valor={vista === 'frente' ? frentes.size : setores} />
        <Indicador rotulo="Sem equipe" valor={contar(raiz, 'Sem equipe')} />
        <Indicador rotulo="Em mobilização" valor={contar(raiz, 'Em mobilização')} />
      </div>
      <Painel titulo="Quem responde a quem?">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1 rounded-full border border-m-stroke bg-m-surface-raised p-0.5" role="group" aria-label="Organizar o organograma">
            {([['setor', 'Por setor'], ['frente', 'Por frente de trabalho']] as const).map(([v, r]) => (
              <button key={v} type="button" aria-pressed={vista === v} onClick={() => trocar(v)}
                className={`h-9 rounded-full px-4 text-[13px] font-semibold ${vista === v ? 'bg-m-accent text-white' : 'text-m-text-secondary hover:bg-m-surface-hover'}`}>{r}</button>
            ))}
          </div>
          <Campo rotulo="Buscar no organograma" placeholder="Setor, supervisor, equipe, função, nome ou matrícula" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-md" />
          <Botao variante="secundario" onClick={() => setVerFiltros((v) => !v)}><Eye size={16} /> Visibilidade{nFiltros ? ` (${nFiltros})` : ''}</Botao>
          {pode('planejador') && <label className="flex items-center gap-2 pb-2.5 text-[13px] font-medium text-m-text-secondary">
            <input type="checkbox" checked={editar} onChange={(e) => { setEditar(e.target.checked); setSel(new Map()); setEqSel(new Set()); }} /> Editar equipes (arrastar, mover, incluir e tirar)
          </label>}
        </div>

        {verFiltros && (
          <div className="flex flex-col gap-3 rounded-m-md border border-m-stroke-subtle bg-m-surface-base p-3">
            <div className="flex flex-wrap items-end gap-3">
              {POR.filter((x) => !x.so || x.so === vista).filter((x) => opcoes[x.k].length).map((x) => (
                <div key={x.k} className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">{x.rotulo}</span>
                  <MultiSelecao rotulo={x.rotulo} largura="w-[220px]" comNa={false} valor={filtro.por[x.k]}
                    opcoes={opcoes[x.k].map((o) => ({ valor: o, rotulo: o }))} onChange={(v) => setFiltro({ ...filtro, por: { ...filtro.por, [x.k]: v } })} />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-m-text-secondary">
              <span className="font-semibold text-m-text-primary">Esconder níveis:</span>
              {NIVEIS_OCULTAVEIS.filter((x) => vista === 'frente' ? x.t !== 'disciplina' : !['frente', 'area'].includes(x.t)).map((x) => (
                <label key={x.t} className="inline-flex items-center gap-1.5"><input type="checkbox" checked={filtro.ocultar.includes(x.t)}
                  onChange={(e) => setFiltro({ ...filtro, ocultar: e.target.checked ? [...filtro.ocultar, x.t] : filtro.ocultar.filter((y) => y !== x.t) })} />{x.rotulo}</label>
              ))}
              <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={filtro.semRamosSoltos} onChange={(e) => setFiltro({ ...filtro, semRamosSoltos: e.target.checked })} />Esconder &quot;Sem equipe&quot; e &quot;Em mobilização&quot;</label>
              {nFiltros > 0 && <button type="button" className="inline-flex items-center gap-1 font-semibold text-m-accent" onClick={() => setFiltro(FILTRO_VAZIO)}><X size={14} /> limpar</button>}
            </div>
          </div>
        )}

        {edicao && (sel.size > 0 || eqSel.size > 0) && (
          <div className="sticky top-2 z-20 flex flex-col gap-2 rounded-m-md border border-m-accent bg-m-accent-subtle p-3 text-[13px]">
            {sel.size > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <b className="text-m-text-primary">{sel.size} pessoa(s) selecionada(s)</b>
                <select aria-label="Mover as selecionadas para" value={destino} onChange={(e) => setDestino(e.target.value)} className="h-8 rounded-full border border-m-stroke bg-m-surface-field px-3">
                  <option value="">mover para a equipe…</option>{edicao.equipes.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
                <Botao disabled={!destino} onClick={() => { mover([...sel.values()], Number(destino)); setDestino(''); }}>Mover</Botao>
                <Botao variante="secundario" onClick={() => mover([...sel.values()].filter((p) => p.de != null), null)}>Tirar das equipes</Botao>
                <button type="button" className="font-semibold text-m-text-muted underline" onClick={() => setSel(new Map())}>limpar seleção</button>
                <span className="text-[12px] text-m-text-muted">ou arraste uma delas para o cartão da equipe</span>
              </div>
            )}
            {eqSel.size > 0 && (
              <div className="flex flex-wrap items-end gap-3">
                <b className="pb-2 text-m-text-primary">{eqSel.size} equipe(s) selecionada(s)</b>
                <BuscaEfetivo rotulo="Definir responsável (efetivo)" className="w-[280px]" pessoas={efetivo.data ?? []} onEscolher={(x) => lideranca('responsavel', x.id, x.nome)} />
                <BuscaEfetivo rotulo="Definir supervisor / líder intermediário" className="w-[300px]" pessoas={efetivo.data ?? []} onEscolher={(x) => lideranca('supervisor', x.id, x.nome)} />
                <Botao variante="secundario" onClick={() => lideranca('supervisor', null)}>Tirar supervisor</Botao>
                <button type="button" className="pb-2 font-semibold text-m-text-muted underline" onClick={() => setEqSel(new Set())}>limpar</button>
              </div>
            )}
          </div>
        )}

        {vista === 'frente' && <p className="text-[12.5px] text-m-text-muted">Gerente → dono do setor → responsável → supervisor → frente de trabalho → área → equipes. A frente da equipe vem do cadastro em <Link href="/app/equipes" className="font-semibold text-m-accent underline">Equipes</Link>; sem ela, da área onde a equipe está na programação mais recente.</p>}
        {org.isLoading && <p className="text-sm text-m-text-muted">Carregando…</p>}
        {!org.isLoading && !raiz && <p className="text-sm text-m-text-muted">Ninguém no organograma para essa busca ou visibilidade.</p>}
        {raiz && <OrganogramaArvore key={vista} chaveBusca={`${q}|${JSON.stringify(filtro)}`} edicao={edicao} porFrente={vista === 'frente'} raiz={raiz} ariaLabel="Organograma da obra" expandirTudo={!!q} cores={org.data?.cores}
          acoes={<Link href="/app/efetivo/setores" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-m-stroke bg-m-surface-raised px-3 text-[12.5px] font-medium text-m-text-primary hover:bg-m-surface-hover"><Palette size={14} /> Setores e cores</Link>} />}
      </Painel>
    </>
  );
}
