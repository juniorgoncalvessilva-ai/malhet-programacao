'use client';

import { useQuery } from '@tanstack/react-query';
import { FileUp, Pencil, Plus, Presentation, Save, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Calculado, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Carregando } from '@/components/Obra/Esqueleto';
import { Botao, Cabecalho, Erro, Indicador, Painel, Pilula, Selecao, Tabela, td, tdNum } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';

/**
 * Aderência física e financeira da programação semanal (spec 104): os mesmos quadros da apresentação da contratada
 * (semanas anteriores por engenheiro, ranking acumulado, semana anterior e meta da semana com marcos), a apresentação
 * no modelo (.pptx) e o histórico das semanas que vieram de fora (apresentação anterior, tomada como real).
 */
type Soma = { programado: number; realizado: number | null; saldo: number | null; aderencia: number | null; atividades: number; cumpridas: number; fisica: number | null };
interface Bloco { responsavel: string; posicao: number; linhas: (Soma & { semana: number })[]; total: Soma }
interface Marco { frente: string; descricao: string; valor: number }
interface ItemMeta { responsavel: string; frentes: string[]; meta: number; participacao: number | null; avanco: number | null; marcos: { itens: Marco[]; total: number; representatividade: number | null } }
interface LinhaSistema { id: number; codigo: string; descricao: string; responsavel: string; area: string; unidade: string | null; pu: number | null; previsto: number; realizado: number; valor_previsto: number; valor_realizado: number; cumprida: boolean }
interface Hist { id: number; semana: number; responsavel: string; programado: number; realizado: number | null; origem: string; arquivo: string | null; no_sistema: boolean }
interface Dados {
  semana: number; obra: string;
  semanas: { semana: number; origem: string | null; programado: number; realizado: number | null; aderencia: number | null; fisica: number | null }[];
  anteriores: { semanas: number[]; mostradas: number[]; blocos: Bloco[]; geral: Soma };
  ranking: { semanas: number[]; itens: (Soma & { posicao: number; responsavel: string })[]; geral: Soma };
  anterior: Soma & { semana: number; itens: (Soma & { responsavel: string })[]; desvio: number | null; origem: string[] };
  atual: { meta: number; valor_contrato: number | null; avanco: number | null; itens: ItemMeta[]; origem: string | null; programacao: { id: number; titulo: string } | null };
  linhas_anterior: LinhaSistema[]; linhas_atual: LinhaSistema[]; historico: Hist[];
  modelo: { nome: string; contratada: string | null; enviado_em: string; enviado_por: string | null; herdado: boolean } | null;
}

const brl = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const pct = (v: number | null | undefined, c = 2) => (v == null ? '—' : `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c })}%`);
const tomAder = (a: number | null) => (a == null ? 'neutro' : a >= 0.9 ? 'sucesso' : a >= 0.7 ? 'atencao' : 'perigo') as 'neutro' | 'sucesso' | 'atencao' | 'perigo';

function mem(chave: string, titulo: string, valor: string, formula: string, passos: [string, string, string][], origem: string, notas: string[] = []): MemoriaCalculo {
  return {
    chave, titulo, valor, formula,
    passos: passos.map(([descricao, conta, resultado], i) => ({ descricao, conta, resultado, destaque: i === passos.length - 1 && descricao === 'Total' })),
    fontes: [{ dado: titulo, valor, origem, local: null }], notas,
  };
}

