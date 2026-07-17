# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Next.js web app — multi-stage production image (standalone output).
#
#   docker build -f apps/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=... \
#     --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=... \
#     --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID=... \
#     --build-arg NEXT_PUBLIC_FIREBASE_APP_ID=... \
#     -t sfcc-web .
#
# NEXT_PUBLIC_* values are baked into the client bundle at build time; the
# /api/* rewrite target comes from API_INTERNAL_URL (default: the compose
# service name).
# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim AS builder
WORKDIR /repo

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
COPY apps/web ./apps/web

ARG NEXT_PUBLIC_API_URL=""
ARG NEXT_PUBLIC_FIREBASE_API_KEY=""
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=""
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=""
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=""
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=""
ARG NEXT_PUBLIC_FIREBASE_APP_ID=""
ARG NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=""
ARG API_INTERNAL_URL="http://api:3001"

ENV NEXT_OUTPUT_STANDALONE=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=$NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID \
    API_INTERNAL_URL=$API_INTERNAL_URL

# @sfcc/shared ships TypeScript that Next transpiles; build it first.
RUN npx turbo run build --filter=@sfcc/shared \
  && cd apps/web \
  && npm run build

# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app

COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)).then((r)=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
