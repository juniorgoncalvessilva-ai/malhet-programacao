'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowUpFromLine, FileUp, History, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Abas } from '@/components/Obra/Abas';
import { BuscaEfetivo } from '@/components/Obra/BuscaEfetivo';
import { Calculado, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { LinhasCarregando } from '@/components/Obra/Esqueleto';
import { Botao, Cabecalho, Campo, Chip, Indicador, Painel, Pilula, Selecao, Tabela, dataBR, td, tdNum } from '@/components/Obra/ui';
import { useEfetivo } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';

interface Equipamento {
  id: number; nome: string; tipo: string | null; placa: string | null; tag: string | null; chassi: string | null;
  operador: { id: number; nome: string; matricula: string | null; funcao: string | null } | null; operador_texto: string | null;
  situacao: 'mobilizado' | 'desmobilizado' | 'nao_mobilizado'; situacao_nome: string; mobilizado_em: string | null; desmobilizado_em: string | null;
  dias: number | null; memoria: MemoriaCalculo | null; observacao: string | null; na_ultima_planilha: boolean;
  dia: { situacao: string; situacao_nome: string; horas: number | null; observacao: string | null; por: string } | null;
}
interface Lista { data: string; itens: Equipamento[]; totais: Record<string, number> }
interface Movimento { id: number; tipo: string; data: string; texto: string | null; por: string }
interface PreviaItem { linha: number; nome: string; tag: string | null; placa: string | null; tipo: string | null; operador: string | null; situacao: string;
  mobilizado_em: string | null; acao: 'novo' | 'atualiza' | 'situacao'; operador_ligado: { nome: string } | null; sugestoes: { nome: string; funcao: string | null }[] }
interface Previa { itens: PreviaItem[]; avisos: string[]; novos: number; atualizados: number; mudam_situacao: number; operadores_ligados: number;
  operadores_pendentes: number; fora_da_planilha: string[] }

const TOM = { mobilizado: 'sucesso', desmobilizado: 'neutro', nao_mobilizado: 'atencao' } as const;
const NOME_SIT = { mobilizado: 'Mobilizado', desmobilizado: 'Desmobilizado', nao_mobilizado: 'Ainda não mobilizado' } as const;
const MOV = { cadastro: 'Cadastro', mobilizacao: 'Mobilização', desmobilizacao: 'Desmobilização', operador: 'Operador' } as Record<string, string>;
const hoje = () => new Date().toLocaleDateString('sv-SE');

/**
 * Equipamentos da obra (spec 147): cadastro pela planilha (TAG é a chave), o operador escolhido no efetivo, mobilização e
 * desmobilização com histórico, e o dia de cada equipamento apontado pelo apontador no campo.
 */
export default function EquipamentosPage() {
  const api = useApi();
  const { pode } = useObra();
  const planejador = pode('planejador');
  const confirmar = useConfirmar();
  const efetivo = useEfetivo();
  const [aba, setAba] = useState<'lista' | 'importar'>('lista');
  const [filtro, setFiltro] = useState<'todos' | Equipamento['situacao']>('mobilizado');
  const [busca, setBusca] = useState('');
  const [operadorDe, setOperadorDe] = useState<number | null>(null);
  const [movendo, setMovendo] = useState<{ e: Equipamento; para: 'mobilizar' | 'desmobilizar' } | null>(null);
  const [historico, setHistorico] = useState<number | null>(null);
  const [novo, setNovo] = useState(false);
  const q = useQuery({ queryKey: ['equipamentos'], queryFn: () => api.get<Lista>('/equipamentos') });
  const movs = useQuery({ queryKey: ['equipamentos', 'movimentos', historico], enabled: historico != null,
    queryFn: () => api.get<Movimento[]>(`/equipamentos/${historico}/movimentos`) });
  const itens = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (q.data?.itens ?? []).filter((e) => (filtro === 'todos' || e.situacao === filtro)
      && (!t || [e.tag, e.placa, e.nome, e.tipo, e.operador?.nome, e.operador_texto, e.chassi].some((x) => x?.toLowerCase().includes(t))));
  }, [q.data, filtro, busca]);
  const tot = q.data?.totais ?? {};
  const exec = async (p: Promise<unknown>, ok: string) => { try { await p; toast.success(ok); return true; } catch (e) { toast.error((e as Error).message); return false; } };

  return (
    <>
      <Cabecalho eyebrow="Pessoas e equipes · equipamentos" cor="var(--m-proc-executar)"
        titulo={q.data ? `${tot.mobilizado ?? 0} equipamento(s) na obra, ${tot.apontados ?? 0} apontado(s) hoje` : 'Equipamentos'}
        acoes={planejador && <Botao onClick={() => setNovo(true)}><Plus size={16} /> Novo equipamento</Botao>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Indicador rotulo="Mobilizados" valor={tot.mobilizado ?? '—'} tom="sucesso" />
        <Indicador rotulo="Ainda não mobilizados" valor={tot.nao_mobilizado ?? '—'} />
        <Indicador rotulo="Desmobilizados" valor={tot.desmobilizado ?? '—'} />
        <Indicador rotulo="Sem operador" valor={tot.sem_operador ?? '—'} tom={tot.sem_operador ? 'atencao' : undefined} detalhe="entre os mobilizados" />
        <Indicador rotulo="Sem apontamento hoje" valor={tot.sem_apontamento ?? '—'} tom={tot.sem_apontamento ? 'atencao' : undefined} detalhe="o apontador marca no celular" />
      </div>
      <Abas rotulo="Equipamentos" ativa={aba} onTrocar={setAba}
        abas={[{ chave: 'lista', titulo: `Equipamentos (${tot.total ?? 0})` }, { chave: 'importar', titulo: 'Importar planilha', visivel: planejador }]} />

      {aba === 'importar' && planejador && <Importar onPronto={() => setAba('lista')} />}

      {aba === 'lista' && (
        <Painel titulo="Quais equipamentos estão na obra?" subtitulo="Clique no operador para escolher a pessoa no efetivo; mobilize ou desmobilize com a data (vai para o histórico)."
          acoes={<div className="flex flex-wrap items-end gap-2">
            {(['mobilizado', 'nao_mobilizado', 'desmobilizado', 'todos'] as const).map((k) => (
              <Chip key={k} ativo={filtro === k} onClick={() => setFiltro(k)}>{k === 'todos' ? 'Todos' : NOME_SIT[k]}</Chip>
            ))}
            <Campo rotulo="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="TAG, placa, operador…" />
          </div>}>
          <Tabela cabecalho={['TAG / placa', 'Equipamento', 'Operador', 'Situação', 'Na obra', 'Hoje', '']} direita={[4]}
            vazio={q.data && !itens.length ? 'Nenhum equipamento com esse filtro.' : undefined}>
            {!q.data && <LinhasCarregando colunas={7} linhas={5} />}
            {itens.map((e) => (
              <tr key={e.id}>
                <td className={td}><b className="text-m-text-primary">{e.tag ?? e.placa}</b>{e.placa && e.tag !== e.placa && <span className="block text-xs text-m-text-muted">placa {e.placa}</span>}</td>
                <td className={td}>{e.nome}<span className="block text-xs text-m-text-muted">{[e.tipo, e.chassi && `chassi ${e.chassi}`].filter(Boolean).join(' · ')}</span></td>
                <td className={`${td} min-w-[220px]`}>
                  {operadorDe === e.id ? (
                    <div className="flex items-end gap-1">
                      <BuscaEfetivo rotulo="Operador" className="w-[260px]" pessoas={efetivo.data ?? []} prioridade={/OPERADOR|MOTORISTA/i}
                        placeholder={e.operador_texto ? `planilha: ${e.operador_texto}` : 'nome ou matrícula'}
                        onEscolher={async (p) => { if (await exec(api.put(`/equipamentos/${e.id}/operador`, { colaborador_id: p.id }), `${p.nome} é o operador de ${e.tag ?? e.nome}`)) setOperadorDe(null); }} />
                      <button type="button" aria-label="Cancelar" className="rounded-full p-2 text-m-text-muted" onClick={() => setOperadorDe(null)}><X size={16} /></button>
                    </div>
                  ) : (
                    <button type="button" disabled={!planejador} onClick={() => setOperadorDe(e.id)} className="text-left disabled:cursor-default">
                      {e.operador ? <><span className="font-medium text-m-text-primary">{e.operador.nome}</span><span className="block text-xs text-m-text-muted">{[e.operador.matricula, e.operador.funcao].filter(Boolean).join(' · ')}</span></>
                        : <span className="text-m-warning">{e.operador_texto ? `${e.operador_texto} — ligar ao efetivo` : 'sem operador'}</span>}
                    </button>
                  )}
                </td>
                <td className={td}><Pilula tom={TOM[e.situacao]}>{e.situacao_nome}</Pilula>
                  <span className="block text-xs text-m-text-muted">{e.situacao === 'desmobilizado' ? `até ${dataBR(e.desmobilizado_em)}` : e.mobilizado_em ? `desde ${dataBR(e.mobilizado_em)}` : ''}</span></td>
                <td className={tdNum}>{e.dias != null && e.memoria ? <Calculado chave="dias" memoria={() => e.memoria as MemoriaCalculo}>{`${e.dias} d`}</Calculado> : '—'}</td>
                <td className={td}>{e.dia ? <span title={e.dia.observacao ?? undefined}>{e.dia.situacao_nome}{e.dia.horas != null ? ` · ${e.dia.horas} h` : ''}</span>
                  : e.situacao === 'mobilizado' ? <span className="text-m-text-muted">não apontado</span> : '—'}</td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  <div className="inline-flex gap-1">
                    {planejador && e.situacao !== 'mobilizado' && <button type="button" title="Mobilizar" aria-label={`Mobilizar ${e.tag ?? e.nome}`} onClick={() => setMovendo({ e, para: 'mobilizar' })}
                      className="rounded-full p-2 text-m-success hover:bg-m-surface-hover"><ArrowDownToLine size={16} /></button>}
                    {planejador && e.situacao === 'mobilizado' && <button type="button" title="Desmobilizar" aria-label={`Desmobilizar ${e.tag ?? e.nome}`} onClick={() => setMovendo({ e, para: 'desmobilizar' })}
                      className="rounded-full p-2 text-m-text-muted hover:bg-m-surface-hover hover:text-m-text-primary"><ArrowUpFromLine size={16} /></button>}
                    <button type="button" title="Histórico" aria-label={`Histórico de ${e.tag ?? e.nome}`} onClick={() => setHistorico(historico === e.id ? null : e.id)}
                      className="rounded-full p-2 text-m-text-muted hover:bg-m-surface-hover hover:text-m-text-primary"><History size={16} /></button>
                    {planejador && <button type="button" title="Excluir" aria-label={`Excluir ${e.tag ?? e.nome}`} className="rounded-full p-2 text-m-text-muted hover:bg-m-surface-hover hover:text-m-danger"
                      onClick={async () => { if (await confirmar({ titulo: `Excluir ${e.tag ?? e.nome}?`, mensagem: 'Só sai se nunca teve dia apontado; senão, desmobilize.' })) await exec(api.del(`/equipamentos/${e.id}`), 'Equipamento excluído'); }}><Trash2 size={16} /></button>}
                  </div>
                  {historico === e.id && (
                    <ul className="mt-2 flex min-w-[300px] flex-col gap-1 text-left text-xs">
                      {(movs.data ?? []).map((m) => <li key={m.id}><b>{dataBR(m.data)} · {MOV[m.tipo] ?? m.tipo}</b> — {m.texto ?? ''} <span className="text-m-text-muted">({m.por})</span></li>)}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </Tabela>
        </Painel>
      )}
      {movendo && <Movimentar {...movendo} onFechar={() => setMovendo(null)}
        onSalvar={async (data, texto) => { if (await exec(api.post(`/equipamentos/${movendo.e.id}/${movendo.para}`, { data, texto: texto || null }),
          movendo.para === 'mobilizar' ? 'Equipamento mobilizado' : 'Equipamento desmobilizado')) setMovendo(null); }} />}
      {novo && <NovoEquipamento onFechar={() => setNovo(false)} onSalvar={async (d) => { if (await exec(api.post('/equipamentos', d), 'Equipamento cadastrado')) setNovo(false); }} />}
    </>
  );
}

function Janela({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="flex w-full max-w-[440px] flex-col gap-3 rounded-m-xl border border-m-stroke-subtle bg-m-surface-raised p-5">
        <div className="flex items-start gap-3"><h2 className="flex-1 text-[17px] font-semibold">{titulo}</h2>
          <button type="button" aria-label="Fechar" onClick={onFechar} className="rounded-full p-1.5 text-m-text-muted hover:bg-m-surface-hover"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

function Movimentar({ e, para, onFechar, onSalvar }: { e: Equipamento; para: 'mobilizar' | 'desmobilizar'; onFechar: () => void; onSalvar: (data: string, texto: string) => Promise<void> }) {
  const [data, setData] = useState(hoje());
  const [texto, setTexto] = useState('');
  return (
    <Janela titulo={`${para === 'mobilizar' ? 'Mobilizar' : 'Desmobilizar'} ${e.tag ?? e.nome}`} onFechar={onFechar}>
      <Campo rotulo="Data" type="date" value={data} max={hoje()} onChange={(ev) => setData(ev.target.value)} />
      <Campo rotulo="Observação (opcional)" value={texto} maxLength={300} onChange={(ev) => setTexto(ev.target.value)} placeholder={para === 'mobilizar' ? 'ex.: chegou na carreta' : 'ex.: fim do contrato de locação'} />
      <Botao disabled={!data} onClick={() => void onSalvar(data, texto)}>{para === 'mobilizar' ? 'Mobilizar' : 'Desmobilizar'}</Botao>
    </Janela>
  );
}

function NovoEquipamento({ onFechar, onSalvar }: { onFechar: () => void; onSalvar: (d: Record<string, string | null>) => Promise<void> }) {
  const [f, setF] = useState({ nome: '', tipo: 'Maquinário', tag: '', placa: '', chassi: '' });
  return (
    <Janela titulo="Novo equipamento" onFechar={onFechar}>
      <Campo rotulo="Nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="ex.: ESCAVADEIRA HIDRÁULICA ME-30" />
      <Selecao rotulo="Tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
        <option>Maquinário</option><option>Veículo Leve</option><option>Veículo Pesado</option><option>Equipamento</option>
      </Selecao>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="TAG" value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} />
        <Campo rotulo="Placa" value={f.placa} onChange={(e) => setF({ ...f, placa: e.target.value })} />
      </div>
      <Campo rotulo="Chassi / série" value={f.chassi} onChange={(e) => setF({ ...f, chassi: e.target.value })} />
      <p className="text-[12.5px] text-m-text-tertiary">Entra como “ainda não mobilizado”: mobilize com a data de chegada.</p>
      <Botao disabled={f.nome.trim().length < 2 || !(f.tag.trim() || f.placa.trim() || f.chassi.trim())}
        onClick={() => void onSalvar({ nome: f.nome, tipo: f.tipo, tag: f.tag || null, placa: f.placa || null, chassi: f.chassi || null })}>Cadastrar</Botao>
    </Janela>
  );
}

function Importar({ onPronto }: { onPronto: () => void }) {
  const api = useApi();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [enviando, setEnviando] = useState(false);
  const enviar = async (gravar: boolean) => {
    if (!arquivo) return;
    const fd = new FormData();
    fd.append('arquivo', arquivo);
    setEnviando(true);
    try {
      if (!gravar) { setPrevia(await api.post<Previa>('/equipamentos/planilha/previa', fd)); return; }
      const r = await api.post<{ novos: number; atualizados: number; operadores_ligados: number }>('/equipamentos/planilha', fd);
      toast.success(`${r.novos} novo(s), ${r.atualizados} atualizado(s), ${r.operadores_ligados} operador(es) ligado(s) ao efetivo`);
      setPrevia(null); setArquivo(null); onPronto();
    } catch (e) { toast.error((e as Error).message); } finally { setEnviando(false); }
  };
  return (
    <Painel titulo="De onde vêm os equipamentos?" subtitulo="A planilha de equipamentos da obra: Nome do Equipamento, Operadores, Tipo, Placa, TAG, Chassi, Mobilizado e Data mobilização. A TAG é a chave — reimportar atualiza, não duplica e não apaga. O operador só liga sozinho ao efetivo quando um único operador/motorista tem aquele nome; os outros você escolhe na lista.">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[12px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Planilha (.xlsx)
          <input type="file" accept=".xlsx,.xlsm" onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); setPrevia(null); }}
            className="h-10 rounded-m-md border border-dashed border-m-stroke-strong bg-m-surface-field px-2 py-2 text-[13px] font-normal normal-case tracking-normal text-m-text-secondary file:mr-3 file:rounded-full file:border-0 file:bg-m-accent-subtle file:px-3 file:py-1 file:text-xs file:font-semibold file:text-m-accent" />
        </label>
        <Botao variante="secundario" disabled={!arquivo || enviando} onClick={() => void enviar(false)}><FileUp size={16} /> Conferir antes</Botao>
        {previa && <Botao disabled={enviando} onClick={() => void enviar(true)}>{enviando ? 'Importando…' : `Importar ${previa.itens.length} equipamento(s)`}</Botao>}
      </div>
      {previa && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Indicador rotulo="Novos" valor={previa.novos} />
            <Indicador rotulo="Atualizados" valor={previa.atualizados} />
            <Indicador rotulo="Mudam de situação" valor={previa.mudam_situacao} tom={previa.mudam_situacao ? 'atencao' : undefined} />
            <Indicador rotulo="Operador ligado" valor={previa.operadores_ligados} tom="sucesso" />
            <Indicador rotulo="Operador a escolher" valor={previa.operadores_pendentes} tom={previa.operadores_pendentes ? 'atencao' : undefined} />
          </div>
          {previa.avisos.map((a) => <p key={a} className="text-[13px] text-m-warning">{a}</p>)}
          {!!previa.fora_da_planilha.length && <p className="text-[13px] text-m-text-tertiary">Cadastrados que não estão nesta planilha (ficam como estão): {previa.fora_da_planilha.join(', ')}</p>}
          <Tabela cabecalho={['Linha', 'TAG / placa', 'Equipamento', 'Operador', 'Situação', 'O que muda']} direita={[0]}>
            {previa.itens.map((i) => (
              <tr key={i.linha}>
                <td className={tdNum}>{i.linha}</td>
                <td className={td}><b>{i.tag ?? i.placa}</b></td>
                <td className={td}>{i.nome}<span className="block text-xs text-m-text-muted">{i.tipo}</span></td>
                <td className={td}>{i.operador_ligado ? <span className="text-m-success">{i.operador_ligado.nome}</span>
                  : i.operador ? <span className="text-m-warning">{i.operador}{i.sugestoes.length ? ` — talvez ${i.sugestoes.slice(0, 2).map((s) => s.nome).join(' ou ')}` : ' — não achei no efetivo'}</span> : '—'}</td>
                <td className={td}>{NOME_SIT[i.situacao as keyof typeof NOME_SIT] ?? i.situacao}{i.mobilizado_em ? ` · ${dataBR(i.mobilizado_em)}` : ''}</td>
                <td className={td}>{i.acao === 'novo' ? <Pilula tom="info">novo</Pilula> : i.acao === 'situacao' ? <Pilula tom="atencao">muda a situação</Pilula> : <Pilula>atualiza</Pilula>}</td>
              </tr>
            ))}
          </Tabela>
        </div>
      )}
    </Painel>
  );
}
