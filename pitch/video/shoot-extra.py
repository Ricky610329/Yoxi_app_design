# -*- coding: utf-8 -*-
"""
影片需要、但 app/assets/shots/ 沒有的幾個狀態，另外拍到 pitch/video/assets/（不動 app/）。

    python pitch/video/shoot-extra.py            全部
    python pitch/video/shoot-extra.py --only route-brk

作法完全沿用 app/tools/shoot-app.py（shot-frame.html 外框＋iframe 390×844＋?s= ?a= ?run=），
只是 SHOTS 換成影片要的幾張、輸出換地方。數字全部由 app 當場算，這裡一個都不手寫。
"""
import importlib.util, io, shutil, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
spec = importlib.util.spec_from_file_location('shootapp', ROOT / 'app' / 'tools' / 'shoot-app.py')
sa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sa)  # 它會把 sys.stdout 換成 UTF-8
from PIL import Image

OUT = HERE / 'assets'

# 內灣設為下車點（via 路線），名字與公里數從 APP 現算
RUN_DROP_NEIWAN = ("var p=APP.place('neiwan');APP.store.set('dropoff',{id:p.id,name:p.name,km:APP.fmt.km(p.dist),"
                   "setAt:new Date().toISOString(),via:'route'});APP.nav.go('/ride',{replace:true,dir:'none'});")
# 路線頁捲到「腳到不了的一段」
RUN_BRK = ("setTimeout(function(){var b=document.querySelector('[data-breakpoint]');"
           "if(b)b.scrollIntoView({block:'center'});},50);")
# 探索頁展開「為什麼推薦給你」
RUN_WHY = ("var b=document.querySelector('[data-act=\"toggle-why\"]');if(b){b.click();"
           "setTimeout(function(){b.scrollIntoView({block:'start'});},50);}")

SHOTS = [
    ('ride-dropoff-neiwan', '/ride',        {'run': RUN_DROP_NEIWAN}),
    ('route-brk',           '/route/rail',  {'run': RUN_BRK}),
    ('explore-why',         '/explore',     {'run': RUN_WHY}),
    ('points-after',        '/points',      {'s': sa.S_NEW_CARD}),
]


def main(argv):
    only = None
    if '--only' in argv:
        only = set(argv[argv.index('--only') + 1].split(','))
    chrome = sa.find_browser()
    if not chrome:
        print('找不到 Chrome 或 Edge。')
        return 1
    OUT.mkdir(parents=True, exist_ok=True)
    raw = Path(tempfile.mkdtemp(prefix='yoxi-vidshot-'))
    bad = []
    try:
        for stem, route, opt in SHOTS:
            if only and stem not in only:
                continue
            tmp = raw / (stem + '.png')
            if not sa.chrome_shot(chrome, sa.frame_uri(route, opt), tmp, sa.FRAME_W, sa.FRAME_H):
                bad.append(stem)
                continue
            with Image.open(tmp) as im:
                if im.size != (sa.FRAME_W, sa.FRAME_H):
                    im = im.resize((sa.FRAME_W, sa.FRAME_H), Image.LANCZOS)
                im.convert('RGB').crop((0, 0, sa.PHONE_W, sa.PHONE_H)).save(OUT / (stem + '.png'), optimize=True)
            print('ok', stem)
    finally:
        shutil.rmtree(raw, ignore_errors=True)
    if bad:
        print('沒拍到：' + '、'.join(bad))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
