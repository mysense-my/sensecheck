import { detectStack, summarisePsi } from './analyze.js';
import { readPage, buildIssues, healthOf, strengthsOf, skillsFit, nextSteps, verdictOf, norm, CATS, CAT_NAME } from './audit.js';

const CFG = await fetch('config.json').then(r => r.json());
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = $('#view'), nav = $('#nav');
const S = { route: 'new', sec: 'overview', result: null, strategy: 'mobile', q: '', cat: 'all', more: false, busy: false, max: CFG.crawl.maxPages };

const I = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  gauge: '<path d="M4.5 17a8.5 8.5 0 1 1 15 0"/><path d="M12 13l4-4.5"/>',
  layers: '<path d="M12 4l8 4.5-8 4.5-8-4.5z"/><path d="M4 13l8 4.5 8-4.5"/>',
  list: '<path d="M9 7h11M9 12h11M9 17h11"/><path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01"/>',
  flag: '<path d="M6 20V5M6 5h11l-2 4 2 4H6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  down: '<path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 19.5h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};
const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
const LOGO = '<svg viewBox="0 0 32 32" width="22" height="22"><rect width="32" height="32" rx="10" fill="#5B4FE9"/><path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const fmt = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const good = p => (p && !p.error ? p : null);
const tone = v => (v == null ? 'info' : v >= 90 ? 'good' : v >= 50 ? 'warn' : 'bad');
const htone = v => (v == null ? 'info' : v >= 80 ? 'good' : v >= 55 ? 'warn' : 'bad');
const word = v => (v == null ? 'No data' : v >= 90 ? 'Good' : v >= 50 ? 'Needs work' : 'Poor');
const SEV = { Critical: 'bad', High: 'warn', Medium: 'mid', Low: 'info' };
const LH = [['performance', 'Performance'], ['accessibility', 'Accessibility'], ['best-practices', 'Best practices'], ['seo', 'SEO']];
const GROUPS = [['quick', 'Quick fixes'], ['revamp', 'Revamp items'], ['maintenance', 'Ongoing maintenance']];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dotted = (t, text) => `<span class="imp"><i class="dot ${t}"></i>${text}</span>`;

let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3800); }

// ---------- history (this browser only)
const KEY = 'sensecheck.history.v2';
const hist = {
  all() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } },
  save(list) { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30))); } catch { /* storage unavailable */ } },
  add(r) {
    const strip = p => (p && !p.error ? { ...p, shot: '' } : p), old = this.all().find(x => x.domain === r.domain);
    if (old && old.health) r.prev = { date: old.date, score: old.health.score };
    this.save([{ ...r, psi: { mobile: strip(r.psi.mobile), desktop: strip(r.psi.desktop) } }, ...this.all().filter(x => x.domain !== r.domain)]);
  },
  remove(id) { this.save(this.all().filter(x => String(x.id) !== String(id))); },
};

// ---------- API
// A 'locked' reply means the passcode session ended, so reload to show the unlock screen.
const locked = r => { if (r.headers.get('x-sc-locked')) { location.reload(); throw new Error('SenseCheck is locked. Enter the passcode again.'); } return r; };
async function via(url) {
  const r = locked(await fetch('/api/fetch?url=' + encodeURIComponent(url)));
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error === 'unreachable' ? 'Could not connect to the site' : j.error || 'Request failed'); }
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

// Polite crawl: same site only, two pages at a time with a pause, robots.txt respected, hard page limit.
async function crawl(home, max, skip, tick) {
  const first = readPage(home.finalUrl, home.status, home.html, CFG), pages = [first], broken = [], seen = new Set([norm(home.finalUrl)]), queue = [];
  const host = new URL(home.finalUrl).hostname.replace(/^www\./, '');
  const push = p => { for (const l of p.links) if (!seen.has(l.key) && !skip.some(d => new URL(l.href).pathname.startsWith(d))) { seen.add(l.key); queue.push({ ...l, from: p.path }); } };
  push(first);
  let tries = 0;
  while (pages.length < max && queue.length && tries < max * 2) {
    const batch = queue.splice(0, Math.min(2, max - pages.length));
    tries += batch.length;
    (await Promise.all(batch.map(b => soft(b.href)))).forEach((g, i) => {
      if (!g) return;
      if (g.status === 404 || g.status === 410 || g.status >= 500) return broken.push({ path: new URL(batch[i].href).pathname, status: g.status, from: batch[i].from });
      if (g.status >= 400 || !/html/i.test(g.headers['content-type'] || 'text/html')) return;
      const fu = g.finalUrl || batch[i].href, k = norm(fu);
      if (new URL(fu).hostname.replace(/^www\./, '') !== host || (k !== batch[i].key && seen.has(k))) return;
      seen.add(k);
      const p = readPage(fu, g.status, g.html, CFG); pages.push(p); push(p);
    });
    tick(pages.length);
    await sleep(CFG.crawl.delayMs);
  }
  return { pages, broken };
}

