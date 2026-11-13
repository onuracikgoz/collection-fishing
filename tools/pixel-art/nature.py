"""Doğa seti (önden-üst bakış, kalın koyu kontur): yuvarlak ağaç, meyve ağacı, çam, çalı, kaya, kütük, çiçek öbekleri.
Çalıştır: python3 tools/pixel-art/nature.py -> client/Assets/Art/Custom/Nature/
Kural (15-gorsel-stil.md, Mobilya bakışı): üst açık, alt/ön koyu, kalın #3a2418 kontur, yüzey başına 2-4 ton.
"""
import math, os, random, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fountain_pier import Canvas, hx
from soften import soften

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'client', 'Assets', 'Art', 'Custom', 'Nature')
LINE = hx('#3a2418')
LEAF = [hx(c) for c in ('#2c4a32', '#3a5e3c', '#4a7248', '#5c8650', '#71985e', '#88aa6e')]   # yumuşak, az doygun
PINE = [hx(c) for c in ('#26403a', '#2f5244', '#3b644e', '#4b7658', '#628a68')]
BARK = [hx(c) for c in ('#3e2a20', '#5a3e2c', '#745238', '#8c6646')]
ROCK = [hx(c) for c in ('#4e4644', '#665d58', '#7e746c', '#958a7f', '#ab9f91')]
RED, ORANGE, PINK, YEL, CREAM, LILAC = hx('#b8524a'), hx('#d08a4a'), hx('#d895a6'), hx('#dcbc5c'), hx('#e8e0c8'), hx('#a79bcf')

def shadow(c, cx, cy, rx, ry):
    """Gölgeyi sonraya sakla: kontur gölgenin etrafına çizilmesin."""
    c.shadow = (cx, cy, rx, ry)

def finish(c, outline=True):
    if outline:
        # renkli kontur: dış hat, komşu yüzeyin koyusu (siyah değil); sert köşeler ara tonla yumuşar
        c.outline()
        c.im = soften(c.im, outline_dark=(40, 30, 26), inner=False); c.px = c.im.load()
    sh = Image.new('RGBA', c.im.size, (0, 0, 0, 0))
    if getattr(c, 'shadow', None):
        cx, cy, rx, ry = c.shadow; sp = sh.load()
        for y in range(c.h):
            for x in range(c.w):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: sp[x, y] = (20, 40, 15, 75)
    sh.alpha_composite(c.im); return sh

def blob_canopy(c, cx, cy, r, seed, pal=LEAF, lobes=7):
    """Topak topak yaprak kümesi: her küme üstten açık, alttan koyu; kümeler arasında koyu çizgi."""
    rng = random.Random(seed)
    balls = [(cx, cy, r * .62)]
    for i in range(lobes):
        a = 2 * math.pi * i / lobes + rng.uniform(-.25, .25)
        balls.append((cx + r * .55 * math.cos(a), cy + r * .42 * math.sin(a), r * rng.uniform(.38, .48)))
    balls.sort(key=lambda b: b[1])                       # arkadan öne
    for (bx, by, br) in balls:
        def col(x, y, bx=bx, by=by, br=br):
            dy = (y + .5 - by) / br; dx = (x + .5 - bx) / br
            if dy > .45 or dx > .55: return pal[1]
            if dy > .05: return pal[2]
            if dy < -.45 and dx < .1: return pal[4]
            return pal[3]
        # küme sınırı koyu çizgi (önce koyu daire, sonra 1 px içten dolgu)
        c.ellipse(bx, by, br, br * .9, lambda x, y: pal[0])
        c.ellipse(bx, by, br - 1, br * .9 - 1, col)
    for _ in range(int(r * 1.2)):                         # yaprak benekleri
        x = int(cx + rng.uniform(-r * .8, r * .8)); y = int(cy + rng.uniform(-r * .7, r * .2))
        if c.px[x, y][3] and c.px[x, y] != pal[0]: c.put(x, y, pal[4] if y < cy else pal[2])

