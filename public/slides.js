// The report as a slide deck (.pptx), built in the browser with PptxGenJS (vendor/pptxgen.bundle.js, MIT licence).
// This file and the library are only loaded when someone picks "PowerPoint" in the report dialog.
// Everything is drawn with plain shapes and text boxes, so the deck opens the same in PowerPoint, Keynote and
// Google Slides and every piece can be edited. Sizes are in inches on a 13.33 x 7.5 slide.
import { tr } from './bm.js';
import { speedPlan, CATS, CAT_NAME } from './audit.js';
import { techBrand, techSvg } from './techicons.js';

const C = { bg: 'F7F5F0', card: 'FFFFFF', line: 'E8E5DD', soft: 'F3F1EA', ink: '16171B', ink2: '55575E', muted: '93959D', purple: '812FDF', pink: 'F65D8C', yellow: 'FCD61C',
  good: '12A150', warn: 'E08600', bad: 'E5412D', mid: '8E90A0', info: 'B9BBC4', t1: 'EFE8FC', t2: 'FDE9EF', t3: 'DDF3F6', t4: 'FDF3C6', goodSoft: 'DDF5E7', warnSoft: 'FCEFD9', badSoft: 'FCE4E0' };
const F = 'Arial', W = 13.333, L = 0.6, IN = W - 2 * L; // font, slide width, side margin, usable width
const SOFT = { good: C.goodSoft, warn: C.warnSoft, bad: C.badSoft, mid: C.soft, info: C.soft };
const SEV = { Critical: 'bad', High: 'warn', Medium: 'mid', Low: 'info' };
const htone = v => (v == null ? 'info' : v >= 80 ? 'good' : v >= 55 ? 'warn' : 'bad');
const tone = v => (v == null ? 'info' : v >= 90 ? 'good' : v >= 50 ? 'warn' : 'bad');

// the SenseCheck mark, with a set size so every browser can draw it
const MARK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="256" height="256"><rect width="64" height="64" rx="19" fill="#812FDF"/><circle cx="23.5" cy="24" r="5.2" fill="#FCD61C"/><circle cx="40.5" cy="24" r="5.2" fill="#F65D8C"/><path d="M21.5 38.5l8 8L43 32" fill="none" stroke="#fff" stroke-width="6.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const loadLib = () => (window.PptxGenJS ? Promise.resolve() : new Promise((ok, no) => {
  const sc = document.createElement('script'); sc.src = 'vendor/pptxgen.bundle.js';
  sc.onload = () => ok(); sc.onerror = () => no(new Error('The slide tool did not load.')); document.head.appendChild(sc);
}));
// Any picture, redrawn as PNG or JPEG (PowerPoint does not read every format the browser does), with its shape.
async function pic(src, type = 'image/png', maxW = 1500) {
  if (!src) return null;
  try {
    const img = new Image(); img.src = src; await img.decode();
    const k = Math.min(1, maxW / img.naturalWidth), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const x = c.getContext('2d'); if (type !== 'image/png') { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
    x.drawImage(img, 0, 0, c.width, c.height);
    return { data: c.toDataURL(type, 0.86), ratio: c.width / c.height };
  } catch { return null; }
}
// Cut a text so it fits a box of w x h inches at a font size, ending on a whole word.
function fit(t, w, h, pt) {
  t = String(t ?? '').replace(/\s+/g, ' ').trim();
  const lines = Math.max(1, Math.floor((h * 72) / (pt * 1.2) + 0.15)), max = Math.max(12, Math.floor(lines * ((w * 72) / (pt * 0.48)) * 0.92));
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1), sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.]+$/, '') + '…';
}

