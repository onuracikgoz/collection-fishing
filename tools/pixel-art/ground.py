"""Çimen, toprak ve kar tile'ları (32 px), kodla piksel piksel (docs/tasarim/15-gorsel-stil.md).
Çalıştır: python3 tools/pixel-art/ground.py  ->  client/Assets/Art/Custom/Ground/
- Her doku kendi içinde dikişsiz (wrap) ve tüm çeşitlerin kenar bandı ortak:
  çeşitler haritada rastgele dizilse de çizgi belli olmaz.
- Geçişler köşe tabanlı (Wang) 16 parça: her tile'ın 4 köşesi çimen mi toprak mı.
"""
import math, os, random
from PIL import Image

T = 32
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'client', 'Assets', 'Art', 'Custom', 'Ground')
os.makedirs(OUT, exist_ok=True)
def hx(s): s = s.lstrip('#'); return tuple(int(s[i:i+2], 16) for i in (0, 2, 4)) + (255,)

G = [hx(c) for c in ('#2a4d24', '#36652d', '#427a34', '#4b8a37', '#56973d', '#62a244', '#70ad4b')]   # v2: düşük kontrast, nesneler öne çıksın
D = [hx(c) for c in ('#5a3a22', '#74502f', '#8a6039', '#9a6c42', '#a6784b', '#b48654', '#c1935e')]
SN = [hx(c) for c in ('#7f97b0', '#a3b9cd', '#c4d6e4', '#dfeaf2', '#f4f9fc', '#ffffff')]   # kar: mavimsi gölgeler, beyaz tepe
SAND = [hx(c) for c in ('#b08a58', '#c9a46c', '#dcbd84', '#e8cc96', '#f1dba8', '#f9ecc6')]
WATER = [hx(c) for c in ('#1f4f63', '#285f72', '#2f6f80', '#3a7d8b', '#5a9ba2', '#9fcfc8')]   # cozy: daha koyu, az doygun
PAVE = [hx(c) for c in ('#5a4a40', '#7c6656', '#98806a', '#ae967c', '#c3ab8f', '#d6c1a4')]
STONE = [hx(c) for c in ('#4d4a48', '#7a746c', '#a59d90', '#cbc3b3')]
FLOWERS = [(hx('#f4eed2'), hx('#f2c94c')), (hx('#f2c94c'), hx('#c9772c')), (hx('#e58aa6'), hx('#f6e7a8')), (hx('#a99be8'), hx('#f6e7a8'))]

def pnoise(x, y, seed, octaves=((1, 1.0), (2, 0.55), (4, 0.3))):
    """32 px'te kendini tekrar eden (periyodik) yumuşak gürültü, -1..1."""
    r = random.Random(seed); v = 0.0; tot = 0.0
    for f, a in octaves:
        for _ in range(3):
            kx, ky = r.randint(-f, f), r.randint(-f, f)
            if kx == 0 and ky == 0: kx = f
            ph = r.random() * 6.283
            v += a * math.sin(2 * math.pi * (kx * x + ky * y) / T + ph); tot += a
    return v / tot * 1.8

class Tex:
    def __init__(self): self.p = {}
    def put(self, x, y, c): self.p[(x % T, y % T)] = c
    def get(self, x, y): return self.p[(x % T, y % T)]

# ---------------- çimen ----------------
def grass_base(t):
    for y in range(T):
        for x in range(T):
            n = pnoise(x, y, 11, ((2, 1.0), (3, 0.7)))
            h = random.Random(x * 131 + y * 7919 + 11).random()
            i = 3
            if h < 0.07 + 0.05 * n: i = 2
            elif h > 0.96 - 0.03 * n: i = 4
            t.put(x, y, G[i])

def tuft(t, x, y, r):
    """Küçük ot öbeği: koyu dip, açık uçlu yapraklar."""
    h = r.choice((3, 4, 4, 5))
    t.put(x, y + 1, G[1]); t.put(x - 1, y + 1, G[2]); t.put(x + 1, y + 1, G[2])
    for k in range(h):
        t.put(x, y - k, G[5] if k < h - 1 else G[6])
    if r.random() < 0.8:
        for k in range(h - 1):
            t.put(x - 1 - (k > 0), y - k, G[4] if k < h - 2 else G[5])
    if r.random() < 0.8:
        for k in range(h - 2):
            t.put(x + 1 + (k > 0), y - k, G[4])
    t.put(x, y, G[2])

