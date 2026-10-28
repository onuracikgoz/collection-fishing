# Client ↔ Sunucu Protokolü

Bu dosya client ve server agent'larının ortak sözleşmesidir. Yeni mesaj veya alan eklemeden önce burası güncellenir. Kodda op code'lar ve tipler bu tabloyla birebir aynı olur (`server/src/protocol.ts`, `client/Assets/Scripts/Net/Protocol.cs`).

- Bağlantı: Nakama WebSocket. Mesaj gövdesi **JSON** (ileride gerekirse ikili formata geçilir).
- Konum birimi: **tile** (1 tile = 32 px, ondalıklı). x sağa, **y aşağı** doğru büyür (satır 0 haritanın kuzey kenarı). Süreler milisaniye.
- Unity tarafında 1 tile = 1 birim ve dünya konumu `(x, -y)`; sunucu tile'ı `(sütun, satır)` tilemap hücresi `(sütun, -satır - 1)` olur (`client/Assets/Scripts/World/LakeMap.cs`, `Coords`). Harita verisi: bkz. Harita dosyası.
- Sunucu tick hızı: **10 Hz** (Öneri).
- Sürüm: client bağlanırken `protocolVersion` gönderir; uyuşmazsa sunucu reddeder.

`protocolVersion = 1`

## Giriş

| Adım | Nasıl |
|---|---|
| Faz 1 | `authenticateDevice` (cihaz kimliği) + kullanıcı adı |
| Faz 7 | `authenticateSteam` |

### Hesap kuralları (karar 28.10.2026, Faz 7'de yazılacak)

- **Bir hesap = bir karakter.** Defter, çanta, depo, level ve Score hesaba bağlıdır. Hesap başına ikinci karakter yok (kendi kendine takas ve bot çiftliği olmasın).
- Bir hesaba birden fazla giriş yolu bağlanabilir (Nakama link): cihaz (misafir), Google, Facebook, Discord, Steam. Hangisiyle girilirse aynı karakter açılır. E-posta + şifre girişi yok (şifre sıfırlama ve sızıntı yükü bizde kalmasın).
- **Web:** "Misafir olarak oyna" (`authenticateDevice`) veya "Google / Facebook / Discord ile gir" (`authenticateGoogle`, `authenticateFacebook`; Discord Nakama'da hazır değil, sunucuda Discord token'ını doğrulayan özel giriş, `authenticateCustom`). Ayrı kayıt formu yok; misafir, ayarlardan "Hesabını koru" ile bu üçünden birini bağlar (`linkGoogle`, `linkFacebook`, özel Discord bağlama).
- **Misafir hesap:** kimlik tarayıcıda (localStorage) durur; sekme / tarayıcı kapanınca silinmez. Tarayıcı verisi silinirse, gizli sekmede veya başka cihazda erişim kaybolur. Bu yüzden (Öneri): ilk Rare / level 5 / ilk sayfa gibi anlarda "Hesabını koru" hatırlatması; gizli sekmede uyarı; hiçbir yola bağlanmamış ve 90 gün girilmemiş misafir hesaplar sunucudan temizlenir.
- **Steam ilk açılış:** önce `authenticateSteam` hesap oluşturmadan denenir. Bağlı hesap yoksa oyuncu seçer:
  - **Yeni başla:** Steam hesabıyla yeni hesap ve karakter oluşturma.
  - **Web hesabım var:** webde Ayarlar > "Steam'e taşı" tek kullanımlık kod üretir (10 dk geçerli, Öneri); Steam'de bu kod girilir ve Steam o hesaba bağlanır (`linkSteam`). Masaüstünde Google / Facebook / Discord girişi tarayıcı yönlendirmesi istediği için Steam'de tek yol koddur. Yeni RPC'ler gerekir (`transfer_code_create`, `transfer_code_redeem`), adları ve gövdeleri yazılırken bu tabloya eklenecek.
