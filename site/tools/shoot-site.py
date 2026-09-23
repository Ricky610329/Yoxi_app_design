# -*- coding: utf-8 -*-
"""
介紹網站的截圖工具：用 headless Chrome（DevTools 協定，借 pitch/video/build-video.py 的 WS／CDP／find_browser）
對 site/index.html 的每一段截圖，給人或 agent 用 Read 看圖檢查版面。

    python site/tools/shoot-site.py                       每一段一張（捲到該段頂）＋整頁一張 → site/tools/.shots/
    python site/tools/shoot-site.py --only explore,fare   只截這些段
    python site/tools/shoot-site.py --y 5200 --name mid   捲到某個像素截一張
    python site/tools/shoot-site.py --js "document.querySelector('#w-fare input').value=28;..." --name fare-28
                                                          先跑一段 JS（做互動狀態）再截
    python site/tools/shoot-site.py --w 390 --h 800       手機寬度
    python site/tools/shoot-site.py --no-full             不截整頁

載入時帶 ?reveal=all&nomotion=1，所以 reveal 全部顯示、沒有平滑捲動。輸出目錄不進版控（site/.gitignore）。
不關任何瀏覽器程序；只開自己的 --user-data-dir。
"""
import argparse, base64, importlib.util, io, json, subprocess, sys, tempfile, time, http.client, shutil
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
INDEX = HERE.parent / 'index.html'
OUT = HERE / '.shots'
BUILD_VIDEO = ROOT / 'pitch' / 'video' / 'build-video.py'

SECTIONS = ['top', 'why', 'idea', 'story-a', 'explore', 'fare', 'story-b', 'story-c', 'ai', 'promises', 'roadmap', 'video', 'more']


def load_bv():
    spec = importlib.util.spec_from_file_location('buildvideo', BUILD_VIDEO)
    m = importlib.util.module_from_spec(spec)
    saved = sys.stdout
    sys.stdout = io.TextIOWrapper(io.BytesIO(), encoding='utf-8')
    try:
        spec.loader.exec_module(m)
    finally:
        sys.stdout = saved
    return m


