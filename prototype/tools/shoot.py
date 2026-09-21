# -*- coding: utf-8 -*-
"""
產生所有畫面的縮圖，給全景圖與變體比較頁使用。

    python prototype/tools/shoot.py

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
""".split()


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


def main():
    chrome = find_browser()
    if not chrome:
        print('找不到 Chrome 或 Edge，無法產生縮圖。')
        return 1
    try:
        from PIL import Image
    except ImportError:
        print('需要 Pillow：pip install Pillow')
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)


    ok = 0
    for entry in SHOTS:
        if ':' in entry:
            url, name = entry.split(':', 1)
        else:
            url, name = entry + '.html', entry

        # 查詢字串要接在 file URI 之後，不能交給 as_uri() —— 它會把 ? 編成 %3F，
        # 變成在找一個檔名裡真的有問號的檔案，結果截到 FILE_NOT_FOUND 的錯誤頁。
        fname, _, query = url.partition('?')
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
            print('\n  失敗：', url)
            continue

        with Image.open(raw) as im:
            crop_device(im).save(OUT / (name + '.png'))
        raw.unlink()
        ok += 1
        sys.stdout.write('.')
        sys.stdout.flush()

    shutil.rmtree(TMP, ignore_errors=True)
    print('\n完成：%d 張縮圖 → prototype/assets/thumbs/  (%dx%d)'
          % (ok, OUT_W, OUT_H))
    return 0


if __name__ == '__main__':
    sys.exit(main())
