/* 行程 module（APP.ride.trip，ride.js）：store.trip 只有它讀寫（ARCHITECTURE.md §3.3、§7）。
   在 node 裡直接載 ride.js，時間用 loadApp({ now }) 注入；畫面與流程仍在 tests/specs/ride.spec.js、flows.spec.js。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './helpers.mjs';

const NOW = '2026-09-26T10:00:00+08:00';
const NOW_ISO = new Date(NOW).toISOString();
const VIEWS = ['ride', 'explore-fx', 'explore-cards'];
const load = (o = {}) => loadApp(Object.assign({ views: VIEWS, now: NOW }, o));
const raw = (APP) => APP.store.get('trip');
/* vm 裡的物件原型跟這裡不同：跟字面量比之前先變成普通物件 */
const plain = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));

test('phase：配對中由 startedAt＋MATCH_MS 推導，不靠計時器', () => {
  const { APP } = load();
  const T = APP.ride.trip, M = APP.ride.MATCH_MS;
  const t0 = Date.parse('2026-09-21T13:18:00.000Z');
  const trip = { placeId: 'lake', phase: 'matching', startedAt: new Date(t0).toISOString(), rated: false, km: 6.4 };
  assert.equal(T.phase(trip, t0), 'matching', '剛叫車：配對中');
  assert.equal(T.phase(trip, t0 + M - 1), 'matching', 'MATCH_MS 之前：配對中');
  assert.equal(T.phase(trip, t0 + M), 'riding', 'MATCH_MS 之後：行程中');
  assert.equal(T.phase({ ...trip, phase: 'done' }, t0), 'done', 'done 不受時間影響');
  assert.equal(T.phase({ ...trip, phase: 'riding' }, t0), 'riding', 'riding 不受時間影響');
  assert.equal(T.phase({ ...trip, startedAt: 'x' }, t0), 'riding', '壞掉的 startedAt 不會永遠卡在配對中');
  assert.equal(T.phase(null), null, '沒有行程');
});

test('start：行程的形狀只有一份；km 用地方的距離，距離不明是 null；新的一趟取代舊的', () => {
  const { APP } = load();
  const T = APP.ride.trip, F = APP.fmt;
  const t = T.start('neiwan', 'route');
  assert.deepEqual(plain(raw(APP)), {
    placeId: 'neiwan', phase: 'matching', startedAt: NOW_ISO, rated: false,
    km: F.km(APP.place('neiwan').dist), via: 'route',
  });
  assert.deepEqual(t, raw(APP), '回傳寫進去的那一趟');
  assert.equal(T.active(), raw(APP), '配對中算進行中');
  T.start('p6');
  assert.equal(raw(APP).placeId, 'p6', '新的一趟取代舊的');
  assert.equal(raw(APP).km, null, '十八尖山距離不明：km 是 null，不是 0');
  assert.equal(raw(APP).via, null, '沒給入口就是 null');
  assert.equal(T.start('no-such-place'), null, '認不得的地方不叫車');
  assert.equal(raw(APP).placeId, 'p6', '也不動原本那一趟');
});

test('認不得的 placeId：讀的時候當作沒有，clearBroken 才真的清', () => {
  const { APP } = load();
  const T = APP.ride.trip;
  APP.store.set('trip', { placeId: 'no-such-place', phase: 'riding', startedAt: NOW_ISO, rated: false, km: 1 });
  assert.equal(T.current(), null);
  assert.equal(T.active(), null);
  assert.equal(T.pending(), null);
  assert.equal(T.arrive(), null, '壞掉的行程不能抵達');
  assert.equal(T.cancel(), false, '也沒有東西可以取消');
  assert.ok(raw(APP), '讀不會清');
  T.clearBroken();
  assert.equal(raw(APP), null, 'clearBroken 清掉');
  T.start('moat');
  T.clearBroken();
  assert.equal(raw(APP).placeId, 'moat', '好的行程 clearBroken 不碰');
});

