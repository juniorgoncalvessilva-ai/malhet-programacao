'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BuscaEfetivo } from '@/components/Obra/BuscaEfetivo';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Carregando } from '@/components/Obra/Esqueleto';
import { Botao, Cabecalho, Campo, Painel, Pilula } from '@/components/Obra/ui';
import { useEfetivo } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';
import { type PapelParte, type ResponsavelObra, usePartes } from '@/lib/partes';

interface Previa {
  gerencias: { de: string; para: string; registros: number; onde: string[] }[];
  responsaveis: { nome: string; registros: number; gerencia: string | null; papel: PapelParte | null; sugestao_id: number | null }[];
}

const DICA: Record<PapelParte, string> = {
  contratada: 'Quem executa a obra (ex.: CARDAN). Os responsáveis vêm do efetivo.',
  contratante: 'O cliente (ex.: VALE).',
  fiscalizacao: 'A gerenciadora / fiscalização (ex.: TRACTEBEL).',
  projetos: 'A empresa responsável pelos projetos (ex.: WORLEY).',
};

/**
 * Partes e responsáveis (spec 139): as quatro gerências da obra com o nome da empresa e quem responde por cada uma. É daqui que
 * saem as listas de Gerência e Responsável dos desvios, das restrições (6WLA) e do plano — tudo escrito igual, gráfico sem
 * "Cardan", "CARDAN" e "cardan " separados.
 */
