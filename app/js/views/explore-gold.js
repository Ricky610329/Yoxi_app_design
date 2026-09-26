/* ==========================================================================
   yoxi 城事 web app — 金框明信片的金粉（全 app 共用；不註冊畫面）
   契約：app/ARCHITECTURE.md §7（金框的明信片在哪裡顯示，都有金框和金粉）。
   載入順序：explore-fx.js → explore-cards.js → explore-gold.js → explore.js（都在 album.js 之前）。

   回答什麼：金框是最難拿到的一款。抽到的那一刻有整套特效（explore-unlock.js）；收下之後，
             在收藏、明信片詳情、獎章、回顧、叫車面板看到它，框的邊緣也一直散出細細的金粉。
             捲動、拖面板、換頁的時候，金粉帶著慣性，跟著畫面往上或往下飄。
   怎麼用：在「畫金框的那個元素」加 data-gold-aura：框畫在哪裡，金粉就從那裡的邊緣冒出來。
           [data-card-art] 的金框卡沒有人標的話，explore-cards.js 的 paintCardArt 會自己補上
           data-gold-aura＋.card-gold（通用的框，樣式在 explore.css）。
   提供（APP.fx.gold）：
     refresh()           重新掃一次畫面（一般不用叫：body 上有 MutationObserver）
     tracked()           追蹤中的金框卡數（測試用）
     particles()         畫面上的金粉顆數（測試用）
     step(p, ax, ay, dt) 一顆金粉在速度 (ax, ay) 的空氣裡走 dt 秒（純函式，測試用）

   物理（每顆金粉記在畫面座標、有自己的速度）：
   - 浮力往上、一點亂流；相對空氣有阻力（DRAG）。
   - 卡片周圍的空氣跟著卡片走：每幀量卡片的位置得到卡片速度，空氣速度＝卡片速度 × CARRY。
     所以往上捲，本來飄著的金粉先落在後面、再被帶著往上；停下來時帶著慣性多飄一段才慢下來。
   - 卡片動得越快，邊緣灑出來的越多（SHAKE）。
   - 一幀跳太遠（重排、換版面）不算速度：金粉跟著平移，不會被甩飛。
   - 轉了角度的卡（收藏首頁的疊卡、叫車面板的卡）照它的角度沿著邊冒，不是沿著外接矩形。

   刻意沒有的東西：
   - 一張卡一張 canvas：整台手機只有一張，掛在 .device，z-index 97：在所有畫面層之上
     （抽卡與每日回顧是 95 的全螢幕層、浮起來看的卡片 80，金框卡也會出現在這些層裡）。
     蓋在卡片上的東西（分享面板、對話框）擋金粉靠的是下一條的 elementFromPoint，不是 z-index。
     每張卡的金粉裁在它自己的捲動範圍裡（overflow 不是 visible 的祖先），不會飄到頁首、tab bar 上。
   - 被蓋住的邊不冒金粉：冒之前用 elementFromPoint 確認那一點最上面是這張卡（疊卡、面板、浮層都擋得住）；
     整張被蓋住或拿掉的卡，已經飄出去的金粉加速淡掉。
   - 減少動態效果（APP.reduceMotion：?still=1 或系統設定）：不噴金粉、不建 canvas，框照舊。
   - 看不到任何金框卡時不跑 rAF（IntersectionObserver）；分頁在背景時瀏覽器本來就停 rAF。
   - 色碼：顏色從 tokens 讀（--gold、--gold-lite、--yoxi-navy、--yoxi-white）。
     金點用一般疊色（白底、照片上都看得到），暗底另外墊一圈加亮的光暈。
   ========================================================================== */

