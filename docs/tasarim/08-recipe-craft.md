# Recipe ve Craft

> Kaynak: tasarım dokümanı v0.8, bölüm 10, 11. Numaralar eski dokümana atıf için korunmuştur.

## 10. Recipe Sistemi

### 10.1. Temel Kural

> **Recipe yoksa craft yok.** Tarifsiz basit craft da yoktur.

Rastgele kombinasyon deneyerek craft (experiment crafting) yoktur. İnternette tarifin içeriğini görmek craft yetkisi vermez.

### 10.2. Recipe = Tek Kullanımlık Eşya

- Recipe öğrenilen bir yetki değil, **craft sırasında harcanan bir eşyadır**.
- Envanterde durur, takas edilebilir ve **oyun içi pazarda satılabilir**. Değerli recipe'ler pazarın önemli ürünleridir.
- v0.2'deki Learn / Sell ayrımı kaldırıldı.
- Her craft bir recipe harcadığı için recipe drop oranı normal eşyalardan düşük ama ekonomiyi besleyecek kadar olmalıdır.
- Oyun başında 2-3 basit recipe hediye edilir, oyuncu craft'ı hemen öğrenir.

### 10.3. Recipe Kaynakları

- Balık tutarken **"şişedeki recipe"** olarak düşer
- Sandık
- Takas / pazar
- Sezon / Event (sonraki fazlar)

### 10.4. Recipe Kademeleri

Recipe kademesi çıkacak eşyanın Float'ına **alt sınır** koyar. En iyi sonuç (örneğin 0.01) yine şansa kalır.

| Kademe | En kötü Float | Not |
|---|---|---|
| Normal | 1.00 | Malzeme kalitesi şansı etkiler |
| İyi | 0.50 | Asla Worn / Damaged çıkmaz |
| Usta | 0.20 | En az Excellent. Çok nadir, pazarın en pahalı ürünü |

### 10.5. First Discovery

Bir recipe veya eşyayı oyunda ilk bulan oyuncu kaydedilir: `Ancient Ruby — First discovered by: PlayerX`. Profilde görünür. İleride First Discovery leaderboard'u eklenebilir. Recipe'nin içeriği diğer oyunculara açıklanmaz.

## 11. Craft Sistemi

```
RECIPE (harcanır) + MALZEMELER (harcanır) + TOZ (harcanır) = YENİ ITEM INSTANCE
```

Örnek:

```
İnci Kolye Recipe
3 × İnci
1 × İp
   ↓
İnci Kolye
```

### 11.1. Craft Zinciri

- Craft eşyaları başka recipe'lerde malzeme olarak kullanılabilir.
- **(Öneri)** Faz 1'de zincir **tek kat** derinliktedir. Örnek: `Deniz Tacı = 1 × İnci Kolye + 1 × Kristal + 1 × Mythic Balık Pulu`
- Faz 1'deki 8 craft eşyasından 2-3'ü bu tür "üst recipe"dir.

### 11.2. Craft ve Float

Çıkan eşyanın Float'ı yeniden belirlenir. Malzemelerin Float ortalaması **sonucu belirlemez, şansı kaydırır**:

| Malzeme ortalaması | Pristine şansı | Excellent şansı |
|---|---|---|
| Kötü (0.50 üstü) | %1 | %8 |
| Normal (0.20 – 0.50) | %2 | %13 |
| İyi (0.05 – 0.20) | %4 | %20 |
| Çok iyi (0.05 altı) | %6 | %25 |

- Etki bilerek küçük tutulur. En iyi malzemeyle bile sonuç garanti değildir.
- Recipe kademesinin alt sınırı bunun üstüne uygulanır.
- Bu sayede bol çıkan Pristine Common'lar değer kazanır ve oyuncu ikilemde kalır: "Bu temiz balığı defterim için mi tutayım, craft'ta mı yakayım?"

### 11.3. Craft Ekranında Şans Göstergesi

- Kesin oranlar **gösterilmez** (şimdilik).
- Oyuncu malzeme koyarken bir **"Kalite şansı" çubuğu** görür: Düşük / Normal / Yüksek / Çok Yüksek. İyi malzemenin şansı artırdığını bilir ama sayıyı bilmez.
- İleride yasal gereklilik olursa aynı çubuğun yanına oran eklenir.

### 11.3.1. Craft Akışı

- **Yer:** meydandaki **zanaatkar NPC** (birleştirme ile aynı yer). Tek bir "zanaat köşesi" sosyal buluşma noktası olur.
- Zanaatkara tıklanınca çantadaki recipe'ler listelenir. Seçilen recipe'nin malzemeleri ve toz miktarı görünür, eksikler kırmızıdır.
- Aynı malzemeden farklı Float'larda birden fazla varsa oyuncu hangilerini kullanacağını seçer; "Kalite şansı" çubuğu canlı değişir.
- Craft **anında** olur. Kısa bir animasyonun ardından eşya Float'ıyla birlikte açılır.
- **Duyuru:** Pristine sonuç **yakındakilere** (parıltı efekti + chat satırı), Mythic Pristine **tüm sunucuya** duyurulur. Aynı kural balıktan çıkan eşyalar için de geçerlidir.

### 11.4. Craft Ekonomisi

Craft garantili kâr üretmez. Uzun vadede çıkan eşyanın beklenen değeri, harcanan recipe + malzemelerin değerine yakın veya altında olmalıdır. Düşük ihtimalli yüksek değerli sonuçlar vardır. Craft bir **risk / ödül + eşya yakma (sink)** mekaniğidir.
