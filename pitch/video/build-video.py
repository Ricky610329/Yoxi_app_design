# -*- coding: utf-8 -*-
"""
遊喜樂 — 初賽方案說明影片（向量動畫版）的產生管線。

影片本身是 anim/index.html 這支向量動畫：每一格畫面都是時間 t 的純函數（ANIM.seek(t)，契約見 anim/CONTRACT.md）。
本腳本做四件事：檢查鏡頭表 → TTS（或真人配音）量長度 → 寫 anim/timeline.js → 用 headless Chrome 逐格截圖餵給 ffmpeg。

    python pitch/video/build-video.py                   全部重產 → out/draft.mp4（＋文件、分鏡縮圖）
    python pitch/video/build-video.py --no-tts          不跑 TTS：靜音＋依字數估秒數（排版迭代用）
    python pitch/video/build-video.py --rate 2          TTS 語速（-10～10，預設 2）
    python pitch/video/build-video.py --only 3,5-7      只算那幾格 → out/preview.mp4（draft.mp4 不動）
    python pitch/video/build-video.py --fps 10          幀率（預設 30；預覽用 10）
    python pitch/video/build-video.py --frame 12.5,40   只截那幾秒 → out/frames/t012.5.png …
    python pitch/video/build-video.py --docs            只寫 timeline.js／script.md／storyboard.html／draft.srt，不開 Chrome
    python pitch/video/build-video.py --board           只重截分鏡縮圖 out/board/NN-<id>.png
    python pitch/video/build-video.py --check           每格截兩次比 bytes，證明畫面是 t 的純函數
    python pitch/video/build-video.py --audio-dir DIR   正式版真人配音：用 DIR/NN-<id>.wav（或 .m4a／.mp3）取代 TTS

讀什麼：
    shots.json                          鏡頭表的機器真相（旁白、字幕、場景名、hold、calc）
    anim/scenes-a.js、anim/scenes-b.js   只用 regex 掃 ANIM.scene('名字' 有沒有註冊
    prototype/js/catalog.js             ROADMAP 五步的 name（regex 讀）
    C:/Windows/Fonts/NotoSansTC-VF.ttf  影片字型，檢查缺字
產什麼：
    anim/timeline.js      window.TIMELINE（每格起訖、旁白、字幕時間、公式算好的數字）；每次執行都重寫
    out/draft.mp4         1920×1080、H.264（CRF 18）＋AAC 160k、48 kHz 立體聲
    out/preview.mp4       --only 的預覽
    out/draft.srt         旁白字幕（時間＝timeline 的 subs）
    out/board/NN-<id>.png 分鏡縮圖（每格 start + dur × 0.55 那一秒，480×270）
    out/frames/tNNN.N.png --frame 的單張
    out/build/            wav 快取、音軌、ffmpeg 記錄（可刪，下次重產）
    script.md             <!-- BEGIN:shots --> 到 <!-- END:shots --> 之間由本腳本重寫（其餘是人寫的）
    storyboard.html       整份由本腳本重寫
檢查（不過就 exit 1）：禁用詞（旁白、字幕、段落名）、每句旁白 ≤ 25 字（去標點）、旁白唸的公里／車資／分鐘／點數＝app 公式、
    字型缺字、場景名有註冊、總長 ≤ 180 秒；Chrome 裡的 data-error 或 JS 例外；成片 ffprobe 長度 ≤ 180 秒。

每格秒數＝前導 0.25 ＋旁白長度＋尾巴 0.65 ＋ hold。TTS 用 Windows 內建 System.Speech 的 Microsoft Hanhan Desktop（zh-TW），
wav 依「語音＋語速＋文字」雜湊快取在 out/build/，文字沒變不重念。
截圖：headless Chrome 的 DevTools 協定（標準庫 socket 寫的最小 WebSocket 用戶端，不需要任何套件），PNG 直接寫進 ffmpeg 的 stdin，不落地。
每次開自己的 --user-data-dir 暫存目錄，結束後刪掉；不會關任何其他瀏覽器程序。
"""
import argparse, base64, hashlib, html, http.client, importlib.util, io, json, math, os, queue, re, shutil, socket
import struct, subprocess, sys, tempfile, threading, time, urllib.parse, wave
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
ANIM_DIR = HERE / 'anim'
OUT = HERE / 'out'
BUILD = OUT / 'build'
BOARD = OUT / 'board'
FRAMES = OUT / 'frames'
SHOTS_JSON = HERE / 'shots.json'
SCRIPT_MD = HERE / 'script.md'
BOARD_HTML = HERE / 'storyboard.html'
TIMELINE_JS = ANIM_DIR / 'timeline.js'
INDEX_HTML = ANIM_DIR / 'index.html'
SCENE_FILES = [ANIM_DIR / 'scenes-a.js', ANIM_DIR / 'scenes-b.js']
CATALOG = ROOT / 'prototype' / 'js' / 'catalog.js'
SHOOT_APP = ROOT / 'app' / 'tools' / 'shoot-app.py'

W, H = 1920, 1080
LEAD, TAIL, FADE = 0.25, 0.65, 0.5     # 旁白前後留白、鏡頭交叉淡接（秒）
LIMIT = 180.0
SR = 48000
FONT = 'C:/Windows/Fonts/NotoSansTC-VF.ttf'
VOICE = 'Microsoft Hanhan Desktop'
FFMPEG_WINGET = (r'C:\Users\ricky\AppData\Local\Microsoft\WinGet\Packages'
                 r'\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe'
                 r'\ffmpeg-8.1.1-essentials_build\bin\ffmpeg.exe')
BOARD_AT = 0.55
BOARD_SIZE = (480, 270)

BANNED = ['任務', '完成', '達成', '挑戰', '每日']
MAX_SENT = 25
PUNCT = r'[，。、：；！？「」『』（）()…—\s]'

# ---------------------------------------------------------------- app 的公式（與 app/js/app.js APP.fmt 同一套）
def fare(km):      return round(75 + 22 * km)
def ride_min(km):  return round(3 + 2.2 * km)
def walk_min(m):   return round(m / 75)
def ride_pts(km):  return math.floor(fare(km) / 20)
RIDE_BONUS = 50
WALK_MAX_M = 3000

