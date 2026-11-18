"""Record the no-sign-in photos. Spends Pollen: run only after the cost is approved.
    POLLINATIONS_KEY=sk_... python tools/record.py <max Pollen>
Photos, titles and credits come from tools/photos.json (file paths relative to that file).
Uses the same prompts, grid, crops and parsing as the page (prompts and parsing come from js/look.js through node).
Writes recordings/looks.json and recordings/<n>.jpg. Person-checked answers are added afterwards with tools/human.py.
"""
import base64, io, json, os, random, subprocess, sys, time, urllib.request
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = 'https://gen.pollinations.ai'
KEY = os.environ['POLLINATIONS_KEY']
CAP = float(sys.argv[1])
PHOTOS = json.load(open(os.path.join(ROOT, 'tools', 'photos.json'), encoding='utf-8'))
DESCRIBE, CHECK, D_MAX, C_MAX, SIDE, CROP_MIN = 'z-ai/glm-5.3-flash', 'openai/gpt-6-luna', 2000, 600, 1024, 512
spent = 0.0


def look(fn, *args):  # call a function of js/look.js with JSON arguments
    src = f"const L=require({json.dumps(os.path.join(ROOT, 'js', 'look.js'))});const a=JSON.parse(require('fs').readFileSync(0,'utf8'));" \
          f"process.stdout.write(JSON.stringify(typeof L[a.fn]==='function'?L[a.fn](...a.args):L[a.fn]))"
    out = subprocess.run(['node', '-e', src], input=json.dumps({'fn': fn, 'args': list(args)}), capture_output=True, text=True, encoding='utf-8', check=True)
    return json.loads(out.stdout)


models = json.load(urllib.request.urlopen(API + '/v1/models'))['data']
PRICE = {}
for m in models:
    if m['id'] in (DESCRIBE, CHECK):
        if m.get('paid_only'): raise SystemExit('paid-only model refused ' + m['id'])
        p = m['pricing']; PRICE[m['id']] = (float(p.get('promptImageTokens') or p['promptTextTokens']), float(p['promptTextTokens']), float(p['completionTextTokens']))
assert set(PRICE) == {DESCRIBE, CHECK}, PRICE


def b64(im):
    b = io.BytesIO(); im.convert('RGB').save(b, 'JPEG', quality=85); return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()


def grid(im):
    g = im.copy(); d = ImageDraw.Draw(g); w, h = g.size
    for i in range(1, 4): d.line([(w * i / 4, 0), (w * i / 4, h)], fill='yellow', width=3)
    for j in range(1, 3): d.line([(0, h * j / 3), (w, h * j / 3)], fill='yellow', width=3)
    for i, c in enumerate('ABCD'):
        for j, r in enumerate('123'):
            x, y = w * i / 4 + 8, h * j / 3 + 6
            d.rectangle([x - 4, y - 2, x + 34, y + 26], fill='black'); d.text((x, y), c + r, fill='yellow', font_size=22)
    return g


def crop(im, cell):
    b = look('cellBox', im.width, im.height, cell)
    c = im.crop((b['x'], b['y'], b['x'] + b['w'], b['y'] + b['h'])); s = max(1, CROP_MIN / min(c.size))
    return c.resize((round(c.width * s), round(c.height * s))) if s > 1 else c


def call(model, text, image, max_out):
    global spent
    pimg, pin, pout = PRICE[model]
    worst = 3000 * pimg + 400 * pin + max_out * pout
    if spent + worst > CAP: raise SystemExit(f'spend cap: spent {spent:.5f} + worst {worst:.5f} > {CAP}')
    body = {'model': model, 'messages': [{'role': 'user', 'content': [{'type': 'text', 'text': text}, {'type': 'image_url', 'image_url': {'url': image}}]}],
            'max_tokens': max_out, 'seed': random.randrange(2 ** 31)}
    req = urllib.request.Request(API + '/v1/chat/completions', json.dumps(body).encode(), {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: j = json.load(r)
    except urllib.error.HTTPError as e:
        spent += worst  # a failed call can still be billed
        return {'ok': False, 'error': f'HTTP {e.code}: {e.read()[:200].decode("utf-8", "replace")}'}
    u = j.get('usage') or {}
    spent += u.get('prompt_tokens', 0) * pin + u.get('completion_tokens', 0) * pout
    return {'ok': True, 'text': j['choices'][0]['message'].get('content') or ''}


looks = []
for n, ph in enumerate(PHOTOS, 1):
    path = os.path.join(ROOT, 'tools', ph['file'])
    im = Image.open(path); s = min(1, SIDE / max(im.size)); im = im.resize((round(im.width * s), round(im.height * s))).convert('RGB')
    name = f'{n}.jpg'; im.save(os.path.join(ROOT, 'recordings', name), quality=85)
    t0 = time.time()
    d = call(DESCRIBE, look('DESCRIBE'), b64(grid(im)), D_MAX)
    lk = {'id': f'p{n}', 'title': ph['title'], 'credit': ph['credit'], 'source': ph['source'], 'image': name, 'models': {'describe': DESCRIBE, 'check': CHECK}}
    if not d['ok']:
        lk.update(error='The explanation failed: ' + d['error'], claims=[]); looks.append(lk); continue
    p = look('claims', d['text'])
    lk.update(summary=p['summary'], claims=p['claims'], dropped=p['dropped'], raw=d['text'][:4000])
    dc = look('decoy', p['claims'], random.random()) if p['claims'] else None
    if dc:
        lk['decoy'] = {'label': dc[0], 'cell': random.choice(p['claims'])['cell']}
        for c in p['claims'] + [dict(cell=lk['decoy']['cell'], label=dc[0], spot=dc[1], _decoy=True)]:
            k = call(CHECK, look('checkPrompt', c['label'], c.get('spot', '')), b64(crop(im, c['cell'])), C_MAX)
            res = look('check', k['text']) if k['ok'] else {'visible': None, 'seen': '', 'error': k['error']}
            if c.get('_decoy'): lk['decoy']['check'] = res
            else: c['check'] = res
    lk['ms'] = int((time.time() - t0) * 1000)
    looks.append(lk)
    print(path, len(lk['claims']), 'claims', f'spent {spent:.5f}')

out = {'recordedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'models': {'describe': DESCRIBE, 'check': CHECK},
       'spentUpperBound': round(spent, 5), 'looks': looks}
json.dump(out, open(os.path.join(ROOT, 'recordings', 'looks.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'total spent {spent:.5f} Pollen (usage x listed prices; failures at worst case)')
