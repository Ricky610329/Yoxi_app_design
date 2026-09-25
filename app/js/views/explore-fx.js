/* ==========================================================================
   yoxi 城事 web app — explore 區塊的特效工具（抵達亮燈、抽卡）
   契約：app/ARCHITECTURE.md §7（APP.fx）。只給 explore-unlock.js 的 /unlock 用，不註冊畫面。

   為什麼自己寫、不用 GSAP／PixiJS：repo 不加 CDN、不加套件（AGENTS.md），
   而這裡要的東西不多——Web Animations API 做時間軸，一張 <canvas> 做粒子，Web Audio 合成音效。

   設計原則（game juice：特效是回饋，不是裝飾）：
   - 分級給：常見的款式輕、稀有的重；停格、閃光、震動、全螢幕光芒只留給金框。
   - 三拍：蓄力（anticipation）→ 動作 → 餘韻；沒有蓄力的特效只是「突然冒出來」。
   - 只動 transform／opacity；粒子上百顆一律畫在 canvas，不塞 DOM。
   - 減少動態效果：不震、不閃、不噴粒子，改成短淡入（APP.fx.calm()）。全螢幕閃光一次抽卡最多一次。
   - 顏色全部從 tokens.css 讀，這支檔案不寫任何色碼。

   提供：
     APP.fx.engine(canvas)      粒子引擎：burst／converge／stream／ring／clear／destroy
     APP.fx.shaker(el)          以 trauma 計的震動（trauma² 決定幅度，會自己衰減）
     APP.fx.hitstop(root, eng, ms)  停格：root 底下的動畫與粒子一起停 ms 毫秒
     APP.fx.flash(el, color)    全螢幕閃一下（只給金框）
     APP.fx.sfx                 合成音效（沒有音檔）；store.fxMute 為 true 時全部靜音；sfx.stopAll() 切掉已經排好還沒響完的
     APP.fx.filters()           在 body 放一次卡面畫風用的 SVG 濾鏡（#exf-*）
     APP.fx.color(name)         讀 tokens.css 的顏色 → [r, g, b]
     APP.fx.ease                與 tokens 一致的 easing 字串
     APP.fx.calm()              使用者要不要少一點動態
   ========================================================================== */

(function () {
'use strict';

const APP = window.APP;
if (!APP) return;

/* ---------------------------------------------------------------- 顏色 */

const colorCache = {};
function token(name) {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  catch (e) { return ''; }
}
/* tokens.css 的值（#RRGGBB、#RGB 或 rgb()）→ [r, g, b]；讀不到就退回白色，不讓畫面炸 */
function color(name) {
  if (colorCache[name]) return colorCache[name];
  const v = token(name);
  let c = null;
  let m = /^#([0-9a-f]{6})$/i.exec(v);
  if (m) c = [0, 2, 4].map(function (i) { return parseInt(m[1].slice(i, i + 2), 16); });
  if (!c && (m = /^#([0-9a-f]{3})$/i.exec(v))) c = [0, 1, 2].map(function (i) { return parseInt(m[1][i] + m[1][i], 16); });
  if (!c && (m = /rgba?\(([^)]+)\)/i.exec(v))) c = m[1].split(',').slice(0, 3).map(function (x) { return Math.round(parseFloat(x)); });
  c = c && c.every(function (x) { return x >= 0; }) ? c : [255, 255, 255];
  colorCache[name] = c;
  return c;
}
function mix(a, b, t) {
  return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); });
}
function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

/* ---------------------------------------------------------------- 時間與 easing */

