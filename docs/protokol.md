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
  - **Web hesabım var:** webde Ayarlar > Hesap > "Kod üret" tek kullanımlık kod üretir (10 dk geçerli, Öneri); Steam'de bu kod girilir ve Steam o hesaba bağlanır (`linkSteam`). Masaüstünde Google / Facebook / Discord girişi tarayıcı yönlendirmesi istediği için Steam'de tek yol koddur. RPC'ler: `transfer_code_create`, `transfer_code_redeem` (aşağıda, "Taşıma kodu RPC'leri").
- **Taşıma kodu güvenliği:** kod webde Ayarlar > Hesap > "Kod üret" ile üretilir ve Steam'de girilince bağlama hemen olur (ayrı onay yok, kodu üretmek onaydır). Kodu ele geçiren biri kendi Steam'ini bu hesaba bağlayıp karakteri alabilir (ör. "kodunu ver, eşya vereyim" kandırması). Bu yüzden:
  - Ayarlar > Hesap sayfası her açılışta bulanık gelir; "Hesap bilgilerin gizlendi" uyarısı onaylanınca açılır (yayın / omuz üstünden bakma için).
  - Kodun yanında sabit uyarı: "Bu kodu kimseyle paylaşma. Yetkililer asla istemez."
  - Yeni bağlanan Steam hesabıyla ilk 72 saat (Öneri) takas ve pazar satışı kapalıdır; hesap sahibi bu sürede bağlantıyı kaldırırsa çalınan karakter elden çıkmamış olur.
  - Hesaba bir giriş yolu bağlanınca veya kaldırılınca diğer yollardan girişte bildirim gösterilir.
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
| `get_inventory` | `{}` | `{ energy, energyMax, slotsUsed, slotsMax, items: [ItemInstance], stacks: [{ defId, count }], coin, dust, diamond, rod }` (defter yuvasındaki ve depodaki eşyalar hariç; `coin`, `dust`, `rod` Faz 4, `diamond` Faz 5; oyuncu bir sunucudayken `energy` 1 dk'ya kadar geride kalabilir, client maçtaki değeri kullanır: `WELCOME`, `BOBBER`, `FISH_END`) | 2 |
| `get_book` | `{ userId? }` (boşsa kendisi) | `BookResponse`, bkz. Collection Book | 3 |
| `get_profile` | `{ userId? }` (boşsa kendisi) | `{ userId, username, score, pagesComplete: [pageId], level, showcase: [ItemInstance], hunting? }` | 3 |
| `friends_status` | `{}` | `{ friends: [{ userId, username, online, serverName?, matchId?, x?, y? }] }` (sadece karşılıklı arkadaşlar) | 3 |
| `set_profile` | `{ showcase?: [defId], hunting?: defId \| null }` (verilmeyen alan değişmez) | `get_profile` ile aynı | 3 |
| `get_catalog` | `{}` | `CatalogResponse`, bkz. Fiyat ve recipe listesi | 4 |
| `transfer_code_create` | `{}` (oturumlu) | `{ code, expiresInMs }` (`code`: `ABCD-EFGH`) | 5 |
| `transfer_code_redeem` | `{ code, steamToken }` (**oturumsuz**, HTTP anahtarıyla) | `{ ok: true }` | 5 |
| `account_delete_request` | `{ name }` (hesabın kullanıcı adı, aynen) | `{ runAt }` (ms; silinme zamanı) | 7 |
| `account_delete_cancel` | `{}` | `{ ok: true }` | 7 |
| `account_delete_status` | `{}` | `{ pending, runAt }` (`runAt` 0 = yok) | 7 |
| `whisper_send` | `{ userId \| username, text, context? }` | `{ ok, to, toName, text, masked }`, bkz. Fısıltı | 5 |
| `whisper_settings` | `{ pmOff? }` (boşsa sadece okur) | `{ pmOff }` | 5 |
| `report_player` | `{ userId, reason, note?, text? }` | `{ ok: true }` | 5 |

Sunucular (match'ler) sunucu açılışında config'teki listeden oluşturulur; oyuncu yeni sunucu açamaz. `players` o andaki kişi sayısıdır, liste config sırasıyla döner.

### RPC hız sınırı

Oyuncu başına, RPC başına sayılır (`server/src/rpc/limit.ts`, sayılar `config.ts` `RPC_LIMITS`, hepsi Öneri). Sınır aşılınca `RATE_LIMITED` (Nakama kodu 8) döner; client birkaç saniye bekleyip tekrar dener, kullanıcıya göstermesi gerekmez. Sayaç Nakama'nın bellek önbelleğindedir (`localcache`), veritabanına yazılmaz; sunucu yeniden başlayınca sıfırlanır.

| RPC | Sınır |
|---|---|
| `friends_status` | 10 sn'de 5 (client liste açıkken 5 sn'de bir sorar) |
| `get_book`, `get_profile` | 10 sn'de 15 |
| `get_inventory`, `list_servers` | 10 sn'de 10 |
| `set_profile`, `get_catalog`, `whisper_settings` | 10 sn'de 5 |
| `whisper_send` | 10 sn'de 10 |
| `account_delete_*`, `transfer_code_create` | 1 dk'da 5 (`status` 10); taşıma kodunun saatlik sınırı ayrıca geçerli |
| Diğerleri | 10 sn'de 20 |

`healthcheck`, `transfer_code_redeem` (oturumsuz, kendi sınırı var) ve `dev_*` sayılmaz.

### Taşıma kodu RPC'leri

- **`transfer_code_create`** (web hesabı, oturumlu): 8 karakterlik tek kullanımlık kod üretir. Alfabe 32 karakter (I, O, 0, 1 yok), gösterimi `ABCD-EFGH`; yazarken büyük/küçük harf, boşluk ve tire fark etmez. 10 dk geçerli. Hesabın aynı anda tek geçerli kodu olur: yenisi eskisini siler. Saatte en fazla 5 kod (Öneri), aşılırsa `RATE_LIMITED`.
- **`transfer_code_redeem`** (Steam): Steam oyuncusunun henüz Nakama hesabı olmadığı için **oturumsuz** çağrılır (HTTP anahtarı). `steamToken` Steam oturum bileti. Sunucu kodu tek kullanımlık siler, Steam'i **sunucuda** o hesaba bağlar (`nk.linkSteam`; bilet Steam'de doğrulanır) ve `{ ok: true }` döner. Sonra client `authenticateSteam(create: false)` ile girer, bağlı hesap açılır.
  - Hatalar: `CODE_INVALID` (yanlış, kullanılmış ya da süresi dolmuş; hangisi olduğu söylenmez), `RATE_LIMITED` (aynı adresten 10 dk'da 10 yanlış kod, Öneri), `LINK_FAILED` (Steam bileti reddedildi ya da bu Steam başka hesapta; kod geri verilir, tekrar denenebilir), `BAD_REQUEST`.
  - Başarıda: hesaba **72 saat takas kilidi** konur (`TRADE_*` teklifi `TRADE_LOCKED` / karşı taraf için `TARGET_TRADE_LOCKED` ile reddedilir; pazar gelince aynı kilit satışı da kapatır), hesaba "giriş yolu bağlandı" bildirimi gider (Nakama bildirimi, kod 101, `{ provider: "steam" }`).
- **Giriş yolu bildirimleri:** cihaz, Google, Facebook ve Discord (özel) bağlanınca bildirim kodu 101, herhangi bir yol (Steam dahil) kaldırılınca 102 gider; `{ provider }` içerir. Kalıcı bildirimdir, sonraki girişte gösterilir.
- **Steam'i istemciden `linkSteam` ile bağlamak kapalıdır** (`PERMISSION_DENIED`): Steam sadece kodla bağlanır.
- Sunucu ayarı: Steam yayıncı anahtarı ve app id `local.yml` / canlı ayar dosyasında (`social.steam`) gerekir; Faz 7'de girilecek. Ayarsız `linkSteam` hata verir ve `LINK_FAILED` döner.

### Hesap silme RPC'leri

Kurallar: "Hesap kuralları" (Giriş). Sunucu: `rules/accountDelete.ts` (saf kurallar), `rpc/accountDelete.ts`. Hepsi oturumludur.

- **`account_delete_request`:** `name` hesabın kullanıcı adıyla **aynen** eşleşmezse `BAD_REQUEST` (client iki adımlı onayda adı yazdırır). Eşleşirse hesap silme kuyruğuna **14 gün** sonrasına (Öneri) yazılır, `{ runAt }` döner. Zaten kuyruktaysa mevcut `runAt` döner. Oyuncu oyundan çıkıp bekler; hesap bu sürede oynanabilir.
- **`account_delete_cancel`:** kuyruktan çıkarır. Kuyrukta değilse de `{ ok: true }` döner.
- **Girişle iptal:** silme beklerken hesaba **herhangi bir yoldan yeniden girilirse** (cihaz, Google, Facebook, Steam, Discord) silme iptal olur ve hesaba bildirim gider (kod **104**, `{}`). İsteği veren oturum bundan etkilenmez.
- **Silme:** süre dolunca sunucu hesabı kalıcı siler (`accountDeleteId`: karakter, defter, eşya, Coin, arkadaşlar, her şey). Oyuncu o sırada hâlâ bir sunucudaysa silme sonraki taramaya kalır. Tarama sunucuda her 10 dk'da bir çalışır (Öneri), açık bir sunucunun match'i yapar.
- **Silince:** hesabın bütün giriş yolları (cihaz, Google, Facebook, Steam, Discord) **7 gün** (Öneri) yeni hesap açamaz ve kullanıcı adı **30 gün** (Öneri) başkasına verilmez. Cihaz girişinde bu `ACCOUNT_RECENTLY_DELETED` / `NAME_RESERVED` ile reddedilir. Google, Facebook, Steam ve Discord'da kimlik giriş öncesi bilinmediği için kontrol girişten sonra yapılır: engelliyse yeni oluşan hesap hemen silinir, sonraki çağrı hata verir (client giriş sonrası ilk RPC'de `UNAUTHENTICATED` görürse "Bu hesapla şu an yeni hesap açılamaz" gösterir).
- **Henüz yok:** Steam'in web hesabına tekrar bağlanması için 30 günlük bekleme (Giriş, "Steam hesabını silip web hesabını açmak").

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

