'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { API_URL } from '@/lib/api/client';

/**
 * Links por obra enviados antes do endereço fixo (spec 115): levam a `/encarregado`, já com a obra para abrir com a marca
 * da empresa. Link desconhecido também vai para o endereço fixo (a obra sai da matrícula).
 */
export default function LinkAntigoPage() {
  const { codigo, locale } = useParams<{ codigo: string; locale: string }>();
  const router = useRouter();
  useEffect(() => {
    fetch(`${API_URL}/portal/link/${encodeURIComponent(codigo)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { obra_id?: number } | null) => router.replace(`/${locale}/encarregado${d?.obra_id ? `?obra=${d.obra_id}` : ''}`))
      .catch(() => router.replace(`/${locale}/encarregado`));
  }, [codigo, locale, router]);
  return null;
}
