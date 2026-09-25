/* APP.place：任何明信片 id／路線站 id 都正規化成它真正的地點（ARCHITECTURE.md §3.4）。
   對真的 prototype/js/mock.js 測：CARD_TO_PLACE 只列六張，其餘的要從可去的地方反查。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './helpers.mjs';

const { APP, ctx } = loadApp({ realMock: true });
const M = ctx.MOCK;

test('明信片 id → 那張明信片的地方（id、距離跟用地點 id 查的一樣）', () => {
  const pairs = { p1: 'station', p2: 'market', p4: 'harbour', p5: 'rail', p7: 'temple',
                  p9: 'neiwan', p11: 'glass-kiln', p19: 'moat', p20: 'brick', p21: 'hill', p22: 'lake' };
  for (const [card, pid] of Object.entries(pairs)) {
    const a = APP.place(card), b = APP.place(pid);
    assert.ok(a, card + ' 認得');
    assert.equal(a.id, pid, card + ' → ' + pid);
    assert.equal(a.dist, b.dist, card + ' 的距離跟 ' + pid + ' 一樣');
    assert.equal(a.card, card, pid + ' 的明信片是 ' + card);
  }
});

test('p2 東門市場有距離（以前是 null，跟 market 的 1.4 km 對不起來）', () => {
  const p = APP.place('p2');
  assert.equal(p.id, 'market');
  assert.equal(typeof p.dist, 'number');
  assert.equal(APP.fmt.dist(p.dist), APP.fmt.dist(APP.place('market').dist));
});

test('p9 → neiwan 照舊', () => {
  assert.equal(APP.place('p9').id, 'neiwan');
  assert.equal(APP.place('p9').dist, M.FAR_PLACE.distance != null ? M.FAR_PLACE.distance : APP.place('neiwan').dist);
});

test('路線站 id → 站上明信片的地方', () => {
  for (const r of M.ROUTES) {
    for (const st of r.stops) {
      const a = APP.place(st.id), b = APP.place(st.card);
      assert.ok(a && b, st.id + '／' + st.card + ' 認得');
      assert.equal(a.id, b.id, st.id + ' 跟 ' + st.card + ' 是同一個地方');
    }
  }
  assert.equal(APP.place('s1').id, 'station', 's1（新竹車站）→ station');
});

test('只在路線上、沒有對應地方的明信片：id 就是明信片 id，距離用站上的', () => {
  const st = M.ROUTES.flatMap(r => r.stops).find(s => s.card === 'p14');
  const p = APP.place('p14');
  assert.equal(p.id, 'p14');
  assert.equal(p.dist, st.dist);
  assert.equal(p.card, 'p14');
});

test('每一張明信片都查得到地方，而且那個地方的明信片就是它', () => {
  for (const c of M.POSTCARDS) {
    const p = APP.place(c.id);
    assert.ok(p, c.id + ' 認得');
    assert.equal(p.card, c.id, c.id + ' → ' + p.id + ' 的 card');
  }
});

test('不認得的 id → null', () => {
  for (const id of ['p0', 'p999', 'nope', '', 'constructor', '__proto__']) assert.equal(APP.place(id), null, JSON.stringify(id));
});

test('places() 沒有重複、每個都是地點 id（不是明信片 id）', () => {
  const ids = APP.places().map(p => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(!/^p\d+$/.test(id), id);
});
