"""檢查 app/sw.js 的 PRECACHE 清單與實際檔案是否一致。

用法：python app/tools/check-sw.py
  1. 清單裡的每個路徑都要存在（'./' 視為 index.html）。缺一個就 FAIL：
     sw 的 install 用 cache.addAll，全有全無，清單裡一個 404 整個安裝就失敗（離線整個不能用）。
  2. app/css、app/js、app/assets/icons、prototype/assets/map、prototype/assets/photos
     底下的檔案都要在清單裡。
  3. index.html 載入的每個檔（<script src>、<link rel=stylesheet／manifest／icon／apple-touch-icon href>，
     含 ../prototype 的共用檔）與 manifest 的 icons 都要在清單裡：不然離線時畫面缺樣式或腳本。
  4. 版本只有一個來源 js/version.js：它定義 self.APP_VERSION、sw.js 用 importScripts 載它、
     sw.js 與 js/views/system.js 都不另外寫死版本字串。
不一致就印出來並 exit 1。
生成的明信片（app/assets/postcards/）刻意不在清單：sw 在執行期 cache-first 存（見 sw.js 檔頭）。
"""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
ROOT = APP.parent
SCAN = [APP / 'css', APP / 'js', APP / 'assets' / 'icons',
        ROOT / 'prototype' / 'assets' / 'map', ROOT / 'prototype' / 'assets' / 'photos']
LINK_RELS = {'stylesheet', 'manifest', 'icon', 'apple-touch-icon'}


class Loads(HTMLParser):
    """收集 index.html 會抓的同源檔：<script src>、<link rel=… href>。"""

    def __init__(self):
        super().__init__()
        self.found = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'script' and a.get('src'):
            self.found.append(('script', a['src']))
        elif tag == 'link' and a.get('href'):
            rels = set((a.get('rel') or '').lower().split())
            if rels & LINK_RELS:
                self.found.append(('link rel=' + ' '.join(sorted(rels & LINK_RELS)), a['href']))


def local(base, href):
    """相對路徑 → 檔案路徑；外部網址、data:、錨點回 None。"""
    href = href.split('#')[0].split('?')[0]
    if not href or re.match(r'^[a-z][a-z0-9+.-]*:', href, re.I) or href.startswith('//'):
        return None
    return (base / href).resolve()


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    src = (APP / 'sw.js').read_text(encoding='utf-8')
    m = re.search(r'PRECACHE:BEGIN(.*?)PRECACHE:END', src, re.S)
    if not m:
        print('sw.js 找不到 PRECACHE:BEGIN／END 標記'); return 1
    entries = re.findall(r"^\s*'([^']+)'", m.group(1), re.M)
    bad = 0

    dup = {e for e in entries if entries.count(e) > 1}
    for e in sorted(dup):
        print(f'  重複：{e}'); bad += 1

    listed = set()
    for e in entries:
        p = (APP / ('index.html' if e == './' else e)).resolve()
        listed.add(p)
        if not p.is_file():
            print(f'  清單有、檔案沒有：{e}（cache.addAll 會整個失敗）'); bad += 1

    for d in SCAN:
        for f in sorted(d.rglob('*')) if d.is_dir() else []:
            if f.is_file() and f.resolve() not in listed:
                print(f'  檔案有、清單沒有：{f.relative_to(ROOT).as_posix()}'); bad += 1

    # index.html 真正載入的檔（含 ../prototype 的 css／js）都要預先快取
    index = APP / 'index.html'
    loads = Loads()
    loads.feed(index.read_text(encoding='utf-8'))
    # manifest 的 icons 也是安裝時會抓的
    man = APP / 'manifest.webmanifest'
    try:
        for ic in json.loads(man.read_text(encoding='utf-8')).get('icons', []):
            if ic.get('src'):
                loads.found.append(('manifest icon', ic['src']))
    except (OSError, ValueError) as err:
        print(f'  manifest.webmanifest 讀不動：{err}'); bad += 1
    n_loads = 0
    for kind, href in loads.found:
        base = man.parent if kind == 'manifest icon' else index.parent
        p = local(base, href)
        if p is None:
            print(f'  index.html 載了外部資源（不准連網）：{kind} {href}'); bad += 1
            continue
        n_loads += 1
        if not p.is_file():
            print(f'  index.html 載的檔不存在：{kind} {href}'); bad += 1
        elif p not in listed:
            print(f'  index.html 載了、清單沒有：{kind} {href}'); bad += 1

    # 版本單一來源：js/version.js。sw.js 的快取名字與設定頁「關於」顯示的版本都讀它，不另外寫死
    ver_file = APP / 'js' / 'version.js'
    ver = re.search(r"^self\.APP_VERSION = '([^']+)';", ver_file.read_text(encoding='utf-8'), re.M) if ver_file.is_file() else None
    hard = re.compile(r"^const VERSION = '[^']*';", re.M)
    if not ver:
        print("  js/version.js 找不到 self.APP_VERSION = '…';"); bad += 1
    if "importScripts('./js/version.js')" not in src:
        print("  sw.js 沒有 importScripts('./js/version.js')"); bad += 1
    for f in (APP / 'sw.js', APP / 'js' / 'views' / 'system.js'):
        if hard.search(f.read_text(encoding='utf-8')):
            print(f'  {f.relative_to(ROOT).as_posix()} 自己寫死了版本（改讀 js/version.js 的 APP_VERSION）'); bad += 1
    if ver:
        print(f'  VERSION：{ver.group(1)}（js/version.js，sw.js 與設定頁都讀它）')

    print(f'check-sw：清單 {len(entries)} 筆、index.html＋manifest 載入 {n_loads} 個檔，'
          + ('PASS' if not bad else f'FAIL（{bad} 處）'))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
