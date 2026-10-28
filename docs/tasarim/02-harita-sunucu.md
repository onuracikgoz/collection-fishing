# Sunucular ve Harita

> Kaynak: tasarım dokümanı v0.8, bölüm 4. Numaralar eski dokümana atıf için korunmuştur.

## 4. Sunucular ve Harita

### 4.0. Tek Açık Harita

- **Oda yoktur.** Her sunucu tek bir açık haritadır; göller, temalı sohbet mekanları (kafe, plaj, disko, kütüphane vb.) ve izbe köşeler aynı haritadadır (Club Penguin / Sanalika / IMVU havası).
- **Sunucu kapasitesi ~200 oyuncu.** Oyuncu sunucu listesinden doluluğa bakıp seçer: `Sunucu 3 — 142 / 200`.
- **Her sunucuda aynı harita** vardır, her sunucu haritanın bir kopyasıdır.
- Sunucuları ayıran harita değil kimliktir: **dil** (Türkçe, İngilizce...), **isim** (ör. "Mercan", "Liman") ve ileride sunucuya özel etkinlikler.
- Neden aynı harita (karar teyidi 21.10.2026): tek çizim; balık noktası havuzları konuma bağlı olduğu için "kristal Mağara Gölü'nde çıkar" bilgisi her sunucuda doğru kalır; arkadaşa ışınlanma oyuncuyu tanıdığı haritaya indirir; çarpışma verisi tek dosyadır (`content/maps/lake.json`, `docs/protokol.md` Harita dosyası).
- **(Öneri)** Sunucuya özel görünüm gerekirse yalnızca **dekor katmanı** değişir: çarpışmasız süsler (bayrak, fener, festival süsü), sunucu verisinden açılıp kapanır. Zemin, su, yol, bina ve balık noktaları her sunucuda aynıdır. Henüz yapılmadı (bkz. `acik-sorular.md` 19).
- Mevsimler (bölüm 15) tüm sunucularda aynı anda değişir: tilemap aynı kalır, sadece tile görselleri değişir (LPC'de her terrain / ağaç / bitki dosyasının ilkbahar, sonbahar, kış sürümü var).
- Oyuncular takılacakları yeri kendileri seçer, "anime severler kafede takılır" gibi **niş topluluklar** kendiliğinden oluşur.
- Oyuncu isterse kalabalıkta sohbet ederek, isterse kimseyle konuşmadan izbe bir yerde balık tutabilir.

### 4.0.1. Başlangıç Noktası ve Arkadaşlar

- İlk girişte **meydanda** başlar (herkesin geçtiği canlı yer). Sonraki girişlerde son kaldığı yerde başlar.
- **"Arkadaşının yanına git":** arkadaş listesinden tek tıkla ışınlanma. Arkadaş başka sunucudaysa oyun o sunucuya geçirir. "Gel balık tutarken muhabbet edelim" bu sayede kolaydır.

### 4.0.2. Balık Noktaları

- Haritanın her yerinde: meydan yanındaki kalabalık iskeleden ormanın arkasındaki küçük gölete kadar.
- **(Öneri)** İzbe ve uzak noktalarda bazı nadir balıklar çıkar, oraya gitmek için sebep olur.
- Faz 1'de tek bölge (Göl) vardır; her noktanın havuzu Göl havuzunun bir alt kümesidir.
- İlk haritanın yerleşimi ve noktaların listesi: `16-ilk-harita.md`.

### 4.0.3. Yakınlık

- Chat balonları yalnızca **yakındaki** oyunculara görünür. İzbe yerdeki oyuncu kalabalığı duymaz, kendi sohbeti de duyulmaz.
- Sunucu her oyuncuya yalnızca yakınındaki oyuncuların hareketini gönderir (200 kişi Nakama için sorun değil).
- **(Öneri)** Sohbet mekanlarında başta yalnızca sohbet, ileride küçük mini oyunlar.
- İleride: oyuncunun kendi isimli odasını açması (IMVU tarzı).

### 4.1. Bölgeler (Sonraki Fazlar)

- Her bölge ayrı bir harita dosyasıdır ve o da her sunucuda aynıdır: harita sayısı bölge sayısı kadardır, sunucu sayısıyla artmaz.
- **Bölgelerde level kilidi yoktur.** Her oyuncu her bölgeye girebilir.
  - Sebep: level kilidi farklı level'daki arkadaşları ayırır ve oyuncu kitlesini böler. Sosyal bir oyunun en büyük düşmanı boş bir haritadır.
- İlerleme bölgeden değil **olta ve yemden** gelir. Aynı gölde yeni oyuncu kıyıya yakın atar, deneyimli oyuncu derin suya ulaşır. Herkes aynı yerde ama farklı havuzlardan avlanır.
- Her bölgenin kendi eşya havuzu, drop oranları, recipe havuzu ve Collection Book sayfaları olur. Oyuncu bir bölgeye "orada şu balık çıkıyor" diye gider.
- Başkasının sergisini / odasını ziyaret etme fikri sonraki aşamaya bırakıldı.
