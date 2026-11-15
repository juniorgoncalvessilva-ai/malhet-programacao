'use client';

import { ChevronRight, Search } from 'lucide-react';
import { useState } from 'react';
import { Calculado, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { Botao, CARREGANDO, Chip, Erro, Indicador, Painel, Pilula, Tabela, td, tdNum } from '@/components/Obra/ui';
import { useDetalheErro, useErros, useResolverErro, type GrupoErro, type SituacaoErro } from '@/lib/erros/consultas';

/**
 * Erros relatados (spec 098): o que falhou para as pessoas, agrupado (erros iguais juntos), com de onde partiu, quantas
 * vezes, quantas pessoas e o que elas contaram. Resolver um grupo some da lista; se acontecer de novo, ele "voltou".
 */
const SITUACAO: Record<SituacaoErro, { rotulo: string; tom: 'perigo' | 'atencao' | 'sucesso' }> = {
  aberto: { rotulo: 'Aberto', tom: 'perigo' }, voltou: { rotulo: 'Voltou', tom: 'atencao' }, resolvido: { rotulo: 'Resolvido', tom: 'sucesso' },
};
const ORIGEM: Record<string, string> = { web: 'Computador', campo: 'Celular', nativo: 'App das lojas', api: 'Servidor' };
const TIPO: Record<string, string> = { js: 'Script', promessa: 'Script', tela: 'Tela quebrou', api: 'Chamada à API', servidor: 'Servidor', manual: 'Relato da pessoa' };
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function memoria(chave: string, titulo: string, valor: number, grupos: GrupoErro[], regra: string): MemoriaCalculo {
  return {
    chave, titulo, valor: String(valor), formula: regra,
    passos: [{ descricao: 'Grupos considerados', conta: `${grupos.length} grupos na lista`, resultado: String(valor), destaque: true }],
    fontes: grupos.slice(0, 12).map((g) => ({ dado: g.codigo, valor: `${g.ocorrencias}× · ${SITUACAO[g.situacao].rotulo}`, origem: 'Relatos de erro', local: g.acao || g.local })),
    notas: ['Erros iguais (mesma mensagem e mesma tela/ação) formam um grupo.'],
  };
}

export function PainelErros() {
  const [situacao, setSituacao] = useState('abertos');
  const [origem, setOrigem] = useState('');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const q = useErros({ situacao, origem, busca });
  const r = q.data?.resumo;
  const grupos = q.data?.grupos ?? [];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Indicador rotulo="Grupos em aberto" tom={r?.abertos ? 'perigo' : 'sucesso'}
          valor={r ? <Calculado chave="abertos" memoria={() => memoria('abertos', 'Grupos em aberto', r.abertos, grupos, 'grupos com situação Aberto ou Voltou')}>{r.abertos}</Calculado> : '—'}
          detalhe="abertos e que voltaram" />
        <Indicador rotulo="Últimas 24 horas"
          valor={r ? <Calculado chave="24h" memoria={() => memoria('24h', 'Grupos com erro nas últimas 24 h', r.ultimas_24h, grupos, 'grupos cujo último erro foi há menos de 24 h')}>{r.ultimas_24h}</Calculado> : '—'}
          detalhe="grupos com erro recente" />
        <Indicador rotulo="Grupos no filtro" valor={r ? r.grupos : '—'} detalhe="de todas as situações" />
      </div>
      <Painel titulo="O que está falhando para as pessoas?" subtitulo="Erros iguais aparecem juntos. Clique para ver cada ocorrência, a pilha e o que a pessoa contou."
        acoes={
          <label className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-m-text-muted" aria-hidden="true" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Código, tela, mensagem…" aria-label="Buscar erros"
              className="h-9 w-56 rounded-full border border-m-stroke bg-m-surface-field pl-8 pr-3 text-[13px]" />
          </label>
        }>
        <div className="mb-4 flex flex-wrap gap-2">
          {[['abertos', 'Em aberto'], ['resolvidos', 'Resolvidos'], ['todos', 'Todos']].map(([v, t]) => <Chip key={v} ativo={situacao === v} onClick={() => setSituacao(v)}>{t}</Chip>)}
          <span className="mx-1 w-px bg-m-stroke-subtle" aria-hidden="true" />
          {[['', 'Toda origem'], ...Object.entries(ORIGEM)].map(([v, t]) => <Chip key={v || 'todas'} ativo={origem === v} onClick={() => setOrigem(v)}>{t}</Chip>)}
        </div>
        <Erro erro={q.error} />
        <Tabela cabecalho={['Situação', 'Erro', 'De onde partiu', 'Vezes', 'Pessoas', 'Último', '']} direita={[3, 4]}
          vazio={q.isLoading ? CARREGANDO : grupos.length ? false : situacao === 'abertos' ? 'Nenhum erro em aberto.' : 'Nada encontrado.'}>
          {grupos.map((g) => (
            <tr key={g.grupo} className="cursor-pointer hover:bg-m-surface-hover" onClick={() => setAberto(aberto === g.grupo ? null : g.grupo)}>
              <td className={td}><Pilula tom={SITUACAO[g.situacao].tom}>{SITUACAO[g.situacao].rotulo}</Pilula></td>
              <td className={`${td} max-w-[420px]`}>
                <span className="line-clamp-2 font-medium text-m-text-primary">{g.mensagem}</span>
                <span className="text-[11.5px] text-m-text-muted">{g.codigo} · {TIPO[g.tipo] ?? g.tipo} · {ORIGEM[g.origem] ?? g.origem}{g.comentarios ? ` · ${g.comentarios} relato(s) da pessoa` : ''}</span>
              </td>
              <td className={`${td} font-mono text-[12px]`}>{g.acao || g.local}</td>
              <td className={tdNum}>{g.ocorrencias}</td>
              <td className={tdNum}>{g.pessoas}</td>
              <td className={`${td} whitespace-nowrap`}>{quando(g.ultimo)}</td>
              <td className={td}><ChevronRight size={16} className={`text-m-text-muted transition-transform ${aberto === g.grupo ? 'rotate-90' : ''}`} aria-hidden="true" /></td>
            </tr>
          ))}
        </Tabela>
      </Painel>
      {aberto && <DetalheGrupo grupo={aberto} onFechar={() => setAberto(null)} />}
    </>
  );
}

