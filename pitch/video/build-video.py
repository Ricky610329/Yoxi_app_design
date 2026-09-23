# -*- coding: utf-8 -*-
"""
yoxi 城事 — 初賽方案說明影片的草稿產生器。

    python pitch/video/build-video.py                 全部重產：TTS → 每格畫面 → 每格短片 → out/draft.mp4
    python pitch/video/build-video.py --no-tts        不跑 TTS，用靜音＋依字數估的秒數（排版迭代用）
    python pitch/video/build-video.py --only 3,5-7    只產第 3、5、6、7 格 → out/preview.mp4（draft.mp4 不動）
    python pitch/video/build-video.py --docs          只重寫 script.md 的分鏡表、storyboard.html、out/draft.srt
    python pitch/video/build-video.py --rate 2        TTS 語速（-10～10，預設 2）

讀什麼：同目錄 shots.json（鏡頭表的機器真相）＋ prototype/css/tokens.css（顏色）。
產什麼：
    out/draft.mp4           1920×1080、30 fps、H.264＋AAC
    out/draft.srt           旁白字幕（每句一條，時間依字數在該格內分配）
    out/build/              中間檔：每格的 PNG、wav、短片（可刪，下次重產）
    script.md               <!-- BEGIN:shots --> 到 <!-- END:shots --> 之間由本腳本重寫（其餘是人寫的）
    storyboard.html         整份由本腳本重寫
檢查（不過就 exit 1）：禁用詞、每句旁白 ≤ 25 字、旁白唸的車資／分鐘／點數＝app 公式、總長 ≤ 180 秒。

TTS：Windows 內建 System.Speech 的 Microsoft Hanhan Desktop（zh-TW）；每格一個 wav，畫面秒數＝
前導 0.25 秒＋旁白長度＋尾巴 0.65 秒（至少比旁白長 0.6 秒）＋該格的 hold（字多的卡片多停一下）。wav 依文字雜湊快取，文字沒變不重念。
不會關任何瀏覽器程序；只呼叫 powershell 與 ffmpeg。
"""
import argparse, hashlib, html, io, json, math, os, re, shutil, subprocess, sys, wave
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)

try:
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
except ImportError:
    print('需要 Pillow：pip install Pillow')
    sys.exit(1)

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = HERE / 'out'
BUILD = OUT / 'build'
SHOTS_JSON = HERE / 'shots.json'
SCRIPT_MD = HERE / 'script.md'
BOARD_HTML = HERE / 'storyboard.html'
TOKENS = ROOT / 'prototype' / 'css' / 'tokens.css'

W, H, FPS = 1920, 1080, 30
LEAD, TAIL = 0.25, 0.65         # 旁白前後留白（秒）；TAIL ≥ 0.6
FADE = 0.2
LIMIT = 180.0
FONT_REG = 'C:/Windows/Fonts/msjh.ttc'
FONT_BOLD = 'C:/Windows/Fonts/msjhbd.ttc'
VOICE = 'Microsoft Hanhan Desktop'
FFMPEG_WINGET = (r'C:\Users\ricky\AppData\Local\Microsoft\WinGet\Packages'
                 r'\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe'
                 r'\ffmpeg-8.1.1-essentials_build\bin\ffmpeg.exe')

BANNED = ['任務', '完成', '達成', '挑戰', '每日']
MAX_SENT = 25

# ---------------------------------------------------------------- app 的公式（與 app/js/app.js APP.fmt 同一套）
def fare(km):      return round(75 + 22 * km)
def ride_min(km):  return round(3 + 2.2 * km)
def walk_min(m):   return round(m / 75)
def ride_pts(km):  return math.floor(fare(km) / 20)
RIDE_BONUS = 50
WALK_MAX_M = 3000


def cn(n):
    """整數 → 中文口語讀法（0–9999）：691 → 六百九十一、34 → 三十四、12 → 十二。"""
    d = '零一二三四五六七八九'
    if n == 0:
        return '零'
    s, units, zero = '', [(1000, '千'), (100, '百'), (10, '十'), (1, '')], False
    for u, name in units:
        q = n // u % 10
        if q:
            if zero:
                s += '零'
            s += d[q] + name
            zero = False
        elif s:
            zero = True
    if s.startswith('一十'):
        s = s[1:]
    return s


