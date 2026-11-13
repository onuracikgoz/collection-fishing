"""Köy binaları: önden-üst (oblique) bakış, kafe ile aynı ışın yöntemi ve cozy kontur.

Her bina bir SPEC sözlüğüdür: gövde ölçüleri, duvar / çatı malzemesi, kapı, pencereler,
ve önündeki küçük eşyalar. Gövde (taban, duvar, alın, çatı, baca) ortak kodla kurulur.
Çıktı: client/Assets/Art/Custom/Buildings/<ad>.png ve kapı noktaları buildings.json.

Kullanım: python3 buildings.py            (hepsi)
          python3 buildings.py ev_siva     (tek bina)
"""
import json, math, os, sys, colorsys
import numpy as np
from PIL import Image
from soften import soften

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'client', 'Assets', 'Art', 'Custom', 'Buildings')
PITCH = math.radians(26); CP, SP = math.cos(PITCH), math.sin(PITCH)
L = np.array([-0.6, 0.6, 0.53]); L /= np.linalg.norm(L)

def hx(s): s = s.lstrip('#'); return tuple(int(s[i:i+2], 16) for i in (0, 2, 4)) + (255,)
R = lambda *c: [hx(x) for x in c]
STONE = R('#4a4038', '#62564a', '#7b6d5c', '#94846f', '#ab9a82', '#c2b197', '#d7c8ae')
ASHLAR = R('#5b5450', '#746c66', '#8d847c', '#a69c92', '#bdb3a7', '#d2c9bc', '#e5ddd1')
PLAST = R('#7f6d56', '#9c876b', '#b7a07f', '#ccb692', '#dcc8a3', '#e9d8b6', '#f3e6c9')
WOOD = R('#2a180f', '#3e2416', '#55321f', '#6d4229', '#875334', '#9f6540', '#b77a4f')
LOG = R('#3a2414', '#523420', '#6c452a', '#875a36', '#a07044', '#b88656', '#cc9c6a')
ROOFS = {
    'red':   R('#36130f', '#521d16', '#70291d', '#8d3525', '#a8432d', '#c05437', '#d66a44', '#e5875a'),
    'slate': R('#1c2230', '#283143', '#354157', '#43526b', '#53647e', '#677a92', '#7d90a6', '#97a9bc'),
    'moss':  R('#1e2a1a', '#2b3a24', '#3a4d2f', '#4a613a', '#5c7547', '#708a56', '#86a066', '#9db57a'),
    'thatch': R('#4a3518', '#64481f', '#7f5c28', '#9a7333', '#b38b42', '#c9a356', '#dbba6e', '#e8cf8c'),
}
SHUT = {'green': R('#1f3b2a', '#2c5239', '#3c6c4b', '#4f875e'),
        'blue':  R('#1d2c45', '#2a3f5f', '#3a5579', '#4f6d93'),
        'red':   R('#4a1d18', '#6a2a21', '#89392b', '#a84b38')}
GLASS = R('#2a2a33', '#3b3a40', '#d7953f', '#efb75a', '#f8d684', '#fff0c0')
LEAF = R('#203d1c', '#2c5426', '#3c6f31', '#4f8a3b', '#67a347', '#86bd5a')
POT = R('#5a2c1f', '#7a3c29', '#9a4f34', '#b86641', '#cf8257')
IRON = R('#1e1d22', '#2e2d33', '#45434b', '#5f5c66', '#7c7984', '#9d9aa5')
GOLD = R('#5a3c10', '#8a6118', '#b88a26', '#dcb240', '#f0d46e')
CLOTH = R('#a69a80', '#c4b89c', '#ddd2b8', '#efe6d0', '#faf4e4')
FLOW = [hx('#e58aa6'), hx('#f4b6c8'), hx('#f2d36b'), hx('#c9a2e8')]

