// SenseCheck analysis: raw page data in, plain-language results out. No network calls in this file.

const PHP_MIN = '8.2'; // oldest PHP branch still getting security fixes. Review each December.

const cmp = (a, b) => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; }
  return 0;
};
const mode = arr => { const c = {}; let best = ''; for (const v of arr) { c[v] = (c[v] || 0) + 1; if (!best || c[v] > c[best]) best = v; } return best; };
const all = (s, re) => [...s.matchAll(re)].map(m => m[1]);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const pretty = slug => slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const PLUGINS = {
  'wordpress-seo': 'Yoast SEO', 'seo-by-rank-math': 'Rank Math SEO', 'all-in-one-seo-pack': 'All in One SEO',
  woocommerce: 'WooCommerce', 'contact-form-7': 'Contact Form 7', 'wpforms-lite': 'WPForms', 'ninja-forms': 'Ninja Forms',
  gravityforms: 'Gravity Forms', 'wp-rocket': 'WP Rocket', 'litespeed-cache': 'LiteSpeed Cache', 'w3-total-cache': 'W3 Total Cache',
  'wp-super-cache': 'WP Super Cache', 'wp-fastest-cache': 'WP Fastest Cache', breeze: 'Breeze', autoptimize: 'Autoptimize',
  revslider: 'Slider Revolution', js_composer: 'WPBakery Page Builder', elementor: 'Elementor', 'elementor-pro': 'Elementor Pro',
  jetpack: 'Jetpack', akismet: 'Akismet', 'sitepress-multilingual-cms': 'WPML', 'translatepress-multilingual': 'TranslatePress',
  gtranslate: 'GTranslate', polylang: 'Polylang', 'google-site-kit': 'Site Kit by Google', 'wp-smushit': 'Smush',
  'ewww-image-optimizer': 'EWWW Image Optimizer', 'essential-addons-for-elementor-lite': 'Essential Addons for Elementor',
  'header-footer-elementor': 'Ultimate Addons for Elementor', 'click-to-chat-for-whatsapp': 'Click to Chat',
  'cookie-law-info': 'CookieYes', 'complianz-gdpr': 'Complianz', 'mailchimp-for-wp': 'Mailchimp for WP',
  'instagram-feed': 'Smash Balloon Instagram Feed', 'bb-plugin': 'Beaver Builder', 'siteorigin-panels': 'SiteOrigin Page Builder',
};

