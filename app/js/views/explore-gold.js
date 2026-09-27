/* ==========================================================================
   yoxi 城事 web app — 金框明信片的金粉（全 app 共用；不註冊畫面）
   契約：app/ARCHITECTURE.md §7（金框的明信片在哪裡顯示，都有金框和金粉）。
   載入順序：explore-fx.js → explore-cards.js → explore-gold.js → explore.js（都在 album.js 之前）。

   回答什麼：金框是最難拿到的一款。抽到的那一刻有整套特效（explore-unlock.js）；收下之後，
             在收藏、明信片詳情、獎章、回顧、叫車面板看到它，框的邊緣也一直散出細細的金粉。
             捲動、拖面板、換頁的時候，金粉帶著慣性，跟著畫面往上或往下飄。
   怎麼用：在「畫金框的那個元素」加 data-gold-aura：框畫在哪裡，金粉就從那裡的邊緣冒出來。
           [data-card-art] 的金框卡沒有人標的話，explore-face.js 的 paintCardArt 會自己補上
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
   - 每顆有自己的「遠近」：遠的小、淡、阻力小（落後得多），捲動時前後層分得出來。
   - 卡片動得越快，邊緣灑出來的越多（SHAKE）。
   - 一幀跳太遠（重排、換版面）不算速度：金粉跟著平移，不會被甩飛。
   - 轉了角度的卡（收藏首頁的疊卡、叫車面板的卡）照它的角度、沿著圓角的邊冒，不是沿著外接矩形。

   樣子（質感）：
   - 四種：細金粉（大多數，很小、很銳利）、金箔片（扁的、會翻，翻到正面那一下閃一次）、
     閃光（細長的四芒，一閃就收）、暗底才有的散景（大、很淡、失焦）。
   - 動得快的細金粉畫成短短的拖尾（動態模糊），捲動時是流動的，不是一顆顆跳。
   - 光：每張卡每隔 PERIOD 秒有一道斜光從左上掃到右下，照到的那段框亮起來，
     並從亮的地方多灑一把金粉與閃光；平常只有細細的金粉，不會一直閃（光會讓人注意到，不能停不下來）。
   - 暗底加亮疊色（會發光），亮底一般疊色（深一點的金才看得出來）；光一律加亮疊色。

   刻意沒有的東西：
   - 一張卡一張 canvas：整台手機只有一張，掛在 .device，z-index 97：在所有畫面層之上
     （抽卡與每日回顧是 95 的全螢幕層、浮起來看的卡片 80，金框卡也會出現在這些層裡）。
     蓋在卡片上的東西（分享面板、對話框）擋金粉靠的是下一條的 elementFromPoint，不是 z-index。
     每張卡的金粉裁在它自己的捲動範圍裡（overflow 不是 visible 的祖先），不會飄到頁首、tab bar 上。
   - 被蓋住的邊不冒金粉、也不亮：用 elementFromPoint 確認那一點最上面是這張卡（疊卡、面板、浮層都擋得住）；
     整張被蓋住或拿掉的卡，已經飄出去的金粉加速淡掉。
   - 減少動態效果（APP.reduceMotion：?still=1 或系統設定）：不噴金粉、不建 canvas，框照舊。
   - 看不到任何金框卡時不跑 rAF（IntersectionObserver）；分頁在背景時瀏覽器本來就停 rAF。
   - 色碼：顏色從 tokens 讀（--gold、--gold-lite、--yoxi-navy、--yoxi-white），小圖在第一次用到時畫好。
   ========================================================================== */

