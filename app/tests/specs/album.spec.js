/* ==========================================================================
   album 區塊的瀏覽器測試（ARCHITECTURE.md §6.3 五類）
   /album /postcards /badges /postcard/:id /badge/:id /footprint /lookback /week /elder
   ?tab= 是舊連結：/album?tab=journal 落在同一頁（見「舊連結」那一條），不再當成不同的頁各跑一次。
   ========================================================================== */
T.spec('album', function (t) {

  /* 共用路由表的 album 那幾條，加上搭車卡、金框卡、找不到的 id、長輩圖帶卡 */
  const ROUTES = T.routes({ area: 'album', extra: ['/postcard/p4', '/postcard/p11', '/postcard/nope',
                                                   '/badge/b4', '/badge/nope', '/elder?card=p1'] })
    .map(function (r) { return r.path; });
  const back = T.helpers.clickBack;
  const histI = T.helpers.histI;

  /* 1. 每條 route 都能 render、沒有死按鈕、沒有禁用詞、可按數在上限內 */
  t.test('每條 album route 都能 render（無死按鈕／禁用詞、可按數在上限內）', async function (app) {
    await app.reset();
    for (const path of ROUTES) {
      await app.go(path);
      const v = app.view();
      t.ok(v && v.getAttribute('data-view'), path + '：有 main.view[data-view]');
      t.ok(!app.$('[data-app-error]'), path + '：沒有錯誤卡');
      t.eq(app.errors.length, 0, path + '：沒有 JS 錯誤 ' + app.errors.join(' | '));
      t.noDeadButtons(app, path);
      t.noBannedWords(app, { msg: path });
      const n = t.countTappables(app);
      const max = T.tapMax(path);
      t.ok(n <= max, path + '：可按數 ' + n + ' ≤ ' + max);
    }
  }, { timeout: 30000 });

  /* 3. 統計格＝狀態 */
  t.test('/album 統計三格從 STATE 算', async function (app) {
    await app.reset();
    await app.go('/album');
    const S = app.STATE, B = app.MOCK.BADGES;
    t.eq(app.text('[data-stat="places"]'), String(app.APP.album.visitedPlaces().length), '去過的地方（不重複）');
    t.eq(app.text('[data-stat="km"]'), String(S.all.km), '公里');
    const got = B.filter(function (b) { return S.badge(b.id).got; }).length;
    t.eq(app.text('[data-stat="badges"]'), got + '/' + B.length, '獎章 已獲得/總數');
  });

  /* 9. 去過的地方＝不重複的地方，不是卡片張數（p3／p19 都是護城河、p6／p21 都是十八尖山） */
  t.test('「去過的地方」數不重複的地方：收 p19、p21 之後仍跟城市足跡一致', async function (app) {
    await app.reset();
    const S = app.STATE, A = app.APP;
    const n0 = A.album.visitedPlaces().length;
    t.eq(n0, A.album.footprintSeen().seen.length + A.album.footprintSeen().missing.length, '一開始＝足跡上的點');
    S.collect('moat', { date: A.fmt.todayMMDD() });           /* p19：護城河的第二張 */
    S.collect('hill', { date: A.fmt.todayMMDD() });           /* p21：十八尖山的第二張 */
    A.emit('state:change');
    t.ok(S.has('p19') && S.has('p21'), '收下 p19、p21');
    await app.go('/album');
    t.eq(app.text('[data-stat="cards"]'), String(S.count()), '明信片張數 +2');
    t.eq(app.text('[data-stat="places"]'), String(n0), '去過的地方不變（同一個地方的第二張）');
    t.eq(app.text('[data-stat="places"]'), String(A.album.footprintSeen().seen.length), '＝城市足跡的點數');
  });

  /* 2. 收卡之後：多一格「新」，mount 後 lastIsNew 變 false；統計 +1 */
  t.test('collect 後 /album 多一格「新」，看過就不再是新的', async function (app) {
    await app.reset();
    await app.go('/album');
    t.eq(app.$$('.postcard__new').length, 0, '一開始沒有「新」');
    const before = app.STATE.count();
    t.ok(app.STATE.collect('glass-kiln', { date: app.APP.fmt.todayMMDD() }), 'collect 成功');
    app.APP.emit('state:change');
    t.ok(app.STATE.lastIsNew, 'collect 後 lastIsNew');
    await app.go('/ride');
    await app.go('/album');
    const fresh = app.$$('.postcard__new');
    t.eq(fresh.length, 1, '一格「新」');
    const cell = fresh[0] && fresh[0].closest('[data-card]');
    t.eq(cell && cell.getAttribute('data-card'), 'p11', '「新」在 p11（水利路老玻璃窯）');
    t.eq(app.STATE.lastIsNew, false, 'mount 後 markLastSeen');
    t.eq(app.text('[data-stat="places"]'), String(before + 1), '統計 +1');
    t.ok(t.countTappables(app) <= 12, '有「新」時可按數仍 ≤ 12：' + t.countTappables(app));
  });

  t.test('我的明信片主卡 → /postcards：收下的在前、還沒去的另一段，返回回收藏', async function (app) {
    await app.reset();
    await app.go('/album');
    const S = app.STATE, P = app.MOCK.POSTCARDS;
    t.eq(app.text('[data-stat="cards"]'), String(S.count()), '主卡顯示已收張數');
    t.eq(app.$$('.alb-v2__stack [data-card]').length, Math.min(3, S.count()), '主卡疊最近三張');
    t.eq(app.$$('.alb-v2__postcard, [data-act="show-all-cards"]').length, 0, '收藏首頁不攤開明信片網格');
    await app.click('[data-act="go-postcards"]');
    await app.at('/postcards');
    const got = P.filter(function (p) { return S.has(p.id); });
    t.eq(app.$$('[data-group="got"] [data-card]').length, got.length, '收下的一段＝已收張數');
    t.eq(app.$$('[data-group="todo"] [data-card]').length, P.length - got.length, '還沒去的一段＝其餘');
    t.eq(app.text('main.view[data-view] [data-stat="cards"]'), String(got.length), '頁首收集張數');
    const dates = app.$$('[data-group="got"] [data-card]').map(function (el) { return S.card(el.getAttribute('data-card')).date; });
    t.eq(dates.join(','), dates.slice().sort().reverse().join(','), '收下的照日期由近到遠');
    t.eq(app.$$('main.view[data-view] .ai-mark').length, 0, '不逐張貼 AI 標籤');
    t.includes(app.text('main.view[data-view]'), 'AI 依地點生成', '頁底一行 AI 生成說明');
    await app.click('main.view[data-view] a[data-back]');
    await app.at('/album');
  });

  /* 4. p19–p22 收了之後要打得開：/postcards 收下的每一格連到詳情，整片網格算一個可按的東西 */
  t.test('/postcards 收下的格子連到明信片詳情（p19 也打得開）；網格是 data-gallery、可按數仍 ≤ 10', async function (app) {
    await app.reset({ cards: [{ id: 'moat' }] });              /* p19：不屬於任何獎章 */
    const S = app.STATE, A = app.APP;
    await app.go('/postcards');
    const got = app.$$('[data-group="got"] [data-card]');
    t.eq(got.length, S.count(), '收下的每一張都在');
    t.ok(got.every(function (el) { return el.tagName === 'A' && el.getAttribute('href') === '#/postcard/' + el.getAttribute('data-card'); }),
      '收下的每一格都是連到 /postcard/:id 的 <a>');
    t.ok(got.every(function (el) { return el.closest('[data-gallery]'); }), '收下的格子都在 [data-gallery] 裡');
    t.eq(app.$$('[data-group="todo"] a[data-card]').length, 0, '還沒去的格子不連');
    const n = t.countTappables(app);
    t.ok(n <= 10, '可按數 ' + n + ' ≤ 10（整片網格算一個）');
    t.noDeadButtons(app, '/postcards');
    await app.click('[data-group="got"] [data-card="p19"]');
    await app.at('/postcard/p19');
    t.ok(app.$('[data-flip]'), 'p19 的明信片詳情（收過、可翻面）');
    await back(app);
    await app.at('/postcards');
  });

  t.test('countTappables：[data-gallery] 不管幾格都算一個', async function (app) {
    await app.reset();
    await app.go('/postcards');
    const grid = app.$('[data-gallery]');
    t.ok(grid && grid.querySelectorAll('a[href]').length > 1, '網格裡不只一個連結');
    const withGallery = t.countTappables(app);
    grid.removeAttribute('data-gallery');
    const without = t.countTappables(app);
    grid.setAttribute('data-gallery', '');
    t.eq(without - withGallery, grid.querySelectorAll('a[href]').length - 1, '拿掉 data-gallery 就一格一格算');
  });

  t.test('/postcards、/badges 切去叫車再點「收藏」停回子頁：返回回收藏首頁，不退回叫車', async function (app) {
    for (const x of [['/postcards', 'go-postcards'], ['/badges', 'go-badges']]) {
      await app.reset();
      await app.go('/album');
      await app.click('[data-act="' + x[1] + '"]');
      await app.at(x[0]);
      await app.click('#tabbar [data-tab-id="ride"]');
      await app.at('/ride');
      await app.click('#tabbar [data-tab-id="album"]');
      await app.at(x[0]);
      await app.click('main.view[data-view] a[data-back]');
      await app.at('/album');
      t.eq(app.route().path, '/album', x[0] + ' 返回落在收藏首頁');
    }
  });

  /* 1. 更深的子頁切 tab 停回來：返回走邏輯上的上一層，不退回叫車 */
  t.test('返回：/badge/b3 切去叫車再點「收藏」停回來 → 返回 /badges → /album', async function (app) {
    await app.reset();
    await app.go('/album');
    await app.click('[data-act="go-badges"]');
    await app.at('/badges');
    await app.click('[data-badge="b3"]');
    await app.at('/badge/b3');
    await app.click('#tabbar [data-tab-id="ride"]');
    await app.at('/ride');
    await app.click('#tabbar [data-tab-id="album"]');
    await app.at('/badge/b3');
    await back(app);
    await app.at('/badges');
    t.eq(app.route().path, '/badges', '/badge/b3 → /badges（不是 /ride）');
    await back(app);
    await app.at('/album');
    t.eq(app.route().path, '/album', '/badges → /album（不是 /ride）');
  });

  t.test('返回：/trips 點行程卡到明信片、切 tab 停回來 → 返回 /postcards；直接點進來的返回 /trips', async function (app) {
    await app.reset();
    await app.go('/trips');
    const a = app.$('[data-act="open-trip-card"]');
    t.ok(a, '/trips 有連到明信片的行程卡');
    if (!a) return;
    const to = a.getAttribute('href').slice(1);
    /* 直接點進來：照歷史退回 /trips */
    await app.click(a);
    await app.at(to);
    await back(app);
    await app.at('/trips');
    t.eq(app.route().path, '/trips', '從 /trips 點進來的，返回 /trips');
    /* 切 tab 停回來：上一筆是叫車，不是從那裡點進來的 → 明信片子頁 */
    await app.click('[data-act="open-trip-card"]');
    await app.at(to);
    await app.click('#tabbar [data-tab-id="ride"]');
    await app.at('/trips');
    await app.click('#tabbar [data-tab-id="album"]');
    await app.at(to);
    await back(app);
    await app.at('/postcards');
    t.eq(app.route().path, '/postcards', '切 tab 停回來的，返回 /postcards（不是 /trips）');
  });

  /* 2. 從更深的一頁退回來再按返回：照歷史退，不多疊一筆 /album */
  t.test('返回：/album → /badges → /badge/b3 → 返回 → 返回：照歷史退回第一筆，沒有重複的 /album', async function (app) {
    await app.reset();
    await app.go('/album');
    const i0 = histI(app);
    await app.click('[data-act="go-badges"]');
    await app.at('/badges');
    await app.click('[data-badge="b3"]');
    await app.at('/badge/b3');
    t.eq(histI(app), i0 + 2, '往下兩層＝兩筆歷史');
    await back(app);
    await app.at('/badges');
    t.eq(histI(app), i0 + 1, '退一格');
    await back(app);
    await app.at('/album');
    t.eq(histI(app), i0, '回到第一筆（不是 replace 出來的第二個 /album）');
  });

  t.test('返回：直接開網址（沒有上一頁）→ 邏輯上的上一層', async function (app) {
    const cases = [['/postcard/p1', '/postcards'], ['/badge/b3', '/badges'], ['/week', '/album'],
                   ['/elder', '/week'], ['/footprint', '/album'], ['/postcards', '/album'], ['/badges', '/album']];
    for (const c of cases) {
      await app.reset({ hash: c[0] });
      await app.at(c[0]);
      t.eq(app.$('main.view[data-view] a[data-back]').getAttribute('data-back'), c[1], c[0] + ' 的 data-back');
      await back(app);
      await app.at(c[1]);
      t.eq(app.route().path, c[1], c[0] + ' → ' + c[1]);
    }
  }, { timeout: 20000 });

  t.test('返回：/album → 這一週 → 傳給家人 → 返回 → 返回：照歷史一路退回收藏', async function (app) {
    await app.reset();
    await app.go('/album');
    const i0 = histI(app);
    await app.click('[data-act="go-week"]');
    await app.at('/week');
    await app.click('[data-act="go-elder"]');
    await app.at('/elder');
    await back(app);
    await app.at('/week');
    await back(app);
    await app.at('/album');
    t.eq(histI(app), i0, '回到第一筆');
  });

  /* 3. 獎章：收下的寫日期（組成的卡最晚那一張）、還在路上的寫「收集 n/m」；沒有進度環 */
  function badgeExpect(app, id) {
    const S = app.STATE;
    const r = S.badge(id);
    if (!r.got) return '收集 ' + r.done + '/' + r.total;
    const last = r.ids.map(function (c) { return S.card(c).date; }).sort().pop();
    return new Date().getFullYear() + '.' + last;
  }

  t.test('/badges 章牆：每一枚的日期或「收集 n/m」與 STATE 一致、收下在前', async function (app) {
    await app.reset();
    await app.go('/badges');
    const B = app.MOCK.BADGES;
    t.eq(app.$$('[data-badge]').length, B.length, '每一枚都在');
    B.forEach(function (b) {
      const r = app.STATE.badge(b.id);
      t.eq(app.text('[data-badge="' + b.id + '"] [data-badge-when]'), badgeExpect(app, b.id), b.id);
      const el = app.$('[data-badge="' + b.id + '"]');
      t.eq(el && el.classList.contains('is-locked'), !r.got, b.id + ' 亮／灰');
      t.eq(el && el.getAttribute('href'), '#/badge/' + b.id, b.id + ' 連到詳情');
    });
    const order = app.$$('[data-badge]').map(function (el) { return app.STATE.badge(el.getAttribute('data-badge')).got; });
    t.eq(order.indexOf(false) < 0 || order.slice(order.indexOf(false)).indexOf(true) < 0, true, '收下的排在還在路上的前面');
    t.eq(app.$$('.ring, .stampcard').length, 0, '沒有進度環與集點卡');
    await app.go('/badge/b3');
    const r3 = app.STATE.badge('b3');
    t.eq(app.text('[data-prog]'), '收集 ' + r3.done + '/' + r3.total, '/badge/b3 收集 n/m');
    t.ok(r3.got ? !!app.$('[data-award]') : !app.$('[data-award]'), 'award 只在獲得後出現');
    t.ok(app.$('.alb-medal__hex .alb-hex'), '詳情用同一枚六角章');
    await app.go('/badge/b4');
    t.ok(!app.$('[data-award]'), '未獲得的 b4 沒有 award 文案');
    t.eq(app.$$('[data-member]').length, app.STATE.badge('b4').ids.length, '組成清單');
  });

  t.test('/album 獎章卡：放大最近收下的一枚，其餘排成一列，顯示全部 → /badges', async function (app) {
    await app.reset();
    await app.go('/album');
    const S = app.STATE, B = app.MOCK.BADGES;
    const got = B.filter(function (b) { return S.badge(b.id).got; });
    const newest = got.map(function (b) { return { id: b.id, d: badgeExpect(app, b.id) }; })
      .sort(function (x, y) { return x.d < y.d ? 1 : x.d > y.d ? -1 : 0; })[0];
    const top = app.$('.alb-v2__medal-top');
    t.eq(top && top.getAttribute('data-badge'), newest && newest.id, '放大的是最近收下的那一枚');
    t.eq(app.text('.alb-v2__medal-top [data-badge-when]'), newest && newest.d, '日期＝組成的卡最晚那一張');
    t.eq(app.$$('.alb-v2__medal-mini').length, Math.min(B.length - 1, 5), '其餘最多五枚小章');
    await app.click('[data-act="go-badges"]');
    await app.at('/badges');
    /* 收一張讓〈水路〉收齊：它變成最近收下的一枚 */
    S.collect('p18', { date: app.APP.fmt.todayMMDD() });
    app.APP.emit('state:change');
    await app.go('/album');
    t.eq(app.$('.alb-v2__medal-top').getAttribute('data-badge'), 'b2', '收齊〈水路〉後換它放大');
    t.eq(app.text('[data-stat="badges"]'), (got.length + 1) + '/' + B.length, '獎章數 +1');
  });

  /* 隱私分軌 */
  t.test('收藏首頁沒有私密回顧分享鍵、/week 有，並呼叫 APP.ui.share', async function (app) {
    await app.reset();
    await app.go('/album');
    t.eq(app.$$('[data-act="share"], [data-share]').length, 0, '首頁沒有分享鍵');
    await app.go('/lookback');
    t.eq(app.$$('[data-act="share"], [data-share]').length, 0, '/lookback 沒有分享');
    await app.go('/week');
    const share = app.$('[data-act="share"]');
    t.ok(share, '/week 有分享鈕');
    let got = null;
    const orig = app.APP.ui.share;
    app.APP.ui.share = function (o) { got = o; };
    if (share) await app.click(share);
    app.APP.ui.share = orig;
    t.eq(got && got.kind, 'week', 'share kind=week');
  });

  /* 2. 回顧走完四幕 */
  t.test('/lookback 走完四幕：done、mood 寫入，回到收藏', async function (app) {
    await app.reset();
    const html = app.doc.documentElement;
    html.removeAttribute('data-still');           /* 定格會直接跳到最後一幕；這裡要一幕一幕走 */
    try {
      await app.go('/lookback');
      const at = function () { const e = app.$('[data-lb]'); return e && e.getAttribute('data-lb-at'); };
      t.eq(at(), '0', '從第一幕開始');
      const want = app.APP.fmt.num(app.MOCK.LOOKBACK.steps);
      const n0 = Number((app.text('[data-lb-steps]') || '').replace(/,/g, ''));
      t.ok(n0 < app.MOCK.LOOKBACK.steps, '步數從 0 往上跳（剛進來是 ' + n0 + '）');
      t.ok(app.$('[data-lb][data-lb-run]'), '數的時候地名先藏著');
      await app.waitFor(function () { return app.text('[data-lb-steps]') === want; }, 5000, '步數數到 LOOKBACK');
      t.ok(true, '步數來自 LOOKBACK');
      t.ok(!app.$('[data-lb][data-lb-run]'), '數完地名出現');
      t.eq(app.$$('[data-zz-at].is-hit').length, app.$$('[data-zz-at]').length, '線上的點都冒出來');
      await app.click('[data-act="next"]');
      t.eq(at(), '1', '第二幕');
      t.includes(app.text('[data-lb-act="1"]'), '今天沒有新的卡', '沒有新卡時照實說');
      await app.click('[data-act="next"]');
      t.eq(at(), '2', '第三幕（照片）');
      await app.click('[data-act="photo"][data-photo="1"]');
      t.eq(at(), '3', '第四幕（心情）');
      await app.click('[data-act="mood"][data-mood="ok"]');
      await app.at('/album', 3000);
      const T0 = app.STATE.all.today;
      t.eq(T0.done, true, 'today.done');
      t.eq(T0.mood, 'ok', 'today.mood');
      t.eq(T0.photo, 1, 'today.photo');
      t.eq(app.route().path, '/album', '回到收藏主頁');
      t.eq(app.text('[data-stat="cards"]'), String(app.STATE.count()), '摘要仍讀當前卡片數');
    } finally {
      html.setAttribute('data-still', '');
    }
  }, { timeout: 15000 });

  t.test('/lookback 定格時直接停在最後一幕', async function (app) {
    await app.reset();
    await app.go('/lookback');
    const e = app.$('[data-lb]');
    t.eq(e && e.getAttribute('data-lb-at'), '3', 'data-still → 第四幕');
    t.eq(app.$$('[data-act="mood"]').length, 3, '心情三選一');
    t.eq(app.text('[data-lb-steps]'), app.APP.fmt.num(app.MOCK.LOOKBACK.steps), '定格不數，直接是終值');
    t.ok(!(e && e.hasAttribute('data-lb-run')), '定格沒有在數');
    t.eq(app.$$('.zigzag text').length, 0, '折線上不寫地名');
    const route = app.text('.alb-lb__route') || '';
    app.MOCK.LOOKBACK.places.forEach(function (p) { t.includes(route, p, '地名整串寫在步數底下：' + p); });
  });

  /* 3. 覆蓋率算出來 */
  t.test('/footprint 覆蓋率是 0–100 的數字、沒有景點圖釘', async function (app) {
    await app.reset();
    await app.go('/footprint');
    const txt = app.text('[data-coverage]');
    const n = Number(txt);
    t.ok(txt !== '' && !isNaN(n) && n >= 0 && n <= 100, '覆蓋率 ' + txt);
    t.ok(n > 0, '初始狀態有去過的地方，覆蓋率 > 0');
    t.eq(app.$$('.spot').length, 0, '.spot 0 顆');
    const svg = app.$('[data-fp-map] svg.map__svg');
    t.ok(svg && svg.childNodes.length > 0 && svg.querySelector('[data-layer="fog"]'), '地圖有畫出來、有霧');
    const bands = app.APP.album.cityColors();
    t.eq(app.$$('.citycolor__band').length, bands.length, '城市顏色色帶＝去過的地方算出來的');
    t.eq(bands.reduce(function (s, b) { return s + b.n; }, 0), app.APP.album.visitedPlaces().length, '每個去過的地方都有算進一道顏色');
    t.ok(app.text('main.view[data-view]').indexOf('90 天') < 0, '不寫「90 天沒回去會變淡」（app 沒有記回訪）');
    const seen = (app.$('[data-fp-map]').getAttribute('data-seen') || '').split(',').filter(Boolean);
    const expect = app.APP.album.footprintSeen().seen;
    t.eq(seen.join(','), expect.join(','), '去過的點＝已收卡對應的地點');
    /* 收一張新的，覆蓋率不會變少 */
    app.STATE.collect('hill', { date: app.APP.fmt.todayMMDD() });
    await app.go('/album');
    await app.go('/footprint');
    t.ok(Number(app.text('[data-coverage]')) >= n, '多收一張後覆蓋率不減');
  });

  /* 明信片 */
  t.test('/postcard/p1 點一下翻面；分享走 APP.ui.share', async function (app) {
    await app.reset();
    await app.go('/postcard/p1');
    const c = app.$('[data-flip]');
    t.ok(c, '有翻面卡');
    await app.click('[data-flip]');
    t.ok(app.$('[data-flip]').classList.contains('is-flipped'), 'is-flipped');
    let got = null;
    const orig = app.APP.ui.share;
    app.APP.ui.share = function (o) { got = o; };
    await app.click('[data-act="share"]');
    app.APP.ui.share = orig;
    t.eq(got && got.kind, 'postcard', 'kind=postcard');
    t.eq(got && got.id, 'p1', 'id=p1');
  });

  /* 金框的框要看得到：畫在 ::after（插圖上面），不是被 --sh-lift 蓋掉、被滿版插圖遮住的 inset 陰影 */
  function goldFrame(app, el) {
    const s = el ? app.win.getComputedStyle(el, '::after') : null;
    return !!s && s.content !== 'none' && /inset/.test(s.boxShadow) && s.boxShadow.indexOf('201, 162, 39') >= 0;
  }

  t.test('搭車卡是金框限定版：框畫在插圖上面看得到；步數用公式', async function (app) {
    await app.reset();
    await app.go('/postcard/p4');
    const card = app.$('.postcard--gold[data-flip]');
    t.ok(card, '金框');
    t.ok(goldFrame(app, card), '金框畫在 ::after（--gold 的 inset 框）：' + (card && app.win.getComputedStyle(card, '::after').boxShadow));
    t.eq(card && app.win.getComputedStyle(card, '::after').backfaceVisibility, 'hidden', '翻面時框跟著正面藏起來');
    t.eq(app.APP.ride.limitedCard('p4'), true, 'p4 是 ride.js 認的限定版');
    t.eq(app.text('[data-ribbon]'), 'yoxi 限定版', '限定版角標');
    await app.go('/postcard/p2');
    const pl = app.APP.place('market');
    const spk = app.MOCK.LOOKBACK.steps / app.MOCK.LOOKBACK.km;
    t.eq(app.text('[data-how]'), '走路 ' + app.APP.fmt.num(pl.dist / 1000 * spk) + ' 步', '走路步數＝距離 × 步幅');
  });

  t.test('/postcard/p11（未收）顯示「還沒去」並能去看地方', async function (app) {
    await app.reset();
    await app.go('/postcard/p11');
    t.includes(app.text('main.view[data-view]'), '還沒去', '還沒去');
    t.ok(!app.$('[data-act="share"]'), '沒收過不給分享');
    t.ok(!app.$('[data-flip]'), '沒收過不翻面');
    const a = app.$('[data-act="go-place"]');
    t.eq(a && a.getAttribute('href'), '#/place/glass-kiln', '看看這個地方 → /place/glass-kiln');
    await app.go('/postcard/zzz');
    t.includes(app.text('main.view[data-view]'), '找不到這張', '找不到這張');
  });

  /* 3. 週回顧數字＝公式 */
  t.test('/week 本週／上週從 STATE＋HEALTH_STEPS 算', async function (app) {
    await app.reset();
    await app.go('/week');
    const w = app.APP.album.weekStats();
    const month = app.MOCK.HEALTH_STEPS.month;
    let sum = 0;
    for (let d = w.now.from; d <= w.now.to; d++) sum += d >= 1 ? (month[d - 1] || 0) : 0;
    t.eq(w.now.steps, sum, '本週步數＝HEALTH_STEPS 相加');
    t.eq(app.text('[data-cmp="steps"] [data-now]'), app.APP.fmt.num(sum), '畫面上的本週步數');
    t.eq(w.prev.to, w.now.from - 1, '上週緊接在本週之前');
    t.eq(app.text('[data-week-places]'), String(w.now.places), '本週地方數');
    const inWeek = app.MOCK.POSTCARDS.filter(function (p) {
      const c = app.STATE.card(p.id);
      if (!c) return false;
      const d = Number(c.date.slice(3, 5));
      return d >= w.now.from && d <= w.now.to;
    }).length;
    t.eq(w.now.places, inWeek, '本週地方數＝本週日期的卡');
  });

  t.test('/elder 傳給家人 toast、返回回 /week', async function (app) {
    await app.reset();
    await app.go('/week');
    await app.click('[data-act="go-elder"]');
    await app.at('/elder');
    await app.click('[data-act="caption"][data-cap-i="2"]');
    t.eq(app.text('[data-elder-big]'), '我今天去走走了', '換一句話');
    await app.click('[data-act="send-family"]');
    await app.waitFor(function () { return /已傳給家人/.test(app.doc.body.textContent); }, 1500, 'toast');
    await app.click('main.view[data-view] a[data-back]');
    await app.at('/week');
  });

  /* 5. 返回鍵 */
  t.test('返回鍵回到來處', async function (app) {
    await app.reset();
    await app.go('/album');
    await app.click('[data-act="go-badges"]');
    await app.at('/badges');
    await app.click('[data-badge="b3"]');
    await app.at('/badge/b3');
    await app.click('[data-member="p1"]');
    await app.at('/postcard/p1');
    await app.click('main.view[data-view] a[data-back]');
    await app.at('/badge/b3');
    await app.click('main.view[data-view] a[data-back]');
    await app.at('/badges');
    await app.click('main.view[data-view] a[data-back]');
    await app.at('/album');
    await app.go('/footprint');
    await app.click('main.view[data-view] a[data-back]');
    await app.at('/album');
  });

  /* 3. 回顧、這一週、城市足跡不再是孤兒頁：收藏首頁的「回顧」一列 */
  t.test('/album「回顧」一列：三格連到 /lookback、/week、/footprint，數字從公式來；今天的回顧只有你、沒有分享', async function (app) {
    await app.reset();
    await app.go('/album');
    const A = app.APP, L = app.MOCK.LOOKBACK;
    [['go-lookback', '#/lookback'], ['go-week', '#/week'], ['go-footprint', '#/footprint']].forEach(function (x) {
      const a = app.$('.alb-v2__look [data-act="' + x[0] + '"]');
      t.eq(a && a.getAttribute('href'), x[1], x[0]);
    });
    t.includes(app.text('[data-look-today]'), A.fmt.num(L.steps), '還沒看今天的回顧：寫今天走的步數（LOOKBACK）');
    t.eq(app.text('[data-look-week]'), String(A.album.weekStats().now.places), '這一週的地方數＝weekStats');
    t.eq(app.text('[data-look-cov]'), String(A.album.coverage()), '覆蓋率＝城市足跡同一個公式');
    t.ok(app.$('[data-look-tile="journal"] [aria-label="只有你看得到"]'), '「今天的回顧」標只有你看得到');
    t.eq(app.$$('main.view [data-act="share"], main.view [data-share]').length, 0, '收藏首頁沒有分享鍵');
    const n = t.countTappables(app);
    t.ok(n <= 12, '可按數 ' + n + ' ≤ 12');
    /* 今天看過回顧：心情與照片出現在那一格 */
    const today = A.fmt.todayMMDD();
    app.STATE.setToday({ done: true, mood: 'low', photo: 2, date: today });
    await app.go('/ride');
    await app.go('/album');
    t.ok(app.$('[data-look-tile="journal"] [data-mood-now="low"]'), '今天的心情');
    t.ok(app.$('[data-look-tile="journal"] [data-look-photo][data-art="' + L.photos[2] + '"]'), '今天選的照片');
    t.includes(app.text('[data-look-today]'), '今天有點累', '心情的字');
    /* 別天留下來的心情不算今天的 */
    app.STATE.setToday({ date: today === '01.01' ? '01.02' : '01.01' });
    await app.go('/ride');
    await app.go('/album');
    t.ok(!app.$('[data-look-tile="journal"] [data-mood-now]'), '別天的心情不掛在今天');
    t.ok(!app.$('[data-look-photo]'), '別天的照片也不掛');
  });

  t.test('舊連結 /album?tab=journal|week|badges：落在收藏首頁、對應那一塊亮一下，網址的 ?tab 拿掉', async function (app) {
    await app.reset();
    const cases = [['journal', '[data-look-tile="journal"]'], ['week', '[data-look-tile="week"]'], ['badges', '.alb-v2__medals']];
    for (const c of cases) {
      await app.go('/album?tab=' + c[0], { expect: '/album' });
      t.ok(app.$(c[1] + '.is-landed'), c[0] + '：' + c[1] + ' 亮一下');
      t.eq(app.APP.nav.current().query.toString(), '', c[0] + '：current() 的 query 清掉');
      t.ok(!/tab=/.test(app.win.location.hash), c[0] + '：網址沒有 ?tab（' + app.win.location.hash + '）');
      t.eq((app.APP.store.get('tabPaths') || {}).album, '/album', c[0] + '：切 tab 回來是乾淨的 /album');
      await app.go('/ride');
    }
  });

  t.test('每日回顧走完：落在收藏首頁，「今天的回顧」那一格亮一下、寫今天的心情', async function (app) {
    await app.reset();
    await app.go('/album');
    await app.click('[data-act="go-lookback"]');
    await app.at('/lookback');
    await app.click('[data-act="mood"][data-mood="good"]');
    await app.at('/album');
    t.eq(app.STATE.all.today.date, app.APP.fmt.todayMMDD(), 'today 記下是哪一天看的');
    t.ok(app.$('[data-look-tile="journal"].is-landed'), '「今天的回顧」亮一下');
    t.ok(app.$('[data-look-tile="journal"] [data-mood-now="good"]'), '今天的心情');
    t.ok(!/tab=/.test(app.win.location.hash), '網址的 ?tab 拿掉了');
  });

  /* 7. 「今天多了一張」只說今天收的 */
  t.test('每日回顧第二幕：lastCard 不是今天收的就不說「今天多了一張」', async function (app) {
    await app.reset();
    const A = app.APP;
    const today = A.fmt.todayMMDD();
    app.STATE.collect('glass-kiln', { date: today === '09.01' ? '09.02' : '09.01' });
    A.emit('state:change');
    t.eq(app.STATE.all.lastCard, 'p11', 'lastCard 是 p11（但不是今天收的）');
    await app.go('/lookback');
    t.ok(app.text('[data-lb-act="1"]').indexOf('今天多了一張') < 0, '不說今天多了一張');
    t.includes(app.text('[data-lb-act="1"]'), '今天沒有新的卡', '照實說今天沒有新的卡');
    app.STATE.collect('neiwan', { date: today });
    A.emit('state:change');
    await app.go('/ride');
    await app.go('/lookback');
    t.includes(app.text('[data-lb-act="1"]'), '今天多了一張', '今天收的才說');
    t.includes(app.text('[data-lb-act="1"]'), '內灣老街', '是今天收的那張');
  });

  /* 8. 長輩圖用分享的那一張 */
  t.test('明信片分享帶 card；/elder?card=p1 那張排第一、選好了（即使不在最近三張裡）', async function (app) {
    await app.reset();
    const A = app.APP;
    await app.go('/postcard/p1');
    let got = null;
    const orig = A.ui.share;
    A.ui.share = function (o) { got = o; };
    await app.click('[data-act="share"]');
    A.ui.share = orig;
    t.eq(got && got.card, 'p1', 'APP.ui.share 帶 card: p1');
    const recent = A.album.recentCards(3).map(function (p) { return p.id; });
    t.ok(recent.indexOf('p1') < 0, 'p1 不在最近三張裡：' + recent.join(','));
    await app.go('/elder?card=p1');
    const picks = app.$$('[data-act="pick-card"]').map(function (b) { return b.getAttribute('data-card'); });
    t.eq(picks[0], 'p1', '分享的那張排第一');
    t.ok(picks.length <= 3, '仍然最多三張：' + picks.join(','));
    t.ok(app.$('[data-act="pick-card"][data-card="p1"].is-on'), '而且是選好的那張');
    t.includes(app.text('[data-elder-small]'), '新竹車站', '圖上寫的是那個地方');
    t.noDeadButtons(app, '/elder?card=p1');
    /* 沒收過的 id：照舊用最近的 */
    await app.go('/elder?card=p11');
    t.eq(app.$('[data-act="pick-card"].is-on').getAttribute('data-card'), recent[0], '沒收過的 card 不理，退回最近那張');
  });

  /* 10. 週回顧的範圍 */
  t.test('/week：標題＝圖表那 7 天；只算日期在範圍裡的卡，範圍之後的另寫一行', async function (app) {
    await app.reset();
    const S = app.STATE, A = app.APP;
    const w0 = A.album.weekStats();
    const dd = function (d) { return String(w0.month).padStart(2, '0') + '.' + String(d).padStart(2, '0'); };
    S.collect('glass-kiln', { date: dd(w0.now.from + 1) });   /* p11：範圍裡 */
    S.collect('neiwan', { date: dd(w0.now.to + 3) });         /* p9：範圍之後、同一個月 */
    S.collect('p10', { date: String(w0.month + 1).padStart(2, '0') + '.03' });   /* 下個月 */
    A.emit('state:change');
    await app.go('/week');
    const w = A.album.weekStats();
    const lab = function (d) { return w.month + '月' + d + '日'; };
    t.eq(app.text('.alb-cover__range'), lab(w.now.from) + ' – ' + lab(w.now.to), '標題是固定的 7 天');
    t.eq(app.$$('.alb-days__col').length, w.now.to - w.now.from + 1, '長條圖的天數＝標題的天數');
    const ids = w.now.cards.map(function (p) { return p.id; });
    t.ok(ids.indexOf('p11') >= 0, '範圍裡的 p11 算進本週');
    t.ok(ids.indexOf('p9') < 0 && ids.indexOf('p10') < 0, '範圍之後的不算：' + ids.join(','));
    t.eq(w.now.after.map(function (p) { return p.id; }).sort().join(','), 'p10,p9', '範圍之後的放在 after');
    t.ok(app.$('.alb-weekcard[data-card="p11"]') && !app.$('.alb-weekcard[data-card="p9"]') && !app.$('.alb-weekcard[data-card="p10"]'),
      '「這一週收的卡」只有範圍裡的');
    t.includes(app.text('[data-week-after]'), String(w.now.after.length), '另一行照實說之後又收了幾張');
    t.eq(app.text('[data-week-places]'), String(w.now.places), '畫面地方數＝weekStats');
    t.noBannedWords(app, { msg: '/week' });
  });

  /* 11. 同一天收的卡 */
  t.test('同一天收的卡：最後收的（lastCard）排最前面，主卡疊卡與長輩圖預設都跟著', async function (app) {
    for (const order of [['glass-kiln', 'neiwan', 'p9'], ['neiwan', 'glass-kiln', 'p11']]) {
      await app.reset({ cards: [{ id: order[0] }, { id: order[1] }] });   /* 同一天（今天）連收兩張 */
      const S = app.STATE, A = app.APP;
      t.eq(S.all.lastCard, order[2], 'lastCard 是 ' + order[2]);
      t.eq(A.album.recentCards(3)[0].id, order[2], 'recentCards 第一張是 ' + order[2]);
      await app.go('/album');
      t.eq(app.$('.alb-v2__stack-art--0').getAttribute('data-card'), order[2], '疊卡最上面是 ' + order[2]);
      await app.go('/elder');
      t.eq(app.$('[data-act="pick-card"].is-on').getAttribute('data-card'), order[2], '長輩圖預設是 ' + order[2]);
    }
  });

  /* 6. 限定版只看 ride.js */
  t.test('搭 yoxi 去走得到的玻璃窯（900 m）：金框，但角標寫「yoxi 金框」不是「yoxi 限定版」', async function (app) {
    await app.reset({ cards: [{ id: 'glass-kiln', by: 'ride', km: 1 }] });
    const A = app.APP;
    t.eq(A.ride.limitedCard('p11'), false, 'ride.js：p11 不是限定版（走得到、沒有 +50）');
    await app.go('/postcard/p11');
    const card = app.$('[data-flip]');
    t.ok(card && card.classList.contains('postcard--gold'), '搭車收的是金框');
    t.ok(goldFrame(app, card), '框看得到');
    t.eq(app.$('[data-ribbon]') && app.$('[data-ribbon]').getAttribute('data-ribbon'), 'gold', '角標是金框那一種');
    t.eq(app.text('[data-ribbon]'), 'yoxi 金框', '角標寫 yoxi 金框');
    t.ok(app.text('main.view[data-view]').indexOf('限定版') < 0, '整頁不寫限定版');
    /* 走路收的：照 cardStyleOf 決定有沒有框，沒有限定版 */
    await app.go('/postcard/p2');
    const gold2 = !!(A.explore.cardStyleOf('p2') || {}).gold;
    t.eq(!!app.$('[data-flip].postcard--gold'), gold2, 'p2 的框跟收下的款式一致');
    t.ok(!app.$('[data-ribbon="limited"]'), 'p2 沒有限定版角標');
  });

  /* 5. /postcards 的金框 */
  t.test('/postcards：金框的明信片在收藏裡也是金框（框畫在圖上面）', async function (app) {
    await app.reset();
    await app.go('/postcards');
    const A = app.APP;
    const cells = app.$$('[data-group="got"] [data-card]');
    t.ok(cells.length > 0, '有收下的格子');
    cells.forEach(function (el) {
      const id = el.getAttribute('data-card');
      const gold = !!(A.explore.cardStyleOf(id) || {}).gold;
      t.eq(el.classList.contains('is-gold'), gold, id + '：金框 class ＝ cardStyleOf');
      if (gold) t.ok(goldFrame(app, el.querySelector('.alb-v2__art')), id + '：框看得到');
    });
    t.ok(app.$('[data-group="got"] .is-gold[data-card="p4"]'), '搭車收的 p4 是金框');
  });

  /* 11b. 疊卡是最新收下的三張：照收下的先後，不是明信片編號 */
  t.test('連收三張：主卡疊卡與 /postcards 都照收下的先後；跨年新收的也排最前面', async function (app) {
    await app.reset();
    const S = app.STATE, A = app.APP, today = A.fmt.todayMMDD();
    const ids = function (els) { return els.map(function (el) { return el.getAttribute('data-card'); }).join(','); };
    /* 之前同一天只把 lastCard 提前、其餘照編號倒序：這一組會排成 p10,p11,p9 */
    ['glass-kiln', 'neiwan', 'p10'].forEach(function (id) { S.collect(id, { date: today }); });
    A.emit('state:change');
    t.eq(A.album.recentCards(3).map(function (p) { return p.id; }).join(','), 'p10,p9,p11', 'recentCards：最後收的在前');
    await app.go('/album');
    t.eq(ids(app.$$('.alb-v2__stack [data-card]')), 'p10,p9,p11', '疊卡由上到下 p10、p9、p11');
    await app.go('/postcards');
    t.eq(ids(app.$$('[data-group="got"] [data-card]').slice(0, 3)), 'p10,p9,p11', '/postcards 前三格也是');
    /* 跨年：01.05 比 demo 的 09.xx「小」，只比日期會排到最後 */
    S.collect('p12', { date: '01.05' });
    A.emit('state:change');
    await app.go('/album');
    t.eq(app.$('.alb-v2__stack-art--0').getAttribute('data-card'), 'p12', '跨年新收的在最上面');
  });

  /* 5c. 還沒生成成品的明信片（p12–p22）：收下之後在收藏裡是實景照片＋畫風濾鏡，不是插圖 */
  t.test('十八尖山的防空洞（p21，沒有生成成品）：收藏各處都是照片＋抽到的畫風，詳情寫照片出處', async function (app) {
    await app.reset();
    const A = app.APP;
    T.helpers.collect(app, 'hill', { style: 'oil' });
    const ph = A.explore.cardPhoto('p21');
    t.eq(A.explore.postcardSrc('p21', 'oil'), '', '前提：p21 沒有生成成品');
    t.ok(ph && ph.file === 'p21-1.jpg', '前提：p21 有自己的實景照片');
    const photoOf = function (sel) {
      const img = app.$(sel + ' > img.card-gen');
      return !!img && img.classList.contains('card-gen--photo') && img.getAttribute('src').endsWith('p21-1.jpg') &&
        img.getAttribute('data-style') === 'oil';
    };
    await app.go('/postcards');
    await app.tick(60);
    const cell = '[data-group="got"] [data-card="p21"] [data-card-art]';
    t.ok(photoOf(cell), '/postcards：照片＋油畫');
    const img = app.$(cell + ' > img.card-gen');
    t.ok(img && /exf-oil/.test(app.win.getComputedStyle(img).filter), '套的是油畫濾鏡：' + (img && app.win.getComputedStyle(img).filter));
    t.ok(app.doc.getElementById('exf-oil'), '濾鏡定義放進文件了（不用先開過 /unlock）');
    t.eq(app.win.getComputedStyle(app.$(cell + ' > .postcard__art')).visibility, 'hidden', '底下的插圖藏起來（不從濾鏡的柔邊透出來）');
    t.includes(app.text('main.view[data-view]'), '實景照片', '頁底說明寫底圖是實景照片');
    await app.go('/album');
    await app.tick(60);
    t.eq(app.$('.alb-v2__stack-art--0').getAttribute('data-card'), 'p21', '收藏首頁最上面是剛收的 p21');
    t.ok(photoOf('.alb-v2__stack-art--0'), '疊卡也是照片＋油畫');
    await app.go('/postcard/p21');
    await app.tick(60);
    t.ok(photoOf('[data-flip] [data-card-art]'), '詳情也是照片＋油畫');
    t.includes(app.text('[data-credit]'), ph.author, '詳情寫照片作者');
    t.includes(app.text('[data-credit]'), ph.licence, '詳情寫授權');
    const a = app.$('[data-credit] a');
    t.ok(a && a.getAttribute('href') === ph.source && a.getAttribute('target') === '_blank', '出處連到原始頁面');
    t.noDeadButtons(app, '/postcard/p21');
    t.ok(t.countTappables(app) <= 10, '可按數 ' + t.countTappables(app) + ' ≤ 10');
    /* 有成品的卡照舊用成品，也寫照片出處（成品是從那張照片生成的） */
    await app.go('/postcard/p1');
    await app.tick(60);
    const gen = app.$('[data-flip] [data-card-art] > img.card-gen');
    t.ok(gen && !gen.classList.contains('card-gen--photo'), 'p1 用生成的成品');
    t.includes(app.text('[data-credit]'), '底圖照片', 'p1 也寫底圖照片出處');
    /* 週回顧的卡以前只有插圖（沒有 data-card-art）：現在也是收下的那一款 */
    await app.go('/week');
    await app.tick(60);
    app.$$('.alb-weekcard').forEach(function (el) {
      const id = el.getAttribute('data-card');
      t.ok(el.querySelector('[data-card-art="' + id + '"] > img.card-gen'), '週回顧 ' + id + '：收下的那一款');
    });
    app.$$('.alb-cover__cell').forEach(function (el) {
      t.ok(el.querySelector(':scope > img.card-gen'), '週回顧封面 ' + el.getAttribute('data-card-art') + '：收下的那一款');
    });
  });

  /* 5b. 金框卡在收藏哪裡都有金框和金粉（data-gold-aura → explore-gold.js） */
  t.test('金框卡在收藏各處都有金框和金粉：疊卡、/postcards、詳情、獎章、回顧、週回顧', async function (app) {
    await app.reset();
    const A = app.APP, S = app.STATE;
    const gold = function (id) { return !!(A.explore.cardStyleOf(id) || {}).gold; };
    await app.go('/album');
    app.$$('.alb-v2__stack [data-card]').forEach(function (el) {
      const id = el.getAttribute('data-card');
      t.eq(el.hasAttribute('data-gold-aura'), gold(id), '疊卡 ' + id + '：金粉 ＝ 金框');
      t.eq(el.classList.contains('is-gold'), gold(id), '疊卡 ' + id + '：金邊 ＝ 金框');
    });
    const top = app.$('.alb-v2__stack [data-card="p8"]');
    t.ok(top && top.hasAttribute('data-gold-aura'), '初始最上面的 p8（搭車收的）有金粉');
    t.eq(top && app.win.getComputedStyle(top).borderTopColor, 'rgb(201, 162, 39)', '疊卡的金邊是 --gold');
    await app.go('/postcards');
    app.$$('[data-group="got"] [data-card]').forEach(function (el) {
      const id = el.getAttribute('data-card');
      t.eq(!!el.querySelector('.alb-v2__art[data-gold-aura]'), gold(id), '/postcards ' + id + '：金粉從畫金框的那張圖冒出來');
    });
    t.eq(app.$$('[data-group="todo"] [data-gold-aura]').length, 0, '還沒去的沒有金粉');
    await app.go('/postcard/p4');
    t.ok(app.$('[data-flip].postcard--gold[data-gold-aura]'), '詳情：整張卡（翻到背面也是）');
    await app.go('/postcard/p1');
    t.eq(!!app.$('main.view [data-gold-aura]'), gold('p1'), '詳情 p1：照收下的款式');
    await app.go('/badge/b2');
    ['p3', 'p4', 'p8', 'p18'].forEach(function (id) {
      const pic = app.$('[data-member="' + id + '"] .alb-member__pic');
      const g = S.has(id) && gold(id);
      t.eq(!!(pic && pic.hasAttribute('data-gold-aura')), g, '獎章的組成卡 ' + id + '：金粉 ＝ 金框');
      if (g) t.ok(goldFrame(app, pic), '獎章的組成卡 ' + id + '：框看得到');
    });
    /* 今天搭車收的 p11：每日回顧「今天多了一張」、週回顧（在範圍裡的話）也是金框 */
    S.collect('glass-kiln', { date: A.fmt.todayMMDD(), by: 'ride', km: 1 });
    A.emit('state:change');
    await app.go('/lookback');
    const lb = app.$('.alb-lb__card .postcard');
    t.ok(lb && lb.hasAttribute('data-gold-aura') && goldFrame(app, lb), '每日回顧：今天收的金框卡有框和金粉');
    await app.go('/week');
    app.$$('.alb-weekcard').forEach(function (el) {
      const id = el.getAttribute('data-card');
      t.eq(!!el.querySelector('[data-gold-aura]'), gold(id), '週回顧 ' + id + '：金粉 ＝ 金框');
    });
    /* 測試跑在 ?still=1（減少動態效果）：框照舊，但不建 canvas、不追蹤 */
    t.ok(!app.doc.querySelector('canvas.gold-aura'), 'still：沒有金粉的 canvas');
    t.eq(A.fx.gold.tracked(), 0, 'still：不追蹤');
  });

  /* 12. 0 張卡的空狀態 */
  t.test('0 張卡：首頁不拿還沒收的獎章放大、足跡沒有顏色、長輩圖不說「用你去過的地方做的」', async function (app) {
    await app.reset();
    const A0 = app.STATE.all;
    A0.cards = {}; A0.km = 0; A0.lastCard = null; A0.lastSeen = null;
    app.STATE.setToday({ photo: null, mood: null, done: false });
    app.APP.emit('state:change');
    await app.go('/album');
    t.ok(app.$('[data-medal-empty]'), '獎章卡是空的章位');
    t.ok(!app.$('.alb-v2__medal-top[data-badge]'), '沒有放大一枚還沒收的章');
    t.eq(app.text('[data-stat="places"]'), '0', '去過的地方 0');
    t.noDeadButtons(app, '/album（0 張）');
    t.noBannedWords(app, { msg: '/album（0 張）' });
    await app.go('/footprint');
    t.eq(app.$$('.citycolor__band').length, 0, '沒有城市顏色');
    t.ok(app.$('[data-citycolor-empty]'), '寫還沒有顏色');
    t.eq(app.text('[data-coverage]'), '0', '覆蓋率 0');
    await app.go('/elder');
    t.ok(app.$('[data-elder-empty]'), '長輩圖的空狀態文案');
    t.ok(app.text('main.view[data-view]').indexOf('用你去過的地方做的') < 0, '不說用你去過的地方做的');
    t.eq(app.$$('[data-act="pick-card"]').length, 0, '沒有地方可以換');
    t.noDeadButtons(app, '/elder（0 張）');
  });

  /* 14. 可按的東西至少 44×44 */
  t.test('收藏各頁的關閉鍵、分享、先離開、足跡返回都至少 44×44', async function (app) {
    await app.reset();
    const size = function (sel) {
      const el = app.$(sel);
      const r = el ? el.getBoundingClientRect() : { width: 0, height: 0 };
      return [Math.round(r.width), Math.round(r.height)];
    };
    const big = function (wh) { return wh[0] >= 44 && wh[1] >= 44; };
    await app.go('/postcard/p1');
    t.ok(big(size('main.view .hdr-red__close')), '明信片關閉鍵 ' + size('main.view .hdr-red__close'));
    t.ok(big(size('main.view [data-act="share"]')), '分享 ' + size('main.view [data-act="share"]'));
    await app.go('/footprint');
    t.ok(big(size('main.view .alb-fp__back')), '足跡返回 ' + size('main.view .alb-fp__back'));
    await app.go('/lookback');
    t.ok(big(size('main.view .alb-lb__exit')), '先離開 ' + size('main.view .alb-lb__exit'));
  });
});
