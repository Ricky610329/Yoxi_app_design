/* ==========================================================================
   yoxi 城事 — Catalog
   畫面目錄、demo 流程、變體註冊表、願景探索稿、以及把這些串成一棵樹的 API。
   demo 首頁、全景圖（層級樹）、變體比較頁、願景頁、導覽列都只從這裡讀。

   以前 index.html、overview.html、variants.html 各自抄一份清單，
   流程 A 在一頁有地圖、另一頁沒有；加一張畫面要改三個地方。

   傳統 script，不用 ES module —— file:// 底下 module 會被 CORS 擋掉。
   注意：TABSETS／ROOTS（變體的分頁組與根對應）留在 shell.js，
   因為一般畫面不載這支；這裡的 VARIANTS 只放文件欄位，稽核會對帳兩邊。
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

  /* 變體 E 的一格，只給流程 B 當對照用；不在全景圖的分組裡 */
  varE:     ['E',   '合一版 · 設為下車點', 'new', 'variant-e-home.html?peek=1'],

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

/* 全景圖「牆」視圖的分組。順序就是頁面上的順序。 */
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
   樹的骨架：分頁、誰掛在誰底下、哪些其實是同一張畫面的狀態
   -------------------------------------------------------------------------- */

/* 四個分頁（不沿用 GROUPS 的五組：GROUPS 是依 kind 分的，跟分頁語意打架） */
const TABS = [
  { id: 'ride',    name: '叫車',        blurb: '現在。yoxi 既有的主流程，只多一條 tab bar 與一個入口。',
    screens: ['home', 'drawer', 'pickup', 'outarea', 'ride', 'done', 'notify'] },
  { id: 'explore', name: '探索',        blurb: '未來。接下來去哪：一天一個地方、路線、地圖。',
    screens: ['explore', 'map', 'place', 'going', 'routes', 'route', 'fogmap'] },
  { id: 'album',   name: '收藏',        blurb: '過去。去過哪裡：明信片、獎章、回顧、長輩圖。',
    screens: ['album', 'unlock', 'postcard', 'badge', 'lookback', 'week', 'elder'] },
  { id: 'system',  name: '設定與 demo 工具', blurb: '資料與隱私講清楚；推播浮層是 demo 用的。',
    screens: ['settings', 'push'] },
];

/* 掛在某張畫面底下的畫面（抽屜裡的那幾頁） */
const CHILD_OF = {
  trips: 'drawer', export: 'drawer', payment: 'drawer', coupon: 'drawer', tasks: 'drawer',
  support: 'drawer', rideset: 'drawer', shop: 'drawer', invite: 'drawer', points: 'drawer',
};

/* S 裡其實是「狀態」不是畫面的那幾筆（tour 需要它們當步驟才放進 S） */
const STATE_OF = { placefar: 'place', unlockR: 'unlock', pushN: 'push' };

/* 帶參數的其他狀態：檔名 → [[參數, 名稱, 說明]] */
const STATES = {
  'variant-a-map.html':    [['mode=been',  '去過模式',   '同一張圖，換模式']],
  'variant-d-home.html':   [['layer=on',   '圖層開',     '景點與足跡長出來']],
  'variant-e-home.html':   [['peek=1',     '點景點',     '看看這個地方 / 設為下車點']],
  'variant-f-home.html':   [['mode=today', '今天模式',   '景點長出來、sheet 換內容']],
  'variant-x4-badges.html':[['style=ring', '進度環牆',   '每枚一個環'],
                            ['style=stamp','集點卡',     '刻意做壞的那一版']],
  'variant-t1-tasks.html': [['mode=merged','合併成一種卡','激進版']],
};

/* --------------------------------------------------------------------------
   三條 demo 流程
   每一步：s＝畫面 key，say＝站在評審面前這一步要講的一句話（導覽列會顯示）。
   -------------------------------------------------------------------------- */
const FLOWS = [
  {
    key: 'a', tag: '流程 A', name: '不搭車的日常',
    why: '要證明的：不搭車也玩得下去、AI 推薦有個人化依據、動機來自內容而不是獎勵。',
    proves: ['不搭車也玩得下去', 'AI 推薦有依據', '動機來自內容'],
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
        say: '三幕：灰點爆開上色 → AI 生成中 → 成品。動畫中點一下畫面可以直接到成品。寫一句話，按「收進收藏」狀態就真的寫進去。' },
      { s: 'album',
        say: '去過的地方加一、牆上多一張標「新」、獎章進度動了。點一下明信片翻面看背面。' },
    ],
  },
  {
    key: 'b', tag: '流程 B', name: '搭車的轉換',
    why: '要證明的：探索會直接產生訂單、走不到的地方靠叫車才到得了、點數回流和泰生態系。',
    proves: ['探索直接產生訂單', '走不到才叫車', '點數回流和泰'],
    steps: [
      { s: 'route',
        say: '路線把散點串成一個月的故事。下一站內灣 28 公里 —— 走不到，這就是叫車的理由。' },
      { s: 'placefar',
        say: '距離超過 10 公里，主要動作自動換成「用 yoxi 前往」，並標出限定版與 +50 點。' },
      { s: 'ride',
        say: '行程中。司機資訊下面多一張可收合的「這條路上」內容卡，預設收著，不搶主流程。' },
      { s: 'done',
        say: '評分之後才出現金色橫幅「解鎖限定明信片」。結算是 yoxi 的事，城事排在它後面。' },
      { s: 'unlockR',
        say: '金框、yoxi 限定版角標、司機同行紀念。和泰 Points +50 入帳。' },
      { s: 'points',
        say: '點數明細裡多一種來源「城事解鎖回饋」，其餘是一般搭車回饋。總數＝明細相加。' },
      { s: 'varE',
        say: '對照：合一提案（變體 E）把同一件事壓成一步 —— 景點小卡上的「設為下車點」，欄位填好、叫車鈕就緒。主線是保守版，這是進階提案。' },
    ],
  },
  {
    key: 'c', tag: '流程 C', name: '晚上的回顧',
    why: '要證明的：90% 自動 + 10% 人工的低負擔儀式、隱私分軌、移動自動沉澱成資產。',
    proves: ['90% 自動的儀式', '隱私分軌', '移動沉澱成資產'],
    steps: [
      { s: 'pushN',
        say: '晚上 21:30 的第二則推播。今天走了多少、經過幾個地方，點下去直接進回顧。' },
      { s: 'lookback',
        say: '四幕：步數之字形 → 今天多了哪一張（由狀態算）→ 選一張照片（可跳過）→ 心情三選一。' },
      { s: 'album',
        say: '切到「日誌」：今天的心情與步數只有你看得到，沒有分享鍵；同一個分頁下面的「這一週」才是能分享的那一半。' },
      { s: 'week',
        say: '週回顧是唯一能分享的匯總，右上才有分享鍵。本週／上週用同色系明度差，不用對立色。' },
      { s: 'elder',
        say: '分享面板第一個選項是「傳給家人」：同一批明信片換一種排版，就換一個世代。' },
    ],
  },
];

/* --------------------------------------------------------------------------
   軸線與變體註冊表
   一個變體＝一條軸線上的一個點。tabs 沿用比較頁的寫法：
   [標籤, 路徑（相對 prototype 根）, 說明, 是地圖, 狀態標籤（'狀態'|'第二層'|無）]
   state：built 已做｜planned 已規劃待做｜candidate 只有論述沒畫面
   verdict：pick 這條軸線的推薦｜sub 前提成立時的最佳解｜do 值得做｜maybe 有空再做｜no 對照組／不做
   walled：有自己的 TABSETS／ROOTS，要進圍牆稽核
   -------------------------------------------------------------------------- */
const AXES = [
  { key: 'map',     title: '地圖該歸誰？',
    intro: '地圖在回答兩個時態的問題：「附近有什麼可以去」與「我去過哪裡」。一旦決定探索＝地圖＋sheet，下一題就是能不能直接用叫車那張。', pick: 'E' },
  { key: 'conv',    title: '轉換點在哪？',
    intro: '從發現一個地方到叫車去那裡，那一步放在地圖上、還是內容頁？', pick: 'K' },
  { key: 'entry',   title: '城事從哪裡進？',
    intro: '要不要動 yoxi 最貴的導覽資產（tab bar），還是只從抽屜、推播與 banner 進？', pick: null },
  { key: 'album',   title: '收藏怎麼被組織？',
    intro: '過去是圖鑑、日記、路線、地圖，還是家人？', pick: 'S3' },
  { key: 'explore', title: '探索的主敘事是什麼？',
    intro: '一天一個、清單、缺口、路線、還是步數？', pick: 'X2' },
  { key: 'badge',   title: '獎章怎麼呈現才不是任務？',
    intro: '同一份資料三種呈現，比的是哪一版最不像集點。', pick: 'X4' },
  { key: 'tasks',   title: '好康任務要不要跟城事同頁？',
    intro: '實體隔離是必要的，還是視覺語言分開就夠？', pick: null },
  { key: 'load',    title: '畫面上要放多少東西？',
    intro: '功能數與到達步數一起看：按鈕少不一定好，步數變多就是代價。', pick: 'L1' },
  { key: 'ritual',  title: '儀式要多長？',
    intro: '抵達解鎖的三幕換到的是可信度，還是流失？', pick: null },
  { key: 'family',  title: '家人是一個模式，還是一個分享選項？',
    intro: '這個提案對誰最不可替代？', pick: null },
];

