// SenseCheck Worker. It runs in front of every request (run_worker_first), so nothing is reachable without signing in.
// Two ways in, chosen by which settings exist:
//   1. Cloudflare Access (personal logins). Set vars ACCESS_TEAM and ACCESS_AUD. Each person signs in with their own
//      email, and their scans are saved under it in the D1 database bound as DB. ADMIN_EMAILS (comma-separated) see all.
//   2. Shared passcode (fallback when the Access vars are absent). Secret PASSCODE; history stays in each browser.
//   secret PSI_KEY    Google PageSpeed Insights API key.
// Once signed in:
//   /api/me                   who is signed in, and whether scans are saved on the server
//   /api/scans                GET my scans (?all=1 for admins), POST a new one
//   /api/scans/<id>           GET one scan, DELETE it (owner or admin only)
//   Saved scans are removed automatically after 24 hours (var HISTORY_HOURS changes that).
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
  'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'cf-mitigated', 'x-sucuri-id',
  'x-sucuri-block', 'x-iinfo', 'x-cdn', 'x-amz-cf-id', 'x-amzn-waf-action', 'www-authenticate', 'retry-after'];

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });

// ---------- Cloudflare Access login
// Access puts a signed token on every request it lets through. We check the signature, audience, issuer and expiry
// ourselves, so a forged "I am this user" header can never get in, even if Access is switched off by mistake.
let KEYS = null, KEYS_AT = 0;
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), c => c.charCodeAt(0));
const teamOf = env => String(env.ACCESS_TEAM).replace(/^https?:\/\//, '').replace(/\.cloudflareaccess\.com\/?$/, '');
const adminsOf = env => String(env.ADMIN_EMAILS || '').toLowerCase().split(/[\s,]+/).filter(Boolean);

async function accessKeys(team, fresh) {
  if (KEYS && !fresh && Date.now() - KEYS_AT < 3600000) return KEYS;
  const j = await (await fetch(`https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`)).json();
  const keys = {};
  for (const k of j.keys || []) keys[k.kid] = await crypto.subtle.importKey('jwk', k, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  KEYS = keys; KEYS_AT = Date.now();
  return keys;
}

// Returns the signed-in email, or null when the token is missing or fails any check.
async function accessUser(request, env) {
  const p = (request.headers.get('cf-access-jwt-assertion') || '').split('.');
  if (p.length !== 3) return null;
  let head, body;
  try { const dec = new TextDecoder(); head = JSON.parse(dec.decode(b64u(p[0]))); body = JSON.parse(dec.decode(b64u(p[1]))); } catch { return null; }
  if (head.alg !== 'RS256' || !head.kid) return null;
  const team = teamOf(env);
  let key = (await accessKeys(team))[head.kid];
  if (!key) key = (await accessKeys(team, true))[head.kid]; // keys rotate
  if (!key) return null;
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(p[2]), new TextEncoder().encode(p[0] + '.' + p[1]));
  if (!ok || ![].concat(body.aud || []).includes(env.ACCESS_AUD) || !(body.exp > Date.now() / 1000)) return null;
  if (body.iss !== `https://${team}.cloudflareaccess.com` || typeof body.email !== 'string' || !body.email) return null;
  return body.email.toLowerCase();
}

// ---------- saved scans (D1)
const summaryOf = r => ({ domain: r.domain, date: r.date, health: { score: r.health ? r.health.score : null },
  verdict: { tone: (r.verdict || {}).tone || 'info', label: String((r.verdict || {}).label || '') },
  fit: { tone: (r.fit || {}).tone || 'info', verdict: String((r.fit || {}).verdict || '') },
  stack: { platform: { name: String((((r.stack || {}).platform) || {}).name || 'Not detected') } } });

async function scans(request, env, url, me) {
  if (!env.DB || !me.email) return json({ error: 'no-store' }, 501);
  // Saved scans are kept for 24 hours (or HISTORY_HOURS), then removed for everyone.
  await env.DB.prepare('DELETE FROM scans WHERE created_at < ?').bind(new Date(Date.now() - (+env.HISTORY_HOURS || 24) * 3600000).toISOString()).run();
  const id = url.pathname.length > '/api/scans/'.length ? decodeURIComponent(url.pathname.slice('/api/scans/'.length)) : '', m = request.method;
  if (!id && m === 'GET') {
    const all = url.searchParams.has('all') && me.admin;
    const q = all ? env.DB.prepare('SELECT id, email, summary FROM scans ORDER BY created_at DESC LIMIT 300')
      : env.DB.prepare('SELECT id, email, summary FROM scans WHERE email = ? ORDER BY created_at DESC LIMIT 200').bind(me.email);
    const { results } = await q.all();
    return json({ scans: (results || []).map(x => ({ ...JSON.parse(x.summary), id: x.id, by: x.email })) });
  }
  if (!id && m === 'POST') {
    const text = await request.text();
    if (text.length > 600000) return json({ error: 'too large' }, 413);
    let r;
    try { r = JSON.parse(text); } catch { return json({ error: 'bad request' }, 400); }
    if (!r || typeof r.domain !== 'string' || !r.domain || !r.health || !r.verdict || !Array.isArray(r.issues)) return json({ error: 'bad request' }, 400);
    for (const k of ['mobile', 'desktop']) if (r.psi && r.psi[k] && r.psi[k].shot) r.psi[k].shot = '';
    delete r.id; delete r.by;
    const sid = crypto.randomUUID(), now = new Date().toISOString();
    await env.DB.prepare('INSERT INTO scans (id, email, domain, created_at, summary, result) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(sid, me.email, r.domain.slice(0, 200), now, JSON.stringify(summaryOf(r)), JSON.stringify(r)).run();
    return json({ id: sid });
  }
  if (id && (m === 'GET' || m === 'DELETE')) {
    const row = await env.DB.prepare('SELECT email, result FROM scans WHERE id = ?').bind(id).first();
    if (!row) return json({ error: 'not found' }, 404);
    if (row.email !== me.email && !me.admin) return json({ error: 'forbidden' }, 403);
    if (m === 'GET') return json({ ...JSON.parse(row.result), id, by: row.email });
    await env.DB.prepare('DELETE FROM scans WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }
  return json({ error: 'not allowed' }, 405);
}

// ---------- passcode gate (fallback)
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

// The screen people see before they are let in. The left side tells a colleague what the tool is for.
function lockPage(status, message, form) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>SenseCheck</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;background:#E8EFF7;color:#17181C;font:400 15.5px/1.5 Outfit,system-ui,sans-serif}
.wrap{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);width:100%;max-width:880px;background:#fff;border-radius:28px;overflow:hidden;box-shadow:0 30px 80px -40px rgba(40,60,110,.35)}
.intro{background:#141838;color:#fff;padding:44px 40px}
.by{display:block;width:112px;height:112px;margin-top:30px;border-radius:16px}
.brand{display:flex;align-items:center;gap:10px;font-weight:600;font-size:19px}
h1{margin:30px 0 12px;font-size:28px;line-height:1.2;font-weight:600;letter-spacing:-.02em;text-wrap:balance}
.intro p{margin:0;color:#B9BBC4}
ul{list-style:none;margin:26px 0 0;padding:0;display:grid;gap:14px}
li{display:flex;gap:12px;color:#E6E7EC;text-wrap:balance}
li::before{content:"";flex:none;width:20px;height:20px;margin-top:2px;border-radius:50%;background:#812FDF url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M5.5 10.3l3 3 6-6.3' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/20px no-repeat}
.gate{padding:44px 40px;display:flex;flex-direction:column;justify-content:center}
h2{margin:0 0 6px;font-size:22px;font-weight:600;letter-spacing:-.01em}.gate p{margin:0;color:#5F616A}
form{margin-top:22px;display:grid;gap:12px}label{font-size:13.5px;font-weight:500;color:#5F616A}
input{width:100%;height:50px;border:0;border-radius:14px;background:#F4F4FA;padding:0 16px;font:inherit;outline:0}input:focus{box-shadow:0 0 0 2px #812FDF}
button{height:48px;border:0;border-radius:14px;background:#812FDF;color:#fff;font:500 15px Outfit,system-ui,sans-serif;cursor:pointer}button:hover{filter:brightness(1.08)}
.err{color:#C7321F!important;font-weight:500;margin-top:14px!important}
@media (max-width:720px){.wrap{grid-template-columns:minmax(0,1fr)}.intro,.gate{padding:28px 24px}h1{font-size:24px;margin-top:22px}}</style></head><body><main class="wrap">
<section class="intro">
<div class="brand"><svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><rect width="32" height="32" rx="10" fill="#812FDF"/><path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>SenseCheck</div>
<h1>Pitching a client but not sure what their website needs?</h1>
<p>Paste their link. We go through the whole website and tell you, in plain words, what\u2019s wrong and what to propose.</p>
<ul><li>Site health: speed, SEO, design and security</li><li>What it is built on, and if we can take it on</li><li>What to recommend, in a PDF for the client</li></ul>
<img class="by" src="/img/mysense-dark.png" alt="MYSense. With us, everything makes sense" width="112" height="112">
</section>
<section class="gate">
${form ? `<h2>Enter the team passcode</h2><p>This tool is for the MYSense team.</p>${message ? `<p class="err" role="alert">${message}</p>` : ''}
<form method="post" action="/login"><label for="p">Passcode</label><input id="p" name="passcode" type="password" autocomplete="current-password" required autofocus><button type="submit">Unlock</button></form>`
    : `<h2>SenseCheck is locked</h2><p>${message}</p>`}
</section></main></body></html>`;
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
  } catch (e) { return json({ error: 'unreachable', detail: `${(e && e.name) || ''} ${(e && e.message) || e}`.trim() }, 502); }
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
    // The MYSense logo files are the only thing served without signing in (the login screen shows one).
    if (/^\/img\/mysense-(light|dark)\.png$/.test(url.pathname)) return env.ASSETS.fetch(request);
    const api = url.pathname.startsWith('/api/');
    let me = { email: null, admin: false };
    if (env.ACCESS_TEAM && env.ACCESS_AUD) {
      const email = await accessUser(request, env).catch(() => null);
      if (!email) return api ? json({ error: 'sign-in required' }, 401, { 'x-sc-locked': '1' })
        : lockPage(401, 'Sign in with your work email through Cloudflare Access to use this tool.', false);
      me = { email, admin: adminsOf(env).includes(email) };
    } else {
      const stop = await gate(request, env, url);
      if (stop) return stop;
    }
    if (!api) return env.ASSETS.fetch(request);
    // Only the app itself may call the API (browsers always send this header on https).
    if (request.headers.get('sec-fetch-site') !== 'same-origin') return json({ error: 'forbidden' }, 403);
    if (url.pathname === '/api/me') return json({ email: me.email, admin: me.admin, store: !!(env.DB && me.email) });
    if (url.pathname === '/api/scans' || url.pathname.startsWith('/api/scans/')) return scans(request, env, url, me);
    if (request.method !== 'GET') return json({ error: 'GET only' }, 405);
    const u = target(url.searchParams.get('url') || '');
    if (!u) return json({ error: 'Enter a public website address' }, 400);
    if (url.pathname === '/api/fetch') return proxy(u, url.searchParams.has('head'));
    if (url.pathname === '/api/psi') return psi(u, url.searchParams.get('strategy'), env);
    return json({ error: 'not found' }, 404);
  },
};
