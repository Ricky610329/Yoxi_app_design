/* 簡報的小事：頁碼、螢幕預覽縮放、溢出檢查。不改內容。
   - 正文頁碼「n / 正文總數」，附錄「附錄 A-n」，摘要頁不編號。
   - 溢出檢查：每頁 section 或頁內任何 overflow:hidden 的盒子，內容比盒子大就記下來，
     寫在 <html data-overflow="頁,頁">；build-pdf.py 用 --dump-dom 讀它，非空就失敗。 */
(function () {
  var slides = Array.prototype.slice.call(document.querySelectorAll('section.slide'));
  var mains = slides.filter(function (s) { return s.dataset.kind === 'main'; });
  var apps = slides.filter(function (s) { return s.dataset.kind === 'appendix'; });

  function stamp(s, text) {
    var n = s.querySelector('.foot__n');
    if (n) n.textContent = text;
  }
  mains.forEach(function (s, i) { stamp(s, (i + 1) + ' / ' + mains.length); });
  apps.forEach(function (s, i) { stamp(s, '附錄 A-' + (i + 1)); });

  function check() {
    var bad = [];
    slides.forEach(function (s, i) {
      var label = s.querySelector('.foot__n') ? s.querySelector('.foot__n').textContent : ('#' + (i + 1));
      var sr = s.getBoundingClientRect();
      var z = sr.width / 1920;
      var boxes = [s].concat(Array.prototype.slice.call(s.querySelectorAll('*')));
      var hit = [];
      boxes.forEach(function (el) {
        var cs = getComputedStyle(el);
        if (el === s || cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.overflowY === 'hidden') {
          if (el.tagName === 'IMG') return;
          if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) {
            hit.push((el.className || el.tagName) + ' ' + el.scrollWidth + 'x' + el.scrollHeight + '>' + el.clientWidth + 'x' + el.clientHeight);
          }
        }
      });
      /* 文字碰到頁尾區：任何葉節點的底超過 1080-60 */
      Array.prototype.slice.call(s.querySelectorAll('p,li,td,th,h1,h3,figcaption,dd,span,div')).forEach(function (el) {
        if (el.closest('.foot')) return;
        var r = el.getBoundingClientRect();
        if (r.height === 0) return;
        if ((r.bottom - sr.top) / z > 1080 - 62) hit.push('into-footer ' + (el.className || el.tagName) + ' bottom=' + Math.round((r.bottom - sr.top) / z));
        if ((r.right - sr.left) / z > 1920 - 40) hit.push('right-edge ' + (el.className || el.tagName));
      });
      if (hit.length) bad.push(label + ': ' + hit.slice(0, 4).join(' | '));
    });
    document.documentElement.setAttribute('data-overflow', bad.join(' ;; '));
    document.documentElement.setAttribute('data-checked', '1');
  }

  function fit() {
    var w = document.documentElement.clientWidth;
    var z = Math.min(1, (w - 48) / 1920);
    document.documentElement.style.setProperty('--z', z.toFixed(4));
  }

  var params = new URLSearchParams(location.search);
  if (!params.has('print')) { fit(); window.addEventListener('resize', fit); }
  window.addEventListener('beforeprint', function () { document.documentElement.style.setProperty('--z', '1'); });
  if (document.readyState === 'complete') check(); else window.addEventListener('load', check);
})();
