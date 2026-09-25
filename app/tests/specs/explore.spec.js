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

  /* 2. /explore：今天的地方、X2 缺口、路線、還沒去 */
  t.test('/explore：今天的地方與雙 CTA', async function (app) {
    await app.reset();
    await app.go('/explore');
    const T0 = app.MOCK.TODAY;
    const P = app.APP.place(T0.id);
    t.includes(app.text('.ex-today'), P.name, '今天的地方名字');
    t.ok(app.$('.ex-today.is-gray'), '沒收過是灰階');
    t.ok(app.$('.ex-today .ai-mark'), '有 AI 生成示意');
    const go = app.$('[data-act="go-walk"]');
    t.ok(go && go.classList.contains('btn-primary'), '走得到 → 主要動作是走路前往');
    t.eq(go && go.getAttribute('href'), '#/going/' + T0.id, '走路前往 → /going/:id');
    t.includes(app.text('.ex-today'), String(app.APP.fmt.walkMin(P.dist)), '走路分鐘用公式');
    /* 為什麼推薦給你：收合 → 點開 */
    t.ok(app.$('[data-why-list]').hidden, '預設收合');
    await app.click('[data-act="toggle-why"]');
    t.ok(!app.$('[data-why-list]').hidden, '點開後看得到');
    t.eq(app.$$('[data-why-list] .why__item').length, T0.why.length, '依據條數＝MOCK.TODAY.why');
  });

  t.test('/explore：X2 缺口是一句陳述、最多三個地方', async function (app) {
    await app.go('/explore');
    const g = app.APP.explore.gap();
    t.ok(g, '有一枚還沒收齊的獎章');
    if (!g) return;
    const line = app.text('.ex-gap__line');
    t.includes(line, '你還沒有『' + g.badge.name + '』這一組的 ' + g.missing + ' 張', '句型');
    const chips = app.$$('.ex-chip');
    t.ok(chips.length >= 1 && chips.length <= 3, 'chip 數 ' + chips.length);
    t.eq(chips.length, Math.min(3, g.places.length), 'chip 數＝還缺的地方（最多 3）');
    t.ok(!app.$('.ex-gap .ring, .ex-gap input[type=checkbox]'), '沒有進度環、沒有勾選');
    /* 缺口是還沒收齊裡缺最少的一枚 */
    const S = app.STATE;
    app.MOCK.BADGES.forEach(function (b) {
      const r = S.badge(b.id);
      if (r.got) return;
      t.ok(r.total - r.done >= g.missing, '〈' + r.name + '〉缺 ' + (r.total - r.done) + ' ≥ 挑中的 ' + g.missing);
    });
  });

  t.test('/explore：路線 ≤ 2 張、進度＝STATE.routeDone；還沒去 ≤ 3 列', async function (app) {
    await app.go('/explore');
    const cards = app.$$('.ex-rcard');
    t.ok(cards.length <= 2 && cards.length >= 1, '路線卡 ' + cards.length);
    cards.forEach(function (c) {
      const id = c.getAttribute('href').split('/').pop();
      const R = app.MOCK.ROUTES.filter(function (r) { return r.id === id; })[0];
      t.includes(c.textContent.replace(/\s+/g, ''), app.STATE.routeDone(id) + '/' + R.total, id + ' 進度');
    });
    t.ok(app.$('a[href="#/routes"]'), '有「全部」→ /routes');
    t.ok(app.$$('.ex-row').length <= 3, '還沒去 ≤ 3 列');
    t.ok(app.$('.ex-block--last a[href="#/explore/map"]'), '在地圖上看 → /explore/map');
  });

  t.test('/explore：今天的地方收過之後是彩色＋已收藏', async function (app) {
    await app.reset();
    app.APP.explore.collect(app.MOCK.TODAY.id, { by: 'walk', km: 1 });
    await app.go('/explore');
    t.ok(app.$('.ex-today.is-got'), '彩色');
    t.includes(app.text('.ex-today'), '已收藏', '已收藏角標');
    t.ok(app.$('[data-act="open-postcard"]'), '動作換成看明信片');
    await app.reset();
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
    /* 選到的景點放大（只有它一顆） */
    t.ok(s.classList.contains('is-selected'), '點到的那一顆 is-selected');
    t.eq(app.$$('.spot.is-selected').length, 1, '只有一顆被選');
    t.ok(s.getBoundingClientRect().width > app.$('.spot[data-spot="market"]').getBoundingClientRect().width * 1.2, '選到的比別顆大');
    await app.click(s);
    t.eq(app.$$('.spot.is-selected').length, 0, '再點一次收起小卡，也取消選取');
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

  t.test('抽卡：機率表加總 100%、走路遞減、搭車必得金框', async function (app) {
    const E = app.APP.explore;
    const sum = function (k) { return E.DRAW_STYLES.reduce(function (a, d) { return a + d[k]; }, 0); };
    t.eq(sum('walk'), 1000, '走路加總 1000‰');
    t.eq(sum('ride'), 1000, '搭車加總 1000‰');
    t.eq(E.DRAW_STYLES.length, 5, '每個地方五款');
    const gold = E.DRAW_STYLES.filter(function (d) { return d.gold; });
    t.eq(gold.length, 1, '一款金框');
    t.eq(gold[0].ride, 1000, '搭車必得金框');
    const plain = E.DRAW_STYLES.filter(function (d) { return !d.gold; });
    t.eq(plain.length, 4, '四款一般');
    t.ok(plain.every(function (d, i) { return !i || d.walk < plain[i - 1].walk; }), '一般款越後面越難抽');
    t.ok(gold[0].walk < plain[plain.length - 1].walk, '走路抽到金框比任何一般款都難');
    t.eq(E.drawStyle('walk', 0).key, plain[0].key, 'r=0 → 第一款');
    t.ok(E.drawStyle('walk', 0.9999).gold, 'r→1 → 金框');
    t.ok(E.drawStyle('ride', 0.3).gold && E.drawStyle('ride', 0).gold, '搭車不論 r 都是金框');
  });

  t.test('/unlock/glass-kiln：抽到的款式固定（重進不重抽）、? 打開機率、收下記款式', async function (app) {
    await app.reset({ store: { draws: { 'glass-kiln': 'ink' } } });
    await app.go('/unlock/glass-kiln');
    t.eq(app.$('[data-final-card]').getAttribute('data-style'), 'ink', '用 store.draws 的那一款');
    t.includes(app.text('[data-draw]'), '水墨', '寫出畫風名');
    t.ok(!app.$('[data-final-card].postcard--gold'), '水墨不是金框');
    await app.go('/explore');
    await app.go('/unlock/glass-kiln');
    t.eq(app.$('[data-final-card]').getAttribute('data-style'), 'ink', '重進還是同一款');
    t.ok(!app.$('.ex-odds'), '機率預設收起來');
    await app.click('[data-act="open-odds"]');
    t.ok(app.$('.ex-odds'), '? → 機率說明');
    const box = app.$('.ex-odds__box').getBoundingClientRect();
    const top = app.doc.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    t.ok(top && top.closest('.ex-odds'), '機率說明在最上層（沒有被解鎖頁蓋住）');
    t.eq(app.$('[data-unlock]').getAttribute('data-at'), '3', '點 ? 不會動到幕');
    const walk = app.$$('[data-odds="walk"] .ex-odds__row').map(function (r) { return r.textContent; }).join('|');
    app.APP.explore.DRAW_STYLES.forEach(function (d) {
      t.includes(walk, d.name + (d.walk / 10) + '%', '走路：' + d.name);
    });
    t.includes(app.text('[data-odds="ride"]'), '100%', '搭車：金框 100%');
    await app.click('[data-act="close-odds"]');
    t.ok(!app.$('.ex-odds'), '知道了 → 關掉');
    await app.click('[data-act="collect"]');
    await app.at('/album');
    t.eq(app.APP.store.get('cardStyle').p11, 'ink', 'store.cardStyle 記下水墨');
    t.ok(!(app.APP.store.get('draws') || {})['glass-kiln'], '這次抵達的暫存抽卡清掉');
    await app.reset();
  });

  t.test('/unlock/glass-kiln：走路抽到金框也是金框（但不加點）', async function (app) {
    await app.reset({ store: { draws: { 'glass-kiln': 'gold' } } });
    const pts0 = app.STATE.points;
    await app.go('/unlock/glass-kiln');
    t.ok(app.$('[data-final-card].postcard--gold'), '金框');
    t.ok(!app.$('[data-points]'), '走路沒有 +50');
    await app.click('[data-act="collect"]');
    await app.at('/album');
    await app.go('/postcard/p11');
    t.ok(app.$('.postcard--gold'), '明信片頁是金框');
    t.eq(app.STATE.points, pts0, '點數不變');
    await app.reset();
  });

  /* 非 still：抵達亮燈 → 收集面板 → 抽卡 → 結果。五款都跑一次，確認每款的收尾狀態 */
  async function drawThrough(app) {
    await app.click('[data-act="open-spot"]');
    await app.click('[data-act="draw"]');
    await app.waitFor(function () { return app.$('[data-unlock]').getAttribute('data-at') !== '1'; }, 2000, '進入抽卡');
    for (let i = 0; i < 16 && app.$('[data-unlock]').getAttribute('data-at') !== '3'; i++) {
      await app.click('[data-unlock]');
      await app.tick(300);
    }
    await app.waitFor(function () { return app.$('[data-unlock]').getAttribute('data-at') === '3'; }, 6000, '抽卡結果');
  }

  t.test('/unlock 非 still：亮起來 → 點它出面板（5 款＋?）→ 抽卡 → 結果；五款各自收尾', async function (app) {
    const cases = [
      { key: 'watercolor', place: 'glass-kiln' },
      { key: 'oil', place: 'glass-kiln' },
      { key: 'woodcut', place: 'glass-kiln' },
      { key: 'ink', place: 'glass-kiln', paper: true },
      { key: 'gold', place: 'neiwan', ride: true },
    ];
    for (const c of cases) {
      const store = c.ride
        ? { trip: { placeId: c.place, phase: 'done', startedAt: new Date().toISOString(), rated: true, km: 28 } }
        : { draws: { [c.place]: c.key } };
      await app.reset({ still: false, store: store });
      await app.go('/unlock/' + c.place + (c.ride ? '?ride=1' : ''));
      const box = app.$('[data-unlock]');
      t.eq(box.getAttribute('data-at'), '1', c.key + '：先停在抵達');
      t.eq(box.getAttribute('data-style'), c.key, c.key + '：抽到的款式');
      await app.waitFor(function () { return app.$('[data-unlock]').classList.contains('is-lit'); }, 2000, '亮起來');
      t.ok(app.$('[data-arrive-sheet]').hidden, c.key + '：面板一開始收著');
      await app.click('[data-act="open-spot"]');
      t.ok(!app.$('[data-arrive-sheet]').hidden, c.key + '：點發光的地方 → 面板');
      t.includes(app.text('[data-arrive-sheet]'), app.APP.explore.DRAW_STYLES.length + ' 款', c.key + '：寫幾款');
      t.ok(app.$('[data-arrive-sheet] [data-act="open-odds"]'), c.key + '：面板上有機率的 ?');
      t.eq(!!app.$('.ex-sheet__gold'), !!c.ride, c.key + '：搭車才寫必得金框');
      await drawThrough(app);
      t.ok(app.$('[data-flip]').classList.contains('is-front'), c.key + '：翻到正面');
      t.eq(app.$('[data-final-card]').getAttribute('data-style'), c.key, c.key + '：卡面款式');
      t.eq(app.$('[data-unlock]').classList.contains('is-paper'), !!c.paper, c.key + '：只有水墨把背景洗成宣紙');
      t.eq(app.$('[data-unlock]').classList.contains('is-gold-up'), c.key === 'gold', c.key + '：只有金框有光芒');
      t.eq(!!app.$('[data-final-card].postcard--gold'), c.key === 'gold', c.key + '：只有金框是金框');
      t.ok(app.$('[data-act="collect"]'), c.key + '：結果有「收進收藏」');
      t.eq(app.errors.length, 0, c.key + '：錯誤：' + app.errors.join('；'));
    }
    await app.reset();
  }, { timeout: 60000 });

  t.test('/unlock 非 still：點畫面快轉（蓄力 → 可以翻 → 翻開）；音效開關記在 store.fxMute', async function (app) {
    await app.reset({ still: false, store: { draws: { 'glass-kiln': 'ink' } } });
    await app.go('/unlock/glass-kiln');
    const snd = app.$('[data-act="toggle-sound"]');
    t.eq(snd.getAttribute('aria-pressed'), 'true', '音效預設開');
    await app.click(snd);
    t.eq(app.APP.store.get('fxMute'), true, '關掉 → store.fxMute');
    t.eq(snd.getAttribute('aria-pressed'), 'false', 'aria-pressed 跟著');
    t.eq(app.$('[data-unlock]').getAttribute('data-at'), '1', '按音效不會動到幕');
    await app.click('[data-act="open-spot"]');
    await app.click('[data-act="draw"]');
    await app.waitFor(function () { return app.$('[data-unlock]').getAttribute('data-at') === '2'; }, 2000, '抽卡中');
    await app.tick(700);
    await app.click('[data-unlock]');
    await app.waitFor(function () { return app.$('[data-unlock]').classList.contains('is-ready'); }, 2500, '蓄力中點一下 → 可以翻');
    t.includes(app.text('[data-stage-cap]'), '點一下翻開', '提示翻開');
    await app.click('[data-unlock]');
    await app.waitFor(function () { return !app.$('[data-unlock]').classList.contains('is-ready'); }, 1000, '開始翻');
    await app.click('[data-unlock]');
    await app.waitFor(function () { return app.$('[data-unlock]').getAttribute('data-at') === '3'; }, 1500, '翻開中點一下 → 結果');
    await app.reset();
  });

  /* 生成好的明信片：抵達頁用成品、收藏與叫車首頁用 data-card-art 疊上去 */
  t.test('生成的明信片：款式來源、成品路徑、底圖照片', async function (app) {
    await app.reset();
    const E = app.APP.explore, S = app.STATE;
    t.eq(E.postcardSrc('p11', 'ink'), 'assets/postcards/p11-ink.jpg', '成品路徑');
    t.eq(E.postcardSrc('p11', 'nope'), '', '不認得的款式沒有成品');
    t.eq(E.postcardSrc('zz', 'ink'), '', '不認得的明信片沒有成品');
    t.eq(E.postcardSrc('p22', 'ink'), '', '還沒生成的明信片沒有成品（卡面退回照片＋濾鏡）');
    app.MOCK.POSTCARDS.forEach(function (c) {
      t.ok(E.cardPhoto(c.id), c.id + ' 有底圖照片');
    });
    t.eq(E.cardPhoto('p19').file, 'p19-1.jpg', '同一個地方的第二張卡用自己的照片');
    t.eq(E.cardStyleOf('p11'), null, '還沒收的沒有款式');
    t.eq(E.cardStyleOf('p4').key, 'gold', 'demo 一開始的搭車卡 → 金框');
    const w = E.cardStyleOf('p1');
    t.ok(w && !w.gold, '走路收的預設款式不是金框：' + (w && w.key));
    t.eq(E.cardStyleOf('p1').key, w.key, '同一張每次都一樣');
    app.APP.store.set('cardStyle', { p1: 'ink' });
    t.eq(E.cardStyleOf('p1').key, 'ink', '抽到的款式優先');
    t.ok(S.has('p1'), 'p1 在收藏裡');
    await app.reset();
  });

  t.test('/unlock 卡面用生成的成品；收藏與叫車卡片疊上收下的那一款', async function (app) {
    await app.reset({ store: { draws: { 'glass-kiln': 'ink' } } });
    await app.go('/unlock/glass-kiln');
    const img = app.$('[data-final-card] .ex-face__img');
    t.ok(img && /assets\/postcards\/p11-ink\.jpg$/.test(img.getAttribute('src')), '成品：' + (img && img.getAttribute('src')));
    t.ok(img && /glass-kiln-1\.jpg$/.test(img.getAttribute('data-fallback') || ''), '載不到就退回照片');
    t.ok(app.$('[data-final-card] .ex-face--gen'), '成品不再套濾鏡');
    t.includes(app.text('[data-credit]'), '底圖照片', '底圖的作者與授權');
    await app.go('/postcards');
    await app.tick(60);
    const got = app.STATE.all.cards;
    app.$$('[data-card-art]').forEach(function (el) {
      const id = el.getAttribute('data-card-art');
      const gen = el.querySelector(':scope > img.card-gen');
      const d = got[id] ? app.APP.explore.cardStyleOf(id) : null;
      const src = d ? app.APP.explore.postcardSrc(id, d.key) : '';
      if (src) {
        t.ok(gen && gen.getAttribute('src') === src, id + ' 疊上 ' + d.key);
      } else {
        t.ok(!gen, id + (got[id] ? ' 還沒生成成品：不疊' : ' 還沒收：不疊'));
      }
    });
    await app.go('/ride?mode=explore');
    await app.tick(60);
    const collected = app.$$('.ride-v2__card.is-collected [data-card-art]');
    t.ok(collected.every(function (el) {
      const id = el.getAttribute('data-card-art');
      const d = app.APP.explore.cardStyleOf(id);
      return !app.APP.explore.postcardSrc(id, d.key) || el.querySelector('img.card-gen');
    }), '叫車首頁收過、已生成的卡也是成品（' + collected.length + ' 張）');
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
  t.test('返回：/explore → /route/rail → 返回 → /explore', async function (app) {
    await app.reset();
    await app.go('/explore');
    await app.click('.ex-rcard[href="#/route/rail"], .ex-rcard');
    await app.waitFor(function () { return /^\/route\//.test(app.route().path) && app.doc.documentElement.getAttribute('data-view-ready') === '1'; }, 3000, '進到路線');
    await app.click('main.view[data-view] a[data-back]');
    await app.at('/explore');
  });

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
