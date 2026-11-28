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

## Sonraki sheet listesi (harita v1)

`docs/tasarim/21-harita-v1.md` "Gereken görseller" listesine göre. Her prompt tamdır: kod bloğunu olduğu gibi kopyala, iki referansı yükle. `STYLE LOCK` bloğu yukarıdaki sabit blokla aynıdır; sabit blok değişirse buradakiler de değişir. Betik satırları `tools/pixel-art/harita_assets.py` `ASSETS` tablosuna **Öneri**dir (hedef boylar ilk denemeden sonra ayarlanır); satır, sheet indirilip kabul edilince eklenir. Sheet'te `h`, en uzun parçanın boyudur (oyundaki karakter yaklaşık 48 px).

### Zaten var, yeniden üretme

- **Cepheler:** Mağara girişi (`Nature/magara`), Balıkçı Dükkanı (`Buildings/balikci_gemini`), Atölye (`Buildings/atolye`), Banka (`Buildings/banka`), Kafe (`Cafe/kafe_gemini`).
- **Çit ve teras mobilyası:** `Cafe/Teras/` (çit, masa, sandalye, bank, şemsiye, saksı, fener, menü tahtası). Köy çitleri ve meydan bankları da buradan.
- **Kıyı, plaj ve süs:** `Water/`, `Nature/`, `Props/` (`15-gorsel-stil.md` "Harita seti").

### Gemini ile üretilmeyecekler (kodla çizilir)

`15-gorsel-stil.md` kuralı: yapay zeka görseli tile ve zemin geçişlerinde kullanılmaz, kenarları birbirine oturmaz. Tasarımdaki şu kalemler bu yüzden sheet listesinde yok; `tools/pixel-art/ground.py` yoluyla çizilir (ayrı iş, `acik-sorular.md` 37):

| İhtiyaç | `ground.py`'de durum |
|---|---|
| Taş döşeme ve taş-çimen geçişi | Var (`tas-cimen`, `tas-kum`) |
| Toprak yol ve patika | Var (`cimen-toprak`) |
| Doğal göl kıyısı ve dere | Su ve `kum-su` var; çimen-su geçişi yok |
| İç mekan zeminleri (ahşap, mermer, dans pisti, mağara tabanı) | Yok |
| İç mekan arka duvarları (8 mekan) | Yok |

Sheet'lerde kıyı ve derenin sadece üstüne konan süsleri vardır (`kiyi_dere`).

### Üretim sırası

Tasarımdaki "Sıra" ile aynı: dış harita (`kopru`, `cicek`, `kiyi_dere`, `carsi_tezgah`, `seyir`), ilk mekanlar (`ic_kafe`, `ic_banka`, `ic_balikci`, `ic_kucuk_a`, `ic_kucuk_b`, `ic_yer`), sonra diğer cepheler ve mekanlar. `ic_kucuk_*` ve `ic_yer` ortak sheet'tir; içlerinde sonraki mekanların parçaları da var.

Her mekan 6 orta parça + ortak sheet'lerden 2-5 küçük parça ve halı alır (tasarımdaki 6-12 mobilya).

### Boru hattı notları

`clean_ai.py` ve `harita_assets.py`'nin davranışından; promptlarda karşılığı yazılı, görsel indikten sonra da bak:

- Nesnenin **içindeki beyaza yakın alanlar delik sayılıp silinir** (mermer, ayna, cam, buz, kağıt). Görselde yine de varsa o sheet'i `HOLE=0 python3 tools/pixel-art/harita_assets.py <ad>` ile dene; bu kez sandalye bacağı arası gibi gerçek boşluklar beyaz kalır, kontrol et.
- Renkler ortak cozy palete çekilir. Neon ve kristal sheet'leri (`disko`, `ic_disko`, `ic_magara`, `ic_kucuk_b`) soluk çıkarsa `PALETTE=own` ile karşılaştır.
- Gövdeden kopuk her piksel kümesi **ayrı parça** sayılır ve betik "N parça bulundu" diye durur. Kıvılcım, ışık halesi, buhar istenmez; oyunda efekt olarak eklenir.
- Cepheler **tek tek** üretilir (3 binayı bir görsele koymak çözünürlüğü hedef boyun altına düşürür).

### Dış: yeni cepheler

| Sheet | İçinde | Boy sınıfı | Parça |
|---|---|---|---|
| `disko` | Disko cephesi | Yapı | 1 |
| `muze` | Koleksiyon Müzesi cephesi | Yapı | 1 |
| `terzi` | Terzi cephesi | Yapı | 1 |

#### `disko`: Disko cephesi

Boy sınıfı: Yapı · 1 parça

```
STYLE LOCK (follow exactly, do not reinterpret):
Camera: straight front view of a top-down RPG. The front face of every object faces the camera flat. The top surface (roof, tabletop, treetop) is seen from slightly above, about 20 degrees. NOT isometric, NOT rotated, NOT three-quarter, NO side walls visible, no perspective convergence. Every object in the sheet uses this same camera.
Look: use the colors, chunky shapes, dark purple-brown wood, red roof tiles and warm mood of the second reference image. The first reference image shows the camera angle and the scale.
TRUE pixel art: every pixel is a hard square of one flat color. No anti-aliasing, no gradients, no blur, no noise, no soft shadows. Limited palette of about 32 colors. 1-pixel dark purple-brown outline around shapes. Light comes from the top-left, shadows fall to the bottom-right inside the sprite only (no cast shadow on the ground).
Background: pure flat white, no ground tile, no grass patch, no text, no labels.

Draw ONE building, alone, filling most of the image and not touching its edges.
Building: a night club for the entertainment street: two floors, flat parapet with a row of red roof tiles, a wide double door in the middle with a dark curtain, a big sign board above the door shaped like a music note (no letters), small round windows glowing purple, pink and blue, two lanterns beside the door, a speaker box on each side of the step.
The door is about 1.5 times the height of a character. Same camera as the first reference image.
Accent colors: warm purple, pink and cyan light only in the windows, sign and lanterns; walls and wood stay as in the second reference.
```

Betik satırı:

```python
    'disko': ('Buildings', 250, None),
```

