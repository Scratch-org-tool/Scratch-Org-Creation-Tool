#!/usr/bin/env node
/**
 * Top-level reverse proxy / load balancer.
 *
 * - Routes /api/* to the API upstream pool (round-robin + failover).
 * - Routes everything else to the Next.js web server.
 * - Periodic health checks (/api/health) evict dead upstreams from rotation.
 * - Request timeouts (connect + response-body idle) with streaming-safe behaviour:
 *   SSE / NDJSON responses are never idle-timed-out once streaming starts.
 * - WebSocket upgrades are proxied to the pool (Next HMR goes to the web upstream).
 */
import http from 'node:http';
import net from 'node:net';
import { PassThrough, Readable, Transform, pipeline } from 'node:stream';
import { URL } from 'node:url';
import { ERROR_FALLBACK_HTML, isPlainErrorBody } from './lib/error-fallback-html.mjs';
import {
  appendVary,
  createCompressor,
  createUpstreamHeaders,
  isCompressionCandidate,
  isRetryableMethod,
  isStreamingPath,
  negotiateContentEncoding,
  stripHopByHopHeaders,
} from './lib/gateway-http.mjs';

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
const COMPRESSION_ENABLED = !['0', 'false'].includes(
  (process.env.GATEWAY_COMPRESSION_ENABLED ?? '1').trim().toLowerCase(),
);
const TRUSTED_PROXY_POLICY = process.env.GATEWAY_TRUST_PROXY ?? '';
const parsedCompressionThreshold = Number(process.env.GATEWAY_COMPRESSION_THRESHOLD ?? 1024);
const COMPRESSION_THRESHOLD = Number.isFinite(parsedCompressionThreshold) && parsedCompressionThreshold >= 0
  ? parsedCompressionThreshold
  : 1024;
const ERROR_INSPECTION_LIMIT = 64 * 1024;

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

class CompressionThreshold extends Transform {
  constructor(threshold, forceCompression, decide) {
    super();
    this.threshold = threshold;
    this.forceCompression = forceCompression;
    this.decide = decide;
    this.chunks = [];
    this.size = 0;
    this.decided = false;
  }

  decideOnce(compress) {
    if (this.decided) return;
    this.decided = true;
    this.decide(compress);
    for (const chunk of this.chunks) this.push(chunk);
    this.chunks = [];
  }

  _transform(chunk, _encoding, callback) {
    if (this.decided) {
      callback(null, chunk);
      return;
    }
    this.chunks.push(chunk);
    this.size += chunk.length;
    if (this.size > this.threshold) this.decideOnce(true);
    callback();
  }

  _flush(callback) {
    this.decideOnce(this.forceCompression);
    callback();
  }
}

