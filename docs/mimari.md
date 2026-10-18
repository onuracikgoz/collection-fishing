# Mimari

## Teknoloji
| Alan | Seçim |
|---|---|
| Oyun motoru | Unity 6, 2D URP. Tek projeden Steam, Web ve ileride mobil |
| Oyun sunucusu | **Nakama** (açık kaynak): giriş (Steam, Google, Apple, e-posta), ~200 kişilik sunucu (yakınlık bazlı veri gönderimi), chat, arkadaş listesi, envanter / cüzdan, liderlik tablosu. Drop ve craft sonuçları sunucu kodunda belirlenir |
| Bağlantı | WebSocket (web build ile uyumlu, bu oyun için yeterli gecikme) |
| Veritabanı | PostgreSQL |
| Barındırma | Başlangıçta tek sunucu (ör. Hetzner, Docker ile Nakama + Postgres). Büyüyünce Nakama'nın bulut hizmeti |
| Yedek | Postgres her gece Cloudflare R2'ye |
| İzleme | Grafana (sunucu metrikleri), Sentry (oyun içi hatalar), UptimeRobot (sunucu ayakta mı), GameAnalytics (oyuncu davranışı) |
| Eşya içerikleri | Unity Addressables. Yeni eşya oyun güncellemesi olmadan eklenir |
| Kod ve build | Git + Git LFS, GitHub Actions + GameCI, steamcmd ile Steam'e yükleme |
| Web yayını | Statik dosyalar: Cloudflare Pages veya itch.io |
| Admin paneli | Küçük bir web paneli (React). Av tablosu, Float oranları, sandık ve seri ödülleri sunucuda veri olarak tutulur, oyun güncellemesi gerekmeden değiştirilir. Item Art Studio ile tek yönetim aracında birleşebilir |

Yalnızca PC için yapılsaydı da bu seçimler neredeyse aynı kalırdı. Web uğruna verilen tek taviz WebSocket'tir ve bu oyun türünde fark yaratmaz.

## Klasörler

```
CollectionGame/              (repo kökü)
├── CLAUDE.md                agent kuralları, her oturumda okunur
├── docker-compose.yml       yerel Nakama + Postgres
├── client/                  Unity 6 projesi (C#, 2D URP)
├── server/                  Nakama modülleri (TypeScript)
├── tools/item-art-studio/   renk varyantı aracı (React + Vite)
├── tools/admin/             admin paneli (Faz 6)
├── content/sets/            set.json, prompts.md, PNG'ler
└── docs/                    tasarım, mimari, protokol, fazlar
```

## Kim neye karar verir

**Sunucu otoritedir.** Client yalnızca niyet gönderir ("atış yaptım", "vurdum", "şunu takas etmek istiyorum"); sonucu her zaman sunucu hesaplar ve yazar.

| Sunucu (Nakama) | Client (Unity) |
|---|---|
| Drop, Tier, Float, seed | Animasyon, ses, efekt |
| Bekleme süresi ve vuruş penceresi | Mini oyunun çizimi ve girdi |
| Enerji, Coin, toz, envanter, defter | Arayüz, sadece sunucudan gelen değeri gösterir |
| Craft, birleştirme, takas, pazar | Yerel tahmin (hareket) |
| Konum doğrulama (hız sınırı) | Kamera, harita çizimi |

Client'a güvenilen tek şey oyuncunun girdisidir. Para, eşya veya olasılık hesaplayan hiçbir kod client'ta olmaz.

## Sunucu içi yapı

- **Hesap ve kalıcı veri:** Nakama hesapları, wallet (Coin, toz), storage (envanter, defter, depo). Item instance'lar storage'da tek tek kayıt.
- **Harita:** her sunucu bir Nakama *authoritative match*'tir (~200 oyuncu). Konum, chat balonu ve yakınlık bu match içinde yönetilir; her oyuncuya yalnızca yakınındakilerin verisi gönderilir.
- **İşlemler:** atış, craft, satış gibi tek seferlik işler match mesajı veya RPC ile gelir, sunucu kuralları `server/src/rules/` altındaki saf fonksiyonlarla uygular.
- **Kurallar saf fonksiyondur:** Nakama'ya bağımlı olmayan, birim testi yazılabilen kod (`rules/`) ile Nakama'ya bağlayan ince katman (`rpc/`, `match/`) ayrıdır.
- **Ayarlanabilir veriler** (av tablosu, oranlar, sandık ödülleri) koddan ayrı, sunucuda veri olarak tutulur; admin paneli bunları değiştirir.

## Ortamlar

| Ortam | Nerede | Amaç |
|---|---|---|
| Yerel | Onur'un Mac'i, `docker compose up` | Geliştirme |
| Test | Hetzner, tek sunucu | Arkadaşlarla web build testi (Faz 1'den itibaren) |
| Canlı | Hetzner, ileride Heroic Cloud | Steam yayını |