#### `muze`: Koleksiyon Müzesi cephesi

Boy sınıfı: Yapı · 1 parça

```
STYLE LOCK (follow exactly, do not reinterpret):
Camera: straight front view of a top-down RPG. The front face of every object faces the camera flat. The top surface (roof, tabletop, treetop) is seen from slightly above, about 20 degrees. NOT isometric, NOT rotated, NOT three-quarter, NO side walls visible, no perspective convergence. Every object in the sheet uses this same camera.
Look: use the colors, chunky shapes, dark purple-brown wood, red roof tiles and warm mood of the second reference image. The first reference image shows the camera angle and the scale.
TRUE pixel art: every pixel is a hard square of one flat color. No anti-aliasing, no gradients, no blur, no noise, no soft shadows. Limited palette of about 32 colors. 1-pixel dark purple-brown outline around shapes. Light comes from the top-left, shadows fall to the bottom-right inside the sprite only (no cast shadow on the ground).
Background: pure flat white, no ground tile, no grass patch, no text, no labels.

Draw ONE building, alone, filling most of the image and not touching its edges.
Building: a small town museum: symmetrical front, cream stone walls, four wooden columns, a triangular gable with a carved fish emblem (no letters), a tall arched double door in the middle, two tall display windows with a fish statue and a treasure chest behind the glass, red tile roof, two stone steps.
The door is about 1.5 times the height of a character. Same camera as the first reference image.
The stone is cream or light tan, never white.
```

Betik satırı:

```python
    'muze': ('Buildings', 260, None),
```

#### `terzi`: Terzi cephesi

Boy sınıfı: Yapı · 1 parça

```
STYLE LOCK (follow exactly, do not reinterpret):
Camera: straight front view of a top-down RPG. The front face of every object faces the camera flat. The top surface (roof, tabletop, treetop) is seen from slightly above, about 20 degrees. NOT isometric, NOT rotated, NOT three-quarter, NO side walls visible, no perspective convergence. Every object in the sheet uses this same camera.
Look: use the colors, chunky shapes, dark purple-brown wood, red roof tiles and warm mood of the second reference image. The first reference image shows the camera angle and the scale.
TRUE pixel art: every pixel is a hard square of one flat color. No anti-aliasing, no gradients, no blur, no noise, no soft shadows. Limited palette of about 32 colors. 1-pixel dark purple-brown outline around shapes. Light comes from the top-left, shadows fall to the bottom-right inside the sprite only (no cast shadow on the ground).
Background: pure flat white, no ground tile, no grass patch, no text, no labels.

Draw ONE building, alone, filling most of the image and not touching its edges.
Building: a cosy tailor shop: one floor with an attic window, red tile roof, striped teal and cream awning, a large shop window with a dress form wearing a coat and folded fabric rolls, a wooden door on the right, a hanging wooden sign with scissors (no letters).
The door is about 1.5 times the height of a character. Same camera as the first reference image.
The cream stripes are clearly darker than the white background.
```

Betik satırı:

```python
    'terzi': ('Buildings', 200, None),
```

### Dış: süs ve parçalar

| Sheet | İçinde | Boy sınıfı | Parça |
|---|---|---|---|
| `kopru` | Dere köprüleri | Ağaç ve büyük doğa (büyük parça) | 3 |
| `carsi_tezgah` | Çarşı tenteleri ve tezgah sırası | Orta süs | 6 |
| `seyir` | Seyir Tepesi | Orta süs | 4 |
| `cicek` | Çiçek ve ot kümeleri | Küçük süs | 10 |
| `kiyi_dere` | Göl kıyısı ve dere süsleri | Küçük süs | 8 |

#### `kopru`: Dere köprüleri

Boy sınıfı: Ağaç ve büyük doğa (büyük parça) · 3 parça · Ön korkuluk ayrı parça: karakterin önünde çizilir (`Above`).

```
STYLE LOCK (follow exactly, do not reinterpret):
Camera: straight front view of a top-down RPG. The front face of every object faces the camera flat. The top surface (roof, tabletop, treetop) is seen from slightly above, about 20 degrees. NOT isometric, NOT rotated, NOT three-quarter, NO side walls visible, no perspective convergence. Every object in the sheet uses this same camera.
Look: use the colors, chunky shapes, dark purple-brown wood, red roof tiles and warm mood of the second reference image. The first reference image shows the camera angle and the scale.
TRUE pixel art: every pixel is a hard square of one flat color. No anti-aliasing, no gradients, no blur, no noise, no soft shadows. Limited palette of about 32 colors. 1-pixel dark purple-brown outline around shapes. Light comes from the top-left, shadows fall to the bottom-right inside the sprite only (no cast shadow on the ground).
Background: pure flat white, no ground tile, no grass patch, no text, no labels.

Draw 3 separate objects in ONE image, arranged in 1 row. Each object is fully surrounded by white space and does not touch or overlap any other object or the image edge. Leave at least 40 pixels of white between objects. Same camera, same scale rule and same style for all of them. In each row the bottom edges of the objects are on the same line.
Each object is one single connected shape: no loose bits, sparks, particles or parts floating next to it. No pure white or near-white areas inside any object.
Order, left to right, top to bottom:
1. small flat wooden footbridge walked from left to right: plank deck seen from slightly above, a low railing only along the far (back) edge
2. the same footbridge walked from top to bottom: plank deck with a low post-and-rope railing along the left and right edges
3. only the near (front) railing of the first bridge, as long as that bridge, drawn alone
Relative sizes: Both decks are 2 character-widths wide. The vertical bridge is the tallest object; the front railing is as wide as the first bridge and very low.
```

Betik satırı:

```python
    'kopru': ('Water', 128, ['kopru_yatay', 'kopru_dikey', 'kopru_korkuluk']),
```

#### `carsi_tezgah`: Çarşı tenteleri ve tezgah sırası

Boy sınıfı: Orta süs · 6 parça

