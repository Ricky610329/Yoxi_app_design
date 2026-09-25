#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen-postcards.py —— 每張明信片五種畫風的成品：景點照片 → Stable Diffusion img2img ＋ ControlNet → app/assets/postcards/

    python app/tools/gen-postcards.py                      # 全部 22 張 × 5 款：生成（已有的跳過）＋匯出
    python app/tools/gen-postcards.py --cards p1,p15       # 只做這幾張
    python app/tools/gen-postcards.py --styles ink --redo  # 只重畫水墨（不跳過已有的）
    python app/tools/gen-postcards.py --export-only        # 不生成，只把工作資料夾的 PNG 轉成網頁用的 JPEG
    匯出後把印出來的 POSTCARD_GEN 貼回 app/js/views/explore.js（只有表上的明信片會用成品）

怎麼做的：
    底圖    prototype/assets/photos/ 的實景照片（Wikimedia Commons，授權在 credits.js；來源見 prototype/tools/fetch-photos.py）
            裁成 3:4 直式、縮到 512×680。
    模型    Lykon/dreamshaper-8（Stable Diffusion 1.5 微調，CreativeML OpenRAIL-M）
            ＋ lllyasviel/control_v11p_sd15_canny（ControlNet 1.1，照片的 Canny 邊緣）。
            ControlNet 把建築的輪廓鎖住，strength 才能拉高把畫風徹底換掉，又不會長出照片裡沒有的東西
            （只用 img2img 時，「木刻版畫」會把新竹車站畫成日式寶塔）。
    輸出    app/assets/postcards/<明信片 id>-<款式>.jpg（480×640，JPEG q80）
            app/assets/postcards/index.json：每張的底圖、提示詞、種子、參數，可以重現。
    款式    watercolor／oil／woodcut／ink／gold，跟 app/js/views/explore.js 的 DRAW_STYLES 一致。

環境（不進 repo；模型第一次跑會下載到 ~/.cache/huggingface，約 3 GB）：
    python3.13 -m venv .venv-sd && .venv-sd/bin/pip install torch diffusers transformers accelerate safetensors pillow opencv-python-headless
    .venv-sd/bin/python app/tools/gen-postcards.py
    Apple Silicon 用 MPS（fp16 在 MPS 上容易解出全黑，整條用 fp32）；M4 Pro 一張約 30 秒，110 張約一小時。

授權：CC BY-SA 的底圖，改作也以 CC BY-SA 4.0 分享；頁面上一律標「AI 生成示意」並顯示底圖作者與授權（explore.js 的 creditHTML）。
"""
import argparse
import json
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
    'p15': 'a craftsman shaping glowing molten glass with tools',
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
# 裁成直式時框的水平位置（0 左、.5 中、1 右）。p15 是老師傅：只框手與玻璃，不讓臉進畫面（模型會把臉改成別人）
CROP_X = {'p15': 1.0}


def base_image(card):
    from PIL import Image
    im = Image.open(PHOTOS / (CARD_PHOTO[card] + '-1.jpg')).convert('RGB')
    w, h = im.size
    tw = round(h * 3 / 4)
    if tw <= w:
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
    pipe = pipe.to(dev, torch.float32)
    pipe.set_progress_bar_config(disable=True)
    return pipe


def meta(card, st):
    c = STYLE[st]
    return {'card': card, 'style': st, 'photo': CARD_PHOTO[card] + '-1.jpg', 'model': MODEL, 'controlnet': CONTROLNET,
            'seed': SEED, 'steps': STEPS, 'strength': c['strength'], 'cn_scale': c['cn'], 'cfg': c['cfg'],
            'prompt': c['p'].format(s=SUBJECT[card]), 'negative': NEG}


def generate(cards, styles, redo):
    import torch
    WORK.mkdir(parents=True, exist_ok=True)
    pipe = None
    for card in cards:
        init = edge = None
        for st in styles:
            png = WORK / ('%s-%s.png' % (card, st))
            if png.exists() and not redo:
                continue
            if pipe is None:
                pipe = load_pipe()
            if init is None:
                init = base_image(card)
                edge = canny(init)
            m = meta(card, st)
            t0 = time.time()
            with torch.inference_mode():
                img = pipe(prompt=m['prompt'], negative_prompt=NEG, image=init, control_image=edge,
                           controlnet_conditioning_scale=m['cn_scale'], strength=m['strength'],
                           guidance_scale=m['cfg'], num_inference_steps=STEPS,
                           generator=torch.Generator('cpu').manual_seed(SEED)).images[0]
            img.save(png)
            print('  %-4s %-10s %5.1fs' % (card, st, time.time() - t0), flush=True)


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
    print('五款齊全的明信片（貼到 app/js/views/explore.js 的 POSTCARD_GEN）：')
    print('const POSTCARD_GEN = [%s];' % ', '.join("'%s'" % c for c in done))


def main():
    ap = argparse.ArgumentParser(description='生成每張明信片五種畫風的成品')
    ap.add_argument('--cards', default=','.join(CARD_PHOTO))
    ap.add_argument('--styles', default=','.join(STYLE))
    ap.add_argument('--redo', action='store_true', help='已經生成過的也重畫')
    ap.add_argument('--export-only', action='store_true', help='不生成，只匯出')
    a = ap.parse_args()
    cards = [c for c in a.cards.split(',') if c]
    styles = [s for s in a.styles.split(',') if s]
    bad = [c for c in cards if c not in CARD_PHOTO] + [s for s in styles if s not in STYLE]
    if bad:
        raise SystemExit('不認得：%s' % ', '.join(bad))
    if not a.export_only:
        generate(cards, styles, a.redo)
    export(cards, styles)


if __name__ == '__main__':
    main()
