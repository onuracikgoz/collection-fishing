# Ekonomi ve Pazar

> Kaynak: tasarım dokümanı v0.8, bölüm 12. Numaralar eski dokümana atıf için korunmuştur.

## 12. Oyun İçi Pazar ve Ekonomi

### 12.1. Para Birimi: Coin

- Coin balık tutarak kazanılır: avı / kopyaları NPC'ye satarak, çöpten ve sandıklardan.
- Coin harcanır: yem, olta tamiri, pazar ücreti, NPC alışverişi. Bu harcamalar enflasyonu kontrol eder.
- Coin gerçek parayla satılmaz.
- Fiyatlar ve günlük Coin akışı: `16-ekonomi-tablosu.md` **(Öneri)**.

### 12.2. Gerçek Para Değeri

- **Oyun içinde gerçek para akışı yoktur.** Oyun ödeme almaz, para çekme yoktur.
- Oyuncular eşyalarını Knight Online'daki gibi **dış sitelerde** ilan verip satabilir. Teslim oyun içi güvenli takas penceresiyle yapılır.
- Hedef: nadir eşyaların gerçek değer kazanabilmesi (ör. Mythic 0.01 → ~2000$).
- Sonuçları bilinçli kabul edilir: bot çiftlikleri, hesap çalma ve dolandırıcılık girişimleri. Bu yüzden bölüm 5.1.1'deki önlemler ve güvenli takas zorunludur.
- **Hukuk:** şansla çıkan eşyanın gerçek para değeri bazı ülkelerde (ör. Belçika, Hollanda) kumar tartışmasına girebilir, kitle genç olabilir. Yayından önce avukata danışılmalı.
- Steam Community Market ileride alternatif olarak değerlendirilebilir (ödeme ve dolandırıcılık kontrolü Valve'de). O zaman v0.2'deki Steam Inventory PoC'si geçerli olur (yedek dosyada bölüm 42–44).

### 12.3. Oyun İçi Pazar (karar 28.10.2026: petle tezgah)

Knight Online pazarı gibi gezilen bir pazar, ama satıcı başında beklemez: **oyuncu petini pazar alanına bırakır, pet onun yerine satar.** Oyuncu bu sırada balık tutar, sohbet eder ya da oyundan çıkar. **Global arama ve fiyat sıralaması yoktur**; fiyatı bilmek için gezmek, sormak ve pazarlık etmek gerekir. (Eski "tek pano, arama, en ucuz üstte" tasarımı kaldırıldı.)

#### Pet tezgahı

- **Pazar alanı:** meydanın kuzeyinde ayrılmış bir bölge (`16-ilk-harita.md`). Pet yalnızca burada tezgah açar; her pet bir yer kaplar, yerler dolunca yeni tezgah açılmaz (Öneri: sunucu başına ~40 yer).
- Oyuncu pazar alanına gidip petini bırakır, bir **başlık** yazar ("Taze sazan, ucuz!", chat filtresinden geçer) ve satacağı eşyaları fiyatıyla koyar. Eşyalar tezgaha ayrılır: çantadan düşer, satılamaz, takas edilemez. Kilitli eşya (`07-kopya-envanter.md` 9.3) konamaz. Sonra istediği yere gider.
- **Görünüm:** pete yaklaşınca başlık ve **ilk 4 eşya** (ikon + fiyat) görünür. Tıklayınca (büyütünce) satılan **tüm eşyalar** açılır; Float'lı eşyada Float ve kondisyon görünür.
- Pet ekranında satıcının **profili** de açılır: oradan whisper atılır, arkadaş eklenir, defterine bakılır (bkz. `10-sosyal.md`).
- Alıcı tek tıkla satın alır; Coin satıcıya gelir (başka sunucudaysa da). **(Öneri)** Pazar ücreti satıştan %5, tezgah açma ücretsiz.
- Sıradan balık, malzeme ve recipe gibi yığılanlar **adetle** konur ("10 sazan, tanesi 12 Coin"); alıcı istediği kadarını alır.
- **(Öneri)** Tezgahta en fazla 12 kalem. Karar 29.10.2026, Onur: tezgah **oyuncu oyundayken** durur; **sunucu değiştirince kapanmaz** (açıldığı sunucuda satar, geri çağırmak için o sunucuya dönmek gerekir), **oyundan tamamen çıkınca kapanır**. En fazla 24 saat (Öneri). Kapanınca satılmayanlar **çantaya** döner (çanta dolu olsa da; aşım serbest, Öneri); oyuncu başka sunucudayken ya da sunucu durunca kapanırsa eşyalar bir sonraki girişinde döner.
- Oyuncu başına **tek** tezgah: başka sunucuda ikinci tezgah açılamaz. Pet tezgahtayken oyuncunun yanında dolaşmaz.
- Her sunucunun kendi pazarı vardır; sunucular arası fiyat farkı doğaldır.
- Level 10 ve kısıtlı olmayan Steam hesabı şartı geçerlidir (hem açan hem alan için).
- Alıcı pete en fazla 7 tile yakında olmalı (Öneri); oyuncu tezgahı pazar noktasının 14 tile yakınında açar. Satıcıya satışta bildirim gider. Mesajlar: `protokol.md` Pazar.

#### Petler

- Her oyuncunun **bedava bir başlangıç peti** vardır; pazar herkese açıktır.
- Başka pet türleri Coin veya elmasla alınır. Petlerin hepsi **aynı işi yapar**, fark sadece görünümdür (kural 2: kozmetik). Elmasla alınan pet takas edilemez.
- Pet sistemi ve pet listesi ayrı tasarlanacak (`acik-sorular.md` 22).

#### Pazar Panosu (reklam)

- Meydandaki pano bir **reklam panosudur**: tezgahı (peti pazarda) olan oyuncu **elmasla** kendini panoya ilan verir (başlık + öne çıkardığı birkaç eşya). Karar 28.10.2026, Onur: reklam bir kolaylıktır, eşya miktarı veya kalitesi artmaz.
- İlan **yalnızca tezgah açıkken** durur; tezgah kalkınca ilan da kalkar.
- Panodaki ilana tıklayan alıcı **satıcının petinin yanına ışınlanır** (aynı sunucuda; "Yanına git" kuralları, `10-sosyal.md` 13.2.1).
- Pano arama ve fiyat sıralaması yapmaz; ilanlar sırayla döner.
- **Alım ilanı** ("Mavi Kristal arıyorum, 500 Coin'e kadar") panoda kalsın mı: açık soru.

Dış sitelerde gerçek parayla satılan eşyalar pet tezgahından değil **takas penceresinden** teslim edilir. Tezgah yalnızca Coin ile çalışır.

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