- **İki hesap birleştirilmez.** Bir Steam hesabı tek oyun hesabına bağlıdır.
- **Steam hesabını silip web hesabını açmak:** Steam'de "Yeni başla" ile oynamış oyuncu, ayarlardan bu hesabı silip Steam'i web hesabına bağlayabilir. Silinen hesabın karakteri, defteri, eşyaları ve o hesapta alınmış kozmetikler kalıcı olarak gider; ekranda iki adımlı onay (hesap adını yazdırma) istenir. Tekrar bağlamaya bekleme süresi konur (ör. 30 günde bir, Öneri), hesap değiştirerek ekonomi açığı aranmasın.
- **Bağlı hesapta iki ayrı işlem:**
  - **Bağlantıyı kaldır** (`unlinkSteam`, `unlinkGoogle` vb.): karakter kalır, sadece o giriş yolu ayrılır. Hesapta en az bir giriş yolu kalmalı.
  - **Hesabı sil:** hesap tektir, bütün giriş yolları (Steam, Google, Facebook, Discord, cihaz) birlikte serbest kalır; aynı Google / Steam vb. ile sonra sıfırdan yeni karakter açılabilir. Silme önce 14 gün bekler (Öneri), bu sürede tekrar girince iptal olur; sonra kalıcıdır. Silinen hesabın giriş yolları 7 gün yeni hesap açamaz ve kullanıcı adı 30 gün başkasına verilmez (Öneri: başlangıç ödüllerini tekrar toplamak ve ad kapmak için sil-aç yapılmasın).

- Kullanıcı adı ilk girişte (hesap oluşurken) gönderilir. Kural: **3–16 karakter**, harf (Türkçe harfler dahil), rakam ve `_` (Öneri). Uymazsa giriş `BAD_REQUEST` ile reddedilir. Ad başkasındaysa Nakama'nın kendi hatası döner.
- Ad gönderilmezse Nakama rastgele bir ad atar, bu yüzden client ilk girişte adı her zaman gönderir. Hesap zaten varsa gönderilen ad yok sayılır.

## RPC'ler

| RPC | İstek | Cevap | Faz |
|---|---|---|---|
| `healthcheck` | `{}` | `{ ok: true, serverTime, protocolVersion }` | 0 |
| `list_servers` | `{}` | `{ servers: [{ matchId, name, language, players, capacity }] }` | 1 |
| `get_inventory` | `{}` | `{ energy, energyMax, slotsUsed, slotsMax, items: [ItemInstance], stacks: [{ defId, count }], coin, dust, rod }` (defter yuvasındaki ve depodaki eşyalar hariç; `coin`, `dust`, `rod` Faz 4) | 2 |
| `get_book` | `{ userId? }` (boşsa kendisi) | `BookResponse`, bkz. Collection Book | 3 |
| `get_profile` | `{ userId? }` (boşsa kendisi) | `{ userId, username, score, pagesComplete: [pageId], showcase: [ItemInstance], hunting? }` | 3 |
| `friends_status` | `{}` | `{ friends: [{ userId, username, online, serverName?, matchId?, x?, y? }] }` (sadece karşılıklı arkadaşlar) | 3 |
| `set_profile` | `{ showcase?: [defId], hunting?: defId \| null }` (verilmeyen alan değişmez) | `get_profile` ile aynı | 3 |
| `get_catalog` | `{}` | `CatalogResponse`, bkz. Fiyat ve recipe listesi | 4 |

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
| 8 | S → C | `WELCOME` | `{ you: { id, x, y }, serverName, energy, energyMax, rod }` (katılım sonrası ilk mesaj; `rod` Faz 4) | 1 |

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

Yem: `bait` verilmeyen atış temel yemle yapılır (bedava, sınırsız, oranları kaydırmaz). Özel yemler Faz 4'te geldi, bkz. Olta ve özel yem.

