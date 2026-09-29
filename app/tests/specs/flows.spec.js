/* ==========================================================================
   flows.spec — QA-flows：把四個區塊縫成一個走得完一圈的 app
   1. 三條 demo 流程端到端（prototype/js/catalog.js 的 FLOWS：每一步「要講的那句話」就是驗收條件）
      A 不搭車的日常、B 搭車的轉換、C 晚上的回顧（C 在非 still 模式跑：動畫與計時器照真的走）。
      一律從 app.reset() 開始、用 app.click 真的按；只有推播用 APP.ui.push 觸發（demo 工具的職責）。
   2. 縫合：叫車小卡→地方→返回、E 小卡走 APP.ride.setDropoff、深連結重整、tab 記憶、
      非 still 模式每條 route 無例外、連點不重複寫入、APP.ride.arrive() 在 /trip 之外。
   3. 全站掃描：§8 每條 route × 兩種狀態（初始／收了 3 張＋有下車點＋有行程）。
   4–6. 審查、亂按 QA、評估回報裡「跨區塊」的那幾條（例：同一個地方的車資在五個畫面相同）。
      只牽涉一個區塊的回歸測試放在那個區塊的 spec 最後（「回歸測試（從 flows.spec 搬來）」），名稱保留原編號。
   7. 無障礙：對比、焦點、live region、命中區（跨全站）。
   ========================================================================== */
