#!/usr/bin/env python3
"""Render the pitch/writing Mermaid blocks as dependency-free SVG files.

The layouts are intentionally curated for the current diagrams.  Every source
block is SHA-256 pinned: when prose authors change a Mermaid block this script
stops and asks for a layout review instead of silently publishing stale art.

Usage:
    python pitch/writing/tools/render_diagrams.py
    python pitch/writing/tools/render_diagrams.py --check
"""

from __future__ import annotations

import argparse
import hashlib
import html
import re
import textwrap
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "pitch" / "writing" / "assets" / "diagrams"

NAVY = "#062040"
NAVY_SOFT = "#0B1F38"
SLATE = "#778AA4"
LINE = "#E3E8EE"
MIST = "#EAF1F5"
PAPER = "#FCFDFF"
WHITE = "#FFFFFF"
CREAM = "#FBEBDF"
FONT = "Montserrat, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"

# name: (source, Mermaid block index, pinned SHA-256, curated layout)
SPECS = {
    "service-layers.svg": ("pitch/writing/01-solution-architecture.md", 0,
                           "d47185453750ca4d5db548a13411d92e444afca4286bbc38d882af45340bff74", "service-layers"),
    "architecture.svg": ("pitch/writing/01-solution-architecture.md", 1,
                         "89e73a561f99e3d811742999867bded3adbe4f629dde868bf8d40514f31cb68d", "architecture"),
    "expo-stack.svg": ("pitch/writing/01-solution-architecture.md", 2,
                       "5da9f3032d005d47d0c260c060b6ae9926264d6108914c641a150b19932291b5", "expo-stack"),
    "evolution.svg": ("pitch/writing/01-solution-architecture.md", 3,
                      "49ebf71bae09bf3409fabc5a33c07af691dc153015580cff2a6238e960b90f4d", "evolution"),
    "flow.svg": ("pitch/writing/02-flow-design.md", 0,
                 "5f4f704e81b0681f47e35465ec8e6f056384bba94f2aa16b6e7e6ac89c2b00d7", "flow"),
    "share-boundary.svg": ("pitch/writing/02-flow-design.md", 1,
                           "b0f4fb467020991fb10f47c608d569a126b54deb02eb41c0c7c8c54f755ff229", "share-boundary"),
    "sequence.svg": ("pitch/writing/02-flow-design.md", 2,
                     "fa143ac6b57b6b98d0382436e2f032017cd5d59405f0b73dd1937a851a51840d", "sequence"),
    "ai-pipeline.svg": ("pitch/writing/03-ai-and-tools.md", 0,
                       "3d83ecdb0dbef771d772ded3bb12720d77ca20bcac11ed823d9322657877a778", "ai-pipeline"),
    "archived-cards.svg": ("pitch/writing/notes/optional-card-ideas.md", 0,
                          "ed7b42faafef5d2914d5b97f6e3052fad8c6bf1b13da0ef5c6ef56baca3177ae", "archived-cards"),
}


