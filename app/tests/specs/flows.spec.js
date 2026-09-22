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

  t.test('流程 A 不搭車的日常：早上推播 → 探索 → 地方 → 前往 → 解鎖 → 收藏', async function (app) {
    await app.reset();
    const A = app.APP, S = app.STATE;
    const T0 = app.MOCK.TODAY;
    const card = A.place(T0.id).card;
    const n0 = S.count();
    const b0 = S.badge('b5');
    t.eq(n0, 8, '初始 8 張');
    t.ok(b0.ids.indexOf(card) >= 0, '今天的地方屬於〈' + b0.name + '〉');
    t.ok(app.$('#tabbar [data-tab-id="explore"] .tabbar__dot'), '初始：探索 tab 有小圓點（今天的地方還沒收）');

    A.ui.push({ when: 'am' });
    const push = app.$('.device > .pushmock[data-push="am"]');
    t.ok(push, '早上推播浮層');
    t.includes(push && push.textContent, T0.name, '推播寫今天的地方');
    await app.click('.pushmock [data-act="open-push"]');
    await app.at('/explore');
    t.ok(!app.$('.device > .pushmock'), '點了推播浮層就收掉');
    /* 為什麼推薦給你：依據條數＝MOCK */
    await app.click('[data-act="toggle-why"]');
    t.eq(app.$$('[data-why-list] .why__item').length, (T0.why || []).length, '推薦依據條數');

    await walkAndCollect(app, '窯的牆還是溫的');

    t.ok(app.$('main.view .postcard__new'), '/album 有「新」角標');
    t.eq(S.count(), n0 + 1, 'STATE.count() 8 → 9');
    t.eq(S.card(card) && S.card(card).note, '窯的牆還是溫的', 'card.note 是那句話');
    t.eq(S.card(card) && S.card(card).by, 'walk', 'by walk');
    t.eq(app.text('[data-stat="places"]'), String(n0 + 1), '統計「去過的地方」+1');
    t.ok(!app.$('#tabbar .tabbar__dot'), '探索 tab 的小圓點消失');
    const b1 = S.badge('b5');
    t.eq(b1.done, b0.done + 1, '〈' + b0.name + '〉收集 +1');
    await app.click('.pill[data-tab="badges"]');
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

    await app.click('#tabbar [data-tab-id="explore"]');
    await app.at('/explore');
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
    t.eq(app.text('.ride-drop [data-fare]'), String(F.fare(km)), '[data-fare]＝fmt.fare(fmt.km(dist))');
    t.eq(app.text('.ride-drop [data-min]'), String(F.rideMin(km)), '[data-min]＝fmt.rideMin');
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
    t.ok(!app.$('.ride-drop'), '下車點已清空');

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
    await app.click('#tabbar [data-tab-id="explore"]');
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
    t.eq(app.route().query.get('tab'), 'journal', '回到收藏的日誌');
    t.eq(S.all.today.mood, 'good', 'STATE.today.mood');
    t.eq(S.all.today.photo, 1, 'STATE.today.photo');
    t.ok(app.$('.pill.is-active[data-tab="journal"]'), '日誌 pill 亮著');
    const jp = app.$('[data-panel="journal"]');
    t.ok(jp && !jp.classList.contains('u-hidden'), '日誌 panel 顯示');
    t.ok(app.$('[data-panel="journal"] [data-mood-now="good"]'), '日誌顯示心情');
    t.ok(!app.$('main.view[data-view] [data-act="share"]'), '日誌沒有分享鈕');

    await app.click('.pill[data-tab="week"]');
    t.ok(!app.$('[data-panel="week"]').classList.contains('u-hidden'), '這一週 panel 顯示');
    await app.click('[data-panel="week"] [data-act="go-week"]');
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

  t.test('視覺 1／2：/going 模擬抵達不重複寫「demo」；/album 統計第三格標籤只寫「獎章」', async function (app) {
    await app.reset();
    await app.go('/going/glass-kiln');
    const b = app.$('main.view [data-act="arrive"]');
    t.eq(b && b.textContent.trim(), '模擬抵達', '/going 按鈕文字與 /trip 一致');
    await app.go('/album');
    const k = app.$$('.statbar__cell .statbar__k').map(function (x) { return x.textContent.trim(); });
    t.eq(k[2], '獎章', '第三格標籤');
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

  t.test('縫合 a：/ride 景點小卡「看看這個地方」→ /place → 返回 /ride，sheet 仍收合', async function (app) {
    await app.reset();
    await app.go('/ride');
    t.ok(app.$('.ride-sheet.is-collapsed'), '一開始收合');
    await app.click('.spot[data-spot="moat"]');
    t.eq(app.$('[data-peek]').getAttribute('data-peek-id'), 'moat', '小卡是護城河');
    const p = app.APP.place('moat');
    t.eq(app.text('[data-peek-meta]'), p.type + ' · ' + app.APP.fmt.dist(p.dist), '小卡距離＝APP.place().dist');
    await app.click('[data-act="peek-place"]');
    await app.at('/place/moat');
    await clickBack(app);
    await app.at('/ride');
    t.ok(app.$('.ride-sheet.is-collapsed'), '返回後 sheet 仍是收合態');
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
    const fareE = app.text('.ride-drop [data-fare]');

    await app.go('/place/lake');
    await app.click('[data-place-foot] [data-act="set-dropoff"]');
    await app.at('/ride');
    t.eq(calls.length, 2, 'K1 也走 APP.ride.setDropoff');
    const k = A.store.get('dropoff');
    t.eq(k && k.via, 'k1', 'K1 via k1');
    t.eq(JSON.stringify([e.id, e.name, e.km]), JSON.stringify([k.id, k.name, k.km]), 'E 與 K1 寫出同一個下車點');
    t.eq(app.text('.ride-drop [data-fare]'), fareE, '車資相同');
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
    t.includes(app.text('.ride-drop'), d, '叫車首頁下車點 ' + d);
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

  t.test('縫合 d：tab 記憶 —— 收藏停在日誌，切到叫車再切回來還在日誌', async function (app) {
    await app.reset();
    await app.click('#tabbar [data-tab-id="album"]');
    await app.at('/album');
    await app.click('.pill[data-tab="journal"]');
    t.eq(app.route().query.get('tab'), 'journal', 'current() 的 query 跟著換');
    t.includes(app.win.location.hash, 'tab=journal', '網址帶 tab=journal');
    await app.click('#tabbar [data-tab-id="ride"]');
    await app.at('/ride');
    await app.click('#tabbar [data-tab-id="album"]');
    await app.at('/album');
    t.eq(app.route().query.get('tab'), 'journal', '切回來 query 還是 journal');
    t.ok(app.$('.pill.is-active[data-tab="journal"]'), '日誌 pill 亮著');
    t.ok(!app.$('[data-panel="journal"]').classList.contains('u-hidden'), '日誌 panel 顯示');
    /* 再按一次收藏 tab：回到根（明信片） */
    await app.click('#tabbar [data-tab-id="album"]');
    await app.at('/album');
    t.ok(app.$('.pill.is-active[data-tab="cards"]'), '在收藏 tab 上再按一次回到根');
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
    t.eq(app.APP.store.get('trip').phase, 'matching', '一開始配對中');
    await app.waitFor(function () { return app.APP.store.get('trip').phase === 'riding'; }, 3000, '計時器切到行程中');
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
});
