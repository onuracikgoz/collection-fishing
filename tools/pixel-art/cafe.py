"""Kafe: önden-üst (oblique) bakış, yumuşak renkli kontur. Eski kafe2.py (yandan 3/4) üzerinden YAW=0, PITCH=26.
Yöntem aynı: bina basit 3D şekillerden kurulur, her piksel için ışın gönderilir.
Fark: her yüzey önce 'doku tonu' seçer (taş bloğu, sıva pütürü, kiremit, ahşap damarı),
sonra yüzün ışığa bakışı ve saçak / zemin gölgesi bu tonu kaydırır."""
import math, os
import numpy as np
from PIL import Image

import colorsys
from soften import soften
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'client', 'Assets', 'Art', 'Custom', 'Cafe')
os.makedirs(OUT, exist_ok=True)
PITCH = math.radians(float(os.environ.get('PITCH', '26'))); CP, SP = math.cos(PITCH), math.sin(PITCH)
YAW = math.radians(float(os.environ.get('YAW', '0')))
CY, SY = math.cos(YAW), math.sin(YAW)
L = np.array([-0.6, 0.6, 0.53]); L /= np.linalg.norm(L)

def hx(s): s = s.lstrip('#'); return tuple(int(s[i:i+2], 16) for i in (0, 2, 4)) + (255,)
R = lambda *c: [hx(x) for x in c]
STONE = R('#4a4038', '#62564a', '#7b6d5c', '#94846f', '#ab9a82', '#c2b197', '#d7c8ae')
PLAST = R('#7f6d56', '#9c876b', '#b7a07f', '#ccb692', '#dcc8a3', '#e9d8b6', '#f3e6c9')
WOOD = R('#2a180f', '#3e2416', '#55321f', '#6d4229', '#875334', '#9f6540', '#b77a4f')
ROOF = R('#36130f', '#521d16', '#70291d', '#8d3525', '#a8432d', '#c05437', '#d66a44', '#e5875a')
BRICK = R('#4a2219', '#662f22', '#82402d', '#9c5139', '#b4654a')
AWG = R('#24452f', '#2f5b3c', '#3f7a4f', '#55996a', '#6cb381')
AWW = R('#a69a80', '#c4b89c', '#ddd2b8', '#efe6d0', '#faf4e4')
GLASS = R('#2a2a33', '#3b3a40', '#d7953f', '#efb75a', '#f8d684', '#fff0c0')
LEAF = R('#203d1c', '#2c5426', '#3c6f31', '#4f8a3b', '#67a347', '#86bd5a')
POT = R('#5a2c1f', '#7a3c29', '#9a4f34', '#b86641', '#cf8257')
LINE = hx('#20120b')

def h(a, b, s=0):
    v = math.sin(a * 12.9898 + b * 78.233 + s * 37.719) * 43758.5453
    return v - math.floor(v)

def pick(ramp, i): return ramp[max(0, min(len(ramp) - 1, i))]

# ---------------- geometri (yerel koordinat: x sağ, y yukarı, z öne) ----------------
WX, WZ, WH = 120, 56, 100
RB, RH, RO = WH - 2, 64, 10
RZ = WZ + 12
def ys(Z): return RB + RH * (1 - np.abs(Z) / RZ)       # çatı yüzeyi yüksekliği
PRIMS = []
def add(name, f): PRIMS.append((name, f))
def box(name, x0, x1, y0, y1, z0, z1):
    add(name, lambda X, Y, Z: (X >= x0) & (X <= x1) & (Y >= y0) & (Y <= y1) & (Z >= z0) & (Z <= z1))
box('plinth', -WX - 4, WX + 4, 0, 10, -WZ - 4, WZ + 4)
box('wall', -WX, WX, 10, WH, -WZ, WZ)
add('gable', lambda X, Y, Z: (np.abs(X) <= WX) & (Y >= WH - 1) & (np.abs(Z) <= WZ) & (Y <= ys(Z) - 3))
add('roof', lambda X, Y, Z: (np.abs(X) <= WX + RO) & (np.abs(Z) <= RZ) & (Y <= ys(Z)) & (Y >= ys(Z) - 5))
box('chimney', 64, 84, RB + 14, RB + RH + 8, -20, 0)
DX0, DX1, DCX = -42, 6, -18
box('dormer', DX0 + 3, DX1 - 3, RB, RB + 30, -5, RZ - 5)
add('droof', lambda X, Y, Z: (Z >= -5) & (Z <= RZ - 2) & (Y >= RB + 29) & (Y <= RB + 47)
                             & (np.abs(X - DCX) <= 27 * (1 - (Y - RB - 29) / 18)))
