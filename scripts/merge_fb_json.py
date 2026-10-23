# -*- coding: utf-8 -*-
"""Append an incremental FB JSON export (profile_posts_1.json) to data/posts.json.
Usage: python merge_fb_json.py "<export dir under D:\\Fb_AllRecord>"
Dedup key = date+time; existing posts are never touched. Rerun-safe.
"""
import sys, os, re, json
from datetime import datetime, timezone, timedelta

FB_ROOT = r'D:\Fb_AllRecord'
SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE_NAME = '曼絨縣南華獨立中學 Nan Hwa High School'
MYT = timezone(timedelta(hours=8))          # 首批 HTML 导出的时间即马来西亚时间，06-28 重叠帖已核对一致
URL_RE = re.compile(r'https?://[^\s<"]+')


def fix(o):
    """FB JSON 把 UTF-8 字节当 latin1 转义存，要还原。"""
    if isinstance(o, str):
        try:
            return o.encode('latin1').decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError):
            return o
    if isinstance(o, list):
        return [fix(x) for x in o]
    if isinstance(o, dict):
        return {k: fix(v) for k, v in o.items()}
    return o


def classify(title):
    if '相片' in title: return 'photo'
    if '影片' in title: return 'video'
    if '連結' in title: return 'shared_link'
    if '貼文' in title: return 'shared_post'
    if '相簿' in title: return 'shared_album'
    return 'status' if not title else 'other'


def main(export_dir):
    top = os.path.basename(export_dir.rstrip('\\/'))
    raw = fix(json.load(open(os.path.join(export_dir, 'posts', 'profile_posts_1.json'), encoding='utf-8')))
    path = os.path.join(SITE, 'data', 'posts.json')
    posts = json.load(open(path, encoding='utf-8'))
    seen = {(p['date'], p['time']) for p in posts}
    next_id = max(p['id'] for p in posts) + 1

    # 「分享」帖会导出两条同时间戳的记录（一条空壳、一条带正文），先按时间戳合并
    groups = {}
    for r in raw:
        groups.setdefault(r['timestamp'], []).append(r)

    added = []
    for stamp in sorted(groups):
        rs = groups[stamp]
        ts = datetime.fromtimestamp(stamp, MYT)
        key = (ts.strftime('%Y-%m-%d'), ts.strftime('%H:%M:%S'))
        if key in seen:
            continue
        text = max((d['post'] for r in rs for d in r.get('data', []) if d.get('post')), key=len, default='').strip()
        media = []
        for r in rs:
            for a in r.get('attachments', []):
                for d in a.get('data', []):
                    uri = d.get('media', {}).get('uri')
                    if not uri:
                        continue
                    # 导出里 uri 以首批目录名开头，实际文件在本批目录下
                    rel = top + '/' + uri.split('/', 1)[1]
                    if rel not in media:
                        media.append(rel)
                    if not text and d['media'].get('description'):
                        text = d['media']['description'].strip()
        title = max((r.get('title', '') for r in rs), key=len).replace(PAGE_NAME, '').strip()
        ptype = classify(title)
        added.append({
            'id': next_id, 'date': key[0], 'time': key[1], 'year': ts.year,
            'type': ptype, 'action': title, 'text': text, 'media': media,
            'links': URL_RE.findall(text),
            'is_filler': ptype in ('shared_link', 'shared_post') and not URL_RE.sub('', text).strip(),
        })
        seen.add(key)
        next_id += 1

    missing = [m for p in added for m in p['media'] if not os.path.exists(os.path.join(FB_ROOT, m.replace('/', os.sep)))]
    assert not missing, f'media missing on disk: {missing[:5]}'
    posts += added
    posts.sort(key=lambda p: (p['date'], p['time']))
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(posts, f, ensure_ascii=False, indent=1)
    print(f'OK raw={len(raw)} added={len(added)} fillers={sum(p["is_filler"] for p in added)} '
          f'media={sum(len(p["media"]) for p in added)} total={len(posts)}')


if __name__ == '__main__':
    main(sys.argv[1])
