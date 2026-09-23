/* ==========================================================================
   app.spec — 跨區塊的通用測試（harness 角色維護）
   對 ARCHITECTURE.md §8 路由表逐條導覽：render 得出來、沒有死按鈕、沒有禁用詞、
   沒有錯誤、不是 placeholder；再測 tab bar、返回、持久化、兩把 localStorage 互不覆蓋、
   首屏時間、CSS 沒有 hex 色碼。
   ========================================================================== */
T.spec('app', function (t) {

  /* 路由表（§8）。flow：有狀態前提的流程頁，允許被導走（例：沒有行程時 /trip 可能回 /ride）。 */
  function routes(app) {
    const M = app.MOCK || {};
    const rid = (M.ROUTES && M.ROUTES[0] && M.ROUTES[0].id) || 'rail';
    return [
      { path: '/', expect: '/ride' },
      { path: '/welcome', flow: true },
      { path: '/ride' },
      { path: '/dropoff' },
      { path: '/pickup' },
      { path: '/trip', flow: true },
      { path: '/trip/done', flow: true },
      { path: '/drawer' },
      { path: '/points' },
      { path: '/notify' },
      { path: '/trips' },
      { path: '/ride?mode=today' },
      { path: '/explore', expect: '/ride', flow: true },
      { path: '/explore/map', expect: '/ride', flow: true },
      { path: '/place/glass-kiln' },
      { path: '/place/neiwan' },
      { path: '/going/glass-kiln', flow: true },
      { path: '/unlock/glass-kiln', flow: true },
      { path: '/unlock/neiwan?ride=1', flow: true },
      { path: '/routes' },
      { path: '/route/' + rid },
      { path: '/album' },
      { path: '/postcard/p1' },
      { path: '/badge/b1' },
      { path: '/footprint' },
      { path: '/lookback' },
      { path: '/week' },
      { path: '/elder' },
      { path: '/settings' },
      { path: '/no-such-page', notFound: true },
    ];
  }
  /* 路由表的 path 清單要在登記時就知道（一條一個 test），MOCK 還沒載，路線 id 在跑的時候再換 */
  const TABLE = routes({ MOCK: null });

  TABLE.forEach(function (r, i) {
    t.test('route ' + (r.path.indexOf('/route/') === 0 ? '/route/:ROUTES[0]' : r.path), async function (app) {
      const cur = routes(app)[i];
      /* 每條從叫車首頁出發，避免上一條留下的覆蓋層影響 */
      if (app.route().path !== '/ride') await app.go('/ride');
      const landed = await app.go(cur.path, { expect: cur.expect, redirectOk: !!cur.flow || !!cur.notFound });
      await app.tick(80);   /* 讓 mount 裡的 setTimeout（地圖、INTERACT）跑一輪 */
      const v = app.view();
      t.ok(v, 'main.view[data-view] 存在');
      if (!v) return;
      t.ok(v.getAttribute('data-view') !== '_placeholder', '「尚未建檔」placeholder：' + cur.path);
      if (cur.flow && landed !== cur.path.split('?')[0]) {
        /* 被導走不算錯，但要看得到（例如 /trip 沒有行程就回叫車） */
        t.ok(true);
      }
      t.noDeadButtons(app, cur.path);
      t.noBannedWords(app, { msg: cur.path });
      t.eq(app.errors.length, 0, cur.path + ' 的 window.onerror ' + app.errors.join('；'));
      const body = app.doc.body;
      t.eq(body.getAttribute('data-view'), v.getAttribute('data-view'), 'body[data-view] 與 main.view 一致');
    });
  });

  t.test('沒有任何 placeholder view', async function (app) {
    const list = routes(app);
    const left = [];
    for (let i = 0; i < list.length; i++) {
      await app.go(list[i].path, { expect: list[i].expect, redirectOk: true });
      if (app.$('main.view[data-view="_placeholder"]')) left.push(list[i].path);
    }
    t.eq(left.length, 0, '還是 placeholder 的 route：' + left.join('、'));
  }, 30000);

  /* 今天模式與收藏索引頁 ≤ 12，其餘 ≤ 10 */
  const TAP_MAX = { '/ride': 12, '/album': 12 };
  t.test('每個 route 可按數 ≤ 10（索引頁 ≤ 12；景點與 tab bar 不算）', async function (app) {
    const list = routes(app);
    const over = [];
    for (let i = 0; i < list.length; i++) {
      const landed = await app.go(list[i].path, { expect: list[i].expect, redirectOk: true });
      await app.tick(40);
      const n = t.countTappables(app);
      const max = TAP_MAX[landed] || 10;
      if (n > max) over.push(landed + '=' + n + '（上限 ' + max + '）');
    }
    t.eq(over.length, 0, '超過 10：' + over.join('、'));
  }, 30000);

  t.test('html[data-app-ready] 在載入後 3 秒內出現', async function (app) {
    await app.reset();
    t.ok(app.readyMs != null && app.readyMs <= 3000, 'data-app-ready 花了 ' + app.readyMs + 'ms');
    t.eq(app.doc.documentElement.getAttribute('data-app-ready'), '1', 'data-app-ready="1"');
    t.eq(app.errors.length, 0, '載入時的錯誤：' + app.errors.join('；'));
  });

  t.test('DOM 契約（§4）：#app > .stage > .device > .device__screen > #view > main.view', async function (app) {
    await app.go('/ride');
    t.ok(app.$('#app .stage .device .device__screen #view > main.view[data-view]'), '巢狀結構');
    t.ok(app.$('.device > nav.tabbar#tabbar'), 'nav.tabbar#tabbar 是 .device 的子元素');
    const b = app.doc.body;
    t.eq(b.getAttribute('data-tab'), 'ride', 'body[data-tab]');
    t.eq(b.getAttribute('data-route'), '/ride', 'body[data-route]');
    await app.go('/place/glass-kiln');
    t.eq(b.getAttribute('data-route'), '/place/:id', 'body[data-route] 是 pattern');
    t.eq(app.route().params && app.route().params.id, 'glass-kiln', 'nav.current().params.id');
    t.ok(/yoxi 城事/.test(app.doc.title), 'document.title 帶「— yoxi 城事」：' + app.doc.title);
  });

  function tabbarShown(app) {
    const tb = app.$('#tabbar');
    if (!tb || tb.hidden) return false;
    const s = app.win.getComputedStyle(tb);
    return s.display !== 'none' && s.visibility !== 'hidden';
  }

  t.test('tab bar：tab 根出現、tab 為 null 的 view 隱藏', async function (app) {
    const roots = ['/ride', '/ride?mode=today', '/album'];
    for (let i = 0; i < roots.length; i++) {
      await app.go(roots[i]);
      t.ok(tabbarShown(app), 'tab bar 在 ' + roots[i] + ' 應該顯示');
    }
    const full = ['/settings', '/lookback', '/welcome'];
    for (let i = 0; i < full.length; i++) {
      await app.go(full[i]);
      t.ok(!tabbarShown(app), 'tab bar 在 ' + full[i] + '（tab:null）應該隱藏');
    }
    await app.go('/ride');
    t.ok(tabbarShown(app), '回到 /ride tab bar 又出現');
  });

  t.test('tab bar 切換：點「收藏」到 /album', async function (app) {
    await app.go('/ride');
    const a = app.$('#tabbar a[href="#/album"], #tabbar [data-tab="album"]');
    t.ok(a, '#tabbar 裡有到 #/album 的項目');
    if (!a) return;
    await app.click(a);
    await app.at('/album');
    t.eq(app.doc.body.getAttribute('data-tab'), 'album', 'body[data-tab]');
  });

  t.test('底欄只有叫車和收藏；今天模式仍屬叫車', async function (app) {
    await app.go('/ride?mode=today');
    const tabs = app.$$('#tabbar [data-tab-id]');
    t.eq(tabs.length, 2, '底欄兩個 tab');
    t.eq(tabs.map(function (a) { return a.textContent.trim(); }).join('/'), '叫車/收藏', 'tab 名稱');
    t.eq(app.doc.body.getAttribute('data-tab'), 'ride', '今天模式的 tab');
    app.APP.nav.tab('explore');
    await app.tick(40);
    t.eq(app.route().path, '/ride', '不存在的 explore tab 不改路由');
    t.eq(app.route().query.get('mode'), 'today', '不存在的 explore tab 不改模式');
    app.APP.nav.tab('ride');
    await app.tick(40);
    t.eq(app.route().query.get('mode'), 'today', '重按叫車保留今天模式');
    await app.go('/album');
    app.APP.nav.tab('ride');
    await app.at('/ride');
    t.eq(app.route().query.get('mode'), 'today', '收藏切回叫車記得今天模式');
  });

  t.test('舊探索網址以 replace 導向今天模式，刷新後保留', async function (app) {
    await app.reset({ hash: '/explore/map?from=postcard' });
    await app.at('/ride');
    t.eq(app.route().query.get('mode'), 'today', '舊網址改為今天模式');
    t.eq(app.route().query.get('from'), 'postcard', '保留其他參數');
    t.ok(app.win.location.hash.indexOf('#/ride?') === 0, '網址已替換');
    await app.reload(app.win.location.hash.slice(1));
    await app.at('/ride');
    t.eq(app.route().query.get('mode'), 'today', '刷新保留今天模式');
  });

  t.test('nav.back 回到來處', async function (app) {
    await app.go('/ride?mode=today');
    await app.go('/place/glass-kiln');
    app.APP.nav.back('/ride');
    await app.at('/ride');
    t.eq(app.route().query.get('mode'), 'today', 'back 回今天模式（不是 fallback 的 /ride）');
  });

  t.test('data-back 返回鍵回到來處', async function (app) {
    await app.go('/album');
    await app.go('/postcard/p1');
    const b = app.$('main.view[data-view] [data-back]');
    t.ok(b, '/postcard/p1 有 data-back 返回鍵');
    if (!b) return;
    await app.click(b);
    await app.at('/album');
  });

  t.test('沒有歷史時 nav.back 走 fallback', async function (app) {
    await app.reset({ hash: '/place/neiwan' });
    await app.at('/place/neiwan');
    app.APP.nav.back('/explore');
    await app.at('/ride');
    t.eq(app.route().query.get('mode'), 'today', '舊 fallback 回今天模式');
  });

  t.test('404：未知 path 有畫面且能回叫車', async function (app) {
    await app.go('/definitely/not/here', { redirectOk: true });
    t.ok(app.view(), '有 main.view');
    t.ok(app.$('main.view[data-view] a[href="#/ride"], main.view[data-view] [data-back]'), '有回叫車的連結');
  });

  t.test('狀態持久：collect 之後 reload 仍在', async function (app) {
    await app.reset();
    const S = app.STATE;
    const card = 'p11';                       /* glass-kiln → p11（state.js PLACE_TO_CARD） */
    t.ok(!S.has(card), '初始沒有 ' + card);
    const n0 = S.count();
    const A = app.APP;
    if (A.explore && typeof A.explore.collect === 'function') A.explore.collect('glass-kiln', { by: 'walk', km: 1 });
    else { S.collect('glass-kiln', { by: 'walk', date: A.fmt.todayMMDD() }); A.emit && A.emit('state:change'); }
    t.eq(S.count(), n0 + 1, 'count +1');
    await app.reload();
    t.ok(app.STATE.has(card), 'reload 之後 ' + card + ' 還在');
    t.eq(app.STATE.count(), n0 + 1, 'reload 之後 count 不變');
    t.eq(app.STATE.card(card).date, app.APP.fmt.todayMMDD(), '新卡日期是今天（不是寫死的 09.21）');
  });

  t.test('store 與 STATE 互不覆蓋', async function (app) {
    await app.reset();
    const A = app.APP;
    A.store.set('dropoff', { id: 'neiwan', name: '內灣', km: 28, setAt: 1, via: 'k1' });
    app.STATE.collect('glass-kiln', { by: 'walk' });
    const st = app.storage('state');
    const so = app.storage('store');
    t.ok(st && st.cards && st.cards.p11, 'STATE 的 key 有新卡');
    t.ok(st && !('dropoff' in st), 'STATE 的 key 沒有 dropoff');
    t.ok(so && so.dropoff && so.dropoff.id === 'neiwan', 'store 的 key 有 dropoff');
    t.ok(so && !('cards' in so), 'store 的 key 沒有 cards');
    t.eq(so && so.onboarded, true, 'store.set 沒有洗掉 onboarded');
    await app.reload();
    t.eq(app.APP.store.get('dropoff') && app.APP.store.get('dropoff').id, 'neiwan', 'reload 後 dropoff 還在');
    t.ok(app.STATE.has('p11'), 'reload 後卡還在');
    app.APP.store.reset();
    t.ok(app.STATE.has('p11'), 'store.reset() 不動 STATE');
    t.eq(app.APP.store.get('dropoff'), null, 'store.reset() 清掉 dropoff');
  });

  t.test('第一次開：沒 onboarded 會到 /welcome', async function (app) {
    await app.reset({ onboarded: false });
    await app.at('/welcome');
  });

  /* CSS 不准寫 hex：index.html 實際載入的 app/css/** 加上契約列的五支 */
  function readText(url) {
    return new Promise(function (resolve) {
      const x = new XMLHttpRequest();
      x.open('GET', url);
      x.onload = function () { resolve(x.status === 0 || x.status === 200 ? x.responseText : null); };
      x.onerror = function () { resolve(null); };
      try { x.send(); } catch (e) { resolve(null); }
    });
  }

  t.test('app/css/**/*.css 沒有 hex 色碼', async function (app) {
    const base = new URL('../', location.href);            /* app/ */
    const set = {};
    ['css/app.css', 'css/views/system.css', 'css/views/ride.css', 'css/views/explore.css', 'css/views/album.css']
      .forEach(function (p) { set[new URL(p, base).href] = p; });
    app.$$('link[rel="stylesheet"]').forEach(function (l) {
      const u = new URL(l.getAttribute('href'), app.doc.baseURI).href;
      if (u.indexOf(new URL('css/', base).href) === 0) set[u] = u.slice(base.href.length);
    });
    const urls = Object.keys(set);
    let read = 0;
    for (let i = 0; i < urls.length; i++) {
      const txt = await readText(urls[i]);
      if (txt == null) { t.fail('讀不到 ' + set[urls[i]]); continue; }
      read++;
      t.noHardcodedHex(txt, set[urls[i]]);
    }
    t.ok(read > 0, '至少讀到一支 CSS');
    /* index.html 的 inline <style> 也算 */
    app.$$('style').forEach(function (s, i) { t.noHardcodedHex(s.textContent, 'index.html<style#' + i + '>'); });
  });
});
