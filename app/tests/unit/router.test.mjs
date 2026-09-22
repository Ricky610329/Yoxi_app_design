/* 路由比對：pattern、參數、query、404、placeholder（ARCHITECTURE.md §3.1、§3.2、§8） */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './helpers.mjs';

function withViews() {
  const { APP } = loadApp();
  const r = () => '';
  APP.view('ride', { path: '/ride', tab: 'ride', root: true, render: r });
  APP.view('place', { path: ['/place/:id', '/place'], tab: 'explore', render: r });
  APP.view('trip', { path: '/trip', tab: null, render: r });
  APP.view('tripDone', { path: '/trip/done', tab: null, render: r });
  APP.view('unlock', { path: '/unlock/:id', tab: null, render: r });
  return APP;
}

test('APP 有契約要求的介面', () => {
  const { APP } = loadApp();
  for (const k of ['view', 'nav', 'store', 'fmt', 'on', 'emit', 'esc', 'place', 'places', 'ui', 'map', 'start']) {
    assert.ok(APP[k] != null, 'APP.' + k);
  }
  for (const k of ['go', 'back', 'tab', 'current']) assert.equal(typeof APP.nav[k], 'function', 'APP.nav.' + k);
  assert.equal(typeof APP.resolve, 'function', 'APP.resolve（harness 靠它判斷 href 是否為已註冊 route）');
});

test(':id 進 params', () => {
  const APP = withViews();
  const m = APP.resolve('/place/glass-kiln');
  assert.equal(m.name, 'place');
  assert.equal(m.pattern, '/place/:id');
  assert.deepEqual({ ...m.params }, { id: 'glass-kiln' });
});

test('path 可以是陣列', () => {
  const APP = withViews();
  assert.equal(APP.resolve('/place').name, 'place');
  assert.equal(APP.resolve('/place').pattern, '/place');
});

test('參數 decodeURIComponent', () => {
  const APP = withViews();
  assert.equal(APP.resolve('/place/%E5%85%A7%E7%81%A3').params.id, '內灣');
});

test('query 不影響比對，parse 拆得出來', () => {
  const APP = withViews();
  const m = APP.resolve('/unlock/neiwan?ride=1');
  assert.equal(m.name, 'unlock');
  assert.equal(m.params.id, 'neiwan');
  const p = APP.parse('#/unlock/neiwan?ride=1');
  assert.equal(p.path, '/unlock/neiwan');
  assert.equal(p.query.get('ride'), '1');
});

test('靜態段優先：/trip/done 不會被吃掉', () => {
  const APP = withViews();
  assert.equal(APP.resolve('/trip/done').name, 'tripDone');
  assert.equal(APP.resolve('/trip').name, 'trip');
});

test('結尾斜線與空 hash', () => {
  const APP = withViews();
  assert.equal(APP.resolve('/ride/').name, 'ride');
  assert.equal(APP.parse('').path, '/');
  assert.equal(APP.parse('#').path, '/');
});

test('未知 path → 404（pattern /*）', () => {
  const APP = withViews();
  const m = APP.resolve('/no/such/page');
  assert.equal(m.pattern, '/*');
  assert.match(m.name, /404/);
  assert.equal(APP.resolve('/place/a/b').pattern, '/*', '多一段不算 /place/:id');
});

test('§8 有列但沒註冊的 → placeholder（最終版不該再有）', () => {
  const APP = withViews();
  assert.equal(APP.resolve('/album').name, '_placeholder');
});

test('重複註冊＝覆寫，不會留兩條', () => {
  const APP = withViews();
  APP.view('place', { path: '/spot/:id', render: () => '' });
  assert.equal(APP.resolve('/spot/x').name, 'place');
  assert.notEqual(APP.resolve('/place/x').name, 'place');
});

test('view 少了 path 會丟錯', () => {
  const { APP } = loadApp();
  assert.throws(() => APP.view('x', { render: () => '' }));
});
