# Harita asset promptu (Gemini)

Amaç: haritaya giren bütün yapı, doğa ve süs parçalarını **aynı kamera açısıyla ve aynı stille** üretmek. Önceki sette parçalar birbirinden biraz farklı açıdaydı (bazı sohbetler üstten, bazıları önden). Çözüm: açıyı ve stili tek bir sabit bloğa koymak, her sohbette aynı iki referans görseli yüklemek. Bu dosya `docs/tasarim/15-gorsel-stil.md` "Binalar: Gemini ile üretim" bölümünün haritanın tamamına genişletilmiş halidir.

## Her sohbette yüklenecek iki referans

1. **Açı referansı:** `client/Assets/Art/Custom/Buildings/banka.png` (düz önden, çatı hafif üstten).
2. **Stil referansı:** `client/Assets/Art/Custom/Buildings/balikci_gemini.png`.

Referans yüklemeden başlama. Gemini sohbet uzayınca açıyı kaydırır; 3-4 görselden sonra yeni sohbet aç ve referansları tekrar yükle.

## Sabit blok (her promptun başına aynen yapıştır)

```
STYLE LOCK (follow exactly, do not reinterpret):
Camera: straight front view of a top-down RPG. The front face of every object faces the camera flat. The top surface (roof, tabletop, treetop) is seen from slightly above, about 20 degrees. NOT isometric, NOT rotated, NOT three-quarter, NO side walls visible, no perspective convergence. Every object in the sheet uses this same camera.
Look: use the colors, chunky shapes, dark purple-brown wood, red roof tiles and warm mood of the second reference image. The first reference image shows the camera angle and the scale.
TRUE pixel art: every pixel is a hard square of one flat color. No anti-aliasing, no gradients, no blur, no noise, no soft shadows. Limited palette of about 32 colors. 1-pixel dark purple-brown outline around shapes. Light comes from the top-left, shadows fall to the bottom-right inside the sprite only (no cast shadow on the ground).
Background: pure flat white, no ground tile, no grass patch, no text, no labels.
```

## Izgara (sheet) promptu

Birden çok parçayı tek görselde ürettirmek hem istek hem günlük görsel hakkı açısından çok daha ucuzdur; `tools/pixel-art/harita_assets.py` sheet'i otomatik böler (parçalar satır satır, soldan sağa).

```
<SABİT BLOK>

Draw <N> separate objects in ONE image, arranged in <SATIR> rows. Each object is fully surrounded by white space and does not touch or overlap any other object or the image edge. Leave at least 40 pixels of white between objects. Same camera, same scale rule and same style for all of them.
Order, left to right, top to bottom:
1. <NESNE 1>: <kısa detay>
2. <NESNE 2>: <kısa detay>
...
Relative sizes: <ör. the tree is about 3 times taller than the bench>.
```

Kurallar:

- **Boy sınıfına göre grupla.** Bir sheet'te bina ile kova olmasın; Gemini küçük parçayı büyük çizer ve ölçek kayar. Gruplar: yapılar (en çok 2-3), ağaç ve büyük doğa (3-4), orta süs (4-6), küçük süs (8-12).
- **Sheet başına çok parça isteme.** 12'den fazlasında kenar parçalar bozulur. Parça sayısı `harita_assets.py` tablosundaki ad sayısıyla birebir aynı olmalı, yoksa betik durur.
- **Zemine yatan nesneler** (havlu, halı, çiçek tarlası) için cümleyi değiştir: "seen from directly above, flat on the ground". Bunları ayrı bir sheet'e koy, ayakta duran nesnelerle karıştırma.
- **Ayakta duran nesne:** tabanı görünür, taban alt kenarda. Kütük, kaya, fıçı gibi şeylerde alt yüz çizilmez.
- Küçük parçalarda "pixel grid" sayısı verme; betik ızgarayı kendisi ölçer (`grid_measure.py`).

## Sonraki sheet listesi (eksik parçalar)

| Sheet | Parçalar | Not |
|---|---|---|
| `cit` | tahta çit (yatay, dikey, köşe, kapı), taş duvar parçası | Yatay ve dikey için ayrı nesne iste |
| `cicek` | 6 çiçek tarlası ve ot kümesi türü | Zemine yatan değil, ayakta |
| `mobilya` | bank, masa, sandalye, fıçı sırası | Kafe teras parçalarıyla aynı açıda |
| `yol` | taş patika, tahta basamak, köprü, kapı tabelası | Bakış açısı ayakta duran nesne gibi |
| `ev_cesit` | 2 yeni ev, 1 ahır | En çok 3 yapı |

## Kabul kontrolü (görsel indikten sonra)

- Aynı sheet'teki bütün nesneler aynı yönden mi bakıyor? Biri yandan görünüyorsa sheet'i at, baştan iste.
- Çatı ve üst yüzler hep aynı eğimde mi? İzometrik köşe varsa at.
- Beyaz arka plan temiz mi, parçalar birbirine değiyor mu? Değiyorsa betik parça sayısını yanlış bulur.
- Işık hep sol üstten mi?

Geçen sheet'i `tools/pixel-art/ai-src/harita/<ad>.jpg` olarak kaydet, `harita_assets.py` tablosuna satır ekle, `python3 tools/pixel-art/harita_assets.py <ad>` çalıştır.
