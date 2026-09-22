/* ==========================================================================
   yoxi 城事 — 概念板的一件小事：手機用 iframe 還是 PNG

   板上的手機預設是 iframe，裝的是真的概念稿（?still=1&bare=1）——
   改了畫面，板不用重拍就跟著變。但 headless 一次開四個 iframe 有風險
   （時間預算、file:// 的載入順序），所以留一條零 iframe 的退路：

     boards/xxx.html?png=1     或   <script>window.BOARD_PNG = true</script>

   這時每支手機的 iframe 會換成 .phone 上 data-png 指的縮圖。
   縮圖還沒拍（assets/thumbs/ 裡還沒有那一張）就 onerror 把 <img> 移掉，
   框裡露出墊在底下的「縮圖尚未產生」—— 不留破圖、版面高度一格都不動。

   零相依：不需要 mock.js／shell.js／hsmap.js，自己一支也能跑。
   ========================================================================== */
(function () {
'use strict';

function wantPNG() {
  return window.BOARD_PNG === true || /[?&]png=1(&|$)/.test(location.search);
}

/* 每個框都先墊一行字。iframe 與 <img> 是 z-index:1、白底，正常時蓋住它。 */
function bed(box) {
  if (box.querySelector(':scope > .phone__na')) return;
  const s = document.createElement('span');
  s.className = 'phone__na';
  s.textContent = '縮圖尚未產生';
  box.insertBefore(s, box.firstChild);
}

function swap() {
  const png = wantPNG();
  const list = document.querySelectorAll('.phone');
  for (let i = 0; i < list.length; i++) {
    const ph = list[i];
    const box = ph.querySelector('.phone__box') || ph;
    bed(box);
    if (!png) continue;

    const src = ph.getAttribute('data-png');
    const frames = box.querySelectorAll('iframe');
    for (let j = 0; j < frames.length; j++) frames[j].remove();
    if (!src) continue;

    const img = document.createElement('img');
    img.className = 'phone__png';
    img.alt = '';
    img.onerror = function () { img.remove(); };   /* 破圖不留，讓底下那行字露出來 */
    img.src = src;
    box.appendChild(img);
  }
  document.documentElement.setAttribute('data-board-mode', png ? 'png' : 'live');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', swap);
else swap();

window.BOARD = { swap: swap, png: wantPNG };
})();
