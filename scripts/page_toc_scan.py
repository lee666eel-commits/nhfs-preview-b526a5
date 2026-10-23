import os, re, subprocess, json, posixpath, sys
from html.parser import HTMLParser
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PAGES = ['index.html', 'about/index.html', 'history/index.html', 'organization/index.html', 'board/index.html',
         'academic/index.html', 'cocurricular/index.html', 'facilities/index.html', 'faculty/index.html',
         'museum/index.html', 'news/index.html', '90/index.html', 'admission/index.html', 'motion/index.html', '404.html']

class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.links = []; s.title = ''; s._t = False; s._a = None
    def handle_starttag(s, tag, a):
        a = dict(a)
        if tag == 'title': s._t = True
        if tag == 'a' and a.get('href'): s._a = [a['href'], '']; s.links.append(s._a)
    def handle_endtag(s, tag):
        if tag == 'title': s._t = False
        if tag == 'a': s._a = None
    def handle_data(s, d):
        if s._t: s.title += d
        if s._a is not None: s._a[1] += d

def norm(page, href):
    href = href.split('#')[0].split('?')[0]
    if not href: return None
    if re.match(r'^(https?:|mailto:|tel:|javascript:)', href): return href
    p = posixpath.normpath(posixpath.join(posixpath.dirname(page), href))
    if p.endswith('/') or os.path.isdir(os.path.join(ROOT, p)): p = posixpath.join(p, 'index.html')
    return p

out = {}
for pg in PAGES:
    h = P(); h.feed(open(os.path.join(ROOT, pg), encoding='utf-8').read())
    date = subprocess.run(['git', '-C', ROOT, 'log', '-1', '--format=%ad', '--date=short', '--', pg], capture_output=True, text=True).stdout.strip()
    internal, external, news = {}, {}, 0
    for href, txt in h.links:
        t = norm(pg, href)
        if not t: continue
        txt = re.sub(r'\s+', ' ', txt).strip()
        if t.startswith('news/20'): news += 1; continue
        if re.match(r'^(https?:|mailto:|tel:)', t): external.setdefault(t, txt); continue
        if t != pg: internal.setdefault(t, txt)
    out[pg] = dict(title=h.title.strip(), date=date, internal=internal, external=external, news=news)
json.dump(out, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for k, v in out.items():
    print(k, v['date'], v['title'], '| int:', list(v['internal']), '| news:', v['news'], '| ext:', len(v['external']))
