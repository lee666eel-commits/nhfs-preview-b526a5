# 逐秒合图审片：python review.py [起秒] [止秒] [步长]
import asyncio, io, os, sys
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
a, b, step = (float(x) for x in (sys.argv[1:4] if len(sys.argv) > 3 else (0, 33, 1)))
URL = 'http://127.0.0.1:8411/motion/index.html?mode=still&t=0&dpr=1'

async def run(w, h, tag, cols):
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': w, 'height': h})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL, wait_until='load')
        await pg.evaluate("document.fonts.ready.then(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))))")
        await pg.evaluate("MG.layout()")
        ts, t = [], a
        while t <= b + 1e-6: ts.append(round(t, 2)); t += step
        shots = []
        for t in ts:
            await pg.evaluate(f"MG.render({t})")
            shots.append(Image.open(io.BytesIO(await pg.screenshot(type='jpeg', quality=70))))
        await br.close()
        tw = 480 if w > h else 200; th = int(tw * h / w)
        rows = (len(shots) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * (tw + 6), rows * (th + 6)), (255, 0, 255))
        d = ImageDraw.Draw(sheet)
        for i, s in enumerate(shots):
            x, y = (i % cols) * (tw + 6), (i // cols) * (th + 6)
            sheet.paste(s.resize((tw, th)), (x, y)); d.rectangle([x, y, x + 46, y + 16], fill='black'); d.text((x + 3, y + 2), f'{ts[i]}s', fill='yellow')
        out = os.path.join(HERE, f'rev_{tag}.jpg'); sheet.save(out, quality=80)
        print(tag, len(shots), 'frames', 'errors:', errs[:3])

async def main():
    await run(1280, 720, 'land', 4)
    await run(390, 844, 'port', 8)
asyncio.run(main())
