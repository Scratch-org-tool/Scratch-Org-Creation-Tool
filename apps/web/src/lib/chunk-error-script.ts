import { STATIC_CHUNK_ERROR_HTML, STATIC_SERVER_ERROR_HTML } from '@/lib/error-page-content';

/** Inline bootstrap — runs before React when chunks fail or the page is a plain 500. */
export const CHUNK_ERROR_BOOTSTRAP = `(function () {
  var CHUNK_HTML = ${JSON.stringify(STATIC_CHUNK_ERROR_HTML)};
  var SERVER_HTML = ${JSON.stringify(STATIC_SERVER_ERROR_HTML)};

  function ensureFallbacks() {
    if (!document.body) return;
    if (!document.getElementById('__chunk_error')) {
      var chunk = document.createElement('div');
      chunk.id = '__chunk_error';
      chunk.hidden = true;
      chunk.innerHTML = CHUNK_HTML;
      document.body.appendChild(chunk);
    }
    if (!document.getElementById('__server_error')) {
      var server = document.createElement('div');
      server.id = '__server_error';
      server.hidden = true;
      server.innerHTML = SERVER_HTML;
      document.body.appendChild(server);
    }
  }

  function showFallback(kind) {
    ensureFallbacks();
    var root = document.documentElement;
    if (root.classList.contains('chunk-load-failed') || root.classList.contains('server-error-failed')) return;
    root.classList.add(kind === 'server' ? 'server-error-failed' : 'chunk-load-failed');
    var app = document.getElementById('__app');
    var fallback = document.getElementById(kind === 'server' ? '__server_error' : '__chunk_error');
    if (app) app.setAttribute('hidden', '');
    if (fallback) fallback.removeAttribute('hidden');
  }

  function showChunkError() { showFallback('chunk'); }
  function showServerError() { showFallback('server'); }

  function isPlainServerErrorPage() {
    var body = document.body;
    if (!body) return false;
    var text = (body.innerText || body.textContent || '').trim();
    if (!text || text.length > 200) return false;
    var lower = text.toLowerCase();
    return lower === 'internal server error' || lower.indexOf('internal server error') !== -1;
  }

  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'SCRIPT' && t.src && t.src.indexOf('_next/static') !== -1) {
      showChunkError();
    }
  }, true);

  function onReady() {
    ensureFallbacks();
    if (isPlainServerErrorPage()) showServerError();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();`;
