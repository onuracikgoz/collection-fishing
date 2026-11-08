# Item Art Studio

AI ile üretilen eşya görsellerini oyun ikonuna çeviren, onaylatan ve toplu dışa aktaran yerel web aracı. Kod: `tools/item-art-studio/` (React + TypeScript + Vite, backend yok).

```bash
cd tools/item-art-studio
npm install     # her branch değişiminde, yeni paket gelmiş olabilir
npm run dev     # http://localhost:5173
npm test        # görsel işleme birim testleri (vitest)
npm run build   # tip kontrolü + üretim build'i
```

## Karar: her eşya ayrı AI görseli

Renk varyantları dahil her defter kaydı Perchance'te ayrı üretilir. Araçta renk değiştirerek varyant üretmek denendi (18.10.2026), sonuçlar AI görselinin ışık-gölgesiyle uyuşmadığı için kaldırıldı. Araç yalnızca hazırlar ve seçtirir. Aynı nesnenin varyantlarında prompt aynı kalır, yalnızca renk / malzeme kelimeleri değişir.

## Akış

```
Perchance PNG'leri (+ set.json) → hazırla → onayla → Export ZIP → admin paneli (ZIP yükle)
```

1. **Dosyaları bırak.** Pencereye istediğin kadar PNG sürükle (veya *Add files*). Aynı anda `set.json`, `.studio.json` ve `.hex` palet dosyası da bırakılabilir. Perchance'ta görsele sağ tık → *Görseli kopyala* yapıp Studio'da **Ctrl+V / Cmd+V** basarsan görsel doğrudan eklenir (PNG, JPEG veya WebP). Panodan gelen görselin adı yoktur; `pasted_1`, `pasted_2`... diye eklenir, eşya id'sini ortadaki alandan düzelt.
   - **PNG dosya adı = eşya id'si** (`glass_bottle_blue.png` → `glass_bottle_blue`). İndirilen kopyaların `(1)` eki yok sayılır, böylece aynı eşya için birden fazla aday yan yana gelir.
   - Set yüklüyse soldaki liste setin sırasıdır: yeşil nokta onaylı, sarı aday var, gri **görsel yok**. Üstteki sayaç kaç eşyanın hazır olduğunu gösterir. Sette olmayan görseller listenin sonunda "not in set" olarak durur; ortadaki *Item id* alanından doğru id'yi seçebilirsin.
