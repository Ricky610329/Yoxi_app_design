# -*- coding: utf-8 -*-
"""
把 web app 的每條 route 用手機寬度（390×844）拍下來，給人用眼睛逐張看。

    python app/tools/shoot-app.py                  拍全部＋桌機外框一張＋board
    python app/tools/shoot-app.py --only ride,album   只拍這幾張（stem；desktop-ride 也可以）
    python app/tools/shoot-app.py --board          只用現有 PNG 重拼 contact sheet（不開瀏覽器）
    python app/tools/shoot-app.py --list           列出所有 stem

輸出：app/assets/shots/<stem>.png（390×844）、desktop-ride.png（1200×900）、board.png。

為什麼要外框頁：headless Chrome 在 Windows 的視窗最窄約 500 px，
--window-size=390,844 其實用 500 寬排版，拍到的不是手機寬度。
所以開 app/tests/fixtures/shot-frame.html（600×900），左上一個 390×844 的 iframe 載
index.html?still=1#<route>；iframe 內 viewport 就是 390，會走 @media (max-width:559px)。
拍完用 Pillow 裁出左上 390×844。

前置狀態：shot-frame 的 ?s=（STATE）與 ?a=（APP.store，一律併入 onboarded:true）
會在載 iframe 之前寫進 localStorage；?run= 是 iframe 第一次 data-view-ready 之後 eval 的一小段 JS。
每張用一個新的 --user-data-dir，互不影響。

決定性：?still=1 關動畫、--force-device-scale-factor=1、每張乾淨的 profile。
畫面上的日期／時鐘跟著今天走（APP.fmt.todayMMDD），隔天重拍那幾個字會變，其餘相同。
"""
import io, json, shutil, subprocess, sys, tempfile
from pathlib import Path
from urllib.parse import quote

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print('需要 Pillow：pip install Pillow')
    sys.exit(1)

APP = Path(__file__).resolve().parent.parent
FRAME = APP / 'tests' / 'fixtures' / 'shot-frame.html'
INDEX = APP / 'index.html'
OUT = APP / 'assets' / 'shots'

PHONE_W, PHONE_H = 390, 844
FRAME_W, FRAME_H = 600, 900
DESK_W, DESK_H = 1200, 900
BUDGET = 8000

CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    shutil.which('google-chrome') or '',
    shutil.which('chromium') or '',
    shutil.which('chrome') or '',
]

# ---------------------------------------------------------------- 前置狀態
# STATE 的初始八張卡（state.js fresh()），收了新卡的狀態要整包給（Object.assign 會蓋掉 cards）
BASE_CARDS = {
    'p1': {'date': '09.02', 'by': 'walk'}, 'p2': {'date': '09.05', 'by': 'walk'},
    'p3': {'date': '09.08', 'by': 'walk'}, 'p4': {'date': '09.12', 'by': 'ride'},
    'p5': {'date': '09.14', 'by': 'walk'}, 'p6': {'date': '09.17', 'by': 'walk'},
    'p7': {'date': '09.19', 'by': 'walk'}, 'p8': {'date': '09.20', 'by': 'ride'},
}
S_NEW_CARD = {  # 搭車收了內灣（p9），收藏頁會標「新」
    'cards': dict(BASE_CARDS, p9={'date': '09.23', 'by': 'ride', 'note': '老街的粄條很好吃'}),
    'km': 76, 'lastCard': 'p9', 'lastSeen': None,
}
T0 = '2026-09-23T09:05:00.000Z'
A_RIDING = {'trip': {'placeId': 'neiwan', 'phase': 'riding', 'startedAt': T0, 'rated': False, 'km': 28}}
A_MATCHING = {'trip': {'placeId': 'neiwan', 'phase': 'matching', 'startedAt': T0, 'rated': False, 'km': 28}}
A_DONE = {'trip': {'placeId': 'neiwan', 'phase': 'done', 'startedAt': T0, 'rated': False, 'km': 28}}
A_RATED = {'trip': {'placeId': 'neiwan', 'phase': 'done', 'startedAt': T0, 'rated': True, 'stars': 5, 'km': 28}}
# 評分完直接回首頁、限定明信片還沒收：/ride 收合態有金色入口、/postcard/p9 有「解鎖限定版」
A_PENDING = {'trip': {'placeId': 'neiwan', 'phase': 'done', 'startedAt': T0, 'rated': True, 'km': 28}, 'dropoff': None}

# 下車點已填：名字與公里數從 APP 現算（不手寫），然後就地重畫 /ride（不經 setDropoff，免得拍到 toast）
RUN_DROPOFF = ("var p=APP.place('glass-kiln');APP.store.set('dropoff',{id:p.id,name:p.name,km:APP.fmt.km(p.dist),"
               "setAt:new Date().toISOString(),via:'e'});APP.nav.go('/ride',{replace:true,dir:'none'});")
