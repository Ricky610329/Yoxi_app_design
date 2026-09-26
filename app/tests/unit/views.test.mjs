/* 各區塊匯出的純邏輯（ARCHITECTURE.md §7）：在 node 裡直接載 views，不開瀏覽器。
   時間用 loadApp({ now }) 注入，所以「今天落在週回顧的哪一段」四種情況每次都跑得到，
   不像瀏覽器測試只跑得到今天那一種。畫面與流程仍在 tests/specs/*.spec.js。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, memoryStorage } from './helpers.mjs';

const STATE_KEY = 'yoxi-chengshi-v1-2';
const TAIPEI = (mmdd) => '2026-' + mmdd.replace('.', '-') + 'T10:00:00+08:00';
const ids = (list) => list.map((p) => p.id).join(',');
/* system 不載：它的 demo 面板在 state:change 時會去畫 DOM（node 沒有 document） */
const VIEWS = ['ride', 'explore-fx', 'explore-cards', 'explore-gold', 'explore', 'explore-unlock', 'album'];

/* ---------------------------------------------------------------- ride */

test('phaseOf：配對中由 startedAt＋MATCH_MS 推導，不靠計時器', () => {
  const { APP } = loadApp({ views: ['ride'] });
  const R = APP.ride;
  const t0 = Date.parse('2026-09-21T13:18:00.000Z');
  const trip = { placeId: 'lake', phase: 'matching', startedAt: new Date(t0).toISOString(), rated: false, km: 6.4 };
  assert.equal(R.phaseOf(trip, t0), 'matching', '剛叫車：配對中');
  assert.equal(R.phaseOf(trip, t0 + R.MATCH_MS - 1), 'matching', 'MATCH_MS 之前：配對中');
  assert.equal(R.phaseOf(trip, t0 + R.MATCH_MS), 'riding', 'MATCH_MS 之後：行程中');
  assert.equal(R.phaseOf({ ...trip, phase: 'done' }, t0), 'done', 'done 不受時間影響');
  assert.equal(R.phaseOf({ ...trip, phase: 'riding' }, t0), 'riding', 'riding 不受時間影響');
  assert.equal(R.phaseOf({ ...trip, startedAt: 'x' }, t0), 'riding', '壞掉的 startedAt 不會永遠卡在配對中');
  assert.equal(R.phaseOf(null), null, '沒有行程');
});

test('點數：總數＝明細相加；城事列＝RIDE_BONUS＝MOCK.FAR_PLACE.ridePoints', () => {
  const { APP, MOCK } = loadApp({ views: ['ride', 'explore-fx', 'explore-cards'] });
  const R = APP.ride, F = APP.fmt;
  assert.equal(R.RIDE_BONUS, MOCK.FAR_PLACE.ridePoints);
  const rows = R.pointsRows();
  assert.ok(rows.length > 0, '有明細');
  assert.equal(R.pointsTotal(), rows.reduce((a, r) => a + r.amt, 0), '總數＝明細相加');
  const city = rows.filter((r) => r.city);
  assert.ok(city.every((r) => r.amt === R.RIDE_BONUS && r.place), '城事列都是 RIDE_BONUS、帶地名');
  const t0 = R.pointsTotal();
  APP.explore.collect('neiwan', { by: 'ride', km: 28 });
  assert.equal(R.pointsTotal() - t0, R.RIDE_BONUS + Math.floor(F.fare(28) / 20), '搭車到內灣：+RIDE_BONUS＋搭車回饋（每 20 元 1 點）');
  assert.equal(R.pointsTotal(), R.pointsRows().reduce((a, r) => a + r.amt, 0), '收卡後總數仍＝明細相加');
});

test('限定版只給走不到的地方；距離不明不算', () => {
  const { APP, STATE } = loadApp({ views: ['ride', 'explore-fx', 'explore-cards'] });
  const R = APP.ride;
  assert.equal(R.limitedPlace(APP.place('neiwan')), true, '內灣 28 km');
  assert.equal(R.limitedPlace(APP.place('glass-kiln')), false, '玻璃窯 900 m');
  assert.equal(R.limitedPlace(APP.place('p6')), false, '距離不明（十八尖山）');
  assert.equal(R.limitedPlace(null), false);
  STATE.collect('glass-kiln', { by: 'ride', date: '09.26', km: 1 });
  assert.equal(R.limitedCard('p11'), false, '搭車去走得到的地方：金框但不是限定版');
  STATE.collect('neiwan', { by: 'walk', date: '09.26', km: 28 });
  assert.equal(R.limitedCard('p9'), false, '走路收的內灣不是限定版');
  const { APP: A2, STATE: S2 } = loadApp({ views: ['ride'] });
  S2.collect('neiwan', { by: 'ride', date: '09.26', km: 28 });
  assert.equal(A2.ride.limitedCard('p9'), true, '搭車收的內灣是限定版');
  assert.equal(A2.ride.limitedCard('p99'), false, '沒收過的卡');
});

