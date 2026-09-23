/* ==========================================================================
   yoxi 城事 介紹網站 — 互動元件（互動 agent）

   四個 widget，各自找掛載點，找不到就靜靜略過（頁面不能因為某段沒做而炸）：
   1. #hero-map    hero 背景：真實新竹街道＋一層霧，霧隨捲動在十個地方各開一個洞
   2. #w-explore   可點的真實地圖：pin（button）→ 地方卡 → 走進去（模擬抵達）→ 上色＋明信片＋收集 n/m
   3. #w-fare      距離尺：滑桿拖過 3 km 那條線，主按鈕從「走路前往」換成「設為下車點」
   4. #w-compare   叫車首頁圖層開／關對照：拖曳分隔線（底下是 range，可鍵盤）

   紅線：顏色只走 tokens.css 的 CSS 變數（SVG 的填色也用 class＋CSS，不寫 hex）；
         數字一律 SITE_DATA.fmt／places／far 算；明信片標「AI 生成示意」；地圖署名；照片露出授權。
   效能：HSMAP.render 每個 widget 只在建立與視窗寬度改變時跑；捲動時只改 mask 圓的 r／opacity 與 transform。
   按鈕一律 element.onclick（與 prototype 的稽核慣例一致）。
   ========================================================================== */
(function () {
'use strict';

const SVGNS = 'http://www.w3.org/2000/svg';

/* ---- 小工具 ---------------------------------------------------------------- */
function svgEl(tag, attrs, parent) {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in (attrs || {})) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
const r1 = v => Math.round(v * 10) / 10;
function reducedMotion() { return !!(window.SITE && SITE.reduced); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/* 視窗 resize 節流：停手 200 ms 後才重畫，而且只有寬（或高差很多）真的變了才重畫 */
function onResize(fn) {
  let t = 0, lw = window.innerWidth, lh = window.innerHeight;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(function () {
      if (window.innerWidth === lw && Math.abs(window.innerHeight - lh) < 80) return;
      lw = window.innerWidth; lh = window.innerHeight;
      fn();
    }, 200);
  });
}

/* 距離的顯示：≥ 1000 m 寫「1.4 km」，否則寫「900 m」（公里一律 fmt.km 算） */
function distText(m) {
  const F = SITE_DATA.fmt;
  return m >= 1000 ? F.km(m) + ' km' : Math.round(m) + ' m';
}

/* 用 rAF 把 0→1 播一段（reduced-motion 直接跳到 1） */
function tween(ms, fn) {
  if (reducedMotion()) { fn(1); return; }
  const t0 = performance.now();
  (function step(now) {
    const k = clamp01((now - t0) / ms);
    fn(k);
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}

/* 霧的遮罩：白底＝霧在、黑色放射漸層圓＝洞（抄 pitch/video/anim/lib.js 的 initMapLayer 作法）。
   回傳 { holes: <g>, fog: <rect> }。漸層與 mask 的 id 帶前綴，全頁唯一。 */
function fogMask(svg, prefix, w, h, fogClass) {
  const defs = svgEl('defs', {}, svg);
  const grad = svgEl('radialGradient', { id: prefix + 'Hole' }, defs);
  svgEl('stop', { offset: '.55', 'stop-color': 'black' }, grad);
  svgEl('stop', { offset: '1', 'stop-color': 'black', 'stop-opacity': '0' }, grad);
  const mask = svgEl('mask', { id: prefix + 'Mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: w, height: h }, defs);
  svgEl('rect', { x: 0, y: 0, width: w, height: h, fill: 'white' }, mask);
  const holes = svgEl('g', {}, mask);
  const fog = svgEl('rect', { x: 0, y: 0, width: w, height: h, 'class': fogClass, mask: 'url(#' + prefix + 'Mask)' }, svg);
  return { holes, fog, holeFill: 'url(#' + prefix + 'Hole)' };
}

/* ==========================================================================
   1. hero 背景：霧隨捲動散開
   ========================================================================== */
function initHero() {
  const host = document.getElementById('hero-map');
  const section = document.getElementById('top');
  if (!host || !section || !window.HSMAP || !window.SITE_DATA) return;

  const PAR = 40;               /* parallax 最多往上 40 px：svg 比容器高 40 px，才不會露出底 */
  const HOLE_MAX = 220;         /* 洞的最大半徑（px） */
  const OPEN_SPAN = 0.3;        /* 每個洞從開始到全開佔 k 的長度 */
  const STAGGER = 0.045;        /* 相鄰兩個洞的門檻差：固定順序依序打開 */
  let st = null;                /* { svg, holes:[{c, dot, k0}], fog } */
  let lastK = 0, intro = 0;

  /* 捲動進度 p（scroll.js：0＝剛從下方進來）重新對應成 k：頁面頂端＝0、hero 完全捲走＝1 */
  function kOf(p) {
    const H = section.offsetHeight, vh = window.innerHeight;
    const p0 = clamp01((vh - section.offsetTop) / (vh + H));
    return p0 >= 1 ? 1 : clamp01((p - p0) / (1 - p0));
  }

  function build() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    if (st && st.m) st.m.destroy();
    host.innerHTML = '';
    const svg = svgEl('svg', { 'class': 'hm-svg', 'aria-hidden': 'true', focusable: 'false' }, host);
    const spanM = 2600 * w / 1440;              /* 約 2600 m 對 1440 px */
    /* 桌機：把市區那一團推到文字右邊（地圖中心往西挪 20% 的寬）；市區在車站北邊，中心也往北挪 300 m，
       讓城隍廟、州廳那幾個洞落在畫面上半而不是一捲就出畫。窄螢幕就以車站為中心 */
    const st0 = HSMAP.places().station;
    const center = w >= 900 ? HSMAP.toLL(st0.x - spanM * 0.2, st0.y - 300) : 'station';
    const m = HSMAP.render(svg, { style: 'fog', center: center, spanM: spanM, width: w, height: h + PAR,
                                  credit: false, fog: false, layers: { label: false } });
    svg.setAttribute('preserveAspectRatio', 'xMidYMin slice');
    const f = fogMask(svg, 'heroFog', w, h + PAR, 'hm-fog');
    const dots = svgEl('g', { 'class': 'hm-dots' }, svg);
    svgEl('rect', { x: 0, y: 0, width: w, height: h + PAR, 'class': 'hm-veil' }, svg);   /* 最上面一層淡霧色，文字才讀得清楚 */
    const holes = [];
    SITE_DATA.places.forEach(function (pl, i) {
      const q = m.place(pl.id);
      if (!q) return;
      const c = svgEl('circle', { cx: r1(q.px), cy: r1(q.py), r: 0, fill: f.holeFill }, f.holes);
      const dot = svgEl('circle', { cx: r1(q.px), cy: r1(q.py), r: 4, 'class': 'hm-dot', opacity: 0 }, dots);
      holes.push({ c, dot, k0: i * STAGGER });
    });
    st = { m, svg, holes, fog: f.fog };
    draw(lastK);
  }

  /* 捲動時只改：圓的 r、點的 opacity、霧的 opacity、svg 的 transform */
  function draw(k) {
    if (!st) return;
    const kk = Math.max(k, intro);
    st.holes.forEach(function (o) {
      const e = easeOut((kk - o.k0) / OPEN_SPAN);
      o.c.setAttribute('r', r1(HOLE_MAX * e));
      o.dot.setAttribute('opacity', (e * 0.9).toFixed(3));
    });
    const kf = clamp01(kk / 0.7);
    st.fog.setAttribute('opacity', (0.9 - 0.35 * kf).toFixed(3));
    st.svg.style.transform = 'translate3d(0,' + (-PAR * kf).toFixed(1) + 'px,0)';
  }

  build();
  /* 載入時可能已經捲過（?y=…）：第一次就照當下的 p 畫 */
  lastK = kOf(SITE.progressOf(section));
  draw(lastK);
  SITE.on('progress', function (d) {
    if (d.el !== section) return;
    lastK = kOf(d.p);
    draw(lastK);
  });
  /* 開場提示：第一個洞（今天的地方）自己微微打開一點，告訴人「霧是會散的」 */
  if (!reducedMotion()) {
    setTimeout(function () {
      tween(1400, function (t) { intro = 0.1 * easeOut(t); draw(lastK); });
    }, 500);
  }
  onResize(function () { build(); lastK = kOf(SITE.progressOf(section)); draw(lastK); });
}

/* ==========================================================================
   2. 可點的真實地圖（今天的地方）
   ========================================================================== */
function initExplore() {
  const host = document.getElementById('w-explore');
  if (!host || !window.HSMAP || !window.SITE_DATA || !window.SITE) return;
  const D = SITE_DATA, F = D.fmt, E = SITE.el;
  const PL = HSMAP.places();

  /* 圖上畫哪些：離車站 2.5 km 內的地方畫在真實位置；更遠的（青草湖、南寮、竹中、內灣）一律夾到地圖邊緣、標方向與「圖外」。
     規則只有這一條，所有地點（含 SITE_DATA.far）都照它。取 2.5 km 是為了讓市區五個擠在 600 m 內的地方分得開
     （若把青草湖也框進來，比例尺要縮一倍多，市區的 pin 會疊成一團）。 */
  const FIT_R_M = 2500;
  const all = D.places.concat([Object.assign({ far: true, dist: D.far.km * 1000 }, D.far)]);
  const items = all.filter(p => PL[p.id]).map(p => Object.assign({}, p, {
    inFit: Math.hypot(PL[p.id].x, PL[p.id].y) <= FIT_R_M,
  }));
  const collected = new Set();        /* 走進去過的地點 id（只在這一頁、這一次） */
  let selected = (D.places.find(p => p.today) || D.places[0]).id;
  let map = null;                     /* { m, svg, holes, holeFill, R, pins:{id→btn}, pos:{id→{x,y,tx,ty}} } */

  /* ---- DOM ---- */
  host.innerHTML = '';
  const root = E('div', { 'class': 'wx' }, host);
  const mapBox = E('div', { 'class': 'wx__map' }, root);
  const svg = svgEl('svg', { 'class': 'wx__svg', 'aria-hidden': 'true', focusable: 'false' }, mapBox);
  const pinLayer = E('div', { 'class': 'wx__pins', role: 'group', 'aria-label': '地圖上的地點' }, mapBox);
  const legend = E('p', { 'class': 'wx__legend xs' }, mapBox);
  legend.innerHTML = '<span class="wx-key wx-key--gray"></span>還沒去　<span class="wx-key wx-key--red"></span>去過　<span class="wx-key wx-key--ring"></span>今天的地方';
  E('p', { 'class': 'wx__credit credit' }, mapBox, '地圖 © OpenStreetMap 貢獻者');

  const side = E('div', { 'class': 'wx__side' }, root);
  const bar = E('div', { 'class': 'wx__bar' }, side);
  const count = E('p', { 'class': 'wx__count', 'aria-live': 'polite' }, bar);
  const reset = E('button', { type: 'button', 'class': 'btn btn--ghost btn--sm', 'data-act': 'reset-explore' }, bar, '重設');
  const card = E('article', { 'class': 'card wx__card', 'aria-live': 'polite' }, side);
  const cardsBox = E('div', { 'class': 'wx__cards' }, side);   /* 收進來的明信片 */

  /* ---- 地圖：量容器 → 算中心與比例尺 → HSMAP.render 一次 ---- */
  function build() {
    const w = mapBox.clientWidth, h = mapBox.clientHeight;
    if (!w || !h) return;
    if (map && map.m) map.m.destroy();
    /* 圖內那幾個地點的公尺 bbox；上方多留 pin 的高度 */
    const fit = items.filter(p => p.inFit).map(p => PL[p.id]);
    const x0 = Math.min.apply(null, fit.map(p => p.x)), x1 = Math.max.apply(null, fit.map(p => p.x));
    const y0 = Math.min.apply(null, fit.map(p => p.y)), y1 = Math.max.apply(null, fit.map(p => p.y));
    const padX = 56, padTop = 100, padBot = 64;
    const s = Math.min((w - padX * 2) / Math.max(1, x1 - x0), (h - padTop - padBot) / Math.max(1, y1 - y0));
    const cxM = (x0 + x1) / 2, cyM = (y0 + y1) / 2 - (padTop - padBot) / 2 / s;
    const spanM = w / s;
    const m = HSMAP.render(svg, { style: 'fog', center: HSMAP.toLL(cxM, cyM), spanM: spanM, width: w, height: h,
                                  dataset: 'auto', credit: false, fog: false, layers: { label: true } });
    /* 去過的地方：地（land）之上、路之下鋪一圈奶油色的光暈，路網照樣畫在上面；再在霧上開洞 */
    const land = svg.querySelector('[data-layer="land"]');
    const glowG = svgEl('g', { 'class': 'wx-glow' }, null);
    svg.insertBefore(glowG, land ? land.nextSibling : svg.firstChild);
    const f = fogMask(svg, 'wxFog', w, h, 'wx-fog');
    const gg = svgEl('radialGradient', { id: 'wxGlow' }, svg.querySelector('defs'));
    svgEl('stop', { offset: '0', 'class': 'wx-glow-a' }, gg);
    svgEl('stop', { offset: '.6', 'class': 'wx-glow-a' }, gg);
    svgEl('stop', { offset: '1', 'class': 'wx-glow-b' }, gg);
    const rings = svgEl('g', { 'class': 'wx-rings' }, svg);
    const leads = svgEl('g', { 'class': 'wx-leads' }, svg);
    const R = Math.max(36, 380 * s);          /* 抵達時霧洞的半徑：約 380 m */

    /* pin 的位置：圖內用真實位置，圖外沿著「地圖中心 → 真實位置」的射線夾到邊緣 */
    const pos = {};
    const cx = w / 2, cy = h / 2, inset = 26;
    items.forEach(function (p) {
      const q = m.place(p.id);
      let x = q.px, y = q.py, edge = false, arrow = '';
      const out = x < inset || x > w - inset || y < inset + 30 || y > h - inset;
      if (out) {
        const dx = x - cx, dy = y - cy;
        const k = Math.min((w / 2 - inset) / Math.abs(dx || 1e-6), (h / 2 - inset - 16) / Math.abs(dy || 1e-6));
        x = cx + dx * k; y = cy + dy * k + (dy < 0 ? 30 : 0); edge = true;
        /* 夾在左右邊的只准上下滑、夾在上下邊的只准左右滑（互相推開時不離開邊緣） */
        var axis = Math.abs(Math.abs(x - cx) - (w / 2 - inset)) < 1 ? 'y' : 'x';
        const ang = Math.atan2(-dy, dx) * 180 / Math.PI;      /* 0＝東，逆時針 */
        arrow = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘'][((Math.round(ang / 45) % 8) + 8) % 8];
      }
      pos[p.id] = { x, y, tx: q.px, ty: q.py, edge, arrow, axis: edge ? axis : null };
    });
    /* 市區五個地方擠在幾百公尺內：pin 互相推開（圖外的不動），真實位置留一個小點＋細線 */
    /* 圖外的 pin 下面還有「↘ 圖外」小標，所以跟它的間距要大一點；它只沿著自己那條邊滑 */
    const ids = Object.keys(pos);
    function nudge(o, ddx, ddy) {
      if (o.axis !== 'y') o.x = Math.max(inset, Math.min(w - inset, o.x + ddx));
      if (o.axis !== 'x') o.y = Math.max(inset + 30, Math.min(h - inset - 16, o.y + ddy));
    }
    for (let it = 0; it < 80; it++) {
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        const a = pos[ids[i]], b = pos[ids[j]];
        const MIN = (a.edge && b.edge) ? 70 : (a.edge || b.edge) ? 50 : 30;
        let dx = b.x - a.x, dy = (b.y - a.y) * 1.2, d = Math.hypot(dx, dy);
        if (d >= MIN) continue;
        if (d < 0.01) { dx = Math.cos(i + j); dy = Math.sin(i + j); d = 1; }
        const push = (MIN - d) / 2, nx = dx / d, ny = dy / d;
        /* 圖外對圖內：圖外的少動（0.3），圖內的多讓一點 */
        const wa = a.edge && !b.edge ? 0.3 : (!a.edge && b.edge ? 1.7 : 1);
        const wb = b.edge && !a.edge ? 0.3 : (!b.edge && a.edge ? 1.7 : 1);
        nudge(a, -nx * push * wa, -ny * push * wa);
        nudge(b, nx * push * wb, ny * push * wb);
      }
    }
    ids.forEach(function (id) {
      const o = pos[id];
      if (o.edge || Math.hypot(o.x - o.tx, o.y - o.ty) < 3) return;
      svgEl('line', { x1: r1(o.tx), y1: r1(o.ty), x2: r1(o.x), y2: r1(o.y), 'class': 'wx-lead' }, leads);
      svgEl('circle', { cx: r1(o.tx), cy: r1(o.ty), r: 2.6, 'class': 'wx-lead-dot' }, leads);
    });

    /* 已經收過的（resize 重畫時）直接開好洞 */
    const holes = {};
    collected.forEach(function (id) {
      const o = pos[id]; if (!o || o.edge) return;
      holes[id] = [svgEl('circle', { cx: r1(o.tx), cy: r1(o.ty), r: r1(R), fill: f.holeFill }, f.holes),
                   svgEl('circle', { cx: r1(o.tx), cy: r1(o.ty), r: r1(R), fill: 'url(#wxGlow)' }, glowG)];
    });
    map = { m, holes, holeGroup: f.holes, holeFill: f.holeFill, glowG, rings, R, pos };
    buildPins();
  }

  /* ---- pin：每一顆都是 <button>，可 Tab、有 aria-label ---- */
  const PIN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path class="wx-pin__body" d="M12 2.4c-3.9 0-7 3.1-7 7 0 5.1 7 12.2 7 12.2s7-7.1 7-12.2c0-3.9-3.1-7-7-7Z"/>' +
    '<circle class="wx-pin__eye" cx="12" cy="9.4" r="2.9"/></svg>';
  let pins = {};
  function buildPins() {
    pinLayer.innerHTML = '';
    pins = {};
    items.forEach(function (p) {
      const o = map.pos[p.id];
      const b = E('button', { type: 'button', 'class': 'wx-pin', 'data-place': p.id, 'data-act': 'open-place' }, pinLayer);
      b.style.left = r1(o.x) + 'px';
      b.style.top = r1(o.y) + 'px';
      if (o.x > map.m.width - 80) b.classList.add('is-r');       /* 名稱小標靠右邊時往左長，不出圖；圖外小標放在 pin 的內側 */
      else if (o.x < 80) b.classList.add('is-l');
      if (o.edge && o.axis === 'y') b.classList.add('is-side');
      if (p.today) { b.classList.add('is-today'); E('span', { 'class': 'wx-pin__ring', 'aria-hidden': 'true' }, b); }
      if (p.far) b.classList.add('is-far');
      b.insertAdjacentHTML('beforeend', PIN_SVG);
      E('span', { 'class': 'wx-pin__name', 'aria-hidden': 'true' }, b, p.name);
      if (o.edge) { b.classList.add('is-edge'); const t = E('span', { 'class': 'wx-pin__edge', 'aria-hidden': 'true' }, b, o.arrow + ' ');
                   E('span', { 'class': 'wx-pin__edge-n' }, t, p.name + ' · '); t.appendChild(document.createTextNode('圖外')); }
      b.onclick = function () { select(p.id); };
      pins[p.id] = b;
    });
    paintPins();
  }
  function paintPins() {
    items.forEach(function (p) {
      const b = pins[p.id]; if (!b) return;
      const seen = collected.has(p.id), o = map.pos[p.id];
      b.classList.toggle('is-seen', seen);
      b.classList.toggle('is-selected', p.id === selected);
      b.setAttribute('aria-pressed', p.id === selected ? 'true' : 'false');
      b.setAttribute('aria-label', p.name + '，' + (p.far ? F.km(p.dist) + ' 公里' : distText(p.dist)) +
        (o.edge ? '，在地圖外' : '') + (p.today ? '，今天的地方' : '') + (seen ? '，去過' : '，還沒去'));
    });
  }

  /* ---- 收集數：分母是 places.length（不手寫 10）；內灣另計「搭 yoxi 抵達版」 ---- */
  function paintCount() {
    const n = D.places.filter(p => collected.has(p.id)).length;
    count.innerHTML = '收集 <b>' + n + '/' + D.places.length + '</b>' +
      (collected.has(D.far.id) ? '　<span class="pill pill--gold">＋搭 yoxi 抵達版 1</span>' : '');
    reset.disabled = collected.size === 0;
  }

  /* ---- 地方卡 ---- */
  function placeOf(id) { return items.find(p => p.id === id); }
  function select(id) { selected = id; paintPins(); paintCard(); }

  function paintCard(status) {
    const p = placeOf(selected); if (!p) return;
    const m = p.dist, km = F.km(m);
    const walk = F.walkable(m), seen = collected.has(p.id);
    const photo = p.photo && window.PHOTOS_DATA && PHOTOS_DATA[p.photo] && PHOTOS_DATA[p.photo][0];
    let h = '';
    if (photo) {
      h += '<figure class="wx-photo"><img src="' + esc(D.links.photos(photo.file)) + '" alt="' + esc(photo.name) + '（實景照片）" loading="lazy">' +
           '<figcaption class="credit">實景照片 ' + esc(photo.credit) + '</figcaption></figure>';
    }
    h += '<p class="wx-card__eyebrow">' + (p.today ? '<span class="pill">今天的地方</span>' : '') +
         '<span class="pill pill--navy">' + esc(p.type) + '</span>' +
         (p.far ? '<span class="xs muted">走不到的遠方</span>' : '') + '</p>';
    h += '<h3 class="h3">' + esc(p.name) + '</h3>';
    h += '<p class="wx-card__hook">' + esc(p.hook) + '</p>';
    if (p.real === false) h += '<p class="xs muted">原型虛構的地方，錨在真實地點附近' + (photo ? '；照片是鄰近的真實地點' : '') + '。</p>';
    /* 數字：距離／走路分鐘 或 車資＋車程＋搭車回饋 —— 全部 fmt 算 */
    h += '<dl class="wx-stats"><div><dt>距離</dt><dd>' + distText(m) + '</dd></div>';
    if (walk) {
      h += '<div><dt>走路</dt><dd>' + F.walkMin(m) + ' 分</dd></div>';
    } else {
      h += '<div><dt>車資約</dt><dd>' + F.money(F.fare(km)) + '</dd></div>' +
           '<div><dt>車程</dt><dd>' + F.rideMin(km) + ' 分</dd></div>' +
           '<div><dt>搭車回饋</dt><dd>' + F.ridePts(km) + ' 點</dd></div>';
    }
    h += '</dl>';
    if (!walk) h += '<p class="xs muted">超過 ' + (D.WALK_MAX_M / 1000) + ' 公里，走不到的地方搭車抵達另 +' + D.RIDE_BONUS + ' 點（原型），明信片鑲金框。</p>';
    h += '<div class="wx-actions">' +
         (walk ? '<button type="button" class="btn" data-act="walk-to">走路前往</button><button type="button" class="btn btn--ghost" data-act="set-dropoff">設為下車點</button>'
               : '<button type="button" class="btn" data-act="set-dropoff">設為下車點</button><button type="button" class="btn btn--ghost" data-act="walk-to">走路前往</button>') +
         '</div>';
    h += '<div class="wx-arrive">' +
         (seen ? '<p class="wx-arrived">已收進你的城市</p>'
               : '<button type="button" class="btn btn--ghost btn--sm wx-arrive__btn" data-act="arrive">' + (walk ? '走進去（模擬抵達）' : '搭 yoxi 抵達（模擬）') + '</button>') +
         (p.far ? '' : '<a class="xs" href="' + esc(D.links.appPlace(p.id)) + '" target="_blank" rel="noopener">在 web app 原型裡看這一頁 ↗</a>') +
         '</div>';
    if (status) h += '<p class="wx-status small" role="status">' + status + '</p>';
    card.innerHTML = h;
    card.classList.toggle('is-seen', seen);

    card.querySelector('[data-act="walk-to"]').onclick = function () {
      paintCard(walk ? '（示意）開始走路；前往中這一頁刻意什麼都不做，到了會自動響。'
                     : '（示意）' + distText(m) + '，走路大約 ' + F.walkMin(m) + ' 分；這種距離主按鈕會是「設為下車點」。');
    };
    card.querySelector('[data-act="set-dropoff"]').onclick = function () {
      paintCard('（示意）回到叫車首頁，下車點填好「' + esc(p.name) + '」，車資約 ' + F.money(F.fare(km)) + '、' + F.rideMin(km) + ' 分當場算。');
    };
    const arrive = card.querySelector('[data-act="arrive"]');
    if (arrive) arrive.onclick = function () { collect(p.id); };
  }

  /* ---- 走進去：pin 變紅、霧開洞、明信片長出來 ---- */
  function collect(id) {
    if (collected.has(id)) return;
    const p = placeOf(id);
    collected.add(id);
    const o = map.pos[id];
    if (o && !o.edge) {
      const c = svgEl('circle', { cx: r1(o.tx), cy: r1(o.ty), r: 0, fill: map.holeFill }, map.holeGroup);
      const g = svgEl('circle', { cx: r1(o.tx), cy: r1(o.ty), r: 0, fill: 'url(#wxGlow)' }, map.glowG);
      const ring = svgEl('circle', { cx: r1(o.tx), cy: r1(o.ty), r: 0, 'class': 'wx-ring' }, map.rings);   /* 一圈紅色細環擴散一次 */
      map.holes[id] = [c, g];
      tween(900, function (t) {
        const r = r1(map.R * easeOut(t));
        c.setAttribute('r', r); g.setAttribute('r', r);
        ring.setAttribute('r', r1(map.R * 1.15 * easeOut(t)));
        ring.setAttribute('opacity', (1 - t).toFixed(3));
        if (t >= 1) ring.remove();
      });
    }
    const pin = pins[id];
    if (pin) { pin.classList.remove('is-pop'); void pin.offsetWidth; pin.classList.add('is-pop'); }
    addPostcard(p);
    paintPins(); paintCount(); paintCard();
  }

  let seedN = 0;
  function addPostcard(p) {
    const ride = !F.walkable(p.dist);        /* 走不到、搭車抵達：金框（搭 yoxi 抵達版） */
    const fig = E('figure', { 'class': 'wx-pc' + (ride ? ' is-ride' : '') }, null);
    fig.innerHTML = '<div class="wx-pc__art">' + window.postcardArt(p.art, { seed: (seedN++ % 5) + 1 }) +
      '<span class="wx-pc__tag">AI 生成示意</span></div>' +
      '<figcaption><b>' + esc(p.name) + '</b><span class="xs muted">' + (ride ? '搭 yoxi 抵達版' : '走路抵達') + '</span></figcaption>';
    cardsBox.insertBefore(fig, cardsBox.firstChild);
    requestAnimationFrame(function () { fig.classList.add('is-in'); });
  }

  reset.onclick = function () {
    collected.clear();
    Object.keys(map.holes).forEach(function (id) { map.holes[id].forEach(n => n.remove()); });
    map.holes = {};
    cardsBox.innerHTML = '';
    paintPins(); paintCount(); paintCard('全部變回灰色了。');
  };

  build();
  paintCount();
  paintCard();
  onResize(function () { build(); });
}

/* ==========================================================================
   3. 距離尺：3 km 是一條線
   ========================================================================== */
function initFare() {
  const host = document.getElementById('w-fare');
  if (!host || !window.SITE_DATA || !window.SITE) return;
  const D = SITE_DATA, F = D.fmt, E = SITE.el;
  const MIN = 0.3, MAX = 30, TH = D.WALK_MAX_M / 1000;
  const today = D.places.find(p => p.today) || D.places[0];

  host.innerHTML = '';
  const root = E('div', { 'class': 'card wf' }, host);
  const top = E('div', { 'class': 'wf__top' }, root);
  E('label', { 'for': 'wf-range', 'class': 'wf__label small' }, top, '拖拖看：目的地有多遠？');
  const out = E('output', { 'for': 'wf-range', 'class': 'wf__km' }, top);

  const track = E('div', { 'class': 'wf__track' }, root);
  const scale = E('div', { 'class': 'wf__scale', 'aria-hidden': 'true' }, track);
  /* 刻度：0.3（起點）、3（門檻，紅線）、10、20、30 —— 位置照 range 的比例算，扣掉拇指寬 */
  const frac = v => (v - MIN) / (MAX - MIN);
  function tick(v, label, cls) {
    const t = E('span', { 'class': 'wf__tick' + (cls ? ' ' + cls : '') }, scale);
    t.style.setProperty('--f', frac(v).toFixed(4));
    E('span', { 'class': 'wf__tick-t' }, t, label);
  }
  [10, 20].forEach(v => tick(v, v + ' km'));
  tick(MAX, MAX + ' km', 'wf__tick--end');
  tick(TH, '走路的上限 ' + TH + ' km', 'wf__tick--th');     /* 門檻的字放在軌道下方，不跟上方刻度打架 */
  const range = E('input', { id: 'wf-range', type: 'range', min: MIN, max: MAX, step: '0.1', value: F.km(today.dist),
                             'class': 'wf__range', 'aria-label': '目的地距離（公里）' }, track);
  range.style.setProperty('--th', frac(TH).toFixed(4));

  const presets = E('div', { 'class': 'wf__presets' }, root);
  [{ label: '玻璃窯', km: F.km(today.dist) }, { label: D.far.name, km: D.far.km }].forEach(function (o) {
    const b = E('button', { type: 'button', 'class': 'btn btn--ghost btn--sm', 'data-act': 'preset-km' }, presets, o.label + ' ' + o.km + ' km');
    b.onclick = function () { range.value = o.km; update(); range.focus(); };
  });

  const res = E('div', { 'class': 'wf__out', 'aria-live': 'polite' }, root);
  const pc = E('figure', { 'class': 'wf-pc' }, root);
  let lastWalk = null;

  function update(status) {
    const km = parseFloat(range.value), m = Math.round(km * 1000);
    const walk = F.walkable(m);
    out.textContent = distText(m);
    range.style.setProperty('--v', frac(km).toFixed(4));
    root.classList.toggle('is-ride', !walk);
    let h;
    if (walk) {
      h = '<p class="wf__big">走路 <b>' + F.walkMin(m) + '</b> 分鐘</p>' +
          '<p class="small muted">' + (TH) + ' 公里以內，城事是走路的理由；車一個字都不提。</p>' +
          '<div class="wx-actions"><button type="button" class="btn" data-act="walk-to">走路前往</button>' +
          '<button type="button" class="btn btn--ghost" data-act="set-dropoff">設為下車點</button></div>';
    } else {
      h = '<p class="wf__big">車資約 <b>' + F.money(F.fare(km)) + '</b> · <b>' + F.rideMin(km) + '</b> 分</p>' +
          '<p class="small">搭車回饋 <b>' + F.ridePts(km) + '</b> 點 ＋ 走不到搭車抵達 <b>+' + D.RIDE_BONUS + '</b> 點（原型）</p>' +
          '<div class="wx-actions"><button type="button" class="btn" data-act="set-dropoff">設為下車點</button>' +
          '<button type="button" class="btn btn--ghost" data-act="walk-to" aria-disabled="true">走路前往</button></div>';
    }
    if (status) h += '<p class="wx-status small" role="status">' + status + '</p>';
    res.innerHTML = h;
    res.querySelector('[data-act="set-dropoff"]').onclick = function () {
      update('（示意）下車點填好，車資約 ' + F.money(F.fare(km)) + '、' + F.rideMin(km) + ' 分當場算。');
    };
    res.querySelector('[data-act="walk-to"]').onclick = function () {
      update(walk ? '（示意）開始走路；到了會自動響。' : '（示意）走路要 ' + F.walkMin(m) + ' 分，這段交給 yoxi。');
    };
    /* 明信片只在跨過門檻時換（金框＝搭 yoxi 抵達版），拖動時不重畫 SVG */
    if (walk !== lastWalk) {
      lastWalk = walk;
      const art = walk ? today.art : D.far.art;
      pc.className = 'wf-pc' + (walk ? '' : ' is-ride');
      pc.innerHTML = '<div class="wx-pc__art">' + window.postcardArt(art, { seed: walk ? 1 : 3 }) +
        '<span class="wx-pc__tag">AI 生成示意</span></div>' +
        '<figcaption class="xs">' + (walk ? '走路抵達的明信片' : '搭 yoxi 抵達版：鑲金框') + '</figcaption>';
    }
  }
  range.oninput = function () { update(); };
  range.onchange = function () { update(); };
  update();
}

/* ==========================================================================
   4. 叫車首頁圖層開／關對照
   ========================================================================== */
function initCompare() {
  const host = document.getElementById('w-compare');
  if (!host || !window.SITE_DATA || !window.SITE) return;
  const D = SITE_DATA, E = SITE.el;

  host.innerHTML = '';
  const root = E('div', { 'class': 'wc' }, host);
  const labels = E('div', { 'class': 'wc__labels' }, root);
  E('span', { 'class': 'pill pill--navy' }, labels, '← 現況');
  E('span', { 'class': 'pill' }, labels, '開了城事圖層 →');

  /* 截圖本身已經畫了手機外框（430×912），所以不再套 .phone，免得框中有框 */
  const stage = E('div', { 'class': 'wc__stage' }, root);
  E('img', { src: D.links.thumbs('home'), alt: '叫車首頁現況（圖層關）', 'class': 'wc__img', draggable: 'false' }, stage);
  const after = E('div', { 'class': 'wc__after' }, stage);
  E('img', { src: D.links.thumbs('variant-e-home'), alt: '叫車首頁開了城事圖層（景點常駐在地圖上）', 'class': 'wc__img', draggable: 'false' }, after);
  E('div', { 'class': 'wc__handle', 'aria-hidden': 'true' }, stage);
  const range = E('input', { type: 'range', min: 0, max: 100, step: 1, value: 50, 'class': 'wc__range',
                             'aria-label': '對照分隔線：往左看更多「開了城事圖層」，往右看更多「現況」' }, stage);

  const sw = E('div', { 'class': 'switch wc__switch', role: 'group', 'aria-label': '城事圖層' }, root);
  const bOff = E('button', { type: 'button', 'data-act': 'layer-off' }, sw, '圖層關');
  const bMid = E('button', { type: 'button', 'data-act': 'layer-split' }, sw, '對照');
  const bOn = E('button', { type: 'button', 'data-act': 'layer-on' }, sw, '圖層開');
  E('p', { 'class': 'credit wc__note' }, root, '收合態的 sheet 0 像素改動、叫車關鍵路徑 4 下不變——量在原型 home.html');

  function set(v) {
    v = Math.max(0, Math.min(100, +v));
    range.value = v;
    stage.style.setProperty('--x', v + '%');
    bOff.setAttribute('aria-pressed', v >= 100 ? 'true' : 'false');
    bOn.setAttribute('aria-pressed', v <= 0 ? 'true' : 'false');
    bMid.setAttribute('aria-pressed', v > 0 && v < 100 ? 'true' : 'false');
    range.setAttribute('aria-valuetext', v >= 100 ? '全部是現況' : v <= 0 ? '全部是開了城事圖層' : '左 ' + v + '% 現況');
  }
  range.oninput = function () { set(range.value); };
  bOff.onclick = function () { set(100); };
  bOn.onclick = function () { set(0); };
  bMid.onclick = function () { set(50); };
  set(50);
}

/* ---- 啟動：每個 widget 各自 try，一個炸了不拖垮其他 ---------------------------- */
function boot() {
  [initHero, initExplore, initFare, initCompare].forEach(function (fn) {
    try { fn(); } catch (e) { console.error('[widgets] ' + fn.name, e); }
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
