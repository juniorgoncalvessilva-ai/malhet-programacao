'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Eye, Link2, Pencil, Ruler, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { VerRevisao } from '@/components/Documentos/VerRevisao';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Carregando } from '@/components/Obra/Esqueleto';
import { Botao, Campo, Pilula, Selecao } from '@/components/Obra/ui';
import { useCatalogo, useFrentes2 } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import { ALVO, nomeArquivo, type DocumentoDetalhe, type DocumentoResumo, type OpcoesDocumentos, type RevisaoDoc, SITUACAO } from '@/lib/documentos';
import { useObra } from '@/lib/obra/ObraProvider';

const dataBR = (iso: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR') : '—');
const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

/** Detalhe do documento (spec 123): revisões com a situação, ligações Zettelkasten (e quem cita este), GRDs e leituras. */
export function DetalheDocumento({ id, opcoes, documentos, onFechar, onAbrir }: {
  id: number; opcoes?: OpcoesDocumentos; documentos: DocumentoResumo[]; onFechar: () => void; onAbrir: (id: number) => void;
}) {
  const api = useApi();
  const qc = useQueryClient();
  const confirmar = useConfirmar();
  const { pode, obra } = useObra();
  const planejador = pode('planejador');
  const q = useQuery({ queryKey: ['documentos', id], queryFn: () => api.get<DocumentoDetalhe>(`/documentos/${id}`) });
  const frentes = useFrentes2();
  const catalogo = useCatalogo();
  const [ver, setVer] = useState<RevisaoDoc | null>(null);
  const [editar, setEditar] = useState(false);
  const [lig, setLig] = useState({ relacao: 'aplica_a', alvo_tipo: 'area', alvo_id: '' });
  const d = q.data;
  const atualizar = () => { qc.invalidateQueries({ queryKey: ['documentos'] }); };
  const arquivo = (r: RevisaoDoc, formato: string) => () => api.blob(`/documentos/revisoes/${r.id}/arquivo?formato=${formato}`);
  const alvos: { id: number; rotulo: string }[] = lig.alvo_tipo === 'area'
    ? (frentes.data ?? []).flatMap((l) => l.areas.map((a) => ({ id: a.id, rotulo: `${a.codigo} · ${a.descricao}` })))
    : lig.alvo_tipo === 'grupo' ? (catalogo.data ?? []).map((g) => ({ id: g.id, rotulo: `${g.numero} · ${g.descricao}` }))
      : documentos.filter((x) => x.id !== id).map((x) => ({ id: x.id, rotulo: `${x.codigo} · ${x.titulo}` }));

  const ligar = async () => {
    if (!lig.alvo_id) return;
    try {
      await api.post(`/documentos/${id}/vinculos`, { relacao: lig.relacao, alvo_tipo: lig.alvo_tipo, alvo_id: Number(lig.alvo_id) });
      toast.success('Ligação criada'); setLig({ ...lig, alvo_id: '' }); atualizar();
    } catch (e) { toast.error((e as Error).message); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/30" onClick={onFechar}>
      <aside role="dialog" aria-label="Documento" onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-[760px] flex-col overflow-y-auto bg-m-surface-base p-5 shadow-xl">
        {!d ? <Carregando /> : (
          <div className="flex flex-col gap-5">
            <header className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">{d.tipo_nome}{d.disciplina ? ` · ${d.disciplina}` : ''}</div>
                <h2 className="text-[20px] font-semibold leading-7">{d.codigo}</h2>
                <p className="text-[14px] text-m-text-secondary">{d.titulo}</p>
                {d.codigo_contratada && <p className="text-[12px] text-m-text-muted">Contratada: {d.codigo_contratada}{d.projeto ? ` · ${d.projeto}` : ''}</p>}
                {(d.pacote || d.local_texto) && <p className="text-[12px] text-m-text-muted">{[d.pacote && `Pacote ${d.pacote}`, d.local_texto && `Local na LDO: ${d.local_texto}`].filter(Boolean).join(' · ')}</p>}
              </div>
              {planejador && <Botao variante="secundario" onClick={() => setEditar(!editar)}><Pencil size={15} /> Editar</Botao>}
              <button type="button" aria-label="Fechar" onClick={onFechar} className="grid h-10 w-10 place-items-center rounded-full hover:bg-m-surface-hover"><X size={20} /></button>
            </header>

            {editar && <EditarDocumento d={d} opcoes={opcoes} onPronto={() => { setEditar(false); atualizar(); }} />}

            <section className="rounded-[16px] border border-m-stroke-subtle bg-m-surface-raised p-4">
              <div className="mb-2 text-[13px] font-semibold">Qual revisão vale no campo?</div>
              {d.vigente ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Pilula tom="sucesso">Rev. {d.vigente.revisao} · {d.vigente.finalidade}</Pilula>
                  <span className="text-[13px] text-m-text-muted">{dataBR(d.vigente.data_emissao)}</span>
                  {d.vigente.formatos.length > 0
                    ? <Botao onClick={() => setVer(d.vigente)}><Eye size={15} /> Ver a folha</Botao>
                    : <span className="text-[13px] text-m-warning">Revisão listada na LDO, arquivo ainda não enviado</span>}
                </div>
              ) : <p className="text-[13px] text-m-warning">Nenhuma revisão liberada para o campo (para construção / aprovado).</p>}
            </section>

            <section>
              <div className="mb-2 text-[13px] font-semibold">Revisões</div>
              <table className="w-full text-[13px]">
                <thead><tr className="text-left text-[11px] uppercase tracking-[0.4px] text-m-text-muted"><th className="py-1">Rev.</th><th>Finalidade</th><th>Data</th><th>Situação</th><th>Enviada</th><th /></tr></thead>
                <tbody>
                  {d.historico.map((r) => (
                    <tr key={r.id} className="border-t border-m-row align-top">
                      <td className="py-2 font-semibold">{r.revisao}</td>
                      <td className="py-2">{r.finalidade}
                        {r.motivo && <div className="text-[11px] text-m-text-secondary">Motivo: {r.motivo}</div>}
                        {(r.ldo || r.apresentado != null) && <div className="text-[11px] text-m-text-muted">{[r.ldo && `na ${r.ldo}${r.ldo_enviada_em ? ` (enviada ${dataBR(r.ldo_enviada_em)})` : ''}`, r.apresentado != null && (r.apresentado ? `apresentado${r.apresentado_para ? ` a ${r.apresentado_para}` : ''}` : 'não apresentado')].filter(Boolean).join(' · ')}</div>}
                        {r.avisos.length > 0 && <div className="text-[11px] text-m-warning">{r.avisos.join(' · ')}</div>}{r.tags.length > 0 && <div className="text-[11px] text-m-text-muted">TAGs: {r.tags.join(', ')}</div>}</td>
                      <td className="py-2">{dataBR(r.data_emissao)}</td>
                      <td className="py-2"><Pilula tom={SITUACAO[r.situacao].tom}>{SITUACAO[r.situacao].rotulo}</Pilula></td>
                      <td className="py-2 text-[12px] text-m-text-muted">{r.enviado_por}<div>{quando(r.enviado_em)}</div></td>
                      <td className="py-2 text-right">{r.formatos.length > 0 && <button type="button" onClick={() => setVer(r)} className="font-semibold text-m-accent">ver</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold"><Link2 size={15} /> Ligações (onde se aplica e o que referencia)</div>
              {!d.vinculos.length && <p className="text-[13px] text-m-text-muted">Sem ligações. Ligue à frente para o documento aparecer para o encarregado.</p>}
              <ul className="flex flex-col gap-1.5">
                {d.vinculos.map((v) => (
                  <li key={v.id} className="flex items-center gap-2 rounded-[10px] border border-m-stroke-subtle px-3 py-2 text-[13px]">
                    <span className="text-m-text-muted">{v.relacao_nome}</span>
                    <span className="text-[11px] uppercase text-m-text-muted">{ALVO[v.alvo_tipo]}</span>
                    {v.alvo_tipo === 'documento' ? <button type="button" className="min-w-0 flex-1 truncate text-left font-medium text-m-accent" onClick={() => onAbrir(v.alvo_id)}>{v.alvo}</button>
                      : <span className="min-w-0 flex-1 truncate font-medium">{v.alvo}</span>}
                    {v.sugerido && <Pilula tom="atencao">sugerida pela TAG</Pilula>}
                    {planejador && v.sugerido && <button type="button" aria-label="Confirmar ligação" title="Confirmar" className="text-m-success" onClick={async () => { await api.post(`/documentos/vinculos/${v.id}/confirmar`); atualizar(); }}><Check size={17} /></button>}
                    {planejador && <button type="button" aria-label="Remover ligação" className="text-m-text-muted hover:text-m-danger" onClick={async () => {
                      if (await confirmar({ titulo: 'Remover esta ligação?', mensagem: `${v.relacao_nome} ${v.alvo}` })) { await api.del(`/documentos/vinculos/${v.id}`); atualizar(); }
                    }}><Trash2 size={15} /></button>}
                  </li>
                ))}
              </ul>
              {planejador && (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <Selecao rotulo="Relação" value={lig.relacao} onChange={(e) => setLig({ ...lig, relacao: e.target.value })}>
                    {Object.entries(opcoes?.relacoes ?? { aplica_a: 'aplica-se a' }).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Selecao>
                  <Selecao rotulo="A quê" value={lig.alvo_tipo} onChange={(e) => setLig({ ...lig, alvo_tipo: e.target.value, alvo_id: '' })}>
                    <option value="area">Frente</option><option value="grupo">Grupo de atividade</option><option value="documento">Documento</option>
                  </Selecao>
                  <Selecao rotulo="Destino" value={lig.alvo_id} onChange={(e) => setLig({ ...lig, alvo_id: e.target.value })} className="min-w-[240px]">
                    <option value="">Escolha…</option>
                    {alvos.map((a) => <option key={a.id} value={a.id}>{a.rotulo}</option>)}
                  </Selecao>
                  <Botao variante="secundario" onClick={ligar} disabled={!lig.alvo_id}><Link2 size={15} /> Ligar</Botao>
                </div>
              )}
              {d.citado_por.length > 0 && (
                <div className="mt-3 text-[13px]">
                  <div className="mb-1 font-semibold">Citado por</div>
                  {d.citado_por.map((c) => <div key={c.documento_id}><span className="text-m-text-muted">{c.relacao_nome} este:</span> <button type="button" className="font-medium text-m-accent" onClick={() => onAbrir(c.documento_id)}>{c.documento}</button></div>)}
                </div>
              )}
            </section>

            {d.historico.some((r) => r.formatos.includes('dxf')) && (
              <section className="flex flex-wrap items-center gap-3 rounded-[16px] border border-m-stroke-subtle p-4 text-[13px]">
                <Ruler size={16} className="text-m-accent" aria-hidden="true" />
                <span className="flex-1">As quantidades lidas deste desenho estão no take-off do projeto.</span>
                <Link href={`/app/takeoff?doc=${d.id}`} className="font-semibold text-m-accent">Abrir o take-off</Link>
              </section>
            )}

            {d.grds.length > 0 && (
              <section className="text-[13px]">
                <div className="mb-1 font-semibold">GRDs</div>
                {d.grds.map((g) => <div key={`${g.id}-${g.revisao}`}>{g.numero} · {g.sentido === 'recebida' ? 'recebida' : 'emitida'} em {dataBR(g.data)} · rev. {g.revisao}</div>)}
              </section>
            )}

            <section className="text-[13px]">
              <div className="mb-1 font-semibold">Quem abriu (rastreabilidade)</div>
              {!d.leituras.length ? <p className="text-m-text-muted">Ninguém abriu ainda.</p>
                : d.leituras.slice(0, 12).map((l, i) => <div key={i} className="text-m-text-secondary">{quando(l.em)} · rev. {l.revisao} · {l.quem} · {l.via === 'portal' ? 'link do encarregado' : l.via === 'campo' ? 'app de campo' : 'computador'} ({l.formato})</div>)}
            </section>
          </div>
        )}
      </aside>
      {ver && d && <VerRevisao titulo={`${d.codigo} · rev. ${ver.revisao}`} sub={`${d.titulo} · ${SITUACAO[ver.situacao].rotulo}`} onFechar={() => setVer(null)}
        png={ver.formatos.includes('png') ? arquivo(ver, 'png') : undefined} pdf={ver.formatos.includes('pdf') ? arquivo(ver, 'pdf') : undefined}
        original={ver.formatos.includes('original') ? () => api.download(`/documentos/revisoes/${ver.id}/arquivo?formato=original&baixar=true`,
          nomeArquivo(obra?.codigo, d.codigo, ver.revisao, ver.finalidade, (ver.nome_original ?? '').split('.').pop() || 'dwg')).then(() => undefined) : undefined} />}
    </div>,
    document.body,
  );
}

function EditarDocumento({ d, opcoes, onPronto }: { d: DocumentoDetalhe; opcoes?: OpcoesDocumentos; onPronto: () => void }) {
  const api = useApi();
  const [f, setF] = useState({ titulo: d.titulo, tipo: d.tipo, disciplina: d.disciplina ?? '', codigo_contratada: d.codigo_contratada ?? '', observacao: d.observacao ?? '' });
  return (
    <form className="flex flex-col gap-2 rounded-[16px] border border-m-stroke-subtle p-4" onSubmit={async (e) => {
      e.preventDefault();
      try { await api.put(`/documentos/${d.id}`, { ...f, disciplina: f.disciplina || null, codigo_contratada: f.codigo_contratada || null, observacao: f.observacao || null }); toast.success('Documento salvo'); onPronto(); } catch (er) { toast.error((er as Error).message); }
    }}>
      <Campo rotulo="Título" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} required minLength={3} />
      <div className="flex flex-wrap gap-2">
        <Selecao rotulo="Tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{Object.entries(opcoes?.tipos ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Selecao>
        <Selecao rotulo="Disciplina" value={f.disciplina} onChange={(e) => setF({ ...f, disciplina: e.target.value })}><option value="">—</option>{(opcoes?.disciplinas ?? []).map((x) => <option key={x}>{x}</option>)}</Selecao>
        <Campo rotulo="Código da contratada" value={f.codigo_contratada} onChange={(e) => setF({ ...f, codigo_contratada: e.target.value })} />
      </div>
      <Campo rotulo="Observação" value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} />
      <div><Botao type="submit">Salvar</Botao></div>
    </form>
  );
}
