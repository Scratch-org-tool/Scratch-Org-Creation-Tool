# Salesforce DevOps Command Center

AI-powered platform that automates the Salesforce development lifecycle — scratch org creation, metadata deployment, bulk data loading, user provisioning, release management, and an always-on AI copilot.

Built as a **Turborepo monorepo** with Next.js, NestJS, PostgreSQL, Redis, Firebase Authentication, and the Salesforce CLI.

---

## Table of contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the application](#running-the-application)
- [Authentication & user roles](#authentication--user-roles)
- [Navigation & UI](#navigation--ui)
- [Access from another device (same Wi-Fi)](#access-from-another-device-same-wi-fi)
- [Modules](#modules)
- [Data deployment](#data-deployment)
- [AI Copilot](#ai-copilot)
- [Useful commands](#useful-commands)
- [Troubleshooting](#troubleshooting)
- [Project structure](#project-structure)
- [License](#license)

---

## Architecture

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Web** | Next.js 15, Tailwind CSS | UI at `http://localhost:3000` |
| **API** | NestJS | REST API at `http://localhost:3001` |
| **Gateway** | Node reverse proxy (optional) | Single entry on `:8080` with API load balancing |
| **Database** | PostgreSQL + Prisma | Orgs, jobs, scratch orgs, user profiles |
| **Queue** | BullMQ + Redis | Background workers (deploy, data, etc.) |
| **Auth** | Firebase Authentication | Email/password login |
| **Profiles** | PostgreSQL `AppUser` | Roles, status, `lastActiveAt`, per-module access |
| **AI** | NVIDIA NIM (OpenAI-compatible) | Copilot and agent orchestration |
| **SF automation** | Salesforce CLI (`sf`) + SFDMU | Org auth, scratch orgs, metadata & data |

The web app **proxies** `/api/*` requests to the NestJS server, so browsers only need to reach port **3000** (important for LAN access).

Deployment Tool users are stored in PostgreSQL with a `DPT_` ID prefix when registered through the app. Legacy Firebase UID rows are still supported for login and appear in **User Access**.

---

## Prerequisites

Install these before you start:

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | 20+ | `node -v` |
| **npm** | 10+ | Comes with Node |
| **Docker Desktop** | Latest | For PostgreSQL + Redis |
| **Salesforce CLI** | 2.143.6 | [Install `sf`](https://developer.salesforce.com/tools/salesforcecli); production image pins this version |
| **SFDMU plugin** | 5.8.0 | Automatically provisioned by the API |
| **Salesforce Code Analyzer** | 5.14.0 | Automatically provisioned by the API |
| **Java / Python** | Java 11+, Python 3.10+ | Code Analyzer PMD/Graph/Flow prerequisites; bundled in the API image |
| **Firebase project** | — | [Firebase Console](https://console.firebase.google.com/) with **Email/Password** auth enabled |
| **NVIDIA API key** | Optional | For AI Copilot features |

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/Ajay200026/sf-devops-command-center.git
cd sf-devops-command-center
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start PostgreSQL and Redis

```bash
npm run docker:up
```

This starts:

- **PostgreSQL** (pgvector) on host port `55432` (container `5432`) — user `sfcc`, password `sfcc_dev_password`, database `sfcc`
- **Redis** on port `6379`

> **Using local Postgres instead of Docker?**  
> Create a database named `sfcc` and set `DATABASE_URL` in `apps/api/.env` to your connection string.

### 4. Set up environment variables

```bash
# Root defaults (optional — mainly for reference)
cp .env.example .env

# API server (required)
cp apps/api/.env.example apps/api/.env

# Web app (required)
cp apps/web/.env.example apps/web/.env.local
```

Edit the files — see [Configuration](#configuration) below.

### 5. Initialize the database

```bash
npm run db:generate
npm run db:push
```

### 6. Start development servers

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| **Gateway** (recommended) | http://localhost:8080 |
| **Web UI** | http://localhost:3000 |
| **Login** | http://localhost:3000/login |
| **API** | http://localhost:3001 |
| **Swagger docs** | http://localhost:3001/api/docs |

---

## Configuration

### Firebase (required for login)

1. Open [Firebase Console](https://console.firebase.google.com/) → your project.
2. **Authentication** → **Sign-in method** → enable **Email/Password**.
3. **Project settings** → **Your apps** → Web app → copy the config into `apps/web/.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="..."
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
NEXT_PUBLIC_FIREBASE_APP_ID="..."
```

4. Set the **same** project ID and web API key in `apps/api/.env`:

```env
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_WEB_API_KEY="..."   # same as NEXT_PUBLIC_FIREBASE_API_KEY
```

5. Download a **service account JSON** (Project settings → Service accounts → Generate new private key) and set in `apps/api/.env` — **required** for server-proxied login/signup (custom tokens):

```env
FIREBASE_SERVICE_ACCOUNT_PATH="/absolute/path/to/service-account.json"
```

Or paste `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` directly.

### Auth security (login / signup)

Login and signup are **proxied through the API** (`POST /api/auth/login`, `/api/auth/signup`, `/api/auth/forgot-password`):

- **Validation:** Zod schemas on the server for email, password, and display name (HTML stripped from display names).
- **Rate limiting:** Redis — 10 requests/IP/minute on login and signup; 5/minute on forgot-password.
- **Lockout:** 5 failed login attempts locks the account for 15 minutes (same generic error as wrong password); a password-reset email is sent via Firebase.
- **Password storage:** User passwords are **never stored in PostgreSQL**. Firebase Authentication hashes credentials (scrypt). The `AppUser` table holds profile/role data only.
- **Error messages:** Generic responses only — e.g. `Incorrect email or password`, no field-level or enumeration leaks.

`REDIS_URL` must be reachable for rate limiting and lockout (in-memory fallback exists for local dev without Redis).

### API environment (`apps/api/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis URL (`redis://localhost:6379`) |
| `ENCRYPTION_KEY` | Yes | 64-char hex string for encrypting SF tokens |
| `FIREBASE_PROJECT_ID` | Yes | Must match web Firebase project |
| `NVIDIA_API_KEY` | For Copilot | NVIDIA NIM API key — get one at [build.nvidia.com](https://build.nvidia.com/) |
| `NVIDIA_COPILOT_MODEL` | Optional | Default `meta/llama-3.2-3b-instruct` (fast, reliable). Avoid `google/gemma-3n-e4b-it` if requests hang. |
| `NVIDIA_CHAT_TIMEOUT_MS` | Optional | Copilot LLM timeout (default `45000`) |
| `SF_CLI_PATH` | Yes | Usually `sf` |
| `SF_AUTO_INSTALL_PLUGINS` | Optional | Provision missing allowlisted plugins at startup/on use (default `true`) |
| `SF_ENFORCE_PLUGIN_VERSIONS` | Optional | Keep plugins on tested versions (default `true`) |
| `SFDMU_PLUGIN_VERSION` | Optional | Tested SFDMU version (default `5.8.0`) |
| `SF_CODE_ANALYZER_PLUGIN_VERSION` | Optional | Tested Code Analyzer version (default `5.14.0`) |
| `SF_PLUGIN_INSTALL_TIMEOUT_MS` | Optional | Plugin registry/install timeout (default `600000`) |
| `SF_ALLOW_UNSIGNED_SFDMU` | Optional | Keep `false`; explicit trust escape hatch for private/offline registries |
| `SF_PROJECT_ROOT` | Yes | Absolute path to this repo |
| `DATA_DEPLOY_CHUNK_SIZE` | Optional | Records per chunk for large deploys (default `25000`) |
| `DATA_DEPLOY_CONCURRENCY` | Optional | Parallel data-deploy workers (default `2`) |
| `SFDMU_RUN_CONCURRENCY` | Optional | Parallel SFDMU workers (default `2`) |
| `SFDMU_FAIL_ON_WARNING` | Optional | Treat SFDMU warnings/skipped rows as failures (default `true`) |
| `SFDMU_KEEP_RUN_ARTIFACTS` | Optional | Set `true` to keep temp SFDMU CSVs for debugging (default: deleted after each run) |
| `ADMIN_EMAILS` | Optional | Comma-separated emails auto-promoted to admin |

Generate an encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Web environment (`apps/web/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Leave as `http://localhost:3001` for local dev (API is also proxied via Next.js) |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase web SDK config (see above) |

### Salesforce CLI

Authenticate a Dev Hub (one-time, in your terminal):

```bash
sf org login web --set-default-dev-hub
```

Org credentials are stored encrypted in PostgreSQL when you connect orgs from **Environment Center**.

---

## Running the application

### Development (recommended)

```bash
npm run dev
```

Starts Docker (Postgres + Redis), the web app (`:3000`), API (`:3001`), and optionally the gateway (`:8080`) via `scripts/stack.sh`.

```bash
npm run dev:restart   # Restart the full stack
npm run dev:stop      # Stop web, API, gateway, and Docker
npm run dev:status    # Show what's running
npm run dev:apps      # Turbo only (web + API, no stack script)
```

### Production build

```bash
npm run build
cd apps/api && npm run start
cd apps/web && npm run start
```

### Stop infrastructure

```bash
npm run docker:down
```

### Restart after port conflicts

If you see `EADDRINUSE` on ports 3000 or 3001:

```bash
npm run dev:restart
```

---

## Authentication & user roles

### Sign up / login

1. Open http://localhost:3000/login
2. **Sign up** with email and password (min 8 characters), or **log in** if you already have an account.

Only users with an `AppUser` row in PostgreSQL can use the API (registered through this app).

### Admin access (operators only)

Admin role is **not** exposed in the login UI. Use one of these operator-only methods:

1. **`ADMIN_BOOTSTRAP_SECRET`** in `apps/api/.env` — visit once:
   `http://localhost:8080/login?bootstrap=YOUR_SECRET`
   then sign up or sign in (the secret is stripped from the URL and stored for that browser session only).

2. **`ADMIN_EMAILS`** in `apps/api/.env` — comma-separated emails auto-promoted to admin on first register:
   `ADMIN_EMAILS=you@example.com`

Never commit real secrets to git.

### Scratch pipeline templates (`/scratch-templates`)

Config-driven presets for CONA scratch org pipelines:

| Step | Purpose |
|------|---------|
| Source orgs | **Data deployment org** (data seed + partners) and **custom settings load org** (SFDMU) |
| Custom settings | Bundled or custom JSON export from the custom settings org |
| Permissions | Permission sets and org config flags (after custom settings) |
| Data seed | Hybrid mode: automatic CONA datasets + optional **query JSON** (`config/templates/data-seed-query.example.json`) |
| Partners & users | **Sales office JSON** per bottler (`config/templates/bottler-5000-sales-offices.example.json`), matched partner import (20/office), **user templates** + slots |

Example JSON files live under `config/templates/`. Upload them in the template wizard; they are stored inline on the template.

Partner import default mode is **org_to_org_matched**: queries source org partners, matches seeded target accounts and EmployeeMaster, samples per sales office, then upserts.

User provisioning: upload `user-provision-5000.example.json` style templates, add slots with name/email; role, modules, and locations come from the template.

### Development vs production performance

`[Fast Refresh] rebuilding` in the browser console is **development-only** (Next.js hot reload). It does not occur after `npm run build` + `npm run start`. To measure real navigation speed, use a production build:

```powershell
cmd /c "npm run build --workspace=@sfcc/web"
cmd /c "npm run start --workspace=@sfcc/web"
```

### Roles & modules

| Role | Default access |
|------|----------------|
| **Admin** | All modules + **User Access** (`/admin/users`) |
| **User** | Dashboard, Environment Center, Data Center |

Admins can grant additional modules per user: Deployment, Org Setup, Provisioning, Monitoring, Copilot.

### User Access (`/admin/users`)

Admin workspace with four tabs:

- **Users** — stat cards (total, active, admins, inactive, new-this-week), search + role/status filters, CSV export (with spreadsheet formula-injection hardening), and a **Manage** drawer for role, module grants, and active/inactive status.
- **Roles** — read-only overview of the derived role model (Super Admin, Integration, Developer, Viewer) with live per-role counts.
- **Permissions** — a module × role matrix showing what each role can access (admins always get every module).
- **Activity Logs** — a paginated, security-relevant audit feed (access changes, session revocations, password activity).

APIs:

- `GET /auth/users/overview` — stats + enriched user list (single AppUser query).
- `PATCH /auth/users/:id/access` — `{ role?, grantedModules?, status? }`. Admins **cannot** change their own access here, and the **last active admin** is protected from demotion/deactivation. Every change (and denial) is written to the audit trail with the acting admin and a PII-free diff.
- `GET /auth/audit-events?limit&offset` — admin-only, paginated audit feed. `ipHash`/`userAgentHash` are never returned.

Users appear after they log in at least once (row created in `AppUser`).

---

## Navigation & UI

The app uses a **compact flat sidebar**, **gradient page headers** (`DeploymentPageHeader`), and **breadcrumbs** on child pages.

### Sidebar

| Item | Notes |
|------|-------|
| **Dashboard** | Premium overview — KPI cards, platform health, quick actions |
| **Environment** | **Integrations hub** — Connected orgs, Salesforce, Azure DevOps, scratch orgs (tabbed workspace) |
| **Deployment** | Expands into a submenu of every deployment tool (CI/CD, Data Operations, Org & Users) and opens the Deployment Center hub |
| **Monitoring** | Job stats and recent jobs table (select a row for status details) |
| **User Access** | Admin only |

### Deployment Center hub & sidebar submenu

Selecting **Deployment** in the sidebar expands a submenu of every deployment tool, and the same links power the `/deployment-center` hub page. Both read from a single source of truth (`apps/web/src/lib/deployment-links.ts`) and are grouped/gated by permission:

- **CI/CD deployment** (`deployment`) — Deployment Workbench, Git Metadata Deploy, Org-to-Org Metadata, Jenkins (coming soon)
- **Data operations** (`data`) — Data Operations, Data Deployment, Custom Settings Load
- **Org & users** (`org-setup` / `provisioning`) — Org & Users

Deployment Workbench is reached from this submenu/hub — it is **not** a separate top-level sidebar item (no duplicates). Legacy routes redirect to tabbed workspaces (e.g. `/user-provisioning` → `/org-setup?tab=users-cona`).

### Studio UI kit

Shared components live under `apps/web/src/components/studio/`:

| Component | Purpose |
|-----------|---------|
| `DeploymentPageHeader` | Gradient hero with icon, subtitle, breadcrumbs, actions |
| `KpiCard` / `CardDecoration` | Premium stat cards with accent glow and sparklines |
| `StatCard` / `StatCardGrid` | Standard KPI strip |
| `GlassCard` | Panel shell for forms, tables, consoles |
| `HubActionCard` / `DeploymentHubSection` | Deployment Center hub tiles |
| `TabbedWorkspaceShell` | Unified tabbed workspaces (Data Operations, Org & Users) |
| `QuickActionGrid` | Dashboard quick-action links |
| `StatusBadge`, `InlineAlert`, `FormSection` | Forms, lists, alerts |

Feature workspaces live under `apps/web/src/modules/`.

---

## Access from another device (same Wi-Fi)

The web server binds to all interfaces (`0.0.0.0:3000`). The **gateway** also listens on all interfaces (`0.0.0.0:8080`). Other devices on the same network can use your machine’s LAN IP:

```bash
# On the host Mac, find your IP:
ipconfig getifaddr en0
```

| Access from | Recommended URL |
|-------------|-----------------|
| This Mac | http://localhost:8080 |
| Another device on Wi-Fi | `http://<host-ip>:8080` |

Example: `http://192.168.1.10:8080/login`

When using the gateway, both the web UI and `/api/*` are served from port **8080**, so you do not need separate API URL configuration on other devices.

If you open the web app directly on port **3000** from another device, set `NEXT_PUBLIC_API_URL=http://<host-ip>:8080` in `apps/web/.env.local` and restart the web server.

**Firebase note:** If sign-in fails from a raw IP, add the IP under Firebase Console → **Authentication** → **Settings** → **Authorized domains**.

---

## Modules

| Module | Route | Description |
|--------|-------|-------------|
| Dashboard | `/dashboard` | Premium KPI cards, platform health, recent deployments, quick actions |
| Integrations | `/environment-center` | Tabbed hub: Salesforce orgs, Azure DevOps, scratch org pipeline |
| Deployment Center | `/deployment-center` | Hub for CI/CD, Data Operations, and Org & Users |
| Data Operations | `/data-center` | Tabbed: CONA seed, replication, query templates (built-in + custom shared templates) |
| Data Deployment | `/data-deploy` | Org-to-org record deployment with previews, target comparison, insert/upsert, and rollback (also opens from the Deployment Workbench) |
| Metadata Deployment | `/metadata-deployment` | Org-to-org metadata compare, diff, deploy, and pre-deploy AI risk scoring |
| Azure DevOps | `/deployment-center/azure` | Metadata deploy from Azure repos with live console |
| Jenkins | `/deployment-center/jenkins` | Jenkins job browser, parameterized triggers, live console logs, stop build |
| Releases | `/releases` | Versioned releases grouping deployments + work items with approvals and AI release notes |
| Apex Quality | `/quality` | Run Apex tests, inspect failures, track org-wide coverage trends |
| Drift Monitoring | `/drift` | Scheduled org drift checks with one-click remediation deploys |
| Calendar | `/calendar` | Scheduled deploys, drift checks, releases, sandbox refreshes, and freeze windows |
| Sandbox Refresh | `/sandbox-refresh` | Track/trigger sandbox refreshes with cadence reminders and post-refresh seed automation |
| Org & Users | `/org-setup` | Tabbed: baseline setup, load org config, CONA users, CSV provisioning |
| Monitoring | `/monitoring` | Job stats, filterable jobs table, status detail on row select |
| AI Copilot | Sidebar button | Streaming NVIDIA-powered assistant (see [AI Copilot](#ai-copilot)) |
| User Access | `/admin/users` | Admin user and permission management |
| Notifications | `/admin/notifications` | Master switch, categories, email channel, Slack/Teams webhooks |
| Audit Report | `/admin/audit` | Unified auth + deployment + workbench audit feed with CSV export |

Operational endpoints: Prometheus metrics at `GET /api/metrics` (`METRICS_TOKEN` bearer auth in production) and work-item webhooks at `POST /api/defects/webhooks/work-item-updated` (see `docs/developer-board-email-alerts.md`). Production container deployment is documented in `docs/production-deployment.md`.

### Legacy route redirects

| Old route | Redirects to |
|-----------|--------------|
| `/environment-center/connect` | `/environment-center` (Integrations tab) |
| `/environment-center/connect-azure` | `/environment-center?tab=azure` |
| `/data-center/deployment`, `/replication`, `/templates` | `/data-center?tab=…` |
| `/user-provisioning` | `/org-setup?tab=users-cona` |

---

## Data deployment

Org-to-org and bulk data jobs use the Salesforce CLI (and SFDMU for upsert paths). The platform supports **large deployments** without leaving record CSVs in the repository.

### Limits & preview

| Setting | Value | Notes |
|---------|-------|-------|
| Max deploy limit | **100,000** records per object | Configurable per object in Data Center |
| Preview cap | **2,000** rows | Salesforce query API limit; UI shows COUNT for larger limits |
| Chunk size | **25,000** records | Large deploys split automatically (`DATA_DEPLOY_CHUNK_SIZE`) |

**Preview vs deploy:** The record picker preview may show up to 2,000 rows even when your deploy limit is higher (e.g. 10,500). The full limit is still used at deploy time.

### Chunked batch deploy

When a deploy exceeds one chunk, the API creates a `DataDeployBatch` with multiple `DataDeployChunk` rows. Each chunk runs as a separate queue job with:

- Per-org bulk throttling (`SF_MAX_CONCURRENT_BULK_PER_ORG`)
- Scaled bulk wait timeouts (`SF_DATA_BULK_WAIT_MINUTES`)
- Live progress in the Data Center UI (`GET /api/data/batches/:id`)

Strategies:

| Strategy | Worker | Use case |
|----------|--------|----------|
| **Insert** | `data-deploy` | Bulk export from source → bulk import to target |
| **Upsert / replicate** | `sfdmu-run` | SFDMU with `export.json` + record-type mapping |

### Deploy artifacts (no files in repo)

Working files are **not** saved under the project folder:

| Artifact | Location | Cleanup |
|----------|----------|---------|
| SFDMU config + CSVs | OS temp (`/tmp/sfcc-sfdmu-runs/<movement-id>/`) | Deleted when SFDMU job finishes |
| Bulk import/export CSVs | OS temp (`/tmp/sfcc-data-deploy/<movement-id>/`) | Deleted when chunk job finishes |
| SF bulk job results (`*-success-records.csv`, `*-failed-records.csv`) | Same temp dir as the bulk command | Deleted with the work dir |

To debug a failed run locally, set `SFDMU_KEEP_RUN_ARTIFACTS=true` in `apps/api/.env` and redeploy.

Failure details are always written to the **job log** in Monitoring / the deploy console — you do not need local CSV files for normal operation.

### API endpoints (data)

| Endpoint | Description |
|----------|-------------|
| `POST /api/data/org-to-org/deploy` | Single-object org-to-org deploy |
| `POST /api/data/org-to-org/deploy-batch` | Chunked multi-object batch deploy |
| `GET /api/data/batches/:id` | Batch + chunk progress |
| `POST /api/data/org-to-org/preview-filter` | Preview with COUNT for large limits |
| `GET /api/data/movements/:id` | Movement status |

After pulling schema changes, run:

```bash
npm run db:push
```

---

## AI Copilot

The sidebar copilot uses **NVIDIA NIM** (OpenAI-compatible API) with **streaming** responses by default.

### Configuration

Set in `apps/api/.env`:

```env
NVIDIA_API_KEY="nvapi-..."
NVIDIA_COPILOT_MODEL="meta/llama-3.2-3b-instruct"
NVIDIA_FALLBACK_MODEL="nvidia/nemotron-mini-4b-instruct"
NVIDIA_CHAT_TIMEOUT_MS=45000
```

### Behaviour

- **Streaming:** `POST /api/copilot/chat/stream` returns NDJSON (`content`, `reasoning`, `done`, `error` events).
- **Fast chat mode:** Panel Q&A disables extended thinking; deploy actions only run on explicit intent (e.g. “deploy now”).
- **Fallback:** If streaming times out, the API retries non-streaming, then the fallback model.
- **Dev mode:** Without a valid `NVIDIA_API_KEY`, the copilot returns a short mock response.

### Troubleshooting copilot

| Symptom | Fix |
|---------|-----|
| “AI request timed out” | Increase `NVIDIA_CHAT_TIMEOUT_MS`; switch model away from `google/gemma-3n-e4b-it` |
| No streaming / empty reply | Confirm API is running; check `apps/api` logs for `[NVIDIA]` errors |
| 401 on copilot | Sign in again; ensure your user has the **Copilot** module grant |

---

## Useful commands

```bash
npm run dev              # Start full stack (Docker + web + API + gateway)
npm run dev:restart      # Restart stack
npm run dev:stop         # Stop stack
npm run dev:status       # Stack status
npm run build            # Build all packages
npm run db:generate      # Regenerate Prisma client
npm run db:push          # Push schema to database
npm run db:migrate       # Run Prisma migrations
npm run docker:up        # Start Postgres + Redis
npm run docker:down      # Stop Postgres + Redis
npm run smoke-test       # Basic API smoke test
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **Connection refused** on API | Run `npm run dev`; or `npm run dev:restart` |
| **401 Unauthorized** on login | Ensure `FIREBASE_PROJECT_ID` in `apps/api/.env` matches `NEXT_PUBLIC_FIREBASE_PROJECT_ID` in `apps/web/.env.local` |
| **Cannot reach API** from another laptop | Use `http://<host-ip>:3000`, not `localhost` on the other device |
| **EADDRINUSE** | Run `npm run dev:restart` |
| **Prisma errors** | Run `npm run db:generate && npm run db:push` |
| **Redis / Postgres down** | Run `npm run docker:up` and wait for health checks |
| **SF CLI not found** | Install `sf` and set `SF_CLI_PATH=sf` in `apps/api/.env` |
| **SFDMU / custom settings fails** | Check authenticated `GET /api/health/plugins`. The API auto-repairs missing plugins; verify manually with `sf plugins inspect sfdmu --json` if registry access or permissions fail. |
| **Static analysis says Code Analyzer unavailable** | Check authenticated `GET /api/health/plugins`; verify Java/Python and `sf plugins inspect code-analyzer --json`. |
| **CSV files in project root** | Old bulk runs before temp-dir fix — delete `*-failed-records.csv` / `*-success-records.csv`; new runs use `/tmp` only |
| **`DataMovement.batchId` missing (500)** | Run `npm run db:push` to sync Prisma schema |
| **Preview shows 2000 rows but limit is higher** | Expected — preview is capped; deploy uses full limit (see [Data deployment](#data-deployment)) |
| **Copilot timeout** | Set `NVIDIA_COPILOT_MODEL=meta/llama-3.2-3b-instruct` and valid `NVIDIA_API_KEY` |
| **Users not in User Access** | They must log in once so an `AppUser` row is created; click **Refresh** on the page |
| **Hydration warning in dev** | Usually from auth-dependent UI; hard-refresh or ignore in production build |

---

## Project structure

```
sf-devops-command-center/
├── apps/
│   ├── web/                      # Next.js 15 frontend
│   │   ├── src/app/              # App Router pages
│   │   ├── src/modules/          # Feature workspaces (dashboard, monitoring, user-access, …)
│   │   ├── src/components/studio/ # Shared UI kit (PageHeader, Breadcrumbs, StatCard, …)
│   │   └── .env.example          # → copy to .env.local
│   └── api/                      # NestJS backend
│       ├── src/modules/          # Feature modules (auth, environment, data, …)
│       └── .env.example          # → copy to .env
├── packages/
│   ├── shared/                   # Types, RBAC helpers, queue contracts
│   ├── db/                       # Prisma schema + client
│   ├── firebase/                 # Firebase Admin + dev JWT verification
│   └── sf-cli/                   # Salesforce CLI wrapper
├── scripts/
│   ├── stack.sh                  # Start/stop/restart local dev stack
│   └── gateway.mjs               # Optional reverse proxy / load balancer
├── config/
│   └── queries.example.json      # Example query-set config for data jobs
├── docker-compose.yml            # PostgreSQL + Redis
├── .env.example                  # Root env template
└── turbo.json                    # Monorepo task runner
```

> **Note:** `sfdmu-runs/` may appear in older clones from legacy runs. New deploys write to the OS temp directory and clean up automatically. The folder is listed in `.gitignore`.

---

## Author

**Ajay** — [GitHub @Ajay200026](https://github.com/Ajay200026)

---

## License

MIT — see [LICENSE](LICENSE) for details.
