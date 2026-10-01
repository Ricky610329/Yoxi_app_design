/* ==========================================================================
   遊喜樂 web app — album-family：傳到 LINE 給家人、家人的回應（全部是示意）
   契約：app/ARCHITECTURE.md §3.3（store.shares／store.replies）、§3.5（分享面板的「傳到 LINE 給家人」）、§7、§8。
   載入順序：album.js 之後（用它的 APP.album._ 零件）；明信片那一次的樣子問 APP.explore.cardOrigin。

   這支註冊兩個 view：
     /line          長輩的手機：LINE 的「家人」群組（示意）。傳出去的明信片（store.shares，最新的在最下面，只放最近三張）
                    ＋家人的回應（store.replies）：喜歡寫成「小芸 喜歡這張」，留言是對方的氣泡。
                    ?share=<id>：剛傳的那一次（捲到那裡，「看看子女收到的樣子」對準它）。
     /family/:id    子女的手機：在 LINE 裡點開媽媽傳來的那張明信片（示意）。明信片、「媽媽傳來一張明信片」、❤ 喜歡、
                    三句快速回覆、自己打一句＋送出；每個動作寫進 store.replies[shareId]，toast「已回給媽媽（示意）」。
                    ?share=<id>：哪一次分享；沒給（或對不上這張卡）就用這張卡最近的一次；這張卡還沒傳過是空狀態。
   提供 APP.family（檔尾）：send、sendToLine、canSend、shares、sharesOf、latestOf、repliesOf、hearted、react、repliesHTML、FAMILY。

   回答什麼：
   - 長輩收下明信片之後，照傳長輩圖的習慣，一鍵傳到 LINE 給子女；子女在 LINE 裡按喜歡、回一句話，長輩那一端看得到。
   從哪張原型來：
   - screens/elder.html（長輩圖：「它要在 LINE 裡被看見」）。
   - screens/vision-family-a.html（共享的單位是「他按過分享的那一張卡」，不是位置、步數、去了幾個地方；不寫「幾張」）。
   - screens/vision-family-b.html（反面教材：只要多一張地圖、一個「今天有沒有出門」，就變成監控產品）。
   刻意沒有的東西：
   - 真的 LINE、網路、帳號、資料庫：分享與回應只存在 APP.store，畫面上一直標著「示意 · 沒有真的傳出去」。
   - LINE 的 logo 與品牌色：只是一個通用的聊天畫面（顏色全從 tokens）。
   - 已讀、已讀人數、未讀數字、按讚數、排名、連續天數：喜歡只寫名字，不寫幾個。
   - 子女看得到的只有傳過去的那一張：沒有地點、距離、步數、其他明信片、收藏統計、獎章；也沒有催長輩出門的提醒。
   ========================================================================== */