def trunk(c, cx, y0, y1, w):
    for y in range(y0, y1):
        for x in range(cx - w, cx + w + 1):
            t = (x - cx) / w
            c.put(x, y, BARK[3] if t < -.4 else BARK[1] if t > .3 else BARK[2])
    for x in range(cx - w - 1, cx + w + 2): c.put(x, y1 - 1, BARK[1])           # kök kabarması
    c.put(cx - w - 2, y1 - 1, BARK[1]); c.put(cx + w + 2, y1 - 1, BARK[0])

TREE_PALS = {
    'green':  [hx(c) for c in ('#1f3d2b', '#2c5634', '#3d7038', '#548a3c', '#73a547', '#9cc25a')],
    'dark':   [hx(c) for c in ('#173326', '#20473a', '#2b5f45', '#3b7a50', '#56945c', '#7cb06c')],
    'autumn': [hx(c) for c in ('#4a1f1c', '#7a2e22', '#a8462a', '#c96a32', '#e0923f', '#efb760')],
    'pink':   [hx(c) for c in ('#4f2a3a', '#7c4558', '#a8606e', '#c98284', '#dfa39a', '#efc7b4')],
}

def _h(x, y, s): return ((x * 374761393 + y * 668265263 + s * 2147483647) & 0xffffffff) / 0xffffffff

