/* 每一次來都收一張（explore-cards.js 的 visits／canCollect／recentVisits／rideKm／totalKm）
   與照進度累積的相框、稱號（album-rewards.js 的 rewards／look／setLook／cardHTML） */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './helpers.mjs';

const NOW = '2026-09-26T10:00:00+08:00';     /* 115 年中秋那一週（9/21–9/28）裡 */
const load = (o = {}) => loadApp(Object.assign({ views: ['ride', 'explore-fx', 'explore-fest', 'explore-cards', 'album', 'album-rewards'], now: NOW }, o));
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
  assert.equal(E.collect('station', { note: '又來了' }), true, '回訪：收到一張');
  assert.equal(STATE.count(), n0, '圖鑑（STATE）不多一張');
  const two = E.visits('p1');
  assert.deepEqual(plain(two.map((x) => x.v)), [1, 2], '第二次記在後面');
  assert.deepEqual([two[1].first, two[1].ymd, two[1].by, two[1].note, two[1].fest], [false, '2026-09-26', 'walk', '又來了', 'moon']);
  assert.equal(E.canCollect('p1'), false, '今天收過了：一天一張');
  assert.equal(E.collect('station'), false, '同一天再收：不收');
  assert.equal(E.visits('p1').length, 2);
  APP.store.set('demoDate', '2026-12-20');
  assert.equal(E.canCollect('p1'), true, '別天：又收得到');
  assert.equal(E.collect('station'), true);
  assert.equal(E.cardOrigin('p1', 3).style.key, 'ink', '第三次：十二月是冬天 → 水墨');
  assert.equal(E.cardOrigin('p1', 3).first, false, '回訪沒有首訪紀念');
  assert.ok(!/data-mark="first"/.test(E.cardOrigin('p1', 3).marks), '回訪卡面不蓋首訪戳');
  assert.ok(/data-mark="first"/.test(E.cardOrigin('p1').marks), '第一次那一張蓋首訪戳');
  assert.equal(E.cardOrigin('p1', 9), null, '沒有第 9 次');
  assert.equal(E.cardOrigin('p1').visits, 3, '這個地方收過幾張');
});

test('收下當天第一次收的地方：同一天不能再收；隔天就是第 2 次', () => {
  const { APP } = load();
  const E = APP.explore;
  assert.equal(E.collect('moat'), true);
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
  E.collect('glass-kiln');
  E.collect('station');
  assert.deepEqual(plain(E.recentVisits(3).map((x) => x.card + '#' + x.v)), ['p1#2', 'p11#1', ids[ids.length - 1] + '#1'], '回訪的那一張在最前面');
  assert.equal(E.recentVisits().length, ids.length + 2);
});

test('rideKm：搭 yoxi 去收明信片的公里累積（回訪也算、走路不算）；totalKm：STATE 的總里程加上回訪', () => {
  const { APP, STATE } = load();
  const E = APP.explore, T = APP.ride.trip, F = APP.fmt;
  const km = (id) => F.km(APP.place(id).dist);
  const demo = Math.round((km('p4') + km('p8')) * 10) / 10;
  assert.equal(E.rideKm(), demo, 'demo 的兩張搭車卡：南寮＋青草湖');
  assert.equal(E.totalKm(), STATE.all.km, '還沒回訪：跟 STATE 一樣');
  T.arriveAt('neiwan');
  assert.equal(E._.arrivalAt(APP.place('neiwan')).rule.mile, 30, '搭去內灣會跨過 30');
  E.collect('neiwan');
  assert.equal(E.rideKm(), Math.round((demo + km('neiwan')) * 10) / 10, '內灣這一趟算進去');
  assert.equal(E.cardOrigin('p9').mile, 30, '卡上記的是跨過的那一個里程');
  const before = E.rideKm();
  E.collect('station');                                   /* 走路回訪 */
  assert.equal(E.rideKm(), before, '走路不算里程');
  assert.equal(E.totalKm(), STATE.all.km + Math.round(km('station')), '留下的距離：回訪也加進去');
  APP.store.set('demoDate', '2026-10-03');
  T.arriveAt('neiwan');
  E.collect('neiwan');                                    /* 搭車回訪內灣：再 28 km，跨過 60 */
  assert.equal(E.cardOrigin('p9', 2).mile, 60, '回訪的那一趟也算、跨過 60');
  assert.equal(E.cardOrigin('p9', 2).limited, false, '回訪不是限定版（+50 只給第一次）');
  assert.equal(E.cardOrigin('p9', 2).gold, true, '搭 yoxi 抵達還是金框');
});

