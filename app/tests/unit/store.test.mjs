/* APP.store：合併、reset、私密視窗（ARCHITECTURE.md §3.3） */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, memoryStorage } from './helpers.mjs';

const KEY = 'yoxi-chengshi-app-v1';

test('預設值齊全', () => {
  const s = loadApp().APP.store;
  assert.equal(s.get('onboarded'), false);
  assert.equal(s.get('dropoff'), null);
  assert.equal(s.get('trip'), null);
  assert.equal(s.get('pushes').length, 0);
  assert.equal(s.get('fxMute'), false);
  assert.deepEqual({ ...s.get('cardStyle') }, {});
  assert.deepEqual({ ...s.get('cardMarks') }, {});
  assert.equal(s.get('demoDate'), null, 'demo 的日期預設是今天（null）');
  assert.equal(typeof s.get('version'), 'number', '有結構版本');
  /* 底欄只有叫車與收藏：探索的舊路由記在 ride 底下 */
  assert.deepEqual({ ...s.get('tabPaths') }, { ride: '/ride', album: '/album' });
});

test('每個鍵都跟 fresh() 對型別：型別不對退回預設，型別對的照收', () => {
  const bad = {
    onboarded: 'yes', dropoff: 'neiwan', trip: [1], pushes: { a: 1 },
    rideSpots: 'no', rideVia: [], cardMarks: 'x', cardStyle: null, fxMute: 1, tabPaths: [], version: 'v9', demoDate: 20270115,
  };
  const { APP } = loadApp({ storage: memoryStorage({ [KEY]: JSON.stringify(bad) }) });
  const f = APP.store.fresh();
  for (const k of Object.keys(f)) {
    assert.deepEqual(JSON.parse(JSON.stringify(APP.store.get(k))), JSON.parse(JSON.stringify(f[k])), k + ' 退回預設');
  }
  const good = {
    onboarded: true, dropoff: { id: 'neiwan', km: 28 }, trip: null, pushes: [{ when: 'am', at: 'x' }],
    rideSpots: false, rideVia: { p9: 'k1' }, cardMarks: { p22: { fest: 'moon', far: 0 } },
    cardStyle: { p22: 'gold' }, fxMute: true, demoDate: '2027-01-15',
  };
  const ok = loadApp({ storage: memoryStorage({ [KEY]: JSON.stringify(good) }) }).APP.store;
  for (const k of Object.keys(good)) {
    assert.deepEqual(JSON.parse(JSON.stringify(ok.get(k))), good[k], k + ' 照收');
  }
});

test('結構版本：舊版（沒有 version）讀進來升到現在的版本；不認得的鍵原樣留著', () => {
  const old = { onboarded: true, tabPaths: { ride: '/drawer', explore: '/routes', album: '/week' }, later: { a: 1 } };
  const { APP, storage } = loadApp({ storage: memoryStorage({ [KEY]: JSON.stringify(old) }) });
  const v = APP.store.fresh().version;
  assert.equal(APP.store.get('version'), v);
  assert.deepEqual({ ...APP.store.get('tabPaths') }, { ride: '/drawer', album: '/week' }, 'tabPaths.explore 丟掉');
  assert.deepEqual({ ...APP.store.get('later') }, { a: 1 }, '不認得的鍵留著');
  APP.store.set('onboarded', true);
  assert.equal(JSON.parse(storage.getItem(KEY)).version, v, '存回去帶版本');
});

test('讀檔不會被 __proto__ 鍵改掉原型', () => {
  const raw = '{"onboarded":true,"__proto__":{"polluted":1}}';
  const { APP } = loadApp({ storage: memoryStorage({ [KEY]: raw }) });
  assert.equal(APP.store.get('onboarded'), true);
  assert.equal(APP.store.all.polluted, undefined);
});