(function () {
'use strict';

const APP = window.APP;
if (!APP || !APP.fx) return;
const F = APP.fx;

const SEL = '[data-gold-aura]';
const MAX = 260;          /* 全畫面最多幾顆 */
const DENSITY = .034;     /* 靜止時每 px 周長每秒冒幾顆（收藏首頁 89×126 的疊卡約 15 顆／秒） */
const SHAKE = 350;        /* 卡片每秒動 SHAKE px 就多灑一倍，最多多三倍 */
const CARRY = .85;        /* 卡片速度有幾成帶給周圍的空氣 */
const DRAG = 5.5;         /* 金粉相對空氣的阻力（1/s）：越大越黏著卡片，越小越會甩出去 */
const BUOY = -100;        /* 浮力（px/s²，負的往上）；靜止的空氣裡終端速度 BUOY / DRAG ≈ 每秒往上 18 px */
const WANDER = 26;        /* 左右的亂流（px/s²） */
const JUMP = 160;         /* 一幀位移超過這麼多 px 當成版面跳動，不當成速度 */
const VMAX = 2600;        /* 卡片速度上限（px/s） */

let canvas = null, ctx = null, raf = 0, last = 0, frame = 0, total = 0;
let W = 0, H = 0, dpr = 1, C = null;
let io = null, look = null, queued = false;
const srcs = [];          /* 追蹤中的卡（含已經拿掉、金粉還沒散完的） */

function rnd(a, b) { return a + Math.random() * (b - a); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function clampV(v) { return Math.max(-VMAX, Math.min(VMAX, v)); }

/* 金粉的樣子：每一顆都是「金屬的金點」（亮的中心、金色、深金的邊），一般疊色，白底、照片、深色底都看得到。
   暗底另外在後面墊一圈加亮的光暈（F.sprite 的 glow），看起來會發光。四芒的閃光也是金色的，不是白的。
   小圖只畫一次（32×32），之後每幀 drawImage。 */
function metal(kind, rim) {
  const S = 32, h = S / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const gold = F.color('--gold'), lite = F.color('--gold-lite'), white = F.color('--yoxi-white');
  const hi = F.mix(lite, white, .45);
  if (kind === 'star') {
    const glow = g.createRadialGradient(h, h, 0, h, h, h);
    glow.addColorStop(0, F.rgba(hi, .9));
    glow.addColorStop(.2, F.rgba(gold, .5));
    glow.addColorStop(1, F.rgba(gold, 0));
    g.fillStyle = glow;
    g.fillRect(0, 0, S, S);
    const arm = g.createRadialGradient(h, h, 0, h, h, h);
    arm.addColorStop(0, F.rgba(hi, 1));
    arm.addColorStop(.35, F.rgba(gold, 1));
    arm.addColorStop(1, F.rgba(rim, .9));
    g.fillStyle = arm;
    [0, Math.PI / 2].forEach(function (r) {
      g.save(); g.translate(h, h); g.rotate(r);
      g.beginPath(); g.moveTo(-h, 0); g.lineTo(0, -2); g.lineTo(h, 0); g.lineTo(0, 2); g.closePath(); g.fill();
      g.restore();
    });
  } else {
    const dot = g.createRadialGradient(h * .8, h * .8, 0, h, h, h);
    dot.addColorStop(0, F.rgba(hi, 1));
    dot.addColorStop(.32, F.rgba(gold, 1));
    dot.addColorStop(.62, F.rgba(rim, .95));
    dot.addColorStop(1, F.rgba(rim, 0));
    g.fillStyle = dot;
    g.fillRect(0, 0, S, S);
  }
  return cv;
}
function looks() {
  if (look) return look;
  const gold = F.color('--gold'), lite = F.color('--gold-lite');
  const deep = F.mix(gold, F.color('--yoxi-navy'), .3);
  look = {
    fleck: [metal('dot', deep), metal('dot', gold)],
    star: metal('star', deep),
    halo: [F.sprite(gold, 'glow'), F.sprite(lite, 'glow')],
  };
  return look;
}

/* ---------------------------------------------------------------- 一顆金粉 */

/* 在速度 (ax, ay) 的空氣裡走 dt 秒：速度往空氣速度靠（阻力），再加浮力與亂流。
   純函式（只改 p），測試直接拿來算「卡片往上走，金粉會不會跟著往上」 */
function step(p, ax, ay, dt) {
  const f = Math.exp(-DRAG * dt);
  p.vx = ax + (p.vx - ax) * f + Math.sin(p.t * 2.3 + (p.ph || 0)) * WANDER * dt;
  p.vy = ay + (p.vy - ay) * f + BUOY * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.t += dt;
  p.rot = (p.rot || 0) + (p.vr || 0) * dt;
  return p;
}

function alphaOf(p) {
  const k = p.t / p.life;
  let a = k < .1 ? k / .1 : (k > .62 ? (1 - k) / .38 : 1);
  if (p.tw) a *= .6 + .4 * Math.sin(p.t * p.tw + p.ph);
  return Math.min(1, a * p.alpha);
}
/* 暗底的光暈：比金點大一圈、淡一點，加亮疊色 */
function drawHalo(p) {
  const a = alphaOf(p) * .7;
  if (a <= .01) return;
  const s = p.size * (p.star ? 1.6 : 2.8);
  ctx.globalAlpha = a;
  ctx.drawImage(p.halo, p.x - s, p.y - s, s * 2, s * 2);
}
function drawOne(p) {
  const a = alphaOf(p);
  if (a <= .01) return;
  const s = p.size;
  ctx.globalAlpha = a;
  if (p.star) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.drawImage(p.img, -s, -s, s * 2, s * 2);
    ctx.restore();
  } else {
    ctx.drawImage(p.img, p.x - s, p.y - s, s * 2, s * 2);
  }
}

/* ---------------------------------------------------------------- 一張金框卡 */

/* 會裁掉它的祖先：overflow 不是 visible 的（捲動區、圓角卡片、main.view），到 .device 為止 */
function clipAncestors(el) {
  const out = [];
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') out.push(n);
    if (canvas && n === canvas.parentElement) break;
  }
  return out;
}

/* 卡片外面那一圈是暗的還是亮的：往上找第一個不透明的底色 */
function rgbOf(v) {
  let m = /rgba?\(([^)]+)\)/.exec(v || '');
  if (m) {
    const x = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    return { c: x.slice(0, 3), a: x.length > 3 ? x[3] : 1 };
  }
  m = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/.exec(v || '');
  if (m) return { c: [m[1], m[2], m[3]].map(function (x) { return parseFloat(x) * 255; }), a: m[4] == null ? 1 : parseFloat(m[4]) };
  return null;
}
function isDark(el) {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const bg = rgbOf(getComputedStyle(n).backgroundColor);
    if (!bg || bg.a < .5) continue;
    return (.2126 * bg.c[0] + .7152 * bg.c[1] + .0722 * bg.c[2]) / 255 < .5;
  }
  return false;
}

