/* ==========================================================================
   yoxi 城事 — Mock Data

   場景設定在新竹：實機截圖的上車點是「東區水利路 46 巷 58 號」，
   地圖上看得到六家支線鐵路。流程 B 的長程目的地用內灣（距市區 28km，
   走路不可達，必須叫車），而內灣線正是那條支線。

   敘事文本模擬 AI 生成的結果。原型階段為預先寫好的靜態內容 —— 見 plan §8
   風險 3：決賽現場不賭即時 API。
   ========================================================================== */

/* 使用者。名字與住址會出現在畫面上，其餘統計一律由 STATE 算 ——
   這裡曾經放過 monthPlaces / monthBadges / coverage，結果沒有任何畫面在用，
   值卻全部跟實際狀態對不上，變成簡報引錯數字的來源。刪掉了。 */
const USER = {
  name: 'Rick',
  home: '東區水利路 46 巷 58 號',
  city: '新竹市',
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
  area: '新竹市東區',
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

/* 「還沒去的地方」必須跟地圖上 state:'new' 的那幾顆是同一組。
   兩邊對不起來的話，點「在地圖上看」會找不到剛剛看到的那個地方。
   id 也不能跟 SPOTS 撞 —— findPlace 先查這裡，撞到就會把人帶去另一個地方。 */
const PENDING = [
  { id: 'moat',    name: '護城河的舊碼頭階梯', type: '水岸', art: 'moat',  distance: 1800, ago: '3 天前推薦' },
  { id: 'brick',   name: '新竹州廳',          type: '官署', art: 'brick', distance: 2400, ago: '5 天前推薦' },
  { id: 'hill',    name: '十八尖山的防空洞',   type: '山徑', art: 'hill',  distance: 3100, ago: '上週推薦' },
  { id: 'lake',    name: '青草湖的舊戲院地基', type: '遺構', art: 'lake',  distance: 6400, ago: '上週推薦' },
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
    total: 6,
    badge: 'b4',
    /* 站序照內灣線實際地理排（新竹→竹中→橫山→九讚頭→合興→內灣，內灣是終點）。
       但這條路線沒有順序壓力，所以另外標一站「先去這裡」—— 它是唯一走路到不了的
       一站，也是這條線存在的理由。沒有這個欄位的話，推薦會被陣列順序綁死。 */
    feature: 'p9',
    stops: [
      { id: 's1', name: '新竹車站',   type: '車站', art: 'station', card: 'p1', dist: 1200,  state: 'done',
        note: '1913 年落成，台灣還在用的最老車站。' },
      { id: 's2', name: '竹中站',     type: '車站', art: 'rail', card: 'p5',    dist: 7800,  state: 'done',
        note: '內灣線與六家線在這裡分家。' },
      { id: 's3', name: '橫山站',     type: '車站', art: 'hill', card: 'p13',   dist: 19000, state: 'todo',
        note: '' },
      { id: 's4', name: '九讚頭站',   type: '車站', art: 'brick', card: 'p12',  dist: 21000, state: 'todo',
        note: '' },
      { id: 's5', name: '合興車站',   type: '車站', art: 'hakka', card: 'p10',  dist: 24000, state: 'todo',
        note: '' },
      { id: 's6', name: '內灣老街',   type: '老街', art: 'oldst', card: 'p9',   dist: 28000, state: 'next',
        note: '線的盡頭。28 公里，這一段搭車比較合理。' },
    ],
  },
  {
    id: 'glass',
    name: '風城的玻璃',
    sub: '5 站 · 從砂到光',
    art: 'glass',
    total: 5,
    badge: 'b5',
    stops: [
      { id: 'g1', name: '舊社的矽砂場',    card: 'p16', art: 'hill',  dist: 5200, note: '玻璃的起點是砂。' },
      { id: 'g2', name: '水利路的老玻璃窯', card: 'p11', art: 'glass', dist: 900,  note: '最後一座沒被拆的窯。' },
      { id: 'g3', name: '水源地的窯口',    card: 'p17', art: 'glass', dist: 2600, note: '' },
      { id: 'g4', name: '春池玻璃',        card: 'p15', art: 'glass', dist: 6800, note: '' },
      { id: 'g5', name: '玻璃工藝博物館',  card: 'p14', art: 'brick', dist: 2100, note: '' },
    ],
  },
  {
    id: 'water',
    name: '水的三種樣子',
    sub: '4 站 · 河、港、湖',
    art: 'moat',
    total: 4,
    badge: 'b2',
    stops: [
      { id: 'w1', name: '護城河親水公園', card: 'p3',  art: 'moat',    dist: 1800,  note: '' },
      { id: 'w2', name: '南寮漁港',      card: 'p4',  art: 'harbour', dist: 8200,  note: '' },
      { id: 'w3', name: '青草湖',        card: 'p8',  art: 'lake',    dist: 6400,  note: '' },
      { id: 'w4', name: '頭前溪河口',    card: 'p18', art: 'moat',    dist: 11000, note: '' },
    ],
  },
];