(function () {
'use strict';

const esc = function (s) { return APP.esc(s); };
const M = function () { return window.MOCK || {}; };
const own = Object.prototype.hasOwnProperty;

/* 示意的家人：這支手機的主人（長輩）在群組裡叫「媽媽」，子女是女兒小芸。
   只寫在這裡；prototype/js/mock.js 的 FAMILY 是「子女看家人」那組探索稿，角色剛好相反，不拿來用。 */
const FAMILY = {
  group: '家人',
  elder: { id: 'mom', name: '媽媽' },
  kids: [{ id: 'yun', name: '小芸', rel: '女兒' }],
};
const KID = FAMILY.kids[0];
const QUICK = ['好漂亮', '下次帶我去', '注意安全喔'];   /* 子女那一端的快速回覆 */
const TEXT_MAX = 40;        /* 自己打的一句話最多幾個字（input 的 maxlength 也是它） */
const CAP_MAX = 20;         /* 長輩圖的那一句（share.cap）最多幾個字 */
const SHARES_KEEP = 30;     /* store 最多留幾次分享；更舊的連同它的回應一起丟 */
const REPLIES_KEEP = 20;    /* 每一次分享最多留幾則回應（喜歡不算在內，永遠留著） */
const LINE_SHOW = 3;        /* /line 只放最近幾次 */
const HTML_TEXTS = 3;       /* repliesHTML 最多列幾則留言（最新的） */

const HEART = '<svg class="fam-ic-heart" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M12 20.4s-7.1-4.4-9.1-8.8C1.5 8.4 3.5 4.8 7 4.8c2 0 3.4 1 5 2.9 1.6-1.9 3-2.9 5-2.9 3.5 0 5.5 3.6 4.1 6.8-2 4.4-9.1 8.8-9.1 8.8z"/></svg>';

/* ---------------------------------------------------------------- 資料 */

function cardById(id) {
  return (M().POSTCARDS || []).filter(function (p) { return p.id === id; })[0] || null;
}
function visitOf(v) {
  const n = Math.floor(Number(v));
  return isFinite(n) && n >= 1 ? n : 1;
}
function cleanText(t, max) {
  const s = String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, max || TEXT_MAX).join('').trim();
}
function nameOf(who) {
  if (who === FAMILY.elder.id) return FAMILY.elder.name;
  const k = FAMILY.kids.filter(function (x) { return x.id === who; })[0];
  return k ? k.name : String(who == null ? '' : who);
}
function uniq(list) { return list.filter(function (x, i) { return list.indexOf(x) === i; }); }

/* store.shares：[{ id, card, v, at, cap? }]，舊的在前。認不得的列（手改、舊版）略過 */
function shares() {
  const a = APP.store.get('shares');
  return Array.isArray(a) ? a.filter(function (s) {
    return s && typeof s.id === 'string' && s.id && typeof s.card === 'string';
  }) : [];
}
function shareById(id) {
  if (!id) return null;
  return shares().filter(function (s) { return s.id === id; })[0] || null;
}
/* 這張明信片傳過的每一次（舊的在前）；v 有給就只算那一次造訪的明信片 */
function sharesOf(card, v) {
  return shares().filter(function (s) {
    return s.card === card && (v == null || visitOf(s.v) === visitOf(v));
  });
}
function latestOf(card, v) {
  const l = sharesOf(card, v);
  return l.length ? l[l.length - 1] : null;
}

/* store.replies：{ share id: [{ who, heart, text, at }] }。heart:true 是一個「喜歡」（text 是 ''），
   heart:false 是一句話。回傳新的陣列，不給 store 裡的那一份 */
function allReplies() {
  const r = APP.store.get('replies');
  return r && typeof r === 'object' && !Array.isArray(r) ? r : {};
}
function repliesOf(shareId) {
  const r = allReplies();
  const list = shareId && own.call(r, shareId) && Array.isArray(r[shareId]) ? r[shareId] : [];
  return list.filter(function (x) { return x && typeof x.who === 'string'; }).slice();
}
function hearted(shareId, who) {
  who = who || KID.id;
  return repliesOf(shareId).some(function (x) { return x.who === who && x.heart === true; });
}

function newId() {
  let id;
  do { id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); } while (shareById(id));
  return id;
}

function canSend(card) { return !!cardById(card); }

/* 傳一張明信片到「家人」群組（只寫 store，沒有網路）。o = { card, v, cap }；
   v＝第幾次造訪的那一張（預設 1）、cap＝長輩圖上的那一句（選填）。回傳這一筆，明信片認不得就 null */
function send(o) {
  o = o || {};
  if (!canSend(o.card)) return null;
  const s = { id: newId(), card: o.card, v: visitOf(o.v), at: new Date().toISOString() };
  const cap = cleanText(o.cap, CAP_MAX);
  if (cap) s.cap = cap;
  let list = shares().concat([s]);
  if (list.length <= SHARES_KEEP) {
    APP.store.set('shares', list);
    return s;
  }
  const drop = list.slice(0, list.length - SHARES_KEEP);
  list = list.slice(-SHARES_KEEP);
  const r = Object.assign({}, allReplies());
  drop.forEach(function (d) { delete r[d.id]; });
  APP.store.patch({ shares: list, replies: r });
  return s;
}

