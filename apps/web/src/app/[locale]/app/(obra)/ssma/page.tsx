'use client';

import { HardHat, Save } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Botao, Cabecalho, Erro, Painel, Pilula, Selecao, dataBR } from '@/components/Obra/ui';
import { k, useAcao, useCadastrosSsma, useProgramacao, useProgramacoes } from '@/hooks/programacao/planejamento';
import { validade } from '@/components/Obra/CadastroSsma';
import { Link } from '@/i18n/navigation';
import { comoLista, type CadastroSsma, type LinhaVisao, type Ssma, type TipoCadastroSsma } from '@/lib/api/types';
import { MultiSelecao } from '@/components/Obra/MultiSelecao';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';

// PTO saiu daqui: é do Planejamento (montar a programação)
const CAMPOS: { k: Exclude<keyof Ssma, 'pto'>; tipo: TipoCadastroSsma; rotulo: string; largura: string }[] = [
  { k: 'tecnico', tipo: 'TECNICO', rotulo: 'Técnico de segurança responsável', largura: 'w-[210px]' },
  { k: 'rac', tipo: 'RAC', rotulo: 'RAC', largura: 'w-[150px]' },
  { k: 'pts', tipo: 'PTS', rotulo: 'PTS', largura: 'w-[150px]' },
  { k: 'art', tipo: 'ART', rotulo: 'ART', largura: 'w-[160px]' },
  { k: 'ata', tipo: 'ATA', rotulo: 'ATA (Autorização de Trabalho Ambiental)', largura: 'w-[160px]' },
];
type CampoLista = 'rac' | 'pts' | 'art' | 'ata';
type Edicao = Record<number, { tecnico?: string } & Partial<Record<CampoLista, string[]>>>;

