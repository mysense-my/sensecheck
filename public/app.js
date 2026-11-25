import { tr } from './bm.js';
import { detectStack, summarisePsi, diagnose, dnsClues, vulnsFor } from './analyze.js';
import { techIcon } from './techicons.js';
import { movePill, moveThumbs, sheetIn, sheetOut, sheetDrag, fly, resize, countUp, watchScroll, crossFade } from './motion.js';
import { readActivity, activityOf, cwvOf, cruxFrom, trendSvg, readStability, stabilityOf, seoFacts, seoOf, postFacts, postChecks, postScore, pickPosts, suggestFor } from './extra.js';
import { readPage, buildIssues, healthOf, strengthsOf, skillsFit, nextSteps, verdictOf, whyOf, ideasOf, speedPlan, designOf as designVerdict, norm, CATS, CAT_NAME } from './audit.js';

const CFG = await fetch('config.json').then(r => r.json());
// Who is signed in. The real Worker fills this from the Cloudflare Access login; the local stand-in pretends.
const ME = await fetch('/api/me').then(r => (r.ok ? r.json() : {})).catch(() => ({}));
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = $('#view'), nav = $('#nav');
const S = { route: 'new', sec: 'overview', result: null, strategy: 'mobile', q: '', cat: 'all', more: false, busy: false, max: +new URLSearchParams(location.search).get('pages') || CFG.crawl.maxPages, who: 'mine' };

const I = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  gauge: '<path d="M4.5 17a8.5 8.5 0 1 1 15 0"/><path d="M12 13l4-4.5"/>',
  layers: '<path d="M12 4l8 4.5-8 4.5-8-4.5z"/><path d="M4 13l8 4.5 8-4.5"/>',
  layout: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M4 9.5h16M9.5 9.5V20"/>',
  list: '<path d="M9 7h11M9 12h11M9 17h11"/><path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01"/>',
  flag: '<path d="M6 20V5M6 5h11l-2 4 2 4H6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  down: '<path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 19.5h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11.5" rx="2.5"/><path d="M5 15.5V6.5A2.5 2.5 0 0 1 7.5 4H15"/>',
  versus: '<path d="M6.5 20V10M12 20V4M17.5 20v-7"/>',
  spark: '<path d="M12 4l1.9 5.1L19 11l-5.1 1.9L12 18l-1.9-5.1L5 11l5.1-1.9z"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  pulse: '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
  seo: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M8 10.5l1.8 1.8L13 9"/>',
};
const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
// The SenseCheck mascot. Poses: wave, point, inspect, underline, thumbs, clipboard, run, shrug, coffee.
const mascot = (pose, size = 'md', extra = '') => `<span class="mascot ${size} ${extra}" aria-hidden="true"><img src="img/mascot/${pose}.webp" alt="" decoding="async"></span>`;
const hd = (ic, colour) => `<span class="ic ${colour}">${icon(ic)}</span>`; // coloured icon chip for a section title
const LOGO = '<img class="rp-mark" src="img/logo-64.png" alt="" width="22" height="22">';   // the small copy: it is packed into every exported report
const fmt = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const good = p => (p && !p.error ? p : null);
const tone = v => (v == null ? 'info' : v >= 90 ? 'good' : v >= 50 ? 'warn' : 'bad');
const htone = v => (v == null ? 'info' : v >= 80 ? 'good' : v >= 55 ? 'warn' : 'bad');
const word = v => (v == null ? 'No data' : v >= 90 ? 'Good' : v >= 50 ? 'Needs work' : 'Poor');
const SEV = { Critical: 'bad', High: 'warn', Medium: 'mid', Low: 'info' };
const LH = [['performance', 'Performance'], ['accessibility', 'Accessibility'], ['best-practices', 'Best practices'], ['seo', 'SEO']];
const GROUPS = [['quick', 'Quick fixes'], ['revamp', 'Revamp items'], ['maintenance', 'Ongoing maintenance']];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const weightText = k => (k ? (k < 103 ? `${Math.round(k)} KB` : `${(k / 1024).toFixed(1)} MB`) : '–'); // k is in KB
const dotted = (t, text) => `<span class="imp"><i class="dot ${t}"></i>${text}</span>`;

let toastT;
function toast(msg, pose) { const t = $('#toast'); t.innerHTML = (pose ? `<img src="img/mascot/${pose}.webp" alt="">` : '') + `<span>${esc(msg)}</span>`; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3800); }

// ---------- history
// With a personal login the scans are saved on the server under the signed-in email (H.server). Without one
// (shared passcode) they stay in this browser, as before. H.rows is the list currently shown.
const KEY = 'sensecheck.history.v2';
const sum = r => ({ id: r.id, by: r.by, domain: r.domain, date: r.date, health: { score: r.health ? r.health.score : null }, verdict: r.verdict, fit: r.fit, stack: { platform: r.stack && r.stack.platform } });
const strip = r => { const cut = p => (p && !p.error ? { ...p, shot: '', full: '' } : p); return { ...r, psi: { mobile: cut(r.psi.mobile), desktop: cut(r.psi.desktop) } }; };
// Scans are kept for a limited time (historyHours in config.json), then removed automatically.
const KEEP_HOURS = +CFG.historyHours || 24, KEEP_MS = KEEP_HOURS * 3600000;
const local = { all() { try { const all = JSON.parse(localStorage.getItem(KEY)) || [], fresh = all.filter(x => Date.now() - Date.parse(x.date) < KEEP_MS); if (fresh.length !== all.length) localStorage.setItem(KEY, JSON.stringify(fresh)); return fresh; } catch { return []; } }, save(l) { for (let n = Math.min(l.length, 30); n >= 0; n = n > 1 ? Math.floor(n / 2) : n - 1) { try { localStorage.setItem(KEY, JSON.stringify(l.slice(0, n))); return; } catch { /* storage is full or unavailable: try again with fewer scans */ } } } };
const call = (path, opt) => fetch(path, opt).then(locked).then(r => (r.ok ? r.json() : Promise.reject(new Error('Could not reach the saved scans.'))));
const H = {
  server: !!ME.store, rows: [],
  async load(all) { this.rows = this.server ? (await call('/api/scans' + (all ? '?all=1' : ''))).scans : local.all().map(sum); return this.rows; },
  async get(id) { return this.server ? call('/api/scans/' + encodeURIComponent(id)) : local.all().find(x => String(x.id) === String(id)); },
  async add(r) {
    const mine = this.server ? (await call('/api/scans')).scans : local.all().map(sum), old = mine.find(x => x.domain === r.domain);
    if (old && old.health && old.health.score != null) r.prev = { date: old.date, score: old.health.score };
    if (this.server) r.id = (await call('/api/scans', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(strip(r)) })).id;
    else local.save([strip(r), ...local.all().filter(x => x.domain !== r.domain)]);
  },
  async update(r) {
    if (!this.server) return local.save([strip(r), ...local.all().filter(x => x.domain !== r.domain)]);
    const old = r.id;
    r.id = (await call('/api/scans', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(strip(r)) })).id;
    await call('/api/scans/' + encodeURIComponent(old), { method: 'DELETE' }).catch(() => {});
  },
  async remove(id) { if (this.server) await call('/api/scans/' + encodeURIComponent(id), { method: 'DELETE' }); else local.save(local.all().filter(x => String(x.id) !== String(id))); },
};

// ---------- API
// A 'locked' reply means the passcode session ended, so reload to show the unlock screen.
const locked = r => { if (r.headers.get('x-sc-locked')) { location.reload(); throw new Error('SenseCheck is locked. Enter the passcode again.'); } return r; };
async function via(url) {
  const r = locked(await fetch('/api/fetch?url=' + encodeURIComponent(url)));
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw Object.assign(new Error(j.error === 'unreachable' ? 'Could not connect to the site' : j.error || 'Request failed'), { detail: j.detail || '' }); }
  const meta = JSON.parse(decodeURIComponent(r.headers.get('x-sc-meta') || '%7B%7D'));
  return { headers: {}, cookies: [], ...meta, html: await r.text() };
}
const soft = x => via(x).catch(() => null);
const peek = x => fetch('/api/fetch?head=1&url=' + encodeURIComponent(x)).then(r => (r.ok ? r.json() : null)).catch(() => null);
const body = (p, n = 1e7) => (p && p.status === 200 ? p.html.slice(0, n) : '');
async function pool(items, size, fn) { const out = []; for (let i = 0; i < items.length; i += size) out.push(...await Promise.all(items.slice(i, i + size).map(fn))); return out; }
async function psi(url, strategy) {
  const r = locked(await fetch(`/api/psi?url=${encodeURIComponent(url)}&strategy=${strategy}`));
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.error) {
    const m = (j && j.error && (j.error.message || j.error)) || 'Speed test failed';
    throw new Error(/quota|rate/i.test(m) ? 'Google speed test quota reached. An API key fixes this.' : /FAILED_DOCUMENT_REQUEST|ERR_|DNS|unable to (reliably )?load/i.test(m) ? 'Google could not load the page.' : String(m).slice(0, 140));
  }
  const s = summarisePsi(j);
  if (!s) throw new Error('Speed test returned no data');
  return s;
}

// One speed test for one device. If Google's test fails or only half-loads the page, it is tried once more and
// the better of the two is kept, so a single bad run does not decide a client's score. A result that is still
// half-loaded keeps its "partial" note and is flagged on screen and in the reports.
async function speedTest(url, st) {
  let a = null, err = null;
  try { a = await psi(url, st); } catch (e) { err = e; }
  if (a && !a.partial) return a;
  if (err && /quota/i.test(err.message)) throw err;
  step(st[0], 'run', 'Trying again');
  await sleep(2500);
  let b = null;
  try { b = await psi(url, st); } catch (e) { if (!a) throw err || e; }
  if (b && !b.partial) return b;
  const best = a && b ? (b.scores.performance > a.scores.performance ? b : a) : a || b;
  best.retried = true;
  return best;
}

// Registrar and expiry from public RDAP records. Many country domains do not publish these.
async function domainInfo(host) {
  if (/^[\d.]+$/.test(host)) return null;
  const p = host.replace(/^www\./, '').split('.');
  const name = p.slice(p.length > 2 && p[p.length - 1].length === 2 && /^(com|net|org|co|gov|edu|ac)$/.test(p[p.length - 2]) ? -3 : -2).join('.');
  const r = await soft('https://rdap.org/domain/' + name);
  try {
    const j = JSON.parse(body(r)), exp = (j.events || []).find(e => e.eventAction === 'expiration'), rg = (j.entities || []).find(e => (e.roles || []).includes('registrar'));
    const fn = rg && rg.vcardArray ? (rg.vcardArray[1].find(v => v[0] === 'fn') || [])[3] : '';
    if (!exp) return { name };
    return { name, registrar: String(fn || '').slice(0, 60), expires: exp.eventDate, expiresText: fmt(exp.eventDate), soon: (Date.parse(exp.eventDate) - Date.now()) / 864e5 < CFG.thresholds.domainExpiryDays };
  } catch { return { name }; }
}

function disallowed(txt) {
  const out = []; let on = false;
  for (const l of txt.split(/\r?\n/)) {
    const m = l.match(/^\s*(user-agent|disallow)\s*:\s*(\S*)/i);
    if (!m) continue;
    if (m[1].toLowerCase() === 'user-agent') on = m[2] === '*'; else if (on && m[2]) out.push(m[2].replace(/[*$].*$/, ''));
  }
  return out.filter(Boolean);
}

// Version probes for a WordPress site: feed, REST index, theme stylesheet and plugin readme files.
async function wpProbes(origin, s0, probes, latest) {
  const WPORG = 'https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&request[slug]=';
  const slugs = s0.pluginSlugs.slice(0, CFG.crawl.maxPluginChecks);
  const [lw, le] = await Promise.all([soft('https://api.wordpress.org/core/version-check/1.7/'), soft(WPORG + 'elementor')]);
  const [feed, wj, er, css, ...rd] = await pool([origin + '/feed/', origin + '/wp-json/', s0.elementor ? origin + '/wp-content/plugins/elementor/readme.txt' : '',
    s0.themeSlug ? `${origin}/wp-content/themes/${s0.themeSlug}/style.css` : '', ...slugs.map(sl => `${origin}/wp-content/plugins/${sl}/readme.txt`)], 3, x => (x ? soft(x) : null));
  probes.feedVersion = (body(feed).match(/<generator>[^<]*[?&]v=([\d.]+)/) || [])[1] || '';
  probes.namespaces = ((body(wj).match(/"namespaces":\s*\[([^\]]*)\]/) || [])[1] || '').replace(/\\\//g, '/').split(',').map(s => s.replace(/"/g, '').trim()).filter(Boolean);
  probes.elementorVersion = /elementor/i.test(body(er, 400)) ? (body(er).match(/Stable tag:\s*([\d.]+)/i) || [])[1] || '' : '';
  latest.wordpress = (body(lw).match(/"current":"([\d.]+)"/) || [])[1] || '';
  latest.elementor = (body(le).match(/"version":"([\d.]+)"/) || [])[1] || '';
  const head = body(css, 1500), f = k => ((head.match(new RegExp('^[ \\t/*#@]*' + k + ':\\s*(.+)$', 'mi')) || [])[1] || '').trim().slice(0, 60);
  if (/Theme Name:/i.test(head)) probes.theme = { name: f('Theme Name'), version: f('Version'), author: f('Author').replace(/<[^>]+>/g, ''), parent: f('Template') };
  probes.plugins = {};
  slugs.forEach((sl, i) => { const t = body(rd[i], 3000), v = /^===.+===/m.test(t) ? (t.match(/Stable tag:\s*(\d[\d.]*)/i) || [])[1] : ''; if (v) probes.plugins[sl] = { version: v }; });
  const found = Object.keys(probes.plugins);
  (await pool(found, 4, sl => soft(WPORG + sl))).forEach((p, i) => { const v = (body(p).match(/"version":"([\d.]+)"/) || [])[1]; if (v && !/^\s*\{"error"/.test(body(p, 40))) probes.plugins[found[i]].latest = v; });
}

// What a child sitemap holds, from its file name: blog posts, pages, listing pages to ignore, or a named type.
const smType = u => {
  const n = u.split(/[?#]/)[0].split('/').pop().toLowerCase();
  if (/categor|[-_]cat\b|tag|author|taxonom|users|archive|format|elementor|template|library|popup|landing/.test(n)) return 'skip';
  if (/^post-sitemap|posts-post|(^|[-_])(posts?|blogs?|news|articles?)[-_.\d]/.test(n)) return 'post';
  if (/^page-sitemap|posts-page|(^|[-_])pages?[-_.\d]/.test(n)) return 'page';
  const m = n.match(/^(?:wp-sitemap-posts-)?([a-z][a-z_-]*?)(?:-sitemap)?[-_]?\d*\.xml$/);
  return m && !/sitemap|index/.test(m[1]) ? m[1] : '';
};

// Read the sitemap so we know how big the site is before we start. For a sitemap index we read the page lists
// first and the blog post lists last (those are only needed to know which links to leave out).
async function readSitemap(origin, robotsText) {
  const listed = [...(robotsText || '').matchAll(/^\s*sitemap:\s*(\S+)/gim)].map(m => m[1]);
  const locs = t => [...t.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/gi)].map(m => m[1].replace(/&amp;/g, '&'));
  // each page in a sitemap, with the date it last changed when the sitemap gives one
  const entries = t => [...t.matchAll(/<url>([\s\S]*?)<\/url>/gi)].map(m => ({ href: (locs(m[1])[0] || ''), mod: (m[1].match(/<lastmod>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/i) || [])[1] || '' })).filter(e => e.href);
  let first = '';
  for (const u of [...listed, origin + '/sitemap.xml', origin + '/sitemap_index.xml', origin + '/wp-sitemap.xml'].slice(0, 5)) {
    first = body(await soft(u));
    if (/<(urlset|sitemapindex)/i.test(first.slice(0, 3000))) break;
    first = '';
  }
  if (!first) return { found: false, urls: [] };
  let list = [], more = false;
  if (/<sitemapindex/i.test(first.slice(0, 3000))) {
    const kids = locs(first).filter(u => !/image|video|attachment/i.test(u)).map(u => ({ u, type: smType(u) })).filter(k => k.type !== 'skip');
    const rank = t => (t === 'page' ? 0 : 1);
    const pick = [...kids.filter(k => k.type !== 'post').sort((a, b) => rank(a.type) - rank(b.type)).slice(0, 8), ...kids.filter(k => k.type === 'post').slice(0, 3)];
    more = pick.length < kids.length;
    (await pool(pick, 2, k => soft(k.u))).forEach((x, i) => { for (const e of entries(body(x))) list.push({ ...e, type: pick[i].type }); });
  } else list = entries(first).map(e => ({ ...e, type: '' }));
  const host = new URL(origin).hostname.replace(/^www\./, ''), seen = new Set();
  const urls = list.filter(x => { try { if (new URL(x.href).hostname.replace(/^www\./, '') !== host || seen.has(x.href)) return false; seen.add(x.href); return true; } catch { return false; } });
  urls.more = more; // some sitemap files were not read, so the blog post count is a minimum
  return { found: true, urls };
}

const mins = ms => { const sec = Math.max(5, Math.round(ms / 5000) * 5); return sec < 60 ? `about ${sec} seconds` : sec < 3600 ? `about ${Math.round(sec / 60)} ${Math.round(sec / 60) === 1 ? 'minute' : 'minutes'}` : `about ${(sec / 3600).toFixed(1)} hours`; };

// Which pages to check. Polite on purpose: same site only, two pages at a time with a pause, robots.txt respected.
// The homepage and the main pages around it are always checked. Blog posts are left out (they share one layout).
// A section with more than sectionLimit pages only gets a small sample. Everything left out is counted, and the
// notes at the end say what was skipped and why, in plain words.
const BLOG = /^\/(blogs?|news|berita|artikel|articles?|insights?|posts?|stories|updates|press|press-releases?|category|categories|kategori|topics?)\/[^/]/i;
const DATED = /\/(19|20)\d{2}\/\d{1,2}\//;
const LANGS = /^(en|ms|my|bm|zh|cn|tw|id|ta|ja|jp|ko|kr|th|vi|ar|fr|de|es|hi)(-[a-z]{2,4})?$/i;
async function crawl(home, cap, skip, sitemap, ui) {
  const C = CFG.crawl, LIMIT = C.sectionLimit || 20, SAMPLE = C.sectionSample || 3;
  const first = readPage(home.finalUrl, home.status, home.html, CFG), pages = [first], broken = [], seen = new Set([norm(home.finalUrl)]);
  const host = new URL(home.finalUrl).hostname.replace(/^www\./, ''), segs = p => p.toLowerCase().split('/').filter(Boolean);
  const homeLang = LANGS.test(segs(first.path)[0] || '') ? segs(first.path)[0] : '';
  const q = [[], [], []], secs = new Map(), posts = new Set();
  const allowed = href => !skip.some(d => new URL(href).pathname.startsWith(d));
  // Sort a link into: a blog post (left out), a page inside a section, or a main page.
  const sort = (path, type, fromBlog) => {
    let s = segs(path);
    if (s[0] && LANGS.test(s[0])) { if (s[0] === homeLang) s = s.slice(1); else return { sec: 'lang:' + s[0] }; }
    const p = '/' + s.join('/') + '/';
    if (type === 'post' || fromBlog || BLOG.test(p) || DATED.test(p)) return { post: true };
    if (s.length >= 2) return { sec: s[0] };              // pages in a folder, such as /services/...
    return type && type !== 'page' ? { sec: 'type:' + type } : {}; // top-level pages of a named type from the sitemap
  };
  // pri 0: main pages the homepage links to. 1: section pages the homepage links to. 2: everything found later.
  const add = (l, from, pri, type, fromBlog) => {
    if (seen.has(l.key) || !allowed(l.href)) return;
    seen.add(l.key);
    const k = sort(new URL(l.href).pathname, type, fromBlog);
    if (k.post) return void posts.add(l.key);
    const sec = k.sec || (pri ? 'other' : '');
    if (sec) { const s = secs.get(sec) || { found: 0, done: 0 }; s.found++; secs.set(sec, s); }
    q[sec && !pri ? 1 : pri].push({ ...l, from, sec });
  };
  const push = (p, pri, fromBlog) => { for (const l of p.links) add(l, p.path, pri, '', fromBlog); p.links = []; };
  push(first, 0, false);
  for (const s of sitemap) { let x; try { x = new URL(s.href); } catch { continue; } if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|xml)$/i.test(x.pathname)) continue; const href = x.origin + x.pathname; add({ key: norm(href), href }, 'sitemap', 2, s.type, false); }
  const big = s => s && s.found > LIMIT;
  const next = () => { for (const list of q) while (list.length) { const it = list.shift(), s = secs.get(it.sec); if (big(s) && s.done >= SAMPLE) continue; if (s) s.done++; return it; } return null; };
  const left = () => { const need = new Map(); let n = 0; for (const list of q) for (const it of list) { const s = secs.get(it.sec); if (!big(s)) { n++; continue; } const k = need.has(it.sec) ? need.get(it.sec) : Math.max(0, SAMPLE - s.done); if (k > 0) n++; need.set(it.sec, Math.max(0, k - 1)); } return n; };
  const t0 = performance.now();
  let tries = 0, limit = cap, stopped = 0;
  const report = () => { const done = pages.length, rest = left(), show = Math.min(rest, Math.max(0, limit - done)), per = tries ? (performance.now() - t0) / tries : 700; ui.progress({ done, total: done + show, more: rest > show, eta: show * per, posts: posts.size }); };
  report();
  for (;;) {
    if (pages.length >= limit) { const rest = left(); if (!rest) break; if (cap < 2 || !(await ui.askMore(pages.length, rest))) { stopped = rest; break; } limit += cap; }
    const batch = [];
    while (batch.length < Math.min(2, limit - pages.length)) { const it = next(); if (!it) break; batch.push(it); }
    if (!batch.length) break;
    tries += batch.length;
    (await Promise.all(batch.map(b => soft(b.href)))).forEach((g, i) => {
      if (!g) return;
      if (g.status === 404 || g.status === 410 || g.status >= 500) return broken.push({ path: new URL(batch[i].href).pathname, status: g.status, from: batch[i].from });
      if (g.status >= 400 || !/html/i.test(g.headers['content-type'] || 'text/html')) return;
      const fu = g.finalUrl || batch[i].href, k = norm(fu);
      if (new URL(fu).hostname.replace(/^www\./, '') !== host || (k !== batch[i].key && seen.has(k))) return;
      seen.add(k);
      const p = readPage(fu, g.status, g.html, CFG);
      if (p.post) return void posts.add(k); // a blog post that only showed what it was once opened
      pages.push(p); push(p, 2, p.blogIndex);
    });
    report();
    await sleep(C.delayMs);
  }
  // Say what was checked and what was left out, and why.
  const nice = s => decodeURIComponent(s).replace(/[-_]+/g, ' ').trim(), notes = [], many = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const label = k => (k.startsWith('lang:') ? `“/${k.slice(5)}/” language version` : `“${nice(k.replace(/^type:/, ''))}” section`);
  notes.push(pages.length === 1 ? 'We checked the homepage.' : `We checked ${pages.length} pages: the homepage and the main pages around it.`);
  if (posts.size) notes.push(`We left out ${many(posts.size, 'blog post')}${sitemap.more ? ' (and likely more)' : ''}. Blog posts all share one layout, so opening every one would only repeat the same findings and keep you waiting.`);
  let skipped = posts.size + stopped;
  const bigs = [...secs].filter(([, s]) => big(s)).sort((a, b) => b[1].found - a[1].found), named = bigs.filter(([k]) => k !== 'other'), loose = secs.get('other');
  for (const [, s] of bigs) skipped += Math.max(0, s.found - s.done);
  // On a huge site there can be a dozen big sections, so only the four biggest get their own line.
  for (const [k, s] of named.slice(0, 4)) notes.push(`The ${label(k)} has ${s.found} pages. We checked ${s.done} of them as a sample, because pages in the same section are usually built the same way.`);
  if (named.length > 4) notes.push(`${named.length - 4} other big ${named.length === 5 ? 'section was' : 'sections were'} sampled the same way.`);
  if (big(loose)) notes.push(`${loose.found} more pages aren’t linked from the homepage, so we checked ${loose.done} of them as a sample.`);
  if (stopped && cap > 1) notes.push(`We stopped at ${pages.length} pages to keep the wait reasonable. About ${stopped} more were not checked.`);
  return { pages, broken, skipped, cover: notes, postUrls: [...posts].slice(0, 40) };
}