function forwardResponse(req, res, status, inputHeaders, source, onError) {
  const headers = stripHopByHopHeaders(inputHeaders);
  const eligible = isCompressionCandidate(req, status, headers);
  const candidate = COMPRESSION_ENABLED && eligible;
  if (eligible) appendVary(headers, 'Accept-Encoding');

  const negotiation = eligible
    ? negotiateContentEncoding(String(req.headers['accept-encoding'] ?? ''))
    : { encoding: null, acceptable: true, identityAcceptable: true };

  const canRespond = candidate
    ? negotiation.acceptable
    : !eligible || negotiation.identityAcceptable;
  if (!canRespond) {
    const body = 'No acceptable content encoding is available';
    res.writeHead(406, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      Vary: 'Accept-Encoding',
    });
    res.end(body);
    // Draining permits socket reuse, and the listener owns any late upstream
    // failure after the final client response has already been selected.
    source.on('error', () => {});
    source.resume();
    return;
  }

  const startPipeline = (bodySource, encoding) => {
    if (res.destroyed) {
      bodySource.destroy();
      return;
    }
    const outputHeaders = { ...headers };
    const streams = [bodySource];
    if (encoding) {
      delete outputHeaders['content-length'];
      delete outputHeaders['content-md5'];
      outputHeaders['content-encoding'] = encoding;
      streams.push(createCompressor(encoding));
    }
    streams.push(res);
    res.writeHead(status, outputHeaders);
    pipeline(...streams, (error) => {
      if (!error) return;
      if (!res.headersSent) onError(error);
      else if (!res.destroyed) res.destroy(error);
    });
  };

  if (!candidate || !negotiation.encoding) {
    startPipeline(source, null);
    return;
  }

  const rawLength = headers['content-length'];
  const contentLength = typeof rawLength === 'string' && /^\d+$/.test(rawLength)
    ? Number(rawLength)
    : null;
  const forceCompression = !negotiation.identityAcceptable;
  if (contentLength !== null) {
    const compress = forceCompression || contentLength > COMPRESSION_THRESHOLD;
    startPipeline(source, compress ? negotiation.encoding : null);
    return;
  }

  let gate;
  let failed = false;
  const failBeforeOrDuringPipeline = (error) => {
    if (failed) return;
    failed = true;
    source.unpipe(gate);
    if (!source.destroyed) source.destroy();
    if (!gate.destroyed) gate.destroy();
    if (!res.headersSent) onError(error);
    else if (!res.destroyed) res.destroy(error);
  };
  gate = new CompressionThreshold(COMPRESSION_THRESHOLD, forceCompression, (compress) => {
    startPipeline(gate, compress ? negotiation.encoding : null);
  });
  source.once('error', failBeforeOrDuringPipeline);
  source.once('aborted', () => {
    failBeforeOrDuringPipeline(new Error('upstream response aborted'));
  });
  source.once('close', () => {
    if (!source.readableEnded) {
      failBeforeOrDuringPipeline(new Error('upstream response closed prematurely'));
    }
  });
  gate.once('error', failBeforeOrDuringPipeline);
  source.pipe(gate);
}

function inspectWebError(req, res, status, headers, proxyRes, onError) {
  const chunks = [];
  let size = 0;
  let decided = false;

  const onData = (chunk) => {
    if (decided) return;
    chunks.push(chunk);
    size += chunk.length;
    if (size <= ERROR_INSPECTION_LIMIT) return;

    decided = true;
    proxyRes.pause();
    proxyRes.off('data', onData);
    proxyRes.off('end', onEnd);
    const pass = new PassThrough();
    forwardResponse(req, res, status, headers, pass, onError);
    pass.write(Buffer.concat(chunks), () => {
      if (!proxyRes.destroyed) proxyRes.pipe(pass);
    });
  };

  const onEnd = () => {
    if (decided) return;
    decided = true;
    const body = Buffer.concat(chunks);
    if (isPlainErrorBody(body.toString('utf8'), status)) {
      forwardResponse(
        req,
        res,
        status,
        { 'content-type': 'text/html; charset=utf-8' },
        Readable.from([Buffer.from(ERROR_FALLBACK_HTML)]),
        onError,
      );
      return;
    }
    forwardResponse(req, res, status, headers, Readable.from([body]), onError);
  };

  proxyRes.on('data', onData);
  proxyRes.once('end', onEnd);
  proxyRes.once('error', onError);
}

