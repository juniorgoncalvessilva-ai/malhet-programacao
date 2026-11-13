'use client';

import { useQuery } from '@tanstack/react-query';
import { Camera, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useApi } from '@/hooks/programacao/useApi';

/** Reduz a foto no próprio celular (lado maior 1600 px, JPEG 0,8) antes de enviar: menos dados móveis. */
export async function reduzirFoto(arq: File, maior = 1600): Promise<Blob> {
  const url = URL.createObjectURL(arq);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = url; });
    const k = Math.min(1, maior / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error('foto inválida'))), 'image/jpeg', 0.8));
  } finally { URL.revokeObjectURL(url); }
}

/** Momento em que cada foto foi tirada/escolhida (para o carimbo de data e hora). */
export const momentoDaFoto = new WeakMap<Blob, Date>();
export const dataHoraBR = (d: Date) => `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

/**
 * Carimbo na foto, como os apps de "timestamp camera" (spec 061): faixa escura no rodapé com a data e a hora em destaque
 * e as linhas seguintes (frente de serviço, obra…). Devolve um JPEG novo; a foto original não é alterada.
 */
export async function carimbarFoto(foto: Blob, linhas: string[], quando = momentoDaFoto.get(foto) ?? new Date()): Promise<Blob> {
  const url = URL.createObjectURL(foto);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = url; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const base = Math.max(14, Math.round(Math.min(c.width, c.height) * 0.034));
    const pad = Math.round(base * 0.8);
    const textos = [{ t: dataHoraBR(quando), px: Math.round(base * 1.45), peso: 700 }, ...linhas.filter(Boolean).map((t) => ({ t, px: base, peso: 600 }))];
    const alt = textos.reduce((s, x) => s + x.px * 1.3, 0) + pad * 2;
    const grad = ctx.createLinearGradient(0, c.height - alt * 1.4, 0, c.height);
    grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(0.3, 'rgba(0,0,0,0.55)'); grad.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = grad; ctx.fillRect(0, c.height - alt * 1.4, c.width, alt * 1.4);
    let y = c.height - alt + pad;
    ctx.textBaseline = 'top';
    for (const x of textos) {
      ctx.font = `${x.peso} ${x.px}px Figtree, system-ui, sans-serif`;
      ctx.lineWidth = Math.max(2, x.px / 8); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.fillStyle = x === textos[0] ? '#FFD54F' : '#FFFFFF';
      ctx.strokeText(x.t, pad, y, c.width - pad * 2); ctx.fillText(x.t, pad, y, c.width - pad * 2);
      y += x.px * 1.3;
    }
    return await new Promise<Blob>((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error('foto inválida'))), 'image/jpeg', 0.85));
  } finally { URL.revokeObjectURL(url); }
}

export function useEnviarFoto() {
  const api = useApi();
  return async (alvo: 'desvio' | 'restricao' | 'linha' | 'auditoria' | 'acao', alvoId: number, foto: Blob, extra?: { data?: string; legenda?: string }) => {
    const fd = new FormData();
    fd.append('alvo', alvo); fd.append('alvo_id', String(alvoId));
    if (extra?.data) fd.append('data', extra.data);
    if (extra?.legenda) fd.append('legenda', extra.legenda);
    fd.append('arquivo', foto, 'foto.jpg');
    return api.post<{ id: number }>('/fotos', fd);
  };
}

/** Miniatura de uma foto já enviada (abre em tela cheia ao tocar). */
export function Miniatura({ id, tamanho = 64 }: { id: number; tamanho?: number }) {
  const api = useApi();
  const q = useQuery({ queryKey: ['foto', id], queryFn: async () => URL.createObjectURL(await api.blob(`/fotos/${id}/arquivo`)), staleTime: Infinity });
  const [cheia, setCheia] = useState(false);
  if (!q.data) return <span className="inline-block animate-pulse rounded-[10px] bg-m-surface-active" style={{ width: tamanho, height: tamanho }} />;
  return (
    <>
      <button type="button" onClick={() => setCheia(true)} aria-label="Ver a foto" className="overflow-hidden rounded-[10px] border border-m-stroke-subtle" style={{ width: tamanho, height: tamanho }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={q.data} alt="Foto de campo" className="h-full w-full object-cover" />
      </button>
      {cheia && (
        <div role="dialog" aria-label="Foto" className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4" onClick={() => setCheia(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={q.data} alt="Foto de campo" className="max-h-full max-w-full rounded-[10px]" />
          <button type="button" aria-label="Fechar" className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white"><X size={22} /></button>
        </div>
      )}
    </>
  );
}

/** Botão "Foto da frente": abre a câmera, mostra as fotos escolhidas (ainda não enviadas) e devolve os blobs já reduzidos. */
export function TirarFotos({ fotos, onChange, rotulo = 'Foto da frente', dica = 'Vira prova no pleito, se precisar', carimbo }: {
  fotos: Blob[]; onChange: (f: Blob[]) => void; rotulo?: string; dica?: string;
  /** Linhas do carimbo (frente, obra…): mostra na miniatura o que vai entrar na foto ao registrar. */
  carimbo?: string[];
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => { const u = fotos.map((f) => URL.createObjectURL(f)); setUrls(u); return () => u.forEach((x) => URL.revokeObjectURL(x)); }, [fotos]);
  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => ref.current?.click()} className="flex min-h-[56px] items-center gap-3 rounded-[14px] border border-dashed border-m-stroke-strong px-3.5 text-left">
        <Camera size={22} className="shrink-0 text-m-accent" aria-hidden="true" />
        <span className="flex flex-col"><span className="text-[14px] font-medium leading-5">{rotulo}{fotos.length ? ` · ${fotos.length}` : ''}</span><span className="text-[12px] leading-4 text-m-text-muted">{dica}</span></span>
      </button>
      <input ref={ref} type="file" accept="image/*" capture="environment" className="sr-only" aria-label={rotulo}
        onChange={async (e) => {
          const arq = e.target.files?.[0]; e.target.value = '';
          if (!arq) return;
          try { const b = await reduzirFoto(arq); momentoDaFoto.set(b, new Date()); onChange([...fotos, b]); } catch { toast.error('Não consegui ler a foto'); }
        }} />
      {carimbo && fotos.length > 0 && (
        <span className="text-[12px] leading-4 text-m-text-muted">Carimbo na foto: data e hora{carimbo.filter(Boolean).length ? ` · ${carimbo.filter(Boolean).join(' · ')}` : ''}</span>
      )}
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((u, k) => (
            <span key={u} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`Foto ${k + 1}`} className="h-16 w-16 rounded-[10px] object-cover" />
              {carimbo && (
                <span className="absolute inset-x-0 bottom-0 truncate rounded-b-[10px] bg-black/60 px-1 text-[8px] font-semibold leading-3 text-[#FFD54F]">
                  {dataHoraBR(momentoDaFoto.get(fotos[k]) ?? new Date())}
                </span>
              )}
              <button type="button" aria-label={`Tirar a foto ${k + 1}`} onClick={() => onChange(fotos.filter((_, j) => j !== k))} className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-m-surface-raised text-m-text-secondary shadow"><X size={14} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