# 影片裡固定的產品事實（出處：pitch/BRIEF.md、pitch/docs/roadmap.md、prototype 的 STATE）
NEIWAN = {'id': 'neiwan', 'label': '內灣老街', 'km': 28.0}
KILN = {'id': 'glass-kiln', 'label': '水利路的老玻璃窯', 'm': 900}
PUSH_PER_DAY = 2
PILOT_CITY, PILOT_WEEKS = '新竹', 12
BADGE = {'have': 4, 'of': 8}
# 路線圖五步的時間：出處 pitch/docs/roadmap.md 的時程表（步驟名稱另從 prototype/js/catalog.js ROADMAP 讀）
ROADMAP_WHEN = {0: '2027 Q1 · 新竹 12 週', 1: '2027 Q2', 2: '2027 Q3', 3: '2027 Q3–Q4', 4: '2028 起'}


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


# ---------------------------------------------------------------- 讀鏡頭表＋共用數字
def load():
    return json.loads(SHOTS_JSON.read_text(encoding='utf-8'))


def read_roadmap():
    txt = CATALOG.read_text(encoding='utf-8')
    found = {int(a): b for a, b in re.findall(r"\{\s*step:\s*(\d+),\s*name:\s*'([^']+)'", txt)}
    miss = [k for k in ROADMAP_WHEN if k not in found]
    if miss:
        raise SystemExit('catalog.js 的 ROADMAP 讀不到第 %s 步的 name' % miss)
    return [{'step': k, 'name': found[k], 'when': ROADMAP_WHEN[k]} for k in sorted(ROADMAP_WHEN)]


def global_calc(shots):
    """TIMELINE.calc：全部由公式算。公里／公尺若 shots.json 有寫，以 shots.json 為準（而且各格要一致）。"""
    kms = {s['calc']['km'] for s in shots if 'km' in (s.get('calc') or {})}
    ms = {s['calc']['walk_m'] for s in shots if 'walk_m' in (s.get('calc') or {})}
    if len(kms) > 1 or len(ms) > 1:
        raise SystemExit('shots.json 的 calc.km／walk_m 各格不一致：%s %s' % (kms, ms))
    km = float(kms.pop()) if kms else NEIWAN['km']
    m = int(ms.pop()) if ms else KILN['m']
    return {
        'neiwan': dict(NEIWAN, km=km, fare=fare(km), min=ride_min(km), pts=ride_pts(km), bonus=RIDE_BONUS),
        'kiln': dict(KILN, m=m, walkMin=walk_min(m)),
        'walkMaxKm': WALK_MAX_M // 1000,
        'pushPerDay': PUSH_PER_DAY,
        'pilotCity': PILOT_CITY,
        'pilotWeeks': PILOT_WEEKS,
        'badge': dict(BADGE),
        'roadmap': read_roadmap(),
    }


def calc_lines(s):
    """算式（寫進 script.md／storyboard 的備註；從公式算，不手寫）。"""
    c = s.get('calc') or {}
    out = []
    if 'km' in c:
        km = c['km']
        out.append('車資 75 + 22 × %.1f km = $%d' % (km, fare(km)))
        out.append('車程 3 + 2.2 × %.1f km → 約 %d 分' % (km, ride_min(km)))
        out.append('搭車回饋 $%d ÷ 20 無條件捨去 = %d 點；走不到（> 3 km）搭車抵達 +%d 點' % (fare(km), ride_pts(km), RIDE_BONUS))
    if 'walk_m' in c:
        out.append('走路 %d m ÷ 75 = %d 分鐘' % (c['walk_m'], walk_min(c['walk_m'])))
    return out


# ---------------------------------------------------------------- 檢查
_tofu = None
def missing_glyphs(text):
    """Noto Sans TC 沒有的字（會畫成方框）：跟 .notdef 的點陣整張比。"""
    global _tofu
    from PIL import ImageFont
    f = ImageFont.truetype(FONT, 40)
    if _tofu is None:
        m = f.getmask('\U0010FFFD')
        _tofu = (m.size, bytes(m))
    bad = set()
    for ch in set(text):
        if ch.isspace():
            continue
        m = f.getmask(ch)
        if (m.size, bytes(m)) == _tofu:
            bad.add(ch)
    return bad


def registered_scenes():
    """掃 scenes-*.js 的 ANIM.scene('名字'。檔案若用變數動態註冊（ANIM.scene(name, …)），退而接受檔內出現的 '名字' 字串。"""
    lit, loose = set(), set()
    for f in SCENE_FILES:
        if not f.exists():
            continue
        txt = f.read_text(encoding='utf-8')
        lit |= set(re.findall(r"ANIM\.scene\(\s*['\"]([\w-]+)['\"]", txt))
        if re.search(r"ANIM\.scene\(\s*[A-Za-z_$]", txt):
            loose |= set(re.findall(r"['\"]([\w-]+)['\"]", txt))
    return lit, loose


