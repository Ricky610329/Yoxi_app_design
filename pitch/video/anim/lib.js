/* ==========================================================================
   遊喜樂 — 影片向量動畫的共用程式庫（契約見 CONTRACT.md；場景檔不要改這裡）

   舞台：<svg id="stage" viewBox="0 0 1920 1080">
     #bg（滿版底色）→ #mapLayer（真實新竹街道，所有鏡頭之下）→ #shots（每格一個 <g class="shot">）→ #ui（字幕條、署名）
   每一格畫面都是時間 t 的純函數：ANIM.seek(t) 同步畫出那一格，沒有 rAF、沒有 CSS 動畫、沒有亂數。
   顏色一律從 tokens.css 讀；地圖顏色是 hsmap.js 自己的 PALETTE。
   ========================================================================== */
(function () {
'use strict';

const SVGNS = 'http://www.w3.org/2000/svg';
const W = 1920, H = 1080;
const FONT = '"Noto Sans TC", "Microsoft JhengHei", "PingFang TC", sans-serif';

/* ---------------------------------------------------------------- 顏色：讀 tokens.css，不手寫 hex */
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = {};
['red', 'red-logo', 'red-dark', 'red-soft', 'navy', 'navy-soft', 'cream', 'cream-deep', 'mist', 'paper',
 'slate', 'slate-lite', 'line', 'white'].forEach(k => {
  C[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = cssVar('--yoxi-' + k);
});
C.gold = cssVar('--gold');
C.goldLite = cssVar('--gold-lite');
Object.keys(C).forEach(k => { if (!C[k]) throw new Error('tokens.css 少了顏色：' + k); });

/* ---------------------------------------------------------------- 數學 */
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const lerp = (a, b, k) => a + (b - a) * k;
const mix = lerp;
const E = {
  linear: x => x,
  out: x => 1 - Math.pow(1 - x, 3),
  in: x => x * x * x,
  inOut: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  outBack: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  outExpo: x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x),
  inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
};
function seg(u, t0, t1, ease) { return (ease || E.out)(clamp01((u - t0) / Math.max(1e-6, t1 - t0))); }
function pulse(u, period) { return 0.5 - 0.5 * Math.cos(2 * Math.PI * u / (period || 1)); }
function rng(seed) {
  let a = (seed || 1) >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------- SVG 小工具 */
function setA(n, attrs) {
  for (const k in (attrs || {})) {
    const v = attrs[k];
    if (v == null) n.removeAttribute(k);
    else if (k === 'text') n.textContent = v;
    else n.setAttribute(k, v);
  }
  return n;
}
function el(tag, attrs, parent) {
  const n = document.createElementNS(SVGNS, tag);
  setA(n, attrs);
  if (parent) parent.appendChild(n);
  return n;
}
function g(parent, attrs) { return el('g', attrs, parent); }
function text(parent, x, y, str, attrs) {
  return el('text', Object.assign({ x, y, text: str, 'font-family': FONT, 'font-size': 40, 'font-weight': 400, fill: C.navy }, attrs), parent);
}
function tr(x, y, s, deg) {
  let t = 'translate(' + r2(x) + ' ' + r2(y) + ')';
  if (s != null && s !== 1) t += ' scale(' + r3(s) + ')';
  if (deg) t += ' rotate(' + r2(deg) + ')';
  return t;
}
function r2(x) { return Math.round(x * 100) / 100; }
function r3(x) { return Math.round(x * 1000) / 1000; }
function icon(parent, name, x, y, size, attrs) {
  const src = (window.ICONS || {})[name];
  if (!src) throw new Error('沒有這個 icon：' + name);
  const doc = new DOMParser().parseFromString(src, 'image/svg+xml');
  const grp = g(parent, Object.assign({ transform: tr(x, y, (size || 24) / 24), 'data-icon': name }, attrs || {}));
  Array.from(doc.documentElement.childNodes).forEach(n => grp.appendChild(document.importNode(n, true)));
  return grp;
}
function pathLen(p) { return p.getTotalLength(); }
function pointAt(p, k) { const pt = p.getPointAtLength(clamp01(k) * p.getTotalLength()); return { x: pt.x, y: pt.y }; }
function drawPath(p, k) {
  const L = p.getTotalLength();
  setA(p, { 'stroke-dasharray': r2(L), 'stroke-dashoffset': r2(L * (1 - clamp01(k))) });
  return L;
}
function textWidth(t) { try { return t.getComputedTextLength(); } catch (e) { return 0; } }

/* ---------------------------------------------------------------- 共用零件 */
const PRIM = {};

/* 地點釘：ICONS.place 的形狀，錨點在針尖 (12, 21.6) */
const PIN_PATH = 'M12 2.4c-3.9 0-7 3.1-7 7 0 5.1 7 12.2 7 12.2s7-7.1 7-12.2c0-3.9-3.1-7-7-7Z';
function pinFill(state) { return state === 'red' ? C.red : state === 'gold' ? C.gold : C.slateLite; }
PRIM.pin = function (parent, o) {
  const s = o.s || 2.4;
  const grp = g(parent, { 'data-pin': o.state || 'grey' });
  const inner = g(grp);
  el('path', { d: PIN_PATH, fill: pinFill(o.state) }, inner);
  el('circle', { cx: 12, cy: 9.4, r: 2.9, fill: C.white }, inner);
  grp._pin = { x: o.x, y: o.y, s, inner, body: inner.firstChild };
  PRIM.pinState(grp, o.state || 'grey', 1);
  return grp;
};
/* pop：1 = 正常大小；抵達爆開時傳 outBack 算出來的 1.0～1.4 */
PRIM.pinState = function (grp, state, pop) {
  const p = grp._pin, k = p.s * (pop == null ? 1 : pop);
  setA(p.body, { fill: pinFill(state) });
  setA(grp, { 'data-pin': state });
  setA(p.inner, { transform: tr(p.x - 12 * k, p.y - 21.6 * k, k) });
  return grp;
};
PRIM.pinMove = function (grp, x, y) { grp._pin.x = x; grp._pin.y = y; return PRIM.pinState(grp, grp.getAttribute('data-pin')); };

/* 圓角卡片 */
PRIM.card = function (parent, o) {
  return el('rect', { x: o.x, y: o.y, width: o.w, height: o.h, rx: o.r == null ? 8 : o.r,
                      fill: o.fill || C.white, stroke: o.stroke || null, 'stroke-width': o.strokeWidth || null }, parent);
};

/* 明信片：向量風景（天空一層、遠山、近丘、建物剪影、太陽），seed 決定山的起伏 */
PRIM.postcard = function (parent, o) {
  const w = o.w || 300, h = o.h || 200, x = o.x || 0, y = o.y || 0;
  const rnd = rng(o.seed || 7);
  const grp = g(parent, { transform: tr(x, y), 'data-postcard': o.seed || 7 });
  const R = Math.round(8 * (w / 300));
  if (o.gold) el('rect', { x: -Math.round(w * .035), y: -Math.round(w * .035), width: w + Math.round(w * .07), height: h + Math.round(w * .07), rx: R + 4, fill: C.gold }, grp);
  el('rect', { x: 0, y: 0, width: w, height: h, rx: R, fill: C.white }, grp);
  const pad = Math.round(w * .04), iw = w - pad * 2, ih = h - pad * 2;
  const clipId = 'pc' + Math.floor(rnd() * 1e9).toString(36) + (o.seed || 7);
  const cp = el('clipPath', { id: clipId }, el('defs', {}, grp));
  el('rect', { x: pad, y: pad, width: iw, height: ih, rx: Math.max(2, R - 2) }, cp);
  const art = g(grp, { 'clip-path': 'url(#' + clipId + ')' });
  el('rect', { x: pad, y: pad, width: iw, height: ih, fill: C.mist }, art);
  const sunX = pad + iw * (0.62 + rnd() * .25), sunY = pad + ih * (0.24 + rnd() * .14);
  el('circle', { cx: r2(sunX), cy: r2(sunY), r: r2(ih * .11), fill: C.red }, art);
  const hill = (base, amp, fill, seedShift) => {
    const pts = [];
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const px = pad + iw * i / n;
      const py = pad + ih * base - ih * amp * (0.5 + 0.5 * Math.sin(i * 1.7 + seedShift) * rnd());
      pts.push([r2(px), r2(py)]);
    }
    let d = 'M' + pad + ' ' + (pad + ih) + ' L' + pts[0].join(' ');
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], mx = (a[0] + b[0]) / 2;
      d += ' C' + r2(mx) + ' ' + a[1] + ' ' + r2(mx) + ' ' + b[1] + ' ' + b[0] + ' ' + b[1];
    }
    d += ' L' + (pad + iw) + ' ' + (pad + ih) + ' Z';
    el('path', { d, fill }, art);
  };
  hill(0.62, 0.22, C.slateLite, 1.3);
  hill(0.78, 0.16, C.creamDeep, 2.9);
  /* 建物剪影：3–4 個矩形 */
  const nb = 3 + Math.floor(rnd() * 2);
  let bx = pad + iw * (0.08 + rnd() * .1);
  for (let i = 0; i < nb; i++) {
    const bw = iw * (0.07 + rnd() * .09), bh = ih * (0.18 + rnd() * .22);
    el('rect', { x: r2(bx), y: r2(pad + ih * .82 - bh), width: r2(bw), height: r2(bh), fill: C.navy }, art);
    bx += bw + iw * (0.02 + rnd() * .04);
  }
  el('rect', { x: pad, y: r2(pad + ih * .82), width: iw, height: r2(ih * .18), fill: C.cream }, art);
  if (o.label !== false) {
    text(grp, w - pad, h - pad * 1.6, 'AI 生成示意', { 'font-size': Math.min(24, Math.max(10, Math.round(w * .055))), fill: C.slate, 'text-anchor': 'end' });
  }
  return grp;
};

