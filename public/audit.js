// SenseCheck audit: page facts, issues, strengths, health score, skills fit and next steps.
// Rule lists (placeholder phrases, thresholds, packages, Skills Matrix) live in config.json.
import { SPEED_FIX } from './analyze.js';

const YEAR = new Date().getFullYear();
const COST = { Critical: 30, High: 18, Medium: 10, Low: 4 };
const ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const WEIGHT = { Performance: 22, SEO: 18, Security: 18, Design: 12, Accessibility: 12, Content: 10, Images: 8 };
export const CATS = ['Performance', 'SEO', 'Design', 'Content', 'Images', 'Accessibility', 'Security'];
export const CAT_NAME = { Performance: 'Performance', SEO: 'SEO', Design: 'Design', Content: 'Content', Images: 'Images', Accessibility: 'Mobile and accessibility', Security: 'Security and upkeep' };
const CTA = /\b(contact|get (a |in |your )?(quote|touch|started)|book|enquir|inquir|call (us|now)|whatsapp|buy|shop now|order|sign ?up|register|request|schedule|appointment|free (trial|consult)|hubungi|tempah|daftar|beli)/i;
const SKIP_LINK = /\.(pdf|jpe?g|png|gif|webp|avif|svg|zip|rar|docx?|xlsx?|pptx?|mp[34]|mov|ics|xml|json|css|js)$|\/(wp-admin|wp-login\.php|wp-json|cart|checkout|my-account|feed|tag|author)(\/|$)|\/page\/\d+/i;
const plural = (n, w, ws) => `${n} ${n === 1 ? w : ws || w + 's'}`;
const ok = p => (p && !p.error ? p : null);
export const norm = u => { const x = new URL(u); return x.origin.replace('://www.', '://') + x.pathname.replace(/\/index\.(html?|php)$/i, '').replace(/\/+$/, ''); };

