'use client';

import { Nfc, Printer, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Botao } from '@/components/Obra/ui';
import { gravarCracha, linkCracha, temNfc } from '@/lib/presenca/leitores';

export interface PessoaCracha { id: number; nome: string; matricula: string | null; cracha: string | null; codigo: string | null; funcao: string | null; equipe: string | null }
export const codigoDoCracha = (p: PessoaCracha) => p.matricula || p.cracha || p.codigo;

/** Etiquetas de QR do crachá (spec 067): o QR é o link da Presença com o código — a câmera do app (ou a do iPhone) lê. */
export async function imprimirEtiquetas(pessoas: PessoaCracha[], obra: string) {
  const QR = await import('qrcode');
  const comCodigo = pessoas.filter((p) => codigoDoCracha(p));
  if (!comCodigo.length) { toast.error('Ninguém com matrícula/código na lista'); return; }
  const janela = window.open('', '_blank');
  if (!janela) { toast.error('Permita abrir janelas para imprimir as etiquetas'); return; }
  const cartoes = await Promise.all(comCodigo.map(async (p) => {
    const img = await QR.toDataURL(linkCracha(codigoDoCracha(p)!, 'qr'), { margin: 1, width: 220, errorCorrectionLevel: 'M' });
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
    return `<div class="e"><img src="${img}" alt=""><b>${esc(p.nome)}</b><span>${esc([codigoDoCracha(p), p.funcao].filter(Boolean).join(' · '))}</span><span>${esc(p.equipe ?? '')}</span></div>`;
  }));
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Etiquetas QR · ${obra}</title>
<style>body{font-family:system-ui,sans-serif;margin:8mm}h1{font-size:14px;margin:0 0 6mm}.g{display:grid;grid-template-columns:repeat(4,1fr);gap:4mm}
.e{border:1px dashed #999;border-radius:6px;padding:3mm;display:flex;flex-direction:column;align-items:center;text-align:center;break-inside:avoid;font-size:10px}
.e img{width:32mm;height:32mm}.e b{font-size:11px;margin-top:1mm}@media print{h1{display:none}}</style></head>
<body><h1>${comCodigo.length} etiqueta(s) · ${obra} · recorte e cole no crachá</h1><div class="g">${cartoes.join('')}</div>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
  janela.document.close();
}

/** Gravar o link nos crachás NFC em sequência (Chrome no Android): aproxima um, grava, passa para o próximo. */
export function GravarEmSequencia({ pessoas, onFechar }: { pessoas: PessoaCracha[]; onFechar: () => void }) {
  const fila = pessoas.filter((p) => codigoDoCracha(p));
  const [i, setI] = useState(0);
  const [msg, setMsg] = useState('Aproxime o crachá da parte de trás do celular');
  const ctrl = useRef<AbortController | null>(null);
  const atual = fila[i];
  useEffect(() => {
    if (!atual) return;
    const c = new AbortController(); ctrl.current = c;
    setMsg('Aproxime o crachá da parte de trás do celular');
    gravarCracha(linkCracha(codigoDoCracha(atual)!, 'nfc'), c.signal)
      .then(() => { try { navigator.vibrate?.(80); } catch { /* */ } toast.success(`Crachá de ${atual.nome} gravado`); setI((x) => x + 1); })
      .catch((e) => { if (!c.signal.aborted) setMsg(`Não gravou: ${(e as Error).message || 'tente de novo'}. Aproxime de novo.`); });
    return () => c.abort();
  }, [i, atual]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-label="Gravar crachás" className="flex w-[440px] max-w-full flex-col items-center gap-3 rounded-m-lg bg-m-surface-raised p-5 text-center">
        <div className="flex w-full justify-between text-[12px] text-m-text-muted"><span>{Math.min(i + 1, fila.length)} de {fila.length}</span>
          <button type="button" aria-label="Fechar" onClick={() => { ctrl.current?.abort(); onFechar(); }}><X size={18} /></button></div>
        {atual ? (
          <>
            <Nfc size={44} className="animate-pulse text-m-accent" />
            <b className="text-[18px]">{atual.nome}</b>
            <span className="text-[13px] text-m-text-secondary">{[codigoDoCracha(atual), atual.funcao, atual.equipe].filter(Boolean).join(' · ')}</span>
            <span className="text-[13px]">{msg}</span>
            <Botao variante="secundario" onClick={() => setI((x) => x + 1)}>Pular esta pessoa</Botao>
          </>
        ) : (
          <><b className="text-[17px]">Pronto: {fila.length} crachá(s)</b><Botao onClick={onFechar}>Fechar</Botao></>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function AcoesCrachas({ pessoas, obra }: { pessoas: PessoaCracha[]; obra: string }) {
  const [gravando, setGravando] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Botao variante="secundario" onClick={() => imprimirEtiquetas(pessoas.slice(0, 400), obra)}><Printer size={15} /> Etiquetas QR ({Math.min(pessoas.length, 400)})</Botao>
      {temNfc() && <Botao variante="secundario" onClick={() => setGravando(true)}><Nfc size={15} /> Gravar link nos crachás NFC</Botao>}
      {gravando && <GravarEmSequencia pessoas={pessoas} onFechar={() => setGravando(false)} />}
    </div>
  );
}
