"""Kodla çizilen piksel art'ı elle çizilmiş gibi yumuşatır (docs/tasarim/15-gorsel-stil.md).
1) Seçici kontur: dış hat koyu tek renk değil, komşu yüzeyin koyusu. Işık sol üstten: üst/sol kenar daha açık.
2) Merdiven köşeleri: iki renk sınırındaki tek piksellik köşelere ara ton (elle AA).
3) İç sınırlar: çok zıt iki ton yan yana ise sınıra ince ara ton şeridi.
Kullanım: from soften import soften; im = soften(im)
"""
from PIL import Image

def mix(a, b, t):
    return tuple(int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3)) + (255,)

def lum(c): return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

def soften(im, outline_dark=(46, 30, 36), aa=True, inner=True):
    im = im.convert('RGBA'); W, H = im.size
    src = im.copy(); s = src.load(); px = im.load()
    def op(x, y): return 0 <= x < W and 0 <= y < H and s[x, y][3] > 200
    N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
    # 1) seçici kontur: kontur pikseli = içerideki komşunun koyusu
    is_outline = {}
    for y in range(H):
        for x in range(W):
            if not op(x, y): continue
            if any(not op(x + dx, y + dy) for dx, dy in N4):
                is_outline[(x, y)] = True
    for (x, y) in is_outline:
        inner_cols = [s[x + dx, y + dy] for dx, dy in N4 + ((1, 1), (-1, -1), (1, -1), (-1, 1)) if op(x + dx, y + dy) and (x + dx, y + dy) not in is_outline]
        if not inner_cols: continue
        base = max(inner_cols, key=lum) if len(inner_cols) > 1 else inner_cols[0]
        top_left = (not op(x, y - 1)) or (not op(x - 1, y))
        bottom = not op(x, y + 1)
        t = 0.55 if top_left and not bottom else 0.78
        px[x, y] = mix(base, outline_dark, t)
    if aa:
        # 2) merdiven köşeleri: pikselin iki dik komşusu aynı başka renkse ara ton
        s2 = im.copy().load()
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                c = s2[x, y]
                if c[3] < 200 or (x, y) in is_outline: continue
                for (ax, ay), (bx, by) in (((1, 0), (0, 1)), ((-1, 0), (0, 1)), ((1, 0), (0, -1)), ((-1, 0), (0, -1))):
                    a, b = s2[x + ax, y + ay], s2[x + bx, y + by]
                    o1, o2 = s2[x - ax, y - ay], s2[x - bx, y - by]
                    if a[3] > 200 and a == b and a != c and o1 == c and o2 == c and abs(lum(a) - lum(c)) > 18:
                        px[x, y] = mix(c, a, 0.45); break
    if inner:
        # 3) çok zıt iç sınırlarda daha koyu tarafa ara ton
        s3 = im.copy().load()
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                c = s3[x, y]
                if c[3] < 200 or (x, y) in is_outline: continue
                for dx, dy in ((0, -1), (-1, 0)):
                    n = s3[x + dx, y + dy]
                    if n[3] > 200 and (x + dx, y + dy) not in is_outline and lum(n) - lum(c) > 70:
                        px[x, y] = mix(c, n, 0.3); break
    return im