def clump(t, x, y, r):
    """Daha büyük yaprak öbeği: açık üst, koyu alt gölge (referanstaki kabarık çimen)."""
    w = r.choice((2, 3))
    for dy in range(-2, 2):
        for dx in range(-w, w + 1):
            if (dx / (w + 0.5)) ** 2 + ((dy + 0.5) / 2.2) ** 2 > 1: continue
            c = G[4]
            if dy == -2 or (dy == -1 and abs(dx) < w): c = G[5]
            if dy == 1: c = G[3]
            t.put(x + dx, y + dy, c)
    for dx in range(-w + 1, w): t.put(x + dx, y + 2, G[2])
    for dx in (-w + 1, 0, w - 1): t.put(x + dx, y - 3, G[5]); t.put(x + dx, y - 2, G[6] if r.random() < .5 else G[5])

def dark_patch(t, x, y, r):
    for dx, dy in ((0, 0), (1, 0), (0, 1), (-1, 0)):
        t.put(x + dx, y + dy, G[2])
    t.put(x, y + 1, G[1])

def flower(t, x, y, r):
    petal, mid = r.choice(FLOWERS)
    t.put(x, y + 1, G[1])
    for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)): t.put(x + dx, y + dy, petal)
    t.put(x, y, mid)

def scatter(r, n, lo, hi, band):
    pts = []
    for _ in range(n * 6):
        if len(pts) >= n: break
        x, y = r.randrange(T), r.randrange(T)
        edge = min(x, y, T - 1 - x, T - 1 - y)
        if band and edge > 4: continue
        if not band and not (lo <= x < hi and lo <= y < hi): continue
        if any(min(abs(x - a), T - abs(x - a)) < 4 and min(abs(y - b), T - abs(y - b)) < 4 for a, b in pts): continue
        pts.append((x, y))
    return pts

def grass_tile(variant):
    t = Tex(); grass_base(t)
    r0 = random.Random(100)                      # kenar bandı: bütün çeşitlerde aynı
    for x, y in scatter(r0, 5, 0, 0, True):
        f = r0.random(); (clump if f < 0.25 else tuft if f < 0.85 else dark_patch)(t, x, y, r0)
    r = random.Random(200 + variant)             # iç kısım: çeşide göre
    pts = scatter(r, 4 + variant % 3, 7, 25, False)
    for i, (x, y) in enumerate(pts):
        if variant == 6 and i < 2: flower(t, x, y, r)
        elif variant == 7 and i == 0: flower(t, x, y, r)
        else:
            f = r.random(); (clump if f < 0.3 else tuft if f < 0.85 else dark_patch)(t, x, y, r)
    return t

# ---------------- toprak ----------------
def dirt_base(t):
    for y in range(T):
        for x in range(T):
            n = pnoise(x, y, 23, ((2, 1.0), (3, 0.7)))
            h = random.Random(x * 733 + y * 1543 + 23).random()
            i = 3
            if h < 0.08 + 0.05 * n: i = 2
            elif h > 0.95 - 0.03 * n: i = 4
            t.put(x, y, D[i])

def clod(t, x, y, r):
    rr = r.choice((1, 1, 2))
    for dy in range(-rr, rr + 1):
        for dx in range(-rr - 1, rr + 2):
            if (dx / (rr + 1.2)) ** 2 + (dy / (rr + 0.5)) ** 2 > 1: continue
            c = D[4]
            if dy < 0 or dx < -rr + 1: c = D[5]
            if dy == -rr and dx <= 0: c = D[6]
            if dy == rr or dx > rr: c = D[2]
            t.put(x + dx, y + dy, c)
    for dx in range(-rr, rr + 2): t.put(x + dx, y + rr + 1, D[1])   # alt gölge

def pebble(t, x, y, r):
    t.put(x, y, STONE[2]); t.put(x + 1, y, STONE[1]); t.put(x, y - 1, STONE[3]); t.put(x + 1, y - 1, STONE[2])
    t.put(x, y + 1, D[1]); t.put(x + 1, y + 1, D[1]); t.put(x + 2, y, D[2])

