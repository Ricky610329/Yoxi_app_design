/* ==========================================================================
   yoxi 城事 — HSMAP：新竹真實地理的地圖引擎（概念稿專用）

   只有 screens/concept-*.html 與 boards/*.html 載入它。主線畫面不載。
   資料：assets/map/hs-core.js（3×3 km）、hs-wide.js（11×12 km）、hs-places.js
   來源：OpenStreetMap 貢獻者，ODbL 1.0 —— 每一次 render 都在右下角署名。

   ---- API 契約（凍結；並行做頁面的人照這個寫）--------------------------------
   const m = HSMAP.render(svgOrDiv, {
     style:   'paper' | 'navy' | 'illus' | 'iso' | 'fog'        預設 'paper'
     center:  [lat, lon] | placeId                              預設 'station'
     spanM:   數字，畫面「寬」代表多少公尺                        預設 1800
     width, height: px                                         預設量元素，量不到就 390×440
     rotate:  方位角（度）                                      預設 0；iso 預設 -22
     dataset: 'core' | 'wide' | 'auto'                          auto：spanM > 4000 → wide
     layers:  { park, waterArea, water, coast, boundary, roadService, roadMinor, roadMajor,
                rail, building, label }  各 true/false；預設除 boundary 外全開；wide 沒有建物
     fog:     false | { seen:[placeId], fade:[placeId], radiusM:420 }
     credit:  true                                             false = 自己另外署名
     labels:  額外的 [{t, lat, lon, k}]                          可省
     avoid:   [placeId]  標籤要避開的景點（預設全部 PLACES）
   });
   m.svg                       產生／使用的 <svg>
   m.project(lat, lon) → [px, py]        m.projectM(x, y) → [px, py]（公尺 → px）
   m.unproject(px, py) → [lat, lon]
   m.spotsAt(list, opt) → list′     MOCK.SPOTS 同形複本，x/y 換成相對地圖框的百分比，
                                    多 px/py/offMap；opt.clamp=true 時把框外的夾到邊緣並標 edge
   m.coverage(fogOpt) → 0..100      60×60 取樣格算覆蓋率（不寫死數字）
   m.place(id) → { lat, lon, x, y, px, py }
   m.destroy()

   傾斜（tilt）不是 render 的選項，是頁面的 markup：
     <div class="hsmap-tilt" data-panlayer style="--tilt:52"><div class="hsmap-tilt__plane">
       <svg class="map__svg" id="mapSvg"></svg><div id="spots"></div></div></div>
   .spot 放在平面內就會跟著平面走、再用 CSS 站直（css/concept.css）。
   interact.js 的平移只搬 .map 的「直接子元素」，所以外層一定要帶 data-panlayer。

   ---- 和諧的三個機制 -----------------------------------------------------------
   (a) 一張 PALETTE 表：列＝語意圖層，欄＝preset。表以外的顏色不准出現。
   (b) 一組零件：.spot / .pin / 標籤 / 署名，五個 preset 完全相同，來自既有 CSS。
   (c) 一份幾何：同中心同縮放，六格對照是受控實驗，不是拼貼。
   插畫風的公園綠（#CFE0C2）是唯一的新色相，只准在地圖表面。
   ========================================================================== */
