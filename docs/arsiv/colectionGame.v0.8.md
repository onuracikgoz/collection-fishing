# Game Design & Systems Specification — v0.8

> v0.3 değişiklikleri (17.10.2026): Oyunun merkezi sosyallik + collection olarak netleşti. Farm = balık tutma. Steam Market şimdilik yok, oyun içi pazar var. Collection, Shakes & Fidget albümü gibi bir **keşif defteri** oldu. Recipe'ler tek kullanımlık ve satılabilir. Float dağılımı ve craft etkisi tanımlandı. Platform ve teknoloji seçildi.
>
> v0.4 değişiklikleri (17.10.2026): Oyun ücretsiz. Oyun içi para birimi (Coin) balık tutarak kazanılır. Gerçek para oyun içinde akmaz; oyuncular dış sitelerde ilan verip eşyayı oyun içi takasla teslim eder. Balık tutma mekaniği, av tablosu, bot önlemleri, level ile açılanlar, envanter çözümleri ve monetization netleşti. Alanlara level kilidi kaldırıldı.
>
> v0.8 değişiklikleri (18.10.2026): Balık tutma detaylandı (kontroller, sahte kıpırdama, vuruş ve çekme süreleri). Nokta / mesafe / yem ilişkisi tanımlandı. Temel yem bedava, özel yemler satın alınır. Olta dayanıklılığı ve Coin ile tamir. Yorgunluk yerine enerji sistemi ve dinlenme alanları.
>
> v0.7 değişiklikleri (17.10.2026): Yaş hedefi genel kitle, flört özellikleri yok. Sunucular aynı haritayı kullanır, dil ve isimle ayrışır.
>
> v0.6 değişiklikleri (17.10.2026): Odalar kaldırıldı. Her sunucu ~200 kişilik tek açık harita; başlangıç noktası, arkadaşa ışınlanma, yakınlık bazlı chat ve izbe balık noktaları eklendi. Flört özellikleri ve yaş hedefi konusu açıldı.
>
> v0.5 değişiklikleri (17.10.2026): Toz craft yakıtı olarak kesinleşti. Günlük görev sandıkları, 10 günlük seri ödülleri ve admin paneli eklendi. Pazar Odası yerine Club Penguin / Sanalika tarzı temalı sohbet mekanları, her sunucuda aynı harita. Karakter boyutu LPC (64×64) olarak netleşti.
>
> Önceki sürüm: `colectionGame.v0.2.backup.md`
>
> **(Öneri)** ile işaretli maddeler konuşuldu ama henüz kesin onay almadı. Bölüm 24'teki açık sorular cevaplanınca güncellenecek.

---

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
- Karakterler 4 yönde (aşağı, yukarı, sol, sağ) yürüme animasyonu ister. AI bunu tutarlı üretemediği için **hazır bir karakter sistemi** kullanılır: örneğin LPC karakter üreteci (isim verme şartlı lisans) veya itch.io paketi.
- Eşyalar karakter üzerinde **giyilmez**. Bu sayede her eşya için tek, önden görünüm PNG yeterlidir.
- İleride birkaç basit kozmetik (renk, şapka vb.) elle eklenebilir.

## 4. Sunucular ve Harita

### 4.0. Tek Açık Harita

- **Oda yoktur.** Her sunucu tek bir açık haritadır; göller, temalı sohbet mekanları (kafe, plaj, disko, kütüphane vb.) ve izbe köşeler aynı haritadadır (Club Penguin / Sanalika / IMVU havası).
- **Sunucu kapasitesi ~200 oyuncu.** Oyuncu sunucu listesinden doluluğa bakıp seçer: `Sunucu 3 — 142 / 200`.
- **Her sunucuda aynı harita** vardır, her sunucu haritanın bir kopyasıdır.
- Sunucuları ayıran harita değil kimliktir: **dil** (Türkçe, İngilizce...), **isim** (ör. "Mercan", "Liman") ve ileride sunucuya özel etkinlikler.
- Oyuncular takılacakları yeri kendileri seçer, "anime severler kafede takılır" gibi **niş topluluklar** kendiliğinden oluşur.
- Oyuncu isterse kalabalıkta sohbet ederek, isterse kimseyle konuşmadan izbe bir yerde balık tutabilir.

### 4.0.1. Başlangıç Noktası ve Arkadaşlar