export default function PartesPage() {
  const api = useApi();
  const qc = useQueryClient();
  const confirmar = useConfirmar();
  const { pode } = useObra();
  const editar = pode('planejador');
  const q = usePartes();
  const efetivo = useEfetivo();
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [novo, setNovo] = useState<Record<string, { nome: string; funcao: string }>>({});
  useEffect(() => { setNomes(Object.fromEntries((q.data?.partes ?? []).map((p) => [p.papel, p.nome ?? '']))); }, [q.data?.partes]);
  const prev = useQuery({ queryKey: ['partes', 'padronizar'], queryFn: () => api.get<Previa>('/partes/padronizar') });
  const [papelDe, setPapelDe] = useState<Record<string, PapelParte>>({});
  const [alvo, setAlvo] = useState<Record<string, string>>({});
  const atualizar = () => qc.invalidateQueries({ queryKey: ['partes'] });
  const pedir = async (p: Promise<unknown>, ok: string) => { try { await p; toast.success(ok); atualizar(); } catch (e) { toast.error((e as Error).message); } };
  if (!q.data) return <Carregando />;
  const resp = q.data.responsaveis;
  const total = resp.filter((r) => r.ativo).length;
  const semNome = q.data.partes.filter((p) => !p.nome).length;

  const linha = (r: ResponsavelObra) => (
    <li key={r.id} className="flex items-center gap-2 border-b border-m-row py-1.5 text-[13px] last:border-0">
      <span className="min-w-0 flex-1"><b className={r.ativo ? 'text-m-text-primary' : 'text-m-text-muted line-through'}>{r.nome}</b>
        {r.funcao && <span className="ml-1.5 text-[12px] text-m-text-muted">{r.funcao}</span>}
        {r.colaborador_id && <span className="ml-1.5"><Pilula tom="info" ponto={false}>efetivo</Pilula></span>}</span>
      {editar && <>
        <button type="button" className="text-[12px] font-semibold text-m-accent" onClick={() => pedir(api.put(`/partes/responsaveis/${r.id}`, { nome: r.nome, funcao: r.funcao, ativo: !r.ativo }), r.ativo ? 'Inativado (sai das listas)' : 'Reativado')}>{r.ativo ? 'inativar' : 'reativar'}</button>
        <button type="button" aria-label={`Excluir ${r.nome}`} className="p-1 text-m-text-muted hover:text-m-danger" onClick={async () => (await confirmar({ titulo: `Excluir ${r.nome}?`, mensagem: 'O que já foi registrado com este nome continua como está; ele só sai das listas.' })) && pedir(api.del(`/partes/responsaveis/${r.id}`), 'Excluído')}><Trash2 size={14} /></button>
      </>}
    </li>
  );

  return (
    <>
      <Cabecalho eyebrow="Configurar · partes e responsáveis" titulo={`${total} responsáveis em ${q.data.partes.length - semNome} de 4 gerências`} />
      <Painel titulo="Quem é cada parte da obra?" subtitulo="A gerência de desvios, restrições e ações é sempre uma destas, escrita igual em todo lugar: CONTRATADA - NOME, CONTRATANTE - NOME, FISCALIZAÇÃO - NOME, PROJETOS - NOME.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {q.data.partes.map((p) => (
            <div key={p.papel} className="flex flex-col gap-2 rounded-m-lg border border-m-stroke-subtle p-4">
              <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.48px] text-m-text-muted"><Building2 size={14} className="text-m-accent" /> {p.rotulo}</span>
              <Campo rotulo="Nome da empresa" value={nomes[p.papel] ?? ''} disabled={!editar} onChange={(e) => setNomes({ ...nomes, [p.papel]: e.target.value })} placeholder={p.papel === 'contratada' ? 'CARDAN' : p.papel === 'contratante' ? 'VALE' : p.papel === 'fiscalizacao' ? 'TRACTEBEL' : 'WORLEY'} />
              <span className="text-[11.5px] text-m-text-muted">{DICA[p.papel]}{p.da_marca ? ' · veio da Marca da obra' : ''}</span>
              <span className="font-mono text-[12px] text-m-text-secondary">{p.gerencia}</span>
              {editar && (nomes[p.papel] ?? '') !== (p.nome ?? '') && <Botao className="h-8 w-fit px-3" onClick={() => pedir(api.put(`/partes/${p.papel}`, { nome: nomes[p.papel] || null }), `${p.rotulo} salva`)}><Save size={14} /> Salvar</Botao>}
            </div>
          ))}
        </div>
      </Painel>
      {editar && prev.data && (prev.data.gerencias.length > 0 || prev.data.responsaveis.length > 0) && (
        <Painel titulo="O que já foi registrado à mão?" subtitulo="Desvios e restrições anteriores com a gerência ou o responsável escritos livremente. Padronize as gerências que casam com uma parte e associe cada nome antigo a quem responde pela parte (ou inclua como novo): os registros antigos passam ao nome e à gerência do padrão."
          acoes={prev.data.gerencias.length > 0 && <Botao onClick={() => pedir(api.post<{ trocados: number }>('/partes/padronizar').then((r) => toast.success(`${r.trocados} registro(s) com a gerência padronizada`)), 'Gerências padronizadas')}>
            <Sparkles size={15} /> Padronizar {prev.data.gerencias.reduce((a, g) => a + g.registros, 0)} registro(s)</Botao>}>
          <div className="grid gap-4 lg:grid-cols-2">
            <ul className="text-[13px]">
              {prev.data.gerencias.map((g) => (
                <li key={g.de} className="flex items-center gap-2 border-b border-m-row py-1.5">
                  <span className="text-m-text-muted line-through">{g.de}</span> → <b className="text-m-text-primary">{g.para}</b>
                  <span className="ml-auto text-[12px] text-m-text-muted">{g.registros} · {g.onde.join(', ')}</span>
                </li>
              ))}
              {!prev.data.gerencias.length && <li className="py-2 text-m-text-muted">Nenhuma gerência para trocar.</li>}
            </ul>
            <ul className="text-[13px]">
              {prev.data.responsaveis.slice(0, 60).map((x) => {
                const papel = papelDe[x.nome] ?? x.papel ?? 'contratada';
                const pessoa = papel === 'contratada' ? (efetivo.data ?? []).find((c) => c.nome.toUpperCase() === x.nome.toUpperCase()) : undefined;
                const escolha = alvo[x.nome] ?? (x.sugestao_id ? String(x.sugestao_id) : '');
                const ativos = resp.filter((r) => r.ativo);
                return (
                  <li key={x.nome} className="flex flex-wrap items-center gap-2 border-b border-m-row py-1.5">
                    <span className="min-w-[140px] flex-1"><b className="text-m-text-primary">{x.nome}</b> <span className="text-[12px] text-m-text-muted">{x.registros} registro(s)</span>
                      {x.sugestao_id && !alvo[x.nome] && <span className="ml-1 text-[11px] text-m-success">sugerido</span>}</span>
                    <select aria-label={`Associar ${x.nome}`} value={escolha} onChange={(e) => setAlvo({ ...alvo, [x.nome]: e.target.value })}
                      className="h-8 max-w-[260px] rounded-[8px] border border-m-stroke bg-m-surface-field px-1.5 text-[12px]">
                      <option value="">associar a…</option>
                      {q.data!.partes.map((p) => {
                        const rs = ativos.filter((r) => r.papel === p.papel);
                        return rs.length ? <optgroup key={p.papel} label={p.gerencia}>{rs.map((r) => <option key={r.id} value={r.id}>{r.nome}{r.funcao ? ` · ${r.funcao}` : ''}</option>)}</optgroup> : null;
                      })}
                      <option value="novo">+ incluir como novo…</option>
                    </select>
                    {escolha === 'novo' && (
                      <select aria-label={`Parte de ${x.nome}`} value={papel} onChange={(e) => setPapelDe({ ...papelDe, [x.nome]: e.target.value as PapelParte })}
                        className="h-8 rounded-[8px] border border-m-stroke bg-m-surface-field px-1.5 text-[12px]">
                        {q.data!.partes.map((p) => <option key={p.papel} value={p.papel}>{p.gerencia}</option>)}
                      </select>
                    )}
                    <button type="button" disabled={!escolha} className="text-[12px] font-semibold text-m-accent disabled:text-m-text-muted"
                      onClick={() => escolha === 'novo'
                        ? pedir(api.post<{ id: number }>('/partes/responsaveis', pessoa ? { papel, colaborador_id: pessoa.id } : { papel, nome: x.nome })
                            .then((r) => api.post<{ trocados: number }>('/partes/padronizar/responsavel', { de: x.nome, responsavel_id: r.id })),
                          `${x.nome} incluído${pessoa ? ' (do efetivo)' : ''} e registros antigos padronizados`)
                        : pedir(api.post<{ trocados: number; responsavel: string }>('/partes/padronizar/responsavel', { de: x.nome, responsavel_id: Number(escolha) })
                            .then((r) => toast.success(`${r.trocados} registro(s): ${x.nome} → ${r.responsavel}`)), 'Responsável padronizado')}>
                      {escolha === 'novo' ? 'incluir' : 'associar'}</button>
                  </li>
                );
              })}
            </ul>
          </div>
        </Painel>
      )}
      <Painel titulo="Quem responde por cada parte?" subtitulo="Os nomes daqui aparecem na lista de Responsável; escolher o responsável já preenche a gerência. Inativar tira da lista sem mexer no que já foi registrado.">
        <div className="grid gap-4 lg:grid-cols-2">
          {q.data.partes.map((p) => {
            const lista = resp.filter((r) => r.papel === p.papel);
            const n = novo[p.papel] ?? { nome: '', funcao: '' };
            return (
              <section key={p.papel} className="flex flex-col gap-2 rounded-m-lg border border-m-stroke-subtle p-4">
                <div className="flex items-center justify-between"><b className="text-[13px] text-m-text-primary">{p.gerencia}</b><span className="text-[12px] text-m-text-muted">{lista.filter((r) => r.ativo).length} ativo(s)</span></div>
                <ul>{lista.length ? lista.map(linha) : <li className="py-2 text-[12.5px] text-m-text-muted">Ninguém ainda.</li>}</ul>
                {editar && (p.papel === 'contratada'
                  ? <BuscaEfetivo rotulo="Incluir do efetivo" pessoas={efetivo.data ?? []} placeholder="nome, matrícula ou função"
                      onEscolher={(c) => pedir(api.post('/partes/responsaveis', { papel: 'contratada', colaborador_id: c.id }), `${c.nome} incluído`)} />
                  : <div className="flex flex-wrap items-end gap-2">
                      <Campo rotulo="Nome" value={n.nome} onChange={(e) => setNovo({ ...novo, [p.papel]: { ...n, nome: e.target.value } })} className="min-w-[200px] flex-1" />
                      <Campo rotulo="Função (opcional)" value={n.funcao} onChange={(e) => setNovo({ ...novo, [p.papel]: { ...n, funcao: e.target.value } })} className="w-[180px]" />
                      <Botao className="h-10" disabled={n.nome.trim().length < 2} onClick={() => pedir(api.post('/partes/responsaveis', { papel: p.papel, nome: n.nome, funcao: n.funcao || null }).then(() => setNovo({ ...novo, [p.papel]: { nome: '', funcao: '' } })), 'Responsável incluído')}>
                        <Plus size={15} /> Incluir</Botao>
                    </div>)}
              </section>
            );
          })}
        </div>
      </Painel>
    </>
  );
}
