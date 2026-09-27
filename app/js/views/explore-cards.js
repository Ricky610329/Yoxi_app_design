/* ==========================================================================
   yoxi 城事 web app — explore 區塊：明信片怎麼拿到的共用零件（不註冊畫面）
   契約：app/ARCHITECTURE.md §3、§7。
   載入順序：explore-fx.js → explore-fest.js → explore-cards.js → explore-face.js → explore-gold.js → explore.js → explore-unlock.js（都在 album.js 之前）。

   回答什麼：一張明信片怎麼拿到的——照規則是哪一款、為什麼、怎麼收下、收下的是搭車還是走路、是不是金框或限定版。
             收藏（album）、叫車首頁（ride）、探索的各畫面、/unlock 都讀這裡，所以獨立成一支，不跟著任何一個畫面走。
             長什麼樣（成品、照片＋濾鏡、插圖的疊法）在 explore-face.js。
   提供（APP.explore，對外 API，契約 §7）：
     collect(placeId, { note })                  收下一張明信片：搭車或走路、哪一款、幾公里都由這裡自己判斷
     cardOrigin(cardId)                          收下的那一張是怎麼來的：{ by, style, gold, limited, via, festival, far, lines, marks, … }
     CARD_STYLES／FESTIVALS／FAR_KM              款式規則表（全 app 唯一來源）
     cardRule(arrival)／ruleLines(rule)          照規則算這一次會收到哪一款（純函式）、為什麼（一條規則一句）
     openRules()                                 規則說明（掛在 .device，帶 data-overlay＋_dismiss）
     cardStyleOf(cardId)                         收下的是哪一款（收下時記的；demo 一開始就有的照規則補）
   是不是搭車抵達一律問 ride 的行程 module：APP.ride.trip.arrivedAt(地點 id)；搭車收下由 collect 呼叫
   APP.ride.trip.consume 用掉那一趟（連同 rideVia 歸因）。「是不是金框、是不是限定版」一律問 cardOrigin。
   內部零件 APP.explore._（不可列舉；只給 explore.js 與 explore-unlock.js 共用，別的區塊不要依賴）：
     這一次抵達（arrivalAt：搭車還是走路、幾公里、照規則的款式）、今天（today：demo 可以假裝別天）、
     卡面多的那幾層（marksHTML：節日插畫＋遠行戳）、關掉規則說明（closeRules）、點數（ridePoints）與幾個小工具；explore.js 再掛上頁面零件
     （exploreHome、notFound、backFabBar、distHTML）。
   刻意沒有：機率、抽籤、保底（明信片是哪一款只看規則，長輩知道「為什麼」）；畫面（/unlock 在 explore-unlock.js）、
             卡面（explore-face.js）、特效（explore-fx.js 的 APP.fx）。

   數字一律從 STATE／MOCK／APP.fmt 算；按鈕一律 element.onclick；動作鈕帶 data-act。
   ========================================================================== */

