# -*- coding: utf-8 -*-
"""
產生所有畫面的縮圖，給全景圖與變體比較頁使用。

    python prototype/tools/shoot.py                 拍全部，然後產生 mini
    python prototype/tools/shoot.py --mini          只把現有縮圖縮成 mini，不開瀏覽器
    python prototype/tools/shoot.py --only a,b      只拍這幾張（做單張變體時不重拍五十幾張）
    python prototype/tools/shoot.py --only a --mini  兩段都跑
    python prototype/tools/shoot.py --board         只拍 boards/ 的五張大概念板（1600x1000）
    python prototype/tools/shoot.py --board --only board-friends   只拍其中一張

為什麼要 mini：層級樹一頁上百格，430x912 的原圖乘以上百張，在比賽現場的
筆電上會先卡住再顯示。mini 是同一張圖縮到 86x182，純 Pillow、不重開瀏覽器，
原圖一個 byte 都不動（只讀不寫）。

為什麼不用 iframe：全景圖有 38 張畫面、變體頁有 15 格，用 iframe 會變成
五十幾個 iframe、將近五百個子資源請求。載入慢，而且常常有幾格還沒畫完
就被看到空白，在比賽現場的筆電上更不可靠。

為什麼要寬視窗再裁：headless Chrome 在 Windows 有最小視窗寬度，
直接用 --window-size=430 會用比較寬的寬度排版、再把截圖裁成 430，
結果手機偏右而且右邊被切掉。所以改成用 1000px 寬渲染，再裁出手機那一塊。

為什麼用「找外框」而不是算座標：Windows 的顯示縮放會讓同一份指令有時候
用 1 倍、有時候用 1.25 倍出圖（--force-device-scale-factor 不一定吃得到），
算好的固定座標就會把畫面放大又切掉一角 —— 同一份程式碼連拍兩次得到
兩種結果。改成在圖上找手機的深色外框、裁它的外接矩形、再統一縮到
430x912，不管瀏覽器用幾倍出圖，結果都一樣。

為什麼板要另一條路：概念板是 1600x1000 的桌面版面，裡面還畫了好幾支手機外框。
crop_device 是「在圖上找手機的深色外框」，拿去跑板只會裁到板裡面那支手機。
所以 --board 完全不裁，整張存下來，尺寸不對才 resize。

改了畫面就重跑一次。需要 Chrome 或 Edge，以及 Pillow。
"""
import os, subprocess, sys, io, shutil, tempfile
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = Path(__file__).resolve().parent.parent
OUT  = ROOT / 'assets' / 'thumbs'
TMP  = OUT / '_raw'

# 視窗要大到「就算瀏覽器用 1.25 倍出圖，整支手機也還在畫面裡」。
# 不然放大後手機底部會被切掉，找外框只找到半支，再縮成 430x912 就變形。
WIN_W, WIN_H = 1400, 1300
OUT_W, OUT_H = 430, 912           # 縮圖統一尺寸，跟變體頁與全景圖對得上
MINI = OUT / 'mini'
MINI_W, MINI_H = 86, 182          # 430x912 的五分之一，層級樹一頁上百格用這個

CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    shutil.which('google-chrome') or '',
    shutil.which('chromium') or '',
]

SHOTS = """
home drawer pickup outofarea ride ride-done notify ridesettings points
trips export payment coupon tasks support shop invite
explore map place going routes route fogmap
album postcard badge week elder
settings push
variant-a-map variant-b-explore variant-c-album variant-a-album variant-b-album
variant-a-explore variant-c-explore variant-c-map
variant-d-home variant-e-home variant-f-home variant-d-explore variant-e-explore
variant-d-album variant-e-album variant-f-album
variant-d-home.html?layer=on:variant-d-home-on
variant-e-home.html?peek=1:variant-e-home-peek
variant-f-home.html?mode=today:variant-f-home-today
place.html?id=neiwan:place-far
unlock.html?still=1:unlock
unlock.html?ride=1&still=1:unlock-ride
push.html?when=night:push-night
variant-a-map.html?mode=been:variant-a-map-been
lookback.html?still=1:lookback

variant-s1-album variant-s2-album variant-s3-album variant-s4-album variant-s5-album
variant-s4-album.html?sheet=open:variant-s4-album-open
variant-s5-album.html?pill=family:variant-s5-album-family
variant-x1-explore variant-x2-explore variant-x2-album variant-x3-explore variant-x5-explore
variant-x4-badges
variant-x4-badges.html?style=ring:variant-x4-badges-ring
variant-x4-badges.html?style=stamp:variant-x4-badges-stamp
variant-t1-tasks
variant-t1-tasks.html?mode=merged:variant-t1-tasks-merged
variant-l1-explore variant-l2-explore variant-l3-album variant-l4-map
variant-l5-explore variant-l5-album variant-l6-explore

vision-family-a vision-family-b vision-family-c
vision-event-a vision-event-b vision-event-c
vision-plan-a vision-plan-b vision-plan-c
vision-health-a vision-health-b vision-health-c
""".split()