# ---------------------------------------------------------------- 顏色：讀 tokens.css，不自己發明
def read_tokens():
    txt = TOKENS.read_text(encoding='utf-8')
    tok = {}
    for k, v in re.findall(r'--([\w-]+):\s*(#[0-9A-Fa-f]{6})', txt):
        tok[k] = v
    need = ['yoxi-red', 'yoxi-red-soft', 'yoxi-navy', 'yoxi-mist', 'yoxi-paper', 'yoxi-slate',
            'yoxi-slate-lite', 'yoxi-cream', 'yoxi-white', 'gold', 'yoxi-line']
    miss = [k for k in need if k not in tok]
    if miss:
        raise SystemExit('tokens.css 少了：' + '、'.join(miss))
    return tok


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# ---------------------------------------------------------------- 讀鏡頭表＋檢查
def load():
    data = json.loads(SHOTS_JSON.read_text(encoding='utf-8'))
    return data


def visible_texts(s):
    out = list(s['narration']) + [s['caption']]
    c = s.get('card')
    if c:
        out += [c.get('eyebrow', ''), c.get('title', '')] + list(c.get('lines', []))
    return out


def calc_lines(s):
    """畫面上的算式（從公式算，不手寫）。"""
    c = s.get('calc') or {}
    out = []
    if 'km' in c:
        km = c['km']
        plain = not (c.get('say_fare') or c.get('say_min') or c.get('say_pts'))
        if plain or c.get('say_fare'):
            out.append('車資 75 + 22 × %.1f km = $%d' % (km, fare(km)))
        if plain or c.get('say_min'):
            out.append('車程 3 + 2.2 × %.1f km → 約 %d 分' % (km, ride_min(km)))
        if c.get('say_pts'):
            out.append('搭車回饋 $%d ÷ 20 無條件捨去 = %d 點' % (fare(km), ride_pts(km)))
            out.append('走不到（> 3 km）搭車抵達 +%d 點，約車資 %d%%' % (RIDE_BONUS, round(RIDE_BONUS * 100 / fare(km))))
    if 'walk_m' in c:
        out.append('走路 %d m ÷ 75 = %d 分鐘' % (c['walk_m'], walk_min(c['walk_m'])))
    return out


def check(data):
    errs = []
    # 只檢查畫進畫面的字；missing_glyphs 定義在畫面區塊
    for i, s in enumerate(data['shots'], 1):
        for t in visible_texts(s):
            for b in BANNED:
                if b in t:
                    errs.append('#%d %s：禁用詞「%s」在「%s」' % (i, s['id'], b, t))
        for t in s['narration']:
            n = len(re.sub(r'[，。、：；！？「」\s]', '', t))
            if n > MAX_SENT:
                errs.append('#%d %s：旁白一句 %d 字 > %d：%s' % (i, s['id'], n, MAX_SENT, t))
        c = s.get('calc') or {}
        say = ''.join(s['narration'])
        if 'km' in c:
            km = c['km']
            if c.get('say_km') and cn(int(km)) + '公里' not in say:
                errs.append('#%d %s：旁白沒唸出 %s 公里' % (i, s['id'], cn(int(km))))
            if km <= WALK_MAX_M / 1000:
                errs.append('#%d %s：%.1f km 沒有超過走路門檻' % (i, s['id'], km))
            if c.get('say_fare') and cn(fare(km)) + '元' not in say:
                errs.append('#%d %s：車資應唸「%s元」' % (i, s['id'], cn(fare(km))))
            if c.get('say_min') and cn(ride_min(km)) + '分' not in say:
                errs.append('#%d %s：車程應唸「%s分」' % (i, s['id'], cn(ride_min(km))))
            if c.get('say_pts'):
                if cn(ride_pts(km)) + '點' not in say:
                    errs.append('#%d %s：搭車回饋應唸「%s點」' % (i, s['id'], cn(ride_pts(km))))
                if cn(RIDE_BONUS) + '點' not in say:
                    errs.append('#%d %s：解鎖回饋應唸「%s點」' % (i, s['id'], cn(RIDE_BONUS)))
        if 'walk_m' in c and c.get('say_walk'):
            if cn(walk_min(c['walk_m'])) + '分鐘' not in say:
                errs.append('#%d %s：走路應唸「%s分鐘」' % (i, s['id'], cn(walk_min(c['walk_m']))))
        bad = missing_glyphs(''.join(visible_texts(s) + calc_lines(s) + [s['section']]))
        if bad:
            errs.append('#%d %s：字型沒有這些字，會畫成方框：%s' % (i, s['id'], ' '.join(sorted(bad))))
        if s['kind'] == 'shot' and not (ROOT / s['image']).exists():
            errs.append('#%d %s：找不到截圖 %s' % (i, s['id'], s['image']))
    return errs