export default function SsmaPage() {
  const api = useApi();
  const { editaSsma: podeSsma } = useObra();
  const lista = useProgramacoes();
  const [pid, setPid] = useState<number | null>(null);
  useEffect(() => { if (pid == null && lista.data?.length) setPid(lista.data[0].id); }, [lista.data, pid]);
  const prog = useProgramacao(pid ?? 0);
  const [ed, setEd] = useState<Edicao>({});
  useEffect(() => setEd({}), [pid]);
  const v = prog.data;
  const editaSsma = podeSsma && v?.status !== 'concluida';  // concluída: só leitura (mudança só por revisão)
  const linhas = useMemo(() => v?.locais.flatMap((l) => l.areas.flatMap((a) => a.linhas)) ?? [], [v]);
  const cadastros = useCadastrosSsma();
  const opcoes = (tipo: TipoCadastroSsma, atual: string[]) => {
    const l = (cadastros.data ?? []).filter((c) => c.tipo === tipo && (c.ativo || atual.includes(c.codigo)));
    return l.sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));
  };
  const rotuloOp = (c: CadastroSsma) => { const v = validade(c); return `${c.codigo}${c.descricao ? ` · ${c.descricao.slice(0, 40)}` : ''}${v && v.tom !== 'sucesso' ? ` (${v.texto})` : ''}${c.ativo ? '' : ' (inativo)'}`; };
  const semCadastro = CAMPOS.filter((c) => !(cadastros.data ?? []).some((x) => x.tipo === c.tipo && x.ativo)).map((c) => c.rotulo.split(' (')[0]);
  const n = Object.keys(ed).length;

  const salvar = useAcao((api, e: Edicao) => api.put<{ linhas: number }>(`/programacoes/${pid}/ssma`, {
    linhas: Object.entries(e).map(([id, x]) => {
      const ln = linhas.find((l) => l.id === Number(id));
      const ss = ln?.ssma;
      return { id: Number(id), tecnico: ss?.tecnico ?? null, rac: comoLista(ss?.rac), pts: comoLista(ss?.pts), art: comoLista(ss?.art), ata: comoLista(ss?.ata), ...x };
    }),
  }), [[...k.programacoes], ['programacao']]);
  const tec = (ln: LinhaVisao) => ed[ln.id]?.tecnico ?? ln.ssma?.tecnico ?? '';
  const itens = (ln: LinhaVisao, c: CampoLista) => ed[ln.id]?.[c] ?? comoLista(ln.ssma?.[c]);
  const setTec = (ln: LinhaVisao, x: string) => setEd((e) => ({ ...e, [ln.id]: { ...e[ln.id], tecnico: x } }));
  const setItens = (ln: LinhaVisao, c: CampoLista, x: string[]) => setEd((e) => ({ ...e, [ln.id]: { ...e[ln.id], [c]: x } }));
  const completo = (ln: LinhaVisao) => !!tec(ln).trim() && CAMPOS.slice(1).every((c) => itens(ln, c.k as CampoLista).length > 0);
  const baixar = (aid: number, nome: string) => api.download(`/ssma/anexos/${aid}`, nome).catch((er) => toast.error(er.message));
  const pendentes = linhas.filter((l) => !completo(l)).length;

  return (
    <>
      <Cabecalho
        eyebrow="Segurança · SSMA da programação"
        cor="var(--m-proc-administrar)"
        titulo={v ? `${v.titulo}: ${pendentes ? `${pendentes} linha(s) sem SSMA completo` : 'SSMA completo'}` : 'SSMA da programação'}
        acoes={<div className="flex items-end gap-2">
          <Selecao rotulo="Programação" value={pid ?? ''} onChange={(e) => setPid(Number(e.target.value))} className="min-w-[300px]">
            {lista.data?.map((p) => <option key={p.id} value={p.id}>{p.titulo} · {p.status === 'concluida' ? 'concluída' : p.status === 'emitida' ? 'emitida' : 'rascunho'}</option>)}
          </Selecao>
          {editaSsma && <Botao disabled={!n || salvar.isPending} onClick={() => salvar.mutate(ed, { onSuccess: (r) => { toast.success(`SSMA salvo em ${r.linhas} linha(s)`); setEd({}); } })}><Save size={16} /> Salvar SSMA{n ? ` (${n})` : ''}</Botao>}
        </div>}
      />
      <Painel titulo={<span className="inline-flex items-center gap-2"><HardHat size={18} className="text-m-accent" />Itens de SSMA por atividade</span>}
        subtitulo={v ? `Período ${dataBR(v.inicio)} a ${dataBR(v.fim)}` : undefined}>
        {cadastros.data && semCadastro.length > 0 && <p className="text-[13px] text-m-warning">Sem cadastro de {semCadastro.join(', ')}: só N/A na lista. <Link href="/app/ssma/cadastros" className="font-semibold underline">Cadastrar</Link></p>}
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">
                <th className="px-2 pb-2 text-left">Atividade</th>
                <th className="px-2 pb-2 text-left">Encarregado</th>
                {CAMPOS.map((c) => <th key={c.k} className="px-1 pb-2 text-left">{c.rotulo}</th>)}
                <th className="px-1 pb-2 text-left" title="Escolhido pelo Planejamento na programação">PTO · planejamento</th>
                <th className="px-2 pb-2" />
              </tr>
            </thead>
            <tbody>
              {!linhas.length && <tr><td colSpan={10} className="py-8 text-center text-m-text-muted">{prog.isLoading ? 'Carregando…' : 'Programação sem linhas.'}</td></tr>}
              {v?.locais.map((l) => (
                <Fragment key={l.id}>
                  <tr><td colSpan={10} className="bg-m-accent-strong px-3 py-1.5 text-xs font-bold uppercase text-m-on-accent">{l.codigo} · {l.descricao}</td></tr>
                  {l.areas.map((a) => (
                    <Fragment key={a.id}>
                      <tr><td colSpan={10} className="bg-m-surface-active px-3 py-1.5 text-xs font-semibold text-m-accent">
                        CWA {a.cwa} · {a.descricao}
                        {editaSsma && a.linhas.length > 1 && <button type="button" className="ml-3 underline" onClick={() => {
                          const t = tec(a.linhas[0]);
                          if (t) a.linhas.slice(1).forEach((ln) => setTec(ln, t));
                        }}>repetir o técnico da 1ª linha na área</button>}
                      </td></tr>
                      {a.linhas.map((ln) => (
                        <tr key={ln.id} className="border-b border-m-row align-top">
                          <td className="min-w-[240px] px-2 py-2"><b className="text-m-text-primary">{ln.codigo_simova}</b> {ln.descricao}
                            <div className="text-[11px] text-m-text-muted">{ln.id_crono ?? ''}{ln.total_previsto ? ` · prev. ${ln.total_previsto} ${ln.unidade ?? ''}` : ''}</div></td>
                          <td className="px-2 py-2">{ln.encarregado ?? ln.equipe ?? '—'}</td>
                          <td className="px-1 py-1.5">
                            {(() => {
                              const atual = tec(ln);
                              const ops = opcoes('TECNICO', [atual]);
                              return (
                                <select aria-label={`Técnico de segurança responsável · ${ln.codigo_simova}`} disabled={!editaSsma} value={atual} onChange={(e) => setTec(ln, e.target.value)}
                                  className={`h-8 w-[200px] rounded-[8px] border bg-m-surface-field px-1.5 text-[13px] outline-none focus:border-m-accent disabled:border-transparent disabled:bg-transparent ${ed[ln.id]?.tecnico !== undefined ? 'border-m-accent bg-m-accent-subtle' : atual ? 'border-m-stroke' : 'border-m-warning'}`}>
                                  <option value="">—</option>
                                  <option value="N/A">N/A</option>
                                  {ops.map((o) => <option key={o.id} value={o.codigo}>{rotuloOp(o)}</option>)}
                                  {atual && atual !== 'N/A' && !ops.some((o) => o.codigo === atual) && <option value={atual}>{atual} (fora do cadastro)</option>}
                                </select>
                              );
                            })()}
                          </td>
                          {CAMPOS.slice(1).map((c) => {
                            const k2 = c.k as CampoLista;
                            const atual = itens(ln, k2);
                            const ops = opcoes(c.tipo, atual);
                            const fora = atual.filter((x) => x !== 'N/A' && !ops.some((o) => o.codigo === x));
                            return (
                              <td key={c.k} className={`px-1 py-1.5 ${ed[ln.id]?.[k2] !== undefined ? 'bg-m-accent-subtle/50' : ''}`}>
                                <MultiSelecao rotulo={`${c.rotulo.split(' (')[0]} · ${ln.codigo_simova}`} largura={c.largura} disabled={!editaSsma} valor={atual}
                                  onChange={(x) => setItens(ln, k2, x)} onBaixar={baixar}
                                  opcoes={[...ops.map((o) => ({ valor: o.codigo, rotulo: rotuloOp(o), anexos: o.anexos })), ...fora.map((x) => ({ valor: x, rotulo: `${x} (fora do cadastro)` }))]} />
                              </td>
                            );
                          })}
                          <td className="px-1 py-2 text-[12px] text-m-text-secondary">{comoLista(ln.ssma?.pto).join(', ') || '—'}</td>
                          <td className="whitespace-nowrap px-2 py-2">
                            {completo(ln) ? <Pilula tom="sucesso">ok</Pilula> : editaSsma
                              ? <button type="button" className="text-xs font-semibold text-m-accent underline" onClick={() => { if (!tec(ln)) setTec(ln, 'N/A'); CAMPOS.slice(1).forEach((c) => !itens(ln, c.k as CampoLista).length && setItens(ln, c.k as CampoLista, ['N/A'])); }}>N/A no vazio</button>
                              : <Pilula tom="atencao">pendente</Pilula>}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <Erro erro={salvar.error} />
      </Painel>
    </>
  );
}