# 概念稿（第三輪）：地圖 16 張、好友 10 張。
# 名字比檔名短一截（concept-map-explore.html → concept-explore-paper），
# 每一條都要跟 js/catalog.js 的 THUMB_ALIAS 逐字對得上，不然目錄頁會找不到圖。
SHOTS += """
concept-map-explore.html?style=paper:concept-explore-paper
concept-map-explore.html?style=navy:concept-explore-navy
concept-map-explore.html?style=illus:concept-explore-illus
concept-map-explore.html?style=iso:concept-explore-iso
concept-map-explore.html?style=paper&tilt=1:concept-explore-tilt
concept-map-explore.html?style=fog:concept-explore-fog
concept-map-home.html?style=paper:concept-home-paper
concept-map-home.html?style=navy:concept-home-navy
concept-map-home.html?style=illus&peek=1:concept-home-peek
concept-map-footprint.html?style=fog:concept-footprint-fog
concept-map-footprint.html?style=paper:concept-footprint-paper
concept-map-place.html?id=station:concept-place
concept-map-iso.html:concept-iso
concept-map-iso.html?tilt=1&hour=dusk:concept-iso-dusk
concept-map-styles.html:concept-styles
concept-map-ride.html?style=navy:concept-ride

concept-friend-list concept-friend-inbox concept-friend-neighbors concept-friend-push
concept-friend-profile.html?id=sis:concept-friend-profile
concept-friend-profile.html?id=nb1:concept-friend-profile-ai
concept-friend-send.html?to=sis&step=pick:concept-friend-send-pick
concept-friend-send.html?to=sis&step=write&card=p3:concept-friend-send-write
concept-friend-inbox.html?pill=out:concept-friend-inbox-out
concept-friend-neighbors.html?state=first:concept-friend-neighbors-first
""".split()

# --- 大張概念板（1600x1000）。只有帶 --board 才會碰到這一段。 ---------------
BOARDS = "board-map-styles board-map-single board-map-dual board-map-3d board-friends".split()
BOARD_SRC  = ROOT / 'boards'
BOARD_OUT  = ROOT / 'assets' / 'boards'
BOARD_MINI = BOARD_OUT / 'mini'
BOARD_W, BOARD_H = 1600, 1000
BMINI_W, BMINI_H = 320, 200


def find_browser():
    for c in CANDIDATES:
        if c and Path(c).exists():
            return c
    return None


