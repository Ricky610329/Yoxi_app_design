/* ==========================================================================
   遊喜樂 web app — album 區塊（收藏 tab）
   契約：app/ARCHITECTURE.md §0（S3 路線書架＋X4 勳章牆、隱私分軌、長輩圖是分享選項）、§3、§5、§8。

   這支註冊八個 view（/lookback 的回憶卡製作由 album-memory.js 註冊）：
     /album           收藏首頁（雙主頁版）。「我的明信片」主卡（張數＋最近收下的三張疊卡，最後收的在最上面，點了進 /postcards）、
                      三個數字入口（回憶卡張數 → /lookback、這一週里程 → /week、城市足跡覆蓋率 → /footprint）、
                      獎章精選卡（最近收下的一枚放大＋其餘一列小章＋「顯示全部」）。
                      390×844（含狀態列，桌機外框就是這個尺寸）一屏放得下、不用捲。
                      舊連結 ?tab=journal|week|badges|cards 落在同一頁：捲到對應的那一塊、亮一下，再把 ?tab 拿掉。
     /postcards       明信片子頁：收下的一段（最近的在前，每張連到詳情）、還沒去的一段，左上返回。
     /badges          全部獎章：三欄六角章牆，收下的寫日期、還在路上的寫「收集 n/m」。
     /postcard/:id    明信片詳情，點一下翻面看背面敘事。?v=<第幾次>：回訪收下的那一張（每一次來都收一張，底下一排「每一次來」）。
                      家人的回應（示意）由 album-family.js 的 APP.family.repliesHTML 畫。來源：postcard.html。
     /badge/:id       獎章詳情。來源：badge.html。
     /footprint       城市足跡：paper 真實路網，未訪底面灰色、已訪的非道路區域上品牌色；覆蓋率仍用固定範圍算。
     /week            週回顧（唯一可分享的匯總）。來源：week.html。
     /elder           長輩圖（?card=<明信片 id>：從哪一張分享過來，那一張排第一）。圖就是收下的那張明信片（畫風、金框、節日版）＋大字祝福。來源：elder.html。
   子頁的返回鍵都走 subMount（見「子頁的返回鍵」）：從上一層點進來就照歷史退一格，
   切 tab 停回來、重新整理、直接開網址就回邏輯上的上一層。

   刻意沒有的東西：
   - 連續天數、排名、限量、倒數、未讀數字；獎章的進度環與集點卡（X4 選了勳章牆）。
   - 獎章章面不刻年份：刻了像「年度限定」，跟「沒有期限、不會過期」相衝；也不拿文字當圖示，地標是線稿。
   - 明信片網格不逐張貼「AI 生成示意」（22 張會變成標籤牆），/postcards 底下一行講一次。
   - 回憶卡製作與保存沒有分享鍵（隱私分軌）；只有明信片、週回顧、長輩圖可以分享。
   - /album 不攤開明信片網格：L1 一屏一事、可按數 ≤ 12；網格在 /postcards（整片算一個可按的東西，見 harness 的 data-gallery）。
   - 相框與稱號：做過（/rewards），2026-09-27 使用者拿掉了——已經有獎章，再多一套收集的東西是重複的，收藏首頁也因此要捲。
   - 「yoxi 限定版」只給 APP.ride.limitedCard（搭 yoxi 去走不到的地方、+50 點）；其他金框卡寫「yoxi 金框」。
   - 金框卡不管在哪裡顯示（疊卡、/postcards、詳情、獎章的組成卡、週回顧）都是金框，畫框的那個元素標 data-gold-aura，
     金粉由 explore-gold.js 畫（契約 §7）；長輩圖整張就是那張明信片，金框卡的長輩圖也是金框、有金粉。
   - 城市足跡不寫「多久沒回去會變淡」：app 沒有記回訪，寫了就是假的。
   - 回憶卡的選地點、選心情、產生與保存規則都在 album-memory.js，這支只讀保存張數。
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
   金框＝搭 yoxi 抵達收下的那一款（款式規則在 explore-cards.js），契約：「金框的明信片在收藏裡也是金框」。
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
/* 明信片底圖照片的出處（作者、授權、來源連結）。明信片的卡面不論是生成的成品、還是照片＋濾鏡，
   都是從這張照片來的（CC 授權要署名），跟 /unlock 結果頁的那一行同一個來源（APP.explore.cardPhoto） */