export function PainelAderencia() {
  const api = useApi();
  const { pode } = useObra();
  const planejar = pode('planejador');
  const confirmar = useConfirmar();
  const [semana, setSemana] = useState<number | null>(null);
  const q = useQuery({ queryKey: ['aderencia', semana], queryFn: () => api.get<Dados>(`/aderencia${semana ? `?semana=${semana}` : ''}`) });
  const arquivo = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);
  const [editar, setEditar] = useState<{ semana: number; itens: { responsavel: string; programado: string; realizado: string }[] } | null>(null);
  const d = q.data;

  const importar = async (f: File) => {
    setImportando(true);
    try {
      const fd = new FormData(); fd.append('arquivo', f);
      const r = await api.post<{ registros: number; semanas: number[]; slides: number }>('/aderencia/importar', fd);
      toast.success(`Modelo guardado (${r.slides} slides) · ${r.registros} valor(es) das semanas ${r.semanas.map((s) => `S${s}`).join(', ') || '—'}`);
    } catch (e) { toast.error((e as Error).message, { duration: 9000 }); } finally { setImportando(false); if (arquivo.current) arquivo.current.value = ''; }
  };
  const baixar = async () => {
    try { await api.download(`/aderencia/apresentacao?semana=${d?.semana ?? ''}`, `Aderencia_semanal_S${d?.semana}.pptx`); }
    catch (e) { toast.error((e as Error).message); }
  };

  if (q.isLoading) return <Carregando />;
  if (!d) return <Erro erro={q.error} />;
  const an = d.anterior; const at = d.atual; const ant = d.anteriores;
  const opcoes = [...new Set([...d.semanas.map((s) => s.semana), d.semana, d.semana + 1])].sort((a, b) => b - a);
  const linhasDe = (ls: LinhaSistema[], resp?: string, campo: 'valor_previsto' | 'valor_realizado' = 'valor_previsto') =>
    ls.filter((l) => !resp || l.responsavel.toUpperCase() === resp.toUpperCase()).filter((l) => l[campo] > 0)
      .map((l) => [`${l.codigo} ${l.descricao}`, `${(campo === 'valor_previsto' ? l.previsto : l.realizado).toLocaleString('pt-BR')} ${l.unidade ?? ''} × ${brl(l.pu)}`, brl(l[campo])] as [string, string, string]);
  const origemTxt = (o: string | null | string[]) => (Array.isArray(o) ? o.join(' + ') : o) === 'sistema' ? 'Programação emitida no Malhet' : 'Histórico (apresentação anterior, tomado como real)';

  return (
    <>
      <Cabecalho eyebrow="Planejamento · aderência semanal" cor="var(--m-proc-planejar)"
        titulo={`Semana ${d.semana}: meta de ${brl(at.meta)} · semana ${an.semana} com aderência de ${pct(an.aderencia)}`}
        acoes={<div className="flex flex-wrap items-end gap-2">
          <Selecao rotulo="Semana" value={String(d.semana)} onChange={(e) => setSemana(Number(e.target.value))} className="w-[120px]">
            {opcoes.map((s) => <option key={s} value={s}>S{s}</option>)}
          </Selecao>
          <Botao onClick={baixar}><Presentation size={16} /> Apresentação (PPTX)</Botao>
          {planejar && <>
            <input ref={arquivo} type="file" accept=".pptx" className="hidden" onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])} />
            <Botao variante="secundario" disabled={importando} onClick={() => arquivo.current?.click()}><FileUp size={16} /> {importando ? 'Lendo…' : 'Importar apresentação'}</Botao>
          </>}
        </div>} />

      <p className="rounded-m-md border border-m-stroke-subtle bg-m-surface-raised px-4 py-2.5 text-[13px] text-m-text-secondary">
        {d.modelo
          ? <>Modelo de apresentação: <b className="text-m-text-primary">{d.modelo.nome}</b>{d.modelo.contratada ? ` · ${d.modelo.contratada}` : ''}{d.modelo.herdado ? ' · padrão da empresa (de outra obra da mesma contratada)' : ''} — capa, fundos e rodapé saem dele.</>
          : <>Sem modelo de apresentação: importe a apresentação anterior (.pptx) — ela vira o padrão (fundos, capa, rodapé) e as semanas que traz entram no histórico.</>}
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Indicador rotulo={`Meta S${d.semana}`} valor={<Calculado chave="meta" memoria={() => mem('meta', `Meta financeira da semana ${d.semana}`, brl(at.meta), 'Σ (previsto da linha × PU do item da PQ)', [...linhasDe(d.linhas_atual), ['Total', `${d.linhas_atual.length} linha(s)`, brl(at.meta)]], origemTxt(at.origem))}>{brl(at.meta)}</Calculado>} detalhe={at.programacao?.titulo ?? (at.origem ? 'histórico' : 'sem programação emitida')} />
        <Indicador rotulo="Avanço previsto" valor={<Calculado chave="avanco" memoria={() => mem('avanco', 'Avanço previsto no cronograma da obra', pct(at.avanco, 4), 'meta da semana ÷ valor do contrato (Σ quantidade × PU dos itens da PQ)', [['Meta da semana', '', brl(at.meta)], ['Valor do contrato', 'PQ vigente', brl(at.valor_contrato)], ['Total', 'meta ÷ contrato', pct(at.avanco, 4)]], 'PQ vigente + programação')}>{pct(at.avanco, 4)}</Calculado>} detalhe="sobre o valor do contrato" />
        <Indicador rotulo={`Aderência financeira S${an.semana}`} tom={tomAder(an.aderencia)} valor={<Calculado chave="aa" memoria={() => mem('aa', `Aderência financeira da semana ${an.semana}`, pct(an.aderencia), 'realizado ÷ programado (R$)', [...an.itens.map((i) => [i.responsavel, `${brl(i.realizado)} ÷ ${brl(i.programado)}`, pct(i.aderencia)] as [string, string, string]), ['Total', `${brl(an.realizado)} ÷ ${brl(an.programado)}`, pct(an.aderencia)]], origemTxt(an.origem))}>{pct(an.aderencia)}</Calculado>} detalhe={`desvio ${brl(an.desvio)}`} />
        <Indicador rotulo={`Aderência física S${an.semana}`} valor={an.fisica == null ? '—' : <Calculado chave="af" memoria={() => mem('af', `Aderência física da semana ${an.semana}`, pct(an.fisica), 'atividades cumpridas (realizado ≥ previsto) ÷ atividades programadas', [...an.itens.map((i) => [i.responsavel, `${i.cumpridas} ÷ ${i.atividades}`, pct(i.fisica)] as [string, string, string]), ['Total', `${an.cumpridas} ÷ ${an.atividades}`, pct(an.fisica)]], 'Programação emitida no Malhet')}>{pct(an.fisica)}</Calculado>} detalhe={an.fisica == null ? 'só para semanas do sistema' : `${an.cumpridas} de ${an.atividades} atividades`} />
        <Indicador rotulo="Acumulado anterior" tom={tomAder(ant.geral.aderencia)} valor={<Calculado chave="acum" memoria={() => mem('acum', 'Aderência acumulada das semanas anteriores', pct(ant.geral.aderencia), 'Σ realizado ÷ Σ programado', [...ant.blocos.map((b) => [b.responsavel, `${brl(b.total.realizado)} ÷ ${brl(b.total.programado)}`, pct(b.total.aderencia)] as [string, string, string]), ['Total', `${brl(ant.geral.realizado)} ÷ ${brl(ant.geral.programado)}`, pct(ant.geral.aderencia)]], 'Histórico + programações')}>{pct(ant.geral.aderencia)}</Calculado>} detalhe={ant.semanas.length ? `S${ant.semanas[0]} a S${ant.semanas[ant.semanas.length - 1]}` : 'sem semanas anteriores'} />
      </div>

      {ant.blocos.length > 0 && (
        <Painel titulo="Quem está à frente no acumulado?" subtitulo={`Ranking financeiro · programado × realizado · semanas ${ant.semanas.map((s) => `S${s}`).join(', ')}`}>
          <Tabela cabecalho={['', 'Responsável', ...ant.mostradas.map((s) => `S${s}`), 'Programado', 'Realizado', 'Não realizado', 'Aderência']} direita={[...ant.mostradas.map((_, i) => i + 2), ant.mostradas.length + 2, ant.mostradas.length + 3, ant.mostradas.length + 4, ant.mostradas.length + 5]}>
            {ant.blocos.map((b) => (
              <tr key={b.responsavel}>
                <td className={td}><b>{b.posicao}º</b></td>
                <td className={`${td} font-semibold text-m-text-primary`}>{b.responsavel}</td>
                {ant.mostradas.map((s) => { const l = b.linhas.find((x) => x.semana === s); return <td key={s} className={tdNum}>{l ? <span title={`${brl(l.realizado)} de ${brl(l.programado)}`}>{pct(l.aderencia, 0)}</span> : '—'}</td>; })}
                <td className={tdNum}>{brl(b.total.programado)}</td>
                <td className={tdNum}>{brl(b.total.realizado)}</td>
                <td className={`${tdNum} text-m-danger`}>{brl(-(b.total.saldo ?? 0))}</td>
                <td className={tdNum}><Pilula tom={tomAder(b.total.aderencia)}>{pct(b.total.aderencia)}</Pilula></td>
              </tr>
            ))}
          </Tabela>
        </Painel>
      )}

      <Painel titulo={`Como foi a semana ${an.semana}?`} subtitulo={`Planejado × realizado por responsável · ${origemTxt(an.origem)}`}>
        <Tabela cabecalho={['Responsável', 'Planejado', 'Realizado', 'Saldo', 'Ader. financeira', 'Ader. física']} direita={[1, 2, 3, 4, 5]} vazio={an.itens.length ? false : 'Sem dados da semana anterior.'}>
          {an.itens.map((i) => (
            <tr key={i.responsavel}>
              <td className={`${td} font-semibold text-m-text-primary`}>{i.responsavel}</td>
              <td className={tdNum}><Calculado chave={`ap:${i.responsavel}`} memoria={() => mem('ap', `Planejado · ${i.responsavel}`, brl(i.programado), 'Σ previsto × PU', [...linhasDe(d.linhas_anterior, i.responsavel), ['Total', '', brl(i.programado)]], origemTxt(an.origem))}>{brl(i.programado)}</Calculado></td>
              <td className={tdNum}><Calculado chave={`ar:${i.responsavel}`} memoria={() => mem('ar', `Realizado · ${i.responsavel}`, brl(i.realizado), 'Σ realizado × PU', [...linhasDe(d.linhas_anterior, i.responsavel, 'valor_realizado'), ['Total', '', brl(i.realizado)]], origemTxt(an.origem))}>{brl(i.realizado)}</Calculado></td>
              <td className={`${tdNum} ${(i.saldo ?? 0) < 0 ? 'text-m-danger' : 'text-m-success'}`}>{brl(i.saldo)}</td>
              <td className={tdNum}><Pilula tom={tomAder(i.aderencia)}>{pct(i.aderencia)}</Pilula></td>
              <td className={tdNum}>{i.fisica == null ? '—' : `${pct(i.fisica, 0)} (${i.cumpridas}/${i.atividades})`}</td>
            </tr>
          ))}
        </Tabela>
      </Painel>

      <Painel titulo={`Qual a meta da semana ${d.semana}?`} subtitulo="Distribuição da meta por engenheiro e os marcos prioritários (atividades de maior valor até 80% da meta)">
        {at.itens.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {at.itens.map((i) => (
              <div key={i.responsavel} className="flex flex-col gap-2 rounded-m-md border border-m-stroke-subtle p-3 text-[13px]">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <b className="text-m-text-primary">{i.responsavel}</b>
                  <span className="text-m-text-secondary"><b className="text-m-text-primary">{brl(i.meta)}</b> · {pct(i.participacao)} da meta · avanço {pct(i.avanco, 4)}</span>
                </div>
                <span className="text-[12px] text-m-text-muted">{i.frentes.join(' · ')}</span>
                <div className="h-1.5 rounded-full bg-m-surface-hover"><div className="h-1.5 rounded-full bg-[#E8542F]" style={{ width: `${Math.min(100, (i.participacao ?? 0) * 100)}%` }} /></div>
                {i.marcos.itens.length > 0 && (
                  <ul className="flex flex-col divide-y divide-m-stroke-subtle border-t border-m-stroke-subtle">
                    {i.marcos.itens.map((m, k) => <li key={k} className="flex justify-between gap-3 py-1"><span className="text-m-text-secondary">{m.descricao}</span><span className="whitespace-nowrap font-semibold">{brl(m.valor)}</span></li>)}
                    <li className="flex justify-between py-1 font-semibold text-m-text-primary"><span>Total dos marcos · {pct(i.marcos.representatividade)} da meta</span><span>{brl(i.marcos.total)}</span></li>
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : <p className="text-[13px] text-m-text-muted">Sem programação semanal emitida para a semana {d.semana}. Emita a programação (ou importe a meta) para ver a distribuição.</p>}
      </Painel>

      <Painel titulo="Como evoluiu semana a semana?" subtitulo="Semana do sistema vem da programação emitida; as demais, do histórico (apresentação anterior ou digitado)"
        acoes={planejar && <Botao variante="secundario" onClick={() => setEditar({ semana: Math.min(...d.semanas.map((s) => s.semana), d.semana) - 1, itens: [{ responsavel: '', programado: '', realizado: '' }] })}><Plus size={15} /> Semana do histórico</Botao>}>
        <Tabela cabecalho={['Semana', 'Origem', 'Programado', 'Realizado', 'Aderência', 'Física', '']} direita={[2, 3, 4, 5]} vazio={d.semanas.length ? false : 'Nenhuma semana ainda.'}>
          {[...d.semanas].reverse().map((s) => {
            const hist = d.historico.filter((h) => h.semana === s.semana);
            return (
              <tr key={s.semana}>
                <td className={`${td} font-semibold`}>S{s.semana}</td>
                <td className={td}><Pilula tom={s.origem === 'sistema' ? 'acento' : 'neutro'}>{s.origem === 'sistema' ? 'sistema' : 'histórico'}</Pilula>{hist[0]?.arquivo ? <span className="ml-1 text-[11.5px] text-m-text-muted">{hist[0].arquivo}</span> : null}</td>
                <td className={tdNum}>{brl(s.programado)}</td>
                <td className={tdNum}>{brl(s.realizado)}</td>
                <td className={tdNum}>{pct(s.aderencia)}</td>
                <td className={tdNum}>{pct(s.fisica, 0)}</td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  {planejar && hist.length > 0 && <>
                    <button type="button" title="Corrigir a semana do histórico" className="p-1 text-m-text-muted hover:text-m-accent" onClick={() => setEditar({ semana: s.semana, itens: hist.map((h) => ({ responsavel: h.responsavel, programado: String(h.programado), realizado: h.realizado == null ? '' : String(h.realizado) })) })}><Pencil size={15} /></button>
                    <button type="button" title="Apagar a semana do histórico" className="p-1 text-m-text-muted hover:text-m-danger" onClick={() => confirmar({
                      titulo: `Apagar a semana S${s.semana} do histórico?`, mensagem: s.origem === 'sistema' ? 'A semana continua pela programação emitida no sistema; só o histórico importado sai.' : 'Os valores importados ou digitados desta semana saem da análise.',
                      acao: 'Apagar', executar: () => api.del(`/aderencia/historico/${s.semana}`) })}><Trash2 size={15} /></button>
                  </>}
                </td>
              </tr>
            );
          })}
        </Tabela>
      </Painel>
      {editar && <EditarSemana inicial={editar} onFechar={() => setEditar(null)} />}
    </>
  );
}

function EditarSemana({ inicial, onFechar }: { inicial: { semana: number; itens: { responsavel: string; programado: string; realizado: string }[] }; onFechar: () => void }) {
  const api = useApi();
  const [semana, setSemana] = useState(String(inicial.semana));
  const [itens, setItens] = useState(inicial.itens);
  const [erro, setErro] = useState<unknown>(null);
  const num = (t: string) => Number(t.replace(/\./g, '').replace(',', '.'));
  const salvar = async () => {
    try {
      await api.put(`/aderencia/historico/${Number(semana)}`, { itens: itens.filter((i) => i.responsavel.trim()).map((i) => ({ responsavel: i.responsavel, programado: num(i.programado) || 0, realizado: i.realizado.trim() ? num(i.realizado) : null })) });
      toast.success(`Semana S${semana} salva no histórico`); onFechar();
    } catch (e) { setErro(e); }
  };
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Semana do histórico">
      <div className="flex max-h-[90vh] w-full max-w-[720px] flex-col gap-3 overflow-y-auto rounded-m-lg bg-m-surface-raised p-5">
        <div className="flex items-center justify-between"><b className="text-[16px]">Semana do histórico</b>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="grid h-8 w-8 place-items-center rounded-full border border-m-stroke"><X size={15} /></button></div>
        <label className="flex items-center gap-2 text-[13px]">Semana S<input value={semana} onChange={(e) => setSemana(e.target.value.replace(/\D/g, ''))} className="h-9 w-20 rounded-[8px] border border-m-stroke bg-m-surface-field px-2" /></label>
        <table className="w-full text-[13px]"><thead><tr className="text-left text-[11px] uppercase text-m-text-muted"><th className="py-1">Responsável</th><th>Programado (R$)</th><th>Realizado (R$)</th><th /></tr></thead>
          <tbody>{itens.map((i, k) => (
            <tr key={k}>
              {(['responsavel', 'programado', 'realizado'] as const).map((c) => (
                <td key={c} className="py-1 pr-2"><input value={i[c]} onChange={(e) => setItens(itens.map((x, j) => (j === k ? { ...x, [c]: e.target.value } : x)))} placeholder={c === 'realizado' ? 'vazio = só meta' : ''}
                  className="h-9 w-full rounded-[8px] border border-m-stroke bg-m-surface-field px-2" /></td>
              ))}
              <td><button type="button" aria-label="Tirar a linha" onClick={() => setItens(itens.filter((_, j) => j !== k))} className="p-1 text-m-text-muted"><X size={15} /></button></td>
            </tr>
          ))}</tbody></table>
        <Botao variante="secundario" className="self-start" onClick={() => setItens([...itens, { responsavel: '', programado: '', realizado: '' }])}><Plus size={15} /> Responsável</Botao>
        <Erro erro={erro} />
        <div className="flex justify-end gap-2"><Botao variante="secundario" onClick={onFechar}>Cancelar</Botao><Botao onClick={salvar}><Save size={15} /> Salvar semana</Botao></div>
      </div>
    </div>, document.body);
}
