/* 相框與稱號（album-rewards.js 的 /rewards）與明信片頁的「每一次來」（album.js 的 /postcard/:id?v=）
   規則與進度的算法是純函式：在 tests/unit/visits.test.mjs；這裡只驗畫面與流程。 */
T.spec('rewards', function (t) {

  t.test('/rewards：兩面牆（相框、稱號），每一個都寫規則與 n/m；還沒收下的不能按；死按鈕、禁用詞、可按數', async function (app) {
    await app.reset();
    await app.go('/rewards');
    const A = app.APP.album;
    const all = A.rewards();
    t.ok(app.$('[data-rw="frame"]') && app.$('[data-rw="title"]'), '相框、稱號兩面牆');
    all.forEach(function (r) {
      const el = app.$('[data-rw="' + r.kind + '"] [data-reward="' + r.key + '"]');
      t.ok(el, r.key + '：在牆上');
      if (!el) return;
      t.eq(el.tagName === 'BUTTON', r.got, r.key + '：收下的才是按鈕');
      t.includes(el.textContent, r.got ? r.rule : r.prog, r.key + '：收下的寫規則、還在路上的寫進度（' + r.prog + '）');
    });
    const frames = all.filter(function (r) { return r.kind === 'frame'; });
    t.includes(app.text('[data-stat="frames"]'), frames.filter(function (r) { return r.got; }).length + '/' + frames.length, '相框收下幾個＝rewards()');
    t.ok(!/機率|抽獎|抽到|保底|%/.test(app.text('main.view[data-view]')), '沒有機率、抽獎、保底');
    t.noDeadButtons(app, '/rewards');
    t.noBannedWords(app, { msg: '/rewards' });
    t.ok(t.countTappables(app) <= T.tapMax('/rewards'), '可按數 ' + t.countTappables(app) + ' ≤ ' + T.tapMax('/rewards'));
  });

  t.test('/rewards：點收下的相框、稱號就換上；預覽、收藏首頁跟著變；還在路上的點了沒反應', async function (app) {
    await app.reset();
    await app.go('/rewards');
    const A = app.APP.album;
    const got = A.rewards('frame').filter(function (r) { return r.got; })[0];
    t.ok(got, '前提：demo 至少收下一個相框（去過 ' + A.visitedPlaces().length + ' 個地方）');
    await app.click('[data-act="use-frame"][data-reward="' + got.key + '"]');
    t.eq(app.APP.store.get('look').frame, got.key, 'store.look.frame');
    t.eq(app.$('[data-act="use-frame"][data-reward="' + got.key + '"]').getAttribute('aria-pressed'), 'true', '選到的那一格 aria-pressed');
    t.ok(app.$('[data-rw-preview] .rw-card[data-frame="' + got.key + '"]'), '預覽換上相框');
    t.includes(app.text('[data-look-frame]'), got.name, '預覽寫相框名');
    const title = A.rewards('title').filter(function (r) { return r.got; }).slice(-1)[0];
    await app.click('[data-act="use-title"][data-reward="' + title.key + '"]');
    t.eq(A.look().title && A.look().title.key, title.key, '稱號換上');
    t.includes(app.text('[data-look-title]'), title.name, '預覽寫稱號');
    const locked = app.$('[data-rw="frame"] .is-locked');
    t.ok(locked && !locked.onclick && locked.tagName !== 'BUTTON', '還在路上的相框不是按鈕');
    await app.click('[data-act="use-title"][data-reward=""]');
    t.eq(A.look().title, null, '不顯示稱號');
    await app.click('[data-act="use-title"][data-reward="' + title.key + '"]');
    await app.go('/album');
    t.includes(app.text('[data-look-title]'), title.name, '收藏首頁的頁首寫稱號');
    const entry = app.$('[data-act="go-rewards"]');
    t.ok(entry && entry.getAttribute('href') === '#/rewards', '收藏首頁有入口 → /rewards');
    t.includes(entry && entry.textContent, '稱號「' + title.name + '」', '入口寫現在的稱號');
    t.ok(entry && entry.querySelector('.rw-swatch[data-frame="' + got.key + '"]'), '入口的小樣是現在的相框');
    t.ok(t.countTappables(app) <= T.tapMax('/album'), '收藏首頁可按數仍 ≤ ' + T.tapMax('/album'));
    await app.reset();
  });

  t.test('收藏首頁 → 相框與稱號 → 返回回收藏首頁', async function (app) {
    await app.reset();
    await app.go('/album');
    await app.click('[data-act="go-rewards"]');
    await app.at('/rewards');
    await T.helpers.clickBack(app);
    await app.at('/album');
    await app.go('/rewards');     /* 直接開：返回換成上一層 */
    await T.helpers.clickBack(app);
    await app.at('/album');
  });

  t.test('節日那一週收下一張：那個節日的相框收下；牆上看得到', async function (app) {
    await app.reset();
    const E = app.APP.explore;
    const moon = E.FESTIVALS.filter(function (f) { return f.key === 'moon'; })[0];
    const y = Object.keys(moon.days)[0];
    app.APP.store.set('demoDate', y + '-' + moon.days[y]);
    T.helpers.collect(app, 'glass-kiln');
    await app.go('/rewards');
    const tile = app.$('[data-act="use-frame"][data-reward="moon"]');
    t.ok(tile, '中秋相框可以用了');
    await app.reset();
  });

  t.test('/postcard/:id：回訪之後有「每一次來」一排；?v=2 是那一次的卡（沒有首訪戳、寫第 2 次來）；沒有這一次就看第一次', async function (app) {
    await app.reset();
    await app.go('/postcard/p1');
    t.ok(!app.$('[data-visits]'), '只收過一次：沒有那一排');
    t.ok(app.$('.alb-big__card [data-mark="first"]'), '第一次那一張：首訪紀念戳');
    t.includes(app.text('[data-visit-sub]'), '第一次來', '寫第一次來');
    app.APP.explore.collect('station', { note: '又來散步' });
    await app.go('/postcard/p1');
    const links = app.$$('[data-visits] a');
    t.eq(links.length, 2, '兩次');
    t.eq(links[1] && links[1].getAttribute('href'), '#/postcard/p1?v=2', '第 2 次的連結');
    t.ok(t.countTappables(app) <= T.tapMax('/postcard/p1'), '可按數 ≤ 上限（那一排算一個）');
    await app.click(links[1]);
    await app.at('/postcard/p1');
    t.eq(app.route().query.get('v'), '2', '?v=2');
    t.ok(app.$('.alb-big__card [data-card-visit="2"]'), '卡面是第 2 次那一張');
    t.ok(!app.$('.alb-big__card [data-mark="first"]'), '回訪沒有首訪戳');
    t.includes(app.text('[data-visit-sub]'), '第 2 次來', '寫第 2 次來');
    t.includes(app.text('.alb-big__back'), '又來散步', '背面是那一次寫的那一句');
    t.ok(app.$('[data-visits] a[aria-current="true"][data-visit="2"]'), '那一排標出現在看的是哪一次');
    t.noDeadButtons(app, '/postcard/p1?v=2');
    t.noBannedWords(app, { msg: '/postcard/p1?v=2' });
    await app.go('/postcard/p1?v=9');
    t.includes(app.text('[data-visit-sub]'), '第一次來', '沒有第 9 次：看第一次');
    await app.reset();
  });

  t.test('收藏首頁：回訪收下的在疊卡最上面、另外寫一句；留下的距離加上回訪', async function (app) {
    await app.reset();
    const E = app.APP.explore;
    await app.go('/album');
    const km0 = Number(app.text('[data-stat="km"]'));
    E.collect('station');
    await app.go('/postcards');
    await app.go('/album');
    const top = app.$('.alb-v2__stack-art--0');
    t.eq(top && top.getAttribute('data-card') + '#' + (top.getAttribute('data-card-visit') || '1'), 'p1#2', '最上面是剛收的第 2 次');
    t.eq(app.text('[data-stat="again"]'), '1', '回訪又收了 1 張');
    t.eq(Number(app.text('[data-stat="km"]')), km0 + Math.round(app.APP.fmt.km(app.APP.place('station').dist)), '留下的距離＋這一趟');
    t.eq(app.text('[data-stat="cards"]'), String(app.STATE.count()), '圖鑑的張數還是不同的明信片');
    await app.go('/postcards');
    t.includes(app.text('.alb-v2__postcard[data-card="p1"] [data-times]'), '收過 2 張', '明信片格子寫收過幾張');
    await app.reset();
  });
});