function DetalheGrupo({ grupo, onFechar }: { grupo: string; onFechar: () => void }) {
  const d = useDetalheErro(grupo);
  const resolver = useResolverErro();
  const [nota, setNota] = useState('');
  const x = d.data;
  const ultimo = x?.ocorrencias[0];
  return (
    <Painel titulo={ultimo ? `Por que "${ultimo.mensagem.slice(0, 80)}${ultimo.mensagem.length > 80 ? '…' : ''}" acontece?` : 'Detalhe do erro'}
      subtitulo={x ? `${x.ocorrencias.length} ocorrência(s) mais recentes${x.resolvido_por ? ` · resolvido por ${x.resolvido_por}${x.nota ? `: ${x.nota}` : ''}` : ''}` : undefined}
      acoes={<Botao variante="secundario" onClick={onFechar}>Fechar</Botao>}>
      <Erro erro={d.error ?? resolver.error} />
      {x && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-2">
            {x.situacao === 'resolvido'
              ? <Botao variante="secundario" disabled={resolver.isPending} onClick={() => resolver.mutate({ grupo, resolver: false })}>Reabrir</Botao>
              : <>
                  <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="O que foi feito (opcional)" maxLength={500}
                    className="h-10 min-w-[260px] flex-1 rounded-m-md border border-m-stroke bg-m-surface-field px-3 text-[13px]" />
                  <Botao disabled={resolver.isPending} onClick={() => resolver.mutate({ grupo, resolver: true, nota })}>Marcar resolvido</Botao>
                </>}
          </div>
          <ol className="flex flex-col gap-3">
            {x.ocorrencias.map((o) => (
              <li key={o.codigo + o.ocorrido_em} className="rounded-m-md border border-m-stroke-subtle p-3 text-[13px]">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-m-text-secondary">
                  <b className="text-m-text-primary">{o.codigo}</b>
                  <span>{new Date(o.ocorrido_em).toLocaleString('pt-BR')}</span>
                  <span>{ORIGEM[o.origem] ?? o.origem}{o.navegador ? ` · ${o.navegador}` : ''}</span>
                  {o.obra && <span>Obra {o.obra}</span>}
                  <span>{o.usuario ?? 'sem conta (antes do login)'}</span>
                  {o.versao && <span>versão {o.versao.slice(0, 10)}</span>}
                  {o.status && <span>HTTP {o.status}</span>}
                </div>
                <div className="mt-1 font-mono text-[12px] text-m-text-tertiary">{o.acao || o.local}</div>
                {o.comentario && <p className="mt-2 rounded-m-sm bg-m-accent-subtle px-3 py-2 text-m-text-primary">“{o.comentario}”</p>}
                {o.pilha && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[12px] font-semibold text-m-text-muted">Pilha</summary>
                    <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-m-sm bg-m-surface-base p-2 text-[11px] leading-4">{o.pilha}</pre>
                  </details>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Painel>
  );
}