/* 分享面板的「傳到 LINE 給家人」、長輩圖的「傳給家人」都走這一支：寫一筆、toast、到 /line?share=<id>。
   傳不出去（明信片認不得）就 toast 並回 null，不換頁 */
function sendToLine(o) {
  const s = send(o);
  if (!s) { APP.ui.toast('這張明信片傳不出去'); return null; }
  APP.ui.toast('已傳到 LINE 的「' + FAMILY.group + '」群組（示意）');
  APP.nav.go('/line?share=' + encodeURIComponent(s.id));
  return s;
}

/* 家人的一個回應。o = { who（預設小芸）, heart:true|false }（喜歡／收回），或 { who, text }（一句話，會去空白、截字）。
   回傳這次分享的回應（新的陣列）；分享不在了、或是空的一句話 → null（什麼都不寫） */
function react(shareId, o) {
  o = o || {};
  if (!shareById(shareId)) return null;
  const who = o.who || KID.id;
  const at = new Date().toISOString();
  let list = repliesOf(shareId);
  if (typeof o.heart === 'boolean') {
    list = list.filter(function (x) { return !(x.who === who && x.heart === true); });
    if (o.heart) list.push({ who: who, heart: true, text: '', at: at });
  } else {
    const text = cleanText(o.text);
    if (!text) return null;
    list.push({ who: who, heart: false, text: text, at: at });
    /* 太多則：丟最舊的留言（喜歡留著） */
    let extra = list.filter(function (x) { return !x.heart; }).length - REPLIES_KEEP;
    if (extra > 0) {
      list = list.filter(function (x) {
        if (x.heart || extra <= 0) return true;
        extra--;
        return false;
      });
    }
  }
  const all = Object.assign({}, allReplies());
  all[shareId] = list;
  APP.store.set('replies', all);
  return list.slice();
}

/* 明信片詳情頁嵌的「家人的回應」：這張卡（v 有給就只算那一次造訪）每一次分享收到的回應合在一起。
   沒有回應回 ''。喜歡只寫名字（「小芸 喜歡這張」）、留言列最新的幾則；沒有數字、沒有連結（要不要連到 /line 由嵌的人決定） */
function repliesHTML(cardId, v) {
  const all = [];
  sharesOf(cardId, v).forEach(function (s) { repliesOf(s.id).forEach(function (r) { all.push(r); }); });
  if (!all.length) return '';
  const hearts = uniq(all.filter(function (r) { return r.heart === true; }).map(function (r) { return nameOf(r.who); }));
  const texts = all.filter(function (r) { return r.heart !== true && r.text; })
    .sort(function (a, b) { return String(a.at) < String(b.at) ? -1 : String(a.at) > String(b.at) ? 1 : 0; })
    .slice(-HTML_TEXTS);
  if (!hearts.length && !texts.length) return '';
  return '<section class="fam-replies" data-family-replies aria-label="家人的回應">' +
    '<h2 class="fam-replies__t">家人的回應</h2>' +
    (hearts.length
      ? '<p class="fam-replies__hearts" data-family-hearts>' + HEART + '<span>' + esc(hearts.join('、')) + ' 喜歡這張</span></p>'
      : '') +
    (texts.length
      ? '<ul class="fam-replies__list">' + texts.map(function (r) {
          return '<li class="fam-replies__item" data-family-text><b>' + esc(nameOf(r.who)) + '</b>' +
            '<span>' + esc(r.text) + '</span></li>';
        }).join('') + '</ul>'
      : '') +
    '<p class="fam-replies__note">LINE 回應示意 · 沒有真的連上 LINE</p>' +
  '</section>';
}

/* ---------------------------------------------------------------- 畫面零件 */

