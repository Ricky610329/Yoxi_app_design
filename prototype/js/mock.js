/* ==========================================================================
   yoxi 城事 — Mock Data

   場景設定在新竹：實機截圖的上車點是「東區水利路 46 巷 58 號」，
   地圖上看得到六家支線鐵路。流程 B 的長程目的地用內灣（距市區 28km，
   走路不可達，必須叫車），而內灣線正是那條支線。

   敘事文本模擬 AI 生成的結果。原型階段為預先寫好的靜態內容 —— 見 plan §8
   風險 3：決賽現場不賭即時 API。
   ========================================================================== */

const USER = {
  name: 'Rick',
  home: '東區水利路 46 巷 58 號',
  city: '新竹市',
  points: 0,
  steps: 6240,
  distanceToday: 4.3,
  monthPlaces: 12,
  monthBadges: 3,
  monthKm: 48,
  coverage: 14,
};

/* --------------------------------------------------------------------------
   明信片視覺
   原型階段用 CSS 漸層 + SVG 幾何模擬 AI 生成的圖像，畫面上標註「AI 生成示意」。
   每張都由同一組風格參數產生（色帶 + 地平線 + 主體剪影），模擬「風格鎖定」。
   -------------------------------------------------------------------------- */

const ART = {
  glass:   { sky: ['#F5C7B8', '#FF8A6B', '#C7452E'], ground: '#1E3A5C', motif: 'chimney' },
  market:  { sky: ['#FFE2B8', '#FFB259', '#D4761F'], ground: '#2A2118', motif: 'lantern' },
  moat:    { sky: ['#CFE6F2', '#7FB6D6', '#2E6F96'], ground: '#1B4332', motif: 'bridge' },
  temple:  { sky: ['#FFD9C2', '#F2765A', '#8C2B1E'], ground: '#241A16', motif: 'roof' },
  harbour: { sky: ['#D6ECF5', '#6FB0CC', '#1F5C7A'], ground: '#0E2A38', motif: 'lighthouse' },
  station: { sky: ['#E8DCC8', '#C4A57B', '#6B4E2E'], ground: '#2B2016', motif: 'dome' },
  hill:    { sky: ['#DCEFD4', '#8FC084', '#3E6B47'], ground: '#1C3A26', motif: 'trees' },
  lake:    { sky: ['#E0D4F0', '#9B8ACB', '#4A3C73'], ground: '#1F2440', motif: 'water' },
  rail:    { sky: ['#F0E4D0', '#D9A86C', '#8A5A2B'], ground: '#2E2419', motif: 'track' },
  oldst:   { sky: ['#FFE8CC', '#E8A15C', '#A35F28'], ground: '#332415', motif: 'arcade' },
  hakka:   { sky: ['#E4EDDC', '#A8BE8C', '#556B3D'], ground: '#232E1C', motif: 'terrace' },
  brick:   { sky: ['#F7DCC9', '#DB8F63', '#8F4A28'], ground: '#2C1D14', motif: 'wall' },
};

/* --------------------------------------------------------------------------
   今天的地方
   -------------------------------------------------------------------------- */

const TODAY = {
  id: 'glass-kiln',
  name: '水利路的老玻璃窯',
  type: '工業遺構',
  art: 'glass',
  distance: 900,
  walkMin: 12,
  hook: '這條巷子在 1970 年代是全街最亮的地方。',
  eyebrow: '今天的地方',

  story: [
    {
      label: '現在的它',
      text: '從你家走出去第三個路口，有一道被鐵皮半掩的紅磚牆。牆後是一座停用的玻璃窯，' +
            '窯口還留著熔融過的痕跡，像一塊沒擦乾淨的糖。白天沒人會注意它，' +
            '但下午四點以後，光會從西邊斜進窯口。',
    },
    {
      label: '以前的它',
      text: '新竹曾經是全世界最會做玻璃的地方之一。這裡有矽砂、有天然氣，' +
            '兩樣做玻璃最貴的東西都便宜。1970 年代這條巷子裡有七座窯，' +
            '日夜不熄，整條街是亮的。做聖誕燈泡、做實驗器皿、做外銷的玻璃動物。' +
            '後來訂單走了，窯一座一座冷掉。這是最後一座沒被拆的。',
    },
    {
      label: '為什麼是今天',
      text: '這個週末開始它要整修三個月，鐵皮會全部圍起來。' +
            '也就是說，今天是接下來一季裡，你還看得到那道牆的少數幾天。',
    },
  ],

  /* AI 推薦依據 —— 這是給評審看「AI 與官方資料如何落地」的窗口 */
  why: [
    { src: '常用地點', text: '你這個月有 9 趟行程從水利路出發，但從沒往北走過那個路口' },
    { src: '常用時段', text: '你週日下午通常在家，這是你一週裡最可能出門走走的時段' },
    { src: '收集缺口', text: '你的圖鑑裡還沒有任何一張「工業遺構」類的明信片' },
    { src: '天氣',     text: '今天下午 3–6 點降雨機率 10%，西曬角度正好' },
    { src: '活動資料', text: '此地本週六起封閉整修 90 天' },
  ],

  tip: '到了記得看窯口左側那塊燒到變形的磚，那是溫度超過 1400 度才會有的樣子。',
  hours: '戶外空間，全天可看',
};

