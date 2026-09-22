/* ==========================================================================
   yoxi 城事 — Review
   評語層：把「誰在哪個節點上寫了什麼、給幾分、判定是什麼」存起來。
   掛在 CATALOG 的樹節點 id 上（sys／tab:explore／scr:place／st:place@id=neiwan／
   flow:a／axis:map／var:E／var:E/variant-e-home.html?peek=1／vis:family-a）。

   為什麼另開一個 localStorage KEY，不跟 state.js 的 yoxi-chengshi-v1-2 共用：
   那一份是「使用者玩到哪」的 demo 狀態，demo 首頁的「重設」會 STATE.reset()
   把它整份清掉 —— 現場每跑一輪都會按一次。評語是人花時間寫的東西，
   不能被一顆給 demo 用的重設鈕連坐清掉，所以自己一個 KEY、自己一套生命週期。

   為什麼有 REVIEW_SEED：
   評語要能交出去、也要能收回來。一份審查結果可以固化成一支選配的
   js/review-seed.js（同樣的 { v, by, updatedAt, notes } 格式，指派給
   window.REVIEW_SEED），頁面載進來就是「大家看到的共同底稿」；
   本機 localStorage 疊在它上面，逐節點比 updatedAt，新的贏。
   這樣新開一台電腦看得到已經寫好的評語，自己改過的那幾條又不會被底稿蓋掉。
   不用 fetch 讀 JSON —— file:// 底下 fetch 會被 CORS 擋，只能用 <script>。

   匯入的兩條路由（<input type="file"> + FileReader、或 textarea 貼上）由
   呼叫端負責；這裡只提供 importJSON(text)，而且先給預覽、按了才寫。
   ========================================================================== */

