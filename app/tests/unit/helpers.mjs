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

export function loadApp({ storage = memoryStorage(), noStorage = false } = {}) {
  if (!existsSync(APP_JS)) throw new Error('app/js/app.js 還不存在（core 還沒寫）');
  const ctx = {
    console, setTimeout, clearTimeout, URLSearchParams, Date, Math, JSON,
    document: undefined,
    MOCK: MOCK_STUB,
    STATE: { has: () => false, count: () => 0, all: { cards: {} } },
    SHELL: {}, INTERACT: {}, HSMAP: {},
  };
  if (!noStorage) ctx.localStorage = storage;
  else Object.defineProperty(ctx, 'localStorage', { get() { throw new Error('SecurityError: access denied'); } });
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(APP_JS, 'utf8'), ctx, { filename: 'app.js' });
  if (!ctx.APP) throw new Error('app.js 載入後沒有 window.APP');
  return { APP: ctx.APP, ctx, storage };
}
