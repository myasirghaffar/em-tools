import type { Env } from '../types';

const BOOT_KEY = '__emSolarApiBootMs';

/**
 * First request in this isolate sets boot time (avoids bogus multi-year "uptime" when
 * bundlers freeze top-level `Date.now()` at build time on Workers).
 */
export function getApiBootMs(): number {
  const g = globalThis as typeof globalThis & { [BOOT_KEY]?: number };
  const existing = g[BOOT_KEY];
  if (typeof existing === 'number' && Number.isFinite(existing) && existing > 1_000_000_000_000) {
    return existing;
  }
  const t = Date.now();
  g[BOOT_KEY] = t;
  return t;
}

type RouteRow = { method: string; path: string };

/** Public + admin route manifest for the status page (keep in sync with `app.ts` mounts). */
export const STATUS_ROUTE_MANIFEST: RouteRow[] = [
  { method: 'GET', path: '/' },
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/status' },
  { method: 'POST', path: '/auth/register' },
  { method: 'POST', path: '/auth/register-admin' },
  { method: 'POST', path: '/auth/verify-email' },
  { method: 'POST', path: '/auth/resend-verification' },
  { method: 'POST', path: '/auth/login' },
  { method: 'POST', path: '/auth/logout' },
  { method: 'POST', path: '/auth/refresh' },
  { method: 'POST', path: '/auth/forgot-password' },
  { method: 'POST', path: '/auth/reset-password' },
  { method: 'GET', path: '/users/me' },
  { method: 'GET', path: '/users/me/orders' },
  { method: 'GET', path: '/users/me/customer' },
  { method: 'GET', path: '/users/:id' },
  { method: 'PATCH', path: '/users/:id' },
  { method: 'GET', path: '/store/products' },
  { method: 'GET', path: '/store/products/:id' },
  { method: 'POST', path: '/store/orders' },
  { method: 'POST', path: '/store/consultations' },
  { method: 'POST', path: '/store/contact-messages' },
  { method: 'GET', path: '/admin/products' },
  { method: 'POST', path: '/admin/products' },
  { method: 'PATCH', path: '/admin/products/:id' },
  { method: 'PUT', path: '/admin/products/:id' },
  { method: 'DELETE', path: '/admin/products/:id' },
  { method: 'GET', path: '/admin/orders' },
  { method: 'PATCH', path: '/admin/orders/:id' },
  { method: 'GET', path: '/admin/customers' },
  { method: 'GET', path: '/admin/consultations' },
  { method: 'PATCH', path: '/admin/consultations/:id' },
  { method: 'GET', path: '/admin/contact-messages' },
  { method: 'PATCH', path: '/admin/contact-messages/:id' },
  { method: 'GET', path: '/admin/analytics' },
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatUptime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}

function runtimeVersionLine(env: Env): { label: string; value: string } {
  try {
    const v = typeof process !== 'undefined' ? process.versions?.node : undefined;
    if (v) {
      return { label: 'Node.js', value: `v${v}` };
    }
  } catch {
    /* ignore */
  }
  const compat = env.WORKER_COMPAT_DATE?.trim() || '2025-04-01';
  return { label: 'Cloudflare Workers', value: `compat ${compat}` };
}

function methodClass(method: string): string {
  const m = method.toUpperCase();
  if (m === 'GET') return 'm-get';
  if (m === 'POST') return 'm-post';
  if (m === 'PATCH') return 'm-patch';
  if (m === 'PUT') return 'm-put';
  if (m === 'DELETE') return 'm-del';
  return 'm-def';
}

function deployFooterHtml(env: Env): string {
  const commitFull = env.GIT_COMMIT?.trim() || '';
  const commitShort =
    env.GIT_COMMIT_SHORT?.trim() || (commitFull ? commitFull.slice(0, 7) : '');
  const deployed = env.DEPLOYED_AT?.trim() || env.BUILD_TIME?.trim() || '';
  if (!deployed && !commitShort) {
    return `<p>Last merge / deploy: <em>not configured</em></p>
    <p class="deploy-hint">Set <span class="mono">DEPLOYED_AT</span> (ISO time) and <span class="mono">GIT_COMMIT</span> or <span class="mono">GIT_COMMIT_SHORT</span> in Worker vars or <span class="mono">.env</span> for Node — see <span class="mono">.env.example</span>.</p>`;
  }
  const parts: string[] = [];
  if (deployed) {
    parts.push(`<p>Last deploy: <span class="mono">${escapeHtml(deployed)}</span></p>`);
  }
  if (commitShort) {
    const title = commitFull && commitFull !== commitShort ? ` title="${escapeHtml(commitFull)}"` : '';
    parts.push(
      `<p>Git commit: <span class="mono"${title}>${escapeHtml(commitShort)}</span>${
        commitFull && commitFull.length > commitShort.length ? ' (hover for full)' : ''
      }</p>`,
    );
  }
  return parts.join('\n    ');
}

