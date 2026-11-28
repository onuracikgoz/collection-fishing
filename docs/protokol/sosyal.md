# Protokol: Defter, arkadaşlar, ışınlanma, emote, fısıltı, XP

Genel kurallar ve op code dizini: `docs/protokol.md`.

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
| 19 | S → C | `TELEPORT` | `{ x, y, reason?, doorId? }` (sadece ışınlanan oyuncu; `reason` varsa ışınlanma olmadı, `x, y` mevcut yer; `doorId` arkadaş bir mekanda olduğu için o kapının önüne inildi) |
| 64 | C → S | `GOTO_SPAWN` | `{}` ("Başlangıca dön" butonu) |
| 20 | C → S | `EMOTE` | `{ emote }` |
| 21 | S → C | `EMOTE_SHOW` | `{ id, emote, defId? }` (oyuncunun kendisi ve onu görenler) |
| 36 | C → S | `EMOTE_STATUS` | `{ emote }` (`emote`: durum emote kimliği, `null` = kaldır) |
| 37 | S → C | `EMOTE_STATUS_SHOW` | `{ id, emote, reason? }` (oyuncunun kendisi ve onu görenler) |

- **Arkadaşlık:** istek gönderme, kabul, silme ve engelleme Nakama'nın kendi arkadaş API'siyle yapılır (`addFriends`, `listFriends`, `deleteFriends`, `blockFriends`). İki taraf da eklediğinde arkadaşlık karşılıklı olur (Nakama durum 0). Sunucunun saydığı arkadaş sadece karşılıklı olandır.
- **friends_status:** her arkadaş için çevrimiçi mi, hangi sunucuda (`serverName`, `matchId`) ve haritada nerede (`x, y`).
- **Yanına git:** arkadaş aynı sunucudaysa `GOTO_FRIEND`; sunucu arkadaşın yanındaki boş bir tile'a koyar, balık tutuyorsa olta toplanır (`FISH_END cancelled`), client karakteri `TELEPORT` konumuna atar. Arkadaş başka sunucudaysa client o sunucunun maçına katılım metadata'sında `near: userId` ile girer, `WELCOME` arkadaşın yanındaki yeri verir. `reason`: `NOT_FRIEND`, `NOT_HERE` (arkadaş bu sunucuda değil), `NO_SPOT`, `RATE_LIMITED` (3 sn'de bir, Öneri).
- **Arkadaş bir mekandaysa** (`dunya.md`, Kapılar ve iç mekanlar): ışınlanma içeri sokmaz. Sunucu oyuncuyu o mekanın ana kapısının (dosyadaki ilk kapı) `outside` noktasına koyar ve `TELEPORT { x, y, doorId }` döner; client "arkadaşın içeride" diyebilir. Girmek oyuncunun kararıdır (`ENTER_DOOR`, kapasite orada kontrol edilir; mekan doluysa da ışınlanma olur). Oyuncu arkadaşla **aynı mekandaysa** her zamanki gibi arkadaşın yanındaki boş tile'a gider (Öneri). Başka sunucudan `near` ile katılımda da aynı: arkadaş mekandaysa `WELCOME` ana kapının önünü verir (`doorId` gelmez). Mevcut `reason`'lar ve bekleme değişmez.
- **Başlangıca dön:** `GOTO_SPAWN`; sunucu haritanın `spawn` noktasını ortalayan 10x10 tile'lık alandan (Öneri, `SPAWN_TELEPORT.areaTiles`) rastgele yürünür bir tile seçer ve oyuncuyu oraya koyar (tile ortası). Balık tutuyorsa olta toplanır (`FISH_END cancelled`), cevap `TELEPORT`. Client yer seçmez. `reason`: `NO_SPOT` (alanda yürünür tile yok), `RATE_LIMITED` (30 sn'de bir, Öneri; "Yanına git" ile ortak 3 sn kuralı da geçerli), `BUSY` (takastayken).
- **Emote (hareket):** `wave`, `clap`, `dance`, `cheer`, `sit`, `laugh`, `show_fish`. Kısa animasyondur, bitince kaybolur. `show_fish` son yakalanan eşyayı havaya kaldırır (`defId`); hiç av yoksa yok sayılır. Oyuncu başına 2 sn'de bir (Öneri). Listede olmayan emote yok sayılır (flört emote'u yok, 13+).
- **Durum emote'u** (`10-sosyal.md` 13.2.2): oyuncunun üstünde **kalıcı** balon. Aynı anda bir tane.
  - `EMOTE_STATUS { emote }`: `emote` bir durum emote kimliği ya da `null` (kaldır; Unity `JsonUtility` boş string gönderir, o da kaldır sayılır). Listede olmayan kimlik yok sayılır (hareket emote'larından ayrı liste; `laugh` gibi aynı ad iki listede olabilir, op koduyla ayrılır).
  - Sunucu sahipliği doğrular: `free` herkese açık; `supporter`, `diamond` ve `book` emote'ları ancak oyuncunun sahip olduğu listedeyse takılır. Sahiplik başka sistemlerden gelir (destekçi paketi, elmas satın alma, defter ödülü) ve sunucu verisidir; client yazamaz.
  - Başarılıysa `EMOTE_STATUS_SHOW { id, emote }` oyuncuya ve onu görenlere gider. Reddedilirse sadece oyuncuya `{ id, emote: <şu an takılı olan ya da null>, reason }` gider (client eski halini geri koyar). `reason`: `NOT_OWNED`, `RATE_LIMITED` (1 sn'de bir, Öneri). Bilinmeyen kimlik ve bozuk gövde sessizce yok sayılır.
  - Durum **kalıcıdır**: oyundan çıkıp girince geri gelir (`player/status_emote`). Girişte sahipliği kalmamışsa kaldırılır.
  - Yeni gelen oyuncular için `PLAYER_ENTER` içinde `status?` vardır; kendi durumu ve sahip olduğu emote'lar `WELCOME` içinde: `status?`, `emotesOwned` (sadece ücretsiz olmayanlar).
  - Durum emote'u görünümdür; drop, Float ve ekonomiyi etkilemez, metin taşımadığı için sohbet filtresi gerekmez.

## Fısıltı (Faz 5)

Kurallar: `docs/tasarim/10-sosyal.md` 13.1.1 ve 13.1.2. Sunucu: `rules/whisper.ts` (saf kurallar), `rpc/whisper.ts`. Hepsi oturumlu RPC'dir; fısıltı match mesajı **değildir**, böylece iki oyuncu farklı sunucularda olsa da ulaşır.

- **`whisper_send { userId | username, text, context? }`:** alıcı `userId` ya da kullanıcı adıyla (`/w Nick mesaj`) verilir; Unity boş alanı `""` gönderir, boş olan yok sayılır. `text` chat kurallarıyla kırpılır (120 karakter), boşsa `BAD_REQUEST`. `context: "stall"` mesaj pazar tezgahının penceresinden ("Whisper at") yazıldıysa gönderilir.
- **Kim kime yazabilir** (sırayla):
  1. Gönderen alıcıyı engellediyse `YOU_BLOCKED`.
  2. Alıcı göndereni engellediyse `NOT_ALLOWED` (engel belli edilmez).
  3. Karşılıklı arkadaşlar her zaman yazabilir ("PM kapalı" arkadaşları etkilemez).
  4. Yabancı ancak `context: "stall"` ile, alıcının **açık tezgahı** varken ve alıcının "PM kapalı" ayarı kapalıyken yazabilir; değilse `NOT_ALLOWED`.
  5. Yabancı gönderen en az **level 10** (Öneri) olmalı, değilse `LEVEL_TOO_LOW`.
- **Diğer hatalar:** `MUTED` (gönderen susturulmuş), `NOT_FOUND` (böyle oyuncu yok), `SELF`, `OFFLINE` (alıcı hiçbir sunucuda değil), `RATE_LIMITED` (10 sn'de 10 fısıltı, Öneri).
- **Kişisel bilgi filtresi:** telefon (10 ve üstü rakam, Öneri), e-posta, link, alan adı, `@kullanıcı` ve sosyal medya adı (`insta: x`, `discord x`) `***` olur. Cevaptaki `text` alıcının gördüğü halidir, client kendi penceresine bunu yazar; `masked: true` ise "Kişisel bilgi gizlendi" notu gösterilebilir.
- **Teslim:** alıcıya Nakama bildirimi gider: konu `whisper`, kod **110**, **kalıcı değil** (çevrimdışıyken birikmez, depoda tutulmaz). İçerik: `{ from, fromName, text, context, at }`. Client bildirimi socket'ten alır ve `from` için küçük pencereyi açar ya da yanıp söndürür (pencere: `docs/araclar/ui-uygulama.md`, Fısıltı penceresi).
- **`whisper_settings { pmOff? }`:** "PM kapalı" düğmesi. `pmOff: true` yabancılardan fısıltıyı kapatır. Gövde boşsa sadece okur. Değer `player/settings.pmOff`'ta durur, varsayılan `false` (yabancı zaten sadece pazar bağlamında yazabilir, 13.1.1).
- **Engelleme:** Nakama arkadaş API'siyle (`blockFriends` / `deleteFriends`), ayrı RPC yok.
- **`report_player { userId, reason, note?, text? }`:** `reason`: `spam`, `abuse`, `scam`, `personal_info`, `cheating`, `other`. `note` oyuncunun açıklaması (300 karakter), `text` raporlanan mesaj (200 karakter; client fısıltı penceresinden ya da balondan doldurur). Rapor moderatörler için `reports` koleksiyonuna (sistem kullanıcısı) yazılır, oyunculara gösterilmez. Saatte en fazla 10 rapor (Öneri), sonra `RATE_LIMITED`. Hatalar: `SELF`, `NOT_FOUND`, `BAD_REQUEST`.
- **Susturma:** moderatör `player/mute { until }` (ms) yazar. Susturulmuş oyuncu fısıltı gönderemez (`MUTED`) ve `SAY`'i düşer. Moderatör aracı henüz yok, kayıt Nakama konsolundan yazılır.

## XP ve level

Kurallar: `docs/tasarim/04-xp-level.md`. Sunucu: `rules/xp.ts`. Saklanan değer toplam XP'dir (`player/xp`, herkese açık okunur); level ondan hesaplanır.

- Enerjili her başarılı av XP verir (`config.ts` `XP.catchXp`, Öneri): çöp 1, malzeme 3, Common 10, Rare 25, recipe 40, Epic 60, Legendary 150, Mythic 400. **Enerjisiz av XP vermez** (sadece çöp çıkar ve çiftliği yapılmasın). Kaçan ve ıskalanan av vermez.
- Level `n` → `n+1` için gereken XP: `250 + 250·n` (Öneri). En yüksek level 50. Level drop şansını artırmaz.
- `FISH_END` (sadece avlayana) `xpGain: { gained, level, xp, xpNext, levelUp?: { level, unlocks: [string] } }` taşır; `levelUp` seviye atlanan avda gelir. `unlocks` o seviyelerin açtığı özelliklerdir (şimdilik `trade`, level 10).
- `WELCOME` ve `get_profile` level'ı taşır.
- Level şartları: takas (level 10). Olta, derin su ve yem şartları eşyanın `minLevel` alanıyla gelir (`03-balik-tutma.md`), henüz yok.
