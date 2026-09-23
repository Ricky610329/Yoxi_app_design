/* ==========================================================================
   yoxi 城事 — 影片向量動畫：場景 B（第 8–13 格：ride、gold、night、ai、roadmap、end）
   契約見 CONTRACT.md。所有屬性都是局部秒數 u 的函數；不用 CSS 動畫、rAF、亂數、Date。
   時間一律從 shot.subs（旁白句子的起訖）推，不手寫秒數：TTS 長度變了，動畫跟著走。
   數字一律讀 ctx.calc；顏色一律讀 ctx.C。
   ========================================================================== */
(function () {
'use strict';

/* ---------------------------------------------------------------- 小工具 */
/* 第 k 句旁白的局部開始秒；沒有就用比例估 */
function subT0(shot, k) {
  const s = shot.subs && shot.subs[k];
  if (s) return s.t0 - shot.start;
  const n = Math.max(1, (shot.subs || []).length || 1);
  return 0.25 + (shot.dur - 1.5) * Math.min(k, n) / n;
}
/* 旁白唸完的局部秒（之後是 hold） */
function speechEnd(shot) {
  const S = shot.subs || [];
  if (S.length) return S[S.length - 1].t1 - shot.start;
  return shot.dur - 1.5;
}
/* 以 (cx, cy) 為中心縮放 */
function scaleAt(cx, cy, s) {
  return 'translate(' + A.r2(cx) + ' ' + A.r2(cy) + ') scale(' + A.r3(s) + ') translate(' + A.r2(-cx) + ' ' + A.r2(-cy) + ')';
}
function op(node, k) { A.setA(node, { opacity: A.r3(A.clamp01(k)) }); }
/* 0→1→0 的一下（x 在 [0, w] 內） */
function bump(x, w) { return x <= 0 || x >= w ? 0 : Math.sin(Math.PI * x / w); }

/* ==========================================================================
   第 8 格 ride：按一下，它變成下車點。
   畫什麼：左邊 yoxi 叫車首頁（不動，只有下車點欄位被填）；右邊紅虛線從手機通到遠方 pin，小車沿線滑過去。
   時間：u 0–0.6 進場 → u≈0.5 下車點「點一下」漣漪 → 0.75 填入下車點（淡紅底 0.4 秒亮起再退到 0.35）
        → 第二句開始：車沿虛線 2.5 秒（inOut）滑到 pin、走過的變實線；同時大字淡入。
   ========================================================================== */
ANIM.scene('ride', {
  mount(g, ctx) {
    const C = ctx.C, S = ctx.state;
    S.phone = A.PRIM.phone(g, { x: 160, y: 118, s: .95 });
    /* lib workaround：PRIM.phone 把淡紅底 hl 插在「下車點」小標之後，底色一亮就把小標蓋掉。
       這裡把小標搬到 hl 之上（只換圖層順序，不改任何像素位置）。 */
    (function () {
      const ts = Array.from(S.phone.screen.querySelectorAll('text'));
      const lab = ts.find(t => t.textContent === '下車點'), val = ts.find(t => t.textContent === '去哪裡？');
      if (lab && val) S.phone.screen.insertBefore(lab, val);
    })();
    /* 下車點欄位中心（手機座標 x 195, y 718 → 舞台） */
    S.tap = { x: 160 + 150 * .95, y: 118 + 718 * .95 };
    S.ripple = A.el('circle', { cx: S.tap.x, cy: S.tap.y, r: 0, fill: 'none', stroke: C.navy, 'stroke-width': 4, opacity: 0 }, g);
    S.dot = A.el('circle', { cx: S.tap.x, cy: S.tap.y, r: 14, fill: C.navy, opacity: 0 }, g);

    /* 終點 pin 放在第 7 格結尾 pin 的位置附近（x≈1560、偏下），交叉淡接時不跳 */
    const d = 'M600 600 C 900 560, 1250 800, 1560 790';
    S.dash = A.el('path', { d, fill: 'none', stroke: C.red, 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-dasharray': '2 18', opacity: 0 }, g);
    S.solid = A.el('path', { d, fill: 'none', stroke: C.red, 'stroke-width': 6, 'stroke-linecap': 'round' }, g);
    A.drawPath(S.solid, 0);
    S.carWrap = A.g(g, {});
    A.PRIM.car(S.carWrap, { x: 0, y: -2, s: 1.1 });
    /* pin 疊在車上面：車停在 pin 前面，不蓋住它 */
    S.pin = A.PRIM.pin(g, { x: 1560, y: 790, s: 3.2, state: 'red' });
    S.tag = A.PRIM.tag(g, { x: 1560, y: 680, text: ctx.calc.neiwan.label, fg: C.navy, bg: C.white, size: 30, anchor: 'middle' });
    S.stmt = A.PRIM.statement(g, { x: 1760, y: 270, lines: ['探索的終點，就是【叫車的起點】'], size: 68, anchor: 'end' });
  },
  update(u, ctx, shot) {
    const S = ctx.state, n = ctx.calc.neiwan, T2 = subT0(shot, 1);
    /* 虛線與 pin：一開始就在（接第 7 格的紅虛線與 pin） */
    op(S.dash, A.seg(u, 0, .5));
    op(S.pin, A.seg(u, 0, .4));
    op(S.tag, A.seg(u, .1, .6));
    /* 點一下：漣漪 r 0→70 淡出，中心小點一閃 */
    const rk = A.seg(u, .5, 1.1);
    A.setA(S.ripple, { r: A.r2(70 * rk), opacity: A.r3(u < .5 ? 0 : .8 * (1 - rk)) });
    op(S.dot, .35 * bump(u - .45, .5));
    /* 下車點：0.75 秒填入；淡紅底 0.4 秒亮到 1，再退到 0.35 停住 */
    if (u < .75) S.phone.setDropoff('', 0);
    else {
      const k = u < 1.15 ? A.seg(u, .75, 1.15) : A.lerp(1, .35, A.seg(u, 1.15, 1.75));
      S.phone.setDropoff(n.label + ' · 約 $' + n.fare + ' · ' + n.min + ' 分', k);
    }
    /* 車：填好後出現在起點；第二句開始沿虛線滑到 pin */
    const ck = A.seg(u, T2, T2 + 2.5, A.E.inOut);
    /* 車在線上的位置：從 4% 走到 90%（起點不壓手機、終點停在 pin 前）；車身只輕微跟著坡度傾斜 */
    const cp = A.lerp(.04, .9, ck);
    const p = A.pointAt(S.solid, cp), q = A.pointAt(S.solid, Math.min(1, cp + .01)), q0 = A.pointAt(S.solid, Math.max(0, cp - .01));
    const ang = Math.max(-8, Math.min(8, .6 * Math.atan2(q.y - q0.y, q.x - q0.x) * 180 / Math.PI));
    A.setA(S.carWrap, { transform: A.tr(p.x, p.y, 1, ang), opacity: A.r3(A.seg(u, 1.2, 1.7)) });
    A.drawPath(S.solid, A.lerp(0, 1, A.seg(u, T2, T2 + 2.7, A.E.inOut)));
    /* 抵達：pin 彈一下 */
    const arrive = u - (T2 + 2.5);
    A.PRIM.pinState(S.pin, 'red', 1 + .3 * bump(arrive, .5));
    /* 大字 */
    const sk = A.seg(u, T2 + .2, T2 + .8);
    op(S.stmt, sk);
    A.setA(S.stmt, { transform: A.tr(0, 16 * (1 - sk)) });
  },
});

/* ==========================================================================
   第 9 格 gold：搭 yoxi 抵達的地方，明信片鑲金框；點數回到和泰 Points。
   畫什麼：中央偏左一張明信片（同 seed 兩張疊：無框版＋金框版）；右側「和泰 Points」圓環；底部一排 5 張收藏。
   時間：0–0.6 明信片進場 → 第一句尾段（句末前 1.2 秒）金框 0.6 秒 outBack 淡入、四角金線合攏
        → 第二句：4 枚硬幣錯開 0.15 秒飛進圓環，到達時圓環 pop → 第二句後半 5 張小明信片依序淡入
        → hold：大字右上淡入。
   ========================================================================== */
ANIM.scene('gold', {
  mount(g, ctx) {
    const C = ctx.C, S = ctx.state;
    const W = 640, H = 427;
    S.cx = 600; S.cy = 400; S.W = W; S.H = H;
    S.cardWrap = A.g(g, {});
    S.plain = A.PRIM.postcard(A.g(S.cardWrap), { x: S.cx - W / 2, y: S.cy - H / 2, w: W, h: H, seed: 28, gold: false, label: true });
    S.goldWrap = A.g(S.cardWrap, { opacity: 0 });
    A.PRIM.postcard(S.goldWrap, { x: S.cx - W / 2, y: S.cy - H / 2, w: W, h: H, seed: 28, gold: true, label: true });
    /* 四角金色短線（L 形），從外往內合攏 */
    const e = Math.round(W * .035) + 14, L = 70;
    const x0 = S.cx - W / 2 - e, x1 = S.cx + W / 2 + e, y0 = S.cy - H / 2 - e, y1 = S.cy + H / 2 + e;
    S.corners = [
      { d: `M${x0} ${y0 + L} V${y0} H${x0 + L}`, dx: -1, dy: -1 },
      { d: `M${x1 - L} ${y0} H${x1} V${y0 + L}`, dx: 1, dy: -1 },
      { d: `M${x1} ${y1 - L} V${y1} H${x1 - L}`, dx: 1, dy: 1 },
      { d: `M${x0 + L} ${y1} H${x0} V${y1 - L}`, dx: -1, dy: 1 },
    ].map(c => {
      c.el = A.el('path', { d: c.d, fill: 'none', stroke: C.gold, 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0 }, g);
      return c;
    });
    /* 和泰 Points 圓環 */
    S.ring = { x: 1490, y: 430 };
    S.ringG = A.g(g, {});
    A.el('circle', { cx: S.ring.x, cy: S.ring.y, r: 120, fill: C.white, stroke: C.navy, 'stroke-width': 4 }, S.ringG);
    A.text(S.ringG, S.ring.x, S.ring.y + 11, '和泰 Points', { 'font-size': 32, 'font-weight': 700, fill: C.navy, 'text-anchor': 'middle' });
    /* 硬幣 */
    S.coins = [0, 1, 2, 3].map(() => A.setA(A.PRIM.coin(g, { x: 0, y: 0, r: 26 }), { opacity: 0 }));
    /* 底部一排收藏 */
    const seeds = [3, 11, 28, 41, 56], cw = 200, ch = 133, gap = 40;
    const rx0 = 960 - (cw * 5 + gap * 4) / 2;
    S.row = seeds.map((seed, i) => {
      const w = A.g(g, { opacity: 0 });
      A.PRIM.postcard(w, { x: rx0 + i * (cw + gap), y: 740, w: cw, h: ch, seed, gold: i === 2, label: false });
      return w;
    });
    S.stmt = A.PRIM.statement(g, { x: 1840, y: 150, lines: ['去遠方，變成一種【收藏】'], size: 72, anchor: 'end' });
  },
  update(u, ctx, shot) {
    const S = ctx.state, T1 = subT0(shot, 0), T2 = subT0(shot, 1), END = speechEnd(shot);
    ctx.credit('ai');
    /* 進場：明信片由下浮上 */
    const ink = A.seg(u, 0, .6);
    /* 金框：第一句最後 1.2 秒（「鑲金框」附近） */
    const tg = Math.max(T1 + 1, T2 - 1.2);
    const glin = A.seg(u, tg, tg + .6, A.E.linear);
    op(S.goldWrap, glin);
    /* 金框亮起時輕微放大 1.0→1.04→1.0（outBack 的回彈感用 bump 取代，保證收回 1.0） */
    const s = 1 + .04 * bump(u - tg, .9);
    A.setA(S.cardWrap, { transform: A.tr(0, 30 * (1 - ink)) + ' ' + scaleAt(S.cx, S.cy, s), opacity: A.r3(ink) });
    /* 四角金線：金框前 0.8 秒開始畫，同時從外往內合攏；合攏後淡出，交給金框 */
    const ck = A.seg(u, tg - .8, tg + .3);
    S.corners.forEach(c => {
      A.drawPath(c.el, ck);
      const off = 70 * (1 - ck);
      A.setA(c.el, { transform: A.tr(c.dx * off, c.dy * off), opacity: A.r3(u < tg - .8 ? 0 : 1 - A.seg(u, tg + .4, tg + .8, A.E.in)) });
    });
    /* 圓環：跟著明信片進場；每枚硬幣到達時 pop */
    op(S.ringG, A.seg(u, .2, .8));
    let pop = 0;
    const from = { x: S.cx + S.W / 2 - 60, y: S.cy - 40 };
    S.coins.forEach((c, i) => {
      const t0 = T2 + .3 + .15 * i, fl = .9;
      const k = A.seg(u, t0, t0 + fl, A.E.inOut);
      const x = A.lerp(from.x, S.ring.x, k), y = A.lerp(from.y, S.ring.y, k) - 140 * Math.sin(Math.PI * k);
      const vis = u < t0 ? 0 : u < t0 + fl - .15 ? A.seg(u, t0, t0 + .15) : 1 - A.seg(u, t0 + fl - .15, t0 + fl + .1);   /* 快到圓環就淡掉，不壓到字 */
      A.setA(c, { transform: A.tr(x, y, 1 - .4 * A.seg(u, t0 + fl - .1, t0 + fl + .2)), opacity: A.r3(vis) });
      pop += bump(u - (t0 + fl), .3);
    });
    A.setA(S.ringG, { transform: scaleAt(S.ring.x, S.ring.y, 1 + .08 * Math.min(1, pop)) });
    /* 收藏列：第二句後半依序淡入 */
    const r0 = T2 + (END - T2) * .5;
    S.row.forEach((w, i) => {
      const k = A.seg(u, r0 + .2 * i, r0 + .2 * i + .6);
      A.setA(w, { opacity: A.r3(k), transform: A.tr(0, 24 * (1 - k)) });
    });
    /* hold：大字 */
    const sk = A.seg(u, END, END + .6);
    op(S.stmt, sk);
    A.setA(S.stmt, { transform: A.tr(0, 16 * (1 - sk)) });
  },
});

/* ==========================================================================
   第 10 格 night：晚上，今天走過的路自己變成一則回顧；日誌只有你，週回顧傳給爸媽。
   畫什麼：夜色新竹地圖（night set、不用霧）；奶油色路線 車站→東門市場→城隍廟→紅磚（地圖座標），
          畫到每個轉折點 pop 一張小卡（共四格＝四幕）。第二句：路線變暗，前面分左右兩張卡。
   時間：第一句期間（0.4 → 第二句前 0.4）路線畫出；第二句開始地圖壓暗、兩張卡依序淡入（左先、右晚 0.35 秒）。
   ========================================================================== */
ANIM.scene('night', {
  mount(g, ctx) {
    const C = ctx.C, S = ctx.state;
    A.setA(ctx.bg, { opacity: 0 });
    S.routeG = A.g(g, {});
    S.route = A.el('path', { d: 'M0 0', fill: 'none', stroke: C.cream, 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, S.routeG);
    S.dots = [0, 1, 2, 3].map(() => A.el('circle', { r: 9, fill: C.cream, opacity: 0 }, S.routeG));
    S.mini = [0, 1, 2, 3].map(i => {
      const w = A.g(S.routeG, { opacity: 0 });
      A.PRIM.card(w, { x: -75, y: -50, w: 150, h: 100, r: 8, fill: C.white });
      A.PRIM.postcard(w, { x: -67, y: -42, w: 134, h: 84, seed: 60 + i * 7, label: false });
      return w;
    });
    /* 第二句：地圖壓暗 */
    S.dim = A.el('rect', { x: 0, y: 0, width: A.W, height: A.H, fill: C.navy, opacity: 0 }, g);
    /* 左卡：日誌 · 只有你 */
    const cw = 640, ch = 420, cy = 390, lx = 960 - 30 - cw, rx = 960 + 30;
    S.left = A.g(g, { opacity: 0 });
    A.PRIM.card(S.left, { x: lx, y: cy, w: cw, h: ch, r: 8, fill: C.navySoft });
    A.text(S.left, lx + 48, cy + 88, '日誌 · 只有你', { 'font-size': 44, 'font-weight': 700, fill: C.white });
    A.icon(A.g(S.left, { fill: C.white, color: C.white }), 'lock', lx + cw - 48 - 56, cy + 36, 56);
    /* 四幕：四列（小方塊＋幾條字的長條，不放真字） */
    [0, 1, 2, 3].forEach(i => {
      const y = cy + 140 + i * 56;
      A.el('rect', { x: lx + 48, y, width: 36, height: 36, rx: 6, fill: C.cream, opacity: .9 }, S.left);
      A.el('rect', { x: lx + 104, y: y + 6, width: 300 - i * 40, height: 10, rx: 5, fill: C.slateLite, opacity: .8 }, S.left);
      A.el('rect', { x: lx + 104, y: y + 24, width: 200 + (i % 2) * 60, height: 8, rx: 4, fill: C.slateLite, opacity: .45 }, S.left);
    });
    A.text(S.left, lx + 48, cy + ch - 28, '沒有分享鍵', { 'font-size': 26, 'font-weight': 500, fill: C.slateLite });
    /* 右卡：週回顧 · 傳給爸媽（長輩圖） */
    S.right = A.g(g, { opacity: 0 });
    A.PRIM.card(S.right, { x: rx, y: cy, w: cw, h: ch, r: 8, fill: C.cream });
    A.text(S.right, rx + 48, cy + 88, '週回顧 · 傳給爸媽', { 'font-size': 44, 'font-weight': 700, fill: C.navy });
    A.icon(S.right, 'elder', rx + cw - 48 - 56, cy + 36, 56);
    A.PRIM.postcard(S.right, { x: rx + 48, y: cy + 124, w: cw - 96, h: 190, seed: 33, label: false });
    A.text(S.right, rx + cw / 2, cy + ch - 34, '週末去了海邊', { 'font-size': 60, 'font-weight': 900, fill: C.navy, 'text-anchor': 'middle' });
  },
  update(u, ctx, shot) {
    const S = ctx.state, M = ctx.map, T2 = subT0(shot, 1);
    ctx.credit('ai');
    /* 地點座標（地圖座標，與視角無關）只算一次 */
    if (!S.pts) {
      M.view({ set: 'night' });
      S.pts = ['station', 'market', 'temple', 'brick'].map(id => M.place(id));
      const xs = S.pts.map(p => p.px), ys = S.pts.map(p => p.py);
      S.c = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
      const bw = Math.max(1, Math.max(...xs) - Math.min(...xs)), bh = Math.max(1, Math.max(...ys) - Math.min(...ys));
      S.z = Math.max(.8, Math.min(1.6, 1100 / bw, 560 / bh));
      /* 每個轉折點在全長裡的位置（地圖座標下的比例，縮放不影響） */
      let acc = 0; S.frac = [0];
      for (let i = 1; i < S.pts.length; i++) { acc += Math.hypot(S.pts[i].px - S.pts[i - 1].px, S.pts[i].py - S.pts[i - 1].py); S.frac.push(acc); }
      S.frac = S.frac.map(f => f / acc);
    }
    /* 鏡頭：很慢地推近（整格 +4%），略往上抬給字幕讓位 */
    const z = S.z * (1 + .04 * u / shot.dur);
    /* 地圖層在所有鏡頭之下、不跟著這格的 g 淡入淡出：自己在頭尾各 fade 秒把它淡進淡出，
       交叉淡接時才不會露出一張全亮的地圖（底下是舞台的 #bg）。 */
    const F = (window.TIMELINE && TIMELINE.fade) || .5;
    const mo = A.seg(u, 0, F, A.E.linear) * (1 - A.seg(u, shot.dur, shot.dur + F, A.E.linear));
    M.view({ set: 'night', cx: S.c.x, cy: S.c.y + 40 / z, zoom: z, opacity: mo });
    M.fog([], 0);
    /* 路線 */
    A.setA(S.route, { d: M.route(S.pts) });
    const dk = A.seg(u, .4, Math.max(1.4, T2 - .4), A.E.inOut);
    A.drawPath(S.route, dk);
    S.pts.forEach((p, i) => {
      const s = M.toStage(p.px, p.py);
      const passed = dk >= S.frac[i] - 1e-3;
      A.setA(S.dots[i], { cx: A.r2(s[0]), cy: A.r2(s[1]), opacity: passed ? 1 : 0 });
      /* 小卡：放在點旁邊不擋路線的一側（方向依實際路線形狀挑：車站右、東門市場右、城隍廟左、紅磚上）；
         從路線畫到這點的那一刻起 0.5 秒 outBack 彈出 */
      const dir = CARD_DIR[i];
      const ox = dir[0] * 150, oy = dir[1] * 115;
      const k = passed ? A.E.outBack(A.clamp01(pk(u, S.frac[i], T2) / .5)) : 0;
      A.setA(S.mini[i], { transform: A.tr(s[0] + ox * (.5 + .5 * k), s[1] + oy * (.5 + .5 * k), .4 + .6 * k), opacity: A.r3(passed ? Math.min(1, k * 1.5) : 0) });
    });
    /* 第二句：地圖壓暗、路線退到後面、兩張卡淡入 */
    const bk = A.seg(u, T2 - .1, T2 + .5);
    op(S.dim, .5 * bk);
    op(S.routeG, 1 - .65 * bk);
    const lk = A.seg(u, T2, T2 + .6), rk = A.seg(u, T2 + .35, T2 + .95);
    A.setA(S.left, { opacity: A.r3(lk), transform: A.tr(0, 30 * (1 - lk)) });
    A.setA(S.right, { opacity: A.r3(rk), transform: A.tr(0, 30 * (1 - rk)) });
  },
});
/* 第 10 格四張小卡相對轉折點的方向（station, market, temple, brick） */
const CARD_DIR = [[.9, .45], [1, 0], [-1, 0], [0, -1]];
/* 小卡 pop 的經過秒數：路線畫到 frac 的那一刻起算（由 inOut 反推，免得存狀態）。 */
function pk(u, frac, T2) {
  const a = .4, b = Math.max(1.4, T2 - .4);
  /* 二分找 inOut(x) = frac 的 x */
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (A.E.inOut(m) < frac) lo = m; else hi = m; }
  const tHit = a + (b - a) * lo;
  return u - tHit;
}

/* ==========================================================================
   第 11 格 ai：AI 在後面安靜做四件事。
   畫什麼：中央一個「城市」圓（奶油底、白路、海軍藍小房子、紅 pin），頂上一個「AI」小標；
          四個角色在上／右／下／左依序亮起：推薦、內容、明信片、回顧，各一條海軍藍細線從圓心畫出。
          （上下兩個的標題放在圓的右邊，免得撞到大字與字幕。）
   時間：0–0.6 城市圓進場；第二句開始 +0／0.8／1.6／2.4 秒四個角色依序亮起；第三句大字在上方淡入。
   ========================================================================== */
ANIM.scene('ai', {
  mount(g, ctx) {
    const C = ctx.C, S = ctx.state;
    const cx = 960, cy = 560, R = 150;
    S.c = { x: cx, y: cy };
    S.lines = A.g(g, {});
    /* 城市圓 */
    S.city = A.g(g, {});
    A.el('circle', { cx, cy, r: R, fill: C.cream }, S.city);
    const cp = A.el('clipPath', { id: 'aiCityClip' }, A.el('defs', {}, S.city));
    A.el('circle', { cx, cy, r: R }, cp);
    const inner = A.g(S.city, { 'clip-path': 'url(#aiCityClip)' });
    [[-R, -40, R, 10], [-R, 60, R, 30], [-50, -R, -20, R], [60, -R, 40, R]].forEach(l =>
      A.el('line', { x1: cx + l[0], y1: cy + l[1], x2: cx + l[2], y2: cy + l[3], stroke: C.white, 'stroke-width': 12, 'stroke-linecap': 'round' }, inner));
    [[-110, -100, 40, 34], [-10, -120, 44, 40], [90, -80, 36, 44], [-120, 0, 44, 40], [70, 70, 34, 30], [-20, 80, 44, 36], [-110, 80, 36, 30]].forEach(b =>
      A.el('rect', { x: cx + b[0], y: cy + b[1], width: b[2], height: b[3], rx: 6, fill: C.navy }, inner));
    S.pin = A.PRIM.pin(S.city, { x: cx + 12, y: cy + 36, s: 3, state: 'red' });
    S.tag = A.PRIM.tag(g, { x: cx, y: cy - R - 8, text: 'AI', fg: C.white, bg: C.navy, size: 26, anchor: 'middle' });
    /* 四個角色：上、右、下、左 */
    const pos = [
      { x: cx, y: 290, side: 'right' },
      { x: 1540, y: cy, side: 'below' },
      { x: cx, y: 830, side: 'right' },
      { x: 380, y: cy, side: 'below' },
    ];
    const defs = [
      { title: '推薦', sub: '挑今天的地方', icon: 'place' },
      { title: '內容', sub: 'AI 草稿 → 編輯審 → 有出處才上架', icon: 'postcard' },
      { title: '明信片', sub: 'AI 生成示意', icon: 'brush' },
      { title: '回顧', sub: '一天寫成四幕', icon: 'steps' },
    ];
    const r = 70;
    S.roles = defs.map((d, i) => {
      const p = pos[i];
      /* 線：從圓心到角色（在城市圓底下，只露出外段） */
      const line = A.el('path', { d: `M${cx} ${cy} L${p.x} ${p.y}`, fill: 'none', stroke: C.navy, 'stroke-width': 3, 'stroke-linecap': 'round' }, S.lines);
      A.drawPath(line, 0);
      const ghost = A.el('circle', { cx: p.x, cy: p.y, r, fill: 'none', stroke: C.slateLite, 'stroke-width': 3, 'stroke-dasharray': '4 10', opacity: 0 }, g);
      const node = A.g(g, { opacity: 0 });
      A.el('circle', { cx: p.x, cy: p.y, r, fill: C.white }, node);
      if (d.icon === 'brush') {
        /* 自己畫一支畫筆：海軍藍筆桿、淺灰箍、紅筆尖 */
        const b = A.g(node, { transform: A.tr(p.x, p.y, 1, 40) });
        A.el('rect', { x: -7, y: -40, width: 14, height: 44, rx: 4, fill: C.navy }, b);
        A.el('rect', { x: -9, y: 2, width: 18, height: 10, rx: 4, fill: C.slateLite }, b);
        A.el('path', { d: 'M-9 12 Q-10 30 0 40 Q10 30 9 12 Z', fill: C.red }, b);
      } else {
        A.icon(node, d.icon, p.x - 38, p.y - 38, 76);
      }
      const lab = A.g(g, { opacity: 0 });
      if (p.side === 'right') {
        A.text(lab, p.x + r + 28, p.y - 6, d.title, { 'font-size': 36, 'font-weight': 900, fill: C.navy });
        A.text(lab, p.x + r + 28, p.y + 32, d.sub, { 'font-size': 26, 'font-weight': 500, fill: C.slate });
      } else {
        A.text(lab, p.x, p.y + r + 50, d.title, { 'font-size': 36, 'font-weight': 900, fill: C.navy, 'text-anchor': 'middle' });
        A.text(lab, p.x, p.y + r + 90, d.sub, { 'font-size': 26, 'font-weight': 500, fill: C.slate, 'text-anchor': 'middle' });
      }
      return { p, line, ghost, node, lab };
    });
    S.stmt = A.PRIM.statement(g, { x: 960, y: 150, lines: ['它不搶戲，只讓每一天都有【一個理由】'], size: 64, anchor: 'middle' });
  },
  update(u, ctx, shot) {
    const S = ctx.state, T2 = subT0(shot, 1), T3 = subT0(shot, 2);
    const ik = A.seg(u, 0, .6);
    A.setA(S.city, { opacity: A.r3(ik), transform: scaleAt(S.c.x, S.c.y, .9 + .1 * ik) });
    op(S.tag, A.seg(u, .2, .7));
    S.roles.forEach((r, i) => {
      const ti = T2 + .8 * i;
      op(r.ghost, .6 * A.seg(u, .3, .9) * (1 - A.seg(u, ti, ti + .3)));
      A.drawPath(r.line, A.seg(u, ti - .3, ti + .2));
      const k = A.seg(u, ti, ti + .5, A.E.outBack), kl = A.seg(u, ti, ti + .2, A.E.linear);
      A.setA(r.node, { opacity: A.r3(kl), transform: scaleAt(r.p.x, r.p.y, .6 + .4 * k) });
      const lk = A.seg(u, ti + .15, ti + .6);
      A.setA(r.lab, { opacity: A.r3(lk), transform: A.tr(0, 12 * (1 - lk)) });
    });
    const sk = A.seg(u, T3, T3 + .6);
    op(S.stmt, sk);
    A.setA(S.stmt, { transform: A.tr(0, 16 * (1 - sk)) });
  },
});

/* ==========================================================================
   第 12 格 roadmap：第 0 步不動叫車首頁，新竹先試；看到數字再走下一步。
   畫什麼：一條從左到右的路（海軍藍路面＋白色中線虛線），五個里程碑讀 calc.roadmap（step、name、when），
          路面長出短桿與小牌；第 0 步紅字，下方一支不動的叫車首頁小手機＋「叫車首頁不動」標籤；
          里程碑之間四道閘門＋「看到數字才開」。
   時間：第一句期間（0.1 → 第二句前 0.3）路從左畫到右（用 clipPath 揭開，虛線才不會被 drawPath 蓋掉），
        路面經過哪個里程碑它就立起；第二句大字淡入、閘門每 0.5 秒一道依序淡入。
   ========================================================================== */
ANIM.scene('roadmap', {
  mount(g, ctx) {
    const C = ctx.C, S = ctx.state, calc = ctx.calc;
    const X0 = 160, X1 = 1760, Y = 640;
    S.X0 = X0; S.X1 = X1;
    const cp = A.el('clipPath', { id: 'rmRoadClip' }, A.el('defs', {}, g));
    S.clip = A.el('rect', { x: X0 - 20, y: Y - 40, width: 0, height: 80 }, cp);
    const road = A.g(g, { 'clip-path': 'url(#rmRoadClip)' });
    A.el('line', { x1: X0, y1: Y, x2: X1, y2: Y, stroke: C.navy, 'stroke-width': 26, 'stroke-linecap': 'round' }, road);
    A.el('line', { x1: X0 + 20, y1: Y, x2: X1 - 20, y2: Y, stroke: C.white, 'stroke-width': 4, 'stroke-dasharray': '26 22' }, road);
    const steps = calc.roadmap || [];
    const n = Math.max(1, steps.length), span = (X1 - X0) / n;
    S.ms = steps.map((st, i) => {
      const x = X0 + span * (i + .5);
      const grp = A.g(g, { opacity: 0 });
      const pole = A.el('rect', { x: -4, y: -140, width: 8, height: 140, rx: 4, fill: C.slate }, grp);
      const sign = A.g(grp, {});
      const sw = Math.min(span - 50, 270), sh = 100;
      A.PRIM.card(sign, { x: -sw / 2, y: -sh, w: sw, h: sh, r: 8, fill: C.white, stroke: i === 0 ? C.red : C.line, strokeWidth: i === 0 ? 3 : 2 });
      A.text(sign, 0, -sh + 44, st.step + ' ' + st.name, { 'font-size': 30, 'font-weight': 900, fill: i === 0 ? C.red : C.navy, 'text-anchor': 'middle' });
      A.text(sign, 0, -sh + 80, st.when, { 'font-size': 22, fill: C.slate, 'text-anchor': 'middle' });
      return { x, grp, pole, sign, frac: (x - X0) / (X1 - X0) };
    });
    /* 第 0 步：不動的叫車首頁小手機＋標籤 */
    S.phoneG = A.g(g, { opacity: 0 });
    if (S.ms[0]) {
      A.PRIM.phone(S.phoneG, { x: S.ms[0].x - 110, y: Y + 50, s: .22 });
      S.p0tag = A.PRIM.tag(S.phoneG, { x: S.ms[0].x - 10, y: Y + 150, text: '叫車首頁不動', fg: C.navy, bg: C.white, size: 24 });
    }
    /* 閘門：里程碑之間 */
    S.gates = [];
    for (let i = 0; i < S.ms.length - 1; i++) {
      const x = (S.ms[i].x + S.ms[i + 1].x) / 2;
      const gg = A.g(g, { opacity: 0 });
      A.el('rect', { x: x - 34, y: Y - 64, width: 7, height: 64, rx: 3, fill: C.slateLite }, gg);
      A.el('rect', { x: x + 27, y: Y - 64, width: 7, height: 64, rx: 3, fill: C.slateLite }, gg);
      A.el('rect', { x: x - 40, y: Y - 58, width: 80, height: 9, rx: 4, fill: C.slateLite }, gg);
      A.text(gg, x, Y - 80, '看到數字才開', { 'font-size': 22, fill: C.slate, 'text-anchor': 'middle' });
      S.gates.push(gg);
    }
    S.Y = Y;
    S.stmt = A.PRIM.statement(g, { x: 960, y: 200, lines: ['第 0 步【不動】叫車首頁 · ' + calc.pilotCity + ' ' + calc.pilotWeeks + ' 週'], size: 64, anchor: 'middle' });
  },
  update(u, ctx, shot) {
    const S = ctx.state, T2 = subT0(shot, 1);
    const rEnd = Math.max(1.2, T2 - .3);
    const rk = A.seg(u, .1, rEnd, A.E.inOut);
    A.setA(S.clip, { width: A.r2((S.X1 - S.X0 + 40) * rk) });
    /* 里程碑：路面經過就立起（桿子往上長、牌子跟著升） */
    S.ms.forEach(m => {
      /* 反推路面到達這個 x 的時刻 */
      let lo = 0, hi = 1;
      for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (A.E.inOut(mid) < m.frac) lo = mid; else hi = mid; }
      const tHit = .1 + (rEnd - .1) * lo;
      const k = A.seg(u, tHit - .1, tHit + .5);
      const kb = A.seg(u, tHit - .1, tHit + .5, A.E.outBack);
      A.setA(m.grp, { opacity: A.r3(k), transform: A.tr(m.x, S.Y) });
      A.setA(m.pole, { height: A.r2(140 * k), y: A.r2(-140 * k) });
      A.setA(m.sign, { transform: A.tr(0, -140 * k + 0 * kb) + ' ' + scaleAt(0, 0, .8 + .2 * kb) });
    });
    if (S.ms[0]) {
      const pk = A.seg(u, 1.0, 1.6);
      A.setA(S.phoneG, { opacity: A.r3(pk), transform: A.tr(0, 16 * (1 - pk)) });
    }
    /* 第二句：大字＋閘門依序 */
    const sk = A.seg(u, T2, T2 + .6);
    op(S.stmt, sk);
    A.setA(S.stmt, { transform: A.tr(0, 16 * (1 - sk)) });
    S.gates.forEach((gg, i) => {
      const k = A.seg(u, T2 + .3 + .5 * i, T2 + .8 + .5 * i);
      A.setA(gg, { opacity: A.r3(k), transform: A.tr(0, 14 * (1 - k)) });
    });
  },
});

/* ==========================================================================
   第 13 格 end：結尾卡。
   畫什麼：海軍藍底；字標置中偏上；兩行標語；hold 時底部三行小字（題目全名、署名、團隊）。
   時間：0.1–0.8 字標由 0.92 outBack 放大淡入 → 第二句白字標語 → 第三句奶油色標語 → 旁白結束後小字淡入。
   這格自己畫署名，不呼叫 ctx.credit。
   ========================================================================== */
ANIM.scene('end', {
  mount(g, ctx) {
    const C = ctx.C, S = ctx.state;
    S.wmG = A.g(g, {});
    A.PRIM.wordmark(S.wmG, { x: 960, y: 430, size: 150, anchor: 'middle', dark: true });
    S.l2 = A.text(g, 960, 580, '不搭車的日子，也有打開 yoxi 的理由', { 'font-size': 44, 'font-weight': 700, fill: C.white, 'text-anchor': 'middle', opacity: 0 });
    S.l3 = A.text(g, 960, 656, '而搭車的日子，會因此多起來', { 'font-size': 44, 'font-weight': 700, fill: C.cream, 'text-anchor': 'middle', opacity: 0 });
    S.foot = A.g(g, { opacity: 0 });
    ['yoxi：不搭車，也打開 yoxi —— 打造高頻互動的AI出行夥伴',
     '畫面為向量示意 · 明信片為 AI 生成示意 · 地圖資料 © OpenStreetMap 貢獻者（ODbL）',
     'yoxi_城事_2026 和泰 AI 黑客松'].forEach((s, i) =>
      A.text(S.foot, 960, 850 + i * 40, s, { 'font-size': 22, fill: C.slateLite, 'text-anchor': 'middle' }));
  },
  update(u, ctx, shot) {
    const S = ctx.state, T2 = subT0(shot, 1), T3 = subT0(shot, 2), END = speechEnd(shot);
    const k = A.seg(u, .1, .8, A.E.outBack), kl = A.seg(u, .1, .5, A.E.linear);
    A.setA(S.wmG, { opacity: A.r3(kl), transform: scaleAt(960, 380, .92 + .08 * k) });
    const k2 = A.seg(u, T2, T2 + .6), k3 = A.seg(u, T3, T3 + .6), kf = A.seg(u, END, END + .6);
    A.setA(S.l2, { opacity: A.r3(k2), transform: A.tr(0, 14 * (1 - k2)) });
    A.setA(S.l3, { opacity: A.r3(k3), transform: A.tr(0, 14 * (1 - k3)) });
    op(S.foot, kf);
  },
});

})();
