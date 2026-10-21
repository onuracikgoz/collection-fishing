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
- [x] LPC karakter seti seçildi, lisans notu `content/` altında (deneme: LPC Revised karakterleri, `client/Assets/Art/LPC/Characters/`)
- [x] Ekonomi simülasyon tablosunun ilk hali (`docs/tasarim/16-ekonomi-tablosu.md`, bölüm 23 için)

## Faz 1: bitti sayılma şartları

- [x] Cihaz kimliğiyle giriş (Steam girişi Faz 7'de). Sunucu tarafı hazır: kullanıcı adı kuralı. Client yazıldı (giriş ekranı)
- [x] Sunucu listesi: isim, dil, kişi sayısı (`docs/protokol.md`). Sunucu tarafı hazır: `list_servers`. Client yazıldı
- [x] Küçük bir test haritası, çarpışmalar. Sunucuda geçici çarpışma verisi var (`server/src/data/lake-map.ts`), Unity haritası çizilince ondan üretilmeli. Client şimdilik aynı veriden kodla çiziyor (`MapView.cs`, `LakeMap.cs`)
- [x] Fare tıklaması ve WASD ile yürüme, 4 yön LPC animasyonu. Client yazıldı (tahmin + düzeltme)
- [x] 2+ oyuncu birbirini akıcı görüyor, sunucu hız sınırını uyguluyor. Sunucu tarafı hazır: `world` match, hız / sınır / çarpışma kontrolü, yakınlık. Client yazıldı (diğer oyuncular 150 ms gecikmeli interpolasyon)
- [x] Yakınlık bazlı chat balonları, mesaj sınırı ve hız sınırı. Sunucu tarafı hazır. Client yazıldı (Enter ile chat)
- [ ] Web build arkadaşlara linkle açılıyor (test sunucusu). Web build hazır ve yerelde / aynı ağda çalışıyor (`client/README.md`, Web build); internetten açılması için sunucu barındırma kararı bekliyor (`acik-sorular.md` 12)

## Faz 2: bitti sayılma şartları

- [x] Atış / bekleme / sahte kıpırdama / vuruş / çekme mini oyunu. Sunucu: `rules/fishing.ts`, `rules/reel.ts` (#8). Client: `Fishing/` (#9), mini oyun sunucuyla birebir (`reel-reference.json`)
- [x] Sunucu tarafı drop: göl havuzu, kıyı / orta / derin bant, ağırlıklı av tablosu (`rules/catch.ts`). Eşya havuzu şimdilik yer tutucu (`data/lake-pool.ts`)
- [x] Item instance + Tier + Float, çanta (40 kutu, yığın 99), `get_inventory`
- [x] Enerji: atış başına 1, 0'da sadece çöp, çevrimdışı 8 saatte dolum (Öneri). Dinlenme alanları henüz yok
- [x] Temel yem: bedava ve sınırsız, her atış onunla yapılır. Özel yemler Faz 4'te
- [ ] Elle oynanış onayı (Onur) ve web build ile arkadaş testi

## Faz 3: bitti sayılma şartları

- [x] Collection Book: yuvalar, 3 durum, "Yeni keşif!". Sunucu: `rules/book.ts`, `BOOK_PLACE`, `get_book` (#12). Client: defter penceresi (K), keşif bandı, "Defterdekiyle değiştir?" (#11)
- [x] Şans bonusu (sayfa başına, sınırlı) ve Collection Score. Öneri değerler, playtest sonrası ayarlanacak
- [x] Profil kartı, showcase. Sunucu: `get_profile`, `set_profile`, "Arıyorum". Client: profil kartı (P), başkasının kartı ve defteri. Level XP'yle gelecek
- [x] Arkadaşlar, ışınlanma. Nakama arkadaş API'si, `friends_status`, `GOTO_FRIEND`, `near` ile katılım. Client: arkadaş listesi (O), Yanına git. İniş noktası arkadaştan en az 1.25 tile uzakta (#13)
- [x] Emote. `EMOTE`, `show_fish`. Client: 1-6 tuşları
- [ ] Elle oynanış onayı (Onur) ve web build ile arkadaş testi

## Sürekli: mekanik önce, asset sonra

Fazlar **mekaniği** kurar; görseller ve arayüz yer tutucudur (LPC deneme seti, kodla çizilen harita, IMGUI pencereler, kodla çizilen şamandıra). Assetler sonradan tamamen değişecek, bu yüzden:

- Kural ve hesap (hareket tahmini, mini oyun, protokol) görüntüden ayrı sınıflarda durur (`LocalMover`, `ReelModel`, `Net/`); görüntü sınıfları (`MapView`, `CharacterView`, `BobberView`, pencereler) değiştirilebilir.
- Asset yolları birkaç yerde toplanır (`ArtCatalog`, `CharacterView.Appearance`, `MapView`); yeni assetler gelince sadece bunlar değişir.

## Denetim (Faz 5'ten önce, sonra her faz sonunda)

Onur'un istediği kontroller (19.10.2026). Faz 5 (ticaret ve güvenlik) başlamadan bir test/review oturumu bunları inceler:

- [ ] **Güvenlik açıkları:** sunucu otoritesi (client'tan gelen her alan doğrulanıyor mu), RPC girdileri, başka oyuncunun verisine erişim (defter / profil herkese açık, çanta değil), Nakama ayarları (`defaultkey`, konsol şifresi, yayın öncesi değişmeli), web build'de https/wss.
- [ ] **DB'yi döngüye sokan istekler:** match içi mesajlar sınırlı (MOVE tick başına 4, chat 1/sn, emote 2 sn, ışınlanma 3 sn, defter işlemi tick başına 1) ama RPC'lerde (`get_book`, `get_profile`, `get_inventory`, `friends_status`, `set_profile`) oyuncu başına hız sınırı yok; döngüyle çağrılırsa her çağrı DB okur. Atış / toplama döngüsü her atışta enerji yazar. Oyuncu başına RPC ve atış hız sınırı eklenmeli.
- [ ] **Cache:** match oyuncu durumunu (konum, enerji, çanta özeti, defter) bellekte tutar, DB'ye sadece değişince yazar. RPC'ler her çağrıda DB okur, client da pencere açılınca yeniden ister (arkadaş listesi açıkken 5 sn'de bir). Sık okunanlar (defter, profil) için kısa süreli cache ve client tarafında "değişmediyse tekrar isteme" değerlendirilmeli.
- [ ] **Kod düzeni:** client'ta `WorldController` mesaj yönlendirmesi büyüyor; faz sayısı arttıkça op koduna göre dağıtan küçük bir mesaj yönlendiricisine bölünmeli.

## Agent rolleri

| Rol | Sorumluluk | Not |
|---|---|---|
| Server | `server/`: kurallar, match, RPC | Her kural birim testli |
| Client | `client/`: Unity, hareket, mini oyun, UI | Onur'un Mac'inde çalışır |
| Tools | `tools/`: Item Art Studio, admin paneli | Bağımsız ilerleyebilir |
| Test / review | Testler, PR incelemesi, ekonomi simülasyonu | Her faz sonunda |
| Set generator | `collection-set-generator` skill'i, `content/sets/` | Ayrı thread'lerde |

Faz 3'e kadar agent'lar sırayla çalışır (önce server, sonra client). Her faz bir PR ile biter.