(function () {
  'use strict';

  const KEY = 'yoxi-chengshi-review-v1';

  const VERDICTS = ['ok', 'todo', 'bug'];

  function nowISO() { return new Date().toISOString(); }

  function fresh() {
    return { v: 1, by: '', updatedAt: nowISO(), notes: {} };
  }

  /* 三者皆空就不算一則評語。空物件不存 —— 否則「評過幾個節點」會被
     一堆點開又關掉的節點灌水，統計跟實際寫了幾條對不起來。 */
  function isEmpty(n) {
    return !n || (n.score == null && n.verdict == null && !String(n.note || '').trim());
  }

  /* 外面來的東西（localStorage、seed、匯入的檔案）一律先過這裡。
     欄位缺了、型別錯了、分數超出 1..5、verdict 是沒看過的字串，
     都收斂成 null，不要讓壞資料活到渲染的時候才炸。 */
  function normNote(raw) {
    if (!raw || typeof raw !== 'object') return null;

    let score = raw.score;
    score = (score === null || score === undefined || score === '') ? null : Number(score);
    if (!(score >= 1 && score <= 5)) score = null;
    else score = Math.round(score);

    const verdict = VERDICTS.indexOf(raw.verdict) >= 0 ? raw.verdict : null;
    const note = typeof raw.note === 'string' ? raw.note : '';
    const updatedAt = typeof raw.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : nowISO();

    const n = { score: score, verdict: verdict, note: note, updatedAt: updatedAt };
    return isEmpty(n) ? null : n;
  }

  function normNotes(obj) {
    const out = {};
    if (!obj || typeof obj !== 'object') return out;
    Object.keys(obj).forEach(function (id) {
      const n = normNote(obj[id]);
      if (n) out[id] = n;
    });
    return out;
  }

  /* 逐節點比 updatedAt，新的贏。ISO 字串可以直接字典序比大小。 */
  function newer(a, b) {
    if (!a) return b;
    if (!b) return a;
    return String(b.updatedAt || '') >= String(a.updatedAt || '') ? b : a;
  }

  function copy(n) {
    return n ? { score: n.score, verdict: n.verdict, note: n.note, updatedAt: n.updatedAt } : null;
  }

  /* ---------------------------------------------------------------- 載入 -- */

  let s;
  try {
    /* 跟預設合併，不要直接用讀到的物件 —— 舊版或手動改壞的結構少了 notes，
       後面每一個 API 都會在 Object.keys(s.notes) 上丟例外。 */
    s = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY)) || {});
  } catch (e) {
    s = fresh();
  }
  s.v = 1;
  if (typeof s.by !== 'string') s.by = '';
  if (typeof s.updatedAt !== 'string') s.updatedAt = nowISO();
  s.notes = normNotes(s.notes);

  /* seed 當底稿，localStorage 疊上去。seed 只影響記憶體裡的這一份，
     不會立刻寫回 localStorage —— 只看不寫的人，本機就保持空的。 */
  if (window.REVIEW_SEED) {
    const seedNotes = normNotes(window.REVIEW_SEED.notes);
    const local = s.notes;
    Object.keys(local).forEach(function (id) {
      seedNotes[id] = newer(seedNotes[id], local[id]);
    });
    s.notes = seedNotes;
    if (!s.by && typeof window.REVIEW_SEED.by === 'string') s.by = window.REVIEW_SEED.by;
  }

  function save() {
    s.updatedAt = nowISO();
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* 私密視窗會丟錯，忽略 */ }
  }

  /* ------------------------------------------------------------------ API -- */

  const REVIEW = {

    KEY: KEY,
    VERDICTS: VERDICTS.slice(),

    get by() { return s.by; },
    setBy(name) { s.by = String(name == null ? '' : name); save(); return s.by; },

    /* 一則評語，或 null */
    get(id) { return copy(s.notes[id]); },

    /* 合併 patch。三者都變回空的就把整個 key 刪掉，不留空物件。
       回傳合併後的評語（被刪掉就是 null）。 */
    set(id, patch) {
      if (!id) return null;
      const base = s.notes[id] || { score: null, verdict: null, note: '' };
      const merged = normNote(Object.assign({}, base, patch || {}, { updatedAt: nowISO() }));
      if (!merged) delete s.notes[id];
      else s.notes[id] = merged;
      save();
      return copy(merged);
    },

    clear(id) {
      if (s.notes[id]) { delete s.notes[id]; save(); return true; }
      return false;
    },

    /* notes 的淺拷貝（每一則也各給一份複本，改它不會動到內部狀態） */
    all() {
      const out = {};
      Object.keys(s.notes).forEach(function (id) { out[id] = copy(s.notes[id]); });
      return out;
    },

    /* 不在樹上的評語 —— 節點改名或刪掉之後留下來的。回傳 id 陣列。 */
    orphans(validIds) {
      const valid = new Set(validIds || []);
      return Object.keys(s.notes).filter(function (id) { return !valid.has(id); }).sort();
    },

    /* validIds＝樹上所有節點 id。
       total    樹上的節點數（分母是樹，不是評語數）
       unrated  完全沒有評語的節點數
       ok/todo/bug  各判定的則數（只寫了文字沒給判定的，三者都不算，但也不算 unrated）
       orphans  不在樹上的評語則數 */
    stats(validIds) {
      const ids = validIds || [];
      const valid = new Set(ids);
      const out = { total: ids.length, unrated: 0, ok: 0, todo: 0, bug: 0, orphans: 0 };
      ids.forEach(function (id) { if (!s.notes[id]) out.unrated++; });
      Object.keys(s.notes).forEach(function (id) {
        if (!valid.has(id)) { out.orphans++; return; }
        const v = s.notes[id].verdict;
        if (v && out[v] !== undefined) out[v]++;
      });
      return out;
    },

    /* --------------------------------------------------------- 匯出 / 匯入 -- */

    /* key 排序過：兩次匯出之間的 diff 才讀得懂，丟進 git 也不會整份洗掉。 */
    exportJSON() {
      const notes = {};
      Object.keys(s.notes).sort().forEach(function (id) { notes[id] = copy(s.notes[id]); });
      return JSON.stringify({ v: 1, by: s.by, updatedAt: s.updatedAt, notes: notes }, null, 2);
    },

    download(filename) {
      const d = new Date();
      const pad = function (n) { return (n < 10 ? '0' : '') + n; };
      const name = filename || 'yoxi-review-' +
        d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.json';
      const url = URL.createObjectURL(new Blob([this.exportJSON()], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      /* 立刻 revoke 在某些版本會讓下載半路斷掉，排到下一輪再收。 */
      setTimeout(function () { URL.revokeObjectURL(url); }, 0);
      return name;
    },

    /**
     * 解析一份匯出的 JSON，先回傳預覽，呼叫 apply() 才真的寫進去。
     * 「按下匯入結果整份被蓋掉」是不可逆的，所以一定要先給人看會動到什麼。
     *
     * mode 'merge'（預設）逐節點比 updatedAt 取新的｜'replace' 整份換掉
     * validIds 選填；沒給就從 CATALOG 的樹拿，用來算孤兒。
     * 回傳 { add, overwrite, keep, orphans, apply }，前四個是 id 陣列
     *   add       本機沒有、會新增的
     *   overwrite 本機有、會被蓋掉的
     *   keep      本機有、會留著的（merge 時本機比較新或對方沒有；replace 時恆為空）
     *   orphans   這份檔案裡不在樹上的 id
     * 解析失敗丟 Error。
     */
    importJSON(text, mode, validIds) {
      mode = mode === 'replace' ? 'replace' : 'merge';

      let raw;
      try {
        raw = JSON.parse(String(text || ''));
      } catch (e) {
        throw new Error('這不是一份 JSON：' + e.message);
      }
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('格式不對：最外層要是一個物件。');
      }
      if (!raw.notes || typeof raw.notes !== 'object' || Array.isArray(raw.notes)) {
        throw new Error('格式不對：找不到 notes。要的是匯出的那份 { v, by, updatedAt, notes }。');
      }

      const incoming = normNotes(raw.notes);
      if (!Object.keys(incoming).length) {
        throw new Error('這份檔案裡沒有任何一則評語。');
      }

      if (!validIds && window.CATALOG && window.CATALOG.tree) {
        try { validIds = window.CATALOG.tree().order; } catch (e) { validIds = null; }
      }
      const valid = validIds ? new Set(validIds) : null;

      const add = [], overwrite = [], keep = [], orphans = [];
      const next = mode === 'replace' ? {} : Object.assign({}, s.notes);

      Object.keys(incoming).forEach(function (id) {
        if (valid && !valid.has(id)) orphans.push(id);
        const mine = s.notes[id];
        if (!mine) { add.push(id); next[id] = incoming[id]; return; }
        if (mode === 'replace' || newer(mine, incoming[id]) === incoming[id]) {
          overwrite.push(id);
          next[id] = incoming[id];
        } else {
          keep.push(id);
        }
      });
      if (mode !== 'replace') {
        Object.keys(s.notes).forEach(function (id) {
          if (!incoming[id]) keep.push(id);
        });
      }

      const by = typeof raw.by === 'string' ? raw.by : '';

      return {
        mode: mode,
        add: add.sort(), overwrite: overwrite.sort(), keep: keep.sort(), orphans: orphans.sort(),
        apply: function () {
          s.notes = next;
          if (!s.by && by) s.by = by;
          save();
          return { add: add.length, overwrite: overwrite.length, keep: keep.length };
        },
      };
    },
  };

  window.REVIEW = REVIEW;
})();
