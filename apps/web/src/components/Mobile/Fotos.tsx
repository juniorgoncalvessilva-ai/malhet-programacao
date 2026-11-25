'use client';

import { useQuery } from '@tanstack/react-query';
import { Camera, Download, Lock, Type, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useApi } from '@/hooks/programacao/useApi';
import { useLogo, useMarcaObra } from '@/components/Obra/LogosObra';
import { BotaoMarcar } from '@/components/Mobile/MarcarFoto';
import { useObraOpcional } from '@/lib/obra/ObraProvider';
import { emAppNativo } from '@/lib/presenca/leitores';

/** Reduz a foto no próprio celular (lado maior 1600 px, JPEG 0,8) antes de enviar: menos dados móveis. */
export async function reduzirFoto(arq: File, maior = 1600): Promise<Blob> {
  const url = URL.createObjectURL(arq);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falha(new Error('Não consegui abrir a imagem')); i.src = url; });
    const k = Math.min(1, maior / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error('foto inválida'))), 'image/jpeg', 0.8));
  } finally { URL.revokeObjectURL(url); }
}

/** Momento em que cada foto foi tirada/escolhida (para o carimbo de data e hora). */
export const momentoDaFoto = new WeakMap<Blob, Date>();
/**
 * Logo da empresa (contratada, da Marca da obra) que entra no carimbo de toda foto (spec 120). Fica guardada no aparelho
 * por obra, reduzida, para carimbar também sem internet.
 */
let logoCarimbo: HTMLImageElement | null = null;
const CHAVE_LOGO = 'malhet.logo-carimbo.';
const abrirImagem = (src: string) => new Promise<HTMLImageElement>((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falha(new Error('Não consegui abrir a imagem')); i.src = src; });

/** Logo do carimbo por endereço (o portal do encarregado, sem conta do Malhet, já tem a URL pública da logo). */
export function definirLogoCarimbo(src: string | null) {
  if (!src) { logoCarimbo = null; return; }
  void abrirImagem(src).then((i) => { logoCarimbo = i; }).catch(() => undefined);
}

/** Carrega a logo da contratada da obra corrente para o carimbo (do aparelho na hora; da API quando muda). */
export function useLogoNoCarimbo() {
  const obraId = useObraOpcional()?.obra?.id;
  const m = useMarcaObra();
  const logo = useLogo('contratada', m.data?.contratada, m.data?.versao);
  useEffect(() => {
    if (!obraId) return;
    try { const salvo = localStorage.getItem(CHAVE_LOGO + obraId); if (salvo) void abrirImagem(salvo).then((i) => { logoCarimbo = i; }).catch(() => undefined); } catch { /* sem storage */ }
  }, [obraId]);
  useEffect(() => {
    if (!obraId || !m.data) return;
    if (!m.data.contratada) { logoCarimbo = null; try { localStorage.removeItem(CHAVE_LOGO + obraId); } catch { /* sem storage */ } return; }
    if (!logo.data) return;
    void abrirImagem(logo.data).then((img) => {
      // guarda reduzida (até 360 px de largura), em PNG para manter o fundo transparente
      const k = Math.min(1, 360 / img.naturalWidth);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/png');
      try { localStorage.setItem(CHAVE_LOGO + obraId, url); } catch { /* cheio: fica só nesta sessão */ }
      return abrirImagem(url).then((i) => { logoCarimbo = i; });
    }).catch(() => undefined);
  }, [obraId, m.data, logo.data]);
}

/**
 * Texto do carimbo editado pela pessoa (spec 145): a data e a hora nunca mudam; as outras linhas sim. `base` = as linhas
 * que a tela mostrava ao editar — no carimbo, só elas são trocadas; as que a tela acrescenta ao salvar ("Restrição Nº 12",
 * "OCORRÊNCIA") continuam.
 */
