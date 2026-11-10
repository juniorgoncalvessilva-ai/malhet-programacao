import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import AnalyticsExample from "@/components/analytics-example";

interface PageProps {
  params: Promise<{ locale: "pt-BR" | "en" }>;
}

export async function generateMetadata({ 
  params 
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    title: `${t("analytics-demo.title")} | AI Coders Starter Kit`,
    description: t("analytics-demo.description"),
  };
}

export default async function AnalyticsDemoPage({
  params
}: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });

  return (
    <div className="container mx-auto">
      <AnalyticsExample />
    </div>
  );
}