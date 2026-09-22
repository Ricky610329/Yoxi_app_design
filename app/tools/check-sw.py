"""檢查 app/sw.js 的 PRECACHE 清單與實際檔案是否一致。

用法：python app/tools/check-sw.py
  1. 清單裡的每個路徑都要存在（'./' 視為 index.html）。
  2. app/css、app/js、app/assets/icons、prototype/assets/map、prototype/assets/photos
     底下的檔案都要在清單裡。
不一致就印出來並 exit 1。
例外：core 負責、契約已承諾但可能還沒建的入口檔（PENDING），缺檔只警告不算失敗；
      全部建好之後這個例外自然不會再觸發。
"""
import re
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
ROOT = APP.parent
PENDING = {'index.html', 'css/app.css', 'js/app.js'}   # 相對 app/
SCAN = [APP / 'css', APP / 'js', APP / 'assets' / 'icons',
        ROOT / 'prototype' / 'assets' / 'map', ROOT / 'prototype' / 'assets' / 'photos']


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
            rel = p.relative_to(APP).as_posix() if p.is_relative_to(APP) else None
            if rel in PENDING:
                print(f'  警告（core 尚未建立）：{e}')
            else:
                print(f'  清單有、檔案沒有：{e}'); bad += 1

    for d in SCAN:
        for f in sorted(d.rglob('*')) if d.is_dir() else []:
            if f.is_file() and f.resolve() not in listed:
                print(f'  檔案有、清單沒有：{f.relative_to(ROOT).as_posix()}'); bad += 1

    print(f'check-sw：{len(entries)} 筆，' + ('PASS' if not bad else f'FAIL（{bad} 處）'))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
