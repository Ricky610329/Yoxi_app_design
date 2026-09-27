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

/* ---------------------------------------------------------------- ride（行程 module 在 trip.test.mjs） */

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
  R.trip.arriveAt('neiwan');                     /* 搭 yoxi 抵達內灣，再收下：collect 自己判斷是搭車 */
  APP.explore.collect('neiwan');
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

test('款式規則：五款（四季＋金框），四季的月份不重疊、剛好蓋滿十二個月；沒有機率欄位', () => {
  const { APP } = loadApp({ views: ['ride', 'explore-fx', 'explore-cards'] });
  const E = APP.explore;
  assert.equal(E.CARD_STYLES.length, 5, '每個地方五款');
  assert.equal(E.CARD_STYLES.filter((d) => d.gold).length, 1, '一款金框');
  const months = [...E.CARD_STYLES].filter((d) => d.months).flatMap((d) => [...d.months]).sort((x, y) => x - y);
  assert.deepEqual(months, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], '四季蓋滿十二個月、不重疊');
  assert.ok(E.CARD_STYLES.every((d) => !('walk' in d) && !('ride' in d) && !('odds' in d)), '沒有權重、沒有機率');
  assert.equal(typeof E.drawStyle, 'undefined', '沒有抽卡函式');
  assert.equal(typeof E.openOdds, 'undefined', '沒有機率說明');
});

test('cardRule：走路看季節、搭 yoxi 是金框；節日那一週是節日版；第一次來是首訪；搭 yoxi 累積跨過 MILE_STEPS 是里程紀念', () => {
  const { APP } = loadApp({ views: ['ride', 'explore-fx', 'explore-cards'] });
  const E = APP.explore;
  const R = (by, ymd, km) => { const [y, m, d] = ymd.split('-').map(Number); return E.cardRule({ by, km, date: new Date(y, m - 1, d, 12) }); };
  const F = (ymd) => { const f = R('walk', ymd).festival; return f ? f.key : null; };
  assert.equal(R('walk', '2027-04-02').style.key, 'watercolor', '春天 → 水彩');
  assert.equal(R('walk', '2027-07-20').style.key, 'oil', '夏天 → 油畫');
  assert.equal(R('walk', '2026-10-01').style.key, 'woodcut', '秋天 → 木刻版畫');
  assert.equal(R('walk', '2026-12-31').style.key, 'ink', '十二月 → 水墨');
  assert.equal(R('walk', '2027-02-28').style.key, 'ink', '二月 → 水墨');
  assert.equal(R('walk', '2027-03-01').style.key, 'watercolor', '三月一號換季');
  assert.equal(R('ride', '2027-04-02', 3).style.key, 'gold', '搭 yoxi：不分季節是金框');
  assert.equal(R('ride', '2027-04-02', 3).season.key, 'watercolor', '搭 yoxi 也知道是哪個季節（說明用）');
  /* 三節是「那一週」：節日當天所在的週一到週日，官方連假更長就延到連假最後一天 */
  assert.deepEqual([F('2026-09-20'), F('2026-09-21'), F('2026-09-25'), F('2026-09-27'), F('2026-09-28'), F('2026-09-29')],
    [null, 'moon', 'moon', 'moon', 'moon', null], '115 年中秋（週五）：9/21 週一到 9/28（中秋＋教師節連假的最後一天）');
  assert.deepEqual([F('2027-09-12'), F('2027-09-13'), F('2027-09-19'), F('2027-09-20')],
    [null, 'moon', 'moon', null], '116 年中秋（週三，沒有連假）：9/13 週一到 9/19 週日');
  assert.deepEqual([F('2026-02-13'), F('2026-02-14'), F('2026-02-22'), F('2026-02-23')],
    ['sakura', 'spring', 'spring', 'sakura'], '115 年春節：連假 2/14 比那一週的週一 2/16 早，從連假算起；前後是櫻花季');
  assert.deepEqual([F('2027-01-31'), F('2027-02-01'), F('2027-02-10'), F('2027-02-11')],
    ['sakura', 'spring', 'spring', 'sakura'], '116 年春節：2/1 週一到 2/10 連假最後一天；前後是櫻花季');
  assert.deepEqual([F('2026-06-14'), F('2026-06-15'), F('2026-06-21'), F('2026-06-22')],
    [null, 'duanwu', 'duanwu', null], '115 年端午：6/15–6/21');
  assert.equal(R('ride', '2027-06-09', 1).festival.key, 'duanwu', '搭車也是節日版');
  /* 賞櫻：每年一樣的期間，不用查日曆表；碰上三節以三節為主 */
  assert.deepEqual([F('2030-01-24'), F('2030-01-25'), F('2030-03-15'), F('2030-03-16')], [null, 'sakura', 'sakura', null], '櫻花季 1/25–3/15');
  assert.equal(F('2030-09-25'), null, '三節表上沒有的年份：不猜');
  assert.deepEqual([...E.festSpan('moon', 2026)], ['09-21', '09-28'], 'festSpan：115 年中秋');
  assert.deepEqual([...E.festSpan('duanwu', 2027)], ['06-07', '06-13'], 'festSpan：116 年端午（週三）');
  assert.equal(E.festSpan('moon', 2030), null, 'festSpan：表上沒有的年份是 null');
  assert.deepEqual([...E.festSpan('sakura', 2030)], ['01-25', '03-15'], 'festSpan：賞櫻每年一樣');
  /* 里程紀念：看累積（before＋這一趟），不看單趟；跨過兩個記大的；走路不算；沒給 before 就不算 */
  const RM = (by, km, before) => E.cardRule({ by, km, before, date: new Date(2027, 3, 2, 12) });
  const first = E.MILE_STEPS[0];
  assert.equal(RM('ride', 1, first - 1).mile, first, '剛好跨過第一個：算');
  assert.equal(RM('ride', 0.5, first - 1).mile, 0, '差一點：不算');
  assert.equal(RM('ride', 1, first).mile, 0, '之前已經跨過：這一趟不再蓋');
  assert.equal(RM('ride', 50, 20).mile, 60, '一趟跨過 30 與 60（20 → 70）：記大的');
  assert.equal(RM('walk', 40, 0).mile, 0, '走路不算里程');
  assert.equal(RM('ride', 40).mile, 0, '沒給之前的累積：不算');
  assert.equal(RM('ride', 12.3, 20).total, 32.3, 'total＝之前的累積＋這一趟');
  assert.ok(E.MILE_STEPS.every((m, i, a) => !i || m > a[i - 1]), 'MILE_STEPS 由小到大');
  /* 首訪：呼叫的人說是第一次才算 */
  assert.equal(E.cardRule({ by: 'walk', first: true }).first, true);
  assert.equal(E.cardRule({ by: 'walk' }).first, false);
  assert.equal(typeof E.FAR_KM, 'undefined', '單趟的遠行戳拿掉了（換成累積的里程紀念）');
  /* 同一天同樣方式，每次都一樣（沒有亂數） */
  assert.deepEqual(JSON.stringify(R('walk', '2026-09-25')), JSON.stringify(R('walk', '2026-09-25')));
});

