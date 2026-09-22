#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fetch-map.py —— 一次性抓新竹的 OpenStreetMap 幾何，寫成離線可用的 JS 資料檔。

    python prototype/tools/fetch-map.py              # 抓 core + wide + places，寫三個檔
    python prototype/tools/fetch-map.py --dry-run    # 只印元素數與預估大小，不寫檔
    python prototype/tools/fetch-map.py --from-cache # 用 tools/.cache/ 的原始 JSON 重新塑形，不打網路
    python prototype/tools/fetch-map.py --only core  # 只做某一份（core / wide / places）
    python prototype/tools/fetch-map.py --synthetic  # 不連網，產生一份示意幾何（meta.synthetic = true）

產出（都掛在 window 上，file:// 下用 <script src> 讀，不用 fetch）：
    prototype/assets/map/hs-core.js     新竹車站周圍 3×3 km：三級道路、鐵路、河、水域、綠地、建物、地名
    prototype/assets/map/hs-wide.js     新竹市 11×12 km：主幹道、鐵路、河、海岸、水域、公園、界線、地名
    prototype/assets/map/hs-places.js   原型裡 11 個地點的經緯度（key 對齊 mock.js 的 id）

座標系：等距圓柱投影到公尺，原點新竹車站，+x 東、+y 南（螢幕向下）。
12 km 內與 Web Mercator 差 < 0.1%，肉眼不可見。兩份資料同一個原點，才能疊在一起。