// When the site's security certificate runs out, read from public certificate logs (the latest one issued).
async function sslInfo(host) {
  const r = await soft(`https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(host)}&match_wildcards=true&expand=dns_names`);
  try {
    const last = JSON.parse(body(r)).filter(c => c.not_after).sort((a, b) => Date.parse(b.not_after) - Date.parse(a.not_after))[0];
    if (!last) return null;
    const end = Date.parse(last.not_after), life = (end - Date.parse(last.not_before)) / 864e5, days = (end - Date.now()) / 864e5;
    // "Soon" allows for short-lived certificates, which are always close to their end date.
    return days > 0 ? { expires: last.not_after, expiresText: fmt(last.not_after), soon: days < Math.min(14, life / 6) } : null;
  } catch { return null; }
}

// Known security holes for WordPress, Elementor and every plugin whose version we could read and that is behind.
async function vulnProbes(stack, probes) {
  const API = 'https://www.wpvulnerability.net/', jobs = [];
  if (stack.wp && stack.wp.version && stack.wp.status !== 'good') jobs.push(['core', `${API}core/${stack.wp.version}/`, stack.wp.version, true]);
  if (stack.elementor && stack.elementor.version && stack.elementor.status !== 'good') jobs.push(['elementor', `${API}plugin/elementor/`, stack.elementor.version]);
  for (const [slug, p] of Object.entries(probes.plugins || {})) if (p.version && p.version !== p.latest) jobs.push([slug, `${API}plugin/${slug}/`, p.version]);
  probes.vulns = {};
  (await pool(jobs, 3, j => soft(j[1]))).forEach((x, i) => { const v = vulnsFor(body(x), jobs[i][2], jobs[i][3]); if (v) probes.vulns[jobs[i][0]] = v; });
}

// A small copy of a screenshot. The full ones are too big to keep, so these are saved with the scan and the real
// website still shows when the scan is reopened from History or printed later.
async function thumbOf(src, maxW) {
  if (!src) return '';
  try {
    const img = new Image(); img.src = src; await img.decode();
    const k = Math.min(1, maxW / img.naturalWidth), c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  } catch { return ''; }
}
// The screenshots to show: the full ones while they are still in memory, otherwise the saved small copies.
// With clean set (client reports), a picture from a half-loaded test is left out.
const shotsOf = (r, clean) => {
  const m = good(r.psi.mobile), d = good(r.psi.desktop), t = r.thumbs || {}, bad = testTrouble(r), off = k => !!bad && bad.suspect.includes(k);
  return { d: clean && off('desktop') ? '' : (d && d.shot) || t.d || '', m: clean && off('mobile') ? '' : (m && m.shot) || t.m || '', note: off('mobile') || off('desktop') };
};
// Which devices Google's test failed on (none) or only half-loaded (half). "suspect" lists the devices whose
// picture should not be trusted. Scans saved before this check existed carry no "partial" note, so there a test
// that ran next to one that failed outright is treated as suspect too.
function testTrouble(r) {
  const NAME = { mobile: 'phones', desktop: 'computers' }, half = [], none = [], suspect = [];
  const failed = k => !!(r.psi[k] && r.psi[k].error && /could not load/i.test(r.psi[k].error));
  for (const k of ['mobile', 'desktop']) {
    const p = r.psi[k], other = k === 'mobile' ? 'desktop' : 'mobile';
    if (failed(k)) none.push(NAME[k]);
    else if (good(p) && (p.partial || (p.partial === undefined && failed(other)))) { suspect.push(k); if (p.partial) half.push(NAME[k]); }
  }
  if (none.length === 2 || (!half.length && !none.length)) return null;
  return { half, none, suspect, retried: ['mobile', 'desktop'].some(k => r.psi[k] && r.psi[k].retried) };
}
// The same thing in words, for the notice on screen, and a one-line version for the client report (two languages).
function testNote(r) {
  const t = testTrouble(r); if (!t) return null;
  const and = l => l.join(' and '), bits = [];
  if (t.half.length) bits.push(`Google\u2019s speed test only half-loaded this site on ${and(t.half)}. Some of its files, such as the styling or the pictures, didn\u2019t arrive${t.retried ? ', even on a second try' : ''}.`);
  if (t.none.length) bits.push(`Google couldn\u2019t load the site ${t.half.length ? '' : 'at all '}on ${and(t.none)}${t.half.length ? ' at all' : ''}.`);
  return { title: 'Google\u2019s test didn\u2019t load this site properly', why: `${bits.join(' ')} So the screenshot may look broken and the speed scores are probably lower than the real ones.`,
    next: 'Scan again in a few minutes. If it keeps happening, the site may be failing for some real visitors too, which is worth raising with the client.',
    client: ['Google\u2019s speed test could not load this site fully during this check, so the speed scores here may be lower than the real ones.', 'Ujian kelajuan Google tidak dapat memuatkan laman ini sepenuhnya semasa semakan ini, jadi skor kelajuan di sini mungkin lebih rendah daripada yang sebenar.'] };
}

// The main colours on the first screen, read from Google's screenshot. Shown as plain swatches, with no judgement.
async function paletteOf(src) {
  if (!src) return [];
  try {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'), w = c.width = 64, h = c.height = Math.max(1, Math.round(64 * img.naturalHeight / img.naturalWidth));
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data, bins = new Map(), total = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { const k = (d[i] >> 5) << 6 | (d[i + 1] >> 5) << 3 | (d[i + 2] >> 5), b = bins.get(k) || [0, 0, 0, 0]; b[0]++; b[1] += d[i]; b[2] += d[i + 1]; b[3] += d[i + 2]; bins.set(k, b); }
    const out = [];
    for (const b of [...bins.values()].sort((p, q) => q[0] - p[0])) {
      const rgb = [b[1] / b[0], b[2] / b[0], b[3] / b[0]], near = out.find(o => Math.hypot(o.rgb[0] - rgb[0], o.rgb[1] - rgb[1], o.rgb[2] - rgb[2]) < 48);
      if (near) near.n += b[0]; else out.push({ rgb, n: b[0] });
    }
    return out.filter(o => o.n / total >= 0.03).sort((p, q) => q.n - p.n).slice(0, 6).map(o => ({ hex: '#' + o.rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''), share: Math.round(o.n / total * 100) }));
  } catch { return []; }
}

// ---------- activity, vitals history and the close look at one post (the rules are in extra.js)
const NET = { soft, body, peek, sleep, pool };
async function cruxOf(origin) {
  try { const x = locked(await fetch('/api/crux?url=' + encodeURIComponent(origin) + '&form=phone')); return x.ok ? cruxFrom(await x.json()) : null; } catch { return null; }
}
// The weakest post on the site: a handful of posts are read two at a time, each is scored on the basics and the
// lowest one is kept for the close look, with Google's search suggestions for its topic. No blog: the weakest
// main page stands in.
async function reviewPosts(cands, postUrls, pages) {
  let list = pickPosts(cands.length ? cands : postUrls.map(url => ({ url, title: '', date: '' }))), kind = 'post';
  if (!list.length) {
    const quick = p => (!p.title ? 3 : 0) + (!p.desc ? 2 : 0) + (p.h1 !== 1 ? 2 : 0) + (p.words < 300 ? 1 : 0);
    const pg = pages.slice(1).sort((a, b) => quick(b) - quick(a))[0] || pages[0];
    if (!pg) return null;
    list = [{ url: pg.url, title: pg.title }]; kind = 'page';
  }
  const read = [];
  for (let i = 0; i < list.length; i += 2) {
    const got = await Promise.all(list.slice(i, i + 2).map(c => soft(c.url)));
    got.forEach((g, j) => { if (g && g.status === 200 && g.html) try { const f = postFacts(g.finalUrl || list[i + j].url, g.html, list[i + j]); f.score = postScore(f); read.push(f); } catch { /* a page we can't read is skipped */ } });
    await sleep(CFG.crawl.delayMs);
  }
  if (!read.length) return null;
  read.sort((a, b) => a.score - b.score);
  const p = read[0], kw = await suggestFor(p.focus, p._text, NET).catch(() => ({ suggest: [], have: [], from: '' }));
  for (const x of read) delete x._text;
  return { ...p, kind, kw, sample: read.length, others: read.slice(1).map(x => ({ url: x.url, title: x.title, score: x.score })) };
}

