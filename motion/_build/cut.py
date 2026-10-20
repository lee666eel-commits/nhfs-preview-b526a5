# 从角色设定图里抠出正面立绘（纸面网格背景 → 透明）
import cv2, numpy as np, os
D = 'C:/Users/lee66/Downloads/Gemini_Generated_Image_'
OUT = os.path.dirname(os.path.abspath(__file__))
jobs = {'girl': (D + 's3pupes3pupes3pu.png', (90, 280, 720, 1730)),
        'boy': (D + 'rrhj32rrhj32rrhj.png', (150, 250, 760, 1650))}
for name, (path, (x0, y0, x1, y1)) in jobs.items():
    img = cv2.imread(path, cv2.IMREAD_COLOR)[y0:y1, x0:x1]
    h, w = img.shape[:2]
    f = img.astype(np.int16)
    mx, mn = f.max(2), f.min(2)
    bg_like = ((mn > 200) & (mx - mn < 18)).astype(np.uint8)   # 纸面 + 网格线
    num, lab = cv2.connectedComponents(bg_like, connectivity=4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    sizes = np.bincount(lab.ravel())
    bg = np.zeros((h, w), bool)
    for i in range(1, num):
        if i in border or sizes[i] > 1500:     # 外部纸面，或手臂与腰之间被围住的纸面
            bg |= lab == i
    fg = (~bg).astype(np.uint8) * 255
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    op = cv2.morphologyEx(fg, cv2.MORPH_OPEN, k)            # 去掉细引线与文字
    n2, lab2, st, _ = cv2.connectedComponentsWithStats(op, 8)
    keep = ((lab2 == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])) * 255).astype(np.uint8)
    final = cv2.bitwise_and(fg, cv2.dilate(keep, k))         # 补回轮廓细节
    final = cv2.morphologyEx(final, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    n3, lab3, st3, _ = cv2.connectedComponentsWithStats(final, 8)
    final = ((lab3 == 1 + np.argmax(st3[1:, cv2.CC_STAT_AREA])) * 255).astype(np.uint8)
    final = cv2.GaussianBlur(final, (3, 3), 0)
    rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA); rgba[:, :, 3] = final
    ys, xs = np.where(final > 10)
    rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    cv2.imwrite(os.path.join(OUT, f'{name}.png'), rgba)
    print(name, rgba.shape)

# 抹掉穿过角色的引线残段（坐标为裁切后立绘坐标，目视定位）
LINES = {'girl': [((132, 487), (36, 614)), ((384, 171), (412, 179))],
         'boy': [((134, 593), (24, 641)), ((314, 671), (378, 690)), ((338, 186), (354, 192))]}
for name, segs in LINES.items():
    p = os.path.join(OUT, f'{name}.png'); im = cv2.imread(p, cv2.IMREAD_UNCHANGED)
    m = np.zeros(im.shape[:2], np.uint8)
    for a, b in segs: cv2.line(m, a, b, 255, 7)
    m &= (im[:, :, :3].max(2) < 110).astype(np.uint8) * 255  # 只抹深色引线像素
    m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    # 引线穿过角色轮廓处保留原像素，否则轮廓会被抹出缺口
    dark = (im[:, :, :3].max(2) < 110).astype(np.uint8) * 255
    ring = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))) & ~m
    m &= ~cv2.dilate(dark & ring, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    rgb = cv2.inpaint(np.ascontiguousarray(im[:, :, :3]), m, 5, cv2.INPAINT_TELEA)
    im[:, :, :3] = rgb
    cv2.imwrite(p, im); print('cleaned', name, int(m.sum() / 255), 'px')