test('整份存檔不是物件（陣列、數字）→ 預設值', () => {
  for (const raw of ['[1,2]', '42', '"str"', 'null']) {
    const { APP } = loadApp({ storage: memoryStorage({ [KEY]: raw }) });
    assert.equal(APP.store.get('onboarded'), false, raw);
    assert.deepEqual({ ...APP.store.get('tabPaths') }, { ride: '/ride', album: '/album' }, raw);
  }
});

test('讀到舊版（少鍵）會跟預設合併', () => {
  const storage = memoryStorage({ [KEY]: JSON.stringify({ onboarded: true, tabPaths: { album: '/week' } }) });
  const { APP } = loadApp({ storage });
  assert.equal(APP.store.get('onboarded'), true);
  assert.equal(APP.store.get('dropoff'), null);
  assert.equal(APP.store.get('tabPaths').album, '/week');
  assert.equal(APP.store.get('tabPaths').ride, '/ride');
  assert.equal(APP.store.get('pushes').length, 0);
});

test('壞掉的 JSON 退回預設，不丟錯', () => {
  const { APP } = loadApp({ storage: memoryStorage({ [KEY]: '{not json' }) });
  assert.equal(APP.store.get('onboarded'), false);
});

test('set 寫進 localStorage 並 emit store:change', () => {
  const { APP, storage } = loadApp();
  const seen = [];
  APP.on('store:change', e => seen.push(e && e.key));
  APP.store.set('dropoff', { id: 'neiwan', km: 28 });
  assert.equal(JSON.parse(storage.getItem(KEY)).dropoff.id, 'neiwan');
  assert.deepEqual(seen, ['dropoff']);
});

test('patch 合併多鍵', () => {
  const { APP, storage } = loadApp();
  APP.store.patch({ onboarded: true, fxMute: true });
  const saved = JSON.parse(storage.getItem(KEY));
  assert.equal(saved.onboarded, true);
  assert.equal(saved.fxMute, true);
  assert.equal(saved.dropoff, null, '沒給的鍵保留');
});

test('reset 只清 app 狀態，不動 STATE 的 key', () => {
  const storage = memoryStorage({ 'yoxi-chengshi-v1-2': '{"cards":{"p1":{}}}' });
  const { APP } = loadApp({ storage });
  APP.store.set('dropoff', { id: 'x' });
  APP.store.reset();
  assert.equal(APP.store.get('dropoff'), null);
  assert.equal(storage.getItem('yoxi-chengshi-v1-2'), '{"cards":{"p1":{}}}');
  assert.equal(JSON.parse(storage.getItem(KEY)).dropoff, null);
});

test('store 不寫 STATE 的鍵', () => {
  const { APP, storage } = loadApp();
  APP.store.set('dropoff', { id: 'x' });
  assert.equal(storage.getItem('yoxi-chengshi-v1-2'), null);
});

test('私密視窗：setItem 丟錯不炸，記憶體值照樣更新', () => {
  const { APP } = loadApp({ storage: memoryStorage({}, { throwOnSet: true }) });
  assert.doesNotThrow(() => APP.store.set('dropoff', { id: 'y' }));
  assert.equal(APP.store.get('dropoff').id, 'y');
  assert.doesNotThrow(() => APP.store.reset());
});

test('私密視窗：getItem 丟錯 → 預設值', () => {
  const { APP } = loadApp({ storage: memoryStorage({}, { throwOnGet: true }) });
  assert.equal(APP.store.get('onboarded'), false);
});

test('連 localStorage 都碰不得（存取就丟 SecurityError）也能載入', () => {
  const { APP } = loadApp({ noStorage: true });
  assert.equal(APP.store.get('onboarded'), false);
  assert.doesNotThrow(() => APP.store.set('onboarded', true));
  assert.equal(APP.store.get('onboarded'), true);
});

test('on 回傳 off；listener 丟錯不影響其他人', () => {
  const { APP } = loadApp();
  let n = 0;
  const off = APP.on('x', () => n++);
  APP.on('x', () => { throw new Error('壞 listener'); });
  const origErr = console.error;
  console.error = () => {};
  try {
    APP.emit('x');
    off();
    APP.emit('x');
  } finally { console.error = origErr; }
  assert.equal(n, 1);
});