// ---------- scan
async function runScan(raw, opt = {}) {
  if (S.busy) return;
  const max = S.max, vsFor = opt.vsFor || null; // vsFor: the client result this scan is a competitor for
  let href = (raw || '').trim();
  if (!href) return toast('Paste a website link first.');
  const hadScheme = /^https?:\/\//i.test(href);
  if (!hadScheme) href = 'https://' + href;
  let u;
  try { u = new URL(href); if (!u.hostname.includes('.')) throw 0; } catch { return toast('That does not look like a website address.'); }
  const domain = u.hostname.replace(/^www\./, '');
  if (vsFor && vsFor.domain === domain) return toast('That is the same website. Paste a competitor’s link.');
  S.swapFrom = S.route === 'new' && $('.start') ? $('.start').offsetHeight : 0;   // the start card's height, so the scan card can grow out of it
  S.busy = true; S.route = 'scan'; drawNav(); renderScan(domain, vsFor);
  ['site', 'm', 'd'].forEach(id => step(id, 'run'));
  const speed = st => speedTest(u.href, st).then(v => (step(st[0], 'done', v.partial ? 'Only partly loaded' : ''), sofar({ [st]: v.scores.performance }), v), e => (step(st[0], 'fail', e.message), { error: e.message }));
  const pm = speed('mobile'), pd = speed('desktop');

  let page = null, err = '';
  try { page = await via(u.href); } catch (e) {
    err = e.detail || e.message;
    if (!hadScheme) try { page = await via('http://' + u.host + u.pathname); } catch { /* keep first error */ }
  }
  // Work out exactly why the site could not be read, if it could not.
  const read = diagnose(page, err, u.hostname);
  const blocked = !!read && read.level === 'blocked';
  if (blocked) {
    step('site', 'fail', read.title);
    page = { html: '', headers: page ? page.headers : {}, cookies: [], finalUrl: page ? page.finalUrl : u.href, status: page ? page.status : 0 };
  } else step('site', 'done', read ? read.title : null);

  step('stack', 'run');
  const origin = new URL(page.finalUrl).origin, probes = {}, latest = {}, s0 = detectStack(page);
  const site = { headers: page.headers, robots: null, sitemap: null, disallow: [] };
  const dnsQ = (name, type) => soft(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`).then(x => { try { return (JSON.parse(body(x)).Answer || []).map(a => String(a.data).replace(/\.$/, '').toLowerCase()); } catch { return []; } });
  const [robots, dom, ssl] = await Promise.all([blocked ? null : soft(origin + '/robots.txt'), domainInfo(u.hostname), /^https:/.test(origin) ? sslInfo(new URL(origin).hostname) : null]);
  probes.domain = dom; probes.ssl = ssl;
  // DNS records stay readable even when the site itself blocks us.
  const [nsRec, cnRec] = dom ? await Promise.all([dnsQ(dom.name, 'NS'), dnsQ('www.' + dom.name, 'CNAME')]) : [[], []];
  probes.dns = dnsClues(nsRec, cnRec);
  if (!blocked) {
    const rb = body(robots);
    site.robots = /user-agent|disallow|sitemap/i.test(rb) && !/<html/i.test(rb);
    const sm = await readSitemap(origin, rb);
    site.sitemap = sm.found; site.sitemapUrls = sm.urls;
    if (site.robots) { site.disallow = disallowed(rb); probes.robots = rb.slice(0, 4000); }
    // No platform markers on the homepage: try the usual login addresses before giving up.
    if (!s0.platform || s0.platform.kind === 'none') {
      const [wl, ja, dl] = await pool(['/wp-login.php', '/administrator/', '/user/login'], 3, x => soft(origin + x));
      const hit = (x, re) => !!x && x.status === 200 && re.test(x.html);
      probes.paths = { wp: hit(wl, /wp-login|wp-submit|user_login/i), joomla: hit(ja, /joomla|com_login|mod-login/i), drupal: hit(dl, /drupal|user-login-form/i) };
      if (probes.paths.wp) await wpProbes(origin, { ...s0, pluginSlugs: [], themeSlug: '' }, probes, latest);
    }
    if (s0.platform && s0.platform.kind === 'wordpress') await wpProbes(origin, s0, probes, latest);
  }
  let stack = detectStack(page, probes, latest);
  if (stack.wp) { await vulnProbes(stack, probes); stack = detectStack(page, probes, latest); }
  step('stack', 'done');
  sofar({ stack: [stack.platform && stack.platform.name, stack.wp && stack.wp.version, stack.builder && stack.builder.name].filter(Boolean).join(' ') });

  let pages = [], broken = [], bigImages = [], skipped = 0, cover = [], postUrls = [], activity = null, post = null;
  const cruxP = cruxOf(origin), stabP = blocked ? null : readStability(page.finalUrl, NET);   // these run alongside the page check
  if (!blocked) {
    step('pages', 'run');
    // A first look at the homepage while the rest of the site is still being checked.
    try { const p0 = readPage(page.finalUrl, page.status, page.html, CFG); sofar({ first: buildIssues({ pages: [p0], broken: [], bigImages: [], site, stack, psi: { mobile: { error: 1 }, desktop: { error: 1 } } }, CFG).filter(i => i.sev !== 'Low').slice(0, 4).map(i => i.title) }); } catch { /* the early look is a nicety */ }
    ({ pages, broken, skipped, cover, postUrls } = await crawl(page, max, site.disallow, max > 1 ? site.sitemapUrls || [] : [], progressUi()));
    const urls = pages[0].imgUrls, sizes = await pool(urls, 3, peek);
    if (!pages[0].design.favicon) site.favicon = ((await peek(origin + '/favicon.ico')) || {}).status === 200;
    // Elementor keeps its site-wide colours in one small file. If they are still the ones it ships with, say so.
    const kit = pages[0].design.kit, kitCss = kit ? (/--e-global-color-primary/.test(page.html) ? page.html : body(await soft(`${origin}/wp-content/uploads/elementor/css/post-${kit}.css`))) : '';
    site.kitStarter = /--e-global-color-primary:\s*#6EC1E4/i.test(kitCss) && /--e-global-color-accent:\s*#61CE70/i.test(kitCss);
    bigImages = sizes.map((m, i) => ({ url: urls[i], kb: m && m.headers ? Math.round((+m.headers['content-length'] || 0) / 1024) : 0 })).filter(b => b.kb > CFG.thresholds.imageKB);
    step('pages', 'done', `${pages.length} ${pages.length === 1 ? 'page' : 'pages'}${skipped ? `, ${skipped} left out` : ''}`);
    const pr = $('#prog'); if (pr) pr.hidden = true;
    // How often new posts and pages appear, then a close look at the weakest blog post.
    step('seo', 'run');
    const isWp = (stack.platform && stack.platform.kind === 'wordpress') || (probes.namespaces || []).some(n => /^wp\/v2/.test(n));
    const act = await readActivity(origin, isWp, site.sitemapUrls || [], NET).catch(() => ({ activity: { source: '' }, candidates: [] }));
    activity = act.activity;
    const llms = await soft(origin + '/llms.txt');
    site.llms = !!llms && llms.status === 200 && !/<html/i.test(body(llms, 600)) && body(llms, 4000).trim().length > 20;
    post = await reviewPosts(act.candidates, postUrls || [], pages).catch(() => null);
    step('seo', 'done', post ? `${post.sample} ${post.kind === 'page' ? 'page' : post.sample === 1 ? 'post' : 'posts'} read` : 'No blog found');
  } else { step('pages', 'fail', 'Skipped'); step('seo', 'fail', 'Skipped'); }

  const [mobile, desktop] = await Promise.all([pm, pd]);
  S.busy = false;
  if (!page.html && mobile.error && desktop.error) return renderFail(domain, read || { title: 'The site did not respond', why: mobile.error, next: 'Check the spelling of the link, then try again.' });
  // Second pass over everything we collected: every crawled page plus the files Google's test saw load.
  const psiUrls = [...new Set([...(mobile.urls || []), ...(desktop.urls || [])])];
  delete mobile.urls; delete desktop.urls;
  stack = detectStack({ ...page, extra: [...pages.slice(0, 40).map(x => x.evidence || ''), ...psiUrls].join('\n') }, probes, latest);
  const unknown = !stack.platform || stack.platform.kind === 'none';
  stack.tried = [
    blocked ? `Homepage code: blocked (${read.title.toLowerCase()})` : 'Homepage code: read',
    blocked ? 'Other pages: not read' : `Other pages: ${pages.length - 1} more read for platform markers`,
    psiUrls.length ? `Google\u2019s test: ${psiUrls.length} files it loaded were checked` : 'Google\u2019s test: gave us no file list',
    nsRec.length ? `DNS records: ${nsRec.slice(0, 2).join(', ')}` : 'DNS records: none returned',
    blocked ? null : `robots.txt: ${site.robots ? 'read' : 'not found'}`,
    probes.paths ? 'Login addresses for WordPress, Joomla and Drupal: tried' : null,
  ].filter(Boolean);
  if (unknown) {
    stack.platform = stack.platform || { id: 'none', name: 'Not detected', kind: 'none' };
    stack.verdict = { tone: blocked ? 'info' : 'warn', title: 'The platform could not be identified', reasons: [
      blocked ? `Our reader was stopped: ${read.title.toLowerCase()}.` : read && read.level === 'limited' ? `${read.title}, so the page code holds few markers.` : 'The page was read, but its code carries no markers of any platform we know.',
      psiUrls.length ? `Google\u2019s test loaded the page and ${psiUrls.length} files, and none of them point to a known platform.` : 'Google\u2019s speed test gave us no list of files to check.',
      `DNS records${blocked ? '' : ', robots.txt'}${probes.paths ? ' and the usual login addresses' : ''} gave no match either.`,
      blocked ? 'Ask the client which platform they use, or scan again once our checker is allowed through.' : 'Most likely a custom-coded site, or a platform deliberately hidden behind a CDN. Ask the client or their developer.',
    ] };
    if (!stack.items.some(i => i.group === 'Platform')) stack.items.unshift({ group: 'Platform', name: 'Not detected', version: '', status: 'warn', note: blocked ? 'Site could not be read' : 'No markers found', conf: 'Low' });
  }
  const tries = stabP ? await stabP : null;
  const r = { id: Date.now(), url: page.finalUrl || u.href, domain, date: new Date().toISOString(), blocked, read, stack, psi: { mobile, desktop }, pages, broken, bigImages, site,
    activity, post, crux: await cruxP, stab: { tries, b404: broken.filter(b => b.status < 500).length, b5xx: broken.filter(b => b.status >= 500).length, pages: pages.length },
    seoRaw: pages.length ? seoFacts(pages, site, { llms: site.llms }) : null };
  r.issues = buildIssues(r, CFG); r.health = healthOf(r); r.strengths = strengthsOf(r); r.design = designVerdict(r); r.why = whyOf(r); r.ideas = ideasOf(r);
  r.cover = cover; r.palette = await paletteOf((good(desktop) || {}).shot || (good(mobile) || {}).shot);
  r.thumbs = { d: await thumbOf((good(desktop) || {}).shot, 640), m: await thumbOf((good(mobile) || {}).shot, 240) };
  r.fit = skillsFit(stack, CFG); r.steps = nextSteps(r, CFG); r.verdict = verdictOf(r);
  r.pagesChecked = pages.length; r.pagesSkipped = skipped;
  for (const k of ['pages', 'broken', 'bigImages', 'site']) delete r[k];
  await H.add(r).catch(e => toast(e.message));
  if (vsFor) return attachRival(vsFor, r);
  open(r);
}

function open(r, from) {
  PL.id = null;
  S.result = r; S.route = 'result'; S.sec = 'overview'; S.q = ''; S.cat = 'all'; S.more = false;
  render();
  window.scrollTo(0, 0);
  if (from) fly($('.crumb b'), from);   // from: where the site name was on screen in the list that was tapped
}

// ---------- views
// Cards float in when a screen is new. Drawing the same screen again (a row removed, a filter changed) leaves them be.
let lastView = '';
const fresh = name => { const yes = lastView !== name; lastView = name; return yes; };
function drawNav() {
  const res = S.route === 'result', none = !S.result;
  const b = (go, ic, label, on, dis) => `<button type="button" data-go="${go}" class="${on ? 'on' : ''}"${dis ? ' disabled' : ''}>${icon(ic)}${label}</button>`;
  const keep = nav.scrollLeft;
  nav.innerHTML = '<i class="nav-pill" aria-hidden="true"></i>' + b('new', 'plus', 'New scan', S.route === 'new' || S.route === 'scan')
    + b('overview', 'grid', 'Overview', res && S.sec === 'overview', none)
    + (S.result && S.result.vs ? b('compare', 'versus', 'Competitor', res && S.sec === 'compare') : '')
    + b('speed', 'gauge', 'Page speed', res && S.sec === 'speed', none)
    + b('activity', 'pulse', 'Activity', res && S.sec === 'activity', none)
    + b('seo', 'seo', 'SEO', res && S.sec === 'seo', none)
    + b('design', 'layout', 'Design', res && S.sec === 'design', none)
    + b('stack', 'layers', 'Tech stack', res && S.sec === 'stack', none)
    + b('findings', 'list', 'Findings', res && S.sec === 'findings', none)
    + b('steps', 'flag', 'Next steps', res && S.sec === 'steps', none)
    + b('history', 'clock', 'History', S.route === 'history')
    + '<hr>' + b('pdf-client', 'down', 'Client report', false, none) + b('pdf-internal', 'down', 'Internal report', false, none);
  // On phones the menu is one row that scrolls sideways and stays at the top, so keep the current item in view.
  nav.scrollLeft = keep;
  const on = nav.querySelector('.on');
  if (on && nav.scrollWidth > nav.clientWidth + 4) { const a = on.getBoundingClientRect(), n = nav.getBoundingClientRect(); nav.scrollTo({ left: nav.scrollLeft + a.left - n.left - (n.width - a.width) / 2, behavior: 'smooth' }); }
  movePill(nav);   // the highlight slides from the old item to this one
  drawBuddy();
}

function historyCard(rows, title, everyone) {
  return `<div class="card"><div class="card-head"><h3>${title}</h3>${ME.admin && S.route === 'history' ? `<label class="pill soft">Show: <select id="who"><option value="mine">My scans</option><option value="all"${everyone ? ' selected' : ''}>Everyone\u2019s scans</option></select></label>` : ''}</div><div class="tablewrap"><table>
    <thead><tr><th>Site</th><th>Health</th><th>Verdict</th><th>Can we take it?</th><th>Platform</th>${everyone ? '<th>Scanned by</th>' : ''}<th>Scanned</th><th></th></tr></thead><tbody>
    ${rows.map(r => `<tr>
      <td><b>${esc(r.domain)}</b></td>
      <td class="nw">${dotted(htone(r.health.score), r.health.score ?? 'No data')}</td>
      <td class="nw">${dotted(r.verdict.tone, esc(r.verdict.label))}</td>
      <td class="nw">${dotted(r.fit.tone, r.fit.verdict)}</td>
      <td><span class="plat">${techIcon(r.stack.platform ? r.stack.platform.name : 'Not detected', 'Platform')}${esc(r.stack.platform ? r.stack.platform.name : 'Not detected')}</span></td>${everyone ? `<td>${esc(r.by || '')}</td>` : ''}
      <td class="nw muted">${fmt(r.date)}</td>
      <td class="nw"><button type="button" class="link" data-open="${r.id}">Open</button><button type="button" class="link" data-remove="${r.id}">Remove</button></td></tr>`).join('')}
    </tbody></table></div><p class="keep">Scans are removed automatically after ${KEEP_HOURS} hours.</p></div>`;
}

function renderNew() {
  const rows = H.rows.slice(0, 5);
  view.innerHTML = `
    <div class="top"><div class="crumb">SenseCheck<i>&rsaquo;</i><b>New scan</b></div></div>
    <div class="card start hasbuddy"><div class="start-main">
      <h1>Check a client\u2019s website</h1>
      <p>Paste the link and we\u2019ll go through the whole website: what it runs on, whether we can take it on, what needs fixing and what to propose.</p>
      <form class="urlrow" id="f" novalidate>
        <label class="field">${icon('link')}<input id="u" type="text" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="clientsite.com.my" aria-label="Website address"></label>
        <button class="btn primary" type="submit">Run check</button>
      </form>
      <div class="covers"><span><i class="dot m"></i>Tech stack and versions</span><span><i class="dot d"></i>Speed, SEO, content and security</span><span><i class="dot c3"></i>Strengths and next steps</span></div>
    </div>${mascot('wave', 'xl', 'blob')}</div>
    ${rows.length ? historyCard(rows, H.server ? 'My recent scans' : 'Recent scans') : ''}`;
  const u = $('#u'); if (u && window.matchMedia('(min-width: 821px)').matches) u.focus({ preventScroll: true });
  if (fresh('new')) floatIn();
}

function renderHistory() {
  const rows = H.rows, all = S.who === 'all' && ME.admin;
  view.innerHTML = `<div class="top"><div class="crumb">SenseCheck<i>&rsaquo;</i><b>History</b></div></div>
    ${rows.length || ME.admin ? historyCard(rows, all ? 'Everyone\u2019s scans' : H.server ? 'My scans' : 'Past scans on this browser', all) : ''}
    ${rows.length ? '' : `<div class="card emptybox">${mascot('coffee', 'lg', 'blob')}<p class="empty">No scans yet. Run your first check from New scan.</p></div>`}`;
  if (fresh('history')) floatIn();
}

function renderScan(domain, vsFor) {
  SOFAR = {};
  const before = S.swapFrom || 0; S.swapFrom = 0;
  view.innerHTML = `<div class="top"><div class="crumb">Scans<i>&rsaquo;</i><b>${esc(domain)}</b></div></div>
    <div class="card start hasbuddy"><div class="start-main"><h1>Checking ${esc(domain)}</h1>
    <p>${vsFor ? `This is the competitor for ${esc(vsFor.domain)}. ` : ''}We check the homepage and the main pages around it, two at a time so we don\u2019t slow the website down. Blog posts are left out because they all share one layout. Keep this tab open until it finishes.</p>
    <div class="steps">${[['site', 'Reading the site'], ['stack', 'Identifying the tech stack'], ['pages', 'Checking pages'], ['seo', 'Reading blog posts for SEO'], ['m', 'Measuring mobile speed'], ['d', 'Measuring desktop speed']].map(([id, t]) => `<div class="step" id="st-${id}"><span class="ic"></span><span>${t}</span><small></small></div>`).join('')}</div>
    <div class="prog" id="prog" hidden><div class="track"><div class="bar"><i id="progbar"></i></div><img class="runner" id="runner" src="img/mascot/run.webp" alt=""></div><p id="progtext"></p><div id="progask"></div></div>
    <div class="sofar" id="sofar" hidden></div></div>${mascot('inspect', 'xl', 'blob')}</div>`;
  if (before) { const card = $('.start'); card.classList.add('swap'); resize(card, before); }
  fresh('scan'); floatIn();
}

// Early results, shown while the rest of the scan is still running, so nobody stares at a blank screen.
let SOFAR = {};
function sofar(patch) {
  Object.assign(SOFAR, patch);
  const el = $('#sofar'), t = SOFAR; if (!el) return;
  const tile = (label, val, tn) => `<div><span class="label">${label}</span><b>${tn ? `<i class="dot ${tn}"></i>` : ''}${val}</b></div>`;
  const sp = v => (v != null ? `${v} out of 100` : 'Measuring\u2026');
  el.hidden = false;
  el.innerHTML = `<h3>What we know so far</h3><div class="tiles">
    ${tile('Built with', t.stack != null ? (t.stack ? techIcon(t.stack, 'Platform') : '') + esc(t.stack || 'Not clear yet') : 'Checking\u2026')}
    ${tile('Speed on phones', sp(t.mobile), t.mobile != null ? tone(t.mobile) : '')}
    ${tile('Speed on computers', sp(t.desktop), t.desktop != null ? tone(t.desktop) : '')}</div>
    ${t.first && t.first.length ? `<span class="label">First things we noticed on the homepage</span><ul>${t.first.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    <p class="muted">The full report opens by itself once everything is done.</p>`;
}

// Live progress for the page check: how many pages, how long is left, and the pause at the safety limit.
function progressUi() {
  let told = false;
  return {
    progress({ done, total, more, eta, posts }) {
      const box = $('#prog'); if (!box) return;
      box.hidden = total <= 1;
      const pct = Math.min(100, Math.round(done / Math.max(1, total) * 100));
      $('#progbar').style.width = pct + '%';
      const run = $('#runner'); if (run) run.style.left = `clamp(16px, ${pct}%, calc(100% - 16px))`; // the mascot jogs along the bar
      const size = total >= 100 ? `This is a big website, around ${total}${more ? '+' : ''} pages to check, so it needs a little time.` : `There are around ${total} pages to check.`;
      $('#progtext').innerHTML = `<b>${done} of ${total}${more ? '+' : ''} pages checked.</b> ${done < total ? `${told ? '' : size + ' '}${esc(mins(eta).replace(/^a/, 'A'))} left.` : more ? '' : 'Finishing up.'}${posts ? ` <span class="muted">Leaving out ${posts} blog ${posts === 1 ? 'post' : 'posts'}, they all share one layout.</span>` : ''}`;
      if (done > 2) told = true;
      step('pages', 'run', `${done} of ${total}${more ? '+' : ''}`);
    },
    askMore(done, left) {
      return new Promise(res => {
        const ask = $('#progask'); if (!ask) return res(false);
        ask.innerHTML = `<p>We\u2019ve checked ${done} pages and found about ${left} more. Going on could take ${esc(mins(left * 700))}.</p><button class="btn primary" type="button" id="more-yes">Keep going</button> <button class="btn soft" type="button" id="more-no">Finish with these</button>`;
        $('#more-yes').onclick = () => { ask.innerHTML = ''; res(true); };
        $('#more-no').onclick = () => { ask.innerHTML = ''; res(false); };
      });
    },
  };
}
function step(id, st, note) {
  const el = $('#st-' + id); if (!el) return;
  el.className = 'step ' + st;
  const ic = el.querySelector('.ic'), was = ic.dataset.st || '';
  if (was !== st) { ic.dataset.st = st; ic.innerHTML = st === 'done' ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1"/></svg>' : st === 'fail' ? '!' : ''; }
  if (note != null) el.querySelector('small').textContent = note;
  // the mascot on the scan screen changes with the job in hand
  const pose = st === 'run' ? { site: 'inspect', stack: 'clipboard', pages: 'run', seo: 'underline' }[id] : id === 'seo' ? 'coffee' : '';
  if (pose) scanPose(pose);
}
function scanPose(pose) {
  const im = $('.start > .mascot img'); if (!im || im.dataset.pose === pose) return;
  im.dataset.pose = pose; im.src = `img/mascot/${pose}.webp`; boing(im.parentNode);
}
function renderFail(domain, d) {
  S.route = 'new'; drawNav();
  view.innerHTML = `<div class="top"><div class="crumb">Scans<i>&rsaquo;</i><b>${esc(domain)}</b></div></div>
    <div class="card start hasbuddy"><div class="start-main"><h1>Could not check ${esc(domain)}</h1>
    <p><b>${esc(d.title)}.</b> ${esc(d.why)}</p><p style="margin-top:12px"><b>What to do:</b> ${esc(d.next)}</p>
    <div class="urlrow"><button class="btn primary" type="button" data-go="new">Try another link</button></div></div>${mascot('shrug', 'xl', 'blob')}</div>`;
  fresh('fail'); floatIn();
}

// Notice shown when the site was blocked or only partly readable, with the specific reason.
const readNote = (r, internal = true) => (r.read ? `<div class="card notice"><h3>${r.read.level === 'blocked' ? 'We could not read this site' : 'This site was only partly readable'}</h3>
  <p><b>${esc(r.read.title)}.</b> ${esc(r.read.why)}</p>${internal ? `<p><b>What to do:</b> ${esc(r.read.next)}</p>` : ''}
  ${r.read.level === 'blocked' ? '<p class="muted">Speed scores still come from Google\u2019s own test. Content, SEO, image and design checks need the page code, so they are not included.</p>' : ''}</div>` : '');

const reasons = list => `<ul>${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
// Indicative "from" prices per package come from config.json (prices). Left empty, nothing about price is shown.
const priceOf = name => { const k = Object.keys(CFG.packages).find(x => CFG.packages[x] === name); return (k && (CFG.prices || {})[k]) || ''; };
const stepsHtml = (r, pkg, T = x => x, titles = GROUPS) => titles.map(([k, t]) => `<div><h4>${t}</h4>${r.steps[k].length ? `<ul>${r.steps[k].map(x => `<li>${esc(T(x.text))}${pkg ? `<br><span class="chip">${esc(x.pkg)}${priceOf(x.pkg) ? ` \u00b7 ${esc(priceOf(x.pkg))}` : ''}</span>` : ''}</li>`).join('')}</ul>` : `<p class="muted">${esc(T('Nothing needed.'))}</p>`}</div>`).join('');
function budgetHtml(r) {
  const used = [...new Set(GROUPS.flatMap(([k]) => r.steps[k].map(x => x.pkg)))].filter(priceOf);
  return used.length ? `<p class="budget"><b>Rough budget guide (internal):</b> ${used.map(p => `${esc(p)} ${esc(priceOf(p))}`).join(' \u00b7 ')}. These are starting prices, so confirm the scope before you quote.</p>` : '';
}

// "How to make it faster": the jobs that would move the speed score most, most useful first.
function fasterHtml(r) {
  const f = speedPlan(r);
  if (!f) return '';
  return `<div class="faster"><div class="faster-head">${mascot(f.fast ? 'thumbs' : 'point', 'md')}<div><h4>How to make it faster</h4><p class="ink2">${esc(f.lead)}</p></div></div>
    ${f.steps.length ? `<div class="plan">${f.steps.map((x, i) => `<div class="job"><div class="job-head"><b>${esc(x.title)}</b>${i === 0 ? '<span class="chip start">Start here</span>' : ''}<span class="chip">${esc(x.effort)}</span></div><p>${esc(x.why)}</p><p class="fix">${esc(x.how)}</p>${x.gain ? `<p class="gain">${esc(x.gain)}</p>` : ''}</div>`).join('')}</div>` : ''}
    ${f.note ? `<p class="muted small" style="margin-top:12px">${esc(f.note)}</p>` : ''}</div>`;
}

// Design advice grouped by area: what we saw, why it matters and what we would do.
const AREAS = ['First impression', 'Fonts and colours', 'Photos and visuals', 'Layout and navigation', 'Trust and getting in touch', 'On phones', 'Under the hood'];
const areaOf = x => (AREAS.includes(x.area) ? x.area : 'Under the hood');
const adviceHtml = looks => AREAS.map(a => { const list = looks.filter(x => areaOf(x) === a); return list.length ? `<div class="area"><h4>${a}</h4>${list.map(x => `<div class="adv"><b><i class="dot ${SEV[x.sev]}"></i>${esc(x.title)}</b><p>${esc(x.detail)}</p><p class="fix">${esc(x.fix)}</p></div>`).join('')}</div>` : ''; }).join('');

const LEGEND = '<div class="legend"><span><i class="dot m"></i>Mobile</span><span><i class="dot d"></i>Desktop</span></div>';
const scoreGroups = (m, d) => LH.map(([k, n]) => ({ short: n, name: n, m: m && { score: m.scores[k], display: String(m.scores[k] ?? '–') }, d: d && { score: d.scores[k], display: String(d.scores[k] ?? '–') } }));
const speedGroups = (m, d) => (m || d).metrics.map((x, i) => ({ short: x.short, name: `${x.name} (${x.short})`, m: m && m.metrics[i], d: d && d.metrics[i] }));
const designOf = r => r.design || { tone: 'info', label: 'Not checked in this scan', note: 'Scan again to run the design checks.' };

// ---------- website activity, Core Web Vitals, stability and SEO (rules and wording in extra.js)
const MONTHS = { en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], bm: ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'] };
const TONE_WORD = { good: ['Good', 'Baik'], warn: ['Needs work', 'Perlu diperbaiki'], bad: ['Poor', 'Lemah'], info: ['No data', 'Tiada data'] };
const toneWord = (t, lang) => TONE_WORD[t][lang === 'bm' ? 1 : 0];
// New posts (purple) and new pages (pink) per month, for the last twelve months.
function countSvg(months, lang = 'en') {
  const W = 520, Hh = 230, L = 30, R = 6, T = 22, B = 30, pw = W - L - R, ph = Hh - T - B, gw = pw / months.length, bw = Math.min(13, gw * 0.3), gap = 2;
  const top = Math.max(4, ...months.map(m => Math.max(m.posts, m.pages))), nice = Math.ceil(top / 4) * 4, y = v => T + ph - (v / nice) * ph;
  const bar = (x, v, k, i) => { if (!v) return ''; const h = Math.max(3, (v / nice) * ph), rr = Math.min(4, h), yy = y(0) - h; return `<path class="bar ${k}" style="--i:${i}" d="M${x},${y(0)}V${yy + rr}Q${x},${yy} ${x + rr},${yy}H${x + bw - rr}Q${x + bw},${yy} ${x + bw},${yy + rr}V${y(0)}Z"/><text class="val" style="--i:${i}" x="${x + bw / 2}" y="${yy - 5}" text-anchor="middle">${v}</text>`; };
  let out = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${lang === 'bm' ? 'Artikel dan halaman baharu setiap bulan' : 'New posts and pages each month'}">`;
  for (const t of [0, nice / 2, nice]) out += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`;
  months.forEach((m, i) => { const cx = L + gw * i + gw / 2; out += bar(cx - bw - gap / 2, m.posts, 'm', i) + bar(cx + gap / 2, m.pages, 'd', i) + `<text class="tick" x="${cx}" y="${Hh - 8}" text-anchor="middle">${MONTHS[lang === 'bm' ? 'bm' : 'en'][+m.k.slice(5) - 1]}</text>`; });
  return out + '</svg>';
}
const ACT_LEGEND = (lang = 'en') => `<div class="legend"><span><i class="dot m"></i>${lang === 'bm' ? 'Artikel' : 'Posts'}</span><span><i class="dot d"></i>${lang === 'bm' ? 'Halaman' : 'Pages'}</span></div>`;
const since = iso => { const n = Math.floor((Date.now() - Date.parse(iso)) / 864e5); return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n < 60 ? `${n} days ago` : `${Math.round(n / 30.4)} months ago`; };
const again = what => `<p class="note">${what} needs a fresh scan. Press Scan again at the top.</p>`;

function activityHtml(r) {
  const A = r.activity;
  if (!A) return again('Website activity');
  const a = activityOf(r);
  if (!A.source) return `<div class="act-verdict">${mascot('shrug', 'md')}<div><h4>${dotted(a.tone, esc(a.label))}</h4><p class="ink2">${esc(a.line)}</p></div></div>`;
  const span = `${MONTHS.en[+A.months[0].k.slice(5) - 1]} ${A.months[0].k.slice(0, 4)} to ${MONTHS.en[+A.months[11].k.slice(5) - 1]} ${A.months[11].k.slice(0, 4)}`;
  return `<div class="act">
      <div class="act-side">
        <div class="act-verdict">${mascot(a.tone === 'good' ? 'thumbs' : a.tone === 'bad' ? 'coffee' : 'clipboard', 'md')}<div><h4>${dotted(a.tone, esc(a.label))}</h4><p class="ink2">${esc(a.line)}</p></div></div>
        <div class="tiles3">
          <div class="tile t1"><span>New posts this year</span><b>${a.posts12}</b><small>Last 12 months</small></div>
          <div class="tile t3"><span>Last new post</span><b>${A.lastPost ? esc(since(A.lastPost)) : 'None yet'}</b>${A.lastPost ? `<small>${fmt(A.lastPost)}</small>` : ''}</div>
          <div class="tile t4"><span>New pages</span><b>${a.newPages}</b><small>Last 3 months</small></div>
        </div>
      </div>
      <div><div class="chart-head"><span class="label">New each month, ${esc(span)}</span>${ACT_LEGEND()}</div><div class="chart" id="chart-act">${countSvg(A.months)}</div></div>
    </div>
    <div class="newlist"><h4>Any new pages?</h4>${A.recent && A.recent.length ? `<ul>${A.recent.map(p => `<li><span class="chip">${p.kind === 'post' ? 'Post' : 'Page'}</span><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title || new URL(p.url).pathname)}</a><small>${fmt(p.date)}</small></li>`).join('')}</ul>` : '<p class="muted">Nothing new in the last 3 months.</p>'}</div>
    ${A.source === 'sitemap' ? '<p class="muted small">Dates come from the sitemap, so they show when a page last changed rather than when it first went up.</p>' : ''}`;
}

function vitalsHtml(r) {
  const c = cwvOf(r);
  if (!c.items.length) return `<p class="note">${esc(c.line)}</p>`;
  return `<div class="cwv-top"><h4>${dotted(c.tone, esc(c.label))}</h4><p class="ink2">${esc(c.line)}</p></div>
    <div class="cwv">${c.items.map(i => `<div class="cwv-i ${i.tone}"><span>${esc(i.name)}${i.stand ? ' <small>(lab)</small>' : ''}</span><b>${esc(i.value)}</b><em><i class="dot ${i.tone}"></i>${toneWord(i.tone)}</em><small>Good is ${esc(i.aim)}</small></div>`).join('')}</div>
    ${r.crux ? `<div class="trends"><span class="label">Last 6 months, real visitors on phones</span>${trendSvg(r.crux)}</div>` : ''}`;
}

function stabilityHtml(r, trouble) {
  if (!r.stab) return again('The stability check');
  const st = stabilityOf(r, 'en', trouble);
  return `<div class="cwv-top"><h4>${dotted(st.tone, esc(st.label))}</h4><p class="ink2">${esc(st.line)}</p></div>
    <ul class="stab">${st.rows.map(x => `<li><i class="dot ${x.tone}"></i><span>${esc(x.text)}</span></li>`).join('')}</ul>
    <p class="muted small">From this scan: we visited the homepage ${r.stab.tries ? r.stab.tries.length : 0} times and opened ${many(r.stab.pages || 0, 'page')}.</p>`;
}

function seoHtml(r) {
  const o = seoOf(r);
  if (!o) return r.seoRaw === undefined ? again('The SEO score') : '<p class="note">The site couldn’t be read, so there’s no SEO score.</p>';
  return `<div class="seo-top">
      <div class="seo-score"><span class="label">SEO score</span><div class="health"><b>${o.score ?? '–'}</b><span>out of 100</span></div><p class="tone ${o.tone}">${esc(o.label)}</p></div>
      <div class="seo-parts">${o.parts.map(p => `<div class="sp"><div class="sp-head"><b>${esc(p.name)}</b><span>${p.score ?? '–'}</span></div><div class="sp-bar"><i class="${htone(p.score)}" style="width:${p.score || 0}%"></i></div>${p.line ? `<p>${esc(p.line)}</p>` : ''}</div>`).join('')}</div>
    </div>`;
}

// ---------- "Is this post SEO friendly?": a Google preview and the post, with the weak spots marked, and the
// mascot walking through them one at a time.
const PL = { step: 0, id: null };
const PL_POSE = ['point', 'inspect', 'underline', 'shrug', 'clipboard', 'point'];
const plSteps = p => postChecks(p).filter(c => !c.ok).sort((a, b) => b.w - a.w).slice(0, 6);
const crumbOf = p => { try { const u = new URL(p.url); return `${u.hostname.replace(/^www\./, '')}${u.pathname.split('/').filter(Boolean).map(x => ` › ${decodeURIComponent(x)}`).join('').slice(0, 70)}`; } catch { return p.url; } };
const cut = (t, n) => (t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t);
function postHtml(r) {
  const p = r.post;
  if (!p) return r.post === undefined ? again('The close look at a blog post') : '<p class="note">We couldn’t find a blog post or a page to read up close.</p>';
  const mk = (k, html) => `<span class="mk" data-k="${k}">${html}</span>`;
  const when = p.modified || p.published;
  return `<div class="pl">
      <div class="pl-preview">
        <span class="label">How it shows on Google</span>
        <div class="serp">
          <div class="serp-site"><i>${esc((r.domain[0] || '').toUpperCase())}</i>${mk('url', esc(crumbOf(p)))}</div>
          <p class="serp-title">${mk('title', esc(p.title ? cut(p.title, 62) : '(no title)'))}</p>
          <p class="serp-desc">${mk('desc', esc(p.desc ? cut(p.desc, 160) : 'No description, so Google picks some text from the page itself.'))}</p>
        </div>
        <span class="label">Inside the ${p.kind === 'page' ? 'page' : 'post'}</span>
        <div class="doc">
          <h4>${mk('h1', esc(p.h1 || '(no main heading)'))}</h4>
          ${p.intro ? `<p>${mk('intro', esc(cut(p.intro, 260)))}</p>` : ''}
          ${p.h2s.length ? `<div class="doc-h2">${mk('subheads', p.h2s.slice(0, 4).map(h => `<span>${esc(cut(h, 48))}</span>`).join(''))}</div>` : ''}
          <div class="doc-facts">
            ${mk('length', `${p.words} words`)}${p.h2s.length ? '' : mk('subheads', 'No subheadings')}
            ${mk('images', `${many(p.imgs, 'picture')}${p.noAlt ? `, ${p.noAlt} undescribed` : ''}`)}
            ${mk('links', `${many(p.internal, 'link')} to the site`)}
            ${p.focus ? mk('keyword', `“${esc(p.focus)}” × ${p.kwCount}`) : ''}
            ${when ? mk('fresh', `Updated ${fmt(when)}`) : ''}${mk('schema', p.schema ? 'Article details' : 'No article details')}
          </div>
        </div>
        <a class="pl-open" href="${esc(p.url)}" target="_blank" rel="noopener">Open the ${p.kind === 'page' ? 'page' : 'post'}</a>
      </div>
      <div class="pl-guide" id="pl-guide"></div>
    </div>
    ${p.others && p.others.length ? `<p class="muted small pl-others">We also read ${many(p.others.length, 'other post')}, ${(lo => (hi => (lo === hi ? `${p.others.length === 1 ? 'scoring' : 'all scoring'} ${lo}` : `scoring ${lo} to ${hi}`))(Math.max(...p.others.map(o => o.score))))(Math.min(...p.others.map(o => o.score)))} out of 100. This one scored lowest (${p.score}).</p>` : ''}`;
}
function drawPost(hop) {
  const r = S.result, p = r && r.post, box = $('#pl-guide'); if (!p || !box) return;
  if (PL.id !== r.id) { PL.id = r.id; PL.step = 0; }
  const steps = plSteps(p), last = steps.length + 1, i = Math.min(PL.step, last), kw = p.kw || { suggest: [], have: [] };
  const word = p.kind === 'page' ? 'page' : 'post';
  let pose = 'wave', html = '';
  if (i === 0) {
    pose = steps.length ? 'point' : 'thumbs';
    html = steps.length ? `<p class="pl-big">${p.score >= 80 ? `This ${word} is mostly SEO friendly, but it could do better.` : `This ${word} isn’t very SEO friendly.`}</p><p>Wanna know why?</p><div class="pl-acts"><button type="button" class="btn primary" data-pl="next">Show me why</button></div>`
      : `<p class="pl-big">This ${word} is SEO friendly. Nice work!</p><p>It ticks every box we check.</p>`;
  } else if (i <= steps.length) {
    const c = steps[i - 1]; pose = PL_POSE[(i - 1) % PL_POSE.length];
    html = `<p class="pl-count">${i} of ${steps.length}</p><p class="pl-big">${esc(c.title)}</p><p>${esc(c.saw)} ${esc(c.why)}</p><p class="fix">${esc(c.fix)}</p>
      <div class="pl-acts"><button type="button" class="btn soft" data-pl="back">Back</button><button type="button" class="btn primary" data-pl="next">${i === steps.length ? 'How do we fix it?' : 'Next'}</button></div>`;
  } else {
    pose = 'thumbs';
    html = `<p class="pl-big">To help it rank, we’d use the words people actually search for.</p>
      ${kw.suggest.length ? `<p>Like these, from Google’s own suggestions for “${esc(p.focus)}”:</p><div class="kws">${kw.suggest.map(x => `<span class="kw">${esc(x)}</span>`).join('')}</div>` : p.focus ? `<p>Starting with “${esc(p.focus)}” in the title, description, first lines and a subheading.</p>` : ''}
      ${kw.have.length ? `<p class="muted small">Already in the ${word}: ${kw.have.map(esc).join(', ')}.</p>` : ''}
      <div class="pl-acts"><button type="button" class="btn soft" data-pl="back">Back</button><button type="button" class="btn soft" data-pl="again">Start again</button></div>`;
  }
  box.innerHTML = `<div class="pl-say">${html}</div><span class="mascot md pl-face" aria-hidden="true"><img src="img/mascot/${pose}.webp" alt="" data-pose="${pose}"></span>
    ${steps.length ? `<div class="pl-dots" aria-hidden="true">${Array.from({ length: last + 1 }, (_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>` : ''}`;
  if (hop) boing($('.pl-face', box));
  // the weak spots: every one is marked once the walk starts, and the one being explained is drawn over with the marker
  const bad = new Set(steps.map(c => c.key)), cur = i >= 1 && i <= steps.length ? steps[i - 1].key : '';
  view.querySelectorAll('.pl .mk').forEach(el => { el.classList.toggle('bad', i > 0 && bad.has(el.dataset.k)); el.classList.toggle('on', el.dataset.k === cur); });
  const on = view.querySelector('.pl .mk.on');
  if (on && narrow.matches) on.scrollIntoView({ behavior: calm.matches ? 'auto' : 'smooth', block: 'center' });
}
function plAct(a) {
  const steps = plSteps(S.result.post);
  if (a === 'next') PL.step = Math.min(PL.step + 1, steps.length + 1);
  if (a === 'back') PL.step = Math.max(0, PL.step - 1);
  if (a === 'again') PL.step = 0;
  if (a.startsWith('k:')) { const k = steps.findIndex(c => c.key === a.slice(2)); if (k < 0) return; PL.step = k + 1; }
  drawPost(true);
}

function renderResult() {
  const r = S.result, m = good(r.psi.mobile), d = good(r.psi.desktop), any = m || d, v = r.stack.verdict, h = r.health, dz = designOf(r), sh = shotsOf(r), tn = testNote(r);
  const perr = (r.psi.mobile && r.psi.mobile.error) || (r.psi.desktop && r.psi.desktop.error) || '';
  const f = (m && m.field) || (d && d.field), fr = x => ({ FAST: 'good', AVERAGE: 'warn', SLOW: 'bad' }[x && x.rating] || 'info');
  const groups = [...new Set(r.stack.items.map(i => i.group))], looks = r.issues.filter(i => i.cat === 'Design');
  const val = (p, i) => (p ? dotted(tone(p.metrics[i].score), esc(p.metrics[i].display || '–')) : '–');
  const kb = p => weightText(p && p.weight);
  view.innerHTML = `
    <div class="top">
      <div class="crumb">Scans<i>&rsaquo;</i><b>${esc(r.domain)}</b></div>
      <div class="top-r"><button type="button" class="link" data-rescan>Scan again</button></div>
    </div>

    ${readNote(r)}
    ${tn ? `<div class="card notice"><h3>${esc(tn.title)}</h3><p>${esc(tn.why)}</p><p><b>What to do:</b> ${esc(tn.next)}</p></div>` : ''}
    <div class="card hero3" id="sec-overview">
      <div class="col who">
        ${sh.d || sh.m ? `<div class="shots">${sh.d ? `<img src="${esc(sh.d)}" alt="Desktop screenshot of ${esc(r.domain)}">` : ''}${sh.m ? `<img src="${esc(sh.m)}" alt="Mobile screenshot of ${esc(r.domain)}">` : ''}</div>${sh.note ? '<p class="shotnote">This is what Google\u2019s test saw. The page didn\u2019t load fully, so it may look broken.</p>' : ''}` : `<div class="shot empty">${esc(r.domain[0].toUpperCase())}</div>`}
        <h2>${esc(r.domain)}</h2>
        <p class="tone ${r.verdict.tone}">${esc(r.verdict.label)}</p>
        <button class="btn primary" type="button" data-go="pdf-client">${icon('down')}Client report</button>
        <button class="btn soft" type="button" data-go="pdf-internal">Internal report</button>
        <button class="btn soft" type="button" data-act="summary">${icon('copy')}Copy summary</button>
        <button class="btn soft" type="button" data-act="rival">${icon('versus')}${r.vs ? 'Change competitor' : 'Compare with a competitor'}</button>
      </div>
      <div class="col">
        <span class="label">Website health</span>
        <div class="health"><b>${h.score ?? '–'}</b><span>out of 100</span></div>
        ${r.prev && r.prev.score != null ? `<p class="prev">Was ${r.prev.score} on ${fmt(r.prev.date)}</p>` : ''}
        <div class="rows">${CATS.map(c => `<div class="row"><i class="dot ${htone(h.sub[c])}"></i><span>${CAT_NAME[c]}</span><b>${h.sub[c] ?? '<small>Not measured</small>'}</b></div>`).join('')}</div>
      </div>
      <div class="col chartcol">
        <div class="chart-head"><h3>Scores by device</h3>${LEGEND}</div>
        <span class="label">Google Lighthouse, out of 100</span>
        ${any ? '<div class="chart" id="chart-scores"></div>' : `<p class="note" style="margin-top:16px">Speed test unavailable. ${esc(perr)}</p>`}
      </div>
      <div class="summary"><div class="short-head">${mascot('underline', 'pen')}<h3 class="short-title">In short</h3></div><div class="summary-text"><p>${esc(r.verdict.summary)}${r.cover ? '' : ` <span class="muted">${r.pagesChecked ? `${r.pagesChecked} ${r.pagesChecked === 1 ? 'page' : 'pages'} checked.` : ''}</span>`}</p>
        ${r.cover && r.cover.length ? `<div class="cover"><span class="label">Which pages we checked, and why</span>${reasons(r.cover)}</div>` : ''}</div></div>
    </div>

    ${compareHtml(r)}

    ${r.why && r.why.length ? `<div class="card" id="sec-why">
      <div class="card-head"><h3>${hd('search', 'yellow')}What\u2019s behind the scores</h3><span class="muted">The main reasons each one is where it is</span></div>
      <div class="why">${r.why.map(w => `<div><h4>${dotted(htone(w.score), CAT_NAME[w.cat])}<b>${w.score}</b></h4>${w.lines.length ? reasons(w.lines) : `<p class="muted">${esc(w.fine)}</p>`}</div>`).join('')}</div>
    </div>` : ''}

    <div class="card" id="sec-speed">
      <div class="card-head"><h3>${hd('gauge', 'cyan')}Page speed</h3><span class="muted">Google Lighthouse test on mobile and desktop, ${fmt(r.date)}</span></div>
      ${any ? `<div class="speed2">
          <div><div class="chart-head"><span class="label">Speed by metric, score out of 100</span>${LEGEND}</div><div class="chart" id="chart-speed"></div></div>
          <div class="tablewrap"><table class="mini"><thead><tr><th>Measure</th><th>Mobile</th><th>Desktop</th></tr></thead><tbody>
            ${any.metrics.map((x, i) => `<tr><td><b>${x.name}</b> <span class="muted">${x.short}</span></td><td class="nw">${val(m, i)}</td><td class="nw">${val(d, i)}</td></tr>`).join('')}
            <tr><td><b>Page weight</b></td><td class="nw">${kb(m)}</td><td class="nw">${kb(d)}</td></tr>
          </tbody></table></div>
        </div>
        <div class="field-data">${f && f.lcp ? `<span><b>Real visitors</b>&nbsp;on Chrome, last 28 days${f.origin ? ' (whole site)' : ''}</span>
          <span><i class="dot ${fr(f.lcp)}"></i>Main content (LCP) <b>${(f.lcp.value / 1000).toFixed(1)} s</b></span>
          ${f.inp ? `<span><i class="dot ${fr(f.inp)}"></i>Responsiveness (INP) <b>${f.inp.value} ms</b></span>` : ''}
          ${f.cls ? `<span><i class="dot ${fr(f.cls)}"></i>Layout shift (CLS) <b>${(f.cls.value / 100).toFixed(2)}</b></span>` : ''}` : '<span>Google has no real-visitor data for this site yet, which usually means low traffic.</span>'}</div>
        ${fasterHtml(r)}` : `<p class="note">No speed data. ${esc(perr)}</p>`}
    </div>

    <div class="card" id="sec-activity">
      <div class="card-head"><h3>${hd('pulse', 'cyan')}Website activity</h3><span class="muted">How often new posts and pages go up</span></div>
      ${activityHtml(r)}
    </div>
    <div class="duo">
      <div class="card" id="sec-vitals"><div class="card-head"><h3>${hd('gauge', 'purple')}Core Web Vitals</h3><span class="muted">Google’s three checks of how the site feels</span></div>${vitalsHtml(r)}</div>
      <div class="card" id="sec-stability"><div class="card-head"><h3>${hd('check', 'yellow')}Stability</h3><span class="muted">Is it reliable, or likely to break?</span></div>${stabilityHtml(r, !!tn)}</div>
    </div>

    <div class="card" id="sec-seo">
      <div class="card-head"><h3>${hd('seo', 'purple')}SEO</h3><span class="muted">How easy it is for Google to find, read and rank</span></div>
      ${seoHtml(r)}
    </div>
    <div class="card" id="sec-post">
      <div class="card-head"><h3>${hd('search', 'pink')}Is this ${r.post && r.post.kind === 'page' ? 'page' : 'post'} SEO friendly?</h3><span class="muted">${r.post ? (r.post.kind === 'page' ? 'There’s no blog, so here’s the weakest page' : `The weakest of the ${many(r.post.sample, 'blog post')} we read`) : ''}</span></div>
      ${postHtml(r)}
    </div>

    <div class="card peek" id="sec-design">${mascot('inspect', 'sm')}
      <div class="card-head"><h3>${hd('layout', 'pink')}Design</h3><span class="muted">What looks dated or broken, and what would lift it</span></div>
      <div class="stack">
        <div><span class="label">Verdict</span><h4>${dotted(dz.tone, esc(dz.label))}</h4><p class="ink2" style="margin-top:10px">${esc(dz.note)}</p>
          ${r.palette && r.palette.length ? `<span class="label sub">Main colours on the first screen</span><div class="swatches">${r.palette.map(p => `<span><i style="background:${esc(p.hex)}"></i>${esc(p.hex.toUpperCase())}</span>`).join('')}</div>` : ''}
          <div id="ai">${aiHtml(r)}</div>
        </div>
        <div class="advice">${looks.length ? adviceHtml(looks) : `<p class="note">${dz.tone === 'info' ? 'No design findings.' : 'The checks found nothing dated or broken.'}</p>`}</div>
      </div>
      ${r.ideas && r.ideas.length ? `<div class="ideas"><h4>Ideas worth pitching</h4><p class="muted">Things this site doesn\u2019t have yet. They\u2019re suggestions, not faults, so they don\u2019t affect the score.</p><div class="idea-grid">${r.ideas.map(i => `<div><b>${esc(i.title)}</b><p>${esc(i.text)}</p></div>`).join('')}</div></div>` : ''}
    </div>

    <div class="card" id="sec-stack">
      <div class="card-head"><h3>${hd('layers', 'purple')}Tech stack</h3>${r.blocked ? '<span class="muted">The site blocked our reader, so details are limited</span>' : ''}</div>
      <div class="stack">
        <div>
          <span class="label">Can we take it? (internal)</span><h4>${dotted(r.fit.tone, r.fit.verdict)}</h4>${reasons(r.fit.reasons)}
          <span class="label sub">What this means for the client</span><h4>${dotted(v.tone, esc(v.title))}</h4>${reasons(v.reasons)}
          ${r.stack.tried ? `<span class="label sub">How we checked</span>${reasons(r.stack.tried)}` : ''}
        </div>
        <div class="tech">${groups.map(g => `<div class="g"><span>${g}</span><span>Confidence</span></div>` + r.stack.items.filter(i => i.group === g).map(i => `<div class="t">${techIcon(i.name, i.group)}<span>${esc(i.name)}${i.version ? ` <code>${esc(i.version)}</code>` : ''}</span><small>${i.note || i.status !== 'info' ? `<i class="dot ${i.status}"></i>` : ''}${esc(i.note)}</small><em>${i.conf}</em></div>`).join('')).join('')}</div>
      </div>
    </div>

    <div class="card peek" id="sec-strengths">${mascot('thumbs', 'sm')}
      <div class="card-head"><h3>${hd('check', 'yellow')}What is working well</h3><span class="muted">Keep these in any revamp</span></div>
      ${r.strengths.length ? `<ul class="goodlist">${r.strengths.map(x => `<li><i class="dot good"></i><span>${esc(x)}</span></li>`).join('')}</ul>` : '<p class="note">Nothing stood out as a strength on the things we can measure.</p>'}
    </div>

    <div class="card" id="sec-findings">
      <div class="card-head"><h3>${hd('list', 'pink')}Findings</h3><span class="muted" id="count"></span></div>
      <div class="tools">
        <label class="field">${icon('search')}<input id="q" type="search" placeholder="Search findings" aria-label="Search findings"></label>
        <label class="pill soft">Show: <select id="cat"><option value="all">All categories</option>${CATS.map(c => `<option value="${c}">${CAT_NAME[c]}</option>`).join('')}</select></label>
      </div>
      <div class="tablewrap"><table><thead><tr><th>Finding</th><th>Category</th><th>Severity</th><th>Found on</th><th>What we would do</th></tr></thead><tbody id="rows"></tbody></table></div>
      <button type="button" class="link more" id="more" hidden></button>
    </div>

    <div class="card peek" id="sec-steps">${mascot('run', 'sm')}
      <div class="card-head"><h3>${hd('flag', 'purple')}Recommended next steps</h3><span class="muted">Each one maps to a service package</span></div>
      <div class="steps3">${stepsHtml(r, true)}</div>
      ${budgetHtml(r)}
    </div>`;
  if (any) { drawChart($('#chart-scores'), scoreGroups(m, d), { labels: true, bw: 22 }); drawChart($('#chart-speed'), speedGroups(m, d)); }
  if (r.vs) drawChart($('#chart-vs'), vsGroups(r), VS_CHART);
  drawPost();
  drawRows();
  fresh('result'); floatIn();
}

function drawRows() {
  const q = S.q.toLowerCase();
  const list = S.result.issues.filter(f => (S.cat === 'all' || f.cat === S.cat) && (!q || (f.title + ' ' + f.detail + ' ' + f.fix).toLowerCase().includes(q)));
  const shown = S.more ? list : list.slice(0, 8);
  $('#rows').innerHTML = shown.map(f => `<tr><td><b>${esc(f.title)}</b><span class="d">${esc(f.detail)}</span></td><td>${CAT_NAME[f.cat]}</td><td class="nw">${dotted(SEV[f.sev], f.sev)}</td><td>${esc(f.where)}</td><td>${esc(f.fix)}</td></tr>`).join('')
    || `<tr><td colspan="5" class="empty">${S.result.issues.length ? `${mascot('shrug', 'sm')}Nothing matches that filter.` : `${mascot('thumbs', 'sm')}No issues found on the things we can measure.`}</td></tr>`;
  $('#count').textContent = `${list.length} ${list.length === 1 ? 'item' : 'items'}`;
  const more = $('#more'); more.hidden = list.length <= 8; more.textContent = S.more ? 'View less' : `View more (${list.length - 8})`;
}

// Grouped bars, mobile next to desktop, on a 0 to 100 scale. With labels the value sits on top of each bar;
// without, the values are in the tooltip and in the table beside the chart.
function chartGeo(n, o = {}) {
  const W = o.w || 520, Hh = 270, L = 34, R = 6, T = o.labels ? 24 : 14, B = 32, pw = W - L - R, ph = Hh - T - B;
  return { W, Hh, L, R, T, ph, gw: pw / n, bw: o.bw || 14, gap: o.labels ? 6 : 2, y: v => T + ph - (v / 100) * ph };
}
function chartSvg(groups, o = {}) {
  const G = chartGeo(groups.length, o), { W, Hh, L, R, T, ph, gw, bw, gap, y } = G;
  const bar = (x, p, k, i) => { if (!p || p.score == null) return ''; const h = Math.max(3, (p.score / 100) * ph), r = Math.min(4, h), yy = y(0) - h; return `<path class="bar ${k}" style="--i:${i}" d="M${x},${y(0)}V${yy + r}Q${x},${yy} ${x + r},${yy}H${x + bw - r}Q${x + bw},${yy} ${x + bw},${yy + r}V${y(0)}Z"/>${o.labels ? `<text class="val" style="--i:${i}" x="${x + bw / 2}" y="${yy - 6}" text-anchor="middle">${esc(p.display)}</text>` : ''}`; };
  let s = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Scores out of 100 for mobile and desktop">`;
  for (const t of [0, 50, 100]) s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${L - 10}" y="${y(t) + 4}" text-anchor="end">${t}</text>`;
  groups.forEach((g, i) => {
    const cx = L + gw * i + gw / 2;
    s += `<rect class="hit" data-i="${i}" x="${cx - gw / 2 + 6}" y="${T - 6}" width="${gw - 12}" height="${ph + 6}" rx="14"/>` + bar(cx - bw - gap / 2, g.m, 'm', i) + bar(cx + gap / 2, g.d, 'd', i)
      + `<text class="tick" x="${cx}" y="${Hh - 8}" text-anchor="middle">${esc(g.short)}</text>`;
  });
  return s + '</svg>';
}
function drawChart(el, groups, o = {}) {
  const { W, Hh, L, gw, y } = chartGeo(groups.length, o);
  el.innerHTML = chartSvg(groups, o) + '<div class="tip"></div>';
  const tip = $('.tip', el);
  const show = i => {
    const g = groups[i], top = Math.max((g.m && g.m.score) || 0, (g.d && g.d.score) || 0);
    tip.innerHTML = `<b>${esc(g.name)}</b>${g.m ? `<span><i class="dot m"></i>Mobile<em>${esc(g.m.display || '–')}</em></span>` : ''}${g.d ? `<span><i class="dot d"></i>Desktop<em>${esc(g.d.display || '–')}</em></span>` : ''}`;
    tip.style.left = ((L + gw * i + gw / 2) / W * 100) + '%';
    tip.style.top = `calc(${(y(top) / Hh * 100)}% - ${o.labels ? 26 : 10}px)`;
    tip.classList.add('on');
    el.querySelectorAll('.hit').forEach(x => x.classList.toggle('on', +x.dataset.i === i));
  };
  const hide = () => { tip.classList.remove('on'); el.querySelectorAll('.hit').forEach(x => x.classList.remove('on')); };
  el.addEventListener('pointermove', e => { const x = e.target.closest('.hit'); x ? show(+x.dataset.i) : hide(); });
  el.addEventListener('pointerleave', hide);
}