export interface TextoFoto { base: string[]; linhas: string[] }
export const textoDaFoto = new WeakMap<Blob, TextoFoto>();
const normT = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export function aplicarTexto(linhas: string[], ed?: TextoFoto): string[] {
  if (!ed) return linhas;
  const base = ed.base.map(normT).filter(Boolean);
  const coberta = (l: string) => { const n = normT(l); return !!n && base.some((b) => n === b || (b.length >= 6 && n.includes(b))); };
  const out: string[] = [];
  let pos = -1;
  for (const l of linhas) {
    if (coberta(l)) { if (pos < 0) pos = out.length; } else out.push(l);
  }
  out.splice(pos < 0 ? out.length : pos, 0, ...ed.linhas.map((x) => x.trim()).filter(Boolean));
  return out;
}

/** Fotos que já saíram de carimbarFoto: o envio não carimba de novo. */
const carimbadas = new WeakSet<Blob>();
export const dataHoraBR = (d: Date) => `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

/**
 * Carimbo na foto, como os apps de "timestamp camera" (spec 061): faixa escura no rodapé com a data e a hora em destaque
 * e as linhas seguintes (frente de serviço, obra…). Devolve um JPEG novo; a foto original não é alterada.
 */
export async function carimbarFoto(foto: Blob, linhas: string[], quando = momentoDaFoto.get(foto) ?? new Date()): Promise<Blob> {
  linhas = aplicarTexto(linhas, textoDaFoto.get(foto)); // spec 145: o texto que a pessoa editou (data e hora não)
  const url = URL.createObjectURL(foto);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falha(new Error('Não consegui abrir a imagem')); i.src = url; });
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
    // logo da empresa no canto de baixo, à direita, num cartão branco (a logo costuma ser escura e sem fundo)
    let reservado = 0;
    const lg = logoCarimbo;
    if (lg && lg.naturalWidth && lg.naturalHeight) {
      const h = Math.min(alt - pad * 2, Math.round(base * 3.2));
      const w = Math.min(Math.round(h * (lg.naturalWidth / lg.naturalHeight)), Math.round(c.width * 0.3));
      const hh = Math.round(w * (lg.naturalHeight / lg.naturalWidth));
      const m = Math.round(base * 0.35);
      const x0 = c.width - pad - w - m * 2, y0 = c.height - pad - hh - m * 2;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      const r = Math.round(m * 1.2);
      ctx.beginPath(); ctx.moveTo(x0 + r, y0); ctx.arcTo(x0 + w + m * 2, y0, x0 + w + m * 2, y0 + hh + m * 2, r);
      ctx.arcTo(x0 + w + m * 2, y0 + hh + m * 2, x0, y0 + hh + m * 2, r); ctx.arcTo(x0, y0 + hh + m * 2, x0, y0, r); ctx.arcTo(x0, y0, x0 + w + m * 2, y0, r);
      ctx.closePath(); ctx.fill();
      ctx.drawImage(lg, x0 + m, y0 + m, w, hh);
      reservado = w + m * 2 + pad;
    }
    ctx.textBaseline = 'top';
    for (const x of textos) {
      ctx.font = `${x.peso} ${x.px}px Figtree, system-ui, sans-serif`;
      ctx.lineWidth = Math.max(2, x.px / 8); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.fillStyle = x === textos[0] ? '#FFD54F' : '#FFFFFF';
      ctx.strokeText(x.t, pad, y, c.width - pad * 2 - reservado); ctx.fillText(x.t, pad, y, c.width - pad * 2 - reservado);
      y += x.px * 1.3;
    }
    const pronta = await new Promise<Blob>((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error('foto inválida'))), 'image/jpeg', 0.85));
    carimbadas.add(pronta);
    return pronta;
  } finally { URL.revokeObjectURL(url); }
}

/**
 * Envia a foto de campo. Toda foto sai carimbada com a data e a hora em que foi tirada (spec 119: as de Lançar o dia e de
 * Ocorrência subiam sem carimbo): `carimbo` são as linhas de baixo (frente, atividade); a obra entra sempre. Foto que já
 * passou por carimbarFoto vai como está.
 */
export function useEnviarFoto() {
  const api = useApi();
  const obra = useObraOpcional()?.obra?.nome;
  useLogoNoCarimbo();
  return async (alvo: 'desvio' | 'restricao' | 'linha' | 'auditoria' | 'acao' | 'registro', alvoId: number, foto: Blob,
    extra?: { data?: string; legenda?: string; carimbo?: string[] }) => {
    if (!carimbadas.has(foto)) {
      try { foto = await carimbarFoto(foto, [...(extra?.carimbo ?? []), obra ?? '']); } catch { /* foto que o navegador não abre vai sem carimbo */ }
    }
    const fd = new FormData();
    fd.append('alvo', alvo); fd.append('alvo_id', String(alvoId));
    if (extra?.data) fd.append('data', extra.data);
    if (extra?.legenda) fd.append('legenda', extra.legenda);
    fd.append('arquivo', foto, 'foto.jpg');
    return api.post<{ id: number }>('/fotos', fd);
  };
}

/**
 * Baixa a foto original (spec 119) com o nome que o servidor dá (data-hora-frente-tipo-id.jpg). No app nativo, onde o
 * download do WebView não salva, abre o compartilhar do celular (Salvar imagem, WhatsApp…).
 */
export async function baixarFoto(api: ReturnType<typeof useApi>, id: number) {
  const caminho = `/fotos/${id}/arquivo?baixar=true`;
  try {
    if (emAppNativo() && typeof navigator.canShare === 'function') {
      const b = await api.blob(caminho);
      const arq = new File([b], `foto-${id}.jpg`, { type: b.type || 'image/jpeg' });
      if (navigator.canShare({ files: [arq] })) { await navigator.share({ files: [arq] }); return; }
    }
    await api.download(caminho, `foto-${id}.jpg`);
  } catch (e) {
    if ((e as Error).name !== 'AbortError') toast.error('Não consegui baixar a foto');
  }
}

/** Miniatura de uma foto já enviada (abre em tela cheia ao tocar). */
export function Miniatura({ id, tamanho = 64 }: { id: number; tamanho?: number }) {
  const api = useApi();
  // miniatura (≈30 KB) na lista; o original só quando abre em tela cheia (spec 082)
  const q = useQuery({ queryKey: ['foto', id, 'mini'], queryFn: async () => URL.createObjectURL(await api.blob(`/fotos/${id}/arquivo?mini=true`)), staleTime: Infinity });
  const [cheia, setCheia] = useState(false);
  const original = useQuery({ queryKey: ['foto', id], enabled: cheia, queryFn: async () => URL.createObjectURL(await api.blob(`/fotos/${id}/arquivo`)), staleTime: Infinity });
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
          <img src={original.data ?? q.data} alt="Foto de campo" className="max-h-full max-w-full rounded-[10px]" />
          <button type="button" aria-label="Baixar a foto" onClick={(e) => { e.stopPropagation(); void baixarFoto(api, id); }}
            className="absolute left-4 top-4 flex h-11 items-center gap-2 rounded-full bg-white/15 px-4 text-[14px] font-semibold text-white"><Download size={18} /> Baixar</button>
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
  const obraNome = useObraOpcional()?.obra?.nome;
  // o que a tela mostra no carimbo (a obra entra sempre no envio): é isso que a pessoa pode editar (spec 145)
  const base = carimbo ? [...carimbo.filter(Boolean), ...(obraNome && !carimbo.includes(obraNome) ? [obraNome] : [])] : [];
  useLogoNoCarimbo(); // toda tela que tira foto já tem a logo pronta para o carimbo
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
        <span className="text-[12px] leading-4 text-m-text-muted">Lápis marca na foto; Aa edita o texto. Carimbo: data e hora{base.length ? ` · ${base.join(' · ')}` : ''}</span>
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
              <BotaoMarcar foto={fotos[k]} onMarcada={(b) => onChange(fotos.map((f, j) => (j === k ? b : f)))} className="absolute -left-2 -top-2" />
              {carimbo && <BotaoTextoFoto foto={fotos[k]} base={base} onMudou={() => onChange([...fotos])} className="absolute -bottom-2 -right-2" />}
              <button type="button" aria-label={`Tirar a foto ${k + 1}`} onClick={() => onChange(fotos.filter((_, j) => j !== k))} className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-m-surface-raised text-m-text-secondary shadow"><X size={14} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * "Aa" numa foto ainda não enviada (spec 145): edita as linhas do carimbo. A data e a hora em que a foto foi tirada
 * aparecem travadas — não são editáveis.
 */
export function BotaoTextoFoto({ foto, base, onMudou, className = '' }: { foto: Blob; base: string[]; onMudou: () => void; className?: string }) {
  const [aberto, setAberto] = useState(false);
  const editado = textoDaFoto.has(foto);
  return (
    <>
      <button type="button" aria-label="Editar o texto da foto" title="Editar o texto do carimbo (data e hora não mudam)" onClick={() => setAberto(true)}
        className={`grid h-7 w-7 place-items-center rounded-full shadow ${editado ? 'bg-[#FFD54F] text-black' : 'bg-m-surface-raised text-m-text-secondary'} ${className}`}>
        <Type size={13} />
      </button>
      {aberto && typeof document !== 'undefined' && createPortal(
        <EditarTextoFoto foto={foto} base={base} onFechar={() => setAberto(false)} onSalvo={() => { setAberto(false); onMudou(); }} />, document.body)}
    </>
  );
}

const MAX_LINHAS = 6;
function EditarTextoFoto({ foto, base, onFechar, onSalvo }: { foto: Blob; base: string[]; onFechar: () => void; onSalvo: () => void }) {
  const atual = textoDaFoto.get(foto);
  const [linhas, setLinhas] = useState<string[]>(atual?.linhas ?? (base.length ? base : ['']));
  const quando = momentoDaFoto.get(foto) ?? new Date();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);
  const salvar = () => {
    const ls = linhas.map((x) => x.trim()).filter(Boolean);
    const igual = ls.length === base.length && ls.every((x, i) => x === base[i]);
    if (igual) textoDaFoto.delete(foto); else textoDaFoto.set(foto, { base: atual?.base ?? base, linhas: ls });
    onSalvo();
  };
  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center p-3 font-[Figtree,system-ui,sans-serif] sm:items-center" role="dialog" aria-modal="true" aria-labelledby="texto-foto-titulo">
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/50" onClick={onFechar} />
      <div className="relative flex max-h-[90vh] w-full max-w-[440px] flex-col gap-3 overflow-y-auto rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-5 text-m-text-primary">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="texto-foto-titulo" className="text-[17px] font-semibold leading-6">Texto da foto</h2>
            <p className="text-[13px] text-m-text-tertiary">O que sai escrito no rodapé da foto.</p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full text-m-text-muted hover:bg-m-surface-hover"><X size={18} /></button>
        </div>
        <div className="flex items-center gap-2 rounded-[14px] bg-m-surface-active px-3.5 py-3" aria-label="Data e hora da foto (não editável)">
          <Lock size={15} className="shrink-0 text-m-text-muted" aria-hidden="true" />
          <span className="flex flex-col">
            <b className="text-[16px] tabular-nums">{dataHoraBR(quando)}</b>
            <span className="text-[11.5px] text-m-text-muted">Data e hora em que a foto foi tirada — não dá para mudar</span>
          </span>
        </div>
        {linhas.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={l} maxLength={90} aria-label={`Linha ${i + 1} do texto`} onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? e.target.value : x)))}
              className="h-11 min-w-0 flex-1 rounded-[12px] border border-m-stroke bg-m-surface-field px-3 text-[15px] outline-none focus:border-m-accent" />
            <button type="button" aria-label={`Tirar a linha ${i + 1}`} onClick={() => setLinhas(linhas.filter((_, j) => j !== i))}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-m-text-muted hover:bg-m-surface-hover"><X size={16} /></button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {linhas.length < MAX_LINHAS && <button type="button" onClick={() => setLinhas([...linhas, ''])} className="h-9 rounded-full border border-m-stroke px-3 text-[13px] font-semibold text-m-text-secondary">+ Linha</button>}
          {textoDaFoto.has(foto) && <button type="button" onClick={() => setLinhas(base)} className="h-9 rounded-full px-3 text-[13px] text-m-text-secondary hover:bg-m-surface-hover">Voltar ao texto padrão</button>}
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onFechar} className="h-11 flex-1 rounded-full border border-m-stroke text-[14px] font-semibold text-m-text-secondary">Cancelar</button>
          <button type="button" onClick={salvar} className="h-11 flex-1 rounded-full bg-m-accent-strong text-[14px] font-semibold text-m-on-accent">Salvar texto</button>
        </div>
      </div>
    </div>
  );
}
