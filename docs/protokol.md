# Client ↔ Sunucu Protokolü

Bu dosya client ve server agent'larının ortak sözleşmesidir. Yeni mesaj veya alan eklemeden önce burası güncellenir. Kodda op code'lar ve tipler bu tabloyla birebir aynı olur (`server/src/protocol.ts`, `client/Assets/Scripts/Net/Protocol.cs`).

- Bağlantı: Nakama WebSocket. Mesaj gövdesi **JSON** (ileride gerekirse ikili formata geçilir).
- Konum birimi: **tile** (1 tile = 32 px, ondalıklı). x sağa, **y aşağı** doğru büyür (satır 0 haritanın kuzey kenarı). Süreler milisaniye.
- Unity tarafında 1 tile = 1 birim ve dünya konumu `(x, -y)`; sunucu tile'ı `(sütun, satır)` tilemap hücresi `(sütun, -satır - 1)` olur (`client/Assets/Scripts/World/LakeMap.cs`, `Coords`).
- Sunucu tick hızı: **10 Hz** (Öneri).
- Sürüm: client bağlanırken `protocolVersion` gönderir; uyuşmazsa sunucu reddeder.

`protocolVersion = 1`

## Giriş

| Adım | Nasıl |
|---|---|
| Faz 1 | `authenticateDevice` (cihaz kimliği) + kullanıcı adı |
| Faz 7 | `authenticateSteam` |

- Kullanıcı adı ilk girişte (hesap oluşurken) gönderilir. Kural: **3–16 karakter**, harf (Türkçe harfler dahil), rakam ve `_` (Öneri). Uymazsa giriş `BAD_REQUEST` ile reddedilir. Ad başkasındaysa Nakama'nın kendi hatası döner.
- Ad gönderilmezse Nakama rastgele bir ad atar, bu yüzden client ilk girişte adı her zaman gönderir. Hesap zaten varsa gönderilen ad yok sayılır.

## RPC'ler

| RPC | İstek | Cevap | Faz |
|---|---|---|---|
| `healthcheck` | `{}` | `{ ok: true, serverTime, protocolVersion }` | 0 |
| `list_servers` | `{}` | `{ servers: [{ matchId, name, language, players, capacity }] }` | 1 |
| `get_inventory` | `{}` | `{ energy, energyMax, slotsUsed, slotsMax, items: [ItemInstance], stacks: [{ defId, count }] }` | 2 |

