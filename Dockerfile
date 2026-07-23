# syntax=docker/dockerfile:1.7
FROM node:24.18.0-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts=false && npm cache clean --force

FROM base AS build-dependencies
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts=false && npm cache clean --force

FROM base AS builder
COPY --from=build-dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS migrator
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY db ./db
COPY drizzle ./drizzle
COPY scripts ./scripts
USER node
CMD ["npm", "run", "db:migrate"]

FROM node:24.18.0-bookworm-slim AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
