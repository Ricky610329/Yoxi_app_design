"""Build the eight-page narrative brief from eight-pages.md; render for visual QA.

Run at repo root: python pitch/writing/tools/build-eight-pages.py
Dependencies: markdown-it-py, PyMuPDF, Pillow, local Chrome/Edge.
"""
from pathlib import Path
import html
import io
import json
import re
import shutil
import subprocess
import sys
import tempfile

from markdown_it import MarkdownIt
import pymupdf as fitz
from PIL import Image, ImageDraw

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = Path(__file__).resolve().parents[3]
WRITING = ROOT / 'pitch/writing'
TMP = ROOT / 'tmp/pdfs/eight-pages'
PDF = ROOT / 'output/pdf/遊喜樂_方案精簡版_8頁.pdf'


def prepare():
    source = (WRITING / 'eight-pages.md').read_text(encoding='utf-8')
    chunks = re.split(r'<!-- page: (.*?) -->', source)[1:]
    assert len(chunks) == 16, 'Exactly eight page sections required'
    md = MarkdownIt('commonmark', {'html': True}).enable('table')
    sections, titles = [], []
    for i in range(0, len(chunks), 2):
        title, markdown = chunks[i:i + 2]
        titles.append(title)
        content = md.render(markdown)
        page = i // 2 + 1
        sections.append(f'<section class="page"><div class="body">{content}</div>'
                        f'<footer class="footer"><span>遊喜樂 · 方案精簡版 ｜ 2026.09.29</span>'
                        f'<span>{page:02d} / 08</span></footer></section>')
    result = ('<!doctype html><html lang="zh-Hant"><head><meta charset="UTF-8">'
              '<meta name="viewport" content="width=device-width,initial-scale=1">'
              '<title>遊喜樂｜八頁方案說明</title>'
              '<link rel="stylesheet" href="assets/eight-pages.css"></head><body>'
              + ''.join(sections) + '</body></html>')
    (WRITING / 'eight-pages.html').write_text(result, encoding='utf-8')
    return result, titles


def main():
    TMP.mkdir(parents=True, exist_ok=True)
    PDF.parent.mkdir(parents=True, exist_ok=True)
    markup, titles = prepare()
    # Geometry probe uses the print dimensions and tests the entire content body.
    probe = markup.replace('<head>', '<head><base href="' + WRITING.as_uri() + '/">', 1)
    probe = probe.replace('</head>', '<style>@media screen{body{padding:0;background:white}'
        '.page{box-sizing:border-box;padding:0 0 12mm;margin:0;height:270mm}'
        '.footer{bottom:1mm}}</style></head>')
    script = '''<script>window.addEventListener('load',async()=>{
      await document.fonts.ready;
      const result=[...document.querySelectorAll('.page')].map((p,i)=>({
        page:i+1,
        remainingPx:p.querySelector('.footer').getBoundingClientRect().top-p.querySelector('.body').getBoundingClientRect().bottom,
        horizontalOverflow:p.scrollWidth>p.clientWidth+1,
        images:[...p.querySelectorAll('img')].every(im=>im.complete&&im.naturalWidth>0)
      }));
      const el=document.createElement('pre');el.id='qa-report';el.style.display='none';
      el.textContent=JSON.stringify(result);document.body.append(el);
    });</script>'''
    probe = probe.replace('</body>', script + '</body>')
    probe_path = TMP / 'probe.html'
    probe_path.write_text(probe, encoding='utf-8')
    browser = next((Path(p) for p in [
        r'C:\Program Files\Google\Chrome\Application\chrome.exe',
        r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
        shutil.which('chromium') or '', shutil.which('google-chrome') or ''
    ] if p and Path(p).is_file()), None)
    if browser is None:
        raise SystemExit('Local Chrome or Edge required')
    raw = TMP / 'raw.pdf'
    if raw.exists():
        raw.unlink()
    with tempfile.TemporaryDirectory(prefix='yoxi-eight-pages-') as profile:
        args = [str(browser), '--headless=new', '--disable-gpu', '--hide-scrollbars',
                '--allow-file-access-from-files', '--force-device-scale-factor=1',
                '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + profile,
                '--virtual-time-budget=2000', '--run-all-compositor-stages-before-draw']
        probe_result = subprocess.run(args + ['--dump-dom', probe_path.as_uri()],
                                      capture_output=True, timeout=60, check=True)
        match = re.search(r'<pre id="qa-report"[^>]*>(.*?)</pre>',
                          probe_result.stdout.decode('utf-8'), re.S)
        if not match:
            raise RuntimeError('Browser did not return geometry report')
        geometry = json.loads(html.unescape(match.group(1)))
        if any(p['remainingPx'] < 8 or p['horizontalOverflow'] or not p['images'] for p in geometry):
            raise RuntimeError('Page content overflow / missing image: ' + json.dumps(geometry))
        subprocess.run(args + ['--no-pdf-header-footer', '--print-to-pdf=' + str(raw),
                               (WRITING / 'eight-pages.html').as_uri()],
                       capture_output=True, timeout=60, check=True)
    report = {'pages': 0, 'geometry': geometry, 'out_of_bounds': [], 'local_links': 0}
    with fitz.open(raw) as doc:
        assert len(doc) == 8, f'Expected eight pages, got {len(doc)}'
        doc.set_toc([[1, title, i + 1] for i, title in enumerate(titles)])
        doc.set_metadata({'title': '遊喜樂｜方案精簡版（8 頁）', 'author': '遊喜樂',
                          'subject': '方案架構、流程、AI、工具、成本資源與補充資料'})
        for i, page in enumerate(doc):
            text = page.get_text()
            assert f'{i + 1:02d} / 08' in text, f'Page number missing on {i+1}'
            assert len(text.strip()) > 150, f'Unexpected sparse page {i+1}'
            for block in page.get_text('blocks'):
                if block[0] < 0 or block[1] < 0 or block[2] > page.rect.width + 1 or block[3] > page.rect.height + 1:
                    report['out_of_bounds'].append(i + 1)
            report['local_links'] += sum(l['kind'] == fitz.LINK_LAUNCH for l in page.get_links())
        assert not report['out_of_bounds'] and report['local_links'] == 0, report
        if PDF.exists():
            PDF.unlink()
        doc.save(PDF, garbage=4, deflate=True)
    with fitz.open(PDF) as final:
        report['pages'] = len(final)
        report['bytes'] = PDF.stat().st_size
        report['links'] = sum(len(p.get_links()) for p in final)
        for i, page in enumerate(final):
            page.get_pixmap(matrix=fitz.Matrix(1.6, 1.6), alpha=False).save(TMP / f'page-{i+1:02d}.png')
        for start in (0, 4):
            board = Image.new('RGB', (1000, 1440), '#EAF1F5')
            draw = ImageDraw.Draw(board)
            for j in range(4):
                with Image.open(TMP / f'page-{start+j+1:02d}.png') as im:
                    im.thumbnail((474, 675))
                    x, y = (j % 2) * 500 + 13, (j // 2) * 720 + 29
                    board.paste(im, (x, y))
                    draw.text((x, y-20), f'Page {start+j+1}', fill='black')
            board.save(TMP / f'contact-{start//4+1:02d}.png')
    (TMP / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print('PDF:', PDF)


if __name__ == '__main__':
    main()
