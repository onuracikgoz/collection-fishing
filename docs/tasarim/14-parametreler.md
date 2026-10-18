# Kesinleşmemiş Parametreler ve Simülasyon

> Kaynak: tasarım dokümanı v0.8, bölüm 22, 23. Numaralar eski dokümana atıf için korunmuştur.

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

> İlk tablo: `16-ekonomi-tablosu.md` (fiyatlar, toz, tek oyuncunun günlük Coin akışı). N oyuncu ve 30 / 90 / 180 günlük simülasyon henüz yok.

Geliştirmeye başlamadan önce basit bir tablo / simülasyon ile şunlar hesaplanmalı:

- N oyuncunun günde ürettiği av sayısı
- Tier ve kondisyon bazında günlük eşya üretimi
- Mythic ve Pristine Mythic üretimi
- Recipe üretimi ve tüketimi
- Craft girdi maliyeti / çıktı beklenen değeri
- Kopya oranı, toz ve diğer sink'lerin yaktığı miktar
- 30 / 90 / 180 günlük arz ve enflasyon
- Collection bonusunun oyuncu ilerleme hızına etkisi
