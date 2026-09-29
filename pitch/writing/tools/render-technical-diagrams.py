#!/usr/bin/env python3
"""Render the five native SVG diagrams used by the eight-page technical proposal.

The script intentionally uses only Python's standard library.  Colours are read
from prototype/css/tokens.css so the proposal stays aligned with the product
prototype rather than maintaining a second palette.
"""

from __future__ import annotations

import argparse
import re
import xml.etree.ElementTree as ET
from pathlib import Path


SVG = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG)

ROOT = Path(__file__).resolve().parents[3]
TOKENS_PATH = ROOT / "prototype" / "css" / "tokens.css"
DEFAULT_OUTPUT = ROOT / "pitch" / "writing" / "assets" / "technical"


def load_palette(path: Path) -> dict[str, str]:
    css = path.read_text(encoding="utf-8")
    names = (
        "yoxi-red",
        "yoxi-red-soft",
        "yoxi-navy",
        "yoxi-navy-soft",
        "yoxi-cream",
        "yoxi-cream-deep",
        "yoxi-mist",
        "yoxi-paper",
        "yoxi-slate",
        "yoxi-slate-lite",
        "yoxi-line",
        "yoxi-white",
        "gold-lite",
    )
    palette: dict[str, str] = {}
    for name in names:
        match = re.search(rf"--{re.escape(name)}:\s*([^;]+);", css)
        if not match:
            raise ValueError(f"Missing colour token --{name} in {path}")
        palette[name] = match.group(1).strip()
    return palette


P = load_palette(TOKENS_PATH)
FONT = "Noto Sans TC, Microsoft JhengHei, PingFang TC, sans-serif"


def el(parent: ET.Element, tag: str, **attrs: object) -> ET.Element:
    cooked = {key.replace("_", "-"): str(value) for key, value in attrs.items()}
    return ET.SubElement(parent, f"{{{SVG}}}{tag}", cooked)


def new_svg(height: int, title: str, desc: str) -> ET.Element:
    root = ET.Element(
        f"{{{SVG}}}svg",
        {
            "width": "760",
            "height": str(height),
            "viewBox": f"0 0 760 {height}",
            "role": "img",
            "aria-labelledby": "diagram-title diagram-desc",
        },
    )
    el(root, "title", id="diagram-title").text = title
    el(root, "desc", id="diagram-desc").text = desc
    defs = el(root, "defs")
    style = el(defs, "style")
    style.text = (
        f"text {{ font-family: {FONT}; }}"
        ".label { font-size: 16px; font-weight: 500; }"
        ".strong { font-size: 18px; font-weight: 700; }"
        ".title { font-size: 24px; font-weight: 800; }"
        ".line { fill: none; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }"
    )
    for marker_id, colour in (("arrow", P["yoxi-navy"]), ("arrow-muted", P["yoxi-slate"])):
        marker = el(
            defs,
            "marker",
            id=marker_id,
            viewBox="0 0 10 10",
            refX="9",
            refY="5",
            markerWidth="7",
            markerHeight="7",
            markerUnits="userSpaceOnUse",
            orient="auto-start-reverse",
        )
        el(marker, "path", d="M 0 0 L 10 5 L 0 10 z", fill=colour)
    el(root, "rect", x="0", y="0", width="760", height=str(height), fill=P["yoxi-paper"])
    return root


def text(
    parent: ET.Element,
    x: float,
    y: float,
    value: str,
    *,
    size: int = 16,
    weight: int = 500,
    colour: str | None = None,
    anchor: str = "start",
    klass: str | None = None,
) -> ET.Element:
    node = el(
        parent,
        "text",
        x=x,
        y=y,
        font_size=f"{size}px",
        font_weight=weight,
        fill=colour or P["yoxi-navy"],
        text_anchor=anchor,
        **({"class": klass} if klass else {}),
    )
    node.text = value
    return node


def multiline(
    parent: ET.Element,
    x: float,
    center_y: float,
    lines: list[str] | tuple[str, ...],
    *,
    size: int = 16,
    weight: int = 500,
    colour: str | None = None,
    anchor: str = "middle",
    leading: int = 22,
) -> ET.Element:
    start_y = center_y - (len(lines) - 1) * leading / 2
    node = el(
        parent,
        "text",
        x=x,
        y=start_y,
        font_size=f"{size}px",
        font_weight=weight,
        fill=colour or P["yoxi-navy"],
        text_anchor=anchor,
    )
    for index, line in enumerate(lines):
        span = el(node, "tspan", x=x, dy="0" if index == 0 else leading)
        span.text = line
    return node


