/* APP.family（album-family.js）的資料規則：傳到 LINE 的紀錄（store.shares）與家人的回應（store.replies）。
   全部是示意，只寫 APP.store；畫面與流程在 tests/specs/family.spec.js。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, memoryStorage } from './helpers.mjs';

const NOW = '2026-09-27T10:00:00+08:00';
const load = (init) => {
  const storage = memoryStorage(init ? { 'yoxi-chengshi-app-v1': JSON.stringify(init) } : {});
  return loadApp({ views: ['album-family'], now: NOW, storage });
};

test('send：認得的明信片才寫；v 預設 1、取整數；cap 去空白、最多 20 字；id 只有英數且不重複', () => {
  const { APP } = load();
  const F = APP.family;
  assert.equal(F.canSend('nope'), false);
  assert.equal(F.send({ card: 'nope' }), null, '認不得的卡不寫');
  assert.equal(F.send({}), null);
  assert.equal(APP.store.get('shares').length, 0);

  const a = F.send({ card: 'p1' });
  assert.deepEqual(Object.keys(a).sort(), ['at', 'card', 'id', 'v'], '沒有 cap 就沒有這個欄位');
  assert.equal(a.v, 1);
  assert.equal(a.at, new Date(NOW).toISOString());
  assert.match(a.id, /^[a-z0-9]+$/);
  assert.equal(F.send({ card: 'p1', v: '2.7' }).v, 2, 'v 取整數');
  assert.equal(F.send({ card: 'p1', v: -3 }).v, 1, '不合理的 v 當第一次');
  const c = F.send({ card: 'p2', cap: '   早安   平安喜樂   ' });
  assert.equal(c.cap, '早安 平安喜樂');
  assert.equal(Array.from(F.send({ card: 'p2', cap: '好'.repeat(30) }).cap).length, 20);
  const ids = APP.store.get('shares').map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'id 不重複（時間固定也一樣）');
  assert.deepEqual(APP.store.get('shares')[0], a, '照順序存（舊的在前）');
});

test('shares 最多留 30 筆：更舊的連同它的回應一起丟', () => {
  const { APP } = load();
  const F = APP.family;
  const first = F.send({ card: 'p1' });
  F.react(first.id, { text: '第一次' });
  for (let i = 0; i < 30; i++) F.send({ card: 'p2' });
  const list = APP.store.get('shares');
  assert.equal(list.length, 30);
  assert.ok(!list.some((s) => s.id === first.id), '最舊的丟掉');
  assert.ok(!Object.prototype.hasOwnProperty.call(APP.store.get('replies'), first.id), '它的回應也丟掉');
  assert.equal(F.repliesOf(first.id).length, 0);
});

test('sharesOf／latestOf：照卡、照第幾次造訪（v 省略＝每一次）', () => {
  const { APP } = load();
  const F = APP.family;
  const a = F.send({ card: 'p1' });
  const b = F.send({ card: 'p1', v: 2 });
  F.send({ card: 'p2' });
  assert.deepEqual([...F.sharesOf('p1').map((s) => s.id)], [a.id, b.id]);
  assert.deepEqual([...F.sharesOf('p1', 1).map((s) => s.id)], [a.id]);
  assert.deepEqual([...F.sharesOf('p1', 2).map((s) => s.id)], [b.id]);
  assert.equal(F.latestOf('p1').id, b.id);
  assert.equal(F.latestOf('p1', 1).id, a.id);
  assert.equal(F.latestOf('p3'), null);
});

test('react：喜歡是一筆（重按不會多）、收回就拿掉；一句話去空白、截 40 字（emoji 不切半）；空的、認不得的分享不寫', () => {
  const { APP } = load();
  const F = APP.family;
  const s = F.send({ card: 'p1' });
  assert.equal(F.react('nope', { heart: true }), null, '認不得的分享');
  assert.equal(F.react(s.id, { text: '   ' }), null, '空白的一句');
  assert.equal(F.react(s.id, {}), null, '什麼都沒給');

  F.react(s.id, { heart: true });
  F.react(s.id, { heart: true });
  let r = F.repliesOf(s.id);
  assert.equal(r.length, 1, '喜歡只有一筆');
  assert.deepEqual(Object.keys(r[0]).sort(), ['at', 'heart', 'text', 'who']);
  assert.deepEqual({ who: r[0].who, heart: r[0].heart, text: r[0].text }, { who: 'yun', heart: true, text: '' });
  assert.equal(F.hearted(s.id), true);

  F.react(s.id, { text: '  好漂亮\n\n下次帶我去 ' });
  r = F.repliesOf(s.id);
  assert.deepEqual({ heart: r[1].heart, text: r[1].text }, { heart: false, text: '好漂亮 下次帶我去' });
  F.react(s.id, { text: '🌸'.repeat(50) });
  assert.equal(F.repliesOf(s.id)[2].text, '🌸'.repeat(40), '以字（code point）算，不是 UTF-16');

  F.react(s.id, { heart: false });
  assert.equal(F.hearted(s.id), false);
  assert.equal(F.repliesOf(s.id).filter((x) => x.heart).length, 0, '收回的喜歡不留紀錄');

  F.react(s.id, { who: 'mom', text: '謝謝' });
  assert.equal(F.repliesOf(s.id).slice(-1)[0].who, 'mom', 'who 可以指定');

  const copy = F.repliesOf(s.id);
  copy.push({ who: 'x', heart: true, text: '', at: '' });
  assert.equal(F.repliesOf(s.id).length, copy.length - 1, 'repliesOf 回的是一份拷貝');
});

test('每次分享最多留 20 句話：丟最舊的一句，喜歡留著', () => {
  const { APP } = load();
  const F = APP.family;
  const s = F.send({ card: 'p1' });
  F.react(s.id, { heart: true });
  for (let i = 1; i <= 25; i++) F.react(s.id, { text: '第' + i + '句' });
  const r = F.repliesOf(s.id);
  assert.equal(r.filter((x) => !x.heart).length, 20);
  assert.equal(r.filter((x) => x.heart).length, 1, '喜歡還在');
  assert.equal(r.filter((x) => !x.heart)[0].text, '第6句', '最舊的五句丟掉');
});

test('repliesHTML：沒有回應是空字串；喜歡只寫名字、不寫數字；留言列最新三則；會 escape；v 分得開', () => {
  const { APP } = load();
  const F = APP.family;
  assert.equal(F.repliesHTML('p1'), '');
  const s = F.send({ card: 'p1' });
  assert.equal(F.repliesHTML('p1'), '', '傳了但沒人回');
  F.react(s.id, { heart: true });
  let h = F.repliesHTML('p1');
  assert.match(h, /家人的回應/);
  assert.match(h, /小芸 喜歡這張/);
  assert.doesNotMatch(h.replace(/<[^>]*>/g, ''), /\d/, '沒有任何數字');
  const s2 = F.send({ card: 'p1' });                 /* 同一張再傳一次：回應合在一起、名字不重複 */
  F.react(s2.id, { heart: true });
  ['一', '二', '三', '<b>四</b>'].forEach((t) => F.react(s2.id, { text: t }));
  h = F.repliesHTML('p1');
  assert.equal(h.split('小芸 喜歡這張').length, 2, '喜歡的人名只寫一次');
  assert.doesNotMatch(h, /<span>一<\/span>/, '只列最新三則');
  assert.match(h, /&lt;b&gt;四&lt;\/b&gt;/, 'escape');
  assert.doesNotMatch(h, /<b>四/);
  assert.notEqual(F.repliesHTML('p1', 1), '');
  assert.equal(F.repliesHTML('p1', 2), '', '第二次造訪的那一張沒有回應');
  assert.equal(F.repliesHTML('p2'), '');
});

test('store 裡壞掉的列（手改、舊版）略過，不丟例外', () => {
  const { APP } = load({
    shares: [null, { id: 3, card: 'p1' }, { card: 'p1' }, { id: 'ok1', card: 'p1', v: 1, at: NOW }],
    replies: { ok1: [null, { heart: true }, { who: 'yun', heart: false, text: '嗨', at: NOW }], other: 'x' },
  });
  const F = APP.family;
  assert.deepEqual([...F.shares().map((s) => s.id)], ['ok1']);
  assert.deepEqual([...F.repliesOf('ok1').map((r) => r.text)], ['嗨']);
  assert.equal(F.repliesOf('other').length, 0);
  assert.equal(F.repliesOf('constructor').length, 0, '原型鏈上的名字不算');
  assert.match(F.repliesHTML('p1'), /嗨/);
});
