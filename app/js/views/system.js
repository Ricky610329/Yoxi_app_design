/* ==========================================================================
   yoxi 城事 web app — system 區塊
   /welcome（onboarding 三張）、/settings（城事設定）、
   APP.ui.push（推播浮層）、APP.ui.share（分享面板）、#demo-panel（桌機 demo 工具）。

   回答什麼：
   - 第一次打開的人三句話內知道城事是什麼（不搭車也會打開／發現到叫車一步／一天變明信片）。
   - 用了你哪些資料、什麼時候找你、誰看得到什麼 —— 隱私敘事在設定頁實體化。
   - 現場 demo 要能自己觸發推播、模擬抵達、重設，不用改程式。
   從哪張原型來：
   - screens/settings.html（開關文案、隱私分軌、清除我的足跡）
   - screens/push.html（早上 8:10、晚上 21:30 兩則）、js/shell.js 的 showPush()／shareSheet()
   - index.html 的「六扇門」＋ js/catalog.js 的 FLOWS.proves（onboarding 三句）
   刻意沒有的東西：
   - 登入、帳號、未讀數字、推播頻率設定（上限就是兩則，不給調高）。
   - 分享面板沒有「日誌／心情」；「傳給家人」不離開 app（原型是 href="elder.html"，這裡指 #/elder）。
   - 照片授權沒有外部連結（app 內不連網，也不留死按鈕），只列作者與授權。
   ========================================================================== */