test('toRiding／arrive／rate／cancel：各自只改自己那一段', () => {
  const { APP } = load();
  const T = APP.ride.trip;
  T.start('lake', 'k1');
  assert.equal(T.toRiding(), true);
  assert.equal(raw(APP).phase, 'riding');
  assert.equal(T.toRiding(), false, '已經在行程中：不再寫');
  assert.equal(T.arrivedAt('lake'), null, '還沒抵達');
  assert.equal(T.arrive().phase, 'done');
  assert.equal(T.active(), null, '抵達之後不算進行中');
  assert.equal(T.arrivedAt('lake'), raw(APP), '搭車抵達這裡的那一趟');
  assert.equal(T.arrivedAt('moat'), null, '別的地方不是');
  assert.equal(T.cancel(), false, '抵達之後不能取消');
  const r = T.rate(4);
  assert.equal(r.rated, true);
  assert.equal(r.stars, 4);
  assert.equal(raw(APP).via, 'k1', '評分不動歸因');
  T.clear();
  assert.equal(raw(APP), null);
  T.start('lake');
  assert.equal(T.cancel(), true, '配對中可以取消');
  assert.equal(raw(APP), null);
  assert.equal(T.rate(5), null, '沒有行程不能評分');
});

test('pending：抵達了、明信片還沒收的那一趟；限定版只給走不到的地方', () => {
  const { APP, STATE } = load();
  const T = APP.ride.trip;
  T.start('neiwan', 'route');
  assert.equal(T.pending(), null, '還沒抵達');
  T.arrive();
  const p = T.pending();
  assert.equal(p.card, APP.place('neiwan').card);
  assert.equal(p.limited, true, '內灣走不到：限定版');
  assert.equal(p.href, '#/unlock/neiwan?ride=1');
  STATE.collect(p.card, { by: 'walk', date: '09.26' });
  assert.equal(T.pending(), null, '收過了就沒有東西要等');
  T.start('glass-kiln');
  T.arrive();
  const near = APP.place('glass-kiln');
  if (STATE.has(near.card)) assert.equal(T.pending(), null, '收過了就沒有東西要等');
  else assert.equal(T.pending().limited, false, '走得到的地方不是限定版');
});

test('consume：用掉這一趟、記下 rideVia、回傳 { via, km }；別的地方不碰', () => {
  const { APP } = load();
  const T = APP.ride.trip;
  T.start('neiwan', 'route');
  T.arrive();
  assert.equal(T.consume('moat'), null, '別的地方不是這一趟');
  assert.ok(raw(APP), '行程還在');
  const card = APP.place('neiwan').card;
  assert.deepEqual(plain(T.consume(card)), { via: 'route', km: APP.fmt.km(APP.place('neiwan').dist) }, '明信片 id 也認得');
  assert.equal(raw(APP), null, '用掉了');
  assert.equal(APP.store.get('rideVia')[card], 'route', '歸因記在 rideVia');
  T.start('lake');
  T.arrive();
  const lakeCard = APP.place('lake').card;
  const lakeKm = APP.fmt.km(APP.place('lake').dist);
  assert.deepEqual(plain(T.consume('lake')), { via: null, km: lakeKm });
  assert.equal(lakeCard in APP.store.get('rideVia'), false, '沒有歸因就不寫');
});