- İlk girişte **meydanda** başlar (herkesin geçtiği canlı yer). Sonraki girişlerde son kaldığı yerde başlar.
- **"Arkadaşının yanına git":** arkadaş listesinden tek tıkla ışınlanma. Arkadaş başka sunucudaysa oyun o sunucuya geçirir. "Gel balık tutarken muhabbet edelim" bu sayede kolaydır.

### 4.0.2. Balık Noktaları

- Haritanın her yerinde: meydan yanındaki kalabalık iskeleden ormanın arkasındaki küçük gölete kadar.
- **(Öneri)** İzbe ve uzak noktalarda bazı nadir balıklar çıkar, oraya gitmek için sebep olur.
- Faz 1'de tek balık havuzu (Göl) farklı noktalara dağıtılır.

### 4.0.3. Yakınlık

- Chat balonları yalnızca **yakındaki** oyunculara görünür. İzbe yerdeki oyuncu kalabalığı duymaz, kendi sohbeti de duyulmaz.
- Sunucu her oyuncuya yalnızca yakınındaki oyuncuların hareketini gönderir (200 kişi Nakama için sorun değil).
- **(Öneri)** Sohbet mekanlarında başta yalnızca sohbet, ileride küçük mini oyunlar.
- İleride: oyuncunun kendi isimli odasını açması (IMVU tarzı).

### 4.1. Bölgeler (Sonraki Fazlar)

- **Bölgelerde level kilidi yoktur.** Her oyuncu her bölgeye girebilir.
  - Sebep: level kilidi farklı level'daki arkadaşları ayırır ve oyuncu kitlesini böler. Sosyal bir oyunun en büyük düşmanı boş bir haritadır.
- İlerleme bölgeden değil **olta ve yemden** gelir. Aynı gölde yeni oyuncu kıyıya yakın atar, deneyimli oyuncu derin suya ulaşır. Herkes aynı yerde ama farklı havuzlardan avlanır.
- Her bölgenin kendi eşya havuzu, drop oranları, recipe havuzu ve Collection Book sayfaları olur. Oyuncu bir bölgeye "orada şu balık çıkıyor" diye gider.
- Başkasının sergisini / odasını ziyaret etme fikri sonraki aşamaya bırakıldı.

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

### 5.0.0.2. Olta Dayanıklılığı

- Her av oltayı biraz yıpratır, **Coin ile tamir** edilir (Coin harcatan nokta).
- **(Öneri)** Yavaş yıpranır, örneğin ~200 avda bir tamir.

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

## 6. XP ve Level

- Her başarılı av XP verir. Nadir av daha çok, çöp az verir, kaçan balık vermez.
- Level şunları açar:
  - **Daha iyi oltalar:** daha uzağa atış, derin su havuzuna erişim. Bazı balıklar yalnızca derin suda çıkar.
  - **Yeni yem türleri:** farklı balık havuzlarına yönlendirir.
  - **Takas ve pazar** (ör. level 10). Bot önlemi olarak da çalışır.
- **Level drop şansını doğrudan artırmaz.** Şans bonusu defterden gelir; level de artırırsa yeni oyuncular çok geride kalır.
- Level profilde Collection Score'un yanında küçük bir rozet olarak görünür. Ana statü defterdir.
- XP'nin eşya değeriyle doğrudan bağı yoktur.

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

## 8. Collection Book (Keşif Defteri)

Collection bir envanter değil, **keşif defteridir** (Shakes & Fidget albüm mantığı).

### 8.1. Üç Durum

| Görünüm | Anlamı |
|---|---|
| **??** | Hiç bulunmamış |
| **Silik** | Bulunmuş (takas ile gelenler dahil), ama yuvası boş |
| **Dolu** | Yuvada eşya duruyor |

Eşya bir kere eline geçtiyse kayıt **kalıcıdır**. Sonradan toz yapsan, takas etsen veya satsan da defterde silik olarak kalır.

### 8.1.1. Defter = Kasa

