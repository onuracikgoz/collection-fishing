# Eşya, Tier ve Float

> Kaynak: tasarım dokümanı v0.8, bölüm 7. Numaralar eski dokümana atıf için korunmuştur.

## 7. Eşya Sistemi

Eşya kaynakları:

- Balık tutma (drop)
- Sandık
- Craft (yalnızca recipe ile)
- Takas
- Oyun içi pazar
- Sezon / Event (sonraki fazlar)

Her eşya bir **item instance**'tır ve kendi Tier ve Float değerini taşır.

### 7.1. Tier

Eşyanın temel nadirlik sınıfı, eşyanın kimliğinin parçasıdır:

Common · Rare · Epic · Legendary · Mythic

### 7.2. Float

Her instance'ın **0.0000 – 1.0000** arası bir Float değeri vardır. **0'a yaklaştıkça daha iyi.**

| Kondisyon | Float | Çıkma oranı (varsayılan) |
|---|---|---|
| Pristine | 0.00 – 0.05 | %2 |
| Excellent | 0.05 – 0.20 | %13 |
| Normal | 0.20 – 0.50 | %45 |
| Worn | 0.50 – 0.80 | %30 |
| Damaged | 0.80 – 1.00 | %10 |

- Float tamamen rastgele (düz dağılım) değildir. Kondisyon önce bu tabloya göre seçilir, sonra aralık içinde rastgele bir değer atanır.
- Bu oranlarla 0.01'in altı yaklaşık 2500 eşyada bir çıkar, tam 0.0000 neredeyse imkansızdır.
- Çok düşük Float (örneğin 0.001 altı) çıktığında yakındakilere / sunucuya duyuru yapılabilir.
- Oranlar sunucuda tutulur, oyun güncellemesi gerekmeden değiştirilebilir.

### 7.3. Drop Rate, Tier ve Float Bağımsızdır

- **Drop Rate:** eşyanın çıkma ihtimali.
- **Tier:** eşyanın sınıfı.
- **Float:** o instance'ın kondisyonu.

Asıl nadirlik **drop oranı × Float oranı** çarpımından gelir. Pristine Common bol ve ucuz olabilir; Pristine Mythic ise oyun genelinde çok nadirdir.

Kaba hesap (varsayım: 30 sn'de bir av, oyuncu başı günde 1 saat, Mythic drop %0.05):

| | Tek oyuncu (günde ~120 av) | 2000 oyuncu (günde ~240.000 av) |
|---|---|---|
| Pristine eşya (hepsi) | günde ~2 | günde ~4.800 |
| Mythic | ~17 günde 1 | günde ~120 |
| Pristine Mythic | ~2 yılda 1 | günde ~2-3 |
| 0.01 altı Mythic | pratikte hiç | ~20 günde 1 |

### 7.4. Eşyaya Özel Float Aralığı

Her eşyanın Float aralığı ve kondisyon oranları farklı olabilir. Örneğin Mythic'lerde Pristine oranı %0.5'e çekilebilir. Nadirlik ayarı öncelikle drop oranıyla yapılır, bu bir ince ayar aracıdır.

### 7.5. Float'ın Görsel Etkisi

Float görünüşe yansır: **kir ve parlaklık**. Damaged/Worn eşya çamurlu ve soluk, Pristine eşya temiz ve parıltılıdır.

Teknik olarak her Float için ayrı görsel üretilmez. Unity'de tek bir shader, herhangi bir PNG'nin üstüne Float değerine göre kir dokusu veya parıltı bindirir.

### 7.6. Item Instance Yapısı

```
ITEM INSTANCE
├── Instance ID
├── Item Definition ID
├── Tier
├── Float (0.0000 – 1.0000)
├── Acquisition Source (balık / sandık / craft / takas / pazar)
├── Obtained At
├── Trade State (takas edilebilir mi, kısıt bitiş tarihi)
└── Season (sonraki fazlar)
```

### 7.7. Seed / RNG

Drop, eşya seçimi, Tier ve Float sunucuda RNG ile belirlenir:

```
Av → Sunucu doğrulama → RNG → Eşya havuzu → Eşya seçimi → Tier → Float → Item Instance
```

Seed oyuncuya gösterilmez ve eşyanın kimliği değildir.
