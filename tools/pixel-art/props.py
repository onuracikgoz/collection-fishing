"""Meydan süsleri (cozy): çeşme yatağı, sokak lambası, bank, masa ve tabure. docs/tasarim/15-gorsel-stil.md
Çalıştır: python3 tools/pixel-art/props.py -> client/Assets/Art/Custom/Plaza/
Hepsi kodla çizilir ve sonunda soften.py ile yumuşatılır. Pivot: altta orta.
"""
import math, os, random, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fountain_pier import Canvas, hx, WOOD, RSTONE, MOSS, PINK, YEL, CREAM, OUT
from soften import soften

GRASS = [hx(c) for c in ('#2a4d24', '#36652d', '#427a34', '#4b8a37', '#56973d', '#62a244', '#70ad4b')]
IRON = [hx(c) for c in ('#2b2226', '#43363a', '#5e4c4f', '#7d6a69')]
GLOW = [hx(c) for c in ('#c9772c', '#f2b04c', '#f6cf6e', '#fff1b8')]
LILAC = hx('#a99be8')

def finish(c):
    c.outline(); return soften(c.im)

def fountain_bed():
    """Çeşmenin altına serilen yuvarlak çimen yatağı: taş bordür, çiçekler. Zemin süsü, çarpışmasız."""
    W, H = 112, 64; c = Canvas(W, H); cx, cy, rx, ry = 56, 30, 54, 28
    rng = random.Random(4)
    def curb(x, y):
        a = math.degrees(math.atan2((y + .5 - cy) / ry, (x + .5 - cx) / rx)) % 360
        seg = int(a / 360 * 34); f = a / 360 * 34 - seg
        if f < .12: return RSTONE[1]
        return RSTONE[4 if 160 < a < 300 else 3 if seg % 3 else 2]
    c.ellipse(cx, cy + 2, rx, ry, lambda x, y: RSTONE[1])                     # bordürün ön kalınlığı
    c.ellipse(cx, cy, rx, ry, curb)
    def grass(x, y):
        h = (x * 131 + y * 7919) % 17
        return GRASS[2] if h < 2 else GRASS[4] if h > 14 else GRASS[3]
    c.ellipse(cx, cy, rx - 4, ry - 3, grass)
    for _ in range(46):                                                        # ot ve çiçek öbekleri halkada
        a = rng.uniform(0, 2 * math.pi); d = rng.uniform(.62, .9)
        x = int(cx + (rx - 4) * d * math.cos(a)); y = int(cy + (ry - 3) * d * math.sin(a))
        if rng.random() < .55:
            col = rng.choice((PINK, YEL, CREAM, LILAC))
            for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)): c.put(x + dx, y + dy, col)
            c.put(x, y, YEL if col != YEL else CREAM); c.put(x, y + 2, GRASS[1])
        else:
            c.put(x, y, GRASS[5]); c.put(x, y - 1, GRASS[6]); c.put(x - 1, y + 1, GRASS[2]); c.put(x + 1, y, GRASS[5])
    return finish(c)

