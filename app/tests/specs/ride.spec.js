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
    t.ok(app.$('.ride-sheet .ride-mode__grip'), '搭車模式有向下收合的拉把');
    t.ok(app.$('[data-act="mode-explore"]'), '面板內可切探索');
  });

  t.test('搭車面板只可往下收合，點按後恢復', async function (app) {
    await app.reset();
    await app.go('/ride');
    const sheet = app.$('.ride-sheet'), grip = app.$('.ride-mode__grip'), W = app.win;
    const box = grip.getBoundingClientRect();
    grip.dispatchEvent(new W.PointerEvent('pointerdown', { bubbles: true, clientY: box.top + 10, pointerId: 1 }));
    W.dispatchEvent(new W.PointerEvent('pointermove', { bubbles: true, clientY: box.top - 80, pointerId: 1 }));
    W.dispatchEvent(new W.PointerEvent('pointerup', { bubbles: true, clientY: box.top - 80, pointerId: 1 }));
    t.ok(!sheet.classList.contains('is-condensed'), '向上拖不展開或切換搭車面板');
    grip.dispatchEvent(new W.PointerEvent('pointerdown', { bubbles: true, clientY: box.top + 10, pointerId: 2 }));
    W.dispatchEvent(new W.PointerEvent('pointermove', { bubbles: true, clientY: box.top + 90, pointerId: 2 }));
    t.ok(!!sheet.style.maxHeight, '下拉時面板高度跟手');
    W.dispatchEvent(new W.PointerEvent('pointerup', { bubbles: true, clientY: box.top + 90, pointerId: 2 }));
    t.ok(sheet.classList.contains('is-condensed'), '向下拖收合搭車面板');
    t.ok(app.$('[data-act="restore-ride"]').offsetHeight > 0, '收合後可點按恢復');
    await app.click('[data-act="restore-ride"]');
    t.ok(!sheet.classList.contains('is-condensed'), '點按恢復搭車欄位');
    t.ok(!!sheet.style.getPropertyValue('--ride-open-height'), '恢復使用已量測的高度');
    t.eq(app.route().query.get('mode'), null, '全程留在搭車');
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
    t.eq(app.$$('[data-area-expanded] [data-act="open-card"]').length, 2, '預設最近地區的兩張卡');
    t.eq(app.$$('[data-act="all-areas"], [data-act="select-area"]').length, 0, '展開後沒有多餘的地區清單');
    const firstDown = grip.getBoundingClientRect();
    grip.dispatchEvent(new W.PointerEvent('pointerdown', { bubbles: true, clientY: firstDown.top + 10, pointerId: 2 }));
    W.dispatchEvent(new W.PointerEvent('pointermove', { bubbles: true, clientY: firstDown.top + 100, pointerId: 2 }));
    W.dispatchEvent(new W.PointerEvent('pointerup', { bubbles: true, clientY: firstDown.top + 100, pointerId: 2 }));
    await app.click('.spot[data-spot="market"]');
    t.eq(app.route().query.get('area'), 'market', '地圖選定東門');
    await app.click('[data-act="expand-cards"]');
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
});