- Defterdeki her kaydın **bir yuvası** vardır; o eşyadan bir kopya yuvaya konur.
- Yuvadaki eşya **çantada / depoda yer kaplamaz**, Collection Score'a sayılır, Float'ıyla defterde görünür. Showcase buradan seçilir.
- **İlk kopya otomatik yuvaya gider** ve **"Yeni keşif!"** bildirimi çıkar (hangi set / sayfa). Seti tamamlayan son eşyada daha büyük bir kutlama olur. Kopyalar çantaya düşer.
- **Daha iyi Float'lı kopya gelirse** "Defterdekiyle değiştir?" sorulur; değiştirilirse eski kopya çantaya düşer. Böylece defterde hep en temiz kopya durur.
- Satmak / takas / craft için eşya yuvadan çıkarılır; kayıt silik olur (şans bonusu düşmez, Score düşer).
- Sebep: 1000 kayıtlı bir defter için 1000 kutuluk envanter gerekmesin. Çanta yalnızca kopyalar ve malzemeler içindir.

### 8.2. Sayfalar

Defter sayfalardan (setlerden) oluşur. Faz 1 için örnek:

- Göl Balıkları
- Derin Su
- Hazineler
- Zanaat (craft eşyaları)

### 8.3. Collection Bonusu: Şans

- Defterde kayıtlı (silik dahil) eşyalar oyuncunun **şansını** artırır.
- **(Öneri)** Bonus eşya başına değil **sayfa başına** verilir: sayfanın yarısı dolunca küçük, tamamı dolunca büyük bonus.
- **(Öneri)** Toplam bonusun üst sınırı vardır, örneğin **+%25**. Eski oyuncular yenilere göre aşırı güçlenmesin.

### 8.4. Collection Score

- Collection Score yalnızca **defter yuvalarında duran** eşyalardan hesaplanır.
- Böylece satmanın ve takasın sosyal bir bedeli olur: şans düşmez ama profil sönükleşir.
- Formüle ileride Tier, Float kalitesi, tamamlanan sayfalar ve First Discovery'ler girer. Kesin formül playtest sonrası.

### 8.5. En İyi Float

Yuvada genellikle oyuncunun en temiz kopyası durduğu için "en temiz Mythic" statüsü kendiliğinden görünür.

### 8.6. Gizlilik

**Public:** Collection Book, Collection Score, Favorite / Showcase eşyalar, bazı profil istatistikleri.

