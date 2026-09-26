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

/* 明信片 → 地點的兩種答案（ARCHITECTURE.md §3.4）：APP.place(id).id 與 APP.footprintPlace(id)。
   這張表釘住現行行為，包括刻意保留的差異：足跡以地圖認得的地點為準，路線站的卡落到同名的地點
   （p3 → moat、p6 → hill、p8 → lake），地圖上沒有的站是 null；APP.place 把它們當成只在路線上的站。
   產品決定要合併時，改 app.js 的 footprintPlace 跟這張表。 */
const CARD_PLACES = {
  //      APP.place(id).id   APP.footprintPlace(id)
  p1:  ['station',    'station'],
  p2:  ['market',     'market'],
  p3:  ['p3',         'moat'],
  p4:  ['harbour',    'harbour'],
  p5:  ['rail',       'rail'],
  p6:  ['p6',         'hill'],
  p7:  ['temple',     'temple'],
  p8:  ['p8',         'lake'],
  p9:  ['neiwan',     'neiwan'],
  p10: ['p10',        null],
  p11: ['glass-kiln', 'glass-kiln'],
  p12: ['p12',        null],
  p13: ['p13',        null],
  p14: ['p14',        null],
  p15: ['p15',        null],
  p16: ['p16',        null],
  p17: ['p17',        null],
  p18: ['p18',        null],
  p19: ['moat',       'moat'],
  p20: ['brick',      'brick'],
  p21: ['hill',       'hill'],
  p22: ['lake',       'lake'],
};

test('明信片 → 地點：APP.place 與 APP.footprintPlace 的對照表（22 張全列）', () => {
  const G = loadApp({ views: ['album'] });   /* footprintPlace 要 hs-places 的地名 */
  const ids = [...G.MOCK.POSTCARDS].map((c) => c.id);   /* 展開成這邊的陣列（vm 的陣列原型不同，deepEqual 會說不一樣） */
  assert.deepEqual([...ids].sort(), Object.keys(CARD_PLACES).sort(), '表上剛好是全部的明信片');
  for (const id of ids) {
    const [pl, fp] = CARD_PLACES[id];
    assert.equal(G.APP.place(id).id, pl, 'APP.place(' + id + ').id');
    assert.equal(G.APP.footprintPlace(id), fp, 'APP.footprintPlace(' + id + ')');
  }
});

test('路線站：站 id 與站上明信片 id 落在同一個地方（路線詳情、demo 面板都只問 APP.place）', () => {
  const G = loadApp({ views: ['album'] });
  for (const r of G.MOCK.ROUTES) {
    for (const st of r.stops) {
      assert.equal(G.APP.place(st.id).id, CARD_PLACES[st.card][0], st.id + '（' + st.card + '）');
      assert.equal(G.APP.footprintPlace(st.card), CARD_PLACES[st.card][1], st.card + ' 的足跡地點');
    }
  }
});

test('APP.place 對自己的輸出是穩定的：再查一次還是同一個地方（demo 面板直接拿它當選項）', () => {
  const G = loadApp({ views: ['album'] });
  for (const p of G.APP.places()) assert.equal(G.APP.place(p.id).id, p.id, p.id);
  for (const id of Object.keys(CARD_PLACES)) {
    const p = G.APP.place(id);
    assert.equal(G.APP.place(p.id).id, p.id, id + ' → ' + p.id);
  }
});

test('footprintPlace：不是明信片 → null；原型鏈上的名字撿不到東西', () => {
  const G = loadApp({ views: ['album'] });
  for (const id of ['p0', 'p999', 'nope', '', 'station', 'constructor', 'toString', '__proto__']) {
    assert.equal(G.APP.footprintPlace(id), null, JSON.stringify(id));
  }
});
