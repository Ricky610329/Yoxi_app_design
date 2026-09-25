/* APP.fmt：畫面上的數字全部從這裡算（ARCHITECTURE.md §3.4） */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './helpers.mjs';

const { APP } = loadApp();
const f = APP.fmt;

test('WALK_MAX_M 是 3000', () => assert.equal(f.WALK_MAX_M, 3000));

test('fare = round(75 + 22 km)', () => {
  assert.equal(f.fare(28), 691);
  assert.equal(f.fare(0), 75);
  assert.equal(f.fare(1.4), Math.round(75 + 22 * 1.4));
});

test('rideMin = round(3 + 2.2 km)', () => {
  assert.equal(f.rideMin(28), 65);
  assert.equal(f.rideMin(0), 3);
  assert.equal(f.rideMin(10), 25);
});

test('walkMin = round(m / 75)', () => {
  assert.equal(f.walkMin(900), 12);
  assert.equal(f.walkMin(3000), 40);
  assert.equal(f.walkMin(0), 0);
});

test('dist：< 1000 用 m，其餘一位小數 km', () => {
  assert.equal(f.dist(900), '900 m');
  assert.equal(f.dist(999), '999 m');
  assert.equal(f.dist(1400), '1.4 km');
  assert.equal(f.dist(1000), '1.0 km');
  assert.equal(f.dist(28000), '28.0 km');
});

test('dist 先四捨五入再挑單位：999.6 m 是 1.0 km，不是 1000 m', () => {
  assert.equal(f.dist(999.6), '1.0 km');
  assert.equal(f.dist(999.5), '1.0 km');
  assert.equal(f.dist(999.4), '999 m');
  assert.equal(f.dist(0.4), '0 m');
  assert.equal(f.dist(null), '0 m', 'null 照舊當 0（呼叫端自己擋「距離待確認」）');
  assert.equal(f.dist('1400'), '1.4 km', '字串數字照樣算');
});

test('canWalk：≤ 3000 m 才走得到', () => {
  assert.equal(f.canWalk(3000), true);
  assert.equal(f.canWalk(3001), false);
  assert.equal(f.canWalk(900), true);
  assert.equal(f.canWalk(28000), false);
});

test('greet 分界：5–11 早安、11–18 午安、其餘晚安', () => {
  const want = { 0: '晚安', 4: '晚安', 5: '早安', 10: '早安', 11: '午安', 17: '午安', 18: '晚安', 23: '晚安' };
  for (const [h, g] of Object.entries(want)) assert.equal(f.greet(Number(h)), g, 'hour ' + h);
});

test('todayMMDD 是 MM.DD、補零、用今天', () => {
  assert.match(f.todayMMDD(), /^\d{2}\.\d{2}$/);
  const d = new Date();
  const want = String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
  assert.equal(f.todayMMDD(), want);
  assert.equal(f.todayMMDD(new Date(2026, 8, 3)), '09.03');
  assert.equal(f.todayMMDD(new Date(2026, 11, 25)), '12.25');
});

test('num 千分位', () => {
  assert.equal(f.num(1234567), '1,234,567');
  assert.equal(f.num(999), '999');
  assert.equal(f.num(0), '0');
});

test('esc 轉義 HTML', () => {
  assert.equal(APP.esc('<a href="x">&</a>').indexOf('<'), -1);
  assert.match(APP.esc('&'), /&amp;/);
  assert.equal(APP.esc(null), '');
});