# ---------------------------------------------------------------- 畫面（Pillow）
def missing_glyphs(text):
    """msjh 沒有的字（會畫成方框）。用 getmask 的尺寸跟 .notdef 比。"""
    f = ImageFont.truetype(FONT_REG, 40)
    tofu = f.getmask('￿').getbbox()
    bad = set()
    for ch in set(text):
        if ch.isspace():
            continue
        if f.getmask(ch).getbbox() == tofu and ch != '￿':
            bad.add(ch)
    return bad


_fonts = {}
def font(size, bold=False):
    k = (size, bold)
    if k not in _fonts:
        _fonts[k] = ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)
    return _fonts[k]


TOKEN_RE = re.compile(r'[A-Za-z0-9$%.,/:_\-+×=≈⌊⌋()]+ ?|.', re.S)

def wrap(draw, text, f, maxw):
    lines, cur = [], ''
    for tk in TOKEN_RE.findall(text):
        trial = cur + tk
        if cur and draw.textlength(trial.rstrip(), font=f) > maxw:
            lines.append(cur.rstrip())
            cur = tk.lstrip()
        else:
            cur = trial
    if cur.strip():
        lines.append(cur.rstrip())
    # 標點不放行首
    for i in range(1, len(lines)):
        while lines[i] and lines[i][0] in '，。、：；！？」）' and len(lines[i - 1]) > 1:
            lines[i - 1] += lines[i][0]
            lines[i] = lines[i][1:]
    return [l for l in lines if l]


def draw_lines(draw, xy, lines, f, fill, lh):
    x, y = xy
    for l in lines:
        draw.text((x, y), l, font=f, fill=fill)
        y += lh
    return y


def rounded_mask(size, r):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), r, fill=255)
    return m