test('collect：有搭 yoxi 抵達這裡的那一趟才算搭車並用掉它；走路收別的地方不碰（還沒領的限定版不會消失）', () => {
  const { APP, STATE } = load();
  const T = APP.ride.trip;
  T.start('neiwan', 'k1');
  T.arrive();
  const km0 = STATE.all.km;
  assert.equal(APP.explore.collect('moat', { note: '走過去的' }), true);
  const walked = STATE.card(APP.place('moat').card);
  assert.equal(walked.by, 'walk', '沒有抵達這裡的那一趟 → 走路');
  assert.equal(walked.note, '走過去的');
  assert.equal(STATE.all.km - km0, Math.round(APP.fmt.km(APP.place('moat').dist)), '走路的公里是地方的距離（STATE 累加到總里程）');
  assert.equal(APP.store.get('cardStyle')[APP.place('moat').card], 'woodcut', '走路收的照規則：九月是秋天 → 木刻版畫');
  const mk = APP.store.get('cardMarks')[APP.place('moat').card];
  assert.deepEqual([mk.fest, mk.mile], ['moon', 0], '9/26 在 115 年中秋那一週（9/21–9/28）：記下中秋，走路沒有里程紀念');
  assert.ok(T.arrivedAt('neiwan'), '走路收別的地方：行程還在');
  const km1 = STATE.all.km;
  APP.explore.collect('neiwan');
  const card = APP.place('neiwan').card;
  const rode = STATE.card(card);
  assert.equal(rode.by, 'ride', '有抵達的那一趟 → 搭車');
  assert.equal(STATE.all.km - km1, Math.round(APP.fmt.km(APP.place('neiwan').dist)), '公里是這一趟的');
  assert.equal(APP.store.get('cardStyle')[card], 'gold', '搭 yoxi 抵達是金框');
  assert.equal(raw(APP), null, '搭車收下：用掉');
  assert.equal(APP.store.get('rideVia')[card], 'k1', '歸因記在 rideVia');
});

test('collect：款式與節慶照收下那天的規則記下；收過了不改（換了季節也不改）', () => {
  const { APP, STATE } = load({ now: '2026-09-25T10:00:00+08:00' });   /* 115 年的中秋 */
  APP.explore.collect('glass-kiln');
  const card = APP.place('glass-kiln').card;
  assert.equal(APP.store.get('cardStyle')[card], 'woodcut', '秋天 → 木刻版畫');
  assert.equal(APP.store.get('cardMarks')[card].fest, 'moon', '中秋當天 → 記下中秋');
  assert.equal(STATE.card(card).date, '09.25');
  assert.equal(APP.explore.collect('glass-kiln'), false, '同一天再收：一天一張，不收');
  APP.store.set('demoDate', '2027-01-15');
  assert.equal(APP.explore.collect('glass-kiln'), true, '別天再來：回訪也收一張');
  assert.equal(APP.store.get('cardStyle')[card], 'woodcut', '第一次那一張不改款式');
  assert.equal(APP.store.get('cardMarks')[card].fest, 'moon', '第一次那一張不改郵戳');
  assert.equal(APP.explore.cardOrigin(card).festival.key, 'moon', 'cardOrigin 讀記下的郵戳，不拿今天回推');
  assert.equal(APP.explore.cardOrigin(card, 2).style.key, 'ink', '回訪那一張照那一天的規則：一月是冬天 → 水墨');
});

test('collect：demoDate 撥到別天，收下的款式、郵戳、日期都跟著它', () => {
  const { APP, STATE } = load();
  APP.store.set('demoDate', '2027-02-06');   /* 116 年春節初一 */
  APP.explore.collect('moat');
  const card = APP.place('moat').card;
  assert.equal(APP.store.get('cardStyle')[card], 'ink', '二月是冬天 → 水墨');
  assert.equal(APP.store.get('cardMarks')[card].fest, 'spring', '春節那一週 → 春節');
  assert.equal(STATE.card(card).date, '02.06', '收下的日期是 demo 的那一天');
});