def crop_device(im):
    """在整張截圖裡找出手機外框，裁出來並統一縮到 430x912。

    外框是 .device 的兩圈陰影：#1B1B1F 與 #34343A。找這兩個顏色的外接矩形
    就等於找到手機本體，不必依賴任何座標，也就不怕瀏覽器換了出圖倍率。
    """
    from PIL import Image
    rgb = im.convert('RGB')
    w, h = rgb.size
    px = rgb.load()

    def bezel(c):
        r, g, b = c
        return (abs(r - 27) < 10 and abs(g - 27) < 10 and abs(b - 31) < 10) or                (abs(r - 52) < 10 and abs(g - 52) < 10 and abs(b - 58) < 10)

    x0, y0, x1, y1 = w, h, 0, 0
    for y in range(0, h, 2):                  # 每兩列掃一次就夠，外框很厚
        for x in range(0, w, 2):
            if bezel(px[x, y]):
                if x < x0: x0 = x
                if x > x1: x1 = x
                if y < y0: y0 = y
                if y > y1: y1 = y
    if x1 <= x0 or y1 <= y0:                  # 找不到外框就退回整張
        return rgb.resize((OUT_W, OUT_H), Image.LANCZOS)

    pad = max(2, (x1 - x0) // 60)             # 留一點邊，陰影才不會被切掉
    box = (max(0, x0 - pad), max(0, y0 - pad),
           min(w, x1 + pad + 1), min(h, y1 + pad + 1))
    return rgb.crop(box).resize((OUT_W, OUT_H), Image.LANCZOS)


def stem_of(entry):
    """SHOTS 的一格 → 輸出檔名（url:name 取 name，其餘取檔名去掉 .html）。"""
    return entry.split(':', 1)[1] if ':' in entry else entry


def make_mini():
    """把 assets/thumbs/*.png 縮成 86x182 放進 assets/thumbs/mini/。

    只讀原圖、只寫 mini/，原圖一個 byte 都不動。不開瀏覽器，所以改完
    單一張縮圖之後跑這一段是秒級的。mini/ 底下的檔不會被自己再縮一次
    （glob('*.png') 不會進子資料夾）。
    """
    from PIL import Image
    if not OUT.exists():
        print('沒有 assets/thumbs/，先跑一次截圖。')
        return 0
    MINI.mkdir(parents=True, exist_ok=True)
    n = 0
    for src in sorted(OUT.glob('*.png')):
        with Image.open(src) as im:
            im.convert('RGB').resize((MINI_W, MINI_H), Image.LANCZOS).save(MINI / src.name)
        n += 1
    print('mini：%d 張 → prototype/assets/thumbs/mini/  (%dx%d)'
          % (n, MINI_W, MINI_H))
    return n


def shoot_boards(only=None):
    """拍 boards/*.html：1600x1000 整張存，不裁、不找手機外框。

    板裡面用 iframe 擺了好幾支手機，內容多，所以時間預算比手機那條路長
    （9 秒 vs 4.5 秒）。尺寸照樣鎖 1 倍出圖；真的不對才 resize 回 1600x1000，
    不然板上的文字會被重採樣糊掉。
    """
    from PIL import Image

    names = BOARDS
    if only is not None:
        want = [x for x in only.replace(',', ' ').split() if x]
        unknown = [w for w in want if w not in BOARDS]
        if unknown:
            print('--only 裡有不在 BOARDS 的名字：' + '、'.join(unknown))
            return 1
        names = want
        if not names:
            print('--only 沒有指定任何一張板。')
            return 1

    chrome = find_browser()
    if not chrome:
        print('找不到 Chrome 或 Edge，無法產生概念板。')
        return 1

    BOARD_OUT.mkdir(parents=True, exist_ok=True)
    BOARD_MINI.mkdir(parents=True, exist_ok=True)

    ok = 0
    missing = []
    resized = []
    for name in names:
        src = BOARD_SRC / (name + '.html')
        if not src.exists():
            missing.append(name)
            continue

        # ?still=1 跟手機那條路同一個理由：定格，連拍兩次才是同一張。
        uri = src.as_uri() + '?still=1'
        png = BOARD_OUT / (name + '.png')

        prof = tempfile.mkdtemp(prefix='yoxi-board-')
        subprocess.run(
            [chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars',
             '--allow-file-access-from-files',
             '--user-data-dir=' + prof,
             '--force-device-scale-factor=1',
             '--window-size=%d,%d' % (BOARD_W, BOARD_H),
             '--virtual-time-budget=9000',
             '--screenshot=' + str(png),
             uri],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        shutil.rmtree(prof, ignore_errors=True)

        if not png.exists():
            missing.append(name)
            continue

        with Image.open(png) as im:
            board = im.convert('RGB')
            if board.size != (BOARD_W, BOARD_H):
                resized.append('%s %dx%d' % (name, board.size[0], board.size[1]))
                board = board.resize((BOARD_W, BOARD_H), Image.LANCZOS)
                board.save(png)
            board.resize((BMINI_W, BMINI_H), Image.LANCZOS).save(BOARD_MINI / (name + '.png'))
        ok += 1
        sys.stdout.write('.')
        sys.stdout.flush()

    print()
    print('概念板：%d 張 → prototype/assets/boards/  (%dx%d)，mini/ (%dx%d)'
          % (ok, BOARD_W, BOARD_H, BMINI_W, BMINI_H))
    if resized:
        print('尺寸不對、已縮回：' + '、'.join(resized))
    if missing:
        print('尚未建檔：%d 張 — %s' % (len(missing), '、'.join(missing)))
    return 0


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)

    only = None
    want_mini = False
    want_board = False
    rest = []
    while argv:
        a = argv.pop(0)
        if a == '--mini':
            want_mini = True
        elif a == '--board':
            want_board = True
        elif a == '--only':
            only = argv.pop(0) if argv else ''
        elif a.startswith('--only='):
            only = a.split('=', 1)[1]
        else:
            rest.append(a)
    if rest:
        print('不認得的參數：' + ' '.join(rest))
        return 1

    try:
        from PIL import Image
    except ImportError:
        print('需要 Pillow：pip install Pillow')
        return 1

    # --board 是另一條路：只拍板，不拍手機（板的尺寸、裁切、時間預算都不一樣）。
    # 不帶 --board 的時候這一段完全不會執行，板一個 byte 都不會被動到。
    if want_board:
        return shoot_boards(only)

    # --mini 自己一個人來的時候只跑縮小那一段（不開瀏覽器）；
    # 只要有 --only，就是「拍這幾張，然後照常重建 mini」。
    if want_mini and only is None:
        make_mini()
        return 0

    shots = SHOTS
    if only is not None:
        want = [x for x in only.replace(',', ' ').split() if x]
        index = {stem_of(e): e for e in SHOTS}
        unknown = [w for w in want if w not in index]
        if unknown:
            print('--only 裡有不在 SHOTS 的名字：' + '、'.join(unknown))
            return 1
        shots = [index[w] for w in want]
        if not shots:
            print('--only 沒有指定任何一張。')
            return 1

    chrome = find_browser()
    if not chrome:
        print('找不到 Chrome 或 Edge，無法產生縮圖。')
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)

    ok = 0
    missing = []
    for entry in shots:
        if ':' in entry:
            url, name = entry.split(':', 1)
        else:
            url, name = entry + '.html', entry

        # 查詢字串要接在 file URI 之後，不能交給 as_uri() —— 它會把 ? 編成 %3F，
        # 變成在找一個檔名裡真的有問號的檔案，結果截到 FILE_NOT_FOUND 的錯誤頁。
        fname, _, query = url.partition('?')

        # 還沒建檔的畫面（ROOTS／catalog 先登記、畫面之後才畫）不必真的去開
        # 瀏覽器等它逾時：先看檔案在不在，不在就記下來，最後彙整印一行。
        if not (ROOT / 'screens' / fname).exists():
            missing.append(name)
            continue

        # 每一張都加 still=1：小卡滑入、數字跑動這些轉場會讓同一頁連拍三張
        # 拿到三種結果。定格之後縮圖才是可比對的（見 base.css 的 data-still）。
        if 'still' not in query:
            query = (query + '&' if query else '') + 'still=1'
        uri = (ROOT / 'screens' / fname).as_uri() + '?' + query

        raw = TMP / (name + '.png')
        # 每一張都用一個全新的瀏覽器設定檔。原型把進度寫在 localStorage，
        # 而 localStorage 跟著設定檔走 —— 共用的話，前面幾張走過流程留下的
        # 狀態會改變後面那幾張的畫面（收合態 sheet 多一列，地圖就矮一截），
        # 同一份程式碼連拍兩次會拿到不同結果。縮圖要的是每個畫面的預設狀態，
        # 需要變化的都用查詢字串明講（?mode=been、?ride=1 之類）。
        prof = tempfile.mkdtemp(prefix='yoxi-shot-')
        subprocess.run(
            [chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars',
             '--allow-file-access-from-files',
             '--user-data-dir=' + prof,
             # 鎖死 1 倍：Windows 的顯示縮放有時會讓 Chrome 用 1.25／1.5 倍
             # 出圖，原圖變大，固定座標的裁切就等於把畫面放大又切掉一角。
             # 同一份程式碼連拍兩次得到不同結果，多半就是這裡。
             '--force-device-scale-factor=1',
             '--window-size=%d,%d' % (WIN_W, WIN_H),
             '--virtual-time-budget=4500',
             '--screenshot=' + str(raw),
             uri],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        shutil.rmtree(prof, ignore_errors=True)

        if not raw.exists():
            missing.append(name)
            continue

        with Image.open(raw) as im:
            crop_device(im).save(OUT / (name + '.png'))
        raw.unlink()
        ok += 1
        sys.stdout.write('.')
        sys.stdout.flush()

    shutil.rmtree(TMP, ignore_errors=True)
    print()
    print('完成：%d 張縮圖 → prototype/assets/thumbs/  (%dx%d)'
          % (ok, OUT_W, OUT_H))
    # 失敗的不散在中間洗掉進度點，最後彙整成一行 —— 這一行就是
    # 「ROOTS／catalog 登記了、畫面還沒畫」的待辦清單。
    if missing:
        print('尚未建檔：%d 張 — %s' % (len(missing), '、'.join(missing)))

    make_mini()
    return 0


if __name__ == '__main__':
    sys.exit(main())
