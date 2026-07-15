#!/usr/bin/env bash
# Start / stop / restart the full local stack: Docker (Postgres + Redis) + web + API.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PID_FILE="$ROOT_DIR/.dev/stack.pid"
GATEWAY_PID_FILE="$ROOT_DIR/.dev/gateway.pid"
LOG_FILE="$ROOT_DIR/.dev/stack.log"
mkdir -p "$ROOT_DIR/.dev"

WEB_PORT=3000
API_PORT=3001
GATEWAY_PORT="${GATEWAY_PORT:-8080}"
GATEWAY_ENABLED="${GATEWAY_ENABLED:-1}"
normalize_compression_enabled() {
  local value
  value="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  case "$value" in
    0|false) printf '0' ;;
    *) printf '1' ;;
  esac
}
GATEWAY_COMPRESSION_ENABLED="$(normalize_compression_enabled "${GATEWAY_COMPRESSION_ENABLED:-1}")"
WEB_UPSTREAM="${WEB_UPSTREAM:-http://127.0.0.1:${WEB_PORT}}"
TRUST_PROXY="${TRUST_PROXY:-}"
if [[ "$GATEWAY_ENABLED" == "1" && "$GATEWAY_COMPRESSION_ENABLED" == "1" ]]; then
  EDGE_COMPRESSION_ENABLED=1
else
  EDGE_COMPRESSION_ENABLED=0
fi
if [[ "$GATEWAY_ENABLED" == "1" && -z "$TRUST_PROXY" ]]; then
  TRUST_PROXY=loopback
fi

# Number of API instances behind the gateway pool. Instance 1 runs via turbo
# dev (watch mode); instances 2..N run the compiled API on ports 3002, 3003...
API_INSTANCES="${API_INSTANCES:-1}"

build_api_upstreams() {
  local upstreams="http://127.0.0.1:${API_PORT}"
  local i
  for ((i = 1; i < API_INSTANCES; i++)); do
    upstreams="${upstreams},http://127.0.0.1:$((API_PORT + i))"
  done
  printf '%s' "$upstreams"
}

API_UPSTREAMS="${API_UPSTREAMS:-$(build_api_upstreams)}"

log() {
  printf '%s\n' "$*"
}

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti:"$port" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  fi
}

stop_gateway() {
  if [[ -f "$GATEWAY_PID_FILE" ]]; then
    local gpid
    gpid="$(cat "$GATEWAY_PID_FILE")"
    if kill -0 "$gpid" 2>/dev/null; then
      kill "$gpid" 2>/dev/null || true
    fi
    rm -f "$GATEWAY_PID_FILE"
  fi
  kill_port "$GATEWAY_PORT"
}

stop_extra_apis() {
  local i
  for ((i = 1; i < 16; i++)); do
    local pid_file="$ROOT_DIR/.dev/api-$((API_PORT + i)).pid"
    if [[ -f "$pid_file" ]]; then
      local apid
      apid="$(cat "$pid_file")"
      kill "$apid" 2>/dev/null || true
      rm -f "$pid_file"
    fi
    if ((i < API_INSTANCES)); then
      kill_port "$((API_PORT + i))"
    fi
  done
}

stop_dev_servers() {
  log "Stopping web (:${WEB_PORT}) and API (:${API_PORT})..."
  stop_gateway
  stop_extra_apis

  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      pkill -P "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi

  kill_port "$WEB_PORT"
  kill_port "$API_PORT"
  kill_port 1717

  pkill -f "turbo run dev" 2>/dev/null || true
  pkill -f "next dev" 2>/dev/null || true
  pkill -f "nest start --watch" 2>/dev/null || true
  pkill -f "node dist/main.js" 2>/dev/null || true
  pkill -f "sf org login" 2>/dev/null || true
}

start_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    log "Docker not found — skipping Postgres/Redis (ensure DATABASE_URL and REDIS_URL point to running services)."
    return 0
  fi

  if ! docker info >/dev/null 2>&1; then
    log "Docker daemon is not running — start Docker Desktop, then run this command again."
    exit 1
  fi

  log "Starting Postgres + Redis (docker compose)..."
  docker compose up -d --wait
  log "Postgres and Redis are ready."
}

stop_docker() {
  if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
    log "Docker not available — skipped container shutdown."
    return 0
  fi

  log "Stopping Postgres + Redis..."
  docker compose down
}

clean_caches() {
  log "Cleaning apps/web/.next and apps/api/dist..."
  rm -rf "$ROOT_DIR/apps/web/.next" "$ROOT_DIR/apps/api/dist" "$ROOT_DIR/apps/web/node_modules/.cache"
}

clean_web_cache() {
  log "Cleaning apps/web/.next (fixes missing chunk / webpack errors)..."
  rm -rf "$ROOT_DIR/apps/web/.next" "$ROOT_DIR/apps/web/node_modules/.cache"
}

