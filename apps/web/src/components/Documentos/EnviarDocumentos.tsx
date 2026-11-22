'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Eye, FilePlus2, Link2, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { MultiSelecao } from '@/components/Obra/MultiSelecao';
import { Botao, Campo, Chip, Painel, Pilula, Selecao } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import type { DocumentoResumo, GrdResumo, OpcoesDocumentos } from '@/lib/documentos';

type Sugestao = { documento_id: number; codigo: string; titulo: string; nota: number };
type Recebido = {
  id: number; nome: string | null; tipo: string | null; codigo_lido: string | null; revisao_lida: string | null; titulo_lido: string | null;
  motivo: string | null; sugestoes: Sugestao[]; mime: string | null; enviado_por: string; enviado_em: string | null;
};
type Resultado = { nome: string; estado: 'enviando' | 'associado' | 'a_relacionar' | 'erro'; texto?: string; docId?: number };

/**
 * Enviar documentos (spec 132): arraste os arquivos, escolha o tipo (ou "pelo arquivo") e a GRD. O Malhet casa cada um com a LDO
 * pelo carimbo, pelo nome (código e revisão: _R4, rev B) ou pelo texto do PDF e registra a revisão; o que não casar fica em
 * "O que falta relacionar?" para associar à LDO, criar o documento, relacionar a outros ou descartar.
 */
