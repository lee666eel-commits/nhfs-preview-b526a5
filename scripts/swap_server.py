"""换照模式：本机预览时指哪换哪，每次换／撤都记进 data/swap-log.md。

用法（在仓库根目录）：python scripts/swap_server.py  → 打开 http://localhost:8430/
页面右下角「换照模式」开关；开启后点任一张照片 → 换照片／撤掉，可附一句备注。
只改 <img>；CSS 背景图、动画脚本生成的图会记进日志标「待手动」。
ponytail: 只给本机用，不做鉴权，别开到局域网外。
"""
import datetime, html, io, os, re, sys, urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from PIL import Image, ImageOps

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SWAP_DIR = os.path.join(ROOT, 'assets', 'img', 'swap')
LOG = os.path.join(ROOT, 'data', 'swap-log.md')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8430

JS = r"""
(()=>{
const css=`.swp-on img{outline:3px dashed #A8352A;outline-offset:-3px;cursor:crosshair!important}
#swpT{position:fixed;right:16px;bottom:96px;z-index:2147483647;background:#17201B;color:#F4EFE4;border:0;border-radius:999px;padding:.7rem 1.1rem;font:600 15px system-ui;box-shadow:0 4px 18px #0006;cursor:pointer}
.swp-on #swpT{background:#A8352A}
#swpP{position:fixed;z-index:2147483647;background:#FBF8F1;color:#17201B;border:1px solid #17201B;border-radius:10px;padding:12px;width:270px;font:14px system-ui;box-shadow:0 8px 30px #0005}
#swpP button{margin:6px 6px 0 0;padding:.45rem .8rem;border-radius:6px;border:1px solid #17201B;background:#fff;cursor:pointer;font:14px system-ui}
#swpP input[type=text]{width:100%;box-sizing:border-box;margin-top:8px;padding:.4rem;font:14px system-ui}
#swpP small{display:block;color:#7A7263;word-break:break-all;margin-top:4px}
#swpM{position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:2147483647;background:#17201B;color:#F4EFE4;padding:.6rem 1rem;border-radius:8px;font:14px system-ui;display:none}`;
document.head.append(Object.assign(document.createElement('style'),{textContent:css}));
const t=Object.assign(document.createElement('button'),{id:'swpT',textContent:'换照模式：关'});
const msg=Object.assign(document.createElement('div'),{id:'swpM'});
document.body.append(t,msg);
let on=sessionStorage.getItem('swp')==='1';
const set=v=>{on=v;sessionStorage.setItem('swp',v?'1':'0');document.documentElement.classList.toggle('swp-on',v);t.textContent='换照模式：'+(v?'开':'关')};
set(on); t.onclick=()=>set(!on);
const say=s=>{msg.textContent=s;msg.style.display='block';clearTimeout(say.t);say.t=setTimeout(()=>msg.style.display='none',4000)};
const where=img=>{ // 最近的标题，日志里给人看的位置
  let e=img; while(e&&e!==document.body){ const h=e.querySelector&&e.querySelector('h1,h2,h3'); if(h) return h.textContent.replace(/\s+/g,' ').trim().slice(0,40); e=e.parentElement } return document.title };
let panel;
document.addEventListener('click',ev=>{
  if(!on||ev.target.closest('#swpT,#swpP')) return;
  const img=ev.target.closest('img'); if(panel){panel.remove();panel=null}
  if(!img) return;
  ev.preventDefault(); ev.stopPropagation();
  const raw=img.getAttribute('src')||'';
  const nth=[...document.querySelectorAll('img')].filter(i=>i.getAttribute('src')===raw).indexOf(img);
  panel=document.createElement('div'); panel.id='swpP';
  panel.innerHTML='<b>这张照片</b><small></small><input type="text" placeholder="备注（选填，例如：犯忌／有更好的）"><div><button data-a="swap">换照片…</button><button data-a="remove">撤掉</button><button data-a="x">取消</button></div><input type="file" accept="image/*" hidden>';
  panel.querySelector('small').textContent=raw+'　·　'+where(img);
  const r=img.getBoundingClientRect();
  panel.style.left=Math.min(innerWidth-290,Math.max(8,r.left))+'px'; panel.style.top=Math.min(innerHeight-170,Math.max(8,r.top))+'px';
  document.body.append(panel);
  const note=panel.querySelector('input[type=text]'), file=panel.querySelector('input[type=file]');
  const send=async(action,body)=>{
    const h={'X-Page':encodeURIComponent(location.pathname),'X-Src':encodeURIComponent(raw),'X-Nth':nth,'X-Action':action,
      'X-Where':encodeURIComponent(where(img)),'X-Note':encodeURIComponent(note.value),'X-Name':encodeURIComponent(body?body.name:'')};
    const res=await fetch('/__swap',{method:'POST',headers:h,body:body||''}); const j=await res.json();
    if(j.src){ img.removeAttribute('srcset'); img.src=j.src+'?'+Date.now() }
    if(action==='remove'&&j.ok) img.style.setProperty('display','none','important');
    say(j.msg); panel.remove(); panel=null;
  };
  panel.onclick=e=>{ const a=e.target.dataset.a; if(a==='x'){panel.remove();panel=null} else if(a==='swap') file.click(); else if(a==='remove') send('remove') };
  file.onchange=()=>file.files[0]&&send('swap',file.files[0]);
},true);
})();
"""


