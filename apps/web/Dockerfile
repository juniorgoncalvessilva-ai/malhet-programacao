# Front Next.js (standalone). /backend/* é reescrito para a API (API_INTERNAL_URL, fixado no build).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ARG API_INTERNAL_URL=http://api:8000
ARG NEXT_PUBLIC_API_URL=/backend/api
ARG NEXT_PUBLIC_AUTH_DISABLED=false
ENV API_INTERNAL_URL=$API_INTERNAL_URL NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_AUTH_DISABLED=$NEXT_PUBLIC_AUTH_DISABLED NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_GA_ENABLED=false NEXT_PUBLIC_GTM_ENABLED=false NEXT_PUBLIC_META_PIXEL_ENABLED=false NEXT_PUBLIC_LOGROCKET_ENABLED=false
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN adduser -S -u 10001 web
COPY --from=build /app/public ./public
COPY --from=build --chown=web /app/.next/standalone ./
COPY --from=build --chown=web /app/.next/static ./.next/static
USER web
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 CMD wget -qO- http://127.0.0.1:3000/brand/malhet.svg >/dev/null || exit 1
CMD ["node", "server.js"]
