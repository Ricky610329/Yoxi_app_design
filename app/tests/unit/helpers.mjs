/* 單元測試共用：在一個全新的 vm context 裡載入 app/js/app.js。
   document 是 undefined（app.js 不會自己 start()），其餘全域用最小的 stub。 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const APP_JS = fileURLToPath(new URL('../../js/app.js', import.meta.url));

/* 記憶體版 localStorage。opt.throwOnSet / throwOnGet 模擬私密視窗 */
export function memoryStorage(init = {}, opt = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem(k) { if (opt.throwOnGet) throw new Error('SecurityError'); return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { if (opt.throwOnSet) throw new Error('QuotaExceededError'); m.set(k, String(v)); },
    removeItem(k) { m.delete(k); },
    clear() { m.clear(); },
    get length() { return m.size; },
  };
}

export const MOCK_STUB = {
  SPOTS: [{ id: 'glass-kiln', name: '玻璃工坊', dist: 900, type: '工藝', art: 'glass' }],
  PENDING: [],
  TODAY: { id: 'glass-kiln', name: '玻璃工坊', dist: 900 },
  FAR_PLACE: { id: 'neiwan', name: '內灣', dist: 28000 },
  ROUTES: [{ id: 'rail', stops: [] }],
  POSTCARDS: [{ id: 'p11', name: '玻璃工坊' }],
  BADGES: [],
  findPlace(id) { return [this.TODAY, this.FAR_PLACE].find(p => p.id === id) || null; },
};

/* prototype/js/mock.js（只讀）：APP.place 的正規化要對真的資料測，stub 太小看不出 p1 → station 這種事 */
export const MOCK_JS = fileURLToPath(new URL('../../../prototype/js/mock.js', import.meta.url));

const repo = (rel) => fileURLToPath(new URL('../../../' + rel, import.meta.url));

/* views 的載入順序＝index.html（名字就是 app/js/views/<名字>.js）。
   node 只載得動沒有 DOM 的原型檔：icons／shell／interact／hsmap 不載（SHELL、INTERACT、HSMAP 是空物件），
   views 只跑到「註冊畫面＋匯出 APP.<區塊>」為止，render／mount 不在這裡測。 */
export const VIEW_ORDER = ['system', 'ride', 'explore-fx', 'explore-cards', 'explore-gold', 'explore', 'explore-unlock', 'album'];

/* 固定時間的 Date：new Date()／Date.now() 都是 at，其餘（帶參數的 new Date、Date.parse）照舊 */
export function fixedDate(at) {
  const R = Date;
  const t = typeof at === 'number' ? at : R.parse(at);
  if (isNaN(t)) throw new Error('fixedDate：看不懂的時間 ' + at);
  function D(...a) {
    if (!new.target) return new R(t).toString();
    return a.length ? new R(...a) : new R(t);
  }
  D.prototype = R.prototype;
  D.now = () => t;
  D.parse = R.parse;
  D.UTC = R.UTC;
  return D;
}

/* 載入時要摸一下 document 的檔（photos.js 讀 currentScript、explore-cards.js 找 #view 掛監看）：
   只在載入那一刻給一個什麼都找不到的 document，載完就拿掉，app.js 的「document 不存在就不 start()」照舊成立 */
const LOAD_DOC = { currentScript: null, getElementById: () => null, querySelector: () => null };

/* loadApp(opt)
   storage／noStorage   localStorage（記憶體版；noStorage 模擬私密視窗一碰就丟錯）
   realMock             載真的 prototype/js/mock.js
   realState            載真的 prototype/js/state.js（跟 storage 同一把 localStorage）
   views                要載的 views：['ride', 'album', …] 或 'all'；照 VIEW_ORDER 載，
                        有給就自動 realMock＋realState＋hs-places（地點名稱）＋credits／photos（明信片底圖）
   session              sessionStorage（預設記憶體版）
   now                  固定時間（毫秒或 ISO 字串）：todayMMDD、new Date() 都用它
   回傳 { APP, ctx, storage, STATE, MOCK } */
export function loadApp({ storage = memoryStorage(), noStorage = false, realMock = false, realState = false,
                          views = null, session = memoryStorage(), now = null } = {}) {
  if (!existsSync(APP_JS)) throw new Error('app/js/app.js 還不存在（core 還沒寫）');
  const list = views === 'all' ? VIEW_ORDER.slice() : (views || []);
  const bad = list.filter((v) => VIEW_ORDER.indexOf(v) < 0);
  if (bad.length) throw new Error('loadApp：不認得的 view ' + bad.join(', ') + '（可用：' + VIEW_ORDER.join(', ') + '）');
  if (list.length) { realMock = true; realState = true; }
  const ctx = {
    console, setTimeout, clearTimeout, URLSearchParams, Date: now == null ? Date : fixedDate(now), Math, JSON,
    document: undefined,
    MOCK: MOCK_STUB,
    STATE: { has: () => false, count: () => 0, all: { cards: {} } },
    SHELL: {}, INTERACT: {}, HSMAP: {},
    sessionStorage: session,
    history: { state: null, length: 1, pushState() {}, replaceState() {}, back() {} },
    location: { hash: '', search: '', pathname: '/app/index.html', protocol: 'file:', href: 'file:///app/index.html' },
    PHOTOS_BASE: '../prototype/assets/photos/',
  };
  if (!noStorage) ctx.localStorage = storage;
  else Object.defineProperty(ctx, 'localStorage', { get() { throw new Error('SecurityError: access denied'); } });
  ctx.window = ctx;
  vm.createContext(ctx);
  const run = (rel, name, needsDoc) => {
    if (needsDoc) ctx.document = LOAD_DOC;
    try { vm.runInContext(readFileSync(repo(rel), 'utf8'), ctx, { filename: name || rel }); }
    finally { if (needsDoc) ctx.document = undefined; }
  };
  if (realMock) {
    delete ctx.MOCK;
    run('prototype/js/mock.js', 'mock.js');
    if (!ctx.MOCK) throw new Error('prototype/js/mock.js 載入後沒有 window.MOCK');
  }
  if (realState) {
    delete ctx.STATE;
    run('prototype/js/state.js', 'state.js');
    if (!ctx.STATE) throw new Error('prototype/js/state.js 載入後沒有 window.STATE');
  }
  if (list.length) {
    run('prototype/assets/map/hs-places.js', 'hs-places.js');
    run('prototype/assets/photos/credits.js', 'credits.js');
    run('prototype/js/photos.js', 'photos.js', true);
  }
  vm.runInContext(readFileSync(APP_JS, 'utf8'), ctx, { filename: 'app.js' });
  if (!ctx.APP) throw new Error('app.js 載入後沒有 window.APP');
  VIEW_ORDER.filter((v) => list.indexOf(v) >= 0).forEach((v) => run('app/js/views/' + v + '.js', v + '.js', v === 'explore-cards'));
  return { APP: ctx.APP, ctx, storage, STATE: ctx.STATE, MOCK: ctx.MOCK };
}
