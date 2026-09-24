/* ==========================================================================
   flows.spec — QA-flows：把四個區塊縫成一個走得完一圈的 app
   1. 三條 demo 流程端到端（prototype/js/catalog.js 的 FLOWS：每一步「要講的那句話」就是驗收條件）
      A 不搭車的日常、B 搭車的轉換、C 晚上的回顧（C 在非 still 模式跑：動畫與計時器照真的走）。
      一律從 app.reset() 開始、用 app.click 真的按；只有推播用 APP.ui.push 觸發（demo 工具的職責）。
   2. 縫合：叫車小卡→地方→返回、E 小卡走 APP.ride.setDropoff、深連結重整、tab 記憶、
      非 still 模式每條 route 無例外、連點不重複寫入、APP.ride.arrive() 在 /trip 之外。
   3. 全站掃描：§8 每條 route × 兩種狀態（初始／收了 3 張＋有下車點＋有行程）。
   ========================================================================== */
T.spec('flows', function (t) {

  /* ------------------------------------------------------------ 小工具 */
  function now() { return new Date().toISOString(); }

  function toastText(app) {
    return app.$$('.device .toast').map(function (x) { return x.textContent; }).join('｜');
  }

  /* 目前畫面裡看得到的返回鍵（<a data-back>） */
  async function clickBack(app) {
    await app.click('main.view[data-view] a[data-back]');
  }

  /* 流程 A 的前半：探索 → 今天的地方 → 走路前往 → 模擬抵達（demo 面板）→ 解鎖 → 收下。
     C 會先走一次；still 與非 still 都能跑（非 still 時解鎖點一下畫面跳到成品）。 */
  async function walkAndCollect(app, note) {
    const A = app.APP;
    const T0 = app.MOCK.TODAY;
    await app.at('/explore');
    await app.click('main.view .ex-cta [data-act="open-place"]');
    await app.at('/place/' + T0.id);
    const main = app.$('[data-place-foot] .btn-primary');
    t.eq(main && main.getAttribute('data-act'), 'go-walk', '地方詳情：走得到 → 主要動作是走路前往');
    await app.click('[data-place-foot] [data-act="go-walk"]');
    await app.at('/going/' + T0.id);
    /* demo 面板的模擬抵達：只在前往中亮 */
    const pa = app.$('#demo-panel [data-act="arrive"]');
    t.ok(pa && !pa.disabled, 'demo 面板的模擬抵達在前往中可以按');
    await app.click('#demo-panel [data-act="arrive"]');
    await app.at('/unlock/' + T0.id);
    t.eq(A.store.get('arrivedDemo'), T0.id, 'demo 面板寫了 store.arrivedDemo');
    if (!app.still) {
      t.eq(app.$('[data-unlock]').getAttribute('data-at'), '1', '非 still：從第一幕開始');
      await app.click('[data-unlock]');            /* 點畫面任意處 → 成品 */
    }
    await app.waitFor(function () { return app.$('[data-unlock]').getAttribute('data-at') === '3'; }, 2000, '第三幕');
    const inp = app.$('[data-one-line]');
    inp.value = note;
    await app.click('[data-act="collect"]');
    await app.at('/album');
    t.eq(A.store.get('arrivedDemo'), null, '收下之後 arrivedDemo 清掉');
  }

  /* ============================================================ 1. 三條流程 */

  t.test('流程 A：早上推播先到叫車卡片面板，舊探索流程仍可走到收藏', async function (app) {
    await app.reset();
    const A = app.APP, S = app.STATE;
    const T0 = app.MOCK.TODAY;
    const card = A.place(T0.id).card;
    const n0 = S.count();
    const b0 = S.badge('b5');
    t.eq(n0, 8, '初始 8 張');
    t.ok(b0.ids.indexOf(card) >= 0, '今天的地方屬於〈' + b0.name + '〉');
    t.eq(app.$$('#tabbar [data-tab-id]').length, 2, '底欄兩個入口');

    A.ui.push({ when: 'am' });
    const push = app.$('.device > .pushmock[data-push="am"]');
    t.ok(push, '早上推播浮層');
    t.includes(push && push.textContent, T0.name, '推播寫今天的地方');
    await app.click('.pushmock [data-act="open-push"]');
    await app.at('/ride');
    t.eq(app.route().query.get('area'), T0.id, '推播選定今天的地方');
    await app.click('[data-act="expand-cards"]');
    t.ok(app.$('[data-area-expanded] [data-card="p11"]'), '上拉看到今天的卡片');
    t.ok(!app.$('.device > .pushmock'), '點了推播浮層就收掉');
    /* 為什麼推薦給你：依據條數＝MOCK */
    await app.go('/explore');
    await app.click('[data-act="toggle-why"]');
    t.eq(app.$$('[data-why-list] .why__item').length, (T0.why || []).length, '推薦依據條數');

    await walkAndCollect(app, '窯的牆還是溫的');

    t.ok(app.$('main.view .postcard__new'), '/album 有「新」角標');
    t.eq(S.count(), n0 + 1, 'STATE.count() 8 → 9');
    t.eq(S.card(card) && S.card(card).note, '窯的牆還是溫的', 'card.note 是那句話');
    t.eq(S.card(card) && S.card(card).by, 'walk', 'by walk');
    t.eq(app.text('[data-stat="places"]'), String(n0 + 1), '統計「去過的地方」+1');
    t.ok(!app.$('#tabbar .tabbar__dot'), '底欄沒有提示小圓點');
    const b1 = S.badge('b5');
    t.eq(b1.done, b0.done + 1, '〈' + b0.name + '〉收集 +1');
    t.eq(app.text('[data-badge="b5"] .badge__prog'), '收集 ' + b1.done + '/' + b1.total, '勳章牆「收集 n/m」');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
  }, { timeout: 15000 });

  t.test('流程 B 搭車的轉換：路線 → 內灣斷點 → 叫車 → 行程 → 評分 → 限定版 → 點數', async function (app) {
    await app.reset();
    const A = app.APP, S = app.STATE;
    const F = A.fmt;
    const P = A.place('neiwan');
    const km = F.km(P.dist);
    const pts0 = S.points;
    const rows0 = A.ride.pointsRows();

    await app.go('/explore');
    await app.click('main.view [data-act="open-routes"]');
    await app.at('/routes');
    await app.click('[data-route-id="rail"]');
    await app.at('/route/rail');
    const bp = app.$('[data-breakpoint]');
    t.eq(bp && bp.getAttribute('data-breakpoint'), 'neiwan', '斷點是內灣');
    await app.click('[data-breakpoint] [data-act="set-dropoff"]');
    await app.at('/ride');

    const d = A.store.get('dropoff');
    t.eq(d && d.id, 'neiwan', 'store.dropoff.id');
    t.eq(d && d.via, 'route', 'via route');
    t.eq(app.text('[data-drop-name]'), P.name, '下車點欄位填好');
    t.eq(app.text('[data-fare]'), String(F.fare(km)), '[data-fare]＝fmt.fare(fmt.km(dist))');
    t.eq(app.text('[data-min]'), String(F.rideMin(km)), '[data-min]＝fmt.rideMin');
    const call = app.$('[data-act="call-ride"]');
    t.ok(call && call.classList.contains('is-ready'), '叫車鈕 is-ready');

    await app.click('[data-act="call-ride"]');
    await app.at('/trip');
    await app.waitFor(function () { const x = A.store.get('trip'); return x && x.phase === 'riding'; }, 3000, '配對 → 行程中');
    t.ok(!app.$('[data-phase="riding"]').hidden, '行程中區塊顯示');
    t.ok(app.$('[data-story]').hidden, '「這條路上」預設收著');
    await app.click('[data-act="toggle-story"]');
    const story = app.$('[data-story]');
    t.ok(story && !story.hidden, '「這條路上」展開');
    t.ok(story && story.querySelectorAll('.story__text').length > 0 && app.text('[data-story]').length > 20, '「這條路上」有內容');

    await app.click('main.view [data-act="arrive"]');
    await app.at('/trip/done');
    t.eq(A.store.get('trip').phase, 'done', 'trip.phase=done');
    t.ok(app.$('[data-gold]').hidden, '評分前沒有金色橫幅');
    await app.click('[data-act="rate"][data-star="5"]');
    t.ok(!app.$('[data-gold]').hidden, '評分後出現金色橫幅');
    await app.click('.banner--gold');
    await app.at('/unlock/neiwan');
    t.eq(app.route().query.get('ride'), '1', '?ride=1');
    t.ok(A.store.get('trip'), '到解鎖頁時 trip 還在（沒有在 /ride 被中途清掉）');
    t.ok(app.$('[data-final-card].postcard--gold'), '金框');
    t.includes(app.text('.postcard__ribbon'), 'yoxi 限定版', '限定版角標');
    t.includes(app.text('main.view[data-view]'), '司機同行紀念', '司機同行紀念');
    t.includes(app.text('.unlock__sub'), String(km), '抵達文案用 trip.km');

    await app.click('[data-act="collect"]');
    await app.at('/album');
    const c = S.card('p9');
    t.eq(c && c.by, 'ride', "STATE.card('p9').by === 'ride'");
    t.eq(S.points, pts0 + 50, 'STATE.points +50');
    t.eq(A.store.get('trip'), null, 'store.trip === null');
    t.eq(A.store.get('dropoff'), null, 'store.dropoff === null');

    /* 回叫車：不會 toast「限定明信片還在收藏等你」 */
    await app.click('#tabbar [data-tab-id="ride"]');
    await app.at('/ride');
    t.ok(toastText(app).indexOf('限定明信片還在收藏等你') < 0, '/ride 再進不會 toast 限定明信片（' + toastText(app) + '）');
    t.ok(!app.$('[data-drop-name]'), '下車點已清空');

    /* 點數：抽屜 → 和泰 Points */
    await app.click('[data-act="open-drawer"]');
    await app.at('/drawer');
    await app.click('[data-act="open-points"]');
    await app.at('/points');
    const rows = app.$$('[data-points-row]');
    const sum = rows.reduce(function (s, r) { return s + Number(r.querySelector('[data-amt]').getAttribute('data-amt')); }, 0);
    t.ok(rows.length > rows0.length, '明細多了列：' + rows0.length + ' → ' + rows.length);
    t.eq(app.$$('[data-points-row][data-city="1"]').length, rows0.filter(function (r) { return r.city; }).length + 1, '城事解鎖回饋 +1 列');
    t.eq(app.text('[data-points-total]'), String(sum), '總數＝明細相加');
    t.includes(app.text('[data-points-rows]'), P.name.split('老街')[0], '明細裡有這一趟');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
  }, { timeout: 20000 });

  t.test('流程 C 晚上的回顧（非 still）：收一張 → 晚上推播 → 四幕 → 日誌 → 這一週 → 長輩圖', async function (app) {
    await app.reset({ still: false });
    const A = app.APP, S = app.STATE;
    t.ok(!app.doc.documentElement.hasAttribute('data-still'), '非 still 模式');
    await app.go('/explore');
    await walkAndCollect(app, '今天光很好');
    const last = app.MOCK.POSTCARDS.filter(function (p) { return p.id === S.all.lastCard; })[0];
    t.ok(last, 'lastCard 是剛收的那張');

    A.ui.push({ when: 'pm' });
    t.ok(app.$('.device > .pushmock[data-push="pm"]'), '晚上推播浮層');
    await app.click('.pushmock [data-act="open-push"]');
    await app.at('/lookback');
    const lb = function () { return app.$('[data-lb]').getAttribute('data-lb-at'); };
    t.eq(lb(), '0', '第一幕：步數');
    t.includes(app.text('[data-lb-act="0"]'), A.fmt.num(app.MOCK.LOOKBACK.steps), '步數＝LOOKBACK.steps');
    await app.click('[data-act="next"]');
    t.eq(lb(), '1', '第二幕');
    t.includes(app.text('[data-lb-act="1"]'), last && last.name, '第二幕是剛收的那張');
    await app.click('[data-act="next"]');
    t.eq(lb(), '2', '第三幕：照片');
    await app.click('[data-act="photo"][data-photo="1"]');
    t.eq(lb(), '3', '第四幕：心情');
    t.ok(!app.$('main.view[data-view] [data-act="share"]'), '回顧沒有分享鍵');
    await app.click('[data-act="mood"][data-mood="good"]');
    await app.at('/album');
    t.eq(app.route().path, '/album', '回到收藏');
    t.eq(S.all.today.mood, 'good', 'STATE.today.mood');
    t.eq(S.all.today.photo, 1, 'STATE.today.photo');
    t.ok(!app.$('main.view[data-view] [data-act="share"]'), '收藏主頁沒有分享鈕');
    await app.go('/week');
    await app.at('/week');
    await app.click('main.view [data-act="share"]');
    const first = app.$('.device > .sys-share .row-nav');
    t.eq(first && first.getAttribute('data-act'), 'share-family', '分享面板第一格是傳給家人');
    await app.click('.sys-share [data-act="share-family"]');
    await app.at('/elder');
    await app.click('[data-act="send-family"]');
    t.includes(toastText(app), '已傳給家人', '傳給家人 toast');
    await clickBack(app);
    await app.at('/week');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
  }, { timeout: 25000 });

  t.test('流程 B′：評分後按「回首頁」→ /ride 金色入口 → 解鎖收卡 → 入口消失', async function (app) {
    await app.reset({ store: { dropoff: { id: 'neiwan', name: '內灣老街', km: 28, setAt: now(), via: 'route' } } });
    const A = app.APP, S = app.STATE;
    const pts0 = S.points;
    await app.go('/ride');
    await app.click('[data-act="call-ride"]');
    await app.at('/trip');
    await app.click('main.view [data-act="arrive"]');
    await app.at('/trip/done');
    await app.click('[data-act="rate"][data-star="4"]');
    await app.click('[data-act="go-home"]');
    await app.at('/ride');
    t.ok(A.store.get('trip') && A.store.get('trip').phase === 'done', '回首頁後 trip 還在');
    t.ok(toastText(app).indexOf('限定明信片還在收藏等你') < 0, '不再 toast');
    const u = app.$('main.view [data-act="unlock-ride"]');
    t.ok(u, '/ride 有 [data-act=unlock-ride]');
    t.ok(u && !u.closest('[data-expand-only]') && u.getBoundingClientRect().height > 0, '收合態看得到入口');
    t.includes(u && u.getAttribute('href'), '/unlock/neiwan?ride=1', 'href 含 ?ride=1');
    t.ok(t.countTappables(app) <= 10, '/ride 可按數 ' + t.countTappables(app) + ' ≤ 10');
    t.noDeadButtons(app, '/ride 金色入口');
    /* 收藏那一側也有入口 */
    await app.go('/postcard/p9');
    const pu = app.$('main.view [data-act="unlock-ride"]');
    t.includes(pu && pu.getAttribute('href'), '/unlock/neiwan?ride=1', '/postcard/p9 有「解鎖限定版」');
    t.ok(t.countTappables(app) <= 10, '/postcard/p9 可按數 ' + t.countTappables(app) + ' ≤ 10');
    await app.go('/ride');
    await app.click('main.view [data-act="unlock-ride"]');
    await app.at('/unlock/neiwan');
    t.ok(app.$('[data-final-card].postcard--gold'), '金框限定版');
    await app.click('[data-act="collect"]');
    await app.at('/album');
    t.eq(S.card('p9') && S.card('p9').by, 'ride', 'by ride');
    t.eq(S.points, pts0 + 50, 'points +50');
    t.eq(A.store.get('trip'), null, 'store.trip === null');
    await app.click('#tabbar [data-tab-id="ride"]');
    await app.at('/ride');
    t.ok(!app.$('[data-act="unlock-ride"]'), '回 /ride 入口消失');
    await app.go('/postcard/p9');
    t.ok(!app.$('[data-act="unlock-ride"]'), '明信片頁的入口也消失');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
  }, { timeout: 20000 });

  t.test('限定版還沒收時叫車：先問一次 —— 先去解鎖／直接叫車兩條路', async function (app) {
    const done = { placeId: 'neiwan', phase: 'done', startedAt: now(), rated: true, km: 28 };
    const drop = { id: 'lake', name: '青草湖的舊戲院地基', km: 6.4, setAt: now(), via: 'e' };

    /* 先去解鎖：不建新 trip，到 /unlock/neiwan?ride=1 */
    await app.reset({ store: { trip: done, dropoff: drop } });
    let A = app.APP;
    await app.go('/ride');
    await app.click('[data-act="call-ride"]');
    const modal = app.$('.app-confirm');
    t.includes(modal && modal.textContent, '上一趟的限定明信片還沒收', 'confirm 文案');
    await app.click('.app-confirm [data-act="confirm-yes"]');
    await app.at('/unlock/neiwan');
    t.eq(app.route().query.get('ride'), '1', '?ride=1');
    t.eq(A.store.get('trip').placeId, 'neiwan', '沒有建新 trip');
    t.eq(A.store.get('trip').phase, 'done', '舊 trip 還是 done');

    /* 直接叫車：新 trip 覆蓋舊的 */
    await app.reset({ store: { trip: done, dropoff: drop } });
    A = app.APP;
    await app.go('/ride');
    await app.click('[data-act="call-ride"]');
    await app.click('.app-confirm [data-act="confirm-no"]');
    await app.at('/trip');
    t.eq(A.store.get('trip').placeId, 'lake', '新 trip 覆蓋');
    t.ok(!A.ride.pendingUnlock(), '覆蓋後沒有待解鎖');

    /* 沒有待解鎖：不問 */
    await app.reset({ store: { dropoff: drop } });
    await app.go('/ride');
    await app.click('[data-act="call-ride"]');
    await app.at('/trip');
    t.ok(!app.$('.app-confirm'), '沒有待解鎖就不問');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
  });

  /* ============================================================ QA-visual 的四項 */

  t.test('視覺 1／2：/going 按鈕文案與收藏頁獎章數字', async function (app) {
    await app.reset();
    await app.go('/going/glass-kiln');
    const b = app.$('main.view [data-act="arrive"]');
    t.eq(b && b.textContent.trim(), '模擬抵達', '/going 按鈕文字與 /trip 一致');
    await app.go('/album');
    t.eq(app.text('.alb-v2__section--badges h2'), '獎章', '獎章區標題');
    const bc = app.MOCK.BADGES.filter(function (x) { return app.STATE.badge(x.id).got; }).length;
    t.eq(app.text('[data-stat="badges"]'), bc + '/' + app.MOCK.BADGES.length, '第三格數字仍是 n/m');
  });

  t.test('視覺 3：/footprint 覆蓋率用固定範圍算，平移地圖後不變', async function (app) {
    await app.reset();
    await app.go('/footprint');
    const c0 = app.text('[data-coverage]');
    t.eq(c0, String(app.APP.album.coverage()), '覆蓋率＝固定範圍公式');
    const map = app.$('main.view .map[data-pan]');
    const W = app.win;
    const r = map.getBoundingClientRect();
    const ev = function (type, x, y) { return new W.PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }); };
    map.dispatchEvent(ev('pointerdown', r.left + 150, r.top + 300));
    W.dispatchEvent(ev('pointermove', r.left + 190, r.top + 330));
    W.dispatchEvent(ev('pointerup', r.left + 190, r.top + 330));
    const layer = app.$('main.view .map__pan');
    t.ok(layer && /translate/.test(layer.style.transform), '地圖真的平移了：' + (layer && layer.style.transform));
    await app.tick(60);
    t.eq(app.text('[data-coverage]'), c0, '平移後覆蓋率不變');
    /* 換版面（iframe 變窄）重畫也不變 */
    const fr = app.win.frameElement;
    const w0 = fr.style.width;
    fr.style.width = '340px';
    await app.go('/album');
    await app.go('/footprint');
    t.eq(app.text('[data-coverage]'), c0, '版面寬度改變後覆蓋率不變');
    fr.style.width = w0;
  });

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

  /* ============================================================ 2. 縫合 */

  t.test('縫合 a：/ride 選景點 → 上拉看卡片 → 下拉收合', async function (app) {
    await app.reset();
    await app.go('/ride?mode=explore');
    t.ok(app.$('.ride-sheet.is-collapsed'), '一開始收合');
    await app.click('.spot[data-spot="moat"]');
    t.eq(app.route().query.get('area'), 'moat', '選的是護城河');
    const p = app.APP.place('moat');
    t.includes(app.text('[data-area-intro]'), app.APP.fmt.dist(p.dist), '面板距離＝APP.place().dist');
    await app.click('[data-act="expand-cards"]');
    t.ok(!app.$('.ride-sheet.is-collapsed'), '面板展開');
    t.eq(app.$$('[data-area-expanded] [data-card]').length, 2, '護城河兩張卡');
    const grip = app.$('.ride-sheet .sheet__grip'), W = app.win, box = grip.getBoundingClientRect();
    grip.dispatchEvent(new W.PointerEvent('pointerdown', { bubbles: true, clientY: box.top + 10, pointerId: 1 }));
    W.dispatchEvent(new W.PointerEvent('pointermove', { bubbles: true, clientY: box.top + 90, pointerId: 1 }));
    W.dispatchEvent(new W.PointerEvent('pointerup', { bubbles: true, clientY: box.top + 90, pointerId: 1 }));
    t.ok(app.$('.ride-sheet.is-collapsed'), '向下拉回收合態');
    t.eq(app.route().query.get('mode'), 'explore', '下拉後留在探索');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
  });

  t.test('縫合 b：/explore/map 走不到的小卡「設為下車點」走 APP.ride.setDropoff，結果與 K1 相同', async function (app) {
    await app.reset();
    const A = app.APP;
    const calls = [];
    const orig = A.ride.setDropoff;
    A.ride.setDropoff = function (id, via) { calls.push([id, via]); return orig.apply(this, arguments); };
    await app.go('/explore/map');
    await app.click('.spot[data-spot="lake"]');
    const p = A.place('lake');
    t.includes(app.text('[data-peek-meta]'), app.APP.fmt.dist(p.dist).split(' ')[0], '小卡距離＝APP.place().dist');
    await app.click('.ex-peek [data-act="set-dropoff"]');
    await app.at('/ride');
    t.eq(calls.length, 1, '呼叫 APP.ride.setDropoff 一次');
    t.eq(calls[0] && calls[0].join(','), 'lake,e', "setDropoff('lake','e')");
    const e = A.store.get('dropoff');
    const fareE = app.text('[data-fare]');

    await app.go('/place/lake');
    await app.click('[data-place-foot] [data-act="set-dropoff"]');
    await app.at('/ride');
    t.eq(calls.length, 2, 'K1 也走 APP.ride.setDropoff');
    const k = A.store.get('dropoff');
    t.eq(k && k.via, 'k1', 'K1 via k1');
    t.eq(JSON.stringify([e.id, e.name, e.km]), JSON.stringify([k.id, k.name, k.km]), 'E 與 K1 寫出同一個下車點');
    t.eq(app.text('[data-fare]'), fareE, '車資相同');
    A.ride.setDropoff = orig;
  });

  t.test('縫合 brick：新竹州廳的距離全 app 一致（APP.place().dist）', async function (app) {
    await app.reset();
    const A = app.APP;
    const d = A.fmt.dist(A.place('brick').dist);
    await app.go('/explore/map');
    await app.click('.spot[data-spot="brick"]');
    t.includes(app.text('[data-peek-meta]'), d.split(' ')[0], '探索地圖小卡 ' + d);
    await app.go('/dropoff');
    if (!app.$('[data-act="choose-dropoff"][data-id="brick"]') && app.$('[data-act="more-dropoff"]')) await app.click('[data-act="more-dropoff"]');
    const row = app.$('[data-act="choose-dropoff"][data-id="brick"]');
    t.includes(row && row.textContent, d, '下車地點清單 ' + d);
    await app.go('/place/brick');
    t.includes(app.text('[data-place-meta]'), d.split(' ')[0], '地方詳情 ' + d);
    A.ride.setDropoff('brick', 'e');
    await app.at('/ride');
    t.includes(app.text('[data-act="pick-dropoff"]'), d, '叫車首頁下車點 ' + d);
    t.eq(A.store.get('dropoff').km, A.fmt.km(A.place('brick').dist), 'dropoff.km 用同一個距離');
  });

  t.test('縫合 c：深連結重整 —— /trip 有行程不被導走；/trip/done 沒行程顯示空卡', async function (app) {
    await app.reset({ store: { trip: { placeId: 'neiwan', phase: 'riding', startedAt: now(), rated: false, km: 28 } }, hash: '/trip' });
    t.eq(app.route().path, '/trip', '停在 /trip');
    t.ok(!app.$('[data-phase="riding"]').hidden, '行程中區塊顯示');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));

    await app.reset({ hash: '/trip/done' });
    t.eq(app.route().path, '/trip/done', '停在 /trip/done');
    t.includes(app.text('main.view[data-view]'), '目前沒有行程', '顯示「目前沒有行程」');
    t.ok(!app.$('[data-app-error]'), '沒有錯誤卡');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));

    await app.reset({ hash: '/unlock/glass-kiln' });
    t.eq(app.route().path, '/unlock/glass-kiln', '深連結 /unlock 直接開');
    t.ok(app.$('[data-act="collect"]'), '可以收');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
  });

  t.test('縫合 d：雙主頁 tab 記憶選定地區，再按叫車回根', async function (app) {
    await app.reset();
    await app.click('[data-act="mode-explore"]');
    await app.click('.spot[data-spot="moat"]');
    t.eq(app.route().query.get('area'), 'moat', '網址記住護城河');
    await app.click('#tabbar [data-tab-id="album"]');
    await app.at('/album');
    await app.click('#tabbar [data-tab-id="ride"]');
    await app.at('/ride');
    t.eq(app.route().query.get('area'), 'moat', '切回叫車仍選著護城河');
    await app.click('#tabbar [data-tab-id="ride"]');
    t.eq(app.route().query.get('area'), null, '再按叫車回到根');
    t.eq(app.route().query.get('mode'), null, '回根是預設搭車');
  });

  t.test('縫合 e：非 still 模式每條 route 載入後 #app-errors 仍為空', async function (app) {
    await app.reset({ still: false });
    t.ok(!app.doc.documentElement.hasAttribute('data-still'), '非 still 模式');
    const list = sweepRoutes(app);
    const bad = [];
    for (let i = 0; i < list.length; i++) {
      await app.go(list[i].path, { redirectOk: true, ms: 5000 });
      /* 讓 mount 的 setTimeout 跑完：配對 1.2 s、解鎖三幕約 5 s、轉場 */
      await app.tick(/^\/unlock/.test(list[i].path) ? 5400 : /^\/trip/.test(list[i].path) ? 1500 : 400);
      const pre = app.doc.getElementById('app-errors');
      const txt = pre ? pre.textContent : '';
      if (txt || app.errors.length) bad.push(list[i].path + '：' + (txt || app.errors.join('；')).slice(0, 160));
    }
    /* 解鎖跑完三幕停在成品 */
    await app.go('/unlock/moat');
    await app.tick(5400);
    t.eq(app.$('[data-unlock]').getAttribute('data-at'), '3', '非 still：三幕自己跑到成品');
    /* 行程：配對 → 行程中由計時器切換 */
    await app.reset({ still: false, store: { dropoff: { id: 'lake', name: 'x', km: 6.4, setAt: now(), via: 'e' } } });
    await app.go('/ride');
    await app.click('[data-act="call-ride"]');
    await app.at('/trip');
    /* 不斷言「剛載入一定是 matching」：virtual time 下轉場＋畫地圖可能就吃掉 1.2 s（時間競賽）。
       phase 由 trip.startedAt 推導（APP.ride.phaseOf），這裡只要求：現在是配對中或行程中、畫面跟 phase 一致、最後會到行程中。
       「剛叫車是配對中、過了 MATCH_MS 才是行程中」由「審查 1」用注入的時間驗。 */
    const ph0 = app.APP.store.get('trip').phase;
    t.includes(['matching', 'riding'], ph0, '叫車後是配對中或行程中');
    t.eq(app.$('[data-phase="riding"]').hidden, ph0 === 'matching', '畫面跟 store 的 phase 一致');
    await app.waitFor(function () { return app.APP.store.get('trip').phase === 'riding'; }, 3000, '計時器切到行程中');
    t.ok(!app.$('[data-phase="riding"]').hidden, '行程中區塊顯示');
    t.eq(bad.length, 0, '有例外的 route：' + bad.join('｜'));
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
  }, { timeout: 120000 });

  t.test('縫合 f：連按兩次 set-dropoff／collect／call-ride 不重複寫入、不重複導覽、不丟例外', async function (app) {
    for (const still of [true, false]) {
      const tag = still ? '（still）' : '（非 still）';
      await app.reset({ still: still });
      const A = app.APP, S = app.STATE;
      let sets = 0;
      const off = A.on('store:change', function (e) { if (e && e.key === 'dropoff') sets++; });

      await app.go('/explore');
      await app.go('/place/lake');
      const b = app.$('[data-place-foot] [data-act="set-dropoff"]');
      b.click(); b.click();
      await app.at('/ride');
      await app.tick(400);
      t.eq(sets, 1, tag + 'set-dropoff 連按兩次只寫一次 dropoff');
      t.eq(A.store.get('dropoff').id, 'lake', tag + 'dropoff 是 lake');
      A.nav.back();
      await app.at('/place/lake');
      t.ok(true);

      await app.go('/ride');
      const call = app.$('[data-act="call-ride"]');
      call.click(); call.click();
      await app.at('/trip');
      await app.tick(400);
      A.nav.back();
      await app.at('/ride');
      A.store.set('trip', null);
      off();

      const n0 = S.count();
      await app.go('/unlock/glass-kiln');
      await app.click('[data-unlock]');
      const c = app.$('[data-act="collect"]');
      c.click(); c.click();
      await app.at('/album');
      await app.tick(400);
      t.eq(S.count(), n0 + 1, tag + 'collect 連按兩次只收一張');
      A.nav.back();
      await app.at('/unlock/glass-kiln');
      t.includes(app.text('main.view[data-view]'), '已在收藏裡', tag + 'collect 只推一筆 /album（返回回到解鎖頁）');
      t.eq(app.errors.length, 0, tag + '錯誤：' + app.errors.join('；'));
    }
  }, { timeout: 30000 });

  t.test('縫合 g：APP.ride.arrive() 在 /trip 之外呼叫', async function (app) {
    await app.reset();
    let A = app.APP;
    await app.go('/explore');
    t.ok(app.$('#demo-panel [data-act="arrive"]').disabled, '沒有前往或行程時 demo 面板的模擬抵達是灰的');
    t.eq(A.ride.arrive(), false, '沒有行程 → 回 false');
    await app.tick(40);
    t.eq(app.route().path, '/explore', '沒有行程不導走');
    t.includes(toastText(app), '目前沒有行程', 'toast 目前沒有行程');

    await app.reset({ store: { trip: { placeId: 'lake', phase: 'riding', startedAt: now(), rated: false, km: 6.4 },
                               dropoff: { id: 'lake', name: 'x', km: 6.4, setAt: now(), via: 'e' } } });
    A = app.APP;     /* 重載後 iframe 的 APP 換了一個 */
    await app.go('/explore');
    t.eq(A.ride.arrive(), true, '有行程 → 回 true');
    await app.at('/trip/done');
    t.eq(A.store.get('trip').phase, 'done', 'phase=done');
    t.eq(A.store.get('dropoff'), null, '下車點清掉');
    A.nav.back();
    await app.at('/explore');
    t.ok(true, '從別頁呼叫是 push，返回回到原頁');

    /* 設定頁的模擬抵達（手機的 demo 工具）：有行程 → 行程完成 */
    await app.reset({ store: { trip: { placeId: 'lake', phase: 'riding', startedAt: now(), rated: false, km: 6.4 } } });
    A = app.APP;
    await app.go('/settings');
    await app.click('[data-act="more"]');
    await app.click('main.view [data-act="arrive"]');
    await app.at('/trip/done');
    t.eq(A.store.get('trip').phase, 'done', '設定頁模擬抵達 → phase=done');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
  });

  t.test('縫合 h：interact 的 window listener 不會每次 mount 越積越多', async function (app) {
    await app.reset();
    const W = app.win;
    let live = 0;
    const add = W.addEventListener, rem = W.removeEventListener;
    const seen = new Set();
    W.addEventListener = function (type, fn, o) { if (/^pointer/.test(type) && !seen.has(fn)) { seen.add(fn); live++; } return add.call(this, type, fn, o); };
    W.removeEventListener = function (type, fn, o) { if (seen.has(fn)) { seen.delete(fn); live--; } return rem.call(this, type, fn, o); };
    try {
      await app.go('/explore');
      for (let i = 0; i < 4; i++) {
        await app.go('/ride');
        await app.go('/explore/map');
      }
      await app.go('/explore');
      t.eq(live, 0, '離開有 sheet／地圖的畫面之後，pointer listener 全數拆掉（剩 ' + live + '）');
      await app.go('/ride');
      t.ok(live > 0 && live <= 4, '/ride 上只有這一頁的 listener（' + live + '）');
    } finally {
      delete W.addEventListener; delete W.removeEventListener;
    }
  });

  /* ============================================================ 3. 全站掃描 */

  function sweepRoutes(app) {
    return [
      '/welcome', '/ride', '/dropoff', '/pickup', '/trip', '/trip/done', '/drawer', '/points', '/notify', '/trips',
      '/explore', '/explore/map', '/place/glass-kiln', '/place/neiwan', '/place/lake', '/place/brick',
      '/going/glass-kiln', '/going/lake', '/unlock/glass-kiln', '/unlock/neiwan?ride=1', '/unlock/lake?ride=1',
      '/routes', '/route/rail', '/route/glass', '/route/water',
      '/album', '/album?tab=badges', '/album?tab=journal', '/album?tab=week',
      '/postcard/p1', '/postcard/p9', '/postcard/p11', '/badge/b1', '/badge/b5',
      '/footprint', '/lookback', '/week', '/elder', '/settings',
    ].map(function (p) { return { path: p }; });
  }

  const TAP_MAX = { '/explore': 12, '/album': 12 };
  const BAD_TEXT = /undefined|NaN|null|\[object/;

  async function sweep(app, label) {
    const list = sweepRoutes(app);
    const probs = [];
    for (let i = 0; i < list.length; i++) {
      const path = list[i].path;
      const landed = await app.go(path, { redirectOk: true });
      await app.tick(60);
      const v = app.view();
      if (!v) { probs.push(path + '：沒有 main.view'); continue; }
      t.noDeadButtons(app, label + path);
      t.noBannedWords(app, { msg: label + path });
      const n = t.countTappables(app);
      const max = TAP_MAX[landed] || 10;
      if (n > max) probs.push(path + '：可按數 ' + n + ' > ' + max);
      if (app.errors.length) probs.push(path + '：' + app.errors.join('；').slice(0, 160));
      if (app.$('[data-app-error]')) probs.push(path + '：錯誤卡');
      if (v.getAttribute('data-view') === '_placeholder' || v.getAttribute('data-view') === '_404') probs.push(path + '：' + v.getAttribute('data-view'));
      const txt = v.textContent + ' ' + app.doc.title + ' ' +
        Array.prototype.map.call(v.querySelectorAll('[aria-label],[title],[placeholder],[href]'), function (el) {
          return [el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('placeholder'), el.getAttribute('href')].join(' ');
        }).join(' ');
      const m = txt.match(BAD_TEXT);
      if (m) {
        const k = txt.indexOf(m[0]);
        probs.push(path + '：文字出現「' + m[0] + '」…' + txt.slice(Math.max(0, k - 20), k + 20).replace(/\s+/g, ' ') + '…');
      }
    }
    t.eq(probs.length, 0, label + probs.join('｜'));
  }

  t.test('全站掃描：初始狀態', async function (app) {
    await app.reset();
    await sweep(app, '初始 ');
  }, { timeout: 30000 });

  t.test('全站掃描：收了 3 張、有下車點、有行程', async function (app) {
    await app.reset({ store: {
      dropoff: { id: 'brick', name: '新竹州廳', km: 2.4, setAt: now(), via: 'k1' },
      trip: { placeId: 'lake', phase: 'riding', startedAt: now(), rated: false, km: 6.4 },
    } });
    const A = app.APP;
    A.explore.collect('glass-kiln', { by: 'walk', note: '第一張' });
    A.explore.collect('moat', { by: 'walk' });
    A.explore.collect('neiwan', { by: 'ride', km: 28 });
    t.eq(app.STATE.count(), 11, '收了 3 張');
    t.ok(A.store.get('dropoff') && A.store.get('trip'), '下車點與行程都在');
    await sweep(app, '有狀態 ');
    t.ok(A.store.get('trip'), '掃完行程還在（沒有哪一頁偷清）');
  }, { timeout: 30000 });

  /* ============================================================ 4. 審查（code review 修掉的 bug：一條 bug 一條 test） */

  t.test('審查 1：trip 的 phase 由 startedAt 推導（注入時間，不靠 setTimeout 的時序）', async function (app) {
    await app.reset();
    const R = app.APP.ride;
    const t0 = Date.parse('2026-09-21T13:18:00.000Z');
    const trip = { placeId: 'lake', phase: 'matching', startedAt: new Date(t0).toISOString(), rated: false, km: 6.4 };
    t.eq(R.phaseOf(trip, t0), 'matching', '剛叫車：配對中');
    t.eq(R.phaseOf(trip, t0 + R.MATCH_MS - 1), 'matching', 'MATCH_MS 之前：配對中');
    t.eq(R.phaseOf(trip, t0 + R.MATCH_MS), 'riding', 'MATCH_MS 之後：行程中');
    t.eq(R.phaseOf(Object.assign({}, trip, { phase: 'done' }), t0), 'done', 'done 不受時間影響');
    t.eq(R.phaseOf(Object.assign({}, trip, { startedAt: 'x' }), t0), 'riding', '壞掉的 startedAt 不會永遠卡在配對中');
    t.eq(R.phaseOf(null), null, '沒有行程');

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
    await app.reset({ store: { trip: { placeId: 'lake', phase: 'riding', startedAt: now(), rated: false, km: 6.4 } } });
    await app.go('/trip/done');
    t.includes(app.text('main.view[data-view]'), '還在前往', '不是「目前沒有行程」');
    const back = app.$('main.view [data-act="go-trip"]');
    t.eq(back && back.getAttribute('href'), '#/trip', '回到行程 → #/trip');
    t.noDeadButtons(app, '/trip/done（riding）');
    t.noBannedWords(app, { msg: '/trip/done（riding）' });
    await app.click('main.view [data-act="go-trip"]');
    await app.at('/trip');

    await app.reset({ store: { trip: { placeId: 'lake', phase: 'done', startedAt: 'not-a-date', rated: true } } });
    await app.go('/trip/done');
    t.ok(!/NaN|undefined/.test(app.text('main.view[data-view]')), '沒有 NaN／undefined：' + app.text('.ride-done__meta'));
    t.eq(app.text('.ride-done__sum [data-fare]'), String(app.APP.fmt.fare(app.APP.fmt.km(app.APP.place('lake').dist))), '沒有 trip.km 時車資用 fmt.km(dist)');
  });

  t.test('審查 3：/unlock/:id?ride=1 沒有「已抵達的這一趟」就不給限定版（不能手打網址拿 +50）', async function (app) {
    const cases = [
      { label: '沒有行程', store: {} },
      { label: '行程是別的地方', store: { trip: { placeId: 'lake', phase: 'done', startedAt: now(), rated: true, km: 6.4 } }, keep: true },
      { label: '這一趟還沒抵達', store: { trip: { placeId: 'neiwan', phase: 'riding', startedAt: now(), rated: false, km: 28 } } },
    ];
    for (const c of cases) {
      await app.reset({ store: c.store });
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
    await app.reset({ store: { trip: { placeId: 'neiwan', phase: 'done', startedAt: now(), rated: true, km: 28 } } });
    await app.go('/unlock/neiwan?ride=1');
    t.ok(app.$('[data-final-card].postcard--gold'), '已抵達的這一趟：金框');
    await app.reset();
  }, { timeout: 15000 });

  t.test('審查 4：返回鍵連按兩下只退一格（不會多退、不會退出 app）', async function (app) {
    await app.reset();
    await app.go('/explore');
    await app.go('/place/glass-kiln');
    const b = app.$('main.view[data-view] a[data-back]');
    b.click(); b.click();
    await app.at('/explore');
    await app.tick(300);
    t.eq(app.route().path, '/explore', '停在 /explore（不是再退一格的 /ride）');
    /* 放開之後返回照常可用 */
    await app.go('/routes');
    app.APP.nav.back('/ride');
    await app.at('/explore');
  });

  t.test('審查 5：確認框同一時間只有一個；連按「取消行程」不會疊兩層', async function (app) {
    await app.reset({ store: { trip: { placeId: 'lake', phase: 'riding', startedAt: now(), rated: false, km: 6.4 } } });
    await app.go('/trip');
    const c = app.$('[data-act="cancel-trip"]');
    c.click(); c.click();
    await app.tick(30);
    t.eq(app.$$('.app-confirm').length, 1, '只有一個確認框');
    let second = 'pending';
    app.APP.ui.confirm({ text: 'x' }).then(function (v) { second = v; });
    await app.tick(30);
    t.eq(second, false, '已經開著時，新的 confirm 直接回 false');
    t.eq(app.$$('.app-confirm').length, 1, '還是一個');
    await app.click('.app-confirm [data-act="confirm-yes"]');
    await app.at('/ride');
    t.eq(app.APP.store.get('trip'), null, '取消一次');
    t.eq(app.$$('.app-confirm').length, 0, '確認框收掉');
  });

  t.test('審查 6：使用者輸入（明信片那一句話）與網址不會變成 HTML', async function (app) {
    await app.reset();
    const W = app.win;
    W.__xss = 0;
    const evil = '<img src=x onerror="window.__xss=1">"\'&';
    const injected = function () { return app.$$('main.view img[src="x"], main.view [onerror]').length; };
    await app.go('/unlock/glass-kiln');
    app.$('[data-one-line]').value = evil;
    await app.click('[data-act="collect"]');
    await app.at('/album');
    t.eq(app.STATE.card('p11') && app.STATE.card('p11').note, evil, 'note 原樣存下');
    const pages = ['/postcard/p11', '/album', '/album?tab=journal', '/album?tab=week', '/week', '/elder', '/lookback', '/badge/b5', '/trips', '/points'];
    for (const p of pages) {
      await app.go(p);
      await app.tick(20);
      t.eq(injected(), 0, p + '：沒有注入的元素');
    }
    await app.go('/postcard/p11');
    t.includes(app.text('.alb-big__note'), '<img src=x', '明信片背面把那句話當文字顯示');
    /* 網址：:id、未知 path、query 參數 */
    const x = '<img src=x onerror=window.__xss=1>';
    const bad = ['/place/' + encodeURIComponent(x), '/going/' + encodeURIComponent(x),
                 '/postcard/' + encodeURIComponent(x), '/badge/' + encodeURIComponent(x),
                 '/route/' + encodeURIComponent('">' + x), '/nope/' + x,
                 '/album?tab=' + encodeURIComponent('">' + x) + '&shelf=' + encodeURIComponent(x),
                 '/unlock/glass-kiln?ride=' + encodeURIComponent(x)];
    for (const p of bad) {
      await app.go(p, { redirectOk: true });
      await app.tick(20);
      t.eq(injected(), 0, p + '：沒有注入的元素');
      t.ok(app.view() && !app.$('[data-app-error]'), p + '：有畫面、沒有錯誤卡');
    }
    await app.tick(50);
    t.eq(W.__xss, 0, '沒有任何 onerror 被執行');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
    await app.reset();
  }, { timeout: 15000 });

  t.test('審查 7：id 是 Object 原型上的名字（constructor、toString）不會被當成今天的地方', async function (app) {
    await app.reset();
    ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf'].forEach(function (id) {
      t.eq(app.APP.place(id), null, "APP.place('" + id + "') → null");
    });
    t.eq(app.APP.place(null), null, 'APP.place(null) → null');
    t.eq(app.APP.place(undefined), null, 'APP.place(undefined) → null');
    await app.go('/place/constructor');
    t.ok(app.$('[data-ex-missing]'), '/place/constructor 顯示找不到');
    await app.go('/going/toString');
    t.ok(app.$('[data-ex-missing]'), '/going/toString 顯示找不到');
    await app.go('/unlock/constructor');
    t.ok(app.$('[data-ex-missing]') && !app.$('[data-act="collect"]'), '/unlock/constructor 不能收');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
  });

  t.test('審查 8：同一個地方的車資在地方詳情、下車點卡、行程中、行程結算、路線斷點相同', async function (app) {
    for (const id of ['neiwan', 'lake', 'hill']) {
      await app.reset();
      const A = app.APP, F = A.fmt;
      const want = String(F.fare(F.km(A.place(id).dist)));
      const seen = {};
      await app.go('/place/' + id);
      const m = (app.text('[data-place-foot] [data-act="set-dropoff"]') || '').match(/\$\s*(\d+)/);
      seen.place = m ? m[1] : null;
      await app.click('[data-place-foot] [data-act="set-dropoff"]');
      await app.at('/ride');
      seen.dropoff = app.text('[data-fare]');
      await app.click('[data-act="call-ride"]');
      await app.at('/trip');
      await app.waitFor(function () { return !app.$('[data-phase="riding"]').hidden; }, 3000, '行程中');
      seen.trip = app.text('[data-phase="riding"] [data-fare]');
      await app.click('main.view [data-act="arrive"]');
      await app.at('/trip/done');
      seen.done = app.text('.ride-done__sum [data-fare]');
      Object.keys(seen).forEach(function (k) { t.eq(seen[k], want, id + ' ' + k + ' 車資'); });
    }
    await app.reset();
    await app.go('/route/rail');
    const brk = app.APP.explore.breakpoint('rail');
    const bm = (app.text('[data-breakpoint] [data-act="set-dropoff"]') || '').match(/\$\s*(\d+)/);
    t.eq(bm && bm[1], String(app.APP.fmt.fare(app.APP.fmt.km(app.APP.place(brk.pid).dist))), '路線斷點車資＝地方詳情');
  }, { timeout: 20000 });

  /* ============================================================ 5. 亂按 QA 回報（一項一條） */

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

  t.test('QA 2：清除我的足跡真的清空；重設 demo 的文案寫清楚是回到初始', async function (app) {
    await app.reset({ store: { dropoff: { id: 'neiwan', name: '內灣', km: 28, setAt: now(), via: 'k1' },
                               trip: { placeId: 'lake', phase: 'riding', startedAt: now(), rated: false, km: 6.4 },
                               arrivedDemo: 'moat' } });
    await app.go('/settings');
    await app.click('[data-act="more"]');
    await app.click('[data-act="wipe"]');
    await app.click('[data-act="confirm-yes"]');
    const S = app.STATE, A = app.APP;
    t.eq(S.count(), 0, 'STATE.count() === 0');
    t.eq(S.points, 0, 'STATE.points === 0');
    t.eq(S.all.km, 0, 'km 0');
    t.eq(S.all.lastCard, null, 'lastCard null');
    t.eq(S.all.today.done, false, 'today 歸零');
    t.eq(A.store.get('dropoff'), null, 'dropoff 清掉');
    t.eq(A.store.get('trip'), null, 'trip 清掉');
    t.eq(A.store.get('arrivedDemo'), null, 'arrivedDemo 清掉');
    t.includes(app.text('.toast') || '', '足跡已清除', 'toast');
    const saved = app.storage('state');
    t.ok(saved && Object.keys(saved.cards).length === 0, '寫進 localStorage');
    await app.go('/album');
    t.eq(app.text('[data-stat="places"]'), '0', '收藏頁：去過的地方 0');
    t.eq(app.text('[data-stat="km"]'), '0', '收藏頁：公里 0');
    t.eq(app.$$('main.view .postcard--locked').length, app.$$('main.view [data-card]').length, '書架全部是灰的');
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

  t.test('QA 3：桌機 1280×720／1366×768 整支手機縮小，tab bar 看得到；手機模式不縮', async function (app) {
    await app.reset();
    await app.go('/ride');
    const fr = app.win.frameElement;
    const w0 = fr.style.width, h0 = fr.style.height;
    try {
      for (const sz of [[1280, 720], [1366, 768], [1440, 900]]) {
        fr.style.width = sz[0] + 'px'; fr.style.height = sz[1] + 'px';
        await app.waitFor(function () { return app.win.innerHeight === sz[1]; }, 2000, 'iframe 變成 ' + sz.join('×'));
        /* headless 下畫面外的 iframe 只會派第一次 resize 事件（沒有 rendering step）；
           真的瀏覽器每次都會派。這裡補派一次，驗的是 app 的 resize 處理（節流後重算）。 */
        app.win.dispatchEvent(new app.win.Event('resize'));
        await app.tick(200);
        const W = app.win;
        const scale = Number(W.getComputedStyle(app.doc.documentElement).getPropertyValue('--device-scale'));
        t.eq(scale, Math.round(Math.min(1, (sz[1] - 48) / 844) * 1000) / 1000, sz.join('×') + ' 的 --device-scale');
        const tb = app.$('#tabbar').getBoundingClientRect();
        t.ok(tb.height > 0 && tb.bottom <= W.innerHeight, sz.join('×') + '：tab bar 底 ' + Math.round(tb.bottom) + ' ≤ ' + W.innerHeight);
        const dv = app.$('.device').getBoundingClientRect();
        t.ok(dv.top >= 0, sz.join('×') + '：手機頂端 ' + Math.round(dv.top) + ' ≥ 0');
        const dp = app.$('#demo-panel').getBoundingClientRect();
        const overlap = !(dp.left >= dv.right || dp.right <= dv.left || dp.top >= dv.bottom || dp.bottom <= dv.top);
        t.ok(!overlap, sz.join('×') + '：demo 面板不壓在手機上');
      }
      fr.style.width = '390px'; fr.style.height = '844px';
      await app.waitFor(function () { return app.win.innerWidth === 390; }, 2000, '回到手機寬');
      app.win.dispatchEvent(new app.win.Event('resize'));
      await app.tick(200);
      t.eq(app.win.getComputedStyle(app.doc.documentElement).getPropertyValue('--device-scale').trim(), '1', '手機模式 --device-scale 1');
      t.eq(app.win.getComputedStyle(app.$('.device')).transform, 'none', '手機模式不縮放');
    } finally {
      fr.style.width = w0; fr.style.height = h0;
    }
  });

  t.test('QA 4a：行程進行中 setDropoff 一律擋下（K1、E、路線、搜尋）', async function (app) {
    await app.reset({ store: { trip: { placeId: 'lake', phase: 'riding', startedAt: now(), rated: false, km: 6.4 },
                               dropoff: { id: 'lake', name: '青草湖', km: 6.4, setAt: now(), via: 'e' } } });
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
    await app.click('[data-area-intro] [data-act="set-area-dropoff"]');
    await app.tick(60);
    t.eq(A.store.get('dropoff').id, 'lake', '四個入口都沒改到 dropoff');
    /* 抵達之後就可以再設 */
    A.store.set('trip', Object.assign({}, A.store.get('trip'), { phase: 'done' }));
    t.eq(A.ride.setDropoff('moat', 'e'), true, '抵達後可以設');
  });

  t.test('QA 4b：行程進行中 /going/:id 顯示「你正在搭車前往」＋回到行程', async function (app) {
    await app.reset({ store: { trip: { placeId: 'lake', phase: 'riding', startedAt: now(), rated: false, km: 6.4 } } });
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

  t.test('QA 4c：行程進行中 /ride 的下車點卡是這一趟的目的地，不是 store.dropoff', async function (app) {
    await app.reset({ store: { trip: { placeId: 'lake', phase: 'riding', startedAt: now(), rated: false, km: 6.4 },
                               dropoff: { id: 'moat', name: '護城河', km: 1.8, setAt: now(), via: 'e' } } });
    const A = app.APP, F = A.fmt;
    await app.go('/ride');
    t.eq(app.text('[data-drop-name]'), A.place('lake').name, '下車點＝行程目的地');
    t.eq(app.text('[data-fare]'), String(F.fare(6.4)), '車資用 trip.km');
    t.ok(app.$('.ride-drop a[href="#/trip"]'), '點下車點卡回行程');
    t.ok(!app.$('[data-act="clear-dropoff"]'), '行程中沒有「清除」');
    t.includes(app.text('[data-act="call-ride"]'), '回到行程', '叫車鈕是回到行程');
    t.noDeadButtons(app, '/ride（行程中）');
  });

  t.test('QA 5：/week 收一張卡之後：地方 +1、公里與步數不減、上週不變', async function (app) {
    await app.reset();
    await app.go('/week');
    const before = app.APP.album.weekStats();
    const range0 = app.text('.alb-cover__range');
    const km0 = app.text('[data-cmp="km"] [data-now]'), st0 = app.text('[data-cmp="steps"] [data-now]');
    app.APP.explore.collect('glass-kiln', { by: 'walk', km: 1 });
    await app.go('/album');
    await app.go('/week');
    const after = app.APP.album.weekStats();
    t.eq(after.now.places, before.now.places + 1, '地方數 +1');
    t.ok(after.now.km >= before.now.km, '公里不減 ' + before.now.km + ' → ' + after.now.km);
    t.ok(after.now.steps >= before.now.steps, '步數不減');
    t.eq(JSON.stringify([after.prev.places, after.prev.km, after.prev.steps]), JSON.stringify([before.prev.places, before.prev.km, before.prev.steps]), '上週不變');
    t.eq(app.text('.alb-cover__range').split(' – ')[0], range0.split(' – ')[0], '標題起點不變（終點延到最晚收的卡，見評估 5）');
    t.eq(app.text('[data-cmp="km"] [data-now]'), km0, '畫面公里不變');
    t.eq(app.text('[data-cmp="steps"] [data-now]'), st0, '畫面步數不變');
    t.eq(app.text('[data-week-places]'), String(before.now.places + 1), '畫面地方數 +1');
    t.ok(app.$('.alb-weekcard[data-card="p11"]'), '今天收的卡出現在這一週');
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

  t.test('QA 9／10：回顧的公里寫「移動的」；/trip/done 沒行程頁首寫「行程」、評過分的星數重整還在', async function (app) {
    await app.reset();
    await app.go('/lookback');
    t.includes(app.text('[data-lb-act="1"]'), '這個月移動的', '第二幕文案');
    t.ok(app.text('[data-lb-act="1"]').indexOf('這個月走過的') < 0, '不再寫「這個月走過的」');
    await app.go('/trip/done');
    t.eq(app.text('.hdr-red__title'), '行程', '沒行程：頁首「行程」');
    t.includes(app.text('main.view[data-view]'), '目前沒有行程', '內文維持');
    t.ok(app.doc.title.indexOf('行程完成') < 0, 'document.title 也不是行程完成');
    await app.reset({ store: { trip: { placeId: 'lake', phase: 'done', startedAt: now(), rated: true, stars: 3, km: 6.4 } }, hash: '/trip/done' });
    await app.at('/trip/done');
    t.eq(app.text('.hdr-red__title'), '行程完成', '有行程：頁首「行程完成」');
    t.eq(app.$$('.ride-star.is-on').length, 3, '重整後三顆星');
    t.ok(!app.$('[data-gold]').hidden, '重整後金色橫幅還在');
  });

  t.test('QA 11–17：景點 aria-label、全形問號、點數無條件捨去、原型未做統一文案、onboarding 推播、日期 MM.DD', async function (app) {
    await app.reset();
    const A = app.APP;
    await app.go('/ride?mode=explore');
    const spots = app.$$('main.view .spot');
    t.ok(spots.length > 0 && spots.every(function (s) { return s.getAttribute('aria-label') === A.place(s.getAttribute('data-spot')).name; }), '叫車地圖景點 aria-label＝地名');
    t.ok(/今天想去哪裡？$/.test(app.text('.ride-v2__intro h1')), '全形問號：' + app.text('.ride-v2__intro h1'));
    await app.go('/explore/map');
    t.ok(app.$$('main.view .spot').every(function (s) { return !!s.getAttribute('aria-label'); }), '探索地圖景點都有 aria-label');
    /* 13：搭車回饋 floor(fare/20) */
    A.ride.pointsRows().filter(function (r) { return !r.city; }).forEach(function (r) {
      t.ok(r.amt === Math.floor(r.amt), '整數');
    });
    const plain = A.ride.pastTrips().filter(function (x) { return !x.city; })[0];
    const row = A.ride.pointsRows().filter(function (r) { return r.name.indexOf(plain.to) >= 0; })[0];
    t.eq(row && row.amt, Math.floor(A.fmt.fare(plain.km) / 20), '搭車回饋＝floor(fare/20)');
    /* 14 */
    await app.go('/drawer');
    await app.click('main.view .drawer__item[data-toast]');
    t.includes(app.text('.toast') || '', '這份原型沒有做這一頁', '抽屜的未做頁');
    await app.go('/notify');
    t.eq(app.$('[data-panel="news"] [data-toast]') && app.$('[data-panel="news"] [data-toast]').getAttribute('data-toast'), '這份原型沒有做這一頁', '通知的活動推播');
    await app.go('/pickup');
    t.eq(app.$('main.view [data-toast]').getAttribute('data-toast'), '這份原型沒有做這一頁', '上車點的搜尋更多');
    /* 17 */
    await app.go('/trips');
    const dates = app.$$('[data-trip-row] .row-nav__sub').map(function (x) { return x.textContent; });
    t.ok(dates.length && dates.every(function (d) { return /^\d\d\.\d\d/.test(d) && d.indexOf('/') < 0; }), '行程紀錄日期 MM.DD：' + dates.join('｜'));
    await app.go('/points');
    t.ok(app.$$('[data-points-row] .row-nav__sub').every(function (x) { return !/\d\/\d/.test(x.textContent); }), '點數明細日期不是 MM/DD');
    /* 15 */
    await app.reset({ onboarded: false, hash: '/welcome' });
    await app.at('/welcome');
    await app.click('#demo-panel [data-act="push-am"]');
    await app.click('.pushmock [data-act="open-push"]');
    await app.at('/ride');
    t.eq(app.route().query.get('area'), app.MOCK.TODAY.id, '早上推播選定地區');
    t.eq(app.APP.store.get('onboarded'), true, '從 /welcome 點推播進來 → onboarded');
    await app.go('/', { expect: '/ride' });
    t.eq(app.route().path, '/ride', '之後回 / 不會再被帶去 onboarding');
  }, { timeout: 15000 });

  /* ============================================================ 6. 評估回報（最後一輪） */

  t.test('評估 1：限定版＋50 點只給走不到的地方 —— 搭車去 moat（1.8 km）是一般卡、不加點', async function (app) {
    const moat = { placeId: 'moat', phase: 'done', startedAt: now(), rated: true, km: 1.8, via: 'e' };
    await app.reset({ store: { trip: moat } });
    const A = app.APP, F = A.fmt;
    const km = A.fmt.km(A.place('moat').dist);
    t.eq(A.ride.limitedPlace(A.place('moat')), false, 'moat 走得到 → 不是限定版');
    t.eq(A.ride.limitedPlace(A.place('neiwan')), true, 'neiwan 走不到 → 限定版');
    const total0 = A.ride.pointsTotal();
    const city0 = A.ride.pointsRows().filter(function (r) { return r.city; }).length;
    /* 評分後的橫幅與 /ride 入口不寫「限定」 */
    await app.go('/trip/done');
    t.ok(app.text('[data-gold]').indexOf('限定') < 0, '/trip/done 橫幅不寫限定：' + app.text('[data-gold]'));
    await app.go('/ride');
    t.ok((app.text('[data-act="unlock-ride"]') || '').indexOf('限定') < 0, '/ride 入口不寫限定');
    await app.click('main.view [data-act="unlock-ride"]');
    await app.at('/unlock/moat');
    t.ok(!app.$('[data-final-card].postcard--gold'), '沒有金框');
    t.ok(!app.$('[data-gold-note]'), '沒有 +50');
    t.includes(app.text('.unlock__sub'), '搭 yoxi 抵達', '文案仍是搭車抵達');
    await app.click('[data-act="collect"]');
    await app.at('/album');
    t.eq(app.STATE.card('p19') && app.STATE.card('p19').by, 'ride', "by 'ride'（真的是搭車到的）");
    t.eq(A.ride.pointsRows().filter(function (r) { return r.city; }).length, city0, '城事解鎖回饋列數不變');
    t.eq(A.ride.pointsTotal() - total0, Math.floor(F.fare(km) / 20), '只多了一般的搭車回饋');
    t.ok(!app.$('[data-card="p19"].postcard--gold'), '書架上不是金框');
    await app.go('/postcard/p19');
    t.ok(!app.$('.postcard--gold') && !app.$('[data-ribbon]'), '明信片頁不是限定版');
    await app.go('/points');
    const sum = app.$$('[data-amt]').reduce(function (s, e) { return s + Number(e.getAttribute('data-amt')); }, 0);
    t.eq(Number(app.text('[data-points-total]')), sum, '總數＝明細相加');
    /* K1 的「限定版 · +50 點」小標只在走不到時 */
    await app.go('/place/lake');
    t.ok(app.$('.ex-ride__tag'), '走不到的 lake 有限定版小標');
    t.includes(app.text('.ex-ride__tag'), '+50', '+50');
    await app.go('/place/brick');
    t.ok(!app.$('.ex-ride__tag'), '走得到的 brick 沒有限定版小標');
    await app.reset();
  }, { timeout: 15000 });

  t.test('評估 2：轉換歸因 —— trip 帶 dropoff.via，行程紀錄顯示是從哪裡叫的', async function (app) {
    await app.reset();
    const A = app.APP;
    await app.go('/place/neiwan');
    await app.click('[data-place-foot] [data-act="set-dropoff"]');
    await app.at('/ride');
    await app.click('[data-act="call-ride"]');
    await app.at('/trip');
    t.eq(A.store.get('trip').via, 'k1', 'trip.via＝dropoff.via');
    await app.click('main.view [data-act="arrive"]');
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

  t.test('評估 5：/week 標題終點延到最晚收的那張卡，起點不變', async function (app) {
    await app.reset();
    await app.go('/week');
    const w0 = app.APP.album.weekStats();
    const r0 = app.text('.alb-cover__range');
    const lab = function (d) { return w0.month + '月' + d + '日'; };
    t.eq(r0, lab(w0.now.from) + ' – ' + lab(w0.now.to), '收卡前：' + r0);
    t.eq(w0.now.to, 21, '固定範圍終點是 21 日（HEALTH_STEPS 最後一個有步數的日子）');
    app.APP.explore.collect('glass-kiln', { by: 'walk', km: 1 });
    await app.go('/album');
    await app.go('/week');
    const today = app.APP.fmt.todayMMDD();
    const day = Number(today.slice(3, 5));
    const sameMonth = Number(today.slice(0, 2)) === w0.month;
    const want = lab(w0.now.from) + ' – ' + lab(sameMonth && day > w0.now.to ? day : w0.now.to);
    t.eq(app.text('.alb-cover__range'), want, '收卡後終點是今天：' + app.text('.alb-cover__range'));
    const w1 = app.APP.album.weekStats();
    t.eq(w1.now.from, w0.now.from, '起點不變');
    t.eq(w1.now.steps, w0.now.steps, '步數只算有資料的日子（不變）');
    await app.go('/album');
    t.ok(!app.$('[data-act="go-week"]'), '雙主頁收藏首頁不再放週回顧入口');
    await app.reset();
  });

  /* ============================================================ 7. 無障礙 */

  /* WCAG 相對亮度與對比。color 可能是 rgb()／rgba()／color(srgb …)（color-mix 算出來的） */
  function parseColor(str) {
    const nums = String(str).match(/-?[\d.]+(e-?\d+)?/g) || [];
    if (/^color\(srgb/.test(str)) return nums.slice(0, 3).map(function (v) { return Number(v) * 255; }).concat([nums[3] != null ? Number(nums[3]) : 1]);
    return nums.slice(0, 3).map(Number).concat([nums[3] != null ? Number(nums[3]) : 1]);
  }
  function lum(c) {
    const a = c.slice(0, 3).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  /* 往上找第一個不透明的背景 */
  function bgOf(app, el) {
    const W = app.win;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = parseColor(W.getComputedStyle(n).backgroundColor);
      if (c[3] >= 0.99) return c;
    }
    return [255, 255, 255, 1];
  }
  function ratioOf(app, el) {
    return contrast(parseColor(app.win.getComputedStyle(el).color), bgOf(app, el));
  }

  t.test('無障礙 1／2：「要去哪裡？」與次要文字對比 ≥ 4.5:1', async function (app) {
    await app.reset();
    await app.go('/ride');
    const ph = app.$('[data-act="pick-dropoff"] .route-input__value');
    const r = ratioOf(app, ph);
    t.ok(r >= 4.5, '「要去哪裡？」對比 ' + r.toFixed(2));
    const samples = [
      ['/ride', '.route-input__label'],
      ['/notify', '.row-nav__sub'],
      ['/album', '.alb-v2__stat small'],
      ['/explore', '.sec__m'],
      ['/place/lake', '.ex-foot__note'],
      ['/points', '.row-nav__sub'],
      ['/album?tab=badges', '.badge__prog'],
    ];
    for (const s of samples) {
      await app.go(s[0]);
      const el = app.$('main.view ' + s[1]);
      if (!el) { t.fail(s[0] + ' 找不到 ' + s[1]); continue; }
      const k = ratioOf(app, el);
      t.ok(k >= 4.5, s[0] + ' ' + s[1] + ' 對比 ' + k.toFixed(2));
    }
  });

  t.test('無障礙 3：confirm／share／push 打開時焦點進框、Esc 關、焦點回原處', async function (app) {
    await app.reset({ store: { trip: { placeId: 'lake', phase: 'riding', startedAt: now(), rated: false, km: 6.4 } } });
    const d = app.doc, W = app.win;
    const esc = function () { d.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); };
    await app.go('/trip');
    const btn = app.$('[data-act="cancel-trip"]');
    btn.focus();
    btn.click();
    await app.tick(30);
    const dlg = app.$('.app-confirm [role="dialog"]');
    t.ok(dlg && dlg.getAttribute('aria-modal') === 'true' && dlg.getAttribute('aria-label'), 'confirm：role／aria-modal／aria-label');
    t.ok(dlg && dlg.contains(d.activeElement), 'confirm：焦點在框內（' + (d.activeElement && d.activeElement.getAttribute('data-act')) + '）');
    esc();
    await app.tick(30);
    t.ok(!app.$('.app-confirm'), 'confirm：Esc 關掉');
    t.ok(app.APP.store.get('trip'), 'confirm：Esc 視為「先不要」');
    t.eq(d.activeElement, btn, 'confirm：焦點回到取消行程');

    await app.go('/week');
    const sh = app.$('main.view [data-act="share"]');
    sh.focus();
    sh.click();
    await app.tick(30);
    const sd = app.$('.sys-share [role="dialog"]');
    t.ok(sd && sd.getAttribute('aria-modal') === 'true' && sd.getAttribute('aria-label'), 'share：role／aria-modal／aria-label');
    t.ok(sd && sd.contains(d.activeElement), 'share：焦點在框內');
    esc();
    await app.tick(30);
    t.ok(!app.$('.sys-share'), 'share：Esc 關掉');
    t.eq(d.activeElement, sh, 'share：焦點回到分享鈕');

    app.APP.ui.push({ when: 'am' });
    await app.tick(30);
    const pm = app.$('.device > .pushmock');
    t.ok(pm && pm.getAttribute('role') === 'dialog' && pm.getAttribute('aria-modal') === 'true' && pm.getAttribute('aria-label'), 'push：role／aria-modal／aria-label');
    t.ok(pm && pm.contains(d.activeElement), 'push：焦點在浮層內');
    esc();
    await app.tick(30);
    t.ok(!app.$('.device > .pushmock'), 'push：Esc 關掉');
    esc();
    await app.tick(30);
    t.eq(app.route().path, '/week', '多按的 Esc 沒有副作用');
  });

  t.test('無障礙 4：toast 是 live region、停留至少 3 秒', async function (app) {
    await app.reset();
    await app.go('/ride');
    app.APP.ui.toast('測試一句話');
    const el = app.$('.device .toast');
    t.eq(el && el.getAttribute('role'), 'status', 'role=status');
    t.eq(el && el.getAttribute('aria-live'), 'polite', 'aria-live=polite');
    t.eq(el && el.textContent, '測試一句話', '文字');
    await app.tick(2900);
    t.ok(app.$('.device .toast'), '2.9 秒時還在');
    await app.tick(600);
    t.ok(!app.$('.device .toast'), '之後收掉');
  });

  /* 可按元素：命中區（含 ::after 撐大的）至少 40×40；每個都有名字 */
  const A11Y_ROUTES = ['/ride', '/dropoff', '/pickup', '/drawer', '/points', '/notify', '/trips',
    '/explore', '/explore/map', '/place/glass-kiln', '/place/neiwan', '/place/p1', '/going/glass-kiln', '/unlock/glass-kiln',
    '/routes', '/route/rail', '/album', '/album?tab=badges', '/album?tab=journal', '/album?tab=week',
    '/postcard/p1', '/postcard/p11', '/badge/b1', '/footprint', '/lookback', '/week', '/elder', '/settings', '/welcome'];
  /* 例外（原型就如此、而且不是單一的點擊目標）：地圖景點（本身 38px，周圍是可平移的地圖） */
  const HIT_EXEMPT = '.spot';

  function hitOk(app, el) {
    const r = el.getBoundingClientRect();
    if (Math.min(r.width, r.height) >= 40) return true;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const pts = [[cx - 20, cy], [cx + 19, cy], [cx, cy - 20], [cx, cy + 19]];
    return pts.every(function (p) {
      const h = app.doc.elementFromPoint(p[0], p[1]);
      return h && (h === el || el.contains(h));
    });
  }
  function nameOf(el) {
    return (el.getAttribute('aria-label') || el.getAttribute('title') || (el.textContent || '').replace(/\s+/g, '') ||
      (el.querySelector('[aria-label]') && el.querySelector('[aria-label]').getAttribute('aria-label')) || '').trim();
  }

  t.test('無障礙 5／6：可按元素命中區 ≥ 40×40、每個都有名字', async function (app) {
    await app.reset();
    const small = [], nameless = [];
    const scan = function (p) {
      const W = app.win;
      /* 名字：畫面內外、tab bar、demo 面板全部都要有 */
      app.$$('main.view a[href], main.view button, main.view [role="button"], main.view [role="switch"], #tabbar a, #demo-panel a, #demo-panel button').forEach(function (el) {
        if (!nameOf(el)) nameless.push(p + ' ' + (el.getAttribute('data-act') || el.className || el.tagName).toString().slice(0, 40));
      });
      app.$$('main.view a[href], main.view button, main.view [role="button"], main.view [role="switch"]').forEach(function (el) {
        const r = el.getBoundingClientRect();
        const cs = W.getComputedStyle(el);
        if (!(r.width > 0 && r.height > 0) || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return;
        if (r.bottom < 0 || r.top > W.innerHeight || r.right < 0 || r.left > W.innerWidth) return;   /* 捲在畫面外的不量 */
        if (el.closest('[data-expand-only]') && el.closest('.is-collapsed')) return;
        const tag = p + ' ' + (el.getAttribute('data-act') || el.className || el.tagName).toString().slice(0, 40);
        if (el.closest(HIT_EXEMPT)) return;
        if (!hitOk(app, el)) small.push(tag + '（' + Math.round(r.width) + '×' + Math.round(r.height) + '）');
      });
    };
    for (const p of A11Y_ROUTES) {
      await app.go(p, { redirectOk: true });
      await app.tick(40);
      scan(p);
    }
    /* 有狀態才出現的畫面：行程中、行程完成（評過分）、叫車首頁小卡打開、推播與分享浮層 */
    await app.reset({ store: { trip: { placeId: 'lake', phase: 'riding', startedAt: now(), rated: false, km: 6.4 } } });
    await app.go('/trip'); await app.tick(40); scan('/trip');
    await app.go('/going/moat'); await app.tick(40); scan('/going（行程中）');
    await app.reset({ store: { trip: { placeId: 'lake', phase: 'done', startedAt: now(), rated: true, stars: 4, km: 6.4 } } });
    await app.go('/trip/done'); await app.tick(40); scan('/trip/done');
    await app.go('/ride?mode=explore'); await app.click('.spot[data-spot="moat"]'); scan('/ride 探索選點');
    app.APP.ui.share({ kind: 'week' });
    app.$$('.sys-share button').forEach(function (el) { if (!nameOf(el)) nameless.push('分享面板 ' + el.getAttribute('data-act')); });
    app.APP.ui.push({ when: 'am', force: true });
    app.$$('.pushmock a, .pushmock button').forEach(function (el) { if (!nameOf(el)) nameless.push('推播 ' + el.getAttribute('data-act')); });
    t.eq(nameless.length, 0, '沒有名字的可按元素：' + nameless.join('、'));
    t.eq(small.length, 0, '命中區 < 40：' + small.join('、'));
  }, { timeout: 30000 });
});
