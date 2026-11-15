"""Gemini çitinden (Cafe/Teras/cit.png) uzatılabilir çit parçaları üretir.

cit.png'de direkler 16 px arayla (x=4, 20, 36), raylar boydan boya. Buradan:
  cit_yatay.png  16 px genişlik, yan yana dizilince dikişsiz (direk + ray aralığı)
  cit_direk.png  tek direk: yatay çitin sağ ucu, köşeler
  cit_dikey.png  yandan görünen çit (kuzey-güney): direk + arkasında yukarı uzanan ray, 16 px adımla üst üste
Gölgeler 3'lü şeritte hesaplanıp ortası kırpılır, böylece parçalar birleşince gölge de dikişsiz olur.
Kullanım: python3 fence.py [önizleme.png]
"""
import os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from clean_ai import add_shadow

D = os.path.join(HERE, '../../client/Assets/Art/Custom/Cafe/Teras')
P = 16                                    # direk aralığı (px)
SH = (30, 40, 20, 70)


def shadow_of(img):
    """add_shadow ile aynı gölge, ama kırpmadan: (w+10, h+4) tuval, görsel (0,0)'da."""
    sh = Image.new('RGBA', (img.width + 10, img.height + 4)); sp = sh.load(); sa = img.load()
    for y in range(img.height):
        for x in range(img.width):
            if sa[x, y][3] == 255 and y > img.height * 0.4:
                for k in range(1, 9): sp[x + k, y + k // 3] = SH
    return sh


def main(preview):
    a = np.asarray(Image.open(os.path.join(D, 'cit.png')).convert('RGBA')).copy()
    a[a[..., 3] != 255] = 0                               # mevcut gölgeyi at
    body = a[:32]
    seg = body[:, 20:20 + P]                              # direk(10) + aralık(6)
    post = body[:, 36:46].copy(); post[:, :][post[..., 3] == 0] = 0
    rail = body[6:14, 14:20]                              # aralıktaki ray parçası (8x6)

    # yatay: 3'lü şerit + gölge, ortadaki 16 px
    strip = Image.fromarray(np.concatenate([seg] * 3, 1), 'RGBA')
    full = shadow_of(strip); full.alpha_composite(strip, (0, 0))
    yatay = full.crop((P, 0, 2 * P, full.height)); yatay.save(os.path.join(D, 'cit_yatay.png'))

    pimg = Image.fromarray(post, 'RGBA')
    direk = shadow_of(pimg); direk.alpha_composite(pimg, (0, 0)); direk = direk.crop(direk.getbbox())
    direk.save(os.path.join(D, 'cit_direk.png'))

    # dikey: rayı 90° çevir (6x8 -> 8x6), direğin ortasında yukarı doğru 16 px uzat
    r = np.rot90(rail); rh = r.shape[0]
    tile = np.zeros((32 + P, 10, 4), np.uint8)            # üstteki P px bir önceki direğe kadar uzanan ray
    for y in range(0, P + 14, rh):                        # ray: üst direğin ray hizasından bu direğe
        h = min(rh, P + 14 - y); tile[6 + y:6 + y + h, 1:9] = r[:h]
    tile[P:] = np.where(post[..., 3:] == 255, post, tile[P:])
    timg = Image.fromarray(tile, 'RGBA')
    dikey = shadow_of(timg); dikey.alpha_composite(timg, (0, 0)); dikey.save(os.path.join(D, 'cit_dikey.png'))
    for n in ('cit_yatay', 'cit_direk', 'cit_dikey'): print(n, Image.open(os.path.join(D, n + '.png')).size)

    if preview: scene(preview)


def scene(out, cols=22, rows=9):
    """Büyük çitle çevrili alan: üst ve alt kenar yatay, yanlar dikey, köşeler direk."""
    y_, d_, k_ = (Image.open(os.path.join(D, n + '.png')) for n in ('cit_yatay', 'cit_dikey', 'cit_direk'))
    W, H = cols * P + 80, rows * P + 120
    g = Image.open(os.path.join(D, '../../Ground/cimen-toprak-gecis-16.png')).convert('RGBA').crop((0, 0, 32, 32))
    can = Image.new('RGBA', (W, H))
    for gy in range(0, H, 32):
        for gx in range(0, W, 32): can.alpha_composite(g, (gx, gy))
    ox, oy = 30, 40                                       # sol üst direğin sol üst köşesi
    def h_edge(y):
        for i in range(cols): can.alpha_composite(y_, (ox + i * P, y))
        can.alpha_composite(k_, (ox + cols * P, y))
    h_edge(oy)
    for j in range(1, rows + 1):                          # yanlar, yukarıdan aşağı (alttaki önde)
        for x in (ox, ox + cols * P):
            can.alpha_composite(d_, (x, oy + j * P - P))
    h_edge(oy + rows * P)
    can.resize((W * 2, H * 2), Image.NEAREST).save(out); print(out)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else None)
