'use client';

import { Keyboard, Nfc, ScanLine, SwitchCamera, UserCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cartaoM } from '@/components/Mobile/ui';
import { carregarFace, lerRosto, maisProximo } from '@/lib/presenca/face';
import { abrirCamera, avisar, ehIos, escutarCodigos, escutarNfc, temCamera, temNfc } from '@/lib/presenca/leitores';
import type { PessoaBase } from '@/lib/presenca/offline';

/** Leitores do app de campo (presença spec 063, etilômetro spec 073): crachá NFC, QR/código de barras (câmera ou leitor) e rosto. */
export function LeitorNfc({ onLer }: { onLer: (serial: string | null, textos: string[]) => void }) {
  const [estado, setEstado] = useState<'parado' | 'lendo' | 'erro'>('parado');
  const [msg, setMsg] = useState('');
  const parar = useRef<(() => void) | null>(null);
  useEffect(() => () => parar.current?.(), []);
  if (!temNfc()) return ehIos() ? (
    <section className={`${cartaoM} text-[14px] text-m-text-secondary`}>
      <b className="text-m-text-primary">No iPhone o navegador não lê NFC</b> (a Apple não libera o NFC para sites, nem no Chrome nem no Safari). Funciona assim:
      <ul className="list-disc pl-5">
        <li><b>Crachá com link gravado</b>: aproxime o crachá da parte de cima do iPhone, toque na notificação e a presença entra aqui sozinha. O link é gravado uma vez por um Android em Efetivo › Crachá e rosto.</li>
        <li><b>Código</b>: lê o QR ou o código de barras do crachá pela câmera, um atrás do outro — o mais rápido no iPhone.</li>
        <li><b>Rosto</b>: reconhecimento pela câmera.</li>
      </ul>
    </section>
  ) : <p className={`${cartaoM} text-[14px] text-m-text-secondary`}>Este navegador não lê NFC. A leitura NFC funciona no Chrome do Android, com o site em HTTPS. Use <b>Código</b> ou <b>Rosto</b>.</p>;
  const comecar = async () => {
    try {
      parar.current = await escutarNfc((s, t) => onLer(s, t), (m) => { setMsg(m); avisar('erro'); });
      setEstado('lendo'); setMsg('');
    } catch (e) { setEstado('erro'); setMsg((e as Error).message || 'Permita o NFC para este site.'); }
  };
  return (
    <section className="flex flex-col items-center gap-3 rounded-[20px] bg-m-accent-strong p-6 text-m-on-accent">
      <span className={`grid h-28 w-28 place-items-center rounded-full border-2 border-white/35 ${estado === 'lendo' ? 'animate-pulse shadow-[0_0_0_14px_rgba(255,255,255,0.08),0_0_0_28px_rgba(255,255,255,0.04)]' : ''}`}><Nfc size={44} /></span>
      {estado === 'lendo' ? (
        <><span className="text-[17px] font-semibold">Aproxime o crachá do celular</span><span className="text-[13px] opacity-80">Pode passar um atrás do outro</span></>
      ) : (
        <button type="button" onClick={comecar} className="h-[52px] rounded-full bg-white px-6 text-[15px] font-semibold text-m-accent-strong">Começar a ler crachás</button>
      )}
      {msg && <span className="text-center text-[13px] opacity-90">{msg}</span>}
    </section>
  );
}

export function LeitorCodigo({ onLer }: { onLer: (codigo: string, meio: 'qr' | 'codigo') => void }) {
  const [txt, setTxt] = useState('');
  const [camera, setCamera] = useState(false);
  const [erro, setErro] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => { campo.current?.focus(); }, []);
  useEffect(() => {
    if (!camera || !video.current) return;
    let fechar: (() => void) | null = null; let parar: (() => void) | null = null;
    abrirCamera(video.current, 'environment')
      .then((f) => { fechar = f; parar = escutarCodigos(video.current!, (c) => onLer(c, 'qr')); })
      .catch((e) => { setErro((e as Error).message || 'Sem acesso à câmera'); setCamera(false); });
    return () => { parar?.(); fechar?.(); };
  }, [camera]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className={cartaoM}>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (txt.trim()) { onLer(txt.trim(), 'codigo'); setTxt(''); } campo.current?.focus(); }}>
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-[14px] border-2 border-m-accent-strong px-3">
          <Keyboard size={18} className="shrink-0 text-m-text-muted" aria-hidden="true" />
          <input ref={campo} value={txt} onChange={(e) => setTxt(e.target.value)} inputMode="text" autoComplete="off" aria-label="Matrícula ou código do crachá"
            placeholder="Matrícula ou leitor de código" className="h-12 min-w-0 flex-1 border-0 bg-transparent p-0 text-[17px] outline-none focus:ring-0" />
        </label>
        <button type="submit" className="h-12 rounded-full bg-m-accent-strong px-4 text-[15px] font-semibold text-m-on-accent">OK</button>
      </form>
      <span className="text-[12px] text-m-text-muted">Leitor de código de barras Bluetooth/USB também funciona aqui: cada leitura entra sozinha.</span>
      {temCamera() ? (
        camera ? (
          <div className="relative overflow-hidden rounded-[14px] bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={video} className="aspect-[4/3] w-full object-cover" />
            <span className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80" aria-hidden="true" />
            <button type="button" onClick={() => setCamera(false)} className="absolute bottom-2 right-2 h-10 rounded-full bg-white/90 px-4 text-[13px] font-semibold">Fechar câmera</button>
          </div>
        ) : (
          <button type="button" onClick={() => { setErro(''); setCamera(true); }} className="flex h-[52px] items-center justify-center gap-2 rounded-full border border-m-stroke text-[15px] font-semibold text-m-accent"><ScanLine size={18} /> Ler QR / código pela câmera</button>
        )
      ) : <span className="text-[12px] text-m-text-muted">Sem acesso à câmera neste navegador (precisa do site em HTTPS) — digite ou use um leitor.</span>}
      {erro && <span className="text-[13px] text-m-danger">{erro}</span>}
    </section>
  );
}