function photoCreditHTML(cardId) {
  const ph = APP.explore && APP.explore.cardPhoto ? APP.explore.cardPhoto(cardId) : null;
  if (!ph) return '';
  return '<p class="alb-credit" data-credit>底圖照片 © ' + esc(ph.author || '') + ' · ' + esc(ph.licence || '') +
    (ph.source ? ' <a class="alb-credit__a" href="' + esc(ph.source) + '" target="_blank" rel="noopener" data-act="open-credit">出處</a>' : '') + '</p>';
}

/* 這一張的那一句（explore-verse.js 的 verseOf，跟 /unlock 翻開之後的是同一句）：接在標題底下。
   「為什麼是這一款」不再寫在明信片頁：畫風、金框、節日插畫、郵戳卡面上都看得到，規則在 /unlock 的面板與「?」 */
function verseHTML(cardId, origin) {
  const v = APP.explore && APP.explore.verseOf ? APP.explore.verseOf(cardId, origin) : null;
  if (!v) return '';
  return '<p class="alb-verse" data-verse>' +
    '<span class="alb-verse__t">' + esc(v.text) + '</span>' +
    (v.by ? '<span class="alb-verse__by">' + esc(v.by) + (v.title ? '〈' + esc(v.title) + '〉' : '') + '</span>' : '') +
  '</p>';
}

function storyOf(cardId) {
  if (STORY[cardId]) return STORY[cardId];
  const pid = APP.footprintPlace(cardId);
  const pl = pid ? APP.place(pid) : null;
  const past = pl && (pl.story || []).filter(function (s) { return s.label === '以前的它'; })[0];
  return past ? past.text : '在這裡停了一下。';
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
    for (let d = a; d <= b; d++) {
      const steps = d >= 1 ? (month[d - 1] || 0) : 0;
      days.push({ day: d, steps: steps, km: spk ? Math.round(steps / spk * 10) / 10 : 0 });
    }
    const steps = days.reduce(function (s, x) { return s + x.steps; }, 0);
    const cards = inKeys(mm * 100 + a, mm * 100 + b);
    /* 地方數跟收藏首頁同一個算法：同一個地方的兩張卡算一個 */
    const places = cards.map(function (p) { return visitKey(p.id); })
      .filter(function (k, i, arr) { return arr.indexOf(k) === i; }).length;
    return { from: a, to: b, days: days, steps: steps,
             km: Math.round(days.reduce(function (s, d) { return s + d.km; }, 0) * 10) / 10,
             cards: cards, places: places };
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
      （退回叫車、退回翻卡），所以直接換成邏輯上的上一層（replace，不多一筆歷史）；換上來的那一層再按返回也往上走。
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
  const times = got ? APP.explore.visits(p.id).length : 0;
  const inner =
    '<span class="alb-v2__art" data-art="' + esc(p.art) + '" data-seed="' + cardIdx(p) + '" data-card-art="' + esc(p.id) + '"' +
      (gold ? ' data-gold-aura' : '') + '>' +
      (fresh ? '<span class="postcard__new">新</span>' : '') + '</span>' +
    '<strong>' + esc(p.name) + '</strong>' +
    (got ? '<small>' + (fresh ? '新收下' : esc(got.date) + ' 收下') + (gold ? ' · 金框' : '') +
      (times > 1 ? ' · <span data-times>收過 ' + times + ' 張</span>' : '') + '</small>' : '');
  if (!got) return '<div class="alb-v2__postcard" data-card="' + esc(p.id) + '">' + inner + '</div>';
  return '<a class="alb-v2__postcard is-collected' + (gold ? ' is-gold' : '') + '" href="#/postcard/' + esc(p.id) + '" ' +
    'data-card="' + esc(p.id) + '"' + (gold ? ' data-gold' : '') + '>' + inner + '</a>';
}

/* 獎章精選卡：最近收下的那一枚放大，其餘排成一列小章＋「顯示全部」（→ /badges）。
   一枚都還沒收下時，放大的位置不拿還在路上的章充數。 */
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