/* ---------------------------------------------------------------- explore */

test('抽卡：機率表加總 1000‰、走路遞減、搭車必得金框', () => {
  const { APP } = loadApp({ views: ['ride', 'explore-fx', 'explore-cards'] });
  const E = APP.explore;
  const sum = (k) => E.DRAW_STYLES.reduce((a, d) => a + d[k], 0);
  assert.equal(sum('walk'), 1000, '走路加總 1000‰');
  assert.equal(sum('ride'), 1000, '搭車加總 1000‰');
  assert.equal(E.DRAW_STYLES.length, 5, '每個地方五款');
  const gold = E.DRAW_STYLES.filter((d) => d.gold);
  assert.equal(gold.length, 1, '一款金框');
  assert.equal(gold[0].ride, 1000, '搭車必得金框');
  const plain = E.DRAW_STYLES.filter((d) => !d.gold);
  assert.equal(plain.length, 4, '四款一般');
  assert.ok(plain.every((d, i) => !i || d.walk < plain[i - 1].walk), '一般款越後面越難抽');
  assert.ok(gold[0].walk < plain[plain.length - 1].walk, '走路抽到金框比任何一般款都難');
  assert.equal(E.drawStyle('walk', 0).key, plain[0].key, 'r=0 → 第一款');
  assert.ok(E.drawStyle('walk', 0.9999).gold, 'r→1 → 金框');
  assert.ok(E.drawStyle('ride', 0.3).gold && E.drawStyle('ride', 0).gold, '搭車不論 r 都是金框');
  /* 邊界：每一款的累積區間首尾都落在自己 */
  let acc = 0;
  for (const d of E.DRAW_STYLES) {
    if (!d.walk) continue;
    assert.equal(E.drawStyle('walk', acc / 1000).key, d.key, d.key + ' 區間的起點');
    acc += d.walk;
    assert.equal(E.drawStyle('walk', (acc - 0.5) / 1000).key, d.key, d.key + ' 區間的終點');
  }
});

test('cardStyleOf：收下時抽到的優先；demo 的搭車卡是金框；走路卡每次都是同一款', () => {
  const store = memoryStorage({ 'yoxi-chengshi-app-v1': JSON.stringify({ cardStyle: { p1: 'ink' } }) });
  const { APP, STATE } = loadApp({ views: ['ride', 'explore-fx', 'explore-cards'], storage: store });
  const E = APP.explore;
  assert.equal(E.cardStyleOf('p1').key, 'ink', 'store.cardStyle 優先');
  assert.equal(STATE.card('p4').by, 'ride');
  assert.ok(E.cardStyleOf('p4').gold, 'demo 的搭車卡 p4 是金框');
  const a = E.cardStyleOf('p2'), b = E.cardStyleOf('p2');
  assert.equal(a.key, b.key, '走路卡以明信片 id 為種子，每次一樣');
  assert.ok(!a.gold, '沒有紀錄的走路卡不會是金框');
  assert.equal(E.cardStyleOf('p22'), null, '還沒收的卡沒有款式');
});

/* ---------------------------------------------------------------- album */

test('去過的地方數不重複的地方：收 p19、p21 不會多算', () => {
  const { APP, STATE } = loadApp({ views: VIEWS });
  const A = APP.album;
  const n0 = A.visitedPlaces().length;
  const fp = A.footprintSeen();
  assert.equal(n0, fp.seen.length + fp.missing.length, '一開始＝足跡上的點＋對不到地點的卡');
  STATE.collect('moat', { date: '09.26' });
  STATE.collect('hill', { date: '09.26' });
  assert.ok(STATE.has('p19') && STATE.has('p21'));
  assert.equal(A.visitedPlaces().length, n0, '同一個地方的第二張不算新地方');
  assert.equal(A.visitedPlaces().length, A.footprintSeen().seen.length + A.footprintSeen().missing.length);
});