| Op | Yön | Ad | Gövde |
|---|---|---|---|
| 9 | C → S | `CAST` | `{ x, y, bait? }` (şamandıranın düşeceği nokta, tile; `bait` özel yemin `defId`'si, Faz 4) |
| 10 | S → C | `BOBBER` | `{ id, x, y, band, state, energy?, bait? }` (oyuncunun kendisi ve onu görenler; `energy` ve `bait` sadece oyuncunun kendi `cast` mesajında: atıştan sonraki enerji ve kalan yem) |
| 11 | C → S | `HOOK` | `{}` (oyuncu çekti) |
| 12 | S → C | `REEL_START` | `{ seed, params }` (sadece oyuncunun kendisi) |
| 13 | C → S | `REEL_DONE` | `{ inputs: [ms, ...] }` |
| 14 | S → C | `FISH_END` | Görenlere `{ id, outcome, defId? }`; oyuncunun kendisine ayrıca `reason?, item?, stack?, energy, book?, rod?` |
| 15 | C → S | `CANCEL` | `{}` (oltayı topla) |

- `band`: `"shore"`, `"mid"`, `"deep"`. `state`: `"cast"` (şamandıra suda), `"twitch"` (sahte kıpırdama), `"bite"` (gerçek vuruş, şamandıra battı).
- `outcome`: `"caught"`, `"escaped"` (mini oyunda kaçtı), `"missed"` (erken / geç çekti), `"cancelled"` (oyuncu topladı veya yürüdü), `"rejected"` (atış kabul edilmedi, `reason` ile).
- `reason` (`rejected` için): `BUSY`, `NOT_NEAR_WATER`, `NOT_WATER`, `TOO_FAR`, `BAG_FULL`; Faz 4'te `NO_BAIT`, `NO_ENERGY`, `ROD_BROKEN` (yemle atışta).
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

## Collection Book (Faz 3)

Kurallar: `docs/tasarim/06-defter.md`. Defter herkese açıktır; kayıt, yuva, şans ve Collection Score sadece sunucuda hesaplanır.

| Op | Yön | Ad | Gövde |
|---|---|---|---|
| 16 | C → S | `BOOK_PLACE` | `{ instanceId }` (çantadaki eşyayı yuvasına koy; yuvadaki kopya çantaya döner) |
| 17 | S → C | `BOOK_RESULT` | `{ ok, reason?, defId?, page?, slot?, previous?, score? }` (sadece oyuncunun kendisi) |

- Kayıt sadece Tier'lı (Float'lı) eşyalar içindir. Çöp ve malzeme defterde yoktur (Öneri). Sayfalar şimdilik `server/src/data/book-pages.ts`.
- Bir kaydın üç durumu: `unknown` (hiç bulunmamış), `found` (bulunmuş, yuva boş; silik), `filled` (yuvada eşya var). Kayıt kalıcıdır.
- **Yeni keşif:** bir eşyanın ilk kopyası yakalanınca kaydedilir ve doğrudan yuvaya girer, çantada yer kaplamaz. `FISH_END.book = { page, kind: "discovered", pageComplete, luck, score }`. `pageComplete` sayfanın son kaydıysa `true` (büyük kutlama).
- **Kopya:** kayıtlı bir eşya çantaya düşer. `FISH_END.book = { page, kind: "copy", better }`. `better`: yuvadakinden düşük (temiz) Float'lı ya da yuva boş; client "Defterdekiyle değiştir?" sorar, evet derse `BOOK_PLACE` gönderir.
- `BOOK_PLACE` sonucu: `slot` yuvaya giren eşya, `previous` çantaya dönen eşya (yoksa yok). `reason`: `BAD_REQUEST`, `NOT_OWNED` (eşya çantada değil), `NOT_IN_BOOK` (eşyanın kaydı yok), `NOT_FOUND` (kayıt henüz bulunmamış). Oyuncu başına tick'te en fazla bir defter işlemi işlenir.
- **Şans** (Öneri): sayfa başına; kayıtlarının yarısı bulunmuş sayfa +%2, tamamı bulunmuş sayfa +%5, toplam en fazla +%25. Silik kayıtlar da sayılır. Şans, av tablosunda Rare, Epic, Legendary ve Mythic ağırlıklarını `(1 + şans)` ile çarpar.
- **Collection Score** (Öneri): sadece yuvadaki eşyalar sayılır. Common 1, Rare 3, Epic 10, Legendary 30, Mythic 100 puan; tüm yuvaları dolu sayfa +20.
- **Profil kartı** (`10-sosyal.md` 13.3): `showcase` en fazla 3 defter kaydıdır, her birinin yuvası dolu olmalı; kartta yuvadaki eşya (Tier, Float) görünür. Yuva sonradan boşalırsa o kayıt karttan düşer. `hunting` ("Arıyorum") defterdeki herhangi bir kayıt olabilir. `pagesComplete`: tüm kayıtları bulunmuş sayfalar. Level, XP gelince eklenecek. `set_profile` hataları `BAD_REQUEST` koduyla, mesajda nedeni: `TOO_MANY`, `DUPLICATE`, `NOT_IN_BOOK`, `SLOT_EMPTY`.
- `BookResponse`: `{ userId, pages: [{ id, total, found, filled, records: [{ defId?, state, item? }] }], luck, score }`. `unknown` kayıtlarda `defId` gönderilmez; `filled` kayıtlarda `item` yuvadaki `ItemInstance`'tır.

