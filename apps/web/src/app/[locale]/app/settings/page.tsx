import { UserProfile } from "@clerk/nextjs";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings Page",
};

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-[1080px]">
      <Breadcrumb pageName="Settings" />

      <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="p-4 md:p-6 2xl:p-10">
          <UserProfile 
            routing="hash"
            appearance={{
              elements: {
                card: "bg-transparent shadow-none",
                navbar: "bg-gray-2 dark:bg-dark-2",
                navbarButton: "text-dark dark:text-white hover:bg-gray-1 dark:hover:bg-dark-3",
                navbarButtonActive: "bg-primary text-white",
                headerTitle: "text-dark dark:text-white",
                headerSubtitle: "text-dark-4 dark:text-dark-6",
                formButtonPrimary: "bg-primary hover:bg-opacity-90 text-white",
                formFieldLabel: "text-dark dark:text-white",
                formFieldInput: "border-stroke dark:border-dark-3 bg-transparent text-dark dark:text-white",
                profileSectionTitleText: "text-dark dark:text-white",
                profileSectionContent: "text-dark-4 dark:text-dark-6",
                accordionTriggerButton: "text-dark dark:text-white hover:bg-gray-2 dark:hover:bg-dark-2",
                accordionContent: "text-dark-4 dark:text-dark-6",
                dividerLine: "bg-stroke dark:bg-dark-3",
                modalContent: "bg-white dark:bg-gray-dark",
                modalCloseButton: "text-dark dark:text-white",
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};

