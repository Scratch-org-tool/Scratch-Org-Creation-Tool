# Production deployment (Docker)

The repository ships production Dockerfiles for both apps plus a full compose
stack (`docker-compose.prod.yml`) with Postgres, Redis, a one-shot Prisma
migration job, the NestJS API, and the Next.js web app.

## 1. Prepare environment

Create `.env.production` in the repo root:

```env
# Database (used by compose + API)
POSTGRES_USER=sfcc
POSTGRES_PASSWORD=generate-a-strong-password
POSTGRES_DB=sfcc

# API secrets
ENCRYPTION_KEY=64-char-hex            # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_WEB_API_KEY=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
CORS_ORIGINS=https://your-domain.example
SWAGGER_ENABLED=false
METRICS_TOKEN=generate-a-long-random-token

# Optional integrations
NVIDIA_API_KEY=...
JENKINS_URL=...
JENKINS_USER=...
JENKINS_TOKEN=...
SMTP_HOST=...
MAIL_FROM="SF DevOps Command Center <no-reply@your-domain.example>"
PUBLIC_APP_URL=https://your-domain.example
DEFECTS_WEBHOOK_SECRET=...

# Web build args (baked into the client bundle at build time)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
```

## 2. Build and start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Startup order is enforced: Postgres/Redis healthchecks → `migrate` (one-shot
`prisma migrate deploy`) → API → Web.

| Service  | Port | Notes |
|----------|------|-------|
| web      | 3000 | Serves the UI and proxies `/api/*` to the API service |
| api      | 3001 | REST API + Swagger (disabled by default in production) |
| postgres | internal | pgvector image; volume `postgres_data` |
| redis    | internal | queue backing store; volume `redis_data` |

Put a TLS-terminating reverse proxy (Caddy, nginx, Traefik, or a cloud LB) in
front of port 3000.

## 3. Salesforce CLI authentication

The API image pins Salesforce CLI 2.143.6, SFDMU 5.8.0, and Salesforce Code
Analyzer 5.14.0. It also includes Java and Python so PMD, Graph, and Flow
analysis engines are available. At startup the API verifies these versions and
self-repairs a missing plugin; inspect cached readiness at
authenticated `GET /api/health/plugins`. Org authentications persist in the `sf_auth` /
`sf_auth2` volumes, so re-authenticating after a container restart is not
required. To authenticate an org from inside the container:

```bash
docker compose -f docker-compose.prod.yml exec api sf org login web --instance-url https://login.salesforce.com
```

(or use the in-app Environment Center connect flow, which drives the same CLI.)

## 4. Operations

- **Migrations on upgrade**: rebuilding with `--build` reruns the `migrate`
  service before the new API starts.
- **Metrics**: scrape `GET /api/metrics` with `Authorization: Bearer $METRICS_TOKEN`.
- **Logs**: `docker compose -f docker-compose.prod.yml logs -f api web`.
- **Scaling the API**: `docker compose -f docker-compose.prod.yml up -d --scale api=3`
  behind your own load balancer, or run `node dist/cluster.js` (API_WORKERS)
  inside one container.

## Notes and caveats

- `NEXT_PUBLIC_*` values are baked into the web bundle at **build** time —
  rebuild the web image when they change.
- The web image's `/api/*` rewrite targets `http://api:3001` (compose service
  name) by default; override with the `API_INTERNAL_URL` build arg for other
  topologies.
- The dev gateway (`scripts/gateway.mjs`) is not used in this stack; Next.js
  proxies API calls directly.