(function () {
'use strict';

const SVGNS = 'http://www.w3.org/2000/svg';
const K = 0.866, J = 0.5, ZK = 0.82;           /* dimetric：cos30、sin30、垂直壓縮 */
const BASE_S = 0.244;                            /* 390 px / 1600 m：線寬的基準比例 */

/* ---- 色票：一列一個語意圖層，一欄一個 preset ---------------------------------- */
const PALETTE = {
  paper: { land: '#F4F2EE', water: '#C9D8EC', waterEdge: '#B6C9E2', park: '#E1E9DA', parkEdge: '#D3DDC9',
           roadCase: '#DEDBD4', roadFill: '#FFFFFF', roadMinor: '#FFFFFF', roadMinorCase: '#E8E5DF', roadService: '#F8F6F2',
           rail: '#B9BDC4', railDash: '#FFFFFF', coast: '#B6C9E2', boundary: '#D8D3CA',
           bldFill: '#E7E3DC', bldEdge: '#D9D4CB', bldTop: '#EFECE6', bldWallA: '#DCD7CE', bldWallB: '#C9C3B9',
           label: '#8A8F98', labelHalo: '#F2F0EC', fog: '#F7F9FB', credit: '#8A8F98' },
  navy:  { land: '#0B1B2E', water: '#14344F', waterEdge: '#1B4A6B', park: '#12283A', parkEdge: '#173248',
           roadCase: '#06121F', roadFill: '#24425F', roadMinor: '#16304A', roadMinorCase: null, roadService: '#14293F',
           rail: '#3A5570', railDash: '#0B1B2E', coast: '#1B4A6B', boundary: '#223C56',
           bldFill: '#16293C', bldEdge: '#223C56', bldTop: '#223A52', bldWallA: '#1B3149', bldWallB: '#152738',
           label: '#7E93AB', labelHalo: '#0B1B2E', fog: '#0B1B2E', credit: '#7E93AB' },
  illus: { land: '#EFE7D6', water: '#AFC9E4', waterEdge: '#8FB3D6', park: '#CFE0C2', parkEdge: '#BBD1AB',
           roadCase: '#D8CCB4', roadFill: '#FFF9EC', roadMinor: '#FFF9EC', roadMinorCase: '#E2D6BE', roadService: null,
           rail: '#B9A98A', railDash: '#FFF9EC', coast: '#8FB3D6', boundary: '#D8CCB4',
           bldFill: '#E3D6BE', bldEdge: '#C9B694', bldTop: '#F0E6D2', bldWallA: '#D6C6A8', bldWallB: '#C2AE8C',
           label: '#7A6A4E', labelHalo: '#EFE7D6', fog: '#EFE7D6', credit: '#7A6A4E' },
  /* 霧化：地是奶油色（＝主線 fogmap 的「去過」色），霧蓋上去是 #F7F9FB；洞裡露出奶油色的地與白路 */
  fog:   { land: '#FBEBDF', water: '#DCE7F3', waterEdge: '#CBDAEB', park: '#F1E6D6', parkEdge: '#E6D9C6',
           roadCase: '#F0E2D4', roadFill: '#FFFFFF', roadMinor: '#FFFDF9', roadMinorCase: null, roadService: null,
           rail: '#C6CBD2', railDash: '#FFFFFF', coast: '#CBDAEB', boundary: '#E3E8EE',
           bldFill: null, bldEdge: null, bldTop: null, bldWallA: null, bldWallB: null,
           label: '#9AA3AE', labelHalo: '#F7F9FB', fog: '#ECF1F6', credit: '#9AA3AE' }
};
PALETTE.iso = PALETTE.paper;

/* 線寬（390 px、spanM 1600 的基準；其他縮放等比、夾在 0.55–1.6 倍） */
const W = { majorCase: 8.5, major: 6.5, minor: 3.6, minorCase: 4.6, service: 1.8,
            rail: 2.4, railDash: 7, river: 11, canal: 7, stream: 4, drain: 2.5, coast: 1.6, boundary: 1.2, edge: 0.6 };

/* ---- 資料 -------------------------------------------------------------------------- */
function data(set) {
  return set === 'wide' ? window.HSINCHU_WIDE : window.HSINCHU_CORE;
}
const PLACES = function () { return window.HSINCHU_PLACES || {}; };
const M_LAT = 110574.0;
const M_LON = 111320.0 * Math.cos(24.8016 * Math.PI / 180);
const ORIGIN = [24.8016, 120.9717];

function toM(lat, lon) { return [(lon - ORIGIN[1]) * M_LON, -(lat - ORIGIN[0]) * M_LAT]; }
function toLL(x, y)   { return [ORIGIN[0] - y / M_LAT, ORIGIN[1] + x / M_LON]; }

/* 每條折線的公尺 bbox 只算一次（掛在陣列上） */
function bbox(arr) {
  if (arr._bb) return arr._bb;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < arr.length; i += 2) {
    const x = arr[i], y = arr[i + 1];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  arr._bb = [x0, y0, x1, y1];
  return arr._bb;
}

function el(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
function r1(v) { return Math.round(v * 10) / 10; }

/* ---- render ------------------------------------------------------------------------ */
function render(target, opt) {
  opt = opt || {};
  const style = PALETTE[opt.style] ? opt.style : 'paper';
  const P = PALETTE[style];
  const iso = style === 'iso';

  /* svg 與尺寸 */
  let svg = target;
  if (!target || target.tagName.toLowerCase() !== 'svg') {
    svg = target.querySelector(':scope > svg.hsmap') || el('svg', { 'class': 'map__svg hsmap' }, target);
  }
  svg.classList.add('hsmap');
  const box = (target.tagName.toLowerCase() === 'svg' ? target.parentElement || target : target).getBoundingClientRect();
  const width  = opt.width  || Math.round(box.width)  || 390;
  const height = opt.height || Math.round(box.height) || 440;
  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.setAttribute('data-style', style);
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  /* 轉換 */
  const spanM = opt.spanM || 1800;
  const s = width / spanM;
  const rotDeg = opt.rotate != null ? opt.rotate : (iso ? -22 : 0);
  const rot = rotDeg * Math.PI / 180;
  const c = Math.cos(rot), n = Math.sin(rot);
  let cx = 0, cy = 0;
  const center = opt.center || 'station';
  if (Array.isArray(center)) { const m = toM(center[0], center[1]); cx = m[0]; cy = m[1]; }
  else if (PLACES()[center]) { cx = PLACES()[center].x; cy = PLACES()[center].y; }
  const yBase = iso ? height * 0.62 : height / 2;

  function rotM(x, y) { const dx = x - cx, dy = y - cy; return [dx * c - dy * n, dx * n + dy * c]; }
  function px(x, y, z) {                       /* 公尺 → 像素（z 只在 iso 有意義） */
    const r = rotM(x, y);
    if (iso) {
      const ix = (r[0] - r[1]) * K, iy = (r[0] + r[1]) * J - (z || 0) * ZK;
      return [width / 2 + ix * s, yBase + iy * s];
    }
    return [width / 2 + r[0] * s, yBase + r[1] * s];
  }
  function unpx(X, Y) {
    const rx = (X - width / 2) / s, ry = (Y - yBase) / s;
    if (iso) {
      const a = rx / K, b = ry / J;                 /* a = x−y, b = x+y */
      const x = (a + b) / 2, y = (b - a) / 2;
      return [cx + x * c + y * n, cy - x * n + y * c];
    }
    return [cx + rx * c + ry * n, cy - rx * n + ry * c];
  }

  /* 可視範圍（公尺 bbox，含邊界） */
  const mg = 64 / s;
  const corners = [unpx(-64, -64), unpx(width + 64, -64), unpx(-64, height + 64), unpx(width + 64, height + 64)];
  const vb = [Math.min.apply(null, corners.map(function (p) { return p[0]; })) - mg,
              Math.min.apply(null, corners.map(function (p) { return p[1]; })) - mg,
              Math.max.apply(null, corners.map(function (p) { return p[0]; })) + mg,
              Math.max.apply(null, corners.map(function (p) { return p[1]; })) + mg];
  if (iso) { vb[0] -= spanM * 0.6; vb[2] += spanM * 0.6; vb[1] -= spanM * 0.6; vb[3] += spanM * 0.6; }
  function vis(arr) {
    const b = bbox(arr);
    return !(b[2] < vb[0] || b[0] > vb[2] || b[3] < vb[1] || b[1] > vb[3]);
  }

  const set = opt.dataset && opt.dataset !== 'auto' ? opt.dataset : (spanM > 4000 ? 'wide' : 'core');
  const D = data(set) || data(set === 'wide' ? 'core' : 'wide');
  const wf = Math.max(0.55, Math.min(1.6, s / BASE_S)) * (iso ? 0.9 : 1);
  const L = Object.assign({ park: true, waterArea: true, water: true, coast: true, boundary: false, roadService: true,
                            roadMinor: true, roadMajor: true, rail: true, building: style !== 'fog', label: true }, opt.layers || {});

  /* 路徑字串 */
  function pathOf(arr, close, z) {
    let d = '';
    for (let i = 0; i < arr.length; i += 2) {
      const p = px(arr[i], arr[i + 1], z);
      d += (i ? 'L' : 'M') + r1(p[0]) + ' ' + r1(p[1]);
    }
    return close ? d + 'Z' : d;
  }
  function lines(list, attrs, close) {
    if (!list || !list.length) return;
    const g = el('g', attrs, svg);
    let d = '';
    list.forEach(function (arr) {
      const a = arr.p || arr;
      if (!vis(a)) return;
      d += pathOf(a, close);
    });
    if (d) el('path', { d: d }, g);
    return g;
  }

  /* 1 地 */
  el('rect', { width: width, height: height, fill: P.land, 'data-layer': 'land' }, svg);

  if (!D) {
    el('text', { x: 12, y: 24, 'font-size': 11, 'font-weight': 800, fill: P.label, 'font-family': 'var(--font-sans)' }, svg)
      .textContent = '沒有載入 assets/map/hs-' + set + '.js';
  } else {
    /* 2 綠地、水域 */
    if (L.park) lines(D.park, { fill: P.park, stroke: P.parkEdge, 'stroke-width': W.edge * wf, 'data-layer': 'park' }, true);
    if (L.waterArea) lines(D.waterArea, { fill: P.water, stroke: P.waterEdge, 'stroke-width': W.edge * wf, 'data-layer': 'waterArea' }, true);
    /* 3 河（依種類粗細） */
    if (L.water && D.water) {
      const g = el('g', { fill: 'none', stroke: P.water, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-layer': 'water' }, svg);
      D.water.forEach(function (w) {
        if (!vis(w.p)) return;
        const wid = (W[w.k] || W.stream) * wf;
        el('path', { d: pathOf(w.p), 'stroke-width': wid + W.edge * 2 * wf, stroke: P.waterEdge }, g);
        el('path', { d: pathOf(w.p), 'stroke-width': wid }, g);
      });
    }
    if (L.coast) lines(D.coast, { fill: 'none', stroke: P.coast, 'stroke-width': W.coast * wf, 'data-layer': 'coast' });
    if (L.boundary) lines(D.boundary, { fill: 'none', stroke: P.boundary, 'stroke-width': W.boundary * wf, 'stroke-dasharray': '6 4', 'data-layer': 'boundary' });
    /* 4 路 */
    if (L.roadService && P.roadService) lines(D.roadService, { fill: 'none', stroke: P.roadService, 'stroke-width': W.service * wf, 'stroke-linecap': 'round', 'data-layer': 'roadService' });
    if (L.roadMinor) {
      if (P.roadMinorCase) lines(D.roadMinor, { fill: 'none', stroke: P.roadMinorCase, 'stroke-width': W.minorCase * wf, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-layer': 'roadMinorCase' });
      lines(D.roadMinor, { fill: 'none', stroke: P.roadMinor, 'stroke-width': W.minor * wf, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-layer': 'roadMinor' });
    }
    if (L.roadMajor) {
      lines(D.roadMajor, { fill: 'none', stroke: P.roadCase, 'stroke-width': W.majorCase * wf, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-layer': 'roadMajorCase' });
      lines(D.roadMajor, { fill: 'none', stroke: P.roadFill, 'stroke-width': W.major * wf, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-layer': 'roadMajor' });
    }
    /* 5 鐵路：實線＋白虛線（沿用 home.html 的語言） */
    if (L.rail && D.rail) {
      if (D.railYard) lines(D.railYard, { fill: 'none', stroke: P.rail, 'stroke-width': 0.9 * wf, opacity: '.7', 'data-layer': 'railYard' });
      lines(D.rail, { fill: 'none', stroke: P.rail, 'stroke-width': W.rail * wf, 'data-layer': 'rail' });
      lines(D.rail, { fill: 'none', stroke: P.railDash, 'stroke-width': W.rail * 0.55 * wf, 'stroke-dasharray': (W.railDash * 0.3 * wf) + ' ' + (W.railDash * wf), 'data-layer': 'railDash' });
    }
    /* 6 建物 */
    if (L.building && D.building && P.bldFill) {
      if (iso) drawIso(D.building);
      else {
        const g = el('g', { fill: P.bldFill, stroke: P.bldEdge, 'stroke-width': 0.5 * wf, 'stroke-linejoin': 'round', 'data-layer': 'building' }, svg);
        let d = '';
        D.building.forEach(function (b) { if (vis(b.r)) d += pathOf(b.r, true); });
        if (d) el('path', { d: d }, g);
      }
    }
  }

  /* 7 霧：真地圖在下、霧在上、去過的地方是洞 */
  function fogLayer(f) {
    const defs = el('defs', {}, svg);
    const grad = el('radialGradient', { id: 'hsFogHole' }, defs);
    el('stop', { offset: '.55', 'stop-color': '#000' }, grad);
    el('stop', { offset: '1', 'stop-color': '#000', 'stop-opacity': '0' }, grad);
    const mask = el('mask', { id: 'hsFogMask' }, defs);
    el('rect', { width: width, height: height, fill: '#fff' }, mask);
    const R = (f.radiusM || spanM * 0.16) * s;          /* 預設跟比例尺連動：1900 m → 300 m、7000 m → 1120 m */
    (f.seen || []).forEach(function (id) {
      const p = placePx(id); if (p) el('circle', { cx: r1(p[0]), cy: r1(p[1]), r: r1(R), fill: 'url(#hsFogHole)' }, mask);
    });
    (f.fade || []).forEach(function (id) {
      const p = placePx(id); if (p) el('circle', { cx: r1(p[0]), cy: r1(p[1]), r: r1(R * 0.8), fill: 'url(#hsFogHole)', opacity: '.45' }, mask);
    });
    el('rect', { width: width, height: height, fill: P.fog, opacity: '.92', mask: 'url(#hsFogMask)', 'data-layer': 'fog' }, svg);
  }
  if (opt.fog) fogLayer(opt.fog);

  /* 8 標籤：貪婪避撞、上限 7、離景點 40 px 內不放 */
  function placePx(id) {
    const p = PLACES()[id];
    if (!p) return null;
    const q = px(p.x, p.y, 0);
    return iso ? [q[0], q[1] - 6] : q;
  }
  if (L.label && D && D.label) {
    const avoid = (opt.avoid || Object.keys(PLACES())).map(placePx).filter(Boolean);
    const extra = (opt.labels || []).map(function (l) { const m = toM(l.lat, l.lon); return { t: l.t, x: m[0], y: m[1], k: l.k || 'poi' }; });
    const pri = { district: 0, station: 1, poi: 2 };
    const cand = D.label.concat(extra).map(function (l) {
      const p = px(l.x, l.y, 0);
      const fs = l.k === 'district' ? 13 : 11;
      const w = l.t.length * fs * 0.95, h = fs * 1.2;
      return { t: l.t, k: l.k, x: p[0], y: p[1], fs: fs, box: [p[0] - w / 2, p[1] - h / 2, p[0] + w / 2, p[1] + h / 2] };
    }).filter(function (l) {
      return l.box[0] > 24 && l.box[2] < width - 24 && l.box[1] > 24 && l.box[3] < height - 24;
    }).sort(function (a, b) { return (pri[a.k] || 9) - (pri[b.k] || 9); });
    const taken = [];
    const hit = function (b, o, pad) { return !(b[2] + pad < o[0] || b[0] - pad > o[2] || b[3] + pad < o[1] || b[1] - pad > o[3]); };
    const g = el('g', { 'font-family': 'var(--font-sans)', 'font-weight': 800, fill: P.label, 'text-anchor': 'middle',
                        'paint-order': 'stroke fill', stroke: P.labelHalo, 'stroke-width': 3, 'stroke-linejoin': 'round', 'data-layer': 'label' }, svg);
    let count = 0;
    cand.forEach(function (l) {
      if (count >= 7) return;
      if (taken.some(function (o) { return hit(l.box, o, 4); })) return;
      /* 景點的框：46 px 寬、錨點在底部，今天的地方 62 px —— 標籤不准壓到它 */
      if (avoid.some(function (p) { return hit(l.box, [p[0] - 32, p[1] - 66, p[0] + 32, p[1] + 6], 2); })) return;
      if (cand.some(function (o) { return o !== l && o.t === l.t && taken.indexOf(o.box) >= 0; })) return;
      taken.push(l.box); count++;
      const t = el('text', { x: r1(l.x), y: r1(l.y + l.fs * 0.36), 'font-size': l.fs, opacity: l.k === 'district' ? '.75' : '.9' }, g);
      t.textContent = l.t;
    });
  }

  /* 9 署名（ODbL 要求；credit:false 的頁面要自己標） */
  if (opt.credit !== false) {
    const t = el('text', { x: width - 6, y: height - 6, 'text-anchor': 'end', 'font-size': 9, 'font-family': 'var(--font-sans)',
                           fill: P.credit, opacity: '.7', 'data-layer': 'credit' }, svg);
    t.textContent = '地圖資料 © OpenStreetMap 貢獻者（ODbL）';
    if (D && D.meta && D.meta.synthetic) {
      const u = el('text', { x: 6, y: height - 6, 'font-size': 9, 'font-family': 'var(--font-sans)', 'font-weight': 800, fill: P.credit, opacity: '.8' }, svg);
      u.textContent = '示意幾何（非 OSM 實資料）';
    }
  }

  /* ---- iso：建物擠壓 --------------------------------------------------------- */
  function drawIso(blds) {
    const lim = spanM * 0.8;
    const cand = [];
    blds.forEach(function (b) {
      if (!vis(b.r)) return;
      const r = rotM(b.r[0], b.r[1]);
      let sx = 0, sy = 0;
      for (let i = 0; i < b.r.length; i += 2) { sx += b.r[i]; sy += b.r[i + 1]; }
      const cxm = sx / (b.r.length / 2), cym = sy / (b.r.length / 2);
      const rc = rotM(cxm, cym);
      const near = Math.hypot(rc[0], rc[1]) < lim;
      cand.push({ b: b, depth: rc[0] + rc[1], near: near, key: r });
    });
    cand.sort(function (a, b) { return a.depth - b.depth; });          /* 遠 → 近 */
    let extruded = 0;
    const g = el('g', { 'stroke-linejoin': 'round', 'data-layer': 'building' }, svg);
    cand.forEach(function (o) {
      const r = o.b.r;
      const base = [], top = [];
      for (let i = 0; i < r.length; i += 2) { base.push(px(r[i], r[i + 1], 0)); top.push(px(r[i], r[i + 1], o.b.h)); }
      if (!o.near || extruded >= 600) {
        el('path', { d: 'M' + base.map(function (p) { return r1(p[0]) + ' ' + r1(p[1]); }).join('L') + 'Z', fill: P.bldFill, stroke: P.bldEdge, 'stroke-width': 0.5 }, g);
        return;
      }
      extruded++;
      let gx = 0, gy = 0;
      top.forEach(function (p) { gx += p[0]; gy += p[1]; });
      gx /= top.length; gy /= top.length;
      for (let i = 0; i < base.length; i++) {
        const a = base[i], b = base[(i + 1) % base.length], ta = top[i], tb = top[(i + 1) % base.length];
        const my = (a[1] + b[1]) / 2;
        if (my <= gy) continue;                                       /* 背面的牆不畫 */
        const fill = (b[0] - a[0]) >= 0 ? P.bldWallA : P.bldWallB;
        el('path', { d: 'M' + r1(a[0]) + ' ' + r1(a[1]) + 'L' + r1(b[0]) + ' ' + r1(b[1]) + 'L' + r1(tb[0]) + ' ' + r1(tb[1]) + 'L' + r1(ta[0]) + ' ' + r1(ta[1]) + 'Z',
                    fill: fill, stroke: P.bldEdge, 'stroke-width': 0.4 }, g);
      }
      el('path', { d: 'M' + top.map(function (p) { return r1(p[0]) + ' ' + r1(p[1]); }).join('L') + 'Z', fill: P.bldTop, stroke: P.bldEdge, 'stroke-width': 0.5 }, g);
    });
  }

  /* ---- handle ----------------------------------------------------------------- */
  const handle = {
    svg: svg, width: width, height: height, style: style, spanM: spanM, dataset: set,
    project: function (lat, lon) { const m = toM(lat, lon); return px(m[0], m[1], 0); },
    projectM: function (x, y) { return px(x, y, 0); },
    unproject: function (X, Y) { const m = unpx(X, Y); return toLL(m[0], m[1]); },
    place: function (id) {
      const p = PLACES()[id]; if (!p) return null;
      const q = placePx(id);
      return { lat: p.lat, lon: p.lon, x: p.x, y: p.y, px: q[0], py: q[1], real: p.real, offMap: !!p.offMap };
    },
    /* MOCK.SPOTS 同形複本，x/y 換成相對地圖框的百分比 */
    spotsAt: function (list, o) {
      o = o || {};
      return (list || (window.MOCK && window.MOCK.SPOTS) || []).map(function (sp) {
        const id = sp.place || sp.id;
        const q = placePx(id);
        if (!q) return Object.assign({}, sp, { offMap: true });
        let X = q[0], Y = q[1];
        const out = X < 20 || X > width - 20 || Y < 60 || Y > height - 10;
        let edge = false;
        if (out && o.clamp) { X = Math.max(28, Math.min(width - 28, X)); Y = Math.max(70, Math.min(height - 16, Y)); edge = true; }
        return Object.assign({}, sp, { x: r1(X / width * 100), y: r1(Y / height * 100), px: X, py: Y, offMap: out && !o.clamp, edge: edge });
      });
    },
    coverage: function (f) {
      f = f || opt.fog; if (!f) return 0;
      const R = (f.radiusM || spanM * 0.16) * s;
      const pts = (f.seen || []).map(placePx).filter(Boolean);
      const fd = (f.fade || []).map(placePx).filter(Boolean);
      let hitN = 0, N = 0;
      for (let i = 0; i < 60; i++) for (let j = 0; j < 60; j++) {
        const X = (i + 0.5) / 60 * width, Y = (j + 0.5) / 60 * height;
        N++;
        if (pts.some(function (p) { return Math.hypot(p[0] - X, p[1] - Y) < R * 0.78; })) hitN++;
        else if (fd.some(function (p) { return Math.hypot(p[0] - X, p[1] - Y) < R * 0.6; })) hitN += 0.5;
      }
      return Math.round(hitN / N * 100);
    },
    destroy: function () { while (svg.firstChild) svg.removeChild(svg.firstChild); }
  };
  svg._hsmap = handle;
  return handle;
}

window.HSMAP = { render: render, PALETTE: PALETTE, STYLES: ['paper', 'navy', 'illus', 'iso', 'fog'], toM: toM, toLL: toLL,
                 places: PLACES, WIDTHS: W };
})();
