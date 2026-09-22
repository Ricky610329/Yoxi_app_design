#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fetch-photos.py —— 一次性從 Wikimedia Commons 抓新竹地標的實景照片，寫成離線可用的圖檔＋出處資料。

    python prototype/tools/fetch-photos.py --list            # 只列候選（授權／作者／尺寸），不下載
    python prototype/tools/fetch-photos.py --dry-run         # 搜尋＋篩選＋選片，印結果，不下載、不寫 credits.js
    python prototype/tools/fetch-photos.py                   # 預設：搜尋→解析→篩選→下載→寫 credits.js
    python prototype/tools/fetch-photos.py --only temple,station
    python prototype/tools/fetch-photos.py --all             # 連選配的地點（東門市場／青草湖／竹中）一起做
    python prototype/tools/fetch-photos.py --refresh         # 忽略 tools/.cache/ 的舊回應，重新打 API

產出：
    prototype/assets/photos/<id>-1.jpg     800 px 寬的縮圖（不是原圖）
    prototype/assets/photos/credits.js     window.PHOTOS_DATA = { <id>: [ {作者/授權/出處/尺寸…} ] }

授權規則（寫死在 ok() 裡，不放行例外）：
    只收 CC BY / CC BY-SA / CC0 / Public domain；NC、ND、GFDL-only、fair use 一律退掉。
    mime 必須是 jpeg 或 png，原圖寬度 ≥ 800，下載的是 iiurlwidth=800 的 thumburl。
    作者與授權會寫進 credits.js，頁面上必須顯示（見 js/photos.js 的 .photo__credit）。

