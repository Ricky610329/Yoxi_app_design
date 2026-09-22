/* ==========================================================================
   yoxi 城事 — 朋友與鄰居（概念稿專用資料）

   只有 screens/concept-friend-*.html 會載入這一支。mock.js 一個字都沒改：
   既有流程的十幾個畫面全靠它，為了三張概念稿去動共用資料，風險不成比例。

   地點一律引用既有的 MOCK.POSTCARDS id，不新增地方 ——
   自己編一個 id 的話 MOCK.findPlace() 會掉到通用展開，
   背面就會印出一段誰看了都知道是罐頭的文案。

   刻意沒有的欄位（不是忘了寫，是不寫）：
     unread（未讀點）／count（幾張）／lastSeenAt（他幾點看的）／
     online（在不在線上）／score（分數）
   這幾個只要存在，畫面遲早會把它印出來 —— 然後這一頁就從「互相寄一張」
   變成「誰欠誰一則回覆」。要比較、要催、要焦慮，都是從一個數字開始的。

   詞彙：任務／完成／達成／挑戰／每日 這五個詞不出現在任何會被畫出來的字串裡。
   見 tools/audit-app.html 的 C 項稽核。
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* 人                                                                  */
  /* ------------------------------------------------------------------ */

  /* shares: 'cards' ＝ 他把自己的牆打開了；'none' ＝ 沒打開。
     wall   ＝ 他願意給你看的那幾張（明信片 id）。
     沒有「他看了你幾張」這種欄位。 */
  const people = [
    { id: 'sis', name: '小芸', how: '妹妹', shares: 'cards',
      hello: '週末大多在南寮那一帶。', lastAt: '昨天寄了一張',
      wall: ['p4', 'p3', 'p7'] },

    { id: 'mom', name: '媽媽', how: '媽媽', shares: 'cards',
      hello: '早上去拜拜，順路走一圈。', lastAt: '這個禮拜寄過一張',
      wall: ['p7', 'p2'] },

    { id: 'ann', name: '怡君', how: '以前的同事', shares: 'cards',
      hello: '下班會繞去十八尖山走一段。', lastAt: '這個禮拜寄過一張',
      wall: ['p6', 'p8', 'p1'] },

    /* 他沒有打開牆。這一則存在是為了證明：寄送不需要對方分享 ——
       看不到他的牆，還是可以寄一張給他。 */
    { id: 'ken', name: '阿堅', how: '同一個社區', shares: 'none',
      hello: '', lastAt: '', wall: [] },
  ];

  /* ------------------------------------------------------------------ */
  /* 城市鄰居（AI）                                                       */
  /* ------------------------------------------------------------------ */

  /* isAI 一定要顯示出來，never 那幾條就是這個角色的圍牆：
     他不問你在哪裡、不催你回、不假裝自己是人。
     off ＝ 使用者可以把他關掉（概念稿用的開關狀態）。 */
  const neighbors = [
    { id: 'nb1', name: '阿源', isAI: true, off: false,
      title: '老街的雜貨店老闆', ground: '內灣老街一帶',
      spots: ['neiwan'], wall: ['p9', 'p10', 'p12'],
      tone: '話少。講的都是店門口看得到的事：光、風、今天有沒有人。',
      does: ['每隔幾天寄一張他那一帶的明信片，附一句話', '偶爾說某個地方今天好走'],
      never: ['不會問你在哪裡', '不會催你回', '不會假裝自己是人'],
      hello: '我店門口那條街，下午三點以後就有光。',
      first: { card: 'p9', note: '今天老街沒什麼人，適合慢慢走。' } },

    { id: 'nb2', name: '阿敏', isAI: true, off: false,
      title: '護城河邊的晨跑者', ground: '護城河與東門一帶',
      spots: ['moat'], wall: ['p3', 'p19', 'p2'],
      tone: '清晨的事。哪一段路面修好了、幾點的河邊最安靜。',
      does: ['每隔幾天寄一張河邊的明信片，附一句話', '偶爾說哪一段今天好走'],
      never: ['不會問你走了多少', '不會比誰走得多', '不會天天寄'],
      hello: '清晨六點的河邊，只有鳥在吵。',
      first: { card: 'p3', note: '河邊那排樹，早上有影子。' } },

    { id: 'nb3', name: '老陳', isAI: true, off: false,
      title: '內灣線的站務員', ground: '內灣線沿線',
      spots: ['neiwan'], wall: ['p5', 'p13', 'p1'],
      tone: '鐵道上的小事。月台的風、哪一班車人少。',
      does: ['每隔幾天寄一張站的明信片，附一句話', '偶爾說哪一站今天好下車'],
      never: ['不會報時刻表', '不會催你搭車', '不會假裝自己是人'],
      hello: '竹中站的月台，傍晚會有風。',
      first: { card: 'p5', note: '竹中站的月台，傍晚會有風。' } },
  ];

  /* ------------------------------------------------------------------ */
  /* 信件往返                                                            */
  /* ------------------------------------------------------------------ */

  /* 新到舊。沒有 read 欄位 —— 一旦有了已讀，就會有未讀，
     有了未讀，收件匣就會長出紅點，紅點就會變成負擔。 */
  const mail = [
    { id: 'm1', dir: 'in',  from: 'nb1', card: 'p9',  at: '09.21', note: '今天老街沒什麼人，適合慢慢走。' },
    { id: 'm2', dir: 'in',  from: 'sis', card: 'p4',  at: '09.20', note: '南寮的風今天特別大，你會喜歡。' },
    { id: 'm3', dir: 'out', to:   'sis', card: 'p7',  at: '09.20', note: '回你一張，城隍廟的香還是很濃。' },
    { id: 'm4', dir: 'in',  from: 'ann', card: 'p6',  at: '09.19', note: '十八尖山的階梯修好了，好走。' },
    { id: 'm5', dir: 'in',  from: 'nb2', card: 'p3',  at: '09.18', note: '清晨六點的河邊，只有鳥在吵。' },
    { id: 'm6', dir: 'out', to:   'mom', card: 'p2',  at: '09.17', note: '市場二樓那攤還在，下次帶你去。' },
    { id: 'm7', dir: 'in',  from: 'mom', card: 'p7',  at: '09.16', note: '今天去拜拜，順便走了一圈。' },
    { id: 'm8', dir: 'in',  from: 'nb3', card: 'p5',  at: '09.15', note: '竹中站的月台，傍晚會有風。' },
  ];

  /* 寄卡時的建議句。點一下就填進去，不想用就自己寫。 */
  const phrases = ['這裡你應該會喜歡', '下次一起來走', '今天天氣剛好', '想到你，寄一張'];

  /* 加朋友用的邀請碼。概念稿只有一組。 */
  const invite = 'YOXI-8F3K';

  /* ------------------------------------------------------------------ */
  /* 明信片背面的敘事                                                    */
  /* ------------------------------------------------------------------ */

  /* 跟 screens/postcard.html 的 STORY、js/shell.js 的 CARD_STORY 同一種東西：
     原型階段預先寫好的靜態文本，模擬 AI 生成的結果（見 mock.js 開頭）。
     這裡只寫這幾張概念稿真的會畫到的卡；其餘的走 findPlace() 的 hook。 */
  const STORY = {
    p1:  '1913 年落成，是台灣還在使用的最老車站。屋頂的鐘塔是巴洛克混德式的做法。',
    p2:  '市場的二樓比一樓安靜，樓梯在最裡面那一側。',
    p3:  '這條河以前繞著城牆走，現在只剩這一段還露在外面。',
    p4:  '風從海上直接吹進來，堤防上幾乎站不住人。',
    p5:  '內灣線與六家線在這裡分開，月台中間還留著一段舊軌。',
    p6:  '日本時代整座山被種成公園，步道到現在還是那幾條。',
    p7:  '廟埕邊的攤子開了幾十年，香火最旺的時候人走不動。',
    p8:  '水位低的那幾年，湖底的舊路會露出來。',
    p9:  '內灣線 1951 年通車，原本是為了把尖石山上的木材運下山。',
    p11: '新竹曾經是全世界最會做玻璃的地方之一。1970 年代這條巷子裡有七座窯，日夜不熄。',
  };

  /* ------------------------------------------------------------------ */
  /* 載入時的自我檢查                                                    */
  /* ------------------------------------------------------------------ */

  /* 照 shell.js nearSpots() 的做法：對不上就大聲喊，不要安靜地畫半張卡。
     引用到不存在的明信片 id，畫面上只會少一格，沒有人會發現。 */
  (function checkIds() {
    if (!window.MOCK || !window.MOCK.POSTCARDS) {
      throw new Error('mock-friends.js 要排在 mock.js 後面載入。');
    }
    const known = {};
    window.MOCK.POSTCARDS.forEach(function (p) { known[p.id] = true; });

    const used = [];
    people.concat(neighbors).forEach(function (m) {
      (m.wall || []).forEach(function (id) { used.push(id); });
      if (m.first && m.first.card) used.push(m.first.card);
    });
    mail.forEach(function (m) { used.push(m.card); });

    const miss = used.filter(function (id) { return !known[id]; });
    if (miss.length) {
      throw new Error('mock-friends：MOCK.POSTCARDS 裡沒有 ' + miss.join('、') +
                      '。牆與信件只能引用既有的明信片 id。');
    }
  })();

  /* ------------------------------------------------------------------ */
  /* 查詢                                                                */
  /* ------------------------------------------------------------------ */

  /** 誰。人給 how、鄰居給 title，都放在 sub，畫面不必分兩種寫法。 */
  function who(id) {
    if (id === 'me') return { id: 'me', name: '你', isAI: false, sub: '' };

    const p = people.filter(function (m) { return m.id === id; })[0];
    if (p) return { id: p.id, name: p.name, isAI: false, sub: p.how };

    const n = neighbors.filter(function (m) { return m.id === id; })[0];
    if (n) return { id: n.id, name: n.name, isAI: true, sub: n.title };

    /* 不認識的 id 不要假裝認識，但也不要讓畫面爆掉。 */
    return { id: id || '', name: String(id || ''), isAI: false, sub: '' };
  }

  /* 原型的「今天」固定在 09.21（跟 STATE 的初始狀態、每日回顧同一天）。
     不用 new Date()：demo 跨過午夜就會整頁的日期標籤一起換掉。 */
  const TODAY_AT = '09.21';
  const YESTERDAY_AT = '09.20';

  /** '09.21' → 今天｜'09.20' → 昨天｜其餘 → 更早。刻意不給「3 天前」這種數字。 */
  function dayLabel(at) {
    if (at === TODAY_AT) return '今天';
    if (at === YESTERDAY_AT) return '昨天';
    return '更早';
  }

  /** 這個人／鄰居願意給你看的那幾張（明信片 id）。沒打開牆就是空的。 */
  function wallOf(id) {
    const m = people.concat(neighbors).filter(function (x) { return x.id === id; })[0];
    return m && m.wall ? m.wall.slice() : [];
  }

  /* ------------------------------------------------------------------ */
  /* 畫一張別人的明信片                                                  */
  /* ------------------------------------------------------------------ */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function cardOf(id) {
    const all = (window.MOCK && window.MOCK.POSTCARDS) || [];
    return all.filter(function (p) { return p.id === id; })[0] || null;
  }

  /* expand() 沒有寫好的地方時，會自己組一段通用敘事。那一段的開頭是固定的，
     所以認得出來 —— 認不出來的話，三張概念稿的背面會有一半印同一句話。 */
  const CANNED = '這裡平常沒什麼人特別停下來';

  /* 背面那段敘事。上面寫好的優先，其次是地方自己的 hook，
     再來是 findPlace() 的 story 第一段（合興、九讚頭、橫山、舊碼頭階梯都有）。
     hook 是「收集於 09.05」那種的就不要用 —— 那是地圖圖釘的狀態字，
     印在明信片背面會變成一句沒有意義的話。 */
  function storyOf(id) {
    if (STORY[id]) return STORY[id];

    const pl = window.MOCK && window.MOCK.findPlace ? window.MOCK.findPlace(id) : null;
    if (!pl) return '在這裡停了一下。';

    if (pl.hook && pl.hook.indexOf('收集於') !== 0) return pl.hook;

    const first = pl.story && pl.story[0] ? pl.story[0].text : '';
    if (first && first.indexOf(CANNED) < 0) return first;

    return '在這裡停了一下。';
  }

  /**
   * 一張別人的明信片。尺寸與標記跟 SHELL.postcardCell 同一家，
   * 放進 .postcard-wall 就會排好，點一下由 interact.js 的 [data-flip] 翻面。
   *
   * @param {object} o  card 明信片 id（必須是既有的）
   *                    note 手寫的那一句（可省）
   *                    at   '09.20'（可省）
   *                    from 寄件人 id｜to 收件人 id（擇一，都可省）
   *                    flip true ＝ 一開始就是背面
   *                    seed 圖像亂數種子（預設用它在 POSTCARDS 的位置，
   *                         跟收藏牆上的同一張長得一樣）
   * @returns {string} HTML；card 不認識就回空字串
   */
  function cardHTML(o) {
    o = o || {};
    const p = cardOf(o.card);
    if (!p) return '';

    const all  = (window.MOCK && window.MOCK.POSTCARDS) || [];
    const seed = o.seed != null ? o.seed : all.indexOf(p);
    const name = esc(p.name);

    const from = o.from ? who(o.from) : null;
    const to   = (!from && o.to) ? who(o.to) : null;

    /* 左上角那一片標籤。AI 鄰居一定要標出來。 */
    let tag = '';
    if (from) {
      tag = '<span class="card-from">' + esc(from.name) + (from.isAI ? ' · AI' : '') + '</span>';
    } else if (to) {
      tag = '<span class="card-from">寄給 ' + esc(to.name) + '</span>';
    }

    /* 背面第二行。這是別人的卡，所以寫的是誰寄的，
       不是「走路抵達」—— 那是我自己收的那一張才有的事。 */
    const src  = from ? esc(from.name) + '寄的'
               : (to ? '寄給 ' + esc(to.name) : '你收過的');
    const line = o.at ? '2026.' + esc(o.at) + ' · ' + src : src;

    /* 一律是 button＋data-flip：別人的卡沒有「解鎖」這回事，
       所以不給 postcard--locked，也不連到 place.html。 */
    return '<button class="postcard' + (o.flip ? ' is-flipped' : '') + '"' +
        ' data-flip type="button" aria-label="' + name + '">' +
      '<div data-art="' + esc(p.art) + '" data-seed="' + seed + '"' +
        ' style="position:absolute;inset:0"></div>' +
      tag +
      '<span class="postcard__foot">' +
        '<span class="postcard__name">' + name + '</span>' +
        (o.at ? '<span class="postcard__date">' + esc(o.at) + '</span>' : '') +
      '</span>' +
      '<span class="postcard__back">' +
        '<b>' + name + '</b>' +
        '<small>' + line + '</small>' +
        '<p>' + esc(storyOf(p.id)) + '</p>' +
        (o.note ? '<p style="font-weight:800">「' + esc(o.note) + '」</p>' : '') +
        '<span class="postcard__stamp">yoxi</span>' +
      '</span></button>';
  }

  /**
   * 一面牆。items 裡的每一筆就是 cardHTML 的參數（card / note / at / from / to）。
   * 畫完自己叫 SHELL.injectArt()，呼叫端不用記得。
   *
   * @param {Element} el
   * @param {Array}   items
   * @param {object=} opt  empty 一張都沒有時顯示的一句話（沒給就畫空的）
   *                       flip  true ＝ 整面先翻到背面
   * @returns {number} 真的畫出來的張數
   */
  function renderWall(el, items, opt) {
    opt = opt || {};
    if (!el) return 0;

    const list = (items || []).filter(function (o) { return o && cardOf(o.card); });

    if (!list.length) {
      el.innerHTML = opt.empty ? '<p class="wallgroup__empty">' + esc(opt.empty) + '</p>' : '';
      return 0;
    }

    el.innerHTML = '<div class="postcard-wall">' + list.map(function (o) {
      return cardHTML({
        card: o.card, note: o.note, at: o.at, from: o.from, to: o.to,
        seed: o.seed, flip: o.flip != null ? o.flip : opt.flip,
      });
    }).join('') + '</div>';

    if (window.SHELL && window.SHELL.injectArt) window.SHELL.injectArt(el);
    return list.length;
  }

  window.FRIENDS = {
    people, neighbors, mail, phrases, invite,
    who, dayLabel, wallOf, cardHTML, renderWall,
  };
})();