RUN_SELECT = "var s=document.querySelector('#view .spot[data-spot=\"moat\"]');if(s)s.click();"
RUN_STACK = "var b=document.querySelector('[data-act=\"expand-cards\"]');if(b)b.click();"
RUN_CARDS = RUN_SELECT + RUN_STACK
RUN_FLOAT = RUN_CARDS + "var c=document.querySelector('[data-act=\"open-card\"]');if(c)c.click();"
RUN_FLOAT_BACK = RUN_FLOAT + "var f=document.querySelector('[data-act=\"flip-card\"]');if(f)f.click();"
RUN_STORY = "var b=document.querySelector('[data-act=\"toggle-story\"]');if(b)b.click();"

# (stem, route, {'s':STATE, 'a':store, 'run':js} 或 None)
SHOTS = [
    ('welcome',          '/welcome',              {'a': {'onboarded': False}}),
    ('ride',             '/ride',                 None),
    ('ride-dropoff',     '/ride',                 {'run': RUN_DROPOFF}),
    ('ride-peek',        '/ride?mode=explore',    None),
    ('ride-cards',       '/ride?mode=explore',    {'run': RUN_CARDS}),
    ('ride-float',       '/ride?mode=explore',    {'run': RUN_FLOAT}),
    ('ride-float-back',  '/ride?mode=explore',    {'run': RUN_FLOAT_BACK}),
    ('ride-pending-unlock', '/ride',              {'a': A_PENDING}),
    ('dropoff',          '/dropoff',              None),
    ('pickup',           '/pickup',               None),
    ('trip',             '/trip',                 {'a': A_MATCHING}),
    ('trip-riding',      '/trip',                 {'a': A_RIDING, 'run': RUN_STORY}),
    ('trip-done',        '/trip/done',            {'a': A_DONE}),
    ('trip-done-rated',  '/trip/done',            {'a': A_RATED}),
    ('drawer',           '/drawer',               None),
    ('points',           '/points',               None),
    ('notify',           '/notify',               None),
    ('trips',            '/trips',                None),
    ('explore',          '/explore',              None),
    ('explore-map',      '/explore/map',          None),
    ('place',            '/place/glass-kiln',     None),
    ('place-far',        '/place/neiwan',         None),
    ('going',            '/going/glass-kiln',     None),
    ('unlock',           '/unlock/glass-kiln',    None),
    ('unlock-ride',      '/unlock/neiwan?ride=1', {'a': A_RATED}),
    ('routes',           '/routes',               None),
    ('route',            '/route/rail',           None),
    ('album',            '/album',                None),
    ('album-new',        '/album',                {'s': S_NEW_CARD}),
    ('album-badges',     '/album?tab=badges',     None),
    ('album-journal',    '/album?tab=journal',    None),
    ('album-week',       '/album?tab=week',       None),
    ('postcard',         '/postcard/p1',          None),
    ('postcard-pending', '/postcard/p9',          {'a': A_PENDING}),
    ('badge',            '/badge/b1',             None),
    ('footprint',        '/footprint',            None),
    ('lookback',         '/lookback',             None),
    ('week',             '/week',                 None),
    ('elder',            '/elder',                None),
    ('settings',         '/settings',             None),
    ('push-am',          '/ride',                 {'run': "APP.ui.push({when:'am'});"}),
    ('push-pm',          '/ride',                 {'run': "APP.ui.push({when:'pm'});"}),
    ('share',            '/week',                 {'run': "APP.ui.share({kind:'week'});"}),
    ('not-found',        '/no-such-page',         None),
]
DESKTOP = ('desktop-ride', '/ride')


def find_browser():
    for c in CANDIDATES:
        if c and Path(c).exists():
            return c
    return None