export async function makeSlides(r, mode, o, k) {
  await loadLib();
  const int = mode === 'internal', bm = !int && o.lang === 'bm', T = x => (bm ? tr(x) : x), M = (en, my) => (bm ? my : en);
  const m = k.good(r.psi.mobile), d = k.good(r.psi.desktop), h = r.health, dz = k.designOf(r);
  const day = new Date(r.date).toLocaleDateString(bm ? 'ms-MY' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const kind = int ? 'Internal website audit' : M('Website health report', 'Laporan kesihatan laman web');
  const P = new window.PptxGenJS();
  P.layout = 'LAYOUT_WIDE'; P.title = `SenseCheck: ${r.domain}`; P.author = o.by || 'MYSense'; P.company = 'MYSense';
  const S = P.ShapeType;

  // pictures used on more than one slide
  const [logo, mark, wave, thumbs, shotD, shotM] = await Promise.all([pic('img/mysense-light.png'), pic('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(MARK), 'image/png', 256), pic('img/mascot/wave.webp', 'image/png', 700), pic('img/mascot/thumbs.webp', 'image/png', 700), pic(k.shots.d, 'image/jpeg'), pic(k.shots.m, 'image/jpeg', 700)]);

  // ---- small drawing helpers
  const text = (s, t, opt) => s.addText(typeof t === 'string' || typeof t === 'number' ? String(t) : t, { fontFace: F, fontSize: 12, color: C.ink, margin: 0, valign: 'top', ...opt });
  const box = (s, x, y, w, hh, fill = C.card, line = C.line, rad = 0.2) => s.addShape(S.roundRect, { x, y, w, h: hh, rectRadius: Math.min(rad, hh / 2, w / 2), fill: { color: fill }, ...(line ? { line: { color: line, width: 0.75 } } : {}) });
  const dot = (s, x, y, colour, size = 0.13) => s.addShape(S.ellipse, { x, y, w: size, h: size, fill: { color: colour } });
  const pill = (s, t, x, y, tn, w) => { const ww = w || Math.max(0.9, String(t).length * 0.095 + 0.4); text(s, t, { x, y, w: ww, h: 0.32, shape: S.roundRect, rectRadius: 0.16, fill: { color: SOFT[tn] || C.soft }, color: tn === 'mid' || tn === 'info' ? C.ink2 : C[tn], fontSize: 10.5, bold: true, align: 'center', valign: 'middle' }); return ww; };
  const image = (s, p, x, y, w, hh, alignX = 0.5) => { // fit a picture inside a box, keeping its shape
    if (!p) return null;
    let iw = w, ih = w / p.ratio; if (ih > hh) { ih = hh; iw = hh * p.ratio; }
    const at = { x: x + (w - iw) * alignX, y: y + (hh - ih) / 2, w: iw, h: ih };
    s.addImage({ data: p.data, ...at }); return at;
  };
  const bullets = (s, list, x, y, w, hh, pt = 12.5, colour = C.ink2) => text(s, list.map(t => ({ text: t, options: { bullet: { indent: 14 }, breakLine: true, paraSpaceAfter: 5 } })), { x, y, w, h: hh, fontSize: pt, color: colour, lineSpacingMultiple: 1.08 });
  let count = 0;
  const slide = (title, sub) => {
    const s = P.addSlide(); count++;
    s.background = { color: C.bg };
    if (title) text(s, title, { x: L, y: 0.5, w: IN - 2.2, h: 0.62, fontSize: 27, bold: true, valign: 'middle' });
    if (sub) text(s, fit(sub, IN, 0.46, 13), { x: L, y: 1.1, w: IN, h: 0.5, fontSize: 13, color: C.ink2 });
    if (mark) s.addImage({ data: mark.data, x: L, y: 6.96, w: 0.26, h: 0.26 });
    text(s, 'SenseCheck', { x: L + 0.36, y: 6.94, w: 2, h: 0.3, fontSize: 10.5, bold: true, valign: 'middle' });
    text(s, `${r.domain}  ·  ${kind}  ·  ${count}`, { x: W - L - 7, y: 6.94, w: 7, h: 0.3, fontSize: 10, color: C.muted, align: 'right', valign: 'middle' });
    return s;
  };
  // grouped bars on a 0 to 100 scale; each group is { label, a, b }
  const bars = (s, x, y, w, hh, groups, nameA, nameB) => {
    const top = y + 0.45, base = y + hh - 0.4, ph = base - top, gw = w / groups.length, bw = Math.min(0.42, gw * 0.3), gap = 0.06;
    dot(s, x, y + 0.07, C.purple); text(s, nameA, { x: x + 0.2, y, w: 3.2, h: 0.28, fontSize: 10.5, color: C.ink2, valign: 'middle' });
    const off = Math.min(3.4, nameA.length * 0.085 + 0.55);
    dot(s, x + off, y + 0.07, C.pink); text(s, nameB, { x: x + off + 0.2, y, w: 3.2, h: 0.28, fontSize: 10.5, color: C.ink2, valign: 'middle' });
    for (const g of [0, 50, 100]) s.addShape(S.line, { x, y: base - (ph * g) / 100, w, h: 0, line: { color: C.line, width: 0.75 } });
    groups.forEach((g, i) => {
      const cx = x + gw * i + gw / 2;
      [[g.a, C.purple, cx - bw - gap / 2], [g.b, C.pink, cx + gap / 2]].forEach(([v, colour, bx]) => {
        if (v == null) return;
        const bh = Math.max(0.05, (ph * v) / 100);
        s.addShape(S.roundRect, { x: bx, y: base - bh, w: bw, h: bh, rectRadius: Math.min(0.06, bh / 2), fill: { color: colour } });
        text(s, v, { x: bx - 0.2, y: base - bh - 0.27, w: bw + 0.4, h: 0.24, fontSize: 10, bold: true, align: 'center', valign: 'middle' });
      });
      text(s, g.label, { x: cx - gw / 2, y: base + 0.08, w: gw, h: 0.3, fontSize: 10.5, color: C.ink2, align: 'center', valign: 'middle' });
    });
  };

  // ---- 1. cover
  {
    const s = P.addSlide(); count++; s.background = { color: C.bg };
    [[C.purple, 0, 6.2], [C.pink, 6.2, 4.6], [C.yellow, 10.8, W - 10.8]].forEach(([colour, x, w]) => s.addShape(S.rect, { x, y: 0, w, h: 0.12, fill: { color: colour } }));
    if (logo) s.addImage({ data: logo.data, x: L, y: 0.62, h: 0.62, w: 0.62 * logo.ratio });
    text(s, kind, { x: L, y: 2.0, w: 6.6, h: 0.4, fontSize: 16, bold: true, color: C.purple, valign: 'middle' });
    text(s, r.domain, { x: L, y: 2.45, w: 6.8, h: 1.5, fontSize: r.domain.length > 22 ? 32 : 42, bold: true, valign: 'top', fit: 'shrink' });
    pill(s, T(r.verdict.label), L, 4.0, r.verdict.tone);
    const meta = [[M('Prepared for', 'Disediakan untuk'), o.client], [M('Prepared by', 'Disediakan oleh'), o.by ? `${o.by}, MYSense` : 'MYSense'], [M('Date', 'Tarikh'), day], [M('Pages checked', 'Halaman disemak'), r.pagesChecked || '']].filter(x => x[1]);
    meta.forEach(([a, b], i) => { text(s, a, { x: L, y: 4.75 + i * 0.36, w: 1.9, h: 0.3, fontSize: 12.5, color: C.muted, valign: 'middle' }); text(s, String(b), { x: L + 1.95, y: 4.75 + i * 0.36, w: 4.6, h: 0.3, fontSize: 12.5, valign: 'middle' }); });
    if (int) text(s, 'For MYSense staff only. Please don’t send this version to the client.', { x: L, y: 6.5, w: 6.6, h: 0.3, fontSize: 11, bold: true, color: C.bad, valign: 'middle' });
    // the dark score card
    const cx = 7.75, cw = W - L - cx;
    box(s, cx, 0.75, cw, 6.0, C.ink, null, 0.3);
    text(s, M('Website health', 'Kesihatan laman web'), { x: cx + 0.45, y: 1.1, w: 3, h: 0.3, fontSize: 12.5, color: 'A9ABB4', valign: 'middle' });
    text(s, h.score ?? '–', { x: cx + 0.45, y: 1.4, w: 2.1, h: 1.2, fontSize: 72, bold: true, color: 'FFFFFF', valign: 'middle' });
    text(s, M('out of 100', 'daripada 100'), { x: cx + 2.45, y: 2.05, w: 2, h: 0.4, fontSize: 14, color: 'A9ABB4', valign: 'middle' });
    CATS.forEach((c, i) => {
      const y = 2.95 + i * 0.5, v = h.sub[c];
      dot(s, cx + 0.45, y + 0.09, v == null ? '6B6D76' : C[htone(v)]);
      const name = T(CAT_NAME[c]);
      text(s, name, { x: cx + 0.7, y, w: 2.45, h: 0.3, fontSize: name.length > 26 ? 11 : 12.5, color: 'FFFFFF', valign: 'middle' });
      s.addShape(S.roundRect, { x: cx + 3.2, y: y + 0.1, w: 1, h: 0.1, rectRadius: 0.05, fill: { color: '2E3037' } });
      if (v != null) s.addShape(S.roundRect, { x: cx + 3.2, y: y + 0.1, w: Math.max(0.1, v / 100), h: 0.1, rectRadius: 0.05, fill: { color: C[htone(v)] } });
      text(s, v == null ? '–' : v, { x: cx + 4.25, y, w: 0.5, h: 0.3, fontSize: 12.5, bold: true, color: 'FFFFFF', align: 'right', valign: 'middle' });
    });
    image(s, wave, 5.75, 4.55, 1.9, 1.75, 1);
  }

  // ---- internal only: can we take it?
  if (int) {
    const s = slide('Can we take it?', 'From the skills check. Internal only.');
    box(s, L, 1.7, 5.4, 4.9, C.t1, null);
    pill(s, r.fit.verdict, L + 0.4, 2.05, r.fit.tone);
    bullets(s, r.fit.reasons.slice(0, 5).map(x => fit(x, 4.5, 0.8, 12.5)), L + 0.4, 2.6, 4.6, 3.8, 12.5, C.ink);
    box(s, L + 5.7, 1.7, IN - 5.7, 4.9);
    text(s, 'What this means for the client', { x: L + 6.1, y: 2.0, w: 5.8, h: 0.3, fontSize: 11.5, color: C.muted, valign: 'middle' });
    text(s, fit(r.stack.verdict.title, 5.8, 0.7, 16), { x: L + 6.1, y: 2.35, w: 5.8, h: 0.7, fontSize: 16, bold: true });
    bullets(s, r.stack.verdict.reasons.slice(0, 4).map(x => fit(x, 5.7, 0.75, 12)), L + 6.1, 3.15, 5.8, 3.3, 12);
  }

  // ---- 2. in short
  {
    const s = slide(M('In short', 'Ringkasnya'), `${r.domain}, ${day}`);
    const hasShot = shotD || shotM, tx = hasShot ? L + 6.3 : L, tw = hasShot ? IN - 6.3 : IN;
    if (hasShot) {
      box(s, L, 1.7, 5.95, 4.9);
      const dAt = shotD ? image(s, shotD, L + 0.3, 2.0, shotM ? 3.9 : 5.35, 4.3) : null;
      if (shotM) image(s, shotM, shotD ? L + 4.4 : L + 0.3, 2.0, shotD ? 1.25 : 5.35, 4.3);
      if (dAt) s.addShape(S.rect, { ...dAt, fill: { color: 'FFFFFF', transparency: 100 }, line: { color: C.line, width: 0.75 } });
    }
    pill(s, T(r.verdict.label), tx, 1.75, r.verdict.tone);
    text(s, fit(T(r.verdict.summary), tw, 2.6, 15), { x: tx, y: 2.3, w: tw, h: 2.7, fontSize: 15, color: C.ink, lineSpacingMultiple: 1.15 });
    if (r.cover && r.cover.length) { box(s, tx, 5.15, tw, 1.45, C.t4, null); text(s, [{ text: M('Which pages we checked. ', 'Halaman yang kami semak. '), options: { bold: true, color: C.ink } }, { text: fit(r.cover.map(T).join(' '), tw - 0.5, 1.0, 11) }], { x: tx + 0.25, y: 5.3, w: tw - 0.5, h: 1.15, fontSize: 11, color: C.ink2 }); }
  }

  // ---- 3. what's behind the scores
  const why = (r.why || []).filter(w => w.lines.length).slice(0, 4);
  if (why.length) {
    const s = slide(M('What’s behind the scores', 'Sebab di sebalik skor'), M('The main reasons each one is where it is', 'Sebab utama setiap skor berada di tahap itu'));
    const cols = why.length > 2 ? 2 : why.length, rows = Math.ceil(why.length / cols), cw = (IN - 0.3 * (cols - 1)) / cols, ch = (4.9 - 0.3 * (rows - 1)) / rows, tints = [C.t1, C.t3, C.t4, C.t2];
    why.forEach((w, i) => {
      const x = L + (i % cols) * (cw + 0.3), y = 1.7 + Math.floor(i / cols) * (ch + 0.3);
      const lines = w.cat === 'Performance' || !bm ? w.lines.map(T) : r.issues.filter(q => q.cat === w.cat).slice(0, 3).map(q => `${T(q.title)}. ${T(q.detail)}`);
      box(s, x, y, cw, ch, tints[i], null);
      text(s, `${T(CAT_NAME[w.cat])}`, { x: x + 0.3, y: y + 0.22, w: cw - 1.5, h: 0.36, fontSize: 15, bold: true, valign: 'middle' });
      text(s, w.score, { x: x + cw - 1.1, y: y + 0.22, w: 0.8, h: 0.36, fontSize: 15, bold: true, color: C[htone(w.score)], align: 'right', valign: 'middle' });
      const n = rows > 1 ? 2 : 4, each = (ch - 0.9) / n;
      bullets(s, lines.slice(0, n).map(x2 => fit(x2, cw - 0.75, each, 11.5)), x + 0.3, y + 0.7, cw - 0.6, ch - 0.85, 11.5, C.ink);
    });
  }

  // ---- 4. next to a competitor
  if (r.vs) {
    const v = k.versus(r), s = slide(`${M('How it compares with', 'Perbandingan dengan')} ${r.vs.domain}`, M('Same check on both. Health scores, out of 100', 'Semakan yang sama untuk kedua-duanya. Skor kesihatan, daripada 100'));
    const short = { Performance: M('Speed', 'Kelajuan'), SEO: 'SEO', Design: M('Design', 'Reka bentuk'), Content: M('Content', 'Kandungan'), Images: M('Images', 'Imej'), Accessibility: M('Mobile', 'Mudah alih'), Security: M('Security', 'Keselamatan') };
    box(s, L, 1.7, 7.6, 4.9);
    bars(s, L + 0.35, 1.95, 6.9, 4.4, [{ label: M('Overall', 'Keseluruhan'), a: r.health.score, b: r.vs.health.score }, ...CATS.map(c => ({ label: short[c], a: r.health.sub[c], b: r.vs.health.sub[c] }))], r.domain, r.vs.domain);
    const line = q => `${T(CAT_NAME[q.cat])}: ${q.x} ${M('against', 'berbanding')} ${q.y}`;
    const speed = v.lcp ? M(`On phones, the main content shows up in ${v.lcp.x} here and ${v.lcp.y} there`, `Di telefon, kandungan utama muncul dalam ${v.lcp.x} di sini dan ${v.lcp.y} di sana`) : '';
    [[r.domain, v.mine, v.lcp && v.lcp.ahead, C.t1], [r.vs.domain, v.theirs, v.lcp && !v.lcp.ahead, C.t2]].forEach(([name, list, sp, tint], i) => {
      const x = L + 7.9, y = 1.7 + i * 2.52, w = IN - 7.9, all = [...list.map(line), ...(sp ? [speed] : [])].slice(0, 4);
      box(s, x, y, w, 2.38, tint, null);
      text(s, fit(`${M('Where', 'Di mana')} ${name} ${M('is ahead', 'mendahului')}`, w - 0.5, 0.4, 13), { x: x + 0.25, y: y + 0.2, w: w - 0.5, h: 0.4, fontSize: 13, bold: true, valign: 'middle' });
      if (all.length) bullets(s, all.map(t => fit(t, w - 0.7, 0.38, 11)), x + 0.25, y + 0.68, w - 0.5, 1.6, 11, C.ink);
      else text(s, M('Nothing clearly ahead.', 'Tiada yang jelas mendahului.'), { x: x + 0.25, y: y + 0.7, w: w - 0.5, h: 0.4, fontSize: 11.5, color: C.ink2 });
    });
  }

  // ---- 5. page speed
  if (m || d) {
    const s = slide(M('Page speed', 'Kelajuan halaman'), M('Google Lighthouse test on phones and computers', 'Ujian Google Lighthouse pada telefon dan komputer'));
    const LH = [['performance', 'Performance'], ['accessibility', 'Accessibility'], ['best-practices', 'Best practices'], ['seo', 'SEO']];
    box(s, L, 1.7, 5.9, 4.9);
    bars(s, L + 0.35, 1.95, 5.2, 4.4, LH.map(([key, n]) => ({ label: T(n), a: m ? m.scores[key] : null, b: d ? d.scores[key] : null })), M('Mobile', 'Telefon'), M('Desktop', 'Komputer'));
    const x = L + 6.2, w = IN - 6.2, list = (m || d).metrics, rh = Math.min(0.56, 3.9 / (list.length + 1));
    box(s, x, 1.7, w, 4.9);
    text(s, M('Measure', 'Ukuran'), { x: x + 0.3, y: 1.9, w: 2.9, h: 0.3, fontSize: 10.5, color: C.muted, valign: 'middle' });
    text(s, M('Mobile', 'Telefon'), { x: x + w - 3.1, y: 1.9, w: 1.4, h: 0.3, fontSize: 10.5, color: C.muted, valign: 'middle' });
    text(s, M('Desktop', 'Komputer'), { x: x + w - 1.6, y: 1.9, w: 1.4, h: 0.3, fontSize: 10.5, color: C.muted, valign: 'middle' });
    const cell = (p, i, cx, y) => { if (!p) return text(s, '–', { x: cx, y, w: 1.3, h: rh, fontSize: 12, valign: 'middle' }); dot(s, cx, y + rh / 2 - 0.06, C[tone(p.metrics[i].score)], 0.12); text(s, p.metrics[i].display || '–', { x: cx + 0.2, y, w: 1.2, h: rh, fontSize: 12, bold: true, valign: 'middle' }); };
    list.forEach((q, i) => {
      const y = 2.28 + i * rh;
      s.addShape(S.line, { x: x + 0.3, y, w: w - 0.6, h: 0, line: { color: C.line, width: 0.75 } });
      text(s, [{ text: T(q.name), options: { bold: true } }, { text: `  ${q.short}`, options: { color: C.muted } }], { x: x + 0.3, y, w: w - 3.5, h: rh, fontSize: 11.5, valign: 'middle', fit: 'shrink' });
      cell(m, i, x + w - 3.1, y); cell(d, i, x + w - 1.6, y);
    });
    const f = m && m.field && m.field.lcp ? m.field : null;
    text(s, f ? M(`Real visitors on Chrome, last 28 days: main content appears in ${(f.lcp.value / 1000).toFixed(1)} s.`, `Pelawat sebenar di Chrome, 28 hari lepas: kandungan utama muncul dalam ${(f.lcp.value / 1000).toFixed(1)} s.`) : M('Google has no real-visitor data for this site yet, which usually means low traffic.', 'Google belum ada data pelawat sebenar untuk laman ini, biasanya kerana trafik rendah.'), { x: x + 0.3, y: 6.0, w: w - 0.6, h: 0.45, fontSize: 10.5, color: C.ink2, valign: 'middle' });
  }

  // ---- 6. how to make it faster
  const plan = speedPlan(r);
  if (plan && plan.steps.length) {
    const s = slide(M('How to make it faster', 'Cara menjadikannya lebih pantas'), T(plan.lead));
    const jobs = plan.steps.slice(0, 4), cols = jobs.length > 2 ? 2 : jobs.length, rows = Math.ceil(jobs.length / cols), cw = (IN - 0.3 * (cols - 1)) / cols, ch = (4.9 - 0.3 * (rows - 1)) / rows, tints = [C.t1, C.t3, C.t4, C.t2];
    jobs.forEach((j, i) => {
      const x = L + (i % cols) * (cw + 0.3), y = 1.7 + Math.floor(i / cols) * (ch + 0.3), chip = [i === 0 ? T('Start here') : '', T(j.effort)].filter(Boolean).join(' · ');
      box(s, x, y, cw, ch, tints[i], null);
      text(s, fit(T(j.title), cw - 0.6, 0.4, 14.5), { x: x + 0.3, y: y + 0.2, w: cw - 0.6, h: 0.4, fontSize: 14.5, bold: true, valign: 'middle' });
      text(s, chip, { x: x + 0.3, y: y + 0.62, w: cw - 0.6, h: 0.26, fontSize: 10.5, bold: true, color: C.purple, valign: 'middle' });
      const th = ch - 1.1, half = th / 2;
      text(s, [{ text: fit(T(j.why), cw - 0.6, half, 11.5), options: { breakLine: true, paraSpaceAfter: 4 } }, { text: fit(T(j.how), cw - 0.6, half - 0.1, 11.5), options: { color: C.ink } }], { x: x + 0.3, y: y + 0.95, w: cw - 0.6, h: th, fontSize: 11.5, color: C.ink2 });
    });
  }

  // ---- 7. design
  {
    const looks = r.issues.filter(q => q.cat === 'Design'), per = 6, pages = Math.max(1, Math.min(2, Math.ceil(looks.length / per)));
    for (let p = 0; p < pages; p++) {
      const s = slide(`${M('Design', 'Reka bentuk')}${p ? ` (${M('continued', 'sambungan')})` : ''}`, M('What looks dated or broken, and what would lift it', 'Apa yang nampak ketinggalan zaman atau rosak, dan cara memperbaikinya'));
      let y0 = 1.7;
      if (!p) {
        box(s, L, 1.7, IN, 0.95);
        const pw = pill(s, T(dz.label), L + 0.3, 2.01, dz.tone);
        if (r.palette && r.palette.length) {
          const pal = r.palette.slice(0, 6), px = W - L - 0.3 - pal.length * 1.12;
          text(s, M('Main colours on the first screen', 'Warna utama pada skrin pertama'), { x: Math.max(L + 0.5 + pw, px - 3.4), y: 2.01, w: 3.3, h: 0.32, fontSize: 10.5, color: C.muted, align: 'right', valign: 'middle' });
          pal.forEach((c, i) => { s.addShape(S.roundRect, { x: px + i * 1.12, y: 2.02, w: 0.3, h: 0.3, rectRadius: 0.07, fill: { color: c.hex.replace('#', '').toUpperCase() }, line: { color: C.line, width: 0.75 } }); text(s, c.hex.toUpperCase(), { x: px + i * 1.12 + 0.36, y: 2.02, w: 0.76, h: 0.3, fontSize: 9.5, color: C.ink2, valign: 'middle' }); });
        }
        y0 = 2.85;
      }
      const list = looks.slice(p * per, p * per + per), cw = (IN - 0.3) / 2, rows = Math.max(1, Math.ceil(list.length / 2)), ch = Math.min(1.6, (6.6 - y0 - 0.2 * (rows - 1)) / rows);
      if (!list.length) text(s, M('The checks found nothing dated or broken.', 'Semakan tidak menemui apa-apa yang ketinggalan zaman atau rosak.'), { x: L, y: y0 + 0.2, w: IN, h: 0.5, fontSize: 14, color: C.ink2 });
      list.forEach((q, i) => {
        const x = L + (i % 2) * (cw + 0.3), y = y0 + Math.floor(i / 2) * (ch + 0.2);
        box(s, x, y, cw, ch);
        dot(s, x + 0.28, y + 0.3, C[SEV[q.sev]] || C.info);
        text(s, fit(T(q.title), cw - 0.85, 0.34, 12.5), { x: x + 0.52, y: y + 0.18, w: cw - 0.8, h: 0.36, fontSize: 12.5, bold: true, valign: 'middle' });
        text(s, fit(T(q.fix), cw - 0.85, ch - 0.72, 11), { x: x + 0.52, y: y + 0.58, w: cw - 0.8, h: ch - 0.7, fontSize: 11, color: C.ink2 });
      });
      if (p === pages - 1 && looks.length > pages * per) text(s, M(`${looks.length - pages * per} more in the full report.`, `${looks.length - pages * per} lagi dalam laporan penuh.`), { x: L, y: 6.62, w: IN, h: 0.26, fontSize: 10, color: C.muted, valign: 'middle' });
    }
  }

  // ---- 8. what is working well
  if (r.strengths.length) {
    const s = slide(M('What is working well', 'Apa yang sudah bagus'), M('Keep these in any revamp', 'Kekalkan semua ini dalam sebarang rombakan'));
    const list = r.strengths.slice(0, 8), rows = Math.ceil(list.length / 2), cw = (IN - 2.6) / 2, rh = Math.min(1.1, 4.7 / rows);
    list.forEach((t, i) => {
      const x = L + (i % 2) * (cw + 0.25), y = 1.75 + Math.floor(i / 2) * rh;
      box(s, x, y, cw, rh - 0.15, i % 2 ? C.t3 : C.t1, null);
      dot(s, x + 0.25, y + (rh - 0.15) / 2 - 0.065, C.good);
      text(s, fit(T(t), cw - 0.8, rh - 0.3, 12), { x: x + 0.5, y, w: cw - 0.75, h: rh - 0.15, fontSize: 12, valign: 'middle' });
    });
    image(s, thumbs, W - L - 2.3, 2.6, 2.3, 2.6);
  }

  // ---- 9. what we found
  {
    const all = r.issues.filter(q => q.cat !== 'Design'), per = 5, pages = Math.min(3, Math.ceil(all.length / per));
    for (let p = 0; p < pages; p++) {
      const s = slide(`${M('What we found', 'Apa yang kami temui')}${p ? ` (${M('continued', 'sambungan')})` : ''}`, M('Most serious first, with what we would do about each', 'Paling serius dahulu, bersama apa yang kami akan buat'));
      const SEVN = { Critical: 'Kritikal', High: 'Tinggi', Medium: 'Sederhana', Low: 'Rendah' }, rh = 0.98;
      all.slice(p * per, p * per + per).forEach((q, i) => {
        const y = 1.7 + i * rh;
        box(s, L, y, IN, rh - 0.14);
        pill(s, M(q.sev, SEVN[q.sev]), L + 0.25, y + 0.26, SEV[q.sev], 1.15);
        text(s, [{ text: fit(T(q.title), 4.6, 0.26, 12), options: { bold: true, color: C.ink, breakLine: true } }, { text: fit(T(q.detail), 4.6, 0.38, 10.5) }], { x: L + 1.6, y: y + 0.08, w: 4.7, h: rh - 0.3, fontSize: 10.5, color: C.ink2, valign: 'middle' });
        text(s, fit(T(q.fix), IN - 6.9, 0.55, 11), { x: L + 6.6, y: y + 0.08, w: IN - 6.85, h: rh - 0.3, fontSize: 11, color: C.ink, valign: 'middle' });
      });
      if (p === pages - 1 && all.length > pages * per) text(s, M(`${all.length - pages * per} more in the full report.`, `${all.length - pages * per} lagi dalam laporan penuh.`), { x: L, y: 6.62, w: IN, h: 0.26, fontSize: 10, color: C.muted, valign: 'middle' });
    }
  }

  // ---- 10. technology
  {
    const s = slide(M('Technology', 'Teknologi'), M('Read from the public pages of the site', 'Dibaca daripada halaman awam laman web'));
    const v = r.stack.verdict, show = r.stack.items.filter(q => !/^Not detected|^PHP version/.test(q.name) && (int || !['Plugins', 'Libraries', 'Domain'].includes(q.group))).slice(0, int ? 12 : 8);
    const icons = await Promise.all(show.map(q => { const b = techBrand(q.name); return b ? pic('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(techSvg(b)), 'image/png', 96) : null; }));
    const lw = 6.3, rows = Math.max(1, show.length), rh = Math.min(0.62, 4.6 / rows);
    box(s, L, 1.7, lw, 4.9);
    if (!show.length) text(s, M('The platform could not be detected from the public pages.', 'Platform tidak dapat dikesan daripada halaman awam.'), { x: L + 0.3, y: 1.95, w: lw - 0.6, h: 0.8, fontSize: 13, color: C.ink2 });
    show.forEach((q, i) => {
      const y = 1.85 + i * rh, mid = y + rh / 2;
      if (i) s.addShape(S.line, { x: L + 0.3, y, w: lw - 0.6, h: 0, line: { color: C.line, width: 0.75 } });
      s.addShape(S.roundRect, { x: L + 0.3, y: mid - 0.19, w: 0.38, h: 0.38, rectRadius: 0.09, fill: { color: icons[i] ? 'FFFFFF' : C.t1 }, line: { color: C.line, width: 0.75 } });
      if (icons[i]) s.addImage({ data: icons[i].data, x: L + 0.38, y: mid - 0.11, w: 0.22, h: 0.22 });
      else text(s, (q.name.replace(/^DNS:\s*/i, '').match(/[A-Za-z0-9]/) || ['?'])[0].toUpperCase(), { x: L + 0.3, y: mid - 0.19, w: 0.38, h: 0.38, fontSize: 11, bold: true, color: C.purple, align: 'center', valign: 'middle' });
      text(s, [{ text: fit(q.name, 3.1, 0.26, 12.5), options: { bold: true } }, ...(int && q.version ? [{ text: `  ${q.version}`, options: { color: C.ink2 } }] : [])], { x: L + 0.82, y, w: 3.4, h: rh, fontSize: 12.5, valign: 'middle', fit: 'shrink' });
      text(s, T(q.group), { x: L + lw - 2.2, y, w: 1.9, h: rh, fontSize: 10.5, color: C.muted, align: 'right', valign: 'middle' });
    });
    const x = L + lw + 0.3, w = IN - lw - 0.3;
    box(s, x, 1.7, w, 4.9, C.t1, null);
    const vt = fit(T(v.title), w - 0.7, 0.9, 16), vh = vt.length > (w - 0.7) * 9 ? 0.9 : 0.5;
    text(s, vt, { x: x + 0.35, y: 1.95, w: w - 0.7, h: vh, fontSize: 16, bold: true });
    bullets(s, v.reasons.slice(0, 4).map(t => fit(T(t), w - 0.9, 0.8, 12)), x + 0.35, 2.05 + vh, w - 0.7, 4.4 - vh, 12, C.ink);
  }

  // ---- 11. next steps
  {
    const s = slide(M('Recommended next steps', 'Langkah seterusnya yang disyorkan'), int ? 'Each one maps to a service package' : '');
    const groups = bm ? [['quick', 'Pembaikan pantas'], ['revamp', 'Kerja rombakan'], ['maintenance', 'Penyelenggaraan berterusan']] : [['quick', 'Quick fixes'], ['revamp', 'Revamp items'], ['maintenance', 'Ongoing maintenance']];
    const cw = (IN - 0.6) / 3, tints = [C.t1, C.t3, C.t4];
    groups.forEach(([key, name], i) => {
      const x = L + i * (cw + 0.3), list = (r.steps[key] || []).slice(0, 4), each = 4.0 / Math.max(3, list.length);
      box(s, x, 1.7, cw, 4.9, tints[i], null);
      text(s, name, { x: x + 0.3, y: 1.92, w: cw - 0.6, h: 0.4, fontSize: 15, bold: true, valign: 'middle' });
      if (!list.length) text(s, T('Nothing needed.'), { x: x + 0.3, y: 2.5, w: cw - 0.6, h: 0.4, fontSize: 12, color: C.ink2 });
      else bullets(s, list.map(q => fit(T(q.text), cw - 0.85, each - (int ? 0.3 : 0.1), 11.5) + (int && q.pkg ? `  [${q.pkg}${k.priceOf(q.pkg) ? `, ${k.priceOf(q.pkg)}` : ''}]` : '')), x + 0.3, 2.5, cw - 0.6, 3.95, 11.5, C.ink);
    });
  }

  // ---- 12. closing
  {
    const s = P.addSlide(); count++; s.background = { color: C.ink };
    [[C.purple, 0, 6.2], [C.pink, 6.2, 4.6], [C.yellow, 10.8, W - 10.8]].forEach(([colour, x, w]) => s.addShape(S.rect, { x, y: 0, w, h: 0.12, fill: { color: colour } }));
    text(s, M('Thank you', 'Terima kasih'), { x: L, y: 2.2, w: 7.5, h: 1.0, fontSize: 48, bold: true, color: 'FFFFFF', valign: 'middle' });
    text(s, int ? 'Internal copy. Use the client report when you share this outside MYSense.' : M('We’re happy to walk you through any part of this report and agree on what to do first.', 'Kami sedia menerangkan mana-mana bahagian laporan ini dan bersetuju tentang langkah pertama.'), { x: L, y: 3.3, w: 7.2, h: 0.9, fontSize: 16, color: 'D9DAE0', lineSpacingMultiple: 1.15 });
    text(s, `${M('Prepared by', 'Disediakan oleh')} ${o.by ? `${o.by}, ` : ''}MYSense  ·  mysense.com.my`, { x: L, y: 4.45, w: 7.5, h: 0.35, fontSize: 13, bold: true, color: 'FFFFFF', valign: 'middle' });
    text(s, M(`${r.pagesChecked ? `${r.pagesChecked} public ${r.pagesChecked === 1 ? 'page was' : 'pages were'} checked on ${day}. ` : ''}Speed scores come from Google PageSpeed Insights (Lighthouse) and vary slightly between runs. Technology is read from public page code, so hidden parts may not appear.`,
      `${r.pagesChecked ? `${r.pagesChecked} halaman awam disemak pada ${day}. ` : ''}Skor kelajuan datang daripada Google PageSpeed Insights (Lighthouse) dan berbeza sedikit antara ujian. Teknologi dibaca daripada kod halaman awam, jadi bahagian tersembunyi mungkin tidak kelihatan.`), { x: L, y: 6.05, w: 8.2, h: 0.8, fontSize: 10, color: '8E9099' });
    box(s, 8.9, 1.5, W - L - 8.9, 4.6, 'FFFFFF', null, 0.3);
    image(s, thumbs, 9.4, 1.85, W - L - 9.9, 3.9);
  }

  return P.write({ outputType: 'blob' });
}