/** Foto do rosto no momento da leitura (recorte em volta da caixa, até 360 px, JPEG) — evidência da assinatura (spec 074). */
async function fotoDoRosto(v: HTMLVideoElement, caixa: { x: number; y: number; w: number; h: number }): Promise<Blob | null> {
  const m = 0.6; const x = Math.max(0, caixa.x - caixa.w * m); const y = Math.max(0, caixa.y - caixa.h * m);
  const w = Math.min(v.videoWidth - x, caixa.w * (1 + 2 * m)); const h = Math.min(v.videoHeight - y, caixa.h * (1 + 2 * m));
  if (w <= 0 || h <= 0) return null;
  const k = Math.min(1, 360 / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d')!.drawImage(v, x, y, w, h, 0, 0, c.width, c.height);
  return new Promise((ok) => c.toBlob((b) => ok(b), 'image/jpeg', 0.82));
}

export function LeitorFacial({ pessoas, limite, onLer, capturar = false }: {
  pessoas: PessoaBase[]; limite: number; onLer: (p: PessoaBase, extra: { foto: Blob | null; distancia: number }) => void; capturar?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [frente, setFrente] = useState<'environment' | 'user'>('environment');
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando');
  const [msg, setMsg] = useState('Carregando o reconhecimento facial…');
  const [caixa, setCaixa] = useState<{ x: number; y: number; w: number; h: number; nome?: string } | null>(null);
  const comRosto = useMemo(() => pessoas.filter((p) => p.face), [pessoas]);
  const ler = useRef(onLer); ler.current = onLer;

  useEffect(() => {
    if (!temCamera()) { setEstado('erro'); setMsg('Sem acesso à câmera neste navegador (precisa de HTTPS).'); return; }
    if (!comRosto.length) { setEstado('erro'); setMsg('Ninguém com rosto cadastrado. Cadastre em Efetivo › Crachá e rosto.'); return; }
    let vivo = true; let fechar: (() => void) | null = null;
    const ultimo = new Map<number, number>();
    let anterior: number | null = null;
    (async () => {
      try {
        await carregarFace();
        fechar = await abrirCamera(video.current!, frente);
        setEstado('pronto'); setMsg('Enquadre um rosto por vez');
        while (vivo) {
          const v = video.current;
          const r = v && v.readyState >= 2 ? await lerRosto(v, 224) : null;
          if (!vivo) break;
          if (r && v) {
            const k = v.clientWidth / (v.videoWidth || 1);
            const m = maisProximo(r.descritor, comRosto, limite);
            setCaixa({ x: r.caixa.x * k, y: r.caixa.y * k, w: r.caixa.w * k, h: r.caixa.h * k, nome: m?.pessoa.nome });
            // duas leituras seguidas da mesma pessoa = confirmada; a mesma pessoa só de novo depois de 5 s
            if (m && anterior === m.pessoa.id && (ultimo.get(m.pessoa.id) ?? 0) + 5000 < Date.now()) {
              ultimo.set(m.pessoa.id, Date.now()); ler.current(m.pessoa, { foto: capturar ? await fotoDoRosto(v, r.caixa) : null, distancia: m.dist });
            }
            anterior = m?.pessoa.id ?? null;
          } else { setCaixa(null); anterior = null; await new Promise((x) => setTimeout(x, 120)); }
        }
      } catch (e) { if (vivo) { setEstado('erro'); setMsg((e as Error).message || 'Não consegui abrir a câmera'); } }
    })();
    return () => { vivo = false; fechar?.(); };
  }, [frente, comRosto, limite, capturar]);

  return (
    <section className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-[20px] bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={video} className={`aspect-[3/4] w-full object-cover ${frente === 'user' ? '-scale-x-100' : ''}`} />
        {caixa && (
          <span className={`absolute rounded-[10px] border-[3px] ${caixa.nome ? 'border-green-400' : 'border-yellow-300'} ${frente === 'user' ? '-scale-x-100' : ''}`}
            style={{ left: caixa.x, top: caixa.y, width: caixa.w, height: caixa.h }} aria-hidden="true" />
        )}
        <span className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2 text-center text-[13px] font-semibold text-white">{caixa?.nome ?? msg}</span>
        <button type="button" aria-label="Trocar câmera" onClick={() => setFrente((f) => (f === 'user' ? 'environment' : 'user'))}
          className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full bg-white/85 text-m-accent-strong"><SwitchCamera size={20} /></button>
      </div>
      {estado === 'carregando' && <span className="text-center text-[12px] text-m-text-muted">Na primeira vez baixa ~6 MB; depois funciona sem internet.</span>}
      {estado === 'pronto' && <span className="flex items-center justify-center gap-1 text-[12px] text-m-text-muted"><UserCheck size={14} /> {comRosto.length} pessoas com rosto cadastrado</span>}
    </section>
  );
}

