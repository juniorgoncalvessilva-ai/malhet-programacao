'use client';

import { useEffect, useRef } from 'react';

/**
 * Pedra bruta → pedra cúbica (história da marca): pontos soltos — o ocorrido bruto — que se ordenam num cubo
 * isométrico, a pedra pronta para entrar na obra. `progresso` 0 = espalhado, 1 = cubo. Sem `progresso`, monta sozinho.
 * Respeita "reduzir movimento" (já nasce montado e parado). Canvas 2D, sem biblioteca.
 */
type Tema = 'claro' | 'escuro';
const CORES: Record<Tema, { topo: string; direita: string; esquerda: string; poeira: string }> = {
  claro: { topo: '#6FB3B1', direita: '#284E4F', esquerda: '#1A3536', poeira: '#9AAFAF' },
  escuro: { topo: '#9FD0CE', direita: '#6FB3B1', esquerda: '#3E7E7C', poeira: '#3C5556' },
};

interface Ponto { ax: number; ay: number; fase: number; vel: number; tx: number; ty: number; face: number; atraso: number; lado: number }

const suave = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export function PedraCubica({ progresso, tema = 'claro', escala = 0.36, deslocX = 0, deslocY = 0, className }: {
  progresso?: number; tema?: Tema; escala?: number; deslocX?: number; deslocY?: number; className?: string;
}) {
  const tela = useRef<HTMLCanvasElement>(null);
  const alvo = useRef(progresso ?? 0);
  useEffect(() => { if (progresso !== undefined) alvo.current = progresso; }, [progresso]);

  useEffect(() => {
    const c = tela.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const parado = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const auto = progresso === undefined;
    const cor = CORES[tema];
    let w = 0, h = 0, pontos: Ponto[] = [], raf = 0, atual = parado ? 1 : 0, inicio = performance.now();
    const mouse = { x: -9999, y: -9999 };

    const montar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = c.getBoundingClientRect();
      w = r.width; h = r.height;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = w < 640 ? 11 : 15; // pontos por aresta de cada face
      const s = Math.min(w, h) * escala;
      const cx = w / 2 + deslocX * w, cy = h / 2 + deslocY * h;
      const cos = Math.cos(Math.PI / 6), sen = Math.sin(Math.PI / 6);
      const proj = (x: number, y: number, z: number) => [cx + (x - y) * cos * s, cy + ((x + y) * sen - z) * s];
      const alvos: { x: number; y: number; face: number }[] = [];
      for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) {
        const u = (i + 0.5) / g - 0.5, v = (j + 0.5) / g - 0.5;
        const [x1, y1] = proj(u, v, 0.5); alvos.push({ x: x1, y: y1, face: 0 }); // topo (z=1)
        const [x2, y2] = proj(0.5, u, v); alvos.push({ x: x2, y: y2, face: 1 }); // face direita (x=1)
        const [x3, y3] = proj(u, 0.5, v); alvos.push({ x: x3, y: y3, face: 2 }); // face esquerda (y=1)
      }
      const poeira = Math.round(alvos.length * (w < 640 ? 0.35 : 0.55));
      pontos = [...alvos, ...Array.from({ length: poeira }, () => ({ x: NaN, y: NaN, face: 3 }))].map((a) => ({
        ax: Math.random() * w, ay: Math.random() * h, fase: Math.random() * Math.PI * 2, vel: 0.2 + Math.random() * 0.6,
        tx: a.x, ty: a.y, face: a.face, atraso: Math.random() * 0.45, lado: 1.6 + Math.random() * 1.4,
      }));
    };

    const desenhar = (agora: number) => {
      if (auto && !parado) {
        const t = (agora - inicio) / 1000;
        alvo.current = suave(Math.min(1, Math.max(0, (t - 0.6) / 2.6)));
      }
      atual += (alvo.current - atual) * (parado ? 1 : 0.08);
      ctx.clearRect(0, 0, w, h);
      const tempo = agora / 1000;
      for (const p of pontos) {
        const deriva = parado ? 0 : 1;
        const bx = p.ax + Math.sin(tempo * p.vel + p.fase) * 14 * deriva;
        const by = p.ay + Math.cos(tempo * p.vel * 0.8 + p.fase) * 10 * deriva;
        let x = bx, y = by;
        if (p.face < 3) {
          const t = suave((atual - p.atraso) / 0.55);
          x = bx + (p.tx - bx) * t;
          y = by + (p.ty - by) * t;
          if (t > 0.98) { x = p.tx; y = p.ty; }
        }
        const dx = x - mouse.x, dy = y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 9000 && (p.face === 3 || atual < 0.6)) { const f = (9000 - d2) / 9000 * 18; x += (dx / Math.sqrt(d2 + 1)) * f; y += (dy / Math.sqrt(d2 + 1)) * f; }
        ctx.fillStyle = p.face === 0 ? cor.topo : p.face === 1 ? cor.direita : p.face === 2 ? cor.esquerda : cor.poeira;
        ctx.globalAlpha = p.face === 3 ? 0.5 * (1 - atual * 0.6) : 0.35 + 0.65 * Math.min(1, atual * 1.4 + 0.2);
        const l = p.face === 3 ? p.lado * 0.8 : p.lado + (2.6 - p.lado) * atual;
        ctx.fillRect(x - l / 2, y - l / 2, l, l);
      }
      ctx.globalAlpha = 1;
      if (!parado) raf = requestAnimationFrame(desenhar);
    };

    const mover = (e: PointerEvent) => { const r = c.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; };
    const sair = () => { mouse.x = -9999; mouse.y = -9999; };
    const ro = new ResizeObserver(() => { montar(); if (parado) desenhar(performance.now()); });
    ro.observe(c);
    montar();
    inicio = performance.now();
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerleave', sair);
    raf = requestAnimationFrame(desenhar);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('pointermove', mover); window.removeEventListener('pointerleave', sair); };
  }, [tema, escala, deslocX, deslocY]); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={tela} aria-hidden="true" className={className} />;
}
