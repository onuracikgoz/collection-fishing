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
- **Kontrol:** `Editor/UiShots.cs` prefab'ları örnek veriyle çizer (CollectionGame > UI > Capture Shots; batchmode'da `-shotScale 2` Retina ölçeğinde çizer). Taslak | Unity karşılaştırmaları: `docs/gorsel/ui-karsilastirma/`. Gerçek oyunda: Autopilot `-cgOpen bag,quests,market,board,settings`.
- **Yazı:** tek font yeri `client/Assets/Resources/Fonts/` (aşağıda, Yazı tipi). Boşsa Unity'nin yerleşik fontu (LegacyRuntime). Taslaklardan en görünür fark bu.
- **İkonlar:** gerçekleri yok. Yuvalarda eşya adı **yazmaz** (31.10.2026, Onur): `UI/ItemIcons.cs` her eşya türüne 16x16 geçici bir çizim verir (balık, yengeç, bot, kutu, kabuk, taş, kristal, gözlük, şişe, para, yosun, pul, solucan, tarif, yıldız, sandık, yüz, çöp kovası); renk eşya kimliğinden seçilir, aynı eşya hep aynı görünür. Görev satırları, sandık ve emote yuvaları da aynı çizimleri kullanır (`SlotView.SetIcon`), adlar üstüne gelince çıkan kartta. HUD'da renkli kareler.

### uGUI'ye geçenler (taslağa göre)

Karşılaştırmalar `docs/gorsel/ui-karsilastirma/` (solda / üstte taslak, sağda / altta Unity).

| Pencere | Taslak | Prefab / kod | Açılış |
|---|---|---|---|
| Giriş akışı: başlık, Oyuna gir, karakter adı, sunucu seç, yükleniyor | `_akis-1,2,5,6,7` | `Login`, `Game.cs` | Oyun açılınca |
| HUD (sağ üstte Coin, elmas, toz ve mini harita; Collection Score profilde ve defterde; XP yazısı en sağda) | `hud3` | `Hud`, `World/WorldHud.cs`, `World/MiniMap.cs` | Hep |
| Çanta + sağ tık menüsü | `canta-v2` | `Bag`, `Popup`, `UI/BagPanel.cs` | B |
| Defter | `defter-v2` | `Book`, `Collection/CollectionController.cs` | K |
| Profil kartı | `profil-v3` | `Profile` | P, isim menüsünden |
| Oyuncu menüsü (isme tıkla) | `oyuncu-kart` | `Popup`, `World/WorldController.cs` | Bir oyuncunun adına tıkla |
| Arkadaşlar | `arkadaslar-list`, `-requests` | `Friends`, `Social/SocialController.cs` | O |
| Emote menüsü + dünyada durum işaretleri | `emote-menu`, `emote-dunya` | `Emote` | T, HUD |
| Takas + "Kaç tane?" + teklif kutusu | `takas-a/b/c`, `oyuncu-teklif` | `Trade`, `Count`, `TradeInvite` | Oyuncu menüsü |
| Fısıltı pencereleri | taslak yok | `Whisper` | `/w ad mesaj` |
| Balıkçı Tüccar: Sat, Parçala, Dükkan | `npc-sat`, `npc-parcala` | `Merchant`, `Economy/EconomyController.cs` | Tüccar NPC'si: yanında E ya da tıkla |
| Görevler | `npc-gorev` (sekmesiz) | `Quests`, `Economy/QuestController.cs` | Görevci NPC'si |
| Zanaatkar: Craft, Birleştir | `npc-craft`, `npc-birlestir` | `Crafter` | Zanaatkar NPC'si |
| Banka | `npc-depo` | `Bank` | Bankacı NPC'si (banka noktasında) |
| Tezgah kur / Tezgahım, tezgah listesi, Pazar Panosu | `tezgah-kur`, `-tezgah`, `-pano` | `StallSetup`, `Stall`, `Board`, `Economy/MarketController.cs` | M, haritada tezgah etiketi |
| Ayarlar | `ayarlar-genel`, `ayarlar-hesap` | `Settings`, `UI/SettingsController.cs` | HUD Ayar |
| Balık tutma anları | `balik-at`, `-vurus`, `-cekme` | `Fishing`, `World/FishingHud.cs` | Balık tutarken |
| Yeni keşif / Daha temiz kopya | `balik-kesif`, `balik-temiz` | `Catch` | Avdan sonra |
| Bildirim yığını, nadir av satırı, seviye atlama | `bildirim-yigin`, `bildirim-ust` | `Notices`, `UI/Toasts.cs` | Olaylar |

