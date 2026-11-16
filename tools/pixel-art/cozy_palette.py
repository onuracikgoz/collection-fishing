"""Ortak cozy palet: zemin paletleri (ground.py, STYLE=cozy) + AI kaynak görsellerinden (ai-src/*.png)
Lab uzayında k-means ile seçilen renkler. Bütün AI binaları bu palete eşlenir: hepsi aynı renk ailesinde kalır.
Çalıştır: python3 tools/pixel-art/cozy_palette.py  ->  tools/pixel-art/cozy_palette.json (+ önizleme png)
"""
import glob, json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
N_AI = int(os.environ.get('N_AI', '40'))

def srgb_to_lab(rgb):
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)

def kmeans(x, k, it=25, seed=1):
    r = np.random.default_rng(seed)
    c = x[r.choice(len(x), k, replace=False)]
    for _ in range(it):
        d = ((x[:, None, :] - c[None]) ** 2).sum(-1); a = d.argmin(1)
        for j in range(k):
            m = a == j
            if m.any(): c[j] = x[m].mean(0)
    return c, a

def ground_colors():
    sys.path.insert(0, HERE)
    src = open(os.path.join(HERE, 'ground.py')).read()
    i = src.index('if COZY:'); j = src.index('FLOWERS = [')
    ns = {}
    exec(src[src.index('def hx'):src.index('\n', src.index('def hx'))], ns)
    exec('COZY = True\n' + src[i:j], ns)
    out = []
    for k in ('G', 'D', 'SN', 'SAND', 'WATER', 'PAVE', 'STONE'): out += [c[:3] for c in ns[k]]
    return out

def ai_colors():
    px = []
    for f in sorted(glob.glob(os.path.join(HERE, 'ai-src', '*.png'))):
        im = np.asarray(Image.open(f).convert('RGB'), float).reshape(-1, 3)
        im = im[(im.min(1) < 235)]                       # beyaz arka plan dışarıda
        px.append(im[::7])
    x = np.concatenate(px)
    lab = srgb_to_lab(x)
    c, a = kmeans(lab, N_AI)
    # her kümenin Lab merkezine en yakın gerçek pikseli al (uydurma renk olmasın)
    out = []
    for j in range(N_AI):
        m = a == j
        if not m.any(): continue
        idx = np.where(m)[0][((lab[m] - c[j]) ** 2).sum(1).argmin()]
        out.append(tuple(int(v) for v in x[idx]))
    return out

if __name__ == '__main__':
    pal = []
    for c in ground_colors() + ai_colors():
        c = tuple(int(v) for v in c)
        if c not in pal: pal.append(c)
    json.dump({'colors': ['#%02x%02x%02x' % c for c in pal]}, open(os.path.join(HERE, 'cozy_palette.json'), 'w'), indent=0)
    sw = Image.new('RGB', (16 * 12, 16 * ((len(pal) + 11) // 12)))
    for i, c in enumerate(pal): sw.paste(c, ((i % 12) * 16, (i // 12) * 16, (i % 12) * 16 + 16, (i // 12) * 16 + 16))
    sw.save(os.path.join(HERE, 'cozy_palette.png')); print(len(pal), 'renk')