## Arkadaşlar, ışınlanma, emote (Faz 3)

Kurallar: `docs/tasarim/10-sosyal.md` 13.2.

| Op | Yön | Ad | Gövde |
|---|---|---|---|
| 18 | C → S | `GOTO_FRIEND` | `{ userId }` ("Yanına git", arkadaş aynı sunucudaysa) |
| 19 | S → C | `TELEPORT` | `{ x, y, reason? }` (sadece ışınlanan oyuncu; `reason` varsa ışınlanma olmadı, `x, y` mevcut yer) |
| 20 | C → S | `EMOTE` | `{ emote }` |
| 21 | S → C | `EMOTE_SHOW` | `{ id, emote, defId? }` (oyuncunun kendisi ve onu görenler) |

- **Arkadaşlık:** istek gönderme, kabul, silme ve engelleme Nakama'nın kendi arkadaş API'siyle yapılır (`addFriends`, `listFriends`, `deleteFriends`, `blockFriends`). İki taraf da eklediğinde arkadaşlık karşılıklı olur (Nakama durum 0). Sunucunun saydığı arkadaş sadece karşılıklı olandır.
- **friends_status:** her arkadaş için çevrimiçi mi, hangi sunucuda (`serverName`, `matchId`) ve haritada nerede (`x, y`).
- **Yanına git:** arkadaş aynı sunucudaysa `GOTO_FRIEND`; sunucu arkadaşın yanındaki boş bir tile'a koyar, balık tutuyorsa olta toplanır (`FISH_END cancelled`), client karakteri `TELEPORT` konumuna atar. Arkadaş başka sunucudaysa client o sunucunun maçına katılım metadata'sında `near: userId` ile girer, `WELCOME` arkadaşın yanındaki yeri verir. `reason`: `NOT_FRIEND`, `NOT_HERE` (arkadaş bu sunucuda değil), `NO_SPOT`, `RATE_LIMITED` (3 sn'de bir, Öneri).
- **Emote:** `wave`, `clap`, `dance`, `sit`, `laugh`, `show_fish`. `show_fish` son yakalanan eşyayı havaya kaldırır (`defId`); hiç av yoksa yok sayılır. Oyuncu başına 2 sn'de bir (Öneri). Listede olmayan emote yok sayılır (flört emote'u yok, 13+).