/* 向量手機：yoxi 叫車首頁（紅頁首、地圖、底部拉把）。390×844 再乘 s。回傳 { g, setDropoff, screen } */
PRIM.phone = function (parent, o) {
  const s = o.s || 1;
  const grp = g(parent, { transform: tr(o.x || 0, o.y || 0, s), 'data-phone': 1 });
  const PW = 390, PH = 844, B = 14;
  el('rect', { x: -B, y: -B, width: PW + B * 2, height: PH + B * 2, rx: 44, fill: C.navy }, grp);
  const clipId = 'ph' + Math.floor((o.x || 0) * 7 + (o.y || 0) * 13 + s * 1000).toString(36);
  const cp = el('clipPath', { id: clipId }, el('defs', {}, grp));
  el('rect', { x: 0, y: 0, width: PW, height: PH, rx: 32 }, cp);
  const screen = g(grp, { 'clip-path': 'url(#' + clipId + ')' });
  el('rect', { x: 0, y: 0, width: PW, height: PH, fill: C.paper }, screen);
  /* 頁首 */
  el('rect', { x: 0, y: 0, width: PW, height: 96, fill: C.red }, screen);
  text(screen, 24, 66, 'yoxi', { 'font-size': 34, 'font-weight': 900, fill: C.white });
  [0, 1, 2].forEach(i => {
    el('rect', { x: PW - 52, y: 40 + i * 9, width: 28, height: 4, rx: 2, fill: C.white }, screen);
    el('rect', { x: PW - 52, y: 40 + i * 9, width: 8, height: 4, rx: 2, fill: C.white, opacity: .55 }, screen);
  });
  /* 地圖區：霧色底、白色路 */
  el('rect', { x: 0, y: 96, width: PW, height: 470, fill: C.mist }, screen);
  const roads = [[0, 200, 390, 240], [0, 330, 390, 300], [120, 96, 150, 566], [260, 96, 300, 566], [0, 430, 390, 470]];
  roads.forEach(r => el('line', { x1: r[0], y1: r[1], x2: r[2], y2: r[3], stroke: C.white, 'stroke-width': 12, 'stroke-linecap': 'round' }, screen));
  const pk = g(screen, { transform: tr(195 - 12 * 2.2, 330 - 21.6 * 2.2, 2.2) });
  el('path', { d: PIN_PATH, fill: C.red }, pk);
  el('circle', { cx: 12, cy: 9.4, r: 2.9, fill: C.white }, pk);
  /* 底部拉把面板 */
  el('path', { d: 'M0 582 a16 16 0 0 1 16 -16 H374 a16 16 0 0 1 16 16 V844 H0 Z', fill: C.paper }, screen);
  el('rect', { x: 0, y: 560, width: PW, height: 8, fill: C.navy, opacity: .06 }, screen);
  el('rect', { x: 171, y: 578, width: 48, height: 5, rx: 2.5, fill: C.slateLite }, screen);
  const field = (y, label, value, placeholder, hlRect) => {
    el('rect', { x: 22, y, width: PW - 44, height: 64, rx: 8, fill: C.mist }, screen);
    if (hlRect) screen.appendChild(hlRect);          /* 淡紅底在欄位底色之上、文字之下 */
    text(screen, 40, y + 25, label, { 'font-size': 14, fill: C.slate });
    return text(screen, 40, y + 51, value, { 'font-size': 20, 'font-weight': 700, fill: placeholder ? C.slate : C.navy });
  };
  field(608, '上車點', '目前位置');
  const hl = el('rect', { x: 22, y: 686, width: PW - 44, height: 64, rx: 8, fill: C.redSoft, opacity: 0 });
  const drop = field(686, '下車點', '去哪裡？', true, hl);
  el('rect', { x: 22, y: 766, width: PW - 44, height: 56, rx: 4, fill: C.navy }, screen);
  text(screen, PW / 2, 802, '叫車', { 'font-size': 22, 'font-weight': 700, fill: C.white, 'text-anchor': 'middle' });
  return {
    g: grp, screen,
    setDropoff(t, k) {          /* t：文字（空字串＝還沒填）；k：0..1 淡紅底的強度 */
      setA(drop, { text: t || '去哪裡？', fill: t ? C.navy : C.slate });
      setA(hl, { opacity: r3(k == null ? (t ? 1 : 0) : k) });
    },
  };
};