/* 流程 B 的目的地：內灣老街 */
const FAR_PLACE = {
  id: 'neiwan',
  name: '內灣老街',
  area: '新竹縣橫山鄉',
  type: '老街',
  art: 'oldst',
  distance: 28000,
  driveMin: 42,
  fare: 680,
  hook: '內灣線的盡頭。這條街因為一條運木材的鐵路而生，也因為它停駛而睡了三十年。',
  eyebrow: '沿著鐵道走 · 線的盡頭',

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
      text: '這是「沿著鐵道走」的終點站，也是唯一一站走路到不了的地方。' +
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
  { id: 'p13', name: '橫山站',        art: 'hill',    state: 'locked' },
  { id: 'p14', name: '玻璃工藝博物館', art: 'brick',   state: 'locked' },
  { id: 'p15', name: '春池玻璃',      art: 'glass',   state: 'locked' },
  { id: 'p16', name: '舊社的矽砂場',  art: 'hill',    state: 'locked' },
  { id: 'p17', name: '水源地的窯口',  art: 'glass',   state: 'locked' },
  { id: 'p18', name: '頭前溪河口',    art: 'moat',    state: 'locked' },
  /* 「還沒去的地方」那四個。以前它們沒有明信片，走到了 collect() 會安靜地失敗，
     而且前往中與抵達解鎖寫死玻璃窯，人走去護城河、收下的卻是玻璃窯那張。 */
  { id: 'p19', name: '護城河的舊碼頭階梯', art: 'moat',  state: 'locked' },
  { id: 'p20', name: '新竹州廳',          art: 'brick', state: 'locked' },
  { id: 'p21', name: '十八尖山的防空洞',   art: 'hill',  state: 'locked' },
  { id: 'p22', name: '青草湖的舊戲院地基', art: 'lake',  state: 'locked' },
];

/* 獎章＝一組明信片 id。進度與是否獲得一律由 STATE 依這組 id 算出來，
   不在各畫面各寫一份 —— 同一枚獎章在不同畫面顯示不同數字是最容易被抓包的錯。 */