// ---------- scan
async function runScan(raw, max = S.max) {
  if (S.busy) return;
  let href = (raw || '').trim();
  if (!href) return toast('Paste a website link first.');
  const hadScheme = /^https?:\/\//i.test(href);
  if (!hadScheme) href = 'https://' + href;
  let u;
  try { u = new URL(href); if (!u.hostname.includes('.')) throw 0; } catch { return toast('That does not look like a website address.'); }
  const domain = u.hostname.replace(/^www\./, '');
  S.busy = true; S.route = 'scan'; drawNav(); renderScan(domain);
  ['site', 'm', 'd'].forEach(id => step(id, 'run'));
  const speed = st => psi(u.href, st).then(v => (step(st[0], 'done'), v), e => (step(st[0], 'fail', e.message), { error: e.message }));
  const pm = speed('mobile'), pd = speed('desktop');

  let page = null, err = '';
  try { page = await via(u.href); } catch (e) {
    err = e.message;
    if (!hadScheme) try { page = await via('http://' + u.host + u.pathname); } catch { /* keep first error */ }
  }
  const blocked = !page || (page.status >= 400 && (page.html.length < 3000 || /cf-chl|just a moment|attention required|access denied|captcha/i.test(page.html)));
  if (blocked) {
    step('site', 'fail', page ? `Blocked (HTTP ${page.status})` : err);
    page = { html: '', headers: page ? page.headers : {}, cookies: [], finalUrl: page ? page.finalUrl : u.href, status: page ? page.status : 0 };
  } else step('site', 'done');

  step('stack', 'run');
  const origin = new URL(page.finalUrl).origin, probes = {}, latest = {}, s0 = detectStack(page);
  const site = { headers: page.headers, robots: null, sitemap: null, disallow: [] };
  const [robots, dom] = await Promise.all([blocked ? null : soft(origin + '/robots.txt'), domainInfo(u.hostname)]);
  probes.domain = dom;
  if (!blocked) {
    const rb = body(robots);
    site.robots = /user-agent|disallow|sitemap/i.test(rb) && !/<html/i.test(rb);
    site.sitemap = site.robots && /^\s*sitemap:/im.test(rb);
    if (!site.sitemap) for (const f of ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml']) if (/<(urlset|sitemapindex)/i.test(body(await soft(origin + f), 3000))) { site.sitemap = true; break; }
    if (site.robots) site.disallow = disallowed(rb);
    if (s0.platform && s0.platform.kind === 'wordpress') await wpProbes(origin, s0, probes, latest);
  }
  const stack = detectStack(page, probes, latest);
  step('stack', 'done');

  let pages = [], broken = [], bigImages = [];
  if (!blocked) {
    step('pages', 'run');
    ({ pages, broken } = await crawl(page, max, site.disallow, n => step('pages', 'run', `${n} of up to ${max}`)));
    const urls = pages[0].imgUrls, sizes = await pool(urls, 3, peek);
    bigImages = sizes.map((m, i) => ({ url: urls[i], kb: m && m.headers ? Math.round((+m.headers['content-length'] || 0) / 1024) : 0 })).filter(b => b.kb > CFG.thresholds.imageKB);
    step('pages', 'done', `${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`);
  } else step('pages', 'fail', 'Skipped');

  const [mobile, desktop] = await Promise.all([pm, pd]);
  S.busy = false;
  if (!page.html && mobile.error && desktop.error) return renderFail(domain, err || mobile.error);
  if (!stack.platform) {
    const packs = mobile.packs || desktop.packs || [];
    if (packs.length) stack.verdict.reasons.unshift(`Google\u2019s test detected: ${packs.join(', ')}.`);
  }
  const r = { id: Date.now(), url: page.finalUrl || u.href, domain, date: new Date().toISOString(), blocked, stack, psi: { mobile, desktop }, pages, broken, bigImages, site };
  r.issues = buildIssues(r, CFG); r.health = healthOf(r); r.strengths = strengthsOf(r);
  r.fit = skillsFit(stack, CFG); r.steps = nextSteps(r, CFG); r.verdict = verdictOf(r);
  r.pagesChecked = pages.length;
  for (const k of ['pages', 'broken', 'bigImages', 'site']) delete r[k];
  hist.add(r);
  open(r);
}

function open(r) {
  S.result = r; S.route = 'result'; S.sec = 'overview'; S.q = ''; S.cat = 'all'; S.more = false;
  S.strategy = !good(r.psi.mobile) && good(r.psi.desktop) ? 'desktop' : 'mobile';
  render();
  window.scrollTo(0, 0);
}

// ---------- views
function drawNav() {
  const res = S.route === 'result', none = !S.result;
  const b = (go, ic, label, on, dis) => `<button type="button" data-go="${go}" class="${on ? 'on' : ''}"${dis ? ' disabled' : ''}>${icon(ic)}${label}</button>`;
  nav.innerHTML = b('new', 'plus', 'New scan', S.route === 'new' || S.route === 'scan')
    + b('overview', 'grid', 'Overview', res && S.sec === 'overview', none)
    + b('speed', 'gauge', 'Page speed', res && S.sec === 'speed', none)
    + b('stack', 'layers', 'Tech stack', res && S.sec === 'stack', none)
    + b('findings', 'list', 'Findings', res && S.sec === 'findings', none)
    + b('steps', 'flag', 'Next steps', res && S.sec === 'steps', none)
    + b('history', 'clock', 'History', S.route === 'history')
    + '<hr>' + b('pdf-client', 'down', 'Client PDF', false, none) + b('pdf-internal', 'down', 'Internal PDF', false, none);
}

function historyCard(rows, title) {
  return `<div class="card"><div class="card-head"><h3>${title}</h3></div><div class="tablewrap"><table>
    <thead><tr><th>Site</th><th>Health</th><th>Verdict</th><th>Can we take it?</th><th>Platform</th><th>Scanned</th><th></th></tr></thead><tbody>
    ${rows.map(r => `<tr>
      <td><b>${esc(r.domain)}</b></td>
      <td class="nw">${dotted(htone(r.health.score), r.health.score ?? 'No data')}</td>
      <td>${dotted(r.verdict.tone, esc(r.verdict.label))}</td>
      <td class="nw">${dotted(r.fit.tone, r.fit.verdict)}</td>
      <td>${esc(r.stack.platform ? r.stack.platform.name : 'Not detected')}</td>
      <td class="nw muted">${fmt(r.date)}</td>
      <td class="nw"><button type="button" class="link" data-open="${r.id}">Open</button><button type="button" class="link" data-remove="${r.id}">Remove</button></td></tr>`).join('')}
    </tbody></table></div></div>`;
}

function renderNew() {
  const rows = hist.all().slice(0, 5), opts = [...new Set([1, 10, CFG.crawl.maxPages, 50])].sort((a, b) => a - b);
  view.innerHTML = `
    <div class="top"><div class="crumb">SenseCheck<i>&rsaquo;</i><b>New scan</b></div></div>
    <div class="card start">
      <h1>Check a client\u2019s website</h1>
      <p>Paste the link to see what the site runs on, whether we can take it on, what needs fixing and what to propose.</p>
      <form class="urlrow" id="f" novalidate>
        <label class="field">${icon('link')}<input id="u" type="text" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="clientsite.com.my" aria-label="Website address"></label>
        <label class="pill soft">Check: <select id="max">${opts.map(n => `<option value="${n}"${n === S.max ? ' selected' : ''}>${n === 1 ? 'Homepage only' : `Up to ${n} pages`}</option>`).join('')}</select></label>
        <button class="btn primary" type="submit">Run check</button>
      </form>
      <div class="covers"><span><i class="dot m"></i>Tech stack and versions</span><span><i class="dot d"></i>Speed, SEO, content and security</span><span><i class="dot good"></i>Strengths and next steps</span></div>
    </div>
    ${rows.length ? historyCard(rows, 'Recent scans') : ''}`;
  const u = $('#u'); if (u && window.matchMedia('(min-width: 821px)').matches) u.focus();
}

function renderHistory() {
  const rows = hist.all();
  view.innerHTML = `<div class="top"><div class="crumb">SenseCheck<i>&rsaquo;</i><b>History</b></div></div>
    ${rows.length ? historyCard(rows, 'Past scans on this browser') : '<div class="card"><p class="empty">No scans yet. Run your first check from New scan.</p></div>'}`;
}

function renderScan(domain) {
  view.innerHTML = `<div class="top"><div class="crumb">Scans<i>&rsaquo;</i><b>${esc(domain)}</b></div></div>
    <div class="card start"><h1>Checking ${esc(domain)}</h1>
    <p>Pages are read slowly so the scan does not load the client\u2019s server. Expect about a minute.</p>
    <div class="steps">${[['site', 'Reading the site'], ['stack', 'Identifying the tech stack'], ['pages', 'Checking pages'], ['m', 'Measuring mobile speed'], ['d', 'Measuring desktop speed']].map(([id, t]) => `<div class="step" id="st-${id}"><span class="ic"></span><span>${t}</span><small></small></div>`).join('')}</div></div>`;
}
function step(id, st, note) {
  const el = $('#st-' + id); if (!el) return;
  el.className = 'step ' + st;
  el.querySelector('.ic').textContent = st === 'done' ? '\u2713' : st === 'fail' ? '!' : '';
  if (note != null) el.querySelector('small').textContent = note;
}
function renderFail(domain, why) {
  S.route = 'new'; drawNav();
  view.innerHTML = `<div class="top"><div class="crumb">Scans<i>&rsaquo;</i><b>${esc(domain)}</b></div></div>
    <div class="card start"><h1>Could not check ${esc(domain)}</h1><p>${esc(why || 'The site did not respond.')} Check the spelling of the link, then try again.</p>
    <div class="urlrow"><button class="btn primary" type="button" data-go="new">Try another link</button></div></div>`;
}

const reasons = list => `<ul>${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
const stepsHtml = (r, pkg) => GROUPS.map(([k, t]) => `<div><h4>${t}</h4>${r.steps[k].length ? `<ul>${r.steps[k].map(x => `<li>${esc(x.text)}${pkg ? `<br><span class="chip">${esc(x.pkg)}</span>` : ''}</li>`).join('')}</ul>` : '<p class="muted">Nothing needed.</p>'}</div>`).join('');

function renderResult() {
  const r = S.result, p = good(r.psi[S.strategy]), m = good(r.psi.mobile), d = good(r.psi.desktop), v = r.stack.verdict, h = r.health;
  const perr = r.psi[S.strategy] && r.psi[S.strategy].error;
  const f = p && p.field, fr = x => ({ FAST: 'good', AVERAGE: 'warn', SLOW: 'bad' }[x && x.rating] || 'info');
  const groups = [...new Set(r.stack.items.map(i => i.group))];
  view.innerHTML = `
    <div class="top">
      <div class="crumb">Scans<i>&rsaquo;</i><b>${esc(r.domain)}</b></div>
      <div class="top-r"><button type="button" class="link" data-rescan>Scan again</button>
      <label class="pill">Show: <select id="strat"><option value="mobile"${S.strategy === 'mobile' ? ' selected' : ''}>Mobile</option><option value="desktop"${S.strategy === 'desktop' ? ' selected' : ''}>Desktop</option></select></label></div>
    </div>

    <div class="card hero3" id="sec-overview">
      <div class="col who">
        ${p && p.shot ? `<div class="shot"><img src="${esc(p.shot)}" alt="Screenshot of ${esc(r.domain)} on ${S.strategy}"></div>` : `<div class="shot empty">${esc(r.domain[0].toUpperCase())}</div>`}
        <h2>${esc(r.domain)}</h2>
        <p class="tone ${r.verdict.tone}">${esc(r.verdict.label)}</p>
        <button class="btn primary" type="button" data-go="pdf-client">${icon('down')}Client PDF</button>
        <button class="btn soft" type="button" data-go="pdf-internal">Internal PDF</button>
      </div>
      <div class="col">
        <span class="label">Website health</span>
        <div class="health"><b>${h.score ?? '\u2013'}</b><span>out of 100</span></div>
        ${r.prev && r.prev.score != null ? `<p class="prev">Was ${r.prev.score} on ${fmt(r.prev.date)}</p>` : ''}
        <div class="rows">${CATS.map(c => `<div class="row"><i class="dot ${htone(h.sub[c])}"></i>${CAT_NAME[c]}<b>${h.sub[c] ?? '<small>Not measured</small>'}</b></div>`).join('')}</div>
      </div>
      <div class="col chartcol">
        <div class="chart-head"><h3>Speed by metric</h3><div class="legend"><span><i class="dot m"></i>Mobile</span><span><i class="dot d"></i>Desktop</span></div></div>
        <span class="label">Score out of 100, higher is better</span>
        ${m || d ? '<div class="chart" id="chart"></div>' : `<p class="note" style="margin-top:16px">Speed test unavailable. ${esc(perr || '')}</p>`}
      </div>
      <p class="summary"><b>In short:</b> ${esc(r.verdict.summary)} <span class="muted">${r.pagesChecked ? `${r.pagesChecked} ${r.pagesChecked === 1 ? 'page' : 'pages'} checked.` : ''}</span></p>
    </div>

    <div class="card" id="sec-speed">
      <div class="card-head"><h3>Page speed</h3><span class="muted">Google Lighthouse test on ${S.strategy}, ${fmt(r.date)}</span></div>
      ${p ? `<div class="tiles">${p.metrics.map(x => `<div class="tile"><span class="label">${x.name}</span><b>${esc(x.display || '\u2013')}</b><span class="st"><i class="dot ${tone(x.score)}"></i>${word(x.score)}</span></div>`).join('')}</div>
        <div class="field-data">${LH.map(([k, n]) => `<span><i class="dot ${tone(p.scores[k])}"></i>${n} <b>${p.scores[k] ?? '\u2013'}</b></span>`).join('')}${p.weight ? `<span>Page weight <b>${(p.weight / 1024).toFixed(1)} MB</b></span>` : ''}</div>
        <div class="field-data">${f && f.lcp ? `<span><b>Real visitors</b>&nbsp;on Chrome, last 28 days${f.origin ? ' (whole site)' : ''}</span>
          <span><i class="dot ${fr(f.lcp)}"></i>Main content (LCP) <b>${(f.lcp.value / 1000).toFixed(1)} s</b></span>
          ${f.inp ? `<span><i class="dot ${fr(f.inp)}"></i>Responsiveness (INP) <b>${f.inp.value} ms</b></span>` : ''}
          ${f.cls ? `<span><i class="dot ${fr(f.cls)}"></i>Layout shift (CLS) <b>${(f.cls.value / 100).toFixed(2)}</b></span>` : ''}` : '<span>Google has no real-visitor data for this site yet, which usually means low traffic.</span>'}</div>` : `<p class="note">No ${S.strategy} speed data. ${esc(perr || '')}</p>`}
    </div>

    <div class="card" id="sec-stack">
      <div class="card-head"><h3>Tech stack</h3>${r.blocked ? '<span class="muted">The site blocked our reader, so details are limited</span>' : ''}</div>
      <div class="stack">
        <div>
          <span class="label">Can we take it? (internal)</span><h4>${dotted(r.fit.tone, r.fit.verdict)}</h4>${reasons(r.fit.reasons)}
          <span class="label sub">What this means for the client</span><h4>${dotted(v.tone, esc(v.title))}</h4>${reasons(v.reasons)}
        </div>
        <div class="tech">${groups.map(g => `<div class="g"><span>${g}</span><span>Confidence</span></div>` + r.stack.items.filter(i => i.group === g).map(i => `<div class="t"><i class="dot ${i.status}"></i><span>${esc(i.name)}${i.version ? ` <code>${esc(i.version)}</code>` : ''}</span><small>${esc(i.note)}</small><em>${i.conf}</em></div>`).join('')).join('')}</div>
      </div>
    </div>

    <div class="card" id="sec-strengths">
      <div class="card-head"><h3>What is working well</h3><span class="muted">Keep these in any revamp</span></div>
      ${r.strengths.length ? `<ul class="goodlist">${r.strengths.map(x => `<li><i class="dot good"></i><span>${esc(x)}</span></li>`).join('')}</ul>` : '<p class="note">Nothing stood out as a strength on the things we can measure.</p>'}
    </div>

    <div class="card" id="sec-findings">
      <div class="card-head"><h3>Findings</h3><span class="muted" id="count"></span></div>
      <div class="tools">
        <label class="field">${icon('search')}<input id="q" type="search" placeholder="Search findings" aria-label="Search findings"></label>
        <label class="pill soft">Show: <select id="cat"><option value="all">All categories</option>${CATS.map(c => `<option value="${c}">${CAT_NAME[c]}</option>`).join('')}</select></label>
      </div>
      <div class="tablewrap"><table><thead><tr><th>Finding</th><th>Category</th><th>Severity</th><th>Found on</th><th>What we would do</th></tr></thead><tbody id="rows"></tbody></table></div>
      <button type="button" class="link more" id="more" hidden></button>
    </div>

    <div class="card" id="sec-steps">
      <div class="card-head"><h3>Recommended next steps</h3><span class="muted">Each one maps to a service package</span></div>
      <div class="steps3">${stepsHtml(r, true)}</div>
    </div>`;
  if (m || d) drawChart($('#chart'), m, d);
  drawRows();
}

function drawRows() {
  const q = S.q.toLowerCase();
  const list = S.result.issues.filter(f => (S.cat === 'all' || f.cat === S.cat) && (!q || (f.title + ' ' + f.detail + ' ' + f.fix).toLowerCase().includes(q)));
  const shown = S.more ? list : list.slice(0, 8);
  $('#rows').innerHTML = shown.map(f => `<tr><td><b>${esc(f.title)}</b><span class="d">${esc(f.detail)}</span></td><td>${CAT_NAME[f.cat]}</td><td class="nw">${dotted(SEV[f.sev], f.sev)}</td><td>${esc(f.where)}</td><td>${esc(f.fix)}</td></tr>`).join('')
    || `<tr><td colspan="5" class="empty">${S.result.issues.length ? 'Nothing matches that filter.' : 'No issues found on the things we can measure.'}</td></tr>`;
  $('#count').textContent = `${list.length} ${list.length === 1 ? 'item' : 'items'}`;
  const more = $('#more'); more.hidden = list.length <= 8; more.textContent = S.more ? 'View less' : `View more (${list.length - 8})`;
}

// Grouped bars: metric score out of 100, mobile next to desktop. Values are in the tooltip and the Page speed card.
function drawChart(el, m, d) {
  const W = 520, Hh = 270, L = 34, R = 6, T = 14, B = 32, pw = W - L - R, ph = Hh - T - B, bw = 14;
  const base = (m || d).metrics, y = v => T + ph - (v / 100) * ph, gw = pw / base.length;
  const bar = (x, s, k) => { if (s == null) return ''; const h = Math.max(3, (s / 100) * ph), r = Math.min(4, h), yy = y(0) - h; return `<path class="bar ${k}" d="M${x},${y(0)}V${yy + r}Q${x},${yy} ${x + r},${yy}H${x + bw - r}Q${x + bw},${yy} ${x + bw},${yy + r}V${y(0)}Z"/>`; };
  let s = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Speed metric scores out of 100 for mobile and desktop">`;
  for (const t of [0, 50, 100]) s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${L - 10}" y="${y(t) + 4}" text-anchor="end">${t}</text>`;
  base.forEach((mt, i) => {
    const cx = L + gw * i + gw / 2;
    s += `<rect class="hit" data-i="${i}" x="${cx - gw / 2 + 6}" y="${T - 6}" width="${gw - 12}" height="${ph + 6}" rx="14"/>`
      + bar(cx - bw - 1, m ? m.metrics[i].score : null, 'm') + bar(cx + 1, d ? d.metrics[i].score : null, 'd')
      + `<text class="tick" x="${cx}" y="${Hh - 8}" text-anchor="middle">${mt.short}</text>`;
  });
  el.innerHTML = s + '</svg><div class="tip" id="tip"></div>';
  const tip = $('#tip', el);
  const show = i => {
    const mm = m && m.metrics[i], dd = d && d.metrics[i], top = Math.max(mm && mm.score || 0, dd && dd.score || 0);
    tip.innerHTML = `<b>${base[i].name} (${base[i].short})</b>${mm ? `<span><i class="dot m"></i>Mobile<em>${esc(mm.display || '\u2013')}</em></span>` : ''}${dd ? `<span><i class="dot d"></i>Desktop<em>${esc(dd.display || '\u2013')}</em></span>` : ''}`;
    tip.style.left = ((L + gw * i + gw / 2) / W * 100) + '%';
    tip.style.top = `calc(${(y(top) / Hh * 100)}% - 10px)`;
    tip.classList.add('on');
    el.querySelectorAll('.hit').forEach(x => x.classList.toggle('on', +x.dataset.i === i));
  };
  const hide = () => { tip.classList.remove('on'); el.querySelectorAll('.hit').forEach(x => x.classList.remove('on')); };
  el.addEventListener('pointermove', e => { const x = e.target.closest('.hit'); x ? show(+x.dataset.i) : hide(); });
  el.addEventListener('pointerleave', hide);
}

