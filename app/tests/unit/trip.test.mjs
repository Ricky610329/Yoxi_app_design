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
  assert.deepEqual({ ...APP.store.get('cardMarks')[APP.place('moat').card] }, { fest: '', far: 0 }, '9/26 走路：沒有郵戳也記一筆');
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
  APP.store.set('demoDate', '2027-01-15');
  assert.equal(APP.explore.collect('glass-kiln'), false, '收過了：不是新收');
  assert.equal(APP.store.get('cardStyle')[card], 'woodcut', '收過了不改款式');
  assert.equal(APP.store.get('cardMarks')[card].fest, 'moon', '收過了不改郵戳');
  assert.equal(APP.explore.cardOrigin(card).festival.key, 'moon', 'cardOrigin 讀記下的郵戳，不拿今天回推');
});

test('collect：demoDate 撥到別天，收下的款式、郵戳、日期都跟著它', () => {
  const { APP, STATE } = load();
  APP.store.set('demoDate', '2027-02-06');   /* 116 年春節初一 */
  APP.explore.collect('moat');
  const card = APP.place('moat').card;
  assert.equal(APP.store.get('cardStyle')[card], 'ink', '二月是冬天 → 水墨');
  assert.equal(APP.store.get('cardMarks')[card].fest, 'spring', '除夕到初五 → 春節');
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
  assert.ok(APP.fmt.km(APP.place('neiwan').dist) >= APP.explore.FAR_KM, '前提：內灣超過遠行門檻');
  assert.equal(far.far, true, '遠行紀念：搭 yoxi FAR_KM 公里以上');
  assert.ok(far.far && /遠行紀念戳/.test(far.lines.join()) && /data-mark="far"/.test(far.marks), '內灣 28 km：寫為什麼、卡面蓋戳');
  assert.equal(near.far, false, '玻璃窯：不到門檻');
  assert.ok(!/data-mark/.test(near.marks), '玻璃窯：卡面沒有郵戳');
  /* 走路收的：照規則不會是金框 */
  APP.explore.collect('moat');
  const walked = O('p19');
  assert.deepEqual([walked.by, walked.gold, walked.limited, walked.via, walked.far], ['walk', false, false, null, false]);
  assert.deepEqual([...walked.lines], ['秋天的畫風是木刻版畫'], '為什麼：一條規則一句');
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