/* 角度（自己和祖先的 2D rotate 加起來）、沒變形的寬高、會裁掉它的祖先、底色。
   不是每幀量：每 15 幀一次（面板展開、翻面、hover 會改這些，但不會每一幀都改） */
function geom(s) {
  s.clips = clipAncestors(s.el);
  let a = 0;
  for (let n = s.el, i = 0; n && n.nodeType === 1 && i < 10; n = n.parentElement, i++) {
    const t = getComputedStyle(n).transform;
    const m = t && /^matrix\(([^)]+)\)/.exec(t);
    if (m) {
      const v = m[1].split(',');
      a += Math.atan2(parseFloat(v[1]), parseFloat(v[0]));
    }
    if (canvas && n === canvas.parentElement) break;
  }
  s.ang = a;
  s.bw = s.el.offsetWidth;
  s.bh = s.el.offsetHeight;
  s.k = Math.max(.95, Math.min(1.25, Math.sqrt(s.bw * s.bh) / 200));
  s.dark = isDark(s.el);
}

function track(el) {
  const s = {
    el: el, parts: [], vis: true, gone: false, covered: false, hidden: false,
    cx: null, cy: null, vx: 0, vy: 0, acc: 0, hw: 0, hh: 0,
    ang: 0, bw: 0, bh: 0, k: 1, dark: false, geomAt: -99,
    clips: [], clip: null,
  };
  srcs.push(s);
  if (io) io.observe(el);
  return s;
}
function drop(s) {
  if (s.gone) return;
  s.gone = true;
  if (io) io.unobserve(s.el);
}

/* 那一點最上面的是這張卡（或卡裡面的東西、或卡自己不吃點擊時的祖先）：沒被別的東西蓋住 */
function hitOk(s, x, y) {
  const hit = document.elementFromPoint(C.left + x, C.top + y);
  return !!hit && (hit === s.el || s.el.contains(hit) || hit.contains(s.el));
}

function rectOf(n, memo) {
  let r = memo.get(n);
  if (!r) { r = n.getBoundingClientRect(); memo.set(n, r); }
  return r;
}

