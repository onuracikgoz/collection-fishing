# Balık Tutma, Enerji, Görevler

> Kaynak: tasarım dokümanı v0.8, bölüm 5. Numaralar eski dokümana atıf için korunmuştur.

## 5. Farm Mekaniği: Balık Tutma

Balık tutma seçildi çünkü:

- Her kültürde anlaşılır, cinsiyet ayrımı olmadan sevilir (Stardew, Animal Crossing, Roblox balık oyunları). Ton sevimli ve rahat tutulur.
- Ritmi sohbete uygundur: olta at → bekle → kısa zamanlama anı. Beklerken yazışılır.
- "Ansiklopedi doldurma" oyuncunun zaten bildiği bir collection hedefidir.

Akış:

1. **At:** suya tıklayınca karakter su kenarına yürür. Basılı tutunca güç çubuğu dolar, bırakınca atış yapılır. Üç mesafe: **kıyı, orta, derin**. Oltanın level'ı en uzak mesafeyi belirler.
2. **Bekle:** banda göre rastgele (kıyı 5–10, orta 8–15, derin 12–20 sn; bkz. Bantların dengesi), süreyi **sunucu** belirler. Bu sırada chat yapılır. Şamandıra arada **sahte kıpırdar**; sahte kıpırdamada çekersen balık kaçar.
3. **Vuruş:** gerçek vuruşta şamandıra tamamen batar, ses gelir. Tıklama penceresi Common'da ~0.6 sn, Mythic'te ~0.35 sn.
4. **Çekme:** Stardew tarzı, kaçan balık simgesini çubuğun içinde tutma mini oyunu. Common'da ~2 sn ve sakin, Mythic'te ~8 sn ve hareketli. Başarısızsa balık kaçar.

**Kontroller:** atış fare ile, çekme fare veya Space ile.

**Hareket:** ana yöntem fare (tıkla, oraya git; Sanalika / Club Penguin gibi, tek elle yürüyüp diğer elle yazmayı sağlar, mobilde dokunmatikle doğrudan çalışır). WASD de desteklenir. Enter chat'i açar, yazarken hareket tuşları devre dışı kalır.

### 5.0.0. Ne Çıkacağını Ne Belirler

- **Nokta (göl):** neyin çıkabileceğini belirler. Noktanın havuzunda olmayan eşya orada asla çıkmaz.
- **Mesafe:** havuzu kıyı / orta / derin olarak böler. Bazı eşyalar yalnızca derinde çıkar.
- **Yem:** havuz içindeki oranları kaydırır, yeni eşya eklemez. Uygun olmayan noktada özel yem boşa gider.
- Örnek: mağara gölü + derin su + kristal yem = en nadir kristallere en yakın kombinasyon. "Mavi kristal nerede, hangi yemle çıkıyor?" doğal bir sohbet konusudur.

#### Eşyanın çıkış alanları (karar 28.10.2026)

Her eşyanın verisinde neyin, nerede, ne zaman çıktığı yazar. Sunucu drop'u bunlara göre süzer; defterde ve dev dashboard'unda da aynı alanlar okunur.

| Alan | Anlamı | Boşsa |
|---|---|---|
| `waters` | Çıktığı su noktaları (ör. `buyuk_gol`, `sazlik`, `magara_golu`; liste `16-ilk-harita.md`) | Her suda |
| `bands` | Derinlik: `shore` (kıyı), `mid` (orta), `deep` (derin) | Her bantta |
| `baits` | Şansını artıran özel yemler. O yemle atılınca eşya kendi kategorisi içinde daha sık seçilir (Öneri: ×3) | Hiçbir yem öne çıkarmaz |
| `minLevel` | Çıkmaya başladığı oyuncu level'ı. Altındaki oyuncuda bu eşya havuzda yoktur, yerine aynı kategoriden başka eşya gelir | Level 1 |

- Yem yeni eşya eklemez (5.0.0): `baits` sadece havuzdaki bir eşyanın ağırlığını artırır.
- `waters` id'leri harita dosyasındaki isimli sulardır (`docs/protokol.md`, Harita dosyası, `waters`). Şimdilik haritada sadece `buyuk_gol` var; diğer sular haritaya çizildikçe eklenir.
- `minLevel` oyuncunun XP level'ıyla karşılaştırılır (`04-xp-level.md`); yeni oyuncu level 1'dir.
- Defter bu alanları **göstermez** ("Mavi kristal nerede çıkıyor?" keşif ve sohbet konusu kalır). Sadece eşya bir kez yakalanınca nerede tutulduğu deftere işlenebilir (sonra konuşulacak).

#### Bantların dengesi (Öneri, 28.10.2026)

Amaç: iyi oltası olan oyuncu her zaman derine atmasın, kıyı da kârlı kalsın.