/* 那一次造訪的明信片（第幾次、金框、首訪／里程戳與節日插畫照 APP.explore.cardOrigin）。
   data-card-art＋data-card-visit 讓 explore-face.js 疊上收下的那一款；對不到那一次（還沒收、舊的分享）就畫卡面本身。
   size 'sm'（/line 的小卡）不蓋戳、不放插畫，免得一串聊天都在動。寬度由外面的 .fam-cardwrap 決定 */
function cardArt(cardId, o) {
  o = o || {};
  const p = cardById(cardId);
  if (!p) return '';
  const i = (M().POSTCARDS || []).indexOf(p);
  let org = null;
  try { org = APP.explore && APP.explore.cardOrigin ? APP.explore.cardOrigin(cardId, o.v) : null; }
  catch (e) { console.error('APP.explore.cardOrigin:', e); }
  const gold = !!(org && org.gold);
  return '<div class="postcard fam-card' + (gold ? ' postcard--gold' : '') + '"' + (gold ? ' data-gold-aura' : '') +
      ' data-card="' + esc(p.id) + '"' + (org ? ' data-v="' + org.v + '"' : '') + '>' +
    '<div class="fam-card__art" data-art="' + esc(p.art) + '" data-seed="' + i + '" data-card-art="' + esc(p.id) + '"' +
      (org && org.v > 1 ? ' data-card-visit="' + org.v + '"' : '') + '></div>' +
    '<span class="ai-mark">AI 生成示意</span>' +
    (org && o.size !== 'sm' ? String(org.marks || '') : '') +
    '<span class="postcard__foot"><span class="postcard__name">' + esc(p.name) + '</span>' +
      (org && org.dateText ? '<span class="postcard__date">' + esc(org.dateText) + '</span>' : '') + '</span>' +
  '</div>';
}

function dayLabel(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const now = new Date();
  const day0 = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
  const diff = Math.round((day0(now) - day0(d)) / 864e5);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}
function timeLabel(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : APP.fmt.clock(d);
}
function initial(who) {
  const n = Array.from(nameOf(who));
  return n.length ? n[n.length - 1] : '';
}

/* 手機頂端一直在的「示意」標籤＋聊天室的頁首 */
function topHTML(o) {
  return '<p class="fam-mock" data-mock>' + esc(o.mock) + '</p>' +
    '<header class="fam-bar">' +
      '<a class="fam-bar__back" href="#" data-back="' + esc(o.back) + '"' + (o.act ? ' data-act="' + o.act + '"' : '') +
        ' aria-label="' + esc(o.backLabel) + '"><span class="arrow arrow--left"></span></a>' +
      '<span class="fam-bar__body">' +
        (o.h1 ? '<h1 class="fam-bar__t">' + esc(o.title) + '</h1>' : '<span class="fam-bar__t">' + esc(o.title) + '</span>') +
        '<span class="fam-bar__s">' + esc(o.sub) + '</span>' +
      '</span>' +
    '</header>';
}

function emptyHTML(o) {
  return '<div class="fam-empty" ' + o.attr + '>' +
    '<' + o.tag + ' class="fam-empty__t">' + esc(o.t) + '</' + o.tag + '>' +
    '<p class="fam-empty__p">' + esc(o.p) + '</p>' +
    o.action +
  '</div>';
}

