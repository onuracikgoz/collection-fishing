"""clean_ai çıktısını birbirine değmeyen parçalarına ayırır (örn. masa + iki sandalye).

Gölge atılır, her parça kendi gölgesiyle ayrı PNG olur. Parçalar soldan sağa sıralanır.
Kullanım: python3 split_parts.py girdi.png ad1 ad2 ... [--min 40]
  örn: python3 split_parts.py Cafe/Teras/masa_sandalye.png sandalye_sag masa sandalye_sol
  (ad sırası = soldan sağa parça sırası; çıktı girdinin klasörüne yazılır)
"""
import os, sys
from collections import deque
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from clean_ai import add_shadow


def components(m, min_size):
    h, w = m.shape; lab = np.zeros((h, w), int); k = 0; out = []
    for y, x in zip(*np.where(m)):
        if lab[y, x]: continue
        k += 1; q = deque([(y, x)]); lab[y, x] = k; n = 0
        while q:
            yy, xx = q.popleft(); n += 1
            for a, b in ((yy + 1, xx), (yy - 1, xx), (yy, xx + 1), (yy, xx - 1)):
                if 0 <= a < h and 0 <= b < w and m[a, b] and not lab[a, b]: lab[a, b] = k; q.append((a, b))
        if n >= min_size: out.append(lab == k)
    return sorted(out, key=lambda c: np.where(c)[1].min())


def main(src, names, min_size):
    a = np.asarray(Image.open(src).convert('RGBA'))
    parts = components(a[..., 3] == 255, min_size)
    if len(parts) != len(names): sys.exit(f'{len(parts)} parça bulundu, {len(names)} ad verildi')
    for c, n in zip(parts, names):
        ys, xs = np.where(c); p = a.copy(); p[~c] = 0
        p = p[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        out = os.path.join(os.path.dirname(src), n + '.png'); im = add_shadow(Image.fromarray(p, 'RGBA'))
        im.save(out); print(out, im.size)


if __name__ == '__main__':
    args = sys.argv[1:]; mn = 40
    if '--min' in args: i = args.index('--min'); mn = int(args[i + 1]); del args[i:i + 2]
    main(args[0], args[1:], mn)