禮貌規則：Commons 對沒簽名的連打會回 429。所以每次呼叫間隔 2 秒、429/503 退避 5/15/45 秒、
最多 4 次，原始回應存 tools/.cache/commons-*.json，重跑時預設吃快取不再打網路。
"""
import argparse
import hashlib
import html as htmllib
import io
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # prototype/
OUT = ROOT / 'assets' / 'photos'
CACHE = Path(__file__).resolve().parent / '.cache'
PICKED = CACHE / 'commons-picked.json'                 # 跨次執行記住每個地點選了哪張

API = 'https://commons.wikimedia.org/w/api.php'
UA = 'yoxi-chengshi-prototype/1.0 (design study; one-off fetch)'

GAP = 2.0                                              # 每次呼叫之間至少隔幾秒
BACKOFF = [5, 15, 45]                                  # 429 / 503 的退避
TRIES = 4
THUMB_W = 800
MIN_W = 800
MAX_BYTES = 250 * 1024                                 # 超過就用 Pillow 重壓
JPEG_Q = 82

# ---- 地點表：key 必須對齊 js/mock.js 的 id ---------------------------------
# core=False 的是選配（預設不下載，用 --only 或 --all 才會做）。
# n=2 表示允許收兩張（都城隍廟與車站是原型裡出現最多次的兩個地方）。
PLACES = [
    ('station', {
        'name': '新竹車站', 'core': True, 'n': 1,
        'queries': ['Hsinchu Railway Station building', 'Hsinchu Station 1913',
                    '新竹車站 站房', 'Hsinchu Station facade'],
        'prefer': ['File:Hsinchu Station.jpg',
                   'File:20081006-台鐵新竹車站站房外觀.jpg'],
        # 要 1913 年站房的正面：不要月台／列車／北新竹，也不要隔著玻璃拍的高處俯瞰與站房內側
        'avoid': [r'North Hsinchu', r'北新竹', r'EMU\d', r'DR\d{3,}', r'platform', r'月台',
                  r'\bTRA\b', r'train', r'locomotive', r'railcar', r'underpass', r'地下道',
                  r'Overlook', r'內側', r'轉運站'],
    }),
    ('temple', {
        'name': '新竹都城隍廟', 'core': True, 'n': 1,
        'queries': ['Hsinchu City God Temple', 'Hsinchu Chenghuang Temple', '新竹都城隍廟'],
        'prefer': ['File:Hsinchu City God Temple 20210405.jpg',
                   'File:Hsinchu Chenghuang Temple-20250329.jpg'],
        'avoid': [r'interior', r'ceiling', r'statue', r'incense burner'],
    }),
    ('brick', {
        'name': '新竹州廳', 'core': True, 'n': 1,
        'queries': ['Hsinchu City Government building', 'Hsinchu Prefectural Hall', '新竹州廳'],
        'prefer': ['File:Hsinchu City Government.jpg',
                   'File:Hsinchu Municipal Government Hall 20130911 1.jpg'],
        'avoid': [r'plaque', r'logo', r'sign\b'],
    }),
    ('moat', {
        'name': '護城河親水公園', 'core': True, 'n': 1,
        'queries': ['Hsinchu Moat Park', 'Hsinchu City Moat', '新竹護城河親水公園'],
        # 親水公園那張有水階與人，比「橋上看護城河」更貼 mock 的地名
        'prefer': ['File:新竹護城河親水公園 Xinzhu Moat Park - panoramio.jpg',
                   'File:Hsinchu City Moat Park-20250329.jpg'],
        'avoid': [],
    }),
    ('hill', {
        'name': '十八尖山', 'core': True, 'n': 1,
        'queries': ['Eighteen Peaks Mountain Hsinchu', '十八尖山'],
        # 涼亭＋山徑比「從十八尖山看市景」更像「一個走得到的地方」
        'prefer': ['File:Eighteen Peaks Mountain Small Pavilion of Long Life.jpg',
                   'File:Hsinchu Cityscape viewed from Eighteen Peaks Mountain.jpg'],
        'avoid': [r'map', r'\bbird\b', r'insect', r'flower close'],
    }),
    ('harbour', {
        'name': '南寮漁港', 'core': True, 'n': 1,
        'queries': ['Nanliao Fishing Port Hsinchu', 'Hsinchu Fishing Port', '南寮漁港'],
        # panoramio 那張是白天、有港與船；2022 那張是黃昏的入口地標
        'prefer': ['File:Nanliao Fishing Harbor 南寮漁港 - panoramio.jpg',
                   'File:2022 Hsinchu Fishing Port a.jpg'],
        'avoid': [],
    }),
    ('neiwan', {
        'name': '內灣老街', 'core': True, 'n': 1,      # mock 裡鐵道路線的終點，算核心
        'queries': ['Neiwan Old Street', 'Neiwan Hengshan Hsinchu', '內灣老街'],
        'prefer': ['File:Old Street Neiwan.jpg'],
        'avoid': [r'\bmap\b'],
    }),
    ('market', {
        'name': '東門市場', 'core': False, 'n': 1,
        'queries': ['Dongmen Market Hsinchu', 'East Gate Market Hsinchu', '新竹東門市場'],
        'prefer': [],
        'avoid': [r'East Gate\b.*(tower|Yingxi)', r'迎曦'],
    }),
    ('lake', {
        'name': '青草湖', 'core': False, 'n': 1,
        'queries': ['Qingcao Lake Hsinchu', 'Green Grass Lake Hsinchu', '新竹青草湖'],
        'prefer': [],
        'avoid': [],
    }),
    ('rail', {
        'name': '竹中車站', 'core': False, 'n': 1,
        'queries': ['Zhuzhong Station Hsinchu', 'Zhuzhong railway station', '竹中車站'],
        'prefer': [],
        'avoid': [r'EMU\d', r'\bDR\d{3,}'],
    }),
]
PLACE_MAP = dict(PLACES)

# ---- 授權判定 ---------------------------------------------------------------
# 前綴要對；同時把 NC / ND / GFDL-only / fair use 明確擋掉（"CC BY-NC-SA 4.0" 也是 CC BY 開頭）。
LIC_OK = re.compile(r'^(CC BY-SA(\s|$)|CC BY(\s|$)|CC0|Public domain|PD([\s-]|$))', re.I)
LIC_BAD = re.compile(r'(-NC|-ND|\bNC\b|\bND\b|NonCommercial|NoDeriv|GFDL|Fair use|'
                     r'All rights reserved|Attribution-NonCommercial)', re.I)
MIME_OK = ('image/jpeg', 'image/png')

_last_call = [0.0]


def log(*a):
    print(*a, flush=True)


# Windows 主控台預設 cp950，會在 '✓' 與中文上炸掉；統一用 UTF-8 輸出。
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass


def slug(s):
    """檔名用：ASCII 的部分留著，其餘用雜湊補，CJK 查詢也能有穩定的快取檔名。"""
    a = re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:48]
    h = hashlib.sha1(s.encode('utf-8')).hexdigest()[:8]
    return (a + '-' + h) if a else h


def _throttle():
    dt = time.time() - _last_call[0]
    if dt < GAP:
        time.sleep(GAP - dt)
    _last_call[0] = time.time()


def http(url, refresh=False, binary=False, cache_slug=None):
    """打一次網路，帶 UA、節流與退避。cache_slug 有給就存／讀 tools/.cache/commons-<slug>.json。"""
    cache = (CACHE / ('commons-%s.json' % cache_slug)) if cache_slug else None
    if cache is not None and cache.exists() and not refresh:
        try:
            return json.loads(cache.read_text('utf-8')), True
        except Exception:
            pass
    last = None
    for attempt in range(TRIES):
        _throttle()
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': UA,
                'Accept': '*/*' if binary else 'application/json',
            })
            with urllib.request.urlopen(req, timeout=90) as r:
                raw = r.read()
            if binary:
                return raw, False
            data = json.loads(raw.decode('utf-8'))
            if cache is not None:
                CACHE.mkdir(parents=True, exist_ok=True)
                cache.write_bytes(raw)
            return data, False
        except urllib.error.HTTPError as e:
            last = e
            wait = BACKOFF[min(attempt, len(BACKOFF) - 1)]
            log('    ! HTTP %d %s → 等 %d 秒再試（第 %d/%d 次）' % (e.code, e.reason, wait, attempt + 1, TRIES))
            if attempt < TRIES - 1:
                time.sleep(wait)
        except Exception as e:                                   # timeout / DNS / JSON
            last = e
            wait = BACKOFF[min(attempt, len(BACKOFF) - 1)]
            log('    ! %s → 等 %d 秒再試（第 %d/%d 次）' % (e, wait, attempt + 1, TRIES))
            if attempt < TRIES - 1:
                time.sleep(wait)
    raise RuntimeError('放棄：%s（%s）' % (url, last))


# ---- API --------------------------------------------------------------------
def search(term, limit=8, refresh=False):
    """list=search，只在 File: 命名空間、只要點陣圖。回傳 File:… 標題清單。"""
    params = {
        'action': 'query', 'format': 'json', 'formatversion': '2',
        'list': 'search', 'srsearch': term + ' filetype:bitmap',
        'srnamespace': '6', 'srlimit': str(limit),
    }
    data, cached = http(API + '?' + urllib.parse.urlencode(params),
                        refresh=refresh, cache_slug='search-' + slug(term))
    hits = [h['title'] for h in data.get('query', {}).get('search', [])]
    log('  search %-46s -> %d 筆%s' % ('「' + term + '」', len(hits), '（快取）' if cached else ''))
    return hits


def resolve(titles, refresh=False):
    """一次問 20 個檔名的 imageinfo。回傳 {title: info}。"""
    out = {}
    titles = [t for t in titles if t]
    for i in range(0, len(titles), 20):
        chunk = titles[i:i + 20]
        params = {
            'action': 'query', 'format': 'json', 'formatversion': '2',
            'titles': '|'.join(chunk), 'prop': 'imageinfo',
            'iiprop': 'url|extmetadata|mime|size', 'iiurlwidth': str(THUMB_W),
        }
        data, cached = http(API + '?' + urllib.parse.urlencode(params),
                            refresh=refresh, cache_slug='info-' + slug('|'.join(sorted(chunk))))
        pages = data.get('query', {}).get('pages', [])
        log('  imageinfo %2d 個標題 -> %d 頁%s' % (len(chunk), len(pages), '（快取）' if cached else ''))
        for pg in pages:
            if pg.get('missing') or not pg.get('imageinfo'):
                continue
            out[pg['title']] = info_of(pg['title'], pg['imageinfo'][0])
    return out


def plain(s):
    """extmetadata 的 Artist 是 HTML（帶連結），拆成純文字人名。"""
    if not s:
        return ''
    s = re.sub(r'(?is)<(script|style).*?</\1>', ' ', s)
    s = re.sub(r'(?i)<br\s*/?>', ' ', s)
    s = re.sub(r'(?s)<[^>]+>', ' ', s)
    s = htmllib.unescape(s)
    s = re.sub(r'\s+', ' ', s).strip()
    s = re.sub(r'^(User:|user:)', '', s).strip()
    s = s.strip(' ,;·|')
    return s[:120]


def info_of(title, ii):
    ext = ii.get('extmetadata') or {}

    def em(k):
        v = ext.get(k) or {}
        return (v.get('value') or '') if isinstance(v, dict) else ''

    return {
        'title': title,
        'author': plain(em('Artist')) or '（Commons 未標作者）',
        'licence': plain(em('LicenseShortName')),
        'licenceCode': plain(em('License')),
        'licenceUrl': plain(em('LicenseUrl')),
        'desc': plain(em('ObjectName')) or plain(em('ImageDescription'))[:80],
        'mime': ii.get('mime') or '',
        'w': ii.get('width') or 0,
        'h': ii.get('height') or 0,
        'bytes': ii.get('size') or 0,
        'thumburl': ii.get('thumburl') or '',
        'tw': ii.get('thumbwidth') or 0,
        'th': ii.get('thumbheight') or 0,
        'source': 'https://commons.wikimedia.org/wiki/' + title.replace(' ', '_'),
    }


def ok(info):
    """授權／格式／尺寸的硬門檻。回傳 (True, '') 或 (False, 原因)。"""
    lic = info['licence'] or info['licenceCode']
    if not lic:
        return False, '沒有授權欄位'
    if LIC_BAD.search(lic) or LIC_BAD.search(info['licenceCode']):
        return False, '授權不合：' + lic
    if not LIC_OK.match(lic):
        return False, '授權不合：' + lic
    if info['mime'] not in MIME_OK:
        return False, 'mime 不合：' + (info['mime'] or '?')
    if info['w'] < MIN_W:
        return False, '原圖太窄：%d px' % info['w']
    if not info['thumburl']:
        return False, '沒有 800 px 縮圖'
    return True, ''


def score(info, rank, avoid):
    """越小越前面。prefer 清單的排序最重、其次橫幅、其次原圖夠大。"""
    t = info['title'] + ' ' + info['desc']
    for pat in avoid:
        if re.search(pat, t, re.I):
            return None                                   # 直接排除
    s = rank * 10
    if info['w'] > info['h']:
        s -= 100                                          # 橫幅優先
    if info['w'] < 1600:
        s += 5                                            # 原圖太小，縮圖品質會差
    return s


def candidates(pid, meta, refresh=False):
    """prefer 清單在前，接著各查詢字串的搜尋結果，去重後保序。"""
    seen, out = set(), []
    for t in meta['prefer']:
        if t not in seen:
            seen.add(t)
            out.append(t)
    for q in meta['queries']:
        for t in search(q, refresh=refresh):
            if t not in seen:
                seen.add(t)
                out.append(t)
    return out


# ---- 下載與輸出 -------------------------------------------------------------
def thumb_url(info):
    """iiurlwidth=800 回來的 thumbwidth 是 800，但 thumburl 會被吸到 960px 這種標準級距
    （2025 年起 Wikimedia 只服務清單上的寬度，自己改寫成 800px- 會被回 400）。
    所以照吸到的級距抓，回來再用 Pillow 縮到 800。這裡只把 utm 參數去掉。"""
    return info['thumburl'].split('?')[0]


def download(info, path):
    """抓縮圖（不是原圖），縮到 800 px 寬。寬度不對、非 JPEG、或超過 250 KB 就用 Pillow 重存。"""
    raw, _ = http(thumb_url(info), binary=True)
    from PIL import Image
    im = Image.open(io.BytesIO(raw))
    fmt, note = im.format, []
    if im.width != THUMB_W:
        note.append('%d px → %d px' % (im.width, THUMB_W))
        im = im.convert('RGB').resize(
            (THUMB_W, max(1, round(im.height * THUMB_W / float(im.width)))), Image.LANCZOS)
    if note or fmt != 'JPEG' or len(raw) > MAX_BYTES:
        if fmt != 'JPEG':
            note.append('原檔是 %s' % fmt)
        if len(raw) > MAX_BYTES:
            note.append('%d KB 太大' % (len(raw) // 1024))
        buf = io.BytesIO()
        im.convert('RGB').save(buf, 'JPEG', quality=JPEG_Q, optimize=True, progressive=True)
        raw = buf.getvalue()
        note.append('Pillow q%d 重存' % JPEG_Q)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    return im.width, im.height, len(raw), ('（' + '；'.join(note) + '）' if note else '')


def credit_line(info):
    lic = info['licence']
    lead = '' if re.match(r'^(CC0|Public domain|PD)', lic, re.I) else '© '
    return '%s%s / Wikimedia Commons, %s' % (lead, info['author'], lic)


def load_picked():
    if PICKED.exists():
        try:
            return json.loads(PICKED.read_text('utf-8'))
        except Exception:
            pass
    return {}


def write_credits(picked):
    """把（合併過的）選片結果寫成 credits.js。file:// 不能 fetch JSON，所以掛 window。"""
    CACHE.mkdir(parents=True, exist_ok=True)
    PICKED.write_text(json.dumps(picked, ensure_ascii=False, indent=2), encoding='utf-8')

    order = [pid for pid, _ in PLACES if pid in picked]
    lines = ['/* 由 tools/fetch-photos.py 產生。實景照片來自 Wikimedia Commons；'
             '每張的作者與授權如下，頁面上必須顯示。 */',
             'window.PHOTOS_DATA = {']
    for pid in order:
        rows = picked[pid]
        lines.append('  %s: [' % pid)
        for r in rows:
            f = []
            for k in ('file', 'name', 'title', 'author', 'licence', 'licenceUrl', 'source'):
                f.append('%s:%s' % (k, json.dumps(r.get(k, ''), ensure_ascii=False)))
            f.append('w:%d' % r['w'])
            f.append('h:%d' % r['h'])
            f.append('credit:%s' % json.dumps(r['credit'], ensure_ascii=False))
            lines.append('    { ' + ', '.join(f) + ' },')
        lines.append('  ],')
    lines.append('};')
    txt = '\n'.join(lines) + '\n'
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'credits.js').write_text(txt, encoding='utf-8')
    return OUT / 'credits.js', len(txt.encode('utf-8'))


