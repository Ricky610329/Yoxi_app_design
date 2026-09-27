/* ==========================================================================
   yoxi 城事 web app — explore 區塊：節日版明信片的插畫與動畫（不註冊畫面）
   契約：app/ARCHITECTURE.md §7。載入順序：explore-fx.js → 這支 → explore-cards.js（marksHTML 叫 festHTML）。

   回答什麼：節日那一週去的明信片，卡面多一層會動的節日插畫——
     春節  右側一串鞭炮，由下往上一顆一顆炸開，紅紙屑落在地上；
     端午  一艘龍舟在浪上載浮載沉，槳一起划；
     中秋  右上角一輪月亮，底下一隻玉兔來回跳；
     賞櫻  一棵櫻花樹從左上角伸進來，花瓣飄下來落在地上。
   提供（APP.explore）：
     festHTML(key)            插畫的 HTML（一層 .fest，蓋在卡面上、地名那一條底下；aria-hidden，意思由「為什麼是這一款」的字講）
     festPlay(root, opt)      讓 root 裡的插畫動起來：加 .is-live，CSS 動畫才開始。減少動態效果（APP.reduceMotion，含 ?still=1）不動；
                              opt.restart === false：已經在動的不重來（/unlock 翻開時先開始，收尾時補一次）
   比例（使用者的要求：動畫是輔助，景色不能被擋掉，也不能小到看不出來）：
     插畫只放在卡片四周——右上角的月亮、左上角伸進來的樹枝、右側的鞭炮、地名上方那一條的浪與龍舟、兔子；
     中間（左右 30%–70%、上下 35%–60%）不放東西，景色的主體留著。每一種的主角寬度至少是卡片的五分之一（tests/specs/explore.spec.js 量）。
     位置用卡片寬高的百分比，底下那一條用 px 對齊地名那一條（.postcard__foot 大約 62 px 高，/unlock 與明信片頁都一樣）。
   動多久：翻開或打開明信片頁之後動 5 秒左右就停在收尾的樣子（花瓣落地、鞭炮剩上半串、兔子坐下），不會一直動
     （WCAG 2.2.2：自己開始、超過 5 秒的動畫要能停；也省電）。明信片頁翻回正面會再演一次。
     減少動態效果時不動，直接是靜止的構圖（月亮、坐著的兔子、停在浪上的船、樹與飄在半空的花瓣、完整的一串鞭炮）。
   刻意沒有：canvas、外部圖檔與字型（全是 inline SVG，離線也畫得出來）、閃光（鞭炮的爆點很小，不閃整張）、
             會擋到操作的東西（pointer-events: none）。
   顏色全從 tokens（css/views/explore-fest.css），這裡的 SVG 只放形狀與 class。
   ========================================================================== */