function measure(s, dt, memo) {
  const r = s.el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) { s.hidden = true; return; }
  const cx = r.left + r.width / 2 - C.left, cy = r.top + r.height / 2 - C.top;
  if (s.cx == null) { s.cx = cx; s.cy = cy; }
  const dx = cx - s.cx, dy = cy - s.cy;
  if (Math.abs(dx) > JUMP || Math.abs(dy) > JUMP) {
    /* 版面跳了一下：金粉跟著平移，不當成速度 */
    s.parts.forEach(function (p) { p.x += dx; p.y += dy; });
    s.vx = s.vy = 0;
  } else if (dt > 0) {
    const k = Math.min(1, dt * 18);
    s.vx += (clampV(dx / dt) - s.vx) * k;
    s.vy += (clampV(dy / dt) - s.vy) * k;
  }
  s.cx = cx; s.cy = cy;
  /* 轉了角度的卡：外接矩形 → 卡片自己的半寬半高（桌機外框有縮放，所以用比例反推，不直接拿 offsetWidth） */
  const c = Math.abs(Math.cos(s.ang)), sn = Math.abs(Math.sin(s.ang));
  if (sn < .01 || !s.bw || !s.bh) {
    s.hw = r.width / 2; s.hh = r.height / 2;
  } else {
    const sc = (r.width / (s.bw * c + s.bh * sn) + r.height / (s.bw * sn + s.bh * c)) / 2;
    s.hw = s.bw * sc / 2; s.hh = s.bh * sc / 2;
  }
  let l = 0, t = 0, rr = W, b = H;
  s.clips.forEach(function (n) {
    const q = rectOf(n, memo);
    l = Math.max(l, q.left - C.left); t = Math.max(t, q.top - C.top);
    rr = Math.min(rr, q.right - C.left); b = Math.min(b, q.bottom - C.top);
  });
  s.clip = { l: l, t: t, r: rr, b: b };
  s.hidden = rr - l < 1 || b - t < 1;
}

/* 整張被蓋住了嗎：中心與四邊中點都不是這張卡。疊在後面的卡中心被擋、邊還看得到，不算蓋住 */
function covered(s) {
  const c = Math.cos(s.ang), sn = Math.sin(s.ang);
  const pts = [[0, 0], [0, -s.hh + 3], [s.hw - 3, 0], [0, s.hh - 3], [-s.hw + 3, 0]];
  return !pts.some(function (q) {
    return hitOk(s, s.cx + q[0] * c - q[1] * sn, s.cy + q[0] * sn + q[1] * c);
  });
}

/* 沿著邊（照卡片的角度）隨機挑一點，往外冒一顆 */
function spawn(s, per) {
  let u = Math.random() * per;
  const w = 2 * s.hw, h = 2 * s.hh;
  let lx, ly, nx, ny;
  if (u < w) { lx = u - s.hw; ly = -s.hh; nx = 0; ny = -1; }
  else if ((u -= w) < h) { lx = s.hw; ly = u - s.hh; nx = 1; ny = 0; }
  else if ((u -= h) < w) { lx = s.hw - u; ly = s.hh; nx = 0; ny = 1; }
  else { u -= w; lx = -s.hw; ly = s.hh - u; nx = -1; ny = 0; }
  const c = Math.cos(s.ang), sn = Math.sin(s.ang);
  const rx = nx * c - ny * sn, ry = nx * sn + ny * c;
  const px = s.cx + lx * c - ly * sn, py = s.cy + lx * sn + ly * c;
  const q = s.clip;
  if (px < q.l || px > q.r || py < q.t || py > q.b) return;
  if (!hitOk(s, px - rx * 2.5, py - ry * 2.5)) return;
  const L = looks();
  const star = Math.random() < .16;
  const out = rnd(0, 2.5), sp = rnd(8, 26), tg = rnd(-8, 8);
  s.parts.push({
    x: px + rx * out, y: py + ry * out,
    vx: s.vx * CARRY + rx * sp - ry * tg, vy: s.vy * CARRY + ry * sp + rx * tg,
    t: 0, life: rnd(1.1, 2.3),
    size: (star ? rnd(3.6, 6.4) : rnd(1.8, 3.3)) * s.k,
    img: star ? L.star : pick(L.fleck), halo: pick(L.halo), star: star,
    rot: rnd(0, 6.28), vr: rnd(-1.5, 1.5), tw: star ? rnd(6, 11) : 0, ph: rnd(0, 6.28),
    alpha: rnd(.8, 1),
  });
  total++;
}

