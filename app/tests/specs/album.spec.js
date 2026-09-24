/* ==========================================================================
   album 區塊的瀏覽器測試（ARCHITECTURE.md §6.3 五類）
   /album /postcard/:id /badge/:id /footprint /lookback /week /elder
   ========================================================================== */
T.spec('album', function (t) {

  const ROUTES = ['/album', '/album?tab=badges', '/album?tab=journal', '/album?tab=week',
                  '/postcard/p1', '/postcard/p4', '/postcard/p11', '/postcard/nope',
                  '/badge/b1', '/badge/b4', '/badge/nope',
                  '/footprint', '/lookback', '/week', '/elder'];

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
      const max = /^\/album/.test(path) ? 12 : 10;
      t.ok(n <= max, path + '：可按數 ' + n + ' ≤ ' + max);
    }
  }, { timeout: 30000 });

  /* 3. 統計格＝狀態 */
  t.test('/album 統計三格從 STATE 算', async function (app) {
    await app.reset();
    await app.go('/album');
    const S = app.STATE, B = app.MOCK.BADGES;
    t.eq(app.text('[data-stat="places"]'), String(S.count()), '去過的地方');
    t.eq(app.text('[data-stat="km"]'), String(S.all.km), '公里');
    const got = B.filter(function (b) { return S.badge(b.id).got; }).length;
    t.eq(app.text('[data-stat="badges"]'), got + '/' + B.length, '獎章 已獲得/總數');
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

  t.test('摘要：最近明信片與全部明信片切換', async function (app) {
    await app.reset();
    await app.go('/album');
    t.eq(app.text('[data-stat="cards"]'), String(app.STATE.count()), '主卡顯示已收張數');
    t.eq(app.$$('[data-alb-v2-cards] [data-card]').length, 4, '先顯示最近四張');
    await app.click('[data-act="show-all-cards"]');
    t.eq(app.$$('[data-alb-v2-cards] [data-card]').length, app.MOCK.POSTCARDS.length, '展開全部明信片');
    await app.click('[data-act="show-recent-cards"]');
    t.eq(app.$$('[data-alb-v2-cards] [data-card]').length, 4, '收起回最近四張');
  });

  /* 3. 獎章格文字＝STATE.badge */
  t.test('勳章牆「收集 n/m」與 STATE.badge 一致、沒有進度環', async function (app) {
    await app.reset();
    await app.go('/album?tab=badges');
    app.MOCK.BADGES.forEach(function (b) {
      const r = app.STATE.badge(b.id);
      t.eq(app.text('[data-badge="' + b.id + '"] .badge__prog'), '收集 ' + r.done + '/' + r.total, b.id);
      const el = app.$('[data-badge="' + b.id + '"]');
      t.eq(el && el.classList.contains('badge--locked'), !r.got, b.id + ' 亮／灰');
    });
    t.eq(app.$$('.ring, .stampcard').length, 0, '沒有進度環與集點卡');
    await app.go('/badge/b3');
    const r3 = app.STATE.badge('b3');
    t.eq(app.text('[data-prog]'), '收集 ' + r3.done + '/' + r3.total, '/badge/b3 收集 n/m');
    t.ok(r3.got ? !!app.$('[data-award]') : !app.$('[data-award]'), 'award 只在獲得後出現');
    await app.go('/badge/b4');
    t.ok(!app.$('[data-award]'), '未獲得的 b4 沒有 award 文案');
    t.eq(app.$$('[data-member]').length, app.STATE.badge('b4').ids.length, '組成清單');
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
      t.ok(app.text('[data-lb-steps]') === app.APP.fmt.num(app.MOCK.LOOKBACK.steps), '步數來自 LOOKBACK');
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
    t.eq(app.$$('.citycolor__band').length, app.MOCK.CITY_COLORS.length, '城市顏色色帶');
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

  t.test('搭車卡是金框限定版；步數用公式', async function (app) {
    await app.reset();
    await app.go('/postcard/p4');
    t.ok(app.$('.postcard--gold[data-flip]'), '金框');
    t.ok(app.$('[data-ribbon]'), '限定版角標');
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
    await app.go('/album?tab=badges');
    await app.click('[data-badge="b3"]');
    await app.at('/badge/b3');
    await app.click('[data-member="p1"]');
    await app.at('/postcard/p1');
    await app.click('main.view[data-view] a[data-back]');
    await app.at('/badge/b3');
    await app.click('main.view[data-view] a[data-back]');
    await app.at('/album');
    await app.go('/footprint');
    await app.click('main.view[data-view] a[data-back]');
    await app.at('/album');
  });
});
