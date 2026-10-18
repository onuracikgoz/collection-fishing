# Geliştirme Fazları

> Kaynak: tasarım dokümanı v0.8, bölüm 24. Numaralar eski dokümana atıf için korunmuştur.

## 24. Geliştirme Fazları

**Şu anki faz: 0 (Hazırlık)**

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

## Faz 0: bitti sayılma şartları

- [x] Repo klasör yapısı, `CLAUDE.md`, dokümanlar bölündü
- [x] `docker-compose.yml` ile yerel Nakama + Postgres (Mac'te Docker Desktop gerekir)
- [x] `server/` TypeScript iskeleti: build, test, `healthcheck` RPC
- [x] GitHub repo (`onuracikgoz/collection-fishing`). PNG'ler LFS dışında, ses / büyük çizim LFS'te
- [x] `client/` altında Unity 6 2D URP projesi
- [ ] Unity'den yerel Nakama'ya bağlanıp `healthcheck` çağrılıyor
- [ ] LPC karakter seti seçildi, lisans notu `content/` altında
- [ ] Ekonomi simülasyon tablosunun ilk hali (`docs/tasarim/14-parametreler.md` bölüm 23)

## Faz 1: bitti sayılma şartları

- [ ] Cihaz kimliğiyle giriş (Steam girişi Faz 7'de)
- [ ] Sunucu listesi: isim, dil, kişi sayısı (`docs/protokol.md`)
- [ ] Küçük bir test haritası, çarpışmalar
- [ ] Fare tıklaması ve WASD ile yürüme, 4 yön LPC animasyonu
- [ ] 2+ oyuncu birbirini akıcı görüyor, sunucu hız sınırını uyguluyor
- [ ] Yakınlık bazlı chat balonları, mesaj sınırı ve hız sınırı
- [ ] Web build arkadaşlara linkle açılıyor (test sunucusu)

## Agent rolleri

| Rol | Sorumluluk | Not |
|---|---|---|
| Server | `server/`: kurallar, match, RPC | Her kural birim testli |
| Client | `client/`: Unity, hareket, mini oyun, UI | Onur'un Mac'inde çalışır |
| Tools | `tools/`: Item Art Studio, admin paneli | Bağımsız ilerleyebilir |
| Test / review | Testler, PR incelemesi, ekonomi simülasyonu | Her faz sonunda |
| Set generator | `collection-set-generator` skill'i, `content/sets/` | Ayrı thread'lerde |

Faz 3'e kadar agent'lar sırayla çalışır (önce server, sonra client). Her faz bir PR ile biter.
