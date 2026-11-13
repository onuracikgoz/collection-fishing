"""Çeşme ve iskele (kodla piksel piksel, 3/4 açı). docs/tasarim/15-gorsel-stil.md
Çalıştır: python3 tools/pixel-art/fountain_pier.py -> client/Assets/Art/Custom/Plaza/
Çeşme: fountain.png (72x100, pivot altta orta). İskele: pier_mid.png, pier_end.png (32x64 parçalar, 2 tile geniş).
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

OUT_C = hx('#484152')
GOLD = [hx(c) for c in ('#603429', '#794117', '#a16018', '#d19428', '#f4e48d')]
WHITE = [hx(c) for c in ('#484152', '#726b7e', '#958080', '#c4b59f', '#e3e7d3', '#ebede9')]
AQUA = [hx(c) for c in ('#2b8fa8', '#3aafc2', '#6cdce7', '#a8f0f2')]

def fountain():
    """Üç katlı çeşme: altın kenarlı havuz, gri ayak, beyaz kaseler, turkuaz su. Kendi çizimimiz (LPC'nin 'Fountain A' kompozisyonunu örnek alır)."""
    W, H = 72, 100; c = Canvas(W, H); cx = 36
    # dış halkalar (suyun havuzdan taşan dalgası)
    for ang in range(0, 360, 7):
        for rr, ch in ((37, 1), (40, 2)):
            x = int(cx + rr * math.cos(math.radians(ang))); y = int(76 + (rr * .5) * math.sin(math.radians(ang)))
            if math.sin(math.radians(ang)) > -0.1 and (ang // 7) % 2 == 0: c.put(x, y, AQUA[ch])
    # havuz: altın duvar + üst kenar + turkuaz su
    cy, rx, ry, wall = 74, 33, 16, 10
    for off in range(wall, 0, -1):
        c.ellipse(cx, cy + off, rx, ry, lambda x, y, off=off: GOLD[1] if off > wall - 2 else GOLD[2] if (x - cx) > -rx * .55 else GOLD[3] if off < 4 else GOLD[2])
    c.ellipse(cx, cy, rx, ry, lambda x, y: GOLD[4] if y < cy - ry * .55 and x < cx else GOLD[3])
    c.ellipse(cx, cy + 1, rx - 5, ry - 4, lambda x, y: GOLD[2])                        # iç duvar
    def pool(x, y):
        d = math.hypot((x + .5 - cx) / (rx - 6), (y + .5 - (cy + 2)) / (ry - 5))
        if (int(d * 7) % 2 == 0 and d > .35): return AQUA[2]
        return AQUA[1]
    c.ellipse(cx, cy + 2, rx - 6, ry - 5, pool)
    # ayak ve taban
    def tier(tcx, tcy, trx, try_, wallh):
        for off in range(wallh, 0, -1):
            c.ellipse(tcx, tcy + off, trx, try_, lambda x, y, off=off: WHITE[2] if (x - tcx) > trx * .35 else WHITE[3])
        c.ellipse(tcx, tcy, trx, try_, lambda x, y: WHITE[5] if y < tcy else WHITE[4])
        c.ellipse(tcx, tcy + 1, trx - 3, try_ - 2, lambda x, y: AQUA[1])
        c.ellipse(tcx - 2, tcy, max(2, trx // 2), max(1, try_ // 3), lambda x, y: AQUA[2])
    def column(tcx, y0, y1, w):
        for y in range(y0, y1):
            for x in range(tcx - w, tcx + w + 1):
                t = (x - tcx) / w; c.put(x, y, WHITE[1] if t > .3 else WHITE[3] if t < -.4 else WHITE[2])
            if (y - y0) % 4 == 0:
                for x in range(tcx - w, tcx + w + 1): c.put(x, y, WHITE[0])
    c.ellipse(cx, cy - 4, 14, 6, lambda x, y: WHITE[4] if y < cy - 4 else WHITE[3])        # taban halkası
    column(cx, cy - 20, cy - 4, 9)
    tier(cx, cy - 22, 24, 10, 4)                                                              # 1. kase
    column(cx, cy - 32, cy - 22, 4)
    tier(cx, cy - 34, 16, 7, 3)                                                               # 2. kase
    column(cx, cy - 42, cy - 34, 3)
    tier(cx, cy - 44, 10, 4, 3)                                                               # 3. kase
    column(cx, cy - 54, cy - 44, 1)
    c.put(cx, cy - 56, WHITE[4]); c.put(cx, cy - 55, WHITE[3])
    # kaselerden süzülen su
    for (xx, y0, n) in ((cx - 22, cy - 18, 8), (cx + 22, cy - 18, 8), (cx - 14, cy - 29, 7), (cx + 14, cy - 29, 7)):
        for k in range(n): c.put(xx, y0 + k, AQUA[3] if k % 2 else AQUA[2])
    c.outline()
    # dış çizgi rengini çeşmeye uyarla
    for y in range(H):
        for x in range(W):
            if c.px[x, y] == OUTLINE: c.px[x, y] = OUT_C
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
    sc.alpha_composite(f, (3 * T - 4, 1 * T - 8))
    for i in range(7): sc.alpha_composite(pm, ((8 + i) * T, 3 * T))
    sc.alpha_composite(pe, (15 * T, 3 * T))
    sc.resize((sc.width * 3, sc.height * 3), Image.NEAREST).save(os.path.join(OUT, 'onizleme.png'))
    print('ok')