Taslaktan bilerek ayrılanlar (sunucuda karşılığı yok, uydurulmadı): pet seçimi; çanta genişletme satırı; görev başına ödül ve "Teslim et / Değiştir" (sunucuda günlük tek sandık var); karakter görünümü seçimi (`_akis-5`, sadece ad); Google / Facebook / Discord girişi (butonlar kapalı) ve Steam ekranları (`_akis-3`, `_akis-4`); profilde unvan, konum (portre 31.10.2026'dan beri karakterin dünyadaki görünümü: `CharacterPortrait`, baş ve omuzlar; isim ve level rozeti yan yana akar, üst üste binmez); arkadaş satırında Lv ve son görülme; recipe'de "Float seç". Dükkan (olta tamiri, yem) taslaksız, Tüccar'a sekme oldu. Taslaklardaki ◆ NPC pencerelerinde toz; HUD'da elmas gösteriliyor (pano reklamı için), karar Onur'da.

**Defterde sayfa çevirme** (01.11.2026, Onur): alttaki sayfa adı satırı kalktı (oklarla üst üste biniyordu). En solda ve en sağda kare ok butonları var. Sürükleyerek kitap gibi çevirme şimdilik istenmedi.

### Hâlâ IMGUI

Dünyadaki isim etiketleri, durum emote işaretleri ve haritadaki tezgah etiketleri (uGUI penceresinin altında kalınca çizilmez). Kit görünümlü `UI/Kit.cs` sadece bunlar için kaldı. Sohbet balonları 31.10.2026'dan beri uGUI (aşağıda, Sohbet balonları).

## Ortak yazı: GameText (31.10.2026, Onur)

Oyundaki her uGUI yazısı tek bileşendir: `UI/GameText.cs` (builder'da `Txt(...)`, başka yazı yapılmaz). Bir yazı sadece **boyutunu** (`Size`) ve rengini seçer; font, netlik ve gölge tek yerden gelir:

- **Font:** `Resources/Fonts/` (`GameFont`), çalışırken de her yazıya yeniden konur. Fontun içe aktarması pixel fontta kenar yumuşatmasız (`Editor/FontImport.cs`, Hinted Raster).
- **Ayar:** `Resources/UiStyle.asset` (`CollectionGame > UI > Style asset (UiStyle)`): `pixelGrid` (Press Start 2P için 8), kalın / italik izni, gölge rengi ve kayması, açık renkli yazıya otomatik gölge.
- **Netlik ve ölçek:** boyut fontun piksel ızgarasına yuvarlanır, basamaklar geniş (31.10.2026, Onur: rakamlar ve başlıklar çok büyüktü): 18'in altı → 8 (gövde yazısı, rakamlar, bölüm başlıkları), 18-29 → 16 (pencere başlığı, büyük değerler), 30-41 → 24. Çok satırlı yazıda satır aralığı 1.5. Pencere küçükken (1408x896 ekran pikselinin altında, ör. editördeki küçük Game paneli) tuval yarı ölçeğe iner; o zaman yazı fontun kendi piksel boyunun altına düşmesin diye bir basamak büyür (yazı en az 8 ekran pikseli). Tuval her ekranda tam sayı ölçekli olduğu için (1080p 1, Retina 2) fontun pikselleri bölünmez ve düzen her ekranda aynıdır. Unity pixel fontta kalını ve italiği yazıyı yayarak taklit ettiği için kapalı; `<b>`, `<i>` etiketleri de atılır.
- **Gölge:** açık renkli yazı (koyu kutuların üstündekiler) bir font pikseli sağ-aşağı gölge alır, aynı mesh'te (ayrı `Shadow` bileşeni yok). Koyu yazıya gölge `ForceShadow` ile (harita üstündeki ipuçları).

Kodda boyut değiştirmek: `text.SetSize(n)`.

**Dil (01.11.2026):** builder'da sabit yazı `L("anahtar")` ile yazılır, düz Türkçe metin yazılmaz; kodda `Loc.T("anahtar")`. Ayrıntı: `docs/araclar/dil-destegi.md`. IMGUI stilleri (`Gui`, `Kit`) de kalın yerine `GameFont.Bold` kullanır.

## Köşeler, pencere zemini, yuvalar (31.10.2026, Onur)

Kit parçaları `tools/ui-kit/make_ui_kit.py` ile üretilir; tek ayar `CORNER` (kit pikseli, şimdi 2) bütün kutuların köşe yuvarlaklığıdır, kenar çizgisi kesikten sonra kapalı kalır. Pencere içi düz, beyaza yakın sıcak krem (`faf7ef`, 31.10.2026 akşam: ten rengine kaçmasın). Pencerenin bölümleri (çanta ızgarası, sepet, tarif listesi, girdiler ve butonu, takas tarafları, ayarlar sağ sütunu, vitrin, emote grupları) zeytin yeşili kutuda durur: kit `card` (`b2ba90`, kenar `92a984`), builder'da `Panel(...)`; açık yuvalar ve alanlar onun üstünde. Eşya yuvalarının dört kenarı eşit (2 px kenar + 1 px iç halka). `tab_off` dört kenarı kapalı (Ayarlar'da alt alta duran sekmelerin alt çizgisi). Kiti değiştirdikten sonra: `python3 tools/ui-kit/make_ui_kit.py`, Unity'de prefabları yeniden üret.

## Sekmeler: tek bileşen

Oyundaki her sekme (Ayarlar, Arkadaşlar, Tüccar, Zanaatkar) aynı bileşendir: `UI/Views/TabButton.cs`, builder'da `Tab(...)`. Seçili sekme kit `button_wood_normal` + açık yazı, seçili olmayan kit `tab_off` (mürekkep çerçeve, koyu keten, mürekkep yazı). Görünüşü değiştirmek için `tools/ui-kit/make_ui_kit.py`'de `tab_off`'u ya da `UiPrefabBuilder.Tab`'ı değiştir, prefabları yeniden üret: bütün pencereler birlikte değişir.

## NPC'ler

Tüccar, Zanaatkar, Görevler ve Banka pencereleri HUD'dan ya da kısayoldan açılmaz (E, C, G kısayolları ve HUD Görev butonu kalktı). NPC'nin yanına git, **E**'ye bas ya da NPC'ye / adına **tıkla** (uzaktaysan karakter yürür, varınca açılır). Uzaklaşınca pencere kapanır. Kod: `World/NpcController.cs`.

- Konumlar ve konuşma mesafesi veri: `client/Assets/Resources/Npcs.json` (sunucu tile koordinatı). Zanaatkar meydanın doğusunda göl yolunda, Bankacı banka noktasının yanında (`16-ilk-harita.md`); Görevci ve Tüccar **yer tutucu**, harita editörü yerleştirene kadar (`acik-sorular.md` 27).
- Görevci, sandık hazırken adının önünde "!" taşır.
- Sunucu bu pencerelerin işlemlerinde mesafeye bakmaz (Banka hariç): `acik-sorular.md` 27.

## Eşya kartı ve tıklama menüsü (31.10.2026, Onur)

Tooltip ve tıklama menüsü tek tasarım (`PopupView`, `Popup` prefabı): koyu kart, 12/10 boşluk; üstte ad (16), altında Tier rengiyle Tier, ince çizgi, sonra etiket / değer satırları (Kondisyon, Float, Adet, Fiyat, Toz, Kilit) ya da menü satırları, en altta soluk not. Eşya kartı her pencerede aynı yerden: `ItemText.Card(...)`.

Menü dışarı bir tıklamayla ya da Esc ile kapanır. (Hata, 31.10.2026: menü başka yere tıklayınca görünmez halde açık kalıyordu; açık menü tooltip'i engellediği için bir kere sağ tıklanan eşyanın üstüne gelince kart çıkmıyordu.)

Çanta menüsünde NPC yanında yapılan işlemler yok (Sat / Parçala satırı kalktı); onlar Tüccar penceresinde.

## Çanta ve depo: sürükle-bırak, çöp kovası (31.10.2026, Onur)

- Bir yuvayı başka bir yuvaya sürükle: yer değiştirir. Çanta, depo ve bankadaki çanta. Sıra sunucu verisi değil, bu cihazda hesap başına saklanır (`UI/SlotOrder.cs`); yeni gelen eşya ilk boş yuvaya oturur. Bankada depodan çantaya (ya da tersi) sürüklemek tıklamayla aynı: al / koy.
- Çantanın sol altında **çöp kovası**: eşyayı üstüne sürükle (ya da menüden "Çöpe at"), "Emin misin?" kutusu (`ConfirmView`, `Confirm` prefabı), onaylarsan `ITEM_DISCARD` (`protokol.md` Eşya atma). Kilitli eşya atılmaz; yığın bütün olarak atılır.

## Oyuncuya sağ tık (31.10.2026, Onur)

Dünyada başka bir oyuncunun karakterine sağ tıkla (ya da adına sol tıkla): menü Profil, Fısılda, Takas teklif et, Defterine bak, Arkadaş ekle, Engelle, Şikayet et. Oyuncuya yapılan sağ tık olta atmaz (`FishingController.RightClickTaken`).

## Dünya girişi (pencere açıkken)

31.10.2026 (Onur): **pencere açılınca karakter durmaz.** Süren yürüyüş devam eder, WASD ve haritaya tıklama pencere açıkken de yürütür. Yazı alanı klavyedeyken tuşlar yürütmez. Olta atma pencere açıkken kapalı (`UiRoot.BlocksWorld`; pencereler `WindowView.blocksWorld` ile sayılır, fısıltı pencereleri ve seviye atlama kutusu sayılmaz).

Tıklama sadece **haritada başladıysa** yürütür: pencerenin, HUD'un ya da isim etiketinin içinde basılan fare, basılıyken pencereden çıksa da haritaya geçmez (`WorldController.ReadMouse`). Takas penceresi ve balık tutma yine karakteri tutar.

## Balık tutma tuşları

F ve **sağ tık** aynı: basılı tut (gösterge dolar), bırak (olta atılır; F bakılan yöne, sağ tık farenin yönüne), şamandıra batınca bas (vuruş), basılı tut (çekme). Space ve sol tık da vuruş / çekmede çalışır. Gösterge `balik-at` taslağına göre: Kıyı + Orta kutusu ve ayrı Derin kutusu (kit `meter_back`), sarı dolum, ikisinin üstünde tek beyaz işaret. Derin taslakta kilitli; sunucuda olta seviyesi şartı olmadığı için açık.

## Sohbet

31.10.2026 (Onur): sohbet geçmişi kutusunun üst kenarında, sağda iki yarı saydam ikon (üstüne gelince tam görünür): **tutacak** (tırtıklı ikon: basılı tut, yukarı / aşağı sürükle; geçmiş 48 ile 560 birim arasında istediğin kadar büyür / küçülür, boy bu cihazda saklanır, `ChatResize`) ve **x** (geçmişi kapatır). **Yazı alanı hiç gizlenmez.** Geçmiş kapalıyken yazı alanının sol üst köşesinde küçük **^** butonu onu açar; okunmamış satır varsa üstünde kırmızı nokta. Chat'e yazarken karakter yürümez.

Geçmiş, kutunun altından yukarı büyür ve kutu üstte taşanı keser: en yeni satır hep en altta görünür. (Hata, 31.10.2026: yazı `Truncate` ile kesiliyordu, Unity son satırı atınca kutuda en yeni mesaj yerine bir öncekisi görünüyordu.)

### Alt bar butonları (31.10.2026, Onur)

Pencere butonları yazı değil ikon (geçici çizimler, `ItemIcons` `ui.*`): Pazar, Arkadaşlar, Profil, Defter, Çanta; ayrı Ayarlar. Kısayol harfi köşede küçük, ad ve kısayol üstüne gelince kartta (`HoverTip`). Gönder (Enter ikonu) ve **Emote** sohbet satırının hemen sağında. Yem yuvasının yanında sadece "Yem (Y)", yemin adı üstüne gelince.

### Sohbet balonları

Karakterin üstündeki balonlar uGUI (`World/ChatBubbles.cs`, prefab `Bubble`, kit `bubble` + `bubble_tail`), pencerelerin altında kalan ayrı bir tuvalde. Bir oyuncunun balonları üst üste dizilir: en yeni en altta, ok ucu karaktere bakar; yeni mesaj gelince eskiler yumuşakça yukarı kayar; en fazla 5 (`CharacterView.MaxBubbles`), her biri 6 sn sonra söner. Balonlar ismin (ve durum işaretinin) üstünde durur. Ayarlar > Sohbet balonları kapatır.

## Mini harita ve Başlangıca dön (31.10.2026, Onur)

Sağ üstte bakiyelerin altında (`MiniMapView`, `World/MiniMap.cs`): karakterin çevresindeki 80x60 tile (bir tile bir kit pikseli; su mavi, engel koyu, yürünür yeşil), sen sarı kare, diğer oyuncular küçük noktalar, NPC'ler harfli ikonlar (T Tüccar, Z Zanaatkar, G Görevci, sandık hazırsa !, B Bankacı). Gösterilen alanın dışındaki NPC'ler kenara iğnelenir, yanında yönü gösteren ok. Harita `LakeMap` verisinden çalışırken çizilir.

Altındaki **Başlangıca dön** butonu `GOTO_SPAWN` gönderir; yeri sunucu seçer (başlangıç noktasını ortalayan 10x10 tile alandan rastgele yürünür tile, `protokol.md`). Ret nedenleri (bekle, takastasın, yer yok) bildirim olarak çıkar.

## Elle düzenleme

Prefablar `Editor/UiPrefabBuilder.cs` ile üretilir. Unity'de elle küçük değişiklik (buton yeri, boyut, renk, yazı) yapılabilir:

1. Project penceresinde `Assets/Resources/UI/` altındaki prefaba (ör. `Hud.prefab`) çift tıkla: prefab modu açılır.
2. Hierarchy'de objeyi seç, Inspector'da `Rect Transform` (Pos X / Pos Y, Width / Height), `Image` (sprite, renk) ya da `Text` (yazı, boyut) değiştir. Kaydet (Cmd+S).
3. **Kilitle:** prefab Project'te seçiliyken `CollectionGame > UI > Mark selected prefab as hand-edited`. Builder artık bu prefabı ezmez, atladığını Console'a yazar. Liste: `client/Assets/Editor/UiHandEdited.txt`.
4. Kilidi aç: `CollectionGame > UI > Unmark selected prefab`. Hepsini kilitlilerle birlikte yeniden üretmek: `CollectionGame > UI > Rebuild all (overwrite)` (sorar).

Güvenli: konum, boyut, renk, sprite, yazı, yeni süs objesi eklemek. Güvenli değil: obje silmek ya da yeniden adlandırmak, `*View` bileşenlerindeki referansları değiştirmek (kod onları kullanır), Ayarlar > Hesap'ta `AccountContent` dışına içerik koymak. Kilitli bir prefab builder'daki yeni değişiklikleri almaz; büyük değişiklikte kilidi aç, yeniden üret, elle düzenlemeyi tekrarla (ya da bana söyle, builder'a taşıyayım).

**Ayarlar > Hesap:** `Settings` prefabında `Window/Body/Account` altında iki obje: `AccountContent` (sayfadaki her şey; kendi eklediğin şey de buraya) ve onun üstünde `AccountCover` (opak örtü, Göster butonu). Örtü kapalıyken `AccountContent` tamamen kapalıdır, içindeki hiçbir şey görünmez.

## Yazı tipi

Tek yer: `client/Assets/Resources/Fonts/`. Bir `.ttf` ya da `.otf` koy (birden fazlaysa adı alfabede ilk olan kullanılır). Sonra Unity'de:

1. `CollectionGame > UI > Rebuild all (overwrite)`: bütün pencerelerdeki yazılar yeni fontu alır. Dünyadaki isimler ve balonlar (IMGUI) fontu oyunda kendiliğinden alır.
2. `CollectionGame > UI > Check font (Türkçe)`: ç ğ ı İ ö ş ü Ç Ğ Ö Ş Ü harflerinden eksik olanı Console'a yazar (her build sonrası da yazar).

Pixel fontta fontun Inspector'ında Rendering Mode "Hinted Raster" ya da "Raster" seç; yazı boyutları fontun doğal boyutunun katı olursa keskin kalır.

## Player 2 build

İkinci test oyuncusu `client/player2.app`. Güncellemek: Unity açıksa `CollectionGame > Build Player 2 (macOS)`; Unity kapalıyken terminalde `tools/update-player2.sh`. Sonra `open client/player2.app`.

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
| Ayarlar (Genel, Hesap) | `ayarlar-*` | Genel client; Hesap: kod üret hazır, link/unlink Nakama'nın kendi çağrıları, hesap silme hazır (`account_delete_*`, `protokol.md` Hesap silme RPC'leri) | Hesap sayfası opak örtüyle (`AccountCover`) açılır, Göster'e basınca görünür |
| Balık tutma anları | `balik-*` | Hazır | Sürpriz av, keşif bandı |
| NPC: sat, parçala, birleştir, craft, depo, günlük görev | `npc-*` | Satış/parçala/birleştir/craft/depo hazır (`get_catalog` ile fiyatlar). Günlük görev hazır (`QUEST_*`, `protokol.md` Günlük görev; sandık anında açılır, Float'lı eşya çıkmaz) | Craft sadece Zanaatkar'da |
| Pazar: tezgah alanı, kurma, pano | `tezgah-*` | Tezgah: `STALL_*` hazır (`protokol.md` Pazar). Reklam panosu hazır (`BOARD_*`, `protokol.md` Pazar Panosu; elmas bakiyesi `get_inventory.diamond`); alım ilanı yok; pet seçimi / görünümü client konusu | Genel arama ve fiyat sıralaması yok. Pet 7 tile'dan yakınsa başlık + ilk 4 kalem, tıklayınca tam liste |
| Emote menüsü, dünya görünümü | `emote-*` | `EMOTE_STATUS`, `EMOTE_STATUS_SHOW` hazır. Sahiplik veren sistem (elmas, destekçi, defter) **yok** | Şimdilik sadece 8 ücretsiz emote takılır |
| Bildirimler (yığın, seviye atlama, duyuru, bağlantı) | `bildirim-*` | `ANNOUNCE` hazır. Seviye atlama (XP) **yok**. Çanta/enerji/olta bildirimleri client durumundan çıkar | Yığın en fazla 4 kutu |

## Fısıltı penceresi

Karar 29.10.2026 (Onur): Knight Online'daki gibi **küçük, aç / kapa** pencere. Taslağı henüz yok; kit parçalarıyla (`card`, `button_close_*`) kurulabilir.

- Her konuşma ayrı küçük bir pencere (öneri: 160x110 mantıksal px, başlıkta karşı tarafın adı). Birkaç pencere aynı anda açık kalabilir, sürüklenir: başlık plakasından ya da sol üst köşedeki **tutacak kareden** (31.10.2026, Onur); ekranın dışına çıkmaz.
- Mesajlar satır satır: üstte nick (küçük), altta yazı; **kendi mesajın sağda** ("Sen"), karşı tarafınki solda, sistem notları nicksiz (31.10.2026, Onur).
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
