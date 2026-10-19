# client

Unity 6 (6000.6) projesi, Universal 2D şablonu.

- Açmak: Unity Hub → Add → Add project from disk → bu `client/` klasörü.
- Nakama SDK `Packages/manifest.json` içinde (git paketi, sürüm sabit).

## Faz 1'i oynamak

1. Repo kökünde sunucuyu başlat: `docker compose up -d` (Docker Desktop açık olmalı). Kontrol: `cd server && npm install --allow-git=all && npm run smoke` → 16 satır `ok`.
2. Unity'de `Assets/Scenes/SampleScene` açıkken Play. Sahneye bir şey eklemek gerekmez: `Game` kendiliğinden oluşur.
3. Kullanıcı adı yaz (3–16: harf, rakam, `_`), sunucu adresi `127.0.0.1` kalsın, Giriş → bir sunucu seç (Mercan / Liman).
4. **WASD / ok tuşları** veya **sol tık (basılı tutunca takip)** ile yürü. **Enter** chat kutusunu açar, Enter gönderir, Esc vazgeçer. Balon 12 tile içindekilere gider.

### Balık tutma (Faz 2)

İskelenin ucuna yürü (meydandan doğuya, ~85, 48). Suya 1.5 tile yakınken:

- **F basılı tut, bırak**: baktığın yöne olta at (uzun basış = daha uzak, en fazla ~7.5 tile). **Sağ tık**: tıkladığın su noktasına at.
- Şamandıra kıpırdayabilir (sahte); **batınca Space**. Erken ya da geç çekersen kaçar.
- Çekme oyunu: **Space (veya sol tık) basılı tut** yeşil çubuğu kaldırır, bırakınca düşer. Turuncu balığı çubuğun içinde tut, sağdaki ilerleme dolunca yakalarsın.
- **Esc**: oltayı topla (yürümek de toplar). **B**: çanta. Enerji sol üstte; her atış 1 enerji, 0'da sadece çöp çıkar.

Sonucu her zaman sunucu verir; client mini oyunu sadece çizer ve tuş zamanlarını gönderir.

### Collection Book ve profil (Faz 3)

- Bir eşyanın ilk kopyası **"Yeni keşif!"** ile doğrudan defterdeki yuvasına girer (çantada yer kaplamaz). Sayfayı tamamlayan son kayıtta büyük kutlama çıkar.
- Daha temiz (düşük Float) bir kopya gelirse **"Defterdekiyle değiştir?"** sorulur; değiştirince eski kopya çantaya döner.
- **K**: defterim (sayfalar, ?? / silik / dolu yuvalar, Collection Score, şans). Dolu kayıtta **Vitrine koy** (en fazla 3), her bulunmuş kayıtta **Arıyorum**.
- **P**: profil kartım. Başka bir oyuncunun **ismine tıkla**: onun kartı, oradan defteri.
- Sayfa adları client'ta (`CollectionController.PageNames`), sayfalar ve sayılar sunucuda.

### Build ve otomatik test