(function () {
'use strict';

const APP = window.APP;
if (!APP || !APP.fx) return;
const F = APP.fx;

const SEL = '[data-gold-aura]';
const MAX = 360;          /* 全畫面最多幾顆 */
const DENSITY = .036;     /* 平常每 px 周長每秒冒幾顆（收藏首頁 89×126 的疊卡約 15 顆／秒） */
const SHAKE = 350;        /* 卡片每秒動 SHAKE px 就多灑一倍，最多多三倍 */
const CARRY = .85;        /* 卡片速度有幾成帶給周圍的空氣 */
const DRAG = 5.5;         /* 金粉相對空氣的阻力（1/s）：越大越黏著卡片，越小越會甩出去 */
const BUOY = -100;        /* 浮力（px/s²，負的往上）；靜止的空氣裡終端速度 BUOY / DRAG ≈ 每秒往上 18 px */
const WANDER = 26;        /* 左右的亂流（px/s²） */
const JUMP = 160;         /* 一幀位移超過這麼多 px 當成版面跳動，不當成速度 */
const VMAX = 2600;        /* 卡片速度上限（px/s） */
const PERIOD = 4.8;       /* 斜光掃過一次的週期（秒）；每張卡錯開 */
const SWEEP = 1.25;       /* 斜光從左上掃到右下要幾秒 */
const BAND = .075;        /* 光帶的寬（對角線的比例） */
const BURST = 44;         /* 光掃過時多冒幾顆／秒（冒在亮的地方） */
const STREAK = 90;        /* 細金粉相對空氣每秒超過這麼多 px 就畫成拖尾 */

let canvas = null, ctx = null, raf = 0, last = 0, frame = 0, total = 0;
let W = 0, H = 0, dpr = 1, C = null;
let io = null, look = null, queued = false;
const srcs = [];          /* 追蹤中的卡（含已經拿掉、金粉還沒散完的） */
const tmp = {};           /* edgeAt 的輸出（重複用，不每次配置） */

function rnd(a, b) { return a + Math.random() * (b - a); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function clampV(v) { return Math.max(-VMAX, Math.min(VMAX, v)); }

/* ---------------------------------------------------------------- 小圖（第一次用到時畫） */

function paint(S, fn) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  fn(cv.getContext('2d'), S / 2, S);
  return cv;
}
/* 細金粉：實心的小點，邊緣很窄的柔邊（銳利，不是一團光）。
   暗底版（glow）核心一樣小，外面多一圈很淡的光（畫的時候放大 DUST_GLOW 倍，核心大小不變） */
const DUST_GLOW = 1.8;
function dustImg(c, glow) {
  return paint(glow ? 40 : 24, function (g, h, S) {
    const r = g.createRadialGradient(h, h, 0, h, h, h);
    r.addColorStop(0, F.rgba(c, 1));
    if (glow) {
      r.addColorStop(.23, F.rgba(c, 1));
      r.addColorStop(.37, F.rgba(c, .4));
      r.addColorStop(.6, F.rgba(c, .1));
    } else {
      r.addColorStop(.42, F.rgba(c, 1));
      r.addColorStop(.66, F.rgba(c, .3));
    }
    r.addColorStop(1, F.rgba(c, 0));
    g.fillStyle = r;
    g.fillRect(0, 0, S, S);
  });
}
/* 金箔片：扁的橢圓，中心的顏色照「翻到多正」分幾階，邊一律深一點 */
function flakeImg(core, rim) {
  return paint(32, function (g, h) {
    g.translate(h, h);
    g.scale(1, .52);
    const r = g.createRadialGradient(-h * .2, -h * .2, 0, 0, 0, h);
    r.addColorStop(0, F.rgba(core, 1));
    r.addColorStop(.6, F.rgba(F.mix(core, rim, .5), 1));
    r.addColorStop(.86, F.rgba(rim, .9));
    r.addColorStop(1, F.rgba(rim, 0));
    g.fillStyle = r;
    g.beginPath();
    g.arc(0, 0, h, 0, Math.PI * 2);
    g.fill();
  });
}
/* 閃光：細長的十字＋短的斜線＋很小的核心（不是一顆胖星星） */
function glintImg(core, arm) {
  return paint(64, function (g, h, S) {
    const r = g.createRadialGradient(h, h, 0, h, h, h * .26);
    r.addColorStop(0, F.rgba(core, 1));
    r.addColorStop(.35, F.rgba(core, .55));
    r.addColorStop(1, F.rgba(arm, 0));
    g.fillStyle = r;
    g.fillRect(0, 0, S, S);
    const ray = function (rot, len, wid, alpha) {
      g.save();
      g.translate(h, h);
      g.rotate(rot);
      const lg = g.createLinearGradient(-len, 0, len, 0);
      lg.addColorStop(0, F.rgba(arm, 0));
      lg.addColorStop(.5, F.rgba(core, alpha));
      lg.addColorStop(1, F.rgba(arm, 0));
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(-len, 0); g.lineTo(0, -wid); g.lineTo(len, 0); g.lineTo(0, wid);
      g.closePath();
      g.fill();
      g.restore();
    };
    ray(0, h, 1.3, 1);
    ray(Math.PI / 2, h, 1.3, 1);
    ray(Math.PI / 4, h * .42, .8, .7);
    ray(-Math.PI / 4, h * .42, .8, .7);
  });
}
/* 散景：失焦的圓，很淡、邊緣柔（不畫亮邊：亮邊看起來像泡泡） */
function bokehImg(c) {
  return paint(48, function (g, h, S) {
    const r = g.createRadialGradient(h, h, 0, h, h, h);
    r.addColorStop(0, F.rgba(c, .18));
    r.addColorStop(.55, F.rgba(c, .15));
    r.addColorStop(.85, F.rgba(c, .06));
    r.addColorStop(1, F.rgba(c, 0));
    g.fillStyle = r;
    g.fillRect(0, 0, S, S);
  });
}
function rgbStr(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }

function looks() {
  if (look) return look;
  const gold = F.color('--gold'), lite = F.color('--gold-lite'), white = F.color('--yoxi-white');
  const navy = F.color('--yoxi-navy');
  const deep = F.mix(gold, navy, .3);
  const champ = F.mix(lite, white, .35);
  const levels = function (from, to, rim) {
    return [0, 1, 2, 3, 4].map(function (i) { return flakeImg(F.mix(from, to, i / 4), rim); });
  };
  const set = function (dust, flakes, glint, bokeh, blend) {
    const glow = blend === 'lighter';
    return {
      dust: dust.map(function (c) { return { img: dustImg(c, glow), col: rgbStr(c) }; }),
      dustScale: glow ? DUST_GLOW : 1,
      flake: flakes, glint: glint, bokeh: bokeh, blend: blend,
      sheen: F.sprite(lite, 'glow'),
    };
  };
  look = {
    /* 暗底：加亮疊色，亮的金、香檳色；金箔翻到正面接近白 */
    dark: set([champ, lite, F.mix(gold, lite, .45)], levels(deep, F.mix(lite, white, .6), gold),
              glintImg(white, lite), bokehImg(lite), 'lighter'),
    /* 亮底：一般疊色，金與深金（白底上才看得出來）；金箔翻到正面是亮金（不是香檳色：白底上會變成一個空心的圈） */
    light: set([gold, deep, F.mix(gold, deep, .5), F.mix(gold, lite, .25)], levels(deep, F.mix(gold, lite, .3), F.mix(deep, gold, .4)),
               glintImg(champ, gold), null, 'source-over'),
  };
  return look;
}

/* ---------------------------------------------------------------- 一顆金粉 */

/* 在速度 (ax, ay) 的空氣裡走 dt 秒：速度往空氣速度靠（阻力），再加浮力與亂流。
   p.drag／p.buoy 是這一顆自己的（遠近不同），沒有就用 DRAG／BUOY。
   純函式（只改 p），測試直接拿來算「卡片往上走，金粉會不會跟著往上」 */
function step(p, ax, ay, dt) {
  const f = Math.exp(-(p.drag || DRAG) * dt);
  p.vx = ax + (p.vx - ax) * f + Math.sin(p.t * 2.3 + (p.ph || 0)) * WANDER * dt;
  p.vy = ay + (p.vy - ay) * f + (p.buoy == null ? BUOY : p.buoy) * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.t += dt;
  p.rot = (p.rot || 0) + (p.vr || 0) * dt;
  return p;
}

function drawRot(img, x, y, rot, sx, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  if (sx !== 1) ctx.scale(sx, 1);
  ctx.drawImage(img, -s, -s, s * 2, s * 2);
  ctx.restore();
}

/* ax, ay：這顆金粉周圍空氣的速度。拖尾看的是相對空氣的速度：跟著內容一起走的金粉不糊（內容本身也不糊），
   被甩在後面、或停下來還衝出去的那些才拉出尾巴 */
function drawPart(p, T, ax, ay) {
  const k = p.t / p.life;
  if (k >= 1) return;
  if (p.kind === 'glint') {
    /* 一閃就收：亮度與大小都是 sin² 的包絡 */
    const e = Math.sin(Math.PI * k);
    const a = e * e * p.alpha;
    if (a < .01) return;
    ctx.globalAlpha = a;
    drawRot(T.glint, p.x, p.y, p.rot, 1, p.size * (.35 + .65 * e));
    return;
  }
  let a = k < .08 ? k / .08 : (k > .55 ? 1 - (k - .55) / .45 : 1);
  a = a * a * (3 - 2 * a) * p.alpha;
  if (a < .01) return;
  if (p.kind === 'bokeh') {
    ctx.globalAlpha = a;
    ctx.drawImage(T.bokeh, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
    return;
  }
  const spin = p.t * p.spin + p.ph;
  if (p.kind === 'flake') {
    /* 翻：寬度＝|cos|；越正面越亮，翻到正面那一下疊一個小閃光 */
    const face = Math.abs(Math.cos(spin));
    const lv = T.flake[Math.min(T.flake.length - 1, Math.round(face * face * face * (T.flake.length - 1)))];
    ctx.globalAlpha = a * (.55 + .45 * face);
    drawRot(lv, p.x, p.y, p.rot, Math.max(.16, face), p.size);
    if (face > .93) {
      ctx.globalAlpha = a * (face - .93) / .07;
      drawRot(T.glint, p.x, p.y, p.rot + .6, 1, p.size * 2.6);
    }
    return;
  }
  /* 細金粉：輕輕閃；相對空氣動得快就拉出往後變淡的尾巴（兩段：尾巴淡、頭實），亮度攤在長度上 */
  const tw = .72 + .28 * Math.cos(spin);
  const rx = p.vx - ax, ry = p.vy - ay;
  const sp = Math.hypot(rx, ry);
  if (sp > STREAK) {
    const len = Math.min(10, (sp - STREAK) * .012 + p.size), ux = rx / sp, uy = ry / sp;
    const base = a * tw * Math.min(1, 2 / (1 + len / (p.size * 2.5)));
    ctx.strokeStyle = p.col;
    ctx.lineCap = 'round';
    ctx.lineWidth = p.size * .8;
    ctx.globalAlpha = base * .35;
    ctx.beginPath();
    ctx.moveTo(p.x - ux * len, p.y - uy * len);
    ctx.lineTo(p.x - ux * len * .45, p.y - uy * len * .45);
    ctx.stroke();
    ctx.lineWidth = p.size * 1.05;
    ctx.globalAlpha = base;
    ctx.beginPath();
    ctx.moveTo(p.x - ux * len * .45, p.y - uy * len * .45);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  } else {
    const z = p.size * T.dustScale;
    ctx.globalAlpha = a * tw;
    ctx.drawImage(p.img, p.x - z, p.y - z, z * 2, z * 2);
  }
}

/* ---------------------------------------------------------------- 圓角矩形的邊 */

/* 卡片座標（中心為原點、半寬 a、半高 b、圓角 r）裡，沿著邊從左上走 u px 的那一點與往外的法向量 */
function put(o, x, y, nx, ny) { o.x = x; o.y = y; o.nx = nx; o.ny = ny; return o; }
function arc(o, cx, cy, r, t) { const c = Math.cos(t), s = Math.sin(t); return put(o, cx + c * r, cy + s * r, c, s); }
function perim(a, b, r) { return 4 * (a - r) + 4 * (b - r) + 2 * Math.PI * r; }
function edgeAt(a, b, r, u, o) {
  const L1 = 2 * (a - r), L2 = 2 * (b - r), q = Math.PI * r / 2, ir = r ? 1 / r : 0;
  const P = 2 * (L1 + L2) + 4 * q;
  u = ((u % P) + P) % P;
  if (u < L1) return put(o, -a + r + u, -b, 0, -1);
  u -= L1;
  if (u < q) return arc(o, a - r, -b + r, r, -Math.PI / 2 + u * ir);
  u -= q;
  if (u < L2) return put(o, a, -b + r + u, 1, 0);
  u -= L2;
  if (u < q) return arc(o, a - r, b - r, r, u * ir);
  u -= q;
  if (u < L1) return put(o, a - r - u, b, 0, 1);
  u -= L1;
  if (u < q) return arc(o, -a + r, b - r, r, Math.PI / 2 + u * ir);
  u -= q;
  if (u < L2) return put(o, -a, b - r - u, -1, 0);
  u -= L2;
  return arc(o, -a + r, -b + r, r, Math.PI + Math.min(u, q) * ir);
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

/* 角度（自己和祖先的 2D rotate 加起來）、沒變形的寬高與圓角、會裁掉它的祖先、底色。
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
  const rad = getComputedStyle(s.el).borderTopLeftRadius || '';
  s.rad = /%/.test(rad) ? 0 : (parseFloat(rad) || 0);
  s.k = Math.max(.95, Math.min(1.25, Math.sqrt(s.bw * s.bh) / 200));
  s.dark = isDark(s.el);
}

function track(el) {
  const s = {
    el: el, parts: [], vis: true, gone: false, covered: false, hidden: false,
    cx: null, cy: null, vx: 0, vy: 0, acc: 0, accB: 0, hw: 0, hh: 0, r: 0, rad: 0, sc: 1,
    ang: 0, bw: 0, bh: 0, k: 1, dark: false, geomAt: -99, phase: Math.random(), band: null,
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
    s.sc = s.bh ? r.height / s.bh : 1;
  } else {
    s.sc = (r.width / (s.bw * c + s.bh * sn) + r.height / (s.bw * sn + s.bh * c)) / 2;
    s.hw = s.bw * s.sc / 2; s.hh = s.bh * s.sc / 2;
  }
  s.r = Math.max(0, Math.min(s.rad * s.sc, s.hw, s.hh));
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

/* ---------------------------------------------------------------- 斜光 */

/* 這張卡現在的光帶位置（對角線的比例，-0.2 → 1.2），沒在掃就是 null。每張卡照 phase 錯開 */
function bandOf(s, now) {
  const t = (now / 1000 + s.phase * PERIOD) % PERIOD;
  if (t > SWEEP) return null;
  const e = t / SWEEP;
  const ease = e < .5 ? 2 * e * e : 1 - Math.pow(2 - 2 * e, 2) / 2;
  return -.2 + 1.4 * ease;
}
/* 卡片座標的一點被光照到多少（0–1）：左上→右下的對角線上，離光帶多遠 */
function litAt(s, lx, ly) {
  const d = ((s.hw ? lx / s.hw : 0) + (s.hh ? ly / s.hh : 0)) / 4 + .5;
  const z = (d - s.band) / BAND;
  return Math.exp(-z * z);
}
/* 光照到的那段框亮起來：沿著框的中線（往內 1.5 px）每 3 px 疊一個光點，被蓋住的不畫 */
function drawSheen(s, T) {
  const ins = 1.5 * s.sc;
  const a = s.hw - ins, b = s.hh - ins, r = Math.max(0, s.r - ins);
  if (a <= 0 || b <= 0) return;
  const P = perim(a, b, r);
  const c = Math.cos(s.ang), sn = Math.sin(s.ang);
  let ok = false, at = -99;
  ctx.globalCompositeOperation = 'lighter';
  for (let u = 0; u < P; u += 3) {
    edgeAt(a, b, r, u, tmp);
    const I = litAt(s, tmp.x, tmp.y);
    if (I < .04) continue;
    const x = s.cx + tmp.x * c - tmp.y * sn, y = s.cy + tmp.x * sn + tmp.y * c;
    if (u - at > 12) { ok = hitOk(s, x, y); at = u; }
    if (!ok) continue;
    const z = (2.6 + 2.4 * I) * s.k;
    ctx.globalAlpha = .7 * I;
    ctx.drawImage(T.sheen, x - z, y - z, z * 2, z * 2);
  }
}

/* ---------------------------------------------------------------- 冒金粉 */

/* 沿著邊走 u px 的那一點往外冒一顆。hot＝光照到的地方：閃光與金箔多一點、衝得遠一點 */
function spawn(s, u, hot) {
  edgeAt(s.hw, s.hh, s.r, u, tmp);
  const c = Math.cos(s.ang), sn = Math.sin(s.ang);
  const rx = tmp.nx * c - tmp.ny * sn, ry = tmp.nx * sn + tmp.ny * c;
  const px = s.cx + tmp.x * c - tmp.y * sn, py = s.cy + tmp.x * sn + tmp.y * c;
  const q = s.clip;
  if (px < q.l || px > q.r || py < q.t || py > q.b) return;
  if (!hitOk(s, px - rx * 2.5, py - ry * 2.5)) return;
  const T = looks()[s.dark ? 'dark' : 'light'];
  const pr = Math.random();
  const kind = hot ? (pr < .3 ? 'glint' : pr < .62 ? 'flake' : 'dust')
                   : (pr < .05 ? 'glint' : pr < .27 ? 'flake' : (s.dark && pr < .31) ? 'bokeh' : 'dust');
  const z = rnd(.6, 1.25);                    /* 遠近：遠的小、淡、阻力小 */
  const out = rnd(0, 2), tg = rnd(-8, 8);
  const sp = kind === 'dust' ? rnd(6, 22) : kind === 'flake' ? rnd(4, 16) : rnd(2, 8);
  const push = hot ? 1.6 : 1;
  const d = kind === 'dust' ? pick(T.dust) : null;
  const p = {
    kind: kind, x: px + rx * out, y: py + ry * out,
    vx: s.vx * CARRY + (rx * sp - ry * tg) * push, vy: s.vy * CARRY + (ry * sp + rx * tg) * push,
    t: 0, ph: rnd(0, 6.28), rot: rnd(0, 6.28), vr: rnd(-1.2, 1.2),
    drag: DRAG * (.7 + .3 * z), buoy: BUOY * (kind === 'bokeh' ? .4 : rnd(.6, 1.3)),
    spin: rnd(2, 7),
  };
  if (kind === 'dust') {
    p.size = rnd(1.1, 2.1) * z * s.k; p.life = rnd(1.2, 2.6); p.img = d.img; p.col = d.col;
    p.alpha = rnd(.75, 1) * Math.min(1, .45 + .55 * z);
  } else if (kind === 'flake') {
    p.size = rnd(1.6, 2.8) * z * s.k; p.life = rnd(1.4, 2.8); p.alpha = rnd(.8, 1);
  } else if (kind === 'glint') {
    p.size = rnd(4, 7.5) * s.k; p.life = rnd(.45, .9); p.alpha = rnd(.8, 1); p.vr = rnd(-.6, .6);
  } else {
    p.size = rnd(3.5, 6.5) * s.k; p.life = rnd(1.6, 2.8); p.alpha = rnd(.5, .9);
  }
  s.parts.push(p);
  total++;
}

function emit(s, dt) {
  if (s.gone || s.hidden || s.covered || !s.vis || !s.hw) return;
  const per = perim(s.hw, s.hh, s.r);
  const speed = Math.hypot(s.vx, s.vy);
  s.acc += per * DENSITY * (1 + Math.min(3, speed / SHAKE)) * dt;
  let n = Math.min(6, Math.floor(s.acc));
  s.acc -= Math.floor(s.acc);
  while (n-- > 0 && total < MAX) spawn(s, Math.random() * per, false);
  if (s.band == null) { s.accB = 0; return; }
  /* 光照到的地方多灑一把：隨機挑邊上的點，照亮度決定要不要（亮的地方比較多） */
  s.accB += BURST * s.k * dt;
  let m = Math.min(4, Math.floor(s.accB));
  s.accB -= Math.floor(s.accB);
  while (m-- > 0 && total < MAX) {
    for (let i = 0; i < 6; i++) {
      const u = Math.random() * per;
      edgeAt(s.hw, s.hh, s.r, u, tmp);
      if (Math.random() < litAt(s, tmp.x, tmp.y)) { spawn(s, u, true); break; }
    }
  }
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
    s.band = null;
    if (!s.gone && (s.vis || s.parts.length)) {
      if (frame - s.geomAt >= 15) { geom(s); s.geomAt = frame; }
      measure(s, dt, memo);
      if (frame % 10 === 0) s.covered = !s.hidden && covered(s);
      if (!s.hidden && !s.covered && s.vis) s.band = bandOf(s, now);
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
  const L = looks();
  srcs.forEach(function (s) {
    if (!s.parts.length && s.band == null) return;
    const T = L[s.dark ? 'dark' : 'light'];
    const ax = s.gone ? 0 : s.vx * CARRY, ay = s.gone ? 0 : s.vy * CARRY;
    ctx.save();
    const q = s.clip;
    if (q) { ctx.beginPath(); ctx.rect(q.l, q.t, q.r - q.l, q.b - q.t); ctx.clip(); }
    if (s.band != null) drawSheen(s, T);
    ctx.globalCompositeOperation = T.blend;
    for (let j = 0; j < s.parts.length; j++) drawPart(s.parts[j], T, ax, ay);
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
