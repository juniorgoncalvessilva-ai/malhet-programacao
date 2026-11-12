'use client';

import { useParams } from 'next/navigation';
import { ImpressaoProgramacao } from '@/components/Obra/ImpressaoProgramacao';

export default function ImprimirPage() {
  return <ImpressaoProgramacao id={Number(useParams<{ id: string }>().id)} />;
}