def check(data, gcalc):
    errs, warns = [], []
    shots = data['shots']
    ids = [s['id'] for s in shots]
    if len(set(ids)) != len(ids):
        errs.append('id 重複：%s' % ids)
    lit, loose = registered_scenes()
    for i, s in enumerate(shots, 1):
        tag = '#%d %s' % (i, s['id'])
        for t in list(s['narration']) + [s['caption'], s['section']]:
            for b in BANNED:
                if b in t:
                    errs.append('%s：禁用詞「%s」在「%s」' % (tag, b, t))
        for t in s['narration']:
            n = len(re.sub(PUNCT, '', t))
            if n > MAX_SENT:
                errs.append('%s：旁白一句 %d 字 > %d：%s' % (tag, n, MAX_SENT, t))
        if s.get('theme') not in ('light', 'dark'):
            errs.append('%s：theme 要是 light 或 dark' % tag)
        sc = s.get('scene')
        if sc in lit:
            pass
        elif sc in loose:
            warns.append(sc)
        else:
            errs.append('%s：scenes-a.js／scenes-b.js 裡沒有註冊場景「%s」' % (tag, sc))
        c = s.get('calc') or {}
        say = ''.join(s['narration'])
        if 'km' in c:
            km = c['km']
            if c.get('say_km') and cn(int(km)) + '公里' not in say:
                errs.append('%s：旁白沒唸出「%s公里」' % (tag, cn(int(km))))
            if km <= WALK_MAX_M / 1000:
                errs.append('%s：%.1f km 沒有超過走路門檻' % (tag, km))
            if c.get('say_fare') and cn(fare(km)) + '元' not in say:
                errs.append('%s：車資應唸「%s元」' % (tag, cn(fare(km))))
            if c.get('say_min') and cn(ride_min(km)) + '分' not in say:
                errs.append('%s：車程應唸「%s分」' % (tag, cn(ride_min(km))))
            if c.get('say_pts'):
                if cn(ride_pts(km)) + '點' not in say:
                    errs.append('%s：搭車回饋應唸「%s點」' % (tag, cn(ride_pts(km))))
                if cn(RIDE_BONUS) + '點' not in say:
                    errs.append('%s：解鎖回饋應唸「%s點」' % (tag, cn(RIDE_BONUS)))
        if 'walk_m' in c:
            if c['walk_m'] > WALK_MAX_M:
                errs.append('%s：%d m 超過走路門檻' % (tag, c['walk_m']))
            if c.get('say_walk') and cn(walk_min(c['walk_m'])) + '分鐘' not in say:
                errs.append('%s：走路應唸「%s分鐘」' % (tag, cn(walk_min(c['walk_m']))))
        bad = missing_glyphs(''.join(list(s['narration']) + [s['caption'], s['section']]))
        if bad:
            errs.append('%s：Noto Sans TC 沒有這些字，會畫成方框：%s' % (tag, ' '.join(sorted(bad))))
    g = gcalc
    gtext = ''.join([g['neiwan']['label'], g['kiln']['label'], g['pilotCity'], '收集'] +
                    [r['name'] + r['when'] for r in g['roadmap']])
    bad = missing_glyphs(gtext)
    if bad:
        errs.append('calc 的字 Noto Sans TC 沒有：%s' % ' '.join(sorted(bad)))
    for b in BANNED:
        if b in gtext:
            errs.append('calc 的字有禁用詞「%s」' % b)
    return errs, warns


# ---------------------------------------------------------------- TTS／配音
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
    n = len(re.sub(PUNCT, '', tts_text(s)))
    return n / 4.6 + 0.3 * (len(s['narration']) - 1)


def find_voice_file(audio_dir, i, s):
    for ext in ('.wav', '.m4a', '.mp3'):
        p = audio_dir / ('%02d-%s%s' % (i, s['id'], ext))
        if p.exists():
            return p
    return None


# ---------------------------------------------------------------- ffmpeg
def find_ffmpeg():
    for c in (shutil.which('ffmpeg'), FFMPEG_WINGET):
        if c and Path(c).exists():
            return c
    return None


def find_ffprobe(ffmpeg):
    fp = Path(ffmpeg).with_name('ffprobe.exe')
    return str(fp) if fp.exists() else (shutil.which('ffprobe') or 'ffprobe')


def ff(ffmpeg, args):
    r = subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y'] + args,
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode != 0:
        raise SystemExit('ffmpeg 失敗：' + r.stderr[-2000:])


