/* ==========================================================================
   yoxi 城事 — 影片向量動畫：第 1–7 格場景（場景 agent A）
   quiet、question、name、morning、walk、lightup、far
   契約見 CONTRACT.md；共用零件在 lib.js（window.A、ctx）。

   原則：
   - 每個屬性都是局部秒數 u 的函數；沒有 CSS 動畫、rAF、Math.random、Date。
   - 「長度無關」：進場用固定秒數；跟旁白對齊的動作一律讀 shot.subs[k].t0 - shot.start（S(shot,k)）；
     收尾用 speechEnd(shot) 之後的 hold 秒。TTS 長度變了不用改這裡。
   - 數字一律讀 ctx.calc；地點座標一律用 ctx.map.place()；內灣方位讀 HSINCHU_PLACES.neiwan（資料，不手寫）。
   ========================================================================== */
(function () {
'use strict';

const { W, H, E, seg, lerp, clamp01, pulse, el, setA, g, text, tr, PRIM, r2, r3 } = A;

/* ---------------------------------------------------------------- 小工具 */
/* 第 k 句旁白的局部開始秒；沒有那句就用比例估 */
function S(shot, k) {
  const s = (shot.subs || [])[k];
  return s ? s.t0 - shot.start : (TIMELINE.lead || .25) + k * (shot.dur * .4);
}
/* 旁白唸完的局部秒（之後就是 hold） */
function speechEnd(shot) {
  const subs = shot.subs || [];
  return subs.length ? subs[subs.length - 1].t1 - shot.start : shot.dur - 1.2;
}
/* 淡入＋上升（dy 像素）：回傳 0..1，並直接套到節點上 */
function rise(node, u, t0, d, dy, x) {
  const k = seg(u, t0, t0 + (d || .6));
  setA(node, { opacity: r3(k), transform: tr(x || 0, (1 - k) * (dy == null ? 24 : dy)) });
  return k;
}
/* 字寬（mount 之後才量得到） */
function tw(t) { return A.textWidth(t); }
/* 抵達爆開：前 .15 秒 1→peak，之後 outBack 回到 1（會略為下沖再回來） */
function popAt(u, t0, peak) {
  if (u < t0) return 1;
  const a = seg(u, t0, t0 + .15, E.out), b = seg(u, t0 + .15, t0 + .5, E.outBack);
  return u < t0 + .15 ? lerp(1, peak, a) : lerp(peak, 1, b);
}
/* 地圖座標的折線上取點（k 0..1，依長度） */
function polyAt(pts, k) {
  let L = 0; const seglen = [];
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].px - pts[i - 1].px, pts[i].py - pts[i - 1].py); seglen.push(d); L += d; }
  let t = clamp01(k) * L;
  for (let i = 0; i < seglen.length; i++) {
    if (t <= seglen[i] || i === seglen.length - 1) {
      const f = seglen[i] ? Math.min(1, t / seglen[i]) : 0;
      return { px: lerp(pts[i].px, pts[i + 1].px, f), py: lerp(pts[i].py, pts[i + 1].py, f) };
    }
    t -= seglen[i];
  }
  return pts[pts.length - 1];
}
/* 公尺（相對車站，+x 東 +y 南）→ 目前 set 的地圖像素：用車站與玻璃窯兩個已知點做線性換算（hsmap 沒有旋轉） */
function meterToPx(ctx, mx, my) {
  const P = window.HSINCHU_PLACES, a = ctx.map.place('station'), b = ctx.map.place('glass-kiln');
  const kx = (b.px - a.px) / (P['glass-kiln'].x - P.station.x), ky = (b.py - a.py) / (P['glass-kiln'].y - P.station.y);
  return { px: a.px + (mx - P.station.x) * kx, py: a.py + (my - P.station.y) * ky };
}
/* 1 公尺 = 幾個地圖像素（目前 set） */
function pxPerM(ctx) {
  const P = window.HSINCHU_PLACES, a = ctx.map.place('station'), b = ctx.map.place('glass-kiln');
  return (b.px - a.px) / (P['glass-kiln'].x - P.station.x);
}

/* 第 5 格的步行路線：車站 → 水利路的老玻璃窯。
   由 hs-core.js 的 roadMajor＋roadMinor 以最短路徑求出、再以 RDP 簡化成 6 個轉折（公尺，相對車站），
   所以小點是真的沿著新竹街道走，不是直線。 */
