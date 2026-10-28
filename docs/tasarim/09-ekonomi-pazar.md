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

### 12.3. Oyun İçi Pazar (karar 28.10.2026: tezgah)

Knight Online pazarı gibi: oyuncular pazar alanında **tezgah** kurar, alıcılar gezerek bakar. **Global arama ve fiyat sıralaması yoktur**; fiyatı bilmek için gezmek, sormak ve pazarlık etmek gerekir. Pazar böylece bir tablo değil, sosyal bir buluşma yeri olur. (Eski "tek pano, arama, en ucuz üstte" tasarımı kaldırıldı.)

#### Tezgah

- **Pazar alanı:** meydanın yanında haritada ayrılmış bir bölge (yeri `16-ilk-harita.md`). Tezgah yalnızca burada kurulur; her oyuncu bir yer kaplar, yerler dolunca yeni tezgah açılmaz (Öneri: sunucu başına ~40 tezgah yeri).
- Satıcı oturup tezgahı açar, bir **başlık** yazar ("Taze sazan, ucuz!", chat filtresinden geçer) ve satacağı eşyaları fiyatıyla koyar. Eşyalar tezgaha kilitlenir.
- **Görünüm:** tezgaha yaklaşınca başının üstünde başlık ve **ilk 4 eşya** (ikon + fiyat) görünür. Tıklayınca (büyütünce) satılan **tüm eşyalar** açılır; Float'lı eşyada Float ve kondisyon görünür.
- Alıcı tek tıkla satın alır; Coin satıcıya gelir. **(Öneri)** Pazar ücreti satıştan %5, ilan/tezgah açma ücretsiz.
- Sıradan balık, malzeme ve recipe gibi yığılanlar **adetle** konur ("10 sazan, tanesi 12 Coin"); alıcı istediği kadarını alır.
- Tezgah açıkken oyuncu AFK kalabilir ama oyunda olmalıdır. **(Öneri)** Tezgah en fazla 8 saat açık kalır, çıkışta kapanır, eşyalar çantaya döner. Çevrimdışı tezgah yok.
- **(Öneri)** Tezgahta en fazla 12 kalem.
- Her sunucunun kendi pazarı vardır; sunucular arası fiyat farkı doğaldır.
- Satıcıya tezgahtan **whisper** atılabilir (bkz. 13.1.2).
- Level 10 ve kısıtlı olmayan Steam hesabı şartı geçerlidir.

#### Pazar Panosu (reklam)

- Meydandaki pano bir **reklam panosudur**: tezgahı açık olan oyuncu, ücret ödeyerek kendini panoya ilan verir (başlık + öne çıkardığı birkaç eşya).
- İlan **yalnızca tezgah açıkken** durur; tezgah kapanınca kalkar.
- Panodaki ilana tıklayan alıcı **satıcının yanına ışınlanabilir** (aynı sunucuda; "Yanına git" kuralları, `10-sosyal.md` 13.2.1).
- Pano arama ve fiyat sıralaması yapmaz; ilanlar sırayla döner.
- **Ücret: elmas** (karar 28.10.2026, Onur). Reklam bir kolaylık sayılır; eşya miktarı veya kalitesi artmaz.
- **Alım ilanı** ("Mavi Kristal arıyorum, 500 Coin'e kadar") panoda kalsın mı: açık soru.

Dış sitelerde gerçek parayla satılan eşyalar tezgahtan değil **takas penceresinden** teslim edilir. Tezgah yalnızca Coin ile çalışır.

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
