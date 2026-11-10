"use client";

import { SignIn } from "@clerk/nextjs";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useTranslations, useLocale } from 'next-intl';
import Image from "next/image";
import Link from "next/link";

export default function SignInPage() {
  const t = useTranslations('Auth');
  const locale = useLocale();
  return (
    <>
      <Breadcrumb pageName={t('signInTitle')} />

      <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="flex flex-wrap items-center">
          <div className="w-full xl:w-1/2">
            <div className="w-full p-4 sm:p-12.5 xl:p-15">
              <SignIn 
                appearance={{
                  elements: {
                    formButtonPrimary: "bg-primary hover:bg-opacity-90 text-white",
                    card: "bg-transparent shadow-none",
                    headerTitle: "text-dark dark:text-white",
                    headerSubtitle: "text-dark-4 dark:text-dark-6",
                    socialButtonsBlockButton: "border border-stroke dark:border-dark-3 bg-gray-2 dark:bg-dark-2 hover:bg-opacity-50",
                    dividerLine: "bg-stroke dark:bg-dark-3",
                    dividerText: "text-dark-4 dark:text-dark-6",
                    formFieldLabel: "text-dark dark:text-white",
                    formFieldInput: "border-stroke dark:border-dark-3 bg-transparent text-dark dark:text-white",
                    footerActionLink: "text-primary hover:text-primary",
                  }
                }}
              />
            </div>
          </div>

          <div className="hidden w-full p-7.5 xl:block xl:w-1/2">
            <div className="custom-gradient-1 overflow-hidden rounded-2xl px-12.5 pt-12.5 dark:!bg-dark-2 dark:bg-none">
              <Link className="mb-10 inline-block" href={`/${locale}`}>
                <Image
                  className="hidden dark:block"
                  src={"/images/logo/logo.svg"}
                  alt="Logo"
                  width={176}
                  height={32}
                />
                <Image
                  className="dark:hidden"
                  src={"/images/logo/logo-dark.svg"}
                  alt="Logo"
                  width={176}
                  height={32}
                />
              </Link>
              <p className="mb-3 text-xl font-medium text-dark dark:text-white">
                {t('signInToAccount')}
              </p>

              <h1 className="mb-4 text-2xl font-bold text-dark dark:text-white sm:text-heading-3">
                {t('welcomeBack')}
              </h1>

              <p className="w-full max-w-[375px] font-medium text-dark-4 dark:text-dark-6">
                {t('signInDescription')}
              </p>

              <div className="mt-31">
                <Image
                  src={"/images/grids/grid-02.svg"}
                  alt="Logo"
                  width={405}
                  height={325}
                  className="mx-auto dark:opacity-30"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