test('cardOrigin：搭車或走路、哪一款、金框、限定版、歸因只有這一個答案', () => {
  const { APP, STATE } = load();
  const O = APP.explore.cardOrigin, T = APP.ride.trip;
  assert.equal(O('p11'), null, '還沒收');
  /* demo 一開始就有的：p4 搭車（南寮漁港 8.2 km）、p1 走路 */
  const p4 = O('p4');
  assert.equal(p4.by, 'ride');
  assert.equal(p4.style.key, 'gold', '沒有款式紀錄的搭車卡是金框');
  assert.equal(p4.gold, true);
  assert.equal(p4.limited, APP.ride.limitedCard('p4'), '限定版＝ride.js 的判斷');
  const p1 = O('p1');
  assert.equal(p1.by, 'walk');
  assert.equal(p1.gold, !!p1.style.gold);
  assert.equal(p1.limited, false);
  assert.equal(p1.date, STATE.card('p1').date);
  /* 搭車去走得到的地方：金框、不是限定版 */
  T.arriveAt('glass-kiln');
  APP.explore.collect('glass-kiln');
  const near = O('p11');
  assert.deepEqual([near.by, near.style.key, near.gold, near.limited], ['ride', 'gold', true, false]);
  /* 搭車去走不到的地方：限定版，歸因跟著 */
  T.start('neiwan', 'route');
  T.arrive();
  APP.explore.collect('neiwan');
  const far = O('p9');
  assert.deepEqual([far.by, far.gold, far.limited, far.via], ['ride', true, true, 'route']);
  /* 里程紀念看累積：demo 的 14.6 km＋玻璃窯 0.9 km＝15.5，搭去內灣 28 km 跨過 30 */
  assert.equal(far.mile, 30, '跨過第一個里程');
  assert.ok(/里程紀念戳/.test(far.lines.join()) && /data-mark="mile"/.test(far.marks), '內灣：寫為什麼、卡面蓋里程戳');
  assert.equal(near.mile, 0, '玻璃窯：還沒跨過');
  assert.ok(!/data-mark="mile"/.test(near.marks), '玻璃窯：卡面沒有里程戳');
  assert.ok(/data-mark="first"/.test(near.marks) && near.first, '第一次來：首訪紀念戳');
  /* 走路收的：照規則不會是金框 */
  APP.explore.collect('moat');
  const walked = O('p19');
  assert.deepEqual([walked.by, walked.gold, walked.limited, walked.via, walked.mile], ['walk', false, false, null, 0]);
  assert.deepEqual([...walked.lines], ['秋天的畫風是木刻版畫', '第一次來，多蓋一枚首訪紀念戳', '中秋那一週去的，卡面有月亮和玉兔'],
    '為什麼：一條規則一句（第一次來、9/26 在中秋那一週）');
});

test('arriveAt（demo 搭 yoxi 抵達）：距離不明是 null 不是 0；同一個目的地保留叫車時間、公里、歸因、評分', () => {
  const { APP } = load();
  const T = APP.ride.trip;
  const t = T.arriveAt('p6');
  assert.deepEqual(plain(t), { placeId: 'p6', phase: 'done', startedAt: NOW_ISO, rated: false, km: null, via: null },
    '十八尖山：km null（以前寫成 0，行程完成頁印出起跳價）');
  const started = '2026-09-26T01:00:00.000Z';
  APP.store.set('trip', { placeId: 'neiwan', phase: 'riding', startedAt: started, rated: true, km: 27.5, via: 'route', stars: 3 });
  assert.deepEqual(plain(T.arriveAt('neiwan')), { placeId: 'neiwan', phase: 'done', startedAt: started, rated: true, km: 27.5, via: 'route' },
    '同一個目的地：保留叫車時間、評分、公里、歸因（星數不留，跟以前的 demoArrive 一樣）');
  APP.store.set('trip', { placeId: 'neiwan', phase: 'riding', startedAt: started, rated: true, km: null, via: 'route' });
  assert.equal(T.arriveAt('neiwan').km, APP.fmt.km(APP.place('neiwan').dist), '存的 km 是 null：重算');
  APP.store.set('trip', { placeId: 'lake', phase: 'riding', startedAt: started, rated: true, km: 6.4, via: 'e' });
  assert.deepEqual(plain(T.arriveAt('neiwan')), {
    placeId: 'neiwan', phase: 'done', startedAt: NOW_ISO, rated: false,
    km: APP.fmt.km(APP.place('neiwan').dist), via: null,
  }, '別的目的地：被這一趟取代');
  assert.equal(T.arriveAt('no-such-place'), null);
});

/* ---------------------------------------------------------------- 來回（去程 → 司機候車 → 回程） */