## Ekonomi: Coin, NPC satış, toz (Faz 4)

Kurallar: `docs/tasarim/07-kopya-envanter.md` 9, fiyatlar `16-ekonomi-tablosu.md` 3 (hepsi Öneri, `server/src/config.ts` `ECONOMY`).

| Op | Yön | Ad | Gövde |
|---|---|---|---|
| 22 | C → S | `SELL` | `{ items?: [instanceId], stacks?: [{ defId, count }] }` (NPC'ye sat → Coin) |
| 23 | C → S | `SALVAGE` | `SELL` ile aynı (parçala → toz) |
| 24 | S → C | `ECONOMY_RESULT` | `{ action: "sell" \| "salvage", ok, reason?, coin, dust, gained?, items?, stacks? }` (sadece oyuncunun kendisi) |

- **Coin ve toz** Nakama cüzdanında durur (`{ coin, dust }`), sadece sunucu değiştirir. Client bakiyeyi `get_inventory` ve `ECONOMY_RESULT`'tan alır. Toz takas edilemez.
- Bir istekte birden çok eşya ve yığın olabilir, toplam en fazla 40 satır. İstek ya tamamen olur ya hiç olmaz: eşyalar, yığınlar ve cüzdan tek işlemde değişir.
- **NPC fiyatı:** Tier'lı eşyada Tier fiyatı × kondisyon çarpanı (Pristine ×3, Excellent ×1.5, Normal ×1, Worn ×0.7, Damaged ×0.5), yuvarlanır, en az 1. Yığınlarda (çöp, malzeme) adet başı sabit fiyat.
- **Toz:** Float'tan etkilenmez. Recipe parçalanamaz.
- Sadece çantadaki eşyalar satılır veya parçalanır. Defter yuvasındaki eşya önce yuvadan çıkarılmalıdır (yuvadan çıkarma henüz yok), depodaki eşya önce çantaya alınmalıdır.
- Şimdilik her yerden yapılır; haritaya NPC konunca mesafe kontrolü eklenecek.
- `ECONOMY_RESULT`: başarıda `gained` kazanılan Coin veya toz, `items` ve `stacks` çantadan çıkanlar; `coin` ve `dust` işlemden sonraki bakiye. `reason`: `BAD_REQUEST`, `TOO_MANY`, `NOT_OWNED` (eşya çantada değil veya yığın yok), `NOT_ENOUGH` (yığında o kadar yok), `CANNOT_SALVAGE`. Oyuncu başına tick'te en fazla bir defter veya ekonomi işlemi işlenir.

## Birleştirme ve craft (Faz 4)

Kurallar: `docs/tasarim/07-kopya-envanter.md` 9.4, `08-recipe-craft.md` 10–11, toz maliyetleri `16-ekonomi-tablosu.md` 4.3–4.4 (hepsi Öneri, `server/src/config.ts` `CRAFT`).

| Op | Yön | Ad | Gövde |
|---|---|---|---|
| 25 | C → S | `MERGE` | `{ items: [instanceId, instanceId, instanceId] }` (aynı eşyadan 3 kopya → 1 kopya) |
| 26 | C → S | `CRAFT` | `{ recipeId, items?: [instanceId] }` (`items`: recipe'nin istediği Float'lı eşyalar, oyuncu seçer) |
| 27 | S → C | `CRAFT_RESULT` | `{ action: "merge" \| "craft", ok, reason?, dust, item?, stack?, book?, items?, stacks? }` (sadece oyuncunun kendisi) |

- **Recipe** çantada yığın olarak durur (`recipe.*`), craft'ta 1 tane harcanır. Tarifsiz craft yoktur. Recipe balıktan "şişedeki recipe" olarak düşer (%0.4, Öneri) ve NPC'ye kademesine göre satılır (Normal 50, İyi 250, Usta 1.000); parçalanamaz. Yeni hesap 2 başlangıç recipe'si alır (`recipe.scale_charm`, `recipe.moss_wreath`). Recipe'ler ve çıkan eşyalar şimdilik yer tutucu (`server/src/data/recipes.ts`).
- **Birleştirme:** aynı eşyadan 3 çanta kopyası + Tier'a göre toz (Common 10, Rare 50, Epic 200, Legendary 800, Mythic 4.000). Sonuç aynı eşya, yeni Float; Tier değişmez, sonuç girdilerin en kötüsünden kötü çıkmaz. Recipe ve Coin istemez.
- **Craft:** recipe + yığın malzemeler (otomatik düşülür) + seçilen Float'lı eşyalar + çıkan eşyanın Tier'ına göre toz (Common 20, Rare 80, Epic 300, Legendary 1.200, Mythic 5.000).
- **Float:** girdilerin Float ortalaması Pristine ve Excellent şansını kaydırır (ortalama < 0.05: %6 / %25, < 0.20: %4 / %20, < 0.50: %2 / %13, üstü: %1 / %8). Float'lı girdi yoksa %2 / %13. Recipe kademesi üst sınır koyar: Normal 1.00, İyi 0.50 (Worn / Damaged çıkmaz), Usta 0.20 (en az Excellent). Client "Kalite şansı" çubuğunu bu ortalama aralıklarından gösterebilir (Düşük / Normal / Yüksek / Çok Yüksek); kesin oran gösterilmez.
- Çıkan eşya defter kuralına uyar: ilk kopya doğrudan yuvaya girer (`book.kind = "discovered"`, `FISH_END.book` ile aynı şekil), sonrakiler çantaya. Zanaat eşyaları defterde `crafts` sayfasındadır.
- Sadece çantadaki eşyalar kullanılır. Girdiler, yeni eşya, defter ve toz tek işlemde değişir. Şimdilik her yerden yapılır; zanaatkar NPC konunca mesafe şartı eklenecek.
- `CRAFT_RESULT`: başarıda `item` yeni eşya, `items` ve `stacks` harcananlar, `dust` kalan toz. `reason`: `BAD_REQUEST`, `NOT_OWNED`, `NOT_SAME_ITEM` (birleştirmede farklı eşyalar), `NO_RECIPE`, `MISSING_INPUTS`, `NOT_ENOUGH_DUST`, `BAG_FULL`. Oyuncu başına tick'te en fazla bir defter, ekonomi veya craft işlemi işlenir.
- Pristine sonuç duyurusu (yakındakilere, Mythic Pristine tüm sunucuya) henüz yok.
- **Yem craft'ı:** bazı recipe'ler Float'lı eşya yerine yığın üretir (ör. `recipe.shiny_bait` → 5 `bait.shiny`). Bu recipe'lerin toz maliyeti recipe'de yazar (Tier'ı yoktur), sonuç defterden geçmez. `CRAFT_RESULT`'ta `item` yerine `stack: { defId, count }` gelir (`count` çantadaki yeni toplam).

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

