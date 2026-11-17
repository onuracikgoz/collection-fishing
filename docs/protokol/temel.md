# Protokol: Giriş, RPC listesi, hız sınırları, hata kodları

Genel kurallar ve op code dizini: `docs/protokol.md`.

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
| `get_profile` | `{ userId? }` (boşsa kendisi) | `{ userId, username, score, pagesComplete: [pageId], level, showcase: [ItemInstance], hunting?, look }` (`look`: giydiği görünüm, Gardırop) | 3 |
| `friends_status` | `{}` | `{ friends: [{ userId, username, online, serverName?, matchId?, x?, y? }] }` (sadece karşılıklı arkadaşlar) | 3 |
| `set_profile` | `{ showcase?: [defId], hunting?: defId \| null }` (verilmeyen alan değişmez) | `get_profile` ile aynı | 3 |
| `get_catalog` | `{}` | `CatalogResponse`, bkz. Fiyat ve recipe listesi | 4 |
| `get_content` | `{}` | `ContentResponse`, bkz. İçerik: eşya adları ve görselleri | 6 |
| `get_item_art` | `{ ids: [defId] }` (en fazla 40) | `{ art: [{ id, hash, png, icon? }] }` (`png`, `icon` base64) | 6 |
| `get_locale` | `{ lang, hash? }` | `{ lang, hash, strings? }`, bkz. Dil dosyaları | 6 |
| `get_wardrobe` | `{}` | `{ items, look, worn }`, bkz. Gardırop | 6 |
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
| `set_profile`, `get_catalog`, `get_content`, `whisper_settings` | 10 sn'de 5 |
| `get_item_art` | 10 sn'de 30 |
| `get_locale` | 10 sn'de 5 |
| `get_wardrobe` | 10 sn'de 10 |
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

## Hata kodları

RPC hataları Nakama hata kodu + `{ code, message }`. Ortak kodlar: `BAD_REQUEST`, `PROTOCOL_MISMATCH`, `SERVER_FULL`, `RATE_LIMITED`, `ACCOUNT_RECENTLY_DELETED`, `NAME_RESERVED` (silinen hesabın giriş yolu ya da adı bekleme süresinde). Pano: `NO_STALL`, `NOT_IN_STALL`, `BOARD_FULL`, `NOT_ENOUGH_DIAMOND`. Fısıltı ve rapor: `MUTED`, `NOT_FOUND`, `SELF`, `NOT_ALLOWED`, `YOU_BLOCKED`, `LEVEL_TOO_LOW`, `OFFLINE`.

Nakama bildirim kodları: 101 giriş yolu bağlandı, 102 giriş yolu kaldırıldı, 103 tezgahtan satış, 104 hesap silme iptal, 110 fısıltı, 120 gardırop değişti.
## Geliştirici RPC'leri (sadece yerel)

`dev_*` RPC'leri ve `dev_*` match sinyalleri oyun protokolünün parçası değildir; client bunları çağırmaz. Sadece `DEV_TOOLS=true` olan yerel sunucuda çalışır, başka yerde `DEV_TOOLS_OFF` döner. Liste: `docs/araclar/dev-dashboard.md`.

`admin_*` RPC'leri de oyun protokolünün parçası değildir: sadece sunucu anahtarıyla (`runtime.http_key`, oturumsuz) çağrılır, oyuncu oturumuyla her zaman `NOT_ALLOWED` döner. Liste: `docs/araclar/admin-paneli.md`.
