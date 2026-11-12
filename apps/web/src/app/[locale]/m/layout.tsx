import type { PropsWithChildren } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { MobileShell } from '@/components/Mobile/MobileShell';
import { ConfirmarProvider } from '@/components/Obra/Confirmar';
import { ObraProvider } from '@/lib/obra/ObraProvider';

/** App de campo (celular): mesmas contas, obra e permissões do app completo, sem o menu lateral. */
export default function CampoLayout({ children }: PropsWithChildren) {
  return (
    <AuthGuard>
      <ObraProvider>
        <ConfirmarProvider>
          <MobileShell>{children}</MobileShell>
        </ConfirmarProvider>
      </ObraProvider>
    </AuthGuard>
  );
}