def crack(t, x, y, r):
    dx = r.choice((-1, 1))
    for k in range(r.choice((3, 4))):
        t.put(x + (k * dx) // 2, y + k, D[1]); t.put(x + (k * dx) // 2 + 1, y + k, D[4] if k % 2 else D[3])

def speck(t, x, y, r):
    t.put(x, y, D[2]); t.put(x + 1, y, D[5] if r.random() < .5 else D[2])

def dirt_tile(variant):
    t = Tex(); dirt_base(t)
    r0 = random.Random(300)
    for x, y in scatter(r0, 5, 0, 0, True):
        f = r0.random(); (clod if f < 0.5 else crack if f < 0.7 else speck)(t, x, y, r0)
    r = random.Random(400 + variant)
    for i, (x, y) in enumerate(scatter(r, 3 + variant % 3, 7, 25, False)):
        f = r.random()
        if variant in (1, 5) and i == 0: pebble(t, x, y, r)
        elif variant == 3 and i < 2: pebble(t, x, y, r)
        else: (clod if f < 0.55 else crack if f < 0.7 else speck)(t, x, y, r)
    return t

def to_img(t):
    im = Image.new('RGBA', (T, T)); px = im.load()
    for (x, y), c in t.p.items(): px[x, y] = c
    return im

NV = 8
GRASS = [to_img(grass_tile(v)) for v in range(NV)]
DIRT = [to_img(dirt_tile(v)) for v in range(NV)]

# ---------------- kar ----------------
def snow_base(t):
    for y in range(T):
        for x in range(T):
            n = pnoise(x, y, 31, ((2, 1.0), (3, 0.7)))
            h = random.Random(x * 389 + y * 2237 + 31).random()
            i = 3
            if h < 0.10 + 0.06 * n: i = 2
            elif h > 0.94 - 0.03 * n: i = 4
            t.put(x, y, SN[i])

def drift(t, x, y, r):
    """Yumuşak kar yığını: açık tepe, mavimsi alt gölge."""
    w = r.choice((2, 3, 3))
    for dy in range(-1, 2):
        for dx in range(-w, w + 1):
            if (dx / (w + 0.6)) ** 2 + (dy / 1.5) ** 2 > 1: continue
            c = SN[4] if dy < 1 else SN[2]
            if dy == -1 and abs(dx) < w: c = SN[5]
            t.put(x + dx, y + dy, c)
    for dx in range(-w + 1, w): t.put(x + dx, y + 2, SN[1])

def snow_dip(t, x, y, r):
    for dx, dy in ((0, 0), (1, 0), (-1, 0)): t.put(x + dx, y + dy, SN[2])
    t.put(x, y + 1, SN[1])

def sparkle(t, x, y, r):
    t.put(x, y, SN[5])
    for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)): t.put(x + dx, y + dy, SN[4])

def twig(t, x, y, r):
    for k in range(3): t.put(x + k, y + (k % 2), D[1])
    t.put(x + 1, y - 1, D[2])

def snow_tile(variant):
    t = Tex(); snow_base(t)
    r0 = random.Random(500)
    for x, y in scatter(r0, 5, 0, 0, True):
        f = r0.random(); (drift if f < 0.45 else snow_dip)(t, x, y, r0)
    r = random.Random(600 + variant)
    for i, (x, y) in enumerate(scatter(r, 4 + variant % 3, 7, 25, False)):
        if variant in (2, 6) and i == 0: sparkle(t, x, y, r)
        elif variant == 5 and i == 0: twig(t, x, y, r)
        else:
            f = r.random(); (drift if f < 0.5 else snow_dip if f < 0.85 else sparkle)(t, x, y, r)
    return t