## Match (harita) mesajları

Oyuncu `list_servers`'tan seçtiği `matchId`'ye `joinMatch` ile girer. Katılım metadata'sı: `{ protocolVersion, characterId }`. Nakama metadata değerlerini string taşır (`"1"`); `characterId` boşsa `"default"` sayılır. Katılım reddinde mesaj bir hata kodudur: sürüm uyuşmazsa `PROTOCOL_MISMATCH`, sunucu doluysa `SERVER_FULL`, metadata bozuksa `BAD_REQUEST`.

Aynı hesap ikinci kez girerse eski bağlantı match'ten atılır, yeni bağlantı devam eder (yeniden bağlanma). Oyuncu ayrılınca konumu kaydedilir.

`id` her yerde oyuncunun Nakama kullanıcı id'sidir. `dir` şu dördünden biridir: `"up"`, `"down"`, `"left"`, `"right"`.

| Op | Yön | Ad | Gövde | Faz |
|---|---|---|---|---|
| 1 | C → S | `MOVE` | `{ seq, x, y, dir, moving }` | 1 |
| 2 | S → C | `SNAPSHOT` | `{ t, players: [{ id, x, y, dir, moving }] }` (yakındakilerden bu tick'te değişenler, oyuncunun kendisi hariç) | 1 |
| 3 | S → C | `PLAYER_ENTER` | `{ id, name, characterId, x, y, dir, moving, bobber?, status? }` (görüş alanına girdi; balık tutuyorsa `bobber: { x, y, band }`; durum emote'u takılıysa `status`) | 1 |
| 4 | S → C | `PLAYER_LEAVE` | `{ id }` (görüş alanından çıktı veya ayrıldı) | 1 |
| 5 | C → S | `SAY` | `{ text }` | 1 |
| 6 | S → C | `BUBBLE` | `{ id, text }` (konuşanın kendisi de alır) | 1 |
| 7 | S → C | `CORRECTION` | `{ seq, x, y }` (sunucu konumu düzeltti) | 1 |
| 8 | S → C | `WELCOME` | `{ you: { id, x, y }, serverName, energy, energyMax, rod, status?, emotesOwned, level, xp, xpNext }` (katılım sonrası ilk mesaj; `rod` Faz 4; `status` ve `emotesOwned` durum emote'u; `level`, `xp` (bu level içindeki), `xpNext` (bu level için gereken, son level'da 0)) | 1 |

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
- **Kişisel bilgi filtresi** (Faz 5): telefon, e-posta, link, alan adı, `@kullanıcı` ve sosyal medya adı `***` ile maskelenir (Fısıltı'daki kural). Client gelen metni yine olduğu gibi gösterir.
- **Susturma:** susturulmuş oyuncunun `SAY`'i sessizce düşer (kendisi de balon almaz). Kayıt `player/mute { until }` (ms), moderatör yazar; oyuncu çevrimiçiyken yazılırsa en geç **1 dk** (Öneri) içinde başlar.
- Küfür filtresi henüz yok (kelime listesi gerekiyor, `acik-sorular.md`). Raporlama `report_player` ile (Fısıltı).

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
| 36 | C → S | `EMOTE_STATUS` | `{ emote }` (`emote`: durum emote kimliği, `null` = kaldır) |
| 37 | S → C | `EMOTE_STATUS_SHOW` | `{ id, emote, reason? }` (oyuncunun kendisi ve onu görenler) |

- **Arkadaşlık:** istek gönderme, kabul, silme ve engelleme Nakama'nın kendi arkadaş API'siyle yapılır (`addFriends`, `listFriends`, `deleteFriends`, `blockFriends`). İki taraf da eklediğinde arkadaşlık karşılıklı olur (Nakama durum 0). Sunucunun saydığı arkadaş sadece karşılıklı olandır.
- **friends_status:** her arkadaş için çevrimiçi mi, hangi sunucuda (`serverName`, `matchId`) ve haritada nerede (`x, y`).
- **Yanına git:** arkadaş aynı sunucudaysa `GOTO_FRIEND`; sunucu arkadaşın yanındaki boş bir tile'a koyar, balık tutuyorsa olta toplanır (`FISH_END cancelled`), client karakteri `TELEPORT` konumuna atar. Arkadaş başka sunucudaysa client o sunucunun maçına katılım metadata'sında `near: userId` ile girer, `WELCOME` arkadaşın yanındaki yeri verir. `reason`: `NOT_FRIEND`, `NOT_HERE` (arkadaş bu sunucuda değil), `NO_SPOT`, `RATE_LIMITED` (3 sn'de bir, Öneri).
- **Emote (hareket):** `wave`, `clap`, `dance`, `cheer`, `sit`, `laugh`, `show_fish`. Kısa animasyondur, bitince kaybolur. `show_fish` son yakalanan eşyayı havaya kaldırır (`defId`); hiç av yoksa yok sayılır. Oyuncu başına 2 sn'de bir (Öneri). Listede olmayan emote yok sayılır (flört emote'u yok, 13+).
- **Durum emote'u** (`10-sosyal.md` 13.2.2): oyuncunun üstünde **kalıcı** balon. Aynı anda bir tane.
  - `EMOTE_STATUS { emote }`: `emote` bir durum emote kimliği ya da `null` (kaldır; Unity `JsonUtility` boş string gönderir, o da kaldır sayılır). Listede olmayan kimlik yok sayılır (hareket emote'larından ayrı liste; `laugh` gibi aynı ad iki listede olabilir, op koduyla ayrılır).
  - Sunucu sahipliği doğrular: `free` herkese açık; `supporter`, `diamond` ve `book` emote'ları ancak oyuncunun sahip olduğu listedeyse takılır. Sahiplik başka sistemlerden gelir (destekçi paketi, elmas satın alma, defter ödülü) ve sunucu verisidir; client yazamaz.
  - Başarılıysa `EMOTE_STATUS_SHOW { id, emote }` oyuncuya ve onu görenlere gider. Reddedilirse sadece oyuncuya `{ id, emote: <şu an takılı olan ya da null>, reason }` gider (client eski halini geri koyar). `reason`: `NOT_OWNED`, `RATE_LIMITED` (1 sn'de bir, Öneri). Bilinmeyen kimlik ve bozuk gövde sessizce yok sayılır.
  - Durum **kalıcıdır**: oyundan çıkıp girince geri gelir (`player/status_emote`). Girişte sahipliği kalmamışsa kaldırılır.
  - Yeni gelen oyuncular için `PLAYER_ENTER` içinde `status?` vardır; kendi durumu ve sahip olduğu emote'lar `WELCOME` içinde: `status?`, `emotesOwned` (sadece ücretsiz olmayanlar).
  - Durum emote'u görünümdür; drop, Float ve ekonomiyi etkilemez, metin taşımadığı için sohbet filtresi gerekmez.

## Duyurular (nadir av)

Kurallar: `docs/tasarim/15-gorsel-stil.md` Bildirimler. Bildirim kutularının çoğu (çanta dolu, enerji az, olta yıpranıyor, bağlantı) client'ın zaten bildiği durumdan çıkar, mesaj gerekmez.

| Op | Yön | Ad | Gövde |
|---|---|---|---|
| 38 | S → C | `ANNOUNCE` | `{ kind, id, name, defId, tier, condition }` (aynı sunucudaki **herkese**, avlayan dahil) |

- `kind`: şimdilik sadece `rare_catch`. Avdan sonra, `tier` Epic veya üstüyse (`ANNOUNCE.minTier`, Öneri) gönderilir. Sadece Tier'li (Float'lı) eşyalar duyurulur, materyal ve çöp duyurulmaz.
- `condition`: avın kondisyonu (`pristine`...`damaged`). **Ham Float değeri gönderilmez.**
- `name`: avlayanın görünen adı. Aynı oyuncunun art arda duyurularını birleştirmek client işidir.
- Duyuru av sonucundan (`FISH_END`) sonra gelir; avlayan kendi `FISH_END` ayrıntısını yine alır.

## Takas (Faz 5)

Kurallar: `docs/tasarim/07-kopya-envanter.md` 9.1. Sunucu: `rules/trade.ts` (saf kurallar), `match/trade.ts` (mesajlar ve depolama). Takas aynı sunucudaki (match) iki oyuncu arasındadır.

| Op | Yön | Ad | Gövde |
|---|---|---|---|
| 39 | C → S | `TRADE_OFFER` | `{ userId }` (karşı tarafa teklif) |
| 40 | C → S | `TRADE_REPLY` | `{ accept }` (gelen teklifi kabul / reddet) |
| 41 | C → S | `TRADE_SET` | `{ items: [instanceId], stacks: [{ defId, count }], coin }` (kendi tarafımın **tüm** içeriği) |
| 42 | C → S | `TRADE_LOCK` | `{ locked }` (kilitle / kilidi aç) |
| 43 | C → S | `TRADE_CONFIRM` | `{}` (geri sayımdan sonra onayla) |
| 44 | C → S | `TRADE_CANCEL` | `{}` (pencereyi kapat, takası iptal et) |
| 45 | S → C | `TRADE_INVITE` | `{ tradeId, from, name, expiresInMs }` (sadece davet edilene) |
| 46 | S → C | `TRADE_STATE` | `TradeStateMsg` (iki tarafa, kendi bakış açılarıyla) |
| 47 | S → C | `TRADE_END` | `TradeEndMsg` (iki tarafa) |

- **Akış:** `TRADE_OFFER` → karşı taraf `TRADE_INVITE` alır → `TRADE_REPLY { accept }`. Kabul edilince iki tarafa `TRADE_STATE` gider ve pencere açılır. Reddedilirse, 15 sn cevap gelmezse (Öneri) ya da teklif eden iptal ederse `TRADE_END` gider.
- **Teklif koşulları:** iki oyuncu aynı sunucuda ve en fazla 5 tile (Öneri) uzakta, ikisi de başka bir takasta değil. Teklif edenin olta atması iptal olur. Aynı oyuncu 3 sn'de bir teklif edebilir (Öneri). `TRADE_END.reason`: `NOT_HERE`, `TOO_FAR`, `BUSY` (taraflardan biri başka takasta), `SELF`, `RATE_LIMITED`, `TRADE_LOCKED` (kendi hesabın yeni bağlanmış Steam'den dolayı kilitli), `TARGET_TRADE_LOCKED` (karşı taraf kilitli).
- **Pencere açıkken** iki taraf yürüyemez ve olta atamaz (sunucu `MOVE` ve `CAST` mesajlarını yok sayar). Mesafe 5 tile'ı aşarsa, biri bağlantıyı keserse ya da pencere 5 dk (Öneri) açık kalırsa takas iptal olur.
- **İçerik:** `TRADE_SET` bir tarafın tüm içeriğini değiştirir. Eşya kalemleri (`items` + `stacks`) toplamı en fazla **8** (Öneri); `coin` o anki bakiyeyi aşamaz. Sadece **çantadaki** Float eşyalar (defter yuvasındakiler ve depodakiler değil) ve yığınlar konabilir. Toz takas edilemez. Reddedilirse içerik değişmez, isteyene `TRADE_STATE` içinde `reason` döner: `BAD_REQUEST`, `TOO_MANY`, `NOT_OWNED`, `NOT_ENOUGH`, `LOCKED` (kilitli eşya).
- **Kilit:** her iki taraf `TRADE_LOCK { locked: true }` der. Birinin içeriği değişirse (kendi `TRADE_SET`'i ya da karşı tarafınki) iki kilit de açılır ve onaylar sıfırlanır.
- **Onay:** iki kilit kapandıktan **3 sn** (Öneri) sonra `TRADE_CONFIRM` kabul edilir; öncesinde gönderilen yok sayılır. İki taraf da onaylayınca takas **tek işlemde** (eşyalar, yığınlar, Coin, kayıt) gerçekleşir. Sunucu o an her şeyi yeniden doğrular: eşya hâlâ çantada mı, yığın ve Coin yeterli mi, iki tarafın çantasında yer var mı.
- **Gelen eşya deftere işlenir:** ilk kopyaysa defter yuvasına gider ("Yeni keşif", çantada yer tutmaz), değilse çantaya. Çanta doluluğu hesabında her gelen Float eşya bir yuva sayılır (temkinli). `ItemInstance.source` = `trade`.
- **Kayıt:** her başarılı takas, iki tarafın `trades` koleksiyonuna aynı işlemde yazılır (bkz. Takas kayıtları). Sadece sunucu okur.
- **Level şartı:** iki taraf da en az level 10 olmalı (`TRADE.minLevel`, Öneri). Değilse teklif `LEVEL_TOO_LOW` (kendin) / `TARGET_LEVEL_TOO_LOW` (karşı taraf) ile reddedilir.
- **Henüz yok (Öneri):** takas kısıtı (`acik-sorular.md` 4).

```
TradeOfferView = { items: ItemInstance[], stacks: [{ defId, count }], coin }
TradeStateMsg  = { tradeId, withId, withName,
                   you: TradeOfferView, them: TradeOfferView,
                   youLocked, themLocked, youConfirmed, themConfirmed,
                   confirmInMs?,   // iki kilit kapalıyken: onaya kaç ms var (0 = şimdi basılabilir)
                   reason? }       // sadece isteyene: reddedilen TRADE_SET / TRADE_LOCK / TRADE_CONFIRM nedeni
TradeEndMsg    = { tradeId, result, reason?, userId?,   // result: done | cancelled | declined | expired | failed; userId: BAG_FULL olan taraf
                   got?: { items: ItemInstance[], stacks, coin },  // sadece done
                   gave?: { items: [instanceId], stacks, coin },   // sadece done
                   book?: [{ instanceId, ...FishBookMsg }] }       // gelen eşyanın defter sonucu
```

`failed` nedenleri: `ITEM_GONE`, `NOT_ENOUGH`, `BAG_FULL` (`userId` ile hangi taraf), `ERROR`.

## Takas kayıtları

Dolandırıcılık şikayetleri için (`tasarim/07-kopya-envanter.md` 9.1). Client'a gösterilmez, mesaj değildir.

- Her başarılı takas ve tezgah satışı, iki oyuncunun kendi `trades` koleksiyonuna birer kayıt olarak yazılır (okuma izni yok, sadece sunucu ve konsol). Anahtar `<zaman 15 hane>_<kind>_<ref>`, zamana göre sıralanır.
- Kayıt: `{ kind, with, withName, at, serverId, ref, gave, got, fee? }`. `kind`: `trade`, `stall_buy`, `stall_sale`. `gave` / `got`: `{ items: [{ instanceId, defId, tier, float }], stacks: [{ defId, count }], coin }`; eşya sonra satılsa ya da parçalansa da o anki hali kayıtta kalır. `ref`: takas id'si ya da satışın kendi id'si. `fee`: satıcının ödediği pazar ücreti.
- Geliştirici ve moderatör görünümü: `dev_trades { userId, limit? }` (yerel sunucu; oyuncunun kayıtları yeniden eskiye, hakkındaki ve verdiği raporlar). Canlı sunucuda Nakama konsolundan okunur; admin paneli Faz 6.
- Saklama süresi şimdilik sınırsız (Öneri: 1 yıl, sonra temizlenir).

## Bot işaretleri

Kurallar: `tasarim/03-balik-tutma.md` 5.1.1. Client'a mesaj yoktur, oyuncu bir şey görmez; sadece moderatör için işaret konur, otomatik ceza yok. Sayılar `config.ts` `BOT_CHECK` (Öneri).

- **Düzenli vuruş (`regular_hook`):** ısırmanın gösterildiği tick ile `HOOK` arası süre oyuncu başına son **30** atış için tutulur (bellekte). Standart sapma **30 ms**'nin altındaysa işaret konur. Maç 10 Hz çalıştığı için süreler 100 ms adımlıdır; insan birkaç adıma yayılır, sabit gecikmeli bot hep aynı adıma düşer.
- **Uzun gün (`long_hours`):** iki atış arası **2 dk**'dan kısaysa aradaki süre balık tutma sayılır. Bir günde (00:00 Türkiye saati) **16 saati** geçerse işaret konur. Süre `player/activity { day, ms }`'te durur, dakikada bir ve çıkışta yazılır.
- İşaretler `bot_flags/<userId>` (sistem kullanıcısı) kaydında: `{ userId, name, flags: { <işaret>: { at, day, days, detail } } }`. Aynı işaret günde bir kez yazılır, `days` kaç farklı günde konduğunu sayar.
- Görmek için: `dev_flags` (işaretli herkes), `dev_trades { userId }` (oyuncunun işaretleri, kayıtları ve raporları). Canlıda admin paneli Faz 6.
- **Henüz yok:** kısıtlı olmayan Steam hesabı şartı (Faz 7, Steam girişiyle), oyun süresi şartı (şimdilik level 10 bunun yerine geçer).

## Eşya kilidi

Kurallar: `docs/tasarim/07-kopya-envanter.md` 9.3.

| Op | Yön | Ad | Gövde |
|---|---|---|---|
| 48 | C → S | `ITEM_LOCK` | `{ instanceId, locked }` |
| 49 | S → C | `ITEM_LOCK_RESULT` | `{ instanceId, locked, ok, reason? }` (sadece isteyene) |

- Sadece **çantadaki** Float eşya kilitlenir (defter yuvası ve depo hariç). Aynı duruma tekrar istek `ok` döner. `reason`: `BAD_REQUEST`, `NOT_OWNED`.
- Kilit eşyanın kendisinde durur: `ItemInstance.locked?: true` (`get_inventory`, takas görünümü). Kilitli eşya **satılamaz** (`SELL`), **parçalanamaz** (`SALVAGE`), `MERGE` ve `CRAFT` girdisi olamaz, takasa konamaz: bu işlemler `reason: "LOCKED"` ile reddedilir. Depoya ve deftere konabilir, kilit korunur. Önce kilit açılır.
- Yeni eşyalar (av, craft, birleştirme, takas) kilitsiz gelir.

## Pazar (Faz 5, pet tezgahı)

Kurallar: `docs/tasarim/09-ekonomi-pazar.md` 12.3. Sunucu: `rules/market.ts` (saf kurallar), `match/market.ts` (mesajlar ve depolama). Oyuncu petini pazar alanına bırakır, pet onun yerine satar; satıcı oyundan çıkana kadar tezgah durur (sunucu değiştirse bile). Tezgah yalnızca Coin ile çalışır.

| Op | Yön | Ad | Gövde |
|---|---|---|---|
| 50 | C → S | `STALL_OPEN` | `{ title, items: [{ instanceId, price }], stacks: [{ defId, count, price }] }` (tezgah aç; `price` yığında **adet başı**) |
| 51 | C → S | `STALL_RECALL` | `{}` (peti geri çağır, satılmayanlar çantaya döner) |
| 52 | C → S | `STALL_VIEW` | `{ userId }` (bir tezgahın tüm listesini iste) |
| 53 | C → S | `STALL_BUY` | `{ userId, instanceId }` (Float'lı eşya) ya da `{ userId, defId, count }` (yığından) |
| 54 | S → C | `STALL_LIST` | `StallListMsg` (sadece isteyene; satın almadan sonra da güncel haliyle gelir) |
| 55 | S → C | `STALL_STATE` | `StallsMsg` (sunucudaki herkese: girişte tam liste, sonra her değişimde) |
| 56 | S → C | `STALL_RESULT` | `StallResultMsg` (sadece isteyene) |

- **Alan:** harita dosyasındaki `market` noktası etrafında `columns × rows` ızgarası (`MARKET`, Öneri: 8 × 5 = 40 yer, 2 tile arayla; yürünmez tile'a düşen yer atlanır). Tezgah açan oyuncuya **kendine en yakın boş yer** verilir. Oyuncu alan yarıçapı (`areaRadius`, Öneri 14 tile) içinde olmalı.
- **Açma koşulları:** level 10 (`MARKET.minLevel`) ve takas kilidi yok (yeni bağlanan Steam hesabı, `TRADE_LOCKED`). Oyuncu başına **tek tezgah** (tüm sunucularda), toplam en fazla 12 kalem (`items` + `stacks`, Öneri). Fiyat 1 ile 1.000.000.000 Coin arası tam sayı; yığında `adet × fiyat` de bu sınırı aşamaz. Başlık chat filtresinden geçer, en fazla 40 karakter, boş olabilir. Takas penceresindeyken açılamaz (`BUSY`).
- **Neler konur:** sadece çantadaki Float eşya (defter yuvası ve depo hariç), kilitli olmayan (`LOCKED`), ve çantadaki yığınlar (çöp, malzeme, recipe, yem; toz değil). Eşyalar tezgaha **ayrılır**: çantadan düşer, satılamaz / parçalanamaz / takas edilemez / craft'ta kullanılamaz. Yığın tezgaha konunca çanta yığınından çıkar. `reason`: `BAD_REQUEST`, `TOO_MANY`, `BAD_PRICE`, `NOT_OWNED`, `NOT_ENOUGH`, `LOCKED`, `LEVEL_TOO_LOW`, `TRADE_LOCKED`, `NOT_IN_MARKET` (alanda değil), `NO_SPOT` (yerler dolu), `ALREADY_OPEN`, `BUSY`.
- **Görünüm:** `STALL_STATE` her tezgah için başlık, yer, konum ve **ilk 4 kalemi** (`top`: önce Float'lılar, sonra yığınlar) taşır. Pete 7 tile'dan yakındaki oyuncu `STALL_VIEW` ile tam listeyi alır; Float'lı eşyada `ItemInstance` (Float ve kondisyon dahil) gelir. Uzaksa `STALL_RESULT { action: "view", ok: false, reason: "TOO_FAR" }`, tezgah yoksa `NOT_FOUND`.
- **Satın alma:** alıcı pete 7 tile'dan yakın olmalı, level 10 ve takas kilidi yok olmalı, kendi tezgahından alamaz (`OWN_STALL`). Sunucu **tek işlemde** eşyayı satıcıdan alıcıya geçirir (ilk kopya deftere işlenir, `source: "trade"`), alıcının Coin'ini düşer, satıcıya fiyat eksi pazar ücretini ekler, satıcıya bildirim gönderir. Pazar ücreti satıştan %5 (yukarı yuvarlanır, 1 Coin'lik satışta yok; Öneri), satıcıdan kesilir. `reason`: `BAD_REQUEST`, `NOT_FOUND` (kalem yok / satıldı), `NOT_ENOUGH` (yığında o kadar yok, ya da Coin yetmez), `TOO_FAR`, `BAG_FULL`, `LEVEL_TOO_LOW`, `TRADE_LOCKED`, `OWN_STALL`, `ERROR`. Başarılıda `STALL_RESULT` ardından güncel `STALL_LIST` gelir.
- **Tek sunucu:** oyuncunun aynı anda **tek** tezgahı olur ve tezgah açıldığı sunucuda durur. Başka sunucuda `STALL_OPEN` `ALREADY_OPEN` ile reddedilir. Oyuncu sunucu değiştirirse tezgah **kapanmaz**, açıldığı sunucuda satmaya devam eder; ama geri çağırmak için o sunucuya dönmesi gerekir (`STALL_RECALL` başka sunucuda `OTHER_SERVER`, tezgah yoksa `NOT_OPEN`).
- **Kapanma:** tezgah `STALL_RECALL` ile, oyuncu **oyundan tamamen çıkınca** (hiçbir sunucuda değilse), satılacak her şey satılınca ya da 24 saat (Öneri) dolunca kalkar. Sunucu `player/session` kaydından oyuncunun hangi sunucuda olduğunu bilir: bir sunucudan çıkarken kayıt hâlâ o sunucuyu gösteriyorsa oyuncu oyundan çıkmıştır. Satılmayanlar çantaya döner (çanta dolu olsa da; çanta aşımı serbest, Öneri). Oyuncu tezgahın sunucusundayken kapanırsa eşyalar hemen döner (süre dolunca ona `STALL_RESULT { action: "recall", ok: true, reason: "EXPIRED", returned }` gider). Oyuncu başka sunucudayken ya da sunucu durdurulunca kapanırsa eşyalar tezgaha ayrılı kalır ve oyuncunun **bir sonraki girişinde** çantaya döner; tezgah pazardan hemen kalkar (`STALL_STATE.removed`).
- **Bildirim:** satıcıya `notifications` ile gider: konu `stall_sold`, kod **103**, `{ defId, count, price, fee, buyer }`.
- **Kayıt:** her satış alıcının (`stall_buy`) ve satıcının (`stall_sale`) `trades` koleksiyonuna, satın almayla aynı işlemde yazılır (bkz. Takas kayıtları).
- **Henüz yok:** elmasla pano reklamı ve "alım ilanı" (`acik-sorular.md`).

```
StallEntry     = { defId, tier, count, price }   // tier: yığında ""; price: yığında adet başı
StallView      = { userId, name, spot, x, y, title, top: StallEntry[], total, expiresInMs }  // total: toplam kalem sayısı
StallsMsg      = { full, stalls: StallView[], removed: [userId] }  // full: true ise liste tamamdır, client önce temizler
StallListMsg   = { userId, name, title, items: [{ item: ItemInstance, price }], stacks: [{ defId, count, price }], expiresInMs }
StallResultMsg = { action, ok, reason?,            // action: open | recall | view | buy
                   spot?,                          // open
                   returned?: { items: ItemInstance[], stacks: [{ defId, count }] },  // recall
                   item?, defId?, count?, paid?, coin?, book? }                       // buy
```

## Günlük görev (Faz 6)

Kurallar: `docs/tasarim/03-balik-tutma.md` 5.2. Sunucu: `rules/quest.ts` (saf kurallar), `match/quest.ts` (match mesajları ve depolama), liste ve sandıklar `data/quests.ts` (Öneri değerler; admin paneli sonra). Görev durumu match'in önbelleğinde durur, bu yüzden RPC yok, her şey match mesajıdır.

| Op | Yön | Ad | Gövde |
|---|---|---|---|
| 57 | S → C | `QUEST_STATE` | `QuestStateMsg` (girişte `WELCOME`'dan sonra, her ilerlemede, gün değişince, talepten sonra) |
| 58 | C → S | `QUEST_CLAIM` | `{}` (bugünün sandığını al) |
| 59 | S → C | `QUEST_CLAIM_RESULT` | `QuestClaimResultMsg` (sadece isteyene) |

- **Günlük 3 görev**, listeden rastgele ve farklı seçilir; seviyesi yetmeyen görev çıkmaz (`minLevel`). Gün **00:00 Türkiye saatinde** (UTC+3, Öneri) döner; yeni günde yeni görevler gelir, dünkü ilerleme gider, seri korunur.
- **Sayılan olaylar:** `catch` (başarılı her av), `catch_tier` (avın Tier'ı en az `minTier`), `sell` (NPC'ye satılan eşya ve yığın birimi), `craft`, `merge`, `trade` (tamamlanan takas, iki tarafa da), `emote` (jest emote'u; durum emote'u değil). İlerleme hedefte kalır. Sunucu her olayı kendi görür, client sayı gönderemez.
- **Sandık:** üç görev bitince `QUEST_CLAIM` bugünün sandığını açar: Coin, toz ve yığın ödülleri (malzeme, yem, recipe). Eşya (Float'lı) çıkmaz. Sandık satılmaz, envanterde durmaz, alınca anında açılır. İçerik **seri gününe** göre değişir; **10. gün sandığı en iyisidir** (garanti İyi recipe). Her gün tek sandık.
- **Seri:** dünkü sandığı almışsan +1; bir gün kaçırırsan 3 geri düşüp +1 (sıfırlanmaz, Öneri; `acik-sorular.md` 2); 10'da kalır. İlk sandık 1. gündür.
- `QuestClaimResultMsg.reason`: `NOT_DONE`, `ALREADY_CLAIMED`, `BAG_FULL` (yığın ödülleri sığmaz; durum değişmez, yer açıp tekrar denenir), `ERROR`. Hepsi tek işlemde yazılır (durum, yığınlar, Coin ve toz).
- **Henüz yok:** "birinin defterine bak" görevi (`get_book` RPC'sidir, match önbelleğiyle çakışır; sonra), sandığın Float'lı eşya vermesi (açık soru).

```
QuestStateMsg       = { day, quests: [{ id, event, progress, target }], complete, claimed,
                        streak,        // alınmış sandık serisi (bugünküyle birlikte, alındıysa)
                        chestDay,      // bugünün sandığı kaçıncı gün sandığı (1-10)
                        resetInMs }    // yeni güne kalan süre
QuestClaimResultMsg = { ok, reason?, streak?, chestDay?, rewards?: [{ kind, defId, count }], coin?, dust? }
                      // kind: coin | dust | stack (defId yığında dolu); coin ve dust ödülden sonraki bakiye
```

## XP ve level

Kurallar: `docs/tasarim/04-xp-level.md`. Sunucu: `rules/xp.ts`. Saklanan değer toplam XP'dir (`player/xp`, herkese açık okunur); level ondan hesaplanır.

- Enerjili her başarılı av XP verir (`config.ts` `XP.catchXp`, Öneri): çöp 1, malzeme 3, Common 10, Rare 25, recipe 40, Epic 60, Legendary 150, Mythic 400. **Enerjisiz av XP vermez** (sadece çöp çıkar ve çiftliği yapılmasın). Kaçan ve ıskalanan av vermez.
- Level `n` → `n+1` için gereken XP: `250 + 250·n` (Öneri). En yüksek level 50. Level drop şansını artırmaz.
- `FISH_END` (sadece avlayana) `xpGain: { gained, level, xp, xpNext, levelUp?: { level, unlocks: [string] } }` taşır; `levelUp` seviye atlanan avda gelir. `unlocks` o seviyelerin açtığı özelliklerdir (şimdilik `trade`, level 10).
- `WELCOME` ve `get_profile` level'ı taşır.
- Level şartları: takas (level 10). Olta, derin su ve yem şartları eşyanın `minLevel` alanıyla gelir (`03-balik-tutma.md`), henüz yok.

## Ekonomi: Coin, NPC satış, toz (Faz 4)

Kurallar: `docs/tasarim/07-kopya-envanter.md` 9, fiyatlar `16-ekonomi-tablosu.md` 3 (hepsi Öneri, `server/src/config.ts` `ECONOMY`).

| Op | Yön | Ad | Gövde |
|---|---|---|---|
| 22 | C → S | `SELL` | `{ items?: [instanceId], stacks?: [{ defId, count }] }` (NPC'ye sat → Coin) |
| 23 | C → S | `SALVAGE` | `SELL` ile aynı (parçala → toz) |
| 24 | S → C | `ECONOMY_RESULT` | `{ action: "sell" \| "salvage", ok, reason?, coin, dust, gained?, items?, stacks? }` (sadece oyuncunun kendisi) |

- **Coin ve toz** Nakama cüzdanında durur (`{ coin, dust }`), sadece sunucu değiştirir. Client bakiyeyi `get_inventory` ve `ECONOMY_RESULT`'tan alır. Toz takas edilemez.
- **Elmas** da cüzdanda durur (`{ coin, dust, diamond }`). Balık tutarken enerjiyle yapılan her başarılı çekişte küçük bir şansla **1 elmas** düşer; şans günde ortalama **5** elmas verecek şekilde hesaplanır (`DIAMOND` config: `perDay` 5, `catchesPerDay` enerji tavanının %90'ı, yani şimdi ~%5,6; hepsi Öneri). Enerjisiz atış ve kaçan balık elmas vermez. Elmas av kaydıyla aynı işlemde yazılır; `FISH_END` (sadece avlayana) `diamond: { gained, total }` taşır, düşmediyse alan yoktur. Bakiye `get_inventory.diamond`'dadır. Elmas **takas edilemez** (takas ve tezgah sadece Coin ister), harcama yerleri sonra gelir (pano reklamı, kozmetikler). Gerçek parayla elmas satın alma Faz 7'de.
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
  "points": [{ "id": "bank", "kind": "bank", "x": 30.5, "y": 78.5 }],
  "waters": [{ "id": "buyuk_gol", "x": 76, "y": 30, "w": 40, "h": 37 }]
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
- `points`: haritadaki işlevli yerler. `id` dosyada tektir, `kind` şunlardan biri: `bank` (depo, Faz 4), `craftsman` (Zanaatkar), `shop` (dükkan), `board` (Pazar Panosu), `rest` (dinlenme alanı), `market` (pet tezgahı alanının merkezi). Şimdilik sunucu `bank` ve `market`'i kullanır; menzil (kaç tile yakında açılır) noktada değil config'tedir (`STASH.range`).
- `waters` (isteğe bağlı): isimli sular. Dikdörtgenin içindeki `~` tile'lar o suya aittir; eşyaların `waters` alanı bu id'leri kullanır (`tasarim/03-balik-tutma.md`, Eşyanın çıkış alanları). `id` küçük harf, rakam ve `_`. Liste verilirse her su tile'ı tam bir suya ait olmalı. Client bu alanı kullanmaz; hangi suda olunduğu oyuncuya gösterilmez (keşif konusu).
- Kontroller (sunucu açılırken; biri tutmazsa modül yüklenmez): satır sayısı ve uzunluğu, bilinmeyen karakter, `spawn` ve her nokta harita içinde ve yürünür, `id` tekrarı, sunucunun kullandığı noktalar (`bank`, `market`) var, isimli suların dikdörtgeni harita içinde, içinde su var, çakışmıyor ve isimsiz su kalmıyor.
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

RPC hataları Nakama hata kodu + `{ code, message }`. Ortak kodlar: `BAD_REQUEST`, `PROTOCOL_MISMATCH`, `SERVER_FULL`, `RATE_LIMITED`, `ACCOUNT_RECENTLY_DELETED`, `NAME_RESERVED` (silinen hesabın giriş yolu ya da adı bekleme süresinde). Fısıltı ve rapor: `MUTED`, `NOT_FOUND`, `SELF`, `NOT_ALLOWED`, `YOU_BLOCKED`, `LEVEL_TOO_LOW`, `OFFLINE`.

Nakama bildirim kodları: 101 giriş yolu bağlandı, 102 giriş yolu kaldırıldı, 103 tezgahtan satış, 104 hesap silme iptal, 110 fısıltı.