// ---------- small dialog (compare, summary, PDF options)
const modal = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'modal', className: 'modal', hidden: true })); // on <body>, so it is fixed to the window and not to the page
// Dialogs are sheets (see motion.js): they spring in, and on a phone they rise from the bottom edge and can be
// dragged down. modal.hidden still means "no dialog": it flips once the closing animation has finished.
let modalRun = 0;
function openModal(html) {
  modalRun++;
  modal.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><i class="grab" aria-hidden="true"></i>${html}</div>`;
  modal.hidden = false;
  moveThumbs(modal, true);
  sheetIn(modal);
  const f = modal.querySelector('input,textarea,select'); if (f && !narrow.matches) f.focus({ preventScroll: true });   // on a phone the keyboard waits until a field is tapped
}
function closeModal() {
  if (modal.hidden || modal.classList.contains('out')) return;
  const run = ++modalRun;
  sheetOut(modal, () => { if (run !== modalRun) return; modal.hidden = true; modal.innerHTML = ''; modal.classList.remove('out'); });
}
sheetDrag(modal, closeModal);
modal.addEventListener('mousedown', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

function act(name) {
  if (name === 'close') return closeModal();
  if (!S.result) return;
  if (name === 'rival') return rivalDialog();
  if (name === 'rival-remove') { closeModal(); delete S.result.vs; H.update(S.result).catch(e => toast(e.message)); S.sec = 'overview'; return render(); }
  if (name === 'summary') return summaryDialog('en');
  if (name === 'sum-en' || name === 'sum-bm') {
    const box = $('#sum-text'); if (!box) return summaryDialog(name.slice(4));
    box.value = summaryText(S.result, name.slice(4));
    modal.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.act === name));
    return moveThumbs(modal);
  }
  if (name === 'sum-copy') return copyText($('#sum-text').value);
  if (name === 'ai') return aiReview();
}

// ---------- competitor comparison
// The competitor gets the same full check. A slim copy of its numbers is kept on the client's result (r.vs).
const slim = c => {
  const m = good(c.psi.mobile), d = good(c.psi.desktop), lcp = (m ? m.metrics.find(x => x.id === 'largest-contentful-paint') : null) || {};
  return { domain: c.domain, date: c.date, health: c.health, perf: { m: m ? m.scores.performance : null, d: d ? d.scores.performance : null }, lcp: { display: lcp.display || '', value: lcp.value ?? null },
    weight: m && m.weight ? m.weight : null, platform: [c.stack.platform && c.stack.platform.name, c.stack.builder && c.stack.builder.name].filter(x => x && x !== 'Not detected').join(' with ') || 'Not detected',
    pages: c.pagesChecked || 0, serious: c.issues.filter(i => i.sev === 'Critical' || i.sev === 'High').length, design: c.design ? c.design.label : '' };
};
async function attachRival(client, rival) {
  client.vs = slim(rival);
  await H.update(client).catch(e => toast(e.message));
  open(client);
  S.sec = 'compare'; drawNav();
  const el = $('#sec-compare'); if (el) el.scrollIntoView({ block: 'start' });
}
function rivalDialog() {
  openModal(`<h3>Compare with a competitor</h3><p>Paste a competitor’s link. We run the same check on it and put the two side by side. It takes about as long as a normal scan.</p>
    <form id="rival-f" novalidate><label class="field">${icon('link')}<input id="rival-u" type="text" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="competitor.com.my" aria-label="Competitor website address"></label>
    <div class="sheet-foot">${S.result.vs ? '<button class="link" type="button" data-act="rival-remove">Remove the comparison</button>' : ''}<button class="btn soft" type="button" data-act="close">Cancel</button><button class="btn primary" type="submit">Run comparison</button></div></form>`);
}
const VS_CHART = { labels: true, bw: 20, w: 860 };
const SHORT = { Performance: 'Speed', SEO: 'SEO', Design: 'Design', Content: 'Content', Images: 'Images', Accessibility: 'Mobile', Security: 'Security' };
const vsGroups = (r, T = x => x) => { const b = r.vs, g = (short, name, x, y) => ({ short: T(short), name: T(name), m: { score: x, display: String(x ?? '–') }, d: { score: y, display: String(y ?? '–') } }); return [g('Overall', 'Overall health', r.health.score, b.health.score), ...CATS.map(c => g(SHORT[c], CAT_NAME[c], r.health.sub[c], b.health.sub[c]))]; };
// Where each side is ahead, as short sentences. A gap under 8 points is treated as level.
function versus(r) {
  const a = slim(r), b = r.vs, mine = [], theirs = [];
  for (const c of CATS) { const x = a.health.sub[c], y = b.health.sub[c]; if (x == null || y == null || Math.abs(x - y) < 8) continue; (x > y ? mine : theirs).push({ cat: c, x, y }); }
  const lcp = a.lcp.value && b.lcp.value && Math.abs(a.lcp.value - b.lcp.value) > 800 ? { ahead: a.lcp.value < b.lcp.value, x: a.lcp.display, y: b.lcp.display } : null;
  return { a, b, mine, theirs, lcp };
}
const vsLine = (k, T = x => x) => `${T(CAT_NAME[k.cat])}: ${k.x} ${T('against')} ${k.y}`;
function vsTable(r, T = x => x) {
  const { a, b } = versus(r), kb = weightText, sc = (s, t = tone) => (s == null ? '–' : dotted(t(s), s));
  const row = (label, x, y) => `<tr><td><b>${T(label)}</b></td><td>${x}</td><td>${y}</td></tr>`;
  return `<table class="mini vs"><thead><tr><th></th><th>${esc(a.domain)}</th><th>${esc(b.domain)}</th></tr></thead><tbody>
    ${row('Website health', sc(a.health.score, htone), sc(b.health.score, htone))}${row('Speed on phones', sc(a.perf.m), sc(b.perf.m))}${row('Speed on computers', sc(a.perf.d), sc(b.perf.d))}
    ${row('Main content shows up (phones)', esc(a.lcp.display || '–'), esc(b.lcp.display || '–'))}${row('Homepage weight', kb(a.weight), kb(b.weight))}
    ${row('Built with', esc(a.platform.split(' with ').map(T).join(` ${T('with')} `)), esc(b.platform.split(' with ').map(T).join(` ${T('with')} `)))}${row('Design', esc(T(a.design || '–')), esc(T(b.design || '–')))}${row('Serious issues', a.serious, b.serious)}${row('Pages checked', a.pages, b.pages)}</tbody></table>`;
}
function compareHtml(r) {
  if (!r.vs) return '';
  const k = versus(r), list = (xs, extra) => { const all = [...xs.map(x => vsLine(x)), ...(extra ? [extra] : [])]; return all.length ? reasons(all) : '<p class="muted">Nothing clearly ahead.</p>'; };
  const speed = k.lcp ? `On phones, the main content shows up in ${k.lcp.x} on ${r.domain} and ${k.lcp.y} on ${r.vs.domain}` : '';
  return `<div class="card" id="sec-compare">
    <div class="card-head"><h3>${hd('versus', 'cyan')}Compared with ${esc(r.vs.domain)}</h3><span class="muted">Same check on both, ${fmt(r.vs.date)}</span></div>
    <div class="chart-head"><span class="label">Health scores, out of 100</span><div class="legend"><span><i class="dot m"></i>${esc(r.domain)}</span><span><i class="dot d"></i>${esc(r.vs.domain)}</span></div></div>
    <div class="chart wide" id="chart-vs"></div>
    <div class="tablewrap" style="margin-top:18px">${vsTable(r)}</div>
    <div class="vs2"><div><h4>Where ${esc(r.domain)} is ahead</h4>${list(k.mine, k.lcp && k.lcp.ahead ? speed : '')}</div><div><h4>Where ${esc(r.vs.domain)} is ahead</h4>${list(k.theirs, k.lcp && !k.lcp.ahead ? speed : '')}</div></div>
    <p class="muted" style="margin-top:14px">Both sites got the same checks, so the numbers are fair to put side by side. Speed scores move a few points between runs, so treat small gaps as level.</p>
  </div>`;
}

// ---------- summary to copy (WhatsApp or email), English or Bahasa Malaysia
function summaryText(r, lang) {
  const bm = lang === 'bm', T = x => (bm ? tr(x) : x), L = [];
  // The three biggest findings, one per category so the message isn't three lines about the same thing, and what we'd do about each.
  const top = [];
  for (const i of r.issues) { if (i.tip || top.some(t => t.cat === i.cat)) continue; top.push(i); if (top.length === 3) break; }
  const steps = [...new Set(top.map(i => i.fix))].map(text => ({ text }));
  L.push(bm ? `Hai, kami sudah semak laman web ${r.domain}. Ini ringkasannya:` : `Hi, we had a look at ${r.domain}. Here’s a quick summary:`, '');
  if (r.health.score != null) L.push(bm ? `Skor kesihatan laman web: ${r.health.score} daripada 100 (${T(r.verdict.label)}).` : `Website health score: ${r.health.score} out of 100 (${r.verdict.label}).`);
  if (top.length) { L.push('', bm ? 'Perkara utama yang kami perasan:' : 'The main things we noticed:'); top.forEach((i, n) => L.push(`${n + 1}. ${T(i.title)}. ${T(i.detail)}`)); }
  if (r.strengths.length) { L.push('', bm ? 'Apa yang sudah bagus:' : 'What’s already working well:'); r.strengths.slice(0, 3).forEach(x => L.push(`- ${T(x)}`)); }
  if (r.vs && r.vs.health.score != null && r.health.score != null) L.push('', bm ? `Berbanding ${r.vs.domain}: skor mereka ${r.vs.health.score}, skor anda ${r.health.score}.` : `Next to ${r.vs.domain}: they score ${r.vs.health.score}, you score ${r.health.score}.`);
  if (steps.length) { L.push('', bm ? 'Cadangan kami:' : 'What we’d suggest:'); steps.forEach(x => L.push(`- ${T(x.text)}`)); }
  L.push('', bm ? 'Laporan penuh sudah siap. Bila masa yang sesuai untuk kami terangkan?' : 'The full report is ready. When’s a good time to walk you through it?');
  return L.join('\n');
}
function summaryDialog(lang) {
  openModal(`${mascot('wave', 'sm', 'sheet-buddy')}<h3>Summary to send</h3><p>A short message for WhatsApp or email. Change anything you like, then copy it.</p>
    <div class="seg"><button type="button" data-act="sum-en" class="${lang === 'en' ? 'on' : ''}">English</button><button type="button" data-act="sum-bm" class="${lang === 'bm' ? 'on' : ''}">Bahasa Malaysia</button></div>
    <textarea id="sum-text" rows="15" spellcheck="false">${esc(summaryText(S.result, lang))}</textarea>
    <div class="sheet-foot"><button class="btn soft" type="button" data-act="close">Close</button><button class="btn primary" type="button" data-act="sum-copy">${icon('copy')}Copy</button></div>`);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch { const t = $('#sum-text'); if (t) { t.select(); document.execCommand('copy'); } }
  closeModal(); toast('Copied. Paste it into WhatsApp or email.', 'thumbs');
}

// ---------- AI design opinion (optional: only shown when the Worker has a Claude API key)
// Screenshots are redrawn as JPEG first. The long phone screenshot is cut into two pieces so the detail survives.
async function shotsForAi(r) {
  const m = good(r.psi.mobile) || {}, d = good(r.psi.desktop) || {}, out = [];
  const add = async (label, src, y0 = 0, hMax = 1600) => {
    if (!src) return;
    try {
      const img = new Image(); img.src = src; await img.decode();
      const hh = Math.min(hMax, img.naturalHeight - y0); if (hh < 80) return;
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = hh;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, hh); x.drawImage(img, 0, y0, img.naturalWidth, hh, 0, 0, img.naturalWidth, hh);
      out.push({ label, data: c.toDataURL('image/jpeg', 0.82) });
    } catch { /* skip a screenshot that will not load */ }
  };
  await add('Desktop, first screen', d.shot);
  if (m.full) { await add('Phone, top of the page', m.full, 0, 1500); await add('Phone, further down the page', m.full, 1500, 1500); } else await add('Phone, first screen', m.shot);
  return out;
}
const AI_CALL = { fresh: 'Looks fresh', okay: 'Looks okay', dated: 'Looks dated' };
function aiHtml(r) {
  if (r.ai && r.ai.review) {
    const a = r.ai.review;
    return `<span class="label sub">AI design opinion</span><div class="aibox"><p><b>${esc(AI_CALL[a.dated] || 'Overall')}.</b> ${esc(a.impression)}</p>
      ${(a.points || []).map(p => `<div class="adv"><b>${esc(p.area)}</b><p>${esc(p.saw)}</p><p class="fix">${esc(p.do)}</p></div>`).join('')}
      <p class="pitch"><b>A way to open the conversation:</b> ${esc(a.pitch)}</p>
      <p class="muted small">${r.ai.sample ? 'This is a made-up sample for the local preview, not a real opinion.' : 'Written by AI from the screenshots. Read it through before you use it.'}</p></div>`;
  }
  if (!ME.ai) return '';
  const has = [r.psi.mobile, r.psi.desktop].some(p => good(p) && (p.shot || p.full));
  return `<span class="label sub">AI design opinion</span><p class="muted small">Our checks can’t judge taste. The AI looks at the screenshots and gives an opinion the way a designer would. Each one costs about 30 sen.</p>
    ${has ? `<button class="btn soft" type="button" data-act="ai">${icon('spark')}Ask AI about the design</button>` : '<p class="muted small">The screenshots aren’t kept with saved scans. Scan the site again, then ask.</p>'}`;
}
async function aiReview() {
  const r = S.result, box = $('#ai'); if (!box || r.aiBusy) return;
  r.aiBusy = true;
  box.innerHTML = '<span class="label sub">AI design opinion</span><p class="muted small">Looking at the screenshots. This takes about half a minute.</p>';
  try {
    const shots = await shotsForAi(r);
    if (!shots.length) throw new Error('There are no screenshots to look at. Scan the site again first.');
    const facts = { domain: r.domain, built: (r.stack.items.find(i => i.group === 'Platform') || {}).name || '', found: r.issues.filter(i => i.cat === 'Design').map(i => i.title).slice(0, 12) };
    const res = locked(await fetch('/api/design-review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ shots, facts }) })), j = await res.json().catch(() => null);
    if (!res.ok || !j || !j.review) throw new Error((j && j.error) || 'The AI opinion did not come back. Try again in a moment.');
    r.ai = { review: j.review, sample: !!j.sample, date: new Date().toISOString() };
    H.update(r).catch(() => {});
  } catch (e) { toast(e.message); }
  r.aiBusy = false;
  if (S.result === r && $('#ai')) $('#ai').innerHTML = aiHtml(r);
}

// ---------- report options: who it is for, who prepared it, the language of the client version, and the file type
// Each file type: [name, what it is, button text].
const FORMATS = {
  pdf: ['PDF', 'Opens the print window. Choose \u201cSave as PDF\u201d there.', 'Create PDF'],
  pptx: ['PowerPoint', 'A slide deck you can open in PowerPoint, Keynote or Google Slides, then edit and present.', 'Download slides'],
  html: ['Web page', 'One file that opens in any browser, on a phone too. Easy to attach to an email.', 'Download web page'],
};
function pdfDialog(mode) {
  if (!S.result) return;
  let by = '', fmt = 'pdf'; try { by = localStorage.getItem('sensecheck.by') || ''; fmt = localStorage.getItem('sensecheck.fmt') || 'pdf'; } catch { /* storage unavailable */ }
  if (!FORMATS[fmt]) fmt = 'pdf';
  openModal(`${mascot('clipboard', 'sm', 'sheet-buddy')}<h3>${mode === 'internal' ? 'Internal report' : 'Client report'}</h3><p>${mode === 'internal' ? 'For our own team. It includes versions, the skills check and service packages, so don\u2019t send it to the client.' : 'Safe to send to the client.'} The names are optional and go on the cover.</p>
    <form id="pdf-f" data-mode="${mode}" novalidate>
      <label class="lab">Prepared for<input id="pdf-for" type="text" placeholder="Client or company name" autocomplete="off" value="${esc(S.result.clientName || '')}"></label>
      <label class="lab">Prepared by<input id="pdf-by" type="text" placeholder="Your name" autocomplete="off" value="${esc(by)}"></label>
      ${mode === 'client' ? '<label class="lab">Language<select id="pdf-lang"><option value="en">English</option><option value="bm">Bahasa Malaysia</option></select></label>' : ''}
      <div class="pickrow"><span>File type</span><div class="seg pick" role="radiogroup" aria-label="File type">${Object.entries(FORMATS).map(([k, x]) => `<label><input type="radio" name="fmt" value="${k}"${k === fmt ? ' checked' : ''}>${x[0]}</label>`).join('')}</div><p id="fmt-hint">${FORMATS[fmt][1]}</p></div>
      <div class="sheet-foot"><button class="btn soft" type="button" data-act="close">Cancel</button><button class="btn primary" type="submit" id="fmt-go">${icon('down')}${FORMATS[fmt][2]}</button></div></form>`);
}

// ---------- PDF report (print layout). mode: 'client' to share, 'internal' adds skills fit, versions and packages.
// o.client and o.by go on the cover page. o.lang 'bm' gives the client report in Bahasa Malaysia: fixed labels are
// written here with W(english, malay) and everything the checks wrote goes through tr() from bm.js.
function buildReport(mode, o = {}) {
  const r = S.result, m = good(r.psi.mobile), d = good(r.psi.desktop), v = r.stack.verdict, h = r.health, int = mode === 'internal', dz = designOf(r);
  const bm = !int && o.lang === 'bm', T = x => (bm ? tr(x) : x), W = (en, my) => (bm ? my : en);
  const day = iso => new Date(iso).toLocaleDateString(bm ? 'ms-MY' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const cell = (s, t = tone) => (s == null ? '–' : dotted(t(s), s));
  const main = g => r.stack.items.filter(i => i.group === g && !/^Not detected|^PHP version/.test(i.name)).map(i => i.name);
  const built = [...main('Platform'), ...main('Page builder')].join(W(' and ', ' dan ')), theme = main('Theme')[0], host = main('Hosting').filter(x => x !== 'PHP').join(', ');
  const SEVN = { Critical: 'Kritikal', High: 'Tinggi', Medium: 'Sederhana', Low: 'Rendah' }, sev = s => W(s, SEVN[s]);
  const R = 54, C = 2 * Math.PI * R;
  const ring = `<svg viewBox="0 0 140 140" class="rp-ring" aria-hidden="true"><circle cx="70" cy="70" r="${R}" class="track"/><circle cx="70" cy="70" r="${R}" class="arc ${htone(h.score)}" stroke-dasharray="${(C * (h.score || 0) / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 70 70)"/><text x="70" y="79" text-anchor="middle" class="num">${h.score ?? '–'}</text><text x="70" y="99" text-anchor="middle" class="of">${W('out of 100', 'daripada 100')}</text></svg>`;
  const meta = [[W('Prepared for', 'Disediakan untuk'), o.client], [W('Prepared by', 'Disediakan oleh'), o.by ? `${o.by}, MYSense` : 'MYSense'], [W('Date', 'Tarikh'), day(r.date)], [W('Pages checked', 'Halaman disemak'), r.pagesChecked || '']].filter(x => x[1]);
  // Why lines: speed lines come from the scan; the other categories are rebuilt from the findings so they translate cleanly.
  const whyLines = w => (w.cat === 'Performance' || !bm ? w.lines.map(T) : r.issues.filter(i => i.cat === w.cat).slice(0, 3).map(i => `${T(i.title)}. ${T(i.detail)}`));
  const groupNames = bm ? [['quick', 'Pembaikan pantas'], ['revamp', 'Kerja rombakan'], ['maintenance', 'Penyelenggaraan berterusan']] : GROUPS;
  const vs = r.vs ? versus(r) : null, vsList = (xs, extra) => { const all = [...xs.map(x => vsLine(x, T)), ...(extra ? [extra] : [])]; return all.length ? reasons(all) : `<p>${W('Nothing clearly ahead.', 'Tiada yang jelas mendahului.')}</p>`; };
  const vsSpeed = vs && vs.lcp ? W(`On phones, the main content shows up in ${vs.lcp.x} on ${r.domain} and ${vs.lcp.y} on ${r.vs.domain}`, `Di telefon, kandungan utama muncul dalam ${vs.lcp.x} di ${r.domain} dan ${vs.lcp.y} di ${r.vs.domain}`) : '';
  const looks = r.issues.filter(i => i.cat === 'Design'), faster = speedPlan(r), sh = shotsOf(r, !int), tn = testNote(r);
  $('#report').innerHTML = `
    <section class="rp-cover">
      <div class="rp-band"></div>
      <img class="rp-cover-logo" src="img/mysense-light.png" alt="MYSense">
      <p class="rp-kicker">${int ? 'Internal website audit' : W('Website health report', 'Laporan kesihatan laman web')}</p>
      <h1>${esc(r.domain)}</h1>
      <div class="rp-score">${ring}<div><p class="rp-verdict">${dotted(r.verdict.tone, esc(T(r.verdict.label)))}</p><p>${W('Overall website health, from speed, search, design, content, images, mobile and security checks.', 'Kesihatan keseluruhan laman web, berdasarkan semakan kelajuan, carian, reka bentuk, kandungan, imej, mudah alih dan keselamatan.')}</p></div></div>
      <table class="rp-meta"><tbody>${meta.map(([k, x]) => `<tr><td>${k}</td><td>${esc(x)}</td></tr>`).join('')}</tbody></table>
      ${int ? '<p class="rp-conf">For MYSense staff only. Please don’t send this version to the client.</p>' : ''}
    </section>

    <div class="rp-head">${LOGO}SenseCheck<span>${int ? 'Internal website audit' : W('Website health report', 'Laporan kesihatan laman web')}, ${day(r.date)}</span></div>
    <h1>${esc(r.domain)}</h1>
    <p class="rp-verdict">${dotted(r.verdict.tone, esc(T(r.verdict.label)))}</p>
    <p class="rp-sum">${esc(T(r.verdict.summary))}</p>
    ${r.read ? `<div class="rp-box" style="margin-top:12pt"><h3>${W(r.read.level === 'blocked' ? 'Part of this report is limited' : 'A note on this report', 'Nota tentang laporan ini')}</h3>${bm ? '<p>Sebahagian laman web ini tidak dapat dibaca sepenuhnya oleh alat semakan kami, jadi beberapa bahagian laporan ini terhad.</p>' : `<p><b>${esc(r.read.title)}.</b> ${esc(r.read.why)}</p>`}${int ? `<p><b>What to do:</b> ${esc(r.read.next)}</p>` : ''}</div>` : ''}
    ${tn ? `<div class="rp-box" style="margin-top:12pt"><h3>${int ? esc(tn.title) : W('A note on the speed results', 'Nota tentang keputusan kelajuan')}</h3><p>${esc(int ? tn.why : W(tn.client[0], tn.client[1]))}</p>${int ? `<p><b>What to do:</b> ${esc(tn.next)}</p>` : ''}</div>` : ''}
    ${int ? `<div class="rp-box" style="margin-top:12pt"><h3>Can we take it? ${dotted(r.fit.tone, r.fit.verdict)}</h3>${reasons(r.fit.reasons)}</div>` : ''}
    <div class="rp-top">
      ${sh.d || sh.m ? `<div class="shots">${sh.d ? `<img src="${esc(sh.d)}" alt="">` : ''}${sh.m ? `<img src="${esc(sh.m)}" alt="">` : ''}</div>` : ''}
      <div class="scores"><table><thead><tr><th>${W('Website health', 'Kesihatan laman web')}</th><th>${W('Score out of 100', 'Skor daripada 100')}</th></tr></thead><tbody>
        <tr><td><b>${W('Overall', 'Keseluruhan')}</b></td><td><b>${cell(h.score, htone)}</b></td></tr>
        ${CATS.map(c => `<tr><td>${T(CAT_NAME[c])}</td><td>${h.sub[c] == null ? W('Not measured', 'Tidak diukur') : cell(h.sub[c], htone)}</td></tr>`).join('')}
      </tbody></table></div>
    </div>
    ${r.cover && r.cover.length ? `<p class="rp-note"><b>${W('Which pages we checked.', 'Halaman yang kami semak.')}</b> ${r.cover.map(x => esc(T(x))).join(' ')}</p>` : ''}

    ${r.why && r.why.some(w => w.lines.length) ? `<h2>${W('What’s behind the scores', 'Sebab di sebalik skor')}</h2><div class="rp-why">${r.why.filter(w => w.lines.length).map(w => `<p><b>${T(CAT_NAME[w.cat])} (${w.score}).</b> ${whyLines(w).map(esc).join(' ')}</p>`).join('')}</div>` : ''}

    ${vs ? `<h2>${W('How it compares with', 'Perbandingan dengan')} ${esc(r.vs.domain)}</h2>
      <div class="rp-vs"><p class="rp-cap">${W('Health scores, out of 100', 'Skor kesihatan, daripada 100')}</p><div class="chart">${chartSvg(vsGroups(r, T), VS_CHART)}</div></div>
      <p class="rp-legend"><i class="dot m"></i>${esc(r.domain)} &nbsp; <i class="dot d"></i>${esc(r.vs.domain)}</p>
      ${vsTable(r, T)}
      <div class="rp-cols two"><div><h4>${W('Where', 'Di mana')} ${esc(r.domain)} ${W('is ahead', 'mendahului')}</h4>${vsList(vs.mine, vs.lcp && vs.lcp.ahead ? vsSpeed : '')}</div><div><h4>${W('Where', 'Di mana')} ${esc(r.vs.domain)} ${W('is ahead', 'mendahului')}</h4>${vsList(vs.theirs, vs.lcp && !vs.lcp.ahead ? vsSpeed : '')}</div></div>` : ''}

    <h2>${W('Page speed', 'Kelajuan halaman')}</h2>
    ${m || d ? `<div class="rp-charts"><div><p class="rp-cap">${W('Scores by device', 'Skor mengikut peranti')}</p><div class="chart">${chartSvg(scoreGroups(m, d).map(g => ({ ...g, short: T(g.short) })), { labels: true, bw: 22 })}</div></div><div><p class="rp-cap">${W('Speed by metric, score out of 100', 'Kelajuan mengikut ukuran, skor daripada 100')}</p><div class="chart">${chartSvg(speedGroups(m, d))}</div></div></div>
      <p class="rp-legend"><i class="dot m"></i>${W('Mobile', 'Telefon')} &nbsp; <i class="dot d"></i>${W('Desktop', 'Komputer')}</p>` : ''}
    ${m || d ? `<table><thead><tr><th>${W('Measure', 'Ukuran')}</th><th>${W('Mobile', 'Telefon')}</th><th>${W('Desktop', 'Komputer')}</th></tr></thead><tbody>
      ${LH.map(([k, n]) => `<tr><td><b>${T(n + ' score')}</b></td><td>${cell(m ? m.scores[k] : null)}</td><td>${cell(d ? d.scores[k] : null)}</td></tr>`).join('')}
      ${(m || d).metrics.map((x, i) => `<tr><td>${T(x.name)} <span class="d">(${x.short})</span></td><td>${m ? dotted(tone(m.metrics[i].score), esc(m.metrics[i].display)) : '–'}</td><td>${d ? dotted(tone(d.metrics[i].score), esc(d.metrics[i].display)) : '–'}</td></tr>`).join('')}
    </tbody></table>` : `<p>${W('The speed test could not be completed for this site.', 'Ujian kelajuan tidak dapat disiapkan untuk laman ini.')}</p>`}
    ${m && m.field && m.field.lcp ? `<p class="rp-sum">${W(`Real visitors on Chrome over the last 28 days: main content appears in ${(m.field.lcp.value / 1000).toFixed(1)} s${m.field.overall ? `, rated ${{ FAST: 'fast', AVERAGE: 'average', SLOW: 'slow' }[m.field.overall] || 'unrated'} overall` : ''}.`, `Pelawat sebenar di Chrome dalam 28 hari lepas: kandungan utama muncul dalam ${(m.field.lcp.value / 1000).toFixed(1)} s${m.field.overall ? `, dinilai ${{ FAST: 'pantas', AVERAGE: 'sederhana', SLOW: 'perlahan' }[m.field.overall] || 'belum dinilai'} secara keseluruhan` : ''}.`)}</p>` : ''}

    ${faster ? `<h2>${W('How to make it faster', 'Cara menjadikannya lebih pantas')}</h2><p class="rp-sum">${esc(T(faster.lead))}</p>
      ${faster.steps.length ? `<div class="rp-area rp-plan">${faster.steps.map((x, i) => `<p><b>${esc(T(x.title))}</b> <span class="d">(${esc([i === 0 ? T('Start here') : '', T(x.effort)].filter(Boolean).join(', '))})</span><br>${esc(T(x.why))} <i>${esc(T(x.how))}</i>${x.gain ? ` ${esc(T(x.gain))}` : ''}</p>`).join('')}</div>` : ''}
      ${faster.note ? `<p class="rp-note">${esc(T(faster.note))}</p>` : ''}` : ''}

    ${extraReport(r, int, bm, tn)}

    <h2>${W('Design', 'Reka bentuk')}</h2>
    <div class="rp-box"><h3>${dotted(dz.tone, esc(T(dz.label)))}</h3><p>${esc(int ? dz.note : W('This comes from our checks for design that looks dated or broken.', 'Ini berdasarkan semakan kami terhadap reka bentuk yang nampak ketinggalan zaman atau rosak.'))}</p>
      ${r.palette && r.palette.length ? `<p class="rp-swatches">${W('Main colours on the first screen:', 'Warna utama pada skrin pertama:')} ${r.palette.map(p => `<span><i style="background:${esc(p.hex)}"></i>${esc(p.hex.toUpperCase())}</span>`).join('')}</p>` : ''}</div>
    ${looks.length ? AREAS.map(a => { const list = looks.filter(x => areaOf(x) === a); return list.length ? `<div class="rp-area"><h4>${T(a)}</h4>${list.map(x => `<p><b>${esc(T(x.title))}.</b> ${esc(T(x.detail))} <i>${esc(T(x.fix))}</i></p>`).join('')}</div>` : ''; }).join('') : ''}
    ${int && r.ai && r.ai.review && !r.ai.sample ? `<div class="rp-box" style="margin-top:10pt"><h3>AI design opinion: ${esc(AI_CALL[r.ai.review.dated] || '')}</h3><p>${esc(r.ai.review.impression)}</p>${reasons((r.ai.review.points || []).map(p => `${p.area}: ${p.saw} ${p.do}`))}<p><b>A way to open the conversation:</b> ${esc(r.ai.review.pitch)}</p></div>` : ''}
    ${r.ideas && r.ideas.length ? `<h2>${W('More ideas worth considering', 'Idea lain yang wajar dipertimbangkan')}</h2><div class="rp-ideas">${r.ideas.map(i => `<p><b>${esc(T(i.title))}.</b> ${esc(T(i.text))}</p>`).join('')}</div>` : ''}

    <h2>${W('What is working well', 'Apa yang sudah bagus')}</h2>
    ${r.strengths.length ? `<ul class="rp-good">${r.strengths.map(x => `<li>${esc(T(x))}</li>`).join('')}</ul>` : `<p>${W('Nothing stood out as a strength on the things we can measure.', 'Tiada kekuatan yang menonjol pada perkara yang kami boleh ukur.')}</p>`}

    <h2>${W('What we found', 'Apa yang kami temui')}</h2>
    ${looks.length ? `<p class="rp-note">${W('Design findings are in the Design section above, so they are not repeated here.', 'Penemuan reka bentuk ada dalam bahagian Reka bentuk di atas, jadi ia tidak diulang di sini.')}</p>` : ''}
    ${r.issues.length ? `<table><thead><tr><th>${W('Finding', 'Penemuan')}</th><th>${W('Severity', 'Tahap')}</th><th>${W('Found on', 'Ditemui di')}</th><th>${W('What we would do', 'Apa yang kami akan buat')}</th></tr></thead><tbody>
      ${r.issues.filter(f => f.cat !== 'Design').map(f => `<tr><td style="width:40%"><b>${esc(T(f.title))}</b><br><span class="d">${esc(T(f.detail))}</span></td><td>${dotted(SEV[f.sev], sev(f.sev))}</td><td>${esc(T(f.where))}</td><td>${esc(T(f.fix))}</td></tr>`).join('')}</tbody></table>` : `<p>${W('No issues found on the things we can measure.', 'Tiada isu ditemui pada perkara yang kami boleh ukur.')}</p>`}

    <h2>${W('Technology', 'Teknologi')}</h2>
    ${int ? '' : `<p>${built ? W(`The site runs on ${esc(built)}${theme ? `, using the ${esc(theme)} theme` : ''}.`, `Laman ini dibina dengan ${esc(built)}${theme ? `, menggunakan tema ${esc(theme)}` : ''}.`) : W('The platform could not be detected from the public pages.', 'Platform tidak dapat dikesan daripada halaman awam.')}${host ? ` ${W('Hosting', 'Pengehosan')}: ${esc(host)}.` : ''}</p>`}
    <div class="rp-box" style="margin-top:8pt"><h3>${esc(T(v.title))}</h3>${reasons(v.reasons.map(T))}</div>
    ${int && r.stack.tried ? `<p class="rp-cap" style="margin-top:8pt">How we checked</p>${reasons(r.stack.tried)}` : ''}
    ${int && r.stack.items.length ? `<table style="margin-top:10pt"><thead><tr><th>Component</th><th>Type</th><th>Version</th><th>Status</th><th>Confidence</th></tr></thead><tbody>
      ${r.stack.items.map(i => `<tr><td><span class="plat">${techIcon(i.name, i.group)}<b>${esc(i.name)}</b></span></td><td>${i.group}</td><td>${esc(i.version || '–')}</td><td>${i.note ? dotted(i.status, esc(i.note)) : ''}</td><td>${i.conf}</td></tr>`).join('')}</tbody></table>` : ''}

    <h2>${W('Recommended next steps', 'Langkah seterusnya yang disyorkan')}</h2>
    <div class="rp-cols">${stepsHtml(r, int, T, groupNames)}</div>
    ${int ? budgetHtml(r) : ''}
    <p class="rp-foot"><img class="rp-logo" src="img/mysense-light.png" alt="MYSense">${W(`Prepared by MYSense, mysense.com.my. ${r.pagesChecked ? `${r.pagesChecked} public ${r.pagesChecked === 1 ? 'page was' : 'pages were'} checked on ${day(r.date)}. ` : ''}Speed scores come from Google PageSpeed Insights (Lighthouse); lab results vary slightly between runs. Technology is read from public page code, so hidden components may not appear.`,
      `Disediakan oleh MYSense, mysense.com.my. ${r.pagesChecked ? `${r.pagesChecked} halaman awam disemak pada ${day(r.date)}. ` : ''}Skor kelajuan datang daripada Google PageSpeed Insights (Lighthouse); keputusan makmal berbeza sedikit antara ujian. Teknologi dibaca daripada kod halaman awam, jadi komponen tersembunyi mungkin tidak kelihatan.`)}</p>`;
}
// Website activity, Core Web Vitals, stability, the SEO score and the close look at one post, for the reports.
function extraReport(r, int, bm, trouble) {
  const lang = bm ? 'bm' : 'en', W = (en, my) => (bm ? my : en), day = iso => new Date(iso).toLocaleDateString(bm ? 'ms-MY' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  let out = '';
  const A = r.activity;
  if (A && A.source) {
    const a = activityOf(r, lang);
    out += `<h2>${W('Website activity', 'Aktiviti laman web')}</h2><div class="rp-act"><div><p class="rp-verdict">${dotted(a.tone, esc(a.label))}</p><p class="rp-sum">${esc(a.line)}</p>
      <div class="rp-tiles"><p>${W('New posts, last 12 months', 'Artikel baharu, 12 bulan lepas')}<b>${a.posts12}</b></p><p>${W('Last new post', 'Artikel baharu terakhir')}<b>${A.lastPost ? day(A.lastPost) : W('None', 'Tiada')}</b></p><p>${W('New pages, last 3 months', 'Halaman baharu, 3 bulan lepas')}<b>${a.newPages}</b></p></div></div>
      <div><p class="rp-cap">${W('New each month', 'Baharu setiap bulan')}</p><div class="chart">${countSvg(A.months, lang)}</div><p class="rp-legend"><i class="dot m"></i>${W('Posts', 'Artikel')} &nbsp; <i class="dot d"></i>${W('Pages', 'Halaman')}</p></div></div>
      ${A.recent && A.recent.length ? `<p class="rp-list"><b>${W('New in the last 3 months:', 'Baharu dalam 3 bulan lepas:')}</b> ${A.recent.slice(0, 5).map(p => `${esc(p.title || new URL(p.url).pathname)} (${day(p.date)})`).join('; ')}.</p>` : ''}
      ${A.source === 'sitemap' ? `<p class="rp-note">${W('Dates come from the sitemap, so they show when a page last changed.', 'Tarikh diambil daripada peta laman, jadi ia menunjukkan bila halaman terakhir diubah.')}</p>` : ''}`;
  }
  const c = cwvOf(r, lang), st = r.stab ? stabilityOf(r, lang, trouble) : null;
  if (c.items.length || st) {
    out += `<div class="rp-two" style="margin-top:16pt">`;
    if (c.items.length) out += `<div class="rp-box"><h3>Core Web Vitals: ${dotted(c.tone, esc(c.label))}</h3><p>${esc(c.line)}</p><ul>${c.items.map(i => `<li>${esc(i.name)}: <b>${esc(i.value)}</b>, ${toneWord(i.tone, lang).toLowerCase()} (${W('good is', 'baik jika')} ${esc(i.aim)})</li>`).join('')}</ul>
      ${r.crux ? `<p class="rp-cap" style="margin-top:6pt">${W('Last 6 months, real visitors on phones', '6 bulan lepas, pelawat sebenar di telefon')}</p><div class="rp-trend">${trendSvg(r.crux, lang)}</div>` : ''}</div>`;
    if (st) out += `<div class="rp-box"><h3>${W('Stability', 'Kestabilan')}: ${dotted(st.tone, esc(st.label))}</h3><p>${esc(st.line)}</p><ul>${st.rows.map(x => `<li>${dotted(x.tone, esc(x.text))}</li>`).join('')}</ul></div>`;
    out += '</div>';
  }
  const o = seoOf(r, lang);
  if (o) {
    out += `<h2>${W('SEO score', 'Skor SEO')}: ${o.score} ${W('out of 100', 'daripada 100')}</h2><p class="rp-verdict">${dotted(o.tone, esc(o.label))}</p>
      <table class="rp-seo" style="margin-top:6pt"><tbody>${o.parts.filter(p => p.score != null).map(p => `<tr><td><b>${esc(p.name)}</b></td><td>${dotted(htone(p.score), p.score)}</td><td>${esc(p.line)}</td></tr>`).join('')}</tbody></table>`;
  }
  const p = r.post;
  if (p) {
    const fails = postChecks(p, lang).filter(x => !x.ok).sort((a, b) => b.w - a.w).slice(0, 6), word = p.kind === 'page' ? W('page', 'halaman') : W('post', 'artikel');
    out += `<h2>${W(`A closer look at one ${word}`, `Melihat lebih dekat satu ${word}`)}</h2>
      <p class="rp-sum">${p.kind === 'page' ? W('There’s no blog, so we looked at the weakest page.', 'Tiada blog, jadi kami melihat halaman yang paling lemah.') : W(`The weakest of the ${p.sample} blog posts we read, scoring ${p.score} out of 100.`, `Yang paling lemah daripada ${p.sample} artikel blog yang kami baca, dengan skor ${p.score} daripada 100.`)}</p>
      <div class="rp-serp" style="margin-top:8pt"><div class="s1">${esc(crumbOf(p))}</div><div class="s2">${esc(p.title ? cut(p.title, 62) : W('(no title)', '(tiada tajuk)'))}</div><div class="s3">${esc(p.desc ? cut(p.desc, 160) : W('No description, so Google picks some text from the page.', 'Tiada penerangan, jadi Google memilih teks daripada halaman.'))}</div></div>
      ${fails.length ? `<div class="rp-area">${fails.map(x => `<p><b>${esc(x.title)}.</b> ${esc(x.saw)} ${esc(x.why)} <i>${esc(x.fix)}</i></p>`).join('')}</div>` : `<p>${W('It ticks every box we check.', 'Ia memenuhi semua semakan kami.')}</p>`}
      ${p.kw && p.kw.suggest.length ? `<div class="rp-box" style="margin-top:8pt"><h3>${W('Words people search for', 'Perkataan yang dicari orang')}</h3><p>${W(`From Google’s own suggestions for “${esc(p.focus)}”. We’d work these into the ${word}:`, `Daripada cadangan Google sendiri untuk “${esc(p.focus)}”. Kami akan masukkan ini ke dalam ${word}:`)}</p><p class="rp-kws">${p.kw.suggest.map(k => `<span>${esc(k)}</span>`).join('')}</p></div>` : ''}`;
  }
  return out;
}
function printReport(mode, o = {}) {
  if (!S.result) return;
  buildReport(mode, o);
  document.title = `SenseCheck ${mode === 'internal' ? 'Internal Audit' : o.lang === 'bm' ? 'Laporan' : 'Report'} - ${S.result.domain}`;
  const theme = document.documentElement.dataset.theme || 'light';
  document.documentElement.dataset.theme = 'light'; // PDFs always print light
  Promise.all([...document.querySelectorAll('#report img')].map(i => (i.decode ? i.decode().catch(() => {}) : 0))).then(() => { window.print(); setTimeout(() => { document.title = 'SenseCheck'; document.documentElement.dataset.theme = theme; }, 500); });
}

// ---------- the same report as a web page or as slides
const fileName = (mode, o, ext) => `SenseCheck ${mode === 'internal' ? 'Internal Audit' : o.lang === 'bm' ? 'Laporan' : 'Report'} - ${S.result.domain}.${ext}`;
function download(blob, name) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const asData = src => fetch(src).then(x => x.blob()).then(b => new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = no; fr.readAsDataURL(b); }));
// Extra styles for the web page: the report sits on a sheet in the middle of the screen and reflows on a phone.
// Printing the page from the browser still gives the normal PDF layout.
const PAGE_CSS = `@media screen{
  html,body.page{background:#ECEAE4}
  body.page{margin:0;padding:28px 14px 40px}
  body.page #report{max-width:190mm;margin:0 auto;padding:13mm 14mm 14mm;background:#fff;border-radius:22px;box-shadow:0 0 0 1px #E8E5DD,0 40px 90px -60px rgba(50,40,20,.45);font-size:15px}
  body.page .rp-cover{padding:4mm 0 12mm;margin-bottom:12mm;border-bottom:1px solid #E4E4EC}
  body.page .rp-cover-logo{margin-top:9mm}
  body.page .rp-kicker{margin-top:10mm}
  body.page .rp-score{margin-top:9mm}
  body.page #report table.rp-meta{margin-top:9mm}
  body.page .tablewrap{overflow-x:auto}
}
@media screen and (max-width:720px){
  body.page{padding:0}
  body.page #report{padding:22px 16px 28px;border-radius:0;box-shadow:none}
  body.page #report h1{font-size:26px}
  body.page #report .rp-cover h1{font-size:32px}
  body.page .rp-score{flex-direction:column;align-items:flex-start;gap:10px}
  body.page .rp-top{flex-direction:column}
  body.page .rp-top .shots{max-width:100%}
  body.page .rp-top img{height:150px}
  body.page .rp-top .scores{width:100%}
  body.page .rp-cols,body.page .rp-cols.two,body.page .rp-charts{grid-template-columns:minmax(0,1fr)}
  body.page #report .rp-good{columns:1}
  body.page #report table:not(.rp-meta){display:block;overflow-x:auto}
  body.page #report td,body.page #report th{min-width:84px}
}`;
async function saveHtml(mode, o = {}) {
  if (!S.result) return;
  try {
    buildReport(mode, o);
    const box = $('#report').cloneNode(true);
    // pictures are packed into the file, so it still works when it is opened somewhere else
    await Promise.all([...box.querySelectorAll('img')].map(async im => { const src = im.getAttribute('src') || ''; if (src && !src.startsWith('data:')) im.setAttribute('src', await asData(src).catch(() => '')); }));
    const css = (await fetch('app.css').then(x => x.text())).replace(/@media print\s*\{/g, '@media all{');
    const name = fileName(mode, o, 'html');
    const page = `<!doctype html>\n<html lang="${mode !== 'internal' && o.lang === 'bm' ? 'ms' : 'en'}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<meta name="robots" content="noindex,nofollow">\n<title>${esc(name.replace(/\.html$/, ''))}</title>\n<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">\n<style>${css}\n${PAGE_CSS}</style>\n</head>\n<body class="page">\n<div id="report">${box.innerHTML}</div>\n</body>\n</html>\n`;
    download(new Blob([page], { type: 'text/html' }), name);
    toast('Web page downloaded. Open it in any browser.', 'thumbs');
  } catch { toast('The web page could not be made. Try the PDF.', 'shrug'); }
}
// The slides are built by slides.js, which is only loaded when someone asks for them.
async function saveSlides(mode, o = {}) {
  if (!S.result) return;
  toast('Building the slides. This takes a few seconds.', 'run');
  try {
    const { makeSlides } = await import('./slides.js');
    const blob = await makeSlides(S.result, mode, o, { shots: shotsOf(S.result, mode !== 'internal'), trouble: testNote(S.result), versus, areaOf, AREAS, priceOf, designOf, good, CFG });
    download(blob, fileName(mode, o, 'pptx'));
    toast('Slides downloaded.', 'thumbs');
  } catch (e) { console.error(e); toast('The slides could not be made. Try the PDF.', 'shrug'); }
}

// ---------- routing and events
async function render() {
  drawNav();
  if (S.route === 'result' && S.result) return renderResult();
  if (S.route === 'scan') return;
  const route = S.route;
  await H.load(route === 'history' && S.who === 'all' && ME.admin).catch(e => { H.rows = []; toast(e.message); });
  if (S.route !== route) return; // the user moved on while the list was loading
  if (route === 'history') renderHistory(); else renderNew();
}

// Sidebar footer: who is signed in. The switcher only exists on the local stand-in (ME.local).
function drawUser() {
  const el = $('#user'), name = ME.email || 'MYSense';
  el.innerHTML = `<span class="avatar">${esc(name.slice(0, 2).toUpperCase())}</span><span class="me"><b title="${esc(name)}">${esc(name)}</b><small>${ME.email ? (ME.admin ? 'Admin' : 'Signed in') : 'Sales tools'}</small>${ME.local ? `<label class="dev">Local preview, signed in as<select id="devuser">${ME.users.map(u => `<option${u === ME.email ? ' selected' : ''}>${esc(u)}</option>`).join('')}</select></label>` : ''}</span>`;
}
function go(to) {
  if (to.startsWith('pdf-')) return pdfDialog(to.slice(4));
  if (S.busy) return toast('A scan is still running.');
  if (to === 'new' || to === 'history') { S.route = to; render(); window.scrollTo(0, 0); return; }
  if (!S.result) return;
  const was = S.route; S.route = 'result'; S.sec = to; spyHold = Date.now() + 900;
  if (was !== 'result') render(); else drawNav();
  const el = $('#sec-' + to);
  if (el) { view.querySelectorAll('.rise:not(.rise-go)').forEach(x => x.classList.add('rise-flat')); el.scrollIntoView({ behavior: 'smooth', block: to === 'overview' ? 'center' : 'start' }); }
}

// The menu follows the page (it is sticky in the styles) and marks the section you are reading.
const SPY = ['overview', 'speed', 'compare', 'activity', 'seo', 'design', 'stack', 'findings', 'steps'];
let spyHold = 0, spyWait = 0;
function spy() {
  spyWait = 0;
  if (S.route !== 'result' || Date.now() < spyHold) return;
  // the section whose top most recently passed the top of the window, whatever order the sections are in
  let cur = SPY[0], best = -Infinity;
  for (const id of SPY) { const el = $('#sec-' + id), top = el ? el.getBoundingClientRect().top : NaN; if (top <= 160 && top > best) { best = top; cur = id; } }
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = 'steps';
  if (cur !== S.sec) { S.sec = cur; drawNav(); }
}
window.addEventListener('scroll', () => { watchScroll(); if (!spyWait) spyWait = setTimeout(spy, 70); }, { passive: true });

document.addEventListener('click', e => {
  if (modal.classList.contains('out') && modal.contains(e.target)) return;   // a dialog that is closing takes no more presses
  const bud = e.target.closest('[data-buddy]');
  if (bud) return buddyAct(bud.dataset.buddy);
  const pl = e.target.closest('[data-pl]');
  if (pl) return plAct(pl.dataset.pl);
  const mark = e.target.closest('.pl .mk.bad');
  if (mark) return plAct('k:' + mark.dataset.k);
  const pet = e.target.closest('.mascot');
  if (pet) return pat(pet);
  const t = e.target.closest('[data-go],[data-open],[data-remove],[data-rescan],[data-act],#more');
  if (!t) return;
  if (t.dataset.act) return act(t.dataset.act);
  if (t.dataset.go) { e.preventDefault(); go(t.dataset.go); }
  else if (t.dataset.open) { const name = t.closest('tr') && t.closest('tr').querySelector('td b'), from = name ? name.getBoundingClientRect() : null; H.get(t.dataset.open).then(r => r && open(r, from)).catch(e => toast(e.message)); }
  else if (t.dataset.remove) {   // the row slides away first, then the list is drawn again without it
    const row = t.closest('tr'); if (row) row.classList.add('leaving');
    Promise.all([H.remove(t.dataset.remove), sleep(calm.matches ? 0 : 240)]).then(() => { if (S.route === 'new' || S.route === 'history') render(); }).catch(e => { if (row) row.classList.remove('leaving'); toast(e.message); });
  }
  else if ('rescan' in t.dataset) runScan(S.result.url);
  else if (t.id === 'more') { S.more = !S.more; drawRows(); }
});
document.addEventListener('submit', e => {
  e.preventDefault();
  if (modal.classList.contains('out')) return;   // pressed twice: the first press already closed the dialog
  if (e.target.id === 'f') runScan($('#u').value);
  if (e.target.id === 'rival-f') { const v = $('#rival-u').value.trim(); if (!v) return toast('Paste the competitor\u2019s link first.'); closeModal(); runScan(v, { vsFor: S.result }); }
  if (e.target.id === 'pdf-f') {
    const o = { client: $('#pdf-for').value.trim(), by: $('#pdf-by').value.trim(), lang: ($('#pdf-lang') || {}).value || 'en' }, mode = e.target.dataset.mode;
    try { localStorage.setItem('sensecheck.by', o.by); } catch { /* storage unavailable */ }
    S.result.clientName = o.client;
    const fmt = (e.target.querySelector('input[name="fmt"]:checked') || {}).value || 'pdf';
    try { localStorage.setItem('sensecheck.fmt', fmt); } catch { /* storage unavailable */ }
    closeModal();
    if (fmt === 'html') saveHtml(mode, o); else if (fmt === 'pptx') saveSlides(mode, o); else printReport(mode, o);
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'cat') { S.cat = e.target.value; S.more = false; drawRows(); }
  if (e.target.id === 'max') S.max = +e.target.value;
  if (e.target.id === 'who') { S.who = e.target.value; render(); }
  if (e.target.name === 'fmt' && FORMATS[e.target.value]) { $('#fmt-hint').textContent = FORMATS[e.target.value][1]; $('#fmt-go').lastChild.textContent = FORMATS[e.target.value][2]; moveThumbs(modal); }
  if (e.target.id === 'devuser' && ME.local) fetch('/api/dev-login?as=' + encodeURIComponent(e.target.value), { method: 'POST' }).then(() => location.reload());
});
document.addEventListener('input', e => { if (e.target.id === 'q') { S.q = e.target.value; drawRows(); } });

// Light and dark mode, remembered in this browser.
const themeBtn = $('#theme');
let THEME = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
themeBtn.setAttribute('role', 'switch');
themeBtn.setAttribute('aria-label', 'Dark mode');
themeBtn.innerHTML = `<span class="sw" aria-hidden="true"><i>${icon('sun').replace('<svg', '<svg class="sun"')}${icon('moon').replace('<svg', '<svg class="moon"')}</i></span>Dark mode`;
function setTheme(t) {
  THEME = t;
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('sensecheck.theme', t); } catch { /* storage unavailable */ }
  themeBtn.setAttribute('aria-checked', String(t === 'dark'));
}
setTheme(THEME);
themeBtn.addEventListener('click', () => { const next = THEME === 'dark' ? 'light' : 'dark'; THEME = next; crossFade(() => setTheme(next)); });

// ---------- cards float up into place
// Each card waits a little lower and smaller, then rises, pops just past its spot and settles, like something
// coming up to the surface of water. It plays once, the first time the card comes into view. People who ask
// their device for less motion get the cards without it.
const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
const riser = 'IntersectionObserver' in window ? new IntersectionObserver(list => {
  const up = list.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
  up.forEach((e, i) => {
    const el = e.target; riser.unobserve(el);
    const wait = Math.min(i, 6) * 90;
    el.style.setProperty('--rise-wait', `${wait}ms`); // cards that arrive together come up one after another
    el.classList.add('rise-go');
    countUp(el.querySelector('.health b'), wait + 380);
    el.addEventListener('animationend', function done(ev) {
      if (ev.target !== el || ev.pseudoElement) return;
      el.removeEventListener('animationend', done); el.classList.remove('rise', 'rise-go', 'rise-flat'); el.style.removeProperty('--rise-wait');
    });
  });
}, { rootMargin: '0px 0px -4% 0px' }) : null;
function floatIn() {
  if (!riser || calm.matches) return;
  const els = [...view.querySelectorAll('.card:not(.hero3):not(.swap), .hero3 > .col, .hero3 > .summary')];
  els.forEach(el => el.classList.add('rise'));
  // wait for the intro to start leaving, so the first cards are not played behind it
  const start = () => { const intro = $('#intro'); if (intro && !intro.classList.contains('out')) return setTimeout(start, 120); els.forEach(el => el.isConnected && riser.observe(el)); };
  start();
}

// ---------- the mascot reacts
// A tap makes any mascot hop. The big one on the start screen also changes pose each time.
function boing(el) { if (!el) return; el.classList.remove('boing'); void el.offsetWidth; el.classList.add('boing'); }
document.addEventListener('animationend', e => { if (e.animationName === 'boing') e.target.classList.remove('boing'); });
const PETS = ['wave', 'thumbs', 'coffee', 'clipboard', 'inspect'];
function pat(el) {
  if (el.classList.contains('pen')) return; // this one is holding the underline in place
  boing(el);
  if (S.route === 'new' && el.closest('.start')) { const im = el.querySelector('img'), i = (PETS.indexOf(im.dataset.pose || 'wave') + 1) % PETS.length; im.dataset.pose = PETS[i]; im.src = `img/mascot/${PETS[i]}.webp`; }
}

// ---------- the helper in the corner of a report
// The mascot waits in the corner, changes pose with the section being read, and hops when the section changes.
// A tap gives the short version of that section and a button to the next one. "Hide me" tucks it away at the
// bottom edge (remembered in this browser); a tap on the part that still shows brings it back.
const BUDDY_ORDER = ['overview', 'compare', 'speed', 'activity', 'seo', 'design', 'stack', 'findings', 'steps'];
const SEC_NAME = { overview: 'Overview', compare: 'Competitor', speed: 'Page speed', activity: 'Activity', seo: 'SEO', design: 'Design', stack: 'Tech stack', findings: 'Findings', steps: 'Next steps' };
const narrow = window.matchMedia('(max-width: 820px)');
const buddy = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'buddy', className: 'buddy', hidden: true }));
buddy.innerHTML = `<div class="buddy-say" role="status" hidden><button type="button" class="buddy-x" data-buddy="shut" aria-label="Close">${icon('x')}</button><p></p><div class="buddy-acts"></div></div>
  <button type="button" class="buddy-face" data-buddy="face" aria-label="SenseCheck helper. Tap for the short version of this section."><img src="img/mascot/wave.webp" alt="" data-pose="wave"></button>`;
const BUD = { sec: '', id: null, open: false, away: false, hello: false, t: 0 };
// On a phone it starts tucked away, so it never sits on top of the text unless someone asks for it.
try { const kept = localStorage.getItem('sensecheck.buddy'); BUD.away = kept ? kept === 'away' : narrow.matches; } catch { BUD.away = narrow.matches; }
const many = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
// [pose, what the helper says] for a section of the report
function buddyLine(sec, r) {
  const h = r.health, m = good(r.psi.mobile), d = good(r.psi.desktop);
  if (sec === 'compare' && r.vs) {
    const a = h.score, b = r.vs.health.score;
    return ['shrug', a == null || b == null ? `Here is ${r.domain} next to ${r.vs.domain}.` : `${r.domain} scores ${a} and ${r.vs.domain} scores ${b}. ${Math.abs(a - b) < 5 ? 'That\u2019s about level.' : a > b ? 'Our client is ahead.' : 'The competitor is ahead, which is a good reason to act.'}`];
  }
  if (sec === 'speed') {
    const f = speedPlan(r), ps = m ? m.scores.performance : null, ds = d ? d.scores.performance : null;
    if (ps == null && ds == null) return ['run', 'Google couldn\u2019t test the speed this time. Try the scan again later.'];
    return ['run', `${ps != null ? `Phones score ${ps} out of 100${ds != null ? `, computers ${ds}` : ''}` : `Computers score ${ds} out of 100`}. ${f && f.steps.length ? `The biggest win is \u201c${f.steps[0].title}\u201d.` : 'Speed is in good shape.'}`];
  }
  if (sec === 'activity') {
    if (!r.activity) return ['coffee', 'Scan again to see how often this site gets new posts.'];
    const a = activityOf(r), st = r.stab ? stabilityOf(r, 'en', !!testTrouble(r)) : null;
    return [a.tone === 'good' ? 'thumbs' : 'clipboard', `${a.label}. ${a.line}${st ? ` Stability: ${st.label.toLowerCase()}.` : ''}`];
  }
  if (sec === 'seo') {
    const o = seoOf(r);
    if (!o) return ['shrug', 'No SEO score for this scan.'];
    return ['underline', `SEO scores ${o.score} out of 100. ${r.post ? 'Tap “Show me why” below and I’ll walk you through one post.' : ''}`];
  }
  if (sec === 'design') { const dz = designOf(r), k = r.issues.filter(i => i.cat === 'Design').length; return ['inspect', `${dz.label}. ${k ? `${many(k, 'design point')} below, grouped by area.` : 'Nothing dated or broken turned up.'}`]; }
  if (sec === 'stack') {
    const p = r.stack.platform, name = p && p.name !== 'Not detected' ? p.name : '';
    return ['clipboard', name ? `Built with ${name}${r.stack.wp && r.stack.wp.version ? ` ${r.stack.wp.version}` : ''}. Can we take it? ${r.fit.verdict}.` : 'We couldn\u2019t tell what it\u2019s built with. Ask the client before quoting.'];
  }
  if (sec === 'findings') { const n = r.issues.length, big = r.issues.filter(i => i.sev === 'Critical' || i.sev === 'High').length; return ['coffee', n ? `${many(n, 'finding')}, ${big ? `${big} of them serious` : 'none of them serious'}. Use the search box to jump to one.` : 'No issues on the things we can measure.']; }
  if (sec === 'steps') return ['thumbs', 'That\u2019s the full check. Download the report when you\u2019re ready.'];
  return ['wave', h.score == null ? `We could only partly check ${r.domain}.` : `${r.domain} scores ${h.score} out of 100. ${r.verdict.label}.`];
}
const buddyNext = () => { const order = BUDDY_ORDER.filter(k => k !== 'compare' || (S.result && S.result.vs)); return order[order.indexOf(BUD.sec) + 1]; };
function paintBuddy(hop) {
  const r = S.result; if (!r) return;
  const [pose, text] = buddyLine(BUD.sec, r), say = $('.buddy-say', buddy), face = $('.buddy-face', buddy), im = $('img', face), next = buddyNext();
  if (im.dataset.pose !== pose) { im.dataset.pose = pose; im.src = `img/mascot/${pose}.webp`; }
  if (hop) boing(face);
  buddy.classList.toggle('away', BUD.away);
  if (BUD.open && !BUD.away) { say.classList.remove('out'); say.hidden = false; }
  else if (!say.hidden && !say.classList.contains('out')) { say.classList.add('out'); setTimeout(() => { if (say.classList.contains('out')) { say.hidden = true; say.classList.remove('out'); } }, calm.matches ? 0 : 190); }
  $('p', say).textContent = text + (BUD.hello && BUD.sec === 'overview' ? ' Tap me on any section for the short version.' : '');
  $('.buddy-acts', say).innerHTML = (next ? `<button type="button" class="btn primary" data-buddy="next">Next: ${SEC_NAME[next]}</button>` : `<button type="button" class="btn primary" data-buddy="report">${icon('down')}Client report</button>`) + '<button type="button" class="link" data-buddy="away">Hide me</button>';
}
function drawBuddy() {
  const show = S.route === 'result' && !!S.result;
  buddy.hidden = !show;
  if (!show) { BUD.sec = ''; BUD.id = null; clearTimeout(BUD.t); return; }
  const r = S.result, sec = BUDDY_ORDER.includes(S.sec) && (S.sec !== 'compare' || r.vs) ? S.sec : 'overview', fresh = BUD.id !== r.id;
  if (!fresh && sec === BUD.sec) return;
  if (fresh) {
    // a new report: say hello once, then step back unless someone taps
    BUD.id = r.id; BUD.hello = true; BUD.open = !BUD.away && !narrow.matches;
    clearTimeout(BUD.t); if (BUD.open) BUD.t = setTimeout(() => { if (BUD.hello) { BUD.hello = false; BUD.open = false; paintBuddy(); } }, 9000);
    for (const p of ['run', 'coffee', 'clipboard', 'inspect', 'thumbs', 'shrug']) new Image().src = `img/mascot/${p}.webp`;
  }
  BUD.sec = sec;
  paintBuddy(true);
}
function buddyAct(a) {
  BUD.hello = false; clearTimeout(BUD.t);
  if (a === 'report') return go('pdf-client');
  if (a === 'next') { const next = buddyNext(); if (next) go(next); return; }
  if (a === 'face') { if (BUD.away) { BUD.away = false; BUD.open = true; } else BUD.open = !BUD.open; }
  if (a === 'shut') BUD.open = false;
  if (a === 'away') { BUD.away = true; BUD.open = false; }
  try { localStorage.setItem('sensecheck.buddy', BUD.away ? 'away' : 'here'); } catch { /* storage unavailable */ }
  paintBuddy(a === 'face');
}

drawUser();
render();
