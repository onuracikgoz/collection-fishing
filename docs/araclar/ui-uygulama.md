# UI pencerelerini Unity'de uygulama (Mac oturumu için)

Taslaklar (PNG) `docs/gorsel/ui-taslaklar/`. Bunlar 2x gösterilen 1x çizimlerdir: 704x448 mantıksal ekran, 1408x896 görüntü. Kit parçaları `client/Assets/Art/UI/` (`ui-borders.json` 9-slice kenarlarını verir). Kural ve renk kararları: `docs/tasarim/15-gorsel-stil.md` UI kiti. Kit'i yeniden üretmek: `tools/ui-kit/make_ui_kit.py`.

Bulut oturumu Unity'yi derleyemediği için bu pencerelerin hiçbiri Unity'de yazılmadı. Mevcut Faz 4 pencereleri eski IMGUI (`UI/Gui.cs`, `Economy/`); sırayla yeni kitle değiştirilecek.

## Önce Mac'te kontrol et

1. `Assets/Art/UI` içe aktarılıyor mu, `PixelArtImporter` 9-slice Border'larını dolduruyor mu (sürüm 2), `cursor_*` Cursor tipinde mi.
2. Eski `card_paper` silindi, yerine `card` geldi: kodda `card_paper` kullanan yer varsa değiştir.
3. Kapat butonu yeniden çizildi (ahşap plaka): `button_close_*`.
4. `Protocol.cs` bulutta derlenmedi: yeni `EmoteStatus*`, `Announce` sınıfları ve `status`, `emotesOwned` alanları denenmeli.

## Pencereler

"Sunucu" sütunu: hazır = mesaj ve kural sunucuda var, **yok** = önce sunucu ve `protokol.md` gerekir.

| Pencere | Taslak | Sunucu | Not |
|---|---|---|---|
| Giriş akışı (başlık, web giriş, Steam, karakter, sunucu, yükleniyor) | `akis-*` | Cihaz girişi, sunucu listesi hazır. Taşıma kodu hazır (`transfer_code_create/redeem`, Steam yayıncı ayarı Faz 7'de). Google/Facebook/Discord girişi için sunucu işi **yok** (Nakama'nın kendi `authenticate*` çağrıları, Discord için özel doğrulama yazılacak) | Marka ikonları yer tutucu, resmi logo kullanılacak (`acik-sorular.md` 21) |
| HUD (alt bar, sol/sağ üst) | `hud3` | Hazır | Alt bar düz adaçayı, XP şeridi üstte |
| Çanta, Defter, Profil | `canta-v2`, `defter-v2`, `profil-v3` | `get_inventory`, `get_book`, `get_profile` hazır | Eşya kilidi hazır (`ITEM_LOCK`). "Sohbette göster" için sunucu **yok** |
| Arkadaşlar | `arkadaslar-*` | `friends_status` hazır; `lastSeen` **yok** | Çevrimiçi/çevrimdışı grupları, son görülme |
| Oyuncu menüsü, takas teklifi | `oyuncu-*` | Arkadaş ekle ve Yanına git hazır. Takas teklifi hazır (`TRADE_OFFER`), fısıltı **yok** | Menü sağ tık listesi gibi, kart yok |
| Takas penceresi | `takas-a/b/c` | Hazır (`TRADE_*`, `protokol.md` Takas; level şartı yok) | 2 kilit + 3 sn geri sayım + Onayla; kilitli eşya konamaz |
| Ayarlar (Genel, Hesap) | `ayarlar-*` | Genel client; Hesap: kod üret hazır, link/unlink Nakama'nın kendi çağrıları, hesap silme **yok** | Hesap sayfası bulanık açılır, uyarı onaylanınca görünür |
| Balık tutma anları | `balik-*` | Hazır | Sürpriz av, keşif bandı |
| NPC: sat, parçala, birleştir, craft, depo, günlük görev | `npc-*` | Satış/parçala/birleştir/craft/depo hazır (`get_catalog` ile fiyatlar). Günlük görev **yok** (Faz 6) | Craft sadece Zanaatkar'da |
| Pazar: tezgah alanı, kurma, pano | `tezgah-*` | Tezgah: `STALL_*` hazır (`protokol.md` Pazar). Reklam panosu (elmas) ve alım ilanı **yok**; pet seçimi / görünümü client konusu | Genel arama ve fiyat sıralaması yok. Pet 7 tile'dan yakınsa başlık + ilk 4 kalem, tıklayınca tam liste |
| Emote menüsü, dünya görünümü | `emote-*` | `EMOTE_STATUS`, `EMOTE_STATUS_SHOW` hazır. Sahiplik veren sistem (elmas, destekçi, defter) **yok** | Şimdilik sadece 8 ücretsiz emote takılır |
| Bildirimler (yığın, seviye atlama, duyuru, bağlantı) | `bildirim-*` | `ANNOUNCE` hazır. Seviye atlama (XP) **yok**. Çanta/enerji/olta bildirimleri client durumundan çıkar | Yığın en fazla 4 kutu |

## Önerilen sıra

1. Kit içe aktarma kontrolü ve ortak bileşenler (pencere iskeleti, buton, yuva, ipucu): bunlar IMGUI'nin yerine geçecek tek yer olsun.
2. Sunucusu hazır olanlar: HUD, çanta, defter, profil, arkadaşlar, NPC pencereleri, emote menüsü, bildirimler.
3. Sonra sunucu gerektirenler (giriş akışı ek yolları, pazar, ayarlar > hesap): önce sunucu + `protokol.md`.

## İkonlar

Hepsi yer tutucu. Gerçekleri Perchance'ten gelecek: `docs/araclar/ui-ikon-promptlari.md`. Dosya adları ve konum (`client/Assets/Art/UI/Icons/`) orada.