def pill(draw, xy, text, f, fg, bg, padx=22, pady=10):
    x, y = xy
    tw = draw.textlength(text, font=f)
    asc, desc = f.getmetrics()
    h = asc + desc + pady * 2
    draw.rounded_rectangle((x, y, x + tw + padx * 2, y + h), h // 2, fill=bg)
    draw.text((x + padx, y + pady), text, font=f, fill=fg)
    return x + tw + padx * 2


def render_shot(s, idx, total, tok):
    C = {k: rgb(v) for k, v in tok.items()}
    im = Image.new('RGB', (W, H), C['yoxi-mist'])
    d = ImageDraw.Draw(im)

    # 手機：390×844 → 等比放大 1.18 倍（460×996）；1080 高放不下 2 倍，高度優先
    ph = Image.open(ROOT / s['image']).convert('RGB')
    scale = 996 / ph.height
    pw, phh = round(ph.width * scale), 996
    ph = ph.resize((pw, phh), Image.LANCZOS)
    px, py = 200, (H - phh) // 2
    r = 40
    sh = Image.new('L', (W, H), 0)
    ImageDraw.Draw(sh).rounded_rectangle((px - 4, py + 10, px + pw + 4, py + phh + 18), r + 6, fill=90)
    sh = sh.filter(ImageFilter.GaussianBlur(22))
    im.paste(Image.new('RGB', (W, H), C['yoxi-navy']), (0, 0), sh)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((px - 10, py - 10, px + pw + 9, py + phh + 9), r + 10, fill=C['yoxi-navy'])
    im.paste(ph, (px, py), rounded_mask((pw, phh), r))

    # 右欄
    x0, colw = 800, 1040
    d.text((x0, 64), 'yoxi 城事', font=font(34, True), fill=C['yoxi-red'])
    d.text((x0 + 200, 70), '初賽方案說明', font=font(26), fill=C['yoxi-slate'])
    y = 170
    end = pill(d, (x0, y), s['section'], font(30, True), C['yoxi-red'], C['yoxi-red-soft'])
    d.text((end + 20, y + 12), '%d / %d' % (idx, total), font=font(28), fill=C['yoxi-slate'])
    y += 100
    f = font(66, True)
    y = draw_lines(d, (x0, y), wrap(d, s['caption'], f, colw), f, C['yoxi-navy'], 90)
    calc = calc_lines(s)
    if calc:
        y += 24
        f2 = font(34, True)
        for l in calc:
            d.text((x0, y), l, font=f2, fill=C['yoxi-red'])
            y += 50

    # 旁白字幕（下三分之一）
    f3 = font(36)
    lines = []
    for t in s['narration']:
        lines += wrap(d, t, f3, colw - 72)
    bh = 36 + len(lines) * 54 + 20
    by = 930 - bh
    d.rounded_rectangle((x0, by, x0 + colw, by + bh), 8, fill=C['yoxi-white'])
    d.rectangle((x0, by, x0 + 8, by + bh), fill=C['yoxi-navy'])
    draw_lines(d, (x0 + 40, by + 26), lines, f3, C['yoxi-navy'], 54)

    foot = '原型畫面（示意）・數字由 app 公式算出・明信片與插圖為 AI 生成示意・地圖 © OpenStreetMap 貢獻者'
    d.text((x0, 980), foot, font=font(22), fill=C['yoxi-slate'])
    return im


def render_card(s, idx, total, tok):
    C = {k: rgb(v) for k, v in tok.items()}
    im = Image.new('RGB', (W, H), C['yoxi-navy'])
    d = ImageDraw.Draw(im)
    card = s['card']
    x0, colw = 200, 1520
    d.rectangle((0, 0, 24, H), fill=C['yoxi-red'])
    d.text((x0, 110), 'yoxi 城事', font=font(40, True), fill=C['yoxi-red'])
    y = 260
    d.text((x0, y), card.get('eyebrow', ''), font=font(40, True), fill=C['yoxi-cream'])
    y += 80
    big = s['id'] == 'end'
    f = font(128 if big else 80, True)
    y = draw_lines(d, (x0, y), wrap(d, card['title'], f, colw), f, C['yoxi-white'], 160 if big else 108)
    y += 30
    f2 = font(38)
    for l in card.get('lines', []):
        y = draw_lines(d, (x0, y), wrap(d, l, f2, colw), f2, C['yoxi-slate-lite'], 58) + 8
    # 旁白字幕
    f3 = font(34)
    lines = []
    for t in s['narration']:
        lines += wrap(d, t, f3, colw)
    yy = 1000 - len(lines) * 50
    d.line((x0, yy - 28, x0 + colw, yy - 28), fill=C['yoxi-slate'], width=1)
    draw_lines(d, (x0, yy), lines, f3, C['yoxi-mist'], 50)
    return im


# ---------------------------------------------------------------- TTS
PS1 = r'''
param([string]$Jobs, [int]$Rate)
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice('__VOICE__')
$s.Rate = $Rate
$list = Get-Content -Raw -Encoding UTF8 $Jobs | ConvertFrom-Json
foreach ($j in $list) {
  $s.SetOutputToWaveFile($j.out)
  $s.Speak($j.text)
  $s.SetOutputToNull()
}
$s.Dispose()
'''


def tts_text(s):
    return ''.join(s['narration'])


def wav_path(s, rate):
    h = hashlib.sha1((VOICE + str(rate) + tts_text(s)).encode('utf-8')).hexdigest()[:10]
    return BUILD / ('%s-%s.wav' % (s['id'], h))


def run_tts(shots, rate):
    jobs = [{'text': tts_text(s), 'out': str(wav_path(s, rate))} for s in shots if not wav_path(s, rate).exists()]
    if not jobs:
        return True
    jf = BUILD / 'tts-jobs.json'
    jf.write_text(json.dumps(jobs, ensure_ascii=False), encoding='utf-8')
    ps = BUILD / 'tts.ps1'
    ps.write_text(PS1.replace('__VOICE__', VOICE), encoding='utf-8-sig')
    print('TTS：%d 格要念（%s，Rate %d）…' % (len(jobs), VOICE, rate))
    r = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(ps),
                        '-Jobs', str(jf), '-Rate', str(rate)], capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    if r.returncode != 0:
        print(r.stdout[-2000:], r.stderr[-2000:])
        return False
    return all(Path(j['out']).exists() for j in jobs)