/* 小車（朝右）：錨點在車身底部中央 */
PRIM.car = function (parent, o) {
  const grp = g(parent, { transform: tr(o.x || 0, o.y || 0, o.s || 1), 'data-car': 1 });
  el('path', { d: 'M-60 -14 h20 l14 -22 h44 l22 22 h20 a6 6 0 0 1 6 6 v8 a6 6 0 0 1 -6 6 h-120 a6 6 0 0 1 -6 -6 v-8 a6 6 0 0 1 6 -6 Z', fill: C.navy }, grp);
  el('path', { d: 'M-22 -14 l10 -16 h26 v16 Z', fill: C.mist }, grp);
  el('path', { d: 'M20 -14 v-16 h14 l16 16 Z', fill: C.mist }, grp);
  el('rect', { x: -60, y: -4, width: 24, height: 5, rx: 2.5, fill: C.red }, grp);
  [-36, 36].forEach(cx => {
    el('circle', { cx, cy: 4, r: 11, fill: C.navySoft }, grp);
    el('circle', { cx, cy: 4, r: 4.5, fill: C.white }, grp);
  });
  return grp;
};

/* 步行小點：navy 圓＋白邊，外圈 .ring 可呼吸 */
PRIM.walker = function (parent, o) {
  const grp = g(parent, { transform: tr(o.x || 0, o.y || 0, o.s || 1), 'data-walker': 1 });
  grp.ring = el('circle', { cx: 0, cy: 0, r: 26, fill: 'none', stroke: C.navy, 'stroke-width': 3, opacity: .35 }, grp);
  el('circle', { cx: 0, cy: 0, r: 12, fill: C.navy, stroke: C.white, 'stroke-width': 5 }, grp);
  return grp;
};

