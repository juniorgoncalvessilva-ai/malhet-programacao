import type { Metadata, Viewport } from 'next';
import { PortalLider, type InfoPortal } from '@/components/PortalLider/PortalLider';

/**
 * Link dos líderes da obra (specs 111 e 113): aberto pelo grupo do WhatsApp, sem conta do Malhet. A página já nasce com a
 * marca da empresa (logo, cor, nome na aba e no ícone): o link é da obra, então sabemos de quem é antes de qualquer login.
 */
export const dynamic = 'force-dynamic';

async function info(codigo: string): Promise<InfoPortal | null> {
  const api = process.env.API_INTERNAL_URL || 'http://localhost:8000';
  try {
    const r = await fetch(`${api}/api/portal/${encodeURIComponent(codigo)}`, { cache: 'no-store' });
    return r.ok ? ((await r.json()) as InfoPortal) : null;
  } catch { return null; }
}

const logo = (codigo: string, i: InfoPortal | null) =>
  i?.marca.logos.includes('contratada') ? `/backend/api/portal/${encodeURIComponent(codigo)}/logo/contratada?v=${i.marca.versao}` : null;

export async function generateMetadata({ params }: { params: Promise<{ codigo: string }> }): Promise<Metadata> {
  const { codigo } = await params;
  const i = await info(codigo);
  const empresa = i?.marca.contratada || 'Malhet';
  const icone = logo(codigo, i);
  return {
    title: { absolute: `${empresa} · Minha equipe` }, // sem o "| Malhet" do modelo: a tela é da empresa
    description: i ? `Equipes da obra ${i.obra}` : 'Minha equipe',
    robots: { index: false, follow: false },
    ...(icone ? { icons: { icon: icone, apple: icone } } : {}),
  };
}

export async function generateViewport({ params }: { params: Promise<{ codigo: string }> }): Promise<Viewport> {
  const { codigo } = await params;
  const i = await info(codigo);
  return { themeColor: i?.marca.cor || '#284E4F' }; // barra do navegador do celular na cor da empresa
}

export default async function EquipeDoLiderPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  return <PortalLider codigo={codigo} inicial={await info(codigo)} />;
}
