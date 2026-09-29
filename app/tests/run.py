# -*- coding: utf-8 -*-
"""
yoxi 城事 web app 的測試總入口。規格：app/ARCHITECTURE.md §6。

    python app/tests/run.py              # 全部：node 單元測試 → headless Chrome 跑 runner.html
    python app/tests/run.py --unit       # 只跑 node --test app/tests/unit/
    python app/tests/run.py --browser    # 只跑瀏覽器測試
    python app/tests/run.py --system-motion  # 保留系統動態偏好再驗完整展示
    python app/tests/run.py --only ride  # 只跑一個 spec（逗號分隔可多個；隱含 --browser）
    python app/tests/run.py --keep       # 把 dump 出來的 DOM 留在 app/tests/.out/
    python app/tests/run.py --app fixtures/mini-app.html   # 換受測頁
    python app/tests/run.py --selftest   # 驗 harness 本身（timeout、例外、only…）

瀏覽器那段沿用 prototype/tools/verify-quiet.py 的做法：headless Chrome
--virtual-time-budget + --dump-dom，把 runner.html 跑完之後 <pre id="result"> 的 JSON 拿回來解析。
exit code 非零表示有 FAIL（或跑不起來）。
"""
import argparse
import io
import json
import re
import shutil
import subprocess
import sys
from html import unescape
from pathlib import Path
from urllib.parse import quote

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HERE = Path(__file__).resolve().parent
OUT = HERE / '.out'

BROWSERS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    shutil.which('google-chrome') or '',
    shutil.which('chromium') or '',
    shutil.which('chrome') or '',
]


def browser():
    for b in BROWSERS:
        if b and Path(b).exists():
            return b
    return None


def width(s):
    """中文字在終端機佔兩格，對齊表格用。"""
    return sum(2 if ord(c) > 0x2e80 else 1 for c in s)


def pad(s, n):
    return s + ' ' * max(0, n - width(s))


# ---------------------------------------------------------------- node
def run_unit():
    print('── 單元測試（node --test app/tests/unit/）' + '─' * 20)
    node = shutil.which('node')
    if not node:
        print('  FAIL  找不到 node（要 node 18+；本 repo 用 node 24 內建的 test runner）')
        return 1
    files = sorted((HERE / 'unit').glob('*.test.mjs'))
    if not files:
        print('  FAIL  app/tests/unit/ 底下沒有 *.test.mjs')
        return 1
    p = subprocess.run([node, '--test', '--test-reporter=spec'] + [str(f) for f in files],
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    text = (p.stdout or '') + (p.stderr or '')
    for line in text.splitlines():
        # node 內部的 stack 行沒有資訊量，只留指到測試檔的
        if re.match(r'\s+at ', line) and 'test.mjs' not in line:
            continue
        print('  ' + line)
    print('  %s  node --test（exit %d）' % ('PASS' if p.returncode == 0 else 'FAIL', p.returncode))
    return 0 if p.returncode == 0 else 1


# ---------------------------------------------------------------- browser
def run_browser(only=None, keep=False, budget=180000, app=None, page='runner.html', system_motion=False):
    print('── 瀏覽器測試（headless Chrome → tests/%s）' % page + '─' * 10)
    exe = browser()
    if not exe:
        print('  FAIL  找不到 Chrome 或 Edge。找過：')
        for b in BROWSERS:
            if b:
                print('          ' + b)
        return 1
    q = []
    if only:
        q.append('only=' + quote(only))
    if app:
        q.append('app=' + quote(app))
    uri = (HERE / page).resolve().as_uri() + ('?' + '&'.join(q) if q else '')
    cmd = [exe, '--headless=new', '--disable-gpu', '--hide-scrollbars',
           '--allow-file-access-from-files', '--force-device-scale-factor=1',
           # 預設驗 no-preference；--system-motion 保留 OS 設定，抓出一般瀏覽器才出現的動畫回歸。
           *([] if system_motion else ['--force-prefers-no-reduced-motion']),
           '--window-size=1280,1000',
           '--virtual-time-budget=%d' % budget, '--dump-dom', uri]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8',
                           errors='replace', timeout=budget / 1000 + 300)
        dom = p.stdout or ''
    except subprocess.TimeoutExpired:
        print('  FAIL  Chrome 超過時間沒有結束')
        return 1
    if keep:
        OUT.mkdir(exist_ok=True)
        name = Path(page).stem + ('-' + re.sub(r'\W+', '_', only) if only else '') + '.html'
        (OUT / name).write_text(dom, encoding='utf-8')
        print('  DOM 存在 %s' % (OUT / name))
    m = re.search(r'<pre id="result">(.*?)</pre>', dom, re.S)
    raw = unescape(m.group(1)).strip() if m else ''
    if not raw:
        print('  FAIL  runner.html 沒有寫出結果：--virtual-time-budget=%d 可能不夠（加 --budget），'
              '或 harness.js 自己壞了；加 --keep 看 DOM。' % budget)
        st = re.search(r'<h1 id="status">(.*?)</h1>', dom, re.S)
        if st:
            print('        最後狀態：' + unescape(st.group(1)))
        return 1
    try:
        res = json.loads(raw)
    except ValueError as e:
        print('  FAIL  結果 JSON 讀不動：%s' % e)
        return 1
    return report(res)


