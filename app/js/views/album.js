/* ==========================================================================
   yoxi 城事 web app — album 區塊（收藏 tab）
   契約：app/ARCHITECTURE.md §0（S3 路線書架＋X4 勳章牆、隱私分軌、長輩圖是分享選項）、§3、§5、§8。

   這支註冊九個 view：
     /album           收藏首頁（雙主頁版）。「我的明信片」主卡（張數＋最近收下的三張疊卡，最後收的在最上面，點了進 /postcards）、統計兩格、
                      「回顧」一列三格（今天的回顧 → /lookback、這一週 → /week、城市足跡 → /footprint）、
                      獎章精選卡（最近收下的一枚放大＋其餘一列小章＋「顯示全部」）。390×844 一屏放得下。
                      舊連結 ?tab=journal|week|badges|cards 落在同一頁：捲到對應的那一塊、亮一下，再把 ?tab 拿掉。
     /postcards       明信片子頁：收下的一段（最近的在前，每張連到詳情）、還沒去的一段，左上返回。
     /badges          全部獎章：三欄六角章牆，收下的寫日期、還在路上的寫「收集 n/m」。
     /postcard/:id    明信片詳情，點一下翻面看背面敘事。來源：postcard.html。
     /badge/:id       獎章詳情。來源：badge.html。
     /footprint       城市足跡：真實地圖＋霧、覆蓋率用固定範圍算、城市顏色由去過的地方算。來源：fogmap.html、concept-map-footprint.html。
     /lookback        每日回顧四幕（只有你）。來源：lookback.html。
     /week            週回顧（唯一可分享的匯總）。來源：week.html。
     /elder           長輩圖（?card=<明信片 id>：從哪一張分享過來，那一張排第一）。來源：elder.html。
   子頁的返回鍵都走 subMount（見「子頁的返回鍵」）：從上一層點進來就照歷史退一格，
   切 tab 停回來、重新整理、直接開網址就回邏輯上的上一層。

   刻意沒有的東西：
   - 連續天數、排名、限量、倒數、未讀數字；獎章的進度環與集點卡（X4 選了勳章牆）。
   - 獎章章面不刻年份：刻了像「年度限定」，跟「沒有期限、不會過期」相衝；也不拿文字當圖示，地標是線稿。
   - 明信片網格不逐張貼「AI 生成示意」（22 張會變成標籤牆），/postcards 底下一行講一次。
   - 日誌／心情／照片沒有分享鍵（隱私分軌）：首頁「今天的回顧」那一格標「只有你」、沒有分享；
     只有明信片、週回顧、長輩圖可以分享。
   - /album 不攤開明信片網格：L1 一屏一事、可按數 ≤ 12；網格在 /postcards（整片算一個可按的東西，見 harness 的 data-gallery）。
   - 「yoxi 限定版」只給 APP.ride.limitedCard（搭 yoxi 去走不到的地方、+50 點）；其他金框卡寫「yoxi 金框」。
   - 金框卡不管在哪裡顯示（疊卡、/postcards、詳情、獎章的組成卡、每日回顧、週回顧）都是金框，畫框的那個元素標 data-gold-aura，
     金粉由 explore-gold.js 畫（契約 §7）；長輩圖挑的是插圖不是明信片，不標。
   - 城市足跡不寫「多久沒回去會變淡」：app 沒有記回訪，寫了就是假的。
   - 回顧不靠計時器自動翻頁：每一幕都等使用者按「下一步」或做選擇。
   - 數字一律從 STATE／MOCK／APP.fmt 算；步幅＝LOOKBACK.steps ÷ LOOKBACK.km，不另寫常數。
   ========================================================================== */

(function () {
'use strict';

const esc = function (s) { return APP.esc(s); };
const M = function () { return window.MOCK; };
const YEAR = function () { return new Date().getFullYear(); };

/* ---------------------------------------------------------------- 資料 */

function cardById(id) {
  return (M().POSTCARDS || []).filter(function (p) { return p.id === id; })[0] || null;
}
function cardIdx(p) { return M().POSTCARDS.indexOf(p); }

/* 每公里幾步：跟每日回顧那一組數字同源（6,240 步 / 4.3 公里） */
function stepsPerKm() {
  const L = M().LOOKBACK;
  return L.km ? L.steps / L.km : 0;
}

/* 明信片 → 城市足跡上的地點一律問 APP.footprintPlace（app.js；它跟 APP.place 刻意不同，理由寫在那裡）。
   「去過的地方」的鍵：對得到地點就用地點，對不到的卡自己算一個地方。 */
function visitKey(cardId) { return APP.footprintPlace(cardId) || cardId; }

/* 已收的卡 → 足跡地圖上的點；回傳 { seen:[placeId], missing:[cardId] } */
function footprintSeen() {
  const geo = window.HSINCHU_PLACES || {};
  const seen = [];
  const missing = [];
  M().POSTCARDS.forEach(function (p) {
    if (!STATE.has(p.id)) return;
    const pid = APP.footprintPlace(p.id);
    if (pid && geo[pid]) { if (seen.indexOf(pid) < 0) seen.push(pid); }
    else missing.push(p.id);
  });
  return { seen: seen, missing: missing };
}

/* 去過的地方（不重複）：好幾張卡可能是同一個地方（p3／p19 都是護城河、p6／p21 十八尖山、p8／p22 青草湖），
   所以「去過的地方」不是 STATE.count()。對不到地點的卡自己算一個地方。 */
function visitedPlaces() {
  const out = [];
  M().POSTCARDS.forEach(function (p) {
    if (!STATE.has(p.id)) return;
    const k = visitKey(p.id);
    if (out.indexOf(k) < 0) out.push(k);
  });
  return out;
}

function badgeOfCard(cardId) {
  return (M().BADGES || []).filter(function (b) { return b.ids.indexOf(cardId) >= 0; })[0] || null;
}

/* 收下的那一張是怎麼來的：一律問 explore-cards.js 的 cardOrigin（契約 §7），這裡不另外判斷。
   金框＝抽到金框那一款（或 demo 一開始就有的搭車卡），契約：「金框的明信片在收藏裡也是金框」。
   yoxi 限定版（金框＋和泰 Points +50）＝ride.js 的判斷（搭 yoxi 去走不到的地方）。限定版一定是金框，
   金框不一定是限定版——搭車去 900 m 外的玻璃窯是金框、不是限定版，所以不能拿「金框」回推「限定版」。 */
function goldCard(cardId) { const o = APP.explore.cardOrigin(cardId); return !!(o && o.gold); }
function limitedCard(cardId) { const o = APP.explore.cardOrigin(cardId); return !!(o && o.limited); }

function badgeProg(r) { return '收集 ' + r.done + '/' + r.total; }

function badgeCount() {
  const list = M().BADGES || [];
  return {
    got: list.filter(function (b) { return STATE.badge(b.id).got; }).length,
    total: list.length,
  };
}

/* 收下那一天：組成的卡都收了，最晚那一張的日期（'MM.DD'）；還沒收齊回 null */
function badgeDate(r) {
  if (!r.got) return null;
  let last = null;
  r.ids.forEach(function (cid) {
    const c = STATE.card(cid);
    if (c && (!last || String(c.date) > last)) last = String(c.date);
  });
  return last;
}
function badgeWhen(x) { return x.date ? YEAR() + '.' + x.date : badgeProg(x.r); }

/* 收藏首頁與 /badges 的順序：收下的在前（最近收下的最前），還在路上的照收集比例排 */
function badgeOrder() {
  return (M().BADGES || []).map(function (b) {
    const r = STATE.badge(b.id);
    return { b: b, r: r, date: badgeDate(r) };
  }).sort(function (x, y) {
    if (x.date && y.date) return x.date < y.date ? 1 : x.date > y.date ? -1 : 0;
    if (x.date || y.date) return x.date ? -1 : 1;
    return (y.r.total ? y.r.done / y.r.total : 0) - (x.r.total ? x.r.done / x.r.total : 0);
  });
}

/* ---- 獎章的章面 ----
   六角形的金屬章，章面是一張縮小的明信片：上面是天色與太陽，下面是一截銀色的地面，
   地標用同一種粗細的線稿刻在上面（不拿文字當圖示）。
   - 天色借 MOCK.ART 的明信片色票（跟那一組地方同一種天），不另寫色碼；銀色與還沒收下的素面都用 tokens。
   - 地標：舊城區＝迎曦門、老車站＝新竹車站鐘樓、水路＝橋、內灣線＝火車、風城玻璃＝玻璃瓶與風、山與湖＝山。
   - 地面刻線：水路與山與湖是水紋、內灣線是鐵軌，其他是兩道街線。
   沒登記的獎章：第一張卡的色票＋地點圖釘。 */
const PICT = {
  gate:    'M26 67V53H74V67M43 67V61A7 7 0 0 1 57 61V67M34 53V46M66 53V46' +
           'M24 45Q31 47 37 45L42 42H58L63 45Q69 47 76 45M42 42V37M58 42V37' +
           'M33 37Q39 39 43 36L50 30L57 36Q61 39 67 37',
  station: 'M42 67V39H58V67M40 39L50 28L60 39M54 46A4 4 0 1 1 46 46A4 4 0 1 1 54 46' +
           'M46 67V61A4 4 0 0 1 54 61V67M26 67V52H42M58 52H74V67M31 57V62M37 57V62M63 57V62M69 57V62',
  bridge:  'M22 49H78M26 43H74M26 43V49M38 43V49M50 43V49M62 43V49M74 43V49M28 67Q50 45 72 67',
  train:   'M38 64V44Q38 37 45 37H55Q62 37 62 44V64ZM42 43H58V50H42ZM36 64H64' +
           'M46 57A2 2 0 1 1 42 57A2 2 0 1 1 46 57M58 57A2 2 0 1 1 54 57A2 2 0 1 1 58 57',
  glass:   'M45 29H55M47 29V37C47 41 36 45 36 55C36 62 42 66 50 66C58 66 64 62 64 55C64 45 53 41 53 37V29' +
           'M41 54C41 50 43 48 46 47M19 44H29Q33 44 33 40.5Q33 37.5 30 37.5M21 51H31',
  peaks:   'M22 67L38 43L46 54L57 35L78 67M51.5 43.5L55 46L58.5 43L62 45.5',
  pin:     'M50 66C50 66 36 52 36 43A14 14 0 0 1 64 43C64 52 50 66 50 66ZM54 43A4 4 0 1 1 46 43A4 4 0 1 1 54 43',
};
const GROUND = {
  street: 'M22 75H78M32 82H68',
  waves:  'M18 74Q23 71.5 28 74T38 74T48 74T58 74T68 74T78 74T88 74M26 81Q31 78.5 36 81T46 81T56 81T66 81T76 81',
  track:  'M46 67L34 92M54 67L66 92M41 73H59M38 80H62M35 87H65',
};
const MEDAL = {
  b1: { art: 'market',  pict: 'gate',    ground: 'street' },
  b3: { art: 'station', pict: 'station', ground: 'street' },
  b2: { art: 'moat',    pict: 'bridge',  ground: 'waves' },
  b4: { art: 'hakka',   pict: 'train',   ground: 'track' },
  b5: { art: 'glass',   pict: 'glass',   ground: 'street' },
  b6: { art: 'lake',    pict: 'peaks',   ground: 'waves' },
};
let medalSeq = 0;

/* 尖頂六角形、圓角：每個角用一段二次曲線帶過 */
function hexPath(R, r) {
  const V = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i - 90);
    V.push([50 + R * Math.cos(a), 50 + R * Math.sin(a)]);
  }
  const k = r / R;
  const pt = function (p) { return p[0].toFixed(2) + ' ' + p[1].toFixed(2); };
  const toward = function (p, q) { return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]; };
  return V.map(function (v, i) {
    const a = toward(v, V[(i + 5) % 6]), b = toward(v, V[(i + 1) % 6]);
    return (i ? 'L' : 'M') + pt(a) + 'Q' + pt(v) + ' ' + pt(b);
  }).join('') + 'Z';
}
const HEX_RIM = hexPath(48, 9);
const HEX_SHINE = hexPath(45.5, 8);
const HEX_FACE = hexPath(39.5, 6);

