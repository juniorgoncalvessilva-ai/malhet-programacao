'use client';

import { FileDown, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useLogo, useMarcaObra } from '@/components/Obra/LogosObra';
import { useObraOpcional } from '@/lib/obra/ObraProvider';
import { cn } from '@/lib/utils';

/**
 * Exportação do organograma para impressão (spec 058): folha A0–A3, PDF ou JPG, com cabeçalho (logos do contratante e
 * da contratada, título, obra, data) e rodapé. A árvore é desenhada sem o zoom da tela, sem os controles de edição e
 * encaixada na área útil da folha.
 */

export const PAPEIS = { A0: [841, 1189], A1: [594, 841], A2: [420, 594], A3: [297, 420] } as const; // mm (retrato)
export type Papel = keyof typeof PAPEIS;
export type Orientacao = 'auto' | 'paisagem' | 'retrato';
export type ConteudoExportacao = 'tela' | 'tudo' | 'nomes';
const DPI: Record<Papel, number> = { A0: 150, A1: 200, A2: 250, A3: 300 };
const MAX_AREA = 32e6; // px por folha (memória do navegador)
const MAX_LADO = 16000;

/** Tamanho da folha em pixels (resolução reduzida só se passar do limite do navegador). */
export function folhaEmPixels(papel: Papel, orient: 'paisagem' | 'retrato') {
  const [a, b] = PAPEIS[papel];
  const [w, h] = orient === 'paisagem' ? [b, a] : [a, b];
  const dpi = DPI[papel];
  const W = (w / 25.4) * dpi;
  const H = (h / 25.4) * dpi;
  const k = Math.min(1, Math.sqrt(MAX_AREA / (W * H)), MAX_LADO / Math.max(W, H));
  return { W: Math.round(W * k), H: Math.round(H * k), w, h, pxMm: (W * k) / w };
}

const esperarPintura = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 80))));

function carregarImagem(src: string): Promise<HTMLImageElement | null> {
  return new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
}

/** Elementos que não vão para a impressão: controles de edição e o "−" dos ramos abertos ("+N" fica: mostra o que está fechado). */
function imprimivel(n: HTMLElement): boolean {
  if (!(n instanceof HTMLElement)) return true;
  if (n.dataset?.naoImprimir !== undefined) return false;
  if (n.tagName === 'BUTTON' && n.getAttribute('aria-expanded') === 'true' && n.dataset?.ramo !== undefined) return false;
  if (n.tagName === 'INPUT' && (n as HTMLInputElement).type === 'checkbox') return false;
  return true;
}

