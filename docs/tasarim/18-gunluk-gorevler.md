# Sıradan Balık ve Günlük Görevler

Durum: **taslak** (28.10.2026). Sayılar **(Öneri)**; kod henüz yok, ayrı PR ile gelecek.

Amaç: defter hızlı dolmasın, oltadan çoğunlukla sıradan balık çıksın ve bu balıkların NPC görevleri ve pazar üzerinden bir değeri olsun.

## 1. Sıradan balık

- Av tablosunda yeni bir kategori: **sıradan balık** (`fish`). Sazan, levrek, kızılgöz gibi türler.
- Float'ı yoktur, **defter kaydı değildir**, çantada tür başına **yığılır** (malzeme gibi).
- Toplam **~20 tür**. Türler sulara dağılır: Büyük Göl'de ~8 tür, diğer her suda kendine özel 2–4 tür. Haritada yeni su açıldıkça yeni türler gelir. Her tür eşya alanlarını kullanır (`waters`, `bands`, `minLevel`; bkz. `03-balik-tutma.md`).
- NPC'ye az Coin'e satılır, görevlerde istenir ve **pazarda satılabilir**.
- Ekstra bir varyant ("iri balık" gibi) **yok**; karar: sade kalsın (28.10.2026).

## 2. Av tablosu değişikliği

Common artık bu kadar sık çıkmaz; aradaki fark sıradan balığa gider. Diğer oranlar aynı kalır.

| Av sonucu | Eski | Yeni (Öneri) |
|---|---|---|
| Çöp | %25 | %25 |
| **Sıradan balık** | — | **%38** |
| Common (defter) | %50 | %12 |
| Malzeme | %12 | %12 |
| Rare | %9 | %9 |
| Epic | %3 | %3 |
| Recipe | %0.4 | %0.4 |
| Legendary | %0.5 | %0.5 |
| Mythic | %0.05 | %0.05 |

Sunucu ağırlıkları (10000 = %100): çöp 2500, sıradan balık 3805, Common 1200, malzeme 1200, Rare 900, Epic 300, recipe 40, Legendary 50, Mythic 5. Bant çarpanları (`CATCH.bandBoost`) bunun üstüne uygulanır.

- Common'ların tamamlanması ilk gün yerine birkaç güne yayılır.
- Enerji bitince yine sadece çöp çıkar. Enerjisiz atışta sıradan balık çıkması fikri reddedildi: oyuncu enerjisini koleksiyona harcamak ister (28.10.2026).

## 3. Günlük görevler

- Balıkçı NPC'si her gün **3 görev** verir. Örnek: "5 sazan getir", "Büyük Göl kıyısından 3 kerevit getir".
- Görevler **oyuncunun durumuna göre rastgele** seçilir: sadece level'ının açtığı türler ve ulaşabildiği sular/bantlar istenir. İmkânsız görev çıkmaz.
- **Adet, türün çıkma ihtimaline göre** seçilir: her görev ortalama ~15–20 enerjili atışa denk gelir. Bol türden 5, seyrek türden 1–2 istenir.
- Görev, balıkları NPC'ye teslim edince biter. Balıklar harcanır (sink).
- **Ödül: Coin.** Aynı balıkları NPC'ye satmanın birkaç katıdır (Öneri: ~4 kat). Elmas ödülü monetization netleşince değerlendirilir (`11-monetization.md`).
- Günde 1 kez görev değiştirme hakkı (Öneri).
- Yapılmayan görev **3 güne kadar** birikir (en fazla 9 açık görev), bir gün giremeyen kaybetmez (Öneri).
- Görevler gece yarısı (sunucu saati) yenilenir (Öneri).

## 4. Pazar ve görev

- Sıradan balık tezgahta **adetle** satılır (ör. "10 sazan, tanesi 12 Coin"). Float'ı olmadığı için tek tek instance değildir.
- Vakti olmayan oyuncu görev balığını pazardan alıp NPC'ye verebilir. Görev ödülü pazar fiyatından yüksekse aradaki fark kazançtır; balık tutan oyuncu da balığını NPC'den daha iyi fiyata satar. Bu, sıradan balığa doğal bir talep yaratır.
- Herkesin görevi farklı olduğu için talep türlere dağılır; tek bir tür patlamaz.
- Pazar şartları (level 10 vb.) aynen geçerlidir.

## 5. Enerji

- 3 görev ~50–60 atış ister; oyuncunun koleksiyon için en az ~100 atışı kalmalı.
- Karar (28.10.2026): enerji üst sınırı **100 → 160**, çevrimdışı dolum yine ~8 saat. Dinlenme alanlarında 3 kat hızlı dolum aynen kalır. Config sıradan balık koduyla birlikte değişir.

## 6. Sonra konuşulacak

- Görev ödülüne arada toz, yem veya düşük ihtimalle recipe eklensin mi?
- Sosyal görevler ("birinin defterine bak", `03-balik-tutma.md` 5.2) bu listeye girsin mi, sandık ödülü kalsın mı?
