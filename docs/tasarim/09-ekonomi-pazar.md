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

### 12.3. Oyun İçi Pazar

- Oyun içi pazarda eşya ve recipe Coin ile alınıp satılır.
- Ayrı bir Pazar Odası / tezgah sistemi **yok**; sosyal alanlar bunun yerine sohbet mekanlarıdır (bkz. 4.0).

#### Pazar Panosu

- Meydanda fiziksel bir pano; **yalnızca oradan** açılır.
- **Satış ilanı:** eşya + Coin fiyatı. Eşya panoya kilitlenir, satıcı çevrimdışıyken de satılır, Coin satıcıya gelir.
- Her ilan tek bir eşya instance'ıdır; alıcı Float ve kondisyonu görür. Aynı eşyanın farklı Float'ları ayrı listelenir.
- **Arama:** eşya adı, set, Tier, Float aralığı; en ucuz ilan üstte.
- **Alım ilanı (ertelendi, 28.10.2026):** "Mavi Kristal arıyorum, 500 Coin'e kadar" ilk sürümde yok. Arayan oyuncu sohbetten / whisper ile sorar, profildeki Currently Hunting ne aradığını gösterir.
- **İlan verme:** panoda "İlanlarım" altında çanta görünür; satılabilen bir eşyaya tıklanınca fiyat formu açılır, İptal çantaya döner. Kilitli eşya, yem ve çöp panoda satılmaz.
- Panoda benzer ilanların ortalama / en düşük fiyatı **gösterilmez**; fiyatı araştırmak oyunun parçası.
- İlan sahibine panodan **whisper** atılabilir (bkz. 13.1.2).
- **(Öneri)** Pazar ücreti satıştan %5. **İlan açma ücreti yoktur**; ücret yalnızca satış olunca alınır.
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
