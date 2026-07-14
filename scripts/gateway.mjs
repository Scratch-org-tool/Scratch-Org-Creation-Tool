#!/usr/bin/env node
/**
 * Top-level reverse proxy / load balancer.
 *
 * - Routes /api/* to the API upstream pool (round-robin + failover).
 * - Routes everything else to the Next.js web server.
 * - Periodic health checks (/api/health) evict dead upstreams from rotation.
 * - Request timeouts (connect + first byte) with streaming-safe behaviour:
 *   SSE / NDJSON responses are never idle-timed-out once streaming starts.
 * - WebSocket upgrades are proxied to the pool (Next HMR goes to the web upstream).
 */
import http from 'node:http';
import net from 'node:net';
import { URL } from 'node:url';
import { ERROR_FALLBACK_HTML, isPlainErrorBody } from './lib/error-fallback-html.mjs';

const WEB_UPSTREAM = (process.env.WEB_UPSTREAM ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const API_UPSTREAMS = (process.env.API_UPSTREAMS ?? process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);
const GATEWAY_PORT = Number(process.env.GATEWAY_PORT ?? 8080);
const GATEWAY_HOST = process.env.GATEWAY_HOST ?? '0.0.0.0';

const HEALTH_CHECK_INTERVAL_MS = Number(process.env.GATEWAY_HEALTH_INTERVAL_MS ?? 10_000);
const HEALTH_CHECK_TIMEOUT_MS = Number(process.env.GATEWAY_HEALTH_TIMEOUT_MS ?? 3_000);
const CONNECT_TIMEOUT_MS = Number(process.env.GATEWAY_CONNECT_TIMEOUT_MS ?? 10_000);
const RESPONSE_TIMEOUT_MS = Number(process.env.GATEWAY_RESPONSE_TIMEOUT_MS ?? 120_000);

/** Paths that stream indefinitely (SSE event bus, copilot NDJSON) — no response timeout. */
const STREAMING_PATH_PREFIXES = ['/api/stream', '/api/copilot'];

// ---------------------------------------------------------------------------
// Upstream pool with health tracking
// ---------------------------------------------------------------------------

const upstreamHealth = new Map(API_UPSTREAMS.map((u) => [u, { healthy: true, lastError: null }]));
let apiCursor = 0;

function healthyApiUpstreams() {
  const healthy = API_UPSTREAMS.filter((u) => upstreamHealth.get(u)?.healthy);
  // If every upstream is marked down, fall back to trying all of them —
  // better a failed attempt than an instant 503 when checks are stale.
  return healthy.length > 0 ? healthy : [...API_UPSTREAMS];
}

function rotatedApiUpstreams() {
  const pool = healthyApiUpstreams();
  const start = apiCursor % pool.length;
  apiCursor = (apiCursor + 1) % pool.length;
  return [...pool.slice(start), ...pool.slice(0, start)];
}

function markUnhealthy(upstream, reason) {
  const state = upstreamHealth.get(upstream);
  if (state?.healthy) {
    console.warn(`[gateway] upstream DOWN: ${upstream} (${reason})`);
  }
  if (state) {
    state.healthy = false;
    state.lastError = reason;
  }
}

function markHealthy(upstream) {
  const state = upstreamHealth.get(upstream);
  if (state && !state.healthy) {
    console.log(`[gateway] upstream UP: ${upstream}`);
  }
  if (state) {
    state.healthy = true;
    state.lastError = null;
  }
}

function checkUpstream(upstream) {
  return new Promise((resolve) => {
    let target;
    try {
      target = new URL('/api/health', upstream);
    } catch {
      resolve(false);
      return;
    }
    const req = http.get(
      {
        hostname: target.hostname,
        port: target.port || 80,
        path: target.pathname,
        timeout: HEALTH_CHECK_TIMEOUT_MS,
      },
      (res) => {
        res.resume();
        resolve((res.statusCode ?? 500) < 500);
      },
    );
    req.on('timeout', () => {
      req.destroy(new Error('health check timeout'));
    });
    req.on('error', () => resolve(false));
  });
}

async function runHealthChecks() {
  await Promise.all(
    API_UPSTREAMS.map(async (upstream) => {
      const ok = await checkUpstream(upstream);
      if (ok) markHealthy(upstream);
      else markUnhealthy(upstream, 'health check failed');
    }),
  );
}

// ---------------------------------------------------------------------------
// HTTP proxying
// ---------------------------------------------------------------------------

function isStreamingPath(path) {
  return STREAMING_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function proxyRequest(req, res, upstreams, options = {}) {
  const { replacePlainErrors = false, trackHealth = false } = options;
  const streaming = isStreamingPath(req.url ?? '/');
  let attempt = 0;

  const respond = (status, headers, body) => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.writeHead(status, headers);
    if (body !== undefined) res.end(body);
  };

  const tryUpstream = () => {
    if (!upstreams.length) {
      if (replacePlainErrors) {
        respond(503, { 'Content-Type': 'text/html; charset=utf-8' }, ERROR_FALLBACK_HTML);
        return;
      }
      respond(503, { 'Content-Type': 'text/plain' }, 'No API upstreams configured');
      return;
    }
    if (attempt >= upstreams.length) {
      if (replacePlainErrors) {
        respond(502, { 'Content-Type': 'text/html; charset=utf-8' }, ERROR_FALLBACK_HTML);
        return;
      }
      respond(502, { 'Content-Type': 'text/plain' }, 'All upstream servers unavailable');
      return;
    }

    const base = upstreams[attempt];
    attempt += 1;

    let target;
    try {
      target = new URL(req.url ?? '/', base);
    } catch {
      if (replacePlainErrors) {
        respond(500, { 'Content-Type': 'text/html; charset=utf-8' }, ERROR_FALLBACK_HTML);
        return;
      }
      respond(500, { 'Content-Type': 'text/plain' }, 'Invalid upstream URL');
      return;
    }

    const headers = { ...req.headers, host: target.host };
    delete headers.connection;

    const proxyReq = http.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method: req.method,
        headers,
        timeout: CONNECT_TIMEOUT_MS,
      },
      (proxyRes) => {
        const status = proxyRes.statusCode ?? 502;
        const retryable = status >= 502 && attempt < upstreams.length && !res.headersSent;
        if (retryable) {
          if (trackHealth) markUnhealthy(base, `HTTP ${status}`);
          proxyRes.resume();
          tryUpstream();
          return;
        }

        if (replacePlainErrors && status >= 500) {
          const chunks = [];
          proxyRes.on('data', (chunk) => chunks.push(chunk));
          proxyRes.on('end', () => {
            if (res.headersSent) return;
            const body = Buffer.concat(chunks).toString('utf8');
            if (isPlainErrorBody(body, status)) {
              respond(status, { 'Content-Type': 'text/html; charset=utf-8' }, ERROR_FALLBACK_HTML);
              return;
            }
            const outHeaders = { ...proxyRes.headers };
            delete outHeaders['content-length'];
            respond(status, outHeaders, body);
          });
          return;
        }

        if (!res.headersSent) {
          res.writeHead(status, proxyRes.headers);
          proxyRes.pipe(res);
        } else {
          proxyRes.resume();
        }
      },
    );

    // Connect timeout: no response within the window → try the next upstream.
    proxyReq.on('timeout', () => {
      proxyReq.destroy(new Error('upstream connect timeout'));
    });

    // First-byte / total-response timeout for non-streaming requests.
    let responseTimer;
    if (!streaming && RESPONSE_TIMEOUT_MS > 0) {
      responseTimer = setTimeout(() => {
        if (!res.headersSent) {
          proxyReq.destroy(new Error('upstream response timeout'));
        }
      }, RESPONSE_TIMEOUT_MS);
      proxyReq.on('response', () => clearTimeout(responseTimer));
      proxyReq.on('close', () => clearTimeout(responseTimer));
    }

    proxyReq.on('error', (err) => {
      if (trackHealth) markUnhealthy(base, err.message);
      if (attempt < upstreams.length && !res.headersSent) {
        tryUpstream();
        return;
      }
      if (replacePlainErrors) {
        respond(502, { 'Content-Type': 'text/html; charset=utf-8' }, ERROR_FALLBACK_HTML);
        return;
      }
      respond(502, { 'Content-Type': 'text/plain' }, 'All upstream servers unavailable');
    });

    // Client went away — stop the upstream request too.
    res.on('close', () => {
      if (!proxyReq.destroyed) proxyReq.destroy();
    });

    req.pipe(proxyReq);
  };

  tryUpstream();
}