/* 字標「遊喜樂」 */
PRIM.wordmark = function (parent, o) {
  const size = o.size || 96, anchor = o.anchor || 'start';
  const t = el('text', { x: o.x, y: o.y, 'font-family': FONT, 'font-size': size, 'font-weight': 900, 'text-anchor': anchor, 'letter-spacing': r2(-size * .02) }, parent);
  el('tspan', { text: '遊喜樂', fill: o.dark ? C.white : C.navy }, t);
  return t;
};

/* 大字：lines 陣列，【】包住的字紅色強調 */
PRIM.statement = function (parent, o) {
  const size = o.size || 72, lh = o.lh || 1.3, anchor = o.anchor || 'start';
  const grp = g(parent, { 'data-statement': 1 });
  (o.lines || []).forEach((line, i) => {
    const t = el('text', { x: o.x, y: o.y + i * size * lh, 'font-family': FONT, 'font-size': size, 'font-weight': o.weight || 900,
                           'text-anchor': anchor, fill: o.fill || C.navy }, grp);
    line.split(/(【[^】]*】)/).filter(Boolean).forEach(part => {
      const em = part.startsWith('【');
      el('tspan', { text: em ? part.slice(1, -1) : part, fill: em ? C.red : null }, t);
    });
  });
  return grp;
};