# ---------------- kum ----------------
def sand_tile(variant):
    t = Tex()
    for y in range(T):
        for x in range(T):
            n = pnoise(x, y, 41, ((2, 1.0), (3, 0.7)))
            h = random.Random(x * 211 + y * 1789 + 41).random()
            i = 3
            if h < 0.10 + 0.06 * n: i = 2
            elif h > 0.95 - 0.03 * n: i = 4
            t.put(x, y, SAND[i])
    r0 = random.Random(700)                      # kenar bandı ortak
    for x, y in scatter(r0, 4, 0, 0, True):
        for k in range(3): t.put(x + k, y, SAND[2]); t.put(x + k, y + 1, SAND[1] if k == 1 else SAND[3])
    r = random.Random(800 + variant)
    for i, (x, y) in enumerate(scatter(r, 4 + variant % 3, 7, 25, False)):
        if variant in (2, 5) and i == 0:           # küçük çakıl
            t.put(x, y, STONE[2]); t.put(x + 1, y, STONE[1]); t.put(x, y - 1, STONE[3]); t.put(x, y + 1, SAND[1])
        elif variant == 6 and i == 0:              # deniz kabuğu
            t.put(x, y, hx('#f4eed2')); t.put(x + 1, y, hx('#e58aa6')); t.put(x, y + 1, SAND[1])
        else:                                      # rüzgar çizgisi
            for k in range(r.choice((3, 4, 5))): t.put(x + k, y, SAND[2]); t.put(x + k, y + 1, SAND[5] if k == 0 else SAND[3])
    return t

# ---------------- su ----------------
def water_tile(variant):
    """Sakin su: düz zemin, sadece iç kısımda çeşide göre değişen yumuşak leke ve seyrek parıltı (kenar bandı düz, dikiş görünmez)."""
    t = Tex(); r = random.Random(1000 + variant)
    for y in range(T):
        for x in range(T): t.put(x, y, WATER[3])
    for _ in range(1 + variant % 2):                       # iç kısımda yumuşak koyu leke
        cx_, cy_ = r.randint(10, 22), r.randint(10, 22); rx_, ry_ = r.randint(4, 7), r.randint(2, 4)
        for y in range(cy_ - ry_, cy_ + ry_ + 1):
            for x in range(cx_ - rx_, cx_ + rx_ + 1):
                if ((x - cx_) / rx_) ** 2 + ((y - cy_) / ry_) ** 2 <= 1: t.put(x, y, WATER[2])
    for i, (x, y) in enumerate(scatter(r, variant % 3, 6, 24, False)):
        for k in range(r.choice((3, 4))): t.put(x + k, y, WATER[5] if k == 1 else WATER[4])
    return t

# ---------------- taş döşeme ----------------
COBBLES = None
def _cobble_layout():
    """32 px'te kendini tekrar eden düzensiz parke taşı yerleşimi (periyodik Voronoi). Bütün çeşitlerde aynı: kenarlar tutar."""
    r = random.Random(1234); pts = []
    while len(pts) < 7:
        p = (r.uniform(0, T), r.uniform(0, T))
        if all(min(abs(p[0] - q[0]), T - abs(p[0] - q[0])) ** 2 + min(abs(p[1] - q[1]), T - abs(p[1] - q[1])) ** 2 > 75 for q in pts): pts.append(p)
    cell = {}
    for y in range(T):
        for x in range(T):
            ds = []
            for i, (px_, py_) in enumerate(pts):
                dx = min(abs(x + .5 - px_), T - abs(x + .5 - px_)); dy = min(abs(y + .5 - py_), T - abs(y + .5 - py_))
                sx = (x + .5 - px_); sx = sx - T if sx > T / 2 else sx + T if sx < -T / 2 else sx
                sy = (y + .5 - py_); sy = sy - T if sy > T / 2 else sy + T if sy < -T / 2 else sy
                ds.append((math.hypot(dx, dy * 1.15), i, sx, sy))
            ds.sort()
            cell[(x, y)] = (ds[0][1], ds[1][0] - ds[0][0], ds[0][2], ds[0][3])
    return cell

def pave_tile(variant):
    """Yuvarlak, düzensiz parke taşları; aralarda toprak ve yer yer yosun. Işık sol üstten."""
    global COBBLES
    if COBBLES is None: COBBLES = _cobble_layout()
    t = Tex(); r = random.Random(1100 + variant)
    shade = [r.choice((2, 3, 3, 4)) for _ in range(7)]
    moss = {r.randrange(7) for _ in range(variant % 3)}
    for (x, y), (i, gap, sx, sy) in COBBLES.items():
        if gap < 1.3:
            c = G[2] if i in moss and (x + y) % 2 else PAVE[1]            # derz: toprak, bazen yosun
        else:
            b = shade[i]
            if sx < -1.5 and sy < -1: b += 1                          # sol üst kenar ışık alır
            if sx > 1.5 and sy > 1 or gap < 2.2 and sy > 0: b -= 1     # sağ alt gölge
            c = PAVE[max(1, min(5, b))]
        t.put(x, y, c)
    return t