# Detect broken Next webpack manifests (e.g. Cannot find module './383.js')
is_next_cache_broken() {
  local next_dir="$ROOT_DIR/apps/web/.next"
  [[ -d "$next_dir" ]] || return 1

  if [[ -f "$next_dir/standalone/package.json" ]]; then
    return 0
  fi

  if command -v node >/dev/null 2>&1; then
    node - "$next_dir" <<'NODE' >/dev/null 2>&1
const fs = require('fs');
const path = require('path');
const root = process.argv[1];
const runtime = path.join(root, 'server/webpack-runtime.js');
if (!fs.existsSync(runtime)) process.exit(1);
const src = fs.readFileSync(runtime, 'utf8');
const ids = [...src.matchAll(/\b(\d+)\b/g)].map((m) => m[1]);
const server = path.join(root, 'server');
const chunks = path.join(server, 'chunks');
for (const id of new Set(ids)) {
  if (id.length > 4) continue;
  const inServer = fs.existsSync(path.join(server, `${id}.js`));
  const inChunks = fs.existsSync(path.join(chunks, `${id}.js`));
  if (!inServer && !inChunks && src.includes(`[${id}]`)) {
    process.exit(0);
  }
}
process.exit(1);
NODE
    return $?
  fi

  return 1
}

prepare_web_cache() {
  if is_next_cache_broken; then
    clean_web_cache
  fi
}

port_status() {
  local port="$1"
  local label="$2"
  if lsof -ti:"$port" >/dev/null 2>&1; then
    log "  ${label} (:${port}) — running"
  else
    log "  ${label} (:${port}) — stopped"
  fi
}

start_gateway() {
  if [[ "$GATEWAY_ENABLED" != "1" ]]; then
    return 0
  fi

  stop_gateway
  log "Starting gateway (:${GATEWAY_PORT}) — single entry point for web + API load balancing..."
  log "  API pool: ${API_UPSTREAMS}"
  local log_target="/dev/null"
  if [[ "${1:-}" == "bg" && -f "$LOG_FILE" ]]; then
    log_target="$LOG_FILE"
  fi
  GATEWAY_PORT="$GATEWAY_PORT" \
  GATEWAY_HOST="${GATEWAY_HOST:-0.0.0.0}" \
  WEB_UPSTREAM="$WEB_UPSTREAM" \
  API_UPSTREAMS="$API_UPSTREAMS" \
  GATEWAY_COMPRESSION_ENABLED="$GATEWAY_COMPRESSION_ENABLED" \
    node "$ROOT_DIR/scripts/gateway.mjs" >>"$log_target" 2>&1 &
  echo $! >"$GATEWAY_PID_FILE"
  sleep 1
}

# Start API instances 2..N on ports API_PORT+1... using the compiled build.
# Instance 1 is the watch-mode dev server started by turbo.
start_extra_apis() {
  if ((API_INSTANCES <= 1)); then
    return 0
  fi

  local dist_main="$ROOT_DIR/apps/api/dist/main.js"
  local waited=0
  while [[ ! -f "$dist_main" && $waited -lt 90 ]]; do
    sleep 2
    waited=$((waited + 2))
  done
  if [[ ! -f "$dist_main" ]]; then
    log "WARNING: apps/api/dist/main.js not found — extra API instances not started."
    return 0
  fi

  local i
  for ((i = 1; i < API_INSTANCES; i++)); do
    local port=$((API_PORT + i))
    kill_port "$port"
    log "Starting API instance $((i + 1))/${API_INSTANCES} on :${port}..."
    (cd "$ROOT_DIR/apps/api" && API_PORT="$port" TRUST_PROXY="$TRUST_PROXY" node dist/main.js) >>"${LOG_FILE}" 2>&1 &
    echo $! >"$ROOT_DIR/.dev/api-${port}.pid"
  done
}

print_stack_urls() {
  log ""
  if [[ "$GATEWAY_ENABLED" == "1" ]]; then
    log "  Gateway (recommended): http://localhost:${GATEWAY_PORT}"
  fi
  log "  Web:    http://localhost:${WEB_PORT}"
  log "  API:    http://localhost:${API_PORT}"
  log "  Swagger http://localhost:${API_PORT}/api/docs"
  if [[ "$GATEWAY_ENABLED" == "1" ]]; then
    log "  Health: http://localhost:${GATEWAY_PORT}/api/health"
  fi
  log ""
}

cmd_status() {
  log "Stack status:"
  if [[ "$GATEWAY_ENABLED" == "1" ]]; then
    port_status "$GATEWAY_PORT" "Gateway"
  fi
  port_status "$WEB_PORT" "Web"
  port_status "$API_PORT" "API"

  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker compose ps --status running 2>/dev/null | grep -q sfcc; then
      log "  Docker — postgres/redis running"
    else
      log "  Docker — postgres/redis stopped"
    fi
  else
    log "  Docker — unavailable"
  fi

  if [[ -f "$GATEWAY_PID_FILE" ]] && kill -0 "$(cat "$GATEWAY_PID_FILE")" 2>/dev/null; then
    log "  Gateway — pid $(cat "$GATEWAY_PID_FILE")"
  fi

  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    log "  Turbo dev — pid $(cat "$PID_FILE") (log: .dev/stack.log)"
  fi
}