- Menü: **CollectionGame → Build macOS** (`Builds/macOS/CollectionGame.app`, git'e girmez). Editör kapalıyken komut satırından: `Unity -batchmode -projectPath client -executeMethod CollectionGame.EditorTools.BuildTools.BuildMac -quit -logFile -`.
- **CollectionGame → Check Reel Reference**: C# mini oyun modeli `server/test/fixtures/reel-reference.json` ile birebir mi.
- Otomatik pilot (sadece komut satırından açılınca çalışır): `CollectionGame.app/Contents/MacOS/collection-fishing -screen-fullscreen 0 -cgUser bot1 -cgServer Mercan -cgBot fish -cgSay selam -cgShot /tmp/bot1.png -cgQuit 120`. `-cgBot walk` sadece yürür ve konuşur. Sonuçlar oyuncu logunda `[Autopilot]` / `[Fish]` satırları.

### Web build

- Menü: **CollectionGame → Build Web** (`Builds/Web`, git'e girmez). Komut satırı: `-executeMethod CollectionGame.EditorTools.BuildTools.BuildWeb`. WebGL modülü gerekir (Unity Hub → Installs → Add modules → Web Build Support).
- Yerelde açmak: `cd client/Builds/Web && python3 -m http.server 8080` → tarayıcıda `http://localhost:8080`. Sunucu adresi sayfanın adresinden gelir; aynı Wi-Fi'daki arkadaş `http://<Mac'in IP'si>:8080` açar (Nakama 7350 portu da erişilebilir olmalı).
- Test argümanları adres satırından: `http://localhost:8080/?cgUser=webbot&cgServer=Mercan&cgBot=fish`.
- İnternetten açılması için sunucunun bir yerde barınması gerekiyor (`docs/acik-sorular.md` 12). Sayfa https ise Nakama'ya da https/wss gerekir.
- Web fontunda bazı karakterler yok (… – ×); arayüz yazılarında düz ASCII karşılıkları kullanılıyor.

İki oyuncu: File → Build Profiles → macOS → Build, çıkan uygulamayı aç ve editörle birlikte farklı bir kullanıcı adıyla gir. Aynı sunucuyu seçin. Cihaz kimliği "kurulum id'si + kullanıcı adı" olduğu için aynı Mac'te farklı ad = farklı hesap. Aynı adla ikinci kez girilirse ilk pencere atılır (protokoldeki yeniden bağlanma).

Başka bir Mac'ten bağlanmak için sunucu adresine bu Mac'in yerel IP'sini yaz (7350 portu açık olmalı).

## Kod düzeni

| Klasör | İçerik |
|---|---|
| `Assets/Scripts/Game.cs` | Giriş ekranı, sunucu listesi, dünyaya geçiş (IMGUI, geçici arayüz) |
| `Assets/Scripts/Net/` | `Protocol.cs` (`server/src/protocol.ts` aynası), `Connection.cs` (Nakama giriş, RPC, match soketi) |
| `Assets/Scripts/World/` | `LakeMap` (sunucu çarpışma verisinin aynası), `MapView` (haritayı LPC tile'larıyla çizer), `CharacterView` (LPC katmanları, animasyon), `LocalMover` (tahmin, MOVE, CORRECTION), `RemoteMover` (interpolasyon), `WorldController` (mesajlar, kamera, chat) |
| `Assets/Scripts/Fishing/` | `ReelModel` (sunucudaki mini oyunun birebir C# portu), `FishingController` (atış, vuruş, çekme, sonuç, çanta), `BobberView` |
| `Assets/Scripts/Collection/` | `CollectionController` (defter penceresi, keşif / sayfa kutlaması, değiştirme sorusu, profil kartı) |
| `Assets/Scripts/Dev/Autopilot.cs` | Build'leri komut satırından test eden otomatik oyuncu |
| `Assets/Scripts/Art/ArtCatalog.cs` | `Assets/Art/LPC/` altındaki dokuların listesi; `Assets/Resources/ArtCatalog.asset` editörde otomatik güncellenir (`Editor/ArtCatalogBuilder.cs`, menü: CollectionGame → Refresh Art Catalog) |

Koordinatlar: sunucu tile cinsinden, y aşağı büyür. Unity'de 1 tile = 1 birim, dünya konumu `(x, -y)` (`Coords`).

LPC sayfaları: 64×64 kare, satırlar yukarıdan aşağı **yukarı, sol, aşağı, sağ** (3. satır 1. satırın aynası). Walk 8 kare, Idle 3 kare.

Faz 1 notları:
- `characterId` hep `"default"`. Testte iki oyuncu ayırt edilsin diye görünüş (ten, saç, tişört) oyuncu id'sinden seçiliyor; sadece client tarafında, karakter kaydı gelince kalkacak.
- Harita kodla çiziliyor ve çarpışma `LakeMap.cs` ile `server/src/data/lake-map.ts` aynı olmalı. Gerçek harita tilemap'te çizilince ikisi oradan üretilecek.
- Çeşme görseli 2 tile genişliğinde, sunucudaki engel 3 tile; kenarlarda yarım tile görünmez duvar var.