/* 三個收藏入口先讀數字，再讀小標：回憶卡張數、這一週里程、城市足跡覆蓋率。 */
function albumV2LookHTML() {
  const today = (STATE.all && STATE.all.today) || {};
  const memories = Array.isArray(today.memoryCards) ? today.memoryCards.length : 0;
  const w = weekStats();
  const cov = fixedCoverage({ seen: footprintSeen().seen, fade: [] });
  const tile = function (o) {
    return '<a class="alb-v2__look-tile" href="' + o.href + '" data-act="' + o.act + '" data-look-tile="' + o.k + '">' +
      '<span class="alb-v2__look-value"><strong' + (o.attr || '') + '>' + o.n + '</strong><span>' + o.unit + '</span></span>' +
      '<span class="alb-v2__look-label">' + o.icon + '<span>' + o.t + '</span></span></a>';
  };
  const ic = function (name) { return '<span class="alb-v2__look-ic" data-icon="' + name + '"></span>'; };
  return '<section class="alb-v2__look" data-look aria-label="收藏摘要">' +
    tile({ k: 'journal', href: '#/lookback', act: 'go-lookback', icon: ic('postcard'), t: '回憶卡',
           attr: ' data-look-today', n: memories, unit: '張' }) +
    tile({ k: 'week', href: '#/week', act: 'go-week', icon: ic('share'), t: '一週回顧',
           attr: ' data-look-week', n: w.now.km, unit: '公里' }) +
    tile({ k: 'footprint', href: '#/footprint', act: 'go-footprint', icon: ic('viewMap'), t: '城市足跡',
           attr: ' data-look-cov', n: cov, unit: '%' }) +
  '</section>';
}

