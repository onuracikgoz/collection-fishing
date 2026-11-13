"""Çeşme ve iskele (kodla piksel piksel, 3/4 açı). docs/tasarim/15-gorsel-stil.md
Çalıştır: python3 tools/pixel-art/fountain_pier.py -> client/Assets/Art/Custom/Plaza/
Çeşme: fountain.png (128x128, pivot altta orta). İskele: pier_mid.png, pier_end.png (32x64 parçalar, 2 tile geniş).
"""
import math, os, random
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'client', 'Assets', 'Art', 'Custom', 'Plaza')
os.makedirs(OUT, exist_ok=True)
def hx(s): s = s.lstrip('#'); return tuple(int(s[i:i+2], 16) for i in (0, 2, 4)) + (255,)

STONE = [hx(c) for c in ('#4a3a33', '#6f5b4d', '#8f7a66', '#b09a82', '#cdb89f', '#e3d3ba')]
WATER = [hx(c) for c in ('#1c566f', '#276f89', '#3186a0', '#4099ae', '#5db3bf', '#93d3d6', '#d6f1ee')]
WOOD = [hx(c) for c in ('#4a2c1c', '#6b4129', '#8a5936', '#a8733f', '#c48d52', '#dba868')]
OUTLINE = hx('#2e1e18')

