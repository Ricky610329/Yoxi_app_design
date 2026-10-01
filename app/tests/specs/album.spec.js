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

  /* 3. 收藏首頁只做索引：明信片與獎章保留，去過地方／距離不另做重複統計 */
  t.test('/album 保留明信片與獎章摘要，不重複放地方／距離統計', async function (app) {
    await app.reset();
    await app.go('/album');
    const S = app.STATE, B = app.MOCK.BADGES;
    t.eq(app.text('[data-stat="cards"]'), String(S.count()), '明信片張數');
    const got = B.filter(function (b) { return S.badge(b.id).got; }).length;
    t.eq(app.text('[data-stat="badges"]'), got + '/' + B.length, '獎章 已獲得/總數');
    t.eq(app.$$('[data-stat="places"], [data-stat="km"]').length, 0, '首頁沒有重複的地方／距離統計');
  });

  /* 9. 去過的地方＝不重複的地方，不是卡片張數（p3／p19 都是護城河、p6／p21 都是十八尖山） */
  t.test('「去過的地方」數不重複的地方：收 p19、p21 之後仍跟城市足跡一致', async function (app) {
    await app.reset();
    const S = app.STATE, A = app.APP;
    const n0 = A.album.visitedPlaces().length;
    t.eq(n0, A.album.footprintSeen().seen.length + A.album.footprintSeen().missing.length, '一開始＝足跡上的點');
    A.state.collect('moat', { date: A.fmt.todayMMDD() });     /* p19：護城河的第二張 */
    A.state.collect('hill', { date: A.fmt.todayMMDD() });     /* p21：十八尖山的第二張 */
    t.ok(S.has('p19') && S.has('p21'), '收下 p19、p21');
    await app.go('/album');
    t.eq(A.album.visitedPlaces().length, n0, '去過的地方不變（同一個地方的第二張）');
    t.eq(A.album.visitedPlaces().length, A.album.footprintSeen().seen.length, '＝城市足跡的點數');
    t.eq(app.text('[data-stat="cards"]'), String(S.count()), '明信片張數 +2');
    t.eq(app.$$('[data-stat="places"], [data-stat="km"]').length, 0, '首頁不另外重複地方／距離');
  });

  /* 2. 收卡之後：多一格「新」，mount 後 lastIsNew 變 false；明信片摘要 +1 */
  t.test('collect 後 /album 多一格「新」，看過就不再是新的', async function (app) {
    await app.reset();
    await app.go('/album');
    t.eq(app.$$('.postcard__new').length, 0, '一開始沒有「新」');
    const before = app.STATE.count();
    t.ok(app.APP.state.collect('glass-kiln', { date: app.APP.fmt.todayMMDD() }), 'collect 成功');
    t.ok(app.STATE.lastIsNew, 'collect 後 lastIsNew');
    await app.go('/ride');
    await app.go('/album');
    const fresh = app.$$('.postcard__new');
    t.eq(fresh.length, 1, '一格「新」');
    const cell = fresh[0] && fresh[0].closest('[data-card]');
    t.eq(cell && cell.getAttribute('data-card'), 'p11', '「新」在 p11（水利路老玻璃窯）');
    t.eq(app.STATE.lastIsNew, false, 'mount 後 markLastSeen');
    t.eq(app.text('[data-stat="cards"]'), String(before + 1), '明信片摘要 +1');
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
    t.ok(!app.$('main.view [data-act="go-elder"]'), '週回顧沒有獨立長輩圖入口');
    await app.click('main.view [data-act="share"]');
    await app.click('.sys-share [data-act="share-family"]');
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
    app.APP.state.collect('p18', { date: app.APP.fmt.todayMMDD() });
    await app.go('/album');
    t.eq(app.$('.alb-v2__medal-top').getAttribute('data-badge'), 'b2', '收齊〈水路〉後換它放大');
    t.eq(app.text('[data-stat="badges"]'), (got.length + 1) + '/' + B.length, '獎章數 +1');
  });

  /* 一屏：量桌機外框（390×844 縮放、狀態列 54px，跟有瀏海的手機一樣）。測試 iframe 本身是手機版、狀態列只有 12px，
     在那裡量會少算 42px（2026-09-27 就是這樣漏掉的）。 */
  t.test('/album 一屏：桌機外框（含狀態列）不用往下捲（預設、回訪、0 張都一樣）；沒有相框與稱號', async function (app) {
    const fr = app.win.frameElement;
    const fits = function (msg) {
      const s = app.$('main.view .alb-v2__scroll');
      t.ok(s && s.scrollHeight <= s.clientHeight + 1, msg + '：不用捲 ' + (s && s.scrollHeight) + ' ≤ ' + (s && s.clientHeight));
    };
    const size = async function (w, h) {
      fr.style.width = w ? w + 'px' : ''; fr.style.height = h ? h + 'px' : '';
      fr.getBoundingClientRect();
      await app.tick(60);
      app.APP.fitDevice();
      await app.tick(60);
    };
    await app.reset();
    await size(1280, 720);
    try {
      await app.go('/album');
      t.eq(app.doc.documentElement.getAttribute('data-layout'), 'desktop', '桌機外框');
      t.ok(!app.$('[data-act="go-rewards"], .alb-v2__rw, [data-look-title]'), '沒有相框與稱號的入口、頁首沒有稱號');
      fits('預設');
      app.APP.explore.collect('station');           /* 回訪：主卡多一句 */
      await app.go('/album');
      fits('回訪');
      const A0 = app.STATE.all;
      A0.cards = {}; A0.km = 0; A0.lastCard = null; A0.lastSeen = null;
      await app.go('/album');
      fits('0 張');
    } finally {
      await size(null, null);
      await app.reset();
    }
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

  function setUpload(app, name, type, bytes) {
    const input = app.$('[data-memory-upload]');
    const file = new app.win.File([bytes], name, { type: type });
    try {
      const dt = new app.win.DataTransfer(); dt.items.add(file); input.files = dt.files;
    } catch (e) { Object.defineProperty(input, 'files', { configurable: true, value: [file] }); }
    input.dispatchEvent(new app.win.Event('change', { bubbles: true }));
  }

  t.test('/lookback 以到訪卡為主體：左右換模板、選心情，只有一個主要動作', async function (app) {
    await app.reset();
    await app.go('/lookback');
    const before = JSON.stringify(app.STATE.all.today || {});
    const M = app.APP.album.memory, T0 = M.templates();
    const faces = app.$$('[data-act="pick-memory-template"]');
    t.eq(faces.length, T0.places.length, '模板數＝可用到訪地點');
    t.eq(T0.today, false, '初始沒有今天新到訪，使用最近去過的地方');
    t.ok(faces[0].classList.contains('is-selected') && faces[0].getAttribute('aria-pressed') === 'true', '第一張預選');
    t.ok(faces.every(function (f) { return app.STATE.has(f.getAttribute('data-card')); }), '沒有未收的模板');
    const tones = app.$$('[data-act="memory-mood"]');
    t.eq(tones.map(function (b) { return (b.textContent || '').trim(); }).join('／'), '晴光／柔光／暮色', '三選一是光線，不是心情');
    t.ok(tones.every(function (b) { return b.querySelector('svg') && !b.querySelector('[data-icon^="mood"]'); }), '光線用自己的圖示，沒有笑臉');
    ['開心', '平靜', '放鬆'].forEach(function (w) { t.ok(app.text('main.view[data-view]').indexOf(w) < 0, '畫面上沒有「' + w + '」'); });
    t.eq(app.$$('.memory-face .memory-stamp, .memory-face [data-memory-credit], .memory-face .memory-demo-mark').length, 0, '卡面不蓋郵戳、不印底圖署名、不標構圖示意');
    t.eq(app.text('.memory-top'), '', '頁首只有關閉鍵，沒有品牌字與日期');
    t.eq(app.$$('[data-act="make-memory"]').length, 1, '只有一個主要動作');
    t.eq(app.$$('main.view select, main.view [data-act="preview-memory"], main.view [data-act="save-memory"]').length, 0, '沒有表單選單或分開預覽／儲存');
    if (faces[1]) {
      await app.click(faces[1]);
      t.ok(faces[1].classList.contains('is-selected') && !faces[0].classList.contains('is-selected'), '點卡片換模板');
    }
    const selected = app.$('[data-act="pick-memory-template"].is-selected');
    await app.click('[data-act="memory-mood"][data-mood="low"]');
    t.eq(selected.getAttribute('data-memory-mood'), 'low', '心情直接改在卡片主體');
    t.ok(selected.querySelector('.memory-template-art'), '沒有自己的照片時使用地點模板');
    t.eq(JSON.stringify(app.STATE.all.today || {}), before, '換模板與心情都還沒寫入');
    t.eq(app.$$('main.view .memory-heading p, main.view .memory-keeps h2, main.view .memory-keeps p').length, 0, '標題下、收納列都沒有說明小字');
    t.eq(app.text('[data-memory-status]'), '', '還沒按之前沒有說明小字');
  });

  /* 桌機滑鼠不能拖捲動列：兩顆小箭頭、左右方向鍵、滑鼠拖曳都要換得到模板 */
  t.test('/lookback 小箭頭、方向鍵、滑鼠拖曳都能左右換模板；到頭那一邊的箭頭不畫', async function (app) {
    await app.reset();
    await app.go('/lookback');
    const faces = app.$$('[data-act="pick-memory-template"]');
    const prev = app.$('[data-act="step-memory-template"][data-step="-1"]'), next = app.$('[data-act="step-memory-template"][data-step="1"]');
    const at = function () { return faces.indexOf(app.$('[data-act="pick-memory-template"].is-selected')); };
    t.ok(prev && next, '有上一張／下一張兩顆小箭頭');
    if (!prev || !next) return;
    t.ok(prev.hidden, '第一張時沒有上一張');
    if (faces.length < 2) { t.ok(next.hidden, '只有一張時也沒有下一張'); return; }
    t.ok(!next.hidden, '第一張時有下一張');
    await app.click(next);
    t.eq(at(), 1, '按下一張換到第二張');
    t.ok(!prev.hidden, '第二張起有上一張');
    await app.click(prev);
    t.eq(at(), 0, '按上一張回到第一張');
    for (let i = 1; i < faces.length; i++) await app.click(next);
    t.eq(at(), faces.length - 1, '一路按到最後一張');
    t.ok(next.hidden && !prev.hidden, '最後一張時只剩上一張');
    const key = function (k) { faces[at()].dispatchEvent(new app.win.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); };
    key('ArrowLeft');
    t.eq(at(), faces.length - 2, '← 換到前一張');
    key('ArrowRight');
    t.eq(at(), faces.length - 1, '→ 換到後一張');
    await app.tick(200);
    const track = app.$('[data-memory-templates]');
    const ptr = function (type, x) { track.dispatchEvent(new app.win.PointerEvent(type, { pointerType: 'mouse', pointerId: 1, button: 0, clientX: x, bubbles: true, cancelable: true })); };
    const left0 = track.scrollLeft;
    ptr('pointerdown', 100); ptr('pointermove', 180);
    t.ok(track.classList.contains('is-dragging') && track.scrollLeft < left0, '拖的時候卡片跟著走 ' + left0 + ' → ' + track.scrollLeft);
    ptr('pointerup', 180);
    t.eq(at(), faces.length - 2, '往右拖放開換到前一張');
    faces[faces.length - 1].click();
    t.eq(at(), faces.length - 2, '放開後補的那一下 click 不算點卡');
    await app.tick(200);
    t.ok(!track.classList.contains('is-dragging'), '停下來後吸附開回來');
    await app.click(faces[0]);
    t.eq(at(), 0, '拖完之後點卡照常換');
    t.eq(app.$$('[data-act="step-memory-template"]:not([hidden])').length, 1, '回到第一張只剩下一張');
  });

  t.test('/lookback 上傳自己的照片可替換模板、移除可還原；格式錯誤會顯示原因', async function (app) {
    await app.reset();
    await app.go('/lookback');
    const count0 = app.STATE.count(), points0 = app.STATE.points;
    const selected = app.$('[data-act="pick-memory-template"].is-selected');
    setUpload(app, 'note.txt', 'text/plain', 'not an image');
    t.includes(app.text('[data-memory-status]'), 'JPG、PNG 或 WebP', '錯誤格式有原因');
    const raw = app.win.atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n1cAAAAASUVORK5CYII=');
    const bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    setUpload(app, 'memory.png', 'image/png', bytes);
    await app.waitFor(function () { return !!selected.querySelector('.memory-own-photo'); }, 2500, '自己的照片進入卡面');
    const jpeg = selected.querySelector('.memory-own-photo').getAttribute('src');
    t.ok(/^data:image\/jpeg;base64,/.test(jpeg), '圖片在本機縮圖後轉成 JPEG');
    t.includes(app.text('[data-photo-label]'), '換一張', '上傳後可替換');
    t.ok(!selected.querySelector('[data-memory-credit]'), '自己的照片也不印署名');
    t.ok(!app.$('[data-act="remove-memory-photo"]').hidden, '移除照片可用');
    t.eq(app.STATE.count(), count0, '上傳不改原明信片');
    t.eq(app.STATE.points, points0, '上傳不改點數');
    await app.click('[data-act="remove-memory-photo"]');
    t.ok(selected.querySelector('.memory-template-art') && !selected.querySelector('.memory-own-photo'), '移除後回到地點模板');
    setUpload(app, 'memory.png', 'image/png', bytes);
    await app.waitFor(function () { return !!selected.querySelector('.memory-own-photo'); }, 2500, '再次放入自己的照片');
    await app.click('[data-act="memory-mood"][data-mood="low"]');
    await app.click('[data-act="make-memory"]');
    const item = app.STATE.all.today.memoryCards[0];
    t.ok(item && /^data:image\/jpeg;base64,/.test(item.photo), '保存本機 JPEG data URL');
    t.eq(item.mood, 'low', '保存心情');
    t.eq(item.date, app.APP.fmt.todayMMDD(), '保存製卡日期');
    await app.reload('/lookback');
    await app.at('/lookback');
    await app.click('[data-act="open-memory"][data-memory-id="' + item.id + '"]');
    const reopened = app.$('[data-act="pick-memory-template"].is-selected');
    t.eq(reopened.getAttribute('data-memory-mood'), 'low', '重開後心情一致');
    t.eq(reopened.querySelector('.memory-own-photo').getAttribute('src'), item.photo, '重開後照片一致');
    t.includes(app.$('[data-act="open-memory"][data-memory-id="' + item.id + '"]').getAttribute('aria-label'), item.date, '重開後日期一致（卡面不印日期，縮圖的讀屏標籤帶著）');
    t.eq(app.STATE.count(), count0, '保存回憶卡也不改原明信片');
    t.eq(app.STATE.points, points0, '保存回憶卡也不改點數');
  });

  t.test('/lookback 做成我的卡後留在本頁、不可重複；重載後小卡可重開', async function (app) {
    await app.reset();
    await app.go('/lookback');
    const face = app.$('[data-act="pick-memory-template"].is-selected');
    const cardId = face.getAttribute('data-card');
    await app.click('[data-act="memory-mood"][data-mood="ok"]');
    await app.click('[data-act="make-memory"]');
    t.eq(app.route().path, '/lookback', '做成後留在本頁');
    const saved = app.STATE.all.today.memoryCards;
    t.eq(saved.length, 1, '儲存一張');
    t.eq(saved[0].cardId, cardId, '記下明信片 id');
    t.eq(saved[0].mood, 'ok', '記下心情');
    t.includes(saved[0].prompt, app.APP.album.memory.places().filter(function (p) { return p.id === cardId; })[0].name, '描述反映地點');
    t.ok(app.$('[data-act="make-memory"]').disabled, '同一版儲存後按鈕停用');
    await app.click('[data-act="make-memory"]');
    t.eq(app.STATE.all.today.memoryCards.length, 1, '重複點不會多存一張');
    t.ok(app.$('[data-act="open-memory"][data-memory-id="' + saved[0].id + '"]'), '已收下的小卡出現');
    await app.reload('/lookback');
    await app.at('/lookback');
    const kept = app.$('[data-act="open-memory"][data-memory-id="' + saved[0].id + '"]');
    t.ok(kept, '重載後仍有小卡');
    await app.click(kept);
    t.ok(app.$('[data-act="make-memory"]').disabled, '重開成品不會再存一次');
    t.includes(app.text('[data-memory-status]'), '已留在這裡', '畫面說明是已存成品');
    await app.go('/album');
    t.eq(app.text('[data-look-today]'), '1', '收藏首頁顯示一張回憶卡');
  });

  t.test('/lookback 直接返回不寫入，返回目標保留 journal 錨點', async function (app) {
    await app.reset({ hash: '/lookback' });
    await app.at('/lookback');
    const before = JSON.stringify(app.STATE.all.today || {});
    await app.click('[data-act="memory-mood"][data-mood="low"]');
    const backLink = app.$('main.view[data-view] a[data-back]');
    t.eq(backLink.getAttribute('data-back'), '/album?tab=journal', '直接進入的返回目標');
    await app.click(backLink);
    await app.at('/album');
    t.eq(JSON.stringify(app.STATE.all.today || {}), before, '離開而未做成卡不寫入');
  });

  /* 一屏：卡片吃剩下的高度，其他列固定。量桌機外框（狀態列 54px）與矮手機；收納列一直在，做了卡也不會把按鈕擠出去 */
  t.test('/lookback 一屏：桌機外框與 375×667 都不用捲，卡片、光線、製卡鈕、收納列都在畫面內（做了三張也一樣）', async function (app) {
    const fr = app.win.frameElement;
    const size = async function (w, h) {
      fr.style.width = w ? w + 'px' : ''; fr.style.height = h ? h + 'px' : '';
      fr.getBoundingClientRect();
      await app.tick(60);
      app.APP.fitDevice();
      await app.tick(60);
    };
    const fits = function (msg) {
      const body = app.$('main.view .memory-body'), bottom = app.$('main.view .memory-room').getBoundingClientRect().bottom;
      t.ok(body && body.scrollHeight <= body.clientHeight + 1, msg + '：不用捲 ' + (body && body.scrollHeight) + ' ≤ ' + (body && body.clientHeight));
      ['[data-act="pick-memory-template"].is-selected', '[data-act="memory-mood"]', '[data-act="make-memory"]', '[data-memory-keeps]'].forEach(function (sel) {
        const r = app.$(sel).getBoundingClientRect();
        t.ok(r.height > 0 && r.bottom <= bottom + 1, msg + '：' + sel + ' 底 ' + Math.round(r.bottom) + ' ≤ ' + Math.round(bottom));
      });
      const face = app.$('[data-act="pick-memory-template"].is-selected').getBoundingClientRect();
      t.ok(face.height >= 150, msg + '：卡片高 ' + Math.round(face.height));
    };
    try {
      for (const sz of [[1280, 720], [375, 667]]) {
        const tag = sz.join('×');
        await app.reset();
        await size(sz[0], sz[1]);
        await app.go('/lookback');
        fits(tag + ' 還沒做卡');
        const faces = app.$$('[data-act="pick-memory-template"]');
        for (let i = 0; i < 3 && i < faces.length; i++) {
          await app.click(faces[i]);
          await app.click('[data-act="make-memory"]');
        }
        t.eq(app.$$('[data-act="open-memory"]').length, Math.min(3, faces.length), tag + '：三張小卡');
        fits(tag + ' 做了三張');
      }
    } finally {
      await size(null, null);
      await app.reset();
    }
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
    t.ok(svg && svg.childNodes.length > 0 && svg.querySelector('[data-layer="building"]'), '紙本地圖有建物底圖');
    t.eq(app.$$('.citycolor, .citycolor__band, [data-citycolor]').length, 0, '沒有任意城市色帶');
    const seenLayer = svg.querySelector('[data-layer="seenArea"]');
    t.ok(seenLayer && Number(seenLayer.getAttribute('data-seen-count')) === app.APP.album.footprintSeen().seen.length, '已訪區域數對應可定位足跡');
    t.ok(seenLayer.querySelector('.alb-fp__seen-area'), '非道路已訪色層存在');
    t.ok(svg.querySelector('[data-layer="roadMajor"]') && svg.querySelector('[data-layer="roadMinor"]'), '道路仍保留');
    const layers = Array.prototype.slice.call(svg.children);
    const building = svg.querySelector('[data-layer="building"]'), water = svg.querySelector('[data-layer="waterArea"], [data-layer="water"], [data-layer="coast"]');
    t.ok(layers.indexOf(building) < layers.indexOf(seenLayer), '建物在已訪色層下方');
    t.ok(!water || layers.indexOf(seenLayer) < layers.indexOf(water), '河流蓋在已訪色層上方');
    t.ok(layers.indexOf(seenLayer) < layers.indexOf(svg.querySelector('[data-layer="roadMajor"]')), '道路蓋在已訪色層上方');
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
    await app.click('[data-flip]');
    t.ok(!app.$('[data-flip]').classList.contains('is-flipped'), '再點一下翻回正面');
    /* 卡片底下不寫操作提示，頁尾不放「再來的話」與一天一張的說明 */
    t.ok(!app.$('.alb-hint') && !app.$('[data-act="again"]'), '沒有翻面提示、沒有「再來的話」');
  });

  /* 那一句排成題字（斷行規則 explore-verse.js 的 verseLines，單元測試掃整張表）：
     一個短句一行、句尾標點另包一層（CSS 懸出去），字不增不減，而且短句本身沒有再被折成兩行 */
  t.test('/postcard/p7 那一句一個短句一行，textContent 還是原句', async function (app) {
    await app.reset();
    await app.go('/postcard/p7');
    const E = app.APP.explore;
    const want = E.verseOf('p7', E.cardOrigin('p7')).text;
    const ls = app.$$('[data-verse] .alb-verse__l');
    t.eq(ls.length, E.verseLines(want).length, '一個短句一行（' + ls.length + ' 行）');
    t.eq(app.text('[data-verse] .alb-verse__t'), want, 'textContent 還是原句');
    t.eq(app.$$('[data-verse] .alb-verse__p').length, ls.length, '句尾標點各包一層');
    t.ok(ls.every(function (l) {
      return Math.round(l.getBoundingClientRect().height / parseFloat(app.win.getComputedStyle(l).lineHeight)) === 1;
    }), '每一行都沒有再折行');
  });

  /* 背面的字級照正文走（標題 22、內文 16）：每一張都要排得進卡裡。
     量 offsetTop／offsetWidth（排版位置，不受 rotateY 影響）；手寫的那句故意給很長，看截行有沒有接住 */
  t.test('明信片背面：每一張的字都排得進卡裡（內文不截、落款在卡內、地點不壓到郵戳）', async function (app) {
    const ids = app.MOCK.POSTCARDS.map(function (p) { return p.id; });
    const extra = ids.filter(function (id) { return !app.STATE.card(id); });
    const long = '老街的粄條很好吃，下次要帶媽媽一起來，順便去看那座吊橋，走到對岸再走回來';
    await app.reset({ cards: extra.map(function (id, k) { return { id: id, note: k === 0 ? long : '' }; }) });
    for (let k = 0; k < ids.length; k++) {
      await app.go('/postcard/' + ids[k]);
      const back = app.$('.alb-big__back');
      const story = app.$('.alb-back__story');
      const sign = app.$('.alb-back__sign');
      const kick = app.$('.alb-back__kicker');
      const mark = app.$('.alb-back__mark');
      if (!back || !story || !sign || !kick || !mark) { t.fail(ids[k] + ' 背面少了元素'); continue; }
      const padB = parseFloat(app.win.getComputedStyle(back).paddingBottom);
      t.ok(sign.offsetTop + sign.offsetHeight <= back.clientHeight - padB + 1,
        ids[k] + ' 落款在卡內：' + (sign.offsetTop + sign.offsetHeight) + ' ≤ ' + (back.clientHeight - padB));
      t.ok(story.scrollHeight <= story.clientHeight + 1, ids[k] + ' 背面那段話沒被截掉：' + story.scrollHeight + ' ≤ ' + story.clientHeight);
      /* 地圖上沒有的路線站（p10、p12–p18）以前落到通用句：現在寫這個地方以前的樣子 */
      t.ok(app.text('.alb-back__story') !== '在這裡停了一下。', ids[k] + ' 背面寫這個地方自己的一段話：' + app.text('.alb-back__story').slice(0, 16));
      t.ok(kick.offsetLeft + kick.offsetWidth <= mark.offsetLeft, ids[k] + ' 地點那行不壓到郵戳');
      if (ids[k] === extra[0]) t.includes(app.text('.alb-big__note'), long, ids[k] + ' 手寫的那一句在背面（太長就截行）');
    }
  });

  /* 金框的框要看得到：畫在 ::after（插圖上面），不是被 --sh-lift 蓋掉、被滿版插圖遮住的 inset 陰影 */
  function goldFrame(app, el) {
    const s = el ? app.win.getComputedStyle(el, '::after') : null;
    return !!s && s.content !== 'none' && /inset/.test(s.boxShadow) && s.boxShadow.indexOf('201, 162, 39') >= 0;
  }

  t.test('搭車卡是金框限定版：框畫在插圖上面看得到；移動方式只記距離', async function (app) {
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
    t.eq(app.text('[data-how]'), '移動 ' + app.APP.fmt.km(pl.dist) + ' 公里', '只呈現地點距離');
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

  /* 3. 週回顧只呈現距離；legacy steps 可留作 demo 換算來源，但不能出現在 UI */
  t.test('/week 總距離與每日距離都從固定七日資料算，畫面不露出步數', async function (app) {
    await app.reset();
    await app.go('/week');
    const w = app.APP.album.weekStats();
    const month = app.MOCK.HEALTH_STEPS.month;
    const spk = app.MOCK.LOOKBACK.steps / app.MOCK.LOOKBACK.km;
    const kmOf = function (steps) { return steps / spk; };
    const round1 = function (n) { return Math.round(n * 10) / 10; };
    let sum = 0;
    for (let d = w.now.from; d <= w.now.to; d++) sum += d >= 1 ? (month[d - 1] || 0) : 0;
    t.eq(w.now.steps, sum, 'legacy steps 仍等於七日資料相加');
    t.eq(w.now.km, round1(w.now.days.reduce(function (n, d) { return n + d.km; }, 0)),
      '本週公里＝七個已取一位小數的每日公里相加');
    t.includes(app.text('[data-week-km]'), String(w.now.km), '畫面總里程＝weekStats.now.km');
    const bars = app.$$('[data-day-km]');
    t.eq(bars.length, 7, '固定七天各一根距離柱');
    bars.forEach(function (bar, i) {
      t.eq(bar.getAttribute('data-day'), String(w.now.days[i].day), '第 ' + (i + 1) + ' 天日期');
      t.eq(Number(bar.getAttribute('data-km')), w.now.days[i].km, '第 ' + (i + 1) + ' 天公里');
      t.eq(w.now.days[i].km, round1(kmOf(w.now.days[i].steps)), '第 ' + (i + 1) + ' 天由既有 demo 資料換算後取一位小數');
      t.eq(app.text('[data-day-km][data-day="' + w.now.days[i].day + '"] .num'), w.now.days[i].km.toFixed(1),
        '第 ' + (i + 1) + ' 天畫面顯示一位小數');
    });
    const displayedDayKm = bars.reduce(function (n, bar) {
      return n + Number((bar.querySelector('.num').textContent || '').trim());
    }, 0);
    t.eq(round1(displayedDayKm), Number(app.text('[data-week-km]')), '畫面七個每日公里相加＝畫面週總公里');
    t.eq(app.$$('[data-cmp], .alb-cover__grid').length, 0, '沒有比較區與重複封面縮圖');
    t.ok(app.text('main.view[data-view]').indexOf('步數') < 0 && app.text('main.view[data-view]').indexOf('走路') < 0,
      '週回顧沒有步數／走路文案');
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

  t.test('/week 由分享面板進長輩圖，傳給家人 toast、返回回 /week', async function (app) {
    await app.reset();
    await app.go('/week');
    t.ok(!app.$('main.view [data-act="go-elder"]'), '頁面沒有重複的長輩圖入口');
    await app.click('main.view [data-act="share"]');
    await app.click('.sys-share [data-act="share-family"]');
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

  /* 3. 回憶卡、這一週、城市足跡不再是孤兒頁：收藏首頁的摘要列 */
  t.test('/album 三個入口各顯示自己的單一數字；回憶卡只讀 memoryCards 張數', async function (app) {
    await app.reset();
    await app.go('/album');
    const A = app.APP;
    [['go-lookback', '#/lookback'], ['go-week', '#/week'], ['go-footprint', '#/footprint']].forEach(function (x) {
      const a = app.$('.alb-v2__look [data-act="' + x[0] + '"]');
      t.eq(a && a.getAttribute('href'), x[1], x[0]);
    });
    t.ok(app.$('[data-look-tile="journal"] [data-icon="postcard"]'), '回憶卡＝postcard');
    t.ok(app.$('[data-look-tile="week"] [data-icon="share"]'), '這一週＝share（可分享）');
    t.ok(app.$('[data-look-tile="footprint"] [data-icon="viewMap"]'), '城市足跡＝viewMap（空間記憶）');
    t.eq(app.text('[data-look-today]'), '0', '預設 0 張回憶卡');
    t.eq(app.text('[data-look-week]'), String(A.album.weekStats().now.km), '這一週顯示 weekStats.now.km');
    t.includes(app.text('[data-look-tile="week"]'), '公里', '這一週只用距離作移動指標');
    t.eq(app.text('[data-look-cov]'), String(A.album.coverage()), '覆蓋率＝城市足跡同一個公式');
    t.ok(app.text('.alb-v2__look').indexOf('步') < 0 && app.text('.alb-v2__look').indexOf('走路') < 0,
      '入口沒有步數／走路文案');
    t.eq(app.$$('main.view [data-act="share"], main.view [data-share]').length, 0, '收藏首頁沒有分享鍵');
    t.eq(app.$$('[data-stat="places"], [data-stat="km"]').length, 0, '首頁沒有重複的地方／距離統計卡');
    const n = t.countTappables(app);
    t.ok(n <= 12, '可按數 ' + n + ' ≤ 12');
    app.STATE.setToday({ done: true, mood: 'low', photo: 2, date: A.fmt.todayMMDD() });
    await app.go('/ride');
    await app.go('/album');
    t.eq(app.text('[data-look-today]'), '0', '舊日誌欄位不影響回憶卡張數');
    t.eq(app.$$('[data-mood-now], [data-look-photo], [data-icon="lock"]').length, 0, '首頁不再放心情、照片或鎖頭');
    app.STATE.setToday({ memoryCards: [{ id: 'memory-1', cardId: 'p1', mood: 'good', prompt: 'x', date: A.fmt.todayMMDD() }] });
    await app.go('/ride');
    await app.go('/album');
    t.eq(app.text('[data-look-today]'), '1', 'memoryCards 一張就顯示 1');
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

  t.test('回憶卡儲存後返回收藏：journal 那格亮一下、網址移除舊 tab 參數', async function (app) {
    await app.reset();
    await app.go('/album');
    await app.click('[data-act="go-lookback"]');
    await app.at('/lookback');
    await app.click('[data-act="make-memory"]');
    await app.click('main.view[data-view] a[data-back]');
    await app.at('/album');
    t.eq(app.text('[data-look-today]'), '1', '首頁顯示一張');
    t.ok(!/tab=/.test(app.win.location.hash), '網址的 ?tab 拿掉了');
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

  /* 8b. 長輩圖＝那張明信片（使用者：「把全部的卡片、圖片、特效同步到分享的早安圖上面」） */
  t.test('/elder：圖就是收下的那張明信片（成品、金框、節日版插畫），圖上不標 AI、不印署名與遊喜樂，換地方整張跟著換、選好的祝福留著', async function (app) {
    await app.reset();
    const E = app.APP.explore;
    const moon = E.FESTIVALS.filter(function (f) { return f.key === 'moon'; })[0];
    const y = Object.keys(moon.days)[0];
    await app.reset({ still: false, store: { demoDate: y + '-' + moon.days[y] } });
    T.helpers.collect(app, 'glass-kiln');                  /* 中秋那一週走路收的 p11 */
    app.APP.store.set('demoDate', null);
    await app.go('/elder?card=p11');
    await app.tick(80);
    const img = app.$('[data-elder]');
    t.eq(img.getAttribute('data-card'), 'p11', '圖是分享的那一張');
    t.eq(app.$('[data-elder-art]').getAttribute('data-card-art'), 'p11', '卡面疊收下的那一款（data-card-art）');
    const gen = app.$('[data-elder-art] > img.card-gen');
    const want = E.postcardSrc('p11', E.cardStyleOf('p11').key);
    t.ok(gen && gen.getAttribute('src') === want, '成品圖：' + (gen && gen.getAttribute('src')) + '（要 ' + want + '）');
    t.ok(app.$('[data-elder] .fest[data-fest="moon"]'), '中秋版：月亮和玉兔也在長輩圖上');
    t.ok(app.$('[data-elder] .fest').classList.contains('is-live'), '打開就動一次');
    /* 2026-10-01 使用者：圖上的 AI 生成示意、右下角的遊喜樂、底圖照片的字都刪掉；圖上面、底下的說明小字也刪掉 */
    t.ok(!app.$('[data-elder] .ai-mark'), '圖上不標 AI 生成示意');
    t.ok(!/底圖照片|遊喜樂/.test(app.text('[data-elder]')), '圖上不印底圖署名、不寫遊喜樂：' + app.text('[data-elder]'));
    t.ok(!app.$('main.view[data-view] .ai-note'), '圖上面沒有 AI 說明那一行');
    t.ok(!/收下的那張明信片做的/.test(app.text('main.view[data-view]')), '圖底下沒有「用你收下的那張明信片做的」');
    t.includes(app.text('[data-credit]'), E.cardPhoto('p11').author, '底圖的作者與授權留在圖底下那一行');
    t.ok(!img.classList.contains('is-gold'), '走路收的不是金框');
    t.ok(app.$('[data-act="pick-card"][data-card="p11"]') && /中秋版/.test(app.text('[data-act="pick-card"][data-card="p11"]')), '選地方的小卡寫「中秋版」');
    await app.click('[data-act="caption"][data-cap-i="1"]');
    /* 換成搭車收的 p8（demo 一開始就有、金框、限定版） */
    await app.click('[data-act="pick-card"][data-card="p8"]');
    await app.tick(80);
    const img2 = app.$('[data-elder]');
    t.eq(img2.getAttribute('data-card'), 'p8', '整張換成 p8');
    t.ok(img2.classList.contains('is-gold') && img2.hasAttribute('data-gold-aura'), '搭車收的：金框＋金粉');
    t.ok(app.$('[data-elder] [data-ribbon]'), '金框的角標');
    t.ok(!app.$('[data-elder] .fest'), 'p8 不是節日版：沒有插畫');
    t.eq(app.$('[data-elder-art]').getAttribute('data-card-art'), 'p8', '卡面換成 p8 收下的那一款');
    t.eq(app.text('[data-elder-big]'), '身體健康 萬事如意', '換地方不會把選好的祝福洗掉');
    t.includes(app.text('[data-elder-small]'), '青草湖', '地點跟著換');
    t.includes(app.text('[data-credit]'), E.cardPhoto('p8').author, '圖底下的出處連結也跟著換');
    t.eq(app.$$('[data-credit]').length, 1, '出處只有一行');
    t.noDeadButtons(app, '/elder 換地方之後');
    t.noBannedWords(app, { msg: '/elder' });
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
    await app.reset();
  }, { timeout: 15000 });

  /* 10. 週回顧的範圍 */
  t.test('/week：標題＝圖表那 7 天；只算日期在範圍裡的卡，範圍之後的另寫一行', async function (app) {
    await app.reset();
    const S = app.STATE, A = app.APP;
    const w0 = A.album.weekStats();
    const dd = function (d) { return String(w0.month).padStart(2, '0') + '.' + String(d).padStart(2, '0'); };
    A.state.batch(function () {
      A.state.collect('glass-kiln', { date: dd(w0.now.from + 1) });   /* p11：範圍裡 */
      A.state.collect('neiwan', { date: dd(w0.now.to + 3) });         /* p9：範圍之後、同一個月 */
      A.state.collect('p10', { date: String(w0.month + 1).padStart(2, '0') + '.03' });   /* 下個月 */
    });
    await app.go('/week');
    const w = A.album.weekStats();
    const lab = function (d) { return w.month + '月' + d + '日'; };
    t.eq(app.text('.alb-cover__range'), lab(w.now.from) + ' – ' + lab(w.now.to), '標題是固定的 7 天');
    t.eq(app.$$('[data-day-km]').length, w.now.to - w.now.from + 1, '距離圖的天數＝標題的天數');
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
    A.state.batch(function () {
      ['glass-kiln', 'neiwan', 'p10'].forEach(function (id) { A.state.collect(id, { date: today }); });
    });
    t.eq(A.album.recentCards(3).map(function (p) { return p.id; }).join(','), 'p10,p9,p11', 'recentCards：最後收的在前');
    await app.go('/album');
    t.eq(ids(app.$$('.alb-v2__stack [data-card]')), 'p10,p9,p11', '疊卡由上到下 p10、p9、p11');
    await app.go('/postcards');
    t.eq(ids(app.$$('[data-group="got"] [data-card]').slice(0, 3)), 'p10,p9,p11', '/postcards 前三格也是');
    /* 跨年：01.05 比 demo 的 09.xx「小」，只比日期會排到最後 */
    A.state.collect('p12', { date: '01.05' });
    await app.go('/album');
    t.eq(app.$('.alb-v2__stack-art--0').getAttribute('data-card'), 'p12', '跨年新收的在最上面');
  });

  /* 5c. p12–p22 以前沒有成品，收藏裡是實景照片＋畫風濾鏡；現在 22 張都有成品。
         照片＋濾鏡留著當成品載不到（離線、還沒快取）時的退路：跟成品同一張照片，出處也照它寫 */
  t.test('十八尖山的防空洞（p21）：收藏各處是收下那一款的成品；載不到才退回照片＋畫風濾鏡；詳情寫照片出處', async function (app) {
    await app.reset();
    const A = app.APP;
    T.helpers.collect(app, 'hill', { style: 'oil' });
    const ph = A.explore.cardPhoto('p21');
    const want = A.explore.postcardSrc('p21', 'oil');
    t.eq(want, 'assets/postcards/p21-oil.jpg', '前提：p21 有油畫的成品');
    t.ok(ph && ph.file === 'p21-1.jpg', '前提：p21 有自己的實景照片');
    const genOf = function (sel) {
      const img = app.$(sel + ' > img.card-gen');
      return !!img && !img.classList.contains('card-gen--photo') && img.getAttribute('src') === want &&
        img.getAttribute('data-style') === 'oil';
    };
    await app.go('/postcards');
    await app.tick(60);
    const cell = '[data-group="got"] [data-card="p21"] [data-card-art]';
    t.ok(genOf(cell), '/postcards：油畫的成品');
    t.includes(app.text('main.view[data-view]'), '實景照片', '頁底說明寫底圖是實景照片');
    /* 成品載不到：同一個 <img> 換成底圖照片、套油畫濾鏡 */
    const img = app.$(cell + ' > img.card-gen');
    img.dispatchEvent(new app.win.Event('error'));
    await app.tick(60);
    t.ok(img.classList.contains('card-gen--photo') && img.getAttribute('src').endsWith('p21-1.jpg') &&
      img.getAttribute('data-style') === 'oil', '載不到：換成照片＋油畫');
    t.ok(/exf-oil/.test(app.win.getComputedStyle(img).filter), '套的是油畫濾鏡：' + app.win.getComputedStyle(img).filter);
    t.ok(app.doc.getElementById('exf-oil'), '濾鏡定義放進文件了（不用先開過 /unlock）');
    t.eq(app.win.getComputedStyle(app.$(cell + ' > .postcard__art')).visibility, 'hidden', '底下的插圖藏起來（不從濾鏡的柔邊透出來）');
    await app.go('/album');
    await app.tick(60);
    t.eq(app.$('.alb-v2__stack-art--0').getAttribute('data-card'), 'p21', '收藏首頁最上面是剛收的 p21');
    t.ok(genOf('.alb-v2__stack-art--0'), '疊卡也是油畫的成品');
    await app.go('/postcard/p21');
    await app.tick(60);
    t.ok(genOf('[data-flip] [data-card-art]'), '詳情也是油畫的成品');
    t.includes(app.text('[data-credit]'), ph.author, '詳情寫照片作者（成品是從那張照片生成的）');
    t.includes(app.text('[data-credit]'), ph.licence, '詳情寫授權');
    const a = app.$('[data-credit] a');
    t.ok(a && a.getAttribute('href') === ph.source && a.getAttribute('target') === '_blank', '出處連到原始頁面');
    t.noDeadButtons(app, '/postcard/p21');
    t.ok(t.countTappables(app) <= 10, '可按數 ' + t.countTappables(app) + ' ≤ 10');
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
    /* 今天搭車收的 p11：回憶卡尚未預覽時不先畫卡；週回顧（在範圍裡的話）仍保留金框 */
    A.state.collect('glass-kiln', { date: A.fmt.todayMMDD(), by: 'ride', km: 1 });
    await app.go('/lookback');
    t.eq(app.$$('main.view [data-card-art]').length, 1, '製作頁只畫目前選到的模板');
    t.ok(app.$('main.view [data-act="pick-memory-template"].is-selected [data-gold-aura]'), '搭車收的地方模板保留明信片金粉');
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
  t.test('0 張卡：首頁不拿未收獎章放大、足跡沒有已訪建物、回憶卡引導去探索且不能製作', async function (app) {
    await app.reset();
    const A0 = app.STATE.all;
    A0.cards = {}; A0.km = 0; A0.lastCard = null; A0.lastSeen = null;
    app.APP.state.setToday({ memoryCards: [] });
    await app.go('/album');
    t.ok(app.$('[data-medal-empty]'), '獎章卡是空的章位');
    t.ok(!app.$('.alb-v2__medal-top[data-badge]'), '沒有放大一枚還沒收的章');
    t.eq(app.text('[data-stat="cards"]'), '0', '明信片 0 張');
    t.eq(app.$$('[data-stat="places"], [data-stat="km"]').length, 0, '首頁沒有地方／距離統計卡');
    t.noDeadButtons(app, '/album（0 張）');
    t.noBannedWords(app, { msg: '/album（0 張）' });
    await app.go('/footprint');
    t.eq(app.$$('[data-layer="seenArea"]').length, 0, '沒有已訪區域圖層');
    t.eq(app.text('[data-coverage]'), '0', '覆蓋率 0');
    await app.go('/lookback');
    const ride = app.$('[data-act="go-ride"]');
    t.ok(ride && ride.getAttribute('href') === '#/ride?mode=explore', '空狀態引導去附近看看');
    t.eq(app.$$('[data-memory-templates], [data-memory-upload], [data-act="make-memory"]').length, 0, '沒有地點時不出現模板、上傳或製卡控制');
    t.noDeadButtons(app, '/lookback（0 張）');
  });

  /* 14. 可按的東西至少 44×44 */
  t.test('收藏各頁的關閉鍵、分享、回憶卡返回、足跡返回都至少 44×44', async function (app) {
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
    t.ok(big(size('main.view a[data-back]')), '回憶卡返回 ' + size('main.view a[data-back]'));
  });

  /* ============================================================ 回歸測試（從 flows.spec 搬來）
     code review 與亂按 QA 找到的 bug，一條 bug 一條 test；只牽涉這個區塊的放這裡，名稱保留審查／QA／評估的編號
     （對得上 docs/WORKLOG.md 與 flows.spec 裡跨區塊的那幾條）。 */
  /* 今天（'MM.DD'）落在週回顧的哪一段：now（本週 7 天內）／prev（上週）／after（本週之後）／before */
  function weekSlot(w, mmdd) {
    const k = Number(mmdd.slice(0, 2)) * 100 + Number(mmdd.slice(3, 5));
    const at = function (d) { return w.month * 100 + d; };
    if (k >= at(w.now.from) && k <= at(w.now.to)) return 'now';
    if (k > at(w.now.to)) return 'after';
    if (k >= at(w.prev.from) && k <= at(w.prev.to)) return 'prev';
    return 'before';
  }

  t.test('視覺 3：/footprint 覆蓋率用固定範圍算，平移地圖後不變', async function (app) {
    await app.reset();
    await app.go('/footprint');
    const c0 = app.text('[data-coverage]');
    t.eq(c0, String(app.APP.album.coverage()), '覆蓋率＝固定範圍公式');
    const map = app.$('main.view .map[data-pan]');
    const W = app.win;
    const r = map.getBoundingClientRect();
    const ev = function (type, x, y) { return new W.PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }); };
    map.dispatchEvent(ev('pointerdown', r.left + 150, r.top + 300));
    W.dispatchEvent(ev('pointermove', r.left + 190, r.top + 330));
    W.dispatchEvent(ev('pointerup', r.left + 190, r.top + 330));
    const layer = app.$('main.view .map__pan');
    t.ok(layer && /translate/.test(layer.style.transform), '地圖真的平移了：' + (layer && layer.style.transform));
    await app.tick(60);
    t.eq(app.text('[data-coverage]'), c0, '平移後覆蓋率不變');
    /* 換版面（iframe 變窄）重畫也不變 */
    const fr = app.win.frameElement;
    const w0 = fr.style.width;
    fr.style.width = '340px';
    await app.go('/album');
    await app.go('/footprint');
    t.eq(app.text('[data-coverage]'), c0, '版面寬度改變後覆蓋率不變');
    fr.style.width = w0;
  });

  t.test('QA 5：/week 收一張卡之後：只有日期落在本週的才算進本週，距離不受收卡影響', async function (app) {
    await app.reset();
    await app.go('/week');
    const before = app.APP.album.weekStats();
    const range0 = app.text('.alb-cover__range');
    const km0 = app.text('[data-week-km]');
    const days0 = app.$$('[data-day-km]').map(function (e) { return [e.getAttribute('data-day'), e.getAttribute('data-km')].join(':'); }).join(',');
    T.helpers.collect(app, 'glass-kiln');
    await app.go('/album');
    await app.go('/week');
    const after = app.APP.album.weekStats();
    const slot = weekSlot(before, app.APP.fmt.todayMMDD());
    t.eq(after.now.places, before.now.places + (slot === 'now' ? 1 : 0), '本週地方數（今天在 ' + slot + '）');
    t.eq(after.now.km, before.now.km, '總距離不因收卡改變');
    if (slot !== 'prev') {
      t.eq(JSON.stringify([after.prev.places, after.prev.km, after.prev.steps]), JSON.stringify([before.prev.places, before.prev.km, before.prev.steps]), '上週不變');
    }
    t.eq(app.text('.alb-cover__range'), range0, '標題就是距離圖那 7 天，收卡不會拉長（見評估 5）');
    t.eq(app.text('[data-week-km]'), km0, '畫面總距離不變');
    t.eq(app.$$('[data-day-km]').map(function (e) { return [e.getAttribute('data-day'), e.getAttribute('data-km')].join(':'); }).join(','), days0,
      '每日距離不變');
    t.eq(app.$$('[data-cmp], [data-lb-steps]').length, 0, '畫面沒有舊比較區或步數');
    t.eq(app.text('[data-week-places]'), String(after.now.places), '畫面地方數＝weekStats');
    t.eq(!!app.$('.alb-weekcard[data-card="p11"]'), slot === 'now', '今天收的卡只在今天落在本週時列在這一週');
    if (slot === 'after') t.includes(app.text('[data-week-after]'), '1', '本週之後收的另寫一行，照實說還沒算進這一週');
  });

  t.test('評估 5：/week 標題永遠是圖表那 7 天，收卡後也不拉長', async function (app) {
    await app.reset();
    await app.go('/week');
    const w0 = app.APP.album.weekStats();
    const r0 = app.text('.alb-cover__range');
    const lab = function (d) { return w0.month + '月' + d + '日'; };
    t.eq(r0, lab(w0.now.from) + ' – ' + lab(w0.now.to), '收卡前：' + r0);
    t.eq(w0.now.to, 21, '固定範圍終點是 21 日（既有 demo 資料的最後一天）');
    t.eq(w0.now.to - w0.now.from + 1, app.$$('[data-day-km]').length, '標題的天數＝距離圖的天數');
    T.helpers.collect(app, 'glass-kiln');
    await app.go('/album');
    await app.go('/week');
    t.eq(app.text('.alb-cover__range'), r0, '收卡後標題不變：' + app.text('.alb-cover__range'));
    const w1 = app.APP.album.weekStats();
    t.eq(w1.now.from, w0.now.from, '起點不變');
    t.eq(w1.now.to, w0.now.to, '終點不變');
    t.eq(w1.now.km, w0.now.km, '距離只算固定七日（不變）');
    await app.go('/album');
    t.ok(app.$('[data-act="go-week"]'), '收藏首頁「回顧」一列有「這一週」入口（週回顧不再是孤兒頁）');
    await app.reset();
  });
});
