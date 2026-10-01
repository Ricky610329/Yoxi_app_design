"""Build the standalone review proposal; never touches the existing video pipeline.

    python pitch/video/build-demo-storyboard.py
Source: shots-demo-scenarios.json + demo-scenarios.template.html.
"""
import base64
import io
import json
import re
from pathlib import Path
from PIL import Image

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
data['images'] = {}
for name in sorted({s['asset'] for s in shots if 'asset' in s}):
    image = Image.open(ROOT / 'app/assets/shots' / f'{name}.png').convert('RGB')
    blob = io.BytesIO()
    image.save(blob, format='JPEG', quality=92, optimize=True)
    data['images'][name] = 'data:image/jpeg;base64,' + base64.b64encode(blob.getvalue()).decode('ascii')
template = (HERE / 'demo-scenarios.template.html').read_text(encoding='utf-8')
tokens = (ROOT / 'prototype/css/tokens.css').read_text(encoding='utf-8')
html = template.replace('/*TOKENS*/', tokens).replace('/*DATA*/', json.dumps(data, ensure_ascii=False).replace('</', '<\\/'))
target = HERE / 'storyboard-demo-scenarios.html'
target.write_text(html, encoding='utf-8')
print(f'PASS: {len(shots)} shots, 180 seconds, narration <= 25 characters per sentence')
print(f'Wrote {target.name} ({target.stat().st_size:,} bytes); all assets embedded.')
