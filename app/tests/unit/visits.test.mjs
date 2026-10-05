/* 每一次來都收一張（explore-cards.js 的 visits／canCollect／recentVisits／rideKm／totalKm） */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './helpers.mjs';

const NOW = '2026-09-26T10:00:00+08:00';     /* 115 年中秋那一週（9/21–9/28）裡 */
const load = (o = {}) => loadApp(Object.assign({ views: ['ride', 'explore-fx', 'explore-fest', 'explore-cards', 'album'], now: NOW }, o));
const collect = (APP, id, opt) => {
  if (!APP.ride.trip.arrivedAt(id)) APP.ride.trip.arriveAt(id);
  return APP.explore.collect(id, opt);
};
const plain = (o) => JSON.parse(JSON.stringify(o));

test('visits：第一次在 STATE、第二次起在 store.visits；同一個地方同一天一張', () => {
  const { APP, STATE } = load();
  const E = APP.explore;
  assert.deepEqual(plain(E.visits('p11')), [], '還沒收過：沒有');
  assert.equal(E.canCollect('glass-kiln'), true, '還沒收過：收得到（地點 id 也認得）');
  assert.equal(E.canCollect('nope'), false, '不認得的明信片：收不到');
  const one = E.visits('p1');
  assert.equal(one.length, 1);
  assert.deepEqual([one[0].v, one[0].first, one[0].md], [1, true, STATE.card('p1').date], 'demo 的卡：第一次、日期照 STATE');
  assert.equal(E.canCollect('p1'), true, 'demo 的卡是九月初收的：今天可以再收一張');

  const n0 = STATE.count();
  assert.equal(collect(APP, 'station', { note: '又來了' }), true, '回訪：收到一張');
  assert.equal(STATE.count(), n0, '圖鑑（STATE）不多一張');
  const two = E.visits('p1');
  assert.deepEqual(plain(two.map((x) => x.v)), [1, 2], '第二次記在後面');
  assert.deepEqual([two[1].first, two[1].ymd, two[1].by, two[1].note, two[1].fest], [false, '2026-09-26', 'ride', '又來了', 'moon']);
  assert.equal(E.canCollect('p1'), false, '今天收過了：一天一張');
  assert.equal(collect(APP, 'station'), false, '同一天再收：不收');
  assert.equal(E.visits('p1').length, 2);
  APP.store.set('demoDate', '2026-12-20');
  assert.equal(E.canCollect('p1'), true, '別天：又收得到');
  assert.equal(collect(APP, 'station'), true);
  assert.equal(E.cardOrigin('p1', 3).style.key, 'gold', '第三次：搭 yoxi 抵達，不分季節是金框');
  assert.equal(E.cardOrigin('p1', 3).first, false, '回訪沒有首訪紀念');
  assert.ok(!/data-mark="first"/.test(E.cardOrigin('p1', 3).marks), '回訪卡面不蓋首訪戳');
  assert.ok(/data-mark="first"/.test(E.cardOrigin('p1').marks), '第一次那一張蓋首訪戳');
  assert.equal(E.cardOrigin('p1', 9), null, '沒有第 9 次');
  assert.equal(E.cardOrigin('p1').visits, 3, '這個地方收過幾張');
});

test('收下當天第一次收的地方：同一天不能再收；隔天就是第 2 次', () => {
  const { APP } = load();
  const E = APP.explore;
  assert.equal(collect(APP, 'moat'), true);
  const card = APP.place('moat').card;
  assert.equal(APP.store.get('cardMarks')[card].ymd, '2026-09-26', '第一次也記下年月日（一天一張要看）');
  assert.equal(E.canCollect(card), false, '今天收的：今天不能再收');
  APP.store.set('demoDate', '2026-09-27');
  assert.equal(E.canCollect(card), true, '隔天：可以');
  assert.equal(E._.arrivalAt(APP.place('moat')).v, 2, '這一次是第 2 次');
});

