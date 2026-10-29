# UI pencerelerini Unity'de uygulama (Mac oturumu için)

Taslaklar (PNG) `docs/gorsel/ui-taslaklar/`. Bunlar 2x gösterilen 1x çizimlerdir: 704x448 mantıksal ekran, 1408x896 görüntü. Kit parçaları `client/Assets/Art/UI/` (`ui-borders.json` 9-slice kenarlarını verir). Kural ve renk kararları: `docs/tasarim/15-gorsel-stil.md` UI kiti. Kit'i yeniden üretmek: `tools/ui-kit/make_ui_kit.py`.

Bulut oturumu Unity'yi derleyemediği için bu pencerelerin hiçbiri Unity'de yazılmadı. Mevcut Faz 4 pencereleri eski IMGUI (`UI/Gui.cs`, `Economy/`); sırayla yeni kitle değiştirilecek.

## Önce Mac'te kontrol et

1. `Assets/Art/UI` içe aktarılıyor mu, `PixelArtImporter` 9-slice Border'larını dolduruyor mu (sürüm 2), `cursor_*` Cursor tipinde mi.
2. Eski `card_paper` silindi, yerine `card` geldi: kodda `card_paper` kullanan yer varsa değiştir.
3. Kapat butonu yeniden çizildi (ahşap plaka): `button_close_*`.
4. `Protocol.cs` bulutta derlenmedi: yeni `EmoteStatus*`, `Announce` sınıfları ve `status`, `emotesOwned` alanları denenmeli.
5. **Enerji (29.10.2026):** sunucu atış enerjisini artık her atışta değil, av sonucuyla ya da dakikada bir kaydediyor. `FishingController.RefreshBag` içindeki `Energy = Bag.energy;` satırı maçtayken kaldırılmalı (maçtaki değer `WELCOME` / `BOBBER` / `FISH_END`'den gelir); yoksa kaçan bir atıştan sonra çanta açılınca enerji 1 geri gelmiş görünür.

## Pencereler

"Sunucu" sütunu: hazır = mesaj ve kural sunucuda var, **yok** = önce sunucu ve `protokol.md` gerekir.

| Pencere | Taslak | Sunucu | Not |
|---|---|---|---|
| Giriş akışı (başlık, web giriş, Steam, karakter, sunucu, yükleniyor) | `akis-*` | Cihaz girişi, sunucu listesi hazır. Taşıma kodu hazır (`transfer_code_create/redeem`, Steam yayıncı ayarı Faz 7'de). Google/Facebook/Discord girişi için sunucu işi **yok** (Nakama'nın kendi `authenticate*` çağrıları, Discord için özel doğrulama yazılacak) | Marka ikonları yer tutucu, resmi logo kullanılacak (`acik-sorular.md` 25) |
| HUD (alt bar, sol/sağ üst) | `hud3` | Hazır | Alt bar düz adaçayı, XP şeridi üstte |
| Çanta, Defter, Profil | `canta-v2`, `defter-v2`, `profil-v3` | `get_inventory`, `get_book`, `get_profile` hazır | Eşya kilidi hazır (`ITEM_LOCK`). "Sohbette göster" için sunucu **yok** |
| Arkadaşlar | `arkadaslar-*` | `friends_status` hazır; `lastSeen` **yok** | Çevrimiçi/çevrimdışı grupları, son görülme |
| Oyuncu menüsü, takas teklifi | `oyuncu-*` | Arkadaş ekle ve Yanına git hazır. Takas teklifi hazır (`TRADE_OFFER`). Fısıltı ve Raporla hazır (`whisper_send`, `report_player`), Engelle Nakama'nın `blockFriends`'i | Menü sağ tık listesi gibi, kart yok |
| Fısıltı pencereleri (Knight Online tarzı) | **yok**, çizilecek | Hazır (`protokol.md` Fısıltı; bildirim kodu 110, ayar `whisper_settings`) | Aşağıda, Fısıltı penceresi |
| Takas penceresi | `takas-a/b/c` | Hazır (`TRADE_*`, `protokol.md` Takas; level şartı yok) | 2 kilit + 3 sn geri sayım + Onayla; kilitli eşya konamaz |
| Ayarlar (Genel, Hesap) | `ayarlar-*` | Genel client; Hesap: kod üret hazır, link/unlink Nakama'nın kendi çağrıları, hesap silme hazır (`account_delete_*`, `protokol.md` Hesap silme RPC'leri) | Hesap sayfası bulanık açılır, uyarı onaylanınca görünür |
| Balık tutma anları | `balik-*` | Hazır | Sürpriz av, keşif bandı |
| NPC: sat, parçala, birleştir, craft, depo, günlük görev | `npc-*` | Satış/parçala/birleştir/craft/depo hazır (`get_catalog` ile fiyatlar). Günlük görev hazır (`QUEST_*`, `protokol.md` Günlük görev; sandık anında açılır, Float'lı eşya çıkmaz) | Craft sadece Zanaatkar'da |
| Pazar: tezgah alanı, kurma, pano | `tezgah-*` | Tezgah: `STALL_*` hazır (`protokol.md` Pazar). Reklam panosu hazır (`BOARD_*`, `protokol.md` Pazar Panosu; elmas bakiyesi `get_inventory.diamond`); alım ilanı yok; pet seçimi / görünümü client konusu | Genel arama ve fiyat sıralaması yok. Pet 7 tile'dan yakınsa başlık + ilk 4 kalem, tıklayınca tam liste |
| Emote menüsü, dünya görünümü | `emote-*` | `EMOTE_STATUS`, `EMOTE_STATUS_SHOW` hazır. Sahiplik veren sistem (elmas, destekçi, defter) **yok** | Şimdilik sadece 8 ücretsiz emote takılır |
| Bildirimler (yığın, seviye atlama, duyuru, bağlantı) | `bildirim-*` | `ANNOUNCE` hazır. Seviye atlama (XP) **yok**. Çanta/enerji/olta bildirimleri client durumundan çıkar | Yığın en fazla 4 kutu |

## Fısıltı penceresi

Karar 29.10.2026 (Onur): Knight Online'daki gibi **küçük, aç / kapa** pencere. Taslağı henüz yok; kit parçalarıyla (`card`, `button_close_*`) kurulabilir.

- Her konuşma ayrı küçük bir pencere (öneri: 160x110 mantıksal px, başlıkta karşı tarafın adı). Birkaç pencere aynı anda açık kalabilir, sürüklenir.
- Başlıkta **küçült** ve **kapat**. Küçülünce sadece başlık şeridi kalır (ekranın alt kenarında yan yana dizilir); kapatmak konuşmayı siler, yeni mesaj gelince pencere yeniden açılır.
- Yeni mesaj gelince küçültülmüş ya da arkada kalan pencerenin başlığı **yanıp söner**, tıklayınca durur.
- Açılış: sohbet satırına `/w Nick mesaj` (`whisper_send` `username` ile), oyuncu menüsünde "Fısılda", tezgah penceresinde "Whisper at" (`context: "stall"`).
- Gelen mesaj: socket bildirimi, `code == NotifyCode.Whisper` (110), içerik `WhisperNotice`. Kendi mesajın için cevaptaki `text`'i yaz (maskelenmiş hali); `masked` ise küçük gri "kişisel bilgi gizlendi" satırı.
- Hata cevabında pencereye tek satır sistem notu: `OFFLINE` "Oyuncu çevrimiçi değil", `NOT_ALLOWED` "Bu oyuncuya şu an yazamazsın", `LEVEL_TOO_LOW` "Yabancılara yazmak için level 10 gerekir", `MUTED` "Susturuldun", `YOU_BLOCKED` "Bu oyuncuyu engelledin", `RATE_LIMITED` "Çok hızlı yazıyorsun".
- Pencere başlığında küçük menü: **Engelle** (`blockFriends`), **Raporla** (`report_player`, son mesaj `text`'e konur).
- Ayarlar > Genel: **PM kapalı** düğmesi (`whisper_settings`). Açıkken sadece arkadaşlar yazabilir.
- Chat açıkken klavye girdisi balık tutmayla çakışmaz (10-sosyal.md 13.1); fısıltı penceresindeki yazı alanı da aynı kuralla çalışır.

## Önerilen sıra

1. Kit içe aktarma kontrolü ve ortak bileşenler (pencere iskeleti, buton, yuva, ipucu): bunlar IMGUI'nin yerine geçecek tek yer olsun.
2. Sunucusu hazır olanlar: HUD, çanta, defter, profil, arkadaşlar, NPC pencereleri, emote menüsü, bildirimler.
3. Sonra sunucu gerektirenler (giriş akışı ek yolları, pazar, ayarlar > hesap): önce sunucu + `protokol.md`.

## İkonlar

Hepsi yer tutucu. Gerçekleri Perchance'ten gelecek: `docs/araclar/ui-ikon-promptlari.md`. Dosya adları ve konum (`client/Assets/Art/UI/Icons/`) orada.
