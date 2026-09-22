/* photos.js —— 把 assets/photos/ 的實景照片放進 .ph 站位與地圖景點縮圖。
 *
 * 資料在 assets/photos/credits.js（window.PHOTOS_DATA），由 tools/fetch-photos.py 產生。
 * file:// 底下不能 fetch JSON，所以資料是一支指派全域的 JS 檔，要先載它再載這支：
 *
 *     <script src="../assets/photos/credits.js"></script>
 *     <script src="../js/photos.js" data-auto></script>
 *
 * 帶 data-auto 就會在 DOMContentLoaded 自己跑一次 inject()＋injectSpots()；
 * 不帶就自己挑時機呼叫（動態插進來的卡片要自己補呼叫，傳那塊 root 進去就好）。
 *
 * 版面契約在 css/concept.css：.ph 是站位（有 aspect-ratio，沒圖也不會塌），
 * 有圖時加 .has-photo 蓋掉站位的地名與「照片」chip。照片的作者與授權一定要露出來，
 * 所以有 data-photo-credit 的地方會在元素後面補一行 .photo__credit。
 */
(function () {
  'use strict';

  var DATA = window.PHOTOS_DATA || {};          // credits.js 沒載到也不能炸
  var SELF = document.currentScript;
  var AUTO = !!(SELF && SELF.hasAttribute('data-auto'));

  /* screens/*.html 與 boards/*.html 在下一層，根目錄的 concept.html 在同層。
     測試頁可以先設 window.PHOTOS_BASE 覆寫。 */
  var BASE = window.PHOTOS_BASE ||
    (/\/(screens|boards)\//.test(location.pathname) ? '../assets/photos/' : 'assets/photos/');

  /* .spot__img 上的 data-art 是畫風 key，不是地點 id；這張表把它對回地點。 */
  var ART_TO_PLACE = {
    station: 'station', temple: 'temple', brick: 'brick', market: 'market',
    moat: 'moat', hill: 'hill', lake: 'lake', harbour: 'harbour',
    rail: 'rail', oldst: 'neiwan'
  };

  function get(id, i) {
    var rows = id && DATA[id];
    if (!rows || !rows.length) return null;
    return rows[i || 0] || null;
  }

  function has(id) { return !!get(id, 0); }

  function credit(id, i) {
    var p = get(id, i);
    return p ? p.credit : '';
  }

  function srcOf(p) { return BASE + p.file; }

  function makeImg(p, alt, cls) {
    var img = document.createElement('img');
    if (cls) img.className = cls;
    img.src = srcOf(p);
    img.alt = alt || '';
    img.loading = 'lazy';
    if (p.w) img.width = p.w;
    if (p.h) img.height = p.h;
    return img;
  }

  /* 作者／授權那一行：授權與出處都是連結（CC BY-SA 的要求）。 */
  function makeCredit(p) {
    var s = document.createElement('span');
    var lead = /^©/.test(p.credit || '') ? '© ' : '';
    s.className = 'photo__credit';
    s.appendChild(document.createTextNode(lead + (p.author || '') + ' / '));
    var a = document.createElement('a');
    a.href = p.source;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Wikimedia Commons';
    s.appendChild(a);
    s.appendChild(document.createTextNode(', '));
    if (p.licenceUrl) {
      var b = document.createElement('a');
      b.href = p.licenceUrl;
      b.target = '_blank';
      b.rel = 'noopener license';
      b.textContent = p.licence;
      s.appendChild(b);
    } else {
      s.appendChild(document.createTextNode(p.licence || ''));
    }
    return s;
  }

  function makeMark() {
    var m = document.createElement('span');
    m.className = 'photo-mark';
    m.textContent = '實景照片';
    return m;
  }

  function drop(node) { if (node && node.parentNode) node.parentNode.removeChild(node); }

  /* [data-photo="<id>"]（選配 data-photo-i）→ 把 <img> 放進那個 .ph 站位裡。
     有 data-photo-mark 就加「實景照片」角標；有 data-photo-credit 就在元素「後面」補一行出處。
     圖載不起來就整組撤掉，站位的斜紋與地名自己會回來。 */
  function inject(root) {
    root = root || document;
    var list = root.querySelectorAll('[data-photo]');
    var n = 0;
    for (var k = 0; k < list.length; k++) {
      (function (el) {
        if (el.getAttribute('data-photo-done') === '1') return;      // 不重複注入
        var p = get(el.getAttribute('data-photo'),
                    parseInt(el.getAttribute('data-photo-i') || '0', 10) || 0);
        if (!p) return;                                              // 沒資料就別動站位
        var img = makeImg(p, p.name || el.getAttribute('data-ph') || '');
        var mark = el.hasAttribute('data-photo-mark') ? makeMark() : null;
        var cred = el.hasAttribute('data-photo-credit') ? makeCredit(p) : null;
        img.onerror = function () {
          drop(img); drop(mark); drop(cred);
          el.classList.remove('has-photo');
          el.removeAttribute('data-photo-done');
        };
        el.appendChild(img);
        el.classList.add('has-photo');
        el.setAttribute('data-photo-done', '1');
        if (mark) el.appendChild(mark);
        if (cred && el.parentNode) el.parentNode.insertBefore(cred, el.nextSibling);
        n++;
      }(list[k]));
    }
    return n;
  }

  /* 地圖上的景點縮圖：.spot__img[data-art]。地點 id 先看外層 .spot 的 data-place，
     沒有就用 data-art 查 ART_TO_PLACE。.spot__img 本來就是 overflow:hidden 的固定框，
     CSS 的 .spot__img > img.spot__photo 會把圖鋪滿。 */
  function injectSpots(root) {
    root = root || document;
    var list = root.querySelectorAll('.spot__img[data-art]');
    var n = 0;
    for (var k = 0; k < list.length; k++) {
      (function (el) {
        if (el.querySelector('img.spot__photo')) return;
        var spot = el.closest ? el.closest('.spot') : null;
        var id = (spot && spot.getAttribute('data-place')) ||
                 ART_TO_PLACE[el.getAttribute('data-art')];
        var p = get(id, 0);
        if (!p) return;
        var img = makeImg(p, '', 'spot__photo');
        img.onerror = function () { drop(img); };
        el.appendChild(img);
        n++;
      }(list[k]));
    }
    return n;
  }

  window.PHOTOS = {
    base: BASE,
    has: has,
    get: get,
    credit: credit,
    inject: inject,
    injectSpots: injectSpots
  };

  if (AUTO) {
    var go = function () { inject(document); injectSpots(document); };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', go);
    } else {
      go();
    }
  }
}());
