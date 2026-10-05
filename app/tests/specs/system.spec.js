/* ==========================================================================
   system.spec — onboarding、城事設定、推播浮層、分享面板、demo 工具（system 角色維護）
   ========================================================================== */
T.spec('system', function (t) {

  function pushmock(app) { return app.$('.device > .pushmock'); }
  /* 元素比對的訊息：t.eq 印 DOM 元素只會印出 {} */
  function tag(el) { return el ? (el.getAttribute && el.getAttribute('data-act')) || el.tagName || String(el) : String(el); }
  function same(a, b, msg) { return t.ok(a === b, msg + '（得到 ' + tag(a) + '，預期 ' + tag(b) + '）'); }

  t.test('/welcome render、無死按鈕與禁用詞、沒有「登入」', async function (app) {
    await app.reset();
    await app.go('/welcome');
    const v = app.view();
    t.ok(v && v.getAttribute('data-view') === 'welcome', 'view=welcome');
    t.eq(app.$$('[data-slide]').length, 3, '三張卡');
    t.ok(app.$$('[data-slide] .ai-mark').length === 3, '每張插畫有 AI 生成示意');
    t.ok(app.$('#tabbar').hidden, 'tab bar 隱藏');
    t.ok((v.textContent || '').indexOf('登入') < 0, '沒有登入');
    t.noDeadButtons(app);
    t.noBannedWords(app);
    t.ok(t.countTappables(app) <= 10, '可按數 ' + t.countTappables(app));
    t.eq(app.errors.length, 0, '沒有錯誤 ' + app.errors.join('；'));
  });

  t.test('/welcome 點點與下一張切換，開始 → onboarded 並到 /ride', async function (app) {
    await app.reset({ onboarded: false, hash: '/welcome' });
    await app.at('/welcome');
    t.ok(app.$('[data-act="start"]').hidden, '第一張時「開始」藏著');
    await app.click('[data-act="next"]');
    t.eq(app.view().getAttribute('data-slide-at'), '1', '下一張 → 第 2 張');
    await app.click('[data-dot="2"]');
    t.eq(app.view().getAttribute('data-slide-at'), '2', '點點 → 第 3 張');
    t.ok(!app.$('[data-act="start"]').hidden, '最後一張出現「開始」');
    await app.click('[data-act="start"]');
    await app.at('/ride');
    t.eq(app.APP.store.get('onboarded'), true, 'store.onboarded');
    t.eq(app.storage('store').onboarded, true, '寫進 localStorage');
  });

  t.test('略過也會 onboarded', async function (app) {
    await app.reset({ onboarded: false, hash: '/welcome' });
    await app.at('/welcome');
    await app.click('[data-act="skip"]');
    await app.at('/ride');
    t.eq(app.APP.store.get('onboarded'), true, 'store.onboarded');
  });

  t.test('第一次開 #/ 會到 /welcome；onboarded 後到 /ride', async function (app) {
    await app.reset({ onboarded: false, hash: '/' });
    await app.at('/welcome');
    t.ok(true, '到 /welcome');
    await app.reset({ hash: '/' });
    await app.at('/ride');
    t.ok(true, '到 /ride');
  });

  t.test('/settings render、無死按鈕、無禁用詞、初始可按數 ≤ 10', async function (app) {
    await app.reset();
    await app.go('/settings');
    const v = app.view();
    t.ok(v && v.getAttribute('data-view') === 'settings', 'view=settings');
    t.ok(app.$('#tabbar').hidden, 'tab bar 隱藏');
    t.eq(app.$$('main.view [data-switch]').length, 7, '七個開關（含探索模式的景點）');
    t.ok(!app.$('main.view [data-switch="steps"]'), '不再提供步數資料開關');
    t.ok(app.text('main.view').indexOf('一天最多兩則') >= 0, '說出上限');
    t.ok(app.text('main.view').indexOf('只有你') >= 0 && app.text('main.view').indexOf('你可分享') >= 0, '隱私分軌');
    t.noDeadButtons(app);
    t.noBannedWords(app);
    const n = t.countTappables(app);
    t.ok(n <= 10, '可按數 ' + n);
    /* 展開 demo 工具與關於：內容都在、仍然沒有死按鈕與禁用詞 */
    await app.click('[data-act="more"]');
    t.ok(!app.$('[data-more]').hidden, '展開');
    t.eq(app.text('[data-version]'), app.APP.system.VERSION, '版本字串');
    t.ok(app.text('main.view').indexOf('OpenStreetMap') >= 0, '地圖署名');
    const P = app.win.PHOTOS_DATA || {};
    const nPhotos = Object.keys(P).reduce(function (a, k) { return a + (P[k] || []).length; }, 0);
    t.eq(app.$$('.sys-set__credits li').length, nPhotos, '照片授權逐張列出');
    t.noDeadButtons(app);
    t.noBannedWords(app);
    t.eq(app.errors.length, 0, '沒有錯誤 ' + app.errors.join('；'));
  });

  t.test('返回鍵回到來處', async function (app) {
    await app.reset();
    await app.go('/ride');
    await app.go('/settings');
    await app.click('main.view a[data-back]');
    await app.at('/ride');
    t.ok(true, '回 /ride');
  });

  t.test('切開關會寫進 STATE.settings', async function (app) {
    await app.reset();
    await app.go('/settings');
    const before = app.STATE.all.settings.pushAm;
    await app.click('main.view [data-switch="pushAm"]');
    t.eq(app.STATE.all.settings.pushAm, !before, 'pushAm 翻轉');
    t.eq(app.$('main.view [data-switch="pushAm"]').classList.contains('is-on'), !before, '開關外觀跟著翻');
    const trips = app.STATE.all.settings.trips;
    await app.click('main.view [data-switch="trips"]');
    t.eq(app.STATE.all.settings.trips, !trips, 'trips 翻轉');
    t.eq(app.storage('state').settings.pushAm, !before, '寫進 localStorage');
  });

  t.test('早上推播：浮層、只記一次、點卡片到叫車頁選定地點', async function (app) {
    await app.reset();
    await app.go('/ride');
    app.APP.ui.push({ when: 'am' });
    await app.waitFor(function () { return pushmock(app); }, 2000, '.pushmock');
    const M = app.MOCK;
    t.ok(app.text('.pushmock').indexOf(M.TODAY.name) >= 0, '標題有今天的地方');
    t.eq(app.$('.pushmock__time').textContent, '8:10', '早上 8:10');
    t.eq(app.APP.store.get('pushes').length, 1, 'pushes 1 則');
    app.APP.ui.push({ when: 'am' });
    await app.tick(30);
    t.eq(app.APP.store.get('pushes').length, 1, '再發一次不變');
    t.eq(app.$$('.device > .pushmock').length, 1, '浮層只有一張');
    await app.click('.pushmock [data-act="open-push"]');
    await app.at('/ride');
    t.eq(app.route().query.get('area'), app.MOCK.TODAY.id, '選定今天的地方');
    t.ok(!pushmock(app), '浮層收掉');
  });

  t.test('晚上推播：邀請製作回憶卡、點卡片到 /lookback', async function (app) {
    await app.reset();
    await app.go('/ride');
    app.APP.ui.push({ when: 'pm' });
    await app.waitFor(function () { return pushmock(app); }, 2000, '.pushmock');
    t.eq(app.text('.pushmock__t'), '把去過的地方，做成一張回憶卡', 'pm 標題');
    t.includes(app.text('.pushmock'), '選一個地方，再挑一種光線', 'pm 內文');
    t.eq(app.$('.pushmock__time').textContent, '21:30', '晚上 21:30');
    await app.click('.pushmock [data-act="open-push"]');
    await app.at('/lookback');
    t.eq(app.APP.store.get('pushes').length, 1, 'pushes 1 則');
  });

  t.test('關掉晚上推播後不會出現浮層；關閉鈕收掉浮層', async function (app) {
    await app.reset();
    await app.go('/ride');
    app.STATE.setSetting('pushPm', false);
    app.APP.ui.push({ when: 'pm' });
    await app.tick(30);
    t.ok(!pushmock(app), '沒有浮層');
    t.eq(app.APP.store.get('pushes').length, 0, 'pushes 沒增加');
    app.APP.ui.push({ when: 'am' });
    await app.waitFor(function () { return pushmock(app); }, 2000, '.pushmock');
    await app.click('.pushmock [data-act="close-push"]');
    t.ok(!pushmock(app), '關閉');
  });

  t.test('pushes 只留今天的', async function (app) {
    const old = new Date(Date.now() - 3 * 864e5).toISOString();
    await app.reset({ store: { pushes: [{ when: 'am', at: old }, { when: 'pm', at: old }] } });
    await app.go('/settings');
    t.eq(app.APP.store.get('pushes').length, 0, '舊的濾掉');
    app.APP.ui.push({ when: 'am' });
    await app.tick(30);
    t.eq(app.APP.store.get('pushes').length, 1, '今天的可以發');
  });

  t.test('分享面板：有明信片時四格（傳到 LINE → 長輩圖 → 存圖 → 連結）、沒有時三格、點 scrim 關閉', async function (app) {
    await app.reset();
    await app.go('/album');
    app.APP.ui.share({ kind: 'postcard', card: 'p1' });
    await app.waitFor(function () { return app.$('.sharesheet'); }, 2000, '.sharesheet');
    t.eq(app.text('.sharesheet__t'), '分享這張明信片', '標題依 kind');
    const acts = function () { return app.$$('.sharesheet .row-nav').map(function (r) { return r.getAttribute('data-act'); }).join(','); };
    t.eq(acts(), 'share-line,share-family,share-save,share-link', '有 card：第一格一鍵傳到 LINE、第二格長輩圖');
    t.includes(app.text('[data-act="share-line"]'), '傳到 LINE 給家人', '第一格的字');
    t.includes(app.text('[data-act="share-family"]'), '長輩圖', '第二格寫明是長輩圖');
    t.includes(app.text('.sharesheet__note'), '日誌與心情不會被分享', '底部說明');
    app.$('.sys-share')._dismiss();
    await app.tick(30);
    /* 沒有指定哪一張（舊呼叫、週回顧）：沒有一鍵傳，第一格是長輩圖 */
    app.APP.ui.share({ kind: 'postcard' });
    await app.waitFor(function () { return app.$('.sharesheet'); }, 2000, '.sharesheet');
    t.eq(acts(), 'share-family,share-save,share-link', '沒有 card：三格、第一格是長輩圖');
    /* 點 scrim 關閉 */
    const scrim = app.$('.sys-share');
    scrim.dispatchEvent(new app.win.MouseEvent('click', { bubbles: true }));
    await app.tick(30);
    t.ok(!app.$('.sharesheet'), 'scrim 關閉');
    app.APP.ui.share({ kind: 'week' });
    await app.waitFor(function () { return app.$('.sharesheet'); }, 2000, '.sharesheet');
    t.eq(app.text('.sharesheet__t'), '分享這一週', 'week 標題');
    await app.click('[data-act="share-family"]');
    await app.at('/elder');
    t.ok(!app.$('.sharesheet'), '面板收掉');
  });

  t.test('重設 demo：確認後 STATE 回到 8 張、onboarded 仍 true、到 /ride', async function (app) {
    await app.reset();
    app.STATE.collect('glass-kiln', { date: app.APP.fmt.todayMMDD() });
    app.STATE.setSetting('pushAm', false);
    app.APP.store.set('dropoff', T.fixtures.dropoff({ id: 'neiwan', name: '內灣', km: 28, setAt: 1 }));
    t.eq(app.STATE.count(), 9, '先收一張');
    await app.go('/settings');
    await app.click('[data-act="more"]');
    await app.click('main.view [data-act="reset-demo"]');
    await app.click('[data-act="confirm-yes"]');
    await app.at('/ride');
    t.eq(app.STATE.count(), 8, 'STATE 回到 fresh 8 張');
    t.eq(app.STATE.all.settings.pushAm, true, '設定回預設');
    t.eq(app.APP.store.get('onboarded'), true, 'onboarded 仍 true');
    t.eq(app.APP.store.get('dropoff'), null, 'store 清掉');
  });

  t.test('重設 demo：按先不要就什麼都不動', async function (app) {
    await app.reset();
    app.STATE.collect('glass-kiln', {});
    await app.go('/settings');
    await app.click('[data-act="more"]');
    await app.click('main.view [data-act="reset-demo"]');
    await app.click('[data-act="confirm-no"]');
    t.eq(app.STATE.count(), 9, '沒有重設');
    t.eq(app.route().path, '/settings', '還在設定');
  });

  t.test('清除我的足跡：確認後真的清空（明信片 0、點數 0、下車點與行程一起清）', async function (app) {
    await app.reset({ store: { dropoff: T.fixtures.dropoff({ id: 'neiwan', name: '內灣', km: 28, setAt: 1 }) } });
    app.STATE.collect('glass-kiln', {});
    app.APP.state.setToday({ memoryCards: [{ id: 'memory-1', cardId: 'p1', mood: 'good', prompt: 'x', date: app.APP.fmt.todayMMDD() }] });
    await app.go('/settings');
    await app.click('[data-act="more"]');       /* 清除足跡收在展開區（設定頁可按數 ≤ 10） */
    await app.click('[data-act="wipe"]');
    await app.click('[data-act="confirm-yes"]');
    t.eq(app.STATE.count(), 0, 'STATE 清空');
    t.eq(app.STATE.points, 0, '點數 0');
    t.eq(app.APP.store.get('dropoff'), null, '下車點一起清');
    t.eq(app.APP.album.memory.cards().length, 0, '回憶卡一起清');
    t.eq(app.STATE.all.settings.pushAm, true, '設定不動');
  });

  t.test('設定頁的模擬抵達：沒有前往或叫車時 toast、不導走', async function (app) {
    await app.reset();
    await app.go('/settings');
    await app.click('[data-act="more"]');
    await app.click('main.view [data-act="arrive"]');
    await app.tick(30);
    t.eq(app.route().path, '/settings', '沒有導走');
    t.includes(app.text('.toast') || '', '先開始前往或叫車', 'toast');
  });

  t.test('再看一次介紹 → /welcome', async function (app) {
    await app.reset();
    await app.go('/settings');
    await app.click('[data-act="more"]');
    await app.click('main.view [data-act="welcome"]');
    await app.at('/welcome');
    t.eq(app.APP.store.get('onboarded'), true, 'onboarded 不變');
  });

  t.test('/unlock：沒有抵達行程時先搭 yoxi；進行中回到行程；歷史收藏保留', async function (app) {
    await app.reset();
    await app.go('/unlock/glass-kiln?ride=1');
    t.ok(!app.$('[data-unlock]'), '手打 ride=1 不產生新卡舞台');
    t.ok(!app.$('[data-act="collect"]') && !app.$('[data-final-card]'), '沒有收卡按鈕或已取得的卡面');
    t.eq(app.text('[data-act="use-yoxi"]'), '搭 yoxi 前往', '明確搭車入口');
    t.ok(!/找不到/.test(app.text('main')), '合法地點不誤報找不到');
    t.ok(app.$('.app-empty__card [data-act="use-yoxi"]'), '主要動作放在說明卡內');
    await app.click('[data-act="use-yoxi"]');
    await app.at('/ride');
    t.eq(app.APP.store.get('dropoff').id, 'glass-kiln', '經 setDropoff 填入目的地');
    app.APP.ride.trip.start('lake', 'e');
    await app.go('/unlock/glass-kiln');
    t.ok(!app.$('[data-final-card]'), '其他進行中的行程也不產生新卡');
    t.eq(app.text('[data-act="go-trip"]'), '回到行程', '進行中回到原行程');
    t.includes(app.text('.app-empty__p'), '目前行程', '說明回到目前行程，不假稱已抵達所選地點');
    await app.click('[data-act="go-trip"]');
    await app.at('/trip');
    t.eq(app.APP.ride.trip.current().placeId, 'lake', '不替換進行中的目的地');
    app.APP.ride.trip.clear();
    await app.go('/unlock/station');
    t.ok(app.$('[data-final-card]'), '已收藏的歷史卡仍可看');
    t.ok(!app.$('[data-act="collect"]'), '查看歷史卡不提供新的收卡動作');
    t.eq(app.APP.explore.cardOrigin('p1').by, 'walk', '歷史交通方式保留');
    t.ok(!/走路抵達|步行/.test(app.text('main')), '歷史 UI 不顯示步行選項');
    await app.reset();
  });

  t.test('demo 面板：只模擬搭 yoxi 抵達，地點跟著這一頁', async function (app) {
    await app.reset();
    await app.go('/ride');
    const panel = app.$('#demo-panel');
    t.ok(panel && panel.children.length > 0, '面板有內容');
    t.eq(app.text('#demo-panel .demo-panel__t'), 'demo 工具', '標題');
    const proto = app.$('#demo-panel a[href="../prototype/index.html"]');
    t.ok(proto && proto.target === '_blank' && /noopener/.test(proto.rel), '原型總覽另開分頁');
    const sel = app.$('#demo-panel [data-demo-place]');
    const ids = Array.prototype.map.call(sel ? sel.options : [], function (o) { return o.value; });
    t.ok(ids.indexOf('glass-kiln') >= 0 && ids.indexOf('neiwan') >= 0, '選單有地圖景點＋走不到的內灣：' + ids.join(','));
    t.ok(!app.STATE.has(app.APP.place(sel.value).card), '沒有指定時預設一個還沒收的地方：' + sel.value);
    t.ok(!app.$('#demo-panel [data-act="arrive-walk"]'), '沒有步行抵達選項');
    t.ok(!app.$('#demo-panel [data-act="arrive-ride"]').disabled, '搭車抵達鈕在 /ride 也能按');

    /* 搭車抵達：地點跟著地方詳情；旧的步行 API 明確拒絕 */
    await app.go('/place/moat');
    t.eq(app.$('#demo-panel [data-demo-place]').value, 'moat', '地點跟著這一頁');
    t.eq(app.APP.system.demoArrive('moat', 'walk'), false, '旧的步行抵達不建立行程');
    t.ok(!app.APP.ride.trip.arrivedAt('moat'), '沒有新抵達');
    t.eq(app.APP.explore.collect('moat'), false, '不能直接收新卡');
    t.ok(!app.STATE.has(app.APP.place('moat').card), '沒有寫入新收藏');
    await app.click('#demo-panel [data-act="arrive-ride"]');
    await app.at('/unlock/moat');
    t.ok(app.$('[data-unlock][data-ride]'), '搭車抵達版');

    /* 搭 yoxi 抵達：行程直接在這裡結束，抵達頁認得這一趟 → 必得金框 */
    await app.go('/place/lake');
    await app.click('#demo-panel [data-act="arrive-ride"]');
    await app.at('/unlock/lake');
    t.includes(app.win.location.hash, '?ride=1', '網址帶 ?ride=1');
    const tr = app.APP.store.get('trip');
    t.ok(tr && tr.placeId === 'lake' && tr.phase === 'done', 'store.trip 是這一趟、phase done');
    t.eq(tr && tr.km, app.APP.fmt.km(app.APP.place('lake').dist), '公里數用公式');
    t.ok(app.$('[data-unlock][data-ride]'), '搭車版');
    t.ok(app.$('[data-final-card].postcard--gold'), '必得金框');

    /* 行程進行中：地點是行程目的地，旧的步行 API 不改寫行程 */
    await app.reset({ store: { trip: T.fixtures.trip({ placeId: 'lake', startedAt: new Date().toISOString(), km: 6.4 }) } });
    await app.go('/explore');
    t.eq(app.$('#demo-panel [data-demo-place]').value, 'lake', '行程中：地點是行程的目的地');
    const before = JSON.stringify(app.APP.ride.trip.current());
    t.eq(app.APP.system.demoArrive('lake', 'walk'), false, '舊步行 API 拒絕');
    t.eq(JSON.stringify(app.APP.ride.trip.current()), before, '原行程保持原樣');
    await app.reset();
  });

  t.test('demo 面板的模擬日期：選項從規則表長出來；選了寫進 store.demoDate、/unlock 跟著換款式；重設 demo 回到今天', async function (app) {
    await app.reset();
    await app.go('/ride');
    const E = app.APP.explore;
    const sel = app.$('#demo-panel [data-demo-date]');
    t.ok(sel, '有模擬日期的選單');
    const opts = Array.prototype.map.call(sel.options, function (o) { return o.textContent; });
    E.CARD_STYLES.filter(function (d) { return d.months; }).forEach(function (d) {
      t.ok(opts.indexOf(d.season) >= 0, '季節日期選項：' + d.season);
    });
    E.FESTIVALS.forEach(function (f) {
      t.ok(opts.some(function (o) { return o.indexOf(f.name + '（') === 0; }), '三節選項：' + f.name);
    });
    t.eq(sel.value, '', '預設是今天');
    const winter = Array.prototype.filter.call(sel.options, function (o) { return o.textContent.indexOf('冬天') === 0; })[0];
    sel.value = winter.value;
    sel.dispatchEvent(new app.win.Event('change', { bubbles: true }));
    t.eq(app.APP.store.get('demoDate'), winter.value, '寫進 store.demoDate');
    await app.click('#demo-panel [data-act="arrive-ride"]');
    await app.waitFor(function () { return /^\/unlock\//.test(app.route().path) && app.$('[data-unlock]'); }, 3000, '搭車抵達 → /unlock');
    t.eq(app.$('[data-unlock]').getAttribute('data-style'), 'gold', '冬天搭 yoxi 抵達仍是金框');
    await app.go('/ride');
    await app.click('#demo-panel [data-act="reset-demo"]');
    await app.click('[data-act="confirm-yes"]');
    await app.at('/ride');
    t.eq(app.APP.store.get('demoDate'), null, '重設 demo：回到今天');
    t.eq(app.$('#demo-panel [data-demo-date]').value, '', '選單跟著回到今天');
    await app.reset();
  });

  t.test('demo 面板的早上推播也遵守一天兩則', async function (app) {
    await app.reset();
    await app.go('/ride');
    await app.click('#demo-panel [data-act="push-am"]');
    await app.waitFor(function () { return pushmock(app); }, 2000, '.pushmock');
    await app.click('.pushmock [data-act="close-push"]');
    await app.click('#demo-panel [data-act="push-pm"]');
    await app.waitFor(function () { return pushmock(app); }, 2000, '.pushmock');
    await app.click('.pushmock [data-act="close-push"]');
    await app.click('#demo-panel [data-act="push-am"]');
    t.ok(!pushmock(app), '第三次不出現');
    t.eq(app.APP.store.get('pushes').length, 2, '最多兩則');
  });

  /* ---------------------------------------------------------------- 浮層約定（data-overlay＋_dismiss） */
  t.test('分享面板是浮層：data-overlay、換頁（返回鍵）就收掉', async function (app) {
    await app.reset();
    await app.go('/ride');
    await app.go('/postcard/p1');
    app.APP.ui.share({ kind: 'postcard', card: 'p1' });
    await app.waitFor(function () { return app.$('.device > .sys-share'); }, 2000, '.sys-share');
    const sh = app.$('.device > .sys-share');
    t.ok(sh.hasAttribute('data-overlay'), '.sys-share 有 data-overlay');
    t.eq(typeof sh._dismiss, 'function', '有 _dismiss');
    t.noDeadButtons(app, '分享面板開著');
    t.noBannedWords(app, { msg: '分享面板開著' });
    await app.click('main.view a[data-back]');
    await app.at('/ride');
    await app.waitFor(function () { return !app.$('.device > .sys-share'); }, 2000, '換頁後分享面板收掉');
    t.ok(!app.$('.sharesheet'), '回到 /ride 沒有殘留的分享面板');
    sh._dismiss();                                       /* 再呼叫一次也沒事 */
    t.eq(app.errors.length, 0, '沒有錯誤 ' + app.errors.join('；'));
  });

  t.test('推播浮層是浮層：data-overlay、換頁就收掉', async function (app) {
    await app.reset();
    await app.go('/ride');
    app.APP.ui.push({ when: 'am' });
    await app.waitFor(function () { return pushmock(app); }, 2000, '.pushmock');
    const pm = pushmock(app);
    t.ok(pm.hasAttribute('data-overlay'), '.pushmock 有 data-overlay');
    t.eq(typeof pm._dismiss, 'function', '有 _dismiss');
    t.noDeadButtons(app, '推播開著');
    t.noBannedWords(app, { msg: '推播開著' });
    await app.go('/album');
    await app.waitFor(function () { return !pushmock(app); }, 2000, '換頁後推播收掉');
    t.ok(true, '推播收掉');
  });

  t.test('複製連結：複製的是打開面板那一刻的網址（opt.url 有給就用它）', async function (app) {
    await app.reset();
    await app.go('/postcard/p1');
    const want = app.win.location.href;
    let got = null;
    try {
      Object.defineProperty(app.win.navigator, 'clipboard', { configurable: true,
        value: { writeText: function (s) { got = s; return Promise.resolve(); } } });
    } catch (e) { /* 換不掉就只驗 data-share-url */ }
    app.APP.ui.share({ kind: 'postcard', card: 'p1' });
    await app.waitFor(function () { return app.$('.sys-share'); }, 2000, '.sys-share');
    t.eq(app.$('.sys-share').getAttribute('data-share-url'), want, '面板記下打開時的網址');
    app.APP.nav.replaceQuery('x=1');                     /* 面板開著時網址變了（不換頁） */
    t.ok(app.win.location.href !== want, '網址已經變了');
    await app.click('[data-act="share-link"]');
    t.eq(got, want, '複製的是打開時的網址');
    t.ok(!app.$('.sys-share'), '面板收掉');
    t.includes(app.text('.toast') || '', '連結已複製', 'toast');

    app.APP.ui.share({ kind: 'week', url: '#/week' });
    await app.waitFor(function () { return app.$('.sys-share'); }, 2000, '.sys-share');
    await app.click('[data-act="share-link"]');
    t.ok(/^(file|https?):/.test(String(got)) && /#\/week$/.test(String(got)), 'opt.url 轉成完整網址：' + got);
  });

  t.test('傳給家人帶著這張明信片：#/elder?card=<明信片 id>', async function (app) {
    await app.reset();
    await app.go('/postcard/p1');
    app.APP.ui.share({ kind: 'postcard', card: 'p1' });
    await app.waitFor(function () { return app.$('.sys-share'); }, 2000, '.sys-share');
    await app.click('[data-act="share-family"]');
    await app.at('/elder');
    t.eq(app.route().query.get('card'), 'p1', 'opt.card → ?card=p1');

    /* 明信片頁自己的分享鈕（舊呼叫 kind:'postcard' 帶 id 也認） */
    await app.go('/postcard/p2');
    await app.click('main.view [data-act="share"]');
    await app.waitFor(function () { return app.$('.sys-share'); }, 2000, '.sys-share');
    await app.click('[data-act="share-family"]');
    await app.at('/elder');
    t.eq(app.route().query.get('card'), 'p2', '明信片頁的分享 → ?card=p2');

    /* 週回顧沒有指定哪一張：/elder 不帶 card */
    await app.go('/week');
    app.APP.ui.share({ kind: 'week' });
    await app.waitFor(function () { return app.$('.sys-share'); }, 2000, '.sys-share');
    await app.click('[data-act="share-family"]');
    await app.at('/elder');
    t.eq(app.route().query.get('card'), null, '沒給 card 就不帶');
    t.eq(app.errors.length, 0, '沒有錯誤 ' + app.errors.join('；'));
  });

  /* ---------------------------------------------------------------- 清除足跡、重設 */
  t.test('清除我的足跡：app store 的足跡一起清（偏好留著），確認框標成危險動作', async function (app) {
    const now = new Date().toISOString();
    await app.reset({ store: {
      dropoff: T.fixtures.dropoff({ id: 'neiwan', name: '內灣', km: 28, setAt: 1 }),
      trip: T.fixtures.trip({ placeId: 'lake', phase: 'done', startedAt: now, rated: true, km: 6.4 }),
      rideVia: { p9: 'k1' }, cardStyle: { p1: 'gold' }, cardMarks: { p1: { fest: 'moon', far: 0 } },
      pushes: [{ when: 'am', at: now }],
      tabPaths: { ride: '/points', explore: '/routes', album: '/badges' },
      fxMute: true, rideSpots: false, demoDate: '2027-01-15',
    } });
    let seen = null;
    const orig = app.APP.ui.confirm;
    app.APP.ui.confirm = function (o) { seen = o; return orig.apply(this, arguments); };
    await app.go('/settings');
    await app.click('[data-act="more"]');
    await app.click('[data-act="wipe"]');
    await app.click('[data-act="confirm-yes"]');
    app.APP.ui.confirm = orig;
    t.ok(seen && seen.danger === true, '清除足跡的確認框帶 danger:true');
    const ls = app.storage('store') || {};
    t.eq(JSON.stringify(ls.rideVia), '{}', 'rideVia 清掉');
    t.eq(JSON.stringify(ls.cardStyle), '{}', 'cardStyle 清掉');
    t.eq(JSON.stringify(ls.cardMarks), '{}', 'cardMarks 清掉');
    t.eq(JSON.stringify(ls.pushes), '[]', 'pushes 清掉');
    t.eq(JSON.stringify(ls.tabPaths), JSON.stringify(app.APP.store.fresh().tabPaths), 'tabPaths 回預設');
    t.eq(ls.dropoff, null, 'dropoff');
    t.eq(ls.trip, null, 'trip');
    t.eq(ls.onboarded, true, 'onboarded 留著');
    t.eq(ls.fxMute, true, 'fxMute 留著');
    t.eq(ls.rideSpots, false, 'rideSpots 開關留著');
    t.eq(ls.demoDate, '2027-01-15', 'demoDate 留著（demo 的設定，不是足跡）');
    t.eq(app.STATE.count(), 0, 'STATE 清空');
  });

  t.test('重設 demo 的確認框也標成危險動作', async function (app) {
    await app.reset();
    let seen = null;
    const orig = app.APP.ui.confirm;
    app.APP.ui.confirm = function (o) { seen = o; return orig.apply(this, arguments); };
    await app.go('/settings');
    await app.click('[data-act="more"]');
    await app.click('main.view [data-act="reset-demo"]');
    t.ok(seen && seen.danger === true, 'danger:true');
    await app.click('[data-act="confirm-no"]');
    app.APP.ui.confirm = orig;
  });

  /* ---------------------------------------------------------------- demo 面板的地點 */
  t.test('demo 面板：路線站／明信片 id 的地方詳情，下拉選單可選且可搭車抵達', async function (app) {
    await app.reset();
    const A = app.APP;
    for (const id of ['p1', 'p3', 'p14']) {
      await app.go('/place/' + id);
      const sel = app.$('#demo-panel [data-demo-place]');
      t.ok(sel && sel.selectedIndex >= 0 && sel.value, '/place/' + id + '：選單有選到東西（' + (sel && sel.value) + '）');
      const picked = A.place(sel && sel.value);
      const here = A.place(id);
      t.ok(picked && here && (picked.id === here.id || (picked.card && picked.card === here.card)),
        '/place/' + id + '：選到的是這一頁的地方（' + (picked && picked.name) + '）');
    }
    /* p14（玻璃工藝博物館）不在地圖景點裡：多一個選項，搭車抵達進得了抵達頁 */
    const val = app.$('#demo-panel [data-demo-place]').value;
    await app.click('#demo-panel [data-act="arrive-ride"]');
    await app.at('/unlock/' + val);
    t.ok(!/先選一個地方/.test(app.text('.toast') || ''), '沒有「先選一個地方」');
    t.eq(app.errors.length, 0, '沒有錯誤 ' + app.errors.join('；'));
  });

  /* ---------------------------------------------------------------- 可及性 */
  t.test('/welcome：鍵盤在第二張按「下一張」，焦點交給「開始」', async function (app) {
    await app.reset({ onboarded: false, hash: '/welcome' });
    await app.at('/welcome');
    const next = app.$('[data-act="next"]');
    const start = app.$('[data-act="start"]');
    next.focus();
    await app.click(next);                               /* 第 2 張 */
    same(app.doc.activeElement, next, '第 2 張：焦點還在「下一張」');
    await app.click(next);                               /* 第 3 張：「下一張」藏起來 */
    t.ok(next.hidden && !start.hidden, '最後一張換成「開始」');
    same(app.doc.activeElement, start, '焦點交給「開始」，不掉回 body');
    await app.click('[data-dot="0"]');                   /* 回第 1 張：「開始」藏起來 */
    same(app.doc.activeElement, next, '焦點交回「下一張」');
  });

  t.test('設定頁的開關命中區 ≥ 44px 高（外觀不變）；看不見的 demo 鈕 hit 測試點不到', async function (app) {
    await app.reset();
    await app.go('/settings');
    const sw = app.$('main.view [data-switch="pushAm"]');
    const r = sw.getBoundingClientRect();
    t.eq(Math.round(r.height), 30, '開關外觀仍是 30 高');
    const x = r.left + r.width / 2;
    same(app.doc.elementFromPoint(x, r.top - 6), sw, '上緣外 6px 仍點到開關');
    same(app.doc.elementFromPoint(x, r.bottom + 6), sw, '下緣外 6px 仍點到開關');
    same(app.doc.elementFromPoint(r.left - 2, r.top + r.height / 2), sw, '左緣外 2px 仍點到開關');
    await app.click('main.view [data-switch="pushAm"]', { hit: true });
    t.eq(app.STATE.all.settings.pushAm, false, 'hit:true 點得到看得見的開關');

    /* 手機寬的 iframe 裡 #demo-panel 是藏著的：一般 click 點得到（舊測試靠它），hit:true 要點不到 */
    let err = null;
    try { await app.click('#demo-panel [data-act="push-am"]', { hit: true, ms: 200 }); } catch (e) { err = e; }
    t.ok(err && /hit:true/.test(err.message), 'hit:true 點藏起來的 demo 鈕會失敗：' + (err && err.message));
    t.ok(!pushmock(app), '沒有真的點下去');
  });

  t.test('system.css 沒有 hex 色碼', async function (app) {
    const r = await fetch('../css/views/system.css').then(function (x) { return x.text(); }).catch(function () { return null; });
    if (r == null) {
      /* file:// 下 fetch 可能被擋：退回讀 iframe 的 CSSOM */
      const sheet = Array.prototype.slice.call(app.doc.styleSheets).filter(function (s) { return /system\.css$/.test(s.href || ''); })[0];
      const txt = sheet ? Array.prototype.map.call(sheet.cssRules, function (c) { return c.cssText; }).join('\n') : '';
      t.ok(sheet, '讀得到 system.css');
      t.noHardcodedHex(txt, 'system.css');
      return;
    }
    t.noHardcodedHex(r, 'system.css');
  });

  /* ============================================================ 回歸測試（從 flows.spec 搬來）
     code review 與亂按 QA 找到的 bug，一條 bug 一條 test；只牽涉這個區塊的放這裡，名稱保留審查／QA／評估的編號
     （對得上 docs/WORKLOG.md 與 flows.spec 裡跨區塊的那幾條）。 */
  function now() { return new Date().toISOString(); }

  t.test('QA 2：清除我的足跡真的清空；重設 demo 的文案寫清楚是回到初始', async function (app) {
    await app.reset({ store: { dropoff: T.fixtures.dropoff({ id: 'neiwan', name: '內灣', km: 28, setAt: now() }),
                               trip: T.fixtures.trip({ placeId: 'lake', startedAt: now(), km: 6.4 }) } });
    app.APP.state.setToday({ memoryCards: [{ id: 'memory-1', cardId: 'p1', mood: 'low', prompt: 'x', date: app.APP.fmt.todayMMDD() }] });
    await app.go('/settings');
    await app.click('[data-act="more"]');
    await app.click('[data-act="wipe"]');
    await app.click('[data-act="confirm-yes"]');
    const S = app.STATE, A = app.APP;
    t.eq(S.count(), 0, 'STATE.count() === 0');
    t.eq(S.points, 0, 'STATE.points === 0');
    t.eq(S.all.km, 0, 'km 0');
    t.eq(S.all.lastCard, null, 'lastCard null');
    t.eq(A.album.memory.cards().length, 0, '回憶卡歸零');
    t.eq(A.store.get('dropoff'), null, 'dropoff 清掉');
    t.eq(A.store.get('trip'), null, 'trip 清掉');
    t.includes(app.text('.toast') || '', '足跡已清除', 'toast');
    const saved = app.storage('state');
    t.ok(saved && Object.keys(saved.cards).length === 0, '寫進 localStorage');
    await app.go('/album');
    t.eq(app.$$('[data-stat="places"], [data-stat="km"]').length, 0, '收藏頁不再放重複的地方／公里統計');
    t.eq(A.album.visitedPlaces().length, 0, '內部去過的地方 0');
    t.eq(app.$$('main.view .postcard--locked').length, app.$$('main.view [data-card]').length, '書架全部是灰的');
    await app.go('/footprint');
    t.eq(app.text('[data-coverage]'), '0', '城市足跡覆蓋率 0');
    t.eq(app.$$('[data-layer="seenArea"]').length, 0, '已訪區域圖層不存在');
    await app.reload();
    t.eq(app.STATE.count(), 0, '重載之後還是 0');
    await app.go('/points');
    t.eq(app.$$('[data-points-row][data-city="1"]').length, 0, '點數沒有城事解鎖列');
    /* 重設 demo 的文案 */
    await app.go('/settings');
    await app.click('[data-act="more"]');
    await app.click('main.view [data-act="reset-demo"]');
    t.includes(app.text('.app-confirm'), '回到 demo 初始狀態', '重設 demo 文案');
    await app.click('[data-act="confirm-yes"]');
    await app.at('/ride');
    t.eq(app.STATE.count(), 8, '重設 demo 回到 8 張');
  });

  t.test('評估 3：設定頁可以關掉探索地圖上的景點；可按數仍 ≤ 10', async function (app) {
    await app.reset();
    await app.go('/ride?mode=explore');
    t.eq(app.$$('main.view .spot').length, 4, '預設 4 顆');
    await app.go('/settings');
    t.ok(t.countTappables(app) <= 10, '設定頁可按數 ' + t.countTappables(app));
    const sw = app.$('main.view [data-switch="rideSpots"]');
    t.ok(sw && sw.classList.contains('is-on'), '預設開著');
    await app.click(sw);
    t.eq(app.APP.store.get('rideSpots'), false, 'store.rideSpots=false');
    t.eq(sw.getAttribute('aria-checked'), 'false', '開關外觀');
    await app.go('/ride?mode=explore');
    t.eq(app.$$('main.view .spot').length, 0, '關掉之後 0 顆');
    t.ok(app.$('main.view .map__svg'), '地圖照畫');
    t.noDeadButtons(app, '/ride（景點關掉）');
    await app.reload('/ride?mode=explore');
    t.eq(app.$$('main.view .spot').length, 0, '重載後還是關的');
    await app.go('/settings');
    await app.click('main.view [data-switch="rideSpots"]');
    await app.go('/ride?mode=explore');
    t.eq(app.$$('main.view .spot').length, 4, '開回來 4 顆');
    t.eq(app.STATE.all.settings.rideSpots, undefined, '不寫進 STATE.settings');
  });

  /* 評估 5 改過一次：以前收卡後標題終點延到今天（9月15日 – 9月25日，11 天），但長條圖與步數只有 7 天。
     現在標題永遠是圖表那 7 天；範圍之後收的卡另寫一行，不算進本週。 */
});