test('來回：start 多一個 round:true（單程的形狀不變）；phase 對 waiting／returning 是純函式', () => {
  const { APP } = load();
  const T = APP.ride.trip, F = APP.fmt;
  T.start('neiwan', 'route', { round: true });
  assert.deepEqual(plain(raw(APP)), {
    placeId: 'neiwan', phase: 'matching', startedAt: NOW_ISO, rated: false,
    km: F.km(APP.place('neiwan').dist), via: 'route', round: true,
  });
  T.start('neiwan', 'route', { round: false });
  assert.equal('round' in raw(APP), false, '單程不多寫 round:false');
  T.start('neiwan', 'route', null);
  assert.equal('round' in raw(APP), false, '沒給 opt 也是單程');
  const t0 = Date.parse(NOW_ISO);
  assert.equal(T.phase({ placeId: 'neiwan', phase: 'waiting', round: true, startedAt: NOW_ISO }, t0), 'waiting');
  assert.equal(T.phase({ placeId: 'neiwan', phase: 'returning', round: true, startedAt: NOW_ISO }, t0), 'returning');
});

test('來回的狀態機：配對中 → 去程 → 候車（waiting）→ 回程（back）→ 到家（done）；進行中一路到回程', () => {
  const { APP } = load();
  const T = APP.ride.trip;
  T.start('neiwan', 'k1', { round: true });
  assert.equal(T.waiting(), null, '配對中不是候車');
  assert.equal(T.back(), null, '還沒到不能回程');
  assert.equal(T.toRiding(), true);
  assert.equal(T.arrivedAt('neiwan'), null, '去程還沒到');
  assert.equal(T.pending(), null);
  assert.equal(T.arrive().phase, 'waiting', '來回的去程抵達 → 司機候車');
  assert.equal(T.active(), raw(APP), '候車仍是進行中（不能從旁邊改下車點）');
  assert.equal(T.waiting(), raw(APP), 'waiting() 是這一趟');
  assert.equal(T.arrivedAt('neiwan'), raw(APP), '候車中：搭 yoxi 抵達了這裡');
  assert.equal(T.arrivedAt('moat'), null);
  const p = T.pending();
  assert.equal(p && p.href, '#/unlock/neiwan?ride=1', '候車中：這一趟的明信片待收');
  assert.equal(p.limited, true);
  const r = T.back();
  assert.equal(r.phase, 'returning', 'back()：候車 → 回程');
  assert.equal(r.backAt, NOW_ISO, '記下按回程的時間');
  assert.equal(T.waiting(), null, '回程不是候車');
  assert.equal(T.active(), raw(APP), '回程仍是進行中');
  assert.equal(T.back(), null, '已經在回程：不再寫');
  assert.ok(T.arrivedAt('neiwan') && T.pending(), '回程中：還沒收的卡不會消失');
  assert.equal(T.arrive().phase, 'done', '回程抵達 → 到家');
  assert.equal(T.active(), null, '到家之後不算進行中');
  assert.ok(T.arrivedAt('neiwan') && T.pending(), '到家了還沒收：還收得到（產品決定）');
  assert.equal(T.arrive().phase, 'done', '到家之後再抵達：不動');
  assert.equal(raw(APP).round, true, '一路都還是來回');
  assert.equal(raw(APP).via, 'k1', '歸因一路留著');
});

test('來回的 arrive()＝下一個抵達的地方：配對中直接到候車；候車直接到家（demo）；單程照舊一步到 done', () => {
  const { APP } = load();
  const T = APP.ride.trip;
  T.start('lake', null, { round: true });
  assert.equal(T.arrive().phase, 'waiting', '配對中 → 候車');
  const home = T.arrive();
  assert.equal(home.phase, 'done', '候車 → 到家（demo 跳過回程）');
  assert.equal('backAt' in home, false, '沒按回程就沒有回程的時間');
  T.start('lake');
  assert.equal(T.arrive().phase, 'done', '單程：配對中 → done');
  assert.equal(T.back(), null, '單程沒有回程');
});