test('recentVisits：每一次都算一張，最新的在前；demo 的 8 張照 STATE 的順序排在最舊', () => {
  const { APP, STATE } = load();
  const E = APP.explore;
  const ids = Object.keys(STATE.all.cards);
  assert.deepEqual(plain(E.recentVisits().map((x) => x.card)), ids.slice().reverse(), '一開始：STATE 收下的順序，最後收的在前');
  collect(APP, 'glass-kiln');
  collect(APP, 'station');
  assert.deepEqual(plain(E.recentVisits(3).map((x) => x.card + '#' + x.v)), ['p1#2', 'p11#1', ids[ids.length - 1] + '#1'], '回訪的那一張在最前面');
  assert.equal(E.recentVisits().length, ids.length + 2);
});

test('rideKm：搭 yoxi 去收明信片的公里累積（回訪也算）；totalKm：STATE 的總里程加上回訪', () => {
  const { APP, STATE } = load();
  const E = APP.explore, T = APP.ride.trip, F = APP.fmt;
  const km = (id) => F.km(APP.place(id).dist);
  const demo = Math.round((km('p4') + km('p8')) * 10) / 10;
  assert.equal(E.rideKm(), demo, 'demo 的兩張搭車卡：南寮＋青草湖');
  assert.equal(E.totalKm(), STATE.all.km, '還沒回訪：跟 STATE 一樣');
  T.arriveAt('neiwan');
  assert.equal(E._.arrivalAt(APP.place('neiwan')).rule.mile, 30, '搭去內灣會跨過 30');
  collect(APP, 'neiwan');
  assert.equal(E.rideKm(), Math.round((demo + km('neiwan')) * 10) / 10, '內灣這一趟算進去');
  assert.equal(E.cardOrigin('p9').mile, 30, '卡上記的是跨過的那一個里程');
  const before = E.rideKm();
  collect(APP, 'station');                                   /* 搭車回訪 */
  assert.equal(E.rideKm(), Math.round((before + km('station')) * 10) / 10, '搭車回訪也算里程');
  assert.equal(E.totalKm(), STATE.all.km + Math.round(km('station')), '留下的距離：回訪也加進去');
  APP.store.set('demoDate', '2026-10-03');
  T.arriveAt('neiwan');
  collect(APP, 'neiwan');                                    /* 搭車回訪內灣：再 28 km，跨過 60 */
  assert.equal(E.cardOrigin('p9', 2).mile, 60, '回訪的那一趟也算、跨過 60');
  assert.equal(E.cardOrigin('p9', 2).limited, false, '回訪不是限定版（+50 只給第一次）');
  assert.equal(E.cardOrigin('p9', 2).gold, true, '搭 yoxi 抵達還是金框');
});

test('collect：沒有這個地方已抵達的行程，不可新收或回訪；舊到訪資料保持原樣', () => {
  const { APP, STATE } = load();
  const E = APP.explore, T = APP.ride.trip;
  const before = plain({ state: STATE.all, store: APP.store.all });
  assert.equal(E.collect('glass-kiln'), false, '未抵達不可收新卡');
  assert.equal(E.collect('station'), false, '未抵達不可回訪');
  assert.equal(E._.arrivalAt(APP.place('glass-kiln')).rule, null, '未抵達不宣稱取得任何款式');
  assert.deepEqual(plain({ state: STATE.all, store: APP.store.all }), before, '沒有寫入任何收藏或行程');
  assert.equal(E.cardOrigin('p1').by, 'walk', '歷史到訪方式仍保留');
  assert.equal(E.cardOrigin('p1').style.key, 'woodcut', '歷史季節款仍保留');
  T.start('glass-kiln', 'e');
  assert.equal(E.collect('glass-kiln'), false, '車程進行中尚未抵達');
  T.arriveAt('neiwan');
  assert.equal(E.collect('glass-kiln'), false, '抵達別的地方不能收這張');
  assert.ok(T.arrivedAt('neiwan'), '別處待收行程保留');
  assert.equal(E.collect('neiwan'), true, '抵達目標才可以收');
});

