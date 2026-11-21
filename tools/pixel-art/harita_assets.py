"""Gemini harita görsellerini (ai-src/harita/*.jpg) oyuna oturtur.

Her görsel için: ızgara ölçülür (grid_measure), hedef boya göre küçültme seçilir,
clean_ai ile cozy palete çekilir. Çoklu görseller (sheet) parçalarına ayrılır
(satır satır, soldan sağa) ve her parça kendi gölgesiyle ayrı PNG olur.

Boy kuralı: hedef oyun pikseli `h`. Önce UP=2 (bir sanat pikseli = 2 oyun pikseli,
balıkçı ve teras gibi); hedef çok büyükse UP=3, küçültme ızgaradan küçük çıkarsa ızgara kullanılır,
ızgaranın 1.6 katından büyük çıkarsa detay kaybolmasın diye UP=1.
Sheet'lerde `h`, sheet'teki EN UZUN parçanın hedef boyudur.

Kullanım: python3 harita_assets.py [ad ...]   (ad verilmezse hepsi)
"""
import os, subprocess, sys
from collections import deque
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from clean_ai import add_shadow
from grid_measure import grid

SRC = os.path.join(HERE, 'ai-src', 'harita')
ART = os.path.normpath(os.path.join(HERE, '..', '..', 'client', 'Assets', 'Art', 'Custom'))

# ad: (klasör, hedef boy px, parça adları; tek parça için None)
ASSETS = {
    'degirmen': ('Buildings', 360, None),
    'banka': ('Buildings', 250, None),
    'atolye': ('Buildings', 240, None),
    'ev_1': ('Buildings', 200, None),
    'ev_2': ('Buildings', 250, None),
    'ev_3': ('Buildings', 190, None),
    'cesme': ('Plaza', 140, None),
    'pano': ('Plaza', 120, None),
    'tezgah': ('Plaza', 110, None),
    'kuyu': ('Plaza', 100, None),
    'iskele': ('Water', 220, None),
    'platform': ('Water', 150, None),
    'magara': ('Nature', 170, None),
    'kayik_tabela': ('Props', 84, ['kayik', 'yon_tabelasi']),
    'plaj': ('Water', 80, ['plaj_semsiye', 'sezlong', 'havlu', 'kumdan_kale', 'kova']),
    'kiyi': ('Water', 48, ['saz', 'nilufer', 'kiyi_taslari', 'uzun_cimen', 'kaya_buyuk']),
    'agaclar': ('Nature', 190, ['agac_mese', 'agac_cam', 'agac_elma']),
    'doga': ('Nature', 40, ['cali', 'cali_cicekli', 'mantar', 'kutuk', 'devrik_kutuk', 'kayalar']),
    'lamba_ates': ('Props', 96, ['sokak_lambasi', 'fener_direk_ahsap', 'kamp_atesi', 'kutuk_oturak']),
    'depo': ('Props', 56, ['fici', 'sandik', 'sandik_yigin', 'cuval', 'saman', 'el_arabasi']),
}


def components(mask, min_size):
    h, w = mask.shape; lab = np.zeros((h, w), int); k = 0; out = []
    for y, x in zip(*np.where(mask)):
        if lab[y, x]: continue
        k += 1; q = deque([(y, x)]); lab[y, x] = k; n = 0
        while q:
            yy, xx = q.popleft(); n += 1
            for a, b in ((yy + 1, xx), (yy - 1, xx), (yy, xx + 1), (yy, xx - 1)):
                if 0 <= a < h and 0 <= b < w and mask[a, b] and not lab[a, b]: lab[a, b] = k; q.append((a, b))
        if n >= min_size: out.append(lab == k)
    return out


def reading_order(parts):
    """Satırlara böl (dikey aralıkları örtüşenler aynı satır), satır içinde soldan sağa."""
    box = [(np.where(c)[0].min(), np.where(c)[0].max(), np.where(c)[1].min(), c) for c in parts]
    box.sort(key=lambda b: (b[0] + b[1]) / 2)
    rows = []
    for b in box:
        if rows and b[0] < np.mean([r[1] for r in rows[-1]]):
            rows[-1].append(b)
        else:
            rows.append([b])
    return [b[3] for r in rows for b in sorted(r, key=lambda b: b[2])]


def source_height(path, multi):
    """Tek parçada tüm görselin, sheet'te en uzun parçanın kaynak boyu (px)."""
    a = np.asarray(Image.open(path).convert('RGB')).min(-1) < 215
    if not multi:
        ys = np.where(a.any(1))[0]; return ys.max() - ys.min() + 1
    small = a[::4, ::4]
    return max(np.ptp(np.where(c)[0]) + 1 for c in components(small, 30)) * 4


def run(name):
    folder, target, parts = ASSETS[name]
    src = os.path.join(SRC, name + '.jpg')
    g = grid(src)[0]
    h = source_height(src, bool(parts))
    up = 2; block = h / (target / up)
    if block < 0.8 * g: up = 3; block = h / (target / up)
    if block < g: block = g
    if block > 1.6 * g: up = 1; block = max(g, h / target)
    os.makedirs(os.path.join(ART, folder), exist_ok=True)
    out = os.path.join(ART, folder, name + '.png')
    env = dict(os.environ, UP=str(up))
    subprocess.run([sys.executable, os.path.join(HERE, 'clean_ai.py'), src, out, '9999', f'{block:.3f}'],
                   check=True, env=env, stdout=subprocess.DEVNULL)
    if not parts:
        print(f'{name}: grid {g} block {block:.2f} UP={up} ->', Image.open(out).size); return
    a = np.asarray(Image.open(out).convert('RGBA')); os.remove(out)
    found = reading_order(components(a[..., 3] == 255, 12))
    if len(found) != len(parts):
        sys.exit(f'{name}: {len(found)} parça bulundu, {len(parts)} ad var')
    for c, n in zip(found, parts):
        ys, xs = np.where(c); p = a.copy(); p[~c] = 0
        p = p[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        im = add_shadow(Image.fromarray(p, 'RGBA')); im.save(os.path.join(ART, folder, n + '.png'))
        print(f'{name}/{n}: UP={up} ->', im.size)


if __name__ == '__main__':
    for n in (sys.argv[1:] or ASSETS): run(n)