const VARIANTS = [
  /* ---- 地圖該歸誰（問題一：探索內部） ---- */
  { key: '0', axis: 'map', tag: '變體 0', name: '現況 —— 兩張地圖', state: 'built', verdict: null, effort: '—',
    one: '探索有「卡片／地圖」切換，收藏另有一整頁「城市足跡」。兩張地圖各自獨立，彼此不知道對方存在。',
    where: '地圖出現在探索與收藏兩處，共 2 張。',
    when: '不想在決賽前碰任何結構問題。它也是 demo 主線目前跑的版本。',
    good: '兩個場景各自最佳化：探索的地圖專心找地方，足跡頁專心給你滿版的情緒。',
    bad: '使用者會問「這兩張地圖有什麼不一樣」。維護成本雙倍，每加一個圖層都要做兩次。',
    tabs: [['叫車', 'screens/home.html', '沒動', false], ['探索', 'screens/map.html', '卡片／地圖切換', true],
           ['收藏', 'screens/album.html', '右上進城市足跡', false], ['城市足跡', 'screens/fogmap.html', '第二張地圖', true, '第二層']],
    screens: [], walled: false, replaces: ['map', 'album', 'fogmap'] },
  { key: 'A', axis: 'map', tag: '變體 A', name: '一張地圖，兩個模式', state: 'built', verdict: 'no', effort: '小', tabset: 'a',
    one: '全 app 只有一張地圖，用「想去／去過」切換。想去＝未探索的景點高亮；去過＝足跡上色、只留去過的地方、底部換成覆蓋率。收藏 tab 的入口深連結到「去過」模式。',
    where: '地圖只有 1 張，住在探索，用模式切換兼顧兩種時態。',
    when: '要保留滿版足跡的情緒，又只肯做最小改動。實際上它是變體 0 加一個模式。',
    good: '真的只有一張地圖，兩種時態都保住了滿版的視覺。改動最小，現有畫面幾乎照用。',
    bad: '多一個模式要學。「去過」模式住在探索 tab 裡，跟「過去屬於收藏」的心理歸屬打架。',
    tabs: [['叫車', 'screens/home.html', '沒動', false], ['探索 · 想去', 'screens/variant-a-map.html', '未探索的高亮', true],
           ['探索 · 去過', 'screens/variant-a-map.html?mode=been', '同一張圖，換模式', true, '狀態'], ['收藏', 'screens/variant-a-album.html', '入口深連結到「去過」', false]],
    screens: ['variant-a-map.html', 'variant-a-explore.html', 'variant-a-album.html'], walled: true, replaces: ['map', 'album'] },
  { key: 'B', axis: 'map', tag: '變體 B', name: '地圖就是探索', state: 'built', verdict: 'sub', effort: '中', tabset: 'b',
    one: '沿用 yoxi 自己首頁的版型：地圖滿版在上、底部拉把 sheet 在下。收合態就是「今天的地方」，往上拉是路線與還沒去的地方。足跡是地圖的一個圖層。收藏 tab 完全沒有地圖。',
    where: '地圖只有 1 張，就是探索本身。足跡是它的圖層。',
    when: '團隊不被允許動叫車主畫面。它跟 E 是同一張畫面放在不同分頁，差的只有「是不是第一眼」。',
    good: '最像 yoxi 原生的：探索頁跟叫車頁是同一個版型。地圖歸屬乾淨，沒有模式要學，足跡是圖層很直覺。',
    bad: '「今天的地方」從滿版主卡變成 sheet 收合態裡的一張卡 —— 那是「一天一個明確答案」的反焦慮設計。',
    tabs: [['叫車', 'screens/home.html', '地圖 + sheet', false], ['探索', 'screens/variant-b-explore.html', '同一個版型', true],
           ['收藏', 'screens/variant-b-album.html', '純收藏，無地圖', false]],
    screens: ['variant-b-explore.html', 'variant-b-album.html'], walled: true, replaces: ['explore', 'map', 'album'] },
  { key: 'C', axis: 'map', tag: '變體 C', name: '收藏不放地圖', state: 'built', verdict: 'no', effort: '小', tabset: 'c',
    one: '最保守：把整頁「城市足跡」拿掉，覆蓋率與城市顏色壓成收藏首頁裡的一塊數據磚。探索維持現況的卡片／地圖切換。',
    where: '地圖只有 1 張，住在探索。收藏用數據磚代替地圖。',
    when: '只想消掉「兩張地圖」這個問題本身、其餘都不動。它其實是變體 0 關掉足跡頁。',
    good: '資訊架構最乾淨，每個 tab 的職責一句話講得完。改動最小，最不可能做壞。',
    bad: '失去「你的城市慢慢長出顏色」那個滿版畫面。收藏的「在地圖上看」進的是「想去」的地圖，時態是斷的。',
    tabs: [['叫車', 'screens/home.html', '沒動', false], ['探索', 'screens/variant-c-explore.html', '卡片為主', false],
           ['探索 · 地圖', 'screens/variant-c-map.html', '唯一的地圖', true, '第二層'], ['收藏', 'screens/variant-c-album.html', '數據磚，無地圖', false]],
    screens: ['variant-c-explore.html', 'variant-c-map.html', 'variant-c-album.html'], walled: true, replaces: ['album', 'fogmap'] },

  /* ---- 地圖該歸誰（問題二：直接用叫車那張） ---- */
  { key: 'D', axis: 'map', tag: '變體 D', name: '城事圖層（保守）', state: 'built', verdict: 'maybe', effort: '中', tabset: 'd',
    one: '叫車地圖左下角加一顆「城事」圖層鈕，預設關閉 —— 關閉時畫面與基準一模一樣。按一下才長出景點與足跡上色。探索 tab 變成純內容。',
    where: '全 app 只有 1 張地圖，就是叫車首頁那張。城市足跡是它的圖層。',
    when: '要把地圖併進叫車，但第一版必須零風險上線。它是 E 的「預設關」版本。',
    good: '叫車體驗零風險 —— 關掉就是基準。把城事圖層整棵拿掉之後，DOM 逐節點相同。',
    bad: '景點預設看不到，發現性最低。「不搭車也打開 yoxi」的證據因此變弱。',
    tabs: [['叫車 · 圖層關', 'screens/variant-d-home.html', '與 home.html 完全相同', false], ['叫車 · 圖層開', 'screens/variant-d-home.html?layer=on', '景點與足跡長出來', true, '狀態'],
           ['探索', 'screens/variant-d-explore.html', '純內容，沒有地圖', false], ['收藏', 'screens/variant-d-album.html', '足跡入口指回地圖', false]],
    screens: ['variant-d-home.html', 'variant-d-explore.html', 'variant-d-album.html'], walled: true, replaces: ['home', 'explore', 'map', 'album'] },
  { key: 'E', axis: 'map', tag: '變體 E', name: '景點常駐 + 一鍵設為下車點', state: 'built', verdict: 'pick', effort: '中', tabset: 'e',
    one: '景點一直在叫車地圖上，但極輕：同時最多 4 個、比探索地圖小一號、沒去過的是灰階。點景點浮出小卡，上面有「設為下車點」—— 一下就填好下車點、展開 sheet、叫車按鈕就緒。',
    where: '全 app 只有 1 張地圖。從發現到叫車只有一步。',
    when: '要把「探索會直接產生訂單」做成可以當場演示的一步。這是整份提案的推薦。',
    good: '打開 app 第一眼就有內容；「探索會直接產生訂單」從論述變成可以當場點給評審看的動作。',
    bad: '對叫車主畫面干擾最大。足跡上色永遠開著，六條承諾沒有一條量它；「一步」是用展開 sheet 換來的。',
    tabs: [['叫車', 'screens/variant-e-home.html', '景點常駐，極輕', true], ['點景點', 'screens/variant-e-home.html?peek=1', '看看這個地方 / 設為下車點', true, '狀態'],
           ['探索', 'screens/variant-e-explore.html', '純內容，沒有地圖', false], ['收藏', 'screens/variant-e-album.html', '足跡入口指回地圖', false]],
    screens: ['variant-e-home.html', 'variant-e-explore.html', 'variant-e-album.html'], walled: true, replaces: ['home', 'explore', 'map', 'album'] },
  { key: 'F', axis: 'map', tag: '變體 F', name: '一個畫面兩種模式（激進）', state: 'built', verdict: 'no', effort: '大', tabset: 'f',
    one: 'tab bar 砍成兩個：地圖、收藏。叫車與探索共用同一個畫面，靠 sheet 頂端的「叫車／今天」切換分流。',
    where: '全 app 只有 1 張地圖，而且只有 2 個 tab。',
    when: '願意重談 tab bar 架構，追求最徹底的整合。決賽前不建議。',
    good: '最徹底的整合。一個畫面把兩個時態收在一起，而且完全沿用 yoxi 自己的版型。',
    bad: '動到已經定案的 tab bar 架構，探索沒有獨立入口 —— 評審可能覺得功能被藏起來了。',
    tabs: [['地圖 · 叫車模式', 'screens/variant-f-home.html', '地圖乾淨，等同基準', false], ['地圖 · 今天模式', 'screens/variant-f-home.html?mode=today', '景點長出來、sheet 換內容', true, '狀態'],
           ['收藏', 'screens/variant-f-album.html', '只剩兩個 tab', false]],
    screens: ['variant-f-home.html', 'variant-f-album.html'], walled: true, replaces: ['home', 'explore', 'map', 'album'] },

  /* ---- 候選（只有論述、沒畫面） ---- */
  { key: 'K', axis: 'conv', tag: '候選 K', name: '轉換點在內容頁', state: 'candidate', verdict: 'do', effort: '小',
    one: '地方詳情的主要動作從「用 yoxi 前往」改成「設為下車點」→ 回叫車頁，欄位已填。',
    when: '完全不動叫車主畫面也要證明「探索產生訂單」。E 被否決時轉換價值不會跟著死。',
    good: '給 E 一把降落傘；place.html 是三條流程都會經過的畫面。', bad: '少了 E 那個「一步」的戲劇性，變兩步。',
    risk: '少了一步的戲劇性', tabs: [], screens: [], walled: false, replaces: ['place'] },
  { key: 'G', axis: 'entry', tag: '候選 G', name: '抽屜入口版', state: 'candidate', verdict: 'do', effort: '小',
    one: '完全不動 tab bar，城事只從漢堡抽屜與首頁 banner 進入。',
    when: '評審問「你憑什麼加分頁」時的現成答案；有了 G，光譜 G→D→E→F 才完整。',
    good: '零導覽風險。', bad: '探索深度最低，「不搭車也打開 yoxi」的證據最弱。',
    risk: '證據最弱', tabs: [], screens: [], walled: false, replaces: ['drawer', 'explore'] },
  { key: 'H', axis: 'entry', tag: '候選 H', name: '只有推播＋banner', state: 'candidate', verdict: 'maybe', effort: '小',
    one: '沒有探索分頁，「今天的地方」只活在推播與首頁 banner。',
    when: '想知道內容需要一個「家」，還是只需要出現的時機。',
    good: '乾淨的對照組。', bad: '留存全押推播，關掉就沒了；弱到容易被說「這不是產品」。',
    risk: '不像產品', tabs: [], screens: [], walled: false, replaces: ['push', 'home'] },
  { key: 'I', axis: 'ritual', tag: '候選 I', name: '解鎖壓成一秒', state: 'candidate', verdict: 'no', effort: '中',
    one: '取消前往中的 1 分鐘停留與整頁解鎖，抵達就地在地圖上開卡。',
    when: '想量儀式換到的是可信度還是流失。',
    good: '最短路徑。', bad: '拆掉「80 公尺內停 1 分鐘才算數」—— 目前唯一的反假打卡論述。',
    risk: '拆掉反假打卡', tabs: [], screens: [], walled: false, replaces: ['going', 'unlock'] },
  { key: 'L', axis: 'family', tag: '候選 L', name: '家人是一個模式', state: 'candidate', verdict: 'maybe', effort: '大',
    one: '長輩圖從收藏第三層升成可切換的整組 UI：大字、少色、只問今天去哪。',
    when: '想回答「這個提案對誰最不可替代」。',
    good: '三代分眾的完整版。', bad: '範圍暴衝、稀釋主線敘事。',
    risk: '範圍暴衝', tabs: [], screens: [], walled: false, replaces: ['elder'] },

  /* ---- 收藏怎麼被組織（S 系列，待做） ---- */
  { key: 'S1', axis: 'album', tag: '變體 S1', name: '時間牆', state: 'built', verdict: 'do', effort: '中', tabset: 's1',
    one: '收藏首頁改成倒序時間軸，一天一列：日期、抵達方式、那天的明信片、寫的那句話。只列有東西的日子；pill 整組拿掉。',
    question: '收藏是圖鑑還是日記？', when: '想把收藏做成日記，情緒回報最高的一版。',
    good: '每一張卡都有它的那一天，翻起來像相簿。', bad: '空白日期會製造缺席感；pill 拿掉之後灰階剪影也一起消失 —— 這一版看不到還沒去過的地方。',
    risk: '缺席感', tabs: [['收藏', 'screens/variant-s1-album.html', '倒序時間軸', false]],
    screens: ['variant-s1-album.html'], walled: true, replaces: ['album'] },
  { key: 'S2', axis: 'album', tag: '變體 S2', name: '圖鑑缺口', state: 'built', verdict: 'do', effort: '中', tabset: 's2',
    one: '明信片牆照地方類型分行（車站、水岸、工業遺構…），一張都還沒收到的那一類寫「這一類還沒有」。類型由 findPlace 推導，查不到的 11 張用 art 反查。',
    question: '收集感要不要看得到缺哪一格？', when: '想讓缺口成為下一次出門的理由，又不想寫「還差 N 個」。',
    good: '缺口看得到（官署、老街、工業遺構三行），收集感最強。', bad: '最接近任務清單，文案只能是「還沒有 X 類」；類型粒度不齊（車站 5 張，市場／廟宇／海岸各 1 張），10 行每行都短。',
    risk: '任務化', tabs: [['收藏', 'screens/variant-s2-album.html', '依類型分行', false]],
    screens: ['variant-s2-album.html'], walled: true, replaces: ['album'] },
  { key: 'S3', axis: 'album', tag: '變體 S3', name: '路線書架', state: 'built', verdict: 'pick', effort: '小', tabset: 's3',
    one: '首頁第一組是三條路線的書脊，各展開成一排站點；散片收到最後一段「不屬於任何路線」。',
    question: '收藏的最小單位是一張卡，還是一個故事？', when: '想把收藏跟長期動機接起來 —— 現在路線只活在探索側。',
    good: '成本最低，全部現成零件；把資訊架構最明顯的斷點接起來。', bad: '散片 7 張，比任何一條路線都大（最長的內灣線 6 站）。',
    risk: '散片比路線大', tabs: [['收藏', 'screens/variant-s3-album.html', '路線書脊', false]],
    screens: ['variant-s3-album.html'], walled: true, replaces: ['album'] },
  { key: 'S4', axis: 'album', tag: '變體 S4', name: '收藏即地圖', state: 'built', verdict: 'maybe', effort: '小', tabset: 's4',
    one: '收藏首頁直接是滿版足跡地圖，明信片牆退成底部 sheet（4 欄）；覆蓋率與褪色切換一起搬進來，城市足跡頁整頁可拿掉。',
    question: '過去的組織軸是時間還是空間？', when: '只在 B／C 系前提下成立。',
    good: '「你的城市慢慢長出顏色」變成第一眼。', bad: '與 D／E／F「全 app 只有一張地圖」正面衝突。',
    risk: '跟合一提案衝突', tabs: [['收藏', 'screens/variant-s4-album.html', '滿版足跡地圖', true], ['牆拉開', 'screens/variant-s4-album.html?sheet=open', '4 欄的牆', true, '狀態']],
    screens: ['variant-s4-album.html'], walled: true, replaces: ['album', 'fogmap'] },
  { key: 'S5', axis: 'album', tag: '變體 S5', name: '家人視角', state: 'built', verdict: 'maybe', effort: '小', tabset: 's5',
    one: '收藏加第四顆 pill「家人」：同一批明信片換大字、少色、每張一句問候；長輩圖從第三層升成分頁。',
    question: '這個提案對誰最不可替代？', when: '想在收藏裡直接看到三代分眾。',
    good: '同一批資產換一種排版就換一個世代。', bad: '稀釋主線；可能被讀成「這是另一個 app」。',
    risk: '稀釋主線', tabs: [['收藏', 'screens/variant-s5-album.html', '第四顆 pill：家人', false], ['家人分頁', 'screens/variant-s5-album.html?pill=family', '大字、少色、一句問候', false, '狀態']],
    screens: ['variant-s5-album.html'], walled: true, replaces: ['album'] },

  /* ---- 探索的主敘事（X 系列，待做） ---- */
  { key: 'X1', axis: 'explore', tag: '變體 X1', name: '值得去的地方', state: 'built', verdict: 'no', effort: '小', tabset: 'x1',
    one: '探索首頁不是一天一個，是一條地方清單（現有資料是 5 個），今天那個排第一。',
    question: '「一天一個」的反焦慮，是不是同時給了「內容太少」的印象？', when: '刻意做壞的對照組，不是提案。',
    good: '看起來內容多。', bad: '直接撞掉最核心的反焦慮主張；AI 推薦依據無處可放，等於從首頁消失。',
    risk: '對照組', tabs: [['探索', 'screens/variant-x1-explore.html', '5–7 個地方的清單', false]],
    screens: ['variant-x1-explore.html'], walled: true, replaces: ['explore'] },
  { key: 'X2', axis: 'explore', tag: '變體 X2', name: '缺口導向', state: 'built', verdict: 'pick', effort: '中', tabset: 'x2',
    one: '首頁最上面是「你的圖鑑還缺什麼」：三個缺口各給一個最近的候選，今天的地方退到第二塊。',
    question: '收藏能不能反過來成為出門的理由？', when: '想證明 AI 推薦依據不是裝飾。',
    good: '整批裡唯一讓收藏反向驅動探索的變體。', bad: '最容易滑進禁用詞；句型鎖死「你的圖鑑裡還沒有 X」。',
    risk: '任務化', tabs: [['探索', 'screens/variant-x2-explore.html', '缺口在最上面', false], ['收藏', 'screens/variant-x2-album.html', '缺口一致', false]],
    screens: ['variant-x2-explore.html', 'variant-x2-album.html'], walled: true, replaces: ['explore', 'album'] },
  { key: 'X3', axis: 'explore', tag: '變體 X3', name: '路線主敘事', state: 'built', verdict: 'do', effort: '小', tabset: 'x3',
    one: '一條路線佔滿一屏，今天的地方變成「這條路線的下一站」。',
    question: '長期動機該不該前置到第一屏？', when: '想看路線前置的效果。',
    good: '長期動機在第一眼。', bad: '今天的地方被路線綁死；新使用者開場是空的。',
    risk: '新使用者開場空', tabs: [['探索', 'screens/variant-x3-explore.html', '一條路線佔滿一屏', false]],
    screens: ['variant-x3-explore.html'], walled: true, replaces: ['explore'] },
  { key: 'X4', axis: 'badge', tag: '變體 X4', name: '獎章三態', state: 'built', verdict: 'pick', effort: '中', tabset: null,
    one: '同一份獎章資料三種呈現：勳章牆、進度環牆、集點卡，用參數切換。',
    question: '獎章怎麼呈現才不會變成任務？', when: '評審挑戰「收集 4/8」的紀律時，有三版對照才說得出「我們試過集點卡，刻意不選」。',
    good: '一張檔案換三個可比對的呈現，單位成本最低。', bad: '集點卡那一版最像集點 —— 它的價值是當證據。',
    risk: '集點卡像集點', tabs: [['勳章牆', 'screens/variant-x4-badges.html', '現況的格子', false], ['進度環牆', 'screens/variant-x4-badges.html?style=ring', '每枚一個環', false, '狀態'], ['集點卡', 'screens/variant-x4-badges.html?style=stamp', '刻意做壞', false, '狀態']],
    screens: ['variant-x4-badges.html'], walled: false, replaces: ['album', 'badge'] },
  { key: 'X5', axis: 'explore', tag: '變體 X5', name: '走路就會長', state: 'built', verdict: 'maybe', effort: '中', tabset: 'x5',
    one: '探索首頁頂端一條「今天走了多少」的成長條，步數換成沿途長出來的東西。',
    question: 'Pikmin 式的過程獎勵，能不能不變成 streak？', when: '想試過程獎勵。',
    good: '走路本身有回饋。', bad: '引入第二套計量單位，跟明信片競爭注意力；最接近連續天數。',
    risk: '變成 streak', tabs: [['探索', 'screens/variant-x5-explore.html', '頂端成長條', false]],
    screens: ['variant-x5-explore.html'], walled: true, replaces: ['explore'] },
  { key: 'T1', axis: 'tasks', tag: '變體 T1', name: '好康與城事同頁', state: 'built', verdict: 'no', effort: '小', tabset: null,
    one: '好康任務頁底下加一個城事區（無勾選框、無條狀進度、無期限）；合併模式再看「合併成一種卡」的更激進版。',
    question: '實體隔離是必要的，還是視覺語言分開就夠？', when: '評審問「你們已經有好康任務了」時，拿出來說「我們試過、刻意不選」。',
    good: '回答評審幾乎一定會問的問題。', bad: '直接違反 tasks.html 檔頭寫明的設計理由 —— 被評估後否決的證據。',
    risk: '對照組', tabs: [['好康任務', 'screens/variant-t1-tasks.html', '底下加城事區', false], ['合併', 'screens/variant-t1-tasks.html?mode=merged', '合併成一種卡', false, '狀態']],
    screens: ['variant-t1-tasks.html'], walled: false, replaces: ['tasks'] },

  /* ---- 畫面上要放多少東西（L 系列，待做）。target＝可按數／到達步數的目標。 ---- */
  { key: 'L1', axis: 'load', tag: '變體 L1', name: '一屏一事', state: 'built', verdict: 'pick', effort: '小', tabset: 'l1',
    one: '探索首頁只剩滿版今天的地方＋一顆「走路前往」；為什麼推薦、路線、還沒去的地方全部收進一個往上拉的 sheet。',
    question: '一屏只放一個動作，會不會反而更想出門？', when: '想壓低第一眼的認知負擔。',
    good: '可按數從 15 降到 2。', bad: '其餘內容多一步才看得到。', ref: 'Neko Atsume · Wayline #1/#14',
    risk: '內容藏深', target: { taps: 2, steps: 1 }, tabs: [['探索', 'screens/variant-l1-explore.html', '一屏一事', false]],
    screens: ['variant-l1-explore.html'], walled: true, replaces: ['explore'] },
  { key: 'L2', axis: 'load', tag: '變體 L2', name: '零決策開場', state: 'built', verdict: 'no', effort: '小', tabset: 'l2',
    one: 'app 打開就是今天的地方，只有一顆「走」；tab bar 直接不顯示（正式版才等第一次滑動淡入，原型用一句提示代替）。',
    question: '最極端的一端長什麼樣？', when: '對照組。',
    good: '可按數 1。', bad: '什麼都找不到。', ref: 'Walkr',
    risk: '對照組', target: { taps: 1, steps: 1 }, tabs: [['探索', 'screens/variant-l2-explore.html', '只有一顆「走」', false]],
    screens: ['variant-l2-explore.html'], walled: true, replaces: ['explore'] },
  { key: 'L3', axis: 'load', tag: '變體 L3', name: '圖鑑一頁一格', state: 'built', verdict: 'do', effort: '小', tabset: 'l3',
    one: '收藏只剩明信片格子，沒有統計條、沒有 pill、沒有入口卡；進度縮成一行小字。',
    question: '收藏頁的其他東西有必要嗎？', when: '想看牆本身能不能撐起整頁。',
    good: '可按數 9：8 張收到的卡＋頁首 1 顆；沒收的灰卡是剪影，不假裝點得開。', bad: '獎章、日誌、週回顧要另找入口；灰卡不可點，少一條從牆上挑地方去的路。', ref: 'Neko Atsume Catbook',
    risk: '入口消失', target: { taps: 9, steps: 1 }, tabs: [['收藏', 'screens/variant-l3-album.html', '只有格子', false]],
    screens: ['variant-l3-album.html'], walled: true, replaces: ['album'] },
  { key: 'L4', axis: 'load', tag: '變體 L4', name: '地圖極簡 HUD', state: 'built', verdict: 'do', effort: '小', tabset: 'l4',
    one: '探索地圖只留 1 顆定位鈕＋景點＋小卡；圖例、拉遠鈕、切換都收進小卡或手勢。',
    question: '地圖上的 HUD 能少到哪裡？', when: '想比對 Pikmin Bloom 地圖畫面那種密度。',
    good: '可按數 11＝10 顆景點＋定位鈕。', bad: '拉遠與切換要靠手勢，發現性低；一打開沒有明確答案 —— 預設浮出的小卡拿掉了。', ref: 'Pikmin Bloom 地圖畫面',
    risk: '沒有明確答案', target: { taps: 11, steps: 1 }, tabs: [['探索 · 地圖', 'screens/variant-l4-map.html', '極簡 HUD', true]],
    screens: ['variant-l4-map.html'], walled: true, replaces: ['map'] },
  { key: 'L5', axis: 'load', tag: '變體 L5', name: '圖示取代文字', state: 'built', verdict: 'maybe', effort: '中', tabset: 'l5',
    one: '探索與收藏用大圖示磚，每屏文字不超過 6 個詞；順便驗長輩可讀性。',
    question: '文字塊能少到哪裡？', when: '想驗長輩可讀性。',
    good: '畫面上只有 5 個詞；可按數與文字塊都只剩主線的零頭（數字看卡片下方的量測）。', bad: '圖示要學，第一次看不懂。', ref: 'Neko Atsume',
    risk: '圖示要學', target: { taps: 6, steps: 1 }, tabs: [['探索', 'screens/variant-l5-explore.html', '大圖示磚', false], ['收藏', 'screens/variant-l5-album.html', '大圖示磚', false]],
    screens: ['variant-l5-explore.html', 'variant-l5-album.html'], walled: true, replaces: ['explore', 'album'] },
  { key: 'L6', axis: 'load', tag: '變體 L6', name: '一個數字', state: 'built', verdict: 'do', effort: '小', tabset: 'l6',
    one: '探索首頁只有今天的步數與一個慢慢長出來的插圖，一行小字說今天的地方在 900m。',
    question: '一個數字夠不夠當出門的理由？', when: 'X5 的極簡版。',
    good: '可按數 1；畫面上只剩一個數字、一張插圖和一行小字。', bad: '今天的地方退成一行小字；走路前往藏在 sheet 裡，多一步。', ref: 'Walkr／Wokamon',
    risk: '今天的地方消失', target: { taps: 1, steps: 2 }, tabs: [['探索', 'screens/variant-l6-explore.html', '一個數字', false]],
    screens: ['variant-l6-explore.html'], walled: true, replaces: ['explore'] },
];

