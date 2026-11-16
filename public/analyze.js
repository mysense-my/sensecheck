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
  if (!v) return ['info', 'Version hidden by the site (generator tag, feed and file versions are all stripped)'];
  if (!latest) return ['info', ''];
  const br = s => { const [a, b = 0] = s.split('.').map(Number); return a * 10 + b; };
  const behind = br(latest) - br(v);
  if (behind <= 0) return cmp(v, latest) < 0 ? ['warn', 'Security patch pending'] : ['good', 'Up to date'];
  return [behind >= 3 ? 'bad' : 'warn', `${plural(behind, 'release')} behind`, behind];
}
function elStatus(v, latest) {
  if (!v) return ['info', 'Version hidden by the site'];
  if (!latest) return ['info', ''];
  const [a, b = 0] = v.split('.').map(Number), [la, lb = 0] = latest.split('.').map(Number);
  if (a < la) return ['warn', `On the previous major version (latest is ${la}.x)`];
  const behind = lb - b;
  if (behind <= 0) return ['good', 'Up to date'];
  return [behind >= 4 ? 'bad' : 'warn', `${plural(behind, 'release')} behind`];
}

export function detectStack(page, probes = {}, latest = {}) {
  const html = page.html || '', h = (html + '\n' + (page.extra || '')).replace(/\\\//g, '/'), H = page.headers || {}, cookies = (page.cookies || []).join(' ');
  const gens = (html.match(/<meta[^>]+>/gi) || []).filter(m => /name=["']?generator/i.test(m)).map(m => (m.match(/content=["']([^"']*)/i) || [])[1] || '');
  const gen = re => gens.find(g => re.test(g)) || '';
  const ns = probes.namespaces || [];
  const items = [];
  const add = (group, name, version = '', status = 'info', note = '', conf = 'High') => items.push({ group, name, version, status, note, conf });
  const out = { platform: null, wp: null, builder: null, elementor: null, items, verdict: null, themeSlug: '', pluginSlugs: [], outdatedPlugins: [] };

  const hints = probes.paths || {}, robots = probes.robots || '', dns = probes.dns || {};
  const seenWP = /\/wp-(content|includes)\//i.test(h) || !!gen(/^WordPress/i) || /wp-json/i.test(H.link || '') || ns.length > 0;
  const hintWP = !seenWP && (hints.wp ? 'its login page' : /Disallow:\s*\/wp-admin/i.test(robots) ? 'robots.txt' : '');
  const isWP = seenWP || !!hintWP;
  if (isWP) {
    let v = (gen(/^WordPress \d/i).match(/[\d.]+/) || [])[0] || probes.feedVersion || '';
    let wconf = 'High';
    if (!v) { wconf = 'Medium'; v = mode(all(h, /wp-includes\/(?!js\/jquery)[^"'\s?]+\?ver=(\d+\.\d+(?:\.\d+)?)/gi).filter(x => { const m = +x.split('.')[0]; return m >= 3 && m <= 9; })); }
    const [st, note, behind] = wpStatus(v, latest.wordpress);
    out.platform = { id: 'wordpress', name: 'WordPress', kind: 'wordpress' };
    out.wp = { version: v, latest: latest.wordpress || '', status: st, note, behind: behind || 0 };
    add('Platform', 'WordPress', v, st, hintWP && !v ? `Identified from ${hintWP}; its files are hidden` : note + (st !== 'good' && v && latest.wordpress ? ` (latest ${latest.wordpress})` : ''), hintWP ? 'Medium' : wconf);

    const hasEl = /\/plugins\/elementor\//i.test(h) || /class=["'][^"']*\belementor-/.test(html) || ns.some(n => /^elementor\//.test(n)) || !!gen(/^Elementor/i);
    if (hasEl) {
      const ev = (gen(/^Elementor \d/i).match(/[\d.]+/) || [])[0] || mode(all(h, /plugins\/elementor\/assets\/(?:css|js)\/[^"'\s?]+\?ver=(\d+\.\d+\.\d+)/gi)) || probes.elementorVersion || '';
      const [es, en] = elStatus(ev, latest.elementor);
      out.elementor = { version: ev, latest: latest.elementor || '', status: es, note: en };
      out.builder = { id: 'elementor', name: 'Elementor' };
      add('Page builder', 'Elementor', ev, es, en + (es !== 'good' && ev && latest.elementor && !/latest/.test(en) ? ` (latest ${latest.elementor})` : ''), ev && !gen(/^Elementor \d/i) ? 'Medium' : 'High');
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
    else add('Theme', 'Not detected', '', 'info', 'Theme files are served from combined or renamed paths', 'Low');
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
    let hit = PLATFORMS.find(([, , , re, g, hd = [], ck]) => (re && re.test(h)) || (g && gen(g)) || hd.some(k => H[k]) || (ck && ck.test(cookies)));
    // No fingerprints in the page: fall back to DNS records, robots.txt and the usual login addresses.
    const clue = hit ? '' : dns.platform ? [dns.platform, 'DNS records'] : hints.joomla ? ['joomla', 'its login page'] : hints.drupal ? ['drupal', 'its login page'] : /Disallow:\s*\/administrator\//i.test(robots) ? ['joomla', 'robots.txt'] : /shopify/i.test(robots) ? ['shopify', 'robots.txt'] : '';
    if (clue) hit = PLATFORMS.find(x => x[0] === clue[0]);
    if (hit && clue) { out.platform = { id: hit[0], name: hit[1], kind: hit[2] }; add('Platform', hit[1], '', KIND[hit[2]].tone === 'bad' ? 'bad' : 'info', `Identified from ${clue[1]}; the page itself gave no markers`, 'Medium'); }
    else if (hit) {
      out.platform = { id: hit[0], name: hit[1], kind: hit[2] };
      const ver = hit[0] === 'angular' ? (html.match(/ng-version=["']([\d.]+)/) || [])[1] : (gen(hit[4] || /^$/).match(/\d+(\.\d+)+/) || [])[0];
      add('Platform', hit[1], ver || '', KIND[hit[2]].tone === 'bad' ? 'bad' : KIND[hit[2]].tone === 'warn' ? 'warn' : 'info', '', (hit[4] && gen(hit[4])) || (hit[5] || []).some(k => H[k]) ? 'High' : 'Medium');
    } else if (html) {
      out.platform = { id: 'none', name: 'Not detected', kind: 'none' };
      add('Platform', 'Not detected', '', 'warn', 'Hand-coded or hidden', 'Low');
    }
  }

  // Domain, hosting and server
  if (dns.ns && dns.ns.length) add('Hosting', `DNS: ${dns.host || dns.ns[0]}`, '', 'info', dns.host ? '' : 'Nameserver', 'High');
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
  else add('Hosting', 'PHP version', '', 'info', 'Not announced by the server', 'Low');

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
  const wpLine = s.wp.version ? `WordPress ${s.wp.version}: ${s.wp.note.toLowerCase() || 'version found'}.` : 'The WordPress version is hidden by the site, which is good security practice.';
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
  [/image|lcp-discovery/, 'We’d shrink and compress the images, and load the lower ones only when they’re needed.'],
  [/render-blocking|css|font/, 'We’d load the essential styles first and the rest afterwards.'],
  [/javascript|script|third-part|legacy|duplicated|bootup|mainthread|long-task/, 'We’d remove code that isn’t needed and hold back outside scripts until they’re used.'],
  [/cache|document-latency|server|redirect|network|compression|modern-http/, 'We’d tune the hosting: caching, compression and a content delivery network.'],
  [/dom|layout|cls|forced|animat|lcp|inp/, 'We’d rebuild the template with leaner, steadier code.'],
];
// Google's speed findings in everyday words.
export const FRIENDLY = {
  'image-delivery-insight': 'Images are bigger than they need to be', 'render-blocking-insight': 'Styles and scripts hold the page up before it shows',
  'legacy-javascript-insight': 'Old-style code that modern browsers don’t need', 'cache-insight': 'Files aren’t saved for repeat visits',
  'font-display-insight': 'Text stays invisible while fonts load', 'dom-size-insight': 'There is too much going on under the hood',
  'third-parties-insight': 'Outside services slow the page down', 'lcp-discovery-insight': 'The main image starts loading late',
  'network-dependency-tree-insight': 'Files load one after another, not together', 'document-latency-insight': 'The server is slow to answer',
  'duplicated-javascript-insight': 'The same code is loaded more than once', 'forced-reflow-insight': 'The page keeps recalculating its layout',
  'cls-culprits-insight': 'Things jump around while loading', 'inp-breakdown-insight': 'The page is slow to react to taps',
  'viewport-insight': 'Not set up properly for phones', 'modern-http-insight': 'Files are sent in an older, slower way',
  'lcp-breakdown-insight': 'The main content takes too long to show',
};

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
  const cnt = id => (A[id] && A[id].score != null && A[id].score < 1 ? ((A[id].details && A[id].details.items) || []).length || 1 : 0);
  const urls = (((A['network-requests'] || {}).details || {}).items || []).map(i => i.url).filter(Boolean).slice(0, 400);
  // Where the weight goes, so a low score can be explained in plain terms.
  const reqs = ((A['network-requests'] || {}).details || {}).items || [];
  const host0 = (() => { try { return new URL(lh.finalDisplayedUrl || lh.finalUrl || j.id).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  const kb = list => Math.round(list.reduce((t, x) => t + (x.transferSize || 0), 0) / 1024), of = t => reqs.filter(x => x.resourceType === t);
  const third = reqs.filter(x => { try { return !!host0 && !new URL(x.url).hostname.endsWith(host0); } catch { return false; } });
  const bytes = reqs.length ? { total: kb(reqs), image: kb(of('Image')), script: kb(of('Script')), css: kb(of('Stylesheet')), font: kb(of('Font')), media: kb(of('Media')), requests: reqs.length, scripts: of('Script').length, images: of('Image').length,
    thirdKb: kb(third), thirdHosts: new Set(third.map(x => { try { return new URL(x.url).hostname.split('.').slice(-2).join('.'); } catch { return ''; } })).size } : null;
  const num = id => (A[id] && A[id].numericValue != null ? Math.round(A[id].numericValue) : null), saveKb = id => (A[id] && A[id].details && A[id].details.overallSavingsBytes ? Math.round(A[id].details.overallSavingsBytes / 1024) : 0);
  const why = { bytes, ttfb: num('server-response-time'), unusedJs: saveKb('unused-javascript'), unusedCss: saveKb('unused-css-rules') };
  const design = { contrast: cnt('color-contrast'), taps: cnt('target-size'), stretched: cnt('image-aspect-ratio'), blurry: cnt('image-size-responsive') };
  return { urls, why, design, scores, metrics, wins, field, shot: (A['final-screenshot'] && A['final-screenshot'].details && A['final-screenshot'].details.data) || '', packs: (lh.stackPacks || []).map(p => p.title), weight: A['total-byte-weight'] && A['total-byte-weight'].numericValue ? Math.round(A['total-byte-weight'].numericValue / 1024) : null };
}

// ---------- Why a site could not be read, in specific terms. Returns null when the page was read normally.
// level 'blocked' = no usable page; 'limited' = a page came back but with a caveat. finding = the client should be told.
const CF_BLOCK = { 1006: 'has banned our reader’s network address', 1007: 'has banned our reader’s network address', 1008: 'has banned our reader’s network address', 1009: 'blocks visitors from the country our reader runs in', 1010: 'rejected our reader’s browser signature', 1015: 'is rate-limiting our reader', 1020: 'has a firewall rule that denies automated visitors' };
const CF_DOWN = { 520: 'the server sent an empty or invalid answer', 521: 'the web server is down', 522: 'the connection to the server timed out', 523: 'the server cannot be reached', 524: 'the server took too long to answer', 525: 'the secure (SSL) connection to the server failed', 526: 'the server’s SSL certificate is invalid' };
const ALLOW = 'Real visitors are not affected. To scan it fully, ask whoever manages the site to allow our checker (its requests carry “SenseCheck” in the user agent), or review the site by hand.';
const OWN = 'Open the site in your own browser. If it loads for you, the host is blocking automated readers. If it does not, the site is down.';
export function diagnose(page, err, wanted) {
  const B = (title, why, next, finding) => ({ level: 'blocked', title, why, next, finding: !!finding });
  if (!page || !page.status) {
    const e = String(err || '');
    if (/ENOTFOUND|getaddrinfo|not known|no such host|could not resolve|\b1016\b|\bdns\b/i.test(e)) return B('The domain does not resolve', 'There is no working DNS record for this address. The domain may be mistyped, expired or not pointed at a server.', 'Check the spelling. If it is right, the site is offline for everyone, which is worth raising with the client.', true);
    if (/certificate|ssl|tls|handshake|CERT_/i.test(e)) return B('The security certificate is invalid or expired', 'The server’s SSL certificate could not be verified, so a secure connection was refused. Browsers show visitors a full-page warning in this state.', 'Tell the client. This needs fixing now, whatever else they decide.', true);
    if (/timed? ?out|timeout|abort/i.test(e)) return B('The server did not answer in time', 'We waited 20 seconds with no reply. Either the server is down or overloaded, or its firewall silently drops visits from data-centre networks like the one our reader uses.', OWN);
    if (/refused|reset|closed|lost/i.test(e)) return B('The server refused the connection', 'The connection was cut before any page was sent. Either the web server is down, or a firewall blocks our reader’s network address.', OWN);
    if (/redirect/i.test(e)) return B('The site redirects in a loop', 'The address keeps redirecting without ever reaching a page, usually a misconfigured HTTPS or www rule.', 'Tell the client. Some visitors will hit the same loop.', true);
    return B('We could not connect to the site', `The connection failed before any page was sent${e ? ` (${e.slice(0, 120)})` : ''}.`, OWN);
  }
  const st = page.status, H = page.headers || {}, t = page.html || '', srv = (H.server || '').toLowerCase();
  const code = +((t.match(/error code:? ?(\d{3,4})/i) || t.match(/Error (1\d{3})\b/) || [])[1] || 0);
  const cfChallenge = H['cf-mitigated'] === 'challenge' || /cf-chl|challenge-platform|Just a moment\.\.\.|Attention Required! \| Cloudflare|cf-browser-verification/i.test(t);
  if (CF_BLOCK[code] && /cloudflare/i.test(srv + t)) return B(`Blocked by Cloudflare (error ${code})`, `The site sits behind Cloudflare, which ${CF_BLOCK[code]}. This is a security setting on the client’s Cloudflare account, not a fault with the site.`, ALLOW);
  // Our reader runs on Cloudflare, which reports a failed DNS lookup as error 1016 rather than a connection error.
  if (code === 1016) return B('The domain does not resolve', 'No server could be found for this address (DNS error 1016). The domain may be mistyped, expired or not pointed at a server.', 'Check the spelling. If it is right, the site is offline for everyone, which is worth raising with the client.', true);
  if (CF_DOWN[st] && /cloudflare/i.test(srv + t)) return B(`The site is down (Cloudflare error ${st})`, `Cloudflare is in front of the site and reports that ${CF_DOWN[st]}. Visitors see an error page right now.`, 'Tell the client. Their hosting needs attention before anything else.', true);
  if (cfChallenge) return B('Blocked by Cloudflare bot protection', 'The site sits behind Cloudflare, which showed our reader a “verify you are human” challenge instead of the page. That comes from Bot Fight Mode, a firewall rule or Under Attack mode on the client’s Cloudflare account.', ALLOW);
  if (H['x-sucuri-id'] || H['x-sucuri-block'] || /Sucuri Website Firewall|sucuri\.net/i.test(t) && st >= 400) return B('Blocked by the Sucuri firewall', 'The site uses Sucuri’s website firewall, which refused our reader as an automated visitor.', ALLOW);
  if (/generated by Wordfence|access to this site has been limited by the site owner/i.test(t)) return B('Blocked by the Wordfence security plugin', 'The site runs WordPress with Wordfence, which limited our reader. Wordfence does this to automated visitors, to some countries, or after too many requests.', ALLOW);
  if (/imunify360|Imunify/i.test(t) && st >= 400) return B('Blocked by Imunify360 bot protection', 'The hosting company runs Imunify360, a server-wide security layer that challenges automated visitors. It is switched on by the host, often without the client knowing.', ALLOW);
  if (H['x-iinfo'] || /incapsula|imperva/i.test((H['x-cdn'] || '') + t.slice(0, 4000)) && st >= 400) return B('Blocked by the Imperva (Incapsula) firewall', 'The site is protected by Imperva, an enterprise firewall that refused our reader as an automated visitor.', ALLOW);
  if (/akamai/i.test(srv) && st >= 400) return B('Blocked by the Akamai firewall', 'The site is delivered through Akamai, whose bot protection refused our reader.', ALLOW);
  if (st >= 400 && (/generated by cloudfront|Request blocked\./i.test(t) || H['x-amzn-waf-action'])) return B('Blocked by Amazon CloudFront or AWS WAF', 'The site is hosted on Amazon Web Services, and its firewall rules refused our reader.', ALLOW);
  if (/sgcaptcha|\.well-known\/captcha/i.test(t)) return B('Stopped by SiteGround’s anti-bot check', 'The site is hosted on SiteGround, which showed our reader a “prove you are human” check. SiteGround applies it to visits from data-centre networks.', ALLOW);
  if (/ddos-guard/i.test(srv)) return B('Blocked by DDoS-Guard', 'The site sits behind DDoS-Guard, which challenged our reader as an automated visitor.', ALLOW);
  if (st === 406 || /Mod_?Security|Not Acceptable!/i.test(t) && st >= 400) return B('Blocked by the server’s ModSecurity firewall', 'The web server’s built-in firewall (ModSecurity) rejected our reader’s request. Hosts tune these rules to turn away automated visitors.', ALLOW);
  if (st === 401) return B('The site is password-protected', `The server asked for a username and password before showing anything${H['www-authenticate'] ? ' (browser login prompt)' : ''}. That is normal for a staging or private site.`, 'Scan the public address instead, or ask the client for the live URL.');
  if (st === 429) return B('The site is rate-limiting us', 'The server answered “too many requests”. It limits how often one visitor may load pages, and our reader hit that limit.', 'Wait a few minutes and scan again with “Homepage only”.');
  if (st === 403 && /captcha|are you a robot|verify (that )?you are (a )?human|unusual traffic/i.test(t)) return B('Stopped by a “prove you are human” check', 'The site showed our reader a captcha instead of the page. A security plugin or the host does this to automated visitors.', ALLOW);
  if (st === 403) return B('The server refused our reader (403 Forbidden)', 'A firewall or hosting rule turned our reader away, and the block page does not say which product did it. Common causes are a security plugin, a rule against data-centre networks, or a country block.', ALLOW);
  if (st === 404 || st === 410) return B('That address shows “page not found”', `The server answered ${st} for this exact address, so there is no page there to check.`, 'Check the link. Scan the homepage address if you pasted a deeper page.');
  if (st === 503 && /maintenance|briefly unavailable/i.test(t)) return B('The site is in maintenance mode', 'The server is answering with a maintenance notice. On WordPress this appears during updates and sometimes gets stuck.', 'Try again in a few minutes. If it stays this way, tell the client: visitors see the same notice.', true);
  if (st >= 500) return B(`The site’s server returned an error (${st})`, 'The server failed while building the page. Visitors are likely seeing an error too.', 'Open the site in your own browser to confirm, then tell the client.', true);
  if (st >= 400) return B(`The server answered with an error (${st})`, 'The page could not be loaded for our reader.', OWN);
  if (/Account Suspended|account has been suspended|suspendedpage\.cgi/i.test(t)) return B('The hosting account is suspended', 'The host is showing an “Account Suspended” page in place of the website, usually over an unpaid bill or a policy problem.', 'Tell the client. The site is offline for everyone.', true);
  const words = t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, ' ').split(/\s+/).filter(Boolean).length;
  if (/sedoparking|parkingcrew|bodis\.com|domain (is )?parked|this domain (is|may be) for sale|buy this domain/i.test(t)) return B('The domain is parked', 'The address shows a domain-parking page, not a website. The domain is registered but no site is published on it.', 'Confirm the address with the client. They may use a different domain.', true);
  if (words < 60 && /challenges\.cloudflare\.com|hcaptcha\.com|g-recaptcha|captcha/i.test(t)) return B('Stopped by a “prove you are human” check', 'The page our reader received contains only a captcha. The real site appears after a person passes it.', ALLOW);
  const L = (title, why, next) => ({ level: 'limited', title, why, next, finding: false });
  if (words < 40 && /<div[^>]+id=["'](root|app|__next|__nuxt|svelte)["']|<app-root/i.test(t)) return L('The page is built by JavaScript', 'The HTML our reader received is almost empty. The content only appears after scripts run in a browser, so our content, heading and image checks see very little. Speed scores are unaffected, because Google’s test runs the scripts.', 'Treat the content and SEO findings with caution. It also means search engines have to work harder to read this site, which is worth mentioning.');
  if (words < 60 && /coming soon|under construction|launching soon/i.test(t)) return L('The site shows a coming-soon page', 'There is only a placeholder page at this address, so there is very little to audit.', 'Confirm the address with the client.');
  try { const got = new URL(page.finalUrl).hostname.replace(/^www\./, ''), want = String(wanted || '').replace(/^www\./, ''); if (want && got !== want && !got.endsWith('.' + want)) return L(`The address redirects to ${got}`, `We asked for ${want} and were sent to ${got}, so this report describes ${got}.`, 'Check that this is the site you meant to scan.'); } catch { /* keep going */ }
  return null;
}

// Hosting or platform clues from DNS records, which stay visible even when the site blocks our reader.
const NS_HOST = [[/cloudflare\.com$/, 'Cloudflare'], [/domaincontrol\.com$/, 'GoDaddy'], [/wixdns\.net$/, 'Wix'], [/squarespace/, 'Squarespace'], [/awsdns/, 'Amazon Route 53'], [/exabytes/, 'Exabytes'], [/siteground/, 'SiteGround'], [/hostinger|dns-parking\.com$/, 'Hostinger'], [/registrar-servers\.com$/, 'Namecheap'], [/bluehost/, 'Bluehost'], [/hostgator/, 'HostGator'], [/digitalocean/, 'DigitalOcean'], [/shinjiru/, 'Shinjiru'], [/serverfreak/, 'ServerFreak'], [/ipserverone/, 'IP ServerOne'], [/googledomains|google\.com$/, 'Google'], [/vercel-dns/, 'Vercel'], [/netlify|nsone\.net$/, 'Netlify'], [/shopify/, 'Shopify']];
const CNAME_PLATFORM = [[/myshopify\.com$/, 'shopify'], [/wixdns\.net$|wixsite/, 'wix'], [/squarespace\.com$/, 'squarespace'], [/webflow\.(com|io)$/, 'webflow'], [/framer\.(app|website)$/, 'framer']];
export function dnsClues(ns = [], cname = []) {
  const host = (NS_HOST.find(([re]) => ns.some(n => re.test(n))) || [])[1] || '';
  const plat = (CNAME_PLATFORM.find(([re]) => cname.some(c => re.test(c))) || [])[1] || (ns.some(n => /wixdns\.net$/.test(n)) ? 'wix' : ns.some(n => /squarespace/.test(n)) ? 'squarespace' : '');
  return { ns, host, platform: plat };
}
