# Ekonomi Tablosu (ilk taslak)

> Faz 0 maddesi: "Ekonomi simülasyon tablosunun ilk hali" (bkz. `14-parametreler.md` bölüm 23).
> **Bu dosyadaki bütün rakamlar (Öneri)dir.** Kesinleşince sunucu config'ine taşınır, koda gömülmez.
> Dayandığı kurallar: `03-balik-tutma.md` (av tablosu, enerji, yem, tamir), `05-esya-float.md` (Float oranları), `07-kopya-envanter.md` (toz, depo, birleştirme), `08-recipe-craft.md`, `09-ekonomi-pazar.md`.

## 1. Varsayımlar

| # | Varsayım | Kaynak |
|---|---|---|
| V1 | Enerji 100, atış başına 1, çevrimdışı ~8 saatte tam dolum, dinlenme alanında 3 kat hızlı | 03, 5.0.0.3 |
| V2 | "Ortalama oyuncu" günde **150 enerjili atış** yapar (sabah dolu 100 + gün içinde ~50 dolum / dinlenme alanı) | tahmin |
| V3 | Yakalama başarısı ~%75 → günde **~112 enerjili av** | 03, 5.0 |
| V4 | Enerji bitince günde **~30 atış** daha yapar, bunlardan sadece çöp çıkar | tahmin |
| V5 | Enerjili av dağılımı 03'teki av tablosu: %25 çöp, %50 Common, %12 malzeme, %9 Rare, %3 Epic, %0.4 recipe, %0.5 Legendary, %0.05 Mythic | 03, 5.0.1 |
| V6 | Oyuncu "oturmuş" durumda: Common ve Rare defter kayıtları dolu, çıkanların çoğu kopya | tahmin |
| V7 | Set başına Tier dağılımı %45 Common, %25 Rare, %15 Epic, %10 Legendary, en az 1 Mythic. Bu **setteki eşya sayısının** dağılımıdır, drop oranı değildir; Coin hesabını değiştirmez | plan kararı |
| V8 | Legendary ve Mythic NPC'ye neredeyse hiç satılmaz, tutulur veya pazara gider | tahmin |
| V9 | Tezgah pazarı %5 ücret, tezgahta 12 kalem, en fazla 8 saat açık (28.10.2026'da pano ilanından tezgaha geçildi) | 09, 12.3 |

## 2. Coin kaynakları ve harcama yerleri

**Coin üreten yerler (musluk):**

| Kaynak | Not |
|---|---|
| NPC'ye eşya satışı | Ana kaynak. Eşya oyundan çıkar (aynı zamanda eşya sink'i) |
| Çöp satışı | Çok az |
| Sandık / günlük görev | Admin panelinden ayarlanır, bu tabloda 0 sayıldı |

**Coin yakan yerler (sink):**

| Sink | Ne zaman | Tür |
|---|---|---|
| Olta tamiri | ~200 avda bir | Düzenli, kaçınılmaz |
| Özel yem | İsteğe bağlı, her atışta 1 | Düzenli, isteğe bağlı |
| Pazar ücreti (%5) | Her pazar satışında, ilan açmak ücretsiz | Ticaretle büyür |
| Depo genişletme | Tek seferlik, kademeli | Büyük birikim hedefi |
| NPC alışverişi (ileride) | Kozmetik olmayan oyun içi ürünler | Sonra |

Oyuncudan oyuncuya giden Coin (takas, pazar) yeni Coin üretmez; sadece %5 ücret Coin yakar.

## 3. Tier başına NPC satış fiyatı ve toz değeri

| Eşya | NPC satış (Coin) | Parçalama (toz) |
|---|---|---|
| Çöp (enerjili) | 1 | 2 |
| Çöp (enerjisiz) | 1 | 1 (yarısı, plan kararı) |
| Craft malzemesi | 3 | 2 |
| Common | 5 | 5 |
| Rare | 25 | 25 |
| Epic | 100 | 100 |
| Legendary | 500 | 400 |
| Mythic | 3.000 | 2.000 |
| Recipe (Normal / İyi / Usta) | 50 / 250 / 1.000 | parçalanamaz |

Tier başına aşağı yukarı ×5 artış: avda bir üst Tier ~3–10 kat daha nadir.

**Float çarpanı (yalnızca NPC satışında):**

| Kondisyon | Çarpan |
|---|---|
| Pristine | ×3 |
| Excellent | ×1.5 |
| Normal | ×1 |
| Worn | ×0.7 |
| Damaged | ×0.5 |

Float dağılımıyla (05, 7.2) ortalama çarpan ≈ ×0.97, yani ortalama satış fiyatı tablodakine çok yakındır. Toz Float'tan etkilenmez: temiz eşyayı parçalamak kötü bir seçim olur, oyuncu onu tutar veya satar.

**Otomatik kural (Worn / Damaged):** oyuncunun kurduğu "otomatik sat / parçala" kuralı aynı fiyat ve toz tablosunu kullanır, ek ücret veya indirim yoktur.

## 4. Yem, tamir, birleştirme, craft, depo fiyatları

### 4.1. Yem

| Yem | Fiyat | Not |
|---|---|---|
| Temel yem | Bedava, sınırsız | Plan kararı |
| Parlak yem | 5 Coin / adet | Rare+ oranını hafif kaydırır |
| Kristal yem | 20 Coin / adet | Uygun noktada kristal / nadir oranı kaydırır |

Özel yemler craft ile de üretilebilir (recipe gerekir).

### 4.2. Olta tamiri