def wav_len(p):
    with wave.open(str(p), 'rb') as w:
        return w.getnframes() / float(w.getframerate())


def est_len(s):
    n = len(re.sub(r'[，。、：；！？\s]', '', tts_text(s)))
    return n / 4.6 + 0.3 * (len(s['narration']) - 1)


# ---------------------------------------------------------------- ffmpeg
def find_ffmpeg():
    for c in (shutil.which('ffmpeg'), FFMPEG_WINGET):
        if c and Path(c).exists():
            return c
    return None


def ff(ffmpeg, args):
    r = subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y'] + args,
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode != 0:
        raise SystemExit('ffmpeg 失敗：' + r.stderr[-2000:])


def make_clip(ffmpeg, png, wav, dur, out, tok):
    fadec = '0x' + tok['yoxi-navy'].lstrip('#')
    ms = int(LEAD * 1000)
    vf = ('[0:v]format=yuv420p,fade=t=in:st=0:d=%.2f:c=%s,fade=t=out:st=%.3f:d=%.2f:c=%s[v]'
          % (FADE, fadec, dur - FADE, FADE, fadec))
    if wav:
        ain = ['-i', str(wav)]
        af = '[1:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=%d|%d,apad,atrim=0:%.3f[a]' % (ms, ms, dur)
    else:
        ain = ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']
        af = '[1:a]atrim=0:%.3f[a]' % dur
    ff(ffmpeg, ['-loop', '1', '-framerate', str(FPS), '-i', str(png)] + ain +
       ['-filter_complex', vf + ';' + af, '-map', '[v]', '-map', '[a]', '-t', '%.3f' % dur,
        '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', str(out)])


def concat(ffmpeg, clips, out):
    lst = BUILD / 'concat.txt'
    lst.write_text(''.join("file '%s'\n" % c.as_posix() for c in clips), encoding='utf-8')
    ff(ffmpeg, ['-f', 'concat', '-safe', '0', '-i', str(lst), '-c', 'copy', '-movflags', '+faststart', str(out)])


def probe(ffmpeg, path):
    fp = Path(ffmpeg).with_name('ffprobe.exe')
    probe_exe = str(fp) if fp.exists() else (shutil.which('ffprobe') or 'ffprobe')
    r = subprocess.run([probe_exe, '-v', 'error', '-show_entries', 'format=duration:stream=codec_name,width,height,r_frame_rate',
                        '-of', 'json', str(path)], capture_output=True, text=True, encoding='utf-8')
    return json.loads(r.stdout)


# ---------------------------------------------------------------- 文件：script.md 分鏡表、storyboard.html、draft.srt
def tc(t, ms=False):
    m, s = divmod(t, 60)
    if ms:
        h, m = divmod(int(m), 60)
        return '%02d:%02d:%02d,%03d' % (h, m, int(s), int(round((s - int(s)) * 1000)) % 1000)
    return '%d:%04.1f' % (int(m), s)


def timeline(shots, durs):
    t, out = 0.0, []
    for s, d in zip(shots, durs):
        out.append((t, t + d))
        t += d
    return out


def screen_cell(s):
    if s['kind'] == 'card':
        return '標題卡（%s）' % s['card']['title']
    return '`%s`' % Path(s['image']).name


def write_srt(shots, durs, spoken):
    lines, n = [], 1
    for s, (a, b), sp in zip(shots, timeline(shots, durs), spoken):
        t = a + LEAD
        total = sum(len(x) for x in s['narration'])
        for sent in s['narration']:
            d = sp * len(sent) / total
            lines.append('%d\n%s --> %s\n%s\n' % (n, tc(t, True), tc(min(t + d, b - 0.05), True), sent))
            n += 1
            t += d
    (OUT / 'draft.srt').write_text('\n'.join(lines), encoding='utf-8')


