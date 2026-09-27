/* ==========================================================================
   yoxi 城事 web app — explore 區塊：/unlock/:id 抵達 → 收集 → 翻卡
   契約：app/ARCHITECTURE.md §3、§7、§8。只用 APP.view() 註冊，不改 app.js。
   載入順序：explore-fx.js（APP.fx）→ explore-cards.js（款式規則、收下）→ explore-verse.js（翻開之後的那一句）→ explore.js（頁面零件）→ 這支。

   回答什麼：到了。這一次的明信片是哪一款、為什麼是這一款？收下它。每一次來都收一張（第一次蓋首訪紀念戳），
             同一個地方同一天一張：今天已經收過就直接看今天那一張。
   原型：unlock.html（三幕解鎖的前身）。
   搭 yoxi 抵達是金框。是不是搭車問行程 module（APP.ride.trip.arrivedAt：這個地方、phase done）；網址的 ?ride=1 只是入口的記號，
   手打拿不到金框，少了它也不會把還沒領的限定版當成走路收掉。
     幕一（data-at=1）：夜色地圖上這個地方亮起光柱；點它拉出「收集明信片」面板，面板上先寫好會收到哪一款、為什麼。
     翻卡（data-at=2）：卡背升起 → 蓄力 → 點一下翻開 → 依款式給特效（金框最重）。
     結果（data-at=3）：卡面（節日那一週多一層會動的插畫、首訪與里程各蓋一枚戳）＋畫風名＋跟這個地方、這個時節有關的一句話
       （explore-verse.js；為什麼是這一款只寫在面板與「?」，這裡不再重複）、寫一句話、收進收藏。
       今天已收過、still、減少動態效果（APP.reduceMotion）直接停在結果。收下時司機還在等（來回的行程）就回 /trip，不然回收藏。
   特效工具在 explore-fx.js（APP.fx）；點畫面可以快轉：蓄力中 → 可以翻、翻開中 → 結果。
   鍵盤與報讀器：按下「收集明信片」焦點移到「跳過動畫」（平常看不到，鍵盤焦點才浮出來）；翻完焦點移到「收到 ○○」那一行。
   款式照規則（explore-cards.js 的 cardRule：季節定畫風、搭 yoxi 是金框、節日版、首訪紀念、里程紀念），render 就算得出來，
   不用等 mount、不寫 store；重整、返回都是同一款。
   結果頁不會一直動：金粉飄幾秒就停、光芒與全息掃光有限次；離開這一頁音效（sfx.stopAll）與規則說明一起收掉。
   「回探索」與找不到、返回的保底都回叫車首頁的探索模式（/ride?mode=explore&area=<id>），不回舊的 /explore。
   規則說明收在收集面板與成品右上角的「?」裡（data-act="open-rules"），面板只寫這一次適用的那幾條（結果換成那一句話）。
   刻意沒有：機率、抽籤、「越稀有越華麗」的暗示（蓄力拍數只分金框與其他，四季的畫風一樣重）；
             分享鈕（分享在明信片頁，這一頁只做「收下」一件事）、司機姓名（MOCK 沒有這筆資料，不編）。
   每款翻開的反應（REVEAL）刻意寫成五段程式而不是資料表：停格、震動、粒子、音效的先後各款不同，
   攤成表反而看不出節奏。

   數字一律從 STATE／MOCK／APP.fmt 算；按鈕一律 element.onclick；動作鈕帶 data-act。
   ========================================================================== */