test('ruleLines：一條規則一句；marksHTML：節日版是會動的插畫、首訪與里程各一枚戳', () => {
  const { APP } = loadApp({ views: ['ride', 'explore-fx', 'explore-fest', 'explore-cards'] });
  const E = APP.explore;
  const K = E._;
  const R = (by, ymd, km, o) => { const [y, m, d] = ymd.split('-').map(Number); return E.cardRule(Object.assign({ by, km, date: new Date(y, m - 1, d, 12) }, o)); };
  assert.deepEqual([...E.ruleLines(R('walk', '2026-10-01'))], ['秋天的畫風是木刻版畫']);
  assert.deepEqual([...E.ruleLines(R('walk', '2026-10-01', 1, { first: true }))], ['秋天的畫風是木刻版畫', '第一次來，多蓋一枚首訪紀念戳']);
  assert.deepEqual([...E.ruleLines(R('walk', '2026-09-23'))], ['秋天的畫風是木刻版畫', '中秋那一週去的，卡面有月亮和玉兔']);
  assert.deepEqual([...E.ruleLines(R('ride', '2027-02-08', 28, { first: true, before: 14.6 }))],
    ['搭 yoxi 抵達是金框', '第一次來，多蓋一枚首訪紀念戳', '春節那一週去的，卡面有鞭炮', '搭 yoxi 累積到 30 公里，多蓋一枚里程紀念戳']);
  assert.deepEqual([...E.ruleLines(R('walk', '2027-03-01'))], ['春天的畫風是水彩', '櫻花季去的，卡面有櫻花樹']);
  assert.equal(K.marksHTML(R('walk', '2026-10-01')), '', '都沒有就沒有 HTML');
  const m = K.marksHTML(R('ride', '2026-09-25', 28, { first: true, before: 14.6 }));
  assert.ok(/data-fest="moon"/.test(m) && /data-mark="first"/.test(m) && /data-mark="mile"/.test(m) && /30 km/.test(m), '中秋插畫＋首訪戳＋里程戳：' + m.slice(0, 80));
  assert.ok(m.indexOf('data-fest') < m.indexOf('data-mark="first"'), '插畫在戳前面（戳壓在插畫上）');
  for (const f of E.FESTIVALS) {
    const h = E.festHTML(f.key);
    assert.ok(new RegExp('data-fest="' + f.key + '"').test(h) && /aria-hidden="true"/.test(h) && /data-fest-part/.test(h), f.key + '：有插畫、報讀器略過、有主角');
    assert.ok(!/#[0-9a-f]{3,6}\b/i.test(h.replace(/href="#[^"]+"|url\(#[^)]+\)/g, '')), f.key + '：SVG 裡沒有寫死的顏色（顏色在 explore-fest.css）');
  }
  assert.equal(E.festHTML('nope'), '', '不認得的節日：沒有插畫');
  assert.notEqual(E.festHTML('moon').match(/id="(fest\d+)g"/)[1], E.festHTML('moon').match(/id="(fest\d+)g"/)[1], '每一張的漸層 id 不一樣（同一頁兩張不會互相搶）');
  assert.deepEqual([...E.ruleLines(null)], [], '沒有規則：沒有句子');
});

test('cardStyleOf：收下時記的優先；demo 的搭車卡是金框；走路卡照收下那天的季節補', () => {
  const store = memoryStorage({ 'yoxi-chengshi-app-v1': JSON.stringify({ cardStyle: { p1: 'ink' } }) });
  const { APP, STATE } = loadApp({ views: ['ride', 'explore-fx', 'explore-cards'], storage: store });
  const E = APP.explore;
  assert.equal(E.cardStyleOf('p1').key, 'ink', 'store.cardStyle 優先');
  assert.equal(STATE.card('p4').by, 'ride');
  assert.ok(E.cardStyleOf('p4').gold, 'demo 的搭車卡 p4 是金框');
  assert.equal(STATE.card('p2').date.slice(0, 2), '09', '前提：p2 九月收的');
  assert.equal(E.cardStyleOf('p2').key, 'woodcut', '沒有紀錄的走路卡：九月是秋天 → 木刻版畫');
  assert.equal(E.cardStyleOf('p22'), null, '還沒收的卡沒有款式');
  assert.equal(E.cardOrigin('p2').festival, null, 'demo 一開始的卡沒有節慶紀錄：不拿月日回推');
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
    APP.explore.collect('glass-kiln');
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

test('APP.state：寫 STATE 一定跟著 state:change；batch 裡的寫入寫完才發一次', () => {
  const { APP, STATE } = loadApp({ views: ['ride', 'explore-fx', 'explore-cards'] });
  let n = 0;
  const off = APP.on('state:change', () => { n++; });
  APP.state.setToday({ mood: 'calm' });
  assert.equal(n, 1, 'setToday 發一次');
  assert.equal(STATE.all.today.mood, 'calm');
  APP.state.setSetting('layer', false);
  APP.state.markLastSeen();
  assert.equal(n, 3, 'setSetting、markLastSeen 各發一次');
  let seenInside = null;
  const r = APP.state.batch(() => {
    APP.state.setToday({ mood: 'tired' });
    APP.state.setToday({ photo: 'x' });
    seenInside = n;
    return 'done';
  });
  assert.equal(seenInside, 3, 'batch 裡還沒發');
  assert.equal(n, 4, 'batch 結束發一次');
  assert.equal(r, 'done', 'batch 回傳 fn 的結果');
  APP.state.batch(() => {});
  assert.equal(n, 4, '沒寫東西的 batch 不發');
  let order = null;
  const off2 = APP.on('state:change', () => { order = APP.store.get('cardStyle')[APP.place('glass-kiln').card]; });
  APP.store.set('demoDate', '2027-07-20');
  APP.explore.collect('glass-kiln');
  assert.equal(order, 'oil', 'collect：listener 看到的是寫完 app store 的樣子');
  off2();
  const km0 = STATE.all.km;
  assert.ok(STATE.count() > 0 && km0 > 0);
  APP.state.wipe();
  assert.deepEqual([STATE.count(), STATE.all.km, STATE.all.lastCard, STATE.lastIsNew], [0, 0, null, false], 'wipe 真的清空');
  assert.equal(STATE.all.settings.layer, false, 'STATE.settings 的開關是偏好，留著');
  off();
});

test('cardFace：卡面的疊法只有一個——成品 → 底圖照片＋濾鏡 → 插圖；出處跟著同一張照片', () => {
  const { APP } = loadApp({ views: ['ride', 'explore-fx', 'explore-cards', 'explore-face'] });
  const E = APP.explore;
  const p1 = E.cardFace('p1', 'oil');
  assert.equal(p1.gen, 'assets/postcards/p1-oil.jpg', 'p1 有生成好的成品');
  assert.ok(p1.photo, '成品載不到時退回的底圖照片也在');
  assert.equal(p1.credit, E.cardPhoto('p1'), '出處＝cardPhoto');
  const p21 = E.cardFace('p21', 'oil');
  assert.equal(p21.gen, '', 'p21 沒有生成成品');
  assert.ok(p21.photo.endsWith('p21-1.jpg'), 'p21 用自己的實景照片');
  assert.equal(E.cardFace('p1', 'nope').gen, '', '不認得的款式沒有成品');
  assert.deepEqual([E.cardFace('nope', 'oil').gen, E.cardFace('nope', 'oil').photo, E.cardFace('nope', 'oil').credit], ['', '', null], '都沒有：插圖');
  /* 每一張明信片都有底圖照片（明信片自己的 → 對照表的地點 → 所在地點的），/unlock 與收藏看到的是同一張 */
  const all = APP.places().map((p) => p.card).filter(Boolean);
  assert.ok(all.length > 0);
  for (const c of all) assert.ok(E.cardPhoto(c), c + ' 有底圖照片');
});
