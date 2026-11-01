# Genel Tanım, Felsefe ve Stil

> Kaynak: tasarım dokümanı v0.8, bölüm 1, 2, 3, 20, 21. Numaralar eski dokümana atıf için korunmuştur.

## 1. Oyunun Temel Tanımı

Oyun; online **sosyal alan + collection + crafting + oyuncu ekonomisi + sohbet** üzerine kurulu. Referans his: **Sanalika**. Farm bir amaç değil, insanları bir arada tutan ve collection'ı besleyen bir araçtır.

Oyuncu:

- Karakterini seçer (birkaç hazır karakter varyasyonu).
- Sunucu listesinden bir sunucu seçer (ör. 200 kişilik) ve ortak açık haritaya girer.
- Odada balık tutar ve chat balonlarıyla sohbet eder.
- Sudan çıkan eşyaları toplar, Collection Book'unu doldurur.
- Recipe bulur, craft yapar.
- Balık satarak Coin kazanır.
- Eşya ve recipe'leri oyun içi pazarda alıp satar, oyuncularla takas eder.
- Diğer oyuncuların collection'larını inceler.
- Collection Score ile sosyal statü kazanır.

Temel döngü:

```
SUNUCUYA GİR → BALIK TUT + SOHBET → EŞYA + COIN → COLLECTION BOOK
        → KOPYA: SAT / TOZ / TAKAS / PAZAR / CRAFT → DAHA İYİ COLLECTION → SOSYAL STATÜ
```

## 2. Oyunun Ana Felsefesi

Temel oyuncu motivasyonu:

> "Koleksiyonumu diğer oyunculardan daha tamamlanmış ve daha prestijli hale getirmek."

İlkeler:

- **Sosyallik önce gelir.** Her mekanik oyuncuları aynı yerde, yan yana ve konuşur halde tutmalı.
- **Collection statüdür.** Statü dolar değerinden değil, defterin doluluğu ve eşyaların kalitesinden gelir.
- **Tek geliştirici.** Tasarımcı yok, eşya görselleri AI ile üretilir. Kapsam buna göre tutulur.

## 3. Platform ve Görsel Stil

- **Ana hedef:** Steam (Windows / Mac).
- **Fiyat:** oyun **ücretsiz** (free-to-play).
- **Web build:** geliştirme sırasında arkadaşlara link ile test için. İleride ayrı bir platform olarak açılabilir.
- **Mobil:** ileride. Arayüz baştan dokunmatiğe uygun tasarlanır.
- **Kamera:** Stardew Valley gibi hafif üstten görünüm.
- **Stil:** 2D pixel-art.

### 3.1. Karakterler

- Birkaç hazır karakter varyasyonu, **unisex** seçenekler.
- Karakterler Stardew'dan (16×32) daha net olmalı ki kostüm ve kozmetikler anlaşılsın. Hedef: **LPC boyutu, 64×64 kare** (Stardew'un yaklaşık iki katı), aynı hafif üstten açı, hazır kıyafet katmanları. Daha büyük boyut her animasyonu çok pahalılaştırır.
- Karakterler 4 yönde (aşağı, yukarı, sol, sağ) yürüme animasyonu ister. AI bunu tutarlı üretemediği için **hazır bir karakter sistemi** kullanılır: örneğin LPC karakter üreteci (isim verme şartlı lisans) veya itch.io paketi. Çapraz yürürken yan (sol/sağ) kareler kullanılır; dikeye ~22°'den yakınsa yukarı/aşağı.
- Eşyalar karakter üzerinde **giyilmez**. Bu sayede her eşya için tek, önden görünüm PNG yeterlidir.
- İleride birkaç basit kozmetik (renk, şapka vb.) elle eklenebilir.

## 20. Oyun Döngüleri

### 20.1. Ana Döngü

```
SUNUCUYA GİR
 ↓
BALIK TUT (+ SOHBET)
 ↓
XP + ITEM INSTANCE (Tier + Float)
 ↓
DEFTERDE VAR MI?
 ├── YOK → DEFTERE İŞLE (şans bonusu ↑)
 └── VAR → KOPYA
          ├── TUT
          ├── NPC'YE SAT (COIN)
          ├── PARÇALA (TOZ)
          ├── TAKAS
          ├── PAZAR
          └── CRAFT (recipe gerekir)
                ↓
          YENİ FLOAT ROLL → DEFTER / PAZAR
```

### 20.2. Sosyal Döngü

```
YAKINDA OYUNCU GÖR → DEFTERİNE BAK → "BENDE BU YOK" → ARA / TAKAS / PAZAR / CRAFT → COLLECTION SCORE ↑
```

### 20.3. Keşif Döngüsü

```
BALIK TUT → ŞİŞEDEKİ RECIPE → KULLAN veya SAT → NADİR EŞYA → DEFTER / PAZAR
```

## 21. Temel Tasarım İlkeleri

1. **Sosyallik ve collection merkezdedir.** Farm bir araçtır.
2. **Collection bir keşif defteridir.** Kayıt kalıcıdır, sahip olmak ayrıca görünür.
3. **Envanter private, defter public.**
4. **Tier ve Float ayrı sistemlerdir.** Drop Rate, Tier ve Float birbirinden bağımsızdır.
5. **Float fiyat değildir.** Fiyatı arz, talep, Tier, Float ve zorluk birlikte belirler.
6. **Recipe olmadan craft yoktur.** Recipe tek kullanımlık, satılabilir bir eşyadır.
7. **Craft garantili kâr üretmez.** Risk / ödül + sink mekaniğidir.
8. **Parayla satılan hiçbir şey eşya miktarını veya kalitesini artırmaz.** Monetization kozmetik ve kolaylıktır.
9. **Sunucu her sonucu belirler.** Client'a güvenilmez.
10. **Kapsam tek kişiye göre tutulur.** Görseller AI ile, karakterler hazır sistemle.
11. **Alanlar herkese açıktır.** İlerleme olta ve yemden gelir, oyuncular ayrılmaz.
12. **Beceri yakalamayı, şans içeriği, sunucu hızı belirler.**
