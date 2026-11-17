// iPhone-style motion for SenseCheck: springs, sheets, sliding pills, things that fly to where they land.
// The app works without any of this. Every function here only adds movement to something that already works,
// and steps aside when the device asks for less motion or the browser lacks a feature. The spring curves and
// their timings live in app.css (--spring, --spring-snappy, --spring-bouncy, --spring-pop), so the styles and
// this file always move alike.
const root = document.documentElement;
export const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
const phone = window.matchMedia('(max-width: 820px)');
const token = name => getComputedStyle(root).getPropertyValue(name).trim();

// A spring from the style tokens, in the shape the Web Animations API wants: spring('bouncy') -> { easing, duration }
export function spring(kind) {
  const n = kind ? `--spring-${kind}` : '--spring';
  return { easing: token(n) || 'ease-out', duration: (parseFloat(token(n + '-t')) || 0.5) * 1000 };
}
// element.animate() that never throws: an easing the browser does not know falls back to a plain ease-out
function play(el, frames, opt) {
  try { return el.animate(frames, opt); } catch { try { return el.animate(frames, { ...opt, easing: 'ease-out' }); } catch { return null; } }
}

// iPhones only show a pressed state on plain elements once the page listens for touches.
document.addEventListener('touchstart', () => {}, { passive: true });

// ---------- the menu highlight slides to the item you pick
// The menu is rebuilt on every change, so the last position is kept here and the new highlight starts from it.
let pillAt = null;
export function movePill(nav) {
  const pill = nav.querySelector('.nav-pill'), on = nav.querySelector('button.on');
  if (!pill) return;
  if (!on) { pillAt = null; nav.classList.remove('pilled'); return; }
  const to = { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight };
  const put = r => { pill.style.transform = `translate(${r.x}px,${r.y}px)`; pill.style.width = r.w + 'px'; pill.style.height = r.h + 'px'; };
  const moved = pillAt && (pillAt.x !== to.x || pillAt.y !== to.y || pillAt.w !== to.w || pillAt.h !== to.h);
  nav.classList.add('pilled');
  pill.style.transition = 'none';
  put(moved && !calm.matches ? pillAt : to);
  void pill.offsetWidth;                      // the starting place is now on screen; from here the move is animated
  pill.style.transition = '';
  put(to); pillAt = to;
}
window.addEventListener('resize', () => { pillAt = null; const nav = document.getElementById('nav'); if (nav) movePill(nav); });

// ---------- segmented controls (file type, language): a thumb slides to the chosen part
export function moveThumbs(scope = document, still = false) {
  scope.querySelectorAll('.seg').forEach(seg => {
    let on = seg.querySelector('button.on');
    if (!on) { const inp = seg.querySelector('input:checked'); on = inp && inp.closest('label'); }
    if (!on) return;
    if (still || !seg.classList.contains('thumb')) { seg.classList.add('still'); requestAnimationFrame(() => requestAnimationFrame(() => seg.classList.remove('still'))); }
    seg.style.setProperty('--seg-x', on.offsetLeft + 'px'); seg.style.setProperty('--seg-w', on.offsetWidth + 'px');
    seg.classList.add('thumb');
  });
}