const WALK_M = [[-2, 22], [51, 63], [244, -69], [414, 187], [546, 225], [652, 365], [814, 257], [838.7, 287.5]];
/* 第 5 格收尾時鏡頭停在玻璃窯「上方」多少地圖像素（core），讓 pin 落在畫面偏下、上面留給明信片與大字 */
const WALK_CAM_DY = -100;
const WALK_ZOOM = 1.4;
const CORE_TO_WIDE = 3000 / 11000;           /* core 1 px = wide 0.2727 px（spanM 3000 vs 11000） */

/* 第 6、7 格共用：10 個地點、各自的洞半徑與開啟順序（ctx.rng(11) 決定、固定）。必須在 set:'wide' 之後呼叫 */
const LIGHT_IDS = ['station', 'temple', 'brick', 'market', 'moat', 'hill', 'lake', 'harbour', 'rail', 'glass-kiln'];
function lightPlaces(ctx) {
  const rnd = ctx.rng(11);
  const list = LIGHT_IDS.map(id => Object.assign({ id }, ctx.map.place(id), { r: 110 + 60 * rnd(), key: rnd() }));
  /* 車站與玻璃窯在第 5 格已經亮過，排在最前；其餘依亂數排序 */
  const first = list.filter(p => p.id === 'glass-kiln' || p.id === 'station');
  const rest = list.filter(p => p.id !== 'glass-kiln' && p.id !== 'station').sort((a, b) => a.key - b.key);
  const out = first.concat(rest);
  out.forEach((p, i) => { p.order = i; });
  return out;
}
/* 第 6 格收尾／第 7 格開場的鏡頭：把地點框進舞台 x 200–1720、y 110–740（下方留給大字與字幕）。
   南寮漁港（harbour）在西北 7 km 外，框進來整座城會縮成一小團，所以不列入取景（它的洞照開，只是在畫面外）。
   最大倍率 .85：再大市中心的 pin 會疊在一起。 */
function lightEndView(places) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  places.filter(p => p.id !== 'harbour').forEach(p => { x0 = Math.min(x0, p.px); x1 = Math.max(x1, p.px); y0 = Math.min(y0, p.py); y1 = Math.max(y1, p.py); });
  const z = Math.min(.85, 1520 / Math.max(1, x1 - x0), 630 / Math.max(1, y1 - y0));
  /* 取景中心用市中心那一團（不含東邊 6 km 的 rail），構圖才不會偏左上；rail 在 .85 倍時仍在畫面右側 */
  let cx0 = 1e9, cx1 = -1e9;
  places.filter(p => p.id !== 'harbour' && p.id !== 'rail').forEach(p => { cx0 = Math.min(cx0, p.px); cx1 = Math.max(cx1, p.px); });
  return { cx: (cx0 + cx1) / 2 + 60 / z, cy: (y0 + y1) / 2 + (540 - 425) / z, zoom: z };
}

/* ==========================================================================
   #1 quiet（開場，light）
   畫什麼：整片霧的新竹街道慢慢平移；中央偏下一排 7 個「日子」方塊，只有第 2、第 5 天亮起紅色 yoxi 圖示。
   時間：u 0–.5 方塊依序淡入；u .8、1.4 兩個圖示 outBack 彈出；第二句旁白開始時大字淡入。
   ========================================================================== */
