"""Build the offline reading page: python pitch/writing/tools/build-reader.py.

Requires markdown-it-py (see requirements.txt). Markdown remains the content source.
The generated HTML needs no server, Python, or network to read.
"""
from pathlib import Path
from html import escape
import posixpath
import re
import struct
import xml.etree.ElementTree as ET
from markdown_it import MarkdownIt

ROOT = Path(__file__).resolve().parents[1]
DOCS = [
    ('README.md', 'overview', '導讀', '閱讀說明'),
    ('01-solution-architecture.md', 'architecture', '01', '方案架構'),
    ('02-flow-design.md', 'flow', '02', '流程設計'),
    ('03-ai-and-tools.md', 'ai', '03', 'AI 技術與工具'),
    ('04-cost-and-resources.md', 'cost', '04', '成本與資源'),
    ('08-references-and-evidence.md', 'evidence', '08', '補充資料'),
    ('verification.md', 'verification', '紀錄', '驗證與交接'),
    ('notes/optional-card-ideas.md', 'archive', '備存', '早期討論'),
]
DIAGRAMS = {'architecture': ['architecture'], 'flow': ['flow', 'sequence'],
            'ai': ['ai-pipeline'], 'archive': ['archived-cards']}
LINKS = {name: ident for name, ident, _, _ in DOCS}
md = MarkdownIt('commonmark', {'html': False, 'breaks': True}).enable('table')


def render_doc(filename, ident):
    tokens = md.parse((ROOT / filename).read_text(encoding='utf-8'))
    heading_count = 0
    graph_count = 0
    for i, token in enumerate(tokens):
        if token.type in ('heading_open', 'heading_close'):
            token.tag = 'h' + str(min(6, int(token.tag[1:]) + 1))
        if token.type == 'heading_open':
            heading_count += 1
            token.attrSet('id', f'{ident}-heading-{heading_count}')
        if token.type == 'fence' and token.info.strip() == 'mermaid':
            asset = DIAGRAMS[ident][graph_count]
            graph_count += 1
            uri = f'assets/diagrams/{asset}.svg'
            svg = ET.parse(ROOT / uri).getroot()
            dimensions = f'width="{svg.attrib["width"]}" height="{svg.attrib["height"]}"'
            token.type = 'html_block'
            token.content = (f'<figure class="diagram"><a href="{uri}" target="_blank" '
                f'rel="noopener" aria-label="另開分頁放大圖表">'
                f'<img src="{uri}" {dimensions} alt="{escape(asset)}：架構或流程圖，文字版見下方" loading="lazy"></a>'
                '<figcaption>點圖可另開分頁放大；流程仍以正文說明為準。</figcaption></figure>'
                f'<details class="diagram-source"><summary>查看圖表文字與 Mermaid 原始碼</summary>'
                f'<pre><code>{escape(token.content)}</code></pre></details>')
        for child in token.children or []:
            for attr in ('href', 'src'):
                uri = child.attrGet(attr)
                if not uri or re.match(r'^(?:https?:|mailto:|#)', uri):
                    continue
                resolved = posixpath.normpath(posixpath.join(posixpath.dirname(filename), uri))
                child.attrSet(attr, '#' + LINKS[resolved] if resolved in LINKS else resolved)
            if child.type == 'image':
                child.attrSet('loading', 'lazy')
                child.attrSet('class', 'prototype-shot')
                path = ROOT / child.attrGet('src')
                if path.suffix.lower() == '.png':
                    with path.open('rb') as image_file:
                        header = image_file.read(24)
                    width, height = struct.unpack('>II', header[16:24])
                    child.attrSet('width', str(width))
                    child.attrSet('height', str(height))
    rendered = md.renderer.render(tokens, md.options, {})
    rendered = rendered.replace('<table>', '<div class="table-scroll" tabindex="0" role="region" aria-label="資料表，可左右捲動"><table>')
    return rendered.replace('</table>', '</table></div>')


nav = []
articles = []
for filename, ident, number, title in DOCS:
    nav.append(f'<a href="#{ident}"><span>{number}</span>{title}</a>')
    article = (f'<article id="{ident}" class="chapter" aria-label="{title}">'
        f'<div class="chapter-meta"><span>{number} / {title}</span>'
        f'<a href="{filename}">Markdown 原稿 ↗</a></div>{render_doc(filename, ident)}</article>')
    if ident == 'archive':
        article = '<details class="archive" id="archive-panel"><summary>早期討論備存 · 不納入本次主方案</summary>' + article + '</details>'
    articles.append(article)

page = '''<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>遊喜樂｜競賽技術與落地文件</title>
<link rel="stylesheet" href="../../prototype/css/tokens.css">
<link rel="stylesheet" href="assets/reader.css">
</head>
<body>
<a class="skip" href="#content">跳至正文</a>
<aside class="sidebar" aria-label="文件目錄">
  <a class="brand" href="#top"><span class="brand-mark">yoxi</span><strong>遊喜樂</strong></a>
  <p class="sidebar-caption">競賽技術與落地文件</p>
  <nav>__NAV__</nav>
  <div class="sidebar-footer">正文草稿 · 2026.09.29<br>現況、提案、假設分開標示</div>
</aside>
<main id="content">
  <header class="hero" id="top">
    <div class="eyebrow">TECHNICAL PROPOSAL / 閱讀版</div>
    <h1>把出行的體驗，<br>留下成為一張明信片。</h1>
    <p class="hero-lead">從方案架構與流程，到 AI 工具、內容成本與實作佐證。<br>沿用既有接送能力，說清楚新增服務如何運作。</p>
    <div class="hero-flow" aria-label="服務主流程"><span>選景點</span><b>→</b><span>接送與探索</span><b>→</b><span>保證收卡</span><b>→</b><span>分享與累積</span></div>
    <div class="toolbar"><button type="button" id="print-page">列印 / 存成 PDF</button><button type="button" id="font-size" aria-pressed="false">放大字體</button><span>Ctrl / ⌘ + F 搜尋全文</span></div>
  </header>
  __ARTICLES__
  <footer class="page-footer">遊喜樂 · 競賽文件工作區 <a href="#top">回到頁首 ↑</a></footer>
</main>
<script src="assets/reader.js"></script>
</body></html>
'''.replace('__NAV__', '\n'.join(nav)).replace('__ARTICLES__', '\n'.join(articles))
(ROOT / 'index.html').write_text(page, encoding='utf-8')
print(f'Built {ROOT / "index.html"}: {len(DOCS)} documents, {len(page):,} characters')