def rect(
    parent: ET.Element,
    x: float,
    y: float,
    width: float,
    height: float,
    *,
    fill: str,
    stroke: str | None = None,
    stroke_width: float = 1.5,
    dash: str | None = None,
    radius: int = 8,
) -> ET.Element:
    attrs: dict[str, object] = {
        "x": x,
        "y": y,
        "width": width,
        "height": height,
        "rx": radius,
        "fill": fill,
    }
    if stroke:
        attrs.update(stroke=stroke, stroke_width=stroke_width)
    if dash:
        attrs["stroke_dasharray"] = dash
    return el(parent, "rect", **attrs)


def box(
    parent: ET.Element,
    x: float,
    y: float,
    width: float,
    height: float,
    lines: list[str] | tuple[str, ...],
    *,
    fill: str | None = None,
    stroke: str | None = None,
    weight: int = 700,
    size: int = 16,
    dash: str | None = None,
    colour: str | None = None,
) -> None:
    rect(
        parent,
        x,
        y,
        width,
        height,
        fill=fill or P["yoxi-white"],
        stroke=stroke or P["yoxi-line"],
        dash=dash,
    )
    multiline(
        parent,
        x + width / 2,
        y + height / 2 + 1,
        lines,
        size=size,
        weight=weight,
        colour=colour,
    )


def path(
    parent: ET.Element,
    d: str,
    *,
    muted: bool = False,
    dashed: bool = False,
    arrow: bool = True,
    start_arrow: bool = False,
    width: float = 2,
) -> ET.Element:
    colour = P["yoxi-slate"] if muted else P["yoxi-navy"]
    attrs: dict[str, object] = {
        "d": d,
        "class": "line",
        "stroke": colour,
        "stroke_width": width,
    }
    if dashed:
        attrs["stroke_dasharray"] = "7 6"
    if arrow:
        attrs["marker_end"] = f"url(#{'arrow-muted' if muted else 'arrow'})"
    if start_arrow:
        attrs["marker_start"] = f"url(#{'arrow-muted' if muted else 'arrow'})"
    return el(parent, "path", **attrs)


def line(
    parent: ET.Element,
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    **kwargs: object,
) -> ET.Element:
    return path(parent, f"M {x1} {y1} L {x2} {y2}", **kwargs)


def tag(parent: ET.Element, x: float, y: float, width: float, value: str, *, fill: str | None = None) -> None:
    rect(parent, x, y, width, 32, fill=fill or P["yoxi-mist"], stroke=P["yoxi-line"], radius=8)
    text(parent, x + width / 2, y + 22, value, size=16, weight=700, anchor="middle")


def header(root: ET.Element, title_value: str, tag_value: str = "提案架構／待接入能力") -> None:
    text(root, 28, 37, title_value, size=24, weight=800)
    tag(root, 520, 16, 212, tag_value, fill=P["yoxi-cream"])


