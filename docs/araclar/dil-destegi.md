# Dil desteği (client)

Oyundaki her yazı bir **anahtarla** gelir; metinler dil dosyalarındadır. Şimdilik Türkçe ve İngilizce tam, diğer diller boş (Ayarlar'da soluk görünür, seçilemez). Karar 01.11.2026, Onur.

## Dosyalar

`client/Assets/Resources/Locales/`

| Dosya | Ne |
|---|---|
| `tr.json` | Türkçe, **ana dosya**. Anahtar listesi buradan gelir. |
| `en.json` | İngilizce, tam. |
| `de.json`, `fr.json`, `es.json`, `ru.json`, `pt-BR.json`, `zh-CN.json`, `ja.json`, `ko.json`, `pl.json` | Bütün anahtarlar var, metinler boş (`""`). Çeviriye gönderilecek dosyalar. |
| `languages.json` | Dil listesi: `code`, kendi dilindeki adı (`name`), İngilizce adı (`english`), `enabled`. |

Biçim düz: `{ "anahtar": "metin" }`. Anahtar `alan.ne` (ör. `settings.language`, `market.err.STALL_FULL`). Yer tutucular adlıdır ve çeviride aynen kalmalıdır: `"Sattın: +{amount} Coin"` → `"Sold: +{amount} Coin"`. `\n` satır sonu, `<color=#...>` renk etiketidir; ikisine de dokunulmaz.

## Çeviri akışı (Onur)

1. Boş dosyayı (ör. `de.json`) al, çevirt. Çevirmen sadece sağdaki metinleri doldurur; anahtarlar ve `{...}` yer tutucuları aynen kalır. Boş bırakılan metin İngilizce görünür.
2. Çevrilmiş dosyayı aynı adla `client/Assets/Resources/Locales/` içine koy (eskisinin üstüne).
3. `languages.json`'da o dilin `enabled` değerini `true` yap. Ayarlar'da seçilebilir olur.
4. Kontrol: `node tools/locale/locale.mjs check` (eksik anahtar, yer tutucusu bozulan metin, seçilebilir ama boş metni olan dil).

Yeni anahtar eklenince (kodda yeni bir yazı): önce `tr.json` ve `en.json`'a yazılır, sonra `node tools/locale/locale.mjs sync` diğer dosyalara boş olarak ekler (var olan çevirilere dokunmaz, silinen anahtarları atar).

**Font:** Press Start 2P Latin harflerini (Türkçe, Almanca, Fransızca, İspanyolca, Portekizce, Lehçe) çizer; Rusça (Kiril), Çince, Japonca ve Korece için ikinci bir font gerekir (`docs/acik-sorular.md`). O diller açılmadan önce font eklenmeli. Ayarlar'daki listede fontun çizemediği dil adı İngilizce yazılır.

## Yayındaki oyunda metin düzeltmek

Gömülü dosyalar build'in içindedir. Yeni build çıkarmadan bir cümleyi düzeltmek için sunucu metni üstüne yazar: client girişte `get_locale` ile o dilin sunucu metinlerini ister, cihazda saklar, gömülü metnin yerine onu gösterir (sözleşme: `docs/protokol.md`, Dil dosyaları). Sunucuya metin yazmak admin panelinin Çeviriler sekmesinden. Sunucu metninin yer tutucuları `tr.json`'dakiyle aynı değilse client onu kullanmaz, gömülü metne döner.

## Kodda

- `Loc.T("anahtar")`, `Loc.T("anahtar", ("count", 3), ("name", ad))` (`Scripts/Loc/Loc.cs`). Sıra: sunucu metni → seçili dilin dosyası → `en.json` → `tr.json` → anahtarın kendisi (eksik anahtar ekranda görünür, konsola uyarı düşer).
- Sunucu hata / sonuç kodu: `Loc.Reason("market", reason)` → `market.err.<KOD>`, yoksa `err.<KOD>`, yoksa `market.err.unknown` / `err.unknown` (`{code}` ile).
- Sayı ve tarih biçimi seçili dilden: `Loc.Culture`.
- Dil değişince `Loc.Changed` olayı ve `Loc.Version` artar: denetleyiciler (`*Controller.Tick`) `Version` değişince pencereyi yeniden çizer.
- Seçilen dil cihazda (`PlayerPrefs` `cg_lang`). İlk açılışta sistem dili Türkçe ise Türkçe, değilse İngilizce.
- **Prefab yazıları:** `Editor/UiPrefabBuilder.cs` sabit yazıları `L("anahtar")` ile yazar: prefab Türkçe kaydedilir ve yazıya `LocText` bileşeni eklenir; oyun sırasında seçili dili gösterir, dil değişince değişir. Kodun sonradan doldurduğu bir yazıya (`LocText`'in yazdığından farklı bir metin) `LocText` dokunmaz. Elle Unity'de eklenen yazıya anahtar vermek: `LocText` bileşenini ekle, `key` alanını doldur. Simge tooltip'leri (`HoverTip`) `@@anahtar` biçimini anlar.
- Çevrilmeyenler: eşya, set ve tier adları, Float, Coin, Collection Score, göl / sunucu adları, oyuncu adları. NPC adları şimdilik `Resources/Npcs.json`'daki Türkçe adlar (açık soru).

## Mac'te kontrol (bulut oturumu Unity'yi derleyemez)

1. Unity açılınca derleme hatası var mı (`Scripts/Loc/*.cs` yeni; `Loc.T(..., ("ad", değer))` tuple yazımı).
2. Builder sürümü 38: prefablar kendiliğinden yeniden kurulur. Yeni `.meta` dosyaları (Locales, Loc) commit'lenmeli.
3. Ayarlar > Genel > Dil: liste açılıyor mu, English seçilince açık pencereler ve HUD İngilizceye dönüyor mu, diğer diller soluk ve tıklanamaz mı.
4. Sunucuda `get_locale` yokken giriş sorunsuz mu (konsolda sadece `get_locale skipped`).
