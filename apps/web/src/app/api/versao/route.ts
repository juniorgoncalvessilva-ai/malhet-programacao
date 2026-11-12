// Versão do build que está no ar (a tela aberta compara com a dela e recarrega depois de um deploy).
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ versao: process.env.NEXT_PUBLIC_VERSAO ?? '' }, { headers: { 'Cache-Control': 'no-store' } });
}