## Depo (Faz 4)

Kurallar: `docs/tasarim/07-kopya-envanter.md` 9.3, genişletme fiyatları `16-ekonomi-tablosu.md` 4.5 (hepsi Öneri, `server/src/config.ts` `STASH`).

| Op | Yön | Ad | Gövde |
|---|---|---|---|
| 31 | C → S | `STASH_OPEN` | `{}` (depoyu aç, içeriği iste) |
| 32 | C → S | `STASH_PUT` | `{ items?: [instanceId], stacks?: [{ defId, count }] }` (çantadan depoya) |
| 33 | C → S | `STASH_TAKE` | `STASH_PUT` ile aynı (depodan çantaya) |
| 34 | C → S | `STASH_EXPAND` | `{}` (bir sonraki kademeyi Coin ile al) |
| 35 | S → C | `STASH_RESULT` | `{ action: "open" \| "put" \| "take" \| "expand", ok, reason?, stash?, coin?, items?, stacks? }` (sadece oyuncunun kendisi) |

- **Sadece Banka'da:** bütün depo mesajları oyuncu Banka noktasına **3 tile** (Öneri) yakınsa işlenir, değilse `reason: "NOT_AT_BANK"`. Banka şimdilik `(30.5, 78.5)` (güneybatı köyü, `server/src/config.ts` `STASH.bank`); client haritaya banka binasını buraya koymalı. Haritada yer kesinleşince bu sayı değişir.
- `stash`: `{ level, slotsUsed, slotsMax, items: [ItemInstance], stacks: [{ defId, count }] }`. Başarılı her cevapta tam içerik gelir. Depo da çanta gibi sayılır: Float'lı eşya tek kutu, yığınlar kutu başına 99.
- **Kapasite:** başlangıç 100 kutu. `STASH_EXPAND` kademeleri: 120 kutu 2.000, 140 kutu 5.000, 160 kutu 12.000, 180 kutu 30.000, 200 kutu 75.000 Coin. Cevapta `coin` kalan bakiye. Destekçi paketi deposu sonra.
- **Taşıma:** `STASH_PUT` ve `STASH_TAKE` en fazla 40 satır, ya tamamen olur ya hiç. `items` ve `stacks` taşınanlardır. Defter yuvasındaki eşya depoya konamaz. Depodaki eşya satılamaz, parçalanamaz, craft'ta kullanılamaz, defter yuvasına konamaz: önce çantaya alınmalıdır.
- `reason`: `NOT_AT_BANK`, `BAD_REQUEST`, `TOO_MANY`, `NOT_OWNED` (eşya / yığın çıkılan yerde değil), `NOT_ENOUGH`, `STASH_FULL`, `BAG_FULL`, `MAX_LEVEL`, `NOT_ENOUGH_COIN`.
- Oyuncu başına tick'te en fazla bir defter, ekonomi, craft, dükkan veya depo işlemi işlenir.