def report(res):
    specs = res.get('specs', [])
    col = max([width(s['name']) for s in specs] + [6]) + 2
    print('        %s%s' % (pad('spec', col), '通過/總數'))
    fails = []
    for s in specs:
        tests = s.get('tests', [])
        ok = sum(1 for t in tests if t.get('ok'))
        mark = 'PASS' if ok == len(tests) else 'FAIL'
        ms = sum(t.get('ms', 0) for t in tests)
        print('  %s  %s%d/%d  (%.1fs)' % (mark, pad(s['name'], col), ok, len(tests), ms / 1000))
        fails += [(s['name'], t) for t in tests if not t.get('ok')]
    # runner.html 登記了、檔案卻不在（改名或刪掉）：那個區塊的測試整個沒跑到，不能算通過
    missing = res.get('missing', [])
    for src in missing:
        print('  FAIL  找不到的 spec 檔：%s（runner.html 有登記，檔案不在）' % src)
    sm = res.get('summary', {})
    if sm.get('crash'):
        print('  FAIL  runner 崩潰：%s' % sm['crash'][:400])
    if fails:
        print('\n  FAIL 明細：')
        for spec, t in fails:
            print('  ✗ [%s] %s' % (spec, t.get('name')))
            for part in t.get('msg', '').split('；')[:12]:
                print('        ' + part[:300])
    print('\n  合計 %d/%d 通過' % (sm.get('pass', 0), sm.get('total', 0)) +
          ('，找不到的 spec 檔 %d 個' % len(missing) if missing else ''))
    return 1 if (sm.get('fail') or sm.get('crash') or missing or not specs) else 0


def main():
    ap = argparse.ArgumentParser(description='yoxi 城事 app 測試')
    ap.add_argument('--unit', action='store_true', help='只跑 node 單元測試')
    ap.add_argument('--browser', action='store_true', help='只跑瀏覽器測試')
    ap.add_argument('--only', help='只跑某個 spec（例 ride；逗號分隔）')
    ap.add_argument('--keep', action='store_true', help='DOM 留在 app/tests/.out/')
    ap.add_argument('--budget', type=int, default=180000, help='--virtual-time-budget 毫秒（預設 180000）')
    ap.add_argument('--app', help='受測頁（相對 tests/，例 fixtures/mini-app.html）')
    ap.add_argument('--selftest', action='store_true', help='驗 harness 本身（fixtures/selftest.html 對 mini-app）')
    ap.add_argument('--system-motion', action='store_true', help='保留系統動態偏好，驗證一般瀏覽器的完整展示')
    a = ap.parse_args()

    if a.selftest:
        print('═' * 64)
        bad = run_browser(keep=a.keep, budget=min(a.budget, 60000), page='fixtures/selftest.html')
        print('═' * 64)
        return 1 if bad else 0

    do_unit = a.unit or not (a.browser or a.only or a.app)
    do_browser = bool(a.browser or a.only or a.app or not a.unit)
    bad = 0
    print('═' * 64)
    print('yoxi 城事 app 測試')
    print('═' * 64)
    if subprocess.run([sys.executable, str(HERE.parent / 'tools' / 'sync-motion.py'), '--check']).returncode:
        return 1
    if do_unit:
        bad += run_unit()
        print()
    if do_browser:
        bad += run_browser(a.only, a.keep, a.budget, a.app, system_motion=a.system_motion)
    print('═' * 64)
    print('未通過。' if bad else '全部通過。')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