def write_script_md(data, durs, measured):
    shots = data['shots']
    tl = timeline(shots, durs)
    total = tl[-1][1]
    rows = ['| # | 時間碼 | 段落 | 畫面（草稿用） | 旁白 | 字幕 | 正式版怎麼錄 | 備註 |',
            '|---|---|---|---|---|---|---|---|']
    for i, (s, (a, b)) in enumerate(zip(shots, tl), 1):
        cell = lambda x: x.replace('|', '／').replace('\n', ' ')
        note = s.get('note', '')
        calc = calc_lines(s)
        if calc:
            note = (note + ' 算式：' + '；'.join(calc)).strip()
        rows.append('| %d | %s–%s | %s | %s | %s | %s | %s | %s |' % (
            i, tc(a), tc(b), s['section'], screen_cell(s), cell('<br>'.join(s['narration'])),
            cell(s['caption']), cell(s['record']), cell(note)))
    # 段落小計
    secs, order = {}, []
    for s, (a, b) in zip(shots, tl):
        if s['section'] not in secs:
            secs[s['section']] = [a, b]
            order.append(s['section'])
        secs[s['section']][1] = b
    sec_rows = ['| 段落 | 時間 | 長度 |', '|---|---|---|'] + [
        '| %s | %s–%s | %.1f 秒 |' % (k, tc(secs[k][0]), tc(secs[k][1]), secs[k][1] - secs[k][0]) for k in order]
    src = '實測（TTS wav 長度＋前後留白 %.2f／%.2f 秒）' % (LEAD, TAIL) if measured else '估計（沒有 TTS，依字數 4.6 字／秒估）'
    need = [s for s in shots if s['record'].startswith('需錄製')]
    block = '\n'.join([
        '<!-- BEGIN:shots（本段由 build-video.py 從 shots.json 重寫，不要手改；改 shots.json 再重跑） -->',
        '',
        '**總長 %s（%.1f 秒），%d 個鏡頭。時間碼來源：%s。**' % (tc(total), total, len(shots), src),
        '',
        '### 段落小計', '', *sec_rows, '',
        '### 分鏡表', '', *rows, '',
        '### 需要真實錄製的格（草稿用靜態截圖代替動作）', '',
        *['- #%d `%s`：%s' % (shots.index(s) + 1, s['id'], s['record'][4:]) for s in need], '',
        '### 旁白全文（照順序唸，一格一段）', '',
        *['%d. %s' % (i, ''.join(s['narration'])) for i, s in enumerate(shots, 1)], '',
        '<!-- END:shots -->'])
    md = SCRIPT_MD.read_text(encoding='utf-8')
    md = re.sub(r'<!-- BEGIN:shots.*?<!-- END:shots -->', lambda m: block, md, flags=re.S)
    SCRIPT_MD.write_text(md, encoding='utf-8')


