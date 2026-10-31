# İçerik Yönetimi (eşyalar, setler, recipe'ler)

Durum: **kod var** (31.10.2026). Araç: `docs/araclar/admin-paneli.md`. Kod: `server/src/rules/content.ts` (kurallar, testli), `server/src/match/content.ts` (depolama), `server/src/admin/rpc.ts`.

Amaç: yeni eşya, set ve recipe eklemek, mevcutları değiştirmek için oyun güncellemesi ya da kod değişikliği gerekmesin. Eşyalar artık kodda değil, sunucu verisinde.

## 1. Tek içerik belgesi

Sunucu bütün içeriği tek belgede tutar (`content/doc`, sistem kullanıcısı):

| Ne | Not |
|---|---|
| Eşyalar | Her türden: defter eşyası, sıradan balık (görev balığı), çöp, malzeme, yem |
| Setler | Her aktif set bir defter sayfası |
| Recipe'ler | Craft edilebilir eşyanın içinde durur, ayrı liste yok |
| Av tablosu | Kategori ağırlıkları (10000 = %100) |
| Seri sandıkları | 1..N. gün |
| Günlük görev listesi | |

Görseller eşya başına ayrı kayıtta durur (`content_art/<id>`), belge sadece hash'ini ve boyutunu bilir.

Kayıt yokken sunucu eski yer tutucu listelerle (`data/lake-pool.ts`, `recipes.ts`, `book-pages.ts`, `quests.ts`, config'teki yemler) aynı içerikle başlar (`data/seed-content.ts`; test bunların birebir aynı olduğunu kontrol eder). Admin panelinde ilk kayıtla birlikte belge veritabanına yazılır ve o andan sonra o geçerlidir.

## 2. Eşya alanları

| Alan | Anlamı |
|---|---|
| `id` | Değişmez. Küçük harf, rakam, `_`, `.` (2–64). Item Art Studio dosya adı = id |
| `name` | Şimdilik İngilizce, en fazla 40 karakter. Dil desteği gelince çeviri ayrı tutulacak |
| `type` | `item` (Float + Tier, tek tek), `fish` (sıradan balık), `junk`, `material`, `bait`. Son dördü yığılır |
| `tier` | `item` için zorunlu. Yığılan eşyada sadece gösterim (renk, sıralama) |
| `book` | Deftere giren eşya mı (sadece `item`). Defter eşyasının bir seti olmalı |
| `setId` | Hangi set. Set yoksa sayfada görünmez |
| `order` | Set içindeki sıra = defter sayfasındaki sıra |
| `active` | Pasif eşya artık çıkmaz, sayfada görünmez, craft edilemez, sandıktan düşmez. Oyuncudaki kopyalar kaybolmaz, satılır, adı görünür |
| `status` | `draft` (onay bekliyor, oyun görmez) ya da `live` |
| `drop` | Sudan çıkışı; `null` = çıkmaz. `waters` (haritadaki isimli sular, boşsa hepsi), `bands` (kıyı / orta / derin, boşsa hepsi), `baits` (bu yemle kategorisinde ×3), `minLevel`, `weight` |
| `recipe` | `null` = craft edilemez. Bkz. 4 |
| `bait` | Sadece yem: dükkan fiyatı, çalıştığı bantlar, kategori çarpanları |

## 3. Setler ve defter sayfaları

- Her **aktif** setin, **aktif ve onaylı** defter eşyaları sırasıyla bir defter sayfasıdır. Sayfa id'si = set id'si.
- Yeni bir sete ilk defter eşyası onaylanınca sayfa kendiliğinden oyuna gelir.
- Set pasife alınınca eşyaları da pasif sayılır ve sayfası defterden kalkar. Oyuncunun o sayfadaki kayıtları silinmez; set yeniden açılınca geri gelir. Kalkan sayfa o sürece şans ve Score'a sayılmaz.
- 66 eşyalık bir setin tek sayfa mı, birkaç sayfa mı olacağı açık (`acik-sorular.md` 9). Şimdilik bir set = bir sayfa; gerekirse set ikiye bölünür.

## 4. Craft ve otomatik recipe

- Bir eşya "craft edilebilir" yapılınca recipe'si kendiliğinden oluşur: id `recipe.<eşya id'sinin son parçası>` (doluysa `_2`, `_3`…). Recipe id'si bir kez verilir, sonra değişmez (oyuncular recipe'ye sahip olabilir).
- Malzemeler **her setten** seçilebilir. Yığılanlar (balık, çöp, malzeme, yem) `stacks`, Float'lı eşyalar `items` olur; oyuncu craft'ta hangi kopyayı vereceğini seçer.
- Recipe derecesi (Normal / İyi / Usta) çıkan Float'ın en kötü sınırını belirler (`08-recipe-craft.md`). Toz maliyeti Tier'dan gelir; yığın çıktıda (yem, malzeme) kaç adet yapıldığı ve toz recipe'de yazılır.
- Recipe'nin kendisi de sudan çıkabilir (kendi göl / derinlik / level / ağırlık ayarı), sandıkta olabilir ya da yeni hesaba başlangıç recipe'si olarak verilebilir.
- Onaylı bir eşyanın recipe'si kapatılamaz (oyuncudaki recipe boşa düşmesin); onun yerine recipe'nin sudan çıkışı kapatılır ya da eşya pasife alınır.

## 5. Düşme oranı

- Önce kategori seçilir (av tablosu, bant çarpanı, yem, defter şansı; `03-balik-tutma.md`), sonra o kategoride o noktaya uyan eşyalar arasından **ağırlığa göre** biri.
- Ağırlık varsayılan 1: kategorideki eşyalar eşit şanslı. Admin bir eşyanın ağırlığını değiştirerek onu daha sık / seyrek yapar. Panel "genel düşme oranı"nı (kategori payı × ağırlık payı) gösterir; bant, göl, level, yem ve defter şansı bunu o noktada değiştirir.
- Av tablosundaki **sıradan balık** (`fish`) ağırlığı, ilk balık eşyası gelene kadar 0'dır (`18-gunluk-gorevler.md` önerisi 3805, Common 1200). Eşyası olmayan kategori çöpe düşer.

## 6. Değişiklik kuralları

- Her kayıt bütün belgeyi doğrular; hatalıysa hiçbir şey yazılmaz (ör. Tier'sız `item`, var olmayan göl, kendini malzeme olarak kullanan recipe, sandıkta Float'lı eşya).
- Onaylı eşyada **yapılamayanlar**: geri taslağa almak, Float'lı ↔ yığılan tür değişimi, recipe'yi kaldırmak / id'sini değiştirmek. Silmek de yok; pasife alınır. Taslaklar serbestçe değişir ve silinir.
- Tier değişebilir: oyuncudaki kopyalar kendi Tier'ını taşır, yeni çıkanlar yeni Tier'la gelir.
- İki kişi / iki sekme aynı anda kaydederse ikincisi "içerik değişti" hatası alır ve sayfayı yenileyip tekrar dener.
- Kaydedilen içerik bütün sunuculara birkaç saniye içinde geçer (her maç en geç 3 sn'de bir okur, admin kaydı ayrıca maçlara hemen haber verir). Sunucuyu yeniden başlatmak gerekmez.
- Listeden çıkarılan günlük görev, o gün onu almış oyuncuda yapılmış sayılır (sandığı engellemesin).

## 7. Client

Client eşya adlarını ve ikonları build'e gömmez; `get_content` ve `get_item_art` ile sunucudan alır (`docs/protokol.md`, İçerik). Unity tarafı Mac oturumunda yazılacak.