(function () {
'use strict';

const APP = window.APP;
const K = APP && APP.explore && APP.explore._;
/* explore-cards.js 與 explore.js 要先載入（K.notFound 是 explore.js 掛上的）；順序錯了直接丟錯，不要安靜 return */
if (!K || !K.notFound || !APP.explore.verseOf) throw new Error('explore-unlock.js 要在 explore-cards.js、explore-verse.js、explore.js 之後載入（index.html 的順序）');

const esc = APP.esc;
const fmt = APP.fmt;
const E = APP.explore;
const CARD_STYLES = E.CARD_STYLES;
const cardOrigin = E.cardOrigin;
const ruleLines = E.ruleLines;
const cardFace = E.cardFace;
const cardPhoto = E.cardPhoto;
const openRules = E.openRules;
const collect = E.collect;
const canCollect = E.canCollect;
const visitsOf = E.visits;
const M = K.M, collected = K.collected, num = K.num;
const ridePoints = K.ridePoints;
const styleOf = K.styleOf, arrivalAt = K.arrivalAt, today = K.today, marksHTML = K.marksHTML;
const closeRules = K.closeRules;
const exploreHome = K.exploreHome, notFound = K.notFound, backFabBar = K.backFabBar, distHTML = K.distHTML;

/* 收下時寫的一句話最多幾個字：輸入框的 maxlength、提示文字、收下時的截斷都讀這一個 */
const NOTE_MAX = 40;

/* ---------------------------------------------------------------- /unlock/:id */

function cardName(p) {
  const c = (M().POSTCARDS || []).filter(function (x) { return x.id === p.card; })[0];
  return c ? c.name : p.name;
}

/* 點數只給走不到的地方：判斷在 ride.js（APP.ride.limitedPlace），這裡不另寫一份 */
const limitedPlace = APP.ride.limitedPlace;

/* 款式 1–5 就是 CARD_STYLES 的順序；它只決定光色與翻開的反應，不代表「稀有」：
   四季的畫風一樣常見（看你什麼時候去），只有金框（搭 yoxi 才有）多一段昇格。
   | 順序 | 款式     | 蓄力        | 翻開之後                                                        |
   | 1    | 水彩     | 2 拍        | 紙被打濕、從卡片暈成白紙、五團顏料化開（邊上一圈水痕）、甩出水花、水滴聲 |
   | 2    | 油畫     | 2 拍        | 五道厚塗筆觸一筆一筆刷到卡片後面、每筆一聲刷子、筆尾甩出顏料、卡片彈一下 |
   | 3    | 木刻版畫 | 2 拍        | 套印：翻過來是白紙 → 壓紅版（停格 40ms）→ 壓最後一版（停格 70ms、震、木屑、放射刻線、木紋） |
   | 4    | 水墨     | 2 拍        | 墨滴落下、停格 80ms、夜色洗成宣紙、墨暈、圓相                   |
   | 5    | 金框     | 4 拍＋昇格  | 閃光（整次唯一一次）、光芒、轉一圈半、停格 120ms、重震、金粉噴泉，金粉留著慢慢飄 |
   蓄力每一拍換一個光色（白 → 暖橙 → 朱紅 → 墨 → 金）；翻開前停在這一款自己的光色。
   四季的畫風各留一樣東西在結果頁（跳過、減少動態效果也停在同一個樣子，finish() 加 class，CSS 接手）：
   水墨 .is-paper（宣紙＋圓相）、水彩 .is-wash（白紙＋顏料）、油畫 .is-paint（筆觸）、木刻 .is-print（刻線＋木紋）。 */
function tierOf(d) {
  const i = d ? CARD_STYLES.indexOf(d) : -1;
  return i < 0 ? 1 : i + 1;
}
function beatsOf(d) { return d && d.gold ? 4 : 2; }
function auraColor(i) {
  const F = APP.fx;
  if (!F) return [255, 255, 255];
  if (i <= 0) return F.color('--yoxi-white');
  if (i === 1) return F.mix(F.color('--gold'), F.color('--yoxi-red'), .38);
  if (i === 2) return F.color('--yoxi-red');
  if (i === 3) return F.mix(F.color('--yoxi-slate-lite'), F.color('--yoxi-white'), .35);
  return F.color('--gold');
}
const CHARGE_CAPS = ['正在畫下今天的這裡', '讀取今天的天氣與光線', '鎖定畫風', '收筆'];

/* 卡面：疊法跟收藏裡的卡一樣（explore-face.js 的 cardFace）——生成好的成品 → 實景照片（PHOTOS，授權一定要露出）
   ＋畫風的 SVG 濾鏡（explore-fx.js）→ 插圖 */
function faceHTML(p, d) {
  const key = d ? d.key : '';
  const face = cardFace(p.card, key);
  const photo = face.photo;
  const gen = face.gen;
  /* 生成好的成品優先；載不到（data-fallback）就退回「照片＋SVG 濾鏡」的示意，再沒有就是插圖 */
  const base = gen
    ? '<img class="ex-face__img" src="' + esc(gen) + '" alt="" draggable="false"' +
        (photo ? ' data-fallback="' + esc(photo) + '"' : '') + '>'
    : (photo
        ? '<img class="ex-face__img" src="' + esc(photo) + '" alt="" draggable="false">'
        : '<div class="ex-face__img ex-fill" data-art="' + esc(p.art) + '" data-seed="1"></div>');
  return '<div class="ex-face' + (key ? ' ex-face--' + esc(key) : '') + (gen ? ' ex-face--gen' : '') + '">' + base +
      (key === 'watercolor' || key === 'ink'
        ? '<svg class="ex-face__paper" aria-hidden="true" focusable="false"><rect width="100%" height="100%" filter="url(#exf-paper)"/></svg>' : '') +
      (key === 'ink' ? '<span class="ex-face__seal" aria-hidden="true">城事</span>' : '') +
      (key === 'gold' ? '<span class="ex-face__holo" aria-hidden="true"></span>' : '') +
    '</div>';
}
function creditHTML(p) {
  const ph = cardPhoto(p.card);
  if (!ph) return '';
  return '<p class="ex-credit" data-credit>底圖照片 © ' + esc(ph.author || '') + ' · ' + esc(ph.licence || '') +
    ' <a class="ex-credit__a" href="' + esc(ph.source) + '" target="_blank" rel="noopener" data-act="open-credit">出處</a></p>';
}

const SOUND_ICON =
  '<svg class="ex-sound__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor"/>' +
    '<path class="ex-sound__on" d="M15.5 8.8a4.5 4.5 0 0 1 0 6.4M18 6.3a8 8 0 0 1 0 11.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
    '<path class="ex-sound__off" d="M16 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
  '</svg>';

function renderUnlock(params) {
  const p = APP.place(params.id);
  if (!p) {
    return backFabBar(exploreHome()) + notFound({ title: '找不到這個地方', text: '沒有這個地方的明信片。先回探索看看。' });
  }
  /* 搭車還是走路、幾公里、照規則是哪一款：跟收下時（APP.explore.collect）同一個答案 */
  const arr = arrivalAt(p);
  const isRide = !!arr.trip;
  /* got＝今天已經收過這個地方（一天一張）：直接看今天收下的那一張（cardOrigin 的最後一次）；
     沒收過、或以前收過今天還沒：照今天的規則收這一次（arr.v 是第幾次） */
  const got = collected(p) && !canCollect(p.card);
  const origin = got && p.card ? cardOrigin(p.card, visitsOf(p.card).length) : null;
  const style = origin ? origin.style : arr.style;
  const lines = origin ? origin.lines : ruleLines(arr.rule);
  const marks = origin ? origin.marks : marksHTML(arr.rule);
  const v = origin ? origin.v : arr.v;
  /* 金框看款式（搭 yoxi 抵達就是金框）；限定版與 +50 點只給第一次搭 yoxi 去走不到的地方（ride.js 的 limitedPlace） */
  const gold = !got && !!style && !!style.gold;
  const bonus = isRide && limitedPlace(p) && arr.v === 1;
  const name = cardName(p);
  const day = today();
  const km = arr.km;
  const arriveBy = isRide
    ? '搭 yoxi 抵達 · ' + num(km) + ' 公里'
    : (p.dist != null ? '走了 ' + distHTML(p.dist) + ' 抵達' : '走路抵達');
  const tier = tierOf(style);
  const rulesBtn = '<button class="ex-rules-btn" type="button" data-act="open-rules" aria-label="明信片怎麼決定"><span class="ex-rules-btn__i">?</span></button>';
  const why = lines.map(function (t) { return '<span class="ex-why__l">' + esc(t) + '</span>'; }).join('');
  /* 翻開之後卡片底下的那一句（explore-verse.js）：為什麼是這一款已經寫在面板上，這裡換成跟這個地方、這個時節有關的一句話 */
  const verse = E.verseOf(p.card, origin || arr.rule);

  /* ---- 幕一：抵達。夜色地圖上，這個地方亮起來；點它拉出「收集明信片」 ---- */
  const scene1 = got ? '' :
    '<div class="unlock__scene ex-arrive is-on" data-scene="1">' +
      '<div class="ex-arrive__head">' +
        '<span class="ex-arrive__chip"><span data-icon="' + (isRide ? 'hail' : 'steps') + '" class="ex-ic16"></span>' +
          (isRide ? '搭 yoxi 抵達' : '走路抵達') + '</span>' +
          (v > 1 ? '<span class="ex-arrive__chip ex-arrive__chip--again" data-visit-n>第 ' + num(v) + ' 次來</span>' : '') +
        '<h1 class="unlock__title">你到了<br>' + esc(name) + '</h1>' +
        '<p class="unlock__sub">' + arriveBy + '</p>' +
      '</div>' +
      '<div class="ex-spot-wrap">' +
        '<button class="ex-spot" type="button" data-act="open-spot" aria-label="' + esc(name) + '：收集這裡的明信片">' +
          '<span class="ex-spot__beam"></span>' +
          '<span class="ex-spot__ring"></span><span class="ex-spot__ring"></span><span class="ex-spot__ring"></span>' +
          '<span class="ex-spot__halo"></span>' +
          '<span class="ex-spot__pin"><span class="ex-spot__art" data-art="' + esc(p.art) + '" data-seed="1"></span></span>' +
        '</button>' +
      '</div>' +
      '<p class="ex-arrive__hint" data-arrive-hint>點一下發光的地方</p>' +
      '<div class="ex-sheet" data-arrive-sheet hidden>' +
        '<div class="ex-sheet__row">' +
          '<span class="ex-sheet__art" data-art="' + esc(p.art) + '" data-seed="1"></span>' +
          '<span class="ex-sheet__txt">' +
            '<span class="ex-sheet__t">' + esc(name) + '</span>' +
            '<span class="ex-sheet__p ex-why" data-why>' + why + '</span>' +
          '</span>' +
          rulesBtn +
        '</div>' +
        '<button class="btn-primary ex-sheet__go" type="button" data-act="open-card">收集明信片</button>' +
      '</div>' +
    '</div>';

  /* ---- 翻卡舞台的特效層（只放這一款用得到的） ---- */
  const key = style ? style.key : '';
  const stageFx = got ? '' :
    '<div class="ex-stage__fx" aria-hidden="true">' +
      (key === 'gold' ? '<span class="ex-rays"><i></i></span>' : '') +
      '<span class="ex-aura"></span>' +
      (key === 'watercolor' ? '<span class="ex-wet"></span><span class="ex-blots"><i></i><i></i><i></i><i></i><i></i></span>' : '') +
      (key === 'oil' ? '<span class="ex-strokes"><i></i><i></i><i></i><i></i><i></i></span>' : '') +
      (key === 'woodcut' ? '<span class="ex-gouge"></span>' : '') +
      (key === 'ink'
        ? '<svg class="ex-enso" viewBox="0 0 200 200" focusable="false"><path d="M142 37 A74 74 0 1 0 172 86" pathLength="1"/></svg><span class="ex-drop"></span>'
        : '') +
    '</div>';

  /* 翻完焦點移到這裡（tabindex=-1），報讀器念一次「收到 ○○」和那一句話 */
  const label = style
    ? '<p class="ex-unlock__style" data-result-style="' + esc(style.key) + '" tabindex="-1">' +
        (got ? '' : '<span class="ex-sr">收到</span>') +
        '<b class="ex-unlock__sname">' + esc(style.name) + '</b>' +
        (verse
          ? '<span class="ex-verse" data-verse>' +
              '<span class="ex-verse__t">' + esc(verse.text) + '</span>' +
              (verse.by ? '<span class="ex-verse__by">' + esc(verse.by) + (verse.title ? '〈' + esc(verse.title) + '〉' : '') + '</span>' : '') +
            '</span>'
          : '') +
      '</p>'
    : '';

  const act3Acts = got
    ? '<p class="ex-unlock__have" data-today-got>今天已經收下這一張，明天再來會再收一張</p>' +
      '<div class="ex-unlock__acts">' +
        (p.card ? '<a class="btn-primary ex-unlock__btn" href="#/postcard/' + esc(p.card) + (v > 1 ? '?v=' + v : '') + '" data-act="open-postcard">看這張明信片</a>' : '') +
        '<a class="btn-link ex-center ex-unlock__link" href="#' + esc(exploreHome(p.id)) + '" data-act="go-explore">回探索</a>' +
      '</div>'
    : (isRide
        ? '<div class="ex-unlock__gold" data-gold-note>' +
            '<span class="ex-unlock__goldrow"><span data-icon="badge" class="ex-ic16"></span>司機同行紀念 · 這一段是 yoxi 陪你到的</span>' +
            (bonus ? '<span class="ex-unlock__goldrow" data-points>和泰 Points ' + num('+' + ridePoints()) + '</span>' : '') +
          '</div>'
        : '') +
      '<div class="ex-unlock__in">' +
        '<input class="ex-unlock__input" data-one-line maxlength="' + NOTE_MAX + '" placeholder="寫一句話（選填，最多 ' + NOTE_MAX + ' 字）" aria-label="寫一句話">' +
      '</div>' +
      '<div class="ex-unlock__acts">' +
        '<button class="btn-primary ex-unlock__btn" type="button" data-act="collect">收進收藏</button>' +
      '</div>';

  const mute = !!APP.store.get('fxMute');

  return '<div class="unlock ex-unlock" data-unlock data-at="' + (got ? '3' : '1') + '" data-visit="' + v + '"' + (isRide ? ' data-ride' : '') +
      (style ? ' data-style="' + esc(style.key) + '" data-tier="' + tier + '"' : '') + '>' +
      (got ? '' : '<div class="ex-unlock__map" data-arrive-map aria-hidden="true"></div>' +
                  (key === 'ink' || key === 'watercolor' ? '<div class="ex-paper" aria-hidden="true"><svg class="ex-face__paper" focusable="false"><rect width="100%" height="100%" filter="url(#exf-paper)"/></svg></div>' : '') +
                  (key === 'woodcut' ? '<div class="ex-grain" aria-hidden="true"><svg class="ex-grain__svg" focusable="false"><rect width="100%" height="100%" filter="url(#exf-grain)"/></svg></div>' : '') +
                  '<canvas class="ex-fx ex-fx--back" data-fx-back aria-hidden="true"></canvas>') +
      scene1 +
      '<div class="unlock__scene ex-stage' + (got ? ' is-on' : '') + '" data-scene="3">' +
        '<div class="ex-stage__shake" data-shake>' +
          '<div class="ex-unlock__card" data-card-box>' +
            stageFx +
            '<div class="ex-flip" data-flip>' +
              (got ? '' :
                '<div class="ex-flip__back" aria-hidden="true">' +
                  '<span class="ex-back__dot"></span><span class="ex-back__mark">yoxi</span><span class="ex-back__sub">城事</span>' +
                '</div>') +
              '<div class="postcard ex-flip__front' + (gold ? ' postcard--gold' : '') + '" data-final-card' +
                  (style ? ' data-style="' + esc(style.key) + '"' : '') + '>' +
                (gold ? '<span class="postcard__ribbon" data-ribbon-new>' + (v > 1 ? 'yoxi 金框' : 'yoxi 限定版') + '</span>' : '') +
                faceHTML(p, style) +
                '<span class="ai-mark">AI 生成示意</span>' +
                marks +
                '<span class="postcard__foot">' +
                  '<span class="postcard__name">' + esc(name) + '</span>' +
                  '<span class="postcard__date">' + esc(origin ? origin.dateText : day.getFullYear() + '.' + fmt.todayMMDD(day)) + ' · ' + esc(p.area || '新竹市') + '</span>' +
                '</span>' +
              '</div>' +
            '</div>' +
            rulesBtn +
          '</div>' +
          /* 蓄力的說明字每拍換一次，不放 aria-live（報讀器會被每 0.5 秒打斷一次）；鍵盤與報讀器走「跳過動畫」 */
          (got ? '' : '<p class="ex-stage__cap" data-stage-cap>' + CHARGE_CAPS[0] + '</p>') +
        '</div>' +
        '<div class="ex-result" data-result>' +
          label +
          creditHTML(p) +
          act3Acts +
        '</div>' +
      '</div>' +
      (got ? '' :
        '<canvas class="ex-fx ex-fx--front" data-fx aria-hidden="true"></canvas>' +
        '<div class="ex-flash" data-flash aria-hidden="true"></div>' +
        /* 點畫面快轉只有滑鼠與觸控按得到：鍵盤與報讀器在翻卡時焦點停在這顆（平常看不到，鍵盤焦點才浮出來） */
        '<button class="ex-skip" type="button" data-act="skip-reveal" hidden>跳過動畫，直接看結果</button>' +
        '<button class="ex-sound" type="button" data-act="toggle-sound" aria-pressed="' + (mute ? 'false' : 'true') + '" aria-label="音效">' +
          SOUND_ICON + '</button>') +
    '</div>';
}

function sceneMs() {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--t-scene').trim();
    const n = parseFloat(v);
    if (!isNaN(n)) return /ms$/.test(v) ? n : n * 1000;
  } catch (e) { /* ignore */ }
  return 1200;
}

/* 抵達畫面的底圖：以這個地方為中心的真實地圖，壓成夜色；地點落在發光點的位置（高度 SPOT_Y） */
const SPOT_Y = .42;
const ARRIVE_SPAN_M = 1400;
function mountArriveMap(host, p) {
  const geo = window.HSINCHU_PLACES && HSINCHU_PLACES[p.id];
  if (!host || !geo || !window.HSMAP || !APP.map) return null;
  try {
    const W = host.clientWidth || 390, H = host.clientHeight || 844;
    const southM = (.5 - SPOT_Y) * H * (ARRIVE_SPAN_M / W);
    return APP.map.mount(host, { style: 'paper', center: HSMAP.toLL(geo.x, geo.y + southM), spanM: ARRIVE_SPAN_M, spots: false });
  } catch (e) {
    console.error('arrive map', e);
    return null;
  }
}

/* 油畫的筆觸一筆接一筆，間隔幾毫秒（跟著 --t-scene 縮放）：CSS 的延遲（--d）、刷子聲、筆尾的顏料都讀這一個 */
const STROKE_GAP = 120;

/* 金框結果頁的金粉飄多久（毫秒，跟著 --t-scene 縮放）：之後停下來，頁面回到靜止，不再每秒 60 幀耗電 */
const DUST_MS = 5600;

function mountUnlock(root, params) {
  const p = APP.place(params.id);
  if (!p) { APP.ui.setStatus('dark'); return; }
  const F = APP.fx;
  const isRide = !!APP.ride.trip.arrivedAt(p.id);
  const got = collected(p) && !canCollect(p.card);      /* 跟 render 同一個判斷：今天已經收過 */
  const box = root.querySelector('[data-unlock]');
  const style = styleOf(box.getAttribute('data-style'));
  const tier = Number(box.getAttribute('data-tier')) || 1;
  const u = sceneMs() / 1200;                    /* 全部時間跟著 --t-scene 縮放 */
  const timers = [];
  const later = function (fn, ms) { const id = setTimeout(fn, Math.round(ms * u)); timers.push(id); return id; };
  let map = null, back = null, front = null, shake = null, motes = null, dust = null, run = null;
  let glow = 0, sheetOpen = false, collecting = false;
  if (F) F.filters();

  const q = function (s) { return box.querySelector(s); };
  /* 生成的成品載不到：換回照片＋SVG 濾鏡的示意 */
  box.querySelectorAll('img[data-fallback]').forEach(function (img) {
    const useFallback = function () {
      img.onerror = null;
      img.src = img.getAttribute('data-fallback');
      img.removeAttribute('data-fallback');
      const face = img.closest('.ex-face');
      if (face) face.classList.remove('ex-face--gen');
    };
    img.onerror = useFallback;
    if (img.complete && !img.naturalWidth) useFallback();
  });
  const cardBox = q('[data-card-box]');
  const flip = q('[data-flip]');
  const cap = q('[data-stage-cap]');
  const skipBtn = q('[data-act="skip-reveal"]');
  const noteInput = q('[data-one-line]');
  const focusEl = function (el) {
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  };
  const stopDust = function () { if (dust) { dust.stop(); dust = null; } };
  const engs = {
    set speed(v) { if (back) back.speed = v; if (front) front.speed = v; },
    get speed() { return front ? front.speed : 1; },
  };

  const setAt = function (n) {
    box.setAttribute('data-at', String(n));
    box.querySelectorAll('.unlock__scene').forEach(function (s) {
      s.classList.toggle('is-on', s.getAttribute('data-scene') === (n === 1 ? '1' : '3'));
    });
  };

  /* 結果：不論是跑完、被點掉、還是 still，最後都停在同一個 class 狀態（WAAPI 的動畫全部拿掉，交給 CSS）。
     quiet＝一進來就是結果（已收過、still、減少動態效果）：不搶焦點、不飄金粉。
     不是 quiet（剛翻完）：焦點移到「收到 ○○」那一行，報讀器念一次收到什麼、為什麼；「跳過動畫」收起來 */
  const finish = function (quiet) {
    if (run) run.dead = true;
    timers.forEach(clearTimeout);
    timers.length = 0;
    glow = 0;
    if (motes) { motes.stop(); motes = null; }
    box.classList.remove('is-revealing', 'is-ready', 'is-sheet');
    box.classList.add('is-done');
    if (flip) flip.classList.add('is-front');
    setAt(3);
    if (run) run.anims.forEach(function (a) { try { a.cancel(); } catch (e) { /* ignore */ } });
    if (shake) shake.stop();
    if (style && !got && F) box.style.setProperty('--aura', 'rgb(' + auraColor(tier - 1).join(' ') + ')');
    /* 每款留下來的樣子（跳過、減少動態效果也停在這裡）：水墨洗成宣紙、水彩暈成白紙、油畫的筆觸、木刻的刻線與木紋 */
    const end = style && !got ? ({ ink: 'is-paper', watercolor: 'is-wash', oil: 'is-paint', woodcut: 'is-print' })[style.key] : '';
    if (end) box.classList.add(end);
    if (end === 'is-paper' || end === 'is-wash') APP.ui.setStatus('dark');
    /* 木刻翻到一半被跳過：卡面還停在白紙或紅版，換回印好的樣子 */
    box.querySelectorAll('[data-print]').forEach(function (el) { el.removeAttribute('data-print'); });
    if (style && style.gold && !got) box.classList.add('is-gold-up');
    /* 翻開以後才標：金框的邊開始散金粉（explore-gold.js），跟收藏裡看到它時一樣；翻開前標會先洩底 */
    const finalCard = q('[data-final-card].postcard--gold');
    if (finalCard) finalCard.setAttribute('data-gold-aura', '');
    /* 節日版的插畫：翻開時已經開始動就不重來（跳過、已收過的直接在這裡開始；減少動態效果時 festPlay 不動） */
    if (E.festPlay) E.festPlay(box, { restart: false });
    if (skipBtn) skipBtn.hidden = true;
    if (!quiet) focusEl(q('[data-result-style]') || q('[data-act="collect"]'));
    /* 金框的金粉留著慢慢飄（「剛剛發生過」要看得見），DUST_MS 之後、或開始寫那一句話時停下來；其他款式安靜收尾 */
    if (!quiet && front && style && style.gold && !F.calm() && !dust) {
      const gc = [F.color('--gold'), F.color('--gold-lite')];
      const W0 = front.at(box).W;
      dust = front.stream({
        rate: 11,
        one: function () {
          return { x: F.rnd(0, W0), y: -8, vx: F.rnd(-12, 12), vy: F.rnd(34, 80), life: [3.2, 5.2],
                   size: [1, 2.6], kinds: ['star', 'glow'], colors: gc, tw: [4, 9], alpha: [.35, .85], fin: .1, fout: .45 };
        },
      });
      later(stopDust, DUST_MS);
    }
  };
  if (noteInput) noteInput.onfocus = stopDust;

  /* 已收過、still、減少動態效果（APP.reduceMotion）：直接停在結果，不演抵達與翻卡 */
  if (got || APP.reduceMotion() || !F) {
    finish(true);
  } else {
    setAt(1);
    map = mountArriveMap(q('[data-arrive-map]'), p);
    back = F.engine(q('[data-fx-back]'));
    front = F.engine(q('[data-fx]'));
    shake = F.shaker(q('[data-shake]'));
    /* 先讓瀏覽器算一次「還沒亮」的樣式，再加 is-lit，上色的 transition 才有起點（不用 rAF：畫面外會被停掉） */
    void box.offsetWidth;
    box.classList.add('is-lit');
    /* 亮起來的那一刻：一小圈光點、鐘聲，之後光點慢慢從地上升起。
       翻卡已經開始（在它之前就按了「收集明信片」）就不演：play() 會清掉這個計時器，這裡再擋一次 */
    glow = later(function () {
      glow = 0;
      const spot = q('.ex-spot__pin');
      if (run || !spot || F.calm()) return;
      const lit = isRide ? [F.color('--gold'), F.color('--gold-lite')] : [F.color('--yoxi-cream'), F.color('--yoxi-white')];
      const at = front.at(spot);
      F.sfx.arrive(isRide);
      front.burst({ x: at.x, y: at.y, n: 22, speed: [50, 170], life: [.6, 1.2], size: [1.4, 3.2], kinds: ['glow', 'star'], colors: lit, drag: 2.4, tw: [8, 14] });
      front.ring({ x: at.x, y: at.y, size: 26, grow: 4.5, life: .9, colors: [lit[0]], lw: 2.5 });
      motes = front.stream({
        rate: 7,
        one: function () {
          const s = front.at(spot);
          return { x: s.x + F.rnd(-26, 26), y: s.y + F.rnd(-6, 10), vx: F.rnd(-6, 6), vy: F.rnd(-70, -28),
                   life: [1.6, 2.8], size: [1, 2.8], kinds: ['glow', 'star'], colors: lit, tw: [5, 10], alpha: [.5, 1] };
        },
      });
    }, 420);
  }

  /* ---- 幕一：點發光的地方 → 收集面板 ---- */
  const openSheet = function () {
    if (sheetOpen || box.getAttribute('data-at') !== '1') return;
    sheetOpen = true;
    const sheet = q('[data-arrive-sheet]');
    if (!sheet) return;
    if (F) F.sfx.tap();
    sheet.hidden = false;
    box.classList.add('is-sheet');
    if (sheet.animate && F && !F.calm()) {
      sheet.animate([{ transform: 'translateY(105%)' }, { transform: 'none' }], { duration: 420, easing: F.ease.out });
      const spot = q('.ex-spot');
      if (spot) spot.animate([{ transform: 'scale(1)' }, { transform: 'scale(.9)', offset: .3 }, { transform: 'scale(1)' }],
        { duration: 420, easing: F.ease.back });
    }
    focusEl(q('[data-act="open-card"]'));
  };
  const spotBtn = q('[data-act="open-spot"]');
  if (spotBtn) spotBtn.onclick = function (e) { if (e) e.stopPropagation(); openSheet(); };

  box.querySelectorAll('[data-act="open-rules"]').forEach(function (b) {
    b.onclick = function (e) { if (e) e.stopPropagation(); openRules(); };
  });
  const credit = q('[data-act="open-credit"]');
  if (credit) credit.onclick = function (e) { if (e) e.stopPropagation(); };

  const snd = q('[data-act="toggle-sound"]');
  if (snd) snd.onclick = function (e) {
    if (e) e.stopPropagation();
    const mute = !APP.store.get('fxMute');
    APP.store.set('fxMute', mute);
    snd.setAttribute('aria-pressed', mute ? 'false' : 'true');
    /* 關掉就是現在安靜：已經排好、還沒響完的（金框的鐘聲會拖三秒）一起切掉 */
    if (F && F.sfx.stopAll && mute) F.sfx.stopAll();
    if (!mute && F) F.sfx.tap();
    APP.ui.toast(mute ? '音效關了' : '音效開了');
  };

  /* 點畫面：幕一打開面板；翻卡中蓄力 → 快轉到可以翻、可以翻 → 翻開、翻開中 → 直接看結果 */
  box.onclick = function (e) {
    if (e && e.target && e.target.closest && e.target.closest('button, a, input')) return;
    const at = box.getAttribute('data-at');
    if (at === '1') { openSheet(); return; }
    if (at !== '2' || !run) return;
    if (run.phase === 'charge' || run.phase === 'summon') run.fast = true;
    else if (run.phase === 'ready' && run.tap) run.tap();
    else if (run.phase === 'reveal') finish();
  };

  /* ---- 翻卡 ---- */
  function play() {
    const R = run = { dead: false, fast: false, anims: [], phase: 'summon', tap: null };
    const alive = function () { return !R.dead; };
    const W = function (ms) { return new Promise(function (res) { later(res, ms); }); };
    /* 動畫只管畫面；流程用計時器接（不等 animation.finished）：
       畫面外的 iframe、背景分頁會把動畫時鐘停掉，等 finished 就會整段卡住 */
    const A = function (el, kf, o) {
      const dur = (o.duration || 300) + (o.delay || 0);
      if (R.dead) return Promise.resolve();
      if (el && el.animate) {
        R.anims.push(el.animate(kf, Object.assign({ fill: 'forwards' }, o,
          { duration: Math.round((o.duration || 300) * u), delay: Math.round((o.delay || 0) * u) })));
      }
      return W(dur);
    };
    const aura = q('.ex-aura');
    const setAura = function (i) {
      box.style.setProperty('--aura', 'rgb(' + auraColor(i).join(' ') + ')');
    };
    const white = F.color('--yoxi-white'), gold = F.color('--gold'), goldLite = F.color('--gold-lite');
    const red = F.color('--yoxi-red'), cream = F.color('--yoxi-cream'), navy = F.color('--yoxi-navy');
    const slateLite = F.color('--yoxi-slate-lite'), creamDeep = F.color('--yoxi-cream-deep');

    /* 蓄力的一拍：光往卡片吸、光暈脹一下、卡片抖（越後面抖越大） */
    const beat = function (i) {
      const c = auraColor(i);
      setAura(i);
      F.sfx.charge(i);
      const at = front.at(cardBox);
      front.converge({ x: at.x, y: at.y, n: 14 + i * 10, radius: [150, 280], life: [.42, .66], size: [.9, 2.2],
                       kinds: ['spark', 'glow'], colors: [c, white], len: .06 });
      A(aura, [{ opacity: .3 + i * .1, transform: 'scale(.86)' },
               { opacity: .8, transform: 'scale(' + (1.08 + i * .05) + ')', offset: .35 },
               { opacity: .5 + i * .1, transform: 'scale(1)' }], { duration: 520, easing: F.ease.out });
      const a = 1 + i * .9;
      A(flip, [{ transform: 'none' }, { transform: 'translateX(' + (-a) + 'px) rotate(' + (-a * .4) + 'deg)' },
               { transform: 'translateX(' + a + 'px) rotate(' + (a * .4) + 'deg)' }, { transform: 'translateX(' + (-a * .5) + 'px)' },
               { transform: 'none' }], { duration: 240, easing: F.ease.inOut });
      if (cap) cap.textContent = CHARGE_CAPS[Math.min(i, CHARGE_CAPS.length - 1)];
      return W(560);
    };

    /* 金框的昇格：光收進去 → 停格 → 閃白、轉金、光芒展開 */
    const upgrade = function () {
      if (cap) cap.textContent = '';
      A(aura, [{ transform: 'scale(1)', opacity: .9 }, { transform: 'scale(.55)', opacity: 1 }], { duration: 380, easing: F.ease.in });
      return A(flip, [{ transform: 'none' }, { transform: 'scale(.93)' }], { duration: 380, easing: F.ease.in })
        .then(function () { return alive() ? F.hitstop(box, engs, 140) : null; })
        .then(function () {
          if (!alive()) return null;
          F.sfx.upgrade();
          F.flash(q('[data-flash]'), white);
          setAura(4);
          box.classList.add('is-gold-up');
          shake.add(.45);
          const at = front.at(cardBox);
          back.burst({ x: at.x, y: at.y, n: 64, r0: [at.w * .4, at.w * .6], speed: [200, 560], life: [.45, 1], size: [1, 2.6],
                       kinds: ['spark'], colors: [gold, goldLite, white], drag: 2.4, len: .05 });
          front.ring({ x: at.x, y: at.y, size: 40, grow: 7, life: .7, colors: [goldLite], lw: 3 });
          A(aura, [{ transform: 'scale(.55)', opacity: 1 }, { transform: 'scale(1.18)', opacity: 1 }], { duration: 520, easing: F.ease.out });
          return A(flip, [{ transform: 'scale(.93)' }, { transform: 'scale(1.06)', offset: .4 }, { transform: 'none' }],
                   { duration: 560, easing: F.ease.elastic });
        })
        .then(function () { return alive() ? W(260) : null; });
    };

    /* 翻開：每一款各自的反應（earned juice：金框是搭 yoxi 才有的，最重；四季的畫風各有各的味道） */
    const PRE = 'translateY(6px) scale(.92)';
    const REVEAL = {
      /* 水彩：紙被打濕，從卡片往外暈成白紙；顏料一團一團化開（邊上積一圈水痕），甩出幾點水花 */
      watercolor: function (at) {
        const done = A(flip, [{ transform: PRE + ' rotateY(0deg)' }, { transform: 'translateY(0) scale(1.03) rotateY(180deg)', offset: .75 },
                              { transform: 'translateY(0) scale(1) rotateY(180deg)' }], { duration: 620, easing: F.ease.out });
        return W(200).then(function () {
          if (!alive()) return null;
          /* 暈開交給 CSS（.is-wash 的 transition）：跳過、減少動態效果都停在同一個樣子 */
          box.classList.add('is-wash');
          APP.ui.setStatus('dark');
          F.sfx.drip();
          F.sfx.reveal(1);
          later(F.sfx.drip, 300);
          later(F.sfx.drip, 640);
          const c = front.at(cardBox);
          const pigment = [F.mix(red, white, .55), F.mix(F.color('--yoxi-slate'), white, .25), F.mix(gold, white, .35), creamDeep];
          front.burst({ x: c.x, y: c.y, n: 28, r0: [c.h * .55, c.h * .72], speed: [110, 300], life: [.8, 1.3], size: [1.8, 4.6],
                        kinds: ['soft'], colors: pigment, g: 460, drag: 1.4, blend: 'source-over', alpha: [.75, 1], fout: .35 });
          return done;
        });
      },
      /* 油畫：五道厚塗的筆觸一筆一筆刷到卡片後面（留著當背景），每一筆一聲刷子、筆尾甩出顏料；刷完卡片彈一下 */
      oil: function (at) {
        const done = A(flip, [{ transform: PRE + ' rotateY(0deg)' }, { transform: 'translateY(0) scale(1.07) rotateY(180deg)', offset: .7 },
                              { transform: 'translateY(0) scale(1) rotateY(180deg)' }], { duration: 520, easing: F.ease.back });
        const strokes = box.querySelectorAll('.ex-strokes i');
        return W(120).then(function () {
          if (!alive()) return null;
          F.sfx.reveal(2);
          const c = front.at(cardBox);
          const k = c.w / (cardBox.offsetWidth || c.w) || 1;
          const paint = [red, F.mix(red, gold, .5), gold, creamDeep];
          strokes.forEach(function (el, i) {
            el.style.setProperty('--d', Math.round(i * STROKE_GAP * u) + 'ms');
            later(function () {
              if (!alive()) return;
              F.sfx.brush(i);
              /* 筆尾：筆觸從左端（transform-origin）往右刷，尾巴在 --x/--y 平移後、沿 --a 走 --w 的地方 */
              const cs = getComputedStyle(el);
              const w = parseFloat(cs.getPropertyValue('--w')) || 0;
              const a = (parseFloat(cs.getPropertyValue('--a')) || 0) * Math.PI / 180;
              const x0 = c.x + (parseFloat(cs.getPropertyValue('--x')) - w / 2) * k;
              const y0 = c.y + parseFloat(cs.getPropertyValue('--y')) * k;
              back.burst({ x: x0 + Math.cos(a) * w * k * .92, y: y0 + Math.sin(a) * w * k * .92, n: 7, speed: [80, 240],
                           angle: [a - .6, a + .6], life: [.5, .9], size: [2.5, 6], kinds: ['soft'], colors: paint,
                           g: 620, drag: 1.6, blend: 'source-over', alpha: [.85, 1], fout: .3 });
            }, i * STROKE_GAP + 160);
          });
          box.classList.add('is-paint');
          return done;
        }).then(function () { return alive() ? W(strokes.length * STROKE_GAP - 200) : null; })
          .then(function () {
            if (!alive()) return null;
            return A(flip, [{ transform: 'translateY(0) scale(1) rotateY(180deg)' }, { transform: 'translateY(0) scale(1.05, .95) rotateY(180deg)', offset: .25 },
                            { transform: 'translateY(0) scale(1) rotateY(180deg)' }], { duration: 520, easing: F.ease.elastic });
          });
      },
      /* 木刻版畫（套印）：翻過來先是一張白紙 → 壓第一版（紅）→ 再舉起來壓最後一版（整張印好）。
         每壓一下停格、震、木屑往上噴；最後一版背後爆出一圈刻線，夜色浮出木紋（都留著） */
      woodcut: function (at) {
        const face = q('[data-final-card] .ex-face');
        if (face) face.setAttribute('data-print', '0');
        const UP = 'translateY(-14px) scale(1.12) rotateY(180deg)';
        const DOWN = 'translateY(0) scale(1) rotateY(180deg)';
        const chips = [cream, creamDeep, F.mix(creamDeep, gold, .4)];
        const stamp = function (last) {
          return A(flip, [{ transform: UP }, { transform: DOWN }], { duration: 130, easing: F.ease.heavy })
            .then(function () {
              if (!alive()) return null;
              if (face) { if (last) face.removeAttribute('data-print'); else face.setAttribute('data-print', '1'); }
              F.sfx.press(last);
              if (last) F.sfx.reveal(3);
              return F.hitstop(box, engs, last ? 70 : 40);
            })
            .then(function () {
              if (!alive()) return null;
              shake.add(last ? .5 : .24);
              const c = front.at(cardBox);
              front.burst({ x: c.x, y: c.y + c.h * .42, n: last ? 30 : 12, speed: [last ? 180 : 120, last ? 470 : 300],
                            angle: [-Math.PI * .97, -Math.PI * .03], life: [.7, 1.2], size: [last ? 4 : 3, last ? 10 : 7],
                            kinds: ['shard'], colors: last ? chips.concat([red]) : chips, g: 1100, drag: 1, spin: [5, 14],
                            blend: 'source-over', fout: .3 });
              back.burst({ x: c.x, y: c.y + c.h * .48, n: last ? 12 : 6, speed: [30, 110], angle: [-Math.PI, 0], life: [.8, 1.4],
                           size: [8, 16], grow: 2.2, kinds: ['soft'], colors: [cream], alpha: [.12, .26], blend: 'source-over' });
              if (last) {
                box.classList.add('is-print');
                front.ring({ x: c.x, y: c.y, size: c.w * .55, grow: 2.6, life: .6, colors: [cream], lw: 5 });
              }
              return A(flip, [{ transform: 'translateY(0) scale(1.04, .95) rotateY(180deg)' }, { transform: DOWN }],
                       { duration: last ? 360 : 240, easing: F.ease.back });
            });
        };
        return A(flip, [{ transform: PRE + ' rotateY(0deg)' }, { transform: UP }], { duration: 380, easing: F.ease.out })
          .then(function () { return alive() ? W(90) : null; })
          .then(function () { return alive() ? stamp(false) : null; })
          .then(function () { return alive() ? A(flip, [{ transform: DOWN }, { transform: UP }], { duration: 230, easing: F.ease.out }) : null; })
          .then(function () { return alive() ? W(60) : null; })
          .then(function () { return alive() ? stamp(true) : null; });
      },
      ink: function (at) {
        const drop = q('.ex-drop');
        return A(drop, [{ transform: 'translate(-50%, -50%) translateY(-260px) scale(.6, 1.5)', opacity: 0 },
                        { transform: 'translate(-50%, -50%) translateY(-70px) scale(.7, 1.3)', opacity: 1, offset: .6 },
                        { transform: 'translate(-50%, -50%) translateY(0) scale(1.2, .7)', opacity: 1 }],
                 { duration: 440, easing: F.ease.heavy })
          .then(function () {
            if (!alive()) return null;
            F.sfx.plip();
            A(drop, [{ transform: 'translate(-50%, -50%) scale(1.2, .7)', opacity: 1 }, { transform: 'translate(-50%, -50%) scale(3.2, .2)', opacity: 0 }],
              { duration: 260, easing: F.ease.out });
            return F.hitstop(box, engs, 80);
          })
          .then(function () {
            if (!alive()) return null;
            /* 夜色洗成宣紙：墨在紙上才看得見 */
            box.classList.add('is-paper');
            APP.ui.setStatus('dark');
            F.sfx.reveal(4);
            shake.add(.3);
            const c = back.at(cardBox);
            const ink = [navy, F.mix(navy, slateLite, .35)];
            back.burst({ x: c.x, y: c.y, n: 26, speed: [24, 96], life: [1.6, 2.6], size: [10, 22], grow: [2.5, 4],
                         kinds: ['soft'], colors: ink, drag: 1.2, alpha: [.18, .42], blend: 'source-over', fin: .05, fout: .6 });
            back.burst({ x: c.x, y: c.y - c.h * .5, n: 16, speed: [220, 460], angle: [-Math.PI * .92, -Math.PI * .08], life: [.5, .9],
                         size: [1.5, 4], kinds: ['soft'], colors: [navy], g: 700, drag: .6, blend: 'source-over', alpha: [.6, .9] });
            back.ring({ x: c.x, y: c.y, size: c.w * .5, grow: 2.6, life: 1.2, colors: [navy], lw: 1.6 });
            back.ring({ x: c.x, y: c.y, size: c.w * .5, grow: 3.4, life: 1.6, colors: [navy], lw: 1.2 });
            const enso = q('.ex-enso path');
            A(q('.ex-enso'), [{ opacity: 0, transform: 'translate(-50%, -53%) rotate(-30deg) scale(.9)' },
                              { opacity: .8, transform: 'translate(-50%, -53%) rotate(0deg) scale(1)' }], { duration: 1100, easing: F.ease.out });
            A(enso, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1100, delay: 80, easing: F.ease.out });
            return A(flip, [{ transform: PRE + ' rotateY(0deg)' }, { transform: 'translateY(0) scale(1.04) rotateY(180deg)', offset: .7 },
                            { transform: 'translateY(0) scale(1) rotateY(180deg)' }], { duration: 640, easing: F.ease.out });
          });
      },
      gold: function (at) {
        const spin = A(flip, [{ transform: PRE + ' rotateY(0deg)' },
                              { transform: 'translateY(0) scale(1.22) rotateY(420deg)', offset: .62 },
                              { transform: 'translateY(0) scale(1.14) rotateY(540deg)' }], { duration: 980, easing: F.ease.out });
        return W(560).then(function () {
          if (!alive()) return null;
          F.sfx.thud(true);
          F.sfx.reveal(5);
          return F.hitstop(box, engs, 120);
        }).then(function () {
          if (!alive()) return null;
          shake.add(.62);
          const c = front.at(cardBox);
          const gc = [gold, goldLite, white];
          front.ring({ x: c.x, y: c.y, size: c.w * .5, grow: 3.2, life: .7, colors: [goldLite], lw: 5 });
          front.ring({ x: c.x, y: c.y, size: c.w * .4, grow: 4.4, life: 1, colors: [gold], lw: 3 });
          back.burst({ x: c.x, y: c.y, n: 90, r0: [c.w * .35, c.w * .55], speed: [260, 720], life: [.5, 1.1], size: [1, 2.8],
                       kinds: ['spark'], colors: gc, drag: 2, g: 260, len: .045 });
          front.burst({ x: c.x, y: c.y - c.h * .3, n: 70, r0: [c.w * .3, c.w * .5], speed: [300, 680], angle: [-Math.PI * .92, -Math.PI * .08],
                        life: [1.2, 2], size: [1.6, 4], kinds: ['star', 'glow'], colors: gc, g: 720, drag: .9, tw: [8, 16] });
          back.burst({ x: c.x, y: c.y, n: 18, speed: [40, 140], life: [1, 1.8], size: [18, 34], grow: 1.6, kinds: ['glow'],
                       colors: [gold], alpha: [.25, .45], drag: 1.4 });
          A(q('[data-ribbon-new]'), [{ transform: 'scale(2.4) rotate(-14deg)', opacity: 0 }, { transform: 'scale(.9) rotate(0deg)', opacity: 1, offset: .7 },
                                     { transform: 'none', opacity: 1 }], { duration: 480, delay: 260, easing: F.ease.back });
          return spin;
        }).then(function () {
          return A(flip, [{ transform: 'translateY(0) scale(1.14) rotateY(540deg)' }, { transform: 'translateY(0) scale(1) rotateY(540deg)' }],
                   { duration: 620, easing: F.ease.elastic });
        });
      },
    };

    const scene1 = q('[data-scene="1"]');
    const sheet = q('[data-arrive-sheet]');
    const mapEl = q('[data-arrive-map]');
    /* 抵達的光點與鐘聲到此為止（還沒亮起來就按了：連排好的那一次一起取消，不然翻卡中會響鐘、光點冒不停） */
    if (glow) { clearTimeout(glow); glow = 0; }
    if (motes) { motes.stop(); motes = null; }
    F.sfx.unlock();
    F.sfx.tap();
    A(sheet, [{ transform: 'none' }, { transform: 'translateY(110%)' }], { duration: 260, easing: F.ease.in });
    return A(scene1, [{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: F.ease.in })
      .then(function () {
        if (!alive()) return null;
        if (F.calm()) { finish(); return null; }      /* 減少動態：直接看結果（CSS 的淡入接手） */
        box.classList.add('is-revealing');
        setAt(2);
        /* 翻卡時卡片放在畫面正中；翻完才滑回結果的位置 */
        const b = box.getBoundingClientRect(), c = cardBox.getBoundingClientRect();
        const k = b.width / (box.offsetWidth || b.width) || 1;
        box.style.setProperty('--dy', (((b.top + b.height * .45) - (c.top + c.height / 2)) / k).toFixed(1) + 'px');
        if (mapEl) A(mapEl, [{ opacity: .55 }, { opacity: .1 }], { duration: 700, easing: F.ease.out });
        setAura(0);
        F.sfx.whoosh();
        /* 透明度動在外層：.ex-flip 自己有 opacity 動畫時，Chrome 會把 preserve-3d 壓平，翻面就只看得到反過來的卡背 */
        A(cardBox, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: F.ease.out });
        return A(flip, [{ transform: 'translateY(60px) scale(.3) rotate(-10deg)' },
                        { transform: 'translateY(-8px) scale(1.04) rotate(2deg)', offset: .7 },
                        { transform: 'none' }], { duration: 620, easing: F.ease.out });
      })
      .then(function () {
        if (!alive()) return null;
        R.phase = 'charge';
        const beats = beatsOf(style);
        let chain = Promise.resolve();
        for (let i = 0; i < beats; i++) {
          chain = chain.then(function () { return alive() && !R.fast ? beat(i) : null; });
        }
        return chain;
      })
      .then(function () {
        if (!alive()) return null;
        if (style && style.gold) {
          if (!R.fast) return upgrade();
          box.classList.add('is-gold-up');
        }
        return null;
      })
      .then(function () {
        if (!alive()) return null;
        setAura(tier - 1);
        A(aura, [{ opacity: .85 }, { opacity: .85 }], { duration: 10 });
        /* 等你翻開（沒動作 3.6 秒後自己翻，demo 不會卡住） */
        R.phase = 'ready';
        box.classList.add('is-ready');
        if (cap) cap.textContent = '點一下翻開';
        return Promise.race([new Promise(function (res) { R.tap = res; }), W(3600)]);
      })
      .then(function () {
        if (!alive()) return null;
        R.tap = null;
        R.phase = 'reveal';
        box.classList.remove('is-ready');
        if (cap) cap.textContent = '';
        F.sfx.flip();
        /* 節日版的插畫跟著翻開一起開始（正面轉過來的時候就在動） */
        if (E.festPlay) E.festPlay(box, { restart: false });
        const at = front.at(cardBox);
        return A(flip, [{ transform: 'none' }, { transform: PRE }], { duration: 140, easing: F.ease.in })
          .then(function () { return alive() ? (REVEAL[style ? style.key : 'watercolor'] || REVEAL.watercolor)(at) : null; });
      })
      .then(function () { return alive() ? W(tier >= 4 ? 900 : 520) : null; })
      .then(function () { if (alive()) finish(); });
  }

  const openBtn = q('[data-act="open-card"]');
  if (openBtn) openBtn.onclick = function (e) {
    if (e) e.stopPropagation();
    if (run || !F) { if (!F) finish(); return; }
    /* 按下去這顆就停用、面板收走：焦點不能掉到 body，交給「跳過動畫」（鍵盤按 Enter／空白鍵就直接看結果） */
    openBtn.disabled = true;
    if (skipBtn) { skipBtn.hidden = false; focusEl(skipBtn); }
    play();
  };
  if (skipBtn) skipBtn.onclick = function (e) {
    if (e) e.stopPropagation();
    if (run && box.getAttribute('data-at') !== '3') finish();
  };

  const btn = q('[data-act="collect"]');
  if (btn) {
    btn.onclick = function (e) {
      if (e) e.stopPropagation();
      /* 連點兩下只收一次、只導一次（第二下常落在轉場中還沒拆掉的舊畫面上） */
      if (collecting) return;
      collecting = true;
      btn.disabled = true;
      const note = noteInput ? String(noteInput.value || '').trim().slice(0, NOTE_MAX) : '';
      /* 搭車還是走路、哪一款、幾公里由 collect 在收的當下照規則判斷（畫面開著的時候行程可能被取消或換掉了）；
         搭車收下會請行程 module 用掉這一趟，並記下這趟車是從哪個入口叫的（rideVia） */
      collect(p.id, { note: note });
      APP.ui.toast('收進收藏了');
      /* 來回的行程：司機還在附近等（APP.ride.trip.waiting），收好就回行程頁叫回程；不然回收藏 */
      const wait = APP.ride.trip.waiting ? APP.ride.trip.waiting() : null;
      APP.nav.go(wait ? '/trip' : '/album', { dir: 'push' });
    };
  }

  return function () {
    if (run) run.dead = true;
    timers.forEach(clearTimeout);
    timers.length = 0;
    glow = 0;
    if (motes) motes.stop();
    stopDust();
    if (shake) shake.stop();
    if (back) back.destroy();
    if (front) front.destroy();
    if (map) map.destroy();
    /* 掛在 .device 上的規則說明、還在響的音效：離開這一頁就收掉 */
    closeRules();
    if (F && F.sfx.stopAll) F.sfx.stopAll();
  };
}

APP.view('unlock', {
  path: '/unlock/:id', tab: null, status: 'light', title: '抵達',
  render: renderUnlock, mount: mountUnlock,
});

})();
