# Admin Paneli

Eşya, set, recipe, düşme oranı, sandık ve görevleri oyun güncellemesi olmadan yöneten web aracı. Kod: `tools/admin/` (React + TypeScript + Vite). Kurallar: `docs/tasarim/19-icerik-yonetimi.md`.

```bash
docker compose up -d          # yerel Nakama
cd tools/admin
npm install                   # her branch değişiminde
npm run dev                   # http://127.0.0.1:7370
npm test                      # görsel kontrolü ve ZIP okuma testleri
npm run build                 # tip kontrolü + üretim build'i
```

Giriş ekranında Nakama adresi (yerelde `http://127.0.0.1:7350`) ve sunucu anahtarı (`runtime.http_key`, yerelde Nakama'nın varsayılanı `defaulthttpkey`) istenir; tarayıcıda hatırlanır.

## Güvenlik

- Panel `admin_*` RPC'lerini **sunucu anahtarıyla** çağırır (`/v2/rpc/admin_*?http_key=…&unwrap`). Bu çağrının oyuncusu yoktur; oyuncu oturumuyla gelen her `admin_*` çağrısı `NOT_ALLOWED` ile reddedilir (`server/src/admin/rpc.ts`). Dev dashboard'un aksine `DEV_TOOLS`'a bağlı değildir, canlıda da çalışır.
- Canlı / test sunucusunda `runtime.http_key` mutlaka değiştirilir ve sadece Onur'da durur. Anahtarı bilen herkes içeriği değiştirebilir. Panel internete açık bir yerde barındırılmaz; yerelde çalışır, canlı Nakama'ya bağlanır.

## Akış

```
collection-set-generator skill → eşya listesi + Perchance promptları
Perchance → PNG'ler (dosya adı = eşya id'si)
Item Art Studio → hazırla, onayla → ZIP (sadece <id>.png)
Admin paneli → ZIP yükle → kuyrukta sırayla ayarla → Onayla → oyunda
```

1. **Onay kuyruğu → ZIP yükle.** ZIP'teki her PNG'nin adı eşya id'sidir (klasör fark etmez, `(1)` eki atılır). Yüklemeden önce her görsel kontrol edilir (aşağıda); hatalı görseller varsayılan olarak yüklenmez, istersen işaretlersin. Yeni id'ler **taslak** olur; seçtiğin set, tür ve Tier taslağa yazılır (sette gelen Float'lı eşya defter eşyası işaretlenir). Taslağı olan id'nin görseli yenilenir. Oyundaki bir eşyanın görseli ancak "oyundaki eşyaların görselini de değiştir" işaretliyse değişir.
2. **Kuyrukta sırayla.** Taslaklar set ve sıra düzeninde tek tek açılır: isim, tür, Tier, set, defter, aktiflik, nereden çıkar (göl, derinlik, yem, level, ağırlık + genel oran), craft (malzemeler her setten, derece, yeni hesaba verme, recipe'nin kendi çıkışı), yem ayarları. **Onayla ve oyuna koy** eşyayı yayınlar ve sıradakine geçer. **Sonra** kuyruğun sonuna atar, **Sil** taslağı siler.
3. Yeni bir sete ilk defter eşyası onaylanınca oyunda yeni defter sayfası belirir.

## Sekmeler

| Sekme | Ne yapar |
|---|---|
| Onay kuyruğu | ZIP yükleme ve sırayla onay |
| Eşyalar | Bütün eşyalar; arama ve set / tür / Tier / durum filtreleri (oyunda, pasif, onay bekliyor, craft edilebilir, görseli yok). Tıklayınca düzenleme; görsel değiştirme. **+ Yeni eşya** görselsiz eşya açar (görsel sonra ZIP ya da "Görseli değiştir" ile) |
| Setler | Set oluşturma, adını değiştirme, pasife alma, sıralama; setin eşyaları defter sırasıyla, sıra değiştirme, pasife alma, başka setten eşya taşıma |
| Düşme oranları | Av tablosu (kategori ağırlıkları, yüzde ve kategorideki eşya sayısı) ve her eşyanın genel oranı |
| Sandıklar ve görevler | Seri sandıkları (Coin / toz aralığı, çekiliş sayısı, havuz ve garanti) ve günlük görev listesi |
| Çeviriler | Oyun yazılarını dile göre düzenleme (aşağıda) |
| Geliştirici | Dev dashboard (`docs/araclar/dev-dashboard.md`) bu panelin içinde, `/dev/` altında |
| JSON | Toplu taslak ekleme (JSON kısayolu) ve bütün içeriğin yedeği |

Her kayıt önce panelde, sonra sunucuda bütün içeriğe karşı doğrulanır; hata varsa kaydedilmez ve nedeni yazılır. Kaydedilen değişiklik birkaç saniye içinde bütün sunucularda geçerlidir.

## Görsel kontrolü

`src/artCheck.ts` (testli), Item Art Studio çıktısının kuralları:

| Kontrol | Sonuç |
|---|---|
| Boyut 128×128 | Değilse hata (8/16/32 kare ise uyarı: UI ikonu boyutu) |
| Arka plan şeffaf | Hiç şeffaf piksel yoksa hata, köşeler boyalıysa uyarı |
| Yarı saydam piksel | Uyarı (pixel art'ta alfa 0 ya da 255) |
| Bütün renkler `content/palette.hex`'te | Palet dışı piksel %2'yi geçerse hata, altındaysa uyarı |
| Nesne çerçeveyi dolduruyor | %60'tan küçükse uyarı |
| Nesne ortalı | Merkezden 5 px'ten fazla kaymışsa uyarı |
| Renk sayısı | 48'den fazlaysa uyarı |

Görseli hatalı ya da görselsiz bir taslak onaylanırken panel bir kez daha sorar. Sunucu ayrıca sadece PNG imzasını, en fazla 512 px ve 96 KB'ı kabul eder.

## JSON kısayolu

**JSON** sekmesine (ya da `admin_import`'a) liste yapıştırılır; her eşya taslak olur ya da var olan taslağı doldurur, yine kuyrukta onay bekler. Oyundaki eşyalar burada değişmez. Bilinmeyen `sets` oluşturulur. Görseller sonra aynı id'lerle ZIP olarak gelir; sıra fark etmez.

```json
{
  "sets": [{ "id": "lost_captain", "name": "Lost Captain" }],
  "items": [
    { "id": "mat_driftwood", "name": "Driftwood", "type": "material", "tier": "common", "setId": "lost_captain", "drop": { "bands": ["shore", "mid"] } },
    { "id": "sextant", "name": "Sextant", "type": "item", "tier": "epic", "setId": "lost_captain", "book": true,
      "recipe": { "grade": "normal", "stacks": [{ "defId": "mat_brass_scrap", "count": 3 }], "items": [], "drop": { "bands": ["deep"] }, "starter": 0 } }
  ]
}
```

Alanlar ve anlamları: `docs/tasarim/19-icerik-yonetimi.md` 2. Liste doğrudan dizi de olabilir (`[ {...}, {...} ]`).

## Çeviriler

Oyun yazıları dil başına düz `anahtar → metin` olarak tutulur (`{count}` gibi adlı yer tutucular). Türkçe ve İngilizce Unity build'inin içindedir (`client/Assets/Resources/Locales/<dil>.json`); diğer diller (de, fr, es, ru, pt-BR, zh-CN, ja, ko, pl) build'de boştur. Sunucu, bu sekmede kaydedilen metinleri dil başına saklar (`locale/<dil>`), istemci `get_locale` ile çeker ve build'deki metnin üstüne yazar. Yani prod'da bir cümleyi düzeltmek ya da yeni dil eklemek için build gerekmez.

- Anahtar listesi build'deki dosyalardan okunur; tablo Türkçe, İngilizce ve seçili dil yan yana gösterir. Filtreler: çevrilmemiş, sunucuda değişen, yer tutucusu Türkçesiyle uyuşmayan.
- **Çeviri için indir**: bütün anahtarları İngilizce metinle verir; dosyayı çeviriye gönder, çevrilmiş JSON'u **JSON yükle…** ile al, **Kaydet**'e bas. Yükleme kaydetmez, sadece taslağa yazar.
- Boş metin silinir (o anahtar build'deki metne döner). İki sekme çakışırsa ikincisi "değişti" hatası alır.
- Eşya ve set adları, Tier adları, `Float`, `Coin` İngilizce kalır (çevrilmez). Eşya hikayeleri dile göre ayrıdır: eşya düzenleme ekranındaki **Hikaye** bölümünde dil seçip yazılır (anahtar `item.story.<id>`, onay beklemez); aynı metinler bu sekmede de görünür.

## Admin RPC'leri

Hepsi sunucu anahtarıyla, `version` (son okunan içerik sürümü) alır; araya başka kayıt girdiyse `CONTENT_CHANGED` döner. Doğrulama hatası `CONTENT_INVALID` (mesajda satır satır nedenler).

| RPC | Ne yapar |
|---|---|
| `admin_content` | İçerik belgesi, sürümü, hatalar, haritadaki sular, en yüksek level |
| `admin_art_get` | `{ ids }` (en fazla 100) görseller, base64 |
| `admin_item_save` | `{ version, item }` ekler / günceller; `status: "live"` = onay |
| `admin_item_delete` | `{ version, id }` sadece taslak (recipe'de kullanılıyorsa hayır) |
| `admin_set_save` | `{ version, set }` ekler / günceller |
| `admin_settings_save` | `{ version, catchTable?, chests?, quests? }` |
| `admin_art_put` | `{ version, id, png, setId?, type?, tier? }` görsel; bilinmeyen id yeni taslak |
| `admin_import` | `{ version, items, sets? }` JSON kısayolu |
| `admin_locale_get` | Bütün dillerin sunucudaki metinleri `{ langs: { tr: { version, hash, updatedAt, strings } } }` |
| `admin_locale_save` | `{ lang, version, strings }` o dilin metinlerini değiştirir (`version` o dilin okunan sürümü) |

## Kod yapısı

| Dosya | İçerik |
|---|---|
| `src/content.ts` | Sunucunun içerik kuralları (`server/src/rules/content.ts`) aynen; panel kaydetmeden önce aynı doğrulamayı yapar |
| `src/api.ts` | `admin_*` çağrıları |
| `src/state.ts` | İçerik, derlenmiş hali, küçük resimler ve görsel raporları |
| `src/artCheck.ts`, `src/images.ts` | Görsel kontrolü, PNG / ZIP okuma (saf, testli) |
| `src/chance.ts` | Genel düşme oranı |
| `src/locales.ts` | Build'deki dil dosyaları ve anahtar listesi |
| `vite.config.ts` | Dev dashboard'u `/dev/` altında sunan eklenti |
| `src/components/` | Sekmeler ve eşya düzenleme formu |
