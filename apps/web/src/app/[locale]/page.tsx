import { redirect } from 'next/navigation';

// A landing do starter kit (src/app/[locale]/_components) continua no repo como referência visual.
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/app/programacoes`);
}