(function () {
'use strict';

const APP = window.APP;
if (!APP) return;

let uid = 0;

/* style="--x:12px;--y:40px" 這種一次給好幾個 CSS 變數 */
function vars(o) {
  return Object.keys(o).map(function (k) { return '--' + k + ':' + o[k]; }).join(';');
}
function r1(n) { return Math.round(n * 10) / 10; }

/* ---------------------------------------------------------------- 中秋：月亮＋玉兔 */

const STAR = 'M0 -5 L1.3 -1.3 L5 0 L1.3 1.3 L0 5 L-1.3 1.3 L-5 0 L-1.3 -1.3 Z';

function moon(u) {
  const stars = [[12, 24, 1, 0], [106, 12, .8, .5], [22, 58, .65, 1.1], [112, 86, .75, .3], [4, 92, .55, .8]]
    .map(function (s) {
      return '<g transform="translate(' + s[0] + ' ' + s[1] + ') scale(' + s[2] + ')">' +
        '<path class="fm-star" style="' + vars({ d: s[3] + 's' }) + '" d="' + STAR + '"/></g>';
    }).join('');
  return '<span class="fest__sky" aria-hidden="true"></span>' +
    '<span class="fest__piece fest__moon" data-fest-part="moon">' +
      '<svg viewBox="0 0 120 110" focusable="false">' +
        '<defs><radialGradient id="' + u + 'g"><stop offset="0" class="fm-g0"/><stop offset=".45" class="fm-g1"/><stop offset="1" class="fm-g2"/></radialGradient></defs>' +
        '<circle class="fm-glow" cx="64" cy="52" r="50" fill="url(#' + u + 'g)"/>' +
        '<g class="fm-rise">' +
          '<circle class="fm-disc" cx="64" cy="52" r="29"/>' +
          '<circle class="fm-crater" cx="54" cy="44" r="5.6"/>' +
          '<circle class="fm-crater" cx="74" cy="62" r="4.6"/>' +
          '<circle class="fm-crater" cx="73" cy="41" r="3"/>' +
          '<circle class="fm-crater" cx="57" cy="65" r="2.4"/>' +
        '</g>' +
        stars +
        '<path class="fm-cloud" d="M20 84 q-9 0 -9 -7 q0 -7 9 -7 q3 -9 13 -9 q9 0 12 7 q4 -3 9 -1 q6 2 6 8 q6 0 6 5 q0 4 -6 4 Z"/>' +
      '</svg>' +
    '</span>' +
    '<span class="fest__piece fest__rabbit" data-fest-part="rabbit">' +
      '<span class="fr-walk">' +
        '<svg viewBox="0 0 72 58" focusable="false">' +
          '<ellipse class="fr-shadow" cx="40" cy="55" rx="19" ry="2.6"/>' +
          '<g class="fr-hop">' +
            '<ellipse class="fr-fur" cx="30" cy="12" rx="3.8" ry="12" transform="rotate(-14 30 12)"/>' +
            '<ellipse class="fr-ear" cx="30" cy="13" rx="1.7" ry="8.5" transform="rotate(-14 30 13)"/>' +
            '<ellipse class="fr-fur" cx="37" cy="13" rx="3.6" ry="11.5" transform="rotate(12 37 13)"/>' +
            '<ellipse class="fr-ear" cx="37" cy="14" rx="1.6" ry="8" transform="rotate(12 37 14)"/>' +
            '<ellipse class="fr-fur" cx="43" cy="39" rx="18" ry="13"/>' +
            '<circle class="fr-fur" cx="51" cy="41" r="11"/>' +
            '<circle class="fr-fur" cx="62" cy="35" r="4.6"/>' +
            '<circle class="fr-fur" cx="27" cy="29" r="10.5"/>' +
            '<ellipse class="fr-fur" cx="28" cy="49" rx="5.5" ry="3.2"/>' +
            '<ellipse class="fr-fur" cx="49" cy="52" rx="10" ry="3.2"/>' +
            '<circle class="fr-eye" cx="22.5" cy="27" r="1.9"/>' +
            '<circle class="fr-nose" cx="17" cy="31" r="1.3"/>' +
            '<circle class="fr-cheek" cx="23" cy="33" r="2.4"/>' +
          '</g>' +
        '</svg>' +
      '</span>' +
    '</span>';
}

/* ---------------------------------------------------------------- 端午：龍舟＋浪 */

/* 後面那層：平緩的浪（period 要能整除 300：svg 寬 600、往左移一半就接回原樣） */
function wave(y, amp, period) {
  let d = 'M0 ' + y + ' Q ' + (period / 4) + ' ' + (y - amp) + ' ' + (period / 2) + ' ' + y;
  for (let x = period; x <= 600; x += period / 2) d += ' T ' + x + ' ' + y;
  return d;
}
/* 前面那層：海水紋——一排圓弧的浪頭，每個浪頭裡捲一道白線 */
function scallop(y, w, h) {
  let d = 'M0 ' + y, curls = '';
  for (let x = 0; x < 600; x += w) {
    d += ' a ' + (w / 2) + ' ' + h + ' 0 0 1 ' + w + ' 0';
    curls += 'M' + r1(x + w * .22) + ' ' + r1(y - h * .1) + ' q ' + r1(w * .2) + ' ' + r1(-h * .9) + ' ' + r1(w * .46) + ' ' + r1(-h * .35) + ' ';
  }
  return { d: d, curls: curls };
}

/* 一個划手：身體往船頭傾、頭帶、槳（槳與手臂繞著肩膀轉） */
function rower(x, i) {
  return '<path class="fb-body" d="M' + x + ' 63 L' + (x + 3) + ' 50"/>' +
    '<circle class="fb-face" cx="' + (x + 4) + '" cy="44.5" r="4.6"/>' +
    '<path class="fb-hair" d="M' + (x - .6) + ' 44.5 a 4.6 4.6 0 0 1 9.2 0 Z"/>' +
    '<path class="fb-band" d="M' + (x - .4) + ' 43.2 h 9 M' + (x - .4) + ' 43.2 l -3.4 2.2"/>' +
    '<g class="fb-paddle" style="' + vars({ o: (x + 2) + 'px 52px', d: r1(i * .07) + 's' }) + '">' +
      '<path class="fb-arm" d="M' + (x + 2) + ' 52 L' + (x - 3) + ' 60"/>' +
      '<line class="fb-shaft" x1="' + (x - 1) + '" y1="53" x2="' + (x - 12) + '" y2="86"/>' +
      '<ellipse class="fb-blade" cx="' + (x - 12) + '" cy="86" rx="2.8" ry="5.4" transform="rotate(18 ' + (x - 12) + ' 86)"/>' +
    '</g>';
}

function duanwu() {
  const back = wave(22, 6, 100);
  const front = scallop(28, 30, 6);
  const rowers = [74, 92, 110, 128, 146, 164].map(rower).join('');
  return '<span class="fest__piece fest__waves fest__waves--back" aria-hidden="true">' +
      '<svg viewBox="0 0 600 90" preserveAspectRatio="none" focusable="false"><path class="fw-back" d="' + back + ' V 90 H 0 Z"/></svg>' +
    '</span>' +
    '<span class="fest__piece fest__boat" data-fest-part="boat">' +
      '<svg viewBox="0 0 250 96" focusable="false">' +
        '<g class="fb-bob">' +
          /* 船尾：燕尾旗、掌舵的人與長槳 */
          '<line class="fb-pole" x1="36" y1="62" x2="36" y2="10"/>' +
          '<path class="fb-flag" d="M36 10 L60 14 L53 19 L61 24 L36 28 Z"/>' +
          '<path class="fb-body" d="M48 63 L48 48"/>' +
          '<circle class="fb-face" cx="48" cy="42.5" r="4.6"/><path class="fb-hair" d="M43.4 42.5 a 4.6 4.6 0 0 1 9.2 0 Z"/>' +
          '<line class="fb-shaft" x1="50" y1="50" x2="28" y2="90"/>' +
          /* 龍尾：往上捲，尾端一簇金色的鰭 */
          '<path class="fb-tail" d="M22 54 C10 46 7 31 15 23 C21 17 30 20 28 28 C26 33 20 31 21 27"/>' +
          '<path class="fb-fin" d="M15 23 C9 15 13 6 21 3 C19 10 23 13 27 15 C22 15 18 18 15 23 Z"/>' +
          rowers +
          /* 鼓手面向划手，打鼓 */
          '<path class="fb-body" d="M190 63 L187 50"/>' +
          '<circle class="fb-face" cx="186" cy="44.5" r="4.6"/><path class="fb-hair" d="M181.4 44.5 a 4.6 4.6 0 0 1 9.2 0 Z"/>' +
          '<rect class="fb-drum" x="193" y="49" width="15" height="12" rx="2"/>' +
          '<ellipse class="fb-drum-top" cx="200.5" cy="49" rx="7.5" ry="2.6"/>' +
          '<line class="fb-stick" style="' + vars({ o: '189px 52px' }) + '" x1="189" y1="52" x2="197" y2="44"/>' +
          /* 船身：上面一道金邊、一排龍鱗，下半截深一點 */
          '<path class="fb-hull" d="M20 52 C30 62 46 64 62 64 L184 64 C200 64 210 60 218 54 C214 68 202 80 180 80 L78 80 C52 80 32 72 20 52 Z"/>' +
          '<path class="fb-keel" d="M40 72 C54 77 66 78 78 78 L180 78 C194 78 204 74 210 66 C204 76 194 80 180 80 L78 80 C60 80 48 77 40 72 Z"/>' +
          '<path class="fb-rim" d="M22 54 C32 63 46 65.5 62 65.5 L184 65.5 C200 65.5 210 61.5 217 56"/>' +
          '<path class="fb-scale" d="' + (function () {
            let d = '';
            for (let x = 64; x < 184; x += 10) d += 'M' + x + ' 69 q 5 5 10 0 ';
            return d;
          })() + '"/>' +
          /* 龍頭：S 形的脖子、張開的嘴、金角、鬃毛、鬍鬚 */
          '<path class="fb-neck" d="M212 58 C226 50 216 38 224 27"/>' +
          '<path class="fb-spine" d="M216 56 C228 48 219 37 226 28"/>' +
          '<path class="fb-mane" d="M217 21 C209 19 207 26 212 29 C207 30 206 36 212 37 C207 39 208 45 214 45"/>' +
          '<path class="fb-dragon" d="M216 26 C212 14 221 6 231 8 C236 9 240 12 243 16 L235 19.5 L242 21.5 L239 27 C231 31 221 31 216 26 Z"/>' +
          '<path class="fb-teeth" d="M234 19.6 l1.4 2 l1.4 -1.6 M236 22 l1.2 -1.6 l1.2 1.8"/>' +
          '<path class="fb-horn" d="M221 10 C217 4 213 3 209 4 M225 9 C223 3 220 0 216 0"/>' +
          '<path class="fb-brow" d="M223 12.5 q 4 -3 8 -1"/>' +
          '<circle class="fb-eye" cx="227" cy="15.5" r="2.9"/><circle class="fb-pupil" cx="227.8" cy="15.5" r="1.4"/>' +
          '<path class="fb-whisker" d="M241 23 C247 25 249 31 245 35 M237 27 C241 31 239 37 235 39"/>' +
          /* 船頭濺起的水花 */
          '<g class="fb-spray"><circle cx="222" cy="72" r="2.2"/><circle cx="228" cy="66" r="1.6"/><circle cx="232" cy="72" r="1.3"/><circle cx="226" cy="60" r="1.1"/></g>' +
        '</g>' +
      '</svg>' +
    '</span>' +
    '<span class="fest__piece fest__waves fest__waves--front" data-fest-part="waves">' +
      '<svg viewBox="0 0 600 90" preserveAspectRatio="none" focusable="false">' +
        '<path class="fw-front" d="' + front.d + ' V 90 H 0 Z"/><path class="fw-foam" d="' + front.d + '"/>' +
        '<path class="fw-curl" d="' + front.curls + '"/>' +
      '</svg>' +
    '</span>';
}

/* ---------------------------------------------------------------- 賞櫻：櫻花樹＋落花 */

/* 樹冠：一叢一叢的花（中心 x、y、半徑）。每一叢用小圓疊出不規則的輪廓，再撒幾朵五瓣的花 */
const CLUMPS = [
  [96, 46, 22], [124, 36, 19], [152, 28, 17], [172, 42, 12], [68, 60, 19], [44, 28, 18], [20, 14, 15],
  [132, 74, 17], [108, 88, 15], [158, 64, 14], [76, 92, 13], [112, 18, 14], [84, 28, 14], [140, 52, 13],
  [60, 38, 12], [30, 46, 12], [172, 20, 10], [92, 68, 13], [120, 58, 12], [48, 76, 11], [6, 30, 10], [144, 90, 10],
];
/* 固定種子的亂數：每次畫出來一樣（縮圖、測試都穩定） */
function seeded(n) {
  let x = n;
  return function () { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
}
/* 花瓣：起點在樹冠（x、y），往右下飄（dx），落在地名那一條上面（gy），轉 r 度；d 延遲、t 時長 */
const PETALS = [
  [40, 40, 70, 302, 380, 0, 4.2, 1.5], [90, 60, 90, 308, 460, .3, 4.6, 1.3], [130, 40, 60, 300, 300, .6, 4.0, 1.6],
  [60, 90, 110, 312, 520, .15, 4.8, 1.2], [150, 70, 80, 306, 340, .9, 3.8, 1.4], [20, 20, 120, 298, 420, .45, 4.4, 1.7],
  [110, 100, 70, 314, 280, 1.1, 3.6, 1.3], [170, 40, 50, 304, 360, .7, 4.1, 1.2], [75, 30, 140, 310, 500, 1.0, 4.3, 1.5],
  [140, 95, 100, 300, 320, .2, 3.9, 1.4], [30, 70, 150, 306, 440, .55, 4.7, 1.3], [100, 20, 130, 316, 400, .85, 4.2, 1.6],
  [55, 110, 90, 302, 260, 1.2, 3.7, 1.2], [160, 100, 70, 310, 380, .35, 4.0, 1.5],
];

function sakura(u) {
  const f = u + 'f';
  /* 一朵：五片前端有缺口的花瓣＋花心 */
  const flower = '<symbol id="' + f + '" viewBox="-10 -10 20 20">' +
    [0, 72, 144, 216, 288].map(function (a) {
      return '<path class="ft-petal" d="M0 -1 C-3.4 -3 -4 -7.4 -1.4 -8.8 L0 -7.3 L1.4 -8.8 C4 -7.4 3.4 -3 0 -1 Z" transform="rotate(' + a + ')"/>';
    }).join('') +
    '<circle class="ft-heart" r="1.7"/></symbol>';
  const rnd = seeded(7);
  let puffs = '', flowers = '';
  CLUMPS.forEach(function (c) {
    const n = 14;
    for (let i = 0; i < n; i++) {
      const ang = i * 2.4 + rnd(), dist = c[2] * Math.sqrt((i + .5) / n) * .8;
      puffs += '<circle class="ft-puff ft-puff--' + (i % 3) + '" cx="' + r1(c[0] + Math.cos(ang) * dist) + '" cy="' + r1(c[1] + Math.sin(ang) * dist) +
        '" r="' + r1(c[2] * (.34 + rnd() * .16)) + '"/>';
    }
    for (let i = 0; i < 5; i++) {
      const size = r1(c[2] * (.5 + rnd() * .25));
      const x = r1(c[0] + (rnd() - .5) * c[2] * 1.2), y = r1(c[1] + (rnd() - .5) * c[2] * 1.1);
      flowers += '<use href="#' + f + '" x="' + r1(x - size / 2) + '" y="' + r1(y - size / 2) + '" width="' + size + '" height="' + size + '"' +
        ' transform="rotate(' + Math.round(rnd() * 72) + ' ' + x + ' ' + y + ')"/>';
    }
  });
  const petals = PETALS.map(function (p) {
    return '<g class="fp" style="' + vars({ x: p[0] + 'px', y: p[1] + 'px', dx: p[2] + 'px', gy: p[3] + 'px', r: p[4] + 'deg',
      d: p[5] + 's', t: p[6] + 's', s: p[7] }) + '"><path class="fp-shape" d="M0 -4.5 C3.5 -5 5.5 -1 0 5 C-5.5 -1 -3.5 -5 0 -4.5 Z"/></g>';
  }).join('');
  return '<span class="fest__piece fest__tree" data-fest-part="tree">' +
      '<svg viewBox="0 0 180 170" focusable="false"><defs>' + flower + '</defs>' +
        '<g class="ft-sway">' +
          '<path class="ft-wood ft-wood--trunk" d="M-12 168 C16 152 34 128 44 100 C52 78 66 62 92 50"/>' +
          '<path class="ft-wood ft-wood--b" d="M44 102 C70 96 100 92 128 76"/>' +
          '<path class="ft-wood ft-wood--b" d="M88 52 C110 40 134 34 168 30"/>' +
          '<path class="ft-wood ft-wood--b" d="M60 72 C58 48 48 30 30 14"/>' +
          '<path class="ft-wood ft-wood--t" d="M128 77 C140 72 150 68 162 70 M40 26 C30 20 20 16 4 16 M104 44 C108 30 118 20 130 12"/>' +
          puffs + flowers +
        '</g>' +
      '</svg>' +
    '</span>' +
    '<span class="fest__piece fest__fall" data-fest-fx="petals">' +
      '<svg viewBox="0 0 300 400" focusable="false">' + petals + '</svg>' +
    '</span>';
}

/* ---------------------------------------------------------------- 春節：一串鞭炮 */

const CRACKERS = 9;            /* 一串幾顆（串長到卡片高的六成左右，停在地名那一條上面） */
const POPS = [.4, 1.2, 2.0, 2.8, 3.6];   /* 最下面五顆由下往上炸開的時間（秒） */
/* 鞭炮串在卡片上的位置（跟 explore-fest.css 的 .fest__string 一致）：右 3%、寬 22%、上 10%；
   紙屑那一層是整張卡（300×400），要把串上的座標換過去 */
const STRING = { right: .03, width: .22, top: .10, vbW: 60 };

function spring() {
  let crackers = '', bursts = '', bits = '';
  const k = STRING.width * 300 / STRING.vbW;               /* 串的 1 單位＝卡片的幾單位 */
  const left = (1 - STRING.right - STRING.width) * 300, top = STRING.top * 400;
  for (let i = 0; i < CRACKERS; i++) {
    const y = 30 + i * 21;
    const a = i % 2 ? -38 : 38;
    const pop = CRACKERS - 1 - i;                           /* 最下面那顆是 0 */
    const d = pop < POPS.length ? POPS[pop] : null;
    crackers += '<g transform="translate(30 ' + y + ') rotate(' + a + ')">' +
      '<g class="fc' + (d != null ? ' fc-pop' : '') + '"' + (d != null ? ' style="' + vars({ d: d + 's' }) + '"' : '') + '>' +
        '<rect class="fc-body" x="-6" y="0" width="12" height="24" rx="2.8"/>' +
        '<rect class="fc-band" x="-6" y="2.5" width="12" height="2.6"/>' +
        '<rect class="fc-band" x="-6" y="18.5" width="12" height="2.6"/>' +
        '<rect class="fc-shine" x="-3.8" y="5.5" width="1.8" height="12" rx=".9"/>' +
      '</g></g>';
    if (d == null) continue;
    /* 這一顆的中心：從掛點沿著轉過的方向往下 12 */
    const rad = a * Math.PI / 180;
    const cx = r1(30 - 12 * Math.sin(rad)), cy = r1(y + 12 * Math.cos(rad));
    bursts += '<g transform="translate(' + cx + ' ' + cy + ')">' +
      '<circle class="fc-smoke" style="' + vars({ d: (d + .3) + 's' }) + '" r="10"/>' +
      '<g class="fc-burst" style="' + vars({ d: (d + .22) + 's' }) + '">' +
      [0, 45, 90, 135, 180, 225, 270, 315].map(function (g) {
        return '<line class="fc-ray" x1="0" y1="-6" x2="0" y2="-22" transform="rotate(' + g + ')"/>' +
          '<line class="fc-ray2" x1="0" y1="-8" x2="0" y2="-15" transform="rotate(' + (g + 22.5) + ')"/>';
      }).join('') +
      '<circle class="fc-core" r="7"/></g></g>';
    /* 紙屑：從這一顆的位置噴出來，落在地名那一條上面 */
    const ox = r1(left + cx * k), oy = r1(top + cy * k);
    for (let j = 0; j < 5; j++) {
      const dx = [-70, -40, -18, 8, 26][j] + pop * 6;
      bits += '<g class="fc-bit' + (j % 2 ? ' fc-bit--gold' : '') + '" style="' + vars({
        x: ox + 'px', y: oy + 'px', dx: dx + 'px', up: (18 + (j * 7) % 20) + 'px', gy: (300 + (j * 11 + pop * 5) % 18) + 'px',
        r: (180 + j * 97 + pop * 40) + 'deg', d: r1(d + .25 + j * .04) + 's',
      }) + '"><rect x="-2.6" y="-1.6" width="5.2" height="3.2" rx=".6"/></g>';
    }
  }
  return '<span class="fest__piece fest__string" data-fest-part="string">' +
      '<svg viewBox="0 0 60 226" focusable="false">' +
        '<g class="fc-sway">' +
          '<path class="fc-knot" d="M30 2 L40 12 L30 22 L20 12 Z"/><path class="fc-knot-in" d="M30 7 L35 12 L30 17 L25 12 Z"/>' +
          '<line class="fc-rope" x1="30" y1="20" x2="30" y2="214"/>' +
          crackers + bursts +
        '</g>' +
      '</svg>' +
    '</span>' +
    '<span class="fest__piece fest__fall" data-fest-fx="bits">' +
      '<svg viewBox="0 0 300 400" focusable="false">' + bits + '</svg>' +
    '</span>';
}

/* ---------------------------------------------------------------- 對外 */

const ART = { spring: spring, duanwu: duanwu, moon: moon, sakura: sakura };

function festHTML(key) {
  const art = ART[key];
  if (!art) return '';
  const u = 'fest' + (++uid);
  return '<span class="fest fest--' + key + '" data-fest="' + key + '" aria-hidden="true">' + art(u) + '</span>';
}

function festPlay(root, opt) {
  if (!root || APP.reduceMotion()) return;
  const restart = !opt || opt.restart !== false;
  root.querySelectorAll('.fest').forEach(function (el) {
    if (!restart && el.classList.contains('is-live')) return;
    el.classList.remove('is-live');
    void el.getBoundingClientRect();          /* 讓瀏覽器先算一次「沒在動」，動畫才會從頭來 */
    el.classList.add('is-live');
  });
}

APP.explore = Object.assign(APP.explore || {}, { festHTML: festHTML, festPlay: festPlay });

})();
