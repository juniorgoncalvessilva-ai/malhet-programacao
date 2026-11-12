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

export function useEnviarFoto() {
  const api = useApi();
  return async (alvo: 'desvio' | 'restricao' | 'linha', alvoId: number, foto: Blob, extra?: { data?: string; legenda?: string }) => {
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
export function TirarFotos({ fotos, onChange, rotulo = 'Foto da frente', dica = 'Vira prova no pleito, se precisar' }: {
  fotos: Blob[]; onChange: (f: Blob[]) => void; rotulo?: string; dica?: string;
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
          try { onChange([...fotos, await reduzirFoto(arq)]); } catch { toast.error('Não consegui ler a foto'); }
        }} />
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((u, k) => (
            <span key={u} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`Foto ${k + 1}`} className="h-16 w-16 rounded-[10px] object-cover" />
              <button type="button" aria-label={`Tirar a foto ${k + 1}`} onClick={() => onChange(fotos.filter((_, j) => j !== k))} className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-m-surface-raised text-m-text-secondary shadow"><X size={14} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