cmd_stop() {
  stop_dev_servers

  if [[ "${1:-}" == "--apps-only" ]]; then
    log "App servers stopped (Docker left running)."
    return 0
  fi

  stop_docker
  log "All services stopped."
}

cmd_start() {
  local mode="${1:-}"

  start_docker
  stop_dev_servers
  prepare_web_cache

  if [[ "$mode" == "--bg" ]]; then
    stop_dev_servers
    log "Starting dev servers in background..."
    local api_proxy_target=""
    if [[ "$GATEWAY_ENABLED" == "1" ]]; then
      api_proxy_target="${API_PROXY_TARGET:-http://127.0.0.1:${GATEWAY_PORT}}"
    fi
    API_PROXY_TARGET="$api_proxy_target" \
      EDGE_COMPRESSION_ENABLED="$EDGE_COMPRESSION_ENABLED" \
      TRUST_PROXY="$TRUST_PROXY" \
      npm run dev:apps >"$LOG_FILE" 2>&1 &
    echo $! >"$PID_FILE"
    sleep 3
    start_gateway bg
    start_extra_apis
    log ""
    log "Stack running in background."
    print_stack_urls
    log "  Log:    .dev/stack.log"
    log ""
    log "Stop with: npm run dev:stop"
    return 0
  fi

  log ""
  log "Starting web (:${WEB_PORT}) + API pool (${API_UPSTREAMS})..."
  log "Press Ctrl+C to stop app servers (Docker keeps running)."
  log "Full stop: npm run dev:stop"
  log ""

  trap 'stop_dev_servers; exit 0' INT TERM
  start_gateway
  start_extra_apis &
  print_stack_urls
  if [[ "$GATEWAY_ENABLED" == "1" ]]; then
    # Route the Next.js /api rewrite through the gateway pool so browser
    # traffic hitting :3000 directly is still load balanced.
    API_PROXY_TARGET="${API_PROXY_TARGET:-http://127.0.0.1:${GATEWAY_PORT}}" \
      EDGE_COMPRESSION_ENABLED="$EDGE_COMPRESSION_ENABLED" \
      TRUST_PROXY="$TRUST_PROXY" \
      npm run dev:apps
  else
    API_PROXY_TARGET="" EDGE_COMPRESSION_ENABLED="$EDGE_COMPRESSION_ENABLED" TRUST_PROXY="$TRUST_PROXY" npm run dev:apps
  fi
}

cmd_restart() {
  local extra="${1:-}"

  stop_dev_servers

  if [[ "$extra" == "--clean" ]]; then
    clean_caches
  else
    prepare_web_cache
  fi

  sleep 1
  start_docker

  log ""
  log "Restarting web + API..."
  log "Press Ctrl+C to stop app servers. Full stop: npm run dev:stop"
  log ""

  trap 'stop_dev_servers; exit 0' INT TERM
  local api_proxy_target=""
  if [[ "$GATEWAY_ENABLED" == "1" ]]; then
    api_proxy_target="${API_PROXY_TARGET:-http://127.0.0.1:${GATEWAY_PORT}}"
  fi
  API_PROXY_TARGET="$api_proxy_target" \
    EDGE_COMPRESSION_ENABLED="$EDGE_COMPRESSION_ENABLED" \
    TRUST_PROXY="$TRUST_PROXY" \
    npm run dev:apps &
  echo $! >"$PID_FILE"
  sleep 3
  start_gateway bg
  start_extra_apis
  print_stack_urls
  wait "$(cat "$PID_FILE")"
}

usage() {
  cat <<EOF
Usage: npm run dev[:stop|:restart|:status] [-- flags]

  npm run dev                 Start Docker + web + API (foreground)
  npm run dev:stop              Stop web, API, Postgres, and Redis
  npm run dev:restart           Restart app servers (clears .next only if cache is broken)
  npm run dev:restart -- --clean  Force-clear .next and api/dist, then restart
  npm run dev:status            Show what is running

Direct script:
  bash scripts/stack.sh start [--bg]   Background mode writes .dev/stack.log
  bash scripts/stack.sh stop [--apps-only]
  bash scripts/stack.sh restart [--clean]
  bash scripts/stack.sh status

Environment:
  API_INSTANCES=N   Start N API instances (ports 3001..300N) behind the gateway pool
  GATEWAY_ENABLED=0 Disable the gateway (direct web/API access only)
  GATEWAY_PORT=8080 Gateway listen port
  GATEWAY_COMPRESSION_ENABLED=0 Disable edge compression (Next gzip remains enabled)
EOF
}

if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
  return 0
fi

case "${1:-start}" in
  start) cmd_start "${2:-}" ;;
  stop) cmd_stop "${2:-}" ;;
  restart) cmd_restart "${2:-}" ;;
  status) cmd_status ;;
  help|-h|--help) usage ;;
  *)
    log "Unknown command: $1"
    usage
    exit 1
    ;;
esac
