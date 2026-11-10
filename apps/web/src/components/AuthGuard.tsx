"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useSessao } from "@/lib/auth/AuthProvider";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { usuario, carregado } = useSessao();
  const router = useRouter();

  useEffect(() => {
    if (carregado && !usuario) router.replace("/auth/entrar");
  }, [carregado, usuario, router]);

  if (!carregado || !usuario) {
    return (
      <div className="grid min-h-screen place-items-center bg-m-surface-base">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-m-accent border-t-transparent" />
      </div>
    );
  }
  return <>{children}</>;
}
