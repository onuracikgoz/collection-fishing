# Protokol: Eşya adları ve görselleri, dil dosyaları

Genel kurallar ve op code dizini: `docs/protokol.md`.

## İçerik: eşya adları ve görselleri (Faz 6)

Eşyalar, setler, recipe'ler, defter sayfaları, av tablosu, sandıklar ve görevler artık sunucu verisidir; admin paneli (`docs/araclar/admin-paneli.md`) oyun güncellemesi olmadan ekler ve değiştirir (`docs/tasarim/19-icerik-yonetimi.md`). Bu yüzden client eşya adını id'den türetmez, ikonunu build'e gömmez; ikisini de sunucudan alır.

- `get_content` → `ContentResponse`. Girişte bir kez istenir. `updatedAt` değişmişse (client bunu `get_catalog` / `get_book` açarken ya da birkaç dakikada bir tekrar sorarak görür) liste yenilenir.
  - `updatedAt`: içeriğin son yayın zamanı (ms).
  - `items: [{ id, name, type, tier, setId, active, art }]`: sunucunun bildiği her eşya ve recipe, pasif olanlar dahil (oyuncudaki eski kopyaların adı görünsün diye). `type`: `item` (Float + Tier), `fish` (sıradan balık), `junk`, `material`, `bait`, `recipe`. `tier`, `setId`, `art` yoksa `""`. Onay bekleyen taslaklar listede yoktur. Recipe'nin adı `Recipe: <eşya adı>`; görseli yoktur (ortak recipe ikonu).
  - `sets: [{ id, name, active }]`: set sırasıyla. Defter sayfasının `id`'si set id'sidir (`BookResponse.pages[].id`), başlığı buradaki `name`.
  - `pages: [setId]`: şu an defter sayfası olan setler (profilde "tamamlanan sayfa x/y" için y).
  - `art`: görselin hash'i (sha256). Client görselleri hash'le önbelleğe alır, sadece hash'i değişen ya da hiç olmayanları `get_item_art` ile ister.
- `get_item_art` `{ ids }` → `{ art: [{ id, hash, png, icon? }] }`: en fazla 40 id; görseli olmayan, bilinmeyen ya da taslak id'ler sessizce atlanır. `png` base64, 128×128 şeffaf PNG (defter, tooltip); Unity'de Filter Mode **Point** ile `Texture2D.LoadImage`.
  - `icon` (08.11.2026): 32×32 şeffaf PNG, çanta yuvası ve yere düşen eşya için. Elle temizlenmiş, konturlu küçük ikondur; 128'lik görselin küçültülmüşü değildir. Eski görsellerde yoktur: o zaman client 128'lik görseli kullanır (bugünkü davranış). `icon` gelince `hash` de değişir, client ikisini birlikte önbelleğe alır. Büyük gösterimde `icon` sadece tam katla (2x, 3x) büyütülür.
- Ad ve ikon yoksa (ağ hatası, sunucuda görseli olmayan eski yer tutucu eşyalar) client id'den ad türetir ve çizilmiş yer tutucu ikonu (`ItemIcons`) gösterir. Client: `UI/ItemContent.cs`; girişte ve her sunucuya katılırken yüklenir, adı `FishingController.ItemName`, ikonu `ItemIcons.For` (128, defter ve inceleme) ve `ItemIcons.ForSlot` (yuvalar: 32'lik `icon`, yoksa 128, yoksa yer tutucu) kullanır, defter sayfası adı `CollectionController.PageName` (üç eski yer tutucu sayfa Türkçe adını korur).

## Dil dosyaları (Faz 6, 01.11.2026)

Oyunun yazıları anahtarla gelir (`docs/araclar/dil-destegi.md`). Client her dili build'e gömülü taşır (`client/Assets/Resources/Locales/<lang>.json`, düz `"anahtar": "metin"`); sunucu, yeni build çıkarmadan metin düzeltmek için bunların üstüne yazar.

- Dil kodları: `tr`, `en`, `de`, `fr`, `es`, `ru`, `pt-BR`, `zh-CN`, `ja`, `ko`, `pl`. Bilinmeyen kod → `BAD_REQUEST`.
- `get_locale` `{ lang, hash? }` → `{ lang, hash, strings? }`. `strings` düz `{ "<anahtar>": "<metin>" }` nesnesidir; `hash` sunucudaki metinlerin özeti. İstekteki `hash` sunucudakiyle aynıysa `strings` gönderilmez (client önbelleğini kullanır). O dil için sunucuda hiç metin yoksa `hash: ""`, `strings: {}`.
- Sunucu sadece değiştirdiği anahtarları gönderebilir (hepsini de gönderebilir). Client sırası: sunucu metni → gömülü dil dosyası → gömülü `en.json` → gömülü `tr.json` → anahtarın kendisi.
- Yer tutucular adlıdır: `{count}`, `{name}`, `{item}`. Client, yer tutucuları gömülü `tr.json`'daki metinden farklı olan sunucu metnini kullanmaz (bir yazım hatası herkese gitmesin).
- Client `get_locale`'i girişte (`LoginAsync`'ten hemen sonra) ve oyuncu Ayarlar'dan dil değiştirince çağırır; cevabı cihazda saklar (PlayerPrefs `cg_loc_<lang>`, `cg_loc_hash_<lang>`). Hata (RPC yok, ağ yok, `RATE_LIMITED`) oyunu durdurmaz, gömülü metinler kalır.
- Sunucu mesajları metin değil kod döner (`reason`, hata kodu); client kodu `<alan>.err.<KOD>` anahtarıyla yazıya çevirir (`Loc.Reason`). Eşya, set ve tier adları, Float, Coin, göl / sunucu adları çevrilmez. Hikayeler dile göre ayrı tutulur (sunucu tarafı, admin paneli).
- Admin panelindeki Çeviriler sekmesi anahtar listesini bu dosyalardan okur (`languages.json` hariç).
