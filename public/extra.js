// SenseCheck extras: website activity (new posts and pages per month), Core Web Vitals, stability, the SEO score
// and the close look at one blog post.
// The readers run during a scan and keep only plain numbers and short texts. The word builders run whenever a
// screen or report is drawn, in English or Bahasa Malaysia (lang 'bm'), from what the scan kept.

const DAY = 864e5;
const say = lang => (en, bm) => (lang === 'bm' ? bm : en);
const n_ = (n, w, ws) => `${n} ${n === 1 ? w : ws || w + 's'}`;
const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
const tone100 = v => (v == null ? 'info' : v >= 80 ? 'good' : v >= 55 ? 'warn' : 'bad');
const ok = p => (p && !p.error ? p : null);
const ago = iso => (iso ? Math.floor((Date.now() - Date.parse(iso)) / DAY) : null);
const monthsAgo = iso => Math.max(0, Math.round(ago(iso) / 30.4));
const fmtDay = (iso, lang) => new Date(iso).toLocaleDateString(lang === 'bm' ? 'ms-MY' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const decode = s => { const t = document.createElement('textarea'); t.innerHTML = String(s || ''); return t.value.replace(/\s+/g, ' ').trim(); };
const POSTISH = /\/(blogs?|news|berita|artikel|articles?|insights?|posts?|stories|updates)\/[^/]|\/(19|20)\d{2}\/\d{1,2}\//i;

// ---------- website activity
// WordPress sites tell us the real publish date of every post and page through their public feed (/wp-json).
// Other sites only have the "last changed" date in their sitemap, which we use instead and say so.
export async function readActivity(origin, isWp, sitemapUrls, net) {
  const items = { post: [], page: [] }, totals = {};
  let source = '';
  if (isWp) {
    const get = async (type, page) => {
      const x = await net.soft(`${origin}/wp-json/wp/v2/${type}?per_page=100&page=${page}&orderby=date&order=desc&_fields=date,modified,link,title`);
      if (!x || x.status !== 200) return null;
      try { const list = JSON.parse(x.html); return Array.isArray(list) ? { list, total: +(x.headers['x-wp-total'] || 0), pages: +(x.headers['x-wp-totalpages'] || 1) } : null; } catch { return null; }
    };
    for (const [type, key] of [['posts', 'post'], ['pages', 'page']]) {
      let page = 1, got = await get(type, 1);
      if (!got) continue;
      source = 'wp'; totals[key] = got.total || got.list.length;
      for (;;) {
        for (const p of got.list) items[key].push({ url: p.link, title: decode(p.title && p.title.rendered), date: p.date, mod: p.modified });
        const last = got.list[got.list.length - 1];
        // more than 100 posts in a year: read up to two more lists so the graph covers the full twelve months
        if (key !== 'post' || page >= Math.min(3, got.pages) || !last || ago(last.date) > 366) break;
        got = await get(type, ++page); if (!got) break;
      }
    }
  }
  if (!source) {
    for (const u of sitemapUrls || []) if (u.mod) (u.type === 'post' || POSTISH.test(u.href) ? items.post : items.page).push({ url: u.href, title: '', date: u.mod });
    if (items.post.length || items.page.length) { source = 'sitemap'; totals.post = items.post.length; totals.page = items.page.length; }
  }
  if (!source) return { activity: { source: '' }, candidates: [] };
  // twelve calendar months, oldest first, ending with this one
  const now = new Date(), months = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ k: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, posts: 0, pages: 0 }); }
  const at = new Map(months.map(m => [m.k, m]));
  for (const p of items.post) { const m = at.get(String(p.date).slice(0, 7)); if (m) m.posts++; }
  for (const p of items.page) { const m = at.get(String(p.date).slice(0, 7)); if (m) m.pages++; }
  const newest = list => list.map(p => p.date).filter(Boolean).sort().pop() || null;
  const recent = [...items.post.map(p => ({ ...p, kind: 'post' })), ...items.page.map(p => ({ ...p, kind: 'page' }))]
    .filter(p => ago(p.date) <= 90).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8)
    .map(p => ({ url: p.url, title: p.title, date: p.date, kind: p.kind }));
  const candidates = items.post.filter(p => p.url).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 30);
  return { activity: { source, months, totals: { posts: totals.post || 0, pages: totals.page || 0 }, lastPost: newest(items.post), lastPage: newest(items.page), recent }, candidates };
}

export function activityOf(r, lang = 'en') {
  const A = r.activity, W = say(lang);
  if (!A || !A.source) return { tone: 'info', label: W('No dates to go on', 'Tiada tarikh untuk disemak'), line: W('The site doesn’t publish dates we can read, so we can’t tell how often it changes.', 'Laman ini tidak menunjukkan tarikh yang boleh kami baca, jadi kami tidak dapat tahu kekerapan ia dikemas kini.') };
  const posts12 = A.months.reduce((t, m) => t + m.posts, 0), pages12 = A.months.reduce((t, m) => t + m.pages, 0);
  const last3 = A.months.slice(-3).reduce((t, m) => t + m.posts, 0), quiet = A.lastPost ? ago(A.lastPost) : null;
  const newPages = (A.recent || []).filter(p => p.kind === 'page').length;
  const base = { posts12, pages12, last3, newPages, exact: A.source === 'wp' };
  if (!A.totals.posts) return { ...base, tone: 'warn', label: W('No blog', 'Tiada blog'), line: W('There’s no blog, so Google has nothing new to find between redesigns.', 'Tiada blog, jadi Google tiada kandungan baharu untuk ditemui.') };
  if (quiet > 180) return { ...base, tone: 'bad', label: W('Gone quiet', 'Sudah lama senyap'), line: W(`The last new post was ${monthsAgo(A.lastPost)} months ago. Google favours sites that keep adding things.`, `Artikel baharu terakhir ${monthsAgo(A.lastPost)} bulan lalu. Google lebih suka laman yang sentiasa menambah kandungan.`) };
  if (last3 >= 3) return { ...base, tone: 'good', label: W('Active', 'Aktif'), line: W(`${n_(last3, 'new post')} in the last 3 months. Nice and steady.`, `${last3} artikel baharu dalam 3 bulan lepas. Konsisten.`) };
  return { ...base, tone: 'warn', label: W('Slow', 'Perlahan'), line: W(`Only ${n_(posts12, 'new post')} in the last 12 months.`, `Hanya ${posts12} artikel baharu dalam 12 bulan lepas.`) };
}