test('tabPaths 只收「/ 開頭的字串」：舊版或手改的怪值退回預設', () => {
  const bad = { onboarded: true, tabPaths: { ride: null, explore: 42, album: 'javascript:alert(1)', extra: '/x' } };
  const { APP } = loadApp({ storage: memoryStorage({ [KEY]: JSON.stringify(bad) }) });
  assert.deepEqual({ ...APP.store.get('tabPaths') }, { ride: '/ride', album: '/album' });
  const str = loadApp({ storage: memoryStorage({ [KEY]: JSON.stringify({ tabPaths: 'abc' }) }) }).APP;
  assert.deepEqual({ ...str.store.get('tabPaths') }, { ride: '/ride', album: '/album' });
  const ok = loadApp({ storage: memoryStorage({ [KEY]: JSON.stringify({ tabPaths: { album: '/album?tab=journal' } }) }) }).APP;
  assert.equal(ok.store.get('tabPaths').album, '/album?tab=journal');
});

test('APP.place：Object 原型上的名字不算認得的 id', () => {
  const { APP, ctx } = loadApp();
  ctx.MOCK.CARD_TO_PLACE = { p11: 'glass-kiln' };
  /* 真的 MOCK.findPlace 不認得就默默退回今天的地方：照樣模擬，擋不擋得住要看 app.js 自己 */
  const orig = ctx.MOCK.findPlace;
  ctx.MOCK.findPlace = function (id) { return orig.call(this, id) || this.TODAY; };
  try {
    for (const id of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) assert.equal(APP.place(id), null, id);
    assert.equal(APP.place(null), null);
    assert.equal(APP.place(42), null);
    assert.equal(APP.place('glass-kiln').id, 'glass-kiln');
  } finally { delete ctx.MOCK.CARD_TO_PLACE; ctx.MOCK.findPlace = orig; }
});

test('clear(group)：只把那一類鍵回到預設；偏好與不認得的鍵不動', () => {
  const { APP, storage } = loadApp();
  const st = APP.store;
  st.patch({
    onboarded: true, fxMute: true, rideSpots: false,
    dropoff: { id: 'neiwan' }, trip: { placeId: 'neiwan', phase: 'done' }, pushes: [{ when: 'am', at: 'x' }],
    rideVia: { p9: 'k1' }, cardMarks: { p22: { fest: 'moon', far: 0 } }, cardStyle: { p22: 'gold' }, demoDate: '2027-01-15',
    tabPaths: { ride: '/points', album: '/week' }, later: { a: 1 },
  });
  const seen = [];
  const off = APP.on('store:change', (d) => seen.push(d.key));
  const cleared = st.clear('footprint');
  off();
  const f = st.fresh();
  assert.deepEqual([...cleared].sort(),
    ['cardMarks', 'cardStyle', 'dropoff', 'pushes', 'replies', 'rideVia', 'shares', 'tabPaths', 'trip', 'visits'], '足跡的鍵');
  for (const k of cleared) {
    assert.deepEqual(JSON.parse(JSON.stringify(st.get(k))), JSON.parse(JSON.stringify(f[k])), k + ' 回到預設');
  }
  assert.deepEqual([st.get('onboarded'), st.get('fxMute'), st.get('rideSpots')], [true, true, false], '偏好留著');
  assert.deepEqual({ ...st.get('later') }, { a: 1 }, '不認得的鍵不動');
  assert.deepEqual([...seen].sort(), [...cleared].sort(), '每個清掉的鍵 emit 一次 store:change');
  assert.equal(JSON.parse(storage.getItem(KEY)).trip, null, '存回 localStorage');
  assert.equal(st.clear('nope').length, 0, '不認得的類別什麼都不清');
});
