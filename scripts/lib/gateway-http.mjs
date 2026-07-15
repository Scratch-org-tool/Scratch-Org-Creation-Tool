import { constants as zlibConstants, createBrotliCompress, createGzip } from 'node:zlib';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const COMPRESSED_MIME_TYPES = [
  /^application\/(?:gzip|pdf|wasm|x-7z-compressed|x-bzip2|x-gzip|x-rar-compressed|zip)(?:;|$)/i,
  /^audio\//i,
  /^font\//i,
  /^image\/(?!svg\+xml(?:;|$))/i,
  /^video\//i,
];

export const STREAMING_PATHS = new Set([
  '/api/copilot/chat/stream',
  '/api/stream/events',
]);

function parseQuality(raw) {
  if (raw === undefined) return 1;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) return 0;
  return value;
}

/**
 * Select an encoding by client quality, using Brotli as the server preference
 * when qualities tie. Implicit identity does not override an accepted
 * compression coding, but an explicit higher-quality identity preference does.
 */
export function negotiateContentEncoding(header) {
  if (!header?.trim()) return { encoding: null, acceptable: true };

  const qualities = new Map();
  for (const item of header.split(',')) {
    const [rawName, ...parameters] = item.trim().toLowerCase().split(';');
    if (!rawName) continue;
    let q;
    for (const parameter of parameters) {
      const match = /^\s*q\s*=\s*([^\s]+)\s*$/.exec(parameter);
      if (match) q = parseQuality(match[1]);
    }
    const quality = q ?? 1;
    qualities.set(rawName, Math.max(qualities.get(rawName) ?? 0, quality));
  }

  const wildcard = qualities.get('*');
  const br = qualities.get('br') ?? wildcard ?? 0;
  const gzip = qualities.get('gzip') ?? wildcard ?? 0;
  const identityExplicit = qualities.has('identity');
  const identity = qualities.get('identity') ??
    (wildcard === 0 ? 0 : 1);
  const bestCompressed = Math.max(br, gzip);

  if (identityExplicit && identity > bestCompressed) {
    return { encoding: null, acceptable: identity > 0 };
  }
  if (bestCompressed > 0) {
    return { encoding: br === bestCompressed ? 'br' : 'gzip', acceptable: true };
  }
  return { encoding: null, acceptable: identity > 0 };
}

export function isStreamingPath(requestUrl) {
  let pathname;
  try {
    pathname = new URL(requestUrl ?? '/', 'http://gateway.invalid').pathname;
  } catch {
    return false;
  }
  return STREAMING_PATHS.has(pathname);
}

export function isRetryableMethod(method) {
  return ['GET', 'HEAD', 'OPTIONS'].includes((method ?? 'GET').toUpperCase());
}

export function stripHopByHopHeaders(inputHeaders) {
  const headers = { ...inputHeaders };
  const connectionTokens = String(headers.connection ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  for (const name of [...HOP_BY_HOP_HEADERS, ...connectionTokens]) {
    delete headers[name];
  }
  return headers;
}

function appendForwardedValue(existing, value) {
  if (Array.isArray(existing)) existing = existing.join(', ');
  return existing ? `${existing}, ${value}` : value;
}

export function createUpstreamHeaders(req, target) {
  const headers = stripHopByHopHeaders(req.headers);
  const remoteAddress = req.socket.remoteAddress;
  if (remoteAddress) {
    headers['x-forwarded-for'] = appendForwardedValue(headers['x-forwarded-for'], remoteAddress);
  }
  headers['x-forwarded-proto'] = appendForwardedValue(
    headers['x-forwarded-proto'],
    req.socket.encrypted ? 'https' : 'http',
  );
  if (req.headers.host) {
    headers['x-forwarded-host'] = appendForwardedValue(headers['x-forwarded-host'], req.headers.host);
  }
  headers.host = target.host;
  return headers;
}

export function appendVary(headers, value) {
  const current = headers.vary;
  const values = (Array.isArray(current) ? current.join(',') : current ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (values.includes('*') || values.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
    return;
  }
  headers.vary = [...values, value].join(', ');
}

export function isCompressionCandidate(req, status, headers) {
  if ((req.method ?? 'GET').toUpperCase() === 'HEAD' ||
      status === 204 ||
      status === 206 ||
      status === 304) {
    return false;
  }
  if (isStreamingPath(req.url)) return false;
  if (headers['content-encoding'] && String(headers['content-encoding']).toLowerCase() !== 'identity') {
    return false;
  }
  if (/\bno-transform\b/i.test(String(headers['cache-control'] ?? ''))) return false;
  if (/^\s*attachment(?:;|$)/i.test(String(headers['content-disposition'] ?? ''))) return false;

  const contentType = String(headers['content-type'] ?? '').toLowerCase();
  if (!contentType ||
      /^text\/event-stream(?:;|$)/i.test(contentType) ||
      /^application\/(?:x-)?ndjson(?:;|$)/i.test(contentType) ||
      COMPRESSED_MIME_TYPES.some((pattern) => pattern.test(contentType))) {
    return false;
  }

  return /^text\//i.test(contentType) ||
    /^application\/(?:json|javascript|x-javascript|xml|xhtml\+xml)(?:;|$)/i.test(contentType) ||
    /^application\/[^;]+\+(?:json|xml)(?:;|$)/i.test(contentType) ||
    /^image\/svg\+xml(?:;|$)/i.test(contentType);
}

export function createCompressor(encoding) {
  if (encoding === 'br') {
    return createBrotliCompress({
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 4,
      },
    });
  }
  return createGzip({ level: 6 });
}
