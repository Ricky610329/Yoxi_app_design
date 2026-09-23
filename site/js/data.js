/* ==========================================================================
   yoxi 城事 介紹網站 — 資料與公式（window.SITE_DATA）

   公式與 app/js/app.js 的 APP.fmt 同一套；改了那邊要同步這邊。
   地點對得上 prototype/assets/map/hs-places.js（座標）與 prototype/assets/photos/credits.js（實景照片與授權）；
   名稱與一句話來自 prototype/js/mock.js 的 SPOTS。畫面上的數字一律用 fmt 算，不手寫。
   ========================================================================== */
(function () {
'use strict';

const WALK_MAX_M = 3000;      /* 走路門檻：超過才建議叫車、才有搭車抵達的 +50 與金框 */
const RIDE_BONUS = 50;        /* 原型畫面固定 +50；簡報建議依距離 20／35／50 點＋每人每月上限 */

const fmt = {
  fare:    km => Math.round(75 + 22 * km),          /* 元 */
  rideMin: km => Math.round(3 + 2.2 * km),          /* 分 */
  walkMin: m  => Math.round(m / 75),                /* 分 */
  ridePts: km => Math.floor(fmt.fare(km) / 20),     /* 搭車回饋：每 20 元 1 點，無條件捨去 */
  km:      m  => Math.round((Number(m) || 0) / 100) / 10,   /* 公尺 → 公里（一位小數） */
  walkable: m => m <= WALK_MAX_M,
  money:   n  => '$' + Math.round(n).toLocaleString('en-US'),
};

/* 10 個新竹地點（原型裡的「地方」）。real:false 是原型虛構、錨在真實鄰近地點上的地方。
   hook 是模擬 AI 草稿的一句話示意，不是查證過的史實；正式版由地方內容產線（AI 草稿 → 編輯審 → 有出處才上架）供給。 */
const places = [
  { id: 'glass-kiln', name: '水利路的老玻璃窯', type: '工業遺構', dist: 900,  art: 'glass',   real: false, photo: null,
    hook: '這條巷子 1970 年代是全街最亮的地方。', today: true },
  { id: 'market',  name: '東門市場',           type: '市場', dist: 1400, art: 'market',  real: true,  photo: 'market',
    hook: '白天是菜市場，晚上是另一批人的店。' },
  { id: 'temple',  name: '新竹城隍廟',         type: '廟宇', dist: 1600, art: 'temple',  real: true,  photo: 'temple',
    hook: '廟埕的小吃攤，比廟的年紀還老。' },
  { id: 'station', name: '新竹車站',           type: '車站', dist: 1200, art: 'station', real: true,  photo: 'station',
    hook: '1913 年的站體，還在每天發車。' },
  { id: 'moat',    name: '護城河的舊碼頭階梯', type: '水岸', dist: 1800, art: 'moat',    real: false, photo: 'moat',
    hook: '河道被蓋起來之前，這裡是上下貨的地方。' },
  { id: 'brick',   name: '新竹州廳',           type: '官署', dist: 1500, art: 'brick',   real: true,  photo: 'brick',
    hook: '1927 年蓋的，現在還在辦公。' },
  { id: 'hill',    name: '十八尖山的防空洞',   type: '山徑', dist: 3100, art: 'hill',    real: false, photo: 'hill',
    hook: '山壁上還留著十幾個洞口。' },
  { id: 'lake',    name: '青草湖的舊戲院地基', type: '遺構', dist: 6400, art: 'lake',    real: false, photo: 'lake',
    hook: '湖乾涸的那幾年，戲院的地基露了出來。' },
  { id: 'harbour', name: '南寮漁港',           type: '海岸', dist: 8200, art: 'harbour', real: true,  photo: 'harbour',
    hook: '風大的日子，堤防上全是放風箏的人。' },
  { id: 'rail',    name: '竹中站',             type: '車站', dist: 7800, art: 'rail',    real: true,  photo: 'rail',
    hook: '內灣線在這裡分出去，往山裡走。' },
];

/* 走不到的遠方：內灣老街 28 km（兩個地圖 bbox 都在外） */
const far = { id: 'neiwan', name: '內灣老街', type: '老街', km: 28.0, art: 'rail', photo: 'neiwan',
              hook: '內灣線是為了運木材而蓋的，老街在鐵路的盡頭。' };

/* 深連結（相對 site/index.html） */
const APP = '../app/index.html#';
const links = {
  app: APP + '/ride',
  appWelcome: APP + '/welcome',
  appExplore: APP + '/explore',
  appMap: APP + '/explore/map',
  appPlace: id => APP + '/place/' + id,
  appRoutes: APP + '/routes',
  appRoute: APP + '/route/rail',
  appAlbum: APP + '/album',
  appFootprint: APP + '/footprint',
  appWeek: APP + '/week',
  appElder: APP + '/elder',
  appPoints: APP + '/points',
  appSettings: APP + '/settings',
  proposal: '../prototype/proposal.html',
  prototype: '../prototype/index.html',
  overview: '../prototype/overview.html',
  concept: '../prototype/concept.html',
  variants: '../prototype/variants.html',
  vision: '../prototype/vision.html',
  deckHtml: '../pitch/deck/index.html',
  deckPdf: '../pitch/deck/out/yoxi_城事_初賽提案.pdf',
  video: '../pitch/video/out/draft.mp4',
  videoPoster: '../pitch/video/out/board/01-s01-quiet.png',
  shots: name => '../app/assets/shots/' + name + '.png',
  thumbs: name => '../prototype/assets/thumbs/' + name + '.png',
  photos: file => '../prototype/assets/photos/' + file,
  boards: name => '../prototype/assets/boards/' + name + '.png',
  readme: '../README.md',
};

window.SITE_DATA = { fmt, WALK_MAX_M, RIDE_BONUS, places, far, links,
  /* 內容 agent 可以在下面追加：roadmap、ai、promises、narratives …（只加不改上面的） */
};
})();