const BADGES = [
  { id: 'b1', name: '舊城區',     icon: 'place', award: '你走遍了新竹的舊城區。',
    ids: ['p2', 'p3', 'p7'] },
  { id: 'b3', name: '老車站',     icon: 'badge', award: '你去過新竹最老的兩座車站。',
    ids: ['p1', 'p5'] },
  { id: 'b2', name: '水路',       icon: 'route', award: '你走過了新竹的河、港與湖。',
    ids: ['p3', 'p4', 'p8', 'p18'] },
  { id: 'b4', name: '內灣線全線', icon: 'route', award: '你走完了內灣線的每一個站。',
    ids: ['p1', 'p5', 'p9', 'p10', 'p12', 'p13'] },
  { id: 'b5', name: '風城玻璃',   icon: 'badge', award: '你看過了新竹玻璃的一生。',
    ids: ['p16', 'p11', 'p17', 'p15', 'p14'] },
  { id: 'b6', name: '山與湖',     icon: 'steps', award: '你爬過山，也繞過湖。',
    ids: ['p6', 'p8', 'p16'] },
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

/* --------------------------------------------------------------------------
   地圖上的景點
   x / y 是相對地圖區域的百分比。刻意只放 10 個 ——
   同時顯示太多就會變成寶可夢那種資訊過載。
   -------------------------------------------------------------------------- */

const SPOTS = [
  { id: 'glass-kiln', name: '水利路的老玻璃窯', art: 'glass', x: 52, y: 44, state: 'today',
    type: '工業遺構', dist: 900,   hook: '這條巷子 1970 年代是全街最亮的地方。' },
  { id: 'market',  name: '東門市場',        art: 'market',  x: 30, y: 30, state: 'seen',
    type: '市場',     dist: 1400,  hook: '收集於 09.05' },
  { id: 'temple',  name: '新竹城隍廟',      art: 'temple',  x: 22, y: 52, state: 'seen',
    type: '廟宇',     dist: 1600,  hook: '收集於 09.19' },
  { id: 'station', name: '新竹車站',        art: 'station', x: 41, y: 66, state: 'seen',
    type: '車站',     dist: 1200,  hook: '收集於 09.02' },
  { id: 'moat',    name: '護城河的舊碼頭階梯', art: 'moat',  x: 66, y: 30, state: 'new',
    type: '水岸',     dist: 1800,  hook: '河道被蓋起來之前，這裡是上下貨的地方。' },
  { id: 'hill',    name: '十八尖山的防空洞', art: 'hill',    x: 72, y: 62, state: 'new',
    type: '山徑',     dist: 3100,  hook: '山壁上還留著十幾個洞口。' },
  { id: 'harbour', name: '南寮漁港',        art: 'harbour', x: 14, y: 16, state: 'seen',
    type: '海岸',     dist: 8200,  hook: '收集於 09.12' },
  { id: 'lake',    name: '青草湖的舊戲院地基', art: 'lake',  x: 58, y: 80, state: 'new',
    type: '遺構',     dist: 6400,  hook: '湖乾涸的那幾年，戲院的地基露了出來。' },
  { id: 'brick',   name: '新竹州廳',        art: 'brick',   x: 36, y: 46, state: 'new',
    type: '古蹟',     dist: 1500,  hook: '1927 年蓋的，現在還在辦公。' },
  { id: 'rail',    name: '竹中站',          art: 'rail',    x: 84, y: 40, state: 'seen',
    type: '車站',     dist: 7800,  hook: '收集於 09.14' },
];

/* 所有「地方」的統一查表。place.html 用 ?id= 開任何一個地方都靠它，
   不然十幾個入口會全部導到同一頁。 */
/* 明信片 id → 真正寫過內容的地點。
   沒有這張表的話，route.html 的「用 yoxi 前往」帶的是 card id（p9），
   findPlace 會掉到 POSTCARDS 的通用展開，把 28 公里的內灣老街
   顯示成 2000 公尺、主按鈕變成「走路前往」——
   整條「走不到所以才叫車」的論證會在評審按下按鈕的那一刻垮掉。 */
const CARD_TO_PLACE = { p11: 'glass-kiln', p9: 'neiwan',
                        p19: 'moat', p20: 'brick', p21: 'hill', p22: 'lake' };

function findPlace(id) {
  if (!id) return TODAY;
  id = CARD_TO_PLACE[id] || id;
  if (id === TODAY.id) return TODAY;
  if (id === FAR_PLACE.id) return FAR_PLACE;

  const byPending = PENDING.filter(function (p) { return p.id === id; })[0];
  if (byPending) return expand(byPending);

  const bySpot = SPOTS.filter(function (p) { return p.id === id; })[0];
  if (bySpot) return expand(bySpot);

  /* 路線的站要排在 POSTCARDS 前面：站上有真的距離（合興 24 km、
     九讚頭 21 km），POSTCARDS 沒有，只會拿到一個假的預設值。 */
  for (let i = 0; i < ROUTES.length; i++) {
    const st = ROUTES[i].stops.filter(function (s) { return s.id === id || s.card === id; })[0];
    if (st) {
      if (CARD_TO_PLACE[st.card]) return findPlace(CARD_TO_PLACE[st.card]);
      return expand({ id: st.card || st.id, name: st.name, art: st.art,
                      type: st.type || '地方', distance: st.dist, hook: st.note });
    }
  }

  const byCard = POSTCARDS.filter(function (p) { return p.id === id; })[0];
  if (byCard) return expand({ id: byCard.id, name: byCard.name, art: byCard.art,
                              type: '地方' });
  return TODAY;
}

/* 地點 id → 明信片 id。獎章的組成清單放的是明信片 id，
   所以任何「這個地方屬於哪一枚獎章」的查詢都要先過這一層。 */
function cardIdOf(placeId) {
  for (const c in CARD_TO_PLACE) if (CARD_TO_PLACE[c] === placeId) return c;
  for (let i = 0; i < ROUTES.length; i++) {
    const st = ROUTES[i].stops.filter(function (s) { return s.id === placeId; })[0];
    if (st && st.card) return st.card;
  }
  return placeId;
}



/* --------------------------------------------------------------------------
   寫好內容的地方

   findPlace() 找不到這裡的 id 時會退回 expand() 的通用版本。通用版本是
   「這裡平常沒什麼人特別停下來」那一段罐頭文案 —— 它存在是為了讓任何 id
   都不會開出空白頁，不是拿來當內容用的。

   評審會連點三、四個地方。只有兩個地方寫得出「窯口還留著熔融過的痕跡，
   像一塊沒擦乾淨的糖」，其餘全是同一段，那就等於當場證明了「AI 生成敘事」
   只做了兩個樣本。所以主線上點得到的地方都要有自己的三段。
   -------------------------------------------------------------------------- */
const WRITTEN = {
  moat: {
    tip: '走到水面那一側再回頭看，階梯的磨損是往河的方向的。',
    hours: '開放空間，白天光線最好',
    story: [
      { label: '現在的它', text: '護城河邊有一段比別處低的石階，最下面兩階常年在水裡。欄杆是後來加的，石頭不是。' },
      { label: '以前的它', text: '這裡曾經是竹塹城的卸貨口。米、鹽、布從船上搬上來，再走進東門。城牆拆了以後碼頭沒人再用，階梯就留在原地。' },
      { label: '為什麼是今天', text: '這個月護城河在清淤，水位比平常低，平常泡在水裡的那兩階這幾天看得到。' },
    ],
    why: [
      { src: '常用地點', text: '你每週經過東門圓環三次，但從沒走下堤岸' },
      { src: '在地活動', text: '護城河清淤到月底，水位比平常低' },
      { src: '常用時段', text: '你通常五點後才出門，那個時間側光最能看出石階的磨損' },
    ],
  },
  hill: {
    tip: '洞口很窄，站在外面看就好。裡面沒有照明。',
    hours: '山徑白天開放，入口在博愛街這一側',
    story: [
      { label: '現在的它', text: '十八尖山的登山道旁有一個被草蓋住的混凝土洞口，寬度剛好一個人側身。旁邊立了一塊字已經看不清楚的牌子。' },
      { label: '以前的它', text: '1943 年新竹是被轟炸最多次的台灣城市之一，因為有機場和煉油設施。這座山上挖了十幾個防空洞，這是還看得到入口的其中一個。' },
      { label: '為什麼是今天', text: '三月到十月草長得比人高，入口會完全被蓋住。現在還找得到。' },
    ],
    why: [
      { src: '常用地點', text: '你這個月走過十八尖山兩次，都是沿著主步道' },
      { src: '收集缺口', text: '你的圖鑑裡還沒有戰爭遺構這一類' },
      { src: '天氣',     text: '今天午後乾燥，山徑不會滑' },
    ],
  },
  lake: {
    tip: '地基在湖的南岸，從環湖步道第二個彎切進去。',
    hours: '戶外空間，全天可看',
    story: [
      { label: '現在的它', text: '青草湖南岸的樹林裡有一整片方形的水泥基座，上面長滿了苔。間距很規律，一看就知道原本站著柱子。' },
      { label: '以前的它', text: '1960 年代青草湖是台灣最紅的蜜月景點，湖邊有旅社、有遊艇、也有一間露天電影院。水庫淤積之後人就不來了，戲院拆掉只剩地基。' },
      { label: '為什麼是今天', text: '週末湖邊有市集，順路可以繞過去。' },
    ],
    why: [
      { src: '在地活動', text: '這個週末青草湖有手作市集，從你家出發的公車直達' },
      { src: '收集缺口', text: '你的水路獎章還差一張' },
      { src: '常用時段', text: '你週末下午通常在外面' },
    ],
  },
  temple: {
    tip: '抬頭看樑上那幾塊被香燻黑的匾，年份都不一樣。',
    hours: '每日 06:00–22:00',
    story: [
      { label: '現在的它', text: '城隍廟的屋頂比周圍的房子高出一截，從三民路那個路口就看得到。廟埕永遠有人在吃東西。' },
      { label: '以前的它', text: '1748 年建的。清代全台只有這一座被封為「都城隍」，位階最高，所以新竹人習慣說「北門街的城隍」而不是「新竹的城隍」。' },
      { label: '為什麼是今天', text: '今天不是初一十五，廟埕人少，看得到地上的石板。' },
    ],
    why: [
      { src: '常用地點', text: '你這個月來過這附近四次，都是為了吃東西' },
      { src: '常用時段', text: '你中午前後常在北門街一帶' },
      { src: '收集缺口', text: '你的舊城區獎章還差一張' },
    ],
  },
  market: {
    tip: '從二樓的樓梯間往下看，攤位的排法是照 1977 年的圖。',
    hours: '一樓 06:00–14:00，二樓全天可上',
    story: [
      { label: '現在的它', text: '東門市場外面看起來是一棟舊大樓，但二樓以上這幾年開了十幾家小店，晚上比白天亮。' },
      { label: '以前的它', text: '1977 年落成時是全台第一座有電扶梯的公有市場，三層樓、四百多個攤位。後來人潮移走，二三樓空了將近三十年。' },
      { label: '為什麼是今天', text: '週三晚上二樓的店幾乎都開，週一週二很多休息。' },
    ],
    why: [
      { src: '常用時段', text: '你晚上七點後常在外面，那是二樓最熱鬧的時間' },
      { src: '常用地點', text: '你搭車經過東門街很多次，但沒有在這裡下過車' },
      { src: '在地活動', text: '這個月二樓有一檔老照片展' },
    ],
  },
  station: {
    tip: '站在前站廣場正對面看山牆，那個弧線是巴洛克式的。',
    hours: '車站大廳全天開放',
    story: [
      { label: '現在的它', text: '新竹車站的正面是石頭和洗石子做的，屋頂有一個陡斜的老虎窗。它不像一座還在用的車站。' },
      { label: '以前的它', text: '1913 年落成，設計者是松崎萬長 —— 一個在德國唸過建築的日本貴族。這是台灣還在營運的車站裡最老的一座，比東京車站還早一年。' },
      { label: '為什麼是今天', text: '傍晚站前的燈亮起來時，山牆的陰影最深。' },
    ],
    why: [
      { src: '常用地點', text: '你每個月經過這裡很多次，但從來沒有從正面看過它' },
      { src: '收集缺口', text: '你的老車站獎章從這裡開始' },
      { src: '天氣',     text: '今天傍晚晴，適合看立面' },
    ],
  },
  harbour: {
    tip: '堤防上有一整排消波塊，站上去可以看到風車。',
    hours: '戶外空間，傍晚風大',
    story: [
      { label: '現在的它', text: '南寮的舊港區現在停的多半是小型漁筏，倉庫改成了店面。堤防外面就是台灣海峽。' },
      { label: '以前的它', text: '這裡曾經是竹塹最重要的出海口，清代的米和樟腦從這裡出去。日治時期港口淤積，重心移到基隆與高雄，南寮就慢慢變回一個漁村。' },
      { label: '為什麼是今天', text: '今天東北季風不強，堤防上站得住人。' },
    ],
    why: [
      { src: '天氣',     text: '今天風速比這個季節的平均低，海邊不會太難受' },
      { src: '收集缺口', text: '你的水路獎章還差一張' },
      { src: '常用時段', text: '你傍晚常出門，那是這裡光線最好的時候' },
    ],
  },
  rail: {
    tip: '月台盡頭的號誌樓還在，門鎖著但窗戶看得進去。',
    hours: '車站全天開放',
    story: [
      { label: '現在的它', text: '竹中站只有一個島式月台，兩邊的軌道往不同方向去。等車的人不多，多半是學生。' },
      { label: '以前的它', text: '內灣線與六家線在這裡分家。六家線是 2011 年為了接高鐵才通車的，內灣線則是 1951 年為了把尖石的木材與水泥原料運下山蓋的。同一個月台，兩個相差六十年的理由。' },
      { label: '為什麼是今天', text: '平日下午班次疏，月台上通常只有你一個人。' },
    ],
    why: [
      { src: '常用地點', text: '你搭車經過竹中很多次，但沒有在這一站下過車' },
      { src: '收集缺口', text: '你的內灣線全線獎章從這裡往下走' },
      { src: '常用時段', text: '你下午的空檔剛好對上班次最疏的時段' },
    ],
  },
  brick: {
    tip: '正面的磚縫看得出兩個年代的差別，下半截比較舊。',
    hours: '外觀全天可看，內部週二至週日開放',
    story: [
      { label: '現在的它', text: '中正路底那棟紅磚建築的正立面上，磚的顏色分成上下兩截。下面偏深，上面偏橘。' },
      { label: '以前的它', text: '1925 年落成的新竹州廳，戰後接著當市政府用到現在，是全台少數沒有斷過使用的日治官署。二戰時被炸過一次，上半截是後來補的，用的是另一批磚。' },
      { label: '為什麼是今天', text: '下午三點以後光線從西邊斜進來，兩種磚色的分界最明顯。' },
    ],
    why: [
      { src: '常用地點', text: '你幾乎每天經過中正路，但從沒抬頭看過這一面牆' },
      { src: '常用時段', text: '你下午三點前後常在附近，那正是看得出磚色分界的時間' },
      { src: '收集缺口', text: '你的圖鑑裡還沒有官署建築這一類' },
    ],
  },
  /* ---- 路線的站。findPlace() 對路線站點用的是明信片 id（p10、p13…），
          所以這一段的 key 是明信片 id，不是地點 id。 ---- */
  p13: {
    tip: '月台盡頭那棵油桐樹下有一張沒人坐的長椅，從那裡看得到整段彎進山裡的軌道。',
    hours: '車站全日開放；平日每小時一班車',
    story: [
      { label: '現在的它', text: '沒有站務員的小站，售票口封起來了，月台邊種著油桐。一天沒幾個人上下車，火車來的時候整個站才醒過來一下。' },
      { label: '以前的它', text: '內灣線中段的集散站。1950 年代山裡的木材與煤在這裡換車，站前曾有一整排貨運行。運輸停了以後，站房縮成現在這一間。' },
      { label: '為什麼是今天', text: '這是內灣線從平地轉進山谷的第一站。今天下午山谷沒有雲，從月台看得到整段彎進山裡的軌道。' },
    ],
    why: [
      { src: '路線進度', text: '你已經走過內灣線的新竹與竹中，這是往山裡的下一站' },
      { src: '天氣',     text: '今天山區降雨機率 5%，谷地看得遠' },
      { src: '收集缺口', text: '你的圖鑑裡還沒有山線的小站' },
    ],
  },
  p12: {
    tip: '站台最北端往河谷看，對岸山壁上的白色是以前水泥廠留下的採石面。',
    hours: '車站全日開放；站前雜貨店到 18:00',
    story: [
      { label: '現在的它', text: '站前只有一間雜貨店和一棵老樟樹。月台很長，比這個站現在需要的長很多 —— 那是以前留下來的。' },
      { label: '以前的它', text: '這裡曾經有水泥廠的專用側線，長月台是為了裝貨車廂留的。廠停了以後側線拆掉，只剩月台的長度還記得那件事。' },
      { label: '為什麼是今天', text: '平日午後這裡幾乎沒有人，是整條線上最安靜的一站。今天下午光線斜進河谷，對岸的採石面看得最清楚。' },
    ],
    why: [
      { src: '路線進度', text: '內灣線六站你已收兩站，這是還沒去的其中一站' },
      { src: '常用時段', text: '你平日下午常在外面，這一站平日下午最安靜' },
      { src: '收集缺口', text: '你的圖鑑裡還沒有產業留下的車站' },
    ],
  },
  p10: {
    tip: '走到站房後面，看得到那段往山坡岔出去的舊軌道 —— 那就是折返線。',
    hours: '車站全日開放；假日市集 10:00–17:00',
    story: [
      { label: '現在的它', text: '木造站房被保留下來，假日有小市集。鐵軌旁有一段往山坡岔出去、然後停住的舊軌道，多數人不知道那是什麼。' },
      { label: '以前的它', text: '這裡是台灣少見的折返式車站：坡度太陡，火車得先開進岔線、再倒退接回主線才爬得上去。現在的列車不需要了，岔線留在原地。' },
      { label: '為什麼是今天', text: '內灣線唯一一站有這種鐵道構造。今天是平日，沒有市集，站房與折返線都看得到全貌。' },
    ],
    why: [
      { src: '路線進度', text: '你已走過內灣線兩站，這是離內灣最近的一站' },
      { src: '在地活動', text: '本週沒有市集，站房全貌看得到' },
      { src: '收集缺口', text: '你的圖鑑裡還沒有木造站房' },
    ],
  },
  p14: {
    tip: '先看建築再看展 —— 二樓走廊的窗框是原本的，玻璃是後來換的。',
    hours: '週二至週日 09:00–17:00，週一休',
    story: [
      { label: '現在的它', text: '新竹公園裡一棟日治時期的洋樓，現在是玻璃工藝博物館。館裡展的是作品，館本身展的是這座城市為什麼會做玻璃。' },
      { label: '以前的它', text: '1936 年蓋的，原本是接待官員與貴賓的會館。戰後幾度改用途，1999 年才變成博物館。' },
      { label: '為什麼是今天', text: '「風城的玻璃」的最後一站。你已經看過窯，這裡把窯燒出來的東西排在一起給你看。' },
    ],
    why: [
      { src: '路線進度', text: '風城的玻璃五站，這是把前面幾站串起來的一站' },
      { src: '在地活動', text: '本月有玻璃工藝特展，到月底' },
      { src: '天氣',     text: '今天下午有雨，適合室內' },
    ],
  },
  p15: {
    tip: '展示區入口那面牆是用回收玻璃砂做的，摸起來不是想像中的光滑。',
    hours: '平日 09:00–17:00；導覽需預約',
    story: [
      { label: '現在的它', text: '一間還在運作的玻璃工廠，收全台灣回收的玻璃瓶，磨成砂、再燒成新的東西。廠區一角開放參觀。' },
      { label: '以前的它', text: '1981 年從回收玻璃起家。新竹曾經有上百家玻璃廠，現在還在燒的沒剩幾家，這是其中一家。' },
      { label: '為什麼是今天', text: '老玻璃窯講的是這座城市怎麼開始做玻璃，這裡講的是它現在怎麼繼續做。今天平日下午有導覽。' },
    ],
    why: [
      { src: '路線進度', text: '風城的玻璃五站，你已收兩站' },
      { src: '在地活動', text: '今天下午 14:00 有一場廠區導覽' },
      { src: '收集缺口', text: '你的圖鑑裡還沒有「還在運作」的工廠' },
    ],
  },
  p16: {
    tip: '傍晚往河床走，退水的沙在低角度的光線下看得出顆粒的亮點。',
    hours: '河岸開放空間，傍晚光線最好',
    story: [
      { label: '現在的它', text: '沒有招牌、沒有遺跡，只有一個地名和一段河床。知道的人會告訴你，這一帶的沙就是新竹玻璃的起點。' },
      { label: '以前的它', text: '玻璃的原料是矽砂。早年新竹的玻璃廠用的矽砂有一部分就從這一帶的河床取，用牛車運進城裡的窯。' },
      { label: '為什麼是今天', text: '「風城的玻璃」從砂開始。你已經看過窯，回頭看砂從哪裡來，這條路線才算走完一圈。' },
    ],
    why: [
      { src: '路線進度', text: '風城的玻璃五站的起點' },
      { src: '常用時段', text: '你傍晚常在外面，那正是河床光線最好的時候' },
      { src: '天氣',     text: '今天傍晚晴，河床沒有積水' },
    ],
  },
  p17: {
    tip: '窯口被封起來了，但封磚的顏色跟旁邊的牆不一樣，找那一塊。',
    hours: '巷弄開放，白天為佳',
    story: [
      { label: '現在的它', text: '水源地旁邊的巷子裡，有一面牆上留著一個被封起來的圓拱。走過的人不會多看一眼，那是一座窯的口。' },
      { label: '以前的它', text: '燒玻璃需要大量的水冷卻。水源地旁邊因此聚過幾座小窯，這是最後一個還看得出形狀的。' },
      { label: '為什麼是今天', text: '它離水利路的老玻璃窯不到三公里，兩座窯是同一個年代的。今天走過去看，可以把兩個地方接起來。' },
    ],
    why: [
      { src: '路線進度', text: '風城的玻璃五站，離你收過的老玻璃窯最近的一站' },
      { src: '常用地點', text: '你這個月有兩趟行程經過水源地' },
      { src: '收集缺口', text: '你的圖鑑裡的窯只有一座' },
    ],
  },
  p18: {
    tip: '退潮時往沙洲走，紅樹林的根露出來的樣子跟漲潮時完全不同。',
    hours: '開放空間；退潮時間每天不同',
    story: [
      { label: '現在的它', text: '頭前溪流進海的地方。沙洲、紅樹林、風力發電機，還有一條自行車道沿著堤防走到底。' },
      { label: '以前的它', text: '這裡曾經是竹塹的渡口之一。河道改道之前，船從這裡進出，把貨送進城。' },
      { label: '為什麼是今天', text: '「水的三種樣子」的最後一站 —— 河、港、湖之後，是河變成海的地方。今天下午退潮，沙洲露得最多。' },
    ],
    why: [
      { src: '路線進度', text: '水的三種樣子四站，你已收三站，這是最後一站' },
      { src: '在地活動', text: '今天 15:40 退潮，沙洲露出最多' },
      { src: '距離判斷', text: '11 公里，這一段搭車比較合理' },
    ],
  },
};

/* 把精簡的地點資料補成 place.html 需要的完整形狀 */
function expand(p) {
  /* 有寫好的內容就用寫好的，沒有才落到通用版本 */
  const w = WRITTEN[p.id] || {};
  p = Object.assign({}, w, p, {
    tip: p.tip || w.tip,
    hours: p.hours || w.hours,
    story: p.story || w.story,
    why: p.why || w.why,
  });
  return {
    id: p.id,
    name: p.name,
    art: p.art,
    type: p.type || '地方',
    /* 沒有距離就別編一個。畫面上會顯示「距離待確認」而不是一個假數字。 */
    distance: p.distance != null ? p.distance : (p.dist != null ? p.dist : null),
    hook: p.hook || '',
    area: p.area || '新竹市',
    eyebrow: p.type || '地方',
    tip: p.tip || '到了先站一下，看看四周有什麼是別的地方沒有的。',
    hours: p.hours || '戶外空間，全天可看',
    story: p.story || [
      { label: '現在的它', text: (p.hook || '') + '這裡平常沒什麼人特別停下來，但走近了會發現它跟周圍不太一樣。' },
      { label: '以前的它', text: '新竹的每一個角落幾乎都有一段跟風、水或工業有關的過去，這裡也是。' },
      { label: '為什麼是今天', text: '今天的天氣與光線適合走過去看看。' },
    ],
    why: p.why || [
      { src: '常用地點', text: '這個地方在你常走的路線附近，但你從沒進去過' },
      { src: '收集缺口', text: '你的圖鑑裡還沒有這一張' },
      { src: '天氣',     text: '今天下午降雨機率低，適合走路' },
    ],
  };
}


/* --------------------------------------------------------------------------
   願景探索稿用的資料（vision-*.html）
   只放 demo 需要的兩三筆。地點一律引用既有的 SPOTS／POSTCARDS id，
   不新增地點，findPlace() 才不會掉進罐頭文案。
   -------------------------------------------------------------------------- */
const FAMILY = [
  { id: 'mom',  name: '媽媽',  relation: '母親', shares: 'cards',  lastCard: 'p7', lastAt: '今天 15:20',
    lastArea: '城隍廟附近', out: true,  watchedBack: true,  routeDone: { rail: 1, glass: 0, water: 2 } },
  { id: 'sis',  name: '小芸',  relation: '妹妹', shares: 'cards',  lastCard: 'p4', lastAt: '昨天',
    lastArea: '南寮',       out: false, watchedBack: true,  routeDone: { rail: 3, glass: 1, water: 1 } },
  { id: 'dad',  name: '爸爸',  relation: '父親', shares: 'status', lastCard: null, lastAt: '三天前',
    lastArea: '家附近',     out: true,  watchedBack: false, routeDone: { rail: 0, glass: 0, water: 0 } },
];

const EVENTS = [
  { id: 'expo', name: '城市博覽會', from: '09.20', to: '10.05', area: '左岸',  art: 'harbour',
    spots: ['harbour', 'moat', 'lake', 'brick'],
    gates: [{ name: '3 號門', why: '離場人少，往市區的車在這裡好媒合', crowd: '低' },
            { name: '1 號門', why: '主入口，散場時排隊', crowd: '高' }],
    note: '結束後這條線會收起來，但你收過的明信片留著。' },
  { id: 'lantern', name: '風城燈節', from: '10.18', to: '10.26', area: '護城河', art: 'moat',
    spots: ['moat', 'market', 'temple'],
    gates: [{ name: '東門圓環', why: '散場往車站方向的人最少', crowd: '中' }],
    note: '燈節只有九天，護城河的明信片沒有期限。' },
];

const PLANS = [
  { id: 'sat', name: '一個下午', members: ['me'],
    legs: [{ placeId: 'moat',  by: 'walk', min: 22, dist: 1800 },
           { placeId: 'brick', by: 'walk', min: 9,  dist: 700 },
           { placeId: 'lake',  by: 'ride', min: 14, dist: 6400 }], fare: 245 },
  { id: 'fam', name: '跟小芸的下午', members: ['me', 'sis'],
    legs: [{ placeId: 'market', by: 'walk', min: 15, dist: 1100, who: 'sis' },
           { placeId: 'moat',   by: 'walk', min: 12, dist: 900,  who: 'me' },
           { placeId: 'harbour',by: 'ride', min: 18, dist: 8200, who: 'sis' }], fare: 310 },
];

const HEALTH = [
  { id: 'chk', kind: '健檢', where: '新竹馬偕', at: '9月25日 星期四 08:30', rideBack: true, elderFleet: true,
    nearby: ['brick', 'moat'] },
  { id: 'rev', kind: '回診', where: '台大新竹分院', at: '10月2日 星期四 14:00', rideBack: true, elderFleet: false,
    nearby: ['market'] },
];

/* 這個月每天的步數。刻意沒有 goal 欄位：健康資料最容易長出目標與達標線。 */
const HEALTH_STEPS = {
  month: [4120, 5310, 2880, 6020, 3450, 7210, 4980, 5600, 3120, 6840, 4410, 5230, 2960, 6120,
          4870, 5540, 3380, 7010, 4690, 5120, 6240, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  avg: 4870,
};

window.MOCK = {
  cardIdOf,
  CARD_TO_PLACE, findPlace, SPOTS, USER, ART, TODAY, PENDING, ROUTES, FAR_PLACE, POSTCARDS, BADGES, LOOKBACK, FOG, CITY_COLORS,
  FAMILY, EVENTS, PLANS, HEALTH, HEALTH_STEPS };