test('recentCards：照收下的先後，最後收的在前；同一天、跨年都對', () => {
  const { APP, STATE } = loadApp({ views: VIEWS });
  ['glass-kiln', 'neiwan', 'p10'].forEach((id) => STATE.collect(id, { date: '09.26' }));
  assert.equal(ids(APP.album.recentCards(3)), 'p10,p9,p11', '同一天連收三張：最後收的在前');
  STATE.collect('p12', { date: '01.05' });
  assert.equal(APP.album.recentCards(1)[0].id, 'p12', '跨年（01.05 < 09.xx）新收的仍排第一');
  /* 存進 localStorage 再讀回來，順序不變 */
  const again = loadApp({ views: VIEWS, storage: memoryStorage({ [STATE_KEY]: JSON.stringify(STATE.all) }) });
  assert.equal(ids(again.APP.album.recentCards(4)), 'p12,p10,p9,p11', '重新載入後順序不變');
});

/* 今天（'MM.DD'）落在週回顧的哪一段：demo 的步數到 9/21 為止，本週＝9/15–21、上週＝9/8–14 */
const SLOTS = [
  { slot: 'now', today: '09.16' },
  { slot: 'after', today: '09.24' },
  { slot: 'prev', today: '09.10' },
  { slot: 'before', today: '09.05' },
];
for (const c of SLOTS) {
  test('weekStats：今天是 ' + c.today + '（' + c.slot + '）收一張卡，只有落在本週才算進本週', () => {
    const { APP, MOCK } = loadApp({ views: VIEWS, now: TAIPEI(c.today) });
    const W = APP.album.weekStats;
    const before = W();
    const month = MOCK.HEALTH_STEPS.month;
    assert.equal(APP.fmt.todayMMDD(), c.today, '注入的今天');
    assert.equal(before.month, 9);
    assert.deepEqual([before.now.from, before.now.to, before.prev.from, before.prev.to], [15, 21, 8, 14], '範圍固定：步數的最後一天往前 7 天');
    let sum = 0;
    for (let d = before.now.from; d <= before.now.to; d++) sum += month[d - 1] || 0;
    assert.equal(before.now.steps, sum, '本週步數＝HEALTH_STEPS 相加');
    APP.explore.collect('glass-kiln', { by: 'walk', km: 1 });
    const after = W();
    assert.equal(after.now.places, before.now.places + (c.slot === 'now' ? 1 : 0), '本週地方數');
    assert.equal(after.prev.places, before.prev.places + (c.slot === 'prev' ? 1 : 0), '上週地方數');
    assert.equal(ids(after.now.after), c.slot === 'after' ? 'p11' : '', '範圍之後才收的另外放');
    assert.equal(after.now.cards.some((p) => p.id === 'p11'), c.slot === 'now', '本週的卡');
    assert.deepEqual([after.now.km, after.now.steps, after.now.from, after.now.to], [before.now.km, before.now.steps, 15, 21], '公里、步數、範圍不因收卡而變');
    assert.deepEqual([after.prev.km, after.prev.steps], [before.prev.km, before.prev.steps], '上週的公里、步數不變');
  });
}

test('weekStats：範圍之後、下個月收的都放在 after，不算進本週', () => {
  const { APP, STATE } = loadApp({ views: VIEWS });
  const w0 = APP.album.weekStats();
  STATE.collect('glass-kiln', { date: '09.16' });
  STATE.collect('neiwan', { date: '09.24' });
  STATE.collect('p10', { date: '10.03' });
  const w = APP.album.weekStats();
  assert.ok(w.now.cards.some((p) => p.id === 'p11'), '範圍裡的 p11 算進本週');
  assert.ok(!w.now.cards.some((p) => p.id === 'p9' || p.id === 'p10'), '範圍之後的不算');
  assert.equal(ids(w.now.after).split(',').sort().join(','), 'p10,p9', '範圍之後的放在 after');
  assert.equal(w.now.places, w0.now.places + 1, '地方數只多範圍裡那一個');
});

test('cityColors：每個去過的地方算進一道顏色；一張都沒有就沒有顏色', () => {
  const { APP } = loadApp({ views: VIEWS });
  const bands = APP.album.cityColors();
  assert.ok(bands.length > 0);
  assert.equal(bands.reduce((s, b) => s + b.n, 0), APP.album.visitedPlaces().length, '色帶的地方數＝去過的地方');
  assert.ok(bands.every((b) => typeof b.c === 'string' && b.n > 0));
  const empty = loadApp({ views: VIEWS, storage: memoryStorage({ [STATE_KEY]: JSON.stringify({ cards: {} }) }) });
  assert.equal(empty.STATE.count(), 0);
  assert.deepEqual([...empty.APP.album.cityColors()], [], '0 張卡沒有顏色');
  assert.equal(empty.APP.album.visitedPlaces().length, 0);
});
