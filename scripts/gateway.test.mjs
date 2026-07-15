import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import { after, before, describe, test } from 'node:test';
import { brotliDecompressSync, gzipSync, gunzipSync } from 'node:zlib';
import {
  createUpstreamHeaders,
  isCompressionCandidate,
  isRetryableMethod,
  isStreamingPath,
  isTrustedImmediatePeer,
  negotiateContentEncoding,
  stripHopByHopHeaders,
} from './lib/gateway-http.mjs';

const threshold = 128;
const largeJson = JSON.stringify({
  items: Array.from({ length: 300 }, (_, index) => ({
    id: index,
    state: 'ready',
    description: 'A representative gateway payload with deliberately repeated text.',
  })),
});
const largeText = 'compressible text response '.repeat(300);
const upstreamGzip = gzipSync(largeText);
const binaryBody = Buffer.alloc(4096, 0xa5);
let upstream;
let gateway;
let gatewayPort;
let gatewayLogs = '';
let compressionRatio;

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function reservePort() {
  const server = http.createServer();
  return listen(server).then((port) => new Promise((resolve) => {
    server.close(() => resolve(port));
  }));
}

function request(path, { method = 'GET', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: gatewayPort,
      path,
      method,
      headers,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.once('aborted', () => reject(new Error('gateway response aborted')));
      res.once('error', reject);
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks),
      }));
    });
    req.once('error', reject);
    req.end();
  });
}

function decoded(response) {
  if (response.headers['content-encoding'] === 'br') return brotliDecompressSync(response.body);
  if (response.headers['content-encoding'] === 'gzip') return gunzipSync(response.body);
  return response.body;
}

before(async () => {
  upstream = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://fixture.invalid');
    if (url.pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
      return;
    }
    if (url.pathname === '/small-chunked') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
      return;
    }
    if (url.pathname === '/destroyed-mid-body') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.write('partial');
      setImmediate(() => res.destroy());
      return;
    }
    if (url.pathname === '/large-json' || url.pathname === '/api/copilot/chat') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(largeJson),
      });
      res.end(largeJson);
      return;
    }
    if (url.pathname === '/chunked-text') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      for (let offset = 0; offset < largeText.length; offset += 73) {
        res.write(largeText.slice(offset, offset + 73));
      }
      res.end();
      return;
    }
    if (url.pathname === '/small') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': 11,
      });
      res.end('{"ok":true}');
      return;
    }
    if (url.pathname === '/encoded') {
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Content-Encoding': 'gzip',
        'Content-Length': upstreamGzip.length,
      });
      res.end(upstreamGzip);
      return;
    }
    if (url.pathname === '/binary') {
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': binaryBody.length,
      });
      res.end(binaryBody);
      return;
    }
    if (url.pathname === '/attachment') {
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Content-Disposition': 'attachment; filename="large.txt"',
      });
      res.end(largeText);
      return;
    }
    if (url.pathname === '/no-transform') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, no-transform',
      });
      res.end(largeJson);
      return;
    }
    if (url.pathname === '/api/stream/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end(`data: ${largeText}\n\n`);
      return;
    }
    if (url.pathname === '/api/copilot/chat/stream') {
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      res.end(`${largeJson}\n`);
      return;
    }
    if (url.pathname === '/forwarded') {
      const body = JSON.stringify(req.headers);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Connection: 'keep-alive, x-remove-me',
        'X-Remove-Me': 'secret',
      });
      res.end(body);
      return;
    }
    if (url.pathname === '/idle-progress') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      let sent = 0;
      const timer = setInterval(() => {
        sent += 1;
        res.write(`chunk-${sent}-${'x'.repeat(80)}\n`);
        if (sent === 5) {
          clearInterval(timer);
          res.end();
        }
      }, 75);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });
  const upstreamPort = await listen(upstream);
  gatewayPort = await reservePort();
  gateway = spawn(process.execPath, ['scripts/gateway.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      WEB_UPSTREAM: `http://127.0.0.1:${upstreamPort}`,
      API_UPSTREAMS: `http://127.0.0.1:${upstreamPort}`,
      GATEWAY_HOST: '127.0.0.1',
      GATEWAY_PORT: String(gatewayPort),
      GATEWAY_COMPRESSION_THRESHOLD: String(threshold),
      GATEWAY_RESPONSE_TIMEOUT_MS: '180',
      GATEWAY_HEALTH_INTERVAL_MS: '60000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  gateway.stdout.on('data', (chunk) => {
    gatewayLogs += chunk;
  });
  gateway.stderr.on('data', (chunk) => {
    gatewayLogs += chunk;
  });

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (gateway.exitCode !== null) throw new Error(`Gateway exited early:\n${gatewayLogs}`);
    try {
      const response = await request('/gateway/health');
      if (response.status === 200) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw new Error(`Gateway did not start:\n${gatewayLogs}`);
});

