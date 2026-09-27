/* 翻開之後的那一句（explore-verse.js 的 VERSES／verseOf）：整張表的規矩與挑句子的規則 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './helpers.mjs';

const load = () => loadApp({ views: ['ride', 'explore-fx', 'explore-fest', 'explore-cards', 'explore-verse'] });
const BANNED = ['任務', '完成', '達成', '挑戰', '每日'];
const textOf = (v) => (typeof v === 'string' ? v : v[0]);

test('VERSES：每一張明信片的每一種款式與節日都有自己的一句，全表不重複', () => {
  const { APP, MOCK } = load();
  const E = APP.explore;
  const keys = E.CARD_STYLES.map((d) => d.key).concat(E.FESTIVALS.map((f) => f.key));
  const seen = new Map();
  for (const c of MOCK.POSTCARDS.concat([{ id: '_' }])) {
    const row = E.VERSES[c.id];
    assert.ok(row, c.id + '：表上有這一張');
    for (const k of keys) {
      assert.ok(row[k], c.id + '.' + k + '：有句子');
      const t = textOf(row[k]);
      assert.ok(!seen.has(t), c.id + '.' + k + ' 跟 ' + seen.get(t) + ' 重複：' + t);
      seen.set(t, c.id + '.' + k);
    }
    assert.deepEqual(Object.keys(row).filter((k) => keys.indexOf(k) < 0), [], c.id + '：沒有多出認不得的 key');
  }
});

test('VERSES：長度、禁用詞、阿拉伯數字、引用要寫作者與篇名', () => {
  const { APP } = load();
  const E = APP.explore;
  for (const id of Object.keys(E.VERSES)) {
    for (const k of Object.keys(E.VERSES[id])) {
      const v = E.VERSES[id][k];
      const t = textOf(v);
      const at = id + '.' + k + '：' + t;
      assert.ok(Array.from(t).length <= E.VERSE_MAX, at + '（超過 ' + E.VERSE_MAX + ' 字）');
      assert.ok(/。$/.test(t), at + '（句號收尾）');
      assert.ok(!/[0-9]/.test(t), at + '（不寫阿拉伯數字）');
      for (const w of BANNED) assert.ok(t.indexOf(w) < 0, at + '（禁用詞「' + w + '」）');
      if (typeof v !== 'string') assert.ok(v.length === 3 && v[1] && v[2], at + '（引用要有作者與篇名）');
    }
  }
});

test('verseOf：節日那一週用節日那一句、其他看款式；表上沒有的卡退回通用句', () => {
  const { APP } = load();
  const E = APP.explore;
  const R = (by, ymd) => { const [y, m, d] = ymd.split('-').map(Number); return E.cardRule({ by, km: 8, date: new Date(y, m - 1, d, 12) }); };
  const V = E.VERSES;
  assert.equal(E.verseOf('p4', R('walk', '2026-10-05')).text, V.p4.woodcut, '秋天走路：木刻那一句');
  assert.equal(E.verseOf('p4', R('ride', '2026-10-05')).text, V.p4.gold, '搭 yoxi：金框那一句');
  const moon = E.verseOf('p4', R('walk', '2026-09-25'));
  assert.deepEqual([moon.text, moon.by, moon.title], [...V.p4.moon], '中秋那一週：中秋那一句，帶作者與篇名');
  assert.equal(E.verseOf('p4', R('ride', '2026-09-25')).text, V.p4.moon[0], '節日碰上搭 yoxi：還是節日那一句');
  assert.equal(E.verseOf('p1', R('walk', '2027-03-01')).text, V.p1.sakura, '櫻花季：賞櫻那一句');
  assert.equal(E.verseOf('p1', R('walk', '2026-12-20')).by, '', '自己寫的句子沒有作者');
  assert.equal(E.verseOf('p1', R('walk', '2026-10-05')).text, E.verseOf('p1', R('walk', '2026-10-05')).text, '同樣的組合每次都一樣（沒有亂數）');
  assert.notEqual(E.verseOf('p1', R('walk', '2026-10-05')).text, E.verseOf('p2', R('walk', '2026-10-05')).text, '不同地方不同句');
  assert.equal(E.verseOf('nope', R('walk', '2026-12-20')).text, V._.ink, '表上沒有的卡：通用句');
  assert.equal(E.verseOf('p1', null), null, '沒有款式：沒有句子');
  /* 收下之後（cardOrigin）挑到的跟當下（cardRule）一樣 */
  E.collect('station');
  const o = E.cardOrigin('p1', E.visits('p1').length);
  assert.equal(E.verseOf('p1', o).text, E.verseOf('p1', E.cardRule({ by: 'walk' })).text, 'cardOrigin 與 cardRule 挑到同一句');
});