function medalSVG(b, got) {
  const m = MEDAL[b.id] || {};
  const first = cardById(b.ids[0]);
  const ART = M().ART || {};
  const sky = (ART[m.art] || ART[first && first.art] || { sky: [] }).sky;
  const pict = PICT[m.pict] || PICT.pin;
  const ground = GROUND[m.ground] || GROUND.street;
  const id = 'md' + (medalSeq++);
  const grad = function (gid, x2, y2, stops) {
    return '<linearGradient id="' + id + gid + '" x1="0" y1="0" x2="' + x2 + '" y2="' + y2 + '">' +
      stops.map(function (s) {
        return '<stop offset="' + s[0] + '" class="alb-hex__' + s[1] + '"' + (s[2] ? ' stop-color="' + esc(s[2]) + '"' : '') + '/>';
      }).join('') + '</linearGradient>';
  };
  return '<svg class="alb-hex' + (got ? '' : ' is-locked') + '" viewBox="0 0 100 100" aria-hidden="true">' +
    '<defs>' +
      grad('r', 1, 1, [[0, 's1'], [.35, 's2'], [.55, 's1'], [1, 's3']]) +
      grad('g', 0, 1, [[0, 's1'], [1, 's2']]) +
      grad('f', 0, 1, [[0, 'sky0', sky[1]], [1, 'sky1', sky[2] || sky[1]]]) +
      '<clipPath id="' + id + 'c"><path d="' + HEX_FACE + '"/></clipPath>' +
    '</defs>' +
    '<path class="alb-hex__rim" d="' + HEX_RIM + '" fill="url(#' + id + 'r)"/>' +
    '<path class="alb-hex__shine" d="' + HEX_SHINE + '"/>' +
    '<g clip-path="url(#' + id + 'c)">' +
      '<rect width="100" height="100" fill="url(#' + id + 'f)"/>' +
      '<circle class="alb-hex__sun" cx="68" cy="31" r="7" fill="' + esc(sky[0] || '') + '"/>' +
      '<rect y="67" width="100" height="33" fill="url(#' + id + 'g)"/>' +
      '<path class="alb-hex__groove" d="' + ground + '"/>' +
      '<path class="alb-hex__horizon" d="M0 67H100"/>' +
      '<path class="alb-hex__pict alb-hex__pict--shade" transform="translate(0 1.2)" d="' + pict + '"/>' +
      '<path class="alb-hex__pict" stroke="url(#' + id + 'g)" d="' + pict + '"/>' +
    '</g>' +
    '<path class="alb-hex__edge" d="' + HEX_FACE + '"/>' +
  '</svg>';
}

/* 卡片背面的一段話：原型寫好的三張 → 地點的「以前的它」→ 通用句 */
const STORY = {
  p11: '新竹曾經是全世界最會做玻璃的地方之一。這裡有矽砂、有天然氣，兩樣做玻璃最貴的東西都便宜。1970 年代這條巷子裡有七座窯，日夜不熄，整條街是亮的。',
  p9:  '內灣線 1951 年通車，原本不是給人坐的 —— 它是為了把尖石山上的木材與水泥原料運下山。林業一停，人就走了。',
  p1:  '1913 年落成，是台灣還在使用的最老車站。屋頂的老虎窗與鐘塔是巴洛克混合德式的做法。',
};
const AGAIN = {
  p11: '窯的後面有一道更矮的舊牆，是更早一代的窯留下來的。兩道牆之間差了二十年。',
  p9:  '戲院後面那條沒招牌的巷子走到底，有一戶人家的門牌還是日文的。',
};
/* 明信片底圖照片的出處（作者、授權、來源連結）。明信片的卡面不論是生成的成品、還是照片＋濾鏡，
   都是從這張照片來的（CC 授權要署名），跟 /unlock 結果頁的那一行同一個來源（APP.explore.cardPhoto） */
function photoCreditHTML(cardId) {
  const ph = APP.explore && APP.explore.cardPhoto ? APP.explore.cardPhoto(cardId) : null;
  if (!ph) return '';
  return '<p class="alb-credit" data-credit>底圖照片 © ' + esc(ph.author || '') + ' · ' + esc(ph.licence || '') +
    (ph.source ? ' <a class="alb-credit__a" href="' + esc(ph.source) + '" target="_blank" rel="noopener" data-act="open-credit">出處</a>' : '') + '</p>';
}

function storyOf(cardId) {
  if (STORY[cardId]) return STORY[cardId];
  const pid = APP.footprintPlace(cardId);
  const pl = pid ? APP.place(pid) : null;
  const past = pl && (pl.story || []).filter(function (s) { return s.label === '以前的它'; })[0];
  return past ? past.text : '在這裡停了一下。';
}

const MOODS = [
  { k: 'good', icon: 'moodGood', t: '今天不錯' },
  { k: 'ok',   icon: 'moodOk',   t: '今天普通' },
  { k: 'low',  icon: 'moodLow',  t: '今天有點累' },
];
function moodOf(k) { return MOODS.filter(function (m) { return m.k === k; })[0] || null; }

function dateLabel(d) {
  d = d || new Date();
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + '日一二三四五六'.charAt(d.getDay());
}

/* ---- 這一週：範圍是固定的 7 天 ----
   本週＝HEALTH_STEPS.month 最後一個有步數的日子往前 7 天；上週＝再往前 7 天。不看卡片日期
   （之前用「最近收卡那天」當結尾：今天收一張，整週往後滑到沒有步數的日子，公里與步數反而倒退）。
   標題、長條圖、步數、公里、地方數全部用同一個 7 天：卡片只算日期落在範圍裡的。
   範圍之後才收的（例如今天剛收的）放在 now.after，畫面另寫一行照實說「還沒算進這一週」，不偷偷塞進本週。
   月份＝POSTCARDS 第一張的月份（HEALTH_STEPS 是那個月）。
   已知限制：卡片日期是 'MM.DD'、沒有年份（格式是 prototype/js/state.js 的），這裡用 MM×100＋DD 比先後，
   所以跨年會錯（去年 12 月的卡會排在今年 9 月之後）。demo 只有一個月的資料，不在這裡補年份。 */
function weekStats() {
  const m = M();
  const month = (m.HEALTH_STEPS && m.HEALTH_STEPS.month) || [];
  const MM = String((m.POSTCARDS[0] && m.POSTCARDS[0].date) || APP.fmt.todayMMDD()).slice(0, 2);
  const mm = Number(MM);
  let end = 0;
  month.forEach(function (v, i) { if (v > 0) end = i + 1; });
  if (!end) end = Math.min(month.length, 7) || 7;

  const keyOf = function (date) {          /* 'MM.DD' → MM*100+DD，跨月也比得出先後 */
    const t = String(date || '');
    return Number(t.slice(0, 2)) * 100 + Number(t.slice(3, 5));
  };
  const got = m.POSTCARDS.map(function (p) { return { p: p, c: STATE.card(p.id) }; })
    .filter(function (x) { return x.c && /^\d\d\.\d\d/.test(String(x.c.date)); })
    .map(function (x) { x.key = keyOf(x.c.date); return x; });

  const spk = stepsPerKm();
  const inKeys = function (lo, hi) {
    return got.filter(function (x) { return x.key >= lo && x.key <= hi; })
      .sort(function (x, y) { return x.key - y.key; })
      .map(function (x) { return x.p; });
  };
  function range(a, b) {
    const days = [];
    for (let d = a; d <= b; d++) days.push({ day: d, steps: d >= 1 ? (month[d - 1] || 0) : 0 });
    const steps = days.reduce(function (s, x) { return s + x.steps; }, 0);
    const cards = inKeys(mm * 100 + a, mm * 100 + b);
    /* 地方數跟收藏首頁同一個算法：同一個地方的兩張卡算一個 */
    const places = cards.map(function (p) { return visitKey(p.id); })
      .filter(function (k, i, arr) { return arr.indexOf(k) === i; }).length;
    return { from: a, to: b, days: days, steps: steps,
             km: spk ? Math.round(steps / spk * 10) / 10 : 0, cards: cards, places: places };
  }
  const now = range(end - 6, end);
  /* 範圍之後才收的：不算進本週，只拿來寫那一行說明 */
  now.after = inKeys(mm * 100 + end + 1, Infinity);
  return { month: mm, now: now, prev: range(end - 13, end - 7) };
}
function mdLabel(month, day) {
  if (day < 1) return '上個月';
  return month + '月' + day + '日';
}

