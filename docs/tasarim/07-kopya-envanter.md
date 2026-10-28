# Kopyalar, Toz, Envanter, Birleştirme

> Kaynak: tasarım dokümanı v0.8, bölüm 9. Numaralar eski dokümana atıf için korunmuştur.

## 9. Kopya Eşyalar

Defterde zaten olan bir eşya tekrar çıktığında oyuncunun seçenekleri:

- **Tut** (Collection Score'a katkı, craft için biriktir)
- **NPC'ye sat** → Coin
- **Parçala** → Toz (bkz. 9.2)
- **Takas et** (oyuncular arası)
- **Pazarda sat**
- **Craft'ta kullan**

### 9.1. Takas

Oyuncular arası takas vardır ve takasla gelen eşya deftere işlenir.

- **Güvenli takas penceresi** (Knight Online tarzı). Dış sitelerde anlaşılan satışların teslimi de buradan yapılır.
  1. **Başlatma:** oyuncuya tıklayıp "Takas teklif et"; karşı taraf kabul eder. İki oyuncu **yan yana** olmalıdır (~5 kare).
  2. **Pencere açıkken yürünemez.**
  3. **İçerik:** her taraf en fazla 8 eşya + istediği kadar Coin. Float ve kondisyon karşı tarafa açıkça görünür.
  4. **Kilitle:** iki taraf da kilitler. Sonrasında bir şey değişirse iki kilit de açılır (son anda eşya değiştirme dolandırıcılığına karşı).
  5. **Onayla:** iki kilitten sonra 3 sn geri sayım, ardından iki taraf onaylar; takas tek seferde gerçekleşir.
  6. **Kayıt:** her takas sunucuda kaydedilir (dolandırıcılık şikayetleri için).
- **Ekleme:** takas penceresi açıkken eşya çantadan sürükle-bırakla konur; yığında adet sorulur. Kilitli eşya konamaz (bkz. 9.3).
- **Takas edilebilir:** eşyalar, recipe'ler, Coin. **Edilemez:** toz, parayla alınan kozmetikler.

**Ertelendi:** bir grup tek bir nadir eşyayı elden ele dolaştırıp hepsinin defterine işletebilir. Takas kısıtı (tekrar takas yok veya 7 gün bekleme) şimdilik kararlaştırılmadı, sonra konuşulacak.

### 9.2. Toz

- Toz **craft'ın yakıtıdır**: her recipe malzemelerin yanında bir miktar toz ister (craft maliyeti).
- Toz yalnızca eşya parçalayarak elde edilir, Tier yükseldikçe daha çok toz verir.
- Toz ile **defter kozmetikleri** (Collection Book temaları, çerçeveler) de alınabilir. Bu, craft dışındaki toz fazlasını yakar. Parayla satılan defter kozmetiklerinden ayrı, sadece tozla açılan bir seridir.
- Toz **takas edilemez** ve dış sitelerde satılamaz, bu yüzden bot çiftliklerine değer üretmez.
- Kopya eşyada oyuncunun kararı: "Satıp Coin mi alayım, parçalayıp craft için toz mu biriktireyim?"

### 9.3. Envanter ve Depo

- **Çanta:** **(Öneri)** 40 kutu. Float'lı eşyalar (balık, kristal, craft eşyası) tek tek kutu kaplar. Malzemeler, çöp ve yem **yığılır** (kutu başına 99). **Craft malzemelerinin Float'ı yoktur.**
- **Çanta dolunca av olmaz.** Ekranda "çanta dolu" uyarısı çıkar. Yere düşürme yoktur.
- **Eşya kilidi:** oyuncu çantadaki bir eşyayı kilitleyebilir (koruma). Kilitli eşya satılmaz, parçalanmaz, takasa ve pazara konamaz, otomatik kurallara takılmaz. Önce kilit açılır.
- **Otomatik kurallar:** oyuncu "Worn ve Damaged Common kopyaları otomatik sat / parçala" gibi kurallar ayarlayabilir.
- **Depo:** **(Öneri)** 100 kutu. **Yalnızca uzaktaki belirli yerlerden** açılır (ör. banka); her yerden açılmaz. Depodaki eşya satılamaz, parçalanamaz, craft'ta kullanılamaz; önce çantaya alınır. Defter yuvasındaki eşya depoya konamaz.
- **Genişletme:** Coin ile pahalı kademeler (Coin harcatır) ve destekçi paketi ile ekstra depo (kolaylık ürünü).

### 9.4. Birleştirme (3'ü 1)

- **Aynı eşyadan 3 tane** (aynı renk varyantı) + toz → **aynı eşyadan 1 tane**, yeni Float ile. Tier değişmez.
- **Recipe gerekmez.** "Recipe yoksa craft yok" kuralı yeni eşya üretmek içindir; birleştirme yeni eşya üretmez, aynı eşyanın daha temizini kovalar.
- Float şansı craft tablosuna göre girdilerin ortalamasıyla kayar (bkz. 11.2). İyi girdiler daha iyi Float şansını artırır.
- Sonuç, girdilerin **en kötüsünden** daha kötü çıkmaz.
- Toz maliyeti Tier'a göre artar. Ayrıca **Coin ücreti alınmaz**.
- **(Öneri)** Haritada bir NPC'de (ör. meydandaki zanaatkar) yapılır.
- Ekonomi: her birleştirme 2 eşyayı oyundan siler, güçlü bir sink'tir.
