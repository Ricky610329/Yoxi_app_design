/* ==========================================================================
   yoxi 城事 — State
   跨頁面的持久狀態。

   原型不是一疊互不相干的靜態畫面：在抵達解鎖收下一張明信片之後，
   收藏頁真的會多一張、統計會加一、獎章進度會動、路線會前進一站、
   點數會入帳。這是「作品完成度」最直接的證據。

   存在 localStorage。demo 首頁有「重設」可以清空，
   現場跑完一輪還能再跑一次。
   ========================================================================== */

(function () {
  'use strict';

  const KEY = 'yoxi-chengshi-v1';

  /* 初始狀態：使用者已經玩了一個月的樣子 */
  function fresh() {
    return {
      /* 已收集的明信片：id → { date, by, note } */
      cards: {
        p1: { date: '09.02', by: 'walk' },
        p2: { date: '09.05', by: 'walk' },
        p3: { date: '09.08', by: 'walk' },
        p4: { date: '09.12', by: 'ride' },
        p5: { date: '09.14', by: 'walk' },
        p6: { date: '09.17', by: 'walk' },
        p7: { date: '09.19', by: 'walk' },
        p8: { date: '09.20', by: 'ride' },
      },
      points: 50,
      km: 48,
      /* 今天的回顧 */
      today: { photo: null, mood: null, done: false },
      /* 設定的開關 */
      settings: { pushAm: true, pushPm: true, place: true, time: true, steps: true, photos: true, trips: false },
      /* 最近一次解鎖，用來在收藏頁標示「新」 */
      lastCard: null,
    };
  }

  let s;
  try {
    s = JSON.parse(localStorage.getItem(KEY)) || fresh();
  } catch (e) {
    s = fresh();
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* 私密視窗會丟錯，忽略 */ }
  }

  /* 地點 id ↔ 明信片 id。抵達解鎖時用得到。 */
  const PLACE_TO_CARD = {
    'glass-kiln': 'p11',
    'neiwan':     'p9',
  };

  const STATE = {

    get all() { return s; },

    has(id) { return !!s.cards[id]; },

    count() { return Object.keys(s.cards).length; },

    card(id) { return s.cards[id] || null; },

    /* 收下一張明信片。回傳是否為新收集。 */
    collect(placeId, opt) {
      opt = opt || {};
      const id = PLACE_TO_CARD[placeId] || placeId;
      /* 未知或空的 id 不建卡：否則統計會 +1，但收藏牆上找不到那張。 */
      const known = ((window.MOCK && window.MOCK.POSTCARDS) || [])
        .some(function (p) { return p.id === id; });
      if (!id || !known || s.cards[id]) return false;

      s.cards[id] = {
        date: opt.date || '09.21',
        by:   opt.by   || 'walk',
        note: opt.note || '',
      };
      s.lastCard = id;

      /* 距離由呼叫端給，不要寫死內灣的 28 公里 */
      s.km += Math.round(opt.km || (opt.by === 'ride' ? 12 : 1));
      if (opt.by === 'ride') s.points += 50;
      save();
      return true;
    },

    /* 一組明信片的收集進度。全 app 的路線與獎章都走這一個函式，
       避免同一枚獎章在不同畫面算出不同的數字。 */
    progress(ids) {
      ids = ids || [];
      const done = ids.filter(function (i) { return !!s.cards[i]; }).length;
      return { done: done, total: ids.length, got: ids.length > 0 && done === ids.length };
    },

    /* 路線的明信片清單直接從 ROUTES 的站點推導，不另存一份對應表 */
    routeIds(routeId) {
      const R = ((window.MOCK && window.MOCK.ROUTES) || [])
        .filter(function (r) { return r.id === routeId; })[0];
      return R ? R.stops.map(function (st) { return st.card; }).filter(Boolean) : [];
    },

    routeDone(routeId) {
      return this.progress(this.routeIds(routeId)).done;
    },

    badge(badgeId) {
      const B = ((window.MOCK && window.MOCK.BADGES) || [])
        .filter(function (b) { return b.id === badgeId; })[0];
      if (!B) return { done: 0, total: 0, got: false, name: '', icon: 'badge', ids: [] };
      const pr = this.progress(B.ids);
      pr.id = B.id; pr.name = B.name; pr.icon = B.icon;
      pr.award = B.award; pr.ids = B.ids;
      return pr;
    },

    setToday(patch) { Object.assign(s.today, patch); save(); },

    setSetting(k, v) { s.settings[k] = v; save(); },

    clearLast() { s.lastCard = null; save(); },

    reset() {
      s = fresh();
      save();
    },
  };

  window.STATE = STATE;
})();
