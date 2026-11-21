'use client';

import { Excalidraw, convertToExcalidrawElements, exportToCanvas, getCommonBounds } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type Api = Parameters<NonNullable<React.ComponentProps<typeof Excalidraw>['excalidrawAPI']>>[0];
type Inicial = NonNullable<React.ComponentProps<typeof Excalidraw>['initialData']>;

// fontes servidas pelo próprio Malhet (scripts/copiar-excalidraw.mjs), guardadas pelo service worker para funcionar offline
if (typeof window !== 'undefined') (window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH = '/excalidraw/';

const lerDataUrl = (b: Blob) => new Promise<string>((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = falha; r.readAsDataURL(b); });
const abrir = (src: string) => new Promise<HTMLImageElement>((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = src; });

/**
 * Editor da marcação (spec 122): a foto entra travada no fundo do Excalidraw e a pessoa circula, aponta com seta,
 * risca à mão ou escreve em vermelho. "Usar" devolve a foto do mesmo tamanho com a marcação (o que passa da borda é cortado).
 */
export default function MarcarFotoEditor({ foto, onPronto, onFechar }: { foto: Blob; onPronto: (b: Blob) => void; onFechar: () => void }) {
  const [inicial, setInicial] = useState<{ dados: Inicial; w: number; h: number } | null>(null);
  const [api, setApi] = useState<Api | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const dataURL = await lerDataUrl(foto);
      const img = await abrir(dataURL);
      const w = img.naturalWidth, h = img.naturalHeight;
      const [el] = convertToExcalidrawElements([{ type: 'image', fileId: 'foto' as never, x: 0, y: 0, width: w, height: h, locked: true }]);
      if (!vivo) return;
      setInicial({
        w, h,
        dados: {
          elements: [{ ...el, locked: true }],
          files: { foto: { id: 'foto', dataURL, mimeType: (foto.type || 'image/jpeg') as 'image/jpeg', created: Date.now() } } as never,
          appState: {
            viewBackgroundColor: '#111111', currentItemStrokeColor: '#e03131', currentItemStrokeWidth: 4,
            currentItemRoughness: 0, currentItemBackgroundColor: 'transparent', currentItemFontSize: Math.max(28, Math.round(w / 30)),
            activeTool: { type: 'freedraw', customType: null, locked: true, lastActiveTool: null },
          } as never,
          scrollToContent: true,
        },
      });
    })();
    return () => { vivo = false; };
  }, [foto]);

  const usar = async () => {
    if (!api || !inicial) return;
    setSalvando(true);
    try {
      const elements = api.getSceneElements();
      if (elements.length <= 1) { onFechar(); return; } // nada marcado: fica a foto como estava
      const canvas = await exportToCanvas({ elements, files: api.getFiles(), exportPadding: 0,
        appState: { ...api.getAppState(), exportBackground: true, viewBackgroundColor: '#ffffff', exportWithDarkMode: false } });
      // o quadro exportado começa no canto do que foi desenhado; a foto está em (0,0): recorta exatamente a foto
      const [minX, minY] = getCommonBounds(elements);
      const k = canvas.width / (getCommonBounds(elements)[2] - minX);
      const saida = document.createElement('canvas');
      saida.width = inicial.w; saida.height = inicial.h;
      saida.getContext('2d')!.drawImage(canvas, -minX * k, -minY * k, canvas.width / k, canvas.height / k);
      const b = await new Promise<Blob>((ok, falha) => saida.toBlob((x) => (x ? ok(x) : falha(new Error('foto inválida'))), 'image/jpeg', 0.88));
      onPronto(b);
    } finally { setSalvando(false); }
  };

  return (
    <div role="dialog" aria-label="Marcar na foto" className="fixed inset-0 z-[300] flex flex-col bg-black">
      <div className="flex items-center justify-between gap-2 px-3 py-2 pt-[max(env(safe-area-inset-top),8px)] text-white">
        <button type="button" onClick={onFechar} className="flex h-11 items-center gap-1.5 rounded-full px-3 text-[15px] font-semibold"><X size={20} /> Cancelar</button>
        <span className="text-[13px] opacity-80">Circule, aponte ou escreva</span>
        <button type="button" disabled={!api || salvando} onClick={usar} className="flex h-11 items-center gap-1.5 rounded-full bg-white px-4 text-[15px] font-semibold text-black disabled:opacity-50"><Check size={18} /> {salvando ? 'Salvando…' : 'Usar'}</button>
      </div>
      <div className="relative flex-1">
        {inicial && (
          <Excalidraw initialData={inicial.dados} excalidrawAPI={setApi} langCode="pt-BR" theme="light"
            UIOptions={{ canvasActions: { changeViewBackgroundColor: false, clearCanvas: false, export: false, loadScene: false, saveToActiveFile: false, toggleTheme: false, saveAsImage: false }, tools: { image: false } }} />
        )}
      </div>
    </div>
  );
}
