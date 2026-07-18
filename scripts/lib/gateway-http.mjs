import { BlockList, isIP } from 'node:net';
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

const LONG_RUNNING_MEDIA_PATHS = [
  /^\/api\/learning\/tutor\/explainer\/(?:speech|image|video)$/,
];

export function isLongRunningMediaPath(requestUrl) {
  let pathname;
  try {
    pathname = new URL(requestUrl ?? '/', 'http://gateway.invalid').pathname;
  } catch {
    return false;
  }
  return LONG_RUNNING_MEDIA_PATHS.some((pattern) => pattern.test(pathname));
}

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
  if (!header?.trim()) {
    return { encoding: null, acceptable: true, identityAcceptable: true };
  }

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
    return { encoding: null, acceptable: identity > 0, identityAcceptable: identity > 0 };
  }
  if (bestCompressed > 0) {
    return {
      encoding: br === bestCompressed ? 'br' : 'gzip',
      acceptable: true,
      identityAcceptable: identity > 0,
    };
  }
  return { encoding: null, acceptable: identity > 0, identityAcceptable: identity > 0 };
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

function normalizeIpAddress(address) {
  const withoutZone = String(address ?? '').split('%', 1)[0];
  if (withoutZone.toLowerCase().startsWith('::ffff:')) {
    const ipv4 = withoutZone.slice(7);
    if (isIP(ipv4) === 4) return ipv4;
  }
  return withoutZone;
}

/**
 * Match the socket peer against an explicit proxy policy. The policy accepts
 * Express-compatible "loopback", exact IPs, and IP CIDRs. It is default-deny.
 */
export function isTrustedImmediatePeer(address, policy) {
  const normalizedAddress = normalizeIpAddress(address);
  const addressFamily = isIP(normalizedAddress);
  const rawPolicy = String(policy ?? '').trim().toLowerCase();
  if (!addressFamily || !rawPolicy || rawPolicy === 'false' || rawPolicy === '0') return false;
  if (rawPolicy === 'true' || rawPolicy === '1' || rawPolicy === '*') return true;

  const trusted = new BlockList();
  for (const rawEntry of rawPolicy.split(',')) {
    const entry = rawEntry.trim();
    if (!entry) continue;
    if (entry === 'loopback') {
      trusted.addSubnet('127.0.0.0', 8, 'ipv4');
      trusted.addAddress('::1', 'ipv6');
      continue;
    }

    const separator = entry.lastIndexOf('/');
    const network = separator === -1 ? entry : entry.slice(0, separator);
    const family = isIP(network);
    if (!family) continue;
    const type = family === 4 ? 'ipv4' : 'ipv6';
    if (separator === -1) {
      trusted.addAddress(network, type);
      continue;
    }
    const prefix = Number(entry.slice(separator + 1));
    const maximum = family === 4 ? 32 : 128;
    if (Number.isInteger(prefix) && prefix >= 0 && prefix <= maximum) {
      trusted.addSubnet(network, prefix, type);
    }
  }
  return trusted.check(normalizedAddress, addressFamily === 4 ? 'ipv4' : 'ipv6');
}

export function createUpstreamHeaders(req, target, trustedProxyPolicy) {
  const headers = stripHopByHopHeaders(req.headers);
  const trustedPeer = isTrustedImmediatePeer(req.socket.remoteAddress, trustedProxyPolicy);
  const forwardedFor = trustedPeer ? headers['x-forwarded-for'] : undefined;
  const forwardedProto = trustedPeer ? headers['x-forwarded-proto'] : undefined;
  const forwardedHost = trustedPeer ? headers['x-forwarded-host'] : undefined;
  for (const name of Object.keys(headers)) {
    if (name.startsWith('x-forwarded-')) delete headers[name];
  }

  const remoteAddress = req.socket.remoteAddress;
  if (remoteAddress) {
    headers['x-forwarded-for'] = appendForwardedValue(forwardedFor, remoteAddress);
  }
  headers['x-forwarded-proto'] = appendForwardedValue(
    forwardedProto,
    req.socket.encrypted ? 'https' : 'http',
  );
  if (req.headers.host) {
    headers['x-forwarded-host'] = appendForwardedValue(forwardedHost, req.headers.host);
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
