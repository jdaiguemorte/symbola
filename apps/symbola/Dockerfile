# syntax=docker/dockerfile:1

# Image de l'app symbola (ADR 0011 : une seule app pour le MVP).
# Construite et scannée (Trivy) à chaque pull request (SOC-02) ;
# déployée en staging/production à partir de SOC-09.

FROM node:22-slim AS base
WORKDIR /repo
RUN corepack enable

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/config/package.json packages/config/package.json
COPY apps/symbola/package.json apps/symbola/package.json
COPY tools/boundaries/package.json tools/boundaries/package.json
RUN pnpm install --frozen-lockfile --filter @symbola/app... --filter @symbola/config

FROM deps AS build
COPY . .
RUN pnpm --filter @symbola/app build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 symbola && adduser --system --uid 1001 symbola
COPY --from=build --chown=symbola:symbola /repo/apps/symbola/.next/standalone ./
COPY --from=build --chown=symbola:symbola /repo/apps/symbola/.next/static ./apps/symbola/.next/static
COPY --from=build --chown=symbola:symbola /repo/apps/symbola/public ./apps/symbola/public
USER symbola
EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/symbola/server.js"]