授權：地圖資料 © OpenStreetMap 貢獻者，ODbL 1.0（https://www.openstreetmap.org/copyright）。
這支腳本只跑一次、原始回應存快取；看原型的人完全不連網。
"""
import io
import json
import math
import os
import random
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # prototype/
OUT = ROOT / 'assets' / 'map'
CACHE = Path(__file__).resolve().parent / '.cache'

UA = 'yoxi-chengshi-prototype/1.0 (offline design study; one-off fetch)'
MIRRORS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.osm.ch/api/interpreter',
]

# ---- 幾何常數 ---------------------------------------------------------------
ORIGIN = (24.8016, 120.9717)                       # 新竹車站
M_LAT = 110574.0
M_LON = 111320.0 * math.cos(math.radians(ORIGIN[0]))   # 101045.3
CORE = (24.7881, 120.9568, 24.8151, 120.9866)      # 3.0 × 3.0 km
WIDE = (24.7600, 120.9000, 24.8600, 121.0200)      # 11.1 × 12.1 km

CORE_BUDGET = 380 * 1024
WIDE_BUDGET = 140 * 1024

# ---- 原型裡的地點：手寫座標＋Overpass 查法 ----------------------------------
# real:false 的是原型虛構的地方（老玻璃窯、舊碼頭階梯、防空洞、戲院地基），
# 錨在一個真實的鄰近地點上；OSM 查不到它們，維持手寫並印警告。
PLACES = [
    ('station',    24.8016, 120.9717, True,  '新竹車站',
     'nwr["railway"="station"]["name"~"^新竹(車站)?$"]'),
    ('temple',     24.8047, 120.9663, True,  '新竹都城隍廟',
     'nwr["name"~"新竹都城隍廟|新竹城隍廟"]'),
    ('brick',      24.8065, 120.9686, True,  '新竹州廳（今市政府）',
     'nwr["name"~"^新竹市政府$|新竹州廳"]["building"]'),
    ('market',     24.8045, 120.9700, True,  '東門市場',
     'nwr["name"="東門市場"]'),
    ('moat',       24.8040, 120.9697, False, '護城河親水公園（「舊碼頭階梯」虛構）',
     'nwr["name"~"護城河親水公園"]'),
    ('hill',       24.7935, 120.9785, False, '十八尖山（「防空洞」虛構）',
     'nwr["natural"="peak"]["name"="十八尖山"]'),
    ('lake',       24.7740, 120.9720, False, '青草湖（「舊戲院地基」虛構）',
     'nwr["natural"="water"]["name"="青草湖"]'),
    ('harbour',    24.8460, 120.9230, True,  '南寮漁港',
     'nwr["name"~"南寮漁港"]'),
    ('rail',       24.7893, 121.0100, True,  '竹中車站',
     'nwr["railway"="station"]["name"~"^竹中(車站)?$"]'),
    ('glass-kiln', 24.7990, 120.9800, False, '水利路的老玻璃窯（半虛構，東區水利路巷內）',
     None),
    ('neiwan',     24.7047, 121.1741, True,  '內灣老街（28 km，兩個 bbox 都在外）',
     'nwr["railway"="station"]["name"~"^內灣(車站)?$"]'),
]

# 手放的區名（OSM 的行政區是 relation，沒有一個「放字的點」；這幾個是設計上的位置）
HAND_LABELS_CORE = [('北區', 24.8095, 120.9660), ('東區', 24.7990, 120.9800)]
HAND_LABELS_WIDE = [('北區', 24.8180, 120.9550), ('東區', 24.7900, 120.9900),
                    ('香山區', 24.7750, 120.9250), ('竹北', 24.8390, 121.0040)]


# ---- Overpass QL ---------------------------------------------------------------
def q_core(b):
    B = '(%f,%f,%f,%f)' % b
    return '''[out:json][timeout:180];
(
  way["highway"~"^(motorway|trunk|primary|secondary)(_link)?$"]%(B)s;
  way["highway"~"^(tertiary|unclassified|residential|living_street)(_link)?$"]%(B)s;
  way["highway"~"^(service|pedestrian|footway|path|steps)$"]%(B)s;
  way["railway"~"^(rail|light_rail|narrow_gauge)$"]%(B)s;
  way["waterway"~"^(river|stream|canal|drain)$"]%(B)s;
  way["natural"="water"]%(B)s;
  rel["natural"="water"]%(B)s;
  way["leisure"~"^(park|garden|pitch|sports_centre)$"]%(B)s;
  way["landuse"~"^(grass|forest|cemetery|recreation_ground)$"]%(B)s;
  way["building"]%(B)s;
  node["railway"="station"]%(B)s;
  node["place"~"^(suburb|quarter|neighbourhood)$"]%(B)s;
);
out geom qt;''' % {'B': B}


def q_wide(b):
    B = '(%f,%f,%f,%f)' % b
    return '''[out:json][timeout:180];
(
  way["highway"~"^(motorway|trunk|primary|secondary)(_link)?$"]%(B)s;
  way["railway"~"^(rail|narrow_gauge)$"]["service"!~"."]%(B)s;
  way["waterway"~"^(river|canal)$"]%(B)s;
  way["natural"="coastline"]%(B)s;
  way["natural"="water"]%(B)s;
  rel["natural"="water"]%(B)s;
  way["leisure"="park"]%(B)s;
  node["place"~"^(city|town|village|suburb)$"]%(B)s;
  node["railway"="station"]%(B)s;
  rel["boundary"="administrative"]["admin_level"~"^(7|8)$"]%(B)s;
);
out geom qt;''' % {'B': B}


def q_places():
    B = '(24.6800,120.8800,24.8800,121.2200)'
    parts = []
    for pid, lat, lon, real, name, flt in PLACES:
        if flt:
            parts.append('  %s%s;' % (flt, B))
    return '[out:json][timeout:120];\n(\n' + '\n'.join(parts) + '\n);\nout center tags;'


# ---- 網路 -----------------------------------------------------------------------
def overpass(name, query, from_cache=False):
    CACHE.mkdir(parents=True, exist_ok=True)
    cache = CACHE / ('overpass-%s.json' % name)
    if from_cache or (cache.exists() and os.environ.get('FETCHMAP_FORCE') is None and from_cache):
        return json.loads(cache.read_text(encoding='utf-8'))
    if from_cache:
        raise SystemExit('沒有快取：%s' % cache)
    data = ('data=' + urllib.parse.quote(query)).encode('utf-8')
    last = None
    for rnd in range(3):
        for url in MIRRORS:
            try:
                req = urllib.request.Request(url, data=data, headers={'User-Agent': UA})
                t = time.time()
                with urllib.request.urlopen(req, timeout=200) as r:
                    raw = r.read()
                obj = json.loads(raw.decode('utf-8'))
                cache.write_bytes(raw)
                print('  %-7s %s：%d 個元素，%.0f KB，%.1f s' % (
                    name, url.split('/')[2], len(obj.get('elements', [])), len(raw) / 1024, time.time() - t))
                return obj
            except Exception as e:                      # 429 / 504 / timeout：換 mirror
                last = e
                print('  %-7s %s 失敗：%s' % (name, url.split('/')[2], str(e)[:80]))
                time.sleep(8)
        time.sleep(30)
    raise RuntimeError('Overpass 三個 mirror 都失敗：%r' % last)


# ---- 投影與簡化 -------------------------------------------------------------------
def proj(lat, lon):
    return ((lon - ORIGIN[1]) * M_LON, -(lat - ORIGIN[0]) * M_LAT)


def dp(points, eps):
    """Douglas–Peucker（公尺空間）。points = [(x,y),…]"""
    if len(points) < 3 or eps <= 0:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = points[a]
        bx, by = points[b]
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy)
        best, bi = 0.0, -1
        for i in range(a + 1, b):
            px, py = points[i]
            if L == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                d = abs(dy * px - dx * py + bx * ay - by * ax) / L
            if d > best:
                best, bi = d, i
        if best > eps and bi > 0:
            keep[bi] = True
            stack.append((a, bi))
            stack.append((bi, b))
    return [p for p, k in zip(points, keep) if k]


def flat(points):
    out = []
    for x, y in points:
        out.append(round(x, 1))
        out.append(round(y, 1))
    return out


def area(points):
    s = 0.0
    n = len(points)
    for i in range(n):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2


def centroid(points):
    return (sum(p[0] for p in points) / len(points), sum(p[1] for p in points) / len(points))


def stitch(segments):
    """把 relation 的 outer member 段接成閉環（端點距離 < 1 m 就接）。"""
    segs = [list(s) for s in segments if len(s) >= 2]
    rings = []
    while segs:
        ring = segs.pop(0)
        changed = True
        while changed and math.hypot(ring[0][0] - ring[-1][0], ring[0][1] - ring[-1][1]) > 1.0:
            changed = False
            for i, s in enumerate(segs):
                if math.hypot(ring[-1][0] - s[0][0], ring[-1][1] - s[0][1]) < 1.0:
                    ring += s[1:]; segs.pop(i); changed = True; break
                if math.hypot(ring[-1][0] - s[-1][0], ring[-1][1] - s[-1][1]) < 1.0:
                    ring += list(reversed(s))[1:]; segs.pop(i); changed = True; break
                if math.hypot(ring[0][0] - s[-1][0], ring[0][1] - s[-1][1]) < 1.0:
                    ring = s[:-1] + ring; segs.pop(i); changed = True; break
                if math.hypot(ring[0][0] - s[0][0], ring[0][1] - s[0][1]) < 1.0:
                    ring = list(reversed(s))[:-1] + ring; segs.pop(i); changed = True; break
        rings.append(ring)
    return rings


# ---- 塑形 ---------------------------------------------------------------------------
MAJOR = ('motorway', 'trunk', 'primary', 'secondary',
         'motorway_link', 'trunk_link', 'primary_link', 'secondary_link')
MINOR = ('tertiary', 'unclassified', 'residential', 'living_street', 'tertiary_link')
SERVICE = ('service', 'pedestrian', 'footway', 'path', 'steps')


def bld_height(tags, a):
    h = tags.get('height')
    if h:
        try:
            return round(float(str(h).replace('m', '').strip()), 1)
        except ValueError:
            pass
    lv = tags.get('building:levels')
    if lv:
        try:
            return round(float(lv) * 3.2, 1)
        except ValueError:
            pass
    b = tags.get('building', '')
    if b in ('apartments', 'commercial', 'retail', 'office', 'hotel', 'hospital', 'public', 'civic'):
        return 10.0
    if b in ('shed', 'roof', 'garage', 'garages', 'carport', 'hut'):
        return 4.0
    if a > 1200:
        return 9.0
    return 6.5


def poi_label(L, tags, pts, core):
    """core 才放 POI 名：名字 ≤ 8 字、有實體面的東西，取重心。renderer 再做避撞與上限。"""
    name = tags.get('name')
    if not core or not name or len(name) > 8:
        return
    # 只留看地圖的人會想看到的名字（白名單字尾）；古蹟一律留。飯店、教會、福德祠、球場都不放。
    KEEP = ('公園', '市場', '博物館', '綠園道', '溪', '園林', '故居', '宅第', '迎曦門', '車站', '圖書館', '美術館')
    if not tags.get('historic') and not any(name.endswith(k) or k in name for k in KEEP):
        return
    if any(k in name for k in ('公墓', '生態池', '練習場', '停車場')):
        return
    if any(l['t'] == name for l in L['label']):          # 同名（護城河公園拆成七段）只放一個
        return
    cx, cy = centroid(pts)
    L['label'].append({'t': name, 'x': round(cx, 1), 'y': round(cy, 1), 'k': 'poi'})


def shape(obj, kind, lever=0):
    """Overpass JSON → 圖層 dict。lever = 降級槓桿的階數（0 = 不降級）。"""
    core = kind == 'core'
    eps_major = 3 if core else 12
    eps_minor = 4
    eps_serv = 8 if lever < 2 else 14
    eps_area = 3 if core else 15
    eps_bld = 1.2
    bld_r_full = 900 if lever < 3 else 700
    dp_round = 1 if lever < 4 else 0
    foot_r = 700 if lever >= 1 else None

    L = {'roadMajor': [], 'roadMinor': [], 'roadService': [], 'rail': [], 'railYard': [], 'water': [],
         'waterArea': [], 'park': [], 'coast': [], 'boundary': [], 'building': [], 'label': []}
    blds = []

    def geom(el):
        g = el.get('geometry') or []
        return [proj(p['lat'], p['lon']) for p in g if 'lat' in p]

    for el in obj.get('elements', []):
        t = el.get('type')
        tags = el.get('tags', {}) or {}
        if t == 'node':
            if 'lat' not in el:
                continue
            x, y = proj(el['lat'], el['lon'])
            name = tags.get('name')
            if not name:
                continue
            if tags.get('railway') == 'station':
                k = 'station'
                if not name.endswith('站'):
                    name = name + '站'
            elif tags.get('place') in ('city', 'town', 'suburb'):
                k = 'district'
            elif tags.get('place') in ('quarter', 'neighbourhood'):
                k = 'poi'
            else:
                continue                                   # place=village 的里名是雜訊
            L['label'].append({'t': name, 'x': round(x, 1), 'y': round(y, 1), 'k': k})
            continue
        if t == 'relation':
            if tags.get('natural') == 'water':
                segs = [[proj(p['lat'], p['lon']) for p in (m.get('geometry') or [])]
                        for m in el.get('members', []) if m.get('type') == 'way' and m.get('role', 'outer') in ('outer', '')]
                for ring in stitch(segs):
                    ring = dp(ring, eps_area)
                    if len(ring) >= 4:
                        L['waterArea'].append(flat(ring))
            elif tags.get('boundary') == 'administrative':
                for m in el.get('members', []):
                    if m.get('type') == 'way' and m.get('geometry'):
                        pts = dp([proj(p['lat'], p['lon']) for p in m['geometry']], eps_major)
                        if len(pts) >= 2:
                            L['boundary'].append(flat(pts))
            continue
        if t != 'way':
            continue
        pts = geom(el)
        if len(pts) < 2:
            continue
        hw = tags.get('highway')
        if hw in MAJOR:
            L['roadMajor'].append(flat(dp(pts, eps_major)))
        elif hw in MINOR:
            L['roadMinor'].append(flat(dp(pts, eps_minor)))
        elif hw in SERVICE:
            if foot_r is not None and hw in ('footway', 'path', 'steps'):
                cx, cy = centroid(pts)
                if math.hypot(cx, cy) > foot_r:
                    continue
            L['roadService'].append(flat(dp(pts, eps_serv)))
        elif tags.get('railway'):
            # 站場的股道（yard／siding／spur／crossover）另存一層：十幾條平行線疊起來會變成一條斑點帶
            if tags.get('service') in ('yard', 'siding', 'spur', 'crossover'):
                L['railYard'].append(flat(dp(pts, eps_major)))
            else:
                L['rail'].append(flat(dp(pts, eps_major)))
        elif tags.get('waterway'):
            w = tags['waterway']
            L['water'].append({'k': w, 'p': flat(dp(pts, eps_major))})
        elif tags.get('natural') == 'coastline':
            L['coast'].append(flat(dp(pts, eps_major)))
        elif tags.get('natural') == 'water':
            r = dp(pts, eps_area)
            if len(r) >= 4:
                L['waterArea'].append(flat(r))
                poi_label(L, tags, pts, core)
        elif tags.get('leisure') or tags.get('landuse'):
            r = dp(pts, eps_area)
            if len(r) >= 4:
                L['park'].append(flat(r))
                poi_label(L, tags, pts, core)
        elif 'building' in tags:
            if core and (tags.get('historic') or tags.get('tourism') or
                         tags.get('amenity') in ('place_of_worship', 'marketplace', 'townhall')):
                poi_label(L, tags, pts, core)
            if pts[0] != pts[-1]:
                pts = pts + [pts[0]]
            a = area(pts)
            if a < 40:
                continue
            cx, cy = centroid(pts)
            d = math.hypot(cx, cy)
            if d > 1500:
                continue
            if d > bld_r_full and a < 400:
                continue
            r = dp(pts, eps_bld)
            if len(r) < 4:
                continue
            blds.append((d, a, {'h': bld_height(tags, a), 'r': flat(r[:-1])}))

    blds.sort(key=lambda b: (b[0] > bld_r_full, -b[1]))
    L['building'] = [b[2] for b in blds[:2500]]
    if dp_round == 0:
        def r0(v):
            return [int(round(x)) for x in v]
        for k in ('roadMajor', 'roadMinor', 'roadService', 'rail', 'railYard', 'coast', 'boundary', 'waterArea', 'park'):
            L[k] = [r0(v) for v in L[k]]
        L['water'] = [{'k': w['k'], 'p': r0(w['p'])} for w in L['water']]
        L['building'] = [{'h': b['h'], 'r': r0(b['r'])} for b in L['building']]
    if not core:
        L.pop('building'); L.pop('roadService')
    else:
        L.pop('coast'); L.pop('boundary')
    for name, lat, lon in (HAND_LABELS_CORE if core else HAND_LABELS_WIDE):
        x, y = proj(lat, lon)
        L['label'].append({'t': name, 'x': round(x, 1), 'y': round(y, 1), 'k': 'district', 'hand': 1})
    return L


def js_text(varname, layers, meta):
    body = {'meta': meta}
    body.update(layers)
    txt = json.dumps(body, ensure_ascii=False, separators=(',', ':'))
    head = ('/* 由 tools/fetch-map.py 產生，不要手改。\n'
            '   地圖資料 © OpenStreetMap 貢獻者，ODbL 1.0 — https://www.openstreetmap.org/copyright\n'
            '   抓取：%s；set：%s；synthetic：%s */\n' % (meta['fetched'], meta['set'], meta['synthetic']))
    return head + 'window.%s = %s;\n' % (varname, txt)


def counts(L):
    return ' · '.join('%s %d' % (k, len(v)) for k, v in L.items())


# ---- 示意幾何（Overpass 全掛時的退路）--------------------------------------------------
def synthetic(kind):
    rng = random.Random(20260922)
    core = kind == 'core'
    span = 3000 if core else 11000
    L = {'roadMajor': [], 'roadMinor': [], 'roadService': [], 'rail': [], 'water': [],
         'waterArea': [], 'park': [], 'coast': [], 'boundary': [], 'building': [], 'label': []}
    ang = math.radians(18)
    c, s = math.cos(ang), math.sin(ang)

    def rot(x, y):
        return (x * c - y * s, x * s + y * c)
    step = 160 if core else 600
    n = int(span / step)
    for i in range(-n, n + 1):
        v = i * step
        a = rot(v, -span); b = rot(v, span)
        (L['roadMajor'] if i % 5 == 0 else L['roadMinor']).append(flat([a, b]))
        a = rot(-span, v); b = rot(span, v)
        (L['roadMajor'] if i % 4 == 0 else L['roadMinor']).append(flat([a, b]))
    # 兩條河：貝茲曲線
    for (x0, y0, x1, y1, x2, y2, k) in [(-span, -1200, 200, -900, span, -1600, 'river'),
                                        (-span, 900, 100, 1300, span, 700, 'stream')]:
        pts = []
        for t in [i / 24 for i in range(25)]:
            x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * x1 + t ** 2 * x2
            y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * y1 + t ** 2 * y2
            pts.append((x, y))
        L['water'].append({'k': k, 'p': flat(pts)})
    L['rail'].append(flat([rot(-span, 40), rot(span, 40)]))
    if core:
        for _ in range(400):
            bx, by = rng.uniform(-1300, 1300), rng.uniform(-1300, 1300)
            w, h = rng.uniform(10, 28), rng.uniform(10, 28)
            r = [rot(bx, by), rot(bx + w, by), rot(bx + w, by + h), rot(bx, by + h)]
            L['building'].append({'h': rng.choice([4.0, 6.5, 10.0, 16.0]), 'r': flat(r)})
        L.pop('coast'); L.pop('boundary')
    else:
        L.pop('building'); L.pop('roadService')
    for name, lat, lon in (HAND_LABELS_CORE if core else HAND_LABELS_WIDE):
        x, y = proj(lat, lon)
        L['label'].append({'t': name, 'x': round(x, 1), 'y': round(y, 1), 'k': 'district', 'hand': 1})
    return L


# ---- places ------------------------------------------------------------------------------
MATCH = {
    'station': lambda n, t: t.get('railway') == 'station' and n in ('新竹', '新竹車站'),
    'temple':  lambda n, t: '城隍廟' in n and '新竹' in n,
    'brick':   lambda n, t: n == '新竹市政府' or '州廳' in n,
    'market':  lambda n, t: n == '東門市場',
    'moat':    lambda n, t: '護城河親水公園' in n,
    'hill':    lambda n, t: t.get('natural') == 'peak' and n == '十八尖山',
    'lake':    lambda n, t: t.get('natural') == 'water' and n == '青草湖',
    'harbour': lambda n, t: '南寮漁港' in n and t.get('natural') != 'water',   # 滯洪池不是漁港
    'rail':    lambda n, t: t.get('railway') == 'station' and n in ('竹中', '竹中車站'),
    'neiwan':  lambda n, t: t.get('railway') == 'station' and n in ('內灣', '內灣車站'),
}


def shape_places(obj):
    """每個地點用自己的判斷式挑候選，離手寫座標最近的勝出；
    公車站牌（public_transport=platform）只在沒有別的候選時才用。"""
    found = {}
    if obj:
        for pid, hlat, hlon, real, label, flt in PLACES:
            pred = MATCH.get(pid)
            if not pred:
                continue
            best = None
            for el in obj.get('elements', []):
                tags = el.get('tags', {}) or {}
                name = tags.get('name', '') or ''
                if 'lat' in el:
                    lat, lon = el['lat'], el['lon']
                elif 'center' in el:
                    lat, lon = el['center']['lat'], el['center']['lon']
                else:
                    continue
                if not pred(name, tags):
                    continue
                d = math.hypot((lon - hlon) * M_LON, (lat - hlat) * M_LAT)
                rank = (1 if tags.get('public_transport') == 'platform' else 0, d)
                if best is None or rank < best[0]:
                    best = (rank, lat, lon, '%s/%s' % (el['type'], el['id']))
            if best:
                found[pid] = (best[1], best[2], best[3])
    out = {}
    print('  地點對帳（手寫 vs OSM）：')
    for pid, hlat, hlon, real, label, flt in PLACES:
        rec = {'lat': hlat, 'lon': hlon, 'real': real, 'name': label}
        if pid in found:
            lat, lon, osm = found[pid]
            dx = (lon - hlon) * M_LON
            dy = (lat - hlat) * M_LAT
            print('    %-11s 差 %5.0f m  → 採用 OSM %s' % (pid, math.hypot(dx, dy), osm))
            rec.update({'lat': round(lat, 5), 'lon': round(lon, 5), 'osm': osm})
        else:
            print('    %-11s %s' % (pid, '虛構地點，維持手寫' if not real else '⚠ OSM 沒查到，維持手寫'))
        x, y = proj(rec['lat'], rec['lon'])
        rec['x'] = round(x, 1); rec['y'] = round(y, 1)
        if math.hypot(x, y) > 7000:
            rec['offMap'] = True
        out[pid] = rec
    return out


# ---- main ---------------------------------------------------------------------------------
def main(argv):
    dry = '--dry-run' in argv
    from_cache = '--from-cache' in argv
    synth = '--synthetic' in argv
    only = None
    if '--only' in argv:
        only = argv[argv.index('--only') + 1].split(',')
    todo = only or ['core', 'wide', 'places']
    today = time.strftime('%Y-%m-%d')
    OUT.mkdir(parents=True, exist_ok=True)

    for kind, bbox, query, budget, var in [('core', CORE, q_core(CORE), CORE_BUDGET, 'HSINCHU_CORE'),
                                           ('wide', WIDE, q_wide(WIDE), WIDE_BUDGET, 'HSINCHU_WIDE')]:
        if kind not in todo:
            continue
        print('── %s ──' % kind)
        obj = None
        if not synth:
            try:
                obj = overpass(kind, query, from_cache)
            except Exception as e:
                print('  ✖ %s；改用示意幾何。' % e)
        if obj is None:
            L = synthetic(kind)
            is_synth = True
        else:
            L = shape(obj, kind)
            is_synth = False
        meta = {'v': 1, 'set': kind, 'fetched': today, 'synthetic': is_synth,
                'origin': list(ORIGIN), 'mPerDegLat': M_LAT, 'mPerDegLon': round(M_LON, 1),
                'bbox': list(bbox), 'spanM': [3000, 3000] if kind == 'core' else [11000, 12000],
                'source': 'OpenStreetMap contributors', 'licence': 'ODbL 1.0',
                'url': 'https://www.openstreetmap.org/copyright'}
        txt = js_text(var, L, meta)
        lever = 0
        while len(txt) > budget and lever < 4 and obj is not None:
            lever += 1
            L = shape(obj, kind, lever)
            txt = js_text(var, L, meta)
            print('  超出預算，降級槓桿 %d → %.0f KB' % (lever, len(txt) / 1024))
        print('  %s' % counts(L))
        print('  大小 %.0f KB（預算 %.0f KB）%s' % (len(txt) / 1024, budget / 1024, '' if len(txt) <= budget else ' ⚠ 仍超標'))
        if not dry:
            p = OUT / ('hs-%s.js' % kind)
            io.open(p, 'w', encoding='utf-8', newline='\n').write(txt)
            print('  → %s' % p.relative_to(ROOT.parent))

    if 'places' in todo:
        print('── places ──')
        obj = None
        if not synth:
            try:
                obj = overpass('places', q_places(), from_cache)
            except Exception as e:
                print('  ✖ %s；全部維持手寫。' % e)
        P = shape_places(obj)
        head = ('/* 由 tools/fetch-map.py 產生。原型裡 11 個地點的座標；key 對齊 mock.js 的 id。\n'
                '   real:false 的是原型虛構的地方，錨在真實鄰近地點上。x/y 是相對新竹車站的公尺（+x 東 +y 南）。\n'
                '   座標來源 © OpenStreetMap 貢獻者（ODbL）；抓取 %s */\n' % today)
        txt = head + 'window.HSINCHU_PLACES = %s;\n' % json.dumps(P, ensure_ascii=False, indent=1)
        if not dry:
            p = OUT / 'hs-places.js'
            io.open(p, 'w', encoding='utf-8', newline='\n').write(txt)
            print('  → %s（%d 個地點）' % (p.relative_to(ROOT.parent), len(P)))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