ANIM.scene('quiet', {
  mount(g0, ctx) {
    const C = ctx.C, st = ctx.state;
    setA(ctx.bg, { opacity: 0 });
    const N = 7, T = 128, GAP = 28, X0 = W / 2 - (N * T + (N - 1) * GAP) / 2, Y = 560;
    st.days = [];
    const DAYS = ['一', '二', '三', '四', '五', '六', '日'];
    for (let i = 0; i < N; i++) {
      const cell = g(g0);
      const x = X0 + i * (T + GAP);
      el('rect', { x, y: Y + 8, width: T, height: T, rx: 8, fill: C.navy, opacity: .06 }, cell);  /* 實色層次，不用陰影模糊 */
      el('rect', { x, y: Y, width: T, height: T, rx: 8, fill: C.white }, cell);
      const on = i === 1 || i === 4;
      let appIcon = null;
      if (on) {
        appIcon = g(cell);
        const inner = g(appIcon);
        el('rect', { x: -42, y: -42, width: 84, height: 84, rx: 22, fill: C.red }, inner);
        text(inner, 0, 10, 'yoxi', { 'font-size': 30, 'font-weight': 900, fill: C.white, 'text-anchor': 'middle' });
        appIcon.inner = inner;
        appIcon.cx = x + T / 2; appIcon.cy = Y + T / 2;
      }
      const dot = el('circle', { cx: x + T / 2, cy: Y + T / 2, r: 9, fill: C.slateLite }, cell);
      text(cell, x + T / 2, Y + T + 44, DAYS[i], { 'font-size': 24, fill: C.slate, 'text-anchor': 'middle' });
      st.days.push({ cell, appIcon, dot, on });
    }
    st.say = PRIM.statement(g0, { x: W / 2, y: 420, lines: ['只有要出門那一刻，【才被打開】'], size: 80, anchor: 'middle' });
  },
  update(u, ctx, shot) {
    const st = ctx.state;
    /* 地圖：core、整片霧、慢慢往東平移（每秒 12 地圖像素 × 1.15） */
    ctx.map.view({ set: 'core' });
    const s = ctx.map.place('station');
    ctx.map.view({ set: 'core', cx: s.px - 70 + u * 12, cy: s.py - 20 + u * 3, zoom: 1.15 });
    ctx.map.fog([], .78);   /* 霧淡一點，街道隱約可見（第 1 格的城市要看得到） */
    /* 七個方塊 */
    st.days.forEach((d, i) => {
      rise(d.cell, u, i * .04, .5, 20);
      if (d.on) {
        const t0 = i === 1 ? .8 : 1.4;
        const k = seg(u, t0, t0 + .5, E.outBack);
        setA(d.appIcon.inner, { transform: tr(d.appIcon.cx, d.appIcon.cy, Math.max(0.001, k)) });
        setA(d.appIcon, { opacity: r3(seg(u, t0, t0 + .15)) });
        setA(d.dot, { opacity: r3(1 - seg(u, t0, t0 + .2)) });
      }
    });
    /* 第二句：大字 */
    rise(st.say, u, S(shot, 1), .6, 20);
  },
});

/* ==========================================================================
   #2 question（開場，dark）
   畫什麼：海軍藍底，題目一個字一個字打出來（白色細長游標）；第二句時題目縮小上移變淡，答案大字從下方淡入。
   時間：u .3 起每字 .13 秒；游標打字中常亮、打完以半秒切換；第二句 S(1) 起 .7 秒過場。
   ========================================================================== */
ANIM.scene('question', {
  mount(g0, ctx) {
    const C = ctx.C, st = ctx.state;
    st.q = '不搭車，也打開 yoxi';
    st.chars = Array.from(st.q);
    st.qg = g(g0);
    st.qt = text(st.qg, 0, 0, st.q, { 'font-size': 96, 'font-weight': 900, fill: C.white });
    st.qw = tw(st.qt);
    setA(st.qt, { x: r2(-st.qw / 2), y: 34 });
    st.cursor = el('rect', { x: 0, y: -48, width: 7, height: 92, rx: 2, fill: C.white }, st.qg);
    st.ans = PRIM.statement(g0, { x: W / 2, y: 610, lines: ['給它一個【跟車無關】的理由'], size: 96, anchor: 'middle', fill: C.white });
  },
  update(u, ctx, shot) {
    const C = ctx.C, st = ctx.state;
    const s1 = S(shot, 1);
    /* 打字 */
    const T0 = .3, PER = .13;
    const n = Math.max(0, Math.min(st.chars.length, Math.floor((u - T0) / PER) + 1));
    setA(st.qt, { text: st.chars.slice(0, n).join('') });
    const w = n ? tw(st.qt) : 0;
    const typing = n < st.chars.length;
    const blinkOn = typing || Math.floor(u * 2) % 2 === 0;
    const k = seg(u, s1, s1 + .7, E.inOut);
    setA(st.cursor, { x: r2(-st.qw / 2 + w + 10), opacity: blinkOn && k < .05 ? 1 : 0 });
    /* 第二句：題目上移縮小變淡 */
    setA(st.qg, { transform: tr(W / 2, lerp(540, 380, k), lerp(1, .5, k)) });
    setA(st.qt, { opacity: r3(lerp(1, .55, k)) });   /* 白字淡到 .55 ≈ slate-lite 的灰，連續變化不跳色 */
    rise(st.ans, u, s1 + .15, .7, 40);
  },
});

