/* ==========================================================================
   yoxi 城事 介紹網站 — 各段的內容互動（內容 agent）
   #w-week 週曆條（.switch 兩態＋捲到一半自動切一次）、#w-ai 四張可展開的卡、#w-roadmap 五步時間軸。
   資料在 js/data.js 的 SITE_DATA.week／ai／roadmap；找不到掛載點或資料就略過。
   按鈕一律 <button>，展開用 aria-expanded＋aria-controls，可鍵盤操作。
   ========================================================================== */
(function () {
'use strict';

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = name => (typeof ICONS !== 'undefined' && ICONS[name]) ? ICONS[name] : '';
function tokens(s) {
  const D = window.SITE_DATA;
  return esc(s).replace('{walkmax}', D ? D.WALK_MAX_M / 1000 : 3);
}

/* ---- 為什麼：週曆條 ------------------------------------------------------ */
function initWeek() {
  const root = document.getElementById('w-week');
  const W = window.SITE_DATA && window.SITE_DATA.week;
  if (!root || !W) return;
  root.innerHTML =
    '<div class="week" data-state="now">' +
      '<div class="week__bar">' +
        '<div class="switch" role="group" aria-label="切換一週的樣子">' +
          '<button type="button" data-week="now" aria-pressed="true">現在的 yoxi</button>' +
          '<button type="button" data-week="with" aria-pressed="false">有了城事</button>' +
        '</div>' +
        '<p class="week__legend xs"><span class="week__dot" aria-hidden="true"></span>有叫車的那天</p>' +
      '</div>' +
      '<ol class="week__days">' + W.days.map((x, i) =>
        '<li class="week__day' + (x.ride ? ' is-ride' : '') + '" style="--i:' + i + '">' +
          '<span class="week__d">週' + esc(x.d) + '</span>' +
          '<span class="week__slot">' +
            (x.ride ? '<span class="week__app" aria-label="打開 yoxi 叫車">yoxi</span>' : '<span class="week__off" aria-label="沒打開"></span>') +
            '<span class="week__why">' + esc(x.why) + '</span>' +
          '</span>' +
          (x.ride ? '<span class="week__car" aria-hidden="true">' + icon('tabRide') + '</span>' : '') +
        '</li>').join('') +
      '</ol>' +
      '<p class="week__say" aria-live="polite"></p>' +
      '<p class="week__kpi note"></p>' +
    '</div>';
  const box = root.querySelector('.week');
  const say = root.querySelector('.week__say');
  const kpi = root.querySelector('.week__kpi');
  const btns = Array.from(root.querySelectorAll('[data-week]'));
  let touched = false, auto = false;
  function set(state) {
    box.setAttribute('data-state', state);
    btns.forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-week') === state)));
    const n = W.days.filter(d => d.ride).length;
    say.innerHTML = state === 'now'
      ? '<b>一週打開 <span class="em">' + n + '</span> 天。</b>' + esc(W.now)
      : '<b>一週 <span class="em">' + W.days.length + '</span> 天都有理由。</b>' + esc(W.with);
    kpi.textContent = W.kpi;
    kpi.hidden = state === 'now';
  }
  btns.forEach(b => { b.onclick = () => { touched = true; set(b.getAttribute('data-week')); }; });
  set('now');
  /* 捲到一半自動切一次；使用者按過就不再自動切 */
  box.setAttribute('data-progress', '');
  if (window.SITE) {
    SITE.on('progress', ({ el, p }) => {
      if (el !== box || touched || auto) return;
      if (p >= 0.5) { auto = true; set('with'); }
    });
  }
}

/* ---- AI：四張可展開的卡 -------------------------------------------------- */
function initAI() {
  const root = document.getElementById('w-ai');
  const A = window.SITE_DATA && window.SITE_DATA.ai;
  if (!root || !A) return;
  root.innerHTML =
    '<div class="grid grid--2 ai">' + A.map((c, i) =>
      '<article class="card ai-card">' +
        '<div class="ai-card__head">' +
          '<span class="tile" aria-hidden="true">' + icon(c.icon) + '</span>' +
          '<div><p class="ai-card__n xs">角色 ' + (i + 1) + '</p><h3 class="h3">' + esc(c.name) + '</h3></div>' +
        '</div>' +
        '<p class="ai-card__line">' + esc(c.line) + '</p>' +
        '<button type="button" class="ai-card__toggle" aria-expanded="false" aria-controls="ai-' + c.id + '">' +
          '<span class="ai-card__more">怎麼做、沒有 AI 會怎樣</span><span class="ai-card__chev" aria-hidden="true"></span></button>' +
        '<dl class="ai-card__body" id="ai-' + c.id + '" hidden>' +
          '<div><dt>怎麼做</dt><dd>' + esc(c.how) + '</dd></div>' +
          '<div><dt>沒有 AI 會怎樣</dt><dd>' + esc(c.without) + '</dd></div>' +
          '<div class="ai-card__proto"><dt>原型裡現在是</dt><dd>' + esc(c.proto) + '</dd></div>' +
        '</dl>' +
      '</article>').join('') +
    '</div>' +
    '<p class="note ai-note">內容上架的順序：AI 草稿 → 城市編輯審 → 有出處才上架。AI 生成的圖都有標示。「設為下車點」只有一條規則：超過 <span data-fmt="walkmax">3</span> 公里就換成它；那是產品設計，不是 AI。</p>';
  if (window.SITE) SITE.fillFmt(root);
  root.querySelectorAll('.ai-card__toggle').forEach(b => {
    b.onclick = () => {
      const open = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', String(open));
      document.getElementById(b.getAttribute('aria-controls')).hidden = !open;
      b.closest('.ai-card').classList.toggle('is-open', open);
    };
  });
  const q = new URLSearchParams(location.search);
  if (q.get('ai') === 'open') root.querySelectorAll('.ai-card__toggle').forEach(b => b.onclick());
}

/* ---- 路線圖：五步時間軸 -------------------------------------------------- */
function initRoadmap() {
  const root = document.getElementById('w-roadmap');
  const R = window.SITE_DATA && window.SITE_DATA.roadmap;
  if (!root || !R) return;
  const rows = [['做什麼', 'do'], ['不動什麼', 'keep'], ['前提', 'pre'], ['守門與停損', 'gate'], ['需要多少人', 'team']];
  root.innerHTML =
    '<div class="road" data-progress>' +
      '<div class="road__line" aria-hidden="true"><span class="road__fill"></span></div>' +
      '<ol class="road__steps">' + R.map(s =>
        '<li class="road__step' + (s.n === 0 ? ' is-first' : '') + '">' +
          '<button type="button" class="road__node" aria-expanded="false" aria-controls="road-' + s.n + '">' +
            '<span class="road__n">' + s.n + '</span>' +
            '<span class="road__when">' + esc(s.when) + '</span>' +
            '<span class="road__name">' + esc(s.name) + '</span>' +
          '</button>' +
          '<div class="road__panel card" id="road-' + s.n + '" hidden>' +
            '<p class="road__head"><span class="road__pn">第 ' + s.n + ' 步 · ' + esc(s.name) + '</span><span class="road__pw">' + esc(s.when) + '</span>' +
              (s.flag ? '<span class="pill">' + esc(s.flag) + '</span>' : '') + '</p>' +
            '<p class="road__line1">' + tokens(s.line) + '</p>' +
            '<dl class="road__dl">' + rows.map(([k, f]) => '<div><dt>' + k + '</dt><dd>' + tokens(s[f]) + '</dd></div>').join('') + '</dl>' +
          '</div>' +
        '</li>').join('') +
      '</ol>' +
      '<p class="credit road__foot">時間都是建議，以 yoxi 的發版節奏為準；目標值都是假設，要被試辦驗證或推翻。任何一項守門指標變差，就停在原地。</p>' +
    '</div>';
  const nodes = Array.from(root.querySelectorAll('.road__node'));
  function open(btn, on) {
    nodes.forEach(b => {
      const want = b === btn ? on : false;
      b.setAttribute('aria-expanded', String(want));
      document.getElementById(b.getAttribute('aria-controls')).hidden = !want;
      b.parentNode.classList.toggle('is-open', want);
    });
  }
  nodes.forEach((b, i) => {
    b.onclick = () => open(b, b.getAttribute('aria-expanded') !== 'true');
    b.onkeydown = e => {
      const k = e.key;
      let j = -1;
      if (k === 'ArrowRight' || k === 'ArrowDown') j = Math.min(nodes.length - 1, i + 1);
      if (k === 'ArrowLeft' || k === 'ArrowUp') j = Math.max(0, i - 1);
      if (k === 'Home') j = 0;
      if (k === 'End') j = nodes.length - 1;
      if (j < 0) return;
      e.preventDefault();
      nodes[j].focus();
      open(nodes[j], true);
    };
  });
  const q = new URLSearchParams(location.search);
  const want = q.get('road');
  open(nodes[want != null && nodes[+want] ? +want : 0], true);
}

document.addEventListener('DOMContentLoaded', function () {
  [initWeek, initAI, initRoadmap].forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  if (window.SITE && SITE.refresh) SITE.refresh();   /* 新長出來的 [data-progress] 要登記 */
});
})();
