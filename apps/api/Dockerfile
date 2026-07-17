# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# NestJS API — multi-stage production image.
#
#   docker build -f apps/api/Dockerfile -t sfcc-api .
#
# The runtime image includes the Salesforce CLI + SFDMU plugin because the API
# shells out to `sf` for org auth, metadata deploys, and data loads.
# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim AS builder
WORKDIR /repo

# Install the full dependency tree first for layer caching.
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/firebase/package.json packages/firebase/
COPY packages/sf-cli/package.json packages/sf-cli/
COPY packages/metadata-orchestrator/package.json packages/metadata-orchestrator/
RUN npm ci

COPY packages ./packages
COPY apps/api ./apps/api

# Prisma client must exist before the workspace packages compile.
RUN npm run db:generate \
  && npx turbo run build --filter=@sfcc/api

# Drop dev dependencies while keeping workspace links + generated Prisma client.
RUN npm prune --omit=dev

# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo

# Pin the CLI and user plugins so every image is reproducible and runtime
# readiness checks enforce exactly the versions tested by this application.
ARG SALESFORCE_CLI_VERSION=2.143.6
ARG SFDMU_PLUGIN_VERSION=5.8.0
ARG SF_CODE_ANALYZER_PLUGIN_VERSION=5.14.0
ENV SFDMU_PLUGIN_VERSION=${SFDMU_PLUGIN_VERSION} \
    SF_CODE_ANALYZER_PLUGIN_VERSION=${SF_CODE_ANALYZER_PLUGIN_VERSION} \
    SF_AUTO_INSTALL_PLUGINS=true \
    SF_ENFORCE_PLUGIN_VERSIONS=true

# git is required for SCM checkouts. Java unlocks Code Analyzer's PMD/CPD/SFGE
# engines and Python unlocks Flow analysis; Node.js already covers ESLint.
RUN apt-get update -qq \
  && apt-get install -y -qq --no-install-recommends \
       git ca-certificates openssl openjdk-17-jre-headless python3 \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g "@salesforce/cli@${SALESFORCE_CLI_VERSION}" --omit=dev \
  && sf plugins install "sfdmu@${SFDMU_PLUGIN_VERSION}" \
  && sf plugins install "code-analyzer@${SF_CODE_ANALYZER_PLUGIN_VERSION}" \
  && sf --version \
  && sf plugins inspect sfdmu --json > /dev/null \
  && sf plugins inspect code-analyzer --json > /dev/null \
  && java -version \
  && python3 --version

COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages ./packages
COPY --from=builder /repo/apps/api/package.json ./apps/api/package.json
COPY --from=builder /repo/apps/api/dist ./apps/api/dist

# Prisma migrations for `npx prisma migrate deploy` at release time.
COPY --from=builder /repo/packages/db/prisma ./packages/db/prisma

ENV API_PORT=3001
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.API_PORT||3001)+'/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /repo/apps/api
CMD ["node", "dist/main.js"]
