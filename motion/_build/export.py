# 逐帧导出 MP4（无音轨）：python export.py   需先在仓库根目录跑 python -m http.server 8411
import asyncio, os, subprocess
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'video')
FPS, T = 30, 33.0
URL = 'http://127.0.0.1:8411/motion/index.html?mode=still&t=0&dpr=1'

async def export(w, h, name):
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': w, 'height': h})
        await pg.goto(URL, wait_until='load')
        await pg.evaluate("document.fonts.ready.then(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))))")
        await pg.evaluate("MG.layout()")
        ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-',
                               '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                               os.path.join(OUT, f'{name}.mp4')], stdin=subprocess.PIPE)
        n = int(T * FPS) + 1
        for i in range(n):
            await pg.evaluate(f"MG.render({i / FPS})")
            ff.stdin.write(await pg.screenshot(type='jpeg', quality=94))
            if i == n - 1:
                await pg.screenshot(path=os.path.join(OUT, f'{name}-poster.jpg'), type='jpeg', quality=88)
        ff.stdin.close(); ff.wait()
        await br.close()
        print(name, n, 'frames', ff.returncode)

async def main():
    os.makedirs(OUT, exist_ok=True)
    await asyncio.gather(export(1920, 1080, 'yingling-1920x1080'), export(1080, 1920, 'yingling-1080x1920'))
asyncio.run(main())
