/* ==========================================================================
   yoxi 城事 web app — album 區塊：相框與稱號（照進度累積的獎勵）
   契約：app/ARCHITECTURE.md §3、§7、§8。載入順序：album.js → 這支 → album-family.js。

   回答什麼：走過的路會換到什麼？每一個相框、每一個稱號都先寫好「怎麼拿到」與「現在走到哪」（收集 3/4），
             湊到了就收下，自己挑一個用：相框套在傳給家人的明信片上，稱號寫在收藏頁與傳出去的明信片上。
             進度只有五條，全部從已經收下的東西算（不另存一份）：
               去過的地方（APP.album.visitedPlaces）、一組獎章（STATE.badge）、同一個地方去幾次（APP.explore.visits）、
               搭 yoxi 累積幾公里（APP.explore.rideKm）、節日那一週收下幾張（cardOrigin 的 festival）。
   提供（APP.album，契約 §7）：
     rewards()                        全部獎勵＋進度：[{ key, kind:'frame'|'title', name, rule, done, total, got, prog }]
     look()                           現在用的 { frame: {key,name}|null, title: {key,name}|null }（還沒收下的不算）
     setLook({ frame?, title? })      換一個（'' 或 null＝不用）；寫 store.look
     cardHTML(cardId, { v, frame, size })   那一次的明信片（套上相框）：LINE 示意、子女那一頁、這一頁的預覽用
   畫面：/rewards 相框與稱號（預覽：最近收下的那一張套上現在的相框＋稱號；兩面牆：相框、稱號，收下的點一下就用）。
   從哪張原型來：新。章牆的語氣沿用 variant-x4-badges.html（「收集 n/m」、沒有期限）。

   刻意沒有的東西：
   - 機率、抽籤、保底、限時、限量：每一個都是固定的規則，走到就有，不會過期。
   - 排名、等級、「再 N 張就…」的催促：只寫 n/m；稱號不比高低（沒有「第一」「最強」）。
   - 預設的相框：沒選就是原本的卡面（明信片本身才是主角）。稱號沒選過時先用收下的第一個，讓家人一收到就看得到。
   - 顏色：相框全用 tokens（album-rewards.css），紅色不當框（紅只給品牌情緒）。
   數字一律從 STATE／MOCK／APP.explore 算；門檻是規則（寫在 REWARDS），改這裡畫面跟著變。按鈕一律 element.onclick。
   ========================================================================== */