```
STYLE LOCK (follow exactly, do not reinterpret):
Camera: straight front view of a top-down RPG. The front face of every object faces the camera flat. The top surface (roof, tabletop, treetop) is seen from slightly above, about 20 degrees. NOT isometric, NOT rotated, NOT three-quarter, NO side walls visible, no perspective convergence. Every object in the sheet uses this same camera.
Look: use the colors, chunky shapes, dark purple-brown wood, red roof tiles and warm mood of the second reference image. The first reference image shows the camera angle and the scale.
TRUE pixel art: every pixel is a hard square of one flat color. No anti-aliasing, no gradients, no blur, no noise, no soft shadows. Limited palette of about 32 colors. 1-pixel dark purple-brown outline around shapes. Light comes from the top-left, shadows fall to the bottom-right inside the sprite only (no cast shadow on the ground).
Background: pure flat white, no ground tile, no grass patch, no text, no labels.

Draw 6 separate objects in ONE image, arranged in 2 rows. Each object is fully surrounded by white space and does not touch or overlap any other object or the image edge. Leave at least 40 pixels of white between objects. Same camera, same scale rule and same style for all of them. In each row the bottom edges of the objects are on the same line.
Each object is one single connected shape: no loose bits, sparks, particles or parts floating next to it. No pure white or near-white areas inside any object.
Order, left to right, top to bottom:
1. empty market stall: wooden counter under a red and cream striped awning on two posts
2. the same stall with a blue and cream striped awning
3. the same stall with a green and cream striped awning
4. a long low wooden market table twice as wide as a stall, with a plain cloth, no awning
5. two wooden posts joined by a sagging rope with small colorful triangle flags, all one connected object
6. a tilted wooden display rack with three shallow crates, empty
Relative sizes: The three stalls are exactly the same size and are the tallest objects. The long table and the rack are about half as tall.
```

Betik satırı:

```python
    'carsi_tezgah': ('Plaza', 120, ['tente_kirmizi', 'tente_mavi', 'tente_yesil', 'tezgah_uzun', 'flama_direk', 'sergi_kasasi']),
```

#### `seyir`: Seyir Tepesi

Boy sınıfı: Orta süs · 4 parça · Oturan oyuncu için bankın koltuğu önden görünmeli.

```
STYLE LOCK (follow exactly, do not reinterpret):
Camera: straight front view of a top-down RPG. The front face of every object faces the camera flat. The top surface (roof, tabletop, treetop) is seen from slightly above, about 20 degrees. NOT isometric, NOT rotated, NOT three-quarter, NO side walls visible, no perspective convergence. Every object in the sheet uses this same camera.
Look: use the colors, chunky shapes, dark purple-brown wood, red roof tiles and warm mood of the second reference image. The first reference image shows the camera angle and the scale.
TRUE pixel art: every pixel is a hard square of one flat color. No anti-aliasing, no gradients, no blur, no noise, no soft shadows. Limited palette of about 32 colors. 1-pixel dark purple-brown outline around shapes. Light comes from the top-left, shadows fall to the bottom-right inside the sprite only (no cast shadow on the ground).
Background: pure flat white, no ground tile, no grass patch, no text, no labels.

Draw 4 separate objects in ONE image, arranged in 1 row. Each object is fully surrounded by white space and does not touch or overlap any other object or the image edge. Leave at least 40 pixels of white between objects. Same camera, same scale rule and same style for all of them. In each row the bottom edges of the objects are on the same line.
Each object is one single connected shape: no loose bits, sparks, particles or parts floating next to it. No pure white or near-white areas inside any object.
Order, left to right, top to bottom:
1. a wide wooden bench with a backrest, seen from the front
2. a brass coin telescope on an iron post with a small stone base
3. a short section of wooden safety railing with two thick posts
4. a tilted wooden information board on two short legs with a painted lake picture, no letters
Relative sizes: The telescope is the tallest, about as tall as a person. The bench and railing are about half as tall.
```

Betik satırı:

```python
    'seyir': ('Props', 72, ['seyir_banki', 'durbun', 'seyir_korkuluk', 'manzara_levhasi']),
```

#### `cicek`: Çiçek ve ot kümeleri

Boy sınıfı: Küçük süs · 10 parça

```
STYLE LOCK (follow exactly, do not reinterpret):
Camera: straight front view of a top-down RPG. The front face of every object faces the camera flat. The top surface (roof, tabletop, treetop) is seen from slightly above, about 20 degrees. NOT isometric, NOT rotated, NOT three-quarter, NO side walls visible, no perspective convergence. Every object in the sheet uses this same camera.
Look: use the colors, chunky shapes, dark purple-brown wood, red roof tiles and warm mood of the second reference image. The first reference image shows the camera angle and the scale.
TRUE pixel art: every pixel is a hard square of one flat color. No anti-aliasing, no gradients, no blur, no noise, no soft shadows. Limited palette of about 32 colors. 1-pixel dark purple-brown outline around shapes. Light comes from the top-left, shadows fall to the bottom-right inside the sprite only (no cast shadow on the ground).
Background: pure flat white, no ground tile, no grass patch, no text, no labels.

Draw 10 separate objects in ONE image, arranged in 3 rows. Each object is fully surrounded by white space and does not touch or overlap any other object or the image edge. Leave at least 40 pixels of white between objects. Same camera, same scale rule and same style for all of them. In each row the bottom edges of the objects are on the same line.
Each object is one single connected shape: no loose bits, sparks, particles or parts floating next to it. No pure white or near-white areas inside any object.
Every clump stands upright (not lying flat) and grows from one solid connected leafy base: no loose petals, leaves or flowers floating apart.
Order, left to right, top to bottom:
1. clump of yellow-centred daisies with pale yellow petals
2. clump of red poppies
3. clump of purple lavender
4. clump of round yellow flowers
5. clump of small blue flowers
6. clump of pink tulips
7. short round grass tuft
8. tall grass tuft
9. dry yellow grass tuft
10. small fern
Relative sizes: The tall grass is the tallest; the short tuft is half of it.
```

Betik satırı:

```python
    'cicek': ('Nature', 40, ['cicek_papatya', 'cicek_gelincik', 'cicek_lavanta', 'cicek_sari', 'cicek_mavi', 'cicek_pembe', 'ot_kisa', 'ot_uzun', 'ot_kuru', 'egrelti']),
```

