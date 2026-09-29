#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen-postcards.py —— 每張明信片五種畫風的成品：景點照片 → Stable Diffusion img2img ＋ ControlNet → app/assets/postcards/

    python app/tools/gen-postcards.py                      # 全部 22 張 × 5 款：生成＋匯出（已匯出、參數一樣的跳過）
    python app/tools/gen-postcards.py --cards p1,p15       # 只做這幾張
    python app/tools/gen-postcards.py --styles ink --redo  # 只重畫水墨（不跳過已有的）
    python app/tools/gen-postcards.py --export-only        # 不生成，只把工作資料夾的 PNG 轉成網頁用的 JPEG
    python app/tools/gen-postcards.py --cards p12 --try 7,11,23,42
                                                           # 挑種子：每一款生成幾個種子的候選＋一張對照表，不匯出
    匯出後把印出來的 POSTCARD_GEN 貼回 app/js/views/explore-face.js（只有表上的明信片會用成品）

挑種子（p12 之後的做法）：同一組參數，不同種子的構圖差不多、筆觸與光差很多，有時候整張糊掉。
    先 --try 幾個種子，看 app/tools/.cache/postcards/try/<明信片 id>.jpg（一列一款、一欄一個種子），
    把每一款最好的那個寫進 PICK，再照一般的方式跑（候選的參數一樣就直接沿用，不重畫）。

怎麼做的：
    底圖    prototype/assets/photos/ 的實景照片（Wikimedia Commons，授權在 credits.js；來源見 prototype/tools/fetch-photos.py）
            裁成 3:4 直式、縮到 512×680。照片上的招牌字先塗成招牌的底色（BLANK）：模型畫中文只會畫成亂碼。
    模型    Lykon/dreamshaper-8（Stable Diffusion 1.5 微調，CreativeML OpenRAIL-M）
            ＋ lllyasviel/control_v11p_sd15_canny（ControlNet 1.1，照片的 Canny 邊緣）。
            ControlNet 把建築的輪廓鎖住，strength 才能拉高把畫風徹底換掉，又不會長出照片裡沒有的東西
            （只用 img2img 時，「木刻版畫」會把新竹車站畫成日式寶塔）。
    輸出    app/assets/postcards/<明信片 id>-<款式>.jpg（480×640，JPEG q80）
            app/assets/postcards/index.json：每張的底圖、提示詞、種子、參數，可以重現。
    款式    watercolor／oil／woodcut／ink／gold，跟 app/js/views/explore-cards.js 的 CARD_STYLES 一致。

環境（不進 repo；模型第一次跑會下載到 ~/.cache/huggingface，約 3 GB）：
    python3.13 -m venv .venv-sd && .venv-sd/bin/pip install torch diffusers transformers accelerate safetensors pillow opencv-python-headless
    .venv-sd/bin/python app/tools/gen-postcards.py
    Apple Silicon 用 MPS（fp16 在 MPS 上容易解出全黑，整條用 fp32）；M4 Pro 一張約 30 秒，110 張約一小時。
    NVIDIA 用 CUDA（fp16；6 GB 的 RTX 2060 放得下，一張約 8 秒）。Windows 上 torch 要裝 CUDA 版，
    venv 放在短路徑（transformers 的檔名很長，路徑超過 260 字會裝得進去、import 卻找不到檔）：
        uv venv --python 3.12 C:/venvs/yoxi-sd
        uv pip install --python C:/venvs/yoxi-sd/Scripts/python.exe torch --index-url https://download.pytorch.org/whl/cu128
        uv pip install --python C:/venvs/yoxi-sd/Scripts/python.exe diffusers transformers accelerate safetensors pillow opencv-python-headless
    同一個種子在 MPS fp32 與 CUDA fp16 上畫出來不會一模一樣（雜訊一樣、運算精度不同）；index.json 記的是參數，不是位元。

