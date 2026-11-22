'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, ChevronRight, ClipboardList, FilePlus2, FileSpreadsheet, Folder, FolderOpen, FolderPlus, HardDrive,
  type LucideIcon, Paperclip, Pencil, Ruler, RotateCcw, ScrollText, Send, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Carregando } from '@/components/Obra/Esqueleto';
import { MultiSelecao } from '@/components/Obra/MultiSelecao';
import { Botao, CARREGANDO, Campo, Chip, Painel, Pilula, Selecao, Tabela, td, tdNum } from '@/components/Obra/ui';
import { Link } from '@/i18n/navigation';
import { useApi } from '@/hooks/programacao/useApi';
import { type DocumentoResumo, nomeArquivo, type OpcoesDocumentos, type PastaDoc, type Pastas, SITUACAO } from '@/lib/documentos';
import { useObra } from '@/lib/obra/ObraProvider';

const ICONE: Record<string, LucideIcon> = { LIS: FileSpreadsheet, DES: Ruler, ESP: ScrollText, MEM: ScrollText, PRO: ClipboardList, IT: ClipboardList, NOR: BookOpen, OUT: Paperclip };
const icone = (p: PastaDoc) => ICONE[p.tipos[0]] ?? Folder;
const quando = (iso: string | null) => {
  if (!iso) return '—';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : dias < 30 ? `há ${dias} dias` : new Date(iso).toLocaleDateString('pt-BR');
};
const gb = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB` : `${(b / 1024 ** 2).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`);

type Form = { id?: number; nome: string; descricao: string; tipos: string[]; disciplinas: string; pacotes: string[]; natureza: string; responsavel: string; meio: string; local: string; retencao: string };
const NOVA = { nome: '', descricao: '', tipos: [] as string[], disciplinas: '', pacotes: [] as string[], natureza: 'documento', responsavel: '', meio: '', local: '', retencao: '' };

/**
 * Pastas de documentos (spec 129) — a organização do vídeo Growarq no Malhet: a obra recebe a cópia da pasta-modelo e cada
 * pasta é uma regra (tipo, disciplina, pacote), então nenhum arquivo é movido nem se perde; o código da obra abre o nome de todo
 * arquivo baixado (OBRA_CÓDIGO_Rrev_TE). Atalhos, tabela de pastas, "Sem pasta" com a sugestão, armazenamento e ações rápidas.
 */
export function PastasDocumentos({ opcoes, docs, onAbrir, onAcao }: {
  opcoes?: OpcoesDocumentos; docs: DocumentoResumo[]; onAbrir: (id: number) => void; onAcao: (a: 'enviar' | 'ldo' | 'grd') => void;
}) {
  const api = useApi();
  const qc = useQueryClient();
  const confirmar = useConfirmar();
  const { pode, obra } = useObra();
  const planejador = pode('planejador');
  const q = useQuery({ queryKey: ['documentos', 'pastas'], queryFn: () => api.get<Pastas>('/documentos/pastas') });
  const [aberta, setAberta] = useState<PastaDoc | 'sem' | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const atualizar = () => qc.invalidateQueries({ queryKey: ['documentos'] });
  const d = q.data;
  if (!d) return <Carregando />;
  if (aberta) return <PastaAberta pasta={aberta} onVoltar={() => setAberta(null)} onAbrir={onAbrir} />;

  const pacotes = [...new Set(docs.map((x) => x.pacote).filter((x): x is string => !!x))];
  const salvar = async () => {
    if (!form) return;
    const corpo = { nome: form.nome, descricao: form.descricao || null, tipos: form.tipos, pacotes: form.pacotes, natureza: form.natureza,
      responsavel: form.responsavel || null, meio: form.meio || null, local: form.local || null, retencao: form.retencao || null,
      disciplinas: form.disciplinas.split(/[,;]/).map((x) => x.trim()).filter(Boolean) };
    try {
      if (form.id) await api.put(`/documentos/pastas/${form.id}`, corpo); else await api.post('/documentos/pastas', corpo);
      toast.success(form.id ? 'Pasta atualizada' : 'Pasta criada'); setForm(null); atualizar();
    } catch (e) { toast.error((e as Error).message); }
  };
  const excluir = async (p: PastaDoc) => {
    if (!(await confirmar({ titulo: `Excluir a pasta ${p.codigo} · ${p.nome}?`, mensagem: 'A pasta é só a regra: nenhum documento é apagado. O que não couber em outra pasta aparece em "Sem pasta".' }))) return;
    await api.del(`/documentos/pastas/${p.id}`); atualizar();
  };
  const usoPct = d.armazenamento.limite ? Math.min(100, (d.armazenamento.obra / d.armazenamento.limite) * 100) : 0;
  const docPct = d.armazenamento.limite ? Math.min(100, (d.armazenamento.documentos / d.armazenamento.limite) * 100) : 0;
  const exemplo = docs.find((x) => x.vigente)?.vigente ? docs.find((x) => x.vigente)! : null;

  return (
    <div className="flex flex-col gap-5">
      {/* atalhos: cada pasta da obra em um cartão */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        {d.pastas.map((p) => {
          const I = icone(p);
          return (
            <button key={p.id} type="button" onClick={() => setAberta(p)}
              className="group flex min-h-[132px] flex-col gap-3 rounded-[18px] border border-m-stroke-subtle bg-m-surface-raised p-4 text-left transition hover:-translate-y-0.5 hover:border-m-accent hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-m-accent">
              <span className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-m-accent-subtle text-m-accent"><I size={20} strokeWidth={1.75} aria-hidden="true" /></span>
                <span className="font-mono text-[11px] text-m-text-muted">{p.codigo}</span>
              </span>
              <span className="text-[14px] font-semibold leading-5 text-m-text-primary">{p.nome}</span>
              <span className="mt-auto text-[12px] text-m-text-muted">{p.documentos} doc. · {p.vigentes} vigente(s) · {quando(p.ultima)}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 2xl:grid-cols-[1fr_360px]">
        <Painel titulo="Onde está cada documento?" subtitulo="Cada pasta é uma regra (tipo, disciplina, pacote): o documento aparece em toda pasta que cumpre, sem mover arquivo. A obra começa com a cópia da pasta-modelo do Malhet."
          acoes={<div className="flex flex-wrap gap-2">
            <Botao variante="secundario" onClick={() => api.download('/documentos/plano-arquivamento.xlsx', `${obra?.codigo ?? 'obra'}_Plano-de-arquivamento.xlsx`)}><FileSpreadsheet size={16} /> Plano de arquivamento</Botao>
            {planejador && <Botao variante="secundario" onClick={() => setForm({ ...NOVA })}><FolderPlus size={16} /> Nova pasta</Botao>}
          </div>}>
          {form && (
            <div className="mb-4 flex flex-col gap-3 rounded-[16px] border border-m-stroke-subtle bg-m-surface-base p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Campo rotulo="Nome da pasta" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Projetos civis" />
                <Campo rotulo="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="o que entra aqui" />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <MultiSelecao rotulo="Tipos" valor={form.tipos} comNa={false} largura="w-[240px]" onChange={(v) => setForm({ ...form, tipos: v })}
                  opcoes={Object.entries(opcoes?.tipos ?? {}).map(([k, v]) => ({ valor: k, rotulo: v }))} />
                <Campo rotulo="Disciplinas (sigla ou nome, vírgula)" value={form.disciplinas} onChange={(e) => setForm({ ...form, disciplinas: e.target.value })} placeholder="C, Elétrica" className="w-[240px]" />
                {pacotes.length > 0 && <MultiSelecao rotulo="Pacotes da LDO" valor={form.pacotes} comNa={false} largura="w-[240px]" onChange={(v) => setForm({ ...form, pacotes: v })}
                  opcoes={pacotes.map((p) => ({ valor: p, rotulo: p }))} />}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Selecao rotulo="Natureza" value={form.natureza} onChange={(e) => setForm({ ...form, natureza: e.target.value })}>
                  <option value="documento">Documento</option><option value="registro">Registro (evidência do que foi feito)</option>
                </Selecao>
                <Campo rotulo="Responsável pela guarda" value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} placeholder="Qualidade (CQ da obra)" />
                <Campo rotulo="Meio" value={form.meio} onChange={(e) => setForm({ ...form, meio: e.target.value })} placeholder="Digital — acervo da obra no Malhet" />
                <Campo rotulo="Local" value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} placeholder="Malhet · 70 Registros de solda" />
                <Campo rotulo="Retenção" value={form.retencao} onChange={(e) => setForm({ ...form, retencao: e.target.value })} placeholder="Na obra; depois no Data-Book pelo prazo do contrato" className="md:col-span-2" />
              </div>
              <div className="flex gap-2"><Botao onClick={salvar} disabled={form.nome.trim().length < 3}>Salvar pasta</Botao><Botao variante="fantasma" onClick={() => setForm(null)}>Cancelar</Botao></div>
            </div>
          )}
          <Tabela cabecalho={['Nome', 'Origem', 'Itens', 'Vigentes', 'Última revisão', '']} direita={[2, 3]} vazio={q.isLoading ? CARREGANDO : false}>
            {d.pastas.map((p) => {
              const I = icone(p);
              return (
                <tr key={p.id} className="cursor-pointer hover:bg-m-surface-hover" onClick={() => setAberta(p)}>
                  <td className={td}>
                    <span className="flex items-start gap-3">
                      <I size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-m-accent" aria-hidden="true" />
                      <span><b className="text-m-text-primary">{p.codigo} · {p.nome}</b>
                        {p.descricao && <span className="block text-[12px] text-m-text-muted">{p.descricao}</span>}
                        <span className="mt-1 flex flex-wrap gap-1">{[...p.tipos.map((t) => opcoes?.tipos[t] ?? t), ...p.disciplinas, ...p.pacotes].map((x) => <Pilula key={x} ponto={false}>{x}</Pilula>)}</span></span>
                    </span>
                  </td>
                  <td className={td}>{p.do_modelo ? <Pilula tom="info">Pasta-modelo</Pilula> : <Pilula tom="acento">Criada na obra</Pilula>}
                    <div className="mt-1 text-[11px] text-m-text-muted">{p.natureza === 'registro' ? 'Registro' : 'Documento'} · {p.responsavel}</div>
                    <div className="text-[11px] text-m-text-muted" title={p.retencao ?? ''}>{p.retencao}</div></td>
                  <td className={tdNum}>{p.documentos}</td>
                  <td className={tdNum}>{p.vigentes}</td>
                  <td className={td}>{quando(p.ultima)}</td>
                  <td className={`${td} whitespace-nowrap text-right`} onClick={(e) => e.stopPropagation()}>
                    {planejador && <>
                      <button type="button" aria-label={`Editar ${p.nome}`} className="p-1.5 text-m-text-muted hover:text-m-accent"
                        onClick={() => setForm({ id: p.id, nome: p.nome, descricao: p.descricao ?? '', tipos: p.tipos, disciplinas: p.disciplinas.join(', '), pacotes: p.pacotes, natureza: p.natureza, responsavel: p.responsavel ?? '', meio: p.meio ?? '', local: p.local ?? '', retencao: p.retencao ?? '' })}><Pencil size={15} /></button>
                      <button type="button" aria-label={`Excluir ${p.nome}`} className="p-1.5 text-m-text-muted hover:text-m-danger" onClick={() => excluir(p)}><Trash2 size={15} /></button>
                    </>}
                    <ChevronRight size={16} className="ml-1 inline text-m-text-muted" aria-hidden="true" />
                  </td>
                </tr>
              );
            })}
            {d.sem_pasta > 0 && (
              <tr className="cursor-pointer bg-m-warning-subtle/40 hover:bg-m-surface-hover" onClick={() => setAberta('sem')}>
                <td className={td}><span className="flex items-start gap-3"><Folder size={18} className="mt-0.5 text-m-warning" aria-hidden="true" />
                  <span><b className="text-m-text-primary">Sem pasta</b><span className="block text-[12px] text-m-text-muted">Documentos que não cumprem a regra de nenhuma pasta{d.sugestao ? ` — sugerida: ${d.sugestao.nome}` : ''}</span></span></span></td>
                <td className={td}><Pilula tom="atencao">Sugerida</Pilula></td>
                <td className={tdNum}>{d.sem_pasta}</td><td className={tdNum}>—</td><td className={td}>—</td>
                <td className={`${td} text-right`} onClick={(e) => e.stopPropagation()}>
                  {planejador && d.sugestao && <Botao variante="secundario" className="h-8 px-3" onClick={() => setForm({ ...NOVA, nome: d.sugestao!.nome, tipos: d.sugestao!.tipos })}>Criar pasta</Botao>}
                </td>
              </tr>
            )}
          </Tabela>
          {planejador && d.faltam_do_modelo.length > 0 && (
            <button type="button" className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-m-accent"
              onClick={async () => { const r = await api.post<{ restauradas: number }>('/documentos/pastas/restaurar'); toast.success(`${r.restauradas} pasta(s) do modelo de volta`); atualizar(); }}>
              <RotateCcw size={14} /> Restaurar do modelo: {d.faltam_do_modelo.join(', ')}
            </button>
          )}
        </Painel>

        <div className="flex flex-col gap-4">
          <section className="rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13px] font-semibold"><HardDrive size={16} className="text-m-accent" aria-hidden="true" /> Armazenamento</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">{Math.round(usoPct)}% usado</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-m-surface-base" role="img" aria-label={`Documentos ${gb(d.armazenamento.documentos)}, obra ${gb(d.armazenamento.obra)} de ${gb(d.armazenamento.limite)}`}>
              <div className="flex h-full">
                <div className="h-full bg-m-accent-strong" style={{ width: `${docPct}%` }} />
                <div className="h-full bg-m-accent/35" style={{ width: `${Math.max(0, usoPct - docPct)}%` }} />
              </div>
            </div>
            <p className="mt-2 text-[12px] text-m-text-muted">Documentos {gb(d.armazenamento.documentos)} · obra toda {gb(d.armazenamento.obra)} de {gb(d.armazenamento.limite)}</p>
            {pode('admin') && <Link href="/app/armazenamento" className="mt-3 inline-block text-[13px] font-semibold text-m-accent">Gerenciar armazenamento</Link>}
          </section>

          {planejador && (
            <section className="rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-5">
              <div className="mb-3 text-[13px] font-semibold">Ações rápidas</div>
              <div className="grid grid-cols-2 gap-2">
                {([['enviar', Upload, 'Enviar revisão', 'DWG, DXF, PDF'], ['ldo', FilePlus2, 'Importar LDO', 'planilha do contrato'],
                  ['grd', Send, 'Nova GRD', 'recebida ou emitida'], ['pasta', FolderPlus, 'Nova pasta', 'por tipo ou pacote']] as const).map(([k, I, t, sub]) => (
                  <button key={k} type="button" onClick={() => (k === 'pasta' ? setForm({ ...NOVA }) : onAcao(k))}
                    className="flex flex-col items-start gap-1 rounded-[14px] border border-m-stroke-subtle p-3 text-left hover:border-m-accent hover:bg-m-surface-hover">
                    <I size={18} strokeWidth={1.75} className="text-m-accent" aria-hidden="true" />
                    <span className="text-[13px] font-semibold text-m-text-primary">{t}</span>
                    <span className="text-[11px] text-m-text-muted">{sub}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-5">
            <div className="text-[13px] font-semibold">Como nomeamos os arquivos</div>
            <p className="mt-1 text-[12px] text-m-text-muted">Todo arquivo baixado sai com o código da obra na frente — fácil de achar no e-mail, no drive ou na pasta do cliente.</p>
            <div className="mt-3 flex flex-wrap gap-1 font-mono text-[12px]">
              {['OBRA', 'CÓDIGO DO DOCUMENTO', 'R + REVISÃO', 'TE'].map((x, i) => <span key={x} className="flex items-center gap-1">{i > 0 && <span className="text-m-text-muted">_</span>}<span className="rounded-[6px] bg-m-accent-subtle px-1.5 py-0.5 text-m-accent">{x}</span></span>)}
            </div>
            {exemplo?.vigente && <p className="mt-2 break-all font-mono text-[12px] text-m-text-secondary">{nomeArquivo(obra?.codigo, exemplo.codigo, exemplo.vigente.revisao, exemplo.vigente.finalidade, 'pdf')}</p>}
            <p className="mt-2 text-[11px] text-m-text-muted">TE = letra do tipo de emissão (E para construção, G conforme construído…). No acervo, cada revisão guarda também a ficha .md com as ligações.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Dentro da pasta: subpastas por pacote e por disciplina, e os documentos com a revisão que vale. */
function PastaAberta({ pasta, onVoltar, onAbrir }: { pasta: PastaDoc | 'sem'; onVoltar: () => void; onAbrir: (id: number) => void }) {
  const api = useApi();
  const id = pasta === 'sem' ? 0 : pasta.id;
  const q = useQuery({ queryKey: ['documentos', 'pasta', id], queryFn: () => api.get<DocumentoResumo[]>(`/documentos?pasta_id=${id}`) });
  const [pacote, setPacote] = useState('');
  const [disc, setDisc] = useState('');
  const docs = q.data ?? [];
  const pacotes = [...new Set(docs.map((d) => d.pacote).filter((x): x is string => !!x))];
  const discs = [...new Set(docs.map((d) => d.disciplina).filter((x): x is string => !!x))].sort();
  const vis = docs.filter((d) => (!pacote || d.pacote === pacote) && (!disc || d.disciplina === disc));
  const nome = pasta === 'sem' ? 'Sem pasta' : `${pasta.codigo} · ${pasta.nome}`;
  return (
    <Painel titulo={nome}
      subtitulo={pasta === 'sem' ? 'Documentos que não cumprem a regra de nenhuma pasta.' : pasta.descricao ?? undefined}
      acoes={<Botao variante="secundario" onClick={onVoltar}><ArrowLeft size={16} /> Pastas</Botao>}>
      <nav aria-label="Trilha da pasta" className="mb-3 flex items-center gap-1 text-[12px] text-m-text-muted">
        <button type="button" onClick={onVoltar} className="hover:text-m-accent">Pastas</button><ChevronRight size={12} />
        <FolderOpen size={13} className="text-m-accent" aria-hidden="true" /><span className="text-m-text-primary">{nome}</span>{pacote && <><ChevronRight size={12} /><span>{pacote}</span></>}{disc && <><ChevronRight size={12} /><span>{disc}</span></>}
      </nav>
      {pacotes.length > 1 && (
        <div className="mb-2 flex flex-wrap items-center gap-2"><span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Pacote</span>
          <Chip ativo={!pacote} onClick={() => setPacote('')}>Todos</Chip>
          {pacotes.map((p) => <Chip key={p} ativo={pacote === p} onClick={() => setPacote(p)}><Folder size={13} className="mr-1 inline" />{p} ({docs.filter((d) => d.pacote === p).length})</Chip>)}
        </div>
      )}
      {discs.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-2"><span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Disciplina</span>
          <Chip ativo={!disc} onClick={() => setDisc('')}>Todas</Chip>
          {discs.map((x) => <Chip key={x} ativo={disc === x} onClick={() => setDisc(x)}>{x}</Chip>)}
        </div>
      )}
      <Tabela cabecalho={['Código', 'Título', 'Vale no campo', 'Última revisão']} vazio={q.isLoading ? CARREGANDO : !vis.length && 'Pasta vazia.'}>
        {vis.map((d) => (
          <tr key={d.id} className="cursor-pointer hover:bg-m-surface-hover" onClick={() => onAbrir(d.id)}>
            <td className={td}><b className="text-m-text-primary">{d.codigo}</b>{d.disciplina && <div className="text-[11px] text-m-text-muted">{d.disciplina}</div>}</td>
            <td className={td}>{d.titulo}{d.local_texto && <div className="text-[11px] text-m-text-muted">{d.local_texto}</div>}</td>
            <td className={td}>{d.vigente ? <Pilula tom="sucesso">Rev. {d.vigente.revisao}</Pilula> : <Pilula tom="atencao">Sem liberada</Pilula>}</td>
            <td className={td}>{d.ultima ? <>Rev. {d.ultima.revisao} <Pilula tom={SITUACAO[d.ultima.situacao].tom}>{SITUACAO[d.ultima.situacao].rotulo}</Pilula></> : '—'}</td>
          </tr>
        ))}
      </Tabela>
    </Painel>
  );
}