/* ==========================================================================
   #3 name（願景，light）
   畫什麼：霧的地圖只在車站開一個洞（放在右下，不壓字）；字標「yoxi 城事」outBack 放大進場；
          下面三個短句依序亮起：一天一個地方／走得到就走（步行小點）／走不到就用 yoxi 去（小車）。
   時間：字標 0–.6；第一句 45% 處亮第 1 句；第二句開頭亮第 2 句、第二句 45% 處亮第 3 句；每句 .5 秒 ease-out。
   ========================================================================== */
ANIM.scene('name', {
  mount(g0, ctx) {
    const C = ctx.C, st = ctx.state;
    setA(ctx.bg, { opacity: 0 });
    /* 字後面一塊淡的霧色面，讓字在地圖上穩定 */
    st.wmG = g(g0);
    PRIM.wordmark(st.wmG, { x: 0, y: 42, size: 120, anchor: 'middle' });
    st.lines = [];
    const L = [['一天一個地方', null], ['走得到就走', 'walker'], ['走不到就用 yoxi 去', 'car']];
    L.forEach((l, i) => {
      const lg = g(g0);
      const y = 560 + i * 92;
      const t = text(lg, W / 2, y, l[0], { 'font-size': 44, 'font-weight': 900, fill: C.navy, 'text-anchor': 'middle' });
      const w = tw(t);
      if (l[1] === 'walker') PRIM.walker(lg, { x: W / 2 - w / 2 - 44, y: y - 15, s: .8 });
      if (l[1] === 'car') PRIM.car(lg, { x: W / 2 - w / 2 - 70, y: y - 6, s: .5 });
      st.lines.push(lg);
    });
  },
  update(u, ctx, shot) {
    const st = ctx.state;
    ctx.map.view({ set: 'core' });
    const s = ctx.map.place('station');
    const z = lerp(1.0, 1.08, clamp01(u / shot.dur));
    /* 車站放在畫面右下（離中央 +560, +250 舞台像素），洞不壓字 */
    ctx.map.view({ set: 'core', cx: s.px - 560 / z, cy: s.py - 250 / z, zoom: z });
    ctx.map.fog([{ px: s.px, py: s.py, r: 260 * seg(u, 0, .7, E.out) }], .85);
    /* 字標 */
    const k = seg(u, 0, .6, E.outBack);
    setA(st.wmG, { transform: tr(W / 2, 330, lerp(.9, 1, k)), opacity: r3(seg(u, 0, .35)) });
    /* 三個短句 */
    const s0 = S(shot, 0), s1 = S(shot, 1), e = speechEnd(shot);
    const ts = [lerp(s0, s1, .45), s1, lerp(s1, e, .45)];
    st.lines.forEach((lg, i) => rise(lg, u, ts[i], .5, 18));
  },
});

/* ==========================================================================
   #4 morning（A，light）
   畫什麼：晨光（奶油底、一顆淺色太陽慢慢升），一張「今天的地方」卡從下方升到中央；左側灰 pin 呼吸。
          第二句時卡右上角出現鈴鐺＋「一天最多 N 則 · 都能關」。沒有徽章、倒數、紅點。
   時間：卡 0–.65 ease-out 上升；pin 以 2.4 秒週期呼吸；第二句 S(1) 起 .5 秒淡入推播說明。
   ========================================================================== */
ANIM.scene('morning', {
  mount(g0, ctx) {
    const C = ctx.C, st = ctx.state, K = ctx.calc.kiln;
    ctx.bg.setAttribute('fill', C.cream);
    st.sun = el('circle', { cx: 1500, cy: 300, r: 150, fill: C.creamDeep }, g0);
    const CW = 800, CH = 300, CX = W / 2 - CW / 2, CY = 0;
    st.card = g(g0);
    el('rect', { x: CX, y: CY + 10, width: CW, height: CH, rx: 8, fill: C.navy, opacity: .08 }, st.card);
    PRIM.card(st.card, { x: CX, y: CY, w: CW, h: CH, r: 8, fill: C.white });
    st.pin = PRIM.pin(st.card, { x: CX + 104, y: CY + 196, s: 3.6, state: 'grey' });
    const TX = CX + 196;
    PRIM.tag(st.card, { x: TX, y: CY + 70, text: '今天的地方', size: 26, fg: C.red, bg: C.redSoft });
    text(st.card, TX, CY + 172, K.label, { 'font-size': 56, 'font-weight': 900, fill: C.navy });
    text(st.card, TX, CY + 230, K.m + ' m · 走路 ' + K.walkMin + ' 分', { 'font-size': 32, fill: C.slate });
    /* 推播說明：右上角 */
    st.bell = g(st.card);
    const bt = text(st.bell, CX + CW - 44, CY + 78, '一天最多 ' + ctx.calc.pushPerDay + ' 則 · 都能關', { 'font-size': 24, fill: C.slate, 'text-anchor': 'end' });
    A.icon(st.bell, 'bell', CX + CW - 44 - tw(bt) - 40, CY + 52, 32);
    st.CY = 390;
  },
  update(u, ctx, shot) {
    const st = ctx.state;
    const k = seg(u, 0, .65, E.out);
    setA(st.card, { transform: tr(0, lerp(H + 40, st.CY, k)) });
    setA(st.sun, { cy: r2(lerp(360, 250, clamp01(u / shot.dur))) });
    PRIM.pinState(st.pin, 'grey', 1 + .08 * pulse(u, 2.4));
    rise(st.bell, u, S(shot, 1), .5, 10);
  },
});