/* --------------------------------------------------------------------------
   願景探索稿
   不進 S／GROUPS／FLOWS、不進三條流程。每張只放一個主意。
   -------------------------------------------------------------------------- */
const VISIONS = [
  { theme: 'family', title: '好友／家人動向', lead: '三代分眾：長輩、父母輩、年輕人各自看到什麼？',
    dirs: [
      { code: 'a', name: '家人那一欄', one: '家人主動分享出來的明信片，變成收藏頁的第四個分段。', answers: '家人之間該共享什麼？', where: '收藏 · 疊加', risk: ['比較感'], href: 'screens/vision-family-a.html' },
      { code: 'b', name: '今天出門了嗎', one: '子女端只看一個燈號：長輩今天有沒有出門。沒有地圖、沒有路徑，對方知道你在看。', answers: '觀察家人動向的最低粒度是什麼？', where: '新畫面 · 子女端', risk: ['隱私', '監控感'], href: 'screens/vision-family-b.html' },
      { code: 'c', name: '一起走這條路線', one: '路線多一張「一起走的人」：三個頭像各走到第幾站，走路省下的公里換成和泰點數的移動折抵（一公里 5 點）。', answers: 'ESG 折扣怎麼跟走路接上？', where: '路線詳情 · 疊加', risk: ['競賽感'], href: 'screens/vision-family-c.html' },
    ] },
  { theme: 'event', title: '大型活動整合', lead: '活動天然有結束日，最容易滑進倒數與限量。',
    dirs: [
      { code: 'a', name: '活動只是來源之一', one: '活動不另開入口，只是「今天的地方」推薦依據裡多一條來源。', answers: '活動需要自己的入口嗎？', where: '探索首頁 · 疊加', risk: ['限時'], href: 'screens/vision-event-a.html' },
      { code: 'b', name: '活動期間的臨時路線', one: '一個大型活動＝一條會自己收起來的路線，串的是場館以外的地方；明信片不過期。', answers: '限時內容怎麼跟反限量立場共存？', where: '新畫面 · 路線版型', risk: ['限時'], href: 'screens/vision-event-b.html' },
      { code: 'c', name: '活動當天的下車點', one: '活動日的叫車首頁：banner 換成活動卡、展開態多一列建議下車口；城事只負責「為什麼是這個口」。', answers: '活動跟叫車本業怎麼接？', where: '叫車首頁 · 疊加', risk: ['承諾②③'], href: 'screens/vision-event-c.html' },
    ] },
  { theme: 'plan', title: '行程規劃', lead: '行程＝時間表＝壓力。用先後、不用時刻。',
    dirs: [
      { code: 'a', name: '把還沒去的排成一天', one: '「還沒去的地方」那張清單，可以攤成一條下午的時間軸，段間標走路或用 yoxi。', answers: '行程可以沒有時刻嗎？', where: '新畫面 · 路線版型', risk: ['任務化'], href: 'screens/vision-plan-a.html' },
      { code: 'b', name: '兩個人各丟一個地方', one: '同一張草稿，家人各自丟一個地方進來，誰都不用當主揪；沒有未讀點與催促。', answers: '共筆行程怎麼不長出通知？', where: '新畫面 · 共筆', risk: ['通知化'], href: 'screens/vision-plan-b.html' },
      { code: 'c', name: '行程交給 yoxi', one: '草稿按一下，變成叫車首頁上已填好的多點行程。', answers: '行程跟訂單怎麼接？', where: '叫車首頁 · sheet 展開態', risk: ['推開收合態'], href: 'screens/vision-plan-c.html' },
    ] },
  { theme: 'health', title: '健康出行動機', lead: '健康資料最容易長出目標、連續天數與環圈。',
    dirs: [
      { code: 'a', name: '健檢完的那一段路', one: '健檢結束的推播不是「恭喜」，是回程路上繞 12 分鐘的一個地方；設定頁要能單獨關掉「健檢預約」這個依據。', answers: '醫療事件能不能當出門的理由？', where: '推播 + 地方詳情 · 疊加', risk: ['隱私'], href: 'screens/vision-health-a.html' },
      { code: 'b', name: '步數是一條線', one: '每日回顧的之字形旁邊多一條「這個月」，不設目標、不畫達標線。', answers: '健康資料能不能不變成目標？', where: '每日回顧 · 疊加', risk: ['目標化'], href: 'screens/vision-health-b.html' },
      { code: 'c', name: '陪長輩去健檢', one: '健檢預約 → 敬老愛心車隊 → 回程走一段 → 長輩圖，一條給 60 歲的鏈。', answers: '長輩端的一天長什麼樣？', where: '新畫面 · 長輩端', risk: ['長輩可讀性'], href: 'screens/vision-health-c.html' },
    ] },
];