class Canvas:
    def __init__(self, w, h): self.w, self.h = w, h; self.im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); self.px = self.im.load()
    def put(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h: self.px[x, y] = c
    def ellipse(self, cx, cy, rx, ry, colorfn):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: self.put(x, y, colorfn(x, y))
    def outline(self):
        src = self.im.copy(); sp = src.load()
        for y in range(self.h):
            for x in range(self.w):
                if sp[x, y][3] == 0:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < self.w and 0 <= ny < self.h and sp[nx, ny][3] and sp[nx, ny] != (0, 0, 0, 0):
                            self.px[x, y] = OUTLINE; break

def shade_stone(x, cx, rx, base):
    """Sol üstten ışık: solda açık, sağda koyu."""
    t = (x - cx) / rx
    return STONE[max(0, min(5, base + (1 if t < -0.35 else -1 if t > 0.45 else 0)))]

def fountain():
    W, H = 128, 128; c = Canvas(W, H); cx = 64
    # zemin gölgesi (yumuşak, yarı saydam)
    for y in range(H):
        for x in range(W):
            if ((x + .5 - (cx + 6)) / 58) ** 2 + ((y + .5 - 112) / 14) ** 2 <= 1: c.put(x, y, (30, 40, 20, 70))
    # havuz duvarı (ön yüz) ve üst kenar
    cy, rx, ry, wall = 88, 54, 30, 12
    for off in range(wall, -1, -1):
        c.ellipse(cx, cy + off, rx, ry, lambda x, y, off=off: shade_stone(x, cx, rx, 1 if off > 3 else 2) if off else STONE[4])
    # taş derzleri duvarda
    for x in range(cx - rx, cx + rx, 9):
        for off in range(1, wall):
            yy = int(cy + off + ry * math.sqrt(max(0, 1 - ((x + .5 - cx) / rx) ** 2)))
            if 0 <= x < c.w and 0 <= yy < c.h and c.px[x, yy][3]: c.put(x, yy, STONE[0])
    # üst kenar halkası + su
    c.ellipse(cx, cy, rx, ry, lambda x, y: STONE[5] if (x - cx) < -rx * .3 and y < cy else STONE[4])
    rim = 7
    rng = random.Random(3)
    def water(x, y):
        d = math.hypot((x + .5 - cx) / (rx - rim), (y + .5 - cy) / (ry - rim * .6))
        i = 3 if d < 0.8 else 2
        if y < cy - (ry - rim * .6) * .55 and d > .6: i = 1          # iç duvar gölgesi (arka kenar)
        n = (x * 7 + y * 13) % 11
        if i == 3 and n == 0: i = 4
        return WATER[i]
    c.ellipse(cx, cy, rx - rim, ry - rim * .6, water)
    # dalga halkaları (parıltı yayları)
    for rr, ph in ((0.5, 0), (0.75, 2), (0.9, 5)):
        for a in range(0, 360, 6):
            if (a // 6 + ph) % 3: continue
            x = int(cx + (rx - rim) * rr * math.cos(math.radians(a))); y = int(cy + (ry - rim * .6) * rr * math.sin(math.radians(a)))
            if y > cy - 6: c.put(x, y, WATER[5])
    # orta ayak (gövde)
    for y in range(cy - 34, cy + 2):
        for x in range(cx - 8, cx + 9):
            t = (x - cx) / 8
            c.put(x, y, STONE[4 if t < -.3 else 2 if t > .35 else 3])
    c.ellipse(cx, cy + 1, 12, 6, lambda x, y: shade_stone(x, cx, 12, 3))              # taban halkası
    c.ellipse(cx, cy - 34, 10, 4, lambda x, y: STONE[5])                                   # gövde tepesi
    # üst kase
    by = cy - 38
    for off in range(6, -1, -1):
        c.ellipse(cx, by + off, 26, 11, lambda x, y, off=off: shade_stone(x, cx, 26, 1 if off > 2 else 2) if off else STONE[5])
    c.ellipse(cx, by, 21, 8, lambda x, y: WATER[3] if y > by - 3 else WATER[1])
    c.ellipse(cx - 6, by - 1, 6, 2, lambda x, y: WATER[5])
    # merkez sütun ve fışkıran su
    for y in range(by - 20, by):
        for x in range(cx - 3, cx + 4):
            t = (x - cx) / 3; c.put(x, y, STONE[4 if t < 0 else 2])
    c.ellipse(cx, by - 20, 5, 2, lambda x, y: STONE[5])
    c.put(cx, by - 23, WATER[6]); c.put(cx, by - 22, WATER[5])
    for side in (-1, 1):                         # yay şeklinde su akışları üst kaseye ve havuza
        for k in range(0, 22):
            t = k / 21
            x = cx + side * (3 + 22 * t); y = by - 21 + 40 * (t - .45) ** 2 * 1.6 + 14 * t - 4
            c.put(int(x), int(y), WATER[6] if k % 3 else WATER[5]); c.put(int(x), int(y) + 1, WATER[4])
    for side in (-1, 1):                         # kaseden havuza dökülen perde
        for k in range(1, 13):
            x = cx + side * 20; yy = by + 6 + k
            c.put(x, yy, WATER[5] if k % 2 else WATER[4]); c.put(x + side, yy, WATER[3])
    c.outline()
    return c.im

def pier_plank_rows(c, y0, y1, seed):
    """Dikey tahtalar (iskelenin ekseni yatay, tahtalar karşıya dizili)."""
    r = random.Random(seed)
    for x in range(c.w):
        k = x % 8
        for y in range(y0, y1):
            base = 3 if (x // 8) % 2 == 0 else 2
            col = WOOD[base]
            if k == 0: col = WOOD[0]               # tahta arası boşluk
            elif k == 1: col = WOOD[base + 1]        # açık kenar
            elif k == 7: col = WOOD[base - 1]
            if (x * 5 + y * 3) % 17 == 0 and k not in (0,): col = WOOD[base - 1]   # damar
            c.put(x, y, col)
    # çivi
    for x in range(4, c.w, 8):
        for y in (y0 + 3, y1 - 4): c.put(x, y, WOOD[0])

def pier_mid():
    c = Canvas(32, 64)
    pier_plank_rows(c, 4, 56, 1)
    for x in range(32):                          # üst / alt kiriş kenarı (kalınlık)
        c.put(x, 56, WOOD[1]); c.put(x, 57, WOOD[0]); c.put(x, 58, WOOD[0])
        c.put(x, 3, WOOD[5]); 
    return c.im

def pier_end():
    """Uç parça: sağ ucu kapalı, iki kazık."""
    c = Canvas(32, 64)
    for x in range(0, 28):
        for y in range(4, 56):
            c.put(x, y, pier_mid_cache.getpixel((x, y)))
    for y in range(4, 56): c.put(28, y, WOOD[1]); c.put(29, y, WOOD[0])
    for x in range(28): c.put(x, 56, WOOD[1]); c.put(x, 57, WOOD[0]); c.put(x, 58, WOOD[0]); c.put(x, 3, WOOD[5])
    for py in (6, 50):                           # kazıklar
        c.ellipse(26, py, 5, 4, lambda x, y: WOOD[4] if y < py else WOOD[2])
        c.ellipse(26, py - 1, 3, 2, lambda x, y: WOOD[5])
    return c.im

def shadow(im):
    c = Canvas(*im.size); c.im.paste(im); c.px = c.im.load()
    for x in range(c.w):
        for y in range(59, 64):
            if c.px[x, y][3] == 0: c.px[x, y] = (12, 40, 60, 110 if y < 62 else 70)
    return c.im

def with_outline(im):
    c = Canvas(*im.size); c.im.paste(im); c.px = c.im.load(); c.outline(); return c.im

if __name__ == '__main__':
    f = fountain(); f.save(os.path.join(OUT, 'fountain.png'))
    pier_mid_cache = pier_mid(); pm = shadow(with_outline(pier_mid_cache)); pm.save(os.path.join(OUT, 'pier_mid.png'))
    pe = shadow(with_outline(pier_end())); pe.save(os.path.join(OUT, 'pier_end.png'))
    # önizleme
    import importlib.util
    spec = importlib.util.spec_from_file_location('g', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ground.py')); g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
    W, H = 20, 9; T = 32; sc = Image.new('RGBA', (W * T, H * T)); r = random.Random(2)
    for ty in range(H):
        for tx in range(W):
            if tx < 8: t = g.PAVE_T[r.randrange(8)]
            elif tx < 9: t = g.GRASS[r.randrange(8)]
            else: t = g.WATER_T[r.randrange(8)]
            sc.paste(t, (tx * T, ty * T))
    sc.alpha_composite(f, (3 * T - 32, 1 * T - 20))
    for i in range(7): sc.alpha_composite(pm, ((8 + i) * T, 3 * T))
    sc.alpha_composite(pe, (15 * T, 3 * T))
    sc.resize((sc.width * 3, sc.height * 3), Image.NEAREST).save(os.path.join(OUT, 'onizleme.png'))
    print('ok')