T.spec('flows', function (t) {

  /* ------------------------------------------------------------ 小工具 */
  function now() { return new Date().toISOString(); }

  function toastText(app) {
    return app.$$('.device .toast').map(function (x) { return x.textContent; }).join('｜');
  }

  /* 目前畫面裡看得到的返回鍵（<a data-back>）、非 still 的翻卡：harness 的 T.helpers */
  const clickBack = T.helpers.clickBack;
  const revealThrough = T.helpers.revealThrough;
  /* 叫車首頁「叫車前往」→ 確認叫車頁「確認叫車」 */
  const callRide = T.helpers.callRide;

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
    /* demo 面板的模擬抵達：地點跟著前往中的目的地，走路抵達 */
    t.eq(app.$('#demo-panel [data-demo-place]').value, T0.id, 'demo 面板的地點跟著前往中的目的地');
    await app.click('#demo-panel [data-act="arrive-walk"]');
    await app.at('/unlock/' + T0.id);
    if (!app.still) {
      t.eq(app.$('[data-unlock]').getAttribute('data-at'), '1', '非 still：先是抵達（這個地方亮起來）');
      await revealThrough(app);
    }
    await app.waitFor(function () { return app.$('[data-unlock]').getAttribute('data-at') === '3'; }, 2000, '結果');
    const inp = app.$('[data-one-line]');
    inp.value = note;
    await app.click('[data-act="collect"]');
    await app.at('/album');
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
    t.eq(app.text('[data-stat="cards"]'), String(n0 + 1), '明信片摘要 +1');
    t.eq(app.$$('[data-stat="places"], [data-stat="km"]').length, 0, '收藏首頁沒有重複的地方／距離統計');
    t.ok(!app.$('#tabbar .tabbar__dot'), '底欄沒有提示小圓點');
    const b1 = S.badge('b5');
    t.eq(b1.done, b0.done + 1, '〈' + b0.name + '〉收集 +1');
    await app.go('/badges');
    t.eq(app.text('[data-badge="b5"] [data-badge-when]'), '收集 ' + b1.done + '/' + b1.total, '章牆「收集 n/m」');
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

    await callRide(app);
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

  t.test('流程 C 晚上的回顧（非 still）：收一張 → 晚上推播 → 製作回憶卡 → 這一週 → 長輩圖', async function (app) {
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
    t.eq(app.text('.memory-heading h1'), '把這一刻，留成卡。', '推播打開回憶卡房間');
    t.eq(app.$('[data-act="pick-memory-template"].is-selected').getAttribute('data-card'), last.id, '剛收的地方是今日模板並預選');
    t.ok(!app.$('main.view[data-view] [data-act="share"]'), '製作頁沒有分享鍵');
    await app.click('[data-act="memory-mood"][data-mood="ok"]');
    t.ok(app.route().path === '/lookback', '選心情只改本頁，尚未儲存');
    t.eq((S.all.today.memoryCards || []).length, 0, 'STATE 尚未寫入選擇');
    t.eq(app.$('[data-act="pick-memory-template"].is-selected').getAttribute('data-memory-mood'), 'ok', '心情直接改在模板卡');
    await app.click('[data-act="make-memory"]');
    t.ok(app.route().path === '/lookback', '收下後留在製作頁');
    t.eq(S.all.today.memoryCards.length, 1, 'STATE.today.memoryCards 一張');
    t.eq(S.all.today.memoryCards[0].mood, 'ok', '記下心情');
    t.eq(S.all.today.memoryCards[0].cardId, last.id, '記下地方的明信片');
    await app.click('main.view[data-view] a[data-back]');
    await app.at('/album');
    t.eq(app.route().path, '/album', '回到收藏');
    t.ok(!app.$('main.view[data-view] [data-act="share"]'), '收藏主頁沒有分享鈕');
    t.ok(!/tab=/.test(app.win.location.hash), '網址的 ?tab 拿掉了：' + app.win.location.hash);
    t.eq(app.text('[data-look-tile="journal"] [data-look-today]'), '1', '首頁顯示一張回憶卡');
    await app.click('main.view [data-act="go-week"]');
    await app.at('/week');
    await app.click('main.view [data-act="share"]');
    /* 週回顧沒有指定哪一張明信片：沒有「傳到 LINE 給家人」的一鍵傳，第一格是長輩圖（明信片的分享見 family.spec） */
    const first = app.$('.device > .sys-share .row-nav');
    t.eq(first && first.getAttribute('data-act'), 'share-family', '週回顧的分享面板第一格是長輩圖');
    t.ok(!app.$('.sys-share [data-act="share-line"]'), '週回顧沒有一鍵傳到 LINE');
    await app.click('.sys-share [data-act="share-family"]');
    await app.at('/elder');
    await app.click('[data-act="send-family"]');
    t.includes(toastText(app), '已傳給家人', '傳給家人 toast');
    await clickBack(app);
    await app.at('/week');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
  }, { timeout: 25000 });

  t.test('流程 B′：評分後按「回首頁」→ /ride 金色入口 → 解鎖收卡 → 入口消失', async function (app) {
    await app.reset({ store: { dropoff: T.fixtures.dropoff({ setAt: now(), via: 'route' }) } });
    const A = app.APP, S = app.STATE;
    const pts0 = S.points;
    await app.go('/ride');
    await callRide(app);
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
    const done = T.fixtures.trip({ phase: 'done', startedAt: now(), rated: true });
    const drop = T.fixtures.dropoff({ id: 'lake', name: '青草湖的舊戲院地基', km: 6.4, setAt: now(), via: 'e' });

    /* 先去解鎖：不建新 trip，到 /unlock/neiwan?ride=1 */
    await app.reset({ store: { trip: done, dropoff: drop } });
    let A = app.APP;
    await app.go('/ride');
    await callRide(app);
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
    await callRide(app);
    await app.click('.app-confirm [data-act="confirm-no"]');
    await app.at('/trip');
    t.eq(A.store.get('trip').placeId, 'lake', '新 trip 覆蓋');
    t.ok(!A.ride.trip.pending(), '覆蓋後沒有待解鎖');

    /* 沒有待解鎖：不問 */
    await app.reset({ store: { dropoff: drop } });
    await app.go('/ride');
    await callRide(app);
    await app.at('/trip');
    t.ok(!app.$('.app-confirm'), '沒有待解鎖就不問');
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
  });

  /* ============================================================ QA-visual（跨區塊的兩項；視覺 3 在 album.spec、視覺 4 在 explore.spec） */

  t.test('視覺 1／2：/going 按鈕文案與收藏頁獎章數字', async function (app) {
    await app.reset();
    await app.go('/going/glass-kiln');
    const b = app.$('main.view [data-act="arrive"]');
    t.eq(b && b.textContent.trim(), '模擬抵達', '/going 按鈕文字與 /trip 一致');
    await app.go('/album');
    t.eq(app.text('.alb-v2__medals h2'), '獎章', '獎章區標題');
    const bc = app.MOCK.BADGES.filter(function (x) { return app.STATE.badge(x.id).got; }).length;
    t.eq(app.text('[data-stat="badges"]'), bc + '/' + app.MOCK.BADGES.length, '第三格數字仍是 n/m');
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
    await app.reset({ store: { trip: T.fixtures.trip({ startedAt: now() }) }, hash: '/trip' });
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
    const list = sweepRoutes();
    const bad = [];
    for (let i = 0; i < list.length; i++) {
      await app.go(list[i].path, { redirectOk: true, ms: 5000 });
      /* 讓 mount 的 setTimeout 跑完：配對 1.2 s、解鎖三幕約 5 s、轉場 */
      await app.tick(/^\/unlock/.test(list[i].path) ? 5400 : /^\/trip/.test(list[i].path) ? 1500 : 400);
      const pre = app.doc.getElementById('app-errors');
      const txt = pre ? pre.textContent : '';
      if (txt || app.errors.length) bad.push(list[i].path + '：' + (txt || app.errors.join('；')).slice(0, 160));
    }
    /* 抵達：這個地方亮起來、等你點；點過去翻卡會停在結果 */
    await app.go('/unlock/moat');
    await app.tick(1500);
    t.eq(app.$('[data-unlock]').getAttribute('data-at'), '1', '非 still：先停在抵達，等你點發光的地方');
    t.ok(app.$('[data-unlock]').classList.contains('is-lit'), '這個地方亮起來了');
    await revealThrough(app);
    t.ok(app.$('[data-act="collect"]'), '結果有「收進收藏」');
    /* 行程：配對 → 行程中由計時器切換 */
    await app.reset({ still: false, store: { dropoff: T.fixtures.dropoff({ id: 'lake', name: 'x', km: 6.4, setAt: now(), via: 'e' }) } });
    await app.go('/ride');
    await callRide(app);
    await app.at('/trip');
    /* 不斷言「剛載入一定是 matching」：virtual time 下轉場＋畫地圖可能就吃掉 1.2 s（時間競賽）。
       phase 由 trip.startedAt 推導（APP.ride.trip.phase），這裡只要求：現在是配對中或行程中、畫面跟 phase 一致、最後會到行程中。
       「剛叫車是配對中、過了 MATCH_MS 才是行程中」由「審查 1」用注入的時間驗。 */
    const ph0 = app.APP.store.get('trip').phase;
    t.includes(['matching', 'riding'], ph0, '叫車後是配對中或行程中');
    t.eq(app.$('[data-phase="riding"]').hidden, ph0 === 'matching', '畫面跟 store 的 phase 一致');
    await app.waitFor(function () { return app.APP.store.get('trip').phase === 'riding'; }, 3000, '計時器切到行程中');
    t.ok(!app.$('[data-phase="riding"]').hidden, '行程中區塊顯示');
    t.eq(bad.length, 0, '有例外的 route：' + bad.join('｜'));
    t.eq(app.errors.length, 0, '錯誤：' + app.errors.join('；'));
  }, { timeout: 120000 });

  t.test('縫合 f：連按兩次 set-dropoff／collect／call-ride／confirm-ride 不重複寫入、不重複導覽、不丟例外', async function (app) {
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
      await app.at('/ride/confirm');
      const go = app.$('[data-act="confirm-ride"]');
      go.click(); go.click();
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
      t.ok(app.$('[data-today-got]'), tag + 'collect 只推一筆 /album（返回回到解鎖頁：今天已經收下這一張）');
      t.eq(app.errors.length, 0, tag + '錯誤：' + app.errors.join('；'));
    }
  }, { timeout: 30000 });

  t.test('縫合 g：APP.ride.arrive() 在 /trip 之外呼叫', async function (app) {
    await app.reset();
    let A = app.APP;
    await app.go('/explore');
    t.ok(!app.$('#demo-panel [data-act="arrive-walk"]').disabled, 'demo 面板的走路抵達任何一頁都能按（地點從選單挑）');
    t.eq(A.ride.arrive(), false, '沒有行程 → 回 false');
    await app.tick(40);
    t.eq(app.route().path, '/explore', '沒有行程不導走');
    t.includes(toastText(app), '目前沒有行程', 'toast 目前沒有行程');

    await app.reset({ store: { trip: T.fixtures.trip({ placeId: 'lake', startedAt: now(), km: 6.4 }),
                               dropoff: T.fixtures.dropoff({ id: 'lake', name: 'x', km: 6.4, setAt: now(), via: 'e' }) } });
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
    await app.reset({ store: { trip: T.fixtures.trip({ placeId: 'lake', startedAt: now(), km: 6.4 }) } });
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
      t.ok(live > 0 && live <= 5, '/ride 上只有這一頁的 listener（' + live + '）');
    } finally {
      delete W.addEventListener; delete W.removeEventListener;
    }
  });

  /* ============================================================ 3. 全站掃描 */

  /* 共用的路由表（T.ROUTES，'/' 不算）再加幾個有代表性的：走不到的地方、?tab= 舊連結、金框卡、另一枚章 */
  function sweepRoutes() {
    return T.routes({ root: false, extra: [
      '/place/lake', '/place/brick', '/going/lake', '/unlock/lake?ride=1',
      '/album?tab=badges', '/album?tab=journal', '/album?tab=week',
      '/postcard/p9', '/postcard/p11', '/badge/b5',
      '/route/glass', '/route/water',
    ] });
  }

  const BAD_TEXT = /undefined|NaN|null|\[object/;

  async function sweep(app, label) {
    const list = sweepRoutes();
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
      const max = T.tapMax(landed);
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
    /* 搭車收的那張直接種進 STATE（走 APP.explore.collect 要先有一趟抵達內灣的行程，會取代下面這趟進行中的） */
    await app.reset({
      cards: [{ id: 'p11', by: 'walk', note: '第一張' }, { id: 'p19', by: 'walk' }, { id: 'p9', by: 'ride', km: 28 }],
      store: {
        dropoff: T.fixtures.dropoff({ id: 'brick', name: '新竹州廳', km: 2.4, setAt: now() }),
        trip: T.fixtures.trip({ placeId: 'lake', startedAt: now(), km: 6.4 }),
      },
    });
    const A = app.APP;
    t.eq(app.STATE.count(), 11, '收了 3 張');
    t.ok(A.store.get('dropoff') && A.store.get('trip'), '下車點與行程都在');
    await sweep(app, '有狀態 ');
    t.ok(A.store.get('trip'), '掃完行程還在（沒有哪一頁偷清）');
  }, { timeout: 30000 });

  /* ============================================================ 4. 審查（code review 修掉的 bug：一條 bug 一條 test；這裡只留跨區塊的） */

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
      await callRide(app);
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

  /* ============================================================ 5. 亂按 QA 回報（一項一條；這裡只留跨區塊的） */

  t.test('QA 9／10：回憶卡是本機構圖且不含舊里程；/trip/done 沒行程頁首寫「行程」、評過分的星數重整還在', async function (app) {
    await app.reset();
    await app.go('/lookback');
    const lookback = app.text('main.view[data-view]');
    t.includes(app.text('[data-act="pick-memory-template"].is-selected .memory-demo-mark'), '構圖示意', '卡面標明是構圖示意（頁面上不另寫說明小字）');
    t.ok(lookback.indexOf('這個月') < 0 && lookback.indexOf('步數') < 0 && lookback.indexOf('公里') < 0,
      '沒有舊月累積、步數或里程文案');
    await app.go('/trip/done');
    t.eq(app.text('.hdr-red__title'), '行程', '沒行程：頁首「行程」');
    t.includes(app.text('main.view[data-view]'), '目前沒有行程', '內文維持');
    t.ok(app.doc.title.indexOf('行程完成') < 0, 'document.title 也不是行程完成');
    await app.reset({ store: { trip: T.fixtures.trip({ placeId: 'lake', phase: 'done', startedAt: now(), rated: true, stars: 3, km: 6.4 }) }, hash: '/trip/done' });
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
    t.includes(app.text('.ride-v2__feature'), A.place('glass-kiln').name, '預設最近地點名稱');
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

  /* ============================================================ 6. 評估回報（最後一輪；這裡只留跨區塊的） */

  t.test('評估 1：+50 點只給走不到的地方 —— 搭車去 moat（1.8 km）照樣必得金框，但不加點', async function (app) {
    const moat = T.fixtures.trip({ placeId: 'moat', phase: 'done', startedAt: now(), rated: true, km: 1.8, via: 'e' });
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
    t.ok(app.$('[data-final-card].postcard--gold'), '搭 yoxi 抵達是金框');
    t.eq(app.$('[data-final-card]').getAttribute('data-style'), 'gold', '款式是金框');
    t.ok(!app.$('[data-points]'), '沒有 +50');
    t.includes(app.text('.unlock__sub'), '搭 yoxi 抵達', '文案仍是搭車抵達');
    await app.click('[data-act="collect"]');
    await app.at('/album');
    t.eq(app.STATE.card('p19') && app.STATE.card('p19').by, 'ride', "by 'ride'（真的是搭車到的）");
    t.eq(A.ride.pointsRows().filter(function (r) { return r.city; }).length, city0, '城事解鎖回饋列數不變');
    t.eq(A.ride.pointsTotal() - total0, Math.floor(F.fare(km) / 20), '只多了一般的搭車回饋');
    await app.go('/postcard/p19');
    t.ok(app.$('.postcard--gold'), '明信片頁是金框（收下的款式）');
    t.eq(app.APP.store.get('cardStyle').p19, 'gold', 'store.cardStyle 記下金框');
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
      ['/album', '[data-look-today]'],
      ['/explore', '.sec__m'],
      ['/place/lake', '.ex-foot__note'],
      ['/points', '.row-nav__sub'],
      ['/badges', '.alb-v2__medal-cell small'],
      ['/album', '.alb-v2__medal-top small'],
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
    await app.reset({ store: { trip: T.fixtures.trip({ placeId: 'lake', startedAt: now(), km: 6.4 }) } });
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

  t.test('無障礙 4：toast 經由常駐的 live region 念出、停留至少 3 秒', async function (app) {
    await app.reset();
    await app.go('/ride');
    /* live region 一開始就在（先有 region 再換內容才會被念）；畫面上的 toast 不重複念 */
    const live = app.$('#app-live');
    t.eq(live && live.getAttribute('role'), 'status', '#app-live role=status');
    t.eq(live && live.getAttribute('aria-live'), 'polite', '#app-live aria-live=polite');
    app.APP.ui.toast('測試一句話');
    const el = app.$('.device .toast');
    t.eq(el && el.textContent, '測試一句話', '文字');
    t.eq(el && el.getAttribute('aria-hidden'), 'true', '畫面上的 toast aria-hidden');
    await app.tick(150);
    t.eq(live && live.textContent, '測試一句話', 'live region 放進同一句');
    await app.tick(2750);
    t.ok(app.$('.device .toast'), '2.9 秒時還在');
    await app.tick(600);
    t.ok(!app.$('.device .toast'), '之後收掉');
  });

  /* 可按元素：命中區（含 ::after 撐大的）至少 40×40；每個都有名字 */
  /* 共用的路由表，少了要行程才有內容的兩頁與搭車抵達，多了明信片 id 的地方頁、?tab= 舊連結與金框卡 */
  const A11Y_ROUTES = T.routes({ root: false, skip: ['/trip', '/trip/done', '/unlock/neiwan?ride=1'],
    extra: ['/place/p1', '/album?tab=badges', '/album?tab=journal', '/album?tab=week', '/postcard/p11'] })
    .map(function (r) { return r.path; });
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
    await app.reset({ store: { trip: T.fixtures.trip({ placeId: 'lake', startedAt: now(), km: 6.4 }) } });
    await app.go('/trip'); await app.tick(40); scan('/trip');
    await app.go('/going/moat'); await app.tick(40); scan('/going（行程中）');
    await app.reset({ store: { trip: T.fixtures.trip({ placeId: 'lake', phase: 'done', startedAt: now(), rated: true, stars: 4, km: 6.4 }) } });
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