export function buildStatusDashboardHtml(env: Env): string {
  const now = new Date();
  const nowIso = now.toISOString();
  const boot = getApiBootMs();
  const uptimeMs = Math.max(0, Date.now() - boot);
  const envName =
    env.ENVIRONMENT?.trim() ||
    (typeof process !== 'undefined' ? process.env.NODE_ENV : undefined)?.trim() ||
    'production';
  const status = 'Operational';
  const deployHtml = deployFooterHtml(env);
  const rt = runtimeVersionLine(env);

  const routesHtml = STATUS_ROUTE_MANIFEST.map(
    (r) =>
      `<div class="route-row"><span class="method ${methodClass(r.method)}">${escapeHtml(r.method)}</span><span class="path">${escapeHtml(r.path)}</span></div>`,
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>em-solar-api — status</title>
  <style>
    :root {
      --bg0: #0a0e1a;
      --bg1: #12182a;
      --card: rgba(255,255,255,0.06);
      --border: rgba(255,255,255,0.08);
      --text: #e8ecf4;
      --muted: #8b95a8;
      --green: #34d399;
      --blue: #60a5fa;
      --amber: #fbbf24;
      --rose: #fb7185;
      --violet: #a78bfa;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      background: radial-gradient(1200px 800px at 50% -10%, #1a2444 0%, var(--bg0) 45%, #05070d 100%);
      color: var(--text);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2.5rem 1.25rem 2rem;
    }
    .pulse {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #6ee7b7, #059669 55%, #047857);
      box-shadow: 0 0 0 8px rgba(52, 211, 153, 0.15), 0 0 48px rgba(52, 211, 153, 0.35);
      margin-bottom: 1.25rem;
    }
    h1 {
      margin: 0;
      font-size: clamp(1.75rem, 4vw, 2.25rem);
      font-weight: 800;
      letter-spacing: -0.03em;
      background: linear-gradient(120deg, #93c5fd 0%, #c4b5fd 45%, #f9a8d4 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .subtitle {
      margin: 0.5rem 0 0;
      font-size: 0.95rem;
      color: var(--muted);
      font-weight: 500;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(140px, 1fr));
      gap: 1rem;
      width: 100%;
      max-width: 520px;
      margin-top: 2rem;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1rem 1.15rem;
      backdrop-filter: blur(8px);
    }
    .card label {
      display: block;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: var(--muted);
      text-transform: uppercase;
      margin-bottom: 0.45rem;
    }
    .card .val {
      font-size: 1.15rem;
      font-weight: 700;
    }
    .val.ok { color: var(--green); }
    .routes-wrap {
      width: 100%;
      max-width: 560px;
      margin-top: 1.5rem;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 1.1rem 1.25rem 1.25rem;
      backdrop-filter: blur(8px);
    }
    .routes-wrap > label {
      display: block;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: var(--muted);
      text-transform: uppercase;
      margin-bottom: 0.75rem;
    }
    .route-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.35rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      font-size: 0.88rem;
    }
    .route-row:last-child { border-bottom: none; }
    .method {
      min-width: 4.5rem;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.04em;
    }
    .m-get { color: var(--green); }
    .m-post { color: var(--blue); }
    .m-patch { color: var(--amber); }
    .m-put { color: var(--violet); }
    .m-del { color: var(--rose); }
    .m-def { color: var(--muted); }
    .path { color: #cbd5e1; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    footer {
      margin-top: 2rem;
      text-align: center;
      font-size: 0.75rem;
      color: var(--muted);
      max-width: 520px;
      line-height: 1.5;
    }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .deploy-sub { margin: 0.35rem 0 0; font-size: 0.72rem; color: #94a3b8; }
    .deploy-hint { margin: 0.5rem 0 0; font-size: 0.7rem; color: #64748b; line-height: 1.45; }
    .json-hint { margin-top: 1.25rem; font-size: 0.7rem; color: #64748b; }
    .json-hint a { color: #93c5fd; }
  </style>
</head>
<body>
  <div class="pulse" aria-hidden="true"></div>
  <h1>em-solar-api</h1>
  <p class="subtitle">Backend service is up and running</p>

  <div class="grid">
    <div class="card">
      <label>Status</label>
      <div class="val ok">${escapeHtml(status)}</div>
    </div>
    <div class="card">
      <label>Uptime (this process)</label>
      <div class="val mono">${escapeHtml(formatUptime(uptimeMs))}</div>
    </div>
    <div class="card">
      <label>Environment</label>
      <div class="val">${escapeHtml(envName)}</div>
    </div>
    <div class="card">
      <label>${escapeHtml(rt.label)}</label>
      <div class="val mono">${escapeHtml(rt.value)}</div>
    </div>
  </div>

  <div class="routes-wrap">
    <label>Available routes</label>
    ${routesHtml}
  </div>

  <footer>
    <p class="mono">Server time: ${escapeHtml(nowIso)}</p>
    <div style="margin-top:0.75rem">${deployHtml}</div>
    <p class="json-hint">JSON: <a href="/health">/health</a> · <a href="/?format=json">/?format=json</a></p>
  </footer>
</body>
</html>`;
}
