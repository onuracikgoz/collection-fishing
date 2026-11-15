"""AI çıktısını oyun tarzına oturt: beyaz arka planı sil, zemini kes, ızgaraya indir, palet azalt, renkli kontur."""
Kullanım: python3 clean_ai.py girdi.png cikti.png <zemin_kesme_y> <küçültme> <renk_sayısı>
  örn: python3 clean_ai.py balikci.png balikci_temiz.png 600 4.4 28
import sys
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from soften import soften
src, out, cut_y, scale, ncol = sys.argv[1], sys.argv[2], int(sys.argv[3]), float(sys.argv[4]), int(sys.argv[5])
im = Image.open(src).convert('RGBA'); W, H = im.size
# arka plan: köşelerden açık renk taşması
bg = im.convert('RGB').copy()
for c in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)]:
    ImageDraw.floodfill(bg, c, (255, 0, 255), thresh=40)
px = im.load(); b = bg.load()
for y in range(H):
    for x in range(W):
        if b[x, y] == (255, 0, 255) or y > cut_y: px[x, y] = (0, 0, 0, 0)
im = im.crop(im.getbbox())
w, h = round(im.width / scale), round(im.height / scale)
small = im.resize((w, h), Image.BOX)
a = small.split()[3].point(lambda v: 255 if v > 140 else 0)
rgb = small.convert('RGB').quantize(ncol, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
small = rgb.convert('RGBA'); small.putalpha(a)
small = soften(small, outline_dark=(40, 28, 22), inner=False)
# zemin gölgesi
sh = Image.new('RGBA', (small.width + 10, small.height + 4), (0, 0, 0, 0)); sp = sh.load(); sa = small.load()
for y in range(small.height):
    for x in range(small.width):
        if sa[x, y][3] and y > small.height * 0.4:
            for k in range(1, 9):
                if x + k < sh.width and y + k // 3 < sh.height: sp[x + k, y + k // 3] = (30, 40, 20, 70)
sh.alpha_composite(small, (0, 0)); sh = sh.crop(sh.getbbox()); sh.save(out); print(out, sh.size)
