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

def round_tree(seed=1, fruit=None):
    W, H = 64, 80; c = Canvas(W, H); cx = 32
    shadow(c, cx + 2, 74, 20, 5)
    trunk(c, cx, 44, 76, 4)
    blob_canopy(c, cx, 30, 26, seed)
    if fruit:
        rng = random.Random(seed + 9)
        for _ in range(9):
            x = int(cx + rng.uniform(-18, 18)); y = int(30 + rng.uniform(-14, 12))
            if c.px[x, y][3] and c.px[x, y] != LEAF[0]:
                c.put(x, y, fruit); c.put(x + 1, y, fruit); c.put(x, y + 1, fruit); c.put(x + 1, y + 1, BARK[1]); c.put(x, y - 1, CREAM)
    return finish(c)

def pine():
    W, H = 48, 84; c = Canvas(W, H); cx = 24
    shadow(c, cx + 2, 78, 14, 4)
    trunk(c, cx, 62, 80, 3)
    for i, (y, w) in enumerate(((52, 20), (40, 16), (28, 12), (16, 8))):         # katlar, alttan üste
        for yy in range(y - 12, y + 6):
            t = (yy - (y - 12)) / 18
            half = int(w * t + 1)
            for x in range(cx - half, cx + half + 1):
                s = (x - cx) / max(1, half)
                col = PINE[3] if s < -.25 else PINE[1] if s > .35 else PINE[2]
                if yy >= y + 4: col = PINE[0] if s > 0 else PINE[1]
                c.put(x, yy, col)
        for x in range(cx - w, cx + w + 1): c.put(x, y + 6, PINE[0])              # kat alt çizgisi
        for k in range(-w + 3, w - 2, 4): c.put(cx + k, y + 5, PINE[0])           # dişli kenar
    c.put(cx, 3, PINE[4]); c.put(cx, 4, PINE[3])
    return finish(c)

def bush(seed=3, flowers=None):
    W, H = 36, 28; c = Canvas(W, H); cx = 18
    shadow(c, cx + 1, 24, 15, 3.5)
    blob_canopy(c, cx, 15, 13, seed, lobes=5)
    if flowers:
        rng = random.Random(seed)
        for _ in range(7):
            x = int(cx + rng.uniform(-10, 10)); y = int(15 + rng.uniform(-8, 3))
            if c.px[x, y][3] and c.px[x, y] != LEAF[0]:
                col = rng.choice(flowers)
                for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)): c.put(x + dx, y + dy, col)
                c.put(x, y, YEL if col != YEL else CREAM)
    return finish(c)

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
        'tree_round': round_tree(1), 'tree_round_2': round_tree(5), 'tree_apple': round_tree(2, RED), 'tree_orange': round_tree(4, ORANGE),
        'pine': pine(), 'bush': bush(3), 'bush_flower': bush(6, (PINK, CREAM)), 'rock_big': rock(True), 'rock_small': rock(False),
        'stump': stump(), 'flowers_pink': flower_patch((PINK, CREAM), 1), 'flowers_yellow': flower_patch((YEL, CREAM), 2), 'flowers_lilac': flower_patch((LILAC, PINK), 3),
    }
    for k, im in items.items(): im.save(os.path.join(OUT, k + '.png'))
    import importlib.util
    spec = importlib.util.spec_from_file_location('g', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ground.py')); g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
    T = 32; Wt, Ht = 16, 9; sc = Image.new('RGBA', (Wt * T, Ht * T)); r = random.Random(5)
    for ty in range(Ht):
        for tx in range(Wt): sc.paste(g.GRASS[r.randrange(8)], (tx * T, ty * T))
    place = [('pine', 8, 10), ('tree_round', 60, 6), ('tree_apple', 140, 30), ('pine', 230, 0), ('tree_orange', 300, 20), ('tree_round_2', 400, 4),
             ('bush', 40, 100), ('bush_flower', 200, 110), ('rock_big', 300, 120), ('rock_small', 360, 140), ('stump', 110, 120), ('bush', 450, 110),
             ('flowers_pink', 30, 150), ('flowers_yellow', 150, 160), ('flowers_lilac', 250, 170), ('flowers_pink', 420, 170), ('rock_small', 470, 60)]
    for name, x, y in sorted(place, key=lambda p: p[2] + items[p[0]].height):
        sc.alpha_composite(items[name], (x, y))
    sc.resize((sc.width * 3, sc.height * 3), Image.NEAREST).save(os.path.join(OUT, 'doga-onizleme.png'))
    print('ok')