box('step', 18, 54, 0, 5, WZ, WZ + 12)
AW = dict(x0=-108, x1=-12, z0=WZ, z1=WZ + 22, y0=80, y1=66)
def awning(X, Y, Z):
    t = (Z - AW['z0']) / (AW['z1'] - AW['z0'])
    return (X >= AW['x0']) & (X <= AW['x1']) & (t >= 0) & (t <= 1) & (np.abs(Y - (AW['y0'] + (AW['y1'] - AW['y0']) * t)) <= 1.4)
add('awning', awning)
box('sign', 10, 62, 74, 90, WZ, WZ + 5)
def cyl(name, cx, cz, r, y0, y1): add(name, lambda X, Y, Z: ((X - cx) ** 2 + (Z - cz) ** 2 <= r * r) & (Y >= y0) & (Y <= y1))
def sph(name, cx, cy, cz, r): add(name, lambda X, Y, Z: (X - cx) ** 2 + (Y - cy) ** 2 + (Z - cz) ** 2 <= r * r)
TX, TZ = -60, WZ + 40
cyl('tabletop', TX, TZ, 14, 23, 26); cyl('tableleg', TX, TZ, 2.2, 0, 23)
for sx_ in (TX - 25, TX + 25): cyl('stool', sx_, TZ + 2, 7, 13, 16); cyl('stoolleg', sx_, TZ + 2, 1.8, 0, 13)
cyl('cup', TX - 3, TZ - 2, 2.6, 26, 31)
POTS = (6, 66)
for px_ in POTS: cyl('pot', px_, WZ + 9, 7.5, 0, 12); sph('bush', px_, 21, WZ + 9, 11)
# yan duvara yaslı bir fıçı ve odun yığını (sahneyi canlandırır)
cyl('barrel', -WX - 14, 20, 10, 0, 26)
NAMES = [p[0] for p in PRIMS]

# ---------------- ışın ----------------
W, H = 340, 340
OX, OY = W / 2, 240
sx, sy = np.meshgrid(np.arange(W) + 0.5, np.arange(H) + 0.5)
Xw = sx - OX; q = OY - sy
hit = np.full((H, W), -1)
HX = np.zeros((H, W)); HY = np.zeros((H, W)); HZ = np.zeros((H, W)); DEP = np.full((H, W), -1e9)
d = 200.0
while d > -200.0:
    Y = q * CP + d * SP; Zw = -q * SP + d * CP
    Xl = Xw * CY + Zw * SY; Zl = -Xw * SY + Zw * CY        # dünya -> bina yerel
    free = hit < 0
    if not free.any(): break
    for i, (_, f) in enumerate(PRIMS):
        m = free & f(Xl, Y, Zl)
        if m.any():
            hit[m] = i; HX[m] = Xl[m]; HY[m] = Y[m]; HZ[m] = Zl[m]; DEP[m] = d
            free &= ~m
    d -= 0.25

def world_n(nx, ny, nz):
    # yerel normal -> dünya (ters dönüş)
    return np.array([nx * CY - nz * SY, ny, nx * SY + nz * CY])

def lshift(n):
    l = float(np.dot(n, L))
    return 1 if l > 0.62 else 0 if l > 0.3 else -1 if l > 0.0 else -2

# ---------------- dokular: (rampa, ton) döner ----------------
def stone_blocks(u, y, s=0, rowh=7):
    row = int(math.floor(y / rowh)); yy = y - row * rowh
    off = h(row, 3, s) * 14
    uu = u + off; bw = 9 + int(h(row, 7, s) * 6)
    col = int(math.floor(uu / bw)); xx = uu - col * bw
    if yy < 1 or xx < 1: return STONE, 1                    # harç
    t = 2 + int(h(row, col, s) * 3)
    if yy > rowh - 1.6 or xx < 2: t += 1                     # üst / sol kenar ışık
    if yy < 2: t -= 1                                        # alt kenar gölge
    if h(int(u), int(y), s + 5) < 0.08: t -= 1
    return STONE, t