## Harita dosyası

Harita her sunucuda aynıdır (`docs/tasarim/02-harita-sunucu.md` 4.0). Çarpışma, su ve önemli noktalar tek dosyada durur: `content/maps/<id>.json` (ilk harita: `lake.json`). Sunucu bu dosyayı derlerken pakete gömer; client da aynı dosyayı okur. İki taraf ayrı kopya tutmaz.

Hedef akış: harita Unity'de tilemap olarak çizilir, bir editor komutu bu dosyayı yazar, sunucu ve client ondan okur. Unity haritası çizilene kadar dosya taslaktan üretilmiştir (`16-ilk-harita.md`).

```json
{
  "format": 1,
  "id": "lake",
  "width": 128,
  "height": 96,
  "spawn": { "x": 64.5, "y": 50.5 },
  "rows": ["....##....~~~~", "..."],
  "points": [{ "id": "bank", "kind": "bank", "x": 30.5, "y": 78.5 }]
}
```

- `format`: dosya biçiminin sürümü, şimdilik `1`. Sunucu tanımadığı sürümü reddeder.
- `width`, `height`: tile. Konumlar protokolün geri kalanındaki gibidir: x sağa, y aşağı, satır 0 kuzey kenarı.
- `rows`: `height` adet satır, her biri `width` karakter. Satır `y`'nin `x`. karakteri `(x, y)` tile'ıdır:

| Karakter | Anlam |
|---|---|
| `.` | Yürünür |
| `#` | Yürünmez (bina, çeşme, kaya, ağaç gövdesi) |
| `~` | Su: yürünmez, balık tutulur |

