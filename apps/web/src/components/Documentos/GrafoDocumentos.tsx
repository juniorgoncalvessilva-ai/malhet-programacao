'use client';

import { useMemo, useState } from 'react';
import type { Grafo } from '@/lib/documentos';

const COR: Record<string, string> = { documento: 'var(--m-accent-strong)', area: '#B45309', grupo: '#7C3AED', wbs: '#0891B2' };
const LEGENDA: Record<string, string> = { documento: 'Documento', area: 'Frente', grupo: 'Grupo de atividade', wbs: 'WBS' };

/** Posições por uma simulação de forças simples (repulsão + molas nas ligações), calculada uma vez. */
function posicionar(g: Grafo, w: number, h: number) {
  const n = g.nos.length;
  const p = g.nos.map((_, i) => ({ x: w / 2 + Math.cos((i / Math.max(n, 1)) * 2 * Math.PI) * w * 0.35, y: h / 2 + Math.sin((i / Math.max(n, 1)) * 2 * Math.PI) * h * 0.35 }));
  const idx = new Map(g.nos.map((x, i) => [x.id, i]));
  const ligs = g.arestas.map((a) => [idx.get(a.de), idx.get(a.para)]).filter((x): x is [number, number] => x[0] !== undefined && x[1] !== undefined);
  for (let it = 0; it < 220; it++) {
    const f = p.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = p[i].x - p[j].x, dy = p[i].y - p[j].y, d2 = Math.max(dx * dx + dy * dy, 25), k = 9000 / d2;
      f[i].x += dx * k / 30; f[i].y += dy * k / 30; f[j].x -= dx * k / 30; f[j].y -= dy * k / 30;
    }
    for (const [a, b] of ligs) {
      const dx = p[b].x - p[a].x, dy = p[b].y - p[a].y, d = Math.hypot(dx, dy) || 1, k = (d - 110) * 0.02;
      f[a].x += dx / d * k * 10; f[a].y += dy / d * k * 10; f[b].x -= dx / d * k * 10; f[b].y -= dy / d * k * 10;
    }
    for (let i = 0; i < n; i++) {
      f[i].x += (w / 2 - p[i].x) * 0.01; f[i].y += (h / 2 - p[i].y) * 0.01;
      p[i].x = Math.min(w - 30, Math.max(30, p[i].x + Math.max(-8, Math.min(8, f[i].x))));
      p[i].y = Math.min(h - 20, Math.max(20, p[i].y + Math.max(-8, Math.min(8, f[i].y))));
    }
  }
  return { p, ligs };
}

/**
 * Mapa de conexões dos documentos (spec 123): o mesmo grafo que o graphify/Obsidian monta das notas `.md` do acervo —
 * documento ligado à frente, ao grupo de atividade e aos documentos que referencia. Tocar num documento abre o detalhe.
 */
export function GrafoDocumentos({ g, onAbrir }: { g: Grafo; onAbrir: (id: number) => void }) {
  const W = 1000, H = 620;
  const { p, ligs } = useMemo(() => posicionar(g, W, H), [g]);
  const [foco, setFoco] = useState<number | null>(null);
  const vizinhos = useMemo(() => {
    if (foco === null) return null;
    const s = new Set<number>([foco]);
    ligs.forEach(([a, b]) => { if (a === foco) s.add(b); if (b === foco) s.add(a); });
    return s;
  }, [foco, ligs]);
  if (!g.nos.length) return <p className="py-8 text-center text-[13px] text-m-text-muted">Sem documentos ainda. Envie uma revisão ou importe a LDO.</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3 text-[12px] text-m-text-secondary">
        {Object.entries(LEGENDA).map(([k, v]) => <span key={k} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: COR[k] }} />{v}</span>)}
        <span className="flex items-center gap-1.5"><span className="h-0 w-5 border-t-2 border-dashed border-m-warning" />sugerida pela TAG</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-[16px] border border-m-stroke-subtle bg-m-surface-raised" role="img" aria-label="Mapa de conexões dos documentos">
        {ligs.map(([a, b], i) => {
          const ar = g.arestas[i];
          const apagada = vizinhos && !(vizinhos.has(a) && vizinhos.has(b));
          return <line key={i} x1={p[a].x} y1={p[a].y} x2={p[b].x} y2={p[b].y} stroke={ar?.sugerido ? 'var(--m-warning)' : 'var(--m-stroke-strong)'}
            strokeDasharray={ar?.sugerido ? '5 4' : undefined} strokeWidth={1.5} opacity={apagada ? 0.15 : 0.9} />;
        })}
        {g.nos.map((n, i) => {
          const doc = n.tipo === 'documento';
          const apagado = vizinhos && !vizinhos.has(i);
          return (
            <g key={n.id} transform={`translate(${p[i].x},${p[i].y})`} opacity={apagado ? 0.2 : 1} style={{ cursor: 'pointer' }}
              onMouseEnter={() => setFoco(i)} onMouseLeave={() => setFoco(null)}
              onClick={() => { if (doc) onAbrir(Number(n.id.split(':')[1])); else setFoco(foco === i ? null : i); }}>
              <circle r={doc ? 9 : 7} fill={COR[n.tipo] ?? '#64748B'} stroke="white" strokeWidth={2} />
              <text x={12} y={4} fontSize={11} fill="var(--m-text-primary)">{n.rotulo.length > 34 ? `${n.rotulo.slice(0, 33)}…` : n.rotulo}{doc && n.vigente ? ` · rev ${n.vigente}` : ''}</text>
              <title>{n.titulo ? `${n.rotulo} — ${n.titulo}` : n.rotulo}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
