/* ==========================================================================
   ride.spec — 叫車區（ride 角色維護）
   §6.3 五類：每條 route render／死按鈕／禁用詞／可按數；主要互動改到狀態；
   數字跟公式一致（車資、分鐘、點數＝明細相加）；返回鍵回到來處。
   ========================================================================== */
T.spec('ride', function (t) {

  const ROUTES = ['/ride', '/dropoff', '/pickup', '/trip', '/trip/done', '/drawer', '/points', '/notify', '/trips'];

  function neiwanTrip(phase, extra) {
    return Object.assign({ placeId: 'neiwan', phase: phase, startedAt: '2026-09-21T13:18:00.000Z', rated: false, km: 28 }, extra || {});
  }

  function checkPage(app, path) {
    const v = app.view();
    t.ok(v, path + '：main.view[data-view] 存在');
    t.ok(v && v.getAttribute('data-view') !== '_placeholder', path + '：不是 placeholder');
    t.noDeadButtons(app, path);
    t.noBannedWords(app, { msg: path });
    const n = t.countTappables(app);
    t.ok(n <= 10, path + ' 可按數 ' + n + ' ≤ 10');
    t.eq(app.errors.length, 0, path + ' 錯誤：' + app.errors.join('；'));
  }

  /* ---------------------------------------------------------------- 1. render */
  ROUTES.forEach(function (path) {
    t.test('render ' + path + '（空狀態）', async function (app) {
      await app.reset();
      await app.go(path);
      await app.tick(60);
      checkPage(app, path);
    });
  });

  t.test('render /trip、/trip/done（有行程時）', async function (app) {
    await app.reset({ store: { trip: neiwanTrip('riding') } });
    await app.go('/trip');
    await app.tick(60);
    checkPage(app, '/trip riding');
    t.ok(app.$('[data-act="arrive"]'), '有模擬抵達');
    await app.reset({ store: { trip: neiwanTrip('done', { rated: true, stars: 5 }) } });
    await app.go('/trip/done');
    await app.tick(60);
    checkPage(app, '/trip/done rated');
  });

  t.test('render /ride（下車點已填，仍是搭車模式）', async function (app) {
    await app.reset({ store: { dropoff: { id: 'neiwan', name: '內灣老街', km: 28, setAt: '2026-09-21T00:00:00Z', via: 'k1' } } });
    await app.go('/ride');
    await app.tick(60);
    checkPage(app, '/ride 已填');
    t.eq(app.$$('main.view .spot').length, 0, '搭車模式沒有探索圖釘');
    t.ok(app.$('.ride-sheet .ride-mode__grip'), '搭車模式有可上下拉的拉把');
    t.ok(app.$('[data-act="mode-explore"]'), '面板內可切探索');
  });

  t.test('搭車面板跟探索一樣上下拉：收到只剩拉把看整張地圖，拉回叫車欄位', async function (app) {
    await app.reset({ store: { dropoff: { id: 'neiwan', name: '內灣老街', km: 28, setAt: '2026-09-21T00:00:00Z', via: 'k1' } } });
    await app.go('/ride');
    const sheet = app.$('.ride-sheet'), grip = app.$('.ride-mode__grip'), W = app.win;
    function drag(dy, id, hold) {
      const b = grip.getBoundingClientRect();
      grip.dispatchEvent(new W.PointerEvent('pointerdown', { bubbles: true, clientY: b.top + 10, pointerId: id }));
      W.dispatchEvent(new W.PointerEvent('pointermove', { bubbles: true, clientY: b.top + 10 + dy, pointerId: id }));
      if (hold) return function () { W.dispatchEvent(new W.PointerEvent('pointerup', { bubbles: true, clientY: b.top + 10 + dy, pointerId: id })); };
      W.dispatchEvent(new W.PointerEvent('pointerup', { bubbles: true, clientY: b.top + 10 + dy, pointerId: id }));
    }
    t.eq(app.$$('[data-act="restore-ride"]').length, 0, '沒有「展開搭車」按鈕');
    const openH = sheet.offsetHeight;
    const pinTop = function () { return app.$('[data-pin="pickup"]').getBoundingClientRect().top; };
    const pin0 = pinTop();
    drag(-80, 21);
    await app.tick(60);
    t.ok(!sheet.classList.contains('is-hidden') && sheet.offsetHeight === openH, '已經展開：往上拉不會更高');
    const release = drag(90, 22, true);
    t.ok(Math.abs(sheet.offsetHeight - (openH - 90)) <= 2, '下拉時面板真的跟手（' + sheet.offsetHeight + ' ≈ ' + (openH - 90) + '）');
    release();
    await app.tick(60);
    t.ok(sheet.classList.contains('is-hidden'), '往下拉 → 只剩拉把');
    t.ok(sheet.offsetHeight < 60, '面板只剩一條（' + sheet.offsetHeight + ' px）');
    t.ok(app.$('[data-act="call-ride"]').closest('[inert]'), '藏起來的叫車鈕不能被 Tab 到');
    t.eq(pinTop(), pin0, '地圖不縮放：上車點 pin 留在原處');
    const map = app.$('[data-ride-map]').getBoundingClientRect();
    t.ok(app.$('[data-ride-map] .map__svg').getBoundingClientRect().bottom >= map.bottom - 1, '地圖畫滿露出來的範圍');
    const loc = app.$('[data-ride-map] [data-recenter]').getBoundingClientRect();
    t.ok(loc.bottom <= map.bottom && loc.bottom > map.bottom - 80, '定位鈕跟著貼到可見範圍的底邊');
    const credit = app.$('[data-ride-map] .ride-map__credit').getBoundingClientRect();
    t.ok(credit.height > 0 && credit.bottom <= map.bottom, '地圖署名看得到');
    const peekH = sheet.offsetHeight;
    const release2 = drag(-120, 23, true);
    t.ok(Math.abs(sheet.offsetHeight - (peekH + 120)) <= 2, '往上拉時面板真的跟手（' + sheet.offsetHeight + ' ≈ ' + (peekH + 120) + '）');
    release2();
    await app.tick(60);
    t.ok(!sheet.classList.contains('is-hidden') && sheet.offsetHeight === openH, '往上拉 → 回到叫車欄位');
    t.ok(!app.$('[data-act="call-ride"]').closest('[inert]'), '拉回來後可以叫車');
    t.eq(app.$('main.view [data-recenter]').getBoundingClientRect().bottom <= sheet.getBoundingClientRect().top, true, '展開時定位鈕在面板上方');
    drag(0, 24);
    await app.tick(60);
    t.ok(sheet.classList.contains('is-hidden'), '點一下拉把 → 只剩拉把');
    drag(0, 25);
    await app.tick(60);
    t.ok(!sheet.classList.contains('is-hidden'), '再點一下 → 回到叫車欄位');
    t.eq(app.route().query.get('mode'), null, '全程留在搭車');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
  });

  /* ---------------------------------------------------------------- 2. 狀態與公式 */
  t.test('/ride 預設搭車，面板切探索後才有地點圖釘', async function (app) {
    await app.reset();
    await app.go('/ride');
    t.eq(app.$$('main.view .spot').length, 0, '預設搭車沒有景點');
    t.ok(app.$('[data-act="pick-dropoff"]'), '叫車入口仍在');
    t.eq(app.$('#tabbar').querySelectorAll('[data-tab-id]').length, 2, '底欄只有兩項');
    t.includes(app.text('#tabbar'), '收藏', '底欄保留收藏');
    await app.click('[data-act="mode-explore"]');
    t.eq(app.route().query.get('mode'), 'explore', '切到探索');
    const spots = app.$$('main.view .spot');
    t.eq(spots.length, 4, '探索地圖 4 個景點');
    const today = app.MOCK.TODAY.id;
    const el = app.$('.spot[data-spot="' + today + '"]');
    t.ok(el && el.classList.contains('spot--today'), '今天的地方是 .spot--today');
    t.ok(app.$('main.view .pin[data-pin="pickup"]'), '上車點 pin');
    t.ok(app.$('main.view [data-recenter]'), '定位鈕');
    const areas = ['glass-kiln', 'market', 'moat', 'hill'];
    const nearest = areas.reduce(function (a, b) { return app.APP.place(a).dist <= app.APP.place(b).dist ? a : b; });
    t.eq(app.route().query.get('area'), nearest, '探索預選最近地區');
    t.includes(app.text('.ride-v2__feature'), app.APP.place(nearest).name, '底部顯示最近地點');
    t.includes(app.text('.ride-v2__feature'), String(app.APP.fmt.walkMin(app.APP.place(nearest).dist)), '步行分鐘由公式算');
    t.ok(app.$('[data-act="use-yoxi"]') && app.$('[data-act="expand-cards"]'), '用 yoxi 與收集兩個動作');
    await app.click('[data-act="mode-ride"]');
    t.eq(app.route().query.get('mode'), null, '切回搭車清除探索模式');
    t.eq(app.$$('main.view .spot').length, 0, '切回搭車隱藏探索圖釘');
  });

  t.test("setDropoff('neiwan','e') → /ride 叫車鈕就緒、車資與分鐘用公式", async function (app) {
    await app.reset();
    await app.go('/explore', { redirectOk: true });
    app.APP.ride.setDropoff('neiwan', 'e');
    await app.at('/ride');
    const A = app.APP;
    const d = A.store.get('dropoff');
    t.eq(d && d.id, 'neiwan', 'store.dropoff.id');
    t.eq(d && d.via, 'e', 'store.dropoff.via');
    const km = A.fmt.km(A.place('neiwan').dist);
    t.eq(d && d.km, km, 'store.dropoff.km＝fmt.km(dist)');
    const btn = app.$('[data-act="call-ride"]');
    t.ok(btn && btn.classList.contains('is-ready'), 'call-ride 有 is-ready');
    t.eq(app.text('[data-fare]'), String(A.fmt.fare(km)), '車資＝fmt.fare(km)');
    t.eq(app.text('[data-min]'), String(A.fmt.rideMin(km)), '分鐘＝fmt.rideMin(km)');
    t.ok(btn && btn.offsetHeight > 0, '收合態就看得到叫車鈕');
    t.noDeadButtons(app);
  });

  t.test('點景點 → 面板顯示地區 → 設為下車點', async function (app) {
    await app.reset();
    await app.go('/ride?mode=explore');
    await app.click('.spot[data-spot="moat"]');
    t.eq(app.route().query.get('mode'), 'explore', '選點後仍在探索');
    t.eq(app.route().query.get('area'), 'moat', '選點寫入網址');
    t.includes(app.text('[data-area-intro]'), '護城河', '面板顯示地區');
    t.includes(app.text('[data-area-intro]'), app.APP.fmt.dist(app.APP.place('moat').dist), '距離由公式取得');
    await app.click('[data-area-intro] [data-act="use-yoxi"]');
    await app.waitFor(function () { const d = app.APP.store.get('dropoff'); return d && d.id === 'moat'; }, 2000, 'dropoff=moat');
    await app.at('/ride');
    t.eq(app.APP.store.get('dropoff').via, 'e', 'via=e');
    t.eq(app.text('[data-drop-name]'), app.APP.place('moat').name, '下車點欄位是護城河');
    await app.click('[data-act="clear-dropoff"]');
    await app.waitFor(function () { return !app.$('[data-act="clear-dropoff"]'); }, 2000, '清除後重畫');
    t.eq(app.APP.store.get('dropoff'), null, '清除 → dropoff null');
  });

  t.test('探索預設上拉看最近地區卡片，選點後更新卡片堆', async function (app) {
    await app.reset();
    await app.go('/ride?mode=explore');
    const grip = app.$('.ride-sheet .sheet__grip'), W = app.win, box = grip.getBoundingClientRect();
    grip.dispatchEvent(new W.PointerEvent('pointerdown', { bubbles: true, clientY: box.top + 10, pointerId: 1 }));
    W.dispatchEvent(new W.PointerEvent('pointermove', { bubbles: true, clientY: box.top - 90, pointerId: 1 }));
    W.dispatchEvent(new W.PointerEvent('pointerup', { bubbles: true, clientY: box.top - 90, pointerId: 1 }));
    t.ok(!app.$('.ride-sheet').classList.contains('is-collapsed'), '向上拉後面板展開');
    const intro = app.$('[data-area-intro]'), cards = app.$('[data-area-expanded]');
    t.ok(intro.offsetHeight > 0 && intro.getBoundingClientRect().bottom <= cards.getBoundingClientRect().top, '展開時保留地點資訊，卡片接在下方');
    t.ok(intro.querySelector('[data-act="use-yoxi"]') && intro.querySelector('[data-act="expand-cards"]'), '展開時兩個動作仍在');
    t.eq(app.$$('[data-area-expanded] [data-act="open-card"]').length, 2, '預設最近地區的兩張卡');
    t.eq(app.$$('[data-act="all-areas"], [data-act="select-area"]').length, 0, '展開後沒有多餘的地區清單');
    const firstDown = grip.getBoundingClientRect();
    grip.dispatchEvent(new W.PointerEvent('pointerdown', { bubbles: true, clientY: firstDown.top + 10, pointerId: 2 }));
    W.dispatchEvent(new W.PointerEvent('pointermove', { bubbles: true, clientY: firstDown.top + 100, pointerId: 2 }));
    W.dispatchEvent(new W.PointerEvent('pointerup', { bubbles: true, clientY: firstDown.top + 100, pointerId: 2 }));
    await app.click('.spot[data-spot="market"]');
    t.eq(app.route().query.get('area'), 'market', '地圖選定東門');
    await app.click('[data-act="expand-cards"]');
    t.includes(app.text('[data-area-intro]'), app.APP.place('market').name, '換地區後展開仍顯示新地點資訊');
    t.eq(app.$$('[data-area-expanded] [data-card]').length, 4, '東門四張卡');
    t.ok(!app.$('[data-act="peek-place"]'), '沒有地點詳情入口');
    await app.click('[data-act="open-card"][data-card="p1"]');
    t.ok(!app.$('[data-card-float]').hidden, '卡片以懸浮物件打開');
    await app.click('[data-act="flip-card"]');
    t.ok(app.$('[data-act="flip-card"]').classList.contains('is-flipped'), '懸浮卡片可翻面');
    t.includes(app.text('[data-card-back]'), app.STATE.has('p1') ? '已收藏' : '抵達後可以收下', '背面只顯示簡短收集狀態');
    t.noDeadButtons(app, '懸浮卡片');
    await app.click('[data-act="close-card"]');
    t.ok(app.$('[data-card-float]').hidden, '可關閉懸浮卡片');
    const downBox = grip.getBoundingClientRect();
    grip.dispatchEvent(new W.PointerEvent('pointerdown', { bubbles: true, clientY: downBox.top + 10, pointerId: 3 }));
    W.dispatchEvent(new W.PointerEvent('pointermove', { bubbles: true, clientY: downBox.top + 100, pointerId: 3 }));
    W.dispatchEvent(new W.PointerEvent('pointerup', { bubbles: true, clientY: downBox.top + 100, pointerId: 3 }));
    t.ok(app.$('.ride-sheet').classList.contains('is-collapsed'), '向下拉收合探索面板');
    t.eq(app.route().query.get('mode'), 'explore', '收合後仍在探索');
    await app.reload('/ride?mode=explore&area=market');
    t.eq(app.$$('[data-area-expanded] [data-card]').length, 4, '重新整理仍是東門四張');
    t.eq(app.$$('[data-act="all-areas"], [data-act="select-area"]').length, 0, '重新整理後也沒有地區清單');
    t.eq(app.route().query.get('area'), 'market', '重新整理仍保留選定地區');
  });

  t.test('探索面板往下收到只剩拉把看整張地圖，點景點叫回來', async function (app) {
    await app.reset();
    await app.go('/ride?mode=explore&area=glass-kiln');
    const W = app.win, sheet = app.$('.ride-sheet'), grip = app.$('.ride-sheet .sheet__grip');
    function drag(dy, id) {
      const b = grip.getBoundingClientRect();
      grip.dispatchEvent(new W.PointerEvent('pointerdown', { bubbles: true, clientY: b.top + 10, pointerId: id }));
      W.dispatchEvent(new W.PointerEvent('pointermove', { bubbles: true, clientY: b.top + 10 + dy, pointerId: id }));
      W.dispatchEvent(new W.PointerEvent('pointerup', { bubbles: true, clientY: b.top + 10 + dy, pointerId: id }));
    }
    const view = app.view().getBoundingClientRect();
    const spotTop = function () { return app.$('.spot[data-spot="glass-kiln"]').getBoundingClientRect().top; };
    const top0 = spotTop(), collapsedH = sheet.offsetHeight;
    drag(80, 11);
    await app.tick(60);
    t.ok(sheet.classList.contains('is-hidden'), '收合態往下拉 → 只剩拉把');
    t.ok(sheet.offsetHeight < 60 && sheet.offsetHeight < collapsedH, '面板只剩一條（' + sheet.offsetHeight + ' px）');
    t.ok(grip.getBoundingClientRect().height > 0 && grip.getBoundingClientRect().bottom <= view.bottom + 1, '拉把還在，拉得回來');
    t.ok(app.$('.ride-mode__pills').inert && app.$('[data-area-intro]').inert, '藏起來的內容不能被 Tab 到');
    t.eq(spotTop(), top0, '地圖不縮放：景點留在原處');
    const map = app.$('[data-ride-map]').getBoundingClientRect(), svg = app.$('[data-ride-map] .map__svg').getBoundingClientRect();
    t.ok(svg.bottom >= map.bottom - 1, '地圖畫滿露出來的範圍');
    const loc = app.$('[data-ride-map] [data-recenter]').getBoundingClientRect(), credit = app.$('.ride-map__credit').getBoundingClientRect();
    t.ok(loc.bottom <= sheet.getBoundingClientRect().top && loc.bottom > map.bottom - 80, '定位鈕跟著貼到可見範圍的底邊');
    t.ok(credit.height > 0 && credit.bottom <= sheet.getBoundingClientRect().top, '地圖署名看得到');
    t.includes(app.text('.ride-map__credit'), 'OpenStreetMap', '署名文字');
    await app.click('.spot[data-spot="market"]');
    await app.tick(60);
    t.ok(!sheet.classList.contains('is-hidden') && sheet.classList.contains('is-collapsed'), '點景點 → 面板回到地點資訊');
    t.ok(!app.$('[data-area-intro]').inert, '叫回來後可以操作');
    t.eq(app.route().query.get('area'), 'market', '選的是點到的景點');
    t.includes(app.text('[data-area-intro]'), app.APP.place('market').name, '面板顯示點到的地方');
    const loc2 = app.$('[data-ride-map] [data-recenter]').getBoundingClientRect();
    t.ok(loc2.bottom <= sheet.getBoundingClientRect().top, '收合態定位鈕在面板上方');
    drag(80, 12);
    await app.tick(60);
    t.ok(sheet.classList.contains('is-hidden'), '再收一次');
    drag(0, 13);
    await app.tick(60);
    t.ok(!sheet.classList.contains('is-hidden') && sheet.classList.contains('is-collapsed'), '點一下拉把 → 回到地點資訊');
    drag(80, 14);
    drag(-500, 15);
    await app.tick(60);
    t.ok(!sheet.classList.contains('is-collapsed'), '從只剩拉把一口氣往上拉 → 直接展開卡片');
    drag(700, 16);
    await app.tick(60);
    t.ok(sheet.classList.contains('is-hidden'), '從展開一口氣往下拉 → 只剩拉把');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
  });

  t.test('地區卡片收集狀態跟 STATE 更新', async function (app) {
    await app.reset();
    await app.go('/ride?mode=explore&area=glass-kiln');
    t.includes(app.text('[data-area-expanded]'), '收集 0/2', '初始水利路進度');
    app.STATE.collect('glass-kiln', { date: app.APP.fmt.todayMMDD() });
    await app.go('/album');
    await app.go('/ride?mode=explore&area=glass-kiln');
    t.includes(app.text('[data-area-expanded]'), '收集 1/2', '收卡後進度更新');
    await app.click('[data-act="expand-cards"]');
    t.ok(app.$('[data-area-expanded] [data-card="p11"].is-collected'), '卡片上色');
    await app.click('[data-act="open-card"][data-card="p11"]');
    t.includes(app.text('[data-card-back]'), '已收藏', '懸浮卡片狀態跟著 STATE 更新');
  });

  t.test('沒有下車點時顯示選址入口，不能直接叫車', async function (app) {
    await app.reset();
    await app.go('/ride');
    t.ok(!app.$('[data-act="call-ride"]'), '尚無叫車鈕');
    t.eq(app.APP.store.get('trip'), null, '沒有 trip');
    await app.click('[data-act="pick-dropoff"]');
    await app.at('/dropoff');
  });

  t.test('叫車 → 行程中 → 抵達 → 評分 → 金色橫幅（?ride=1）', async function (app) {
    await app.reset();
    await app.go('/ride');
    app.APP.ride.setDropoff('neiwan', 'e');
    await app.at('/ride');
    await app.click('[data-act="call-ride"]');
    await app.at('/trip');
    const A = app.APP;
    const km = A.fmt.km(A.place('neiwan').dist);
    let trip = A.store.get('trip');
    t.eq(trip && trip.placeId, 'neiwan', 'trip.placeId');
    t.eq(trip && trip.km, km, 'trip.km');
    await app.waitFor(function () { const x = A.store.get('trip'); return x && x.phase === 'riding'; }, 3000, 'phase=riding');
    t.ok(!app.$('[data-phase="riding"]').hidden, '行程中區塊顯示');
    t.eq(app.text('[data-phase="riding"] [data-min]'), String(A.fmt.rideMin(km)), '預估到達＝rideMin');
    t.eq(app.text('[data-phase="riding"] [data-fare]'), String(A.fmt.fare(km)), '車資＝fare');
    t.ok(app.$('[data-story]').hidden, '「這條路上」預設收著');
    await app.click('[data-act="toggle-story"]');
    t.ok(!app.$('[data-story]').hidden, '點開「這條路上」');
    t.noDeadButtons(app, '/trip');

    A.ride.arrive();
    await app.at('/trip/done');
    t.eq(A.store.get('trip').phase, 'done', 'phase=done');
    t.eq(A.store.get('dropoff'), null, '抵達後清掉下車點');
    t.eq(app.text('[data-fare]'), String(A.fmt.fare(km)), '結算車資＝fare');
    t.eq(app.text('[data-min]'), String(A.fmt.rideMin(km)), '結算分鐘＝rideMin');
    const gold = app.$('[data-gold]');
    t.ok(gold && gold.hidden, '評分前沒有金色橫幅');
    t.eq(app.$$('[data-act="rate"]').length, 5, '五顆星');
    await app.click('[data-act="rate"][data-star="4"]');
    t.ok(!app.$('[data-gold]').hidden, '評分後出現金色橫幅');
    const a = app.$('.banner--gold');
    t.ok(a && a.getAttribute('href').indexOf('/unlock/neiwan') >= 0 && a.getAttribute('href').indexOf('?ride=1') >= 0,
      '金色橫幅 href 含 /unlock/neiwan?ride=1：' + (a && a.getAttribute('href')));
    t.eq(app.$$('.ride-star.is-on').length, 4, '四顆星亮');
    trip = A.store.get('trip');
    t.ok(trip && trip.rated === true, 'trip.rated');
    t.noDeadButtons(app, '/trip/done');

    /* 評過分的再進來要記得 */
    await app.reload('/trip/done');
    await app.at('/trip/done');
    t.ok(!app.$('[data-gold]').hidden, '重載後金色橫幅還在');
    t.eq(app.$$('.ride-star.is-on').length, 4, '重載後星數還在');

    /* 直接回首頁：限定版不消失 —— trip 留著、不 toast、不自動收，收合態有金色入口（產品決定） */
    const before = app.STATE.count();
    await app.click('[data-act="go-home"]');
    await app.at('/ride');
    t.ok(app.APP.store.get('trip') && app.APP.store.get('trip').phase === 'done', '回首頁後 trip 還在');
    t.eq(app.STATE.count(), before, '沒有自動 collect');
    const toast = app.$('.device .toast');
    t.ok(!toast || toast.textContent.indexOf('限定明信片還在收藏等你') < 0, '不再 toast');
    const u = app.$('[data-act="unlock-ride"]');
    t.ok(u && u.getAttribute('href').indexOf('/unlock/neiwan?ride=1') >= 0, '金色入口 → /unlock/neiwan?ride=1');
  }, { timeout: 20000 });

  t.test('取消行程 → confirm → 回 /ride、trip 清掉', async function (app) {
    await app.reset({ store: { trip: neiwanTrip('riding') } });
    await app.go('/trip');
    await app.click('[data-act="cancel-trip"]');
    await app.click('[data-act="confirm-yes"]');
    await app.at('/ride');
    t.eq(app.APP.store.get('trip'), null, 'trip null');
  });

  t.test('沒有行程時 /trip、/trip/done 顯示空卡＋回叫車', async function (app) {
    await app.reset();
    await app.go('/trip');
    t.ok(app.$('main.view a[href="#/ride"]'), '/trip 有回叫車');
    t.includes(app.text('main.view'), '目前沒有行程', '/trip 文案');
    await app.go('/trip/done');
    t.ok(app.$('main.view a[href="#/ride"]'), '/trip/done 有回叫車');
  });

  /* ---------------------------------------------------------------- 3. 點數＝明細相加 */
  t.test('/points 總數＝明細相加；城事列＝STATE.points', async function (app) {
    await app.reset();
    await app.go('/points');
    const amts = app.$$('[data-amt]').map(function (e) { return Number(e.getAttribute('data-amt')); });
    const sum = amts.reduce(function (a, b) { return a + b; }, 0);
    t.ok(amts.length > 0, '有明細 ' + amts.length + ' 列');
    t.eq(Number(app.text('[data-points-total]')), sum, '總數＝明細相加');
    const city = app.$$('[data-points-row][data-city="1"] [data-amt]')
      .reduce(function (a, e) { return a + Number(e.getAttribute('data-amt')); }, 0);
    t.eq(city, app.STATE.points, '城事解鎖回饋列＝STATE.points');
    /* 每一列的文字數字跟 data-amt 一致 */
    t.ok(app.$$('[data-amt]').every(function (e) { return e.textContent.trim() === '+' + e.getAttribute('data-amt'); }), '列上的數字＝data-amt');
    /* 抽屜上的總數同一個來源 */
    await app.go('/drawer');
    t.eq(Number(app.text('[data-points-total]')), sum, '抽屜點數＝點數頁總數');
    /* 多收一張搭車卡：+50 與搭車回饋都進來，總數仍＝明細相加 */
    app.STATE.collect('neiwan', { by: 'ride', date: app.APP.fmt.todayMMDD(), km: 28 });
    app.APP.emit('state:change');
    await app.go('/points');
    const amts2 = app.$$('[data-amt]').map(function (e) { return Number(e.getAttribute('data-amt')); });
    const sum2 = amts2.reduce(function (a, b) { return a + b; }, 0);
    t.eq(Number(app.text('[data-points-total]')), sum2, '收卡後總數＝明細相加');
    t.eq(sum2 - sum, 50 + Math.floor(app.APP.fmt.fare(28) / 20), '多了 50＋搭車回饋（每 20 元 1 點，無條件捨去）');
  });

  t.test('/trips：搭車卡各一筆、車資＝fare(km)', async function (app) {
    await app.reset();
    await app.go('/trips');
    const A = app.APP;
    const rideCards = app.MOCK.POSTCARDS.filter(function (p) { const c = app.STATE.card(p.id); return c && c.by === 'ride'; });
    const rows = app.$$('[data-trip-row]');
    t.eq(rows.length, rideCards.length + 1, '搭車卡 ' + rideCards.length + ' 筆＋一般行程 1 筆');
    rows.forEach(function (r) {
      const km = Number(r.querySelector('[data-km]').textContent);
      t.eq(r.querySelector('[data-fare]').textContent, String(A.fmt.fare(km)), '行程車資＝fare(' + km + ')');
    });
  });

  t.test('/notify：推播紀錄進通知中心，沒有未讀數字', async function (app) {
    await app.reset({ store: { pushes: [{ when: 'am', at: new Date().toISOString() }] } });
    await app.go('/notify');
    t.includes(app.text('[data-panel="mine"]'), '今天的地方', '早上推播');
    t.eq(app.$$('[data-panel="mine"] [data-act="open-today"]').length, 1, '今天的地方只出現一次');
    t.ok(!app.$('main.view .badge-count, main.view .tabbar__badge'), '沒有未讀數字');
    await app.click('.pill[data-tab="news"]');
    t.ok(!app.$('[data-panel="news"]').classList.contains('u-hidden'), '切到最新消息');
  });

  /* ---------------------------------------------------------------- 4. 下車點搜尋 */
  t.test('/dropoff 搜尋過濾（名字／類型）、全部、點一列設為下車點', async function (app) {
    await app.reset();
    await app.go('/dropoff');
    const A = app.APP;
    const input = app.$('[data-act="search-dropoff"]');
    const w = app.win;
    const rows = function () { return app.$$('[data-act="choose-dropoff"]'); };
    const total = A.places().length;
    t.ok(rows().length <= 7 && rows().length > 0, '預設最多 7 列：' + rows().length);
    t.ok(t.countTappables(app) <= 10, '可按數 ' + t.countTappables(app));
    if (total > rows().length) {
      await app.click('[data-act="more-dropoff"]');
      t.eq(rows().length, total, '全部 → ' + total + ' 列');
    }
    input.value = '車站';
    input.dispatchEvent(new w.Event('input', { bubbles: true }));
    const want = A.places().filter(function (p) { return (p.name + ' ' + p.type).toLowerCase().indexOf('車站') >= 0; }).length;
    t.ok(want > 0, 'MOCK 裡有車站');
    t.eq(rows().length, want, '「車站」過濾出 ' + want + ' 列');
    t.ok(rows().every(function (r) { return r.textContent.indexOf('車站') >= 0; }), '每一列都含「車站」');
    input.value = '老街';
    input.dispatchEvent(new w.Event('input', { bubbles: true }));
    t.eq(rows().length, 1, '「老街」只剩內灣');
    input.value = '沒有這個地方';
    input.dispatchEvent(new w.Event('input', { bubbles: true }));
    t.eq(rows().length, 0, '找不到時沒有列');
    t.ok(app.$('.ride-list__none'), '找不到的提示');
    input.value = '內灣';
    input.dispatchEvent(new w.Event('input', { bubbles: true }));
    const r = app.$('[data-act="choose-dropoff"][data-id="neiwan"]');
    t.ok(r, '內灣那一列');
    t.includes(r && r.textContent, '叫車', '28 km 標「叫車」');
    await app.click(r);
    await app.at('/ride');
    const d = A.store.get('dropoff');
    t.eq(d && d.id, 'neiwan', 'dropoff=neiwan');
    t.eq(d && d.via, 'search', 'via=search');
  });

  /* ---------------------------------------------------------------- 5. 返回 */
  t.test('返回鍵回到來處', async function (app) {
    await app.reset();
    await app.go('/ride');
    await app.click('[data-act="open-drawer"]');
    await app.at('/drawer');
    await app.click('[data-act="open-trips"]');
    await app.at('/trips');
    await app.click('main.view a[data-back]');
    await app.at('/drawer');
    await app.click('[data-act="open-points"]');
    await app.at('/points');
    await app.click('main.view a[data-back]');
    await app.at('/drawer');
    await app.click('main.view a[data-back]');
    await app.at('/ride');
    await app.click('[data-act="pick-dropoff"]');
    await app.at('/dropoff');
    await app.click('main.view a[data-back]');
    await app.at('/ride');
    await app.go('/notify');
    await app.at('/notify');
    await app.click('main.view a[data-back]');
    await app.at('/ride');
    t.eq(app.route().path, '/ride', '一路返回到 /ride');
  }, { timeout: 15000 });

  t.test('/pickup 選一個 → toast → 回叫車', async function (app) {
    await app.reset();
    await app.go('/ride');
    await app.click('[data-act="pick-pickup"]');
    await app.at('/pickup');
    await app.click('[data-act="choose-pickup"][data-i="1"]');
    await app.at('/ride');
    const toast = app.$('.device .toast');
    t.ok(toast && toast.textContent.indexOf('上車點已更新') >= 0, 'toast 上車點已更新');
    t.includes(app.text('[data-pickup-name]'), '46 巷 2 號', '上車點換了');
  });

  /* ================================================================ 6. 回歸：review 找到的 bug */

  const T0 = '2026-09-21T13:18:00.000Z';
  function hist(app) { const s = app.win.history.state; return s && s.i; }
  /* 在拉把上拖 dy（正＝往下）。opt：id、init（PointerEvent 其他欄位）、hold（回傳放手函式） */
  function dragOn(app, grip, dy, opt) {
    opt = opt || {};
    const W = app.win, b = grip.getBoundingClientRect(), y = b.top + 10;
    const ev = function (type, yy) {
      return new W.PointerEvent(type, Object.assign({ bubbles: true, pointerId: opt.id || 1, clientY: yy }, opt.init || {}));
    };
    grip.dispatchEvent(ev('pointerdown', y));
    W.dispatchEvent(ev('pointermove', y + dy));
    const up = function () { W.dispatchEvent(ev('pointerup', y + dy)); };
    if (opt.hold) return up;
    up();
  }

  t.test('明信片 id 用 APP.place().card：收過 p2 再搭車到東門市場，不會一直「還沒收」', async function (app) {
    await app.reset({ store: { trip: { placeId: 'market', phase: 'done', startedAt: T0, rated: true, stars: 5, km: 1.4 } }, hash: '/trip/done' });
    const A = app.APP;
    t.eq(A.place('market').card, 'p2', "APP.place('market').card＝p2");
    t.ok(app.STATE.has('p2'), 'demo 已經收過 p2');
    t.eq(A.ride.pendingUnlock(), null, '沒有待收的明信片');
    t.includes(app.text('[data-gold]'), '已經在收藏', '/trip/done 說已經在收藏裡');
    await app.go('/ride');
    t.ok(!app.$('[data-act="unlock-ride"]'), '/ride 沒有「明信片還沒收」入口');
    t.eq(A.store.get('trip'), null, '收過的那一趟在 /ride 安靜清掉');
    A.ride.setDropoff('moat', 'e');
    await app.waitFor(function () { return app.$('[data-act="call-ride"]'); }, 2000, '叫車鈕');
    await app.click('[data-act="call-ride"]');
    await app.at('/trip');
    t.ok(!app.$('.app-confirm'), '新的一趟不再問「上一趟還沒收」');
    t.eq(A.store.get('trip').placeId, 'moat', '新行程');
  });

  t.test('認不得的行程／下車點不算數：/ride 不顯示「回到行程」、清掉、setDropoff 不被擋、/trip 顯示沒有行程', async function (app) {
    const broken = { placeId: 'no-such-place', phase: 'riding', startedAt: T0, rated: false, km: 1 };
    await app.reset({ store: { trip: broken, dropoff: { id: 'nope', name: '不存在', km: 1, setAt: T0, via: 'e' } }, hash: '/ride' });
    const A = app.APP;
    t.ok(!app.$('[data-act="call-ride"]'), '沒有「回到行程」鈕');
    t.ok(app.$('[data-act="pick-dropoff"] .route-input__value--ph'), '下車點欄位是空的');
    t.eq(A.store.get('trip'), null, '壞掉的 trip 清掉');
    t.eq(A.store.get('dropoff'), null, '壞掉的 dropoff 清掉');
    t.eq(A.ride.tripActive(), null, 'tripActive＝null');
    A.ride.setDropoff('moat', 'e');
    await app.waitFor(function () { const d = A.store.get('dropoff'); return d && d.id === 'moat'; }, 2000, 'setDropoff 不被擋');
    await app.reset({ store: { trip: broken }, hash: '/trip' });
    t.includes(app.text('main.view'), '目前沒有行程', '/trip 顯示沒有行程');
    t.ok(app.$('main.view a[href="#/ride"]'), '/trip 有回叫車');
    t.eq(app.APP.store.get('trip'), null, '/trip 也清掉壞掉的 trip');
    await app.reset({ store: { trip: broken }, hash: '/album' });
    t.eq(app.APP.ride.arrive(), false, 'arrive() 不接受壞掉的行程');
    t.eq(app.APP.store.get('trip'), null, 'arrive() 順手清掉');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
  });

  t.test('取消行程的確認框開著時抵達了：再按「取消行程」不會清掉抵達的那一趟', async function (app) {
    await app.reset({ store: { trip: neiwanTrip('riding') } });
    const A = app.APP;
    await app.go('/trip');
    await app.click('[data-act="cancel-trip"]');
    t.ok(app.$('.app-confirm'), '確認框開著');
    const yes = app.$('.app-confirm [data-act="confirm-yes"]');
    if (A.system && A.system.demoArrive) A.system.demoArrive('neiwan', 'ride');
    else { A.store.set('trip', Object.assign({}, A.store.get('trip'), { phase: 'done' })); A.nav.go('/unlock/neiwan?ride=1'); }
    await app.at('/unlock/neiwan');
    if (yes && yes.isConnected) await app.click(yes);
    await app.tick(80);
    const tr = A.store.get('trip');
    t.ok(tr && tr.phase === 'done' && tr.placeId === 'neiwan', '抵達的行程還在（限定版與 +50 沒丟）');
    t.eq(app.route().path, '/unlock/neiwan', '沒有被拉回 /ride');
  });

  t.test('叫車前的確認框開著時離開了 /ride：再按「直接叫車」不會覆蓋待解鎖的行程', async function (app) {
    const done = { placeId: 'neiwan', phase: 'done', startedAt: T0, rated: true, km: 28 };
    const drop = { id: 'lake', name: '青草湖的舊戲院地基', km: 6.4, setAt: T0, via: 'e' };
    await app.reset({ store: { trip: done, dropoff: drop } });
    const A = app.APP;
    await app.go('/ride');
    await app.click('[data-act="call-ride"]');
    t.ok(app.$('.app-confirm'), '確認框開著');
    const no = app.$('.app-confirm [data-act="confirm-no"]');
    await app.go('/album');
    if (no && no.isConnected) await app.click(no);
    await app.tick(80);
    t.eq(app.route().path, '/album', '留在 /album，沒有被拉去 /trip');
    t.eq(A.store.get('trip').placeId, 'neiwan', '待解鎖的行程沒被覆蓋');
    t.eq(A.store.get('trip').phase, 'done', '還是已抵達');
  });

  t.test('通知「今天的地方」、下車點「在地圖上挑」都進探索模式；在地圖上選好退回原本那一格', async function (app) {
    await app.reset();
    const A = app.APP, M = app.MOCK;
    await app.go('/notify');
    const a = app.$('[data-act="open-today"]');
    t.includes(a && a.getAttribute('href'), 'mode=explore', '通知連結帶 mode=explore');
    t.includes(a && a.getAttribute('href'), 'area=' + encodeURIComponent(M.TODAY.id), '通知連結帶今天的地方');
    await app.click(a);
    await app.at('/ride');
    t.eq(app.route().query.get('mode'), 'explore', '落在探索模式');
    t.eq(app.$$('main.view .spot').length, 4, '地圖上有景點');
    t.eq(app.text('.ride-v2__eyebrow'), '今天的地方', '今天的地方照 MOCK.TODAY 標');

    await app.go('/ride');
    const i0 = hist(app);
    await app.click('[data-act="pick-dropoff"]');
    await app.at('/dropoff');
    const pm = app.$('[data-act="pick-on-map"]');
    t.includes(pm && pm.getAttribute('href'), 'mode=explore', '「在地圖上挑」帶 mode=explore');
    await app.click(pm);
    await app.waitFor(function () { return app.route().path === '/ride' && app.route().query.get('mode') === 'explore' && app.$('main.view .spot'); }, 3000, '探索模式');
    t.eq(hist(app), i0 + 1, '換掉 /dropoff 那一格');
    await app.click('.spot[data-spot="moat"]');
    t.eq(app.text('.ride-v2__eyebrow'), '你選的地方', '選的地方照實標');
    await app.click('[data-area-intro] [data-act="use-yoxi"]');
    await app.waitFor(function () {
      const d = A.store.get('dropoff');
      return d && d.id === 'moat' && app.route().path === '/ride' && !app.route().query.get('mode') && hist(app) === i0 &&
        app.doc.documentElement.getAttribute('data-view-ready') === '1';
    }, 3000, '退回原本的 /ride');
    t.eq(app.text('[data-drop-name]'), A.place('moat').name, '下車點欄位是護城河');
  });

  t.test('選好下車點、取消行程、結算頁回首頁：退回同一格 /ride，不疊兩個 /ride', async function (app) {
    await app.reset();
    const A = app.APP;
    await app.go('/ride');
    const i0 = hist(app);
    await app.click('[data-act="pick-dropoff"]');
    await app.at('/dropoff');
    await app.click('[data-act="choose-dropoff"][data-id="market"]');
    await app.waitFor(function () { return app.route().path === '/ride' && hist(app) === i0 && app.$('[data-act="call-ride"]'); }, 3000, '選好 → 退回 /ride');
    t.eq(A.store.get('dropoff').id, 'market', 'dropoff=market');
    await app.click('[data-act="call-ride"]');
    await app.at('/trip');
    t.eq(hist(app), i0 + 1, '/trip 在下一格');
    await app.click('[data-act="cancel-trip"]');
    await app.click('[data-act="confirm-yes"]');
    await app.waitFor(function () { return app.route().path === '/ride' && hist(app) === i0 && app.$('[data-act="call-ride"]'); }, 3000, '取消 → 退回 /ride');
    t.eq(A.store.get('trip'), null, 'trip 清掉');
    await app.click('[data-act="call-ride"]');
    await app.at('/trip');
    A.ride.arrive();
    await app.at('/trip/done');
    t.eq(hist(app), i0 + 1, '結算頁取代 /trip');
    await app.click('[data-act="rate"][data-star="5"]');
    await app.click('[data-act="go-home"]');
    await app.waitFor(function () { return app.route().path === '/ride' && hist(app) === i0; }, 3000, '回首頁 → 退回 /ride');
    /* 從別的地方進結算頁（demo 面板）：回首頁就地換成 /ride，結算頁不留在歷史裡 */
    await app.go('/album');
    A.store.set('trip', neiwanTrip('done', { rated: true, stars: 5 }));
    const i1 = hist(app);
    await app.go('/trip/done');
    await app.click('[data-act="go-home"]');
    await app.at('/ride');
    t.eq(hist(app), i1 + 1, '就地換掉結算頁那一格');
  }, { timeout: 15000 });

  t.test('/pickup 選好也退回同一格', async function (app) {
    await app.reset();
    await app.go('/ride');
    const i0 = hist(app);
    await app.click('[data-act="pick-pickup"]');
    await app.at('/pickup');
    await app.click('[data-act="choose-pickup"][data-i="2"]');
    await app.waitFor(function () { return app.route().path === '/ride' && hist(app) === i0; }, 3000, '退回 /ride');
  });

  t.test('拉把：移動 ≤ 8 px 才算點一下；超過照拖的方向換段', async function (app) {
    await app.reset();
    await app.go('/ride?mode=explore&area=glass-kiln');
    let sheet = app.$('.ride-sheet'), grip = app.$('.ride-sheet .sheet__grip');
    dragOn(app, grip, 20, { id: 31 });
    await app.tick(40);
    t.ok(sheet.classList.contains('is-hidden'), '探索收合態往下 20 px → 只剩拉把（不是展開）');
    dragOn(app, grip, -6, { id: 32 });
    await app.tick(40);
    t.ok(!sheet.classList.contains('is-hidden') && sheet.classList.contains('is-collapsed'), '6 px 算點一下 → 回到地點資訊');
    await app.go('/ride');
    sheet = app.$('.ride-sheet'); grip = app.$('.ride-sheet .sheet__grip');
    dragOn(app, grip, -20, { id: 33 });
    await app.tick(40);
    t.ok(!sheet.classList.contains('is-hidden'), '搭車展開態往上 20 px → 不動（不是收起來）');
    dragOn(app, grip, 7, { id: 34 });
    await app.tick(40);
    t.ok(sheet.classList.contains('is-hidden'), '7 px 算點一下 → 只剩拉把');
  });

  t.test('拖曳真的跟手（offsetHeight，兩個模式）', async function (app) {
    await app.reset();
    await app.go('/ride?mode=explore&area=market');
    let sheet = app.$('.ride-sheet'), grip = app.$('.ride-sheet .sheet__grip');
    const c0 = sheet.offsetHeight;
    let release = dragOn(app, grip, -120, { id: 41, hold: true });
    t.ok(Math.abs(sheet.offsetHeight - (c0 + 120)) <= 2, '探索收合態往上拉 120：' + sheet.offsetHeight + ' ≈ ' + (c0 + 120));
    t.ok(app.$('[data-area-expanded]').offsetHeight > 0, '拖的時候卡片堆已經排版');
    release();
    await app.tick(40);
    t.ok(!sheet.classList.contains('is-collapsed'), '放手 → 展開');
    await app.go('/ride');
    sheet = app.$('.ride-sheet'); grip = app.$('.ride-sheet .sheet__grip');
    dragOn(app, grip, 120, { id: 42 });
    await app.tick(40);
    const p0 = sheet.offsetHeight;
    release = dragOn(app, grip, -150, { id: 43, hold: true });
    t.ok(Math.abs(sheet.offsetHeight - (p0 + 150)) <= 2, '搭車只剩拉把往上拉 150：' + sheet.offsetHeight + ' ≈ ' + (p0 + 150));
    release();
    await app.tick(40);
    t.ok(!sheet.classList.contains('is-hidden'), '放手 → 叫車欄位');
  });

  t.test('拉把：右鍵、第二根手指不拖；滑鼠鍵放開卻沒有 pointerup、視窗失焦 → 這次拖曳作廢', async function (app) {
    await app.reset();
    await app.go('/ride');
    const sheet = app.$('.ride-sheet'), grip = app.$('.ride-sheet .sheet__grip'), W = app.win;
    const open = sheet.offsetHeight;
    dragOn(app, grip, 120, { id: 51, init: { button: 2, buttons: 2, pointerType: 'mouse', isPrimary: true } });
    await app.tick(40);
    t.ok(!sheet.classList.contains('is-hidden') && sheet.offsetHeight === open, '右鍵拖不動');
    dragOn(app, grip, 120, { id: 52, init: { pointerType: 'touch', isPrimary: false, buttons: 1 } });
    await app.tick(40);
    t.ok(!sheet.classList.contains('is-hidden'), '第二根手指拖不動');
    const b = grip.getBoundingClientRect(), y = b.top + 10;
    const mouse = function (type, yy, buttons) {
      return new W.PointerEvent(type, { bubbles: true, pointerId: 53, clientY: yy, pointerType: 'mouse', isPrimary: true, button: 0, buttons: buttons });
    };
    grip.dispatchEvent(mouse('pointerdown', y, 1));
    W.dispatchEvent(mouse('pointermove', y + 100, 1));
    t.ok(Math.abs(sheet.offsetHeight - (open - 100)) <= 2, '左鍵拖得動');
    W.dispatchEvent(mouse('pointermove', y + 140, 0));
    await app.tick(40);
    t.eq(sheet.style.maxHeight, '', '鍵已經放開 → 放掉拖曳');
    t.ok(!sheet.classList.contains('is-hidden'), '回到原段');
    W.dispatchEvent(mouse('pointerup', y + 140, 0));
    await app.tick(40);
    t.ok(!sheet.classList.contains('is-hidden'), '遲來的 pointerup 不再換段');
    grip.dispatchEvent(mouse('pointerdown', y, 1));
    W.dispatchEvent(mouse('pointermove', y + 100, 1));
    W.dispatchEvent(new W.Event('blur'));
    await app.tick(40);
    t.eq(sheet.style.maxHeight, '', '視窗失焦 → 放掉拖曳');
    t.ok(!sheet.classList.contains('is-hidden'), '失焦後回到原段');
  });

  t.test('拉把是按鈕：鍵盤（click）也能收放，aria-expanded 跟著變；指標點一下不會切兩次', async function (app) {
    await app.reset();
    await app.go('/ride');
    const sheet = app.$('.ride-sheet'), grip = app.$('.ride-sheet [data-act="toggle-sheet"]'), W = app.win;
    t.eq(grip && grip.tagName, 'BUTTON', '拉把是 <button>');
    t.eq(grip.getAttribute('aria-expanded'), 'true', '展開時 aria-expanded=true');
    t.ok(grip.getAttribute('aria-label'), '拉把有名字');
    await app.click(grip);
    t.ok(sheet.classList.contains('is-hidden'), 'Enter／空白鍵（click）→ 只剩拉把');
    t.eq(grip.getAttribute('aria-expanded'), 'false', 'aria-expanded=false');
    t.ok(!grip.closest('[inert]') && !grip.inert, '收起來時拉把還按得到');
    await app.click(grip);
    t.ok(!sheet.classList.contains('is-hidden'), '再按一次 → 叫車欄位');
    /* 指標：pointerdown/up 已經切了一次，之後瀏覽器補的 click 不再切 */
    dragOn(app, grip, 0, { id: 61 });
    grip.click();
    await app.tick(40);
    t.ok(sheet.classList.contains('is-hidden'), '點一下只切一次');
    await app.go('/ride?mode=explore&area=glass-kiln');
    const g2 = app.$('.ride-sheet [data-act="toggle-sheet"]');
    t.eq(g2.getAttribute('aria-expanded'), 'false', '探索收合態 aria-expanded=false');
    await app.click(g2);
    t.ok(!app.$('.ride-sheet').classList.contains('is-collapsed'), '探索：按拉把 → 展開卡片');
    t.eq(g2.getAttribute('aria-expanded'), 'true', 'aria-expanded=true');
  });

  t.test('懸浮小卡：a11yDialog、背後 inert、Tab 繞在小卡裡、Esc 關、焦點回到卡片', async function (app) {
    await app.reset();
    await app.go('/ride?mode=explore&area=glass-kiln');
    const W = app.win, d = app.doc;
    await app.click('[data-act="expand-cards"]');
    const card = app.$('[data-act="open-card"][data-card="p11"]');
    card.focus();
    await app.click(card);
    const float = app.$('[data-card-float]');
    const flip = float.querySelector('[data-act="flip-card"]'), close = float.querySelector('[data-act="close-card"]');
    t.ok(!float.hidden, '小卡打開');
    t.eq(float.getAttribute('role'), 'dialog', 'role=dialog');
    t.eq(d.activeElement, flip, '焦點在卡片（翻面鈕）');
    const btns = Array.prototype.slice.call(float.querySelectorAll('button'));
    t.ok(btns.indexOf(flip) < btns.indexOf(close), 'DOM 順序：翻面在前、關閉在後');
    t.ok(app.$('#tabbar').inert, '底欄 inert');
    t.ok(app.$('.ride-sheet').inert && app.$('[data-ride-map]').inert, '面板與地圖 inert');
    const key = function (k, shift) {
      d.activeElement.dispatchEvent(new W.KeyboardEvent('keydown', { key: k, shiftKey: !!shift, bubbles: true, cancelable: true }));
    };
    key('Tab');
    t.eq(d.activeElement, close, 'Tab → 關閉鈕');
    key('Tab');
    t.eq(d.activeElement, flip, '再 Tab → 繞回翻面鈕');
    key('Tab', true);
    t.eq(d.activeElement, close, 'Shift+Tab → 關閉鈕（往回也到得了）');
    key('Escape');
    await app.tick(40);
    t.ok(float.hidden, 'Esc 關掉');
    t.ok(!app.$('#tabbar').inert && !app.$('.ride-sheet').inert && !app.$('[data-ride-map]').inert, '關掉後背後都恢復');
    t.eq(d.activeElement, card, '焦點回到點開的那張卡');
    await app.click(card);
    await app.go('/album');
    t.ok(!app.$('#tabbar').inert, '小卡開著就離開：底欄恢復');
  });

  t.test('視窗改大小：地圖重畫、畫滿可見範圍（ResizeObserver），舊地圖拆乾淨', async function (app) {
    /* run.py 的 headless Chrome 用 virtual time，改了 iframe 大小之後不會再跑 ResizeObserver／resize 事件
       （真的瀏覽器會；Playwright 實測過）。這裡改完大小自己補發 resize，驗的是「重量、重畫」那一段。 */
    const fr = app.win.frameElement, h0 = fr.style.height;
    const resize = function (h) { fr.style.height = h; app.win.dispatchEvent(new app.win.Event('resize')); };
    try {
      fr.style.height = '700px';
      await app.reset();
      await app.go('/ride');
      await app.click('.ride-sheet [data-act="toggle-sheet"]');
      await app.tick(60);
      resize('844px');
      const filled = function () {
        const m = app.$('[data-ride-map]'), svg = app.$('[data-ride-map] .map__svg');
        return m && svg && svg.getBoundingClientRect().bottom >= m.getBoundingClientRect().bottom - 1;
      };
      await app.waitFor(filled, 3000, '改高之後地圖畫滿');
      t.ok(filled(), '地圖畫滿露出來的範圍');
      t.eq(app.$$('main.view .app-map').length, 1, '只有一張地圖');
      t.eq(app.$$('main.view [data-recenter]').length, 1, '只有一顆定位鈕');
      const map = app.$('[data-ride-map]').getBoundingClientRect(), loc = app.$('main.view [data-recenter]').getBoundingClientRect();
      t.ok(loc.bottom <= map.bottom && loc.bottom > map.bottom - 80, '定位鈕仍貼著可見範圍的底邊');
      await app.click('.ride-sheet [data-act="toggle-sheet"]');
      await app.tick(60);
      t.ok(!app.$('.ride-sheet').classList.contains('is-hidden'), '重畫之後面板照樣收放');
      await app.click('[data-act="mode-explore"]');
      resize('760px');
      await app.waitFor(function () { const s = app.$('.spot.is-selected'); return s && filled(); }, 3000, '探索重畫後仍標著選到的景點');
      t.eq(app.$$('main.view .spot').length, 4, '探索重畫後還是四顆景點');
      t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
    } finally {
      fr.style.height = h0;
    }
  }, { timeout: 15000 });

  t.test('距離不明：寫「距離待確認」，不寫車資與分鐘', async function (app) {
    await app.reset();
    const A = app.APP, orig = A.place;
    A.place = function () {
      const p = orig.apply(this, arguments);
      if (p && (p.id === 'moat' || p.id === 'glass-kiln')) p.dist = null;
      return p;
    };
    try {
      A.store.set('dropoff', { id: 'moat', name: '護城河的舊碼頭階梯', km: null, setAt: T0, via: 'e' });
      await app.go('/ride');
      t.includes(app.text('.ride-drop__meta'), '距離待確認', '/ride 下車點寫距離待確認');
      t.ok(!app.$('main.view [data-fare]') && !app.$('main.view [data-min]'), '/ride 沒有車資與分鐘');
      await app.go('/ride?mode=explore&area=moat');
      t.includes(app.text('[data-area-intro]'), '距離待確認', '探索地點卡寫距離待確認');
      t.ok(app.text('[data-area-intro]').indexOf('0 m') < 0, '不寫 0 m');
      await app.go('/notify');
      t.includes(app.text('[data-act="open-today"]'), '距離待確認', '通知的今天的地方寫距離待確認');
      A.store.set('dropoff', null);
      A.ride.setDropoff('moat', 'e');
      await app.at('/ride');
      t.eq(A.store.get('dropoff').km, null, 'dropoff.km＝null（不是 0）');
      A.store.set('trip', { placeId: 'moat', phase: 'riding', startedAt: T0, rated: false, km: null });
      await app.go('/trip');
      t.includes(app.text('[data-phase="riding"]'), '距離待確認', '/trip 寫距離待確認');
      t.ok(!app.$('main.view [data-fare]') && !app.$('main.view [data-min]'), '/trip 沒有車資與分鐘');
      A.store.set('trip', { placeId: 'moat', phase: 'done', startedAt: T0, rated: true, km: null });
      await app.go('/trip/done');
      t.includes(app.text('.ride-done__meta'), '距離待確認', '/trip/done 寫距離待確認');
      t.ok(!app.$('main.view [data-fare]'), '/trip/done 沒有車資');
      t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
    } finally {
      A.place = orig;
    }
  });

  t.test('非 still：配對中 → 時間到自己切到行程中', async function (app) {
    await app.reset({ still: false, store: { dropoff: { id: 'neiwan', name: '內灣老街', km: 28, setAt: T0, via: 'k1' } } });
    const A = app.APP;
    t.ok(!app.doc.documentElement.hasAttribute('data-still'), '非 still 模式');
    await app.go('/ride');
    await app.click('[data-act="call-ride"]');
    await app.at('/trip', 4000);
    if (!A.reduceMotion()) {
      t.eq(A.store.get('trip').phase, 'matching', '一開始是配對中');
      t.ok(!app.$('[data-phase="matching"]').hidden && app.$('[data-phase="riding"]').hidden, '畫面是配對中');
    }
    await app.waitFor(function () {
      const tr = A.store.get('trip');
      return tr && tr.phase === 'riding' && !app.$('[data-phase="riding"]').hidden;
    }, 4000, 'MATCH_MS 之後切到行程中');
    t.ok(app.$('[data-phase="matching"]').hidden, '配對中收起來');
    t.includes(app.doc.title, '行程中', '標題跟著換');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
  }, { timeout: 15000 });

  t.test('點數回饋只有一個來源：APP.ride.RIDE_BONUS＝MOCK.FAR_PLACE.ridePoints；抽屜不記進 tab', async function (app) {
    await app.reset();
    const A = app.APP;
    t.eq(A.ride.RIDE_BONUS, app.MOCK.FAR_PLACE.ridePoints, 'RIDE_BONUS＝ridePoints');
    const city = A.ride.pointsRows().filter(function (r) { return r.city; });
    t.ok(city.every(function (r) { return r.amt === A.ride.RIDE_BONUS && r.place; }), '城事列＝RIDE_BONUS，帶地名');
    await app.go('/notify');
    const pts = app.$('[data-panel="mine"] [data-act="open-points"]');
    if (city.length) t.includes(pts && pts.textContent, city[0].place, '通知中心的地名從資料來');
    t.eq(A.views.drawer && A.views.drawer.remember, false, '/drawer remember:false');
  });

  t.test('命中區 ≥ 44：返回、關閉、星星、取消行程、點數鈕、拉把', async function (app) {
    await app.reset({ store: { trip: neiwanTrip('riding') } });
    const sizes = [];
    const need = function (sel, label) {
      const el = app.$(sel);
      if (!el) { sizes.push(label + ' 找不到'); return; }
      const r = el.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) sizes.push(label + ' ' + Math.round(r.width) + '×' + Math.round(r.height));
    };
    await app.go('/trip');
    need('[data-act="cancel-trip"]', '取消行程');
    app.APP.store.set('trip', neiwanTrip('done', { rated: true, stars: 3 }));
    await app.go('/trip/done');
    need('[data-act="rate"]', '星星');
    await app.go('/dropoff');
    need('main.view .ride-back[data-back]', '/dropoff 返回');
    await app.go('/points');
    need('main.view .hdr-red__close', '/points 關閉');
    await app.go('/drawer');
    need('main.view .ride-drawer__close', '抽屜關閉');
    need('[data-act="open-points"]', '抽屜點數鈕');
    await app.go('/ride');
    need('.ride-sheet [data-act="toggle-sheet"]', '拉把');
    t.eq(sizes.length, 0, '小於 44：' + sizes.join('、'));
  });
});
