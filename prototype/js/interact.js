/* ==========================================================================
   yoxi 城事 — Interactions
   讓 mock 真的可以動。

   全部用事件委派 + data 屬性，畫面只要標註就有行為，不用各自寫 JS。

     .sheet[data-drag]        底部 sheet 可以拉開收合（也可點拉把）
     .map[data-pan]           地圖可以拖曳
     [data-pills]             pill 分頁切換對應的 [data-panel]
     [data-switch="key"]      開關，狀態存進 STATE.settings
     .postcard[data-flip]     點一下翻面看敘事
     [data-reset]             清空狀態，現場可以重跑一輪
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* 底部 sheet：拉開 / 收合                                             */
  /* ------------------------------------------------------------------ */

  function initSheet(sheet) {
    const handle = sheet.querySelector('.sheet__handle');
    if (!handle) return;

    sheet.classList.add('sheet--drag', 'is-collapsed');

    const setOpen = function (open) {
      sheet.classList.toggle('is-collapsed', !open);
      const tb = document.getElementById('tabbar');
      /* 展開到全高時 tab bar 降低不透明度而非消失：
         用視覺讓渡取代「出現／消失」，避免版面跳動。 */
      if (tb) tb.classList.toggle('is-yield', open);
    };

    let y0 = null, moved = 0;

    const down = function (e) {
      y0 = (e.touches ? e.touches[0] : e).clientY;
      moved = 0;
      sheet.style.transition = 'none';
    };
    const move = function (e) {
      if (y0 === null) return;
      const y = (e.touches ? e.touches[0] : e).clientY;
      moved = y0 - y;
      if (Math.abs(moved) > 4) e.preventDefault();
    };
    const up = function () {
      if (y0 === null) return;
      sheet.style.transition = '';
      if (Math.abs(moved) > 24) setOpen(moved > 0);
      else setOpen(sheet.classList.contains('is-collapsed'));   /* 輕點＝切換 */
      y0 = null;
    };

    const grip = sheet.querySelector('.sheet__grip') || handle;
    grip.style.cursor = 'grab';
    grip.style.touchAction = 'none';
    grip.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    grip.addEventListener('click', function (e) { e.preventDefault(); });
  }

  /* ------------------------------------------------------------------ */
  /* 地圖拖曳                                                            */
  /* ------------------------------------------------------------------ */

  function initPan(map) {
    /* 把可平移的東西收進一層，浮動按鈕與小卡留在外面不動 */
    const layer = document.createElement('div');
    layer.className = 'map__pan';
    Array.prototype.slice.call(map.children).forEach(function (el) {
      if (el.matches('svg, .pin, .spot, #spots, [data-panlayer]')) layer.appendChild(el);
    });
    map.insertBefore(layer, map.firstChild);

    let x0 = 0, y0 = 0, dx = 0, dy = 0, ox = 0, oy = 0, on = false;
    const LIM = 46;                       /* 拖太遠會露出邊緣，夾住 */
    const clamp = function (v) { return Math.max(-LIM, Math.min(LIM, v)); };

    map.style.touchAction = 'none';
    map.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.fab, .peek, .spot, .modes, .layerbtn, .maplegend, button, a')) return;
      on = true; x0 = e.clientX; y0 = e.clientY; ox = dx; oy = dy;
      layer.style.transition = 'none';
      map.style.cursor = 'grabbing';
    });
    window.addEventListener('pointermove', function (e) {
      if (!on) return;
      dx = clamp(ox + e.clientX - x0);
      dy = clamp(oy + e.clientY - y0);
      layer.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    });
    window.addEventListener('pointerup', function () {
      if (!on) return;
      on = false;
      layer.style.transition = '';
      map.style.cursor = '';
    });
  }

  /* ------------------------------------------------------------------ */
  /* pill 分頁                                                           */
  /* ------------------------------------------------------------------ */

  function initPills(group) {
    const pills = group.querySelectorAll('.pill');
    pills.forEach(function (p) {
      p.addEventListener('click', function () {
        pills.forEach(function (x) { x.classList.remove('is-active'); });
        p.classList.add('is-active');
        const key = p.dataset.tab;
        if (!key) return;
        /* 只切換這一組管到的 panel：同頁若有兩組 pill 才不會互相干擾 */
        const scope = group.closest('[data-panel-scope]') || document;
        scope.querySelectorAll('[data-panel]').forEach(function (panel) {
          panel.classList.toggle('u-hidden', panel.dataset.panel !== key);
        });
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 開關（狀態持久）                                                     */
  /* ------------------------------------------------------------------ */

  function initSwitches() {
    document.querySelectorAll('[data-switch]').forEach(function (el) {
      const k = el.dataset.switch;
      if (window.STATE && STATE.all.settings[k] !== undefined) {
        el.classList.toggle('is-on', !!STATE.all.settings[k]);
      }
      el.addEventListener('click', function () {
        const on = el.classList.toggle('is-on');
        if (window.STATE) STATE.setSetting(k, on);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 明信片翻面                                                          */
  /* ------------------------------------------------------------------ */

  function initFlip() {
    document.addEventListener('click', function (e) {
      const card = e.target.closest('.postcard[data-flip]');
      if (!card) return;
      e.preventDefault();
      card.classList.toggle('is-flipped');
    });
  }

  /* ------------------------------------------------------------------ */
  /* 重設                                                                */
  /* ------------------------------------------------------------------ */

  function initReset() {
    document.querySelectorAll('[data-reset]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        if (window.STATE) STATE.reset();
        el.textContent = '已重設 ✓';
        setTimeout(function () { location.reload(); }, 500);
      });
    });
  }

  /* ------------------------------------------------------------------ */

  function boot() {
    document.querySelectorAll('.sheet[data-drag]').forEach(initSheet);
    document.querySelectorAll('.map[data-pan]').forEach(initPan);
    document.querySelectorAll('[data-pills]').forEach(initPills);
    initSwitches();
    initFlip();
    initReset();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.INTERACT = {
    initSheet: initSheet,
    initPan: initPan,
    initSwitches: initSwitches,
    initPills: initPills,
  };
})();
