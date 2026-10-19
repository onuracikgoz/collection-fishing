# Balık Tutma, Enerji, Görevler

> Kaynak: tasarım dokümanı v0.8, bölüm 5. Numaralar eski dokümana atıf için korunmuştur.

## 5. Farm Mekaniği: Balık Tutma

Balık tutma seçildi çünkü:

- Her kültürde anlaşılır, cinsiyet ayrımı olmadan sevilir (Stardew, Animal Crossing, Roblox balık oyunları). Ton sevimli ve rahat tutulur.
- Ritmi sohbete uygundur: olta at → bekle → kısa zamanlama anı. Beklerken yazışılır.
- "Ansiklopedi doldurma" oyuncunun zaten bildiği bir collection hedefidir.

Akış:

1. **At:** suya tıklayınca karakter su kenarına yürür. Basılı tutunca güç çubuğu dolar, bırakınca atış yapılır. Üç mesafe: **kıyı, orta, derin**. Oltanın level'ı en uzak mesafeyi belirler.
2. **Bekle:** 5–20 sn arası rastgele, süreyi **sunucu** belirler. Bu sırada chat yapılır. Şamandıra arada **sahte kıpırdar**; sahte kıpırdamada çekersen balık kaçar.
3. **Vuruş:** gerçek vuruşta şamandıra tamamen batar, ses gelir. Tıklama penceresi Common'da ~0.6 sn, Mythic'te ~0.35 sn.
4. **Çekme:** Stardew tarzı, kaçan balık simgesini çubuğun içinde tutma mini oyunu. Common'da ~2 sn ve sakin, Mythic'te ~8 sn ve hareketli. Başarısızsa balık kaçar.

**Kontroller:** atış fare ile, çekme fare veya Space ile.

**Hareket:** ana yöntem fare (tıkla, oraya git; Sanalika / Club Penguin gibi, tek elle yürüyüp diğer elle yazmayı sağlar, mobilde dokunmatikle doğrudan çalışır). WASD de desteklenir. Enter chat'i açar, yazarken hareket tuşları devre dışı kalır.

### 5.0.0. Ne Çıkacağını Ne Belirler

- **Nokta (göl):** neyin çıkabileceğini belirler. Noktanın havuzunda olmayan eşya orada asla çıkmaz.
- **Mesafe:** havuzu kıyı / orta / derin olarak böler. Bazı eşyalar yalnızca derinde çıkar.
- **Yem:** havuz içindeki oranları kaydırır, yeni eşya eklemez. Uygun olmayan noktada özel yem boşa gider.
- Örnek: mağara gölü + derin su + kristal yem = en nadir kristallere en yakın kombinasyon. "Mavi kristal nerede, hangi yemle çıkıyor?" doğal bir sohbet konusudur.

### 5.0.0.1. Yem

- **Temel yem bedava ve sınırsızdır.** Oyuncu hiçbir zaman "balık tutamıyorum" durumuna düşmez.
- **Özel yemler** (parlak yem, kristal yem vb.) Coin ile alınır veya craft edilir; oranları yalnızca bunlar kaydırır. Her atışta 1 özel yem harcanır.
- Sahte kıpırdamada çekilirse: temel yemde sadece zaman kaybı, özel yemde yem gider.
- **(Öneri)** Özel yem atış anında harcanır; olta toplansa da geri gelmez. Enerji yokken veya olta kırıkken yemle atılamaz (yem boşa gitmesin).
- **(Öneri)** Parlak yem her yerde Rare ve üstünü hafifçe artırır. Kristal yem sadece derin suda işe yarar: nadirleri ve kristalleri öne çıkarır. Uygun olmayan yerde boşa gider, oyun bunu söylemez.

### 5.0.0.2. Olta Dayanıklılığı

- Her av oltayı biraz yıpratır, **Coin ile tamir** edilir (Coin harcatan nokta).
- **(Öneri)** Yavaş yıpranır, örneğin ~200 avda bir tamir.
- **(Öneri)** Sadece enerjili av yıpratır. Dayanıklılık biterse olta kırılır: balık tutmaya devam edilir ama enerjisiz gibi sadece çöp çıkar ve enerji harcanmaz. Kısmi tamir eksikle orantılı ücretlenir; Coin yetmezse yettiği kadar tamir edilir.

### 5.0.0.3. Enerji

