// SenseCheck Worker. Serves the app in /public and two small API routes:
//   /api/fetch?url=           streams a public page back as plain text, with metadata in a header
//   /api/fetch?url=&head=1    returns only the metadata (used to read image file sizes)
//   /api/psi?url=&strategy=   proxies Google PageSpeed Insights and adds the API key (secret PSI_KEY)
// All analysis happens in the browser (public/analyze.js), so this stays tiny and cheap on CPU.

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 SenseCheck/1.0';
const MAX_BYTES = 3000000;
const KEEP = ['server', 'x-powered-by', 'x-generator', 'via', 'cf-ray', 'cf-cache-status', 'x-cache', 'content-encoding',
  'content-type', 'cache-control', 'strict-transport-security', 'last-modified', 'link', 'x-wix-request-id', 'x-shopid',
  'x-shopify-stage', 'x-litespeed-cache', 'x-varnish', 'x-pingback', 'x-redirect-by', 'x-drupal-cache',
  'x-drupal-dynamic-cache', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-vercel-id', 'x-nf-request-id',
  'x-github-request-id', 'x-served-by', 'x-turbo-charged-by', 'content-length', 'content-security-policy',
  'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy'];

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

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