Sunucular (match'ler) sunucu açılışında config'teki listeden oluşturulur; oyuncu yeni sunucu açamaz. `players` o andaki kişi sayısıdır, liste config sırasıyla döner.

## Match (harita) mesajları

Oyuncu `list_servers`'tan seçtiği `matchId`'ye `joinMatch` ile girer. Katılım metadata'sı: `{ protocolVersion, characterId }`. Nakama metadata değerlerini string taşır (`"1"`); `characterId` boşsa `"default"` sayılır. Katılım reddinde mesaj bir hata kodudur: sürüm uyuşmazsa `PROTOCOL_MISMATCH`, sunucu doluysa `SERVER_FULL`, metadata bozuksa `BAD_REQUEST`.

Aynı hesap ikinci kez girerse eski bağlantı match'ten atılır, yeni bağlantı devam eder (yeniden bağlanma). Oyuncu ayrılınca konumu kaydedilir.

`id` her yerde oyuncunun Nakama kullanıcı id'sidir. `dir` şu dördünden biridir: `"up"`, `"down"`, `"left"`, `"right"`.

| Op | Yön | Ad | Gövde | Faz |
|---|---|---|---|---|
| 1 | C → S | `MOVE` | `{ seq, x, y, dir, moving }` | 1 |
| 2 | S → C | `SNAPSHOT` | `{ t, players: [{ id, x, y, dir, moving }] }` (yakındakilerden bu tick'te değişenler, oyuncunun kendisi hariç) | 1 |
| 3 | S → C | `PLAYER_ENTER` | `{ id, name, characterId, x, y, dir, moving, bobber? }` (görüş alanına girdi; balık tutuyorsa `bobber: { x, y, band }`) | 1 |
| 4 | S → C | `PLAYER_LEAVE` | `{ id }` (görüş alanından çıktı veya ayrıldı) | 1 |
| 5 | C → S | `SAY` | `{ text }` | 1 |
| 6 | S → C | `BUBBLE` | `{ id, text }` (konuşanın kendisi de alır) | 1 |
| 7 | S → C | `CORRECTION` | `{ seq, x, y }` (sunucu konumu düzeltti) | 1 |
| 8 | S → C | `WELCOME` | `{ you: { id, x, y }, serverName, energy, energyMax }` (katılım sonrası ilk mesaj) | 1 |

### Hareket kuralları

- Client kendi karakterini anında yürütür ve en fazla 10 Hz'de `MOVE` gönderir. `x, y` oyuncunun yeni konumudur, `seq` her mesajda artan tam sayıdır; eski `seq`'li mesaj yok sayılır.
- Sunucu her `MOVE`'u kontrol eder: hız sınırı (yürüme hızı × 1.2 tolerans), harita sınırı, çarpışma. Geçersizse son geçerli konumu `CORRECTION` ile döner, client oraya ışınlanır.
- Hız sınırı bir "yürüme bütçesi"dir: bütçe saniyede yürüme hızı × 1.2 tile dolar, en fazla 0.5 saniyelik yol birikir (Öneri). Ağ yüzünden üst üste gelen mesajlar böylece haksız düzeltme almaz.
- Yürüme hızı (Öneri): **4 tile/sn**, sunucu config'idir.
- Yakınlık (Öneri): görüş yarıçapı **20 tile**, görüşten çıkma **22 tile** (sınırda gidip gelen oyuncu titremesin). `PLAYER_ENTER` tam durumu taşır, `SNAPSHOT` sadece değişenleri.
- Başlangıç: ilk girişte meydan, sonraki girişlerde son konum (`docs/tasarim/02-harita-sunucu.md`).

### Chat kuralları

- `text` en fazla **120 karakter** (Öneri), boşluk kırpılır, boş mesaj yok sayılır.
- Hız sınırı: saniyede 1 mesaj, aşan mesaj sessizce düşer (Öneri).
- `BUBBLE` gönderilmeden önce de sunucu metni kırpar; client gelen metni olduğu gibi gösterir.
- `BUBBLE` sadece konuşanın **12 tile** (Öneri) yakınındakilere gider.
- Küfür filtresi ve şikayet Faz 5'te.

## Balık tutma (Faz 2)

Kurallar: `docs/tasarim/03-balik-tutma.md`. Bu bölümdeki her sonuç sunucuda hesaplanır; client yalnızca niyet ve mini oyundaki tuş girdisini gönderir.

| Op | Yön | Ad | Gövde |
|---|---|---|---|
| 9 | C → S | `CAST` | `{ x, y }` (şamandıranın düşeceği nokta, tile) |
| 10 | S → C | `BOBBER` | `{ id, x, y, band, state, energy? }` (oyuncunun kendisi ve onu görenler; `energy` sadece oyuncunun kendi `cast` mesajında, atıştan sonraki enerji) |
| 11 | C → S | `HOOK` | `{}` (oyuncu çekti) |
| 12 | S → C | `REEL_START` | `{ seed, params }` (sadece oyuncunun kendisi) |
| 13 | C → S | `REEL_DONE` | `{ inputs: [ms, ...] }` |
| 14 | S → C | `FISH_END` | Görenlere `{ id, outcome, defId? }`; oyuncunun kendisine ayrıca `reason?, item?, stack?, energy` |
| 15 | C → S | `CANCEL` | `{}` (oltayı topla) |

- `band`: `"shore"`, `"mid"`, `"deep"`. `state`: `"cast"` (şamandıra suda), `"twitch"` (sahte kıpırdama), `"bite"` (gerçek vuruş, şamandıra battı).
- `outcome`: `"caught"`, `"escaped"` (mini oyunda kaçtı), `"missed"` (erken / geç çekti), `"cancelled"` (oyuncu topladı veya yürüdü), `"rejected"` (atış kabul edilmedi, `reason` ile).
- `reason` (`rejected` için): `BUSY`, `NOT_NEAR_WATER`, `NOT_WATER`, `TOO_FAR`, `BAG_FULL`.
- `ItemInstance`: `{ instanceId, defId, tier, float, source, obtainedAt }`. `tier`: `common`, `rare`, `epic`, `legendary`, `mythic`. Yığılan eşyalar (çöp, malzeme) instance değildir, `stack: { defId, count }` olarak gelir.

### Akış

1. **Atış:** client güç çubuğuyla bir nokta seçer, `CAST` gönderir. Sunucu kontrol eder: oyuncu boşta mı, en yakın suya 1.5 tile içinde mi, hedef su mu, hedef en fazla 8 tile uzakta mı (Öneri), çantada yer var mı. Kabul ederse enerji 1 düşer (enerji 0 ise düşmez, sadece çöp çıkar) ve herkese `BOBBER state:"cast"` gider. Bant hedefin kıyıya uzaklığından çıkar: 2 tile'a kadar kıyı, 5'e kadar orta, ötesi derin (Öneri).
2. **Bekleme:** sunucu 5–20 sn arası bir süre seçer (Öneri), arada 0–3 sahte kıpırdama (`twitch`) olur.
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

## Hata kodları

RPC hataları Nakama hata kodu + `{ code, message }`. Ortak kodlar: `BAD_REQUEST`, `PROTOCOL_MISMATCH`, `SERVER_FULL`, `RATE_LIMITED`.
