/** Inlined in root layout so error fallback stays styled even when globals.css 404s. */
export const CHUNK_ERROR_INLINE_CSS = `
html.chunk-load-failed #__app { display: none !important; }
html.chunk-load-failed #__chunk_error { display: block !important; }
html.server-error-failed #__app { display: none !important; }
html.server-error-failed #__server_error { display: block !important; }

#__chunk_error, #__server_error { min-height: 100vh; min-height: 100dvh; }

.sfcc-error-page {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  background-color: #0a1628;
  color: #fff;
  font-family: system-ui, -apple-system, sans-serif;
}
.sfcc-error-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background-color: #0a1628;
}
.sfcc-error-bg-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
}
@media (min-width: 640px) {
  .sfcc-error-bg-img { object-position: center center; }
}
.sfcc-error-overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(to right, rgba(10, 22, 40, 0.5) 0%, transparent 55%),
    linear-gradient(to top, #0a1628 0%, rgba(10, 22, 40, 0.75) 40%, transparent 100%);
}
@media (min-width: 640px) {
  .sfcc-error-overlay {
    background:
      linear-gradient(to right, rgba(10, 22, 40, 0.45) 0%, transparent 50%),
      linear-gradient(to top, #0a1628 0%, rgba(10, 22, 40, 0.55) 45%, transparent 100%);
  }
}
.sfcc-error-shell {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 1.5rem 1.25rem 2rem;
}
@media (min-width: 640px) { .sfcc-error-shell { padding: 1.5rem 2.5rem 3rem; } }
@media (min-width: 1024px) { .sfcc-error-shell { padding: 1.5rem 3.5rem 3rem; } }
.sfcc-error-brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}
.sfcc-error-logo { border-radius: 0.375rem; display: block; }
.sfcc-error-content {
  margin-top: auto;
  width: 100%;
  max-width: 36rem;
  padding-top: 4rem;
}
@media (min-width: 640px) { .sfcc-error-content { max-width: 40rem; padding-top: 6rem; } }
@media (min-width: 1024px) { .sfcc-error-content { max-width: 42rem; } }
.sfcc-error-code {
  margin: 0;
  font-size: clamp(3.75rem, 14vw, 6rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.04em;
  color: rgba(255, 255, 255, 0.95);
}
.sfcc-error-title {
  margin: 0.75rem 0 0;
  font-size: clamp(1.5rem, 4vw, 2.25rem);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;
}
.sfcc-error-desc {
  margin: 0.75rem 0 0;
  max-width: 32rem;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.75);
}
@media (min-width: 640px) { .sfcc-error-desc { font-size: 1rem; } }
.sfcc-error-hint {
  margin: 0.5rem 0 0;
  max-width: 32rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.55);
}
@media (min-width: 640px) { .sfcc-error-hint { font-size: 0.9375rem; } }
.sfcc-error-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 2rem;
}
@media (min-width: 640px) {
  .sfcc-error-actions { flex-direction: row; flex-wrap: wrap; }
}
.sfcc-error-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 8.75rem;
  padding: 0.75rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  border: none;
  font-family: inherit;
  transition: opacity 0.15s, background 0.15s;
}
.sfcc-error-btn:hover { opacity: 0.92; }
.sfcc-error-btn-primary {
  background: hsl(199 89% 48%);
  color: hsl(222 47% 6%);
  box-shadow: 0 10px 25px rgba(14, 165, 233, 0.2);
}
.sfcc-error-btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.sfcc-error-btn-secondary:hover { background: rgba(255, 255, 255, 0.15); }
.sfcc-error-btn-ghost {
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.15);
}
.sfcc-error-btn-ghost:hover { background: rgba(255, 255, 255, 0.1); }
.sfcc-error-quicknav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
  margin-top: 2rem;
  padding-top: 1.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.5);
}
.sfcc-error-quicknav a {
  padding: 0.125rem 0.25rem;
  color: inherit;
  text-decoration: none;
  transition: color 0.15s;
}
.sfcc-error-quicknav a:hover { color: hsl(199 89% 48%); }
.sfcc-error-quicknav span { user-select: none; }
`;

/** Shared background picture markup for static error fallbacks. */
export const STATIC_ERROR_BG_HTML = `
  <div class="sfcc-error-bg" aria-hidden="true">
    <picture>
      <source media="(max-width: 639px)" srcset="/images/deployment-not-found-mobile.png" />
      <img src="/images/deployment-not-found-desktop.png" alt="" class="sfcc-error-bg-img" />
    </picture>
  </div>`;