def write_storyboard(data, durs, measured):
    shots = data['shots']
    tl = timeline(shots, durs)
    total = tl[-1][1]
    e = html.escape
    cells = []
    for i, (s, (a, b)) in enumerate(zip(shots, tl), 1):
        if s['kind'] == 'card':
            c = s['card']
            vis = ('<div class="card-frame"><p class="eb">%s</p><p class="tt">%s</p>%s</div>' % (
                e(c.get('eyebrow', '')), e(c['title']), ''.join('<p class="ln">%s</p>' % e(l) for l in c.get('lines', []))))
        else:
            vis = '<div class="phone"><img src="../../%s" alt="%s" loading="lazy"></div>' % (e(s['image']), e(s['id']))
        calc = ''.join('<li>%s</li>' % e(l) for l in calc_lines(s))
        cells.append('''
<article class="shot%s">
  %s
  <div class="meta">
    <p class="tc"><b>#%d</b> %s–%s <span>%.1f 秒</span></p>
    <p class="sec">%s</p>
    <p class="cap">%s</p>
    <p class="nar">%s</p>
    %s
    <p class="rec%s">%s</p>
    %s
  </div>
</article>''' % (' is-card' if s['kind'] == 'card' else '', vis, i, tc(a), tc(b), b - a, e(s['section']), e(s['caption']),
                 '<br>'.join(e(x) for x in s['narration']),
                 ('<ul class="calc">%s</ul>' % calc) if calc else '',
                 ' is-need' if s['record'].startswith('需錄製') else '', e(s['record']),
                 ('<p class="note">%s</p>' % e(s['note'])) if s.get('note') else ''))
    src = '實測 TTS 長度' if measured else '依字數估計'
    page = '''<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>城事影片分鏡</title>
<!-- 由 pitch/video/build-video.py 從 shots.json 產生，不要手改。顏色一律讀 prototype/css/tokens.css 的變數。 -->
<link rel="stylesheet" href="../../prototype/css/tokens.css">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--yoxi-mist); color: var(--yoxi-navy);
         font-family: "Noto Sans TC", "Microsoft JhengHei", "PingFang TC", sans-serif; }
  header { background: var(--yoxi-red); color: var(--yoxi-white); padding: var(--sp-6) var(--gutter); }
  header h1 { margin: 0 0 var(--sp-2); font-size: var(--fs-h1); }
  header p { margin: 0; font-size: var(--fs-sm); opacity: .92; }
  main { max-width: 1280px; margin: 0 auto; padding: var(--sp-5) var(--gutter) var(--sp-7);
         display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: var(--sp-5); }
  .shot { background: var(--yoxi-paper); border-radius: var(--r-card); box-shadow: var(--sh-card);
          display: grid; grid-template-columns: 130px 1fr; gap: var(--sp-4); padding: var(--sp-4); }
  .phone img { width: 130px; height: auto; aspect-ratio: 390 / 844; display: block;
               border-radius: var(--r-card); border: 3px solid var(--yoxi-navy); }
  .card-frame { width: 130px; aspect-ratio: 390 / 844; background: var(--yoxi-navy); color: var(--yoxi-white);
                border-radius: var(--r-card); padding: var(--sp-3) var(--sp-2); border-left: 4px solid var(--yoxi-red); overflow: hidden; }
  .card-frame p { margin: 0 0 var(--sp-2); }
  .card-frame .eb { color: var(--yoxi-cream); font-size: var(--fs-xs); font-weight: var(--fw-bold); }
  .card-frame .tt { font-size: var(--fs-sm); font-weight: var(--fw-heavy); line-height: var(--lh-tight); }
  .card-frame .ln { color: var(--yoxi-slate-lite); font-size: 10px; line-height: 1.4; }
  .meta p { margin: 0 0 var(--sp-2); }
  .tc { font-size: var(--fs-sm); color: var(--yoxi-slate); }
  .tc b { color: var(--yoxi-navy); }
  .tc span { float: right; }
  .sec { display: inline-block; font-size: var(--fs-xs); font-weight: var(--fw-bold); color: var(--yoxi-red);
         background: var(--yoxi-red-soft); border-radius: var(--r-pill); padding: 2px var(--sp-2); }
  .cap { font-size: var(--fs-lead); font-weight: var(--fw-heavy); line-height: var(--lh-tight); }
  .nar { font-size: var(--fs-sm); line-height: var(--lh-body); border-left: 3px solid var(--yoxi-line); padding-left: var(--sp-2); }
  .calc { margin: 0 0 var(--sp-2); padding-left: var(--sp-4); color: var(--yoxi-red); font-size: var(--fs-cap); font-weight: var(--fw-bold); }
  .rec { font-size: var(--fs-cap); color: var(--yoxi-slate); }
  .rec.is-need { color: var(--yoxi-navy); background: var(--gold-lite); border-radius: var(--r-btn); padding: var(--sp-1) var(--sp-2); }
  .note { font-size: var(--fs-cap); color: var(--yoxi-slate); }
  @media (max-width: 420px) { main { grid-template-columns: 1fr; } .shot { grid-template-columns: 96px 1fr; }
    .phone img, .card-frame { width: 96px; } }
</style>
</head>
<body>
<header>
  <h1>yoxi 城事 · 方案說明影片分鏡</h1>
  <p>總長 %s（%.1f 秒，%s），%d 個鏡頭 · 上限 3:00 · 黃底的格＝正式版要真實錄製的動作 · 旁白與數字的真相在 shots.json／script.md</p>
</header>
<main>%s
</main>
</body>
</html>
''' % (tc(total), total, src, len(shots), ''.join(cells))
    BOARD_HTML.write_text(page, encoding='utf-8')


