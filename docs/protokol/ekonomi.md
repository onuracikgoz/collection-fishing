# Protokol: Coin, NPC satış, toz, birleştirme, craft, depo, fiyatlar, günlük görev

Genel kurallar ve op code dizini: `docs/protokol.md`.

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

## Fiyat ve recipe listesi (Faz 4)

Client'ın Faz 4 pencereleri (satış, birleştirme, craft, dükkan, depo) fiyatları ve recipe'leri tıklamadan önce göstermek için `get_catalog` çağırır. Sadece gösterim içindir: sayılar `server/src/config.ts` ve admin panelinden yönetilen içerikten (recipe'ler, yemler) gelir, client'a gömülmez; her sonucu yine yukarıdaki mesajlarda sunucu hesaplar. Cevap config ya da içerik değişmedikçe aynıdır; client girişte ve `get_content`'in `updatedAt`'i değişince ister.

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
