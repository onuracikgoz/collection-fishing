# Perchance prompt listesi (29.10.2026, güncel)

Eski liste `ui-asset-promptlari.md` bölüm 4'tür; bu dosya onun yerine geçer. Değişenler: emote'lar durum emote'una döndü, elmas/kilit/tezgah ikonları eklendi, dükkan ve kapat ikonları çıktı, boyutlar netleşti.

## İş akışı

1. Perchance'ta prompt + ortak sonek + negatif prompt ile 3-4 aday üret (en iyi sonuç için kare, büyük çıktı).
2. Item Art Studio > Hazırla: boyut düğmesi **Icon 16** (HUD, menü, emote) veya **Inline 8** (satır içi). Arka plan silinir, palete çekilir.
3. Dosya adı `icon_<ad>.png` veya `emote_<ad>.png`. Konum: `client/Assets/Art/UI/Icons/`.
4. 16 px'e inince detay kaybolur: bir ikon bulanık çıkarsa promptu sadeleştir, rengi azalt, tekrar dene. Beğenmediğin ikonlar için `tools/ui-kit` taslakları referanstır.

## Ortak sonek (her prompta ekle)

```
pixel art icon, 16-bit, very simple bold shape, thick dark outline, 3 to 4 colors, readable at 16x16, cozy game UI, flat lighting from top-left, centered, single object, front view, plain pure white background
```

## Negatif prompt

```
blurry, gradient, shadow on background, text, letters, numbers, watermark, 3d render, photo, realistic, noisy, dithering, multiple objects, cropped, perspective, tiny details
```

## 1. HUD ve menü ikonları (16x16, 24 adet)

| id | Prompt |
|---|---|
| `icon_energy` | yellow lightning bolt, orange shadow |
| `icon_coin` | gold coin with a small fish on it |
| `icon_dust` | small glass vial of sparkling blue dust |
| `icon_gem` | blue diamond gem, white highlight, faceted |
| `icon_score` | golden trophy cup |
| `icon_rod` | wooden fishing rod, diagonal, red and white bobber |
| `icon_rod_broken` | wooden fishing rod snapped in half, diagonal |
| `icon_bait_basic` | small tin can with a pink worm |
| `icon_bait_shiny` | golden fishing lure with a sparkle |
| `icon_bait_crystal` | cyan crystal fishing lure |
| `icon_bag` | brown leather backpack with a buckle |
| `icon_book` | closed red leather book with a brass fish emblem |
| `icon_profile` | simple person silhouette on a wooden badge |
| `icon_friends` | two simple person silhouettes side by side |
| `icon_players` | three tiny person silhouettes |
| `icon_stall` | small market stall with red and white striped awning |
| `icon_craft` | small hammer on an anvil |
| `icon_stash` | wooden treasure chest with iron bands, closed |
| `icon_settings` | wooden gear cog |
| `icon_chat` | white speech bubble |
| `icon_new_discovery` | yellow star burst with a sparkle |
| `icon_teleport` | blue swirl portal |
| `icon_lock` | small golden padlock (eşya kilidi ve kilitli emote) |
| `icon_disconnect` | unplugged cable, red plug (bağlantı koptu bildirimi) |

Çıkarıldı: `icon_shop` (dükkan butonu yok, yerine `icon_stall`), `icon_close` (kit çiziyor).

## 2. Durum emote'ları (16x16, 15 adet)

Karakterin üstünde balon içinde kalıcı durur; menüde yuvada görünür. Hepsi **masum ve genel kitleye uygun** olmalı (öpücük, göz kırpma, romantik içerik yok; düz kalp serbest).

**Herkese açık (8)**

| id | Prompt |
|---|---|
| `emote_smile` | round yellow smiling face |
| `emote_laugh` | round yellow laughing face with tears of joy |
| `emote_zzz` | blue letter Z sleeping marks, three sizes, floating |
| `emote_fish` | small blue fish, proud sparkle |
| `emote_ask` | white question mark |
| `emote_heart` | plain red heart, white highlight |
| `emote_note` | purple musical note |
| `emote_coffee` | white cup of coffee with steam |

**Destekçi (4, altın çerçeve + taç)**

| id | Prompt |
|---|---|
| `emote_star` | yellow shining star with sparkle |
| `emote_cool` | yellow face wearing dark sunglasses |
| `emote_crown` | golden crown with red and blue gems |
| `emote_sparkle` | three yellow sparkles |

**Elmasla alınır (3, mavi çerçeve, 50 elmas)**

| id | Prompt |
|---|---|
| `emote_fire` | red and orange flame |
| `emote_rain` | grey rain cloud with blue raindrops |
| `emote_comet` | yellow shooting star with a trail |

**Defter ödülü (1, kilitli görünür)**

| id | Prompt |
|---|---|
| `emote_goldfish` | golden fish with a ribbon |

**Hareketler (menü ikonu, 4)**: animasyon karakterin kendisinde (LPC); ikon sadece menüde.

| id | Prompt |
|---|---|
| `emote_wave` | cartoon waving hand |
| `emote_clap` | two cartoon hands clapping, tiny motion lines |
| `emote_dance` | small dancing person, arms out |
| `emote_cheer` | cartoon raised fist with sparkles |

## 3. Logo amblemi (yazısız, büyük, 16 px'e küçültülmez)

```
game logo emblem, a cheerful fish jumping out of a ring of water around a golden fishing hook, framed by a wooden circular badge with rope border, pixel art, 16-bit, bold outline, vibrant, centered, plain pure white background
```

Yazı sonradan pixel fontla eklenir.

## 4. Defter ve kartlar (büyük)

| id | Prompt |
|---|---|
| `book_spread` | open collection book seen from above, two blank parchment pages, leather cover edges, brass corner caps, ribbon bookmark, empty pages, pixel art, plain white background |
| `card_discovery_frame` | ornate golden card frame with sparkles and a ribbon banner at the top, empty center, pixel art, plain white background |

## 5. Senin dışında gelecekler

- **Google / Facebook / Discord logoları:** pixel art yapılmaz, resmi logo kare butonun içinde küçültülerek kullanılır (`acik-sorular.md` 25).
- **Pixel font:** Türkçe harfli (ç ğ ı İ ö ş ü), ticari izinli. Adaylar Pixel Operator, m5x7; indirince Türkçe karakterleri kontrol et.
- **Evcil hayvanlar (pazar tezgahı), karakter ve balık sprite'ları:** UI değil, sprite işi; sonra ayrı liste.
- **Eşya (balık, malzeme) görselleri:** `collection-set-generator` skill'i set başına prompt üretir.