#### `kiyi_dere`: Göl kıyısı ve dere süsleri

Boy sınıfı: Küçük süs · 8 parça · Var olan `saz`, `nilufer`, `kiyi_taslari`, `uzun_cimen`, `kaya_buyuk` parçalarını tamamlar.

```
STYLE LOCK (follow exactly, do not reinterpret):
Camera: straight front view of a top-down RPG. The front face of every object faces the camera flat. The top surface (roof, tabletop, treetop) is seen from slightly above, about 20 degrees. NOT isometric, NOT rotated, NOT three-quarter, NO side walls visible, no perspective convergence. Every object in the sheet uses this same camera.
Look: use the colors, chunky shapes, dark purple-brown wood, red roof tiles and warm mood of the second reference image. The first reference image shows the camera angle and the scale.
TRUE pixel art: every pixel is a hard square of one flat color. No anti-aliasing, no gradients, no blur, no noise, no soft shadows. Limited palette of about 32 colors. 1-pixel dark purple-brown outline around shapes. Light comes from the top-left, shadows fall to the bottom-right inside the sprite only (no cast shadow on the ground).
Background: pure flat white, no ground tile, no grass patch, no text, no labels.

Draw 8 separate objects in ONE image, arranged in 2 rows. Each object is fully surrounded by white space and does not touch or overlap any other object or the image edge. Leave at least 40 pixels of white between objects. Same camera, same scale rule and same style for all of them. In each row the bottom edges of the objects are on the same line.
Each object is one single connected shape: no loose bits, sparks, particles or parts floating next to it. No pure white or near-white areas inside any object.
Order, left to right, top to bottom:
1. one flat stepping stone
2. a rounded wet boulder
3. a rock covered with green moss
4. a tight pile of pebbles, all touching
5. a bleached driftwood branch, one connected piece
6. a mooring post stump with a coiled rope
7. a lily pad with a pink flower
8. a frog sitting on a lily pad
Relative sizes: The mooring post is the tallest. The stepping stone is the flattest.
```

Betik satırı:

```python
    'kiyi_dere': ('Water', 40, ['dere_tasi', 'dere_kayasi', 'yosunlu_kaya', 'cakil_obegi', 'yatik_dal', 'kiyi_kutugu', 'nilufer_cicekli', 'kurbaga']),
```

### İç mekanlar

Açı dışarıyla aynıdır: düz önden, üst yüzeyler hafif üstten, yan duvar görünmez. Duvar ve zemin sheet'lere çizdirilmez. İki referans görsel aynı kalır.

| Sheet | İçinde | Boy sınıfı | Parça |
|---|---|---|---|
| `ic_kafe` | Kafe içi | Orta süs | 6 |
| `ic_banka` | Banka içi | Orta süs | 6 |
| `ic_balikci` | Balıkçı Dükkanı içi | Orta süs | 6 |
| `ic_disko` | Disko içi | Orta süs | 6 |
| `ic_atolye` | Atölye içi | Orta süs | 6 |
| `ic_terzi` | Terzi içi | Orta süs | 6 |
| `ic_muze` | Koleksiyon Müzesi içi | Orta süs | 6 |
| `ic_magara` | Mağara içi | Orta süs | 6 |
| `ic_kucuk_a` | Küçük iç süsler: Kafe, Banka, Terzi, Müze | Küçük süs | 10 |
| `ic_kucuk_b` | Küçük iç süsler: Balıkçı, Disko, Atölye, Mağara | Küçük süs | 10 |
| `ic_yer` | Halı ve paspaslar | Zemine yatan | 8 |

#### `ic_kafe`: Kafe içi

Boy sınıfı: Orta süs · 6 parça · Masa, sandalye, saksı ve menü tahtası `Cafe/Teras`'tan kullanılır.

```
STYLE LOCK (follow exactly, do not reinterpret):
Camera: straight front view of a top-down RPG. The front face of every object faces the camera flat. The top surface (roof, tabletop, treetop) is seen from slightly above, about 20 degrees. NOT isometric, NOT rotated, NOT three-quarter, NO side walls visible, no perspective convergence. Every object in the sheet uses this same camera.
Look: use the colors, chunky shapes, dark purple-brown wood, red roof tiles and warm mood of the second reference image. The first reference image shows the camera angle and the scale.
TRUE pixel art: every pixel is a hard square of one flat color. No anti-aliasing, no gradients, no blur, no noise, no soft shadows. Limited palette of about 32 colors. 1-pixel dark purple-brown outline around shapes. Light comes from the top-left, shadows fall to the bottom-right inside the sprite only (no cast shadow on the ground).
Background: pure flat white, no ground tile, no grass patch, no text, no labels.

Draw 6 separate objects in ONE image, arranged in 2 rows. Each object is fully surrounded by white space and does not touch or overlap any other object or the image edge. Leave at least 40 pixels of white between objects. Same camera, same scale rule and same style for all of them. In each row the bottom edges of the objects are on the same line.
Each object is one single connected shape: no loose bits, sparks, particles or parts floating next to it. No pure white or near-white areas inside any object.
These are indoor furniture pieces for a room whose back wall faces the camera. Every piece faces the camera flat. Do not draw any wall or floor.
Order, left to right, top to bottom:
1. wooden café counter with a glass cake display
2. a copper coffee machine standing on a low cabinet
3. tall wooden shelf with cups, jars and coffee sacks
4. brick fireplace with a small calm fire
5. soft two-seat sofa with a warm red cover, front view
6. wide wall-mounted chalkboard with small coffee drawings, no letters
Relative sizes: The shelf is the tallest, about twice a person. The counter is the widest and chest high. The sofa is waist high.
```

Betik satırı:

```python
    'ic_kafe': ('Interiors/Cafe', 96, ['kafe_bar', 'kafe_espresso', 'kafe_raf', 'kafe_somine', 'kafe_koltuk', 'kafe_menu_panosu']),
```

#### `ic_banka`: Banka içi

Boy sınıfı: Orta süs · 6 parça