// ---------- dialogs behave like sheets
// Opening: the backdrop dims and blurs, the sheet springs in (from the bottom edge on phones, where the page
// behind also steps back a little). The page behind cannot scroll while a sheet is open.
export function sheetIn(modal) {
  root.style.setProperty('--sbw', Math.max(0, window.innerWidth - root.clientWidth) + 'px');   // room the scrollbar took, so nothing shifts
  root.style.setProperty('--push-y', Math.round(window.scrollY + window.innerHeight / 2) + 'px');
  root.classList.add('sheet-open');
  modal.classList.remove('out', 'in');
  modal.style.removeProperty('--dim');
  void modal.offsetWidth;                     // start from the closed look
  modal.classList.add('in');
}
// Closing: the sheet leaves, then done() hides the dialog. Returns straight away.
export function sheetOut(modal, done) {
  const sheet = modal.querySelector('.sheet');
  if (sheet) { sheet.style.transition = ''; sheet.style.transform = ''; }
  modal.style.removeProperty('--dim');
  modal.classList.remove('in'); modal.classList.add('out');
  root.classList.remove('sheet-open');
  setTimeout(done, calm.matches ? 0 : 270);
}
// On phones a sheet can be dragged down by its handle or title and let go to close it.
export function sheetDrag(modal, close) {
  let sheet = null, y0 = 0, dy = 0, t0 = 0, live = false;
  modal.addEventListener('pointerdown', e => {
    sheet = modal.querySelector('.sheet');
    if (!sheet || !phone.matches || !modal.classList.contains('in') || !e.target.closest('.grab, .sheet > h3')) return;
    live = true; y0 = e.clientY; dy = 0; t0 = e.timeStamp; sheet.style.transition = 'none';
    try { sheet.setPointerCapture(e.pointerId); } catch { /* not every browser lets a non-button capture */ }
  });
  modal.addEventListener('pointermove', e => {
    if (!live) return;
    dy = e.clientY - y0;
    sheet.style.transform = `translateY(${dy > 0 ? dy : dy / 5}px)`;                     // pulling up only gives a little, like a rubber band
    modal.style.setProperty('--dim', String(Math.max(0, 1 - Math.max(0, dy) / Math.max(1, sheet.offsetHeight))));
  });
  const end = e => {
    if (!live) return;
    live = false; sheet.style.transition = '';
    const speed = dy / Math.max(1, e.timeStamp - t0);                                   // px per ms
    if (dy > Math.min(150, sheet.offsetHeight * 0.3) || (speed > 0.55 && dy > 24)) close();
    else { sheet.style.transform = ''; modal.style.removeProperty('--dim'); }
  };
  modal.addEventListener('pointerup', end);
  modal.addEventListener('pointercancel', end);
  // a touch on the dimmed area must not scroll the page behind
  modal.addEventListener('touchmove', e => { if (e.target === modal) e.preventDefault(); }, { passive: false });
}

// ---------- a piece of text flies from where it was tapped to where it lands
// from: the rectangle it had on screen before the page changed (getBoundingClientRect). el: where it is now.
export function fly(el, from) {
  if (!el || !from || calm.matches) return;
  const to = el.getBoundingClientRect();
  if (!to.width || !from.width) return;
  const k = Math.max(0.55, Math.min(1.8, from.height / to.height));
  el.classList.add('flying');
  const a = play(el, [{ transform: `translate(${from.left - to.left}px,${from.top - to.top}px) scale(${k})` }, { transform: 'none' }], spring());
  const done = () => el.classList.remove('flying');
  if (a) a.finished.then(done, done); else done();
}

// ---------- a box changes size smoothly when its content is swapped (start screen to scanning screen)
// before: the height it had before the swap. The new content fades in while the box grows or shrinks.
export function resize(el, before) {
  if (!el || !before || calm.matches) return;
  const after = el.offsetHeight;
  if (Math.abs(after - before) < 4) return;
  el.style.overflow = 'hidden';
  const a = play(el, [{ height: before + 'px' }, { height: after + 'px' }], spring());
  const done = () => { el.style.overflow = ''; };
  if (a) a.finished.then(done, done); else done();
}

// ---------- a number counts up to its value
export function countUp(el, wait = 0, ms = 950) {
  if (!el || calm.matches) return;
  const to = parseFloat(el.textContent);
  if (!isFinite(to) || to <= 0) return;
  el.textContent = '0';
  const t0 = performance.now() + wait;
  const step = now => {
    if (!el.isConnected) return;
    const k = Math.min(1, Math.max(0, (now - t0) / ms)), e = 1 - Math.pow(1 - k, 3);
    el.textContent = String(Math.round(to * e));
    if (k < 1) requestAnimationFrame(step); else el.textContent = String(to);
  };
  requestAnimationFrame(step);
  setTimeout(() => { if (el.isConnected) el.textContent = String(to); }, wait + ms + 400);   // a hidden tab gets no frames: make sure the real number lands
}

// ---------- the page title bar: frosted and smaller once the page has scrolled (laptops)
let scrolled = false;
export function watchScroll() {
  const now = window.scrollY > 46;
  if (now !== scrolled) { scrolled = now; root.classList.toggle('scrolled', now); }
}

// ---------- light and dark swap with a cross-fade where the browser can do it
export function crossFade(change) {
  if (calm.matches || !document.startViewTransition || document.visibilityState !== 'visible') return change();
  try { document.startViewTransition(change); } catch { change(); }
}
