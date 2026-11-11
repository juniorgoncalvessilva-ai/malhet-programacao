import type { PropsWithChildren } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Shell } from "@/components/Malhet/Shell";
import { ConfirmarProvider } from "@/components/Obra/Confirmar";
import { ObraProvider } from "@/lib/obra/ObraProvider";

export default function AppLayout({ children }: PropsWithChildren) {
  return (
    <AuthGuard>
      <ObraProvider>
        <ConfirmarProvider>
          <Shell>{children}</Shell>
        </ConfirmarProvider>
      </ObraProvider>
    </AuthGuard>
  );
}