/* 要不要少一點動態：跟全 app 同一個判斷（APP.reduceMotion：?still=1 或系統的減少動態效果） */
function calm() {
  if (typeof APP.reduceMotion === 'function') return !!APP.reduceMotion();
  try { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  catch (e) { return false; }
}

const ease = {
  out:   token('--ease-out') || 'cubic-bezier(.16, 1, .3, 1)',        /* 進場、移動 */
  back:  token('--ease-bump') || 'cubic-bezier(.34, 1.56, .64, 1)',   /* 彈一下 */
  in:    'cubic-bezier(.55, 0, 1, .45)',                               /* 退場 */
  heavy: 'cubic-bezier(.7, 0, .84, 0)',                                /* 重擊：越來越快砸下去 */
  inOut: 'cubic-bezier(.65, 0, .35, 1)',
};
/* 果凍回彈：支援 linear() 就用真的 elastic，不支援退回 back */
ease.elastic = (window.CSS && CSS.supports && CSS.supports('animation-timing-function', 'linear(0, 1)'))
  ? 'linear(0, .22 4%, .72 10%, 1.1 17%, 1.2 21%, 1.15 26%, 1 34%, .95 40%, .97 48%, 1.01 60%, 1)'
  : ease.back;

function rnd(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function range(v, d) { return Array.isArray(v) ? rnd(v[0], v[1]) : (v == null ? d : v); }

/* ---------------------------------------------------------------- 粒子引擎 */

/* 每種顏色的光點、星芒、柔邊色塊先畫成小圖，之後每幀只 drawImage（比每顆都做漸層省很多） */
const spriteCache = {};
function sprite(c, kind) {
  const key = kind + c.join(',');
  if (spriteCache[key]) return spriteCache[key];
  const S = 64, h = S / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  if (kind === 'star') {
    const glow = g.createRadialGradient(h, h, 0, h, h, h);
    glow.addColorStop(0, rgba(mix(c, [255, 255, 255], .7), .9));
    glow.addColorStop(.18, rgba(c, .45));
    glow.addColorStop(1, rgba(c, 0));
    g.fillStyle = glow;
    g.fillRect(0, 0, S, S);
    g.fillStyle = rgba(mix(c, [255, 255, 255], .8), 1);
    [0, Math.PI / 2].forEach(function (r) {
      g.save(); g.translate(h, h); g.rotate(r);
      g.beginPath(); g.moveTo(-h, 0); g.lineTo(0, -2.2); g.lineTo(h, 0); g.lineTo(0, 2.2); g.closePath(); g.fill();
      g.restore();
    });
  } else {
    const soft = kind === 'soft';
    const grad = g.createRadialGradient(h, h, 0, h, h, h);
    grad.addColorStop(0, rgba(soft ? c : mix(c, [255, 255, 255], .65), soft ? .85 : 1));
    grad.addColorStop(soft ? .55 : .28, rgba(c, soft ? .45 : .7));
    grad.addColorStop(1, rgba(c, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
  }
  spriteCache[key] = cv;
  return cv;
}

function engine(canvas) {
  const ctx = canvas.getContext('2d');
  const list = [];
  const emitters = [];
  let raf = 0, last = 0, W = 0, H = 0, dpr = 1, dead = false;
  const api = { speed: 1 };

  /* 畫布尺寸只在變了的時候量：ResizeObserver（版面變了）＋視窗 resize（手機外框的縮放）標成 dirty，
     下一幀才 getBoundingClientRect。不再每一幀都量一次版面（金粉飄著的時候每秒 60 次強制排版）。
     沒有 ResizeObserver 的瀏覽器退回每幀量。 */
  let dirty = true;
  const markDirty = function () { dirty = true; };
  const ro = window.ResizeObserver ? new ResizeObserver(markDirty) : null;
  if (ro) ro.observe(canvas);
  window.addEventListener('resize', markDirty);
  function fit() {
    dirty = !ro;
    const r = canvas.getBoundingClientRect();
    const d = Math.min(window.devicePixelRatio || 1, 2);
    if (r.width !== W || r.height !== H || d !== dpr) {
      W = r.width; H = r.height; dpr = d;
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
    }
  }
  function fitIfNeeded() {
    if (dirty || Math.min(window.devicePixelRatio || 1, 2) !== dpr) fit();
  }
  function kick() {
    if (!raf && !dead) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }
  function alphaOf(p, k) {
    let a = k < p.fin ? k / p.fin : (k > 1 - p.fout ? (1 - k) / p.fout : 1);
    if (p.tw) a *= .55 + .45 * Math.sin(p.t * p.tw + p.ph);
    return Math.max(0, Math.min(1, a * p.alpha));
  }
  function draw(p, k) {
    const a = alphaOf(p, k);
    if (a <= .004) return;
    const s = p.size + (p.size1 - p.size) * k;
    ctx.globalCompositeOperation = p.blend;
    ctx.globalAlpha = a;
    if (p.kind === 'spark') {
      ctx.strokeStyle = rgba(mix(p.color, [255, 255, 255], .45), 1);
      ctx.lineWidth = Math.max(.6, s);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * p.len, p.y - p.vy * p.len);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else if (p.kind === 'shard') {
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = rgba(p.color, 1);
      ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * .6, s * .55); ctx.lineTo(-s * .35, -s * .6); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (p.kind === 'ring') {
      ctx.strokeStyle = rgba(p.color, 1);
      ctx.lineWidth = Math.max(.5, p.lw * (1 - k));
      ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.stroke();
    } else {
      const img = sprite(p.color, p.kind === 'star' ? 'star' : (p.kind === 'soft' ? 'soft' : 'glow'));
      if (p.kind === 'star') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.drawImage(img, -s, -s, s * 2, s * 2);
        ctx.restore();
      } else {
        ctx.drawImage(img, p.x - s, p.y - s, s * 2, s * 2);
      }
    }
  }
  function tick(now) {
    raf = 0;
    if (dead) return;
    fitIfNeeded();
    const dt = Math.min(.034, Math.max(0, (now - last) / 1000)) * api.speed;
    last = now;
    for (let i = emitters.length - 1; i >= 0; i--) {
      if (emitters[i].step(dt) === false) emitters.splice(i, 1);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.t += dt;
      if (p.t >= p.life) { list.splice(i, 1); continue; }
      const f = Math.exp(-p.drag * dt);
      p.vx = (p.vx + p.ax * dt) * f;
      p.vy = (p.vy + (p.ay + p.g) * dt) * f;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      draw(p, p.t / p.life);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (list.length || emitters.length) raf = requestAnimationFrame(tick);
  }
  function add(o, x, y, vx, vy) {
    const size = range(o.size, 3);
    list.push({
      x: x, y: y, vx: vx, vy: vy, ax: o.ax || 0, ay: o.ay || 0, g: o.g || 0, drag: o.drag || 0,
      size: size, size1: size * (o.grow == null ? 1 : range(o.grow, 1)),
      rot: Math.random() * Math.PI * 2, vr: range(o.spin, 0) * (Math.random() < .5 ? -1 : 1),
      life: range(o.life, .8), t: 0, color: pick(o.colors || [[255, 255, 255]]), kind: pick(o.kinds || ['glow']),
      blend: o.blend || 'lighter', alpha: o.alpha == null ? 1 : range(o.alpha, 1),
      fin: o.fin == null ? .08 : o.fin, fout: o.fout == null ? .5 : o.fout,
      tw: o.tw ? range(o.tw, 0) : 0, ph: Math.random() * 6.28, len: o.len || .035, lw: o.lw || 2,
    });
  }

  /* 從一點往外噴：angle 用弧度區間（預設 360°），speed 是 px/s，r0 是起點離中心多遠 */
  api.burst = function (o) {
    if (dead) return api;
    fitIfNeeded();
    const n = Math.round(o.n || 12);
    for (let i = 0; i < n; i++) {
      const ang = o.angle ? range(o.angle, 0) : Math.random() * Math.PI * 2;
      const sp = range(o.speed, 120);
      const j = o.jitter || 0;
      /* r0：從半徑 r0 的圈上開始（例如卡片邊緣），不要全部從正中心冒出來蓋在卡面上 */
      const r0 = range(o.r0, 0);
      add(o, o.x + Math.cos(ang) * r0 + rnd(-j, j), o.y + Math.sin(ang) * r0 + rnd(-j, j), Math.cos(ang) * sp, Math.sin(ang) * sp);
    }
    kick();
    return api;
  };
  /* 從四周往中心吸（蓄力）：在半徑 radius 的圓上生出來，life 秒後剛好抵達中心 */
  api.converge = function (o) {
    if (dead) return api;
    fitIfNeeded();
    const n = Math.round(o.n || 24);
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = range(o.radius, 160);
      const life = range(o.life, .9);
      const x0 = o.x + Math.cos(ang) * r, y0 = o.y + Math.sin(ang) * r;
      const q = Object.assign({}, o, { life: life, fin: o.fin == null ? .35 : o.fin, fout: o.fout == null ? .12 : o.fout });
      add(q, x0, y0, (o.x - x0) / life, (o.y - y0) / life);
    }
    kick();
    return api;
  };
  /* 一圈往外擴的細環（衝擊波） */
  api.ring = function (o) {
    if (dead) return api;
    fitIfNeeded();
    const q = Object.assign({ kinds: ['ring'], blend: 'lighter', fin: .02, fout: .8 }, o);
    q.kinds = ['ring'];
    add(q, o.x, o.y, 0, 0);
    kick();
    return api;
  };
  /* 持續發射：rate 顆／秒，one() 回傳一顆的參數（含 x, y, vx, vy）；回傳 { stop() } */
  api.stream = function (o) {
    const e = {
      acc: 0, off: false,
      step: function (dt) {
        if (this.off || dead) return false;
        this.acc += o.rate * dt;
        while (this.acc >= 1) {
          this.acc -= 1;
          const one = o.one();
          add(one, one.x, one.y, one.vx || 0, one.vy || 0);
        }
        return true;
      },
    };
    emitters.push(e);
    fitIfNeeded();
    kick();
    return { stop: function () { e.off = true; } };
  };
  /* 元素中心在 canvas 座標系的位置（兩邊都用 getBoundingClientRect，外框縮放也對得上） */
  api.at = function (el, fy) {
    const c = canvas.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - c.left, y: r.top + r.height * (fy == null ? .5 : fy) - c.top, w: r.width, h: r.height, W: c.width, H: c.height };
  };
  api.clear = function () {
    list.length = 0;
    emitters.forEach(function (e) { e.off = true; });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return api;
  };
  api.count = function () { return list.length; };
  api.destroy = function () {
    dead = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    list.length = 0;
    emitters.length = 0;
    if (ro) ro.disconnect();
    window.removeEventListener('resize', markDirty);
  };
  return api;
}

/* ---------------------------------------------------------------- 震動（trauma） */

/* trauma 0~1，每次衝擊加一點；幅度 = trauma²（小衝擊幾乎不震），每秒衰減 1.6。
   震的是外層容器，不是個別元素；減少動態效果時 add() 什麼都不做。 */
function shaker(el) {
  let trauma = 0, raf = 0, last = 0, t = 0;
  const ph = [rnd(0, 6), rnd(0, 6), rnd(0, 6)];
  function n(x, k) { return Math.sin(x * 1.7 + ph[k]) * .5 + Math.sin(x * 3.1 + ph[k] * 2) * .3 + Math.sin(x * 5.3 + ph[k] * 3) * .2; }
  function tick(now) {
    raf = 0;
    const dt = Math.min(.034, (now - last) / 1000);
    last = now; t += dt;
    trauma = Math.max(0, trauma - 1.6 * dt);
    const s = trauma * trauma;
    if (s <= .0005) { el.style.transform = ''; return; }
    el.style.transform = 'translate(' + (n(t * 18, 0) * 10 * s).toFixed(2) + 'px,' + (n(t * 18, 1) * 10 * s).toFixed(2) +
      'px) rotate(' + (n(t * 18, 2) * 2.5 * s).toFixed(3) + 'deg)';
    raf = requestAnimationFrame(tick);
  }
  return {
    add: function (v) {
      if (calm()) return;
      trauma = Math.min(1, trauma + v);
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    },
    stop: function () { trauma = 0; if (raf) cancelAnimationFrame(raf); raf = 0; el.style.transform = ''; },
  };
}

/* ---------------------------------------------------------------- 停格、閃光 */

/* 停格：root 底下正在跑的動畫（CSS 與 WAAPI）與粒子一起停 ms 毫秒，然後照原樣接著跑 */
function hitstop(root, eng, ms) {
  if (calm() || !ms) return Promise.resolve();
  const running = (root && root.getAnimations ? root.getAnimations({ subtree: true }) : [])
    .filter(function (a) { return a.playState === 'running'; });
  running.forEach(function (a) { a.pause(); });
  if (eng) eng.speed = 0;
  return new Promise(function (res) {
    setTimeout(function () {
      running.forEach(function (a) { try { if (a.playState === 'paused') a.play(); } catch (e) { /* 已被取消 */ } });
      if (eng) eng.speed = 1;
      res();
    }, ms);
  });
}

/* 全螢幕閃一下：60ms 亮起、260ms 退掉。只給金框用，一次抽卡最多一次（閃光安全） */
function flash(el, c) {
  if (!el || calm() || !el.animate) return null;
  el.style.background = rgba(c || [255, 255, 255], 1);
  return el.animate([{ opacity: 0 }, { opacity: .85, offset: .18 }, { opacity: 0 }],
    { duration: 320, easing: ease.in });
}

/* ---------------------------------------------------------------- 音效（Web Audio 合成，沒有音檔） */

const sfx = (function () {
  let ac = null, comp = null, out = null, noiseBuf = null;
  function on() { return !APP.store.get('fxMute'); }
  function ctx() {
    if (!on()) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ac) {
      try {
        ac = new AC();
        comp = ac.createDynamicsCompressor();
        comp.connect(ac.destination);
      } catch (e) { ac = null; comp = null; return null; }
    }
    /* 總線：每個聲音都接在 out 上。stopAll() 把它拔掉，下一個聲音再接一條新的 */
    if (!out) {
      try {
        out = ac.createGain();
        out.gain.value = .55;
        out.connect(comp);
      } catch (e) { out = null; return null; }
    }
    if (ac.state === 'suspended' && ac.resume) ac.resume().catch(function () { /* 還沒有手勢 */ });
    return ac;
  }
  /* 現在就安靜：已經排進時間軸、還沒響完的聲音（金框的鐘聲會拖三秒）都接在舊的總線上，
     把總線歸零並拔掉，它們就再也到不了喇叭。靜音、離開抵達頁時呼叫；可以重複呼叫 */
  function stopAll() {
    if (!out) return;
    const old = out;
    out = null;
    try {
      old.gain.cancelScheduledValues(0);
      old.gain.value = 0;
      old.disconnect();
    } catch (e) { /* 已經拔掉了 */ }
  }
  /* 每次音高隨機差 ±4%，連續抽不會像機器 */
  function vary() { return 1 + (Math.random() * 2 - 1) * .04; }
  function tone(o) {
    const c = ctx();
    if (!c) return;
    const t0 = c.currentTime + (o.at || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'sine';
    const f = o.f * (o.exact ? 1 : vary());
    osc.frequency.setValueAtTime(f, t0);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1 * (f / o.f), t0 + (o.glide || o.dur));
    g.gain.setValueAtTime(.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol || .2, t0 + (o.attack || .006));
    g.gain.exponentialRampToValueAtTime(.0001, t0 + o.dur);
    osc.connect(g); g.connect(out);
    osc.start(t0); osc.stop(t0 + o.dur + .05);
  }
  function noise(o) {
    const c = ctx();
    if (!c) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = c.currentTime + (o.at || 0);
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const bq = c.createBiquadFilter();
    bq.type = o.type || 'bandpass';
    bq.frequency.setValueAtTime(o.f || 1200, t0);
    if (o.f1) bq.frequency.exponentialRampToValueAtTime(o.f1, t0 + o.dur);
    bq.Q.value = o.q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol || .1, t0 + (o.attack || .01));
    g.gain.exponentialRampToValueAtTime(.0001, t0 + o.dur);
    src.connect(bq); bq.connect(g); g.connect(out);
    src.start(t0); src.stop(t0 + o.dur + .05);
  }
  /* 鐘聲：基頻加兩個非整數倍泛音 */
  function bell(f, at, vol, dur) {
    tone({ f: f, at: at, vol: vol, dur: dur });
    tone({ f: f * 2.76, at: at, vol: vol * .22, dur: dur * .5 });
    tone({ f: f * 5.4, at: at, vol: vol * .07, dur: dur * .3 });
  }
  const N = { C5: 523.25, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1568, C7: 2093 };
  return {
    stopAll: stopAll,
    unlock: function () { ctx(); },                    /* 在手勢裡先叫醒 AudioContext */
    arrive: function (ride) {
      bell(ride ? N.G5 : N.E5, 0, .16, 1.4);
      bell(ride ? N.C6 : N.A5, .14, .12, 1.6);
    },
    tap: function () { tone({ f: 1500, dur: .07, vol: .06, type: 'triangle' }); },
    whoosh: function () { noise({ dur: .5, vol: .1, type: 'bandpass', f: 300, f1: 2600, q: .7 }); },
    charge: function (i) {
      tone({ f: 392 * Math.pow(1.19, i), dur: .22, vol: .1, type: 'triangle' });
      noise({ dur: .14, vol: .03, type: 'highpass', f: 4000 });
    },
    upgrade: function () {
      noise({ dur: .3, vol: .22, type: 'highpass', f: 2500 });
      tone({ f: N.C6, f1: N.C7, glide: .35, dur: .6, vol: .12, type: 'triangle' });
    },
    flip: function () { noise({ dur: .2, vol: .08, type: 'bandpass', f: 2200, f1: 700, q: 1.4 }); },
    thud: function (big) {
      tone({ f: big ? 110 : 140, f1: 42, dur: big ? .7 : .4, vol: big ? .4 : .3 });
      noise({ dur: .18, vol: big ? .2 : .12, type: 'lowpass', f: 900 });
    },
    plip: function () { tone({ f: 1400, f1: 380, glide: .12, dur: .22, vol: .16 }); },
    reveal: function (tier) {
      if (tier <= 1) { bell(N.E5, 0, .12, 1.1); bell(N.G5, .08, .08, 1); return; }
      if (tier === 2) { [N.C5, N.E5, N.G5].forEach(function (f, i) { bell(f, i * .07, .12, 1.1); }); return; }
      if (tier === 3) { [N.G5, N.C6].forEach(function (f, i) { bell(f, .04 + i * .09, .14, 1.2); }); return; }
      if (tier === 4) {
        tone({ f: 98, dur: 2.6, vol: .22 }); tone({ f: 98 * 2.41, dur: 1.8, vol: .07 }); tone({ f: 98 * 3.93, dur: 1.2, vol: .04 });
        bell(N.E6, .18, .05, 1.8);
        return;
      }
      [N.C5, N.E5, N.G5, N.C6, N.E6, N.G6].forEach(function (f, i) { bell(f, .05 + i * .075, .13, 1.6); });
      [N.C5, N.G5, N.E6].forEach(function (f) { tone({ f: f, at: .5, dur: 2.8, vol: .035, attack: .4 }); });
      for (let i = 0; i < 12; i++) tone({ f: rnd(2400, 4200), at: rnd(.4, 1.8), dur: .35, vol: .025 });
    },
  };
})();

