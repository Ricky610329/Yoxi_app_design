/* ==========================================================================
   yoxi 城事 — Tour
   Demo 導覽列。畫在手機外框旁邊，不碰 app 本身的畫面。

   任一張畫面帶 ?flow=a（或 b、c）打開，就會出現這一條：
     · 現在是第幾步、這一步要講什麼（講稿來自 catalog.js）
     · 上一步／下一步，鍵盤 ← → 也能翻
     · 在 app 裡照著點也會留在流程上：點擊時把 flow 參數帶到下一張
     · 點到流程以外的畫面，導覽列會告訴你「離開了流程」並給一顆回去的鈕

   為什麼不做在 app 裡：現場 demo 的問題不是 app 不會動，
   是講的人在第四張畫面忘了下一張是什麼、以及這一張要證明的事。
   這條列是給講的人看的，評審看的是手機。

   由 shell.js 在偵測到 ?flow= 時動態載入，畫面本身不用改。
   ========================================================================== */

(function () {
'use strict';

const q = new URLSearchParams(location.search);
const fkey = q.get('flow');
if (!fkey || !window.CATALOG) return;
const F = CATALOG.flow(fkey);
if (!F) return;

const N = F.steps.length;

/* 把任何 href 正規化成 catalog 裡的寫法：'place.html?id=neiwan'。
   導覽自己的參數（flow、step）與工具參數（still、v）不算在內。 */
function norm(href) {
  const u = new URL(href, location.href);
  const p = new URLSearchParams(u.search);
  ['flow', 'step', 'still', 'v'].forEach(function (k) { p.delete(k); });
  const base = u.pathname.split('/').pop();
  const qs = decodeURIComponent(p.toString());
  return qs ? base + '?' + qs : base;
}

function stepOf(href) {
  const n = norm(href);
  for (let i = 0; i < N; i++) {
    if (CATALOG.screen(F.steps[i].s).href === n) return i + 1;
  }
  return 0;
}

/* 現在在第幾步：先看畫面本身在不在流程上，不在才信網址上的 step。 */
const onFlow = stepOf(location.href);
let step = onFlow || parseInt(q.get('step') || '1', 10) || 1;
step = Math.max(1, Math.min(N, step));

/* 帶著導覽參數的連結。i 沒給就沿用目前這一步。 */
function withTour(href, i) {
  const u = new URL(href, location.href);
  u.searchParams.set('flow', fkey);
  u.searchParams.set('step', i || stepOf(href) || step);
  return u.pathname.split('/').pop() + u.search + u.hash;
}

function linkTo(i) {
  return withTour(CATALOG.screen(F.steps[i - 1].s).href, i);
}

/* 在 app 裡點連結時把參數帶上。用 capture，搶在畫面自己的 handler 之前。 */
document.addEventListener('click', function (e) {
  const a = e.target.closest('a[href]');
  if (!a || !a.closest('.device')) return;
  const raw = a.getAttribute('href');
  if (!raw || raw[0] === '#' || /^[a-z]+:/i.test(raw)) return;
  if (a.hasAttribute('data-toast') || a.hasAttribute('data-share')) return;
  a.setAttribute('href', withTour(raw));
}, true);

/* --------------------------------------------------------------------------
   畫導覽列
   -------------------------------------------------------------------------- */

const css = `
  .tour {
    position: fixed; z-index: 200; right: 24px; top: 50%; transform: translateY(-50%);
    width: 300px; padding: 18px 18px 14px; border-radius: 12px;
    background: var(--yoxi-white); color: var(--yoxi-navy);
    box-shadow: 0 8px 28px rgba(6,32,64,.18); font-family: var(--font-sans);
    font-size: 14px; line-height: 1.6;
  }
  .tour__head { display: flex; align-items: baseline; gap: 8px; }
  .tour__tag { font-size: 11px; font-weight: 800; letter-spacing: .08em; color: var(--yoxi-red); }
  .tour__name { font-weight: 800; flex: 1; }
  .tour__exit { font-size: 12px; color: var(--yoxi-slate); font-weight: 700; white-space: nowrap; }
  .tour__exit:hover { color: var(--yoxi-navy); }

  .tour__dots { display: flex; gap: 6px; margin: 14px 0 12px; }
  .tour__dots a {
    flex: 1; height: 6px; border-radius: 999px; background: var(--yoxi-line);
    position: relative;
  }
  .tour__dots a.is-done { background: var(--yoxi-slate-lite); }
  .tour__dots a.is-now  { background: var(--yoxi-navy); }
  .tour__dots a:hover::after {
    content: attr(data-name); position: absolute; left: 50%; bottom: 12px;
    transform: translateX(-50%); padding: 3px 8px; border-radius: 4px;
    background: var(--yoxi-navy); color: #fff; font-size: 11px; font-weight: 700;
    white-space: nowrap;
  }

  .tour__n { font-size: 12px; font-weight: 800; color: var(--yoxi-slate); }
  .tour__t { font-size: 18px; font-weight: 800; line-height: 1.3; margin-top: 2px; }
  .tour__say { margin-top: 8px; color: var(--yoxi-navy); }
  .tour__say--off { color: var(--yoxi-slate); }

  .tour__nav { display: flex; gap: 8px; margin-top: 14px; }
  .tour__btn {
    flex: 1; display: inline-flex; align-items: center; justify-content: center;
    min-height: 42px; padding: 0 12px; border-radius: 4px;
    background: var(--yoxi-mist); font-weight: 800; font-size: 14px; text-align: center;
  }
  .tour__btn:hover { background: var(--yoxi-line); }
  .tour__btn--go { background: var(--yoxi-navy); color: #fff; flex: 1.6; }
  .tour__btn--go:hover { background: var(--yoxi-navy-soft); }
  .tour__btn.is-off { visibility: hidden; }

  .tour__kbd { margin-top: 10px; font-size: 11px; color: var(--yoxi-slate); text-align: center; }
  .tour__kbd a { text-decoration: underline; }

  @media (max-width: 1180px) {
    .stage { padding-bottom: 150px; }        /* 底部的導覽列不要壓到手機 */
    .tour {
      right: 0; left: 0; bottom: 0; top: auto; transform: none; width: auto;
      border-radius: 12px 12px 0 0; padding: 12px 16px 10px;
      display: grid; grid-template-columns: 1fr auto; gap: 4px 16px; align-items: center;
    }
    .tour__head, .tour__dots, .tour__kbd { grid-column: 1 / -1; }
    .tour__dots { margin: 8px 0 6px; }
    .tour__nav { margin-top: 0; min-width: 260px; }
    .tour__kbd { display: none; }
  }
`;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function render() {
  const cur = F.steps[step - 1];
  const scr = CATALOG.screen(cur.s);
  const pageName = (document.title || '').split(' — ')[0];

  const dots = F.steps.map(function (st, i) {
    const n = i + 1;
    const cls = n < step ? 'is-done' : (n === step && onFlow ? 'is-now' : '');
    return '<a class="' + cls + '" href="' + linkTo(n) + '" data-name="' +
           n + ' ' + esc(CATALOG.screen(st.s).name) + '"></a>';
  }).join('');

  let body, prev, next;
  if (onFlow) {
    body = '<div class="tour__n">第 ' + step + ' 步 / ' + N + '</div>' +
           '<div class="tour__t">' + esc(scr.name) + '</div>' +
           '<p class="tour__say">' + esc(cur.say) + '</p>';
    prev = step > 1
      ? '<a class="tour__btn" href="' + linkTo(step - 1) + '">← 上一步</a>'
      : '<a class="tour__btn is-off">← 上一步</a>';
    next = step < N
      ? '<a class="tour__btn tour__btn--go" href="' + linkTo(step + 1) + '">下一步 →</a>'
      : '<a class="tour__btn tour__btn--go" href="../index.html#flows">流程結束 · 回總覽</a>';
  } else {
    body = '<div class="tour__n">離開了流程 · 現在在「' + esc(pageName) + '」</div>' +
           '<div class="tour__t">上一個站點：' + esc(scr.name) + '</div>' +
           '<p class="tour__say tour__say--off">' + esc(cur.say) + '</p>';
    prev = '<a class="tour__btn is-off">← 上一步</a>';
    next = '<a class="tour__btn tour__btn--go" href="' + linkTo(step) +
           '">回到第 ' + step + ' 步</a>';
  }

  const el = document.createElement('aside');
  el.className = 'tour';
  el.setAttribute('data-tour', fkey);
  el.innerHTML =
    '<div class="tour__head">' +
      '<span class="tour__tag">' + esc(F.tag) + '</span>' +
      '<span class="tour__name">' + esc(F.name) + '</span>' +
      '<a class="tour__exit" href="../index.html#flows">回總覽</a>' +
    '</div>' +
    '<div class="tour__dots">' + dots + '</div>' +
    body +
    '<div class="tour__nav">' + prev + next + '</div>' +
    '<div class="tour__kbd">鍵盤 ← → 翻頁 · <a href="' + norm(location.href) + '">離開導覽</a></div>';

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.appendChild(el);

  /* 鍵盤翻頁。在輸入框裡打字時不搶。 */
  document.addEventListener('keydown', function (e) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'ArrowRight' && onFlow && step < N) location.href = linkTo(step + 1);
    if (e.key === 'ArrowLeft'  && onFlow && step > 1) location.href = linkTo(step - 1);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', render);
} else {
  render();
}

window.TOUR = { flow: F, step: step, href: withTour, norm: norm };
})();
