'use client';

/** Leitores da presença (spec 063): crachá NFC (Web NFC, Chrome no Android), código de barras/QR pela câmera
 * (BarcodeDetector) e o retorno rápido (vibrar + bipe) para a fila andar sem olhar para a tela. */

interface RegistroNdef { recordType: string; data?: DataView; encoding?: string }
interface EventoNdef { serialNumber?: string; message: { records: RegistroNdef[] } }
interface LeitorNdef { scan: (o?: { signal?: AbortSignal }) => Promise<void>; onreading: ((e: EventoNdef) => void) | null; onreadingerror: (() => void) | null }

export const temNfc = () => typeof window !== 'undefined' && 'NDEFReader' in window;
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
      .map((r) => dec.decode(r.data!).replace(/^.*[/=]/, '').trim()).filter(Boolean);
    onLer(e.serialNumber || null, textos);
  };
  ndef.onreadingerror = () => onErro('Não consegui ler o crachá. Aproxime de novo, devagar.');
  return () => ctrl.abort();
}

interface Detector { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> }

/** Lê códigos de barras/QR do vídeo continuamente; repete o mesmo código só depois de `intervalo` ms. */
export function escutarCodigos(video: HTMLVideoElement, onLer: (codigo: string) => void, intervalo = 2500): () => void {
  const D = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  const det = new D({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'itf', 'codabar', 'data_matrix', 'pdf417'] });
  let ativo = true;
  const ultimos = new Map<string, number>();
  const passo = async () => {
    if (!ativo) return;
    try {
      if (video.readyState >= 2) {
        for (const c of await det.detect(video)) {
          const agora = Date.now();
          if ((ultimos.get(c.rawValue) ?? 0) + intervalo < agora) { ultimos.set(c.rawValue, agora); onLer(c.rawValue); }
        }
      }
    } catch { /* quadro ruim: segue */ }
    setTimeout(passo, 120);
  };
  passo();
  return () => { ativo = false; };
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