def plaster(u, y):
    t = 4
    r = h(int(u), int(y), 11)
    if r < 0.05: t = 3
    elif r > 0.98: t = 5
    if h(int(u // 4), int(y // 3), 12) < 0.12: t -= 1         # lekeler
    return PLAST, t

def wood(u, y, along_x=True):
    a, b = (u, y) if along_x else (y, u)
    t = 3
    if h(int(a // 5), int(b), 21) < 0.25: t = 2              # damar
    if h(int(a), int(b), 22) < 0.06: t = 4
    return WOOD, t

def front(x, y):
    xi, yi = int(math.floor(x)), int(math.floor(y))
    if 22 <= x <= 50 and y <= 72:                                  # kapı
        if xi in (22, 23, 49, 50) or yi >= 70: return WOOD, 1
        if 27 <= x <= 45 and 52 <= y <= 66:
            if xi == 36 or yi == 59: return WOOD, 2
            return GLASS, 5 if (xi - yi) % 11 in (0, 1) else 4
        if xi == 44 and 34 <= yi <= 37: return [hx('#e2b94f')], 0
        if yi in (30, 31): return WOOD, 1
        return (WOOD, 1) if (xi - 23) % 6 == 0 else wood(x, y, False)
    if -104 <= x <= -16 and 22 <= y <= 66:                          # vitrin
        if xi in (-104, -103, -17, -16) or yi in (22, 23, 65, 66): return WOOD, 4 if yi > 23 else 2
        if xi in (-75, -74, -46, -45) or yi in (50, 51): return WOOD, 3
        if y < 31 and ((xi + 100) % 14) < 8: return GLASS, 0 if y < 27 else 1
        if (xi - yi) % 23 in (0, 1, 3) and y > 33: return GLASS, 5
        return GLASS, 4 if y > 40 else 3
    if -106 <= x <= -14 and 18 <= y <= 21: return WOOD, 4 if yi > 18 else 1
    if 72 <= x <= 106 and 30 <= y <= 66:                            # sağ pencere
        if xi in (72, 73, 105, 106) or yi in (30, 31, 65, 66) or xi == 89 or yi == 48: return WOOD, 3 if yi > 31 else 1
        return GLASS, 5 if (xi - yi) % 17 in (0, 1) else 4
    if 70 <= x <= 108 and 26 <= y <= 29: return WOOD, 4 if yi > 26 else 1
    return wall_skin(x, y)

def wall_skin(u, y):
    """Pencere / kapı dışındaki duvar: altta taş, üstte sıva + ahşap çerçeve."""
    ui, yi = int(math.floor(u)), int(math.floor(y))
    if y < 40: return stone_blocks(u, y - 10, 1)
    if 40 <= y < 43 or 72 <= y < 75 or y >= WH - 4: return wood(u, y)
    if abs(u) >= WX - 4: return wood(u, y, False)
    if ui in (-10, -9, -8, 62, 63, 64): return wood(u, y, False)
    if 65 <= u <= 115 and 75 < y < WH - 4 and abs((u - 65) * 0.42 - (y - 76)) < 0.9: return WOOD, 2
    if -115 <= u <= -11 and 75 < y < WH - 4 and abs((u + 115) * 0.2 - (y - 76)) < 0.7: return WOOD, 2
    return plaster(u, y)

def side(z, y):
    """Yan duvar (z yatay): taş, sıva, küçük pencere."""
    if -20 <= z <= 20 and 50 <= y <= 68:
        zi, yi = int(math.floor(z)), int(math.floor(y))
        if abs(z) > 17.5 or y < 52.5 or y > 65.5 or abs(z) < 1.2: return WOOD, 2
        return GLASS, 4
    if y < 40: return stone_blocks(z, y - 10, 2)
    if 40 <= y < 43 or 72 <= y < 75 or y >= WH - 4 or abs(z) >= WZ - 4 or abs(z) < 2: return wood(z, y)
    return plaster(z, y)

def roof_tile(u, s, slope_sign=1):
    """u: sırta paralel, s: sırttan saçağa mesafe (eğim boyunca)."""
    rowh, tw = 6.5, 11.0
    row = int(math.floor(s / rowh)); ss = s - row * rowh
    uu = u + (tw / 2 if row % 2 else 0); col = int(math.floor(uu / tw)); xx = uu - col * tw
    t = 3 + int(h(row, col, 31) * 2.2)
    if ss > rowh - 1.3: t = 1                     # kiremit alt gölgesi (bir alttakinin üstüne düşer)
    elif ss > rowh - 2.4: t -= 1
    elif ss < 1.2: t += 1                         # üst kenar ışık
    if xx < 0.9: t -= 1                           # yan derz
    pass
    return ROOF, t

# ---------------- boya ----------------
img = Image.new('RGBA', (W, H), (0, 0, 0, 0)); P = img.load()
SLOPE = math.hypot(RH, RZ) / RZ
for j in range(H):
    for i in range(W):
        k = hit[j, i]
        if k < 0: continue
        n = NAMES[k]; x, y, z = HX[j, i], HY[j, i], HZ[j, i]
        ao = 0; ramp, t = PLAST, 3; nrm = world_n(0, 0, 1)
        if n == 'wall':
            if z > WZ - 0.8: ramp, t = front(x, y); nrm = world_n(0, 0, 1)
            elif abs(x) > WX - 0.8: ramp, t = side(z if x < 0 else -z, y); nrm = world_n(np.sign(x), 0, 0)
            else: ramp, t = plaster(x, y); nrm = world_n(0, 1, 0)
            if y < 16: ao -= 1
            if y > WH - 10 and ramp is not GLASS: ao -= 1            # saçak gölgesi
        elif n == 'gable':
            nrm = world_n(np.sign(x), 0, 0)
            ramp, t = (WOOD, 3) if int(math.floor(z)) % 6 else (WOOD, 1)  # dikey tahta
            if h(int(z // 6), int(y), 41) < 0.2: t -= 1
            if y > ys(z) - 9: ao -= 1
        elif n == 'roof':
            if abs(x) > WX + RO - 0.8: ramp, t = WOOD, 1; nrm = world_n(np.sign(x), 0, 0)   # alın tahtası
            else:
                sgn = 1 if z >= 0 else -1
                ramp, t = roof_tile(x, (RZ - abs(z)) * 0 + (abs(z)) * SLOPE, sgn)
                nrm = world_n(0, RZ, sgn * RH); nrm = nrm / np.linalg.norm(nrm)
                if ys(z) > RB + RH - 2.5: ramp, t = ROOF, 2                       # mahya
                if abs(z) > RZ - 1.5: ramp, t = ROOF, 1                            # saçak kenarı
        elif n == 'plinth':
            if y > 9.5: ramp, t = STONE, 5; nrm = world_n(0, 1, 0)
            else:
                u = x if z > WZ + 3 else z
                ramp, t = stone_blocks(u, y, 7, rowh=5); nrm = world_n(0, 0, 1) if z > WZ + 3 else world_n(np.sign(x), 0, 0)
        elif n == 'step':
            ramp, t = (STONE, 6) if y > 4.6 else (STONE, 3); nrm = world_n(0, 1, 0)
        elif n == 'chimney':
            if y > RB + RH + 7.5: ramp, t = STONE, 4; nrm = world_n(0, 1, 0)
            else:
                fr = z > -0.8
                u = x if fr else z
                row = int(y // 4); col = int((u + (3 if row % 2 else 0)) // 7)
                ramp = BRICK; t = 2 + int(h(row, col, 51) * 2)
                if y % 4 < 1 or (u + (3 if row % 2 else 0)) % 7 < 1: t = 0
                nrm = world_n(0, 0, 1) if fr else world_n(1, 0, 0)
        elif n == 'dormer':
            u, v = x - DX0, y - RB
            if z > RZ - 5.8:
                nrm = world_n(0, 0, 1)
                if 11 <= u <= 37 and 7 <= v <= 25:
                    ui, vi = int(u), int(v)
                    ramp, t = (WOOD, 3) if (ui in (11, 12, 36, 37) or vi in (7, 8, 24, 25) or ui == 24) else (GLASS, 5 if (ui - vi) % 13 in (0, 1) else 4)
                elif u < 6 or u > 42 or v < 4 or v > 26: ramp, t = wood(u, v)
                else: ramp, t = plaster(u, v)
            else: ramp, t = plaster(z, y); nrm = world_n(np.sign(x - DCX), 0, 0)
        elif n == 'droof':
            if z > RZ - 2.8:
                nrm = world_n(0, 0, 1); ramp, t = (WOOD, 4) if int(y) % 3 else (WOOD, 2)
                if abs(x - DCX) > 27 * (1 - (y - RB - 29) / 18) - 2: ramp, t = WOOD, 1
            else:
                sg = -1 if x < DCX else 1
                nrm = world_n(sg * 18, 27, 0); nrm = nrm / np.linalg.norm(nrm)
                ramp, t = roof_tile(z, abs(x - DCX) * 1.2)
        elif n == 'awning':
            stripe = ((int(x) - AW['x0']) // 8) % 2 == 0
            ramp = AWG if stripe else AWW
            tt = (z - AW['z0']) / (AW['z1'] - AW['z0'])
            t = 3 if tt < 0.3 else 2 if tt < 0.88 else 1
            if tt > 0.93 and ((int(x) - AW['x0']) % 8) in (0, 7): continue
            nrm = world_n(0, 1, 0.6); nrm = nrm / np.linalg.norm(nrm)
        elif n == 'sign':
            nrm = world_n(0, 0, 1); u, v = int(x - 10), int(y - 74)
            ramp, t = wood(x, y)
            t += 1
            if u in (0, 1, 51, 52) or v in (0, 15): ramp, t = WOOD, 1
            if 18 <= u <= 31 and 3 <= v <= 10: ramp, t = AWW, 4 if v > 4 else 2
            if 32 <= u <= 35 and 5 <= v <= 9 and not (33 <= u <= 34 and 6 <= v <= 8): ramp, t = AWW, 3
            if 16 <= u <= 33 and v == 2: ramp, t = AWW, 2
            if u in (21, 25, 29) and 11 <= v <= 14 and (v + u) % 2: ramp, t = AWW, 3
        elif n in ('tabletop', 'stool'):
            top = y > (25.5 if n == 'tabletop' else 15.5)
            ramp, t = (WOOD, 5) if top else (WOOD, 3)
            nrm = world_n(0, 1, 0) if top else world_n(0, 0, 1)
        elif n in ('tableleg', 'stoolleg'): ramp, t = WOOD, 2
        elif n == 'cup': ramp, t = AWW, 4 if y > 30.5 else 3
        elif n == 'pot':
            pc = POTS[0] if abs(x - POTS[0]) < 12 else POTS[1]
            if y > 11.5: ramp, t = POT, 1
            else:
                nrm = world_n(x - pc, 0, z - (WZ + 9)); nrm /= max(1e-6, np.linalg.norm(nrm)); ramp, t = POT, 3
                if int(y) in (8, 9): t -= 1
        elif n == 'bush':
            pc = POTS[0] if abs(x - POTS[0]) < 14 else POTS[1]
            nrm = world_n(x - pc, y - 21, z - (WZ + 9)); nrm /= max(1e-6, np.linalg.norm(nrm))
            ramp, t = LEAF, 3
            if h(int(x // 2), int(y // 2), 61) < 0.3: t -= 1                 # yaprak kümeleri
            if h(int(x), int(y), 62) < 0.06: ramp, t = [hx('#e58aa6'), hx('#f4b6c8')], 0
        elif n == 'barrel':
            cx, cz = -WX - 14, 20
            nrm = world_n(x - cx, 0, z - cz); nrm /= max(1e-6, np.linalg.norm(nrm))
            if y > 25.5: ramp, t = WOOD, 4; nrm = world_n(0, 1, 0)
            elif int(y) in (5, 6, 19, 20): ramp, t = STONE, 1                 # demir çember
            else: ramp, t = wood(math.atan2(x - cx, z - cz) * 10, y, False)
        if ramp in (GLASS,) or (len(ramp) <= 2):
            c = pick(ramp, t)
        else:
            c = pick(ramp, t + lshift(nrm) + ao)
        P[i, j] = c

# kontur: soften (renkli dış hat) + nesneler arası ayrım çizgisi koyu ton
for j in range(1, H - 1):
    for i in range(1, W - 1):
        if hit[j, i] < 0: continue
        for di, dj in ((1, 0), (0, 1), (-1, 0), (0, -1)):
            k2 = hit[j + dj, i + di]
            if k2 >= 0 and k2 != hit[j, i] and DEP[j + dj, i + di] > DEP[j, i] + 4:
                r, g, b, a = P[i, j]; P[i, j] = (int(r * .45), int(g * .4), int(b * .4), 255); break

def cozy(im, sat=0.8, val=0.96):
    im = soften(im, outline_dark=(40, 28, 22), inner=False); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < 200: continue
            hh, s_, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            r, g, b = colorsys.hsv_to_rgb(hh, s_ * sat, v * val)
            px[x, y] = (int(r * 255), int(g * 255), int(b * 255), a)
    return im
img = cozy(img)

# yer gölgesi (konturdan sonra): binanın sağ altına yumuşak leke
sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); SH = sh.load()
for j in range(H):
    for i in range(W):
        if hit[j, i] >= 0 and NAMES[hit[j, i]] in ('wall', 'plinth', 'roof', 'gable'):
            for k in range(1, 9):
                a, b = i + k, j + k // 3
                if 0 <= a < W and 0 <= b < H: SH[a, b] = (30, 40, 20, 70)
base = Image.new('RGBA', (W, H), (0, 0, 0, 0)); base.alpha_composite(sh); base.alpha_composite(img)
bbox = base.getbbox(); base = base.crop(bbox)
base.save(os.path.join(OUT, 'cafe.png'))
# kapı ortası ve kapı önü (dünya -> ekran)
dx, dz = 36, WZ + 4
Xw_ = dx * CY - dz * SY; Zw_ = dx * SY + dz * CY
print('cafe', base.size, 'kapi_x', round(OX + Xw_ - bbox[0]), 'kapi_y', round(OY + Zw_ * SP - bbox[1]))
