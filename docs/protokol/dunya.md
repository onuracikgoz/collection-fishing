# Protokol: Harita: hareket, chat, oturma, kapılar ve iç mekanlar, duyurular, harita dosyası

Genel kurallar ve op code dizini: `docs/protokol.md`.

## Match (harita) mesajları

Oyuncu `list_servers`'tan seçtiği `matchId`'ye `joinMatch` ile girer. Katılım metadata'sı: `{ protocolVersion, characterId }`. Nakama metadata değerlerini string taşır (`"1"`); `characterId` boşsa `"default"` sayılır. Katılım reddinde mesaj bir hata kodudur: sürüm uyuşmazsa `PROTOCOL_MISMATCH`, sunucu doluysa `SERVER_FULL`, metadata bozuksa `BAD_REQUEST`.

Aynı hesap ikinci kez girerse eski bağlantı match'ten atılır, yeni bağlantı devam eder (yeniden bağlanma). Oyuncu ayrılınca konumu kaydedilir.

`id` her yerde oyuncunun Nakama kullanıcı id'sidir. `dir` şu dördünden biridir: `"up"`, `"down"`, `"left"`, `"right"`.

| Op | Yön | Ad | Gövde | Faz |
|---|---|---|---|---|
| 1 | C → S | `MOVE` | `{ seq, x, y, dir, moving }` | 1 |
| 2 | S → C | `SNAPSHOT` | `{ t, players: [{ id, x, y, dir, moving }] }` (yakındakilerden bu tick'te değişenler, oyuncunun kendisi hariç) | 1 |
| 3 | S → C | `PLAYER_ENTER` | `{ id, name, characterId, x, y, dir, moving, bobber?, status?, seat?, look }` (görüş alanına girdi; balık tutuyorsa `bobber: { x, y, band }`; durum emote'u takılıysa `status`; oturuyorsa koltuk `seat`; `look` görünüm, Gardırop) | 1 |
| 4 | S → C | `PLAYER_LEAVE` | `{ id }` (görüş alanından çıktı veya ayrıldı) | 1 |
| 5 | C → S | `SAY` | `{ text }` | 1 |
| 6 | S → C | `BUBBLE` | `{ id, text }` (konuşanın kendisi de alır) | 1 |
| 7 | S → C | `CORRECTION` | `{ seq, x, y }` (sunucu konumu düzeltti) | 1 |
| 8 | S → C | `WELCOME` | `{ you: { id, x, y }, serverName, energy, energyMax, rod, status?, emotesOwned, level, xp, xpNext, look }` (katılım sonrası ilk mesaj; `rod` Faz 4; `status` ve `emotesOwned` durum emote'u; `level`, `xp` (bu level içindeki), `xpNext` (bu level için gereken, son level'da 0); `look` oyuncunun görünümü, Gardırop) | 1 |

### Hareket kuralları

- Client kendi karakterini anında yürütür ve en fazla 10 Hz'de `MOVE` gönderir. `x, y` oyuncunun yeni konumudur, `seq` her mesajda artan tam sayıdır; eski `seq`'li mesaj yok sayılır.
- Sunucu her `MOVE`'u kontrol eder: hız sınırı (yürüme hızı × 1.2 tolerans), harita sınırı, çarpışma. Geçersizse son geçerli konumu `CORRECTION` ile döner, client oraya ışınlanır.
- Hız sınırı bir "yürüme bütçesi"dir: bütçe saniyede yürüme hızı × 1.2 tile dolar, en fazla 0.5 saniyelik yol birikir (Öneri). Ağ yüzünden üst üste gelen mesajlar böylece haksız düzeltme almaz.
- Yürüme hızı (Öneri): **4 tile/sn**, sunucu config'idir.
- Yakınlık (Öneri): görüş yarıçapı **20 tile**, görüşten çıkma **22 tile** (sınırda gidip gelen oyuncu titremesin). `PLAYER_ENTER` tam durumu taşır, `SNAPSHOT` sadece değişenleri. İç mekanlarda yarıçap yerine mekanın tamamı geçerlidir (Kapılar ve iç mekanlar).
- Başlangıç: ilk girişte meydan, sonraki girişlerde son konum (`docs/tasarim/02-harita-sunucu.md`).

### Chat kuralları

- `text` en fazla **120 karakter** (Öneri), boşluk kırpılır, boş mesaj yok sayılır.
- Hız sınırı: saniyede 1 mesaj, aşan mesaj sessizce düşer (Öneri).
- `BUBBLE` gönderilmeden önce de sunucu metni kırpar; client gelen metni olduğu gibi gösterir.
- `BUBBLE` sadece konuşanın **12 tile** (Öneri) yakınındakilere gider; iç mekanda mekandaki herkese.
- **Kişisel bilgi filtresi** (Faz 5): telefon, e-posta, link, alan adı, `@kullanıcı` ve sosyal medya adı `***` ile maskelenir (Fısıltı'daki kural). Client gelen metni yine olduğu gibi gösterir.
- **Susturma:** susturulmuş oyuncunun `SAY`'i sessizce düşer (kendisi de balon almaz). Kayıt `player/mute { until }` (ms), moderatör yazar; oyuncu çevrimiçiyken yazılırsa en geç **1 dk** (Öneri) içinde başlar.
- Küfür filtresi henüz yok (kelime listesi gerekiyor, `acik-sorular.md`). Raporlama `report_player` ile (Fısıltı).

## Oturma (16.11.2026, Onur)

Kurallar: `docs/tasarim/10-sosyal.md` (sosyal alanlar), dinlenme bonusu `03-balik-tutma.md` (henüz bağlı değil). Koltuklar harita dosyasındadır (`seats`, bkz. Harita dosyası).

| Op | Yön | Ad | Gövde |
|---|---|---|---|
| 67 | C → S | `SIT` | `{ seatId }` (`""` = kalk) |
| 68 | S → C | `SEAT_SHOW` | `{ id, seatId, reason? }` (`seatId: ""` = kalktı; oyuncunun kendisi ve onu görenler) |

- Oyuncu koltuğun yanında E'ye basar, client en yakın koltuğun `seatId`'sini gönderir. Client yer seçmez, oturmayı kendisi göstermez; `SEAT_SHOW` gelince gösterir.
- Sunucu kontrol eder: koltuk haritada var, oyuncu koltuğa en fazla `SEATS.maxDistance` tile uzakta (Öneri 1.5), koltukta başkası yok, oyuncu takasta değil, 0.5 sn'de bir (Öneri). Balık tutuyorsa olta toplanır (`FISH_END cancelled`).
- Başarılıysa oyuncunun konumu koltuğun `x, y`'si, yönü koltuğun `dir`'i olur ve `SEAT_SHOW { id, seatId }` oyuncuya ve onu görenlere gider. Oturan client kendi karakterini (`LocalMover`) koltuk konumuna koyar; sonraki `MOVE` oradan başlar. Herkes karakteri sandalyeye oturmuş çizer (LPC `Sitting` 3. sütun, koltuğun yönü).
- Reddedilirse sadece oyuncuya `{ id, seatId: <oturduğu koltuk ya da "">, reason }`. `reason`: `NOT_FOUND`, `TOO_FAR`, `TAKEN`, `BUSY`, `RATE_LIMITED`.
- Kalkma: `SIT { seatId: "" }`, yürüme (konum değiştiren `MOVE`) veya ışınlanma. Sunucu `SEAT_SHOW { id, seatId: "" }` yollar. Çıkan oyuncunun koltuğu boşalır (`PLAYER_LEAVE`).
- Görüş alanına sonradan giren oyuncu oturanı `PLAYER_ENTER` içindeki `seat?` ile öğrenir.
- `sit` emote'u (yere oturma) ayrıdır ve değişmedi.

## Kapılar ve iç mekanlar (28.11.2026)

> Durum: sözleşme yazıldı, sunucu ve client henüz yazılmadı.

Kurallar: `docs/tasarim/21-harita-v1.md` (Mekanlar, İç mekanlar nasıl çalışır). Her sunucu yine tek match'tir. İç mekanlar aynı harita dosyasında dış alanın uzağında duran dikdörtgenlerdir; kapılar ve dikdörtgenler harita dosyasındadır (`outdoor`, `interiors`, `doors`, bkz. Harita dosyası).

| Op | Yön | Ad | Gövde |
|---|---|---|---|
| 71 | C → S | `ENTER_DOOR` | `{ doorId }` (dışarıdan mekana gir) |
| 72 | C → S | `EXIT_DOOR` | `{ doorId }` (mekandan dışarı çık) |
| 73 | S → C | `DOOR_RESULT` | `{ doorId, ok, reason?, interiorId, x, y, dir }` (sadece isteği gönderen oyuncuya) |

- **Oyuncu hangi mekanda:** ayrı bir durum tutulmaz ve mesajlarda taşınmaz; konumu hangi `interiors` dikdörtgeninin içindeyse oradadır, hiçbirinde değilse dışarıdadır. Client `WELCOME`, `TELEPORT`, `CORRECTION` ve `DOOR_RESULT` konumundan aynı hesabı yapıp ortamı (zemin, ışık, müzik) ve kamera sınırını seçer. Arkadaş listesinde de `friends_status`'un `x, y`'sinden aynı şekilde bulunur (mekandaki arkadaşın noktası dış haritada gösterilmez).
- **İstek:** oyuncu kapının yanında E'ye basar, client en yakın kapının `doorId`'sini gönderir: dışarıdaysa `ENTER_DOOR`, içerideyse `EXIT_DOOR`. Client yer seçmez ve geçişi kendisi yapmaz; `DOOR_RESULT` gelene kadar yürüme girişini durdurur (cevap gelmezse 3 sn sonra bırakır, Öneri).
- **`ENTER_DOOR` kontrolleri:** kapı haritada var; oyuncu kapının `outside` noktasına en fazla `DOORS.maxDistance` tile uzakta (Öneri 1.5); oyuncu takasta değil; `DOORS.cooldownMs`'de bir (Öneri 1000 ms, iki op için ortak, ışınlanma beklemelerinden ayrı); mekanda yer var (içindeki oyuncu sayısı < o mekanın kapasitesi).
- **`EXIT_DOOR` kontrolleri:** aynı, ama mesafe kapının `inside` noktasına ölçülür ve kapasiteye bakılmaz.
- **Kapasite** sunucu config'idir (`INTERIORS.<interiorId>.capacity`, sayılar tasarımdaki Mekanlar tablosu, Öneri), harita dosyasında durmaz. Sunucu başına sayılır. Mekan doluluğu önceden yayınlanmaz; oyuncu girmeyi deneyince öğrenir.
- **Başarılıysa:** balık tutuyorsa olta toplanır (`FISH_END cancelled`), oturuyorsa kalkar (`SEAT_SHOW { id, seatId: "" }`, taşınmadan önce onu görenlere). Oyuncunun konumu ve yönü karşı noktanın `x, y, dir`'i olur (`ENTER_DOOR` → `inside`, `EXIT_DOOR` → `outside`), `moving: false`. Cevap `DOOR_RESULT { doorId, ok: true, interiorId, x, y, dir }`; `interiorId` yeni mekandır, dışarı çıkınca `""`. Sonraki `MOVE` bu konumdan başlar; yolda kalmış eski bir `MOVE` hız sınırına takılır ve `CORRECTION` yeni konumu verir.
- **Reddedilirse:** `DOOR_RESULT { doorId, ok: false, reason, interiorId, x, y, dir }`; `interiorId, x, y, dir` oyuncunun mevcut halidir. `reason`:

| `reason` | Ne zaman |
|---|---|
| `NOT_FOUND` | `doorId` haritada yok |
| `TOO_FAR` | Kapının o tarafındaki noktaya uzak (yanlış op da buraya düşer, ör. dışarıdayken `EXIT_DOOR`) |
| `FULL` | Mekan dolu (client "Dolu" der, oyuncu dışarıda kalır) |
| `BUSY` | Oyuncu takasta |
| `RATE_LIMITED` | Bekleme dolmadan yeni istek |

- Gövdesi bozuk istek sessizce yok sayılır.
- **Yakındakilere bildirim:** ayrı bir kapı mesajı yoktur, görünürlük mesajları yeter. Aynı tick'in sonunda eski alandakiler `PLAYER_LEAVE`, yeni alandakiler `PLAYER_ENTER` alır; taşınan oyuncu da eski komşuları için `PLAYER_LEAVE`, yenileri için `PLAYER_ENTER` alır. `DOOR_RESULT` bunlardan önce gelir.
- **Görünürlük ve sohbet:** aynı mekandaki herkes mesafeye bakılmadan birbirini görür (`PLAYER_ENTER`, `SNAPSHOT`) ve `BUBBLE` alır. Farklı alandakiler (dışarı ve mekan, ya da iki mekan) birbirini görmez ve duymaz. Dışarıda yarıçaplar eskisi gibidir. Görenlere giden diğer mesajlar (`BOBBER`, `EMOTE_SHOW`, `SEAT_SHOW`, `LOOK_SHOW`) bu görünürlüğü izler. Mesafe şartlı işler (takas, tezgah, koltuk) değişmez: alanlar arasındaki boşluk (bkz. Harita dosyası) onları kendiliğinden ayırır. Sunucu geneli mesajlar (`ANNOUNCE`, `STALL_STATE`, `BOARD_STATE`) mekandakilere de gider.
- **Işınlanma:** `GOTO_SPAWN` ve `BOARD_GOTO` mekandan da çalışır, oyuncu dışarı çıkmış olur. `GOTO_FRIEND`'in mekan davranışı `sosyal.md`'dedir.
- **Giriş ve yeniden bağlanma:** aynı hesabın yeniden bağlanmasında oyuncu olduğu yerde kalır. Çıkıp sonradan girişte son konum bir mekandaysa ve bu sunucuda o mekanda yer varsa oyuncu içeride başlar; mekan doluysa o mekanın dosyadaki ilk kapısının `outside` noktasında başlar (Öneri). Kayıtlı konum artık yürünür değilse eskisi gibi `spawn`.
- **Balık tutma:** ek kural yoktur. Sadece suyu olan mekanda (Mağara) atış yapılabilir.

## Duyurular (nadir av)

Kurallar: `docs/tasarim/15-gorsel-stil.md` Bildirimler. Bildirim kutularının çoğu (çanta dolu, enerji az, olta yıpranıyor, bağlantı) client'ın zaten bildiği durumdan çıkar, mesaj gerekmez.

| Op | Yön | Ad | Gövde |
|---|---|---|---|
| 38 | S → C | `ANNOUNCE` | `{ kind, id, name, defId, tier, condition }` (aynı sunucudaki **herkese**, avlayan dahil) |

- `kind`: şimdilik sadece `rare_catch`. Avdan sonra, `tier` Epic veya üstüyse (`ANNOUNCE.minTier`, Öneri) gönderilir. Sadece Tier'li (Float'lı) eşyalar duyurulur, materyal ve çöp duyurulmaz.
- `condition`: avın kondisyonu (`pristine`...`damaged`). **Ham Float değeri gönderilmez.**
- `name`: avlayanın görünen adı. Aynı oyuncunun art arda duyurularını birleştirmek client işidir.
- Duyuru av sonucundan (`FISH_END`) sonra gelir; avlayan kendi `FISH_END` ayrıntısını yine alır.

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
  "waters": [{ "id": "buyuk_gol", "x": 76, "y": 30, "w": 40, "h": 37 }],
  "seats": [{ "id": "kafe_1", "x": 51, "y": 65.5, "dir": "down" }]
}
```

İç mekanlı harita ayrıca şu üç alanı taşır (sayılar sadece örnek):

```json
{
  "width": 260,
  "height": 120,
  "outdoor": { "w": 160, "h": 120 },
  "interiors": [{ "id": "cafe", "x": 200, "y": 0, "w": 20, "h": 14 }],
  "doors": [{
    "id": "cafe_front",
    "interiorId": "cafe",
    "outside": { "x": 76.5, "y": 84.5, "dir": "down" },
    "inside": { "x": 210.5, "y": 12.5, "dir": "up" }
  }]
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
- `seats` (isteğe bağlı): oturulabilen yerler `[{ id, x, y, dir }]`. `x, y` sandalyenin ayak hizası (alt orta), oturan oyuncunun sunucudaki konumu; `dir` oturanın baktığı yön (`up`, `down`, `left`, `right`). Sandalye görseli client'ta yönden seçilir (`down` → `sandalye_on`, `up` → `sandalye_arka`, `right` → `sandalye_yan_sag`, `left` → `sandalye_yan_sol`). `id` tektir, yer yürünür tile'da olmalı. Unity harita dışa aktarması bu alanı henüz yazmıyor (`waters` gibi), elle korunur.
- `waters` (isteğe bağlı): isimli sular. Dikdörtgenin içindeki `~` tile'lar o suya aittir; eşyaların `waters` alanı bu id'leri kullanır (`tasarim/03-balik-tutma.md`, Eşyanın çıkış alanları). `id` küçük harf, rakam ve `_`. Liste verilirse her su tile'ı tam bir suya ait olmalı. Client bu alanı kullanmaz; hangi suda olunduğu oyuncuya gösterilmez (keşif konusu).
- `outdoor`, `interiors`, `doors` (isteğe bağlı, üçü ya birlikte vardır ya da hiç yoktur): iç mekanlar (Kapılar ve iç mekanlar). Yoksa haritanın tamamı dışarıdır. `format` `1` kalır.
  - `outdoor { w, h }`: dış haritanın boyutu; `(0, 0)`'dan başlar. `width` ve `height` iç mekanlarla birlikte bütün dosyayı kapsar. Client dışarıdayken kamerayı ve haritayı bu dikdörtgenle sınırlar.
  - `interiors [{ id, x, y, w, h }]`: her mekanın dikdörtgeni (tam tile, duvarlar dahil). `id` küçük harf, rakam ve `_`, İngilizce: `cafe`, `bank`, `disco`, `museum`, `tailor`, `tackle_shop`, `workshop`, `cave`. Görünen ad dil dosyalarından, ışık, zemin ve müzik client'ta bu id'den seçilir.
  - `doors [{ id, interiorId, outside, inside }]`: `id` kapılar arasında tektir (aynı biçim). `outside` dış haritada, `inside` `interiorId` mekanının içinde bir noktadır: `{ x, y, dir }`. Nokta hem o taraftan geçmek için yanında durulan yer, hem de karşı taraftan gelince inilen yerdir; `dir` inen oyuncunun baktığı yön. Bir mekanın birden çok kapısı olabilir; dosyadaki ilk kapısı ana kapıdır.
  - `rows`, `waters`, `seats` ve `points` iç mekanları da aynı koordinatlarla kapsar (ör. `bank` noktası banka mekanının içinde olabilir).
- Kontroller (sunucu açılırken; biri tutmazsa modül yüklenmez): satır sayısı ve uzunluğu, bilinmeyen karakter, `spawn` ve her nokta harita içinde ve yürünür, `id` tekrarı, sunucunun kullandığı noktalar (`bank`, `market`) var, isimli suların dikdörtgeni harita içinde, içinde su var, çakışmıyor ve isimsiz su kalmıyor. İç mekan alanları varsa ayrıca: `outdoor` ve her mekan dikdörtgeni harita içinde; mekanlar birbirine ve `outdoor`'a görüşten çıkma yarıçapından uzak (arada en az `WORLD.viewLeaveRadius` + 1 boş tile, iki eksenden en az birinde); bu dikdörtgenlerin dışındaki her tile `#`; `spawn` ve `market` noktası dışarıda; mekan ve kapı `id`'leri geçerli ve tekrarsız; her kapının `interiorId`'si var, `outside` dışarıda, `inside` o mekanın içinde, ikisi de yürünür ve `dir` geçerli; her mekanın en az bir kapısı ve config'te kapasitesi var.
- Sonraki adım (Öneri): balık noktaları (`spot`) ve her noktanın havuzu. Havuzlar sunucu verisidir, dosyada sadece noktanın yeri ve id'si durur.
