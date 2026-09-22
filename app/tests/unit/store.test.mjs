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
  assert.equal(s.get('arrivedDemo'), null);
  assert.deepEqual({ ...s.get('tabPaths') }, { ride: '/ride', explore: '/explore', album: '/album' });
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
  APP.store.patch({ onboarded: true, arrivedDemo: 'glass-kiln' });
  const saved = JSON.parse(storage.getItem(KEY));
  assert.equal(saved.onboarded, true);
  assert.equal(saved.arrivedDemo, 'glass-kiln');
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