```
STYLE LOCK (follow exactly, do not reinterpret):
Camera: straight front view of a top-down RPG. The front face of every object faces the camera flat. The top surface (roof, tabletop, treetop) is seen from slightly above, about 20 degrees. NOT isometric, NOT rotated, NOT three-quarter, NO side walls visible, no perspective convergence. Every object in the sheet uses this same camera.
Look: use the colors, chunky shapes, dark purple-brown wood, red roof tiles and warm mood of the second reference image. The first reference image shows the camera angle and the scale.
TRUE pixel art: every pixel is a hard square of one flat color. No anti-aliasing, no gradients, no blur, no noise, no soft shadows. Limited palette of about 32 colors. 1-pixel dark purple-brown outline around shapes. Light comes from the top-left, shadows fall to the bottom-right inside the sprite only (no cast shadow on the ground).
Background: pure flat white, no ground tile, no grass patch, no text, no labels.

Draw 6 separate objects in ONE image, arranged in 2 rows. Each object is fully surrounded by white space and does not touch or overlap any other object or the image edge. Leave at least 40 pixels of white between objects. Same camera, same scale rule and same style for all of them. In each row the bottom edges of the objects are on the same line.
Each object is one single connected shape: no loose bits, sparks, particles or parts floating next to it. No pure white or near-white areas inside any object.
These are indoor furniture pieces for a room whose back wall faces the camera. Every piece faces the camera flat. Do not draw any wall or floor.
Marble and stone are cream or light grey, clearly darker than the white background.
Order, left to right, top to bottom:
1. dark wood teller counter with a brass bar window
2. big round iron vault door in a thick square frame
3. cabinet made of many small numbered-looking metal deposit boxes, no digits
4. cream stone column with a simple base and top
5. dark wood waiting bench with a green leather seat, front view
6. two brass posts joined by a red rope, one connected object
Relative sizes: The column is the tallest. The vault door is a little taller than a person. The counter is chest high, the bench and rope posts waist high.
```

Betik satırı:

```python
    'ic_banka': ('Interiors/Bank', 112, ['banka_gise', 'banka_kasa', 'banka_emanet_dolabi', 'banka_sutun', 'banka_bekleme_banki', 'banka_sira_direkleri']),
```

#### `ic_balikci`: Balıkçı Dükkanı içi

Boy sınıfı: Orta süs · 6 parça

```
STYLE LOCK (follow exactly, do not reinterpret):
Camera: straight front view of a top-down RPG. The front face of every object faces the camera flat. The top surface (roof, tabletop, treetop) is seen from slightly above, about 20 degrees. NOT isometric, NOT rotated, NOT three-quarter, NO side walls visible, no perspective convergence. Every object in the sheet uses this same camera.
Look: use the colors, chunky shapes, dark purple-brown wood, red roof tiles and warm mood of the second reference image. The first reference image shows the camera angle and the scale.
TRUE pixel art: every pixel is a hard square of one flat color. No anti-aliasing, no gradients, no blur, no noise, no soft shadows. Limited palette of about 32 colors. 1-pixel dark purple-brown outline around shapes. Light comes from the top-left, shadows fall to the bottom-right inside the sprite only (no cast shadow on the ground).
Background: pure flat white, no ground tile, no grass patch, no text, no labels.

Draw 6 separate objects in ONE image, arranged in 2 rows. Each object is fully surrounded by white space and does not touch or overlap any other object or the image edge. Leave at least 40 pixels of white between objects. Same camera, same scale rule and same style for all of them. In each row the bottom edges of the objects are on the same line.
Each object is one single connected shape: no loose bits, sparks, particles or parts floating next to it. No pure white or near-white areas inside any object.
These are indoor furniture pieces for a room whose back wall faces the camera. Every piece faces the camera flat. Do not draw any wall or floor.
The ice is blue-grey, never white. Fishing lines touch the rods.
Order, left to right, top to bottom:
1. weathered wooden shop counter with a small brass scale on it
2. wooden rack holding several fishing rods upright
3. slanted fish display table with fresh fish on blue-grey ice
4. open shelf with bait jars and tackle boxes
5. fishing net with floats hanging from a wooden beam, one connected object
6. small fish tank on a wooden stand
Relative sizes: The rod rack is the tallest, about twice a person. The counter and fish table are waist to chest high.
```

Betik satırı:

```python
    'ic_balikci': ('Interiors/TackleShop', 96, ['balikci_tezgah', 'balikci_olta_standi', 'balikci_balik_tezgahi', 'balikci_yem_dolabi', 'balikci_ag_askisi', 'balikci_akvaryum']),
```

#### `ic_disko`: Disko içi

Boy sınıfı: Orta süs · 6 parça

```
STYLE LOCK (follow exactly, do not reinterpret):
Camera: straight front view of a top-down RPG. The front face of every object faces the camera flat. The top surface (roof, tabletop, treetop) is seen from slightly above, about 20 degrees. NOT isometric, NOT rotated, NOT three-quarter, NO side walls visible, no perspective convergence. Every object in the sheet uses this same camera.
Look: use the colors, chunky shapes, dark purple-brown wood, red roof tiles and warm mood of the second reference image. The first reference image shows the camera angle and the scale.
TRUE pixel art: every pixel is a hard square of one flat color. No anti-aliasing, no gradients, no blur, no noise, no soft shadows. Limited palette of about 32 colors. 1-pixel dark purple-brown outline around shapes. Light comes from the top-left, shadows fall to the bottom-right inside the sprite only (no cast shadow on the ground).
Background: pure flat white, no ground tile, no grass patch, no text, no labels.

Draw 6 separate objects in ONE image, arranged in 2 rows. Each object is fully surrounded by white space and does not touch or overlap any other object or the image edge. Leave at least 40 pixels of white between objects. Same camera, same scale rule and same style for all of them. In each row the bottom edges of the objects are on the same line.
Each object is one single connected shape: no loose bits, sparks, particles or parts floating next to it. No pure white or near-white areas inside any object.
These are indoor furniture pieces for a room whose back wall faces the camera. Every piece faces the camera flat. Do not draw any wall or floor.
Accent colors: strong purple, magenta and cyan. No light beams, glow or sparkles around the objects. The mirror ball uses blue-grey squares, never white.
Order, left to right, top to bottom:
1. DJ booth with two turntables and a front panel with colored squares
2. tall stack of two big black speakers
3. dark bar counter with a glowing purple front strip and bottles on top
4. curved low purple velvet sofa, front view
5. floor stand holding three colored stage lamps, no light beams
6. mirror ball hanging from a short chain and ceiling bar
Relative sizes: The speaker stack and the light stand are the tallest. The booth is the widest. The sofa is low.
```

