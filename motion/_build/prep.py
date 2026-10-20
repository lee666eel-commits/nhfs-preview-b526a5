# 动态图形素材：校园图 → webp；角色立绘拆成头/身两层（头部可绕颈摆动）
import os
from PIL import Image, ImageOps
Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = 'C:/Users/lee66/Downloads/校园图'
DST = os.path.join(HERE, '..', 'assets')
os.makedirs(DST, exist_ok=True)

def save(im, name, size, q=80):
    im = ImageOps.exif_transpose(im)
    if im.mode == 'RGBA':            # 预乘 alpha 再缩放，避免透明边缘渗出黑边
        im = im.convert('RGBa'); im.thumbnail((size, size), Image.LANCZOS); im = im.convert('RGBA')
    im.thumbnail((size, size), Image.LANCZOS)
    im.save(os.path.join(DST, name), 'WEBP', quality=q, method=6)
    print(name, im.size, os.path.getsize(os.path.join(DST, name)) // 1024, 'KB')

save(Image.open(f'{SRC}/圖片1.png'), 'planet.webp', 1600, 82)                        # 小行星校园（已透明）
save(Image.open(f'{SRC}/鸟瞰图1.JPG').convert('RGB'), 'aerial.webp', 2600, 78)         # 鸟瞰
save(Image.open(f'{SRC}/DSC_3452.jpg').convert('RGB'), 'front.webp', 2000)             # 校门正面
save(Image.open(f'{SRC}/圖片_20260302094815_24_330.jpg').convert('RGB'), 'stone.webp', 2000)  # 南华独中石
save(Image.open(f'{SRC}/圖片_20260302094433_19_330.jpg').convert('RGB'), 'pool.webp', 1800)   # 泳池
save(Image.open(f'{SRC}/圖片_20260518191113_451_2.png').convert('RGB'), 'block.webp', 1248)  # 宿舍楼
save(Image.open(f'{SRC}/圖片_20260302094450_20_330.jpg').convert('RGB'), 'arch.webp', 1080)  # 牌楼

# 头/身分层：NECK=切线 y，OVER=头层往下多留的重叠，PIVOT 写入 JS
for name, neck in (('girl', 346), ('boy', 344)):
    im = Image.open(os.path.join(HERE, f'{name}.png'))
    w, h = im.size
    head = im.crop((0, 0, w, neck + 10))
    body = im.copy(); body.paste((0, 0, 0, 0), (0, 0, w, neck - 4))
    for part, layer in (('head', head), ('body', body)):
        layer.save(os.path.join(DST, f'{name}-{part}.webp'), 'WEBP', quality=88, method=6)
    print(name, 'size', w, h, 'neck', neck)
