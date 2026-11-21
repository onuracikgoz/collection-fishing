"""harita_assets.py çıktılarının önizlemesi: hepsi çimen zeminde, gerçek oyun boyunda, 2x.
Kullanım: python3 harita_onizleme.py cikti.png"""
import os, sys
from PIL import Image, ImageDraw
from harita_assets import ASSETS, ART

names = []
for n, (folder, _, parts) in ASSETS.items():
    names += [(folder, p) for p in (parts or [n])]
ims = [Image.open(os.path.join(ART, f, p + '.png')) for f, p in names]
W = 1100; x = y = 16; rowh = 0; pos = []
for im in ims:
    if x + im.width > W - 16: x = 16; y += rowh + 24; rowh = 0
    pos.append((x, y)); x += im.width + 18; rowh = max(rowh, im.height)
H = y + rowh + 16
bg = Image.new('RGBA', (W, H), (96, 138, 70, 255))
d = ImageDraw.Draw(bg)
for t in range(0, W, 32):
    for u in range(0, H, 32):
        if (t // 32 + u // 32) % 2: d.rectangle([t, u, t + 31, u + 31], fill=(90, 131, 66, 255))
for im, p in zip(ims, pos): bg.alpha_composite(im, p)
bg = bg.resize((W * 2, H * 2), Image.NEAREST); bg.save(sys.argv[1]); print(sys.argv[1], bg.size)