/* --------------------------------------------------------------------------
   概念稿（第三輪）
   不是 app 規格、不在 demo 流程上、不進圍牆稽核：這一區問的是「真的做出來會長怎樣」。
   兩件事：新竹地圖的真實質感（OSM 幾何重新上色，不是截圖）與好友系統。
   每一組有一張（或三張）大概念板，每一筆有一排手機框 —— 同一個主意的兩種尺度。

   形狀刻意抄 VISIONS：{ code, name, one, answers, where, risk[] }，
   多的是 href／phones（同一張畫面的不同參數）／needsNet（要連網、沒有縮圖）。
   phones[0] 的 href 就是 item.href；其餘每一支在樹上是一個 state 節點。
   -------------------------------------------------------------------------- */
const CONCEPTS = [
  {
    group: 'styles', title: '地圖的質感',
    lead: '同一份新竹的真實幾何、同一個中心與縮放，換六種上色。看的是底圖能不能既有個性、彼此又像一家人。',
    board: { href: 'boards/board-map-styles.html',
             png: 'assets/boards/board-map-styles.png', mini: 'assets/boards/mini/board-map-styles.png',
             name: '概念板 · 六種底圖', one: '六格同中心同縮放的對照，旁邊列出每一種的色票。紅色只留給頁首、pin 與今天。' },
    items: [
      { code: 'styles', name: '六種底圖',
        one: '車站一帶的同一份路網，換成紙本、夜間、插畫、微 3D、傾斜與霧。景點與 pin 六版一模一樣，只有地面在換。',
        answers: '底圖可以有多少個性，又不打架？',
        where: '探索 · 地圖', risk: ['色彩擴張'],
        href: 'screens/concept-map-explore.html?style=paper',
        phones: [
          { label: '紙本',  href: 'screens/concept-map-explore.html?style=paper' },
          { label: '夜間',  href: 'screens/concept-map-explore.html?style=navy' },
          { label: '插畫',  href: 'screens/concept-map-explore.html?style=illus' },
          { label: '微 3D', href: 'screens/concept-map-explore.html?style=iso' },
          { label: '傾斜',  href: 'screens/concept-map-explore.html?style=paper&tilt=1' },
          { label: '霧',    href: 'screens/concept-map-explore.html?style=fog' },
        ] },
      { code: 'iso', name: '微 3D 近景',
        one: '拉近到六百公尺，建物擠出高度、只畫朝向你的那兩面牆。景點與 pin 永遠平貼在最上層，不跟著傾斜，也沒有多出任何可按的東西。',
        answers: '一點點 3D 會不會就變成遊戲？',
        where: '新畫面 · 近景地圖', risk: ['像遊戲', '樓層資料稀疏'],
        href: 'screens/concept-map-iso.html',
        phones: [
          { label: '白天',        href: 'screens/concept-map-iso.html' },
          { label: '黃昏 · 傾斜', href: 'screens/concept-map-iso.html?tilt=1&hour=dusk' },
        ] },
    ],
  },
  {
    group: 'layout', title: '單地圖與雙地圖',
    lead: '「地圖該歸誰」第二輪用變體吵過一次；這一輪換成真的地理資料再看一次：一張圖兼顧兩個時態，還是兩張圖各司其職。',
    board: { href: 'boards/board-map-single.html',
             png: 'assets/boards/board-map-single.png', mini: 'assets/boards/mini/board-map-single.png',
             name: '概念板 · 單地圖', one: '叫車首頁上的四個景點 → 點開小卡 → 設為下車點，三步都在同一張圖上。' },
    boards: [
      { href: 'boards/board-map-dual.html',
        png: 'assets/boards/board-map-dual.png', mini: 'assets/boards/mini/board-map-dual.png',
        name: '概念板 · 雙地圖', one: '探索的插畫底圖與足跡的霧，兩張圖各自最佳化，中間接的是收藏。' },
      { href: 'boards/board-map-3d.html',
        png: 'assets/boards/board-map-3d.png', mini: 'assets/boards/mini/board-map-3d.png',
        name: '概念板 · 微 3D', one: '白天與黃昏兩種近景再加傾斜。建物高度來自 OSM，資料稀疏的地方看得出來。' },
    ],
    items: [
      { code: 'single', name: '單地圖（E 型）',
        one: '景點常駐在叫車首頁那張圖上，同時最多四個、沒去過的是灰階；點一下浮出小卡，上面就有「設為下車點」。',
        answers: '一張圖能不能同時是叫車與探索？',
        where: '叫車首頁 · 疊加', risk: ['干擾本業'],
        href: 'screens/concept-map-home.html?style=paper',
        phones: [
          { label: '紙本',   href: 'screens/concept-map-home.html?style=paper' },
          { label: '夜間',   href: 'screens/concept-map-home.html?style=navy' },
          { label: '點景點', href: 'screens/concept-map-home.html?style=illus&peek=1' },
        ] },
      { code: 'dual', name: '雙地圖',
        one: '探索用插畫底圖找地方，足跡用霧看去過哪裡。兩張圖同一份幾何、同一個原點，換的只有上色與圖層。',
        answers: '兩張地圖怎麼長得像一家人？',
        where: '探索 + 收藏', risk: ['兩張圖的疑問'],
        href: 'screens/concept-map-explore.html?style=illus',
        phones: [
          { label: '探索 · 插畫', href: 'screens/concept-map-explore.html?style=illus' },
          { label: '足跡 · 霧',   href: 'screens/concept-map-footprint.html?style=fog' },
          { label: '足跡 · 紙本', href: 'screens/concept-map-footprint.html?style=paper' },
        ] },
      { code: 'ride', name: '夜間底圖在本業裡',
        one: '行程中那一頁換上夜間底圖，司機資訊底下是收著的「這條路上」。深色是為了車內好讀，不是為了城事。',
        answers: '夜間底圖放進叫車主流程會不會太搶？',
        where: '行程中 · 疊加', risk: ['承諾②'],
        href: 'screens/concept-map-ride.html?style=navy' },
      { code: 'compare', name: '六格對照',
        one: '手機尺寸的 2×3 六格，同中心、同縮放、同一批景點。要挑底圖就看這一張。',
        answers: '哪一種底圖最耐看？',
        where: '新畫面 · 對照', risk: ['只是工具頁'],
        href: 'screens/concept-map-styles.html' },
    ],
  },
  {
    group: 'real', title: '真實素材',
    lead: '離線的 OSM 幾何以外，還有兩種真東西：線上圖磚與 Wikimedia 的實景照片。兩者都標出處，也都不會被 demo 流程依賴。',
    board: null,
    items: [
      { code: 'tiles', name: '線上圖磚',
        one: '同一批景點擺到真的圖磚上：CARTO 的 voyager／positron／dark 與 Esri 衛星底圖。Leaflet 落地在專案裡，只有圖磚要連網。',
        answers: '真的圖磚會比重新上色的幾何好看嗎？',
        where: '新畫面 · 需要網路', risk: ['依賴網路', '署名義務'],
        href: 'screens/concept-map-tiles.html?base=voyager', needsNet: true, thumb: null,
        phones: [
          { label: 'voyager',  href: 'screens/concept-map-tiles.html?base=voyager',  needsNet: true },
          { label: 'positron', href: 'screens/concept-map-tiles.html?base=positron', needsNet: true },
          { label: 'dark',     href: 'screens/concept-map-tiles.html?base=dark',     needsNet: true },
          { label: '衛星',     href: 'screens/concept-map-tiles.html?base=satellite', needsNet: true },
        ] },
      { code: 'photos', name: '實景照片',
        one: '地方詳情換成真的照片：來自 Wikimedia Commons，作者與授權就印在圖旁；右邊一張四百公尺的小定位圖，只有一根紅 pin。',
        answers: '不靠 AI 生圖的時候，一個地方長什麼樣？',
        where: '地方詳情 · 換素材', risk: ['素材稀少', '署名義務'],
        href: 'screens/concept-map-place.html?id=station' },
    ],
  },
  {
    group: 'friend', title: '好友與 AI 鄰居',
    lead: '多人互動只做一件事：把走到的地方寄給一個人，附一句話。沒有 in-app 聊天、沒有語音。',
    board: { href: 'boards/board-friends.html',
             png: 'assets/boards/board-friends.png', mini: 'assets/boards/mini/board-friends.png',
             name: '概念板 · 好友', one: '寄 → 收 → 牆 → 鄰居四台手機一列；左下是四格原則，右下是還沒決定的五個問題。' },
    items: [
      { code: 'list', name: '朋友與 AI 鄰居',
        one: '四個人與三個 AI 鄰居各一列，寫的是關係與「昨天寄了一張」，不是幾張，也不是上線狀態。',
        answers: '好友列表可以整頁沒有數字嗎？',
        where: '新畫面 · 從側邊選單進來', risk: ['比較感'],
        href: 'screens/concept-friend-list.html' },
      { code: 'profile', name: '他的牆',
        one: '一個人的頁：他分享出來的明信片、他寄給你的。沒有打開牆的人就寫「他沒有打開自己的牆」，你還是可以寄一張給他。',
        answers: '看得到朋友的什麼，才不算監看？',
        where: '新畫面 · 人物頁', risk: ['監控感', '比較感'],
        href: 'screens/concept-friend-profile.html?id=sis',
        phones: [
          { label: '真人的牆',   href: 'screens/concept-friend-profile.html?id=sis' },
          { label: 'AI 鄰居的牆', href: 'screens/concept-friend-profile.html?id=nb1' },
        ] },
      { code: 'send', name: '寄一張',
        one: '兩步：挑一張走過的明信片，再寫二十個字。四句罐頭可以按，寄出的提示明說對方不會跳通知。',
        answers: '一句小語會不會長成聊天室？',
        where: '新畫面 · 兩步', risk: ['小語變成聊天'],
        href: 'screens/concept-friend-send.html?to=sis&step=pick',
        phones: [
          { label: '挑一張', href: 'screens/concept-friend-send.html?to=sis&step=pick' },
          { label: '寫小語', href: 'screens/concept-friend-send.html?to=sis&step=write&card=p3' },
        ] },
      { code: 'inbox', name: '信箱',
        one: '收到的明信片依今天、昨天、更早分段，翻面看小語。沒有未讀點、沒有已讀，卡上也沒有「回一張」。',
        answers: '收到東西可以不變成通知嗎？',
        where: '新畫面 · 紅頭 pills', risk: ['通知化'],
        href: 'screens/concept-friend-inbox.html',
        phones: [
          { label: '收到的',   href: 'screens/concept-friend-inbox.html' },
          { label: '我寄出的', href: 'screens/concept-friend-inbox.html?pill=out' },
        ] },
      { code: 'neighbors', name: 'AI 鄰居',
        one: '信箱一開始是空的，所以放了三個 AI 鄰居各守一個角落。每一張都標示是 AI，會做什麼、不會做什麼寫在同一頁，隨時可以關。',
        answers: 'AI 當初始好友，怎麼不冒充真人？',
        where: '新畫面 · 開場', risk: ['AI 冒充真人'],
        href: 'screens/concept-friend-neighbors.html',
        phones: [
          { label: '介紹',     href: 'screens/concept-friend-neighbors.html' },
          { label: '第一張卡', href: 'screens/concept-friend-neighbors.html?state=first' },
        ] },
      { code: 'push', name: '好友的推播',
        one: '一則靜態推播：「小芸寄了一張明信片給你。」預設是關的，打開也只有一則，彙整成一句 —— 不是一張一則。',
        answers: '多人互動會不會把推播變多？',
        where: '推播 · 疊加', risk: ['通知化'],
        href: 'screens/concept-friend-push.html' },
    ],
  },
];