export async function gerarFolha(o: {
  no: HTMLElement; papel: Papel; orientacao: Orientacao; titulo: string; subtitulo: string; direita: string; logos: string[]; cor: string;
}): Promise<{ canvas: HTMLCanvasElement; w: number; h: number; orient: 'paisagem' | 'retrato' }> {
  const { toCanvas } = await import('html-to-image');
  const tw = o.no.offsetWidth;
  const th = o.no.offsetHeight;
  const orient = o.orientacao === 'auto' ? (tw >= th ? 'paisagem' : 'retrato') : o.orientacao;
  const f = folhaEmPixels(o.papel, orient);
  const mm = (x: number) => x * f.pxMm;
  const margem = mm(10);
  const curto = Math.min(f.w, f.h);
  const cab = mm(Math.min(42, Math.max(16, curto * 0.05)));
  const rod = mm(Math.min(10, Math.max(5, curto * 0.012)));
  const area = { x: margem, y: margem + cab + mm(4), w: f.W - 2 * margem, h: 0 };
  area.h = f.H - area.y - margem - rod - mm(2);
  const s = Math.min(area.w / tw, area.h / th);

  const arvore = await toCanvas(o.no, {
    pixelRatio: s, width: tw, height: th, backgroundColor: '#ffffff', cacheBust: true,
    style: { transform: 'none', margin: '0' }, filter: (n) => imprimivel(n as HTMLElement),
  });

  const canvas = document.createElement('canvas');
  canvas.width = f.W; canvas.height = f.H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, f.W, f.H);
  const fonte = getComputedStyle(document.body).fontFamily || 'sans-serif';

  // cabeçalho: logos à esquerda, título e obra ao lado, data/folha à direita, faixa na cor da obra
  let x = margem;
  const hLogo = cab * 0.72;
  for (const src of o.logos) {
    const img = await carregarImagem(src);
    if (!img || !img.naturalHeight) continue;
    const w = Math.min((img.naturalWidth / img.naturalHeight) * hLogo, area.w * 0.18);
    ctx.drawImage(img, x, margem + (cab - hLogo) / 2, w, hLogo);
    x += w + mm(6);
  }
  if (x > margem) { ctx.fillStyle = '#d0d5dd'; ctx.fillRect(x, margem + cab * 0.12, Math.max(1, mm(0.4)), cab * 0.76); x += mm(6); }
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#101828';
  ctx.font = `700 ${Math.round(cab * 0.34)}px ${fonte}`;
  ctx.fillText(o.titulo, x, margem + cab * 0.48, f.W - x - margem - mm(60));
  ctx.fillStyle = '#475467';
  ctx.font = `500 ${Math.round(cab * 0.2)}px ${fonte}`;
  ctx.fillText(o.subtitulo, x, margem + cab * 0.82, f.W - x - margem - mm(60));
  ctx.textAlign = 'right';
  ctx.font = `500 ${Math.round(cab * 0.18)}px ${fonte}`;
  o.direita.split('\n').forEach((l, i) => ctx.fillText(l, f.W - margem, margem + cab * (0.42 + i * 0.3)));
  ctx.textAlign = 'left';
  ctx.fillStyle = o.cor; ctx.fillRect(margem, margem + cab + mm(1), f.W - 2 * margem, Math.max(2, mm(0.8)));

  // árvore centralizada na área útil
  const dw = tw * s; const dh = th * s;
  ctx.drawImage(arvore, area.x + (area.w - dw) / 2, area.y, dw, dh);

  // rodapé
  ctx.fillStyle = '#667085';
  ctx.font = `400 ${Math.round(rod * 0.55)}px ${fonte}`;
  ctx.fillText('Malhet · Programação de Obra', margem, f.H - margem - rod * 0.2);
  ctx.textAlign = 'right';
  ctx.fillText(`Folha ${o.papel} · ${orient}`, f.W - margem, f.H - margem - rod * 0.2);
  ctx.textAlign = 'left';
  return { canvas, w: f.w, h: f.h, orient };
}

function baixar(url: string, nome: string) {
  const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
}

const nomeArquivo = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/_+/g, '_').slice(0, 80);

/** Botão + card de exportação. `preparar` abre a árvore como pedido e devolve a função que volta ao estado da tela. */
export function ExportarOrganograma({ alvo, preparar, tituloPadrao, pessoas, className }: {
  alvo: () => HTMLElement | null; preparar: (c: ConteudoExportacao) => () => void; tituloPadrao: string; pessoas: number; className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setAberto(true)}><FileDown size={14} /> Exportar impressão</button>
      {aberto && <CardExportar alvo={alvo} preparar={preparar} tituloPadrao={tituloPadrao} pessoas={pessoas} onFechar={() => setAberto(false)} />}
    </>
  );
}

function Segmentos<T extends string>({ rotulo, valor, opcoes, onTrocar }: { rotulo: string; valor: T; opcoes: readonly (readonly [T, string])[]; onTrocar: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">{rotulo}</span>
      <div className="inline-flex w-fit flex-wrap items-center gap-1 rounded-full border border-m-stroke p-0.5" role="group" aria-label={rotulo}>
        {opcoes.map(([v, r]) => (
          <button key={v} type="button" aria-pressed={valor === v} onClick={() => onTrocar(v)}
            className={cn('h-8 rounded-full px-3 text-[12.5px] font-semibold', valor === v ? 'bg-m-accent text-white' : 'text-m-text-secondary hover:bg-m-surface-hover')}>{r}</button>
        ))}
      </div>
    </div>
  );
}

