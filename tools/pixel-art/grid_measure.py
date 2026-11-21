"""AI görselinin piksel ızgarasını ölçer (clean_ai'ye verilecek küçültme değeri).
Güçlü kenarların (renk sıçramalarının) konumlarını alır; her p periyodu için kenarların
ızgaraya ne kadar oturduğunu (dairesel ortalama) ölçer, en iyi p'yi döner.
Kullanım: python3 grid_measure.py gorsel.png [...]"""
import sys
import numpy as np
from PIL import Image

def grid(path):
    a = np.asarray(Image.open(path).convert('RGB'), float)
    best = []
    for axis in (1, 0):
        d = np.abs(np.diff(a, axis=axis)).sum(-1)
        pos = np.where(d > 90)
        x = (pos[1] if axis == 1 else pos[0]).astype(float) + 0.5
        ps = np.arange(3.0, 12.0, 0.01)
        sc = [abs(np.exp(2j * np.pi * x / p).mean()) for p in ps]
        best.append((ps, np.array(sc)))
    sc = best[0][1] + best[1][1]; ps = best[0][0]
    # en büyük p'de değil, harmoniklerden kaçınmak için skoru en iyinin %85'ini geçen EN BÜYÜK p
    i = np.where(sc > sc.max() * 0.85)[0].max()
    return round(ps[i], 2), round(ps[sc.argmax()], 2)

if __name__ == "__main__":
  for f in sys.argv[1:]:
      print(f.split('/')[-1], *grid(f))
