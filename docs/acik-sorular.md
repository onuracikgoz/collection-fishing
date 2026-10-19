# Açık Sorular

> Kaynak: tasarım dokümanı v0.8, bölüm 26. Numaralar eski dokümana atıf için korunmuştur.

## 26. Açık Sorular

1. Sohbet mekanlarında aktivite olsun mu? (öneri: önce sadece sohbet)
2. Seri kaçırılınca: sıfırlansın mı, 3 gün geri mi düşsün? (öneri: geri düşsün)
3. Şans bonusu sayfa başına ve +%25 sınırlı mı olsun? (öneri: evet)
4. Takas kısıtı: tekrar takas yok mu, yoksa 7 gün bekleme mi? (ertelendi)
5. Recipe'ler de Collection Book'ta yer alsın mı?
6. Dış sitelerdeki gerçek para satışı için hukuki görüş (yayından önce).
7. İlk harita yerleşimi (`tasarim/16-ilk-harita.md`, v0.1): boyut ve banka uzaklığı onay bekliyor (Faz 1 çekirdek kararı alındı).
8. Dış sitelerdeki gerçek para satışı için hukuki görüş (yayından önce).
9. Collection setlerinin malzemeleri defterde yer alsın mı, 66 eşyalık set kaç sayfaya bölünsün? (bkz. `tasarim/17-collection-setleri.md`)
10. Makara mini oyunu (Faz 2): sunucu client'ın tuş kaydını aynı seed ile yeniden oynatıp sonucu kendisi buluyor. Zorluk değerleri (`REEL_PARAMS`) simüle oyuncuyla ayarlandı (Öneri); Onur oynayıp his onayı vermeli.
11. Faz 2 eşya havuzu (`server/src/data/lake-pool.ts`) yer tutucudur; gerçek eşyalar Item Art Studio / set verisinden gelince değişecek. Dinlenme alanları (enerji yenileme) henüz yok, şimdilik çevrimdışı 8 saatte dolum var (Öneri).
12. Web build arkadaş testi için sunucu nerede barınsın? Yerel ağda Mac yeterli (sayfa ve Nakama aynı Mac'te). İnternetten açılması için bir VPS / bulut sunucu (Nakama + Postgres + statik sayfa) veya geçici bir tünel gerekiyor; https sayfa Nakama'ya da TLS (wss) ister. Maliyet ve hesap kararı Onur'un.
13. Collection Book (Faz 3): çöp ve malzemeler defterde kayıt değil, sadece Tier'lı eşyalar (Öneri). Sayfalar şimdilik yer tutucu (`server/src/data/book-pages.ts`). Şans ve Score formülü Öneri (`docs/protokol.md`, Collection Book). Kopya gelince boş yuva otomatik dolmuyor, oyuncuya soruluyor.
14. Ekonomi (Faz 4): çöp, enerjili de enerjisiz de yakalansa 1 toz veriyor (tabloda enerjili çöp 2). Çanta çöpü yığın olarak tutuyor ve nasıl yakalandığını bilmiyor; fark önemliyse ayrı eşya kimliği gerekir. NPC satış ve parçalama şimdilik her yerden yapılıyor; haritada NPC yeri belli olunca mesafe şartı eklenecek (Öneri).
15. Craft (Faz 4): recipe'ler ve zanaat eşyaları yer tutucu (`server/src/data/recipes.ts`, 3 recipe). Malzemelerin Float'ı olmadığı için yalnız malzemeyle yapılan craft'ta kalite tablosunun "Normal" satırı kullanılıyor (Öneri). Pristine craft ve av duyurusu henüz yok.