def media_len(ffprobe, path):
    r = subprocess.run([ffprobe, '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(path)],
                       capture_output=True, text=True, encoding='utf-8')
    return float(json.loads(r.stdout)['format']['duration'])


def probe(ffprobe, path):
    r = subprocess.run([ffprobe, '-v', 'error', '-show_entries',
                        'format=duration,size:stream=codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels,nb_frames',
                        '-of', 'json', str(path)], capture_output=True, text=True, encoding='utf-8')
    return json.loads(r.stdout)


def build_track(ffmpeg, segs, out):
    """segs：[(音檔或 None, 秒數)]，依序接成一條 48 kHz 立體聲音軌；每段旁白從 LEAD 秒開始，其餘補靜音。"""
    total_n = sum(round(d * SR) for _, d in segs)
    files = [(p, d) for p, d in segs]
    if not any(p for p, _ in files):
        ff(ffmpeg, ['-f', 'lavfi', '-i', 'anullsrc=r=%d:cl=stereo' % SR, '-af', 'atrim=end_sample=%d' % total_n,
                    '-c:a', 'pcm_s16le', str(out)])
        return
    ins, parts, labels, k = [], [], [], 0
    ms = int(round(LEAD * 1000))
    for j, (p, d) in enumerate(files):
        n = round(d * SR)
        if p:
            ins += ['-i', str(p)]
            parts.append('[%d:a]aformat=sample_fmts=fltp:sample_rates=%d:channel_layouts=stereo,adelay=%d:all=1,'
                         'apad,atrim=end_sample=%d,asetpts=N/SR/TB[a%d]' % (k, SR, ms, n, j))
            k += 1
        else:
            parts.append('anullsrc=r=%d:cl=stereo,aformat=sample_fmts=fltp,atrim=end_sample=%d,asetpts=N/SR/TB[a%d]' % (SR, n, j))
        labels.append('[a%d]' % j)
    fc = ';'.join(parts) + ';' + ''.join(labels) + 'concat=n=%d:v=0:a=1[out]' % len(files)
    fcf = BUILD / 'track-filter.txt'
    fcf.write_text(fc, encoding='utf-8')
    ff(ffmpeg, ins + ['-filter_complex_script', str(fcf), '-map', '[out]', '-c:a', 'pcm_s16le', '-ar', str(SR), str(out)])


# ---------------------------------------------------------------- 最小 WebSocket 用戶端（RFC 6455，只做 CDP 需要的）
class WS:
    GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

    def __init__(self, url, timeout=120):
        u = urllib.parse.urlparse(url)
        self.sock = socket.create_connection((u.hostname, u.port), timeout=timeout)
        self.sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        key = base64.b64encode(os.urandom(16)).decode()
        req = ('GET %s HTTP/1.1\r\nHost: %s:%d\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
               'Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n' % (u.path or '/', u.hostname, u.port, key))
        self.sock.sendall(req.encode('ascii'))
        self.buf = bytearray()
        while b'\r\n\r\n' not in self.buf:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise ConnectionError('WebSocket 握手時連線中斷')
            self.buf += chunk
        head, _, rest = bytes(self.buf).partition(b'\r\n\r\n')
        self.buf = bytearray(rest)
        lines = head.decode('latin-1').split('\r\n')
        if ' 101 ' not in lines[0] + ' ':
            raise ConnectionError('WebSocket 握手失敗：' + lines[0])
        want = base64.b64encode(hashlib.sha1((key + self.GUID).encode()).digest()).decode()
        hdr = {l.split(':', 1)[0].strip().lower(): l.split(':', 1)[1].strip() for l in lines[1:] if ':' in l}
        if hdr.get('sec-websocket-accept') != want:
            raise ConnectionError('WebSocket 握手：Sec-WebSocket-Accept 不對')

    @staticmethod
    def _mask(data, key):
        n = len(data)
        if not n:
            return b''
        k = (key * (n // 4 + 1))[:n]
        return (int.from_bytes(data, 'little') ^ int.from_bytes(k, 'little')).to_bytes(n, 'little')

    def _send_frame(self, opcode, payload):
        n = len(payload)
        head = bytearray([0x80 | opcode])
        if n < 126:
            head.append(0x80 | n)
        elif n < 65536:
            head.append(0x80 | 126)
            head += struct.pack('!H', n)
        else:
            head.append(0x80 | 127)
            head += struct.pack('!Q', n)
        key = os.urandom(4)
        self.sock.sendall(bytes(head) + key + self._mask(payload, key))

    def send(self, text):
        self._send_frame(0x1, text.encode('utf-8'))

    def _exact(self, n):
        while len(self.buf) < n:
            chunk = self.sock.recv(max(1 << 20, n - len(self.buf)))
            if not chunk:
                raise ConnectionError('WebSocket 連線中斷')
            self.buf += chunk
        out = bytes(self.buf[:n])
        del self.buf[:n]
        return out

    def recv(self):
        parts, first_op = [], None
        while True:
            b0, b1 = self._exact(2)
            fin, op = b0 & 0x80, b0 & 0x0F
            n = b1 & 0x7F
            if n == 126:
                n = struct.unpack('!H', self._exact(2))[0]
            elif n == 127:
                n = struct.unpack('!Q', self._exact(8))[0]
            key = self._exact(4) if b1 & 0x80 else None
            data = self._exact(n)
            if key:
                data = self._mask(data, key)
            if op == 0x9:            # ping → pong
                self._send_frame(0xA, data)
                continue
            if op == 0xA:
                continue
            if op == 0x8:
                raise ConnectionError('WebSocket 被對方關閉')
            if op in (0x1, 0x2):
                first_op, parts = op, [data]
            elif op == 0x0:
                parts.append(data)
            if fin:
                return b''.join(parts).decode('utf-8') if first_op == 0x1 else b''.join(parts)

    def close(self):
        try:
            self._send_frame(0x8, b'')
        except OSError:
            pass
        try:
            self.sock.close()
        except OSError:
            pass


class CDP:
    def __init__(self, ws_url):
        self.ws = WS(ws_url)
        self.n = 0
        self.errors = []

    def call(self, method, **params):
        self.n += 1
        mid = self.n
        self.ws.send(json.dumps({'id': mid, 'method': method, 'params': params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get('id') == mid:
                if 'error' in msg:
                    raise RuntimeError('%s 失敗：%s' % (method, msg['error']))
                self._raise()
                return msg.get('result', {})
            if msg.get('method') == 'Runtime.exceptionThrown':
                d = msg['params']['exceptionDetails']
                ex = d.get('exception') or {}
                self.errors.append('%s %s（%s:%s）' % (d.get('text', ''), ex.get('description', ''), d.get('url', ''), d.get('lineNumber', '')))

    def _raise(self):
        if self.errors:
            raise RuntimeError('頁面的 JS 例外：\n  ' + '\n  '.join(self.errors))

    def eval(self, expr):
        r = self.call('Runtime.evaluate', expression=expr, returnByValue=True)
        if 'exceptionDetails' in r:
            d = r['exceptionDetails']
            raise RuntimeError('執行「%s」出錯：%s' % (expr, (d.get('exception') or {}).get('description') or d.get('text')))
        return r.get('result', {}).get('value')

    def close(self):
        self.ws.close()


# ---------------------------------------------------------------- headless Chrome
def find_browser():
    """沿用 app/tools/shoot-app.py 的 CANDIDATES／find_browser。"""
    try:
        spec = importlib.util.spec_from_file_location('shootapp', SHOOT_APP)
        sa = importlib.util.module_from_spec(spec)
        # 它載入時會把 sys.stdout.buffer 包成新的 TextIOWrapper；那個包裝被回收時會關掉底下的 buffer，
        # 所以載入期間先給它一個假的 stdout，載完換回我們的
        saved = sys.stdout
        sys.stdout = io.TextIOWrapper(io.BytesIO(), encoding='utf-8')
        try:
            spec.loader.exec_module(sa)
        finally:
            sys.stdout = saved
        return sa.find_browser()
    except Exception as e:
        print('載入 shoot-app.py 失敗（%s），改用內建清單' % e)
        for c in (r'C:\Program Files\Google\Chrome\Application\chrome.exe',
                  r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
                  r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
                  shutil.which('google-chrome') or '', shutil.which('chromium') or '', shutil.which('chrome') or ''):
            if c and Path(c).exists():
                return c
    return None


class Stage:
    """開一個自己的 headless Chrome，載入 anim/index.html；seek(t) 後截圖。"""

    def __init__(self, fmt='png'):
        self.fmt = fmt
        self.proc = None
        self.prof = None
        self.cdp = None

    def __enter__(self):
        chrome = find_browser()
        if not chrome:
            raise SystemExit('找不到 Chrome 或 Edge。')
        self.prof = tempfile.mkdtemp(prefix='yoxi-anim-')
        self.proc = subprocess.Popen(
            [chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
             '--user-data-dir=' + self.prof, '--force-device-scale-factor=1', '--window-size=%d,%d' % (W, H),
             '--no-first-run', '--no-default-browser-check', '--mute-audio',
             '--remote-debugging-port=0', 'about:blank'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        port_file = Path(self.prof) / 'DevToolsActivePort'
        t0 = time.time()
        while True:
            if port_file.exists():
                lines = port_file.read_text(encoding='utf-8', errors='replace').split('\n')
                if len(lines) >= 2 and lines[0].strip().isdigit():
                    self.port = int(lines[0])
                    self.browser_path = lines[1].strip()
                    break
            if self.proc.poll() is not None:
                raise SystemExit('Chrome 啟動就結束了（exit %s）' % self.proc.returncode)
            if time.time() - t0 > 30:
                raise SystemExit('等不到 Chrome 的 DevToolsActivePort')
            time.sleep(0.05)
        ws = None
        while ws is None:
            c = http.client.HTTPConnection('127.0.0.1', self.port, timeout=10)
            c.request('GET', '/json')
            pages = json.loads(c.getresponse().read().decode('utf-8'))
            c.close()
            ws = next((p['webSocketDebuggerUrl'] for p in pages if p.get('type') == 'page' and p.get('webSocketDebuggerUrl')), None)
            if ws is None:
                if time.time() - t0 > 30:
                    raise SystemExit('Chrome 沒有 page target')
                time.sleep(0.1)
        self.cdp = CDP(ws)
        self.cdp.call('Page.enable')
        self.cdp.call('Runtime.enable')
        self.cdp.call('Emulation.setDeviceMetricsOverride', width=W, height=H, deviceScaleFactor=1, mobile=False)
        self.cdp.call('Page.navigate', url=INDEX_HTML.as_uri())
        t1 = time.time()
        while True:
            err = self.cdp.eval("document.documentElement.getAttribute('data-error')")
            if err:
                raise RuntimeError('anim/index.html 回報錯誤（data-error）：' + err)
            if self.cdp.eval("document.readyState === 'complete' && document.documentElement.getAttribute('data-ready')") == '1':
                break
            if time.time() - t1 > 90:
                raise RuntimeError('anim/index.html 等了 90 秒還沒有 data-ready')
            time.sleep(0.1)
        dur = self.cdp.eval('ANIM.duration')
        print('Chrome 就緒（%.1f 秒）：%s，ANIM.duration = %s' % (time.time() - t0, Path(chrome).name, dur))
        return self

    def shot(self, t, fmt=None):
        fmt = fmt or self.fmt
        self.cdp.eval('ANIM.seek(%.6f); 1' % t)
        if fmt == 'png':
            r = self.cdp.call('Page.captureScreenshot', format='png', optimizeForSpeed=True)
        else:
            r = self.cdp.call('Page.captureScreenshot', format='jpeg', quality=95, optimizeForSpeed=True)
        return base64.b64decode(r['data'])

    def __exit__(self, *exc):
        if self.cdp:
            try:
                bw = CDP('ws://127.0.0.1:%d%s' % (self.port, self.browser_path))
                bw.ws.send(json.dumps({'id': 1, 'method': 'Browser.close', 'params': {}}))
                bw.close()
            except Exception:
                pass
            self.cdp.close()
        if self.proc:
            try:
                self.proc.wait(timeout=15)
            except subprocess.TimeoutExpired:
                self.proc.kill()           # 只殺我們自己開的這一個
                self.proc.wait(timeout=10)
        for _ in range(20):
            shutil.rmtree(self.prof, ignore_errors=True)
            if not Path(self.prof).exists():
                break
            time.sleep(0.25)
        return False


# ---------------------------------------------------------------- timeline
def make_timeline(data, gcalc, speech, fps, estimated):
    shots = data['shots']
    t, out = 0.0, []
    for i, (s, sp) in enumerate(zip(shots, speech), 1):
        dur = round(LEAD + sp + TAIL + float(s.get('hold', 0)), 2)
        start = round(t, 2)
        end = round(start + dur, 2)
        # 字幕：依字數在旁白長度內分配（絕對秒數）
        weights = [max(1, len(x)) for x in s['narration']]
        tot = float(sum(weights))
        subs, a = [], start + LEAD
        for k, (x, wgt) in enumerate(zip(s['narration'], weights)):
            b = start + LEAD + sp if k == len(weights) - 1 else a + sp * wgt / tot
            subs.append({'t0': round(a, 2), 't1': round(b, 2), 'text': x})
            a = b
        out.append({'i': i, 'id': s['id'], 'scene': s['scene'], 'section': s['section'], 'theme': s['theme'],
                    'start': start, 'dur': dur, 'end': end, 'speech': round(sp, 2), 'hold': float(s.get('hold', 0)),
                    'narration': list(s['narration']), 'caption': s['caption'], 'subs': subs,
                    'calc': dict(s.get('calc') or {})})
        t = end
    return {'fps': fps, 'lead': LEAD, 'tail': TAIL, 'fade': FADE, 'total': round(t, 2), 'estimated': estimated,
            'calc': gcalc, 'shots': out}


def write_timeline(tl):
    body = json.dumps(tl, ensure_ascii=False, indent=1)
    src = '依字數估計的秒數（--no-tts）' if tl['estimated'] else '依旁白音檔實測的秒數'
    TIMELINE_JS.write_text('/* 由 build-video.py 產生，不要手改（改 shots.json 再重跑）。%s。 */\nwindow.TIMELINE = %s;\n'
                           % (src, body), encoding='utf-8')


# ---------------------------------------------------------------- 文件：script.md 區塊、storyboard.html、draft.srt
def tc(t, ms=False):
    m, s = divmod(t, 60)
    if ms:
        h, m = divmod(int(m), 60)
        msec = int(round(t * 1000)) % 1000
        return '%02d:%02d:%02d,%03d' % (h, m, int(s), msec)
    return '%d:%04.1f' % (int(m), s)


def write_srt(tl):
    lines, n = [], 1
    for s in tl['shots']:
        for x in s['subs']:
            lines.append('%d\n%s --> %s\n%s\n' % (n, tc(x['t0'], True), tc(x['t1'], True), x['text']))
            n += 1
    (OUT / 'draft.srt').write_text('\n'.join(lines), encoding='utf-8')


def time_source(tl, audio_dir):
    if tl['estimated']:
        return '估計（沒有 TTS，依字數 4.6 字／秒估）'
    if audio_dir:
        return '實測（真人配音 %s ＋ TTS 補缺；前後留白 %.2f／%.2f 秒）' % (audio_dir, LEAD, TAIL)
    return '實測（TTS wav 長度＋前後留白 %.2f／%.2f 秒）' % (LEAD, TAIL)


def write_script_md(data, tl, audio_dir):
    shots = data['shots']
    T = tl['shots']
    total = tl['total']
    cell = lambda x: x.replace('|', '／').replace('\n', ' ')
    rows = ['| # | 時間碼 | 段落 | 場景 | 旁白 | 字幕（caption） | 畫面（visual） | 備註 |',
            '|---|---|---|---|---|---|---|---|']
    for s, t in zip(shots, T):
        note = s.get('note', '')
        calc = calc_lines(s)
        if calc:
            note = (note + ' 算式：' + '；'.join(calc)).strip()
        if s.get('hold'):
            note = (note + ' hold %.1f 秒。' % float(s['hold'])).strip()
        rows.append('| %d | %s–%s | %s | `%s` | %s | %s | %s | %s |' % (
            t['i'], tc(t['start']), tc(t['end']), s['section'], s['scene'], cell('<br>'.join(s['narration'])),
            cell(s['caption']), cell(s.get('visual', '')), cell(note)))
    secs, order = {}, []
    for t in T:
        if t['section'] not in secs:
            secs[t['section']] = [t['start'], t['end']]
            order.append(t['section'])
        secs[t['section']][1] = t['end']
    sec_rows = ['| 段落 | 時間 | 長度 |', '|---|---|---|'] + [
        '| %s | %s–%s | %.1f 秒 |' % (k, tc(secs[k][0]), tc(secs[k][1]), secs[k][1] - secs[k][0]) for k in order]
    block = '\n'.join([
        '<!-- BEGIN:shots（本段由 build-video.py 從 shots.json 重寫，不要手改；改 shots.json 再重跑） -->',
        '',
        '**總長 %s（%.1f 秒），%d 個鏡頭。時間碼來源：%s。**' % (tc(total), total, len(shots), time_source(tl, audio_dir)),
        '',
        '### 段落小計', '', *sec_rows, '',
        '### 分鏡表', '', *rows, '',
        '### 旁白全文（照順序唸，一格一段；真人配音一格錄一個檔，檔名 `NN-<id>.wav`）', '',
        *['%d. `%02d-%s` %s' % (t['i'], t['i'], t['id'], ''.join(t['narration'])) for t in T], '',
        '<!-- END:shots -->'])
    md = SCRIPT_MD.read_text(encoding='utf-8')
    if '<!-- BEGIN:shots' not in md:
        raise SystemExit('script.md 找不到 <!-- BEGIN:shots --> 區塊')
    md = re.sub(r'<!-- BEGIN:shots.*?<!-- END:shots -->', lambda m: block, md, flags=re.S)
    SCRIPT_MD.write_text(md, encoding='utf-8')


def board_name(t):
    return '%02d-%s.png' % (t['i'], t['id'])


def write_storyboard(data, tl, audio_dir):
    shots = data['shots']
    total = tl['total']
    e = html.escape
    cells = []
    for s, t in zip(shots, tl['shots']):
        calc = ''.join('<li>%s</li>' % e(l) for l in calc_lines(s))
        cells.append('''
<article class="shot">
  <img src="out/board/%s" alt="#%d %s" width="480" height="270" loading="lazy">
  <div class="meta">
    <p class="tc"><b>#%d</b> %s–%s <span>%.1f 秒</span></p>
    <p><span class="sec">%s</span> <code class="scene">%s</code> <span class="theme">%s</span></p>
    <p class="cap">%s</p>
    <p class="nar">%s</p>
    <p class="vis">%s</p>
    %s
    %s
  </div>
</article>''' % (board_name(t), t['i'], e(t['id']), t['i'], tc(t['start']), tc(t['end']), t['dur'],
                 e(s['section']), e(s['scene']), '深色' if s['theme'] == 'dark' else '淺色', e(s['caption']),
                 '<br>'.join(e(x) for x in s['narration']), e(s.get('visual', '')),
                 ('<ul class="calc">%s</ul>' % calc) if calc else '',
                 ('<p class="note">%s</p>' % e(s['note'])) if s.get('note') else ''))
    page = '''<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>遊喜樂影片分鏡</title>
<!-- 由 pitch/video/build-video.py 從 shots.json 產生，不要手改。縮圖＝向量動畫在每格 %d%% 處的畫面（out/board/）。顏色讀 prototype/css/tokens.css 的變數。 -->
<link rel="stylesheet" href="../../prototype/css/tokens.css">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--yoxi-mist); color: var(--yoxi-navy);
         font-family: "Noto Sans TC", "Microsoft JhengHei", "PingFang TC", sans-serif; }
  header { background: var(--yoxi-red); color: var(--yoxi-white); padding: var(--sp-6) var(--gutter); }
  header h1 { margin: 0 0 var(--sp-2); font-size: var(--fs-h1); }
  header p { margin: 0; font-size: var(--fs-sm); opacity: .92; }
  main { max-width: 1440px; margin: 0 auto; padding: var(--sp-5) var(--gutter) var(--sp-7);
         display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%%, 420px), 1fr)); gap: var(--sp-5); }
  .shot { background: var(--yoxi-paper); border-radius: var(--r-card); box-shadow: var(--sh-card); overflow: hidden; }
  .shot img { display: block; width: 100%%; height: auto; aspect-ratio: 16 / 9; background: var(--yoxi-navy); }
  .meta { padding: var(--sp-4); }
  .meta p { margin: 0 0 var(--sp-2); }
  .tc { font-size: var(--fs-sm); color: var(--yoxi-slate); }
  .tc b { color: var(--yoxi-navy); }
  .tc span { float: right; }
  .sec { display: inline-block; font-size: var(--fs-xs); font-weight: var(--fw-bold); color: var(--yoxi-red);
         background: var(--yoxi-red-soft); border-radius: var(--r-pill); padding: 2px var(--sp-2); }
  .scene { font-size: var(--fs-xs); color: var(--yoxi-slate); }
  .theme { font-size: var(--fs-xs); color: var(--yoxi-slate); }
  .cap { font-size: var(--fs-lead); font-weight: var(--fw-heavy); line-height: var(--lh-tight); }
  .nar { font-size: var(--fs-sm); line-height: var(--lh-body); border-left: 3px solid var(--yoxi-line); padding-left: var(--sp-2); }
  .vis { font-size: var(--fs-cap); color: var(--yoxi-slate); line-height: var(--lh-body); }
  .calc { margin: 0 0 var(--sp-2); padding-left: var(--sp-4); color: var(--yoxi-red); font-size: var(--fs-cap); font-weight: var(--fw-bold); }
  .note { font-size: var(--fs-cap); color: var(--yoxi-slate); }
</style>
</head>
<body>
<header>
  <h1>遊喜樂 · 方案說明影片分鏡</h1>
  <p>總長 %s（%.1f 秒，%s），%d 個鏡頭 · 上限 3:00 · 向量動畫（pitch/video/anim/）· 旁白與數字的真相在 shots.json／script.md</p>
</header>
<main>%s
</main>
</body>
</html>
''' % (round(BOARD_AT * 100), tc(total), total, time_source(tl, audio_dir), len(shots), ''.join(cells))
    BOARD_HTML.write_text(page, encoding='utf-8')


# ---------------------------------------------------------------- 截圖 → ffmpeg
def plan_frames(tl, idx, fps):
    """把選到的格接成一條時鐘：回傳 [(影片時間 T, 動畫時間 t)]、選到的格、總秒數。"""
    sel = [tl['shots'][i - 1] for i in idx]
    offs, o = [], 0.0
    for s in sel:
        offs.append(o)
        o += s['dur']
    total = o
    n = int(math.ceil(total * fps - 1e-6))
    frames, j = [], 0
    for k in range(n):
        T = k / fps
        while j + 1 < len(sel) and T >= offs[j + 1] - 1e-9:
            j += 1
        frames.append(min(sel[j]['start'] + (T - offs[j]), tl['total'] - 1e-3))
    return frames, sel, total


def render_video(stage, ffmpeg, frames, fps, track, dur, out, fmt):
    log = BUILD / 'ffmpeg-encode.log'
    codec = 'png' if fmt == 'png' else 'mjpeg'
    cmd = [ffmpeg, '-hide_banner', '-loglevel', 'error', '-y',
           '-f', 'image2pipe', '-c:v', codec, '-framerate', str(fps), '-i', '-',
           '-i', str(track), '-map', '0:v', '-map', '1:a',
           '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
           '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', str(fps),
           '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
           '-c:a', 'aac', '-b:a', '160k', '-ar', str(SR), '-ac', '2',
           '-t', '%.3f' % dur, '-movflags', '+faststart', str(out)]
    with open(log, 'w', encoding='utf-8') as lf:
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=lf, stdout=subprocess.DEVNULL)
        q = queue.Queue(maxsize=16)
        werr = []

        def writer():
            try:
                while True:
                    b = q.get()
                    if b is None:
                        break
                    proc.stdin.write(b)
            except Exception as e:  # ffmpeg 掛了
                werr.append(e)
            finally:
                try:
                    proc.stdin.close()
                except OSError:
                    pass
        th = threading.Thread(target=writer, daemon=True)
        th.start()
        t0 = time.time()
        nbytes = 0
        try:
            for k, t in enumerate(frames, 1):
                b = stage.shot(t, fmt)
                nbytes += len(b)
                if werr:
                    break
                q.put(b)
                if k % 60 == 0 or k == len(frames):
                    el = time.time() - t0
                    print('  幀 %5d/%d  t=%6.1f 秒  %.1f 幀／秒  （平均 %d KB／幀）' % (k, len(frames), t, k / el, nbytes / k / 1024))
        finally:
            q.put(None)
            th.join()
            rc = proc.wait()
    el = time.time() - t0
    if werr or rc != 0:
        raise SystemExit('ffmpeg 編碼失敗（exit %s）：%s\n%s' % (rc, werr, log.read_text(encoding='utf-8', errors='replace')[-2000:]))
    return el


def save_png(data, path, size=None):
    from PIL import Image
    path.parent.mkdir(parents=True, exist_ok=True)
    if size is None:
        path.write_bytes(data)
        return
    with Image.open(io.BytesIO(data)) as im:
        im.convert('RGB').resize(size, Image.LANCZOS).save(path, optimize=True)


def shoot_board(stage, tl, idx):
    BOARD.mkdir(parents=True, exist_ok=True)
    for i in idx:
        t = tl['shots'][i - 1]
        save_png(stage.shot(t['start'] + t['dur'] * BOARD_AT, 'png'), BOARD / board_name(t), BOARD_SIZE)
    print('分鏡縮圖：%d 張 → %s' % (len(idx), BOARD.relative_to(ROOT)))


def run_check(stage, tl):
    """每格中間那一秒：截一次 → 跳到別的地方（含倒退）截一次 → 跳回來再截；bytes 要相同。"""
    ok, bad = 0, []
    total = tl['total']
    for s in tl['shots']:
        t = round(s['start'] + s['dur'] * 0.5, 3)
        a = stage.shot(t, 'png')
        stage.shot((t + total * 0.37) % total, 'png')
        stage.shot(max(0.0, t - 3.3), 'png')
        b = stage.shot(t, 'png')
        if a == b:
            ok += 1
            print('  #%02d t=%7.3f  %s  %d bytes  相同' % (s['i'], t, hashlib.sha1(a).hexdigest()[:12], len(a)))
        else:
            from PIL import Image, ImageChops
            with Image.open(io.BytesIO(a)) as ia, Image.open(io.BytesIO(b)) as ib:
                diff = ImageChops.difference(ia.convert('RGB'), ib.convert('RGB')).getbbox()
            bad.append((s['i'], t, diff))
            print('  #%02d t=%7.3f  不同！差異範圍 %s' % (s['i'], t, diff))
    print('--check：%d/%d 格同一個 t 兩次截圖 bytes 相同' % (ok, len(tl['shots'])))
    return not bad


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
    ap = argparse.ArgumentParser(description='遊喜樂影片（向量動畫）產生管線；說明見檔頭。')
    ap.add_argument('--no-tts', action='store_true', help='不跑 TTS，靜音＋依字數估秒數')
    ap.add_argument('--rate', type=int, default=2, help='TTS 語速（-10～10，預設 2）')
    ap.add_argument('--only', default='', help='只算這些格，例如 3,5-7 → out/preview.mp4')
    ap.add_argument('--fps', type=int, default=30, help='幀率（預設 30）')
    ap.add_argument('--frame', default='', help='只截這幾秒，逗號分隔 → out/frames/')
    ap.add_argument('--docs', action='store_true', help='只寫 timeline.js／script.md／storyboard.html／srt')
    ap.add_argument('--board', action='store_true', help='只重截分鏡縮圖')
    ap.add_argument('--check', action='store_true', help='同一格截兩次比 bytes')
    ap.add_argument('--audio-dir', default='', help='真人配音資料夾：NN-<id>.wav／.m4a／.mp3')
    ap.add_argument('--jpeg', action='store_true', help='截圖用 JPEG q95 取代 PNG（較快、有極輕微壓縮）')
    a = ap.parse_args()

    data = load()
    shots = data['shots']
    gcalc = global_calc(shots)
    errs, warns = check(data, gcalc)
    if warns:
        print('注意：這些場景是動態註冊（scenes-*.js 找不到 ANIM.scene("名字"），只確認檔內有這個名字字串：' + '、'.join(warns))
    if errs:
        print('鏡頭表檢查沒過：')
        for x in errs:
            print('  ' + x)
        return 1
    print('鏡頭表檢查：%d 格，禁用詞 0、每句 ≤ %d 字、公式數字對得上、Noto Sans TC 不缺字、場景都有註冊。' % (len(shots), MAX_SENT))
    OUT.mkdir(exist_ok=True)
    BUILD.mkdir(parents=True, exist_ok=True)

    ffmpeg = find_ffmpeg()
    audio_dir = Path(a.audio_dir).resolve() if a.audio_dir else None
    if audio_dir and not audio_dir.is_dir():
        print('--audio-dir 不是資料夾：%s' % audio_dir)
        return 1
    if audio_dir and not ffmpeg:
        print('--audio-dir 需要 ffprobe（跟 ffmpeg 一起）')
        return 1

    # 每格的旁白音檔與長度
    use_tts = not a.no_tts
    voice = [None] * len(shots)
    if audio_dir:
        ffprobe = find_ffprobe(ffmpeg)
        for i, s in enumerate(shots, 1):
            voice[i - 1] = find_voice_file(audio_dir, i, s)
            if voice[i - 1] is None:
                print('注意：%s 沒有 %02d-%s.wav／.m4a／.mp3，這格退回 %s' % (audio_dir, i, s['id'], 'TTS' if use_tts else '字數估計'))
    need_tts = [s for s, v in zip(shots, voice) if v is None]
    if use_tts and need_tts:
        if not run_tts(need_tts, a.rate):
            print('TTS 失敗；改用 --no-tts 可先產靜音版。')
            return 1
        keep = {wav_path(s, a.rate).name for s in shots}    # 清掉舊文字／舊語速留下的 wav
        for w in BUILD.glob('*.wav'):
            if w.name not in keep and w.name != 'track.wav':
                w.unlink()
    speech = []
    for i, s in enumerate(shots):
        if voice[i] is not None:
            speech.append(media_len(ffprobe, voice[i]))
        elif use_tts:
            voice[i] = wav_path(s, a.rate)
            speech.append(wav_len(voice[i]))
        else:
            speech.append(est_len(s))
    estimated = not use_tts and not any(voice)

    tl = make_timeline(data, gcalc, speech, a.fps, estimated)
    write_timeline(tl)
    write_script_md(data, tl, audio_dir)
    write_storyboard(data, tl, audio_dir)
    write_srt(tl)
    print('已寫：anim/timeline.js、script.md 分鏡表、storyboard.html、out/draft.srt（總長 %s，%.2f 秒%s）'
          % (tc(tl['total']), tl['total'], '，估計' if estimated else ''))
    if tl['total'] > LIMIT:
        print('總長超過 %d 秒上限！' % LIMIT)
        return 1
    if a.docs:
        return 0

    fmt = 'jpeg' if a.jpeg else 'png'
    try:
        with Stage(fmt) as stage:
            if a.frame:
                FRAMES.mkdir(parents=True, exist_ok=True)
                for x in a.frame.split(','):
                    t = float(x)
                    p = FRAMES / ('t%05.1f.png' % t)
                    save_png(stage.shot(t, 'png'), p)
                    print('截圖 t=%.2f（#%d）→ %s' % (t, stage.cdp.eval('ANIM.shotAt(%f).i' % t), p.relative_to(ROOT)))
                return 0
            if a.check:
                return 0 if run_check(stage, tl) else 1
            idx = parse_only(a.only, len(shots)) if a.only else list(range(1, len(shots) + 1))
            if a.board:
                shoot_board(stage, tl, idx)
                return 0
            if not ffmpeg:
                print('找不到 ffmpeg。')
                return 1
            frames, sel, dur = plan_frames(tl, idx, a.fps)
            track = BUILD / 'track.wav'
            build_track(ffmpeg, [(voice[s['i'] - 1], s['dur']) for s in sel], track)
            out = OUT / ('preview.mp4' if a.only else 'draft.mp4')
            print('逐格截圖 → ffmpeg：%d 格、%d 幀（%d fps、%.2f 秒、%s）' % (len(sel), len(frames), a.fps, dur, fmt.upper()))
            el = render_video(stage, ffmpeg, frames, a.fps, track, dur, out, fmt)
            print('截圖＋編碼 %.1f 秒（%.1f 幀／秒）' % (el, len(frames) / el))
            shoot_board(stage, tl, idx)
    except (RuntimeError, ConnectionError) as e:
        print('Chrome 那邊出錯：%s' % e)
        return 1

    ffprobe = find_ffprobe(ffmpeg)
    info = probe(ffprobe, out)
    fdur = float(info['format']['duration'])
    v = [st for st in info['streams'] if st.get('codec_type') == 'video'][0]
    au = [st for st in info['streams'] if st.get('codec_type') == 'audio']
    print('輸出 %s（%.1f MB）' % (out.relative_to(ROOT), int(info['format']['size']) / 1e6))
    print('  ffprobe：%.2f 秒（%s）、%dx%d、%s、%s fps、%s 幀；音訊 %s' % (
        fdur, tc(fdur), v['width'], v['height'], v['codec_name'], v['r_frame_rate'], v.get('nb_frames', '?'),
        ('%s %s Hz %s 聲道' % (au[0]['codec_name'], au[0].get('sample_rate'), au[0].get('channels'))) if au else '無'))
    if abs(fdur - dur) > 0.1:
        print('注意：成片長度 %.2f 與預計 %.2f 差超過 0.1 秒' % (fdur, dur))
    if fdur > LIMIT:
        print('超過 %d 秒上限！' % LIMIT)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
