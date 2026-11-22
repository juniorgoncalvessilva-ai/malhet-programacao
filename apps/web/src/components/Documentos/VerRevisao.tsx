'use client';

import { Download, ExternalLink, Minus, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

/**
 * Folha do desenho (spec 123): a imagem em alta resolução com zoom (botões, roda do mouse, dois dedos) e arrastar; o PDF
 * vetorial abre no leitor do aparelho (zoom sem perder nitidez) e o original (DWG) baixa. Funciona no computador, no app de
 * campo e no endereço do encarregado — quem chama diz de onde vem cada arquivo.
 */
export function VerRevisao({ titulo, sub, png, pdf, original, onFechar, carimbo }: {
  titulo: string; sub?: string; png?: () => Promise<Blob>; pdf?: () => Promise<Blob>; original?: () => Promise<void>; onFechar: () => void;
  /** Spec 130 (Plano de Arquivamento 8.14/8.17): vigente = CÓPIA CONTROLADA; superada/cancelada = DOCUMENTO OBSOLETO. */
  carimbo?: 'controlada' | 'obsoleto';
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const caixa = useRef<HTMLDivElement>(null);
  const dedos = useRef<{ d: number; z: number } | null>(null);
  useEffect(() => {
    let u: string | null = null;
    if (png) png().then((b) => { u = URL.createObjectURL(b); setUrl(u); }).catch((e) => setErro((e as Error).message));
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [png]);
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc); }, [onFechar]);
  const mudar = (z: number) => setZoom(Math.min(8, Math.max(1, Math.round(z * 100) / 100)));
  const abrirPdf = async () => {
    if (!pdf) return;
    try { const b = await pdf(); window.open(URL.createObjectURL(b), '_blank'); } catch (e) { toast.error((e as Error).message); }
  };
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div role="dialog" aria-label={`Folha ${titulo}`} onClick={(e) => e.stopPropagation()} className="fixed inset-0 z-[250] flex flex-col bg-[#111]">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 pt-[max(env(safe-area-inset-top),8px)] text-white">
        <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-semibold">{titulo}</div>{sub && <div className="truncate text-[12px] opacity-75">{sub}</div>}</div>
        <button type="button" aria-label="Diminuir" onClick={() => mudar(zoom / 1.5)} className="grid h-10 w-10 place-items-center rounded-full bg-white/15"><Minus size={18} /></button>
        <span className="w-12 text-center text-[13px] tabular-nums">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Aumentar" onClick={() => mudar(zoom * 1.5)} className="grid h-10 w-10 place-items-center rounded-full bg-white/15"><Plus size={18} /></button>
        {pdf && <button type="button" onClick={abrirPdf} className="flex h-10 items-center gap-1.5 rounded-full bg-white/15 px-3 text-[13px] font-semibold"><ExternalLink size={15} /> PDF</button>}
        {original && <button type="button" onClick={() => void original()} className="flex h-10 items-center gap-1.5 rounded-full bg-white/15 px-3 text-[13px] font-semibold"><Download size={15} /> Original</button>}
        <button type="button" aria-label="Fechar" onClick={onFechar} className="grid h-10 w-10 place-items-center rounded-full bg-white/15"><X size={20} /></button>
      </div>
      {carimbo && (
        <div role="status" className={`pointer-events-none absolute left-1/2 top-[72px] z-10 -translate-x-1/2 rotate-[-4deg] rounded-[6px] border-[3px] px-4 py-1.5 font-mono text-[15px] font-extrabold uppercase tracking-[0.18em] shadow-sm ${carimbo === 'obsoleto' ? 'border-m-danger bg-white/90 text-m-danger' : 'border-m-danger/80 bg-white/80 text-m-danger'}`}>
          {carimbo === 'obsoleto' ? 'Documento obsoleto' : 'Cópia controlada'}
        </div>
      )}
      <div ref={caixa} className="relative flex-1 overflow-auto bg-white"
        onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); mudar(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); } }}
        onDoubleClick={() => mudar(zoom >= 4 ? 1 : zoom * 2)}
        onTouchStart={(e) => { if (e.touches.length === 2) { const [a, b] = [e.touches[0], e.touches[1]]; dedos.current = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: zoom }; } }}
        onTouchMove={(e) => { if (e.touches.length === 2 && dedos.current) { const [a, b] = [e.touches[0], e.touches[1]]; mudar(dedos.current.z * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / dedos.current.d); } }}
        onTouchEnd={() => { dedos.current = null; }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt={`Folha ${titulo}`} style={{ width: `${zoom * 100}%`, maxWidth: 'none' }} className="block select-none" draggable={false} />
          : <div className="grid h-full place-items-center text-[14px] text-m-text-muted">{erro ?? (png ? 'Abrindo a folha…' : 'Esta revisão não tem imagem: abra o PDF ou o original.')}</div>}
      </div>
    </div>,
    document.body,
  );
}
