/* ==========================================================================
   遊喜樂 介紹網站 — 捲動框架（window.SITE）

   做四件事，全部靠 IntersectionObserver 與 rAF 節流的 scroll，不用任何 library：
   1. reveal：[data-reveal] 進入視窗加 .is-in（?reveal=all 或 prefers-reduced-motion 時全部立刻顯示）
   2. progress：[data-progress] 捲動時寫入 CSS 變數 --p（0..1）；data-progress="pin" 是 sticky 段的進度
   3. scrolly：[data-scrolly] 裡哪個 .step 最靠近視窗 45% 線就是目前（.is-active；stage 的 data-active；img[data-shot] 的 .is-current）
   4. nav：[data-section] 進入視窗時高亮 a[data-nav]；.progress-bar 寬度＝整頁捲動比例
   另外：把 [data-fmt="fare:28"] 這類節點填成公式算出來的數字（數字不手寫）。
   開發參數：?y=2400 捲到像素、?reveal=all、?nomotion=1。
   ========================================================================== */
(function () {
'use strict';

const SITE = window.SITE = {};
const q = new URLSearchParams(location.search);
const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
SITE.reduced = reduced;
SITE.clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
SITE.lerp = (a, b, k) => a + (b - a) * k;
SITE.el = function (tag, attrs, parent, text) {
  const n = document.createElement(tag);
  for (const k in (attrs || {})) {
    if (k === 'class') n.className = attrs[k];
    else if (k === 'html') n.innerHTML = attrs[k];
    else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  }
  if (text != null) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
};

const handlers = { progress: [], step: [] };
SITE.on = function (name, fn) { (handlers[name] || (handlers[name] = [])).push(fn); };
function emit(name, detail) { (handlers[name] || []).forEach(fn => { try { fn(detail); } catch (e) { console.error(e); } }); }

/* ---- 數字不手寫：data-fmt ------------------------------------------------- */
SITE.fillFmt = function (root) {
  const D = window.SITE_DATA; if (!D) return;
  (root || document).querySelectorAll('[data-fmt]').forEach(n => {
    const [k, v] = (n.getAttribute('data-fmt') || '').split(':');
    const num = parseFloat(v);
    const F = D.fmt;
    let out = null;
    switch (k) {
      case 'fare':    out = F.money(F.fare(num)); break;
      case 'min':     out = F.rideMin(num); break;
      case 'walk':    out = F.walkMin(num); break;
      case 'pts':     out = F.ridePts(num); break;
      case 'km':      out = F.km(num); break;
      case 'bonus':   out = D.RIDE_BONUS; break;
      case 'walkmax': out = D.WALK_MAX_M / 1000; break;
      case 'places':  out = D.places.length; break;
    }
    if (out != null) n.textContent = out;
  });
};

/* ---- reveal ---------------------------------------------------------------- */
function initReveal() {
  const els = Array.from(document.querySelectorAll('[data-reveal]'));
  if (reduced || q.get('reveal') === 'all' || !('IntersectionObserver' in window)) {
    els.forEach(e => e.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const d = +en.target.getAttribute('data-reveal-delay') || 0;
      if (d) en.target.style.transitionDelay = d + 'ms';
      en.target.classList.add('is-in');
      io.unobserve(en.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  els.forEach(e => io.observe(e));
}

/* ---- progress -------------------------------------------------------------- */
let progEls = [];
SITE.progressOf = function (el) {
  const r = el.getBoundingClientRect(), vh = window.innerHeight;
  if (el.getAttribute('data-progress') === 'pin') {
    const total = r.height - vh;
    return total <= 0 ? 1 : SITE.clamp01(-r.top / total);
  }
  return SITE.clamp01((vh - r.top) / (vh + r.height));
};
function tickProgress() {
  progEls.forEach(el => {
    const p = SITE.progressOf(el);
    if (Math.abs((el._p == null ? -1 : el._p) - p) < 0.0015) return;
    el._p = p;
    el.style.setProperty('--p', p.toFixed(4));
    emit('progress', { el, p });
  });
}

/* ---- scrolly --------------------------------------------------------------- */
let scrollies = [];
function initScrolly() {
  scrollies = Array.from(document.querySelectorAll('[data-scrolly]')).map(c => ({
    c, steps: Array.from(c.querySelectorAll('.step[data-step]')), stage: c.querySelector('[data-scrolly-stage]'), active: null,
  }));
}
function tickScrolly() {
  scrollies.forEach(s => {
    if (!s.steps.length) return;
    /* 判定線：桌機在視窗 45%；手機（stage 疊在步驟上方、佔滿寬度）改在 stage 底下那段的 40%，
       不然被判成目前的那一步正好藏在手機框後面 */
    let line = window.innerHeight * 0.45;
    if (s.stage) {
      const sr = s.stage.getBoundingClientRect(), cr = s.c.getBoundingClientRect();
      if (sr.width >= cr.width - 2 && sr.bottom > 0 && sr.bottom < window.innerHeight) {
        line = sr.bottom + (window.innerHeight - sr.bottom) * 0.4;
      }
    }
    let best = null, bestD = Infinity;
    s.steps.forEach(st => {
      const r = st.getBoundingClientRect();
      const d = Math.abs((r.top + r.height / 2) - line);
      if (d < bestD) { bestD = d; best = st; }
    });
    /* 整段還在視窗下方或已經捲過去：保持第一步／最後一步 */
    const cr = s.c.getBoundingClientRect();
    if (cr.top > window.innerHeight) best = s.steps[0];
    if (cr.bottom < 0) best = s.steps[s.steps.length - 1];
    if (best === s.active) return;
    s.active = best;
    const value = best.getAttribute('data-step');
    s.steps.forEach(st => st.classList.toggle('is-active', st === best));
    if (s.stage) {
      s.stage.setAttribute('data-active', value);
      s.stage.querySelectorAll('[data-shot]').forEach(img => img.classList.toggle('is-current', img.getAttribute('data-shot') === value));
    }
    emit('step', { scrolly: s.c, step: best, value });
  });
}

/* ---- nav 高亮與頂端進度條 ------------------------------------------------- */
function initNav() {
  const sections = Array.from(document.querySelectorAll('[data-section]'));
  const links = Array.from(document.querySelectorAll('a[data-nav]'));
  if (!sections.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const id = en.target.id;
      links.forEach(a => a.classList.toggle('is-active', a.getAttribute('data-nav') === id));
    });
  }, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
  sections.forEach(s => io.observe(s));
}
function tickBar() {
  const bar = document.querySelector('.progress-bar');
  if (!bar) return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  bar.style.width = (max > 0 ? SITE.clamp01(window.scrollY / max) * 100 : 0).toFixed(2) + '%';
  document.body.classList.toggle('is-scrolled', window.scrollY > 24);
}

/* ---- 主迴圈 --------------------------------------------------------------- */
let raf = 0;
function tick() {
  raf = 0;
  tickProgress();
  tickScrolly();
  tickBar();
}
function request() { if (!raf) raf = requestAnimationFrame(tick); }
SITE.refresh = function () {
  progEls = Array.from(document.querySelectorAll('[data-progress]'));
  progEls.forEach(el => { el._p = null; });
  initScrolly();
  request();
};

document.addEventListener('DOMContentLoaded', function () {
  if (q.get('nomotion')) document.documentElement.style.scrollBehavior = 'auto';
  SITE.fillFmt();
  initReveal();
  initNav();
  SITE.refresh();
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', () => { progEls.forEach(el => { el._p = null; }); request(); });
  if (q.get('y')) {
    const y = parseFloat(q.get('y')) || 0;
    document.documentElement.style.scrollBehavior = 'auto';
    requestAnimationFrame(() => { window.scrollTo(0, y); request(); });
  }
  document.documentElement.setAttribute('data-ready', '1');
});
})();