/* 一組的板：layout 有三張（單／雙／3D），real 一張都沒有。 */
function boardsOf(g) { return (g.board ? [g.board] : []).concat(g.boards || []); }

/* --------------------------------------------------------------------------
   縮圖
   -------------------------------------------------------------------------- */

/* href → 預先產生的縮圖檔名（tools/shoot.py 的輸出）。
   帶參數的畫面要另取名字，不然 place.html 與 place.html?id=neiwan 會撞同一張。 */
const THUMB_ALIAS = {
  'place.html?id=neiwan':              'place-far',
  'unlock.html?ride=1':                'unlock-ride',
  'push.html?when=night':              'push-night',
  'variant-a-map.html?mode=been':      'variant-a-map-been',
  'variant-d-home.html?layer=on':      'variant-d-home-on',
  'variant-e-home.html?peek=1':        'variant-e-home-peek',
  'variant-f-home.html?mode=today':    'variant-f-home-today',
  'variant-s4-album.html?sheet=open':  'variant-s4-album-open',
  'variant-s5-album.html?pill=family': 'variant-s5-album-family',
  'variant-x4-badges.html?style=ring': 'variant-x4-badges-ring',
  'variant-x4-badges.html?style=stamp':'variant-x4-badges-stamp',
  'variant-t1-tasks.html?mode=merged': 'variant-t1-tasks-merged',

  /* 概念稿。檔名是 concept-map-*，縮圖名字短一截（concept-explore-paper），
     所以連沒帶參數的兩張也要寫進來，不然 thumbOf 會去找不存在的 concept-map-iso.png。
     這裡的每一個值都必須跟 tools/shoot.py 的 SHOTS 逐字相同。 */
  'concept-map-explore.html?style=paper':      'concept-explore-paper',
  'concept-map-explore.html?style=navy':       'concept-explore-navy',
  'concept-map-explore.html?style=illus':      'concept-explore-illus',
  'concept-map-explore.html?style=iso':        'concept-explore-iso',
  'concept-map-explore.html?style=paper&tilt=1': 'concept-explore-tilt',
  'concept-map-explore.html?style=fog':        'concept-explore-fog',
  'concept-map-home.html?style=paper':         'concept-home-paper',
  'concept-map-home.html?style=navy':          'concept-home-navy',
  'concept-map-home.html?style=illus&peek=1':  'concept-home-peek',
  'concept-map-footprint.html?style=fog':      'concept-footprint-fog',
  'concept-map-footprint.html?style=paper':    'concept-footprint-paper',
  'concept-map-place.html?id=station':         'concept-place',
  'concept-map-iso.html':                      'concept-iso',
  'concept-map-iso.html?tilt=1&hour=dusk':     'concept-iso-dusk',
  'concept-map-styles.html':                   'concept-styles',
  'concept-map-ride.html?style=navy':          'concept-ride',
  'concept-friend-profile.html?id=sis':                     'concept-friend-profile',
  'concept-friend-profile.html?id=nb1':                     'concept-friend-profile-ai',
  'concept-friend-send.html?to=sis&step=pick':              'concept-friend-send-pick',
  'concept-friend-send.html?to=sis&step=write&card=p3':     'concept-friend-send-write',
  'concept-friend-inbox.html?pill=out':                     'concept-friend-inbox-out',
  'concept-friend-neighbors.html?state=first':              'concept-friend-neighbors-first',
};