// ---------- PDF report (print layout). mode: 'client' to share, 'internal' adds skills fit, versions and packages.
function buildReport(mode) {
  const r = S.result, m = good(r.psi.mobile), d = good(r.psi.desktop), v = r.stack.verdict, h = r.health, int = mode === 'internal';
  const cell = (s, t = tone) => (s == null ? '\u2013' : dotted(t(s), s));
  const main = g => r.stack.items.filter(i => i.group === g && !/^Not detected|^PHP version/.test(i.name)).map(i => i.name);
  const built = [...main('Platform'), ...main('Page builder')].join(' and '), theme = main('Theme')[0], host = main('Hosting').filter(x => x !== 'PHP').join(', ');
  $('#report').innerHTML = `
    <div class="rp-head">${LOGO}SenseCheck<span>${int ? 'Internal website audit' : 'Website health report'}, ${fmt(r.date)}</span></div>
    <h1>${esc(r.domain)}</h1>
    <p class="rp-verdict">${dotted(r.verdict.tone, esc(r.verdict.label))}</p>
    <p class="rp-sum">${esc(r.verdict.summary)}</p>
    ${int ? `<div class="rp-box" style="margin-top:12pt"><h3>Can we take it? ${dotted(r.fit.tone, r.fit.verdict)}</h3>${reasons(r.fit.reasons)}</div>` : ''}
    <div class="rp-top">
      ${(d && d.shot) || (m && m.shot) ? `<div class="shots">${d && d.shot ? `<img src="${esc(d.shot)}" alt="">` : ''}${m && m.shot ? `<img src="${esc(m.shot)}" alt="">` : ''}</div>` : ''}
      <div class="scores"><table><thead><tr><th>Website health</th><th>Score out of 100</th></tr></thead><tbody>
        <tr><td><b>Overall</b></td><td><b>${cell(h.score, htone)}</b></td></tr>
        ${CATS.map(c => `<tr><td>${CAT_NAME[c]}</td><td>${h.sub[c] == null ? 'Not measured' : cell(h.sub[c], htone)}</td></tr>`).join('')}
      </tbody></table></div>
    </div>

    <h2>Page speed</h2>
    ${m || d ? `<table><thead><tr><th>Measure</th><th>Mobile</th><th>Desktop</th></tr></thead><tbody>
      ${LH.map(([k, n]) => `<tr><td><b>${n} score</b></td><td>${cell(m ? m.scores[k] : null)}</td><td>${cell(d ? d.scores[k] : null)}</td></tr>`).join('')}
      ${(m || d).metrics.map((x, i) => `<tr><td>${x.name} <span class="d">(${x.short})</span></td><td>${m ? dotted(tone(m.metrics[i].score), esc(m.metrics[i].display)) : '\u2013'}</td><td>${d ? dotted(tone(d.metrics[i].score), esc(d.metrics[i].display)) : '\u2013'}</td></tr>`).join('')}
    </tbody></table>` : '<p>The speed test could not be completed for this site.</p>'}
    ${m && m.field && m.field.lcp ? `<p class="rp-sum">Real visitors on Chrome over the last 28 days: main content appears in ${(m.field.lcp.value / 1000).toFixed(1)} s${m.field.overall ? `, rated ${{ FAST: 'fast', AVERAGE: 'average', SLOW: 'slow' }[m.field.overall] || 'unrated'} overall` : ''}.</p>` : ''}

    <h2>What is working well</h2>
    ${r.strengths.length ? `<ul class="rp-good">${r.strengths.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p>Nothing stood out as a strength on the things we can measure.</p>'}

    <h2>What we found</h2>
    ${r.issues.length ? `<table><thead><tr><th>Finding</th><th>Severity</th><th>Found on</th><th>What we would do</th></tr></thead><tbody>
      ${r.issues.map(f => `<tr><td style="width:40%"><b>${esc(f.title)}</b><br><span class="d">${esc(f.detail)}</span></td><td>${dotted(SEV[f.sev], f.sev)}</td><td>${esc(f.where)}</td><td>${esc(f.fix)}</td></tr>`).join('')}</tbody></table>` : '<p>No issues found on the things we can measure.</p>'}

    <h2>Technology</h2>
    ${int ? '' : `<p>${built ? `The site runs on ${esc(built)}${theme ? `, using the ${esc(theme)} theme` : ''}.` : 'The platform could not be detected from the public pages.'}${host ? ` Hosting: ${esc(host)}.` : ''}</p>`}
    <div class="rp-box" style="margin-top:8pt"><h3>${esc(v.title)}</h3>${reasons(v.reasons)}</div>
    ${int && r.stack.items.length ? `<table style="margin-top:10pt"><thead><tr><th>Component</th><th>Type</th><th>Version</th><th>Status</th><th>Confidence</th></tr></thead><tbody>
      ${r.stack.items.map(i => `<tr><td><b>${esc(i.name)}</b></td><td>${i.group}</td><td>${esc(i.version || '\u2013')}</td><td>${i.note ? dotted(i.status, esc(i.note)) : ''}</td><td>${i.conf}</td></tr>`).join('')}</tbody></table>` : ''}

    <h2>Recommended next steps</h2>
    <div class="rp-cols">${stepsHtml(r, int)}</div>
    <p class="rp-foot">Prepared by MYSense, mysense.com.my. ${r.pagesChecked ? `${r.pagesChecked} public ${r.pagesChecked === 1 ? 'page was' : 'pages were'} checked on ${fmt(r.date)}. ` : ''}Speed scores come from Google PageSpeed Insights (Lighthouse); lab results vary slightly between runs. Technology is read from public page code, so hidden components may not appear.</p>`;
}
function printReport(mode) {
  if (!S.result) return;
  buildReport(mode);
  document.title = `SenseCheck ${mode === 'internal' ? 'Internal Audit' : 'Report'} - ${S.result.domain}`;
  Promise.all([...document.querySelectorAll('#report img')].map(i => (i.decode ? i.decode().catch(() => {}) : 0))).then(() => { window.print(); setTimeout(() => { document.title = 'SenseCheck'; }, 500); });
}

// ---------- routing and events
function render() {
  drawNav();
  if (S.route === 'result' && S.result) renderResult();
  else if (S.route === 'history') renderHistory();
  else if (S.route !== 'scan') renderNew();
}
function go(to) {
  if (to.startsWith('pdf-')) return printReport(to.slice(4));
  if (S.busy) return toast('A scan is still running.');
  if (to === 'new' || to === 'history') { S.route = to; render(); window.scrollTo(0, 0); return; }
  if (!S.result) return;
  const was = S.route; S.route = 'result'; S.sec = to;
  if (was !== 'result') render(); else drawNav();
  const el = $('#sec-' + to); if (el) el.scrollIntoView({ behavior: 'smooth', block: to === 'overview' ? 'center' : 'start' });
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-go],[data-open],[data-remove],[data-rescan],#more');
  if (!t) return;
  if (t.dataset.go) { e.preventDefault(); go(t.dataset.go); }
  else if (t.dataset.open) { const r = hist.all().find(x => String(x.id) === t.dataset.open); if (r) open(r); }
  else if (t.dataset.remove) { hist.remove(t.dataset.remove); render(); }
  else if ('rescan' in t.dataset) runScan(S.result.url);
  else if (t.id === 'more') { S.more = !S.more; drawRows(); }
});
document.addEventListener('submit', e => { if (e.target.id === 'f') { e.preventDefault(); runScan($('#u').value); } });
document.addEventListener('change', e => {
  if (e.target.id === 'strat') { S.strategy = e.target.value; renderResult(); }
  if (e.target.id === 'cat') { S.cat = e.target.value; S.more = false; drawRows(); }
  if (e.target.id === 'max') S.max = +e.target.value;
});
document.addEventListener('input', e => { if (e.target.id === 'q') { S.q = e.target.value; drawRows(); } });

render();