/* ==========================================================================
   #5 walk（A，light）
   畫什麼：core 地圖、zoom 1.4，步行小點沿真實街道從車站走到水利路的老玻璃窯，鏡頭平滑跟著；
          路線是 navy 虛線，走過的部分畫成實線；霧只開起點與小點周圍（越走越大）。
          到達：灰 pin → 紅 pin 爆開＋一圈紅色細圓擴散；明信片從 pin 上方升起；hold 時大字「到了才上色」。
   時間：走路 u .4 → S(1)+1.2（inOutSine）；鏡頭用較寬的 inOut 跟（有一點延遲＝平滑）；
         到達後 .3 秒明信片升起；speechEnd 起大字淡入。
   ========================================================================== */
ANIM.scene('walk', {
  mount(g0, ctx) {
    const C = ctx.C, st = ctx.state;
    setA(ctx.bg, { opacity: 0 });
    st.dash = el('path', { d: '', fill: 'none', stroke: C.navy, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
                           'stroke-dasharray': '1 14', opacity: .4 }, g0);
    st.solidCase = el('path', { d: '', fill: 'none', stroke: C.white, 'stroke-width': 11, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: .9 }, g0);
    st.solid = el('path', { d: '', fill: 'none', stroke: C.navy, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g0);
    st.ring = el('circle', { cx: 0, cy: 0, r: 0, fill: 'none', stroke: C.red, 'stroke-width': 4, opacity: 0 }, g0);
    st.pin = PRIM.pin(g0, { x: 0, y: 0, s: 3.2, state: 'grey' });
    st.walker = PRIM.walker(g0, { x: 0, y: 0, s: 1 });
    st.pcG = g(g0);
    PRIM.postcard(st.pcG, { x: -180, y: -240, w: 360, h: 240, seed: 5, label: true });
    st.say = PRIM.statement(g0, { x: W / 2, y: 150, lines: ['到了才【上色】'], size: 80, anchor: 'middle' });
  },
  update(u, ctx, shot) {
    const C = ctx.C, st = ctx.state;
    /* 先宣告 set 才能取地點（place 用目前 set） */
    ctx.map.view({ set: 'core' });
    if (!st.route) st.route = WALK_M.map(p => meterToPx(ctx, p[0], p[1]));
    const route = st.route, kiln = route[route.length - 1];
    const T0 = .4, T1 = S(shot, 1) + 1.2;
    const kw = seg(u, T0, T1, E.inOutSine);
    const kc = seg(u, T0 - .3, T1 + .6, E.inOut);
    const me = polyAt(route, kw), cam = polyAt(route, kc);
    const camDy = WALK_CAM_DY * seg(u, T1 - .8, T1 + .8, E.inOut);
    ctx.map.view({ set: 'core', cx: cam.px, cy: cam.py + camDy, zoom: WALK_ZOOM });
    /* 霧：起點一個洞＋跟著小點的洞（半徑隨走過的距離長大到 240） */
    const holes = [{ px: route[0].px, py: route[0].py, r: 200 }];
    /* 走過的路留下一串淡的小洞（路線上的淺色軌跡），小點周圍的洞最大 */
    for (let j = 1; j <= 12; j++) { const kj = j / 13; if (kj < kw) { const q = polyAt(route, kj); holes.push({ px: q.px, py: q.py, r: 90, opacity: .55 }); } }
    holes.push({ px: me.px, py: me.py, r: lerp(130, 240, kw) });
    ctx.map.fog(holes, .8);
    /* 路線：虛線全程、實線畫到小點 */
    const d = ctx.map.route(route);
    setA(st.dash, { d });
    setA(st.solid, { d });
    setA(st.solidCase, { d });
    A.drawPath(st.solid, kw);
    A.drawPath(st.solidCase, kw);
    /* 小點 */
    const w = ctx.map.toStage(me.px, me.py);
    setA(st.walker, { transform: tr(w[0], w[1]), opacity: r3(1 - seg(u, T1 + .1, T1 + .4)) });
    setA(st.walker.ring, { r: r2(26 + 8 * pulse(u, 1.2)) });
    /* 目的地 pin：到達時爆開變紅 */
    const p = ctx.map.toStage(kiln.px, kiln.py);
    PRIM.pinMove(st.pin, p[0], p[1]);
    PRIM.pinState(st.pin, u >= T1 ? 'red' : 'grey', popAt(u, T1, 1.35));
    /* 紅色細圓擴散（圓心在 pin 頭） */
    const kr = seg(u, T1, T1 + .8, E.out);
    setA(st.ring, { cx: r2(p[0]), cy: r2(p[1] - 40), r: r2(220 * kr), opacity: r3(u >= T1 ? (1 - kr) * .9 : 0) });
    /* 明信片從 pin 上方升起、輕微放大 */
    const kp = seg(u, T1 + .3, T1 + .9, E.out);
    const grow = lerp(1, 1.04, seg(u, T1 + .9, shot.dur, E.inOut));
    setA(st.pcG, { transform: tr(p[0], p[1] - 110 - 40 * kp, lerp(.9, 1, kp) * grow), opacity: r3(kp) });
    if (kp > 0) ctx.credit('ai');
    /* hold：大字 */
    rise(st.say, u, speechEnd(shot), .6, 16);
  },
});

/* ==========================================================================
   #6 lightup（A，light）
   畫什麼：時間快轉、整城亮起。整格用 wide 地圖，從第 5 格的倍率（1.4×11/3）一路拉遠到能框住 10 個地點；
          10 個洞依序以 outBack 打開，每個地點一顆 pin，洞開時灰→紅並 pop。
          第二句：右上角「收集 4/8」＋獎章圖示；畫面下方大字「你的城市，一格一格亮起來」。
   時間：鏡頭 0 → S(1)（對數縮放＋inOut）；車站與玻璃窯的洞一開始就開著，其餘 8 個在 .35·S(1) → S(1)+1.5 間依 rng(11) 順序打開。
   ========================================================================== */
ANIM.scene('lightup', {
  mount(g0, ctx) {
    const C = ctx.C, st = ctx.state;
    setA(ctx.bg, { opacity: 0 });
    st.pinG = g(g0);
    st.pins = LIGHT_IDS.map(() => PRIM.pin(st.pinG, { x: 0, y: 0, s: 1.8, state: 'grey' }));
    st.badge = g(g0);
    const tag = PRIM.tag(st.badge, { x: W - 56, y: 84, text: '收集 ' + ctx.calc.badge.have + '/' + ctx.calc.badge.of, size: 30, fg: C.navy, bg: C.white, anchor: 'end' });
    A.icon(st.badge, 'badge', W - 56 - tag.width - 64, 60, 48);
    st.say = PRIM.statement(g0, { x: W / 2, y: 830, lines: ['你的城市，一格一格【亮起來】'], size: 76, anchor: 'middle' });
    /* 註：y 取 830（比建議的 780 低一點），避開湖邊的 pin；字幕條從 y 924 開始，不會壓到 */
  },
  update(u, ctx, shot) {
    const st = ctx.state;
    ctx.map.view({ set: 'wide' });
    if (!st.places) { st.places = lightPlaces(ctx); st.end = lightEndView(st.places); }
    const P = st.places, END = st.end;
    const kiln = ctx.map.place('glass-kiln');
    const s1 = S(shot, 1);
    /* 鏡頭：起點＝第 5 格收尾的畫面（同一個地理比例） */
    const z0 = WALK_ZOOM / CORE_TO_WIDE;
    const c0 = { px: kiln.px, py: kiln.py + WALK_CAM_DY * CORE_TO_WIDE };
    const kz = seg(u, 0, Math.max(1.5, s1), E.inOut);
    const z = Math.exp(lerp(Math.log(z0), Math.log(END.zoom), kz));
    /* 中心跟著縮放的進度走（用縮放後的畫面比例插值，看起來像一路後退而不是橫移） */
    const kc = (1 / z - 1 / z0) / (1 / END.zoom - 1 / z0);
    ctx.map.view({ set: 'wide', cx: lerp(c0.px, END.cx, kc), cy: lerp(c0.py, END.cy, kc), zoom: z });
    /* 洞與 pin */
    const tA = .35 * s1, tB = s1 + 1.5, n = P.length - 2;
    const holes = [];
    P.forEach((p, i) => {
      const t0 = p.order < 2 ? -1 : lerp(tA, tB, (p.order - 2) / Math.max(1, n - 1));
      const kr = t0 < 0 ? 1 : seg(u, t0, t0 + .6, E.outBack);
      /* 開場時的兩個舊洞：半徑從第 5 格的大小（換算到 wide）長到自己的 r */
      const r = t0 < 0 ? lerp((p.id === 'glass-kiln' ? 240 : 200) * CORE_TO_WIDE, p.r, kz) : p.r * kr;
      if (r > 0) holes.push({ px: p.px, py: p.py, r: Math.max(0, r) });
      const s = ctx.map.toStage(p.px, p.py);
      const pin = st.pins[LIGHT_IDS.indexOf(p.id)];
      PRIM.pinMove(pin, s[0], s[1]);
      /* pin 大小：開場接第 5 格的 3.2 倍，隨鏡頭拉遠縮回 1.8 倍（用 pop 參數乘上去） */
      const sz = lerp(3.2 / 1.8, 1, kz);
      PRIM.pinState(pin, (t0 < 0 || u >= t0) ? 'red' : 'grey', sz * (t0 < 0 ? 1 : popAt(u, t0, 1.35)));
    });
    ctx.map.fog(holes, .84);
    /* 第二句：收集標籤、大字 */
    rise(st.badge, u, s1, .6, -10);
    rise(st.say, u, s1 + .2, .6, 16);
  },
});

/* ==========================================================================
   #7 far（B，light）
   畫什麼：接第 6 格的 wide 視角繼續拉遠到 0.55，城市在中央、四周是霧色留白（地圖之外）。
          一條紅色虛線從車站往內灣的方位（讀 HSINCHU_PLACES.neiwan 的東、南公尺）伸到舞台 x≈1560 的 pin；
          步行小點沿虛線走到「走路的上限」（calc.walkMaxKm，換成地圖比例）就停下、外圈呼吸；
          左下一條 walkMaxKm 的比例尺；第二句時大字「腳到不了的一段」。
   時間：鏡頭 0 → 2 秒（inOut）；虛線 .3 → 1.6 畫出；pin 在虛線畫到時爆開；小點 S(0)+.4 → S(1)-.2；第二句 S(1) 大字淡入。
   ========================================================================== */
ANIM.scene('far', {
  mount(g0, ctx) {
    const C = ctx.C, st = ctx.state, NW = ctx.calc.neiwan;
    setA(ctx.bg, { opacity: 0 });
    st.pinG = g(g0);
    st.pins = LIGHT_IDS.map(() => PRIM.pin(st.pinG, { x: 0, y: 0, s: 1.8, state: 'red' }));
    st.range = el('circle', { cx: 0, cy: 0, r: 0, fill: 'none', stroke: C.navy, 'stroke-width': 2.5, 'stroke-dasharray': '6 10', opacity: 0 }, g0);
    st.line = el('path', { d: '', fill: 'none', stroke: C.red, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-dasharray': '2 14' }, g0);
    st.far = PRIM.pin(g0, { x: 0, y: 0, s: 3, state: 'grey' });
    st.tag = PRIM.tag(g0, { x: 0, y: 0, text: NW.label + ' · ' + NW.km + ' km', size: 30, fg: C.red, bg: C.redSoft });
    st.walker = PRIM.walker(g0, { x: 0, y: 0, s: .9 });
    /* 比例尺 */
    st.scale = g(g0);
    st.scaleLine = el('path', { d: '', fill: 'none', stroke: C.slate, 'stroke-width': 3, 'stroke-linecap': 'round' }, st.scale);
    text(st.scale, 48, 968, ctx.calc.walkMaxKm + ' km · 走路的上限', { 'font-size': 24, fill: C.slate });
    /* 大字放右上：左邊是城市與步行範圍圈，右下是往內灣的虛線 */
    st.say = PRIM.statement(g0, { x: 1400, y: 300, lines: ['腳到不了的一段'], size: 80, anchor: 'middle' });
  },
  update(u, ctx, shot) {
    const st = ctx.state, NWm = window.HSINCHU_PLACES.neiwan;
    ctx.map.view({ set: 'wide' });
    if (!st.places) {
      st.places = lightPlaces(ctx); st.start = lightEndView(st.places);
      st.station = ctx.map.place('station'); st.ppm = pxPerM(ctx);
      const L = Math.hypot(NWm.x, NWm.y);
      st.dir = { x: NWm.x / L, y: NWm.y / L };
    }
    const P = st.places, S0 = st.start, stn = st.station;
    /* 鏡頭：從第 6 格收尾拉遠到 0.55，車站放在舞台 (700, 360)，右下留給往內灣的虛線 */
    const Z1 = .55, SX = 700, SY = 360;
    const end = { cx: stn.px + (W / 2 - SX) / Z1, cy: stn.py + (H / 2 - SY) / Z1 };
    const kc = seg(u, 0, 2.0, E.inOut);
    const z = Math.exp(lerp(Math.log(S0.zoom), Math.log(Z1), kc));
    ctx.map.view({ set: 'wide', cx: lerp(S0.cx, end.cx, kc), cy: lerp(S0.cy, end.cy, kc), zoom: z });
    ctx.map.fog(P.map(p => ({ px: p.px, py: p.py, r: p.r })), .84);
    P.forEach(p => {
      const s = ctx.map.toStage(p.px, p.py), pin = st.pins[LIGHT_IDS.indexOf(p.id)];
      PRIM.pinMove(pin, s[0], s[1]);
    });
    /* 虛線：車站 → 內灣方位，長度讓終點落在舞台 x≈1560（示意比例；真實 28 km 在這個倍率下會出畫面） */
    const s = ctx.map.toStage(stn.px, stn.py);
    const Ls = (1560 - SX) / st.dir.x;
    const pEnd = [s[0] + st.dir.x * Ls, s[1] + st.dir.y * Ls];
    const kl = seg(u, .3, 1.6, E.inOut);
    /* 虛線逐段畫出：直接把終點縮短（drawPath 會蓋掉 dasharray，所以不用它） */
    setA(st.line, { d: 'M' + r2(s[0]) + ' ' + r2(s[1]) + ' L' + r2(lerp(s[0], pEnd[0], kl)) + ' ' + r2(lerp(s[1], pEnd[1], kl)) });
    PRIM.pinMove(st.far, pEnd[0], pEnd[1]);
    const tp = 1.6;
    PRIM.pinState(st.far, u >= tp ? 'red' : 'grey', popAt(u, tp, 1.35));
    setA(st.far, { opacity: r3(seg(u, 1.2, 1.6)) });
    setA(st.tag, { transform: tr(pEnd[0] - st.tag.width / 2, pEnd[1] + 50), opacity: r3(seg(u, tp + .1, tp + .6)) });
    /* 走路的上限：walkMaxKm 換成目前比例的舞台像素 */
    const walkPx = ctx.calc.walkMaxKm * 1000 * st.ppm * z;
    setA(st.range, { cx: r2(s[0]), cy: r2(s[1]), r: r2(walkPx), opacity: r3(.45 * seg(u, S(shot, 0) + .2, S(shot, 0) + .8)) });
    const t0 = S(shot, 0) + .4, t1 = Math.max(t0 + 1, S(shot, 1) - .2);
    const kw = seg(u, t0, t1, E.inOutSine);
    const wx = s[0] + st.dir.x * walkPx * kw, wy = s[1] + st.dir.y * walkPx * kw;
    setA(st.walker, { transform: tr(wx, wy), opacity: r3(seg(u, t0 - .3, t0)) });
    /* 停下之後外圈呼吸：走不到 */
    const stopped = seg(u, t1, t1 + .3);
    setA(st.walker.ring, { r: r2(26 + 14 * stopped * pulse(u - t1, 1.4)), opacity: r3(.35 + .3 * stopped * pulse(u - t1, 1.4)) });
    /* 比例尺：左下、署名之上 */
    setA(st.scaleLine, { d: 'M48 1000 v-12 M48 994 H' + r2(48 + walkPx) + ' M' + r2(48 + walkPx) + ' 1000 v-12' });
    setA(st.scale, { opacity: r3(seg(u, .6, 1.2)) });
    rise(st.say, u, S(shot, 1), .6, 16);
  },
});

})();
