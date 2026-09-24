/* ==========================================================================
   explore.spec — 探索區塊（/explore、/explore/map、/place、/going、/unlock、/routes、/route）
   契約：ARCHITECTURE.md §6.3 五類 —— render／主要互動改狀態／數字＝公式／可按數／返回。
   ========================================================================== */
T.spec('explore', function (t) {

  const ROUTES = [
    { path: '/explore', max: 12 },
    { path: '/explore/map', max: 10 },
    { path: '/place/glass-kiln', max: 10 },
    { path: '/place/neiwan', max: 10 },
    { path: '/place/moat', max: 10 },
    { path: '/place/p13', max: 10 },
    { path: '/place/nope', max: 10 },
    { path: '/going/glass-kiln', max: 10 },
    { path: '/unlock/glass-kiln', max: 10 },
    { path: '/unlock/neiwan?ride=1', max: 10 },
    { path: '/routes', max: 10 },
    { path: '/route/rail', max: 10 },
    { path: '/route/glass', max: 10 },
    { path: '/route/water', max: 10 },
    { path: '/route/nope', max: 10 },
  ];

  /* 1. 每條 route 都能 render、沒有死按鈕、沒有禁用詞、可按數在上限內 */
  ROUTES.forEach(function (r) {
    t.test('render ' + r.path, async function (app) {
      await app.go(r.path);
      await app.tick(80);
      const v = app.view();
      t.ok(v, 'main.view[data-view] 存在');
      if (!v) return;
      t.ok(['_placeholder', '_404'].indexOf(v.getAttribute('data-view')) < 0, '不是 placeholder／404：' + v.getAttribute('data-view'));
      t.ok(!app.$('[data-app-error]'), '沒有錯誤卡');
      t.eq(app.errors.length, 0, 'onerror：' + app.errors.join('；'));
      t.noDeadButtons(app, r.path);
      t.noBannedWords(app, { msg: r.path });
      const n = t.countTappables(app);
      t.ok(n <= r.max, r.path + ' 可按數 ' + n + ' ≤ ' + r.max);
    });
  });

  /* 2. /explore：只在選擇探索後出現的地圖與上拉卡片面板 */
  t.test('/explore：四個卡片地點，搭車欄位不混進來', async function (app) {
    await app.reset();
    await app.go('/explore');
    t.eq(app.$$('main.view .spot').length, 4, '探索地圖有四個地點');
    t.ok(app.$('.spot[data-spot="' + app.MOCK.TODAY.id + '"].spot--today'), '今天的地方');
    t.ok(app.$('[data-area-intro] [data-act="expand-cards"]'), '可上拉看附近卡片');
    t.ok(!app.$('[data-act="pick-pickup"], [data-act="pick-dropoff"]'), '沒有搭車欄位');
    t.ok(app.$('[data-act="open-album"][href="#/album"]'), '收藏從探索進入');
  });

  t.test('/explore：選地點後設為下車點，回搭車頁', async function (app) {
    await app.reset();
    await app.go('/explore');
    await app.click('.spot[data-spot="moat"]');
    t.eq(app.route().query.get('area'), 'moat', '選點寫入網址');
    t.includes(app.text('[data-area-intro]'), '護城河', '顯示地區');
    t.includes(app.text('[data-area-intro]'), app.APP.fmt.dist(app.APP.place('moat').dist), '距離由公式取得');
    await app.click('[data-area-intro] [data-act="set-area-dropoff"]');
    await app.at('/ride');
    t.eq(app.APP.store.get('dropoff').id, 'moat', '下車點是所選地點');
    t.eq(app.text('[data-drop-name]'), app.APP.place('moat').name, '搭車欄位已填入');
  });

  t.test('/explore：上拉、選地區、重新整理，卡片不開地點詳情', async function (app) {
    await app.reset();
    await app.go('/explore');
    const grip = app.$('.ride-sheet .sheet__grip'), W = app.win, box = grip.getBoundingClientRect();
    grip.dispatchEvent(new W.PointerEvent('pointerdown', { bubbles: true, clientY: box.top + 10, pointerId: 1 }));
    W.dispatchEvent(new W.PointerEvent('pointermove', { bubbles: true, clientY: box.top - 90, pointerId: 1 }));
    W.dispatchEvent(new W.PointerEvent('pointerup', { bubbles: true, clientY: box.top - 90, pointerId: 1 }));
    t.ok(!app.$('.ride-sheet').classList.contains('is-collapsed'), '向上拉展開');
    t.eq(app.$$('[data-act="select-area"]').length, 4, '附近四個地區');
    await app.click('[data-act="select-area"][data-area="market"]');
    t.eq(app.route().query.get('area'), 'market', '選定東門');
    t.eq(app.$$('[data-area-expanded] [data-card]').length, 4, '東門四張卡');
    t.ok(!app.$('[data-act="peek-place"]'), '沒有地點詳情入口');
    await app.reload('/explore?area=market');
    t.eq(app.$$('[data-area-expanded] [data-card]').length, 4, '重新整理仍是東門四張');
    await app.click('[data-act="all-areas"]');
    t.eq(app.route().query.get('area'), null, '回附近清單清除選點');
  });

  t.test('/explore：收卡狀態與收藏入口', async function (app) {
    await app.reset();
    await app.go('/explore?area=glass-kiln');
    t.includes(app.text('[data-area-intro]'), '收集 0/2', '初始水利路進度');
    app.STATE.collect('glass-kiln', { date: app.APP.fmt.todayMMDD() });
    await app.go('/ride');
    await app.go('/explore?area=glass-kiln');
    t.includes(app.text('[data-area-intro]'), '收集 1/2', '收卡後進度更新');
    await app.click('[data-act="expand-cards"]');
    t.ok(app.$('[data-area-expanded] [data-card="p11"].is-collected'), '卡片上色');
    await app.click('[data-act="open-album"]');
    await app.at('/album');
    await app.click('[data-act="back-explore"]');
    await app.at('/explore');
  });

  /* 3. /place：K1 主次、找不到 */
  t.test('/place/glass-kiln：走得到 → 主 go-walk、次 set-dropoff', async function (app) {
    await app.reset();
    await app.go('/place/glass-kiln');
    const pri = app.$('[data-place-foot] .btn-primary');
    t.eq(pri && pri.getAttribute('data-act'), 'go-walk', '主要動作 go-walk');
    t.eq(pri && pri.tagName, 'A', 'go-walk 是連結');
    const sec = app.$('[data-place-foot] button.btn-ghost[data-act="set-dropoff"]');
    t.ok(sec, '次要 set-dropoff');
    const P = app.APP.place('glass-kiln');
    t.includes(app.text('[data-place-meta]'), String(app.APP.fmt.walkMin(P.dist)), '走路分鐘＝walkMin(dist)');
    t.ok(app.$('.ex-hero.is-gray'), '沒收過是灰階');
    t.includes(app.text('.ex-hero'), '到了才上色', '到了才上色');
  });

  t.test('/place/neiwan：走不到 → 主 set-dropoff，鈕上車資＝公式', async function (app) {
    await app.go('/place/neiwan');
    const pri = app.$('[data-place-foot] .btn-primary');
    t.eq(pri && pri.getAttribute('data-act'), 'set-dropoff', '主要動作 set-dropoff');
    const F = app.APP.fmt;
    const P = app.APP.place('neiwan');
    const km = F.km(P.dist);
    t.includes(pri && pri.textContent, String(F.fare(km)), '車資 fare(km(dist))');
    t.includes(pri && pri.textContent, String(F.rideMin(km)), '分鐘 rideMin(km)');
    t.includes(pri && pri.textContent, '+50', '限定版 +50');
    t.ok(!app.$('[data-act="go-walk"]'), '走不到就不給走路前往');
    const sec = app.$('[data-place-foot] .btn-ghost[data-act="open-route"]');
    t.eq(sec && sec.getAttribute('href'), '#/route/rail', '次要：先看看路線 → 所屬路線');
  });

  t.test('/place/neiwan：設為下車點 → store.dropoff、回 /ride', async function (app) {
    await app.reset();
    await app.go('/place/neiwan');
    await app.click('[data-place-foot] [data-act="set-dropoff"]');
    await app.at('/ride');
    const d = app.APP.store.get('dropoff');
    t.eq(d && d.id, 'neiwan', 'dropoff.id');
    t.eq(d && d.km, app.APP.fmt.km(app.APP.place('neiwan').dist), 'dropoff.km 用公式');
    await app.reset();
  });

  t.test('/place/nope：找不到這個地方＋回探索', async function (app) {
    await app.go('/place/nope');
    t.ok(app.$('[data-ex-missing]'), '找不到卡');
    t.includes(app.text('main.view[data-view]'), '找不到這個地方', '文案');
    t.ok(app.$('main.view[data-view] a[href="#/explore"]'), '回探索');
    t.ok(!app.$('[data-place-foot]'), '沒有動作區');
  });

  t.test('/place：收過 → 已在收藏 · 看明信片', async function (app) {
    await app.reset();
    await app.go('/place/market');
    const a = app.$('[data-place-foot] [data-act="open-postcard"]');
    t.ok(a, '看明信片');
    t.eq(a && a.getAttribute('href'), '#/postcard/' + app.APP.place('market').card, '→ /postcard/:card');
    t.ok(!app.$('[data-act="go-walk"], [data-act="set-dropoff"]'), '收過就不再推走路／叫車');
  });

  /* 4. /explore/map：10 顆、點一顆小卡名字對 */
  t.test('/explore/map：剛好 10 顆景點，點一顆小卡名字正確', async function (app) {
    await app.reset();
    await app.go('/explore/map');
    await app.tick(80);
    const spots = app.$$('.spot');
    t.eq(spots.length, 10, '.spot 數');
    t.ok(spots.length <= 10, '不超過 10');
    const s = app.$('.spot[data-spot="moat"]');
    t.ok(s, '有護城河那一顆');
    await app.click(s);
    t.eq(app.text('[data-peek-name]'), app.APP.place('moat').name, '小卡名字');
    t.includes(app.text('[data-peek-meta]'), app.APP.fmt.dist(app.APP.place('moat').dist).split(' ')[0], '小卡距離');
    t.ok(app.$('.ex-peek.is-on [data-act="go-walk"]'), '1.8 km 走得到 → 走路前往');
    t.eq(app.$('.ex-peek [data-act="open-place"]').getAttribute('href'), '#/place/moat', '看看這個地方');
    t.noDeadButtons(app, '/explore/map 小卡');
  });

  t.test('/explore/map：走不到的景點 → 設為下車點（via e）', async function (app) {
    await app.reset();
    await app.go('/explore/map');
    await app.click('.spot[data-spot="lake"]');
    t.eq(app.text('[data-peek-name]'), app.APP.place('lake').name, '小卡名字');
    await app.click('.ex-peek [data-act="set-dropoff"]');
    await app.at('/ride');
    const d = app.APP.store.get('dropoff');
    t.eq(d && d.id, 'lake', 'dropoff.id');
    t.eq(d && d.via, 'e', 'via e');
    await app.reset();
  });

  /* 5. /going → /unlock → collect */
  t.test('/going：模擬抵達 → /unlock，先不去了 → 回來處', async function (app) {
    await app.reset();
    await app.go('/explore');
    await app.go('/going/glass-kiln');
    t.ok(app.$('.spot'), '地圖上有目的地');
    t.includes(app.text('main.view[data-view]'), '80', '抵達怎麼驗：80 公尺');
    t.ok(!/倒數|步數/.test(app.text('main.view[data-view]')), '沒有倒數、步數');
    await app.click('[data-act="cancel-going"]');
    await app.at('/explore');
    await app.go('/going/glass-kiln');
    await app.click('[data-act="arrive"]');
    await app.at('/unlock/glass-kiln');
  });

  t.test('/unlock/glass-kiln：still 直接第三幕；collect → count+1、by walk、回 /album', async function (app) {
    await app.reset();
    const n0 = app.STATE.count();
    await app.go('/unlock/glass-kiln');
    t.ok(app.$('[data-scene="3"].is-on'), 'still 下停在第三幕');
    const inp = app.$('[data-one-line]');
    t.eq(inp && inp.getAttribute('maxlength'), '40', '一句話 maxlength 40');
    inp.value = '光從西邊斜進來';
    await app.click('[data-act="collect"]');
    await app.at('/album');
    t.eq(app.STATE.count(), n0 + 1, 'STATE.count() +1');
    const c = app.STATE.card('p11');
    t.eq(c && c.by, 'walk', 'by walk');
    t.eq(c && c.note, '光從西邊斜進來', 'note');
    t.eq(c && c.date, app.APP.fmt.todayMMDD(), '日期用今天');
  });

  t.test('/unlock/glass-kiln：已收過 → 已在收藏裡＋看明信片', async function (app) {
    /* 延續上一條：p11 已經收了 */
    await app.go('/unlock/glass-kiln');
    t.ok(app.$('[data-scene="3"].is-on'), '第三幕');
    t.includes(app.text('main.view[data-view]'), '已在收藏裡', '已在收藏裡');
    t.eq(app.$('[data-act="open-postcard"]') && app.$('[data-act="open-postcard"]').getAttribute('href'), '#/postcard/p11', '→ /postcard/p11');
    t.ok(!app.$('[data-act="collect"]'), '不能再收一次');
  });

  t.test('/unlock/neiwan?ride=1：金框、by ride、points +50、trip 清掉', async function (app) {
    await app.reset({ store: { trip: { placeId: 'neiwan', phase: 'done', startedAt: new Date().toISOString(), rated: true, km: 28 },
                               dropoff: { id: 'neiwan', name: '內灣老街', km: 28, setAt: new Date().toISOString(), via: 'k1' } } });
    const pts0 = app.STATE.points;
    const km0 = app.STATE.all.km;
    await app.go('/unlock/neiwan?ride=1');
    t.ok(app.$('.postcard--gold'), '金框');
    t.includes(app.text('.postcard__ribbon'), 'yoxi 限定版', '角標');
    t.includes(app.text('[data-gold-note]'), '司機同行紀念', '司機同行紀念');
    t.includes(app.text('[data-points]'), '+50', '和泰 Points +50');
    await app.click('[data-act="collect"]');
    await app.at('/album');
    const c = app.STATE.card('p9');
    t.eq(c && c.by, 'ride', 'by ride');
    t.eq(app.STATE.points, pts0 + 50, 'points +50');
    t.eq(app.STATE.all.km, km0 + 28, 'km 用 store.trip.km');
    t.eq(app.APP.store.get('trip'), null, 'store.trip 清掉');
    t.eq(app.APP.store.get('dropoff'), null, '同地方的 dropoff 清掉');
    await app.reset();
  });

  t.test('APP.explore.collect：回傳是否新收、emit state:change', async function (app) {
    await app.reset();
    let fired = 0;
    const off = app.APP.on('state:change', function () { fired++; });
    t.eq(app.APP.explore.collect('moat', { by: 'walk', km: 1.8 }), true, '第一次 true');
    t.eq(app.APP.explore.collect('moat', { by: 'walk', km: 1.8 }), false, '第二次 false');
    t.ok(app.STATE.has('p19'), 'moat → p19');
    t.ok(fired >= 1, 'state:change');
    off();
    await app.reset();
  });

  /* 6. /routes、/route/:id */
  t.test('/routes：每條路線一張卡、進度＝routeDone', async function (app) {
    await app.go('/routes');
    const cards = app.$$('[data-route-id]');
    t.eq(cards.length, app.MOCK.ROUTES.length, '卡數＝MOCK.ROUTES');
    cards.forEach(function (c) {
      const id = c.getAttribute('data-route-id');
      const R = app.MOCK.ROUTES.filter(function (r) { return r.id === id; })[0];
      t.includes(c.textContent.replace(/\s+/g, ''), app.STATE.routeDone(id) + '/' + R.total, id);
    });
  });

  t.test('/route/:id：站數＝stops 數、斷點可設為下車點', async function (app) {
    await app.reset();
    for (let i = 0; i < app.MOCK.ROUTES.length; i++) {
      const R = app.MOCK.ROUTES[i];
      await app.go('/route/' + R.id);
      t.eq(app.$$('[data-route-track] .route-track__stop').length, R.stops.length, R.id + ' 站數');
      t.includes(app.text('[data-route-prog]'), app.STATE.routeDone(R.id) + '/' + R.stops.length, R.id + ' 收集 n/m');
      const brk = app.APP.explore.breakpoint(R.id);
      if (brk) {
        t.ok(!app.APP.fmt.canWalk(brk.dist) && !brk.done, R.id + ' 斷點走不到且還沒收');
        const b = app.$('[data-breakpoint] [data-act="set-dropoff"]');
        t.includes(b && b.textContent, String(app.APP.fmt.fare(app.APP.fmt.km(brk.dist))), R.id + ' 斷點車資用公式');
      }
    }
    await app.go('/route/rail');
    const pid = app.$('[data-breakpoint]').getAttribute('data-breakpoint');
    await app.click('[data-breakpoint] [data-act="set-dropoff"]');
    await app.at('/ride');
    const d = app.APP.store.get('dropoff');
    t.eq(d && d.id, pid, '斷點的地方成為下車點');
    t.eq(d && d.via, 'route', 'via route');
    await app.reset();
  });

  t.test('/route/nope：找不到這條路線', async function (app) {
    await app.go('/route/nope');
    t.includes(app.text('main.view[data-view]'), '找不到這條路線', '文案');
    t.ok(app.$('main.view[data-view] a[href="#/routes"]'), '回路線列表');
  });

  /* 7. 返回鍵回到來處 */
  t.test('返回：/explore/map → /place/moat → 返回 → /explore/map', async function (app) {
    await app.go('/explore/map');
    await app.click('.spot[data-spot="moat"]');
    await app.click('.ex-peek [data-act="open-place"]');
    await app.at('/place/moat');
    await app.click('main.view[data-view] a[data-back]');
    await app.at('/explore/map');
  });

  t.test('返回：/routes → /route/glass → 站 → /place → 返回 → /route/glass', async function (app) {
    await app.go('/routes');
    await app.click('[data-route-id="glass"]');
    await app.at('/route/glass');
    await app.click('[data-route-track] [data-act="open-place"]');
    await app.waitFor(function () { return /^\/place\//.test(app.route().path); }, 3000, '進到地方');
    await app.click('main.view[data-view] a[data-back]');
    await app.at('/route/glass');
  });
});
