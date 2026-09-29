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
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(tempfile.gettempdir()) / 'yoxi-writing-reader-check'
OUT.mkdir(exist_ok=True)


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.ids = [], []
        self.chapters, self.diagrams, self.diagram_shortcuts = [], [], []
        self._diagram_nav_depth = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = attrs.get('class', '').split()
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        if tag == 'article' and 'chapter' in classes:
            self.chapters.append(attrs.get('id'))
        if tag == 'figure' and 'diagram' in classes:
            self.diagrams.append(attrs.get('id'))
        if tag == 'div' and 'diagram-nav' in classes:
            self._diagram_nav_depth += 1
        if tag == 'a' and self._diagram_nav_depth:
            self.diagram_shortcuts.append(attrs.get('href'))
        for key in ('href', 'src'):
            if key in attrs:
                self.links.append(attrs[key])

    def handle_endtag(self, tag):
        if tag == 'div' and self._diagram_nav_depth:
            self._diagram_nav_depth -= 1


parser = Links()
parser.feed((ROOT / 'index.html').read_text(encoding='utf-8'))
expected_chapters = ['overview', 'architecture', 'flow', 'ai', 'cost', 'evidence',
    'technical', 'cost-detail', 'verification', 'archive']
expected_diagram_ids = ['diagram-product-cycle', 'diagram-service-layers', 'diagram-flow',
    'diagram-ai-pipeline', 'diagram-architecture', 'diagram-expo-stack',
    'diagram-evolution', 'diagram-share-boundary', 'diagram-sequence',
    'diagram-archived-cards']
expected_shortcuts = ['#diagram-product-cycle', '#diagram-service-layers',
    '#diagram-flow', '#diagram-ai-pipeline']
expected_diagrams = sum(len(re.findall(r'^```mermaid\s*$', f.read_text(encoding='utf-8'), re.M))
    for folder in [ROOT, ROOT / 'notes'] for f in folder.glob('*.md'))
errors = []
if len(parser.ids) != len(set(parser.ids)):
    errors.append('Duplicate HTML ids')
if parser.chapters != expected_chapters:
    errors.append('Chapter order: ' + json.dumps(parser.chapters, ensure_ascii=False))
if parser.diagrams != expected_diagram_ids:
    errors.append('Diagram order: ' + json.dumps(parser.diagrams, ensure_ascii=False))
if parser.diagram_shortcuts != expected_shortcuts:
    errors.append('Hero diagram shortcuts: ' + json.dumps(parser.diagram_shortcuts, ensure_ascii=False))
for svg in (ROOT / 'assets' / 'diagrams').glob('*.svg'):
    words = ''.join(ET.parse(svg).getroot().itertext())
    for forbidden in ['任務', '完成', '達成', '挑戰', '每日']:
        if forbidden in words:
            errors.append('Diagram wording: ' + svg.name + ': ' + forbidden)
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
  result.chapterIds = Array.from(d.querySelectorAll('.chapter')).map(function(x) { return x.id; });
  result.diagrams = d.querySelectorAll('.diagram img').length;
  result.heroShortcutHrefs = Array.from(d.querySelectorAll('.diagram-nav a')).map(function(x) { return x.hash; });
  result.archiveInitiallyClosed = !d.getElementById('archive-panel').open;
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
      d.querySelector('.diagram-nav a[href="#diagram-product-cycle"]').click();
      setTimeout(function() {
        var top = d.getElementById('diagram-product-cycle').getBoundingClientRect().top;
        result.diagramShortcut = w.location.hash === '#diagram-product-cycle' && top >= 0 && top <= 160;
        result.diagramNav = d.querySelector('nav a[aria-current="location"]').hash;
        document.getElementById('result').textContent = JSON.stringify(result);
      }, 200);
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
        if (result.get('error') or result.get('chapters') != len(expected_chapters)
            or result.get('chapterIds') != expected_chapters
            or result.get('diagrams') != expected_diagrams
            or result.get('heroShortcutHrefs') != expected_shortcuts
            or result.get('initialOverflow') or result.get('largeOverflow')
            or not all(result.get(x) for x in ['archiveInitiallyClosed','fontToggle','printButton','archiveOpen','imagesLoaded','diagramShortcut'])
            or result.get('diagramNav') != '#architecture'
            or result.get('activeNav') != '#architecture' or result.get('externalResources')):
            errors.append(name + ': ' + json.dumps(result, ensure_ascii=False))
(OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=True, indent=2))
print('Screenshots: ' + str(OUT))
if errors:
    raise SystemExit('\n'.join(errors))