def h(a, b, s=0):
    v = math.sin(a * 12.9898 + b * 78.233 + s * 37.719) * 43758.5453
    return v - math.floor(v)
def pick(ramp, i): return ramp[max(0, min(len(ramp) - 1, i))]
def lshift(n):
    l = float(np.dot(n, L) / max(1e-6, np.linalg.norm(n)))
    return 1 if l > 0.62 else 0 if l > 0.3 else -1 if l > 0.0 else -2
N_FRONT, N_TOP = np.array([0, 0, 1.]), np.array([0, 1., 0])

# ---------------- dokular ----------------
def stone_blocks(u, y, s=0, rowh=7, ramp=STONE, bw0=9):
    row = int(math.floor(y / rowh)); yy = y - row * rowh
    uu = u + h(row, 3, s) * 14; bw = bw0 + int(h(row, 7, s) * 6)
    col = int(math.floor(uu / bw)); xx = uu - col * bw
    if yy < 1 or xx < 1: return ramp, 1
    t = 2 + int(h(row, col, s) * 3)
    if yy > rowh - 1.6 or xx < 2: t += 1
    if yy < 2: t -= 1
    return ramp, t

def plaster(u, y):
    t = 4; r = h(int(u), int(y), 11)
    if r < 0.05: t = 3
    if h(int(u // 4), int(y // 3), 12) < 0.1: t -= 1
    return PLAST, t

def wood(u, y, along_x=True, ramp=WOOD):
    a, b = (u, y) if along_x else (y, u)
    t = 3
    if h(int(a // 5), int(b), 21) < 0.25: t = 2
    return ramp, t

def planks(u, y, ramp=LOG, rowh=6):
    """Yatay kalas / kütük duvar: her sıra yuvarlak, altı gölgeli."""
    row = int(math.floor(y / rowh)); yy = y - row * rowh
    t = 3 + (1 if h(row, 5) > 0.6 else 0)
    if yy < 1.2: t = 1
    elif yy > rowh - 1.5: t += 1
    if h(int(u // 6), row, 23) < 0.15: t -= 1
    return ramp, t

def roof_tile(u, s, ramp):
    rowh, tw = 6.5, 11.0
    row = int(math.floor(s / rowh)); ss = s - row * rowh
    uu = u + (tw / 2 if row % 2 else 0); col = int(math.floor(uu / tw)); xx = uu - col * tw
    t = 3 + int(h(row, col, 31) * 2.2)
    if ss > rowh - 1.3: t = 1
    elif ss > rowh - 2.4: t -= 1
    elif ss < 1.2: t += 1
    if xx < 0.9: t -= 1
    return ramp, t

def roof_thatch(u, s, ramp):
    """Saman: dikey lif şeritleri, kat kat saçaklar."""
    rowh = 9.0
    row = int(math.floor(s / rowh)); ss = s - row * rowh
    t = 4 + (1 if h(int(u // 2), row, 33) > 0.55 else 0) - (1 if h(int(u // 3), row, 34) < 0.2 else 0)
    if ss > rowh - 1.6: t = 2
    elif ss < 1.5: t += 1
    return ramp, t

def roof_slate(u, s, ramp):
    rowh, tw = 5.0, 8.0
    row = int(math.floor(s / rowh)); ss = s - row * rowh
    uu = u + (tw / 2 if row % 2 else 0); col = int(math.floor(uu / tw)); xx = uu - col * tw
    t = 3 + int(h(row, col, 35) * 2)
    if ss > rowh - 1.2: t = 1
    elif ss < 1.0: t += 1
    if xx < 0.8: t -= 1
    return ramp, t

ROOF_TEX = {'tile': roof_tile, 'thatch': roof_thatch, 'slate': roof_slate}

# ---------------- bina ----------------
def render(S):
    WX, WZ, WH, RH = S['wx'], S['wz'], S['wh'], S['rh']
    RO = S.get('ro', 8); RZ = WZ + S.get('rz_over', 10); RB = WH - 2
    ROOF = ROOFS[S['roof']]; rtex = ROOF_TEX[S.get('roof_tex', 'tile')]
    GF = S.get('gable_front', False); RX = WX + RO
    def ys(Z): return RB + RH * (1 - np.abs(Z) / RZ)
    def yx(X): return RB + RH * (1 - np.abs(X) / RX)
    PR = []
    def add(name, f, paint=None): PR.append((name, f, paint))
    def box(name, x0, x1, y0, y1, z0, z1, paint=None):
        add(name, lambda X, Y, Z: (X >= x0) & (X <= x1) & (Y >= y0) & (Y <= y1) & (Z >= z0) & (Z <= z1),
            paint and (lambda x, y, z: paint(x, y, z, (x0, x1, y0, y1, z0, z1))))
    def cyl(name, cx, cz, r, y0, y1, paint=None):
        add(name, lambda X, Y, Z: ((X - cx) ** 2 + (Z - cz) ** 2 <= r * r) & (Y >= y0) & (Y <= y1),
            paint and (lambda x, y, z: paint(x, y, z, (cx, cz, r, y0, y1))))
    def sph(name, cx, cy, cz, r, paint=None):
        add(name, lambda X, Y, Z: (X - cx) ** 2 + (Y - cy) ** 2 + (Z - cz) ** 2 <= r * r,
            paint and (lambda x, y, z: paint(x, y, z, (cx, cy, cz, r))))
    ctx = dict(box=box, cyl=cyl, sph=sph, add=add, WX=WX, WZ=WZ, WH=WH)

    box('plinth', -WX - 3, WX + 3, 0, 8, -WZ - 3, WZ + 3)
    box('wall', -WX, WX, 8, WH, -WZ, WZ)
    if GF:
        add('gable', lambda X, Y, Z: (np.abs(X) <= WX) & (Y >= WH - 1) & (np.abs(Z) <= WZ) & (Y <= yx(X) - 3))
        add('roof', lambda X, Y, Z: (np.abs(X) <= RX) & (np.abs(Z) <= RZ) & (Y <= yx(X)) & (Y >= yx(X) - 5))
    else:
        add('gable', lambda X, Y, Z: (np.abs(X) <= WX) & (Y >= WH - 1) & (np.abs(Z) <= WZ) & (Y <= ys(Z) - 3))
        add('roof', lambda X, Y, Z: (np.abs(X) <= WX + RO) & (np.abs(Z) <= RZ) & (Y <= ys(Z)) & (Y >= ys(Z) - 5))
    if S.get('chimney') is not None:
        c0 = S['chimney']; box('chimney', c0, c0 + 16, RB + 10, RB + RH + 8, -18, 0)
    dx0, dx1, dy0, dy1 = S['door']
    box('step', dx0 - 4, dx1 + 4, 0, 4, WZ, WZ + 9)
    for ex in S.get('extras', []): ex(ctx)

    # ---- ışın ----
    W, H = 2 * WX + 120, int(WH * CP + RH * CP + (RZ + 70) * SP + 90)
    OX, OY = W / 2, H - 40
    sx, sy = np.meshgrid(np.arange(W) + 0.5, np.arange(H) + 0.5)
    Xw = sx - OX; q = OY - sy
    hit = np.full((H, W), -1); HX = np.zeros((H, W)); HY = np.zeros((H, W)); HZ = np.zeros((H, W))
    DEP = np.full((H, W), -1e9)
    d = 160.0
    while d > -160.0:
        Y = q * CP + d * SP; Z = -q * SP + d * CP
        free = hit < 0
        if not free.any(): break
        for i, (_, f, _) in enumerate(PR):
            m = free & f(Xw, Y, Z)
            if m.any():
                hit[m] = i; HX[m] = Xw[m]; HY[m] = Y[m]; HZ[m] = Z[m]; DEP[m] = d; free &= ~m
        d -= 0.25

    wins = S.get('windows', [])
    def window(x, y):
        for (x0, x1, y0, y1, sh) in wins:
            if sh and (x0 - 9 <= x < x0 or x1 < x <= x1 + 9) and y0 <= y <= y1:      # kepenk
                xi, yi = int(x), int(y)
                ramp = SHUT[sh]
                if xi in (x0 - 9, x1 + 9) or yi in (y0, y1): return ramp, 0
                return ramp, 2 if (yi - y0) % 4 else 1
            if x0 - 2 <= x <= x1 + 2 and y0 - 4 <= y < y0 and S.get('flowerbox'):    # çiçek kutusu
                xi, yi = int(x), int(y)
                if yi >= y0 - 2 and h(xi, yi, 71) < 0.5: return [FLOW[int(h(xi, 3, 72) * 4)]], 0
                if yi >= y0 - 2: return LEAF, 3
                return WOOD, 4 if yi == y0 - 3 else 2
            if x0 <= x <= x1 and y0 <= y <= y1:
                xi, yi = int(math.floor(x)), int(math.floor(y)); mx = (x0 + x1) // 2; my = (y0 + y1) // 2
                if xi in (x0, x0 + 1, x1 - 1, x1) or yi in (y0, y0 + 1, y1 - 1, y1): return WOOD, 4 if yi > y0 + 1 else 2
                if xi == mx or yi == my: return WOOD, 3
                return GLASS, 5 if (xi - yi) % 13 in (0, 1) else 4
            if x0 - 2 <= x <= x1 + 2 and y0 - 3 <= y < y0:                            # pervaz
                return WOOD, 4 if int(y) == y0 - 1 else 1
        return None

    def door(x, y):
        if not (dx0 <= x <= dx1 and 8 <= y <= dy1): return None
        xi, yi = int(math.floor(x)), int(math.floor(y))
        if S.get('door_arch') and y > dy1 - 8:
            cx = (dx0 + dx1) / 2; rr = (dx1 - dx0) / 2
            if (x - cx) ** 2 + ((y - (dy1 - 8)) * 1.4) ** 2 > rr * rr: return None
        if xi in (dx0, dx0 + 1, dx1 - 1, dx1) or yi >= dy1 - 1: return WOOD, 1
        dc = S.get('door_col', WOOD)
        if S.get('door_glass') and dy1 - 18 <= y <= dy1 - 6 and dx0 + 5 <= x <= dx1 - 5:
            return GLASS, 4
        if xi == dx1 - 5 and dy0 + 20 <= yi <= dy0 + 22: return GOLD, 3
        if S.get('door_double') and abs(x - (dx0 + dx1) / 2) < 0.8: return WOOD, 1
        if (xi - dx0) % 6 == 0: return dc, 1
        return wood(x, y, False, dc)

    def skin(u, y, face):
        m = S['wall']; sh = S.get('stone_h', 30)
        if m == 'ashlar':
            if face == 'front' and y > WH - 10: return ASHLAR, 5 if y > WH - 3 else 2      # korniş
            return stone_blocks(u, y - 8, 3, rowh=9, ramp=ASHLAR, bw0=15)
        if m == 'stone': return stone_blocks(u, y - 8, 4, rowh=8, bw0=10)
        if y < sh: return stone_blocks(u, y - 8, 1)
        if m == 'log':
            if abs(u) > (WX if face == 'front' else WZ) - 5: return LOG, 2 if int(y) % 6 < 2 else 4  # köşe kütük uçları
            return planks(u, y)
        # sıva + ahşap çatkı
        if sh <= y < sh + 3 or y >= WH - 4: return wood(u, y)
        lim = WX if face == 'front' else WZ
        if abs(u) >= lim - 4: return wood(u, y, False)
        for p in S.get('posts', []) if face == 'front' else ():
            if p <= u < p + 3: return wood(u, y, False)
        return plaster(u, y)

    img = Image.new('RGBA', (W, H), (0, 0, 0, 0)); P = img.load()
    SLOPE = math.hypot(RH, RZ) / RZ
    for j in range(H):
        for i in range(W):
            k = hit[j, i]
            if k < 0: continue
            n, f, paint = PR[k]; x, y, z = HX[j, i], HY[j, i], HZ[j, i]
            ao = 0; ramp, t = PLAST, 3; nrm = N_FRONT; flat = False
            if paint is not None:
                ramp, t, nrm, flat = paint(x, y, z)
            elif n == 'wall':
                if z > WZ - 0.8:
                    r = door(x, y) or window(x, y) or skin(x, y, 'front'); ramp, t = r
                    flat = ramp is GLASS
                else: ramp, t = skin(z, y, 'side'); nrm = np.array([np.sign(x), 0, 0.])
                if y < 13: ao -= 1
                if y > WH - 9 and ramp is not GLASS: ao -= 1
            elif n == 'gable' and GF:
                nrm = N_FRONT if z > WZ - 0.8 else np.array([np.sign(x), 0, 0.])
                gw = S.get('gable_win'); u = x if z > WZ - 0.8 else z
                if gw and z > WZ - 0.8 and x * x + ((y - WH - gw) * 1.1) ** 2 < 49:
                    dd = x * x + ((y - WH - gw) * 1.1) ** 2
                    ramp, t = (WOOD, 2) if dd > 30 or abs(x) < 0.8 or abs(y - WH - gw) < 0.8 else (GLASS, 4)
                    flat = ramp is GLASS
                elif S['wall'] == 'log': ramp, t = planks(u, y)
                elif S['wall'] == 'stone': ramp, t = stone_blocks(u, y - 8, 4, rowh=8, bw0=10)
                else: ramp, t = (WOOD, 3) if int(math.floor(u)) % 6 else (WOOD, 1)
                if y > yx(x) - 8: ao -= 1
            elif n == 'roof' and GF:
                if z > RZ - 0.8: ramp, t = WOOD, 3; nrm = N_FRONT                 # ön saçak tahtası
                else:
                    sgn = 1 if x >= 0 else -1
                    ramp, t = rtex(z, abs(x) * math.hypot(RH, RX) / RX, ROOF)
                    nrm = np.array([sgn * RH, RX, 0], float)
                    if yx(x) > RB + RH - 2.5: ramp, t = ROOF, 2
                    if abs(x) > RX - 1.5: ramp, t = ROOF, 1
                    if z < -RZ + 2: t -= 1
            elif n == 'gable':
                nrm = np.array([np.sign(x), 0, 0.])
                ramp, t = (WOOD, 3) if int(math.floor(z)) % 6 else (WOOD, 1)
            elif n == 'roof':
                if abs(x) > WX + RO - 0.8: ramp, t = WOOD, 1; nrm = np.array([np.sign(x), 0, 0.])
                else:
                    sgn = 1 if z >= 0 else -1
                    ramp, t = rtex(x, abs(z) * SLOPE, ROOF)
                    nrm = np.array([0, RZ, sgn * RH], float)
                    if ys(z) > RB + RH - 2.5: ramp, t = ROOF, 2
                    if abs(z) > RZ - 1.5: ramp, t = ROOF, 1
                    if abs(x) > WX + RO - 2.5: t -= 1          # yan saçak koyu
            elif n == 'plinth':
                if y > 7.5: ramp, t = STONE, 5; nrm = N_TOP
                else:
                    fr = z > WZ + 2
                    ramp, t = stone_blocks(x if fr else z, y, 7, rowh=4)
                    nrm = N_FRONT if fr else np.array([np.sign(x), 0, 0.])
            elif n == 'step':
                ramp, t = (STONE, 6) if y > 3.6 else (STONE, 3); nrm = N_TOP
            elif n == 'chimney':
                if y > RB + RH + 7.5: ramp, t = STONE, 2; nrm = N_TOP
                else: ramp, t = stone_blocks(x if z > -0.8 else z, y, 9, rowh=5)
            c = pick(ramp, t) if (flat or len(ramp) <= 2) else pick(ramp, t + lshift(nrm) + ao)
            P[i, j] = c

    # nesneler arası ayrım: arkadakine değen kenar koyulaşır
    for j in range(1, H - 1):
        for i in range(1, W - 1):
            if hit[j, i] < 0: continue
            for di, dj in ((1, 0), (0, 1), (-1, 0), (0, -1)):
                k2 = hit[j + dj, i + di]
                if k2 >= 0 and k2 != hit[j, i] and DEP[j + dj, i + di] > DEP[j, i] + 4:
                    r, g, b, a = P[i, j]; P[i, j] = (int(r * .45), int(g * .4), int(b * .4), 255); break
    img = cozy(img)
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); SH = sh.load()
    for j in range(H):
        for i in range(W):
            if hit[j, i] >= 0 and PR[hit[j, i]][0] in ('wall', 'plinth', 'roof', 'gable'):
                for k in range(1, 9):
                    a, b = i + k, j + k // 3
                    if 0 <= a < W and 0 <= b < H: SH[a, b] = (30, 40, 20, 70)
    base = Image.new('RGBA', (W, H), (0, 0, 0, 0)); base.alpha_composite(sh); base.alpha_composite(img)
    bb = base.getbbox(); base = base.crop(bb)
    # kapı önü (dünya -> ekran): y=0, z=WZ+6
    cx, cz = (dx0 + dx1) / 2, WZ + 6
    door_px = (round(OX + cx - bb[0]), round(OY - (-cz * SP) / 1 - bb[1]))
    # oy: ekran q = (Y*CP - Z*SP) için Y=0 -> q = -Z*SP ; satır = OY - q
    door_px = (round(OX + cx - bb[0]), round(OY + cz * SP - bb[1]))
    return base, door_px

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

# ---------------- küçük eşya boyacıları ----------------
def p_box(ramp, top_t=5, side_t=3, tex=None):
    def f(x, y, z, b):
        x0, x1, y0, y1, z0, z1 = b
        if y > y1 - 0.8: return ramp, top_t, N_TOP, False
        if z > z1 - 0.8:
            if tex: r, t = tex(x, y); return r, t, N_FRONT, False
            return ramp, side_t, N_FRONT, False
        return ramp, side_t - 1, np.array([np.sign(x - (x0 + x1) / 2), 0, 0.]), False
    return f

def p_crate(x, y, z, b):
    x0, x1, y0, y1, z0, z1 = b
    if y > y1 - 0.8: return WOOD, 5, N_TOP, False
    u = x if z > z1 - 0.8 else z; a0 = x0 if z > z1 - 0.8 else z0; a1 = x1 if z > z1 - 0.8 else z1
    nrm = N_FRONT if z > z1 - 0.8 else np.array([np.sign(x - (x0 + x1) / 2), 0, 0.])
    if u - a0 < 2 or a1 - u < 2 or y - y0 < 2 or y1 - y < 2: return WOOD, 2, nrm, False
    if abs((u - a0) / (a1 - a0) - (y - y0) / (y1 - y0)) < 0.09: return WOOD, 2, nrm, False
    return WOOD, 4, nrm, False

def p_cyl(ramp, top_t=4, side_t=3, bands=()):
    def f(x, y, z, b):
        cx, cz, r, y0, y1 = b
        if y > y1 - 0.6: return ramp, top_t, N_TOP, False
        if int(y - y0) in bands: return IRON, 2, np.array([x - cx, 0, z - cz]), False
        return ramp, side_t, np.array([x - cx, 0, z - cz]), False
    return f

def p_bush(x, y, z, b):
    cx, cy, cz, r = b
    t = 3 - (1 if h(int(x // 2), int(y // 2), 61) < 0.3 else 0)
    if h(int(x), int(y), 62) < 0.06: return [FLOW[0], FLOW[1]], 0, N_TOP, True
    return LEAF, t, np.array([x - cx, y - cy, z - cz]), False

def pot_bush(cx, cz):
    def ex(c):
        c['cyl']('pot', cx, cz, 6.5, 0, 10, p_cyl(POT, 1, 3))
        c['sph']('bush', cx, 18, cz, 9.5, p_bush)
    return ex

def barrel(cx, cz):
    return lambda c: c['cyl']('barrel', cx, cz, 9, 0, 24, p_cyl(WOOD, 4, 3, bands=(4, 5, 18, 19)))

def crate(x0, z0, s=14):
    return lambda c: c['box']('crate', x0, x0 + s, 0, s, z0, z0 + s, p_crate)

def sign(x0, x1, y0, y1, icon):
    def paint(x, y, z, b):
        bx0, bx1, by0, by1, bz0, bz1 = b
        u, v = x - bx0, y - by0; w_, h_ = bx1 - bx0, by1 - by0
        if u < 1.5 or w_ - u < 1.5 or v < 1.5 or h_ - v < 1.5: return WOOD, 1, N_FRONT, False
        cu, cv = w_ / 2, h_ / 2
        if icon == 'coin':
            dd = (u - cu) ** 2 + (v - cv) ** 2
            if dd < (h_ / 2 - 3) ** 2:
                return GOLD, (4 if dd < (h_ / 2 - 6) ** 2 and not abs(u - cu) < 1 else 2), N_FRONT, True
        if icon == 'hammer':
            if abs(v - cv - 3) < 2.2 and abs(u - cu) < 7: return IRON, 4, N_FRONT, True
            if abs(u - cu - 1) < 1.3 and v < cv + 2 and v > 3: return LOG, 5, N_FRONT, True
        return WOOD, 4, N_FRONT, False
    return lambda c: c['box']('sign', x0, x1, y0, y1, c['WZ'], c['WZ'] + 3, paint)

def columns(xs, r=5):
    def ex(c):
        for x in xs:
            c['cyl']('col', x, c['WZ'] + 10, r, 8, c['WH'] - 6, p_cyl(ASHLAR, 5, 4))
            c['box']('capital', x - r - 2, x + r + 2, c['WH'] - 8, c['WH'] - 3, c['WZ'] + 10 - r - 2, c['WZ'] + 10 + r + 2, p_box(ASHLAR, 6, 4))
        c['box']('porch', -c['WX'] + 6, c['WX'] - 6, 0, 8, c['WZ'], c['WZ'] + 18, p_box(ASHLAR, 5, 3))
        c['box']('entab', -c['WX'] + 6, c['WX'] - 6, c['WH'] - 4, c['WH'] + 4, c['WZ'], c['WZ'] + 17, p_box(ASHLAR, 5, 3))
    return ex

def anvil(cx, cz):
    def ex(c):
        c['box']('stump', cx - 6, cx + 6, 0, 10, cz - 5, cz + 5, p_box(LOG, 5, 3))
        c['box']('anvil', cx - 9, cx + 9, 10, 15, cz - 4, cz + 4, p_box(IRON, 5, 3))
    return ex

def workbench(x0, x1, z0):
    def ex(c):
        c['box']('bench_top', x0, x1, 15, 18, z0, z0 + 10, p_box(WOOD, 5, 3))
        for xx in (x0 + 1, x1 - 4):
            c['box']('bench_leg', xx, xx + 3, 0, 15, z0 + 2, z0 + 5, p_box(WOOD, 3, 2))
        c['box']('plank', x0 + 6, x0 + 30, 18, 20, z0 + 3, z0 + 7, p_box(LOG, 5, 3))
    return ex

def logpile(x0, z0, n=3):
    """Kütük yığını: kütükler z boyunca, yuvarlak uçları öne bakar."""
    L_ = 24
    def ex(c):
        spots = [(x0 + k * 9, 5) for k in range(n)] + [(x0 + 4.5 + k * 9, 13) for k in range(n - 1)]
        for (xx, yy) in spots:
            c['add']('log', (lambda xx, yy: lambda X, Y, Z: ((Y - yy) ** 2 + (X - xx) ** 2 <= 21) & (Z >= z0) & (Z <= z0 + L_))(xx, yy),
                     (lambda xx, yy: lambda x, y, z: ((LOG, 6 if (x - xx) ** 2 + (y - yy) ** 2 > 8 else 4, N_FRONT, True) if z > z0 + L_ - 0.8
                      else (LOG, 3, np.array([x - xx, y - yy, 0]), False)))(xx, yy))
    return ex

# ---------------- binalar ----------------
SPECS = {
    'ev_siva': dict(wx=60, wz=40, wh=66, rh=30, roof='red', wall='plaster', stone_h=24, chimney=26,
                    door=(-14, 8, 8, 54), windows=[(-48, -28, 30, 50, 'green'), (26, 46, 30, 50, 'green')],
                    posts=[-24, 18], flowerbox=True,
                    extras=[pot_bush(-26, 49), barrel(76, 20)]),
    'ev_kutuk': dict(wx=48, wz=40, wh=56, rh=40, roof='thatch', roof_tex='thatch', ro=10, rz_over=10, wall='log', gable_front=True,
                     stone_h=16, chimney=None, door=(4, 24, 8, 50), door_arch=True,
                     windows=[(-38, -16, 26, 44, 'red')], flowerbox=True,
                     extras=[logpile(-82, 10, 3), pot_bush(34, 49)]),
    'ev_tas': dict(wx=60, wz=42, wh=66, rh=44, roof='slate', roof_tex='slate', wall='stone', chimney=-40, gable_front=True, gable_win=20, rz_over=8,
                   door=(-11, 11, 8, 56), door_arch=True, door_glass=True,
                   windows=[(-48, -28, 30, 50, 'blue'), (28, 48, 30, 50, 'blue')],
                   extras=[pot_bush(-20, 51), pot_bush(20, 51)]),
    'banka': dict(wx=86, wz=46, wh=92, rh=24, roof='slate', roof_tex='slate', ro=6, wall='ashlar', chimney=None,
                  door=(-15, 15, 8, 66), door_double=True, door_col=R('#2a1610', '#3a1f14', '#4d2a1b', '#613524', '#76412d', '#8b4e36', '#a05d40'),
                  windows=[(-70, -48, 34, 66, None), (48, 70, 34, 66, None)],
                  extras=[columns([-34, 34]), sign(-20, 20, 70, 84, 'coin')]),
    'atolye': dict(wx=70, wz=44, wh=64, rh=30, roof='moss', wall='plaster', stone_h=34, chimney=36,
                   door=(-48, -12, 8, 54), door_double=True,
                   windows=[(28, 54, 30, 50, None)], posts=[],
                   extras=[sign(-6, 18, 34, 50, 'hammer'), anvil(16, 66), workbench(30, 64, 48),
                           crate(-70, 52), crate(-84, 58, 12)]),
}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    names = sys.argv[1:] or list(SPECS)
    meta_p = os.path.join(OUT, 'buildings.json')
    meta = json.load(open(meta_p)) if os.path.exists(meta_p) else {}
    for nm in names:
        im, door = render(SPECS[nm])
        im.save(os.path.join(OUT, nm + '.png'))
        meta[nm] = dict(size=list(im.size), door=list(door))
        print(nm, im.size, 'kapi', door)
    json.dump(meta, open(meta_p, 'w'), indent=1)