/* 圓角小標籤（膠囊） */
PRIM.tag = function (parent, o) {
  const size = o.size || 24, padX = o.padX == null ? size * .9 : o.padX, h = size * 1.9;
  const grp = g(parent, { transform: tr(o.x, o.y), 'data-tag': 1 });
  const rect = el('rect', { x: 0, y: -h / 2, height: h, rx: h / 2, fill: o.bg || C.redSoft, width: 10 }, grp);
  const t = text(grp, padX, size * .36, o.text, { 'font-size': size, 'font-weight': 700, fill: o.fg || C.red });
  const w = textWidth(t) + padX * 2;
  setA(rect, { width: r2(w) });
  if (o.anchor === 'middle') setA(grp, { transform: tr(o.x - w / 2, o.y) });
  else if (o.anchor === 'end') setA(grp, { transform: tr(o.x - w, o.y) });
  grp.width = w;
  return grp;
};

/* 點數硬幣 */
PRIM.coin = function (parent, o) {
  const r = o.r || 22;
  const grp = g(parent, { transform: tr(o.x, o.y), 'data-coin': 1 });
  el('circle', { cx: 0, cy: 0, r, fill: C.gold }, grp);
  el('circle', { cx: 0, cy: 0, r: r * .72, fill: 'none', stroke: C.goldLite, 'stroke-width': r * .12 }, grp);
  text(grp, 0, r * .36, 'P', { 'font-size': r, 'font-weight': 900, fill: C.navy, 'text-anchor': 'middle' });
  return grp;
};

/* ---------------------------------------------------------------- 地圖層 */
const MAP_SETS = {
  core:  { style: 'fog',  spanM: 3000,  dataset: 'core', center: 'station' },
  wide:  { style: 'fog',  spanM: 11000, dataset: 'wide', center: 'station' },
  night: { style: 'navy', spanM: 3000,  dataset: 'core', center: 'station' },
};
const maps = {};
let mapLayer, mapXf, mapHost, fogRect, fogMask, fogHoles, mapReq = null, mapCredit = false;

