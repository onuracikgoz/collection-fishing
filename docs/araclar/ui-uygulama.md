# UI pencerelerini Unity'de uygulama (Mac oturumu için)

Taslaklar (PNG) `docs/gorsel/ui-taslaklar/`. Bunlar 2x gösterilen 1x çizimlerdir: 704x448 mantıksal ekran, 1408x896 görüntü. Kit parçaları `client/Assets/Art/UI/` (`ui-borders.json` 9-slice kenarlarını verir). Kural ve renk kararları: `docs/tasarim/15-gorsel-stil.md` UI kiti. Kit'i yeniden üretmek: `tools/ui-kit/make_ui_kit.py`.

Bulut oturumu Unity'yi derleyemediği için pencereler ilk başta Unity'de yazılmamıştı; Mac oturumunun yazdıkları aşağıda (Yazılanlar). Mevcut Faz 4 pencereleri eski IMGUI (`UI/Gui.cs`, `Economy/`); sırayla yeni kitle değiştirilecek.

## Önce Mac'te kontrol et

1. `Assets/Art/UI` içe aktarılıyor mu, `PixelArtImporter` 9-slice Border'larını dolduruyor mu (sürüm 2), `cursor_*` Cursor tipinde mi.
2. Eski `card_paper` silindi, yerine `card` geldi: kodda `card_paper` kullanan yer varsa değiştir.
3. Kapat butonu yeniden çizildi (ahşap plaka): `button_close_*`.
4. `Protocol.cs` bulutta derlenmedi: yeni `EmoteStatus*`, `Announce` sınıfları ve `status`, `emotesOwned` alanları denenmeli.
5. **Enerji (29.10.2026):** sunucu atış enerjisini artık her atışta değil, av sonucuyla ya da dakikada bir kaydediyor. `FishingController.RefreshBag` içindeki `Energy = Bag.energy;` satırı maçtayken kaldırılmalı (maçtaki değer `WELCOME` / `BOBBER` / `FISH_END`'den gelir); yoksa kaçan bir atıştan sonra çanta açılınca enerji 1 geri gelmiş görünür.

## Mac kontrolü sonucu (29.10.2026)

1. Kit içe aktarılıyor, 9-slice kenarları dokuya yazılıyor. Ama parçalar Multiple sprite modunda geliyordu, kesilen sprite'ın (`card_0`) kenarı 0'dı: `PixelArtImporter` (sürüm 3) UI parçalarını artık Single içe aktarıyor. Unity açılınca 172 doku yeniden içe aktarılır, UI `.meta` dosyaları değişir (commit'lenmeli).
2. Kodda `card_paper` kullanan yer yok.
3. `button_close_*` kit pencerelerinin kapat butonu.
4. `Protocol.cs` Unity'nin derleyicisiyle (editörün `.rsp` dosyasıyla) hatasız derleniyor.
5. `Energy = Bag.energy;` kaldırıldı (Onur).

## Yol: uGUI (karar 29.10.2026, Onur)

Oyun arayüzü **uGUI** ile yapılır (Canvas + Image + Button), IMGUI pencereleri sırayla kaldırılır. Pixel art kit'i için en uygun yol bu: 9-slice ve Tiled Image doğrudan çalışır.

- **Ölçek:** tek Canvas (`UI/UiRoot.cs`). Taslaklar 1408x896 ve kit'i **2x** çizer (704x448 mantıksal ekran): düzen birimi taslak pikselidir, bir kit pikseli iki birimdir (`referencePixelsPerUnit` 64, sprite'lar 32). Canvas, kit pikseli tam sayı ekran pikseli olacak şekilde ölçeklenir (1080p'de 2, Retina'da 4; Ayarlar > Arayüz boyutu ile değişir). İstisna: eşya yuvaları taslakta 1x (40x40, ince çerçeve), `pixelsPerUnitMultiplier` 2.
- **Her pencere kendi taslağından:** `Editor/UiPrefabBuilder.cs` her pencereyi taslaktan ölçülen koordinatlarla kurar (`DraftWindow`, `Abs`, `TextAt`) ve `Assets/Resources/UI/*.prefab` olarak kaydeder. Ortak liste şablonu (`PanelView`) artık sadece takas davet kutusunda. Kit'te olmayan bir parça gerekirse `tools/ui-kit/make_ui_kit.py`'ye eklenir (eklenenler: `outline`, `tag_level`, `panel_locked`); kit görselleri boyanmaz (renk tonu yok).
- **Kod sadece bağlar:** prefab'daki `UI/Views/*View.cs` bileşenleri referans tutar; veriyi ve tıklamaları denetleyiciler doldurur. Sunucu otoritedir, pencereler sadece niyet gönderir.
- **Kontrol:** `Editor/UiShots.cs` prefab'ları örnek veriyle çizer (CollectionGame > UI > Capture Shots). Taslak | Unity karşılaştırmaları: `docs/gorsel/ui-karsilastirma/`. Gerçek oyunda: Autopilot `-cgOpen bag,quests,market,board,settings`.
- **Yazı:** Unity'nin yerleşik fontu (LegacyRuntime). Türkçe harfli pixel font gelince builder'da tek yerden değişir. Taslaklardan en görünür fark bu.
- **İkonlar:** yok; HUD'da renkli kareler, yuvalarda eşya adının ilk harfleri.

### uGUI'ye geçenler (taslağa göre)

| Pencere | Taslak | Prefab / kod | Karşılaştırma |
|---|---|---|---|
| HUD | `hud3` | `Hud`, `World/WorldHud.cs` | `hud3.png` |
| Çanta + sağ tık menüsü | `canta-v2` | `Bag`, `Popup`, `UI/BagPanel.cs` | `canta-v2.png` |
| Ayarlar (Genel, Hesap) | `ayarlar-genel`, `ayarlar-hesap` | `Settings`, `UI/SettingsController.cs`, `UI/ClientSettings.cs` | `ayarlar-*.png` |
| Takas + "Kaç tane?" | `takas-a/b/c` | `Trade`, `Count`, `Social/TradeController.cs` | `takas.png` |
| Tezgah kur / Tezgahım, tezgah listesi, Pazar Panosu | `tezgah-kur`, `tezgah-tezgah`, `tezgah-pano` | `StallSetup`, `Stall`, `Board`, `Economy/MarketController.cs` | `pazar.png` |
| Günlük görev | `npc-gorev` | `Quests`, `Economy/QuestController.cs` | `npc-gorev.png` |
| Fısıltı pencereleri | taslak yok | `Whisper`, `Social/WhisperController.cs` | |

Taslaktan bilerek ayrılanlar: pet seçimi (pet sistemi yok), çanta genişletme satırı (sunucuda yok), görev başına ödül ve "Teslim et / Değiştir" (sunucuda günlük tek sandık var), tezgah kurda eşya sürükleme yerine tıkla-fiyat-Koy. Takas penceresine çantadan sürükle-bırak var.

### Hâlâ IMGUI (sırayla taşınacak)

Defter, Profil, Arkadaşlar, NPC pencereleri (sat, parçala, birleştir, craft, depo, dükkan), balık tutma (ipucu, şarj, çekme oyunu), bildirim kutuları (`UI/Toasts.cs`), dünyadaki isim etiketleri ve balonlar. Taslağı olup hiç yapılmayanlar: emote menüsü, oyuncu sağ tık menüsü, giriş akışı.

**Sunucudan eksik (client uydurmadı):** `get_catalog` pano fiyatını (`BOARD.priceDiamonds`), tezgaha bakma yarıçapını (`MARKET.interactRadius`) ve pazar noktasını vermiyor. Client "Reklam ver (elmas)" yazıyor, fiyat göstermiyor; harita etiketi 7 tile'dan yakında ilk kalemleri gösteriyor (sadece görüntü, karar sunucuda). Kataloğa eklenirse client oradan okur.

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