// Read one fetched page into the facts the checks need. Nothing on the page is loaded or run.
export function readPage(url, status, html, cfg) {
  const doc = new DOMParser().parseFromString(html, 'text/html'), base = new URL(url), host = base.hostname.replace(/^www\./, '');
  const q = s => [...doc.querySelectorAll(s)];
  const scripts = q('script[src]').length, ld = !!doc.querySelector('script[type="application/ld+json" i]');
  const mixed = base.protocol === 'https:' ? q('img[src^="http://"],script[src^="http://"],link[rel~="stylesheet"][href^="http://"],iframe[src^="http://"]').length : 0;
  // Compact evidence for platform detection: generator tags and every file address this page loads.
  const evidence = [...q('meta[name="generator" i]').map(m => `<meta name="generator" content="${m.getAttribute('content') || ''}">`), ...q('script[src],link[href],img[src],iframe[src]').map(e => e.getAttribute('src') || e.getAttribute('href'))].join('\n').slice(0, 6000);
  const fams = new Set();
  for (const l of q('link[href*="fonts.googleapis.com"]')) for (const f of (l.getAttribute('href').match(/family=[^&]+/g) || [])) for (const one of decodeURIComponent(f.slice(7)).split('|')) fams.add(one.split(':')[0].replace(/\+/g, ' ').trim());
  const nav = doc.querySelector('header nav ul, nav ul, [role="navigation"] ul');
  const design = {
    sliders: q('.rev_slider,.rev_slider_wrapper,rs-module,.nivoSlider,.flexslider,.bx-wrapper,.bxslider,.owl-carousel,.slick-slider,.carousel.slide').length,
    gfonts: fams.size, inlineStyles: q('[style]').length, favicon: !!doc.querySelector('link[rel~="icon" i]'),
    autoplay: q('audio[autoplay],video[autoplay]:not([muted])').length,
    cta: q('a,button').filter(e => { const t = (e.textContent || '').replace(/\s+/g, ' ').trim(); return t.length <= 40 && CTA.test(t); }).length,
    tel: q('a[href^="tel:" i]').length, wa: q('a[href*="wa.me" i],a[href*="whatsapp" i]').length,
    longForm: Math.max(0, ...q('form').map(f => f.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]),select,textarea').length)),
    navItems: nav ? [...nav.children].filter(c => c.tagName === 'LI').length : 0,
    popups: /popup-maker|pum-overlay|popupbuilder|sgpb-popup|optinmonster|om-holder|sumome/i.test(html),
    proofMarkup: /"@type"\s*:\s*"(Review|AggregateRating)"/.test(html),
  };
  q('script,style,noscript,template,svg').forEach(n => n.remove());
  const text = (doc.body ? doc.body.textContent : '').replace(/\s+/g, ' ').trim(), low = text.toLowerCase();
  const heads = q('h1,h2,h3,h4,h5,h6').map(h => +h.tagName[1]);
  const real = i => i.getAttribute('data-src') || i.getAttribute('data-lazy-src') || i.getAttribute('src') || '';
  const imgs = q('img').filter(i => real(i) && !real(i).startsWith('data:'));
  const ext = s => ((s.split(/[?#]/)[0].match(/\.(\w{3,4})$/) || [])[1] || '').toLowerCase();
  const lazy = i => i.getAttribute('loading') === 'lazy' || i.hasAttribute('data-src') || i.hasAttribute('data-lazy-src') || /lazy/i.test(i.className);
  const abs = s => { try { return new URL(s, base).href; } catch { return ''; } };
  const links = [], seen = new Set();
  for (const a of q('a[href]')) {
    let u; try { u = new URL(a.getAttribute('href'), base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol) || u.hostname.replace(/^www\./, '') !== host || SKIP_LINK.test(u.pathname)) continue;
    const href = u.origin + u.pathname, key = norm(href);
    if (!seen.has(key)) { seen.add(key); links.push({ key, href }); }
  }
  const fields = q('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=image]),select,textarea');
  const labelled = f => f.hasAttribute('aria-label') || f.hasAttribute('aria-labelledby') || f.closest('label') || (f.id && doc.querySelector(`label[for="${CSS.escape(f.id)}"]`));
  const years = [...text.matchAll(/(?:©|copyright)[^.]{0,40}?((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/gi)].map(m => Math.max(+m[1], +(m[2] || 0))).filter(y => y <= YEAR);
  return {
    url, path: base.pathname || '/', status,
    title: ((doc.querySelector('title') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    desc: ((doc.querySelector('meta[name="description" i]') || { getAttribute: () => '' }).getAttribute('content') || '').trim(),
    canonical: !!doc.querySelector('link[rel~="canonical" i]'),
    viewport: !!doc.querySelector('meta[name="viewport" i]'),
    og: !!doc.querySelector('meta[property="og:image" i]'), ld,
    h1: heads.filter(x => x === 1).length, skipped: heads.some((x, i) => i > 0 && x > heads[i - 1] + 1),
    imgs: imgs.length, noAlt: imgs.filter(i => !i.hasAttribute('alt')).length, notLazy: imgs.slice(3).filter(i => !lazy(i)).length,
    oldFmt: imgs.filter(i => /^(jpe?g|png|gif|bmp)$/.test(ext(real(i)))).length,
    newFmt: imgs.filter(i => /^(webp|avif)$/.test(ext(real(i)))).length + q('source[type="image/webp" i],source[type="image/avif" i]').length,
    imgUrls: [...new Set(imgs.map(i => abs(real(i))).filter(s => s && !/\.svg(\?|$)/i.test(s)))].slice(0, cfg.crawl.maxImageChecks),
    words: text ? text.split(' ').length : 0,
    placeholders: cfg.placeholders.filter(p => low.includes(p.toLowerCase())),
    mixed, unlabelled: fields.filter(f => !labelled(f)).length,
    legacy: q('font,center,marquee,frameset,[bgcolor],table[cellpadding],table[cellspacing]').length,
    flash: q('[src$=".swf" i],[data$=".swf" i]').length > 0,
    scripts, year: years.length ? Math.max(...years) : 0, links, evidence,
    design: { ...design, gifs: imgs.filter(i => ext(real(i)) === 'gif').length,
      proof: design.proofMarkup || /testimoni|review|what (our|my) (clients?|customers?|patients?) say|ulasan/i.test(text),
      bestViewed: /best viewed (in|with)|hit counter|visitor counter|you are visitor/i.test(text) },
  };
}

// Every issue: category, severity, where it was found, a plain-English fix, a group and a service package.
export function buildIssues(r, cfg) {
  const out = [], P = r.pages, home = P[0], s = r.stack, n = P.length, T = cfg.thresholds;
  const HP = home ? [home.path] : null, name = p => (home && p === home.path ? 'Homepage' : p);
  const where = list => (!list ? 'Whole site' : list.length === 1 ? name(list[0]) : `${name(list[0])} and ${list.length - 1} more`);
  const add = (cat, sev, title, detail, fix, group, pkg, pages, extra) => out.push({ cat, sev, title, detail, fix, group, pkg, where: where(pages), ...extra });
  const on = f => P.filter(f).map(p => p.path);
  const sum = k => P.reduce((t, p) => t + p[k], 0);
  const m = ok(r.psi.mobile), d = ok(r.psi.desktop);
  let pg;

  // Performance
  if (m) {
    const p = m.scores.performance, lcp = m.metrics.find(x => x.id === 'largest-contentful-paint');
    const lcpLine = lcp && lcp.display ? ` The main content takes ${lcp.display} to appear; Google’s target is 2.5 s.` : '';
    if (p != null && p < 50) add('Performance', p < 30 ? 'Critical' : 'High', `Slow on mobile: ${p} out of 100`, `Google rates mobile performance as poor.${lcpLine}`, 'Run a full speed optimisation: images, scripts, caching and hosting.', 'quick', 'speed', HP);
    else if (p != null && p < 90) add('Performance', 'Medium', `Mobile speed needs work: ${p} out of 100`, `Below Google’s “good” mark of 90.${lcpLine}`, 'Optimise the slowest parts of the page for mobile.', 'quick', 'speed', HP);
    if (m.field && m.field.overall === 'SLOW') add('Performance', 'High', 'Real visitors get a slow experience', 'Chrome data from actual visitors over the last 28 days rates this site as slow. Google uses this data in ranking.', 'Fix the Core Web Vitals (LCP, INP, CLS) until real-visitor data reads “good”.', 'quick', 'speed', HP);
    for (const w of m.wins) add('Performance', w.saving >= 1000 ? 'High' : w.saving >= 300 ? 'Medium' : 'Low', w.title, w.display || (w.saving ? `Estimated saving of ${(w.saving / 1000).toFixed(1)} s on mobile.` : 'Flagged by Google’s speed test.'), (SPEED_FIX.find(([re]) => re.test(w.id)) || [0, 'Covered in a speed optimisation pass.'])[1], 'quick', 'speed', HP, { win: true });
    if (m.weight && m.weight > 3000) add('Performance', 'Medium', `Heavy page: ${(m.weight / 1024).toFixed(1)} MB`, 'The homepage downloads far more data than it needs to, which hurts visitors on mobile data.', 'Compress and resize images, serve modern formats and lazy-load below the fold.', 'quick', 'speed', HP);
  }
  if (d && d.scores.performance != null && d.scores.performance < 50) add('Performance', 'Medium', `Slow on desktop too: ${d.scores.performance} out of 100`, 'Desktop usually scores much higher than mobile, so a low score here points to a heavy page.', 'Run a full speed optimisation: images, scripts, caching and hosting.', 'quick', 'speed');

  if (home) {
    if (home.scripts > 40) add('Performance', 'Low', `${home.scripts} script files on the homepage`, 'Every script is another download and more work for the phone before the page responds.', 'Remove unused scripts and delay third-party tags until they are needed.', 'quick', 'speed', HP);

    // Content
    pg = on(p => p.placeholders.length);
    if (pg.length) add('Content', 'High', 'Placeholder text left on the site', `Found “${[...new Set(P.flatMap(p => p.placeholders))].slice(0, 3).join('”, “')}”. Visitors are seeing unfinished content.`, 'Replace placeholder text with real copy, or remove the page.', 'quick', 'maintenance', pg);
    if (r.broken.length) add('Content', r.broken.length >= 3 ? 'High' : 'Medium', plural(r.broken.length, 'broken link'), `These lead to an error page: ${r.broken.slice(0, 3).map(b => `${b.path} (${b.status})`).join(', ')}${r.broken.length > 3 ? ' and more' : ''}.`, 'Fix or redirect every broken link.', 'quick', 'maintenance', [...new Set(r.broken.map(b => b.from))]);
    pg = on(p => p.words < T.thinWords);
    if (pg.length) add('Content', 'Medium', `${plural(pg.length, 'page')} with almost no content`, `Under ${T.thinWords} words of text. Thin pages rarely rank and look unfinished.`, 'Write proper content for thin pages, or merge them.', 'revamp', 'revamp', pg);
    const yr = Math.max(...P.map(p => p.year));
    if (yr && yr <= YEAR - 2) add('Content', 'Low', `Footer still says © ${yr}`, 'A small detail, but it tells visitors nobody is looking after the site.', 'Use an automatic year in the footer.', 'quick', 'maintenance');

    // Images
    const noAlt = sum('noAlt'), imgs = sum('imgs');
    if (noAlt) add('Images', noAlt >= 10 ? 'Medium' : 'Low', `${plural(noAlt, 'image')} missing alt text`, `Out of ${imgs} checked. Alt text is what screen readers read out and what Google uses to understand images.`, 'Add descriptive alt text to every meaningful image.', 'quick', 'seo', on(p => p.noAlt));
    if (r.bigImages.length) { const top = Math.max(...r.bigImages.map(b => b.kb)); add('Images', top >= 1000 ? 'High' : 'Medium', `${plural(r.bigImages.length, 'oversized image')} on the homepage`, `Over ${T.imageKB} KB each; the largest is ${top >= 1000 ? (top / 1024).toFixed(1) + ' MB' : top + ' KB'}. Most web images should be under 200 KB.`, 'Compress and resize images, serve modern formats and lazy-load below the fold.', 'quick', 'speed', HP); }
    if (sum('oldFmt') >= 5 && !sum('newFmt')) add('Images', 'Medium', 'No modern image formats', `All ${sum('oldFmt')} images are JPEG or PNG. WebP and AVIF files are typically 25 to 50% smaller at the same quality.`, 'Compress and resize images, serve modern formats and lazy-load below the fold.', 'quick', 'speed');
    if (sum('notLazy') >= 5) add('Images', 'Low', `${plural(sum('notLazy'), 'image')} not lazy-loaded`, 'Images further down the page download straight away, even if the visitor never scrolls to them.', 'Compress and resize images, serve modern formats and lazy-load below the fold.', 'quick', 'speed', on(p => p.notLazy));

    // SEO
    pg = on(p => !p.title);
    if (pg.length) add('SEO', 'High', `${plural(pg.length, 'page')} with no title`, 'The page title is the headline Google shows in search results.', 'Write a unique title and description for every page.', 'quick', 'seo', pg);
    const dup = k => { const c = {}; P.forEach(p => { if (p[k]) (c[p[k]] = c[p[k]] || []).push(p.path); }); return Object.values(c).filter(v => v.length > 1).flat(); };
    pg = dup('title');
    if (pg.length) add('SEO', 'Medium', `${pg.length} pages share the same title`, 'Google cannot tell these pages apart in search results.', 'Write a unique title and description for every page.', 'quick', 'seo', pg);
    pg = on(p => !p.desc);
    if (pg.length) add('SEO', 'Medium', `${plural(pg.length, 'page')} with no meta description`, 'Google has to guess the summary shown under the title in search results.', 'Write a unique title and description for every page.', 'quick', 'seo', pg);
    pg = dup('desc');
    if (pg.length) add('SEO', 'Low', `${pg.length} pages share the same meta description`, 'Each page should describe its own content.', 'Write a unique title and description for every page.', 'quick', 'seo', pg);
    pg = on(p => p.h1 === 0);
    if (pg.length) add('SEO', 'Medium', `${plural(pg.length, 'page')} with no main heading (H1)`, 'The page gives search engines no clear main topic.', 'Give every page one H1 and headings in order (H1, H2, H3).', 'quick', 'seo', pg);
    pg = on(p => p.h1 > 1);
    if (pg.length) add('SEO', 'Low', `${plural(pg.length, 'page')} with several H1 headings`, 'More than one main heading blurs what the page is about.', 'Give every page one H1 and headings in order (H1, H2, H3).', 'quick', 'seo', pg);
    pg = on(p => p.skipped);
    if (pg.length) add('SEO', 'Low', `Heading levels skipped on ${plural(pg.length, 'page')}`, 'Headings jump levels (for example H2 straight to H4), which confuses screen readers and search engines.', 'Give every page one H1 and headings in order (H1, H2, H3).', 'quick', 'seo', pg);
    if (r.site.sitemap === false) add('SEO', 'Medium', 'No XML sitemap found', 'A sitemap tells Google which pages exist. Without one, new pages take longer to be found.', 'Generate an XML sitemap and submit it in Google Search Console.', 'quick', 'seo');
    if (r.site.robots === false) add('SEO', 'Low', 'No robots.txt file', 'This file tells search engines what to crawl and where the sitemap is.', 'Add a robots.txt that points to the sitemap.', 'quick', 'seo');
    pg = on(p => !p.canonical);
    if (pg.length) add('SEO', 'Low', `${plural(pg.length, 'page')} with no canonical tag`, 'Without it, Google may index duplicate versions of the same page.', 'Add canonical tags through an SEO plugin.', 'quick', 'seo', pg);
    if (!home.og) add('SEO', 'Low', 'No social sharing preview', 'Links shared on WhatsApp and Facebook show no image or summary.', 'Add sharing tags and a preview image.', 'quick', 'seo', HP);
    if (!home.ld) add('SEO', 'Low', 'No structured data', 'Search engines and AI assistants get no business details in a machine-readable form.', 'Add organisation and service schema.', 'quick', 'seo', HP);
    const t = s.tags || {};
    if (t.ua && !t.ga4 && !t.gtm) add('SEO', 'Medium', 'Analytics stopped working in 2023', 'The site still carries the retired Universal Analytics tag, so visits are no longer being measured.', 'Install Google Analytics 4 with conversion tracking.', 'quick', 'seo');
    else if (!t.ga4 && !t.gtm && !t.ua) add('SEO', 'Low', 'No analytics tag visible', 'We could not see Google Analytics or Tag Manager in the page, so visits and leads may not be measured.', 'Install Google Analytics 4 with conversion tracking.', 'quick', 'seo');

    // Design: signs of a dated or broken look. Read from the homepage and from Google's test of it.
    const g = home.design || {}, L = (m && m.design) || {}, RV = ['revamp', 'revamp'];
    if (L.contrast) add('Design', L.contrast >= 5 ? 'Medium' : 'Low', `Low-contrast text in ${plural(L.contrast, 'place')}`, 'Text that is too pale against its background is hard to read, especially on a phone outdoors.', 'Adjust text and background colours so everything is easy to read.', 'quick', 'revamp', HP);
    if (L.taps) add('Design', 'Medium', `${plural(L.taps, 'button or link', 'buttons or links')} too small or too close to tap`, 'On a phone these are easy to miss or to tap by mistake.', 'Make buttons and links at least 48 px tall with space between them.', 'quick', 'revamp', HP);
    if (L.stretched) add('Design', 'Medium', `${plural(L.stretched, 'image')} stretched out of shape`, 'Images shown at the wrong proportions make a site look careless.', 'Crop images to the proportions of the space they sit in.', 'quick', 'revamp', HP);
    if (L.blurry) add('Design', 'Low', `${plural(L.blurry, 'image')} blurry on sharp screens`, 'The image files are smaller than the space they fill, so they blur on modern phones.', 'Supply images at twice their displayed size.', 'quick', 'revamp', HP);
    const cls = m && m.metrics.find(x => x.id === 'cumulative-layout-shift');
    if (cls && cls.value > 0.25) add('Design', 'Medium', 'Content jumps around while loading', `Layout shift is ${cls.display}; Google\u2019s limit for a good experience is 0.1. Visitors lose their place or tap the wrong thing.`, 'Reserve space for images, banners and fonts so nothing moves.', 'quick', 'speed', HP);
    if (g.sliders) add('Design', 'Low', 'Rotating banner slider on the homepage', 'Sliders are an older pattern. Most visitors only see the first slide, and they slow the page down.', 'Replace the slider with one strong image and message.', ...RV, HP, { dated: true });
    if (g.gfonts > 3) add('Design', 'Low', `${g.gfonts} different font families`, 'More than two or three fonts makes a site look inconsistent, and each one slows it down.', 'Settle on one heading font and one body font.', ...RV, HP);
    if (g.gifs >= 3) add('Design', 'Low', `${g.gifs} animated GIF images`, 'Looping GIFs distract from the message and are heavy to load.', 'Replace GIFs with still images or short muted video.', ...RV, HP, { dated: true });
    if (g.bestViewed) add('Design', 'Medium', 'Leftovers from an older era of the web', 'Notes such as \u201cbest viewed in\u201d or a visitor counter date the site instantly.', 'Rebuild the page with a current design.', ...RV, HP, { dated: true });
    if (g.autoplay) add('Design', 'Medium', 'Sound or video plays by itself', 'Unexpected sound is one of the fastest ways to make visitors leave.', 'Let visitors choose to play media.', 'quick', 'maintenance', HP);
    if (g.popups) add('Design', 'Low', 'Uses a pop-up plugin', 'Pop-ups that appear on arrival interrupt visitors before they have read anything, and Google may rank pages with intrusive mobile pop-ups lower.', 'Show offers inside the page, or delay pop-ups until the visitor has engaged.', 'quick', 'maintenance', HP);
    if (!g.cta) add('Design', 'Medium', 'No clear call to action on the homepage', 'We found no button or link inviting visitors to contact, book, buy or enquire.', 'Add one clear call-to-action button near the top of every key page.', ...RV, HP);
    if (!g.tel && !g.wa) add('Design', 'Low', 'No tap-to-call or WhatsApp link', 'Mobile visitors cannot reach the business in one tap.', 'Add click-to-call and WhatsApp buttons.', 'quick', 'maintenance', HP);
    if (g.longForm > 8) add('Design', 'Low', `Long form (${g.longForm} fields)`, 'Every extra field loses some of the people who started filling it in.', 'Cut forms down to the few fields needed to reply.', 'quick', 'maintenance', HP);
    if (!g.proof) add('Design', 'Low', 'No testimonials or reviews on the homepage', 'Proof from real customers is one of the strongest reasons visitors trust a business.', 'Add real client reviews or testimonials.', ...RV, HP);
    if (g.navItems > 9) add('Design', 'Low', `Crowded main menu (${g.navItems} items)`, 'Too many choices make it harder for visitors to find the one they need.', 'Group the menu into five to seven clear items.', ...RV, HP);
    if (g.inlineStyles > 150) add('Design', 'Low', 'Heavily hand-patched styling', `${g.inlineStyles} elements carry one-off styles, a sign of years of quick fixes on top of the original design.`, 'Rebuild the page with a current design.', ...RV, HP, { dated: true });
    const builders = s.items.filter(i => i.group === 'Page builder' && !/Elementor Pro|block editor|Not detected/.test(i.name)).map(i => i.name);
    if (builders.length >= 2) add('Design', 'Low', `Two page builders in use (${builders.slice(0, 2).join(' and ')})`, 'Mixing builders gives pages slightly different looks and loads two sets of code.', 'Rebuild the key pages in Elementor so they are easier to edit and maintain.', ...RV);
    if (!g.favicon && r.site.favicon === false) add('Design', 'Low', 'No favicon', 'The browser tab and bookmarks show a blank icon where the logo should be.', 'Add a favicon made from the logo.', 'quick', 'maintenance');

    // Mobile and accessibility
    pg = on(p => !p.viewport);
    if (pg.length) add('Accessibility', 'Critical', 'Not built for mobile screens', 'No mobile viewport setting, so phones show a shrunken desktop page.', 'Rebuild on a responsive layout that adapts to every screen size.', 'revamp', 'revamp', pg);
    pg = on(p => p.legacy >= 3);
    if (pg.length) add('Design', 'High', 'Built with outdated layout code', 'Uses table, font or center tags. Websites stopped being built this way over a decade ago, and it does not adapt to phones.', 'Rebuild on a responsive layout that adapts to every screen size.', 'revamp', 'revamp', pg, { dated: true });
    if (sum('unlabelled')) add('Accessibility', sum('unlabelled') >= 5 ? 'Medium' : 'Low', `${plural(sum('unlabelled'), 'form field')} without a label`, 'Screen readers cannot tell the visitor what to type, and it weakens autofill.', 'Add a proper label to every form field.', 'quick', 'maintenance', on(p => p.unlabelled));

    // Security and upkeep
    if (!/^https:/i.test(home.url)) add('Security', 'Critical', 'No secure connection (HTTPS)', 'Browsers label the site “Not secure”, which puts visitors off filling in forms.', 'Install an SSL certificate and force HTTPS on every page.', 'quick', 'maintenance');
    pg = on(p => p.mixed);
    if (pg.length) add('Security', 'Medium', 'Insecure files on secure pages', `${plural(sum('mixed'), 'file')} still load over plain http, which browsers may block or flag.`, 'Load every image, script and stylesheet over HTTPS.', 'quick', 'maintenance', pg);
    if (P.some(p => p.flash)) add('Design', 'High', 'Uses Flash content', 'Flash was shut down in 2020 and no longer plays in any browser.', 'Replace Flash with video or modern animation.', 'revamp', 'revamp', on(p => p.flash), { dated: true });
    const H = r.site.headers || {}, miss = ['strict-transport-security', 'content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy'].filter(k => !H[k]);
    if (miss.length >= 3) add('Security', 'Low', `${miss.length} of 5 security headers missing`, 'These server settings protect visitors against common attacks such as clickjacking.', 'Add the standard security headers at the server or CDN.', 'quick', 'maintenance');
  }
  if (r.read && r.read.finding) add('Security', 'Critical', r.read.title, r.read.why, 'Get the site back online and reachable before anything else.', 'quick', 'maintenance');
  if (s.wp && s.wp.status === 'bad') add('Security', 'High', `WordPress is ${plural(s.wp.behind, 'release')} behind`, `Running ${s.wp.version}; the latest is ${s.wp.latest}. Old versions miss security fixes and are targeted by automated attacks.`, 'Update WordPress, the theme and plugins on a staging copy, then keep them current every month.', 'maintenance', 'maintenance');
  else if (s.wp && s.wp.status === 'warn') add('Security', 'Medium', 'WordPress update pending', `Running ${s.wp.version}; the latest is ${s.wp.latest}.`, 'Update WordPress, the theme and plugins on a staging copy, then keep them current every month.', 'maintenance', 'maintenance');
  if (s.elementor && (s.elementor.status === 'bad' || s.elementor.status === 'warn')) add('Security', s.elementor.status === 'bad' ? 'Medium' : 'Low', 'Elementor is behind', `Running ${s.elementor.version}; the latest is ${s.elementor.latest}.`, 'Update WordPress, the theme and plugins on a staging copy, then keep them current every month.', 'maintenance', 'maintenance');
  if (s.outdatedPlugins && s.outdatedPlugins.length) add('Security', s.outdatedPlugins.length >= 3 ? 'High' : 'Medium', `${plural(s.outdatedPlugins.length, 'plugin')} out of date`, `${s.outdatedPlugins.slice(0, 4).join(', ')}${s.outdatedPlugins.length > 4 ? ' and more' : ''}. Outdated plugins are a leading cause of hacked WordPress sites.`, 'Update WordPress, the theme and plugins on a staging copy, then keep them current every month.', 'maintenance', 'maintenance');
  if (s.php && s.php.old) add('Security', 'High', `Server runs PHP ${s.php.version}`, 'This PHP version no longer gets security fixes, and newer versions run noticeably faster.', 'Move to a current PHP version, or to better hosting.', 'maintenance', 'maintenance');
  if (s.jquery && +s.jquery.split('.')[0] < 3) add('Security', 'Low', `Runs an old jQuery (${s.jquery})`, 'jQuery 1 and 2 are no longer maintained and have known security issues.', 'Update outdated front-end libraries.', 'maintenance', 'maintenance');
  if (s.bootstrap && +s.bootstrap.split('.')[0] <= 3) add('Design', 'Medium', `Built on Bootstrap ${s.bootstrap.split('.')[0]}`, 'This framework version stopped receiving updates in 2019, a sign the site has not been rebuilt for years.', 'Update outdated front-end libraries.', 'revamp', 'revamp', null, { dated: true });
  if (s.domain && s.domain.soon) add('Security', 'High', `Domain expires on ${s.domain.expiresText}`, 'If the domain lapses, the website and email stop working.', 'Renew the domain and switch on auto-renew.', 'quick', 'maintenance');
  return out.sort((a, b) => ORDER[a.sev] - ORDER[b.sev]);
}

// Health Score out of 100 with a sub-score per category. Unmeasured categories are left out, not guessed.
export function healthOf(r) {
  const pen = c => Math.max(0, 100 - r.issues.filter(i => i.cat === c).reduce((t, i) => t + COST[i.sev], 0));
  const avg = (...v) => { v = v.filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const m = ok(r.psi.mobile), d = ok(r.psi.desktop), html = r.pages.length > 0;
  const pm = m ? m.scores.performance : null, pd = d ? d.scores.performance : null;
  const sub = {
    Performance: pm != null && pd != null ? Math.round(pm * 0.7 + pd * 0.3) : pm != null ? pm : pd,
    SEO: avg(html ? pen('SEO') : null, m ? m.scores.seo : null),
    Content: html ? pen('Content') : null,
    Images: html ? pen('Images') : null,
    Design: html ? pen('Design') : null,
    Accessibility: avg(html ? pen('Accessibility') : null, m ? m.scores.accessibility : null),
    Security: html || (r.read && r.read.finding) ? pen('Security') : null,
  };
  let tw = 0, t = 0;
  for (const c of CATS) if (sub[c] != null) { tw += WEIGHT[c]; t += sub[c] * WEIGHT[c]; }
  return { score: tw ? Math.round(t / tw) : null, sub };
}

export function strengthsOf(r) {
  const s = [], P = r.pages, home = P[0], n = P.length, st = r.stack, m = ok(r.psi.mobile), d = ok(r.psi.desktop);
  const all = f => n > 0 && P.every(f), scope = n > 1 ? `all ${n} pages checked` : 'the homepage';
  if (m && m.scores.performance >= 90) s.push(`Fast on mobile (${m.scores.performance} out of 100).`);
  if (d && d.scores.performance >= 90) s.push(`Fast on desktop (${d.scores.performance} out of 100).`);
  if (m && m.field && m.field.overall === 'FAST') s.push('Passes Core Web Vitals for real visitors.');
  if (m && m.scores.accessibility >= 90) s.push(`Strong accessibility score (${m.scores.accessibility} out of 100).`);
  if (m && m.scores.seo >= 90) s.push(`Google’s basic SEO checklist is met (${m.scores.seo} out of 100).`);
  if (home) {
    if (/^https:/i.test(home.url)) s.push('Secure HTTPS connection is in place.');
    if (home.viewport) s.push('Layout is set up for mobile screens.');
    if (all(p => p.title && p.desc)) s.push(`Titles and descriptions are written on ${scope}.`);
    if (all(p => p.h1 === 1 && !p.skipped)) s.push(`Clean heading structure on ${scope}.`);
    const imgs = P.reduce((t, p) => t + p.imgs, 0);
    if (imgs >= 5 && !P.some(p => p.noAlt)) s.push(`All ${imgs} images checked have alt text.`);
    if (P.reduce((t, p) => t + p.newFmt, 0) > P.reduce((t, p) => t + p.oldFmt, 0)) s.push('Images are served in modern formats.');
    if (r.site.sitemap && r.site.robots) s.push('Sitemap and robots.txt are in place.');
    if (home.ld) s.push('Structured data is present.');
    if (home.og) s.push('Social sharing previews are set up.');
    if (n > 1 && !r.broken.length) s.push(`No broken links found across ${n} pages.`);
    const hd = home.design || {};
    if (hd.cta) s.push('Clear call to action on the homepage.');
    if (hd.tel || hd.wa) s.push('One-tap contact by phone or WhatsApp.');
    if (hd.proof) s.push('Testimonials or reviews are shown.');
  }
  if (st.verdict.tone === 'good') s.push('Built on WordPress and Elementor, the stack we recommend.');
  if (st.wp && st.wp.status === 'good') s.push(`WordPress is up to date (${st.wp.version}).`);
  if (st.elementor && st.elementor.status === 'good') s.push(`Elementor is up to date (${st.elementor.version}).`);
  if (st.php && !st.php.old) s.push(`Server runs a supported PHP version (${st.php.version}).`);
  if (st.tags && (st.tags.ga4 || st.tags.gtm)) s.push('Analytics tracking is installed.');
  return s;
}

// Design verdict from the Design findings. Rules catch dated or broken design; they cannot judge taste.
export function designOf(r) {
  const NOTE = 'These checks catch dated or broken design. They cannot judge taste, so have a designer look before you pitch.';
  if (!r.pages || !r.pages.length) return { tone: 'info', label: 'Not checked', note: 'The site could not be read, so its design was not checked.' };
  const d = r.issues.filter(i => i.cat === 'Design'), noMobile = r.issues.some(i => i.title === 'Not built for mobile screens');
  const cost = d.reduce((t, i) => t + COST[i.sev], 0) + (noMobile ? 30 : 0), dated = d.filter(i => i.dated);
  // "Dated" needs real signs of age (old layout code, sliders, leftovers), not just polish issues like contrast.
  if (noMobile || dated.some(i => i.sev === 'High') || dated.length >= 2 || cost >= 70) return { tone: 'bad', label: 'Looks dated, a redesign is recommended', note: NOTE };
  if (cost >= 15) return { tone: 'warn', label: 'Design needs attention', note: NOTE };
  return { tone: 'good', label: 'No design red flags', note: NOTE };
}

// Match the detected stack against the Skills Matrix in config.json (expert / support / none).
export function skillsFit(stack, cfg) {
  if (!stack.platform || stack.platform.kind === 'none') return { verdict: 'Take with caution', tone: 'warn', reasons: ['The platform could not be detected. Confirm what the site runs on before quoting.'] };
  const names = [...new Set([stack.platform.name, ...(stack.builder ? [stack.builder.name] : []), ...stack.items.filter(i => i.group === 'Plugins' && cfg.skills[i.name]).map(i => i.name)])];
  const lvl = k => names.filter(x => (cfg.skills[x] || 'unknown') === k);
  const none = lvl('none'), sup = lvl('support'), unk = lvl('unknown');
  if (none.length) return { verdict: 'Not a fit', tone: 'bad', reasons: [...none.map(x => `Built on ${x}, which we do not support.`), 'We could only take this on as a rebuild on WordPress with Elementor.'] };
  if (sup.length || unk.length) return { verdict: 'Take with caution', tone: 'warn', reasons: [...sup.map(x => `${x}: we can support it, but it is not our core stack.`), ...unk.map(x => `${x} is not in our Skills Matrix yet. Check with the web team.`), ...(lvl('expert').length ? [`${lvl('expert').join(' and ')}: in our expert stack.`] : [])] };
  return { verdict: 'Can take', tone: 'good', reasons: [`${names.join(', ')}: all in our expert stack.`] };
}

// Recommendations grouped as quick fixes, revamp items and ongoing maintenance, each tied to a service package.
export function nextSteps(r, cfg) {
  const g = { quick: [], revamp: [], maintenance: [] }, seen = new Set(), P = cfg.packages;
  const tone = r.stack.verdict.tone, kind = r.stack.platform ? r.stack.platform.kind : '';
  if (kind && kind !== 'wordpress' && (tone === 'bad' || tone === 'warn')) g.revamp.push({ text: 'Rebuild the site on WordPress with Elementor, so the client owns it and their team can edit pages without a developer.', pkg: P.revamp });
  else if (kind === 'wordpress' && r.stack.builder && r.stack.builder.id !== 'elementor') g.revamp.push({ text: 'Rebuild the key pages in Elementor so they are easier to edit and maintain.', pkg: P.revamp });
  if (r.design && r.design.tone === 'bad') g.revamp.push({ text: 'Redesign the site with a current, mobile-first look and one clear call to action.', pkg: P.revamp });
  for (const i of r.issues) { if (seen.has(i.fix)) continue; seen.add(i.fix); g[i.group].push({ text: i.fix, pkg: P[i.pkg] }); }
  if (kind === 'wordpress' && !g.maintenance.length) g.maintenance.push({ text: 'Keep WordPress, the theme and plugins updated every month, with backups and uptime monitoring.', pkg: P.maintenance });
  for (const k in g) g[k] = g[k].slice(0, 7);
  return g;
}

export function verdictOf(r) {
  const h = r.health.score, tone = r.stack.verdict.tone;
  const top = r.issues.filter(i => (i.sev === 'Critical' || i.sev === 'High') && !i.win).slice(0, 3).map(i => i.title);
  const list = (top.length ? ` Biggest issues: ${top.join('; ')}.` : '') + (ok(r.psi.mobile) || ok(r.psi.desktop) ? '' : ' Speed was not measured in this scan.');
  if (h == null) return { tone: 'info', label: 'Not enough data', summary: 'The site could not be read and the speed test did not run. Try the scan again later.' };
  if (h < 60 || (tone === 'bad' && h < 75) || r.issues.filter(i => i.sev === 'Critical').length >= 2 || (r.design && r.design.tone === 'bad' && h < 75)) return { tone: 'bad', label: 'Strong case for a revamp', summary: `There is a lot to fix here, and a revamp will be easier to justify than patching.${list}` };
  if (h < 80 || tone === 'bad') return { tone: 'warn', label: 'Clear room to improve', summary: `The site works, but it is leaving results on the table.${list}` };
  return { tone: 'good', label: 'In good shape', summary: `This site is in good shape on the things we can measure, so lead with design, content or marketing.${list}` };
}