function buildMap(name) {
  if (maps[name]) return maps[name];
  const cfg = MAP_SETS[name];
  if (!cfg) throw new Error('沒有這個地圖 set：' + name);
  const holder = document.getElementById('mapHolder');
  const svg = el('svg', { width: W, height: H }, holder);
  const m = HSMAP.render(svg, { style: cfg.style, center: cfg.center, spanM: cfg.spanM, dataset: cfg.dataset,
                                width: W, height: H, credit: false, fog: false, layers: { label: false, boundary: false } });
  svg.remove();
  const fogColor = HSMAP.PALETTE[cfg.style].fog;
  maps[name] = { name, m, svg, fogColor };
  return maps[name];
}
function initMapLayer() {
  mapLayer = document.getElementById('mapLayer');
  mapXf = g(mapLayer, { id: 'mapXf' });
  mapHost = g(mapXf, { id: 'mapHost' });
  const defs = el('defs', {}, mapLayer);
  const grad = el('radialGradient', { id: 'animFogHole' }, defs);
  el('stop', { offset: '.55', 'stop-color': '#000' }, grad);
  el('stop', { offset: '1', 'stop-color': '#000', 'stop-opacity': '0' }, grad);
  fogMask = el('mask', { id: 'animFogMask' }, defs);
  el('rect', { x: -W, y: -H, width: W * 3, height: H * 3, fill: '#fff' }, fogMask);
  fogHoles = g(fogMask);
  fogRect = el('rect', { x: -W, y: -H, width: W * 3, height: H * 3, fill: C.mist, opacity: .92, mask: 'url(#animFogMask)' }, mapXf);
  setA(mapLayer, { opacity: 0 });
}
const mapAPI = {
  view(o) {
    const set = buildMap(o.set || 'core');
    if (mapHost.firstChild !== set.svg) {
      while (mapHost.firstChild) mapHost.removeChild(mapHost.firstChild);
      mapHost.appendChild(set.svg);
      setA(fogRect, { fill: set.fogColor });
    }
    const z = o.zoom || 1, cx = o.cx == null ? W / 2 : o.cx, cy = o.cy == null ? H / 2 : o.cy;
    mapReq = { set: set.name, cx, cy, z, opacity: o.opacity == null ? 1 : o.opacity };
    setA(mapXf, { transform: 'translate(' + r2(W / 2 - cx * z) + ' ' + r2(H / 2 - cy * z) + ') scale(' + r3(z) + ')' });
    mapCredit = true;
  },
  current() { return mapReq; },
  place(id) {
    const set = buildMap(mapReq ? mapReq.set : 'core');
    const p = set.m.place(id);
    if (!p) throw new Error('地圖上沒有這個地點：' + id);
    return { px: p.px, py: p.py, x: p.x, y: p.y };
  },
  toStage(px, py) {
    const v = mapReq || { cx: W / 2, cy: H / 2, z: 1 };
    return [W / 2 + (px - v.cx) * v.z, H / 2 + (py - v.cy) * v.z];
  },
  fog(holes, opacity) {
    while (fogHoles.firstChild) fogHoles.removeChild(fogHoles.firstChild);
    (holes || []).forEach(h => el('circle', { cx: r2(h.px), cy: r2(h.py), r: r2(h.r), fill: 'url(#animFogHole)', opacity: h.opacity == null ? 1 : r3(h.opacity) }, fogHoles));
    setA(fogRect, { opacity: r3(opacity == null ? .92 : opacity) });
  },
  route(points) {
    return points.map((p, i) => { const s = mapAPI.toStage(p.px, p.py); return (i ? 'L' : 'M') + r2(s[0]) + ' ' + r2(s[1]); }).join(' ');
  },
};

/* ---------------------------------------------------------------- 鏡頭、字幕、署名 */
const scenes = {};
const mounted = {};      // shot.id → { g, bg, ctx }
let shotsLayer, uiLayer, subGroup, subRect, subText, creditText, bgRect;
let creditsReq = {};
let hideSubs = false;

function initStage() {
  bgRect = document.getElementById('bg');
  shotsLayer = document.getElementById('shots');
  uiLayer = document.getElementById('ui');
  subGroup = g(uiLayer, { id: 'subtitle' });
  subRect = el('rect', { x: 0, y: 0, height: 84, rx: 8, fill: C.white, opacity: .94 }, subGroup);
  subText = text(subGroup, W / 2, 0, '', { 'font-size': 40, 'font-weight': 500, 'text-anchor': 'middle' });
  creditText = text(uiLayer, 48, H - 36, '', { 'font-size': 22, fill: C.slate });
}

function themeColor(theme) { return theme === 'dark' ? C.navy : C.mist; }

function mountShot(shot) {
  const sc = scenes[shot.scene];
  if (!sc) throw new Error('沒有註冊的場景：' + shot.scene + '（第 ' + shot.i + ' 格）');
  const grp = el('g', { 'class': 'shot', 'data-shot': shot.id });
  /* z-order 依格號 */
  let ref = null;
  for (const n of shotsLayer.children) { if (+n.getAttribute('data-i') > shot.i) { ref = n; break; } }
  setA(grp, { 'data-i': shot.i });
  shotsLayer.insertBefore(grp, ref);
  const bg = el('rect', { x: 0, y: 0, width: W, height: H, fill: themeColor(shot.theme) }, grp);
  const ctx = {
    g: grp, bg, state: {}, shot, dur: shot.dur, C, E, calc: TIMELINE.calc, map: mapAPI, rng,
    credit(kind) { creditsReq[kind] = true; },
  };
  sc.mount(grp, ctx, shot);
  mounted[shot.id] = { g: grp, ctx, sc };
}
function unmountShot(shot) {
  const m = mounted[shot.id];
  if (!m) return;
  m.g.remove();
  delete mounted[shot.id];
}