- Karakterin **enerjisi** vardır. **(Öneri)** 100 enerji, her atış 1 enerji (≈50 dk kesintisiz balık).
- **Oyun kapalıyken** enerji dolar. **(Öneri)** ~8 saatte tam dolum.
- **Dinlenme alanları:** kamp ateşi, kafe, bank gibi AFK alanlarında oturunca enerji daha hızlı dolar (**öneri:** 3 kat). Burada sohbet edilir; sosyal buluşma noktalarıdır.
- Enerji günlük av sayısını doğal olarak sınırlar: arz kontrolü ve bot önlemi.
- Enerji **parayla satılmaz.**
- İleride: tutulan balığı pişirip yiyerek enerji kazanma.
- **Enerji bitince:** balık tutmaya devam edilir ama yalnızca **çöp** çıkar (midye, taş, çizme vb.). Çöp toz yapılır veya çok az Coin'e satılır. Oyuncu suyun başından kalkmak zorunda kalmaz.
- **(Öneri)** Enerjisizken çıkan çöp normal çöpün yarısı kadar toz verir. Asıl craft darboğazı recipe olduğu ve recipe yalnızca enerjili avdan çıktığı için toz fazlası craft sayısını patlatmaz.
- Çöpler de bir **"Çöp Seti"** olarak deftere girer (paslı çizme, kırık şişe, eski teneke...). Yeni oyuncuya erken tamamlama hissi verir.

### 5.0. Beceri ve Şans

- **Ne çıkacağını şans belirler.** Sunucu eşyayı şamandıra battığı anda seçer. İyi oyuncu daha nadir eşya çıkaramaz.
- **Yakalayıp yakalamamayı beceri belirler.** Hedef: ortalama oyuncu ~%75, iyi oyuncu ~%95 başarı. Fark iki kat değil, ~%25.
- Nadir avda mini oyun zorlaşır: iyi oyuncu nadiri kaçırmaz, ortalama oyuncu bazen kaçırır.
- **Hızı beceri değil sunucu belirler.** Bekleme süresi kısaltılamaz, saatte en fazla ~120 av olur. Böylece iyi oyuncular eşya arzını patlatamaz.

### 5.0.1. Av Tablosu (Başlangıç Değerleri)

| Av sonucu | Oran | Saatte (120 av) |
|---|---|---|
| Çöp (midye, taş, çizme, teneke → toz veya az Coin) | %25 | ~30 |
| Common balık / eşya | %50 | ~60 |
| Craft malzemesi | %12 | ~14 |
| Rare | %9 | ~11 |
| Epic | %3 | ~4 |
| Recipe | %0.4 | 2–3 saatte 1 |
| Legendary | %0.5 | 2 saatte 1 |
| Mythic | %0.05 | ~17 saatte 1 |

Saatte ~30 değerli şey (malzeme, Rare ve üstü) çıkar. Hedeflenen defter temposu: Common'lar ilk gün, Rare'ler birkaç gün, Epic'ler 1–2 hafta, Legendary birkaç hafta, Mythic ve Pristine kovalamak aylar. Oranlar sunucuda tutulur, playtest'te ayarlanır.

**Sudan her şey çıkabilir:** balık, sandık, eski gözlük, şişe, eski para, kristal, craft malzemesi, şişedeki recipe. Böylece AI ile üretilen herhangi bir temadaki eşya oyuna uyar.

İkinci bir toplama yöntemi (bahçe / toprak kazma) ileride aynı drop sistemiyle eklenebilir.

### 5.1. Sunucu Doğrulaması

Her balık tutma aksiyonu sunucu tarafından doğrulanır. Client'ın "yakaladım" demesi ödül üretmez. Sunucu zamanlamayı, cooldown'u, oyuncu ve konum durumunu kontrol eder ve sonucu kendisi belirler.

### 5.1.1. Bot Önlemleri

Eşyalar dış sitelerde gerçek para edeceği için bot koruması zorunludur. Tam koruma yoktur, amaç bot maliyetini artırmaktır:

- Vuruş zamanı, şamandıra hareketi ve mini oyun her seferinde farklıdır.
- Sunucu, tepki süresi aşırı düzenli olanları ve 7/24 oynayanları işaretler.
- **Enerji** (bkz. 5.0.0.3) günlük av sayısını sınırlar. Enerji **satılmaz**.
- Takas ve pazar belli bir level'dan (ör. level 10) sonra açılır.
- Takas ve pazar için **kısıtlı olmayan Steam hesabı** (Steam'de harcama yapmış hesap) ve belli bir oyun süresi şartı aranır. Ücretsiz oyunda bot hesabı açmayı pahalılaştırır.

### 5.2. Günlük Görevler ve Sandık

- "3 balık tut", "birinin collection'ına bak" gibi günlük görevler. Sosyal davranışı da ödüllendirir.
- Ödül olarak **sandık**: içinden eşya çıkan kutu. Faz 1'de sandık yalnızca günlük görev ödülüdür.
- Sandıklarda garanti ödüller olabilir (ör. "garanti 1 recipe").
- **Seri (streak):** görevler art arda yapıldıkça sandık değerlenir. 1–10 günlük takvim, **10. gün sandığı en iyisidir** (ör. garanti İyi recipe).
- **(Öneri)** Bir gün kaçırılınca seri sıfırlanmaz, 3 gün geri düşer.
- Sandık içerikleri ve seri ödülleri **admin panelinden** ayarlanır (bkz. 18).
- Sandık veya anahtar **asla gerçek parayla satılmaz.** Eşyaların gerçek para değeri olduğu için bu doğrudan kumar sayılır.