def render_system() -> ET.Element:
    root = new_svg(
        500,
        "遊喜樂整體系統分層",
        "App 介面、遊喜樂新增 API、共同資料與內容 AI 後台，以及既有 yoxi 授權接點之間的責任與連接。",
    )
    header(root, "整體系統分層")
    tag(root, 28, 52, 146, "UI 已有原型", fill=P["yoxi-mist"])
    tag(root, 184, 52, 166, "雲端服務待建", fill=P["yoxi-cream"])

    # Connectors are placed behind the responsibility boxes.
    line(root, 278, 155, 278, 222)
    line(root, 380, 155, 380, 222)
    line(root, 482, 155, 482, 222)
    path(root, "M 146 226 L 168 226", muted=True, dashed=True)
    path(root, "M 146 273 L 168 273", muted=True, dashed=True)

    rect(root, 24, 91, 712, 74, fill=P["yoxi-mist"], stroke=P["yoxi-line"])
    text(root, 40, 116, "App 介面｜現有 HTML / PWA 可操作原型", size=18, weight=700)
    box(root, 214, 121, 128, 34, ("探索",), fill=P["yoxi-white"])
    box(root, 356, 121, 128, 34, ("出行",), fill=P["yoxi-white"])
    box(root, 498, 121, 194, 34, ("收藏與回看",), fill=P["yoxi-white"])

    rect(root, 24, 186, 122, 126, fill=P["yoxi-paper"], stroke=P["yoxi-slate"], dash="7 6")
    multiline(root, 85, 212, ("既有 yoxi", "企業授權接入"), size=16, weight=700)
    text(root, 41, 253, "身分", size=16, weight=500)
    text(root, 41, 277, "行程／報價", size=16, weight=500)
    text(root, 41, 301, "支付", size=16, weight=500)

    rect(root, 168, 186, 568, 126, fill=P["yoxi-cream"], stroke=P["yoxi-cream-deep"])
    text(root, 186, 214, "遊喜樂新增 API｜模組化雲端服務待建", size=18, weight=700)
    box(root, 184, 228, 166, 68, ("地方與推薦", "內容、偏好、條件"), fill=P["yoxi-white"])
    box(root, 368, 228, 166, 68, ("到訪核對", "證據、規則、去重"), fill=P["yoxi-white"])
    box(root, 552, 228, 166, 68, ("收藏回憶", "紀錄、卡面、回看"), fill=P["yoxi-white"])

    rect(root, 168, 348, 568, 118, fill=P["yoxi-mist"], stroke=P["yoxi-line"])
    text(root, 186, 375, "共同資料與內容供給", size=18, weight=700)
    box(
        root,
        184,
        388,
        260,
        62,
        ("共同資料", "已審地方／卡面版本", "本人偏好／有效到訪／收藏"),
        fill=P["yoxi-white"],
    )
    box(
        root,
        462,
        388,
        256,
        62,
        ("內容 AI 後台", "批次產生 → 人工審核", "發布至共同資料"),
        fill=P["yoxi-white"],
    )
    # These relationships are drawn last so the panel fills cannot hide the
    # arrowheads at their boundaries.
    line(root, 267, 298, 267, 344, start_arrow=True)
    line(root, 451, 298, 451, 344, start_arrow=True)
    line(root, 635, 298, 635, 344, start_arrow=True)
    line(root, 462, 419, 444, 419, muted=True, dashed=True, width=2.5)
    text(root, 28, 488, "實線＝新增服務內部責任　虛線＝企業授權或發布接點", size=16, weight=500, colour=P["yoxi-slate"])
    return root


def render_data() -> ET.Element:
    root = new_svg(
        460,
        "資料流與權責",
        "內容、本人偏好、定位與授權行程證據如何形成推薦、有效到訪與收藏紀錄，並區分原型與正式資料責任。",
    )
    header(root, "資料流與權責")
    # Lane backgrounds.
    rect(root, 22, 76, 716, 102, fill=P["yoxi-cream"], stroke=P["yoxi-line"])
    rect(root, 22, 190, 716, 86, fill=P["yoxi-mist"], stroke=P["yoxi-line"])
    rect(root, 22, 288, 716, 118, fill=P["yoxi-paper"], stroke=P["yoxi-line"])
    text(root, 38, 103, "A 內容", size=18, weight=800)
    text(root, 38, 217, "B 偏好", size=18, weight=800)
    text(root, 38, 315, "C 到訪", size=18, weight=800)

    # Flow A.
    line(root, 223, 127, 246, 127)
    line(root, 383, 127, 406, 127)
    line(root, 553, 127, 576, 127)
    box(root, 102, 95, 121, 64, ("編輯／", "可信來源"), fill=P["yoxi-white"])
    box(root, 246, 95, 137, 64, ("查核", "與發布"), fill=P["yoxi-white"])
    box(root, 406, 91, 147, 72, ("地方及資產庫", "content_version"), fill=P["yoxi-white"])
    box(root, 576, 95, 143, 64, ("推薦／", "畫面呈現"), fill=P["yoxi-white"])

    # Flow B joins the recommendation path only after explicit permission.
    line(root, 242, 235, 270, 235)
    line(root, 420, 235, 448, 235)
    line(root, 584, 235, 612, 235)
    box(root, 102, 208, 140, 54, ("本人帳號",), fill=P["yoxi-white"])
    box(root, 270, 208, 150, 54, ("偏好授權",), fill=P["yoxi-white"])
    box(root, 448, 208, 136, 54, ("規則與排序",), fill=P["yoxi-white"])
    box(root, 612, 208, 107, 54, ("推薦",), fill=P["yoxi-white"])
    text(root, 103, 271, "帳號只界定本人資料與權限", size=16, weight=500, colour=P["yoxi-slate"])

    # Flow C.
    line(root, 221, 348, 236, 348)
    line(root, 359, 348, 374, 348)
    line(root, 479, 348, 494, 348)
    line(root, 604, 348, 619, 348)
    box(root, 102, 318, 119, 60, ("定位＋授權", "行程證據"), fill=P["yoxi-white"], size=16)
    box(root, 236, 318, 123, 60, ("到訪核對", "與去重"), fill=P["yoxi-white"])
    box(root, 374, 314, 105, 68, ("有效到訪", "visit_id"), fill=P["yoxi-white"])
    box(root, 494, 318, 110, 60, ("收藏紀錄",), fill=P["yoxi-white"])
    box(root, 619, 318, 100, 60, ("收藏回看",), fill=P["yoxi-white"])

    rect(root, 22, 418, 716, 30, fill=P["yoxi-navy"], stroke=P["yoxi-navy"])
    text(
        root,
        380,
        439,
        "正式有效紀錄由後端持有；現有原型僅以 localStorage 保存示意狀態",
        size=16,
        weight=700,
        colour=P["yoxi-white"],
        anchor="middle",
    )
    return root


