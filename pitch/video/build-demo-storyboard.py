"""Build the standalone review proposal; never touches the existing video pipeline.

    python pitch/video/build-demo-storyboard.py
Source: shots-demo-scenarios.json + demo-scenarios.template.html.
"""
import html
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
data = json.loads((HERE / 'shots-demo-scenarios.json').read_text(encoding='utf-8'))
shots = data['shots']
assert sum(s['duration'] for s in shots) == 180
assert len({s['id'] for s in shots}) == len(shots)
for shot in shots:
    assert shot['beats'][0][0] == 0
    assert [b[0] for b in shot['beats']] == sorted(set(b[0] for b in shot['beats']))
    assert all(0 <= b[0] < shot['duration'] for b in shot['beats'])
    copy = ''.join(shot['narration']) + shot['headline'] + shot['subline']
    assert not re.search('任務|完成|達成|挑戰|每日', copy), shot['id']
    for sentence in shot['narration']:
        assert len(re.sub(r'[\s，。、「」：；！？·]', '', sentence)) <= 25, (shot['id'], sentence)
e = html.escape
def tc(seconds):
    return f'{seconds // 60:02d}:{seconds % 60:02d}'

cursor = 0
for shot in shots:
    shot['start'] = cursor
    cursor += shot['duration']
    shot['end'] = cursor

purposes = {
    '開場': '長輩想出門；遊喜樂給她一個開始。',
    '產品 Demo': '探索、前往、收卡、收藏與回憶卡的實際操作。',
    '生活情境': '附近散步、朋友出遊、向家人分享。',
    'AI 與價值': '內容如何供應，探索如何接回叫車。',
    '結尾': '回到長輩自己的出遊紀念。',
}
navigation = ['<a href="#overview">概要</a>']
schedule = []
for group in data['groups']:
    rows = [s for s in shots if s['group'] == group]
    anchor = 'shot-' + rows[0]['id']
    navigation.append(f'<a href="#{anchor}">{e(group)}</a>')
    schedule.append(f'<tr><td>{tc(rows[0]["start"])}–{tc(rows[-1]["end"])}</td>'
                    f'<td>{e(group)}</td><td>{e(purposes[group])}</td></tr>')

articles = []
for s in shots:
    beats = ''.join(f'<li><time>{tc(s["start"] + t)}</time><span>{e(text)}</span></li>' for t, text in s['beats'])
    narration = '<br>'.join(e(line) for line in s['narration'])
    route = f'<p>操作路徑：{e(s["route"])}</p>' if s.get('route') else ''
    articles.append(f'''<article class="shot" id="shot-{s['id']}">
      <div class="shot-meta"><span>第 {s['id']} 鏡 · {e(s['group'])}</span><span>{tc(s['start'])}–{tc(s['end'])} / {s['duration']} 秒</span></div>
      <h2>{e(s['title'])}</h2>
      <h3>建議畫面</h3><p class="description">{e(s['visual'])}</p>
      <ul class="beats">{beats}</ul>
      <div class="copy"><div><h3>旁白</h3><blockquote>{narration}</blockquote></div>
      <div class="words"><h3>畫面字詞</h3><p><strong>{e(s['headline'])}</strong></p><p class="secondary">{e(s['subline'])}</p></div></div>
      <p class="sound">聲音：{e(s['sound'])}</p>
      <details><summary>拍攝提醒與來源</summary><p>{e(s['note'])}</p>{route}<p>來源：{e(s['source'])}</p></details>
    </article>''')
template = (HERE / 'demo-scenarios.template.html').read_text(encoding='utf-8')
tokens = (ROOT / 'prototype/css/tokens.css').read_text(encoding='utf-8')
replacements = {'TOKENS': tokens, 'TOTAL': tc(cursor), 'COUNT': str(len(shots)),
                'NAV': ''.join(navigation), 'SUMMARY': e(data['summary']),
                'SCHEDULE': ''.join(schedule), 'SHOTS': '\n'.join(articles)}
page = template
for key, value in replacements.items():
    page = page.replace(f'/*{key}*/', value)
target = HERE / 'storyboard-demo-scenarios.html'
target.write_text(page, encoding='utf-8')
print(f'PASS: {len(shots)} shots, 180 seconds, narration <= 25 characters per sentence')
print(f'Wrote {target.name} ({target.stat().st_size:,} bytes); text only, no images or JavaScript.')
