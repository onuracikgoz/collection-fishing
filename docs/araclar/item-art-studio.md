# Item Art Studio

AI ile üretilen eşya görsellerini oyunun pixel-art stiline çeken ve renk / malzeme varyantları üreten yerel web aracı. Kod: `tools/item-art-studio/` (React + TypeScript + Vite, backend yok).

```bash
cd tools/item-art-studio
npm install
npm run dev     # http://localhost:5173
npm test        # görsel işleme birim testleri (vitest)
npm run build   # tip kontrolü + üretim build'i
```

## Akış

```
Perchance PNG'leri (+ set.json) → 1 · Prepare → 2 · Variants → Export ZIP → content/sets/<set_id>/
```

1. **Dosyaları bırak.** Pencereye istediğin kadar PNG sürükle (veya *Add files*). Aynı anda `set.json`, `.studio.json` ve `.hex` palet dosyası da bırakılabilir; araç türünü dosyadan anlar.
   - PNG dosya adı `base_id` olur (`Crystal Shard.png` → `crystal_shard`). Set yüklüyse eşleşmeyen görseller uyarı olarak gösterilir; adı üst taraftan düzeltilebilir.
   - Set yüklüyse, `base_id`'si eşleşen her eşya bir **set varyantı** olarak hazır gelir; hedef rengi `variant_color`'dır.
2. **Prepare.** Solda orijinal, sağda oyun ikonu. Sırayla:
   - **Arka plan:** kenara değen düz arka plan (Perchance'in beyazı) silinir, kenardaki hale temizlenir. Nesnenin içindeki aynı renkli alanlara dokunulmaz. Kalan alanlar için **sihirli silgi** (E): tıklanan renge benzeyen bitişik alan silinir. Geri al / temizle var.
   - **Boyut:** nesne kırpılır, ortalanır, 128×128'e (kenar boşluğu ayarlanabilir) küçültülür. Küçültme her bloğun baskın rengini alır; bulanıklaşma ve ara renk olmaz. Küçük görsel büyütülmez.
   - **Palet:** her piksel ortak paletteki en yakın renge (OKLab) çekilir. Dithering yok.
   - *Use these settings for all* bu ayarları bütün görsellere uygular.
3. **Variants.** Üstte seçili varyant büyük ve oyundaki boyutlarında (32 / 48 / 96 px), altta bütün varyantlar ızgarada.
   - **🎲 Random:** seçilen sayıda öneri üretir. Renkler paletten, var olan varyantların tonlarından uzak seçilir; bir kısmı malzeme ve desen alır.
   - Klavye: **A** onayla, **X** reddet (ve sıradakine geç), **← / →** gez. *Delete rejected* reddedilen önerileri siler (set varyantları silinmez).
   - Sağ panel seçili varyantı düzenler (aşağıda).
4. **Export ZIP.** Bütün görsellerdeki onaylı varyantlar tek ZIP'te iner.

Çalışma tarayıcıda (IndexedDB) otomatik saklanır; sayfa yenilense de kaybolmaz. Kalıcı kayıt ZIP içindeki `.studio.json` dosyalarıdır.

## Varyant düzenleme

| Bölüm | Ne yapar |
|---|---|
| Color | **Gölgeyi koruyarak boyar**: eşyanın en yaygın rengi seçilen renge oturur, açık / koyu tonlar aynı farkla kalır. Koyu dış kontur korunabilir. Set varyantında "Set target" hedef rengi gösterir. |
| Material | Original, Matte (soluk, düşük kontrast), Glossy (sol üst ışık + parlama), Metal (yüksek kontrast, az renk), Gold, Silver, Dark. Hepsi piksel bazlı ve palete çekilir, pixel-art bozulmaz. |
| Pattern & outline | Çizgili / dama / nokta deseni (gölgeli), kontur rengi. |
| Fine-tune colors | Bir renk grubuna (veya görsele) tıkla: o grubu düz renkle değiştir ya da boyamayı yalnızca o gruba sınırla. *Grouping* hassasiyeti değiştirince bu ince ayarlar temizlenir. |
| Light | Parlaklık ve doygunluk. |

Işık sol üstten gelir. Palet açıkken bütün renk seçimleri paletten yapılır ve sonuç her zaman paletin içinde kalır.

**Float burada yok.** Kir, aşınma ve Pristine parıltısı oyunda Unity shader'ı ile Float değerine göre uygulanır (`docs/tasarim/05-esya-float.md` 7.5). Bu aracın malzemeleri eşyanın kalıcı görünümüdür, kondisyonu değil.

## Çıktı

```
<set_id>-art.zip
├── png/<id>.png                 onaylı varyantlar; set eşyasında set.json'daki `image` adı
├── studio/<base_id>.studio.json  hazırlama ayarları + bütün varyantlar
└── variants.json                 onaylı varyantların listesi (id, base_id, image, in_set, tint, material, pattern)
```

- PNG'ler `content/sets/<set_id>/png/` altına kopyalanır.
- Araç `set.json`'ı **değiştirmez**. Sette olmayan bir öneriyi beğendiysen `variants.json`'daki satırla birlikte set dosyasına elle (veya collection-set-generator ile) eklenir.
- `.studio.json` aynı kaynak PNG ile tekrar yüklenince bütün varyantlar aynen üretilir. Biçim: `format: "item-art-studio/1"`, `base_id`, `source_image`, `prepare`, `tolerance`, `variants[]`.
- Unity'de içe aktarırken: Filter Mode **Point**, Compression **None**, Pixels Per Unit ikonun gösterildiği boyuta göre.

## Palet

Ortak palet `content/palette.hex` (Lospec `.hex` biçimi, satır başına bir renk). Şu an **Resurrect 64** (Kerrie Lake, oyunda ticari kullanıma izin veriyor). Palet değişirse bu dosya değişir, araç yeniden başlatılınca yeni paleti kullanır. Denemek için araca başka bir `.hex` dosyası bırakılabilir; o oturumda geçerli olur.

## Perchance ipuçları

- Tek nesne, ortalanmış, önden görünüm, **düz tek renk arka plan** (saf beyaz). Arka planı araç siler.
- Az sayıda, birbirinden net ayrılan renk: gövde, ışık, gölge, koyu kontur. Renk varyantlarını AI'a ayrı ayrı ürettirme; burada üret.
- Dosyayı `base_id` adıyla kaydet (`crystal_shard.png`).

## Kod yapısı

| Klasör | İçerik |
|---|---|
| `src/engine/` | Saf görsel işleme (Canvas'tan bağımsız, `PixelBuffer` üzerinde): `background`, `resize`, `quantize`, `recolor`, `effects`, `variant`, `pipeline`, `color` |
| `src/models/` | `set.json`, `.studio.json` ve proje durumu |
| `src/services/` | PNG okuma / yazma, ZIP, IndexedDB kaydı |
| `src/components/` | Arayüz parçaları |
| `test/` | Engine ve model birim testleri |

Kurallar: görsel işleme `engine/` altında saf fonksiyon ve testli olur; kaynak görsel hiç değişmez, her şey kaynaktan yeniden hesaplanır (önizleme ve export aynı fonksiyonu kullanır); yeni kütüphane eklemeden önce düşün (şu an yalnızca `fflate`).
