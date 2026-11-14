'use client';

import { FileDown, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { gerarFolha, type Orientacao, type Papel } from '@/components/Obra/ExportarOrganograma';
import { useLogo, useMarcaObra } from '@/components/Obra/LogosObra';
import { useObraOpcional } from '@/lib/obra/ObraProvider';
import { cn } from '@/lib/utils';

/**
 * Exportar um quadro da tela para impressão em folha grande (gestão à vista na obra — spec 085): A0, A1 ou A2 (e A3),
 * PDF ou JPG, com cabeçalho (logos do contratante e da contratada, título, obra, data) e rodapé. Usa a mesma montagem
 * da folha do organograma (`gerarFolha`). `preparar` deixa o quadro como deve sair (ex.: legenda dentro) e devolve a
 * função que volta a tela ao normal.
 */
export function ExportarQuadro({ alvo, preparar, tituloPadrao, detalhe, rotulo = 'Imprimir quadro', className }: {
  alvo: () => HTMLElement | null; preparar?: () => () => void; tituloPadrao: string; detalhe?: string; rotulo?: string; className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setAberto(true)}><FileDown size={15} /> {rotulo}</button>
      {aberto && <Card alvo={alvo} preparar={preparar} tituloPadrao={tituloPadrao} detalhe={detalhe} onFechar={() => setAberto(false)} />}
    </>
  );
}

const esperarPintura = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 120))));
const nomeArquivo = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/_+/g, '_').slice(0, 80);

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

function Card({ alvo, preparar, tituloPadrao, detalhe, onFechar }: {
  alvo: () => HTMLElement | null; preparar?: () => () => void; tituloPadrao: string; detalhe?: string; onFechar: () => void;
}) {
  const obra = useObraOpcional()?.obra;
  const m = useMarcaObra();
  const cte = useLogo('contratante', m.data?.contratante, m.data?.versao);
  const cda = useLogo('contratada', m.data?.contratada, m.data?.versao);
  const [papel, setPapel] = useState<Papel>('A1');
  const [orientacao, setOrientacao] = useState<Orientacao>('paisagem');
  const [formato, setFormato] = useState<'pdf' | 'jpg'>('pdf');
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
      voltar = preparar?.() ?? null;
      if (escuro) html.classList.remove('dark'); // a folha sai sempre no tema claro
      await esperarPintura();
      const no = alvo();
      if (!no) throw new Error('quadro não encontrado na tela');
      const logos = [cte.data, cda.data].filter(Boolean) as string[];
      const agora = new Date();
      const cor = getComputedStyle(html).getPropertyValue('--m-accent').trim() || '#0f766e';
      const { canvas, w, h, orient } = await gerarFolha({
        no, papel, orientacao, titulo, cor, logos: logos.length ? logos : ['/brand/malhet.svg'],
        subtitulo: [obra ? `${obra.codigo} · ${obra.nome}` : '', m.data?.nome_contratada ?? '', detalhe ?? ''].filter(Boolean).join('  ·  '),
        direita: `Emitido em ${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\nFolha ${papel}`,
      });
      const nome = nomeArquivo(`${titulo}_${obra?.codigo ?? ''}_${papel}`);
      if (formato === 'jpg') {
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
        if (!blob) throw new Error('o navegador não gerou a imagem (folha grande demais?)');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${nome}.jpg`; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
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
      <div role="dialog" aria-modal="true" aria-label="Imprimir quadro" className="flex w-[560px] max-w-full flex-col gap-4 rounded-m-lg border border-m-stroke bg-m-surface-raised p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Gestão à vista</p>
            <h3 className="text-[16px] font-semibold text-m-text-primary">Imprimir em folha grande, com cabeçalho e logos da obra</h3>
          </div>
          <button type="button" aria-label="Fechar" disabled={gerando} onClick={onFechar} className="rounded-full p-1.5 text-m-text-muted hover:bg-m-surface-hover"><X size={18} /></button>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Título</span>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="h-9 rounded-m-md border border-m-stroke bg-m-surface-field px-3 text-[13px] text-m-text-primary" />
        </label>
        <Segmentos rotulo="Folha" valor={papel} onTrocar={setPapel} opcoes={[['A0', 'A0 (1189 × 841 mm)'], ['A1', 'A1 (841 × 594)'], ['A2', 'A2 (594 × 420)'], ['A3', 'A3']] as const} />
        <Segmentos rotulo="Orientação" valor={orientacao} onTrocar={setOrientacao} opcoes={[['paisagem', 'Paisagem'], ['retrato', 'Retrato'], ['auto', 'Automática']] as const} />
        <Segmentos rotulo="Arquivo" valor={formato} onTrocar={setFormato} opcoes={[['pdf', 'PDF'], ['jpg', 'JPG']] as const} />
        <p className="text-[12px] text-m-text-muted">Sai o quadro inteiro da janela escolhida na tela (todas as semanas e raias), encaixado na folha, no tema claro. Para ler de longe no canteiro: A0/A1.</p>
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