/* /line 的一次分享：自己傳的明信片氣泡（右邊）→ 誰喜歡 → 家人的留言（左邊） */
function shareBlockHTML(s, focus) {
  const p = cardById(s.card);
  const list = repliesOf(s.id);
  const hearts = uniq(list.filter(function (r) { return r.heart === true; }).map(function (r) { return nameOf(r.who); }));
  const texts = list.filter(function (r) { return r.heart !== true && r.text; });
  return '<section class="fam-share' + (focus ? ' is-focus' : '') + '" data-share="' + esc(s.id) + '" data-card="' + esc(s.card) + '"' +
      ' aria-label="傳給家人的明信片：' + esc(p ? p.name : '') + '">' +
    '<div class="fam-msg fam-msg--me">' +
      '<span class="fam-msg__meta">' + esc(timeLabel(s.at)) + '</span>' +
      '<div class="fam-bubble fam-bubble--card">' +
        '<div class="fam-cardwrap fam-cardwrap--sm">' + cardArt(s.card, { v: s.v, size: 'sm' }) + '</div>' +
        (s.cap ? '<p class="fam-bubble__cap" data-share-cap>' + esc(s.cap) + '</p>' : '') +
        '<p class="fam-bubble__line"><b>' + esc(p ? p.name : '') + '</b><small>遊喜樂的明信片</small></p>' +
      '</div>' +
    '</div>' +
    (hearts.length
      ? '<p class="fam-hearts" data-heart-line>' + HEART + '<span>' + esc(hearts.join('、')) + ' 喜歡這張</span></p>'
      : '') +
    texts.map(function (r) {
      return '<div class="fam-msg fam-msg--them" data-reply>' +
        '<span class="fam-avatar" aria-hidden="true">' + esc(initial(r.who)) + '</span>' +
        '<span class="fam-msg__col">' +
          '<span class="fam-msg__who">' + esc(nameOf(r.who)) + '</span>' +
          '<span class="fam-bubble" data-said>' + esc(r.text) + '</span>' +
        '</span>' +
        '<span class="fam-msg__meta">' + esc(timeLabel(r.at)) + '</span>' +
      '</div>';
    }).join('') +
  '</section>';
}

/* 子女自己回過的話（/family 底下，最新的幾則） */
function mineHTML(shareId, who) {
  who = who || KID.id;
  const mine = repliesOf(shareId).filter(function (r) { return r.who === who && r.heart !== true && r.text; }).slice(-HTML_TEXTS);
  if (!mine.length) return '';
  return '<div class="fam-mine">' +
    '<span class="fam-mine__k">你回給' + esc(FAMILY.elder.name) + '的</span>' +
    mine.map(function (r) { return '<span class="fam-bubble fam-bubble--mine" data-mine-text>' + esc(r.text) + '</span>'; }).join('') +
  '</div>';
}

/* /family 用哪一次分享：?share= 對得上這張卡就用它；不然這張卡最近的一次；都沒有是 null */
function pickShare(card, want) {
  const s = shareById(want);
  if (s && s.card === card) return s;
  return latestOf(card);
}

/* ================================================================ /line */

APP.view('line', {
  path: '/line',
  tab: null,
  status: 'dark',
  title: 'LINE 示意',
  render: function (params, ctx) {
    const all = shares();
    const want = shareById(ctx.query.get('share'));
    const top = topHTML({ mock: 'LINE 畫面示意 · 沒有真的傳出去', back: '/album', backLabel: '回到遊喜樂',
                          h1: true, title: FAMILY.group, sub: '群組 · 你和' + FAMILY.kids.map(function (k) { return k.name; }).join('、') });
    if (!all.length) {
      return '<div class="fam fam-line" data-line>' + top +
        '<div class="scroll fam-chat" data-chat>' +
          emptyHTML({ attr: 'data-line-empty', tag: 'h2', t: '還沒有傳過明信片',
                      p: '在明信片頁按「分享」→「傳到 LINE 給家人」，就會出現在這個群組裡。',
                      action: '<a class="btn-primary" href="#/postcards" data-act="go-postcards">去挑一張明信片</a>' }) +
        '</div></div>';
    }
    const focus = want || all[all.length - 1];
    let shown = all.slice(-LINE_SHOW);
    /* 指定的那一次比最近三次還舊：換掉最舊的一格（照時間排，它本來就在最前面） */
    if (!shown.some(function (s) { return s.id === focus.id; })) shown = [focus].concat(shown.slice(1));
    let lastDay = null;
    const body = shown.map(function (s) {
      const day = dayLabel(s.at);
      const sep = day && day !== lastDay ? '<p class="fam-day">' + esc(day) + '</p>' : '';
      lastDay = day || lastDay;
      return sep + shareBlockHTML(s, s.id === focus.id);
    }).join('');
    return '<div class="fam fam-line" data-line>' + top +
      '<div class="scroll fam-chat" data-chat>' +
        '<p class="fam-sys">傳出去的只有明信片本身，沒有你的位置，也沒有其他紀錄。</p>' +
        (all.length > shown.length ? '<p class="fam-sys fam-sys--more">更早傳的明信片往上收起來了</p>' : '') +
        body +
      '</div>' +
      '<div class="fam-foot">' +
        '<button class="btn-primary" type="button" data-act="see-family" data-share="' + esc(focus.id) + '">看看子女收到的樣子（示意）</button>' +
      '</div>' +
    '</div>';
  },
  mount: function (root) {
    const btn = root.querySelector('[data-act="see-family"]');
    if (btn) btn.onclick = function () {
      const s = shareById(btn.getAttribute('data-share'));
      if (!s) { APP.ui.toast('這張明信片不在群組裡了'); return; }
      APP.nav.go('/family/' + encodeURIComponent(s.card) + '?share=' + encodeURIComponent(s.id));
    };
    /* 捲到最新的（最下面）；指定的那一次不是最新的，就讓它排到最上面 */
    const chat = root.querySelector('[data-chat]');
    const blocks = root.querySelectorAll('.fam-share');
    const f = root.querySelector('.fam-share.is-focus');
    if (chat) {
      chat.scrollTop = chat.scrollHeight;
      if (f && f !== blocks[blocks.length - 1]) chat.scrollTop = Math.max(0, f.offsetTop - 8);
    }
  },
});

