import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demonstração de API Protegida",
  description: "Página para demonstrar o uso de endpoints de API protegidos com autenticação Clerk",
};

export default function APIDemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}