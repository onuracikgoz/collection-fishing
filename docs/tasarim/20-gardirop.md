# Gardırop (giyilebilir kozmetikler)

> Kararlar: Onur, 01-03.11.2026 ("Gardırop craft tablosu" konuşması) ve 16.11.2026. Protokol: `docs/protokol.md`, Gardırop. Craft tablosu: `content/wardrobe/craft-tablosu.xlsx`.

## 1. Gardırop collection'dan ayrıdır

- Giyilebilir parçalar (kıyafet, saç, şapka, gözlük, takı, kanat...) **collection eşyası değildir**: Float yoktur, defterde yer almaz, Collection Score'a sayılmaz, çantada durmaz. Kendi **Gardırop** ekranları vardır.
- Her parçanın **sabit bir Tier'ı** vardır (kalıbından gelir, craft tablosu kural 1). Rengin Tier'ı parçanın Tier'ını değiştirmez. Efekt rengiyle (Gökkuşağı, Alev...) yapılan parça Mythic'tir. Bir karakter istediği kadar Mythic parça giyebilir (karar 16.11.2026).
- Parçalar **Universal LPC** karakter setinden gelir (karar 16.11.2026; Universal-LPC-Spritesheet-Character-Generator'daki her şey). Oyundaki karakter de Universal gövdeyle çizilir, Revised bırakılır. Bir parça **gri / temel paletle bir kez** saklanır, rengi oyunda kodla boyanır (ton dizisi eşlemesi, denendi: LPC'nin kendi renkli dosyasıyla piksel piksel aynı). Renk listesi ve Tier'ları craft tablosundaki Renkler sayfasıdır.

## 2. Kimlik bedavadır

- Gövde (2 tip), ten, kafa ve göz rengi her zaman bedava seçilir, satılmaz, takas edilmez.
- Craft tablosunda **Başlangıç (bedava)** işaretli parçalar (temel saçlar, tişört, uzun kollu, kolsuz, pantolon, şort, düz etek, ayakkabı) herkese açıktır. Bunlar **bedava renklerde** giyilir: saçta doğal saç renkleri, kıyafette Common boyalar (Öneri, `config.ts` `WARDROBE.freeColorTiers`).
- Böylece herkes ilk dakikada kendine benzeyen bir karakter yapar; nadir renkler ve diğer bütün parçalar oyunda aranır.
- Görünümünü hiç seçmemiş oyuncuya sunucu, kimliğinden türetilen bedava bir görünüm verir (bugün client'ın yaptığı gibi rastgele ama her yerde aynı).

## 3. Elde etmenin üç yolu (karar 16.11.2026)

| Yol | Ne olur | Takas | Süre |
|---|---|---|---|
| **Craft** | Kalıp + malzemeler + renk (craft tablosu). Sınırsız, kalıcı | Edilebilir | Kalıcı |
| **Coin ile kiralama** | Prova odasında denenen parça, Coin'le süreli | Edilemez (kilitli) | Süreli |
| **Elmasla kiralama** | Aynısı, elmasla. Elmas gerçek parayla da alınabilecek (Faz 7) | Edilemez (kilitli) | Süreli |

- **Legendary ve Mythic kiralanmaz**, sadece craft ile gelir (karar 16.11.2026). Statü parayla alınmaz.
- **Kiralık parça kilitlidir:** takas, pazar, satış, parçalama yok. Süresi bitince gardıroptan silinir, giyiliyse çıkarılır ve yerine kimlik parçası gelir. Başkaları kiralık parçayı küçük bir işaretle (saat) görür, craft edilmiş olanla karışmaz.
- Elmasla kiralama oyuna etki etmez: eşya miktarını ya da kalitesini artırmaz (kural 2), sadece süreli görünümdür. Elmas takas edilmez (`11-monetization.md`).
- Kiralama süreleri ve fiyatları **Öneri**, sonra konuşulacak (`acik-sorular.md` 32).

## 4. Giymek

- Her parçanın bir **yuvası** vardır (LPC'deki katman türü: saç, sakal, şapka, gözlük, kolye, gömlek, ceket, pelerin, kanat...). Bir yuvada aynı anda bir parça olur.
- Parçalar gövde tipine göre çizilir; bazı parçalar sadece bir gövde tipinde vardır.
- Gardırop penceresinde oyuncu **bütün katalogu dener** (prova odası, sadece kendi ekranında). **Kaydet** sadece sahip olduğu ya da bedava parçalarla olur; sunucu bütün görünümü doğrular ve yakındakilere yayar.
- Görünüm kalıcıdır, oyundan çıkıp girince geri gelir.

- **Pencere** (G ya da HUD'daki Gardırop düğmesi): solda önizleme (çevir düğmeleriyle dört yön), gövde, ten ve göz; sağda sekmeler (Üst, Alt, Ayak, Şapka, Saç, Kanat, Takı, Diğer), 12'lik sayfalar halinde parçalar ve seçili parçanın renkleri. Listede önce oyuncunun eşyaları, sonra bedava parçalar, sonra denenecekler gelir. Denenen bir parça varken **Kaydet** kapalıdır.
- Çizim: Universal LPC sayfaları (`client/Assets/Art/LPC/Universal`, `tools/wardrobe/import_lpc.py` ile alınır), renk oyunda ramp'la boyanır. Ayrıntı: `docs/araclar/gardirop-sprite.md`.

## 5. Admin paneli

- **Gardırop** sekmesi: katalog (Tier, aktiflik, bedava) ve bir oyuncunun gardırobu.
- **Oyuncuya ver:** parça, renk, kalıcı ya da süreli (gün), takas edilebilir mi. Test ve destek içindir; verilen parça oyuncunun gardırobuna hemen düşer.
- **Geri al:** oyuncunun bir parçasını siler; giyiliyse oyunda hemen çıkar.

## 6. Henüz yok

- Craft (kalıp, malzemeler, Terzi), kiralama ekranı ve fiyatları, gardırop parçalarının takas penceresine ve pazara girmesi, Mythic efektlerin çizimi. Craft tablosu hazır; bunlar ayrı işler olarak gelir.