def mermaid_blocks(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    return [m.strip().replace("\r\n", "\n")
            for m in re.findall(r"```mermaid\s*\n(.*?)```", text, re.S)]


def esc(value: str) -> str:
    return html.escape(value, quote=True)


def base_svg(width: int, height: int, title: str, source: str, digest: str, body: str) -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc" data-source="{esc(source)}" data-source-sha256="{digest}">
  <title id="title">{esc(title)}</title>
  <desc id="desc">由原始 Mermaid 區塊離線產生；來源雜湊 {digest}</desc>
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="{NAVY}"/></marker>
    <style>
      text {{ font-family: {FONT}; fill: {NAVY}; }}
      .node {{ fill: {WHITE}; stroke: {NAVY}; stroke-width: 2; rx: 8; }}
      .group {{ fill: {PAPER}; stroke: {SLATE}; stroke-width: 1.5; rx: 16; }}
      .edge {{ fill: none; stroke: {NAVY}; stroke-width: 2; marker-end: url(#arrow); }}
      .dashed {{ stroke-dasharray: 8 7; }}
      .label-bg {{ fill: {WHITE}; opacity: .96; }}
    </style>
  </defs>
  <rect width="100%" height="100%" fill="{WHITE}"/>
{body}
</svg>
'''


def text_block(x: float, y: float, label: str, *, size: int = 18,
               weight: int = 500, anchor: str = "middle", line_h: int = 25,
               klass: str = "") -> str:
    lines = label.replace("<br/>", "\n").splitlines()
    start = y - (len(lines) - 1) * line_h / 2
    spans = "".join(
        f'<tspan x="{x}" y="{start + i * line_h}">{esc(line)}</tspan>'
        for i, line in enumerate(lines)
    )
    return f'<text class="{klass}" text-anchor="{anchor}" font-size="{size}" font-weight="{weight}">{spans}</text>'


def node(x: int, y: int, w: int, h: int, label: str, *, fill: str = WHITE,
         size: int = 17) -> str:
    return (f'<rect class="node" x="{x}" y="{y}" width="{w}" height="{h}" style="fill:{fill}"/>'
            + text_block(x + w / 2, y + h / 2 + 6, label, size=size))


def graph_parts(block: str) -> tuple[dict[str, str], list[tuple[str, str, str, bool]]]:
    labels: dict[str, str] = {}
    edges: list[tuple[str, str, str, bool]] = []
    for line in block.splitlines():
        for key, label in re.findall(r'\b([A-Z][A-Z0-9_]*)\["(.*?)"\]', line):
            labels[key] = label
        if "-->" not in line and ".->" not in line:
            continue
        ids = re.findall(r'\b[A-Z][A-Z0-9_]*\b', re.sub(r'".*?"', '', line))
        if len(ids) < 2:
            continue
        edge_label = ""
        pipe = re.search(r'\|([^|]+)\|', line)
        quoted = re.search(r'-\.\s*"([^"]+)"\s*\.->', line)
        if pipe:
            edge_label = pipe.group(1)
        elif quoted:
            edge_label = quoted.group(1)
        edges.append((ids[0], ids[-1], edge_label, ".->" in line))
    return labels, edges


def edge_between(a: tuple[int, int, int, int], b: tuple[int, int, int, int],
                 label: str = "", dashed: bool = False) -> str:
    ax, ay, aw, ah = a; bx, by, bw, bh = b
    acx, acy, bcx, bcy = ax + aw / 2, ay + ah / 2, bx + bw / 2, by + bh / 2
    if abs(bcx - acx) >= abs(bcy - acy):
        x1 = ax + aw if bcx > acx else ax
        x2 = bx if bcx > acx else bx + bw
        y1, y2 = acy, bcy
        mx = (x1 + x2) / 2
        d = f'M {x1} {y1} H {mx} V {y2} H {x2}'
        lx, ly = mx, (y1 + y2) / 2 - 12
    else:
        y1 = ay + ah if bcy > acy else ay
        y2 = by if bcy > acy else by + bh
        x1, x2 = acx, bcx
        my = (y1 + y2) / 2
        d = f'M {x1} {y1} V {my} H {x2} V {y2}'
        lx, ly = (x1 + x2) / 2, my - 7
    out = f'<path class="edge{" dashed" if dashed else ""}" d="{d}"/>'
    if label:
        tw = max(50, len(label) * 17)
        out += f'<rect class="label-bg" x="{lx-tw/2}" y="{ly-17}" width="{tw}" height="25" rx="4"/>'
        out += text_block(lx, ly, label, size=14)
    return out


def routed_edge(path: str, label: str = "", lx: float = 0, ly: float = 0,
                dashed: bool = False) -> str:
    out = f'<path class="edge{" dashed" if dashed else ""}" d="{path}"/>'
    if label:
        tw = max(50, len(label) * 17)
        out += f'<rect class="label-bg" x="{lx-tw/2}" y="{ly-17}" width="{tw}" height="25" rx="4"/>'
        out += text_block(lx, ly, label, size=14)
    return out


def group_box(x: int, y: int, w: int, h: int, title: str) -> str:
    return (f'<rect class="group" x="{x}" y="{y}" width="{w}" height="{h}"/>'
            + text_block(x + 24, y + 36, title, size=21, weight=700, anchor="start"))


def render_service_layers(block: str, source: str, digest: str) -> str:
    labels, edges = graph_parts(block)
    boxes = {
        "UI": (330, 65, 390, 78), "SERVICE": (330, 215, 390, 78),
        "DATA": (330, 365, 390, 78), "CONTENT": (35, 535, 390, 78),
        "RIDE": (625, 535, 390, 78), "OUT": (330, 665, 390, 78),
        "FAMILY": (330, 785, 390, 78),
    }
    body = [
        text_block(35, 34, "責任分層：App 內收卡，聊天留在 LINE", size=25,
                   weight=700, anchor="start"),
        group_box(20, 45, 1010, 415, "遊喜樂與既有 yoxi"),
        group_box(20, 480, 1010, 150, "支援與企業能力"),
        group_box(20, 650, 1010, 230, "使用者主動分享後的外部區域"),
    ]
    for a, b, lab, dash in edges:
        if (a, b) == ("CONTENT", "DATA"):
            body.append(routed_edge("M 230 535 V 404 H 330", lab, 260, 394, dash))
        elif (a, b) == ("UI", "RIDE"):
            body.append(routed_edge("M 720 104 H 820 V 535", lab, 0, 0, dash))
        else:
            body.append(edge_between(boxes[a], boxes[b], lab, dash))
    body.extend(node(*boxes[k], labels[k], fill=(CREAM if k in {"UI", "FAMILY"} else WHITE), size=18)
                for k in boxes)
    body.append(text_block(740, 748, "跨出 App 後沒有資料回傳線", size=15,
                           weight=600, anchor="start"))
    return base_svg(1050, 900, "遊喜樂責任分層", source, digest, "\n  ".join(body))


def render_architecture(block: str, source: str, digest: str) -> str:
    labels, edges = graph_parts(block)
    boxes = {
        "APP": (55, 100, 300, 76), "DEMO": (55, 205, 300, 76),
        "EXPORT": (410, 150, 300, 76),
        "OS": (810, 100, 285, 76), "LINE": (810, 205, 285, 76),
        "FAMILY": (810, 310, 285, 76),
        "API": (435, 485, 300, 76),
        "PLACE": (55, 620, 300, 76), "VISIT": (435, 620, 300, 76),
        "BOOK": (815, 620, 300, 76),
        "DB": (245, 755, 300, 76), "STORAGE": (625, 755, 300, 76),
        "CMS": (55, 890, 260, 76), "JOB": (345, 890, 260, 76),
        "AI": (635, 890, 260, 76), "OPS": (925, 890, 190, 76),
        "ID": (55, 1135, 300, 76), "RIDE": (435, 1135, 300, 76),
        "POINTS": (815, 1135, 300, 76),
    }
    body = [
        text_block(30, 32, "完整服務架構：分享在裝置端交接", size=25, weight=700, anchor="start"),
        group_box(25, 50, 710, 350, "長輩行動端"),
        group_box(775, 50, 350, 350, "App 外：由使用者自行操作"),
        group_box(25, 435, 1100, 575, "遊喜樂新增服務"),
        group_box(25, 1080, 1100, 170, "既有 yoxi：接法待企業確認"),
    ]
    routes = {
        ("APP", "API"): ("M 355 138 H 380 V 420 H 585 V 485", "", 0, 0),
        ("DEMO", "API"): ("M 205 281 V 420 H 585 V 485", "", 0, 0),
        ("APP", "EXPORT"): ("M 355 138 H 382 V 188 H 410", "", 0, 0),
        ("DEMO", "EXPORT"): ("M 355 243 H 382 V 188 H 410", "", 0, 0),
        ("EXPORT", "OS"): ("M 710 188 H 755 V 138 H 810", "", 0, 0),
        ("API", "ID"): ("M 435 523 H 35 V 1060 H 205 V 1135", "", 0, 0),
        ("APP", "RIDE"): ("M 55 138 H 15 V 1050 H 585 V 1135", "", 0, 0),
        ("API", "PLACE"): ("M 435 523 H 385 V 580 H 205 V 620", "", 0, 0),
        ("API", "BOOK"): ("M 735 523 H 785 V 580 H 965 V 620", "", 0, 0),
        ("API", "OPS"): ("M 735 523 H 1120 V 928 H 1115", "", 0, 0),
        ("RIDE", "VISIT"): ("M 585 1135 V 1060 H 1135 V 580 H 585 V 620", "授權行程事件", 930, 1050),
        ("VISIT", "DB"): ("M 585 696 V 725 H 395 V 755", "", 0, 0),
        ("PLACE", "DB"): ("M 205 696 V 725 H 395 V 755", "", 0, 0),
        ("BOOK", "DB"): ("M 965 696 V 725 H 395 V 755", "", 0, 0),
        ("VISIT", "STORAGE"): ("M 585 696 V 725 H 775 V 755", "", 0, 0),
        ("CMS", "DB"): ("M 185 890 V 855 H 395 V 831", "", 0, 0),
        ("CMS", "STORAGE"): ("M 185 890 V 840 H 775 V 831", "", 0, 0),
        ("AI", "CMS"): ("M 635 928 H 625 V 990 H 185 V 966", "", 0, 0),
        ("JOB", "OPS"): ("M 475 890 V 860 H 1020 V 890", "", 0, 0),
        ("BOOK", "POINTS"): ("M 1115 658 H 1135 V 1173 H 1115", "", 0, 0),
    }
    for a, b, lab, dash in edges:
        if (a, b) in routes:
            path, route_label, lx, ly = routes[(a, b)]
            body.append(routed_edge(path, route_label or lab, lx, ly, dash))
        else:
            body.append(edge_between(boxes[a], boxes[b], lab, dash))
    body.extend(node(*boxes[k], labels[k], fill=(CREAM if k in {"APP", "FAMILY", "CMS", "ID", "RIDE", "POINTS"} else WHITE), size=17)
                for k in boxes)
    body.append('<line x1="55" y1="1290" x2="135" y2="1290" class="edge dashed" marker-end="none"/>')
    body.append(text_block(155, 1296, "虛線：跨平台移交或企業接點；LINE 區域沒有回傳線", size=15, anchor="start"))
    return base_svg(1150, 1325, "遊喜樂完整服務架構", source, digest, "\n  ".join(body))


def render_expo_stack(block: str, source: str, digest: str) -> str:
    labels, edges = graph_parts(block)
    boxes = {
        "BUILD": (500, 105, 370, 78), "UI": (365, 240, 370, 78),
        "ROUTER": (35, 390, 300, 78), "DEVICE": (365, 390, 300, 78),
        "SHARE": (695, 390, 330, 78), "ADAPTER": (185, 575, 370, 78),
        "MOCK": (35, 730, 300, 78), "API": (390, 730, 300, 78),
        "CLOUD": (390, 865, 300, 78), "LINE": (755, 575, 270, 78),
    }
    body = [
        text_block(30, 34, "Expo 行動端技術棧與替換邊界", size=25, weight=700, anchor="start"),
        group_box(20, 50, 1020, 435, "行動端：React Native / TypeScript"),
        group_box(20, 500, 700, 470, "服務介面：demo 與正式後端共用契約"),
        group_box(740, 500, 300, 185, "App 外"),
    ]
    routes = {
        ("BUILD", "UI"): ("M 685 183 V 210 H 550 V 240", "", 0, 0),
        ("UI", "ROUTER"): ("M 365 279 H 185 V 390", "", 0, 0),
        ("UI", "DEVICE"): ("M 550 318 V 390", "", 0, 0),
        ("UI", "SHARE"): ("M 735 279 H 860 V 390", "", 0, 0),
        ("UI", "ADAPTER"): ("M 735 279 H 680 V 500 H 700 V 614 H 555", "", 0, 0),
        ("SHARE", "LINE"): ("M 860 468 V 575", "", 0, 0),
        ("ADAPTER", "MOCK"): ("M 185 614 H 145 V 730", "", 0, 0),
        ("ADAPTER", "API"): ("M 555 614 H 540 V 730", "正式串接時切換", 610, 680),
    }
    for a, b, lab, dash in edges:
        if (a, b) in routes:
            path, route_label, lx, ly = routes[(a, b)]
            body.append(routed_edge(path, route_label or lab, lx, ly, dash))
        else:
            body.append(edge_between(boxes[a], boxes[b], lab, dash))
    body.extend(node(*boxes[k], labels[k], fill=(CREAM if k in {"BUILD", "MOCK", "LINE"} else WHITE), size=17)
                for k in boxes)
    body.append(text_block(45, 1000, "同一組 Ride / Places / Postcards 介面，先接明示 mock，後續換成授權 API。",
                           size=16, weight=600, anchor="start"))
    return base_svg(1060, 1030, "Expo 行動端技術棧", source, digest, "\n  ".join(body))


def render_evolution(block: str, source: str, digest: str) -> str:
    labels, edges = graph_parts(block)
    boxes = {
        "WEB": (35, 100, 300, 88), "EXPO": (455, 100, 300, 88),
        "CONTRACT": (875, 100, 300, 88), "MOCK": (875, 280, 300, 88),
        "BACKEND": (455, 460, 300, 88), "YOXI": (35, 460, 300, 88),
    }
    body = [
        text_block(35, 40, "從現有原型走向企業接入", size=25, weight=700, anchor="start"),
        text_block(35, 72, "每一步都有可展示產物；虛線表示尚待驗證或授權。", size=16, anchor="start"),
    ]
    routes = {
        ("CONTRACT", "BACKEND"): ("M 1025 188 V 415 H 605 V 460", "通過企業驗證後", 815, 405),
        ("YOXI", "BACKEND"): ("M 335 504 H 455", "", 0, 0),
    }
    for a, b, lab, dash in edges:
        if (a, b) in routes:
            path, route_label, lx, ly = routes[(a, b)]
            body.append(routed_edge(path, route_label or lab, lx, ly, dash))
        else:
            body.append(edge_between(boxes[a], boxes[b], lab, dash))
    body.extend(node(*boxes[k], labels[k], fill=(CREAM if k in {"WEB", "MOCK"} else WHITE), size=17)
                for k in boxes)
    return base_svg(1210, 585, "技術演進路線", source, digest, "\n  ".join(body))


def render_flow(block: str, source: str, digest: str) -> str:
    labels, edges = graph_parts(block)
    boxes = {
        "A": (90, 130, 430, 70), "B": (90, 245, 430, 70),
        "C": (90, 360, 430, 70), "D": (90, 475, 430, 70),
        "E": (90, 590, 430, 82), "F": (90, 720, 430, 82),
        "G": (565, 720, 335, 82), "H": (90, 850, 430, 70),
        "R": (565, 475, 335, 82), "OS": (290, 1080, 400, 82),
        "I": (290, 1315, 400, 70), "J": (290, 1430, 400, 82),
        "K": (290, 1560, 400, 70),
    }
    body = [
        text_block(35, 35, "使用流程：收藏與回程不等待分享結果", size=25, weight=700, anchor="start"),
        group_box(30, 55, 920, 905, "App 內：出行與收藏"),
        group_box(30, 1250, 920, 410, "App 外：LINE，不回傳聊天資料"),
    ]
    routes = {
        ("D", "R"): ("M 520 510 H 565", "", 0, 0),
        ("F", "G"): ("M 520 761 H 565", "", 0, 0),
        ("H", "OS"): ("M 305 920 V 1080", "", 0, 0),
    }
    for a, b, lab, dash in edges:
        if (a, b) in routes:
            path, route_label, lx, ly = routes[(a, b)]
            body.append(routed_edge(path, route_label or lab, lx, ly, dash))
        else:
            body.append(edge_between(boxes[a], boxes[b], lab, dash))
    body.extend(node(*boxes[k], labels[k], fill=(CREAM if k in {"F", "OS", "K"} else WHITE), size=18)
                for k in boxes)
    body.append(text_block(55, 1000, "分享出口", size=15, weight=700, anchor="start"))
    body.append(text_block(55, 1035, "圖片交給系統面板後，App 不知道收件人、已讀或回覆。",
                           size=15, anchor="start"))
    return base_svg(980, 1690, "遊喜樂使用流程", source, digest, "\n  ".join(body))


def render_share_boundary(block: str, source: str, digest: str) -> str:
    labels, edges = graph_parts(block)
    boxes = {
        "CARD": (55, 120, 260, 76), "TAP": (355, 120, 250, 76),
        "EVENT": (645, 120, 300, 76), "OS": (305, 365, 370, 82),
        "LINE": (155, 620, 300, 82), "CHAT": (525, 620, 350, 82),
    }
    body = [
        text_block(35, 36, "分享與量測邊界", size=25, weight=700, anchor="start"),
        group_box(25, 60, 950, 180, "我們能處理與量測"),
        group_box(25, 560, 950, 185, "App 外：子女資料不回傳 yoxi"),
    ]
    routes = {
        ("TAP", "OS"): ("M 480 196 V 365", "移交圖片", 560, 315),
        ("OS", "LINE"): ("M 490 447 V 520 H 470 V 661 H 455", "", 0, 0),
    }
    for a, b, lab, dash in edges:
        if (a, b) in routes:
            path, route_label, lx, ly = routes[(a, b)]
            body.append(routed_edge(path, route_label or lab, lx, ly, dash))
        else:
            body.append(edge_between(boxes[a], boxes[b], lab, dash))
    body.extend(node(*boxes[k], labels[k], fill=(CREAM if k in {"OS", "CHAT"} else WHITE), size=18)
                for k in boxes)
    body.append(text_block(510, 505, "責任交接點", size=16, weight=700))
    body.append(text_block(500, 795, "沒有從 LINE 或聊天回到己方事件的箭頭。", size=16, weight=600))
    return base_svg(1000, 830, "分享與資料邊界", source, digest, "\n  ".join(body))


def parse_sequence(block: str):
    actors = []
    messages = []
    for raw in block.splitlines():
        line = raw.strip()
        m = re.match(r'(actor|participant)\s+(\w+)\s+as\s+(.+)', line)
        if m:
            actors.append((m.group(2), m.group(3)))
            continue
        m = re.match(r'(\w+)(-->>|->>)(\w+):\s*(.+)', line)
        if m:
            messages.append((m.group(1), m.group(3), m.group(4), m.group(2) == "-->>"))
    return actors, messages


def render_sequence(block: str, source: str, digest: str) -> str:
    actors, messages = parse_sequence(block)
    xs = {key: 100 + i * 195 for i, (key, _) in enumerate(actors)}
    top, step = 115, 72
    bottom = top + 80 + len(messages) * step
    body = [text_block(40, 38, "主要系統時序", size=24, weight=700, anchor="start")]
    for key, label in actors:
        x = xs[key]
        body.append(node(x - 78, 62, 156, 54, label, fill=(CREAM if key in {"U", "C"} else WHITE), size=16))
        body.append(f'<line x1="{x}" y1="116" x2="{x}" y2="{bottom}" stroke="{SLATE}" stroke-width="1.5" stroke-dasharray="5 6"/>')
    for i, (a, b, label, reply) in enumerate(messages):
        y = top + 62 + i * step
        x1, x2 = xs[a], xs[b]
        if a == b:
            body.append(f'<path d="M {x1} {y} h 62 v 28 h -62" class="edge"/>')
            wrapped = "\n".join(textwrap.wrap(label, width=10, break_long_words=True,
                                                break_on_hyphens=False))
            body.append(text_block(x1 + 72, y + 12, wrapped, size=17, anchor="start", line_h=20))
        else:
            klass = "edge dashed" if reply else "edge"
            body.append(f'<line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}" class="{klass}"/>')
            chars = max(9, int(abs(x2-x1) / 18) - 2)
            wrapped = "\n".join(textwrap.wrap(label, width=chars, break_long_words=True,
                                                break_on_hyphens=False))
            line_count = wrapped.count("\n") + 1
            body.append(f'<rect class="label-bg" x="{min(x1,x2)+6}" y="{y-43}" width="{abs(x2-x1)-12}" height="{22*line_count}" rx="4"/>')
            body.append(text_block((x1+x2)/2, y-18, wrapped, size=17, line_h=20))
    return base_svg(1600, bottom + 35, "遊喜樂主要系統時序", source, digest, "\n  ".join(body))


def render_linear(block: str, source: str, digest: str, title: str, horizontal: bool) -> str:
    labels, edges = graph_parts(block)
    keys = list(labels)
    if horizontal:
        width, height = 1100, 520
        boxes = {k: (45 + (i % 3) * 355, 105 + (i // 3) * 205, 300, 92)
                 for i, k in enumerate(keys)}
    else:
        width, height = 900, 1040
        boxes = {k: (210, 65 + i * 125, 480, 78) for i, k in enumerate(keys)}
    body = [text_block(35, 40, title, size=24, weight=700, anchor="start")]
    for a, b, lab, dash in edges:
        if horizontal and (a, b) == ("G", "V"):
            ax, ay, aw, ah = boxes[a]; bx, by, bw, bh = boxes[b]
            body.append(routed_edge(f'M {ax+aw/2} {ay+ah} V 250 H {bx+bw/2} V {by}', lab,
                                    (ax+aw/2+bx+bw/2)/2, 242, dash))
        elif horizontal and keys.index(b) <= keys.index(a):
            ax, ay, aw, ah = boxes[a]; bx, by, bw, bh = boxes[b]
            x1, loop_y = ax + aw / 2, 470
            body.append(routed_edge(f'M {x1} {ay+ah} V {loop_y} H 20 V {by+bh/2} H {bx}',
                                    lab, 175, loop_y-8, dash))
        else:
            body.append(edge_between(boxes[a], boxes[b], lab, dash))
    body.extend(node(*boxes[k], labels[k], fill=(CREAM if i in {0, len(keys)-1} else WHITE), size=16)
                for i, k in enumerate(keys))
    return base_svg(width, height, title, source, digest, "\n  ".join(body))


def render_ai_pipeline(block: str, source: str, digest: str) -> str:
    return render_linear(block, source, digest, "AI 文案編審管線", True)


def render_archived_cards(block: str, source: str, digest: str) -> str:
    return render_linear(block, source, digest, "備存卡片規則流程", False)


RENDERERS = {
    "service-layers": render_service_layers,
    "architecture": render_architecture,
    "expo-stack": render_expo_stack,
    "evolution": render_evolution,
    "flow": render_flow,
    "share-boundary": render_share_boundary,
    "sequence": render_sequence,
    "ai-pipeline": render_ai_pipeline,
    "archived-cards": render_archived_cards,
}


def build(layout: str, block: str, source: str, digest: str) -> str:
    return RENDERERS[layout](block, source, digest)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify source pins and committed SVG bytes")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    failed = False
    for name, (relative, index, expected, layout) in SPECS.items():
        blocks = mermaid_blocks(ROOT / relative)
        if index >= len(blocks):
            print(f"FAIL {name}: {relative} Mermaid block #{index + 1} is missing")
            failed = True
            continue
        block = blocks[index]
        actual = hashlib.sha256(block.encode("utf-8")).hexdigest()
        if actual != expected:
            print(f"FAIL {name}: source changed ({actual}); review layout and update its pinned hash")
            failed = True
            continue
        rendered = build(layout, block, relative, actual)
        target = OUT / name
        if args.check:
            if not target.exists() or target.read_text(encoding="utf-8") != rendered:
                print(f"FAIL {name}: generated SVG is missing or stale")
                failed = True
            else:
                print(f"PASS {name}: source and SVG match")
        else:
            target.write_text(rendered, encoding="utf-8", newline="\n")
            print(f"WROTE {target.relative_to(ROOT)}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
