import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Zustand } from "@/components/StateManagement";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "en" | "pt-BR", namespace: "StateManagement" });
  
  return {
    title: t("meta.title"),
    description: t("meta.description"),
  };
}

export default async function StateManagementPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "en" | "pt-BR", namespace: "StateManagement" });

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold dark:text-white">{t("title")}</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          {t("description")}
        </p>
      </div>
      
      <Zustand />
    </div>
  );
}