export function EnviarDocumentos({ opcoes, docs, onAbrir }: { opcoes?: OpcoesDocumentos; docs: DocumentoResumo[]; onAbrir: (id: number) => void }) {
  const api = useApi();
  const qc = useQueryClient();
  const [tipo, setTipo] = useState('');
  const [grd, setGrd] = useState('');
  const [sobre, setSobre] = useState(false);
  const [res, setRes] = useState<Resultado[]>([]);
  const grds = useQuery({ queryKey: ['documentos', 'grds'], queryFn: () => api.get<GrdResumo[]>('/documentos/grds') });
  const pend = useQuery({ queryKey: ['documentos', 'recebidos'], queryFn: () => api.get<Recebido[]>('/documentos/recebidos') });

  const enviar = async (arqs: File[]) => {
    if (!arqs.length) return;
    const base = res.length;
    setRes((r) => [...r, ...arqs.map((a) => ({ nome: a.name, estado: 'enviando' as const }))]);
    for (let i = 0; i < arqs.length; i++) {
      const a = arqs[i];
      const fd = new FormData(); fd.append('arquivo', a, a.name);
      if (tipo) fd.append('tipo', tipo);
      if (grd) fd.append('grd_id', grd);
      let r: Resultado;
      try {
        const j = await api.post<{ resultado: string; como?: string; motivo?: string; documento?: { id: number; codigo: string }; revisao?: { revisao: string } }>('/documentos/enviar', fd);
        r = j.resultado === 'associado'
          ? { nome: a.name, estado: 'associado', texto: `${j.documento!.codigo} rev. ${j.revisao!.revisao} · ${j.como}`, docId: j.documento!.id }
          : { nome: a.name, estado: 'a_relacionar', texto: j.motivo };
      } catch (e) { r = { nome: a.name, estado: 'erro', texto: (e as Error).message }; }
      setRes((lista) => lista.map((x, k) => (k === base + i ? r : x)));
    }
    qc.invalidateQueries({ queryKey: ['documentos'] });
  };

  return (
    <div className="flex flex-col gap-5">
      <Painel titulo="Chegou documento?" subtitulo="Arraste os arquivos (DWG, DXF, PDF ou imagem). O Malhet procura o código no carimbo, no nome do arquivo e no texto do PDF, casa com a lista de documentos e registra a revisão. O que não casar fica logo abaixo para relacionar.">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Tipo</span>
            <Chip ativo={!tipo} onClick={() => setTipo('')}>Pelo arquivo</Chip>
            {Object.entries(opcoes?.tipos ?? {}).map(([k, v]) => <Chip key={k} ativo={tipo === k} onClick={() => setTipo(k)}>{v}</Chip>)}
          </div>
          <Selecao rotulo="Chegou na GRD" value={grd} onChange={(e) => setGrd(e.target.value)} className="max-w-[360px]">
            <option value="">—</option>{(grds.data ?? []).filter((g) => g.sentido === 'recebida').map((g) => <option key={g.id} value={g.id}>{g.numero}{g.numero_externo ? ` (${g.numero_externo})` : ''}</option>)}
          </Selecao>
          <label onDragOver={(e) => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)}
            onDrop={(e) => { e.preventDefault(); setSobre(false); void enviar(Array.from(e.dataTransfer.files)); }}
            className={`flex min-h-[168px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed p-6 text-center transition ${sobre ? 'border-m-accent bg-m-accent-subtle' : 'border-m-stroke-strong hover:border-m-accent hover:bg-m-surface-hover'}`}>
            <UploadCloud size={34} strokeWidth={1.5} className="text-m-accent" aria-hidden="true" />
            <span className="text-[15px] font-semibold text-m-text-primary">Arraste os arquivos aqui ou clique para escolher</span>
            <span className="text-[12px] text-m-text-muted">vários de uma vez · o código e a revisão podem vir no nome (1870AA-C-51890_R4.pdf)</span>
            <input type="file" multiple accept=".dwg,.dxf,.pdf,.png,.jpg,.jpeg" className="sr-only" aria-label="Arquivos para enviar"
              onChange={(e) => { const a = Array.from(e.target.files ?? []); e.target.value = ''; void enviar(a); }} />
          </label>
          {res.length > 0 && (
            <ul className="flex flex-col gap-1.5" aria-label="Resultado do envio">
              {res.map((r, i) => (
                <li key={i} className="flex items-start gap-2 rounded-[12px] border border-m-stroke-subtle px-3 py-2 text-[13px]">
                  {r.estado === 'enviando' ? <Loader2 size={16} className="mt-0.5 animate-spin text-m-text-muted" />
                    : r.estado === 'associado' ? <CheckCircle2 size={16} className="mt-0.5 text-m-success" />
                      : <AlertTriangle size={16} className={`mt-0.5 ${r.estado === 'erro' ? 'text-m-danger' : 'text-m-warning'}`} />}
                  <span className="min-w-0 flex-1"><b className="text-m-text-primary">{r.nome}</b>
                    <span className="block text-[12px] text-m-text-secondary">{r.estado === 'enviando' ? 'lendo e casando com a LDO…'
                      : r.estado === 'associado' ? `associado: ${r.texto}` : r.estado === 'a_relacionar' ? `a relacionar: ${r.texto}` : r.texto}</span></span>
                  {r.docId && <button type="button" className="text-[12px] font-semibold text-m-accent" onClick={() => onAbrir(r.docId!)}>abrir</button>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Painel>

      <Painel titulo={`O que falta relacionar?${pend.data?.length ? ` (${pend.data.length})` : ''}`}
        subtitulo="Arquivos que não casaram sozinhos com a lista: ligue ao documento da LDO (com a revisão), crie o documento que faltava ou relacione a outros documentos. O arquivo já está guardado no acervo.">
        {!pend.data?.length ? <p className="py-6 text-center text-[13px] text-m-text-muted">Nada esperando: tudo o que chegou já está na lista.</p>
          : <div className="flex flex-col gap-3">{pend.data.map((p) => <CartaoRelacionar key={p.id} p={p} docs={docs} opcoes={opcoes} />)}</div>}
      </Painel>
    </div>
  );
}

function CartaoRelacionar({ p, docs, opcoes }: { p: Recebido; docs: DocumentoResumo[]; opcoes?: OpcoesDocumentos }) {
  const api = useApi();
  const qc = useQueryClient();
  const confirmar = useConfirmar();
  const [modo, setModo] = useState<'associar' | 'novo'>(p.codigo_lido && p.motivo?.includes('não está na lista') ? 'novo' : 'associar');
  const [busca, setBusca] = useState('');
  const [docId, setDocId] = useState(String(p.sugestoes[0]?.documento_id ?? ''));
  const [f, setF] = useState({ codigo: p.codigo_lido ?? '', titulo: p.titulo_lido ?? '', revisao: p.revisao_lida ?? '', tipo: p.tipo ?? '', finalidade: '' });
  const [rel, setRel] = useState<string[]>([]);
  const [relacao, setRelacao] = useState('referencia');
  const termos = busca.trim().toUpperCase();
  const opcoesDocs = docs.filter((d) => !termos || `${d.codigo} ${d.titulo}`.toUpperCase().includes(termos)).slice(0, 300);
  const alvo = docs.find((d) => String(d.id) === docId);
  const atualizar = () => qc.invalidateQueries({ queryKey: ['documentos'] });
  const salvar = async () => {
    const comum = { finalidade: f.finalidade || null, relacionar_a: rel.map((c) => docs.find((d) => d.codigo === c)?.id).filter((x): x is number => !!x), relacao };
    try {
      if (modo === 'associar') await api.post(`/documentos/recebidos/${p.id}/associar`, { documento_id: Number(docId), revisao: f.revisao, ...comum });
      else await api.post(`/documentos/recebidos/${p.id}/novo`, { codigo: f.codigo, titulo: f.titulo, revisao: f.revisao, tipo: f.tipo || null, ...comum });
      toast.success('Documento relacionado'); atualizar();
    } catch (e) { toast.error((e as Error).message); }
  };
  const ver = async () => { const b = await api.blob(`/documentos/recebidos/${p.id}/arquivo`); window.open(URL.createObjectURL(b), '_blank'); };
  const descartar = async () => {
    if (await confirmar({ titulo: `Descartar ${p.nome ?? 'o arquivo'}?`, mensagem: 'O arquivo sai do acervo e não entra na lista de documentos.', acao: 'Descartar' })) {
      await api.del(`/documentos/recebidos/${p.id}`); atualizar();
    }
  };
  return (
    <div className="flex flex-col gap-3 rounded-[16px] border border-m-stroke-subtle bg-m-surface-base p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <b className="break-all text-[14px] text-m-text-primary">{p.nome}</b>
          <p className="text-[12px] text-m-warning">{p.motivo}</p>
          {(p.codigo_lido || p.revisao_lida) && <p className="text-[12px] text-m-text-muted">lido: {[p.codigo_lido && `código ${p.codigo_lido}`, p.revisao_lida && `rev. ${p.revisao_lida}`].filter(Boolean).join(' · ')}</p>}
        </div>
        <Botao variante="fantasma" className="h-9 px-3" onClick={ver}><Eye size={15} /> Ver</Botao>
        <Botao variante="fantasma" className="h-9 px-3" onClick={descartar}><Trash2 size={15} /> Descartar</Botao>
      </div>
      {p.sugestoes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[12px]"><span className="text-m-text-muted">Parece com:</span>
          {p.sugestoes.map((s) => <Chip key={s.documento_id} ativo={modo === 'associar' && docId === String(s.documento_id)} onClick={() => { setModo('associar'); setDocId(String(s.documento_id)); }}>{s.codigo}</Chip>)}
        </div>
      )}
      <div className="flex gap-2">
        <Chip ativo={modo === 'associar'} onClick={() => setModo('associar')}><Link2 size={13} className="mr-1 inline" />Associar à LDO</Chip>
        <Chip ativo={modo === 'novo'} onClick={() => setModo('novo')}><FilePlus2 size={13} className="mr-1 inline" />Documento novo</Chip>
      </div>
      {modo === 'associar' ? (
        <div className="flex flex-wrap items-end gap-2">
          <Campo rotulo="Buscar na LDO" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="código ou título" className="w-[200px]" />
          <Selecao rotulo="Documento" value={docId} onChange={(e) => setDocId(e.target.value)} className="min-w-[280px] max-w-[420px]">
            <option value="">Escolha…</option>{opcoesDocs.map((d) => <option key={d.id} value={d.id}>{d.codigo} · {d.titulo.slice(0, 70)}</option>)}
          </Selecao>
          <Campo rotulo="Revisão" value={f.revisao} onChange={(e) => setF({ ...f, revisao: e.target.value })} placeholder={alvo?.ultima?.revisao ?? '0'} className="w-[90px]" />
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-[180px_1fr_90px_160px]">
          <Campo rotulo="Código" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} />
          <Campo rotulo="Título" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
          <Campo rotulo="Revisão" value={f.revisao} onChange={(e) => setF({ ...f, revisao: e.target.value })} />
          <Selecao rotulo="Tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            <option value="">pelo arquivo</option>{Object.entries(opcoes?.tipos ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Selecao>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <Selecao rotulo="Finalidade" value={f.finalidade} onChange={(e) => setF({ ...f, finalidade: e.target.value })}>
          <option value="">a do carimbo / LDO</option>{(opcoes?.finalidades ?? []).map((x) => <option key={x}>{x}</option>)}
        </Selecao>
        <Selecao rotulo="Relação" value={relacao} onChange={(e) => setRelacao(e.target.value)}>
          {Object.entries(opcoes?.relacoes ?? { referencia: 'referencia' }).filter(([k]) => k !== 'aplica_a').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Selecao>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase leading-4 tracking-[0.48px] text-m-text-muted">Relacionar a outros documentos (opcional)</span>
          <MultiSelecao rotulo="Relacionar a outros documentos" valor={rel} comNa={false} largura="w-[320px]" onChange={setRel}
            opcoes={docs.slice(0, 500).map((d) => ({ valor: d.codigo, rotulo: `${d.codigo} · ${d.titulo.slice(0, 50)}` }))} />
        </div>
        <Botao onClick={salvar} disabled={modo === 'associar' ? !docId || !f.revisao : !f.codigo || f.titulo.trim().length < 3 || !f.revisao}>
          {modo === 'associar' ? 'Associar' : 'Criar e guardar'}
        </Botao>
      </div>
      {pillLido(p)}
    </div>
  );
}

const pillLido = (p: Recebido) => (p.tipo ? <div><Pilula ponto={false}>enviado como {p.tipo}</Pilula></div> : null);