test('rewards：每一個都寫規則與「n/m」的進度，湊到就收下；沒有機率', () => {
  const { APP, STATE } = load();
  const R = APP.album.rewards();
  assert.ok(R.length >= 10, '相框與稱號都有');
  for (const r of R) {
    assert.ok(r.rule && /\d+\/\d+/.test(r.prog), r.key + '：有規則、有 n/m');
    assert.equal(r.got, r.done >= r.total, r.key + '：湊到才收下');
    assert.ok(!/機率|抽|保底|任務|完成|達成|挑戰|每日|排名/.test(r.name + r.rule + r.prog), r.key + '：沒有抽獎、沒有禁用詞');
  }
  const by = (k) => R.find((r) => r.key === k);
  const places = APP.album.visitedPlaces().length;
  assert.equal(by('bamboo').done, places, '竹塹：去過的地方');
  assert.equal(by('bamboo').got, places >= 5);
  assert.equal(by('road').total, APP.explore.MILE_STEPS[0], '里程相框：第一個里程');
  assert.equal(by('b1').got, STATE.badge('b1').got, '稱號跟著獎章');
  assert.equal(by('moon').got, false, '還沒在中秋那一週收過');
  APP.explore.collect('glass-kiln');                      /* 9/26 在中秋那一週 */
  assert.equal(APP.album.rewards().find((r) => r.key === 'moon').got, true, '中秋那一週收下一張：中秋相框');
  const friend = () => APP.album.rewards().find((r) => r.key === 'friend');
  assert.equal(friend().got, false);
  APP.explore.collect('station');
  APP.store.set('demoDate', '2026-10-01');
  APP.explore.collect('station');
  assert.equal(friend().done, 3, '新竹車站去了 3 次');
  assert.equal(friend().got, true, '同一個地方 3 次：老朋友相框');
});

test('look／setLook：沒選過用收下的第一個稱號、不套相框；還沒收下的選了也不算', () => {
  const { APP } = load();
  const A = APP.album;
  const firstTitle = A.rewards('title').find((r) => r.got);
  assert.deepEqual(plain(A.look()), { frame: null, title: { key: firstTitle.key, name: firstTitle.name } });
  A.setLook({ frame: 'bamboo', title: 'b3' });
  assert.deepEqual(plain(A.look()), { frame: { key: 'bamboo', name: '竹塹' }, title: { key: 'b3', name: '老車站的常客' } });
  A.setLook({ title: null });
  assert.equal(A.look().title, null, '選「不顯示」就不顯示');
  A.setLook({ frame: 'wind' });
  assert.equal(A.look().frame, null, '還沒收下的相框：不算');
});

test('cardHTML：那一次的明信片套上相框；還沒收的卡是空字串', () => {
  const { APP } = load();
  const A = APP.album;
  assert.equal(A.cardHTML('p11'), '', '還沒收');
  const h = A.cardHTML('p1', { frame: 'bamboo' });
  assert.ok(/data-frame="bamboo"/.test(h) && /data-card-art="p1"/.test(h) && /AI 生成示意/.test(h), '相框、卡面、AI 標示');
  assert.ok(/data-mark="first"/.test(h), '第一次那一張：首訪戳');
  APP.explore.collect('station');
  const h2 = A.cardHTML('p1', { v: 2, frame: '' });
  assert.ok(/data-card-visit="2"/.test(h2) && !/data-frame=/.test(h2), '第 2 次、不套相框');
  assert.ok(!/data-mark/.test(A.cardHTML('p1', { size: 'sm' })), '小卡不蓋戳');
});

test('搭車回訪：行程紀錄與點數每一次都算（回訪不給城事解鎖回饋）；回訪的歸因記在那一次、不蓋掉第一次', () => {
  const { APP } = load();
  const E = APP.explore, T = APP.ride.trip, R = APP.ride, F = APP.fmt;
  T.start('neiwan', 'route');
  T.arrive();
  E.collect('neiwan');
  const card = APP.place('neiwan').card;
  assert.equal(APP.store.get('rideVia')[card], 'route', '第一次的歸因');
  const rows0 = R.pastTrips().filter((x) => x.card === card);
  assert.equal(rows0.length, 1);
  const total0 = R.pointsTotal();
  APP.store.set('demoDate', '2026-10-03');
  T.start('neiwan', 'k1');
  T.arrive();
  E.collect('neiwan');
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
  E.collect('market');                          /* 東門市場 demo 收過（p2）：這是第 2 次 */
  assert.equal(E.visits(card).length, 2);
  assert.ok(T.waiting(), '收下之後司機還在等');
  T.back();
  T.arrive();                                   /* 到家 */
  assert.equal(APP.store.get('rideRound')[card + '#2'], true, '記在第 2 次');
  assert.equal(APP.store.get('rideRound')[card + '#1'], undefined, '第一次（demo）不是來回');
  const row = APP.ride.pastTrips().find((x) => x.card === card && x.v === 2);
  assert.ok(row && row.round, '行程紀錄的那一列是來回');
});
