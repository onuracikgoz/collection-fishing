# Collection Setleri

Karar (18.10.2026, Onur): collection setleri **recipe ile yapılan eşyalardan** oluşur. Setin malzemeleri balık tutarken düşer, oyuncu bunları recipe'lerle set eşyalarına çevirir. Setler `collection-set-generator` skill'i ile üretilir ve `content/sets/<set_id>/` altında durur.

Bu kural tematik collection setleri içindir. Göl Balıkları gibi doğrudan sudan çıkan sayfalar (bkz. `06-defter.md`, `13-icerik.md`) olduğu gibi kalır.

## Setin yapısı

| Parça | Adet | Not |
|---|---|---|
| Ana eşyalar | 66 | 30 Common, 20 Rare, 10 Epic, 5 Legendary, 1 Mythic. Hepsi **yalnızca recipe ile** yapılır. Her biri bir defter kaydıdır |
| Recipe'ler | 66 | Her ana eşyanın kendi recipe'si. Ortak "şişedeki recipe" ikonu. Defterde yer almaz |
| Alt eşyalar (malzemeler) | (Öneri) 15–25 | Konsepte uygun. Balık tutarken haritadaki noktalardan düşer. Float'ları yoktur, yığılır. Birçok recipe'de kullanılır |

- Recipe = recipe (harcanır) + malzemeler + toz (bkz. `08-recipe-craft.md`).
- **(Öneri)** Her recipe 2–4 malzeme türü ister. Tier yükseldikçe daha nadir malzeme, daha çok adet ve daha çok toz.
- **(Öneri)** Legendary ve Mythic recipe'ler bir alt Tier ana eşyayı da malzeme olarak isteyebilir. Zincir en fazla tek kat.
- Malzemeler haritaya dağılır, en nadirleri izbe noktalarda çıkar. Setin bir "en iyi yeri" olur (bkz. `16-ilk-harita.md`).
- Recipe'ler balık tutarken "şişedeki recipe" olarak düşer; nadir eşyaların recipe'leri daha nadir düşer. Oranlar sunucu verisidir.

## Görseller

Renk varyantı yoktur. Her ana eşyanın ve her malzemenin görseli Perchance'te ayrı üretilir, Item Art Studio'da hazırlanıp onaylanır (bkz. `13-icerik.md` bölüm 19). Bir set için yaklaşık 66 + malzeme sayısı kadar AI görseli gerekir.

## Açık noktalar

- Malzemeler defterde kayıt olarak yer alsın mı? (öneri: hayır, defter sadece ana eşyalar)
- 66 eşyalık bir sette defter sayfası nasıl bölünür: tek sayfa mı, Tier'a göre birkaç sayfa mı?