test('來回的 consume：記 collected、行程留著（司機還在等）；同一趟不給第二張；到家才記進行程紀錄', () => {
  const { APP, STATE } = load();
  const T = APP.ride.trip, R = APP.ride, F = APP.fmt;
  const card = APP.place('neiwan').card;
  const km = F.km(APP.place('neiwan').dist);
  T.start('neiwan', 'route', { round: true });
  T.arrive();
  assert.equal(T.consume('moat'), null, '別的地方不是這一趟');
  /* 收下走 explore 的 collect（跟 /unlock 同一條路）：它問 arrivedAt 決定搭車，再叫 consume */
  assert.equal(APP.explore.collect('neiwan'), true);
  assert.equal(STATE.card(card).by, 'ride', '候車時收下：算搭車');
  assert.equal(APP.store.get('cardStyle')[card], 'gold', '搭 yoxi 抵達是金框');
  const t = raw(APP);
  assert.ok(t, '來回收下之後行程還在');
  assert.deepEqual([t.phase, t.collected, t.round], ['waiting', true, true], '還在候車、記下收過了');
  assert.equal(APP.store.get('rideVia')[card], 'route', '歸因照樣記在 rideVia');
  assert.equal(T.waiting(), raw(APP), '司機還在等：waiting() 還是這一趟（explore 收完回 /trip 看它）');
  assert.equal(T.arrivedAt('neiwan'), null, '收過了：不再算「搭車抵達、待收」');
  assert.equal(T.pending(), null, '沒有待收的');
  assert.equal(T.consume(card), null, '同一趟不再給第二張');
  assert.equal(R.pastTrips().filter((x) => x.card === card)[0].round, false, '還沒到家：行程紀錄先不寫來回');
  T.back();
  assert.equal(R.pastTrips().filter((x) => x.card === card)[0].round, false, '回程中：也還不寫');
  T.arrive();
  assert.equal(raw(APP).phase, 'done');
  assert.equal(APP.store.get('rideRound')[card + '#1'], true, '到家而且收了：記進行程紀錄（第 1 次）');
  const row = R.pastTrips().filter((x) => x.card === card)[0];
  assert.equal(row.round, true, '行程紀錄：來回');
  assert.equal(row.km, km, '公里是單程的（回程一樣遠）');
  assert.equal(T.pending(), null, '到家、收過了：沒有東西要等（/ride 會安靜清掉）');
  T.clear();
  assert.equal(R.pastTrips().filter((x) => x.card === card)[0].round, true, '行程清掉之後紀錄還在');
});

test('來回到家之後才收：收下那一刻就記進行程紀錄；rideVia 的其他歸因不受影響', () => {
  const { APP } = load();
  const T = APP.ride.trip, R = APP.ride;
  const card = APP.place('glass-kiln').card;
  T.start('glass-kiln', 'e', { round: true });
  T.arrive(); T.back(); T.arrive();
  assert.equal(raw(APP).phase, 'done');
  assert.equal((APP.store.get('rideRound') || {})[card + '#1'], undefined, '還沒收：不記');
  assert.ok(T.pending(), '到家了還收得到');
  APP.explore.collect('glass-kiln');
  assert.deepEqual([raw(APP).phase, raw(APP).collected], ['done', true], '收下：行程留著、記 collected');
  assert.equal(APP.store.get('rideRound')[card + '#1'], true, '收下那一刻就記進行程紀錄');
  assert.equal(APP.store.get('rideVia')[card], 'e', '歸因也在');
  assert.equal(APP.explore.cardOrigin(card).via, 'e', 'cardOrigin 讀得到歸因');
  assert.equal(R.pastTrips().filter((x) => x.card === card)[0].round, true);
});

test('來回的 cancel：去程取消整趟；候車／回程是「不搭回程了」→ 退回單程的已抵達（還沒收），收過了就清掉；都不記來回', () => {
  const { APP } = load();
  const T = APP.ride.trip;
  T.start('lake', 'e', { round: true });
  assert.equal(T.cancel(), true, '去程可以取消');
  assert.equal(raw(APP), null, '整趟清掉');

  T.start('lake', 'e', { round: true });
  T.arrive();
  const s0 = raw(APP).startedAt;
  assert.equal(T.cancel(), true, '候車中可以不搭回程');
  assert.deepEqual(plain(raw(APP)), {
    placeId: 'lake', phase: 'done', startedAt: s0, rated: false, km: APP.fmt.km(APP.place('lake').dist), via: 'e',
  }, '退回單程的「已抵達」：形狀跟單程一樣，沒有 round');
  assert.ok(T.pending(), '去程到了，還沒收的卡還收得到');
  assert.equal(T.cancel(), false, '已抵達不算進行中：不能再取消');

  T.start('lake', 'e', { round: true });
  T.arrive();
  APP.explore.collect('lake');
  T.back();
  assert.equal(T.cancel(), true, '回程中可以取消');
  assert.equal(raw(APP), null, '卡收過了：沒有東西要等，清掉');
  assert.equal((APP.store.get('rideRound') || {})[APP.place('lake').card + '#1'], undefined, '回程沒搭完：行程紀錄不寫來回');
});