2. **Hazırla** (sağ panel, her görsel için ayrı; *Use these settings for all* hepsine uygular):
   - **Arka plan:** kenara değen düz arka plan (Perchance'in beyazı) silinir, kenardaki hale temizlenir. Nesnenin içindeki aynı renkli alanlara dokunulmaz. Kalan alanlar için **sihirli silgi** (E): tıklanan renge benzeyen bitişik alan silinir.
   - **Boyut:** nesne kırpılır, ortalanır, seçilen boyuta küçültülür: **Item 128** (defter eşyası, varsayılan), 32, **Icon 16** (HUD, menü, emote ikonu, 1 px kenar), **Inline 8** (yazı yanındaki Coin / toz / kupa, kenarsız). Arayüz 1x çizilip 2x gösterilir; 16'lık ikon ekranda 32 px görünür. Küçük boyutta AI görseli çamurlaşabilir, gerekirse Aseprite / Piskel'de elle düzeltilir. UI ikonları `client/Assets/Art/UI/Icons/` altına konur (`icon_<ad>.png`, `emote_<ad>.png`). Küçültme her bloğun baskın rengini alır; bulanıklaşma ve ara renk olmaz. Küçük görsel büyütülmez.
   - **Kontur** (*Add 1 px outline*, varsayılan açık): küçültme ince konturu yok eder, çünkü her blok baskın rengini alır. Bu adım nesnenin dışına 1 px kontur çizer: komşu nesne renginin koyu, hafif mora kaymış tonu (LPC'deki gibi, siyah değil). Kenarı zaten koyu olan yerlere dokunmaz, çift kontur olmaz. Palete çekmeden önce yapılır.
   - **Palet:** her piksel ortak paletteki en yakın renge (OKLab) çekilir. Dithering yok. *Keep hue* (varsayılan açık) renk tonu farkını iki kat ağır sayar: paletinde karşılığı olmayan açık lavanta nane yeşiline değil beyaza / maviye gider.
3. **Onayla.** Ortada orijinal, oyun ikonu ve oyundaki boyutları (32 / 48 / 96 px). Klavye: **A** onayla, **X** reddet (ve sıradakine geç), **← / →** gez. Bir eşyanın en fazla bir onaylı adayı olur.
4. **Export ZIP.** Onaylı görseller tek ZIP'te iner, her eşya için 128 ve 32 px. ZIP'te sadece görseller var; admin panelinin onay kuyruğuna yüklenir (`docs/araclar/admin-paneli.md`).

Çalışma tarayıcıda (IndexedDB) otomatik saklanır; sayfa yenilense de kaybolmaz.

**Float burada yok.** Kir, aşınma ve Pristine parıltısı oyunda Unity shader'ı ile Float değerine göre uygulanır (`docs/tasarim/05-esya-float.md` 7.5).

## Çıktı

```
<set_id>-art.zip
├── <item id>.png      128×128: defter, tooltip
└── <item id>@32.png   32×32: çanta yuvası, yere düşen eşya
```

- Export, sağ panelde seçili boyuttan bağımsız olarak her onaylı eşya için iki dosya üretir (08.11.2026). İkisi de aynı ayarlarla (arka plan, silgi, kontur, palet) kaynaktan ayrı ayrı hazırlanır; 32'lik ikon 128'liğin küçültülmüşü değildir, konturu kendi boyutunda çizilir. Sebep: LPC dünyası 32 px piksel yoğunluğunda, büyük görseli yuvada küçültmek pikselleri karıştırır.
- Admin paneli ZIP'i olduğu gibi alır, iki boyutu eşleştirip birlikte yükler; ayrıca bir şey yapmak gerekmez.

- Dosya adı eşya id'sidir; admin paneli eşyayı adından bulur. Bilinmeyen id yeni taslak olur, eşyanın bütün ayarları (isim, Tier, set, göl, craft) panelde yapılır.
- Görsel kontrolü (boyut, şeffaf arka plan, palet, kadraj) panel yüklerken yapar.
- Hazırlama ayarları tarayıcıda (IndexedDB) kalır; ZIP'e `.studio.json` konmaz (karar 31.10.2026). Araç `.studio.json` okumaya devam eder.
- Unity görselleri sunucudan alır (`get_item_art`): Filter Mode **Point**, sıkıştırma yok.

## Palet

Ortak palet `content/palette.hex` (Lospec `.hex` biçimi, satır başına bir renk). Şu an **Resurrect 64** (Kerrie Lake, oyunda ticari kullanıma izin veriyor). Palet değişirse bu dosya değişir. Denemek için araca başka bir `.hex` bırakılabilir; o oturumda geçerli olur.

## Perchance ipuçları

- Tek nesne, ortalanmış, önden görünüm, **düz tek renk arka plan** (saf beyaz). Arka planı araç siler.
- Aynı nesnenin varyantlarında promptu aynı tut, yalnızca renk / malzeme kelimesini değiştir. Birkaç aday üretip araçta en iyisini onayla.
- Dosyayı eşya id'siyle kaydet (`glass_bottle_blue.png`).

## Kod yapısı

| Klasör | İçerik |
|---|---|
| `src/engine/` | Saf görsel işleme (Canvas'tan bağımsız, `PixelBuffer` üzerinde): `background`, `resize`, `quantize`, `pipeline`, `color` |
| `src/models/` | `set.json`, `.studio.json` ve proje durumu |
| `src/services/` | PNG okuma / yazma, ZIP, IndexedDB kaydı |
| `src/components/` | Arayüz parçaları |
| `test/` | Engine ve model birim testleri |

Kurallar: görsel işleme `engine/` altında saf fonksiyon ve testli olur; kaynak görsel hiç değişmez, her şey kaynaktan yeniden hesaplanır (önizleme ve export aynı fonksiyonu kullanır); yeni kütüphane eklemeden önce düşün (şu an yalnızca `fflate`).