(function () {
'use strict';

const APP = window.APP;
if (!APP) return;

const esc = APP.esc;
const fmt = APP.fmt;

/* ---------------------------------------------------------------- 小工具 */

function M() { return window.MOCK || {}; }
function S() { return window.STATE; }

function collected(p) { return !!(p && p.card && S() && S().has(p.card)); }

function num(n) { return '<span class="num">' + esc(n) + '</span>'; }

/* 搭車抵達走不到的地方回饋的點數：唯一來源是 ride.js 的 APP.ride.RIDE_BONUS（/points 的明細也用它；
   資料缺了退回幾點也只寫在那裡）。ride.js 比這支先載入 */
function ridePoints() { return APP.ride.RIDE_BONUS; }

/* ---------------------------------------------------------------- 款式規則
   明信片是哪一款全部照規則，沒有機率、沒有抽籤：什麼時候去、怎麼去，就決定你收到哪一款，
   按「收集明信片」之前就寫在面板上。同一天用同樣方式到，每個人收到的都一樣。
   這一段是全 app 唯一來源：/unlock 的面板與結果、「?」的規則說明、收藏的「為什麼是這一款」都從這裡組字，不另外手寫。
     - 走路抵達：畫風跟著季節（months）；
     - 搭 yoxi 抵達：金框，不分季節；
     - 節日那一週（FESTIVALS：三節與櫻花季）：卡面多一層會動的節日插畫（explore-fest.js）；
     - 搭 yoxi FAR_KM 公里以上：多蓋一枚遠行紀念戳（獎勵已經走過的路，不是加機率）。
   畫風之後會以該地的景點照片為底、用 diffusion 生成（pitch/docs/ai-architecture.md 的「四季」變體）；
   節日插畫、郵戳與金框是程式疊上去的，不另外生圖。 */
const CARD_STYLES = [
  { key: 'watercolor', name: '水彩',     season: '春天', months: [3, 4, 5] },
  { key: 'oil',        name: '油畫',     season: '夏天', months: [6, 7, 8] },
  { key: 'woodcut',    name: '木刻版畫', season: '秋天', months: [9, 10, 11] },
  { key: 'ink',        name: '水墨',     season: '冬天', months: [12, 1, 2] },
  { key: 'gold',       name: 'yoxi 金框', gold: true },
];

/* 節日版：那段時間去的，卡面多一層會動的節日插畫（explore-fest.js 畫）。碰在一起時排前面的算（三節先於賞櫻）。
   三節是「那一週」：節日當天所在的週一到週日，官方連假超出那一週的話一起算（festSpan）。
     days  節日當天（'MM-DD'）。農曆不在程式裡換算：照行政院人事行政總處的「政府行政機關辦公日曆表」一年一年補
           （115、116 年查於 2026-09-27）。表上沒有的年份就沒有節日版，不猜。
     off   官方連假（含頭尾）：115 年春節 2/14–2/22、端午 6/19–6/21、中秋＋教師節 9/25–9/28；116 年春節 2/4–2/10，
           端午（週三）、中秋（週三）沒有連假。
     every 每年一樣的期間（賞櫻）：新竹公園的河津櫻一月底開到二月中，其他品種接著開；三月中為止是假設，拿到當年花況再調。 */
const FESTIVALS = [
  { key: 'spring', name: '春節', when: '春節那一週', deco: '鞭炮',
    days: { 2026: '02-17', 2027: '02-06' }, off: { 2026: ['02-14', '02-22'], 2027: ['02-04', '02-10'] } },
  { key: 'duanwu', name: '端午', when: '端午那一週', deco: '龍舟',
    days: { 2026: '06-19', 2027: '06-09' }, off: { 2026: ['06-19', '06-21'] } },
  { key: 'moon',   name: '中秋', when: '中秋那一週', deco: '月亮和玉兔',
    days: { 2026: '09-25', 2027: '09-15' }, off: { 2026: ['09-25', '09-28'] } },
  { key: 'sakura', name: '賞櫻', when: '櫻花季', deco: '櫻花樹', every: ['01-25', '03-15'] },
];

/* 搭 yoxi 多遠算「遠行」（公里，含）：新竹市區裡的地方都在 12 km 內，內灣線的站（九讚頭 21 km 起）才算。
   跟走路門檻（fmt.WALK_MAX_M）一樣是寫死的規則，改這裡畫面上的說明會跟著變。 */
const FAR_KM = 20;

function styleOf(key) {
  return CARD_STYLES.filter(function (d) { return d.key === key; })[0] || null;
}
function seasonOf(month) {
  return CARD_STYLES.filter(function (d) { return d.months && d.months.indexOf(month) >= 0; })[0] || CARD_STYLES[0];
}
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function mdOf(d) { return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
/* 某個節日在某一年的期間 ['MM-DD', 'MM-DD']（含頭尾），表上沒有那一年是 null。
   三節：節日當天所在的週一到週日，再跟官方連假取聯集。春節最早在 1/21，那一週的週一不會跨到去年，所以只比月日 */
function festSpan(f, year) {
  if (typeof f === 'string') f = FESTIVALS.filter(function (x) { return x.key === f; })[0];
  if (!f) return null;
  if (f.every) return f.every.slice();
  const day = f.days && f.days[year];
  if (!day) return null;
  const p = day.split('-');
  const d = new Date(year, Number(p[0]) - 1, Number(p[1]), 12);
  const mon = new Date(year, d.getMonth(), d.getDate() - (d.getDay() + 6) % 7, 12);
  const sun = new Date(year, mon.getMonth(), mon.getDate() + 6, 12);
  let a = mdOf(mon), b = mdOf(sun);
  const off = f.off && f.off[year];
  if (off) { if (off[0] < a) a = off[0]; if (off[1] > b) b = off[1]; }
  return [a, b];
}
function festivalOn(date) {
  const md = mdOf(date);
  return FESTIVALS.filter(function (f) {
    const r = festSpan(f, date.getFullYear());
    return !!r && md >= r[0] && md <= r[1];
  })[0] || null;
}

/* 今天是哪一天。demo 工具可以假裝是別天（store.demoDate，'YYYY-MM-DD'），現場才看得到冬天、中秋的明信片；
   只影響明信片（款式、節日版、郵戳、收下的日期），收藏的回顧照舊用真的今天。 */
function today() {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(APP.store.get('demoDate') || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : new Date();
}

/**
 * 這一次抵達會收到哪一款（純函式；/unlock、collect、測試都用這一個）。
 *   arrival：{ by:'walk'|'ride', km, date（Date，省略是 today()） }
 *   回傳：{ style（CARD_STYLES 的一款）, season（那個季節的一款）, festival（FESTIVALS 的一筆或 null）,
 *          far（搭 yoxi FAR_KM 公里以上）, km }
 */
function cardRule(arrival) {
  const a = arrival || {};
  /* 不用 instanceof Date：別的 realm（iframe、測試的 vm）的 Date 也要認得 */
  const date = a.date && typeof a.date.getTime === 'function' && !isNaN(a.date.getTime()) ? a.date : today();
  const ride = a.by === 'ride';
  const km = Number(a.km) || 0;
  const season = seasonOf(date.getMonth() + 1);
  return {
    style: ride ? styleOf('gold') : season,
    season: season,
    festival: festivalOn(date),
    far: ride && km >= FAR_KM,
    km: km,
  };
}

/* 為什麼是這一款：一條規則一句（面板、結果、收藏的明信片頁都念這幾句） */
function ruleLines(r) {
  if (!r || !r.style) return [];
  const out = [r.style.gold ? '搭 yoxi 抵達是金框' : r.season.season + '的畫風是' + r.style.name];
  if (r.festival) out.push(r.festival.when + '去的，卡面有' + r.festival.deco);
  if (r.far) out.push('搭 yoxi ' + r.km + ' 公里，多蓋一枚遠行紀念戳');
  return out;
}

/* 卡面上多的那幾層：節日版的插畫（explore-fest.js 的 festHTML，會動）＋遠行紀念戳（樣式在 explore.css 的 .card-marks）。
   /unlock 的卡面與收藏的明信片頁都用這個；插畫要放在地名那一條（.postcard__foot）前面，字才壓在圖上面 */
function marksHTML(r) {
  if (!r) return '';
  const fest = r.festival && APP.explore.festHTML ? APP.explore.festHTML(r.festival.key) : '';
  const far = r.far ? '<span class="card-marks"><span class="card-mark" data-mark="far">遠行<small>' + esc(r.km) + ' km</small></span></span>' : '';
  return fest + far;
}

/* 月份表 [3, 4, 5] →「3–5 月」；三節今年的日期 ['09-25', '09-25'] →「9/25」 */
function monthsText(ms) { return ms[0] + '–' + ms[ms.length - 1] + ' 月'; }
function dayText(md) { const p = md.split('-'); return Number(p[0]) + '/' + Number(p[1]); }

/* 這一次抵達（只讀）：搭 yoxi 抵達這裡的那一趟（行程 module 說了算）、搭車還是走路、幾公里、
   照規則會收到哪一款（rule）。/unlock 的畫面與 collect 都用這一個答案。 */
function arrivalAt(p) {
  const trip = p ? APP.ride.trip.arrivedAt(p.id) : null;
  const by = trip ? 'ride' : 'walk';
  const km = trip && trip.km != null ? trip.km : fmt.km(p && p.dist);
  const rule = p ? cardRule({ by: by, km: km }) : null;
  return { trip: trip, by: by, km: km, rule: rule, style: rule ? rule.style : null };
}

/* 收下的明信片是哪一款：收下時記下的（store.cardStyle）→ 沒有紀錄的（demo 一開始就有的 8 張）照同一套規則補：
   搭車是金框；走路看收下那天的月份是哪個季節 */
function cardStyleOf(cardId) {
  const had = styleOf((APP.store.get('cardStyle') || {})[cardId]);
  if (had) return had;
  const c = S() && S().card(cardId);
  if (!c) return null;
  if (c.by === 'ride') return styleOf('gold');
  const month = Number(String(c.date || '').split('.')[0]);
  return month >= 1 && month <= 12 ? seasonOf(month) : CARD_STYLES[0];
}

/* 收在「?」裡的規則說明。掛在 .device 上（壓在全螢幕的解鎖頁上面），所以離開這一頁要自己收：
   帶 data-overlay、el._dismiss()（core 導覽前會呼叫；/unlock 的 cleanup 也呼叫 closeRules），可以重複呼叫。
   掛法（data-overlay、_dismiss、Esc 與焦點）交給 APP.ui.overlay；它在點「?」時才掛 keydown，router 記不到，
   所以一定要經過 _dismiss 拆掉。 */
let rulesOpen = null;
function openRules() {
  if (rulesOpen && rulesOpen.isConnected) return rulesOpen;
  const now = today();
  const here = seasonOf(now.getMonth() + 1);
  const row = function (k, a, b, on) {
    return '<li class="ex-rules__row' + (on ? ' is-now' : '') + '" data-rule="' + esc(k) + '">' +
      '<span>' + a + '</span><span>' + b + '</span></li>';
  };
  const seasons = CARD_STYLES.filter(function (d) { return d.months; }).map(function (d) {
    return row(d.key, esc(d.season) + '（' + esc(monthsText(d.months)) + '）', esc(d.name), d === here);
  }).join('');
  const fests = FESTIVALS.map(function (f) {
    const r = festSpan(f, now.getFullYear());
    const days = r ? '（' + (f.every ? '每年 ' : '今年 ') + esc(dayText(r[0])) + (r[1] !== r[0] ? '–' + esc(dayText(r[1])) : '') + '）' : '';
    return row(f.key, esc(f.name) + days, esc(f.deco));
  }).join('');
  const scrim = document.createElement('div');
  scrim.className = 'scrim ex-rules';
  scrim.innerHTML =
    '<div class="modal app-modal ex-rules__box">' +
      '<h2 class="ex-rules__t">明信片怎麼決定</h2>' +
      '<h3 class="ex-rules__h">走路抵達：畫風跟著季節</h3><ul class="ex-rules__list" data-rules="season">' + seasons + '</ul>' +
      '<h3 class="ex-rules__h">搭 yoxi 抵達</h3><ul class="ex-rules__list" data-rules="ride">' +
        row('gold', '不分季節', esc(styleOf('gold').name)) +
        row('far', num(FAR_KM) + ' 公里以上', '多蓋一枚遠行紀念戳') +
      '</ul>' +
      '<h3 class="ex-rules__h">節日那一週：卡面多一層會動的插畫</h3><ul class="ex-rules__list" data-rules="festival">' + fests + '</ul>' +
      '<button class="btn-primary" type="button" data-act="close-rules">知道了</button>' +
    '</div>';
  const end = APP.ui.overlay(scrim, {
    dialog: scrim.querySelector('.modal'),
    label: '明信片怎麼決定',
    onClose: function () { if (rulesOpen === scrim) rulesOpen = null; },
  });
  scrim.querySelector('[data-act="close-rules"]').onclick = end;
  scrim.onclick = function (e) { if (e.target === scrim) end(); };
  rulesOpen = scrim;
  return scrim;
}
function closeRules() {
  if (rulesOpen && rulesOpen._dismiss) rulesOpen._dismiss();
  rulesOpen = null;
}

/* ---------------------------------------------------------------- APP.explore */

/**
 * 收下一張明信片（契約 §7）。placeId 可以是地點 id 或明信片 id；回傳是否為新收。
 * 呼叫的人只給那一句話（note），其餘都在這裡判斷，跟 /unlock 畫面上看到的是同一個答案：
 *   - 搭車還是走路：行程 module 說這一趟搭 yoxi 抵達這裡（APP.ride.trip.arrivedAt）就是搭車，否則走路；
 *   - 哪一款、是不是節日版、有沒有遠行戳：照 cardRule（今天的日期、搭車還是走路、幾公里）；
 *   - 幾公里：搭車用這一趟的公里數，走路用地方的距離（距離不明是 0，跟以前一樣）。
 * 搭車收下才用掉這一趟（行程 module 順便記下 rideVia 歸因）；走路收別的地方不碰行程——還沒領的限定版
 * （金框＋點數）不會跟著消失。同一個地方有搭車抵達的那一趟時一律算搭車（/unlock 也是這樣畫的）。
 */
function collect(placeId, opt) {
  opt = opt || {};
  const p = APP.place(placeId);
  const pid = p ? p.id : placeId;
  const target = (p && p.card) || placeId;
  /* STATE 與 app store 的寫入包成一次 state:change，全部寫完才發 */
  return APP.state.batch(function () {
    const a = arrivalAt(p);
    const isNew = APP.state.collect(target, {
      by: a.by,
      note: opt.note || '',
      km: a.km,
      date: fmt.todayMMDD(today()),
    });
    /* 款式、節日版與遠行戳記在 app store（STATE 的卡片結構不動）。要在收下的當下記，不能事後回推：
       卡片日期沒有年份（明年的中秋不是同一天），STATE 的卡片也沒有公里數。
       都沒有也記一筆（fest ''、far 0），表示「查過了，沒有」 */
    if (isNew && a.rule) {
      APP.store.set('cardStyle', Object.assign({}, APP.store.get('cardStyle') || {}, { [target]: a.rule.style.key }));
      APP.store.set('cardMarks', Object.assign({}, APP.store.get('cardMarks') || {}, {
        [target]: { fest: a.rule.festival ? a.rule.festival.key : '', far: a.rule.far ? a.rule.km : 0 },
      }));
    }
    if (a.trip) APP.ride.trip.consume(placeId);
    const drop = APP.store.get('dropoff');
    if (drop && (drop.id === pid || drop.id === placeId)) APP.store.set('dropoff', null);
    return isNew;
  });
}

/**
 * 收下的那一張是怎麼來的（還沒收是 null）。收藏、叫車的浮起來小卡、探索的「已收藏」一行都讀這個，
 * 不各自去翻 STATE 的 by、store.cardStyle、store.rideVia：
 *   { id, date, note, km, by:'walk'|'ride', style（CARD_STYLES 的一款）, via（搭車的轉換歸因或 null）,
 *     limited（yoxi 限定版：ride.js 的判斷，搭 yoxi 去走不到的地方、+50 點）,
 *     gold（畫金框：金框那一款，或是限定版——限定版一定是金框，金框不一定是限定版）,
 *     festival（收下那天的節慶，FESTIVALS 的一筆或 null）, far（遠行紀念）,
 *     lines（為什麼是這一款，ruleLines）, marks（卡面多的那幾層：節日插畫＋遠行戳的 HTML） }
 */
function cardOrigin(cardId) {
  const c = S() && S().card(cardId);
  if (!c) return null;
  const style = cardStyleOf(cardId);
  const limited = !!(APP.ride && APP.ride.limitedCard && APP.ride.limitedCard(cardId));
  const by = c.by === 'ride' ? 'ride' : 'walk';
  const month = Number(String(c.date || '').split('.')[0]);
  /* 節日版與遠行戳只認收下時記的（store.cardMarks）；demo 一開始就有的 8 張沒有紀錄，就都沒有 */
  const mk = (APP.store.get('cardMarks') || {})[cardId] || {};
  const farKm = Number(mk.far) || 0;
  const rule = {
    style: style,
    season: month >= 1 && month <= 12 ? seasonOf(month) : CARD_STYLES[0],
    festival: FESTIVALS.filter(function (f) { return f.key === mk.fest; })[0] || null,
    far: farKm > 0,
    km: farKm,
  };
  return {
    id: cardId, date: c.date, note: c.note, km: c.km,
    by: by,
    style: style,
    gold: limited || !!(style && style.gold),
    limited: limited,
    via: (APP.store.get('rideVia') || {})[cardId] || null,
    festival: rule.festival,
    far: rule.far,
    lines: ruleLines(rule),
    marks: marksHTML(rule),
  };
}

APP.explore = Object.assign(APP.explore || {}, {
  collect: collect,
  cardOrigin: cardOrigin,
  /* 款式規則：規則表、純函式、規則說明（契約 §7） */
  CARD_STYLES: CARD_STYLES,
  FESTIVALS: FESTIVALS,
  festSpan: festSpan,
  FAR_KM: FAR_KM,
  cardRule: cardRule,
  ruleLines: ruleLines,
  /* 收下的是哪一款（卡面在 explore-face.js） */
  cardStyleOf: cardStyleOf,
  openRules: openRules,
});

/* explore 三支檔案共用的內部零件。不可列舉：只給 explore.js 與 explore-unlock.js 共用 */
Object.defineProperty(APP.explore, '_', {
  enumerable: false,
  value: {
    M: M, S: S, collected: collected, num: num,
    ridePoints: ridePoints,
    styleOf: styleOf, arrivalAt: arrivalAt, today: today, marksHTML: marksHTML,
    closeRules: closeRules,
  },
});

})();