after(async () => {
  if (gateway?.exitCode === null) gateway.kill('SIGTERM');
  await Promise.all([
    gateway?.exitCode === null
      ? new Promise((resolve) => gateway.once('exit', resolve))
      : Promise.resolve(),
    upstream
      ? new Promise((resolve) => upstream.close(resolve))
      : Promise.resolve(),
  ]);
  if (compressionRatio !== undefined) {
    console.log(`[gateway-test] brotli wire/original ratio=${compressionRatio.toFixed(4)}`);
  }
});

describe('gateway helper behavior', () => {
  test('honors encoding quality and explicit identity preferences', () => {
    assert.deepEqual(negotiateContentEncoding('gzip, br'), {
      encoding: 'br',
      acceptable: true,
      identityAcceptable: true,
    });
    assert.deepEqual(negotiateContentEncoding('br;q=.4, gzip;q=.8'), {
      encoding: 'gzip',
      acceptable: true,
      identityAcceptable: true,
    });
    assert.deepEqual(negotiateContentEncoding('identity;q=1, br;q=.5'), {
      encoding: null,
      acceptable: true,
      identityAcceptable: true,
    });
    assert.deepEqual(negotiateContentEncoding('identity;q=0, br;q=0, gzip;q=0'), {
      encoding: null,
      acceptable: false,
      identityAcceptable: false,
    });
    assert.deepEqual(negotiateContentEncoding('identity;q=0, gzip;q=.5'), {
      encoding: 'gzip',
      acceptable: true,
      identityAcceptable: false,
    });
  });

  test('trusts forwarded chains only for an explicitly matched immediate peer', () => {
    const request = {
      headers: {
        host: 'public.example',
        'x-forwarded-for': '198.51.100.7',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'edge.example',
        'x-forwarded-port': '443',
      },
      socket: { remoteAddress: '::ffff:127.0.0.1', encrypted: false },
    };
    const target = new URL('http://127.0.0.1:3000');

    assert.equal(isTrustedImmediatePeer(request.socket.remoteAddress, undefined), false);
    assert.equal(isTrustedImmediatePeer(request.socket.remoteAddress, 'loopback'), true);
    const untrusted = createUpstreamHeaders(request, target);
    assert.equal(untrusted['x-forwarded-for'], '::ffff:127.0.0.1');
    assert.equal(untrusted['x-forwarded-proto'], 'http');
    assert.equal(untrusted['x-forwarded-host'], 'public.example');
    assert.equal(untrusted['x-forwarded-port'], undefined);

    const trusted = createUpstreamHeaders(request, target, 'loopback');
    assert.equal(trusted['x-forwarded-for'], '198.51.100.7, ::ffff:127.0.0.1');
    assert.equal(trusted['x-forwarded-proto'], 'https, http');
    assert.equal(trusted['x-forwarded-host'], 'edge.example, public.example');
  });

  test('normalizes the stack compression flag before deriving Next compression', () => {
    const resolveFlags = (value, gatewayEnabled = '1') => {
      const result = spawnSync(
        'bash',
        ['-c', 'source scripts/stack.sh; printf "%s:%s" "$GATEWAY_COMPRESSION_ENABLED" "$EDGE_COMPRESSION_ENABLED"'],
        {
          cwd: new URL('..', import.meta.url),
          env: { ...process.env, GATEWAY_COMPRESSION_ENABLED: value, GATEWAY_ENABLED: gatewayEnabled },
          encoding: 'utf8',
        },
      );
      assert.equal(result.status, 0, result.stderr);
      return result.stdout;
    };

    for (const value of ['false', ' False ', '\t0\n']) {
      assert.equal(resolveFlags(value), '0:0');
    }
    for (const value of ['true', ' TRUE ', '1', 'unexpected']) {
      assert.equal(resolveFlags(value), '1:1');
    }
    assert.equal(resolveFlags('true', '0'), '1:0');
  });

  test('matches only the exact streaming routes', () => {
    assert.equal(isStreamingPath('/api/stream/events?ticket=x'), true);
    assert.equal(isStreamingPath('/api/copilot/chat/stream'), true);
    assert.equal(isStreamingPath('/api/copilot/chat'), false);
    assert.equal(isStreamingPath('/api/copilot'), false);
  });

  test('retries only safe bodyless methods and strips connection tokens', () => {
    assert.equal(isRetryableMethod('GET'), true);
    assert.equal(isRetryableMethod('OPTIONS'), true);
    for (const method of ['POST', 'PATCH', 'DELETE', 'PUT']) {
      assert.equal(isRetryableMethod(method), false);
    }
    assert.deepEqual(
      stripHopByHopHeaders({ connection: 'keep-alive, x-private', 'x-private': 'remove', other: 'keep' }),
      { other: 'keep' },
    );
  });

  test('allows compressible JSON, text, JavaScript, XML, and SVG MIME types only', () => {
    const req = { method: 'GET', url: '/asset', headers: {} };
    for (const contentType of [
      'application/json',
      'application/problem+json',
      'text/css',
      'application/javascript',
      'application/xml',
      'image/svg+xml',
    ]) {
      assert.equal(isCompressionCandidate(req, 200, { 'content-type': contentType }), true, contentType);
    }
    for (const contentType of [
      'application/octet-stream',
      'application/pdf',
      'application/zip',
      'application/wasm',
      'font/woff2',
      'image/jpeg',
      'audio/mpeg',
      'video/mp4',
    ]) {
      assert.equal(isCompressionCandidate(req, 200, { 'content-type': contentType }), false, contentType);
    }
    assert.equal(isCompressionCandidate(req, 204, { 'content-type': 'application/json' }), false);
    assert.equal(isCompressionCandidate(req, 304, { 'content-type': 'application/json' }), false);
  });
});