def lamp():
    """Demir sokak lambası, sıcak ışıklı fener. 16x52."""
    W, H = 20, 56; c = Canvas(W, H); cx = 10
    for y in range(H - 6, H - 1):                                              # taş taban
        for x in range(cx - 4, cx + 5): c.put(x, y, RSTONE[3] if x < cx else RSTONE[2])
    for x in range(cx - 4, cx + 5): c.put(x, H - 6, RSTONE[4])
    for y in range(16, H - 6):                                                 # direk
        c.put(cx - 1, y, IRON[3]); c.put(cx, y, IRON[2]); c.put(cx + 1, y, IRON[1])
    for y in (H - 14, 24): 
        for x in range(cx - 2, cx + 3): c.put(x, y, IRON[2])
    # fener
    for y in range(6, 17):
        for x in range(cx - 4, cx + 5):
            edge = x in (cx - 4, cx + 4) or y in (6, 16)
            c.put(x, y, IRON[1] if edge else GLOW[3] if (x < cx and y < 12) else GLOW[2] if y < 14 else GLOW[1])
    for x in range(cx - 1, cx + 2): c.put(x, 11, IRON[1])                     # çerçeve çubuğu
    for y in range(7, 16): c.put(cx, y, IRON[1])
    for x in range(cx - 5, cx + 6): c.put(x, 5, IRON[2])                      # şapka
    for x in range(cx - 3, cx + 4): c.put(x, 4, IRON[3])
    c.put(cx, 3, IRON[2]); c.put(cx, 2, IRON[3])
    im = finish(c)
    halo = Image.new('RGBA', im.size, (0, 0, 0, 0)); hp = halo.load()       # yumuşak ışık halesi
    for y in range(0, 26):
        for x in range(W):
            d = math.hypot(x + .5 - cx, (y + .5 - 11) * 1.1)
            if 6 < d < 10: hp[x, y] = (246, 207, 110, int(70 * (1 - (d - 6) / 4)))
    halo.alpha_composite(im); return halo

def bench():
    """Ahşap bank, 3/4 açı: arkalık geride ve hafif yatık, oturağın üst yüzü görünür, ön kalınlık,
    yan kol tahtaları, ön ve arka ayaklar, yerde gölge. 50x42."""
    W, H = 50, 42; c = Canvas(W, H)
    def plank(x0, x1, y0, rows, base, top_light=True):
        for i, y in enumerate(range(y0, y0 + rows)):
            for x in range(x0, x1):
                col = WOOD[base]
                if i == 0 and top_light: col = WOOD[min(5, base + 1)]
                if i == rows - 1: col = WOOD[base - 1]
                if (x * 7 + y * 3) % 19 == 0: col = WOOD[base - 1]
                c.put(x, y, col)
    # yerdeki gölge (oturağın altı ve arkası)
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sp = sh.load()
    for y in range(26, 42):
        for x in range(0, W):
            d = ((x + .5 - 27) / 23) ** 2 + ((y + .5 - 34) / 5.5) ** 2
            if d <= 1: sp[x, y] = (30, 22, 18, 85 if d < .6 else 45)
    # arka ayaklar (oturağın arkasında, daha yukarıda)
    for x0 in (9, 41):
        for y in range(20, 30): c.put(x0, y, WOOD[1]); c.put(x0 + 1, y, WOOD[0])
    # arkalık dikmeleri ve iki tahta (biraz geriye yatık: üst tahta 1 px sağa kayık değil, daha koyu)
    for x0 in (9, 41):
        for y in range(2, 20): c.put(x0, y, WOOD[2]); c.put(x0 + 1, y, WOOD[1])
    plank(6, 46, 3, 5, 3)
    plank(6, 46, 10, 5, 3)
    for x in range(6, 46): c.put(x, 8, WOOD[0]); c.put(x, 9, WOOD[1])          # tahta arası gölge
    # oturak üst yüzü: 3 tahta, yukarıdan görünür (açık)
    for k, y0 in enumerate((17, 20, 23)):
        plank(4, 46, y0, 3, 4 if k < 2 else 3)
        for x in range(4, 46): c.put(x, y0 + 2, WOOD[2])                          # tahtalar arası derz
    # oturak ön kalınlığı
    for x in range(4, 46): c.put(x, 26, WOOD[2]); c.put(x, 27, WOOD[1])
    for x in (8, 25, 42): c.put(x, 18, WOOD[1]); c.put(x, 21, WOOD[1]); c.put(x, 24, WOOD[1])   # çiviler
    # yan kol tahtaları (uçlarda, derinlik verir)
    for x0, light in ((2, True), (46, False)):
        for y in range(13, 28):
            c.put(x0, y, WOOD[3] if light else WOOD[1]); c.put(x0 + 1, y, WOOD[2] if light else WOOD[0])
        for x in range(x0 - 1, x0 + 3): c.put(x, 12, WOOD[4])                     # kol üstü
    # ön ayaklar (öne çıkık, yan yüzü görünür)
    for x0 in (4, 42):
        for y in range(28, 37):
            c.put(x0, y, WOOD[3]); c.put(x0 + 1, y, WOOD[2]); c.put(x0 + 2, y, WOOD[1])
        for x in range(x0, x0 + 3): c.put(x, 37, WOOD[0])
    im = finish(c)
    sh.alpha_composite(im); return sh