test('來回的 arriveAt（demo 搭 yoxi 抵達）：同一個目的地、還在去程或候車 → 候車（來回留著）；已經回程 → 當成新的一次單程抵達', () => {
  const { APP } = load();
  const T = APP.ride.trip;
  T.start('neiwan', 'route', { round: true });
  const w = T.arriveAt('neiwan');
  assert.deepEqual([w.phase, w.round, w.via, w.km], ['waiting', true, 'route', APP.fmt.km(APP.place('neiwan').dist)], '去程 → 候車，來回與歸因都留著');
  assert.equal(T.arriveAt('neiwan').phase, 'waiting', '候車中再按一次：還是候車');
  T.back();
  const d = T.arriveAt('neiwan');
  assert.deepEqual([d.phase, 'round' in d], ['done', false], '回程中：新的一次搭車抵達（單程）');
  T.start('neiwan', 'route', { round: true });
  const other = T.arriveAt('lake');
  assert.deepEqual([other.placeId, other.phase, 'round' in other, other.via], ['lake', 'done', false, null], '別的目的地：被取代');
  APP.store.set('trip', Object.assign({}, raw(APP), { placeId: 'neiwan', phase: 'riding', round: true, km: null }));
  assert.equal(T.arriveAt('neiwan').km, APP.fmt.km(APP.place('neiwan').dist), '存的 km 是 null：重算');
});

test('pending／arrivedAt 問 APP.explore.canCollect（每一次去都有一張、一天一張）；沒有才退回 STATE.has', () => {
  const { APP, STATE } = load();
  const T = APP.ride.trip;
  const card = APP.place('market').card;
  assert.ok(STATE.has(card), '前提：demo 已經收過東門市場（九月初）');
  T.arriveAt('market');
  const p = T.pending();
  assert.equal(p && p.card, card, '收過、今天還沒收：回訪也有這一次的明信片待收');
  assert.equal(p && p.limited, false, '回訪不是限定版');
  assert.equal(T.arrivedAt('market'), raw(APP), 'arrivedAt 不看收過沒有');
  const real = APP.explore.canCollect;
  APP.explore.canCollect = () => false;
  assert.equal(T.pending(), null, 'canCollect 說收不到（今天收過）：沒有待收');
  delete APP.explore.canCollect;
  assert.equal(T.pending(), null, '沒有 canCollect：收過了就沒有待收（退回 STATE.has）');
  APP.explore.canCollect = real;
  APP.explore.collect('market');
  assert.equal(raw(APP), null, '收下這一次：單程的行程用掉');
  T.arriveAt('market');
  assert.equal(T.pending(), null, '同一天再搭車到這裡：今天收過了，沒有待收');
});

test('來回的車資＝去程＋候車費＋回程（每一段 fare(km)）；距離不明是 null', () => {
  const { APP } = load();
  const R = APP.ride, F = APP.fmt;
  const km = F.km(APP.place('lake').dist);
  const f = R.roundFare(km);
  assert.deepEqual(plain(f), { go: F.fare(km), wait: R.WAIT_FEE, back: F.fare(km), total: F.fare(km) * 2 + R.WAIT_FEE });
  assert.equal(R.roundFare(null), null, '距離不明：不算');
  assert.ok(R.WAIT_MAX_MIN > 0 && R.WAIT_FEE >= 0, '等候上限與候車費是常數');
});

