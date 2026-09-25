"""本機靜態伺服器（測 PWA／手機同 Wi-Fi 用）。

用法：python app/tools/serve.py [port=8420]
從 repo 根起站（app 用 ../prototype/... 載共用檔），開 http://localhost:<port>/app/。
開發用：Cache-Control: no-store。service worker 的策略（見 app/sw.js 檔頭）：
  - index.html（導覽）network-first：改了重新整理一次就看得到。
  - css／js 等預先快取的檔 stale-while-revalidate：改了要重新整理「兩次」（第一次在背景更新快取）。
  - 明信片與照片 cache-first：換了同名的圖要把 sw.js 的 VERSION 加一（或 DevTools → Application 清快取）。
  要一次到位：DevTools → Application → Service workers 勾「Update on reload」，或 VERSION 加一。
"""
import http.server
import socket
import sys
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.webmanifest': 'application/manifest+json',
        '.mjs': 'text/javascript',
        '.js': 'text/javascript',
        '.svg': 'image/svg+xml',
        '.json': 'application/json',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))   # UDP connect 不送封包，只為取得對外介面的 IP
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8420
    httpd = http.server.ThreadingHTTPServer(('0.0.0.0', port), partial(Handler, directory=str(ROOT)))
    print(f'  本機： http://localhost:{port}/app/')
    ip = lan_ip()
    if ip:
        print(f'  區網： http://{ip}:{port}/app/  （手機同 Wi-Fi；非 localhost 的 http 不會註冊 service worker，安裝需 https）')
    print('  Ctrl+C 結束', flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == '__main__':
    main()
