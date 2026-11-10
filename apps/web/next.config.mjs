import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import("next").NextConfig} */
const nextConfig = {
  // A API Python (apps/api) é servida na mesma origem: /backend/* → API_INTERNAL_URL/*
  async rewrites() {
    const api = process.env.API_INTERNAL_URL || "http://localhost:8000";
    return [{ source: "/backend/:path*", destination: `${api}/:path*` }];
  },
};

export default withNextIntl(nextConfig);
