/* ==========================================================================
   system.spec — onboarding、城事設定、推播浮層、分享面板、demo 工具（system 角色維護）
   ========================================================================== */
T.spec('system', function (t) {

  function pushmock(app) { return app.$('.device > .pushmock'); }

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
    t.eq(app.$$('main.view [data-switch]').length, 8, '八個開關（含叫車地圖上的景點）');
    t.ok(app.text('main.view').indexOf('一天最多兩則') >= 0, '說出上限');
    t.ok(app.text('main.view').indexOf('只有你') >= 0 && app.text('main.view').indexOf('你可分享') >= 0, '隱私分軌');
    t.noDeadButtons(app);
    t.noBannedWords(app);
    const n = t.countTappables(app);
    t.ok(n <= 10, '可按數 ' + n);
    /* 展開 demo 工具與關於：內容都在、仍然沒有死按鈕與禁用詞 */
    await app.click('[data-act="more"]');
    t.ok(!app.$('[data-more]').hidden, '展開');
    t.ok(/^chengshi-app-v\d+$/.test(app.text('[data-version]')), '顯示 app 快取版本');
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

  t.test('早上推播：浮層、只記一次、點卡片到地圖的今天', async function (app) {
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
    t.eq(app.route().query.get('mode'), 'today', '地圖顯示今天');
    t.ok(!pushmock(app), '浮層收掉');
  });

  t.test('晚上推播：數字從 LOOKBACK 算、點卡片到 /lookback', async function (app) {
    await app.reset();
    await app.go('/ride');
    app.APP.ui.push({ when: 'pm' });
    await app.waitFor(function () { return pushmock(app); }, 2000, '.pushmock');
    const L = app.MOCK.LOOKBACK;
    t.includes(app.text('.pushmock__t'), '今天走了 ' + L.km + ' km，經過 ' + L.places.length + ' 個地方', 'pm 標題');
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

  t.test('分享面板：三格、第一格傳給家人 → /elder、點 scrim 關閉', async function (app) {
    await app.reset();
    await app.go('/album');
    app.APP.ui.share({ kind: 'postcard' });
    await app.waitFor(function () { return app.$('.sharesheet'); }, 2000, '.sharesheet');
    t.eq(app.text('.sharesheet__t'), '分享這張明信片', '標題依 kind');
    const rows = app.$$('.sharesheet .row-nav');
    t.eq(rows.length, 3, '三格');
    t.eq(rows[0].getAttribute('data-act'), 'share-family', '第一格是傳給家人');
    t.includes(app.text('.sharesheet__note'), '日誌與心情不會被分享', '底部說明');
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
    app.APP.store.set('dropoff', { id: 'neiwan', name: '內灣', km: 28, setAt: 1, via: 'k1' });
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
    await app.reset({ store: { dropoff: { id: 'neiwan', name: '內灣', km: 28, setAt: 1, via: 'k1' } } });
    app.STATE.collect('glass-kiln', {});
    await app.go('/settings');
    await app.click('[data-act="more"]');       /* 清除足跡收在展開區（設定頁可按數 ≤ 10） */
    await app.click('[data-act="wipe"]');
    await app.click('[data-act="confirm-yes"]');
    t.eq(app.STATE.count(), 0, 'STATE 清空');
    t.eq(app.STATE.points, 0, '點數 0');
    t.eq(app.APP.store.get('dropoff'), null, '下車點一起清');
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

  t.test('demo 面板：填好、模擬抵達依路徑切換，/going/:id → /unlock/:id', async function (app) {
    await app.reset();
    await app.go('/ride');
    const panel = app.$('#demo-panel');
    t.ok(panel && panel.children.length > 0, '面板有內容');
    t.eq(app.text('#demo-panel .demo-panel__t'), 'demo 工具', '標題');
    const proto = app.$('#demo-panel a[href="../prototype/index.html"]');
    t.ok(proto && proto.target === '_blank' && /noopener/.test(proto.rel), '原型總覽另開分頁');
    t.ok(app.$('#demo-panel [data-act="arrive"]').disabled, '在 /ride 時模擬抵達不可按');
    await app.go('/going/glass-kiln', { redirectOk: true });
    if (app.route().path !== '/going/glass-kiln') {
      t.fail('/going/glass-kiln 被導走到 ' + app.route().path + '（前往中頁不接受直接進入？）');
      return;
    }
    t.ok(!app.$('#demo-panel [data-act="arrive"]').disabled, '前往中可按');
    await app.click('#demo-panel [data-act="arrive"]');
    await app.at('/unlock/glass-kiln');
    t.eq(app.APP.store.get('arrivedDemo'), 'glass-kiln', 'arrivedDemo 記下地點');
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
});
