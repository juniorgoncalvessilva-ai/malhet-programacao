import type { PropsWithChildren } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Shell } from "@/components/Malhet/Shell";
import { ObraProvider } from "@/lib/obra/ObraProvider";

export default function AppLayout({ children }: PropsWithChildren) {
  return (
    <AuthGuard>
      <ObraProvider>
        <Shell>{children}</Shell>
      </ObraProvider>
    </AuthGuard>
  );
}