# ---------------------------------------------------------------- main
def parse_only(spec, n):
    out = set()
    for part in spec.split(','):
        part = part.strip()
        if not part:
            continue
        if '-' in part:
            a, b = part.split('-')
            out.update(range(int(a), int(b) + 1))
        else:
            out.add(int(part))
    bad = [x for x in out if x < 1 or x > n]
    if bad:
        raise SystemExit('--only 超出範圍 1–%d：%s' % (n, bad))
    return sorted(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--no-tts', action='store_true')
    ap.add_argument('--only', default='')
    ap.add_argument('--docs', action='store_true')
    ap.add_argument('--rate', type=int, default=2)
    a = ap.parse_args()

    data = load()
    shots = data['shots']
    errs = check(data)
    if errs:
        print('鏡頭表檢查沒過：')
        for x in errs:
            print('  ' + x)
        return 1
    print('鏡頭表檢查：%d 格，禁用詞 0、每句 ≤ %d 字、公式數字對得上。' % (len(shots), MAX_SENT))
    tok = read_tokens()
    OUT.mkdir(exist_ok=True)
    BUILD.mkdir(parents=True, exist_ok=True)

    use_tts = not a.no_tts
    if use_tts and not run_tts(shots, a.rate):
        print('TTS 失敗；改用 --no-tts 可先產靜音版。')
        return 1
    if use_tts:  # 清掉舊文字／舊語速留下的 wav
        keep = {wav_path(s, a.rate).name for s in shots}
        for w in BUILD.glob('*.wav'):
            if w.name not in keep:
                w.unlink()
    spoken = [wav_len(wav_path(s, a.rate)) if use_tts else est_len(s) for s in shots]
    durs = [round(LEAD + sp + TAIL + float(s.get('hold', 0)), 2) for s, sp in zip(shots, spoken)]
    total = sum(durs)

    write_script_md(data, durs, use_tts)
    write_storyboard(data, durs, use_tts)
    write_srt(shots, durs, spoken)
    print('已寫：script.md 分鏡表、storyboard.html、out/draft.srt')
    if a.docs:
        print('總長 %.1f 秒' % total)
        return 0 if total <= LIMIT else 1

    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        print('找不到 ffmpeg。')
        return 1
    idx = parse_only(a.only, len(shots)) if a.only else list(range(1, len(shots) + 1))
    clips = []
    for i in idx:
        s = shots[i - 1]
        png = BUILD / ('%02d-%s.png' % (i, s['id']))
        im = render_shot(s, i, len(shots), tok) if s['kind'] == 'shot' else render_card(s, i, len(shots), tok)
        im.save(png)
        clip = BUILD / ('%02d-%s.mp4' % (i, s['id']))
        make_clip(ffmpeg, png, wav_path(s, a.rate) if use_tts else None, durs[i - 1], clip, tok)
        clips.append(clip)
        print('  #%02d %-12s %5.1f 秒' % (i, s['id'], durs[i - 1]))
    out = OUT / ('preview.mp4' if a.only else 'draft.mp4')
    concat(ffmpeg, clips, out)
    info = probe(ffmpeg, out)
    dur = float(info['format']['duration'])
    v = [st for st in info['streams'] if st.get('width')][0]
    au = [st for st in info['streams'] if not st.get('width')]
    print('輸出 %s' % out.relative_to(ROOT))
    print('  ffprobe：duration %.2f 秒（%s）、%dx%d、%s、%s fps、音訊 %s' % (
        dur, tc(dur), v['width'], v['height'], v['codec_name'], v['r_frame_rate'], au[0]['codec_name'] if au else '無'))
    if not a.only and dur > LIMIT:
        print('超過 %d 秒上限！' % LIMIT)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