def render_swimlane() -> ET.Element:
    root = new_svg(
        580,
        "從選地方到收藏回看的四泳道流程",
        "使用者、App、遊喜樂後端與既有 yoxi 之間的步行與搭車分支、到訪核對、發卡與收藏回看流程。",
    )
    header(root, "四泳道服務流程")
    # Four lanes.
    lanes = (
        (74, "使用者", P["yoxi-cream"]),
        (174, "App", P["yoxi-mist"]),
        (274, "遊喜樂後端", P["yoxi-cream"]),
        (374, "既有 yoxi", P["yoxi-mist"]),
    )
    for y, label, fill in lanes:
        rect(root, 22, y, 716, 92, fill=fill, stroke=P["yoxi-line"])
        text(root, 36, y + 52, label, size=18, weight=800)
        line(root, 132, y + 10, 132, y + 82, arrow=False, muted=True, width=1.5)

    # The main sequence; routes run through the open gaps between boxes.
    path(root, "M 214 119 L 214 201", muted=True)
    path(root, "M 214 236 L 214 301", muted=True)
    path(root, "M 284 301 L 284 236 L 316 236", muted=True)
    path(root, "M 388 194 L 388 144", muted=True)
    path(root, "M 350 144 L 350 394", muted=True, dashed=True)
    line(root, 446, 421, 482, 421, muted=True, dashed=True)
    path(root, "M 540 394 L 540 348", muted=True, dashed=True)
    path(root, "M 423 119 L 540 119 L 540 201", muted=True)
    path(root, "M 540 247 L 540 301", muted=True)
    path(root, "M 540 347 L 626 347", muted=True)
    path(root, "M 678 347 L 678 247", muted=True)
    path(root, "M 678 201 L 678 147", muted=True)

    # User lane.
    box(root, 150, 94, 128, 50, ("選地方",), fill=P["yoxi-white"])
    box(root, 316, 94, 144, 50, ("選步行或搭車",), fill=P["yoxi-white"])
    box(root, 604, 94, 112, 50, ("收藏回看",), fill=P["yoxi-white"])

    # App lane.
    box(root, 150, 194, 128, 54, ("取得內容", "與理由"), fill=P["yoxi-white"])
    box(root, 316, 194, 144, 54, ("顯示步行／", "搭車選項"), fill=P["yoxi-white"])
    box(root, 482, 194, 116, 54, ("提交定位＋", "可用證據"), fill=P["yoxi-white"])
    box(root, 620, 194, 96, 54, ("顯示卡片",), fill=P["yoxi-white"])

    # Backend lane.
    box(root, 150, 294, 134, 54, ("回傳已審", "地方內容"), fill=P["yoxi-white"])
    box(root, 482, 294, 116, 54, ("核對到訪", "與去重"), fill=P["yoxi-white"])
    box(root, 626, 294, 90, 54, ("發卡保存",), fill=P["yoxi-white"])

    # Existing yoxi lane.  Dashed border and connectors are enterprise touchpoints.
    box(root, 330, 394, 116, 54, ("本人確認後", "建立行程"), fill=P["yoxi-white"], dash="7 6", stroke=P["yoxi-slate"])
    box(root, 482, 394, 116, 54, ("授權行程", "證據"), fill=P["yoxi-white"], dash="7 6", stroke=P["yoxi-slate"])

    # Branch labels and status notes sit in dedicated whitespace.
    rect(root, 462, 143, 174, 27, fill=P["yoxi-cream"], stroke=None, radius=8)
    text(root, 549, 163, "步行可略過 yoxi", size=16, weight=700, colour=P["yoxi-slate"], anchor="middle")
    rect(root, 144, 378, 176, 31, fill=P["yoxi-mist"], stroke=None, radius=8)
    text(root, 232, 399, "搭車分支｜接點待串", size=16, weight=700, colour=P["yoxi-slate"], anchor="middle")
    rect(root, 22, 486, 716, 72, fill=P["yoxi-paper"], stroke=P["yoxi-line"])
    multiline(
        root,
        380,
        522,
        (
            "例外處理｜證據不足先進待核對，不重複發卡；",
            "內容或生成失敗改用已審模板，既有收藏仍可回看。",
        ),
        size=16,
        weight=500,
    )
    return root