const server = http.createServer((req, res) => {
  const path = req.url ?? '/';
  if (path === '/gateway/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      upstreams: API_UPSTREAMS.map((u) => ({
        url: u,
        healthy: upstreamHealth.get(u)?.healthy ?? false,
        lastError: upstreamHealth.get(u)?.lastError ?? null,
      })),
    }));
    return;
  }
  if (path.startsWith('/api')) {
    proxyRequest(req, res, rotatedApiUpstreams(), { trackHealth: true });
    return;
  }
  proxyRequest(req, res, [WEB_UPSTREAM], { replacePlainErrors: true });
});

// ---------------------------------------------------------------------------
// WebSocket upgrade proxying (Next HMR → web upstream; /api → API pool)
// ---------------------------------------------------------------------------

server.on('upgrade', (req, clientSocket, head) => {
  const path = req.url ?? '/';
  const pool = path.startsWith('/api') ? rotatedApiUpstreams() : [WEB_UPSTREAM];

  let attempt = 0;
  const tryUpstream = () => {
    if (attempt >= pool.length) {
      clientSocket.destroy();
      return;
    }
    const base = pool[attempt];
    attempt += 1;

    let target;
    try {
      target = new URL(path, base);
    } catch {
      clientSocket.destroy();
      return;
    }

    const upstreamSocket = net.connect(
      Number(target.port || 80),
      target.hostname,
      () => {
        const headerLines = [
          `${req.method} ${path} HTTP/1.1`,
          ...Object.entries(req.headers).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`),
          '',
          '',
        ];
        upstreamSocket.write(headerLines.join('\r\n'));
        if (head?.length) upstreamSocket.write(head);
        upstreamSocket.pipe(clientSocket);
        clientSocket.pipe(upstreamSocket);
      },
    );

    upstreamSocket.setTimeout(CONNECT_TIMEOUT_MS, () => {
      upstreamSocket.destroy();
    });
    upstreamSocket.on('connect', () => upstreamSocket.setTimeout(0));
    upstreamSocket.on('error', () => {
      if (path.startsWith('/api')) markUnhealthy(base, 'websocket connect failed');
      if (!clientSocket.destroyed && attempt < pool.length) tryUpstream();
      else clientSocket.destroy();
    });
    clientSocket.on('error', () => upstreamSocket.destroy());
  };

  tryUpstream();
});

// Long-lived SSE connections must not be killed by the server's default timeouts.
server.requestTimeout = 0;
server.headersTimeout = 60_000;
server.keepAliveTimeout = 75_000;

server.listen(GATEWAY_PORT, GATEWAY_HOST, () => {
  console.log(`Gateway listening on http://localhost:${GATEWAY_PORT}`);
  console.log(`  Web upstream:  ${WEB_UPSTREAM}`);
  console.log(`  API upstreams: ${API_UPSTREAMS.join(', ')}`);
  console.log(`  Health checks: every ${HEALTH_CHECK_INTERVAL_MS}ms (/api/health)`);
});

void runHealthChecks();
const healthTimer = setInterval(runHealthChecks, HEALTH_CHECK_INTERVAL_MS);
healthTimer.unref();

function shutdown() {
  clearInterval(healthTimer);
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
