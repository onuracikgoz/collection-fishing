"""AI çıktısını oyuna oturt (v2).

1. Beyaz arka planı köşelerden taşma ile siler, istenirse belli bir satırın altını keser.
2. Her pikseli ortak cozy palete (cozy_palette.json) Lab uzayında en yakın renge eşler:
   bütün AI binaları aynı renk ailesinde kalır, kırmızı pembeye, yeşil griye kaymaz.
3. Küçültürken ortalama almaz: her hedef pikselin kapladığı bloktaki EN SIK palet rengini alır.
   Yeni ara renk çıkmaz, kenarlar keskin kalır.
4. Kendi konturunu korur (ek kontur çizmez), sadece yer gölgesi ekler.

Kullanım: python3 clean_ai.py girdi.png cikti.png <zemin_kesme_y> <küçültme> [palet.json]
  örn: python3 clean_ai.py ai-src/balikci_2.png ../../client/Assets/Art/Custom/Buildings/balikci_ai_2.png 9999 2.0
  küçültme: 768 px'lik görseli kaç kat küçülteceğin (2.0 -> ~384 px).
  HOLE=n: n pikselden büyük kapalı beyaz bölgeleri de sil (0 kapatır, varsayılan 4).
  PALETTE=own: ortak palet yerine görselin kendi renkleri (NCOL kadar, gürültü toplanır).
  Görselin gerçek bir ızgarası varsa (Gemini ~4.26 px) küçültme = ızgara, UP=2 ile 2 kat keskin büyüt.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from cozy_palette import srgb_to_lab


def load_palette(path):
    cols = json.load(open(path))['colors']
    return np.array([[int(c[i:i + 2], 16) for i in (1, 3, 5)] for c in cols], float)


def white_regions(mask, min_size):
    """mask içindeki 4-komşu bağlı bölgelerden en az min_size piksel olanlar (scipy'siz)."""
    from collections import deque
    h, w = mask.shape; seen = np.zeros_like(mask); out = np.zeros_like(mask)
    for y0, x0 in zip(*np.where(mask)):
        if seen[y0, x0]: continue
        q = deque([(y0, x0)]); seen[y0, x0] = True; comp = []
        while q:
            y, x = q.popleft(); comp.append((y, x))
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not seen[yy, xx]:
                    seen[yy, xx] = True; q.append((yy, xx))
        if len(comp) >= min_size:
            ys, xs = zip(*comp); out[ys, xs] = True
    return out


def add_shadow(small):
    """Yer gölgesi (sağ alt), sonra görsel; boş kenarlar kırpılır."""
    sh = Image.new('RGBA', (small.width + 10, small.height + 4), (0, 0, 0, 0)); sp = sh.load(); sa = small.load()
    for y in range(small.height):
        for x in range(small.width):
            if sa[x, y][3] and y > small.height * 0.4:
                for k in range(1, 9):
                    if x + k < sh.width and y + k // 3 < sh.height: sp[x + k, y + k // 3] = (30, 40, 20, 70)
    sh.alpha_composite(small, (0, 0)); return sh.crop(sh.getbbox())


def main(src, out, cut_y, scale, pal_path):
    pal = load_palette(pal_path); pal_lab = srgb_to_lab(pal)
    im = Image.open(src).convert('RGBA'); W, H = im.size
    bg = im.convert('RGB').copy()
    for c in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)]:
        ImageDraw.floodfill(bg, c, (255, 0, 255), thresh=40)
    rgb = np.asarray(im.convert('RGB'), float)
    alpha = ~np.all(np.asarray(bg) == (255, 0, 255), axis=-1)
    # beyaz arka plandan kalan açık kenar saçağını sil: arka plana değen açık pikseller de arka plan
    light = rgb.min(-1) > 165
    for _ in range(4):
        bgm = ~alpha
        near = np.zeros_like(bgm)
        near[1:] |= bgm[:-1]; near[:-1] |= bgm[1:]; near[:, 1:] |= bgm[:, :-1]; near[:, :-1] |= bgm[:, 1:]
        alpha &= ~(near & light)
    # kapalı beyaz delikler (sandalye bacakları, çit aralığı): köşeye bağlı olmayan beyaz bölgeler
    hole_min = int(os.environ.get('HOLE', '4'))
    if hole_min > 0:
        hole = white_regions((rgb.min(-1) > 225) & alpha, hole_min)
        grow = hole.copy()                       # deliğin açık saçağını da al
        grow[1:] |= hole[:-1]; grow[:-1] |= hole[1:]; grow[:, 1:] |= hole[:, :-1]; grow[:, :-1] |= hole[:, 1:]
        alpha &= ~(hole | (grow & (rgb.min(-1) > 175)))
    alpha[cut_y + 1:, :] = False
    ys, xs = np.where(alpha); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgb, alpha = rgb[y0:y1, x0:x1], alpha[y0:y1, x0:x1]

    lab = srgb_to_lab(rgb.reshape(-1, 3))
    if os.environ.get('PALETTE') == 'own':
        # görselin KENDİ renkleri: sadece sıkıştırma gürültüsünü topla (k-means), renk tonu değişmez
        from cozy_palette import kmeans
        a_lab = lab[alpha.reshape(-1)]
        c, lbl = kmeans(a_lab[::5].copy(), int(os.environ.get('NCOL', '40')))
        sub = rgb.reshape(-1, 3)[alpha.reshape(-1)][::5]
        pal = np.array([sub[lbl == j].mean(0) if (lbl == j).any() else (0, 0, 0) for j in range(len(c))]).round()
        pal_lab = srgb_to_lab(pal)
    # palete eşle (Lab, en yakın)
    idx = np.empty(len(lab), int)
    for s in range(0, len(lab), 65536):
        d = ((lab[s:s + 65536, None, :] - pal_lab[None]) ** 2).sum(-1); idx[s:s + 65536] = d.argmin(1)
    idx = idx.reshape(alpha.shape)

    # blok başına en sık renk
    h, w = alpha.shape; ow, oh = max(1, round(w / scale)), max(1, round(h / scale))
    xb = np.linspace(0, w, ow + 1).round().astype(int); yb = np.linspace(0, h, oh + 1).round().astype(int)
    outp = np.zeros((oh, ow, 4), np.uint8)
    for j in range(oh):
        for i in range(ow):
            a = alpha[yb[j]:yb[j + 1], xb[i]:xb[i + 1]]
            if a.mean() < 0.5: continue
            v = idx[yb[j]:yb[j + 1], xb[i]:xb[i + 1]][a]
            k = np.bincount(v).argmax()
            outp[j, i, :3] = pal[k]; outp[j, i, 3] = 255
    small = Image.fromarray(outp, 'RGBA')
    up = int(os.environ.get('UP', '1'))              # AI'ın kendi ızgarasına indirip tam sayı kat büyütmek için (örn. 2)
    if up > 1: small = small.resize((small.width * up, small.height * up), Image.NEAREST)

    sh = add_shadow(small); sh.save(out); print(out, sh.size)

if __name__ == '__main__':
    a = sys.argv[1:]
    main(a[0], a[1], int(a[2]), float(a[3]), a[4] if len(a) > 4 and a[4].endswith('.json') else os.path.join(HERE, 'cozy_palette.json'))