1. **Her bandın kendine özel eşyası var.** Sadece derinde değil, sadece kıyıda veya ortada çıkan kayıtlar da olur (kıyıya özel Epic / Legendary dahil). Defteri bitirmek her bandı gerektirir.
2. **Craft malzemesi en çok kıyıda çıkar.** Derin nadir eşya verir, kıyı recipe'lerin istediği malzemeyi verir; pazarda malzemeye talep kıyıyı kârlı tutar. (Öneri: kıyıda malzeme oranı ×2, derinde ×0.5.)
3. **Saatlik getiri yakın, tempo farklı.** Kıyıda bekleme 5–10 sn ve çekme kolay; derinde bekleme 12–20 sn ve çekme zor. Derin daha nadir ama saatte daha az av ve daha çok kaçırma demektir: kıyı istikrarlı, derin kumar.
4. **Derinin maliyeti var.** Derin av oltayı 2 kat yıpratır; kristal yem sadece derinde işe yarar.

Sunucudaki değerler (hepsi Öneri, `server/src/config.ts`):

| | Kıyı | Orta | Derin |
|---|---|---|---|
| Bekleme (`FISHING.wait`) | 5–10 sn | 8–15 sn | 12–20 sn |
| Çekme (`FISHING.reel`, Tier'ın oyununun üstüne) | bar ×1.1 | aynı | bar ×0.9, balık hızı +1 |
| Kategori çarpanı (`CATCH.bandBoost`) | malzeme ×2, Epic/Legendary ×0.6 | malzeme ×1.3, Rare ×1.2, Epic ×1.5 | malzeme ×0.5, Rare ×1.3, Epic/Legendary ×2, Mythic ×2 |
| Olta yıpranması (`ROD.wear`) | 1 | 1 | 2 |

- Derin "daha nadir" olsun diye yüksek Tier çarpanı derinde, ama saatte daha az av ve daha çok kaçırma bunu dengeler. Kıyıya özel Epic/Legendary var, sadece daha seyrek.
- Yer tutucu havuzla simülasyon (`server/test/balance.test.ts`, usta çekici + Tier ve derinliğe göre kaçırma): saatte Coin kıyı ~2500, derin ~2900; malzeme kıyı ~69, derin ~11; Epic+ kıyı ~5.6, derin ~10. Test, kıyı/derin Coin oranı 0.7–1.3 dışına çıkarsa kırılır.
- Yemin eşyaya etkisi: atılan yem bir eşyanın `baits` listesindeyse eşya kendi kategorisinde ×3 ağırlık alır (`CATCH.baitItemFactor`). Yemin işe yaramadığı bantta (kristal yem kıyıda) bu da olmaz.

İleride: sunucu her gün bir noktada bir eşyayı "bol" ilan eder ("Bugün Sazlık kıyısında yengeç bol").

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

> **Değişiklik önerisi (28.10.2026):** Common %50'den %12'ye iner, aradaki fark yeni **sıradan balık** kategorisine (%38, defter kaydı değil) gider. Ayrıntı: `18-gunluk-gorevler.md`.

Saatte ~30 değerli şey (malzeme, Rare ve üstü) çıkar. Hedeflenen defter temposu: Common'lar ilk gün, Rare'ler birkaç gün, Epic'ler 1–2 hafta, Legendary birkaç hafta, Mythic ve Pristine kovalamak aylar. Oranlar sunucuda tutulur, playtest'te ayarlanır.

**Sudan her şey çıkabilir:** balık, sandık, eski gözlük, şişe, eski para, kristal, craft malzemesi, şişedeki recipe. Böylece AI ile üretilen herhangi bir temadaki eşya oyuna uyar.

İkinci bir toplama yöntemi (bahçe / toprak kazma) ileride aynı drop sistemiyle eklenebilir.

### 5.1. Sunucu Doğrulaması

Her balık tutma aksiyonu sunucu tarafından doğrulanır. Client'ın "yakaladım" demesi ödül üretmez. Sunucu zamanlamayı, cooldown'u, oyuncu ve konum durumunu kontrol eder ve sonucu kendisi belirler.

### 5.1.1. Bot Önlemleri

Eşyalar dış sitelerde gerçek para edeceği için bot koruması zorunludur. Tam koruma yoktur, amaç bot ve çoklu hesap maliyetini artırmaktır:

- Vuruş zamanı, şamandıra hareketi ve mini oyun her seferinde farklıdır.
- **Enerji** (bkz. 5.0.0.3) günlük av sayısını sınırlar. Enerji **satılmaz**.
- Takas ve pazar için **kısıtlı olmayan Steam hesabı** (Steam'de harcama yapmış hesap) ve belli bir oyun süresi şartı aranır (Faz 7, Steam girişiyle). Ücretsiz oyunda bot hesabı açmayı pahalılaştırır.

**Takas kapıları (Faz 5):**

- Takas ve pazar **level 10** (Öneri) ve **e-posta eklenmiş hesap** ister. İkisi birden yoksa takas penceresi ve pazar açılmaz.
- **Misafir hesap** (sadece cihaz kimliğiyle giriş) e-posta eklemeden takas ve pazar kullanamaz; balık tutar, koleksiyon yapar, craft eder.
- **Yeni hesaplara takas sınırı:** hesap açıldıktan sonraki ilk **7 gün** (Öneri) takas ve pazar satışı günlük adet ve değerle sınırlıdır (sayılar Öneri, playtest sonrası). Botla açılıp hemen ana hesaba boşaltılan hesapları yavaşlatır.

**Hesap açma (Faz 5):**

- **Tarayıcı / cihaz başına bir misafir hesap.** Cihaz kimliği artık kullanıcı adını içermez; aynı tarayıcıdan farklı adla yeni misafir hesap açılmaz, eski hesaba girilir. Yeni hesap için e-postalı kayıt gerekir. (Bugün client `DeviceIds.For(username)` ile adı kimliğe katıyor; Faz 5'te değişecek.)
- **IP başına gevşek sınır:** bir IP'den günde en çok **10 yeni hesap** (Öneri). Mobil ağlarda (CGNAT) yüzlerce kişi aynı IP'yi paylaşır; bu yüzden sınır gevşek tutulur ve IP tek başına hiçbir zaman ban sebebi değildir, sadece ek sinyaldir.

**İzleme: önce işaretle, sonra insan baksın.**

Sunucu otomatik ban vermez. Şüpheli davranışı **işaretler**, bir insan inceleyip karar verir. Bütün eşikler sunucu config'indedir (`server/src/config.ts`, `WATCH`, hepsi Öneri). Bugün işaretler geliştirici dashboard'unun **Şüpheliler** sekmesinde görülür (sadece geliştirme sunucusu, `DEV_TOOLS`); canlı oyunda aynı veri Faz 6 admin paneline taşınır.

| İşaret | Ne zaman | Güç |
|---|---|---|
| Vuruş çok düzenli | Son 30+ ısırmada vuruş tepkisinin sapması çok küçük (≤ 40 ms) | Güçlü |
| Vuruş çok hızlı | Ortalama tepki insan sınırının altında (< 150 ms) | Orta |
| Çekme kusursuz | Son 30+ çekmede balık neredeyse hiç çubuktan çıkmıyor (‰985+) ve kaçırma ≤ %2 | Güçlü |
| 7/24 oynuyor | 20+ saat aralıksız atış ya da haftanın 140+ saatinde aktif | Güçlü |
| Hiç konuşmuyor | 500+ atış, hiç chat | Zayıf |
| Hep aynı yer | 200+ atışın %90'ı aynı tile'dan | Zayıf |
| Tek yönlü akış | Bir hesaba 3+ takasla 1000+ değer gidiyor, verdiğinin %80'i o hesaba, geri gelen ≤ %10 (Faz 5 takas kayıtlarından) | Güçlü |
| Aynı IP'den çok hesap | Bir IP'den son 24 saatte 10'dan fazla hesap açılmış | Zayıf |
| Aynı IP'den çok oturum | Bir IP'den aynı anda 10'dan fazla oyuncu oyunda | Zayıf |

Her işaretin ağırlığı vardır; inceleme listesi ağırlık toplamına göre sıralanır. Zayıf işaretler tek başına bir şey söylemez, güçlülerle birlikte anlam kazanır. Sunucu bunları zaten aldığı mesajlardan çıkarır (ısırma ve HOOK zamanı, REEL_DONE girdileri, atış yeri, chat, giriş IP'si); client'a yeni bir şey sorulmaz.

### 5.2. Günlük Görevler ve Sandık

- Balıkçı NPC'sinin sıradan balık siparişleri: günde 3 görev, Coin ödülü. Ayrıntı: `18-gunluk-gorevler.md`.
- "3 balık tut", "birinin collection'ına bak" gibi günlük görevler. Sosyal davranışı da ödüllendirir.
- Ödül olarak **sandık**: içinden eşya çıkan kutu. Faz 1'de sandık yalnızca günlük görev ödülüdür.
- Sandıklarda garanti ödüller olabilir (ör. "garanti 1 recipe").
- **Seri (streak):** görevler art arda yapıldıkça sandık değerlenir. 1–10 günlük takvim, **10. gün sandığı en iyisidir** (ör. garanti İyi recipe).
- **(Öneri)** Bir gün kaçırılınca seri sıfırlanmaz, 3 gün geri düşer.
- Sandık içerikleri ve seri ödülleri **admin panelinden** ayarlanır (bkz. 18). Şimdilik `server/src/data/quests.ts` (Öneri değerler): günde 3 görev, gün 00:00 Türkiye saati, sandık Coin + toz + malzeme / yem / recipe verir, Float'lı eşya vermez. Mesajlar: `protokol.md` Günlük görev.
- Sandık veya anahtar **asla gerçek parayla satılmaz.** Eşyaların gerçek para değeri olduğu için bu doğrudan kumar sayılır.