/* ==========================================================================
   內容 agent 追加（sections.js 用）：週曆條、AI 四個角色、五步路線圖。
   來源：docs/narratives/*.md、pitch/docs/ai-architecture.md §1–§2 與 §8.2、pitch/docs/roadmap.md §1.2、
         pitch/docs/kpi.md（北極星）、prototype/js/catalog.js 的 ROADMAP。目標值都是假設。
   ========================================================================== */
(function () {
'use strict';
const D = window.SITE_DATA;
if (!D) return;

/* 為什麼：一週七天。ride:true 是有叫車的那兩天（兩態都一樣，城事沒有多叫一趟車）。 */
D.week = {
  days: [
    { d: '一', why: '今天的地方' },
    { d: '二', why: '走過去',     ride: true },
    { d: '三', why: '到了才上色' },
    { d: '四', why: '晚上的回顧' },
    { d: '五', why: '去遠方',     ride: true },
    { d: '六', why: '週回顧給爸媽' },
    { d: '日', why: '今天的地方' },
  ],
  now:  '要出門才打開。不搭車的日子，yoxi 就安靜了。',
  with: '每天都有一個跟車無關的理由；叫車的那兩天還在，而且走不到的地方多了一個叫車的理由。',
  kpi:  '目標：非叫車開啟週活躍率比對照組高 5 個百分點（假設）。驗證：新竹試辦 12 週，隨機留 10% 對照組看不到任何城事入口，比兩組的差距。',
};

/* AI 的四個角色（ai-architecture.md §1 表、§2 規格、§8.2 原型現況） */
D.ai = [
  { id: 'rec', icon: 'place', name: '推薦今天的地方',
    line: '每個人每天一個地方，附「為什麼推薦給你」。',
    how: '用 yoxi 去識別化的叫車時段、熱門上下車與活動熱點，加上你自己常出發的地方與收藏缺口，夜裡先排好；Gemini 把排序的依據寫成一句人話。候選只從編輯審過的地方裡挑。',
    without: '每個人看到同一份編輯精選；「附理由」的說服力就沒了。',
    proto: '示意資料：五條理由是預先寫好的，示範依據長什麼樣，還不是算出來的。' },
  { id: 'content', icon: 'route', name: '地方內容產線',
    line: '替編輯起草「現在的它、以前的它、為什麼是今天」與每月的路線。',
    how: 'Gemini 讀公告、文化資產資料與 OSM 起草，每一句附出處；另一個便宜的模型逐句檢查能不能指回來源，指不回的標紅。AI 沒有上架權限。',
    without: '一個新地方的工時從一半回到原本（假設），同一位編輯每月能上的地方約減半，跨城擴張卡在人力。',
    proto: '預先寫好的文本：編輯風格的手寫文字，其中 4 個地方是虛構的，標出來了。' },
  { id: 'card', icon: 'postcard', name: '明信片與長輩圖',
    line: '到了才上色的那張圖：這個地方、這個季節、這個光線。',
    how: 'Imagen 依地點、季節、光線、天氣預先生成圖庫，地標類餵參考照片對構圖；編輯每格三選一。解鎖時從圖庫取，不即時生成。金框與長輩圖是程式在同一張圖上疊框、疊字。',
    without: '退回實景照片或程式畫的風格卡；下雨的夜晚拍不到，一座城幾千張也畫不起。',
    proto: '程式生成的圖：漸層加幾何剪影，標「AI 生成示意」，不是 Imagen 的輸出。' },
  { id: 'story', icon: 'elder', name: '回顧的自動敘事',
    line: '把一天、一週寫成回顧，你只選心情。',
    how: '只送結構化的摘要（步數、去過哪些地方、新收的卡、你選的心情），不送 GPS 軌跡與照片；Gemini 寫週回顧與長輩圖上的一句問候。上線第一版每天的回顧先用模板。',
    without: '退回數字模板：「今天走了幾公里，經過幾個地方」。這一項最不需要 AI，所以排最後上。',
    proto: '預先寫好的文本：回顧用固定數字，模板版就是退路版。' },
];

/* 五步路線圖（roadmap.md §1.2；catalog.js ROADMAP）。時間都是建議；目標值都是假設。 */
D.roadmap = [
  { n: 0, name: '記錄與獎章', when: '2027 Q1 · 新竹 12 週', flag: '叫車首頁不動、tab bar 不動',
    line: '搭車抵達一個城事地方，行程結束頁多一張明信片；地方頁「設為下車點」；抽屜裡每天一張「今天的地方」卡。',
    do: '抽屜多一個「城事」入口；早上一則可關的推播；評分之後的金色橫幅；和泰 Points 明細多一列；地方詳情頁 {walkmax} km 外的主按鈕是「設為下車點」。',
    keep: 'tab bar、叫車主畫面、叫車關鍵路徑 4 下都不動。',
    pre: '沒有前提，今天就能上。',
    gate: '守門：叫車成功率、配對時間、取消率、評分填寫率、客服進線，任一變差就關橫幅與「設為下車點」。停損：第 6 週北極星與對照組差距不到 1 個百分點（假設），只留記錄與獎章。',
    team: '約 7 FTE（6 位全職＋資料、QA、法遵部分工時）' },
  { n: 1, name: '探索', when: '2027 Q2',
    line: '「今天的地方」長成完整探索頁：地圖、路線、缺口導向；晚上多一則回顧推播。',
    do: '完整探索頁、探索地圖最多 10 個景點、路線、前往中、晚上的推播（一天最多兩則，各自可關）；依開啟數據決定 tab bar。',
    keep: '叫車主畫面仍不動。',
    pre: '第 0 步北極星比對照組高 5 個百分點（假設），守門指標沒有一項變差。',
    gate: '守門：推播關閉率超過 15% 就降為一則（假設）。停損：內容產線每月產不出一條路線。',
    team: '8 人' },
  { n: 2, name: '轉換', when: '2027 Q3',
    line: '叫車地圖上最多 4 個景點（先預設關）；路線上腳到不了的一段直接接上 yoxi；到了之後回程用車。',
    do: '叫車首頁地圖加一個圖層開關＋伺服器端 kill switch；路線斷點與回程用車上線。',
    keep: '叫車關鍵路徑 4 下、收合態 0 像素、上下車 pin 不被遮。',
    pre: '試辦第 12 週：「設為下車點」組每人總訂單比對照組高 5%（假設）；六條承諾在正式程式重量全綠。',
    gate: '守門：點景點後 3 秒內關掉的比例超過 10% 就降到 2 顆；叫車首頁到送出的時間變長就關圖層。',
    team: '7 人' },
  { n: 3, name: '分享與世代', when: '2027 Q3–Q4',
    line: '週回顧、長輩圖、「傳給家人」；好友先不做。',
    do: '收藏頁的分享面板；邀請好友入口放同一區；六都擴張第一波。',
    keep: '沒有聊天、不比誰多、沒有未讀數字；日誌與心情沒有分享鍵。',
    pre: '每人明信片中位數至少 4 張（假設，否則沒東西可分享）；隱私分軌已上線。',
    gate: '守門：分享內容含位置資訊的事件數為 0。停損：長輩端每週開啟不成立，就不做「家人模式」。',
    team: '5 人' },
  { n: 4, name: '整合', when: '2028 起',
    line: '大型活動、健檢出行、多點行程、真實地圖質感。每一項獨立立案。',
    do: '接預約叫車、機場接送、企業簽單與多點行程。',
    keep: '依案而定；叫車主流程的承諾照舊。',
    pre: '前三步的資料與內容成立；活動與醫療合作方簽約。',
    gate: '依案而定；範圍暴衝就停。',
    team: '依案' },
];
})();
