# -*- coding: utf-8 -*-
"""
產生所有畫面的縮圖，給全景圖與變體比較頁使用。

    python prototype/tools/shoot.py

為什麼不用 iframe：全景圖有 38 張畫面、變體頁有 15 格，用 iframe 會變成
五十幾個 iframe、將近五百個子資源請求。載入慢，而且常常有幾格還沒畫完
就被看到空白，在比賽現場的筆電上更不可靠。

為什麼要寬視窗再裁：headless Chrome 在 Windows 有最小視窗寬度，
直接用 --window-size=430 會用比較寬的寬度排版、再把截圖裁成 430，
結果手機偏右而且右邊被切掉。所以改成用 1000px 寬渲染，
再依 .stage 置中的規則把手機那一塊裁出來。

改了畫面就重跑一次。需要 Chrome 或 Edge，以及 Pillow。
"""
import os, subprocess, sys, io, shutil
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = Path(__file__).resolve().parent.parent
OUT  = ROOT / 'assets' / 'thumbs'
TMP  = OUT / '_raw'

WIN_W, WIN_H = 1000, 912          # 遠大於任何最小視窗寬度
DEV_W, DEV_H = 390, 844           # 手機本體
PAD          = 20                 # 左右各留一點，讓外框陰影不被切

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

    left = (WIN_W - DEV_W) // 2 - PAD          # .stage 置中，手機的左緣
    box  = (left, 0, left + DEV_W + PAD * 2, WIN_H)

    ok = 0
    for entry in SHOTS:
        if ':' in entry:
            url, name = entry.split(':', 1)
        else:
            url, name = entry + '.html', entry

        # 查詢字串要接在 file URI 之後，不能交給 as_uri() —— 它會把 ? 編成 %3F，
        # 變成在找一個檔名裡真的有問號的檔案，結果截到 FILE_NOT_FOUND 的錯誤頁。
        fname, _, query = url.partition('?')
        uri = (ROOT / 'screens' / fname).as_uri() + (('?' + query) if query else '')

        raw = TMP / (name + '.png')
        subprocess.run(
            [chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars',
             '--allow-file-access-from-files',
             '--window-size=%d,%d' % (WIN_W, WIN_H),
             '--virtual-time-budget=4500',
             '--screenshot=' + str(raw),
             uri],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        if not raw.exists():
            print('\n  失敗：', url)
            continue

        with Image.open(raw) as im:
            im.crop(box).save(OUT / (name + '.png'))
        raw.unlink()
        ok += 1
        sys.stdout.write('.')
        sys.stdout.flush()

    shutil.rmtree(TMP, ignore_errors=True)
    print('\n完成：%d 張縮圖 → prototype/assets/thumbs/  (%dx%d)'
          % (ok, box[2] - box[0], box[3] - box[1]))
    return 0


if __name__ == '__main__':
    sys.exit(main())
