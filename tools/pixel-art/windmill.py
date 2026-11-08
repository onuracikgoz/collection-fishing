"""3/4 açılı pixel art yel değirmeni (deneme, docs/tasarim/15-gorsel-stil.md).
Çalıştır: python3 tools/pixel-art/windmill.py  ->  client/Assets/Art/Custom/Windmill/
Değirmen basit 3D şekillerden (kesik koni kule, koni çatı, düz kanatlar) oluşur;
her yüzey noktası 3/4 açıdan piksele yansıtılır, ışık yüzey normaline göre
palet tonlarına yuvarlanır. Kule sabit bir görsel, kanatlar ayrı dönüş kareleri.
"""
import math, os
from PIL import Image

SC = float(os.environ.get('SC', '2.4'))   # 1 dünya birimi = SC piksel (2.4: 32px tile, LPC karakter ölçeği)
W, H = int(round(64 * SC)), int(round(76 * SC))
OX, OY = W / 2, 66 * SC          # dünya (0,0,0) noktasının ekrandaki yeri
PITCH = math.radians(32)        # kamera yukarıdan bakış açısı
CP, SP = math.cos(PITCH), math.sin(PITCH)
L = (-0.55, 0.55, 0.63)         # ışık: sol üst ön
ln = math.sqrt(sum(c * c for c in L)); L = tuple(c / ln for c in L)

def hx(s): s = s.lstrip('#'); return tuple(int(s[i:i+2], 16) for i in (0, 2, 4)) + (255,)
WOOD = [hx(c) for c in ('#4f2c1b', '#6f3f24', '#93592f', '#b9783f', '#d99b58', '#efc07a')]
ROOF = [hx(c) for c in ('#4e1b15', '#7a2c20', '#a43f2a', '#c95736', '#e5774a', '#f59a68')]
STONE = [hx(c) for c in ('#4d4946', '#6d6862', '#8f887e', '#b1a898', '#d3c9b6')]
FRAME = [hx(c) for c in ('#563219', '#7a4a26', '#a06736', '#c48c4c')]
CLOTH = [hx(c) for c in ('#c09a62', '#dcbd84', '#efd9a6', '#fbf0cf')]
LINE = hx('#2e1a10'); DARK = hx('#1f120b'); GLOW = hx('#f6cf6e'); GLASS = hx('#3c2416')

def project(X, Y, Z):
    sx = OX + X * SC
    sy = OY - (Y * CP - Z * SP) * SC
    depth = Z * CP + Y * SP
    return sx, sy, depth

def light(n):
    l = n[0] * L[0] + n[1] * L[1] + n[2] * L[2]
    return l

def tone(ramp, l, bias=0):
    # l: -1..1 -> ramp index, hafif ambient
    k = (l + 0.55) / 1.55
    i = int(round(k * (len(ramp) - 2))) + bias
    if l > 0.9 and bias == 0: i += 1
    return ramp[max(0, min(len(ramp) - 1, i))]

class Canvas:
    def __init__(self):
        self.c = {}  # (x,y) -> (depth, color)
    def put(self, X, Y, Z, col):
        sx, sy, d = project(X, Y, Z)
        p = (int(math.floor(sx)), int(math.floor(sy)))
        if not (0 <= p[0] < W and 0 <= p[1] < H): return
        old = self.c.get(p)
        if old is None or d > old[0]: self.c[p] = (d, col)
    def image(self):
        im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); px = im.load()
        for (x, y), (_, col) in self.c.items(): px[x, y] = col
        return im

def outline(img, col=LINE):
    src = img.load(); o = img.copy(); d = o.load()
    for y in range(H):
        for x in range(W):
            if src[x, y][3]: continue
            for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                nx, ny = x+dx, y+dy
                if 0 <= nx < W and 0 <= ny < H and src[nx, ny][3] == 255:
                    d[x, y] = col; break
    return o

# ---------------- kule + çatı ----------------
TH = 42                  # kule yüksekliği
def radius(h):
    r = 14.5 - 4.5 * (h / TH)
    if h < 7: r += (7 - h) * 0.32          # alt etek
    return r
HUB = (0.0, 37.0)        # göbek yüksekliği