/* ---------------------------------------------------------------- 零件 */

/* 紅色頁首的關閉鍵、分享鈕：.alb-hdr 底下把它們本身撐到 44×44（album.css），不只靠 app.css 的 ::before */
function backBtn(fallback) {
  return '<a class="hdr-red__close" href="#" data-back="' + esc(fallback) + '" aria-label="返回">' +
    '<span data-icon="close"></span></a>';
}

function header(o) {
  return '<header class="hdr-red hdr-red--compact alb-hdr"><div class="hdr-red__bar">' +
    (o.back ? backBtn(o.back) : '') +
    '<h1 class="hdr-red__title' + (o.back ? ' alb-hdr__title' : '') + '">' + esc(o.title) + '</h1>' +
    (o.action || '') +
    '</div></header>';
}

function shareBtn() {
  return '<button class="hdr-red__action u-row u-gap2" type="button" data-act="share">' +
    '<span class="ic-ondark" data-icon="share" style="width:18px;height:18px;display:block"></span>分享</button>';
}

function notFound(o) {
  return header({ title: o.title, back: o.back }) +
    '<div class="scroll alb-scroll" style="background:var(--yoxi-mist)">' +
    '<div class="app-empty alb-empty"><div class="app-empty__card app-empty__card--missing">' +
      '<p class="app-empty__eyebrow">' + esc(o.eyebrow) + '</p>' +
      '<h1 class="app-empty__t">' + esc(o.t) + '</h1>' +
      '<p class="app-empty__p">' + esc(o.p) + '</p>' +
      '<a class="btn-primary" href="#/album" data-act="go-album">回收藏</a>' +
    '</div></div></div>';
}

/* ---------------------------------------------------------------- 子頁的返回鍵
   收藏的子頁有兩種來法：
   1. 從上一層點進來（/album → /badges → /badge/b3、/trips → /postcard/p8、分享 → /elder）：返回＝照歷史退一格。
   2. 切到叫車再點「收藏」停回這一頁、重新整理、直接開網址、從流程頁（/unlock…）過來：照歷史退一格會跑錯頁
      （退回叫車、退回抽卡），所以直接換成邏輯上的上一層（replace，不多一筆歷史）；換上來的那一層再按返回也往上走。
   這個判斷是 router 的 APP.nav.up（它在 history.state 記了每一筆從哪裡來、怎麼來的）；這裡只標返回鍵：
   data-back＝上一層、data-up＝用 nav.up 的預設規則（上一筆是有底欄的一般頁、而且不是這一頁才退）。 */
const PARENT = { postcards: '/album', badges: '/album', postcard: '/postcards', badge: '/badges',
                 week: '/album', elder: '/week', footprint: '/album' };

/* 每個子頁的 mount 都呼叫：把返回鍵（第一個 a[data-back]）指向上一層，交給 router 的 nav.up */
function subMount(root, ctx, name) {
  const a = root.querySelector('a[data-back]');
  if (!a) return;
  a.setAttribute('data-back', PARENT[name] || '/album');
  a.setAttribute('data-up', '');
}

/* 雙主頁第一版：明信片主卡（點進去看全部）、統計、回顧一列、獎章精選卡。 */
function isFresh(p) { return STATE.has(p.id) && STATE.lastIsNew && STATE.all.lastCard === p.id; }

/* 子頁的頁首（/postcards、/badges）：返回鍵＋大標題＋一句說明 */
function subHeader(title, sub) {
  return '<header class="alb-v2__header alb-v2__header--sub">' +
    '<a class="alb-v2__back" href="#" data-back="/album" aria-label="返回"><span class="arrow arrow--left"></span></a>' +
    '<h1>' + esc(title) + '</h1><p>' + sub + '</p></header>';
}

/* /postcards 的一格：收下的彩色寫日期、連到詳情（金框的也是金框）；還沒去的灰階、不連 */
function albumV2CardHTML(p) {
  const got = STATE.card(p.id);
  const fresh = isFresh(p);
  const gold = !!got && goldCard(p.id);
  const inner =
    '<span class="alb-v2__art" data-art="' + esc(p.art) + '" data-seed="' + cardIdx(p) + '" data-card-art="' + esc(p.id) + '"' +
      (gold ? ' data-gold-aura' : '') + '>' +
      (fresh ? '<span class="postcard__new">新</span>' : '') + '</span>' +
    '<strong>' + esc(p.name) + '</strong>' +
    (got ? '<small>' + (fresh ? '新收下' : esc(got.date) + ' 收下') + (gold ? ' · 金框' : '') + '</small>' : '');
  if (!got) return '<div class="alb-v2__postcard" data-card="' + esc(p.id) + '">' + inner + '</div>';
  return '<a class="alb-v2__postcard is-collected' + (gold ? ' is-gold' : '') + '" href="#/postcard/' + esc(p.id) + '" ' +
    'data-card="' + esc(p.id) + '"' + (gold ? ' data-gold' : '') + '>' + inner + '</a>';
}

/* 獎章精選卡：最近收下的那一枚放大，其餘排成一列小章＋「顯示全部」（→ /badges）。
   一枚都還沒收下時，放大的位置不拿還在路上的章充數（那一格的意思是「最近收下」），改成一個空的章位＋一句話。 */
const MEDAL_MINI = 5;
function albumV2MedalsHTML() {
  const list = badgeOrder();
  const bc = badgeCount();
  const top = list[0] && list[0].r.got ? list[0] : null;
  const rest = top ? list.slice(1) : list;
  const extra = rest.length - MEDAL_MINI;
  return '<section class="alb-v2__medals" aria-label="獎章">' +
    '<div class="alb-v2__section-head"><h2>獎章</h2><span data-stat="badges">' + bc.got + '/' + bc.total + '</span></div>' +
    (top
      ? '<a class="alb-v2__medal-top" href="#/badge/' + esc(top.b.id) + '" data-act="go-badge" data-badge="' + esc(top.b.id) + '">' +
          medalSVG(top.b, top.r.got) +
          '<strong>' + esc(top.r.name) + '</strong>' +
          '<small data-badge-when>' + esc(badgeWhen(top)) + '</small></a>'
      : '<div class="alb-v2__medal-top alb-v2__medal-top--empty" data-medal-empty>' +
          '<svg class="alb-hex alb-hex--empty" viewBox="0 0 100 100" aria-hidden="true"><path d="' + HEX_RIM + '"/></svg>' +
          '<strong>還沒有收下的獎章</strong>' +
          '<small>湊齊一組地方，就收下一枚</small></div>') +
    '<div class="alb-v2__medal-foot">' +
      '<span class="alb-v2__medal-row" aria-hidden="true">' + rest.slice(0, MEDAL_MINI).map(function (x) {
        return '<span class="alb-v2__medal-mini">' + medalSVG(x.b, x.r.got) + '</span>';
      }).join('') + '</span>' +
      '<a class="alb-v2__medal-all" href="#/badges" data-act="go-badges">' +
        (extra > 0 ? '<small>+' + extra + ' 枚</small>' : '') + '顯示全部</a>' +
    '</div>' +
  '</section>';
}

/* 今天的回顧有沒有看過：STATE.today 沒有日期，回顧結束時多記一個 date（'MM.DD'，同卡片日期）；
   日期不是今天的心情與照片不算今天的（昨天選的心情不能今天還掛在首頁）。 */
function todayLook() {
  const T = (STATE.all && STATE.all.today) || {};
  const isToday = !!T.done && T.date === APP.fmt.todayMMDD();
  const L = M().LOOKBACK || {};
  return {
    done: isToday,
    mood: isToday ? moodOf(T.mood) : null,
    photo: isToday && T.photo != null ? (L.photos || [])[T.photo] || null : null,
  };
}

/* 回顧一列三格：今天的回顧（只有你、沒有分享）、這一週、城市足跡。
   數字都現算：步數＝LOOKBACK、地方數＝weekStats、覆蓋率＝足跡同一個公式。 */
function albumV2LookHTML() {
  const t = todayLook();
  const L = M().LOOKBACK || {};
  const w = weekStats();
  const cov = fixedCoverage({ seen: footprintSeen().seen, fade: [] });
  const tile = function (o) {
    return '<a class="alb-v2__look-tile" href="' + o.href + '" data-act="' + o.act + '" data-look-tile="' + o.k + '">' +
      '<span class="alb-v2__look-top">' + o.top + '</span>' +
      '<strong>' + o.t + '</strong><small' + (o.attr || '') + '>' + o.s + '</small></a>';
  };
  const ic = function (name) { return '<span class="alb-v2__look-ic" data-icon="' + name + '"></span>'; };
  const todayTop = (t.photo ? '<span class="alb-v2__look-pic" data-art="' + esc(t.photo) + '" data-seed="2" data-look-photo></span>' : '') +
    (t.mood ? '<span class="alb-v2__look-ic" data-icon="' + t.mood.icon + '" data-mood-now="' + t.mood.k + '"></span>' :
      t.photo ? '' : ic('steps')) +
    '<span class="alb-v2__look-lock" data-icon="lock" role="img" aria-label="只有你看得到"></span>';
  return '<section class="alb-v2__look" data-look aria-label="回顧">' +
    tile({ k: 'journal', href: '#/lookback', act: 'go-lookback', top: todayTop, t: '今天的回顧',
           attr: ' data-look-today',
           s: t.done ? esc(t.mood ? t.mood.t : '看過了') : '走了 ' + APP.fmt.num(L.steps || 0) + ' 步' }) +
    tile({ k: 'week', href: '#/week', act: 'go-week', top: ic('route'), t: '這一週',
           s: '去了 <span class="num" data-look-week>' + w.now.places + '</span> 個地方' }) +
    tile({ k: 'footprint', href: '#/footprint', act: 'go-footprint', top: ic('place'), t: '城市足跡',
           s: '點亮 <span class="num" data-look-cov>' + cov + '</span>%' }) +
  '</section>';
}

