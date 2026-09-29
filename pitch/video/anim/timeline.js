/* 由 build-video.py 產生，不要手改（改 shots.json 再重跑）。依旁白音檔實測的秒數。 */
window.TIMELINE = {
 "fps": 30,
 "lead": 0.25,
 "tail": 0.65,
 "fade": 0.5,
 "total": 127.53,
 "estimated": false,
 "calc": {
  "neiwan": {
   "id": "neiwan",
   "label": "內灣老街",
   "km": 28.0,
   "fare": 691,
   "min": 65,
   "pts": 34,
   "bonus": 50
  },
  "kiln": {
   "id": "glass-kiln",
   "label": "水利路的老玻璃窯",
   "m": 900,
   "walkMin": 12
  },
  "walkMaxKm": 3,
  "pushPerDay": 2,
  "pilotCity": "新竹",
  "pilotWeeks": 12,
  "badge": {
   "have": 4,
   "of": 8
  },
  "roadmap": [
   {
    "step": 0,
    "name": "記錄與獎章",
    "when": "2027 Q1 · 新竹 12 週"
   },
   {
    "step": 1,
    "name": "探索",
    "when": "2027 Q2"
   },
   {
    "step": 2,
    "name": "轉換",
    "when": "2027 Q3"
   },
   {
    "step": 3,
    "name": "分享與世代",
    "when": "2027 Q3–Q4"
   },
   {
    "step": 4,
    "name": "整合",
    "when": "2028 起"
   }
  ]
 },
 "shots": [
  {
   "i": 1,
   "id": "s01-quiet",
   "scene": "quiet",
   "section": "開場",
   "theme": "light",
   "start": 0.0,
   "dur": 10.0,
   "end": 10.0,
   "speech": 8.1,
   "hold": 1.0,
   "narration": [
    "一座城市，你每天經過，卻很少真的走進去。",
    "叫車 app 也一樣，只有要出門那一刻才被打開。"
   ],
   "caption": "只有要出門那一刻，才被打開",
   "subs": [
    {
     "t0": 0.25,
     "t1": 3.93,
     "text": "一座城市，你每天經過，卻很少真的走進去。"
    },
    {
     "t0": 3.93,
     "t1": 8.35,
     "text": "叫車 app 也一樣，只有要出門那一刻才被打開。"
    }
   ],
   "calc": {}
  },
  {
   "i": 2,
   "id": "s02-question",
   "scene": "question",
   "section": "開場",
   "theme": "dark",
   "start": 10.0,
   "dur": 9.08,
   "end": 19.08,
   "speech": 7.38,
   "hold": 0.8,
   "narration": [
    "不搭車的日子，yoxi 能不能還是被打開？",
    "我們的答案是：給它一個跟車無關的理由。"
   ],
   "caption": "給它一個跟車無關的理由",
   "subs": [
    {
     "t0": 10.25,
     "t1": 14.12,
     "text": "不搭車的日子，yoxi 能不能還是被打開？"
    },
    {
     "t0": 14.12,
     "t1": 17.63,
     "text": "我們的答案是：給它一個跟車無關的理由。"
    }
   ],
   "calc": {}
  },
  {
   "i": 3,
   "id": "s03-name",
   "scene": "name",
   "section": "願景",
   "theme": "light",
   "start": 19.08,
   "dur": 8.59,
   "end": 27.67,
   "speech": 6.19,
   "hold": 1.5,
   "narration": [
    "遊喜樂，一天只給你一個地方。",
    "走得到就走，走不到，就用 yoxi 去。"
   ],
   "caption": "一天一個地方 · 走得到就走 · 走不到就用 yoxi 去",
   "subs": [
    {
     "t0": 19.33,
     "t1": 21.88,
     "text": "遊喜樂，一天只給你一個地方。"
    },
    {
     "t0": 21.88,
     "t1": 25.52,
     "text": "走得到就走，走不到，就用 yoxi 去。"
    }
   ],
   "calc": {}
  },
  {
   "i": 4,
   "id": "s04-morning",
   "scene": "morning",
   "section": "A 不搭車的日常",
   "theme": "light",
   "start": 27.67,
   "dur": 9.11,
   "end": 36.78,
   "speech": 7.21,
   "hold": 1.0,
   "narration": [
    "早上一則提醒，說今天有個地方離你不遠。",
    "它不催你，也不排名，一天就這一個。"
   ],
   "caption": "一天就這一個",
   "subs": [
    {
     "t0": 27.92,
     "t1": 31.72,
     "text": "早上一則提醒，說今天有個地方離你不遠。"
    },
    {
     "t0": 31.72,
     "t1": 35.13,
     "text": "它不催你，也不排名，一天就這一個。"
    }
   ],
   "calc": {
    "walk_m": 900
   }
  },
  {
   "i": 5,
   "id": "s05-walk",
   "scene": "walk",
   "section": "A 不搭車的日常",
   "theme": "light",
   "start": 36.78,
   "dur": 10.05,
   "end": 46.83,
   "speech": 7.15,
   "hold": 2.0,
   "narration": [
    "走過去。路過一百次都是灰的地方，",
    "走進去一次，才上色，變成一張明信片。"
   ],
   "caption": "到了才上色",
   "subs": [
    {
     "t0": 37.03,
     "t1": 40.4,
     "text": "走過去。路過一百次都是灰的地方，"
    },
    {
     "t0": 40.4,
     "t1": 44.18,
     "text": "走進去一次，才上色，變成一張明信片。"
    }
   ],
   "calc": {}
  },
  {
   "i": 6,
   "id": "s06-lightup",
   "scene": "lightup",
   "section": "A 不搭車的日常",
   "theme": "light",
   "start": 46.83,
   "dur": 10.53,
   "end": 57.36,
   "speech": 7.63,
   "hold": 2.0,
   "narration": [
    "日子一天天過，你的城市一格一格亮起來。",
    "這是 yoxi 在不搭車的日子裡，被打開的理由。"
   ],
   "caption": "你的城市，一格一格亮起來",
   "subs": [
    {
     "t0": 47.08,
     "t1": 50.45,
     "text": "日子一天天過，你的城市一格一格亮起來。"
    },
    {
     "t0": 50.45,
     "t1": 54.71,
     "text": "這是 yoxi 在不搭車的日子裡，被打開的理由。"
    }
   ],
   "calc": {}
  },
  {
   "i": 7,
   "id": "s07-far",
   "scene": "far",
   "section": "B 搭車的轉換",
   "theme": "light",
   "start": 57.36,
   "dur": 8.05,
   "end": 65.41,
   "speech": 6.15,
   "hold": 1.0,
   "narration": [
    "總有些地方，腳到不了。",
    "內灣老街，二十八公里，走一天也走不到。"
   ],
   "caption": "腳到不了的一段",
   "subs": [
    {
     "t0": 57.61,
     "t1": 59.87,
     "text": "總有些地方，腳到不了。"
    },
    {
     "t0": 59.87,
     "t1": 63.76,
     "text": "內灣老街，二十八公里，走一天也走不到。"
    }
   ],
   "calc": {
    "km": 28.0,
    "say_km": true
   }
  },
  {
   "i": 8,
   "id": "s08-ride",
   "scene": "ride",
   "section": "B 搭車的轉換",
   "theme": "light",
   "start": 65.41,
   "dur": 9.01,
   "end": 74.42,
   "speech": 6.61,
   "hold": 1.5,
   "narration": [
    "按一下，它變成下車點，yoxi 帶你去。",
    "探索的終點，就是叫車的起點。"
   ],
   "caption": "探索的終點，就是叫車的起點",
   "subs": [
    {
     "t0": 65.66,
     "t1": 69.55,
     "text": "按一下，它變成下車點，yoxi 帶你去。"
    },
    {
     "t0": 69.55,
     "t1": 72.27,
     "text": "探索的終點，就是叫車的起點。"
    }
   ],
   "calc": {
    "km": 28.0
   }
  },
  {
   "i": 9,
   "id": "s09-gold",
   "scene": "gold",
   "section": "B 搭車的轉換",
   "theme": "light",
   "start": 74.42,
   "dur": 10.15,
   "end": 84.57,
   "speech": 7.75,
   "hold": 1.5,
   "narration": [
    "搭 yoxi 抵達的地方，明信片鑲金框，",
    "點數回到和泰 Points。去遠方，變成一種收藏。"
   ],
   "caption": "去遠方，變成一種收藏",
   "subs": [
    {
     "t0": 74.67,
     "t1": 78.12,
     "text": "搭 yoxi 抵達的地方，明信片鑲金框，"
    },
    {
     "t0": 78.12,
     "t1": 82.42,
     "text": "點數回到和泰 Points。去遠方，變成一種收藏。"
    }
   ],
   "calc": {}
  },
  {
   "i": 10,
   "id": "s10-night",
   "scene": "night",
   "section": "C 晚上的回顧",
   "theme": "dark",
   "start": 84.57,
   "dur": 10.13,
   "end": 94.7,
   "speech": 7.73,
   "hold": 1.5,
   "narration": [
    "晚上，今天走過的路，自己變成一則回顧。",
    "日誌只有你看得到；週回顧，可以傳給爸媽。"
   ],
   "caption": "只有你的那一軌，和可分享的那一軌",
   "subs": [
    {
     "t0": 84.82,
     "t1": 88.58,
     "text": "晚上，今天走過的路，自己變成一則回顧。"
    },
    {
     "t0": 88.58,
     "t1": 92.55,
     "text": "日誌只有你看得到；週回顧，可以傳給爸媽。"
    }
   ],
   "calc": {}
  },
  {
   "i": 11,
   "id": "s11-ai",
   "scene": "ai",
   "section": "AI",
   "theme": "light",
   "start": 94.7,
   "dur": 12.04,
   "end": 106.74,
   "speech": 10.14,
   "hold": 1.0,
   "narration": [
    "AI 在後面安靜做四件事：",
    "挑今天的地方、寫地方的故事、畫明信片、寫回顧。",
    "它不搶戲，只讓每一天都有一個理由。"
   ],
   "caption": "AI 的四個角色：推薦 · 內容 · 明信片 · 回顧",
   "subs": [
    {
     "t0": 94.95,
     "t1": 97.44,
     "text": "AI 在後面安靜做四件事："
    },
    {
     "t0": 97.44,
     "t1": 101.84,
     "text": "挑今天的地方、寫地方的故事、畫明信片、寫回顧。"
    },
    {
     "t0": 101.84,
     "t1": 105.09,
     "text": "它不搶戲，只讓每一天都有一個理由。"
    }
   ],
   "calc": {}
  },
  {
   "i": 12,
   "id": "s12-roadmap",
   "scene": "roadmap",
   "section": "路線圖",
   "theme": "light",
   "start": 106.74,
   "dur": 9.84,
   "end": 116.58,
   "speech": 7.44,
   "hold": 1.5,
   "narration": [
    "第零步不動叫車首頁，新竹先試十二週。",
    "看到數字再走下一步；看不到，就停。"
   ],
   "caption": "第 0 步不動叫車首頁 · 新竹 12 週 · 看到數字再走",
   "subs": [
    {
     "t0": 106.99,
     "t1": 110.82,
     "text": "第零步不動叫車首頁，新竹先試十二週。"
    },
    {
     "t0": 110.82,
     "t1": 114.43,
     "text": "看到數字再走下一步；看不到，就停。"
    }
   ],
   "calc": {}
  },
  {
   "i": 13,
   "id": "s13-end",
   "scene": "end",
   "section": "結尾",
   "theme": "dark",
   "start": 116.58,
   "dur": 10.95,
   "end": 127.53,
   "speech": 7.55,
   "hold": 2.5,
   "narration": [
    "遊喜樂。",
    "不搭車的日子，也有打開 yoxi 的理由。",
    "而搭車的日子，會因此多起來。"
   ],
   "caption": "遊喜樂",
   "subs": [
    {
     "t0": 116.83,
     "t1": 117.6,
     "text": "遊喜樂。"
    },
    {
     "t0": 117.6,
     "t1": 121.67,
     "text": "不搭車的日子，也有打開 yoxi 的理由。"
    },
    {
     "t0": 121.67,
     "t1": 124.38,
     "text": "而搭車的日子，會因此多起來。"
    }
   ],
   "calc": {}
  }
 ]
};
