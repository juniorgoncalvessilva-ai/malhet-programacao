'use client';

import { useEffect } from 'react';
import { relatarErro } from '@/lib/erros/relatar';

/** Último recurso (spec 098): até o layout raiz quebrou — relata e oferece recarregar, sem depender do resto do app. */
export default function ErroGeral({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { relatarErro({ tipo: 'tela', mensagem: error.message || 'O app não abriu', pilha: error.stack }); }, [error]);
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#F6F8F8', color: '#070911', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0 }}>
        <div style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>O Malhet não conseguiu abrir</h1>
          <p style={{ color: '#4b5563', fontSize: 14 }}>A equipe já recebeu o aviso. Tente de novo em instantes.</p>
          <button type="button" onClick={reset} style={{ marginTop: 12, height: 40, padding: '0 18px', borderRadius: 999, border: 0, background: '#284E4F', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Tentar de novo</button>
        </div>
      </body>
    </html>
  );
}