def log(row):
    new = not os.path.exists(LOG)
    with open(LOG, 'a', encoding='utf-8') as f:
        if new:
            f.write('# 换照日志\n\n每一笔＝他在本机「换照模式」里的一次换／撤；会后逐条补「为什么」。\n\n'
                    '| 时间 | 页面 | 位置 | 动作 | 原图 | 新图 | 备注 | 为什么（会后补） |\n|---|---|---|---|---|---|---|---|\n')
        f.write('| ' + ' | '.join(str(c).replace('|', '／').replace('\n', ' ') for c in row) + ' |\n')


def nth_replace(text, old, new, n):
    """把第 n 个（从 0 起）出现的 old 换成 new；找不到返回 None。"""
    idx = -1
    for _ in range(n + 1):
        idx = text.find(old, idx + 1)
        if idx < 0:
            return None
    return text[:idx] + new + text[idx + len(old):]


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def page_file(self, path):
        p = urllib.parse.unquote(urllib.parse.urlparse(path).path).lstrip('/')
        f = os.path.normpath(os.path.join(ROOT, p))
        if os.path.isdir(f):
            f = os.path.join(f, 'index.html')
        return f if f.startswith(ROOT) else None

    def do_GET(self):
        if self.path == '/__swap.js':
            b = JS.encode()
            self.send_response(200); self.send_header('Content-Type', 'text/javascript; charset=utf-8')
            self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b); return
        f = self.page_file(self.path)
        if f and f.endswith('.html') and os.path.isfile(f):
            b = open(f, 'rb').read().replace(b'</body>', b'<script src="/__swap.js"></script></body>', 1)
            self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b); return
        super().do_GET()

    def reply(self, **j):
        import json
        b = json.dumps(j, ensure_ascii=False).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)

    def do_POST(self):
        if self.path != '/__swap':
            return self.send_error(404)
        q = lambda k: urllib.parse.unquote(self.headers.get(k, ''))
        page, raw, action, note, where = q('X-Page'), q('X-Src'), q('X-Action'), q('X-Note'), q('X-Where')
        nth = int(self.headers.get('X-Nth') or 0)
        body = self.rfile.read(int(self.headers.get('Content-Length') or 0))
        f = self.page_file(page)
        now = datetime.datetime.now().strftime('%m-%d %H:%M')
        rel_page = os.path.relpath(f, ROOT).replace('\\', '/') if f else page
        text = open(f, encoding='utf-8').read() if f and os.path.isfile(f) else ''
        attr = 'src="%s"' % raw
        if nth < 0 or text.count(attr) <= nth:
            log([now, rel_page, where, action + '（待手动：此图不在 HTML 里，可能是脚本生成）', raw, '', note, ''])
            return self.reply(ok=False, msg='这张图不是写在页面里的（脚本生成），已记进日志，会后我手动处理')
        if action == 'remove':
            new_text = nth_replace(text, attr, attr + ' style="display:none!important" data-swap="撤 %s"' % now, nth)
            open(f, 'w', encoding='utf-8', newline='').write(new_text)
            log([now, rel_page, where, '撤', raw, '', note, ''])
            return self.reply(ok=True, msg='已撤掉，已记进日志')
        # 换：压到长边 2000px，带透明的存 PNG，其余 JPG
        try:
            im = ImageOps.exif_transpose(Image.open(io.BytesIO(body)))
        except Exception:
            return self.reply(ok=False, msg='读不了这个文件，换一张 JPG/PNG 试试')
        im.thumbnail((2000, 2000))
        os.makedirs(SWAP_DIR, exist_ok=True)
        stem = re.sub(r'[^\w\-]+', '-', os.path.splitext(q('X-Name'))[0]).strip('-')[:40] or 'photo'
        alpha = im.mode in ('RGBA', 'LA', 'P') and 'transparency' in im.info or im.mode in ('RGBA', 'LA')
        ext = '.png' if alpha else '.jpg'
        name = datetime.datetime.now().strftime('%m%d-%H%M%S-') + stem + ext
        out = os.path.join(SWAP_DIR, name)
        (im if alpha else im.convert('RGB')).save(out, quality=85, optimize=True)
        new_src = os.path.relpath(out, os.path.dirname(f)).replace('\\', '/')
        new_text = nth_replace(text, attr, 'src="%s"' % new_src, nth)
        open(f, 'w', encoding='utf-8', newline='').write(new_text)
        log([now, rel_page, where, '换', raw, 'assets/img/swap/' + name, note, ''])
        return self.reply(ok=True, src=new_src, msg='已换上（%dx%d），已记进日志' % im.size)

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    print('换照模式：http://localhost:%d/  （Ctrl+C 停止）' % PORT)
    ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