def leafy_canopy(c, cx, cy, rx, ry, pal, seed, blobs=6):
    """Tırtıklı kenarlı yaprak kütlesi: alt kümelerden oluşur, üstten aydınlanır, yaprak kümesi dokusu taşır."""
    rng = random.Random(seed)
    B = [(cx, cy, rx * .62, ry * .62)]
    for i in range(blobs):
        a = 2 * math.pi * i / blobs + rng.uniform(-.3, .3)
        B.append((cx + rx * .48 * math.cos(a), cy + ry * .42 * math.sin(a) - ry * .05, rx * rng.uniform(.42, .52), ry * rng.uniform(.42, .52)))
    best = {}
    for y in range(int(cy - ry) - 3, int(cy + ry) + 4):
        for x in range(int(cx - rx) - 3, int(cx + rx) + 4):
            f, bb = -9, None
            for (bx, by, brx, bry) in B:
                d = 1 - math.hypot((x + .5 - bx) / brx, (y + .5 - by) / bry)
                if d > f: f, bb = d, (bx, by, brx, bry)
            jag = (_h(x // 2, y // 2, seed) - .5) * .22 + (_h(x, y, seed + 1) - .5) * .1
            if f + jag > 0: best[(x, y)] = (f, bb)
    for (x, y), (f, (bx, by, brx, bry)) in best.items():
        nx, ny = (x + .5 - bx) / brx, (y + .5 - by) / bry
        gy = (y - (cy - ry)) / (2 * ry)                                     # 0 üst .. 1 alt
        l = -.75 * ny - .35 * nx + .5 * f - .9 * (gy - .45)
        l += (_h(x // 2, y // 2, seed + 7) - .5) * .18                      # doku: 2x2 kümeler halinde
        tone = 1 if l < -.55 else 2 if l < -.05 else 3 if l < .45 else 4
        c.put(x, y, pal[tone])
    # yaprak kümeleri (küçük ^ biçimli yapraklar): açık yerde daha açık, koyu yerde daha koyu
    pts = list(best.keys()); rng.shuffle(pts)
    for (x, y) in pts[: len(pts) // 22]:
        if best[(x, y)][0] < .1: continue
        col0 = c.px[x, y]; t = pal.index(col0) if col0 in pal else 2
        up = pal[min(5, t + 1)] if t >= 3 or rng.random() < .55 else pal[max(1, t - 1)]
        for dx, dy in ((0, 0), (-1, 1), (1, 1), (-2, 2), (2, 2), (0, 1)):       # yaprak: ^ biçimi, 5 px geniş
            if (x + dx, y + dy) in best: c.put(x + dx, y + dy, up)
        if (x, y + 2) in best: c.put(x, y + 2, pal[max(1, t - 1)])
    for _ in range(2):                                                      # tek başına kalan uç pikselleri temizle
        for p in [p for p in best if sum((p[0] + dx, p[1] + dy) in best for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) < 2]:
            best.pop(p); c.put(p[0], p[1], (0, 0, 0, 0))
    # koyu yeşil kontur ve alt kenar gölgesi
    for (x, y) in best:
        if any((x + dx, y + dy) not in best for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): c.put(x, y, pal[0])
        elif (x, y + 2) not in best: c.put(x, y, pal[1])
    return best

def roots_trunk(c, cx, y0, y1, w=4):
    """Kısa gövde ve yere yayılan kökler (örnekteki gibi)."""
    for y in range(y0, y1):
        for x in range(cx - w, cx + w + 1):
            t = (x - cx) / w
            c.put(x, y, BARK[3] if t < -.35 else BARK[1] if t > .35 else BARK[2])
    for side, length, dy in ((-1, 10, 0), (1, 10, 0), (-1, 6, -3), (1, 7, -2), (0, 0, 0)):
        for k in range(length):
            x = cx + side * (w - 1 + k); y = y1 - 2 + (k * 2 // 5) + dy
            c.put(x, y - 1, BARK[2] if side < 0 else BARK[1]); c.put(x, y, BARK[1]); c.put(x, y + 1, BARK[0])
    for x in range(cx - w, cx + w + 1): c.put(x, y1, BARK[1]); c.put(x, y1 + 1, BARK[0])
    for y in range(y0, y1):                                                  # gövde konturu
        c.put(cx - w - 1, y, BARK[0]); c.put(cx + w + 1, y, BARK[0])

def round_tree(seed=1, fruit=None, pal='green'):
    W, H = 72, 80; c = Canvas(W, H); cx = 36
    shadow(c, cx + 2, 70, 22, 6)
    roots_trunk(c, cx, 50, 67)
    leafy_canopy(c, cx, 33, 30, 27, TREE_PALS[pal], seed)
    if fruit:
        rng = random.Random(seed + 9)
        for _ in range(10):
            x = int(cx + rng.uniform(-22, 22)); y = int(33 + rng.uniform(-18, 16))
            if c.px[x, y][3] and c.px[x, y] != TREE_PALS[pal][0]:
                for dx, dy, col in ((0, -1, fruit), (-1, 0, fruit), (0, 0, CREAM), (1, 0, fruit), (0, 1, BARK[1])): c.put(x + dx, y + dy, col)
    return finish(c, outline=False)

def pine(seed=11):
    """Çam: alttan üste daralan, kenarları iğne iğne sarkan katlar; koyu yeşil kontur, kökler. Yeni ağaç tarzında."""
    W, H = 56, 88; c = Canvas(W, H); cx = 28
    pal = [hx(x) for x in ('#16302a', '#1f4637', '#2a5c42', '#387350', '#4f8c5c', '#6fa66c')]
    shadow(c, cx + 2, 80, 16, 5)
    roots_trunk(c, cx, 66, 78, 3)
    inside = {}
    tiers = ((68, 23), (54, 19), (41, 15), (29, 11), (18, 7))                 # (alt kenar y, yarı genişlik)
    for i, (yb, hw) in enumerate(tiers):
        top = yb - 22 if i < len(tiers) - 1 else 4
        for y in range(top, yb + 1):
            t = (y - top) / max(1, yb - top)
            half = hw * t ** .85
            for x in range(int(cx - half) - 1, int(cx + half) + 2):
                d = abs(x + .5 - cx)
                edge = yb - int(_h(x // 3, i, seed) * 4) - int(3 * (d / max(1, hw)) ** 2)   # sarkan iğne uçları (düzensiz)
                if d <= half and y <= edge: inside[(x, y)] = (i, t, (x + .5 - cx) / max(1, hw))
    for (x, y), (i, t, sx) in inside.items():
        l = -.9 * sx + .6 * (1 - t) - .25 + (_h(x // 2, y, seed) - .5) * .35
        tone = 1 if l < -.6 else 2 if l < -.1 else 3 if l < .35 else 4
        if (x, y + 1) not in inside or (x, y + 2) not in inside: tone = min(tone, 2)
        c.put(x, y, pal[tone])
    rng = random.Random(seed)
    for (x, y) in rng.sample(list(inside), len(inside) // 14):                # iğne çizgileri (aşağı eğik)
        i, t, sx = inside[(x, y)]
        col = pal[4] if sx < .1 else pal[1]
        for k in range(3):
            p = (x + (k if sx > 0 else -k) // 2, y + k)
            if p in inside: c.put(p[0], p[1], col)
    for (x, y) in inside:
        if any((x + dx, y + dy) not in inside for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): c.put(x, y, pal[0])
    return finish(c, outline=False)

def bush(seed=3, flowers=None):
    W, H = 40, 32; c = Canvas(W, H); cx = 20
    shadow(c, cx + 1, 28, 19, 3.5)                                   # gölge çalının dibinden başlar
    best = leafy_canopy(c, cx, 18, 16, 11, TREE_PALS['green'], seed, blobs=5)
    pal = TREE_PALS['green']
    # dip: alt kenar yere değer (yarım elips taban), alt sıralar koyu; gölge yanlardan taşar
    for x in range(cx - 15, cx + 16):
        lim = 26 + int(2.5 * math.sqrt(max(0, 1 - ((x - cx) / 15) ** 2)))
        ys = [p[1] for p in best if p[0] == x]
        if not ys: continue
        for y in range(max(ys), lim + 1): c.put(x, y, pal[1])
        c.put(x, lim, pal[0])
    if flowers:
        rng = random.Random(seed)
        for _ in range(7):
            x = int(cx + rng.uniform(-10, 10)); y = int(15 + rng.uniform(-8, 3))
            if c.px[x, y][3] and c.px[x, y] != TREE_PALS['green'][0]:
                col = rng.choice(flowers)
                for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)): c.put(x + dx, y + dy, col)
                c.put(x, y, YEL if col != YEL else CREAM)
    return finish(c, outline=False)

def rock(big=True):
    W, H = (40, 30) if big else (22, 18); c = Canvas(W, H); cx = W // 2
    rx, ry = (17, 10) if big else (9, 6); cy = H - ry - 4
    shadow(c, cx + 1, H - 4, rx + 1, 3)
    c.ellipse(cx, cy + 3, rx, ry, lambda x, y: ROCK[1])                            # ön yüz (koyu)
    c.ellipse(cx, cy, rx, ry - 1, lambda x, y: ROCK[3] if x < cx + rx * .3 else ROCK[2])   # üst yüz (açık)
    c.ellipse(cx - rx * .3, cy - ry * .35, rx * .35, ry * .3, lambda x, y: ROCK[4])
    for y in range(int(cy), int(cy + ry + 3)):                                      # üst/ön sınırı
        for x in range(cx - rx, cx + rx + 1):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / (ry - 1)) ** 2 <= 1 < ((x + .5 - cx) / rx) ** 2 + ((y + 1.5 - cy) / (ry - 1)) ** 2:
                c.put(x, y + 1, ROCK[0])
    if big:
        for k in range(5): c.put(cx + 3 + k // 2, int(cy - 2 + k), ROCK[1])            # çatlak
        for x in range(cx - rx + 2, cx - rx + 8): c.put(x, int(cy + ry + 1), LEAF[3])  # yosun
    return finish(c)

def stump():
    W, H = 30, 26; c = Canvas(W, H); cx = 15
    shadow(c, cx + 1, 22, 13, 3)
    for y in range(9, 22):
        for x in range(cx - 9, cx + 10):
            t = (x - cx) / 9
            c.put(x, y, BARK[3] if t < -.4 else BARK[1] if t > .4 else BARK[2])
    for x in (cx - 11, cx - 10, cx + 10, cx + 11): c.put(x, 21, BARK[1])
    c.ellipse(cx, 9, 9, 4, lambda x, y: hx('#c9965a'))                              # kesik yüz
    c.ellipse(cx, 9, 5.5, 2.4, lambda x, y: hx('#b07c46'))
    c.ellipse(cx, 9, 2.5, 1.1, lambda x, y: hx('#c9965a'))
    for x in range(cx - 9, cx + 10): c.put(x, 13, LINE) if ((x + .5 - cx) / 9) ** 2 > .0 and False else None
    return finish(c)

def flower_patch(cols, seed):
    W, H = 32, 20; c = Canvas(W, H); rng = random.Random(seed)
    for _ in range(9):                                                              # yapraklar
        x, y = rng.randint(4, 27), rng.randint(8, 16)
        c.put(x, y, LEAF[3]); c.put(x - 1, y + 1, LEAF[2]); c.put(x + 1, y + 1, LEAF[2]); c.put(x, y + 1, LEAF[1])
    for _ in range(7):
        x, y = rng.randint(5, 26), rng.randint(4, 13); col = rng.choice(cols)
        c.put(x, y + 1, LEAF[2]); c.put(x, y + 2, LEAF[1])
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)): c.put(x + dx, y + dy, col)
        c.put(x, y, YEL if col != YEL else ORANGE)
    return finish(c, outline=False)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    items = {
        'tree_round': round_tree(1), 'tree_round_2': round_tree(5, pal='dark'), 'tree_apple': round_tree(2, hx('#c0453a')), 'tree_autumn': round_tree(4, pal='autumn'), 'tree_blossom': round_tree(6, pal='pink'),
        'pine': pine(), 'bush': bush(3), 'bush_flower': bush(6, (PINK, CREAM)), 'rock_big': rock(True), 'rock_small': rock(False),
        'stump': stump(), 'flowers_pink': flower_patch((PINK, CREAM), 1), 'flowers_yellow': flower_patch((YEL, CREAM), 2), 'flowers_lilac': flower_patch((LILAC, PINK), 3),
    }
    for k, im in items.items(): im.save(os.path.join(OUT, k + '.png'))
    import importlib.util
    spec = importlib.util.spec_from_file_location('g', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ground.py')); g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
    T = 32; Wt, Ht = 16, 9; sc = Image.new('RGBA', (Wt * T, Ht * T)); r = random.Random(5)
    for ty in range(Ht):
        for tx in range(Wt): sc.paste(g.GRASS[r.randrange(8)], (tx * T, ty * T))
    place = [('pine', 8, 10), ('tree_round', 60, 6), ('tree_apple', 140, 30), ('pine', 230, 0), ('tree_autumn', 300, 20), ('tree_round_2', 400, 4), ('tree_blossom', 170, 170),
             ('bush', 40, 100), ('bush_flower', 200, 110), ('rock_big', 300, 120), ('rock_small', 360, 140), ('stump', 110, 120), ('bush', 450, 110),
             ('flowers_pink', 30, 150), ('flowers_yellow', 150, 160), ('flowers_lilac', 250, 170), ('flowers_pink', 420, 170), ('rock_small', 470, 60)]
    for name, x, y in sorted(place, key=lambda p: p[2] + items[p[0]].height):
        sc.alpha_composite(items[name], (x, y))
    sc.resize((sc.width * 3, sc.height * 3), Image.NEAREST).save(os.path.join(OUT, 'doga-onizleme.png'))
    print('ok')