function albumV2Render() {
  const cards = M().POSTCARDS || [];
  const got = cards.filter(function (p) { return STATE.has(p.id); });
  return '<div class="alb alb-v2 alb-v2--home"><div class="scroll alb-scroll alb-v2__scroll">' +
      '<header class="alb-v2__header"><span class="alb-v2__brand">yoxi 城事</span><h1>收藏</h1>' +
        '<p>走過的地方，都留在這裡。</p></header>' +
      '<a class="alb-v2__hero" href="#/postcards" data-act="go-postcards">' +
        '<div><span class="alb-v2__label">我的明信片</span><div class="alb-v2__hero-count">' +
          '<strong data-stat="cards">' + got.length + '</strong><span>／' + cards.length + ' 張</span></div>' +
          '<p>' + (got.length ? '一張卡，記下一個到過的地方。' : '到了一個地方，就收下一張。') + '</p>' +
          '<span class="alb-v2__hero-go">看全部<span class="arrow arrow--onred"></span></span></div>' +
        '<div class="alb-v2__stack" aria-hidden="true">' + recentCards(3).map(function (p, i) {
          const gold = goldCard(p.id);
          return '<span class="alb-v2__stack-art alb-v2__stack-art--' + i + (gold ? ' is-gold' : '') + '" data-card="' + esc(p.id) +
            '" data-art="' + esc(p.art) + '" data-seed="' + cardIdx(p) + '" data-card-art="' + esc(p.id) + '"' +
            (gold ? ' data-gold-aura' : '') + '>' +
            (isFresh(p) ? '<span class="postcard__new">新</span>' : '') + '</span>';
        }).join('') + '</div>' +
      '</a>' +
      '<div class="alb-v2__stats">' +
        '<div class="alb-v2__stat"><span>去過的地方</span><strong data-stat="places">' + visitedPlaces().length + '</strong><small>個地方</small></div>' +
        '<div class="alb-v2__stat"><span>留下的距離</span><strong data-stat="km">' + esc(STATE.all.km) + '</strong><small>公里</small></div>' +
      '</div>' +
      albumV2LookHTML() +
      albumV2MedalsHTML() +
    '</div></div>';
}

/* 舊連結的 ?tab=（每日回顧結束落在 ?tab=journal、舊的 pill 四段）：落在同一頁，把對應的那一塊捲進畫面、亮一下，
   再用 replaceQuery 把 ?tab 拿掉（不重畫、不多一筆歷史；切 tab 回來也不會又亮一次）。 */
const LAND = { journal: '[data-look-tile="journal"]', week: '[data-look-tile="week"]',
               badges: '.alb-v2__medals', cards: '.alb-v2__hero' };
function albumV2Mount(root, params, ctx) {
  /* 「新」只標一次；lastCard 留給每日回顧用（寫了 STATE 就 emit，契約 §3.3） */
  if (STATE.lastIsNew) APP.state.markLastSeen();
  const q = ctx && ctx.query;
  if (!q || !q.has('tab')) return;
  const el = LAND[q.get('tab')] ? root.querySelector(LAND[q.get('tab')]) : null;
  if (el) {
    el.classList.add('is-landed');
    if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }
  if (APP.nav.replaceQuery) APP.nav.replaceQuery('');
}

APP.view('album', {
  path: '/album',
  tab: 'album',
  root: true,
  status: 'dark',
  title: '收藏',
  render: albumV2Render,
  mount: albumV2Mount,
});

/* ================================================================ /postcards */

/* 明信片子頁：收下的（最近的在前）一段、還沒去的一段。
   收下的每一格連到明信片詳情（p19–p22 不屬於任何獎章、週回顧也不一定列到，這裡是唯一穩定的入口）。
   整片網格包在 data-gallery 裡：L1 的可按數把它算成一個（跟地圖上的景點不算一樣，是同一種東西排成一片）。 */
APP.view('postcards', {
  path: '/postcards',
  tab: 'album',
  status: 'dark',
  title: '明信片',
  render: function () {
    const cards = M().POSTCARDS || [];
    const got = recentCards(cards.length);
    const todo = cards.filter(function (p) { return !STATE.has(p.id); });
    const grid = function (list, gallery) {
      return '<div class="alb-v2__card-grid"' + (gallery ? ' data-gallery' : '') + '>' + list.map(albumV2CardHTML).join('') + '</div>';
    };
    return '<div class="alb alb-v2"><div class="scroll alb-scroll alb-v2__scroll">' +
      subHeader('明信片', '收集 <span data-stat="cards">' + got.length + '</span>/' + cards.length +
        ' 張。還沒去的地方，到了就會上色。') +
      (got.length
        ? '<section class="alb-v2__cards" data-group="got"><h2>收下的 ' + got.length + ' 張</h2>' + grid(got, true) + '</section>'
        : '') +
      (todo.length
        ? '<section class="alb-v2__cards" data-group="todo"><h2>還沒去的 ' + todo.length + ' 張</h2>' + grid(todo, false) + '</section>'
        : '') +
      '<p class="alb-foot alb-v2__note">明信片是 AI 依地點生成的示意圖，底圖是當地的實景照片（還沒生成好的先用濾鏡處理），' +
        '照片出處寫在每張明信片裡。沒有期限，也不用照順序。</p>' +
    '</div></div>';
  },
  mount: function (root, params, ctx) {
    if (STATE.lastIsNew) APP.state.markLastSeen();
    subMount(root, ctx, 'postcards');
  },
});

/* ================================================================ /badges */

/* 全部獎章：三欄章牆。收下的寫日期，還在路上的寫「收集 n/m」並上灰。 */
APP.view('badges', {
  path: '/badges',
  tab: 'album',
  status: 'dark',
  title: '獎章',
  render: function () {
    return '<div class="alb alb-v2"><div class="scroll alb-scroll alb-v2__scroll">' +
      subHeader('獎章', '湊齊一組地方，就收下一枚。沒有期限，也不會過期。') +
      '<div class="alb-v2__medal-grid">' + badgeOrder().map(function (x) {
        return '<a class="alb-v2__medal-cell' + (x.r.got ? '' : ' is-locked') + '" href="#/badge/' + esc(x.b.id) + '" data-badge="' + esc(x.b.id) + '">' +
          medalSVG(x.b, x.r.got) +
          '<strong>' + esc(x.r.name) + '</strong>' +
          '<small data-badge-when>' + esc(badgeWhen(x)) + '</small></a>';
      }).join('') + '</div>' +
    '</div></div>';
  },
  mount: function (root, params, ctx) { subMount(root, ctx, 'badges'); },
});

/* ================================================================ /postcard/:id */