# ---- 主流程 -----------------------------------------------------------------
def main(argv=None):
    ap = argparse.ArgumentParser(description='從 Wikimedia Commons 抓新竹地標實景照片')
    ap.add_argument('--list', action='store_true', help='列出每個地點的候選（授權／作者／尺寸），不下載')
    ap.add_argument('--only', default='', help='只做這幾個地點，逗號分隔（如 temple,station）')
    ap.add_argument('--all', action='store_true', help='連選配的地點一起做')
    ap.add_argument('--dry-run', action='store_true', help='選片到底，但不下載、不寫 credits.js')
    ap.add_argument('--refresh', action='store_true', help='忽略快取，重新打 API')
    args = ap.parse_args(argv)

    if args.only:
        want = [s.strip() for s in args.only.split(',') if s.strip()]
        bad = [w for w in want if w not in PLACE_MAP]
        if bad:
            log('不認得的地點 id：%s（可用：%s）' % (', '.join(bad), ', '.join(p for p, _ in PLACES)))
            return 2
    elif args.all or args.list:
        want = [p for p, _ in PLACES]
    else:
        want = [p for p, m in PLACES if m['core']]

    log('地點：%s' % ', '.join(want))
    log('')

    # 1) 收候選（每個地點各自搜尋）
    per_place, all_titles = {}, []
    for pid in want:
        meta = PLACE_MAP[pid]
        log('[%s] %s' % (pid, meta['name']))
        c = candidates(pid, meta, refresh=args.refresh)
        per_place[pid] = c
        for t in c:
            if t not in all_titles:
                all_titles.append(t)
        log('')

    # 2) 一次解析全部（每批 20 個）
    log('解析 imageinfo：%d 個檔名' % len(all_titles))
    infos = resolve(all_titles, refresh=args.refresh)
    log('')

    # 3) 篩選 → 排序 → 選片
    chosen = {}
    for pid in want:
        meta = PLACE_MAP[pid]
        log('[%s] %s%s' % (pid, meta['name'], '' if meta['core'] else '（選配）'))
        rows = []
        for rank, t in enumerate(per_place[pid]):
            info = infos.get(t)
            if not info:
                log('    ✗ %-60s 查不到這個檔案' % t[:60])
                continue
            good, why = ok(info)
            s = score(info, rank, meta['avoid']) if good else None
            mark = 'OK ' if (good and s is not None) else 'no '
            reason = why if not good else ('被 avoid 排除' if s is None else '')
            log('    %s%-58s %-16s %5dx%-5d %6d KB  %s  %s'
                % (mark, t[5:63], info['licence'][:16], info['w'], info['h'],
                   info['bytes'] // 1024, info['author'][:26], reason))
            if good and s is not None:
                rows.append((s, info))
        rows.sort(key=lambda r: r[0])
        take = rows[:meta['n']]
        if not take:
            log('    -> 沒有合格的候選')
        else:
            for i, (s, info) in enumerate(take):
                log('    -> 選 #%d %s' % (i + 1, info['title']))
            chosen[pid] = [info for _, info in take]
        log('')

    if args.list:
        log('（--list：只看候選，不下載）')
        return 0

    missing = [p for p in want if p not in chosen]
    if missing:
        log('沒找到合格照片的地點：%s' % ', '.join(missing))
        log('')

    if args.dry_run:
        log('（--dry-run：選片到此為止，不下載）')
        for pid, lst in chosen.items():
            for i, info in enumerate(lst):
                log('  %s-%d.jpg <- %s  %s' % (pid, i + 1, info['title'], credit_line(info)))
        return 0

    # 4) 下載＋寫 credits.js
    picked = load_picked()
    total = 0
    for pid in want:
        if pid not in chosen:
            continue
        rows = []
        for i, info in enumerate(chosen[pid]):
            fname = '%s-%d.jpg' % (pid, i + 1)
            w, h, n, note = download(info, OUT / fname)
            total += n
            log('  got %-16s %4d×%-4d %6.1f KB  %s %s' % (fname, w, h, n / 1024.0, info['title'][5:50], note))
            rows.append({
                'file': fname, 'name': PLACE_MAP[pid]['name'], 'title': info['title'],
                'author': info['author'], 'licence': info['licence'],
                'licenceUrl': info['licenceUrl'], 'source': info['source'],
                'w': w, 'h': h, 'credit': credit_line(info),
            })
        picked[pid] = rows

    path, size = write_credits(picked)
    log('')
    log('照片 %d 張，共 %.1f KB' % (sum(len(v) for v in picked.values()), total / 1024.0))
    log('寫入 %s（%d bytes）' % (path, size))
    return 0


if __name__ == '__main__':
    sys.exit(main())