Betik satırı:

```python
    'ic_disko': ('Interiors/Disco', 96, ['disko_dj_kabini', 'disko_hoparlor', 'disko_bar', 'disko_koltuk', 'disko_isik_direk', 'disko_top']),
```

#### `ic_atolye`: Atölye içi

Boy sınıfı: Orta süs · 6 parça

```
STYLE LOCK (follow exactly, do not reinterpret):
Camera: straight front view of a top-down RPG. The front face of every object faces the camera flat. The top surface (roof, tabletop, treetop) is seen from slightly above, about 20 degrees. NOT isometric, NOT rotated, NOT three-quarter, NO side walls visible, no perspective convergence. Every object in the sheet uses this same camera.
Look: use the colors, chunky shapes, dark purple-brown wood, red roof tiles and warm mood of the second reference image. The first reference image shows the camera angle and the scale.
TRUE pixel art: every pixel is a hard square of one flat color. No anti-aliasing, no gradients, no blur, no noise, no soft shadows. Limited palette of about 32 colors. 1-pixel dark purple-brown outline around shapes. Light comes from the top-left, shadows fall to the bottom-right inside the sprite only (no cast shadow on the ground).
Background: pure flat white, no ground tile, no grass patch, no text, no labels.

Draw 6 separate objects in ONE image, arranged in 2 rows. Each object is fully surrounded by white space and does not touch or overlap any other object or the image edge. Leave at least 40 pixels of white between objects. Same camera, same scale rule and same style for all of them. In each row the bottom edges of the objects are on the same line.
Each object is one single connected shape: no loose bits, sparks, particles or parts floating next to it. No pure white or near-white areas inside any object.
These are indoor furniture pieces for a room whose back wall faces the camera. Every piece faces the camera flat. Do not draw any wall or floor.
No flying sparks or smoke.
Order, left to right, top to bottom:
1. heavy wooden workbench with a vise and a half-made lure
2. wooden tool board with hammers, saws and pliers hanging on it
3. small brick forge with glowing coals and a chimney hood
4. iron anvil on a tree stump
5. round crafting table with a brass ring and three small hollows on top
6. shelf with wood planks, metal bars and jars
Relative sizes: The forge with its hood is the tallest. The anvil is knee to waist high, the tables waist high.
```

Betik satırı:

```python
    'ic_atolye': ('Interiors/Workshop', 96, ['atolye_tezgah', 'atolye_alet_duvari', 'atolye_ocak', 'atolye_ors', 'atolye_birlestirme_masasi', 'atolye_malzeme_rafi']),
```

#### `ic_terzi`: Terzi içi

Boy sınıfı: Orta süs · 6 parça

```
STYLE LOCK (follow exactly, do not reinterpret):
Camera: straight front view of a top-down RPG. The front face of every object faces the camera flat. The top surface (roof, tabletop, treetop) is seen from slightly above, about 20 degrees. NOT isometric, NOT rotated, NOT three-quarter, NO side walls visible, no perspective convergence. Every object in the sheet uses this same camera.
Look: use the colors, chunky shapes, dark purple-brown wood, red roof tiles and warm mood of the second reference image. The first reference image shows the camera angle and the scale.
TRUE pixel art: every pixel is a hard square of one flat color. No anti-aliasing, no gradients, no blur, no noise, no soft shadows. Limited palette of about 32 colors. 1-pixel dark purple-brown outline around shapes. Light comes from the top-left, shadows fall to the bottom-right inside the sprite only (no cast shadow on the ground).
Background: pure flat white, no ground tile, no grass patch, no text, no labels.

Draw 6 separate objects in ONE image, arranged in 2 rows. Each object is fully surrounded by white space and does not touch or overlap any other object or the image edge. Leave at least 40 pixels of white between objects. Same camera, same scale rule and same style for all of them. In each row the bottom edges of the objects are on the same line.
Each object is one single connected shape: no loose bits, sparks, particles or parts floating next to it. No pure white or near-white areas inside any object.
These are indoor furniture pieces for a room whose back wall faces the camera. Every piece faces the camera flat. Do not draw any wall or floor.
The mirror glass is pale blue-grey, never white.
Order, left to right, top to bottom:
1. fitting booth with a wooden frame and a closed deep red curtain
2. tall standing mirror in a wooden frame with pale blue-grey glass
3. shelf filled with fabric rolls in many colors
4. dress form on a stand wearing a half-sewn coat
5. sewing table with an old black sewing machine
6. clothes rail with several hanging outfits
Relative sizes: The booth is the tallest, about twice a person. The sewing table is waist high.
```

Betik satırı:

```python
    'ic_terzi': ('Interiors/Tailor', 96, ['terzi_prova_kabini', 'terzi_boy_aynasi', 'terzi_kumas_rafi', 'terzi_manken', 'terzi_dikis_masasi', 'terzi_askilik']),
```

#### `ic_muze`: Koleksiyon Müzesi içi

Boy sınıfı: Orta süs · 6 parça · Vitrinler boş: içindeki eşyayı oyun çizer.