APP.view('postcard', {
  path: '/postcard/:id',
  tab: 'album',
  status: 'light',
  title: function (p) { const c = cardById(p.id); return c ? c.name : '找不到這張'; },
  render: function (params) {
    const P = cardById(params.id);
    if (!P) {
      return notFound({ title: '明信片', back: '/postcards', eyebrow: '明信片',
                        t: '找不到這張', p: '這張明信片不在收藏裡。' });
    }
    const got = STATE.card(P.id);
    const i = cardIdx(P);
    const owner = badgeOfCard(P.id);
    const ownerHTML = owner ? (function () {
      const r = STATE.badge(owner.id);
      return '<a class="card alb-row" href="#/badge/' + esc(owner.id) + '" data-act="go-badge">' +
        '<span class="alb-row__medal">' + medalSVG(owner, r.got) + '</span>' +
        '<span class="u-fill"><span class="alb-row__t">〈' + esc(r.name) + '〉</span>' +
        '<span class="alb-row__s">' + badgeProg(r) + '</span></span><span class="arrow"></span></a>';
    })() : '<div class="card alb-row"><span class="u-fill"><span class="alb-row__t">還沒歸到任何一枚獎章</span>' +
           '<span class="alb-row__s">單獨收藏也算數</span></span></div>';

    if (!got) {
      const pid = visitKey(P.id);
      const canGo = !!APP.place(pid);
      /* 搭車抵達了、評分後直接回首頁的那一趟：這張卡就是它的限定版 → 回去解鎖的入口 */
      const pu = APP.ride.trip.pending();
      const pend = pu && pu.card === P.id ? pu : null;
      return header({ title: '明信片', back: '/postcards' }) +
        '<div class="scroll alb-scroll" style="background:var(--yoxi-mist)">' +
          '<div class="alb-big">' +
            '<div class="postcard postcard--locked alb-big__card" data-card="' + esc(P.id) + '">' +
              '<div data-art="' + esc(P.art) + '" data-seed="' + i + '" style="position:absolute;inset:0"></div>' +
              '<span class="ai-mark">AI 生成示意</span>' +
              '<span class="alb-cell__lock alb-cell__lock--big"><span data-icon="lock"></span></span>' +
              '<span class="postcard__foot"><span class="postcard__name">' + esc(P.name) + '</span></span>' +
            '</div>' +
          '</div>' +
          '<div class="alb-pad">' +
            '<h1 class="alb-h1">' + esc(P.name) + '</h1>' +
            '<p class="alb-sub" data-notyet>還沒去 · 到了就會上色</p>' +
            (pend
              ? '<a class="btn-primary alb-gap" href="' + pend.href + '" data-act="unlock-ride">' + (pend.limited ? '解鎖限定版' : '收下這張明信片') + '</a>'
              : '') +
            (canGo
              ? '<a class="' + (pend ? 'btn-ghost' : 'btn-primary') + ' alb-gap" href="#/place/' + esc(pid) + '" data-act="go-place">看看這個地方</a>'
              : '<button class="' + (pend ? 'btn-ghost' : 'btn-primary') + ' alb-gap" type="button" data-act="go-place" data-toast="這個地方的介紹還在寫">看看這個地方</button>') +
          '</div>' +
          '<div class="alb-pad">' + '<div class="sec"><h2 class="sec__t sec__t--sm">這張屬於</h2></div>' + ownerHTML + '</div>' +
        '</div>';
    }

    /* 搭車還是走路、金框、限定版都問 cardOrigin（限定版一定是金框，金框不一定是限定版）。
       框用 ::after 畫在插圖上面（album.css 的 .alb-big__card.postcard--gold）：chengshi.css 的 inset 陰影會被滿版插圖蓋住。 */
    const origin = APP.explore.cardOrigin(P.id);
    const ride = origin.by === 'ride';
    const limited = origin.limited;
    const gold = origin.gold;
    const pid = APP.footprintPlace(P.id);
    const pl = pid ? APP.place(pid) : APP.place(P.id);
    const dist = pl && pl.dist != null ? pl.dist : null;
    const how = ride
      ? (dist != null ? '搭 yoxi ' + APP.fmt.km(dist) + ' 公里' : '搭 yoxi 抵達')
      : (dist != null ? '走路 ' + APP.fmt.num(dist / 1000 * stepsPerKm()) + ' 步' : '走路抵達');
    const byText = ride ? '搭 yoxi 抵達' : '走路抵達';
    const date = YEAR() + '.' + got.date;

    return header({ title: '明信片', back: '/postcards', action: shareBtn() }) +
      '<div class="scroll alb-scroll" style="background:var(--yoxi-mist)">' +
        '<div class="alb-big">' +
          '<button class="postcard alb-big__card' + (gold ? ' postcard--gold' : '') + '" type="button" data-flip data-act="flip" ' +
            'data-card="' + esc(P.id) + '"' + (gold ? ' data-gold-aura' : '') + ' aria-label="翻面">' +
            '<div data-art="' + esc(P.art) + '" data-seed="' + i + '" data-card-art="' + esc(P.id) + '" style="position:absolute;inset:0"></div>' +
            '<span class="ai-mark">AI 生成示意</span>' +
            (limited ? '<span class="postcard__ribbon" data-ribbon="limited">yoxi 限定版</span>'
              : gold ? '<span class="postcard__ribbon" data-ribbon="gold">yoxi 金框</span>' : '') +
            '<span class="postcard__foot"><span class="postcard__name alb-big__name">' + esc(P.name) + '</span>' +
              '<span class="postcard__date">' + esc(date) + '</span></span>' +
            '<span class="postcard__back alb-big__back">' +
              '<b>' + esc(P.name) + '</b>' +
              '<small>' + esc(date) + ' · ' + byText + ' · 新竹</small>' +
              '<p>' + esc(storyOf(P.id)) + '</p>' +
              (got.note ? '<p class="alb-big__note">「' + esc(got.note) + '」</p>' : '') +
              '<span class="postcard__stamp">yoxi</span>' +
            '</span>' +
          '</button>' +
          '<p class="alb-hint">點一下翻到背面</p>' +
          photoCreditHTML(P.id) +
        '</div>' +
        '<div class="alb-pad">' +
          '<h1 class="alb-h1">' + esc(P.name) + '</h1>' +
          '<p class="alb-sub">' + esc(date) + ' · ' + byText + '</p>' +
        '</div>' +
        '<div class="alb-pad"><div class="card">' +
          '<div class="row-nav alb-fact"><span class="tile-icon tile-icon--sm"><span data-icon="steps"></span></span>' +
            '<span class="row-nav__body"><span class="row-nav__sub">怎麼到的</span>' +
            '<span class="row-nav__title" data-how>' + esc(how) + '</span></span></div>' +
          '<div class="row-nav alb-fact"><span class="tile-icon tile-icon--sm"><span data-icon="place"></span></span>' +
            '<span class="row-nav__body"><span class="row-nav__sub">地點</span>' +
            '<span class="row-nav__title">' + esc(pl && pl.area ? pl.area : '新竹') + '</span></span></div>' +
        '</div></div>' +
        '<div class="alb-pad">' + '<div class="sec"><h2 class="sec__t sec__t--sm">這張屬於</h2></div>' + ownerHTML + '</div>' +
        '<div class="alb-pad alb-pad--end">' +
          '<button class="btn-ghost" type="button" data-act="again">再去一次</button>' +
          '<div class="card card--pad alb-again u-hidden" data-again>' +
            '<div class="alb-again__k">這裡的另一面</div>' +
            '<p class="alb-again__t">' + esc(AGAIN[P.id] || '再走一次，光的角度會不一樣。') + '</p>' +
          '</div>' +
          '<p class="alb-foot">再去一次不會多一張明信片，只會多知道一件事。</p>' +
        '</div>' +
      '</div>';
  },
  mount: function (root, params, ctx) {
    subMount(root, ctx, 'postcard');
    const P = cardById(params.id);
    if (!P) return;
    const card = root.querySelector('[data-flip]');
    /* interact.js 在 document 上另有一個 [data-flip] 的委派（initFlip）；
       這裡自己翻、並擋掉冒泡，不然會翻兩次等於沒翻 */
    if (card) card.onclick = function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      card.classList.toggle('is-flipped');
    };
    const share = root.querySelector('[data-act="share"]');
    /* card：system 的「傳給家人」帶著它去 #/elder?card=<id>，長輩圖先用這一張 */
    if (share) share.onclick = function () { APP.ui.share({ title: '分享這張', kind: 'postcard', id: P.id, card: P.id }); };
    const again = root.querySelector('[data-act="again"]');
    if (again) again.onclick = function () {
      root.querySelector('[data-again]').classList.remove('u-hidden');
      again.classList.add('u-hidden');
    };
  },
});

/* ================================================================ /badge/:id */

APP.view('badge', {
  path: '/badge/:id',
  tab: 'album',
  status: 'light',
  title: function (p) {
    const b = (M().BADGES || []).filter(function (x) { return x.id === p.id; })[0];
    return b ? b.name : '找不到這枚';
  },
  render: function (params) {
    const B = (M().BADGES || []).filter(function (x) { return x.id === params.id; })[0];
    if (!B) {
      return notFound({ title: '獎章', back: '/badges', eyebrow: '獎章',
                        t: '找不到這枚', p: '這枚獎章不在收藏裡。' });
    }
    const r = STATE.badge(B.id);
    return header({ title: '獎章', back: '/badges' }) +
      '<div class="scroll alb-scroll" style="background:var(--yoxi-mist)">' +
        '<div class="alb-medal' + (r.got ? '' : ' is-locked') + '" data-got="' + (r.got ? '1' : '0') + '">' +
          '<div class="alb-medal__hex">' + medalSVG(B, r.got) + '</div>' +
          '<h1 class="alb-medal__name">〈' + esc(r.name) + '〉</h1>' +
          (r.got ? '<p class="alb-medal__award" data-award>' + esc(r.award) + '</p>'
                 : '<p class="alb-medal__wait">還在路上 · 沒有期限</p>') +
          '<p class="alb-medal__prog" data-prog>' + badgeProg(r) + '</p>' +
        '</div>' +
        '<div class="alb-pad alb-pad--end">' +
          '<div class="sec"><h2 class="sec__t sec__t--sm">由這幾張組成</h2></div>' +
          '<div class="card">' + r.ids.map(function (cid) {
            const P = cardById(cid);
            if (!P) return '';
            const has = STATE.has(cid);
            const gold = has && goldCard(cid);
            return '<a class="row-nav alb-member' + (has ? ' is-got' : '') + '" href="#/postcard/' + esc(cid) + '" data-member="' + esc(cid) + '">' +
              '<span class="alb-member__pic' + (has ? '' : ' postcard--locked') + (gold ? ' card-gold' : '') + '" data-art="' + esc(P.art) +
                '" data-seed="' + cardIdx(P) + '" data-card-art="' + esc(cid) + '"' + (gold ? ' data-gold-aura' : '') + '></span>' +
              '<span class="row-nav__body"><span class="row-nav__title">' + esc(P.name) + '</span>' +
              '<span class="row-nav__sub">' + (has ? '收過 · ' + esc(STATE.card(cid).date) : '還沒去') + '</span></span>' +
              (has ? '<span class="alb-member__check" data-icon="check"></span>' : '<span class="arrow"></span>') +
            '</a>';
          }).join('') + '</div>' +
        '</div>' +
      '</div>';
  },
  mount: function (root, params, ctx) { subMount(root, ctx, 'badge'); },
});

/* ================================================================ /footprint */

/* 以 hs-core（車站周圍 3×3 km）為主：舊城、十八尖山在框內；南寮、青草湖、竹中、內灣走不到，不硬擠進來 */
const FP_SPAN = 3200;

/* 你的城市顏色：每一個去過的地方（不重複）取它那張明信片的色票（MOCK.ART[art].sky 最深的一格），
   照第一次去的先後排；同一個顏色的地方越多，那一道越寬。一個地方都沒去過就沒有顏色。
   以前是寫死的 MOCK.CITY_COLORS：0 張卡也有六道，不是「由你去過的地方決定」。 */
function cityColors() {
  const ART = M().ART || {};
  const places = {};
  const bands = [];
  recentCards(M().POSTCARDS.length).reverse().forEach(function (p) {
    const k = visitKey(p.id);
    if (places[k]) return;
    places[k] = 1;
    const sky = (ART[p.art] || {}).sky || [];
    const c = sky[2] || sky[1] || sky[0];
    if (!c) return;
    const b = bands.filter(function (x) { return x.c === c; })[0];
    if (b) b.n++; else bands.push({ c: c, n: 1 });
  });
  return bands;
}

