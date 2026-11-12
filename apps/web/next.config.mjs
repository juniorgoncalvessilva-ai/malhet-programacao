import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  // versão do build: a tela compara com /api/versao e recarrega sozinha depois de um deploy
  env: { NEXT_PUBLIC_VERSAO: process.env.NEXT_PUBLIC_VERSAO || String(Date.now()) },
  // A API Python (apps/api) é servida na mesma origem: /backend/* → API_INTERNAL_URL/*
  async rewrites() {
    const api = process.env.API_INTERNAL_URL || "http://localhost:8000";
    return [{ source: "/backend/:path*", destination: `${api}/:path*` }];
  },
};

export default withNextIntl(nextConfig);