test('demoArrive：舊 walk 呼叫拒絕且不建立新到訪；省略方式只建立搭車抵達', () => {
  const { APP, STATE, ctx } = load({ views: ['system', 'ride', 'explore-fx', 'explore-fest', 'explore-cards'] });
  ctx.document = { getElementById: () => null };
  APP.ui.toast = () => {};
  let route = '';
  APP.nav.go = (path) => { route = path; };
  const before = plain({ state: STATE.all, store: APP.store.all });
  assert.equal(APP.system.demoArrive('glass-kiln', 'walk'), false);
  assert.equal(route, '', '不進抵達頁');
  assert.deepEqual(plain({ state: STATE.all, store: APP.store.all }), before, '不改寫舊交通方式或建立新資料');
  assert.equal(APP.explore.collect('glass-kiln'), false);
  assert.equal(APP.system.demoArrive('glass-kiln'), true);
  assert.ok(APP.ride.trip.arrivedAt('glass-kiln'));
  assert.equal(APP.explore.collect('glass-kiln'), true);
  assert.equal(APP.explore.cardOrigin('p11').by, 'ride');
});

test('搭車回訪：行程紀錄與點數每一次都算（回訪不給城事解鎖回饋）；回訪的歸因記在那一次、不蓋掉第一次', () => {
  const { APP } = load();
  const E = APP.explore, T = APP.ride.trip, R = APP.ride, F = APP.fmt;
  T.start('neiwan', 'route');
  T.arrive();
  collect(APP, 'neiwan');
  const card = APP.place('neiwan').card;
  assert.equal(APP.store.get('rideVia')[card], 'route', '第一次的歸因');
  const rows0 = R.pastTrips().filter((x) => x.card === card);
  assert.equal(rows0.length, 1);
  const total0 = R.pointsTotal();
  APP.store.set('demoDate', '2026-10-03');
  T.start('neiwan', 'k1');
  T.arrive();
  collect(APP, 'neiwan');
  assert.equal(APP.store.get('rideVia')[card], 'route', '回訪不蓋掉第一次的歸因');
  assert.equal(E.cardOrigin(card, 2).via, 'k1', '回訪的歸因記在那一次');
  const rows = R.pastTrips().filter((x) => x.card === card);
  assert.deepEqual(plain(rows.map((x) => [x.v, x.limited, x.via])), [[2, false, 'k1'], [1, true, 'route']], '行程紀錄：兩次，新的在前；限定版只有第一次');
  const km = F.km(APP.place('neiwan').dist);
  assert.equal(R.pointsTotal() - total0, Math.floor(F.fare(km) / R.FARE_PER_POINT), '回訪只多一列搭車回饋，沒有城事解鎖回饋');
  assert.equal(R.pointsTotal(), R.pointsRows().reduce((t, r) => t + r.amt, 0), '總數仍＝明細相加');
});

test('來回回訪：到家而且收了，行程紀錄記在那一次（rideRound 的 <卡>#<第幾次>）', () => {
  const { APP } = load();
  const E = APP.explore, T = APP.ride.trip;
  const card = APP.place('market').card;
  T.start('market', 'e', { round: true });
  T.arrive();                                   /* 抵達：司機候車 */
  assert.ok(T.waiting(), '候車中');
  collect(APP, 'market');                          /* 東門市場 demo 收過（p2）：這是第 2 次 */
  assert.equal(E.visits(card).length, 2);
  assert.ok(T.waiting(), '收下之後司機還在等');
  T.back();
  T.arrive();                                   /* 到家 */
  assert.equal(APP.store.get('rideRound')[card + '#2'], true, '記在第 2 次');
  assert.equal(APP.store.get('rideRound')[card + '#1'], undefined, '第一次（demo）不是來回');
  const row = APP.ride.pastTrips().find((x) => x.card === card && x.v === 2);
  assert.ok(row && row.round, '行程紀錄的那一列是來回');
});