function shotAt(t) {
  const S = TIMELINE.shots;
  for (let i = S.length - 1; i >= 0; i--) if (t >= S[i].start) return S[i];
  return S[0];
}

function seek(t) {
  const S = TIMELINE.shots, FADE = TIMELINE.fade == null ? .5 : TIMELINE.fade;
  t = Math.max(0, Math.min(TIMELINE.total, t));
  const vis = S.filter(s => t >= s.start && t < s.end + FADE);
  if (!vis.length) vis.push(S[S.length - 1]);
  S.forEach(s => { if (mounted[s.id] && vis.indexOf(s) < 0) unmountShot(s); });
  creditsReq = {};
  mapReq = null; mapCredit = false;
  let top = vis[vis.length - 1];
  /* 交叉淡接：新的一格 0→1 淡入，舊的一格同時 1→0 淡出；地圖層在所有鏡頭之下，舊格淡出時露出來 */
  vis.forEach((s, k) => {
    if (!mounted[s.id]) mountShot(s);
    const m = mounted[s.id];
    const opIn = s.i === 1 ? 1 : clamp01((t - s.start) / FADE);
    const later = vis[k + 1];
    const opOut = later ? 1 - clamp01((t - later.start) / FADE) : 1;
    setA(m.g, { opacity: r3(opIn * opOut) });
    m.sc.update(t - s.start, m.ctx, s);
  });
  setA(bgRect, { fill: themeColor(top.theme) });
  /* 地圖層：這一格有人宣告視角才看得到（後宣告的贏） */
  setA(mapLayer, { opacity: r3(mapReq ? mapReq.opacity : 0) });
  /* 字幕 */
  const sub = hideSubs ? null : (top.subs || []).find(x => t >= x.t0 && t < x.t1)
    || (vis.length > 1 ? (vis[0].subs || []).find(x => t >= x.t0 && t < x.t1) : null);
  const dark = top.theme === 'dark';
  if (sub) {
    setA(subText, { text: sub.text, fill: dark ? C.white : C.navy });
    const w = textWidth(subText) + 88;
    setA(subRect, { x: r2(W / 2 - w / 2), y: H - 96 - 60, width: r2(w), fill: dark ? C.navySoft : C.white, opacity: dark ? .9 : .94 });
    setA(subText, { y: H - 96 - 60 + 56 });
    setA(subGroup, { opacity: 1 });
  } else setA(subGroup, { opacity: 0 });
  /* 署名 */
  const parts = [];
  if (creditsReq.map || mapCredit) parts.push('地圖 © OpenStreetMap 貢獻者');
  if (creditsReq.ai) parts.push('明信片為 AI 生成示意');
  setA(creditText, { text: parts.join(' · '), fill: dark ? C.slateLite : C.slate, opacity: parts.length ? .9 : 0 });
  ANIM.t = t;
}

/* ---------------------------------------------------------------- 對外 */
const ANIM = window.ANIM = {
  t: 0,
  duration: 0,
  scene(name, def) { scenes[name] = def; },
  seek,
  shotAt,
  setSubtitles(on) { hideSubs = !on; },
  ready: null,
  scenes,
};

ANIM.ready = new Promise((resolve, reject) => {
  const start = () => {
    try {
      initStage();
      initMapLayer();
      ANIM.duration = TIMELINE.total;
      const fonts = ['900 64px "Noto Sans TC"', '700 40px "Noto Sans TC"', '500 40px "Noto Sans TC"', '400 24px "Noto Sans TC"'];
      const loads = (document.fonts && document.fonts.load) ? fonts.map(f => document.fonts.load(f)) : [];
      Promise.all(loads).then(() => {
        ['core', 'wide', 'night'].forEach(buildMap);
        const missing = TIMELINE.shots.map(s => s.scene).filter(n => !scenes[n]);
        if (missing.length) throw new Error('沒有註冊的場景：' + missing.join('、'));
        resolve();
      }).catch(reject);
    } catch (e) { reject(e); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else setTimeout(start, 0);
});

window.A = { W, H, FONT, C, E, clamp01, lerp, mix, seg, pulse, rng, el, setA, g, text, tr, icon,
             pathLen, pointAt, drawPath, textWidth, PRIM, r2, r3 };
})();
