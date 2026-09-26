/* ==========================================================================
   app.spec — 跨區塊的通用測試（harness 角色維護）
   對 ARCHITECTURE.md §8 路由表逐條導覽：render 得出來、沒有死按鈕、沒有禁用詞、
   沒有錯誤、不是 placeholder；再測 tab bar、返回、持久化、兩把 localStorage 互不覆蓋、
   首屏時間、CSS 沒有 hex 色碼。
   ========================================================================== */
T.spec('app', function (t) {

  /* 路由表（§8）：harness 的 T.ROUTES（每條 route 一個範例網址）＋一條 404。
     flow：有狀態前提的流程頁，允許被導走（例：沒有行程時 /trip 可能回 /ride）。 */
  const TABLE = T.routes().concat([{ path: '/no-such-page', notFound: true }]);
  function routes() { return TABLE; }

  TABLE.forEach(function (r, i) {
    t.test('route ' + (r.path.indexOf('/route/') === 0 ? '/route/:ROUTES[0]' : r.path), async function (app) {
      const cur = routes()[i];
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
    const list = routes();
    const left = [];
    for (let i = 0; i < list.length; i++) {
      await app.go(list[i].path, { expect: list[i].expect, redirectOk: true });
      if (app.$('main.view[data-view="_placeholder"]')) left.push(list[i].path);
    }
    t.eq(left.length, 0, '還是 placeholder 的 route：' + left.join('、'));
  }, 30000);

  /* T.ROUTES 是各 spec 共用的路由表：每一條註冊的 route 都要有範例網址，
     不然新加的 route 在 app／flows／各區塊的 render 掃描裡全部缺席 */
  t.test('T.ROUTES 對得上 APP.routes()：每條註冊的 route 都有範例網址', async function (app) {
    const A = app.APP;
    const covered = {};
    T.ROUTES.forEach(function (r) {
      const m = A.resolve(r.expect || r.path);
      t.ok(m.name !== '_404' && m.name !== '_placeholder', r.path + ' 是註冊的 route（' + m.name + '）');
      covered[m.pattern] = true;
    });
    const left = A.routes().filter(function (r) { return !covered[r.pattern]; }).map(function (r) { return r.pattern; });
    t.eq(left.length, 0, '沒有範例網址的 route：' + left.join('、'));
  });

  /* §6.3-4：/explore 與 /album 兩個索引頁 ≤ 12，其餘 ≤ 10（T.tapMax） */
  t.test('每個 route 可按數 ≤ 10（索引頁 ≤ 12；景點與 tab bar 不算）', async function (app) {
    const list = routes();
    const over = [];
    for (let i = 0; i < list.length; i++) {
      const landed = await app.go(list[i].path, { expect: list[i].expect, redirectOk: true });
      await app.tick(40);
      const n = t.countTappables(app);
      const max = T.tapMax(landed);
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
    const roots = ['/ride', '/explore', '/album'];
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

  t.test('nav.back 回到來處', async function (app) {
    await app.go('/explore');
    await app.go('/place/glass-kiln');
    app.APP.nav.back('/ride');
    await app.at('/explore');
    t.eq(app.route().path, '/explore', 'back 回 /explore（不是 fallback 的 /ride）');
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
    await app.at('/explore');
  });

  t.test('nav.prev／nav.up：history.state 記著每一筆從哪裡來、怎麼來的', async function (app) {
    await app.reset();
    let N = app.APP.nav;
    await app.go('/album');
    await app.go('/postcards');
    const prev = N.prev();
    t.eq(prev && prev.path, '/album', 'prev：上一筆是 /album');
    t.eq(prev && prev.tab, 'album', 'prev.tab：那一頁的底欄');
    t.eq(app.win.history.state.via, 'push', 'nav.go 疊上來的是 push');
    t.eq(N.upAction(), 'back', '從上一層點進來：退一格');
    t.eq(N.upAction({ backIf: function (p) { return p.path === '/ride'; } }), 'replace', 'backIf 不要：就地換');
    /* 真的重新整理（app.reload() 是換一份新文件、歷史從頭來；這裡要的是瀏覽器的重新整理）：來處還在 history.state 裡 */
    const d0 = app.doc;
    app.win.location.reload();
    await app.waitFor(function () {
      const d = app.doc;
      return d && d !== d0 && d.documentElement.getAttribute('data-view-ready') === '1';
    }, 4000, '重新整理完成');
    N = app.APP.nav;                          /* 重新整理之後是新的一份 APP */
    t.eq(N.prev() && N.prev().path, '/album', '重新整理之後 prev 還在');
    t.eq(N.upAction(), 'back', '重新整理之後照樣退一格');
    /* 流程頁（沒有底欄）來的：不退回去 */
    await app.go('/unlock/glass-kiln');
    await app.go('/postcard/p1');
    t.eq(N.prev() && N.prev().tab, null, '/unlock 沒有底欄');
    t.eq(N.upAction(), 'replace', '從流程頁來：換成上一層');
    t.eq(N.up('/postcards'), 'replace', 'nav.up 回報它怎麼走');
    await app.at('/postcards');
    t.eq(app.win.history.state.via, 'up', '換上來的那一層記成 up');
    t.eq(N.upAction(), 'replace', '換上來的那一層再往上也是換（它的上一筆不是來處）');
    /* 切底欄停回來：上一筆是別的 tab，不是來處 */
    await app.click('#tabbar [data-tab-id="ride"]');
    await app.at('/ride');
    await app.click('#tabbar [data-tab-id="album"]');
    await app.at('/postcards');
    t.eq(app.win.history.state.via, 'tab', '切底欄疊上來的是 tab');
    t.eq(N.upAction(), 'replace', '切底欄停回來：換成上一層');
    /* 點連結（<a href="#/…">）疊上來的 */
    await app.go('/album');
    await app.click('main.view [data-act="go-badges"]');
    await app.at('/badges');
    t.eq(app.win.history.state.via, 'link', '點連結疊上來的是 link');
    t.eq(N.prev() && N.prev().path, '/album', 'link 的來處也記著');
    /* 深連結：沒有上一筆 */
    await app.reset({ hash: '/postcard/p1' });
    await app.at('/postcard/p1');
    N = app.APP.nav;
    t.eq(N.prev(), null, '深連結沒有上一筆');
    t.eq(N.upAction(), 'replace', '深連結：換成上一層');
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
    T.helpers.collect(app, 'glass-kiln');
    t.eq(S.count(), n0 + 1, 'count +1');
    await app.reload();
    t.ok(app.STATE.has(card), 'reload 之後 ' + card + ' 還在');
    t.eq(app.STATE.count(), n0 + 1, 'reload 之後 count 不變');
    t.eq(app.STATE.card(card).date, app.APP.fmt.todayMMDD(), '新卡日期是今天（不是寫死的 09.21）');
  });

  t.test('store 與 STATE 互不覆蓋', async function (app) {
    await app.reset();
    const A = app.APP;
    A.store.set('dropoff', T.fixtures.dropoff({ id: 'neiwan', name: '內灣', km: 28, setAt: 1 }));
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

  t.test('app.css 字級只用 token（沒有寫死的 px 字級）', async function () {
    const txt = await readText(new URL('../css/app.css', location.href).href);
    t.ok(txt != null, '讀到 app.css');
    const src = String(txt || '').replace(/\/\*[\s\S]*?\*\//g, '');
    const hits = src.match(/font-size\s*:\s*\d+(\.\d+)?px/g) || [];
    t.eq(hits.length, 0, '寫死的字級：' + hits.join('、'));
  });

  /* ====================================================================
     core 的修正（浮層、焦點、路由、底欄、對話框、live region、onboarding、版面、地圖景點）
     ==================================================================== */

  /* 在 iframe 的 APP 裡臨時註冊一頁（reset 重載後就沒了） */
  function tempView(app, name, def) {
    app.APP.view(name, Object.assign({ tab: 'ride', status: 'dark', title: '測試頁',
      render: function () { return '<h1>測試頁</h1>'; } }, def));
  }
  function key(app, k, shift) {
    const W = app.win, d = app.doc;
    const ev = new W.KeyboardEvent('keydown', { key: k, shiftKey: !!shift, bubbles: true, cancelable: true });
    (d.activeElement || d.body).dispatchEvent(ev);
    return ev;
  }
  function act(app) { const a = app.doc.activeElement; return a ? (a.getAttribute('data-act') || a.tagName) : null; }

  t.test('導覽時收掉浮層：確認框回 null、有 _dismiss 的叫它、沒有的直接拿掉', async function (app) {
    await app.reset();
    await app.go('/ride');
    const A = app.APP, d = app.doc;
    let got = 'pending';
    A.ui.confirm({ text: '測試用的確認', yes: '好', no: '不要' }).then(function (v) { got = v; });
    const dev = d.querySelector('.device');
    let called = 0;
    const a = d.createElement('div');
    a.setAttribute('data-overlay', '');
    a._dismiss = function () { called++; a.remove(); };
    const b = d.createElement('div');
    b.setAttribute('data-overlay', '');
    dev.appendChild(a);
    dev.appendChild(b);
    /* 沒標 data-overlay、但用 a11yDialog 開的：導覽時當作按了 Esc */
    const c = d.createElement('div');
    c.innerHTML = '<button type="button">x</button>';
    dev.appendChild(c);
    let rc = null;
    rc = A.ui.a11yDialog(c, { label: '沒標的', onEsc: function () { c.remove(); rc(); } });
    t.ok(app.$('.app-confirm[data-overlay]'), '確認框本身也是 data-overlay');
    t.ok(A.ui.dismissOverlays, 'APP.ui.dismissOverlays 存在');
    await app.go('/album');
    await app.tick(20);
    t.ok(!app.$('.app-confirm'), '換頁後確認框不在了');
    t.eq(got, null, '確認框回 null＝沒有回答（動作不會落在新的一頁上）');
    t.eq(called, 1, '_dismiss 叫了一次');
    t.ok(!b.isConnected, '沒有 _dismiss 的直接移除');
    t.ok(!c.isConnected, '沒標 data-overlay 的 a11yDialog 也收掉（onEsc）');
    t.ok(!app.$('#view').hasAttribute('inert') && !app.$('#tabbar').hasAttribute('inert'), '背景的 inert 解除');
    /* toast 不是浮層：跟著跳到下一頁 */
    A.ui.toast('跟著走');
    await app.go('/ride');
    t.ok(app.$('.device .toast'), 'toast 換頁後還在');
  });

  t.test('confirm：danger 時焦點在「不要」，一般時在「好」', async function (app) {
    await app.reset();
    await app.go('/ride');
    const A = app.APP;
    let p = A.ui.confirm({ text: '清掉嗎', yes: '清除', no: '先不要', danger: true });
    await app.tick(20);
    t.eq(act(app), 'confirm-no', 'danger：焦點在 confirm-no');
    await app.click('[data-act="confirm-no"]');
    t.eq(await p, false, '按「先不要」回 false');
    p = A.ui.confirm({ text: '好嗎', yes: '好', no: '先不要' });
    await app.tick(20);
    t.eq(act(app), 'confirm-yes', '一般：焦點在 confirm-yes');
    await app.click('[data-act="confirm-yes"]');
    t.eq(await p, true, '按「好」回 true');
    /* 沒有回答就被關掉：null（跟「按了否」分得開） */
    p = A.ui.confirm({ text: '要嗎', yes: '要', no: '不要' });
    await app.tick(20);
    key(app, 'Escape');
    t.eq(await p, null, 'Esc 回 null');
    p = A.ui.confirm({ text: '要嗎', yes: '要', no: '不要' });
    await app.tick(20);
    app.$('.app-confirm').click();
    t.eq(await p, null, '點遮罩回 null');
  });

  t.test('對話框：Tab 在框裡繞、背景 inert、疊兩層時全部關掉才解除', async function (app) {
    await app.reset();
    await app.go('/ride');
    const A = app.APP, d = app.doc;
    const p = A.ui.confirm({ text: '要繼續嗎', yes: '好', no: '先不要' });
    await app.tick(20);
    ['#view', '#tabbar', '#demo-panel'].forEach(function (s) {
      t.ok(app.$(s) && app.$(s).hasAttribute('inert'), s + ' 在對話框開著時 inert');
    });
    t.eq(act(app), 'confirm-yes', '焦點在第一顆');
    let ev = key(app, 'Tab', true);
    t.ok(ev.defaultPrevented, 'Shift+Tab 在第一顆：攔下來');
    t.eq(act(app), 'confirm-no', 'Shift+Tab 從第一顆繞到最後一顆');
    ev = key(app, 'Tab');
    t.ok(ev.defaultPrevented, 'Tab 在最後一顆：攔下來');
    t.eq(act(app), 'confirm-yes', 'Tab 從最後一顆繞回第一顆');
    /* 焦點被弄到框外（例如點了背景）：Tab 拉回框裡 */
    if (d.activeElement && d.activeElement.blur) d.activeElement.blur();
    key(app, 'Tab');
    t.ok(app.$('.app-confirm').contains(d.activeElement), '焦點在框外時 Tab 拉回框裡');

    /* 疊一層：自己做一個對話框 */
    const box = d.createElement('div');
    box.innerHTML = '<button type="button" data-act="t-inner">裡面</button>';
    d.querySelector('.device').appendChild(box);
    const rel = A.ui.a11yDialog(box, { label: '第二層' });
    t.eq(act(app), 't-inner', '第二層拿到焦點');
    key(app, 'Escape');                           /* 第二層沒給 onEsc：Esc 不該關到底下的確認框 */
    await app.tick(10);
    t.ok(app.$('.app-confirm'), 'Esc 只給最上面那層');
    rel();
    box.remove();
    t.ok(app.$('#view').hasAttribute('inert'), '關掉第二層後確認框還開著：背景仍 inert');
    key(app, 'Escape');
    t.eq(await p, null, 'Esc 關確認框（沒有回答＝null）');
    t.ok(!app.$('#view').hasAttribute('inert') && !app.$('#tabbar').hasAttribute('inert') &&
         !app.$('#demo-panel').hasAttribute('inert'), '全部關掉後背景解除 inert');
  });

  t.test('對話框被直接拆掉（沒呼叫 release）：下次導覽時背景不會卡在 inert', async function (app) {
    await app.reset();
    await app.go('/ride');
    const d = app.doc;
    const box = d.createElement('div');
    box.innerHTML = '<button type="button">x</button>';
    d.querySelector('.device').appendChild(box);
    app.APP.ui.a11yDialog(box, { label: '孤兒' });
    t.ok(app.$('#view').hasAttribute('inert'), '開著時 inert');
    box.remove();
    await app.go('/album');
    t.ok(!app.$('#view').hasAttribute('inert'), '導覽後解除');
  });

  t.test('remember:false 的過場頁不寫 tabPaths：開過場頁 → 收藏 → 叫車，回到叫車而不是過場頁', async function (app) {
    await app.reset();
    tempView(app, '_t-transient', { path: '/__t/transient', remember: false });
    await app.go('/ride');
    await app.go('/__t/transient');
    t.eq(app.APP.store.get('tabPaths').ride, '/ride', '進過場頁沒有改 tabPaths.ride');
    app.APP.nav.replaceQuery('x=1');
    t.eq(app.APP.store.get('tabPaths').ride, '/ride', 'replaceQuery 也不寫');
    await app.click('#tabbar [data-tab-id="album"]');
    await app.at('/album');
    await app.click('#tabbar [data-tab-id="ride"]');
    await app.at('/ride');
  });

  t.test('同一個網址再 go 一次：不疊一筆歷史，返回不用按兩次', async function (app) {
    await app.reset({ hash: '/album' });
    const W = app.win;
    const i0 = W.history.state && W.history.state.i;
    await app.go('/album');
    t.eq(W.history.state && W.history.state.i, i0, '序號沒有 +1（換掉這一筆）');
    await app.go('/place/glass-kiln');
    const i1 = W.history.state.i;
    await app.go('/place/glass-kiln');
    t.eq(W.history.state.i, i1, '有參數的頁也一樣');
    app.APP.nav.back('/ride');
    await app.at('/album');
    t.eq(app.route().path, '/album', '按一次返回就回到 /album');
    app.APP.nav.back('/badges');
    await app.at('/badges');                      /* 已經在第一筆：走 fallback，不會退出 app */
  });

  t.test('popstate 回到同一個網址（沒有 hashchange）：序號跟著對齊，下一次返回走 fallback 不退出 app', async function (app) {
    await app.reset({ hash: '/ride' });
    const A = app.APP, W = app.win;
    await app.go('/album');
    A.nav.go('/ride', { replace: true });         /* 第二筆也變成 #/ride：跟第一筆同網址 */
    await app.at('/ride');
    W.history.back();
    await app.tick(150);
    t.eq(app.route().path, '/ride', '還在 /ride');
    t.eq(W.history.state && W.history.state.i, 0, '回到第一筆');
    A.nav.back('/badges');
    await app.at('/badges');
    t.ok(app.APP === A, '沒有離開 app（同一個 APP）');
  });

  t.test('導覽後焦點移到新畫面的標題；mount 自己放了焦點就不搶', async function (app) {
    await app.reset();
    await app.go('/ride');
    await app.go('/album');
    const d = app.doc;
    let a = d.activeElement;
    t.ok(a && app.view().contains(a), '焦點在新畫面裡（' + (a && a.tagName) + '）');
    const h = app.view().querySelector('h1');
    if (h) {
      t.eq(a, h, '焦點在第一個 h1');
      t.eq(h.getAttribute('tabindex'), '-1', 'h1 tabindex=-1（不進 Tab 順序）');
      if (h.matches(':focus')) t.eq(app.win.getComputedStyle(h).outlineStyle, 'none', '程式放的焦點不畫外框');
    }
    /* 從底欄切 tab：焦點也跟著到新畫面 */
    const tab = app.$('#tabbar [data-tab-id="ride"]');
    tab.focus();
    await app.click(tab);
    await app.at('/ride');
    a = d.activeElement;
    t.ok(a && app.view().contains(a), '底欄切換後焦點在新畫面裡');

    tempView(app, '_t-focus', {
      path: '/__t/focus',
      render: function () { return '<h1>標題</h1><button type="button" data-act="t-focus">按</button>'; },
      mount: function (root) { const b = root.querySelector('button'); b.onclick = function () {}; b.focus(); },
    });
    await app.go('/__t/focus');
    t.eq(act(app), 't-focus', 'mount 放的焦點留著');
    tempView(app, '_t-noh1', { path: '/__t/noh1', render: function () { return '<p>沒有標題</p>'; } });
    await app.go('/__t/noh1');
    t.eq(d.activeElement, app.view(), '沒有 h1：焦點在 main');
  });

  t.test('底欄：只建一次、換頁只換狀態；探索的舊路由亮叫車', async function (app) {
    await app.reset();
    await app.go('/ride');
    const ride = app.$('#tabbar [data-tab-id="ride"]');
    const album = app.$('#tabbar [data-tab-id="album"]');
    t.ok(ride && album, '兩個入口');
    t.eq(ride.getAttribute('aria-current'), 'page', '/ride：叫車 aria-current');
    await app.go('/album');
    t.ok(app.$('#tabbar [data-tab-id="ride"]') === ride, '換頁沒有重建（同一個元素）');
    t.ok(album.classList.contains('is-active') && !ride.classList.contains('is-active'), '/album：收藏亮');
    t.eq(ride.getAttribute('aria-current'), null, '叫車的 aria-current 拿掉');
    album.focus();
    app.APP.emit('state:change');
    app.APP.emit('store:change', { key: 'dropoff' });
    app.APP.store.set('fxMute', false);
    t.ok(app.$('#tabbar [data-tab-id="album"]') === album, 'state／store 變動不重畫底欄');
    t.eq(app.doc.activeElement, album, '停在收藏上的焦點沒掉');
    t.ok(!app.$('#tabbar .tabbar__dot'), '沒有小圓點');
    const rid = (app.MOCK.ROUTES && app.MOCK.ROUTES[0] && app.MOCK.ROUTES[0].id) || 'rail';
    const legacy = ['/explore', '/explore/map', '/place/glass-kiln', '/routes', '/route/' + rid];
    for (let i = 0; i < legacy.length; i++) {
      await app.go(legacy[i]);
      t.ok(!app.$('#tabbar').hidden, legacy[i] + ' 有底欄');
      t.ok(ride.classList.contains('is-active') && ride.getAttribute('aria-current') === 'page', legacy[i] + ' 亮叫車');
      t.ok(!album.classList.contains('is-active'), legacy[i] + ' 收藏不亮');
    }
    /* 在探索的舊路由上按叫車：已經在叫車底下 → 回叫車的根 */
    await app.click(ride);
    await app.at('/ride');
    t.eq(app.route().query.get('mode'), null, '回到預設搭車');
  });

  t.test('toast 的 live region：只有一個、同一句連兩次也會重放', async function (app) {
    await app.reset();
    await app.go('/ride');
    const live = app.$('#app-live');
    t.ok(live, '#app-live 存在');
    t.eq(app.$$('#app-live').length, 1, '只有一個');
    t.ok(live && !app.$('#view').contains(live), '不在 #view 裡（對話框開著時 #view 會 inert）');
    app.APP.ui.toast('同一句');
    await app.tick(120);
    t.eq(live.textContent, '同一句', '第一次');
    app.APP.ui.toast('同一句');
    t.eq(live.textContent, '', '第二次先清空');
    await app.tick(120);
    t.eq(live.textContent, '同一句', '再放回去');
    t.ok(live.getBoundingClientRect().width <= 1, '看不見（只給報讀器）');
  });

  t.test('沒看過 onboarding：第一次載入落在 /ride 或 /album 也先去 /welcome；帶 query 或 app 內導覽不攔', async function (app) {
    await app.reset({ onboarded: false, hash: '/ride' });
    await app.at('/welcome');
    await app.reset({ onboarded: false, hash: '/album' });
    await app.at('/welcome');
    await app.reset({ onboarded: false, hash: '/ride?mode=explore' });
    await app.at('/ride');
    await app.go('/album');
    t.eq(app.route().path, '/album', 'app 內導覽到 /album 不被攔');
    await app.reset({ onboarded: true, hash: '/ride' });
    await app.at('/ride');
  });

  /* 版面：把跑測試的 iframe 撐成桌機大小，量外框、底欄、demo 面板。
     iframe 在畫面外，Chrome 會節流它的 rendering（resize 事件可能晚到），所以換完尺寸直接呼叫 fitDevice()；
     真的瀏覽器由 resize 事件觸發同一支 */
  async function resizeFrame(app, w, h) {
    const fr = app.win.frameElement;
    fr.style.width = w == null ? '' : w + 'px';
    fr.style.height = h == null ? '' : h + 'px';
    fr.getBoundingClientRect();
    await app.tick(60);
    app.APP.fitDevice();
    await app.tick(60);
  }
  async function sized(app, w, h, fn) {
    await resizeFrame(app, w, h);
    try { await fn(); }
    finally { await resizeFrame(app, null, null); }
  }
  function box(app, sel) {
    const el = app.$(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, shown: app.win.getComputedStyle(el).display !== 'none' };
  }

  t.test('版面：桌機 1280×720 外框整支放得下、底欄與 demo 面板看得到', async function (app) {
    await app.reset();
    await app.go('/ride');
    await sized(app, 1280, 720, async function () {
      t.eq(app.doc.documentElement.getAttribute('data-layout'), 'desktop', 'html[data-layout=desktop]');
      const dv = box(app, '.device'), tb = box(app, '#tabbar'), dp = box(app, '#demo-panel');
      t.ok(dv.top >= 0 && dv.bottom <= 720 + 1, '外框在畫面內：' + Math.round(dv.top) + '–' + Math.round(dv.bottom));
      t.ok(tb.shown && tb.bottom <= 720 + 1 && tb.top >= 0, '底欄在畫面內：' + Math.round(tb.bottom));
      if (app.$('#demo-panel').children.length) {
        t.ok(dp.shown, 'demo 面板顯示');
        t.ok(dp.top >= 0 && dp.bottom <= 720 + 1 && dp.right <= 1280, 'demo 面板在畫面內');
      }
      t.ok(app.doc.documentElement.scrollHeight <= 720 + 1, '整頁不用捲：' + app.doc.documentElement.scrollHeight);
    });
    t.eq(app.doc.documentElement.getAttribute('data-layout'), 'phone', '縮回 390 寬：手機版');
  });

  t.test('版面：橫放 844×390 不論判成哪一種，外框與底欄都在畫面內', async function (app) {
    await app.reset();
    await app.go('/ride');
    await sized(app, 844, 390, async function () {
      const lay = app.doc.documentElement.getAttribute('data-layout');
      const dv = box(app, '.device'), tb = box(app, '#tabbar');
      t.ok(dv.top >= 0 && dv.bottom <= 390 + 1, lay + '：外框在畫面內：' + Math.round(dv.top) + '–' + Math.round(dv.bottom));
      t.ok(tb.shown && tb.top >= 0 && tb.bottom <= 390 + 1, lay + '：底欄在畫面內：' + Math.round(tb.top) + '–' + Math.round(tb.bottom));
      /* 沒有滑鼠的手機橫放要是手機版；有滑鼠（跑測試的桌機 Chrome）則是縮小的外框，demo 面板不能把它往下推 */
      const coarse = app.win.matchMedia('(hover: none), (pointer: coarse)').matches;
      if (coarse) t.eq(lay, 'phone', '觸控的橫放是手機版');
    });
  });

  function spotOverlaps(app) {
    const els = app.$$('main.view[data-view] .spot').filter(function (e) {
      const r = e.getBoundingClientRect();
      return r.width > 0 && app.win.getComputedStyle(e).visibility !== 'hidden';
    });
    const R = els.map(function (e) { const r = e.getBoundingClientRect(); return { id: e.getAttribute('data-spot'), r: r }; });
    const hits = [];
    for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
      const a = R[i].r, b = R[j].r;
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 2 && oy > 2) hits.push(R[i].id + '×' + R[j].id + ' ' + ox.toFixed(0) + '×' + oy.toFixed(0));
    }
    return { n: R.length, hits: hits };
  }

  t.test('地圖景點不互相壓（含選到的放大那顆）：叫車探索東門市場、探索地圖', async function (app) {
    await app.reset();
    const list = ['/ride?mode=explore&area=market', '/explore/map'];
    for (let i = 0; i < list.length; i++) {
      await app.go(list[i]);
      await app.tick(120);
      const o = spotOverlaps(app);
      t.ok(o.n >= 2, list[i] + ' 有景點（' + o.n + '）');
      t.eq(o.hits.length, 0, list[i] + ' 重疊：' + o.hits.join('、'));
      t.ok(app.$('main.view .spot.is-selected'), list[i] + ' 有選到的景點（放大那顆也量到了）');
    }
  });

  t.test('APP.map.mount({ pan:true }).destroy()：連同 initPan 掛在 window 上的 listener 一起拆（同一頁重畫地圖不會越疊越多）', async function (app) {
    await app.go('/album');
    const W = app.win, A = app.APP;
    const host = app.doc.createElement('div');
    host.style.cssText = 'position:absolute;left:0;top:0;width:300px;height:300px';
    app.$('main.view').appendChild(host);
    const added = [], removed = [];
    const oa = W.addEventListener, or = W.removeEventListener;
    W.addEventListener = function (type, fn, o) { added.push(fn); return oa.call(W, type, fn, o); };
    W.removeEventListener = function (type, fn, o) { removed.push(fn); return or.call(W, type, fn, o); };
    try {
      const m = A.map.mount(host, { style: 'paper', center: 'station', spanM: 1800, spots: false, pan: true });
      W.addEventListener = oa;
      t.ok(added.length >= 2, 'initPan 在 window 上掛了 listener：' + added.length);
      m.destroy();
      t.ok(added.length > 0 && added.every(function (fn) { return removed.indexOf(fn) >= 0; }), 'destroy 全部拆掉');
    } finally {
      W.addEventListener = oa;
      W.removeEventListener = or;
      host.remove();
    }
  });

  t.test('APP.map.mount 推開景點後 m.spots 的 px/py 跟畫的位置一致', async function (app) {
    await app.reset();
    tempView(app, '_t-map', {
      path: '/__t/map',
      render: function () { return '<h1>地圖</h1><div data-t-map style="position:relative;flex:1 1 auto;min-height:400px"></div>'; },
    });
    await app.go('/__t/map');
    const A = app.APP, M = app.MOCK;
    const host = app.$('[data-t-map]');
    const m = A.map.mount(host, { spots: M.SPOTS.slice(0, 8), max: 10, onSpot: function () {} });
    const W = m.handle.width, H = m.handle.height;
    let bad = 0, moved = 0;
    m.spots.forEach(function (s, i) {
      const el = m.spotsEl.querySelector('.spot[data-i="' + i + '"]');
      const L = parseFloat(el.style.left), T = parseFloat(el.style.top);
      if (Math.abs(L - s.px / W * 100) > 0.2 || Math.abs(T - s.py / H * 100) > 0.2) bad++;
      if (s.px0 != null && (Math.abs(s.px0 - s.px) > 0.5 || Math.abs(s.py0 - s.py) > 0.5)) moved++;
    });
    t.eq(bad, 0, 'style.left/top 跟 px/py 對得上');
    t.ok(moved > 0, '市中心的景點有被推開（' + moved + '）');
    t.eq(spotOverlaps(app).hits.length, 0, '沒有重疊');
    m.destroy();
  });
});