class Browser:
    def __init__(self, bv, w, h):
        self.bv, self.w, self.h = bv, w, h

    def __enter__(self):
        chrome = self.bv.find_browser()
        if not chrome:
            raise SystemExit('找不到 Chrome 或 Edge。')
        self.prof = tempfile.mkdtemp(prefix='yoxi-site-')
        self.proc = subprocess.Popen(
            [chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
             '--user-data-dir=' + self.prof, '--force-device-scale-factor=1', '--window-size=%d,%d' % (self.w, self.h),
             '--no-first-run', '--no-default-browser-check', '--mute-audio', '--remote-debugging-port=0', 'about:blank'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        port_file = Path(self.prof) / 'DevToolsActivePort'
        t0 = time.time()
        while True:
            if port_file.exists():
                lines = port_file.read_text(encoding='utf-8', errors='replace').split('\n')
                if len(lines) >= 2 and lines[0].strip().isdigit():
                    self.port = int(lines[0]); self.browser_path = lines[1].strip(); break
            if self.proc.poll() is not None:
                raise SystemExit('Chrome 啟動就結束了')
            if time.time() - t0 > 30:
                raise SystemExit('等不到 DevToolsActivePort')
            time.sleep(0.05)
        ws = None
        while ws is None:
            c = http.client.HTTPConnection('127.0.0.1', self.port, timeout=10)
            c.request('GET', '/json'); pages = json.loads(c.getresponse().read().decode('utf-8')); c.close()
            ws = next((p['webSocketDebuggerUrl'] for p in pages if p.get('type') == 'page' and p.get('webSocketDebuggerUrl')), None)
            if ws is None:
                if time.time() - t0 > 30:
                    raise SystemExit('Chrome 沒有 page target')
                time.sleep(0.1)
        self.cdp = self.bv.CDP(ws)
        self.cdp.call('Page.enable'); self.cdp.call('Runtime.enable')
        self.metrics(self.w, self.h)
        return self

    def metrics(self, w, h):
        self.cdp.call('Emulation.setDeviceMetricsOverride', width=w, height=h, deviceScaleFactor=1, mobile=w < 600)

    def open(self, url):
        self.cdp.call('Page.navigate', url=url)
        t1 = time.time()
        while True:
            if self.cdp.eval("document.readyState === 'complete' && document.documentElement.getAttribute('data-ready')") == '1':
                break
            if time.time() - t1 > 60:
                raise RuntimeError('index.html 等了 60 秒還沒有 data-ready')
            time.sleep(0.1)
        time.sleep(0.4)     # 讓圖片與字型落定

    def shot(self, path):
        r = self.cdp.call('Page.captureScreenshot', format='png', optimizeForSpeed=True)
        path.write_bytes(base64.b64decode(r['data']))
        return path

    def __exit__(self, *exc):
        try:
            bw = self.bv.CDP('ws://127.0.0.1:%d%s' % (self.port, self.browser_path))
            bw.ws.send(json.dumps({'id': 1, 'method': 'Browser.close', 'params': {}})); bw.close()
        except Exception:
            pass
        try:
            self.cdp.close()
        except Exception:
            pass
        try:
            self.proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            self.proc.kill(); self.proc.wait(timeout=10)
        for _ in range(20):
            shutil.rmtree(self.prof, ignore_errors=True)
            if not Path(self.prof).exists():
                break
            time.sleep(0.25)
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--y', type=float, default=None)
    ap.add_argument('--js', default='')
    ap.add_argument('--name', default='')
    ap.add_argument('--w', type=int, default=1440)
    ap.add_argument('--h', type=int, default=900)
    ap.add_argument('--no-full', action='store_true')
    ap.add_argument('--query', default='reveal=all&nomotion=1', help='加在 index.html? 後面的參數')
    a = ap.parse_args()
    bv = load_bv()
    OUT.mkdir(parents=True, exist_ok=True)
    url = INDEX.as_uri() + '?' + a.query
    with Browser(bv, a.w, a.h) as b:
        b.open(url)
        errs = list(b.cdp.errors)
        if errs:
            print('頁面 JS 例外：'); [print('  ' + e) for e in errs]
        if a.js:
            b.cdp.eval(a.js + '; 1')
            time.sleep(0.5)
        if a.y is not None:
            b.cdp.eval('window.scrollTo(0, %f); 1' % a.y)
            time.sleep(0.5)
            p = b.shot(OUT / ((a.name or ('y%d' % int(a.y))) + '.png'))
            print('截圖', p.relative_to(ROOT))
            return 0
        if a.js and a.name:
            p = b.shot(OUT / (a.name + '.png'))
            print('截圖', p.relative_to(ROOT))
            return 0
        only = [s.strip() for s in a.only.split(',') if s.strip()] if a.only else SECTIONS
        for sid in only:
            ok = b.cdp.eval("(function(){var e=document.getElementById(%s); if(!e) return false; "
                            "window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - %d); return true;})()"
                            % (json.dumps(sid), 0 if sid == 'top' else 64))
            if not ok:
                print('沒有這一段：#' + sid); continue
            time.sleep(0.6)
            p = b.shot(OUT / ('%02d-%s.png' % (SECTIONS.index(sid) if sid in SECTIONS else 99, sid)))
            print('截圖', p.relative_to(ROOT))
        if not a.no_full:
            hgt = int(b.cdp.eval('document.documentElement.scrollHeight'))
            hgt = min(hgt, 16000)
            b.metrics(a.w, hgt)
            b.cdp.eval('window.scrollTo(0,0); 1')
            time.sleep(0.8)
            p = b.shot(OUT / 'full.png')
            print('整頁', p.relative_to(ROOT), '高', hgt)
        errs = [e for e in b.cdp.errors if e not in errs]
        if b.cdp.errors:
            print('頁面 JS 例外：'); [print('  ' + e) for e in b.cdp.errors]
            return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
