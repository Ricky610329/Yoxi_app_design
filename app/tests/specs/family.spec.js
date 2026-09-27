/* ==========================================================================
   album-family 的瀏覽器測試（ARCHITECTURE.md §6.3 五類）
   /line（長輩的手機：LINE 的「家人」群組，示意）、/family/:id（子女的手機：點開那張明信片，示意）、
   分享面板的「傳到 LINE 給家人」、APP.family.repliesHTML（明信片詳情頁嵌的「家人的回應」）。
   資料規則（最多留幾筆、回應的形狀、認不得的卡）在 node 測試 tests/unit/family.test.mjs。
   ========================================================================== */
T.spec('family', function (t) {

  const back = T.helpers.clickBack;
  const histI = T.helpers.histI;
  function toastText(app) {
    return app.$$('.device .toast').map(function (x) { return x.textContent; }).join('｜');
  }
  function cardName(app, id) {
    return app.MOCK.POSTCARDS.filter(function (p) { return p.id === id; })[0].name;
  }
  function replies(app, id) { return (app.APP.store.get('replies') || {})[id] || []; }

  function check(app, path) {
    const v = app.view();
    t.ok(v && v.getAttribute('data-view'), path + '：有 main.view[data-view]');
    t.ok(!app.$('[data-app-error]'), path + '：沒有錯誤卡');
    t.eq(app.errors.length, 0, path + '：沒有 JS 錯誤 ' + app.errors.join(' | '));
    t.noDeadButtons(app, path);
    t.noBannedWords(app, { msg: path });
    const n = t.countTappables(app);
    t.ok(n <= 10, path + '：可按數 ' + n + ' ≤ 10');
    t.includes(app.text('main.view [data-mock]') || '', '示意', path + '：一直標著示意');
  }

  /* 1. 每條 route 都能 render：還沒傳過（空狀態）、傳過之後、?share 對得上／對不上 */
  t.test('/line、/family/:id 都能 render（空的、傳過的；無死按鈕／禁用詞、可按數 ≤ 10、標著示意）', async function (app) {
    await app.reset();
    for (const p of ['/line', '/family/p1', '/family/nope']) {
      await app.go(p);
      check(app, p + '（沒有分享）');
    }
    t.ok(app.$('[data-family-missing]'), '/family/nope：找不到這張明信片');
    const s = app.APP.family.send({ card: 'p1' });
    app.APP.family.send({ card: 'p4' });                 /* 搭車的金框卡 */
    for (const p of ['/line', '/line?share=' + s.id, '/family/p1?share=' + s.id, '/family/p1', '/family/p4']) {
      await app.go(p);
      check(app, p);
    }
  }, { timeout: 20000 });

  /* 2. 主要互動：明信片頁 → 分享 → 傳到 LINE 給家人（一鍵）→ /line 已經在群組裡 */
  t.test('明信片頁分享 → 傳到 LINE 給家人 → /line，那一張已經傳到群組、store 多一筆分享', async function (app) {
    await app.reset();
    await app.go('/postcard/p1');
    await app.click('main.view [data-act="share"]');
    await app.waitFor(function () { return app.$('.sys-share'); }, 2000, '.sys-share');
    const first = app.$('.sys-share .row-nav');
    t.eq(first && first.getAttribute('data-act'), 'share-line', '第一格是傳到 LINE 給家人');
    await app.click('.sys-share [data-act="share-line"]');
    await app.at('/line');
    const list = app.APP.store.get('shares');
    t.eq(list.length, 1, 'store.shares 一筆');
    const s = list[0] || {};
    t.eq(s.card, 'p1', '傳的是這一張');
    t.eq(s.v, 1, '沒給 v 就是第一次造訪的那一張');
    t.ok(typeof s.id === 'string' && /^[a-z0-9]+$/.test(s.id), 'id 只有英數（放得進網址）：' + s.id);
    t.ok(!isNaN(Date.parse(s.at)), 'at 是 ISO 時間');
    t.eq(app.route().query.get('share'), s.id, '網址帶 ?share=<id>');
    t.ok(!app.$('.sys-share'), '分享面板收掉');
    t.includes(toastText(app), '已傳到 LINE', 'toast');
    const blk = app.$('.fam-share[data-share="' + s.id + '"]');
    t.ok(blk && blk.getAttribute('data-card') === 'p1', '/line 上有這一次分享');
    t.ok(blk && blk.classList.contains('is-focus'), '剛傳的那一次是焦點');
    t.includes(blk ? blk.textContent : '', cardName(app, 'p1'), '氣泡寫著地名');
    t.ok(blk && blk.querySelector('.postcard'), '氣泡裡是明信片');
    t.eq(app.$('[data-act="see-family"]').getAttribute('data-share'), s.id, '「看看子女收到的樣子」對準這一次');
    t.ok(app.text('main.view').indexOf('已讀') < 0, '沒有已讀');
    t.noDeadButtons(app, '/line 傳過之後');
    /* 返回：回到來處（明信片頁） */
    await back(app);
    await app.at('/postcard/p1');
    t.eq(app.errors.length, 0, '沒有錯誤 ' + app.errors.join('；'));
  });

  /* 3. 子女的回應寫進 store.replies，長輩那一端（/line）與明信片詳情（repliesHTML）看得到 */
  t.test('子女按喜歡、快速回覆、自己打一句 → store.replies → /line 與 repliesHTML 看得到', async function (app) {
    await app.reset();
    const F = app.APP.family;
    const s = F.send({ card: 'p2' });
    await app.go('/line?share=' + s.id);
    await app.click('main.view [data-act="see-family"]');
    await app.at('/family/p2');
    t.eq(app.route().query.get('share'), s.id, '帶著這一次的 ?share');
    t.includes(app.text('[data-family-from]'), '媽媽', '誰傳來的');
    t.includes(app.text('[data-family-from]'), '傳來一張明信片', '一句話講清楚');
    const heart = app.$('[data-act="toggle-heart"]');
    t.eq(heart.getAttribute('aria-pressed'), 'false', '一開始沒按喜歡');

    await app.click('[data-act="toggle-heart"]');
    let r = replies(app, s.id);
    t.eq(r.length, 1, '喜歡：一筆');
    t.ok(r[0] && r[0].who === 'yun' && r[0].heart === true && r[0].text === '', '喜歡的形狀 { who:yun, heart:true, text:"" }');
    t.eq(heart.getAttribute('aria-pressed'), 'true', 'aria-pressed');
    t.includes(toastText(app), '已回給媽媽（示意）', 'toast');

    await app.click('[data-act="pick-reply"]');
    r = replies(app, s.id);
    t.eq(r[r.length - 1] && r[r.length - 1].text, '好漂亮', '快速回覆');
    t.eq(r[r.length - 1] && r[r.length - 1].heart, false, '一句話 heart:false');

    const input = app.$('[data-reply-text]');
    t.eq(input.getAttribute('maxlength'), '40', 'maxlength');
    input.value = '  下次  一起去\t 吃豆花  ';        /* type=text 的換行瀏覽器會先拿掉；tab 與多的空白由 app 收 */
    await app.click('[data-act="send-reply"]');
    r = replies(app, s.id);
    t.eq(r[r.length - 1] && r[r.length - 1].text, '下次 一起去 吃豆花', '自己打的一句（去掉多的空白）');
    t.eq(input.value, '', '送出後清空');
    t.includes(app.$$('[data-mine-text]').map(function (x) { return x.textContent; }).join('｜'), '下次 一起去 吃豆花', '自己回過的話列在底下');

    const n = r.length;
    input.value = '   ';
    await app.click('[data-act="send-reply"]');
    t.eq(replies(app, s.id).length, n, '空白的一句不寫');
    t.includes(toastText(app), '先打一句話', '提示先打字');
    t.noDeadButtons(app, '/family 回應之後');
    t.noBannedWords(app, { msg: '/family 回應之後' });

    /* 回到長輩的手機：上一筆就是 /line → 退一格 */
    await app.click('[data-act="go-line"]');
    await app.at('/line');
    const hl = app.text('.fam-share[data-share="' + s.id + '"] [data-heart-line]') || '';
    t.includes(hl, '小芸 喜歡這張', '喜歡寫名字');
    t.ok(!/\d/.test(hl), '喜歡那一行沒有數字：' + hl);
    const said = app.$$('.fam-share[data-share="' + s.id + '"] [data-said]').map(function (x) { return x.textContent; });
    t.ok(said.indexOf('好漂亮') >= 0 && said.indexOf('下次 一起去 吃豆花') >= 0, '/line 上看得到留言：' + said.join('、'));

    const html = F.repliesHTML('p2');
    t.includes(html, '家人的回應', 'repliesHTML 的標題');
    t.includes(html, '小芸 喜歡這張', 'repliesHTML 寫誰喜歡');
    t.includes(html, '好漂亮', 'repliesHTML 列留言');
    const box = document.createElement('div');
    box.innerHTML = html;
    const hearts = box.querySelector('[data-family-hearts]');
    t.ok(hearts && !/\d/.test(hearts.textContent), 'repliesHTML 的喜歡沒有數字：' + (hearts && hearts.textContent));
    t.eq(F.repliesHTML('p3'), '', '沒有回應的卡是空字串');
    t.ok(F.repliesHTML('p2', 1) !== '', '指定第一次造訪也有');
    t.eq(F.repliesHTML('p2', 2), '', '第二次造訪的那一張沒有回應');
    t.eq(app.errors.length, 0, '沒有錯誤 ' + app.errors.join('；'));
  });

  t.test('喜歡可以收回；只剩收回的喜歡時 repliesHTML 是空字串', async function (app) {
    await app.reset();
    const F = app.APP.family;
    const s = F.send({ card: 'p3' });
    await app.go('/family/p3?share=' + s.id);
    await app.click('[data-act="toggle-heart"]');
    t.ok(F.hearted(s.id), '按了喜歡');
    await app.click('[data-act="toggle-heart"]');
    t.ok(!F.hearted(s.id), '收回了');
    t.eq(replies(app, s.id).length, 0, 'store 裡沒有留下喜歡');
    t.eq(app.$('[data-act="toggle-heart"]').getAttribute('aria-pressed'), 'false', 'aria-pressed 回到 false');
    t.includes(toastText(app), '收回喜歡了', 'toast');
    t.eq(F.repliesHTML('p3'), '', 'repliesHTML 空字串');
  });

  /* 4. 返回鍵回到正確的來處 */
  t.test('返回：/line 回來處、/family 回 /line；深連結的 /family 就地換成 /line?share=', async function (app) {
    await app.reset();
    const s = app.APP.family.send({ card: 'p1' });
    await app.go('/album');
    await app.go('/line?share=' + s.id);
    await back(app);
    await app.at('/album');
    await app.go('/line?share=' + s.id);
    await app.click('main.view [data-act="see-family"]');
    await app.at('/family/p1');
    await back(app);
    await app.at('/line');

    /* 深連結：直接打開子女那一端（沒有上一筆）→ 回到長輩的手機是就地換，不多一筆歷史 */
    const s0 = { id: 'sdeeplink1', card: 'p1', v: 1, at: new Date().toISOString() };
    await app.reset({ store: { shares: [s0] }, hash: '/family/p1?share=' + s0.id });
    await app.at('/family/p1');
    t.eq(app.$('[data-family][data-share]').getAttribute('data-share'), s0.id, '深連結用 ?share 的那一次');
    const i0 = histI(app);
    await app.click('[data-act="go-line"]');
    await app.at('/line');
    t.eq(app.route().query.get('share'), s0.id, '回到 /line?share=<同一次>');
    t.eq(histI(app), i0, '就地換（序號不變）');
    t.ok(app.$('.fam-share.is-focus[data-share="' + s0.id + '"]'), '/line 對準那一次');

    await app.reset({ store: { shares: [s0] }, hash: '/family/p1?share=' + s0.id });
    await app.at('/family/p1');
    await back(app);
    await app.at('/line');
    t.eq(app.route().query.get('share'), s0.id, '頁首的返回：沒有歷史就去 /line?share=<同一次>');
    t.eq(app.errors.length, 0, '沒有錯誤 ' + app.errors.join('；'));
  });

  t.test('/family 沒給 ?share 用這張卡最近的一次；沒傳過是空狀態；?share 對不上這張卡不拿來用', async function (app) {
    await app.reset();
    const F = app.APP.family;
    const a = F.send({ card: 'p1' });
    const b = F.send({ card: 'p1' });
    await app.go('/family/p1');
    t.eq(app.$('[data-family][data-share]').getAttribute('data-share'), b.id, '最近的一次');
    await app.go('/family/p1?share=' + a.id);
    t.eq(app.$('[data-family][data-share]').getAttribute('data-share'), a.id, '指定的那一次');
    await app.go('/family/p5');
    t.ok(app.$('[data-family-empty]'), '沒傳過的卡：空狀態');
    t.ok(!app.$('[data-act="toggle-heart"]'), '空狀態沒有回應鈕');
    await app.go('/family/p5?share=' + a.id);
    t.ok(app.$('[data-family-empty]'), '?share 是別張卡的：不拿來用');
    /* /line 只放最近三次；指定更舊的那一次時換掉最舊的一格 */
    F.send({ card: 'p2' }); F.send({ card: 'p3' }); F.send({ card: 'p4' });
    await app.go('/line');
    t.eq(app.$$('.fam-share').length, 3, '只放最近三次');
    t.ok(app.$('.fam-sys--more'), '更早的收起來（不寫幾張）');
    await app.go('/line?share=' + a.id);
    const ids = app.$$('.fam-share').map(function (x) { return x.getAttribute('data-share'); });
    t.eq(ids.length, 3, '還是三格');
    t.eq(ids[0], a.id, '指定的舊的那一次排最前面');
    t.ok(app.$('.fam-share.is-focus[data-share="' + a.id + '"]'), '焦點在它');
  });

  t.test('v 跟著分享存下來：APP.ui.share({ card, v:2 }) → share.v＝2，sharesOf 分得開', async function (app) {
    await app.reset();
    await app.go('/postcard/p1');
    app.APP.ui.share({ kind: 'postcard', card: 'p1', v: 2 });
    await app.waitFor(function () { return app.$('.sys-share'); }, 2000, '.sys-share');
    t.eq(app.$('.sys-share').getAttribute('data-share-v'), '2', '面板記下 v');
    await app.click('.sys-share [data-act="share-line"]');
    await app.at('/line');
    const F = app.APP.family;
    t.eq(app.APP.store.get('shares')[0].v, 2, 'share.v＝2');
    t.eq(F.sharesOf('p1', 2).length, 1, 'sharesOf(p1, 2)');
    t.eq(F.sharesOf('p1', 1).length, 0, 'sharesOf(p1, 1) 沒有');
    t.eq(F.sharesOf('p1').length, 1, 'sharesOf(p1) 不分第幾次');
  });

  /* 隱私：子女只看得到那一張；使用者打的字不會變成 HTML */
  t.test('子女那一端只有那一張明信片：沒有地點、距離、步數、已讀、其他明信片', async function (app) {
    await app.reset();
    const s = app.APP.family.send({ card: 'p1' });
    await app.go('/family/p1?share=' + s.id);
    const txt = app.text('main.view') || '';
    ['公里', 'km', '步數', '已讀', '獎章'].forEach(function (w) { t.ok(txt.indexOf(w) < 0, '沒有「' + w + '」'); });
    t.eq(app.$$('main.view .postcard').length, 1, '畫面上只有一張明信片');
    t.includes(txt, '只看得到這一張明信片', '寫明只看得到這一張');
  });

  t.test('使用者打的字不會變成 HTML（/family、/line、repliesHTML）', async function (app) {
    await app.reset();
    const W = app.win;
    W.__xss = 0;
    const evil = '<img src=x onerror="window.__xss=1">';
    const s = app.APP.family.send({ card: 'p1', cap: evil });
    await app.go('/family/p1?share=' + s.id);
    app.$('[data-reply-text]').value = evil;
    await app.click('[data-act="send-reply"]');
    const injected = function () { return app.$$('main.view img[src="x"], main.view [onerror]').length; };
    t.eq(injected(), 0, '/family：沒有注入的元素');
    await app.go('/line?share=' + s.id);
    t.eq(injected(), 0, '/line：沒有注入的元素');
    t.includes(app.$$('[data-said]').map(function (x) { return x.textContent; }).join(''), '<img', '原樣顯示成文字');
    const html = app.APP.family.repliesHTML('p1');
    t.ok(html.indexOf('<img') < 0 && html.indexOf('&lt;img') >= 0, 'repliesHTML 有 escape');
    await app.tick(50);
    t.eq(W.__xss, 0, '沒有執行');
  });

  /* album.js 的 cardHTML（那一次造訪的明信片＋相框）與 look()（稱號）：有就用，沒有就退回插圖卡、不寫稱號 */
  t.test('APP.album.cardHTML／look 有就用（帶 v 與 size），沒有就退回插圖卡', async function (app) {
    await app.reset();
    const A = app.APP;
    const s = A.family.send({ card: 'p1', v: 2 });
    const calls = [];
    const hadCard = A.album.cardHTML, hadLook = A.album.look;
    A.album.cardHTML = function (id, o) {
      calls.push(id + ':' + o.v + ':' + o.size);
      return '<div class="postcard" data-stub-card="' + id + '"></div>';
    };
    A.album.look = function () { return { frame: null, title: { key: 'old-town', name: '舊城散步人' } }; };
    try {
      await app.go('/family/p1?share=' + s.id);
      t.eq(app.text('[data-family-from]'), '媽媽 · 舊城散步人 傳來一張明信片', '寄件人旁邊是稱號');
      t.ok(app.$('main.view [data-stub-card="p1"]'), '/family 用 cardHTML');
      await app.go('/line?share=' + s.id);
      t.ok(app.$('.fam-share [data-stub-card="p1"]'), '/line 用 cardHTML');
      t.includes(calls.join(','), 'p1:2:lg', '/family 帶 v＝2、size＝lg');
      t.includes(calls.join(','), 'p1:2:sm', '/line 帶 v＝2、size＝sm');
      A.album.cardHTML = function () { throw new Error('壞掉的 cardHTML'); };
      A.album.look = function () { return { frame: null, title: null }; };
      await app.go('/family/p1?share=' + s.id);
      t.eq(app.text('[data-family-from]'), '媽媽傳來一張明信片', '沒選稱號就不寫');
      t.ok(app.$('main.view .fam-card [data-card-art="p1"]'), 'cardHTML 丟例外時退回插圖卡');
    } finally {
      if (hadCard) A.album.cardHTML = hadCard; else delete A.album.cardHTML;
      if (hadLook) A.album.look = hadLook; else delete A.album.look;
    }
  });

  t.test('album-family.css 沒有 hex 色碼、圓角只用 --r-*', async function (app) {
    const url = new URL('../css/views/album-family.css', location.href).href;
    const txt = await new Promise(function (resolve) {
      const x = new XMLHttpRequest();
      x.open('GET', url);
      x.onload = function () { resolve(x.status === 0 || x.status === 200 ? x.responseText : null); };
      x.onerror = function () { resolve(null); };
      try { x.send(); } catch (e) { resolve(null); }
    });
    t.ok(txt, '讀到 album-family.css');
    t.noHardcodedHex(txt, 'album-family.css');
    const src = String(txt || '').replace(/\/\*[\s\S]*?\*\//g, '');
    const bad = (src.match(/border-radius\s*:[^;}]+/g) || []).filter(function (d) {
      return d.replace(/border-radius\s*:/, '').trim().split(/\s+/).some(function (v) { return !/^var\(--r-[a-z]+\)$/.test(v) && v !== '0'; });
    });
    t.eq(bad.length, 0, '圓角不是 --r-*：' + bad.join('、'));
    t.ok(app.$('link[href="css/views/album-family.css"]'), 'index.html 載入它');
  });
});