def table_set():
    """Yuvarlak ahşap masa + iki tabure. 64x40."""
    W, H = 64, 40; c = Canvas(W, H); cx = 32
    for y in range(18, 36):                                                    # masa ayağı
        for x in range(cx - 2, cx + 3): c.put(x, y, WOOD[2] if x < cx + 1 else WOOD[1])
    c.ellipse(cx, 36, 6, 2, lambda x, y: WOOD[1])
    for off in range(3, 0, -1): c.ellipse(cx, 14 + off, 15, 7, lambda x, y: WOOD[2])
    c.ellipse(cx, 14, 15, 7, lambda x, y: WOOD[4] if (x < cx and y < 14) else WOOD[3])
    for k in range(-12, 13, 5):                                                # tahta çizgileri
        for y in range(9, 21):
            x = cx + k
            if ((x + .5 - cx) / 15) ** 2 + ((y + .5 - 14) / 7) ** 2 < .9: c.put(x, y, WOOD[2])
    c.ellipse(cx + 3, 12, 2.5, 1.5, lambda x, y: CREAM)                        # fincan
    c.put(cx + 3, 12, hx('#7a4a26'))
    for sx in (8, 56):                                                         # tabureler
        for y in range(29, 37):
            c.put(sx - 3, y, WOOD[1]); c.put(sx + 3, y, WOOD[1])
        for off in range(2, 0, -1): c.ellipse(sx, 27 + off, 6, 3, lambda x, y: WOOD[2])
        c.ellipse(sx, 27, 6, 3, lambda x, y: WOOD[4] if x < sx else WOOD[3])
    return finish(c)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    items = {'fountain_bed': fountain_bed(), 'lamp': lamp(), 'bench': bench(), 'table_set': table_set()}
    for k, im in items.items(): im.save(os.path.join(OUT, k + '.png'))
    # önizleme: parke meydan, çeşme yatağı + çeşme, lambalar, bank, masa
    import importlib.util
    spec = importlib.util.spec_from_file_location('g', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ground.py')); g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
    T = 32; Wt, Ht = 14, 9; sc = Image.new('RGBA', (Wt * T, Ht * T)); r = random.Random(3)
    for ty in range(Ht):
        for tx in range(Wt): sc.paste(g.PAVE_T[r.randrange(8)], (tx * T, ty * T))
    f = Image.open(os.path.join(OUT, 'fountain.png'))
    bx, by = 7 * T - 56, 4 * T - 30
    sc.alpha_composite(items['fountain_bed'], (bx, by))
    sc.alpha_composite(f, (7 * T - 40, by + 30 - 58 - 6))
    for (lx, ly) in ((2 * T, 1 * T), (11 * T + 12, 1 * T), (2 * T, 5 * T + 8), (11 * T + 12, 5 * T + 8)):
        sc.alpha_composite(items['lamp'], (lx, ly))
    sc.alpha_composite(items['bench'], (4 * T, 6 * T + 4))
    sc.alpha_composite(items['bench'], (8 * T + 8, 6 * T + 4))
    sc.alpha_composite(items['table_set'], (10 * T, 2 * T))
    sc.resize((sc.width * 3, sc.height * 3), Image.NEAREST).save(os.path.join(OUT, 'meydan-onizleme.png'))
    print('ok')
