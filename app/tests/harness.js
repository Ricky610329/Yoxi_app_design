/* ==========================================================================
   yoxi 城事 web app — 瀏覽器端測試框架（harness）
   規格：app/ARCHITECTURE.md §6.2

   runner.html 載入這支 → 各 specs/*.spec.js 用 T.spec() 登記 → window.onload 之後 T.run()。
   一個 iframe 載 ../index.html?still=1（關動畫），所有測試共用它；
   app.reset() 會清兩把 localStorage、略過 onboarding、重載 iframe。

   設計取捨：
   - 斷言是「軟」的：失敗記下來、測試繼續跑到底（一條 route 掃出三個死按鈕就列三個），
     只要有一條失敗整個 test 就是 FAIL。例外與 timeout 也是 FAIL。
   - app.click() 一律派一個真的 click 事件：element.onclick、href 導覽、
     router 的 data-back 攔截都會照真實順序發生。直接呼叫 el.onclick() 會跳過 href。
     el.click() 不管元素看不看得到；要驗「手指點得到」用 app.click(sel, { hit:true })（命中測試）。
   - 死按鈕與禁用詞不只掃 main.view：.device 裡看得到的浮層（推播、分享、確認框、吐司、[data-overlay]）
     與顯示中的 #demo-panel 也一起掃（scanRoots）。
   - 每個 spec 開跑前自動 reset 一次，spec 之間不互相污染；spec 內的 test 要自己 reset。
   ========================================================================== */