(function () {
'use strict';

const VERSION = 'chengshi-app-v13';
const PUSH_TIME = { am: '8:10', pm: '21:30' };       /* 推播浮層上的鎖定畫面時間（demo 設定，不是真實時間） */
const PUSH_KEY = { am: 'pushAm', pm: 'pushPm' };
const PUSH_MAX = 2;                                  /* 一天最多兩則 */
const WEEKDAY = '日一二三四五六';

const esc = APP.esc;
const $ = function (sel, root) { return (root || document).querySelector(sel); };

/* --------------------------------------------------------------------------
   小工具
   -------------------------------------------------------------------------- */
function sameDay(iso, d) {
  const a = new Date(iso);
  d = d || new Date();
  return !isNaN(a) && a.getFullYear() === d.getFullYear() && a.getMonth() === d.getMonth() && a.getDate() === d.getDate();
}

function todayPushes() {
  return (APP.store.get('pushes') || []).filter(function (p) { return p && sameDay(p.at); });
}

/* pushes 只留今天的；有變才寫（避免無謂的 store:change） */
function prunePushes() {
  const all = APP.store.get('pushes') || [];
  const keep = todayPushes();
  if (keep.length !== all.length) APP.store.set('pushes', keep);
}

function dateLabel(d) {
  d = d || new Date();
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + WEEKDAY[d.getDay()];
}

function emitState() { APP.emit('state:change'); }

/* 最近走過的 path（模擬抵達要知道「剛剛是不是在前往中」） */
const recent = [];
function lastWorkPath() {
  for (let i = recent.length - 1; i >= 0; i--) {
    const p = recent[i];
    if (p.pattern !== '/settings' && p.pattern !== '/drawer' && p.pattern !== '/welcome') return p;
  }
  return null;
}

/* 模擬抵達：回傳 null 表示現在沒有可以抵達的東西 */
function arriveTarget(cur) {
  cur = cur || lastWorkPath();
  const t0 = APP.store.get('trip');
  const riding = t0 && t0.phase !== 'done';
  /* 行程進行中的 /going 顯示的是「你正在搭車」卡，模擬抵達要抵達的是那一趟 */
  if (cur && cur.pattern === '/going/:id' && cur.params && cur.params.id && !riding) {
    const id = cur.params.id;
    return function () { APP.store.set('arrivedDemo', id); APP.nav.go('/unlock/' + encodeURIComponent(id)); };
  }
  const onTrip = cur && cur.pattern === '/trip';
  if (onTrip || APP.store.get('trip')) {
    return function () {
      if (APP.ride && typeof APP.ride.arrive === 'function') APP.ride.arrive();
      else APP.nav.go('/trip/done');
    };
  }
  return null;
}

/* 浮層一律從這裡拆：順便還焦點、拿掉 Esc 的 listener */
function dropOverlay(el) {
  if (!el) return;
  el.remove();
  if (typeof el._release === 'function') el._release();
}
function closeOverlays() {
  document.querySelectorAll('.device > .pushmock, .device > .sys-share').forEach(dropOverlay);
}

/* 清除我的足跡：真的清空（不是回到 demo 初始的 8 張）。
   state.js 沒有清空的 API；STATE.all 回傳的是活物件，改完用 setToday() 觸發 save。 */
function wipeFootprint() {
  if (window.STATE) {
    const A = STATE.all;
    A.cards = {};
    A.km = 0;
    A.lastCard = null;
    A.lastSeen = null;
    A.today = { photo: null, mood: null, done: false };
    STATE.setToday({ photo: null, mood: null, done: false });
  }
  APP.store.patch({ dropoff: null, trip: null, arrivedDemo: null });
  emitState();
}

function resetDemo() {
  return APP.ui.confirm({ text: '回到 demo 初始狀態（8 張明信片、原本的點數與設定）？', yes: '重設', no: '先不要' })
    .then(function (yes) {
      if (!yes) return false;
      closeOverlays();
      if (window.STATE) STATE.reset();
      APP.store.reset();
      APP.store.set('onboarded', true);       /* 重設不該再看一次 onboarding */
      emitState();
      APP.nav.go('/ride', { replace: true });
      APP.ui.toast('demo 已重設');
      return true;
    });
}

/* --------------------------------------------------------------------------
   APP.ui.push({ when:'am'|'pm', force })
   -------------------------------------------------------------------------- */
function push(opt) {
  opt = opt || {};
  const when = opt.when === 'pm' ? 'pm' : 'am';
  const settings = (window.STATE && STATE.all.settings) || {};
  if (!settings[PUSH_KEY[when]]) { APP.ui.toast('這一則推播你關掉了'); return null; }

  const today = todayPushes();
  const sent = today.some(function (p) { return p.when === when; });
  if (!opt.force) {
    if (sent) { APP.ui.toast('這一則今天已經發過'); return null; }
    if (today.length >= PUSH_MAX) { APP.ui.toast('今天已經發過兩則'); return null; }
  }

  const M = window.MOCK || {};
  let title, body, to;
  if (when === 'am') {
    title = '今天的地方：' + ((M.TODAY && M.TODAY.name) || '');
    body = (M.TODAY && M.TODAY.hook) || '';
    to = '/ride?mode=explore&area=' + encodeURIComponent((M.TODAY && M.TODAY.id) || 'glass-kiln');
  } else {
    const L = M.LOOKBACK || { km: 0, places: [] };
    title = '今天走了 ' + L.km + ' km，經過 ' + (L.places || []).length + ' 個地方';
    body = '點開看看今天多了哪一張';
    to = '/lookback';
  }

  /* 同一時間只有一張浮層 */
  document.querySelectorAll('.device > .pushmock').forEach(dropOverlay);

  const el = document.createElement('div');
  el.className = 'pushmock sys-push';
  el.setAttribute('data-push', when);
  el.innerHTML =
    '<div class="pushmock__clock">' +
      '<div class="pushmock__time">' + PUSH_TIME[when] + '</div>' +
      '<div class="pushmock__date">' + esc(dateLabel()) + '</div>' +
    '</div>' +
    '<a class="pushmock__card" href="#' + to + '" data-act="open-push">' +
      '<span class="pushmock__app">y</span>' +
      '<span>' +
        '<span class="sys-push__meta">yoxi 城事 · 現在</span>' +
        '<span class="pushmock__t">' + esc(title) + '</span>' +
        '<span class="pushmock__b">' + esc(body) + '</span>' +
      '</span>' +
    '</a>' +
    '<p class="sys-push__note">demo：一天最多兩則，早上一則、晚上一則</p>' +
    '<button class="pushmock__close sys-push__close" type="button" data-act="close-push">關閉</button>';

  el.querySelector('[data-act="open-push"]').onclick = function (e) {
    if (e) e.preventDefault();
    dropOverlay(el);
    /* 在 /welcome 用 demo 面板發推播、點進 app：等於看過介紹了，不然之後回 / 又被帶去 onboarding */
    if (!APP.store.get('onboarded')) APP.store.set('onboarded', true);
    APP.nav.go(to);
  };
  el.querySelector('[data-act="close-push"]').onclick = function () { dropOverlay(el); };

  const host = $('.device') || document.body;
  host.appendChild(el);
  el._release = APP.ui.a11yDialog(el, { label: '推播通知：' + title, onEsc: function () { dropOverlay(el); } });

  if (!sent) {
    APP.store.set('pushes', todayPushes().concat([{ when: when, at: new Date().toISOString() }]).slice(-PUSH_MAX));
  }
  return el;
}

/* --------------------------------------------------------------------------
   APP.ui.share(opt)：第一格永遠是「傳給家人」→ #/elder
   -------------------------------------------------------------------------- */
function share(opt) {
  opt = opt || {};
  const host = $('.device') || document.body;
  const old = host.querySelector(':scope > .sys-share');
  if (old) dropOverlay(old);

  const title = opt.title ||
    (opt.kind === 'postcard' ? '分享這張明信片' : opt.kind === 'week' ? '分享這一週' : '分享');

  const rows = [
    ['share-family', '傳給家人', '自動排成長輩圖：大字、吉祥話、你去過的地方'],
    ['share-save', '存成圖片', '存到相簿，原圖不含任何位置資訊'],
    ['share-link', '複製連結', '對方點開只看得到這一張，看不到你的其他紀錄'],
  ];

  const scrim = document.createElement('div');
  scrim.className = 'scrim sys-share';
  scrim.innerHTML =
    '<div class="sharesheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<div class="sharesheet__handle"></div>' +
      '<div class="sharesheet__t">' + esc(title) + '</div>' +
      rows.map(function (r, i) {
        return '<button class="row-nav" type="button" data-act="' + r[0] + '">' +
          (i === 0 ? '<span class="tile-icon tile-icon--md"><span data-icon="elder" class="sys-ico"></span></span>' : '') +
          '<span class="row-nav__body">' +
            '<span class="row-nav__title">' + r[1] + '</span>' +
            '<span class="row-nav__sub">' + r[2] + '</span>' +
          '</span><span class="arrow"></span></button>';
      }).join('') +
      '<div class="sharesheet__note">日誌與心情不會被分享</div>' +
    '</div>';

  const close = function () { dropOverlay(scrim); };
  scrim.onclick = function (e) { if (e.target === scrim) close(); };
  scrim.querySelector('[data-act="share-family"]').onclick = function () {
    close();
    APP.nav.go('/elder');
  };
  scrim.querySelector('[data-act="share-save"]').onclick = function () {
    close();
    APP.ui.toast('已存到相簿（demo）');
  };
  scrim.querySelector('[data-act="share-link"]').onclick = function () {
    close();
    const done = function () { APP.ui.toast('連結已複製'); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(location.href).then(done, done);
        return;
      }
    } catch (e) { /* 不支援就當作複製了（demo） */ }
    done();
  };

  if (window.SHELL) SHELL.injectIcons(scrim);
  host.appendChild(scrim);
  scrim._release = APP.ui.a11yDialog(scrim.querySelector('.sharesheet'), { label: title, onEsc: close });
  return scrim;
}

APP.ui.push = push;
APP.ui.share = share;

/* --------------------------------------------------------------------------
   /welcome：三張 onboarding
   -------------------------------------------------------------------------- */
const SLIDES = [
  { art: 'market', seed: 2, t: '不搭車的日子也會打開',
    p: '一天一個離你家不遠的地方，走路就到。不出遠門的日子，城事也有東西給你看。' },
  { art: 'glass', seed: 1, t: '發現一個地方，叫車去那裡只有一步',
    p: '看到想去的地方，按「設為下車點」，叫車首頁就幫你填好。走得到的，就走路去。' },
  { art: 'moat', seed: 3, t: '一天走過的路，變成明信片',
    p: '抵達時收下一張明信片；晚上回頭看今天。日誌只有你看得到。' },
];

APP.view('welcome', {
  path: '/welcome',
  tab: null,
  status: 'light',
  title: '歡迎',
  render: function () {
    return '' +
      '<div class="sys-welcome">' +
        '<div class="sys-welcome__bar">' +
          '<span class="sys-welcome__brand">yoxi 城事</span>' +
          '<button class="sys-welcome__skip" type="button" data-act="skip">略過</button>' +
        '</div>' +
        '<div class="sys-welcome__track" data-track>' +
          SLIDES.map(function (s, i) {
            return '<section class="sys-welcome__slide" data-slide="' + i + '" aria-label="第 ' + (i + 1) + ' 張">' +
              '<div class="sys-welcome__art" data-art="' + s.art + '" data-seed="' + s.seed + '">' +
                '<span class="ai-mark">AI 生成示意</span>' +
              '</div>' +
              '<div class="sys-welcome__text">' +
                '<h1 class="sys-welcome__t">' + esc(s.t) + '</h1>' +
                '<p class="sys-welcome__p">' + esc(s.p) + '</p>' +
              '</div>' +
            '</section>';
          }).join('') +
        '</div>' +
        '<div class="sys-welcome__foot">' +
          '<div class="sys-welcome__dots">' +
            SLIDES.map(function (s, i) {
              return '<button class="sys-welcome__dot' + (i === 0 ? ' is-on' : '') + '" type="button" data-dot="' + i +
                '" aria-label="第 ' + (i + 1) + ' 張"></button>';
            }).join('') +
          '</div>' +
          '<button class="btn-primary" type="button" data-act="next">下一張</button>' +
          '<button class="btn-primary" type="button" data-act="start" hidden>開始</button>' +
        '</div>' +
      '</div>';
  },
  mount: function (root) {
    const track = root.querySelector('[data-track]');
    const dots = Array.prototype.slice.call(root.querySelectorAll('[data-dot]'));
    const next = root.querySelector('[data-act="next"]');
    const start = root.querySelector('[data-act="start"]');
    let idx = 0;

    function show(i) {
      idx = Math.max(0, Math.min(SLIDES.length - 1, i));
      dots.forEach(function (d, k) {
        d.classList.toggle('is-on', k === idx);
        d.setAttribute('aria-current', k === idx ? 'true' : 'false');
      });
      const last = idx === SLIDES.length - 1;
      next.hidden = last;
      start.hidden = !last;
      root.setAttribute('data-slide-at', String(idx));
    }
    function goTo(i) {
      show(i);
      const w = track.clientWidth || 1;
      try { track.scrollTo({ left: idx * w, behavior: APP.reduceMotion() ? 'auto' : 'smooth' }); }
      catch (e) { track.scrollLeft = idx * w; }
    }
    track.onscroll = function () {
      const w = track.clientWidth || 1;
      const i = Math.round(track.scrollLeft / w);
      if (i !== idx) show(i);
    };
    dots.forEach(function (d) { d.onclick = function () { goTo(Number(d.getAttribute('data-dot'))); }; });
    next.onclick = function () { goTo(idx + 1); };

    const finish = function () {
      APP.store.set('onboarded', true);
      APP.nav.go('/ride', { replace: true });
    };
    start.onclick = finish;
    root.querySelector('[data-act="skip"]').onclick = finish;
    show(0);
  },
});

/* --------------------------------------------------------------------------
   /settings：城事設定
   -------------------------------------------------------------------------- */
const DATA = [
  ['place',  '常用地點', '用來判斷哪些地方你常經過卻沒進去過；關掉就只推薦車站附近', 'place'],
  ['sun',    '常用時段', '用來決定什麼時候推薦比較不打擾；關掉就固定在早上', 'time'],
  ['steps',  '步數',     '用來畫今天的回顧的路徑，資料留在手機上；關掉回顧就沒有路線', 'steps'],
  ['camera', '相簿',     '只在今天的回顧才讀取當天照片，不會上傳；關掉回顧就只有明信片', 'photos'],
  ['route',  '行程紀錄', '用來知道你搭車去過哪裡；關掉搭車抵達就不會自動收進足跡', 'trips'],
  ['place',  '探索模式的景點', '探索時在地圖顯示附近有卡片的地方；關掉後保留目前選定的地區', 'rideSpots'],
];
/* 這些開關存在 app 自己的 store（不是 STATE.settings） */
const STORE_SWITCH = { rideSpots: true };
function switchOn(key) {
  if (STORE_SWITCH[key]) return APP.store.get(key) !== false;
  const s = (window.STATE && STATE.all.settings) || {};
  return !!s[key];
}

function switchRow(icon, name, sub, key) {
  return '<div class="row-nav sys-set__row">' +
    '<span class="tile-icon tile-icon--md"><span data-icon="' + icon + '" class="sys-ico"></span></span>' +
    '<span class="row-nav__body">' +
      '<span class="row-nav__title sys-set__name">' + esc(name) + '</span>' +
      '<span class="row-nav__sub">' + esc(sub) + '</span>' +
    '</span>' +
    '<button class="sw-toggle" type="button" role="switch" data-switch="' + key + '" aria-label="' + esc(name) + '"></button>' +
  '</div>';
}

function creditsHTML() {
  const P = window.PHOTOS_DATA || {};
  const rows = [];
  Object.keys(P).forEach(function (k) {
    (P[k] || []).forEach(function (ph) {
      rows.push('<li><b>' + esc(ph.name) + '</b>　© ' + esc(ph.author) + ' / Wikimedia Commons，' + esc(ph.licence) + '</li>');
    });
  });
  return rows.length ? '<ul class="sys-set__credits">' + rows.join('') + '</ul>'
                     : '<p class="sys-set__small">這個版本沒有使用實景照片。</p>';
}

function syncSwitches(root) {
  root.querySelectorAll('[data-switch]').forEach(function (el) {
    const on = switchOn(el.getAttribute('data-switch'));
    el.classList.toggle('is-on', on);
    el.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}

APP.view('settings', {
  path: '/settings',
  tab: null,
  status: 'light',
  title: '城事設定',
  render: function () {
    return '' +
      '<header class="hdr-red">' +
        '<div class="hdr-red__bar">' +
          '<a class="hdr-red__close" href="#" data-back="/ride" aria-label="返回"><span data-icon="close"></span></a>' +
        '</div>' +
        '<h1 class="hdr-red__title">城事設定</h1>' +
        '<p class="hdr-red__sub">決定我們用你的哪些資料，以及什麼時候找你</p>' +
      '</header>' +
      '<div class="scroll sys-set">' +

        '<section class="sys-set__sec">' +
          '<div class="sec"><h2 class="sec__t sec__t--sm">什麼時候找你</h2></div>' +
          '<div class="card">' +
            switchRow('sun', '早上的地方', PUSH_TIME.am + '　今天的地方', 'pushAm') +
            switchRow('steps', '晚上的回顧', PUSH_TIME.pm + '　今天走過的路', 'pushPm') +
          '</div>' +
          '<div class="card card--pad sys-set__note">' +
            '<b>一天最多兩則。</b>我們不會為了讓你多打開 app 而多傳訊息給你。' +
            '兩則都可以各自關掉，關掉之後城事還是照常運作。' +
          '</div>' +
        '</section>' +

        '<section class="sys-set__sec">' +
          '<div class="sec"><h2 class="sec__t sec__t--sm">城事會用到的資料</h2><span class="sec__m">都可以單獨關掉</span></div>' +
          '<div class="card">' +
            DATA.map(function (d) { return switchRow(d[0], d[1], d[2], d[3]); }).join('') +
          '</div>' +
        '</section>' +

        '<section class="sys-set__sec">' +
          '<div class="card card--pad">' +
            '<div class="sys-set__privhd"><span data-icon="lock" class="sys-ico sys-ico--navy"></span><b>誰看得到什麼</b></div>' +
            '<div class="sys-set__priv">' +
              '<div class="sys-set__col"><span class="sys-set__who sys-set__who--me">只有你</span>' +
                '<span>日誌、心情、照片、走過的路線</span></div>' +
              '<div class="sys-set__col"><span class="sys-set__who">你可分享</span>' +
                '<span>明信片、獎章、週回顧、長輩圖</span></div>' +
            '</div>' +
            '<p class="sys-set__small">日誌沒有分享鍵，這是刻意的。要分享的東西跟要保護的東西，從一開始就分開放。</p>' +
          '</div>' +
        '</section>' +

        '<section class="sys-set__sec sys-set__sec--last">' +
          '<button class="sys-set__more" type="button" data-act="more" aria-expanded="false">' +
            '<span>清除足跡、demo 工具與關於</span><span class="sys-set__chev" aria-hidden="true"></span></button>' +
          '<div class="sys-set__morebox" data-more hidden>' +
            /* 可按數 ≤ 10：多了「探索模式的景點」開關，清除足跡收進展開區（它本來就不是常用的動作） */
            '<div class="sys-set__sec">' +
              '<button class="btn-ghost sys-set__wipe" type="button" data-act="wipe">清除我的足跡</button>' +
            '</div>' +
            '<div class="sec"><h2 class="sec__t sec__t--sm">demo 工具</h2><span class="sec__m">提案現場用</span></div>' +
            '<div class="sys-set__demo">' +
              '<button class="btn-ghost" type="button" data-act="push-am">早上推播</button>' +
              '<button class="btn-ghost" type="button" data-act="push-pm">晚上推播</button>' +
              '<button class="btn-ghost" type="button" data-act="arrive">模擬抵達</button>' +
              '<button class="btn-ghost" type="button" data-act="welcome">再看一次介紹</button>' +
              '<button class="btn-ghost sys-set__danger" type="button" data-act="reset-demo">重設 demo</button>' +
            '</div>' +
            '<p class="sys-set__small">叫車、抵達與推播都是模擬的。</p>' +

            '<div class="sec sys-set__abouthd"><h2 class="sec__t sec__t--sm">關於</h2></div>' +
            '<div class="card card--pad sys-set__about">' +
              '<p>版本 <code data-version>' + VERSION + '</code></p>' +
              '<p>地圖 © OpenStreetMap 貢獻者，ODbL 授權</p>' +
              '<p>插畫為程式生成示意，標著「AI 生成示意」的圖都是。</p>' +
              '<p class="sys-set__small">實景照片來自 Wikimedia Commons：</p>' +
              creditsHTML() +
            '</div>' +
          '</div>' +
        '</section>' +
      '</div>';
  },
  mount: function (root, params, ctx) {
    syncSwitches(root);
    root.querySelectorAll('[data-switch]').forEach(function (el) {
      el.onclick = function () {
        const k = el.getAttribute('data-switch');
        const on = !switchOn(k);
        if (STORE_SWITCH[k]) APP.store.set(k, on);
        else if (window.STATE) STATE.setSetting(k, on);
        el.classList.toggle('is-on', on);
        el.setAttribute('aria-checked', on ? 'true' : 'false');
        emitState();
      };
    });

    root.querySelector('[data-act="wipe"]').onclick = function () {
      APP.ui.confirm({ text: '會清掉這一個月的明信片、獎章、點數與日誌，而且不能復原。確定要清除？', yes: '清除', no: '先不要' })
        .then(function (yes) {
          if (!yes) return;
          wipeFootprint();
          syncSwitches(root);
          APP.ui.toast('足跡已清除');
        });
    };

    const more = root.querySelector('[data-act="more"]');
    const box = root.querySelector('[data-more]');
    more.onclick = function () {
      box.hidden = !box.hidden;
      more.setAttribute('aria-expanded', box.hidden ? 'false' : 'true');
      if (!box.hidden) {
        const sc = root.querySelector('.scroll');
        try { more.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { if (sc) sc.scrollTop = more.offsetTop; }
      }
    };

    root.querySelector('[data-act="push-am"]').onclick = function () { APP.ui.push({ when: 'am' }); };
    root.querySelector('[data-act="push-pm"]').onclick = function () { APP.ui.push({ when: 'pm' }); };
    root.querySelector('[data-act="welcome"]').onclick = function () { APP.nav.go('/welcome'); };
    root.querySelector('[data-act="reset-demo"]').onclick = function () { resetDemo(); };

    const arrive = root.querySelector('[data-act="arrive"]');
    const can = arriveTarget();
    arrive.classList.toggle('is-off', !can);
    arrive.onclick = function () {
      const go = arriveTarget();
      if (go) go(); else APP.ui.toast('先開始前往或叫車');
    };

    /* 別處改了設定（例如 demo 面板的重設）時同步開關 */
    return APP.on('state:change', function () { syncSwitches(root); });
  },
});

/* --------------------------------------------------------------------------
   #demo-panel（桌機，main.view 之外）
   -------------------------------------------------------------------------- */
let panelFilled = false;
let panelPick = null;      /* 下拉選單現在選的地方；換到有地點的頁面就跟著那一頁 */

/* demo 可以抵達的地方：地圖上的景點＋走不到的內灣（MOCK.FAR_PLACE） */
function demoPlaces() {
  const M = window.MOCK || {};
  const ids = (M.SPOTS || []).map(function (s) { return s.id; });
  if (M.FAR_PLACE && M.FAR_PLACE.id && ids.indexOf(M.FAR_PLACE.id) < 0) ids.push(M.FAR_PLACE.id);
  return ids.map(function (id) { return APP.place(id); }).filter(Boolean);
}
function placeGot(p) { return !!(p && p.card && window.STATE && STATE.has(p.card)); }

/* 這一頁在講哪個地方：地方詳情／前往中／抵達頁的 :id → 進行中行程的目的地 → 下車點 */
function contextPlace(cur) {
  const id = cur && cur.params && cur.params.id;
  if (cur && /^\/(place|going|unlock)\//.test(cur.pattern || '') && APP.place(id)) return APP.place(id).id;
  const t = APP.store.get('trip');
  if (t && t.phase !== 'done' && APP.place(t.placeId)) return APP.place(t.placeId).id;
  const d = APP.store.get('dropoff');
  if (d && APP.place(d.id)) return APP.place(d.id).id;
  return null;
}

/* demo 面板的模擬抵達（任何一頁都能用，地點從下拉選單挑）：
   走路     → 記下 arrivedDemo，進 /unlock/:id；行程進行中不行（人在車上）。
   搭 yoxi → 這一趟直接在這裡結束（store.trip phase done；原本是別的目的地就被這一趟取代，契約 §3.3 只有一筆 trip），
             進 /unlock/:id?ride=1。抵達頁會再驗一次 trip，所以手打網址拿不到金框。 */
function demoArrive(id, by) {
  const p = APP.place(id);
  if (!p) { APP.ui.toast('先選一個地方'); return false; }
  const t = APP.store.get('trip');
  if (by !== 'ride') {
    if (t && t.phase !== 'done') { APP.ui.toast('行程進行中，先抵達或取消行程'); return false; }
    APP.store.set('arrivedDemo', p.id);
    APP.nav.go('/unlock/' + encodeURIComponent(p.id));
    return true;
  }
  const same = !!(t && t.placeId === p.id);
  APP.store.patch({
    trip: {
      placeId: p.id, phase: 'done',
      startedAt: same && t.startedAt ? t.startedAt : new Date().toISOString(),
      rated: same && !!t.rated,
      km: same && t.km != null ? t.km : APP.fmt.km(p.dist),
      via: same ? (t.via || null) : null,
    },
    dropoff: null,
    arrivedDemo: p.id,
  });
  APP.nav.go('/unlock/' + encodeURIComponent(p.id) + '?ride=1');
  return true;
}

function fillPanel() {
  const panel = document.getElementById('demo-panel');
  if (!panel || panelFilled) return panel;
  panelFilled = true;
  panel.innerHTML =
    '<div class="demo-panel__t">demo 工具</div>' +
    '<button class="demo-panel__btn" type="button" data-act="push-am">早上推播</button>' +
    '<button class="demo-panel__btn" type="button" data-act="push-pm">晚上推播</button>' +
    '<div class="demo-panel__group" role="group" aria-labelledby="demo-arrive-t">' +
      '<label class="demo-panel__label" id="demo-arrive-t" for="demo-arrive-place">模擬抵達</label>' +
      '<select class="demo-panel__select" id="demo-arrive-place" data-demo-place></select>' +
      '<div class="demo-panel__row">' +
        '<button class="demo-panel__btn" type="button" data-act="arrive-walk">走路抵達</button>' +
        '<button class="demo-panel__btn demo-panel__btn--gold" type="button" data-act="arrive-ride">搭 yoxi 抵達</button>' +
      '</div>' +
    '</div>' +
    '<button class="demo-panel__btn" type="button" data-act="reset-demo">重設 demo</button>' +
    '<a class="demo-panel__btn demo-panel__btn--ghost" href="../prototype/index.html" target="_blank" rel="noopener" data-act="prototype">原型總覽</a>' +
    '<p class="demo-panel__note">這是提案用的 demo：叫車、抵達與推播都是模擬的。</p>';
  const sel = panel.querySelector('[data-demo-place]');
  sel.onchange = function () { panelPick = sel.value; };
  panel.querySelector('[data-act="push-am"]').onclick = function () { APP.ui.push({ when: 'am' }); };
  panel.querySelector('[data-act="push-pm"]').onclick = function () { APP.ui.push({ when: 'pm' }); };
  panel.querySelector('[data-act="reset-demo"]').onclick = function () { resetDemo(); };
  panel.querySelector('[data-act="arrive-walk"]').onclick = function () { demoArrive(sel.value, 'walk'); };
  panel.querySelector('[data-act="arrive-ride"]').onclick = function () { demoArrive(sel.value, 'ride'); };
  return panel;
}

/* 下拉選單：這一頁有地點就選它；沒有就留著上次選的（已經收過了就換成第一個還沒收的） */
function updatePanel(cur) {
  const panel = fillPanel();
  if (!panel) return;
  const sel = panel.querySelector('[data-demo-place]');
  const list = demoPlaces();
  const here = contextPlace(cur);
  if (here) panelPick = here;
  else if (panelPick && placeGot(APP.place(panelPick))) panelPick = null;
  if (!panelPick || !APP.place(panelPick)) {
    const first = list.filter(function (p) { return !placeGot(p); })[0] || list[0];
    panelPick = first ? first.id : null;
  }
  sel.innerHTML = list.map(function (p) {
    return '<option value="' + esc(p.id) + '">' + esc(p.name) + (placeGot(p) ? '（已收藏）' : '') + '</option>';
  }).join('');
  if (panelPick) sel.value = panelPick;
}

/* --------------------------------------------------------------------------
   訂閱（載入時，不在 view 內）
   -------------------------------------------------------------------------- */
APP.on('route:change', function (cur) {
  if (cur) {
    recent.push({ path: cur.path, pattern: cur.pattern, params: cur.params });
    if (recent.length > 8) recent.shift();
  }
  prunePushes();
  updatePanel(cur);
});
APP.on('state:change', function () { prunePushes(); updatePanel(APP.nav.current()); });

APP.system = { VERSION: VERSION, resetDemo: resetDemo, wipeFootprint: wipeFootprint, prunePushes: prunePushes, arriveTarget: arriveTarget, demoArrive: demoArrive };

})();
