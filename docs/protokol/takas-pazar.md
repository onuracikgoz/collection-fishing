# Protokol: Takas, takas kayıtları, eşya kilidi, eşya atma, pazar ve pano

Genel kurallar ve op code dizini: `docs/protokol.md`.

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

## Eşya kilidi

Kurallar: `docs/tasarim/07-kopya-envanter.md` 9.3.

| Op | Yön | Ad | Gövde |
|---|---|---|---|
| 48 | C → S | `ITEM_LOCK` | `{ instanceId, locked }` |
| 49 | S → C | `ITEM_LOCK_RESULT` | `{ instanceId, locked, ok, reason? }` (sadece isteyene) |

- Sadece **çantadaki** Float eşya kilitlenir (defter yuvası ve depo hariç). Aynı duruma tekrar istek `ok` döner. `reason`: `BAD_REQUEST`, `NOT_OWNED`.
- Kilit eşyanın kendisinde durur: `ItemInstance.locked?: true` (`get_inventory`, takas görünümü). Kilitli eşya **satılamaz** (`SELL`), **parçalanamaz** (`SALVAGE`), `MERGE` ve `CRAFT` girdisi olamaz, takasa konamaz: bu işlemler `reason: "LOCKED"` ile reddedilir. Depoya ve deftere konabilir, kilit korunur. Önce kilit açılır.
- Yeni eşyalar (av, craft, birleştirme, takas) kilitsiz gelir.

## Eşya atma (31.10.2026, Onur)

Çantadaki çöp kovası. Client "Emin misin?" diye sorar, sonra niyeti gönderir; eşyayı sunucu siler.

| Op | Yön | Ad | Gövde |
|---|---|---|---|
| 65 | C → S | `ITEM_DISCARD` | `{ instanceId }` (Float'lı tek eşya) ya da `{ defId, count }` (yığından `count` tane) |
| 66 | S → C | `ITEM_DISCARD_RESULT` | `{ ok, instanceId?, defId?, count?, reason? }` (sadece isteyene) |

- Sadece **çantadaki** eşya atılır (defter yuvası, depo, tezgah hariç). Kilitli eşya atılmaz: `LOCKED`. Takas penceresi açıkken (davet dahil) atılmaz: `BUSY`. Çantada olmayan ya da yığında yetmeyen: `NOT_OWNED`. Bozuk gövde: `BAD_REQUEST`.
- Atılan eşya geri gelmez; karşılığında Coin ya da toz verilmez (parçalamak Tüccar'da).
- Başarılıysa client çantayı yeniden okur (`get_inventory`).
- Çantadaki **sıra** sunucuda tutulmaz: client'ın görünümüdür (çanta ve depoda sürükle-bırak, bu cihazda saklanır, `docs/araclar/ui-uygulama.md`).

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
- **Pano reklamı** aşağıda (Pazar Panosu). **Alım ilanı yok** (karar 29.10.2026).

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

### Pazar Panosu (elmasla reklam)

Kurallar: `docs/tasarim/09-ekonomi-pazar.md` (Pazar Panosu). Sunucu: `rules/board.ts` (saf kurallar), `match/market.ts`. Açık tezgahı olan oyuncu **elmas** öder, tezgahı meydandaki panoya girer; başkaları panodan tıklayıp tezgahın yanına gider. Reklam eşya miktarını ya da kalitesini etkilemez (kural 2).

| Op | Yön | Ad | Gövde |
|---|---|---|---|
| 60 | C → S | `BOARD_AD` | `{ action: "set", highlights: [{ instanceId, defId }] }` ya da `{ action: "remove" }` |
| 61 | S → C | `BOARD_STATE` | `BoardStateMsg` (sunucudaki herkese: girişte tam liste, sonra her değişimde) |
| 62 | S → C | `BOARD_RESULT` | `BoardResultMsg` (sadece isteyene) |
| 63 | C → S | `BOARD_GOTO` | `{ userId }` (panodaki ilana tıkla, tezgahın yanına git) |

- **Kurma:** `set`. Oyuncunun bu sunucuda **açık tezgahı** olmalı (`NO_STALL`). `highlights`: ilanda öne çıkacak en fazla 3 kalem (`BOARD.maxHighlights`); Float'lı eşya `instanceId` ile, yığın `defId` ile verilir (Unity ikisini de gönderir, dolu olan geçer). Kalem tezgahta yoksa `NOT_IN_STALL`. Boş liste verilirse ilan tezgahın ilk kalemlerini gösterir.
- **Ücret:** yeni ilan **10 elmas** (`BOARD.priceDiamonds`, Öneri, config'den ayarlanır) öder; elmas yetmezse `NOT_ENOUGH_DIAMOND`. Elmas cüzdandan düşülür (`BOARD_RESULT.diamond` kalan bakiye). Çalışan ilanda `set` tekrar gönderilirse sadece öne çıkan kalemler değişir, **ücret alınmaz** ve ilanın sırası/süresi korunur.
- **Yer:** panoda aynı anda sunucu başına en fazla 8 ilan (`BOARD.slots`, Öneri), doluysa `BOARD_FULL`. İlanlar başlama sırasına göre (eskiden yeniye) listelenir; panoda sırayla dönmesi client işidir. Arama ve fiyat sıralaması yok.
- **Süre:** ilan en fazla 24 saat (`BOARD.ttlMs`) ve **tezgah açık kaldığı sürece** durur: tezgah kapanır, geri çağrılır ya da her şey satılırsa ilan da kalkar. `remove` ilanı kaldırır. İlan erken kalkarsa **elmas iade edilmez** (Öneri). İlanlar sunucu bellekte tutulur, sunucu yeniden başlayınca tezgahla birlikte gider.
- **Tıklama:** `BOARD_GOTO { userId }`: ilan hâlâ bu sunucudaysa oyuncu tezgahın yanındaki boş bir yere `TELEPORT` ile gider ("Yanına git" kurallarıyla aynı: 3 sn'de bir, balık tutuyorsa olta toplanır). Hata `TELEPORT.reason` ile gelir: `NOT_HERE` (ilan ya da tezgah yok), `NO_SPOT`, `RATE_LIMITED`. Arkadaş olmak gerekmez.
- **Hatalar (`BOARD_RESULT.reason`):** `NO_STALL`, `BAD_REQUEST`, `NOT_IN_STALL`, `BOARD_FULL`, `NOT_ENOUGH_DIAMOND`.

```
BoardAd        = { userId, name, title, spot, x, y, top: StallEntry[], total, startedAt, expiresInMs }
                 // top: seçilen kalemler (tezgahta kalanlar), seçilmemişse tezgahın ilk kalemleri
BoardStateMsg  = { full, ads: BoardAd[], removed: [userId] }
BoardResultMsg = { action: "set" | "remove", ok, reason?, diamond? }
```