def render_ai() -> ET.Element:
    root = new_svg(
        490,
        "AI 應用方法與人工閘門",
        "推薦、文字內容與圖像資產三條 AI 管線，包含來源、模型步驟、人工或規則檢查、發布位置與失敗回退。",
    )
    header(root, "AI 應用方法與治理")
    rows = (
        (74, "A 推薦", P["yoxi-mist"]),
        (190, "B 文字內容", P["yoxi-cream"]),
        (306, "C 圖像資產", P["yoxi-mist"]),
    )
    for y, label, fill in rows:
        rect(root, 22, y, 716, 102, fill=fill, stroke=P["yoxi-line"])
        text(root, 36, y + 25, label, size=18, weight=800)

    # Row A connectors and boxes.
    for x1, x2 in ((154, 172), (286, 304), (418, 436), (570, 588)):
        line(root, x1, 140, x2, 140)
    box(root, 34, 112, 120, 56, ("已審地方＋", "授權偏好"), fill=P["yoxi-white"])
    box(root, 172, 112, 114, 56, ("規則篩選", "與排序"), fill=P["yoxi-white"])
    box(root, 304, 112, 114, 56, ("模型產生", "短理由"), fill=P["yoxi-white"])
    box(root, 436, 112, 134, 56, ("來源／格式", "規則檢查"), fill=P["yoxi-white"], stroke=P["yoxi-navy"])
    box(root, 588, 112, 130, 56, ("App 呈現", "失敗用模板"), fill=P["yoxi-white"])

    # Row B connectors and boxes.
    for x1, x2 in ((170, 196), (332, 358), (494, 520)):
        line(root, x1, 256, x2, 256)
    box(root, 34, 228, 136, 56, ("可信來源片段",), fill=P["yoxi-white"])
    box(root, 196, 228, 136, 56, ("RAG／", "結構化草稿"), fill=P["yoxi-white"])
    box(root, 358, 228, 136, 56, ("編輯查核", "人工發布閘門"), fill=P["yoxi-navy"], stroke=P["yoxi-navy"], colour=P["yoxi-white"])
    box(root, 520, 228, 198, 56, ("版本化地方庫", "來源與版本可追溯"), fill=P["yoxi-white"])

    # Row C connectors and boxes.
    for x1, x2 in ((154, 172), (286, 304), (418, 436), (570, 588)):
        line(root, x1, 372, x2, 372)
    box(root, 34, 344, 120, 56, ("授權參考／", "風格規則"), fill=P["yoxi-white"])
    box(root, 172, 344, 114, 56, ("批次候選",), fill=P["yoxi-white"])
    box(root, 304, 344, 114, 56, ("人工審圖",), fill=P["yoxi-navy"], stroke=P["yoxi-navy"], colour=P["yoxi-white"])
    box(root, 436, 344, 134, 56, ("成品圖庫", "版本化發布"), fill=P["yoxi-white"])
    box(root, 588, 344, 130, 56, ("依抵達規則", "取用"), fill=P["yoxi-white"])

    rect(root, 22, 420, 716, 52, fill=P["yoxi-paper"], stroke=P["yoxi-navy"])
    multiline(
        root,
        380,
        446,
        (
            "治理邊界｜模型不核定車資、到訪或點數。本人回憶 AI 為未來選配；",
            "現況採本機模板。",
        ),
        size=16,
        weight=700,
        leading=20,
    )
    return root