/* ================================================================ /family/:id */

APP.view('family', {
  path: '/family/:id',
  tab: null,
  status: 'dark',
  title: function (p) { return cardById(p.id) ? '家人收到的明信片（示意）' : '找不到這張明信片'; },
  render: function (params, ctx) {
    const P = cardById(params.id);
    const s = P ? pickShare(P.id, ctx.query.get('share')) : null;
    const top = topHTML({ mock: '子女的手機 · LINE 畫面示意', back: '/line' + (s ? '?share=' + encodeURIComponent(s.id) : ''),
                          act: 'back-line', backLabel: '返回', h1: false, title: FAMILY.group, sub: KID.name + '的手機' });
    if (!s) {
      return '<div class="fam fam-kidpage" data-family>' + top +
        '<div class="scroll fam-kid">' +
          emptyHTML(P
            ? { attr: 'data-family-empty', tag: 'h1', t: FAMILY.elder.name + '還沒有傳這張明信片',
                p: '在' + FAMILY.elder.name + '的手機上按「分享」→「傳到 LINE 給家人」，這裡就是子女收到的樣子。',
                action: '<a class="btn-primary" href="#/line" data-act="go-line">回到' + esc(FAMILY.elder.name) + '的手機</a>' }
            : { attr: 'data-family-missing', tag: 'h1', t: '找不到這張明信片', p: '這個連結裡沒有明信片。',
                action: '<a class="btn-primary" href="#/line" data-act="go-line">回到' + esc(FAMILY.elder.name) + '的手機</a>' }) +
        '</div></div>';
    }
    const on = hearted(s.id, KID.id);
    return '<div class="fam fam-kidpage" data-family data-share="' + esc(s.id) + '">' + top +
      '<div class="scroll fam-kid">' +
        '<h1 class="fam-kid__from" data-family-from><b>' + esc(FAMILY.elder.name) + '</b>傳來一張明信片</h1>' +
        '<div class="fam-cardwrap fam-cardwrap--lg">' + cardArt(P.id, { v: s.v, size: 'lg' }) + '</div>' +
        (s.cap ? '<p class="fam-kid__cap" data-share-cap>' + esc(s.cap) + '</p>' : '') +
        '<p class="fam-kid__name">' + esc(P.name) + '</p>' +
        '<div class="fam-kid__react">' +
          '<button class="fam-heart' + (on ? ' is-on' : '') + '" type="button" data-act="toggle-heart" aria-pressed="' + (on ? 'true' : 'false') + '">' +
            HEART + '<span data-heart-label>' + (on ? '已喜歡' : '喜歡') + '</span></button>' +
        '</div>' +
        '<div class="fam-quick" role="group" aria-label="快速回覆">' + QUICK.map(function (q) {
          return '<button class="fam-chip" type="button" data-act="pick-reply" data-text="' + esc(q) + '">' + esc(q) + '</button>';
        }).join('') + '</div>' +
        '<form class="fam-form" data-reply-form>' +
          '<label class="app-sr-only" for="fam-text">回一句話給' + esc(FAMILY.elder.name) + '</label>' +
          '<input class="fam-input" id="fam-text" type="text" maxlength="' + TEXT_MAX + '" autocomplete="off" ' +
            'placeholder="回一句話給' + esc(FAMILY.elder.name) + '" data-reply-text>' +
          '<button class="fam-send" type="submit" data-act="send-reply">送出</button>' +
        '</form>' +
        '<div data-my-replies>' + mineHTML(s.id) + '</div>' +
        '<button class="btn-ghost fam-kid__go" type="button" data-act="go-line">回到' + esc(FAMILY.elder.name) + '的手機</button>' +
      '</div>' +
    '</div>';
  },
  mount: function (root) {
    const box = root.querySelector('[data-family][data-share]');
    if (!box) return;
    const id = box.getAttribute('data-share');
    const heart = root.querySelector('[data-act="toggle-heart"]');
    const mine = root.querySelector('[data-my-replies]');
    const input = root.querySelector('[data-reply-text]');
    const toElder = '已回給' + FAMILY.elder.name + '（示意）';
    const refresh = function () {
      const on = hearted(id, KID.id);
      heart.classList.toggle('is-on', on);
      heart.setAttribute('aria-pressed', on ? 'true' : 'false');
      heart.querySelector('[data-heart-label]').textContent = on ? '已喜歡' : '喜歡';
      mine.innerHTML = mineHTML(id);
    };
    const gone = function () { APP.ui.toast('這一次分享已經不在了'); };
    heart.onclick = function () {
      const on = !hearted(id, KID.id);
      if (!react(id, { heart: on })) { gone(); return; }
      refresh();
      APP.ui.toast(on ? toElder : '收回喜歡了（示意）');
    };
    root.querySelectorAll('[data-act="pick-reply"]').forEach(function (b) {
      b.onclick = function () {
        if (!react(id, { text: b.getAttribute('data-text') })) { gone(); return; }
        refresh();
        APP.ui.toast(toElder);
      };
    });
    const sendText = function () {
      const t = cleanText(input.value);
      if (!t) { APP.ui.toast('先打一句話'); input.focus(); return; }
      if (!react(id, { text: t })) { gone(); return; }
      input.value = '';
      refresh();
      APP.ui.toast(toElder);
    };
    /* Enter 送出是瀏覽器對送出鈕的一次 click（implicit submission），onclick 擋掉真的送出表單 */
    root.querySelector('[data-act="send-reply"]').onclick = function (e) { if (e) e.preventDefault(); sendText(); };
    root.querySelector('[data-reply-form]').onsubmit = function (e) { if (e) e.preventDefault(); sendText(); };
    /* 回到長輩的手機：上一筆就是 /line → 照歷史退一格（不疊一層）；深連結、從別處來 → 就地換成 /line?share=<id> */
    root.querySelector('[data-act="go-line"]').onclick = function () {
      APP.nav.up('/line?share=' + encodeURIComponent(id), { backIf: function (p) { return p.path === '/line'; } });
    };
  },
});

/* 給別的區塊用（契約 §7）：system.js 的分享面板、album.js 的明信片詳情與長輩圖 */
APP.family = {
  FAMILY: FAMILY,
  canSend: canSend,
  send: send,
  sendToLine: sendToLine,
  shares: shares,
  sharesOf: sharesOf,
  latestOf: latestOf,
  repliesOf: repliesOf,
  hearted: hearted,
  react: react,
  repliesHTML: repliesHTML,
};

})();
