/* ==========================================================================
   explore.spec — 探索區塊（/explore、/explore/map、/place、/going、/unlock、/routes、/route）
   契約：ARCHITECTURE.md §6.3 五類 —— render／主要互動改狀態／數字＝公式／可按數／返回。
   ========================================================================== */
T.spec('explore', function (t) {

  /* 共用路由表的 explore 那幾條，加上同一個地方的第二張卡、只在路線上的卡、找不到的 id、另外兩條路線 */
  const ROUTES = T.routes({ area: 'explore', extra: ['/place/moat', '/place/p13', '/place/nope',
                                                     '/route/glass', '/route/water', '/route/nope'] })
    .map(function (r) { return { path: r.path, max: T.tapMax(r.path) }; });

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
    T.helpers.collect(app, app.MOCK.TODAY.id);
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

  t.test('/place/nope：找不到這個地方＋回探索（新 UI 的探索＝叫車首頁的探索模式）', async function (app) {
    await app.go('/place/nope');
    t.ok(app.$('[data-ex-missing]'), '找不到卡');
    t.includes(app.text('main.view[data-view]'), '找不到這個地方', '文案');
    t.ok(app.$('main.view[data-view] a[href="#/ride?mode=explore"]'), '回探索 → /ride?mode=explore');
    t.ok(!app.$('main.view[data-view] a[href="#/explore"]'), '不再送回舊的 /explore');
    t.ok(!app.$('[data-place-foot]'), '沒有動作區');
  });

  t.test('新 UI：返回的保底、「回探索」、先不去了都回 /ride?mode=explore（有地點就帶 area）', async function (app) {
    await app.reset();
    await app.go('/place/glass-kiln');
    t.eq(app.$('main.view a[data-back]').getAttribute('data-back'), '/ride?mode=explore&area=glass-kiln', '/place 返回的保底');
    await app.go('/routes');
    t.eq(app.$('main.view a[data-back]').getAttribute('data-back'), '/ride?mode=explore', '/routes 返回的保底');
    await app.go('/going/nope');
    t.ok(app.$('main.view a[href="#/ride?mode=explore"]'), '/going 找不到 → 回探索');
    await app.go('/unlock/nope');
    t.ok(app.$('main.view a[href="#/ride?mode=explore"]'), '/unlock 找不到 → 回探索');
    /* 已收過的地方：結果頁的「回探索」 */
    T.helpers.collect(app, 'glass-kiln');
    await app.go('/unlock/glass-kiln');
    const back = app.$('[data-act="go-explore"]');
    t.eq(back && back.getAttribute('href'), '#/ride?mode=explore&area=glass-kiln', '已收過 → 回探索帶 area');
    t.ok(!back || back.getBoundingClientRect().height >= 44, '回探索的命中區 ≥ 44 px 高');
    await app.click(back);
    await app.at('/ride');
    t.eq(app.route().query.get('mode'), 'explore', '落在探索模式');
    t.eq(app.route().query.get('area'), 'glass-kiln', 'area＝這個地方');
    const on = app.$('#tabbar [aria-current="page"]');
    t.eq(on && on.getAttribute('data-tab-id'), 'ride', '底欄亮的是叫車（舊的 /explore 在新底欄沒有分頁）');
    /* 先不去了：沒有歷史時回探索模式；命中區 ≥ 44 px 高 */
    await app.reset({ hash: '/going/moat' });
    const c = app.$('[data-act="cancel-going"]');
    t.ok(c && c.getBoundingClientRect().height >= 44, '先不去了 高 ' + (c && Math.round(c.getBoundingClientRect().height)) + ' ≥ 44');
    await app.click(c);
    await app.at('/ride');
    t.eq(app.route().query.get('area'), 'moat', '先不去了 → 探索模式、area=moat');
    await app.reset();
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
    /* 自己準備狀態（單獨跑這一條也對）：先收下 p11 */
    await app.reset();
    T.helpers.collect(app, 'glass-kiln');
    await app.go('/unlock/glass-kiln');
    t.ok(app.$('[data-scene="3"].is-on'), '第三幕');
    t.includes(app.text('main.view[data-view]'), '已在收藏裡', '已在收藏裡');
    t.eq(app.$('[data-act="open-postcard"]') && app.$('[data-act="open-postcard"]').getAttribute('href'), '#/postcard/p11', '→ /postcard/p11');
    t.ok(!app.$('[data-act="collect"]'), '不能再收一次');
  });

  t.test('/unlock/neiwan?ride=1：金框、by ride、points +50、trip 清掉', async function (app) {
    await app.reset({ store: { trip: T.fixtures.trip({ phase: 'done', startedAt: new Date().toISOString(), rated: true }),
                               dropoff: T.fixtures.dropoff({ setAt: new Date().toISOString() }) } });
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

  /* 審查 1：已抵達（phase done）的那一趟還沒收，不論從哪個入口進 /unlock 都是搭車抵達；走路收下不清 trip */
  t.test('搭車抵達還沒收：沒帶 ?ride=1 也是金框、by ride、+點數，trip 用掉', async function (app) {
    const trip = T.fixtures.trip({ phase: 'done', startedAt: new Date().toISOString(), rated: true });
    await app.reset({ store: { trip: trip } });
    const A = app.APP;
    const bonus = (A.ride && A.ride.RIDE_BONUS) || 50;
    const pts0 = app.STATE.points;
    /* demo 面板的「走路抵達」（地點預設跟著這一頁）＝進 /unlock/neiwan，不帶 ?ride=1 */
    A.system.demoArrive('neiwan', 'walk');
    await app.at('/unlock/neiwan');
    t.eq(app.route().query.get('ride'), null, '網址沒有 ?ride=1');
    t.ok(app.$('[data-unlock][data-ride]'), '還是搭車抵達');
    t.ok(app.$('[data-final-card].postcard--gold'), '金框');
    t.includes(app.text('[data-points]'), '+' + bonus, '和泰 Points（APP.ride.RIDE_BONUS）');
    await app.click('[data-act="collect"]');
    await app.at('/album');
    t.eq(app.STATE.card('p9') && app.STATE.card('p9').by, 'ride', 'by ride');
    t.eq(A.store.get('trip'), null, '這一趟用掉了');
    t.eq(app.STATE.points, pts0 + bonus, '點數加上去');
    t.eq(A.store.get('cardStyle').p9, 'gold', '收下的是金框');
    await app.reset();
  });

  t.test('搭車抵達還沒收：/going 不再帶你走一趟；走路收別的地方不清掉 trip、收這裡才算搭車', async function (app) {
    const trip = T.fixtures.trip({ placeId: 'glass-kiln', phase: 'done', startedAt: new Date().toISOString(), rated: true, km: 1 });
    await app.reset({ store: { trip: trip } });
    await app.go('/going/glass-kiln');
    t.ok(app.$('[data-going-rode]'), '已經搭 yoxi 到了的卡');
    t.ok(!app.$('[data-act="arrive"]'), '沒有模擬抵達（不用再走一趟）');
    const a = app.$('[data-going-rode] [data-act="unlock-ride"]');
    t.eq(a && a.getAttribute('href'), '#/unlock/glass-kiln?ride=1', '→ 收下這一趟的明信片');
    t.noDeadButtons(app, '/going 已搭車抵達');
    t.noBannedWords(app, { msg: '/going 已搭車抵達' });
    /* 別的地方的 done trip 不擋走路 */
    await app.go('/going/moat');
    t.ok(app.$('[data-act="arrive"]'), '別的地方照常走路前往');
    t.ok(!app.$('[data-going-rode], [data-going-trip]'), '沒有擋住的卡');
    /* 走路收下別的地方：trip 留著（它只在搭車收下時用掉，還沒領的限定版不會消失） */
    T.helpers.collect(app, 'moat');
    t.ok(app.APP.store.get('trip') && app.APP.store.get('trip').placeId === 'glass-kiln', '走路收別的地方不清 trip');
    /* 同一個地方有搭 yoxi 抵達的那一趟：collect 自己判斷是搭車，收下就用掉 */
    t.eq(app.APP.explore.collect('glass-kiln'), true, '收下 glass-kiln');
    t.eq(app.STATE.card('p11').by, 'ride', '有抵達的那一趟 → 算搭車');
    t.eq(app.APP.store.get('trip'), null, '搭車收下才清 trip');
    await app.reset();
  });

  /* 機率表本身（加總、遞減、搭車必得金框、區間邊界）是純函式：在 tests/unit/views.test.mjs */

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

  /* 審查 2：機率說明掛在 .device 上，離開 /unlock 要跟著收掉（不會蓋在下一頁上） */
  t.test('機率說明：離開 /unlock（返回、導覽）就收掉；Esc 關；data-overlay＋_dismiss', async function (app) {
    await app.reset({ store: { draws: { 'glass-kiln': 'oil' } } });
    await app.go('/album');
    await app.go('/unlock/glass-kiln');
    await app.click('.ex-unlock__card [data-act="open-odds"]');
    const sc = app.$('.ex-odds');
    t.ok(sc, '? → 機率說明');
    t.ok(sc && sc.hasAttribute('data-overlay'), 'data-overlay');
    t.eq(sc && typeof sc._dismiss, 'function', 'el._dismiss');
    t.ok(sc && sc.querySelector('[role="dialog"]'), 'role=dialog（a11yDialog）');
    /* Esc 關掉 */
    app.doc.dispatchEvent(new app.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    t.ok(!app.$('.ex-odds'), 'Esc → 關掉');
    /* 再開一次，按瀏覽器的返回 */
    await app.click('.ex-unlock__card [data-act="open-odds"]');
    t.ok(app.$('.ex-odds'), '再開一次');
    app.win.history.back();
    await app.at('/album');
    t.ok(!app.$('.ex-odds'), '返回 /album：機率說明收掉了');
    /* 導覽（不經返回）也一樣；_dismiss 可以重複呼叫 */
    await app.go('/unlock/glass-kiln');
    await app.click('.ex-unlock__card [data-act="open-odds"]');
    const sc2 = app.$('.ex-odds');
    await app.go('/explore');
    t.ok(!app.$('.ex-odds'), '導覽到 /explore：收掉了');
    try { sc2._dismiss(); sc2._dismiss(); t.ok(true, '_dismiss 重複呼叫不丟例外'); }
    catch (e) { t.fail('_dismiss 重複呼叫丟例外：' + e.message); }
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
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

  /* 非 still：抵達亮燈 → 收集面板 → 抽卡 → 結果（T.helpers.drawThrough）。五款都跑一次，確認每款的收尾狀態 */
  const drawThrough = T.helpers.drawThrough;

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
        ? { trip: T.fixtures.trip({ placeId: c.place, phase: 'done', startedAt: new Date().toISOString(), rated: true, km: 28 }) }
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
      t.ok(!/必得/.test(app.text('[data-arrive-sheet]')), c.key + '：面板不寫「必得」（機率只在「?」裡）');
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

  /* 審查 4：抽卡時焦點不掉到 body；鍵盤與報讀器能跳過；抽完焦點到結果、念一次抽到什麼 */
  t.test('抽卡的鍵盤與報讀器：收集 → 焦點在「跳過動畫」→ 跳過 → 焦點在「抽到 ○○」', async function (app) {
    await app.reset({ still: false, store: { draws: { 'glass-kiln': 'woodcut' } } });
    await app.go('/unlock/glass-kiln');
    await app.click('[data-act="open-spot"]');
    const drawBtn = app.$('[data-act="draw"]');
    t.eq(app.doc.activeElement, drawBtn, '面板打開：焦點在「收集明信片」');
    const skip = app.$('[data-act="skip-draw"]');
    t.ok(skip && skip.hidden, '跳過動畫平常收著');
    await app.click(drawBtn);
    t.ok(skip && !skip.hidden, '開始抽卡：跳過動畫出現');
    t.eq(app.doc.activeElement, skip, '焦點沒有掉到 body（在跳過動畫）');
    t.ok(!app.$('[data-stage-cap]').hasAttribute('aria-live'), '蓄力說明字不是 live region（不會每 0.5 秒打斷報讀器）');
    skip.blur();
    t.eq(app.win.getComputedStyle(skip).opacity, '0', '沒有鍵盤焦點時看不到它（點畫面本來就能快轉）');
    skip.focus();
    await app.click(skip);
    t.eq(app.$('[data-unlock]').getAttribute('data-at'), '3', '跳過 → 直接看結果');
    t.ok(skip.hidden, '跳過動畫收起來');
    const lab = app.$('[data-draw]');
    t.eq(app.doc.activeElement, lab, '焦點在結果那一行（tabindex=-1）');
    t.includes(lab && lab.textContent, '抽到', '報讀器念「抽到」');
    t.includes(lab && lab.textContent, '木刻版畫', '念出畫風');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));

    /* 不跳過、一路點畫面跑完：收尾一樣把焦點放到結果 */
    await app.reset({ still: false, store: { draws: { 'glass-kiln': 'oil' } } });
    await app.go('/unlock/glass-kiln');
    await drawThrough(app);
    t.eq(app.doc.activeElement, app.$('[data-draw]'), '跑完：焦點在結果那一行');
    t.ok(app.$('[data-act="skip-draw"]').hidden, '跑完：跳過動畫收起來');
    await app.reset();
  }, { timeout: 20000 });

  /* 審查 5：抵達的鐘聲與光點排在 420ms 之後；在那之前就開始抽卡，它不能在抽卡中冒出來。靜音、離開都切掉排好的聲音 */
  t.test('抵達的鐘聲：還沒亮就開始抽卡 → 不再響；靜音與離開 /unlock 都呼叫 sfx.stopAll()', async function (app) {
    await app.reset({ still: false, store: { draws: { 'glass-kiln': 'watercolor' } } });
    const sfx = app.APP.fx.sfx;
    t.eq(typeof sfx.stopAll, 'function', 'APP.fx.sfx.stopAll');
    let arrive = 0, stops = 0;
    const a0 = sfx.arrive, s0 = sfx.stopAll;
    sfx.arrive = function () { arrive++; };
    sfx.stopAll = function () { stops++; return s0.apply(this, arguments); };
    /* 對照組：不動它，亮起來時響一次 */
    await app.go('/unlock/glass-kiln');
    await app.waitFor(function () { return arrive > 0; }, 3000, '亮起來的鐘聲');
    t.eq(arrive, 1, '對照組：響一次');
    /* 把時間放慢十倍（全部跟著 --t-scene 縮放），趁鐘聲還沒排到就按收集 */
    await app.go('/album');
    arrive = 0;
    app.doc.documentElement.style.setProperty('--t-scene', '12000ms');
    await app.go('/unlock/glass-kiln');
    await app.click('[data-act="open-spot"]');
    await app.click('[data-act="draw"]');
    await app.tick(4800);
    t.eq(arrive, 0, '抽卡開始之後，抵達的鐘聲（與光點）不再出現');
    const s1 = stops;
    await app.click('[data-act="toggle-sound"]');
    t.eq(app.APP.store.get('fxMute'), true, '靜音');
    t.ok(stops > s1, '靜音 → sfx.stopAll()');
    const s2 = stops;
    await app.go('/album');
    t.ok(stops > s2, '離開 /unlock → sfx.stopAll()');
    sfx.arrive = a0; sfx.stopAll = s0;
    app.doc.documentElement.style.removeProperty('--t-scene');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
    await app.reset();
  }, { timeout: 20000 });

  /* 審查 6、8：結果頁不會一直動（光芒、全息掃光跑有限次）；?still=1 直接關掉，縮圖每次一樣 */
  t.test('金框結果頁：光芒與全息掃光有限次；still 關掉', async function (app) {
    await app.reset({ store: { draws: { 'glass-kiln': 'gold' } } });
    await app.go('/unlock/glass-kiln');
    const cs = function (sel) { const el = app.$(sel); return el ? app.win.getComputedStyle(el) : null; };
    t.eq(cs('.ex-rays i') && cs('.ex-rays i').animationName, 'none', 'still：光芒不轉');
    t.eq(cs('.ex-face__holo') && cs('.ex-face__holo').animationName, 'none', 'still：全息掃光不掃');
    await app.reset({ still: false, store: { draws: { 'glass-kiln': 'gold' } } });
    await app.go('/unlock/glass-kiln');
    await drawThrough(app);
    const rays = cs('.ex-rays i'), holo = cs('.ex-face__holo');
    t.eq(rays && rays.animationName, 'ex-rays-settle', '結果：光芒在轉（昇格之後才開始）');
    t.ok(rays && rays.animationIterationCount !== 'infinite', '光芒：有限次（' + (rays && rays.animationIterationCount) + '）');
    t.eq(holo && holo.animationName, 'ex-holo', '結果：全息掃光（翻開之後才開始）');
    t.ok(holo && holo.animationIterationCount !== 'infinite', '全息掃光：有限次（' + (holo && holo.animationIterationCount) + '）');
    await app.reset();
  }, { timeout: 20000 });

  /* 金框的金粉（explore-gold.js）：翻開以後才標；非 still 才建 canvas */
  t.test('金粉：金框翻開以後才標 data-gold-aura；canvas 掛在 .device、不吃點擊；still 與其他款式沒有', async function (app) {
    await app.reset({ still: false, store: { draws: { 'glass-kiln': 'gold' } } });
    await app.go('/unlock/glass-kiln');
    t.ok(app.$('[data-final-card].postcard--gold'), '這一次是金框');
    t.ok(!app.$('[data-final-card][data-gold-aura]'), '翻開前沒有金粉（不先洩底）');
    await drawThrough(app);
    t.ok(app.$('[data-final-card][data-gold-aura]'), '翻開以後有金粉');
    await app.waitFor(function () { return app.APP.fx.gold.tracked() >= 1; }, 2000, '追蹤到金框卡');
    const cv = app.doc.querySelector('.device > canvas.gold-aura');
    t.ok(cv, 'canvas 掛在 .device（只有一張）');
    t.eq(app.doc.querySelectorAll('canvas.gold-aura').length, 1, '整台手機一張');
    t.eq(cv && cv.getAttribute('aria-hidden'), 'true', '報讀器看不到');
    t.eq(cv && app.win.getComputedStyle(cv).pointerEvents, 'none', '不吃點擊');
    t.noDeadButtons(app, '/unlock 金框結果（有金粉）');
    await app.reset({ store: { draws: { 'glass-kiln': 'oil' } } });
    await app.go('/unlock/glass-kiln');
    t.ok(!app.$('[data-gold-aura]'), '油畫：沒有金粉');
    t.ok(!app.doc.querySelector('canvas.gold-aura'), 'still：沒有 canvas');
    t.eq(app.APP.fx.gold.tracked(), 0, 'still：不追蹤');
    await app.reset();
  }, { timeout: 20000 });

  t.test('金粉的物理：卡片往上走金粉跟著往上、落在後面；停下來帶著慣性；靜止時慢慢往上飄', async function (app) {
    await app.reset();
    const step = app.APP.fx.gold.step;
    const dt = 1 / 60;
    const p = { x: 0, y: 0, vx: 0, vy: 0, t: 0, ph: 0 };
    for (let i = 0; i < 18; i++) step(p, 0, -600, dt);          /* 0.3 秒，卡片帶著空氣往上 600 px/s */
    t.ok(p.vy < -300 && p.y < -40, '往上捲：金粉跟著往上（vy ' + p.vy.toFixed(0) + '、y ' + p.y.toFixed(0) + '）');
    t.ok(p.vy > -600, '比卡片慢一點，落在後面');
    const y0 = p.y;
    step(p, 0, 0, dt);
    t.ok(p.vy < -200 && p.y < y0, '卡片停下：金粉帶著慣性繼續往上（vy ' + p.vy.toFixed(0) + '）');
    for (let i = 0; i < 240; i++) step(p, 0, 0, dt);           /* 再 4 秒 */
    t.ok(p.vy < 0 && p.vy > -40, '靜止的空氣：慢慢往上飄（vy ' + p.vy.toFixed(1) + '）');
    const q = { x: 0, y: 0, vx: 0, vy: 0, t: 0, ph: 0 };
    for (let i = 0; i < 18; i++) step(q, 0, 600, dt);
    t.ok(q.vy > 300 && q.y > 40, '往下捲：金粉跟著往下（vy ' + q.vy.toFixed(0) + '）');
  });

  /* 審查 11：render 是純函式（契約 §3.1）；走路抵達的抽卡在 mount 做；重進、重整都不重抽 */
  t.test('render 不寫 store：/unlock 在 mount 才抽；重進、重整都是同一款', async function (app) {
    await app.reset();
    const A = app.APP;
    const before = JSON.stringify(A.store.all);
    let writes = 0;
    const off = A.on('store:change', function () { writes++; });
    const html = A.views.unlock.render({ id: 'glass-kiln' }, { query: new app.win.URLSearchParams(''), store: A.store });
    off();
    t.eq(writes, 0, 'render 沒有 store:change');
    t.eq(JSON.stringify(A.store.all), before, 'render 沒有改 store');
    t.ok(html.indexOf('data-style=') < 0, '還沒抽：沒有款式');
    t.ok(html.indexOf('ex-flip__back') >= 0, '還沒抽：畫卡背');
    await app.go('/unlock/glass-kiln');
    const k = (A.store.get('draws') || {})['glass-kiln'];
    t.ok(!!k, 'mount 抽了一款：' + k);
    t.eq(app.$('[data-unlock]').getAttribute('data-style'), k, '畫面是抽到的那一款');
    t.eq(app.$('[data-final-card]').getAttribute('data-style'), k, '卡面也是');
    t.ok(app.$('[data-draw="' + k + '"]'), '結果寫出畫風名');
    const arts = app.$$('[data-unlock] [data-art]');
    t.ok(arts.length > 0 && arts.every(function (el) { return el.querySelector(':scope > .postcard__art'); }), '重畫之後插圖照樣畫上去');
    t.noDeadButtons(app, '/unlock 抽完重畫之後');
    await app.go('/album');
    await app.go('/unlock/glass-kiln');
    t.eq(app.$('[data-unlock]').getAttribute('data-style'), k, '重進不重抽');
    await app.reload('/unlock/glass-kiln');
    t.eq((app.APP.store.get('draws') || {})['glass-kiln'], k, '重整不重抽（store）');
    t.eq(app.$('[data-unlock]').getAttribute('data-style'), k, '重整不重抽（畫面）');
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
      const ph = d ? app.APP.explore.cardPhoto(id) : null;
      if (src) {
        t.ok(gen && gen.getAttribute('src') === src, id + ' 疊上 ' + d.key);
      } else if (ph) {
        /* 還沒生成成品：跟 /unlock 的卡面一樣，底圖照片＋那一款的濾鏡（以前不疊，收藏裡變回插圖） */
        t.ok(gen && gen.classList.contains('card-gen--photo') && gen.getAttribute('src').endsWith(ph.file) &&
          gen.getAttribute('data-style') === d.key, id + ' 還沒生成成品：照片＋' + d.key + ' 濾鏡');
      } else {
        t.ok(!gen, id + ' 還沒收：不疊');
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
    t.eq(T.helpers.collect(app, 'moat'), true, '第一次 true');
    t.eq(T.helpers.collect(app, 'moat'), false, '第二次 false');
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

  /* ============================================================ 回歸測試（從 flows.spec 搬來）
     code review 與亂按 QA 找到的 bug，一條 bug 一條 test；只牽涉這個區塊的放這裡，名稱保留審查／QA／評估的編號
     （對得上 docs/WORKLOG.md 與 flows.spec 裡跨區塊的那幾條）。 */
  function now() { return new Date().toISOString(); }

  t.test('視覺 4：/explore/map 任兩顆景點縮圖重疊 < 30%', async function (app) {
    await app.reset();
    await app.go('/explore/map');
    await app.tick(60);
    const rs = app.$$('main.view .spot').map(function (el) { return el.getBoundingClientRect(); });
    t.ok(rs.length >= 8, '景點數 ' + rs.length);
    const bad = [];
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], b = rs[j];
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w <= 0 || h <= 0) continue;
      const f = (w * h) / Math.min(a.width * a.height, b.width * b.height);
      if (f >= 0.3) bad.push(i + '×' + j + '=' + Math.round(f * 100) + '%');
    }
    t.eq(bad.length, 0, '重疊 ≥ 30%：' + bad.join('、'));
    /* 推開之後小卡還是點得到 */
    await app.click('.spot[data-spot="brick"]');
    t.eq(app.text('[data-peek-name]'), app.APP.place('brick').name, '點得到推開後的景點');
  });

  t.test('審查 3：/unlock/:id?ride=1 沒有「已抵達的這一趟」就不給限定版（不能手打網址拿 +50）', async function (app) {
    const cases = [
      { label: '沒有行程', store: {} },
      { label: '行程是別的地方', store: { trip: T.fixtures.trip({ placeId: 'lake', phase: 'done', startedAt: now(), rated: true, km: 6.4 }) }, keep: true },
      { label: '這一趟還沒抵達', store: { trip: T.fixtures.trip({ startedAt: now() }) } },
    ];
    for (const c of cases) {
      /* 走路抽卡有極低機率抽到金框：先把這次抵達的抽卡定成水彩，這條只驗「不是 ride 版」 */
      await app.reset({ store: Object.assign({ draws: { neiwan: 'watercolor' } }, c.store) });
      const pts0 = app.STATE.points;
      await app.go('/unlock/neiwan?ride=1');
      t.ok(!app.$('[data-final-card].postcard--gold'), c.label + '：沒有金框');
      t.ok(!app.$('[data-gold-note]'), c.label + '：沒有司機同行紀念／+50');
      t.ok(!app.$('[data-unlock][data-ride]'), c.label + '：不是 ride 版');
      await app.click('[data-act="collect"]');
      await app.at('/album');
      t.eq(app.STATE.card('p9') && app.STATE.card('p9').by, 'walk', c.label + '：by walk');
      t.eq(app.STATE.points, pts0, c.label + '：點數不變');
      if (c.keep) t.ok(app.APP.store.get('trip') && app.APP.store.get('trip').placeId === 'lake', c.label + '：別的行程不被清掉');
    }
    /* 對照組：真的抵達的那一趟照樣是限定版 */
    await app.reset({ store: { trip: T.fixtures.trip({ phase: 'done', startedAt: now(), rated: true }) } });
    await app.go('/unlock/neiwan?ride=1');
    t.ok(app.$('[data-final-card].postcard--gold'), '已抵達的這一趟：金框');
    await app.reset();
  }, { timeout: 15000 });

  t.test('QA 1：/place/neiwan 同一頁的分鐘數、公里數只有一種，而且等於公式', async function (app) {
    await app.reset();
    const A = app.APP, F = A.fmt;
    const P = A.place('neiwan');
    const km = F.km(P.dist);
    await app.go('/place/neiwan');
    const txt = app.text('main.view[data-view]');
    const mins = (txt.match(/(\d+)\s*分鐘/g) || []).map(function (x) { return x.replace(/\D/g, ''); });
    const kms = (txt.match(/(\d+(?:\.\d+)?)\s*公里/g) || []).map(function (x) { return Number(x.replace(/[^\d.]/g, '')); });
    t.ok(mins.length >= 2, '頁面上有「N 分鐘」：' + mins.join(','));
    t.eq(Array.from(new Set(mins)).join(','), String(F.rideMin(km)), '分鐘只有一種＝rideMin(km)');
    t.ok(kms.length >= 1 && kms.every(function (k) { return k === km; }), '公里都＝fmt.km(dist)：' + kms.join(','));
    t.ok(txt.indexOf('搭車 42 分鐘') < 0, 'MOCK 手寫的 42 分鐘不見了');
  });

  t.test('QA 4b：行程進行中 /going/:id 顯示「你正在搭車前往」＋回到行程', async function (app) {
    await app.reset({ store: { trip: T.fixtures.trip({ placeId: 'lake', startedAt: now(), km: 6.4 }) } });
    await app.go('/going/glass-kiln');
    t.ok(app.$('[data-going-trip]'), '搭車中的卡');
    t.includes(app.text('main.view[data-view]'), '你正在搭車前往 ' + app.APP.place('lake').name, '目的地是這一趟的');
    t.ok(!app.$('main.view [data-going-map]'), '不畫前往中地圖');
    t.ok(!app.$('main.view [data-act="arrive"]'), '沒有走路的模擬抵達');
    t.noDeadButtons(app, '/going（行程中）');
    t.noBannedWords(app, { msg: '/going（行程中）' });
    await app.click('main.view [data-act="go-trip"]');
    await app.at('/trip');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
  });

  t.test('QA 6：已收藏的地方頁不再推薦、寫清楚怎麼收的', async function (app) {
    await app.reset();
    for (const id of ['station', 'p1', 'market', 'harbour']) {
      await app.go('/place/' + id);
      const P = app.APP.place(id);
      const c = app.STATE.card(P.card);
      t.ok(!app.$('main.view .why'), id + '：沒有「為什麼推薦給你」');
      const txt = app.text('main.view[data-view]');
      t.ok(txt.indexOf('你從沒進去過') < 0 && txt.indexOf('圖鑑裡還沒有') < 0, id + '：沒有通用佔位句');
      t.eq(app.text('[data-got-line]'), '已收藏 · ' + c.date + ' · ' + (c.by === 'ride' ? '搭車抵達' : '走路抵達'), id + '：已收藏那一行');
      t.ok(app.$('[data-place-foot] [data-act="open-postcard"]'), id + '：看明信片');
    }
    await app.go('/place/lake');
    t.ok(app.$('main.view .why'), '沒收過的地方照樣有推薦理由');
  });

  t.test('QA 7：不屬於任何路線的地方，次鈕寫「看這個月的路線」', async function (app) {
    await app.reset();
    for (const id of ['hill', 'lake']) {
      await app.go('/place/' + id);
      const b = app.$('[data-place-foot] [data-act="open-route"]');
      t.eq(b && b.textContent.trim(), '看這個月的路線', id + ' 文字');
      t.eq(b && b.getAttribute('href'), '#/routes', id + ' → /routes');
    }
    await app.go('/place/neiwan');
    const n = app.$('[data-place-foot] [data-act="open-route"]');
    t.eq(n && n.textContent.trim(), '先看看路線', '有路線的照舊');
  });

  t.test('QA 8：減少動態效果（APP.reduceMotion）時解鎖直接第三幕', async function (app) {
    await app.reset();
    t.eq(app.APP.reduceMotion(), true, 'still 模式 reduceMotion() 為 true');
    await app.reset({ still: false });
    t.eq(app.APP.reduceMotion(), false, '一般模式為 false');
    app.win.matchMedia = function (q) { return { matches: /reduce/.test(q), media: q, addListener: function () {}, removeListener: function () {} }; };
    t.eq(app.APP.reduceMotion(), true, '系統要求減少動態效果 → true');
    await app.go('/unlock/moat');
    t.eq(app.$('[data-unlock]').getAttribute('data-at'), '3', '/unlock 直接第三幕');
    await app.reset();
  });
});