def render_deployment() -> ET.Element:
    root = new_svg(
        285,
        "候選工具與部署對應",
        "App 或獨立 Expo 展示、FastAPI、Cloud Run、企業核可資料層，以及 AI 背景批次與人工簽核發布的候選部署。",
    )
    header(root, "候選工具與部署對應", "候選工具／全部待落地")
    text(root, 28, 68, "模型版本可配置；正式服務仍須企業資安、帳號與資料治理核可。", size=16, weight=500, colour=P["yoxi-slate"])

    # Top request path.
    line(root, 221, 118, 272, 118)
    line(root, 424, 118, 475, 118)
    box(root, 34, 88, 187, 60, ("App／PWA", "或 Expo 獨立 demo"), fill=P["yoxi-mist"])
    box(root, 272, 88, 152, 60, ("FastAPI／API", "Cloud Run 候選"), fill=P["yoxi-cream"])
    box(root, 475, 88, 251, 60, ("企業核可 DB＋Storage", "正式有效紀錄與版本資產"), fill=P["yoxi-mist"])

    # Background publishing path.
    path(root, "M 348 148 L 348 178 L 156 178 L 156 190", muted=True)
    line(root, 234, 220, 260, 220)
    line(root, 390, 220, 416, 220)
    line(root, 546, 220, 572, 220)
    path(root, "M 648 190 L 648 164 L 601 164 L 601 148", muted=True)
    box(root, 78, 190, 156, 60, ("背景批次 worker", "排程、重試、成本記錄"), fill=P["yoxi-white"])
    box(root, 260, 190, 130, 60, ("Gemini／Imagen", "版本可配置"), fill=P["yoxi-white"])
    box(root, 416, 190, 130, 60, ("編輯簽核", "人工發布閘門"), fill=P["yoxi-navy"], stroke=P["yoxi-navy"], colour=P["yoxi-white"])
    box(root, 572, 190, 154, 60, ("發布資產", "進入核可圖庫"), fill=P["yoxi-white"])
    return root


DIAGRAMS = {
    "system.svg": render_system,
    "data.svg": render_data,
    "swimlane.svg": render_swimlane,
    "ai.svg": render_ai,
    "deployment.svg": render_deployment,
}


def write_svg(root: ET.Element, path: Path) -> None:
    ET.indent(root, space="  ")
    tree = ET.ElementTree(root)
    tree.write(path, encoding="utf-8", xml_declaration=True)


def validate_svg(path: Path, expected_height: int) -> None:
    root = ET.parse(path).getroot()
    if root.tag != f"{{{SVG}}}svg":
        raise ValueError(f"{path}: root element is not SVG")
    if root.attrib.get("width") != "760" or root.attrib.get("height") != str(expected_height):
        raise ValueError(f"{path}: unexpected dimensions")
    if root.find(f"{{{SVG}}}title") is None or root.find(f"{{{SVG}}}desc") is None:
        raise ValueError(f"{path}: missing title or desc")
    for node in root.iter(f"{{{SVG}}}text"):
        raw = node.attrib.get("font-size")
        if raw and float(raw.removesuffix("px")) < 16:
            raise ValueError(f"{path}: text below 16px: {raw}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for filename, renderer in DIAGRAMS.items():
        root = renderer()
        output_path = args.output_dir / filename
        write_svg(root, output_path)
        expected_height = int(root.attrib["height"])
        validate_svg(output_path, expected_height)
        print(f"wrote {output_path.relative_to(ROOT)} (760x{expected_height})")


if __name__ == "__main__":
    main()
