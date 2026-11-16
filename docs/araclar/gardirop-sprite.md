# Gardırop sprite'ları (Universal LPC)

Oyundaki karakter ve gardırop parçaları [Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator) sayfalarıyla çizilir (karar 16.11.2026). Kurallar: `docs/tasarim/20-gardirop.md`.

## Sayfalar

- Kare 64×64. Satırlar yukarı, sol, aşağı, sağ.
- `walk` 9 kare (0 duruş, 1-8 adım), `idle` 2 kare, `sit` 3 poz (0 yerde, 2 sandalyede).
- Bir parçanın `idle` ya da `sit` sayfası yoksa oyun `walk`'ın duruş karesini gösterir. Eksikler: `tools/wardrobe/import-missing.txt`.

## İçe aktarma

```bash
git clone --filter=blob:none --no-checkout https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator.git /tmp/ulpc
python3 tools/wardrobe/import_lpc.py /tmp/ulpc
python3 tools/wardrobe/preview_look.py /tmp/npcs.png      # NPC görünümlerini oyundaki gibi çizer
```

- Okuduğu: `content/wardrobe/catalog.json` (parça listesi), craft Excel'indeki yol sütunu, ULPC paletleri.
- Yazdığı: `client/Assets/Art/LPC/Universal/...` (sadece gereken sayfalar) ve `client/Assets/Resources/Wardrobe/lpc.json` (renk ramp'ları, parça katmanları, z sırası, renk haritaları).
- Lisans: LPC sayfaları CC-BY-SA / OGA-BY / GPL. İçe aktarma, gönderdiğimiz sayfaların yazar satırlarını `client/Assets/Art/LPC/Universal/CREDITS.csv` dosyasına yazar; oyunun emeği geçenler ekranı buradan beslenmeli.
- Unity bu klasörü okunabilir (`isReadable`) içe aktarır (`Editor/PixelArtImporter.cs`), çünkü renk oyunda boyanır.

## Renk

Her katman tek kaynak sayfadır. Haritası kaynak renkleri ton numarasına (0-5) bağlar; seçilen rengin ramp'ının aynı tonu basılır (`Wardrobe/LpcRecolor.cs`). Temel ramp'lar: kumaş `white`, saç `orange`, metal `steel`, ten `light`, göz `blue`. Temel ramp'ta çizilmemiş parçalar parlaklık sırasıyla eşlenir (içe aktarmanın NOTE satırları).

## Oyunda

- `Wardrobe/LpcLook.cs`: görünüm → katmanlar (gövde, kafa, yüz, sonra parçalar z sırasıyla) ve kareler.
- `World/CharacterView.cs`: oyuncular ve NPC'ler (`Resources/Npcs.json` içindeki `look`).
- `UI/Views/CharacterPortrait.cs`: profil kartı.
- `Wardrobe/WardrobeController.cs`: gardırop penceresi.
