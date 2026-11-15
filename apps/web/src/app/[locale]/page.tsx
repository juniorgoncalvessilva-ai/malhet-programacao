import type { Metadata } from 'next';
import { Landing } from '@/components/Marca/Landing';

// Página principal pública (spec 092): a história da marca. Quem já está logado tem o botão "Abrir o Malhet".
export const metadata: Metadata = {
  title: 'Malhet · Gestão da execução de obras',
  description: 'O Malhet registra o que acontece na obra, quem decidiu e quanto custou, para que nenhuma decisão se perca. O que foi decidido, fica.',
};

export default function Home() {
  return <Landing />;
}