function CardExportar({ alvo, preparar, tituloPadrao, pessoas, onFechar }: {
  alvo: () => HTMLElement | null; preparar: (c: ConteudoExportacao) => () => void; tituloPadrao: string; pessoas: number; onFechar: () => void;
}) {
  const obra = useObraOpcional()?.obra;
  const m = useMarcaObra();
  const cte = useLogo('contratante', m.data?.contratante, m.data?.versao);
  const cda = useLogo('contratada', m.data?.contratada, m.data?.versao);
  const [papel, setPapel] = useState<Papel>('A1');
  const [orientacao, setOrientacao] = useState<Orientacao>('auto');
  const [formato, setFormato] = useState<'pdf' | 'jpg'>('pdf');
  const [conteudo, setConteudo] = useState<ConteudoExportacao>('tela');
  const [titulo, setTitulo] = useState(tituloPadrao);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !gerando) onFechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar, gerando]);

  const gerar = async () => {
    setGerando(true);
    const html = document.documentElement;
    const escuro = html.classList.contains('dark');
    let voltar: (() => void) | null = null;
    try {
      voltar = preparar(conteudo);
      if (escuro) html.classList.remove('dark'); // a folha sai sempre no tema claro
      await esperarPintura();
      const no = alvo();
      if (!no) throw new Error('organograma não encontrado na tela');
      const logos = [cte.data, cda.data].filter(Boolean) as string[];
      const agora = new Date();
      const cor = getComputedStyle(html).getPropertyValue('--m-accent').trim() || '#0f766e';
      const { canvas, w, h, orient } = await gerarFolha({
        no, papel, orientacao, titulo, cor, logos: logos.length ? logos : ['/brand/malhet.svg'],
        subtitulo: [obra ? `${obra.codigo} · ${obra.nome}` : '', m.data?.nome_contratada ?? '', `${pessoas} pessoas`].filter(Boolean).join('  ·  '),
        direita: `Emitido em ${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\nFolha ${papel}`,
      });
      const nome = nomeArquivo(`${titulo}_${obra?.codigo ?? ''}_${papel}`);
      if (formato === 'jpg') {
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
        if (!blob) throw new Error('o navegador não gerou a imagem (folha grande demais?)');
        const url = URL.createObjectURL(blob); baixar(url, `${nome}.jpg`); setTimeout(() => URL.revokeObjectURL(url), 5000);
      } else {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({ orientation: orient === 'paisagem' ? 'landscape' : 'portrait', unit: 'mm', format: papel.toLowerCase() });
        pdf.setProperties({ title: titulo, creator: 'Malhet' });
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, w, h);
        pdf.save(`${nome}.pdf`);
      }
      toast.success(`Folha ${papel} (${orient}) gerada em ${formato.toUpperCase()}`);
      onFechar();
    } catch (e) {
      toast.error(`Não foi possível gerar: ${(e as Error).message}`);
    } finally {
      if (escuro) html.classList.add('dark');
      voltar?.();
      setGerando(false);
    }
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 p-4 pt-[8vh]" onMouseDown={(e) => { if (e.target === e.currentTarget && !gerando) onFechar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Exportar organograma para impressão" className="flex w-[600px] max-w-full flex-col gap-4 rounded-m-lg border border-m-stroke bg-m-surface-raised p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Exportar para impressão</p>
            <h3 className="text-[16px] font-semibold text-m-text-primary">Organograma com cabeçalho e logos da obra</h3>
          </div>
          <button type="button" aria-label="Fechar" disabled={gerando} onClick={onFechar} className="rounded-full p-1.5 text-m-text-muted hover:bg-m-surface-hover"><X size={18} /></button>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Título</span>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="h-9 rounded-m-md border border-m-stroke bg-m-surface-field px-3 text-[13px] text-m-text-primary" />
        </label>
        <Segmentos rotulo="Folha" valor={papel} onTrocar={setPapel} opcoes={[['A0', 'A0'], ['A1', 'A1'], ['A2', 'A2'], ['A3', 'A3']] as const} />
        <Segmentos rotulo="Orientação" valor={orientacao} onTrocar={setOrientacao} opcoes={[['auto', 'Automática'], ['paisagem', 'Paisagem'], ['retrato', 'Retrato']] as const} />
        <Segmentos rotulo="Arquivo" valor={formato} onTrocar={setFormato} opcoes={[['pdf', 'PDF'], ['jpg', 'JPG']] as const} />
        <Segmentos rotulo="Conteúdo" valor={conteudo} onTrocar={setConteudo}
          opcoes={[['tela', 'Como está na tela'], ['tudo', 'Tudo aberto'], ['nomes', 'Tudo aberto com nomes']] as const} />
        <p className="text-[12px] text-m-text-muted">
          A árvore é encaixada na folha sem o zoom da tela e sem os botões de edição; a espessura das linhas escolhida na tela vale
          para a folha. Organogramas grandes com nomes ficam mais legíveis em A0/A1.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" disabled={gerando} onClick={onFechar} className="h-9 rounded-full border border-m-stroke px-4 text-[13px] font-semibold text-m-text-primary hover:bg-m-surface-hover">Cancelar</button>
          <button type="button" disabled={gerando || !titulo.trim()} onClick={gerar} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-m-accent px-4 text-[13px] font-semibold text-white disabled:opacity-60">
            <FileDown size={15} /> {gerando ? 'Gerando…' : `Gerar ${formato.toUpperCase()} ${papel}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