// [id, name, test, note shown when this builder is used instead of Elementor]
const BUILDERS = [
  ['wpbakery', 'WPBakery Page Builder', /plugins\/js_composer\/|class=["'][^"']*\bvc_row\b/i, 'WPBakery is an older shortcode-based builder. Pages tend to carry more code and the editor is slower to work in.'],
  ['divi', 'Divi', /themes\/Divi\/|et_pb_section/i, ''],
  ['beaver', 'Beaver Builder', /plugins\/bb-plugin\/|fl-builder-content/i, ''],
  ['oxygen', 'Oxygen', /plugins\/oxygen\//i, ''],
  ['bricks', 'Bricks', /themes\/bricks\//i, ''],
  ['avada', 'Avada (Fusion Builder)', /themes\/Avada\/|fusion-builder-row/i, ''],
  ['siteorigin', 'SiteOrigin Page Builder', /plugins\/siteorigin-panels\//i, ''],
  ['brizy', 'Brizy', /plugins\/brizy\//i, ''],
];

// [id, name, kind, html test, generator test, header names, cookie test]
const PLATFORMS = [
  ['wix', 'Wix', 'closed', /static\.(?:wixstatic|parastorage)\.com/i, /Wix\.com/i, ['x-wix-request-id']],
  ['squarespace', 'Squarespace', 'closed', /static1\.squarespace\.com|This is Squarespace/i, /Squarespace/i],
  ['shopify', 'Shopify', 'shop', /cdn\.shopify\.com|Shopify\.theme/i, null, ['x-shopid', 'x-shopify-stage']],
  ['webflow', 'Webflow', 'modern', /data-wf-site=|website-files\.com/i, /Webflow/i],
  ['framer', 'Framer', 'modern', /framerusercontent\.com/i, /Framer/i],
  ['joomla', 'Joomla', 'legacy', /\/media\/(?:jui|system)\/js\/|\/components\/com_/i, /Joomla/i],
  ['drupal', 'Drupal', 'legacy', /\/sites\/(?:default|all)\/(?:files|themes|modules)\/|drupal-settings-json/i, /Drupal/i, ['x-drupal-cache', 'x-drupal-dynamic-cache']],
  ['godaddy', 'GoDaddy Website Builder', 'closed', /img1\.wsimg\.com/i, /Go ?Daddy|Starfield/i],
  ['weebly', 'Weebly', 'closed', /editmysite\.com/i],
  ['blogger', 'Blogger', 'closed', /blogger\.com\/static\//i, /blogger/i],
  ['duda', 'Duda', 'closed', /multiscreensite\.com|cdn-website\.com/i],
  ['hubspot', 'HubSpot CMS', 'modern', /\/_hcms\//i, /HubSpot/i],
  ['ghost', 'Ghost', 'modern', null, /^Ghost/i],
  ['magento', 'Magento', 'shop', /Mage\.Cookies|\/static\/version\d+\/frontend\//i],
  ['prestashop', 'PrestaShop', 'shop', /var prestashop\b/i, /PrestaShop/i],
  ['opencart', 'OpenCart', 'shop', /catalog\/view\/theme\//i],
  ['easystore', 'EasyStore', 'closed', /easystore\.co/i],
  ['sitegiant', 'SiteGiant', 'closed', /sitegiant\./i],
  ['newpages', 'NEWPAGES', 'closed', /newpages\.com\.my|npcdn\.net/i],
  ['tilda', 'Tilda', 'closed', /tildacdn\.com/i],
  ['webnode', 'Webnode', 'closed', null, /Webnode/i],
  ['nextjs', 'Next.js', 'custom', /\/_next\/static\/|__NEXT_DATA__/],
  ['nuxt', 'Nuxt', 'custom', /\/_nuxt\/|__NUXT__/],
  ['gatsby', 'Gatsby', 'custom', /___gatsby/],
  ['angular', 'Angular', 'custom', /ng-version=/],
  ['laravel', 'Laravel', 'custom', null, null, [], /laravel_session/i],
  ['aspnet', 'ASP.NET', 'custom', /__VIEWSTATE/, null, ['x-aspnet-version', 'x-aspnetmvc-version']],
  ['codeigniter', 'CodeIgniter', 'custom', null, null, [], /ci_session/i],
];

const WHY_WP = 'WordPress with Elementor gives the client full ownership of the site and its files, and any host can run it.';
const KIND = {
  closed: { tone: 'bad', title: n => `Built on ${n}, a closed website builder`, reasons: [
    'The site is tied to the builder’s own hosting. Moving away usually means rebuilding from scratch.',
    'Design and features are limited to what the builder’s templates and add-ons allow.',
    'Limited control over speed tuning, server settings and technical SEO.',
    'The site is rented: when the subscription stops, the site goes offline.' ] },
  legacy: { tone: 'bad', title: n => `Built on ${n}`, reasons: [
    'A much smaller community than WordPress, so fewer developers, plugins and ready-made integrations.',
    'Day-to-day edits are harder for non-technical staff.',
    'Upgrades between major versions are costly, so these sites often fall behind on security updates.' ] },
  custom: { tone: 'warn', title: n => `Custom build on ${n}`, reasons: [
    'Every content change goes through a developer. There is no editor for the marketing team.',
    'The client depends on whoever built it. If that developer leaves, changes get slow and expensive.',
    'Features that are a plugin install on WordPress (forms, SEO tools, tracking) need custom work here.',
    'Custom builds can be very fast, so check the speed scores before calling this stack a weakness.' ] },
  modern: { tone: 'info', title: n => `Built on ${n}`, reasons: [
    'This is a capable, modern platform. The stack alone is not a reason to rebuild.',
    'Possible angles: monthly platform fees, content limits on lower plans, and edits that need someone trained on the tool.',
    WHY_WP ] },
  shop: { tone: 'info', title: n => `Runs on ${n}`, reasons: [
    'A dedicated online-store platform and a reasonable choice for selling online.',
    'Possible angles: monthly fees and paid apps that add up, and limited layouts for content pages and blogs.',
    'WordPress with WooCommerce keeps the site and the store in one system the client owns.' ] },
  none: { tone: 'warn', title: () => 'No content management system detected', reasons: [
    'The pages look hand-coded, or the platform is hidden.',
    'Without a CMS, every text or image change needs a developer.',
    WHY_WP ] },
};

function wpStatus(v, latest) {
  if (!v) return ['info', 'Version hidden'];
  if (!latest) return ['info', ''];
  const br = s => { const [a, b = 0] = s.split('.').map(Number); return a * 10 + b; };
  const behind = br(latest) - br(v);
  if (behind <= 0) return cmp(v, latest) < 0 ? ['warn', 'Security patch pending'] : ['good', 'Up to date'];
  return [behind >= 3 ? 'bad' : 'warn', `${plural(behind, 'release')} behind`, behind];
}
function elStatus(v, latest) {
  if (!v) return ['info', 'Version hidden'];
  if (!latest) return ['info', ''];
  const [a, b = 0] = v.split('.').map(Number), [la, lb = 0] = latest.split('.').map(Number);
  if (a < la) return ['warn', `On the previous major version (latest is ${la}.x)`];
  const behind = lb - b;
  if (behind <= 0) return ['good', 'Up to date'];
  return [behind >= 4 ? 'bad' : 'warn', `${plural(behind, 'release')} behind`];
}

export function detectStack(page, probes = {}, latest = {}) {
  const html = page.html || '', h = html.replace(/\\\//g, '/'), H = page.headers || {}, cookies = (page.cookies || []).join(' ');
  const gens = (html.match(/<meta[^>]+>/gi) || []).filter(m => /name=["']?generator/i.test(m)).map(m => (m.match(/content=["']([^"']*)/i) || [])[1] || '');
  const gen = re => gens.find(g => re.test(g)) || '';
  const ns = probes.namespaces || [];
  const items = [];
  const add = (group, name, version = '', status = 'info', note = '', conf = 'High') => items.push({ group, name, version, status, note, conf });
  const out = { platform: null, wp: null, builder: null, elementor: null, items, verdict: null, themeSlug: '', pluginSlugs: [], outdatedPlugins: [] };

  const isWP = /\/wp-(content|includes)\//i.test(h) || !!gen(/^WordPress/i) || /wp-json/i.test(H.link || '') || ns.length > 0;
  if (isWP) {
    let v = (gen(/^WordPress \d/i).match(/[\d.]+/) || [])[0] || probes.feedVersion || '';
    let wconf = 'High';
    if (!v) { wconf = 'Medium'; v = mode(all(h, /wp-includes\/(?!js\/jquery)[^"'\s?]+\?ver=(\d+\.\d+(?:\.\d+)?)/gi).filter(x => { const m = +x.split('.')[0]; return m >= 3 && m <= 9; })); }
    const [st, note, behind] = wpStatus(v, latest.wordpress);
    out.platform = { id: 'wordpress', name: 'WordPress', kind: 'wordpress' };
    out.wp = { version: v, latest: latest.wordpress || '', status: st, note, behind: behind || 0 };
    add('Platform', 'WordPress', v, st, note + (st !== 'good' && v && latest.wordpress ? ` (latest ${latest.wordpress})` : ''), wconf);

    const hasEl = /\/plugins\/elementor\//i.test(h) || /class=["'][^"']*\belementor-/.test(html) || ns.some(n => /^elementor\//.test(n)) || !!gen(/^Elementor/i);
    if (hasEl) {
      const ev = (gen(/^Elementor \d/i).match(/[\d.]+/) || [])[0] || mode(all(h, /plugins\/elementor\/assets\/(?:css|js)\/[^"'\s?]+\?ver=(\d+\.\d+\.\d+)/gi)) || probes.elementorVersion || '';
      const [es, en] = elStatus(ev, latest.elementor);
      out.elementor = { version: ev, latest: latest.elementor || '', status: es, note: en };
      out.builder = { id: 'elementor', name: 'Elementor' };
      add('Page builder', 'Elementor', ev, es, en + (es !== 'good' && ev && latest.elementor ? ` (latest ${latest.elementor})` : ''), ev && !gen(/^Elementor \d/i) ? 'Medium' : 'High');
      if (/\/plugins\/elementor-pro\//i.test(h) || ns.some(n => /^elementor-pro\//.test(n)))
        add('Page builder', 'Elementor Pro', mode(all(h, /plugins\/elementor-pro\/assets\/(?:css|js)\/[^"'\s?]+\?ver=(\d+\.\d+\.\d+)/gi)), 'info', '', 'Medium');
    }
    for (const [id, name, re, note] of BUILDERS) {
      if (!re.test(h)) continue;
      if (!out.builder) out.builder = { id, name, note };
      add('Page builder', name, '', hasEl ? 'info' : 'warn', hasEl ? 'Also present' : 'Not the builder we recommend', 'Medium');
    }
    if (!out.builder) add('Page builder', /wp-block-/.test(html) ? 'WordPress block editor' : 'Not detected', '', 'info', /wp-block-/.test(html) ? 'No visual page builder' : '', 'Medium');

    const theme = out.themeSlug = mode(all(h, /wp-content\/themes\/([\w-]+)\//gi)), ti = probes.theme || {};
    if (theme) add('Theme', ti.name || pretty(theme), ti.version || '', 'info', [ti.author && `By ${ti.author}`, ti.parent && `Child theme of ${pretty(ti.parent)}`].filter(Boolean).join('. '));
    else add('Theme', 'Not detected', '', 'info', '', 'Low');
    const plugins = new Map();
    for (const m of h.matchAll(/wp-content\/plugins\/([\w-]+)\/[^"'\s?]*(?:\?ver=(\d[\w.]*))?/gi)) if (!plugins.get(m[1])) plugins.set(m[1], m[2] || '');
    if (ns.some(n => /^wc\//.test(n))) plugins.has('woocommerce') || plugins.set('woocommerce', '');
    const pv = probes.plugins || {};
    out.pluginSlugs = [...plugins.keys()].filter(sl => !/^(elementor|elementor-pro|js_composer)$/.test(sl)).slice(0, 18);
    for (const slug of out.pluginSlugs) {
      const p = pv[slug] || {}, name = PLUGINS[slug] || pretty(slug), known = p.version && p.latest, old = known && cmp(p.version, p.latest) < 0;
      if (old) out.outdatedPlugins.push(`${name} ${p.version} (latest ${p.latest})`);
      add('Plugins', name, p.version || '', old ? 'warn' : known ? 'good' : 'info', old ? `Update available (latest ${p.latest})` : known ? 'Up to date' : '', p.version ? 'Medium' : 'High');
    }
  } else {
    const hit = PLATFORMS.find(([, , , re, g, hd = [], ck]) => (re && re.test(h)) || (g && gen(g)) || hd.some(k => H[k]) || (ck && ck.test(cookies)));
    if (hit) {
      out.platform = { id: hit[0], name: hit[1], kind: hit[2] };
      const ver = hit[0] === 'angular' ? (html.match(/ng-version=["']([\d.]+)/) || [])[1] : (gen(hit[4] || /^$/).match(/\d+(\.\d+)+/) || [])[0];
      add('Platform', hit[1], ver || '', KIND[hit[2]].tone === 'bad' ? 'bad' : KIND[hit[2]].tone === 'warn' ? 'warn' : 'info', '', (hit[4] && gen(hit[4])) || (hit[5] || []).some(k => H[k]) ? 'High' : 'Medium');
    } else if (html) {
      out.platform = { id: 'none', name: 'Not detected', kind: 'none' };
      add('Platform', 'Not detected', '', 'warn', 'Hand-coded or hidden', 'Low');
    }
  }

  // Domain, hosting and server
  if (probes.domain) { const d = out.domain = probes.domain; add('Domain', d.name, '', d.soon ? 'warn' : 'info', d.expires ? `${d.registrar ? d.registrar.replace(/\.$/, '') + '. ' : ''}Expires ${d.expiresText}` : 'Registrar and expiry not detected', d.expires ? 'High' : 'Low'); }
  const server = H.server || '';
  if (server) add('Hosting', server.split(/[\/ (]/)[0].replace(/^\w/, c => c.toUpperCase()), (server.match(/\/(\d[\d.]*)/) || [])[1] || '');
  if (H['cf-ray'] && !/cloudflare/i.test(server)) add('Hosting', 'Cloudflare');
  if (H['x-vercel-id']) add('Hosting', 'Vercel');
  if (H['x-nf-request-id']) add('Hosting', 'Netlify');
  if (H['x-github-request-id']) add('Hosting', 'GitHub Pages');
  if (H['x-litespeed-cache']) add('Hosting', 'LiteSpeed page cache');
  if (H['x-varnish']) add('Hosting', 'Varnish cache');
  const php = ((H['x-powered-by'] || '').match(/PHP\/(\d+\.\d+(?:\.\d+)?)/i) || [])[1];
  if (php) { out.php = { version: php, old: cmp(php, PHP_MIN) < 0 }; add('Hosting', 'PHP', php, out.php.old ? 'bad' : 'good', out.php.old ? 'No longer gets security fixes' : 'Supported version'); }
  else add('Hosting', 'PHP version', '', 'info', 'Not detected', 'Low');

  // Libraries
  const jq = h.match(/jquery[.-](\d+\.\d+(?:\.\d+)?)(?:\.slim)?(?:\.min)?\.js|jquery(?:\.min)?\.js\?ver=(\d+\.\d+(?:\.\d+)?)|\/jquery\/(\d+\.\d+\.\d+)\/jquery/i);
  if (jq) { const v = jq[1] || jq[2] || jq[3]; out.jquery = v; add('Libraries', 'jQuery', v, +v.split('.')[0] < 3 ? 'warn' : 'info', +v.split('.')[0] < 3 ? 'Old, unsupported version' : '', 'Medium'); }
  const bs = h.match(/bootstrap[@\/-]v?(\d+\.\d+(?:\.\d+)?)|bootstrap(?:\.bundle)?(?:\.min)?\.(?:css|js)\?ver=(\d+\.\d+(?:\.\d+)?)|Bootstrap v(\d+\.\d+\.\d+)/i);
  if (bs) { const v = bs[1] || bs[2] || bs[3]; out.bootstrap = v; add('Libraries', 'Bootstrap', v, +v.split('.')[0] <= 3 ? 'warn' : 'info', +v.split('.')[0] <= 3 ? 'Stopped receiving updates in 2019' : '', 'Medium'); }
  if (/data-reactroot|react(?:-dom)?(?:\.production)?(?:\.min)?\.js|__NEXT_DATA__/.test(h)) add('Libraries', 'React', '', 'info', '', 'Medium');

  // Marketing tags
  const tags = out.tags = {
    ga4: /gtag\/js\?id=G-|["']G-[A-Z0-9]{6,}["']/.test(h), ua: /["']UA-\d{4,}-\d+["']/.test(h), gtm: /googletagmanager\.com\/gtm\.js|["']GTM-[A-Z0-9]+["']/.test(h),
    meta: /connect\.facebook\.net\/[^"']+\/fbevents\.js|fbq\(\s*['"]init/.test(h), tiktok: /analytics\.tiktok\.com/.test(h),
    hotjar: /static\.hotjar\.com/.test(h), clarity: /clarity\.ms\/tag/.test(h),
  };
  if (tags.ga4) add('Marketing tags', 'Google Analytics 4');
  if (tags.ua && !tags.ga4) add('Marketing tags', 'Universal Analytics', '', 'warn', 'Stopped collecting data in July 2023');
  if (tags.gtm) add('Marketing tags', 'Google Tag Manager');
  if (tags.meta) add('Marketing tags', 'Meta Pixel');
  if (tags.tiktok) add('Marketing tags', 'TikTok Pixel');
  if (tags.hotjar) add('Marketing tags', 'Hotjar');
  if (tags.clarity) add('Marketing tags', 'Microsoft Clarity');
  if (!Object.values(tags).some(Boolean)) add('Marketing tags', 'Not detected', '', 'info', 'May be loaded later by a script', 'Low');

  out.verdict = stackVerdict(out);
  return out;
}

function stackVerdict(s) {
  if (!s.platform) return { tone: 'info', title: 'Could not read the site directly', reasons: ['The site blocked our checker, most likely a firewall or bot protection.', 'Speed results below still come from Google’s own test. Ask the client which platform they use.'] };
  if (s.platform.kind !== 'wordpress') { const k = KIND[s.platform.kind]; return { tone: k.tone, title: k.title(s.platform.name), reasons: k.reasons }; }
  const wpOld = s.wp.status === 'bad' || s.wp.status === 'warn';
  const wpLine = s.wp.version ? `WordPress ${s.wp.version}: ${s.wp.note.toLowerCase() || 'version found'}.` : 'The WordPress version is hidden, which is good security practice.';
  if (s.builder && s.builder.id === 'elementor') {
    const elOld = s.elementor.status === 'bad' || s.elementor.status === 'warn';
    const elLine = s.elementor.version ? `Elementor ${s.elementor.version}: ${s.elementor.note.toLowerCase() || 'version found'}.` : 'The Elementor version is hidden.';
    if (!wpOld && !elOld) return { tone: 'good', title: 'Already on WordPress and Elementor', reasons: ['This is the stack we recommend, so there is no platform change to pitch.', wpLine, elLine, 'The opportunity here is speed, design and upkeep.'] };
    const far = s.wp.status === 'bad' || s.elementor.status === 'bad';
    return { tone: far ? 'bad' : 'warn', title: 'Right stack, but behind on updates', reasons: [wpLine, elLine, far ? 'Old versions miss security fixes and are targeted by automated attacks.' : 'Updates carry security fixes, so staying current matters.', 'A maintenance plan or refresh brings it current without changing platform.'] };
  }
  if (s.builder) return { tone: 'warn', title: `WordPress with ${s.builder.name}`, reasons: ['WordPress is the right foundation. The page builder is the part to change.', s.builder.note || 'It works, but our team builds, trains and supports in Elementor, so edits and fixes are faster there.', wpLine] };
  return { tone: 'warn', title: 'WordPress without a visual page builder', reasons: ['WordPress is the right foundation.', 'Without a builder, content edits are possible but layout changes usually need a developer.', 'Elementor lets the client’s team build and change pages themselves.', wpLine] };
}

const METRICS = [['first-contentful-paint', 'FCP', 'First content'], ['largest-contentful-paint', 'LCP', 'Main content'], ['total-blocking-time', 'TBT', 'Blocking time'], ['cumulative-layout-shift', 'CLS', 'Layout shift'], ['speed-index', 'SI', 'Speed index']];
export const SPEED_FIX = [
  [/image|lcp-discovery/, 'Compress and resize images, serve modern formats and lazy-load below the fold.'],
  [/render-blocking|css|font/, 'Load only the critical styles first and defer the rest.'],
  [/javascript|script|third-part|legacy|duplicated|bootup|mainthread|long-task/, 'Remove unused scripts and delay third-party tags until they are needed.'],
  [/cache|document-latency|server|redirect|network|compression|text-compression/, 'Tune the hosting: page caching, compression and a CDN.'],
  [/dom|layout|cls|forced|animat|lcp/, 'Rebuild the template with lean, stable layout code.'],
];

// Reduce a PageSpeed Insights response to what the app shows.
export function summarisePsi(j) {
  const lh = j && j.lighthouseResult;
  if (!lh) return null;
  const A = lh.audits || {}, C = lh.categories || {};
  const scores = {};
  for (const k of ['performance', 'accessibility', 'best-practices', 'seo']) scores[k] = C[k] && C[k].score != null ? Math.round(C[k].score * 100) : null;
  const metrics = METRICS.map(([id, short, name]) => ({ id, short, name, display: (A[id] && A[id].displayValue || '').replace(/ /g, ' '), value: A[id] ? A[id].numericValue : null, score: A[id] && A[id].score != null ? Math.round(A[id].score * 100) : null }));
  let refs = ((C.performance || {}).auditRefs || []).filter(r => r.group && r.group !== 'metrics' && r.group !== 'hidden');
  if (refs.some(r => r.group === 'insights')) refs = refs.filter(r => r.group === 'insights');
  const saving = a => { const m = a.metricSavings || {}; return (m.LCP || 0) + (m.FCP || 0) + (m.TBT || 0) || (a.details && a.details.overallSavingsMs) || 0; };
  const wins = refs.map(r => A[r.id]).filter(a => a && a.score != null && a.score < 0.9)
    .map(a => ({ id: a.id, title: a.title, display: (a.displayValue || '').replace(/ /g, ' '), saving: Math.round(saving(a)) }))
    .sort((a, b) => b.saving - a.saving).slice(0, 6);
  let field = null;
  const le = j.loadingExperience && j.loadingExperience.metrics ? j.loadingExperience : (j.originLoadingExperience && j.originLoadingExperience.metrics ? j.originLoadingExperience : null);
  if (le) {
    const g = k => le.metrics[k] ? { value: le.metrics[k].percentile, rating: le.metrics[k].category } : null;
    field = { overall: le.overall_category || '', origin: le !== j.loadingExperience || !!le.origin_fallback, lcp: g('LARGEST_CONTENTFUL_PAINT_MS'), inp: g('INTERACTION_TO_NEXT_PAINT'), cls: g('CUMULATIVE_LAYOUT_SHIFT_SCORE') };
  }
  return { scores, metrics, wins, field, shot: (A['final-screenshot'] && A['final-screenshot'].details && A['final-screenshot'].details.data) || '', packs: (lh.stackPacks || []).map(p => p.title), weight: A['total-byte-weight'] && A['total-byte-weight'].numericValue ? Math.round(A['total-byte-weight'].numericValue / 1024) : null };
}
