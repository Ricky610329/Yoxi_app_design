/* ==========================================================================
   yoxi 城事 — Catalog
   畫面目錄與 demo 流程的唯一來源。

   以前 index.html、overview.html、shoot.py 各自抄一份畫面清單，
   流程 A 在一頁有地圖、另一頁沒有；加一張畫面要改三個地方。
   現在只改這裡：demo 首頁、全景圖、導覽列都從這裡讀。

   傳統 script，不用 ES module —— file:// 底下 module 會被 CORS 擋掉。
   ========================================================================== */

(function () {
'use strict';

/* --------------------------------------------------------------------------
   畫面
   key → [編號, 名稱, 類型, 路徑（相對 screens/）]
   類型：keep 沿用（原封不動）｜mod 改造（既有畫面小幅修改）｜new 新增
   -------------------------------------------------------------------------- */
const S = {
  /* 叫車 */
  home:     ['R1',  '叫車首頁',       'mod',  'home.html'],
  drawer:   ['R2',  '側邊抽屜',       'mod',  'drawer.html'],
  pickup:   ['R3',  '設定上車地點',   'keep', 'pickup.html'],
  outarea:  ['R4',  '非服務範圍',     'keep', 'outofarea.html'],
  ride:     ['R5',  '行程中',         'mod',  'ride.html'],
  done:     ['R6',  '行程完成',       'mod',  'ride-done.html'],
  notify:   ['R7',  '通知中心',       'mod',  'notify.html'],
  rideset:  ['R8',  '乘車設定',       'mod',  'ridesettings.html'],
  points:   ['R9',  '和泰 Points',    'mod',  'points.html'],

  /* 探索 */
  explore:  ['N1',  '探索 · 卡片',    'new',  'explore.html'],
  place:    ['N2',  '地方詳情',       'new',  'place.html'],
  placefar: ['N2',  '地方詳情（遠）',  'new',  'place.html?id=neiwan'],
  map:      ['N3',  '探索 · 地圖',    'new',  'map.html'],
  going:    ['N4',  '前往中',         'new',  'going.html'],
  routes:   ['N5',  '路線列表',       'new',  'routes.html'],
  route:    ['N6',  '路線詳情',       'new',  'route.html'],
  fogmap:   ['N7',  '城市足跡',       'new',  'fogmap.html'],

  /* 收藏 */
  album:    ['N8',  '收藏首頁',       'new',  'album.html'],
  unlock:   ['N9',  '抵達解鎖',       'new',  'unlock.html'],
  unlockR:  ['N9',  '解鎖（限定版）',  'new',  'unlock.html?ride=1'],
  postcard: ['N10', '明信片詳情',     'new',  'postcard.html'],
  badge:    ['N11', '獎章詳情',       'new',  'badge.html'],
  lookback: ['N12', '每日回顧',       'new',  'lookback.html'],
  week:     ['N13', '週回顧',         'new',  'week.html'],
  elder:    ['N14', '長輩圖',         'new',  'elder.html'],

  /* 設定與 demo 工具 */
  settings: ['N15', '城事設定',       'new',  'settings.html'],
  push:     ['N16', '模擬推播（早）',  'new',  'push.html'],
  pushN:    ['N16', '模擬推播（晚）',  'new',  'push.html?when=night'],

  /* 原封不動的既有畫面 */
  trips:    ['—',   '行程紀錄',       'keep', 'trips.html'],
  export:   ['—',   '匯出行程',       'keep', 'export.html'],
  payment:  ['—',   '付款設定',       'keep', 'payment.html'],
  coupon:   ['—',   '優惠券',         'keep', 'coupon.html'],
  tasks:    ['—',   '好康任務',       'keep', 'tasks.html'],
  support:  ['—',   '客服中心',       'keep', 'support.html'],
  shop:     ['—',   '點數商城',       'keep', 'shop.html'],
  invite:   ['—',   '邀請好友',       'keep', 'invite.html'],
};

/* 全景圖的分組。順序就是頁面上的順序。 */
const GROUPS = [
  ['叫車', '既有的叫車流程。除了首頁多一條 tab bar 與一個入口，其餘沒動。',
   ['home', 'drawer', 'pickup', 'outarea', 'ride', 'done', 'notify', 'points']],
  ['探索', '「接下來去哪」。卡片與地圖是同一批資料的兩種檢視。',
   ['explore', 'map', 'place', 'placefar', 'going', 'routes', 'route', 'fogmap']],
  ['收藏', '「去過哪裡」。情感高點與長期價值的載體。',
   ['album', 'unlock', 'unlockR', 'postcard', 'badge', 'lookback', 'week', 'elder']],
  ['原封不動的既有畫面', '這些完全沒有為了城事而改動 —— 這本身就是「不破壞既有體驗」的證據。',
   ['trips', 'export', 'payment', 'coupon', 'tasks', 'support', 'rideset', 'shop', 'invite']],
  ['設定與 demo 工具', '資料與隱私講清楚；推播浮層是 demo 用的，不是產品畫面。',
   ['settings', 'push', 'pushN']],
];

/* --------------------------------------------------------------------------
   三條 demo 流程
   每一步：s＝畫面 key，say＝站在評審面前這一步要講的一句話（導覽列會顯示）。
   -------------------------------------------------------------------------- */
const FLOWS = [
  {
    key: 'a', tag: '流程 A', name: '不搭車的日常',
    why: '要證明的：不搭車也玩得下去、AI 推薦有個人化依據、動機來自內容而不是獎勵。',
    steps: [
      { s: 'push',
        say: '早上 8:10 的推播。點下去直接進探索，不經過叫車首頁 —— 一天最多兩則。' },
      { s: 'explore',
        say: '一天只給一個地方。沒有「換一個」、沒有倒數。點開「為什麼推薦給你」：常用地點、時段、收集缺口、天氣。' },
      { s: 'place',
        say: '大圖是灰階的明信片，到了才上色。900 公尺走得到，所以主要動作是走路前往。' },
      { s: 'going',
        say: '這一頁刻意什麼都不做：到了才響。往上拉 sheet 看抵達怎麼驗（80 公尺內停 1 分鐘）。' },
      { s: 'unlock',
        say: '三幕：灰點爆開上色 → AI 生成中 → 成品。可以寫一句話。按「收進收藏」狀態就真的寫進去。' },
      { s: 'album',
        say: '去過的地方加一、牆上多一張標「新」、獎章進度動了。點一下明信片翻面看背面。' },
    ],
  },
  {
    key: 'b', tag: '流程 B', name: '搭車的轉換',
    why: '要證明的：探索會直接產生訂單、走不到的地方靠叫車才到得了、點數回流和泰生態系。',
    steps: [
      { s: 'route',
        say: '路線把散點串成一個月的故事。下一站內灣 28 公里 —— 走不到，這就是叫車的理由。' },
      { s: 'placefar',
        say: '距離超過 3 公里，主要動作自動換成「用 yoxi 前往」，並標出限定版與 +50 點。' },
      { s: 'ride',
        say: '行程中。司機資訊下面多一張可收合的「這條路上」內容卡，預設收著，不搶主流程。' },
      { s: 'done',
        say: '評分之後才出現金色橫幅「解鎖限定明信片」。結算是 yoxi 的事，城事排在它後面。' },
      { s: 'unlockR',
        say: '金框、yoxi 限定版角標、司機同行紀念。和泰 Points +50 入帳。' },
      { s: 'points',
        say: '點數明細多一筆「城事解鎖回饋」。總數跟明細用同一個來源算，不會對不起來。' },
    ],
  },
  {
    key: 'c', tag: '流程 C', name: '晚上的回顧',
    why: '要證明的：90% 自動 + 10% 人工的低負擔儀式、隱私分軌、移動自動沉澱成資產。',
    steps: [
      { s: 'pushN',
        say: '晚上 21:30 的第二則推播。今天走了多少、經過幾個地方，點下去直接進回顧。' },
      { s: 'lookback',
        say: '四幕：步數之字形 → 今天多了哪一張（由狀態算）→ 選一張照片（可跳過）→ 心情三選一。' },
      { s: 'album',
        say: '日誌分頁記著今天的心情與步數，「只有你看得到」—— 這裡沒有分享鍵。' },
      { s: 'week',
        say: '週回顧是唯一能分享的匯總，右上才有分享鍵。本週／上週用同色系明度差，不用對立色。' },
      { s: 'elder',
        say: '分享面板第一個選項是「傳給家人」：同一批明信片換一種排版，就換一個世代。' },
    ],
  },
];

/* href → 預先產生的縮圖檔名（tools/shoot.py 的輸出）。
   帶參數的畫面要另取名字，不然 place.html 與 place.html?id=neiwan 會撞同一張。 */
const THUMB_ALIAS = {
  'place.html?id=neiwan':            'place-far',
  'unlock.html?ride=1':              'unlock-ride',
  'push.html?when=night':            'push-night',
  'variant-a-map.html?mode=been':    'variant-a-map-been',
  'variant-d-home.html?layer=on':    'variant-d-home-on',
  'variant-e-home.html?peek=1':      'variant-e-home-peek',
  'variant-f-home.html?mode=today':  'variant-f-home-today',
};

function thumbOf(href) {
  const h = href.replace(/^screens\//, '');
  const key = THUMB_ALIAS[h] || h.replace(/\.html.*$/, '');
  return 'assets/thumbs/' + key + '.png';
}

const KIND = { keep: '沿用', mod: '改造', new: '新增' };

function screen(key) {
  const r = S[key];
  if (!r) throw new Error('CATALOG：沒有這張畫面 ' + key);
  return { key: key, id: r[0], name: r[1], kind: r[2], kindLabel: KIND[r[2]],
           href: r[3], thumb: thumbOf(r[3]) };
}

function flow(key) {
  return FLOWS.filter(function (f) { return f.key === key; })[0] || null;
}

window.CATALOG = {
  SCREENS: S, GROUPS: GROUPS, FLOWS: FLOWS, KIND: KIND,
  screen: screen, flow: flow, thumbOf: thumbOf,
};
})();
