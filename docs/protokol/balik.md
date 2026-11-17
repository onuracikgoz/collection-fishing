# Protokol: Balık tutma, olta ve özel yem

Genel kurallar ve op code dizini: `docs/protokol.md`.

## Balık tutma (Faz 2)

Kurallar: `docs/tasarim/03-balik-tutma.md`. Bu bölümdeki her sonuç sunucuda hesaplanır; client yalnızca niyet ve mini oyundaki tuş girdisini gönderir.

Yem: `bait` verilmeyen atış temel yemle yapılır (bedava, sınırsız, oranları kaydırmaz). Özel yemler Faz 4'te geldi, bkz. Olta ve özel yem.

| Op | Yön | Ad | Gövde |
|---|---|---|---|
| 9 | C → S | `CAST` | `{ x, y, bait? }` (şamandıranın düşeceği nokta, tile; `bait` özel yemin `defId`'si, Faz 4) |
| 10 | S → C | `BOBBER` | `{ id, x, y, band, state, energy?, bait? }` (oyuncunun kendisi ve onu görenler; `energy` ve `bait` sadece oyuncunun kendi `cast` mesajında: atıştan sonraki enerji ve kalan yem) |
| 11 | C → S | `HOOK` | `{}` (oyuncu çekti) |
| 12 | S → C | `REEL_START` | `{ seed, params }` (sadece oyuncunun kendisi) |
| 13 | C → S | `REEL_DONE` | `{ inputs: [ms, ...] }` |
| 14 | S → C | `FISH_END` | Görenlere `{ id, outcome, defId? }`; oyuncunun kendisine ayrıca `reason?, item?, stack?, energy, book?, rod?, xpGain?, diamond?` |
| 15 | C → S | `CANCEL` | `{}` (oltayı topla) |

- `band`: `"shore"`, `"mid"`, `"deep"`. `state`: `"cast"` (şamandıra suda), `"twitch"` (sahte kıpırdama), `"bite"` (gerçek vuruş, şamandıra battı).
- `outcome`: `"caught"`, `"escaped"` (mini oyunda kaçtı), `"missed"` (erken / geç çekti), `"cancelled"` (oyuncu topladı veya yürüdü), `"rejected"` (atış kabul edilmedi, `reason` ile).
- `reason` (`rejected` için): `BUSY`, `NOT_NEAR_WATER`, `NOT_WATER`, `TOO_FAR`, `BAG_FULL`; Faz 4'te `NO_BAIT`, `NO_ENERGY`, `ROD_BROKEN` (yemle atışta).
- `ItemInstance`: `{ instanceId, defId, tier, float, source, obtainedAt }`. `tier`: `common`, `rare`, `epic`, `legendary`, `mythic`. Yığılan eşyalar (çöp, malzeme) instance değildir, `stack: { defId, count }` olarak gelir.

### Akış

1. **Atış:** client güç çubuğuyla bir nokta seçer, `CAST` gönderir. Sunucu kontrol eder: oyuncu boşta mı, en yakın suya 1.5 tile içinde mi, hedef su mu, hedef en fazla 8 tile uzakta mı (Öneri), çantada yer var mı. Kabul ederse enerji 1 düşer (enerji 0 ise düşmez, sadece çöp çıkar) ve herkese `BOBBER state:"cast"` gider. Bant hedefin kıyıya uzaklığından çıkar: 2 tile'a kadar kıyı, 5'e kadar orta, ötesi derin (Öneri).
2. **Bekleme:** sunucu banda göre bir süre seçer (kıyı 5–10, orta 8–15, derin 12–20 sn, Öneri), arada 0–3 sahte kıpırdama (`twitch`) olur.
3. **Vuruş:** sunucu av sonucunu bu anda seçer ve `BOBBER state:"bite"` gönderir. Oyuncu pencere içinde `HOOK` göndermelidir: Common 600 ms … Mythic 350 ms, artı ağ payı 300 ms (Öneri). Erken (`twitch` veya bekleme sırasında) ya da geç çekmek `missed` ile biter.
4. **Çekme mini oyunu:** sunucu `REEL_START { seed, params }` gönderir. Mini oyun aşağıdaki **belirlenimci** modelle oynanır; client aynı modeli çalıştırıp çizer ve oyun bitince bastığı / bıraktığı anları `REEL_DONE` ile yollar. Sunucu aynı girdilerle modeli baştan oynatır, sonucu o belirler. `REEL_DONE` gerçek zamanda modelin bittiği andan 500 ms'den önce gelirse reddedilir (hızlandırma hilesi); `params.maxMs` + 5 sn içinde gelmezse balık kaçar.
5. **Sonuç:** `FISH_END`. Yakalanan Float'lı eşya çantaya instance olarak, çöp ve malzeme yığın olarak girer.

Oyuncu yürürse (kabul edilen `MOVE`) veya `CANCEL` gönderirse balık tutma `cancelled` ile biter. Sohbet balık tutmayı bozmaz.

### Mini oyun modeli

Tamamen tam sayı aritmetiği; client (C#) ve sunucu (TS) aynı sonucu üretmelidir. Kaynak: `server/src/rules/reel.ts`, testleri `server/test/reel.test.ts`.

- Adım 20 ms. `inputs` artan ms değerleridir; her değer basılı / bırakılı durumunu değiştirir (ilk değer basma). Adım `k`'da tuş, `k*20`'ye kadar olan değişikliklere göre basılıdır.
- Rastgelelik: `mulberry32(seed)` (32 bit, `Math.imul` / C# `uint` çarpımıyla birebir).
- Alan 0–1000. Çubuk `[bar, bar + barSize]`, balık `fish`, ilerleme `progress`.
- Başlangıç: `bar = floor((1000 - barSize) / 2)`, `vel = 0`, `fish = 500`, `target = 500`, `retargetLeft = 0`, `progress = 300`, tuş bırakılı.
- Her adım, sırayla:
  1. Basılıysa `vel += params.lift` değilse `vel -= params.gravity`; `vel` `[-params.maxVel, params.maxVel]` aralığına kırpılır. `bar += vel`; `bar` 0'ın altına inerse `bar = 0, vel = 0`; `1000 - barSize` üstüne çıkarsa `bar = 1000 - barSize, vel = 0`.
  2. `retargetLeft` 0 ise: `target = rng() % 1001`, `retargetLeft = params.retargetSteps`; yoksa `retargetLeft -= 1`. Balık hedefe en fazla `params.fishSpeed` yaklaşır.
  3. `bar <= fish <= bar + barSize` ise `progress += params.gain`, değilse `progress -= params.loss`.
  4. `progress >= 1000` yakalandı, `progress <= 0` kaçtı. `params.maxSteps` dolarsa kaçtı.
- `params`: `{ barSize, lift, gravity, maxVel, fishSpeed, retargetSteps, gain, loss, maxSteps, maxMs }`. Değerler Tier'a göre sunucu config'inden gelir: Common ~2 sn sakin, Mythic ~8 sn hareketli (Öneri).
- Referans: `server/test/fixtures/reel-reference.json` (seed, params, inputs, beklenen `{caught, steps}`). C# portu bu dosyadaki her durumu birebir üretmelidir.

## Olta ve özel yem (Faz 4)

Kurallar: `docs/tasarim/03-balik-tutma.md` 5.0.0.1–5.0.0.2, fiyatlar `16-ekonomi-tablosu.md` 4.1–4.2 (hepsi Öneri, `server/src/config.ts` `ROD`, `BAIT`).

| Op | Yön | Ad | Gövde |
|---|---|---|---|
| 28 | C → S | `REPAIR_ROD` | `{}` (oltayı Coin ile tamir et) |
| 29 | C → S | `BUY_BAIT` | `{ defId, count }` (özel yem satın al) |
| 30 | S → C | `SHOP_RESULT` | `{ action: "repair" \| "buy_bait", ok, reason?, coin, spent?, rod?, stack? }` (sadece oyuncunun kendisi) |

- **Olta:** her oyuncunun bir oltası var: `rod: { level, durability, max }`. `WELCOME` ve `get_inventory` bunu taşır. Şimdilik herkesin oltası level 1 (daha iyi oltalar XP ile gelecek, `04-xp-level.md`).
- **Yıpranma:** enerjili her av (`caught`) dayanıklılığı 1 düşürür; enerjisiz av yıpratmaz. Level 1 olta 200 avda biter (Öneri). Dayanıklılık değişince `FISH_END`'in oyuncuya giden kısmında yeni `rod` gelir.
- **Kırık olta** (dayanıklılık 0): balık tutulabilir ama enerjisiz gibi: enerji düşmez, sadece çöp çıkar, olta daha fazla yıpranmaz (Öneri; temel kural "oyuncu hiçbir zaman balık tutamıyorum durumuna düşmez").
- **Tamir:** `REPAIR_ROD` eksik dayanıklılığı Coin karşılığı doldurur. Ücret eksikle orantılı: tam tamir level 1'de 100, level 2'de 150, level 3'te 250 Coin; kısmi tamirde `ceil(eksik × tam ücret / max)`. Coin yetmezse yettiği kadar tamir edilir (en az 1 puan). `SHOP_RESULT`'ta `spent` harcanan Coin, `rod` yeni durum. `reason`: `NOT_NEEDED` (olta zaten dolu), `NOT_ENOUGH_COIN`.
- **Özel yemler:** `bait.shiny` (Parlak yem, 5 Coin) ve `bait.crystal` (Kristal yem, 20 Coin). Çantada yığın olarak durur (kutu başına 99), NPC'ye satılmaz ve parçalanmaz. `BUY_BAIT`: `count` 1–99; çantada yer ve Coin olmalı. `SHOP_RESULT`'ta `stack` yemin çantadaki yeni toplamı. `reason`: `BAD_REQUEST` (bilinmeyen yem, bozuk adet), `NOT_ENOUGH_COIN`, `BAG_FULL`.
- **Yemle atış:** `CAST { x, y, bait? }`. `bait` verilirse çantada en az 1 tane olmalı ve atış kabul edilince 1 tane harcanır; sonuç ne olursa olsun geri gelmez (erken çekme, kaçma, toplama dahil). Oyuncunun kendi `BOBBER state:"cast"` mesajı `bait: { defId, count }` ile kalan adedi taşır. Yeni `rejected` nedenleri: `NO_BAIT` (çantada yok veya bilinmeyen yem), `NO_ENERGY` (enerji yok, yem boşa gitmesin diye atış reddedilir), `ROD_BROKEN` (olta kırık, aynı sebeple).
- **Etki:** yem sadece o noktanın havuzundaki oranları kaydırır, yeni eşya eklemez. Parlak yem her bantta Rare ve Epic ağırlığını ×1.3, Legendary ve Mythic'i ×1.2 yapar. Kristal yem sadece **derin** bantta işe yarar: Epic ×1.5, Legendary ×1.5, Mythic ×2, ve aynı kategorideki kristal eşyaları (`crystal` etiketi) ×4 öne çıkarır. Uygun olmayan bantta yem boşa gider; client bunu oyuncuya söylemez (keşif konusu). Defter şansının üstüne çarpılır (Öneri).
- Tamir ve yem alımı şimdilik her yerden yapılır; haritaya NPC konunca mesafe şartı eklenecek.