/* --------------------------------------------------------------------------
   還沒去的地方 —— 過去推薦過但沒去的，永久保留、永不過期。
   這條清單本身就是「反限時」的展示品。
   -------------------------------------------------------------------------- */

const PENDING = [
  { id: 'moat',    name: '護城河的舊碼頭階梯', type: '水岸', art: 'moat',    distance: 1800, ago: '3 天前推薦' },
  { id: 'temple',  name: '長和宮的媽祖船',     type: '廟宇', art: 'temple',  distance: 2400, ago: '5 天前推薦' },
  { id: 'hill',    name: '十八尖山的防空洞',   type: '山徑', art: 'hill',    distance: 3100, ago: '上週推薦' },
  { id: 'lake',    name: '青草湖的舊戲院地基', type: '遺構', art: 'lake',    distance: 6400, ago: '上週推薦' },
];

/* --------------------------------------------------------------------------
   主題路線
   -------------------------------------------------------------------------- */

const ROUTES = [
  {
    id: 'rail',
    name: '沿著鐵道走：內灣線的六個站',
    sub: '6 站 · 慢慢走，沒有期限',
    art: 'rail',
    done: 2,
    total: 6,
    badge: { id: 'rail-badge', name: '內灣線全線', award: '你走完了內灣線的每一個站。' },
    stops: [
      { id: 's1', name: '新竹車站',   type: '車站', art: 'station', dist: 1200,  state: 'done',
        note: '1913 年落成，台灣還在用的最老車站。' },
      { id: 's2', name: '竹中站',     type: '車站', art: 'rail',    dist: 7800,  state: 'done',
        note: '內灣線與六家線在這裡分家。' },
      { id: 's3', name: '內灣老街',   type: '老街', art: 'oldst',   dist: 28000, state: 'next',
        note: '線的盡頭。走路到不了，這一段要搭車。' },
      { id: 's4', name: '合興車站',   type: '車站', art: 'hakka',   dist: 24000, state: 'todo',
        note: '' },
      { id: 's5', name: '九讚頭站',   type: '車站', art: 'brick',   dist: 21000, state: 'todo',
        note: '' },
      { id: 's6', name: '橫山站',     type: '車站', art: 'hill',    dist: 19000, state: 'todo',
        note: '' },
    ],
  },
  {
    id: 'glass',
    name: '風城的玻璃',
    sub: '5 站 · 從砂到光',
    art: 'glass',
    done: 1,
    total: 5,
    badge: { id: 'glass-badge', name: '風城玻璃', award: '你看過了新竹玻璃的一生。' },
    stops: [],
  },
  {
    id: 'water',
    name: '水的三種樣子',
    sub: '4 站 · 河、港、湖',
    art: 'moat',
    done: 0,
    total: 4,
    badge: { id: 'water-badge', name: '水路', award: '你走過了新竹的河、港與湖。' },
    stops: [],
  },
];

/* 流程 B 的目的地：內灣老街 */
const FAR_PLACE = {
  id: 'neiwan',
  name: '內灣老街',
  type: '老街',
  art: 'oldst',
  distance: 28000,
  driveMin: 42,
  fare: 680,
  hook: '內灣線的盡頭。這條街因為一條運木材的鐵路而生，也因為它停駛而睡了三十年。',
  eyebrow: '沿著鐵道走 · 第 3 站',

  story: [
    {
      label: '現在的它',
      text: '假日的內灣是熱鬧的，野薑花粽、客家菜包、吊橋上擠滿人。' +
            '但如果你往戲院後面那條沒有招牌的巷子走進去，會突然安靜下來。' +
            '那裡還有幾戶人家住著日治時期的木造宿舍。',
    },
    {
      label: '以前的它',
      text: '內灣線原本不是給人坐的。1951 年通車，是為了把尖石山上的木材與' +
            '水泥原料運下山。那時候內灣有三千多人，有戲院、有酒家、有撞球間。' +
            '林業一停，人就走了。1990 年代這裡只剩下幾百人，' +
            '內灣戲院變成堆放雜物的倉庫。',
    },
    {
      label: '為什麼是今天',
      text: '這是「沿著鐵道走」的第三站，也是唯一一站走路到不了的地方。' +
            '從你家 28 公里，搭車 42 分鐘。今天下午內灣戲院有一場老電影放映，' +
            '一個月只有一次。',
    },
  ],

  why: [
    { src: '路線進度', text: '你已經完成內灣線的前兩站，這是接下來的一站' },
    { src: '距離判斷', text: '28 公里，步行不可達 —— 這一段需要搭車' },
    { src: '活動資料', text: '內灣戲院今日 14:00 有老電影放映，每月一場' },
    { src: '運力調度', text: '週日下午新竹往內灣方向回程車較多，這個時段叫車較好媒合' },
  ],

  tip: '戲院後面那條沒招牌的巷子，走到底右轉。',
  hours: '老街全日；戲院放映 14:00',
  ridePoints: 50,
  inRideStory: {
    title: '這趟路上的 12 分鐘',
    heading: '為什麼內灣線是台灣最後一條「為了木材」蓋的鐵路',
    text: '你現在正在走的這條台三線，幾乎跟內灣線平行。1950 年代，' +
          '這條路上每天有上百輛卡車，載著從尖石砍下來的檜木往下走……',
  },
};