describe('gateway edge compression', () => {
  test('prefers Brotli and substantially reduces representative JSON wire bytes', async () => {
    const response = await request('/large-json', {
      headers: { 'Accept-Encoding': 'gzip, br' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers['content-encoding'], 'br');
    assert.match(response.headers.vary, /(?:^|,\s*)Accept-Encoding(?:,|$)/i);
    assert.equal(response.headers['content-length'], undefined);
    assert.equal(decoded(response).toString(), largeJson);
    compressionRatio = response.body.length / Buffer.byteLength(largeJson);
    assert.ok(compressionRatio < 0.5, `expected ratio below 0.5, got ${compressionRatio}`);
  });

  test('negotiates gzip and identity according to quality values', async () => {
    const gzip = await request('/large-json', {
      headers: { 'Accept-Encoding': 'br;q=.3, gzip;q=.9' },
    });
    assert.equal(gzip.headers['content-encoding'], 'gzip');
    assert.equal(decoded(gzip).toString(), largeJson);

    const identity = await request('/large-json', {
      headers: { 'Accept-Encoding': 'identity;q=1, br;q=.5, gzip;q=.4' },
    });
    assert.equal(identity.headers['content-encoding'], undefined);
    assert.equal(identity.body.toString(), largeJson);

    const unacceptable = await request('/large-json', {
      headers: { 'Accept-Encoding': 'identity;q=0, br;q=0, gzip;q=0' },
    });
    assert.equal(unacceptable.status, 406);
  });

  test('buffers only through the threshold for unknown-length responses', async () => {
    const large = await request('/chunked-text', {
      headers: { 'Accept-Encoding': 'gzip' },
    });
    assert.equal(large.headers['content-encoding'], 'gzip');
    assert.equal(decoded(large).toString(), largeText);

    const small = await request('/small', {
      headers: { 'Accept-Encoding': 'br' },
    });
    assert.equal(small.headers['content-encoding'], undefined);
    assert.match(small.headers.vary, /Accept-Encoding/i);
    assert.equal(small.body.toString(), '{"ok":true}');
  });

  test('never selects identity for eligible small bodies when identity is forbidden', async () => {
    for (const path of ['/small', '/small-chunked']) {
      const response = await request(path, {
        headers: { 'Accept-Encoding': 'identity;q=0, gzip;q=.8' },
      });
      assert.equal(response.status, 200, path);
      assert.equal(response.headers['content-encoding'], 'gzip', path);
      assert.equal(decoded(response).toString(), '{"ok":true}', path);

      const unacceptable = await request(path, {
        headers: { 'Accept-Encoding': 'identity;q=0, br;q=0, gzip;q=0' },
      });
      assert.equal(unacceptable.status, 406, path);
    }
  });

  test('does not double-compress encoded responses or compress excluded bodies', async () => {
    const encoded = await request('/encoded', {
      headers: { 'Accept-Encoding': 'br, gzip' },
    });
    assert.equal(encoded.headers['content-encoding'], 'gzip');
    assert.deepEqual(encoded.body, upstreamGzip);

    for (const [path, expected] of [
      ['/binary', binaryBody],
      ['/attachment', Buffer.from(largeText)],
      ['/no-transform', Buffer.from(largeJson)],
      ['/api/stream/events', Buffer.from(`data: ${largeText}\n\n`)],
      ['/api/copilot/chat/stream', Buffer.from(`${largeJson}\n`)],
    ]) {
      const response = await request(path, { headers: { 'Accept-Encoding': 'br, gzip' } });
      assert.equal(response.headers['content-encoding'], undefined, path);
      assert.deepEqual(response.body, expected, path);
    }
  });

  test('compresses the non-streaming copilot endpoint and skips HEAD', async () => {
    const response = await request('/api/copilot/chat', {
      headers: { 'Accept-Encoding': 'br' },
    });
    assert.equal(response.headers['content-encoding'], 'br');
    assert.equal(decoded(response).toString(), largeJson);

    const head = await request('/large-json', {
      method: 'HEAD',
      headers: { 'Accept-Encoding': 'br' },
    });
    assert.equal(head.headers['content-encoding'], undefined);
    assert.equal(head.body.length, 0);
  });
});

describe('gateway proxy safety', () => {
  test('replaces spoofed forwarding headers and removes hop-by-hop headers', async () => {
    const response = await request('/forwarded', {
      headers: {
        Host: 'client.example',
        'X-Forwarded-For': '198.51.100.7',
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': 'edge.example',
        'X-Forwarded-Port': '443',
        Connection: 'keep-alive, x-client-hop',
        'X-Client-Hop': 'remove-me',
      },
    });
    const received = JSON.parse(response.body.toString());
    assert.equal(received['x-forwarded-for'], '127.0.0.1');
    assert.equal(received['x-forwarded-proto'], 'http');
    assert.equal(received['x-forwarded-host'], 'client.example');
    assert.equal(received['x-forwarded-port'], undefined);
    assert.notEqual(received.host, 'client.example');
    assert.equal(received['x-client-hop'], undefined);
    assert.equal(response.headers['x-remove-me'], undefined);
  });

  test('survives upstream destruction before threshold selection and while draining 406', async () => {
    const failed = await request('/destroyed-mid-body', {
      headers: { 'Accept-Encoding': 'gzip' },
    });
    assert.equal(failed.status, 502);

    const unacceptable = await request('/destroyed-mid-body', {
      headers: { 'Accept-Encoding': 'identity;q=0, br;q=0, gzip;q=0' },
    });
    assert.equal(unacceptable.status, 406);
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(gateway.exitCode, null, gatewayLogs);
    assert.equal((await request('/gateway/health')).status, 200);
  });

  test('keeps the response timeout as an idle timeout through body completion', async () => {
    const response = await request('/idle-progress', {
      headers: { 'Accept-Encoding': 'gzip' },
    });
    assert.equal(response.status, 200);
    assert.match(decoded(response).toString(), /chunk-5/);
  });
});
