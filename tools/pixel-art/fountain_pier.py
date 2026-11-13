"""Çeşme ve iskele (kodla piksel piksel, 3/4 açı). docs/tasarim/15-gorsel-stil.md
Çalıştır: python3 tools/pixel-art/fountain_pier.py -> client/Assets/Art/Custom/Plaza/
Çeşme: fountain.png (76x104, pivot altta orta). İskele: pier_mid.png, pier_end.png (32x64 parçalar, 2 tile geniş).
"""
import math, os, random
from PIL import Image
import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from soften import soften

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
    """Üç katlı çeşme, sekizgen altın havuz. Kendi çizimimiz; LPC 'Fountain A' kompozisyonunu örnek alır.
    Işık sol üstten: sol yüzler açık, sağ yüzler koyu. Arkadan öne çizilir."""
    W, H = 76, 104; c = Canvas(W, H); cx = 38
    cy, rx, ry, wall = 76, 34, 17, 10           # havuz üst kenarının merkezi ve yarıçapları

    # --- sekizgen yardımcıları (köşeler: ön, arka, sağ, sol ve çaprazlar) ---
    def octa(scale, dy=0):
        return [(cx + rx * scale * math.cos(math.radians(a)), cy + dy + ry * scale * math.sin(math.radians(a))) for a in range(0, 360, 45)]
    def inside(px, py, poly):
        n = len(poly); sgn = 0
        for i in range(n):
            x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % n]
            cr = (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1)
            if cr != 0:
                if sgn == 0: sgn = 1 if cr > 0 else -1
                elif (cr > 0) != (sgn > 0): return False
        return True
    def fill(poly, fn):
        xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
        for y in range(int(min(ys)) - 1, int(max(ys)) + 2):
            for x in range(int(min(xs)) - 1, int(max(xs)) + 2):
                if inside(x + .5, y + .5, poly): c.put(x, y, fn(x, y))
    def face(x, y, dy=0):
        """Pikselin hangi duvar yüzüne düştüğü: açıya göre 0..7 (0 = sağ, 2 = ön, 4 = sol)."""
        a = math.degrees(math.atan2((y + .5 - cy - dy) / ry, (x + .5 - cx) / rx)) % 360
        return int(a // 45)

    # --- havuz dış duvarı: yüz yüz gölgeli, ön köşelerde parlak kenar ---
    WALL_SHADE = {0: GOLD[1], 1: GOLD[2], 2: GOLD[2], 3: GOLD[3], 4: GOLD[3], 5: GOLD[3], 6: GOLD[2], 7: GOLD[1]}
    for off in range(wall, 0, -1):
        def wfn(x, y, off=off):
            col = WALL_SHADE[face(x, y, off)]
            if off >= wall - 1: col = GOLD[0] if col == GOLD[1] else GOLD[1]      # alt kenar gölgesi
            return col
        fill(octa(1, off), wfn)
    for a in (45, 90, 135, 180):                                                     # ön köşe kenarları
        x = int(round(cx + rx * math.cos(math.radians(a)))); y0 = int(round(cy + ry * math.sin(math.radians(a))))
        for k in range(1, wall - 1): c.put(x, y0 + k, GOLD[4] if a >= 90 else GOLD[3])

    # --- üst kenar (taç): dış sekizgen açık, iç sekizgen içte ---
    fill(octa(1), lambda x, y: GOLD[4] if (face(x, y) in (4, 5, 6)) else GOLD[3])
    fill(octa(0.80), lambda x, y: GOLD[1])                                           # iç duvar (arka tarafı görünür)
    # --- havuz suyu ---
    def pool(x, y):
        d = math.hypot((x + .5 - cx) / (rx * .78), (y + .5 - (cy + 2)) / (ry * .70))
        col = AQUA[1]
        if d > .86 and y < cy: col = AQUA[0]                                        # arka iç kenarın gölgesi
        ring = d * 4.5
        if .4 < d < .95 and (ring - int(ring)) < .14: col = AQUA[2]                # dalga halkaları
        if (x * 13 + y * 7) % 53 == 0 and d < .85: col = AQUA[3]                     # parıltı
        return col
    fill(octa(0.78, 2), pool)

    # --- yardımcılar: kase (kesik koni) ve sütun ---
    def bowl(tcx, tcy, trx, try_, depth):
        for k in range(depth, 0, -1):                                               # alt yüz: aşağı doğru daralır
            f = 1 - 0.45 * k / depth
            c.ellipse(tcx, tcy + k, trx * f, try_ * f, lambda x, y, k=k: WHITE[1] if (x - tcx) > trx * f * .25 or k > depth - 2 else WHITE[2])
        c.ellipse(tcx, tcy + 1, trx, try_, lambda x, y: WHITE[3])                   # dudak (ön kalınlık)
        c.ellipse(tcx, tcy, trx, try_, lambda x, y: WHITE[5] if (x - tcx) < 0 and y < tcy else WHITE[4])
        def w(x, y):
            d = math.hypot((x + .5 - tcx) / (trx - 2.5), (y + .5 - tcy - .5) / (try_ - 2))
            if y < tcy - (try_ - 2) * .45: return AQUA[0]
            if d < .55 and x < tcx: return AQUA[2]
            return AQUA[1]
        c.ellipse(tcx, tcy + .5, trx - 2.5, try_ - 2, w)
    def column(tcx, y0, y1, w, rings=True):
        for y in range(y0, y1):
            for x in range(tcx - w, tcx + w + 1):
                t = (x - tcx) / max(1, w)
                c.put(x, y, WHITE[4] if t < -.45 else WHITE[1] if t > .35 else WHITE[3])
            if rings and (y - y0) % 5 == 2:
                for x in range(tcx - w, tcx + w + 1): c.put(x, y, WHITE[1])
    def curtain(x, y0, n):
        for k in range(n):
            c.put(x, y0 + k, AQUA[3] if k % 3 == 0 else AQUA[2])
            if k > 1: c.put(x + (1 if x > cx else -1), y0 + k, AQUA[1])
        c.put(x - 1, y0 + n, AQUA[3]); c.put(x + 1, y0 + n, AQUA[3])               # sıçrama

    # --- ayak (havuzun içinden yükselir) ---
    c.ellipse(cx, cy - 1, 15, 6, lambda x, y: WHITE[2] if x > cx + 4 else WHITE[3])
    c.ellipse(cx, cy - 2, 14, 5, lambda x, y: WHITE[5] if x < cx else WHITE[4])
    column(cx, cy - 20, cy - 2, 8)
    c.ellipse(cx, cy - 20, 9, 3, lambda x, y: WHITE[4])
    # --- 1. kase ---
    bowl(cx, cy - 24, 25, 10, 7)
    curtain(cx - 23, cy - 21, 13); curtain(cx + 23, cy - 21, 13)
    # --- 2. kase ---
    column(cx, cy - 36, cy - 24, 4)
    bowl(cx, cy - 38, 16, 6.5, 5)
    curtain(cx - 14, cy - 36, 9); curtain(cx + 14, cy - 36, 9)
    # --- 3. kase ---
    column(cx, cy - 48, cy - 38, 3)
    bowl(cx, cy - 50, 9, 4, 4)
    # --- uç ve fışkıran su ---
    column(cx, cy - 58, cy - 50, 1, rings=False)
    c.ellipse(cx, cy - 59, 2, 1.5, lambda x, y: WHITE[5])
    for k, (dx, dy) in enumerate(((0, -62), (-1, -63), (1, -63), (-3, -62), (3, -62), (-5, -60), (5, -60), (-6, -57), (6, -57))):
        c.put(cx + dx, cy + dy, AQUA[3] if k % 2 == 0 else AQUA[2])

    c.outline()
    c.im = soften(c.im); c.px = c.im.load()
    # --- yerdeki ıslaklık ve dalga halkaları ---
    for ang in range(0, 181, 6):
        for rr, col in ((1.12, AQUA[1]), (1.22, AQUA[2])):
            if (ang // 6) % 2: continue
            x = int(cx + rx * rr * math.cos(math.radians(ang))); y = int(cy + wall + ry * rr * math.sin(math.radians(ang)))
            if 0 <= x < W - 1 and 0 <= y < H and c.px[x, y][3] == 0 and c.px[x + 1, y][3] == 0: c.put(x, y, col); c.put(x + 1, y, col)

    return c.im

RSTONE = [hx(c) for c in ('#55423a', '#765c4a', '#94785e', '#ae9272', '#c4a986', '#d9c2a0')]
MOSS = [hx(c) for c in ('#36652d', '#4b8a37', '#62a244', '#7cb956')]
RWATER = [hx(c) for c in ('#225f78', '#2f7790', '#3e8ea3', '#62adb9', '#a4dcdc')]
PINK, YEL, CREAM = hx('#e58aa6'), hx('#f2c94c'), hx('#f4eed2')

def fountain_cozy():
    """Köy çeşmesi: düzensiz taşlardan yuvarlak havuz, yosun, tek taş kase, çiçek öbekleri. Sonda yumuşatma."""
    W, H = 80, 84; c = Canvas(W, H); cx = 40
    cy, rx, ry, wall = 58, 31, 14, 9
    rng = random.Random(7)
    shade = {}
    def stone_col(a, row, ystep, base):
        n = 26 if row % 2 == 0 else 27
        seg = a / 360 * n + (0.5 if row % 2 else 0)
        idx = int(seg) % n; f = seg - int(seg)
        key = (row, idx)
        if key not in shade: shade[key] = rng.choice((-1, 0, 0, 1))
        if f < 0.09 or ystep: return RSTONE[0] if base < 3 else RSTONE[1]       # derz
        return RSTONE[max(1, min(5, base + shade[key]))]
    # duvar: iki sıra taş
    for off in range(wall, 0, -1):
        row = 0 if off <= wall // 2 else 1
        def wfn(x, y, off=off, row=row):
            a = math.degrees(math.atan2((y + .5 - cy - off) / ry, (x + .5 - cx) / rx)) % 360
            light = 3 if 100 < a < 200 else 2 if a < 60 else 2
            if a < 40 or a > 330: light = 1
            return stone_col(a, row, off == wall // 2 + 1, light)
        c.ellipse(cx, cy + off, rx, ry, wfn)
    # üst kenar (kalın taş halka)
    def rim(x, y):
        a = math.degrees(math.atan2((y + .5 - cy) / ry, (x + .5 - cx) / rx)) % 360
        return stone_col(a, 2, False, 4 if 150 < a < 290 else 3)
    c.ellipse(cx, cy, rx, ry, rim)
    c.ellipse(cx, cy + 1, rx - 5, ry - 4, lambda x, y: RSTONE[1])                    # iç duvar
    def pool(x, y):
        d = math.hypot((x + .5 - cx) / (rx - 6), (y + .5 - cy - 2) / (ry - 5))
        col = RWATER[2]
        if y < cy - (ry - 5) * .35: col = RWATER[1]
        if y < cy - (ry - 5) * .7: col = RWATER[0]
        if .55 < d < .7 and (x + y) % 3: col = RWATER[3]
        return col
    c.ellipse(cx, cy + 2, rx - 6, ry - 5, pool)
    # nilüfer yaprakları
    for (lx, ly) in ((cx - 15, cy + 4), (cx + 17, cy + 1)):
        c.ellipse(lx, ly, 3.2, 1.8, lambda x, y: MOSS[2] if y < ly else MOSS[1])
        c.put(lx + 1, ly - 1, RWATER[2])
    c.put(cx - 15, cy + 3, PINK); c.put(cx - 14, cy + 3, CREAM)
    # orta: taş sütun + tek kase + oluk
    for y in range(cy - 26, cy + 2):
        for x in range(cx - 6, cx + 7):
            t = (x - cx) / 6; row = (y - (cy - 26)) // 4
            col = RSTONE[4 if t < -.3 else 2 if t > .4 else 3]
            if (y - (cy - 26)) % 4 == 0 or (x + row * 3) % 6 == 0: col = RSTONE[1]
            c.put(x, y, col)
    c.ellipse(cx, cy + 1, 8, 3, lambda x, y: RSTONE[2])
    by = cy - 28
    for off in range(5, 0, -1):
        f = 1 - .35 * off / 5
        c.ellipse(cx, by + off, 15 * f, 6 * f, lambda x, y: RSTONE[2] if x > cx + 3 else RSTONE[3])
    c.ellipse(cx, by, 15, 6, lambda x, y: RSTONE[5] if (x < cx and y < by) else RSTONE[4])
    c.ellipse(cx, by + .5, 12, 4.2, lambda x, y: RWATER[0] if y < by - 1 else RWATER[2])
    c.ellipse(cx - 3, by, 4, 1.2, lambda x, y: RWATER[3])
    # kaseden taşan su (iki ince akış)
    for side in (-1, 1):
        x0 = cx + side * 13
        for k in range(0, 24):
            xx = x0 + side * (1 if k > 3 else 0) + side * (1 if k > 10 else 0)
            c.put(xx, by + 3 + k, RWATER[4] if k % 3 else RWATER[3])
        for dx in (-2, 0, 2): c.put(x0 + side * 2 + dx, by + 27, RWATER[4])
    # tepede küçük oluk (taş topuz)
    c.ellipse(cx, by - 4, 3, 3, lambda x, y: RSTONE[4] if x < cx else RSTONE[3])
    c.put(cx, by - 8, RWATER[4]); c.put(cx - 1, by - 7, RWATER[3]); c.put(cx + 1, by - 7, RWATER[3])
    # yosun: kenarın üstünde ve duvar dibinde öbekler
    for a in (190, 215, 240, 290, 315, 20, 110, 135, 160):
        x = int(cx + rx * .93 * math.cos(math.radians(a))); y = int(cy + ry * .93 * math.sin(math.radians(a)))
        for dx in range(-3, 4):
            if rng.random() < .8: c.put(x + dx, y + (abs(dx) > 1), MOSS[1 + (dx < 0)])
        c.put(x, y - 1, MOSS[3])
    for a in (40, 70, 100, 140):
        x = int(cx + rx * math.cos(math.radians(a))); y = int(cy + wall + ry * math.sin(math.radians(a)))
        for dx in range(-4, 5):
            c.put(x + dx, y - (1 if abs(dx) < 2 else 0), MOSS[1 if dx % 2 else 2])
    # çiçek öbekleri (önde sol ve sağ)
    for (fx, fy) in ((cx - 30, cy + 16), (cx + 29, cy + 15)):
        c.ellipse(fx, fy, 7, 4, lambda x, y: MOSS[1] if y > fy else MOSS[2])
        for (dx, dy, col) in ((-3, -2, PINK), (0, -3, YEL), (3, -1, PINK), (-1, 0, CREAM), (4, -3, YEL), (-5, 0, YEL)):
            c.put(fx + dx, fy + dy, col); c.put(fx + dx, fy + dy + 1, MOSS[0])
    c.outline()
    c.im = soften(c.im); c.px = c.im.load()
    return c.im

def pier_plank_rows(c, y0, y1, seed):
    """Tahtalar iskeleye dik dizili; genişlik ve ton tahta tahta değişir, aralarında boşluk, uçlarda çivi."""
    r = random.Random(seed); x = 0
    while x < c.w:
        w = r.choice((6, 7, 7, 8)); base = r.choice((2, 3, 3, 4)); worn = r.random() < .25
        for k in range(w):
            for y in range(y0, y1):
                col = WOOD[base]
                if k == 0: col = WOOD[0]
                elif k == 1: col = WOOD[min(5, base + 1)]
                elif k == w - 1: col = WOOD[base - 1]
                elif (y * 7 + (x + k) * 3 + seed) % 23 == 0: col = WOOD[base - 1]          # damar
                if worn and (y + k) % 9 == 0 and 1 < k < w - 1: col = WOOD[min(5, base + 1)]
                if x + k < c.w: c.put(x + k, y, col)
        if x + 3 < c.w:
            c.put(x + 3, y0 + 3, WOOD[0]); c.put(x + 3, y1 - 4, WOOD[0])
        x += w

def pier_mid(seed=1, posts=False):
    c = Canvas(32, 64)
    pier_plank_rows(c, 6, 56, seed)
    for x in range(32):
        c.put(x, 56, WOOD[1]); c.put(x, 57, WOOD[0]); c.put(x, 58, WOOD[0])            # ön kalınlık
        c.put(x, 5, WOOD[4])
    for (px_, py_) in (((2, 6), (2, 54)) if posts else ()):                               # kazık başları (sadece kazıklı parçada)
        c.ellipse(px_ + 1, py_, 3, 2.5, lambda x, y, py_=py_: WOOD[4] if y < py_ else WOOD[2])
        c.ellipse(px_ + 1, py_ - 1, 1.5, 1, lambda x, y: WOOD[5])
    return c.im

def pier_end():
    """Uç parça: sağ ucu kapalı, iki kazık."""
    c = Canvas(32, 64)
    pier_plank_rows(c, 6, 56, 2)
    for y in range(64):
        for x in range(28, 32): c.put(x, y, (0, 0, 0, 0))
    for y in range(6, 59): c.put(27, y, WOOD[1])
    for x in range(28):
        c.put(x, 56, WOOD[1]); c.put(x, 57, WOOD[0]); c.put(x, 58, WOOD[0]); c.put(x, 5, WOOD[4])
    for (px_, py_) in ((2, 6), (2, 54), (25, 6), (25, 54)):
        c.ellipse(px_ + 1, py_, 3, 2.5, lambda x, y, py_=py_: WOOD[4] if y < py_ else WOOD[2])
        c.ellipse(px_ + 1, py_ - 1, 1.5, 1, lambda x, y: WOOD[5])
    return c.im

def shadow(im):
    c = Canvas(*im.size); c.im.paste(im); c.px = c.im.load()
    for x in range(c.w):
        for y in range(59, 64):
            if c.px[x, y][3] == 0: c.px[x, y] = (12, 40, 60, 110 if y < 62 else 70)
    return c.im

def with_outline(im):
    c = Canvas(*im.size); c.im.paste(im); c.px = c.im.load(); c.outline(); return soften(c.im)

if __name__ == '__main__':
    f = fountain(); f.save(os.path.join(OUT, 'fountain_ornate.png'))
    f = fountain_cozy(); f.save(os.path.join(OUT, 'fountain.png'))
    pier_mid_cache = pier_mid(); pm = shadow(with_outline(pier_mid_cache)); pm.save(os.path.join(OUT, 'pier_mid.png'))
    pms = [shadow(with_outline(pier_mid(sd))) for sd in (1, 3, 5)]
    for i, im_ in enumerate(pms[1:], 2): im_.save(os.path.join(OUT, f'pier_mid_{i}.png'))
    pp = shadow(with_outline(pier_mid(7, posts=True))); pp.save(os.path.join(OUT, 'pier_post.png'))
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
    sc.alpha_composite(f, (3 * T - 8, 1 * T))
    for i in range(7): sc.alpha_composite(pp if i == 3 else pms[i % 3], ((8 + i) * T, 3 * T))
    sc.alpha_composite(pe, (15 * T, 3 * T))
    sc.resize((sc.width * 3, sc.height * 3), Image.NEAREST).save(os.path.join(OUT, 'onizleme.png'))
    print('ok')