Tam tamir ~200 avda bir. Kısmi tamir, eksik dayanıklılığa oranla ücretlenir.

| Olta level'ı | Tam tamir | Av başına maliyet |
|---|---|---|
| 1 | 100 Coin | 0.5 |
| 2 | 150 Coin | 0.75 |
| 3 | 250 Coin | 1.25 |

### 4.3. Birleştirme (3'ü 1)

Recipe gerekmez, sadece toz harcanır. Maliyet, aynı Tier'dan 2 eşyanın parçalanma değeri kadardır. Yani 3 eşya + 2 eşyalık toz verip 1 eşya alınır: güçlü bir sink, ama temiz Float kovalayan oyuncuya makul.

| Tier | Toz |
|---|---|
| Common | 10 |
| Rare | 50 |
| Epic | 200 |
| Legendary | 800 |
| Mythic | 4.000 |

### 4.4. Craft toz maliyeti (çıkan eşyanın Tier'ına göre)

| Çıkan Tier | Toz |
|---|---|
| Common | 20 |
| Rare | 80 |
| Epic | 300 |
| Legendary | 1.200 |
| Mythic | 5.000 |

Recipe ve malzemeler ayrıca harcanır. Craft ve birleştirmede Coin ücreti yoktur. Asıl darboğaz recipe'dir (günde ~0.45 recipe).

### 4.5. Depo genişletme

Başlangıç deposu 100 kutu. Her kademe +20 kutu, fiyat kabaca ×2.5 artar.

| Kademe | Kutu | Fiyat |
|---|---|---|
| 1 | 120 | 2.000 |
| 2 | 140 | 5.000 |
| 3 | 160 | 12.000 |
| 4 | 180 | 30.000 |
| 5 | 200 | 75.000 |

Destekçi paketi ekstra depo verir (kolaylık), bu kademelerin yerine geçmez.

## 5. Ortalama oyuncunun bir günü

### 5.1. Günlük av (V2–V5)

| Sonuç | Adet / gün |
|---|---|
| Çöp (enerjili) | 28 |
| Common | 56 |
| Craft malzemesi | 13 |
| Rare | 10 |
| Epic | 3.4 |
| Recipe | 0.45 |
| Legendary | 0.56 |
| Mythic | 0.056 (~18 günde 1) |
| Çöp (enerjisiz) | 30 |

### 5.2. Ne yapıyor (V6, V8)

| Eşya | Satar | Parçalar | Tutar / pazar |
|---|---|---|---|
| Çöp (enerjili) | %50 | %50 | |
| Çöp (enerjisiz) | | %100 | |
| Common | %70 | %30 | |
| Malzeme | %50 | | %50 craft için |
| Rare | %50 | %30 | %20 |
| Epic | %30 | | %70 |
| Legendary, Mythic | | | %100 |

### 5.3. Coin girişi

| Kalem | Hesap | Coin / gün |
|---|---|---|
| Çöp | 14 × 1 | 14 |
| Common | 39 × 5 | 196 |
| Malzeme | 6.5 × 3 | 20 |
| Rare | 5 × 25 | 125 |
| Epic | 1 × 100 | 100 |
| **Toplam** | | **~455** |

### 5.4. Coin çıkışı

| Kalem | Hesap | Coin / gün |
|---|---|---|
| Olta tamiri (level 2) | 112 av × 0.75 | 84 |
| Parlak yem | 20 atış × 5 | 100 |
| Pazar ücreti | ~1.000 Coin'lik satış × %5 | 50 |
| **Toplam** | | **~234** |

### 5.5. Sonuç

| | Günlük |
|---|---|
| Coin girişi | ~455 |
| Düzenli Coin çıkışı | ~234 (%51) |
| **Net birikim** | **~220** |
| Toz girişi | ~220 (Common 84, Rare 75, çöp 58) |

- İlk depo kademesi (2.000) ~9 günlük net birikim, ikincisi (5.000) bunun üstüne ~3 hafta, beşincisi aylar.
- Düzenli sink girişin yaklaşık yarısını yakar, kalan yarıyı depo ve pazar ücreti zamanla emer. Hedef: uzun vadede yakılan Coin üretilenin %70–90'ı.
- Toz: günde ~220 toz, ~0.45 recipe. Bir Rare craft 80 toz istediği için toz recipe'den çok daha hızlı birikir. Toz takas edilemediği için enflasyon yaratmaz. Fazlası **defter kozmetiklerine** (tozla açılan tema ve çerçeveler) harcanır; fiyatları kozmetik listesi çıkınca belirlenecek.

## 6. Riskler ve izlenecekler

- **Common satışı ana gelir.** Common fiyatı 5'ten 4'e inerse günlük giriş ~%9 düşer. Fiyat ayarının en etkili düğmesi budur.
- **Çok oynayan oyuncu:** enerji tavanı (günde en fazla ~3 tam dolum + dinlenme alanı) geliri sınırlar. Günde 300 atış yapan oyuncu ~2 katını kazanır, bunun üstü zor.
- **Bot:** bot da aynı enerji tavanına takılır; Coin'in dış değeri olmadığı için asıl risk eşya, Coin değil.
- **Pazar fiyatları** oyuncular tarafından belirlenir. NPC fiyatı, bir eşyanın pazardaki **taban** fiyatı olur; pazarda NPC fiyatının altında satış beklenmez.
- Gerçek oranlar 30 / 90 / 180 günlük simülasyonla (bölüm 23) ve playtest'le kontrol edilecek.