// ---------- Core Web Vitals
// Google's three measures of how a page feels to use. Real-visitor data (Chrome users, last 28 days) decides the
// pass or fail. Small sites have none, so the lab test stands in and the card says so.
const CWV = [
  { k: 'lcp', name: ['Main content shows', 'Kandungan utama muncul'], good: 2500, poor: 4000, show: v => `${(v / 1000).toFixed(1)} s`, aim: ['under 2.5 s', 'bawah 2.5 s'] },
  { k: 'inp', name: ['Reacts to a tap', 'Respons pada sentuhan'], good: 200, poor: 500, show: v => `${Math.round(v)} ms`, aim: ['under 200 ms', 'bawah 200 ms'] },
  { k: 'cls', name: ['Stays still while loading', 'Tidak beralih semasa dimuat'], good: 0.1, poor: 0.25, show: v => v.toFixed(2), aim: ['under 0.10', 'bawah 0.10'] },
];
const rate = (c, v) => (v == null ? 'info' : v <= c.good ? 'good' : v <= c.poor ? 'warn' : 'bad');
export function cwvOf(r, lang = 'en') {
  const W = say(lang), m = ok(r.psi.mobile), f = m && m.field && m.field.lcp ? m.field : null;
  if (!m) return { tone: 'info', label: W('Not measured', 'Tidak diukur'), line: W('Google’s test didn’t run, so we have no vitals this time.', 'Ujian Google tidak berjalan, jadi tiada data kali ini.'), items: [] };
  const lab = id => (m.metrics.find(x => x.id === id) || {}).value;
  const val = { lcp: f ? f.lcp.value : lab('largest-contentful-paint'), inp: f ? (f.inp ? f.inp.value : null) : lab('total-blocking-time'), cls: f ? (f.cls ? f.cls.value / 100 : null) : lab('cumulative-layout-shift') };
  const items = CWV.map(c => ({ k: c.k, name: W(...c.name), value: val[c.k] == null ? '–' : c.show(val[c.k]), tone: rate(c, val[c.k]), aim: W(...c.aim), stand: !f && c.k === 'inp' }));
  const ts = items.map(i => i.tone), pass = ts.every(t => t === 'good' || t === 'info') && ts.some(t => t === 'good'), fail = ts.includes('bad') || ts.filter(t => t === 'warn').length;
  const label = f ? (pass ? W('Passes', 'Lulus') : W('Fails', 'Gagal')) : pass ? W('Likely passes', 'Mungkin lulus') : W('Likely fails', 'Mungkin gagal');
  const line = f ? (pass ? W('Real visitors on phones get a good experience on all three.', 'Pelawat sebenar di telefon mendapat pengalaman yang baik untuk ketiga-tiganya.') : W('Real visitors on phones are having a slower experience than Google wants. Google uses this when it ranks pages.', 'Pelawat sebenar di telefon mendapat pengalaman yang lebih perlahan daripada yang Google mahu. Google menggunakan ini semasa menyusun kedudukan.'))
    : W('Not enough visitors for Google’s real data yet, so this is from our lab test. Blocking time stands in for tap response.', 'Pelawat belum cukup untuk data sebenar Google, jadi ini daripada ujian makmal. Masa sekatan digunakan bagi respons sentuhan.');
  return { tone: pass ? 'good' : fail ? 'bad' : 'warn', label, line, items, field: !!f, pass };
}
// The weekly history from the Chrome UX Report, kept as three short lists of numbers.
export function cruxFrom(j) {
  const rec = j && j.record; if (!rec || !rec.metrics) return null;
  const day = d => d && `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
  const ser = (k, f) => (((rec.metrics[k] || {}).percentilesTimeseries || {}).p75s || []).map(v => (v == null || v === 'NaN' ? null : f(v)));
  const out = { dates: (rec.collectionPeriods || []).map(p => day(p.lastDate)), lcp: ser('largest_contentful_paint', Number), inp: ser('interaction_to_next_paint', Number), cls: ser('cumulative_layout_shift', Number) };
  return out.dates.length > 2 && out.lcp.some(v => v != null) ? out : null;
}
// Three small line charts, one per measure, with Google's "good" level drawn as a dashed line.
export function trendSvg(t, lang = 'en') {
  if (!t) return '';
  const W = 220, H = 70, P = 6, rows = CWV.map(c => ({ c, v: t[c.k] }));
  return rows.map(({ c, v }) => {
    const nums = v.filter(x => x != null); if (nums.length < 2) return '';
    const hi = Math.max(c.good, ...nums), lo = Math.min(c.good, ...nums), pad = (hi - lo) * 0.25 || hi * 0.1, top = hi + pad, bot = Math.max(0, lo - pad), x = i => P + (i / (v.length - 1)) * (W - 2 * P), y = val => H - P - ((val - bot) / (top - bot)) * (H - 2 * P);
    const pts = v.map((val, i) => (val == null ? null : [x(i), y(val)])).filter(Boolean), last = nums[nums.length - 1], first = nums[0];
    const trend = last < first * 0.9 ? say(lang)('getting better', 'semakin baik') : last > first * 1.1 ? say(lang)('getting worse', 'semakin teruk') : say(lang)('about the same', 'lebih kurang sama');
    return `<div class="trend"><div class="trend-head"><b>${say(lang)(...c.name)}</b><span><i class="dot ${rate(c, last)}"></i>${c.show(last)}, ${trend}</span></div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><line class="goodline" x1="${P}" x2="${W - P}" y1="${y(c.good)}" y2="${y(c.good)}"/><polyline class="tline ${rate(c, last)}" points="${pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}"/><path class="tdot ${rate(c, last)}" d="M${pts[pts.length - 1].map(n => n.toFixed(1)).join(' ')}h0"/></svg></div>`;
  }).join('');
}

// ---------- stability
// One scan can't watch a site for weeks, so this reads the signs of a site that breaks: does it answer every
// time, does the answer time jump around, are there errors, is the software kept up and is anything about to run out.
export async function readStability(url, net) {
  const tries = [];
  for (let i = 0; i < 4; i++) {
    if (i) await net.sleep(1500);
    const t0 = performance.now(), m = await net.peek(url);
    tries.push(m && m.status && m.status < 500 ? { s: m.status, ms: m.ttfb != null ? m.ttfb : Math.round(performance.now() - t0) } : { s: m ? m.status || 0 : 0, ms: null });
  }
  return tries;
}
export function stabilityOf(r, lang = 'en', trouble = null) {
  const W = say(lang), S = r.stab, s = r.stack || {}, rows = [];
  const add = (tn, text, hard) => rows.push({ tone: tn, text, hard: !!hard });
  if (S && S.tries && S.tries.length) {
    const up = S.tries.filter(t => t.ms != null), n = S.tries.length;
    if (up.length === n) add('good', W(`Answered all ${n} of our visits`, `Menjawab kesemua ${n} lawatan kami`));
    else add('bad', W(`Didn’t answer ${n - up.length} of our ${n} visits`, `Tidak menjawab ${n - up.length} daripada ${n} lawatan kami`), true);
    if (up.length) {
      const ms = up.map(t => t.ms), lo = Math.min(...ms), hi = Math.max(...ms), avg = ms.reduce((a, b) => a + b, 0) / ms.length, sec = v => `${(v / 1000).toFixed(1)} s`;
      if (hi > 1500 && hi > lo * 3) add('warn', W(`Answer time jumps around (${sec(lo)} to ${sec(hi)}), a sign of busy hosting`, `Masa jawapan tidak menentu (${sec(lo)} hingga ${sec(hi)}), tanda pengehosan yang sibuk`));
      else if (avg > 1800) add('warn', W(`Slow to answer, about ${sec(avg)} each time`, `Lambat menjawab, kira-kira ${sec(avg)} setiap kali`));
      else add('good', W(`Answers quickly and steadily (${sec(lo)}${hi - lo >= 100 ? ` to ${sec(hi)}` : ''})`, `Menjawab dengan pantas dan stabil (${sec(lo)}${hi - lo >= 100 ? ` hingga ${sec(hi)}` : ''})`));
    }
  }
  if (S) {
    if (S.b5xx) add('bad', W(`${n_(S.b5xx, 'page')} gave a server error`, `${S.b5xx} halaman memberi ralat pelayan`), true);
    else if (S.b404) add('warn', W(`${n_(S.b404, 'link')} lead${S.b404 === 1 ? 's' : ''} to a missing page`, `${S.b404} pautan menuju ke halaman yang tiada`));
    else if (S.pages) add('good', W(`No errors on the ${n_(S.pages, 'page')} we opened`, `Tiada ralat pada ${S.pages} halaman yang kami buka`));
  }
  if (trouble) add('warn', W('Google’s test couldn’t load it fully', 'Ujian Google tidak dapat memuatkannya sepenuhnya'));
  const V = s.vulns || [], holes = V.reduce((t, v) => t + v.count, 0), oldP = (s.outdatedPlugins || []).length;
  if (holes) add('bad', W(`At least ${n_(holes, 'known security hole')} in its software`, `Sekurang-kurangnya ${holes} lubang keselamatan yang diketahui dalam perisiannya`));
  else if (s.wp && s.wp.status === 'bad') add('warn', W(`WordPress ${s.wp.version} is out of date`, `WordPress ${s.wp.version} sudah lapuk`));
  if (oldP) add('warn', W(`${n_(oldP, 'plugin')} waiting for updates`, `${oldP} plugin menunggu kemas kini`));
  else if (s.wp && s.wp.status === 'good' && !holes) add('good', W('Software is up to date', 'Perisian dikemas kini'));
  if (s.php && s.php.old) add('warn', W(`Old PHP (${s.php.version}) on the server`, `PHP lama (${s.php.version}) pada pelayan`));
  if (s.ssl) add(s.ssl.soon ? 'bad' : 'good', s.ssl.soon ? W(`Security certificate runs out ${s.ssl.expiresText}`, `Sijil keselamatan tamat ${s.ssl.expiresText}`) : W(`Security certificate valid until ${s.ssl.expiresText}`, `Sijil keselamatan sah hingga ${s.ssl.expiresText}`));
  if (s.domain && s.domain.expires) add(s.domain.soon ? 'bad' : 'good', s.domain.soon ? W(`Domain expires ${s.domain.expiresText}`, `Domain tamat ${s.domain.expiresText}`) : W(`Domain paid up until ${s.domain.expiresText}`, `Domain dibayar hingga ${s.domain.expiresText}`));
  const m = ok(r.psi.mobile), cls = m && m.field && m.field.cls ? m.field.cls.value / 100 : m ? (m.metrics.find(x => x.id === 'cumulative-layout-shift') || {}).value : null;
  if (cls != null) add(cls <= 0.1 ? 'good' : 'warn', cls <= 0.1 ? W('Layout stays still while loading', 'Susun atur tidak beralih semasa dimuat') : W('Things jump around while it loads', 'Elemen beralih semasa ia dimuat'));
  if (!rows.length) return { tone: 'info', label: W('Not checked', 'Tidak disemak'), line: W('Scan again to run the stability checks.', 'Imbas semula untuk menjalankan semakan kestabilan.'), rows };
  const bad = rows.filter(x => x.tone === 'bad'), warn = rows.filter(x => x.tone === 'warn');
  const unstable = bad.some(x => x.hard);
  const tone = unstable ? 'bad' : bad.length || warn.length ? 'warn' : 'good', minor = tone === 'warn' && !bad.length && warn.length === 1;
  const label = unstable ? W('Unstable', 'Tidak stabil') : minor ? W('Mostly stable', 'Kebanyakannya stabil') : tone === 'warn' ? W('Some risks', 'Ada risiko') : W('Stable', 'Stabil');
  const line = unstable ? W('The site failed during our check. Some visitors are probably hitting errors too.', 'Laman ini gagal semasa semakan kami. Mungkin sebahagian pelawat juga menemui ralat.')
    : minor ? W('Works well, with one thing to tidy up.', 'Berfungsi dengan baik, cuma ada satu perkara untuk dikemas.')
      : tone === 'warn' ? W('It works today, but a few things make it likely to break or get hacked later.', 'Ia berfungsi hari ini, tetapi beberapa perkara menjadikannya mudah rosak atau digodam kemudian.')
        : W('Answers every time, no errors and nothing about to run out.', 'Menjawab setiap kali, tiada ralat dan tiada apa yang hampir tamat.');
  // problems first, then the good news
  const order = { bad: 0, warn: 1, good: 2, info: 3 };
  return { tone, label, line, rows: rows.sort((a, b) => order[a.tone] - order[b.tone]) };
}

// ---------- SEO score
// Plain counts from every page we opened, kept with the scan so the score can be explained later.
export function seoFacts(P, site, extra = {}) {
  const n = P.length, home = P[0] || {};
  const dup = k => { const c = {}; P.forEach(p => { if (p[k]) (c[p[k]] = c[p[k]] || []).push(p); }); return Object.values(c).filter(v => v.length > 1).reduce((t, v) => t + v.length, 0); };
  const cnt = f => P.filter(f).length;
  return {
    n, noTitle: cnt(p => !p.title), dupTitle: dup('title'), longTitle: cnt(p => p.title && p.title.length > 65), noDesc: cnt(p => !p.desc), dupDesc: dup('desc'), longDesc: cnt(p => p.desc && p.desc.length > 170),
    noH1: cnt(p => p.h1 === 0), multiH1: cnt(p => p.h1 > 1), skipped: cnt(p => p.skipped), thin: cnt(p => p.words < 60), noCanon: cnt(p => !p.canonical), noindex: cnt(p => p.noindex), homeNoindex: !!home.noindex,
    imgs: P.reduce((t, p) => t + p.imgs, 0), noAlt: P.reduce((t, p) => t + p.noAlt, 0), viewport: !!home.viewport, ld: !!home.ld, og: !!home.og,
    sitemap: site.sitemap, robots: site.robots, llms: !!extra.llms,
  };
}
const SEO_W = { find: 20, titles: 20, heads: 12, content: 16, images: 8, speed: 14, rich: 10 };
export function seoOf(r, lang = 'en') {
  const F = r.seoRaw, W = say(lang);
  if (!F || !F.n) return null;
  const share = k => F[k] / F.n, parts = [];
  const part = (key, name, score, good, bad) => parts.push({ key, name, score: score == null ? null : clamp(score), line: score == null ? '' : clamp(score) >= 97 ? good : bad });
  // Can Google find and list the pages?
  const find = F.homeNoindex ? 0 : 100 - (F.sitemap === false ? 25 : 0) - (F.robots === false ? 10 : 0) - share('noindex') * 60 - share('noCanon') * 20;
  const findBad = F.homeNoindex ? W('The homepage tells Google not to list it.', 'Halaman utama memberitahu Google supaya tidak menyenaraikannya.')
    : F.noindex ? W(`${n_(F.noindex, 'page')} tell${F.noindex === 1 ? 's' : ''} Google not to list ${F.noindex === 1 ? 'it' : 'them'}.`, `${F.noindex} halaman memberitahu Google supaya tidak menyenaraikannya.`)
      : F.sitemap === false ? W('No sitemap, so new pages are slow to be found.', 'Tiada peta laman, jadi halaman baharu lambat ditemui.') : W(`${n_(F.noCanon, 'page')} could show up twice on Google.`, `${F.noCanon} halaman mungkin muncul dua kali di Google.`);
  part('find', W('Google can find it', 'Google boleh menemuinya'), find, W('Sitemap and settings let Google find every page.', 'Peta laman dan tetapan membolehkan Google menemui setiap halaman.'), findBad);
  const titles = 100 - share('noTitle') * 100 - share('dupTitle') * 50 - share('longTitle') * 20 - share('noDesc') * 50 - share('dupDesc') * 25 - share('longDesc') * 10;
  const tBad = F.noDesc ? W(`${F.noDesc} of ${F.n} pages have no description for Google.`, `${F.noDesc} daripada ${F.n} halaman tiada penerangan untuk Google.`) : F.dupTitle ? W(`${F.dupTitle} pages share the same title.`, `${F.dupTitle} halaman berkongsi tajuk yang sama.`) : F.longTitle ? W(`${n_(F.longTitle, 'title')} too long, so Google cuts ${F.longTitle === 1 ? 'it' : 'them'} off.`, `${F.longTitle} tajuk terlalu panjang dan dipotong oleh Google.`) : W('Some titles or descriptions need work.', 'Sebahagian tajuk atau penerangan perlu diperbaiki.');
  part('titles', W('Titles and descriptions', 'Tajuk dan penerangan'), titles, W('Every page has its own clear title and description.', 'Setiap halaman ada tajuk dan penerangan tersendiri.'), tBad);
  const heads = 100 - share('noH1') * 70 - share('multiH1') * 30 - share('skipped') * 20;
  part('heads', W('Headings', 'Tajuk kecil'), heads, W('Each page has one clear main heading.', 'Setiap halaman ada satu tajuk utama yang jelas.'), F.noH1 ? W(`${n_(F.noH1, 'page')} with no main heading.`, `${F.noH1} halaman tiada tajuk utama.`) : W('Some pages have more than one main heading, or headings out of order.', 'Sebahagian halaman ada lebih daripada satu tajuk utama, atau tajuk tidak tersusun.'));
  const act = activityOf(r, lang), stale = act.tone === 'bad' ? 25 : act.label === W('No blog', 'Tiada blog') ? 15 : act.tone === 'warn' ? 10 : 0;
  part('content', W('Content', 'Kandungan'), 100 - share('thin') * 70 - stale, W('Pages have real content and new posts keep coming.', 'Halaman ada kandungan sebenar dan artikel baharu terus ditambah.'), F.thin ? W(`${n_(F.thin, 'page')} with almost no text.`, `${F.thin} halaman hampir tiada teks.`) : act.line);
  part('images', W('Image descriptions', 'Penerangan imej'), F.imgs ? 100 - (F.noAlt / F.imgs) * 100 : null, W('Pictures are described for Google.', 'Gambar diterangkan untuk Google.'), W(`${F.noAlt} of ${F.imgs} pictures have no description.`, `${F.noAlt} daripada ${F.imgs} gambar tiada penerangan.`));
  const m = ok(r.psi.mobile), cw = cwvOf(r, lang);
  part('speed', W('Speed on phones', 'Kelajuan di telefon'), m ? m.scores.performance * 0.6 + (cw.pass ? 100 : cw.tone === 'warn' ? 60 : 25) * 0.4 - (F.viewport ? 0 : 40) : null, W('Fast enough on phones for Google.', 'Cukup pantas di telefon untuk Google.'), W(`Phones score ${m ? m.scores.performance : '–'} out of 100, and Google ranks slow pages lower.`, `Telefon mendapat ${m ? m.scores.performance : '–'} daripada 100, dan Google meletakkan halaman perlahan lebih rendah.`));
  part('rich', W('Ready for rich results and AI', 'Sedia untuk hasil kaya dan AI'), 40 + (F.ld ? 30 : 0) + (F.og ? 20 : 0) + (F.llms ? 10 : 0), W('Business details are marked up for Google and AI tools.', 'Butiran perniagaan ditanda untuk Google dan alat AI.'), !F.ld ? W('No business details in a form Google and ChatGPT can read.', 'Tiada butiran perniagaan dalam bentuk yang boleh dibaca Google dan ChatGPT.') : W('Links look plain when shared, and there’s no guide for AI tools.', 'Pautan nampak kosong apabila dikongsi, dan tiada panduan untuk alat AI.'));
  let t = 0, w = 0;
  for (const p of parts) if (p.score != null) { t += p.score * SEO_W[p.key]; w += SEO_W[p.key]; }
  const score = w ? Math.round(t / w) : null, tone = tone100(score);
  const label = tone === 'good' ? W('SEO friendly', 'Mesra SEO') : tone === 'warn' ? W('Getting there', 'Hampir') : W('Not SEO friendly yet', 'Belum mesra SEO');
  return { score, tone, label, parts };
}

// ---------- one blog post, up close
const STOP = new Set('a an the and or but of to in on at for with by from as is are was were be been it its this that these those your you our we my i me how what why when where which who whom do does did can will just about into over than then so not no yes vs also more most best top new guide tips ways 2020 2021 2022 2023 2024 2025 2026 2027 dan atau yang di ke dari untuk dengan ini itu ialah adalah pada dalam bagi anda kami kita cara apa mengapa bila tips panduan terbaik'.split(' '));
const words = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, ' ').split(/\s+/).filter(Boolean);
// What the post seems to be about: the phrase from its title (or main heading) that the text repeats most.
function focusOf(title, h1, site, text) {
  const parts = String(title || '').split(/\s*:\s+|\s+[|\-–—•·]\s+/).filter(Boolean);
  // the part of the title that shares most words with the main heading (the first part on a tie), not the site name
  const hw = new Set(words(h1)), near = p => words(p).filter(w => hw.has(w)).length;
  const main = parts.filter(p => !site || !p.toLowerCase().includes(site.toLowerCase())).reduce((best, p) => (!best || near(p) > near(best) ? p : best), '') || h1 || title || '';
  // a phrase scores for every time the text uses it, plus a head start when the main heading carries it too
  const tw = words(main), body = ` ${words(text).join(' ')} `, head = ` ${words(h1).join(' ')} `, cand = new Map();
  for (const n of [4, 3, 2, 1]) for (let i = 0; i + n <= tw.length; i++) {
    const g = tw.slice(i, i + n); if (STOP.has(g[0]) || STOP.has(g[n - 1]) || g.some(x => x.length < 2 || /^\d+$/.test(x))) continue;
    const ph = g.join(' '), c = body.split(` ${ph} `).length - 1 + (head.includes(` ${ph} `) ? 3 : 0); if (c) cand.set(ph, c * [0, 1, 1.6, 2.2, 2.6][n]);
  }
  const best = [...cand].sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : tw.filter(x => !STOP.has(x)).slice(0, 3).join(' ');
}
export function postFacts(url, html, extra = {}) {
  const doc = new DOMParser().parseFromString(html, 'text/html'), base = new URL(url), host = base.hostname.replace(/^www\./, '');
  const meta = (sel, at = 'content') => ((doc.querySelector(sel) || { getAttribute: () => '' }).getAttribute(at) || '').trim();
  const txt = e => (e && e.textContent ? e.textContent : '').replace(/\s+/g, ' ').trim();
  const lds = [...doc.querySelectorAll('script[type="application/ld+json" i]')].map(s => s.textContent || '').join(' ');
  const site = meta('meta[property="og:site_name" i]');
  const title = txt(doc.querySelector('title')), desc = meta('meta[name="description" i]');
  const h1s = [...doc.querySelectorAll('h1')].map(txt).filter(Boolean);
  const published = meta('meta[property="article:published_time" i]') || (lds.match(/"datePublished"\s*:\s*"([^"]+)"/) || [])[1] || extra.date || '';
  const modified = meta('meta[property="article:modified_time" i]') || (lds.match(/"dateModified"\s*:\s*"([^"]+)"/) || [])[1] || extra.mod || '';
  const author = !!(meta('meta[name="author" i]') || doc.querySelector('[rel~="author"],.author,.byline,.entry-author,.elementor-post-info__item--type-author') || /"author"\s*:/.test(lds));
  const schema = /"@type"\s*:\s*\[?\s*"(Article|BlogPosting|NewsArticle)"/.test(lds);
  // the post itself, without the menu, sidebar, footer and comments around it
  const root = (doc.querySelector('.entry-content, .elementor-widget-theme-post-content, .post-content, .article-content, .blog-content, article, main, [role="main"]') || doc.body || doc.documentElement).cloneNode(true);
  root.querySelectorAll('script,style,noscript,nav,header,footer,aside,form,.comments,#comments,.sharedaddy,.related,.yarpp-related,.wp-block-latest-posts').forEach(x => x.remove());
  const text = txt(root), wc = text ? text.split(' ').length : 0;
  const paras = [...root.querySelectorAll('p')].map(txt).filter(p => p.split(' ').length >= 8);
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.split(' ').length > 2);
  const h2s = [...root.querySelectorAll('h2,h3')].map(txt).filter(Boolean);
  const real = i => i.getAttribute('data-src') || i.getAttribute('data-lazy-src') || i.getAttribute('src') || '';
  const imgs = [...root.querySelectorAll('img')].filter(i => real(i) && !real(i).startsWith('data:') && !/emoji|gravatar|avatar/i.test(real(i)));
  let internal = 0, external = 0;
  for (const a of root.querySelectorAll('a[href]')) { let u; try { u = new URL(a.getAttribute('href'), base); } catch { continue; } if (!/^https?:$/.test(u.protocol) || u.pathname === base.pathname) continue; if (u.hostname.replace(/^www\./, '') === host) internal++; else external++; }
  const focus = focusOf(title, h1s[0], site, text), low = ` ${words(text).join(' ')} `, kw = focus.toLowerCase();
  const has = s => !!kw && ` ${words(s).join(' ')} `.includes(` ${kw} `);
  const slugHas = kw ? kw.split(' ').every(w => decodeURIComponent(base.pathname).toLowerCase().includes(w)) : false;
  const kwCount = kw ? low.split(` ${kw} `).length - 1 : 0;
  return {
    url, path: decodeURIComponent(base.pathname), title, desc, h1: h1s[0] || '', h1n: h1s.length, h2s: h2s.slice(0, 6), h2n: h2s.length,
    intro: (paras[0] || '').slice(0, 320), words: wc, longParas: paras.filter(p => p.split(' ').length > 120).length,
    avgSent: sentences.length ? Math.round(wc / sentences.length) : 0, imgs: imgs.length, noAlt: imgs.filter(i => !(i.getAttribute('alt') || '').trim()).length,
    internal, external, schema, author, published, modified, site, focus, kwCount, _text: text.slice(0, 30000),
    kwIn: { title: has(title), desc: has(desc), h1: has(h1s[0] || ''), slug: slugHas, intro: has((paras[0] || '') + ' ' + (paras[1] || '')), h2: h2s.some(has) },
  };
}
// Each check: where it shows on the preview (key), whether it passed, how much it matters, and the words.
export function postChecks(p, lang = 'en') {
  const W = say(lang), out = [], kw = p.focus ? `“${p.focus}”` : W('the topic', 'topik ini'), page = p.kind === 'page';
  const add = (key, ok, w, title, saw, why, fix) => out.push({ key, ok, w, title, saw, why, fix });
  const tl = p.title.length, dl = p.desc.length;
  if (!p.title) add('title', false, 16, W('There’s no title for Google', 'Tiada tajuk untuk Google'), W('The page has no title at all.', 'Halaman ini langsung tiada tajuk.'), W('The title is the blue headline people click on Google.', 'Tajuk ialah teks biru yang orang klik di Google.'), W('We’d write a clear title of about 55 characters.', 'Kami akan menulis tajuk yang jelas sekitar 55 aksara.'));
  else if (tl > 62) add('title', false, 12, W('The title is too long', 'Tajuknya terlalu panjang'), W(`${tl} characters. Google shows about 60, so the end gets cut off.`, `${tl} aksara. Google hanya tunjuk sekitar 60, jadi hujungnya dipotong.`), W('A cut-off title looks messy and hides the part that makes people click.', 'Tajuk yang terpotong nampak serabut dan menyembunyikan bahagian yang menarik orang klik.'), W(`We’d trim it to about 55 characters, with ${kw} near the start.`, `Kami akan pendekkan kepada sekitar 55 aksara, dengan ${kw} di awal.`));
  else if (tl < 25) add('title', false, 8, W('The title is very short', 'Tajuknya terlalu pendek'), W(`Only ${tl} characters.`, `Hanya ${tl} aksara.`), W('A short title wastes space that could tell people why to click.', 'Tajuk pendek membazir ruang yang boleh memberitahu orang kenapa perlu klik.'), W('We’d add what the reader gets from the post.', 'Kami akan tambah apa yang pembaca dapat daripada artikel ini.'));
  else add('title', true, 12, W('Title is a good length', 'Panjang tajuk sesuai'));
  if (!p.desc) add('desc', false, 12, W('No description for Google', 'Tiada penerangan untuk Google'), W('Google has to guess the grey text under the title.', 'Google terpaksa meneka teks kelabu di bawah tajuk.'), W('It usually picks a random sentence, which rarely makes people click.', 'Biasanya ia memilih ayat rawak, yang jarang menarik orang untuk klik.'), W(`We’d write a 150-character summary that mentions ${kw}.`, `Kami akan menulis ringkasan 150 aksara yang menyebut ${kw}.`));
  else if (dl > 165) add('desc', false, 6, W('The description is too long', 'Penerangannya terlalu panjang'), W(`${dl} characters. Google shows about 155.`, `${dl} aksara. Google tunjuk sekitar 155.`), W('The end gets cut off mid-sentence.', 'Hujungnya dipotong di tengah ayat.'), W('We’d tighten it to one or two short sentences.', 'Kami akan ringkaskan kepada satu atau dua ayat pendek.'));
  else if (!p.kwIn.desc && p.focus) add('desc', false, 5, W('The description doesn’t mention the topic', 'Penerangan tidak menyebut topiknya'), W(`${kw} isn’t in it.`, `${kw} tiada di dalamnya.`), W('Google makes the words people searched for bold, which catches the eye.', 'Google menebalkan perkataan yang dicari, jadi ia lebih menarik perhatian.'), W(`We’d work ${kw} into the description.`, `Kami akan masukkan ${kw} ke dalam penerangan.`));
  else add('desc', true, 12, W('Description is in place', 'Penerangan tersedia'));
  const ugly = /[?&]p=\d|%[0-9a-f]{2}/i.test(p.url) || p.path.length > 80 || /\/\d+\/?$/.test(p.path);
  if (ugly) add('url', false, 5, W('The web address is messy', 'Alamat webnya berselerak'), W(`It reads “${p.path.slice(0, 60)}${p.path.length > 60 ? '…' : ''}”.`, `Ia berbunyi “${p.path.slice(0, 60)}${p.path.length > 60 ? '…' : ''}”.`), W('Short, readable addresses get clicked and shared more.', 'Alamat yang pendek dan mudah dibaca lebih banyak diklik dan dikongsi.'), W('We’d use a short address made of the topic words, with a redirect from the old one.', 'Kami akan guna alamat pendek daripada kata kunci topik, dengan lencongan dari alamat lama.'));
  else if (p.focus && !p.kwIn.slug) add('url', false, 3, W('The web address skips the topic', 'Alamat web tidak menyebut topik'), W(`${kw} isn’t in “${p.path.slice(0, 50)}”.`, `${kw} tiada dalam “${p.path.slice(0, 50)}”.`), W('Topic words in the address are a small extra hint for Google.', 'Kata kunci dalam alamat ialah petunjuk kecil tambahan untuk Google.'), W('We’d include the topic words next time we tidy the address.', 'Kami akan masukkan kata kunci apabila alamat dikemas kini.'));
  else add('url', true, 5, W('Clean web address', 'Alamat web yang kemas'));
  if (!p.h1n) add('h1', false, 10, W('No main heading on the post', 'Tiada tajuk utama dalam artikel'), W('The page has no H1.', 'Halaman ini tiada H1.'), W('The main heading tells Google and readers what the page is about.', 'Tajuk utama memberitahu Google dan pembaca tentang isi halaman.'), W('We’d add one clear main heading.', 'Kami akan tambah satu tajuk utama yang jelas.'));
  else if (p.h1n > 1) add('h1', false, 6, W('More than one main heading', 'Lebih daripada satu tajuk utama'), W(`There are ${p.h1n}.`, `Ada ${p.h1n}.`), W('Several main headings blur what the post is really about.', 'Beberapa tajuk utama mengaburkan isi sebenar artikel.'), W('We’d keep one and turn the rest into subheadings.', 'Kami akan kekalkan satu dan jadikan yang lain tajuk kecil.'));
  else add('h1', true, 10, W('One clear main heading', 'Satu tajuk utama yang jelas'));
  if (p.focus && p.intro && !p.kwIn.intro) add('intro', false, 7, W('The opening doesn’t get to the point', 'Pembukaan tidak terus ke isi'), W(`The first lines don’t mention ${kw}.`, `Ayat pertama tidak menyebut ${kw}.`), W('Readers and Google both decide in the first few lines whether this answers their question.', 'Pembaca dan Google menilai dalam beberapa baris pertama sama ada ini menjawab soalan mereka.'), W(`We’d open with ${kw} and the answer in one or two sentences.`, `Kami akan mulakan dengan ${kw} dan jawapannya dalam satu atau dua ayat.`));
  if (page && p.words < 300) add('length', false, 12, W('Very little text on the page', 'Terlalu sedikit teks pada halaman'), W(`${p.words} words.`, `${p.words} perkataan.`), W('Google needs words to understand what you offer. Thin pages rarely show up.', 'Google perlukan perkataan untuk faham apa yang anda tawarkan. Halaman nipis jarang muncul.'), W('We’d write proper content: what it is, who it’s for, prices and common questions.', 'Kami akan menulis kandungan yang lengkap: apa ia, untuk siapa, harga dan soalan lazim.'));
  else if (!page && p.words < 600) add('length', false, p.words < 300 ? 14 : 10, W('It’s short for a blog post', 'Terlalu pendek untuk artikel blog'), W(`${p.words} words.`, `${p.words} perkataan.`), W('Posts that rank usually cover the question properly, often 800 words or more.', 'Artikel yang mendapat kedudukan biasanya menjawab soalan dengan lengkap, selalunya 800 perkataan atau lebih.'), W('We’d expand it with the questions people actually ask about this.', 'Kami akan kembangkan dengan soalan yang orang benar-benar tanya tentang topik ini.'));
  else add('length', true, 12, W(`Good length (${p.words} words)`, `Panjang yang baik (${p.words} perkataan)`));
  if (!p.h2n && p.words > 300) add('subheads', false, 8, W('One long wall of text', 'Satu blok teks yang panjang'), W('No subheadings at all.', 'Langsung tiada tajuk kecil.'), W('People skim. Without subheadings they leave, and Google can’t see the structure.', 'Orang membaca sepintas lalu. Tanpa tajuk kecil mereka akan pergi, dan Google tidak nampak strukturnya.'), W('We’d break it up with a subheading every few paragraphs.', 'Kami akan pecahkan dengan tajuk kecil setiap beberapa perenggan.'));
  else if (p.h2n && p.focus && !p.kwIn.h2) add('subheads', false, 3, W('Subheadings skip the topic', 'Tajuk kecil tidak menyebut topik'), W(`None of the subheadings mention ${kw}.`, `Tiada tajuk kecil yang menyebut ${kw}.`), W('Subheadings are a strong hint to Google about what each part covers.', 'Tajuk kecil ialah petunjuk kuat kepada Google tentang isi setiap bahagian.'), W('We’d reword one or two subheadings to use the topic words.', 'Kami akan ubah satu atau dua tajuk kecil untuk guna kata kunci.'));
  else if (p.h2n) add('subheads', true, 8, W('Broken up with subheadings', 'Dipecahkan dengan tajuk kecil'));
  if (p.longParas) add('subheads', false, 3, W('Some paragraphs are very long', 'Sebahagian perenggan terlalu panjang'), W(`${n_(p.longParas, 'paragraph')} over 120 words.`, `${p.longParas} perenggan melebihi 120 perkataan.`), W('Big blocks are hard to read on a phone.', 'Blok besar sukar dibaca di telefon.'), W('We’d split them into two or three short paragraphs.', 'Kami akan pecahkan kepada dua atau tiga perenggan pendek.'));
  if (!p.imgs) add('images', false, 5, W('No pictures in the post', 'Tiada gambar dalam artikel'), W('It’s text only.', 'Teks sahaja.'), W('A picture or two keeps people reading and can show up in Google Images.', 'Satu dua gambar membuat orang terus membaca dan boleh muncul di Google Images.'), W('We’d add a relevant photo or diagram.', 'Kami akan tambah foto atau rajah yang berkaitan.'));
  else if (p.noAlt) add('images', false, 5, W('Pictures have no description', 'Gambar tiada penerangan'), W(`${p.noAlt} of ${p.imgs} pictures.`, `${p.noAlt} daripada ${p.imgs} gambar.`), W('Google can’t see pictures. The description (alt text) tells it what they show.', 'Google tidak dapat melihat gambar. Penerangan (alt text) memberitahu apa yang ditunjukkan.'), W('We’d describe each picture in a few words.', 'Kami akan terangkan setiap gambar dalam beberapa perkataan.'));
  else add('images', true, 5, W('Pictures are described', 'Gambar diterangkan'));
  if (!p.internal) add('links', false, 7, W('No links to the rest of the site', 'Tiada pautan ke bahagian lain laman'), W('The post doesn’t link to any service or other post.', 'Artikel tidak memaut ke mana-mana servis atau artikel lain.'), W('Readers hit a dead end instead of finding a service, and Google sees the post as an island.', 'Pembaca menemui jalan mati dan bukannya servis anda, dan Google melihat artikel ini terasing.'), W('We’d link to the matching service page and two related posts.', 'Kami akan memaut ke halaman servis yang berkaitan dan dua artikel lain.'));
  else add('links', true, 7, W('Links to other pages', 'Memaut ke halaman lain'));
  if (p.focus && p.words > 200) {
    const dens = (p.kwCount * p.focus.split(' ').length) / Math.max(1, p.words);
    if (p.kwCount < 2) add('keyword', false, 8, W('The topic is barely mentioned', 'Topiknya jarang disebut'), W(`${kw} appears ${p.kwCount === 1 ? 'once' : 'nowhere'} in the text.`, `${kw} muncul ${p.kwCount === 1 ? 'sekali sahaja' : 'langsung tidak'} dalam teks.`), W('Google needs to see the topic, and the words around it, to know what the post answers.', 'Google perlu melihat topik dan perkataan berkaitan untuk tahu apa yang dijawab oleh artikel.'), W(`We’d use ${kw} naturally a few times, plus the phrases people search for (below).`, `Kami akan guna ${kw} secara semula jadi beberapa kali, bersama frasa yang dicari orang (di bawah).`));
    else if (dens > 0.035) add('keyword', false, 6, W('The topic is repeated too often', 'Topik diulang terlalu kerap'), W(`${kw} appears ${p.kwCount} times.`, `${kw} muncul ${p.kwCount} kali.`), W('It reads unnaturally, and Google can treat it as spam.', 'Ia nampak tidak semula jadi, dan Google boleh menganggapnya spam.'), W('We’d swap some for related phrases.', 'Kami akan gantikan sebahagian dengan frasa berkaitan.'));
    else add('keyword', true, 8, W('Uses the topic naturally', 'Menggunakan topik secara semula jadi'));
  }
  const when = p.modified || p.published, old = when ? ago(when) : null;
  if (!page && old != null && old > 730) add('fresh', false, 6, W('Not updated in a long time', 'Lama tidak dikemas kini'), W(`Last touched ${fmtDay(when, lang)}.`, `Kali terakhir dikemas kini ${fmtDay(when, lang)}.`), W('Old posts slowly slip down Google as newer answers appear.', 'Artikel lama perlahan-lahan jatuh di Google apabila jawapan baharu muncul.'), W('We’d refresh the facts, add a new section and update the date.', 'Kami akan kemas kini fakta, tambah bahagian baharu dan tarikhnya.'));
  if (!p.schema && !page) add('schema', false, 3, W('Google isn’t told it’s an article', 'Google tidak diberitahu ini artikel'), W('No article details (schema) for Google.', 'Tiada butiran artikel (schema) untuk Google.'), W('This helps Google show the date, author and picture in results.', 'Ini membantu Google memaparkan tarikh, penulis dan gambar dalam hasil carian.'), W('We’d switch on article schema in the SEO plugin.', 'Kami akan aktifkan schema artikel dalam plugin SEO.'));
  return out;
}
export const postScore = p => clamp(100 - postChecks(p).filter(c => !c.ok).reduce((t, c) => t + c.w, 0));
// The posts to compare: the newest few plus a spread of older ones, so the weakest is a fair pick.
export function pickPosts(list, n = 6) {
  if (list.length <= n) return list;
  const out = list.slice(0, 3), rest = list.slice(3), step = rest.length / (n - 3);
  for (let i = 0; i < n - 3; i++) out.push(rest[Math.floor(i * step)]);
  return out;
}
// Phrases people type into Google around the topic, from Google's own search suggestions.
export async function suggestFor(focus, text, net) {
  if (!focus) return { suggest: [], have: [], from: '' };
  const x = await net.soft(`https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=my&q=${encodeURIComponent(focus)}`);
  let list = [];
  try { list = (JSON.parse(x && x.status === 200 ? x.html : '[]')[1] || []).map(s => String(s).toLowerCase().trim()); } catch { list = []; }
  list = [...new Set(list)].filter(s => s && s !== focus.toLowerCase() && s.length <= 60).slice(0, 10);
  const low = ` ${words(text).join(' ')} `, inText = s => low.includes(` ${words(s).join(' ')} `);
  return { suggest: list.filter(s => !inText(s)).slice(0, 6), have: list.filter(inText).slice(0, 4), from: list.length ? 'google' : '' };
}