```
STYLE LOCK (follow exactly, do not reinterpret):
Camera: straight front view of a top-down RPG. The front face of every object faces the camera flat. The top surface (roof, tabletop, treetop) is seen from slightly above, about 20 degrees. NOT isometric, NOT rotated, NOT three-quarter, NO side walls visible, no perspective convergence. Every object in the sheet uses this same camera.
Look: use the colors, chunky shapes, dark purple-brown wood, red roof tiles and warm mood of the second reference image. The first reference image shows the camera angle and the scale.
TRUE pixel art: every pixel is a hard square of one flat color. No anti-aliasing, no gradients, no blur, no noise, no soft shadows. Limited palette of about 32 colors. 1-pixel dark purple-brown outline around shapes. Light comes from the top-left, shadows fall to the bottom-right inside the sprite only (no cast shadow on the ground).
Background: pure flat white, no ground tile, no grass patch, no text, no labels.

Draw 6 separate objects in ONE image, arranged in 2 rows. Each object is fully surrounded by white space and does not touch or overlap any other object or the image edge. Leave at least 40 pixels of white between objects. Same camera, same scale rule and same style for all of them. In each row the bottom edges of the objects are on the same line.
Each object is one single connected shape: no loose bits, sparks, particles or parts floating next to it. No pure white or near-white areas inside any object.
These are indoor furniture pieces for a room whose back wall faces the camera. Every piece faces the camera flat. Do not draw any wall or floor.
Glass is pale blue-grey, never white. Bones are warm beige, never white.
Order, left to right, top to bottom:
1. wide glass display case on a dark wood base, empty inside
2. tall narrow glass display case, empty inside
3. short stone pedestal with a flat empty top
4. big fish skeleton mounted on a wooden stand
5. large framed painting of a lake, wall-mounted
6. long backless bench with a red velvet seat, front view
Relative sizes: The narrow case is the tallest. The pedestal and bench are knee to waist high.
```

Betik satırı:

```python
    'ic_muze': ('Interiors/Museum', 96, ['muze_vitrin_uzun', 'muze_vitrin_dar', 'muze_kaide', 'muze_balik_iskeleti', 'muze_tablo', 'muze_bank']),
```

#### `ic_magara`: Mağara içi

Boy sınıfı: Orta süs · 6 parça

```
STYLE LOCK (follow exactly, do not reinterpret):
Camera: straight front view of a top-down RPG. The front face of every object faces the camera flat. The top surface (roof, tabletop, treetop) is seen from slightly above, about 20 degrees. NOT isometric, NOT rotated, NOT three-quarter, NO side walls visible, no perspective convergence. Every object in the sheet uses this same camera.
Look: use the colors, chunky shapes, dark purple-brown wood, red roof tiles and warm mood of the second reference image. The first reference image shows the camera angle and the scale.
TRUE pixel art: every pixel is a hard square of one flat color. No anti-aliasing, no gradients, no blur, no noise, no soft shadows. Limited palette of about 32 colors. 1-pixel dark purple-brown outline around shapes. Light comes from the top-left, shadows fall to the bottom-right inside the sprite only (no cast shadow on the ground).
Background: pure flat white, no ground tile, no grass patch, no text, no labels.

Draw 6 separate objects in ONE image, arranged in 2 rows. Each object is fully surrounded by white space and does not touch or overlap any other object or the image edge. Leave at least 40 pixels of white between objects. Same camera, same scale rule and same style for all of them. In each row the bottom edges of the objects are on the same line.
Each object is one single connected shape: no loose bits, sparks, particles or parts floating next to it. No pure white or near-white areas inside any object.
These are indoor furniture pieces for a room whose back wall faces the camera. Every piece faces the camera flat. Do not draw any wall or floor.
Cool dark grey-purple rock with blue and cyan crystals. No glow halo, mist or sparkles around the objects.
Order, left to right, top to bottom:
1. large cluster of glowing blue crystals growing from a rock base
2. small cluster of blue-violet crystals on a rock base
3. tall pointed stalagmite
4. thick natural rock pillar
5. flat-topped low rock that a person can sit on
6. old half-rotten wooden chest with an iron band, closed
Relative sizes: The pillar is the tallest. The sitting rock is knee high.
```

Betik satırı:

```python
    'ic_magara': ('Interiors/Cave', 96, ['magara_kristal_buyuk', 'magara_kristal_kucuk', 'magara_dikit', 'magara_kaya_sutun', 'magara_kaya_oturak', 'magara_eski_sandik']),
```

#### `ic_kucuk_a`: Küçük iç süsler: Kafe, Banka, Terzi, Müze

Boy sınıfı: Küçük süs · 10 parça

```
STYLE LOCK (follow exactly, do not reinterpret):
Camera: straight front view of a top-down RPG. The front face of every object faces the camera flat. The top surface (roof, tabletop, treetop) is seen from slightly above, about 20 degrees. NOT isometric, NOT rotated, NOT three-quarter, NO side walls visible, no perspective convergence. Every object in the sheet uses this same camera.
Look: use the colors, chunky shapes, dark purple-brown wood, red roof tiles and warm mood of the second reference image. The first reference image shows the camera angle and the scale.
TRUE pixel art: every pixel is a hard square of one flat color. No anti-aliasing, no gradients, no blur, no noise, no soft shadows. Limited palette of about 32 colors. 1-pixel dark purple-brown outline around shapes. Light comes from the top-left, shadows fall to the bottom-right inside the sprite only (no cast shadow on the ground).
Background: pure flat white, no ground tile, no grass patch, no text, no labels.

Draw 10 separate objects in ONE image, arranged in 3 rows. Each object is fully surrounded by white space and does not touch or overlap any other object or the image edge. Leave at least 40 pixels of white between objects. Same camera, same scale rule and same style for all of them. In each row the bottom edges of the objects are on the same line.
Each object is one single connected shape: no loose bits, sparks, particles or parts floating next to it. No pure white or near-white areas inside any object.
These are indoor furniture pieces for a room whose back wall faces the camera. Every piece faces the camera flat. Do not draw any wall or floor.
Paper and clock face are warm cream, never white. No steam.
Order, left to right, top to bottom:
1. cake on a wooden cake stand
2. tray with two coffee cups and a pot
3. floor lamp with a warm orange shade
4. two tied coin sacks leaning on each other
5. round wall clock with a wooden frame
6. small high writing desk with paper and an ink pot
7. three fabric rolls stacked and touching
8. basket with thread spools and scissors
9. brass spotlight on a short floor stand, no light beam
10. small slanted label stand, no letters
Relative sizes: The floor lamp is the tallest, about as tall as a person. The tray and the sack are small, below knee height.
```

Betik satırı:

```python
    'ic_kucuk_a': ('Interiors/Common', 52, ['kafe_pasta_standi', 'kafe_fincan_tepsisi', 'kafe_abajur', 'banka_para_kesesi', 'banka_saat', 'banka_evrak_masasi', 'terzi_kumas_topu', 'terzi_dikis_sepeti', 'muze_isik', 'muze_bilgi_levhasi']),
```

#### `ic_kucuk_b`: Küçük iç süsler: Balıkçı, Disko, Atölye, Mağara

Boy sınıfı: Küçük süs · 10 parça

```
STYLE LOCK (follow exactly, do not reinterpret):
Camera: straight front view of a top-down RPG. The front face of every object faces the camera flat. The top surface (roof, tabletop, treetop) is seen from slightly above, about 20 degrees. NOT isometric, NOT rotated, NOT three-quarter, NO side walls visible, no perspective convergence. Every object in the sheet uses this same camera.
Look: use the colors, chunky shapes, dark purple-brown wood, red roof tiles and warm mood of the second reference image. The first reference image shows the camera angle and the scale.
TRUE pixel art: every pixel is a hard square of one flat color. No anti-aliasing, no gradients, no blur, no noise, no soft shadows. Limited palette of about 32 colors. 1-pixel dark purple-brown outline around shapes. Light comes from the top-left, shadows fall to the bottom-right inside the sprite only (no cast shadow on the ground).
Background: pure flat white, no ground tile, no grass patch, no text, no labels.

Draw 10 separate objects in ONE image, arranged in 3 rows. Each object is fully surrounded by white space and does not touch or overlap any other object or the image edge. Leave at least 40 pixels of white between objects. Same camera, same scale rule and same style for all of them. In each row the bottom edges of the objects are on the same line.
Each object is one single connected shape: no loose bits, sparks, particles or parts floating next to it. No pure white or near-white areas inside any object.
These are indoor furniture pieces for a room whose back wall faces the camera. Every piece faces the camera flat. Do not draw any wall or floor.
No glow halo or sparkles around the objects.
Order, left to right, top to bottom:
1. wooden bucket with fish tails sticking out
2. crate with fishing reels and floats
3. ship wheel on a small wooden stand
4. small round high bar table with two drinks
5. round bar stool with a purple seat
6. open wooden toolbox
7. grinding wheel on a wooden frame
8. iron work lantern on a short post
9. clump of glowing blue mushrooms on one rock base
10. pickaxe leaning against a small rock, touching it
Relative sizes: The lantern and the high table are the tallest, about chest high. The bucket and toolbox are knee high.
```

Betik satırı:

```python
    'ic_kucuk_b': ('Interiors/Common', 52, ['balikci_kova', 'balikci_olta_makarasi', 'balikci_dumen', 'disko_yuksek_masa', 'disko_tabure', 'atolye_alet_kutusu', 'atolye_cark', 'atolye_fener', 'magara_mantar', 'magara_kazma']),
```

#### `ic_yer`: Halı ve paspaslar

Boy sınıfı: Zemine yatan · 8 parça · `Detail` katmanına konur, çarpışması yoktur. Betik her parçaya sağ alt gölge ekler; halıda kötü durursa gölge kapatma betiğe ayrı iş olarak eklenir.

```
STYLE LOCK (follow exactly, do not reinterpret):
Camera: straight front view of a top-down RPG. The front face of every object faces the camera flat. The top surface (roof, tabletop, treetop) is seen from slightly above, about 20 degrees. NOT isometric, NOT rotated, NOT three-quarter, NO side walls visible, no perspective convergence. Every object in the sheet uses this same camera.
Look: use the colors, chunky shapes, dark purple-brown wood, red roof tiles and warm mood of the second reference image. The first reference image shows the camera angle and the scale.
TRUE pixel art: every pixel is a hard square of one flat color. No anti-aliasing, no gradients, no blur, no noise, no soft shadows. Limited palette of about 32 colors. 1-pixel dark purple-brown outline around shapes. Light comes from the top-left, shadows fall to the bottom-right inside the sprite only (no cast shadow on the ground).
Background: pure flat white, no ground tile, no grass patch, no text, no labels.

Draw 8 separate objects in ONE image, arranged in 2 rows. Each object is fully surrounded by white space and does not touch or overlap any other object or the image edge. Leave at least 40 pixels of white between objects. Same camera, same scale rule and same style for all of them. In each row the bottom edges of the objects are on the same line.
Each object is one single connected shape: no loose bits, sparks, particles or parts floating next to it. No pure white or near-white areas inside any object.
All objects are seen from directly above, flat on the ground. This replaces the front-view camera rule for this sheet; colors, pixel style and outline stay the same.
Order, left to right, top to bottom:
1. oval woven rug in warm orange and brown
2. rectangular dark green carpet with a gold border
3. long narrow red carpet runner, lying from top to bottom
4. rectangular deep blue carpet with a simple fish pattern
5. round patchwork rug
6. round purple rug with a star pattern
7. rectangular rope mat
8. worn brown leather work mat
Relative sizes: The runner is the longest; the other rugs are about three quarters of its length. The rope mat is the smallest, about half of it.
```

Betik satırı:

```python
    'ic_yer': ('Interiors/Common', 128, ['kafe_hali', 'banka_hali', 'banka_yolluk', 'muze_hali', 'terzi_hali', 'disko_hali', 'balikci_paspas', 'atolye_paspas']),
```

## Kabul kontrolü (görsel indikten sonra)

- Aynı sheet'teki bütün nesneler aynı yönden mi bakıyor? Biri yandan görünüyorsa sheet'i at, baştan iste.
- Çatı ve üst yüzler hep aynı eğimde mi? İzometrik köşe varsa at.
- Beyaz arka plan temiz mi, parçalar birbirine değiyor mu? Değiyorsa betik parça sayısını yanlış bulur.
- Işık hep sol üstten mi?

Geçen sheet'i `tools/pixel-art/ai-src/harita/<ad>.jpg` olarak kaydet, `harita_assets.py` tablosuna satır ekle, `python3 tools/pixel-art/harita_assets.py <ad>` çalıştır.
