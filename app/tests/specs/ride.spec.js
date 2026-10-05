/* ==========================================================================
   ride.spec — 叫車區（ride 角色維護）
   §6.3 五類：每條 route render／死按鈕／禁用詞／可按數；主要互動改到狀態；
   數字跟公式一致（車資、分鐘、點數＝明細相加）；返回鍵回到來處。
   ========================================================================== */
T.spec('ride', function (t) {

  const ROUTES = T.routes({ area: 'ride' }).map(function (r) { return r.path; });

  function neiwanTrip(phase, extra) {
    return Object.assign(T.fixtures.trip({ phase: phase }), extra || {});
  }

  function checkPage(app, path) {
    const v = app.view();
    t.ok(v, path + '：main.view[data-view] 存在');
    t.ok(v && v.getAttribute('data-view') !== '_placeholder', path + '：不是 placeholder');
    t.noDeadButtons(app, path);
    t.noBannedWords(app, { msg: path });
    const n = t.countTappables(app);
    t.ok(n <= T.tapMax(path), path + ' 可按數 ' + n + ' ≤ ' + T.tapMax(path));
    t.eq(app.errors.length, 0, path + ' 錯誤：' + app.errors.join('；'));
  }
  /* 叫車首頁「叫車前往」→ 確認叫車頁「確認叫車」 */
  const callRide = T.helpers.callRide;

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
    t.ok(!app.$('main.view [data-act="arrive"], main.view [data-act="advance-trip"]'), '乘客行程沒有抵達開發控制');
    t.ok(!/demo|模擬抵達|模擬到家/i.test(app.text('main.view')), '乘客行程文案沒有 demo 或模擬抵達');
    const contact = app.$('[data-phase="riding"] [data-act="call-driver"]');
    t.ok(contact && typeof contact.onclick === 'function', '行程中仍可聯絡司機');
    await app.click(contact);
    t.includes(app.text('.toast'), '正在撥號給', '聯絡司機能觸發撥號回饋');
    t.ok(!app.$('#demo-panel [data-act="advance-trip"]').disabled, '開發工具可推進進行中的行程');
    await app.reset({ store: { trip: neiwanTrip('done', { rated: true, stars: 5 }) } });
    await app.go('/trip/done');
    await app.tick(60);
    checkPage(app, '/trip/done rated');
  });

  t.test('render /ride（下車點已填，仍是搭車模式）', async function (app) {
    await app.reset({ store: { dropoff: T.fixtures.dropoff({ setAt: '2026-09-21T00:00:00Z' }) } });
    await app.go('/ride');
    await app.tick(60);
    checkPage(app, '/ride 已填');
    t.eq(app.$$('main.view .spot').length, 0, '搭車模式沒有探索圖釘');
    t.ok(app.$('.ride-sheet .ride-mode__grip'), '搭車模式有可上下拉的拉把');
    t.ok(app.$('[data-act="mode-explore"]'), '面板內可切探索');
  });

  t.test('搭車面板跟探索一樣上下拉：收到只剩拉把看整張地圖，拉回叫車欄位', async function (app) {
    await app.reset({ store: { dropoff: T.fixtures.dropoff({ setAt: '2026-09-21T00:00:00Z' }) } });
    await app.go('/ride');
    const sheet = app.$('.ride-sheet'), grip = app.$('.ride-mode__grip');
    function drag(dy, id, hold) { return T.helpers.drag(app, grip, dy, { id: id, hold: hold }); }
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
    const F = app.APP.fmt, nd = app.APP.place(nearest).dist;
    t.includes(app.text('.ride-v2__feature'), '離你 ' + F.dist(nd) + ' · 搭 yoxi ' + F.rideMin(F.km(nd)) + ' 分鐘', '搭 yoxi 分鐘由公式算');
    t.ok(app.text('.ride-v2__feature').indexOf('走路') < 0, '地點資訊不寫走路分鐘');
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
    const grip = app.$('.ride-sheet .sheet__grip');
    T.helpers.drag(app, grip, -100, { id: 1 });
    t.ok(!app.$('.ride-sheet').classList.contains('is-collapsed'), '向上拉後面板展開');
    const intro = app.$('[data-area-intro]'), cards = app.$('[data-area-expanded]');
    t.ok(intro.offsetHeight > 0 && intro.getBoundingClientRect().bottom <= cards.getBoundingClientRect().top, '展開時保留地點資訊，卡片接在下方');
    t.ok(intro.querySelector('[data-act="use-yoxi"]') && intro.querySelector('[data-act="expand-cards"]'), '展開時兩個動作仍在');
    t.eq(app.$$('[data-area-expanded] [data-act="open-card"]').length, 2, '預設最近地區的兩張卡');
    t.eq(app.$$('[data-act="all-areas"], [data-act="select-area"]').length, 0, '展開後沒有多餘的地區清單');
    T.helpers.drag(app, grip, 90, { id: 2 });
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
    T.helpers.drag(app, grip, 90, { id: 3 });
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
    const sheet = app.$('.ride-sheet'), grip = app.$('.ride-sheet .sheet__grip');
    function drag(dy, id) { T.helpers.drag(app, grip, dy, { id: id }); }
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

  t.test('金框的卡在探索面板與浮起來看都是金框、有金粉；還沒收的沒有', async function (app) {
    await app.reset();
    T.helpers.collect(app, 'glass-kiln', { by: 'ride' });            /* 搭 yoxi 抵達必得金框 */
    await app.go('/ride?mode=explore&area=glass-kiln');
    await app.click('[data-act="expand-cards"]');
    const art = function () { return app.$('[data-area-expanded] [data-card="p11"] .ride-v2__card-art'); };
    await app.waitFor(function () { return art() && art().hasAttribute('data-gold-aura'); }, 1000, 'paintCardArt 補上金粉');
    t.ok(art().classList.contains('card-gold'), '面板上的卡：通用的金框（.card-gold）');
    const ring = app.win.getComputedStyle(art(), '::after').boxShadow;
    t.ok(ring.indexOf('201, 162, 39') >= 0, '框是 --gold：' + ring);
    t.ok(!app.$('[data-area-expanded] [data-card="p17"] [data-gold-aura]'), '還沒收的 p17 沒有');
    await app.click('[data-act="open-card"][data-card="p11"]');
    const obj = app.$('.ride-card-float__object');
    t.ok(obj.classList.contains('is-gold') && obj.hasAttribute('data-gold-aura'), '浮起來的卡：整張金框＋金粉');
    t.ok(!app.$('.ride-card-float__art[data-gold-aura]'), '外層標了，裡面的插圖不再補一個');
    t.ok(app.win.getComputedStyle(app.$('.ride-card-float__front'), '::after').boxShadow.indexOf('201, 162, 39') >= 0, '正面有金框');
    await app.click('[data-act="close-card"]');
    await app.click('[data-act="open-card"][data-card="p17"]');
    t.ok(!obj.classList.contains('is-gold') && !obj.hasAttribute('data-gold-aura'), '換成還沒收的 p17：金框和金粉都拿掉');
    await app.click('[data-act="close-card"]');
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
    await callRide(app);
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
    app.APP.state.collect('neiwan', { by: 'ride', date: app.APP.fmt.todayMMDD(), km: 28 });
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
    t.ok(r && r.textContent.indexOf('叫車') < 0 && r.textContent.indexOf('走得到') < 0, '列上沒有「走得到／叫車」標籤');
    t.ok(!app.$('.ride-tag'), '清單沒有任何 .ride-tag');
    t.ok(!app.$('[data-act="pick-on-map"] .row-nav__sub'), '「在地圖上挑」沒有說明小字');
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
  const hist = T.helpers.histI;
  /* 在拉把上拖 dy（正＝往下）。opt：id、init（PointerEvent 其他欄位）、hold（回傳放手函式） */
  const dragOn = T.helpers.drag;

  t.test('明信片 id 用 APP.place().card：收過 p2 再搭車到東門市場是回訪（這一次的待收）；收下之後就不再掛著「還沒收」', async function (app) {
    await app.reset({ store: { trip: T.fixtures.trip({ placeId: 'market', phase: 'done', rated: true, stars: 5, km: 1.4 }) }, hash: '/trip/done' });
    const A = app.APP;
    t.eq(A.place('market').card, 'p2', "APP.place('market').card＝p2");
    t.ok(app.STATE.has('p2'), 'demo 已經收過 p2（九月初）');
    const pend = A.ride.trip.pending();
    t.eq(pend && pend.card, 'p2', '每一次來都收一張：這一次的明信片待收');
    t.eq(pend && pend.limited, false, '回訪不是限定版');
    t.includes(app.text('[data-gold]'), '收下這一次的明信片', '/trip/done 叫你收下這一次的');
    /* 收下這一次（回訪）之後：今天收過了，不再掛著 */
    A.explore.collect('market');
    t.eq(A.explore.visits('p2').length, 2, '收下的是第 2 次');
    A.store.set('trip', T.fixtures.trip({ placeId: 'market', phase: 'done', rated: true, stars: 5, km: 1.4 }));
    await app.go('/trip/done');
    t.eq(A.ride.trip.pending(), null, '今天收過了：沒有待收的明信片');
    t.includes(app.text('[data-gold]'), '今天這個地方的明信片已經收下了', '/trip/done 說今天收過了');
    await app.go('/ride');
    t.ok(!app.$('[data-act="unlock-ride"]'), '/ride 沒有「明信片還沒收」入口');
    t.eq(A.store.get('trip'), null, '收過的那一趟在 /ride 安靜清掉');
    A.ride.setDropoff('moat', 'e');
    await app.waitFor(function () { return app.$('[data-act="call-ride"]'); }, 2000, '叫車鈕');
    await callRide(app);
    await app.at('/trip');
    t.ok(!app.$('.app-confirm'), '新的一趟不再問「上一趟還沒收」');
    t.eq(A.store.get('trip').placeId, 'moat', '新行程');
    await app.reset();
  });

  t.test('認不得的行程／下車點不算數：/ride 不顯示「回到行程」、清掉、setDropoff 不被擋、/trip 顯示沒有行程', async function (app) {
    const broken = T.fixtures.trip({ placeId: 'no-such-place', km: 1 });
    await app.reset({ store: { trip: broken, dropoff: T.fixtures.dropoff({ id: 'nope', name: '不存在', km: 1, via: 'e' }) }, hash: '/ride' });
    const A = app.APP;
    t.ok(!app.$('[data-act="call-ride"]'), '沒有「回到行程」鈕');
    t.ok(app.$('[data-act="pick-dropoff"] .route-input__value--ph'), '下車點欄位是空的');
    t.eq(A.store.get('trip'), null, '壞掉的 trip 清掉');
    t.eq(A.store.get('dropoff'), null, '壞掉的 dropoff 清掉');
    t.eq(A.ride.trip.active(), null, 'trip.active()＝null');
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

  t.test('叫車前的確認框開著時離開了確認叫車頁：再按「直接叫車」不會覆蓋待解鎖的行程', async function (app) {
    const done = T.fixtures.trip({ phase: 'done', rated: true });
    const drop = T.fixtures.dropoff({ id: 'lake', name: '青草湖的舊戲院地基', km: 6.4, via: 'e' });
    await app.reset({ store: { trip: done, dropoff: drop } });
    const A = app.APP;
    await app.go('/ride');
    await callRide(app);
    t.ok(app.$('.app-confirm'), '確認框開著');
    const no = app.$('.app-confirm [data-act="confirm-no"]');
    await app.go('/album');
    if (no && no.isConnected) await app.click(no);
    await app.tick(80);
    t.eq(app.route().path, '/album', '留在 /album，沒有被拉去 /trip');
    t.eq(A.store.get('trip').placeId, 'neiwan', '待解鎖的行程沒被覆蓋');
    t.eq(A.store.get('trip').phase, 'done', '還是已抵達');
  });

  t.test('叫車前的確認框被關掉（Esc、點遮罩）不算「直接叫車」；真的按了才叫', async function (app) {
    const done = T.fixtures.trip({ phase: 'done', rated: true });
    const drop = T.fixtures.dropoff({ id: 'lake', name: '青草湖的舊戲院地基', km: 6.4, via: 'e' });
    await app.reset({ store: { trip: done, dropoff: drop } });
    const A = app.APP, W = app.win;
    await app.go('/ride');
    await callRide(app);
    t.ok(app.$('.app-confirm'), '確認框開著');
    (app.doc.activeElement || app.doc.body).dispatchEvent(new W.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await app.tick(60);
    t.ok(!app.$('.app-confirm'), 'Esc 關掉確認框');
    t.eq(app.route().path, '/ride/confirm', 'Esc：留在確認叫車頁');
    t.eq(A.store.get('trip').placeId, 'neiwan', 'Esc：沒有叫車');
    await app.click('[data-act="confirm-ride"]');
    const scrim = app.$('.app-confirm');
    if (scrim) scrim.click();
    await app.tick(60);
    t.ok(!app.$('.app-confirm'), '點遮罩關掉確認框');
    t.eq(A.store.get('trip').placeId, 'neiwan', '點遮罩：沒有叫車');
    await app.click('[data-act="confirm-ride"]');
    await app.click('.app-confirm [data-act="confirm-no"]');
    await app.at('/trip');
    t.eq(A.store.get('trip').placeId, 'lake', '按了「直接叫車」才叫');
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
    await app.at('/ride/confirm');
    t.eq(hist(app), i0 + 1, '確認叫車頁在下一格');
    await app.click('[data-act="confirm-ride"]');
    await app.at('/trip');
    t.eq(hist(app), i0 + 1, '/trip 取代確認叫車頁（還是下一格）');
    await app.click('[data-act="cancel-trip"]');
    await app.click('[data-act="confirm-yes"]');
    await app.waitFor(function () { return app.route().path === '/ride' && hist(app) === i0 && app.$('[data-act="call-ride"]'); }, 3000, '取消 → 退回 /ride');
    t.eq(A.store.get('trip'), null, 'trip 清掉');
    await callRide(app);
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

  t.test('懸浮小卡：掛在 .device（data-overlay）、a11yDialog、背後 inert、Tab 繞在小卡裡、Esc 關、焦點回到卡片', async function (app) {
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
    t.ok(!float.closest('#view') && float.parentElement === app.$('.device'), '掛在 .device 上（遮罩連底欄一起蓋）');
    t.ok(float.hasAttribute('data-overlay') && typeof float._dismiss === 'function', 'data-overlay＋_dismiss');
    t.eq(float.getAttribute('role'), 'dialog', 'role=dialog');
    t.eq(d.activeElement, flip, '焦點在卡片（翻面鈕）');
    const btns = Array.prototype.slice.call(float.querySelectorAll('button'));
    t.ok(btns.indexOf(flip) < btns.indexOf(close), 'DOM 順序：翻面在前、關閉在後');
    t.ok(app.$('#tabbar').inert, '底欄 inert');
    t.ok(app.$('#view').inert, '整個畫面（地圖、面板）inert');
    const key = function (k, shift) {
      d.activeElement.dispatchEvent(new W.KeyboardEvent('keydown', { key: k, shiftKey: !!shift, bubbles: true, cancelable: true }));
    };
    close.focus();
    key('Tab');
    t.eq(d.activeElement, flip, '關閉鈕再 Tab → 繞回翻面鈕');
    key('Tab', true);
    t.eq(d.activeElement, close, '翻面鈕 Shift+Tab → 關閉鈕（往回也到得了）');
    key('Escape');
    await app.tick(40);
    t.ok(float.hidden, 'Esc 關掉');
    t.ok(!app.$('#tabbar').inert && !app.$('#view').inert, '關掉後背後都恢復');
    t.eq(d.activeElement, card, '焦點回到點開的那張卡');
    await app.click(card);
    t.ok(!app.$('[data-card-float]').hidden, '再打開');
    await app.go('/album');
    t.ok(!app.$('[data-card-float]'), '小卡開著就離開：小卡拆掉');
    t.ok(!app.$('#tabbar').inert && !app.$('#view').inert, '小卡開著就離開：背後恢復');
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

  t.test('探索上拉：卡片照剩下的高度縮，整張面板不用捲（兩張、四張、矮的手機）', async function (app) {
    const fr = app.win.frameElement, h0 = fr.style.height;
    const fits = function (msg) {
      const s = app.$('.ride-sheet'), sr = s.getBoundingClientRect(), st = app.$('.ride-v2__stack').getBoundingClientRect();
      t.ok(!s.classList.contains('is-collapsed'), msg + '：展開');
      t.eq(app.win.getComputedStyle(s).overflowY, 'hidden', msg + '：展開的面板不捲');
      t.ok(s.scrollHeight <= s.clientHeight + 1, msg + '：內容 ' + s.scrollHeight + ' ≤ 面板 ' + s.clientHeight);
      t.ok(st.bottom <= sr.bottom + 1, msg + '：卡片堆在面板裡 ' + Math.round(st.bottom) + ' ≤ ' + Math.round(sr.bottom));
      const out = app.$$('.ride-v2__card').filter(function (c) {
        const r = c.getBoundingClientRect();
        return r.height < 60 || r.top < st.top - 1 || r.bottom > st.bottom + 1;
      });
      t.eq(out.length, 0, msg + '：每張卡都在卡片堆裡、沒有縮到看不見');
    };
    try {
      for (const area of ['glass-kiln', 'market']) {
        await app.reset();
        await app.go('/ride?mode=explore&area=' + area);
        await app.click('[data-act="expand-cards"]');
        fits(area);
      }
      /* 矮的手機：改 iframe 高度、補發 resize（原因見上一個測試），地圖重畫時卡片區重量 */
      const before = app.$('.ride-sheet').style.getPropertyValue('--ride-cards-h');
      fr.style.height = '667px';
      app.win.dispatchEvent(new app.win.Event('resize'));
      await app.waitFor(function () { return app.$('.ride-sheet').style.getPropertyValue('--ride-cards-h') !== before; }, 3000, '改高之後卡片區重量');
      fits('667 高');
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
      A.store.set('dropoff', T.fixtures.dropoff({ id: 'moat', name: '護城河的舊碼頭階梯', km: null, via: 'e' }));
      await app.go('/ride');
      t.includes(app.text('.ride-drop__meta'), '距離待確認', '/ride 下車點寫距離待確認');
      t.ok(!app.$('main.view [data-fare]') && !app.$('main.view [data-min]'), '/ride 沒有車資與分鐘');
      await app.go('/ride/confirm');
      t.includes(app.text('[data-cars]'), '距離待確認', '確認叫車頁的車種寫距離待確認');
      t.ok(!app.$('main.view [data-fare]') && !app.$('main.view [data-fare-lo]'), '確認叫車頁沒有車資');
      checkPage(app, '/ride/confirm 距離不明');
      await app.go('/ride?mode=explore&area=moat');
      t.includes(app.text('[data-area-intro]'), '距離待確認', '探索地點卡寫距離待確認');
      t.ok(app.text('[data-area-intro]').indexOf('0 m') < 0, '不寫 0 m');
      await app.go('/notify');
      t.includes(app.text('[data-act="open-today"]'), '距離待確認', '通知的今天的地方寫距離待確認');
      A.store.set('dropoff', null);
      A.ride.setDropoff('moat', 'e');
      await app.at('/ride');
      t.eq(A.store.get('dropoff').km, null, 'dropoff.km＝null（不是 0）');
      A.store.set('trip', T.fixtures.trip({ placeId: 'moat', km: null }));
      await app.go('/trip');
      t.includes(app.text('[data-phase="riding"]'), '距離待確認', '/trip 寫距離待確認');
      t.ok(!app.$('main.view [data-fare]') && !app.$('main.view [data-min]'), '/trip 沒有車資與分鐘');
      A.store.set('trip', T.fixtures.trip({ placeId: 'moat', phase: 'done', rated: true, km: null }));
      await app.go('/trip/done');
      t.includes(app.text('.ride-done__meta'), '距離待確認', '/trip/done 寫距離待確認');
      t.ok(!app.$('main.view [data-fare]'), '/trip/done 沒有車資');
      t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
    } finally {
      A.place = orig;
    }
  });

  t.test('非 still：配對中 → 時間到自己切到行程中', async function (app) {
    await app.reset({ still: false, store: { dropoff: T.fixtures.dropoff() } });
    const A = app.APP;
    t.ok(!app.doc.documentElement.hasAttribute('data-still'), '非 still 模式');
    await app.go('/ride');
    await callRide(app);
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

  t.test('/ride 可按數 ≤ 10：拉把也算，下車點＋待收明信片最擠的那一刻也不超過', async function (app) {
    const done = T.fixtures.trip({ phase: 'done', rated: true });
    const drop = T.fixtures.dropoff({ id: 'lake', name: '青草湖的舊戲院地基', km: 6.4, via: 'e' });
    const cases = [
      ['空的', {}],
      ['下車點', { dropoff: drop }],
      ['待收', { trip: done }],
      ['下車點＋待收', { trip: done, dropoff: drop }],
      ['行程中', { trip: neiwanTrip('riding') }],
    ];
    for (const c of cases) {
      await app.reset({ store: c[1] });
      await app.go('/ride');
      await app.tick(40);
      const n = t.countTappables(app);
      t.ok(n <= 10, '/ride ' + c[0] + ' 可按數 ' + n + ' ≤ 10');
      t.noDeadButtons(app, '/ride ' + c[0]);
    }
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
    app.APP.store.set('trip', null);
    app.APP.store.set('dropoff', T.fixtures.dropoff({ id: 'lake', name: '青草湖的舊戲院地基', km: 6.4, via: 'e' }));
    await app.go('/ride/confirm');
    need('main.view .ride-cf__back', '確認叫車頁返回');
    need('[data-pin="pickup"] .ride-cf-pin__label', '上車點標籤');
    need('[data-pin="dest"] .ride-cf-pin__label', '下車點標籤');
    need('.ride-cf__tab[data-toast]', '預約');
    need('[data-act="pick-car"]', '車種');
    need('.ride-cf__opt', '付款那一列');
    t.eq(sizes.length, 0, '小於 44：' + sizes.join('、'));
  });

  /* ============================================================ 回歸測試（從 flows.spec 搬來）
     code review 與亂按 QA 找到的 bug，一條 bug 一條 test；只牽涉這個區塊的放這裡，名稱保留審查／QA／評估的編號
     （對得上 docs/WORKLOG.md 與 flows.spec 裡跨區塊的那幾條）。 */
  function now() { return new Date().toISOString(); }

  t.test('審查 1：trip 的 phase 由 startedAt 推導（注入時間，不靠 setTimeout 的時序）', async function (app) {
    await app.reset();
    const R = app.APP.ride;
    const t0 = Date.parse('2026-09-21T13:18:00.000Z');
    const trip = T.fixtures.trip({ placeId: 'lake', phase: 'matching', startedAt: new Date(t0).toISOString(), km: 6.4 });
    /* 純函式的各種情況在 tests/unit/views.test.mjs（node）；這裡只看瀏覽器裡同一個函式 */
    t.eq(R.trip.phase(trip, t0), 'matching', '剛叫車：配對中');
    t.eq(R.trip.phase(trip, t0 + R.MATCH_MS), 'riding', 'MATCH_MS 之後：行程中');

    /* 非 still：配對中離開 /trip（計時器被清掉）很久之後再回來 → 一進來就是行程中，不必再等 */
    const old = Object.assign({}, trip, { startedAt: new Date(Date.now() - 60000).toISOString() });
    await app.reset({ still: false, store: { trip: old }, hash: '/trip' });
    await app.at('/trip');
    t.eq(app.APP.store.get('trip').phase, 'riding', '重進 /trip：store 馬上寫成 riding');
    t.ok(!app.$('[data-phase="riding"]').hidden, '重進 /trip：行程中區塊直接顯示');
    t.ok(app.$('[data-phase="matching"]').hidden, '重進 /trip：配對中區塊藏起來');
    t.includes(app.doc.title, '行程中', '標題也是行程中');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
    await app.reset();
  });

  t.test('審查 2：/trip/done 在「有行程、還沒抵達」時給回到行程的路；舊資料的壞日期不出現 NaN', async function (app) {
    await app.reset({ store: { trip: T.fixtures.trip({ placeId: 'lake', startedAt: now(), km: 6.4 }) } });
    await app.go('/trip/done');
    t.includes(app.text('main.view[data-view]'), '還在前往', '不是「目前沒有行程」');
    const back = app.$('main.view [data-act="go-trip"]');
    t.eq(back && back.getAttribute('href'), '#/trip', '回到行程 → #/trip');
    t.noDeadButtons(app, '/trip/done（riding）');
    t.noBannedWords(app, { msg: '/trip/done（riding）' });
    await app.click('main.view [data-act="go-trip"]');
    await app.at('/trip');

    await app.reset({ store: { trip: T.fixtures.trip({ placeId: 'lake', phase: 'done', startedAt: 'not-a-date', rated: true, km: undefined }) } });
    await app.go('/trip/done');
    t.ok(!/NaN|undefined/.test(app.text('main.view[data-view]')), '沒有 NaN／undefined：' + app.text('.ride-done__meta'));
    t.eq(app.text('.ride-done__sum [data-fare]'), String(app.APP.fmt.fare(app.APP.fmt.km(app.APP.place('lake').dist))), '沒有 trip.km 時車資用 fmt.km(dist)');
  });

  t.test('QA 4a：行程進行中 setDropoff 一律擋下（K1、E、路線、搜尋）', async function (app) {
    await app.reset({ store: { trip: T.fixtures.trip({ placeId: 'lake', startedAt: now(), km: 6.4 }),
                               dropoff: T.fixtures.dropoff({ id: 'lake', name: '青草湖', km: 6.4, setAt: now(), via: 'e' }) } });
    const A = app.APP;
    t.eq(A.ride.setDropoff('neiwan', 'k1'), false, 'setDropoff 回 false');
    t.includes(app.text('.toast') || '', '行程進行中，先抵達或取消行程', 'toast');
    t.eq(A.store.get('dropoff').id, 'lake', 'dropoff 沒被改');
    await app.go('/place/neiwan');
    await app.click('[data-place-foot] [data-act="set-dropoff"]');
    await app.tick(60);
    t.eq(app.route().path, '/place/neiwan', 'K1：不導走');
    await app.go('/route/rail');
    await app.click('[data-breakpoint] [data-act="set-dropoff"]');
    await app.tick(60);
    t.eq(app.route().path, '/route/rail', '路線斷點：不導走');
    await app.go('/dropoff');
    await app.click('[data-act="choose-dropoff"]');
    await app.tick(60);
    t.eq(app.route().path, '/dropoff', '搜尋清單：不導走');
    await app.go('/ride?mode=explore');
    await app.click('.spot[data-spot="moat"]');
    await app.click('[data-area-intro] [data-act="use-yoxi"]');
    await app.tick(60);
    t.eq(A.store.get('dropoff').id, 'lake', '四個入口都沒改到 dropoff');
    /* 抵達之後就可以再設 */
    A.store.set('trip', Object.assign({}, A.store.get('trip'), { phase: 'done' }));
    t.eq(A.ride.setDropoff('moat', 'e'), true, '抵達後可以設');
  });

  t.test('QA 4c：行程進行中 /ride 的下車點卡是這一趟的目的地，不是 store.dropoff', async function (app) {
    await app.reset({ store: { trip: T.fixtures.trip({ placeId: 'lake', startedAt: now(), km: 6.4 }),
                               dropoff: T.fixtures.dropoff({ id: 'moat', name: '護城河', km: 1.8, setAt: now(), via: 'e' }) } });
    const A = app.APP, F = A.fmt;
    await app.go('/ride');
    t.eq(app.text('[data-drop-name]'), A.place('lake').name, '下車點＝行程目的地');
    t.eq(app.text('[data-fare]'), String(F.fare(6.4)), '車資用 trip.km');
    t.ok(app.$('.ride-drop a[href="#/trip"]'), '點下車點卡回行程');
    t.ok(!app.$('[data-act="clear-dropoff"]'), '行程中沒有「清除」');
    t.includes(app.text('[data-act="call-ride"]'), '回到行程', '叫車鈕是回到行程');
    t.noDeadButtons(app, '/ride（行程中）');
  });

  /* 今天（'MM.DD'）落在週回顧的哪一段：now（本週 7 天內）／prev（上週）／after（本週之後）／before */

  t.test('評估 2：轉換歸因 —— trip 帶 dropoff.via，行程紀錄顯示是從哪裡叫的', async function (app) {
    await app.reset();
    const A = app.APP;
    await app.go('/place/neiwan');
    await app.click('[data-place-foot] [data-act="set-dropoff"]');
    await app.at('/ride');
    await callRide(app);
    await app.at('/trip');
    t.eq(A.store.get('trip').via, 'k1', 'trip.via＝dropoff.via');
    await app.click('#demo-panel [data-act="advance-trip"]');
    await app.at('/trip/done');
    await app.click('[data-act="rate"][data-star="5"]');
    await app.click('.banner--gold');
    await app.at('/unlock/neiwan');
    await app.click('[data-act="collect"]');
    await app.at('/album');
    t.eq((A.store.get('rideVia') || {}).p9, 'k1', 'store.rideVia.p9＝k1');
    await app.go('/trips');
    const row = app.$('[data-trip-row][href="#/postcard/p9"]');
    t.ok(row && row.querySelector('[data-via="k1"]'), '/trips 的內灣那一列有歸因');
    t.includes(row && row.textContent, '從地方詳情', '小標文字');
    t.ok(app.$$('[data-trip-row] [data-via]').length === 1, '沒有歸因資料的舊卡不硬寫');
    t.noDeadButtons(app, '/trips');
    await app.reset();
  }, { timeout: 15000 });

  /* ================================================================ 7. 來回（去程 → 司機候車 → 回程）
     叫車首頁的「單程／來回」入口 2026-09-29 拿掉了（yoxi 原本的流程沒有）；行程 module 還支援來回，
     這裡用 fixture 或 APP.ride.trip.start(id, via, { round: true }) 建一趟。
     狀態機與公式的各種情況在 tests/unit/trip.test.mjs（node）；這裡驗畫面、流程、可按數與返回。 */
  function roundTrip(phase, extra) {
    return T.fixtures.trip(Object.assign({ phase: phase, round: true, via: 'e' }, extra || {}));
  }
  const LAKE = function () { return T.fixtures.dropoff({ id: 'lake', name: '青草湖的舊戲院地基', km: 6.4, via: 'e' }); };
  function money(app, sel) { return Number(app.text(sel)); }

  t.test('叫車首頁沒有「單程／來回」（跟 yoxi 一樣）：選好下車點下一步就是叫車前往，掃碼一直都在', async function (app) {
    await app.reset();
    const A = app.APP, R = A.ride, F = A.fmt;
    await app.go('/ride');
    R.setDropoff('lake', 'e');
    await app.waitFor(function () { return app.$('[data-act="call-ride"]'); }, 3000, '叫車鈕');
    const km = F.km(A.place('lake').dist);
    t.ok(!app.$('[data-round-pick]') && !app.$('[data-act="pick-round"]') && !app.$('[data-act="pick-oneway"]'), '沒有單程／來回');
    t.ok(app.$('main.view .ride-fab--scan'), '掃碼還在');
    t.eq(money(app, '[data-fare]'), F.fare(km), '預估車資＝fare(km)');
    t.includes(app.text('[data-act="call-ride"]'), '叫車前往', '叫車鈕寫叫車前往');
    t.ok(app.text('main.view').indexOf('來回') < 0, '畫面上沒有來回');
    checkPage(app, '/ride 下車點已填');
  });

  t.test('叫車（單程）→ 行程沒有 round、去程沒有來回那一行、抵達直接到結算', async function (app) {
    await app.reset({ store: { dropoff: LAKE() } });
    const A = app.APP;
    await app.go('/ride');
    await callRide(app);
    await app.at('/trip');
    t.eq('round' in A.store.get('trip'), false, '單程的行程沒有 round');
    t.ok(!app.$('[data-round-note]') && !app.$('[data-round-fare]'), '去程沒有來回的車資與說明');
    await app.click('#demo-panel [data-act="advance-trip"]');
    await app.at('/trip/done');
    t.eq(A.store.get('trip').phase, 'done', '單程抵達就是 done');
    t.ok(!app.$('[data-legs]'), '結算頁沒有三段');
  });

  t.test('/trip 來回的每一段：render、死按鈕、禁用詞、可按數、車資與分鐘＝公式；候車沒有會跑的數字', async function (app) {
    await app.reset({ store: { trip: roundTrip('riding'), dropoff: T.fixtures.dropoff() } });
    const A = app.APP, R = A.ride, F = A.fmt;
    const km = 28, f = R.roundFare(km);
    await app.go('/trip');
    await app.tick(60);
    checkPage(app, '/trip 來回去程');
    t.eq(money(app, '[data-phase="riding"] [data-fare]'), f.total, '去程：來回預估＝總數');
    t.eq(money(app, '[data-phase="riding"] [data-fare-go]') + money(app, '[data-phase="riding"] [data-fare-wait]') +
      money(app, '[data-phase="riding"] [data-fare-back]'), f.total, '三段相加＝總數');
    t.eq(money(app, '[data-phase="riding"] [data-min]'), F.rideMin(km), '去程分鐘＝rideMin');
    t.eq(money(app, '[data-round-note] [data-wait-max]'), R.WAIT_MAX_MIN, '去程就先說司機會等多久');

    await app.click('#demo-panel [data-act="advance-trip"]');
    await app.waitFor(function () { return app.$('[data-phase="waiting"]'); }, 3000, '候車那一段');
    t.eq(app.route().path, '/trip', '去程到了還在 /trip');
    t.eq(A.store.get('trip').phase, 'waiting', 'phase=waiting');
    t.eq(A.store.get('dropoff'), null, '抵達後清掉下車點');
    t.includes(app.doc.title, '司機在附近等你', '標題');
    checkPage(app, '/trip 候車');
    t.eq(money(app, '[data-phase="waiting"] [data-wait-max]'), R.WAIT_MAX_MIN, '司機最多等 N 分鐘（常數）');
    const gold = app.$('[data-phase="waiting"] [data-act="unlock-ride"]');
    t.ok(gold && gold.getAttribute('href') === '#/unlock/neiwan?ride=1', '主要動作：收下這一次的明信片 → /unlock/neiwan?ride=1');
    t.ok(app.$('[data-act="ride-back"]'), '回程，載我回家');
    t.eq(money(app, '[data-phase="waiting"] [data-fare]'), f.total, '候車：來回總數');
    t.includes(app.text('[data-act="cancel-trip"]'), '取消回程', '取消的是回程');
    const w0 = app.text('[data-phase="waiting"]');
    t.ok(!/倒數|\d+:\d\d/.test(w0), '候車沒有倒數、沒有時鐘：' + w0);
    await app.tick(1100);
    t.eq(app.text('[data-phase="waiting"]'), w0, '一秒之後字一樣（沒有計時器）');

    await app.click('[data-act="ride-back"]');
    await app.waitFor(function () { return app.$('[data-phase="returning"]'); }, 3000, '回程那一段');
    t.eq(A.store.get('trip').phase, 'returning', 'phase=returning');
    t.includes(app.doc.title, '回家的路上', '標題');
    checkPage(app, '/trip 回程');
    t.ok(!app.$('main.view [data-act="arrive"], main.view [data-act="advance-trip"]'), '回程沒有抵達或到家開發控制');
    t.ok(!/demo|模擬抵達|模擬到家/i.test(app.text('main.view')), '回程文案沒有 demo 或模擬到家');
    const returningContact = app.$('[data-phase="returning"] [data-act="call-driver"]');
    t.ok(returningContact && typeof returningContact.onclick === 'function', '回程仍可聯絡司機');
    await app.click(returningContact);
    t.includes(app.text('.toast'), '正在撥號給', '回程聯絡司機可用');
    t.eq(money(app, '[data-phase="returning"] [data-min]'), F.rideMin(km), '回程分鐘＝rideMin（一樣遠）');
    t.ok(app.$('[data-back-pending]'), '還沒收：說到家之後也收得到');

    await app.click('#demo-panel [data-act="advance-trip"]');
    await app.at('/trip/done');
    t.eq(A.store.get('trip').phase, 'done', '到家');
    checkPage(app, '/trip/done 來回');
    t.eq(money(app, '.ride-done__sum [data-fare]'), f.total, '結算：總數');
    t.eq(money(app, '[data-legs] [data-fare-go]'), F.fare(km), '去程');
    t.eq(money(app, '[data-legs] [data-fare-wait]'), R.WAIT_FEE, '候車');
    t.eq(money(app, '[data-legs] [data-fare-back]'), F.fare(km), '回程');
    t.eq(money(app, '[data-legs] [data-min]'), F.rideMin(km), '去程分鐘');
    t.eq(money(app, '.ride-done__meta [data-km]'), km, '來回各 N 公里');
    await app.click('[data-act="rate"][data-star="5"]');
    const g = app.$('[data-gold] .banner--gold');
    t.ok(!app.$('[data-gold]').hidden && g.getAttribute('href') === '#/unlock/neiwan?ride=1', '還沒收：評分後金色橫幅去收');
    checkPage(app, '/trip/done 來回（評分後）');
  }, { timeout: 20000 });

  t.test('來回全程（行程 module 建的來回）：候車時收下（搭車、金框）→ 回程 → 到家 → 行程紀錄寫來回、點數多一列回程；返回鍵與歷史', async function (app) {
    await app.reset();
    const A = app.APP, R = A.ride, F = A.fmt;
    const km = F.km(A.place('neiwan').dist), card = A.place('neiwan').card;
    const pts0 = R.pointsTotal();
    await app.go('/ride');
    const i0 = hist(app);
    R.setDropoff('neiwan', 'k1');
    await app.waitFor(function () { return app.$('[data-act="call-ride"]'); }, 3000, '叫車鈕');
    R.trip.start('neiwan', 'k1', { round: true });
    A.nav.go('/trip');
    await app.at('/trip');
    t.eq(hist(app), i0 + 1, '/trip 在下一格');
    R.arrive();
    await app.waitFor(function () { return app.$('[data-phase="waiting"]'); }, 3000, '候車');
    t.eq(hist(app), i0 + 1, '去程到了：換掉同一格（返回不會回到去程）');
    t.eq(R.trip.waiting() && R.trip.waiting().placeId, 'neiwan', 'waiting() 是這一趟');

    /* /ride 在候車中：回到行程＋待收的金色入口，可按數 ≤ 10 */
    await app.go('/ride');
    t.includes(app.text('[data-act="call-ride"]'), '回到行程', '回到行程');
    t.includes(app.text('.ride-drop .route-input__label'), '來回', '這一趟是來回');
    t.ok(app.$('.ride-unlock[data-act="unlock-ride"]'), '待收的入口');
    t.ok(!app.$('[data-round-pick]'), '行程中不再選單程／來回');
    checkPage(app, '/ride 來回候車中');
    await app.go('/trip');

    await app.click('[data-phase="waiting"] [data-act="unlock-ride"]');
    await app.at('/unlock/neiwan');
    await app.click('[data-act="collect"]');
    /* explore 收完：現在去收藏；之後（APP.ride.trip.waiting() 非 null）回 /trip。兩種都接受 */
    await app.waitFor(function () { const p = app.route().path; return p === '/album' || p === '/trip'; }, 4000, '收下之後');
    t.eq(app.STATE.card(card) && app.STATE.card(card).by, 'ride', '候車時收下：算搭車');
    t.eq(A.store.get('cardStyle')[card], 'gold', '金框');
    const tr = A.store.get('trip');
    t.ok(tr && tr.phase === 'waiting' && tr.collected === true, '行程還在候車、記下收過了');
    t.eq(A.store.get('rideVia')[card], 'k1', '歸因');

    if (app.route().path !== '/trip') await app.go('/trip');
    t.includes(app.text('[data-wait-got]'), '收下了', '候車頁：這一次的明信片收下了');
    t.ok(!app.$('[data-phase="waiting"] [data-act="unlock-ride"]'), '收過了：沒有收下的入口');
    t.ok(app.$('[data-act="ride-back"]').classList.contains('btn-primary'), '收過了：回程是主要動作');
    checkPage(app, '/trip 候車（收過了）');
    await app.click('[data-act="ride-back"]');
    await app.waitFor(function () { return app.$('[data-phase="returning"]'); }, 3000, '回程');
    t.ok(!app.$('[data-back-pending]'), '收過了：回程不再提醒');
    await app.click('#demo-panel [data-act="advance-trip"]');
    await app.at('/trip/done');
    await app.click('[data-act="rate"][data-star="4"]');
    const g = app.$('[data-gold] .banner--gold');
    t.eq(g && g.getAttribute('href'), '#/postcard/' + card, '收過了：金色橫幅去看收下的那一張');
    t.eq(g && g.getAttribute('data-act'), 'open-postcard', 'data-act');
    t.includes(app.text('[data-gold]'), '收下了', '寫收下了');
    t.noDeadButtons(app, '/trip/done 來回（收過了）');
    await app.click('[data-act="go-home"]');
    await app.at('/ride');
    t.eq(A.store.get('trip'), null, '到家、評了分、收過了：/ride 安靜清掉這一趟');
    t.ok(!app.$('[data-act="unlock-ride"]'), '沒有待收的入口');

    await app.go('/trips');
    const row = app.$('[data-trip-row][href="#/postcard/' + card + '"]');
    t.ok(row && row.hasAttribute('data-round'), '行程紀錄：來回那一列');
    t.includes(row && row.textContent, '來回', '寫來回');
    t.eq(row && Number(row.querySelector('[data-fare]').textContent), R.roundFare(km).total, '車資＝來回總數');
    t.eq(row && Number(row.querySelector('[data-km]').textContent), km, '來回各 N 公里');
    t.noDeadButtons(app, '/trips 來回');
    await app.go('/points');
    const amt = Math.floor(F.fare(km) / R.FARE_PER_POINT);
    t.eq(Number(app.text('[data-points-total]')) - pts0, amt * 2 + R.RIDE_BONUS, '點數：去程＋回程的搭車回饋＋城事解鎖回饋');
    const sum = app.$$('[data-amt]').reduce(function (a, e) { return a + Number(e.getAttribute('data-amt')); }, 0);
    t.eq(Number(app.text('[data-points-total]')), sum, '總數＝明細相加');
    t.ok(app.$$('[data-points-row]').some(function (r) { return r.textContent.indexOf('回程') >= 0; }), '有一列回程');
  }, { timeout: 25000 });

  t.test('來回：候車中「取消回程」→ 退回單程的已抵達，還沒收的卡還在 /ride；回程中的 /trip/done 給回到行程的路', async function (app) {
    await app.reset({ store: { trip: roundTrip('waiting') } });
    const A = app.APP;
    await app.go('/trip/done');
    t.includes(app.text('main.view'), '附近等你', '/trip/done 在候車中：司機在附近等你');
    t.includes(app.text('main.view'), '到家之後', '來回到家才結算');
    t.eq(app.$('main.view [data-act="go-trip"]').getAttribute('href'), '#/trip', '回到行程');
    checkPage(app, '/trip/done（候車中）');
    await app.go('/trip');
    await app.click('[data-act="cancel-trip"]');
    t.includes(app.text('.app-confirm'), '回程', '確認框問的是回程');
    await app.click('[data-act="confirm-yes"]');
    await app.at('/ride');
    const tr = A.store.get('trip');
    t.ok(tr && tr.phase === 'done' && !('round' in tr), '退回單程的已抵達');
    t.ok(app.$('[data-act="unlock-ride"]'), '還沒收的卡：/ride 有收下的入口');
    await app.reset({ store: { trip: roundTrip('returning') } });
    await app.go('/trip/done');
    t.includes(app.text('main.view'), '回家的路上', '/trip/done 在回程中：還在回家的路上');
    t.noDeadButtons(app, '/trip/done（回程中）');
  });

  t.test('來回結算：回程的起訖只在去程抵達之後才寫（demo 把時間壓在一起時不寫一個更早的回程）', async function (app) {
    const t0 = Date.parse(T.fixtures.T0);
    const clocks = function () { return (app.text('[data-legs]').match(/\d+:\d\d – \d+:\d\d/g) || []).length; };
    await app.reset({ store: { trip: roundTrip('done', { rated: true, backAt: new Date(t0 + 3 * 3600000).toISOString() }) } });
    await app.go('/trip/done');
    t.eq(clocks(), 2, '回程在去程之後：去程、回程都寫起訖');
    await app.reset({ store: { trip: roundTrip('done', { rated: true, backAt: T.fixtures.T0 }) } });
    await app.go('/trip/done');
    t.eq(clocks(), 1, '回程比去程抵達還早（demo）：只寫去程的起訖');
    t.eq(Number(app.text('[data-legs] [data-min]')), app.APP.fmt.rideMin(28), '分鐘照樣寫');
  });

  t.test('來回的 demo：demo 面板「搭 yoxi 抵達」同一個目的地 → 候車（來回留著）；收下之後 waiting() 還是這一趟', async function (app) {
    await app.reset({ store: { trip: roundTrip('riding') } });
    const A = app.APP;
    if (!(A.system && A.system.demoArrive)) { t.ok(true, 'system 沒有 demoArrive：略過'); return; }
    await app.go('/trip');
    A.system.demoArrive('neiwan', 'ride');
    await app.at('/unlock/neiwan');
    const tr = A.store.get('trip');
    t.ok(tr && tr.round === true && tr.phase === 'waiting', 'demo 搭 yoxi 抵達：來回的候車');
    await app.click('[data-act="collect"]');
    await app.waitFor(function () { const p = app.route().path; return p === '/album' || p === '/trip'; }, 4000, '收下之後');
    t.ok(A.ride.trip.waiting() && A.store.get('trip').collected === true, '收下之後司機還在等');
  }, { timeout: 15000 });

  t.test('距離不明的來回：不寫車資與分鐘，寫「距離待確認」', async function (app) {
    await app.reset();
    const A = app.APP, orig = A.place;
    A.place = function () {
      const p = orig.apply(this, arguments);
      if (p && p.id === 'moat') p.dist = null;
      return p;
    };
    try {
      A.store.set('trip', roundTrip('riding', { placeId: 'moat', km: null }));
      await app.go('/trip');
      t.includes(app.text('[data-phase="riding"]'), '距離待確認', '/trip 去程');
      t.ok(!app.$('main.view [data-fare]') && !app.$('main.view [data-min]'), '/trip 去程沒有車資與分鐘');
      A.store.set('trip', roundTrip('waiting', { placeId: 'moat', km: null }));
      await app.go('/trip');
      t.includes(app.text('[data-phase="waiting"]'), '距離待確認', '/trip 候車');
      t.ok(!app.$('main.view [data-fare]'), '/trip 候車沒有車資');
      A.store.set('trip', roundTrip('done', { placeId: 'moat', km: null, rated: true }));
      await app.go('/trip/done');
      t.includes(app.text('.ride-done__meta'), '距離待確認', '/trip/done');
      t.ok(!app.$('main.view [data-fare]') && !app.$('[data-legs]'), '/trip/done 沒有車資與三段');
      t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
    } finally {
      A.place = orig;
    }
  }, { timeout: 15000 });

  t.test('/ride 可按數 ≤ 10：來回候車中＋待收、到家＋待收＋下車點', async function (app) {
    const drop = LAKE();
    const cases = [
      ['來回去程', { trip: roundTrip('riding') }],
      ['來回候車＋待收', { trip: roundTrip('waiting') }],
      ['來回回程＋待收', { trip: roundTrip('returning') }],
      ['來回到家＋待收', { trip: roundTrip('done', { rated: true }) }],
      ['來回到家＋待收＋下車點', { trip: roundTrip('done', { rated: true }), dropoff: drop }],
    ];
    for (const c of cases) {
      await app.reset({ store: c[1] });
      await app.go('/ride');
      await app.tick(40);
      const n = t.countTappables(app);
      t.ok(n <= 10, '/ride ' + c[0] + ' 可按數 ' + n + ' ≤ 10');
      t.noDeadButtons(app, '/ride ' + c[0]);
    }
  }, { timeout: 15000 });

  /* ================================================================ 8. 確認叫車（/ride/confirm，照 yoxi app）
     叫車前往 → 這一頁（立即叫車／預約、車種、付款、確認叫車）→ /trip。這一頁不留在歷史裡。 */
  function boxOf(el) { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }
  function overlap(a, b) { return !(a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t); }
  function inside(a, b) { return a.l >= b.l - 0.5 && a.r <= b.r + 0.5 && a.t >= b.t - 0.5 && a.b <= b.b + 0.5; }

  t.test('確認叫車頁：叫車前往 → 這一頁；車資＝公式、司機幾分鐘到＝PICKUP_MIN；換車種；確認叫車 → /trip，這一頁不留在歷史裡', async function (app) {
    await app.reset({ store: { dropoff: LAKE() } });
    const A = app.APP, R = A.ride, F = A.fmt;
    await app.go('/ride');
    const i0 = hist(app);
    await app.click('[data-act="call-ride"]');
    await app.at('/ride/confirm');
    t.eq(hist(app), i0 + 1, '確認叫車頁在下一格');
    t.eq(A.store.get('trip'), null, '還沒叫車：沒有行程');
    const tb = app.$('#tabbar');
    t.ok(!tb || tb.hidden, '沒有底欄');
    checkPage(app, '/ride/confirm');
    t.eq(t.countTappables(app), 10, '可按數剛好 10（選中的車種、立即叫車是字）');

    /* 車資：多元＝fare(km)；跳表＝多元 × METER_RANGE、往外取到 10 元 */
    const km = F.km(A.place('lake').dist), f = R.carFares(km);
    t.eq(f.multi, F.fare(km), 'carFares：多元＝fare(km)');
    t.eq(f.lo, Math.floor(F.fare(km) * R.METER_RANGE[0] / 10) * 10, 'carFares：跳表下限');
    t.eq(f.hi, Math.ceil(F.fare(km) * R.METER_RANGE[1] / 10) * 10, 'carFares：跳表上限');
    t.ok(f.lo <= f.multi && f.multi <= f.hi, '多元落在跳表範圍裡');
    t.eq(R.carFares(null), null, '距離不明：null');
    const card = function (id) { return app.$('[data-cars] [data-car="' + id + '"]'); };
    const num = function (id, sel) { const e = card(id) && card(id).querySelector(sel); return e ? Number(e.textContent) : null; };
    t.eq(num('any', '[data-fare-lo]'), f.lo, '不限車種：下限');
    t.eq(num('any', '[data-fare-hi]'), f.hi, '不限車種：上限');
    t.includes(card('any').textContent, '多元 $' + f.multi, '不限車種：寫多元的車資');
    t.eq(num('meter', '[data-fare-lo]'), f.lo, '小黃：下限');
    t.eq(num('meter', '[data-fare-hi]'), f.hi, '小黃：上限');
    t.eq(num('multi', '[data-fare]'), f.multi, '多元計程車＝fare(km)');
    const mins = app.$$('main.view [data-pickup-min]');
    t.ok(mins.length === 4 && mins.every(function (e) { return Number(e.textContent) === R.PICKUP_MIN; }),
      '幾分鐘到＝PICKUP_MIN（標籤＋三種車）');

    /* 預設不限車種：選中的是字（aria-current），另外兩種是按鈕 */
    t.ok(card('any').tagName !== 'BUTTON' && card('any').getAttribute('aria-current') === 'true', '預設不限車種、是字');
    t.eq(app.$$('[data-cars] [data-act="pick-car"]').length, 2, '另外兩種是按鈕');
    t.ok(app.$('.ride-cf__tab.is-on') && app.$('.ride-cf__tab.is-on').tagName !== 'BUTTON', '立即叫車是字');

    /* 地圖：上車點與下車點兩個標籤，在地圖裡、不互相蓋住、不被返回鍵蓋住 */
    const mapBox = boxOf(app.$('[data-confirm-map] .app-map'));
    const back = boxOf(app.$('.ride-cf__back'));
    const from = app.$('[data-pin="pickup"] .ride-cf-pin__label'), to = app.$('[data-pin="dest"] .ride-cf-pin__label');
    t.includes(from.textContent, app.MOCK.USER.home, '上車點標籤＝家');
    t.eq(app.text('[data-pin="dest"] [data-drop-name]'), A.place('lake').name, '下車點標籤＝地名');
    t.ok(inside(boxOf(from), mapBox) && inside(boxOf(to), mapBox), '兩個標籤都在地圖裡');
    t.ok(!overlap(boxOf(from), boxOf(to)), '兩個標籤不互相蓋住');
    t.ok(!overlap(boxOf(from), back) && !overlap(boxOf(to), back), '標籤不被返回鍵蓋住');
    t.eq(from.getAttribute('href'), '#/pickup', '點上車點標籤換上車點');
    t.eq(to.getAttribute('href'), '#/dropoff', '點下車點標籤換下車點');

    /* 換車種：就地重畫，焦點留在選中的那一張 */
    await app.click('[data-act="pick-car"][data-car="meter"]');
    t.ok(card('meter').classList.contains('is-on') && card('meter').tagName !== 'BUTTON', '選了小黃');
    t.eq(app.doc.activeElement, card('meter'), '焦點在選中的那一張');
    t.ok(card('any').tagName === 'BUTTON', '不限車種變回按鈕');
    t.eq(num('meter', '[data-fare-lo]'), f.lo, '換了之後車資照樣是公式');
    checkPage(app, '/ride/confirm（小黃）');

    /* 確認叫車 → /trip（取代這一頁）；返回回到叫車首頁 */
    await app.click('[data-act="confirm-ride"]');
    await app.at('/trip');
    const tr = A.store.get('trip');
    t.ok(tr && tr.placeId === 'lake' && tr.via === 'e' && !('round' in tr), '叫的是單程、歸因照舊');
    t.eq(hist(app), i0 + 1, '/trip 取代確認叫車頁');
    A.nav.back();
    await app.at('/ride');
    t.eq(hist(app), i0, '返回回到叫車首頁（不是確認叫車頁）');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
  }, { timeout: 15000 });

  t.test('確認叫車頁：連點只推一格、只叫一次；返回鍵回 /ride；沒有下車點、行程進行中都給回去的路', async function (app) {
    await app.reset({ store: { dropoff: LAKE() } });
    const A = app.APP;
    await app.go('/ride');
    const i0 = hist(app);
    const call = app.$('[data-act="call-ride"]');
    call.click(); call.click();
    await app.at('/ride/confirm');
    await app.tick(200);
    t.eq(hist(app), i0 + 1, '連點叫車前往只推一格');
    const go = app.$('[data-act="confirm-ride"]');
    go.click(); go.click();
    await app.at('/trip');
    await app.tick(200);
    t.eq(hist(app), i0 + 1, '連點確認叫車只換一次');
    t.eq(A.store.get('trip').placeId, 'lake', '叫了這一趟');
    A.store.set('trip', null);
    A.store.set('dropoff', LAKE());
    await app.go('/ride');
    const i1 = hist(app);
    await app.click('[data-act="call-ride"]');
    await app.at('/ride/confirm');
    await T.helpers.clickBack(app);
    await app.at('/ride');
    t.eq(hist(app), i1, '返回鍵退回原本那一格 /ride');
    t.eq(A.store.get('trip'), null, '返回不會叫車');

    await app.reset();
    await app.go('/ride/confirm');
    t.includes(app.text('main.view'), '還沒有下車點', '沒有下車點');
    t.ok(app.$('main.view a[href="#/ride"]'), '回叫車');
    checkPage(app, '/ride/confirm 沒有下車點');
    await app.reset({ store: { trip: neiwanTrip('riding'), dropoff: LAKE() } });
    await app.go('/ride/confirm');
    t.includes(app.text('main.view'), '行程進行中', '行程進行中');
    t.ok(app.$('main.view a[href="#/trip"]'), '回到行程');
    checkPage(app, '/ride/confirm 行程進行中');
    t.eq(app.APP.store.get('trip').placeId, 'neiwan', '沒有動到進行中的行程');
  }, { timeout: 15000 });

  t.test('確認叫車頁的地圖：玻璃窯跟家同一個座標 → 標籤一上一下；內灣超出底圖 → 目的地夾在邊緣；都在地圖裡', async function (app) {
    const cases = [['glass-kiln', false], ['neiwan', true], ['moat', false], ['hill', false]];
    for (const c of cases) {
      await app.reset({ store: { dropoff: T.fixtures.dropoff({ id: c[0], name: c[0], km: null, via: 'e' }) } });
      await app.go('/ride/confirm');
      await app.tick(60);
      const mapBox = boxOf(app.$('[data-confirm-map] .app-map'));
      const from = app.$('[data-pin="pickup"] .ride-cf-pin__label'), to = app.$('[data-pin="dest"] .ride-cf-pin__label');
      t.ok(inside(boxOf(from), mapBox) && inside(boxOf(to), mapBox), c[0] + '：兩個標籤都在地圖裡');
      t.ok(!overlap(boxOf(from), boxOf(to)), c[0] + '：兩個標籤不互相蓋住');
      t.eq(app.$('[data-pin="dest"]').classList.contains('is-edge'), c[1], c[0] + '：目的地' + (c[1] ? '' : '不') + '夾在邊緣');
      t.eq(app.errors.length, 0, c[0] + ' 錯誤：' + app.errors.join('；'));
    }
  }, { timeout: 20000 });
});
