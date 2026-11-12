// SenseCheck Worker. It runs in front of every request (run_worker_first), so the whole tool sits behind a team passcode.
//   secret PASSCODE   the shared team passcode. Until it is set, the site stays locked for everyone.
//   secret PSI_KEY    Google PageSpeed Insights API key.
// Once unlocked:
//   /api/fetch?url=           streams a public page back as plain text, with metadata in a header
//   /api/fetch?url=&head=1    returns only the metadata (used to read image file sizes)
//   /api/psi?url=&strategy=   proxies Google PageSpeed Insights and adds the API key
//   /logout                   locks this browser again
//   everything else           the app in /public
// All analysis happens in the browser (public/analyze.js, public/audit.js), so this stays tiny and cheap on CPU.

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 SenseCheck/1.0';
const MAX_BYTES = 3000000;
const COOKIE = 'sc_auth';
const KEEP = ['server', 'x-powered-by', 'x-generator', 'via', 'cf-ray', 'cf-cache-status', 'x-cache', 'content-encoding',
  'content-type', 'cache-control', 'strict-transport-security', 'last-modified', 'link', 'x-wix-request-id', 'x-shopid',
  'x-shopify-stage', 'x-litespeed-cache', 'x-varnish', 'x-pingback', 'x-redirect-by', 'x-drupal-cache',
  'x-drupal-dynamic-cache', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-vercel-id', 'x-nf-request-id',
  'x-github-request-id', 'x-served-by', 'x-turbo-charged-by', 'content-length', 'content-security-policy',
  'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy'];

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });

// ---------- passcode gate
// The cookie holds an HMAC of the passcode, never the passcode itself. Changing the passcode signs everyone out.
async function tokenFor(pass) {
  if (!pass) return ''; // an empty passcode never matches
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pass), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('sensecheck-session-v1'));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function same(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const cookieOf = request => ((request.headers.get('cookie') || '').match(/(?:^|;\s*)sc_auth=([a-f0-9]{64})/) || [])[1] || '';

function lockPage(status, message, form) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>SenseCheck</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;background:#E8EFF7;color:#17181C;font:400 15px/1.5 Outfit,system-ui,sans-serif}
.card{width:100%;max-width:400px;background:#fff;border-radius:24px;padding:36px 32px;box-shadow:0 30px 80px -40px rgba(40,60,110,.35)}
.brand{display:flex;align-items:center;gap:10px;font-weight:600;font-size:19px;margin-bottom:26px}
h1{margin:0 0 6px;font-size:24px;font-weight:600;letter-spacing:-.02em}p{margin:0;color:#5F616A}
form{margin-top:22px;display:grid;gap:12px}label{font-size:13.5px;font-weight:500;color:#5F616A}
input{width:100%;height:50px;border:0;border-radius:14px;background:#F4F4FA;padding:0 16px;font:inherit;outline:0}input:focus{box-shadow:0 0 0 2px #5B4FE9}
button{height:48px;border:0;border-radius:14px;background:#5B4FE9;color:#fff;font:500 15px Outfit,system-ui,sans-serif;cursor:pointer}button:hover{filter:brightness(1.08)}
.err{color:#C7321F;font-weight:500;margin-top:14px}</style></head><body><main class="card">
<div class="brand"><svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><rect width="32" height="32" rx="10" fill="#5B4FE9"/><path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>SenseCheck</div>
${form ? `<h1>Enter the team passcode</h1><p>This tool is for the MYSense team.</p>${message ? `<p class="err" role="alert">${message}</p>` : ''}
<form method="post" action="/login"><label for="p">Passcode</label><input id="p" name="passcode" type="password" autocomplete="current-password" required autofocus><button type="submit">Unlock</button></form>`
    : `<h1>SenseCheck is locked</h1><p>${message}</p>`}
</main></body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer' } });
}

// Returns a Response when the request must stop at the gate, or null when it may pass.
async function gate(request, env, url) {
  if (!env.PASSCODE) return url.pathname.startsWith('/api/') ? json({ error: 'locked' }, 503, { 'x-sc-locked': '1' })
    : lockPage(503, 'No passcode has been set yet. An admin needs to add the PASSCODE secret to this Worker in Cloudflare.', false);
  const want = await tokenFor(env.PASSCODE);
  if (url.pathname === '/login' && request.method === 'POST') {
    const form = await request.formData().catch(() => null);
    const got = await tokenFor(String((form && form.get('passcode')) || ''));
    if (same(got, want)) return new Response(null, { status: 303, headers: { location: '/', 'cache-control': 'no-store', 'set-cookie': `${COOKIE}=${want}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax` } });
    await new Promise(r => setTimeout(r, 800)); // slows down guessing
    return lockPage(401, 'That passcode is not right. Try again.', true);
  }
  if (url.pathname === '/logout') return new Response(null, { status: 303, headers: { location: '/', 'cache-control': 'no-store', 'set-cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
  if (same(cookieOf(request), want)) return url.pathname === '/login' ? new Response(null, { status: 303, headers: { location: '/' } }) : null;
  return url.pathname.startsWith('/api/') ? json({ error: 'locked' }, 401, { 'x-sc-locked': '1' }) : lockPage(401, '', true);
}

// ---------- API
// Only public http(s) hostnames. No IP literals, no local names.
function target(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  const h = u.hostname;
  if (!/^https?:$/.test(u.protocol) || !h.includes('.') || h.includes(':') || /^[\d.]+$/.test(h) || /\.(local|internal|lan)$/.test(h)) return null;
  return u;
}

function limit(body) {
  if (!body) return null;
  let n = 0;
  return body.pipeThrough(new TransformStream({
    transform(chunk, c) { n += chunk.byteLength; if (n > MAX_BYTES) c.terminate(); else c.enqueue(chunk); },
  }));
}

async function proxy(u, headOnly) {
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(u.href, {
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'accept-language': 'en-GB,en;q=0.9' },
      redirect: 'follow', signal: AbortSignal.timeout(20000),
    });
  } catch (e) { return json({ error: 'unreachable', detail: String(e && e.message || e) }, 502); }
  const headers = {};
  for (const k of KEEP) { const v = res.headers.get(k); if (v) headers[k] = v.slice(0, 300); }
  const cookies = (res.headers.getSetCookie ? res.headers.getSetCookie() : []).map(c => c.split('=')[0]).slice(0, 20);
  const meta = { finalUrl: res.url, status: res.status, ttfb: Date.now() - t0, headers, cookies };
  if (headOnly) { if (res.body) await res.body.cancel(); return json(meta); }
  return new Response(limit(res.body), { headers: {
    'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff',
    'x-sc-meta': encodeURIComponent(JSON.stringify(meta)), 'cache-control': 'no-store',
  } });
}

async function psi(u, strategy, env) {
  const q = new URLSearchParams({ url: u.href, strategy: strategy === 'desktop' ? 'desktop' : 'mobile' });
  for (const c of ['performance', 'accessibility', 'best-practices', 'seo']) q.append('category', c);
  if (env.PSI_KEY) q.set('key', env.PSI_KEY);
  const res = await fetch('https://www.googleapis.com/pagespeedonline/v5/runPagespeed?' + q);
  return new Response(res.body, { status: res.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const stop = await gate(request, env, url);
    if (stop) return stop;
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (request.method !== 'GET') return json({ error: 'GET only' }, 405);
    // Only the app itself may call the API (browsers always send this header on https).
    if (request.headers.get('sec-fetch-site') !== 'same-origin') return json({ error: 'forbidden' }, 403);
    const u = target(url.searchParams.get('url') || '');
    if (!u) return json({ error: 'Enter a public website address' }, 400);
    if (url.pathname === '/api/fetch') return proxy(u, url.searchParams.has('head'));
    if (url.pathname === '/api/psi') return psi(u, url.searchParams.get('strategy'), env);
    return json({ error: 'not found' }, 404);
  },
};
