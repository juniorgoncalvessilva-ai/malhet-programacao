'use client';

import { useQuery } from '@tanstack/react-query';
import { Camera, CheckCircle2, Nfc, ShieldCheck, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Botao, Cabecalho, Campo, Indicador, Painel, Selecao } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';
import { carregarFace, lerRosto, maisProximo, media } from '@/lib/presenca/face';
import { abrirCamera, escutarNfc, temCamera, temNfc } from '@/lib/presenca/leitores';
import type { BasePresenca } from '@/lib/presenca/offline';

interface Ident {
  id: number; nome: string; matricula: string | null; cracha: string | null; funcao: string | null; situacao: string; equipe: string | null;
  codigo: string | null; nfc: string | null; face: boolean; face_em: string | null; consentimento_em: string | null;
}

/**
 * Mobilização · cadastro do crachá (código/QR e NFC) e do rosto de cada pessoa para a apropriação de presença
 * (spec 063). O rosto vira só um descritor numérico, com o consentimento registrado; a foto não é guardada.
 */
export default function IdentificacaoPage() {
  const api = useApi();
  const { pode } = useObra();
  const confirmar = useConfirmar();
  const q = useQuery({ queryKey: ['presenca', 'identificacoes'], queryFn: () => api.get<Ident[]>('/presenca/identificacoes') });
  const [busca, setBusca] = useState('');
  const [equipe, setEquipe] = useState('');
  const [falta, setFalta] = useState<'' | 'face' | 'nfc'>('');
  const [rosto, setRosto] = useState<Ident | null>(null);
  const [lendoNfc, setLendoNfc] = useState<number | null>(null);
  const editar = pode('planejador');
  const lista = q.data ?? [];
  const equipes = useMemo(() => [...new Set(lista.map((x) => x.equipe).filter(Boolean) as string[])].sort(), [lista]);
  const t = busca.trim().toLowerCase();
  const filtrada = lista.filter((x) => (!t || [x.nome, x.matricula, x.cracha, x.funcao, x.codigo].some((v) => v?.toLowerCase().includes(t)))
    && (!equipe || (equipe === '-' ? !x.equipe : x.equipe === equipe)) && (falta === '' || (falta === 'face' ? !x.face : !x.nfc)));

  const salvar = async (x: Ident, corpo: Record<string, unknown>, msg: string) => {
    try { await api.put(`/presenca/identificacoes/${x.id}`, corpo); toast.success(msg); } catch (e) { toast.error((e as Error).message, { duration: 8000 }); }
  };
  const lerNfc = async (x: Ident) => {
    setLendoNfc(x.id);
    let parar: (() => void) | null = null;
    try {
      parar = await escutarNfc(async (serial, textos) => {
        parar?.(); setLendoNfc(null);
        const v = serial ?? textos[0];
        if (v) await salvar(x, { nfc: v, campos: ['nfc'] }, `Crachá NFC de ${x.nome} cadastrado`);
      }, (m) => toast.error(m));
      setTimeout(() => { parar?.(); setLendoNfc((id) => (id === x.id ? null : id)); }, 20000);
    } catch (e) { setLendoNfc(null); toast.error((e as Error).message || 'Permita o NFC para este site'); }
  };

  return (
    <>
      <Cabecalho eyebrow="Efetivo · mobilização" cor="var(--m-proc-executar)" titulo="Crachá e rosto para a presença" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador rotulo="Pessoas ativas" valor={lista.length} />
        <Indicador rotulo="Com rosto" valor={lista.filter((x) => x.face).length} />
        <Indicador rotulo="Com crachá NFC" valor={lista.filter((x) => x.nfc).length} />
        <Indicador rotulo="Sem equipe" valor={lista.filter((x) => !x.equipe).length} />
      </div>
      <Painel titulo="Como a pessoa é reconhecida no campo">
        <ul className="flex flex-col gap-1.5 text-[13px] text-m-text-secondary">
          <li><b className="text-m-text-primary">Código / QR:</b> a matrícula e o crachá do efetivo já valem; informe um código só se o crachá tiver outro número impresso.</li>
          <li><b className="text-m-text-primary">NFC:</b> aproxime o crachá do celular (Chrome no Android, em HTTPS) para gravar o número dele.</li>
          <li className="flex items-start gap-1.5"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-m-success" /><span><b className="text-m-text-primary">Rosto:</b> só com a autorização da pessoa (LGPD). Guardamos um código numérico do rosto, nunca a foto, e dá para apagar a qualquer hora.</span></li>
        </ul>
      </Painel>
      <Painel titulo="Pessoas">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Campo rotulo="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="nome, matrícula, função…" className="min-w-[240px]" />
          <Selecao rotulo="Equipe" value={equipe} onChange={(e) => setEquipe(e.target.value)} className="min-w-[220px]">
            <option value="">Todas</option><option value="-">Sem equipe</option>
            {equipes.map((e) => <option key={e} value={e}>{e}</option>)}
          </Selecao>
          <Selecao rotulo="Mostrar" value={falta} onChange={(e) => setFalta(e.target.value as '' | 'face' | 'nfc')}>
            <option value="">Todos</option><option value="face">Sem rosto</option><option value="nfc">Sem NFC</option>
          </Selecao>
          <span className="ml-auto text-[12.5px] text-m-text-muted">{filtrada.length} pessoa(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead className="text-left text-[11px] uppercase tracking-[0.4px] text-m-text-muted">
              <tr><th className="py-2">Pessoa</th><th>Equipe</th><th>Código do crachá</th><th>NFC</th><th>Rosto</th></tr>
            </thead>
            <tbody>
              {filtrada.slice(0, 400).map((x) => (
                <tr key={x.id} className="border-t border-m-stroke-subtle align-middle">
                  <td className="py-2 pr-3"><b className="block text-m-text-primary">{x.nome}</b><span className="text-[12px] text-m-text-muted">{[x.matricula, x.funcao, x.situacao !== 'MOBILIZADO' && x.situacao.toLowerCase()].filter(Boolean).join(' · ')}</span></td>
                  <td className="pr-3 text-m-text-secondary">{x.equipe ?? '—'}</td>
                  <td className="pr-3">
                    <span className="block text-[12px] text-m-text-muted">vale: {[x.matricula, x.cracha].filter(Boolean).join(', ') || '—'}</span>
                    {editar ? (
                      <input aria-label={`Outro código do crachá de ${x.nome}`} defaultValue={x.codigo ?? ''} placeholder="outro código"
                        onBlur={(e) => { const v = e.target.value.trim(); if (v !== (x.codigo ?? '')) salvar(x, { codigo: v || null, campos: ['codigo'] }, 'Código salvo'); }}
                        className="h-8 w-40 rounded-[8px] border border-m-stroke bg-m-surface-field px-2" />
                    ) : x.codigo}
                  </td>
                  <td className="pr-3">
                    {x.nfc && <span className="mr-2 font-mono text-[12px]">{x.nfc}</span>}
                    {editar && temNfc() && <Botao variante="secundario" onClick={() => lerNfc(x)} disabled={lendoNfc != null}><Nfc size={15} /> {lendoNfc === x.id ? 'Aproxime…' : x.nfc ? 'Trocar' : 'Ler crachá'}</Botao>}
                    {editar && !temNfc() && (
                      <input aria-label={`Número NFC do crachá de ${x.nome}`} defaultValue={x.nfc ?? ''} placeholder="nº NFC"
                        onBlur={(e) => { const v = e.target.value.trim(); if (v !== (x.nfc ?? '')) salvar(x, { nfc: v || null, campos: ['nfc'] }, 'NFC salvo'); }}
                        className="h-8 w-36 rounded-[8px] border border-m-stroke bg-m-surface-field px-2 font-mono" />
                    )}
                  </td>
                  <td>
                    <span className="flex flex-wrap items-center gap-2">
                      {x.face && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-m-success"><CheckCircle2 size={14} /> {x.face_em ? new Date(x.face_em).toLocaleDateString('pt-BR') : 'cadastrado'}</span>}
                      {editar && <Botao variante={x.face ? 'secundario' : 'primario'} onClick={() => setRosto(x)}><Camera size={15} /> {x.face ? 'Refazer' : 'Cadastrar rosto'}</Botao>}
                      {editar && x.face && (
                        <button type="button" aria-label={`Apagar o rosto de ${x.nome}`} className="grid h-9 w-9 place-items-center rounded-full text-m-danger hover:bg-m-danger-subtle"
                          onClick={async () => { if (await confirmar({ titulo: `Apagar o rosto de ${x.nome}?`, mensagem: 'A pessoa deixa de ser reconhecida pelo rosto até um novo cadastro.', acao: 'Apagar' })) salvar(x, { face: null, campos: ['face'] }, 'Rosto apagado'); }}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {q.isLoading && <p className="py-3 text-[13px] text-m-text-muted">Carregando…</p>}
          {filtrada.length > 400 && <p className="py-2 text-[12px] text-m-text-muted">Mostrando 400 de {filtrada.length}: use a busca.</p>}
        </div>
      </Painel>
      {rosto && <CadastroRosto pessoa={rosto} onFechar={() => setRosto(null)} onSalvar={(d) => salvar(rosto, { face: d, consentimento: true, campos: ['face'] }, `Rosto de ${rosto.nome} cadastrado`).then(() => setRosto(null))} />}
    </>
  );
}

function CadastroRosto({ pessoa, onFechar, onSalvar }: { pessoa: Ident; onFechar: () => void; onSalvar: (d: number[]) => void }) {
  const api = useApi();
  const video = useRef<HTMLVideoElement>(null);
  const [frente, setFrente] = useState<'user' | 'environment'>('user');
  const [consentiu, setConsentiu] = useState(false);
  const [estado, setEstado] = useState<'abrindo' | 'pronto' | 'capturando' | 'erro'>('abrindo');
  const [msg, setMsg] = useState('Abrindo a câmera…');
  const [amostras, setAmostras] = useState(0);
  const base = useQuery({ queryKey: ['presenca', 'base'], queryFn: () => api.get<BasePresenca>('/presenca/base'), staleTime: 60000 });

  useEffect(() => {
    if (!temCamera()) { setEstado('erro'); setMsg('Sem acesso à câmera neste navegador (precisa de HTTPS ou localhost).'); return; }
    let fechar: (() => void) | null = null; let vivo = true;
    (async () => {
      try {
        await carregarFace();
        fechar = await abrirCamera(video.current!, frente);
        if (vivo) { setEstado('pronto'); setMsg('Rosto de frente, bem iluminado, sem boné nem óculos escuros'); }
      } catch (e) { if (vivo) { setEstado('erro'); setMsg((e as Error).message || 'Não consegui abrir a câmera'); } }
    })();
    return () => { vivo = false; fechar?.(); };
  }, [frente]);

  const capturar = async () => {
    setEstado('capturando'); setAmostras(0);
    const ds: Float32Array[] = [];
    const ate = Date.now() + 8000;
    while (ds.length < 4 && Date.now() < ate) {
      const r = video.current ? await lerRosto(video.current, 320) : null;
      if (r && r.score > 0.7) { ds.push(r.descritor); setAmostras(ds.length); }
      await new Promise((x) => setTimeout(x, 150));
    }
    if (ds.length < 3) { setEstado('pronto'); setMsg('Não achei o rosto com nitidez. Aproxime e tente de novo.'); return; }
    const d = media(ds);
    const outros = (base.data?.pessoas ?? []).filter((p) => p.id !== pessoa.id);
    const parecido = maisProximo(new Float32Array(d), outros, (base.data?.distancia_max ?? 0.5) * 0.9);
    if (parecido) { toast.warning(`Este rosto parece com ${parecido.pessoa.nome}. Confira se é a pessoa certa antes de salvar.`, { duration: 10000 }); }
    onSalvar(d);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[5vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div role="dialog" aria-modal="true" aria-label={`Cadastrar rosto de ${pessoa.nome}`} className="flex w-[520px] max-w-full flex-col gap-3 rounded-m-lg border border-m-stroke bg-m-surface-raised p-4 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Cadastrar rosto</p><h3 className="text-[16px] font-semibold">{pessoa.nome}</h3></div>
          <button type="button" aria-label="Fechar" onClick={onFechar} className="rounded-full p-1.5 text-m-text-muted hover:bg-m-surface-hover"><X size={18} /></button>
        </div>
        <div className="relative overflow-hidden rounded-m-md bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={video} className={`aspect-[4/3] w-full object-cover ${frente === 'user' ? '-scale-x-100' : ''}`} />
          <span className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2 text-center text-[13px] text-white">{estado === 'capturando' ? `Capturando… ${amostras} de 4` : msg}</span>
          <button type="button" onClick={() => setFrente((f) => (f === 'user' ? 'environment' : 'user'))} className="absolute right-2 top-2 h-9 rounded-full bg-white/85 px-3 text-[12px] font-semibold">Trocar câmera</button>
        </div>
        <label className="flex items-start gap-2 text-[13px]">
          <input type="checkbox" className="mt-0.5" checked={consentiu} onChange={(e) => setConsentiu(e.target.checked)} />
          <span><b>{pessoa.nome}</b> autorizou o uso do rosto para registrar a presença na obra. Fica guardado só um código numérico (não a foto), apagado quando pedir ou ao sair da obra.</span>
        </label>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao disabled={!consentiu || estado !== 'pronto'} onClick={capturar}><Camera size={15} /> Capturar e salvar</Botao>
        </div>
      </div>
    </div>,
    document.body,
  );
}