(function () {
'use strict';

const APP = window.APP;
if (!APP || !APP.album || !APP.album._) throw new Error('album-rewards.js 要在 album.js 之後載入（index.html 的順序）');
const A = APP.album._;
const esc = APP.esc;

function M() { return window.MOCK || {}; }
function num(n) { return '<span class="num">' + esc(n) + '</span>'; }

/* ---------------------------------------------------------------- 進度
   每一條進度回傳 { done, total }；total 是這個獎勵的門檻 */
function festCount(key) {
  return APP.explore.recentVisits().filter(function (x) { return x.fest === key; }).length;
}
/* 同一個地方最多去過幾次（不同的明信片對到同一個地方的，各算各的：一張卡就是一個你記得的角落） */
function mostVisits() {
  return (M().POSTCARDS || []).reduce(function (m, p) { return Math.max(m, APP.explore.visits(p.id).length); }, 0);
}
function badgeTrack(id) {
  const r = STATE.badge(id);
  return { done: r.done, total: r.total };
}
const TRACK = {
  places: function (need) { return { done: APP.album.visitedPlaces().length, total: need }; },
  again:  function (need) { return { done: mostVisits(), total: need }; },
  mile:   function (need) { return { done: APP.explore.rideKm(), total: need }; },
  fest:   function (need, key) { return { done: festCount(key), total: need }; },
  badge:  function (need, id) { return badgeTrack(id); },
};
/* 進度怎麼念：「收集 n/m」的格式，接在規則後面念（「去過 10 個地方 · 8/10」），規則裡寫過的字不再寫一次 */
const PROG = {
  places: function (d, t) { return d + '/' + t; },
  again:  function (d, t) { return d + '/' + t + ' 次'; },
  mile:   function (d, t) { return d + '/' + t + ' 公里'; },
  fest:   function (d, t) { return d + '/' + t + ' 張'; },
  badge:  function (d, t) { return '收集 ' + d + '/' + t; },
};

/* 規則表（全 app 唯一來源）。門檻：去過的地方最多 19 個（22 張明信片、有幾張是同一個地方），
   里程接 explore-cards.js 的 MILE_STEPS（相框在第一個、稱號在 100）；節日的 key 對 FESTIVALS。 */
const MILE = (APP.explore && APP.explore.MILE_STEPS) || [30, 60, 100];
const FEST_NAME = {};
((APP.explore && APP.explore.FESTIVALS) || []).forEach(function (f) { FEST_NAME[f.key] = f.name; });
const REWARDS = [
  { key: 'bamboo', kind: 'frame', name: '竹塹', track: 'places', need: 5,  rule: '去過 5 個地方' },
  { key: 'wind',   kind: 'frame', name: '風城', track: 'places', need: 10, rule: '去過 10 個地方' },
  { key: 'friend', kind: 'frame', name: '老朋友', track: 'again', need: 3, rule: '同一個地方去 3 次' },
  { key: 'road',   kind: 'frame', name: '里程', track: 'mile', need: MILE[0], rule: '搭 yoxi 累積 ' + MILE[0] + ' 公里' },
  { key: 'spring', kind: 'frame', name: '春節', track: 'fest', arg: 'spring', need: 1, rule: '春節那一週收下一張' },
  { key: 'duanwu', kind: 'frame', name: '端午', track: 'fest', arg: 'duanwu', need: 1, rule: '端午那一週收下一張' },
  { key: 'moon',   kind: 'frame', name: '中秋', track: 'fest', arg: 'moon',   need: 1, rule: '中秋那一週收下一張' },
  { key: 'sakura', kind: 'frame', name: '櫻花', track: 'fest', arg: 'sakura', need: 1, rule: '櫻花季收下一張' },
  { key: 'walker',    kind: 'title', name: '新竹散步人',   track: 'places', need: 3,  rule: '去過 3 個地方' },
  { key: 'collector', kind: 'title', name: '城事收藏家',   track: 'places', need: 15, rule: '去過 15 個地方' },
  { key: 'b1', kind: 'title', name: '舊城散步人',   track: 'badge', arg: 'b1', rule: '湊齊〈舊城區〉' },
  { key: 'b3', kind: 'title', name: '老車站的常客', track: 'badge', arg: 'b3', rule: '湊齊〈老車站〉' },
  { key: 'b2', kind: 'title', name: '河港湖的旅人', track: 'badge', arg: 'b2', rule: '湊齊〈水路〉' },
  { key: 'b4', kind: 'title', name: '內灣線旅人',   track: 'badge', arg: 'b4', rule: '湊齊〈內灣線全線〉' },
  { key: 'b5', kind: 'title', name: '玻璃知音',     track: 'badge', arg: 'b5', rule: '湊齊〈風城玻璃〉' },
  { key: 'b6', kind: 'title', name: '山湖行者',     track: 'badge', arg: 'b6', rule: '湊齊〈山與湖〉' },
  { key: 'mile100', kind: 'title', name: 'yoxi 百里行', track: 'mile', need: 100, rule: '搭 yoxi 累積 100 公里' },
];

function withProgress(r) {
  const p = TRACK[r.track](r.need, r.arg);
  const total = p.total || r.need || 0;
  return {
    key: r.key, kind: r.kind, name: r.name, rule: r.rule, track: r.track,
    done: p.done, total: total, got: total > 0 && p.done >= total,
    /* 進度只寫到門檻為止（超過了也寫 5/5，不寫 8/5） */
    prog: PROG[r.track](Math.min(p.done, total), total),
  };
}
function rewards(kind) {
  return REWARDS.filter(function (r) { return !kind || r.kind === kind; }).map(withProgress);
}
function byKey(kind, key) {
  if (!key) return null;
  const r = REWARDS.filter(function (x) { return x.kind === kind && x.key === key; })[0];
  return r ? withProgress(r) : null;
}

/* ---------------------------------------------------------------- 現在用的
   store.look = { frame: key|null, title: key|null }：沒有這把鍵＝沒選過；選「不用」存 null。
   還沒收下的（清除足跡之後、或手改的）一律當作沒有 */
function look() {
  const L = APP.store.get('look') || {};
  const f = byKey('frame', L.frame);
  let t = byKey('title', L.title);
  if (!('title' in L)) t = rewards('title').filter(function (x) { return x.got; })[0] || null;
  return {
    frame: f && f.got ? { key: f.key, name: f.name } : null,
    title: t && t.got ? { key: t.key, name: t.name } : null,
  };
}
function setLook(patch) {
  const L = Object.assign({}, APP.store.get('look') || {});
  if (patch && 'frame' in patch) L.frame = patch.frame || null;
  if (patch && 'title' in patch) L.title = patch.title || null;
  APP.store.set('look', L);
  return look();
}

/* ---------------------------------------------------------------- 套上相框的明信片
   cardHTML(cardId, { v, frame, size })：v 是第幾次收下的（省略是第一次），frame 是相框 key（省略＝現在用的，'' 或 null＝不套）。
   卡面照收藏裡的疊法（data-card-art＋data-card-visit，explore-face.js 會自己疊上那一款），首訪、里程戳與節日插畫照 cardOrigin。
   還沒收下的卡回 ''。size：'sm' 是牆上的小卡（不蓋戳、不放插畫，免得一面牆都在動）。 */
function cardHTML(cardId, opt) {
  opt = opt || {};
  const P = A.cardById(cardId);
  const o = P ? APP.explore.cardOrigin(cardId, opt.v) : null;
  if (!P || !o) return '';
  const fk = 'frame' in opt ? opt.frame : (look().frame ? look().frame.key : '');
  const small = opt.size === 'sm';
  return '<span class="rw-card' + (small ? ' rw-card--sm' : '') + '"' + (fk ? ' data-frame="' + esc(fk) + '"' : '') +
      ' data-card="' + esc(cardId) + '" data-v="' + o.v + '">' +
      '<span class="postcard rw-card__pc' + (o.gold ? ' postcard--gold' : '') + '"' + (o.gold ? ' data-gold-aura' : '') + '>' +
        '<span class="rw-card__art" data-art="' + esc(P.art) + '" data-seed="' + A.cardIdx(P) + '" data-card-art="' + esc(cardId) + '"' +
          (o.v > 1 ? ' data-card-visit="' + o.v + '"' : '') + '></span>' +
        '<span class="ai-mark">AI 生成示意</span>' +
        (small ? '' : o.marks) +
        '<span class="postcard__foot"><span class="postcard__name">' + esc(P.name) + '</span>' +
          '<span class="postcard__date">' + esc(o.dateText) + '</span></span>' +
      '</span>' +
    '</span>';
}

/* ================================================================ /rewards */

function swatch(key) {
  return '<span class="rw-swatch"' + (key ? ' data-frame="' + esc(key) + '"' : '') + ' aria-hidden="true"><span class="rw-swatch__in"></span></span>';
}
function previewHTML() {
  const L = look();
  const last = APP.explore.recentVisits(1)[0];
  return (last
      ? cardHTML(last.card, { v: last.v, frame: L.frame ? L.frame.key : '' })
      : '<span class="rw-card rw-card--empty"' + (L.frame ? ' data-frame="' + esc(L.frame.key) + '"' : '') + '><span class="postcard rw-card__pc"></span></span>') +
    '<span class="rw-preview__txt">' +
      '<span class="rw-preview__k">現在用的</span>' +
      '<b class="rw-preview__t" data-look-frame>' + (L.frame ? esc(L.frame.name) + '相框' : '不用相框') + '</b>' +
      '<b class="rw-preview__t" data-look-title>' + (L.title ? '稱號：' + esc(L.title.name) : '不顯示稱號') + '</b>' +
      '<span class="rw-preview__p">傳給家人的明信片會套上這個相框、寫上這個稱號。</span>' +
    '</span>';
}
function frameTile(r, on) {
  const inner = swatch(r ? r.key : '') +
    '<strong>' + (r ? esc(r.name) : '不用相框') + '</strong>' +
    '<small>' + (r ? esc(r.rule) : '原本的卡面') + '</small>' +
    (r && !r.got ? '<small class="rw-tile__prog" data-prog>' + esc(r.prog) + '</small>' : '');
  if (r && !r.got) return '<div class="rw-tile is-locked" data-reward="' + esc(r.key) + '">' + inner + '</div>';
  return '<button class="rw-tile' + (on ? ' is-on' : '') + '" type="button" data-act="use-frame" data-reward="' + esc(r ? r.key : '') +
    '" aria-pressed="' + (on ? 'true' : 'false') + '">' + inner + '</button>';
}
function titleRow(r, on) {
  const inner = '<span class="rw-row__t">' + (r ? esc(r.name) : '不顯示稱號') + '</span>' +
    '<span class="rw-row__s">' + (r ? esc(r.rule) + (r.got ? '' : ' · <span data-prog>' + esc(r.prog) + '</span>') : '收藏頁與傳出去的明信片都不寫') + '</span>';
  if (r && !r.got) return '<div class="rw-row is-locked" data-reward="' + esc(r.key) + '">' + inner + '</div>';
  return '<button class="rw-row' + (on ? ' is-on' : '') + '" type="button" data-act="use-title" data-reward="' + esc(r ? r.key : '') +
    '" aria-pressed="' + (on ? 'true' : 'false') + '">' + inner + '</button>';
}
/* 收下的在前（照規則表的順序），還在路上的照進度的比例排 */
function ordered(list) {
  return list.map(function (r, i) { return { r: r, i: i }; }).sort(function (a, b) {
    if (a.r.got !== b.r.got) return a.r.got ? -1 : 1;
    if (a.r.got) return a.i - b.i;
    const pa = a.r.total ? a.r.done / a.r.total : 0, pb = b.r.total ? b.r.done / b.r.total : 0;
    return pb - pa || a.i - b.i;
  }).map(function (x) { return x.r; });
}

function renderRewards() {
  const L = look();
  const frames = rewards('frame'), titles = rewards('title');
  const gotN = function (l) { return l.filter(function (r) { return r.got; }).length; };
  return '<div class="alb alb-v2"><div class="scroll alb-scroll alb-v2__scroll rw">' +
    A.subHeader('相框與稱號', '照你走過的路累積：去過幾個地方、湊齊哪一組、搭 yoxi 累積幾公里。沒有抽籤，也沒有期限。') +
    '<section class="rw-preview" data-rw-preview aria-live="polite">' + previewHTML() + '</section>' +
    '<section class="rw-sec" aria-label="相框">' +
      '<div class="alb-v2__section-head"><h2>相框</h2><span data-stat="frames">收下 ' + gotN(frames) + '/' + frames.length + '</span></div>' +
      '<div class="rw-grid" data-gallery data-rw="frame">' +
        frameTile(null, !L.frame) +
        ordered(frames).map(function (r) { return frameTile(r, !!L.frame && L.frame.key === r.key); }).join('') +
      '</div>' +
    '</section>' +
    '<section class="rw-sec rw-sec--end" aria-label="稱號">' +
      '<div class="alb-v2__section-head"><h2>稱號</h2><span data-stat="titles">收下 ' + gotN(titles) + '/' + titles.length + '</span></div>' +
      '<div class="rw-list card" data-gallery data-rw="title">' +
        titleRow(null, !L.title) +
        ordered(titles).map(function (r) { return titleRow(r, !!L.title && L.title.key === r.key); }).join('') +
      '</div>' +
    '</section>' +
  '</div></div>';
}

function mountRewards(root, params, ctx) {
  A.subMount(root, ctx, 'rewards');
  const preview = root.querySelector('[data-rw-preview]');
  const sync = function () {
    const L = look();
    root.querySelectorAll('[data-act="use-frame"]').forEach(function (b) {
      const on = (b.getAttribute('data-reward') || '') === (L.frame ? L.frame.key : '');
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    root.querySelectorAll('[data-act="use-title"]').forEach(function (b) {
      const on = (b.getAttribute('data-reward') || '') === (L.title ? L.title.key : '');
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (preview) preview.innerHTML = previewHTML();
  };
  root.querySelectorAll('[data-act="use-frame"]').forEach(function (b) {
    b.onclick = function () {
      const k = b.getAttribute('data-reward') || null;
      setLook({ frame: k });
      sync();
      APP.ui.toast(k ? '換上' + byKey('frame', k).name + '相框' : '不用相框');
    };
  });
  root.querySelectorAll('[data-act="use-title"]').forEach(function (b) {
    b.onclick = function () {
      const k = b.getAttribute('data-reward') || null;
      setLook({ title: k });
      sync();
      APP.ui.toast(k ? '稱號換成「' + byKey('title', k).name + '」' : '不顯示稱號');
    };
  });
}

APP.view('rewards', {
  path: '/rewards',
  tab: 'album',
  status: 'dark',
  title: '相框與稱號',
  render: renderRewards,
  mount: mountRewards,
});

Object.assign(APP.album, {
  rewards: rewards,
  look: look,
  setLook: setLook,
  cardHTML: cardHTML,
  REWARDS: REWARDS,
});

})();