def tower_color(h, th, n):
    l = light(n)
    deg = math.degrees(th)            # 0 = tam karşı, - sol, + sağ
    arc = th * radius(h)              # yüzey üzerinde yatay mesafe
    # kapı (karşıda, altta)
    if abs(arc) <= 4.6 and h <= 10.5:
        if abs(arc) > 3.2 or h > 9.2:
            return tone(STONE, l, 1)
        return DARK if arc < 1.2 else GLASS
    # pencere (sol önde)
    if -11.5 <= arc <= -6.5 and 21 <= h <= 28:
        if arc < -10.5 or arc > -7.5 or h < 22 or h > 27:
            return tone(WOOD, l, -1)
        return GLOW if (h > 24.5 and arc < -9) else GLASS
    # taş temel ve kuşak
    if h < 4.5 or 15 <= h < 17.2:
        c = tone(STONE, l)
        row = int(h // 1.6)
        if (int((arc + row * 2.3) // 3.2)) % 2 == 0 and h < 4.5: c = tone(STONE, l, -1)
        if h < 0.9 or abs(h - 15) < 0.6: c = tone(STONE, l, -1)
        return c
    # yatay tahtalar
    seam = (h % 2.4) < 0.5
    joint = abs(((arc + (int(h // 2.4) % 2) * 3.5) % 7.0) - 3.5) < 0.3
    c = tone(WOOD, l, -2 if seam else (-1 if joint else 0))
    return c

ROOF_R0, ROOF_H0, ROOF_H1 = radius(TH) + 3.2, TH - 1.0, TH + 21

def roof_r(h):
    k = (h - ROOF_H0) / (ROOF_H1 - ROOF_H0)
    return ROOF_R0 * (1 - k) ** 1.08

def roof_color(h, t, n):
    l = light(n)
    k = (h - ROOF_H0) / (ROOF_H1 - ROOF_H0)
    bias = 0
    if (h - ROOF_H0) % 2.6 < 0.55: bias = -1                 # kiremit sırası
    if abs(((t * 6 / math.pi) % 1.0) - 0.5) > 0.42 and k > 0.15 and k < 0.9: bias = -1
    if h - ROOF_H0 < 1.0: bias = -2                         # saçak altı
    return tone(ROOF, l, bias)

def hit(sx, sy):
    """Pikselden sahneye ışın gönder, ilk çarpılan yüzeyin rengini dön."""
    X = (sx + 0.5 - OX) / SC
    q = (OY - (sy + 0.5)) / SC
    d = 40.0
    while d > -40.0:
        Y = q * CP + d * SP
        Z = -q * SP + d * CP
        rr = math.hypot(X, Z)
        t = math.atan2(X, Z)
        # tepe direği
        if ROOF_H1 - 2 <= Y <= ROOF_H1 + 4 and rr < 0.8:
            return GLOW if Y > ROOF_H1 + 2.6 else WOOD[2]
        if ROOF_H0 <= Y <= ROOF_H1 and rr <= roof_r(Y):
            n = (math.sin(t), ROOF_R0 / (ROOF_H1 - ROOF_H0), math.cos(t))
            nl = math.sqrt(sum(c * c for c in n))
            return roof_color(Y, t, tuple(c / nl for c in n))
        if 0 <= Y <= TH and rr <= radius(Y):
            dr = -(radius(Y + 0.1) - radius(Y)) / 0.1
            n = (math.sin(t), dr, math.cos(t)); nl = math.sqrt(sum(c * c for c in n))
            return tower_color(Y, t, tuple(c / nl for c in n))
        # göbek mili
        zb = radius(HUB[1])
        if zb - 1 <= Z <= zb + 3.4 and math.hypot(X, Y - HUB[1]) <= 1.6:
            return WOOD[1]
        d -= 0.05
    return None

def draw_tower():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); px = im.load()
    for sy in range(H):
        for sx in range(W):
            c = hit(sx, sy)
            if c: px[sx, sy] = c
    return im

# ---------------- kanatlar ----------------
SAIL_Z = radius(HUB[1]) + 3.6
R_IN, R_OUT, HALF = 4.5, 26.0, 7.0

def sail_color(u, v):
    if abs(v) < 0.6 and -2 <= u <= R_OUT:                         # ana direk
        return FRAME[2] if v < 0 else FRAME[1]
    if v < 0 or u < R_IN or u > R_OUT or v > HALF: return None
    if v > HALF - 0.65 or u > R_OUT - 0.65 or u < R_IN + 0.65:
        return FRAME[2] if v > HALF - 0.65 else FRAME[1]
    if (u - R_IN) % 5.5 < 0.6 or abs(v - 3.6) < 0.3:
        return FRAME[1]                                   # çapraz çıta
    return CLOTH[3] if (u - R_IN) % 5.5 < 2.2 and v < 4.2 else CLOTH[2] if v < 4.8 else CLOTH[1]

def draw_sails(angle):
    """Her ekran pikseli kanat düzlemine geri çevrilir (temiz kenar, aliasing yok)."""
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); px = im.load()
    for sy in range(H):
        for sx in range(W):
            X = (sx + 0.5 - OX) / SC
            Y = ((OY - (sy + 0.5)) / SC + SAIL_Z * SP) / CP
            dx, dy = X, Y - HUB[1]
            r = math.hypot(dx, dy)
            if r < 2.4:
                c = WOOD[4] if (dx < 0 and dy > 0 and r < 1.5) else WOOD[2] if r < 1.6 else WOOD[1]
                px[sx, sy] = c; continue
            for b in range(4):
                a = angle + b * math.pi / 2
                u = dx * math.cos(a) + dy * math.sin(a)
                v = -dx * math.sin(a) + dy * math.cos(a)
                c = sail_color(u, v)
                if c: px[sx, sy] = c; break
    return im

def shadow():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); p = im.load()
    for y in range(H):
        for x in range(W):
            dx, dy = (x + 0.5 - OX - 3 * SC) / (21 * SC), (y + 0.5 - OY - SC) / (9 * SC)
            if dx * dx + dy * dy <= 1: p[x, y] = (30, 40, 10, 80)
    return im

def build(out_dir, frames=6):
    """Oyuna giden iki dosya: kule (gölgesi içinde) ve kanat sprite sheet'i (yan yana kareler)."""
    os.makedirs(out_dir, exist_ok=True)
    tower = shadow(); tower.alpha_composite(outline(draw_tower()))
    tower.save(os.path.join(out_dir, 'windmill_tower.png'))
    sheet = Image.new('RGBA', (W * frames, H), (0, 0, 0, 0))
    for i in range(frames):
        ang = math.radians(20) - i * (math.pi / 2) / frames    # saat yönünde, 4 kanat simetrik: 90° bir tur
        sheet.paste(outline(draw_sails(ang)), (i * W, 0))
    sheet.save(os.path.join(out_dir, 'windmill_sails.png'))
    # Unity'deki pivot: kulenin taban merkezi (MapView.BuildWindmill bu sayıları kullanır)
    print(f'size {W}x{H}, frames {frames}, pivot x={OX / W:.4f} y={(H - OY) / H:.4f}')

if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    build(os.path.join(root, 'client', 'Assets', 'Art', 'Custom', 'Windmill'))