APP.view('footprint', {
  path: '/footprint',
  tab: 'album',
  status: 'dark',
  title: '城市足跡',
  render: function () {
    const bands = cityColors();
    return '<div class="alb-fp">' +
      '<div class="alb-fp__map" data-fp-map>' +
        '<a class="alb-fp__back" href="#" data-back="/album" aria-label="返回"><span data-icon="close"></span></a>' +
        '<span class="alb-fp__title">城市足跡</span>' +
      '</div>' +
      '<div class="alb-fp__sheet">' +
        '<div class="u-row alb-fp__row">' +
          '<span><span class="num alb-fp__cov"><span data-coverage>—</span>%</span>' +
          '<span class="alb-fp__covk">的新竹市區被你點亮了</span></span>' +
          '<span class="fogmap__legend">' +
            '<span class="fogmap__key"><i class="fogmap__swatch" style="background:var(--map-explored)"></i>去過</span>' +
            '<span class="fogmap__key"><i class="fogmap__swatch" style="background:var(--map-fog)"></i>還沒</span>' +
          '</span>' +
        '</div>' +
        '<div class="sec alb-fp__sec"><h2 class="sec__t sec__t--sm">你的城市顏色</h2>' +
          '<span class="sec__m">由你去過的地方決定</span></div>' +
        (bands.length
          ? '<div class="citycolor" data-citycolor>' + bands.map(function (b) {
              return '<span class="citycolor__band" data-n="' + b.n + '" style="background:' + esc(b.c) + ';flex-grow:' + b.n + '"></span>';
            }).join('') + '</div>' +
            '<p class="alb-foot">每一道顏色取自你收下的明信片。同一種風景去得越多，那一道越寬。</p>'
          : '<p class="alb-fp__nocolor" data-citycolor-empty>還沒有顏色。去過一個地方，這裡就多一道。</p>') +
      '</div>' +
    '</div>';
  },
  mount: function (root, params, ctx) {
    subMount(root, ctx, 'footprint');
    const host = root.querySelector('[data-fp-map]');
    const fs = footprintSeen();
    const fog = { seen: fs.seen, fade: [] };
    const m = APP.map.mount(host, {
      style: 'fog', center: 'station', spanM: FP_SPAN, spots: false, fog: fog, pan: true,
    });
    tintSeen(m, fog);
    /* 覆蓋率用固定範圍算（以車站為中心、FP_SPAN 見方），不看畫面大小：
       hsmap 的 coverage() 取樣的是可視範圍，版面一變數字就跟著變。算一次，這一頁的生命週期內不重算。 */
    const cov = fixedCoverage(fog);
    root.querySelector('[data-coverage]').textContent = String(cov);
    host.setAttribute('data-seen', fs.seen.join(','));
    host.setAttribute('data-missing', fs.missing.join(','));
    return function () { m.destroy(); };
  },
});

/* 固定範圍的覆蓋率：公尺座標、FP_SPAN × FP_SPAN、60×60 取樣格；
   門檻與 hsmap coverage() 相同（去過 R×0.78、變淡 R×0.6 算半格，R＝FP_SPAN×0.16） */
function fixedCoverage(fog) {
  const P = window.HSINCHU_PLACES || {};
  const c = P.station || { x: 0, y: 0 };
  const R = (fog.radiusM || FP_SPAN * 0.16);
  const at = function (id) { const g = P[id]; return g ? [g.x, g.y] : null; };
  const pts = (fog.seen || []).map(at).filter(Boolean);
  const fd = (fog.fade || []).map(at).filter(Boolean);
  let hit = 0, N = 0;
  for (let i = 0; i < 60; i++) for (let j = 0; j < 60; j++) {
    const X = c.x + ((i + 0.5) / 60 - 0.5) * FP_SPAN;
    const Y = c.y + ((j + 0.5) / 60 - 0.5) * FP_SPAN;
    N++;
    if (pts.some(function (p) { return Math.hypot(p[0] - X, p[1] - Y) < R * 0.78; })) hit++;
    else if (fd.some(function (p) { return Math.hypot(p[0] - X, p[1] - Y) < R * 0.6; })) hit += 0.5;
  }
  return Math.round(hit / N * 100);
}

/* hsmap 的 fog 只挖洞不上色：在霧那一層底下補一組柔邊奶油圓（同圓心、同半徑） */
function tintSeen(m, fog) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = m.svg;
  const fogRect = svg.querySelector('[data-layer="fog"]');
  if (!fogRect) return;
  const box = svg.getBoundingClientRect();
  const W = box.width || 390;
  const R = (fog.radiusM || FP_SPAN * 0.16) * (W / FP_SPAN);
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('data-layer', 'seenTint');
  const defs = document.createElementNS(NS, 'defs');
  const grad = document.createElementNS(NS, 'radialGradient');
  grad.setAttribute('id', 'albSeenTint');
  [['.5', '1'], ['1', '0']].forEach(function (st) {
    const s2 = document.createElementNS(NS, 'stop');
    s2.setAttribute('offset', st[0]);
    s2.setAttribute('stop-color', 'var(--yoxi-cream)');
    s2.setAttribute('stop-opacity', st[1]);
    grad.appendChild(s2);
  });
  defs.appendChild(grad);
  g.appendChild(defs);
  (fog.seen || []).forEach(function (id) {
    const p = m.handle.place(id);
    if (!p) return;
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', p.px.toFixed(1));
    c.setAttribute('cy', p.py.toFixed(1));
    c.setAttribute('r', R.toFixed(1));
    c.setAttribute('fill', 'url(#albSeenTint)');
    c.setAttribute('opacity', '.85');
    g.appendChild(c);
  });
  svg.insertBefore(g, fogRect);
}

/* ================================================================ /lookback */

/* 之字形：轉折點 3,000、5,000，之後每 5,000 步一折；最後一段照比例畫到今天的步數。
   drawn(v)＝走到 v 步時線畫到全長的幾成：數字往上跳時線頭跟著數字走，數到 3,000 剛好轉彎。 */
function zigzagGeom(steps) {
  const marks = [0, 3000, 5000];
  while (marks[marks.length - 1] < steps) marks.push(marks[marks.length - 1] + 5000);
  const X0 = 40, X1 = 252, Y0 = 272, DY = 66;
  const pts = [[X0, Y0]];
  const at = [0];
  const len = [];
  for (let i = 1; i < marks.length; i++) {
    const a = marks[i - 1], b = marks[i];
    const f = Math.max(0, Math.min(1, (steps - a) / (b - a)));
    const from = pts[pts.length - 1];
    const to = [from[0] + (((i % 2) ? X1 : X0) - from[0]) * f, from[1] - DY * f];
    pts.push(to);
    at.push(Math.min(steps, b));
    len.push(Math.hypot(to[0] - from[0], to[1] - from[1]));
    if (f < 1) break;
  }
  const total = len.reduce(function (s, x) { return s + x; }, 0) || 1;
  return {
    pts: pts, at: at,
    drawn: function (v) {
      let got = 0;
      for (let i = 1; i < at.length; i++) {
        if (v >= at[i]) { got += len[i - 1]; continue; }
        got += len[i - 1] * Math.max(0, (v - at[i - 1]) / (at[i] - at[i - 1]));
        break;
      }
      return Math.min(1, got / total);
    },
  };
}

/* 線上只放點不放字：地名擠進 15px 的圓只剩兩個字，最後一段短的時候點還會疊在一起。
   地名整串寫在步數底下（.alb-lb__route）。 */
function zigzag(G) {
  const d = G.pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(0) + ' ' + p[1].toFixed(0); }).join(' ');
  const n = G.pts.length - 1;
  return '<svg class="zigzag" viewBox="0 0 300 300" aria-hidden="true">' +
    '<path class="zigzag__path" pathLength="640" d="' + d + '"/>' +
    G.pts.slice(1).map(function (p, i) {
      const last = i === n - 1;
      const x = p[0].toFixed(0), y = p[1].toFixed(0);
      return '<g class="alb-zz__stop' + (last ? ' alb-zz__stop--last' : '') + '" data-zz-at="' + G.at[i + 1] + '">' +
        (last ? '<circle cx="' + x + '" cy="' + y + '" r="9" class="alb-zz__ping"/>' : '') +
        '<circle cx="' + x + '" cy="' + y + '" r="' + (last ? 9 : 5) + '" class="alb-zz__dot"/></g>';
    }).join('') +
  '</svg>';
}

/* 步數往上跳：刻意慢，這是回顧不是載入條（lookback.html 同速）。等幕 1 淡入一點再開始。 */
const LB_COUNT_MS = 2600;
const LB_COUNT_DELAY = 360;