function emit(s, dt) {
  if (s.gone || s.hidden || s.covered || !s.vis || !s.hw) return;
  const per = 4 * (s.hw + s.hh);
  const speed = Math.hypot(s.vx, s.vy);
  s.acc += per * DENSITY * (1 + Math.min(3, speed / SHAKE)) * dt;
  let n = Math.min(6, Math.floor(s.acc));
  s.acc -= Math.floor(s.acc);
  while (n-- > 0 && total < MAX) spawn(s, per);
}

/* ---------------------------------------------------------------- 迴圈 */

function fit() {
  C = canvas.getBoundingClientRect();
  const d = Math.min(window.devicePixelRatio || 1, 2);
  if (C.width !== W || C.height !== H || d !== dpr) {
    W = C.width; H = C.height; dpr = d;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
  }
}

function busy() {
  return srcs.some(function (s) { return (s.vis && !s.gone) || s.parts.length; });
}
function kick() {
  if (!raf && canvas && busy()) { last = performance.now(); raf = requestAnimationFrame(tick); }
}

function tick(now) {
  raf = 0;
  if (!canvas) return;
  if (F.calm()) { teardown(); return; }
  const dt = Math.min(.05, Math.max(0, (now - last) / 1000));
  last = now;
  frame++;
  fit();
  const memo = new Map();
  for (let i = srcs.length - 1; i >= 0; i--) {
    const s = srcs[i];
    if (!s.gone && !s.el.isConnected) drop(s);
    if (!s.gone && (s.vis || s.parts.length)) {
      if (frame - s.geomAt >= 15) { geom(s); s.geomAt = frame; }
      measure(s, dt, memo);
      if (frame % 10 === 0) s.covered = !s.hidden && covered(s);
      emit(s, dt);
    }
    const ax = s.gone ? 0 : s.vx * CARRY, ay = s.gone ? 0 : s.vy * CARRY;
    const fade = s.gone || s.covered || s.hidden ? 4 : 0;
    for (let j = s.parts.length - 1; j >= 0; j--) {
      const p = s.parts[j];
      step(p, ax, ay, dt);
      p.t += dt * fade;
      if (p.t >= p.life) { s.parts.splice(j, 1); total--; }
    }
    if (s.gone && !s.parts.length) srcs.splice(i, 1);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, W, H);
  srcs.forEach(function (s) {
    if (!s.parts.length) return;
    ctx.save();
    const q = s.clip;
    if (q) { ctx.beginPath(); ctx.rect(q.l, q.t, q.r - q.l, q.b - q.t); ctx.clip(); }
    if (s.dark) {
      ctx.globalCompositeOperation = 'lighter';
      s.parts.forEach(drawHalo);
    }
    ctx.globalCompositeOperation = 'source-over';
    s.parts.forEach(drawOne);
    ctx.restore();
  });
  if (busy()) raf = requestAnimationFrame(tick);
  else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
}

/* ---------------------------------------------------------------- 找畫面上的金框卡 */

function ensureCanvas() {
  const host = document.querySelector('.device') || document.body;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'gold-aura';
    canvas.setAttribute('aria-hidden', 'true');
    ctx = canvas.getContext('2d');
    if (window.IntersectionObserver) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          srcs.forEach(function (s) { if (s.el === e.target) s.vis = e.isIntersecting; });
        });
        kick();
      });
    }
  }
  if (canvas.parentNode !== host) host.appendChild(canvas);
}

function teardown() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  srcs.forEach(drop);
  srcs.length = 0;
  total = 0;
  if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
}

function scan() {
  queued = false;
  if (F.calm()) { if (canvas) teardown(); return; }
  srcs.forEach(function (s) { if (!s.el.isConnected || !s.el.hasAttribute('data-gold-aura')) drop(s); });
  const els = document.querySelectorAll(SEL);
  if (!els.length && !srcs.length) return;
  ensureCanvas();
  els.forEach(function (el) {
    if (!srcs.some(function (s) { return s.el === el && !s.gone; })) track(el);
  });
  kick();
}

(function watch() {
  if (!window.MutationObserver || !document.body) return;
  new MutationObserver(function () {
    if (queued) return;
    queued = true;
    Promise.resolve().then(scan);
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-gold-aura'] });
})();

F.gold = {
  refresh: scan,
  tracked: function () { return srcs.filter(function (s) { return !s.gone; }).length; },
  particles: function () { return total; },
  step: step,
};

})();