- Su bandı (kıyı / orta / derin) dosyada yazılmaz; sunucu her su tile'ının karaya uzaklığından hesaplar (`WATER` config). Haritayı çizen yalnızca suyu işaretler.
- `spawn`: ilk giriş noktası (meydan). Yürünür bir tile'da olmalı.
- `points`: haritadaki işlevli yerler. `id` dosyada tektir, `kind` şunlardan biri: `bank` (depo, Faz 4), `craftsman` (Zanaatkar), `shop` (dükkan), `board` (Pazar Panosu), `rest` (dinlenme alanı). Şimdilik sunucu sadece `bank`'ı kullanır; menzil (kaç tile yakında açılır) noktada değil config'tedir (`STASH.range`).
- Kontroller (sunucu açılırken; biri tutmazsa modül yüklenmez): satır sayısı ve uzunluğu, bilinmeyen karakter, `spawn` ve her nokta harita içinde ve yürünür, `id` tekrarı, sunucunun kullandığı noktalar (`bank`) var.
- Sonraki adım (Öneri): balık noktaları (`spot`) ve her noktanın havuzu. Havuzlar sunucu verisidir, dosyada sadece noktanın yeri ve id'si durur.
## Fiyat ve recipe listesi (Faz 4)

Client'ın Faz 4 pencereleri (satış, birleştirme, craft, dükkan, depo) fiyatları ve recipe'leri tıklamadan önce göstermek için `get_catalog` çağırır. Sadece gösterim içindir: sayılar `server/src/config.ts` ve `data/recipes.ts`'ten gelir, client'a gömülmez; her sonucu yine yukarıdaki mesajlarda sunucu hesaplar. Cevap config değişmedikçe aynıdır (sunucu bir kez hesaplar), client girişte bir kez ister.

Unity `JsonUtility` sözlük okuyamadığı için her şey dizidir ve isteğe bağlı sayı yoktur (`0` = yok):

- `tiers: [{ tier, sell, dust, merge, craft }]`: Tier başına NPC fiyatı (kondisyondan önce), parçalama tozu, birleştirme ve craft toz maliyeti.
- `conditions: [{ condition, min, max, multiplier }]`: Float bantları ve NPC fiyat çarpanı. Satış önizlemesi `max(1, round(sell × multiplier))`, yarım yukarı yuvarlanır.
- `stacks: [{ defId, category, sell, dust }]`: yığılan şeyler (çöp, malzeme, recipe, yem), adet başı. `sell: 0` NPC almaz, `dust: 0` parçalanmaz.
- `maxEntries`, `mergeCount`.
- `recipes: [{ id, grade, output: { defId, tier, count }, dust, stacks, items, maxFloat }]`: Float'lı çıktıda `count: 0`, yığın çıktıda (yem) `tier: ""`. `dust` craft'ın toz maliyeti, `maxFloat` kademenin en kötü sonucu.
- `qualitySteps: [0.05, 0.2, 0.5]`: girdi Float ortalamasının "Kalite şansı" kelimesini değiştirdiği sınırlar (altında Çok Yüksek / Yüksek / Normal, üstü Düşük; Float'lı girdi yoksa Normal). Kesin oran gönderilmez.
- `baits: [{ defId, price }]`, `maxBuy`. Yemin hangi bantta işe yaradığı gönderilmez (keşif konusu).
- `rodLevels: [{ level, max, fullRepair }]`.
- `stash: { x, y, range, baseSlots, maxEntries, tiers: [{ slots, price }] }`: Banka noktası (client haritada işaretler) ve genişletme kademeleri.

## Geliştirici RPC'leri (sadece yerel)

`dev_*` RPC'leri ve `dev_*` match sinyalleri oyun protokolünün parçası değildir; client bunları çağırmaz. Sadece `DEV_TOOLS=true` olan yerel sunucuda çalışır, başka yerde `DEV_TOOLS_OFF` döner. Liste: `docs/araclar/dev-dashboard.md`.

## Hata kodları

RPC hataları Nakama hata kodu + `{ code, message }`. Ortak kodlar: `BAD_REQUEST`, `PROTOCOL_MISMATCH`, `SERVER_FULL`, `RATE_LIMITED`.