function proxyRequest(req, res, upstreams, options = {}) {
  const { replacePlainErrors = false, trackHealth = false } = options;
  const streaming = isStreamingPath(req.url ?? '/');
  const hasRequestBody =
    Number(req.headers['content-length'] ?? 0) > 0 ||
    Boolean(req.headers['transfer-encoding']);
  const mayRetry = isRetryableMethod(req.method) && !hasRequestBody;
  let attempt = 0;
  let activeProxyReq;
  let activeProxyRes;

  const respond = (status, headers, body) => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.writeHead(status, headers);
    if (body !== undefined) res.end(body);
  };

  const stopActiveUpstream = () => {
    if (activeProxyRes && !activeProxyRes.destroyed) activeProxyRes.destroy();
    if (activeProxyReq && !activeProxyReq.destroyed) activeProxyReq.destroy();
  };
  req.once('aborted', stopActiveUpstream);
  res.once('close', stopActiveUpstream);

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

    const headers = createUpstreamHeaders(req, target, TRUSTED_PROXY_POLICY);
    let proxyRes;
    let responseTimer;
    let attemptFinished = false;

    const clearResponseTimer = () => {
      if (responseTimer) clearTimeout(responseTimer);
      responseTimer = undefined;
    };

    const armResponseTimer = () => {
      if (streaming || RESPONSE_TIMEOUT_MS <= 0) return;
      clearResponseTimer();
      responseTimer = setTimeout(() => {
        const error = new Error('upstream response timeout');
        if (proxyRes && !proxyRes.destroyed) proxyRes.destroy(error);
        else if (!proxyReq.destroyed) proxyReq.destroy(error);
        if (res.headersSent && !res.destroyed) res.destroy(error);
      }, RESPONSE_TIMEOUT_MS);
    };

    const handleAttemptError = (error) => {
      if (attemptFinished || res.destroyed) return;
      attemptFinished = true;
      clearResponseTimer();
      if (trackHealth) markUnhealthy(base, error.message);
      if (mayRetry && attempt < upstreams.length && !res.headersSent) {
        tryUpstream();
        return;
      }
      if (replacePlainErrors) {
        respond(502, { 'Content-Type': 'text/html; charset=utf-8' }, ERROR_FALLBACK_HTML);
        return;
      }
      respond(502, { 'Content-Type': 'text/plain' }, 'All upstream servers unavailable');
    };

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
      (upstreamResponse) => {
        proxyRes = upstreamResponse;
        activeProxyRes = proxyRes;
        proxyReq.setTimeout(0);
        armResponseTimer();
        proxyRes.on('data', armResponseTimer);
        proxyRes.once('end', clearResponseTimer);
        proxyRes.once('close', clearResponseTimer);

        const status = proxyRes.statusCode ?? 502;
        const retryable =
          status >= 502 &&
          mayRetry &&
          attempt < upstreams.length &&
          !res.headersSent;
        if (status >= 502 && trackHealth) markUnhealthy(base, `HTTP ${status}`);
        if (retryable) {
          attemptFinished = true;
          clearResponseTimer();
          proxyRes.resume();
          tryUpstream();
          return;
        }

        if (replacePlainErrors && status >= 500) {
          inspectWebError(req, res, status, proxyRes.headers, proxyRes, handleAttemptError);
          return;
        }

        if (res.headersSent) {
          proxyRes.resume();
          return;
        }
        forwardResponse(req, res, status, proxyRes.headers, proxyRes, handleAttemptError);
      },
    );
    activeProxyReq = proxyReq;
    armResponseTimer();

    // Connect timeout: no response within the window → try the next upstream.
    proxyReq.on('timeout', () => {
      proxyReq.destroy(new Error('upstream connect timeout'));
    });

    proxyReq.once('error', handleAttemptError);
    if (mayRetry) proxyReq.end();
    else req.pipe(proxyReq);
  };

  tryUpstream();
}

const server = http.createServer((req, res) => {
  const path = req.url ?? '/';
  if (path === '/gateway/health') {
    const body = Buffer.from(JSON.stringify({
      status: 'ok',
      upstreams: API_UPSTREAMS.map((u) => ({
        url: u,
        healthy: upstreamHealth.get(u)?.healthy ?? false,
        lastError: upstreamHealth.get(u)?.lastError ?? null,
      })),
    }));
    forwardResponse(
      req,
      res,
      200,
      { 'content-type': 'application/json', 'content-length': String(body.length) },
      Readable.from([body]),
      (error) => res.destroy(error),
    );
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
        const upgradeHeaders = createUpstreamHeaders(req, target, TRUSTED_PROXY_POLICY);
        upgradeHeaders.connection = 'Upgrade';
        upgradeHeaders.upgrade = req.headers.upgrade ?? 'websocket';
        const headerLines = [
          `${req.method} ${path} HTTP/1.1`,
          ...Object.entries(upgradeHeaders).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`),
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
  console.log(`  Compression:   ${COMPRESSION_ENABLED ? `br/gzip above ${COMPRESSION_THRESHOLD} bytes` : 'disabled'}`);
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