APP.view('lookback', {
  path: '/lookback',
  tab: null,
  status: 'light',
  title: '今天的回顧',
  render: function () {
    const L = M().LOOKBACK;
    const A = STATE.all;
    /* 「今天多了一張」只說今天收的：lastCard 不會自己清掉，九月一日收的卡不能到二十五日還說是今天的 */
    const lastC = A.lastCard ? STATE.card(A.lastCard) : null;
    const last = lastC && lastC.date === APP.fmt.todayMMDD() ? cardById(A.lastCard) : null;
    let act2;
    if (last) {
      const owner = badgeOfCard(last.id);
      const r = owner ? STATE.badge(owner.id) : null;
      const gold = goldCard(last.id);
      act2 = '<div class="alb-lb__card"><div class="postcard' + (gold ? ' card-gold" data-gold-aura' : '"') + '>' +
          '<div data-art="' + esc(last.art) + '" data-seed="1" data-card-art="' + esc(last.id) + '" style="position:absolute;inset:0"></div>' +
          '<span class="ai-mark">AI 生成示意</span>' +
          '<span class="postcard__foot"><span class="postcard__name">' + esc(last.name) + '</span></span>' +
        '</div></div>' +
        '<h2 class="unlock__title alb-lb__t">今天多了一張</h2>' +
        (r ? '<p class="unlock__sub">〈' + esc(r.name) + '〉這枚獎章，' + badgeProg(r) + '</p>' : '');
    } else {
      act2 = '<div class="lookback__steps alb-lb__km"><span data-lb-km>' + esc(A.km) + '</span></div>' +
        '<div class="lookback__unit">公里 · 這個月移動的</div>' +
        '<h2 class="unlock__title alb-lb__t">今天沒有新的卡，路還是走了</h2>' +
        '<p class="unlock__sub">走過的路都還在。</p>';
    }
    return '<div class="lookback alb-lb" data-lb>' +
      '<div class="lookback__top"><span>' + esc(dateLabel()) + '</span>' +
        '<a class="alb-lb__exit" href="#" data-back="/album?tab=journal">先離開</a></div>' +
      '<div class="lookback__body">' +
        '<div class="lookback__act" data-lb-act="0">' +
          zigzag(zigzagGeom(L.steps)) +
          '<div class="lookback__steps" data-lb-steps>' + APP.fmt.num(L.steps) + '</div>' +
          '<div class="lookback__unit">步 · ' + esc(L.km) + ' 公里</div>' +
          ((L.places || []).length ? '<p class="alb-lb__route">經過 ' +
            L.places.map(function (p) { return '<span class="alb-lb__place">' + esc(p) + '</span>'; }).join('<span class="alb-lb__sep" aria-hidden="true"></span>') +
          '</p>' : '') +
        '</div>' +
        '<div class="lookback__act" data-lb-act="1">' + act2 + '</div>' +
        '<div class="lookback__act" data-lb-act="2">' +
          '<h2 class="unlock__title alb-lb__t">今天你拍了這些</h2>' +
          '<p class="unlock__sub alb-lb__sub">選一張放進今天的日誌，也可以跳過</p>' +
          '<div class="alb-lb__photos">' + (L.photos || []).map(function (a, i) {
            return '<button class="postcard alb-lb__photo" type="button" data-act="photo" data-photo="' + i + '" aria-label="第 ' + (i + 1) + ' 張">' +
              '<div data-art="' + esc(a) + '" data-seed="' + (i + 2) + '" style="position:absolute;inset:0"></div></button>';
          }).join('') + '</div>' +
          '<button class="btn-link alb-lb__skip" type="button" data-act="skip-photo">今天沒什麼想留的，跳過</button>' +
        '</div>' +
        '<div class="lookback__act" data-lb-act="3">' +
          '<h2 class="unlock__title alb-lb__t">今天的城市，感覺如何？</h2>' +
          '<div class="mood">' + MOODS.map(function (m) {
            return '<button class="mood__btn" type="button" data-act="mood" data-mood="' + m.k + '" aria-label="' + esc(m.t) + '">' +
              '<span data-icon="' + m.icon + '"></span></button>';
          }).join('') + '</div>' +
          '<p class="unlock__sub alb-lb__sub">只有你看得到。這一頁沒有分享。</p>' +
        '</div>' +
      '</div>' +
      '<div class="lookback__foot">' +
        '<button class="btn-primary alb-lb__next" type="button" data-act="next">下一步</button>' +
      '</div>' +
    '</div>';
  },
  mount: function (root) {
    const html = document.documentElement;
    const still = html.hasAttribute('data-still');
    const acts = root.querySelectorAll('[data-lb-act]');
    const next = root.querySelector('[data-act="next"]');
    let idx = 0;
    const T0 = STATE.all.today || {};
    let photo = T0.date === APP.fmt.todayMMDD() ? T0.photo : null;   /* 別天選的照片不帶進今天 */
    let timer = null;

    /* 幕 1：數字從 0 往上跳，線頭跟著數字畫、走到的點才冒出來；數完地名才淡入。
       HTML 本來就是終值（定格、減少動態效果、JS 停掉都停在完整畫面），這裡只負責從 0 演回終值。 */
    const lb = root.querySelector('[data-lb]');
    const L = M().LOOKBACK;
    const G = zigzagGeom(L.steps);
    const num = root.querySelector('[data-lb-steps]');
    const path = root.querySelector('.zigzag__path');
    const stops = root.querySelectorAll('[data-zz-at]');
    let raf = 0, landTimer = null;
    function paint(v) {
      num.textContent = APP.fmt.num(Math.round(v));
      path.style.strokeDashoffset = (640 * (1 - G.drawn(v))).toFixed(1);
      stops.forEach(function (s) { s.classList.toggle('is-hit', v >= Number(s.getAttribute('data-zz-at'))); });
    }
    function landCount() {
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(landTimer);
      raf = 0; landTimer = null;
      paint(L.steps);
      lb.removeAttribute('data-lb-run');
    }
    function runCount() {
      lb.setAttribute('data-lb-run', '');
      paint(0);
      const t0 = performance.now() + LB_COUNT_DELAY;
      const tick = function (now) {
        const p = Math.max(0, Math.min(1, (now - t0) / LB_COUNT_MS));
        if (p >= 1) { landCount(); return; }
        paint(L.steps * (1 - Math.pow(1 - p, 3)));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      /* 背景分頁、headless 的虛擬時間會停掉 rAF：時間到了不管畫到哪都落在終值 */
      landTimer = setTimeout(landCount, LB_COUNT_DELAY + LB_COUNT_MS + 200);
    }

    function show(i) {
      if (i !== 0 && lb.hasAttribute('data-lb-run')) landCount();
      idx = i;
      acts.forEach(function (a, n) { a.classList.toggle('is-on', n === i); });
      root.querySelector('[data-lb]').setAttribute('data-lb-at', String(i));
      /* 幕 3 自己有「跳過」；幕 4 可以先不選 */
      next.classList.toggle('u-hidden', i === 2);
      next.textContent = i === 3 ? '先不選' : '下一步';
      next.setAttribute('data-act', i === 3 ? 'no-mood' : 'next');
    }
    function finish(mood) {
      /* date：STATE.today 本身沒有日期；記下是哪一天看的，收藏首頁「今天的回顧」只認今天的心情與照片 */
      const day = APP.fmt.todayMMDD();
      const patch = { photo: photo, done: true, date: day };
      /* 「先不選」：今天稍早選過的心情留著；別天留下來的清掉，不然它會被當成今天的 */
      if (mood) patch.mood = mood;
      else if ((STATE.all.today || {}).date !== day) patch.mood = null;
      APP.state.setToday(patch);
      APP.nav.go('/album?tab=journal', { replace: true });
    }

    next.onclick = function () {
      if (idx === 3) { finish(null); return; }
      if (idx < 3) show(idx + 1);
    };
    root.querySelectorAll('[data-act="photo"]').forEach(function (b) {
      b.onclick = function () {
        photo = Number(b.getAttribute('data-photo'));
        root.querySelectorAll('[data-act="photo"]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
        show(3);
      };
    });
    root.querySelector('[data-act="skip-photo"]').onclick = function () { photo = null; show(3); };
    root.querySelectorAll('[data-act="mood"]').forEach(function (b) {
      b.onclick = function () {
        root.querySelectorAll('[data-act="mood"]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
        const k = b.getAttribute('data-mood');
        if (still || APP.reduceMotion()) finish(k);
        else { clearTimeout(timer); timer = setTimeout(function () { finish(k); }, 360); }
      };
    });

    /* 定格（縮圖）：全部到位，直接停在最後一幕 */
    show(still ? 3 : 0);
    if (!still && !APP.reduceMotion()) runCount();
    return function () { clearTimeout(timer); clearTimeout(landTimer); if (raf) cancelAnimationFrame(raf); };
  },
});

/* ================================================================ /week */

APP.view('week', {
  path: '/week',
  tab: 'album',
  status: 'light',
  title: '這一週',
  render: function () {
    const w = weekStats();
    const N = w.now, P = w.prev;
    const days = N.days.map(function (d, i) { return { now: d, prev: P.days[i] }; });
    const maxSteps = Math.max.apply(null, days.map(function (x) { return Math.max(x.now.steps, x.prev.steps); }).concat([1]));
    const wd = function (day) {
      return day >= 1 ? '日一二三四五六'.charAt(new Date(YEAR(), w.month - 1, day).getDay()) : '';
    };
    const cmp = function (k, label, fmtv) {
      const a = N[k], b = P[k];
      const mx = Math.max(a, b, 1);
      return '<div class="alb-cmp" data-cmp="' + k + '">' +
        '<div class="alb-cmp__k">' + label + '</div>' +
        '<div class="alb-cmp__bars">' +
          '<span class="alb-cmp__bar alb-cmp__bar--now" style="width:' + (a / mx * 100).toFixed(1) + '%"></span>' +
          '<span class="alb-cmp__bar alb-cmp__bar--prev" style="width:' + (b / mx * 100).toFixed(1) + '%"></span>' +
        '</div>' +
        '<div class="alb-cmp__v"><b class="num" data-now>' + fmtv(a) + '</b><small data-prev>' + fmtv(b) + '</small></div>' +
      '</div>';
    };
    const shown = N.cards.slice(-6);
    return header({ title: '這一週', back: '/album', action: shareBtn() }) +
      '<div class="scroll alb-scroll" style="background:var(--yoxi-mist)">' +
        '<p class="ai-note">明信片與插圖都是 AI 依地點生成的示意圖；明信片的底圖是實景照片，出處寫在每張明信片裡。</p>' +
        '<div class="alb-pad"><div class="card alb-cover">' +
          (shown.length
            ? '<div class="alb-cover__grid">' + shown.slice(-3).map(function (p) {
                return '<span class="alb-cover__cell" data-art="' + esc(p.art) + '" data-seed="' + cardIdx(p) + '" data-wide data-card-art="' + esc(p.id) + '"></span>';
              }).join('') + '</div>'
            : '') +
          '<div class="alb-cover__txt">' +
            '<div class="alb-cover__range">' + esc(mdLabel(w.month, N.from)) + ' – ' + esc(mdLabel(w.month, N.to)) + '</div>' +
            '<div class="alb-cover__t">這一週你去了 <span class="num" data-week-places>' + N.places + '</span> 個地方</div>' +
          '</div>' +
        '</div>' +
        /* 範圍之後才收的卡：不偷偷算進本週，照實說一句（見 weekStats） */
        (N.after.length
          ? '<p class="alb-foot" data-week-after>' + esc(mdLabel(w.month, N.to)) + '之後又收了 <span class="num">' +
              N.after.length + '</span> 張，還沒算進這一週。</p>'
          : '') +
        '</div>' +
        '<div class="alb-pad"><div class="card card--pad">' +
          '<div class="sec"><h2 class="sec__t sec__t--sm">跟上週比</h2>' +
            '<span class="sec__m">' + esc(mdLabel(w.month, P.from)) + ' – ' + esc(mdLabel(w.month, P.to)) + '</span></div>' +
          cmp('places', '地方', function (v) { return String(v); }) +
          cmp('km', '公里', function (v) { return String(v); }) +
          cmp('steps', '步數', function (v) { return APP.fmt.num(v); }) +
          '<div class="alb-days">' + days.map(function (x) {
            return '<span class="alb-days__col">' +
              '<span class="alb-days__pair">' +
                '<i class="alb-days__bar alb-days__bar--prev" style="height:' + (x.prev.steps / maxSteps * 100).toFixed(1) + '%"></i>' +
                '<i class="alb-days__bar alb-days__bar--now" style="height:' + (x.now.steps / maxSteps * 100).toFixed(1) + '%"></i>' +
              '</span><small>' + wd(x.now.day) + '</small></span>';
          }).join('') + '</div>' +
          '<div class="u-row u-gap4 alb-legend">' +
            '<span class="u-row"><i class="alb-legend__sw alb-legend__sw--now"></i>本週</span>' +
            '<span class="u-row"><i class="alb-legend__sw alb-legend__sw--prev"></i>上週</span>' +
          '</div>' +
        '</div></div>' +
        (shown.length
          ? '<div class="alb-pad"><div class="sec"><h2 class="sec__t sec__t--sm">這一週收的卡</h2></div>' +
            '<div class="hscroll alb-weekcards">' + shown.map(function (p) {
              const gold = goldCard(p.id);
              return '<a class="alb-weekcard" href="#/postcard/' + esc(p.id) + '" data-card="' + esc(p.id) + '">' +
                '<span class="alb-weekcard__pic' + (gold ? ' card-gold' : '') + '" data-art="' + esc(p.art) + '" data-seed="' + cardIdx(p) + '" data-wide data-card-art="' + esc(p.id) + '"' +
                  (gold ? ' data-gold-aura' : '') + '></span>' +
                '<span class="alb-weekcard__t">' + esc(p.name) + '</span></a>';
            }).join('') + '</div></div>'
          : '<div class="alb-pad"><p class="alb-foot">這一週還沒有新的卡，走過的路都算。</p></div>') +
        '<div class="alb-pad">' +
          '<a class="card alb-row" href="#/elder" data-act="go-elder">' +
            '<span class="tile-icon tile-icon--md"><span data-icon="elder"></span></span>' +
            '<span class="u-fill"><span class="alb-row__t">做一張圖傳給家人</span>' +
            '<span class="alb-row__s">同一批明信片，換成長輩圖的排版</span></span><span class="arrow"></span></a>' +
        '</div>' +
        '<div class="alb-pad alb-pad--end"><p class="privacy-note alb-left">' +
          '<span data-icon="lock" style="width:14px;height:14px"></span>' +
          '心情與日誌不會出現在這一頁，分享出去的只有去過的地方與走了多少。</p></div>' +
      '</div>';
  },
  mount: function (root, params, ctx) {
    subMount(root, ctx, 'week');
    const share = root.querySelector('[data-act="share"]');
    if (share) share.onclick = function () { APP.ui.share({ title: '分享這一週', kind: 'week' }); };
  },
});

/* ================================================================ /elder */

/* 最近收的 n 張：照收下的先後，最後收的排第一。收藏首頁的疊卡、/postcards、長輩圖的預設、城市顏色都用它。
   先後看 STATE.all.cards 的鍵順序：STATE.collect 每收一張就加在最後（'p11' 這種鍵照插入順序排，
   存進 localStorage 再讀回來也不變），demo 一開始的 8 張也是照日期寫的，所以不必另外記時間。
   以前先比日期（'MM.DD'）、同一天只把 lastCard 提前、其餘照 POSTCARDS 編號倒序：
   同一天連收三張，第二、三張會顛倒；跨年以後（01.05 < 09.20）新收的卡還會排到 demo 的舊卡後面。
   萬一有卡不在鍵順序裡（不會發生），退回比日期。 */
function recentCards(n) {
  const order = Object.keys((STATE.all && STATE.all.cards) || {});
  return M().POSTCARDS.filter(function (p) { return STATE.has(p.id); })
    .map(function (p) { return { p: p, o: order.indexOf(p.id), d: String(STATE.card(p.id).date) }; })
    .sort(function (a, b) { return (b.o - a.o) || (a.d < b.d ? 1 : a.d > b.d ? -1 : 0); })
    .slice(0, n)
    .map(function (x) { return x.p; });
}

/* 長輩圖用哪幾張：從明信片分享過來（?card=<id>，收過的）那一張排第一，其餘補最近的，共三張 */
function elderCards(ctx) {
  const want = ctx && ctx.query ? ctx.query.get('card') : null;
  const shared = want && STATE.has(want) ? cardById(want) : null;
  const recent = recentCards(3);
  if (!shared) return { cards: recent, shared: null };
  return { cards: [shared].concat(recent.filter(function (p) { return p !== shared; })).slice(0, 3), shared: shared };
}

APP.view('elder', {
  path: '/elder',
  tab: 'album',
  status: 'light',
  title: '做一張圖傳給家人',
  render: function (params, ctx) {
    const E = elderCards(ctx);
    const cards = E.cards;
    const first = cards[0];
    const caps = [APP.fmt.greet() + ' 平安喜樂', '身體健康 萬事如意', '我今天去走走了', '有空一起來'];
    const got = first ? STATE.card(first.id) : null;
    return header({ title: '傳給家人', back: '/week' }) +
      '<div class="scroll alb-scroll" style="background:var(--yoxi-mist)">' +
        (first ? '<p class="ai-note">明信片與插圖都是 AI 依地點生成的示意圖，不是實景照片。</p>' : '') +
        '<div class="alb-pad">' +
          '<div class="alb-elder" data-elder>' +
            '<div class="alb-elder__art" data-elder-art' + (first ? ' data-art="' + esc(first.art) + '" data-seed="' + cardIdx(first) + '" data-wide' : '') + '></div>' +
            '<div class="alb-elder__shade"></div>' +
            '<div class="alb-elder__cap">' +
              '<div class="alb-elder__big" data-elder-big>' + esc(caps[0]) + '</div>' +
              '<div class="alb-elder__small" data-elder-small>' +
                (first ? esc(YEAR() + '.' + got.date + ' · ' + first.name) : '新竹') + '</div>' +
            '</div>' +
            '<span class="alb-elder__sig">yoxi 城事</span>' +
          '</div>' +
          (first
            ? '<p class="alb-foot">用你去過的地方做的。圖是 AI 畫的，不是照片。</p>'
            : '<p class="alb-foot" data-elder-empty>還沒有去過的地方可以放進圖裡，先傳一句問候。收下第一張明信片之後，這裡就能換成那個地方。</p>') +
        '</div>' +
        '<div class="alb-pad"><div class="sec"><h2 class="sec__t sec__t--sm">換一句話</h2></div>' +
          '<div class="card">' + caps.map(function (c, i) {
            return '<button class="row-text alb-cap' + (i ? '' : ' is-on') + '" type="button" data-act="caption" data-cap-i="' + i + '">' + esc(c) + '</button>';
          }).join('') + '</div></div>' +
        (cards.length
          ? '<div class="alb-pad"><div class="sec"><h2 class="sec__t sec__t--sm">換一個地方</h2>' +
            '<span class="sec__m">' + (E.shared
              ? (cards.length > 1 ? '分享的這張＋最近 ' + (cards.length - 1) + ' 張' : '分享的這張')
              : '最近 ' + cards.length + ' 張') + '</span></div>' +
            '<div class="alb-elder__picks">' + cards.map(function (p, i) {
              return '<button class="alb-elder__pick' + (i ? '' : ' is-on') + '" type="button" data-act="pick-card" data-card="' + esc(p.id) + '">' +
                '<span class="alb-elder__pickart" data-art="' + esc(p.art) + '" data-seed="' + cardIdx(p) + '" data-wide></span>' +
                '<span class="alb-elder__pickt">' + esc(p.name) + '</span></button>';
            }).join('') + '</div></div>'
          : '') +
        '<div class="alb-pad alb-pad--end">' +
          '<button class="btn-primary" type="button" data-act="send-family">' +
            '<span class="ic-ondark" data-icon="share" style="width:20px;height:20px;display:block"></span>傳給家人</button>' +
          '<p class="alb-foot alb-center">只有你按下傳送才會送出。你的日誌不會給任何人看。</p>' +
        '</div>' +
      '</div>';
  },
  mount: function (root, params, ctx) {
    subMount(root, ctx, 'elder');
    const big = root.querySelector('[data-elder-big]');
    const small = root.querySelector('[data-elder-small]');
    const art = root.querySelector('[data-elder-art]');
    const caps = root.querySelectorAll('[data-act="caption"]');
    caps.forEach(function (b) {
      b.onclick = function () {
        big.textContent = b.textContent;
        caps.forEach(function (x) { x.classList.toggle('is-on', x === b); });
      };
    });
    const picks = root.querySelectorAll('[data-act="pick-card"]');
    picks.forEach(function (b) {
      b.onclick = function () {
        const p = cardById(b.getAttribute('data-card'));
        if (!p) return;
        art.innerHTML = SHELL.postcardArt(p.art, { seed: cardIdx(p), wide: true });
        small.textContent = YEAR() + '.' + STATE.card(p.id).date + ' · ' + p.name;
        picks.forEach(function (x) { x.classList.toggle('is-on', x === b); });
      };
    });
    root.querySelector('[data-act="send-family"]').onclick = function () { APP.ui.toast('已傳給家人（demo）'); };
  },
});

/* 給別的區塊／測試用 */
APP.album = { footprintSeen: footprintSeen, weekStats: weekStats,
              visitedPlaces: visitedPlaces, recentCards: recentCards, cityColors: cityColors,
              coverage: function () { return fixedCoverage({ seen: footprintSeen().seen, fade: [] }); } };

})();
