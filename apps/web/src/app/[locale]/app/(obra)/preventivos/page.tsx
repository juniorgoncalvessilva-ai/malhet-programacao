'use client';

import { Plus, Printer, Trash2, X } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Miniatura } from '@/components/Mobile/Fotos';
import { Abas } from '@/components/Obra/Abas';
import { Calculado, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { LogosObra } from '@/components/Obra/LogosObra';
import { Botao, Cabecalho, Campo, Indicador, Painel, Pilula, Selecao, Tabela, td, tdNum } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';
import {
  type Aparelho, type Assinatura, type ConfigEtilometro, type EventoEtilometro, mgL, useAparelhos, useConfigEtilometro, useEventoEtilometro,
  useEventosEtilometro,
} from '@/lib/preventivos';

const menos = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
const dBR = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
const dh = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const MEIO: Record<string, string> = { facial: 'rosto', nfc: 'crachá NFC', qr: 'crachá QR', codigo: 'crachá', desenho: 'na tela', manual: 'manual' };
const assinou = (a: Assinatura | null | undefined) => (a ? `${MEIO[a.meio] ?? a.meio} · ${dh(a.hora)}` : 'sem assinatura');

/** Controle preventivo (spec 073): histórico dos eventos de etilômetro e a configuração (faixas, contraprova, aparelhos). */
export default function PreventivosPage() {
  const [aba, setAba] = useState<'eventos' | 'config'>('eventos');
  const { papel, pode } = useObra();
  const edita = papel === 'seguranca' || pode('planejador');
  return (
    <>
      <Cabecalho eyebrow="Governança · segurança" titulo="Controle preventivo" />
      <Abas rotulo="Controle preventivo" ativa={aba} onTrocar={setAba} abas={[{ chave: 'eventos', titulo: 'Etilômetro — eventos' }, { chave: 'config', titulo: 'Configuração' }]} />
      {aba === 'eventos' ? <Eventos /> : <Configuracao edita={edita} />}
    </>
  );
}

function memTotal(titulo: string, evs: EventoEtilometro[], campo: keyof EventoEtilometro['resumo']): MemoriaCalculo {
  const tot = evs.reduce((a, e) => a + e.resumo[campo], 0);
  return {
    chave: campo, titulo, valor: String(tot), formula: 'soma dos eventos do período',
    passos: [...evs.map((e) => ({ descricao: `Nº ${e.numero} · ${dBR(e.data)}`, conta: e.responsavel, resultado: String(e.resumo[campo]), destaque: false })),
      { descricao: 'Total', conta: evs.map((e) => e.resumo[campo]).join(' + ') || '0', resultado: String(tot), destaque: true }],
    fontes: [{ dado: 'Testes', valor: String(evs.reduce((a, e) => a + e.resumo.testes, 0)), origem: 'Etilômetro no app de campo', local: 'resultado que vale = contraprova, quando houve' }],
    notas: ['Pessoa com contraprova pendente não conta como aprovada nem reprovada.'],
  };
}

function Eventos() {
  const [de, setDe] = useState(menos(30));
  const [ate, setAte] = useState(menos(0));
  const [aberto, setAberto] = useState<number | null>(null);
  const q = useEventosEtilometro(`?de=${de}&ate=${ate}`);
  const evs = q.data ?? [];
  return (
    <>
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <Campo rotulo="De" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        <Campo rotulo="Até" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5 print:hidden">
        <Indicador rotulo="Eventos" valor={evs.length} />
        <Indicador rotulo="Pessoas testadas" valor={<Calculado chave="pessoas" memoria={() => memTotal('Pessoas testadas', evs, 'pessoas')}>{String(evs.reduce((a, e) => a + e.resumo.pessoas, 0))}</Calculado>} />
        <Indicador rotulo="Reprovados" tom="perigo" valor={<Calculado chave="reprovados" memoria={() => memTotal('Reprovados (resultado final)', evs, 'reprovados')}>{String(evs.reduce((a, e) => a + e.resumo.reprovados, 0))}</Calculado>} />
        <Indicador rotulo="Recusas" valor={<Calculado chave="recusas" memoria={() => memTotal('Recusas', evs, 'recusas')}>{String(evs.reduce((a, e) => a + e.resumo.recusas, 0))}</Calculado>} />
        <Indicador rotulo="Contraprovas" valor={<Calculado chave="contraprovas" memoria={() => memTotal('Contraprovas feitas', evs, 'contraprovas')}>{String(evs.reduce((a, e) => a + e.resumo.contraprovas, 0))}</Calculado>} />
      </div>
      <Painel titulo="Eventos de etilômetro" className="print:hidden">
        <Tabela cabecalho={['Nº', 'Data', 'Responsável', 'Aparelho', 'Pessoas', 'Aprov.', 'Reprov.', 'Recusa', 'Situação']} direita={[4, 5, 6, 7]}
          vazio={!evs.length && (q.isLoading ? 'Carregando…' : 'Nenhum evento no período. Os eventos são feitos no celular/tablet (Controle preventivo › Etilômetro).')}>
          {evs.map((e) => (
            <Fragment key={e.id}>
              <tr className="cursor-pointer hover:bg-m-surface-hover" onClick={() => setAberto(aberto === e.id ? null : e.id)}>
                <td className={`${td} font-semibold text-m-text-primary`}>{e.numero}</td>
                <td className={td}>{dBR(e.data)}{e.local ? <span className="block text-[12px] text-m-text-muted">{e.local}</span> : null}</td>
                <td className={td}>{e.responsavel}</td>
                <td className={td}>{e.aparelho.marca} {e.aparelho.modelo}</td>
                <td className={tdNum}>{e.resumo.pessoas}</td>
                <td className={`${tdNum} text-m-success`}>{e.resumo.aprovados}</td>
                <td className={`${tdNum} text-m-danger`}>{e.resumo.reprovados}</td>
                <td className={tdNum}>{e.resumo.recusas}</td>
                <td className={td}>{e.status === 'aberto' ? <Pilula tom="atencao">aberto</Pilula> : <Pilula tom="sucesso">encerrado</Pilula>}
                  {e.resumo.contraprova_pendente > 0 && <span className="ml-1"><Pilula tom="perigo">{e.resumo.contraprova_pendente} sem contraprova</Pilula></span>}</td>
              </tr>
            </Fragment>
          ))}
        </Tabela>
      </Painel>
      {aberto && <Detalhe id={aberto} onFechar={() => setAberto(null)} />}
    </>
  );
}

function AssinaturaVer({ a }: { a: Assinatura | null | undefined }) {
  return (
    <span className="inline-flex flex-col">
      <span>{assinou(a)}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {a?.desenho && <img src={a.desenho} alt="Assinatura" className="mt-0.5 h-8 w-auto rounded border border-m-stroke-subtle bg-white" />}
    </span>
  );
}

/** Ficha do evento: o que a fiscalização pede — aparelho e calibração (com fotos), responsável e as assinaturas de cada pessoa. */
function Detalhe({ id, onFechar }: { id: number; onFechar: () => void }) {
  const q = useEventoEtilometro(id);
  const e = q.data;
  if (!e) return <p className="text-sm text-m-text-muted">Carregando o evento…</p>;
  const testes = e.testes ?? [];
  return (
    <Painel titulo={`Etilômetro Nº ${e.numero} · ${dBR(e.data)}`} subtitulo={e.local ?? undefined}
      acoes={<span className="flex gap-2 print:hidden"><Botao variante="secundario" onClick={() => window.print()}><Printer size={16} /> Imprimir</Botao>
        <Botao variante="secundario" onClick={onFechar} aria-label="Fechar"><X size={16} /></Botao></span>}>
      <div className="hidden print:block"><LogosObra /></div>
      <div className="grid gap-3 text-[13px] md:grid-cols-3">
        <div><b className="block text-[11px] uppercase tracking-[0.4px] text-m-text-muted">Aparelho</b>{e.aparelho.marca} {e.aparelho.modelo}{e.aparelho.numero_serie ? ` · nº ${e.aparelho.numero_serie}` : ''}
          <span className="block text-m-text-muted">Calibração {dBR(e.aparelho.calibracao_em)} · validade {dBR(e.aparelho.validade)}</span></div>
        <div><b className="block text-[11px] uppercase tracking-[0.4px] text-m-text-muted">Responsável</b>{e.responsavel}
          <span className="block text-m-text-muted">Início: <AssinaturaVer a={e.assinatura_inicio} /></span>
          <span className="block text-m-text-muted">Fim: {e.assinatura_fim ? <AssinaturaVer a={e.assinatura_fim} /> : 'evento não encerrado'}</span></div>
        <div><b className="block text-[11px] uppercase tracking-[0.4px] text-m-text-muted">Fotos (aparelho e calibração)</b>
          <span className="mt-1 flex flex-wrap gap-2">{(e.fotos ?? []).map((f) => <span key={f.id} className="flex flex-col items-center text-[11px] text-m-text-muted"><Miniatura id={f.id} tamanho={72} />{f.momento === 'calibracao' ? 'calibração' : 'aparelho'}</span>)}</span></div>
      </div>
      <div className="mt-3">
        <Tabela cabecalho={['Hora', 'Colaborador', 'Função', 'Teste', 'Resultado', 'Faixa', 'Assinatura']} direita={[]}>
          {testes.map((t) => (
            <tr key={t.id}>
              <td className={td}>{dh(t.hora)}</td>
              <td className={td}><b className="text-m-text-primary">{t.nome}</b>{t.matricula ? <span className="block text-[12px] text-m-text-muted">{t.matricula}</span> : null}</td>
              <td className={td}>{t.funcao ?? '—'}</td>
              <td className={td}>{t.tentativa === 2 ? 'Contraprova' : '1º teste'}</td>
              <td className={`${td} font-semibold ${t.resultado === 'aprovado' ? 'text-m-success' : 'text-m-danger'}`}>{t.recusa ? 'Recusa' : mgL(t.valor)}</td>
              <td className={td}>{t.faixa}{t.penalidade ? <span className="block text-[11.5px] text-m-text-muted">{t.penalidade}</span> : null}</td>
              <td className={td}><AssinaturaVer a={t.assinatura} /></td>
            </tr>
          ))}
        </Tabela>
      </div>
      {e.observacao && <p className="mt-2 text-[13px]"><b>Observação:</b> {e.observacao}</p>}
      <p className="mt-2 text-[12px] text-m-text-muted">Faixas usadas neste evento: {(e.config?.faixas ?? []).map((f) => `a partir de ${f.de.toLocaleString('pt-BR')} mg/L — ${f.rotulo}`).join(' · ')} · contraprova após {e.config?.contraprova_minutos} min. Registrado por {e.criado_por ?? '—'}.</p>
    </Painel>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
function Configuracao({ edita }: { edita: boolean }) {
  const api = useApi();
  const cfg = useConfigEtilometro();
  const [f, setF] = useState<ConfigEtilometro | null>(null);
  useEffect(() => { if (cfg.data) setF(structuredClone(cfg.data)); }, [cfg.data]);
  const salvar = async () => {
    if (!f) return;
    try { await api.put('/preventivos/etilometro/config', { ...f, faixas: f.faixas.map((x) => ({ ...x, de: Number(String(x.de).replace(',', '.')) })) }); toast.success('Configuração salva'); } catch (e) { toast.error((e as Error).message); }
  };
  const mudarFaixa = (i: number, m: Partial<ConfigEtilometro['faixas'][number]>) => setF((x) => (x ? { ...x, faixas: x.faixas.map((y, j) => (j === i ? { ...y, ...m } : y)) } : x));
  return (
    <>
      <Painel titulo="Faixas do etilômetro" subtitulo="cada faixa vale a partir do valor (mg/L) até a próxima; a recusa tem a sua própria regra">
        {f && (
          <div className="flex flex-col gap-2">
            {f.faixas.map((x, i) => (
              <div key={i} className="grid items-end gap-2 md:grid-cols-[110px_1fr_150px_2fr_40px]">
                <Campo rotulo="A partir de (mg/L)" value={String(x.de)} disabled={!edita || i === 0} onChange={(e) => mudarFaixa(i, { de: e.target.value as unknown as number })} />
                <Campo rotulo="Nome da faixa" value={x.rotulo} disabled={!edita} onChange={(e) => mudarFaixa(i, { rotulo: e.target.value })} />
                <Selecao rotulo="Resultado" value={x.resultado} disabled={!edita} onChange={(e) => mudarFaixa(i, { resultado: e.target.value as 'aprovado' | 'reprovado' })}>
                  <option value="aprovado">Aprovado</option><option value="reprovado">Reprovado</option>
                </Selecao>
                <Campo rotulo="Penalidade" value={x.penalidade} disabled={!edita} onChange={(e) => mudarFaixa(i, { penalidade: e.target.value })} />
                {edita && i > 0 ? <button type="button" aria-label="Tirar a faixa" onClick={() => setF({ ...f, faixas: f.faixas.filter((_, j) => j !== i) })} className="mb-1 grid h-9 w-9 place-items-center rounded-full border border-m-stroke text-m-text-muted"><Trash2 size={15} /></button> : <span />}
              </div>
            ))}
            {edita && <button type="button" onClick={() => setF({ ...f, faixas: [...f.faixas, { de: (f.faixas.at(-1)?.de ?? 0) + 0.1, rotulo: '', resultado: 'reprovado', penalidade: '' }] })} className="self-start text-[13px] font-semibold text-m-accent"><Plus size={14} className="mr-1 inline" />faixa</button>}
            <div className="grid items-end gap-2 border-t border-m-stroke-subtle pt-3 md:grid-cols-[1fr_150px_2fr]">
              <Campo rotulo="Recusa ao teste" value={f.recusa.rotulo} disabled={!edita} onChange={(e) => setF({ ...f, recusa: { ...f.recusa, rotulo: e.target.value } })} />
              <Selecao rotulo="Resultado" value={f.recusa.resultado} disabled={!edita} onChange={(e) => setF({ ...f, recusa: { ...f.recusa, resultado: e.target.value as 'aprovado' | 'reprovado' } })}>
                <option value="aprovado">Aprovado</option><option value="reprovado">Reprovado</option>
              </Selecao>
              <Campo rotulo="Penalidade da recusa" value={f.recusa.penalidade} disabled={!edita} onChange={(e) => setF({ ...f, recusa: { ...f.recusa, penalidade: e.target.value } })} />
            </div>
            <div className="flex flex-wrap items-end gap-3 border-t border-m-stroke-subtle pt-3">
              <Campo rotulo="Contraprova depois de (minutos)" type="number" min={1} max={120} value={f.contraprova_minutos} disabled={!edita} onChange={(e) => setF({ ...f, contraprova_minutos: Number(e.target.value) })} />
              {edita && <Botao onClick={salvar}>Salvar configuração</Botao>}
            </div>
            <p className="text-[12px] text-m-text-muted">Cada evento guarda as faixas do dia em que começou: mudar aqui não altera o histórico.</p>
          </div>
        )}
      </Painel>
      <Aparelhos edita={edita} />
    </>
  );
}

const VAZIO_AP = { marca: '', modelo: '', numero_serie: '', calibracao_em: '', validade: '', ativo: true };

function Aparelhos({ edita }: { edita: boolean }) {
  const api = useApi();
  const confirmar = useConfirmar();
  const q = useAparelhos();
  const [form, setForm] = useState<typeof VAZIO_AP & { id?: number }>(VAZIO_AP);
  const [aberto, setAberto] = useState(false);
  const salvar = async () => {
    const corpo = { ...form, numero_serie: form.numero_serie || null, calibracao_em: form.calibracao_em || null, validade: form.validade || null };
    try {
      if (form.id) await api.put(`/preventivos/etilometro/aparelhos/${form.id}`, corpo); else await api.post('/preventivos/etilometro/aparelhos', corpo);
      toast.success('Aparelho salvo'); setForm(VAZIO_AP); setAberto(false);
    } catch (e) { toast.error((e as Error).message); }
  };
  const editar = (a: Aparelho) => { setForm({ id: a.id, marca: a.marca, modelo: a.modelo, numero_serie: a.numero_serie ?? '', calibracao_em: a.calibracao_em ?? '', validade: a.validade ?? '', ativo: a.ativo }); setAberto(true); };
  return (
    <Painel titulo="Aparelhos (etilômetros)" subtitulo="marca, modelo, série e calibração — aparelho vencido não inicia evento"
      acoes={edita && !aberto ? <Botao onClick={() => { setForm(VAZIO_AP); setAberto(true); }}><Plus size={16} /> Aparelho</Botao> : undefined}>
      {aberto && (
        <div className="mb-3 grid items-end gap-2 rounded-m-md border border-m-stroke-subtle p-3 md:grid-cols-6">
          <Campo rotulo="Marca" value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} />
          <Campo rotulo="Modelo" value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} />
          <Campo rotulo="Nº de série" value={form.numero_serie} onChange={(e) => setForm({ ...form, numero_serie: e.target.value })} />
          <Campo rotulo="Data da calibração" type="date" value={form.calibracao_em} onChange={(e) => setForm({ ...form, calibracao_em: e.target.value })} />
          <Campo rotulo="Validade da calibração" type="date" value={form.validade} onChange={(e) => setForm({ ...form, validade: e.target.value })} />
          <span className="flex gap-2"><Botao onClick={salvar}>Salvar</Botao><Botao variante="secundario" onClick={() => setAberto(false)}>Cancelar</Botao></span>
        </div>
      )}
      <Tabela cabecalho={['Aparelho', 'Nº de série', 'Calibração', 'Validade', 'Situação', '']} vazio={!(q.data ?? []).length && 'Nenhum aparelho cadastrado.'}>
        {(q.data ?? []).map((a) => (
          <tr key={a.id}>
            <td className={`${td} font-semibold text-m-text-primary`}>{a.marca} {a.modelo}</td>
            <td className={td}>{a.numero_serie ?? '—'}</td>
            <td className={td}>{dBR(a.calibracao_em)}</td>
            <td className={td}>{dBR(a.validade)}</td>
            <td className={td}>{!a.ativo ? <Pilula>desativado</Pilula> : a.vencido ? <Pilula tom="perigo">calibração vencida</Pilula> : <Pilula tom="sucesso">válido</Pilula>}</td>
            <td className={`${td} whitespace-nowrap text-right`}>
              {edita && <>
                <button type="button" className="mr-3 text-[13px] font-semibold text-m-accent" onClick={() => editar(a)}>Editar</button>
                <button type="button" className="mr-3 text-[13px] font-semibold text-m-text-secondary" onClick={async () => {
                  try { await api.put(`/preventivos/etilometro/aparelhos/${a.id}`, { ...a, ativo: !a.ativo }); } catch (e) { toast.error((e as Error).message); }
                }}>{a.ativo ? 'Desativar' : 'Ativar'}</button>
                <button type="button" className="text-[13px] font-semibold text-m-danger" onClick={async () => {
                  if (!(await confirmar({ titulo: `Excluir o aparelho ${a.marca} ${a.modelo}?`, mensagem: 'Aparelho já usado em eventos não sai — desative.' }))) return;
                  try { await api.del(`/preventivos/etilometro/aparelhos/${a.id}`); } catch (e) { toast.error((e as Error).message); }
                }}>Excluir</button>
              </>}
            </td>
          </tr>
        ))}
      </Tabela>
    </Painel>
  );
}
