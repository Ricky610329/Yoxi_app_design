"""產生 yoxi 城事 app 的 PWA 圖示（Pillow，不連網、不用字型）。

用法：python app/tools/make-icons.py
輸出（app/assets/icons/）：
  icon-192.png / icon-512.png   紅底圓角方塊（圓角 22%，對應 --r-tile），外圍透明
  icon-maskable-512.png         紅色滿版，圖案縮到 80%（安全區內縮 20%）
  apple-touch-icon.png (180)    紅色滿版不透明（iOS 自己裁圓角，不吃透明）
  favicon.svg                   同一圖案的手寫 SVG

圖案：略斜（-8°）的白色明信片，右上一枚奶油底、海軍藍細邊的郵票；
左半是一張小圖（奶油底、紅太陽、海軍藍山），右下兩條海軍藍的地址線。
所有幾何都寫在 100×100 的設計座標裡，PNG 與 SVG 共用同一份數字。
決定性輸出：固定超取樣倍率、固定縮放演算法，不寫入時間戳。
"""
from pathlib import Path
from PIL import Image, ImageDraw

RED = '#FF2E1A'
NAVY = '#062040'
CREAM = '#FBEBDF'
WHITE = '#FFFFFF'

OUT = Path(__file__).resolve().parent.parent / 'assets' / 'icons'
SS = 4            # 超取樣倍率
ANGLE = -8        # 明信片傾斜（SVG 慣例：負值＝逆時針）
TILE_R = 22       # 圓角比例（%）

# ---- 設計座標（100×100）----
CARD = (18, 30, 82, 72, 4)          # x0 y0 x1 y1 rx
PIC = (24, 36, 45, 66, 2)           # 左半小圖
SUN = (38.5, 43, 3.2)               # cx cy r
HILL = [(24, 66), (24, 58), (31, 50), (36, 55), (40, 51), (45, 57), (45, 66)]
STAMP = (63, 35, 76, 49, 1)         # 郵票
STAMP_W = 1.4                       # 郵票海軍藍細邊
LINES = [((51, 58), (74, 58)), ((51, 64), (68, 64))]
LINE_W = 2.4


def draw_motif(size, scale):
    """回傳透明底、已旋轉的圖案圖層（size×size，已超取樣）。scale：圖案相對整張的縮放。"""
    S = size * SS
    k = S / 100 * scale
    off = S * (1 - scale) / 2
    P = lambda x, y: (off + x * k, off + y * k)
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    def rrect(box, fill, outline=None, width=0):
        x0, y0, x1, y1, r = box
        d.rounded_rectangle([P(x0, y0), P(x1, y1)], radius=r * k, fill=fill,
                            outline=outline, width=round(width * k) if width else 0)

    rrect(CARD, WHITE)
    rrect(PIC, CREAM)
    cx, cy, r = SUN
    d.ellipse([P(cx - r, cy - r), P(cx + r, cy + r)], fill=RED)
    d.polygon([P(x, y) for x, y in HILL], fill=NAVY)
    rrect(STAMP, CREAM, outline=NAVY, width=STAMP_W)
    w = round(LINE_W * k)
    for a, b in LINES:
        d.line([P(*a), P(*b)], fill=NAVY, width=w)
        for x, y in (a, b):  # 圓頭
            px, py = P(x, y)
            d.ellipse([px - w / 2, py - w / 2, px + w / 2, py + w / 2], fill=NAVY)
    # PIL rotate 正值＝逆時針；SVG rotate 正值＝順時針
    return layer.rotate(-ANGLE, resample=Image.BICUBIC, center=(S / 2, S / 2))


def make_png(size, *, rounded, scale):
    S = size * SS
    bg = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(bg)
    if rounded:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * TILE_R / 100, fill=RED)
    else:
        d.rectangle([0, 0, S, S], fill=RED)
    bg.alpha_composite(draw_motif(size, scale))
    img = bg.resize((size, size), Image.LANCZOS)
    if not rounded:
        img = img.convert('RGB')  # 滿版：不留 alpha
    return img


def make_svg():
    def rr(box, fill, extra=''):
        x0, y0, x1, y1, r = box
        return (f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" '
                f'rx="{r}" fill="{fill}"{extra}/>')
    cx, cy, r = SUN
    hill = ' '.join(f'{x},{y}' for x, y in HILL)
    lines = ''.join(f'<path d="M{a[0]} {a[1]}H{b[0]}"/>' for a, b in LINES)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
        f'<rect width="100" height="100" rx="{TILE_R}" fill="{RED}"/>'
        f'<g transform="rotate({ANGLE} 50 50)">'
        + rr(CARD, WHITE) + rr(PIC, CREAM)
        + f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{RED}"/>'
        + f'<polygon points="{hill}" fill="{NAVY}"/>'
        + rr(STAMP, CREAM, f' stroke="{NAVY}" stroke-width="{STAMP_W}"')
        + f'<g stroke="{NAVY}" stroke-width="{LINE_W}" stroke-linecap="round">{lines}</g>'
        + '</g></svg>\n')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = [
        ('icon-192.png', 192, True, 1.0),
        ('icon-512.png', 512, True, 1.0),
        ('icon-maskable-512.png', 512, False, 0.8),
        ('apple-touch-icon.png', 180, False, 0.9),
    ]
    for name, size, rounded, scale in jobs:
        make_png(size, rounded=rounded, scale=scale).save(OUT / name, optimize=True)
    (OUT / 'favicon.svg').write_text(make_svg(), encoding='utf-8', newline='\n')

    # 讀回驗尺寸
    for name, size, *_ in jobs:
        with Image.open(OUT / name) as im:
            assert im.size == (size, size), (name, im.size)
            print(f'  {name:24s} {im.size[0]}x{im.size[1]} {im.mode}')
    print(f'  favicon.svg              {(OUT / "favicon.svg").stat().st_size} bytes')


if __name__ == '__main__':
    main()