**Private:** Envanter (recipe'ler dahil), ekonomik stratejiler.

Henüz bulunmamış eşyalar başka oyuncunun defterinde varsa adı görülebilir. "Bu eşyanın var olduğunu biliyorum" ile "nasıl elde edildiğini biliyorum" arasındaki fark korunur.

### 8.7. Tamamlama Ödülleri

Sayfa tamamlamak şans bonusuna ek olarak prestij ödülleri verir: unvan, rozet, profil çerçevesi, emote, karakter efekti. Bu ödüller ekonomik eşya üretmez.

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
- **Takas edilebilir:** eşyalar, recipe'ler, Coin. **Edilemez:** toz, parayla alınan kozmetikler.

**Ertelendi:** bir grup tek bir nadir eşyayı elden ele dolaştırıp hepsinin defterine işletebilir. Takas kısıtı (tekrar takas yok veya 7 gün bekleme) şimdilik kararlaştırılmadı, sonra konuşulacak.

### 9.2. Toz

- Toz **craft'ın yakıtıdır**: her recipe malzemelerin yanında bir miktar toz ister (craft maliyeti).
- Toz yalnızca eşya parçalayarak elde edilir, Tier yükseldikçe daha çok toz verir.
- Toz **takas edilemez** ve dış sitelerde satılamaz, bu yüzden bot çiftliklerine değer üretmez.
- Kopya eşyada oyuncunun kararı: "Satıp Coin mi alayım, parçalayıp craft için toz mu biriktireyim?"

### 9.3. Envanter ve Depo

- **Çanta:** **(Öneri)** 40 kutu. Float'lı eşyalar (balık, kristal, craft eşyası) tek tek kutu kaplar. Malzemeler, çöp ve yem **yığılır** (kutu başına 99). **Craft malzemelerinin Float'ı yoktur.**
- **Çanta dolunca av olmaz.** Ekranda "çanta dolu" uyarısı çıkar. Yere düşürme yoktur.
- **Otomatik kurallar:** oyuncu "Worn ve Damaged Common kopyaları otomatik sat / parçala" gibi kurallar ayarlayabilir.
- **Depo:** **(Öneri)** 100 kutu. **Yalnızca uzaktaki belirli yerlerden** açılır (ör. banka); her yerden açılmaz.
- **Genişletme:** Coin ile pahalı kademeler (Coin harcatır) ve destekçi paketi ile ekstra depo (kolaylık ürünü).

### 9.4. Birleştirme (3'ü 1)

- **Aynı eşyadan 3 tane** (aynı renk varyantı) + toz → **aynı eşyadan 1 tane**, yeni Float ile. Tier değişmez.
- **Recipe gerekmez.** "Recipe yoksa craft yok" kuralı yeni eşya üretmek içindir; birleştirme yeni eşya üretmez, aynı eşyanın daha temizini kovalar.
- Float şansı craft tablosuna göre girdilerin ortalamasıyla kayar (bkz. 11.2). İyi girdiler daha iyi Float şansını artırır.
- Sonuç, girdilerin **en kötüsünden** daha kötü çıkmaz.
- Toz maliyeti Tier'a göre artar.
- **(Öneri)** Haritada bir NPC'de (ör. meydandaki zanaatkar) yapılır.
- Ekonomi: her birleştirme 2 eşyayı oyundan siler, güçlü bir sink'tir.

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

## 12. Oyun İçi Pazar ve Ekonomi

### 12.1. Para Birimi: Coin

- Coin balık tutarak kazanılır: avı / kopyaları NPC'ye satarak, çöpten ve sandıklardan.
- Coin harcanır: yem, olta tamiri, pazar ücreti, NPC alışverişi. Bu harcamalar enflasyonu kontrol eder.
- Coin gerçek parayla satılmaz.

### 12.2. Gerçek Para Değeri

- **Oyun içinde gerçek para akışı yoktur.** Oyun ödeme almaz, para çekme yoktur.
- Oyuncular eşyalarını Knight Online'daki gibi **dış sitelerde** ilan verip satabilir. Teslim oyun içi güvenli takas penceresiyle yapılır.
- Hedef: nadir eşyaların gerçek değer kazanabilmesi (ör. Mythic 0.01 → ~2000$).
- Sonuçları bilinçli kabul edilir: bot çiftlikleri, hesap çalma ve dolandırıcılık girişimleri. Bu yüzden bölüm 5.1.1'deki önlemler ve güvenli takas zorunludur.
- **Hukuk:** şansla çıkan eşyanın gerçek para değeri bazı ülkelerde (ör. Belçika, Hollanda) kumar tartışmasına girebilir, kitle genç olabilir. Yayından önce avukata danışılmalı.
- Steam Community Market ileride alternatif olarak değerlendirilebilir (ödeme ve dolandırıcılık kontrolü Valve'de). O zaman v0.2'deki Steam Inventory PoC'si geçerli olur (yedek dosyada bölüm 42–44).

### 12.3. Oyun İçi Pazar

- Oyun içi pazarda eşya ve recipe Coin ile alınıp satılır.
- Ayrı bir Pazar Odası / tezgah sistemi **yok**; sosyal alanlar bunun yerine sohbet mekanlarıdır (bkz. 4.0).

#### Pazar Panosu

- Meydanda fiziksel bir pano; **yalnızca oradan** açılır.
- **Satış ilanı:** eşya + Coin fiyatı. Eşya panoya kilitlenir, satıcı çevrimdışıyken de satılır, Coin satıcıya gelir.
- Her ilan tek bir eşya instance'ıdır; alıcı Float ve kondisyonu görür. Aynı eşyanın farklı Float'ları ayrı listelenir.
- **Arama:** eşya adı, set, Tier, Float aralığı; en ucuz ilan üstte.
- **Alım ilanı:** "Mavi Kristal arıyorum, 500 Coin'e kadar". Satıcı panoda görür, tek tıkla satar. Currently Hunting ile bağlanabilir.
- İlan sahibine panodan **whisper** atılabilir (bkz. 13.1.2).
- **(Öneri)** Pazar ücreti satıştan %5.
- **(Öneri)** Oyuncu başına en fazla 10 aktif ilan, ilanlar 7 gün sonra kalkar.
- Level 10 ve kısıtlı olmayan Steam hesabı şartı geçerlidir.
- Dış sitelerde gerçek parayla satılan eşyalar panodan değil **takas penceresinden** teslim edilir. Pano yalnızca Coin ile çalışır.

### 12.4. Eşya ve Coin Yakma (Sink) Noktaları

- Craft (recipe + malzeme + toz harcanır)
- Eşya parçalama (toz)
- NPC'ye satış (eşya oyundan çıkar)
- Yem, olta tamiri
- Pazar ücreti
- Birleştirme (3'ü 1)
- Sonraki fazlarda: upgrade

### 12.5. Ekonomi İlkeleri

Hiçbir sistem "harcadığından garantili olarak daha değerli bir şey aldım" sonucunu sürekli üretmemelidir. Her üretim mekanizmasında girdi değeri, çıktı olasılığı, arz, talep, pazar ücreti ve sink birlikte düşünülür.

## 13. Sosyal Sistemler

### 13.1. Chat

- Mesajlar karakterin üstünde **chat balonu** olarak görünür, yalnızca yakındakilere. Yanında bir chat geçmişi paneli bulunur.
- Arkadaşlarla **özel mesaj**. "Sadece arkadaşlardan mesaj al" ayarı, engelleme ve raporlama her durumda vardır.
- Chat açıkken klavye girdisi balık tutma kontrolleriyle çakışmaz (örneğin chat açıkken SPACE yazıya gider).
- **Moderasyon baştan gerekli:** küfür filtresi, raporlama, susturma.

### 13.1.1. Yaş Hedefi: Genel Kitle

- Oyun **genel kitleye** (13+) yöneliktir.
- Bu yüzden **flört özellikleri yoktur** (öpücük emote'u, "çift" rozeti, romantik mekanlar vb.). Arkadaşça emote'lar (el sallama, alkış, dans) vardır.
- **Yabancılardan özel mesaj varsayılan olarak kapalıdır**, yalnızca arkadaşlar yazabilir.
- Sıkı moderasyon: küfür ve kişisel bilgi (telefon, adres, sosyal medya) filtresi, raporlama, engelleme, susturma.
- KVKK ve COPPA gereklilikleri yayından önce kontrol edilmeli (13 yaş altı için ebeveyn izni).
- **Dikkat:** genç kitle ile dış sitelerde gerçek para satışı birleşince dolandırıcılık ve reşit olmayanların para harcaması riski artar. Bölüm 12.2'deki hukuki görüşte bu da sorulmalı.

### 13.1.2. Whisper (Knight Online Tarzı)

- Her özel konuşma ekranda **ayrı küçük bir pencere** olarak açılır; birden fazla pencere açık kalabilir, küçültülebilir, yeni mesajda yanıp söner.
- Chat'e **`/w Nick mesaj`** yazarak veya panodaki ilana / oyuncuya tıklayıp "Whisper at" ile gönderilir.
- Her oyuncunun **"PM kapalı"** düğmesi vardır.
- **Genel kitle ile uyum:** arkadaşlar her zaman yazabilir. Yabancıya whisper yalnızca **pazar bağlamında** (satış / alım ilanından "Whisper at") ve gönderen en az level 10 ise açılır. Kişisel bilgi filtresi whisper'da da çalışır; engelle / raporla tek tıklıktır.

### 13.2. Oyuncu Etkileşimi

Bir oyuncuya tıklanınca: profil kartı, Collection Book'u incele, arkadaş ekle, whisper, takas teklif et. Envanter ve recipe'ler hiçbir zaman gösterilmez.

### 13.2.1. Arkadaşlar

- Arkadaşlık isteği gönderilir, karşı taraf onaylar.
- Listede kim çevrimiçi, hangi sunucuda, haritanın neresinde görünür; **"Yanına git"** butonu vardır.

### 13.2.2. Emote'lar

- Arkadaşça, genel kitleye uygun: el sallama, alkış, dans, oturma, gülme, **balık gösterme** (son avı havaya kaldırma).
- Ekstra emote'lar kozmetik olarak satılabilir.

### 13.3. Profil Kartı ve Showcase

- İsim, level, Collection Score, unvan.
- **3 showcase eşyası** (Tier, Float ve kondisyon görünümüyle, parıltısıyla).
- Tamamlanan setler, First Discovery'ler, "🎯 Arıyorum" etiketi.
- Profil kartından oyuncunun Collection Book'u açılır.

### 13.3.1. Kulüpler (Sonraki Fazlar)

Arkadaş grupları isimli bir kulüp kurup ortak chat kanalı kullanabilir. Niş toplulukların oluşmasına yardım eder.

### 13.4. Currently Hunting

Oyuncu defterden bir eşya seçip `🎯 Arıyorum: Ancient Ruby` olarak işaretleyebilir. Diğerleri bunu görür. Sohbeti, takası ve yardımlaşmayı teşvik eder.

## 14. Auto-Farm ve Boosterlar (Sonraki Fazlar)

Faz 1'de yoktur. Eklendiğinde v0.2'deki ilkeler geçerlidir:

- Auto-Farm aktif oyundan daha verimli olmaz.
- Aynı tip booster sınırsız üst üste binmez.
- Gerçek parayla satılan booster doğrudan yüksek Tier veya Float vermez.

## 15. Sezonlar (Sonraki Fazlar)

Bazı eşyalar yalnızca belirli bir sezonda üretilir. Sezon bitince doğrudan drop kapanır, eşyalar takas ve pazar üzerinden dolaşmaya devam eder. Amaç sınırlı arz yaratmaktır. Toplam üretilen sayı takip edilebilir.

## 16. Monetization

Oyun ücretsizdir. Ana model: **kozmetik + kolaylık**.

**Temel kural:** parayla satılan hiçbir şey çıkan eşyanın **miktarını veya kalitesini** artırmaz. Eşyalar dış sitelerde gerçek para ettiği için aksi "para ver, daha çok Mythic çıkar, sat" anlamına gelir: hem pay-to-win olur hem kumar tartışmasını geri getirir. Bu yüzden daha iyi olta, enerji, drop / şans artışı, sandık ve anahtar **satılmaz**.

Satılabilecekler:

- **Görünüm:** karakter kıyafetleri, saç, renkler (LPC'de hazır parçalar, AI gerekmez); olta ve şamandıra görünümleri (yalnızca görüntü, aynı özellik); chat balonu stilleri, isim rengi, emote; Collection Book temaları ve çerçeveleri; unvan, showcase özelleştirme.
- **Kolaylık:** ekstra depo alanı, ekstra / daha uzun açık kalan pazar tezgahı, isim değiştirme.
- **Sezon kartı:** her sezon oynadıkça açılan kozmetik ödüller, ücretsiz yolu da olur.
- **Destekçi paketi:** aylık küçük ücretle depo, tezgah ve o aya özel bir kozmetik.

Parayla alınan kozmetikler **takas edilemez**, dış sitelerde satılık mala dönüşmesin.

Sosyal oyunda kozmetik iyi satar çünkü herkes seni görür (Sanalika'nın modeli de kıyafet üzerineydi). Ödeme: Steam'de Steamworks, mobilde Unity IAP.

## 17. Faz 1 İçeriği

Tek bölge (Göl), yaklaşık **60 defter kaydı**:

| Grup | Adet | Not |
|---|---|---|
| Balıklar | 20 | 10 Common, 5 Rare, 3 Epic, 1 Legendary, 1 Mythic |
| Sudan çıkan eşyalar | 15 | gözlük, bot, şişe, eski para, kristal... Renk varyantları ayrı kayıt sayılır |
| Craft malzemeleri | 8 | pul, inci, yosun, odun parçası... Balık tutarken düşer |
| Recipe'ler | 8 | "şişedeki recipe", nadir |
| Craft eşyaları | 8 | Yalnızca recipe ile. 2-3'ü üst recipe |

Bu yaklaşık **35 temel AI görseli** demektir, geri kalanı renk varyantlarıyla dolar.

### 17.1. Faz 1 Sistemleri

- Karakter seçimi (birkaç varyasyon)
- 200 kişilik sunucu, tek açık harita, hareket, yakınlık bazlı chat balonları, arkadaşa ışınlanma
- Balık tutma (atış, bekleme, vuruş, çekme mini oyunu), yem
- Coin ve NPC satışı
- XP / Level (olta, yem, takas açılışı)
- Bot önlemleri ve enerji, dinlenme alanları
- Olta dayanıklılığı ve tamir, temel / özel yem
- Drop sistemi, Tier + Float
- Envanter
- Collection Book (3 durum, sayfalar, şans bonusu)
- Collection Score ve public profil
- Recipe + craft
- Toz, güvenli takas, oyun içi pazar
- Harita ve temalı sohbet mekanları
- Envanter yığma ve depo
- Günlük görevler, sandık ve seri ödülleri
- Admin paneli
- Sunucu tarafında doğrulanan oyuncu durumu

### 17.2. Faz 1'de Olmayanlar

Steam Market, oyun içi gerçek para ödemesi, Auto-Farm, boosterlar, sezonlar, birden fazla bölge, ziyaret edilebilir sergiler, giyilebilir eşyalar, gelişmiş animasyon, quest zinciri.

## 18. Teknoloji

| Alan | Seçim |
|---|---|
| Oyun motoru | Unity 6, 2D URP. Tek projeden Steam, Web ve ileride mobil |
| Oyun sunucusu | **Nakama** (açık kaynak): giriş (Steam, Google, Apple, e-posta), ~200 kişilik sunucu (yakınlık bazlı veri gönderimi), chat, arkadaş listesi, envanter / cüzdan, liderlik tablosu. Drop ve craft sonuçları sunucu kodunda belirlenir |
| Bağlantı | WebSocket (web build ile uyumlu, bu oyun için yeterli gecikme) |
| Veritabanı | PostgreSQL |
| Barındırma | Başlangıçta tek sunucu (ör. Hetzner, Docker ile Nakama + Postgres). Büyüyünce Nakama'nın bulut hizmeti |
| Yedek | Postgres her gece Cloudflare R2'ye |
| İzleme | Grafana (sunucu metrikleri), Sentry (oyun içi hatalar), UptimeRobot (sunucu ayakta mı), GameAnalytics (oyuncu davranışı) |
| Eşya içerikleri | Unity Addressables. Yeni eşya oyun güncellemesi olmadan eklenir |
| Kod ve build | Git + Git LFS, GitHub Actions + GameCI, steamcmd ile Steam'e yükleme |
| Web yayını | Statik dosyalar: Cloudflare Pages veya itch.io |
| Admin paneli | Küçük bir web paneli (React). Av tablosu, Float oranları, sandık ve seri ödülleri sunucuda veri olarak tutulur, oyun güncellemesi gerekmeden değiştirilir. Item Art Studio ile tek yönetim aracında birleşebilir |

Yalnızca PC için yapılsaydı da bu seçimler neredeyse aynı kalırdı. Web uğruna verilen tek taviz WebSocket'tir ve bu oyun türünde fark yaratmaz.

## 19. Eşya Görseli Üretim Hattı

```
AI (ör. Perchance) → Item Art Studio (renk varyantları) → PNG + JSON → Unity Addressables
```

- Her eşya için tek, ortalanmış, önden görünüm, 128×128, şeffaf arka planlı PNG.
- Renk varyantları web aracından ayrı PNG olarak çıkar.
- Float (kir / parlaklık) görselde değil, Unity'deki shader ile oyun anında uygulanır.
- Detaylar: `itemGenerator.md`.

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

## 22. Kesinleşmemiş Parametreler

Rakamları playtest ve ekonomi simülasyonundan sonra belirlenecek:

- Balık tutma bekleme süresi ve mini oyun zorluğu
- Av tablosu oranları
- Enerji miktarı, atış maliyeti, dolum hızları
- Olta yıpranma hızı ve tamir ücreti
- Coin fiyatları (NPC satış, yem, tamir)
- Takas / pazar açılma level'ı
- XP miktarları ve level eğrisi
- Eşya drop oranları, Tier dağılımı
- Eşyaya özel Float aralıkları
- Recipe drop oranları
- Toz miktarları ve toz ile alınabilecekler
- Pazar ücreti
- Sayfa bonuslarının büyüklüğü ve üst sınırı
- Collection Score formülü
- Takas kısıtı

## 23. Bir Sonraki Aşama: Ekonomi Simülasyonu

Geliştirmeye başlamadan önce basit bir tablo / simülasyon ile şunlar hesaplanmalı:

- N oyuncunun günde ürettiği av sayısı
- Tier ve kondisyon bazında günlük eşya üretimi
- Mythic ve Pristine Mythic üretimi
- Recipe üretimi ve tüketimi
- Craft girdi maliyeti / çıktı beklenen değeri
- Kopya oranı, toz ve diğer sink'lerin yaktığı miktar
- 30 / 90 / 180 günlük arz ve enflasyon
- Collection bonusunun oyuncu ilerleme hızına etkisi

---

## 24. Geliştirme Fazları

Her faz **oynanabilir bir sürümle** biter ve arkadaşlarla web build üzerinden test edilir.

| Faz | İçerik | Bitince ne var? |
|---|---|---|
| **0. Hazırlık** | Git repo + LFS, Unity 6 projesi, Nakama + Postgres (Docker, yerel), LPC karakter, ekonomi simülasyon tablosu | Boş ama çalışan iskelet |
| **1. Birlikte yürümek** | Giriş, sunucu listesi, küçük harita, 2+ oyuncu yürür (fare + WASD), yakınlık bazlı chat balonları | Arkadaşlar aynı haritada yürüyüp konuşabiliyor |
| **2. Balık tutma** | Atış / bekleme / sahte kıpırdama / vuruş / çekme, sunucu tarafı drop, item instance + Tier + Float, çanta, enerji, temel yem | Balık tutulup eşya kazanılıyor |
| **3. Collection** | Collection Book (yuvalar, 3 durum, "Yeni keşif!"), şans bonusu, Collection Score, profil kartı, showcase, arkadaşlar, ışınlanma, emote | Statü ve koleksiyon döngüsü çalışıyor |
| **4. Ekonomi** | Coin, NPC satış, toz, birleştirme, recipe + craft, olta tamiri, özel yemler, depo | Kopyalar anlamlı, craft yapılıyor |
| **5. Ticaret ve güvenlik** | Takas penceresi, pazar panosu, alım ilanı, whisper, moderasyon, bot önlemleri, takas kayıtları | Oyuncular arası ekonomi açık |
| **6. İçerik ve araçlar** | Günlük görev, sandık, seri; admin paneli; Item Art Studio JSON / şeffaf arka plan; ilk 3 set | Canlı oyun yönetilebiliyor |
| **7. Yayın** | Tutorial / ilk deneyim, Steam sayfası, Steam Playtest, kozmetik mağaza, hukuki kontrol | Steam'de açık test |

## 25. Geliştirme Düzeni (Agent'lar)

Tek geliştirici + Claude Code agent'ları. Tek bir **monorepo**:

```
collection-game/
├── client/      Unity projesi (C#)
├── server/      Nakama modülleri (TypeScript)
├── tools/       Item Art Studio + admin paneli (React)
├── content/     sets/ (set.json, prompts.md), PNG'ler
└── docs/        colectionGame.md, itemGenerator.md, protokol.md
```

| Rol | Sorumluluk | Not |
|---|---|---|
| **Server agent** | Drop, Float, enerji, ekonomi, craft, takas, pano kuralları | En kritik kısım; hile önleme burada. Her kural birim testli |
| **Client agent** | Unity: hareket, balık mini oyunu, UI, defter, chat | Unity editörü Onur'un bilgisayarında çalıştığı için bu agent yerelde çalışır |
| **Tools agent** | Item Art Studio, admin paneli | Bağımsız, paralel ilerleyebilir |
| **Test / review agent** | Server kurallarına test yazar, her değişikliği inceler, ekonomi simülasyonunu günceller | Her fazın sonunda çalışır |
| **Set generator** | `collection-set-generator` skill'i ile içerik üretir | Ayrı konuşmalarda |

Kurallar:
- Önce **`docs/protokol.md`**: client ile server arasındaki mesajlar (atış, vuruş, sonuç, takas...) yazılı hale getirilir. Client ve server agent'ları bu sözleşmeye göre çalışır, böylece birbirini bozmaz.
- Repo kökünde bir **CLAUDE.md**: tasarım dokümanının temel kuralları (sunucu her sonucu belirler, parayla eşya miktarı artmaz vb.). Her agent bunu okur.
- Başta agent'lar **sırayla** çalışır (önce server, sonra client). Faz 3'ten sonra paralel çalışabilir.
- Her faz bir **PR** ile biter; test / review agent onaylamadan birleştirilmez.

## 26. Açık Sorular

1. Sohbet mekanlarında aktivite olsun mu? (öneri: önce sadece sohbet)
2. Seri kaçırılınca: sıfırlansın mı, 3 gün geri mi düşsün? (öneri: geri düşsün)
3. Şans bonusu sayfa başına ve +%25 sınırlı mı olsun? (öneri: evet)
4. Takas kısıtı: tekrar takas yok mu, yoksa 7 gün bekleme mi? (ertelendi)
5. Recipe'ler de Collection Book'ta yer alsın mı?
6. Dış sitelerdeki gerçek para satışı için hukuki görüş (yayından önce).
