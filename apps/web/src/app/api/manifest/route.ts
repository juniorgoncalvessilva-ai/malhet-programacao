import { NextResponse } from 'next/server';

/**
 * Manifesto do app instalável por rota (spec 147): instalar pelo endereço do apontador abre direto na tela de login daquele
 * endereço (`start_url`), com o nome e a cor da empresa. Só aceita endereços do portal — nada de redirecionar para fora.
 */
const ROTA = /^\/[a-z]{2}(?:-[A-Z]{2})?\/(apontador|encarregado)(?:\/[a-z0-9-]{1,60}){0,2}$/;

export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const inicio = q.get('inicio') ?? '';
  const ok = ROTA.exec(inicio);
  const perfil = ok?.[1] ?? 'apontador';
  const start = ok ? inicio : '/pt-BR/apontador';
  const empresa = (q.get('nome') ?? '').replace(/[^\p{L}\p{N} .&-]/gu, '').trim().slice(0, 40);
  const cor = /^[0-9a-fA-F]{6}$/.test(q.get('cor') ?? '') ? `#${q.get('cor')}` : '#284E4F';
  const papel = perfil === 'apontador' ? 'Apontador' : 'Encarregado';
  return NextResponse.json({
    id: start,
    name: empresa ? `${papel} · ${empresa}` : `${papel} · Malhet`,
    short_name: papel,
    description: perfil === 'apontador' ? 'Presença, equipamentos, fotos e produção da obra' : 'Minha equipe',
    lang: 'pt-BR',
    start_url: start,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F6F8F8',
    theme_color: cor,
    icons: [
      { src: '/brand/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-store' } });
}