NV = 8
GRASS = [to_img(grass_tile(v)) for v in range(NV)]
DIRT = [to_img(dirt_tile(v)) for v in range(NV)]
SNOW = [to_img(snow_tile(v)) for v in range(NV)]
SAND_T = [to_img(sand_tile(v)) for v in range(NV)]
WATER_T = [to_img(water_tile(v)) for v in range(NV)]
PAVE_T = [to_img(pave_tile(v)) for v in range(NV)]

# ---------------- geçiş (Wang, köşe tabanlı) ----------------
# Her çift: lower = altta kalan malzeme (maske 1), upper = üstüne taşan malzeme (maske 0).
NVAR = 3   # her geçiş parçasından 3 çeşit
MAT = {
    'grass': dict(tiles=GRASS, pal=G, seed=77),
    'dirt':  dict(tiles=DIRT,  pal=D, seed=78),
    'snow':  dict(tiles=SNOW,  pal=SN, seed=79),
    'sand':  dict(tiles=SAND_T, pal=SAND, seed=80),
    'water': dict(tiles=WATER_T, pal=WATER, seed=81),
    'pave':  dict(tiles=PAVE_T, pal=PAVE, seed=82),
}
PAIRS = {            # dosya adı: (lower, upper)
    'cimen-toprak': ('dirt', 'grass'),
    'kar-cimen':    ('grass', 'snow'),
    'kar-toprak':   ('dirt', 'snow'),
    'kum-cimen':    ('grass', 'sand'),
    'kum-su':       ('water', 'sand'),
    'tas-cimen':    ('grass', 'pave'),
    'tas-kum':      ('sand', 'pave'),
}

def win(u, v):
    """Tile kenarında 0: çeşitler yan yana gelse de kenarlar tutar, dalga sadece tile içinde değişir."""
    return math.sin(math.pi * u) ** 0.5 * math.sin(math.pi * v) ** 0.5

def smooth(u): return u * u * (3 - 2 * u)

def wang_tile(lower, upper, nw, ne, sw, se, vi=0):
    """Köşe bitleri: 1 = lower. Upper dokusu lower'ın üstüne taşar; kenarda gölge ve açık uç."""
    gi = di = (vi * 3) % NV
    lo, up = MAT[lower], MAT[upper]
    amp = {'snow': 0.6, 'pave': 0.3, 'sand': 0.5}.get(upper, 0.42)      # kar kenarı daha dalgalı, düz çizgi gibi kesilmesin
    d, g = lo['tiles'][di].load(), up['tiles'][gi].load()
    LP, UP = lo['pal'], up['pal']
    im = Image.new('RGBA', (T, T)); px = im.load()
    def is_lower(x, y):
        u, v = (x + 0.5) / T, (y + 0.5) / T          # doğrusal: gürültü kenarı kıvırsın, sivri kanca çıkmasın
        m = (nw * (1 - u) * (1 - v) + ne * u * (1 - v) + sw * (1 - u) * v + se * u * v)
        return m + 0.4 * amp * pnoise(x, y, 77, ((1, 0.8), (2, 1.0), (3, 0.9), (4, 0.7))) + amp * win(u, v) * pnoise(x, y, 77 + vi * 13, ((1, 0.8), (2, 1.0), (3, 0.9), (4, 0.7))) > 0.5
    mask = [[is_lower(x, y) for x in range(T)] for y in range(T)]
    def M(x, y):
        return mask[min(T - 1, max(0, y))][min(T - 1, max(0, x))]
    for y in range(T):
        for x in range(T):
            if mask[y][x]:
                c = d[x, y]
                if upper == 'pave': pass                  # taş zeminle aynı seviyede: alt malzemeye gölge düşmez
                elif not M(x, y - 1) or not M(x, y - 2) and y > 1: c = LP[1]
                elif not M(x - 1, y) or not M(x + 1, y): c = LP[2]
                px[x, y] = c
            else:
                c = g[x, y]
                if upper == 'pave':
                    if M(x, y + 1) or M(x, y - 1) or M(x - 1, y) or M(x + 1, y): c = UP[1]   # ince koyu kenar çizgisi, yükselti yok
                elif M(x, y + 1) and y < T - 1: c = UP[1] if (x * 7 + y) % 5 else UP[2]
                elif M(x, y - 1) and y > 0: c = UP[-2] if (x * 3) % 4 else UP[-1]
                elif M(x - 1, y) or M(x + 1, y): c = UP[2]
                px[x, y] = c
    return im

