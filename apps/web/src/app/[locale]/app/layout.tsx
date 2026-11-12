import type { PropsWithChildren } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Shell } from "@/components/Malhet/Shell";
import { ConfirmarProvider } from "@/components/Obra/Confirmar";
import { ObraProvider } from "@/lib/obra/ObraProvider";
import { AdequarInterface } from "@/lib/dispositivo/interface";

export default function AppLayout({ children }: PropsWithChildren) {
  return (
    <AuthGuard>
      <AdequarInterface estou="completo">
      <ObraProvider>
        <ConfirmarProvider>
          <Shell>{children}</Shell>
        </ConfirmarProvider>
      </ObraProvider>
      </AdequarInterface>
    </AuthGuard>
  );
}
