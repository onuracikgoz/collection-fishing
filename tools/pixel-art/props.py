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
    """Kalın koyu kahve dış kontur (mobilya kuralı), yumuşatma yok."""
    c.outline()
    for y in range(c.h):
        for x in range(c.w):
            if c.px[x, y] == (46, 30, 24, 255): c.px[x, y] = hx('#3a2418')
    return c.im

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

# --- Mobilya: "önden-üst" bakış (top-down oblique). Kural: üst yüz açık, ön yüz koyu, aralarında koyu çizgi,
#     her şeyin etrafında kalın koyu kahve kontur, perspektif daralması yok, 2-3 ton. ---
LINE = hx('#3a2418')
FW = [hx(c) for c in ('#5c3a22', '#7a4e2c', '#9a6638', '#b9804a', '#d29d62')]   # 0 koyu ön .. 4 parlak kenar

def rect(c, x0, y0, x1, y1, col):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): c.put(x, y, col)

def box(c, x0, y0, x1, y1, col, line=True):
    rect(c, x0, y0, x1, y1, col)
    if line:
        for x in range(x0, x1 + 1): c.put(x, y0, LINE); c.put(x, y1, LINE)
        for y in range(y0, y1 + 1): c.put(x0, y, LINE); c.put(x1, y, LINE)

def ground_shadow(W, H, cx, cy, rx, ry):
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sp = sh.load()
    for y in range(H):
        for x in range(W):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: sp[x, y] = (20, 40, 15, 70)
    return sh

def bench():
    """Bank: arkalık (ön yüz), oturak üst yüzü (açık), oturak ön yüzü (koyu), dört ayak. 48x34."""
    W, H = 48, 34; c = Canvas(W, H)
    # arkalık: iki tahta, ön yüzü görünür; üst kenarında açık şerit
    box(c, 3, 2, 44, 7, FW[2]); rect(c, 4, 3, 43, 3, FW[4])
    box(c, 3, 7, 44, 12, FW[2]); rect(c, 4, 8, 43, 8, FW[3])
    for x in (6, 41):                                                 # arkalık dikmeleri oturağa iner
        box(c, x - 1, 12, x + 1, 15, FW[1])
    # oturak üst yüzü (açık), tahta derzleri
    box(c, 1, 15, 46, 23, FW[3])
    rect(c, 2, 16, 45, 16, FW[4])
    for y in (18, 21):
        for x in range(2, 46): c.put(x, y, FW[2])
    # oturak ön yüzü (koyu)
    box(c, 1, 23, 46, 26, FW[1])
    # ayaklar: ön yüz koyu, iç kenar daha koyu
    for x0 in (3, 40):
        box(c, x0, 26, x0 + 4, 31, FW[1]); rect(c, x0 + 1, 27, x0 + 1, 30, FW[2])
    for (x, y) in ((6, 19), (24, 19), (41, 19), (6, 22), (24, 22), (41, 22)): c.put(x, y, FW[1])   # çivi
    sh = ground_shadow(W, H, 24, 30, 23, 4); sh.alpha_composite(c.im); return sh

def ellipse_line(c, cx, cy, rx, ry):
    """Elipsin dış kenarına kalın kontur (içerden)."""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if d <= 1:
                n = [((x + dx + .5 - cx) / rx) ** 2 + ((y + dy + .5 - cy) / ry) ** 2 > 1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                if any(n): c.put(x, y, LINE)

def round_top(c, cx, cy, rx, ry, thick, planks=True):
    for off in range(thick, 0, -1): c.ellipse(cx, cy + off, rx, ry, lambda x, y: FW[1])   # ön kalınlık (koyu)
    ellipse_line(c, cx, cy + thick, rx, ry)
    c.ellipse(cx, cy, rx, ry, lambda x, y: FW[3])
    c.ellipse(cx - rx * .15, cy - ry * .25, rx * .7, ry * .45, lambda x, y: FW[4] if planks is None else FW[3])
    if planks:
        for k in range(-int(rx) + 4, int(rx) - 2, 5):
            for y in range(int(cy - ry), int(cy + ry) + 1):
                x = int(cx + k)
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 < .85: c.put(x, y, FW[2])
        for x in range(int(cx - rx * .6), int(cx + rx * .2)): c.put(x, int(cy - ry * .6), FW[4])   # parlak kenar
    ellipse_line(c, cx, cy, rx, ry)

def table_set():
    """Yuvarlak masa (tek ayak, çapraz taban) + iki tabure. 64x40."""
    W, H = 64, 40; c = Canvas(W, H); cx = 32
    box(c, cx - 2, 16, cx + 2, 31, FW[1]); rect(c, cx - 1, 17, cx - 1, 30, FW[2])          # ayak
    box(c, cx - 8, 31, cx + 8, 34, FW[1]); rect(c, cx - 7, 32, cx + 7, 32, FW[2])            # taban
    round_top(c, cx, 12, 17, 8, 3)
    c.ellipse(cx + 4, 10, 2.5, 1.5, lambda x, y: CREAM); c.put(cx + 4, 10, hx('#7a4a26')) # fincan
    for sx in (8, 56):                                                                     # tabureler
        for lx in (sx - 4, sx + 3):
            box(c, lx, 29, lx + 1, 35, FW[1])
        round_top(c, sx, 26, 6, 3.2, 2, planks=False)
    sh = ground_shadow(W, H, 32, 34, 30, 5); sh.alpha_composite(c.im); return sh

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
