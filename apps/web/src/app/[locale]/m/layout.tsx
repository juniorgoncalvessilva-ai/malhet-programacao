import type { PropsWithChildren } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { MobileShell } from '@/components/Mobile/MobileShell';
import { ConfirmarProvider } from '@/components/Obra/Confirmar';
import { ObraProvider } from '@/lib/obra/ObraProvider';
import { AdequarInterface } from '@/lib/dispositivo/interface';

/** App de campo (celular): mesmas contas, obra e permissões do app completo, sem o menu lateral. */
export default function CampoLayout({ children }: PropsWithChildren) {
  return (
    <AuthGuard>
      <AdequarInterface estou="campo">
      <ObraProvider>
        <ConfirmarProvider>
          <MobileShell>{children}</MobileShell>
        </ConfirmarProvider>
      </ObraProvider>
      </AdequarInterface>
    </AuthGuard>
  );
}