(function () {
  'use strict';

  /* runner.html?app=fixtures/mini-app.html 可以換掉受測頁（驗 harness 本身用） */
  const APP_BASE = (function () {
    const a = new URLSearchParams(location.search).get('app');
    return a && /^[\w./-]+\.html$/.test(a) ? a : '../index.html';
  })();
  const APP_URL = APP_BASE + '?still=1';
  /* reset({ still:false })／reload(hash, { still:false })：不帶 ?still=1，動畫與 setTimeout 路徑照真的跑 */
  let stillMode = true;
  const KEYS = { state: 'yoxi-chengshi-v1-2', store: 'yoxi-chengshi-app-v1' };
  const DEFAULT_TIMEOUT = 8000;
  const READY_TIMEOUT = 6000;

  /* 禁用詞與白名單（沿用 prototype/tools/audit-app.html 的 BANNED／WORD_OK） */
  const BANNED = ['任務', '完成', '達成', '挑戰', '每日'];
  /* yoxi 既有的文案，不是城事寫的：抽屜的「好康任務」、行程結束頁的「行程完成」。
     比對前先把整個片語拿掉；要加白名單請加在這裡並說明理由。 */
  const WORD_OK = ['好康任務', '行程完成'];

  /* 死按鈕：有這些屬性之一就算有行為（audit-app 的判準＋app 的 data-back／data-pills） */
  /* data-back 另外判：app.js 只攔 a[data-back]，<button data-back> 按了沒反應 */
  const BEHAVIOR_ATTRS = ['data-toast', 'data-switch', 'data-pills', 'data-flip',
    'data-share', 'data-reset', 'data-recenter', 'data-tab', 'data-i'];

  const specs = [];
  const missing = [];
  let current = null;           /* 正在跑的 test 紀錄；斷言寫進這裡 */
  let frame = null;
  let errors = [];              /* iframe 裡的 window.onerror／unhandledrejection */
  let readyMs = null;
  let loadSeq = 0;
  let errOffset = 0;            /* app 自己的 <pre id="app-errors">（render／mount 丟的例外）已讀到哪 */
  /* 第幾條 test：逾時的 test 不會真的停下來，它後面的 await 會繼續跑、把斷言記到下一條 test 頭上。
     每條 test 開始與逾時都 +1；waitFor／tick 發現世代換了就丟「已逾時」讓舊的那條停在下一個 await。 */
  let gen = 0;
  function staleError() { return new Error('這條 test 已逾時結束，後續步驟不再執行'); }

  function appErrText() {
    try { const pre = frame && frame.contentDocument.getElementById('app-errors'); return pre ? pre.textContent : ''; }
    catch (e) { return ''; }
  }
  function appErrors() {
    return appErrText().slice(errOffset).split('\n').filter(function (l) { return /^\[/.test(l); })
      .map(function (l) { return 'app：' + l.slice(0, 200); });
  }

  /* ------------------------------------------------------------ 小工具 */
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function tickGuarded(ms) {
    const g = gen;
    return sleep(ms).then(function () { if (g !== gen) throw staleError(); });
  }

  function stack2(e) {
    if (!e) return '';
    const lines = String(e.stack || '').split('\n').map(function (s) { return s.trim(); })
      .filter(function (s) { return /^at /.test(s); });
    return lines.slice(0, 2).join(' | ');
  }

  function short(v) {
    let s;
    try { s = typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v); } catch (e) { s = String(v); }
    if (s === undefined) s = String(v);
    return s.length > 80 ? s.slice(0, 77) + '…' : s;
  }

  function waitFor(fn, ms, label) {
    ms = ms == null ? 3000 : ms;
    const t0 = Date.now();
    const g = gen;
    return new Promise(function (resolve, reject) {
      (function poll() {
        if (g !== gen) return reject(staleError());
        let v;
        try { v = fn(); } catch (e) { v = false; }
        if (v) return resolve(v);
        if (Date.now() - t0 >= ms) {
          return reject(new Error('等待逾時 ' + ms + 'ms：' + (label || String(fn).slice(0, 80))));
        }
        setTimeout(poll, 20);
      })();
    });
  }

  function stripQuery(p) { return String(p || '').split('?')[0].split('#')[0]; }

  function describe(el) {
    if (!el || !el.tagName) return String(el);
    const cls = el.classList && el.classList.length ? '.' + Array.prototype.slice.call(el.classList, 0, 2).join('.') : '';
    const act = el.getAttribute && el.getAttribute('data-act');
    return '<' + el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + cls + (act ? ' data-act=' + act : '') + '>';
  }

  /* app.click(sel, { hit:true })：元素中心點真的點得到它嗎（真的手指點不到藏起來或被蓋住的東西） */
  function hitTest(el, sel) {
    const d = el.ownerDocument;
    const w = d && d.defaultView;
    const name = typeof sel === 'string' ? sel : describe(el);
    const head = 'click(' + name + ', {hit:true})：';
    let r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) throw new Error(head + '元素看不見（寬高 0 或 display:none）');
    /* 在捲動區外：先捲進來（使用者也會先捲過去） */
    if (w && (r.bottom <= 0 || r.right <= 0 || r.top >= w.innerHeight || r.left >= w.innerWidth)) {
      try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (e) { el.scrollIntoView(); }
      r = el.getBoundingClientRect();
    }
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const top = d.elementFromPoint(x, y);
    if (!top || (top !== el && !el.contains(top))) {
      throw new Error(head + '中心點 (' + Math.round(x) + ', ' + Math.round(y) + ') 點到的是 ' +
        (top ? describe(top) : '畫面外'));
    }
  }

  /* 死按鈕與禁用詞要掃的範圍：main.view、#tabbar，
     加上 .device 裡、main.view 之外「看得到」的浮層（data-overlay、確認框／分享面板的 .scrim、推播、吐司），
     以及顯示中的 #demo-panel（桌機才顯示；測試的 iframe 是手機寬，平常是藏著的）。 */
  const OVERLAY_SEL = '[data-overlay], .scrim, .sharesheet, .sys-share, .pushmock, .toast';
  function shownEl(w, el) {
    if (!w || !el || !el.isConnected) return false;
    const s = w.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function scanRoots(appObj) {
    const w = appObj.win;
    const main = appObj.$('main.view[data-view]');
    const roots = [];
    if (main) roots.push({ el: main, where: '' });
    const tb = appObj.$('#tabbar');
    if (tb) roots.push({ el: tb, where: '〔#tabbar〕' });
    const dev = appObj.$('.device');
    if (dev && w) {
      dev.querySelectorAll(OVERLAY_SEL).forEach(function (el) {
        if (el.closest('main.view') || !shownEl(w, el)) return;   /* main.view 裡的已經掃過；離場中的舊 view 不算 */
        roots.push({ el: el, where: '〔浮層 ' + describe(el) + '〕' });
      });
    }
    const dp = appObj.$('#demo-panel');
    if (dp && shownEl(w, dp)) roots.push({ el: dp, where: '〔#demo-panel〕' });
    /* 巢狀的只留最外層（.sys-share 是 .scrim，裡面還有 .sharesheet） */
    return roots.filter(function (r) {
      return !roots.some(function (o) { return o !== r && o.el !== r.el && o.el.contains(r.el); });
    });
  }

  /* ------------------------------------------------------------ iframe */
  function ensureFrame() {
    if (frame) return frame;
    frame = document.getElementById('app-frame');
    if (!frame) {
      frame = document.createElement('iframe');
      frame.id = 'app-frame';
      document.body.appendChild(frame);
    }
    return frame;
  }

  function win() { try { return ensureFrame().contentWindow; } catch (e) { return null; } }
  function doc() { try { return ensureFrame().contentDocument; } catch (e) { return null; } }

  /* 盡早把錯誤攔截器裝進新文件：導覽一 commit（location 變了、readyState=loading）就裝，
     這樣連 app.js 載入時丟的例外都抓得到。 */
  function hookErrors(seq) {
    let lastWin = null;
    (function poll() {
      if (seq !== loadSeq) return;
      let w = null, d = null;
      try { w = frame.contentWindow; d = frame.contentDocument; } catch (e) {}
      if (w && d && w !== lastWin && String(w.location.href) !== 'about:blank' && !w.__harnessHooked) {
        lastWin = w;
        try {
          w.__harnessHooked = true;
          w.addEventListener('error', function (ev) {
            if (ev && ev.target && ev.target !== w && ev.target.tagName) {
              errors.push('資源載不到：' + (ev.target.src || ev.target.href || ev.target.tagName));
            } else {
              errors.push((ev.message || 'error') + (ev.filename ? ' @' + ev.filename.split('/').pop() + ':' + ev.lineno : ''));
            }
          }, true);
          w.addEventListener('unhandledrejection', function (ev) {
            const r = ev.reason;
            errors.push('unhandledrejection：' + (r && r.message ? r.message : String(r)));
          });
        } catch (e) { /* 跨來源：手動用瀏覽器開而沒有 --allow-file-access-from-files */ }
      }
      if (d && d.readyState === 'complete' && w && w.__harnessHooked) return;
      setTimeout(poll, 2);
    })();
  }

  function load(hash) {
    const fr = ensureFrame();
    loadSeq++;
    const seq = loadSeq;
    return new Promise(function (resolve, reject) {
      const t0 = performance.now();
      fr.onload = function () {
        fr.onload = null;
        let d = null;
        try { d = fr.contentDocument; } catch (e) {}
        if (!d || !d.documentElement) {
          return reject(new Error('iframe 讀不到 contentDocument（手動開請用 Chrome --allow-file-access-from-files 或 app/tools/serve.py）'));
        }
        waitFor(function () { return d.documentElement.getAttribute('data-app-ready') === '1'; },
          READY_TIMEOUT, 'html[data-app-ready="1"]')
          .then(function () { readyMs = Math.round(performance.now() - t0); resolve(); })
          .catch(function (e) {
            const w = win();
            const why = !w || !w.APP ? '（window.APP 不存在：app/js/app.js 沒載到或載入時丟例外）' : '';
            reject(new Error(e.message + why + (errors.length ? '；錯誤：' + errors.slice(0, 2).join('；') : '')));
          });
      };
      errors = [];
      errOffset = 0;
      readyMs = null;
      fr.src = (stillMode ? APP_URL + '&' : APP_BASE + '?') + '_=' + seq + (hash ? '#' + hash : '');
      hookErrors(seq);
    });
  }

  function blank() {
    const fr = ensureFrame();
    loadSeq++;
    return new Promise(function (resolve) {
      fr.onload = function () { fr.onload = null; resolve(); };
      fr.src = 'about:blank';
      setTimeout(resolve, 1000);
    });
  }

  /* ------------------------------------------------------------ app 物件（§6.2） */
  const app = {
    get win() { return win(); },
    get doc() { return doc(); },
    get APP() { const w = win(); return w && w.APP; },
    get STATE() { const w = win(); return w && w.STATE; },
    get MOCK() { const w = win(); return w && w.MOCK; },
    /* 延伸：iframe 裡記到的錯誤（每次 go／reset／reload 前清空）與上次載入到 app-ready 的毫秒數 */
    get errors() { return errors.concat(appErrors()); },
    get readyMs() { return readyMs; },
    clearErrors: function () { errors = []; errOffset = appErrText().length; },

    $: function (sel) { const d = doc(); return d ? d.querySelector(sel) : null; },
    $$: function (sel) { const d = doc(); return d ? Array.prototype.slice.call(d.querySelectorAll(sel)) : []; },
    text: function (sel) {
      const el = app.$(sel);
      return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null;
    },
    view: function () { return app.$('main.view[data-view]'); },

    route: function () {
      const A = app.APP;
      if (!A || !A.nav || !A.nav.current) return { path: null };
      const r = A.nav.current() || {};
      return r;
    },

    waitFor: waitFor,
    tick: function (ms) { return tickGuarded(ms == null ? 50 : ms); },

    /* 導覽並等 data-view-ready 且 route().path 相符。
       opt.expect：預期落地的 path（例 go('/') 會導到 '/ride'）
       opt.redirectOk：落在任何 path 都算（有狀態前提的流程頁用），回傳落地 path */
    go: function (path, opt) {
      opt = opt || {};
      const A = app.APP;
      if (!A || !A.nav || !A.nav.go) return Promise.reject(new Error('APP.nav.go 不存在'));
      app.clearErrors();
      const want = stripQuery(opt.expect || path);
      const before = stripQuery(app.route().path);
      const t0 = Date.now();
      A.nav.go(path);
      return waitFor(function () {
        const d = doc();
        if (!d || d.documentElement.getAttribute('data-view-ready') !== '1') return false;
        const now = stripQuery(app.route().path);
        if (now === want) return now;
        if (opt.redirectOk && Date.now() - t0 > 300 && (now !== before || before === want)) return now;
        return false;
      }, opt.ms || 4000, 'go(' + path + ') 落在 ' + want + ' 且 data-view-ready');
    },

    at: function (path, ms) {
      const want = stripQuery(path);
      return waitFor(function () {
        const d = doc();
        return d && d.documentElement.getAttribute('data-view-ready') === '1' &&
          stripQuery(app.route().path) === want;
      }, ms || 4000, 'at(' + path + ')，目前 ' + stripQuery(app.route().path));
    },

    /* click(sel|el, ms) 或 click(sel|el, { ms, hit:true })。
       預設跟以前一樣直接 el.click()（藏起來的元素也點得到）。
       hit:true 先做命中測試：元素中心點的 elementFromPoint 必須是它自己或它的子孫，
       不然就丟例外（display:none、寬高 0、被浮層蓋住、pointer-events:none 都算點不到）。 */
    click: function (sel, opt) {
      const o = typeof opt === 'number' ? { ms: opt } : (opt || {});
      return waitFor(function () { return typeof sel === 'string' ? app.$(sel) : sel; },
        o.ms || 2000, 'click 找不到 ' + sel)
        .then(function (el) {
          const w = win();
          if (o.hit) hitTest(el, sel);
          if (typeof el.click === 'function') el.click();
          else el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, view: w }));
          return sleep(30).then(function () { return el; });
        });
    },

    /* 清兩把 localStorage、預設略過 onboarding、重載、等 app-ready。
       opt.onboarded=false 可測 welcome；opt.store 會合併進 app store 的初值。
       opt.cards：[{ id, date, by, note, km }]，在 demo 的 8 張之外照順序多收這幾張（id 可以是地點或明信片，
       date 預設今天、by 預設 walk），收完再重載一次：app 是從存好的狀態開起來的，跟真的收過一樣。 */
    reset: function (opt) {
      opt = opt || {};
      stillMode = opt.still !== false;
      return blank().then(function () {
        try {
          localStorage.removeItem(KEYS.state);
          localStorage.removeItem(KEYS.store);
          const s = Object.assign({ onboarded: opt.onboarded !== false }, opt.store || {});
          localStorage.setItem(KEYS.store, JSON.stringify(s));
        } catch (e) { /* 私密視窗 */ }
        return load(opt.hash);
      }).then(function () {
        if (!opt.cards || !opt.cards.length) return;
        const w = win();
        opt.cards.forEach(function (c) {
          const ok = w.STATE.collect(c.id, { date: c.date || w.APP.fmt.todayMMDD(), by: c.by || 'walk', note: c.note || '', km: c.km });
          if (!ok) throw new Error('reset({cards})：' + c.id + ' 收不下來（不認得或已經收過）');
        });
        return load(opt.hash);
      });
    },

    /* 延伸：不清狀態只重載（測持久化用） */
    reload: function (hash, opt) {
      if (opt && opt.still != null) stillMode = opt.still !== false;
      return blank().then(function () { return load(hash); });
    },
    get still() { return stillMode; },
    storage: function (key) {
      try { return JSON.parse(localStorage.getItem(KEYS[key] || key)); } catch (e) { return null; }
    },
    KEYS: KEYS,
  };

  /* ------------------------------------------------------------ 斷言 */
  function record(ok, msg) {
    if (!current) return ok;
    current.asserts++;
    if (!ok) current.fails.push(msg);
    return ok;
  }

  /* href="#/…" 要指到「已註冊」的 route：用 APP.resolve（app.js 提供）比對，
     落到 _404（catch-all）或 _placeholder（§8 有列但還沒有區塊註冊）都不算。 */
  function routeKnown(A, path) {
    path = stripQuery(path);
    let m = null;
    try {
      if (A && typeof A.resolve === 'function') m = A.resolve(path);
      else if (A && A.nav && typeof A.nav.match === 'function') m = A.nav.match(path);
      else return true; /* 沒有匹配函式：無從判斷，放行 */
    } catch (e) { return false; }
    if (!m) return false;
    const name = m.name || m.view || '';
    return !/^(_404|404|notfound|_placeholder)$/i.test(name) && m.pattern !== '/*';
  }

  function hasBehavior(el, A) {
    if (el.onclick) return true;
    if (el.hasAttribute('data-back')) return el.tagName === 'A' ? true : 'back-not-a';
    for (let i = 0; i < BEHAVIOR_ATTRS.length; i++) if (el.hasAttribute(BEHAVIOR_ATTRS[i])) return true;
    const href = el.getAttribute('href');
    if (href && href.indexOf('#/') === 0) return routeKnown(A, href.slice(1)) ? true : 'unknown-route';
    /* 另開分頁的真連結（demo 面板的「原型總覽」）：不會把 app 導走，算有行為 */
    if (el.tagName === 'A' && href && href[0] !== '#' && !/^javascript:/i.test(href) &&
        el.getAttribute('target') === '_blank') return true;
    return false;
  }

  function label(el) {
    return (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 18) ||
      el.getAttribute('aria-label') || el.getAttribute('data-act') || el.className || el.tagName;
  }

  const t = {
    ok: function (cond, msg) { return record(!!cond, msg || 'ok 失敗'); },
    eq: function (a, b, msg) {
      return record(a === b, (msg ? msg + '：' : '') + '得到 ' + short(a) + '，預期 ' + short(b));
    },
    includes: function (hay, needle, msg) {
      const ok = hay != null && (typeof hay === 'string' || Array.isArray(hay)) && hay.indexOf(needle) >= 0;
      return record(ok, (msg ? msg + '：' : '') + short(hay) + ' 不含 ' + short(needle));
    },
    fail: function (msg) { return record(false, msg || 'fail'); },

    /* 死按鈕：main.view、#tabbar、看得到的浮層與 #demo-panel（見 scanRoots）內的 a／button／[role=button] 都要有行為 */
    noDeadButtons: function (appObj, msg) {
      appObj = appObj || app;
      const A = appObj.APP;
      const dead = [];
      const seen = new Set();
      scanRoots(appObj).forEach(function (r) {
        const root = r.el;
        root.querySelectorAll('a, button, [role="button"]').forEach(function (el) {
          if (seen.has(el)) return;
          seen.add(el);
          let b = hasBehavior(el, A);
          if (b === true) return;
          /* 祖先可按也算（整列是一個連結） */
          let p = el.parentElement;
          while (p && p !== root.parentElement) {
            if (hasBehavior(p, A) === true) return;
            p = p.parentElement;
          }
          dead.push(label(el) + (b === 'unknown-route' ? '（' + el.getAttribute('href') + ' 不是已註冊的 route）' :
            b === 'back-not-a' ? '（data-back 要放在 <a> 上，router 只攔 a[data-back]）' : '') + r.where);
        });
      });
      return record(dead.length === 0, (msg ? msg + '：' : '') + '死按鈕 ' + dead.length + ' 個：' + dead.join('、'));
    },

    /* 禁用詞：main.view、#tabbar、看得到的浮層（推播、分享、確認框、吐司…）與顯示中的 #demo-panel 的
       文字節點＋title／aria-label／placeholder 屬性＋document.title */
    noBannedWords: function (appObj, opt) {
      appObj = appObj || app;
      opt = opt || {};
      const allow = WORD_OK.concat(opt.allow || []);
      const d = appObj.doc;
      const hits = [];
      function scan(txt, where) {
        if (!txt) return;
        allow.forEach(function (w) { txt = txt.split(w).join('　'); });
        BANNED.forEach(function (w) {
          const i = txt.indexOf(w);
          if (i >= 0) hits.push(w + '「' + txt.slice(Math.max(0, i - 8), i + w.length + 8).replace(/\s+/g, ' ').trim() + '」' + where);
        });
      }
      if (d) scanRoots(appObj).forEach(function (r) {
        const root = r.el;
        const walker = d.createTreeWalker(root, 4 /* SHOW_TEXT */, null);
        let n;
        while ((n = walker.nextNode())) {
          const par = n.parentElement;
          if (par && par.closest('script, style, template, noscript')) continue;
          scan(n.nodeValue, r.where);
        }
        [root].concat(Array.prototype.slice.call(root.querySelectorAll('[title], [aria-label], [placeholder]'))).forEach(function (el) {
          ['title', 'aria-label', 'placeholder'].forEach(function (a) {
            if (el.hasAttribute(a)) scan(el.getAttribute(a), '（' + a + '）' + r.where);
          });
        });
      });
      if (d) scan(d.title, '（document.title）');
      return record(hits.length === 0, (opt.msg ? opt.msg + '：' : '') + '禁用詞 ' + hits.join('、'));
    },

    /* CSS 不准寫 hex 色碼：只看宣告值（selector 的 #id 不算），註解與 url() 不算 */
    noHardcodedHex: function (cssText, name) {
      const src = String(cssText || '').replace(/\/\*[\s\S]*?\*\//g, function (m) {
        return m.replace(/[^\n]/g, ' ');
      });
      const hits = [];
      const re = /([-\w]+)\s*:\s*([^;{}]+)(?=[;}])/g;
      let m;
      while ((m = re.exec(src))) {
        const val = m[2].replace(/url\([^)]*\)/g, '');
        const h = val.match(/#[0-9a-fA-F]{3,8}\b/g);
        if (h) {
          const line = src.slice(0, m.index).split('\n').length;
          hits.push((name ? name + ':' : '') + line + ' ' + m[1] + ': ' + h.join(' '));
        }
      }
      return record(hits.length === 0, 'hex 色碼 ' + hits.length + ' 處：' + hits.slice(0, 8).join('、'));
    },

    /* 可按數（沿用 prototype/tools/audit-load.html 的量法；地圖景點 .spot 與 tab bar 不算） */
    countTappables: function (appObj) {
      appObj = appObj || app;
      const w = appObj.win;
      const root = appObj.$('main.view[data-view]');
      if (!root || !w) return 0;
      function shown(el) {
        const r = el.getBoundingClientRect();
        if (!(r.width > 0 && r.height > 0)) return false;
        const s = w.getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0;
      }
      const all = Array.prototype.slice.call(root.querySelectorAll('a[href], button, [role=button], .pill, .sw-toggle'));
      const keep = all.filter(function (el) {
        if (!shown(el)) return false;
        if (el.closest('.spot, .tabbar, .statusbar, [data-expand-only]')) return false;
        const href = el.getAttribute('href');
        if (href === '#' && !el.onclick && !el.hasAttribute('data-toast') &&
            !el.hasAttribute('data-share') && !el.hasAttribute('data-back')) return false;
        return true;
      });
      const set = new Set(keep);
      const top = keep.filter(function (el) {
        let p = el.parentElement;
        while (p && p !== root.parentElement) { if (set.has(p)) return false; p = p.parentElement; }
        return true;
      });
      /* [data-gallery]：一整片同一種東西的格子（例：/postcards 收下的明信片網格）不管裡面幾格都算一個，
         跟地圖上的景點不算一樣 —— 認知上是「一面牆」一件事，一格一格算的話 22 張卡就把 L1 的上限吃光。 */
      const galleries = new Set();
      return top.filter(function (el) {
        const g = el.closest('[data-gallery]');
        if (!g || !root.contains(g)) return true;
        if (galleries.has(g)) return false;
        galleries.add(g);
        return true;
      }).length;
    },
  };

  /* ------------------------------------------------------------ 登記與執行 */
  function spec(name, fn) {
    const s = { name: name, tests: [] };
    const tt = Object.create(t);
    tt.test = function (tname, tfn, opt) {
      s.tests.push({ name: tname, fn: tfn, timeout: (opt && opt.timeout) || (typeof opt === 'number' ? opt : DEFAULT_TIMEOUT) });
    };
    try { fn(tt); } catch (e) {
      s.tests.push({ name: '（spec 登記時丟例外）', fn: function () { throw e; }, timeout: 1000 });
    }
    specs.push(s);
  }

  function runTest(tc) {
    const rec = { name: tc.name, ok: false, msg: '', ms: 0, asserts: 0, fails: [] };
    gen++;
    current = rec;
    const t0 = performance.now();
    let timer;
    const timeout = new Promise(function (_, reject) {
      timer = setTimeout(function () { gen++; reject(new Error('逾時 ' + tc.timeout + 'ms')); }, tc.timeout);
    });
    let p;
    try { p = Promise.resolve(tc.fn(app)); } catch (e) { p = Promise.reject(e); }
    return Promise.race([p, timeout]).then(function () {
      rec.ok = rec.fails.length === 0;
    }, function (e) {
      rec.ok = false;
      const s = stack2(e);
      rec.fails.push('例外：' + (e && e.message ? e.message : String(e)) + (s ? '（' + s + '）' : ''));
    }).then(function () {
      clearTimeout(timer);
      current = null;
      rec.ms = Math.round(performance.now() - t0);
      rec.msg = rec.ok ? rec.asserts + ' 個斷言' : rec.fails.join('；');
      delete rec.fails;
      return rec;
    });
  }

  function onlyFilter() {
    const q = new URLSearchParams(location.search);
    const only = q.get('only');
    return only ? only.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : null;
  }

  /* opt.only：['ride'] 或 'ride,album'；沒給就讀網址的 ?only= */
  async function run(opt) {
    opt = opt || {};
    let only = opt.only || onlyFilter();
    if (typeof only === 'string') only = only.split(',');
    const out = { specs: [], missing: missing.slice(), only: only, summary: {} };
    const list = specs.filter(function (s) { return !only || only.indexOf(s.name) >= 0; });
    if (only) {
      only.forEach(function (n) {
        if (!specs.some(function (s) { return s.name === n; })) {
          out.specs.push({ name: n, tests: [{ name: '（找不到這個 spec）', ok: false, msg: 'only=' + n + ' 沒有對應的 T.spec', ms: 0 }] });
        }
      });
    }
    const status = document.getElementById('status');
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const res = { name: s.name, tests: [] };
      if (status) status.textContent = '跑 ' + s.name + '…';
      /* spec 之間自動 reset 一次 */
      let setupErr = null;
      try { await app.reset(); } catch (e) { setupErr = e; }
      if (setupErr) {
        res.tests.push({ name: '（spec 開跑前 reset）', ok: false, msg: setupErr.message, ms: 0 });
        /* app 起不來就不用逐條等 timeout 了 */
        s.tests.forEach(function (tc) { res.tests.push({ name: tc.name, ok: false, msg: '略過：app 沒有就緒', ms: 0 }); });
      } else {
        for (let j = 0; j < s.tests.length; j++) {
          res.tests.push(await runTest(s.tests[j]));
        }
      }
      out.specs.push(res);
      render(out, false);
    }
    let pass = 0, fail = 0;
    out.specs.forEach(function (s) { s.tests.forEach(function (x) { if (x.ok) pass++; else fail++; }); });
    out.summary = { pass: pass, fail: fail, total: pass + fail, missing: missing.length, ok: fail === 0 };
    render(out, true);
    return out;
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function render(out, done) {
    const table = document.getElementById('table');
    if (table) {
      let h = '<table><tr><th>spec</th><th>test</th><th>結果</th><th>ms</th><th>訊息</th></tr>';
      out.specs.forEach(function (s) {
        s.tests.forEach(function (x) {
          h += '<tr class="' + (x.ok ? 'pass' : 'fail') + '"><td>' + esc(s.name) + '</td><td>' + esc(x.name) +
            '</td><td>' + (x.ok ? 'PASS' : 'FAIL') + '</td><td>' + x.ms + '</td><td>' + esc(x.msg) + '</td></tr>';
        });
      });
      h += '</table>';
      if (out.missing.length) h += '<p class="warn">找不到的 spec 檔：' + esc(out.missing.join('、')) + '</p>';
      table.innerHTML = h;
    }
    if (done) {
      const pre = document.getElementById('result');
      if (pre) pre.textContent = JSON.stringify(out);
      const st = document.getElementById('status');
      /* 找不到的 spec 檔＝那一塊整個沒跑：run.py 判 FAIL，這裡的標題也不說「全部通過」 */
      if (st) st.textContent = out.summary.ok && !out.missing.length ? '全部通過 ' + out.summary.pass + '/' + out.summary.total
        : !out.summary.ok ? '未通過 ' + out.summary.fail + '/' + out.summary.total
        : '未通過：找不到的 spec 檔 ' + out.missing.length + ' 個（其餘 ' + out.summary.pass + '/' + out.summary.total + '）';
      document.documentElement.setAttribute('data-tests-done', '1');
    }
  }

  /* ------------------------------------------------------------ 共用的路由表、測試資料、小工具（§6.2）
     以前每支 spec 各寫一份路由清單、一份 TAP_MAX、一份拖曳／返回／抽卡的小函式，
     新增一條 route 要改六個地方，忘了一個就少測一塊。現在只有這裡一份。 */

  /* §8 每條 route 一個範例網址（順序＝§8）。area＝「誰做」；flow＝有狀態前提、沒有狀態時會被導走的流程頁。
     app.spec 會拿它跟 APP.routes() 對帳：新增 route 沒在這裡放範例就 FAIL。 */
  const ROUTES = [
    { path: '/', expect: '/ride', area: 'core' },
    { path: '/welcome', area: 'system', flow: true },
    { path: '/ride', area: 'ride' },
    { path: '/dropoff', area: 'ride' },
    { path: '/pickup', area: 'ride' },
    { path: '/trip', area: 'ride', flow: true },
    { path: '/trip/done', area: 'ride', flow: true },
    { path: '/drawer', area: 'ride' },
    { path: '/points', area: 'ride' },
    { path: '/notify', area: 'ride' },
    { path: '/trips', area: 'ride' },
    { path: '/explore', area: 'explore' },
    { path: '/explore/map', area: 'explore' },
    { path: '/place/glass-kiln', area: 'explore' },
    { path: '/place/neiwan', area: 'explore' },
    { path: '/going/glass-kiln', area: 'explore', flow: true },
    { path: '/unlock/glass-kiln', area: 'explore', flow: true },
    { path: '/unlock/neiwan?ride=1', area: 'explore', flow: true },
    { path: '/routes', area: 'explore' },
    { path: '/route/rail', area: 'explore' },
    { path: '/album', area: 'album' },
    { path: '/badges', area: 'album' },
    { path: '/postcards', area: 'album' },
    { path: '/postcard/p1', area: 'album' },
    { path: '/badge/b1', area: 'album' },
    { path: '/footprint', area: 'album' },
    { path: '/lookback', area: 'album' },
    { path: '/week', area: 'album' },
    { path: '/elder', area: 'album' },
    { path: '/settings', area: 'system' },
  ];

  /* T.routes(opt) → 範例網址（每次回新的物件）
     opt.area   'ride' 或 ['ride', 'album']：只要這幾區的
     opt.root   false：不要 '/'（它會被導到 /ride）
     opt.skip   ['/trip', …]：拿掉這幾條
     opt.extra  ['/place/p13', …]：這支 spec 另外要測的網址，接在後面（重複的不加） */
  function routes(opt) {
    opt = opt || {};
    const areas = opt.area == null ? null : [].concat(opt.area);
    const skip = opt.skip || [];
    const out = ROUTES.filter(function (r) {
      if (areas && areas.indexOf(r.area) < 0) return false;
      if (opt.root === false && r.path === '/') return false;
      return skip.indexOf(r.path) < 0;
    }).map(function (r) { return Object.assign({}, r); });
    (opt.extra || []).forEach(function (x) {
      const r = typeof x === 'string' ? { path: x } : Object.assign({}, x);
      if (!out.some(function (o) { return o.path === r.path; })) out.push(r);
    });
    return out;
  }

  /* §6.3-4 可按數上限：/explore 與 /album 兩個索引頁 12，其餘 10（query 不算：/album?tab=… 也是 12） */
  const TAP_MAX = { '/explore': 12, '/album': 12 };
  function tapMax(path) { return TAP_MAX[stripQuery(path)] || 10; }

  /* store 的初值：行程與下車點的形狀在契約 §3.3，只在這裡寫一次；要別的地方、別的階段用 overrides */
  const FIX_T0 = '2026-09-21T13:18:00.000Z';
  const fixtures = {
    T0: FIX_T0,
    trip: function (o) {
      return Object.assign({ placeId: 'neiwan', phase: 'riding', startedAt: FIX_T0, rated: false, km: 28 }, o || {});
    },
    dropoff: function (o) {
      return Object.assign({ id: 'neiwan', name: '內灣老街', km: 28, setAt: FIX_T0, via: 'k1' }, o || {});
    },
  };

  const helpers = {
    /* 目前畫面裡看得到的返回鍵（<a data-back>） */
    clickBack: function (appObj) { return appObj.click('main.view[data-view] a[data-back]'); },
    /* router 蓋在 history.state 上的序號 */
    histI: function (appObj) { const s = appObj.win.history.state; return s && s.i; },
    /* 在拉把上拖 dy（正＝往下）：pointerdown 在拉把上、move／up 在 window 上（跟手指一樣）。
       opt：id（pointerId，預設 1）、init（PointerEvent 其他欄位）、hold（不放手，回傳放手函式） */
    drag: function (appObj, grip, dy, opt) {
      opt = opt || {};
      const W = appObj.win, b = grip.getBoundingClientRect(), y = b.top + 10;
      const ev = function (type, yy) {
        return new W.PointerEvent(type, Object.assign({ bubbles: true, pointerId: opt.id || 1, clientY: yy }, opt.init || {}));
      };
      grip.dispatchEvent(ev('pointerdown', y));
      W.dispatchEvent(ev('pointermove', y + dy));
      const up = function () { W.dispatchEvent(ev('pointerup', y + dy)); };
      if (opt.hold) return up;
      up();
    },
    /* 非 still 的抵達：點發光的地方 → 收集明信片 → 一路點畫面（蓄力快轉 → 翻開 → 看結果），停在 data-at=3 */
    drawThrough: async function (appObj) {
      await appObj.click('[data-act="open-spot"]');
      await appObj.click('[data-act="draw"]');
      await appObj.waitFor(function () { return appObj.$('[data-unlock]').getAttribute('data-at') !== '1'; }, 2000, '進入抽卡');
      for (let i = 0; i < 16 && appObj.$('[data-unlock]').getAttribute('data-at') !== '3'; i++) {
        await appObj.click('[data-unlock]');
        await appObj.tick(300);
      }
      await appObj.waitFor(function () { return appObj.$('[data-unlock]').getAttribute('data-at') === '3'; }, 6000, '抽卡結果');
    },
  };

  window.T = {
    spec: spec,
    run: run,
    missing: function (src) { if (missing.indexOf(src) < 0) missing.push(src); },
    app: app,
    t: t,
    BANNED: BANNED,
    WORD_OK: WORD_OK,
    KEYS: KEYS,
    ROUTES: ROUTES,
    routes: routes,
    TAP_MAX: TAP_MAX,
    tapMax: tapMax,
    fixtures: fixtures,
    helpers: helpers,
    _specs: specs,
  };
})();
