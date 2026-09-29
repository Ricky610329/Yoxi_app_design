#!/usr/bin/env python3
"""Render the five pitch/writing Mermaid blocks as dependency-free SVG files.

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

SPECS = {
    "architecture.svg": ("pitch/writing/01-solution-architecture.md", 0,
                         "eeccddb48cdc2321b28d3690e7689232d8a47c81f2badb3bfff2e72c9130c3c0"),
    "flow.svg": ("pitch/writing/02-flow-design.md", 0,
                 "2d9e96c988ba866e3c8673ffc9074d9b7850b3866e49618a73040e4125bba6cd"),
    "sequence.svg": ("pitch/writing/02-flow-design.md", 1,
                     "164c112acad6afb008403af23788e7847b0dc3b829c5017268e7c62b0da85742"),
    "ai-pipeline.svg": ("pitch/writing/03-ai-and-tools.md", 0,
                       "3d83ecdb0dbef771d772ded3bb12720d77ca20bcac11ed823d9322657877a778"),
    "archived-cards.svg": ("pitch/writing/notes/optional-card-ideas.md", 0,
                          "ed7b42faafef5d2914d5b97f6e3052fad8c6bf1b13da0ef5c6ef56baca3177ae"),
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


def render_architecture(block: str, source: str, digest: str) -> str:
    labels, edges = graph_parts(block)
    boxes = {
        "APP": (55, 125, 350, 76), "FAMILY": (55, 230, 350, 76), "DEMO": (55, 335, 350, 76),
        "API": (515, 100, 250, 76), "PLACE": (825, 75, 290, 76), "VISIT": (825, 180, 290, 76),
        "SHARE": (825, 285, 290, 76), "BOOK": (825, 390, 290, 76),
        "DB": (1210, 135, 320, 76), "STORAGE": (1210, 300, 320, 76),
        "CMS": (515, 565, 280, 76), "JOB": (875, 565, 280, 76), "AI": (1235, 565, 280, 76),
        "OPS": (875, 735, 280, 76),
        "ID": (70, 1020, 300, 76), "RIDE": (445, 1020, 330, 76),
        "LINE": (855, 1020, 300, 76), "POINTS": (1230, 1020, 300, 76),
    }
    body = [
        '<rect class="group" x="25" y="55" width="410" height="405"/>',
        text_block(50, 90, "使用者端", size=22, weight=700, anchor="start"),
        '<rect class="group" x="475" y="30" width="1090" height="865"/>',
        text_block(500, 68, "遊喜樂新增服務", size=22, weight=700, anchor="start"),
        '<rect class="group" x="25" y="950" width="1540" height="200"/>',
        text_block(50, 988, "既有／外部服務：接法待確認", size=22, weight=700, anchor="start"),
    ]
    routes = {
        ("CMS", "DB"): ("M 655 565 V 500 H 1545 V 173 H 1530", "", 0, 0),
        ("CMS", "STORAGE"): ("M 795 603 V 690 H 1550 V 338 H 1530", "", 0, 0),
        ("AI", "CMS"): ("M 1375 641 V 680 H 655 V 641", "", 0, 0),
        ("APP", "LINE"): ("M 230 201 V 925 H 1005 V 1020", "", 0, 0),
        ("API", "ID"): ("M 515 138 H 455 V 925 H 220 V 1020", "", 0, 0),
        ("RIDE", "VISIT"): ("M 610 1020 V 925 H 800 V 218 H 825", "授權行程事件", 800, 905),
        ("LINE", "FAMILY"): ("M 1005 1020 V 925 H 455 V 268 H 405", "分享連結", 560, 913),
        ("BOOK", "POINTS"): ("M 1115 428 H 1175 V 925 H 1380 V 1020", "", 0, 0),
    }
    for a, b, lab, dash in edges:
        if (a, b) in routes:
            path, route_label, lx, ly = routes[(a, b)]
            body.append(routed_edge(path, route_label or lab, lx, ly, dash))
        else:
            body.append(edge_between(boxes[a], boxes[b], lab, dash))
    body.extend(node(*boxes[k], labels[k], fill=(CREAM if k in {"CMS", "ID", "RIDE", "LINE", "POINTS"} else WHITE), size=18)
                for k in boxes)
    body.append('<line x1="520" y1="860" x2="600" y2="860" class="edge dashed" marker-end="none"/>')
    body.append(text_block(618, 866, "虛線：既有／外部介接（含授權行程與分享連結）", size=14, anchor="start"))
    return base_svg(1590, 1180, "遊喜樂服務架構", source, digest, "\n  ".join(body))


def render_flow(block: str, source: str, digest: str) -> str:
    labels, edges = graph_parts(block)
    boxes = {
        "A": (100, 70, 380, 66), "B": (100, 175, 380, 66), "C": (100, 280, 380, 66),
        "D": (100, 385, 380, 66), "E": (100, 490, 380, 66), "F": (100, 595, 380, 82),
        "G": (100, 720, 380, 82), "H": (100, 845, 380, 82), "I": (100, 970, 380, 66),
        "J": (100, 1075, 380, 66), "K": (100, 1180, 380, 66), "L": (100, 1285, 380, 66),
        "M": (625, 845, 420, 82), "R": (625, 490, 420, 66), "S": (625, 595, 420, 66),
    }
    body = [text_block(70, 38, "主要體驗流程", size=24, weight=700, anchor="start")]
    body.extend(edge_between(boxes[a], boxes[b], lab, dash) for a, b, lab, dash in edges)
    body.extend(node(*boxes[k], labels[k], fill=(CREAM if k in {"G", "M"} else WHITE), size=17) for k in boxes)
    return base_svg(1120, 1410, "遊喜樂主要體驗流程", source, digest, "\n  ".join(body))


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


def build(name: str, block: str, source: str, digest: str) -> str:
    if name == "architecture.svg":
        return render_architecture(block, source, digest)
    if name == "flow.svg":
        return render_flow(block, source, digest)
    if name == "sequence.svg":
        return render_sequence(block, source, digest)
    if name == "ai-pipeline.svg":
        return render_linear(block, source, digest, "AI 文案編審管線", True)
    return render_linear(block, source, digest, "備存卡片規則流程", False)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify source pins and committed SVG bytes")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    failed = False
    for name, (relative, index, expected) in SPECS.items():
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
        rendered = build(name, block, relative, actual)
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
