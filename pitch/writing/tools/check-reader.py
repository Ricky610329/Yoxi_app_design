"""Check file links and exercise the reader in desktop/mobile headless Chrome.

Writes screenshots and a JSON report to the system temp directory, not the repo.
"""
from pathlib import Path
from html.parser import HTMLParser
from html import unescape
from urllib.parse import urlsplit, unquote
import json
import os
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(tempfile.gettempdir()) / 'yoxi-writing-reader-check'
OUT.mkdir(exist_ok=True)


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.ids = [], []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        for key in ('href', 'src'):
            if key in attrs:
                self.links.append(attrs[key])


parser = Links()
parser.feed((ROOT / 'index.html').read_text(encoding='utf-8'))
errors = []
if len(parser.ids) != len(set(parser.ids)):
    errors.append('Duplicate HTML ids')
for uri in parser.links:
    parsed = urlsplit(uri)
    if parsed.scheme:
        continue
    if parsed.path and not (ROOT / unquote(parsed.path)).exists():
        errors.append('Missing file: ' + uri)
    if not parsed.path and parsed.fragment and parsed.fragment not in parser.ids:
        errors.append('Missing anchor: ' + uri)
if errors:
    raise SystemExit('\n'.join(errors))

chrome = next((p for p in [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    shutil.which('chromium'), shutil.which('google-chrome')
] if p and Path(p).exists()), None)
if not chrome:
    raise SystemExit('Chrome/Edge not found')

checks = r'''
var w = document.querySelector('iframe').contentWindow, d = w.document;
var result = {};
try {
  d.querySelectorAll('img').forEach(function(img) {img.loading='eager';});
  result.chapters = d.querySelectorAll('.chapter').length;
  result.diagrams = d.querySelectorAll('.diagram img').length;
  result.tables = d.querySelectorAll('table').length;
  result.initialOverflow = d.documentElement.scrollWidth > w.innerWidth + 1;
  d.getElementById('font-size').click();
  result.fontToggle = d.body.classList.contains('large-text') && d.getElementById('font-size').getAttribute('aria-pressed') === 'true';
  result.largeOverflow = d.documentElement.scrollWidth > w.innerWidth + 1;
  d.getElementById('font-size').click();
  var prints = 0; w.print = function () { prints++; };
  d.getElementById('print-page').click(); result.printButton = prints === 1;
  d.querySelector('nav a[href="#archive"]').click();
  setTimeout(function() {
    result.archiveOpen = d.getElementById('archive-panel').open;
    d.querySelector('nav a[href="#architecture"]').click();
    setTimeout(function() {
      result.activeNav = d.querySelector('nav a[aria-current="location"]').hash;
      result.imagesLoaded = Array.from(d.images).every(function(i) {return i.complete && i.naturalWidth > 0;});
      result.externalResources = w.performance.getEntriesByType('resource').filter(function(r) {return /^https?:/.test(r.name);}).map(function(r) {return r.name;});
      document.getElementById('result').textContent = JSON.stringify(result);
    }, 800);
  }, 200);
} catch (e) {document.getElementById('result').textContent = JSON.stringify({error:String(e)});}
'''
report = {'local_links': len(parser.links), 'views': {}}
for name, width, height in [('desktop', 1440, 1000), ('mobile', 390, 844)]:
    fixture = OUT / (name + '.html')
    fixture.write_text('<!doctype html><meta charset="utf-8"><style>body{margin:0}iframe{border:0;display:block;width:'
        + str(width) + 'px;height:' + str(height) + 'px}#result{position:absolute;left:-20000px}</style>'
        + '<iframe src="' + (ROOT / 'index.html').as_uri() + '"></iframe><pre id="result"></pre>'
        + '<script>document.querySelector("iframe").onload=function(){setTimeout(function(){' + checks + '},300);};</script>', encoding='utf-8')
    with tempfile.TemporaryDirectory(prefix='yoxi-reader-chrome-') as profile:
        cmd = [chrome, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            '--allow-file-access-from-files', '--force-device-scale-factor=1', '--hide-scrollbars',
            '--user-data-dir=' + profile, '--window-size=' + str(max(600,width)) + ',' + str(height+100),
            '--virtual-time-budget=5000', '--screenshot=' + str(OUT / (name + '.png')), '--dump-dom', fixture.as_uri()]
        proc = subprocess.run(cmd, capture_output=True, timeout=45)
        dom = proc.stdout.decode('utf-8', errors='replace')
        match = re.search(r'<pre id="result">(.*?)</pre>', dom, re.S)
        if not match or not match.group(1):
            raise SystemExit('Browser did not report: ' + name)
        result = json.loads(unescape(match.group(1)))
        report['views'][name] = result
        if (result.get('error') or result.get('chapters') != 8 or result.get('diagrams') != 5
            or result.get('initialOverflow') or result.get('largeOverflow')
            or not all(result.get(x) for x in ['fontToggle','printButton','archiveOpen','imagesLoaded'])
            or result.get('activeNav') != '#architecture' or result.get('externalResources')):
            errors.append(name + ': ' + json.dumps(result, ensure_ascii=False))
(OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=True, indent=2))
print('Screenshots: ' + str(OUT))
if errors:
    raise SystemExit('\n'.join(errors))
