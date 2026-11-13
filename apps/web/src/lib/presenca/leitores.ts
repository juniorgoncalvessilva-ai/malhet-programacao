'use client';

/** Leitores da presença (spec 063): crachá NFC (Web NFC, Chrome no Android), código de barras/QR pela câmera
 * (BarcodeDetector) e o retorno rápido (vibrar + bipe) para a fila andar sem olhar para a tela. */

interface RegistroNdef { recordType: string; data?: DataView; encoding?: string }
interface EventoNdef { serialNumber?: string; message: { records: RegistroNdef[] } }
interface LeitorNdef { scan: (o?: { signal?: AbortSignal }) => Promise<void>; onreading: ((e: EventoNdef) => void) | null; onreadingerror: (() => void) | null }

export const temNfc = () => typeof window !== 'undefined' && 'NDEFReader' in window;
/** iPhone/iPad: a Apple não deixa nenhum navegador ler NFC num site (só o próprio iOS lê o link gravado na tag). */
export const ehIos = () => typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/** Link gravado no crachá (NFC) ou no QR: abre a Presença já com o código (spec 067). */
export const linkCracha = (codigo: string, meio: 'nfc' | 'qr') =>
  `${window.location.origin}/pt-BR/m/presenca?c=${encodeURIComponent(codigo)}&m=${meio}`;

/** Código dentro do que foi lido: o próprio texto, ou o `c=` quando for o link do crachá. */
export function codigoLido(bruto: string): string {
  const t = bruto.trim();
  if (/^https?:\/\//i.test(t)) {
    try { const u = new URL(t); return u.searchParams.get('c') || u.pathname.split('/').filter(Boolean).pop() || t; } catch { return t; }
  }
  return t;
}
export const temCodigoDeBarras = () => typeof window !== 'undefined' && 'BarcodeDetector' in window;
export const temCamera = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/** Começa a escutar crachás NFC; devolve a função que para. `textos` = conteúdo gravado na tag (ex.: a matrícula). */
export async function escutarNfc(onLer: (serial: string | null, textos: string[]) => void, onErro: (msg: string) => void): Promise<() => void> {
  const Leitor = (window as unknown as { NDEFReader: new () => LeitorNdef }).NDEFReader;
  const ndef = new Leitor();
  const ctrl = new AbortController();
  await ndef.scan({ signal: ctrl.signal });
  ndef.onreading = (e) => {
    const dec = new TextDecoder();
    const textos = e.message.records.filter((r) => r.data && (r.recordType === 'text' || r.recordType === 'url' || r.recordType === 'mime'))
      .map((r) => codigoLido(dec.decode(r.data!))).filter(Boolean);
    onLer(e.serialNumber || null, textos);
  };
  ndef.onreadingerror = () => onErro('Não consegui ler o crachá. Aproxime de novo, devagar.');
  return () => ctrl.abort();
}

interface Detector { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
type Decodificar = (v: HTMLVideoElement) => Promise<string[]>;

/** Leitor da câmera: o do navegador (Chrome no Android) ou, sem ele (iPhone/Safari), o ZXing em JavaScript (spec 067). */
async function decodificador(): Promise<Decodificar> {
  if (temCodigoDeBarras()) {
    const D = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    const det = new D({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'itf', 'codabar', 'data_matrix', 'pdf417'] });
    return async (v) => (await det.detect(v)).map((c) => c.rawValue);
  }
  const { BrowserMultiFormatReader } = await import('@zxing/browser');
  const leitor = new BrowserMultiFormatReader();
  const tela = document.createElement('canvas');
  return async (v) => {
    const w = v.videoWidth; const h = v.videoHeight;
    if (!w || !h) return [];
    tela.width = w; tela.height = h;
    tela.getContext('2d', { willReadFrequently: true })!.drawImage(v, 0, 0, w, h);
    try { return [leitor.decodeFromCanvas(tela).getText()]; } catch { return []; }
  };
}

/** Lê códigos de barras/QR do vídeo continuamente; repete o mesmo código só depois de `intervalo` ms. */
export function escutarCodigos(video: HTMLVideoElement, onLer: (codigo: string) => void, intervalo = 2500): () => void {
  let ativo = true;
  const ultimos = new Map<string, number>();
  decodificador().then((det) => {
    const passo = async () => {
      if (!ativo) return;
      try {
        if (video.readyState >= 2) {
          for (const bruto of await det(video)) {
            const c = codigoLido(bruto);
            const agora = Date.now();
            if ((ultimos.get(c) ?? 0) + intervalo < agora) { ultimos.set(c, agora); onLer(c); }
          }
        }
      } catch { /* quadro ruim: segue */ }
      setTimeout(passo, temCodigoDeBarras() ? 120 : 200);
    };
    passo();
  }).catch(() => undefined);
  return () => { ativo = false; };
}

/** Grava no crachá NFC o link da Presença com o código (Chrome no Android): o iPhone lê o link sozinho (spec 067). */
export async function gravarCracha(url: string, sinal?: AbortSignal): Promise<void> {
  const Leitor = (window as unknown as { NDEFReader: new () => { write: (m: unknown, o?: { signal?: AbortSignal; overwrite?: boolean }) => Promise<void> } }).NDEFReader;
  await new Leitor().write({ records: [{ recordType: 'url', data: url }] }, { signal: sinal, overwrite: true });
}

export async function abrirCamera(video: HTMLVideoElement, frente: 'environment' | 'user'): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: frente, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  video.muted = true;
  await video.play();
  return () => { stream.getTracks().forEach((t) => t.stop()); video.srcObject = null; };
}

let audio: AudioContext | null = null;
/** Retorno sem olhar: vibra e bipa (agudo = registrou; grave = já estava ou não achou). */
export function avisar(tipo: 'ok' | 'repetido' | 'erro') {
  try { navigator.vibrate?.(tipo === 'ok' ? 60 : tipo === 'repetido' ? [40, 60, 40] : [120, 60, 120]); } catch { /* sem vibração */ }
  try {
    audio ??= new AudioContext();
    const o = audio.createOscillator(); const g = audio.createGain();
    o.frequency.value = tipo === 'ok' ? 1320 : tipo === 'repetido' ? 660 : 220;
    g.gain.setValueAtTime(0.15, audio.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18);
    o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.2);
  } catch { /* sem som */ }
}
