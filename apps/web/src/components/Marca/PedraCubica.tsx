'use client';

import { useEffect, useRef } from 'react';

/**
 * Pedra bruta → pedra cúbica (história da marca): pontos soltos — o ocorrido bruto — que se ordenam num cubo, a pedra
 * pronta para entrar na obra. `progresso` 0 = espalhado, 1 = cubo; sem `progresso`, monta sozinho.
 * O cubo é 3D (seis faces de pontos, luz por face, faces de trás translúcidas): gira devagar e inclina para o lado do
 * mouse (specs 092–095). Respeita "reduzir movimento" (nasce montado e parado). Canvas 2D, sem biblioteca.
 */
type Tema = 'claro' | 'escuro';
const CORES: Record<Tema, { topo: string; direita: string; esquerda: string; fundo: string; poeira: string }> = {
  claro: { topo: '#3E9C98', direita: '#284E4F', esquerda: '#0E2627', fundo: '#7FA9A8', poeira: '#8FA6A6' },
  escuro: { topo: '#B5E0DE', direita: '#6FB3B1', esquerda: '#3B807E', fundo: '#2B4A4B', poeira: '#3C5556' },
};

interface Ponto {
  ax: number; ay: number; fase: number; vel: number; atraso: number; lado: number;
  x: number; y: number; z: number; nx: number; ny: number; nz: number; poeira: boolean;
}

const suave = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const ISO_YAW = Math.PI / 4, ISO_PITCH = Math.atan(1 / Math.SQRT2); // vista isométrica de partida

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
    let w = 0, h = 0, s = 0, cx = 0, cy = 0, pontos: Ponto[] = [], raf = 0, atual = parado ? 1 : 0, inicio = performance.now();
    const mouse = { x: -9999, y: -9999, nx: 0, ny: 0 }; // nx/ny: -1..1 em relação à janela
    let yaw = ISO_YAW, pitch = ISO_PITCH;

    const montar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = c.getBoundingClientRect();
      w = r.width; h = r.height;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = w < 640 ? 10 : 14; // pontos por aresta de cada face
      s = Math.min(w, h) * escala * 1.15;
      cx = w / 2 + deslocX * w; cy = h / 2 + deslocY * h;
      const faces: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      const alvos: Omit<Ponto, 'ax' | 'ay' | 'fase' | 'vel' | 'atraso' | 'lado'>[] = [];
      for (const [fx, fy, fz] of faces) {
        for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) {
          const u = (i + 0.5) / g - 0.5, v = (j + 0.5) / g - 0.5;
          const p = fx ? [fx * 0.5, u, v] : fy ? [u, fy * 0.5, v] : [u, v, fz * 0.5];
          alvos.push({ x: p[0], y: p[1], z: p[2], nx: fx, ny: fy, nz: fz, poeira: false });
        }
      }
      const poeira = Math.round(alvos.length * (w < 640 ? 0.25 : 0.35));
      pontos = [...alvos, ...Array.from({ length: poeira }, () => ({ x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, poeira: true }))].map((a) => ({
        ...a, ax: Math.random() * w, ay: Math.random() * h, fase: Math.random() * Math.PI * 2, vel: 0.2 + Math.random() * 0.6,
        atraso: Math.random() * 0.45, lado: 1.7 + Math.random() * 1.5,
      }));
    };

    const desenhar = (agora: number) => {
      const tempo = agora / 1000;
      if (auto && !parado) alvo.current = suave(Math.min(1, Math.max(0, ((agora - inicio) / 1000 - 0.5) / 2.4)));
      atual += (alvo.current - atual) * (parado ? 1 : 0.08);
      // gira devagar e inclina para o lado do mouse (suavizado)
      const yawAlvo = ISO_YAW + (parado ? 0 : tempo * 0.18) + mouse.nx * 0.7;
      const pitchAlvo = ISO_PITCH - mouse.ny * 0.45;
      yaw += (yawAlvo - yaw) * (parado ? 1 : 0.06);
      pitch += (pitchAlvo - pitch) * (parado ? 1 : 0.06);
      const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const rot = (x: number, y: number, z: number) => {
        const x1 = x * cyw - z * syw, z1 = x * syw + z * cyw;     // yaw (eixo vertical)
        const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;       // pitch (eixo horizontal)
        return [x1, y2, z2];
      };
      ctx.clearRect(0, 0, w, h);
      const deriva = parado ? 0 : 1;
      const desenhos: [number, number, number, string, number, number][] = []; // x, y, profundidade, cor, alfa, lado
      for (const p of pontos) {
        const bx = p.ax + Math.sin(tempo * p.vel + p.fase) * 14 * deriva;
        const by = p.ay + Math.cos(tempo * p.vel * 0.8 + p.fase) * 10 * deriva;
        if (p.poeira) {
          let x = bx, y = by;
          const dx = x - mouse.x, dy = y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < 12000) { const f = (12000 - d2) / 12000 * 26; const d = Math.sqrt(d2 + 1); x += (dx / d) * f; y += (dy / d) * f; }
          desenhos.push([x, y, -9, cor.poeira, 0.5 * (1 - atual * 0.5), p.lado * 0.8]);
          continue;
        }
        const [rx, ry, rz] = rot(p.x, p.y, p.z);
        const [nxr, nyr, nzr] = rot(p.nx, p.ny, p.nz);
        const tx = cx + rx * s, ty = cy - ry * s;
        const t = suave((atual - p.atraso) / 0.55);
        let x = bx + (tx - bx) * t, y = by + (ty - by) * t;
        if (t < 0.6) { // ainda solto: o cursor espalha
          const dx = x - mouse.x, dy = y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < 12000) { const f = (12000 - d2) / 12000 * 22; const d = Math.sqrt(d2 + 1); x += (dx / d) * f; y += (dy / d) * f; }
        }
        const frente = nzr > 0.05;
        const tom = !frente ? cor.fundo : nyr > 0.45 ? cor.topo : nxr > 0 ? cor.direita : cor.esquerda;
        const luz = frente ? 0.55 + 0.45 * Math.min(1, nzr + 0.25) : 0.22;
        const alfa = (0.35 + 0.65 * Math.min(1, atual * 1.3 + 0.1)) * (t > 0.5 ? luz : 0.7);
        const fim = Math.max(2.6, s * 0.013) * (frente ? 1 : 0.7);
        desenhos.push([x, y, rz, tom, alfa, p.lado + (fim - p.lado) * atual]);
      }
      desenhos.sort((a, b) => a[2] - b[2]); // de trás para a frente
      for (const [x, y, , tom, alfa, l] of desenhos) {
        ctx.globalAlpha = alfa;
        ctx.fillStyle = tom;
        ctx.fillRect(x - l / 2, y - l / 2, l, l);
      }
      ctx.globalAlpha = 1;
      if (!parado) raf = requestAnimationFrame(desenhar);
    };

    const mover = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
      mouse.nx = (e.clientX / window.innerWidth) * 2 - 1; mouse.ny = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const sair = () => { mouse.x = -9999; mouse.y = -9999; mouse.nx = 0; mouse.ny = 0; };
    const ro = new ResizeObserver(() => { montar(); if (parado) desenhar(performance.now()); });
    ro.observe(c);
    montar();
    inicio = performance.now();
    window.addEventListener('pointermove', mover);
    document.addEventListener('pointerleave', sair);
    raf = requestAnimationFrame(desenhar);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('pointermove', mover); document.removeEventListener('pointerleave', sair); };
  }, [tema, escala, deslocX, deslocY]); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={tela} aria-hidden="true" className={className} />;
}
