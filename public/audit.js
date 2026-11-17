// SenseCheck audit: page facts, issues, strengths, health score, skills fit and next steps.
// Rule lists (placeholder phrases, thresholds, packages, Skills Matrix) live in config.json.
import { SPEED_FIX, FRIENDLY } from './analyze.js';

const YEAR = new Date().getFullYear();
const COST = { Critical: 30, High: 18, Medium: 10, Low: 4 };
const costOf = i => (i.tip ? 2 : COST[i.sev]); // a tip is an idea to pitch, not a fault, so it costs less
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
  const txt = e => (e.textContent || '').replace(/\s+/g, ' ').trim(), hrefs = q('a[href]').map(a => a.getAttribute('href') || '');
  const anyLink = re => q('a[href]').some(a => re.test(a.getAttribute('href') || '') || re.test(txt(a).slice(0, 50)));
  const bodyCls = ` ${doc.body ? doc.body.className || '' : ''} `, vp = (doc.querySelector('meta[name="viewport" i]') || { getAttribute: () => '' }).getAttribute('content') || '';
  // What kind of page this is, so the crawl can leave blog posts out and treat a blog listing as a listing.
  const post = / single-post /.test(bodyCls);
  const blogIndex = / blog /.test(bodyCls) || (/ archive /.test(bodyCls) && / (category|tag|date|author) /.test(bodyCls)) || /^\/(blogs?|news|berita|artikel|articles?|insights?|stories|updates|press)\/?$/i.test(base.pathname);
  const design = {
    privacy: anyLink(/privacy|privasi|pdpa|personal[- ]data|data[- ]peribadi/i), contactPage: anyLink(/contact|hubungi|get[- ]in[- ]touch|reach[- ]us/i),
    mailto: q('a[href^="mailto:" i]').length, forms: q('form').filter(f => !f.querySelector('input[type="search" i],[name="s"]')).length,
    social: new Set(hrefs.map(h => (h.match(/\/\/(?:www\.|m\.)?(facebook|instagram|tiktok|linkedin|youtube|twitter|x)\.com/i) || [])[1]).filter(Boolean)).size,
    longParas: q('p').filter(p => txt(p).split(' ').length > 130).length, h1Text: txt(doc.querySelector('h1') || {}).slice(0, 140),
    vague: q('a,button').filter(e => /^(click here|read more|learn more|more|here|more info|find out more|baca lagi|selanjutnya|klik sini)\W*$/i.test(txt(e))).length,
    noZoom: /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0+)?(\D|$)/i.test(vp),
    fa4: /font-?awesome[^"'\s]*[\/-]4\.\d|font-awesome(\.min)?\.css\?ver=4\./i.test(html),
    oldFont: ((html.match(/font-family\s*:\s*["']?\s*(comic sans ms|papyrus|times new roman|courier new)/i) || html.match(/<font[^>]+face=["']?\s*(comic sans ms|papyrus|times new roman|arial|verdana)/i) || [])[1] || '').toLowerCase(),
    video: q('video,lite-youtube,iframe[src*="youtube" i],iframe[src*="vimeo" i],iframe[data-src*="youtube" i]').length > 0 || /elementor-widget-video|wp-block-video|wp-block-embed-youtube/.test(html),
    map: q('iframe[src*="google.com/maps" i],iframe[src*="maps.google" i],iframe[data-src*="google.com/maps" i]').length > 0 || anyLink(/google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|waze\.com/i),
    kit: (bodyCls.match(/ elementor-kit-(\d+) /) || [])[1] || '',
    webFonts: fams.size + (html.match(/@font-face/gi) || []).length + q('link[rel="preload" i][as="font" i]').length + (/use\.typekit\.net|fonts\.bunny\.net/i.test(html) ? 1 : 0),
    blogLink: anyLink(/\/(blogs?|news|berita|artikel|articles|insights)(\/|$)/i), about: anyLink(/about|tentang|who[- ]we[- ]are|our[- ]story|profil/i),
    work: anyLink(/portfolio|gallery|galeri|projects?|our[- ]work|case[- ]stud|projek/i),
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
    scripts, year: years.length ? Math.max(...years) : 0, links, evidence, post, blogIndex,
    design: { ...design, gifs: imgs.filter(i => ext(real(i)) === 'gif').length,
      stock: imgs.filter(i => /shutterstock|istock|depositphotos|adobestock|gettyimages|dreamstime|123rf|freepik|pexels-|unsplash|pixabay/i.test(real(i))).length,
      phoneText: /(?:\+?60|\b0)\d{1,2}[\s-]?\d{3,4}[\s-]?\d{3,4}\b/.test(text), faq: /"@type"\s*:\s*"FAQPage"/.test(html) || /\bfaqs?\b|frequently asked|soalan lazim/i.test(text),
      proof: design.proofMarkup || /testimoni|review|what (our|my) (clients?|customers?|patients?) say|ulasan/i.test(text),
      bestViewed: /best viewed (in|with)|hit counter|visitor counter|you are visitor/i.test(text) },
  };
}

// Every issue: category, severity, where it was found, a plain-English fix, a group and a service package.
// The wording is deliberately friendly and everyday: these lines are read by sales staff and by clients.
export function buildIssues(r, cfg) {
  const out = [], P = r.pages, home = P[0], s = r.stack, T = cfg.thresholds;
  const HP = home ? [home.path] : null, name = p => (home && p === home.path ? 'Homepage' : p);
  const where = list => (!list ? 'Whole site' : list.length === 1 ? name(list[0]) : `${name(list[0])} and ${list.length - 1} more`);
  const add = (cat, sev, title, detail, fix, group, pkg, pages, extra) => out.push({ cat, sev, title, detail, fix, group, pkg, where: where(pages), ...extra });
  const on = f => P.filter(f).map(p => p.path);
  const sum = k => P.reduce((t, p) => t + p[k], 0);
  const m = ok(r.psi.mobile), d = ok(r.psi.desktop);
  const TUNE = 'We’d give the site a full speed tune-up: lighter images, less code, better caching and hosting.';
  const IMG = 'We’d shrink and compress the images, and load the lower ones only when they’re needed.';
  const TITLES = 'We’d write a clear title and description for every page.', HEADS = 'We’d give every page one clear main heading and tidy up the heading order.';
  const FRESH = 'We’d rebuild the page with a fresh, modern design.', FLEX = 'We’d rebuild it so it adapts to every screen size.';
  const UPD = 'We’d update WordPress, the theme and plugins safely on a test copy, then keep them up to date every month.';
  const GA = 'We’d set up Google Analytics 4 and track enquiries.';
  let pg;

  // Performance
  if (m) {
    const p = m.scores.performance, lcp = m.metrics.find(x => x.id === 'largest-contentful-paint');
    const lcpLine = lcp && lcp.display ? ` The main part of the page takes ${lcp.display} to show up, and people expect about 2.5 seconds.` : '';
    if (p != null && p < 50) add('Performance', p < 30 ? 'Critical' : 'High', `Really slow on phones (${p} out of 100)`, `Google rates the mobile speed as poor.${lcpLine} Most people give up before a page this slow finishes loading.`, TUNE, 'quick', 'speed', HP);
    else if (p != null && p < 90) add('Performance', 'Medium', `Could be faster on phones (${p} out of 100)`, `Not bad, but still under Google’s “good” mark of 90.${lcpLine}`, 'We’d speed up the slowest parts of the page for mobile visitors.', 'quick', 'speed', HP);
    if (m.field && m.field.overall === 'SLOW') add('Performance', 'High', 'Real visitors are getting a slow site', 'This isn’t a lab test. Google’s data from actual visitors over the last 28 days says the site feels slow, and Google uses that when it ranks pages.', 'We’d fix the loading problems until the real-visitor data turns green.', 'quick', 'speed', HP);
    for (const w of m.wins) {
      const kbs = (w.display.match(/([\d,]+)\s*KiB/) || [])[1];
      const gain = w.saving >= 100 ? `Fixing this could save about ${(w.saving / 1000).toFixed(1)} seconds on phones.` : kbs ? `About ${kbs} KB could be trimmed off the page.` : 'Google’s speed test flagged this.';
      add('Performance', w.saving >= 1000 ? 'High' : w.saving >= 300 ? 'Medium' : 'Low', FRIENDLY[w.id] || w.title, gain, (SPEED_FIX.find(([re]) => re.test(w.id)) || [0, 'We’d sort this out as part of a speed tune-up.'])[1], 'quick', 'speed', HP, { win: true });
    }
    if (m.weight && m.weight > 3000) add('Performance', 'Medium', `The homepage is heavy (${(m.weight / 1024).toFixed(1)} MB)`, 'It downloads far more than it needs to, which hurts anyone on mobile data.', IMG, 'quick', 'speed', HP);
  }
  if (d && d.scores.performance != null && d.scores.performance < 50) add('Performance', 'Medium', `Slow on computers too (${d.scores.performance} out of 100)`, 'Computers usually score much higher than phones, so a low score here means the page itself is heavy.', TUNE, 'quick', 'speed', HP);

  if (home) {
    if (home.scripts > 40) add('Performance', 'Low', `${home.scripts} script files on the homepage`, 'Every script is one more download, and more work for the phone before the page responds.', 'We’d remove code that isn’t needed and hold back outside scripts until they’re used.', 'quick', 'speed', HP);

    // Content
    pg = on(p => p.placeholders.length);
    if (pg.length) add('Content', 'High', 'Leftover dummy text on the site', `We found “${[...new Set(P.flatMap(p => p.placeholders))].slice(0, 3).join('”, “')}”. Visitors are seeing unfinished content, which looks careless.`, 'We’d replace the dummy text with real copy, or take those pages down.', 'quick', 'maintenance', pg);
    if (r.broken.length) add('Content', r.broken.length >= 3 ? 'High' : 'Medium', plural(r.broken.length, 'broken link'), `Clicking these leads to an error page: ${r.broken.slice(0, 3).map(b => `${b.path} (${b.status})`).join(', ')}${r.broken.length > 3 ? ' and more' : ''}. That’s a dead end for visitors and for Google.`, 'We’d fix or redirect every broken link.', 'quick', 'maintenance', [...new Set(r.broken.map(b => b.from))]);
    pg = on(p => p.words < T.thinWords);
    if (pg.length) add('Content', 'Medium', `${plural(pg.length, 'page')} with almost nothing on ${pg.length === 1 ? 'it' : 'them'}`, `Under ${T.thinWords} words of text. Thin pages look unfinished and rarely show up on Google.`, 'We’d write proper content for these pages, or merge them into others.', 'revamp', 'revamp', pg);
    const yr = Math.max(...P.map(p => p.year));
    if (yr && yr <= YEAR - 2) add('Content', 'Low', `The footer still says © ${yr}`, 'It’s a small thing, but it tells visitors nobody has touched the site in a while.', 'We’d make the year update by itself.', 'quick', 'maintenance');

    // Images
    const noAlt = sum('noAlt'), imgs = sum('imgs');
    if (noAlt) add('Images', noAlt >= 10 ? 'Medium' : 'Low', `${plural(noAlt, 'image')} with no description`, `Out of ${imgs} we checked. The description (alt text) is how Google understands a picture, and what screen readers read aloud.`, 'We’d add a short description to every meaningful image.', 'quick', 'seo', on(p => p.noAlt));
    if (r.bigImages.length) { const top = Math.max(...r.bigImages.map(b => b.kb)); add('Images', top >= 1000 ? 'High' : 'Medium', `${plural(r.bigImages.length, 'image')} on the homepage ${r.bigImages.length === 1 ? 'is' : 'are'} too big`, `Each is over ${T.imageKB} KB, and the largest is ${top >= 1000 ? (top / 1024).toFixed(1) + ' MB' : top + ' KB'}. Most website images should be under 200 KB.`, IMG, 'quick', 'speed', HP); }
    if (sum('oldFmt') >= 5 && !sum('newFmt')) add('Images', 'Medium', 'Images are in older, heavier formats', `All ${sum('oldFmt')} are JPEG or PNG. Newer formats like WebP look the same and are usually 25 to 50% smaller.`, IMG, 'quick', 'speed');
    if (sum('notLazy') >= 5) add('Images', 'Low', `${plural(sum('notLazy'), 'image')} load before they’re needed`, 'Pictures further down the page download straight away, even if the visitor never scrolls that far.', IMG, 'quick', 'speed', on(p => p.notLazy));

    // SEO
    pg = on(p => !p.title);
    if (pg.length) add('SEO', 'High', `${plural(pg.length, 'page')} with no title`, 'The title is the headline Google shows in search results. Without one, the page is easy to skip.', TITLES, 'quick', 'seo', pg);
    const dup = k => { const c = {}; P.forEach(p => { if (p[k]) (c[p[k]] = c[p[k]] || []).push(p.path); }); return Object.values(c).filter(v => v.length > 1).flat(); };
    pg = dup('title');
    if (pg.length) add('SEO', 'Medium', `${pg.length} pages share the same title`, 'Google can’t tell these pages apart, so they end up competing with each other.', TITLES, 'quick', 'seo', pg);
    pg = on(p => !p.desc);
    if (pg.length) add('SEO', 'Medium', `${plural(pg.length, 'page')} with no description for Google`, 'Google has to guess the summary under the title, and it often guesses badly.', TITLES, 'quick', 'seo', pg);
    pg = dup('desc');
    if (pg.length) add('SEO', 'Low', `${pg.length} pages share the same description`, 'Each page should describe what is actually on it.', TITLES, 'quick', 'seo', pg);
    pg = on(p => p.h1 === 0);
    if (pg.length) add('SEO', 'Medium', `${plural(pg.length, 'page')} with no main heading`, 'Without a main heading (H1), Google and visitors can’t quickly tell what the page is about.', HEADS, 'quick', 'seo', pg);
    pg = on(p => p.h1 > 1);
    if (pg.length) add('SEO', 'Low', `${plural(pg.length, 'page')} with more than one main heading`, 'Several main headings blur what the page is really about.', HEADS, 'quick', 'seo', pg);
    pg = on(p => p.skipped);
    if (pg.length) add('SEO', 'Low', `Headings are out of order on ${plural(pg.length, 'page')}`, 'Headings jump levels (for example straight from H2 to H4), which confuses Google and screen readers.', HEADS, 'quick', 'seo', pg);
    if (r.site.sitemap === false) add('SEO', 'Medium', 'No sitemap for Google', 'A sitemap is the list of pages you hand to Google. Without it, new pages take longer to be found.', 'We’d create a sitemap and submit it in Google Search Console.', 'quick', 'seo');
    if (r.site.robots === false) add('SEO', 'Low', 'No robots.txt file', 'This small file tells search engines what to read and where the sitemap is.', 'We’d add one that points to the sitemap.', 'quick', 'seo');
    pg = on(p => !p.canonical);
    if (pg.length) add('SEO', 'Low', `${plural(pg.length, 'page')} that ${pg.length === 1 ? 'doesn’t' : 'don’t'} say which version is the original`, 'Without a canonical tag, Google may list duplicate versions of the same page.', 'We’d add canonical tags with an SEO plugin.', 'quick', 'seo', pg);
    if (!home.og) add('SEO', 'Low', 'Links look plain when shared', 'Share the link on WhatsApp or Facebook and it shows no picture or summary, so fewer people tap it.', 'We’d add a share image and summary.', 'quick', 'seo', HP);
    if (!home.ld) add('SEO', 'Low', 'No business details in a form Google can read', 'Search engines and AI assistants get no structured facts about the business, such as its name, services and contact details.', 'We’d add business and service schema.', 'quick', 'seo', HP);
    const t = s.tags || {};
    if (t.ua && !t.ga4 && !t.gtm) add('SEO', 'Medium', 'Visitor tracking stopped working in 2023', 'The site still uses the old Google Analytics, which Google switched off. Visits aren’t being counted any more.', GA, 'quick', 'seo');
    else if (!t.ga4 && !t.gtm && !t.ua) add('SEO', 'Low', 'We couldn’t see any visitor tracking', 'No Google Analytics or Tag Manager showed up in the page, so visits and enquiries may not be measured.', GA, 'quick', 'seo');

    // Design. Each finding carries an area so the Design section can group the advice. Faults count against the
    // score as usual; tips (tip: true) are ideas worth pitching and only cost a little.
    const g = home.design || {}, L = (m && m.design) || {}, RV = ['revamp', 'revamp'];
    const A = a => ({ area: a }), OLD = a => ({ dated: true, area: a }), TIP = a => ({ tip: true, area: a });
    const FIRST = 'First impression', FONT = 'Fonts and colours', PHOTO = 'Photos and visuals', LAY = 'Layout and navigation', TRUST = 'Trust and getting in touch', PHONE = 'On phones';
    const h1 = g.h1Text || '', h1Words = h1 ? h1.split(' ').length : 0;
    if (/^(home|homepage|welcome|welcome to .{0,40}|selamat datang.{0,40}|laman utama|untitled)\W*$/i.test(h1)) add('Design', 'Medium', `The headline only says “${h1}”`, 'The first line people read should say what the business does and why it matters to them. A greeting doesn’t do that.', 'We’d write a headline that says what you offer and who it’s for.', ...RV, HP, A(FIRST));
    else if (h1Words > 14) add('Design', 'Low', 'The headline is very long', `It runs to ${h1Words} words. People decide in a few seconds whether to stay, so one short, punchy line works better.`, 'We’d cut the headline to one short line and put the detail underneath.', ...RV, HP, TIP(FIRST));
    if (g.sliders) add('Design', 'Low', 'Rotating banner on the homepage', 'Sliders are an older style. Most visitors only ever see the first slide, and they slow the page down.', 'We’d swap it for one strong image and message.', ...RV, HP, OLD(FIRST));
    if (!g.cta) add('Design', 'Medium', 'No clear next step for visitors', 'We couldn’t find a button inviting people to contact, book, buy or enquire. Interested visitors have nowhere obvious to go.', 'We’d add one clear call-to-action button near the top of every key page.', ...RV, HP, A(FIRST));
    if (g.autoplay) add('Design', 'Medium', 'Sound or video starts by itself', 'Unexpected sound is one of the quickest ways to make someone close the page.', 'We’d let visitors press play themselves.', 'quick', 'maintenance', HP, A(FIRST));
    if (g.popups) add('Design', 'Low', 'Pop-ups get in the way', 'A pop-up plugin is installed. Pop-ups that appear straight away interrupt people before they’ve read anything, and Google may rank pages with intrusive mobile pop-ups lower.', 'We’d show offers inside the page, or wait until the visitor has had a look around.', 'quick', 'maintenance', HP, A(FIRST));
    const cls = m && m.metrics.find(x => x.id === 'cumulative-layout-shift');
    if (cls && cls.value > 0.25) add('Design', 'Medium', 'Things jump around while the page loads', `Text and buttons shift as images and banners appear (layout shift ${cls.display}; Google’s limit is 0.1). People lose their place or tap the wrong thing.`, 'We’d reserve space for images and banners so nothing moves.', 'quick', 'speed', HP, A(FIRST));

    if (L.contrast) add('Design', L.contrast >= 5 ? 'Medium' : 'Low', `Some text is hard to read (${plural(L.contrast, 'place')})`, 'The text is too pale against its background. It’s a strain to read, especially on a phone outdoors.', 'We’d adjust the colours so everything is easy to read.', 'quick', 'revamp', HP, A(FONT));
    if (g.gfonts > 3) add('Design', 'Low', `${g.gfonts} different fonts in use`, 'More than two or three fonts makes a site look messy, and each one slows it down.', 'We’d settle on one font for headings and one for text.', ...RV, HP, A(FONT));
    if (m && m.why && m.why.bytes && !m.why.bytes.font && !g.webFonts) add('Design', 'Low', 'No brand font, just whatever the device has', 'The site doesn’t load a font of its own, so the text looks a bit plain and changes from one phone or computer to the next.', 'We’d pick one clear brand font and use it everywhere.', ...RV, HP, TIP(FONT));
    if (g.oldFont) add('Design', 'Low', `An old-fashioned font is in use (${g.oldFont.replace(/\b\w/g, c => c.toUpperCase())})`, 'Fonts like this were everywhere in the 2000s, so the site feels older than it is.', 'We’d move to a clean, modern font.', ...RV, HP, OLD(FONT));
    if (r.site.kitStarter) add('Design', 'Low', 'Elementor still has its starter colours', 'The site-wide colours in Elementor were never changed from the ones it comes with. So every section was coloured by hand, which is how small mismatches creep in.', 'We’d set the brand colours and fonts once in Elementor’s site settings, so every page matches.', ...RV, null, TIP(FONT));

    if (L.stretched) add('Design', 'Medium', `${plural(L.stretched, 'image')} look${L.stretched === 1 ? 's' : ''} stretched`, 'Pictures shown in the wrong shape make a site look careless.', 'We’d crop the images to fit their space properly.', 'quick', 'revamp', HP, A(PHOTO));
    if (L.blurry) add('Design', 'Low', `${plural(L.blurry, 'image')} look${L.blurry === 1 ? 's' : ''} blurry on newer phones`, 'The files are smaller than the space they fill, so they blur on sharp screens.', 'We’d supply sharper versions.', 'quick', 'revamp', HP, A(PHOTO));
    if (g.stock) add('Design', 'Low', `${plural(g.stock, 'photo')} look${g.stock === 1 ? 's' : ''} like stock images`, 'The file names point to stock photo sites. People can tell, and the same pictures turn up on other websites, so the business feels less real.', 'We’d swap them for real photos of the team, the place and the work.', ...RV, HP, TIP(PHOTO));
    if (g.gifs >= 3) add('Design', 'Low', `${g.gifs} animated GIFs`, 'Looping animations pull attention away from the message, and they’re heavy to load.', 'We’d replace them with still images or short video.', ...RV, HP, OLD(PHOTO));
    if (g.fa4) add('Design', 'Low', 'The icons come from an old icon set', 'The site still loads Font Awesome 4, which came out in 2013. The icons look dated next to newer sites.', 'We’d switch to a current, lighter icon set.', ...RV, HP, OLD(PHOTO));
    if (!g.favicon && r.site.favicon === false) add('Design', 'Low', 'No little logo in the browser tab', 'The tab and bookmarks show a blank icon where the logo should be.', 'We’d add a favicon made from the logo.', 'quick', 'maintenance', null, A(PHOTO));

    if (g.navItems > 9) add('Design', 'Low', `The main menu is crowded (${g.navItems} items)`, 'Too many choices make it harder to find the right one.', 'We’d group the menu into five to seven clear items.', ...RV, HP, A(LAY));
    if (g.longParas >= 2) add('Design', 'Low', `${g.longParas} big blocks of text on the homepage`, 'Long paragraphs with no breaks are tiring to read on a phone, so most people skip them.', 'We’d break the text into short paragraphs with clear subheadings and bullet points.', ...RV, HP, TIP(LAY));
    if (home.words > 3000) add('Design', 'Low', 'The homepage tries to say everything', `It holds about ${Math.round(home.words / 100) * 100} words. A homepage works best as a short tour that points people to the right page.`, 'We’d trim the homepage and move the detail to its own pages.', ...RV, HP, TIP(LAY));
    if (g.bestViewed) add('Design', 'Medium', 'Leftovers from an older era of the web', 'Things like “best viewed in” notes or a visitor counter make the site look years out of date.', FRESH, ...RV, HP, OLD(LAY));
    if (g.inlineStyles > 150) add('Design', 'Low', 'Years of quick fixes show in the code', `${g.inlineStyles} elements carry one-off styling, which usually means patches on top of patches. It makes the look inconsistent and every change risky.`, FRESH, ...RV, HP, OLD(LAY));
    const builders = s.items.filter(i => i.group === 'Page builder' && !/Elementor Pro|block editor|Not detected/.test(i.name)).map(i => i.name);
    if (builders.length >= 2) add('Design', 'Low', `Two page builders are mixed (${builders.slice(0, 2).join(' and ')})`, 'Pages built with different tools look slightly different from each other and load two sets of code.', 'We’d rebuild the key pages in Elementor so everything matches and is easy to edit.', ...RV, null, A(LAY));
    if (/^twenty/i.test(s.themeSlug || '') && !s.builder) add('Design', 'Low', 'The site uses a free WordPress starter theme', 'It’s the theme WordPress comes with, so the site looks like thousands of others.', 'We’d design a look that belongs to the brand.', ...RV, null, TIP(LAY));

    if (!g.proof) add('Design', 'Low', 'No customer reviews on the homepage', 'Reviews and testimonials are one of the biggest reasons people trust a business they’ve only just found.', 'We’d add real reviews or testimonials.', ...RV, HP, A(TRUST));
    if (!g.tel && !g.wa) add('Design', 'Low', 'No one-tap call or WhatsApp button', 'Someone on a phone can’t reach the business in one tap.', 'We’d add click-to-call and WhatsApp buttons.', 'quick', 'maintenance', HP, A(TRUST));
    else if (!g.wa) add('Design', 'Low', 'No WhatsApp button', 'Most customers in Malaysia would rather send a quick WhatsApp than make a phone call.', 'We’d add a WhatsApp button that stays in reach as people scroll.', 'quick', 'maintenance', HP, TIP(TRUST));
    if (g.longForm > 8) add('Design', 'Low', `The form is long (${g.longForm} fields)`, 'Every extra field loses some of the people who started filling it in.', 'We’d cut it down to the few details needed to reply.', 'quick', 'maintenance', HP, A(TRUST));
    if (g.vague >= 4) add('Design', 'Low', `${g.vague} buttons just say “read more” or “click here”`, 'A button should tell people what they’ll get. Vague ones are easy to ignore, and Google learns nothing from them.', 'We’d reword them, for example “See our prices” or “Book a visit”.', 'quick', 'revamp', HP, TIP(TRUST));
    if (!g.social) add('Design', 'Low', 'No links to social media', 'People often check Facebook or Instagram to see that a business is real and active before they get in touch.', 'We’d add the social media links to the header or footer.', 'quick', 'maintenance', HP, TIP(TRUST));

    if (L.taps) add('Design', 'Medium', `${plural(L.taps, 'button or link', 'buttons or links')} hard to tap`, 'They’re too small or too close together, so on a phone people miss, or tap the wrong one.', 'We’d make buttons bigger, with more space around them.', 'quick', 'revamp', HP, A(PHONE));
    if (g.noZoom) add('Accessibility', 'Low', 'Zooming is switched off on phones', 'People who need bigger text can’t pinch to zoom in.', 'We’d allow zooming again.', 'quick', 'maintenance', HP);

    // Trust basics: a way to reach the business, and a privacy notice.
    const anyD = k => P.some(p => p.design && p.design[k]);
    if (!['tel', 'wa', 'mailto', 'phoneText', 'contactPage'].some(anyD)) add('Content', 'Medium', 'No contact details we could find', 'No phone number, email, WhatsApp link or contact page turned up on the pages we checked. If people can’t reach the business, the website can’t bring in enquiries.', 'We’d add a contact page, and put the phone number and WhatsApp in the header and footer.', 'quick', 'maintenance');
    if (!anyD('privacy')) add('Security', anyD('forms') ? 'Medium' : 'Low', 'No privacy policy we could find', anyD('forms') ? 'The site collects people’s details through a form but doesn’t say what happens to them. Malaysia’s data protection law (PDPA) expects a business to tell people this.' : 'None of the pages we checked link to a privacy notice. It’s a small thing that makes a business look more trustworthy.', 'We’d add a privacy policy page and link it in the footer.', 'quick', 'maintenance');

    // Mobile and accessibility
    pg = on(p => !p.viewport);
    if (pg.length) add('Accessibility', 'Critical', 'The site isn’t made for phones', 'Phones show a shrunken desktop page that people have to pinch and zoom. Most visitors today are on phones.', FLEX, 'revamp', 'revamp', pg, { noMobile: true });
    pg = on(p => p.legacy >= 3);
    if (pg.length) add('Design', 'High', 'The layout is built the old way', 'The page uses layout code from the 2000s (tables and font tags). It looks dated and doesn’t adapt to phones.', FLEX, 'revamp', 'revamp', pg, OLD('Under the hood'));
    if (sum('unlabelled')) add('Accessibility', sum('unlabelled') >= 5 ? 'Medium' : 'Low', `${plural(sum('unlabelled'), 'form field')} with no label`, 'People using screen readers can’t tell what to type, and autofill works less well.', 'We’d label every form field properly.', 'quick', 'maintenance', on(p => p.unlabelled));

    // Security and upkeep
    if (!/^https:/i.test(home.url)) add('Security', 'Critical', 'The site isn’t secure (no HTTPS)', 'Browsers show a “Not secure” warning, which puts people off filling in forms.', 'We’d install an SSL certificate and switch every page to HTTPS.', 'quick', 'maintenance');
    pg = on(p => p.mixed);
    if (pg.length) add('Security', 'Medium', 'Some files still load the insecure way', `${plural(sum('mixed'), 'file')} load over plain http on secure pages, so browsers may block them or show a warning.`, 'We’d switch every image, script and style to HTTPS.', 'quick', 'maintenance', pg);
    if (P.some(p => p.flash)) add('Design', 'High', 'The site still uses Flash', 'Flash was shut down in 2020 and no longer plays in any browser, so that part of the site is simply blank.', 'We’d replace it with video or modern animation.', 'revamp', 'revamp', on(p => p.flash), OLD('Under the hood'));
    const H = r.site.headers || {}, miss = ['strict-transport-security', 'content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy'].filter(k => !H[k]);
    if (miss.length >= 3) add('Security', 'Low', `${miss.length} of 5 security settings are missing`, 'These are server settings that protect visitors from common tricks such as clickjacking.', 'We’d add the standard security headers.', 'quick', 'maintenance');
  }
  if (r.read && r.read.finding) add('Security', 'Critical', r.read.title, r.read.why, 'We’d get the site back online and reachable before anything else.', 'quick', 'maintenance');
  if (s.wp && s.wp.status === 'bad') add('Security', 'High', `WordPress is ${plural(s.wp.behind, 'version')} behind`, `It runs ${s.wp.version} and the latest is ${s.wp.latest}. Old versions miss security fixes and are an easy target for automated attacks.`, UPD, 'maintenance', 'maintenance');
  else if (s.wp && s.wp.status === 'warn') add('Security', 'Medium', 'WordPress has an update waiting', `It runs ${s.wp.version} and the latest is ${s.wp.latest}.`, UPD, 'maintenance', 'maintenance');
  if (s.elementor && (s.elementor.status === 'bad' || s.elementor.status === 'warn')) add('Security', s.elementor.status === 'bad' ? 'Medium' : 'Low', 'Elementor is behind on updates', `It runs ${s.elementor.version} and the latest is ${s.elementor.latest}.`, UPD, 'maintenance', 'maintenance');
  if (s.outdatedPlugins && s.outdatedPlugins.length) add('Security', s.outdatedPlugins.length >= 3 ? 'High' : 'Medium', `${plural(s.outdatedPlugins.length, 'plugin')} need${s.outdatedPlugins.length === 1 ? 's' : ''} updating`, `${s.outdatedPlugins.slice(0, 4).join(', ')}${s.outdatedPlugins.length > 4 ? ' and more' : ''}. Out-of-date plugins are a leading cause of hacked WordPress sites.`, UPD, 'maintenance', 'maintenance');
  if (s.php && s.php.old) add('Security', 'High', `The server runs an old PHP (${s.php.version})`, 'PHP is the engine behind the site. This version no longer gets security fixes, and newer ones are noticeably faster.', 'We’d move the site to a current PHP version, or to better hosting.', 'maintenance', 'maintenance');
  if (s.jquery && +s.jquery.split('.')[0] < 3) add('Security', 'Low', `An old code library is in use (jQuery ${s.jquery})`, 'This version is no longer maintained and has known security holes.', 'We’d update the old code libraries.', 'maintenance', 'maintenance');
  if (s.bootstrap && +s.bootstrap.split('.')[0] <= 3) add('Design', 'Medium', `Built on an old framework (Bootstrap ${s.bootstrap.split('.')[0]})`, 'This version stopped getting updates in 2019. It’s a sign the site hasn’t been rebuilt in years.', FRESH, 'revamp', 'revamp', null, { dated: true, area: 'Under the hood' });
  const V = s.vulns || [];
  if (V.length) add('Security', V.some(v => v.worst === 'critical' || v.worst === 'high') ? 'High' : 'Medium', `At least ${plural(V.reduce((t, v) => t + v.count, 0), 'known security hole')} in what’s installed`, `${V.slice(0, 3).map(v => `${v.name} ${v.version} has at least ${v.count}${v.fixed ? `, fixed in ${v.fixed}` : ''}`).join('; ')}${V.length > 3 ? '; and more' : ''}. These are listed in public security databases, so attackers know about them too.`, UPD, 'maintenance', 'maintenance');
  if (s.ssl && s.ssl.soon) add('Security', 'High', `The security certificate runs out on ${s.ssl.expiresText}`, 'When it lapses, browsers show a full-page warning and most visitors turn back. It normally renews by itself, so this close to the date, something may be stuck.', 'We’d renew it and make sure it renews automatically from now on.', 'quick', 'maintenance');
  if (s.domain && s.domain.soon) add('Security', 'High', `The domain expires on ${s.domain.expiresText}`, 'If it lapses, the website and email both stop working.', 'We’d renew it and switch on auto-renew.', 'quick', 'maintenance');
  return out.sort((a, b) => ORDER[a.sev] - ORDER[b.sev]);
}

// Why each score is what it is, in a few plain sentences. Speed gets the detail: where the weight and the waiting go.
export function whyOf(r) {
  const m = ok(r.psi.mobile), out = [], mb = k => (k >= 1024 ? (k / 1024).toFixed(1) + ' MB' : k + ' KB');
  if (m && r.health.sub.Performance != null) {
    const L = [], w = m.why || {}, b = w.bytes, met = id => m.metrics.find(x => x.id === id) || {}, lcp = met('largest-contentful-paint'), tbt = met('total-blocking-time');
    if (b && b.total) {
      const parts = [['Images are', b.image], ['Code (scripts) is', b.script], ['Styling is', b.css], ['Fonts are', b.font], ['Video is', b.media]].sort((x, y) => y[1] - x[1]), [what, size] = parts[0];
      if (size > 400 && size / b.total >= 0.4) L.push(`${what} the heaviest part of the page: ${mb(size)} out of ${mb(b.total)}. ${b.total >= 2500 ? 'That’s the main thing slowing it down.' : 'That’s the biggest chunk of what has to download.'}`);
      else if (b.total > 2000) L.push(`The page weighs ${mb(b.total)}, spread across images (${mb(b.image)}), code (${mb(b.script)}) and styling (${mb(b.css)}).`);
      if (b.script > 500 && !/^Code/.test(what)) L.push(`There’s ${mb(b.script)} of code in ${b.scripts} script files. A phone has to download and run all of it before the page feels ready.`);
      if (b.thirdHosts >= 5 && b.thirdKb > 300) L.push(`${mb(b.thirdKb)} of that comes from ${b.thirdHosts} other domains, such as trackers, chat widgets, embeds or a separate file server.`);
      if (b.requests > 100) L.push(`The page asks for ${b.requests} separate files, and each one is another trip to the server.`);
    }
    if (w.ttfb > 800) L.push(`The server takes ${(w.ttfb / 1000).toFixed(1)} seconds just to answer, before anything can start loading. That points to the hosting.`);
    if (w.unusedJs > 150) L.push(`About ${mb(w.unusedJs)} of the code that loads is never used on this page.`);
    if (tbt.score != null && tbt.score < 50) L.push(`Scripts keep the phone busy for ${tbt.display}, so taps and scrolling feel laggy.`);
    if (lcp.score != null && lcp.score < 50 && L.length < 4) L.push(`The main content takes ${lcp.display} to show up. People expect about 2.5 seconds.`);
    if (!L.length) for (const x of r.issues.filter(i => i.cat === 'Performance' && i.win).slice(0, 2)) L.push(`${x.title}. ${x.detail}`);
    out.push({ cat: 'Performance', score: r.health.sub.Performance, lines: L.slice(0, 4), fine: 'It loads quickly on phones and computers.' });
  }
  const FINE = { SEO: 'The search basics are in place.', Design: 'Nothing looks dated or broken.', Content: 'No dummy text, dead links or empty pages.', Images: 'Images are described, sized and loaded sensibly.', Accessibility: 'It works well on phones and for screen readers.', Security: 'It’s secure and up to date.' };
  for (const c of CATS) if (c !== 'Performance' && r.health.sub[c] != null) out.push({ cat: c, score: r.health.sub[c], lines: r.issues.filter(i => i.cat === c).slice(0, 3).map(i => `${i.title}. ${i.detail}`), fine: FINE[c] });
  return out;
}

// Health Score out of 100 with a sub-score per category. Unmeasured categories are left out, not guessed.
export function healthOf(r) {
  const pen = c => Math.max(0, 100 - r.issues.filter(i => i.cat === c).reduce((t, i) => t + costOf(i), 0));
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

// Ideas worth pitching: things the site doesn't have yet. They are suggestions, not faults, so they never touch the score.
export function ideasOf(r) {
  const P = r.pages, out = [], any = k => P.some(p => p.design && p.design[k]), t = r.stack.tags || {};
  if (!P.length) return out;
  const add = (title, text) => out.push({ title, text });
  if (!any('video')) add('Add a short video', 'A 20 to 30 second clip of the place, the team or the work builds trust faster than any paragraph can.');
  if (!any('work')) add('Show the work', 'A gallery, a portfolio or a few case studies let people see the results for themselves.');
  if (!any('faq')) add('Answer the usual questions', 'A questions and answers section saves people a phone call, and Google often shows those answers in search.');
  if (!any('map')) add('Show where the business is', 'A map and the address near the bottom of the page reassure people it’s a real place, and help with local searches.');
  if (!any('about')) add('Tell the story', 'An “about us” page with real faces makes a business much easier to trust.');
  if (!any('blogLink')) add('Start a news or tips section', 'Fresh articles give people a reason to come back, and give Google more pages to show.');
  if (!t.meta && !t.tiktok) add('Get ready for ads', 'There’s no Meta or TikTok pixel yet. Adding one means any future ads can be measured and shown again to people who visited.');
  return out.slice(0, 6);
}

// Design verdict from the Design findings. Rules catch dated or broken design; they cannot judge taste.
export function designOf(r) {
  const NOTE = 'These checks spot design that looks dated or broken. They can’t judge taste, so get a designer’s eye on it before you pitch.';
  if (!r.pages || !r.pages.length) return { tone: 'info', label: 'Not checked', note: 'The site could not be read, so its design was not checked.' };
  const d = r.issues.filter(i => i.cat === 'Design'), noMobile = r.issues.some(i => i.noMobile);
  const cost = d.reduce((t, i) => t + costOf(i), 0) + (noMobile ? 30 : 0), dated = d.filter(i => i.dated);
  // "Dated" needs real signs of age (old layout code, sliders, leftovers), not just polish issues like contrast.
  if (noMobile || dated.some(i => i.sev === 'High') || dated.length >= 2 || cost >= 70) return { tone: 'bad', label: 'Looks dated, time for a fresh design', note: NOTE };
  if (cost >= 15) return { tone: 'warn', label: 'The design needs some attention', note: NOTE };
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
  if (kind && kind !== 'wordpress' && (tone === 'bad' || tone === 'warn')) g.revamp.push({ text: 'We’d rebuild the site on WordPress with Elementor, so the client owns it and their own team can edit pages without calling a developer.', pkg: P.revamp });
  else if (kind === 'wordpress' && r.stack.builder && r.stack.builder.id !== 'elementor') g.revamp.push({ text: 'We’d rebuild the key pages in Elementor so they’re easier to edit and look after.', pkg: P.revamp });
  if (r.design && r.design.tone === 'bad') g.revamp.push({ text: 'We’d give the site a fresh, modern look that works on phones first, with one clear call to action.', pkg: P.revamp });
  for (const i of r.issues) { if (seen.has(i.fix)) continue; seen.add(i.fix); g[i.group].push({ text: i.fix, pkg: P[i.pkg] }); }
  if (kind === 'wordpress' && !g.maintenance.length) g.maintenance.push({ text: 'We’d keep WordPress, the theme and plugins updated every month, with backups and uptime checks.', pkg: P.maintenance });
  for (const k in g) g[k] = g[k].slice(0, 7);
  return g;
}

export function verdictOf(r) {
  const h = r.health.score, tone = r.stack.verdict.tone;
  const top = r.issues.filter(i => (i.sev === 'Critical' || i.sev === 'High') && !i.win).slice(0, 3).map(i => i.title);
  const list = (top.length ? ` The biggest issues: ${top.join('; ')}.` : '') + (ok(r.psi.mobile) || ok(r.psi.desktop) ? '' : ' Speed was not measured in this scan.');
  if (h == null) return { tone: 'info', label: 'Not enough data', summary: 'The site could not be read and the speed test did not run. Try the scan again later.' };
  if (h < 60 || (tone === 'bad' && h < 75) || r.issues.filter(i => i.sev === 'Critical').length >= 2 || (r.design && r.design.tone === 'bad' && h < 75)) return { tone: 'bad', label: 'Strong case for a revamp', summary: `There’s quite a lot to fix here, so a full revamp makes more sense than patching things one by one.${list}` };
  if (h < 80 || tone === 'bad') return { tone: 'warn', label: 'Room to improve', summary: `The site works, but it’s leaving results on the table.${list}` };
  return { tone: 'good', label: 'In good shape', summary: `This site is in good shape on everything we can measure, so lead with design, content or marketing ideas.${list}` };
}