function albumV2Render() {
  const cards = M().POSTCARDS || [];
  const got = cards.filter(function (p) { return STATE.has(p.id); });
  /* 每去一次收一張：圖鑑算的是不同的明信片（got），回訪收下的另外寫一句 */
  const again = APP.explore.recentVisits().length - got.length;
  return '<div class="alb alb-v2 alb-v2--home"><div class="scroll alb-scroll alb-v2__scroll">' +
      '<header class="alb-v2__header"><span class="alb-v2__brand">遊喜樂</span><h1>收藏</h1>' +
        '<p>走過的地方，都留在這裡。</p></header>' +
      '<a class="alb-v2__hero" href="#/postcards" data-act="go-postcards">' +
        '<div><span class="alb-v2__label">我的明信片</span><div class="alb-v2__hero-count">' +
          '<strong data-stat="cards">' + got.length + '</strong><span>／' + cards.length + ' 張</span></div>' +
          '<p>' + (again > 0 ? '回訪又收了 <span class="num" data-stat="again">' + again + '</span> 張，每一次都留著。'
                   : got.length ? '一張卡，記下一個到過的地方。' : '到了一個地方，就收下一張。') + '</p>' +
          '<span class="alb-v2__hero-go">看全部<span class="arrow arrow--onred"></span></span></div>' +
        /* 最近收下的三張（回訪的也算：最新的那一張在最上面） */
        '<div class="alb-v2__stack" aria-hidden="true">' + APP.explore.recentVisits(3).map(function (x, i) {
          const p = cardById(x.card);
          const o = APP.explore.cardOrigin(x.card, x.v);
          const gold = !!(o && o.gold);
          return '<span class="alb-v2__stack-art alb-v2__stack-art--' + i + (gold ? ' is-gold' : '') + '" data-card="' + esc(p.id) +
            '" data-art="' + esc(p.art) + '" data-seed="' + cardIdx(p) + '" data-card-art="' + esc(p.id) + '"' +
            (x.v > 1 ? ' data-card-visit="' + x.v + '"' : '') + (gold ? ' data-gold-aura' : '') + '>' +
            (x.v === 1 && isFresh(p) ? '<span class="postcard__new">新</span>' : '') + '</span>';
        }).join('') + '</div>' +
      '</a>' +
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
  const look = root.querySelector('[data-look]');
  let observer = null;
  const fitMetrics = function () {
    if (!look) return;
    const values = Array.prototype.slice.call(look.querySelectorAll('.alb-v2__look-value'));
    if (!values.length) return;
    const tokens = getComputedStyle(document.documentElement);
    const max = parseFloat(tokens.getPropertyValue('--fs-display')) || 32;
    const min = parseFloat(tokens.getPropertyValue('--fs-sm')) || 14;
    look.style.setProperty('--alb-metric-size', max + 'px');
    let fit = max;
    values.forEach(function (value) {
      const num = value.querySelector('strong');
      const unit = value.querySelector(':scope > span');
      if (!num || !unit) return;
      const cs = getComputedStyle(value);
      const gap = parseFloat(cs.columnGap || cs.gap) || 0;
      const available = Math.max(1, value.clientWidth - unit.getBoundingClientRect().width - gap);
      const needed = Math.max(1, num.scrollWidth);
      fit = Math.min(fit, max * available / needed);
    });
    look.style.setProperty('--alb-metric-size', Math.max(min, Math.floor(fit * 10) / 10) + 'px');
  };
  fitMetrics();
  if (look && window.ResizeObserver) {
    observer = new ResizeObserver(fitMetrics);
    observer.observe(look);
  }
  const q = ctx && ctx.query;
  if (q && q.has('tab')) {
    const el = LAND[q.get('tab')] ? root.querySelector(LAND[q.get('tab')]) : null;
    if (el) {
      el.classList.add('is-landed');
      if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    }
    if (APP.nav.replaceQuery) APP.nav.replaceQuery('');
  }
  return function () { if (observer) observer.disconnect(); };
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

/* 網址上的 ?v=<第幾次>：有這一次才算，不然是第一次（圖鑑上的那一張） */
function visitOf(cardId, ctx) {
  const n = ctx && ctx.query ? Number(ctx.query.get('v')) : NaN;
  const list = APP.explore.visits(cardId);
  return n > 1 && list.some(function (x) { return x.v === n; }) ? n : 1;
}
/* 家人的回應（示意，album-family.js 畫）：沒有就不佔位 */
function repliesHTML(cardId, v) {
  const h = APP.family && APP.family.repliesHTML ? APP.family.repliesHTML(cardId, v) : '';
  return h ? '<div class="alb-pad">' + h + '</div>' : '';
}
/* 這個地方的每一次（收過兩張以上才有）：小卡一排，點了換成那一次。整排是一片（data-gallery，可按數算一個） */
function visitsStripHTML(P, v) {
  const list = APP.explore.visits(P.id);
  if (list.length < 2) return '';
  return '<div class="alb-pad"><div class="sec"><h2 class="sec__t sec__t--sm">每一次來</h2>' +
      '<span class="sec__m">收過 ' + list.length + ' 張</span></div>' +
    '<div class="alb-visits" data-gallery data-visits>' + list.map(function (x) {
      const o = APP.explore.cardOrigin(P.id, x.v);
      return '<a class="alb-visit' + (x.v === v ? ' is-on' : '') + '" href="#/postcard/' + esc(P.id) + (x.v > 1 ? '?v=' + x.v : '') + '"' +
          ' data-visit="' + x.v + '"' + (x.v === v ? ' aria-current="true"' : '') + '>' +
        '<span class="alb-visit__art' + (o.gold ? ' card-gold' : '') + '" data-art="' + esc(P.art) + '" data-seed="' + cardIdx(P) + '"' +
          ' data-card-art="' + esc(P.id) + '"' + (x.v > 1 ? ' data-card-visit="' + x.v + '"' : '') + (o.gold ? ' data-gold-aura' : '') + '></span>' +
        '<strong>' + (x.first ? '首訪' : '第 ' + x.v + ' 次') + '</strong><small>' + esc(o.date) + '</small></a>';
    }).join('') + '</div></div>';
}

APP.view('postcard', {
  path: '/postcard/:id',
  tab: 'album',
  status: 'light',
  title: function (p) { const c = cardById(p.id); return c ? c.name : '找不到這張'; },
  render: function (params, ctx) {
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
       ?v=<第幾次>：回訪收下的那一張（沒有這一次就看第一次）。
       框用 ::after 畫在插圖上面（album.css 的 .alb-big__card.postcard--gold）：chengshi.css 的 inset 陰影會被滿版插圖蓋住。 */
    const v = visitOf(P.id, ctx);
    const origin = APP.explore.cardOrigin(P.id, v);
    const ride = origin.by === 'ride';
    const limited = origin.limited;
    const gold = origin.gold;
    const pid = APP.footprintPlace(P.id);
    const pl = pid ? APP.place(pid) : APP.place(P.id);
    const dist = pl && pl.dist != null ? pl.dist : null;
    const how = ride
      ? (dist != null ? '搭 yoxi ' + APP.fmt.km(dist) + ' 公里' : '搭 yoxi 抵達')
      : (dist != null ? '移動 ' + APP.fmt.km(dist) + ' 公里' : '走路抵達');
    const byText = ride ? '搭 yoxi 抵達' : '走路抵達';
    const date = origin.dateText;
    const nth = origin.first ? '第一次來' : '第 ' + origin.v + ' 次來';
    const area = pl && pl.area ? pl.area : '新竹';

    return header({ title: '明信片', back: '/postcards', action: shareBtn() }) +
      '<div class="scroll alb-scroll" style="background:var(--yoxi-mist)">' +
        '<div class="alb-big">' +
          '<button class="postcard alb-big__card' + (gold ? ' postcard--gold' : '') + '" type="button" data-flip data-act="flip" ' +
            'data-card="' + esc(P.id) + '"' + (gold ? ' data-gold-aura' : '') + ' aria-label="翻面">' +
            '<div data-art="' + esc(P.art) + '" data-seed="' + i + '" data-card-art="' + esc(P.id) + '"' +
              (v > 1 ? ' data-card-visit="' + v + '"' : '') + ' style="position:absolute;inset:0"></div>' +
            '<span class="ai-mark">AI 生成示意</span>' +
            (limited ? '<span class="postcard__ribbon" data-ribbon="limited">yoxi 限定版</span>'
              : gold ? '<span class="postcard__ribbon" data-ribbon="gold">yoxi 金框</span>' : '') +
            origin.marks +
            '<span class="postcard__foot"><span class="postcard__name alb-big__name">' + esc(P.name) + '</span>' +
              '<span class="postcard__date">' + esc(date) + '</span></span>' +
            /* 背面照真的明信片排：左上地點、右上郵票蓋郵戳（郵戳是收下那天）、標題、一行日期、細線、那段話、右下落款 */
            '<span class="postcard__back alb-big__back">' +
              '<span class="alb-back__head">' +
                '<span class="alb-back__kicker">明信片 · ' + esc(area) + '</span>' +
                '<span class="alb-back__stamp" aria-hidden="true"><span>yoxi</span></span>' +
                '<span class="alb-back__mark" aria-hidden="true"><span>新竹</span><span>' + esc(origin.date) + '</span></span>' +
              '</span>' +
              '<b>' + esc(P.name) + '</b>' +
              '<small>' + esc(date) + ' · ' + byText + ' · ' + nth + '</small>' +
              '<p class="alb-back__story">' + esc(storyOf(P.id)) + '</p>' +
              (origin.note ? '<p class="alb-big__note">「' + esc(origin.note) + '」</p>' : '') +
              '<span class="alb-back__sign"><span class="alb-back__logo">yoxi</span> 城事</span>' +
            '</span>' +
          '</button>' +
          photoCreditHTML(P.id) +
        '</div>' +
        '<div class="alb-pad alb-lede">' +
          '<h1 class="alb-h1">' + esc(P.name) + '</h1>' +
          '<p class="alb-sub" data-visit-sub>' + esc(date) + ' · ' + byText + ' · ' + nth + '</p>' +
          verseHTML(P.id, origin) +
        '</div>' +
        visitsStripHTML(P, v) +
        repliesHTML(P.id, v) +
        '<div class="alb-pad"><div class="card">' +
          '<div class="row-nav alb-fact"><span class="tile-icon tile-icon--sm"><span data-icon="steps"></span></span>' +
            '<span class="row-nav__body"><span class="row-nav__sub">怎麼到的</span>' +
            '<span class="row-nav__title" data-how>' + esc(how) + '</span></span></div>' +
          '<div class="row-nav alb-fact"><span class="tile-icon tile-icon--sm"><span data-icon="place"></span></span>' +
            '<span class="row-nav__body"><span class="row-nav__sub">地點</span>' +
            '<span class="row-nav__title">' + esc(area) + '</span></span></div>' +
        '</div></div>' +
        '<div class="alb-pad alb-pad--end">' + '<div class="sec"><h2 class="sec__t sec__t--sm">這張屬於</h2></div>' + ownerHTML + '</div>' +
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
      /* 節日版的插畫：翻回正面再演一次 */
      if (!card.classList.contains('is-flipped')) APP.explore.festPlay(card);
    };
    /* 節日版的插畫（explore-fest.js）：打開明信片頁就動一次，五秒左右停下來 */
    if (card) APP.explore.festPlay(card);
    const share = root.querySelector('[data-act="share"]');
    /* card：system 的「傳給家人」帶著它去 #/elder?card=<id>，長輩圖先用這一張 */
    if (share) share.onclick = function () { APP.ui.share({ title: '分享這張', kind: 'postcard', id: P.id, card: P.id, v: visitOf(P.id, ctx) }); };
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
    return '<div class="alb-fp">' +
      '<div class="alb-fp__map" data-fp-map>' +
        '<a class="alb-fp__back" href="#" data-back="/album" aria-label="返回"><span data-icon="close"></span></a>' +
        '<span class="alb-fp__title">城市足跡</span>' +
      '</div>' +
      '<div class="alb-fp__sheet">' +
        '<div class="u-row alb-fp__row">' +
          '<span><span class="num alb-fp__cov"><span data-coverage>—</span>%</span>' +
          '<span class="alb-fp__covk">的市區足跡範圍</span></span>' +
          '<span class="fogmap__legend">' +
            '<span class="fogmap__key"><i class="fogmap__swatch" style="background:var(--map-explored)"></i>已訪區域</span>' +
            '<span class="fogmap__key"><i class="fogmap__swatch" style="background:var(--map-fog)"></i>未訪區域</span>' +
          '</span>' +
        '</div>' +
        '<p class="alb-fp__places"><strong>' + visitedPlaces().length + '</strong><span>個去過的地方</span></p>' +
      '</div>' +
    '</div>';
  },
  mount: function (root, params, ctx) {
    subMount(root, ctx, 'footprint');
    const host = root.querySelector('[data-fp-map]');
    const fs = footprintSeen();
    const fog = { seen: fs.seen, fade: [] };
    const m = APP.map.mount(host, {
      style: 'paper', center: 'station', spanM: FP_SPAN, spots: false, fog: false, pan: true,
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

/* paper 地圖保留真實幾何；已訪半徑以單一遮罩上色，河流、道路、鐵路留在色層上方。 */
function tintSeen(m, fog) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = m.svg;
  const seen = (fog.seen || []).map(function (id) { return m.handle.place(id); }).filter(Boolean);
  if (!seen.length) return;
  const radius = (fog.radiusM || FP_SPAN * 0.16) * (m.handle.width / FP_SPAN);
  const defs = document.createElementNS(NS, 'defs');
  const grad = document.createElementNS(NS, 'radialGradient');
  grad.setAttribute('id', 'albSeenAreaFade');
  [['0', '1'], ['.7', '1'], ['1', '0']].forEach(function (st) {
    const stop = document.createElementNS(NS, 'stop');
    stop.setAttribute('offset', st[0]);
    stop.setAttribute('stop-color', 'white');
    stop.setAttribute('stop-opacity', st[1]);
    grad.appendChild(stop);
  });
  defs.appendChild(grad);
  const mask = document.createElementNS(NS, 'mask');
  mask.setAttribute('id', 'albSeenAreaMask');
  const maskBase = document.createElementNS(NS, 'rect');
  maskBase.setAttribute('width', '100%');
  maskBase.setAttribute('height', '100%');
  maskBase.setAttribute('fill', 'black');
  mask.appendChild(maskBase);
  seen.forEach(function (p) {
    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', p.px.toFixed(1));
    circle.setAttribute('cy', p.py.toFixed(1));
    circle.setAttribute('r', radius.toFixed(1));
    circle.setAttribute('fill', 'url(#albSeenAreaFade)');
    mask.appendChild(circle);
  });
  defs.appendChild(mask);
  svg.appendChild(defs);
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('data-layer', 'seenArea');
  g.setAttribute('data-seen-count', String(seen.length));
  const area = document.createElementNS(NS, 'rect');
  area.setAttribute('class', 'alb-fp__seen-area');
  area.setAttribute('width', '100%');
  area.setAttribute('height', '100%');
  area.setAttribute('mask', 'url(#albSeenAreaMask)');
  g.appendChild(area);

  /* HSMAP 原順序把建物放在道路之後；足跡要讓整片非道路著色、道路維持留白，
     所以先把建物移到色層下，再讓水系、道路與鐵路照原資料蓋回上方。 */
  const building = svg.querySelector('[data-layer="building"]');
  const water = svg.querySelector('[data-layer="waterArea"], [data-layer="water"], [data-layer="coast"]');
  if (building && water) svg.insertBefore(building, water);
  svg.insertBefore(g, water || svg.querySelector('[data-layer="roadService"], [data-layer="roadMinor"], [data-layer="roadMajor"]') ||
    svg.querySelector('[data-layer="rail"]') || svg.querySelector('[data-layer="label"]'));
}

/* ================================================================ /week */

APP.view('week', {
  path: '/week',
  tab: 'album',
  status: 'light',
  title: '這一週',
  render: function () {
    const w = weekStats();
    const N = w.now;
    const maxKm = Math.max.apply(null, N.days.map(function (d) { return d.km; }).concat([1]));
    const shown = N.cards.slice(-6);
    return header({ title: '這一週', back: '/album', action: shareBtn() }) +
      '<div class="scroll alb-scroll" style="background:var(--yoxi-mist)">' +
        '<div class="alb-pad"><div class="card alb-week-summary">' +
          '<div class="alb-cover__range">' + esc(mdLabel(w.month, N.from)) + ' – ' + esc(mdLabel(w.month, N.to)) + '</div>' +
          '<p class="alb-week-summary__label">這一週的里程</p>' +
          '<div class="alb-week-summary__km"><strong class="num" data-week-km>' + N.km + '</strong><span>公里</span></div>' +
          '<div class="alb-distance-days" aria-label="七日里程">' + N.days.map(function (d) {
            return '<div class="alb-distance-days__col" data-day-km data-day="' + d.day + '" data-km="' + d.km + '" aria-label="' + esc(mdLabel(w.month, d.day)) + '，' + d.km.toFixed(1) + ' 公里">' +
              '<span class="num">' + d.km.toFixed(1) + '</span><div class="alb-distance-days__track"><i style="height:' + (d.km / maxKm * 100).toFixed(1) + '%"></i></div><small>' + d.day + '日</small></div>';
          }).join('') + '</div><p class="alb-foot">里程示意 · 單位：公里</p>' +
        '</div>' +
        /* 範圍之後才收的卡：不偷偷算進本週，照實說一句（見 weekStats） */
        (N.after.length
          ? '<p class="alb-foot" data-week-after>' + esc(mdLabel(w.month, N.to)) + '之後又收了 <span class="num">' +
              N.after.length + '</span> 張，還沒算進這一週。</p>'
          : '') +
        '</div>' +
        (shown.length
          ? '<div class="alb-pad"><div class="sec"><h2 class="sec__t sec__t--sm">這一週收的卡</h2><span class="sec__m"><span data-week-places>' + N.places + '</span> 個地方</span></div>' +
            '<div class="hscroll alb-weekcards">' + shown.map(function (p) {
              const gold = goldCard(p.id);
              return '<a class="alb-weekcard" href="#/postcard/' + esc(p.id) + '" data-card="' + esc(p.id) + '">' +
                '<span class="alb-weekcard__pic' + (gold ? ' card-gold' : '') + '" data-art="' + esc(p.art) + '" data-seed="' + cardIdx(p) + '" data-wide data-card-art="' + esc(p.id) + '"' +
                  (gold ? ' data-gold-aura' : '') + '></span>' +
                '<span class="alb-weekcard__t">' + esc(p.name) + '</span></a>';
            }).join('') + '</div></div>'
          : '<div class="alb-pad"><p class="alb-foot">這一週收卡的地方：<span data-week-places>' + N.places + '</span> 個。還沒有新的卡。</p></div>') +
        '<div class="alb-pad alb-pad--end"><p class="privacy-note alb-left">' +
          '<span data-icon="lock" style="width:14px;height:14px"></span>' +
          '分享只有地方與里程，心情留給自己。</p></div>' +
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

/* 長輩圖的那一張圖＝收下的那張明信片本身（跟明信片頁同一套）：成品或照片＋那一款的濾鏡（data-card-art）、
   金框與角標、節日版會動的插畫、遠行戳（cardOrigin().marks），再壓一句大字祝福。3:4，景色整張看得到。
   底下一條跟明信片的地名那一條一樣高（節日插畫的兔子、浪都對齊它）：日期與地點、底圖照片的署名、遊喜樂。
   這張圖會傳出去：一定帶「AI 生成示意」與底圖的作者、授權（CC 授權要署名）。還沒收過任何一張：只有祝福的字。 */
function elderImage(p, cap) {
  const big = '<div class="alb-elder__cap"><div class="alb-elder__big" data-elder-big>' + esc(cap) + '</div></div>';
  if (!p) {
    return '<div class="alb-elder alb-elder--empty" data-elder>' + big +
      '<div class="alb-elder__foot"><span class="alb-elder__small" data-elder-small>新竹</span><span class="alb-elder__sig">遊喜樂</span></div></div>';
  }
  const o = APP.explore.cardOrigin(p.id);
  const ph = APP.explore.cardPhoto ? APP.explore.cardPhoto(p.id) : null;
  return '<div class="alb-elder' + (o.gold ? ' is-gold' : '') + '" data-elder data-card="' + esc(p.id) + '"' + (o.gold ? ' data-gold-aura' : '') + '>' +
      '<div class="alb-elder__art" data-elder-art data-art="' + esc(p.art) + '" data-seed="' + cardIdx(p) + '" data-card-art="' + esc(p.id) + '"></div>' +
      '<span class="ai-mark">AI 生成示意</span>' +
      (o.limited ? '<span class="postcard__ribbon" data-ribbon="limited">yoxi 限定版</span>'
        : o.gold ? '<span class="postcard__ribbon" data-ribbon="gold">yoxi 金框</span>' : '') +
      o.marks +
      big +
      '<div class="alb-elder__foot">' +
        '<span class="alb-elder__small" data-elder-small>' + esc(YEAR() + '.' + o.date + ' · ' + p.name) + '</span>' +
        (ph ? '<span class="alb-elder__credit" data-elder-credit>底圖照片 © ' + esc(ph.author || '') + ' · ' + esc(ph.licence || '') + '</span>' : '') +
        '<span class="alb-elder__sig">遊喜樂</span>' +
      '</div>' +
    '</div>';
}
/* 選地方的小卡：也是收下的那一款（data-card-art；金框卡自己會補框），節日版在名字底下寫一個字 */
function elderPick(p, on) {
  const o = APP.explore.cardOrigin(p.id);
  return '<button class="alb-elder__pick' + (on ? ' is-on' : '') + '" type="button" data-act="pick-card" data-card="' + esc(p.id) + '">' +
    '<span class="alb-elder__pickart" data-art="' + esc(p.art) + '" data-seed="' + cardIdx(p) + '" data-card-art="' + esc(p.id) + '"></span>' +
    '<span class="alb-elder__pickt">' + esc(p.name) + '</span>' +
    (o && o.festival ? '<span class="alb-elder__pickf">' + esc(o.festival.name) + '版</span>' : '') +
  '</button>';
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
    return header({ title: '傳給家人', back: '/week' }) +
      '<div class="scroll alb-scroll" style="background:var(--yoxi-mist)">' +
        (first ? '<p class="ai-note">圖是 AI 依實景照片改作的示意圖，不是照片；底圖照片的作者與授權印在圖上。</p>' : '') +
        '<div class="alb-pad" data-elder-wrap>' +
          elderImage(first, caps[0]) +
          (first
            ? '<p class="alb-foot">用你收下的那張明信片做的：畫風、金框、節日版都跟著。</p>' + photoCreditHTML(first.id)
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
            '<div class="alb-elder__picks">' + cards.map(function (p, i) { return elderPick(p, !i); }).join('') + '</div></div>'
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
    const wrap = root.querySelector('[data-elder-wrap]');
    let cap = (root.querySelector('[data-elder-big]') || {}).textContent || '';
    /* 節日版的插畫：打開就動一次；換地方換成那一張，再動一次 */
    APP.explore.festPlay(wrap);
    const caps = root.querySelectorAll('[data-act="caption"]');
    caps.forEach(function (b) {
      b.onclick = function () {
        cap = b.textContent;
        root.querySelector('[data-elder-big]').textContent = cap;
        caps.forEach(function (x) { x.classList.toggle('is-on', x === b); });
      };
    });
    const picks = root.querySelectorAll('[data-act="pick-card"]');
    picks.forEach(function (b) {
      b.onclick = function () {
        const p = cardById(b.getAttribute('data-card'));
        if (!p) return;
        /* 整張圖換成那一張（卡面、金框、節日版、署名都跟著）；出處連結也換 */
        const old = wrap.querySelector('[data-elder]');
        old.insertAdjacentHTML('afterend', elderImage(p, cap));
        old.remove();
        const credit = wrap.querySelector('[data-credit]');
        if (credit) credit.outerHTML = photoCreditHTML(p.id);
        else wrap.insertAdjacentHTML('beforeend', photoCreditHTML(p.id));
        if (window.SHELL) SHELL.injectArt(wrap);
        APP.explore.festPlay(wrap);
        picks.forEach(function (x) { x.classList.toggle('is-on', x === b); });
      };
    });
    root.querySelector('[data-act="send-family"]').onclick = function () { APP.ui.toast('已傳給家人（demo）'); };
  },
});

/* 給別的區塊／測試用 */
APP.album = Object.assign(APP.album || {}, { footprintSeen: footprintSeen, weekStats: weekStats,
              visitedPlaces: visitedPlaces, recentCards: recentCards, cityColors: cityColors,
              coverage: function () { return fixedCoverage({ seen: footprintSeen().seen, fade: [] }); } });
/* album 的子檔（album-family.js）共用的零件。不可列舉：別的區塊不要依賴 */
Object.defineProperty(APP.album, '_', {
  enumerable: false,
  value: { subHeader: subHeader, subMount: subMount, cardById: cardById, cardIdx: cardIdx, header: header },
});

})();