function thumbKey(href) {
  const h = href.replace(/^screens\//, '');
  return THUMB_ALIAS[h] || h.replace(/\.html.*$/, '');
}
function thumbOf(href) { return 'assets/thumbs/' + thumbKey(href) + '.png'; }
function miniOf(href)  { return 'assets/thumbs/mini/' + thumbKey(href) + '.png'; }

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

/* --------------------------------------------------------------------------
   樹
   節點：{ id, type, parent, name, kind, href, file, thumb, mini, axis, meta }
   type：system | tab | flow | screen | state | variant | vision | axis | theme | group
   id 命名空間化且穩定（評語掛在上面）：
     sys · tab:explore · flow:a · scr:place · st:place@id=neiwan
     axis:map · var:E · var:E/variant-e-home.html?peek=1 · vis:family · vis:family-a
   流程不是父層：一張畫面可能同時在 A 與 B 上，flow:* 自成一支，用 flowsOf() 反查。
   -------------------------------------------------------------------------- */
let TREE = null;

function fileOf(href) { return href.replace(/^screens\//, ''); }

function buildTree() {
  const nodes = {};
  const order = [];
  function add(n) {
    if (nodes[n.id]) throw new Error('CATALOG：節點 id 重複 ' + n.id);
    n.children = [];
    nodes[n.id] = n;
    order.push(n.id);
    if (n.parent) {
      if (!nodes[n.parent]) throw new Error('CATALOG：' + n.id + ' 的 parent 不存在 ' + n.parent);
      nodes[n.parent].children.push(n.id);
    }
    return n;
  }
  function scrNode(key, parent, type) {
    const s = screen(key);
    const file = fileOf(s.href);
    return add({ id: (type === 'state' ? 'st:' : 'scr:') + key, type: type || 'screen', parent: parent,
                 name: s.name, kind: s.kind, href: 'screens/' + s.href, file: file,
                 thumb: s.thumb, mini: miniOf(s.href), axis: null,
                 meta: { id: s.id, kindLabel: s.kindLabel, key: key } });
  }

  /* 系統 → 分頁 → 畫面（→ 抽屜裡的畫面）→ 狀態 */
  add({ id: 'sys', type: 'system', parent: null, name: 'yoxi 城事', kind: null, href: 'index.html',
        file: null, thumb: null, mini: null, axis: null, meta: { blurb: '主線：保守落地版' } });
  TABS.forEach(function (t) {
    add({ id: 'tab:' + t.id, type: 'tab', parent: 'sys', name: t.name, kind: null, href: null,
          file: null, thumb: null, mini: null, axis: null, meta: { blurb: t.blurb, tab: t.id } });
    t.screens.forEach(function (k) { scrNode(k, 'tab:' + t.id); });
  });
  Object.keys(CHILD_OF).forEach(function (k) { scrNode(k, 'scr:' + CHILD_OF[k]); });
  Object.keys(STATE_OF).forEach(function (k) { scrNode(k, 'scr:' + STATE_OF[k], 'state'); });
  /* 主線裡帶參數的其他狀態 */
  Object.keys(STATES).forEach(function (file) {
    const owner = Object.keys(S).filter(function (k) { return S[k][3] === file; })[0];
    if (!owner) return;                       /* 變體的狀態在下面掛到變體底下 */
    STATES[file].forEach(function (st) {
      const href = file + '?' + st[0];
      add({ id: 'st:' + owner + '@' + st[0], type: 'state', parent: 'scr:' + owner, name: st[1], kind: null,
            href: 'screens/' + href, file: file, thumb: thumbOf(href), mini: miniOf(href), axis: null,
            meta: { blurb: st[2], param: st[0] } });
    });
  });

  /* 變體：依軸線分區 */
  add({ id: 'variants', type: 'group', parent: null, name: '變體', kind: null, href: 'variants.html',
        file: null, thumb: null, mini: null, axis: null, meta: {} });
  AXES.forEach(function (a) {
    add({ id: 'axis:' + a.key, type: 'axis', parent: 'variants', name: a.title, kind: null, href: 'variants.html#axis-' + a.key,
          file: null, thumb: null, mini: null, axis: a.key, meta: { intro: a.intro, pick: a.pick } });
  });
  VARIANTS.forEach(function (v) {
    const first = v.tabs.filter(function (t) { return t[3]; })[0] || v.tabs[0];
    add({ id: 'var:' + v.key, type: 'variant', parent: 'axis:' + v.axis, name: v.tag + ' · ' + v.name,
          kind: v.state, href: first ? first[1] : 'variants.html#var-' + v.key, file: first ? fileOf(first[1]) : null,
          thumb: first ? thumbOf(first[1]) : null, mini: first ? miniOf(first[1]) : null, axis: v.axis,
          meta: { key: v.key, one: v.one, question: v.question, good: v.good, bad: v.bad, when: v.when, where: v.where,
                  verdict: v.verdict, effort: v.effort, risk: v.risk, state: v.state, replaces: v.replaces || [],
                  target: v.target || null, ref: v.ref || null, walled: !!v.walled, tabset: v.tabset || null } });
    v.tabs.forEach(function (t) {
      const id = 'var:' + v.key + '/' + fileOf(t[1]);
      if (nodes[id]) return;
      add({ id: id, type: t[4] ? 'state' : 'screen', parent: 'var:' + v.key, name: t[0], kind: v.state,
            href: t[1], file: fileOf(t[1]).replace(/\?.*$/, ''), thumb: thumbOf(t[1]), mini: miniOf(t[1]), axis: v.axis,
            meta: { blurb: t[2], isMap: !!t[3], stateTag: t[4] || null, variant: v.key } });
    });
  });

  /* 願景探索稿 */
  add({ id: 'visions', type: 'group', parent: null, name: '願景探索稿', kind: null, href: 'vision.html',
        file: null, thumb: null, mini: null, axis: null, meta: {} });
  VISIONS.forEach(function (th) {
    add({ id: 'vis:' + th.theme, type: 'theme', parent: 'visions', name: th.title, kind: null, href: 'vision.html#' + th.theme,
          file: null, thumb: null, mini: null, axis: 'vision', meta: { lead: th.lead } });
    th.dirs.forEach(function (d) {
      add({ id: 'vis:' + th.theme + '-' + d.code, type: 'vision', parent: 'vis:' + th.theme, name: d.name, kind: 'planned',
            href: d.href || null, file: d.href ? fileOf(d.href) : null,
            thumb: d.href ? thumbOf(d.href) : null, mini: d.href ? miniOf(d.href) : null, axis: 'vision',
            meta: { one: d.one, answers: d.answers, where: d.where, risk: d.risk, theme: th.theme, code: d.code } });
    });
  });

  /* 概念稿：組 → 板與手機框。板不在 screens/ 底下，所以 audit-tree 第 4 關
     （只探 screens/ 的 href）不會去載它；縮圖直接指 assets/boards/ 的 PNG。
     needsNet 的那幾支（圖磚頁）thumb 是 null —— 要連網，本來就拍不出縮圖，
     第 5 關只收 thumb 有值的節點，所以會自動跳過。 */
  add({ id: 'concepts', type: 'group', parent: null, name: '概念稿', kind: null, href: 'concept.html',
        file: null, thumb: null, mini: null, axis: null, meta: {} });
  CONCEPTS.forEach(function (g) {
    const gid = 'con:' + g.group;
    add({ id: gid, type: 'theme', parent: 'concepts', name: g.title, kind: null,
          href: 'concept.html#' + g.group, file: null, thumb: null, mini: null,
          axis: 'concept', meta: { lead: g.lead } });
    boardsOf(g).forEach(function (b) {
      add({ id: 'con:board-' + b.href.replace(/^boards\/board-/, '').replace(/\.html$/, ''),
            type: 'vision', parent: gid, name: b.name, kind: 'planned',
            href: b.href, file: b.href.replace(/^boards\//, ''),
            thumb: b.png, mini: b.mini, axis: 'concept', meta: { one: b.one, board: true } });
    });
    g.items.forEach(function (it) {
      const id = 'con:' + g.group + '-' + it.code;
      const dark = it.thumb === null || !!it.needsNet;      /* 拍不出縮圖的 */
      add({ id: id, type: 'vision', parent: gid, name: it.name, kind: 'planned',
            href: it.href, file: fileOf(it.href).replace(/\?.*$/, ''),
            thumb: dark ? null : thumbOf(it.href), mini: dark ? null : miniOf(it.href),
            axis: 'concept',
            meta: { one: it.one, answers: it.answers, where: it.where, risk: it.risk || [],
                    group: g.group, code: it.code, needsNet: !!it.needsNet } });
      /* phones[0] 就是 item.href（同一張畫面的預設參數），不再掛一次。 */
      (it.phones || []).forEach(function (p) {
        if (p.href === it.href) return;
        const net = !!it.needsNet || !!p.needsNet;
        add({ id: id + '/' + p.href, type: 'state', parent: id, name: p.label, kind: 'planned',
              href: p.href, file: fileOf(p.href).replace(/\?.*$/, ''),
              thumb: net ? null : thumbOf(p.href), mini: net ? null : miniOf(p.href),
              axis: 'concept', meta: { group: g.group, code: it.code, needsNet: net } });
      });
    });
  });

  /* 流程：自成一支，步驟指向畫面節點 */
  add({ id: 'flows', type: 'group', parent: null, name: '三條 demo 流程', kind: null, href: 'index.html#flows',
        file: null, thumb: null, mini: null, axis: null, meta: {} });
  FLOWS.forEach(function (f) {
    /* 步驟先找主線節點；找不到就用 href 對（流程 B 最後一步是變體 E 的一個狀態，
       它只存在於變體那一支，以前這裡直接回 null，導覽列走到那一步就是空的）。 */
    const byHref = {};
    order.forEach(function (id) { if (nodes[id].href) byHref[nodes[id].href] = id; });
    const steps = f.steps.map(function (st) {
      if (nodes['st:' + st.s]) return 'st:' + st.s;
      if (nodes['scr:' + st.s]) return 'scr:' + st.s;
      return byHref['screens/' + screen(st.s).href] || null;
    });
    add({ id: 'flow:' + f.key, type: 'flow', parent: 'flows', name: f.tag + ' · ' + f.name, kind: null,
          href: 'screens/' + screen(f.steps[0].s).href + (screen(f.steps[0].s).href.indexOf('?') >= 0 ? '&' : '?') + 'flow=' + f.key + '&step=1',
          file: null, thumb: screen(f.steps[0].s).thumb, mini: miniOf(screen(f.steps[0].s).href), axis: null,
          meta: { why: f.why, proves: f.proves, steps: steps, says: f.steps.map(function (st) { return st.say; }) } });
  });

  /* 反查：畫面在哪些流程上；主線畫面有哪些變體 */
  const flowsOf = {};
  FLOWS.forEach(function (f) {
    nodes['flow:' + f.key].meta.steps.forEach(function (id, i) {
      if (!id) return;
      (flowsOf[id] = flowsOf[id] || []).push({ flow: f.key, step: i + 1 });
    });
  });
  const variantsOf = {};
  VARIANTS.forEach(function (v) {
    (v.replaces || []).forEach(function (k) {
      (variantsOf['scr:' + k] = variantsOf['scr:' + k] || []).push('var:' + v.key);
    });
  });

  TREE = { nodes: nodes, order: order, roots: ['sys', 'flows', 'variants', 'visions', 'concepts'],
           flowsOf: flowsOf, variantsOf: variantsOf };
  return TREE;
}

function tree() { return TREE || buildTree(); }
function node(id) { return tree().nodes[id] || null; }
function children(id) { const n = node(id); return n ? n.children.map(node) : []; }
function ancestors(id) {
  const out = [];
  let n = node(id);
  while (n && n.parent) { n = node(n.parent); if (n) out.unshift(n); }
  return out;
}
function flowsOf(id) { return tree().flowsOf[id] || []; }
function variantsOf(id) { return (tree().variantsOf[id] || []).map(node); }
function byAxis(axis) { return VARIANTS.filter(function (v) { return v.axis === axis; }); }
function variant(key) { return VARIANTS.filter(function (v) { return v.key === key; })[0] || null; }

window.CATALOG = {
  SCREENS: S, GROUPS: GROUPS, FLOWS: FLOWS, KIND: KIND,
  TABS: TABS, CHILD_OF: CHILD_OF, STATE_OF: STATE_OF, STATES: STATES,
  AXES: AXES, VARIANTS: VARIANTS, VISIONS: VISIONS, CONCEPTS: CONCEPTS, THUMB_ALIAS: THUMB_ALIAS,
  screen: screen, flow: flow, thumbOf: thumbOf, miniOf: miniOf, thumbKey: thumbKey, boardsOf: boardsOf,
  tree: tree, node: node, children: children, ancestors: ancestors,
  flowsOf: flowsOf, variantsOf: variantsOf, byAxis: byAxis, variant: variant,
};
})();