def wang_index(nw, ne, sw, se): return nw * 8 + ne * 4 + sw * 2 + se

WANG = {}
for name, (lo, up) in PAIRS.items():
    WANG[name] = {}
    for vi in range(NVAR):
        for i in range(16):
            bits = ((i >> 3) & 1, (i >> 2) & 1, (i >> 1) & 1, i & 1)
            WANG[name][(i, vi)] = wang_tile(lo, up, *bits, vi)

def save_sheets():
    s = Image.new('RGBA', (T * NV, T * 6))
    for i in range(NV):
        for row, L in enumerate((GRASS, DIRT, SNOW, SAND_T, WATER_T, PAVE_T)): s.paste(L[i], (i * T, row * T))
    s.save(os.path.join(OUT, 'zemin-cesitler.png'))
    for name in PAIRS:
        w = Image.new('RGBA', (T * 4 * NVAR, T * 4))
        for vi in range(NVAR):
            for i in range(16): w.paste(WANG[name][(i, vi)], ((vi * 4 + i % 4) * T, (i // 4) * T))
        w.save(os.path.join(OUT, name + '-gecis-16.png'))

def render_map(pair, vertices, wt, ht, seed=5):
    """vertices(vx, vy) -> 0/1 (1 = lower), köşe ızgarası (wt+1)x(ht+1)."""
    lo, up = PAIRS[pair]
    r = random.Random(seed)
    im = Image.new('RGBA', (wt * T, ht * T))
    for ty in range(ht):
        for tx in range(wt):
            b = (vertices(tx, ty), vertices(tx + 1, ty), vertices(tx, ty + 1), vertices(tx + 1, ty + 1))
            idx = wang_index(*b)
            if idx == 0: tile = MAT[up]['tiles'][r.choice((0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 6, 7))]
            elif idx == 15: tile = MAT[lo]['tiles'][r.choice((0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 4, 6))]
            else: tile = WANG[pair][(idx, r.randrange(NVAR))]
            im.paste(tile, (tx * T, ty * T))
    return im

def blob(cx, cy, rx, ry, seed):
    """Düzensiz leke: köşe ızgarasında 1/0. Gerçek haritada kenar böyle kıvrıla kıvrıla gider."""
    r = random.Random(seed); ph = [r.random() * 6.283 for _ in range(3)]
    def f(x, y):
        a = math.atan2((y - cy) / ry, (x - cx) / rx); d = math.hypot((x - cx) / rx, (y - cy) / ry)
        return 1 if d < 1 + 0.28 * math.sin(3 * a + ph[0]) + 0.18 * math.sin(5 * a + ph[1]) + 0.1 * math.sin(2 * a + ph[2]) else 0
    return f

def preview():
    H_ = 11
    def road(x, y):
        if 8 <= x <= 10 and y <= 7: return 1
        if 2 <= x <= 17 and 7 <= y <= 11: return 1
        return 0
    a = render_map('cimen-toprak', road, 12, H_)
    b = render_map('kar-cimen', lambda x, y: 1 - blob(4, 5.5, 2.9, 3.6, 3)(x, y), 8, H_, 9)      # 1 = çimen
    c = render_map('kar-toprak', blob(4, 5.5, 2.4, 3.5, 5), 8, H_, 11)                            # 1 = toprak yamağı
    sc = Image.new('RGBA', (28 * T, H_ * T))
    sc.paste(a, (0, 0)); sc.paste(b, (12 * T, 0)); sc.paste(c, (20 * T, 0))
    sc.save(os.path.join(OUT, 'zemin-sahne-1x.png'))
    sc.resize((sc.width * 2, sc.height * 2), Image.NEAREST).save(os.path.join(OUT, 'zemin-sahne-2x.png'))

if __name__ == '__main__':
    save_sheets()
    preview()
    print('ok')
