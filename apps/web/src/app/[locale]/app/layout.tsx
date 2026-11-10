import type { PropsWithChildren } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Shell } from "@/components/Malhet/Shell";

export default function AppLayout({ children }: PropsWithChildren) {
  return (
    <AuthGuard>
      <Shell>{children}</Shell>
    </AuthGuard>
  );
}
