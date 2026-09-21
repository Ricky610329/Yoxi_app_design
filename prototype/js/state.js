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
      if (s.cards[id]) return false;

      s.cards[id] = {
        date: opt.date || '09.21',
        by:   opt.by   || 'walk',
        note: opt.note || '',
      };
      s.lastCard = id;

      if (opt.by === 'ride') {
        s.points += 50;
        s.km += 28;
      } else {
        s.km += 1;
      }
      save();
      return true;
    },

    /* 某條路線已完成幾站 */
    routeDone(routeId) {
      const M = {
        rail:  ['p1', 'p5', 'p9', 'p10', 'p12', 'p13'],
        glass: ['p11'],
        water: ['p3'],
      };
      const ids = M[routeId] || [];
      return ids.filter(function (i) { return !!s.cards[i]; }).length;
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