/* --------------------------------------------------------------------------
   明信片牆
   -------------------------------------------------------------------------- */

const POSTCARDS = [
  { id: 'p1', name: '新竹車站',       art: 'station', date: '09.02', state: 'done',  by: 'walk' },
  { id: 'p2', name: '東門市場',       art: 'market',  date: '09.05', state: 'done',  by: 'walk' },
  { id: 'p3', name: '護城河親水公園', art: 'moat',    date: '09.08', state: 'done',  by: 'walk' },
  { id: 'p4', name: '南寮漁港',       art: 'harbour', date: '09.12', state: 'done',  by: 'ride' },
  { id: 'p5', name: '竹中站',         art: 'rail',    date: '09.14', state: 'done',  by: 'walk' },
  { id: 'p6', name: '十八尖山',       art: 'hill',    date: '09.17', state: 'done',  by: 'walk' },
  { id: 'p7', name: '新竹城隍廟',     art: 'temple',  date: '09.19', state: 'done',  by: 'walk' },
  { id: 'p8', name: '青草湖',         art: 'lake',    date: '09.20', state: 'done',  by: 'ride' },
  { id: 'p9',  name: '內灣老街',      art: 'oldst',   state: 'locked' },
  { id: 'p10', name: '合興車站',      art: 'hakka',   state: 'locked' },
  { id: 'p11', name: '水利路老玻璃窯', art: 'glass',  state: 'locked' },
  { id: 'p12', name: '九讚頭站',      art: 'brick',   state: 'locked' },
];

const BADGES = [
  { id: 'b1', name: '舊城區',   icon: 'place',  got: true,  prog: '收集 6/6' },
  { id: 'b2', name: '水路',     icon: 'route',  got: true,  prog: '收集 4/4' },
  { id: 'b3', name: '老車站',   icon: 'badge',  got: true,  prog: '收集 3/3' },
  { id: 'b4', name: '內灣線全線', icon: 'route', got: false, prog: '收集 2/6' },
  { id: 'b5', name: '風城玻璃', icon: 'badge',  got: false, prog: '收集 1/5' },
  { id: 'b6', name: '山與湖',   icon: 'steps',  got: false, prog: '收集 2/5' },
];

/* --------------------------------------------------------------------------
   每日回顧
   步數折線的轉折點：3,000 步、5,000 步，之後每 5,000 步一折。
   -------------------------------------------------------------------------- */

const LOOKBACK = {
  steps: 6240,
  km: 4.3,
  places: ['水利路', '東門市場', '護城河'],
  photos: ['glass', 'market', 'moat'],
  newCards: ['水利路老玻璃窯'],
};

/* --------------------------------------------------------------------------
   霧地圖：新竹市 8×10 網格的探索狀態
   fog = 沒去過｜seen = 去過｜fade = 90 天未回訪（轉淡，但明信片不會消失）
   -------------------------------------------------------------------------- */

const FOG = [
  'ffffffff', 'ffffssff', 'fffsssff', 'ffsSSsff',
  'ffsSSSsf', 'ffsSSsff', 'fffssdff', 'ffffdfff',
  'ffffffff', 'ffffffff',
].map(row => row.split('').map(c => ({
  f: 'fog', s: 'seen', S: 'seen', d: 'fade',
}[c])));

/* 你的城市顏色：AI 依去過的地點類型配出的色票 */
const CITY_COLORS = ['#C7452E', '#D4761F', '#2E6F96', '#1F5C7A', '#6B4E2E', '#3E6B47'];

window.MOCK = { USER, ART, TODAY, PENDING, ROUTES, FAR_PLACE, POSTCARDS, BADGES, LOOKBACK, FOG, CITY_COLORS };
