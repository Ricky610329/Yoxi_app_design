/* 由 build-video.py 產生，不要手改（改 shots.json 再重跑）。依旁白音檔實測的秒數。 */
window.TIMELINE = {
 "fps": 30,
 "lead": 0.25,
 "tail": 0.65,
 "fade": 0.5,
 "total": 128.18,
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
   "dur": 8.89,
   "end": 27.97,
   "speech": 6.49,
   "hold": 1.5,
   "narration": [
    "yoxi 城事，一天只給你一個地方。",
    "走得到就走，走不到，就用 yoxi 去。"
   ],
   "caption": "一天一個地方 · 走得到就走 · 走不到就用 yoxi 去",
   "subs": [
    {
     "t0": 19.33,
     "t1": 22.41,
     "text": "yoxi 城事，一天只給你一個地方。"
    },
    {
     "t0": 22.41,
     "t1": 25.82,
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
   "start": 27.97,
   "dur": 9.11,
   "end": 37.08,
   "speech": 7.21,
   "hold": 1.0,
   "narration": [
    "早上一則提醒，說今天有個地方離你不遠。",
    "它不催你，也不排名，一天就這一個。"
   ],
   "caption": "一天就這一個",
   "subs": [
    {
     "t0": 28.22,
     "t1": 32.02,
     "text": "早上一則提醒，說今天有個地方離你不遠。"
    },
    {
     "t0": 32.02,
     "t1": 35.43,
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
   "start": 37.08,
   "dur": 10.05,
   "end": 47.13,
   "speech": 7.15,
   "hold": 2.0,
   "narration": [
    "走過去。路過一百次都是灰的地方，",
    "走進去一次，才上色，變成一張明信片。"
   ],
   "caption": "到了才上色",
   "subs": [
    {
     "t0": 37.33,
     "t1": 40.7,
     "text": "走過去。路過一百次都是灰的地方，"
    },
    {
     "t0": 40.7,
     "t1": 44.48,
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
   "start": 47.13,
   "dur": 10.53,
   "end": 57.66,
   "speech": 7.63,
   "hold": 2.0,
   "narration": [
    "日子一天天過，你的城市一格一格亮起來。",
    "這是 yoxi 在不搭車的日子裡，被打開的理由。"
   ],
   "caption": "你的城市，一格一格亮起來",
   "subs": [
    {
     "t0": 47.38,
     "t1": 50.75,
     "text": "日子一天天過，你的城市一格一格亮起來。"
    },
    {
     "t0": 50.75,
     "t1": 55.01,
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
   "start": 57.66,
   "dur": 8.05,
   "end": 65.71,
   "speech": 6.15,
   "hold": 1.0,
   "narration": [
    "總有些地方，腳到不了。",
    "內灣老街，二十八公里，走一天也走不到。"
   ],
   "caption": "腳到不了的一段",
   "subs": [
    {
     "t0": 57.91,
     "t1": 60.17,
     "text": "總有些地方，腳到不了。"
    },
    {
     "t0": 60.17,
     "t1": 64.06,
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
   "start": 65.71,
   "dur": 9.01,
   "end": 74.72,
   "speech": 6.61,
   "hold": 1.5,
   "narration": [
    "按一下，它變成下車點，yoxi 帶你去。",
    "探索的終點，就是叫車的起點。"
   ],
   "caption": "探索的終點，就是叫車的起點",
   "subs": [
    {
     "t0": 65.96,
     "t1": 69.85,
     "text": "按一下，它變成下車點，yoxi 帶你去。"
    },
    {
     "t0": 69.85,
     "t1": 72.57,
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
   "start": 74.72,
   "dur": 10.15,
   "end": 84.87,
   "speech": 7.75,
   "hold": 1.5,
   "narration": [
    "搭 yoxi 抵達的地方，明信片鑲金框，",
    "點數回到和泰 Points。去遠方，變成一種收藏。"
   ],
   "caption": "去遠方，變成一種收藏",
   "subs": [
    {
     "t0": 74.97,
     "t1": 78.42,
     "text": "搭 yoxi 抵達的地方，明信片鑲金框，"
    },
    {
     "t0": 78.42,
     "t1": 82.72,
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
   "start": 84.87,
   "dur": 10.13,
   "end": 95.0,
   "speech": 7.73,
   "hold": 1.5,
   "narration": [
    "晚上，今天走過的路，自己變成一則回顧。",
    "日誌只有你看得到；週回顧，可以傳給爸媽。"
   ],
   "caption": "只有你的那一軌，和可分享的那一軌",
   "subs": [
    {
     "t0": 85.12,
     "t1": 88.88,
     "text": "晚上，今天走過的路，自己變成一則回顧。"
    },
    {
     "t0": 88.88,
     "t1": 92.85,
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
   "start": 95.0,
   "dur": 12.04,
   "end": 107.04,
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
     "t0": 95.25,
     "t1": 97.74,
     "text": "AI 在後面安靜做四件事："
    },
    {
     "t0": 97.74,
     "t1": 102.14,
     "text": "挑今天的地方、寫地方的故事、畫明信片、寫回顧。"
    },
    {
     "t0": 102.14,
     "t1": 105.39,
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
   "start": 107.04,
   "dur": 9.84,
   "end": 116.88,
   "speech": 7.44,
   "hold": 1.5,
   "narration": [
    "第零步不動叫車首頁，新竹先試十二週。",
    "看到數字再走下一步；看不到，就停。"
   ],
   "caption": "第 0 步不動叫車首頁 · 新竹 12 週 · 看到數字再走",
   "subs": [
    {
     "t0": 107.29,
     "t1": 111.12,
     "text": "第零步不動叫車首頁，新竹先試十二週。"
    },
    {
     "t0": 111.12,
     "t1": 114.73,
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
   "start": 116.88,
   "dur": 11.3,
   "end": 128.18,
   "speech": 7.9,
   "hold": 2.5,
   "narration": [
    "yoxi 城事。",
    "不搭車的日子，也有打開 yoxi 的理由。",
    "而搭車的日子，會因此多起來。"
   ],
   "caption": "yoxi 城事",
   "subs": [
    {
     "t0": 117.13,
     "t1": 118.6,
     "text": "yoxi 城事。"
    },
    {
     "t0": 118.6,
     "t1": 122.46,
     "text": "不搭車的日子，也有打開 yoxi 的理由。"
    },
    {
     "t0": 122.46,
     "t1": 125.03,
     "text": "而搭車的日子，會因此多起來。"
    }
   ],
   "calc": {}
  }
 ]
};