test('點數：來回的回程另一列搭車回饋；城事解鎖回饋只給走不到的地方；總數仍＝明細相加', () => {
  const { APP } = load();
  const T = APP.ride.trip, R = APP.ride, F = APP.fmt;
  const rows0 = R.pointsRows().length, total0 = R.pointsTotal();
  /* 走得到的玻璃工坊搭來回：兩列搭車回饋、沒有城事解鎖回饋 */
  const near = APP.place('glass-kiln');
  T.start('glass-kiln', 'e', { round: true });
  T.arrive(); APP.explore.collect('glass-kiln'); T.back(); T.arrive();
  const nearKm = F.km(near.dist), nearAmt = Math.floor(F.fare(nearKm) / R.FARE_PER_POINT);
  const toOf = (card) => R.pastTrips().filter((x) => x.card === card)[0].to;   /* 列上的地名是明信片的名字 */
  const nearRows = R.pointsRows().filter((r) => r.place === toOf(near.card));
  assert.deepEqual(plain(nearRows.map((r) => [r.src, r.amt, !!r.round])), [['搭車回饋', nearAmt, false], ['搭車回饋', nearAmt, true]], '去程、回程各一列');
  assert.ok(nearRows[1].name.indexOf('回程') >= 0, '回程那一列寫回程');
  assert.equal(R.pointsTotal() - total0, nearAmt * 2, '走得到的地方：沒有 +RIDE_BONUS');
  /* 走不到的內灣搭來回：兩列搭車回饋＋一列城事解鎖回饋 */
  const far = APP.place('neiwan');
  const t1 = R.pointsTotal();
  T.start('neiwan', 'route', { round: true });
  T.arrive(); APP.explore.collect('neiwan'); T.back(); T.arrive();
  const farAmt = Math.floor(F.fare(F.km(far.dist)) / R.FARE_PER_POINT);
  assert.equal(R.pointsTotal() - t1, farAmt * 2 + R.RIDE_BONUS, '內灣：去程＋回程的搭車回饋＋城事解鎖回饋');
  assert.equal(R.pointsRows().filter((r) => r.city && r.place === toOf(far.card)).length, 1, '城事解鎖回饋一張卡一次');
  assert.equal(R.pointsRows().length, rows0 + 2 + 3);
  assert.equal(R.pointsTotal(), R.pointsRows().reduce((a, r) => a + r.amt, 0), '總數＝明細相加');
});

test('snapTarget（拉面板放手停哪一段）：點一下不換、只往拖的方向換、兩段可選挑最近的、甩出去的慣性算進去', () => {
  const { APP } = load();
  const snap = APP.ride.snapTarget;
  const order = ['handle', 'collapsed', 'expanded'];
  const h = { handle: 44, collapsed: 300, expanded: 700 };
  assert.equal(snap(order, h, 'collapsed', 8, 300, 0), 'collapsed', '移動 ≤ 8 px 不換段');
  assert.equal(snap(order, h, 'collapsed', -8, 300, 0), 'collapsed');
  assert.equal(snap(order, h, 'collapsed', 50, 300, 0), 'expanded', '往上拖一點：往上那一段');
  assert.equal(snap(order, h, 'collapsed', -50, 300, 0), 'handle', '往下拖一點：往下那一段');
  assert.equal(snap(order, h, 'expanded', -20, 700, 0), 'collapsed', '往下有兩段：挑離放手高度近的');
  assert.equal(snap(order, h, 'expanded', -600, 700, 0), 'handle', '拖到底：最低那一段');
  assert.equal(snap(order, h, 'expanded', -200, 700, 0), 'collapsed', '放在 500：collapsed 比較近');
  assert.equal(snap(order, h, 'expanded', -200, 700, -3), 'handle', '同一個位置用力往下甩：慣性帶到最低');
  assert.equal(snap(order, h, 'handle', 200, 44, 1.5), 'collapsed', '往上甩但不夠遠：停在中間');
  assert.equal(snap(order, h, 'handle', 400, 44, 1.5), 'expanded', '往上甩得夠遠：到最上面');
  assert.equal(snap(order, h, 'expanded', 100, 700, 1.5), 'expanded', '已經在最上面還往上：不換');
  assert.equal(snap(order, h, 'handle', -30, 44, -1), 'handle', '已經在最下面還往下：不換');
});