def chrome_shot(chrome, uri, png, w, h):
    prof = tempfile.mkdtemp(prefix='yoxi-appshot-')
    try:
        subprocess.run(
            [chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars',
             '--allow-file-access-from-files',
             '--user-data-dir=' + prof,
             '--force-device-scale-factor=1',
             '--window-size=%d,%d' % (w, h),
             '--virtual-time-budget=%d' % BUDGET,
             '--screenshot=' + str(png),
             uri],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
    finally:
        shutil.rmtree(prof, ignore_errors=True)
    return png.exists()


def frame_uri(route, opt):
    opt = opt or {}
    q = 'r=' + quote(route, safe='')
    if opt.get('s') is not None:
        q += '&s=' + quote(json.dumps(opt['s'], ensure_ascii=False), safe='')
    if opt.get('a') is not None:
        q += '&a=' + quote(json.dumps(opt['a'], ensure_ascii=False), safe='')
    if opt.get('run'):
        q += '&run=' + quote(opt['run'], safe='')
    return FRAME.as_uri() + '?' + q


def save_png(im, path):
    # 調色盤化：UI 截圖色數少，256 色幾乎看不出差別，大小約降到三分之一
    im.convert('RGB').quantize(colors=256, method=Image.MEDIANCUT, dither=Image.NONE).save(path, optimize=True)


def shoot(chrome, only):
    OUT.mkdir(parents=True, exist_ok=True)
    raw = Path(tempfile.mkdtemp(prefix='yoxi-appraw-'))
    ok, bad = 0, []
    try:
        for stem, route, opt in SHOTS:
            if only and stem not in only:
                continue
            tmp = raw / (stem + '.png')
            if not chrome_shot(chrome, frame_uri(route, opt), tmp, FRAME_W, FRAME_H):
                bad.append(stem)
                continue
            with Image.open(tmp) as im:
                if im.size != (FRAME_W, FRAME_H):
                    # 顯示縮放讓 Chrome 用別的倍率出圖：先縮回 1 倍再裁
                    im = im.resize((FRAME_W, FRAME_H), Image.LANCZOS)
                save_png(im.crop((0, 0, PHONE_W, PHONE_H)), OUT / (stem + '.png'))
            ok += 1
            sys.stdout.write('.')
            sys.stdout.flush()

        stem, route = DESKTOP
        if not only or stem in only:
            tmp = raw / (stem + '.png')
            uri = INDEX.as_uri() + '?still=1#' + route
            # 桌機外框：直接開 index.html（第一次開會先 onboarding，所以 run 不了 localStorage——
            # 改用 hash 直達 /ride：app 只在 '/' 導去 /welcome）
            if chrome_shot(chrome, uri, tmp, DESK_W, DESK_H):
                with Image.open(tmp) as im:
                    if im.size != (DESK_W, DESK_H):
                        im = im.resize((DESK_W, DESK_H), Image.LANCZOS)
                    save_png(im, OUT / (stem + '.png'))
                ok += 1
            else:
                bad.append(stem)
    finally:
        shutil.rmtree(raw, ignore_errors=True)
    print()
    print('拍了 %d 張 → %s' % (ok, OUT))
    if bad:
        print('沒拍到：' + '、'.join(bad))
    return 0 if not bad else 1


def board():
    stems = [s for s, _, _ in SHOTS if (OUT / (s + '.png')).exists()]
    if not stems:
        print('沒有截圖可以拼。')
        return 1
    cols = 8
    tw, th = PHONE_W // 2, PHONE_H // 2          # 195×422
    pad, lab = 12, 22
    rows = (len(stems) + cols - 1) // cols
    W = pad + cols * (tw + pad)
    H = pad + rows * (th + lab + pad)
    sheet = Image.new('RGB', (W, H), (234, 241, 245))
    draw = ImageDraw.Draw(sheet)
    font = None
    for f in ('arial.ttf', 'DejaVuSans.ttf'):
        try:
            font = ImageFont.truetype(f, 14)
            break
        except OSError:
            continue
    if font is None:
        font = ImageFont.load_default()
    for i, stem in enumerate(stems):
        r, c = divmod(i, cols)
        x = pad + c * (tw + pad)
        y = pad + r * (th + lab + pad)
        with Image.open(OUT / (stem + '.png')) as im:
            sheet.paste(im.convert('RGB').resize((tw, th), Image.LANCZOS), (x, y))
        draw.rectangle((x - 1, y - 1, x + tw, y + th), outline=(195, 203, 220))
        draw.text((x, y + th + 4), stem, fill=(6, 32, 64), font=font)
    save_png(sheet, OUT / 'board.png')
    print('board：%d 格 → %s' % (len(stems), OUT / 'board.png'))
    return 0


def main(argv):
    only = None
    want_board_only = '--board' in argv
    if '--list' in argv:
        for s, r, _ in SHOTS:
            print('%-18s %s' % (s, r))
        print('%-18s %s（桌機 1200×900）' % DESKTOP)
        return 0
    if '--only' in argv:
        i = argv.index('--only')
        only = set(x.strip() for x in (argv[i + 1] if i + 1 < len(argv) else '').split(',') if x.strip())
        known = set(s for s, _, _ in SHOTS) | {DESKTOP[0]}
        unknown = sorted(only - known)
        if unknown:
            print('--only 裡有不認得的 stem：' + '、'.join(unknown))
            return 1
    if want_board_only:
        return board()
    chrome = find_browser()
    if not chrome:
        print('找不到 Chrome 或 Edge。')
        return 1
    rc = shoot(chrome, only)
    board()
    return rc


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
