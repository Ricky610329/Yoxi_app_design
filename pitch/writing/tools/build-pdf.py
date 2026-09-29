"""Export the proposal reader to a self-contained A4 PDF and PNG review sheets.

Run from the repository root: python pitch/writing/tools/build-pdf.py
Uses the installed Chrome/Edge, PyMuPDF, and Pillow; no network requests.
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

import pymupdf as fitz
from PIL import Image, ImageDraw

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = Path(__file__).resolve().parents[3]
WRITING = ROOT / 'pitch/writing'
TMP = ROOT / 'tmp/pdfs'
OUT = ROOT / 'output/pdf'
PDF = OUT / '遊喜樂_方案架構與落地評估.pdf'
CHAPTERS = [
    ('architecture', '01 方案架構', '方案架構｜讓探索'),
    ('flow', '02 流程設計', '流程設計｜從找到'),
    ('ai', '03 AI 技術與工具', 'AI 應用方法｜'),
    ('cost', '04 成本與資源', '成本與資源｜'),
    ('evidence', '八、補充資料', '八、補充資料｜'),
    ('technical', '附錄 A 技術細節', '技術附錄｜'),
    ('cost-detail', '附錄 B 成本假設', '遊喜樂成本假設'),
]

PRINT_CSS = '''
@media print {
 @page {size:A4; margin:17mm 15mm 18mm}
 #overview,#verification,.archive,.sidebar,.toolbar,.diagram-nav,.chapter-meta,
 .diagram-source,.page-footer,.skip {display:none!important}
 body {font-size:10pt;line-height:1.6;background:white}
 main {margin:0;padding:0;max-width:none}
 .hero {height:247mm;box-sizing:border-box;border:0;padding-top:20mm;break-after:page}
 .hero h1 {font-size:29pt;line-height:1.5;margin-bottom:8mm}
 .hero-lead {font-size:12pt;line-height:1.9}
 .hero-flow {margin:10mm 0 8mm;gap:6px}
 .hero-flow span {font-size:9pt;padding:4px 8px}
 .share-note {font-size:10pt}
 .pdf-toc {margin-top:14mm;border-top:1px solid var(--yoxi-line);padding-top:6mm}
 .pdf-toc h2 {font-size:14pt;margin:0 0 4mm}
 .pdf-toc a {display:block;margin:2mm 0;text-decoration:none;font-size:11pt}
 .pdf-cover-meta {font-size:9pt;color:var(--yoxi-navy-60);margin-top:10mm}
 .chapter {padding:0;border:0;break-before:page}
 h2 {font-size:19pt;line-height:1.5;margin:0 0 6mm;break-after:avoid}
 h3 {font-size:13pt;line-height:1.5;margin:6mm 0 3mm;break-after:avoid}
 h4 {font-size:11pt;line-height:1.5;margin:4mm 0 2mm;break-after:avoid}
 p {margin:0 0 2.5mm;orphans:3;widows:3}
 blockquote {font-size:9.5pt;margin:0 0 5mm;padding:3mm 5mm;break-inside:avoid}
 table {font-size:8.5pt;line-height:1.55;table-layout:fixed;width:100%;min-width:0!important}
 th,td {padding:2mm;min-width:0;overflow-wrap:anywhere}
 tr {break-inside:avoid} thead {display:table-header-group}
 .table-scroll {margin:4mm 0 5mm;overflow:visible;border:0;break-inside:avoid}
 .diagram {margin:5mm 0;padding:3mm;break-inside:avoid}
 .diagram img {width:100%;max-height:175mm;object-fit:contain}
 #diagram-product-cycle img {max-height:90mm}
 #diagram-service-layers img {max-height:110mm}
 #diagram-flow img {max-height:150mm}
 #technical .diagram img {max-height:195mm}
 .diagram figcaption {font-size:8pt;margin-top:2mm}
 .prototype-shot {max-width:54mm;max-height:119mm;margin:4mm auto;box-shadow:none}
 pre {font-size:8.3pt;line-height:1.55;padding:4mm;break-inside:avoid;white-space:pre-wrap}
 code {font-size:.88em}
 .pdf-evidence {break-inside:avoid}
 #evidence table {line-height:1.45}
 #evidence th,#evidence td {padding:1.5mm 2mm}
}
'''


def prepare_html():
    source = (WRITING / 'index.html').read_text(encoding='utf-8')
    source = source.replace('<head>', '<head><base href="' + WRITING.as_uri() + '/">', 1)
    source = source.replace('</head>', '<style>' + PRINT_CSS + '</style></head>')
    source = source.replace(' loading="lazy"', ' loading="eager"')
    source = re.sub(r'<script\b[^>]*>.*?</script>', '', source, flags=re.S)
    toc = '<div class="pdf-toc"><h2>閱讀目錄</h2>' + ''.join(
        f'<a href="#{ident}">{title}</a>' for ident, title, _ in CHAPTERS) + '</div>'
    source = source.replace('</header>', toc + '<p class="pdf-cover-meta">'
        '2026.09.29 · 方案說明與技術附錄<br>現況、提案與規劃假設分開標示'
        '</p></header>', 1)
    source = re.sub(r' · 點圖可另開分頁放大，正文保留條件與假設。', '', source)
    # Source-code links remain usable when the PDF is sent without local files.
    def link(match):
        uri = html.unescape(match.group(1))
        if uri.startswith('#'):
            return 'href="' + (TMP / 'proposal-print.html').as_uri() + uri + '"'
        if uri.startswith(('https:', 'http:', 'mailto:')):
            return match.group(0)
        path = (WRITING / uri.split('#')[0]).resolve()
        if path.suffix == '.svg':
            return 'href="' + (TMP / 'proposal-print.html').as_uri() + '#diagram-' + path.stem + '"'
        try:
            rel = path.relative_to(ROOT).as_posix()
        except ValueError:
            return match.group(0)
        return 'href="https://github.com/Ricky610329/Yoxi_app_design/blob/f0151d6/' + rel + '"'
    source = re.sub(r'<a\b[^>]*>', lambda m: re.sub(r'href="([^"]+)"', link, m.group(0)), source)
    # Keep a screenshot and the explanatory paragraphs together.
    source = re.sub(r'(<h4[^>]*>2\.[1-5].*?)(?=<h4|<h3)',
                    r'<div class="pdf-evidence">\1</div>', source, flags=re.S)
    path = TMP / 'proposal-print.html'
    path.write_text(source, encoding='utf-8')
    return path


def main():
    TMP.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    browser = next((Path(p) for p in [
        r'C:\Program Files\Google\Chrome\Application\chrome.exe',
        r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
        shutil.which('chromium') or '', shutil.which('google-chrome') or ''
    ] if p and Path(p).is_file()), None)
    if browser is None:
        raise SystemExit('Chrome or Edge is required')
    print_html = prepare_html()
    raw = TMP / 'proposal-raw.pdf'
    with tempfile.TemporaryDirectory(prefix='yoxi-proposal-pdf-') as profile:
        command = [str(browser), '--headless=new', '--disable-gpu', '--hide-scrollbars',
            '--allow-file-access-from-files', '--force-device-scale-factor=1',
            '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + profile,
            '--no-pdf-header-footer', '--virtual-time-budget=5000',
            '--run-all-compositor-stages-before-draw', '--print-to-pdf=' + str(raw),
            print_html.as_uri()]
        if raw.exists():
            raw.unlink()
        result = subprocess.run(command, capture_output=True, timeout=90)
        if result.returncode or not raw.exists():
            raise RuntimeError(result.stderr.decode('utf-8', errors='replace')[-2000:])
    doc = fitz.open(raw)
    toc = []
    for _, title, prefix in CHAPTERS:
        found = next((i + 1 for i, p in enumerate(doc)
                      if prefix.replace(' ', '') in p.get_text().replace(' ', '').replace('\n', '')), None)
        if not found:
            raise RuntimeError('Missing chapter: ' + title)
        toc.append([1, title, found])
    doc.set_toc(toc)
    destinations = {ident: item[2] - 1 for (ident, _, _), item in zip(CHAPTERS, toc)}
    for page_index, page in enumerate(doc):
        for annotation in page.get_links():
            if annotation['kind'] != fitz.LINK_LAUNCH:
                continue
            fragment = annotation.get('file', '').partition('#')[2]
            page.delete_link(annotation)
            if fragment in destinations:
                page.insert_link({'kind': fitz.LINK_GOTO, 'from': annotation['from'],
                                  'page': destinations[fragment], 'to': fitz.Point(0, 0)})
                if page_index == 0:
                    rect = annotation['from']
                    page.insert_textbox(fitz.Rect(rect.x1 - 45, rect.y0, rect.x1 - 6, rect.y1),
                        str(destinations[fragment] + 1), fontsize=10, align=2,
                        color=(.02, .13, .25))
    report = {'pages': len(doc), 'chapters': toc, 'blank_pages': [], 'out_of_bounds': []}
    for i, page in enumerate(doc):
        if len(page.get_text().strip()) < 15:
            report['blank_pages'].append(i + 1)
        for block in page.get_text('blocks'):
            x0, y0, x1, y1 = block[:4]
            if x0 < -1 or y0 < -1 or x1 > page.rect.width + 1 or y1 > page.rect.height + 1:
                report['out_of_bounds'].append(i + 1)
        if i:
            y = page.rect.height - 27
            page.draw_line((43, y - 12), (page.rect.width - 43, y - 12),
                           color=(.84, .87, .90), width=.4)
            page.insert_text((43, y), 'YOXI  /  SERVICE PROPOSAL', fontsize=8,
                             color=(.35, .43, .53))
            page.insert_textbox(fitz.Rect(page.rect.width - 110, y - 9,
                                          page.rect.width - 43, y + 5),
                                f'{i + 1} / {len(doc)}', fontsize=8, align=2,
                                color=(.35, .43, .53))
    metadata = doc.metadata
    metadata.update(title='遊喜樂｜方案架構與落地評估', author='遊喜樂',
                    subject='方案架構、流程、AI 技術、成本與補充資料')
    doc.set_metadata(metadata)
    if PDF.exists():
        PDF.unlink()
    doc.save(PDF, garbage=4, deflate=True)
    doc.close()
    with fitz.open(PDF) as final:
        report['internal_links'] = sum(link['kind'] == fitz.LINK_GOTO
            for page in final for link in page.get_links())
        report['local_file_links'] = sum(link['kind'] == fitz.LINK_LAUNCH
            for page in final for link in page.get_links())
        assert report['local_file_links'] == 0
        page_images = []
        for i, page in enumerate(final):
            pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
            target = TMP / f'page-{i+1:02d}.png'
            pix.save(target)
            page_images.append(target)
        for start in range(0, len(page_images), 9):
            sheet = Image.new('RGB', (960, 1440), '#dce2e8')
            draw = ImageDraw.Draw(sheet)
            for cell, file in enumerate(page_images[start:start+9]):
                im = Image.open(file)
                im.thumbnail((300, 435))
                x, y = (cell % 3) * 320 + 10, (cell // 3) * 480 + 28
                sheet.paste(im, (x, y))
                draw.text((x, y - 19), f'Page {start + cell + 1}', fill='black')
            sheet.save(TMP / f'contact-{start//9+1:02d}.png')
    report['bytes'] = PDF.stat().st_size
    (TMP / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print('PDF:', PDF)
    if report['blank_pages'] or report['out_of_bounds']:
        raise SystemExit('PDF geometry check failed; inspect PNG previews')


if __name__ == '__main__':
    main()