授權：CC BY-SA 的底圖，改作也以 CC BY-SA 4.0 分享；頁面上一律標「AI 生成示意」並顯示底圖作者與授權（explore-unlock.js 的 creditHTML）。
"""
import argparse
import json
import shutil
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PHOTOS = ROOT / 'prototype' / 'assets' / 'photos'
OUT = ROOT / 'app' / 'assets' / 'postcards'
WORK = ROOT / 'app' / 'tools' / '.cache' / 'postcards'      # 原尺寸 PNG（gitignore）

MODEL = 'Lykon/dreamshaper-8'
CONTROLNET = 'lllyasviel/control_v11p_sd15_canny'

# 明信片 → 底圖照片（credits.js 的 key；明信片自己有一張的用自己的 id）
CARD_PHOTO = {
    'p1': 'station', 'p2': 'market', 'p3': 'moat', 'p4': 'harbour', 'p5': 'rail', 'p6': 'hill',
    'p7': 'temple', 'p8': 'lake', 'p9': 'neiwan', 'p10': 'p10', 'p11': 'glass-kiln', 'p12': 'p12',
    'p13': 'p13', 'p14': 'p14', 'p15': 'p15', 'p16': 'p16', 'p17': 'p17', 'p18': 'p18',
    'p19': 'p19', 'p20': 'brick', 'p21': 'p21', 'p22': 'p22',
}
# 給模型的主題描述（英文）。構圖以照片為準，描述只是幫它認得畫的是什麼
SUBJECT = {
    'p1': 'a historic baroque railway station building with a clock tower',
    'p2': 'a traditional Taiwanese market building and street',
    'p3': 'a city moat park with water, stone banks and trees',
    'p4': 'a fishing harbor with boats and a waterfront',
    'p5': 'a small railway station building',
    'p6': 'a pavilion on a forested hill park',
    'p7': 'a traditional Taiwanese temple with an ornate roof',
    'p8': 'a calm lake surrounded by green hills',
    'p9': 'a lively old street with shops, signs and red lanterns',
    'p10': 'a small wooden rural railway station with red trim',
    'p11': 'an old glass workshop building',
    'p12': 'a small rural railway station building',
    'p13': 'a rural railway platform with a long canopy',
    'p14': 'a red brick museum building',
    'p15': 'close-up of gloved hands shaping a glowing molten glass flower with long steel tongs at a workbench',
    'p16': 'a seaside embankment with waves and tidal flats',
    'p17': 'an old brick kiln corridor with brick arches',
    'p18': 'a river estuary with sand flats at low tide',
    'p19': 'a moat canal lined with trees',
    'p20': 'a red brick colonial government building',
    'p21': 'a red brick arch at the entrance of a forest trail',
    'p22': 'a lake with an arched bridge and green hills',
}
NEG = ('photo, photograph, photorealistic, 3d render, text, letters, watermark, signature, logo, frame, border, '
       'pagoda, extra buildings, lowres, blurry, jpeg artifacts, deformed, disfigured, extra limbs, ugly')
# 個別加的負面提示詞。p15 的框只有手：提示詞寫「工匠」的時候，模型會在模糊的背景裡自己補一個人
# （大鬍子的外國人、年輕女生），正好是裁掉老師傅的臉想避開的事
NEG_EXTRA = {'p15': 'face, head, hair, portrait, person, man, woman, beard, eyes'}
# strength：img2img 改動幅度；cn：ControlNet 鎖構圖的力道；cfg：跟提示詞的貼合程度
STYLE = {
    'watercolor': dict(strength=.82, cfg=7.0, cn=.7,
        p='watercolor painting of {s}, wet-on-wet, loose transparent washes, pigment pooling at the edges, '
          'white paper showing through, soft pastel palette, travel sketchbook illustration, masterpiece'),
    'oil': dict(strength=.8, cfg=7.0, cn=.75,
        p='oil painting of {s}, thick impasto brushstrokes, palette knife texture, impressionism, '
          'vivid warm colors, visible canvas texture, masterpiece'),
    'woodcut': dict(strength=.9, cfg=7.5, cn=.9,
        p='woodcut relief print of {s}, linocut, bold carved black lines, flat blocks of color, '
          'limited palette of indigo, vermilion red and cream, rough paper texture, masterpiece'),
    'ink': dict(strength=.9, cfg=7.5, cn=.75,
        p='ink wash painting of {s}, sumi-e, black ink on rice paper, expressive calligraphic brush strokes, '
          'misty atmosphere, generous empty space, monochrome grayscale, masterpiece'),
    'gold': dict(strength=.72, cfg=7.0, cn=.8,
        p='golden hour illustration of {s}, warm glowing sunlight, gilded highlights, luminous sky, '
          'detailed painterly digital art, cinematic lighting, magical atmosphere, masterpiece'),
}
W, H = 512, 680                 # 生成尺寸（3:4 直式，8 的倍數）
OW, OH = 480, 640               # 網頁用
JPEG_Q = 80
SEED = 7
STEPS = 32
# 裁成直式時框的水平位置（0 左、.5 中、1 右）
CROP_X = {
    'p12': .815,    # 九讚頭：站房的雨棚、屋頂的站名牌與後面的山都進來（置中的話只框到旁邊的藍色舊樓）
    'p21': .143,    # 防空洞步道：紅磚圓拱置中
}
# 自己指定的框（原照片的比例座標 x0, y0, x1, y1；寬會照 3:4 以中心修正）。比 CROP_X 優先。
# p15 是老師傅：只框右手的手套、夾鉗與那朵玻璃花，像一張靜物特寫。臉不能進畫面（模型會把臉改成別人）；
# 框得鬆一點（連左手一起）的時候，被切一半的左手會畫成玻璃塊或金屬盔甲，模糊的背景還會被補上一個人
CROP_BOX = {'p15': (.409, .432, .6925, 1.0)}
# 照片上要先補掉的字：站名牌、石碑只留底色，畫出來是素面的牌子而不是亂碼。
# 座標是原照片的像素：(x0, y0, x1, y1) 是框、[(x, y), …] 是多邊形（斜的招牌）；框要落在招牌的底色裡面
BLANK = {
    'p12': [(334, 227, 362, 252), (397, 220, 427, 247), (467, 214, 498, 241),
            (542, 209, 573, 237), (618, 204, 650, 233),                        # 屋頂上「九讚頭車站」五塊牌子
            (623, 334, 690, 368), (714, 334, 737, 368), (542, 345, 568, 362),  # 紅布條（中間隔著柱子）、小紅牌
            (518, 358, 531, 388), (696, 358, 709, 390)],                       # 柱子上的小站牌
    'p13': [[(450, 207), (604, 168), (605, 222), (450, 243)],                   # 雨棚下「橫山車站 Hengshan Station」
            (478, 247, 550, 258)],                                             # 出口的小黃牌
    'p21': [(140, 267, 334, 342)],                                             # 石碑「新竹市十八尖山防空洞步道」
}
# 挑過的種子：'<明信片 id>-<款式>': 種子（--try 看過候選之後寫進來；沒寫的用 SEED）。
# p12–p22 每一款看過五個種子（7, 11, 23, 42, 101；不夠好的再加 3, 5, 13, 17, 29）挑的。
# 淘汰的理由多半是：空白的站名牌又被畫上假字、欄杆被畫成英文字母、雕塑或背景被畫出人臉、畫面糊成一片
PICK = {
    'p12-watercolor': 42, 'p12-oil': 7, 'p12-woodcut': 42, 'p12-ink': 11, 'p12-gold': 23,
    'p13-watercolor': 42, 'p13-oil': 13, 'p13-woodcut': 23, 'p13-ink': 42, 'p13-gold': 7,
    'p14-watercolor': 23, 'p14-oil': 11, 'p14-woodcut': 7, 'p14-ink': 42, 'p14-gold': 23,
    'p15-watercolor': 42, 'p15-oil': 42, 'p15-woodcut': 7, 'p15-ink': 7, 'p15-gold': 23,
    'p16-watercolor': 7, 'p16-oil': 23, 'p16-woodcut': 42, 'p16-ink': 42, 'p16-gold': 42,
    'p17-watercolor': 42, 'p17-oil': 7, 'p17-woodcut': 7, 'p17-ink': 7, 'p17-gold': 7,
    'p18-watercolor': 101, 'p18-oil': 101, 'p18-woodcut': 101, 'p18-ink': 11, 'p18-gold': 42,
    'p19-watercolor': 23, 'p19-oil': 101, 'p19-woodcut': 23, 'p19-ink': 42, 'p19-gold': 7,
    'p20-watercolor': 42, 'p20-oil': 42, 'p20-woodcut': 3, 'p20-ink': 7, 'p20-gold': 7,
    'p21-watercolor': 11, 'p21-oil': 7, 'p21-woodcut': 42, 'p21-ink': 7, 'p21-gold': 7,
    'p22-watercolor': 101, 'p22-oil': 7, 'p22-woodcut': 101, 'p22-ink': 7, 'p22-gold': 42,
}
# 個別調整參數：'<明信片 id>-<款式>': dict(strength=…, cn=…, cfg=…, gray=True)（照片太平、畫風蓋不住時才用）
#   gray：img2img 的起點先轉灰階（邊緣照舊用彩色照片算）。整面紅磚、整片綠樹的照片，木刻會被底圖的顏色拉成一色，
#         看不出靛藍、朱紅、米白的套色；轉灰階之後顏色才由提示詞決定（p17 試過，磚窯的紅是提示詞帶出來的，沒有用上）
TUNE = {
    'p18-gold': dict(strength=.85),     # 河口的照片又暗又平：.72 畫出來是陰天的黃昏，拉高才有夕陽落進水道的光
}


def blank_text(im, shapes):
    """把照片上的字補掉：框裡的像素分成兩群（底色、字），整框塗成多的那一群（底色）的顏色，
    再撒一點跟底色一樣大小的起伏（石碑、舊鐵皮不會是平的），邊緣羽化一兩個像素"""
    import cv2
    import numpy as np
    from PIL import Image
    a = np.asarray(im).astype(np.float32)
    rng = np.random.default_rng(0)
    for sh in shapes:
        pts = [(sh[0], sh[1]), (sh[2], sh[1]), (sh[2], sh[3]), (sh[0], sh[3])] if len(sh) == 4 and             not isinstance(sh[0], (tuple, list)) else sh
        mask = np.zeros(a.shape[:2], np.uint8)
        cv2.fillPoly(mask, [np.array(pts, np.int32)], 255)
        px = a[mask > 0]
        _, lab, cen = cv2.kmeans(px, 2, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, .5),
                                 3, cv2.KMEANS_PP_CENTERS)
        big = np.bincount(lab.ravel()).argmax()
        bg = px[lab.ravel() == big]
        sd = float(min(6.0, bg.std(axis=0).mean()))
        noise = cv2.GaussianBlur(rng.normal(0, sd, a.shape[:2]).astype(np.float32), (0, 0), .8)
        fill = cen[big][None, None, :] + noise[..., None]
        alpha = cv2.GaussianBlur(mask.astype(np.float32) / 255, (0, 0), 1.0)[..., None]
        a = a * (1 - alpha) + fill * alpha
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def base_image(card):
    from PIL import Image
    im = Image.open(PHOTOS / (CARD_PHOTO[card] + '-1.jpg')).convert('RGB')
    if card in BLANK:
        im = blank_text(im, BLANK[card])
    w, h = im.size
    tw = round(h * 3 / 4)
    if card in CROP_BOX:
        x0, y0, x1, y1 = CROP_BOX[card]
        y0, y1 = round(y0 * h), round(y1 * h)
        cw = round((y1 - y0) * 3 / 4)
        x = max(0, min(w - cw, round((x0 + x1) / 2 * w - cw / 2)))
        im = im.crop((x, y0, x + cw, y1))
    elif tw <= w:
        x = round((w - tw) * CROP_X.get(card, .5))
        im = im.crop((x, 0, x + tw, h))
    else:
        th = round(w * 4 / 3)
        y = (h - th) // 2
        im = im.crop((0, y, w, y + th))
    return im.resize((W, H), Image.LANCZOS)


def canny(im):
    import cv2
    import numpy as np
    from PIL import Image
    g = cv2.cvtColor(np.array(im), cv2.COLOR_RGB2GRAY)
    g = cv2.GaussianBlur(g, (5, 5), 0)
    e = cv2.Canny(g, 70, 170)
    return Image.fromarray(np.stack([e] * 3, axis=-1))


def load_pipe():
    import torch
    from diffusers import StableDiffusionControlNetImg2ImgPipeline, ControlNetModel, DPMSolverMultistepScheduler
    cn = ControlNetModel.from_pretrained(CONTROLNET, torch_dtype=torch.float16, variant='fp16')
    pipe = StableDiffusionControlNetImg2ImgPipeline.from_pretrained(
        MODEL, controlnet=cn, torch_dtype=torch.float16, variant='fp16',
        safety_checker=None, requires_safety_checker=False)
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(
        pipe.scheduler.config, algorithm_type='dpmsolver++', solver_order=2,
        use_karras_sigmas=True, final_sigmas_type='sigma_min')
    dev = 'mps' if torch.backends.mps.is_available() else ('cuda' if torch.cuda.is_available() else 'cpu')
    # CUDA 用 fp16（6 GB 的卡放不下整條 fp32）；MPS／CPU 用 fp32（MPS 的 fp16 會解出全黑）
    pipe = pipe.to(dev, torch.float16 if dev == 'cuda' else torch.float32)
    pipe.set_progress_bar_config(disable=True)
    return pipe


def meta(card, st, seed=None):
    key = '%s-%s' % (card, st)
    c = dict(STYLE[st], **TUNE.get(key, {}))
    m = {'card': card, 'style': st, 'photo': CARD_PHOTO[card] + '-1.jpg', 'model': MODEL, 'controlnet': CONTROLNET,
         'seed': PICK.get(key, SEED) if seed is None else seed, 'steps': STEPS,
         'strength': c['strength'], 'cn_scale': c['cn'], 'cfg': c['cfg'],
         'prompt': c['p'].format(s=SUBJECT[card]),
         'negative': NEG + (', ' + NEG_EXTRA[card] if card in NEG_EXTRA else '')}
    # 只有動過的才記（p1–p11 的紀錄維持原樣）
    if card in CROP_BOX:
        m['crop_box'] = list(CROP_BOX[card])
    elif card in CROP_X:
        m['crop_x'] = CROP_X[card]
    if card in BLANK:
        m['blank'] = [list(sh) for sh in BLANK[card]]
    if c.get('gray'):
        m['init'] = 'gray'
    return m


def start_image(init, m):
    """img2img 的起點：照片本身，或 TUNE 指定的灰階版本"""
    return init.convert('L').convert('RGB') if m.get('init') == 'gray' else init


def render(pipe, init, edge, m):
    import torch
    import numpy as np
    with torch.inference_mode():
        img = pipe(prompt=m['prompt'], negative_prompt=m['negative'], image=start_image(init, m), control_image=edge,
                   controlnet_conditioning_scale=m['cn_scale'], strength=m['strength'],
                   guidance_scale=m['cfg'], num_inference_steps=m['steps'],
                   generator=torch.Generator('cpu').manual_seed(m['seed'])).images[0]
    if np.asarray(img).max() < 8:
        raise SystemExit('%s-%s 解出全黑（半精度溢位？）：改用 fp32 再跑' % (m['card'], m['style']))
    return img


def same(png, m):
    """PNG 旁邊記著生成它的參數：參數一樣才算已經有了（改了提示詞或種子就重畫）"""
    j = png.with_suffix('.json')
    return png.exists() and j.exists() and json.loads(j.read_text('utf-8')) == json.loads(json.dumps(m))


def exported(card, st, m):
    """已經匯出、index.json 記的參數也一樣：不用再生成、也不用再匯出。
    p1–p11 是在另一台機器上生成的，這台的工作資料夾沒有它們的 PNG；沒有這一關，全部重跑會把它們重畫一遍蓋掉"""
    idx_path = OUT / 'index.json'
    if not (OUT / ('%s-%s.jpg' % (card, st))).exists() or not idx_path.exists():
        return False
    return json.loads(idx_path.read_text('utf-8')).get('%s-%s' % (card, st)) == json.loads(json.dumps(m))


def keep(img_or_path, png, m):
    if isinstance(img_or_path, Path):
        shutil.copyfile(img_or_path, png)
    else:
        img_or_path.save(png)
    png.with_suffix('.json').write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding='utf-8')


def generate(cards, styles, redo):
    WORK.mkdir(parents=True, exist_ok=True)
    pipe = None
    for card in cards:
        init = edge = None
        for st in styles:
            png = WORK / ('%s-%s.png' % (card, st))
            m = meta(card, st)
            # 已經匯出而且參數一樣、或是沒有旁邊 .json 的舊 PNG（p1–p11 在 Mac 上生成的）：算有了，免得整批重畫
            if not redo and (exported(card, st, m) or
                             png.exists() and (same(png, m) or not png.with_suffix('.json').exists())):
                continue
            tried = WORK / 'try' / ('%s-%s-s%d.png' % (card, st, m['seed']))
            if not redo and same(tried, m):
                keep(tried, png, m)
                print('  %-4s %-10s 沿用候選 s%d' % (card, st, m['seed']), flush=True)
                continue
            if pipe is None:
                pipe = load_pipe()
            if init is None:
                init = base_image(card)
                edge = canny(init)
            t0 = time.time()
            keep(render(pipe, init, edge, m), png, m)
            print('  %-4s %-10s %5.1fs' % (card, st, time.time() - t0), flush=True)


def try_seeds(cards, styles, seeds, redo):
    """每一款生成幾個種子的候選，拼成一張對照表（第一欄是底圖與邊緣，之後一欄一個種子、一列一款）；不匯出"""
    from PIL import Image, ImageDraw
    out = WORK / 'try'
    out.mkdir(parents=True, exist_ok=True)
    pipe = None
    for card in cards:
        init = base_image(card)
        edge = canny(init)
        for st in styles:
            for sd in seeds:
                png = out / ('%s-%s-s%d.png' % (card, st, sd))
                m = meta(card, st, seed=sd)
                if not redo and same(png, m):
                    continue
                if pipe is None:
                    pipe = load_pipe()
                t0 = time.time()
                keep(render(pipe, init, edge, m), png, m)
                print('  %-4s %-10s s%-5d %5.1fs' % (card, st, sd, time.time() - t0), flush=True)
        tw, th = W // 2, H // 2
        sheet = Image.new('RGB', ((len(seeds) + 1) * tw, 20 + max(2, len(styles)) * th), 'white')
        d = ImageDraw.Draw(sheet)
        sheet.paste(init.resize((tw, th)), (0, 20))
        sheet.paste(edge.resize((tw, th)), (0, 20 + th))
        for r, st in enumerate(styles):
            for c, sd in enumerate(seeds):
                sheet.paste(Image.open(out / ('%s-%s-s%d.png' % (card, st, sd))).resize((tw, th)),
                            ((c + 1) * tw, 20 + r * th))
            d.text((tw + 4, 20 + r * th + 4), st, fill=(255, 0, 255))
        for c, sd in enumerate(seeds):
            d.text(((c + 1) * tw + 4, 4), 's%d' % sd, fill=(0, 0, 0))
        sheet.save(out / ('%s.jpg' % card), quality=85)
        print('  對照表 → %s' % (out / ('%s.jpg' % card)), flush=True)


def export(cards, styles):
    from PIL import Image
    OUT.mkdir(parents=True, exist_ok=True)
    idx_path = OUT / 'index.json'
    idx = json.loads(idx_path.read_text('utf-8')) if idx_path.exists() else {}
    n = total = 0
    for card in cards:
        for st in styles:
            png = WORK / ('%s-%s.png' % (card, st))
            if not png.exists():
                if not exported(card, st, meta(card, st)):
                    print('  缺 %s（還沒生成）' % png.name)
                continue
            im = Image.open(png).convert('RGB')
            # 512×680 → 480×640：先等比縮到寬 480（高 637.5），再從 512×683 的比例置中裁掉誤差
            im = im.resize((OW, round(im.height * OW / im.width)), Image.LANCZOS)
            if im.height != OH:
                im = im.resize((OW, OH), Image.LANCZOS)
            dst = OUT / ('%s-%s.jpg' % (card, st))
            im.save(dst, 'JPEG', quality=JPEG_Q, optimize=True, progressive=True)
            idx['%s-%s' % (card, st)] = meta(card, st)
            n += 1
            total += dst.stat().st_size
    idx_path.write_text(json.dumps(dict(sorted(idx.items(), key=lambda kv: (int(kv[0].split('-')[0][1:]), kv[0]))),
                                   ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print('匯出 %d 張，共 %.1f MB → %s' % (n, total / 1048576.0, OUT))
    done = [c for c in CARD_PHOTO if all((OUT / ('%s-%s.jpg' % (c, st))).exists() for st in STYLE)]
    print('五款齊全的明信片（貼到 app/js/views/explore-face.js 的 POSTCARD_GEN）：')
    print('const POSTCARD_GEN = [%s];' % ', '.join("'%s'" % c for c in done))


def main():
    ap = argparse.ArgumentParser(description='生成每張明信片五種畫風的成品')
    ap.add_argument('--cards', default=','.join(CARD_PHOTO))
    ap.add_argument('--styles', default=','.join(STYLE))
    ap.add_argument('--redo', action='store_true', help='已經生成過的也重畫')
    ap.add_argument('--export-only', action='store_true', help='不生成，只匯出')
    ap.add_argument('--try', dest='seeds', default='', help='挑種子：逗號分隔的種子，只生成候選與對照表')
    a = ap.parse_args()
    cards = [c for c in a.cards.split(',') if c]
    styles = [s for s in a.styles.split(',') if s]
    bad = [c for c in cards if c not in CARD_PHOTO] + [s for s in styles if s not in STYLE]
    if bad:
        raise SystemExit('不認得：%s' % ', '.join(bad))
    if a.seeds:
        try_seeds(cards, styles, [int(x) for x in a.seeds.split(',') if x], a.redo)
        return
    if not a.export_only:
        generate(cards, styles, a.redo)
    export(cards, styles)


if __name__ == '__main__':
    main()
