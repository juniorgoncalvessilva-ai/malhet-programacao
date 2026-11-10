import "@fontsource-variable/figtree";
import "@/css/style.css";
import "@/css/malhet.css";

import "flatpickr/dist/flatpickr.min.css";
import "jsvectormap/dist/jsvectormap.css";

import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import type { PropsWithChildren } from "react";
import { Providers } from "./providers";
import { getSEOConfig, getAppName } from "@/config";

const seoConfig = getSEOConfig();
const appName = getAppName();

export const metadata: Metadata = {
  title: {
    template: `%s | ${appName}`,
    default: seoConfig.title,
  },
  description: seoConfig.description,
  keywords: seoConfig.keywords,
  openGraph: {
    title: seoConfig.title,
    description: seoConfig.description,
    images: seoConfig.ogImage ? [seoConfig.ogImage] : undefined,
  },
  twitter: {
    card: seoConfig.twitterCard || 'summary_large_image',
    title: seoConfig.title,
    description: seoConfig.description,
    images: seoConfig.ogImage ? [seoConfig.ogImage] : undefined,
  },
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html suppressHydrationWarning>
      <body className="malhet">
        <Providers>
          <NextTopLoader color="#284E4F" showSpinner={false} />
          {children}
        </Providers>
      </body>
    </html>
  );
}
