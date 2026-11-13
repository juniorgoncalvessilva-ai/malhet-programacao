'use client';

/**
 * Reconhecimento facial no próprio celular (spec 063), sem internet: detector leve + descritor de 128 números
 * (@vladmandic/face-api). Os modelos (~6,5 MB) vêm de /models/face e o service worker guarda na primeira vez.
 * Guardamos e comparamos só o descritor — a foto nunca sai do aparelho.
 */
type FaceApi = typeof import('@vladmandic/face-api');
let carga: Promise<FaceApi> | null = null;

export function carregarFace(): Promise<FaceApi> {
  carga ??= (async () => {
    const f = (await import('@vladmandic/face-api')) as FaceApi;
    const tf = f.tf as unknown as { setBackend: (b: string) => Promise<boolean>; ready: () => Promise<void> };
    try { await tf.setBackend('webgl'); } catch { /* sem WebGL: usa o padrão */ }
    await tf.ready();
    await Promise.all([
      f.nets.tinyFaceDetector.loadFromUri('/models/face'),
      f.nets.faceLandmark68TinyNet.loadFromUri('/models/face'),
      f.nets.faceRecognitionNet.loadFromUri('/models/face'),
    ]);
    return f;
  })().catch((e) => { carga = null; throw e; });
  return carga;
}

export interface RostoLido { descritor: Float32Array; caixa: { x: number; y: number; w: number; h: number }; score: number }

/** Um rosto no quadro (o maior), com o descritor; null se não há rosto nítido. `tamanho` menor = mais rápido. */
export async function lerRosto(el: HTMLVideoElement | HTMLCanvasElement, tamanho = 224): Promise<RostoLido | null> {
  const f = await carregarFace();
  const r = await f.detectSingleFace(el, new f.TinyFaceDetectorOptions({ inputSize: tamanho, scoreThreshold: 0.5 }))
    .withFaceLandmarks(true).withFaceDescriptor();
  if (!r) return null;
  const b = r.detection.box;
  return { descritor: r.descriptor, caixa: { x: b.x, y: b.y, w: b.width, h: b.height }, score: r.detection.score };
}

export function distancia(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

/** A pessoa de rosto mais próximo, se abaixo do limite (e com folga sobre a segunda, para não confundir parecidos). */
export function maisProximo<T extends { face: number[] | null }>(d: Float32Array, pessoas: T[], limite: number): { pessoa: T; dist: number } | null {
  let melhor: { pessoa: T; dist: number } | null = null;
  let segunda = Infinity;
  for (const p of pessoas) {
    if (!p.face) continue;
    const x = distancia(d, p.face);
    if (!melhor || x < melhor.dist) { if (melhor) segunda = melhor.dist; melhor = { pessoa: p, dist: x }; } else if (x < segunda) segunda = x;
  }
  if (!melhor || melhor.dist > limite) return null;
  if (segunda - melhor.dist < 0.04) return null; // dois rostos quase iguais: pede outra leitura
  return melhor;
}

/** Média de vários descritores (cadastro mais estável com 3 a 5 amostras). */
export function media(ds: Float32Array[]): number[] {
  const out = new Array<number>(ds[0].length).fill(0);
  for (const d of ds) for (let i = 0; i < d.length; i++) out[i] += d[i] / ds.length;
  return out.map((x) => Math.round(x * 1e6) / 1e6);
}
