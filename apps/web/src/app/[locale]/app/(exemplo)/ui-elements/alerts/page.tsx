import { Alert } from "@/components/ui/alert";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Alerts",
  // other metadata
};

export default async function Page() {
  const t = await getTranslations('Alerts');
  const nav = await getTranslations('UIElements');

  return (
    <>
      <Breadcrumb pageName={nav('alerts')} />

      <div className="space-y-7.5 rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
        <Alert
          variant="warning"
          title={t('attentionNeeded')}
          description={t('alertDescription')}
        />

        <Alert
          variant="success"
          title={t('messageSentSuccessfully')}
          description={t('alertDescription')}
        />

        <Alert
          variant="error"
          title={t('errorsWithSubmission')}
          description={t('alertDescription')}
        />
      </div>
    </>
  );
}
