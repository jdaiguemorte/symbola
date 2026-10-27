# syntax=docker/dockerfile:1

# Image de l'app symbola (ADR 0011 : une seule app pour le MVP).
# Construite et scannée (Trivy) à chaque pull request (SOC-02) ;
# déployée en staging/production à partir de SOC-09.

FROM node:22-slim AS base
WORKDIR /repo
RUN corepack enable

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
# Tous les paquets du workspace dont l'app dépend : un package.json absent ici
# n'est pas installé et le build échoue (test : tools/ci-pipeline).
COPY packages/auth/package.json packages/auth/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/env/package.json packages/env/package.json
COPY packages/files/package.json packages/files/package.json
COPY packages/i18n/package.json packages/i18n/package.json
COPY packages/mail/package.json packages/mail/package.json
COPY packages/privacy/package.json packages/privacy/package.json
COPY packages/starter-templates/package.json packages/starter-templates/package.json
COPY packages/testing/package.json packages/testing/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY apps/symbola/package.json apps/symbola/package.json
COPY tools/boundaries/package.json tools/boundaries/package.json
RUN pnpm install --frozen-lockfile --filter @symbola/app... --filter @symbola/config

FROM deps AS build
COPY . .
RUN pnpm --filter @symbola/app build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Version affichée par /health (SOC-11) : SHA du commit, passé par la CI.
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
RUN addgroup --system --gid 1001 symbola && adduser --system --uid 1001 symbola
COPY --from=build --chown=symbola:symbola /repo/apps/symbola/.next/standalone ./
COPY --from=build --chown=symbola:symbola /repo/apps/symbola/.next/static ./apps/symbola/.next/static
COPY --from=build --chown=symbola:symbola /repo/apps/symbola/public ./apps/symbola/public
USER symbola
EXPOSE 3000
ENV PORT=3000
# Docker fixe HOSTNAME au nom d'hôte du conteneur ; le serveur standalone
# de Next.js l'utilise comme adresse d'écoute, ce qui le fait écouter en
# local uniquement et le rend inatteignable depuis les autres conteneurs
# (Caddy) — forcer l'écoute sur toutes les interfaces.
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/symbola/server.js"]