/* ---------------------------------------------------------------- 卡面畫風濾鏡 */

/* 四種畫風＋金框的 SVG 濾鏡。正式版是景點照片＋diffusion 生成；原型用濾鏡把同一張照片（或插圖）
   處理成看得出差別的四種樣子。只放一次，id 都以 exf- 開頭。 */
const FILTERS =
  /* 水彩：開運算把細節化成色塊（不逐色版分層，才不會跑出假色）、邊緣抖一點、提亮成透明感，
     unsharp 讓色塊邊緣像顏料積在紙上那樣深一點；最後顏料不塗滿，四周留一圈不規則的白紙（水彩最好認的地方） */
  '<filter id="exf-watercolor" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">' +
    '<feMorphology in="SourceGraphic" operator="erode" radius="1.8" result="e"/>' +
    '<feMorphology in="e" operator="dilate" radius="1.8" result="open"/>' +
    '<feGaussianBlur in="open" stdDeviation="1.2" result="b"/>' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="3" seed="7" result="warp"/>' +
    '<feDisplacementMap in="b" in2="warp" scale="14" xChannelSelector="R" yChannelSelector="G" result="wob"/>' +
    '<feComponentTransfer in="wob" result="light">' +
      '<feFuncR type="linear" slope="0.74" intercept="0.27"/>' +
      '<feFuncG type="linear" slope="0.74" intercept="0.27"/>' +
      '<feFuncB type="linear" slope="0.74" intercept="0.26"/>' +
    '</feComponentTransfer>' +
    '<feGaussianBlur in="light" stdDeviation="2.6" result="lb"/>' +
    '<feComposite in="light" in2="lb" operator="arithmetic" k1="0" k2="2.3" k3="-1.3" k4="0" result="edge"/>' +
    '<feColorMatrix in="edge" type="saturate" values="1.35" result="paint"/>' +
    '<feMorphology in="SourceAlpha" operator="erode" radius="10" result="inner"/>' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="3" result="rag"/>' +
    '<feDisplacementMap in="inner" in2="rag" scale="26" xChannelSelector="R" yChannelSelector="G" result="ragged"/>' +
    '<feGaussianBlur in="ragged" stdDeviation="1.4" result="mask"/>' +
    '<feComposite in="paint" in2="mask" operator="in" result="clipped"/>' +
    '<feFlood flood-color="white" result="paper"/>' +
    '<feComposite in="clipped" in2="paper" operator="over"/>' +
  '</filter>' +
  /* 油畫：顏料膨脹成一塊塊筆觸，用畫面自己的亮度當凹凸打光（厚塗），不另外疊條紋 */
  '<filter id="exf-oil" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="4" result="n"/>' +
    '<feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G" result="d"/>' +
    '<feMorphology in="d" operator="dilate" radius="2.2" result="thick"/>' +
    '<feMorphology in="thick" operator="erode" radius="0.8" result="dab"/>' +
    '<feColorMatrix in="dab" type="saturate" values="1.5" result="s"/>' +
    '<feComponentTransfer in="s" result="c">' +
      '<feFuncR type="linear" slope="1.12" intercept="-0.03"/>' +
      '<feFuncG type="linear" slope="1.1" intercept="-0.04"/>' +
      '<feFuncB type="linear" slope="1.02" intercept="-0.05"/>' +
    '</feComponentTransfer>' +
    '<feColorMatrix in="dab" type="luminanceToAlpha" result="lum"/>' +
    '<feDiffuseLighting in="lum" surfaceScale="2.6" lighting-color="white" result="lit">' +
      '<feDistantLight azimuth="225" elevation="58"/>' +
    '</feDiffuseLighting>' +
    '<feComposite in="c" in2="lit" operator="arithmetic" k1="0.72" k2="0.36" k3="0" k4="0"/>' +
  '</filter>' +
  /* 木刻版畫：先提亮再壓成三色（墨藍、朱紅、米白），疊直向木紋 */
  '<filter id="exf-woodcut" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">' +
    '<feColorMatrix type="matrix" values="0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 1 0" result="g"/>' +
    '<feComponentTransfer in="g" result="lift">' +
      '<feFuncR type="gamma" amplitude="1" exponent="0.72" offset="0.04"/>' +
      '<feFuncG type="gamma" amplitude="1" exponent="0.72" offset="0.04"/>' +
      '<feFuncB type="gamma" amplitude="1" exponent="0.72" offset="0.04"/>' +
    '</feComponentTransfer>' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.16 0.006" numOctaves="2" seed="2" result="noise"/>' +
    '<feColorMatrix in="noise" type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" result="grain"/>' +
    '<feDisplacementMap in="lift" in2="grain" scale="5" xChannelSelector="R" yChannelSelector="G" result="gd"/>' +
    '<feComposite in="gd" in2="grain" operator="arithmetic" k1="0" k2="1" k3="0.22" k4="-0.11" result="mix"/>' +
    '<feComponentTransfer in="mix">' +
      '<feFuncR type="discrete" tableValues="0.03 0.03 0.8 0.98 0.98"/>' +
      '<feFuncG type="discrete" tableValues="0.13 0.13 0.22 0.92 0.92"/>' +
      '<feFuncB type="discrete" tableValues="0.25 0.25 0.14 0.86 0.86"/>' +
    '</feComponentTransfer>' +
  '</filter>' +
  '<filter id="exf-ink" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">' +
    '<feColorMatrix type="matrix" values="0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 1 0" result="g"/>' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="3" seed="11" result="n"/>' +
    '<feDisplacementMap in="g" in2="n" scale="10" xChannelSelector="R" yChannelSelector="G" result="d"/>' +
    '<feGaussianBlur in="d" stdDeviation="0.8" result="b"/>' +
    '<feComponentTransfer in="b" result="p">' +
      '<feFuncR type="discrete" tableValues="0.07 0.24 0.5 0.9 0.96 0.97"/>' +
      '<feFuncG type="discrete" tableValues="0.08 0.25 0.5 0.88 0.94 0.95"/>' +
      '<feFuncB type="discrete" tableValues="0.1 0.27 0.5 0.82 0.88 0.9"/>' +
    '</feComponentTransfer>' +
    '<feGaussianBlur in="p" stdDeviation="0.55"/>' +
  '</filter>' +
  '<filter id="exf-gold" color-interpolation-filters="sRGB">' +
    '<feColorMatrix type="matrix" values="1.1 0.06 0 0 0.02  0.03 1.02 0 0 0.01  0 0.02 0.86 0 0  0 0 0 1 0" result="w"/>' +
    '<feColorMatrix in="w" type="saturate" values="1.18"/>' +
  '</filter>' +
  /* 毛筆邊：水墨的圓相用，筆畫邊緣抖一點、有飛白 */
  '<filter id="exf-brush" x="-10%" y="-10%" width="120%" height="120%">' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="8" result="n"/>' +
    '<feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/>' +
  '</filter>' +
  /* 紙紋：水彩與水墨卡面上疊一層，用 mix-blend-mode 乘上去 */
  '<filter id="exf-paper" x="0" y="0" width="100%" height="100%">' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" seed="5" result="t"/>' +
    '<feColorMatrix in="t" type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.58  0 0 0 0 0.52  0 0 0 -1.4 1.05"/>' +
  '</filter>';

function filters() {
  if (document.getElementById('exf-defs')) return;
  const box = document.createElement('div');
  box.innerHTML = '<svg id="exf-defs" class="ex-fx-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>' + FILTERS + '</defs></svg>';
  document.body.appendChild(box.firstChild);
}

APP.fx = {
  engine: engine,
  shaker: shaker,
  hitstop: hitstop,
  flash: flash,
  sfx: sfx,
  filters: filters,
  color: color,
  mix: mix,
  rgba: rgba,
  ease: ease,
  calm: calm,
  rnd: rnd,
};

})();
